/* Imagen fuente del núcleo y remuestreo a distintos MPP (submódulo A).
 * Regla de la fase: UNA sola imagen fuente generada con azar con semilla; todas las resoluciones salen de transformar esa misma imagen
 * con operaciones reales (promedio por área, vecino más próximo, interpolación bilineal de Canvas). Nunca se generan imágenes distintas para el antes y el después.
 * La textura es una simulación educativa, no una imagen diagnóstica. */
import { SeededRandom, vnoise, clamp } from '../../engine/util.js';

export const SRC_PX = 768;                 // lado de la imagen fuente en píxeles
export const FIELD_UM = 38.4;              // campo físico de la imagen fuente en µm (0.05 µm/px)
export const SRC_MPP = FIELD_UM / SRC_PX;
export const MPP_MIN = 0.06;               // por debajo de este valor la fuente deja de tener detalle propio

const PAL = {
  he:  { bg: '#F6EEF3', cyto: '#E7B9CC', cytoEdge: '#C98FAA', nuc: [76, 58, 122], nucEdge: '#2E2150', ring: null },
  pap: { bg: '#F1F4F2', cyto: '#BFE3DD', cytoEdge: '#7DB8B0', nuc: [58, 52, 112], nucEdge: '#2A2459', ring: null },
  ihc: { bg: '#F6F2EC', cyto: '#E9DCCB', cytoEdge: '#CDB89B', nuc: [52, 78, 124], nucEdge: '#23365A', ring: '#8A4B1E' }
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Radio del contorno nuclear en la dirección `a`: círculo base más ondulación suave (irregularidad) y ondulación fina */
function radioNuclear(a, r0, irreg, seed) {
  const x = Math.cos(a), y = Math.sin(a);
  const low = vnoise(x * 1.6 + 5, y * 1.6 + 5, seed) - 0.5, high = vnoise(x * 6 + 11, y * 6 + 11, seed + 3) - 0.5;
  return r0 * (1 + irreg * (0.55 * low * 2 + 0.28 * high * 2));
}

/**
 * Genera la imagen fuente. Los parámetros son los de los controles de la interfaz.
 * Cada componente usa su propio generador con semilla derivada, así que cambiar un control no altera el azar de los demás.
 */
export function generarFuente({ seed, nucUm, cellUm, chrom, irreg, modality }) {
  const pal = PAL[modality] || PAL.he, cv = document.createElement('canvas');
  cv.width = SRC_PX; cv.height = SRC_PX;
  const ctx = cv.getContext('2d', { willReadFrequently: true }), c = SRC_PX / 2, ppu = 1 / SRC_MPP;   // píxeles por µm
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, SRC_PX, SRC_PX);
  // fondo con ruido suave
  const bgRng = new SeededRandom(seed * 7919 + 1);
  for (let i = 0; i < 140; i++) { ctx.globalAlpha = 0.05; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(bgRng.range(0, SRC_PX), bgRng.range(0, SRC_PX), bgRng.range(6, 30), 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  // citoplasma: elipse suave
  const rc = cellUm / 2 * ppu;
  ctx.beginPath(); ctx.ellipse(c, c, rc, rc * 0.92, 0.3, 0, 6.283); ctx.fillStyle = pal.cyto; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = pal.cytoEdge; ctx.stroke();
  // núcleo
  const rn = nucUm / 2 * ppu, nSeed = seed * 31 + 5, pts = 160;
  const path = new Path2D();
  for (let i = 0; i <= pts; i++) {
    const a = i / pts * Math.PI * 2, r = radioNuclear(a, rn, irreg, nSeed), px = c + Math.cos(a) * r, py = c + Math.sin(a) * r * 0.95;
    if (i) path.lineTo(px, py); else path.moveTo(px, py);
  }
  path.closePath();
  const [nr, ng, nb] = pal.nuc;
  ctx.fillStyle = `rgba(${nr},${ng},${nb},0.62)`; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  // cromatina: gránulos de 0.3 a 1.1 µm; la cantidad crece con la complejidad
  const chRng = new SeededRandom(seed * 104729 + 3), n = Math.round(30 + chrom * 520);
  for (let i = 0; i < n; i++) {
    const a = chRng.range(0, 6.283), d = Math.sqrt(chRng.next()) * rn * 1.1, sz = chRng.range(0.3, 1.1) * ppu / 2, dark = chRng.range(0.25, 0.85) * (0.35 + 0.65 * chrom);
    ctx.globalAlpha = dark; ctx.fillStyle = `rgb(${Math.round(nr * 0.55)},${Math.round(ng * 0.55)},${Math.round(nb * 0.7)})`;
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.95, sz, 0, 6.283); ctx.fill();
  }
  // nucléolos (1 o 2 según la semilla), 1 a 2 µm
  const nuRng = new SeededRandom(seed * 1299709 + 9), nn = nuRng.next() < 0.5 ? 1 : 2;
  for (let i = 0; i < nn; i++) { ctx.globalAlpha = 0.85; ctx.fillStyle = '#1B1238'; ctx.beginPath(); ctx.arc(c + nuRng.range(-0.3, 0.3) * rn, c + nuRng.range(-0.3, 0.3) * rn, nuRng.range(0.5, 1.0) * ppu, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.restore();
  // membrana nuclear: borde más oscuro; con la irregularidad se ve más grueso y desigual
  ctx.lineWidth = (0.35 + irreg * 0.9) * ppu / 2 + 1; ctx.strokeStyle = pal.nucEdge; ctx.globalAlpha = 0.9; ctx.stroke(path); ctx.globalAlpha = 1;
  if (pal.ring) { ctx.lineWidth = 1.6 * ppu / 2; ctx.strokeStyle = pal.ring; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(c, c, rc, rc * 0.92, 0.3, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  return cv;
}

/** Remuestreo por promedio de área (caja con pesos fraccionarios), separable. Determinista y sin depender del suavizado del navegador. */
export function remuestrearArea(srcData, sw, sh, dw, dh) {
  const src = srcData.data, tmp = new Float32Array(dw * sh * 3), out = new Uint8ClampedArray(dw * dh * 4);
  const kx = sw / dw, ky = sh / dh;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      const a = x * kx, b = (x + 1) * kx; let r = 0, g = 0, bl = 0, wsum = 0;
      for (let i = Math.floor(a); i < Math.min(sw, Math.ceil(b)); i++) {
        const w = Math.min(b, i + 1) - Math.max(a, i), o = (y * sw + i) * 4; r += src[o] * w; g += src[o + 1] * w; bl += src[o + 2] * w; wsum += w;
      }
      const q = (y * dw + x) * 3; tmp[q] = r / wsum; tmp[q + 1] = g / wsum; tmp[q + 2] = bl / wsum;
    }
  }
  for (let x = 0; x < dw; x++) {
    for (let y = 0; y < dh; y++) {
      const a = y * ky, b = (y + 1) * ky; let r = 0, g = 0, bl = 0, wsum = 0;
      for (let j = Math.floor(a); j < Math.min(sh, Math.ceil(b)); j++) {
        const w = Math.min(b, j + 1) - Math.max(a, j), q = (j * dw + x) * 3; r += tmp[q] * w; g += tmp[q + 1] * w; bl += tmp[q + 2] * w; wsum += w;
      }
      const o = (y * dw + x) * 4; out[o] = Math.round(r / wsum); out[o + 1] = Math.round(g / wsum); out[o + 2] = Math.round(bl / wsum); out[o + 3] = 255;
    }
  }
  return new ImageData(out, dw, dh);
}

/** Estado de una imagen fuente con sus remuestreos en caché. `id` cambia solo cuando cambia la fuente. */
export class FuenteNucleo {
  constructor(params) {
    this.params = { ...params };
    this.canvas = generarFuente(params);
    this.data = this.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, SRC_PX, SRC_PX);
    this.id = `${params.seed}|${params.nucUm}|${params.cellUm}|${params.chrom}|${params.irreg}|${params.modality}`;
    this.cache = new Map();
  }
  /** Píxeles por lado de la imagen muestreada con ese MPP (el campo es FIELD_UM) */
  static lado(mpp) { return Math.max(1, Math.round(FIELD_UM / clamp(mpp, MPP_MIN, 1e6))); }
  /** Remuestrea la MISMA fuente a un MPP dado (ImageData de lado × lado) */
  muestreada(mpp) {
    const n = FuenteNucleo.lado(mpp), k = String(n);
    if (!this.cache.has(k)) this.cache.set(k, remuestrearArea(this.data, SRC_PX, SRC_PX, n, n));
    return { n, data: this.cache.get(k), mppReal: FIELD_UM / n };
  }
  /** Vuelve a ampliar la imagen muestreada al tamaño de la fuente con interpolación bilineal (no recupera detalle) */
  reampliada(mpp) {
    const m = this.muestreada(mpp), small = document.createElement('canvas'); small.width = m.n; small.height = m.n;
    small.getContext('2d').putImageData(m.data, 0, 0);
    const big = document.createElement('canvas'); big.width = SRC_PX; big.height = SRC_PX;
    const bx = big.getContext('2d', { willReadFrequently: true }); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high'; bx.drawImage(small, 0, 0, SRC_PX, SRC_PX);
    return bx.getImageData(0, 0, SRC_PX, SRC_PX);
  }
  /** Diferencia absoluta media entre la fuente y su versión muestreada y reampliada (0-255) y el mapa de diferencia */
  diferencia(mpp) {
    const up = this.reampliada(mpp), a = this.data.data, b = up.data, out = new Uint8ClampedArray(SRC_PX * SRC_PX * 4);
    let sum = 0;
    for (let i = 0; i < SRC_PX * SRC_PX; i++) {
      const o = i * 4, d = (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2])) / 3; sum += d;
      const v = clamp(d * 4 / 255), k = v < 0.5 ? v / 0.5 : (v - 0.5) / 0.5, from = v < 0.5 ? [255, 255, 255] : [217, 119, 6], to = v < 0.5 ? [217, 119, 6] : [190, 18, 60];
      out[o] = Math.round(from[0] + (to[0] - from[0]) * k); out[o + 1] = Math.round(from[1] + (to[1] - from[1]) * k); out[o + 2] = Math.round(from[2] + (to[2] - from[2]) * k); out[o + 3] = 255;
    }
    return { media: sum / (SRC_PX * SRC_PX), mapa: new ImageData(out, SRC_PX, SRC_PX), reampliada: up };
  }
}

