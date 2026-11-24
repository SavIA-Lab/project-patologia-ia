import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* =====================================================================
   1. CONSTANTES GLOBALES
   ===================================================================== */
const SAMPLE_W = 8;            // ancho del tejido sobre el portaobjetos (unidades 3D)
const SAMPLE_H = 4;            // alto del tejido (relación 2:1 con la textura)
const SAMPLE_CENTER_X = 0.9;   // el portaobjetos deja espacio a la izquierda para la etiqueta
const TEX_W = 1024, TEX_H = 512;
const MIL_COLS = 20, MIL_ROWS = 10, MIL_BAG_SIZE = 200;
const QC_LAPLACIAN_MIN = 60;   // varianza Laplaciana mínima aceptable en tejido
const UMAP_N = 360, UMAP_CONTAM_PER = 12, UMAP_MAX = UMAP_N + UMAP_CONTAM_PER * 4;
const ARTIFACT_KEYS = ['blur', 'folds', 'ink', 'bubbles'];
const PYR_LEVELS = [
  { mag: 5,  res: 2.0,  zoom: 1,     context: 100, detail: 14, y: 1.25 },
  { mag: 10, res: 1.0,  zoom: 2,     context: 78,  detail: 38, y: 2.5 },
  { mag: 20, res: 0.5,  zoom: 4,     context: 52,  detail: 66, y: 3.75 },
  { mag: 40, res: 0.25, zoom: 8,     context: 26,  detail: 96, y: 5.0 }
];
const C = { hema: '#4C3A7A', eosin: '#C95B82', teal: '#0F766E', amber: '#D97706', crimson: '#BE123C', ink: '#0F172A', ink2: '#475569', line: '#E2E8F0' };

/* =====================================================================
   2. UTILIDADES MATEMÁTICAS, RNG Y RUIDO
   ===================================================================== */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Generador pseudoaleatorio determinista (Mulberry32) */
class SeededRandom {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  gauss() {
    let u = 0; while (u === 0) u = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
}

function hash2(ix, iy, seed) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}
function fbm(x, y, seed, oct = 3) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mixHex(h1, h2, t) {
  const a = new THREE.Color(h1), b = new THREE.Color(h2);
  return '#' + a.lerp(b, t).getHexString();
}

/* =====================================================================
   3. DEFINICIÓN DE MODALIDADES
   ===================================================================== */
const HOSPITALS = [
  { key: 'A', name: 'Hospital A', scanner: 'Leica',      hex: '#2F6FBF', color: 0x2F6FBF, desc: 'tinción cálida / eosinofílica', center: [-3.3, 0.4, 2.7] },
  { key: 'B', name: 'Hospital B', scanner: 'Hamamatsu',  hex: '#1E293B', color: 0x1E293B, desc: 'tinción densa / oscura',        center: [3.1, 2.3, 0.3] },
  { key: 'C', name: 'Hospital C', scanner: 'Philips',    hex: '#94A3B8', color: 0x94A3B8, desc: 'tinción fría / desaturada',     center: [0.3, -2.6, -2.9] }
];
const HOSP_PROFILES = {
  A:   { gain: [1.04, 0.98, 0.96], gamma: 0.96, sat: 1.12, bright: 0.0 },
  B:   { gain: [0.86, 0.80, 0.90], gamma: 1.18, sat: 1.35, bright: -0.04 },
  C:   { gain: [0.92, 1.02, 1.10], gamma: 0.95, sat: 0.62, bright: 0.07 },
  REF: { gain: [1, 1, 1], gamma: 1, sat: 1, bright: 0 }
};
const NORM_MODES = {
  none:     { label: 'Sin normalizar',      batch: 0.82, purity: 0.34, amount: 0.0 },
  macenko:  { label: 'Normalización Macenko', batch: 0.26, purity: 0.78, amount: 0.8 },
  ssl:      { label: 'Foundation SSL',      batch: 0.08, purity: 0.94, amount: 0.96 }
};
const UNTRAINED_METRICS = { batch: 0.90, purity: 0.22 };
const CONTAM_COLOR = { hex: '#9A6B3A', color: 0x9A6B3A };

