/* Constantes globales. Migradas sin cambios de la v3.0 (p2_core.js §1). */

export const SAMPLE_W = 8;            // ancho del tejido sobre el portaobjetos (unidades 3D)
export const SAMPLE_H = 4;            // alto del tejido (relación 2:1 con la textura)
export const SAMPLE_CENTER_X = 0.9;   // el portaobjetos deja espacio a la izquierda para la etiqueta
export const TEX_W = 1024, TEX_H = 512;
export const MIL_COLS = 20, MIL_ROWS = 10, MIL_BAG_SIZE = 200;
export const QC_LAPLACIAN_MIN = 60;   // varianza Laplaciana mínima aceptable en tejido
export const UMAP_N = 360, UMAP_CONTAM_PER = 12, UMAP_MAX = UMAP_N + UMAP_CONTAM_PER * 4;
export const ARTIFACT_KEYS = ['blur', 'folds', 'ink', 'bubbles'];
export const PYR_LEVELS = [
  { mag: 5,  res: 2.0,  zoom: 1,     context: 100, detail: 14, y: 1.25 },
  { mag: 10, res: 1.0,  zoom: 2,     context: 78,  detail: 38, y: 2.5 },
  { mag: 20, res: 0.5,  zoom: 4,     context: 52,  detail: 66, y: 3.75 },
  { mag: 40, res: 0.25, zoom: 8,     context: 26,  detail: 96, y: 5.0 }
];
// Tipografías para texto dibujado en Canvas (deben coincidir con las de fonts.css)
export const FONT_SANS = 'Inter, sans-serif';
export const FONT_MONO = '"JetBrains Mono", monospace';
