/* Señales biológicas sintéticas, artefactos y evaluación de teselas.
 * Lógica migrada sin cambios de la v3.0 (p2_core.js §5). Cambios: los estados de tesela y de QC pasan de
 * texto en español a códigos ('bg', 'artifact', 'atypical', 'healthy' · 'bg', 'approved', 'rejected',
 * 'unfiltered'); la etiqueta que ve la persona sale de i18n. */
import { MODALITIES } from './modalities.js';
import { state } from './state.js';
import { ARTIFACT_KEYS, QC_LAPLACIAN_MIN } from './constants.js';
import { clamp, lerp, smoothstep, hash2, vnoise, fbm } from './util.js';
import { t } from '../i18n/index.js';

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
  blur:    { key: 'blur',    cu: 0.20, cv: 0.30, rx: 0.11, ry: 0.18 },
  folds:   { key: 'folds',   a: [0.42, 0.86], b: [0.78, 0.66], w: 0.05 },
  ink:     { key: 'ink',     a: [0.90, 0.08], b: [0.93, 0.74], w: 0.022 },
  bubbles: { key: 'bubbles', circles: [[0.10, 0.80, 0.075], [0.19, 0.89, 0.05], [0.46, 0.11, 0.06]] }
};
function distSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby));
  return Math.hypot(ax + t * abx - px, ay + t * aby - py);
}
/** Evalúa la intensidad (0-1) de cada artefacto activo en (u,v). Las distancias se calculan en unidades isotrópicas (u·2, v). */
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
  const tileType = bg ? 'bg' : (hasArtifact ? 'artifact' : (aty > 0.45 ? 'atypical' : 'healthy'));
  const qcStatus = bg ? 'bg' : (hasArtifact ? (state.qcOn ? 'rejected' : 'unfiltered') : 'approved');
  let ci = 0; for (let k = 1; k < 4; k++) if (clusterVotes[k] > clusterVotes[ci]) ci = k;
  return {
    col, row, cols, rows, u: (u0 + u1) / 2, v: (v0 + v1) / 2,
    cov, atypia: aty, lap, bg, flags, hasArtifact, tileType, qcStatus,
    rejected: hasArtifact && state.qcOn,
    clusterIndex: bg ? -1 : (aty > 0.45 ? 3 : ci),
    artifactKeys: ARTIFACT_KEYS.filter(k => flags[k])
  };
}
const tileTypeLabel = code => t(`tile.type.${code}`);
const qcLabel = code => t(`qc.status.${code}`);
const artifactLabel = key => t(`artifact.${key}.label`);
const artifactShort = key => t(`artifact.${key}.short`);
export { tissueMask, focusEnv, evaluateBiologicalSignals, ARTIFACTS, distSeg, evaluateArtifactAt, evalTile, tileTypeLabel, qcLabel, artifactLabel, artifactShort };
