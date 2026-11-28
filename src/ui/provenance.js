/* Etiqueta de procedencia reutilizable (principio 9 de la hoja de ruta).
 * Toda cifra que muestran M1 y M2 lleva una de cinco etiquetas, y nunca se mezclan dos en el mismo valor:
 *   exact  = cálculo exacto (fórmula con entradas del usuario, comprobada con pruebas en Node)
 *   image  = procesamiento real de imagen (operaciones de Canvas sobre una imagen sintética)
 *   sim    = simulación pedagógica (parámetros ilustrativos y editables, sin medición real)
 *   spec   = especificación verificada de un encoder (con fuente y fecha; no se usa antes de la v2.1a)
 *   exp    = resultado experimental real (con fuente; no se usa antes de la v2.5)
 * Los textos salen del diccionario: prov.<tipo>.short y prov.<tipo>.long. */
import { t } from '../i18n/index.js';

export const PROVENANCE = ['exact', 'image', 'sim', 'spec', 'exp'];
export const prov = type => `<span class="prov prov-${type}" title="${t(`prov.${type}.long`)}"><i aria-hidden="true"></i>${t(`prov.${type}.short`)}</span>`;
/** Valor con su etiqueta al lado */
export const pv = (valueHtml, type) => `<span class="pv">${valueHtml}${prov(type)}</span>`;
/** Leyenda con las cinco etiquetas y su significado (para M0 y el pie de los módulos) */
export const provLegend = (types = PROVENANCE) => `<dl class="w2-kv">${types.map(k => `<dt>${prov(k)}</dt><dd style="font-family:inherit">${t(`prov.${k}.long`)}</dd>`).join('')}</dl>`;
