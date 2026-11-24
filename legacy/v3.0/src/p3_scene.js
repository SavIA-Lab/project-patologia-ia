
/* =====================================================================
   7. ESCENA THREE.JS: RENDERER, CÁMARA, AYUDAS
   ===================================================================== */
let renderer = null, scene = null, camera = null, controls = null, raycaster = null;
let compositeTexture = null, labelTexture = null;
const pointer = new THREE.Vector2();
const stageGroups = {};
const world = { s1: {}, s2: {}, s3: {}, s4: {}, s5: {} };
const camTween = { active: false, t: 0, dur: 0.9, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() };
const CAM_PRESETS = {
  1: { pos: [0.4, 7.6, 11.8], target: [0.4, 1.8, 0], half: 6.2 },
  2: { pos: [0.4, 8.8, 8.6], target: [0.4, 0.5, 0.1], half: 6.4 },
  3: { pos: [-1.0, 6.2, 12.6], target: [-1.0, 0.7, 0], half: 8.0 },
  4: { pos: [0.3, 9.0, 10.8], target: [0.3, 0.6, 0], half: 8.4 },
  5: { pos: [0.4, 8.4, 7.8], target: [0.4, 0, 0.2], half: 5.9 }
};
const uvToWorld = (u, v, y = 0.08) => new THREE.Vector3(SAMPLE_CENTER_X - SAMPLE_W / 2 + u * SAMPLE_W, y, -SAMPLE_H / 2 + v * SAMPLE_H);

function disposeObjectTree(obj) {
  if (!obj) return;
  obj.traverse(o => {
    if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach(mt => {
      for (const k in mt) { const v = mt[k]; if (v && v.isTexture && !(v.userData && v.userData.shared)) v.dispose(); }
      mt.dispose();
    });
  });
  if (obj.parent) obj.parent.remove(obj);
}
function clearChildren(group) { [...group.children].forEach(c => disposeObjectTree(c)); }

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
/** Sprite de texto procedural (Canvas 2D) */
function makeTextSprite(text, o = {}) {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
  spr.userData = { cv: makeCanvas(8, 8), size: o.size || 28, color: o.color || '#0F172A', bg: o.bg === undefined ? 'rgba(255,255,255,0.9)' : o.bg, mono: !!o.mono, pad: o.pad === undefined ? 8 : o.pad, wpp: o.wpp || 0.0125, border: o.border || null };
  spr.renderOrder = 20;
  setSpriteText(spr, text);
  return spr;
}
function setSpriteText(spr, text) {
  const u = spr.userData, font = `${u.mono ? '500' : '600'} ${u.size}px ${u.mono ? '"JetBrains Mono",monospace' : 'Inter,sans-serif'}`;
  const probe = u.cv.getContext('2d'); probe.font = font;
  const lines = String(text).split('\n'), lw = Math.max(...lines.map(l => probe.measureText(l).width));
  const w = Math.ceil(lw + u.pad * 2), h = Math.ceil(lines.length * u.size * 1.25 + u.pad * 2);
  u.cv.width = w; u.cv.height = h;
  const c = u.cv.getContext('2d'); c.font = font; c.textBaseline = 'top';
  if (u.bg) { c.fillStyle = u.bg; roundRectPath(c, 0, 0, w, h, 10); c.fill(); if (u.border) { c.strokeStyle = u.border; c.lineWidth = 2; c.stroke(); } }
  c.fillStyle = u.color; lines.forEach((l, i) => c.fillText(l, u.pad, u.pad + i * u.size * 1.25 + u.size * 0.08));
  if (spr.material.map) spr.material.map.dispose();
  const tex = new THREE.CanvasTexture(u.cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  spr.material.map = tex; spr.material.needsUpdate = true;
  spr.scale.set(w * u.wpp, h * u.wpp, 1);
}
function makeFrameMesh(w, h, t, color) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + t, -h / 2 + t); hole.lineTo(-w / 2 + t, h / 2 - t); hole.lineTo(w / 2 - t, h / 2 - t); hole.lineTo(w / 2 - t, -h / 2 + t); hole.lineTo(-w / 2 + t, -h / 2 + t);
  s.holes.push(hole);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthTest: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 15;
  return mesh;
}
const sharedGeo = {};
function getSharedGeo(key, factory) {
  if (!sharedGeo[key]) { sharedGeo[key] = factory(); sharedGeo[key].userData.shared = true; }
  return sharedGeo[key];
}
function glowCircleTexture() {
  if (glowCircleTexture.tex) return glowCircleTexture.tex;
  const c = makeCanvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,1)'); g.addColorStop(0.62, 'rgba(255,255,255,0.0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.userData.shared = true; glowCircleTexture.tex = t; return t;
}

