/* Motor matemático de la ruta P (resolución espacial y diseño de parches).
 *
 * Funciones puras: sin DOM, sin Three.js y sin lectura del estado de la aplicación. Toda cifra de resolución
 * que muestre la interfaz sale de aquí, y cada función se prueba en Node (tests/unit/patch-math.test.mjs).
 *
 * Reglas del motor (ROADMAP, sección 6, ruta P):
 *  - Trabaja por eje (X e Y). Un MPP escalar significa "el mismo en X y en Y" y se declara así; nunca se completa en silencio.
 *  - Si falta el MPP, es nulo, cero, negativo o no numérico, lanza PatchMathError. No existe un MPP por defecto
 *    (ni 0.25 ni 0.5): una imagen sin calibración física no tiene tamaño físico.
 *  - Separa siempre: MPP original, nivel y downsample, tamaño de extracción, tamaño del tile almacenado,
 *    tamaño de entrada del encoder, campo visual (FOV) y MPP efectivo.
 *  - No contiene equivalencias entre aumento nominal y MPP, ni factores de pirámide supuestos, ni resoluciones "óptimas".
 *
 * Unidades: MPP en µm/px; FOV en µm; tamaños en píxeles; bytes en bytes. */

/* ------------------------------------------------------------------ errores */

/** Error del motor. `code` es estable (la interfaz lo traduce), `field` indica el campo que falló. */
export class PatchMathError extends Error {
  constructor(code, field, message, detail) {
    super(message);
    this.name = 'PatchMathError';
    this.code = code;
    this.field = field || null;
    if (detail !== undefined) this.detail = detail;
  }
}
const fail = (code, field, message, detail) => { throw new PatchMathError(code, field, message, detail); };

/** Ejecuta `fn` y devuelve { ok, value } o { ok:false, error:{ code, field, message } } sin lanzar (para la interfaz). */
export function intentar(fn, ...args) {
  try { return { ok: true, value: fn(...args) }; } catch (e) {
    if (e instanceof PatchMathError) return { ok: false, error: { code: e.code, field: e.field, message: e.message } };
    throw e;
  }
}

/* ------------------------------------------------------------------ validación de entradas */

const esNumero = v => typeof v === 'number' && Number.isFinite(v);

function mppEscalar(v, campo) {
  if (v === undefined || v === null) fail('MPP_AUSENTE', campo, `Falta el MPP (${campo}). El motor no sustituye un MPP ausente por ningún valor.`);
  if (!esNumero(v) || v <= 0) fail('MPP_INVALIDO', campo, `MPP inválido en ${campo}: debe ser un número finito mayor que 0 (recibido: ${String(v)}).`, v);
  return v;
}

/** Convierte un MPP (número = igual en X e Y, u objeto {x, y}) a { x, y }. Lanza si falta o no es válido. */
export function mppPorEje(mpp, campo = 'mpp') {
  if (mpp === undefined || mpp === null) fail('MPP_AUSENTE', campo, `Falta el MPP (${campo}). El motor no sustituye un MPP ausente por ningún valor.`);
  if (typeof mpp === 'number') { const v = mppEscalar(mpp, campo); return { x: v, y: v }; }
  if (typeof mpp === 'object') return { x: mppEscalar(mpp.x, `${campo}.x`), y: mppEscalar(mpp.y, `${campo}.y`) };
  return fail('MPP_INVALIDO', campo, `MPP inválido en ${campo}: se espera un número o un objeto {x, y}.`, mpp);
}

/** Convierte el texto de un metadato (por ejemplo, openslide.mpp-x) a número. Texto vacío, ausente o no numérico lanza error. */
export function parseMpp(valor, campo = 'mpp') {
  if (valor === undefined || valor === null) fail('MPP_AUSENTE', campo, `Falta el MPP (${campo}).`);
  if (typeof valor === 'number') return mppEscalar(valor, campo);
  if (typeof valor !== 'string' || !/^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(valor)) fail('MPP_INVALIDO', campo, `MPP no numérico en ${campo}: "${String(valor)}".`, valor);
  return mppEscalar(Number(valor), campo);
}

function enteroPositivo(v, campo, code = 'TAMANO_INVALIDO') {
  if (v === undefined || v === null) fail('TAMANO_AUSENTE', campo, `Falta el valor ${campo}.`);
  if (!esNumero(v) || !Number.isInteger(v) || v < 1) fail(code, campo, `${campo} debe ser un entero mayor o igual que 1 (recibido: ${String(v)}).`, v);
  return v;
}
function positivo(v, campo, code = 'VALOR_INVALIDO') {
  if (v === undefined || v === null) fail('TAMANO_AUSENTE', campo, `Falta el valor ${campo}.`);
  if (!esNumero(v) || v <= 0) fail(code, campo, `${campo} debe ser un número finito mayor que 0 (recibido: ${String(v)}).`, v);
  return v;
}

