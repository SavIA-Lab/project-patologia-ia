/* M1 · procesamiento de imagen del escáner genérico. Funciones puras sobre objetos tipo ImageData
 * ({ data: Uint8ClampedArray RGBA, width, height }); no tocan el DOM, así que se prueban en Node.
 *
 * Qué es real y qué es simulado:
 *  - Las operaciones sobre los píxeles (viñeteo, desplazamiento, bandas, desenfoque, transformación de color) se ejecutan de verdad
 *    sobre la imagen sintética de la modalidad vigente: procedencia "imagen".
 *  - La intensidad de cada artefacto (cuánto se desplaza un campo, qué fracción sale desenfocada) es un parámetro pedagógico
 *    editable: procedencia "simulado". No describe ningún equipo. */
import { profundidadZ } from '../../engine/scanner-math.js';

/** Relieve del tejido, profundidad de campo y radio máximo de desenfoque. Valores ilustrativos. */
export const RELIEVE_UM = 4, DOF_UM = 1, BLUR_MAX = 5;
export const SEMILLA = 11;

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Rejilla de campos (modo por área) o de franjas (modo por línea) que se ve en el módulo: nCols campos de ancho, nRows de alto. */
export function rejillaVista(perfil, W = 480, nCols = 4, nRows = 3) {
  const ov = perfil.overlap, linea = perfil.scanMode === 'line';
  const w = Math.round(W / (1 + (nCols - 1) * (1 - ov)));
  const h = Math.round(w * perfil.frame.h / perfil.frame.w);
  const sx = Math.round(w * (1 - ov)), sy = Math.round(h * (1 - ov));
  const H = h + (nRows - 1) * sy;
  const rects = [];
  for (let c = 0; c < nCols; c++) {
    const x = c * sx, ww = Math.min(w, W - x);
    if (linea) rects.push({ x, y: 0, w: ww, h: H, r: 0, c });
    else for (let r = 0; r < nRows; r++) { const y = r * sy; rects.push({ x, y, w: ww, h: Math.min(h, H - y), r, c }); }
  }
  return { W, H, rects, linea };
}

/** Desenfoque: severidad según la profundidad que cubren los planos Z frente al relieve del tejido, y fracción de campos afectados según los puntos de enfoque. */
export function parametrosDesenfoque(perfil) {
  const cubierto = DOF_UM + profundidadZ(perfil.zPlanes, perfil.zStepUm);
  const severidad = clamp(1 - cubierto / RELIEVE_UM, 0, 1);
  const fraccion = 0.5 / (1 + perfil.focusPoints / 10);
  return { cubiertoUm: cubierto, severidad, radio: Math.round(BLUR_MAX * severidad), fraccion };
}

const idx = (w, x, y) => (y * w + x) * 4;

function desenfocarRegion(data, W, H, rect, radio) {
  if (radio < 1) return;
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y), x1 = Math.min(W, rect.x + rect.w), y1 = Math.min(H, rect.y + rect.h);
  const w = x1 - x0, h = y1 - y0; if (w < 1 || h < 1) return;
  const tmp = new Float32Array(w * h * 3), n = 2 * radio + 1;
  for (let y = 0; y < h; y++) for (let ch = 0; ch < 3; ch++) {
    let acc = 0; for (let k = -radio; k <= radio; k++) acc += data[idx(W, x0 + clamp(k, 0, w - 1), y0 + y) + ch];
    for (let x = 0; x < w; x++) {
      tmp[(y * w + x) * 3 + ch] = acc / n;
      acc += data[idx(W, x0 + clamp(x + radio + 1, 0, w - 1), y0 + y) + ch] - data[idx(W, x0 + clamp(x - radio, 0, w - 1), y0 + y) + ch];
    }
  }
  for (let x = 0; x < w; x++) for (let ch = 0; ch < 3; ch++) {
    let acc = 0; for (let k = -radio; k <= radio; k++) acc += tmp[(clamp(k, 0, h - 1) * w + x) * 3 + ch];
    for (let y = 0; y < h; y++) {
      data[idx(W, x0 + x, y0 + y) + ch] = acc / n;
      acc += tmp[(clamp(y + radio + 1, 0, h - 1) * w + x) * 3 + ch] - tmp[(clamp(y - radio, 0, h - 1) * w + x) * 3 + ch];
    }
  }
}

