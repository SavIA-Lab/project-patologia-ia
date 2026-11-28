/* Pruebas del motor matemático de la ruta P (src/engine/patch-math.js). Corren en Node, sin navegador. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../../src/engine/patch-math.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const close = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, msg || `${a} no es cercano a ${b}`);
const throwsCode = (fn, code, field) => assert.throws(fn, e => e instanceof M.PatchMathError && e.code === code && (field === undefined || e.field === field), `se esperaba ${code}`);

/* ---------------------------------------------------------------- casos de referencia (brief, sección 3.1) */

test('referencia: MPP 0.25, tile 640, entrada 224 -> MPP efectivo 0.714286', () => {
  const ext = M.mppExtraccion(0.25, 1), campo = M.fov(640, ext), enc = M.mppEncoder(campo, 224);
  close(ext.x, 0.25); close(campo.x, 160); close(campo.y, 160);
  close(enc.x, 0.714286, 5e-7); close(enc.y, 0.714286, 5e-7);
  close(M.factorResize(640, 224).x, 2.857142857, 1e-8);
});
test('referencia: tile 448 -> 0.5; downsample 4 -> MPP de extracción 1.0', () => {
  close(M.mppEncoder(M.fov(448, M.mppExtraccion(0.25, 1)), 224).x, 0.5);
  close(M.mppExtraccion(0.25, 4).x, 1.0); close(M.mppExtraccion(0.25, 4).y, 1.0);
});
test('referencia: solapamiento 0 % con stride 640 y 50 % con stride 320 (tile 640)', () => {
  assert.equal(M.overlap(640, 640).x, 0); assert.equal(M.overlap(640, 320).x, 0.5); assert.equal(M.overlap(640, 320).y, 0.5);
});
test('referencia: entrada 224 con token 16 -> 196 tokens (cuadrícula 14 x 14)', () => {
  const v = M.tokensVit(224, 16);
  assert.equal(v.tokens, 196); assert.deepEqual(v.cuadricula, { x: 14, y: 14 }); assert.equal(v.exacto, true); assert.equal(v.total, 196);
  assert.equal(M.tokensVit(224, 16, 1).total, 197);
});
test('referencia: 640 -> 224 reduce 87.75 % de los píxeles, factor lineal 2.857', () => {
  const r = M.reduccionPixeles(640, 224);
  assert.equal(r.pixelesOrigen, 409600); assert.equal(r.pixelesDestino, 50176);
  close(r.reduccion, 0.8775); close(r.factorLineal.x, 2.857142857, 1e-8); assert.equal(r.esAmpliacion, false);
});
test('referencia: 1000 embeddings de 1024 en float32 -> 4 096 000 bytes', () => {
  assert.equal(M.bytesEmbeddings(1000, 1024, 'float32'), 4096000);
  assert.equal(M.bytesEmbeddings(1000, 1024, 4), 4096000);
  assert.equal(M.bytesEmbeddings(1000, 1024, 'float16'), 2048000);
});
test('referencia: tamaño de parche para MPP objetivo 0.5, entrada 224 y MPP 0.25 -> 448', () => {
  const r = M.tamanoParcheParaMpp(224, 0.5, 0.25);
  assert.equal(r.redondeado.x, 448); assert.equal(r.exacto.x, 448); assert.equal(r.esEntero, true); assert.equal(r.errorMpp.x, 0);
});
test('referencia: tabla del comparador (MPP 0.25, entrada 224)', () => {
  const filas = [[224, 0.25, 56], [256, 0.2857, 64], [448, 0.5, 112], [512, 0.5714, 128], [640, 0.7143, 160], [896, 1.0, 224]];
  for (const [ext, mpp, campo] of filas) {
    const f = M.fov(ext, 0.25);
    close(f.x, campo); close(M.mppEncoder(f, 224).x, mpp, 5e-5);
  }
});
test('referencia: píxeles de un núcleo y bytes RGB', () => {
  close(M.pixelesNucleo(8, 0.5).x, 16); close(M.pixelesNucleo(8, 0.5).areaPx, Math.PI / 4 * 256, 1e-9);
  assert.equal(M.bytesRgb(1, 224), 224 * 224 * 3); assert.equal(M.bytesRgb(10, { w: 640, h: 480 }), 10 * 640 * 480 * 3);
  assert.equal(M.bytesRgb(0, 224), 0);
});

/* ---------------------------------------------------------------- MPP ausente o inválido: error explícito, nunca un valor por defecto */