/** Tamaño en píxeles por eje: número (cuadrado) u objeto {w, h} o {x, y}. Devuelve { x, y } con enteros >= 1. */
export function tamanoPorEje(v, campo = 'tamano') {
  if (v === undefined || v === null) fail('TAMANO_AUSENTE', campo, `Falta el tamaño ${campo}.`);
  if (typeof v === 'number') { const n = enteroPositivo(v, campo); return { x: n, y: n }; }
  if (typeof v === 'object') {
    const w = v.w !== undefined ? v.w : v.x, h = v.h !== undefined ? v.h : v.y;
    return { x: enteroPositivo(w, `${campo}.x`), y: enteroPositivo(h, `${campo}.y`) };
  }
  return fail('TAMANO_INVALIDO', campo, `${campo} debe ser un número o un objeto {w, h}.`, v);
}
/** Igual que tamanoPorEje pero para el stride (código de error propio). */
function stridePorEje(v, campo = 'stride') {
  if (v === undefined || v === null) fail('STRIDE_AUSENTE', campo, `Falta el stride (${campo}).`);
  if (typeof v === 'number') { const n = enteroPositivo(v, campo, 'STRIDE_INVALIDO'); return { x: n, y: n }; }
  if (typeof v === 'object') {
    const w = v.w !== undefined ? v.w : v.x, h = v.h !== undefined ? v.h : v.y;
    return { x: enteroPositivo(w, `${campo}.x`, 'STRIDE_INVALIDO'), y: enteroPositivo(h, `${campo}.y`, 'STRIDE_INVALIDO') };
  }
  return fail('STRIDE_INVALIDO', campo, `${campo} debe ser un número o un objeto {x, y}.`, v);
}
/** Valor por eje sin exigir enteros (campo visual, diámetros, etc.): número u objeto {x, y}. */
function realPorEje(v, campo) {
  if (v === undefined || v === null) fail('TAMANO_AUSENTE', campo, `Falta el valor ${campo}.`);
  if (typeof v === 'number') { const n = positivo(v, campo); return { x: n, y: n }; }
  if (typeof v === 'object') return { x: positivo(v.x, `${campo}.x`), y: positivo(v.y, `${campo}.y`) };
  return fail('VALOR_INVALIDO', campo, `${campo} debe ser un número o un objeto {x, y}.`, v);
}

/** Downsample de un nivel: número finito >= 1 (puede no ser entero: OpenSlide reporta valores como 4.0001). */
export function validarDownsample(ds, campo = 'downsample') {
  if (ds === undefined || ds === null) fail('DOWNSAMPLE_AUSENTE', campo, `Falta el downsample (${campo}).`);
  if (!esNumero(ds) || ds < 1) fail('DOWNSAMPLE_INVALIDO', campo, `El downsample debe ser un número finito mayor o igual que 1 (recibido: ${String(ds)}).`, ds);
  return ds;
}

/* ------------------------------------------------------------------ resolución */

/** MPP de extracción = MPP de la WSI × downsample del nivel de lectura. Devuelve { x, y }. */
export function mppExtraccion(mppWsi, downsample) {
  const m = mppPorEje(mppWsi, 'mppWsi'), d = validarDownsample(downsample);
  return { x: m.x * d, y: m.y * d };
}

/** Campo visual (µm) de una región de `tamanoExtraccion` píxeles a un MPP de extracción dado. Devuelve { x, y }. */
export function fov(tamanoExtraccion, mppExtr) {
  const s = tamanoPorEje(tamanoExtraccion, 'tamanoExtraccion'), m = mppPorEje(mppExtr, 'mppExtraccion');
  return { x: s.x * m.x, y: s.y * m.y };
}

/** MPP efectivo en la entrada del encoder = FOV / tamaño de entrada. `campoVisual` en µm ({x, y} o número). */
export function mppEncoder(campoVisual, entradaEncoder) {
  const f = realPorEje(campoVisual, 'fov'), e = tamanoPorEje(entradaEncoder, 'entradaEncoder');
  return { x: f.x / e.x, y: f.y / e.y };
}

/** Factor de remuestreo lineal = tamaño de extracción / tamaño de entrada (mayor que 1: reducción; menor que 1: ampliación). */
export function factorResize(extraccion, entrada) {
  const a = tamanoPorEje(extraccion, 'extraccion'), b = tamanoPorEje(entrada, 'entrada');
  return { x: a.x / b.x, y: a.y / b.y };
}

/** Píxeles que ocupa una estructura de `diametroUm` a un MPP dado, por eje (y área elíptica aproximada). */
export function pixelesNucleo(diametroUm, mppEfectivo) {
  const d = realPorEje(diametroUm, 'diametroUm'), m = mppPorEje(mppEfectivo, 'mppEncoder');
  const x = d.x / m.x, y = d.y / m.y;
  return { x, y, areaPx: Math.PI / 4 * x * y };
}