const MODALITIES = {
  he: {
    key: 'he', name: 'Biopsia H&E', labelCode: 'H&E', stain: 'Hematoxilina–Eosina', accent: '#4C3A7A',
    caseId: 'H-26-04171', diagnosisTitle: 'Adenocarcinoma invasivo', defaultDilution: 0.14,
    maskSeed: 11, bgThreshold: 0.30, scanMm: [15, 12],
    primaryFocus: { u: 0.62, v: 0.42, rx: 0.10, ry: 0.17 },
    secondaryFocus: { u: 0.30, v: 0.68, rx: 0.07, ry: 0.11 },
    clusters: [
      { key: 'stroma', label: 'Estroma conectivo',             color: 0x0F766E, hex: '#0F766E', center: [-2.9, 1.5, -1.7] },
      { key: 'gland',  label: 'Epitelio glandular benigno',    color: 0x4C3A7A, hex: '#4C3A7A', center: [2.8, -0.4, -2.1] },
      { key: 'infl',   label: 'Infiltrado inflamatorio',       color: 0xD97706, hex: '#D97706', center: [-1.4, -2.2, 2.6] },
      { key: 'tumor',  label: 'Atipia tumoral (adenocarcinoma)', color: 0xBE123C, hex: '#BE123C', center: [2.6, 2.1, 2.3] }
    ],
    top3: [
      { weight: 0.34, u: 0.62, v: 0.42, seed: 101, morphology: 'Núcleos pleomórficos hipercromáticos con pérdida de polaridad y nucléolos prominentes' },
      { weight: 0.22, u: 0.66, v: 0.50, seed: 102, morphology: 'Glándulas fusionadas (patrón cribiforme) con estratificación nuclear' },
      { weight: 0.14, u: 0.30, v: 0.68, seed: 103, morphology: 'Foco secundario: cordones de células tumorales infiltrando el estroma' }
    ],
    editorial: 'Tejido continuo con arquitectura glandular visible. La lesión ocupa un área grande y compacta.'
  },
  pap: {
    key: 'pap', name: 'Citología Pap', labelCode: 'PAP', stain: 'Papanicolaou', accent: '#0F766E',
    caseId: 'C-26-02039', diagnosisTitle: 'HSIL / Lesión intraepitelial de alto grado', defaultDilution: 0.015,
    maskSeed: 23, bgThreshold: 0.16, scanMm: [22, 32],
    primaryFocus: { u: 0.55, v: 0.55, rx: 0.045, ry: 0.08 },
    secondaryFocus: { u: 0.27, v: 0.70, rx: 0.035, ry: 0.06 },
    clusters: [
      { key: 'squam', label: 'Células escamosas normales',          color: 0x0F766E, hex: '#0F766E', center: [-3.0, 1.2, -1.4] },
      { key: 'endo',  label: 'Células endocervicales / metaplásicas', color: 0x4C3A7A, hex: '#4C3A7A', center: [2.9, 0.2, -2.3] },
      { key: 'pmn',   label: 'Inflamatorio / PMN',                  color: 0xD97706, hex: '#D97706', center: [-0.8, -2.4, 2.8] },
      { key: 'hsil',  label: 'Atipia HSIL / ASC-H',                 color: 0xBE123C, hex: '#BE123C', center: [2.4, 2.4, 2.0] }
    ],
    top3: [
      { weight: 0.42, u: 0.55, v: 0.55, seed: 201, morphology: 'Grupo cohesivo HSIL: núcleos hipercromáticos, relación N/C alta, cromatina gruesa' },
      { weight: 0.27, u: 0.57, v: 0.60, seed: 202, morphology: 'Células pequeñas con núcleo irregular y escaso citoplasma (ASC-H)' },
      { weight: 0.16, u: 0.27, v: 0.70, seed: 203, morphology: 'Segundo grupo HSIL con bordes nucleares angulados y superposición' }
    ],
    editorial: 'Extendido celular disperso sobre vidrio. Las células atípicas forman grupos diminutos entre miles de células normales.'
  },
  ihc: {
    key: 'ihc', name: 'IHC (DAB)', labelCode: 'IHC', stain: 'Inmunohistoquímica DAB / hematoxilina', accent: '#92400E',
    caseId: 'I-26-01188', diagnosisTitle: 'HER2 3+ / Ki-67 alto índice proliferativo', defaultDilution: 0.18,
    maskSeed: 37, bgThreshold: 0.30, scanMm: [15, 10],
    primaryFocus: { u: 0.68, v: 0.36, rx: 0.11, ry: 0.16 },
    secondaryFocus: { u: 0.35, v: 0.65, rx: 0.08, ry: 0.12 },
    clusters: [
      { key: 'neg',    label: 'Estroma / fondo negativo',             color: 0x0F766E, hex: '#0F766E', center: [-2.7, 1.7, -1.5] },
      { key: 'benign', label: 'Epitelio benigno (0–1+)',              color: 0x4C3A7A, hex: '#4C3A7A', center: [3.0, -0.2, -2.0] },
      { key: 'weak',   label: 'Positividad débil / heterogénea (2+)', color: 0xD97706, hex: '#D97706', center: [-1.2, -2.3, 2.5] },
      { key: 'pos',    label: 'HER2 3+ / Ki-67 alto',                 color: 0xBE123C, hex: '#BE123C', center: [2.5, 2.2, 2.2] }
    ],
    top3: [
      { weight: 0.36, u: 0.68, v: 0.36, seed: 301, morphology: 'Marcaje membranoso completo e intenso (HER2 3+) en células cohesivas' },
      { weight: 0.24, u: 0.70, v: 0.44, seed: 302, morphology: 'Núcleos Ki-67 positivos con mitosis frecuentes y marcaje DAB denso' },
      { weight: 0.15, u: 0.35, v: 0.65, seed: 303, morphology: 'Foco secundario con membrana positiva y heterogeneidad intratumoral' }
    ],
    editorial: 'Contratinción de hematoxilina con marcaje DAB marrón en el compartimento tumoral.'
  }
};
// Ajusta los Top-3 a celdas de la bolsa MIL (20×10) y calcula sus coordenadas
Object.values(MODALITIES).forEach(m => {
  m.top3 = m.top3.map((t, i) => {
    const ci = Math.min(MIL_COLS - 1, Math.floor(t.u * MIL_COLS)), cj = Math.min(MIL_ROWS - 1, Math.floor(t.v * MIL_ROWS));
    return { rank: i + 1, weight: t.weight, u: (ci + 0.5) / MIL_COLS, v: (cj + 0.5) / MIL_ROWS, coords: `(${ci}, ${cj})`, morphology: t.morphology, seed: t.seed, bagIndex: cj * MIL_COLS + ci };
  });
});

/* =====================================================================
   4. ESTADO GLOBAL
   ===================================================================== */
const state = {
  modality: 'he', stage: 1,
  pyramidLevel: 2, showPyramid: true, showGigaGrid: true,
  patchSize: 224, discardBg: true, explode: 0,
  artifacts: { blur: false, folds: false, ink: false, bubbles: false },
  qcOn: true,
  encoderTrained: false, normMode: 'none', umapColor: 'morph',
  aggregator: 'attention', dilution: MODALITIES.he.defaultDilution, groundTruth: 'pos', distractor: false,
  heatOpacity: 0.75, heatThreshold: 0.25, heatScale: 'amber',
  challenge: { active: false, pins: [], revealed: false, result: null },
  selectedTop3: -1,
  tau: 0.5,
  pinned: null
};
const dirty = { composite: true, tiles: true, bag: true, mil: true, umap: true, heat: true, heatColor: true, sidebarLive: true, pyramidTex: true };
const hasUnfilteredArtifacts = () => !state.qcOn && ARTIFACT_KEYS.some(k => state.artifacts[k]);
const activeArtifactKeys = () => ARTIFACT_KEYS.filter(k => state.artifacts[k]);

/* =====================================================================
   5. SEÑALES BIOLÓGICAS Y ARTEFACTOS
   ===================================================================== */
