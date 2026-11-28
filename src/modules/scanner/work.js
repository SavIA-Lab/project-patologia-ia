/* M1 · espacio de trabajo 2D: muestra y tinción, cómo escanea un escáner genérico, salidas con procedencia, artefactos sobre imagen sintética,
 * familias genéricas, caso de fallo (dos escáneres con la misma lámina) y perfil de escáner compartido.
 * Cálculos exactos: src/engine/scanner-math.js. Procesamiento de imagen: ./sim.js. La estructura se dibuja una vez (html); los valores se actualizan (live). */
import { state } from '../../engine/state.js';
import * as S from '../../engine/scanner-math.js';
import { pixelesNucleo } from '../../engine/patch-math.js';
import { baseCanvas } from '../../engine/textures.js';
import { t, fmt } from '../../i18n/index.js';
import { tr } from '../../ui/glossary.js';
import { prov, pv } from '../../ui/provenance.js';
import { tog, FMT } from '../../ui/widgets.js';
import { card, field, segBtns, errBox, showErr, kv, table, put } from '../../ui/work2d.js';
import * as SIM from './sim.js';

FMT['m1.progress'] = v => fmt.pct(v, 0);
const m1 = () => state.m1, perfil = () => state.scannerProfile;
const nA = v => fmt.auto(Math.round(v * 1e4) / 1e4), nI = v => fmt.int(Math.round(v));
const bytesTxt = b => (b >= 1e12 ? fmt.num(b / 1e12, 2) + ' TB' : b >= 1e9 ? fmt.num(b / 1e9, 2) + ' GB' : b >= 1e6 ? fmt.num(b / 1e6, 1) + ' MB' : fmt.int(b) + ' B');
export const tiempoTxt = s => (s >= 3600 ? `${fmt.num(s / 3600, 1)} h` : s >= 60 ? `${fmt.int(Math.floor(s / 60))} min ${fmt.int(Math.round(s % 60))} s` : `${fmt.num(s, 1)} s`);
const areaMm = () => [m1().area.w, m1().area.h];
const FAMS = ['high-volume', 'benchtop', 'low-cost', 'motorized'];

/** Entrada del perfil a partir de los controles (misma regla que el controlador), para mostrar el error exacto si un valor no es válido */
export const entradaDesdeControles = () => { const m = m1(); return { family: m.family, objective: m.objective, scanMode: m.scanMode, zPlanes: m.zPlanes, zStepUm: m.zStepUm, focusPoints: m.focusPoints, compression: { kind: m.compression }, ...(perfil().mppSource === 'user' ? { mpp: perfil().mpp } : {}) }; };

/* ---------- imágenes sintéticas: recortes de la textura base de la modalidad vigente ---------- */
let cacheSrc = new Map();
export const resetCache = () => { cacheSrc = new Map(); };
function ctx2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.getContext('2d', { willReadFrequently: true }); }
/** Recorte w×h de la textura base, tomado a 1:1 desde el centro (o escalado si se pide una escala distinta de 1). */
function recorte(w, h, escala = 1) {
  const key = `${state.modality}|${w}|${h}|${escala}`; if (cacheSrc.has(key)) return cacheSrc.get(key);
  const c = ctx2d(w, h), sw = w / escala, sh = h / escala;
  c.drawImage(baseCanvas, Math.max(0, (baseCanvas.width - sw) / 2), Math.max(0, (baseCanvas.height - sh) / 2), Math.min(sw, baseCanvas.width), Math.min(sh, baseCanvas.height), 0, 0, w, h);
  const img = c.getImageData(0, 0, w, h); cacheSrc.set(key, img); return img;
}
const pintar = (id, img) => { const cv = document.getElementById(id); if (!cv) return; if (cv.width !== img.width || cv.height !== img.height) { cv.width = img.width; cv.height = img.height; } cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); };

