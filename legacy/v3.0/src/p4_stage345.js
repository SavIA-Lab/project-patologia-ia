
/* =====================================================================
   10. ETAPA 3 — ENCODER (ViT), ESPACIO LATENTE UMAP 3D Y DOMAIN SHIFT
   ===================================================================== */
const PARTICLE_N = 90;
const UMAP_Y_SCALE = 0.72;

function buildStage3() {
  const g = stageGroups[3], s3 = world.s3;
  // Parches de entrada
  s3.inputs = new THREE.Group(); s3.inputs.position.set(-8.3, 0.9, 0); g.add(s3.inputs);
  [-0.75, 0, 0.75].forEach((z, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.62), new THREE.MeshStandardMaterial({ color: [0xE8B8CB, 0xD7A4C0, 0xC9B6DC][i], roughness: 0.6 }));
    b.position.set(0, i * 0.08, z); s3.inputs.add(b);
  });
  const inLab = makeTextSprite('Parches\n224×224 px', { size: 22, wpp: 0.0082 }); inLab.position.set(-8.3, 2.0, 0); g.add(inLab);
  // Bloque del Foundation Encoder
  s3.encoder = new THREE.Group(); s3.encoder.position.set(-5.4, 0.9, 0); g.add(s3.encoder);
  s3.slabs = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.3, 1.7), new THREE.MeshStandardMaterial({ color: 0x94A3B8, transparent: true, opacity: 0.93, roughness: 0.5, emissive: 0x4C3A7A, emissiveIntensity: 0 }));
    m.position.x = -1.55 + i * 0.62; s3.encoder.add(m); s3.slabs.push(m);
  }
  const eLab = makeTextSprite('Foundation Encoder (ViT)\nz ∈ ℝ⁷⁶⁸', { size: 24, wpp: 0.0088, color: '#4C3A7A' }); eLab.position.set(-5.4, 3.1, 0); g.add(eLab);
  s3.encoderLabel = makeTextSprite('Pesos aleatorios', { size: 22, mono: true, wpp: 0.0082, color: '#475569' }); s3.encoderLabel.position.set(-5.4, -0.55, 0); g.add(s3.encoderLabel);
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
  [['UMAP-1', [o[0] + L + 0.35, o[1], o[2]]], ['UMAP-2', [o[0], o[1] + L + 0.25, o[2]]], ['UMAP-3', [o[0], o[1], o[2] + L + 0.35]]].forEach(([t, p]) => {
    const s = makeTextSprite(t, { size: 20, mono: true, bg: null, wpp: 0.0095, color: '#64748B' }); s.position.set(...p); s3.cloud.add(s);
  });
  const cLab = makeTextSprite('Espacio latente UMAP 3D', { size: 24, wpp: 0.009, color: '#0F172A' }); cLab.position.set(3.2, 5.1, 0); g.add(cLab);
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
  rebuildUmapData();
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

/** Genera las muestras de parches (una nube por modalidad) y los vectores de ruido deterministas */
function rebuildUmapData() {
  const mod = state.modality, M = MODALITIES[mod], rng = new SeededRandom(hashStr('umap-' + mod)), s3 = world.s3;
  const quotas = [0.30, 0.28, 0.20, 0.22], samples = [];
  for (let c = 0; c < 4; c++) {
    const n = Math.round(UMAP_N * quotas[c]); let k = 0, tries = 0;
    while (k < n && tries < 30000) {
      tries++;
      let u, v;
      if (c === 3) { const f = rng.next() < 0.7 ? M.primaryFocus : M.secondaryFocus; u = f.u + rng.gauss() * f.rx * 0.8; v = f.v + rng.gauss() * f.ry * 0.8; }
      else { u = rng.next(); v = rng.next(); }
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      if (evaluateBiologicalSignals(u, v, mod).clusterIndex !== c) continue;
      samples.push({ u, v, cluster: c, hosp: rng.int(0, 2) }); k++;
    }
  }
  while (samples.length < UMAP_N) { const b = samples[samples.length % Math.max(1, samples.length)] || { u: 0.5, v: 0.5, cluster: 0, hosp: 0 }; samples.push({ u: clamp(b.u + rng.range(-0.02, 0.02)), v: clamp(b.v + rng.range(-0.02, 0.02)), cluster: b.cluster, hosp: rng.int(0, 2) }); }
  samples.length = UMAP_N;
  // Muestras contaminantes (una por artefacto y parche, en la región del artefacto)
  const contam = [];
  ARTIFACT_KEYS.forEach(key => {
    for (let j = 0; j < UMAP_CONTAM_PER; j++) {
      let u = 0.5, v = 0.5;
      for (let t = 0; t < 4000; t++) { u = rng.next(); v = rng.next(); if (evaluateArtifactAt(u, v, { [key]: true })[key] > 0.7) break; }
      contam.push({ u, v, key, hosp: rng.int(0, 2) });
    }
  });
  const nR = UMAP_MAX * 3, jit = () => Float32Array.from({ length: nR }, () => rng.gauss());
  const prev = s3.umap;
  s3.umap = {
    samples, contam, R: jit(), Jm: jit(), Jh: jit(), Jc: jit(),
    tgtU: new Float32Array(nR), tgtT: new Float32Array(nR), cur: prev ? prev.cur : new Float32Array(nR), scl: prev ? prev.scl : new Float32Array(UMAP_MAX),
    encT: prev ? prev.encT : 0, hospThumbKey: ''
  };
  if (!prev) for (let i = 0; i < nR; i++) s3.umap.cur[i] = (s3.umap.R[i]) * 0.5;
  dirty.umap = true;
}
function contamActive(i) {
  if (i < UMAP_N) return true;
  if (!hasUnfilteredArtifacts()) return false;
  const a = Math.floor((i - UMAP_N) / UMAP_CONTAM_PER);
  return !!state.artifacts[ARTIFACT_KEYS[a]];
}
function contamCount() { let n = 0; for (let i = UMAP_N; i < UMAP_MAX; i++) if (contamActive(i)) n++; return n; }