function tissueMask(u, v, mod) {
  const m = MODALITIES[mod];
  const dx = (u - 0.5) / 0.485, dy = (v - 0.5) / 0.47;
  const r = Math.sqrt(dx * dx + dy * dy);
  const n = fbm(u * 4.2, v * 2.6, m.maskSeed, 3);
  if (mod === 'pap') {
    const cloud = fbm(u * 6.5 + 3.1, v * 3.4 + 1.7, m.maskSeed + 5, 3);
    const sparse = smoothstep(0.44, 0.70, cloud);
    const edge = 1 - smoothstep(0.82, 1.0, r + 0.18 * (n - 0.5));
    return clamp(0.05 + 0.80 * sparse) * edge;
  }
  const edge = 1 - smoothstep(0.80, 1.0, r + 0.35 * (n - 0.5));
  const inner = 0.88 + 0.12 * fbm(u * 9, v * 5, m.maskSeed + 9, 2);
  return clamp(edge * inner);
}
function focusEnv(u, v, f, k = 1.3) {
  const du = (u - f.u) / f.rx, dv = (v - f.v) / f.ry;
  return Math.exp(-k * (du * du + dv * dv));
}
/** Devuelve cobertura de tejido, puntuación de atipia y clúster morfológico en (u,v) */
function evaluateBiologicalSignals(u, v, modality) {
  const m = MODALITIES[modality];
  let cov = tissueMask(u, v, modality);
  const g = Math.max(focusEnv(u, v, m.primaryFocus), 0.88 * focusEnv(u, v, m.secondaryFocus));
  if (modality === 'pap') cov = Math.max(cov, 0.78 * g);
  const tex = fbm(u * 14, v * 8, m.maskSeed + 31, 2);
  let atyp = Math.max(g * (0.85 + 0.3 * tex), 0.03 + 0.06 * tex);
  atyp = clamp(atyp * smoothstep(0.05, 0.35, cov));
  let idx = -1;
  if (cov >= m.bgThreshold) {
    if (atyp > 0.45) idx = 3;
    else {
      const n2 = vnoise(u * 10, v * 5, m.maskSeed + 51);
      idx = n2 < 0.46 ? 0 : (n2 < 0.80 ? 1 : 2);
      if (atyp > 0.2 && n2 > 0.55) idx = 2;
    }
  }
  return { tissueCoverage: cov, atypiaScore: atyp, clusterKey: idx >= 0 ? m.clusters[idx].key : null, clusterIndex: idx };
}

const ARTIFACTS = {
  blur:    { key: 'blur',    label: 'Desenfoque óptico',          cu: 0.20, cv: 0.30, rx: 0.11, ry: 0.18 },
  folds:   { key: 'folds',   label: 'Pliegues / Acúmulos',        a: [0.42, 0.86], b: [0.78, 0.66], w: 0.05 },
  ink:     { key: 'ink',     label: 'Tinta de marcador',          a: [0.90, 0.08], b: [0.93, 0.74], w: 0.022 },
  bubbles: { key: 'bubbles', label: 'Burbujas / Hemorragia-Moco', circles: [[0.10, 0.80, 0.075], [0.19, 0.89, 0.05], [0.46, 0.11, 0.06]] }
};
function distSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby));
  return Math.hypot(ax + t * abx - px, ay + t * aby - py);
}
/** Evalúa la intensidad (0–1) de cada artefacto activo en (u,v). Las distancias se calculan en unidades isotrópicas (u·2, v). */
function evaluateArtifactAt(u, v, active) {
  const out = { blur: 0, folds: 0, ink: 0, bubbles: 0 };
  if (active.blur) {
    const A = ARTIFACTS.blur;
    out.blur = 1 - smoothstep(0.7, 1.0, Math.hypot((u - A.cu) / A.rx, (v - A.cv) / A.ry));
  }
  if (active.folds) {
    const A = ARTIFACTS.folds;
    out.folds = 1 - smoothstep(A.w * 0.5, A.w * 1.1, distSeg(u * 2, v, A.a[0] * 2, A.a[1], A.b[0] * 2, A.b[1]));
  }
  if (active.ink) {
    const A = ARTIFACTS.ink;
    out.ink = 1 - smoothstep(A.w * 0.5, A.w * 1.1, distSeg(u * 2, v, A.a[0] * 2, A.a[1], A.b[0] * 2, A.b[1]));
  }
  if (active.bubbles) {
    let best = 0;
    for (const c of ARTIFACTS.bubbles.circles) {
      best = Math.max(best, 1 - smoothstep(c[2] * 0.8, c[2] * 1.1, Math.hypot((u - c[0]) * 2, v - c[1])));
    }
    out.bubbles = best;
  }
  return out;
}