function initThree(host) {
  const w = Math.max(10, host.clientWidth), h = Math.max(10, host.clientHeight);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Escena 3D interactiva');
  renderer.domElement.tabIndex = 0;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#F1F5F9');
  scene.fog = new THREE.Fog(0xF1F5F9, 34, 70);
  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
  const p = stagePreset(1);
  camera.position.copy(p.pos);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(p.t);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 3.5; controls.maxDistance = 28; controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();
  raycaster = new THREE.Raycaster();

  // Iluminación de estudio clara
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xC9D3E0, 0.95));
  const key = new THREE.DirectionalLight(0xFFFFFF, 0.85); key.position.set(6, 12, 8); scene.add(key);
  const fill = new THREE.DirectionalLight(0xE3EDFF, 0.35); fill.position.set(-8, 5, -6); scene.add(fill);

  // Grilla de laboratorio sutil
  const grid = new THREE.GridHelper(60, 60, 0xC5CFDC, 0xDDE4EE);
  grid.position.y = -0.14; grid.material.transparent = true; grid.material.opacity = 0.55; grid.material.depthWrite = false;
  scene.add(grid);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0xF1F5F9 }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = -0.15; scene.add(plate);

  compositeTexture = new THREE.CanvasTexture(compCanvas);
  compositeTexture.colorSpace = THREE.SRGBColorSpace; compositeTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); compositeTexture.userData.shared = true;
  labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace; labelTexture.userData.shared = true;

  for (let i = 1; i <= 5; i++) { stageGroups[i] = new THREE.Group(); stageGroups[i].visible = false; scene.add(stageGroups[i]); }
}

function stagePreset(n) {
  const pr = CAM_PRESETS[n], t = new THREE.Vector3(...pr.target), pos = new THREE.Vector3(...pr.pos);
  const aspect = camera ? camera.aspect : 1.5, tanH = Math.tan(THREE.MathUtils.degToRad((camera ? camera.fov : 42) / 2));
  // distancia mínima para que el ancho de la escena quepa en el visor
  const need = pr.half * 1.15 / (tanH * Math.max(aspect, 0.3)), base = pos.distanceTo(t);
  const f = clamp(need / base, 1, 3.4);
  pos.sub(t).multiplyScalar(f).add(t);
  return { pos, t };
}
function flyTo(pos, target, dur = 0.9) {
  camTween.fromPos.copy(camera.position); camTween.fromTarget.copy(controls.target);
  camTween.toPos.copy(pos); camTween.toTarget.copy(target);
  camTween.t = 0; camTween.dur = dur; camTween.active = true;
}
function flyToStagePreset(n, dur) { const p = stagePreset(n); flyTo(p.pos, p.t, dur); }
function flyToUV(u, v) {
  const t = uvToWorld(u, v, 0), pos = t.clone().add(new THREE.Vector3(0, 3.4, 3.2));
  flyTo(pos, t, 0.8);
}
function stepCamTween(dt) {
  if (!camTween.active) return;
  camTween.t += dt / camTween.dur;
  const k = clamp(camTween.t), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
  controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, e);
  if (k >= 1) camTween.active = false;
}

/* =====================================================================
   8. ETAPA 1 — LÁMINA WSI Y PIRÁMIDE MULTI-ESCALA
   ===================================================================== */
function makeSlideAssembly() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 4.8), new THREE.MeshStandardMaterial({ color: 0xDCEBF5, transparent: true, opacity: 0.38, roughness: 0.12, metalness: 0, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0x94A3B8, transparent: true, opacity: 0.75 }));
  glass.add(edges);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(SAMPLE_W + 0.5, 0.04, SAMPLE_H + 0.45), new THREE.MeshStandardMaterial({ color: 0xEAF3FA, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }));
  cover.position.set(SAMPLE_CENTER_X, 0.105, 0);
  const tissue = new THREE.Mesh(new THREE.PlaneGeometry(SAMPLE_W, SAMPLE_H), new THREE.MeshBasicMaterial({ map: compositeTexture }));
  tissue.rotation.x = -Math.PI / 2; tissue.position.set(SAMPLE_CENTER_X, 0.068, 0);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.2), new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true }));
  label.rotation.x = -Math.PI / 2; label.position.set(-4.4, 0.066, 0);
  g.add(glass, cover, tissue, label);
  return { group: g, tissue, label, glass, cover };
}

