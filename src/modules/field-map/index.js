/* M0 · Mapa del campo y vocabulario. Módulo 2D (sin escena 3D). Se carga bajo demanda (ver src/modules/registry.js). */
import { state } from '../../engine/state.js';
import { t } from '../../i18n/index.js';
import { tr } from '../../ui/glossary.js';
import { lgRow } from '../../ui/legend.js';
import { section } from '../../ui/work2d.js';
import { provLegend } from '../../ui/provenance.js';
import { objectivesHTML, predictionHTML, predictionLive, teacherHTML, referencesHTML } from '../../ui/module-sections.js';
import meta from './meta.js';
import { workHTML, workLive } from './work.js';

const PRED_CORRECT = 1;

const panelHTML = () => `${objectivesHTML(meta)}
  ${predictionHTML('field-map', 'm0.pred')}
  <div class="sec"><h3>${t('m0.sidebar.how')}</h3><p class="w2-sub">${tr('m0.sidebar.howBody')}</p></div>
  ${section('m0-prov-legend', t('common.provLegend'), provLegend())}
  ${teacherHTML('field-map', 4, 3, 3)}
  ${referencesHTML(meta)}`;
const panelLive = () => predictionLive('field-map', state.m0.pred, PRED_CORRECT);

export default {
  create() {
    return {
      id: meta.id, kind: '2d',
      panel: { html: panelHTML, live: panelLive },
      workspace: { html: workHTML, live: workLive },
      legend: () => `${lgRow('#4C3A7A', t('m0.legend.module'), true)}${lgRow('#D97706', t('m0.legend.soon'), true)}`,
      actions: {}
    };
  }
};