/** Evalúa una teselas (col,row) de una grilla cols×rows: cobertura, atipia, varianza Laplaciana simulada y banderas de artefacto */
function evalTile(col, row, cols, rows) {
  const mod = state.modality, M = MODALITIES[mod];
  const u0 = col / cols, u1 = (col + 1) / cols, v0 = row / rows, v1 = (row + 1) / rows;
  const K = 5; let cov = 0, aty = 0, blurMean = 0, n = 0;
  const cnt = { blur: 0, folds: 0, ink: 0, bubbles: 0 };
  let clusterVotes = [0, 0, 0, 0];
  for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
    const u = lerp(u0, u1, (i + 0.5) / K), v = lerp(v0, v1, (j + 0.5) / K);
    const s = evaluateBiologicalSignals(u, v, mod);
    cov += s.tissueCoverage; aty += s.atypiaScore;
    if (s.clusterIndex >= 0) clusterVotes[s.clusterIndex]++;
    const a = evaluateArtifactAt(u, v, state.artifacts);
    blurMean += a.blur;
    for (const k of ARTIFACT_KEYS) if (a[k] > 0.5) cnt[k]++;
    n++;
  }
  cov /= n; aty /= n; blurMean /= n;
  const bg = cov < M.bgThreshold;
  const h = hash2(col, row, cols * 31 + M.maskSeed);
  let lap;
  if (bg) lap = 4 + h * 7;
  else {
    const base = 150 + h * 190 * (0.6 + 0.4 * cov);
    lap = Math.max(3, base * Math.pow(1 - clamp(blurMean), 2.5)) + (cnt.folds / n) * 40 + (cnt.ink / n) * 25;
  }
  const flags = {
    blur: !bg && blurMean > 0.12 && lap < QC_LAPLACIAN_MIN,
    folds: cnt.folds / n >= 0.2,
    ink: cnt.ink / n >= 0.12,
    bubbles: cnt.bubbles / n >= 0.25
  };
  const hasArtifact = !bg && ARTIFACT_KEYS.some(k => flags[k]);
  const tileType = bg ? 'fondo' : (hasArtifact ? 'artefacto' : (aty > 0.45 ? 'atipico' : 'sano'));
  const qcStatus = bg ? 'Fondo' : (hasArtifact ? (state.qcOn ? 'Rechazado por QC' : 'Artefacto sin filtrar') : 'Aprobado');
  let ci = 0; for (let k = 1; k < 4; k++) if (clusterVotes[k] > clusterVotes[ci]) ci = k;
  return {
    col, row, cols, rows, u: (u0 + u1) / 2, v: (v0 + v1) / 2,
    cov, atypia: aty, lap, bg, flags, hasArtifact, tileType, qcStatus,
    rejected: hasArtifact && state.qcOn,
    clusterIndex: bg ? -1 : (aty > 0.45 ? 3 : ci),
    artifactKeys: ARTIFACT_KEYS.filter(k => flags[k])
  };
}
const TILE_TYPE_LABEL = { fondo: 'Fondo / vidrio', artefacto: 'Artefacto', atipico: 'Foco atípico', sano: 'Tejido sano' };

/* =====================================================================
   6. TEXTURAS PROCEDURALES (HTML5 Canvas 2D)
   ===================================================================== */
const baseCanvas = makeCanvas(TEX_W, TEX_H);
const compCanvas = makeCanvas(TEX_W, TEX_H);
const labelCanvas = makeCanvas(256, 512);
let compositeVersion = 0;

function drawIrregularNucleus(ctx, x, y, r, rng, fill, stroke, alpha) {
  const n = rng.int(6, 9), rot = rng.range(0, Math.PI * 2), sx = rng.range(0.75, 1.25), sy = rng.range(0.7, 1.1);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = rot + (i % n) / n * Math.PI * 2, rr = r * rng.range(0.74, 1.22);
    const px = x + Math.cos(a) * rr * sx, py = y + Math.sin(a) * rr * sy;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function drawPoly(ctx, x, y, r, sides, rng, fill, stroke, alpha) {
  const rot = rng.range(0, 6.283);
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + i / sides * 6.283, rr = r * rng.range(0.82, 1.15);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.9; ctx.stroke(); }
}
function dot(ctx, x, y, r, fill, alpha = 1) { ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
function ell(ctx, x, y, rx, ry, rot, fill, alpha = 1) { ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }

const BASE_PAL = {
  he:  { bg: [250, 247, 250], tis: [238, 196, 214], cel: [212, 158, 196], aMax: 1 },
  pap: { bg: [243, 248, 250], tis: [221, 236, 241], cel: [205, 224, 235], aMax: 0.7 },
  ihc: { bg: [250, 250, 253], tis: [219, 228, 243], cel: [214, 184, 150], aMax: 1 }
};

/** Dibuja la textura microscópica 1024×512 de la modalidad indicada */
function generateBaseModalityCanvas(modality, target) {
  const m = MODALITIES[modality];
  const cv = target || makeCanvas(TEX_W, TEX_H), ctx = cv.getContext('2d');
  const rng = new SeededRandom(hashStr('base-' + modality));
  const P = BASE_PAL[modality];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = `rgb(${P.bg[0]},${P.bg[1]},${P.bg[2]})`; ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Capa 1: máscara suave de tejido a baja resolución, ampliada con suavizado
  const mw = 256, mh = 128, mc = makeCanvas(mw, mh), mctx = mc.getContext('2d');
  const img = mctx.createImageData(mw, mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const u = (x + 0.5) / mw, v = (y + 0.5) / mh, s = evaluateBiologicalSignals(u, v, modality);
    const a = smoothstep(0.08, 0.55, s.tissueCoverage) * P.aMax, t = s.atypiaScore, g = (hash2(x, y, 9) - 0.5) * 5;
    const o = (y * mw + x) * 4;
    for (let k = 0; k < 3; k++) {
      const tis = lerp(P.tis[k], P.cel[k], t);
      img.data[o + k] = clamp(lerp(P.bg[k], tis, a) + g, 0, 255);
    }
    img.data[o + 3] = 255;
  }
  mctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mc, 0, 0, TEX_W, TEX_H);

  const pick = (minCov, maxAt, tries) => {
    for (let k = 0; k < tries; k++) {
      const u = rng.next(), v = rng.next(), s = evaluateBiologicalSignals(u, v, modality);
      if (s.tissueCoverage >= minCov && s.atypiaScore <= maxAt) return { u, v, s };
    }
    return null;
  };
  ctx.lineCap = 'round';
  if (modality === 'he') paintHE(ctx, rng, m, pick);
  else if (modality === 'pap') paintPap(ctx, rng, m, pick);
  else paintIHC(ctx, rng, m, pick);
  return cv;
}

