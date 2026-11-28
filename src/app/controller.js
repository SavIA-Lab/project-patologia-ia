/* Controlador de la aplicación: estado compartido, cambio de modalidad y de módulo, bucle de recálculo y de dibujo,
 * eventos del visor y cambio de idioma en caliente. Migrado de la v3.0 (p5_ui.js §18-21).
 * Cambios respecto de la v3.0: los módulos se cargan bajo demanda; los datos del pipeline (teselas, bolsa MIL, nube UMAP,
 * mapa de calor) se calculan aquí aunque el módulo no esté cargado; el cambio de idioma regenera todo el texto sin tocar el estado. */
import {
  THREE, renderer, scene, camera, controls, raycaster, pointer, camTween, initThree, stepCamTween, flyToPreset, relabelSprites, disposeObjectTree, stageGroups
} from '../engine/scene.js';
import { state, dirty, pipeline, hooks, getPath, setPathVal, markArtifactsChanged } from '../engine/state.js';
import { MODALITIES, modName } from '../engine/modalities.js';
import { baseCanvas, generateBaseModalityCanvas, rebuildCompositeTexture, rebuildSlideLabelTexture } from '../engine/textures.js';
import {
  syncTileGrid, computeTileInfos, rebuildUmapData, recomputeBagRank, computeBag, computeMIL, updateUmapTargets, computeHeatField
} from '../engine/pipeline.js';
import { MODULES, loadModuleDefinition } from '../modules/registry.js';
import { crearPerfil } from '../engine/scanner-math.js';
import { loaded, active, callHooks, isStage } from './active.js';
import { refreshPinned, pinQuick, unpin } from './pin.js';
import {
  applyStaticI18n, renderStageNav, renderSidebar, syncControls, updateSidebarLive, updateLegend, updateHUD, updateBanner, resetBanner, resetHudSig
} from './chrome.js';
import { $, toast, showFatal } from '../ui/dom.js';
import { pointerPx, showTooltip, hideTooltip } from '../ui/tooltip.js';
import { openQuiz, closeQuiz, bindQuiz, refreshQuizIfOpen, quiz } from '../ui/quiz.js';
import { openAbout, closeAbout, bindAbout, refreshAboutIfOpen } from '../ui/about.js';
import { bindGlossary, refreshGlossary } from '../ui/glossary.js';
import { RELEASE } from './version.js';
import { initLang, setLang, onLangChange, getLang, t, fmt } from '../i18n/index.js';

/* =====================================================================
   Estado y cambios
   ===================================================================== */
export function setState(path, value) {
  const old = getPath(state, path); if (old === value) return;
  setPathVal(state, path, value);
  onStateChange(path);
  syncControls();
}
function onStateChange(path) {
  if (path === 'modality') return changeModality();
  if (path.startsWith('scannerProfile.mpp')) { state.scannerProfile.mppSource = 'user'; state.m1.mppEdited = true; dirty.sidebarLive = true; }
  else if (path.startsWith('m1.')) { state.scannerProfile = profileFromM1(); dirty.sidebarLive = true; dirty.legend = true; }
  else if (path.startsWith('m2.') || path === 'scannerProfile' || path === 'track') { dirty.sidebarLive = true; if (path === 'track') renderStageNav(); }
  else if (path === 'patchSize') { syncTileGrid(); callHooks('rebuildTiles'); dirty.tiles = true; dirty.sidebarLive = true; }
  else if (path === 'discardBg' || path === 'explode') { dirty.tilesVisual = true; }
  else if (path.startsWith('artifacts.') || path === 'qcOn') { markArtifactsChanged(); dirty.legend = true; }
  else if (path === 'encoderTrained' || path === 'normMode' || path === 'umapColor') { dirty.umap = true; dirty.sidebarLive = true; dirty.legend = true; }
  else if (['aggregator', 'groundTruth', 'dilution', 'distractor'].includes(path)) { dirty.mil = true; dirty.sidebarLive = true; }
  else if (path === 'heatOpacity') callHooks('heatVisibility');
  else if (path === 'heatThreshold' || path === 'heatScale') { dirty.heatColor = true; dirty.sidebarLive = true; dirty.legend = true; }
  else if (path === 'tau') dirty.sidebarLive = true;
}
function changeModality() {
  const M = MODALITIES[state.modality];
  state.dilution = M.defaultDilution; state.selectedTop3 = -1;
  state.challenge = { active: false, pins: [], revealed: false, result: null };
  generateBaseModalityCanvas(state.modality, baseCanvas);
  rebuildCompositeTexture(); rebuildSlideLabelTexture();
  rebuildUmapData(); recomputeBagRank();
  pipeline.bio = null;
  callHooks('modality');
  dirty.composite = false; dirty.tiles = true; dirty.bag = true; dirty.mil = true; dirty.umap = true; dirty.heat = true; dirty.heatColor = true; dirty.sidebarLive = true; dirty.legend = true; dirty.top3Thumbs = true;
  resetHudSig(); resetBanner();
  renderSidebar(true); updateLegend();
  toast('app.toast.modality', { name: modName(M), dil: fmt.pct(M.defaultDilution, 1) });
}

