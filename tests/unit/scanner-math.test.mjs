/* Motor del escáner genérico de M1 (src/engine/scanner-math.js) y procesamiento de imagen (src/modules/scanner/sim.js). Sin DOM. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/engine/scanner-math.js';
import * as SIM from '../../src/modules/scanner/sim.js';

const throwsCode = (fn, code) => assert.throws(fn, e => e.name === 'PatchMathError' && e.code === code);

test('MPP ilustrativo por objetivo: queda registrado como tal y se puede editar', () => {
  const p40 = S.crearPerfil({ objective: 40 }), p20 = S.crearPerfil({ objective: 20 });
  assert.deepEqual(p40.mpp, { x: 0.25, y: 0.25 }); assert.equal(p40.mppSource, 'illustrative-default');
  assert.deepEqual(p20.mpp, { x: 0.5, y: 0.5 });
  const u = S.crearPerfil({ objective: 40, mpp: { x: 0.23, y: 0.24 } });
  assert.equal(u.mppSource, 'user'); assert.deepEqual(u.mpp, { x: 0.23, y: 0.24 });
});
test('entradas inválidas lanzan errores con código, sin completar en silencio', () => {
  throwsCode(() => S.crearPerfil({ family: 'x' }), 'VALOR_INVALIDO');
  throwsCode(() => S.crearPerfil({ objective: 60 }), 'VALOR_INVALIDO');
  throwsCode(() => S.crearPerfil({ zPlanes: 2.5 }), 'VALOR_INVALIDO');
  throwsCode(() => S.crearPerfil({ zPlanes: 0 }), 'VALOR_INVALIDO');
  throwsCode(() => S.crearPerfil({ overlap: 1 }), 'VALOR_INVALIDO');
  throwsCode(() => S.crearPerfil({ scanMode: 'diagonal' }), 'VALOR_INVALIDO');
  throwsCode(() => S.crearPerfil({ mpp: { x: 0.25 } }), 'MPP_AUSENTE');
  throwsCode(() => S.pixelesDelArea([0, 5], { x: 0.25, y: 0.25 }), 'VALOR_INVALIDO');
});
test('píxeles del área, bytes sin comprimir y profundidad Z (cálculo exacto)', () => {
  const px = S.pixelesDelArea([10, 10], { x: 0.25, y: 0.25 });
  assert.deepEqual(px, { x: 40000, y: 40000 });
  assert.equal(S.bytesSinComprimir(px, 1), 4.8e9);
  assert.equal(S.bytesSinComprimir(px, 5), 24e9);
  assert.equal(S.profundidadZ(5, 1), 4); assert.equal(S.profundidadZ(1, 1), 0);
  // duplicar el MPP divide los píxeles por 4
  const px2 = S.pixelesDelArea([10, 10], { x: 0.5, y: 0.5 });
  assert.equal(S.bytesSinComprimir(px2) * 4, S.bytesSinComprimir(px));
});
test('MPP asimétrico: cada eje usa el suyo', () => {
  const px = S.pixelesDelArea([10, 10], { x: 0.25, y: 0.5 });
  assert.deepEqual(px, { x: 40000, y: 20000 });
});
test('campos: el modo por área cubre el área y el modo por línea cuenta franjas', () => {
  const a = S.camposDelEscaneo({ family: 'high-volume', objective: 40 }, [10, 10]);
  assert.equal(a.campos, a.nx * a.ny); assert.ok(a.mosaicoPx.x >= a.imagenPx.x && a.mosaicoPx.y >= a.imagenPx.y);
  const l = S.camposDelEscaneo({ family: 'high-volume', objective: 40, scanMode: 'line' }, [10, 10]);
  assert.equal(l.modo, 'line'); assert.equal(l.ny, 1); assert.equal(l.lineasPorFranja, l.imagenPx.y); assert.ok(l.franjas >= Math.floor(l.imagenPx.x / l.campoUm.x * 0.25));
});
test('más planos Z: bytes y tiempo crecen; el MPP no cambia', () => {
  const a = S.salidasEscaneo({ objective: 40, zPlanes: 1 }, [5, 5]), b = S.salidasEscaneo({ objective: 40, zPlanes: 5 }, [5, 5]);
  assert.equal(b.exacto.bytesSinComprimir, a.exacto.bytesSinComprimir * 5);
  assert.ok(b.simulado.segundos > a.simulado.segundos); assert.deepEqual(a.exacto.mpp, b.exacto.mpp);
});
test('la compresión solo cambia la parte simulada', () => {
  const a = S.salidasEscaneo({ objective: 40, compression: { kind: 'none' } }, [5, 5]), b = S.salidasEscaneo({ objective: 40, compression: { kind: 'lossy' } }, [5, 5]);
  assert.equal(a.exacto.bytesSinComprimir, b.exacto.bytesSinComprimir);
  assert.equal(b.simulado.bytesComprimidos, Math.ceil(b.exacto.bytesSinComprimir / S.COMPRESION_ILUSTRATIVA.lossy));
});
test('exportar e importar el perfil conserva todos los campos y valida el esquema', () => {
  const p = S.crearPerfil({ family: 'benchtop', objective: 20, zPlanes: 3, zStepUm: 0.8, focusPoints: 40, scanMode: 'line', compression: { kind: 'lossless' }, mpp: { x: 0.48, y: 0.5 } });
  assert.deepEqual(S.importarPerfil(S.exportarPerfil(p)), p);
  throwsCode(() => S.importarPerfil('no es json'), 'JSON_INVALIDO');
  throwsCode(() => S.importarPerfil('{"schema":"otro"}'), 'ESQUEMA_INVALIDO');
  throwsCode(() => S.importarPerfil(JSON.stringify({ ...p, version: 9 })), 'VERSION_NO_SOPORTADA');
});
test('los perfiles genéricos no contienen nombres de marca', () => {
  const txt = JSON.stringify(S.FAMILIA_DEFECTOS) + S.FAMILIAS.join(' ');
  assert.ok(!/leica|hamamatsu|philips|aperio|3dhistech|roche|ventana|zeiss|olympus|nikon/i.test(txt));
});

/* ---------- procesamiento de imagen sintética ---------- */
const imagen = (w, h, f) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, v = f(x, y); data[o] = v; data[o + 1] = v * 0.8; data[o + 2] = v * 0.9; data[o + 3] = 255; } return { data, width: w, height: h }; };
const tablero = (x, y) => ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? 220 : 60);
const hash = a => { let h = 0; for (let i = 0; i < a.length; i += 7) h = (h * 31 + a[i]) >>> 0; return h; };