function paintHE(ctx, rng, m, pick) {
  const mod = 'he';
  // Fibras de estroma
  for (let i = 0; i < 900; i++) {
    const p = pick(0.55, 1, 6); if (!p) continue;
    const x = p.u * TEX_W, y = p.v * TEX_H, ang = fbm(p.u * 5, p.v * 5, m.maskSeed + 70, 2) * Math.PI * 3, len = rng.range(12, 34);
    ctx.strokeStyle = `rgba(${176 + rng.int(0, 30)},${96 + rng.int(0, 30)},${136 + rng.int(0, 30)},${0.16 + rng.next() * 0.16})`;
    ctx.lineWidth = rng.range(0.8, 1.8);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + rng.range(-4, 4), y + Math.sin(ang) * len * 0.5 + rng.range(-4, 4), x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  // Glándulas benignas
  for (let g = 0; g < 110; g++) {
    const p = pick(0.72, 0.12, 25); if (!p) continue;
    const x = p.u * TEX_W, y = p.v * TEX_H, r = rng.range(9, 17);
    ell(ctx, x, y, r * 1.35, r * 1.15, rng.range(0, 3), 'rgb(222,150,185)', 0.55);
    ell(ctx, x, y, r * 0.62, r * 0.5, 0, 'rgb(253,248,251)', 0.96);
    const nn = rng.int(9, 13);
    for (let k = 0; k < nn; k++) {
      const a = k / nn * 6.283 + rng.range(-0.1, 0.1);
      ell(ctx, x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 0.9, 2.7, 1.7, a + 1.57, '#4C3A7A', 0.62 + rng.next() * 0.3);
    }
  }
  // Núcleos benignos dispersos
  for (let i = 0; i < 5200; i++) {
    const p = pick(0.45, 0.4, 3); if (!p) continue;
    ell(ctx, p.u * TEX_W, p.v * TEX_H, rng.range(1.5, 2.9), rng.range(1.2, 2.2), rng.range(0, 3), '#4C3A7A', 0.42 + rng.next() * 0.34);
  }
  // Infiltrado inflamatorio
  for (let c = 0; c < 26; c++) {
    const p = pick(0.5, 0.35, 30); if (!p) continue;
    if (p.s.clusterKey !== 'infl' && rng.next() > 0.25) continue;
    const n = rng.int(8, 16), x = p.u * TEX_W, y = p.v * TEX_H;
    for (let k = 0; k < n; k++) dot(ctx, x + rng.range(-12, 12), y + rng.range(-10, 10), 2.1, '#342666', 0.86);
  }
  // Atipia: núcleos pleomórficos hipercromáticos con pérdida de arquitectura
  let placed = 0, tries = 0;
  while (placed < 1700 && tries < 9000) {
    tries++;
    const f = rng.next() < 0.68 ? m.primaryFocus : m.secondaryFocus;
    const u = f.u + rng.gauss() * f.rx * 0.62, v = f.v + rng.gauss() * f.ry * 0.62;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const s = evaluateBiologicalSignals(u, v, mod);
    if (s.atypiaScore < 0.3 || rng.next() > s.atypiaScore) continue;
    const x = u * TEX_W, y = v * TEX_H, r = rng.range(3.6, 7.6) * (0.7 + 0.5 * s.atypiaScore);
    ell(ctx, x + rng.range(-2, 2), y + rng.range(-2, 2), r * 1.6, r * 1.35, rng.range(0, 3), 'rgb(201,91,130)', 0.34);
    drawIrregularNucleus(ctx, x, y, r, rng, rng.next() < 0.5 ? '#2D2056' : '#3A2A6E', '#1B1238', 0.92);
    if (rng.next() < 0.45) dot(ctx, x + rng.range(-1, 1), y + rng.range(-1, 1), 1.1, '#BE123C', 0.85);
    placed++;
  }
  // Figuras mitóticas
  for (let i = 0; i < 9; i++) {
    const f = m.primaryFocus, x = (f.u + rng.gauss() * f.rx * 0.45) * TEX_W, y = (f.v + rng.gauss() * f.ry * 0.45) * TEX_H;
    ctx.strokeStyle = '#150C30'; ctx.lineWidth = 2.2;
    for (let k = 0; k < 6; k++) { const a = rng.range(0, 6.283); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5); ctx.stroke(); }
    dot(ctx, x, y, 2.6, '#150C30', 0.95);
  }
}

function paintPap(ctx, rng, m, pick) {
  const mod = 'pap';
  // Moco fino
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, TEX_W), y = rng.range(0, TEX_H);
    ctx.strokeStyle = `rgba(${170 + rng.int(0, 30)},${205 + rng.int(0, 25)},${215 + rng.int(0, 25)},${0.14 + rng.next() * 0.14})`;
    ctx.lineWidth = rng.range(1, 4);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + rng.range(-40, 40), y + rng.range(-30, 30), x + rng.range(-60, 60), y + rng.range(-40, 40), x + rng.range(-80, 80), y + rng.range(-50, 50));
    ctx.stroke();
  }
  const sq = ['#A9D6D9', '#E8B8CB', '#BFDDE0', '#9FD0D6'];
  let n = 0, t = 0;
  while (n < 1350 && t < 12000) {
    t++;
    const u = rng.next(), v = rng.next(), s = evaluateBiologicalSignals(u, v, mod);
    if (s.atypiaScore > 0.35 || rng.next() > Math.pow(s.tissueCoverage, 1.3)) continue;
    const x = u * TEX_W, y = v * TEX_H;
    if (s.clusterIndex === 1) {            // endocervicales / metaplásicas
      drawPoly(ctx, x, y, rng.range(5, 8), 6, rng, '#8FCBC0', 'rgba(40,100,95,.5)', 0.68);
      dot(ctx, x + rng.range(-1, 1), y + rng.range(-1, 1), 2.3, '#3C2D6E', 0.86);
    } else if (s.clusterIndex === 2) {      // PMN
      dot(ctx, x, y, 5.5, '#C9DCEB', 0.35);
      for (let k = 0; k < 3; k++) dot(ctx, x + rng.range(-2.6, 2.6), y + rng.range(-2.6, 2.6), 1.7, '#372D69', 0.92);
    } else {                                // escamosas normales
      drawPoly(ctx, x, y, rng.range(9, 15), 6, rng, sq[rng.int(0, 3)], 'rgba(60,100,115,.45)', 0.55);
      dot(ctx, x + rng.range(-1.5, 1.5), y + rng.range(-1.5, 1.5), 1.9, '#4C3A7A', 0.9);
    }
    n++;
  }
  // Grupos cohesivos HSIL (alta relación núcleo/citoplasma)
  [[m.primaryFocus, 10], [m.secondaryFocus, 6]].forEach(([f, groups]) => {
    for (let g = 0; g < groups; g++) {
      const gx = (f.u + rng.gauss() * f.rx * 0.5) * TEX_W, gy = (f.v + rng.gauss() * f.ry * 0.5) * TEX_H, cells = rng.int(8, 15);
      for (let k = 0; k < cells; k++) {
        const a = rng.range(0, 6.283), d = Math.abs(rng.gauss()) * 9;
        const cx = gx + Math.cos(a) * d, cy = gy + Math.sin(a) * d * 0.9;
        drawPoly(ctx, cx, cy, rng.range(5.5, 8), 7, rng, '#86B2C4', 'rgba(40,70,100,.6)', 0.72);
        drawIrregularNucleus(ctx, cx, cy, rng.range(3.4, 5.2), rng, '#2A1850', '#150B30', 0.94);
      }
    }
  });
}

