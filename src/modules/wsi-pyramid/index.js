/* M2 · WSI, pirámide y formatos. Módulo 2D (sin escena 3D). Se carga bajo demanda (ver src/modules/registry.js). */
import { state } from '../../engine/state.js';
import * as P from '../../engine/patch-math.js';
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
import { SNIPPETS, VERIFIED_ON } from './snippets.js';
import { workHTML, workLive, workAfterRender, mppNativo, fuenteActual, resetFuente, jsonBuf } from './work.js';
import { FuenteNucleo, FIELD_UM } from './nucleus.js';

const SNIPPET_IDS = ['inspect', 'read', 'patch'], PRED_CORRECT = 1;
const nA = v => (Math.round(v * 1e4) / 1e4);

function panelHTML() {
  return `${objectivesHTML(meta)}
    ${predictionHTML('wsi-pyramid', 'm2.pred')}
    <div class="sec"><h3>${t('common.liveMetrics')}</h3>
      <div class="metric-grid c3">${metric('m2-k-mpp', t('m2.k.mpp'), t('m2.k.mppSub'))}${metric('m2-k-fov', t('m2.k.fov'), t('m2.k.fovSub'))}${metric('m2-k-nuc', t('m2.k.nuc'), t('m2.k.nucSub'))}</div>
      <div class="note" id="m2-k-note"></div>
    </div>
    <div class="sec"><h3>${t('m2.code.title')}</h3>
      <p class="w2-sub">${tr('m2.code.sub')}</p>
      <div class="seg-sm" role="group">${SNIPPET_IDS.map(id => `<button type="button" data-set="m2.snippet" data-value="${id}">${t(`m2.code.${id}.tab`)}</button>`).join('')}</div>
      <p class="w2-sub" id="m2-code-note"></p>
      <div id="m2-code"></div>
      <div class="w2-sub">${prov('spec')} ${t('m2.code.verified', { date: VERIFIED_ON })}</div>
      <div class="w2-warn">${t('m2.code.caveat')}</div>
    </div>
    ${section('m2-equiv', t('m2.equiv.title'), `<p class="w2-sub">${tr('m2.equiv.sub')}</p><div id="m2-equiv-code"></div>`)}
    ${teacherHTML('wsi-pyramid', 5, 4, 4)}
    ${section('m2-prov-legend', t('common.provLegend'), provLegend())}
    ${referencesHTML(meta)}`;
}

function panelLive() {
  predictionLive('wsi-pyramid', state.m2.pred, PRED_CORRECT);
  const m2 = state.m2;
  let mpp = null; try { mpp = P.mppPorEje(mppNativo(), 'mpp'); } catch (e) { mpp = null; }
  if (mpp) {
    const lv = Math.min(m2.cfg.level, m2.pyr.ds.length - 1), ds = m2.pyr.ds[lv];
    let ex = null; try { ex = P.mppExtraccion(mpp, ds); } catch (e) { ex = null; }
    setText('m2-k-mpp', ex ? `${nA(ex.x)}${ex.x === ex.y ? '' : ' × ' + nA(ex.y)}` : '-');
    const f = ex ? P.fov(m2.cfg.ext, ex) : null;
    setText('m2-k-fov', f ? `${Math.round(f.x * 10) / 10} µm` : '-');
    let np = null; try { np = P.pixelesNucleo(m2.nuc.diam, mpp); } catch (e) { np = null; }
    setText('m2-k-nuc', np ? `${Math.round(np.x * 10) / 10} px` : '-');
    const note = document.getElementById('m2-k-note'); if (note) note.innerHTML = t('m2.k.note');
  } else { setText('m2-k-mpp', '-'); setText('m2-k-fov', '-'); setText('m2-k-nuc', '-'); }
  // fragmento de código con los valores actuales
  const sel = m2.sel, lv = Math.min(sel.level, m2.pyr.ds.length - 1), ds = m2.pyr.ds[lv] || 1, mp = mpp ? nA(mpp.x * ds) : '?';
  const size = sel.mode === 'fov' && mpp ? Math.max(1, Math.round(sel.fovUm / (mpp.x * ds))) : sel.px;
  const sn = SNIPPETS[m2.snippet] || SNIPPETS.inspect;
  const code = sn.code({ x: sel.x, y: sel.y, level: lv, w: size, h: size, ds: nA(ds), ext: m2.cfg.ext, enc: m2.cfg.enc, mppx: mp }, (k, p) => t(`m2.code.c.${k}`, p));
  put('m2-code', codeBlock('Python · OpenSlide', code, t(`m2.code.${sn.id}.tab`)).replace('<pre>', '<pre tabindex="0">'));
  const note = document.getElementById('m2-code-note'); if (note && note.textContent !== t(`m2.code.${sn.id}.note`)) note.textContent = t(`m2.code.${sn.id}.note`);
  // equivalente en JavaScript del motor con la configuración vigente
  let equiv = '';
  try {
    const cfg = P.crearPatchConfig({ mppOriginal: mppNativo(), nivel: lv, downsample: ds, tamanoExtraccion: m2.cfg.ext, tamanoTile: m2.cfg.tile, entradaEncoder: m2.cfg.enc, stride: m2.cfg.stride, politicaBorde: m2.cfg.border });
    equiv = P.exportarPatchConfig(cfg);
  } catch (e) { equiv = t('m2.equiv.invalid'); }
  put('m2-equiv-code', codeBlock('JSON · patch-config v1', equiv, t('m2.equiv.note')));
}