function buildStage1() {
  const g = stageGroups[1], s1 = world.s1;
  s1.slide = makeSlideAssembly(); g.add(s1.slide.group);
  // Cuadrícula gigapíxel
  const pts = [], cols = 16, rows = 8, y = 0.077;
  for (let i = 0; i <= cols; i++) { const x = SAMPLE_CENTER_X - SAMPLE_W / 2 + i * SAMPLE_W / cols; pts.push(x, y, -SAMPLE_H / 2, x, y, SAMPLE_H / 2); }
  for (let j = 0; j <= rows; j++) { const z = -SAMPLE_H / 2 + j * SAMPLE_H / rows; pts.push(SAMPLE_CENTER_X - SAMPLE_W / 2, y, z, SAMPLE_CENTER_X + SAMPLE_W / 2, y, z); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  s1.gigaGrid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x0F766E, transparent: true, opacity: 0.5 }));
  g.add(s1.gigaGrid);
  // Marcador de foco atípico
  s1.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 48), new THREE.MeshBasicMaterial({ color: 0xBE123C, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
  s1.focusRing.rotation.x = -Math.PI / 2; s1.focusRing.renderOrder = 12; g.add(s1.focusRing);
  s1.focusLabel = makeTextSprite('Foco atípico', { size: 26, color: '#BE123C', wpp: 0.0072 }); g.add(s1.focusLabel);
  // Marco de la ROI
  s1.roi = new THREE.Group(); g.add(s1.roi);
  s1.pyr = new THREE.Group(); g.add(s1.pyr);
  rebuildPyramid();
}

function rebuildPyramid() {
  const s1 = world.s1, m = MODALITIES[state.modality];
  clearChildren(s1.pyr); clearChildren(s1.roi);
  s1.planes = [];
  const roi = uvToWorld(m.primaryFocus.u, m.primaryFocus.v, 0.075);
  s1.roiCenter = roi;
  s1.focusRing.position.copy(roi).setY(0.09);
  s1.focusLabel.position.set(roi.x, 0.55, roi.z - 0.5);
  s1.focusLabel.userData.hostRoi = true;
  const wAt = y => 0.9 + 1.1 * y;
  // ROI sobre la lámina
  const rw = wAt(0), rh = rw / 2, rect = [[-rw / 2, -rh / 2], [rw / 2, -rh / 2], [rw / 2, rh / 2], [-rw / 2, rh / 2]];
  const roiPts = []; rect.forEach((p, i) => { const q = rect[(i + 1) % 4]; roiPts.push(roi.x + p[0], 0.09, roi.z + p[1], roi.x + q[0], 0.09, roi.z + q[1]); });
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(roiPts, 3));
  s1.roi.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x0F766E })));
  // Planos del nivel y líneas de frustum
  PYR_LEVELS.forEach((L, i) => {
    const w = wAt(L.y), h = w / 2, cv = makeCanvas(256, 128);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    pl.rotation.x = -Math.PI / 2; pl.position.set(roi.x, L.y, roi.z);
    pl.userData = { level: i, cv, tex, w, h };
    const fr = new THREE.LineSegments(new THREE.EdgesGeometry(pl.geometry), new THREE.LineBasicMaterial({ color: 0x4C3A7A, transparent: true, opacity: 0.9 }));
    pl.add(fr);
    const lb = makeTextSprite(`${L.mag}×`, { size: 30, color: '#FFFFFF', bg: 'rgba(76,58,122,0.95)', mono: true, wpp: 0.0062 });
    lb.position.set(-w / 2 + 0.3, h / 2 - 0.16, 0.03); // esquina del plano (coordenadas locales)
    pl.add(lb);
    s1.pyr.add(pl); s1.planes.push(pl);
  });
  const top = wAt(PYR_LEVELS[3].y), fp = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
    fp.push(roi.x + sx * rw / 2, 0.09, roi.z + sz * rh / 2, roi.x + sx * top / 2, PYR_LEVELS[3].y, roi.z + sz * top / 4);
  });
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  s1.pyr.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x0F766E, transparent: true, opacity: 0.55 })));
  dirty.pyramidTex = true;
  applyStage1State(true);
}
function refreshPyramidTextures() {
  const s1 = world.s1; if (!s1.planes) return;
  s1.planes.forEach(pl => {
    const c = pl.userData.cv.getContext('2d');
    drawPyramidLevel(c, 256, 128, pl.userData.level);
    pl.userData.tex.needsUpdate = true;
  });
  dirty.pyramidTex = false;
}
function applyStage1State(immediate) {
  const s1 = world.s1; if (!s1.planes) return;
  s1.pyr.visible = state.showPyramid;
  s1.gigaGrid.visible = state.showGigaGrid;
  s1.planes.forEach((pl, i) => {
    const act = i === state.pyramidLevel;
    pl.material.opacity = act ? 0.97 : 0.5;
    pl.userData.targetScale = act ? 1.14 : 1.0;
    if (immediate) pl.scale.setScalar(pl.userData.targetScale);
  });
}
function animateStage1(dt, t) {
  const s1 = world.s1; if (!s1.planes) return;
  s1.planes.forEach(pl => { const k = 1 - Math.exp(-dt * 7), s = pl.scale.x + (pl.userData.targetScale - pl.scale.x) * k; pl.scale.setScalar(s); });
  const pulse = 1 + 0.18 * Math.sin(t * 3);
  s1.focusRing.scale.setScalar(pulse); s1.focusRing.material.opacity = 0.65 + 0.3 * Math.sin(t * 3);
}

