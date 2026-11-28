/* Etapa 4 · módulo "MIL y atención". Se carga bajo demanda (ver src/modules/registry.js). */
import { getStageGroup } from '../../engine/scene.js';
import { state, pipeline } from '../../engine/state.js';
import { MIL_COLS, MIL_ROWS } from '../../engine/constants.js';
import { activeWeights } from '../../engine/pipeline.js';
import { pinPatchAtUV } from '../../app/pin.js';
import { ttRow, ttHint } from '../../ui/tooltip.js';
import { lgRow } from '../../ui/legend.js';
import { t, fmt } from '../../i18n/index.js';
import meta from './meta.js';
import { buildStage4, applyMILVisuals, updateMilHighlight, animateStage4 } from './scene.js';
import { panelHTML, panelLive } from './panel.js';

export default {
  create() {
    const group = getStageGroup(meta.id), s4 = buildStage4(group);
    applyMILVisuals(s4);
    return {
      id: meta.id, group, scene: s4,
      panel: { html: panelHTML, live: panelLive },
      legend: () => `<h4>${t('s4.legend.title')}</h4><div class="lg-ramp" style="background:linear-gradient(90deg,#A8B4C5,#D97706,#BE123C)"></div><div style="display:flex;justify-content:space-between;color:var(--ink2);font-size:10.5px"><span>${t('s4.legend.low')}</span><span>${t('s4.legend.high')}</span></div><div style="margin-top:4px;color:var(--ink2)">${t('s4.legend.size')}</div>${lgRow('#EA580C', t('s4.legend.distractor'))}${lgRow('#E2E8F0', t('s4.legend.excluded'))}`,
      hooks: { mil: () => applyMILVisuals(s4), highlight: () => updateMilHighlight(s4) },
      animate: (dt, tm) => animateStage4(s4, dt, tm),
      hover(rc) {
        const S = pipeline.mil, h = rc.intersectObject(s4.nodes, false)[0];
        if (!h || h.instanceId === undefined || !S) return null;
        const k = h.instanceId, W = activeWeights();
        const role = S.excl[k] ? t('s4.role.excluded') : S.isDist[k] ? t('s4.role.distractor') : S.isPos[k] ? t('s4.role.positive') : t('s4.role.healthy');
        return { tip: `<div class="tt-t">${t('s4.tip.instance', { k, col: k % MIL_COLS, row: Math.floor(k / MIL_COLS) })}</div>${ttRow('s_k', fmt.num(S.s[k], 3))}${ttRow('a_k', fmt.pct(W[k], 2))}${ttRow(t('tip.role'), role)}${ttHint(t('s4.tip.pin'))}`, cursor: 'pointer' };
      },
      click(rc) {
        const S = pipeline.mil, h = rc.intersectObject(s4.nodes, false)[0];
        if (h && h.instanceId !== undefined && S) {
          const k = h.instanceId; pinPatchAtUV(((k % MIL_COLS) + 0.5) / MIL_COLS, (Math.floor(k / MIL_COLS) + 0.5) / MIL_ROWS);
        }
      },
      trace(p) {
        const S = pipeline.mil, W = activeWeights(), bi = p.bagIndex;
        if (p.qcStatus === 'rejected') return { st: t('s4.trace.excluded'), cls: 'bad' };
        if (S && W) return { st: t('s4.trace.instance', { i: bi, a: fmt.pct(W[bi], 2), agg: t('agg.' + state.aggregator) }), cls: '' };
        return { st: '', cls: '' };
      }
    };
  }
};
