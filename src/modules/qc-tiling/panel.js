/* Etapa 2 · panel lateral y métricas en vivo. Migrado de la v3.0 (p5_ui.js §15, sidebarStage2 y updateSidebarLive). */
import { state, pipeline, hasUnfilteredArtifacts, activeArtifactKeys } from '../../engine/state.js';
import { QC_LAPLACIAN_MIN } from '../../engine/constants.js';
import { seg, tog, sld, metric } from '../../ui/widgets.js';
import { $, setText } from '../../ui/dom.js';
import { t, fmt } from '../../i18n/index.js';

export function panelHTML() {
  return `<div class="sec"><h3>${t('s2.tiling')}</h3>
      <div class="ctl-label"><span>${t('s2.patchSize')}</span></div>
      ${seg('patchSize', [[224, '224×224 px'], [512, '512×512 px']], true)}
      ${tog('discardBg', t('s2.togBg'), t('s2.togBgHint'))}
      ${sld('explode', t('s2.explode'), 0, 100, 1, 0.01)}
    </div>
    <div class="sec"><h3>${t('s2.artifactSim')}</h3>
      ${tog('artifacts.blur', t('s2.tog.blur'), t('s2.tog.blurHint'), 'sw-amber')}
      ${tog('artifacts.folds', t('s2.tog.folds'), t('s2.tog.foldsHint'), 'sw-amber')}
      ${tog('artifacts.ink', t('s2.tog.ink'), t('s2.tog.inkHint'), 'sw-amber')}
      ${tog('artifacts.bubbles', t('s2.tog.bubbles'), t('s2.tog.bubblesHint'), 'sw-amber')}
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--line)">${tog('qcOn', t('s2.togQc'), t('s2.togQcHint'))}</div>
      <div class="note" id="s2-note"></div>
    </div>
    <div class="sec"><h3>${t('s2.trace')}</h3>
      <div class="btn-row">
        <button type="button" class="btn btn-sm" data-action="pin-atypical">${t('s2.pinAtypical')}</button>
        <button type="button" class="btn btn-sm" data-action="pin-healthy">${t('s2.pinHealthy')}</button>
        <button type="button" class="btn btn-sm" data-action="pin-artifact">${t('s2.pinArtifact')}</button>
        <button type="button" class="btn btn-sm" data-action="unpin">${t('s2.unpin')}</button>
      </div>
      <p style="font-size:12px;color:var(--ink2);margin:8px 0 0">${t('s2.traceHint')}</p>
    </div>
    <div class="sec"><h3>${t('common.liveMetrics')}</h3>
      <div class="metric-grid c3">${metric('s2-total', t('s2.m.total'), t('s2.m.totalSub'))}${metric('s2-tissue', t('s2.m.tissue'), '')}${metric('s2-ok', t('s2.m.ok'), '', 'good')}${metric('s2-rej', t('s2.m.rej'), '', 'bad')}${metric('s2-unf', t('s2.m.unf'), '', 'warn')}${metric('s2-lap', t('s2.m.lap'), t('s2.m.lapSub'))}</div>
    </div>`;
}

export function panelLive() {
  const inf = pipeline.tiles.infos || [];
  if (!inf.length) return;
  const tissue = inf.filter(i => !i.bg), ok = tissue.filter(i => !i.hasArtifact), rej = tissue.filter(i => i.rejected), unf = tissue.filter(i => i.hasArtifact && !i.rejected);
  const lapAvg = ok.length ? ok.reduce((a, i) => a + i.lap, 0) / ok.length : 0;
  setText('s2-total', inf.length); setText('s2-tissue', tissue.length); setText('s2-ok', ok.length); setText('s2-rej', rej.length); setText('s2-unf', unf.length); setText('s2-lap', fmt.num(lapAvg, 0));
  const note = $('#s2-note'); if (note) {
    const anyAct = activeArtifactKeys().length > 0;
    note.className = 'note ' + (hasUnfilteredArtifacts() ? 'bad' : (anyAct ? 'warn' : ''));
    note.innerHTML = hasUnfilteredArtifacts() ? t('s2.note.off', { n: unf.length })
      : (anyAct ? t('s2.note.on', { n: rej.length, min: QC_LAPLACIAN_MIN }) : t('s2.note.idle'));
  }
}
