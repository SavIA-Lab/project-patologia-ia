/* Elementos de interfaz que rodean al visor 3D: textos fijos traducidos, navegación, panel lateral, leyenda,
 * trazabilidad del parche y banner del reto. Migrado de la v3.0 (p5_ui.js §14-16) con los textos en src/i18n. */
import { state, dirty, getPath, hooks } from '../engine/state.js';
import { MODALITIES, modName, modDiagnosis } from '../engine/modalities.js';
import { tileTypeLabel } from '../engine/bio.js';
import { MODULES } from '../modules/registry.js';
import { active, activeMeta } from './active.js';
import { $, $$ } from '../ui/dom.js';
import { FMT } from '../ui/widgets.js';
import { t, fmt, getLang } from '../i18n/index.js';

/* ---------- Textos fijos del HTML (data-i18n) ---------- */
export function applyStaticI18n() {
  const lang = getLang();
  document.documentElement.lang = lang === 'pseudo' ? 'en' : lang;
  document.title = t('app.documentTitle');
  $$('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  $$('[data-i18n-title]').forEach(e => { e.title = t(e.dataset.i18nTitle); });
  $$('[data-i18n-aria]').forEach(e => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
  $$('[data-i18n-html]').forEach(e => { e.innerHTML = t(e.dataset.i18nHtml); });
  const desc = document.querySelector('meta[name="description"]'); if (desc) desc.content = t('app.description');
  // Etiqueta de borrador del inglés (D22): visible mientras el inglés no tenga revisor. No se retira desde el código.
  const draft = $('#draft-label'); if (draft) draft.hidden = lang !== 'en';
  $$('[data-lang]').forEach(b => { const on = b.dataset.lang === lang; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
}

/* ---------- Navegación entre módulos ---------- */
export function renderStageNav() {
  const nav = $('#stage-nav');
  nav.innerHTML = MODULES.map((m, i) => `<button type="button" class="stage-btn" data-stage="${i + 1}" aria-label="${i + 1}. ${t(m.nav)}"><span class="num">${i + 1}</span><span class="lbl">${i + 1}. ${t(m.nav)}</span></button>`).join('');
}

/* ---------- Panel lateral ---------- */
function headHTML(n) {
  const meta = MODULES[n - 1], M = MODALITIES[state.modality], key = 'module.' + meta.id;
  return `<div class="kicker">${t('common.stage', { n, total: MODULES.length })}</div>
    <h2 class="stage-title">${t(key + '.title')}</h2>
    <p class="stage-sub">${t(key + '.sub')}</p>
    <span class="mod-pill"><i style="background:${M.accent}"></i>${modName(M)} · ${modDiagnosis(M)}</span> <span class="sim-tag">${t('common.simulated')}</span>
    <div class="prose">${[0, 1].map(i => `<p>${t(key + '.body.' + state.modality + '.' + i)}</p>`).join('')}</div>
    <div class="sec"><h3>${t('common.keyFormula')}</h3><div class="math-box">${t(key + '.formula')}</div></div>`;
}
export function renderSidebar(keepScroll) {
  const sb = $('#editorial-sidebar'), mod = active(); if (!mod) return;
  const top = sb.scrollTop, n = state.stage;
  sb.innerHTML = headHTML(n) + mod.panel.html() + `<div class="foot mono">${t('common.footer')}</div>`;
  sb.scrollTop = keepScroll ? top : 0;
  syncControls();
  dirty.sidebarLive = true;
  if (mod.panel.afterRender) dirty.top3Thumbs = true;
}
export function syncControls() {
  $$('[data-set]').forEach(b => {
    const cur = String(getPath(state, b.dataset.set)), on = cur === b.dataset.value;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  $$('[data-toggle]').forEach(i => { i.checked = !!getPath(state, i.dataset.toggle); });
  $$('[data-slider]').forEach(i => {
    const key = i.dataset.slider, sc = parseFloat(i.dataset.scale || 1), v = getPath(state, key);
    if (document.activeElement !== i) i.value = Math.round(v / sc * 1000) / 1000;
    const lab = document.querySelector(`[data-valfor="${key}"]`); if (lab) lab.textContent = (FMT[key] || (x => x))(v);
  });
  $$('.stage-btn').forEach(b => { const on = +b.dataset.stage === state.stage; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
}
export function updateSidebarLive() { const mod = active(); if (mod && mod.panel.live) mod.panel.live(); }

/* ---------- Leyenda ---------- */
export function updateLegend() {
  const mod = active(); if (!mod) return;
  $('#legend').innerHTML = mod.legend();
  $('#stage-badge').textContent = t('common.stageBadge', { n: state.stage, total: MODULES.length, nav: t(activeMeta().nav) });
}

/* ---------- Trazabilidad del parche fijado ---------- */
let hudSig = '';
hooks.resetHud = () => { hudSig = ''; };
export function updateHUD() {
  const hud = $('#trace-hud'), p = state.pinned, mod = active();
  if (!p || state.stage < 2 || !mod || !mod.trace) { hud.classList.remove('show'); hudSig = ''; return; }
  const n = state.stage, { st, cls } = mod.trace(p);
  const sig = [n, p.col, p.row, p.thumbnailDataUrl.length, st, state.aggregator, p.qcStatus, getLang()].join('|');
  hud.classList.add('show');
  if (sig === hudSig) return; hudSig = sig;
  hud.innerHTML = `<div class="hud-head"><span class="hud-title">${t('hud.title')}</span><button type="button" class="btn btn-sm" data-action="unpin" style="padding:2px 8px">${t('hud.unpin')}</button></div>
    <div class="hud-body"><img class="hud-thumb" src="${p.thumbnailDataUrl}" alt="${t('hud.thumbAlt')}"><div class="hud-info mono"><div><span class="k">(col, row)</span> (${p.col}, ${p.row})</div><div><span class="k">${t('hud.type')}</span> ${tileTypeLabel(p.tileType)}</div><div><span class="k">${t('hud.atypia')}</span> ${fmt.num(p.atypia, 2)}</div><div><span class="k">u,v</span> ${fmt.num(p.u, 3)}, ${fmt.num(p.v, 3)}</div></div></div>
    <div class="hud-state ${cls}">${st}</div>
    <div class="hud-links">${MODULES.map((m, i) => i === 0 ? '' : `<button type="button" data-goto="${i + 1}" class="${i + 1 === n ? 'cur' : ''}">${t('hud.stageShort', { n: i + 1 })}</button>`).join('')}</div>`;
}

/* ---------- Banner del reto ---------- */
let bannerSig = '';
export function resetBanner() { bannerSig = ''; }
export function updateBanner() {
  const b = $('#challenge-banner'), mod = active(), html = mod && mod.banner ? mod.banner() : null;
  if (!html) { b.classList.remove('show'); bannerSig = ''; return; }
  const sig = getLang() + '|' + html;
  b.classList.add('show'); if (sig === bannerSig) return; bannerSig = sig;
  b.innerHTML = html;
}
export function resetHudSig() { hudSig = ''; }