test('MPP ausente, nulo, cero, negativo o no numérico lanza error en todas las funciones que lo usan', () => {
  const malos = [undefined, null, 0, -0.25, NaN, Infinity, '0.25', {}, { x: 0.25 }, { x: 0.25, y: 0 }, { x: null, y: 0.25 }, [], true];
  for (const m of malos) {
    assert.throws(() => M.mppExtraccion(m, 1), M.PatchMathError, `mppExtraccion(${JSON.stringify(m)})`);
    assert.throws(() => M.fov(640, m), M.PatchMathError, `fov(${JSON.stringify(m)})`);
    assert.throws(() => M.pixelesNucleo(8, m), M.PatchMathError, `pixelesNucleo(${JSON.stringify(m)})`);
    assert.throws(() => M.tamanoParcheParaMpp(224, 0.5, m), M.PatchMathError);
    assert.throws(() => M.tamanoParcheParaMpp(224, m, 0.25), M.PatchMathError);
    assert.throws(() => M.mppNivel(m, 4), M.PatchMathError);
    assert.throws(() => M.construirPiramide({ mppNativo: m, downsamples: [1, 4] }), M.PatchMathError);
    assert.throws(() => M.crearPatchConfig({ mppOriginal: m, nivel: 0, downsample: 1, tamanoExtraccion: 640, tamanoTile: null, entradaEncoder: 224, stride: 640 }), M.PatchMathError);
  }
  throwsCode(() => M.mppExtraccion(undefined, 1), 'MPP_AUSENTE', 'mppWsi');
  throwsCode(() => M.mppExtraccion(null, 1), 'MPP_AUSENTE');
  throwsCode(() => M.mppExtraccion(0, 1), 'MPP_INVALIDO');
  throwsCode(() => M.mppExtraccion({ x: 0.25 }, 1), 'MPP_AUSENTE', 'mppWsi.y');
  throwsCode(() => M.mppExtraccion({ x: 0.25, y: 0 }, 1), 'MPP_INVALIDO', 'mppWsi.y');
  throwsCode(() => M.mppExtraccion(-1, 1), 'MPP_INVALIDO');
});
test('ninguna función devuelve 0.25 ni 0.5 como sustituto cuando falta el MPP', () => {
  for (const fn of [() => M.mppExtraccion(undefined, 1), () => M.fov(640, null), () => M.pixelesNucleo(8, undefined), () => M.mppNivel(null, 4)]) {
    let valor; try { valor = fn(); } catch (e) { valor = e; }
    assert.ok(valor instanceof M.PatchMathError, 'debe lanzar, no devolver un valor');
  }
});
test('parseMpp acepta texto numérico (como lo entrega OpenSlide) y rechaza el resto', () => {
  assert.equal(M.parseMpp('0.2500'), 0.25); assert.equal(M.parseMpp(' 0.5 '), 0.5); assert.equal(M.parseMpp(1), 1);
  for (const m of [undefined, null, '', ' ', 'abc', '0', '-1', '0.25 um', 'NaN', 'Infinity']) assert.throws(() => M.parseMpp(m), M.PatchMathError, String(m));
  throwsCode(() => M.parseMpp(undefined), 'MPP_AUSENTE'); throwsCode(() => M.parseMpp('abc'), 'MPP_INVALIDO');
});
test('intentar() devuelve el error sin lanzar', () => {
  const r = M.intentar(M.mppExtraccion, null, 1);
  assert.equal(r.ok, false); assert.equal(r.error.code, 'MPP_AUSENTE');
  assert.equal(M.intentar(M.mppExtraccion, 0.25, 4).value.x, 1);
  assert.throws(() => M.intentar(() => { throw new TypeError('x'); }), TypeError, 'los errores ajenos al motor se propagan');
});

/* ---------------------------------------------------------------- por eje, imágenes rectangulares, downsample no entero */

