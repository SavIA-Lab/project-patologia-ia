/* Etapa 5 · curva ROC binormal y matriz de confusión de la cohorte simulada.
 * Migrada sin cambios de lógica de la v3.0 (p4_stage345.js §12). Las funciones numéricas (erf, Phi, rocAt, aucAnalytic) son puras. */
import { state } from '../../engine/state.js';
import { t, fmt } from '../../i18n/index.js';

export function erf(x) {
  const sg = Math.sign(x); x = Math.abs(x);
  const k = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return sg * y;
}
export const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
export const ROC_MU = 2.199;           // separación binormal para AUC = Φ(μ/√2) ≈ 0.94
export const COHORT = { n: 1000, prev: 0.10 };
export const tauToX = tau => ROC_MU / 2 + 0.7 * Math.log(tau / (1 - tau));
export function rocAt(tau) {
  const x = tauToX(tau), sens = Phi(ROC_MU - x), spec = Phi(x);
  const P = Math.round(COHORT.n * COHORT.prev), Nn = COHORT.n - P;
  const tp = Math.round(sens * P), fn = P - tp, tn = Math.round(spec * Nn), fp = Nn - tn;
  return { tau, x, sens, spec, fpr: 1 - spec, tp, fn, tn, fp, P, Nn, ppv: tp + fp ? tp / (tp + fp) : 0, npv: tn + fn ? tn / (tn + fn) : 0 };
}
export function aucAnalytic() { return Phi(ROC_MU / Math.SQRT2); }
export function drawROC(ctx, w, h) {
  const pad = { l: 38, r: 14, t: 12, b: 32 }, pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const X = f => pad.l + f * pw, Y = f => pad.t + (1 - f) * ph;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1; ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = '#64748B'; ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const f = i / 5; ctx.beginPath(); ctx.moveTo(X(f), Y(0)); ctx.lineTo(X(f), Y(1)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(0), Y(f)); ctx.lineTo(X(1), Y(f)); ctx.stroke();
    ctx.fillText(fmt.num(f, 1), X(f), Y(0) + 13);
  }
  ctx.textAlign = 'right'; for (let i = 0; i <= 5; i++) ctx.fillText(fmt.num(i / 5, 1), pad.l - 6, Y(i / 5) + 3);
  ctx.textAlign = 'center'; ctx.fillStyle = '#475569'; ctx.font = '600 10.5px Inter, sans-serif';
  ctx.fillText(t('roc.axisX'), pad.l + pw / 2, h - 5);
  ctx.save(); ctx.translate(10, pad.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(t('roc.axisY'), 0, 0); ctx.restore();
  // área bajo la curva y curva
  const pts = []; for (let x = -4.5; x <= 7; x += 0.05) pts.push([1 - Phi(x), Phi(ROC_MU - x)]);
  pts.sort((a, b) => a[0] - b[0]);
  ctx.beginPath(); ctx.moveTo(X(0), Y(0)); pts.forEach(p => ctx.lineTo(X(p[0]), Y(p[1]))); ctx.lineTo(X(1), Y(0)); ctx.closePath(); ctx.fillStyle = 'rgba(76,58,122,0.10)'; ctx.fill();
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.strokeStyle = '#4C3A7A'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
  const r = rocAt(state.tau);
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(190,18,60,0.5)'; ctx.beginPath(); ctx.moveTo(X(r.fpr), Y(0)); ctx.lineTo(X(r.fpr), Y(r.sens)); ctx.lineTo(X(0), Y(r.sens)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#BE123C'; ctx.beginPath(); ctx.arc(X(r.fpr), Y(r.sens), 6, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#4C3A7A'; ctx.font = '600 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(`AUC ≈ ${fmt.num(aucAnalytic(), 2)}`, X(0.52), Y(0.2));
  ctx.fillStyle = '#BE123C'; ctx.fillText(`τ = ${fmt.num(state.tau, 2)}`, X(0.52), Y(0.1));
}
