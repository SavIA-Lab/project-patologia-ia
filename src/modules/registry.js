/* Registro de módulos del curso.
 * Cada módulo declara su parte ligera (meta.js: id, título, objetivos, prerrequisitos, tiempo estimado, preguntas, referencias)
 * y su parte pesada (index.js: escena 3D y panel lateral), que se carga bajo demanda con import() la primera vez que se visita.
 * El orden de este arreglo es el orden de la navegación. Las cinco etapas de la v3.0 son módulos provisionales:
 * v2.0b y v2.0c los reemplazan o amplían. */
import wsiPyramid from './wsi-pyramid/meta.js';
import qcTiling from './qc-tiling/meta.js';
import encoderShift from './encoder-shift/meta.js';
import milAttention from './mil-attention/meta.js';
import xaiThreshold from './xai-threshold/meta.js';

const LOADERS = {
  'wsi-pyramid': () => import('./wsi-pyramid/index.js'),
  'qc-tiling': () => import('./qc-tiling/index.js'),
  'encoder-shift': () => import('./encoder-shift/index.js'),
  'mil-attention': () => import('./mil-attention/index.js'),
  'xai-threshold': () => import('./xai-threshold/index.js')
};

/** `track` (lista de rutas, p. ej. ['patch-lab']) es opcional y todavía no se usa: la ruta P lo ocupará desde v2.0b. */
export const MODULES = [wsiPyramid, qcTiling, encoderShift, milAttention, xaiThreshold].map(m => ({ track: [], ...m }));
export const moduleIndex = id => MODULES.findIndex(m => m.id === id);
export const loadModuleDefinition = async id => (await LOADERS[id]()).default;

/** Preguntas del quiz en el orden de los módulos (cada pregunta declara la opción correcta; el texto está en los diccionarios) */
export const QUIZ_QUESTIONS = MODULES.flatMap(m => m.questions.map(q => ({ ...q, module: m.id })));
