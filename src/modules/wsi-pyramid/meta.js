/* Registro del módulo (parte ligera, se carga al arrancar). Etapa 1 de la v3.0, migrada como módulo provisional:
 * v2.0b la amplía (M2). Los campos sin contenido en la v3.0 (tiempo estimado, referencias) quedan vacíos a propósito. */
export default {
  id: 'wsi-pyramid',
  title: 'module.wsi-pyramid.title',
  nav: 'module.wsi-pyramid.nav',
  objectives: ['module.wsi-pyramid.obj.0', 'module.wsi-pyramid.obj.1'],
  prerequisites: [],
  minutes: null,
  questions: [{ id: 'q1', correct: 1 }, { id: 'q2', correct: 2 }],
  references: [],
  provisional: true,
  camera: { pos: [0.4, 7.6, 11.8], target: [0.4, 1.8, 0], half: 6.2 }
};