function updateUmapTargets() {
  const s3 = world.s3, U = s3.umap, M = MODALITIES[state.modality], nm = NORM_MODES[state.normMode];
  const b = nm.batch, sp = 0.30 + Math.pow(1 - nm.purity, 1.2) * 1.7, bun = UNTRAINED_METRICS.batch;
  const dirs = [[1, 0.2, 0], [-1, 0.1, 0.3], [0.2, 1, -0.3], [0, -0.6, 1]];
  for (let i = 0; i < UMAP_MAX; i++) {
    const o = i * 3;
    if (i < UMAP_N) {
      const smp = U.samples[i], c = M.clusters[smp.cluster].center, hc = HOSPITALS[smp.hosp].center;
      for (let k = 0; k < 3; k++) {
        const mp = c[k] + U.Jm[o + k] * sp, hp = hc[k] + U.Jh[o + k] * 0.55;
        U.tgtT[o + k] = lerp(mp, hp, b);
        U.tgtU[o + k] = U.R[o + k] * 1.5 + hc[k] * 0.4 * bun;
      }
    } else {
      const a = Math.floor((i - UMAP_N) / UMAP_CONTAM_PER), d = dirs[a];
      for (let k = 0; k < 3; k++) {
        U.tgtT[o + k] = 0.2 + d[k] * 0.9 + U.Jc[o + k] * 1.05;
        U.tgtU[o + k] = U.R[o + k] * 1.5;
      }
    }
    U.tgtT[o + 1] *= UMAP_Y_SCALE; U.tgtU[o + 1] *= UMAP_Y_SCALE;
  }
}
function pointColorHex(i) {
  const U = world.s3.umap;
  if (i >= UMAP_N) return CONTAM_COLOR.color;
  const s = U.samples[i];
  return state.umapColor === 'morph' ? MODALITIES[state.modality].clusters[s.cluster].color : HOSPITALS[s.hosp].color;
}
function applyUmapColors() {
  const s3 = world.s3, U = s3.umap, col = new THREE.Color(), pc = s3.particles.geometry.attributes.color;
  for (let i = 0; i < UMAP_MAX; i++) { col.setHex(pointColorHex(i)); s3.mesh.setColorAt(i, col); }
  s3.mesh.instanceColor.needsUpdate = true;
  s3.pData.forEach((p, j) => { col.setHex(pointColorHex(p.idx)); pc.setXYZ(j, col.r, col.g, col.b); });
  pc.needsUpdate = true;
}
/** Efecto lote y pureza morfológica que se muestran en el panel (interpoladas con el estado del encoder) */
function umapMetrics() {
  const U = world.s3.umap, nm = NORM_MODES[state.normMode], t = U ? U.encT : 0;
  const nc = contamCount(), cf = nc / (UMAP_N + nc);
  const batch = lerp(UNTRAINED_METRICS.batch, nm.batch, t);
  const purity = clamp(lerp(UNTRAINED_METRICS.purity, nm.purity, t) * (1 - 1.6 * cf));
  return { batch, purity, nContam: nc, contamFrac: cf };
}

