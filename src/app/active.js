/* Módulos cargados y módulo activo. La carga es diferida: una instancia solo existe después de la primera visita. */
import { state } from '../engine/state.js';
import { MODULES } from '../modules/registry.js';

export const loaded = new Map();
export const activeMeta = () => MODULES[state.stage - 1];
export const active = () => loaded.get(activeMeta().id) || null;
export const isStage = id => MODULES[state.stage - 1] && MODULES[state.stage - 1].id === id;
/** Llama al enlace `name` de todos los módulos cargados (aunque no sean el activo, como en la v3.0) */
export function callHooks(name, ...args) { loaded.forEach(m => { if (m.hooks && m.hooks[name]) m.hooks[name](...args); }); }
