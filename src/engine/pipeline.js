/* Cálculos del pipeline que no dependen de la escena 3D: evaluación de teselas, bolsa MIL, nube de parches
 * (UMAP simulado), mapa de calor y evaluación del reto. Se calculan aunque el módulo correspondiente aún no
 * se haya cargado (carga diferida), de modo que el parche fijado se pueda seguir entre etapas.
 * Lógica migrada de la v3.0 (p4_stage345.js §10-12 y p3_scene.js §9). Cambios: los datos viven en
 * `pipeline` (src/engine/state.js) en lugar de `world.s2…s5`; las clases del reto pasan a códigos. */
import { MODALITIES, HOSPITALS, NORM_MODES, UNTRAINED_METRICS, CONTAM_COLOR } from './modalities.js';
import { state, dirty, pipeline, hasUnfilteredArtifacts, activeArtifactKeys } from './state.js';
import { UMAP_N, UMAP_CONTAM_PER, UMAP_MAX, ARTIFACT_KEYS, MIL_COLS, MIL_ROWS, MIL_BAG_SIZE, SAMPLE_W, SAMPLE_H } from './constants.js';
import { clamp, lerp, smoothstep, hashStr, SeededRandom, hash2 } from './util.js';
import { evaluateBiologicalSignals, evaluateArtifactAt, evalTile } from './bio.js';

const UMAP_Y_SCALE = 0.72;

/* ----- Etapa 2: rejilla de teselas ----- */
/** Tamaño de la rejilla según el tamaño de parche elegido (24×12 para 224 px, 14×7 para 512 px) */
function gridFor(patchSize) { return patchSize === 224 ? [24, 12] : [14, 7]; }
function syncTileGrid() { const [cols, rows] = gridFor(state.patchSize); pipeline.tiles.cols = cols; pipeline.tiles.rows = rows; }
function computeTileInfos() {
  const T = pipeline.tiles, cols = T.cols, rows = T.rows;
  T.infos = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) T.infos.push(evalTile(col, row, cols, rows));
}

/* ----- Etapa 3: nube de parches ----- */
/** Genera las muestras de parches (una nube por modalidad) y los vectores de ruido deterministas */
function rebuildUmapData() {
  const mod = state.modality, M = MODALITIES[mod], rng = new SeededRandom(hashStr('umap-' + mod));
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
  const prev = pipeline.umap;
  pipeline.umap = {
    samples, contam, R: jit(), Jm: jit(), Jh: jit(), Jc: jit(),
    tgtU: new Float32Array(nR), tgtT: new Float32Array(nR), cur: prev ? prev.cur : new Float32Array(nR), scl: prev ? prev.scl : new Float32Array(UMAP_MAX),
    encT: prev ? prev.encT : 0, hospThumbKey: ''
  };
  if (!prev) for (let i = 0; i < nR; i++) pipeline.umap.cur[i] = (pipeline.umap.R[i]) * 0.5;
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
  const U = pipeline.umap, M = MODALITIES[state.modality], nm = NORM_MODES[state.normMode];
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
  const U = pipeline.umap;
  if (i >= UMAP_N) return CONTAM_COLOR.color;
  const s = U.samples[i];
  return state.umapColor === 'morph' ? MODALITIES[state.modality].clusters[s.cluster].color : HOSPITALS[s.hosp].color;
}
/** Efecto lote y pureza morfológica que se muestran en el panel (interpoladas con el estado del encoder) */
function umapMetrics() {
  const U = pipeline.umap, nm = NORM_MODES[state.normMode], t = U ? U.encT : 0;
  const nc = contamCount(), cf = nc / (UMAP_N + nc);
  const batch = lerp(UNTRAINED_METRICS.batch, nm.batch, t);
  const purity = clamp(lerp(UNTRAINED_METRICS.purity, nm.purity, t) * (1 - 1.6 * cf));
  return { batch, purity, nContam: nc, contamFrac: cf };
}

