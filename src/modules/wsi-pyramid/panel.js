/* Etapa 1 · panel lateral y métricas en vivo. Migrado de la v3.0 (p5_ui.js §15, sidebarStage1 y updateSidebarLive). */
import { state } from '../../engine/state.js';
import { MODALITIES } from '../../engine/modalities.js';
import { PYR_LEVELS } from '../../engine/constants.js';
import { drawPyramidLevel } from '../../engine/textures.js';
import { seg, tog, metric, fmtBytes } from '../../ui/widgets.js';
import { $, setText, setBar } from '../../ui/dom.js';
import { t, fmt } from '../../i18n/index.js';

export function panelHTML() {
  return `<div class="sec"><h3>${t('common.controls')}</h3>
      <div class="ctl-label"><span>${t('s1.magLevel')}</span></div>
      ${seg('pyramidLevel', [[0, '5×'], [1, '10×'], [2, '20×'], [3, '40×']], true)}
      <div style="margin-top:6px">
        ${tog('showPyramid', t('s1.togPyramid'), t('s1.togPyramidHint'))}
        ${tog('showGigaGrid', t('s1.togGrid'), t('s1.togGridHint'))}
      </div>
    </div>
    <div class="sec"><h3>${t('s1.roiView')}</h3>
      <div class="canvas-frame"><canvas id="pyr-canvas" width="480" height="270"></canvas>
        <div class="canvas-cap"><span class="mono" id="pyr-cap-l"></span><span class="mono" id="pyr-cap-r"></span></div></div>
      <div class="bar-row"><div class="bar-head"><b>${t('s1.context')}</b><span class="mono" id="pyr-ctx-v"></span></div><div class="bar-track"><div class="bar-fill hema" id="pyr-ctx"></div></div></div>
      <div class="bar-row"><div class="bar-head"><b>${t('s1.detail')}</b><span class="mono" id="pyr-det-v"></span></div><div class="bar-track"><div class="bar-fill eosin" id="pyr-det"></div></div></div>
    </div>
    <div class="sec"><h3>${t('common.liveMetrics')}</h3>
      <div class="metric-grid">${metric('s1-res', t('s1.m.res'), t('s1.m.resSub'))}${metric('s1-size', t('s1.m.size'), t('s1.m.sizeSub'))}${metric('s1-px', t('s1.m.px'), t('s1.m.pxSub'))}${metric('s1-fov', t('s1.m.fov'), t('s1.m.fovSub'))}</div>
      <div class="note" id="s1-note"></div>
    </div>`;
}

export function panelLive() {
  const M = MODALITIES[state.modality], L = PYR_LEVELS[state.pyramidLevel], cv = $('#pyr-canvas');
  if (cv) {
    const ctx = cv.getContext('2d'); drawPyramidLevel(ctx, cv.width, cv.height, state.pyramidLevel);
    const umpp = M.scanMm[0] * 1000 / L.zoom / cv.width, barUm = [1000, 500, 250, 100][state.pyramidLevel], bp = barUm / umpp;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(12, cv.height - 30, bp + 62, 20);
    ctx.fillStyle = '#0F172A'; ctx.fillRect(18, cv.height - 21, bp, 3.5);
    ctx.font = '600 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(barUm >= 1000 ? '1 mm' : barUm + ' µm', 24 + bp, cv.height - 15);
    ctx.fillStyle = 'rgba(76,58,122,0.92)'; ctx.fillRect(cv.width - 54, 10, 44, 22); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(L.mag + '×', cv.width - 32, 25);
    setText('pyr-cap-l', t('s1.capLeft', { mag: L.mag })); setText('pyr-cap-r', `${fmt.auto(L.res)} µm/px`);
  }
  setText('pyr-ctx-v', L.context + '%'); setText('pyr-det-v', L.detail + '%'); setBar('pyr-ctx', L.context / 100); setBar('pyr-det', L.detail / 100);
  const pxs = (M.scanMm[0] * 1000 / L.res) * (M.scanMm[1] * 1000 / L.res), gb = pxs * 3 / 1e9;
  setText('s1-res', fmt.num(L.res, 2) + ' µm/px'); setText('s1-size', fmtBytes(gb)); setText('s1-px', pxs >= 1e9 ? fmt.num(pxs / 1e9, 2) + ' Gpx' : fmt.num(pxs / 1e6, 0) + ' Mpx');
  setText('s1-fov', fmt.num(M.scanMm[0] / L.zoom, 1) + ' mm');
  const note = $('#s1-note'); if (note) note.innerHTML = t(state.pyramidLevel <= 1 ? 's1.note.low' : 's1.note.high', { w: M.scanMm[0], h: M.scanMm[1] });
}
