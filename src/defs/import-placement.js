import { PENS, applyStyle, signedArea } from "./helpers.js";

export function placeImportedPaths(source, p, ctx, style, visible = () => true) {
  if (!source?.paths?.length || !source.bbox) return { paths: [] };
  const { W, H } = ctx;
  const b = source.bbox;
  const margin = Number(p.margin) || 0;
  const baseScale = p.fit === "Fit to canvas"
    ? Math.min((W - 2 * margin) / b.w, (H - 2 * margin) / b.h)
    : (Number(p.scale) || 100) / 100;
  if (!Number.isFinite(baseScale) || baseScale <= 0) return { paths: [] };
  const bx = p.fit === "Fit to canvas" ? (W - b.w * baseScale) / 2 - b.x * baseScale : margin - b.x * baseScale;
  const by = p.fit === "Fit to canvas" ? (H - b.h * baseScale) / 2 - b.y * baseScale : margin - b.y * baseScale;
  const cx = (b.x + b.w / 2) * baseScale + bx;
  const cy = (b.y + b.h / 2) * baseScale + by;
  const editScale = Math.max(0.01, (Number(p.editScale) || 100) / 100);
  const angle = ((Number(p.rotation) || 0) * Math.PI) / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = Number(p.offx) || 0, dy = Number(p.offy) || 0;
  const paths = source.paths.filter(visible).map((sp) => {
    let pts = sp.pts.map(([x, y]) => {
      const px = ((x * baseScale + bx) - cx) * editScale;
      const py = ((y * baseScale + by) - cy) * editScale;
      return [cx + px * cos - py * sin + dx, cy + px * sin + py * cos + dy];
    });
    if (sp.closed && p.dirs !== "Original") {
      const cw = signedArea(pts) > 0;
      if (cw !== (p.dirs === "Closed clockwise")) pts = [...pts].reverse();
    }
    return { pts, closed: !!sp.closed, layer: p.colmode === "Single pen" ? Math.round(Number(p.layer) || 0) : (sp.colorIdx || 0) % PENS.length };
  });
  return applyStyle({ paths }, style);
}
