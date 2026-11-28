/* Etapa 4 · panel lateral y métricas en vivo. Migrado de la v3.0 (p5_ui.js §15, sidebarStage4 y updateSidebarLive). */
import { state, pipeline, hasUnfilteredArtifacts } from '../../engine/state.js';
import { MIL_BAG_SIZE } from '../../engine/constants.js';
import { seg, tog, sld, metric } from '../../ui/widgets.js';
import { $, setText } from '../../ui/dom.js';
import { t, fmt } from '../../i18n/index.js';

export function panelHTML() {
  const rows = [['mean', t('agg.mean')], ['max', t('agg.max')], ['attention', t('agg.attention.short')]];
  return `<div class="sec"><h3>${t('s4.scenario')}</h3>
      <div class="ctl-label"><span>${t('s4.activeAgg')}</span></div>
      ${seg('aggregator', [['mean', t('agg.mean')], ['max', t('agg.max')], ['attention', t('agg.attention')]])}
      <div class="ctl-label" style="margin-top:12px"><span>${t('s4.groundTruth')}</span></div>
      ${seg('groundTruth', [['pos', t('s4.gt.pos')], ['neg', t('s4.gt.neg')]])}
      ${sld('dilution', t('s4.dilution'), 0.5, 35, 0.5, 0.01)}
      ${tog('distractor', t('s4.togDistractor'), t('s4.togDistractorHint', { s: fmt.num(0.92, 2) }), 'sw-crimson')}
      <div class="note" id="s4-note"></div>
    </div>
    <div class="sec"><h3>${t('s4.compare')}</h3>
      <table class="tbl"><thead><tr><th>${t('s4.th.agg')}</th><th>Ŷ</th><th>${t('s4.th.maxA')}</th><th>${t('s4.th.label')}</th></tr></thead><tbody>
      ${rows.map(([k, l]) => `<tr id="t4-row-${k}"><td>${l}</td><td id="t4-y-${k}">-</td><td id="t4-w-${k}">-</td><td><span class="chip" id="t4-l-${k}">-</span></td></tr>`).join('')}
      </tbody></table>
      <p style="font-size:11.5px;color:var(--ink2);margin:8px 0 0">${t('s4.compareHint', { thr: fmt.num(0.5, 2) })}</p>
    </div>
    <div class="sec"><h3>${t('common.liveMetrics')}</h3>
      <div class="metric-grid">${metric('s4-k', t('s4.m.k'), t('s4.m.kSub', { n: MIL_BAG_SIZE }))}${metric('s4-sum', t('s4.m.sum'), t('s4.m.sumSub'), 'good')}${metric('s4-neff', t('s4.m.neff'), t('s4.m.neffSub'))}${metric('s4-dist', t('s4.m.dist'), t('s4.m.distSub'))}</div>
    </div>`;
}

export function panelLive() {
  const S = pipeline.mil; if (!S) return;
  [['mean', 'mean'], ['max', 'max'], ['attention', 'att']].forEach(([k, a]) => {
    setText('t4-y-' + k, fmt.num(S.y[a], 3)); setText('t4-w-' + k, fmt.pct(S.maxW[a], 1));
    const l = document.getElementById('t4-l-' + k); if (l) { l.textContent = t('confusion.' + S.label[a]); l.className = 'chip ' + S.label[a]; }
    const r = document.getElementById('t4-row-' + k); if (r) r.classList.toggle('act', k === state.aggregator);
  });
  setText('s4-k', fmt.int(S.K)); setText('s4-sum', fmt.num(S.sumAtt, 6)); setText('s4-neff', fmt.int(S.neff)); setText('s4-dist', fmt.int(S.dist.length));
  const note = $('#s4-note'); if (note) {
    const forced = hasUnfilteredArtifacts();
    note.className = 'note ' + (forced ? 'warn' : '');
    note.innerHTML = t('s4.note.base', { gt: t(state.groundTruth === 'pos' ? 's4.gt.posWord' : 's4.gt.negWord'), d: fmt.pct(state.dilution, 1), k: S.K, n: MIL_BAG_SIZE })
      + (forced ? ' ' + t('s4.note.forced') : '') + (S.nExcl ? ' ' + t('s4.note.excl', { n: S.nExcl }) : '');
  }
}
