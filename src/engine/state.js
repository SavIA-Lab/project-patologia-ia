/* Estado compartido del curso (modalidad, parche fijado, controles de cada etapa) y banderas de recálculo.
 * El idioma NO forma parte de este estado: cambiar de idioma no lo toca (ver src/i18n). */
import { MODALITIES } from './modalities.js';
import { ARTIFACT_KEYS } from './constants.js';

export const state = {
  modality: 'he', stage: 1,
  pyramidLevel: 2, showPyramid: true, showGigaGrid: true,
  patchSize: 224, discardBg: true, explode: 0,
  artifacts: { blur: false, folds: false, ink: false, bubbles: false },
  qcOn: true,
  encoderTrained: false, normMode: 'none', umapColor: 'morph',
  aggregator: 'attention', dilution: MODALITIES.he.defaultDilution, groundTruth: 'pos', distractor: false,
  heatOpacity: 0.75, heatThreshold: 0.25, heatScale: 'amber',
  challenge: { active: false, pins: [], revealed: false, result: null },
  selectedTop3: -1,
  tau: 0.5,
  pinned: null
};

export const dirty = {
  composite: true, tiles: true, bag: true, mil: true, umap: true, heat: true, heatColor: true,
  sidebarLive: true, pyramidTex: true, tilesVisual: false, legend: false, top3Thumbs: false, labels: false
};

/* Datos del pipeline que dependen del estado pero no de la escena 3D. Los calcula src/engine/pipeline.js
 * aunque el módulo correspondiente aún no se haya cargado (carga diferida), para que el parche fijado
 * se pueda seguir entre etapas. */
export const pipeline = {
  tiles: { cols: 24, rows: 12, infos: [] },   // etapa 2: teselas evaluadas
  bag: [],                                    // etapa 4: bolsa MIL (20×10) evaluada
  rank: [], atyp: null,                       // etapa 4: ranking de instancias por atipia
  mil: null,                                  // etapa 4: puntuaciones y pesos de los tres agregadores
  umap: null,                                 // etapa 3: nube de parches (muestras, ruido, posiciones)
  bio: null, field: null                      // etapa 5: mapa biológico y campo de calor
};

/* Enlaces que registra la capa de aplicación al arrancar (evitan importaciones circulares entre el motor y la interfaz) */
export const hooks = { processDirty() {}, resetHud() {}, renderSidebar() {} };

/** Un cambio en los artefactos invalida la composición, las teselas, la bolsa MIL, la nube UMAP y el mapa de calor */
export function markArtifactsChanged() {
  dirty.composite = true; dirty.tiles = true; dirty.bag = true; dirty.mil = true; dirty.umap = true; dirty.pyramidTex = true; dirty.sidebarLive = true; dirty.heat = true;
}

export const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export const setPathVal = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
export const hasUnfilteredArtifacts = () => !state.qcOn && ARTIFACT_KEYS.some(k => state.artifacts[k]);
export const activeArtifactKeys = () => ARTIFACT_KEYS.filter(k => state.artifacts[k]);
