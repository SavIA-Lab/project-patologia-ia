/* Etapa 5 · escena: mapa de calor XAI, Top-3 de parches, reto Humano vs. IA.
 * Migrada sin cambios de lógica de la v3.0 (p4_stage345.js §12). El mapa biológico y el campo de calor (`pipeline.bio`,
 * `pipeline.field`) se calculan en src/engine/pipeline.js; aquí solo se colorean y se muestran. */
import { THREE, makeSlideAssembly, makeTextSprite, setSpriteText, makeBeacon, uvToWorld, clearChildren } from '../../engine/scene.js';
import { state, dirty, pipeline } from '../../engine/state.js';
import { MODALITIES } from '../../engine/modalities.js';
import { SAMPLE_W, SAMPLE_H, SAMPLE_CENTER_X } from '../../engine/constants.js';
import { smoothstep, makeCanvas } from '../../engine/util.js';
import { HEAT_W, HEAT_H, rampColor, heatAt, heatVisible, evaluateChallengePins } from '../../engine/pipeline.js';
import { toast } from '../../ui/dom.js';
import { t, fmt } from '../../i18n/index.js';

function buildStage5(g) {
  const s5 = {};
  s5.slide = makeSlideAssembly(); g.add(s5.slide.group);
  s5.heatCv = makeCanvas(HEAT_W, HEAT_H);
  s5.heatTex = new THREE.CanvasTexture(s5.heatCv); s5.heatTex.colorSpace = THREE.SRGBColorSpace;
  s5.heat = new THREE.Mesh(new THREE.PlaneGeometry(SAMPLE_W, SAMPLE_H), new THREE.MeshBasicMaterial({ map: s5.heatTex, transparent: true, depthWrite: false, opacity: state.heatOpacity }));
  s5.heat.rotation.x = -Math.PI / 2; s5.heat.position.set(SAMPLE_CENTER_X, 0.085, 0); s5.heat.renderOrder = 5; g.add(s5.heat);
  s5.top3 = new THREE.Group(); g.add(s5.top3);
  s5.pins = new THREE.Group(); g.add(s5.pins);
  s5.reticle = new THREE.Group();
  const r1 = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 48), new THREE.MeshBasicMaterial({ color: 0xBE123C, transparent: true, side: THREE.DoubleSide, depthTest: false }));
  r1.rotation.x = -Math.PI / 2; r1.renderOrder = 16; r1.name = 'r1';
  const bars = new THREE.Group();
  [[0.62, 0, 0.3, 0.035], [-0.62, 0, 0.3, 0.035], [0, 0.62, 0.035, 0.3], [0, -0.62, 0.035, 0.3]].forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xBE123C, depthTest: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.renderOrder = 16; bars.add(m);
  });
  bars.name = 'bars'; s5.reticle.add(r1, bars); s5.reticle.visible = false; g.add(s5.reticle);
  s5.beacon = makeBeacon(0xBE123C); s5.beacon.visible = false; g.add(s5.beacon);
  s5.beaconLabel = makeTextSprite(() => beaconText(s5), { size: 20, mono: true, wpp: 0.0095, color: '#FFFFFF', bg: 'rgba(190,18,60,0.95)' }); s5.beaconLabel.visible = false; g.add(s5.beaconLabel);
  s5.focusU = null;
  rebuildTop3Markers(s5);
  applyHeatVisibility(s5);
  return s5;
}

function beaconText(s5) {
  return s5.beaconHeat === undefined ? t('s5.lbl.pinned') : t('s5.lbl.pinnedHeat', { h: fmt.num(s5.beaconHeat, 2) });
}

function rebuildTop3Markers(s5) {
  const M = MODALITIES[state.modality];
  clearChildren(s5.top3); s5.markers = [];
  const wp = M.top3.map(tp => uvToWorld(tp.u, tp.v, 0.12));
  M.top3.forEach((tp, i) => {
    const grp = new THREE.Group(), p = wp[i];
    // vecino más cercano en el plano de la lámina: si es menor que 0.9 u, el anillo se achica y el rótulo se desplaza al lado contrario
    let near = -1, nd = 1e9; wp.forEach((q, j) => { if (j !== i) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < nd) { nd = d; near = j; } } });
    const close = nd < 0.9, side = close ? (i < near ? -1 : 1) : 0;
    const ring = new THREE.Mesh(new THREE.RingGeometry(close ? 0.12 : 0.17, close ? 0.16 : 0.22, 36), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, side: THREE.DoubleSide, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 12;
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hit.rotation.x = -Math.PI / 2; hit.userData = { top3: i };
    const lab = makeTextSprite(String(tp.rank), { size: 26, mono: true, wpp: 0.0075, color: '#FFFFFF', bg: 'rgba(190,18,60,0.95)', pad: 6 }); lab.position.set(side * 0.3, 0.42 + (side > 0 ? 0.06 : 0), 0);
    grp.add(ring, hit, lab); grp.position.copy(p); s5.top3.add(grp); s5.markers.push({ grp, hit });
  });
}
function colorizeHeat(s5) {
  const field = pipeline.field; if (!field) return;
  const ctx = s5.heatCv.getContext('2d'), img = ctx.createImageData(HEAT_W, HEAT_H), thr = state.heatThreshold;
  for (let i = 0; i < field.length; i++) {
    const v = field[i], a = smoothstep(thr, thr + 0.12, v), c = rampColor(state.heatScale, v), o = i * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0); s5.heatTex.needsUpdate = true; dirty.heatColor = false;
}

