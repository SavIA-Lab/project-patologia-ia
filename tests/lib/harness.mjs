/* Ayudantes comunes de las pruebas de navegador: servidor de la compilación, navegador, registro de errores y de peticiones. */
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './chrome.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = join(ROOT, 'tests', '.output');

/** Sirve la carpeta dist/ con la misma base que en GitHub Pages. Exige haber ejecutado `npm run build`. */
export async function startServer() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('Falta dist/. Ejecuta `npm run build` antes de las pruebas de navegador.');
  const server = await preview({ root: ROOT, preview: { port: 0, host: '127.0.0.1', strictPort: false, open: false }, logLevel: 'silent' });
  const url = server.resolvedUrls.local[0];
  return { url, origin: new URL(url).origin, close: () => new Promise(res => server.httpServer.close(res)) };
}

export async function launch() {
  return puppeteer.launch({
    executablePath: findChrome(), headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage']
  });
}

/** Abre una página y recoge errores de consola, errores de página y peticiones */
export async function openPage(browser, url, { width = 1440, height = 900, lang = 'es', storedLang } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const log = { console: [], pageErrors: [], requests: [], failed: [] };
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) log.console.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => log.pageErrors.push(String(e && e.message || e)));
  page.on('request', r => log.requests.push(r.url()));
  page.on('requestfailed', r => log.failed.push(`${r.url()} ${r.failure() && r.failure().errorText}`));
  if (storedLang) await page.evaluateOnNewDocument(l => { try { localStorage.setItem('pdia.lang', l); } catch (e) { /* sin almacenamiento */ } }, storedLang);
  const target = new URL(url); if (lang) target.searchParams.set('lang', lang);
  await page.goto(target.href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pdia && window.__pdia.ready, { timeout: 30000 });
  await page.evaluate(() => window.__pdia.processDirty());
  return { page, log };
}

/** Espera a que los fotogramas pendientes se dibujen */
export const settle = (page, ms = 250) => page.evaluate(m => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), m)), ms);
export const goStage = async (page, n) => { await page.evaluate(k => window.__pdia.setStage(k, true), n); await settle(page, 150); };
export const setState = (page, path, v) => page.evaluate((p, x) => window.__pdia.setState(p, x), path, v);
