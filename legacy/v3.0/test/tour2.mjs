process.argv[4] = 'tour';
const { page, browser, errors, OUT } = await import('./run.mjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const shot = async n => { await wait(1700); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const side = async n => { // captura completa del panel lateral
  await page.setViewport({ width: 1440, height: 3600 }); await wait(500);
  const el = await page.$('#editorial-sidebar'); await el.screenshot({ path: `${OUT}/${n}.png` });
  await page.setViewport({ width: 1440, height: 900 }); await wait(500);
};
const which = (process.argv[5]||'a').split(',');
if (which.includes('a')) {
  for (const st of [1,2,3,4,5]) { await ev(s=>__pdia.setStage(s), st); await wait(400); await side('side'+st); }
}
if (which.includes('b')) {
  await ev(()=>{__pdia.setState('modality','ihc'); __pdia.setStage(1);}); await shot('s1_ihc');
  // Stage 3 contaminacion
  await ev(()=>{__pdia.setState('modality','he'); __pdia.setStage(2); for(const k of ['folds','ink','bubbles','blur']) __pdia.setState('artifacts.'+k,true); __pdia.setState('qcOn',false); document.querySelector('[data-action=pin-artifact]').click(); __pdia.setStage(3); __pdia.setState('encoderTrained',true); __pdia.setState('normMode','ssl');});
  await wait(2500); await shot('s3_contam_pinned');
  await ev(()=>{__pdia.setStage(4); __pdia.setState('groundTruth','neg'); __pdia.setState('aggregator','max');}); await shot('s4_neg_max_dist');
  await ev(()=>{__pdia.setStage(5);}); await shot('s5_pinned_artifact');
}
if (which.includes('c')) {
  await ev(()=>{__pdia.setState('modality','pap'); __pdia.setStage(5); document.querySelector('[data-action=challenge-start]').click();});
  await wait(800);
  // clic sobre la lámina en 2 puntos (foco primario aprox y lejos)
  const pts = await ev(()=>{ const w=__pdia.world; const THREE_V = w.s5.slide.tissue.getWorldPosition.bind(w.s5.slide.tissue); return true;});
  const box = await (await page.$('#gl-host canvas')).boundingBox();
  await page.mouse.click(box.x+box.width*0.52, box.y+box.height*0.55); await wait(300);
  await page.mouse.click(box.x+box.width*0.3, box.y+box.height*0.5); await wait(300);
  await page.click('[data-action=challenge-reveal]'); await shot('s5_reveal');
  await ev(()=>{ document.querySelector('[data-action=top3][data-i="0"]').click(); __pdia.setState('heatScale','viridis'); }); await shot('s5_top3_viridis');
  await ev(()=>{__pdia.setState('tau',0.25);}); 
  await side('side5_after');
}
if (which.includes('q')) {
  await page.click('#btn-quiz'); await wait(300);
  for (let i=0;i<8;i++){ await page.click('[data-qopt="1"]'); await wait(100); if(i===0) await page.screenshot({path:OUT+'/quiz1.png'}); await page.click('[data-q=next]'); await wait(100); }
  await page.screenshot({path:OUT+'/quiz_end.png'});
}
console.log(errors.join('\n') || 'no console errors');
await browser.close();
