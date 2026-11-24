process.argv[4] = 'tour';
const { page, browser, errors, OUT } = await import('./run.mjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const shot = async n => { await wait(1600); await page.screenshot({ path: `${OUT}/${n}.png` }); };
// presets
const T = {
  s1pap: async()=>{ await ev(()=>{__pdia.setState('modality','pap'); __pdia.setStage(1);}); await shot('s1_pap'); },
  s2he: async()=>{ await ev(()=>{__pdia.setState('modality','he'); __pdia.setStage(2); for(const k of ['blur','folds','ink','bubbles']) __pdia.setState('artifacts.'+k,true); __pdia.setState('explode',0.0);}); await shot('s2_he_qcon'); 
     await ev(()=>{__pdia.setState('qcOn',false); __pdia.setState('explode',0.7);}); await shot('s2_he_qcoff_explode'); 
     await ev(()=>{ document.querySelector('[data-action=pin-atypical]').click(); __pdia.setState('explode',0);}); await shot('s2_he_pinned'); },
  s3: async()=>{ await ev(()=>{__pdia.setStage(3); __pdia.setState('encoderTrained',true); __pdia.setState('normMode','none');}); await shot('s3_trained_none');
     await ev(()=>{__pdia.setState('normMode','ssl');}); await wait(1500); await shot('s3_ssl'); 
     await ev(()=>{__pdia.setState('umapColor','hospital'); __pdia.setState('normMode','none');}); await wait(1500); await shot('s3_hosp_none'); },
  s4: async()=>{ await ev(()=>{__pdia.setState('modality','pap'); __pdia.setStage(4);}); await shot('s4_pap_att');
     await ev(()=>{__pdia.setState('aggregator','mean');}); await shot('s4_pap_mean'); },
  s5: async()=>{ await ev(()=>{__pdia.setStage(5);}); await shot('s5_pap'); 
     await ev(()=>{__pdia.setState('modality','he'); document.querySelector('[data-action=challenge-start]').click();}); await shot('s5_challenge'); },
};
for (const s of (process.argv[5]||'s1pap,s2he,s3,s4,s5').split(',')) { if (T[s]) await T[s](); }
console.log(errors.join('\n') || 'no console errors');
await browser.close();
