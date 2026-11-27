/* Tooltip del visor 3D. Migrado de la v3.0 (p5_ui.js §19). */
import { renderer } from '../engine/scene.js';
import { $ } from './dom.js';

export const pointerPx = { x: 0, y: 0 };
export function showTooltip(html) {
  const tt = $('#tooltip'), host = $('#viewport');
  tt.innerHTML = html; tt.style.display = 'block';
  const w = tt.offsetWidth, h = tt.offsetHeight;
  let x = pointerPx.x + 16, y = pointerPx.y + 14;
  if (x + w > host.clientWidth - 6) x = pointerPx.x - w - 14;
  if (y + h > host.clientHeight - 6) y = pointerPx.y - h - 12;
  tt.style.left = Math.max(4, x) + 'px'; tt.style.top = Math.max(4, y) + 'px';
}
export function hideTooltip() { const el = $('#tooltip'); if (el) el.style.display = 'none'; if (renderer) renderer.domElement.style.cursor = 'grab'; }
export const ttRow = (k, v) => `<div class="tt-r"><span>${k}</span><b>${v}</b></div>`;
export const ttHint = (txt, color = '#94A3B8') => `<div style="color:${color};margin-top:3px">${txt}</div>`;