test('MPP distinto en X e Y: cada eje se calcula por separado', () => {
  const ext = M.mppExtraccion({ x: 0.25, y: 0.5 }, 2);
  close(ext.x, 0.5); close(ext.y, 1.0);
  const f = M.fov({ w: 640, h: 320 }, ext);
  close(f.x, 320); close(f.y, 320);
  const enc = M.mppEncoder(f, { w: 224, h: 224 });
  close(enc.x, 320 / 224); close(enc.y, 320 / 224);
  const n = M.pixelesNucleo(10, { x: 0.5, y: 1.0 }); close(n.x, 20); close(n.y, 10);
  assert.notEqual(M.fov(640, { x: 0.25, y: 0.5 }).x, M.fov(640, { x: 0.25, y: 0.5 }).y);
});
test('imágenes rectangulares: resize, reducción de píxeles y tokens por eje', () => {
  const r = M.factorResize({ w: 640, h: 320 }, { w: 224, h: 224 });
  close(r.x, 640 / 224); close(r.y, 320 / 224);
  const red = M.reduccionPixeles({ w: 640, h: 320 }, 224);
  assert.equal(red.pixelesOrigen, 204800); close(red.reduccion, 1 - 50176 / 204800);
  const v = M.tokensVit({ w: 224, h: 112 }, 16);
  assert.deepEqual(v.cuadricula, { x: 14, y: 7 }); assert.equal(v.tokens, 98);
  const t = M.numeroTiles(1000, 500, { w: 200, h: 100 }, { x: 100, y: 50 });
  assert.equal(t.nx, 9); assert.equal(t.ny, 9);
});
test('downsample no entero (4.0001, 15.99, 32.5) se admite; menor que 1 o inválido se rechaza', () => {
  close(M.mppExtraccion(0.25, 4.0001).x, 1.000025); close(M.mppExtraccion(0.25, 15.99).x, 0.25 * 15.99); close(M.mppNivel(0.25, 32.5).x, 8.125);
  for (const d of [0, 0.5, -4, NaN, Infinity, '4', null, undefined]) assert.throws(() => M.mppExtraccion(0.25, d), M.PatchMathError, String(d));
  throwsCode(() => M.mppExtraccion(0.25, undefined), 'DOWNSAMPLE_AUSENTE'); throwsCode(() => M.mppExtraccion(0.25, 0.5), 'DOWNSAMPLE_INVALIDO');
});
test('tamaño de parche para un MPP objetivo: error de redondeo cuando el resultado no es entero', () => {
  const r = M.tamanoParcheParaMpp(224, 0.7, 0.25);                       // 224 · 0.7 / 0.25 = 627.2
  close(r.exacto.x, 627.2); assert.equal(r.redondeado.x, 627); assert.equal(r.esEntero, false);
  close(r.mppResultante.x, 627 * 0.25 / 224); close(r.errorMpp.x, 627 * 0.25 / 224 - 0.7); assert.ok(r.errorMpp.x < 0);
  const asim = M.tamanoParcheParaMpp(224, 0.5, { x: 0.25, y: 0.5 });
  assert.equal(asim.redondeado.x, 448); assert.equal(asim.redondeado.y, 224);
  assert.equal(M.tamanoParcheParaMpp(224, 0.5, M.mppExtraccion(0.25, 4)).redondeado.x, 112);   // región leída a MPP 1.0: hay que ampliar el MPP a 0.5
});

/* ---------------------------------------------------------------- tamaños inválidos, stride y huecos */

test('tamaños inválidos lanzan error (cero, negativos, decimales, texto, ausentes)', () => {
  for (const s of [0, -1, 1.5, NaN, Infinity, '224', null, undefined, {}, { w: 224 }, { w: 224, h: 0 }, []]) {
    assert.throws(() => M.fov(s, 0.25), M.PatchMathError, `fov(${JSON.stringify(s)})`);
    assert.throws(() => M.factorResize(s, 224), M.PatchMathError);
    assert.throws(() => M.tokensVit(s, 16), M.PatchMathError);
    assert.throws(() => M.bytesRgb(1, s), M.PatchMathError);
  }
  throwsCode(() => M.fov(0, 0.25), 'TAMANO_INVALIDO'); throwsCode(() => M.fov(undefined, 0.25), 'TAMANO_AUSENTE');
  throwsCode(() => M.numeroTiles(0, 100, 10, 10), 'TAMANO_INVALIDO', 'W');
  throwsCode(() => M.numeroTiles(100, 100, 10, 0), 'STRIDE_INVALIDO'); throwsCode(() => M.numeroTiles(100, 100, 10, -5), 'STRIDE_INVALIDO');
  throwsCode(() => M.numeroTiles(100, 100, 10, undefined), 'STRIDE_AUSENTE');
  throwsCode(() => M.bytesEmbeddings(-1, 1024), 'VALOR_INVALIDO'); throwsCode(() => M.bytesEmbeddings(10, 0), 'VALOR_INVALIDO'); throwsCode(() => M.bytesEmbeddings(10, 1024, 'float128'), 'VALOR_INVALIDO');
  throwsCode(() => M.bytesRgb(1e12, 40000), 'DESBORDE');
  throwsCode(() => M.pixelesNucleo(0, 0.5), 'VALOR_INVALIDO'); throwsCode(() => M.pixelesNucleo(-3, 0.5), 'VALOR_INVALIDO');
});
test('stride mayor que el parche: sin solapamiento, con hueco informado', () => {
  const o = M.overlap(640, 960);
  assert.equal(o.x, 0); assert.equal(o.hayHueco, true); assert.deepEqual(o.hueco, { x: 320, y: 320 }); close(o.cobertura.x, 640 / 960);
  const t = M.numeroTiles(2000, 2000, 640, 960);
  assert.equal(t.hayHuecos, true); assert.equal(t.cubreRegion, false); assert.ok(t.pxSinCubrir.x > 0);
  assert.equal(M.overlap(640, 640).hayHueco, false); assert.equal(M.overlap(640, 320).hayHueco, false);
  const asim = M.overlap({ w: 640, h: 320 }, { x: 320, y: 480 });                 // eje X solapa, eje Y deja hueco
  assert.equal(asim.x, 0.5); assert.equal(asim.y, 0); assert.deepEqual(asim.hueco, { x: 0, y: 160 }); assert.equal(asim.hayHueco, true);
});
test('solapamientos de referencia: 0, 10, 25, 50 y 75 % en un parche de 640', () => {
  for (const [stride, ov] of [[640, 0], [576, 0.1], [480, 0.25], [320, 0.5], [160, 0.75]]) close(M.overlap(640, stride).x, ov);
});
test('reduccionPixeles: ampliación devuelve un valor negativo y esAmpliacion', () => {
  const r = M.reduccionPixeles(224, 640);
  assert.equal(r.esAmpliacion, true); assert.ok(r.reduccion < 0); close(r.factorLineal.x, 224 / 640);
  assert.equal(M.reduccionPixeles(224, 224).reduccion, 0);
});
test('tokensVit: entrada no múltiplo del token se informa, no se oculta', () => {
  const v = M.tokensVit(230, 16);
  assert.equal(v.exacto, false); assert.deepEqual(v.resto, { x: 6, y: 6 }); assert.equal(v.tokens, 196);
  assert.equal(M.tokensVit(10, 16).tokens, 0);
  throwsCode(() => M.tokensVit(224, 16, -1), 'VALOR_INVALIDO');
});

