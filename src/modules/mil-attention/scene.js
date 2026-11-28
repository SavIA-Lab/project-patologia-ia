/* Etapa 4 · escena: Multiple-Instance Learning (bolsa de instancias, agregador y probabilidad de lámina).
 * Migrada sin cambios de lógica de la v3.0 (p4_stage345.js §11). Los datos (`pipeline.bag`, `pipeline.mil`) y los cálculos
 * (computeBag, recomputeBagRank, computeMIL, activeWeights) viven en src/engine/pipeline.js. */
import { THREE, makeTextSprite, setSpriteText, getSharedGeo } from '../../engine/scene.js';
import { state, pipeline } from '../../engine/state.js';
import { MIL_COLS, MIL_ROWS, MIL_BAG_SIZE } from '../../engine/constants.js';
import { clamp } from '../../engine/util.js';
import { AGG_KEY, activeWeights, cellIndexUV } from '../../engine/pipeline.js';
import { t, fmt } from '../../i18n/index.js';

const BAG_SP = 0.4, AGG_POS = new THREE.Vector3(3.9, 1.0, 0), BAR_X = 7.0, BAR_H = 4.0;
const bagPos = (i, j) => new THREE.Vector3(-3.2 + (i - (MIL_COLS - 1) / 2) * BAG_SP, 0.4, (j - (MIL_ROWS - 1) / 2) * BAG_SP);

