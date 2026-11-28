/* Definición de modalidades, hospitales y estrategias de normalización.
 * Datos numéricos migrados sin cambios de la v3.0 (p2_core.js §3). Los textos viven en i18n:
 *   modality.<key>.{name,fullName,stain,diagnosis,editorial,cluster.<k>,top3.<i>} · hospital.<K>.{name,scanner,desc} · norm.<modo> */
import { MIL_COLS, MIL_ROWS } from './constants.js';
import { t } from '../i18n/index.js';

export const HOSPITALS = [
  { key: 'A', profile: 'high-volume', hex: '#2F6FBF', color: 0x2F6FBF, center: [-3.3, 0.4, 2.7] },
  { key: 'B', profile: 'benchtop', hex: '#1E293B', color: 0x1E293B, center: [3.1, 2.3, 0.3] },
  { key: 'C', profile: 'low-cost', hex: '#94A3B8', color: 0x94A3B8, center: [0.3, -2.6, -2.9] }
];
export const hospitalName = h => t(`hospital.${h.key}.name`);
export const hospitalScanner = h => t(`hospital.${h.key}.scanner`);
export const hospitalDesc = h => t(`hospital.${h.key}.desc`);

export const HOSP_PROFILES = {
  A:   { gain: [1.04, 0.98, 0.96], gamma: 0.96, sat: 1.12, bright: 0.0 },
  B:   { gain: [0.86, 0.80, 0.90], gamma: 1.18, sat: 1.35, bright: -0.04 },
  C:   { gain: [0.92, 1.02, 1.10], gamma: 0.95, sat: 0.62, bright: 0.07 },
  REF: { gain: [1, 1, 1], gamma: 1, sat: 1, bright: 0 }
};
export const NORM_MODES = {
  none:    { batch: 0.82, purity: 0.34, amount: 0.0 },
  macenko: { batch: 0.26, purity: 0.78, amount: 0.8 },
  ssl:     { batch: 0.08, purity: 0.94, amount: 0.96 }
};
export const UNTRAINED_METRICS = { batch: 0.90, purity: 0.22 };
export const CONTAM_COLOR = { hex: '#9A6B3A', color: 0x9A6B3A };

export const MODALITIES = {
  he: {
    key: 'he', accent: '#4C3A7A',
    caseId: 'H-26-04171', defaultDilution: 0.14,
    maskSeed: 11, bgThreshold: 0.30, scanMm: [15, 12],
    primaryFocus: { u: 0.62, v: 0.42, rx: 0.10, ry: 0.17 },
    secondaryFocus: { u: 0.30, v: 0.68, rx: 0.07, ry: 0.11 },
    clusters: [
      { key: 'stroma', color: 0x0F766E, hex: '#0F766E', center: [-2.9, 1.5, -1.7] },
      { key: 'gland',  color: 0x4C3A7A, hex: '#4C3A7A', center: [2.8, -0.4, -2.1] },
      { key: 'infl',   color: 0xD97706, hex: '#D97706', center: [-1.4, -2.2, 2.6] },
      { key: 'tumor',  color: 0xBE123C, hex: '#BE123C', center: [2.6, 2.1, 2.3] }
    ],
    top3: [
      { weight: 0.34, u: 0.62, v: 0.42, seed: 101 },
      { weight: 0.22, u: 0.66, v: 0.50, seed: 102 },
      { weight: 0.14, u: 0.30, v: 0.68, seed: 103 }
    ]
  },
  pap: {
    key: 'pap', accent: '#0F766E',
    caseId: 'C-26-02039', defaultDilution: 0.015,
    maskSeed: 23, bgThreshold: 0.16, scanMm: [22, 32],
    primaryFocus: { u: 0.55, v: 0.55, rx: 0.045, ry: 0.08 },
    secondaryFocus: { u: 0.27, v: 0.70, rx: 0.035, ry: 0.06 },
    clusters: [
      { key: 'squam', color: 0x0F766E, hex: '#0F766E', center: [-3.0, 1.2, -1.4] },
      { key: 'endo',  color: 0x4C3A7A, hex: '#4C3A7A', center: [2.9, 0.2, -2.3] },
      { key: 'pmn',   color: 0xD97706, hex: '#D97706', center: [-0.8, -2.4, 2.8] },
      { key: 'hsil',  color: 0xBE123C, hex: '#BE123C', center: [2.4, 2.4, 2.0] }
    ],
    top3: [
      { weight: 0.42, u: 0.55, v: 0.55, seed: 201 },
      { weight: 0.27, u: 0.57, v: 0.60, seed: 202 },
      { weight: 0.16, u: 0.27, v: 0.70, seed: 203 }
    ]
  },
  ihc: {
    key: 'ihc', accent: '#92400E',
    caseId: 'I-26-01188', defaultDilution: 0.18,
    maskSeed: 37, bgThreshold: 0.30, scanMm: [15, 10],
    primaryFocus: { u: 0.68, v: 0.36, rx: 0.11, ry: 0.16 },
    secondaryFocus: { u: 0.35, v: 0.65, rx: 0.08, ry: 0.12 },
    clusters: [
      { key: 'neg',    color: 0x0F766E, hex: '#0F766E', center: [-2.7, 1.7, -1.5] },
      { key: 'benign', color: 0x4C3A7A, hex: '#4C3A7A', center: [3.0, -0.2, -2.0] },
      { key: 'weak',   color: 0xD97706, hex: '#D97706', center: [-1.2, -2.3, 2.5] },
      { key: 'pos',    color: 0xBE123C, hex: '#BE123C', center: [2.5, 2.2, 2.2] }
    ],
    top3: [
      { weight: 0.36, u: 0.68, v: 0.36, seed: 301 },
      { weight: 0.24, u: 0.70, v: 0.44, seed: 302 },
      { weight: 0.15, u: 0.35, v: 0.65, seed: 303 }
    ]
  }
};
// Ajusta los Top-3 a celdas de la bolsa MIL (20×10) y calcula sus coordenadas
Object.values(MODALITIES).forEach(m => {
  m.top3 = m.top3.map((tp, i) => {
    const ci = Math.min(MIL_COLS - 1, Math.floor(tp.u * MIL_COLS)), cj = Math.min(MIL_ROWS - 1, Math.floor(tp.v * MIL_ROWS));
    return { rank: i + 1, weight: tp.weight, u: (ci + 0.5) / MIL_COLS, v: (cj + 0.5) / MIL_ROWS, coords: `(${ci}, ${cj})`, seed: tp.seed, bagIndex: cj * MIL_COLS + ci };
  });
});

/* Textos de modalidad (se resuelven al momento de usarse: cambian con el idioma) */
export const modName = m => t(`modality.${m.key}.name`);
export const modFullName = m => t(`modality.${m.key}.fullName`);
export const modStain = m => t(`modality.${m.key}.stain`);
export const modDiagnosis = m => t(`modality.${m.key}.diagnosis`);
export const clusterLabel = (m, i) => t(`modality.${m.key}.cluster.${m.clusters[i].key}`);
export const top3Morphology = (m, i) => t(`modality.${m.key}.top3.${i}`);
