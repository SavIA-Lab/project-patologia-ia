/* Parche fijado (trazabilidad de extremo a extremo). Migrado de la v3.0 (p5_ui.js §17).
 * Trabaja sobre `pipeline.tiles` y `pipeline.umap`, no sobre objetos 3D, así que el parche sobrevive a la carga diferida de módulos. */
import { state, dirty, pipeline, hooks, markArtifactsChanged } from '../engine/state.js';
import { UMAP_N } from '../engine/constants.js';
import { makeCanvas } from '../engine/util.js';
import { drawCompositeCrop } from '../engine/textures.js';
import { cellIndexUV } from '../engine/pipeline.js';
import { tileTypeLabel, qcLabel } from '../engine/bio.js';
import { toast } from '../ui/dom.js';

export function findUmapIndex(info) {
  if (info.bg || info.rejected) return -1;
  const U = pipeline.umap; if (!U) return -1;
  let best = -1, bd = 1e9;
  if (info.hasArtifact) {
    U.contam.forEach((c, j) => { if (!info.artifactKeys.includes(c.key)) return; const d = (c.u - info.u) ** 2 * 4 + (c.v - info.v) ** 2; if (d < bd) { bd = d; best = UMAP_N + j; } });
    return best;
  }
  U.samples.forEach((s, i) => { const d = (s.u - info.u) ** 2 * 4 + (s.v - info.v) ** 2 + (s.cluster === info.clusterIndex ? 0 : 1); if (d < bd) { bd = d; best = i; } });
  return best;
}
export function makeThumb(info) {
  const c = makeCanvas(96, 96), x = c.getContext('2d'), du = 1 / info.cols, dv = 1 / info.rows;
  drawCompositeCrop(x, info.u - du / 2, info.v - dv / 2, info.u + du / 2, info.v + dv / 2, 96, 96);
  return c.toDataURL('image/png');
}
function fillPinned(p, info) {
  p.col = info.col; p.row = info.row; p.u = info.u; p.v = info.v;
  p.tileType = info.tileType; p.qcStatus = info.qcStatus; p.laplacian = info.lap; p.atypia = info.atypia;
  p.bagIndex = cellIndexUV(info.u, info.v); p.umapIndex = findUmapIndex(info); p.thumbnailDataUrl = makeThumb(info);
}
export function pinPatchAtTile(col, row, silent) {
  const { cols, infos } = pipeline.tiles, info = infos[row * cols + col]; if (!info) return;
  state.pinned = { anchorU: info.u, anchorV: info.v };
  fillPinned(state.pinned, info); dirty.sidebarLive = true; hooks.resetHud();
  if (!silent) toast('pin.toast.pinned', { col, row, type: tileTypeLabel(info.tileType), qc: qcLabel(info.qcStatus) });
}
export function pinPatchAtUV(u, v) {
  const { cols, rows } = pipeline.tiles; pinPatchAtTile(Math.min(cols - 1, Math.floor(u * cols)), Math.min(rows - 1, Math.floor(v * rows)));
}
/** Vuelve a calcular los datos del parche fijado tras un cambio de modalidad, tamaño de parche o artefactos */
export function refreshPinned() {
  const p = state.pinned, { cols, rows, infos } = pipeline.tiles; if (!p || !infos.length) return;
  const col = Math.min(cols - 1, Math.floor(p.anchorU * cols)), row = Math.min(rows - 1, Math.floor(p.anchorV * rows));
  fillPinned(p, infos[row * cols + col]); hooks.resetHud(); dirty.sidebarLive = true;
}
export function unpin() { state.pinned = null; hooks.resetHud(); dirty.sidebarLive = true; }
export function pinQuick(kind) {
  const { infos } = pipeline.tiles; if (!infos.length) return;
  let list = infos.filter(i => !i.bg);
  if (kind === 'artifact') {
    let cand = infos.filter(i => i.hasArtifact);
    if (!cand.length) {
      state.artifacts.folds = true; markArtifactsChanged(); hooks.processDirty(true);
      cand = pipeline.tiles.infos.filter(i => i.hasArtifact); toast('pin.toast.autoFolds');
    }
    cand.sort((a, b) => b.artifactKeys.length - a.artifactKeys.length || b.atypia - a.atypia);
    if (cand.length) { pinPatchAtTile(cand[0].col, cand[0].row, true); toast('pin.toast.artifact', { col: cand[0].col, row: cand[0].row, qc: qcLabel(cand[0].qcStatus) }); }
    return;
  }
  list = list.filter(i => !i.hasArtifact);
  if (kind === 'atypical') list.sort((a, b) => b.atypia - a.atypia);
  else list.sort((a, b) => (b.cov * (1 - b.atypia) * (b.atypia < 0.12 ? 1 : 0.2)) - (a.cov * (1 - a.atypia) * (a.atypia < 0.12 ? 1 : 0.2)));
  if (list.length) pinPatchAtTile(list[0].col, list[0].row);
}
