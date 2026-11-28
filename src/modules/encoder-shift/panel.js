/* Etapa 3 · panel lateral y métricas en vivo. Migrado de la v3.0 (p5_ui.js §15, sidebarStage3, updateSidebarLive y drawHospitalThumbs). */
import { state, pipeline } from '../../engine/state.js';
import { MODALITIES, NORM_MODES, HOSPITALS, HOSP_PROFILES, hospitalName, hospitalScanner, hospitalDesc } from '../../engine/modalities.js';
import { umapMetrics } from '../../engine/pipeline.js';
import { drawHighMag40xView, applyColorProfile, compositeVersion } from '../../engine/textures.js';
import { seg, } from '../../ui/widgets.js';
import { $, setText, setBar } from '../../ui/dom.js';
import { t, fmt } from '../../i18n/index.js';

export function panelHTML() {
  return `<div class="sec"><h3>${t('s3.encoderSpace')}</h3>
      <div class="ctl-label"><span>${t('s3.encoderState')}</span></div>
      ${seg('encoderTrained', [[false, t('s3.enc.random')], [true, t('s3.enc.trained')]])}
      <div class="ctl-label" style="margin-top:12px"><span>${t('s3.normStrategy')}</span></div>
      ${seg('normMode', [['none', t('norm.none')], ['macenko', t('norm.macenko')], ['ssl', t('norm.ssl')]])}
      <div class="ctl-label" style="margin-top:12px"><span>${t('s3.colorBy')}</span></div>
      ${seg('umapColor', [['morph', t('s3.color.morph')], ['hospital', t('s3.color.hospital')]])}
      <div class="note" id="s3-note"></div>
    </div>
    <div class="sec"><h3>${t('s3.multicenter')}</h3>
      <div class="thumb-grid">
        ${HOSPITALS.map(h => `<figure><canvas id="hosp-${h.key}" width="140" height="140"></canvas><figcaption><b>${hospitalName(h)}</b><br>${hospitalScanner(h)}<br><span style="color:var(--ink3)">${hospitalDesc(h)}</span></figcaption></figure>`).join('')}
      </div>
      <p style="font-size:11.5px;color:var(--ink2);margin:8px 0 0">${t('s3.multicenterHint')}</p>
    </div>
    <div class="sec"><h3>${t('common.liveMetrics')}</h3>
      <div class="bar-row"><div class="bar-head"><b>${t('s3.m.batch')}</b><span class="mono" id="s3-batch-v"></span></div><div class="bar-track"><div class="bar-fill crimson" id="s3-batch"></div></div></div>
      <div class="bar-row"><div class="bar-head"><b>${t('s3.m.purity')}</b><span class="mono" id="s3-pur-v"></span></div><div class="bar-track"><div class="bar-fill" id="s3-pur"></div></div></div>
    </div>`;
}

export function panelLive() {
  const mt = umapMetrics();
  setText('s3-batch-v', fmt.pct(mt.batch, 0)); setText('s3-pur-v', fmt.pct(mt.purity, 0)); setBar('s3-batch', mt.batch); setBar('s3-pur', mt.purity);
  const note = $('#s3-note');
  if (note) {
    note.className = 'note ' + (mt.nContam ? 'bad' : '');
    note.innerHTML = mt.nContam ? t('s3.note.contam', { n: mt.nContam })
      : (!state.encoderTrained ? t('s3.note.random')
        : (state.normMode === 'none' ? t('s3.note.batch') : (state.normMode === 'macenko' ? t('s3.note.macenko') : t('s3.note.ssl'))));
  }
  drawHospitalThumbs();
}

/** Mismo parche con el perfil de color de cada escáner. Se redibuja solo si cambia la clave (modalidad, normalización, parche, composición). */
function drawHospitalThumbs() {
  const p = state.pinned, amount = NORM_MODES[state.normMode].amount;
  const aty = p ? Math.max(0.2, p.atypia) : 0.9, seed = p ? 500 + p.col * 13 + p.row : 77;
  const key = [state.modality, state.normMode, aty.toFixed(2), seed, compositeVersion].join('|');
  const first = document.getElementById('hosp-' + HOSPITALS[0].key);
  if (pipeline.umap && pipeline.umap.hospThumbKey === key && first && first.dataset.k === key) return;
  if (pipeline.umap) pipeline.umap.hospThumbKey = key;
  HOSPITALS.forEach(h => {
    const cv = document.getElementById('hosp-' + h.key); if (!cv) return;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); drawHighMag40xView(ctx, cv.width, cv.height, state.modality, aty, seed);
    const img = ctx.getImageData(0, 0, cv.width, cv.height); applyColorProfile(img, HOSP_PROFILES[h.key], amount); ctx.putImageData(img, 0, 0);
    cv.dataset.k = key;
  });
}
