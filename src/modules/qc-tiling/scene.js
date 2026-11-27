/* Etapa 2 · escena: teselado 3D y control de calidad.
 * Migrada sin cambios de lógica de la v3.0 (p3_scene.js §9). Las teselas evaluadas viven en `pipeline.tiles`
 * (src/engine/state.js) y se calculan en src/engine/pipeline.js, aunque este módulo no esté cargado. */
import { THREE, makeSlideAssembly, makeFrameMesh, disposeObjectTree, compositeTexture } from '../../engine/scene.js';
import { state, dirty, pipeline } from '../../engine/state.js';
import { SAMPLE_W, SAMPLE_H, SAMPLE_CENTER_X } from '../../engine/constants.js';
import { lerp } from '../../engine/util.js';

function buildStage2(g) {
  const s2 = {};
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
  rebuildTiles(s2, g);
  return s2;
}

function rebuildTiles(s2, g) {
  if (s2.tileGroup) disposeObjectTree(s2.tileGroup);
  if (s2.hoverFrame) disposeObjectTree(s2.hoverFrame);
  if (s2.pinFrame) disposeObjectTree(s2.pinFrame);
  const { cols, rows } = pipeline.tiles;   // la rejilla la fija syncTileGrid() según el tamaño de parche
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

function tileTopY(mesh) { return mesh.position.y + 0.07; }

function applyTileStates(s2) {
  const infos = pipeline.tiles.infos; if (!s2.tiles.length || infos.length !== s2.tiles.length) return;
  s2.tiles.forEach((mesh, i) => {
    const info = infos[i], side = mesh.material[0], top = mesh.material[1];
    let op = 1, col = 0xFFFFFF, sideCol = 0xE2E8F0;
    if (info.bg) { op = state.discardBg ? 0.07 : 0.82; }
    else if (info.rejected) { op = 0.42; col = 0xF2B8C2; sideCol = 0xBE123C; }
    else if (info.hasArtifact) { sideCol = 0xD97706; }
    else if (info.atypia > 0.45) { sideCol = 0xC95B82; }
    top.opacity = op; top.color.setHex(col); side.opacity = Math.min(1, op + 0.15); side.color.setHex(sideCol);
    mesh.userData.info = info;
  });
  updateTilePositions(s2);
}
function updateTilePositions(s2) {
  const infos = pipeline.tiles.infos; if (!s2.tiles.length || infos.length !== s2.tiles.length) return;
  const e = state.explode, cx = (s2.cols - 1) / 2, cy = (s2.rows - 1) / 2;
  s2.tiles.forEach((mesh, i) => {
    const info = infos[i], u = mesh.userData;
    let h = 0.15 + (info.bg ? 0 : 0.45) + info.atypia * 2.2;
    if (info.hasArtifact) h = info.rejected ? 0.12 : h + 1.3;
    mesh.position.set(u.baseX + e * (u.col - cx) * 0.3, 0.1 + e * h, u.baseZ + e * (u.row - cy) * 0.3);
  });
  updateTileBorders(s2);
}
function updateTileBorders(s2) {
  const infos = pipeline.tiles.infos; if (!s2.tiles.length) return;
  const posA = s2.borders.geometry.attributes.position, colA = s2.borders.geometry.attributes.color;
  const cw = SAMPLE_W / s2.cols * 0.95, ch = SAMPLE_H / s2.rows * 0.95;
  let n = 0;
  s2.tiles.forEach((mesh, i) => {
    const info = infos[i]; if (!info || info.bg || !info.hasArtifact) return;
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
function setFrameOnTile(s2, frame, idx) {
  if (idx < 0 || !s2.tiles[idx]) { frame.visible = false; return; }
  const m = s2.tiles[idx]; frame.visible = true;
  frame.position.set(m.position.x, tileTopY(m) + 0.01, m.position.z);
}
function pinnedTileIndex(s2) {
  const p = state.pinned; if (!p || !s2.cols) return -1;
  return p.row * s2.cols + p.col;
}
function animateStage2(s2, dt, t) {
  if (!s2.tiles.length) return;
  setFrameOnTile(s2, s2.hoverFrame, s2.hoverIndex);
  const pi = pinnedTileIndex(s2);
  setFrameOnTile(s2, s2.pinFrame, pi);
  if (s2.pinFrame.visible) { const k = 1 + 0.12 * Math.sin(t * 4.5); s2.pinFrame.scale.set(k, k, k); s2.pinFrame.material.opacity = 0.6 + 0.4 * Math.sin(t * 4.5) * Math.sin(t * 4.5); }
}

export { buildStage2, rebuildTiles, applyTileStates, updateTilePositions, updateTileBorders, setFrameOnTile, pinnedTileIndex, animateStage2, tileTopY };