/* ---------------------------------------------------------------- estructura */
function sampleHTML() {
  return card('m1-sec-sample', t('m1.sample.title'), `
    <p class="w2-sub">${tr(`m1.sample.${state.modality}`)}</p>
    <div class="w2-row">${field('m1.area.w', t('m1.area.w'), 'mm', { min: 1 })}${field('m1.area.h', t('m1.area.h'), 'mm', { min: 1 })}</div>
    <div class="w2-warn" id="m1-area-warn" hidden>${t('m1.area.warn')}</div>
    <canvas id="m1-slide" class="w2-canvas" width="450" height="150" role="img" aria-label="${t('m1.slide.aria')}"></canvas>
    <p class="w2-sub">${t('m1.slide.note')}</p>
    <div class="w2-sub">${prov('image')} ${t('m1.prov.sample')}</div>`, '', 'w2-wide');
}

function scanHTML() {
  return card('m1-sec-scan', t('m1.scan.title'), `
    <p class="w2-sub">${tr('m1.scan.sub')}</p>
    <ol class="w2-steps">${[0, 1, 2, 3].map(i => `<li>${tr(`m1.scan.step.${i}`)}</li>`).join('')}</ol>
    <h4>${t('m1.ctl.title')}</h4>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m1.ctl.family')}</span>${segBtns('m1.family', FAMS.map(f => [f, t(`m1.fam.${f}`)]))}</div>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m1.ctl.objective')}</span>${segBtns('m1.objective', [[20, '20×'], [40, '40×']], true)}
      <span class="w2-sub" style="margin:0">${t('m1.ctl.mode')}</span>${segBtns('m1.scanMode', [['area', t('m1.mode.area')], ['line', t('m1.mode.line')]])}</div>
    <div class="w2-row">${field('m1.zPlanes', t('m1.ctl.zPlanes'), '', { step: 1, min: 1 })}${field('m1.zStepUm', t('m1.ctl.zStep'), 'µm', { min: 0.01 })}${field('m1.focusPoints', t('m1.ctl.focus'), '', { step: 1, min: 0 })}</div>
    <div class="w2-row"><span class="w2-sub" style="margin:0">${t('m1.ctl.compression')}</span>${segBtns('m1.compression', [['none', t('m1.comp.none')], ['lossless', t('m1.comp.lossless')], ['lossy', t('m1.comp.lossy')]])}</div>
    <div class="w2-row">${field('scannerProfile.mpp.x', t('m1.ctl.mppX'), 'µm/px', { min: 0.001 })}${field('scannerProfile.mpp.y', t('m1.ctl.mppY'), 'µm/px', { min: 0.001 })}
      <button type="button" class="btn btn-sm" data-action="m1-reset-mpp">${t('m1.ctl.mppReset')}</button></div>
    <div class="w2-info" id="m1-mpp-note"></div>
    ${errBox('m1-err-ctl')}
    <label class="w2-field"><span>${t('m1.ctl.progress')} <b data-valfor="m1.progress"></b></span><input type="range" min="0" max="1" step="0.01" data-slider="m1.progress" data-scale="1" aria-label="${t('m1.ctl.progress')}"></label>
    <canvas id="m1-scan" class="w2-canvas" width="512" height="256" role="img" aria-label="${t('m1.scan.aria')}"></canvas>
    <div id="m1-scan-out" class="w2-sub"></div>`, '', 'w2-wide');
}

function outHTML() {
  return card('m1-sec-out', t('m1.out.title'), `
    <p class="w2-sub">${tr('m1.out.sub')}</p>
    <div id="m1-out"></div>
    <div class="w2-warn">${t('m1.out.warn')}</div>
    <div class="w2-sub">${prov('exact')} ${t('m1.prov.exact')} ${prov('sim')} ${t('m1.prov.sim')}</div>`, '', 'w2-wide');
}

