/* Estado compartido del curso (modalidad, parche fijado, controles de cada etapa) y banderas de recálculo.
 * El idioma NO forma parte de este estado: cambiar de idioma no lo toca (ver src/i18n). */
import { MODALITIES } from './modalities.js';
import { ARTIFACT_KEYS } from './constants.js';
import { crearPerfil } from './scanner-math.js';

export const state = {
  modality: 'he', stage: 1,
  track: 'all',                                  // filtro de la navegación por nivel de ruta (M0)
  /* Perfil de escáner genérico: dato compartido que define M1 y que usarán M2 y, desde la v2.1b, M5. Estructura en docs/perfil-escaner-generico.md */
  scannerProfile: crearPerfil({ family: 'high-volume', objective: 40 }),
  m1: { family: 'high-volume', objective: 40, scanMode: 'area', zPlanes: 1, zStepUm: 1, focusPoints: 25, compression: 'none', mppEdited: false, progress: 1, seams: false, banding: false, strips: false, cast: false },
  m2: {
    mppSource: 'scanner', mpp: { x: 0.25, y: 0.25 }, objective: 40,
    nuc: { diam: 9, cell: 22, mpp: 0.5, zoom: 2, chrom: 0.5, irreg: 0.3, seed: 7, view: 'resampled' },
    pyr: { ds: [1, 4, 16, 32], w0: 120000, h0: 80000, order: 'low-first' },
    sel: { x: 60000, y: 40000, mode: 'fov', fovUm: 224, px: 256, level: 1 },
    fail: { mppA: 0.25, mppB: 0.5, px: 224 },
    optics: { lambdaNm: 550, na: 0.75 }, alias: { periodUm: 0.8 },
    cfg: { level: 0, ext: 640, tile: null, enc: 224, stride: 640, border: 'descartar' },
    pred: -1, format: 'svs', snippet: 'inspect'
  },
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
  sidebarLive: true, tilesVisual: false, legend: false, top3Thumbs: false, labels: false
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
  dirty.composite = true; dirty.tiles = true; dirty.bag = true; dirty.mil = true; dirty.umap = true; dirty.sidebarLive = true; dirty.heat = true;
}

export const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export const setPathVal = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
export const hasUnfilteredArtifacts = () => !state.qcOn && ARTIFACT_KEYS.some(k => state.artifacts[k]);
export const activeArtifactKeys = () => ARTIFACT_KEYS.filter(k => state.artifacts[k]);
