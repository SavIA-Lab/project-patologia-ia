/* Etapa 1 · módulo "WSI y pirámide". Se carga bajo demanda (ver src/modules/registry.js). */
import { getStageGroup } from '../../engine/scene.js';
import { PYR_LEVELS } from '../../engine/constants.js';
import { state } from '../../engine/state.js';
import { setState } from '../../app/controller.js';
import { ttRow, ttHint } from '../../ui/tooltip.js';
import { lgRow } from '../../ui/legend.js';
import { t, fmt } from '../../i18n/index.js';
import meta from './meta.js';
import { buildStage1, rebuildPyramid, refreshPyramidTextures, applyStage1State, animateStage1 } from './scene.js';
import { panelHTML, panelLive } from './panel.js';

export default {
  create() {
    const group = getStageGroup(meta.id), s1 = buildStage1(group);
    return {
      id: meta.id, group, scene: s1,
      panel: { html: panelHTML, live: panelLive },
      legend: () => `<h4>${t('s1.legend.title')}</h4>${lgRow('#4C3A7A', t('s1.legend.planes'), true)}${lgRow('#0F766E', t('s1.legend.roi'), true)}${lgRow('#BE123C', t('s1.legend.focus'), false)}`,
      hooks: {
        stage1State: () => applyStage1State(s1),
        modality: () => rebuildPyramid(s1),
        pyramidTex: () => refreshPyramidTextures(s1)
      },
      animate: (dt, tm) => animateStage1(s1, dt, tm),
      hover(rc) {
        if (!s1.pyr.visible) return null;
        const h = rc.intersectObjects(s1.planes, false)[0];
        if (!h) return null;
        const L = PYR_LEVELS[h.object.userData.level];
        return { tip: `<div class="tt-t">${t('s1.tip.plane', { mag: L.mag })}</div>${ttRow(t('tip.resolution'), fmt.auto(L.res) + ' µm/px')}${ttRow(t('tip.context'), L.context + '%')}${ttRow(t('tip.detail'), L.detail + '%')}${ttHint(t('tip.clickActivate'))}`, cursor: 'pointer' };
      },
      click(rc) {
        if (!s1.pyr.visible) return;
        const h = rc.intersectObjects(s1.planes, false)[0];
        if (h) setState('pyramidLevel', h.object.userData.level);
      }
    };
  }
};
