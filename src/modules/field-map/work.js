/* M0 · espacio de trabajo 2D: mapa del pipeline con enlaces, niveles de ruta, ruta P, qué es simulado y qué es real, glosario.
 * Los niveles salen del campo `track` del registro de módulos; un nivel sin módulos propios dice "próximamente". */
import { state } from '../../engine/state.js';
import { MODULES, TRACK_LEVELS } from '../registry.js';
import { t } from '../../i18n/index.js';
import { tr, g, GLOSSARY } from '../../ui/glossary.js';
import { prov, provLegend } from '../../ui/provenance.js';
import { card, segBtns, ul } from '../../ui/work2d.js';

/** Eslabones del pipeline, en orden. `id` es el módulo al que lleva cada botón. */
const NODES = ['scanner', 'wsi-pyramid', 'qc-tiling', 'encoder-shift', 'mil-attention', 'xai-threshold'];
const meta = id => MODULES.find(m => m.id === id);
const jumpBtn = (id, label) => `<button type="button" class="btn btn-sm" data-jump="${id}">${label}</button>`;

/** Elementos de la ruta P por nivel: [clave, módulo anfitrión, versión, disponible] */
const ROUTE_P = {
  foundations: [['engine', 'wsi-pyramid', 'v2.0b', true], ['res', 'wsi-pyramid', 'v2.0b', true], ['pyr', 'wsi-pyramid', 'v2.0b', true], ['anat', null, 'v2.0c', false]],
  practice: [['calc', null, 'v2.0c', false], ['atlas', null, 'v2.1a', false], ['adapt', null, 'v2.1b', false], ['interp', null, 'v2.1c', false]],
  research: [['dil', null, 'v2.3', false], ['eval', null, 'v2.4', false], ['case', null, 'v2.5', false], ['tools', null, 'v2.5', false]]
};

function pipelineHTML() {
  const nodes = NODES.map((id, i) => {
    const m = meta(id), avail = true, key = `m0.node.${id}`;
    return `<li class="m0-node"><div class="m0-node-h"><span class="num">${m.code}</span><b>${t(`${key}.name`)}</b>${m.provisional ? `<span class="pill">${t('m0.provisional')}</span>` : `<span class="pill ok">${t('m0.available')}</span>`}</div>
      <p class="w2-sub">${tr(`${key}.q`)}</p>
      <dl class="w2-kv"><dt>${t('m0.in')}</dt><dd style="font-family:inherit">${t(`${key}.in`)}</dd><dt>${t('m0.out')}</dt><dd style="font-family:inherit">${t(`${key}.out`)}</dd><dt>${t('m0.fail')}</dt><dd style="font-family:inherit">${t(`${key}.fail`)}</dd></dl>
      ${avail ? jumpBtn(id, t('m0.open', { code: m.code })) : ''}</li>${i < NODES.length - 1 ? '<li class="m0-arrow" aria-hidden="true">→</li>' : ''}`;
  }).join('');
  return card('m0-sec-pipeline', t('m0.pipe.title'), `<p class="w2-sub">${tr('m0.pipe.sub')}</p><ol class="m0-pipe">${nodes}</ol><div class="w2-sub">${prov('sim')} ${t('m0.pipe.prov')}</div>`, '', 'w2-wide');
}

function tracksHTML() {
  const filters = segBtns('track', [['all', t('m0.track.all')], ...TRACK_LEVELS.map(l => [l, t(`m0.track.${l}`)])]);
  const cols = TRACK_LEVELS.map(level => {
    const own = MODULES.filter(m => (m.track || []).includes(level) && m.id !== 'field-map');
    const body = own.length
      ? `<ul class="m0-list">${own.map(m => `<li>${jumpBtn(m.id, `${m.code} · ${t(m.nav)}`)}</li>`).join('')}</ul>`
      : `<p class="w2-sub"><span class="pill warn">${t('m0.soon')}</span> ${t('m0.track.emptyNote')}</p>`;
    return `<div class="m0-col"><h4>${t(`m0.track.${level}`)}</h4><p class="w2-sub">${tr(`m0.track.${level}.desc`)}</p>${body}</div>`;
  }).join('');
  return card('m0-sec-tracks', t('m0.track.title'), `<p class="w2-sub">${t('m0.track.sub')}</p><div class="w2-row"><span class="w2-sub" style="margin:0">${t('m0.track.filter')}</span>${filters}</div><div class="m0-cols">${cols}</div>`, '', 'w2-wide');
}

function routeHTML() {
  const cols = Object.keys(ROUTE_P).map(level => `<div class="m0-col"><h4>${t(`m0.route.${level}`)}</h4><p class="w2-sub">${t(`m0.route.${level}.desc`)}</p>
    <ul class="m0-list">${ROUTE_P[level].map(([k, host, ver, ok]) => `<li><b>${t(`m0.route.item.${k}`)}</b> ${ok ? `<span class="pill ok">${t('m0.available')}</span>` : `<span class="pill warn">${t('m0.soon')} · ${ver}</span>`}${ok && host ? ' ' + jumpBtn(host, t('m0.open', { code: meta(host).code })) : ''}</li>`).join('')}</ul></div>`).join('');
  return card('m0-sec-route', t('m0.route.title'), `<p class="w2-sub">${tr('m0.route.sub')}</p><div class="m0-cols">${cols}</div>`, '', 'w2-wide');
}

function realHTML() {
  const list = pre => ul([0, 1, 2, 3].map(i => tr(`${pre}.${i}`)));
  return card('m0-sec-real', t('m0.real.title'), `<p class="w2-sub">${tr('m0.real.sub')}</p>
    <div class="m0-cols"><div class="m0-col"><h4>${t('m0.real.realH')}</h4>${list('m0.real.real')}</div><div class="m0-col"><h4>${t('m0.real.simH')}</h4>${list('m0.real.sim')}</div></div>
    <div class="w2-warn">${t('m0.real.warn')}</div>
    <h4>${t('m0.real.legend')}</h4>${provLegend()}`, '', 'w2-wide');
}

function glossaryHTML() {
  return card('m0-sec-glossary', t('m0.gloss.title'), `<p class="w2-sub">${t('m0.gloss.sub')}</p><div class="m0-chips">${GLOSSARY.map(k => `<span class="m0-chip">${g(k)}</span>`).join('')}</div>`, '', 'w2-wide');
}

export const workHTML = () => `<div class="w2-grid">${pipelineHTML()}${tracksHTML()}${routeHTML()}${realHTML()}${glossaryHTML()}</div>`;
export function workLive() { void state; }