function stepStage3(dt, t) {
  const s3 = world.s3, U = s3.umap; if (!U) return;
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
    m.material.emissiveIntensity = U.encT * (0.12 + 0.28 * (0.5 + 0.5 * Math.sin(t * 3 - i * 0.8)));
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
    const ring = bc.getObjectByName('ring'), k2 = 1 + 0.35 * Math.sin(t * 5);
    ring.scale.set(k2, k2, k2); ring.material.opacity = 0.55 + 0.45 * Math.sin(t * 5) * Math.sin(t * 5);
  } else bc.visible = false;
  const lab = state.encoderTrained ? 'Preentrenado (morfología separada)' : 'Pesos aleatorios (sin entrenar)';
  if (s3.encoderLabel.userData.last !== lab) { s3.encoderLabel.userData.last = lab; setSpriteText(s3.encoderLabel, lab); }
}

/* =====================================================================
   11. ETAPA 4 — MULTIPLE-INSTANCE LEARNING (MIL)
   ===================================================================== */
const ARTIFACT_SPOT = { blur: [0.20, 0.30], folds: [0.60, 0.76], ink: [0.915, 0.41], bubbles: [0.10, 0.80] };
const GATE = { V1: [4.0, -0.5, 0.0], U1: [5.0, -4.0, 0.0], w1: 11, V2: [0, 0, 1.5], U2: [0, 0, 2], w2: 0.5 };
const BAG_SP = 0.4, AGG_POS = new THREE.Vector3(3.9, 1.0, 0), BAR_X = 7.0, BAR_H = 4.0;
const sigmoid = x => 1 / (1 + Math.exp(-x));
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const bagPos = (i, j) => new THREE.Vector3(-3.2 + (i - (MIL_COLS - 1) / 2) * BAG_SP, 0.4, (j - (MIL_ROWS - 1) / 2) * BAG_SP);

function buildStage4() {
  const g = stageGroups[4], s4 = world.s4;
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
  s4.aggLabel = makeTextSprite('Attention Pooling', { size: 24, wpp: 0.009, color: '#4C3A7A' }); s4.aggLabel.position.set(AGG_POS.x, 2.2, 0); g.add(s4.aggLabel);
  s4.bagLabel = makeTextSprite(`Bolsa MIL · N = ${MIL_BAG_SIZE} instancias (20×10)`, { size: 24, wpp: 0.009 }); s4.bagLabel.position.set(-3.2, 3.0, 0); g.add(s4.bagLabel);
  // Barra de probabilidad diagnóstica
  const track = new THREE.Mesh(new THREE.BoxGeometry(0.9, BAR_H, 0.9), new THREE.MeshStandardMaterial({ color: 0xE2E8F0, transparent: true, opacity: 0.35, depthWrite: false }));
  track.position.set(BAR_X, BAR_H / 2, 0); g.add(track);
  const te = new THREE.LineSegments(new THREE.EdgesGeometry(track.geometry), new THREE.LineBasicMaterial({ color: 0x94A3B8 })); te.position.copy(track.position); g.add(te);
  s4.bar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1, 0.76), new THREE.MeshStandardMaterial({ color: 0x0F766E, roughness: 0.4 }));
  s4.bar.position.set(BAR_X, 0.01, 0); g.add(s4.bar);
  const thr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 1.5), new THREE.MeshBasicMaterial({ color: 0xD97706, transparent: true, opacity: 0.85 })); thr.position.set(BAR_X, BAR_H * 0.5, 0); g.add(thr);
  const thrL = makeTextSprite('umbral 0.50', { size: 20, mono: true, wpp: 0.0082, color: '#B45309', bg: 'rgba(255,255,255,0.85)' }); thrL.position.set(BAR_X - 1.55, BAR_H * 0.5 + 0.28, 0); g.add(thrL);
  s4.barLabel = makeTextSprite('Ŷ = 0.000', { size: 26, mono: true, wpp: 0.0095 }); s4.barLabel.position.set(BAR_X, BAR_H + 0.55, 0); g.add(s4.barLabel);
  const barTitle = makeTextSprite('P(lámina positiva)', { size: 20, wpp: 0.0085, bg: null, color: '#475569' }); barTitle.position.set(BAR_X, -0.45, 0); g.add(barTitle);
  const lk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, BAR_X - 0.45 - AGG_POS.x - 0.62, 8), new THREE.MeshBasicMaterial({ color: 0x4C3A7A, transparent: true, opacity: 0.6 }));
  lk.rotation.z = Math.PI / 2; lk.position.set((BAR_X - 0.45 + AGG_POS.x + 0.62) / 2, 1.0, 0); g.add(lk);
  // Marcas de instancias distractoras
  s4.distSprites = [0, 1].map(() => { const s = makeTextSprite('distractor', { size: 20, mono: true, wpp: 0.0095, color: '#FFFFFF', bg: 'rgba(217,119,6,0.95)' }); s.visible = false; g.add(s); return s; });
  // Resaltado de trazabilidad
  s4.hiRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 40), new THREE.MeshBasicMaterial({ color: 0xBE123C, transparent: true, side: THREE.DoubleSide, depthTest: false }));
  s4.hiRing.rotation.x = -Math.PI / 2; s4.hiRing.renderOrder = 14; s4.hiRing.visible = false; g.add(s4.hiRing);
  s4.hiLink = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({ color: 0xBE123C, transparent: true, opacity: 0.85, depthTest: false }));
  s4.hiLink.renderOrder = 14; s4.hiLink.visible = false; g.add(s4.hiLink);
  s4.hiLabel = makeTextSprite('parche fijado', { size: 20, mono: true, wpp: 0.0095, color: '#FFFFFF', bg: 'rgba(190,18,60,0.95)' }); s4.hiLabel.visible = false; g.add(s4.hiLabel);
  s4.rank = []; s4.bag = []; s4.state = null; s4.nodePos = [];
  for (let j = 0; j < MIL_ROWS; j++) for (let i = 0; i < MIL_COLS; i++) s4.nodePos.push(bagPos(i, j));
  recomputeBagRank();
}

