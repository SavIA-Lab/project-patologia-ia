/* Etapa 5 · módulo "XAI y umbral". Se carga bajo demanda (ver src/modules/registry.js). */
import { getStageGroup, flyToUV } from '../../engine/scene.js';
import { state, dirty, pipeline } from '../../engine/state.js';
import { MODALITIES } from '../../engine/modalities.js';
import { heatVisible, heatAt, rampCss } from '../../engine/pipeline.js';
import { toast } from '../../ui/dom.js';
import { ttRow, ttHint } from '../../ui/tooltip.js';
import { lgRow } from '../../ui/legend.js';
import { t, fmt } from '../../i18n/index.js';
import meta from './meta.js';
import { buildStage5, rebuildTop3Markers, colorizeHeat, applyHeatVisibility, rebuildPins, startChallenge, addChallengePin, revealChallenge, resetChallenge, animateStage5 } from './scene.js';
import { panelHTML, panelLive, drawTop3Thumbs, bannerHTML } from './panel.js';

export default {
  create() {
    const group = getStageGroup(meta.id), s5 = buildStage5(group);
    const selectTop3 = i => {
      state.selectedTop3 = i; const tp = MODALITIES[state.modality].top3[i];
      if (!heatVisible()) { toast('s5.toast.finishFirst'); return; }
      flyToUV(tp.u, tp.v); dirty.sidebarLive = true;
    };
    return {
      id: meta.id, group, scene: s5,
      panel: { html: panelHTML, live: panelLive, afterRender: drawTop3Thumbs },
      banner: bannerHTML,
      legend: () => `<h4>${t('s5.legend.title')}</h4><div class="lg-ramp" style="background:${rampCss(state.heatScale)}"></div><div style="display:flex;justify-content:space-between;color:var(--ink2);font-size:10.5px"><span>${t('s5.legend.low')}</span><span>${t('s5.legend.high')}</span></div>${lgRow('#0F766E', t('s5.legend.hit'))}${lgRow('#D97706', t('s5.legend.periphery'))}${lgRow('#BE123C', t('s5.legend.miss'))}`,
      hooks: {
        heat: () => {},
        heatColor: () => { colorizeHeat(s5); applyHeatVisibility(s5); },
        modality: () => { rebuildTop3Markers(s5); rebuildPins(s5); applyHeatVisibility(s5); },
        heatVisibility: () => applyHeatVisibility(s5)
      },
      actions: {
        'top3': el => selectTop3(+el.dataset.i),
        'challenge-start': () => { startChallenge(s5); return true; },
        'challenge-reveal': () => { if (revealChallenge(s5)) { toast('s5.toast.revealed'); return true; } return false; },
        'challenge-reset': () => { resetChallenge(s5); return true; }
      },
      animate: (dt, tm) => animateStage5(s5, dt, tm),
      hover(rc) {
        const vis = heatVisible();
        if (vis) {
          const mh = rc.intersectObjects(s5.markers.map(m => m.hit), false)[0];
          if (mh) { const tp = MODALITIES[state.modality].top3[mh.object.userData.top3]; return { tip: `<div class="tt-t">${t('s5.tip.top3', { rank: tp.rank, coords: tp.coords })}</div>${ttRow('a_k', fmt.pct(pipeline.mil.w.att[tp.bagIndex], 1))}`, cursor: 'pointer' }; }
        }
        const h = rc.intersectObject(s5.slide.tissue, false)[0];
        if (!h) return null;
        const u = h.uv.x, v = 1 - h.uv.y, ch = state.challenge;
        if (ch.active && !ch.revealed) return { tip: `<div class="tt-t">${t('s5.tip.challenge')}</div>${ttRow('u, v', fmt.num(u, 2) + ', ' + fmt.num(v, 2))}${ttHint(t('s5.tip.challengePin', { n: ch.pins.length }), '#FDE68A')}`, cursor: 'crosshair' };
        if (vis) return { tip: `<div class="tt-t">${t('s5.tip.slide')}</div>${ttRow('u, v', fmt.num(u, 2) + ', ' + fmt.num(v, 2))}${ttRow(t('tip.heat'), fmt.num(heatAt(u, v), 2))}` };
        return null;
      },
      click(rc) {
        if (heatVisible()) { const mh = rc.intersectObjects(s5.markers.map(m => m.hit), false)[0]; if (mh) { selectTop3(mh.object.userData.top3); return 'top3'; } }
        const ch = state.challenge;
        if (ch.active && !ch.revealed) {
          const h = rc.intersectObject(s5.slide.tissue, false)[0];
          if (h) { if (addChallengePin(s5, h.uv.x, 1 - h.uv.y)) return 'rerender'; toast('s5.toast.maxPins'); }
        }
      },
      trace(p) {
        if (p.qcStatus === 'rejected') return { st: t('s5.trace.excluded'), cls: 'bad' };
        const S = pipeline.mil, hv = heatAt(p.u, p.v);
        return { st: t('s5.trace.heat', { h: fmt.num(hv, 2) }) + (S ? ' · ' + t('s5.trace.weight', { a: fmt.pct(S.w.att[p.bagIndex], 2) }) : ''), cls: '' };
      }
    };
  }
};