/* ----- Etapa 4: bolsa MIL ----- */
const ARTIFACT_SPOT = { blur: [0.20, 0.30], folds: [0.60, 0.76], ink: [0.915, 0.41], bubbles: [0.10, 0.80] };
const GATE = { V1: [4.0, -0.5, 0.0], U1: [5.0, -4.0, 0.0], w1: 11, V2: [0, 0, 1.5], U2: [0, 0, 2], w2: 0.5 };
const sigmoid = x => 1 / (1 + Math.exp(-x));
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Ordena las instancias por señal de atipia (Top-3 primero) para elegir las K positivas */
function recomputeBagRank() {
  const mod = state.modality, M = MODALITIES[mod], N = MIL_BAG_SIZE;
  const score = new Float32Array(N);
  for (let j = 0; j < MIL_ROWS; j++) for (let i = 0; i < MIL_COLS; i++) {
    const s = evaluateBiologicalSignals((i + 0.5) / MIL_COLS, (j + 0.5) / MIL_ROWS, mod);
    score[j * MIL_COLS + i] = s.atypiaScore * s.tissueCoverage + hash2(i, j, 5) * 1e-4;
  }
  const top = M.top3.map(t => t.bagIndex), rest = [...Array(N).keys()].filter(i => !top.includes(i)).sort((a, b) => score[b] - score[a]);
  pipeline.rank = [...top, ...rest];
  pipeline.atyp = score;
}
function computeBag() {
  pipeline.bag = [];
  for (let j = 0; j < MIL_ROWS; j++) for (let i = 0; i < MIL_COLS; i++) pipeline.bag.push(evalTile(i, j, MIL_COLS, MIL_ROWS));
}
function cellIndexUV(u, v) { return Math.min(MIL_ROWS - 1, Math.floor(v * MIL_ROWS)) * MIL_COLS + Math.min(MIL_COLS - 1, Math.floor(u * MIL_COLS)); }

/** Calcula puntuaciones por instancia y los tres agregadores simultáneamente */
function computeMIL() {
  const N = MIL_BAG_SIZE, rng = new SeededRandom(hashStr('mil-' + state.modality));
  const K = state.groundTruth === 'pos' ? Math.max(1, Math.round(N * state.dilution)) : 0;
  const isPos = new Uint8Array(N); for (let r = 0; r < K; r++) isPos[pipeline.rank[r]] = 1;
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
    const info = pipeline.bag[k];
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
  const lab = v => { const pp = v >= 0.5; return gtPos ? (pp ? 'TP' : 'FN') : (pp ? 'FP' : 'TN'); };
  const mx = w => { let m = 0; for (let k = 0; k < N; k++) if (w[k] > m) m = w[k]; return m; };
  pipeline.mil = {
    N, K, neff, isPos, isDist, dist: distList, s, excl, logit, w: { mean: wMean, max: wMax, att: wAtt }, y, sumAtt,
    label: { mean: lab(y.mean), max: lab(y.max), att: lab(y.att) }, maxW: { mean: mx(wMean), max: mx(wMax), att: mx(wAtt) },
    nExcl: N - neff
  };
}
const AGG_KEY = { mean: 'mean', max: 'max', attention: 'att' };
const AGG_LABEL = { mean: 'Mean Pooling', max: 'Max Pooling', attention: 'Gated Attention MIL (CLAM)' };
function activeWeights() { const S = pipeline.mil; return S ? S.w[AGG_KEY[state.aggregator]] : null; }

/* ----- Etapa 5: mapa de calor y reto ----- */
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

