/* Registro del módulo (parte ligera). M0 · Mapa del campo y vocabulario. */
export default {
  id: 'field-map',
  title: 'module.field-map.title',
  nav: 'module.field-map.nav',
  objectives: ['module.field-map.obj.0', 'module.field-map.obj.1', 'module.field-map.obj.2', 'module.field-map.obj.3'],
  prerequisites: [],
  minutes: 30,
  questions: [
    { id: 'q2', correct: 2, jump: 'field-map', anchor: 'm0-sec-pipeline' },
    { id: 'm0q1', correct: 1, jump: 'field-map', anchor: 'm0-sec-real' },
    { id: 'm0q2', correct: 3, jump: 'field-map', anchor: 'm0-sec-pipeline' },
    { id: 'm0q3', correct: 0, jump: 'field-map', anchor: 'm0-sec-real' },
    { id: 'm0q4', correct: 2, jump: 'field-map', anchor: 'm0-sec-pipeline' }
  ],
  references: ['campanella', 'lu-clam', 'zarella', 'openslide-paper'],
  camera: { pos: [0.4, 7.6, 11.8], target: [0.4, 1.8, 0], half: 6.2 }
};
