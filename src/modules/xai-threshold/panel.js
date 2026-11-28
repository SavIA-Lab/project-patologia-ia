/* Etapa 5 · panel lateral, banner del reto y métricas en vivo. Migrado de la v3.0 (p5_ui.js §15–16: sidebarStage5, updateSidebarLive, updateBanner). */
import { state, pipeline } from '../../engine/state.js';
import { MODALITIES, top3Morphology } from '../../engine/modalities.js';
import { rampCss } from '../../engine/pipeline.js';
import { drawHighMag40xView } from '../../engine/textures.js';
import { seg, sld, metric } from '../../ui/widgets.js';
import { $, $$, setText } from '../../ui/dom.js';
import { t, fmt } from '../../i18n/index.js';
import { rocAt, drawROC, COHORT } from './roc.js';

const chipCls = cls => cls === 'hit' ? 'ok' : cls === 'periphery' ? 'warn' : 'bad';

export function panelHTML() {
  const M = MODALITIES[state.modality], ch = state.challenge;
  const top3 = M.top3.map((tp, i) => `<button type="button" class="top3-card" data-action="top3" data-i="${i}">
      <canvas id="t3c-${i}" width="152" height="152"></canvas>
      <div class="t3-i"><div class="t3-h">${t('s5.top3.head', { rank: tp.rank, coords: tp.coords })}</div><div class="t3-r">a<sub>k</sub> = <span id="t3a-${i}">—</span> · x ${fmt.pct(tp.u, 1)} · y ${fmt.pct(tp.v, 1)}</div><div style="margin-top:3px;color:var(--ink2)">${top3Morphology(M, i)}</div></div></button>`).join('');
  let challengeHTML;
  if (!ch.active) challengeHTML = `<p style="font-size:12.5px;color:var(--ink2);margin:0 0 8px">${t('s5.ch.intro')}</p><button type="button" class="btn btn-hema" data-action="challenge-start">${t('s5.ch.start')}</button>`;
  else if (!ch.revealed) challengeHTML = `<div class="note warn">${t('s5.ch.pins', { n: ch.pins.length })}</div>
      <div class="btn-row"><button type="button" class="btn btn-danger" data-action="challenge-reveal" ${ch.pins.length ? '' : 'disabled'}>${t('s5.ch.reveal')}</button><button type="button" class="btn" data-action="challenge-reset">${t('s5.ch.reset')}</button></div>`;
  else {
    const r = ch.result;
    challengeHTML = `<div style="display:flex;align-items:baseline;gap:10px"><span class="score-big" style="color:${r.agreement >= 70 ? 'var(--teal)' : r.agreement >= 40 ? 'var(--amber)' : 'var(--crimson)'}">${r.agreement}%</span><span style="font-size:12.5px;color:var(--ink2)">${t('s5.ch.agreement')}</span></div>
      <ul class="pin-list">${r.items.map((it, i) => `<li><span><b>${t('s5.ch.pin', { i: i + 1 })}</b> · ${t('s5.which.' + it.which)} · ${fmt.num(it.dw, 2)} u</span><span class="chip ${chipCls(it.cls)}">${t('s5.cls.' + it.cls)}</span></li>`).join('')}</ul>
      <div class="btn-row"><button type="button" class="btn" data-action="challenge-reset">${t('s5.ch.resetFull')}</button></div>`;
  }
  const P = Math.round(COHORT.n * COHORT.prev);
  return `<div class="sec"><h3>${t('s5.heatmap')}</h3>
      ${sld('heatOpacity', t('s5.opacity'), 0, 100, 1, 0.01)}
      ${sld('heatThreshold', t('s5.heatThreshold'), 0, 90, 1, 0.01)}
      <div class="ctl-label" style="margin-top:10px"><span>${t('s5.scale')}</span></div>
      ${seg('heatScale', [['amber', t('s5.scale.amber')], ['viridis', t('s5.scale.viridis')]])}
      <div class="lg-ramp" id="s5-ramp" style="margin-top:8px;height:9px"></div>
    </div>
    <div class="sec"><h3>${t('s5.top3.title')}</h3><div class="top3">${top3}</div></div>
    <div class="sec"><h3>${t('s5.ch.title')}</h3>${challengeHTML}</div>
    <div class="sec"><h3>${t('s5.roc.title')}</h3>
      <div class="canvas-frame"><canvas id="roc-canvas" width="520" height="340"></canvas></div>
      ${sld('tau', t('s5.tau'), 10, 90, 1, 0.01)}
      <div class="btn-row" style="margin-top:4px">
        <button type="button" class="btn btn-sm" data-action="tau-preset" data-v="0.25">${t('s5.preset.screen', { v: fmt.num(0.25, 2) })}</button>
        <button type="button" class="btn btn-sm" data-action="tau-preset" data-v="0.5">${t('s5.preset.balanced', { v: fmt.num(0.5, 2) })}</button>
        <button type="button" class="btn btn-sm" data-action="tau-preset" data-v="0.75">${t('s5.preset.confirm', { v: fmt.num(0.75, 2) })}</button>
      </div>
      <div class="metric-grid" style="margin-top:10px">${metric('roc-sens', t('s5.m.sens'), t('s5.m.sensSub'), 'good')}${metric('roc-spec', t('s5.m.spec'), t('s5.m.specSub'), 'good')}${metric('roc-ppv', t('s5.m.ppv'), t('s5.m.ppvSub'))}${metric('roc-npv', t('s5.m.npv'), t('s5.m.npvSub'))}</div>
      <div style="font-size:11.5px;color:var(--ink2);margin:10px 0 2px">${t('s5.cohort', { n: fmt.int(COHORT.n), prev: fmt.pct(COHORT.prev, 0), pos: fmt.int(P), neg: fmt.int(COHORT.n - P) })}</div>
      <div class="cm"><div class="h"></div><div class="h">${t('s5.cm.actualPos')}</div><div class="h">${t('s5.cm.actualNeg')}</div>
        <div class="h">${t('s5.cm.predPos')}</div><div class="tp" id="cm-tp">—</div><div class="fp" id="cm-fp">—</div>
        <div class="h">${t('s5.cm.predNeg')}</div><div class="fn" id="cm-fn">—</div><div class="tn" id="cm-tn">—</div></div>
      <div class="note" id="s5-note"></div>
    </div>`;
}