/** Periodo espacial mínimo que un muestreo a `mpp` puede representar sin aliasing (2 píxeles por periodo), en µm. */
export function periodoMinimoResoluble(mpp) {
  const m = mppPorEje(mpp, 'mpp');
  return { x: 2 * m.x, y: 2 * m.y };
}
/** Frecuencia de Nyquist del muestreo, en ciclos por µm: 1 / (2 · MPP). */
export function frecuenciaNyquist(mpp) {
  const m = mppPorEje(mpp, 'mpp');
  return { x: 1 / (2 * m.x), y: 1 / (2 * m.y) };
}
/** Límite de resolución de Abbe, en µm: λ / (2·NA). `lambdaNm` en nanómetros. */
export function limiteAbbe(lambdaNm, na) {
  return positivo(lambdaNm, 'lambdaNm') / 1000 / (2 * positivo(na, 'na'));
}
/** Criterio de Rayleigh, en µm: 0.61·λ / NA. `lambdaNm` en nanómetros. */
export function limiteRayleigh(lambdaNm, na) {
  return 0.61 * positivo(lambdaNm, 'lambdaNm') / 1000 / positivo(na, 'na');
}
/** MPP máximo que cumple el criterio de Nyquist para un límite de resolución óptico `limiteUm`: límite / 2. */
export function mppMaximoNyquist(limiteUm) { return positivo(limiteUm, 'limiteUm') / 2; }
/** Estado de muestreo frente a un límite óptico: razón = límite / MPP (píxeles por límite de resolución). Nyquist pide al menos 2. */
export function muestreoFrenteAlLimite(mpp, limiteUm) {
  const m = mppPorEje(mpp, 'mpp'), l = positivo(limiteUm, 'limiteUm');
  const rx = l / m.x, ry = l / m.y;
  return { x: rx, y: ry, cumpleNyquist: rx >= 2 && ry >= 2, submuestreado: rx < 2 || ry < 2 };
}
/** Píxeles por pulgada en el plano de la muestra para un MPP dado (1 pulgada = 25 400 µm). */
export function mppAPpi(mpp) { const m = mppPorEje(mpp, 'mpp'); return { x: 25400 / m.x, y: 25400 / m.y }; }
/** MPP a partir de píxeles por metro (por ejemplo, la cabecera pHYs de un PNG). Solo convierte unidades: no valida la calibración. */
export function mppDesdePixelesPorMetro(ppm) { return 1e6 / positivo(ppm, 'pixelesPorMetro'); }

/** Tabla ilustrativa de MPP frente a aumento nominal. NO es una equivalencia universal: depende del sistema óptico, del sensor y del escáner.
 *  Toda entrada lleva `ilustrativa: true`; la interfaz debe rotularla como aproximación. */
export const TABLA_MPP_AUMENTO_ILUSTRATIVA = Object.freeze([
  { mpp: 0.125, aumento: 80, ilustrativa: true },
  { mpp: 0.25, aumento: 40, ilustrativa: true },
  { mpp: 0.5, aumento: 20, ilustrativa: true },
  { mpp: 1.0, aumento: 10, ilustrativa: true },
  { mpp: 2.0, aumento: 5, ilustrativa: true }
].map(Object.freeze));

/* ------------------------------------------------------------------ teselado */

export const POLITICAS_BORDE = Object.freeze(['descartar', 'rellenar', 'ultima-ventana', 'roi']);

/** Solapamiento = 1 - stride / parche, por eje. Si el stride supera al parche hay huecos: el solapamiento es 0 y `hueco` da su ancho en px. */
export function overlap(patch, stride) {
  const P = tamanoPorEje(patch, 'patch'), S = stridePorEje(stride, 'stride');
  const ox = Math.max(0, 1 - S.x / P.x), oy = Math.max(0, 1 - S.y / P.y);
  const hx = Math.max(0, S.x - P.x), hy = Math.max(0, S.y - P.y);
  return {
    x: ox, y: oy, hueco: { x: hx, y: hy }, hayHueco: hx > 0 || hy > 0,
    /** fracción del eje que cubre cada ventana respecto de su paso (1 = sin huecos) */
    cobertura: { x: Math.min(1, P.x / S.x), y: Math.min(1, P.y / S.y) }
  };
}