function buildStage4(g) {
  const s4 = {};
  const plate = new THREE.Mesh(new THREE.BoxGeometry(MIL_COLS * BAG_SP + 0.3, 0.05, MIL_ROWS * BAG_SP + 0.3), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8, roughness: 0.8 }));
  plate.position.set(-3.2, 0.05, 0); g.add(plate);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0xCBD5E1 })); edges.position.copy(plate.position); g.add(edges);
  const sg = getSharedGeo('milSphere', () => new THREE.SphereGeometry(1, 14, 10));
  s4.nodes = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.42 }), MIL_BAG_SIZE);
  s4.nodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); s4.nodes.frustumCulled = false;
  s4.nodes.boundingSphere = new THREE.Sphere(new THREE.Vector3(-3.2, 1, 0), 10);
  const cg = getSharedGeo('milCyl', () => new THREE.CylinderGeometry(1, 1, 1, 6, 1, true));
  s4.links = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0xFFFFFF }), MIL_BAG_SIZE);
  s4.links.instanceMatrix.setUsage(THREE.DynamicDrawUsage); s4.links.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), c0 = new THREE.Color(0x94A3B8);
  for (let i = 0; i < MIL_BAG_SIZE; i++) { s4.nodes.setMatrixAt(i, zero); s4.nodes.setColorAt(i, c0); s4.links.setMatrixAt(i, zero); s4.links.setColorAt(i, c0); }
  g.add(s4.links, s4.nodes);
  // Nodo agregador
  s4.agg = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), new THREE.MeshStandardMaterial({ color: 0x4C3A7A, roughness: 0.35, emissive: 0x4C3A7A, emissiveIntensity: 0.12 }));
  s4.agg.position.copy(AGG_POS); g.add(s4.agg);
  s4.aggRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.025, 8, 48), new THREE.MeshBasicMaterial({ color: 0x4C3A7A, transparent: true, opacity: 0.55 }));
  s4.aggRing.position.copy(AGG_POS); s4.aggRing.rotation.x = Math.PI / 2; g.add(s4.aggRing);
  s4.aggLabel = makeTextSprite(() => t('s4.lbl.agg.' + state.aggregator), { size: 24, wpp: 0.009, color: '#4C3A7A' }); s4.aggLabel.position.set(AGG_POS.x, 2.2, 0); g.add(s4.aggLabel);
  s4.bagLabel = makeTextSprite(() => t('s4.lbl.bag', { n: MIL_BAG_SIZE, cols: MIL_COLS, rows: MIL_ROWS }), { size: 24, wpp: 0.009 }); s4.bagLabel.position.set(-3.2, 3.0, 0); g.add(s4.bagLabel);
  // Barra de probabilidad diagnóstica
  const track = new THREE.Mesh(new THREE.BoxGeometry(0.9, BAR_H, 0.9), new THREE.MeshStandardMaterial({ color: 0xE2E8F0, transparent: true, opacity: 0.35, depthWrite: false }));
  track.position.set(BAR_X, BAR_H / 2, 0); g.add(track);
  const te = new THREE.LineSegments(new THREE.EdgesGeometry(track.geometry), new THREE.LineBasicMaterial({ color: 0x94A3B8 })); te.position.copy(track.position); g.add(te);
  s4.bar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1, 0.76), new THREE.MeshStandardMaterial({ color: 0x0F766E, roughness: 0.4 }));
  s4.bar.position.set(BAR_X, 0.01, 0); g.add(s4.bar);
  const thr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 1.5), new THREE.MeshBasicMaterial({ color: 0xD97706, transparent: true, opacity: 0.85 })); thr.position.set(BAR_X, BAR_H * 0.5, 0); g.add(thr);
  const thrL = makeTextSprite(() => t('s4.lbl.threshold', { v: fmt.num(0.5, 2) }), { size: 20, mono: true, wpp: 0.0082, color: '#B45309', bg: 'rgba(255,255,255,0.85)' }); thrL.position.set(BAR_X - 1.55, BAR_H * 0.5 + 0.28, 0); g.add(thrL);
  s4.barLabel = makeTextSprite(() => 'Ŷ = ' + fmt.num(s4.barValue || 0, 3), { size: 26, mono: true, wpp: 0.0095 }); s4.barLabel.position.set(BAR_X, BAR_H + 0.55, 0); g.add(s4.barLabel);
  const barTitle = makeTextSprite(() => t('s4.lbl.barTitle'), { size: 20, wpp: 0.0085, bg: null, color: '#475569' }); barTitle.position.set(BAR_X, -0.45, 0); g.add(barTitle);
  const lk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, BAR_X - 0.45 - AGG_POS.x - 0.62, 8), new THREE.MeshBasicMaterial({ color: 0x4C3A7A, transparent: true, opacity: 0.6 }));
  lk.rotation.z = Math.PI / 2; lk.position.set((BAR_X - 0.45 + AGG_POS.x + 0.62) / 2, 1.0, 0); g.add(lk);
  // Marcas de instancias distractoras
  s4.distSprites = [0, 1].map(() => { const s = makeTextSprite(() => t('s4.lbl.distractor'), { size: 20, mono: true, wpp: 0.0095, color: '#FFFFFF', bg: 'rgba(217,119,6,0.95)' }); s.visible = false; g.add(s); return s; });
  // Resaltado de trazabilidad
  s4.hiRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 40), new THREE.MeshBasicMaterial({ color: 0xBE123C, transparent: true, side: THREE.DoubleSide, depthTest: false }));
  s4.hiRing.rotation.x = -Math.PI / 2; s4.hiRing.renderOrder = 14; s4.hiRing.visible = false; g.add(s4.hiRing);
  s4.hiLink = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xBE123C, transparent: true, opacity: 0.85, depthTest: false }));
  s4.hiLink.renderOrder = 14; s4.hiLink.visible = false; g.add(s4.hiLink);
  s4.hiLabel = makeTextSprite(() => hiLabelText(s4), { size: 20, mono: true, wpp: 0.0095, color: '#FFFFFF', bg: 'rgba(190,18,60,0.95)' }); s4.hiLabel.visible = false; g.add(s4.hiLabel);
  s4.nodePos = [];
  for (let j = 0; j < MIL_ROWS; j++) for (let i = 0; i < MIL_COLS; i++) s4.nodePos.push(bagPos(i, j));
  return s4;
}


function hiLabelText(s4) {
  if (!s4.hiState) return t('s4.lbl.pinned');
  return s4.hiState === 'excluded' ? t('s4.lbl.pinnedExcluded') : t('s4.lbl.pinnedWeight', { a: s4.hiState });
}

