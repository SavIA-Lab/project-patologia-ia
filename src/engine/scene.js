/* Escena Three.js compartida: renderizador, cámara, controles, sprites de texto y ayudas.
 * Lógica migrada de la v3.0 (p3_scene.js §7 y makeSlideAssembly/makeBeacon). Cambios:
 *  - cada módulo crea su propio grupo (getStageGroup) cuando se carga, en lugar de construir las 5 etapas al arrancar;
 *  - los rótulos 3D se crean con una función de texto (makeTextSprite(() => t(...))) y se regeneran con relabelSprites()
 *    al cambiar de idioma;
 *  - los presets de cámara los declara cada módulo. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SAMPLE_W, SAMPLE_H, SAMPLE_CENTER_X, FONT_SANS, FONT_MONO } from './constants.js';
import { clamp, makeCanvas } from './util.js';
import { compCanvas, labelCanvas, textureRefs } from './textures.js';
import { t } from '../i18n/index.js';

export let renderer = null, scene = null, camera = null, controls = null, raycaster = null;
export let compositeTexture = null, labelTexture = null;
const pointer = new THREE.Vector2();
const stageGroups = {};
/** Rótulos 3D regenerables por idioma */
const labelSprites = new Set();
const camTween = { active: false, t: 0, dur: 0.9, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() };
const uvToWorld = (u, v, y = 0.08) => new THREE.Vector3(SAMPLE_CENTER_X - SAMPLE_W / 2 + u * SAMPLE_W, y, -SAMPLE_H / 2 + v * SAMPLE_H);

function disposeObjectTree(obj) {
  if (!obj) return;
  obj.traverse(o => {
    if (o.isSprite) labelSprites.delete(o);
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
/** Sprite de texto procedural (Canvas 2D). `text` puede ser una función: así el rótulo se regenera al cambiar de idioma. */
function makeTextSprite(text, o = {}) {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
  spr.userData = { tf: typeof text === 'function' ? text : null, cv: makeCanvas(8, 8), size: o.size || 28, color: o.color || '#0F172A', bg: o.bg === undefined ? 'rgba(255,255,255,0.9)' : o.bg, mono: !!o.mono, pad: o.pad === undefined ? 8 : o.pad, wpp: o.wpp || 0.0125, border: o.border || null };
  spr.renderOrder = 20;
  if (spr.userData.tf) labelSprites.add(spr);
  setSpriteText(spr, spr.userData.tf ? spr.userData.tf() : text);
  return spr;
}
function setSpriteText(spr, text) {
  const u = spr.userData, font = `${u.mono ? '500' : '600'} ${u.size}px ${u.mono ? FONT_MONO : FONT_SANS}`;
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

function initThree(host, initialPreset) {
  const w = Math.max(10, host.clientWidth), h = Math.max(10, host.clientHeight);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', t('app.canvasLabel'));
  renderer.domElement.tabIndex = 0;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#F1F5F9');
  scene.fog = new THREE.Fog(0xF1F5F9, 34, 70);
  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
  const p = stagePreset(initialPreset);
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
  textureRefs.composite = compositeTexture;
  labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace; labelTexture.userData.shared = true;
  textureRefs.label = labelTexture;
}

/** Grupo raíz de un módulo (se crea al cargarlo; invisible hasta que se activa) */
function getStageGroup(id) {
  if (!stageGroups[id]) { stageGroups[id] = new THREE.Group(); stageGroups[id].visible = false; scene.add(stageGroups[id]); }
  return stageGroups[id];
}
/** Regenera los rótulos 3D que dependen del idioma */
function relabelSprites() { labelSprites.forEach(spr => setSpriteText(spr, spr.userData.tf())); if (renderer) renderer.domElement.setAttribute('aria-label', t('app.canvasLabel')); }

function stagePreset(pr) {
  const tg = new THREE.Vector3(...pr.target), pos = new THREE.Vector3(...pr.pos);
  const aspect = camera ? camera.aspect : 1.5, tanH = Math.tan(THREE.MathUtils.degToRad((camera ? camera.fov : 42) / 2));
  // distancia mínima para que el ancho de la escena quepa en el visor
  const need = pr.half * 1.15 / (tanH * Math.max(aspect, 0.3)), base = pos.distanceTo(tg);
  const f = clamp(need / base, 1, 3.4);
  pos.sub(tg).multiplyScalar(f).add(tg);
  return { pos, t: tg };
}
function flyTo(pos, target, dur = 0.9) {
  camTween.fromPos.copy(camera.position); camTween.fromTarget.copy(controls.target);
  camTween.toPos.copy(pos); camTween.toTarget.copy(target);
  camTween.t = 0; camTween.dur = dur; camTween.active = true;
}
function flyToPreset(pr, dur) { const p = stagePreset(pr); flyTo(p.pos, p.t, dur); }
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

function makeBeacon(color) {
  const b = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 14; ring.name = 'ring';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthTest: false }));
  pole.position.y = 0.7; pole.renderOrder = 14;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color, depthTest: false }));
  ball.position.y = 1.4; ball.renderOrder = 14;
  b.add(ring, pole, ball);
  return b;
}

export { THREE, pointer, camTween, stageGroups, getStageGroup, relabelSprites, initThree, uvToWorld, disposeObjectTree, clearChildren, roundRectPath,
  makeTextSprite, setSpriteText, makeFrameMesh, getSharedGeo, glowCircleTexture, stagePreset, flyTo, flyToPreset, flyToUV, stepCamTween,
  makeSlideAssembly, makeBeacon };