/* =====================================================================
   9. ETAPA 2 — TESELADO 3D Y CONTROL DE CALIDAD
   ===================================================================== */
function buildStage2() {
  const g = stageGroups[2], s2 = world.s2;
  s2.slide = makeSlideAssembly();
  // en esta etapa el tejido se reemplaza por las teselas: se conserva un plano tenue como referencia
  s2.slide.tissue.material.transparent = true; s2.slide.tissue.material.opacity = 0.0; s2.slide.tissue.visible = false;
  g.add(s2.slide.group);
  s2.tileGroup = null; s2.tiles = []; s2.infos = [];
  const bgeo = new THREE.BufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 12 * 8 * 2 * 3), 3));
  bgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(24 * 12 * 8 * 2 * 3), 3));
  bgeo.setDrawRange(0, 0);
  s2.borders = new THREE.LineSegments(bgeo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
  s2.borders.renderOrder = 13; s2.borders.frustumCulled = false;
  g.add(s2.borders);
  rebuildTiles();
}

function rebuildTiles() {
  const s2 = world.s2, g = stageGroups[2];
  if (s2.tileGroup) disposeObjectTree(s2.tileGroup);
  if (s2.hoverFrame) disposeObjectTree(s2.hoverFrame);
  if (s2.pinFrame) disposeObjectTree(s2.pinFrame);
  const [cols, rows] = state.patchSize === 224 ? [24, 12] : [14, 7];
  s2.cols = cols; s2.rows = rows;
  const tg = new THREE.Group(); g.add(tg); s2.tileGroup = tg; s2.tiles = [];
  const cw = SAMPLE_W / cols, ch = SAMPLE_H / rows;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const geo = new THREE.BoxGeometry(cw * 0.94, 0.12, ch * 0.94);
    const pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal;
    const u0 = col / cols, u1 = (col + 1) / cols, v0 = row / rows, v1 = (row + 1) / rows;
    for (let i = 0; i < pos.count; i++) {
      if (nrm.getY(i) > 0.5) uv.setXY(i, lerp(u0, u1, pos.getX(i) / (cw * 0.94) + 0.5), 1 - lerp(v0, v1, pos.getZ(i) / (ch * 0.94) + 0.5));
    }
    geo.groups.forEach(gp => { gp.materialIndex = gp.materialIndex === 2 ? 1 : 0; });
    const side = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, transparent: true, roughness: 0.7 });
    const top = new THREE.MeshBasicMaterial({ map: compositeTexture, transparent: true });
    const mesh = new THREE.Mesh(geo, [side, top]);
    mesh.userData = { tileIndex: row * cols + col, col, row, baseX: SAMPLE_CENTER_X - SAMPLE_W / 2 + (col + 0.5) * cw, baseZ: -SAMPLE_H / 2 + (row + 0.5) * ch };
    mesh.position.set(mesh.userData.baseX, 0.1, mesh.userData.baseZ);
    tg.add(mesh); s2.tiles.push(mesh);
  }
  s2.hoverFrame = makeFrameMesh(cw * 1.08, ch * 1.08, Math.min(cw, ch) * 0.1, 0x0F172A); s2.hoverFrame.visible = false; g.add(s2.hoverFrame);
  s2.pinFrame = makeFrameMesh(cw * 1.25, ch * 1.25, Math.min(cw, ch) * 0.24, 0xBE123C); s2.pinFrame.visible = false; g.add(s2.pinFrame);
  s2.hoverIndex = -1;
  dirty.tiles = true;
}