/* =====================================================================
   Módulos y navegación
   ===================================================================== */
let stageSeq = 0;
async function ensureModule(id) {
  if (loaded.has(id)) return loaded.get(id);
  const def = await loadModuleDefinition(id);
  if (!loaded.has(id)) loaded.set(id, def.create());   // `create` abre el grupo 3D del módulo y lo construye con el estado actual
  return loaded.get(id);
}
export async function setStage(n, instant) {
  n = Math.max(1, Math.min(MODULES.length, n));
  const seq = ++stageSeq, meta = MODULES[n - 1], is2d = meta.kind === '2d';
  let mod;
  try { mod = await ensureModule(meta.id); } catch (err) { showFatal(err); return; }
  if (seq !== stageSeq) return;    // se pidió otra etapa mientras cargaba esta
  state.stage = n;
  loaded.forEach((m, id) => { if (stageGroups[id]) stageGroups[id].visible = id === meta.id; });
  $('#viewport').classList.toggle('is-2d', is2d); $('#gl-host').hidden = is2d; $('#work2d').hidden = !is2d;
  $('#cam-center').hidden = is2d;
  if (camera && !is2d) flyToPreset(meta.camera, instant ? 0.01 : 0.9);
  if (mod.leave) mod.leave();
  hideTooltip();
  dirty.heat = true; dirty.heatColor = true; dirty.sidebarLive = true; dirty.top3Thumbs = true; dirty.legend = true;
  resetHudSig(); resetBanner();
  renderSidebar(false); updateLegend(); updateBanner();
  $('#cam-prev').disabled = n === 1; $('#cam-next').disabled = n === MODULES.length;
  syncControls();
}
/** Perfil de escáner derivado de los controles de M1 (dato compartido). Un MPP editado a mano se conserva al cambiar de objetivo solo si el usuario lo fijó. */
function profileFromM1() {
  const m = state.m1, cur = state.scannerProfile;
  const keepMpp = m.mppEdited && cur && cur.mppSource === 'user';
  const input = { family: m.family, objective: m.objective, scanMode: m.scanMode, zPlanes: m.zPlanes, zStepUm: m.zStepUm, focusPoints: m.focusPoints, compression: { kind: m.compression } };
  if (keepMpp) input.mpp = cur.mpp;
  try { return crearPerfil(input); } catch (err) { return cur; }
}
export async function gotoModule(n, anchor) {
  await setStage(n);
  if (anchor) { const el = document.getElementById(anchor); if (el) { el.scrollIntoView({ block: 'start' }); if (el.focus) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } } }
}
const moduleIndexById = id => MODULES.findIndex(m => m.id === id);
function handleAction(a, el) {
  if (a === 'pin-atypical') pinQuick('atypical');
  else if (a === 'pin-healthy') pinQuick('healthy');
  else if (a === 'pin-artifact') pinQuick('artifact');
  else if (a === 'unpin') unpin();
  else if (a === 'tau-preset') setState('tau', parseFloat(el.dataset.v));
  else {
    const mod = active(), fn = mod && mod.actions && mod.actions[a];
    if (fn && fn(el)) { renderSidebar(true); dirty.legend = true; }
  }
}

/* =====================================================================
   Bucle de recálculo y de dibujo
   ===================================================================== */
