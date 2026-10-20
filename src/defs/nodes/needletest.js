import { Pin, EMPTY } from "../helpers.js";

const number = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback));
const mm = v => `${+v.toFixed(3)} mm`;

function layout(p, ctx) {
  // Invalid depth must never turn into an unintended plunge.
  if (!Number.isFinite(+p.maxDepth) || +p.maxDepth < .1) return null;
  const maxDepth = Math.min(2, +p.maxDepth);
  const rows = Math.round(number(p.depthSteps, 5, 1, 10));
  const cols = Math.round(number(p.spacingSteps, 5, 1, 10));
  const dots = Math.round(number(p.dots, 20, 20, 200));
  const a = number(p.minSpacing, .5, .1, 20), b = number(p.maxSpacing, 3, .1, 20);
  const minSpacing = Math.min(a, b), maxSpacing = Math.max(a, b);
  const gap = number(p.gap, 4, 2, 30), margin = number(p.margin, 12, 0, 60);
  const width = (dots - 1) * maxSpacing;
  const height = (rows * cols - 1) * gap;
  const W = number(ctx.W, 0, 0, 10000), H = number(ctx.H, 0, 0, 10000);
  // Reserve space for preview labels. Never rescale or crop a calibration grid.
  if (width + 2 * margin + 42 > W || height + 2 * margin + 7 > H) return null;
  return { rows, cols, dots, gap, maxDepth,
    x: margin + 42, y: margin + 7,
    depth: r => maxDepth * (r + 1) / rows,
    spacing: c => cols === 1 ? maxSpacing : minSpacing + (maxSpacing - minSpacing) * c / (cols - 1),
  };
}

export default {
  key: "needletest",
  name: "Needle Test",
  cat: "gen",
  group: "structural",
  desc: "Needle puncture calibration in horizontal rows. Each row has one fixed depth and one fixed point spacing, with at least 20 punches at those settings. All combinations of Depth steps and Spacing steps are tested: spacing increases between rows, then the next depth begins. Depth ranges from Max depth / Depth steps to Max depth; one depth step uses Max depth. One spacing step uses Max spacing. Max depth defaults to 0.5 mm and is capped at 2 mm, including wired values. Reversed spacing limits are sorted. Punches per row is at least 20 even for old projects or wired values. Row gap separates rows vertically. Preview labels show each row's depth and spacing, and never export. If the complete sheet does not fit, no punches are emitted: enlarge the canvas or reduce steps, punches, spacing or margin. Distances are never rescaled. Connect directly to output, use the Needle Z profile and export G-code. No Needle Punch or downstream modifiers are needed. SVG/DXF do not preserve depth.",
  ins: [],
  outs: [Pin("paths")],
  params: [
    { key: "maxDepth", label: "Max depth (mm)", type: "slider", min: .1, max: 2, step: .1, def: .5 },
    { key: "depthSteps", label: "Depth steps", type: "slider", min: 1, max: 10, step: 1, def: 5 },
    { key: "minSpacing", label: "Min spacing (mm)", type: "slider", min: .1, max: 20, step: .1, def: .5 },
    { key: "maxSpacing", label: "Max spacing (mm)", type: "slider", min: .1, max: 20, step: .1, def: 3 },
    { key: "spacingSteps", label: "Spacing steps", type: "slider", min: 1, max: 10, step: 1, def: 5 },
    { key: "dots", label: "Punches per row", type: "slider", min: 20, max: 200, step: 1, def: 20 },
    { key: "gap", label: "Row gap (mm)", type: "slider", min: 2, max: 30, step: 1, def: 4 },
    { key: "margin", label: "Margin (mm)", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const g = layout(p, ctx);
    if (!g) return [{ kind: "text", x: 2, y: 5, text: "Needle Test: check canvas size and Max depth", size: 3 }];
    const guides = [];
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const y = g.y + (r * g.cols + c) * g.gap;
      guides.push({ kind: "text", x: g.x - 41, y: y + .7, text: `D ${mm(g.depth(r))} / S ${mm(g.spacing(c))}`, size: 2.2 });
    }
    return guides;
  },
  compute(ins, p, ctx) {
    const g = layout(p, ctx);
    if (!g) return EMPTY;
    const paths = [], layer = Math.round(number(p.layer, 0, 0, 11));
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const spacing = g.spacing(c), depth = g.depth(r);
      const py = g.y + (r * g.cols + c) * g.gap;
      for (let x = 0; x < g.dots; x++) {
        const px = g.x + x * spacing;
        paths.push({ pts: [[px, py, depth], [px, py, depth]], closed: false, layer });
      }
    }
    return { paths };
  },
};
