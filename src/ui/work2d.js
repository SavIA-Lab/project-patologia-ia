/* Piezas del espacio de trabajo 2D (M0, M1, M2): tarjetas, campos numéricos, tablas, secciones plegables, código y errores del motor.
 * Todo el texto llega ya traducido. Los campos numéricos usan data-field="ruta.del.estado" (los gestiona el controlador). */
import { t } from '../i18n/index.js';
import { PatchMathError } from '../engine/patch-math.js';
import { $ } from './dom.js';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const card = (id, title, body, sub = '', cls = '') => `<section class="w2-card ${cls}" id="${id}" aria-labelledby="${id}-h"><h3 id="${id}-h">${title}</h3>${sub ? `<p class="w2-sub">${sub}</p>` : ''}${body}</section>`;
export const field = (path, label, unit = '', { step = 'any', min = '', id = '' } = {}) => {
  const fid = id || `f-${path.replace(/[^\w]/g, '-')}`;
  return `<label class="w2-field" for="${fid}"><span>${label}</span><input id="${fid}" type="number" inputmode="decimal" step="${step}" ${min !== '' ? `min="${min}"` : ''} data-field="${path}">${unit ? `<em>${unit}</em>` : ''}</label>`;
};
export const selectField = (path, label, options) => `<label class="w2-field"><span>${label}</span><select data-field-select="${path}">${options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>`;
export const segBtns = (path, opts, num) => `<div class="seg-sm" role="group">${opts.map(([v, l]) => `<button type="button" data-set="${path}" data-value="${v}"${num ? ' data-num="1"' : ''}>${l}</button>`).join('')}</div>`;
export const errBox = id => `<div class="w2-err" id="${id}" role="alert"></div>`;
export const errMsg = e => (e instanceof PatchMathError ? t(`err.${e.code}`, { field: e.field || '' }) : String(e && e.message || e));
/** Muestra el error del motor (o lo borra) y devuelve true si lo hubo */
export function showErr(id, e) { const el = document.getElementById(id); if (el) el.textContent = e ? errMsg(e) : ''; return !!e; }
export const kv = rows => `<dl class="w2-kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
export const table = (head, rows, cls = '') => `<div class="w2-scroll"><table class="w2-table ${cls}"><thead><tr>${head.map(h => `<th${h.n ? ' class="n"' : ''}>${h.t ?? h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr${r.hl ? ' class="hl"' : ''}>${(r.cells || r).map((c, i) => `<td${head[i] && head[i].n ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const section = (id, title, body, open = false) => `<details class="sec-d" id="${id}"${open ? ' open' : ''}><summary>${title}</summary><div class="sec-b">${body}</div></details>`;
export const ul = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
export const ol = items => `<ol>${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
export const codeBlock = (title, code, note = '') => `<div class="code-block"><div class="cb-h"><span>${title}</span>${note ? `<span>${note}</span>` : ''}</div><pre><code>${esc(code)}</code></pre></div>`;
export const eq = s => `<code class="eq">${s}</code>`;
/** Fija texto por id solo si cambió (evita parpadeo) */
export const put = (id, html) => { const el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
void $;
