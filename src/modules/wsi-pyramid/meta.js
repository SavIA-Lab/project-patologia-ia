/* Registro del módulo (parte ligera). M2 · WSI, pirámide y formatos. Reemplaza a la etapa 1 de la v3.0.
 * Incluye los submódulos A (resolución espacial), B (pirámides) y la parte 1 de L (OpenSlide) de la ruta P. */
export default {
  id: 'wsi-pyramid',
  title: 'module.wsi-pyramid.title',
  nav: 'module.wsi-pyramid.nav',
  objectives: ['module.wsi-pyramid.obj.0', 'module.wsi-pyramid.obj.1', 'module.wsi-pyramid.obj.2', 'module.wsi-pyramid.obj.3', 'module.wsi-pyramid.obj.4'],
  prerequisites: ['field-map'],
  minutes: 60,
  questions: [
    { id: 'q1', correct: 1, jump: 'wsi-pyramid', anchor: 'm2-sec-pyramid' },
    { id: 'm2q1', correct: 1, jump: 'wsi-pyramid', anchor: 'm2-sec-fail' },
    { id: 'm2q2', correct: 2, jump: 'wsi-pyramid', anchor: 'm2-sec-patch' },
    { id: 'm2q3', correct: 0, jump: 'wsi-pyramid', anchor: 'm2-sec-nucleus' },
    { id: 'm2q4', correct: 3, jump: 'wsi-pyramid', anchor: 'm2-sec-mpp' },
    { id: 'm2q5', correct: 1, jump: 'wsi-pyramid', anchor: 'm2-sec-patch' }
  ],
  references: ['openslide-paper', 'openslide-props', 'openslide-python', 'openslide-formats', 'dicom-wsi', 'ome-tiff', 'nyquist', 'shannon', 'abbe'],
  camera: { pos: [0.4, 7.6, 11.8], target: [0.4, 1.8, 0], half: 6.2 }
};