/** Acciones de los botones del módulo. Devuelven true si hay que volver a dibujar la estructura. */
const actions = {
  'm2-add-level'() {
    const ds = state.m2.pyr.ds; if (ds.length >= 8) return false;
    const last = ds[ds.length - 1], next = ds.length === 1 ? 4 : Math.round(last * 2 * 1e3) / 1e3;
    setState('m2.pyr.ds', [...ds, Number.isFinite(next) && next > last ? next : (Number.isFinite(last) ? last + 1 : 2)]); return true;
  },
  'm2-remove-level'() {
    const ds = state.m2.pyr.ds; if (ds.length <= 1) return false;
    setState('m2.pyr.ds', ds.slice(0, -1));
    const n = ds.length - 1; if (state.m2.sel.level >= n) setState('m2.sel.level', n - 1); if (state.m2.cfg.level >= n) setState('m2.cfg.level', n - 1);
    return true;
  },
  'm2-preset'(el) {
    const v = { course: [1, 4, 16, 32], pow2: [1, 2, 4, 8, 16], frac: [1, 4.0002, 16.0009, 32.37] }[el.dataset.v]; if (!v) return false;
    setState('m2.pyr.ds', v.slice());
    const n = v.length; if (state.m2.sel.level >= n) setState('m2.sel.level', n - 1); if (state.m2.cfg.level >= n) setState('m2.cfg.level', n - 1);
    return true;
  },
  'm2-cfg-export'() {
    const err = document.getElementById('m2-err-json'); if (err) err.textContent = '';
    try {
      const m2 = state.m2, lv = Math.min(m2.cfg.level, m2.pyr.ds.length - 1);
      jsonBuf.text = P.exportarPatchConfig({ mppOriginal: mppNativo(), nivel: lv, downsample: m2.pyr.ds[lv], tamanoExtraccion: m2.cfg.ext, tamanoTile: m2.cfg.tile, entradaEncoder: m2.cfg.enc, stride: m2.cfg.stride, politicaBorde: m2.cfg.border, etiqueta: '' });
    } catch (e) { if (err) err.textContent = e && e.name === 'PatchMathError' ? t(`err.${e.code}`, { field: e.field || '' }) : String(e); return false; }
    const ta = document.getElementById('m2-cfg-json'); if (ta) ta.value = jsonBuf.text;
    return false;
  },
  'm2-cfg-import'() {
    const err = document.getElementById('m2-err-json'), ta = document.getElementById('m2-cfg-json'); if (err) err.textContent = '';
    let c;
    try { c = P.importarPatchConfig(ta ? ta.value : jsonBuf.text); } catch (e) { if (err) err.textContent = e && e.name === 'PatchMathError' ? t(`err.${e.code}`, { field: e.field || '' }) : String(e); return false; }
    const m2 = state.m2, n = m2.pyr.ds.length;
    if (c.nivel >= n) { if (err) err.textContent = t('m2.cfg.errLevelMissing', { n: c.nivel }); return false; }
    if (Math.abs(m2.pyr.ds[c.nivel] - c.downsample) > 1e-9) { if (err) err.textContent = t('m2.cfg.errDsMismatch', { n: c.nivel, ds: c.downsample, cur: m2.pyr.ds[c.nivel] }); return false; }
    setState('m2.mppSource', 'manual'); setState('m2.mpp', { x: c.mppOriginal.x, y: c.mppOriginal.y });
    setState('m2.cfg', { level: c.nivel, ext: c.tamanoExtraccion.w, tile: c.tamanoTile.w === c.tamanoExtraccion.w && c.tamanoTile.h === c.tamanoExtraccion.h ? null : c.tamanoTile.w, enc: c.entradaEncoder.w, stride: c.stride.x, border: c.politicaBorde });
    jsonBuf.text = ta ? ta.value : jsonBuf.text;
    return true;
  }
};

export default {
  create() {
    resetFuente();
    return {
      id: meta.id, kind: '2d',
      panel: { html: panelHTML, live: panelLive },
      workspace: { html: workHTML, live: workLive, afterRender: workAfterRender },
      legend: () => `${lgRow('#0F766E', t('m2.legend.exact'), true)}${lgRow('#4C3A7A', t('m2.legend.image'), true)}${lgRow('#D97706', t('m2.legend.sim'), true)}${lgRow('#BE123C', t('m2.legend.sel'), true)}`,
      hooks: { modality: () => resetFuente() },
      actions,
      /** Interfaz para las pruebas automáticas y para depurar desde la consola */
      api: {
        fuente: () => fuenteActual(),
        pixelesA: mpp => { const f = fuenteActual(), m = f.muestreada(mpp); return { n: m.n, mppReal: m.mppReal, datos: Array.from(m.data.data) }; },
        huellaFuente: () => { const f = fuenteActual(); let h = 0; const d = f.data.data; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return { id: f.id, huella: h }; },
        idFuente: () => fuenteActual().id,
        campoUm: FIELD_UM, FuenteNucleo
      }
    };
  }
};