export function processDirty() {
  if (dirty.composite) { dirty.composite = false; rebuildCompositeTexture(); dirty.sidebarLive = true; if (pipeline.umap) pipeline.umap.hospThumbKey = ''; }
  if (dirty.tiles) { dirty.tiles = false; computeTileInfos(); callHooks('tiles'); refreshPinned(); dirty.sidebarLive = true; }
  if (dirty.tilesVisual) { dirty.tilesVisual = false; callHooks('tilesVisual'); }
  if (dirty.bag) { dirty.bag = false; computeBag(); dirty.mil = true; }
  if (dirty.mil) { dirty.mil = false; computeMIL(); callHooks('mil'); dirty.heat = true; dirty.sidebarLive = true; }
  if (dirty.umap) { dirty.umap = false; updateUmapTargets(); callHooks('umap'); dirty.sidebarLive = true; dirty.legend = true; }
  const mod = active();
  if (isStage('xai-threshold') && dirty.heat) { dirty.heat = false; computeHeatField(); }
  if (isStage('xai-threshold') && dirty.heatColor) callHooks('heatColor');
  if (dirty.top3Thumbs && mod && mod.panel.afterRender) { dirty.top3Thumbs = false; mod.panel.afterRender(); }
  if (dirty.legend) { dirty.legend = false; updateLegend(); }
  if (dirty.sidebarLive) { dirty.sidebarLive = false; updateSidebarLive(); updateHUD(); updateBanner(); }
}
hooks.processDirty = processDirty;
hooks.renderSidebar = renderSidebar;

const clock = new THREE.Clock();
let liveTick = 0, pointerIn = false, hoverDirty = false, dragging = false;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta()), tm = clock.elapsedTime;
  processDirty();
  stepCamTween(dt); controls.update();
  const mod = active();
  if (mod) {
    if (mod.animate) mod.animate(dt, tm);
    if (mod.liveInterval) { liveTick += dt; if (liveTick > mod.liveInterval) { liveTick = 0; dirty.sidebarLive = true; } }
  }
  if (hoverDirty || (mod && mod.hoverEveryFrame)) { if (pointerIn) runHover(); hoverDirty = false; }
  if (!mod || mod.kind !== '2d') renderer.render(scene, camera);
}

/* =====================================================================
   Interacción 3D
   ===================================================================== */
function runHover() {
  hoverDirty = false;
  if (!pointerIn || dragging || camTween.active) return;
  raycaster.setFromCamera(pointer, camera);
  const mod = active(), res = mod && mod.hover ? mod.hover(raycaster) : null;
  if (res) showTooltip(res.tip); else $('#tooltip').style.display = 'none';
  renderer.domElement.style.cursor = (res && res.cursor) || 'grab';
}
function handleViewportClick() {
  if (camTween.active) return;
  raycaster.setFromCamera(pointer, camera);
  const mod = active(); if (!mod || !mod.click) return;
  if (mod.click(raycaster) === 'rerender') renderSidebar(true);
}

