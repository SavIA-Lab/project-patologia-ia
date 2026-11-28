/* Cálculo del escáner genérico de M1. Funciones puras, sin DOM, sin Three.js y sin leer el estado.
 *
 * Procedencia de cada resultado:
 *  - cálculo exacto: píxeles de la imagen, campos, mosaico, bytes sin comprimir, profundidad cubierta por los planos Z;
 *  - simulación pedagógica: tiempo de escaneo y razón de compresión (parámetros editables y marcados como ilustrativos;
 *    no son mediciones de ningún equipo).
 * Si falta el MPP o es inválido, las funciones lanzan PatchMathError (se reutiliza el error del motor de la ruta P). */
import { PatchMathError, mppPorEje, numeroTiles } from './patch-math.js';

export const PERFIL_ESQUEMA = 'generic-scanner-profile';
export const PERFIL_VERSION = 1;
export const FAMILIAS = ['high-volume', 'benchtop', 'low-cost', 'motorized'];
export const MODOS_ESCANEO = ['area', 'line'];
export const TIPOS_COMPRESION = ['none', 'lossless', 'lossy'];
export const OBJETIVOS = [20, 40];

/** MPP nativo por defecto según el objetivo nominal. Es un valor ILUSTRATIVO y editable; no es una especificación de ningún equipo. */
export const MPP_ILUSTRATIVO = Object.freeze({ 20: 0.5, 40: 0.25 });

/** Parámetros por defecto de cada familia genérica. Todos ilustrativos y editables; ninguno procede de la ficha de un equipo real. */
export const FAMILIA_DEFECTOS = Object.freeze({
  'high-volume': { frame: { w: 2048, h: 1536 }, overlap: 0.10, msField: 90, msFocus: 120, msZ: 60, linesPerSecond: 20000, color: { gain: [1.04, 0.98, 0.96], gamma: 0.96, sat: 1.12, bright: 0 } },
  'benchtop': { frame: { w: 2048, h: 1536 }, overlap: 0.10, msField: 140, msFocus: 150, msZ: 90, linesPerSecond: 12000, color: { gain: [0.86, 0.80, 0.90], gamma: 1.18, sat: 1.35, bright: -0.04 } },
  'low-cost': { frame: { w: 1920, h: 1080 }, overlap: 0.15, msField: 300, msFocus: 400, msZ: 200, linesPerSecond: 4000, color: { gain: [0.92, 1.02, 1.10], gamma: 0.95, sat: 0.62, bright: 0.07 } },
  'motorized': { frame: { w: 1920, h: 1080 }, overlap: 0.15, msField: 450, msFocus: 500, msZ: 250, linesPerSecond: 3000, color: { gain: [1, 1, 1], gamma: 1, sat: 1, bright: 0 } }
});
/** Razón de compresión ilustrativa por tipo. Depende del contenido y del códec: solo sirve para ver el efecto, no para predecirlo. */
export const COMPRESION_ILUSTRATIVA = Object.freeze({ none: 1, lossless: 2, lossy: 10 });

const err = (code, field, message) => new PatchMathError(code, field, message);
const posNum = (v, field, { int = false, min = 0, strictMin = true } = {}) => {
  if (v === undefined || v === null) throw err('VALOR_AUSENTE', field, `Falta ${field}`);
  if (typeof v !== 'number' || !Number.isFinite(v) || (int && !Number.isInteger(v)) || (strictMin ? v <= min : v < min)) throw err('VALOR_INVALIDO', field, `${field} inválido: ${v}`);
  return v;
};

