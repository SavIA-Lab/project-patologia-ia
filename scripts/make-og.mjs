/* Genera public/og.png (1200×630) para Open Graph, con el título en español e inglés. Sin logos de terceros.
 * Uso: node scripts/make-og.mjs */
import { launch, ROOT } from '../tests/lib/harness.mjs';
import { join } from 'node:path';

const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#F8FAFC;font-family:'Inter',system-ui,sans-serif;color:#0F172A;position:relative;overflow:hidden}
.band{position:absolute;left:0;top:0;bottom:0;width:22px;background:linear-gradient(#4C3A7A 0 40%,#C95B82 40% 70%,#0F766E 70%)}
.wrap{position:absolute;left:84px;top:78px;right:84px}
.kicker{font:600 22px 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.08em;color:#0F766E;text-transform:uppercase}
h1{font-size:68px;line-height:1.08;font-weight:700;margin-top:26px;letter-spacing:-.02em}
h2{font-size:40px;line-height:1.15;font-weight:500;color:#475569;margin-top:28px}
.row{position:absolute;left:84px;right:84px;bottom:58px;display:flex;justify-content:space-between;align-items:center;font-size:24px;color:#475569}
.tag{border:2px solid #FDE68A;background:#FFFBEB;color:#92400E;border-radius:99px;padding:6px 20px;font:700 22px 'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em}
.dots{display:flex;gap:10px}.dots i{width:22px;height:22px;border-radius:50%;display:block}
</style><div class="band"></div><div class="wrap"><div class="kicker">PatologIA 3D</div>
<h1>Patología Digital &amp; IA<br>Laboratorio Interactivo 3D</h1><h2>Digital Pathology &amp; AI - Interactive 3D Lab</h2></div>
<div class="row"><div class="dots"><i style="background:#4C3A7A"></i><i style="background:#C95B82"></i><i style="background:#0F766E"></i><i style="background:#D97706"></i><i style="background:#BE123C"></i></div>
<div>savia-lab.github.io/project-patologia-ia</div><div class="tag">simulado · simulated</div></div>`;
const b = await launch(), p = await b.newPage();
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await p.setContent(html); await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: join(ROOT, 'public', 'og.png') });
await b.close();
