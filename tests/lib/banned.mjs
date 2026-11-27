/* Vocabulario prohibido en los textos del curso y de la documentación (guía de estilo del proyecto).
 * Se buscan palabras completas, sin distinguir mayúsculas ni tildes. */
export const BANNED_EN = [
  'delve', 'harness', 'unlock', 'leverage', 'supercharge', 'empower', 'elevate', 'streamline', 'foster', 'optimize', 'align', 'unleash', 'redefine',
  'reimagine', 'synergize', 'democratize', 'enhance', 'showcase', 'highlight', 'emphasize', 'captivate',
  'cutting-edge', 'game-changer', 'transformative', 'groundbreaking', 'breakthrough', 'trailblazing', 'disruptive', 'unprecedented', 'paradigm-shifting', 'visionary',
  'tapestry', 'realm', 'paradigm', 'holistic', 'intricate', 'pivotal', 'seamless', 'nuanced', 'interplay', 'testament', 'meticulous', 'vibrant', 'underscore', 'showcasing',
  'scalable', 'robust', 'frictionless', 'future-proof', 'mission-critical', 'data-driven', 'proactive', 'dynamic', 'immersive', 'adaptive', 'effortless', 'versatile',
  'crucial', 'valuable', 'innovative', 'synergy'
];
export const BANNED_EN_PHRASES = ['serves as', 'stands as', 'represents a', 'features a', 'aims to', 'seeks to'];
/* Equivalentes en español (raíz o forma completa; se admiten flexiones) */
export const BANNED_ES = [
  'robusto', 'robusta', 'robustos', 'robustas', 'crucial', 'cruciales', 'dinámico', 'dinámica', 'dinámicos', 'dinámicas', 'optimizar', 'optimiza', 'optimizado', 'optimización',
  'destacar', 'destaca', 'destacan', 'potenciar', 'potencia', 'holístico', 'holística', 'innovador', 'innovadora', 'innovadores', 'innovadoras', 'alinear', 'alinea', 'alineado', 'alineación',
  'revolucionario', 'revolucionaria', 'vanguardia', 'pivotal', 'matizado', 'inmersivo', 'inmersiva', 'escalable', 'escalables', 'proactivo', 'proactiva',
  'valioso', 'valiosa', 'sinergia', 'sin fisuras', 'democratizar', 'empoderar', 'fomentar', 'aprovechar', 'desbloquear', 'impulsar'
];

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Devuelve las coincidencias de `text` con las listas (EN y ES) */
export function findBanned(text) {
  const n = norm(text), out = [];
  for (const w of [...BANNED_EN, ...BANNED_EN_PHRASES, ...BANNED_ES]) {
    // flexiones simples del inglés (-s, -es, -ed, -ing, -d) para los verbos de la lista
    const base = esc(norm(w));
    const re = new RegExp(`(?<![\\p{L}-])${base}(?:s|es|d|ed|ing)?(?![\\p{L}-])`, 'u');
    if (re.test(n)) out.push(w);
  }
  return out;
}