/* Número de ventanas por eje según la política (W: longitud de la región, P: parche, S: stride, todos en px) */
function ventanasEje(W, P, S, politica) {
  if (politica === 'descartar' || politica === 'roi') return W < P ? 0 : Math.floor((W - P) / S) + 1;
  if (politica === 'ultima-ventana') {
    if (W < P) return 0;
    const n = Math.floor((W - P) / S) + 1;
    return (n - 1) * S + P < W ? n + 1 : n;           // ventana extra pegada al borde si la última no lo alcanza
  }
  if (politica === 'rellenar') {
    // ventanas que empiezan en k·S dentro de la región, sin añadir ventanas cuando la anterior ya llegó al borde
    if (W <= P) return 1;
    return Math.min(Math.ceil(W / S), Math.ceil((W - P) / S) + 1);
  }
  return fail('POLITICA_INVALIDA', 'politicaBorde', `Política de borde desconocida: ${String(politica)}.`, politica);
}
/* Longitud de la región cubierta por al menos una ventana, y píxeles de relleno artificial, por eje */
function coberturaEje(W, P, S, n, politica) {
  if (n === 0) return { cubierta: 0, relleno: 0 };
  const extra = politica === 'ultima-ventana' && (n - 1) * S + P > W;      // la última ventana va pegada al borde
  const ultimo = extra ? W - P : (n - 1) * S;
  const fin = ultimo + P, reales = Math.min(W, fin);
  let cubierta;
  if (S <= P) cubierta = reales;                                           // ventanas contiguas o solapadas: un solo tramo
  else {
    const finPrevia = n >= 2 ? (n - 2) * S + P : 0;                       // con huecos, solo puede solaparse la última con su anterior
    cubierta = (n - 1) * P + (reales - ultimo) - (n >= 2 ? Math.max(0, finPrevia - ultimo) : 0);
  }
  return { cubierta: Math.min(W, cubierta), relleno: politica === 'rellenar' ? Math.max(0, fin - W) : 0 };
}

/**
 * Número teórico de ventanas (tiles) sobre una región de W×H píxeles.
 * Políticas: 'descartar' (solo ventanas completas: Nx = max(0, floor((W-P)/S)+1)), 'rellenar' (ventanas con relleno en el borde),
 * 'ultima-ventana' (ventanas completas más una última pegada al borde) y 'roi' (ventanas completas dentro de una ROI rectangular
 * `opciones.roi = {w, h}`: W y H se sustituyen por las dimensiones de la ROI).
 * Es un conteo teórico: no descuenta lo que el control de calidad o una máscara de tejido descarten después.
 */
export function numeroTiles(W, H, P, S, politicaBorde = 'descartar', opciones = {}) {
  if (!POLITICAS_BORDE.includes(politicaBorde)) fail('POLITICA_INVALIDA', 'politicaBorde', `Política de borde desconocida: ${String(politicaBorde)}.`, politicaBorde);
  let region = { x: enteroPositivo(W, 'W'), y: enteroPositivo(H, 'H') };
  if (politicaBorde === 'roi') {
    if (!opciones || opciones.roi === undefined || opciones.roi === null) fail('ROI_AUSENTE', 'roi', 'La política "roi" necesita opciones.roi = {w, h}.');
    const r = tamanoPorEje(opciones.roi, 'roi');
    if (r.x > region.x || r.y > region.y) fail('ROI_FUERA', 'roi', 'La ROI no cabe dentro de la región (W×H).', opciones.roi);
    region = r;
  }
  const p = tamanoPorEje(P, 'P'), s = stridePorEje(S, 'S');
  const nx = ventanasEje(region.x, p.x, s.x, politicaBorde), ny = ventanasEje(region.y, p.y, s.y, politicaBorde);
  const cx = coberturaEje(region.x, p.x, s.x, nx, politicaBorde), cy = coberturaEje(region.y, p.y, s.y, ny, politicaBorde);
  const sinCubrir = { x: Math.max(0, region.x - cx.cubierta), y: Math.max(0, region.y - cy.cubierta) };
  const solape = overlap(p, s);
  return {
    nx, ny, total: nx * ny, politica: politicaBorde, region, parche: p, stride: s,
    hayHuecos: solape.hayHueco, solapamiento: { x: solape.x, y: solape.y },
    /** px de cada eje que ninguna ventana cubre (borde descartado o huecos por stride mayor que el parche) */
    pxSinCubrir: sinCubrir, /** px de relleno artificial en la última ventana (solo política 'rellenar') */ pxRelleno: { x: cx.relleno, y: cy.relleno },
    cubreRegion: nx > 0 && ny > 0 && sinCubrir.x === 0 && sinCubrir.y === 0,
    teorico: true
  };
}

/** Reducción de píxeles al pasar de un tamaño `origen` a `destino`: fracción de píxeles que se pierde y factor lineal por eje.
 *  Un valor negativo indica ampliación. La reducción de píxeles NO equivale a un porcentaje de información diagnóstica perdida. */
