/* Quiz conceptual. Migrado de la v3.0 (p5_ui.js §20). Las preguntas salen del registro de módulos (cada módulo declara
 * sus preguntas y la opción correcta); los textos salen de los diccionarios: quiz.<id>.q, quiz.<id>.o.<i>, quiz.<id>.e.
 * El progreso no depende del idioma, así que cambiar de idioma con el quiz abierto lo conserva. */
import { QUIZ_QUESTIONS } from '../modules/registry.js';
import { $ } from './dom.js';
import { t } from '../i18n/index.js';

const freshQuiz = () => ({ i: 0, score: 0, answered: false, sel: -1, done: false });
export let quiz = freshQuiz();
let lastFocus = null;
const isOpen = () => $('#quiz-modal').classList.contains('show');

export function openQuiz(reset) {
  if (reset) quiz = freshQuiz();
  lastFocus = document.activeElement; $('#quiz-modal').classList.add('show'); renderQuiz();
}
export function closeQuiz() { $('#quiz-modal').classList.remove('show'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
export function refreshQuizIfOpen() { if (isOpen()) renderQuiz(true); }

export function renderQuiz(keepFocus) {
  const m = $('#quiz-modal'), N = QUIZ_QUESTIONS.length, L = 'ABCD';
  let h;
  if (quiz.done) {
    const pct = Math.round(quiz.score / N * 100);
    h = `<div class="quiz-card"><div class="quiz-top"><span class="kicker" id="quiz-title">${t('quiz.resultTitle')}</span></div>
      <div class="quiz-prog"><div style="width:100%"></div></div>
      <div style="text-align:center;padding:14px 0 6px"><div class="score-big" style="font-size:44px;color:${pct >= 75 ? 'var(--teal)' : pct >= 50 ? 'var(--amber)' : 'var(--crimson)'}">${quiz.score} / ${N}</div>
      <p style="color:var(--ink2);margin:6px 0 0">${t(pct >= 87 ? 'quiz.result.high' : pct >= 62 ? 'quiz.result.mid' : 'quiz.result.low')}</p></div>
      <div class="quiz-nav"><button type="button" class="btn" data-q="close">${t('quiz.close')}</button><button type="button" class="btn btn-hema" data-q="retry">${t('quiz.retry')}</button></div></div>`;
  } else {
    const Q = QUIZ_QUESTIONS[quiz.i], id = Q.id;
    h = `<div class="quiz-card"><div class="quiz-top"><span class="kicker" id="quiz-title">${t('quiz.question', { i: quiz.i + 1, n: N })}</span><span class="mono" style="font-size:12px;color:var(--ink2)">${t('quiz.score', { s: quiz.score })}</span></div>
      <div class="quiz-prog"><div style="width:${(quiz.i + (quiz.answered ? 1 : 0)) / N * 100}%"></div></div>
      <p class="quiz-q">${t(`quiz.${id}.q`)}</p>
      ${[0, 1, 2, 3].map(i => { let c = ''; if (quiz.answered) c = i === Q.correct ? 'ok' : (i === quiz.sel ? 'no' : ''); return `<button type="button" class="quiz-opt ${c}" data-qopt="${i}" ${quiz.answered ? 'disabled' : ''}><span class="lt">${L[i]}</span><span>${t(`quiz.${id}.o.${i}`)}</span></button>`; }).join('')}
      ${quiz.answered ? `<div class="quiz-fb ${quiz.sel === Q.correct ? 'ok' : 'no'}"><b>${t(quiz.sel === Q.correct ? 'quiz.right' : 'quiz.wrong')}</b> ${t(`quiz.${id}.e`)}</div>` : ''}
      <div class="quiz-nav"><button type="button" class="btn" data-q="close">${t('quiz.exit')}</button>${quiz.answered ? `<button type="button" class="btn btn-hema" data-q="next">${t(quiz.i === N - 1 ? 'quiz.seeResult' : 'quiz.next')}</button>` : '<span></span>'}</div></div>`;
  }
  const focusedOpt = keepFocus && document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.qopt : undefined;
  m.innerHTML = h;
  const f = (focusedOpt !== undefined && m.querySelector(`[data-qopt="${focusedOpt}"]:not([disabled])`)) || m.querySelector('.btn-hema, .quiz-opt:not([disabled])');
  if (f) f.focus({ preventScroll: true });
}
export function bindQuiz() {
  $('#quiz-modal').addEventListener('click', e => {
    if (e.target.id === 'quiz-modal') return closeQuiz();
    const o = e.target.closest('[data-qopt]');
    if (o && !quiz.answered) { quiz.sel = +o.dataset.qopt; quiz.answered = true; if (quiz.sel === QUIZ_QUESTIONS[quiz.i].correct) quiz.score++; renderQuiz(); return; }
    const b = e.target.closest('[data-q]'); if (!b) return;
    if (b.dataset.q === 'close') closeQuiz();
    else if (b.dataset.q === 'retry') { quiz = freshQuiz(); renderQuiz(); }
    else if (b.dataset.q === 'next') { if (quiz.i === QUIZ_QUESTIONS.length - 1) quiz.done = true; else { quiz.i++; quiz.answered = false; quiz.sel = -1; } renderQuiz(); }
  });
}