/** Transformación de color del perfil (ganancia por canal, gamma, saturación, brillo). Operación real sobre los píxeles. */
export function aplicarColor(data, color) {
  const { gain, gamma, sat, bright } = color;
  for (let i = 0; i < data.length; i += 4) {
    const v = [0, 1, 2].map(k => Math.pow(clamp(data[i + k] * gain[k] / 255, 0, 1), gamma));
    const l = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    for (let k = 0; k < 3; k++) data[i + k] = clamp(((l + (v[k] - l) * sat) + bright) * 255, 0, 255);
  }
}

/** Aplica los artefactos elegidos a una copia de `src`. `banderas`: { seams, banding, strips, cast }. Devuelve los píxeles y qué campos se desenfocaron. */
export function procesarArtefactos(src, perfil, banderas, rejilla, semilla = SEMILLA) {
  const { width: W, height: H } = src, out = new Uint8ClampedArray(src.data);
  const rng = mulberry32(semilla);
  // costuras (viñeteo + diferencia de iluminación + desplazamiento de pocos píxeles) y bandas (ganancia por línea)
  if (banderas.seams || banderas.banding) {
    for (const rc of rejilla.rects) {
      const g = banderas.seams ? 1 + (rng() - 0.5) * 0.12 : 1;
      const dx = banderas.seams ? Math.round((rng() - 0.5) * 4) : 0, dy = banderas.seams ? Math.round((rng() - 0.5) * 4) : 0;
      const lineas = banderas.banding ? Array.from({ length: rejilla.linea ? rc.w : rc.h }, () => 1 + (rng() - 0.5) * 0.14) : null;
      for (let y = rc.y; y < Math.min(H, rc.y + rc.h); y++) for (let x = rc.x; x < Math.min(W, rc.x + rc.w); x++) {
        const sx = clamp(x - dx, 0, W - 1), sy = clamp(y - dy, 0, H - 1);
        let f = g;
        if (banderas.seams) { const u = (x - rc.x) / rc.w * 2 - 1, v = (y - rc.y) / rc.h * 2 - 1; f *= 1 - 0.22 * (u * u + v * v) / 2; }
        if (lineas) f *= lineas[rejilla.linea ? x - rc.x : y - rc.y];
        const o = idx(W, x, y), s = idx(W, sx, sy);
        out[o] = src.data[s] * f; out[o + 1] = src.data[s + 1] * f; out[o + 2] = src.data[s + 2] * f; out[o + 3] = 255;
      }
    }
  }
  // franjas desenfocadas
  const desenf = parametrosDesenfoque(perfil); let afectados = [];
  if (banderas.strips && desenf.radio >= 1) {
    const orden = rejilla.rects.map((_, i) => i).sort(() => rng() - 0.5);
    const n = Math.max(1, Math.round(desenf.fraccion * rejilla.rects.length));
    afectados = orden.slice(0, n).sort((a, b) => a - b);
    for (const i of afectados) desenfocarRegion(out, W, H, rejilla.rects[i], desenf.radio);
  }
  // sesgo de color del escáner
  if (banderas.cast) aplicarColor(out, perfil.color);
  return { data: out, width: W, height: H, desenfoque: desenf, afectados };
}

/** Media de cada canal RGB en una región (cálculo sobre la imagen). */
export function mediaRGB(img, rect = { x: 0, y: 0, w: img.width, h: img.height }) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = rect.y; y < Math.min(img.height, rect.y + rect.h); y++) for (let x = rect.x; x < Math.min(img.width, rect.x + rect.w); x++) { const o = idx(img.width, x, y); r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; n++; }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}
/** Varianza del Laplaciano de 4 vecinos sobre el gris de una región: medida de nitidez (la misma idea del control de calidad de E2). */
export function varianzaLaplaciano(img, rect) {
  const W = img.width, gris = (x, y) => { const o = idx(W, x, y); return 0.299 * img.data[o] + 0.587 * img.data[o + 1] + 0.114 * img.data[o + 2]; };
  const x0 = Math.max(1, rect.x), y0 = Math.max(1, rect.y), x1 = Math.min(W - 1, rect.x + rect.w), y1 = Math.min(img.height - 1, rect.y + rect.h);
  let s = 0, s2 = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const l = gris(x - 1, y) + gris(x + 1, y) + gris(x, y - 1) + gris(x, y + 1) - 4 * gris(x, y); s += l; s2 += l * l; n++; }
  return n ? s2 / n - (s / n) * (s / n) : 0;
}