function artHTML() {
  return card('m1-sec-art', t('m1.art.title'), `
    <p class="w2-sub">${tr('m1.art.sub')}</p>
    <div class="w2-row">${tog('m1.seams', t('m1.art.seams'), t('m1.art.seamsHint'))}${tog('m1.banding', t('m1.art.banding'), t('m1.art.bandingHint'))}${tog('m1.strips', t('m1.art.strips'), t('m1.art.stripsHint'))}${tog('m1.cast', t('m1.art.cast'), t('m1.art.castHint'))}</div>
    <canvas id="m1-art" class="w2-canvas" width="480" height="288" role="img" aria-label="${t('m1.art.aria')}"></canvas>
    <div id="m1-art-out"></div>
    <h4>${t('m1.z.title')}</h4>
    <p class="w2-sub">${tr('m1.z.sub')}</p>
    <canvas id="m1-z" class="w2-canvas" width="440" height="120" role="img" aria-label="${t('m1.z.aria')}"></canvas>
    <div id="m1-z-out"></div>
    <div class="w2-sub">${prov('image')} ${t('m1.prov.art')} ${prov('sim')} ${t('m1.prov.artSim')}</div>`, '', 'w2-wide');
}

function typesHTML() {
  const rows = FAMS.map(f => { const d = S.FAMILIA_DEFECTOS[f]; return { hl: f === m1().family, cells: [`<b>${t(`m1.fam.${f}`)}</b><br><span class="w2-sub">${t(`m1.fam.${f}.desc`)}</span>`, `${d.frame.w} × ${d.frame.h}`, fmt.pct(d.overlap, 0), nI(d.msField), nI(d.linesPerSecond), `${fmt.num(d.color.sat, 2)} / ${fmt.num(d.color.gamma, 2)}`] }; });
  return card('m1-sec-types', t('m1.types.title'), `
    <p class="w2-sub">${tr('m1.types.sub')}</p>
    ${table([t('m1.types.family'), { t: t('m1.types.frame'), n: true }, { t: t('m1.types.overlap'), n: true }, { t: t('m1.types.msField'), n: true }, { t: t('m1.types.lps'), n: true }, { t: t('m1.types.color'), n: true }], rows, 'fam')}
    <div class="w2-warn">${t('m1.types.warn')}</div>
    <div class="w2-sub">${prov('sim')} ${t('m1.prov.types')}</div>`, '', 'w2-wide');
}

function failHTML() {
  return card('m1-sec-fail', t('m1.fail.title'), `
    <p class="w2-sub">${tr('m1.fail.sub')}</p>
    <div class="m1-pair"><figure><canvas id="m1-fail-a" class="w2-canvas" width="240" height="160" role="img" aria-label="${t('m1.fail.ariaA')}"></canvas><figcaption id="m1-fail-capA"></figcaption></figure>
      <figure><canvas id="m1-fail-b" class="w2-canvas" width="240" height="160" role="img" aria-label="${t('m1.fail.ariaB')}"></canvas><figcaption id="m1-fail-capB"></figcaption></figure></div>
    <div id="m1-fail-out"></div>
    <div class="w2-sub">${prov('image')} ${t('m1.prov.fail')} ${prov('exact')} ${t('m1.prov.failExact')}</div>`, '', 'w2-wide');
}

function profileHTML() {
  return card('m1-sec-profile', t('m1.profile.title'), `
    <p class="w2-sub">${tr('m1.profile.sub')}</p>
    <textarea id="m1-profile-json" class="w2-area" rows="10" spellcheck="false" aria-label="${t('m1.profile.aria')}"></textarea>
    <div class="w2-row"><button type="button" class="btn btn-sm" data-action="m1-profile-export">${t('m1.profile.export')}</button><button type="button" class="btn btn-sm" data-action="m1-profile-import">${t('m1.profile.import')}</button></div>
    ${errBox('m1-err-json')}
    <div class="w2-sub">${t('m1.profile.note')}</div>`, '', 'w2-wide');
}

export const profileBuf = { text: '' };
export const workHTML = () => `<div class="w2-grid">${sampleHTML()}${scanHTML()}${outHTML()}${artHTML()}${typesHTML()}${failHTML()}${profileHTML()}</div>`;