/** Ordena las instancias por señal de atipia (Top-3 primero) para elegir las K positivas */
function recomputeBagRank() {
  const mod = state.modality, M = MODALITIES[mod], s4 = world.s4, N = MIL_BAG_SIZE;
  const score = new Float32Array(N);
  for (let j = 0; j < MIL_ROWS; j++) for (let i = 0; i < MIL_COLS; i++) {
    const s = evaluateBiologicalSignals((i + 0.5) / MIL_COLS, (j + 0.5) / MIL_ROWS, mod);
    score[j * MIL_COLS + i] = s.atypiaScore * s.tissueCoverage + hash2(i, j, 5) * 1e-4;
  }
  const top = M.top3.map(t => t.bagIndex), rest = [...Array(N).keys()].filter(i => !top.includes(i)).sort((a, b) => score[b] - score[a]);
  s4.rank = [...top, ...rest];
  s4.atyp = score;
}
function computeBag() {
  const s4 = world.s4; s4.bag = [];
  for (let j = 0; j < MIL_ROWS; j++) for (let i = 0; i < MIL_COLS; i++) s4.bag.push(evalTile(i, j, MIL_COLS, MIL_ROWS));
}
function cellIndexUV(u, v) { return Math.min(MIL_ROWS - 1, Math.floor(v * MIL_ROWS)) * MIL_COLS + Math.min(MIL_COLS - 1, Math.floor(u * MIL_COLS)); }

/** Calcula puntuaciones por instancia y los tres agregadores simultáneamente */
function computeMIL() {
  const s4 = world.s4, N = MIL_BAG_SIZE, rng = new SeededRandom(hashStr('mil-' + state.modality));
  const K = state.groundTruth === 'pos' ? Math.max(1, Math.round(N * state.dilution)) : 0;
  const isPos = new Uint8Array(N); for (let r = 0; r < K; r++) isPos[s4.rank[r]] = 1;
  // Distractores (artefacto con señal espuria alta)
  const spots = [];
  if (state.distractor) spots.push('folds', 'ink');
  if (hasUnfilteredArtifacts()) activeArtifactKeys().forEach(k => { if (!spots.includes(k)) spots.push(k); });
  const dist = new Set(), distList = [];
  for (const key of spots) {
    if (distList.length >= 2) break;
    let idx = cellIndexUV(...ARTIFACT_SPOT[key]), tries = 0;
    while ((isPos[idx] || dist.has(idx)) && tries < N) { idx = (idx + 1) % N; tries++; }
    dist.add(idx); distList.push(idx);
  }
  const s = new Float32Array(N), excl = new Uint8Array(N), logit = new Float32Array(N), isDist = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const r1 = rng.next(), r2 = rng.next(), r3 = rng.next(), r4 = rng.next();
    isDist[k] = dist.has(k) ? 1 : 0;
    s[k] = isDist[k] ? 0.92 : (isPos[k] ? 0.82 + 0.14 * r1 : 0.04 + 0.12 * r2);
    const info = s4.bag[k];
    excl[k] = (info && info.rejected && !(isDist[k] && state.distractor)) ? 1 : 0;
    const h = [isDist[k] ? 0.18 : s[k], isDist[k] ? 1 : 0.04 * r3, r4 * 2 - 1];
    logit[k] = GATE.w1 * Math.tanh(dot3(GATE.V1, h)) * sigmoid(dot3(GATE.U1, h)) + GATE.w2 * Math.tanh(dot3(GATE.V2, h)) * sigmoid(dot3(GATE.U2, h));
  }
  let neff = 0; for (let k = 0; k < N; k++) if (!excl[k]) neff++;
  const wMean = new Float32Array(N), wMax = new Float32Array(N), wAtt = new Float32Array(N);
  let amax = -1, imax = -1, lmax = -1e9;
  for (let k = 0; k < N; k++) { if (excl[k]) continue; wMean[k] = 1 / neff; if (s[k] > amax) { amax = s[k]; imax = k; } if (logit[k] > lmax) lmax = logit[k]; }
  if (imax >= 0) wMax[imax] = 1;
  let z = 0; for (let k = 0; k < N; k++) if (!excl[k]) { wAtt[k] = Math.exp(logit[k] - lmax); z += wAtt[k]; }
  let sumAtt = 0; for (let k = 0; k < N; k++) { wAtt[k] /= z || 1; sumAtt += wAtt[k]; }
  const yOf = w => { let y = 0; for (let k = 0; k < N; k++) y += w[k] * s[k]; return y; };
  const y = { mean: yOf(wMean), max: yOf(wMax), att: yOf(wAtt) }, gtPos = state.groundTruth === 'pos';
  const lab = v => { const pp = v >= 0.5; return gtPos ? (pp ? 'VP' : 'FN') : (pp ? 'FP' : 'VN'); };
  const mx = w => { let m = 0; for (let k = 0; k < N; k++) if (w[k] > m) m = w[k]; return m; };
  s4.state = {
    N, K, neff, isPos, isDist, dist: distList, s, excl, logit, w: { mean: wMean, max: wMax, att: wAtt }, y, sumAtt,
    label: { mean: lab(y.mean), max: lab(y.max), att: lab(y.att) }, maxW: { mean: mx(wMean), max: mx(wMax), att: mx(wAtt) },
    nExcl: N - neff
  };
}
const AGG_KEY = { mean: 'mean', max: 'max', attention: 'att' };
const AGG_LABEL = { mean: 'Mean Pooling', max: 'Max Pooling', attention: 'Gated Attention MIL (CLAM)' };
function activeWeights() { const S = world.s4.state; return S ? S.w[AGG_KEY[state.aggregator]] : null; }

