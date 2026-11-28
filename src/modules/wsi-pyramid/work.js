/* M2 · espacio de trabajo 2D: calibración y MPP (A), núcleo a distintos MPP (A), pirámide configurable (B),
 * selector de región (B), configuración del parche (patchConfig), formatos y caso de fallo de dos escáneres.
 * Todas las cifras salen de src/engine/patch-math.js. La estructura se dibuja una vez (html) y los valores se actualizan (live). */
import { state } from '../../engine/state.js';
import * as P from '../../engine/patch-math.js';
import { baseCanvas } from '../../engine/textures.js';
import { t, fmt } from '../../i18n/index.js';
import { tr } from '../../ui/glossary.js';
import { prov, pv } from '../../ui/provenance.js';
import { card, field, segBtns, errBox, showErr, kv, table, put, eq } from '../../ui/work2d.js';
import { FuenteNucleo, FIELD_UM, SRC_MPP, MPP_MIN, dibujarRecorte, dibujarBarra, escenaCelulas, dibujarEscena, remuestrearArea } from './nucleus.js';
import { FMT } from '../../ui/widgets.js';
import { setState } from '../../app/controller.js';

const n3 = v => fmt.num(v, 3), n2 = v => fmt.num(v, 2), nA = v => fmt.auto(Math.round(v * 1e4) / 1e4), nI = v => fmt.int(Math.round(v));
FMT['m2.nuc.zoom'] = v => fmt.num(v, 0) + '×'; FMT['m2.nuc.chrom'] = v => fmt.num(v, 2); FMT['m2.nuc.irreg'] = v => fmt.num(v, 2);
const bytesTxt = b => (b >= 1e12 ? fmt.num(b / 1e12, 2) + ' TB' : b >= 1e9 ? fmt.num(b / 1e9, 2) + ' GB' : b >= 1e6 ? fmt.num(b / 1e6, 1) + ' MB' : fmt.int(b) + ' B');
const m2 = () => state.m2;

/** MPP nativo en uso: el del perfil de escáner de M1 o el escrito a mano. No hay valor por defecto: si falta, el motor lanza el error. */
export const mppNativo = () => (m2().mppSource === 'scanner' ? state.scannerProfile.mpp : m2().mpp);
const orderEngine = () => (m2().pyr.order === 'low-first' ? 'menor-a-mayor' : 'mayor-a-menor');
const piramide = () => P.construirPiramide({ mppNativo: mppNativo(), dimensionesNivel0: { w: m2().pyr.w0, h: m2().pyr.h0 }, downsamples: m2().pyr.ds });

/** Texto del cuadro JSON: se conserva al redibujar la estructura (por ejemplo, al cambiar de idioma) */
export const jsonBuf = { text: '' };
let fuente = null;
/** Fuente única del núcleo (se regenera solo si cambia algún parámetro de la imagen, nunca por cambiar el MPP ni el zoom) */
export function fuenteActual() {
  const n = m2().nuc, params = { seed: n.seed, nucUm: n.diam, cellUm: n.cell, chrom: n.chrom, irreg: n.irreg, modality: state.modality };
  const id = `${params.seed}|${params.nucUm}|${params.cellUm}|${params.chrom}|${params.irreg}|${params.modality}`;
  if (!fuente || fuente.id !== id) fuente = new FuenteNucleo(params);
  return fuente;
}
export const resetFuente = () => { fuente = null; };

/* ---------------------------------------------------------------- estructura */
const MPP_PRESETS = [0.125, 0.25, 0.5, 1, 2];

function calibHTML() {
  return card('m2-sec-mpp', t('m2.calib.title'), `
    <p class="w2-sub">${tr('m2.calib.sub')}</p>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m2.calib.source')}</span>${segBtns('m2.mppSource', [['scanner', t('m2.calib.fromScanner')], ['manual', t('m2.calib.manual')]])}</div>
    <div class="w2-row" id="m2-mpp-manual">${field('m2.mpp.x', t('m2.calib.mppX'), 'µm/px')}${field('m2.mpp.y', t('m2.calib.mppY'), 'µm/px')}</div>
    <div class="w2-info" id="m2-mpp-scanner"></div>
    ${errBox('m2-err-mpp')}
    <div id="m2-derived"></div>
    <h4>${t('m2.optics.title')}</h4>
    <div class="w2-row">${field('m2.optics.lambdaNm', t('m2.optics.lambda'), 'nm', { min: 1 })}${field('m2.optics.na', t('m2.optics.na'), '', { min: 0.01 })}</div>
    ${errBox('m2-err-optics')}<div id="m2-optics-out"></div>
    <h4>${t('m2.alias.title')}</h4>
    <p class="w2-sub">${tr('m2.alias.sub')}</p>
    <div class="w2-row">${field('m2.alias.periodUm', t('m2.alias.period'), 'µm', { min: 0.01 })}</div>
    <canvas id="m2-alias" class="w2-canvas" width="440" height="120" role="img" aria-label="${t('m2.alias.aria')}"></canvas>
    <div id="m2-alias-out"></div>
    <h4>${t('m2.ill.title')}</h4>
    <div class="w2-warn">${t('m2.ill.warn')}</div>
    ${table([{ t: t('m2.ill.mpp'), n: true }, { t: t('m2.ill.mag'), n: true }], P.TABLA_MPP_AUMENTO_ILUSTRATIVA.map(r => ({ cells: [nA(r.mpp), r.aumento + '×'] })), 'ill')}
    <p class="w2-sub" id="m2-ill-near"></p>
    <div class="w2-sub">${prov('exact')} ${t('m2.prov.calib')}</div>`, '', 'w2-wide');
}