/* ---------------------------------------------------------------- número de tiles y bordes */

/* Definición de referencia (fuerza bruta): lista de inicios por política y cobertura real por píxel */
function inicios(W, P, S, pol) {
  const out = [];
  if (pol === 'descartar' || pol === 'roi') { for (let k = 0; k * S + P <= W; k++) out.push(k * S); }
  else if (pol === 'ultima-ventana') {
    for (let k = 0; k * S + P <= W; k++) out.push(k * S);
    if (out.length && out[out.length - 1] + P < W) out.push(W - P);
  } else if (pol === 'rellenar') {
    for (let k = 0; k * S < W; k++) { out.push(k * S); if (k * S + P >= W) break; }
  }
  return out;
}
function cubiertos(W, P, starts) { const c = new Uint8Array(W); for (const s of starts) for (let x = s; x < Math.min(W, s + P); x++) c[x] = 1; return c.reduce((a, b) => a + b, 0); }

test('numeroTiles coincide con la enumeración directa de ventanas (todas las políticas, muchas combinaciones)', () => {
  let casos = 0;
  for (const pol of ['descartar', 'rellenar', 'ultima-ventana']) {
    for (const W of [1, 5, 10, 63, 64, 65, 100, 127, 128, 129, 200, 257]) {
      for (const P of [1, 4, 16, 64, 100, 130]) {
        for (const S of [1, 3, 16, 32, 64, 100, 150, 300]) {
          const t = M.numeroTiles(W, 50, P, S, pol), starts = inicios(W, P, S, pol);
          assert.equal(t.nx, starts.length, `${pol} W=${W} P=${P} S=${S}`);
          const sinCubrir = W - cubiertos(W, P, starts);
          assert.equal(t.pxSinCubrir.x, sinCubrir, `cobertura ${pol} W=${W} P=${P} S=${S}`);
          if (pol === 'rellenar' && starts.length) assert.equal(t.pxRelleno.x, Math.max(0, starts[starts.length - 1] + P - W), `relleno W=${W} P=${P} S=${S}`);
          casos++;
        }
      }
    }
  }
  assert.ok(casos > 1000);
});
test('numeroTiles: fórmula de la especificación y política "descartar" (Nx = max(0, floor((W-P)/S)+1))', () => {
  assert.equal(M.numeroTiles(1000, 1000, 640, 640).total, 1);
  assert.equal(M.numeroTiles(1920, 1280, 640, 640).total, 6);
  assert.equal(M.numeroTiles(1920, 1280, 640, 320).nx, 5); assert.equal(M.numeroTiles(1920, 1280, 640, 320).ny, 3);
  assert.equal(M.numeroTiles(500, 500, 640, 320).total, 0, 'W < P: ninguna ventana completa');
  assert.equal(M.numeroTiles(640, 640, 640, 640).total, 1);
  const t = M.numeroTiles(1000, 1000, 640, 640);
  assert.deepEqual(t.pxSinCubrir, { x: 360, y: 360 }); assert.equal(t.cubreRegion, false); assert.equal(t.teorico, true);
});
test('numeroTiles: relleno, última ventana alineada y ROI', () => {
  const r = M.numeroTiles(1000, 1000, 640, 640, 'rellenar');
  assert.equal(r.total, 4); assert.deepEqual(r.pxRelleno, { x: 280, y: 280 }); assert.equal(r.cubreRegion, true);
  const u = M.numeroTiles(1000, 1000, 640, 640, 'ultima-ventana');
  assert.equal(u.total, 4); assert.equal(u.cubreRegion, true); assert.deepEqual(u.pxRelleno, { x: 0, y: 0 });
  assert.equal(M.numeroTiles(500, 500, 640, 640, 'ultima-ventana').total, 0, 'la región es menor que el parche: no cabe ninguna ventana');
  assert.equal(M.numeroTiles(500, 500, 640, 640, 'rellenar').total, 1, 'con relleno, una sola ventana rellena');
  const roi = M.numeroTiles(4000, 3000, 640, 640, 'roi', { roi: { w: 1920, h: 1280 } });
  assert.equal(roi.total, 6); assert.deepEqual(roi.region, { x: 1920, y: 1280 });
  throwsCode(() => M.numeroTiles(4000, 3000, 640, 640, 'roi'), 'ROI_AUSENTE');
  throwsCode(() => M.numeroTiles(1000, 1000, 640, 640, 'roi', { roi: { w: 2000, h: 500 } }), 'ROI_FUERA');
  throwsCode(() => M.numeroTiles(1000, 1000, 640, 640, 'inventada'), 'POLITICA_INVALIDA');
});
test('numeroTiles: conteo de una WSI grande sin recorrer ventanas (tiempo constante)', () => {
  const t0 = Date.now(), t = M.numeroTiles(120000, 90000, 640, 320);
  assert.ok(Date.now() - t0 < 50); assert.equal(t.nx, Math.floor((120000 - 640) / 320) + 1); assert.equal(t.total, t.nx * t.ny);
});