/* ---------------------------------------------------------------- actualización de valores */
function liveSample() {
  const a = m1().area, c = document.getElementById('m1-slide'); if (!c) return;
  const warn = document.getElementById('m1-area-warn'); if (warn) warn.hidden = !(a.w > 48 || a.h > 22);
  const g = c.getContext('2d'), px = 6, W = c.width, H = c.height; g.clearRect(0, 0, W, H);
  g.fillStyle = '#EEF2F6'; g.strokeStyle = '#94A3B8'; g.lineWidth = 1; g.fillRect(0.5, 0.5, W - 1, H - 1); g.strokeRect(0.5, 0.5, W - 1, H - 1);
  g.fillStyle = '#E2E8F0'; g.fillRect(6, 10, 66, H - 20); g.fillStyle = '#475569'; g.font = '11px sans-serif'; g.fillText(t('m1.slide.label'), 10, 28);
  const tw = Math.min(a.w, 48) * px, th = Math.min(a.h, 22) * px, x0 = 84, y0 = (H - th) / 2;
  g.drawImage(baseCanvas, 0, 0, baseCanvas.width, baseCanvas.height, x0, y0, tw, th);
  g.strokeStyle = '#4C3A7A'; g.setLineDash([4, 3]); g.strokeRect(x0 - 0.5, y0 - 0.5, tw + 1, th + 1); g.setLineDash([]);
  g.fillStyle = '#334155'; g.fillText(`${fmt.num(a.w, 1)} × ${fmt.num(a.h, 1)} mm`, x0, Math.max(11, y0 - 4));
}

function orden(i, nx) { const r = Math.floor(i / nx), c = i % nx; return { r, c: r % 2 ? nx - 1 - c : c }; }
function liveScan(c, p) {
  const cv = document.getElementById('m1-scan'); if (!cv) return;
  const a = m1().area, W = 512, H = Math.round(Math.min(380, Math.max(120, W * a.h / a.w)));
  if (cv.height !== H) cv.height = H;
  const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
  const ar = a.w / a.h, sw = Math.min(baseCanvas.width, baseCanvas.height * ar), sh = sw / ar;
  g.drawImage(baseCanvas, (baseCanvas.width - sw) / 2, (baseCanvas.height - sh) / 2, sw, sh, 0, 0, W, H);
  const prog = m1().progress, cw = W / (c.imagenPx.x / c.strideX), ch = H / (c.imagenPx.y / c.strideY);
  const wCell = Math.min(W, c.perfilW / c.imagenPx.x * W), hCell = Math.min(H, c.perfilH / c.imagenPx.y * H);
  g.lineWidth = 1;
  if (c.modo === 'line') {
    const n = c.franjas, done = Math.floor(prog * n);
    for (let i = 0; i < n; i++) {
      const x = Math.min(W - wCell, i * cw); g.fillStyle = i < done ? 'rgba(15,118,110,.30)' : 'rgba(255,255,255,.06)'; g.fillRect(x, 0, wCell, H);
      g.strokeStyle = i === done && prog < 1 ? '#BE123C' : 'rgba(15,118,110,.8)'; g.lineWidth = i === done && prog < 1 ? 2 : 1; g.strokeRect(x + 0.5, 0.5, wCell - 1, H - 1);
    }
  } else {
    const total = c.campos, done = Math.floor(prog * total), paso = total > 900 ? Math.ceil(total / 900) : 1;
    for (let i = 0; i < total; i += paso) {
      const { r, c: col } = orden(i, c.nx), x = Math.min(W - wCell, col * cw), y = Math.min(H - hCell, r * ch);
      g.fillStyle = i < done ? 'rgba(15,118,110,.30)' : 'rgba(255,255,255,.04)'; g.fillRect(x, y, wCell, hCell);
      g.strokeStyle = 'rgba(15,118,110,.55)'; g.strokeRect(x + 0.5, y + 0.5, wCell - 1, hCell - 1);
    }
    if (done < total) { const { r, c: col } = orden(done, c.nx), x = Math.min(W - wCell, col * cw), y = Math.min(H - hCell, r * ch); g.strokeStyle = '#BE123C'; g.lineWidth = 2.5; g.strokeRect(x + 1, y + 1, wCell - 2, hCell - 2); }
  }
  const out = document.getElementById('m1-scan-out'), done = c.modo === 'line' ? Math.floor(prog * c.franjas) : Math.floor(prog * c.campos);
  const txt = c.modo === 'line' ? t('m1.scan.progLine', { done: nI(done), n: nI(c.franjas), lines: nI(c.lineasPorFranja) }) : t('m1.scan.progArea', { done: nI(done), n: nI(c.campos), nx: nI(c.nx), ny: nI(c.ny) });
  if (out && out.textContent !== txt) out.textContent = txt;
}