function nucleusHTML() {
  return card('m2-sec-nucleus', t('m2.nuc.title'), `
    <p class="w2-sub">${tr('m2.nuc.sub')} <span class="sim-tag">${t('m2.nuc.simTag')}</span></p>
    <div class="w2-row">
      ${field('m2.nuc.diam', t('m2.nuc.diam'), 'µm', { min: 1 })}${field('m2.nuc.cell', t('m2.nuc.cell'), 'µm', { min: 2 })}${field('m2.nuc.mpp', t('m2.nuc.mpp'), 'µm/px', { min: MPP_MIN })}${field('m2.nuc.seed', t('m2.nuc.seed'), '', { step: 1, min: 1 })}
    </div>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m2.nuc.presets')}</span>${segBtns('m2.nuc.mpp', MPP_PRESETS.map(v => [v, nA(v)]), true)}</div>
    <div class="w2-row">
      <label class="w2-field"><span>${t('m2.nuc.zoom')} <b data-valfor="m2.nuc.zoom"></b></span><input type="range" min="1" max="8" step="1" data-slider="m2.nuc.zoom" data-scale="1" aria-label="${t('m2.nuc.zoom')}"></label>
      <label class="w2-field"><span>${t('m2.nuc.chrom')} <b data-valfor="m2.nuc.chrom"></b></span><input type="range" min="0" max="1" step="0.05" data-slider="m2.nuc.chrom" data-scale="1" aria-label="${t('m2.nuc.chrom')}"></label>
      <label class="w2-field"><span>${t('m2.nuc.irreg')} <b data-valfor="m2.nuc.irreg"></b></span><input type="range" min="0" max="1" step="0.05" data-slider="m2.nuc.irreg" data-scale="1" aria-label="${t('m2.nuc.irreg')}"></label>
    </div>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m2.nuc.third')}</span>${segBtns('m2.nuc.view', [['resampled', t('m2.nuc.viewRes')], ['upsampled', t('m2.nuc.viewUp')], ['difference', t('m2.nuc.viewDiff')]])}</div>
    ${errBox('m2-err-nuc')}
    <div class="w2-figs">
      <figure><canvas id="m2-nuc-src" class="w2-canvas" width="248" height="248" role="img" aria-label="${t('m2.nuc.aSrc')}"></canvas><figcaption id="m2-cap-src"></figcaption></figure>
      <figure><canvas id="m2-nuc-res" class="w2-canvas px" width="248" height="248" role="img" aria-label="${t('m2.nuc.aRes')}"></canvas><figcaption id="m2-cap-res"></figcaption></figure>
      <figure><canvas id="m2-nuc-third" class="w2-canvas px" width="248" height="248" role="img" aria-label="${t('m2.nuc.aThird')}"></canvas><figcaption id="m2-cap-third"></figcaption></figure>
    </div>
    <h4>${t('m2.nuc.strip')}</h4>
    <div class="w2-figs" id="m2-strip">${MPP_PRESETS.map((v, i) => `<figure><canvas id="m2-strip-${i}" class="w2-canvas px" width="112" height="112" role="img" aria-label="${t('m2.nuc.aStrip', { mpp: nA(v) })}"></canvas><figcaption id="m2-strip-cap-${i}"></figcaption></figure>`).join('')}</div>
    <div id="m2-nuc-out"></div>
    <div class="w2-warn">${t('m2.nuc.warn')}</div>`, '', 'w2-wide');
}

function pyramidHTML() {
  const ds = m2().pyr.ds;
  const head = `<tr><th>${t('m2.pyr.colVisual')}</th><th>${t('m2.pyr.colLevel')}</th><th>${t('m2.pyr.colDs')}</th><th class="n">${t('m2.pyr.colMppX')}</th><th class="n">${t('m2.pyr.colMppY')}</th><th class="n">${t('m2.pyr.colDims')}</th><th class="n">${t('m2.pyr.colSize')}</th></tr>`;
  const body = ds.map((_, lv) => `<tr id="m2-pr-${lv}"><td id="m2-pr-v-${lv}"></td><td id="m2-pr-l-${lv}" class="n"></td><td><input class="w2-num" type="number" inputmode="decimal" step="any" min="1" data-field="m2.pyr.ds.${lv}" aria-label="${t('m2.pyr.colDs')} ${lv}"></td><td class="n" id="m2-pr-mx-${lv}"></td><td class="n" id="m2-pr-my-${lv}"></td><td class="n" id="m2-pr-d-${lv}"></td><td class="n" id="m2-pr-s-${lv}"></td></tr>`).join('');
  return card('m2-sec-pyramid', t('m2.pyr.title'), `
    <p class="w2-sub">${tr('m2.pyr.sub')}</p>
    <div class="w2-row">${field('m2.pyr.w0', t('m2.pyr.w0'), 'px', { step: 1, min: 1 })}${field('m2.pyr.h0', t('m2.pyr.h0'), 'px', { step: 1, min: 1 })}
      <span class="w2-field"><span>${t('m2.pyr.order')}</span>${segBtns('m2.pyr.order', [['low-first', t('m2.pyr.orderLow')], ['high-first', t('m2.pyr.orderHigh')]])}</span></div>
    <div class="w2-row"><button type="button" class="btn btn-sm" data-action="m2-add-level">${t('m2.pyr.add')}</button><button type="button" class="btn btn-sm" data-action="m2-remove-level">${t('m2.pyr.remove')}</button>
      <button type="button" class="btn btn-sm" data-action="m2-preset" data-v="course">${t('m2.pyr.pCourse')}</button><button type="button" class="btn btn-sm" data-action="m2-preset" data-v="pow2">${t('m2.pyr.pPow2')}</button><button type="button" class="btn btn-sm" data-action="m2-preset" data-v="frac">${t('m2.pyr.pFrac')}</button></div>
    ${errBox('m2-err-pyr')}
    <div class="w2-scroll"><table class="w2-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    <div class="mp-stack" id="m2-stack" aria-hidden="true"></div>
    <div class="w2-info">${tr('m2.pyr.note')}</div>
    <div class="w2-sub">${prov('exact')} ${t('m2.prov.pyr')}</div>`);
}

