/* Secciones comunes de los módulos nuevos (M0, M1, M2): objetivos, predicción previa, guía del docente y referencias.
 * El texto sale de los diccionarios con claves module.<id>.*, ref.<clave> y teacher.<id>.*. */
import { t, has } from '../i18n/index.js';
import { tr } from './glossary.js';
import { section, ul, ol } from './work2d.js';

export const objectivesHTML = meta => `<div class="sec"><h3>${t('common.objectives')}</h3>${ol(meta.objectives.map(k => tr(k)))}
  <p class="w2-sub">${t('common.estTime', { min: meta.minutes })}${meta.prerequisites && meta.prerequisites.length ? ' · ' + t('common.prereq') + ': ' + meta.prerequisites.map(p => t(`module.${p}.nav`)).join(', ') : ''}</p></div>`;

/** Predicción previa: una pregunta con tres opciones. `path` es la ruta del estado (-1 = sin responder) y `correct` el índice correcto. */
export function predictionHTML(id, path, count = 3) {
  const opts = Array.from({ length: count }, (_, i) => `<button type="button" class="pred-opt" data-set="${path}" data-value="${i}" data-num="1" aria-pressed="false">${t(`module.${id}.pred.o${i}`)}</button>`).join('');
  return `<div class="sec"><h3>${t('common.prediction')}</h3><p class="w2-sub">${tr(`module.${id}.pred.q`)}</p><div class="pred-opts" role="group" aria-label="${t('common.prediction')}">${opts}</div><div class="w2-info" id="${id}-pred-fb" hidden></div></div>`;
}
export function predictionLive(id, value, correct) {
  const fb = document.getElementById(`${id}-pred-fb`); if (!fb) return;
  document.querySelectorAll(`#editorial-sidebar .pred-opt`).forEach((b, i) => { b.setAttribute('aria-pressed', value === i ? 'true' : 'false'); b.classList.toggle('on', value === i); });
  if (value < 0) { fb.hidden = true; return; }
  fb.hidden = false; fb.className = value === correct ? 'w2-info' : 'w2-warn';
  fb.innerHTML = `<b>${t(value === correct ? 'common.predOk' : 'common.predNo')}</b> ${tr(`module.${id}.pred.fb`)}`;
}

/** Guía del docente: tiempo, conocimientos previos, secuencia, preguntas de discusión y errores frecuentes */
export function teacherHTML(id, nSteps, nDisc, nErr) {
  const list = (p, n) => ul(Array.from({ length: n }, (_, i) => tr(`teacher.${id}.${p}.${i}`)));
  return section(`${id}-teacher`, t('common.teacherGuide'), `
    <p class="w2-sub">${tr(`teacher.${id}.intro`)}</p>
    <h4>${t('common.teacherSteps')}</h4>${ol(Array.from({ length: nSteps }, (_, i) => tr(`teacher.${id}.step.${i}`)))}
    <h4>${t('common.teacherDiscuss')}</h4>${list('disc', nDisc)}
    <h4>${t('common.teacherErrors')}</h4>${list('err', nErr)}
    <p class="w2-sub">${tr(`teacher.${id}.assess`)}</p>`);
}

export const referencesHTML = meta => `<div class="sec"><h3>${t('common.references')}</h3><ol class="refs">${meta.references.map(k => `<li>${has(`ref.${k}`) ? t(`ref.${k}`) : k}</li>`).join('')}</ol></div>`;
