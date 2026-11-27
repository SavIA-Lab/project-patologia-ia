import { startServer, launch, openPage, goStage, settle, OUT } from './lib/harness.mjs';
const srv = await startServer(); const browser = await launch();
const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
for (const n of [1,3,5]) { await goStage(page, n); await settle(page, 600); await page.screenshot({ path: `${OUT}/new-s${n}.png` }); }
console.log(log.console, log.pageErrors);
await browser.close(); await srv.close();
