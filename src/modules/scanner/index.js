/* M1 · Muestra y escáner genérico. Módulo 2D (sin escena 3D). Se carga bajo demanda (ver src/modules/registry.js).
 * Publica el perfil de escáner genérico en `state.scannerProfile` (lo usan M2 y módulos posteriores). */
import { state } from '../../engine/state.js';
import * as S from '../../engine/scanner-math.js';
import { setState } from '../../app/controller.js';
import { t } from '../../i18n/index.js';
import { tr } from '../../ui/glossary.js';
import { metric } from '../../ui/widgets.js';
import { setText } from '../../ui/dom.js';
import { prov, provLegend } from '../../ui/provenance.js';
import { codeBlock, put, section } from '../../ui/work2d.js';
import { objectivesHTML, predictionHTML, predictionLive, teacherHTML, referencesHTML } from '../../ui/module-sections.js';
import { lgRow } from '../../ui/legend.js';
import meta from './meta.js';
import * as SIM from './sim.js';
import { workHTML, workLive, workAfterRender, profileBuf, resetCache, tiempoTxt, entradaDesdeControles } from './work.js';

const PRED_CORRECT = 0;
const nA = v => (Math.round(v * 1e4) / 1e4);

function panelHTML() {
  return `${objectivesHTML(meta)}
    ${predictionHTML('scanner', 'm1.pred')}
    <div class="sec"><h3>${t('common.liveMetrics')}</h3>
      <div class="metric-grid c3">${metric('m1-k-mpp', t('m1.k.mpp'), t('m1.k.mppSub'))}${metric('m1-k-size', t('m1.k.size'), t('m1.k.sizeSub'))}${metric('m1-k-time', t('m1.k.time'), t('m1.k.timeSub'))}</div>
      <div class="note">${t('m1.k.note')}</div>
    </div>
    <div class="sec"><h3>${t('m1.code.title')}</h3>
      <p class="w2-sub">${tr('m1.code.sub')}</p>
      <div id="m1-code"></div>
      <div class="w2-sub">${prov('exact')} ${t('m1.code.prov')}</div>
    </div>
    ${teacherHTML('scanner', 5, 3, 3)}
    ${section('m1-prov-legend', t('common.provLegend'), provLegend())}
    ${referencesHTML(meta)}`;
}

function panelLive() {
  predictionLive('scanner', state.m1.pred, PRED_CORRECT);
  let o = null; try { o = S.salidasEscaneo(entradaDesdeControles(), [state.m1.area.w, state.m1.area.h]); } catch (e) { o = null; }
  const p = state.scannerProfile;
  setText('m1-k-mpp', `${nA(p.mpp.x)}${p.mpp.x === p.mpp.y ? '' : ' × ' + nA(p.mpp.y)} µm/px`);
  setText('m1-k-size', o ? bytes(o.exacto.bytesSinComprimir) : '-');
  setText('m1-k-time', o ? tiempoTxt(o.simulado.segundos) : '-');
  const mpp = p.mpp, a = state.m1.area, z = p.zPlanes;
  const code = `# ${t('m1.code.c.area')}
area_mm = (${a.w}, ${a.h})
mpp = (${nA(mpp.x)}, ${nA(mpp.y)})        # ${t('m1.code.c.mpp')}
px_x = ceil(area_mm[0] * 1000 / mpp[0])
px_y = ceil(area_mm[1] * 1000 / mpp[1])
z_planes = ${z}
bytes_raw = px_x * px_y * 3 * z_planes   # ${t('m1.code.c.raw')}
print(px_x, px_y, bytes_raw / 1e9, "GB")`;
  put('m1-code', codeBlock('Python', code, t('m1.code.note')).replace('<pre>', '<pre tabindex="0">'));
}
const bytes = b => (b >= 1e12 ? `${Math.round(b / 1e10) / 100} TB` : b >= 1e9 ? `${Math.round(b / 1e7) / 100} GB` : `${Math.round(b / 1e4) / 100} MB`);

const errJson = e => { const el = document.getElementById('m1-err-json'); if (el) el.textContent = e ? (e && e.name === 'PatchMathError' ? t(`err.${e.code}`, { field: e.field || '' }) : String(e)) : ''; };
const actions = {
  'm1-reset-mpp'() { setState('m1.mppEdited', false); return false; },
  'm1-profile-export'() {
    errJson(null);
    try { profileBuf.text = S.exportarPerfil(state.scannerProfile); } catch (e) { errJson(e); return false; }
    const ta = document.getElementById('m1-profile-json'); if (ta) ta.value = profileBuf.text; return false;
  },
  'm1-profile-import'() {
    errJson(null);
    const ta = document.getElementById('m1-profile-json'); let pf;
    try { pf = S.importarPerfil(ta ? ta.value : profileBuf.text); } catch (e) { errJson(e); return false; }
    setState('m1.family', pf.family); setState('m1.objective', pf.objective); setState('m1.scanMode', pf.scanMode);
    setState('m1.zPlanes', pf.zPlanes); setState('m1.zStepUm', pf.zStepUm); setState('m1.focusPoints', pf.focusPoints); setState('m1.compression', pf.compression.kind);
    setState('scannerProfile.mpp', { x: pf.mpp.x, y: pf.mpp.y });
    profileBuf.text = ta ? ta.value : profileBuf.text; return false;
  }
};

export default {
  create() {
    resetCache();
    return {
      id: meta.id, kind: '2d',
      panel: { html: panelHTML, live: panelLive },
      workspace: { html: workHTML, live: workLive, afterRender: workAfterRender },
      legend: () => `${lgRow('#0F766E', t('m1.legend.exact'), true)}${lgRow('#D97706', t('m1.legend.sim'), true)}${lgRow('#4C3A7A', t('m1.legend.image'), true)}${lgRow('#BE123C', t('m1.legend.current'), true)}`,
      hooks: { modality: () => resetCache() },
      actions,
      api: { sim: SIM, perfil: () => state.scannerProfile }
    };
  }
};