function applyMILVisuals() {
  const s4 = world.s4, S = s4.state; if (!S) return;
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
  setSpriteText(s4.barLabel, `Ŷ = ${yv.toFixed(3)}`);
  setSpriteText(s4.aggLabel, state.aggregator === 'mean' ? 'Mean Pooling\na_k = 1/N' : state.aggregator === 'max' ? 'Max Pooling\na_k = 1 en argmax' : 'Gated Attention\nSoftmax(a_k)');
  s4.aggLabel.position.y = 2.3;
  s4.distSprites.forEach((sp, i) => {
    const idx = S.dist[i]; sp.visible = idx !== undefined;
    if (sp.visible) { const b = s4.nodePos[idx]; sp.position.set(b.x, 2.2, b.z); }
  });
  updateMilHighlight();
}
function pinnedBagIndex() { const p = state.pinned; return p ? cellIndexUV(p.u, p.v) : -1; }
function updateMilHighlight() {
  const s4 = world.s4, S = s4.state, idx = pinnedBagIndex();
  if (!S || idx < 0) { s4.hiRing.visible = s4.hiLink.visible = s4.hiLabel.visible = false; return; }
  const W = activeWeights(), qv = Math.sqrt(Math.min(1, W[idx] * 8)), base = s4.nodePos[idx];
  const pos = new THREE.Vector3(base.x, S.excl[idx] ? 0.2 : 0.4 + qv, base.z);
  s4.hiRing.position.copy(pos); s4.hiRing.visible = true;
  s4.hiLabel.position.set(pos.x, pos.y + 0.75, pos.z); s4.hiLabel.visible = true;
  setSpriteText(s4.hiLabel, S.excl[idx] ? 'parche fijado · excluido por QC' : `parche fijado · a=${(W[idx] * 100).toFixed(1)}%`);
  if (S.excl[idx]) { s4.hiLink.visible = false; return; }
  const dir = AGG_POS.clone().sub(pos), L = dir.length(); dir.normalize();
  s4.hiLink.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  s4.hiLink.position.copy(pos).addScaledVector(dir, L / 2); s4.hiLink.scale.set(0.022 + 0.06 * qv, L, 0.022 + 0.06 * qv); s4.hiLink.visible = true;
}
function animateStage4(dt, t) {
  const s4 = world.s4; if (!s4.hiRing) return;
  if (s4.hiRing.visible) { const k = 1 + 0.25 * Math.sin(t * 5); s4.hiRing.scale.set(k, k, k); s4.hiRing.material.opacity = 0.6 + 0.4 * Math.sin(t * 5) ** 2; }
  s4.aggRing.rotation.z += dt * 0.6;
  const S = s4.state; if (S) s4.agg.material.emissiveIntensity = 0.12 + 0.1 * Math.sin(t * 2);
}

