import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
const FILE = process.argv[2] || '/home/claude/pdia/patologia_digital_ia_3d.html';
const OUT = process.argv[3] || '/home/claude/pdia/test/shots';
fs.mkdirSync(OUT, { recursive: true });
const NM = '/home/claude/pdia/test/node_modules/three';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox','--use-angle=swiftshader','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files','--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) errors.push(m.type()+': '+m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: '+e.message+'\n'+(e.stack||'')));
await page.setRequestInterception(true);
page.on('request', req => {
  const u = req.url();
  if (u.startsWith('https://unpkg.com/three@0.160.0/build/')) return req.respond({ status: 200, headers: {'access-control-allow-origin':'*'}, contentType: 'text/javascript', body: fs.readFileSync(NM + '/build/' + u.split('/build/')[1]) });
  if (u.startsWith('https://unpkg.com/three@0.160.0/examples/jsm/')) return req.respond({ status: 200, headers: {'access-control-allow-origin':'*'}, contentType: 'text/javascript', body: fs.readFileSync(NM + '/examples/jsm/' + u.split('/jsm/')[1]) });
  if (u.startsWith('file://')) return req.continue();
  if (u.startsWith('data:')) return req.continue();
  return req.respond({ status: 200, contentType: u.endsWith('.css')||u.includes('css2')?'text/css':'text/javascript', body: '' });
});
await page.goto('file://' + FILE, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 2500));
const ok = await page.evaluate(() => !!window.__pdia);
console.log('app booted:', ok);
export { page, browser, errors, OUT };
if (process.argv[4] === 'smoke') {
  await page.screenshot({ path: OUT + '/smoke.png' });
  console.log(errors.join('\n') || 'no console errors');
  await browser.close();
}
