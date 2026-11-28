/* Utilidades de interfaz: selectores, texto en vivo, barras, aviso breve (toast) y error fatal.
 * Migradas de la v3.0 (p5_ui.js §13). */
import { clamp } from '../engine/util.js';
import { t } from '../i18n/index.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const setText = (id, txt) => { const e = document.getElementById(id); if (e && e.textContent !== String(txt)) e.textContent = txt; };
export const setBar = (id, f) => { const e = document.getElementById(id); if (e) e.style.width = (clamp(f) * 100).toFixed(1) + '%'; };

let toastTimer = 0;
/** Aviso breve. `key` es una clave de i18n; `params` sustituye {nombre}. */
export function toast(key, params) {
  const el = $('#toast'); el.textContent = t(key, params); el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
export function showFatal(err) {
  console.error(err);
  $('#fatal').classList.add('show'); $('#fatal-msg').textContent = (err && err.message) ? err.message : String(err);
}
