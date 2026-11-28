/* Registro de módulos del curso.
 * Cada módulo declara su parte ligera (meta.js: id, título, objetivos, prerrequisitos, tiempo estimado, preguntas, referencias)
 * y su parte pesada (index.js: escena o espacio de trabajo y panel lateral), que se carga bajo demanda con import() la primera vez que se visita.
 * El orden de este arreglo es el orden de la navegación. M0, M1 y M2 son módulos 2D (kind: '2d', sin escena 3D);
 * las etapas E2 a E5 de la v3.0 siguen como módulos provisionales con escena 3D. */
import fieldMap from './field-map/meta.js';
import scanner from './scanner/meta.js';
import wsiPyramid from './wsi-pyramid/meta.js';
import qcTiling from './qc-tiling/meta.js';
import encoderShift from './encoder-shift/meta.js';
import milAttention from './mil-attention/meta.js';
import xaiThreshold from './xai-threshold/meta.js';

const LOADERS = {
  'field-map': () => import('./field-map/index.js'),
  'scanner': () => import('./scanner/index.js'),
  'wsi-pyramid': () => import('./wsi-pyramid/index.js'),
  'qc-tiling': () => import('./qc-tiling/index.js'),
  'encoder-shift': () => import('./encoder-shift/index.js'),
  'mil-attention': () => import('./mil-attention/index.js'),
  'xai-threshold': () => import('./xai-threshold/index.js')
};

/** Niveles de ruta (campo `track`): explorer, practitioner, researcher. La ruta P (patch-lab) tiene su propio itinerario en M0. */
export const TRACK_LEVELS = ['explorer', 'practitioner', 'researcher'];
/** Código corto de cada módulo y, para las etapas de la v3.0, su número de etapa (E2 a E5, de un total de 5) */
const EXTRA = {
  'field-map': { code: 'M0', kind: '2d', track: ['explorer', 'practitioner', 'researcher'] },
  'scanner': { code: 'M1', kind: '2d', track: ['explorer', 'practitioner'] },
  'wsi-pyramid': { code: 'M2', kind: '2d', track: ['explorer', 'practitioner'] },
  'qc-tiling': { code: 'E2', stageNo: 2, track: ['explorer', 'practitioner'] },
  'encoder-shift': { code: 'E3', stageNo: 3, track: ['practitioner'] },
  'mil-attention': { code: 'E4', stageNo: 4, track: ['practitioner'] },
  'xai-threshold': { code: 'E5', stageNo: 5, track: ['practitioner'] }
};
export const LEGACY_STAGE_TOTAL = 5;

export const MODULES = [fieldMap, scanner, wsiPyramid, qcTiling, encoderShift, milAttention, xaiThreshold].map(m => ({ kind: '3d', ...m, ...EXTRA[m.id] }));
export const moduleIndex = id => MODULES.findIndex(m => m.id === id);
export const loadModuleDefinition = async id => (await LOADERS[id]()).default;

/** Preguntas del quiz en el orden de los módulos (cada pregunta declara la opción correcta; el texto está en los diccionarios) */
export const QUIZ_QUESTIONS = MODULES.flatMap(m => m.questions.map(q => ({ ...q, module: m.id })));
