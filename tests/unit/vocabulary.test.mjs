import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flatten } from '../../src/i18n/index.js';
import { findBanned } from '../lib/banned.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');

test('el detector reconoce el vocabulario prohibido (inglés y español)', () => {
  assert.deepEqual(findBanned('We leverage a robust, holistic approach').sort(), ['holistic', 'leverage', 'robust']);
  assert.ok(findBanned('Esto aprovecha un enfoque holístico y robusto').includes('holístico'));
  assert.ok(findBanned('This serves as a guide').includes('serves as'));
  assert.deepEqual(findBanned('Reglas claras, sin relleno. The kinetics of the process.'), []);
});

test('los diccionarios ES y EN no usan vocabulario prohibido', () => {
  const bad = [];
  for (const lang of ['es', 'en']) {
    const d = flatten(JSON.parse(readFileSync(join(ROOT, `src/i18n/${lang}.json`), 'utf8')));
    for (const [k, v] of Object.entries(d)) { const f = findBanned(strip(v)); if (f.length) bad.push(`${lang}:${k} → ${f.join(', ')}`); }
  }
  assert.deepEqual(bad, []);
});

test('los documentos del repositorio no usan vocabulario prohibido', () => {
  const files = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'index.html', ...(existsSync(join(ROOT, 'docs')) ? readdirSync(join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => `docs/${f}`) : []),
    ...(existsSync(join(ROOT, '.github/ISSUE_TEMPLATE')) ? readdirSync(join(ROOT, '.github/ISSUE_TEMPLATE')).map(f => `.github/ISSUE_TEMPLATE/${f}`) : [])];
  const bad = [];
  for (const f of files) { if (!existsSync(join(ROOT, f))) continue; const r = findBanned(strip(readFileSync(join(ROOT, f), 'utf8'))); if (r.length) bad.push(`${f} → ${r.join(', ')}`); }
  assert.deepEqual(bad, []);
});