function liveOut() {
  let o = null, c = null, err = null;
  try { o = S.salidasEscaneo(entradaDesdeControles(), areaMm()); c = S.camposDelEscaneo(perfil(), areaMm()); } catch (e) { err = e; }
  showErr('m1-err-ctl', err);
  const mppNote = document.getElementById('m1-mpp-note');
  if (mppNote) { const n = t(perfil().mppSource === 'user' ? 'm1.ctl.mppUser' : 'm1.ctl.mppDefault', { obj: perfil().objective }); if (mppNote.textContent !== n) mppNote.textContent = n; }
  if (!o) { put('m1-out', `<div class="w2-err" role="status">${t('m1.out.none')}</div>`); return null; }
  const p = perfil(), ex = o.exacto, si = o.simulado, mppT = `${nA(p.mpp.x)}${p.mpp.x === p.mpp.y ? '' : ' × ' + nA(p.mpp.y)} µm/px`;
  const rows = [
    [t('m1.out.mpp'), pv(mppT, 'sim'), t(p.mppSource === 'user' ? 'm1.out.mppUser' : 'm1.out.mppDefault')],
    [t('m1.out.imagePx'), pv(`${nI(ex.imagenPx.x)} × ${nI(ex.imagenPx.y)} px`, 'exact'), `${fmt.num(ex.imagenPx.x * ex.imagenPx.y / 1e9, 2)} Gpx`],
    [t('m1.out.fields'), pv(nI(ex.campos), 'exact'), ex.modo === 'line' ? t('m1.out.fieldsLine', { n: nI(ex.franjas), lines: nI(ex.imagenPx.y) }) : t('m1.out.fieldsArea', { nx: nI(ex.nx), ny: nI(ex.ny) })],
    [t('m1.out.fov'), pv(`${fmt.num(ex.campoUm.x, 0)} × ${fmt.num(ex.campoUm.y, 0)} µm`, 'exact'), t('m1.out.fovNote', { w: p.frame.w, h: p.frame.h })],
    [t('m1.out.mosaic'), pv(`${nI(ex.mosaicoPx.x)} × ${nI(ex.mosaicoPx.y)} px`, 'exact'), t('m1.out.mosaicNote')],
    [t('m1.out.zdepth'), pv(`${fmt.num(ex.profundidadZUm, 2)} µm`, 'exact'), t('m1.out.zNote', { n: ex.planosZ })],
    [t('m1.out.raw'), pv(bytesTxt(ex.bytesSinComprimir), 'exact'), t('m1.out.rawNote')],
    [t('m1.out.time'), pv(tiempoTxt(si.segundos), 'sim'), t('m1.out.timeNote')],
    [t('m1.out.comp'), pv(bytesTxt(si.bytesComprimidos), 'sim'), t('m1.out.compNote', { r: fmt.num(si.razonCompresion, 0) })]
  ];
  put('m1-out', table([t('m1.out.magnitude'), t('m1.out.value'), t('m1.out.detail')], rows, 'out'));
  return { o, c };
}