function paintIHC(ctx, rng, m, pick) {
  const mod = 'ihc';
  // Núcleos contrateñidos con hematoxilina
  for (let i = 0; i < 5200; i++) {
    const p = pick(0.45, 1, 3); if (!p) continue;
    ell(ctx, p.u * TEX_W, p.v * TEX_H, rng.range(1.6, 3.1), rng.range(1.3, 2.4), rng.range(0, 3), '#4F6DB0', 0.42 + rng.next() * 0.32);
  }
  // Marcaje DAB membranoso/nuclear
  let n = 0, t = 0;
  while (n < 2300 && t < 14000) {
    t++;
    const f = rng.next() < 0.7 ? m.primaryFocus : m.secondaryFocus;
    const u = f.u + rng.gauss() * f.rx * 0.8, v = f.v + rng.gauss() * f.ry * 0.8;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const s = evaluateBiologicalSignals(u, v, mod);
    if (s.atypiaScore < 0.14 || rng.next() > s.atypiaScore * 1.1) continue;
    const x = u * TEX_W, y = v * TEX_H, r = rng.range(4.5, 8), strong = s.atypiaScore > 0.45;
    ctx.globalAlpha = strong ? 0.9 : 0.6;
    ctx.strokeStyle = strong ? '#78350F' : '#B45309'; ctx.lineWidth = strong ? 2.2 : 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, r * rng.range(0.9, 1.15), r * rng.range(0.8, 1.05), rng.range(0, 3), 0, 6.283); ctx.stroke();
    ctx.globalAlpha = 1;
    ell(ctx, x, y, r * 0.95, r * 0.85, 0, '#92400E', strong ? 0.34 : 0.18);
    if (strong || rng.next() < 0.4) dot(ctx, x + rng.range(-1, 1), y + rng.range(-1, 1), r * 0.42, '#92400E', strong ? 0.82 : 0.55);
    n++;
  }
}

/** Vista de alto aumento (40×) procedural; atypia ∈ [0,1] controla la patología */
function drawHighMag40xView(ctx, w, h, modality, atypia, seed) {
  const rng = new SeededRandom(hashStr('hm-' + modality) + seed * 977), s = w / 160;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, w, h);
  if (modality === 'he') {
    ctx.fillStyle = '#F2D2E0'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) ell(ctx, rng.range(0, w), rng.range(0, h), rng.range(2, 9) * s, rng.range(1, 4) * s, rng.range(0, 3.14), `rgb(${200 + rng.int(0, 35)},${120 + rng.int(0, 40)},${160 + rng.int(0, 30)})`, 0.1 + rng.next() * 0.14);
    const n = Math.round(lerp(34, 20, atypia));
    for (let i = 0; i < n; i++) {
      const x = rng.range(0.06, 0.94) * w, y = rng.range(0.06, 0.94) * h, r = lerp(4.3, 7.8, atypia) * s * rng.range(0.7, 1.25);
      ell(ctx, x, y, r * 1.7, r * 1.45, rng.range(0, 3), 'rgb(224,140,176)', 0.45);
      if (atypia > 0.4) {
        drawIrregularNucleus(ctx, x, y, r, rng, '#2B1D52', '#150C30', 0.95);
        dot(ctx, x - r * 0.2, y - r * 0.15, r * 0.28, '#7864AA', 0.5);
        if (rng.next() < 0.7) dot(ctx, x + r * 0.15, y + r * 0.1, r * 0.17, '#BE123C', 0.9);
      } else {
        ell(ctx, x, y, r * 0.9, r * 0.78, rng.range(0, 3), '#58428C', 0.85);
        dot(ctx, x - r * 0.2, y - r * 0.2, r * 0.3, '#7864AA', 0.35);
      }
    }
    if (atypia > 0.55) for (let i = 0; i < 2; i++) {
      const x = rng.range(0.2, 0.8) * w, y = rng.range(0.2, 0.8) * h;
      ctx.strokeStyle = '#150C30'; ctx.lineWidth = 1.6 * s;
      for (let k = 0; k < 7; k++) { const a = rng.range(0, 6.283); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s); ctx.stroke(); }
      dot(ctx, x, y, 3 * s, '#150C30', 0.95);
    }
  } else if (modality === 'pap') {
    ctx.fillStyle = '#EEF5F7'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) dot(ctx, rng.range(0, w), rng.range(0, h), rng.range(0.6, 2) * s, '#B9D3DC', 0.25);
    if (atypia > 0.4) {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, 6.283), d = Math.abs(rng.gauss()) * 28 * s, x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d * 0.9, r = rng.range(11, 15) * s;
        drawPoly(ctx, x, y, r, 7, rng, '#86B2C4', 'rgba(40,70,100,.65)', 0.72);
        drawIrregularNucleus(ctx, x, y, r * rng.range(0.5, 0.65), rng, '#2A1850', '#150B30', 0.95);
        if (rng.next() < 0.5) dot(ctx, x, y, r * 0.1, '#6B5BA8', 0.8);
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const x = rng.range(0.15, 0.85) * w, y = rng.range(0.15, 0.85) * h, r = rng.range(20, 26) * s;
        drawPoly(ctx, x, y, r, 6, rng, ['#A9D6D9', '#E8B8CB', '#BFDDE0'][rng.int(0, 2)], 'rgba(60,100,115,.5)', 0.6);
        dot(ctx, x, y, 3.3 * s, '#4C3A7A', 0.92);
      }
    }
  } else {
    ctx.fillStyle = '#E4EAF6'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) ell(ctx, rng.range(0, w), rng.range(0, h), rng.range(2, 8) * s, rng.range(1, 3) * s, rng.range(0, 3), '#B7C5E6', 0.2);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const x = rng.range(0.07, 0.93) * w, y = rng.range(0.07, 0.93) * h, r = rng.range(6.5, 9) * s;
      const pos = rng.next() < atypia;
      if (pos) {
        ctx.globalAlpha = 0.92; ctx.strokeStyle = '#78350F'; ctx.lineWidth = 2.6 * s;
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.45, r * 1.25, rng.range(0, 3), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
        ell(ctx, x, y, r * 1.35, r * 1.15, 0, '#92400E', 0.3);
        ell(ctx, x, y, r * 0.8, r * 0.7, rng.range(0, 3), '#92400E', 0.85);
      } else {
        ell(ctx, x, y, r * 0.85, r * 0.72, rng.range(0, 3), '#4F6DB0', 0.8);
        dot(ctx, x - r * 0.2, y - r * 0.2, r * 0.25, '#7F98CF', 0.5);
      }
    }
  }
  ctx.restore();
}

