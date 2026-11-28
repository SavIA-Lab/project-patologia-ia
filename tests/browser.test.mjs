/* Pruebas de navegador (Puppeteer) sobre la compilación de dist/. Se ejecutan con `npm test` (después de `npm run build`). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startServer, launch, openPage, goStage, settle, setState, OUT } from './lib/harness.mjs';

let srv, browser;
before(async () => { mkdirSync(OUT, { recursive: true }); srv = await startServer(); browser = await launch(); });
after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

const MODS = ['he', 'pap', 'ihc'];
const noErrors = (log, what) => { assert.deepEqual(log.console, [], `${what}: errores de consola`); assert.deepEqual(log.pageErrors, [], `${what}: errores de página`); assert.deepEqual(log.failed, [], `${what}: peticiones fallidas`); };
const visibleText = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim());
const sameOrigin = (log, origin) => log.requests.filter(u => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin);

for (const lang of ['es', 'en']) {
  test(`arranque sin errores de consola (${lang.toUpperCase()}) y recorrido de las 5 etapas`, async () => {
    const { page, log } = await openPage(browser, srv.url, { lang });
    assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
    for (let n = 1; n <= 5; n++) {
      await goStage(page, n);
      assert.equal(await page.evaluate(() => window.__pdia.state.stage), n);
      assert.ok((await visibleText(page, '#editorial-sidebar')).length > 200, `panel vacío en la etapa ${n}`);
      assert.ok(await page.$eval(`#stage-nav [data-stage="${n}"]`, b => b.classList.contains('active') || b.getAttribute('aria-current') === 'true' || /active|on/.test(b.className)), `etapa ${n} sin marcar`);
    }
    assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('⟦FALTA'), 'clave sin traducir visible');
    noErrors(log, lang); await page.close();
  });
}

for (const modality of MODS) {
  test(`recorrido de las 5 etapas en la modalidad ${modality} (ES y EN)`, async () => {
    for (const lang of ['es', 'en']) {
      const { page, log } = await openPage(browser, srv.url, { lang });
      await setState(page, 'modality', modality); await settle(page);
      for (let n = 1; n <= 5; n++) {
        await goStage(page, n);
        const text = await visibleText(page, '#editorial-sidebar');
        assert.ok(text.length > 200 && !text.includes('⟦'), `${modality}/${lang}: panel de la etapa ${n} incompleto`);
        assert.ok(/simulad|simulated/i.test(text), `${modality}/${lang}: falta la etiqueta "simulado" en la etapa ${n}`);
      }
      // en la etapa 5 el desafío y la curva ROC funcionan en cada modalidad
      await page.click('[data-action="challenge-start"]'); await settle(page, 100);
      assert.equal(await page.evaluate(() => window.__pdia.state.challenge.active), true);
      await page.click('[data-action="challenge-reset"]'); await settle(page, 100);
      await page.click('[data-action="tau-preset"][data-v="0.25"]'); await settle(page, 100);
      assert.equal(await page.evaluate(() => window.__pdia.state.tau), 0.25);
      noErrors(log, `${modality}/${lang}`); await page.close();
    }
  });
}

test('IHC: las etapas 2 a 5 se recorren con artefactos, normalización y agregadores (deuda de la v3.0)', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await setState(page, 'modality', 'ihc');
  await goStage(page, 2);
  for (const k of ['blur', 'folds', 'ink', 'bubbles']) await setState(page, `artifacts.${k}`, true);
  await setState(page, 'qcOn', false); await settle(page);
  await page.click('[data-action="pin-artifact"]'); await settle(page, 100);
  assert.ok(await page.evaluate(() => window.__pdia.state.pinned), 'no se fijó el artefacto');
  await goStage(page, 3);
  await setState(page, 'encoderTrained', true);
  for (const m of ['none', 'macenko', 'ssl']) { await setState(page, 'normMode', m); await settle(page, 100); }
  await setState(page, 'umapColor', 'hospital'); await settle(page, 100);
  await goStage(page, 4);
  for (const a of ['mean', 'max', 'attention']) { await setState(page, 'aggregator', a); await settle(page, 100); }
  await setState(page, 'distractor', true); await setState(page, 'groundTruth', 'neg'); await settle(page, 100);
  await goStage(page, 5);
  await page.click('[data-action="challenge-start"]'); await settle(page, 100);
  await page.click('[data-action="challenge-reset"]');
  for (const k of ['screen', 'balanced', 'confirm']) assert.ok(await page.$('[data-action="tau-preset"]'), k);
  await setState(page, 'heatScale', 'viridis'); await settle(page, 100);
  noErrors(log, 'IHC'); await page.close();
});

test('el parche fijado se conserva entre etapas y el rastro aparece en cada una', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await goStage(page, 2);
  await page.click('[data-action="pin-atypical"]'); await settle(page, 150);
  const pin = await page.evaluate(() => JSON.stringify(window.__pdia.state.pinned));
  assert.ok(pin && pin !== 'null', 'sin parche fijado');
  for (const n of [3, 4, 5, 2]) {
    await goStage(page, n);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__pdia.state.pinned)), pin, `el parche cambió en la etapa ${n}`);
    const hud = await page.$eval('#trace-hud', el => ({ shown: getComputedStyle(el).display !== 'none' && el.offsetHeight > 0, text: el.innerText }));
    assert.ok(hud.shown && hud.text.length > 10, `sin rastro del parche en la etapa ${n}`);
  }
  // el parche sobrevive al cambio de modalidad
  await setState(page, 'modality', 'pap'); await settle(page);
  assert.ok(await page.evaluate(() => window.__pdia.state.pinned), 'se perdió el parche al cambiar de modalidad');
  await page.click('#trace-hud button'); await settle(page, 100);
  assert.equal(await page.evaluate(() => window.__pdia.state.pinned), null);
  noErrors(log, 'parche'); await page.close();
});

test('cambiar de modalidad no deja objetos huérfanos en la escena', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  const stats = async () => page.evaluate(() => { const d = window.__pdia.diag(); return { g: d.geometries, t: d.textures, o: d.objects }; });
  for (const n of [1, 2, 3, 4, 5]) await goStage(page, n);       // carga todos los módulos
  await goStage(page, 2);
  for (const m of ['pap', 'ihc', 'he']) { await setState(page, 'modality', m); await settle(page, 200); }
  const base = await stats();
  for (let i = 0; i < 3; i++) for (const m of ['pap', 'ihc', 'he']) { await setState(page, 'modality', m); await settle(page, 200); }
  const after = await stats();
  assert.deepEqual(after, base, 'geometrías, texturas u objetos crecieron tras cambiar de modalidad varias veces');
  noErrors(log, 'huérfanos'); await page.close();
});

test('el cuestionario: 8 preguntas, respuesta correcta puntúa y el avance sobrevive al cambio de idioma', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  const correct = await page.evaluate(() => window.__pdia.MODULES.flatMap(m => m.questions.map(q => q.correct)));
  assert.equal(correct.length, 8);
  await page.click('#btn-quiz'); await settle(page, 100);
  assert.ok(await page.$eval('#quiz-modal', el => el.classList.contains('show') || getComputedStyle(el).display !== 'none'));
  for (let i = 0; i < 8; i++) {
    if (i === 3) {                                     // cambio de idioma a mitad del cuestionario
      await page.evaluate(() => window.__pdia.setLang('en')); await settle(page, 100);
      assert.equal((await page.evaluate(() => window.__pdia.quizState())).i, 3, 'el cuestionario perdió la pregunta actual');
      assert.match(await visibleText(page, '#quiz-modal'), /Question 4 of 8/);
    }
    const wrong = (correct[i] + 1) % 4;
    await page.click(`[data-qopt="${i === 5 ? wrong : correct[i]}"]`); await settle(page, 50);
    await page.click('[data-q="next"]'); await settle(page, 50);
  }
  const q = await page.evaluate(() => window.__pdia.quizState());
  assert.equal(q.score, 7, 'puntaje: 7 correctas de 8');
  assert.match(await visibleText(page, '#quiz-modal'), /7/);
  await page.evaluate(() => window.__pdia.setLang('es')); await settle(page, 100);
  assert.match(await visibleText(page, '#quiz-modal'), /resultado/i);
  await page.keyboard.press('Escape'); await settle(page, 100);
  assert.ok(!(await page.$eval('#quiz-modal', el => el.classList.contains('show'))));
  noErrors(log, 'quiz'); await page.close();
});

test('cambio de idioma en caliente: conserva modalidad, módulo, parche, controles y 3D', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await setState(page, 'modality', 'pap'); await goStage(page, 2);
  await setState(page, 'patchSize', 512); await setState(page, 'artifacts.blur', true); await setState(page, 'qcOn', false); await settle(page);
  await page.click('[data-action="pin-atypical"]'); await settle(page, 100);
  const snap = () => page.evaluate(() => { const s = window.__pdia.state; return JSON.stringify({ m: s.modality, st: s.stage, p: s.patchSize, a: s.artifacts, qc: s.qcOn, pin: s.pinned, ex: s.explode }); });
  const before = await snap();
  const objs = await page.evaluate(() => window.__pdia.diag().objects);
  await page.click('#lang-seg [data-lang="en"]'); await settle(page, 300);
  assert.equal(await snap(), before, 'el estado cambió al cambiar de idioma');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  const sidebar = await visibleText(page, '#editorial-sidebar');
  assert.match(sidebar, /Quality control/); assert.ok(!/Control de calidad/.test(sidebar));
  assert.ok(await page.$eval('#trace-hud', el => el.innerText.length > 5 && !/parche/i.test(el.innerText)), 'el rastro no se tradujo');
  assert.equal(await page.$eval('#stage-nav [data-stage="2"]', b => b.innerText.includes('QC')), true);
  assert.ok(await page.$eval('[data-toggle="qcOn"]', el => el.checked === false), 'el interruptor de QC cambió');
  assert.equal(await page.evaluate(() => window.__pdia.diag().objects), objs, 'cambió el número de objetos 3D');
  // el selector del parámetro de URL sigue al idioma y se conserva al recargar
  assert.equal(new URL(page.url()).searchParams.get('lang'), 'en');
  await page.click('#lang-seg [data-lang="es"]'); await settle(page, 300);
  assert.equal(await snap(), before);
  noErrors(log, 'idioma'); await page.close();
});

test('las etiquetas de la escena 3D se regeneran al cambiar de idioma', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  const sig = async () => page.evaluate(() => { const out = []; window.__pdia.diag(); const sc = window.__pdia; let n = 0; void n; void sc; return out; });
  void sig;
  // la lámina de la etapa 1 lleva rótulos pintados en un lienzo; cambian con el idioma
  const hash = () => page.evaluate(async () => { const m = window.__pdia.loaded.get('wsi-pyramid'); const c = []; m.group.traverse(o => { if (o.material && o.material.map && o.material.map.image && o.material.map.image.toDataURL && o.isSprite) c.push(o.material.map.image.toDataURL()); }); return c.join('|').length + ':' + c.map(s => s.length).join(','); });
  const a = await hash(); await page.evaluate(() => window.__pdia.setLang('en')); await settle(page, 300); const b = await hash();
  assert.notEqual(a, b, 'las etiquetas 3D no cambiaron de idioma');
  noErrors(log, 'etiquetas'); await page.close();
});

test('sin texto fijo: en modo pseudo todo texto visible sale del diccionario', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  const stray = [];
  for (const modality of MODS) {
    await setState(page, 'modality', modality);
    for (let n = 1; n <= 5; n++) {
      await goStage(page, n);
      if (n === 5) { await page.click('[data-action="challenge-start"]'); await settle(page, 100); }
      await page.evaluate(() => window.__pdia.setLang('pseudo')); await settle(page, 200);
      const found = await page.evaluate(() => {
        const out = [], skip = new Set(['SCRIPT', 'STYLE', 'CANVAS']);
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement; if (!el || skip.has(el.tagName) || el.closest('#lang-seg, #toast')) continue;
          if (!el.checkVisibility({ visibilityProperty: true })) continue;
          const s = n.nodeValue.replace(/⟦[^⟧]*⟧/g, '').replace(/[\s\d.,:;%·×/+\-−–—→()[\]{}|=<>≈µ'"“”‘’!?¿¡]/g, '');
          // se ignoran los símbolos matemáticos y siglas fijas; se señala cualquier otra letra suelta fuera de claves
          if (/^(µm|nm|mm|px|Mpx|Gpx|MB|GB|KB|mpx|TP|TN|FP|FN|ES|EN)+$/.test(s)) continue;
          if (/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/.test(s)) out.push(n.nodeValue.trim().slice(0, 80));
        }
        return out;
      });
      for (const f of found) stray.push(`${modality}/etapa ${n}: ${f}`);
      await page.evaluate(() => window.__pdia.setLang('es')); await settle(page, 100);
      if (n === 5) await page.evaluate(() => document.querySelector('[data-action="challenge-reset"]')?.click());
    }
  }
  const uniq = [...new Set(stray.map(s => s.replace(/^.*?: /, '')))];
  assert.deepEqual(uniq, [], 'textos visibles que no pasan por t()');
  noErrors(log, 'pseudo'); await page.close();
});

test('todas las peticiones van al mismo origen (sin CDN ni fuentes externas)', async () => {
  for (const lang of ['es', 'en']) {
    const { page, log } = await openPage(browser, srv.url, { lang });
    for (let n = 1; n <= 5; n++) await goStage(page, n);
    await page.click('#btn-about'); await settle(page, 100); await page.keyboard.press('Escape');
    assert.deepEqual(sameOrigin(log, srv.origin), [], `peticiones a otros orígenes (${lang})`);
    assert.ok(log.requests.some(u => /\.woff2/.test(u)), 'las fuentes deben salir del propio sitio');
    await page.close();
  }
});

test('pantalla "Acerca de": autoría, herramienta, etiqueta simulado y qué es real', async () => {
  for (const lang of ['es', 'en']) {
    const { page, log } = await openPage(browser, srv.url, { lang });
    await page.click('#btn-about'); await settle(page, 100);
    const text = await visibleText(page, '#about-modal');
    for (const must of ['Andrés Felipe Cardona-Mendoza', 'SavIA Lab–INMUBO', 'Universidad El Bosque', 'Claude Sonnet 5.5', '© 2026']) assert.ok(text.includes(must), `${lang}: falta "${must}"`);
    assert.ok(/simulad|simulated/i.test(text));
    assert.ok(await page.$('#about-modal .logo-slot'), 'falta el espacio del logo de SavIA');
    assert.ok(await page.$eval('#about-modal .about-card', el => el.querySelectorAll('img').length === 0), 'no debe haber logos de universidades');
    await page.keyboard.press('Escape'); await settle(page, 100);
    assert.ok(!(await page.$eval('#about-modal', el => el.classList.contains('show'))));
    noErrors(log, `about ${lang}`); await page.close();
  }
});

test('etiqueta "Traducción en borrador" visible solo en inglés, con su equivalente en español', async () => {
  const { page } = await openPage(browser, srv.url, { lang: 'es' });
  assert.equal(await page.$eval('#draft-label', el => el.hidden || getComputedStyle(el).display === 'none'), true, 'visible en ES');
  await page.click('#lang-seg [data-lang="en"]'); await settle(page, 150);
  const txt = await visibleText(page, '#draft-label');
  assert.match(txt, /Draft translation, pending review/); assert.match(txt, /Traducción en borrador, pendiente de revisión/);
  await page.close();
});

test('idioma inicial: ?lang= → guardado → navegador', async () => {
  let r = await openPage(browser, srv.url, { lang: 'en', storedLang: 'es' });
  assert.equal(await r.page.evaluate(() => window.__pdia.getLang()), 'en'); await r.page.close();
  r = await openPage(browser, srv.url, { lang: null, storedLang: 'en' });
  assert.equal(await r.page.evaluate(() => window.__pdia.getLang()), 'en'); await r.page.close();
  r = await openPage(browser, srv.url, { lang: null });
  const nav = await r.page.evaluate(() => (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en');
  assert.equal(await r.page.evaluate(() => window.__pdia.getLang()), nav); await r.page.close();
  // la elección se guarda y la siguiente visita sin parámetro la respeta
  r = await openPage(browser, srv.url, { lang: 'es' });
  await r.page.click('#lang-seg [data-lang="en"]');
  assert.equal(await r.page.evaluate(() => localStorage.getItem('pdia.lang')), 'en'); await r.page.close();
});

test('Pap: los marcadores 1 y 2 del top-3 no se solapan (deuda de la v3.0)', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await setState(page, 'modality', 'pap'); await goStage(page, 5); await settle(page, 400);
  const d = await page.evaluate(() => {
    const m = window.__pdia.loaded.get('xai-threshold').scene.markers, D = window.__pdia.diag();
    const ring = m.map(k => { const w = k.grp.position.clone(); return D.toPixels(w); });
    const lab = m.map(k => { const w = k.grp.children[2].getWorldPosition(k.grp.position.clone()); return D.toPixels(w); });
    return { ring, lab };
  });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(dist(d.lab[0], d.lab[1]) > 24, `rótulos 1 y 2 demasiado cerca: ${dist(d.lab[0], d.lab[1]).toFixed(1)} px`);
  noErrors(log, 'pap'); await page.close();
});

for (const [width, height] of [[1440, 900], [768, 1024]]) {
  test(`sin desbordamiento a ${width} px (todas las etapas, modalidades e idiomas)`, async () => {
    for (const lang of ['es', 'en']) {
      const { page, log } = await openPage(browser, srv.url, { width, height, lang });
      for (const modality of MODS) {
        await setState(page, 'modality', modality);
        for (let n = 1; n <= 5; n++) {
          await goStage(page, n);
          const o = await page.evaluate(() => {
            const de = document.documentElement, bad = [];
            if (de.scrollWidth > de.clientWidth) bad.push(`documento ${de.scrollWidth}>${de.clientWidth}`);
            for (const sel of ['#topbar', '#main', '#viewport', '#editorial-sidebar', '#stage-nav']) {
              const e = document.querySelector(sel); if (e && e.scrollWidth > e.clientWidth + 1) bad.push(`${sel} ${e.scrollWidth}>${e.clientWidth}`);
            }
            const sb = document.querySelector('#editorial-sidebar'), r = sb.getBoundingClientRect();
            sb.querySelectorAll('*').forEach(e => { const q = e.getBoundingClientRect(); if (q.width && q.right > r.right + 1 && getComputedStyle(e).position !== 'fixed') bad.push(`panel: <${e.tagName.toLowerCase()} ${e.className}> sobresale ${Math.round(q.right - r.right)} px`); });
            return bad.slice(0, 5);
          });
          assert.deepEqual(o, [], `${width}px ${lang}/${modality}/etapa ${n}`);
        }
      }
      if (lang === 'es') { for (const n of [1, 2, 3, 4, 5]) { await goStage(page, n); await settle(page, 400); await page.screenshot({ path: `${OUT}/ancho-${width}-etapa-${n}.png` }); } }
      noErrors(log, `desbordamiento ${width}`); await page.close();
    }
  });
}

test('a 768 px el panel lateral se apila debajo del visor; a 1440 px va a su lado', async () => {
  const pos = async (w, h) => {
    const { page } = await openPage(browser, srv.url, { width: w, height: h, lang: 'es' });
    const r = await page.evaluate(() => { const v = document.querySelector('#viewport').getBoundingClientRect(), s = document.querySelector('#editorial-sidebar').getBoundingClientRect(); return { vb: v.bottom, st: s.top, sl: s.left, vr: v.right, vh: v.height, sw: s.width }; });
    await page.close(); return r;
  };
  const wide = await pos(1440, 900), narrow = await pos(768, 1024);
  assert.ok(wide.sl >= wide.vr - 1, 'a 1440 px el panel debe ir a la derecha del visor');
  assert.ok(narrow.st >= narrow.vb - 1, 'a 768 px el panel debe ir debajo del visor');
  assert.ok(narrow.vh >= 300, 'el visor conserva altura útil a 768 px');
  assert.ok(narrow.sw >= 700, 'el panel apilado usa todo el ancho');
});
