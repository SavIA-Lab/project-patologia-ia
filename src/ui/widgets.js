/* Plantillas HTML del panel lateral (segmentos, interruptores, deslizadores, métricas).
 * Migradas de la v3.0 (p5_ui.js §15). Los textos llegan ya traducidos. */
import { fmt } from '../i18n/index.js';

export const seg = (key, opts, num) => `<div class="seg-sm" role="group">${opts.map(([v, l]) => `<button type="button" data-set="${key}" data-value="${v}"${num ? ' data-num="1"' : ''}>${l}</button>`).join('')}</div>`;
export const tog = (path, label, hint, cls = '') => `<label class="toggle-row"><span><b>${label}</b>${hint ? `<em>${hint}</em>` : ''}</span><input type="checkbox" class="switch ${cls}" data-toggle="${path}"></label>`;
export const sld = (key, label, min, max, step, scale) => `<div class="ctl"><div class="ctl-label"><span>${label}</span><span class="val" data-valfor="${key}"></span></div><input type="range" min="${min}" max="${max}" step="${step}" data-slider="${key}" data-scale="${scale}"></div>`;
export const metric = (id, label, sub = '', cls = '') => `<div class="metric ${cls}" id="m-${id}"><div class="ml">${label}</div><div class="mv" id="${id}">-</div>${sub ? `<div class="ms">${sub}</div>` : ''}</div>`;

/** Formato del valor mostrado junto a cada deslizador */
export const FMT = {
  dilution: v => fmt.pct(v, 1), explode: v => fmt.pct(v, 0),
  heatOpacity: v => fmt.pct(v, 0), heatThreshold: v => fmt.num(v, 2), tau: v => fmt.num(v, 2)
};
export const fmtBytes = gb => gb >= 1 ? fmt.num(gb, 1) + ' GB' : fmt.num(gb * 1000, 0) + ' MB';