/* =====================================================================
   12. ETAPA 5 — XAI, RETO HUMANO vs. IA Y CURVA ROC
   ===================================================================== */
const HEAT_W = 192, HEAT_H = 96;
const HEAT_RAMPS = {
  amber: [[0, [254, 243, 199]], [0.35, [245, 180, 60]], [0.7, [217, 119, 6]], [1, [190, 18, 60]]],
  viridis: [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]]
};
function rampColor(name, t) {
  const R = HEAT_RAMPS[name]; t = clamp(t);
  for (let i = 1; i < R.length; i++) if (t <= R[i][0]) { const a = R[i - 1], b = R[i], k = (t - a[0]) / (b[0] - a[0]); return [lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k), lerp(a[1][2], b[1][2], k)]; }
  return R[R.length - 1][1];
}
function rampCss(name) { return 'linear-gradient(90deg,' + HEAT_RAMPS[name].map(([p, c]) => `rgb(${c.join(',')}) ${p * 100}%`).join(',') + ')'; }

function buildStage5() {
  const g = stageGroups[5], s5 = world.s5;
  s5.slide = makeSlideAssembly(); g.add(s5.slide.group);
  s5.heatCv = makeCanvas(HEAT_W, HEAT_H);
  s5.heatTex = new THREE.CanvasTexture(s5.heatCv); s5.heatTex.colorSpace = THREE.SRGBColorSpace;
  s5.heat = new THREE.Mesh(new THREE.PlaneGeometry(SAMPLE_W, SAMPLE_H), new THREE.MeshBasicMaterial({ map: s5.heatTex, transparent: true, depthWrite: false, opacity: state.heatOpacity }));
  s5.heat.rotation.x = -Math.PI / 2; s5.heat.position.set(SAMPLE_CENTER_X, 0.085, 0); s5.heat.renderOrder = 5; g.add(s5.heat);
  s5.field = new Float32Array(HEAT_W * HEAT_H); s5.bio = null;
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
  s5.beaconLabel = makeTextSprite('parche fijado', { size: 20, mono: true, wpp: 0.0095, color: '#FFFFFF', bg: 'rgba(190,18,60,0.95)' }); s5.beaconLabel.visible = false; g.add(s5.beaconLabel);
  s5.focusU = null;
  rebuildTop3Markers();
}
function rebuildTop3Markers() {
  const s5 = world.s5, M = MODALITIES[state.modality];
  clearChildren(s5.top3); s5.markers = [];
  M.top3.forEach((t, i) => {
    const grp = new THREE.Group(), p = uvToWorld(t.u, t.v, 0.12);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.22, 36), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, side: THREE.DoubleSide, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 12;
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hit.rotation.x = -Math.PI / 2; hit.userData = { top3: i };
    const lab = makeTextSprite(String(t.rank), { size: 26, mono: true, wpp: 0.0075, color: '#FFFFFF', bg: 'rgba(190,18,60,0.95)', pad: 6 }); lab.position.set((i === 1 ? 0.3 : i === 0 ? -0.1 : 0), 0.42 + (i === 1 ? 0.06 : 0), 0);
    grp.add(ring, hit, lab); grp.position.copy(p); s5.top3.add(grp); s5.markers.push({ grp, hit });
  });
}
function computeBioMap() {
  const s5 = world.s5, mod = state.modality; s5.bio = new Float32Array(HEAT_W * HEAT_H);
  for (let y = 0; y < HEAT_H; y++) for (let x = 0; x < HEAT_W; x++) { const s = evaluateBiologicalSignals((x + 0.5) / HEAT_W, (y + 0.5) / HEAT_H, mod); s5.bio[y * HEAT_W + x] = s.atypiaScore * smoothstep(0.1, 0.5, s.tissueCoverage); }
}
/** Campo de calor = señal biológica + atención del agregador Gated Attention */
function computeHeatField() {
  const s5 = world.s5, S = world.s4.state; if (!S) return;
  if (!s5.bio) computeBioMap();
  const W = S.w.att, src = [];
  for (let k = 0; k < MIL_BAG_SIZE; k++) if (W[k] > 0.0008) src.push({ u: ((k % MIL_COLS) + 0.5) / MIL_COLS, v: (Math.floor(k / MIL_COLS) + 0.5) / MIL_ROWS, a: W[k] });
  src.sort((a, b) => b.a - a.a); if (src.length > 60) src.length = 60;
  const sig2 = 2 * 0.055 * 0.055, bioF = state.groundTruth === 'pos' ? 1 : 0.1;
  for (let y = 0; y < HEAT_H; y++) for (let x = 0; x < HEAT_W; x++) {
    const u = (x + 0.5) / HEAT_W, v = (y + 0.5) / HEAT_H; let att = 0;
    for (let i = 0; i < src.length; i++) { const dx = (u - src[i].u) * 2, dy = v - src[i].v; att += src[i].a * Math.exp(-(dx * dx + dy * dy) / sig2); }
    att = Math.min(1, att * 9);
    s5.field[y * HEAT_W + x] = clamp(0.58 * att + 0.42 * s5.bio[y * HEAT_W + x] * bioF);
  }
  dirty.heatColor = true;
}
function colorizeHeat() {
  const s5 = world.s5, ctx = s5.heatCv.getContext('2d'), img = ctx.createImageData(HEAT_W, HEAT_H), thr = state.heatThreshold;
  for (let i = 0; i < s5.field.length; i++) {
    const t = s5.field[i], a = smoothstep(thr, thr + 0.12, t), c = rampColor(state.heatScale, t), o = i * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0); s5.heatTex.needsUpdate = true; dirty.heatColor = false;
}
function heatAt(u, v) {
  const s5 = world.s5; if (!s5.field) return 0;
  const x = Math.min(HEAT_W - 1, Math.max(0, Math.floor(u * HEAT_W))), y = Math.min(HEAT_H - 1, Math.max(0, Math.floor(v * HEAT_H)));
  return s5.field[y * HEAT_W + x];
}
function heatVisible() { return !(state.challenge.active && !state.challenge.revealed); }
function applyHeatVisibility() {
  const s5 = world.s5; if (!s5.heat) return;
  const vis = heatVisible();
  s5.heat.visible = vis; s5.heat.material.opacity = state.heatOpacity; s5.top3.visible = vis;
}

