/* Etapa 3 · módulo "Codificador y cambio de dominio". Se carga bajo demanda (ver src/modules/registry.js). */
import { getStageGroup } from '../../engine/scene.js';
import { state, pipeline } from '../../engine/state.js';
import { MODALITIES, HOSPITALS, CONTAM_COLOR, hospitalName, hospitalScanner, clusterLabel } from '../../engine/modalities.js';
import { artifactLabel } from '../../engine/bio.js';
import { contamActive, contamCount } from '../../engine/pipeline.js';
import { UMAP_N } from '../../engine/constants.js';
import { pinPatchAtUV } from '../../app/pin.js';
import { ttRow, ttHint } from '../../ui/tooltip.js';
import { lgRow } from '../../ui/legend.js';
import { t, fmt } from '../../i18n/index.js';
import meta from './meta.js';
import { buildStage3, applyUmapColors, stepStage3 } from './scene.js';
import { panelHTML, panelLive } from './panel.js';

export default {
  create() {
    const group = getStageGroup(meta.id), s3 = buildStage3(group);
    applyUmapColors(s3);
    return {
      id: meta.id, group, scene: s3, liveInterval: 0.12,
      panel: { html: panelHTML, live: panelLive },
      legend() {
        const M = MODALITIES[state.modality], contam = contamCount() ? lgRow(CONTAM_COLOR.hex, t('s3.legend.contam')) : '';
        return state.umapColor === 'morph'
          ? `<h4>${t('s3.legend.morph')}</h4>${M.clusters.map((c, i) => lgRow(c.hex, clusterLabel(M, i))).join('')}${contam}`
          : `<h4>${t('s3.legend.hospital')}</h4>${HOSPITALS.map(c => lgRow(c.hex, `${hospitalName(c)} (${hospitalScanner(c)})`)).join('')}${contam}`;
      },
      hooks: { umap: () => applyUmapColors(s3) },
      animate: (dt, tm) => stepStage3(s3, dt, tm),
      hover(rc) {
        const h = rc.intersectObject(s3.mesh, false)[0];
        if (!h || h.instanceId === undefined || !contamActive(h.instanceId)) return null;
        const i = h.instanceId, U = pipeline.umap;
        if (i >= UMAP_N) return { tip: `<div class="tt-t">${t('s3.tip.contam', { i })}</div>${ttRow(t('tip.origin'), artifactLabel(U.contam[i - UMAP_N].key))}${ttHint(t('s3.tip.qcOff'), '#FCA5A5')}` };
        const s = U.samples[i], M = MODALITIES[state.modality];
        return { tip: `<div class="tt-t">${t('s3.tip.patch', { i })}</div>${ttRow(t('tip.morphology'), clusterLabel(M, s.cluster))}${ttRow(t('tip.hospital'), hospitalName(HOSPITALS[s.hosp]))}${ttRow('u, v', fmt.num(s.u, 2) + ', ' + fmt.num(s.v, 2))}${ttHint(t('s3.tip.pin'))}`, cursor: 'pointer' };
      },
      click(rc) {
        const h = rc.intersectObject(s3.mesh, false)[0];
        if (h && h.instanceId !== undefined && h.instanceId < UMAP_N && contamActive(h.instanceId)) { const s = pipeline.umap.samples[h.instanceId]; pinPatchAtUV(s.u, s.v); }
      },
      trace(p) {
        const excluded = p.qcStatus === 'rejected', bgx = p.tileType === 'bg';
        if (excluded) return { st: t('s3.trace.excluded'), cls: 'bad' };
        if (bgx) return { st: t('s3.trace.bg'), cls: 'warn' };
        if (p.umapIndex >= UMAP_N) return { st: t('s3.trace.contam', { i: p.umapIndex }), cls: 'bad' };
        if (p.umapIndex >= 0) { const sm = pipeline.umap.samples[p.umapIndex]; return { st: t('s3.trace.point', { i: p.umapIndex, morph: clusterLabel(MODALITIES[state.modality], sm.cluster) }), cls: '' }; }
        return { st: '', cls: '' };
      }
    };
  }
};
