/* Etapa 1 · escena: lámina WSI y pirámide multi-escala.
 * Migrada sin cambios de lógica de la v3.0 (p3_scene.js §8). La escena ya no es un objeto global (`world.s1`):
 * cada función recibe el objeto de escena `s1`. */
import { THREE, makeSlideAssembly, makeTextSprite, uvToWorld, clearChildren } from '../../engine/scene.js';
import { state, dirty } from '../../engine/state.js';
import { MODALITIES } from '../../engine/modalities.js';
import { SAMPLE_W, SAMPLE_H, SAMPLE_CENTER_X, PYR_LEVELS } from '../../engine/constants.js';
import { makeCanvas } from '../../engine/util.js';
import { drawPyramidLevel } from '../../engine/textures.js';
import { t } from '../../i18n/index.js';

function buildStage1(g) {
  const s1 = {};
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
  s1.focusLabel = makeTextSprite(() => t('s1.focusLabel'), { size: 26, color: '#BE123C', wpp: 0.0072 }); g.add(s1.focusLabel);
  // Marco de la ROI
  s1.roi = new THREE.Group(); g.add(s1.roi);
  s1.pyr = new THREE.Group(); g.add(s1.pyr);
  rebuildPyramid(s1);
  return s1;
}

function rebuildPyramid(s1) {
  const m = MODALITIES[state.modality];
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
  applyStage1State(s1, true);
}
function refreshPyramidTextures(s1) {
  if (!s1.planes) return;
  s1.planes.forEach(pl => {
    const c = pl.userData.cv.getContext('2d');
    drawPyramidLevel(c, 256, 128, pl.userData.level);
    pl.userData.tex.needsUpdate = true;
  });
  dirty.pyramidTex = false;
}
function applyStage1State(s1, immediate) {
  if (!s1.planes) return;
  s1.pyr.visible = state.showPyramid;
  s1.gigaGrid.visible = state.showGigaGrid;
  s1.planes.forEach((pl, i) => {
    const act = i === state.pyramidLevel;
    pl.material.opacity = act ? 0.97 : 0.5;
    pl.userData.targetScale = act ? 1.14 : 1.0;
    if (immediate) pl.scale.setScalar(pl.userData.targetScale);
  });
}
function animateStage1(s1, dt, t) {
  if (!s1.planes) return;
  s1.planes.forEach(pl => { const k = 1 - Math.exp(-dt * 7), s = pl.scale.x + (pl.userData.targetScale - pl.scale.x) * k; pl.scale.setScalar(s); });
  const pulse = 1 + 0.18 * Math.sin(t * 3);
  s1.focusRing.scale.setScalar(pulse); s1.focusRing.material.opacity = 0.65 + 0.3 * Math.sin(t * 3);
}

export { buildStage1, rebuildPyramid, refreshPyramidTextures, applyStage1State, animateStage1 };