/* ---------- Artefactos sobre la textura compuesta ---------- */
function drawBlurArtifact(ctx) {
  const A = ARTIFACTS.blur, cx = A.cu * TEX_W, cy = A.cv * TEX_H, rx = A.rx * TEX_W * 1.15, ry = A.ry * TEX_H * 1.15;
  const x0 = Math.max(0, Math.floor(cx - rx)), y0 = Math.max(0, Math.floor(cy - ry));
  const w = Math.min(TEX_W - x0, Math.ceil(rx * 2)), h = Math.min(TEX_H - y0, Math.ceil(ry * 2));
  const small = makeCanvas(Math.max(4, Math.floor(w / 12)), Math.max(4, Math.floor(h / 12)));
  const sctx = small.getContext('2d'); sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(baseCanvas, x0, y0, w, h, 0, 0, small.width, small.height);
  const tmp = makeCanvas(w, h), t = tmp.getContext('2d');
  t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high';
  t.drawImage(small, 0, 0, small.width, small.height, 0, 0, w, h);
  t.globalCompositeOperation = 'destination-in';
  t.save(); t.translate(cx - x0, cy - y0); t.scale(1, ry / rx);
  const g = t.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.62, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = g; t.fillRect(-rx * 1.2, -rx * 1.2, rx * 2.4, rx * 2.4); t.restore();
  ctx.drawImage(tmp, x0, y0);
}
function drawFoldsArtifact(ctx) {
  const A = ARTIFACTS.folds, ax = A.a[0] * TEX_W, ay = A.a[1] * TEX_H, bx = A.b[0] * TEX_W, by = A.b[1] * TEX_H, wpx = A.w * TEX_H;
  const col = state.modality === 'ihc' ? 'rgba(45,40,80,' : 'rgba(70,25,85,';
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = col + '0.34)'; ctx.lineWidth = wpx * 1.8; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = col + '0.55)'; ctx.lineWidth = wpx * 0.95; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, rng = new SeededRandom(777);
  for (let i = 0; i < 14; i++) {
    const off = (i / 13 - 0.5) * wpx * 1.5;
    ctx.strokeStyle = `rgba(35,10,55,${0.22 + 0.25 * rng.next()})`; ctx.lineWidth = 1 + rng.next() * 1.8;
    ctx.beginPath();
    for (let s = 0; s <= 24; s++) {
      const t = s / 24, wob = Math.sin(t * 9 + i) * 2.5, x = ax + dx * t + nx * (off + wob), y = ay + dy * t + ny * (off + wob);
      if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  if (state.modality === 'pap') for (let i = 0; i < 90; i++) { const t = rng.next(); dot(ctx, ax + dx * t + nx * rng.range(-wpx, wpx), ay + dy * t + ny * rng.range(-wpx, wpx), rng.range(2, 4.5), '#2A1850', 0.7); }
  ctx.restore();
}
function drawInkArtifact(ctx) {
  const A = ARTIFACTS.ink, ax = A.a[0] * TEX_W, ay = A.a[1] * TEX_H, bx = A.b[0] * TEX_W, by = A.b[1] * TEX_H, wpx = A.w * TEX_H;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    for (let s = 0; s <= 30; s++) {
      const t = s / 30, x = lerp(ax, bx, t) + Math.sin(t * 14) * 2.2, y = lerp(ay, by, t);
      if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = 'rgba(14,110,110,0.38)'; ctx.lineWidth = wpx * 1.7; path();
  ctx.strokeStyle = 'rgba(8,52,70,0.9)'; ctx.lineWidth = wpx * 1.05; path();
  ctx.strokeStyle = 'rgba(20,90,100,0.5)'; ctx.lineWidth = 1.6; path();
  ctx.restore();
}
function drawBubbleArtifact(ctx) {
  const rng = new SeededRandom(4242), pap = state.modality === 'pap';
  ARTIFACTS.bubbles.circles.forEach((c, idx) => {
    const cx = c[0] * TEX_W, cy = c[1] * TEX_H, r = c[2] * TEX_H;
    if (pap) {                               // exceso de moco: velo azul-grisáceo fibrilar
      for (let k = 0; k < 9; k++) dot(ctx, cx + rng.range(-r, r) * 0.8, cy + rng.range(-r, r) * 0.6, r * rng.range(0.35, 0.6), '#D5E2EC', 0.55);
      ctx.strokeStyle = 'rgba(120,150,175,0.45)'; ctx.lineWidth = 1.4;
      for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(cx + rng.range(-r, r), cy + rng.range(-r, r)); ctx.bezierCurveTo(cx + rng.range(-r, r), cy + rng.range(-r, r), cx + rng.range(-r, r), cy + rng.range(-r, r), cx + rng.range(-r, r), cy + rng.range(-r, r)); ctx.stroke(); }
    } else {
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.88)'); g.addColorStop(1, idx === 0 && state.modality === 'he' ? 'rgba(210,90,100,0.45)' : 'rgba(228,236,244,0.6)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(60,72,90,0.7)'; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
    }
  });
}

/** Combina el canvas base de la modalidad con la capa visual de los artefactos activos */
function rebuildCompositeTexture() {
  const ctx = compCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.drawImage(baseCanvas, 0, 0);
  const a = state.artifacts;
  if (a.blur) drawBlurArtifact(ctx);
  if (a.folds) drawFoldsArtifact(ctx);
  if (a.ink) drawInkArtifact(ctx);
  if (a.bubbles) drawBubbleArtifact(ctx);
  compositeVersion++;
  if (typeof compositeTexture !== 'undefined' && compositeTexture) compositeTexture.needsUpdate = true;
}

/** Etiqueta esmerilada del portaobjetos: código de barras, ID de caso y modalidad */
function rebuildSlideLabelTexture() {
  const m = MODALITIES[state.modality], ctx = labelCanvas.getContext('2d'), w = 256, h = 512;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#F6F8FB'); g.addColorStop(1, '#E6EBF2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const rng = new SeededRandom(5);
  for (let i = 0; i < 1100; i++) { ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(148,163,184,0.14)'; ctx.fillRect(rng.range(0, w), rng.range(0, h), 1.6, 1.6); }
  ctx.fillStyle = m.accent; ctx.fillRect(0, 0, w, 34);
  ctx.fillStyle = '#FFFFFF'; ctx.font = '600 15px "JetBrains Mono", monospace'; ctx.fillText('PDIA · LAB 3D', 14, 22);
  ctx.fillStyle = '#475569'; ctx.font = '500 12px "JetBrains Mono", monospace'; ctx.fillText('ID DE CASO', 14, 66);
  ctx.fillStyle = '#0F172A'; ctx.font = '700 25px "JetBrains Mono", monospace'; ctx.fillText(m.caseId, 14, 96);
  ctx.fillStyle = '#475569'; ctx.font = '500 12px "JetBrains Mono", monospace'; ctx.fillText('MODALIDAD', 14, 134);
  ctx.fillStyle = m.accent; ctx.font = '700 22px Inter, sans-serif'; ctx.fillText(m.name, 14, 160);
  ctx.fillStyle = '#334155'; ctx.font = '500 13px Inter, sans-serif';
  const words = m.stain.split(' '); let line = '', y = 184;
  words.forEach(wd => { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w - 28) { ctx.fillText(line, 14, y); y += 17; line = wd; } else line = t; });
  if (line) ctx.fillText(line, 14, y);
  y += 30; ctx.fillStyle = '#475569'; ctx.font = '500 12px "JetBrains Mono", monospace'; ctx.fillText('DX DE REFERENCIA', 14, y); y += 20;
  ctx.fillStyle = '#0F172A'; ctx.font = '600 14px Inter, sans-serif'; line = '';
  m.diagnosisTitle.split(' ').forEach(wd => { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w - 28) { ctx.fillText(line, 14, y); y += 18; line = wd; } else line = t; });
  if (line) { ctx.fillText(line, 14, y); y += 18; }
  ctx.fillStyle = '#64748B'; ctx.font = '500 11px "JetBrains Mono", monospace'; ctx.fillText('Escaneo simulado · 2026-11-23', 14, h - 92);
  // Código de barras determinista
  const br = new SeededRandom(hashStr(m.caseId)); let x = 14;
  ctx.fillStyle = '#0F172A';
  while (x < w - 16) { const bw = br.int(1, 4); if (br.next() < 0.62) ctx.fillRect(x, h - 78, bw, 44); x += bw + br.int(1, 3); }
  ctx.fillStyle = '#334155'; ctx.font = '500 11px "JetBrains Mono", monospace'; ctx.fillText(m.caseId.replace(/-/g, ' '), 14, h - 16);
  if (typeof labelTexture !== 'undefined' && labelTexture) labelTexture.needsUpdate = true;
}