/* ---------------------------------------------------------------- pirámide */

test('pirámide configurable: 1, 4, 16, 32 y un factor no entero; MPP_nivel = MPP_nativo × downsample', () => {
  const p = M.construirPiramide({ mppNativo: 0.25, dimensionesNivel0: { w: 100000, h: 80000 }, downsamples: [1, 4, 16, 32] });
  assert.deepEqual(p.map(n => n.mpp.x), [0.25, 1, 4, 8]); assert.deepEqual(p.map(n => n.nivel), [0, 1, 2, 3]);
  assert.deepEqual(p[3].dimensiones, { x: 3125, y: 2500, aproximada: true });
  const q = M.construirPiramide({ mppNativo: { x: 0.25, y: 0.5 }, downsamples: [1, 4.0001, 16.07, 32.5] });
  close(q[1].mpp.x, 1.000025); close(q[1].mpp.y, 2.00005); close(q[3].mpp.x, 8.125); assert.equal(q[0].dimensiones, null);
  assert.deepEqual(M.construirPiramide({ mppNativo: 0.5, downsamples: [1] }).map(n => n.mpp.x), [0.5]);
  throwsCode(() => M.construirPiramide({ mppNativo: 0.25, downsamples: [] }), 'PIRAMIDE_INVALIDA');
  throwsCode(() => M.construirPiramide({ mppNativo: 0.25, downsamples: [2, 4] }), 'PIRAMIDE_INVALIDA', 'downsamples[0]');
  throwsCode(() => M.construirPiramide({ mppNativo: 0.25, downsamples: [1, 4, 4] }), 'PIRAMIDE_INVALIDA');
  throwsCode(() => M.construirPiramide({ mppNativo: 0.25, downsamples: [1, 16, 4] }), 'PIRAMIDE_INVALIDA');
  throwsCode(() => M.construirPiramide({ mppNativo: 0.25 }), 'PIRAMIDE_INVALIDA');
});
test('índice de la interfaz frente a nivel de OpenSlide (nivel 0 = mayor resolución) en ambos órdenes', () => {
  // planos de la v3.0: índice 0 = menor resolución (5×), 3 = mayor (40×)
  assert.deepEqual([0, 1, 2, 3].map(i => M.indiceInterfazANivelOpenSlide(i, 4)), [3, 2, 1, 0]);
  assert.deepEqual([0, 1, 2, 3].map(i => M.indiceInterfazANivelOpenSlide(i, 4, 'mayor-a-menor')), [0, 1, 2, 3]);
  for (const orden of ['menor-a-mayor', 'mayor-a-menor']) for (const n of [1, 2, 4, 7]) for (let i = 0; i < n; i++) {
    assert.equal(M.nivelOpenSlideAIndiceInterfaz(M.indiceInterfazANivelOpenSlide(i, n, orden), n, orden), i, `ida y vuelta ${orden} ${n} ${i}`);
  }
  for (const [i, n] of [[-1, 4], [4, 4], [1.5, 4], [0, 0], [NaN, 4], ['1', 4]]) assert.throws(() => M.indiceInterfazANivelOpenSlide(i, n), M.PatchMathError, `${i}/${n}`);
  throwsCode(() => M.indiceInterfazANivelOpenSlide(0, 4, 'raro'), 'ORDEN_INVALIDO');
});
test('campo visual de un nivel y modos "campo fijo" y "tamaño fijo"', () => {
  close(M.campoVisualNivel(256, 0.25, 4).x, 256); close(M.campoVisualNivel(256, 0.25, 1).x, 64);
  const p = M.construirPiramide({ mppNativo: 0.25, downsamples: [1, 4, 16, 32] });
  const fijoFov = M.modoCampoFijo(256, p);                    // mismo campo (256 µm): menos píxeles en niveles más gruesos
  assert.deepEqual(fijoFov.map(f => f.pixeles.x), [1024, 256, 64, 32]);
  const fijoPx = M.modoTamanoFijo(256, p);                    // mismo tamaño digital: campo cada vez mayor
  assert.deepEqual(fijoPx.map(f => f.fov.x), [64, 256, 1024, 2048]);
  assert.deepEqual(M.modoTamanoFijo({ w: 256, h: 128 }, M.construirPiramide({ mppNativo: { x: 0.25, y: 0.5 }, downsamples: [1, 4] }))[1].fov, { x: 256, y: 256 });
});
test('read_region: la ubicación va en coordenadas del nivel 0 y el tamaño en píxeles del nivel pedido', () => {
  const r = M.regionOpenSlide({ ubicacion0: { x: 4000, y: 8000 }, downsampleNivel: 4, tamano: { w: 256, h: 128 } });
  assert.deepEqual(r.origenNivel0, { x: 4000, y: 8000 }); assert.deepEqual(r.extensionNivel0, { x: 1024, y: 512 });
  assert.deepEqual(r.origenEnNivel, { x: 1000, y: 2000 }); assert.deepEqual(r.tamanoNivel, { x: 256, y: 128 });
  throwsCode(() => M.regionOpenSlide({ ubicacion0: null, downsampleNivel: 4, tamano: 256 }), 'VALOR_INVALIDO');
  assert.throws(() => M.regionOpenSlide({ ubicacion0: { x: 0, y: 0 }, downsampleNivel: 0.5, tamano: 256 }), M.PatchMathError);
});
test('dimensiones y downsample desde las dimensiones reales de los niveles', () => {
  const d = M.downsampleDesdeDimensiones({ w: 100000, h: 80000 }, { w: 25000, h: 20001 });
  close(d.x, 4); close(d.y, 80000 / 20001); close(d.medio, (4 + 80000 / 20001) / 2);
  assert.deepEqual(M.dimensionesNivelAprox({ w: 1001, h: 1001 }, 4), { x: 250, y: 250, aproximada: true });
});