export function panelLive() {
  const M = MODALITIES[state.modality], S = pipeline.mil;
  M.top3.forEach((tp, i) => { setText('t3a-' + i, S ? fmt.pct(S.w.att[tp.bagIndex], 1) : '—'); });
  $$('.top3-card').forEach(c => c.classList.toggle('sel', +c.dataset.i === state.selectedTop3));
  const ramp = $('#s5-ramp'); if (ramp) ramp.style.background = rampCss(state.heatScale);
  const r = rocAt(state.tau);
  setText('roc-sens', fmt.pct(r.sens, 1)); setText('roc-spec', fmt.pct(r.spec, 1)); setText('roc-ppv', fmt.pct(r.ppv, 1)); setText('roc-npv', fmt.pct(r.npv, 1));
  setText('cm-tp', t('confusion.TP') + ' ' + fmt.int(r.tp)); setText('cm-fn', t('confusion.FN') + ' ' + fmt.int(r.fn)); setText('cm-fp', t('confusion.FP') + ' ' + fmt.int(r.fp)); setText('cm-tn', t('confusion.TN') + ' ' + fmt.int(r.tn));
  const cv = $('#roc-canvas'); if (cv) drawROC(cv.getContext('2d'), cv.width, cv.height);
  const note = $('#s5-note'); if (note) note.innerHTML = state.tau <= 0.3 ? t('s5.note.screen', { fn: r.fn, fp: r.fp })
    : (state.tau >= 0.7 ? t('s5.note.confirm', { fn: r.fn, fp: r.fp }) : t('s5.note.balanced', { prev: fmt.pct(COHORT.prev, 0) }));
}

/** Miniaturas 40× de los Top-3 (se redibujan al cambiar modalidad o idioma de la barra lateral) */
export function drawTop3Thumbs() {
  MODALITIES[state.modality].top3.forEach((tp, i) => { const cv = document.getElementById('t3c-' + i); if (cv) drawHighMag40xView(cv.getContext('2d'), cv.width, cv.height, state.modality, 0.95, tp.seed); });
}

/** Contenido del banner del reto (flota sobre el visor). Devuelve null cuando no hay reto activo. */
export function bannerHTML() {
  const ch = state.challenge;
  if (!ch.active) return null;
  if (!ch.revealed) return `<div style="font-size:12.5px">${t('s5.banner.running', { n: ch.pins.length })}</div>
      <div class="btn-row" style="margin-top:6px"><button type="button" class="btn btn-sm btn-danger" data-action="challenge-reveal" ${ch.pins.length ? '' : 'disabled'}>${t('s5.ch.reveal')}</button><button type="button" class="btn btn-sm" data-action="challenge-reset">${t('s5.ch.reset')}</button></div>`;
  return `<div style="font-size:12.5px">${t('s5.banner.result', { a: ch.result.agreement, items: ch.result.items.map((it, i) => t('s5.banner.item', { i: i + 1, cls: t('s5.cls.' + it.cls) })).join(' · ') })}</div><div class="btn-row" style="margin-top:6px"><button type="button" class="btn btn-sm" data-action="challenge-reset">${t('s5.ch.resetFull')}</button></div>`;
}