function resizeRenderer() {
  if (!renderer) return;
  const host = $('#gl-host'), w = host.clientWidth, h = host.clientHeight;
  if (w < 4 || h < 4) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
function disposeAll() {
  Object.values(stageGroups).forEach(g => disposeObjectTree(g));
  if (renderer) renderer.dispose();
}

function bindEvents() {
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-set]');
    if (s) { let v = s.dataset.value; if (s.dataset.num) v = parseFloat(v); else if (v === 'true') v = true; else if (v === 'false') v = false; setState(s.dataset.set, v); return; }
    const l = e.target.closest('[data-lang]'); if (l) { changeLanguage(l.dataset.lang); return; }
    const a = e.target.closest('[data-action]'); if (a) { handleAction(a.dataset.action, a); return; }
    const g = e.target.closest('[data-goto]'); if (g) { gotoModule(+g.dataset.goto, g.dataset.anchor); return; }
    const sj = e.target.closest('[data-jump]'); if (sj) { gotoModule(moduleIndexById(sj.dataset.jump) + 1, sj.dataset.anchor); return; }
    const st = e.target.closest('.stage-btn'); if (st) setStage(+st.dataset.stage);
  });
  document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.slider) setState(el.dataset.slider, parseFloat(el.value) * parseFloat(el.dataset.scale || 1)); });
  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.field) return;
    const raw = String(el.value).trim(), v = raw === '' ? null : Number(raw);
    setState(el.dataset.field, v === null || !Number.isFinite(v) ? null : v);
  });
  document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.toggle) setState(el.dataset.toggle, el.checked); });
  $('#cam-prev').addEventListener('click', () => setStage(state.stage - 1));
  $('#cam-next').addEventListener('click', () => setStage(state.stage + 1));
  $('#cam-center').addEventListener('click', () => flyToPreset(MODULES[state.stage - 1].camera));
  $('#btn-quiz').addEventListener('click', () => openQuiz(true));
  $('#btn-about').addEventListener('click', () => openAbout());
  $('#btn-panel').addEventListener('click', () => { const open = $('#main').classList.toggle('sidebar-collapsed'); $('#btn-panel').setAttribute('aria-expanded', open ? 'false' : 'true'); setTimeout(resizeRenderer, 30); });
  const el = renderer.domElement;
  let down = null;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointerPx.x = e.clientX - r.left; pointerPx.y = e.clientY - r.top; pointerIn = true; hoverDirty = true;
    dragging = !!(e.buttons & 1) && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
    if (dragging) hideTooltip();
  });
  el.addEventListener('pointerleave', () => { pointerIn = false; hideTooltip(); const m = active(); if (m && m.leave) m.leave(); });
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) handleViewportClick(); down = null; dragging = false; });
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('#quiz-modal').classList.contains('show')) closeQuiz();
    else if ($('#about-modal').classList.contains('show')) closeAbout();
  });
  window.addEventListener('resize', resizeRenderer);
  window.addEventListener('pagehide', disposeAll);
  if (window.ResizeObserver) new ResizeObserver(resizeRenderer).observe($('#viewport'));
  bindQuiz(); bindAbout(); bindGlossary();
}

/* =====================================================================
   Idioma: cambio en caliente sin tocar el estado del curso
   ===================================================================== */
export function changeLanguage(lang) { return setLang(lang); }
function onLanguageChanged() {
  applyStaticI18n(); renderStageNav();
  rebuildSlideLabelTexture(); relabelSprites();
  if (pipeline.umap) pipeline.umap.hospThumbKey = '';
  resetHudSig(); resetBanner();
  renderSidebar(true); updateLegend(); updateHUD(); updateBanner(); syncControls();
  refreshQuizIfOpen(); refreshAboutIfOpen(); refreshGlossary();
  dirty.sidebarLive = true; dirty.top3Thumbs = true;
  // El parámetro ?lang= de la URL, si existe, sigue al idioma elegido para que recargar no lo deshaga
  try { const u = new URL(window.location.href); if (u.searchParams.has('lang') && getLang() !== 'pseudo') { u.searchParams.set('lang', getLang()); window.history.replaceState(null, '', u); } } catch (e) { /* sin historial disponible */ }
}

/* =====================================================================
   Arranque
   ===================================================================== */
async function initApp() {
  initLang();
  $('#release').textContent = RELEASE;
  applyStaticI18n(); renderStageNav();
  try { initThree($('#gl-host'), MODULES[0].camera); } catch (err) { showFatal(err); return; }
  generateBaseModalityCanvas(state.modality, baseCanvas);
  rebuildCompositeTexture(); rebuildSlideLabelTexture();
  syncTileGrid(); rebuildUmapData(); recomputeBagRank();
  dirty.composite = false;
  bindEvents();
  onLangChange(onLanguageChanged);
  await setStage(1, true);
  processDirty();
  resizeRenderer();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rebuildSlideLabelTexture(); dirty.sidebarLive = true; });
  animate();
  // Utilidad de depuración y de pruebas automáticas
  const countObjects = () => { let n = 0; scene.traverse(() => { n++; }); return n; };
  /* Proyecta un punto del mundo a píxeles del lienzo (para comprobar solapamientos en las pruebas) */
  const toPixels = v => { const p = v.clone().project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height }; };
  const diag = () => ({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, objects: countObjects(), toPixels });
  window.__pdia = { diag, state, gotoModule, dirty, pipeline, MODULES, loaded, setState, setStage, processDirty, setLang: changeLanguage, getLang, t, quizState: () => ({ ...quiz }), ready: true };
}
export function boot() {
  const run = () => initApp().catch(showFatal);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}