export function reduccionPixeles(origen, destino) {
  const o = tamanoPorEje(origen, 'origen'), d = tamanoPorEje(destino, 'destino');
  const po = o.x * o.y, pd = d.x * d.y;
  return {
    pixelesOrigen: po, pixelesDestino: pd, reduccion: 1 - pd / po,
    factorLineal: { x: o.x / d.x, y: o.y / d.y }, factorAreal: po / pd,
    esAmpliacion: pd > po
  };
}

/* ------------------------------------------------------------------ almacenamiento y ViT */

export const BYTES_POR_VALOR = Object.freeze({ int8: 1, float16: 2, float32: 4, float64: 8 });
function bytesValor(b, campo = 'bytesPorValor') {
  if (typeof b === 'string') { if (!(b in BYTES_POR_VALOR)) fail('VALOR_INVALIDO', campo, `Tipo de dato desconocido: ${b}.`, b); return BYTES_POR_VALOR[b]; }
  return enteroPositivo(b, campo, 'VALOR_INVALIDO');
}
const seguro = (n, campo) => { if (!Number.isSafeInteger(n)) fail('DESBORDE', campo, `El resultado supera el mayor entero exacto de JavaScript (${campo}).`, n); return n; };

/** Bytes de n tiles RGB sin comprimir de tamaño P (3 bytes por píxel, 8 bits por canal). */
export function bytesRgb(n, P) {
  const cnt = typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : fail('VALOR_INVALIDO', 'n', `El número de tiles debe ser un entero mayor o igual que 0 (recibido: ${String(n)}).`, n);
  const p = tamanoPorEje(P, 'P');
  return seguro(cnt * p.x * p.y * 3, 'bytesRgb');
}
/** Bytes de n embeddings de dimensión `dim` con `bytesPorValor` (número o 'float32', 'float16', ...). Un embedding no es una imagen: no tiene MPP. */
export function bytesEmbeddings(n, dim, bytesPorValor = 'float32') {
  const cnt = typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : fail('VALOR_INVALIDO', 'n', `El número de embeddings debe ser un entero mayor o igual que 0 (recibido: ${String(n)}).`, n);
  return seguro(cnt * enteroPositivo(dim, 'dim', 'VALOR_INVALIDO') * bytesValor(bytesPorValor), 'bytesEmbeddings');
}

/** Tokens espaciales de un ViT: (entrada / token) por eje. Si la entrada no es múltiplo del token, `exacto` es falso y `resto` da los
 *  píxeles sobrantes (qué hace un modelo concreto con ese resto depende de su implementación: se informa, no se supone). */
export function tokensVit(entrada, token, tokensEspeciales = 0) {
  const e = tamanoPorEje(entrada, 'entrada'), t = tamanoPorEje(token, 'token');
  const esp = typeof tokensEspeciales === 'number' && Number.isInteger(tokensEspeciales) && tokensEspeciales >= 0 ? tokensEspeciales : fail('VALOR_INVALIDO', 'tokensEspeciales', 'Los tokens especiales deben ser un entero mayor o igual que 0.', tokensEspeciales);
  const gx = Math.floor(e.x / t.x), gy = Math.floor(e.y / t.y), resto = { x: e.x - gx * t.x, y: e.y - gy * t.y };
  return { cuadricula: { x: gx, y: gy }, tokens: gx * gy, especiales: esp, total: gx * gy + esp, exacto: resto.x === 0 && resto.y === 0, resto };
}

/**
 * Tamaño de extracción necesario para que la entrada del encoder tenga el MPP efectivo `mppObjetivo`:
 * extraccion = entrada × mppObjetivo / mppExtraccion, por eje. Devuelve el valor exacto, el entero más cercano y el error de redondeo.
 * `mppExtr` es el MPP al que se lee la región (ya incluye el downsample del nivel, ver mppExtraccion).
 */
export function tamanoParcheParaMpp(entrada, mppObjetivo, mppExtr) {
  const e = tamanoPorEje(entrada, 'entrada'), o = mppPorEje(mppObjetivo, 'mppObjetivo'), m = mppPorEje(mppExtr, 'mppExtraccion');
  const exacto = { x: e.x * o.x / m.x, y: e.y * o.y / m.y };
  const redondeado = { x: Math.max(1, Math.round(exacto.x)), y: Math.max(1, Math.round(exacto.y)) };
  const mppResultante = { x: redondeado.x * m.x / e.x, y: redondeado.y * m.y / e.y };
  return {
    exacto, redondeado, mppResultante,
    errorMpp: { x: mppResultante.x - o.x, y: mppResultante.y - o.y },
    errorRelativo: { x: (mppResultante.x - o.x) / o.x, y: (mppResultante.y - o.y) / o.y },
    esEntero: Number.isInteger(exacto.x) && Number.isInteger(exacto.y)
  };
}

/* ------------------------------------------------------------------ pirámide */

