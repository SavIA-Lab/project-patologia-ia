/* Etapa 3 · escena: codificador (ViT), espacio latente UMAP 3D y cambio de dominio.
 * Migrada sin cambios de lógica de la v3.0 (p4_stage345.js §10). Los datos de la nube (`pipeline.umap`) y su
 * cálculo (rebuildUmapData, updateUmapTargets, umapMetrics…) viven en src/engine/pipeline.js. */
import { THREE, makeTextSprite, setSpriteText, getSharedGeo, glowCircleTexture, makeBeacon } from '../../engine/scene.js';
import { state, pipeline } from '../../engine/state.js';
import { UMAP_N, UMAP_MAX } from '../../engine/constants.js';
import { lerp, SeededRandom } from '../../engine/util.js';
import { contamActive, pointColorHex } from '../../engine/pipeline.js';
import { t } from '../../i18n/index.js';

const PARTICLE_N = 90;

function buildStage3(g) {
  const s3 = {};
  // Parches de entrada
  s3.inputs = new THREE.Group(); s3.inputs.position.set(-8.3, 0.9, 0); g.add(s3.inputs);
  [-0.75, 0, 0.75].forEach((z, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.62), new THREE.MeshStandardMaterial({ color: [0xE8B8CB, 0xD7A4C0, 0xC9B6DC][i], roughness: 0.6 }));
    b.position.set(0, i * 0.08, z); s3.inputs.add(b);
  });
  const inLab = makeTextSprite(() => t('s3.lbl.patches', { px: 224 }), { size: 22, wpp: 0.0082 }); inLab.position.set(-8.3, 2.0, 0); g.add(inLab);
  // Bloque del Foundation Encoder
  s3.encoder = new THREE.Group(); s3.encoder.position.set(-5.4, 0.9, 0); g.add(s3.encoder);
  s3.slabs = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.3, 1.7), new THREE.MeshStandardMaterial({ color: 0x94A3B8, transparent: true, opacity: 0.93, roughness: 0.5, emissive: 0x4C3A7A, emissiveIntensity: 0 }));
    m.position.x = -1.55 + i * 0.62; s3.encoder.add(m); s3.slabs.push(m);
  }
  const eLab = makeTextSprite(() => t('s3.lbl.encoder'), { size: 24, wpp: 0.0088, color: '#4C3A7A' }); eLab.position.set(-5.4, 3.1, 0); g.add(eLab);
  s3.encoderLabel = makeTextSprite(() => t(state.encoderTrained ? 's3.lbl.trained' : 's3.lbl.untrained'), { size: 22, mono: true, wpp: 0.0082, color: '#475569' }); s3.encoderLabel.position.set(-5.4, -0.55, 0); g.add(s3.encoderLabel);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0x4C3A7A }));
  arrow.rotation.z = -Math.PI / 2; arrow.position.set(-3.3, 0.9, 0); g.add(arrow);
  const arrow0 = arrow.clone(); arrow0.position.set(-7.4, 0.9, 0); g.add(arrow0);
  // Nube UMAP
  s3.cloud = new THREE.Group(); s3.cloud.position.set(3.2, 1.9, 0); g.add(s3.cloud);
  const geo = getSharedGeo('umapSphere', () => new THREE.SphereGeometry(0.1, 12, 10));
  s3.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.45, metalness: 0 }), UMAP_MAX);
  s3.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  s3.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14); s3.mesh.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color(0x888888);
  for (let i = 0; i < UMAP_MAX; i++) { s3.mesh.setMatrixAt(i, zero); s3.mesh.setColorAt(i, col); }
  s3.cloud.add(s3.mesh);
  // Ejes sutiles
  const o = [-4.3, -2.6, -3.6], L = 2.0, ap = [o[0], o[1], o[2], o[0] + L, o[1], o[2], o[0], o[1], o[2], o[0], o[1] + L, o[2], o[0], o[1], o[2], o[0], o[1], o[2] + L];
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
  s3.cloud.add(new THREE.LineSegments(ag, new THREE.LineBasicMaterial({ color: 0x94A3B8 })));
  [['UMAP-1', [o[0] + L + 0.35, o[1], o[2]]], ['UMAP-2', [o[0], o[1] + L + 0.25, o[2]]], ['UMAP-3', [o[0], o[1], o[2] + L + 0.35]]].forEach(([txt, p]) => {
    const s = makeTextSprite(txt, { size: 20, mono: true, bg: null, wpp: 0.0095, color: '#64748B' }); s.position.set(...p); s3.cloud.add(s);
  });
  const cLab = makeTextSprite(() => t('s3.lbl.umap'), { size: 24, wpp: 0.009, color: '#0F172A' }); cLab.position.set(3.2, 5.1, 0); g.add(cLab);
  // Partículas de parches fluyendo del encoder a la nube
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_N * 3), 3));
  pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PARTICLE_N * 3), 3));
  s3.particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.3, map: glowCircleTexture(), vertexColors: true, transparent: true, alphaTest: 0.4, depthWrite: false, sizeAttenuation: true }));
  s3.particles.frustumCulled = false; g.add(s3.particles);
  const rng = new SeededRandom(99);
  s3.pData = Array.from({ length: PARTICLE_N }, () => ({ phase: rng.next(), speed: rng.range(0.18, 0.34), idx: rng.int(0, UMAP_N - 1), oy: rng.range(-0.9, 0.9), oz: rng.range(-0.7, 0.7) }));
  // Baliza de trazabilidad
  s3.beacon = makeBeacon(0xBE123C); s3.beacon.visible = false; g.add(s3.beacon);
  return s3;
}

