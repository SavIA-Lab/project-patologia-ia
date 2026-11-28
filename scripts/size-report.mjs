/* Peso del paquete publicado (dist/), por módulo y total, en bytes sin comprimir y con gzip.
 * Uso: npm run build && npm run report:size */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), DIST = join(ROOT, 'dist');
if (!existsSync(DIST)) { console.error('Falta dist/. Ejecuta `npm run build` primero.'); process.exit(1); }
const walk = (d, o = []) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, o) : o.push(p); } return o; };
const files = walk(DIST).map(p => { const b = readFileSync(p); return { name: relative(DIST, p).replaceAll('\\', '/'), raw: b.length, gz: /\.(woff2|png)$/.test(p) ? b.length : gzipSync(b).length }; });
const ids = readdirSync(join(ROOT, 'src/modules'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const group = f => {
  const m = ids.find(id => f.name.startsWith(`assets/${id}-`));
  if (m) return `módulo ${m}`;
  if (/^assets\/index-.*\.js$/.test(f.name)) return 'núcleo (Three.js, motor, interfaz, idiomas)';
  if (/\.css$/.test(f.name)) return 'estilos';
  if (/\.woff2$/.test(f.name)) return 'fuentes';
  if (/^assets\/.*\.js$/.test(f.name)) return 'código compartido entre módulos';
  return 'páginas y recursos (HTML, favicon, imagen social)';
};
const sums = new Map();
for (const f of files) { const g = group(f), s = sums.get(g) || { raw: 0, gz: 0, n: 0 }; s.raw += f.raw; s.gz += f.gz; s.n++; sums.set(g, s); }
const kb = n => (n / 1024).toFixed(1).padStart(8) + ' KB';
const total = files.reduce((a, f) => ({ raw: a.raw + f.raw, gz: a.gz + f.gz }), { raw: 0, gz: 0 });
console.log('| Parte | Archivos | Sin comprimir | Transferido (gzip) |\n|---|---:|---:|---:|');
for (const [g, s] of [...sums].sort((a, b) => b[1].raw - a[1].raw)) console.log(`| ${g} | ${s.n} | ${kb(s.raw)} | ${kb(s.gz)} |`);
console.log(`| **Total** | ${files.length} | ${kb(total.raw)} | ${kb(total.gz)} |`);