/* ---------------------------------------------------------------- Nyquist y óptica */

test('Nyquist y límites ópticos (cálculo exacto con entradas del usuario)', () => {
  close(M.frecuenciaNyquist(0.25).x, 2); close(M.periodoMinimoResoluble(0.25).x, 0.5);
  close(M.limiteAbbe(550, 0.75), 0.55 / 1.5); close(M.limiteRayleigh(550, 0.75), 0.61 * 0.55 / 0.75);
  close(M.mppMaximoNyquist(M.limiteAbbe(550, 0.75)), 0.55 / 3);
  const ok = M.muestreoFrenteAlLimite(0.1, M.limiteAbbe(550, 0.75)), mal = M.muestreoFrenteAlLimite(0.5, M.limiteAbbe(550, 0.75));
  assert.equal(ok.cumpleNyquist, true); assert.equal(mal.submuestreado, true); assert.equal(mal.cumpleNyquist, false);
  close(M.mppAPpi(0.25).x, 101600); close(M.mppDesdePixelesPorMetro(3780), 1e6 / 3780);
  throwsCode(() => M.limiteAbbe(550, 0), 'VALOR_INVALIDO'); throwsCode(() => M.limiteAbbe(0, 0.75), 'VALOR_INVALIDO'); throwsCode(() => M.mppAPpi(null), 'MPP_AUSENTE');
  throwsCode(() => M.mppDesdePixelesPorMetro(0), 'VALOR_INVALIDO');
});
test('la tabla MPP-aumento es ilustrativa: toda entrada lo declara y está congelada', () => {
  assert.deepEqual(M.TABLA_MPP_AUMENTO_ILUSTRATIVA.map(r => [r.mpp, r.aumento]), [[0.125, 80], [0.25, 40], [0.5, 20], [1, 10], [2, 5]]);
  assert.ok(M.TABLA_MPP_AUMENTO_ILUSTRATIVA.every(r => r.ilustrativa === true));
  assert.ok(Object.isFrozen(M.TABLA_MPP_AUMENTO_ILUSTRATIVA) && Object.isFrozen(M.TABLA_MPP_AUMENTO_ILUSTRATIVA[0]));
});