/** MPP de un nivel = MPP nativo × downsample del nivel. No supone ningún factor: el downsample lo da el archivo o el usuario. */
export function mppNivel(mppNativo, downsampleNivel) { return mppExtraccion(mppNativo, downsampleNivel); }

/** Campo visual (µm) de una región de `tamanoPx` píxeles leída en un nivel con `downsampleNivel`. */
export function campoVisualNivel(tamanoPx, mppNativo, downsampleNivel) { return fov(tamanoPx, mppExtraccion(mppNativo, downsampleNivel)); }

/** Dimensiones aproximadas de un nivel a partir del nivel 0 y su downsample (la dimensión real la reporta level_dimensions). */
export function dimensionesNivelAprox(dimNivel0, downsampleNivel) {
  const d = tamanoPorEje(dimNivel0, 'dimNivel0'), ds = validarDownsample(downsampleNivel);
  return { x: Math.max(1, Math.round(d.x / ds)), y: Math.max(1, Math.round(d.y / ds)), aproximada: true };
}
/** Downsample de un nivel a partir de las dimensiones reales del nivel 0 y del nivel (así lo reporta OpenSlide, promediado por eje). */
export function downsampleDesdeDimensiones(dimNivel0, dimNivel) {
  const a = tamanoPorEje(dimNivel0, 'dimNivel0'), b = tamanoPorEje(dimNivel, 'dimNivel');
  return { x: a.x / b.x, y: a.y / b.y, medio: (a.x / b.x + a.y / b.y) / 2 };
}

/**
 * Construye una pirámide configurable. `downsamples` es la lista de factores de cada nivel en el orden de OpenSlide
 * (nivel 0 = mayor resolución, downsample 1, y estrictamente creciente). Devuelve una fila por nivel con su MPP por eje.
 */
export function construirPiramide({ mppNativo, dimensionesNivel0, downsamples }) {
  const m = mppPorEje(mppNativo, 'mppNativo');
  const dim = dimensionesNivel0 === undefined || dimensionesNivel0 === null ? null : tamanoPorEje(dimensionesNivel0, 'dimensionesNivel0');
  if (!Array.isArray(downsamples) || downsamples.length === 0) fail('PIRAMIDE_INVALIDA', 'downsamples', 'La pirámide necesita al menos un nivel.');
  downsamples.forEach((d, i) => validarDownsample(d, `downsamples[${i}]`));
  if (downsamples[0] !== 1) fail('PIRAMIDE_INVALIDA', 'downsamples[0]', 'El nivel 0 tiene downsample 1 por definición (es el de mayor resolución).', downsamples[0]);
  for (let i = 1; i < downsamples.length; i++) if (!(downsamples[i] > downsamples[i - 1])) fail('PIRAMIDE_INVALIDA', `downsamples[${i}]`, 'El downsample debe crecer estrictamente de un nivel al siguiente.', downsamples[i]);
  return downsamples.map((ds, nivel) => ({
    nivel, downsample: ds, mpp: { x: m.x * ds, y: m.y * ds },
    dimensiones: dim ? dimensionesNivelAprox(dim, ds) : null
  }));
}

const ORDENES_INTERFAZ = ['menor-a-mayor', 'mayor-a-menor'];
function indiceEntero(i, total, campo) {
  if (!Number.isInteger(total) || total < 1) fail('NIVEL_INVALIDO', 'total', `El número de niveles debe ser un entero mayor o igual que 1 (recibido: ${String(total)}).`, total);
  if (!Number.isInteger(i) || i < 0 || i >= total) fail('NIVEL_INVALIDO', campo, `${campo} debe ser un entero entre 0 y ${total - 1} (recibido: ${String(i)}).`, i);
  return i;
}
/**
 * Convierte el índice de la interfaz en el nivel de OpenSlide (nivel 0 = mayor resolución).
 * `ordenInterfaz`: 'menor-a-mayor' (índice 0 = menor resolución, como los planos de la v3.0) o 'mayor-a-menor' (índice 0 = mayor resolución).
 */
export function indiceInterfazANivelOpenSlide(indice, total, ordenInterfaz = 'menor-a-mayor') {
  if (!ORDENES_INTERFAZ.includes(ordenInterfaz)) fail('ORDEN_INVALIDO', 'ordenInterfaz', `Orden desconocido: ${String(ordenInterfaz)}.`, ordenInterfaz);
  indiceEntero(indice, total, 'indice');
  return ordenInterfaz === 'mayor-a-menor' ? indice : total - 1 - indice;
}
/** Inversa de indiceInterfazANivelOpenSlide. */
export function nivelOpenSlideAIndiceInterfaz(nivel, total, ordenInterfaz = 'menor-a-mayor') {
  if (!ORDENES_INTERFAZ.includes(ordenInterfaz)) fail('ORDEN_INVALIDO', 'ordenInterfaz', `Orden desconocido: ${String(ordenInterfaz)}.`, ordenInterfaz);
  indiceEntero(nivel, total, 'nivel');
  return ordenInterfaz === 'mayor-a-menor' ? nivel : total - 1 - nivel;
}