function computeBioMap() {
  const mod = state.modality; pipeline.bio = new Float32Array(HEAT_W * HEAT_H);
  for (let y = 0; y < HEAT_H; y++) for (let x = 0; x < HEAT_W; x++) { const s = evaluateBiologicalSignals((x + 0.5) / HEAT_W, (y + 0.5) / HEAT_H, mod); pipeline.bio[y * HEAT_W + x] = s.atypiaScore * smoothstep(0.1, 0.5, s.tissueCoverage); }
}
/** Campo de calor = señal biológica + atención del agregador Gated Attention */
function computeHeatField() {
  const S = pipeline.mil; if (!S) return;
  if (!pipeline.field) pipeline.field = new Float32Array(HEAT_W * HEAT_H);
  if (!pipeline.bio) computeBioMap();
  const W = S.w.att, src = [];
  for (let k = 0; k < MIL_BAG_SIZE; k++) if (W[k] > 0.0008) src.push({ u: ((k % MIL_COLS) + 0.5) / MIL_COLS, v: (Math.floor(k / MIL_COLS) + 0.5) / MIL_ROWS, a: W[k] });
  src.sort((a, b) => b.a - a.a); if (src.length > 60) src.length = 60;
  const sig2 = 2 * 0.055 * 0.055, bioF = state.groundTruth === 'pos' ? 1 : 0.1;
  for (let y = 0; y < HEAT_H; y++) for (let x = 0; x < HEAT_W; x++) {
    const u = (x + 0.5) / HEAT_W, v = (y + 0.5) / HEAT_H; let att = 0;
    for (let i = 0; i < src.length; i++) { const dx = (u - src[i].u) * 2, dy = v - src[i].v; att += src[i].a * Math.exp(-(dx * dx + dy * dy) / sig2); }
    att = Math.min(1, att * 9);
    pipeline.field[y * HEAT_W + x] = clamp(0.58 * att + 0.42 * pipeline.bio[y * HEAT_W + x] * bioF);
  }
  dirty.heatColor = true;
}
function heatAt(u, v) {
  if (!pipeline.field) return 0;
  const x = Math.min(HEAT_W - 1, Math.max(0, Math.floor(u * HEAT_W))), y = Math.min(HEAT_H - 1, Math.max(0, Math.floor(v * HEAT_H)));
  return pipeline.field[y * HEAT_W + x];
}
function heatVisible() { return !(state.challenge.active && !state.challenge.revealed); }

function evaluateChallengePins() {
  const M = MODALITIES[state.modality], ch = state.challenge;
  const items = ch.pins.map(p => {
    const nd = f => Math.hypot((p.u - f.u) / f.rx, (p.v - f.v) / f.ry);
    const wd = f => Math.hypot((p.u - f.u) * SAMPLE_W, (p.v - f.v) * SAMPLE_H);
    const d1 = nd(M.primaryFocus), d2 = nd(M.secondaryFocus), w1 = wd(M.primaryFocus), w2 = wd(M.secondaryFocus);
    const dn = Math.min(d1, d2), dw = Math.min(w1, w2);
    const cls = (dn <= 1.0 || dw <= 0.45) ? 'hit' : ((dn <= 2.2 || dw <= 1.1) ? 'periphery' : 'miss');
    return { cls, which: d1 <= d2 ? 'primary' : 'secondary', dn, dw };
  });
  const sc = items.reduce((a, it) => a + (it.cls === 'hit' ? 1 : it.cls === 'periphery' ? 0.5 : 0), 0);
  return { items, agreement: items.length ? Math.round(sc / items.length * 100) : 0 };
}

export { UMAP_Y_SCALE, HEAT_W, HEAT_H, HEAT_RAMPS, ARTIFACT_SPOT, GATE, AGG_KEY, gridFor, syncTileGrid, computeTileInfos, rebuildUmapData, contamActive, contamCount,
  updateUmapTargets, pointColorHex, umapMetrics, recomputeBagRank, computeBag, cellIndexUV, computeMIL, activeWeights, rampColor, rampCss, computeBioMap,
  computeHeatField, heatAt, heatVisible, evaluateChallengePins, sigmoid, dot3 };