/* ---------------------------------------------------------------- patchConfig */

const base = () => ({ mppOriginal: { x: 0.25, y: 0.25 }, nivel: 0, downsample: 1, tamanoExtraccion: 640, tamanoTile: null, entradaEncoder: 224, stride: 640, politicaBorde: 'descartar' });

test('patchConfig: esquema normalizado, campos separados y sin MPP por defecto', () => {
  const c = M.crearPatchConfig(base());
  assert.deepEqual(c.mppOriginal, { x: 0.25, y: 0.25 }); assert.deepEqual(c.tamanoExtraccion, { w: 640, h: 640 });
  assert.deepEqual(c.tamanoTile, { w: 640, h: 640 }, 'tamanoTile null = igual a la extracción'); assert.deepEqual(c.entradaEncoder, { w: 224, h: 224 });
  assert.deepEqual(c.stride, { x: 640, y: 640 }); assert.equal(c.version, 1); assert.equal(c.etiqueta, '');
  const sin = base(); delete sin.mppOriginal; throwsCode(() => M.crearPatchConfig(sin), 'MPP_AUSENTE', 'mppOriginal');
  const nulo = base(); nulo.mppOriginal = null; throwsCode(() => M.crearPatchConfig(nulo), 'MPP_AUSENTE');
  const cero = base(); cero.mppOriginal = { x: 0, y: 0.25 }; throwsCode(() => M.crearPatchConfig(cero), 'MPP_INVALIDO', 'mppOriginal.x');
});
test('patchConfig: validación de cada campo', () => {
  const con = patch => ({ ...base(), ...patch });
  throwsCode(() => M.crearPatchConfig(null), 'CONFIG_INVALIDA');
  throwsCode(() => M.crearPatchConfig(con({ nivel: -1 })), 'NIVEL_INVALIDO'); throwsCode(() => M.crearPatchConfig(con({ nivel: 1.5 })), 'NIVEL_INVALIDO'); throwsCode(() => M.crearPatchConfig(con({ nivel: undefined })), 'NIVEL_INVALIDO');
  throwsCode(() => M.crearPatchConfig(con({ downsample: undefined })), 'DOWNSAMPLE_AUSENTE'); throwsCode(() => M.crearPatchConfig(con({ downsample: 0.5 })), 'DOWNSAMPLE_INVALIDO');
  throwsCode(() => M.crearPatchConfig(con({ nivel: 0, downsample: 4 })), 'DOWNSAMPLE_INVALIDO', 'downsample');
  throwsCode(() => M.crearPatchConfig(con({ tamanoExtraccion: 0 })), 'TAMANO_INVALIDO'); throwsCode(() => M.crearPatchConfig(con({ entradaEncoder: undefined })), 'TAMANO_AUSENTE');
  throwsCode(() => M.crearPatchConfig(con({ tamanoTile: -3 })), 'TAMANO_INVALIDO'); throwsCode(() => M.crearPatchConfig(con({ stride: 0 })), 'STRIDE_INVALIDO'); throwsCode(() => M.crearPatchConfig(con({ stride: undefined })), 'STRIDE_AUSENTE');
  throwsCode(() => M.crearPatchConfig(con({ politicaBorde: 'xyz' })), 'POLITICA_INVALIDA');
  assert.equal(M.crearPatchConfig(con({ politicaBorde: undefined })).politicaBorde, 'descartar');
  assert.equal(M.validarPatchConfig(con({ stride: 0 })).ok, false); assert.equal(M.validarPatchConfig(con({ stride: 0 })).error.code, 'STRIDE_INVALIDO');
  assert.equal(M.validarPatchConfig(base()).ok, true);
});
test('patchConfig: cadena de resolución con extracción, tile almacenado y entrada del encoder distintos', () => {
  const e = M.evaluarPatchConfig({ ...base(), tamanoExtraccion: 640, tamanoTile: 512, entradaEncoder: 224, stride: 320 });
  close(e.mppExtraccion.x, 0.25); close(e.fov.x, 160); close(e.areaFovUm2, 160 * 160);
  close(e.mppTile.x, 160 / 512); close(e.mppEncoder.x, 0.714286, 5e-7);
  close(e.factorResize.extraccionATile.x, 640 / 512); close(e.factorResize.tileAEncoder.x, 512 / 224); close(e.factorResize.extraccionAEncoder.x, 640 / 224);
  close(e.factorResize.extraccionATile.x * e.factorResize.tileAEncoder.x, e.factorResize.extraccionAEncoder.x);
  close(e.overlap.x, 0.5); close(e.reduccion.reduccion, 0.8775); assert.ok(e.advertencias.includes('REMUESTREO_INTERMEDIO'));
  assert.deepEqual(M.evaluarPatchConfig(base()).advertencias, []);
});
test('patchConfig: nivel con downsample 4 y MPP asimétrico, advertencias', () => {
  const e = M.evaluarPatchConfig({ ...base(), mppOriginal: { x: 0.25, y: 0.5 }, nivel: 1, downsample: 4, tamanoExtraccion: { w: 224, h: 224 }, stride: 400 });
  close(e.mppExtraccion.x, 1); close(e.mppExtraccion.y, 2); close(e.fov.x, 224); close(e.fov.y, 448);
  close(e.mppEncoder.x, 1); close(e.mppEncoder.y, 2);
  for (const a of ['MPP_ASIMETRICO', 'STRIDE_MAYOR_QUE_PARCHE']) assert.ok(e.advertencias.includes(a), a);
  const amp = M.evaluarPatchConfig({ ...base(), tamanoExtraccion: 112, stride: 112 });
  assert.ok(amp.advertencias.includes('AMPLIACION_HACIA_ENCODER'));
  const noIso = M.evaluarPatchConfig({ ...base(), tamanoExtraccion: { w: 640, h: 320 }, stride: { x: 640, y: 320 } });
  assert.ok(noIso.advertencias.includes('RESIZE_NO_ISOTROPICO'));
});
test('patchConfig: exportación e importación JSON (ida y vuelta idéntica)', () => {
  const origen = M.crearPatchConfig({ ...base(), mppOriginal: { x: 0.2525, y: 0.2519 }, nivel: 2, downsample: 16.07, tamanoExtraccion: { w: 300, h: 280 }, tamanoTile: 256, stride: { x: 150, y: 140 }, politicaBorde: 'ultima-ventana', etiqueta: 'prueba' });
  const texto = M.exportarPatchConfig(origen), obj = JSON.parse(texto);
  assert.equal(obj.esquema, 'patch-config'); assert.equal(obj.version, 1);
  assert.deepEqual(M.importarPatchConfig(texto), origen); assert.deepEqual(M.importarPatchConfig(obj), origen);
  assert.equal(M.exportarPatchConfig(M.importarPatchConfig(texto)), texto);
});
test('patchConfig: importación rechaza JSON roto, esquema o versión ajenos y campos faltantes (sin completar nada)', () => {
  throwsCode(() => M.importarPatchConfig('{no es json'), 'JSON_INVALIDO'); throwsCode(() => M.importarPatchConfig('null'), 'CONFIG_INVALIDA');
  throwsCode(() => M.importarPatchConfig({ esquema: 'otro', version: 1, config: base() }), 'ESQUEMA_INVALIDO');
  throwsCode(() => M.importarPatchConfig({ esquema: 'patch-config', version: 2, config: base() }), 'VERSION_NO_SOPORTADA');
  const sinMpp = base(); delete sinMpp.mppOriginal;
  throwsCode(() => M.importarPatchConfig({ esquema: 'patch-config', version: 1, config: sinMpp }), 'MPP_AUSENTE');
  throwsCode(() => M.importarPatchConfig(JSON.stringify({ esquema: 'patch-config', version: 1, config: { ...base(), mppOriginal: { x: 0.25 } } })), 'MPP_AUSENTE', 'mppOriginal.y');
  throwsCode(() => M.exportarPatchConfig({ ...base(), mppOriginal: null }), 'MPP_AUSENTE');
});

/* ---------------------------------------------------------------- pureza del archivo */

test('patch-math.js no importa DOM, three ni el estado, y no usa APIs del navegador', () => {
  const src = readFileSync(join(ROOT, 'src/engine/patch-math.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/\bimport\b/.test(code) && !/\brequire\s*\(/.test(code), 'no debe importar nada');
  for (const prohibido of ['document', 'window', 'navigator', 'localStorage', 'HTMLCanvasElement', 'OffscreenCanvas', 'THREE', 'three', 'state', 'pipeline', 'i18n']) {
    assert.ok(!new RegExp(`\\b${prohibido}\\b`).test(code), `no debe referirse a ${prohibido}`);
  }
});
test('ni el motor ni su prueba contienen rayas ni medias rayas', () => {
  for (const f of ['src/engine/patch-math.js', 'tests/unit/patch-math.test.mjs']) assert.ok(!/[\u2013\u2014]/.test(readFileSync(join(ROOT, f), 'utf8')), f);
});