function applyUmapColors(s3) {
  const col = new THREE.Color(), pc = s3.particles.geometry.attributes.color;
  for (let i = 0; i < UMAP_MAX; i++) { col.setHex(pointColorHex(i)); s3.mesh.setColorAt(i, col); }
  s3.mesh.instanceColor.needsUpdate = true;
  s3.pData.forEach((p, j) => { col.setHex(pointColorHex(p.idx)); pc.setXYZ(j, col.r, col.g, col.b); });
  pc.needsUpdate = true;
}

function stepStage3(s3, dt, tm) {
  const U = pipeline.umap; if (!U) return;
  const target = state.encoderTrained ? 1 : 0;
  U.encT += (target - U.encT) * (1 - Math.exp(-dt * 2.4));
  if (Math.abs(target - U.encT) < 0.002) U.encT = target;
  const k = 1 - Math.exp(-dt * 5), mx = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let i = 0; i < UMAP_MAX; i++) {
    const o = i * 3;
    for (let a = 0; a < 3; a++) { const want = lerp(U.tgtU[o + a], U.tgtT[o + a], U.encT); U.cur[o + a] += (want - U.cur[o + a]) * k; }
    const vis = contamActive(i) ? 1 : 0;
    U.scl[i] += (vis - U.scl[i]) * Math.min(1, k * 1.4);
    if (U.scl[i] < 0.01 && !vis) { sc.set(0, 0, 0); } else sc.setScalar(U.scl[i] * (i >= UMAP_N ? 1.15 : 1));
    p.set(U.cur[o], U.cur[o + 1], U.cur[o + 2]);
    mx.compose(p, q, sc); s3.mesh.setMatrixAt(i, mx);
  }
  s3.mesh.instanceMatrix.needsUpdate = true;
  // Estado visual del encoder
  const c1 = new THREE.Color(0x94A3B8), c2 = new THREE.Color(0x4C3A7A);
  s3.slabs.forEach((m, i) => {
    m.material.color.copy(c1).lerp(c2, U.encT);
    m.material.emissiveIntensity = U.encT * (0.12 + 0.28 * (0.5 + 0.5 * Math.sin(tm * 3 - i * 0.8)));
  });
  // Partículas
  const pa = s3.particles.geometry.attributes.position, start = new THREE.Vector3(-3.0, 0.9, 0), end = new THREE.Vector3();
  s3.pData.forEach((d, j) => {
    d.phase += dt * d.speed; if (d.phase > 1) d.phase -= 1;
    const e = d.phase * d.phase * (3 - 2 * d.phase), o = d.idx * 3;
    end.set(s3.cloud.position.x + U.cur[o], s3.cloud.position.y + U.cur[o + 1], s3.cloud.position.z + U.cur[o + 2]);
    pa.setXYZ(j, lerp(start.x, end.x, e), lerp(start.y + d.oy * (1 - e), end.y, e) + Math.sin(Math.PI * d.phase) * 0.6, lerp(start.z + d.oz * (1 - e), end.z, e));
  });
  pa.needsUpdate = true;
  // Baliza del parche fijado
  const pn = state.pinned, bc = s3.beacon;
  if (pn && pn.umapIndex >= 0 && contamActive(pn.umapIndex)) {
    const o = pn.umapIndex * 3; bc.visible = true;
    bc.position.set(s3.cloud.position.x + U.cur[o], s3.cloud.position.y + U.cur[o + 1] - 0.05, s3.cloud.position.z + U.cur[o + 2]);
    const ring = bc.getObjectByName('ring'), k2 = 1 + 0.35 * Math.sin(tm * 5);
    ring.scale.set(k2, k2, k2); ring.material.opacity = 0.55 + 0.45 * Math.sin(tm * 5) * Math.sin(tm * 5);
  } else bc.visible = false;
  const lab = t(state.encoderTrained ? 's3.lbl.trained' : 's3.lbl.untrained');
  if (s3.encoderLabel.userData.last !== lab) { s3.encoderLabel.userData.last = lab; setSpriteText(s3.encoderLabel, lab); }
}

export { buildStage3, applyUmapColors, stepStage3 };