/** Dibuja el perfil de relieve del tejido y los planos Z (la profundidad que cubren frente al relieve) */
function liveZ() {
  const cv = document.getElementById('m1-z'); if (!cv) return;
  const p = perfil(), g = cv.getContext('2d'), W = cv.width, H = cv.height, D = SIM.RELIEVE_UM + 2, y = d => 10 + (H - 20) * (d / D);
  g.clearRect(0, 0, W, H); g.strokeStyle = '#4C3A7A'; g.lineWidth = 2; g.beginPath();
  for (let x = 0; x <= W; x += 4) { const d = 1 + (SIM.RELIEVE_UM / 2) * (0.5 + 0.5 * Math.sin(x / 38) * Math.cos(x / 97)); x ? g.lineTo(x, y(d)) : g.moveTo(x, y(d)); }
  g.stroke();
  const top = Math.max(0, 1 + SIM.RELIEVE_UM / 4 - (p.zPlanes - 1) * p.zStepUm / 2);
  for (let i = 0; i < Math.min(p.zPlanes, 40); i++) { const d = top + i * p.zStepUm; g.fillStyle = 'rgba(15,118,110,.22)'; g.fillRect(0, y(d - SIM.DOF_UM / 2), W, Math.max(2, y(d + SIM.DOF_UM / 2) - y(d - SIM.DOF_UM / 2))); g.strokeStyle = '#0F766E'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y(d)); g.lineTo(W, y(d)); g.stroke(); }
  g.fillStyle = '#334155'; g.font = '11px sans-serif'; g.fillText(t('m1.z.axis'), 6, H - 4);
  const d = SIM.parametrosDesenfoque(p);
  put('m1-z-out', kv([[t('m1.z.covered'), pv(`${fmt.num(d.cubiertoUm, 2)} µm`, 'exact')], [t('m1.z.relief'), pv(`${fmt.num(SIM.RELIEVE_UM, 1)} µm`, 'sim')], [t('m1.z.severity'), pv(fmt.pct(d.severidad, 0), 'sim')]]));
}

function liveArt() {
  const cv = document.getElementById('m1-art'); if (!cv) return;
  const p = perfil(), rej = SIM.rejillaVista(p, 480, 4, 3), src = recorte(rej.W, rej.H);
  const banderas = { seams: m1().seams, banding: m1().banding, strips: m1().strips, cast: m1().cast };
  const res = SIM.procesarArtefactos(src, p, banderas, rej);
  pintar('m1-art', res);
  // marcas sobre los campos desenfocados
  const g = cv.getContext('2d'); g.lineWidth = 1; g.strokeStyle = 'rgba(15,118,110,.45)';
  for (const rc of rej.rects) g.strokeRect(rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1);
  g.strokeStyle = '#BE123C'; g.lineWidth = 2; for (const i of res.afectados) { const rc = rej.rects[i]; g.strokeRect(rc.x + 1, rc.y + 1, rc.w - 2, rc.h - 2); }
  const rows = [];
  const buena = rej.rects.findIndex((_, i) => !res.afectados.includes(i));
  if (banderas.strips) {
    const mala = res.afectados[0];
    rows.push([t('m1.art.oof'), pv(`${nI(res.afectados.length)} / ${nI(rej.rects.length)}`, 'sim'), t('m1.art.oofNote', { r: res.desenfoque.radio })]);
    if (mala !== undefined && buena >= 0) {
      const a = SIM.varianzaLaplaciano(res, rej.rects[buena]), b = SIM.varianzaLaplaciano(res, rej.rects[mala]);
      rows.push([t('m1.art.lap'), pv(`${nI(a)} → ${nI(b)}`, 'image'), t('m1.art.lapNote')]);
    }
  }
  if (banderas.cast) { const a = SIM.mediaRGB(src), b = SIM.mediaRGB(res); rows.push([t('m1.art.cast'), pv(`Δ RGB = ${nI(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))}`, 'image'), t('m1.art.castNote')]); }
  if (banderas.seams) rows.push([t('m1.art.seams'), pv(t('m1.art.seamsVal', { n: nI(rej.rects.length) }), 'sim'), t('m1.art.seamsNote')]);
  if (banderas.banding) rows.push([t('m1.art.banding'), pv(t(rej.linea ? 'm1.art.bandCols' : 'm1.art.bandRows'), 'sim'), t('m1.art.bandNote')]);
  put('m1-art-out', rows.length ? table([t('m1.out.magnitude'), t('m1.out.value'), t('m1.out.detail')], rows, 'art') : `<p class="w2-sub">${t('m1.art.none')}</p>`);
}

