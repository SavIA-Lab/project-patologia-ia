/* Localiza Chrome o Chromium sin rutas absolutas del autor.
 * Orden: CHROME_PATH → PUPPETEER_EXECUTABLE_PATH → nombres habituales en el PATH → rutas estándar del sistema →
 * caché de Puppeteer en el directorio personal. Si no encuentra nada, el error explica cómo indicarlo. */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const PATH_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'chrome.exe'];
const SYSTEM_PATHS = {
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/google/chrome/chrome'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  win32: [join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'), join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe')]
};

function fromPath(name) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/).find(Boolean) : null;
}
function fromPuppeteerCache() {
  const root = join(homedir(), '.cache', 'puppeteer');
  if (!existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { stack.push(p); continue; }
      if (f === 'chrome' || f === 'chrome.exe' || f === 'Google Chrome for Testing') return p;
    }
  }
  return null;
}
export function findChrome() {
  for (const v of [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH]) if (v && existsSync(v)) return v;
  for (const n of PATH_NAMES) { const p = fromPath(n); if (p && existsSync(p)) return p; }
  for (const p of SYSTEM_PATHS[process.platform] || []) if (existsSync(p)) return p;
  const c = fromPuppeteerCache(); if (c) return c;
  throw new Error('No se encontró Chrome ni Chromium. Instala uno o indica su ruta con la variable de entorno CHROME_PATH (por ejemplo: CHROME_PATH=/usr/bin/chromium npm test).');
}