/* ---------- Perfiles de color de escáner / normalización ---------- */
function lerpProfile(a, b, t) {
  return { gain: a.gain.map((v, i) => lerp(v, b.gain[i], t)), gamma: lerp(a.gamma, b.gamma, t), sat: lerp(a.sat, b.sat, t), bright: lerp(a.bright, b.bright, t) };
}
function applyColorProfile(imageData, prof, amount) {
  const p = lerpProfile(prof, HOSP_PROFILES.REF, amount), d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = Math.pow(d[i] / 255, p.gamma) * p.gain[0], g = Math.pow(d[i + 1] / 255, p.gamma) * p.gain[1], b = Math.pow(d[i + 2] / 255, p.gamma) * p.gain[2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * p.sat + p.bright; g = lum + (g - lum) * p.sat + p.bright; b = lum + (b - lum) * p.sat + p.bright;
    d[i] = clamp(r) * 255; d[i + 1] = clamp(g) * 255; d[i + 2] = clamp(b) * 255;
  }
  return imageData;
}
/** Recorte (u0,v0,u1,v1) de la textura compuesta dibujado en ctx (dw×dh) */
function drawCompositeCrop(ctx, u0, v0, u1, v1, dw, dh) {
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(compCanvas, u0 * TEX_W, v0 * TEX_H, (u1 - u0) * TEX_W, (v1 - v0) * TEX_H, 0, 0, dw, dh);
}
const hmScratch = makeCanvas(64, 64);
/** Dibuja el nivel de la pirámide (0..3 → 5×,10×,20×,40×) centrado en la ROI */
function drawPyramidLevel(ctx, w, h, level) {
  const m = MODALITIES[state.modality], roi = m.primaryFocus, f = 1 / PYR_LEVELS[level].zoom;
  const du = f, dv = f;
  let u0 = clamp(roi.u - du / 2, 0, 1 - du), v0 = clamp(roi.v - dv / 2, 0, 1 - dv);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  drawCompositeCrop(ctx, u0, v0, u0 + du, v0 + dv, w, h);
  if (level >= 2) {
    if (hmScratch.width !== w || hmScratch.height !== h) { hmScratch.width = w; hmScratch.height = h; }
    const hctx = hmScratch.getContext('2d');
    drawHighMag40xView(hctx, w, h, state.modality, 1, 7);
    ctx.globalAlpha = level === 2 ? 0.42 : 1; ctx.drawImage(hmScratch, 0, 0); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