function computeTileInfos() {
  const s2 = world.s2, cols = s2.cols, rows = s2.rows;
  s2.infos = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) s2.infos.push(evalTile(col, row, cols, rows));
}
function tileTopY(mesh) { return mesh.position.y + 0.07; }

function applyTileStates() {
  const s2 = world.s2; if (!s2.tiles.length || s2.infos.length !== s2.tiles.length) return;
  s2.tiles.forEach((mesh, i) => {
    const info = s2.infos[i], side = mesh.material[0], top = mesh.material[1];
    let op = 1, col = 0xFFFFFF, sideCol = 0xE2E8F0;
    if (info.bg) { op = state.discardBg ? 0.07 : 0.82; }
    else if (info.rejected) { op = 0.42; col = 0xF2B8C2; sideCol = 0xBE123C; }
    else if (info.hasArtifact) { sideCol = 0xD97706; }
    else if (info.atypia > 0.45) { sideCol = 0xC95B82; }
    top.opacity = op; top.color.setHex(col); side.opacity = Math.min(1, op + 0.15); side.color.setHex(sideCol);
    mesh.userData.info = info;
  });
  updateTilePositions();
}
function updateTilePositions() {
  const s2 = world.s2; if (!s2.tiles.length || s2.infos.length !== s2.tiles.length) return;
  const e = state.explode, cx = (s2.cols - 1) / 2, cy = (s2.rows - 1) / 2;
  s2.tiles.forEach((mesh, i) => {
    const info = s2.infos[i], u = mesh.userData;
    let h = 0.15 + (info.bg ? 0 : 0.45) + info.atypia * 2.2;
    if (info.hasArtifact) h = info.rejected ? 0.12 : h + 1.3;
    mesh.position.set(u.baseX + e * (u.col - cx) * 0.3, 0.1 + e * h, u.baseZ + e * (u.row - cy) * 0.3);
  });
  updateTileBorders();
}
function updateTileBorders() {
  const s2 = world.s2; if (!s2.tiles.length) return;
  const posA = s2.borders.geometry.attributes.position, colA = s2.borders.geometry.attributes.color;
  const cw = SAMPLE_W / s2.cols * 0.95, ch = SAMPLE_H / s2.rows * 0.95;
  let n = 0;
  s2.tiles.forEach((mesh, i) => {
    const info = s2.infos[i]; if (!info || info.bg || !info.hasArtifact) return;
    const c = info.rejected ? [0.745, 0.071, 0.239] : [0.851, 0.467, 0.024];
    const x = mesh.position.x, y = mesh.position.y + 0.075, z = mesh.position.z, hx = cw / 2, hz = ch / 2;
    const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    for (let k = 0; k < 4; k++) {
      const a = corners[k], b = corners[(k + 1) % 4];
      posA.setXYZ(n, x + a[0], y, z + a[1]); colA.setXYZ(n, c[0], c[1], c[2]); n++;
      posA.setXYZ(n, x + b[0], y, z + b[1]); colA.setXYZ(n, c[0], c[1], c[2]); n++;
    }
  });
  posA.needsUpdate = true; colA.needsUpdate = true;
  s2.borders.geometry.setDrawRange(0, n);
}
function setFrameOnTile(frame, idx) {
  const s2 = world.s2;
  if (idx < 0 || !s2.tiles[idx]) { frame.visible = false; return; }
  const m = s2.tiles[idx]; frame.visible = true;
  frame.position.set(m.position.x, tileTopY(m) + 0.01, m.position.z);
}
function pinnedTileIndex() {
  const p = state.pinned, s2 = world.s2; if (!p || !s2.cols) return -1;
  return p.row * s2.cols + p.col;
}
function animateStage2(dt, t) {
  const s2 = world.s2; if (!s2.tiles.length) return;
  setFrameOnTile(s2.hoverFrame, s2.hoverIndex);
  const pi = pinnedTileIndex();
  setFrameOnTile(s2.pinFrame, pi);
  if (s2.pinFrame.visible) { const k = 1 + 0.12 * Math.sin(t * 4.5); s2.pinFrame.scale.set(k, k, k); s2.pinFrame.material.opacity = 0.6 + 0.4 * Math.sin(t * 4.5) * Math.sin(t * 4.5); }
}