function liveFail() {
  const A = S.crearPerfil({ family: 'high-volume', objective: 40 }), B = S.crearPerfil({ family: 'low-cost', objective: 20 });
  const W = 240, H = 160, escalaB = A.mpp.x / B.mpp.x, src = recorte(W, H);
  const imgA = { data: new Uint8ClampedArray(src.data), width: W, height: H }; SIM.aplicarColor(imgA.data, A.color);
  const cs = ctx2d(Math.max(1, Math.round(W * escalaB)), Math.max(1, Math.round(H * escalaB))); const tmp = ctx2d(W, H); tmp.putImageData(src, 0, 0);
  cs.imageSmoothingEnabled = true; cs.drawImage(tmp.canvas, 0, 0, cs.canvas.width, cs.canvas.height);
  const up = ctx2d(W, H); up.imageSmoothingEnabled = true; up.drawImage(cs.canvas, 0, 0, W, H);
  const imgB = up.getImageData(0, 0, W, H); SIM.aplicarColor(imgB.data, B.color);
  pintar('m1-fail-a', imgA); pintar('m1-fail-b', imgB);
  const capA = document.getElementById('m1-fail-capA'), capB = document.getElementById('m1-fail-capB');
  const txtA = t('m1.fail.capA', { mpp: nA(A.mpp.x) }), txtB = t('m1.fail.capB', { mpp: nA(B.mpp.x) });
  if (capA && capA.textContent !== txtA) capA.textContent = txtA; if (capB && capB.textContent !== txtB) capB.textContent = txtB;
  const nuc = 9, pa = pixelesNucleo(nuc, A.mpp), pb = pixelesNucleo(nuc, B.mpp), ma = SIM.mediaRGB(imgA), mb = SIM.mediaRGB(imgB);
  const rows = [
    [t('m1.fail.nuc', { d: nuc }), pv(`${fmt.num(pa.x, 1)} px`, 'exact'), pv(`${fmt.num(pb.x, 1)} px`, 'exact')],
    [t('m1.fail.patch'), pv(`${fmt.num(224 * A.mpp.x, 0)} µm`, 'exact'), pv(`${fmt.num(224 * B.mpp.x, 0)} µm`, 'exact')],
    [t('m1.fail.mean'), pv(ma.map(nI).join(', '), 'image'), pv(mb.map(nI).join(', '), 'image')],
    [t('m1.fail.delta'), pv(`Δ RGB = ${nI(Math.hypot(ma[0] - mb[0], ma[1] - mb[1], ma[2] - mb[2]))}`, 'image'), '']
  ];
  put('m1-fail-out', `${table(['', t('m1.fail.colA'), t('m1.fail.colB')], rows, 'fail')}<div class="w2-warn">${t('m1.fail.warn')}</div>`);
}

export function workLive() {
  liveSample();
  const r = liveOut();
  if (r) { const p = perfil(); liveScan({ ...r.c, perfilW: p.frame.w, perfilH: p.frame.h }, p); }
  liveArt(); liveZ(); liveFail();
}

export function workAfterRender() {
  const ta = document.getElementById('m1-profile-json');
  if (ta) { ta.value = profileBuf.text; ta.addEventListener('input', () => { profileBuf.text = ta.value; }); }
}
