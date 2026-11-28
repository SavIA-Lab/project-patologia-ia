/* Sistema de idiomas ES/EN.
 * - Todo texto visible sale de es.json / en.json (mismas claves en ambos).
 * - Idioma inicial: ?lang= de la URL → idioma guardado (localStorage) → idioma del navegador
 *   (español → ES; cualquier otro → EN).
 * - Los números se dan formato con Intl según el idioma.
 * - Modo "pseudo" (solo para pruebas): t() devuelve ⟦clave⟧; permite detectar texto fijo en la interfaz. */
import es from './es.json' with { type: 'json' };
import en from './en.json' with { type: 'json' };

export const SUPPORTED = ['es', 'en'];
export const STORAGE_KEY = 'pdia.lang';
// Variantes de Intl: español neutro latinoamericano (decimal con punto, como en la v3.0) e inglés de EE. UU.
const INTL_LOCALE = { es: 'es-419', en: 'en-US', pseudo: 'en-US' };

/** Aplana un objeto anidado a { 'a.b.c': valor }. Los arreglos usan el índice como segmento. */
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const DICTS = { es: flatten(es), en: flatten(en) };
let lang = 'es';
const listeners = new Set();
export const missingKeys = new Set();

export function getLang() { return lang; }
export function getLocale() { return INTL_LOCALE[lang]; }

/** Texto traducido. `params` sustituye {nombre}. */
export function t(key, params) {
  if (lang === 'pseudo') return `⟦${key}⟧`;
  let s = DICTS[lang][key];
  if (s === undefined) { missingKeys.add(key); return `⟦FALTA:${key}⟧`; }
  if (params) s = s.replace(/\{(\w+)\}/g, (m, n) => (params[n] !== undefined ? String(params[n]) : m));
  return s;
}
export const has = key => DICTS.es[key] !== undefined && DICTS.en[key] !== undefined;

/* ---------- Formato numérico con Intl ---------- */
const nfCache = new Map();
function nf(digits, grouping) {
  const k = `${lang}|${digits}|${grouping}`;
  if (!nfCache.has(k)) nfCache.set(k, new Intl.NumberFormat(INTL_LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: grouping }));
  return nfCache.get(k);
}
const autoCache = {};
function autoNf() { if (!autoCache[lang]) autoCache[lang] = new Intl.NumberFormat(INTL_LOCALE[lang], { maximumFractionDigits: 6, useGrouping: false }); return autoCache[lang]; }
export const fmt = {
  /** Número con `digits` decimales fijos; sin separador de miles salvo que se pida. */
  num: (v, digits = 0, grouping = false) => nf(digits, grouping).format(v),
  /** Fracción 0–1 como porcentaje, sin espacio antes del signo (como en la v3.0). */
  pct: (v, digits = 0) => nf(digits, false).format(v * 100) + '%',
  int: v => nf(0, true).format(v),
  /** Número tal como viene (sin decimales de relleno): 2 → "2", 0.5 → "0.5" */
  auto: v => autoNf().format(v)
};

/* ---------- Idioma inicial y cambio en caliente ---------- */
function normalize(code) {
  if (!code) return null;
  const c = String(code).toLowerCase();
  if (c === 'es' || c.startsWith('es-') || c.startsWith('es_')) return 'es';
  if (c === 'en' || c.startsWith('en-') || c.startsWith('en_')) return 'en';
  return null;
}
/** Orden: ?lang= → guardado → navegador. Recibe las fuentes para poder probarse sin DOM. */
export function pickInitialLang({ search = '', stored = null, navigatorLanguages = [] } = {}) {
  let fromUrl = null;
  try { fromUrl = normalize(new URLSearchParams(search).get('lang')); } catch (e) { fromUrl = null; }
  if (fromUrl) return fromUrl;
  const fromStore = normalize(stored);
  if (fromStore) return fromStore;
  const first = (navigatorLanguages || []).find(Boolean);
  return first && String(first).toLowerCase().startsWith('es') ? 'es' : 'en';
}
export function readStored() { try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } }
function writeStored(l) { try { window.localStorage.setItem(STORAGE_KEY, l); } catch (e) { /* almacenamiento no disponible */ } }

export function initLang() {
  const l = pickInitialLang({ search: window.location.search, stored: readStored(), navigatorLanguages: navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language] });
  applyLang(l, false);
  return l;
}
function applyLang(l, persist) {
  lang = l;
  document.documentElement.lang = l === 'pseudo' ? 'en' : l;
  if (persist && l !== 'pseudo') writeStored(l);
}
/** Cambia de idioma y avisa a quienes dependen del texto. No toca el estado del curso. */
export function setLang(l, { persist = true } = {}) {
  if (l !== 'pseudo' && !SUPPORTED.includes(l)) return false;
  if (l === lang) return false;
  applyLang(l, persist);
  listeners.forEach(fn => fn(l));
  return true;
}
export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
