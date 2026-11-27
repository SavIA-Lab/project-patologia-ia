/* Etapa 2 · módulo "QC y teselado". Se carga bajo demanda (ver src/modules/registry.js). */
import { getStageGroup } from '../../engine/scene.js';
import { state, pipeline } from '../../engine/state.js';
import { tileTypeLabel, qcLabel, artifactShort } from '../../engine/bio.js';
import { pinPatchAtTile } from '../../app/pin.js';
import { ttRow, ttHint } from '../../ui/tooltip.js';
import { lgRow } from '../../ui/legend.js';
import { t, fmt } from '../../i18n/index.js';
import meta from './meta.js';
import { buildStage2, rebuildTiles, applyTileStates, animateStage2 } from './scene.js';
import { panelHTML, panelLive } from './panel.js';

export default {
  create() {
    const group = getStageGroup(meta.id), s2 = buildStage2(group);
    applyTileStates(s2);
    return {
      id: meta.id, group, scene: s2, hoverEveryFrame: true,
      panel: { html: panelHTML, live: panelLive },
      legend: () => `<h4>${t('s2.legend.title')}</h4>${lgRow('#FFFFFF', t('s2.legend.ok'), true)}${lgRow('#F2B8C2', t('s2.legend.rejected'), true)}${lgRow('#D97706', t('s2.legend.unfiltered'), true)}${lgRow('#E2E8F0', t('s2.legend.bg'), true)}`,
      hooks: {
        tiles: () => applyTileStates(s2),
        tilesVisual: () => applyTileStates(s2),
        rebuildTiles: () => rebuildTiles(s2, group)
      },
      animate: (dt, tm) => animateStage2(s2, dt, tm),
      leave() { s2.hoverIndex = -1; },
      hover(rc) {
        const h = rc.intersectObjects(s2.tiles, false)[0];
        s2.hoverIndex = h ? h.object.userData.tileIndex : -1;
        if (!h) return null;
        const i = pipeline.tiles.infos[h.object.userData.tileIndex];
        if (!i) return null;
        return { tip: `<div class="tt-t">${t('s2.tip.tile', { col: i.col, row: i.row, type: tileTypeLabel(i.tileType) })}</div>${ttRow(t('tip.coverage'), fmt.num(i.cov * 100, 0) + '%')}${ttRow(t('tip.lap'), fmt.num(i.lap, 1))}${ttRow(t('tip.atypia'), fmt.num(i.atypia, 2))}${ttRow(t('tip.qcStatus'), qcLabel(i.qcStatus))}${i.artifactKeys.length ? ttRow(t('tip.artifact'), i.artifactKeys.map(artifactShort).join(', ')) : ''}${ttHint(t('s2.tip.pin'))}`, cursor: 'pointer' };
      },
      click(rc) {
        const h = rc.intersectObjects(s2.tiles, false)[0];
        if (h) pinPatchAtTile(h.object.userData.col, h.object.userData.row);
      },
      trace(p) {
        return { st: t('s2.trace.state', { qc: qcLabel(p.qcStatus), lap: fmt.num(p.laplacian, 0) }), cls: p.qcStatus === 'rejected' ? 'bad' : (p.qcStatus === 'unfiltered' ? 'warn' : '') };
      }
    };
  }
};