/* ----- Reto Humano vs. IA ----- */
function pinColor(cls) { return cls === 'Acierto' ? 0x0F766E : (cls === 'Periferia' ? 0xD97706 : 0xBE123C); }
function rebuildPins() {
  const s5 = world.s5, ch = state.challenge;
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
function startChallenge() {
  state.challenge = { active: true, pins: [], revealed: false, result: null };
  rebuildPins(); applyHeatVisibility(); toast('Reto iniciado: marca hasta 3 sospechas haciendo clic sobre la lámina.');
}
function addChallengePin(u, v) {
  const ch = state.challenge; if (!ch.active || ch.revealed || ch.pins.length >= 3) return false;
  ch.pins.push({ u, v }); rebuildPins(); return true;
}
function evaluateChallengePins() {
  const M = MODALITIES[state.modality], ch = state.challenge;
  const items = ch.pins.map(p => {
    const nd = f => Math.hypot((p.u - f.u) / f.rx, (p.v - f.v) / f.ry);
    const wd = f => Math.hypot((p.u - f.u) * SAMPLE_W, (p.v - f.v) * SAMPLE_H);
    const d1 = nd(M.primaryFocus), d2 = nd(M.secondaryFocus), w1 = wd(M.primaryFocus), w2 = wd(M.secondaryFocus);
    const dn = Math.min(d1, d2), dw = Math.min(w1, w2);
    const cls = (dn <= 1.0 || dw <= 0.45) ? 'Acierto' : ((dn <= 2.2 || dw <= 1.1) ? 'Periferia' : 'Desvío');
    return { cls, which: d1 <= d2 ? 'foco primario' : 'foco secundario', dn, dw };
  });
  const sc = items.reduce((a, it) => a + (it.cls === 'Acierto' ? 1 : it.cls === 'Periferia' ? 0.5 : 0), 0);
  return { items, agreement: items.length ? Math.round(sc / items.length * 100) : 0 };
}
function revealChallenge() {
  const ch = state.challenge; if (!ch.active || ch.revealed || ch.pins.length === 0) return false;
  ch.result = evaluateChallengePins(); ch.revealed = true; rebuildPins(); applyHeatVisibility(); return true;
}
function resetChallenge() {
  state.challenge = { active: false, pins: [], revealed: false, result: null };
  rebuildPins(); applyHeatVisibility();
}

function animateStage5(dt, t) {
  const s5 = world.s5; if (!s5.reticle) return;
  // retícula en el Top-3 seleccionado
  const sel = state.selectedTop3, M = MODALITIES[state.modality];
  if (sel >= 0 && heatVisible()) {
    const tp = M.top3[sel], p = uvToWorld(tp.u, tp.v, 0.14);
    s5.reticle.visible = true; s5.reticle.position.copy(p);
    const k = 1 + 0.12 * Math.sin(t * 4); s5.reticle.scale.set(k, k, k); s5.reticle.rotation.y = t * 0.8;
  } else s5.reticle.visible = false;
  s5.markers.forEach((m, i) => { const act = i === sel; m.grp.children[0].material.color.setHex(act ? 0xBE123C : 0xFFFFFF); const sc = act ? 1.35 : 1 + 0.08 * Math.sin(t * 3 + i); m.grp.children[0].scale.set(sc, sc, sc); });
  // baliza del parche fijado
  const pn = state.pinned;
  if (pn && heatVisible()) {
    const p = uvToWorld(pn.u, pn.v, 0.1); s5.beacon.visible = true; s5.beacon.position.copy(p);
    const ring = s5.beacon.getObjectByName('ring'), k = 1 + 0.35 * Math.sin(t * 5); ring.scale.set(k, k, k); ring.material.opacity = 0.55 + 0.45 * Math.sin(t * 5) ** 2;
    s5.beaconLabel.visible = true; s5.beaconLabel.position.set(p.x, 1.75, p.z);
    const lab = `parche fijado · calor ${heatAt(pn.u, pn.v).toFixed(2)}`;
    if (s5.beaconLabel.userData.last !== lab) { s5.beaconLabel.userData.last = lab; setSpriteText(s5.beaconLabel, lab); }
  } else { s5.beacon.visible = false; s5.beaconLabel.visible = false; }
}

/* ----- Curva ROC binormal ----- */
function erf(x) {
  const sg = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sg * y;
}
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
const ROC_MU = 2.199;           // separación binormal para AUC = Φ(μ/√2) ≈ 0.94
const COHORT = { n: 1000, prev: 0.10 };
const tauToX = tau => ROC_MU / 2 + 0.7 * Math.log(tau / (1 - tau));
function rocAt(tau) {
  const x = tauToX(tau), sens = Phi(ROC_MU - x), spec = Phi(x);
  const P = Math.round(COHORT.n * COHORT.prev), Nn = COHORT.n - P;
  const tp = Math.round(sens * P), fn = P - tp, tn = Math.round(spec * Nn), fp = Nn - tn;
  return { tau, x, sens, spec, fpr: 1 - spec, tp, fn, tn, fp, P, Nn, ppv: tp + fp ? tp / (tp + fp) : 0, npv: tn + fn ? tn / (tn + fn) : 0 };
}
function aucAnalytic() { return Phi(ROC_MU / Math.SQRT2); }
function drawROC(ctx, w, h) {
  const pad = { l: 38, r: 14, t: 12, b: 32 }, pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const X = f => pad.l + f * pw, Y = f => pad.t + (1 - f) * ph;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1; ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = '#64748B'; ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const f = i / 5; ctx.beginPath(); ctx.moveTo(X(f), Y(0)); ctx.lineTo(X(f), Y(1)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(0), Y(f)); ctx.lineTo(X(1), Y(f)); ctx.stroke();
    ctx.fillText(f.toFixed(1), X(f), Y(0) + 13);
  }
  ctx.textAlign = 'right'; for (let i = 0; i <= 5; i++) ctx.fillText((i / 5).toFixed(1), pad.l - 6, Y(i / 5) + 3);
  ctx.textAlign = 'center'; ctx.fillStyle = '#475569'; ctx.font = '600 10.5px Inter, sans-serif';
  ctx.fillText('1 − Especificidad (FPR)', pad.l + pw / 2, h - 5);
  ctx.save(); ctx.translate(10, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Sensibilidad (TPR)', 0, 0); ctx.restore();
  // área bajo la curva y curva
  const pts = []; for (let x = -4.5; x <= 7; x += 0.05) pts.push([1 - Phi(x), Phi(ROC_MU - x)]);
  pts.sort((a, b) => a[0] - b[0]);
  ctx.beginPath(); ctx.moveTo(X(0), Y(0)); pts.forEach(p => ctx.lineTo(X(p[0]), Y(p[1]))); ctx.lineTo(X(1), Y(0)); ctx.closePath(); ctx.fillStyle = 'rgba(76,58,122,0.10)'; ctx.fill();
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.strokeStyle = '#4C3A7A'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
  const r = rocAt(state.tau);
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(190,18,60,0.5)'; ctx.beginPath(); ctx.moveTo(X(r.fpr), Y(0)); ctx.lineTo(X(r.fpr), Y(r.sens)); ctx.lineTo(X(0), Y(r.sens)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#BE123C'; ctx.beginPath(); ctx.arc(X(r.fpr), Y(r.sens), 6, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#4C3A7A'; ctx.font = '600 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(`AUC ≈ ${aucAnalytic().toFixed(2)}`, X(0.52), Y(0.2));
  ctx.fillStyle = '#BE123C'; ctx.fillText(`τ = ${state.tau.toFixed(2)}`, X(0.52), Y(0.1));
}