/** Dibuja una región cuadrada centrada de `datos` (ImageData de lado n) en `cv`, con vecino más próximo (se ven los píxeles) o suavizado */
export function dibujarRecorte(cv, datos, n, zoom, { pixelado = true, rejilla = false } = {}) {
  const side = Math.max(1, Math.min(n, Math.round(n / zoom))), x0 = Math.floor((n - side) / 2), tmp = document.createElement('canvas');
  tmp.width = n; tmp.height = n; tmp.getContext('2d').putImageData(datos, 0, 0);
  const ctx = cv.getContext('2d'), W = cv.width;
  ctx.imageSmoothingEnabled = !pixelado; ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, W, W); ctx.drawImage(tmp, x0, x0, side, side, 0, 0, W, W);
  const pxScreen = W / side;
  if (rejilla && pxScreen >= 6) {
    ctx.strokeStyle = 'rgba(15,23,42,0.28)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= side; i++) { const p = Math.round(i * pxScreen) + 0.5; ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.moveTo(0, p); ctx.lineTo(W, p); }
    ctx.stroke();
  }
  return { side, pxScreen };
}

/** Barra de escala: elige un largo "redondo" en µm que ocupe cerca de un cuarto del lado, la dibuja y devuelve su rótulo numérico */
export function dibujarBarra(cv, campoUm, texto) {
  const ctx = cv.getContext('2d'), W = cv.width, nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
  const target = campoUm / 4; let barUm = nice[0]; for (const v of nice) if (v <= target * 1.3) barUm = v;
  const len = barUm / campoUm * W;
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(8, W - 30, Math.max(len + 16, 64), 22);
  ctx.fillStyle = '#0F172A'; ctx.fillRect(14, W - 18, len, 4);
  ctx.font = '600 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(texto(barUm), 14, W - 21);
  return barUm;
}