/**
 * Semántica de read_region(location, level, size): `location` está en coordenadas del nivel 0 (esquina superior izquierda),
 * `size` está en píxeles del nivel pedido. La región cubre size × downsample píxeles del nivel 0.
 */
export function regionOpenSlide({ ubicacion0, downsampleNivel, tamano }) {
  if (ubicacion0 === undefined || ubicacion0 === null || !esNumero(ubicacion0.x) || !esNumero(ubicacion0.y)) fail('VALOR_INVALIDO', 'ubicacion0', 'La ubicación debe ser {x, y} en coordenadas del nivel 0.', ubicacion0);
  const ds = validarDownsample(downsampleNivel), s = tamanoPorEje(tamano, 'tamano');
  return {
    origenNivel0: { x: ubicacion0.x, y: ubicacion0.y },
    extensionNivel0: { x: s.x * ds, y: s.y * ds },
    /** la misma esquina expresada en píxeles del nivel (solo para dibujar: read_region NO la usa) */
    origenEnNivel: { x: ubicacion0.x / ds, y: ubicacion0.y / ds },
    tamanoNivel: s
  };
}

/** Modo "campo visual fijo": cuántos píxeles ocupa un campo de `fovUm` en cada nivel (por eje). */
export function modoCampoFijo(fovUm, niveles) {
  const f = realPorEje(fovUm, 'fovUm');
  return niveles.map(n => ({ nivel: n.nivel, downsample: n.downsample, mpp: n.mpp, pixeles: { x: f.x / n.mpp.x, y: f.y / n.mpp.y } }));
}
/** Modo "tamaño digital fijo": qué campo visual (µm) cubren `tamanoPx` píxeles en cada nivel (por eje). */
export function modoTamanoFijo(tamanoPx, niveles) {
  const s = tamanoPorEje(tamanoPx, 'tamanoPx');
  return niveles.map(n => ({ nivel: n.nivel, downsample: n.downsample, mpp: n.mpp, fov: { x: s.x * n.mpp.x, y: s.y * n.mpp.y } }));
}

/* ------------------------------------------------------------------ patchConfig */

export const PATCH_CONFIG_ESQUEMA = 'patch-config';
export const PATCH_CONFIG_VERSION = 1;

/**
 * Crea y valida un objeto de configuración de parche con los campos separados:
 *   mppOriginal {x, y}      MPP de la WSI en el nivel 0 (obligatorio, sin valor por defecto)
 *   nivel                   índice del nivel de OpenSlide donde se lee la región (0 = mayor resolución)
 *   downsample              downsample de ese nivel (>= 1; para el nivel 0 es 1)
 *   tamanoExtraccion {w,h}  píxeles leídos en ese nivel
 *   tamanoTile {w,h}        píxeles del tile almacenado (null = igual a la extracción, sin remuestreo intermedio)
 *   entradaEncoder {w,h}    píxeles de la entrada del encoder
 *   stride {x,y}            paso entre ventanas, en píxeles del nivel
 *   politicaBorde           'descartar' | 'rellenar' | 'ultima-ventana' | 'roi'
 *   etiqueta                texto libre opcional
 * Lanza PatchMathError con el primer campo inválido.
 */
export function crearPatchConfig(entrada) {
  if (entrada === undefined || entrada === null || typeof entrada !== 'object') fail('CONFIG_INVALIDA', null, 'La configuración debe ser un objeto.');
  const mppOriginal = mppPorEje(entrada.mppOriginal, 'mppOriginal');
  const nivel = entrada.nivel === undefined || entrada.nivel === null ? fail('NIVEL_INVALIDO', 'nivel', 'Falta el nivel de lectura.') : entrada.nivel;
  if (!Number.isInteger(nivel) || nivel < 0) fail('NIVEL_INVALIDO', 'nivel', `El nivel debe ser un entero mayor o igual que 0 (recibido: ${String(nivel)}).`, nivel);
  const downsample = validarDownsample(entrada.downsample);
  if (nivel === 0 && downsample !== 1) fail('DOWNSAMPLE_INVALIDO', 'downsample', 'El nivel 0 tiene downsample 1.', downsample);
  const te = tamanoPorEje(entrada.tamanoExtraccion, 'tamanoExtraccion');
  const tt = entrada.tamanoTile === null || entrada.tamanoTile === undefined ? te : tamanoPorEje(entrada.tamanoTile, 'tamanoTile');
  const ee = tamanoPorEje(entrada.entradaEncoder, 'entradaEncoder');
  const st = stridePorEje(entrada.stride, 'stride');
  const politicaBorde = entrada.politicaBorde === undefined ? 'descartar' : entrada.politicaBorde;
  if (!POLITICAS_BORDE.includes(politicaBorde)) fail('POLITICA_INVALIDA', 'politicaBorde', `Política de borde desconocida: ${String(politicaBorde)}.`, politicaBorde);
  const etiqueta = entrada.etiqueta === undefined || entrada.etiqueta === null ? '' : String(entrada.etiqueta);
  return {
    version: PATCH_CONFIG_VERSION, mppOriginal, nivel, downsample,
    tamanoExtraccion: { w: te.x, h: te.y }, tamanoTile: { w: tt.x, h: tt.y }, entradaEncoder: { w: ee.x, h: ee.y },
    stride: { x: st.x, y: st.y }, politicaBorde, etiqueta
  };
}

