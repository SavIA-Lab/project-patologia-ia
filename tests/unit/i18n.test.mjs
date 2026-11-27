import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flatten, pickInitialLang } from '../../src/i18n/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const es = flatten(read('src/i18n/es.json')), en = flatten(read('src/i18n/en.json'));
const params = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

test('ES y EN tienen exactamente las mismas claves', () => {
  const onlyEs = Object.keys(es).filter(k => !(k in en)), onlyEn = Object.keys(en).filter(k => !(k in es));
  assert.deepEqual(onlyEs, [], 'claves solo en es.json');
  assert.deepEqual(onlyEn, [], 'claves solo en en.json');
});

test('ningún valor está vacío y los marcadores {x} coinciden entre idiomas', () => {
  for (const k of Object.keys(es)) {
    assert.ok(String(es[k]).trim() && String(en[k]).trim(), `valor vacío en ${k}`);
    assert.equal(params(es[k]), params(en[k]), `marcadores distintos en ${k}`);
  }
});

/* Textos idénticos a propósito: nombres técnicos que no se traducen, fórmulas y la etiqueta del borrador (que va siempre en español) */
const SAME_ON_PURPOSE = new Set(['app.pipeline', 'draft.labelEs', 'norm.ssl', 'agg.attention', 'agg.attention.short', 'module.encoder-shift.nav', 's3.lbl.encoder',
  'module.mil-attention.title', 's4.lbl.agg.mean', 's4.lbl.agg.attention', 's5.banner.item', 's5.trace.weight']);
test('el inglés no copia el español salvo la lista explícita de nombres técnicos', () => {
  const allowed = /^[\sA-Z0-9&·×%/.,:+→–—()\-≈µ]*$/;
  const same = Object.keys(es).filter(k => es[k] === en[k] && !SAME_ON_PURPOSE.has(k) && !allowed.test(es[k]) && es[k].length > 12);
  assert.deepEqual(same, [], 'textos idénticos (¿falta traducir?)');
});

test('toda clave usada en el código con t(\'literal\') existe en el diccionario', () => {
  const used = new Set(), prefixes = new Set();
  for (const f of walk(join(ROOT, 'src')).filter(p => p.endsWith('.js'))) {
    const code = readFileSync(f, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*'([\w.-]+)'\s*[,)]/g)) used.add(m[1]);
    for (const m of code.matchAll(/\bt\(\s*`([\w.-]*)\$\{/g)) prefixes.add(m[1]);
    for (const m of code.matchAll(/\bt\(\s*'([\w.-]+\.)'\s*\+/g)) prefixes.add(m[1]);
  }
  for (const f of ['index.html']) {
    const html = readFileSync(join(ROOT, f), 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-title|-aria|-html)?="([\w.-]+)"/g)) used.add(m[1]);
  }
  const missing = [...used].filter(k => !(k in es));
  assert.deepEqual(missing, [], 'claves usadas que no existen');
  for (const p of prefixes) assert.ok(Object.keys(es).some(k => k.startsWith(p)), `no hay claves con el prefijo ${p}`);
});

test('pickInitialLang: ?lang= → guardado → navegador (es→ES, otro→EN)', () => {
  assert.equal(pickInitialLang({ search: '?lang=en', stored: 'es', navigatorLanguages: ['es-CO'] }), 'en');
  assert.equal(pickInitialLang({ search: '?lang=es', stored: 'en', navigatorLanguages: ['en-US'] }), 'es');
  assert.equal(pickInitialLang({ search: '', stored: 'en', navigatorLanguages: ['es-CO'] }), 'en');
  assert.equal(pickInitialLang({ search: '', stored: null, navigatorLanguages: ['es-419'] }), 'es');
  assert.equal(pickInitialLang({ search: '', stored: null, navigatorLanguages: ['pt-BR'] }), 'en');
  assert.equal(pickInitialLang({ search: '', stored: null, navigatorLanguages: [] }), 'en');
  assert.equal(pickInitialLang({ search: '?lang=fr', stored: 'xx', navigatorLanguages: ['es'] }), 'es', 'valores no admitidos se ignoran');
});
