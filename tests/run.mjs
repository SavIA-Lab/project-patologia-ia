/* `npm test`: pruebas unitarias → compilación → pruebas de navegador. Se detiene en el primer fallo. */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (label, cmd, args) => {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error(`\n✖ Falló: ${label}`); process.exit(r.status || 1); }
};
run('Pruebas unitarias', process.execPath, ['--test', 'tests/unit/i18n.test.mjs', 'tests/unit/vocabulary.test.mjs', 'tests/unit/engine.test.mjs']);
run('Compilación (npm run build)', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);
run('Pruebas de navegador', process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=900000', 'tests/browser.test.mjs']);
console.log('\n✔ Todas las pruebas pasaron');