function regionHTML() {
  const ds = m2().pyr.ds;
  return card('m2-sec-region', t('m2.reg.title'), `
    <p class="w2-sub">${tr('m2.reg.sub')}</p>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m2.reg.mode')}</span>${segBtns('m2.sel.mode', [['fov', t('m2.reg.modeFov')], ['px', t('m2.reg.modePx')]])}</div>
    <div class="w2-info" id="m2-reg-explain"></div>
    <div class="w2-row">${field('m2.sel.x', t('m2.reg.x'), 'px', { step: 1, min: 0 })}${field('m2.sel.y', t('m2.reg.y'), 'px', { step: 1, min: 0 })}${field('m2.sel.fovUm', t('m2.reg.fov'), 'µm', { min: 0.1, id: 'f-m2-fov' })}${field('m2.sel.px', t('m2.reg.px'), 'px', { step: 1, min: 1, id: 'f-m2-px' })}</div>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m2.reg.level')}</span>${segBtns('m2.sel.level', ds.map((_, i) => [i, String(i)]), true)}</div>
    ${errBox('m2-err-reg')}
    <canvas id="m2-mini" class="w2-canvas" width="360" height="240" tabindex="0" role="img" aria-label="${t('m2.reg.miniAria')}"></canvas>
    <div class="w2-sub">${t('m2.reg.miniHint')}</div>
    <div class="w2-scroll"><table class="w2-table"><thead><tr><th>${t('m2.reg.cLevel')}</th><th class="n">${t('m2.reg.cMpp')}</th><th class="n">${t('m2.reg.cSize')}</th><th class="n">${t('m2.reg.cFov')}</th><th class="n">${t('m2.reg.cExt0')}</th><th class="n">${t('m2.reg.cPos')}</th></tr></thead><tbody>${ds.map((_, i) => `<tr id="m2-rg-${i}"><td class="n" id="m2-rg-l-${i}"></td><td class="n" id="m2-rg-m-${i}"></td><td class="n" id="m2-rg-s-${i}"></td><td class="n" id="m2-rg-f-${i}"></td><td class="n" id="m2-rg-e-${i}"></td><td class="n" id="m2-rg-p-${i}"></td></tr>`).join('')}</tbody></table></div>
    <h4>${t('m2.reg.call')}</h4>${eq('<span id="m2-readregion"></span>')}
    <div class="w2-sub">${prov('exact')} ${t('m2.prov.region')}</div>`, '', 'w2-wide');
}

function patchHTML() {
  const ds = m2().pyr.ds;
  return card('m2-sec-patch', t('m2.cfg.title'), `
    <p class="w2-sub">${tr('m2.cfg.sub')}</p>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m2.cfg.level')}</span>${segBtns('m2.cfg.level', ds.map((_, i) => [i, String(i)]), true)}</div>
    <div class="w2-row">${field('m2.cfg.ext', t('m2.cfg.ext'), 'px', { step: 1, min: 1 })}${field('m2.cfg.tile', t('m2.cfg.tile'), 'px', { step: 1, min: 1 })}${field('m2.cfg.enc', t('m2.cfg.enc'), 'px', { step: 1, min: 1 })}${field('m2.cfg.stride', t('m2.cfg.stride'), 'px', { step: 1, min: 1 })}</div>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m2.cfg.border')}</span>${segBtns('m2.cfg.border', P.POLITICAS_BORDE.filter(p => p !== 'roi').map(p => [p, t(`m2.cfg.b.${p}`)]))}</div>
    ${errBox('m2-err-cfg')}
    <div id="m2-cfg-out"></div>
    <h4>${t('m2.cfg.chain')}</h4><div id="m2-cfg-chain" class="w2-sub"></div>
    <h4>${t('m2.cfg.target')}</h4>
    <div class="w2-row">${field('m2.cfgTargetMpp', t('m2.cfg.targetMpp'), 'µm/px', { min: 0.001 })}</div>
    <div id="m2-target-out"></div>
    <h4>${t('m2.cfg.json')}</h4>
    <div class="w2-row"><button type="button" class="btn btn-sm" data-action="m2-cfg-export">${t('m2.cfg.export')}</button><button type="button" class="btn btn-sm" data-action="m2-cfg-import">${t('m2.cfg.import')}</button></div>
    <textarea id="m2-cfg-json" class="w2-area" rows="8" spellcheck="false" aria-label="${t('m2.cfg.json')}"></textarea>
    ${errBox('m2-err-json')}
    <div class="w2-sub">${prov('exact')} ${t('m2.prov.cfg')}</div>`, '', 'w2-wide');
}

