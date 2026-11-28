/* Compara capturas de la v3.0 (legacy/v3.0) con la compilación actual en español.
 * La v3.0 pedía Three.js, Tailwind y fuentes a CDN: aquí se sirve una copia temporal con esas dependencias locales
 * (Three.js de node_modules, el reinicio equivalente al preflight y las fuentes del repositorio). legacy/v3.0 no se modifica.
 * Uso: npm run build && node scripts/legacy-compare.mjs [carpeta-de-salida] */
import http from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { startServer, launch, ROOT } from '../tests/lib/harness.mjs';

const OUT = process.argv[2] || join(ROOT, 'tests', '.output', 'legacy');
mkdirSync(OUT, { recursive: true });

const css = readFileSync(join(ROOT, 'src/styles/main.css'), 'utf8');
const reset = css.slice(css.indexOf('/* ---------- Reinicio'), css.indexOf('/* ----------', css.indexOf('/* ---------- Reinicio') + 10));
const fontDir = join(ROOT, 'node_modules/@fontsource-variable');
const faces = [];
for (const [pkg, fam] of [['inter', 'Inter'], ['jetbrains-mono', 'JetBrains Mono']]) {
  const dir = join(fontDir, pkg, 'files');
  for (const f of readdirSync(dir).filter(x => /-wght-normal\.woff2$/.test(x))) faces.push(`@font-face{font-family:'${fam}';font-weight:100 800;font-display:block;src:url(/fonts/${pkg}/${f}) format('woff2')}`);
}
let html = readFileSync(join(ROOT, 'legacy/v3.0/patologia_digital_ia_3d.html'), 'utf8');
html = html.replace(/https:\/\/unpkg\.com\/three@0\.160\.0\/build\/three\.module\.js/, '/three/build/three.module.js')
  .replace(/https:\/\/unpkg\.com\/three@0\.160\.0\/examples\/jsm\//, '/three/examples/jsm/')
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '').replace(/<link href="https:\/\/fonts\.googleapis[^>]*>\s*/, '')
  .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, `<style>${faces.join('')}${reset}</style>`);

const legacy = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const file = u === '/' ? null : u.startsWith('/three/') ? join(ROOT, 'node_modules/three', u.slice(7)) : u.startsWith('/fonts/') ? join(fontDir, u.slice(7).replace('/', '/files/')) : null;
  if (!file) { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(html); }
  if (!existsSync(file)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', { '.js': 'text/javascript', '.woff2': 'font/woff2' }[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise(r => legacy.once('listening', r));
const legacyUrl = `http://127.0.0.1:${legacy.address().port}/`;

const srv = await startServer(), browser = await launch();
const W = 1440, H = 900;
async function open(url, isNew) {
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(isNew ? url + '?lang=es' : url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pdia && (window.__pdia.ready !== false), { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}
const [L, N] = [await open(legacyUrl, false), await open(srv.url, true)];
const rows = [];
const shot = async (p, name) => { const path = join(OUT, name); await p.screenshot({ path }); return PNG.sync.read(readFileSync(path)); };
for (const modality of ['he', 'pap', 'ihc']) {
  // Desde la v2.0b las etapas E2 a E5 de la v3.0 son los módulos 4 a 7 (la etapa 1 pasó a ser M2 y ya no se compara)
  for (const stage of [2, 3, 4, 5]) {
    for (const { page, nuevo } of [{ ...L, nuevo: false }, { ...N, nuevo: true }]) {
      await page.evaluate((m, s) => { window.__pdia.setState('modality', m); window.__pdia.setStage(s, true); }, modality, nuevo ? stage + 2 : stage);
      await new Promise(r => setTimeout(r, 1800));
    }
    const a = await shot(L.page, `legacy-${modality}-${stage}.png`), b = await shot(N.page, `nuevo-${modality}-${stage}.png`);
    // se compara por debajo de la barra superior (la nueva lleva selector de idioma y "Acerca de"), en visor y panel por separado
    const region = (img, x0, y0, x1, y1) => { const o = new PNG({ width: x1 - x0, height: y1 - y0 }); PNG.bitblt(img, o, x0, y0, x1 - x0, y1 - y0, 0, 0); return o; };
    const cmp = (x0, x1) => { const A = region(a, x0, 100, x1, H), B = region(b, x0, 100, x1, H), D = new PNG({ width: x1 - x0, height: H - 100 }); const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.12 }); return { pct: 100 * n / (A.width * A.height), D }; };
    const v = cmp(0, 980), p = cmp(980, W);
    writeFileSync(join(OUT, `diff-visor-${modality}-${stage}.png`), PNG.sync.write(v.D)); writeFileSync(join(OUT, `diff-panel-${modality}-${stage}.png`), PNG.sync.write(p.D));
    rows.push({ modality, stage, visorPct: +v.pct.toFixed(2), panelPct: +p.pct.toFixed(2) });
    console.log(`${modality} etapa ${stage}: visor ${v.pct.toFixed(2)} %  panel ${p.pct.toFixed(2)} %`);
  }
}
writeFileSync(join(OUT, 'resumen.json'), JSON.stringify({ rows, erroresLegacy: L.errors, erroresNuevo: N.errors }, null, 2));
if (N.errors.length) console.log('Errores en la versión nueva:', N.errors);
await browser.close(); await srv.close(); legacy.close();