test('rejilla: campos solapados, franjas de alto completo en modo por línea', () => {
  const p = S.crearPerfil({ family: 'high-volume' }), r = SIM.rejillaVista(p, 480, 4, 3);
  assert.equal(r.rects.length, 12); assert.ok(r.rects.every(c => c.x + c.w <= 480 && c.y + c.h <= r.H));
  const l = SIM.rejillaVista(S.crearPerfil({ scanMode: 'line' }), 480, 4, 3);
  assert.equal(l.rects.length, 4); assert.ok(l.rects.every(c => c.h === l.H));
});
test('desenfoque: más planos Z reducen la severidad hasta cubrir el relieve', () => {
  const a = SIM.parametrosDesenfoque(S.crearPerfil({ zPlanes: 1 })), b = SIM.parametrosDesenfoque(S.crearPerfil({ zPlanes: 3, zStepUm: 1 })), c = SIM.parametrosDesenfoque(S.crearPerfil({ zPlanes: 6, zStepUm: 1 }));
  assert.ok(a.severidad > b.severidad && b.severidad > c.severidad); assert.equal(c.radio, 0);
  const pocos = SIM.parametrosDesenfoque(S.crearPerfil({ focusPoints: 0 })), muchos = SIM.parametrosDesenfoque(S.crearPerfil({ focusPoints: 100 }));
  assert.ok(pocos.fraccion > muchos.fraccion);
});
test('procesar es determinista con la misma semilla y no cambia la imagen original', () => {
  const src = imagen(480, 288, tablero), copia = new Uint8ClampedArray(src.data), p = S.crearPerfil({}), rej = SIM.rejillaVista(p);
  const b = { seams: true, banding: true, strips: true, cast: true };
  const r1 = SIM.procesarArtefactos(src, p, b, rej), r2 = SIM.procesarArtefactos(src, p, b, rej), r3 = SIM.procesarArtefactos(src, p, b, rej, 99);
  assert.equal(hash(r1.data), hash(r2.data)); assert.notEqual(hash(r1.data), hash(r3.data)); assert.deepEqual(src.data, copia);
});
test('sin artefactos la imagen no cambia', () => {
  const src = imagen(480, 288, tablero), p = S.crearPerfil({}), r = SIM.procesarArtefactos(src, p, { seams: false, banding: false, strips: false, cast: false }, SIM.rejillaVista(p));
  assert.deepEqual(Array.from(r.data), Array.from(src.data));
});
test('un campo desenfocado baja la varianza del Laplaciano', () => {
  const src = imagen(480, 288, tablero), p = S.crearPerfil({ zPlanes: 1, focusPoints: 0 }), rej = SIM.rejillaVista(p);
  const r = SIM.procesarArtefactos(src, p, { seams: false, banding: false, strips: true, cast: false }, rej);
  assert.ok(r.afectados.length >= 1); const mala = rej.rects[r.afectados[0]], buena = rej.rects.find((_, i) => !r.afectados.includes(i));
  assert.ok(SIM.varianzaLaplaciano(r, mala) < SIM.varianzaLaplaciano(r, buena) * 0.5);
});
test('el sesgo de color mueve el color medio y la identidad no lo mueve', () => {
  const src = imagen(120, 80, tablero), med = SIM.mediaRGB(src), a = { data: new Uint8ClampedArray(src.data), width: 120, height: 80 };
  SIM.aplicarColor(a.data, { gain: [1, 1, 1], gamma: 1, sat: 1, bright: 0 });
  assert.deepEqual(SIM.mediaRGB(a).map(Math.round), med.map(Math.round));
  SIM.aplicarColor(a.data, S.FAMILIA_DEFECTOS['low-cost'].color);
  const d = SIM.mediaRGB(a); assert.ok(Math.hypot(d[0] - med[0], d[1] - med[1], d[2] - med[2]) > 5);
});
