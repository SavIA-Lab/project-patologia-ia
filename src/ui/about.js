/* Pantalla "Acerca de": autoría, institución, herramienta usada y qué es y qué no es real en la simulación.
 * El logotipo de SavIA Lab es un marcador hasta que el director entregue el archivo (decisión D19). Sin logotipos de universidad. */
import { $ } from './dom.js';
import { t } from '../i18n/index.js';
import { RELEASE, REPO_URL } from '../app/version.js';

let lastFocus = null;
const isOpen = () => $('#about-modal').classList.contains('show');

export function renderAbout() {
  const REAL = [0, 1], NOT_REAL = [0, 1, 2, 3];
  $('#about-modal').innerHTML = `<div class="about-card" role="document">
    <div class="quiz-top"><span class="kicker" id="about-title">${t('about.title')}</span><button type="button" class="btn btn-sm" data-about="close" aria-label="${t('about.close')}">${t('about.close')}</button></div>
    <div class="about-head">
      <div class="logo-slot" role="img" aria-label="${t('about.logoAlt')}"><span>SavIA Lab</span></div>
      <div><h2 class="stage-title" style="margin:0">${t('app.title')}</h2><p class="stage-sub" style="margin:2px 0 0">${t('about.subtitle')} · <span class="mono">${RELEASE}</span></p></div>
    </div>
    <span class="sim-tag">${t('common.simulated')}</span>
    <div class="sec"><h3>${t('about.authorHead')}</h3>
      <p>${t('about.author')}</p>
      <p>${t('about.affiliation')}</p></div>
    <div class="sec"><h3>${t('about.toolHead')}</h3><p>${t('about.tool')}</p></div>
    <div class="sec"><h3>${t('about.realHead')}</h3>
      <div class="about-cols">
        <div><h4>${t('about.isReal')}</h4><ul>${REAL.map(i => `<li>${t('about.real.' + i)}</li>`).join('')}</ul></div>
        <div><h4>${t('about.isNotReal')}</h4><ul>${NOT_REAL.map(i => `<li>${t('about.notReal.' + i)}</li>`).join('')}</ul></div>
      </div></div>
    <div class="sec"><h3>${t('about.rightsHead')}</h3><p>${t('about.rights')}</p>
      <p><a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${t('about.repo')}</a></p></div>
    <div class="quiz-nav"><span></span><button type="button" class="btn btn-hema" data-about="close">${t('about.close')}</button></div>
  </div>`;
}
export function openAbout() { lastFocus = document.activeElement; renderAbout(); $('#about-modal').classList.add('show'); const f = $('#about-modal .btn-hema'); if (f) f.focus({ preventScroll: true }); }
export function closeAbout() { $('#about-modal').classList.remove('show'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
export function refreshAboutIfOpen() { if (isOpen()) renderAbout(); }
export function bindAbout() {
  $('#about-modal').addEventListener('click', e => { if (e.target.id === 'about-modal' || e.target.closest('[data-about="close"]')) closeAbout(); });
}