function applyMILVisuals(s4) {
  const S = pipeline.mil; if (!S) return;
  const key = AGG_KEY[state.aggregator], W = S.w[key], N = MIL_BAG_SIZE;
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const bg = new THREE.Color(0xF1F5F9), hema = new THREE.Color(0x4C3A7A), cl = new THREE.Color(), lc = new THREE.Color();
  const cLow = new THREE.Color(0xA8B4C5), cMid = new THREE.Color(0xD97706), cHigh = new THREE.Color(0xBE123C);
  for (let k = 0; k < N; k++) {
    const base = s4.nodePos[k], qv = Math.sqrt(Math.min(1, W[k] * 8)), excl = S.excl[k];
    if (excl) {
      p.set(base.x, 0.2, base.z); sc.setScalar(0.07); mx.compose(p, q.identity(), sc); s4.nodes.setMatrixAt(k, mx); s4.nodes.setColorAt(k, cl.setHex(0xE2E8F0));
      sc.set(0, 0, 0); mx.compose(p, q, sc); s4.links.setMatrixAt(k, mx); continue;
    }
    const rad = 0.07 + 0.11 * qv; p.set(base.x, 0.4 + 1.0 * qv, base.z);
    sc.setScalar(rad); mx.compose(p, q.identity(), sc); s4.nodes.setMatrixAt(k, mx);
    const sk = S.s[k];
    if (S.isDist[k]) cl.setHex(0xEA580C); else if (sk < 0.5) cl.copy(cLow).lerp(cMid, sk * 0.9); else cl.copy(cMid).lerp(cHigh, clamp((sk - 0.5) / 0.4));
    s4.nodes.setColorAt(k, cl);
    // conector al nodo de agregación
    dir.copy(AGG_POS).sub(p); const L = dir.length(); dir.normalize();
    q.setFromUnitVectors(up, dir);
    const r = 0.004 + 0.06 * qv;
    sc.set(r, L, r); p.addScaledVector(dir, L / 2); mx.compose(p, q, sc); s4.links.setMatrixAt(k, mx);
    lc.copy(bg).lerp(hema, 0.14 + 0.86 * qv); s4.links.setColorAt(k, lc);
    p.copy(base);
  }
  s4.nodes.instanceMatrix.needsUpdate = true; s4.nodes.instanceColor.needsUpdate = true;
  s4.links.instanceMatrix.needsUpdate = true; s4.links.instanceColor.needsUpdate = true;
  // Barra de probabilidad y etiquetas
  const yv = S.y[key];
  s4.bar.scale.y = Math.max(0.02, yv * BAR_H); s4.bar.position.y = s4.bar.scale.y / 2;
  s4.bar.material.color.setHex(yv >= 0.5 ? 0xBE123C : 0x0F766E);
  s4.barValue = yv; s4.hiState = null;
  setSpriteText(s4.barLabel, 'Ŷ = ' + fmt.num(yv, 3));
  setSpriteText(s4.aggLabel, t('s4.lbl.agg.' + state.aggregator));
  s4.aggLabel.position.y = 2.3;
  s4.distSprites.forEach((sp, i) => {
    const idx = S.dist[i]; sp.visible = idx !== undefined;
    if (sp.visible) { const b = s4.nodePos[idx]; sp.position.set(b.x, 2.2, b.z); }
  });
  updateMilHighlight(s4);
}
function pinnedBagIndex() { const p = state.pinned; return p ? cellIndexUV(p.u, p.v) : -1; }
function updateMilHighlight(s4) {
  const S = pipeline.mil, idx = pinnedBagIndex();
  if (!S || idx < 0) { s4.hiRing.visible = s4.hiLink.visible = s4.hiLabel.visible = false; return; }
  const W = activeWeights(), qv = Math.sqrt(Math.min(1, W[idx] * 8)), base = s4.nodePos[idx];
  const pos = new THREE.Vector3(base.x, S.excl[idx] ? 0.2 : 0.4 + qv, base.z);
  s4.hiRing.position.copy(pos); s4.hiRing.visible = true;
  s4.hiLabel.position.set(pos.x, pos.y + 0.75, pos.z); s4.hiLabel.visible = true;
  s4.hiState = S.excl[idx] ? 'excluded' : fmt.pct(W[idx], 1);
  setSpriteText(s4.hiLabel, hiLabelText(s4));
  if (S.excl[idx]) { s4.hiLink.visible = false; return; }
  const dir = AGG_POS.clone().sub(pos), L = dir.length(); dir.normalize();
  s4.hiLink.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  s4.hiLink.position.copy(pos).addScaledVector(dir, L / 2); s4.hiLink.scale.set(0.022 + 0.06 * qv, L, 0.022 + 0.06 * qv); s4.hiLink.visible = true;
}
function animateStage4(s4, dt, tm) {
  if (!s4.hiRing) return;
  if (s4.hiRing.visible) { const k = 1 + 0.25 * Math.sin(tm * 5); s4.hiRing.scale.set(k, k, k); s4.hiRing.material.opacity = 0.6 + 0.4 * Math.sin(tm * 5) ** 2; }
  s4.aggRing.rotation.z += dt * 0.6;
  const S = pipeline.mil; if (S) s4.agg.material.emissiveIntensity = 0.12 + 0.1 * Math.sin(tm * 2);
}


export { buildStage4, applyMILVisuals, updateMilHighlight, animateStage4, AGG_POS };