/** Perfil de escáner genérico. Estructura compartida en el estado (`state.scannerProfile`) y documentada en docs/perfil-escaner-generico.md. */
export function crearPerfil(entrada = {}) {
  const familia = entrada.family ?? 'high-volume';
  if (!FAMILIAS.includes(familia)) throw err('VALOR_INVALIDO', 'family', `Familia desconocida: ${familia}`);
  const def = FAMILIA_DEFECTOS[familia];
  const objective = entrada.objective ?? 40;
  if (!OBJETIVOS.includes(objective)) throw err('VALOR_INVALIDO', 'objective', `Objetivo no admitido: ${objective}`);
  const mppUsuario = entrada.mpp !== undefined;
  // El MPP del perfil nunca se completa en silencio: o lo trae la entrada, o se usa el valor ilustrativo del objetivo y queda registrado como tal.
  const mpp = mppPorEje(mppUsuario ? entrada.mpp : MPP_ILUSTRATIVO[objective], 'mpp');
  const frame = { w: posNum(entrada.frame?.w ?? def.frame.w, 'frame.w', { int: true }), h: posNum(entrada.frame?.h ?? def.frame.h, 'frame.h', { int: true }) };
  const overlap = posNum(entrada.overlap ?? def.overlap, 'overlap', { min: 0, strictMin: false });
  if (overlap >= 1) throw err('VALOR_INVALIDO', 'overlap', 'El solapamiento entre campos debe ser menor que 1');
  const scanMode = entrada.scanMode ?? 'area';
  if (!MODOS_ESCANEO.includes(scanMode)) throw err('VALOR_INVALIDO', 'scanMode', `Modo desconocido: ${scanMode}`);
  const zPlanes = posNum(entrada.zPlanes ?? 1, 'zPlanes', { int: true, min: 1, strictMin: false });
  const zStepUm = posNum(entrada.zStepUm ?? 1, 'zStepUm');
  const focusPoints = posNum(entrada.focusPoints ?? 25, 'focusPoints', { int: true, min: 0, strictMin: false });
  const kind = entrada.compression?.kind ?? 'none';
  if (!TIPOS_COMPRESION.includes(kind)) throw err('VALOR_INVALIDO', 'compression.kind', `Compresión desconocida: ${kind}`);
  const ratio = posNum(entrada.compression?.ratio ?? COMPRESION_ILUSTRATIVA[kind], 'compression.ratio', { min: 1, strictMin: false });
  const timing = {
    msField: posNum(entrada.timing?.msField ?? def.msField, 'timing.msField'), msFocus: posNum(entrada.timing?.msFocus ?? def.msFocus, 'timing.msFocus', { min: 0, strictMin: false }),
    msZ: posNum(entrada.timing?.msZ ?? def.msZ, 'timing.msZ', { min: 0, strictMin: false }), linesPerSecond: posNum(entrada.timing?.linesPerSecond ?? def.linesPerSecond, 'timing.linesPerSecond')
  };
  return {
    schema: PERFIL_ESQUEMA, version: PERFIL_VERSION, family: familia, objective,
    mpp, mppSource: mppUsuario ? 'user' : 'illustrative-default',
    frame, overlap, scanMode, zPlanes, zStepUm, focusPoints,
    compression: { kind, ratio, ratioSource: entrada.compression?.ratio !== undefined ? 'user' : 'illustrative-default' },
    timing, timingSource: entrada.timing ? 'user' : 'illustrative-default',
    color: { ...def.color, gain: [...def.color.gain], ...(entrada.color || {}) }
  };
}

/** Píxeles de la imagen final que cubren un área de `areaMm` [ancho, alto] en milímetros, por eje. */
export function pixelesDelArea(areaMm, mpp) {
  if (!Array.isArray(areaMm) || areaMm.length !== 2) throw err('VALOR_INVALIDO', 'areaMm', 'El área debe ser [ancho, alto] en mm');
  const [w, h] = areaMm.map((v, i) => posNum(v, i ? 'areaMm.h' : 'areaMm.w'));
  const m = mppPorEje(mpp, 'mpp');
  return { x: Math.ceil(w * 1000 / m.x), y: Math.ceil(h * 1000 / m.y) };
}

