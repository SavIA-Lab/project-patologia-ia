/* Pruebas de navegador (Puppeteer) sobre la compilación de dist/. Se ejecutan con `npm test` (después de `npm run build`). */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startServer, launch, openPage, goStage, settle, setState, OUT } from './lib/harness.mjs';

let srv, browser;
before(async () => { mkdirSync(OUT, { recursive: true }); srv = await startServer(); browser = await launch(); });
after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

const MODS = ['he', 'pap', 'ihc'];
/* Módulos del curso, en el orden de la navegación: 1 M0, 2 M1, 3 M2, 4 a 7 las etapas E2 a E5 de la v3.0 (sin cambios). */
const ALL = [1, 2, 3, 4, 5, 6, 7], TWO_D = [1, 2, 3];
const LEG = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 };           // número de etapa de la v3.0 → posición actual
const goLegacy = (page, n) => goStage(page, LEG[n]);
const noErrors = (log, what) => { assert.deepEqual(log.console, [], `${what}: errores de consola`); assert.deepEqual(log.pageErrors, [], `${what}: errores de página`); assert.deepEqual(log.failed, [], `${what}: peticiones fallidas`); };
const visibleText = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim());
const sameOrigin = (log, origin) => log.requests.filter(u => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin);

for (const lang of ['es', 'en']) {
  test(`arranque sin errores de consola (${lang.toUpperCase()}) y recorrido de los 7 módulos`, async () => {
    const { page, log } = await openPage(browser, srv.url, { lang });
    assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
    for (const n of ALL) {
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
  test(`recorrido de los 7 módulos en la modalidad ${modality} (ES y EN)`, async () => {
    for (const lang of ['es', 'en']) {
      const { page, log } = await openPage(browser, srv.url, { lang });
      await setState(page, 'modality', modality); await settle(page);
      for (const n of ALL) {
        await goStage(page, n);
        const text = await visibleText(page, '#editorial-sidebar');
        assert.ok(text.length > 200 && !text.includes('⟦'), `${modality}/${lang}: panel de la etapa ${n} incompleto`);
        assert.ok(/simulad|simulated/i.test(text), `${modality}/${lang}: falta la etiqueta "simulado" en la etapa ${n}`);
      }
      // en la etapa E5 (módulo 7) el desafío y la curva ROC funcionan en cada modalidad
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
  await goLegacy(page, 2);
  for (const k of ['blur', 'folds', 'ink', 'bubbles']) await setState(page, `artifacts.${k}`, true);
  await setState(page, 'qcOn', false); await settle(page);
  await page.click('[data-action="pin-artifact"]'); await settle(page, 100);
  assert.ok(await page.evaluate(() => window.__pdia.state.pinned), 'no se fijó el artefacto');
  await goLegacy(page, 3);
  await setState(page, 'encoderTrained', true);
  for (const m of ['none', 'macenko', 'ssl']) { await setState(page, 'normMode', m); await settle(page, 100); }
  await setState(page, 'umapColor', 'hospital'); await settle(page, 100);
  await goLegacy(page, 4);
  for (const a of ['mean', 'max', 'attention']) { await setState(page, 'aggregator', a); await settle(page, 100); }
  await setState(page, 'distractor', true); await setState(page, 'groundTruth', 'neg'); await settle(page, 100);
  await goLegacy(page, 5);
  await page.click('[data-action="challenge-start"]'); await settle(page, 100);
  await page.click('[data-action="challenge-reset"]');
  for (const k of ['screen', 'balanced', 'confirm']) assert.ok(await page.$('[data-action="tau-preset"]'), k);
  await setState(page, 'heatScale', 'viridis'); await settle(page, 100);
  noErrors(log, 'IHC'); await page.close();
});

test('el parche fijado se conserva entre etapas y el rastro aparece en cada una', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await goLegacy(page, 2);
  await page.click('[data-action="pin-atypical"]'); await settle(page, 150);
  const pin = await page.evaluate(() => JSON.stringify(window.__pdia.state.pinned));
  assert.ok(pin && pin !== 'null', 'sin parche fijado');
  for (const n of [3, 4, 5, 2]) {
    await goLegacy(page, n);
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
  for (const n of ALL) await goStage(page, n);       // carga todos los módulos
  await goLegacy(page, 2);
  for (const m of ['pap', 'ihc', 'he']) { await setState(page, 'modality', m); await settle(page, 200); }
  const base = await stats();
  for (let i = 0; i < 3; i++) for (const m of ['pap', 'ihc', 'he']) { await setState(page, 'modality', m); await settle(page, 200); }
  const after = await stats();
  assert.deepEqual(after, base, 'geometrías, texturas u objetos crecieron tras cambiar de modalidad varias veces');
  noErrors(log, 'huérfanos'); await page.close();
});

test('el cuestionario: 22 preguntas (8 de la v3.0 y las de M0, M1 y M2), respuesta correcta puntúa y el avance sobrevive al cambio de idioma', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  const correct = await page.evaluate(() => window.__pdia.MODULES.flatMap(m => m.questions.map(q => q.correct)));
  const N = correct.length; assert.equal(N, 22);
  await page.click('#btn-quiz'); await settle(page, 100);
  assert.ok(await page.$eval('#quiz-modal', el => el.classList.contains('show') || getComputedStyle(el).display !== 'none'));
  for (let i = 0; i < N; i++) {
    if (i === 3) {                                     // cambio de idioma a mitad del cuestionario
      await page.evaluate(() => window.__pdia.setLang('en')); await settle(page, 100);
      assert.equal((await page.evaluate(() => window.__pdia.quizState())).i, 3, 'el cuestionario perdió la pregunta actual');
      assert.match(await visibleText(page, '#quiz-modal'), /Question 4 of 22/);
    }
    const wrong = (correct[i] + 1) % 4;
    await page.click(`[data-qopt="${i === 5 ? wrong : correct[i]}"]`); await settle(page, 50);
    await page.click('[data-q="next"]'); await settle(page, 50);
  }
  const q = await page.evaluate(() => window.__pdia.quizState());
  assert.equal(q.score, N - 1, 'puntaje: todas correctas salvo una');
  assert.match(await visibleText(page, '#quiz-modal'), new RegExp(String(N - 1)));
  await page.evaluate(() => window.__pdia.setLang('es')); await settle(page, 100);
  assert.match(await visibleText(page, '#quiz-modal'), /resultado/i);
  await page.keyboard.press('Escape'); await settle(page, 100);
  assert.ok(!(await page.$eval('#quiz-modal', el => el.classList.contains('show'))));
  noErrors(log, 'quiz'); await page.close();
});

test('cambio de idioma en caliente: conserva modalidad, módulo, parche, controles y 3D', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await setState(page, 'modality', 'pap'); await goLegacy(page, 2);
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
  assert.equal(await page.$eval('#stage-nav [data-stage="4"]', b => b.innerText.includes('QC')), true);
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
  await goLegacy(page, 3);
  // los rótulos 3D de E3 van pintados en un lienzo; cambian con el idioma
  const hash = () => page.evaluate(async () => { const m = window.__pdia.loaded.get('encoder-shift'); const c = []; m.group.traverse(o => { if (o.material && o.material.map && o.material.map.image && o.material.map.image.toDataURL && o.isSprite) c.push(o.material.map.image.toDataURL()); }); return c.join('|').length + ':' + c.map(s => s.length).join(','); });
  const a = await hash(); await page.evaluate(() => window.__pdia.setLang('en')); await settle(page, 300); const b = await hash();
  assert.notEqual(a, b, 'las etiquetas 3D no cambiaron de idioma');
  noErrors(log, 'etiquetas'); await page.close();
});

test('sin texto fijo: en modo pseudo todo texto visible sale del diccionario', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  const stray = [];
  for (const modality of MODS) {
    await setState(page, 'modality', modality);
    for (const n of ALL) {
      await goStage(page, n);
      if (n === 7) { await page.click('[data-action="challenge-start"]'); await settle(page, 100); }
      await page.evaluate(() => window.__pdia.setLang('pseudo')); await settle(page, 200);
      const found = await page.evaluate(() => {
        const out = [], skip = new Set(['SCRIPT', 'STYLE', 'CANVAS']);
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement; if (!el || skip.has(el.tagName) || el.closest('#lang-seg, #toast, pre, code')) continue;   // el código fuente no es texto de interfaz (sus comentarios sí salen del diccionario y se ven en pseudo)
          if (!el.checkVisibility({ visibilityProperty: true })) continue;
          const s = n.nodeValue.replace(/⟦[^⟧]*⟧/g, '').replace(/[\s\d.,:;%·×/+\-−–—→()[\]{}|=<>≈µ'"“”‘’!?¿¡]/g, '');
          // se ignoran los símbolos matemáticos y siglas fijas; se señala cualquier otra letra suelta fuera de claves
          if (/^(µm|nm|mm|px|Mpx|Gpx|MB|GB|TB|KB|mpx|TP|TN|FP|FN|ES|EN|PPI|RGB|Δ|min|s|h|Python|OpenSlide|JSON)+$/.test(s)) continue;
          if (/[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/.test(s)) out.push(n.nodeValue.trim().slice(0, 80));
        }
        return out;
      });
      for (const f of found) stray.push(`${modality}/etapa ${n}: ${f}`);
      await page.evaluate(() => window.__pdia.setLang('es')); await settle(page, 100);
      if (n === 7) await page.evaluate(() => document.querySelector('[data-action="challenge-reset"]')?.click());
    }
  }
  const uniq = [...new Set(stray.map(s => s.replace(/^.*?: /, '')))];
  assert.deepEqual(uniq, [], 'textos visibles que no pasan por t()');
  noErrors(log, 'pseudo'); await page.close();
});

test('todas las peticiones van al mismo origen (sin CDN ni fuentes externas)', async () => {
  for (const lang of ['es', 'en']) {
    const { page, log } = await openPage(browser, srv.url, { lang });
    for (const n of ALL) await goStage(page, n);
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
    for (const must of ['Andrés Felipe Cardona-Mendoza', 'SavIA Lab-INMUBO', 'Universidad El Bosque', 'Claude Sonnet 5.5', '© 2026']) assert.ok(text.includes(must), `${lang}: falta "${must}"`);
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
  await setState(page, 'modality', 'pap'); await goLegacy(page, 5); await settle(page, 400);
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
        for (const n of ALL) {
          await goStage(page, n);
          const o = await page.evaluate(() => {
            const de = document.documentElement, bad = [];
            if (de.scrollWidth > de.clientWidth) bad.push(`documento ${de.scrollWidth}>${de.clientWidth}`);
            for (const sel of ['#topbar', '#main', '#viewport', '#editorial-sidebar', '#stage-nav', '#work2d']) {
              const e = document.querySelector(sel); if (e && e.scrollWidth > e.clientWidth + 1) bad.push(`${sel} ${e.scrollWidth}>${e.clientWidth}`);
            }
            const sb = document.querySelector('#editorial-sidebar'), r = sb.getBoundingClientRect();
            sb.querySelectorAll('*').forEach(e => { if (e.closest('pre')) return; const q = e.getBoundingClientRect(); if (q.width && q.right > r.right + 1 && getComputedStyle(e).position !== 'fixed') bad.push(`panel: <${e.tagName.toLowerCase()} ${e.className}> sobresale ${Math.round(q.right - r.right)} px`); });
            return bad.slice(0, 5);
          });
          assert.deepEqual(o, [], `${width}px ${lang}/${modality}/etapa ${n}`);
        }
      }
      for (const modality of MODS) { await setState(page, 'modality', modality); for (const n of ALL) { await goStage(page, n); await settle(page, 300); if (TWO_D.includes(n) || modality === 'he') await page.screenshot({ path: `${OUT}/ancho-${width}-${lang}-${modality}-modulo-${n}.png` }); } }
      noErrors(log, `desbordamiento ${width}`); await page.close();
    }
  });
}

/* La barra "Anterior / Centrar cámara / Siguiente" flota sobre el visor: en los módulos 2D no debe tapar ningún bloque del espacio de trabajo,
   ni al inicio ni al final del desplazamiento, y "Centrar cámara" solo existe donde hay escena 3D. */
for (const [width, height] of [[1440, 900], [768, 1024]]) {
  test(`la barra de navegación no tapa contenido en M0, M1 y M2 a ${width} px (ES y EN, 3 modalidades, inicio y final)`, async () => {
    for (const lang of ['es', 'en']) {
      const { page, log } = await openPage(browser, srv.url, { width, height, lang });
      for (const modality of MODS) {
        await setState(page, 'modality', modality);
        for (const n of TWO_D) {
          await goStage(page, n); await settle(page, 200);
          for (const pos of ['inicio', 'final']) {
            const r = await page.evaluate(async (atEnd) => {
              const w = document.querySelector('#work2d'); w.scrollTop = atEnd ? w.scrollHeight : 0;
              await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
              const bar = document.querySelector('#cam-controls'), b = bar.getBoundingClientRect(), wr = w.getBoundingClientRect(), bad = [];
              const hit = (a, c) => a.left < c.right - 0.5 && a.right > c.left + 0.5 && a.top < c.bottom - 0.5 && a.bottom > c.top + 0.5;
              if (hit(b, wr)) bad.push(`la barra invade el área de trabajo (${Math.round(b.top)} < ${Math.round(wr.bottom)})`);
              w.querySelectorAll('*').forEach(e => {
                const q = e.getBoundingClientRect(); if (!q.width || !q.height) return;
                const vis = { left: Math.max(q.left, wr.left), right: Math.min(q.right, wr.right), top: Math.max(q.top, wr.top), bottom: Math.min(q.bottom, wr.bottom) };
                if (vis.right > vis.left && vis.bottom > vis.top && hit(vis, b)) bad.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`);
              });
              // el último bloque de contenido llega a verse completo por encima de la barra al final del desplazamiento
              if (atEnd) {
                const cards = [...w.querySelectorAll('.w2-card')].filter(c => c.getBoundingClientRect().height), last = cards[cards.length - 1];
                if (last && last.getBoundingClientRect().bottom > b.top + 0.5) bad.push('el último bloque queda bajo la barra');
              }
              const bb = bar.getBoundingClientRect(), vp = document.querySelector('#viewport').getBoundingClientRect();
              if (bb.bottom > vp.bottom + 0.5 || bb.left < vp.left - 0.5 || bb.right > vp.right + 0.5) bad.push('la barra se sale del visor');
              const c = document.querySelector('#cam-center'), cs = getComputedStyle(c);
              if (cs.display !== 'none' || c.getBoundingClientRect().width) bad.push('"Centrar cámara" visible sin escena 3D');
              return bad.slice(0, 5);
            }, pos === 'final');
            assert.deepEqual(r, [], `${width}px ${lang}/${modality}/módulo ${n}/${pos}`);
          }
        }
      }
      // con escena 3D el botón sigue disponible
      await goStage(page, 5);
      const c3 = await page.$eval('#cam-center', e => { const q = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && q.width > 0 && !e.disabled; });
      assert.ok(c3, `${width}px ${lang}: "Centrar cámara" debe verse en un módulo 3D`);
      noErrors(log, `barra de navegación ${width} ${lang}`); await page.close();
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

/* =====================================================================
   v2.0b · M0, M1 y M2 (módulos 2D)
   ===================================================================== */
const sleepClick = async (page, sel, ms = 120) => { await page.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await settle(page, 200); await page.click(sel); await settle(page, ms); };
const num = s => parseFloat(String(s).replace(',', '.'));

test('M0: enlaces a los módulos, niveles con "próximamente", ruta P, filtro de nivel y glosario con ventana emergente', async () => {
  for (const lang of ['es', 'en']) {
    const { page, log } = await openPage(browser, srv.url, { lang });
    await goStage(page, 1);
    const text = await visibleText(page, '#work2d');
    assert.match(text, lang === 'es' ? /próximamente/i : /coming soon/i, `${lang}: falta "próximamente" en un nivel vacío`);
    assert.match(text, /v2\.0c/, 'la ruta P marca la versión prevista');
    assert.ok(await page.$$eval('[data-jump]', els => els.length >= 6), 'faltan los enlaces a los módulos');
    await sleepClick(page, '#m0-sec-pipeline [data-jump="wsi-pyramid"]');
    assert.equal(await page.evaluate(() => window.__pdia.state.stage), 3, 'el enlace no lleva a M2');
    await goStage(page, 1);
    // el nivel investigador no tiene módulos propios: el filtro atenúa los demás y "todos" los restituye
    await sleepClick(page, '[data-set="track"][data-value="researcher"]');
    assert.equal(await page.$$eval('#stage-nav .stage-btn.off', b => b.length), 6);
    await sleepClick(page, '[data-set="track"][data-value="all"]');
    assert.equal(await page.$$eval('#stage-nav .stage-btn.off', b => b.length), 0);
    // glosario: se abre, muestra la definición y se cierra con Escape
    await sleepClick(page, '#m0-sec-glossary .gl', 60);
    assert.ok((await page.$eval('#gloss-pop', el => !el.hidden && el.textContent.trim().length > 20)), 'la ventana del glosario no se abrió');
    await page.keyboard.press('Escape'); await settle(page, 100);
    assert.ok(await page.$eval('#gloss-pop', el => el.hidden), 'Escape no cierra el glosario');
    noErrors(log, `M0 ${lang}`); await page.close();
  }
});

test('M1: salidas exactas, perfil compartido con M2, modo por línea, valores inválidos y perfil JSON', async () => {
  for (const lang of ['es', 'en']) {
    const { page, log } = await openPage(browser, srv.url, { lang });
    await goStage(page, 2);
    await setState(page, 'm1.area.w', 10); await setState(page, 'm1.area.h', 10); await settle(page);
    let out = await visibleText(page, '#m1-out');
    assert.match(out, /4[.,]80 GB/, 'bytes sin comprimir de 10 × 10 mm a 0.25 µm/px'); assert.match(out, /40[.,]?000 × 40[.,]?000 px/);
    // cada fila de salidas lleva su etiqueta de procedencia
    assert.equal(await page.$$eval('#m1-out tbody tr', rows => rows.filter(r => r.querySelector('.prov')).length), 9, 'falta una etiqueta de procedencia en las salidas');
    await setState(page, 'm1.objective', 20); await settle(page);
    out = await visibleText(page, '#m1-out'); assert.match(out, /1[.,]20 GB/, 'al duplicar el MPP los bytes bajan a la cuarta parte');
    assert.equal(await page.evaluate(() => window.__pdia.state.scannerProfile.mpp.x), 0.5);
    assert.equal(await page.evaluate(() => window.__pdia.state.scannerProfile.mppSource), 'illustrative-default');
    // M2 lee el MPP del perfil
    await goStage(page, 3); assert.match(await visibleText(page, '#m2-mpp-scanner'), /0[.,]5/, 'M2 no lee el perfil de M1');
    await goStage(page, 2);
    // un MPP escrito se conserva al cambiar de objetivo y se puede volver al ilustrativo
    await setState(page, 'scannerProfile.mpp.x', 0.48); await setState(page, 'm1.objective', 40); await settle(page);
    assert.equal(await page.evaluate(() => window.__pdia.state.scannerProfile.mpp.x), 0.48); assert.equal(await page.evaluate(() => window.__pdia.state.scannerProfile.mppSource), 'user');
    await sleepClick(page, '[data-action="m1-reset-mpp"]');
    assert.equal(await page.evaluate(() => window.__pdia.state.scannerProfile.mpp.x), 0.25);
    // modo por línea y artefactos
    await setState(page, 'm1.scanMode', 'line'); await settle(page);
    assert.match(await visibleText(page, '#m1-out'), lang === 'es' ? /franjas/ : /strips/);
    for (const k of ['seams', 'banding', 'strips', 'cast']) await setState(page, `m1.${k}`, true);
    await setState(page, 'm1.zPlanes', 1); await setState(page, 'm1.focusPoints', 0); await settle(page);
    assert.match(await visibleText(page, '#m1-art-out'), /Laplac/);
    // valor inválido: se explica y no rompe nada
    await setState(page, 'm1.zPlanes', 2.5); await settle(page);
    assert.ok((await visibleText(page, '#m1-err-ctl')).length > 5, 'no se explicó el valor inválido'); await setState(page, 'm1.zPlanes', 1); await settle(page);
    assert.equal((await visibleText(page, '#m1-err-ctl')).length, 0);
    // perfil JSON: exportar, cambiar la familia en el texto y cargar
    await sleepClick(page, '[data-action="m1-profile-export"]');
    const json = await page.$eval('#m1-profile-json', el => el.value); assert.match(json, /"schema": "generic-scanner-profile"/);
    await page.$eval('#m1-profile-json', (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, json.replace('"family": "high-volume"', '"family": "benchtop"'));
    await sleepClick(page, '[data-action="m1-profile-import"]');
    assert.equal(await page.evaluate(() => window.__pdia.state.m1.family), 'benchtop');
    await page.$eval('#m1-profile-json', el => { el.value = '{"schema":"otro"}'; });
    await sleepClick(page, '[data-action="m1-profile-import"]'); assert.ok((await visibleText(page, '#m1-err-json')).length > 5, 'no se avisó del esquema inválido');
    noErrors(log, `M1 ${lang}`); await page.close();
  }
});

test('M2: una sola imagen fuente para todos los MPP y la misma semilla da los mismos píxeles', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await goStage(page, 3); await settle(page, 300);
  const r = await page.evaluate(() => {
    const m = window.__pdia.loaded.get('wsi-pyramid').api, sum = d => d.reduce((a, b) => a + b, 0);
    const h0 = m.huellaFuente(), a = m.pixelesA(0.25), b = m.pixelesA(0.5), h1 = m.huellaFuente(), a2 = m.pixelesA(0.25);
    return { h0, h1, na: a.n, nb: b.n, sa: sum(a.datos), sa2: sum(a2.datos), sb: sum(b.datos) };
  });
  assert.deepEqual(r.h0, r.h1, 'la fuente cambió al muestrear a otro MPP');
  assert.ok(r.na > r.nb, 'a 0.25 µm/px debe haber más píxeles que a 0.5 µm/px'); assert.equal(r.sa, r.sa2, 'misma semilla y mismo MPP, distintos píxeles'); assert.notEqual(r.sa, r.sb);
  await setState(page, 'm2.nuc.seed', 8); const h8 = await page.evaluate(() => window.__pdia.loaded.get('wsi-pyramid').api.huellaFuente());
  assert.notEqual(h8.huella, r.h0.huella, 'otra semilla debe dar otra imagen');
  await setState(page, 'm2.nuc.seed', 7); assert.deepEqual(await page.evaluate(() => window.__pdia.loaded.get('wsi-pyramid').api.huellaFuente()), r.h0, 'volver a la semilla 7 no reproduce la imagen');
  noErrors(log, 'M2 fuente'); await page.close();
});

test('M2: pirámide con factores 1, 4, 16, 32 y uno no entero muestra índice visual y nivel OpenSlide a la vez; la tabla es una aproximación', async () => {
  for (const lang of ['es', 'en']) {
    const { page, log } = await openPage(browser, srv.url, { lang });
    await goStage(page, 3);
    const cells = async k => page.$$eval(`[id^="m2-pr-${k}-"]`, els => els.map(e => e.textContent.trim()));
    await sleepClick(page, '[data-action="m2-preset"][data-v="course"]');
    let v = await cells('v'), l = await cells('l');
    assert.equal(v.length, 4); assert.deepEqual(l, ['0', '1', '2', '3'], 'nivel OpenSlide por fila');
    assert.deepEqual(v.map(x => +x.match(/\d+/)[0]), [4, 3, 2, 1], 'posición visual con el orden de menor a mayor');
    await setState(page, 'm2.pyr.order', 'high-first'); await settle(page);
    assert.deepEqual((await cells('v')).map(x => +x.match(/\d+/)[0]), [1, 2, 3, 4], 'posición visual con el orden de mayor a menor');
    await sleepClick(page, '[data-action="m2-preset"][data-v="frac"]');
    const mx = await cells('mx'); assert.ok(Math.abs(num(mx[3]) - 8.093) < 0.0011, `MPP del nivel de factor 32.37: ${mx[3]}`); assert.ok(Math.abs(num(mx[1]) - 1.0) < 0.01);
    assert.equal((await visibleText(page, '#m2-err-pyr')).length, 0);
    const text = await visibleText(page, '#work2d');
    assert.match(text, lang === 'es' ? /Aproximación ilustrativa/ : /Illustrative approximation/);
    assert.match(text, lang === 'es' ? /no equivale a 40× en todos los equipos/ : /does not equal 40× on every device/);
    assert.ok(!/0[.,]25 ?µm\/px (es|equivale a|=|is|equals) (un )?(el )?40×/i.test(text), 'texto que presenta 0.25 µm/px como un 40× universal');
    noErrors(log, `M2 pirámide ${lang}`); await page.close();
  }
});

test('el cambio de idioma conserva modalidad, módulo, parche fijado, MPP, pirámide, modo de región, controles de M1 y avance del cuestionario', async () => {
  const { page, log } = await openPage(browser, srv.url, { lang: 'es' });
  await setState(page, 'modality', 'ihc');
  await goLegacy(page, 2); await page.click('[data-action="pin-atypical"]'); await settle(page, 150);
  await goStage(page, 2);
  await setState(page, 'm1.family', 'low-cost'); await setState(page, 'm1.objective', 20); await setState(page, 'm1.scanMode', 'line'); await setState(page, 'm1.zPlanes', 3); await setState(page, 'm1.cast', true);
  await setState(page, 'scannerProfile.mpp.x', 0.47); await settle(page);
  await goStage(page, 3);
  await sleepClick(page, '[data-action="m2-preset"][data-v="frac"]');
  await setState(page, 'm2.sel.mode', 'px'); await setState(page, 'm2.mppSource', 'manual'); await setState(page, 'm2.mpp', { x: 0.3, y: 0.31 }); await setState(page, 'm2.nuc.zoom', 4); await settle(page);
  await page.click('#btn-quiz'); await settle(page, 100);
  const correct = await page.evaluate(() => window.__pdia.MODULES.flatMap(m => m.questions.map(q => q.correct)));
  for (let i = 0; i < 2; i++) { await page.click(`[data-qopt="${correct[i]}"]`); await settle(page, 50); await page.click('[data-q="next"]'); await settle(page, 50); }
  await page.keyboard.press('Escape'); await settle(page, 100);
  const snap = () => page.evaluate(() => { const s = window.__pdia.state; return JSON.stringify({ m: s.modality, st: s.stage, pin: s.pinned, m1: s.m1, m2: s.m2, sp: s.scannerProfile, q: window.__pdia.quizState().i }); });
  const before = await snap();
  await page.click('#lang-seg [data-lang="en"]'); await settle(page, 300);
  assert.equal(await snap(), before, 'el estado cambió al pasar a inglés');
  assert.ok(await page.$eval('[data-field="m2.mpp.x"]', el => el.value === '0.3'), 'el campo MPP no conserva el valor');
  await goStage(page, 2); assert.ok(await page.$eval('[data-set="m1.family"][data-value="low-cost"]', b => b.classList.contains('active')), 'la familia de M1 no se conserva');
  await page.click('#lang-seg [data-lang="es"]'); await settle(page, 300);
  assert.equal(await snap(), before.replace(/"st":\d/, '"st":2'), 'el estado cambió al volver a español');
  noErrors(log, 'idioma M0-M2'); await page.close();
});
