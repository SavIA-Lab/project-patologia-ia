/* Registro del módulo (parte ligera). M1 · Muestra y escáner genérico. */
export default {
  id: 'scanner',
  title: 'module.scanner.title',
  nav: 'module.scanner.nav',
  objectives: ['module.scanner.obj.0', 'module.scanner.obj.1', 'module.scanner.obj.2', 'module.scanner.obj.3'],
  prerequisites: ['field-map'],
  minutes: 45,
  questions: [
    { id: 'm1q1', correct: 2, jump: 'scanner', anchor: 'm1-sec-out' },
    { id: 'm1q2', correct: 1, jump: 'scanner', anchor: 'm1-sec-scan' },
    { id: 'm1q3', correct: 0, jump: 'scanner', anchor: 'm1-sec-art' },
    { id: 'm1q4', correct: 3, jump: 'scanner', anchor: 'm1-sec-fail' },
    { id: 'm1q5', correct: 1, jump: 'scanner', anchor: 'm1-sec-art' }
  ],
  references: ['zarella', 'openslide-paper', 'campanella'],
  camera: { pos: [0.4, 7.6, 11.8], target: [0.4, 1.8, 0], half: 6.2 }
};