function applyHeatVisibility(s5) {
  if (!s5.heat) return;
  const vis = heatVisible();
  s5.heat.visible = vis; s5.heat.material.opacity = state.heatOpacity; s5.top3.visible = vis;
}


/* ----- Reto Humano vs. IA ----- */
function pinColor(cls) { return cls === 'hit' ? 0x0F766E : (cls === 'periphery' ? 0xD97706 : 0xBE123C); }
function rebuildPins(s5) {
  const ch = state.challenge;
  clearChildren(s5.pins);
  ch.pins.forEach((p, i) => {
    const res = ch.result ? ch.result.items[i] : null, color = res ? pinColor(res.cls) : 0x0F172A;
    const grp = new THREE.Group(), pos = uvToWorld(p.u, p.v, 0.1);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.55, 8), new THREE.MeshBasicMaterial({ color })); stick.position.y = 0.27;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshBasicMaterial({ color })); head.position.y = 0.58;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.18, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
    const lab = makeTextSprite(String(i + 1), { size: 24, mono: true, wpp: 0.01, color: '#FFFFFF', bg: 'rgba(15,23,42,0.92)', pad: 5 }); lab.position.y = 0.95;
    grp.add(stick, head, ring, lab); grp.position.copy(pos); s5.pins.add(grp);
  });
}
function startChallenge(s5) {
  state.challenge = { active: true, pins: [], revealed: false, result: null };
  rebuildPins(s5); applyHeatVisibility(s5); toast('s5.toast.start');
}
function addChallengePin(s5, u, v) {
  const ch = state.challenge; if (!ch.active || ch.revealed || ch.pins.length >= 3) return false;
  ch.pins.push({ u, v }); rebuildPins(s5); return true;
}
function revealChallenge(s5) {
  const ch = state.challenge; if (!ch.active || ch.revealed || ch.pins.length === 0) return false;
  ch.result = evaluateChallengePins(); ch.revealed = true; rebuildPins(s5); applyHeatVisibility(s5); return true;
}
function resetChallenge(s5) {
  state.challenge = { active: false, pins: [], revealed: false, result: null };
  rebuildPins(s5); applyHeatVisibility(s5);
}


function animateStage5(s5, dt, tm) {
  if (!s5.reticle) return;
  // retícula en el Top-3 seleccionado
  const sel = state.selectedTop3, M = MODALITIES[state.modality];
  if (sel >= 0 && heatVisible()) {
    const tp = M.top3[sel], p = uvToWorld(tp.u, tp.v, 0.14);
    s5.reticle.visible = true; s5.reticle.position.copy(p);
    const k = 1 + 0.12 * Math.sin(tm * 4); s5.reticle.scale.set(k, k, k); s5.reticle.rotation.y = tm * 0.8;
  } else s5.reticle.visible = false;
  s5.markers.forEach((m, i) => { const act = i === sel; m.grp.children[0].material.color.setHex(act ? 0xBE123C : 0xFFFFFF); const sc = act ? 1.35 : 1 + 0.08 * Math.sin(tm * 3 + i); m.grp.children[0].scale.set(sc, sc, sc); });
  // baliza del parche fijado
  const pn = state.pinned;
  if (pn && heatVisible()) {
    const p = uvToWorld(pn.u, pn.v, 0.1); s5.beacon.visible = true; s5.beacon.position.copy(p);
    const ring = s5.beacon.getObjectByName('ring'), k = 1 + 0.35 * Math.sin(tm * 5); ring.scale.set(k, k, k); ring.material.opacity = 0.55 + 0.45 * Math.sin(tm * 5) ** 2;
    s5.beaconLabel.visible = true; s5.beaconLabel.position.set(p.x, 1.75, p.z);
    s5.beaconHeat = heatAt(pn.u, pn.v);
    const lab = beaconText(s5);
    if (s5.beaconLabel.userData.last !== lab) { s5.beaconLabel.userData.last = lab; setSpriteText(s5.beaconLabel, lab); }
  } else { s5.beacon.visible = false; s5.beaconLabel.visible = false; }
}

export { buildStage5, rebuildTop3Markers, colorizeHeat, applyHeatVisibility, rebuildPins, startChallenge, addChallengePin, revealChallenge, resetChallenge, animateStage5 };
