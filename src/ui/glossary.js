/* Glosario con ventanas emergentes. Los términos salen del diccionario (gloss.<clave>.term y gloss.<clave>.def)
 * y coinciden con docs/glosario-es-en.md. En el texto, [[clave]] se convierte en un botón que abre la definición. */
import { t, has } from '../i18n/index.js';
import { $ } from './dom.js';

/** Claves del glosario de M0, M1 y M2, en orden de aparición */
export const GLOSSARY = [
  'wsi', 'pyramid', 'level0', 'downsample', 'mpp', 'nominal-magnification', 'digital-zoom', 'optical-resolution', 'nyquist', 'aliasing',
  'dpi', 'field-of-view', 'tile', 'patch', 'encoder', 'embedding', 'mil', 'qc', 'stain', 'scanner', 'focus-map', 'stitching', 'z-plane',
  'compression', 'read-region', 'ome-tiff', 'dicom-wsi', 'resize', 'provenance'
];
export const g = key => `<button type="button" class="gl" data-gloss="${key}" aria-expanded="false" aria-controls="gloss-pop">${t(`gloss.${key}.term`)}</button>`;
/** Sustituye [[clave]] por el botón del glosario (si la clave existe). En modo pseudo no hay marcadores, así que no cambia nada. */
export const rich = s => String(s).replace(/\[\[([\w-]+)\]\]/g, (m, k) => (has(`gloss.${k}.term`) ? g(k) : m));
export const tr = (key, params) => rich(t(key, params));

let pop = null, openFor = null;
function ensurePop() {
  if (!pop) { pop = document.createElement('div'); pop.id = 'gloss-pop'; pop.setAttribute('role', 'status'); pop.hidden = true; document.body.appendChild(pop); }
  return pop;
}
export function closeGloss() {
  if (pop) pop.hidden = true;
  if (openFor) { openFor.setAttribute('aria-expanded', 'false'); openFor = null; }
}
function openGloss(btn) {
  const p = ensurePop(), key = btn.dataset.gloss;
  p.innerHTML = `<b>${t(`gloss.${key}.term`)}</b>${t(`gloss.${key}.def`)}`;
  p.hidden = false; btn.setAttribute('aria-expanded', 'true'); openFor = btn;
  const r = btn.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  let x = Math.min(Math.max(8, r.left), window.innerWidth - w - 8), y = r.bottom + 6;
  if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
  p.style.left = x + 'px'; p.style.top = y + 'px';
}
export function bindGlossary() {
  document.addEventListener('click', e => {
    const b = e.target.closest('.gl');
    if (b) { if (openFor === b) closeGloss(); else { closeGloss(); openGloss(b); } return; }
    if (!e.target.closest('#gloss-pop')) closeGloss();
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && openFor) { const b = openFor; closeGloss(); b.focus(); } });
  window.addEventListener('scroll', closeGloss, true);
}
export const refreshGlossary = closeGloss;
void $;