/** Campos (o franjas) necesarios para cubrir el área. En modo por área se usan las ventanas con relleno del motor de teselado. */
export function camposDelEscaneo(perfil, areaMm) {
  const p = crearPerfil(perfil), px = pixelesDelArea(areaMm, p.mpp);
  const strideX = Math.max(1, Math.round(p.frame.w * (1 - p.overlap))), strideY = Math.max(1, Math.round(p.frame.h * (1 - p.overlap)));
  const fieldUm = { x: p.frame.w * p.mpp.x, y: p.frame.h * p.mpp.y };
  if (p.scanMode === 'line') {
    // Cámara de línea: la franja mide frame.w píxeles de ancho y recorre todo el alto del área
    const franjas = numeroTiles(px.x, 1, Math.min(p.frame.w, px.x), strideX, 'rellenar').nx;
    return { modo: 'line', imagenPx: px, franjas, lineasPorFranja: px.y, campos: franjas, nx: franjas, ny: 1, strideX, strideY, campoUm: fieldUm, mosaicoPx: { x: (franjas - 1) * strideX + Math.min(p.frame.w, px.x) , y: px.y } };
  }
  const t = numeroTiles(px.x, px.y, { w: p.frame.w, h: p.frame.h }, { x: strideX, y: strideY }, 'rellenar');
  const mosaicoPx = { x: t.nx > 1 ? (t.nx - 1) * strideX + p.frame.w : Math.min(px.x, p.frame.w), y: t.ny > 1 ? (t.ny - 1) * strideY + p.frame.h : Math.min(px.y, p.frame.h) };
  return { modo: 'area', imagenPx: px, nx: t.nx, ny: t.ny, campos: t.total, strideX, strideY, campoUm: fieldUm, mosaicoPx };
}

/** Bytes de la imagen RGB de 8 bits sin comprimir, con todos los planos Z (cálculo exacto). */
export function bytesSinComprimir(imagenPx, zPlanes = 1) {
  const z = posNum(zPlanes, 'zPlanes', { int: true });
  const x = posNum(imagenPx?.x, 'imagenPx.x', { int: true }), y = posNum(imagenPx?.y, 'imagenPx.y', { int: true });
  return x * y * 3 * z;
}
/** Profundidad cubierta por los planos Z en micras: (planos - 1) × paso (cálculo exacto). */
export const profundidadZ = (zPlanes, zStepUm) => (posNum(zPlanes, 'zPlanes', { int: true }) - 1) * posNum(zStepUm, 'zStepUm');

/** Tiempo de escaneo SIMULADO en segundos, con los parámetros ilustrativos del perfil. No es una medición. */
export function tiempoSimulado(perfil, areaMm) {
  const p = crearPerfil(perfil), c = camposDelEscaneo(p, areaMm), z = p.zPlanes;
  const enfoque = p.focusPoints * p.timing.msFocus / 1000;
  let captura;
  if (p.scanMode === 'line') captura = c.franjas * z * (c.lineasPorFranja / p.timing.linesPerSecond);
  else captura = c.campos * (p.timing.msField + (z - 1) * p.timing.msZ) / 1000;
  return { segundos: captura + enfoque, captura, enfoque };
}

/** Salidas del escáner para un área: todo lo exacto y todo lo simulado, separado por procedencia. */
export function salidasEscaneo(perfil, areaMm) {
  const p = crearPerfil(perfil), c = camposDelEscaneo(p, areaMm);
  const bytes = bytesSinComprimir(c.imagenPx, p.zPlanes), t = tiempoSimulado(p, areaMm);
  return {
    exacto: { mpp: p.mpp, imagenPx: c.imagenPx, campos: c.campos, nx: c.nx, ny: c.ny, campoUm: c.campoUm, mosaicoPx: c.mosaicoPx, bytesSinComprimir: bytes, planosZ: p.zPlanes, profundidadZUm: profundidadZ(p.zPlanes, p.zStepUm), modo: c.modo, franjas: c.franjas ?? null },
    simulado: { segundos: t.segundos, bytesComprimidos: Math.ceil(bytes / p.compression.ratio), razonCompresion: p.compression.ratio }
  };
}

/** Exportación e importación del perfil a JSON (sin completar en silencio los campos que falten: se vuelve a validar). */
export const exportarPerfil = perfil => JSON.stringify(crearPerfil(perfil), null, 2);
export function importarPerfil(texto) {
  let obj;
  try { obj = typeof texto === 'string' ? JSON.parse(texto) : texto; } catch (e) { throw err('JSON_INVALIDO', 'perfil', 'El texto no es JSON válido'); }
  if (!obj || typeof obj !== 'object') throw err('CONFIG_INVALIDA', 'perfil', 'El perfil no es un objeto');
  if (obj.schema !== PERFIL_ESQUEMA) throw err('ESQUEMA_INVALIDO', 'schema', 'Esquema desconocido');
  if (obj.version !== PERFIL_VERSION) throw err('VERSION_NO_SOPORTADA', 'version', 'Versión no soportada');
  return crearPerfil({ ...obj, mpp: obj.mpp });
}