/** Escena sintética de varias células para el caso de fallo: la misma escena se muestrea con distintos MPP (dibujo vectorial con semilla fija) */
export function escenaCelulas(seed = 21, n = 14, lado = 140) {
  const rng = new SeededRandom(seed), cells = [];
  for (let i = 0; i < n; i++) cells.push({ x: rng.range(-lado / 2, lado / 2), y: rng.range(-lado / 2, lado / 2), rn: rng.range(3.4, 5.2), rc: rng.range(8, 12), rot: rng.range(0, 3), k: rng.next() });
  return cells;
}
export function dibujarEscena(cv, cells, mpp, px, centroUm, modality) {
  const pal = PAL[modality] || PAL.he, ctx = cv.getContext('2d'), s = 1 / mpp;   // píxeles por µm de la imagen muestreada
  cv.width = px; cv.height = px; ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, px, px);
  const X = u => (u - centroUm.x) * s + px / 2, Y = v => (v - centroUm.y) * s + px / 2, [nr, ng, nb] = pal.nuc;
  for (const c of cells) {
    ctx.beginPath(); ctx.ellipse(X(c.x), Y(c.y), c.rc * s, c.rc * 0.9 * s, c.rot, 0, 6.283); ctx.fillStyle = pal.cyto; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(X(c.x), Y(c.y), c.rn * s, c.rn * 0.92 * s, c.rot, 0, 6.283); ctx.fillStyle = `rgba(${nr},${ng},${nb},${0.55 + 0.35 * c.k})`; ctx.fill();
  }
}