const FORMATS = ['svs', 'ndpi', 'mrxs', 'tiff', 'ometiff', 'dicom'];
function formatsHTML() {
  return card('m2-sec-formats', t('m2.fmt.title'), `
    <p class="w2-sub">${tr('m2.fmt.sub')}</p>
    <div class="w2-scroll"><table class="w2-table"><thead><tr><th>${t('m2.fmt.cFormat')}</th><th>${t('m2.fmt.cStruct')}</th><th>${t('m2.fmt.cComp')}</th><th>${t('m2.fmt.cMpp')}</th><th>${t('m2.fmt.cSource')}</th></tr></thead><tbody>
    ${FORMATS.map(k => `<tr><td><b>${t(`m2.fmt.${k}.name`)}</b><br><span class="pill">${t(`m2.fmt.${k}.ext`)}</span></td><td>${tr(`m2.fmt.${k}.struct`)}</td><td>${tr(`m2.fmt.${k}.comp`)}</td><td>${tr(`m2.fmt.${k}.mpp`)}</td><td>${t(`m2.fmt.${k}.src`)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="w2-warn">${t('m2.fmt.warn')}</div>
    <h4>${t('m2.fmt.sizeTitle')}</h4><div id="m2-size-out"></div>
    <div class="w2-sub">${prov('exact')} ${t('m2.prov.size')}</div>`, '', 'w2-wide');
}

function failHTML() {
  return card('m2-sec-fail', t('m2.fail.title'), `
    <p class="w2-sub">${tr('m2.fail.sub')}</p>
    <div class="w2-row">${field('m2.fail.mppA', t('m2.fail.mppA'), 'µm/px', { min: 0.01 })}${field('m2.fail.mppB', t('m2.fail.mppB'), 'µm/px', { min: 0.01 })}${field('m2.fail.px', t('m2.fail.px'), 'px', { step: 1, min: 8 })}</div>
    ${errBox('m2-err-fail')}
    <div class="w2-figs">
      <figure><canvas id="m2-fail-a" class="w2-canvas" width="224" height="224" role="img" aria-label="${t('m2.fail.aA')}"></canvas><figcaption id="m2-fail-ca"></figcaption></figure>
      <figure><canvas id="m2-fail-b" class="w2-canvas" width="224" height="224" role="img" aria-label="${t('m2.fail.aB')}"></canvas><figcaption id="m2-fail-cb"></figcaption></figure>
      <figure><canvas id="m2-fail-c" class="w2-canvas" width="224" height="224" role="img" aria-label="${t('m2.fail.aC')}"></canvas><figcaption id="m2-fail-cc"></figcaption></figure>
    </div>
    <div id="m2-fail-out"></div>
    <div class="w2-warn">${t('m2.fail.warn')}</div>
    <div class="w2-sub">${prov('exact')} ${t('m2.prov.fail')} ${prov('sim')} ${t('m2.prov.failSim')}</div>`, '', 'w2-wide');
}

export function workHTML() {
  return `<div class="w2-grid">${calibHTML()}${nucleusHTML()}</div>${pyramidHTML()}<div class="w2-grid">${regionHTML()}${patchHTML()}</div><div class="w2-grid">${failHTML()}${formatsHTML()}</div>`;
}

/* ---------------------------------------------------------------- actualización en vivo */
const safe = (id, fn) => { try { const r = fn(); showErr(id, null); return r; } catch (e) { if (e && e.name === 'PatchMathError') { showErr(id, e); return null; } throw e; } };
const pxTxt = o => `${nA(o.x)} × ${nA(o.y)}`;

function liveCalib() {
  const man = m2().mppSource === 'manual'; document.getElementById('m2-mpp-manual').hidden = !man;
  const sc = document.getElementById('m2-mpp-scanner'); sc.hidden = man;
  const prof = state.scannerProfile;
  sc.innerHTML = prof.mpp && prof.mpp.x ? `${t('m2.calib.scannerNote', { x: nA(prof.mpp.x), y: nA(prof.mpp.y), src: t(`m2.calib.src.${prof.mppSource}`) })} <button type="button" class="btn btn-sm" data-jump="scanner">${t('m2.calib.goM1')}</button>` : t('m2.calib.scannerMissing');
  const mpp = safe('m2-err-mpp', () => P.mppPorEje(mppNativo(), 'mppWsi'));
  if (!mpp) { put('m2-derived', ''); put('m2-ill-near', ''); return; }
  const ppi = P.mppAPpi(mpp), nyq = P.periodoMinimoResoluble(mpp), fs = P.frecuenciaNyquist(mpp);
  put('m2-derived', kv([
    [t('m2.calib.pxPerMm'), pv(`${nI(1000 / mpp.x)} × ${nI(1000 / mpp.y)} px/mm`, 'exact')],
    [t('m2.calib.ppi'), pv(`${nI(ppi.x)} × ${nI(ppi.y)} PPI`, 'exact')],
    [t('m2.calib.nyqPeriod'), pv(`${n3(nyq.x)} × ${n3(nyq.y)} µm`, 'exact')],
    [t('m2.calib.nyqFreq'), pv(`${n2(fs.x)} × ${n2(fs.y)} ${t('m2.calib.cyclesUm')}`, 'exact')],
    [t('m2.calib.aniso'), mpp.x === mpp.y ? t('m2.calib.isoYes') : `<span class="pill warn">${t('m2.calib.isoNo')}</span>`]
  ]));
  const near = P.TABLA_MPP_AUMENTO_ILUSTRATIVA.reduce((b, r) => (Math.abs(Math.log(r.mpp / mpp.x)) < Math.abs(Math.log(b.mpp / mpp.x)) ? r : b));
  const gap = Math.abs(near.mpp - mpp.x) / near.mpp;
  put('m2-ill-near', gap < 1e-9 ? t('m2.ill.same', { mpp: nA(mpp.x), mag: near.aumento }) : t('m2.ill.nearest', { mpp: nA(mpp.x), near: nA(near.mpp), mag: near.aumento }));
  // límites ópticos
  const o = m2().optics, op = safe('m2-err-optics', () => { const ab = P.limiteAbbe(o.lambdaNm, o.na), ra = P.limiteRayleigh(o.lambdaNm, o.na); return { ab, ra, ny: P.mppMaximoNyquist(ab), cmp: P.muestreoFrenteAlLimite(mpp.x, ab) }; });
  put('m2-optics-out', op ? kv([
    [t('m2.optics.abbe'), pv(`${n3(op.ab)} µm`, 'exact')], [t('m2.optics.rayleigh'), pv(`${n3(op.ra)} µm`, 'exact')],
    [t('m2.optics.maxMpp'), pv(`${n3(op.ny)} µm/px`, 'exact')],
    [t('m2.optics.verdict'), op.cmp.cumpleNyquist ? `<span class="pill ok">${t('m2.optics.ok')}</span>` : `<span class="pill warn">${t('m2.optics.under')}</span>`]
  ]) + `<p class="w2-sub">${t('m2.optics.caveat')}</p>` : '');
  liveAlias(mpp);
}

function liveAlias(mpp) {
  const cv = document.getElementById('m2-alias'); if (!cv) return;
  const per = m2().alias.periodUm, ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  if (!(per > 0) || !mpp) { put('m2-alias-out', ''); return; }
  const span = Math.max(per * 6, mpp.x * 14), f = 1 / per, fs = 1 / mpp.x, fa = Math.abs(f - Math.round(f / fs) * fs);
  const X = u => 8 + (u / span) * (W - 16), Y = v => H - 14 - v * (H - 34);
  ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, Y(0)); ctx.lineTo(W - 8, Y(0)); ctx.stroke();
  ctx.strokeStyle = '#4C3A7A'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i <= 400; i++) { const u = i / 400 * span, v = 0.5 + 0.5 * Math.sin(2 * Math.PI * u / per); if (i) ctx.lineTo(X(u), Y(v)); else ctx.moveTo(X(u), Y(v)); }
  ctx.stroke();
  ctx.fillStyle = '#BE123C'; const pts = [];
  for (let k = 0; (k + 0.5) * mpp.x < span; k++) { const u = (k + 0.5) * mpp.x, v = 0.5 + 0.5 * Math.sin(2 * Math.PI * u / per); pts.push([u, v]); ctx.beginPath(); ctx.arc(X(u), Y(v), 3, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = '#BE123C'; ctx.lineWidth = 1; ctx.beginPath(); pts.forEach(([u, v], i) => { if (i) ctx.lineTo(X(u), Y(v)); else ctx.moveTo(X(u), Y(v)); }); ctx.stroke();
  const alias = f > fs / 2;
  put('m2-alias-out', kv([
    [t('m2.alias.f'), pv(`${n3(f)} ${t('m2.calib.cyclesUm')}`, 'exact')], [t('m2.alias.fs'), pv(`${n3(fs)} ${t('m2.alias.samplesUm')}`, 'exact')],
    [t('m2.alias.apparent'), pv(alias ? `${n3(fa)} ${t('m2.calib.cyclesUm')} (${n3(fa > 0 ? 1 / fa : Infinity)} µm)` : t('m2.alias.none'), 'exact')],
    [t('m2.alias.verdict'), alias ? `<span class="pill warn">${t('m2.alias.yes')}</span>` : `<span class="pill ok">${t('m2.alias.no')}</span>`]
  ]));
}

function liveNucleus() {
  const n = m2().nuc, err = !(n.mpp >= MPP_MIN) || !(n.diam > 0) || !(n.cell > 0) || !(n.seed > 0);
  const e = document.getElementById('m2-err-nuc'); if (e) e.textContent = err ? t('m2.nuc.errInput', { min: nA(MPP_MIN) }) : '';
  if (err) { put('m2-nuc-out', ''); return; }
  const f = fuenteActual(), zoom = n.zoom, campo = FIELD_UM / zoom, mpp = n.mpp;
  const m = f.muestreada(mpp), src = document.getElementById('m2-nuc-src'), res = document.getElementById('m2-nuc-res'), third = document.getElementById('m2-nuc-third');
  const sctx = src.getContext('2d'); sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
  const sw = SRC_PXSIDE(zoom), sx0 = Math.floor((768 - sw) / 2); sctx.clearRect(0, 0, 248, 248); sctx.drawImage(f.canvas, sx0, sx0, sw, sw, 0, 0, 248, 248);
  const g = dibujarRecorte(res, m.data, m.n, zoom, { pixelado: true, rejilla: true });
  const bar = txt => u => `${fmt.auto(u)} µm`;
  dibujarBarra(src, campo, bar()); dibujarBarra(res, campo, bar());
  const diff = f.diferencia(mpp);
  const tctx = third.getContext('2d');
  if (n.view === 'resampled') { dibujarRecorte(third, m.data, m.n, zoom, { pixelado: false }); }
  else if (n.view === 'upsampled') { const c2 = document.createElement('canvas'); c2.width = 768; c2.height = 768; c2.getContext('2d').putImageData(diff.reampliada, 0, 0); tctx.imageSmoothingEnabled = true; tctx.clearRect(0, 0, 248, 248); tctx.drawImage(c2, sx0, sx0, sw, sw, 0, 0, 248, 248); }
  else { const c2 = document.createElement('canvas'); c2.width = 768; c2.height = 768; c2.getContext('2d').putImageData(diff.mapa, 0, 0); tctx.imageSmoothingEnabled = true; tctx.clearRect(0, 0, 248, 248); tctx.drawImage(c2, sx0, sx0, sw, sw, 0, 0, 248, 248); }
  dibujarBarra(third, campo, bar());
  put('m2-cap-src', `${t('m2.nuc.capSrc', { mpp: nA(SRC_MPP), px: 768 })} ${prov('sim')}`);
  put('m2-cap-res', `${t('m2.nuc.capRes', { mpp: nA(m.mppReal), px: m.n })} ${prov('image')}`);
  put('m2-cap-third', `${t(`m2.nuc.cap.${n.view}`)} ${prov('image')}`);
  // tira con la misma fuente a otros MPP
  MPP_PRESETS.forEach((v, i) => {
    const cv = document.getElementById(`m2-strip-${i}`), mm = f.muestreada(v); dibujarRecorte(cv, mm.data, mm.n, zoom, { pixelado: true });
    const px = P.pixelesNucleo(n.diam, v).x; put(`m2-strip-cap-${i}`, `${nA(v)} µm/px · ${mm.n} px<br>${t('m2.nuc.nucPx', { n: fmt.num(px, 1) })}`);
  });
  // cifras exactas
  const nuc = P.pixelesNucleo(n.diam, mpp), cel = P.pixelesNucleo(n.cell, mpp), gran = P.pixelesNucleo(0.5, mpp), per = P.periodoMinimoResoluble(mpp);
  put('m2-nuc-out', kv([
    [t('m2.nuc.oPhys'), pv(`${nA(n.diam)} µm ${t('m2.nuc.nucleus')} · ${nA(n.cell)} µm ${t('m2.nuc.cellW')}`, 'exact')],
    [t('m2.nuc.oNucPx'), pv(`${fmt.num(nuc.x, 1)} px ${t('m2.nuc.diameter')} · ${nI(nuc.areaPx)} px ${t('m2.nuc.area')}`, 'exact')],
    [t('m2.nuc.oCellPx'), pv(`${fmt.num(cel.x, 1)} px`, 'exact')],
    [t('m2.nuc.oGranule'), pv(`${fmt.num(gran.x, 2)} px`, 'exact')],
    [t('m2.nuc.oNyq'), pv(`${n3(per.x)} µm`, 'exact')],
    [t('m2.nuc.oField'), pv(`${nA(campo)} µm · ${t('m2.nuc.oPxScreen', { px: fmt.num(g.pxScreen, 1) })}`, 'exact')],
    [t('m2.nuc.oDiff'), pv(`${fmt.num(diff.media, 2)} / 255`, 'image')]
  ]));
}
const SRC_PXSIDE = zoom => Math.max(1, Math.round(768 / zoom));

function livePyramid() {
  const ds = m2().pyr.ds, pir = safe('m2-err-pyr', piramide);
  const n = ds.length;
  if (!pir) { ds.forEach((_, lv) => ['v', 'l', 'mx', 'my', 'd', 's'].forEach(k => put(`m2-pr-${k}-${lv}`, ''))); put('m2-stack', ''); return pir; }
  pir.forEach((p, lv) => {
    const vis = P.nivelOpenSlideAIndiceInterfaz(lv, n, orderEngine());
    put(`m2-pr-v-${lv}`, `<span class="pill">${t('m2.pyr.visual', { i: vis + 1 })}</span>`);
    put(`m2-pr-l-${lv}`, `<span class="pill ok">${lv}</span>`);
    put(`m2-pr-mx-${lv}`, n3(p.mpp.x)); put(`m2-pr-my-${lv}`, n3(p.mpp.y));
    put(`m2-pr-d-${lv}`, `${p.dimensiones ? '≈ ' + nI(p.dimensiones.x) + ' × ' + nI(p.dimensiones.y) : '-'}`);
    put(`m2-pr-s-${lv}`, p.dimensiones ? bytesTxt(p.dimensiones.x * p.dimensiones.y * 3) : '-');
    document.getElementById(`m2-pr-${lv}`).classList.toggle('hl', lv === m2().sel.level);
  });
  const rows = Array.from({ length: n }, (_, vis) => P.indiceInterfazANivelOpenSlide(vis, n, orderEngine()));
  put('m2-stack', rows.map((lv, vis) => { const p = pir[lv], w = Math.max(1.5, 100 / p.downsample); return `<div class="mp-lvl"><span class="mono">${t('m2.pyr.stackLbl', { vis: vis + 1, lv })}</span><div class="bar${lv === m2().sel.level ? ' sel' : ''}" style="width:${w}%"></div></div>`; }).join(''));
  return pir;
}

function liveRegion(pir) {
  const s = m2().sel, ex = document.getElementById('m2-reg-explain');
  ex.textContent = t(s.mode === 'fov' ? 'm2.reg.explainFov' : 'm2.reg.explainPx');
  document.getElementById('f-m2-fov').closest('label').hidden = s.mode !== 'fov'; document.getElementById('f-m2-px').closest('label').hidden = s.mode !== 'px';
  if (!pir) { showErr('m2-err-reg', null); put('m2-readregion', ''); return; }
  const out = safe('m2-err-reg', () => pir.map(p => {
    const tam = s.mode === 'fov' ? { w: Math.max(1, Math.round(s.fovUm / p.mpp.x)), h: Math.max(1, Math.round(s.fovUm / p.mpp.y)) } : { w: s.px, h: s.px };
    const reg = P.regionOpenSlide({ ubicacion0: { x: s.x, y: s.y }, downsampleNivel: p.downsample, tamano: tam });
    return { p, tam, reg, fov: { x: tam.w * p.mpp.x, y: tam.h * p.mpp.y } };
  }));
  if (!out) return;
  const inside = r => r.reg.origenNivel0.x + r.reg.extensionNivel0.x <= m2().pyr.w0 && r.reg.origenNivel0.y + r.reg.extensionNivel0.y <= m2().pyr.h0;
  out.forEach((r, i) => {
    put(`m2-rg-l-${i}`, String(i)); put(`m2-rg-m-${i}`, `${n3(r.p.mpp.x)} × ${n3(r.p.mpp.y)}`); put(`m2-rg-s-${i}`, `${nI(r.tam.w)} × ${nI(r.tam.h)}`);
    put(`m2-rg-f-${i}`, `${fmt.num(r.fov.x, 1)} × ${fmt.num(r.fov.y, 1)} µm`); put(`m2-rg-e-${i}`, `${nI(r.reg.extensionNivel0.x)} × ${nI(r.reg.extensionNivel0.y)}${inside(r) ? '' : ' !'}`);
    put(`m2-rg-p-${i}`, `${nI(r.reg.origenEnNivel.x)}, ${nI(r.reg.origenEnNivel.y)}`);
    document.getElementById(`m2-rg-${i}`).classList.toggle('hl', i === s.level);
  });
  const sel = out[Math.min(s.level, out.length - 1)];
  put('m2-readregion', `slide.read_region((${s.x}, ${s.y}), ${sel.p.nivel}, (${sel.tam.w}, ${sel.tam.h}))`);
  drawMini(sel);
}
function drawMini(sel) {
  const cv = document.getElementById('m2-mini'); if (!cv) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, { w0, h0 } = m2().pyr; ctx.clearRect(0, 0, W, H);
  const sc = Math.min((W - 8) / w0, (H - 8) / h0), ox = (W - w0 * sc) / 2, oy = (H - h0 * sc) / 2;
  try { ctx.imageSmoothingEnabled = true; ctx.drawImage(baseCanvas, ox, oy, w0 * sc, h0 * sc); } catch (e) { ctx.fillStyle = '#F6EEF3'; ctx.fillRect(ox, oy, w0 * sc, h0 * sc); }
  ctx.strokeStyle = '#94A3B8'; ctx.strokeRect(ox + 0.5, oy + 0.5, w0 * sc, h0 * sc);
  const e = sel.reg.extensionNivel0, rx = ox + m2().sel.x * sc, ry = oy + m2().sel.y * sc, rw = Math.max(4, e.x * sc), rh = Math.max(4, e.y * sc);
  ctx.strokeStyle = '#BE123C'; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw, rh); ctx.fillStyle = 'rgba(190,18,60,.18)'; ctx.fillRect(rx, ry, rw, rh);
  ctx.fillStyle = '#BE123C'; ctx.beginPath(); ctx.arc(rx, ry, 3, 0, 6.283); ctx.fill();
}

function liveCfg(pir) {
  const c = m2().cfg;
  if (!pir) { put('m2-cfg-out', ''); put('m2-cfg-chain', ''); put('m2-target-out', ''); return; }
  const lv = Math.min(c.level, pir.length - 1);
  const ev = safe('m2-err-cfg', () => P.evaluarPatchConfig({ mppOriginal: mppNativo(), nivel: lv, downsample: pir[lv].downsample, tamanoExtraccion: c.ext, tamanoTile: c.tile === null ? null : c.tile, entradaEncoder: c.enc, stride: c.stride, politicaBorde: c.border }));
  if (!ev) { put('m2-cfg-out', ''); put('m2-cfg-chain', ''); put('m2-target-out', ''); return; }
  const w = m2().pyr.w0 / pir[lv].downsample, h = m2().pyr.h0 / pir[lv].downsample;
  const til = safe('m2-err-cfg', () => P.numeroTiles(Math.floor(w), Math.floor(h), c.ext, c.stride, c.border));
  put('m2-cfg-out', kv([
    [t('m2.cfg.oMppExt'), pv(`${n3(ev.mppExtraccion.x)} × ${n3(ev.mppExtraccion.y)} µm/px`, 'exact')],
    [t('m2.cfg.oFov'), pv(`${fmt.num(ev.fov.x, 1)} × ${fmt.num(ev.fov.y, 1)} µm`, 'exact')],
    [t('m2.cfg.oMppTile'), pv(`${n3(ev.mppTile.x)} × ${n3(ev.mppTile.y)} µm/px`, 'exact')],
    [t('m2.cfg.oMppEnc'), pv(`${n3(ev.mppEncoder.x)} × ${n3(ev.mppEncoder.y)} µm/px`, 'exact')],
    [t('m2.cfg.oResize'), pv(`${n3(ev.factorResize.extraccionAEncoder.x)} × ${n3(ev.factorResize.extraccionAEncoder.y)}`, 'exact')],
    [t('m2.cfg.oPixels'), pv(`${nI(ev.reduccion.pixelesOrigen)} → ${nI(ev.reduccion.pixelesDestino)} (${fmt.num(ev.reduccion.reduccion * 100, 2)} %)`, 'exact')],
    [t('m2.cfg.oOverlap'), pv(`${fmt.num(ev.overlap.x * 100, 1)} % × ${fmt.num(ev.overlap.y * 100, 1)} %`, 'exact')],
    [t('m2.cfg.oTiles'), til ? pv(`${nI(til.total)} (${nI(til.nx)} × ${nI(til.ny)}) ${t('m2.cfg.theoretical')}`, 'exact') : '-']
  ]) + (ev.advertencias.length ? `<div class="w2-warn">${ev.advertencias.map(a => t(`m2.cfg.w.${a}`)).join('<br>')}</div>` : '') + `<p class="w2-sub">${t('m2.cfg.reduceWarn')}</p>`);
  put('m2-cfg-chain', `${t('m2.cfg.chainTxt', { l: lv, ds: nA(pir[lv].downsample), ext: c.ext, ex: n3(ev.mppExtraccion.x), tile: c.tile === null ? c.ext : c.tile, enc: c.enc, me: n3(ev.mppEncoder.x) })}`);
  // tamaño de parche para un MPP objetivo
  const tg = state.m2.cfgTargetMpp;
  const r = tg === undefined || tg === null ? null : safe('m2-err-cfg', () => P.tamanoParcheParaMpp(c.enc, tg, P.mppExtraccion(mppNativo(), pir[lv].downsample)));
  put('m2-target-out', r ? kv([
    [t('m2.cfg.tExact'), pv(`${fmt.num(r.exacto.x, 2)} × ${fmt.num(r.exacto.y, 2)} px`, 'exact')], [t('m2.cfg.tRound'), pv(`${nI(r.redondeado.x)} × ${nI(r.redondeado.y)} px`, 'exact')],
    [t('m2.cfg.tErr'), pv(`${fmt.num(r.errorMpp.x, 4)} µm/px (${fmt.num(r.errorRelativo.x * 100, 2)} %)`, 'exact')]
  ]) : `<p class="w2-sub">${t('m2.cfg.targetHint')}</p>`);
}

function liveFormats(pir) {
  if (!pir) { put('m2-size-out', ''); return; }
  const w = m2().pyr.w0, h = m2().pyr.h0, b0 = w * h * 3, total = pir.reduce((s, p) => s + (p.dimensiones ? p.dimensiones.x * p.dimensiones.y * 3 : 0), 0);
  const area = mppNativo(), mm = area ? { x: w * area.x / 1000, y: h * area.y / 1000 } : null;
  put('m2-size-out', kv([
    [t('m2.fmt.sLevel0'), pv(`${nI(w)} × ${nI(h)} px · ${bytesTxt(b0)}`, 'exact')],
    [t('m2.fmt.sPyramid'), pv(bytesTxt(total), 'exact')],
    [t('m2.fmt.sArea'), mm ? pv(`${fmt.num(mm.x, 1)} × ${fmt.num(mm.y, 1)} mm`, 'exact') : '-'],
    [t('m2.fmt.sPx'), pv(`${fmt.num(w * h / 1e9, 2)} Gpx`, 'exact')]
  ]) + `<p class="w2-sub">${t('m2.fmt.sNote')}</p>`);
}

function liveFail() {
  const f = m2().fail, mod = state.modality;
  const r = safe('m2-err-fail', () => {
    const a = P.fov(f.px, f.mppA), b = P.fov(f.px, f.mppB), fix = P.tamanoParcheParaMpp(f.px, f.mppB, f.mppA);
    return { a, b, fix, na: P.pixelesNucleo(9, f.mppA), nb: P.pixelesNucleo(9, f.mppB) };
  });
  if (!r) { put('m2-fail-out', ''); return; }
  const cells = escenaCelulas(), ca = document.getElementById('m2-fail-a'), cb = document.getElementById('m2-fail-b'), cc = document.getElementById('m2-fail-c');
  const center = { x: 0, y: 0 };
  dibujarEscena(ca, cells, f.mppA, f.px, center, mod); dibujarEscena(cb, cells, f.mppB, f.px, center, mod);
  dibujarBarra(ca, r.a.x, u => `${fmt.auto(u)} µm`); dibujarBarra(cb, r.b.x, u => `${fmt.auto(u)} µm`);
  // tercera imagen: la escena de A con el tamaño que cubre el mismo campo que B, remuestreada al tamaño de entrada por promedio de área
  const big = document.createElement('canvas'), side = r.fix.redondeado.x;
  if (side <= 2048) {
    dibujarEscena(big, cells, f.mppA, side, center, mod);
    const d = big.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, side, side);
    const out = remuestrearArea(d, side, side, f.px, f.px); cc.width = f.px; cc.height = f.px; cc.getContext('2d').putImageData(out, 0, 0); dibujarBarra(cc, r.b.x, u => `${fmt.auto(u)} µm`);
  }
  put('m2-fail-ca', `${t('m2.fail.capA', { mpp: nA(f.mppA), px: f.px, fov: fmt.num(r.a.x, 1) })} ${prov('sim')}`);
  put('m2-fail-cb', `${t('m2.fail.capB', { mpp: nA(f.mppB), px: f.px, fov: fmt.num(r.b.x, 1) })} ${prov('sim')}`);
  put('m2-fail-cc', `${t('m2.fail.capC', { side: nI(r.fix.redondeado.x), px: f.px, fov: fmt.num(r.b.x, 1) })} ${prov('image')}`);
  put('m2-fail-out', kv([
    [t('m2.fail.oFovA'), pv(`${fmt.num(r.a.x, 1)} µm`, 'exact')], [t('m2.fail.oFovB'), pv(`${fmt.num(r.b.x, 1)} µm`, 'exact')],
    [t('m2.fail.oRatio'), pv(`${fmt.num(r.b.x / r.a.x, 2)}×`, 'exact')],
    [t('m2.fail.oNuc'), pv(`${fmt.num(r.na.x, 1)} px / ${fmt.num(r.nb.x, 1)} px`, 'exact')],
    [t('m2.fail.oFix'), pv(`${nI(r.fix.redondeado.x)} px → ${f.px} px`, 'exact')]
  ]));
}

export function workLive() {
  liveCalib(); liveNucleus();
  const pir = livePyramid(); liveRegion(pir); liveCfg(pir); liveFormats(pir); liveFail();
}

/** Después de dibujar la estructura: clic y teclado sobre el minimapa de la lámina */
export function workAfterRender() {
  const ta = document.getElementById('m2-cfg-json');
  if (ta) { ta.value = jsonBuf.text; ta.addEventListener('input', () => { jsonBuf.text = ta.value; }); }
  const cv = document.getElementById('m2-mini'); if (!cv) return;
  const setPos = (x, y) => { const { w0, h0 } = m2().pyr; setState('m2.sel.x', Math.round(Math.min(w0 - 1, Math.max(0, x)))); setState('m2.sel.y', Math.round(Math.min(h0 - 1, Math.max(0, y)))); };
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(), { w0, h0 } = m2().pyr, W = cv.width, H = cv.height, sc = Math.min((W - 8) / w0, (H - 8) / h0), ox = (W - w0 * sc) / 2, oy = (H - h0 * sc) / 2;
    setPos(((e.clientX - r.left) * (W / r.width) - ox) / sc, ((e.clientY - r.top) * (H / r.height) - oy) / sc);
  });
  cv.addEventListener('keydown', e => {
    const step = Math.max(1, Math.round(m2().pyr.w0 / 40)), d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); setPos(m2().sel.x + d[0], m2().sel.y + d[1]); }
  });
}