/** Valida sin lanzar: { ok: true, config } o { ok: false, error: { code, field, message } }. */
export function validarPatchConfig(entrada) {
  const r = intentar(crearPatchConfig, entrada);
  return r.ok ? { ok: true, config: r.value } : r;
}

/** Cadena de resolución de una configuración, por eje: de la WSI al tile almacenado y a la entrada del encoder. */
export function evaluarPatchConfig(config) {
  const c = crearPatchConfig(config);
  const mppExtr = mppExtraccion(c.mppOriginal, c.downsample);
  const campoVisual = fov(c.tamanoExtraccion, mppExtr);
  const mppTile = mppEncoder(campoVisual, c.tamanoTile), mppEnc = mppEncoder(campoVisual, c.entradaEncoder);
  const aTile = factorResize(c.tamanoExtraccion, c.tamanoTile), aEncoder = factorResize(c.tamanoExtraccion, c.entradaEncoder);
  const tileAEncoder = factorResize(c.tamanoTile, c.entradaEncoder);
  const solape = overlap(c.tamanoExtraccion, c.stride);
  const advertencias = [];
  if (solape.hayHueco) advertencias.push('STRIDE_MAYOR_QUE_PARCHE');
  if (aEncoder.x < 1 || aEncoder.y < 1) advertencias.push('AMPLIACION_HACIA_ENCODER');
  if (Math.abs(aEncoder.x - aEncoder.y) > 1e-9) advertencias.push('RESIZE_NO_ISOTROPICO');
  if (Math.abs(c.mppOriginal.x - c.mppOriginal.y) > 1e-9) advertencias.push('MPP_ASIMETRICO');
  if (c.tamanoTile.w !== c.tamanoExtraccion.w || c.tamanoTile.h !== c.tamanoExtraccion.h) advertencias.push('REMUESTREO_INTERMEDIO');
  return {
    config: c, mppOriginal: c.mppOriginal, mppExtraccion: mppExtr, fov: campoVisual, areaFovUm2: campoVisual.x * campoVisual.y,
    mppTile, mppEncoder: mppEnc, factorResize: { extraccionATile: aTile, tileAEncoder, extraccionAEncoder: aEncoder },
    pixeles: { extraccion: c.tamanoExtraccion.w * c.tamanoExtraccion.h, tile: c.tamanoTile.w * c.tamanoTile.h, encoder: c.entradaEncoder.w * c.entradaEncoder.h },
    reduccion: reduccionPixeles(c.tamanoExtraccion, c.entradaEncoder), overlap: solape, advertencias
  };
}

/** Serializa una configuración a JSON (con el esquema y la versión). */
export function exportarPatchConfig(config) {
  return JSON.stringify({ esquema: PATCH_CONFIG_ESQUEMA, version: PATCH_CONFIG_VERSION, config: crearPatchConfig(config) }, null, 2);
}
/** Lee una configuración desde JSON (texto u objeto). Valida esquema, versión y todos los campos; no completa nada en silencio. */
export function importarPatchConfig(entrada) {
  let obj = entrada;
  if (typeof entrada === 'string') { try { obj = JSON.parse(entrada); } catch (e) { fail('JSON_INVALIDO', null, 'El texto no es un JSON válido.'); } }
  if (obj === null || typeof obj !== 'object') fail('CONFIG_INVALIDA', null, 'La configuración debe ser un objeto.');
  if (obj.esquema !== PATCH_CONFIG_ESQUEMA) fail('ESQUEMA_INVALIDO', 'esquema', `Esquema esperado: ${PATCH_CONFIG_ESQUEMA}.`, obj.esquema);
  if (obj.version !== PATCH_CONFIG_VERSION) fail('VERSION_NO_SOPORTADA', 'version', `Versión no soportada: ${String(obj.version)} (se admite la ${PATCH_CONFIG_VERSION}).`, obj.version);
  return crearPatchConfig(obj.config);
}
