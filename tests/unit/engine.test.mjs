import test from 'node:test';
import assert from 'node:assert/strict';
import { erf, Phi, rocAt, aucAnalytic, tauToX, COHORT } from '../../src/modules/xai-threshold/roc.js';
import { SeededRandom, hashStr } from '../../src/engine/util.js';
import { state, pipeline, dirty } from '../../src/engine/state.js';
import { computeTileInfos, rebuildUmapData, computeBag, computeMIL } from '../../src/engine/pipeline.js';

test('erf y Φ: valores conocidos', () => {
  assert.ok(Math.abs(erf(0)) < 1e-9);
  assert.ok(Math.abs(erf(1) - 0.8427007929) < 2e-7);
  assert.ok(Math.abs(Phi(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(Phi(1.96) - 0.9750021) < 1e-6);
});

test('ROC binormal: AUC ≈ 0.94 y la matriz de confusión suma la cohorte', () => {
  assert.ok(Math.abs(aucAnalytic() - 0.94) < 0.005);
  for (const tau of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    const r = rocAt(tau);
    assert.equal(r.tp + r.fn + r.tn + r.fp, COHORT.n);
    assert.equal(r.tp + r.fn, Math.round(COHORT.n * COHORT.prev));
  }
  // subir τ reduce la sensibilidad y sube la especificidad
  assert.ok(rocAt(0.25).sens > rocAt(0.75).sens && rocAt(0.25).spec < rocAt(0.75).spec);
  assert.ok(tauToX(0.6) > tauToX(0.4));
});

test('el generador con semilla es reproducible', () => {
  const a = new SeededRandom(hashStr('x')), b = new SeededRandom(hashStr('x')), c = new SeededRandom(hashStr('y'));
  const sa = Array.from({ length: 8 }, () => a.next()), sb = Array.from({ length: 8 }, () => b.next()), sc = Array.from({ length: 8 }, () => c.next());
  assert.deepEqual(sa, sb); assert.notDeepEqual(sa, sc);
});

test('el pipeline es determinista: mismo estado → mismos resultados', () => {
  const snap = () => {
    computeTileInfos(); rebuildUmapData(); computeBag(); computeMIL();
    return JSON.stringify({
      tiles: pipeline.tiles.infos.map(i => [i.type, i.qc || i.status || null, Math.round((i.lap || 0) * 1e3)]).slice(0, 80),
      bag: pipeline.bag.slice(0, 40).map(b => Math.round((b.score ?? b.s ?? 0) * 1e6)),
      mil: pipeline.mil && Object.keys(pipeline.mil)
    });
  };
  const a = snap(), b = snap();
  assert.equal(a, b);
  for (const m of ['he', 'pap', 'ihc']) { state.modality = m; assert.equal(snap(), snap(), `modalidad ${m}`); }
  state.modality = 'he'; void dirty;
});
