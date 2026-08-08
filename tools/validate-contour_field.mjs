/* Validator for contour_field — run from repo root:
   node tools/validate-contour_field.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js.
   The field formula is transcribed here as a conversion oracle: every contour
   vertex must sit on a grid edge and interpolate exactly to its level. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/contour_field.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS, SFONT, fontStrokes } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS; void SFONT; void fontStrokes;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/contour_field.js")).default;
  mode = "baked";
}
console.log("mode:", mode);

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  cells: 8, levels: 15, rough: 0.55, labels: true, labelSize: 3,
  labelPen: 0, pens: 1, margin: 12, seed: 3, layer: 0, ...over
});
const run = (over) => def.compute([undefined], P(over), ctx);

/* transcription of the node's field + layout (oracle) */
const layout = (p) => {
  const m = Math.max(0, p.margin);
  const band = p.labels ? Math.max(4, p.labelSize * 1.6) : 0;
  const x0f = m + band, y0f = m + band;
  const fw = ctx.W - 2 * (m + band), fh = ctx.H - 2 * (m + band);
  const gx = Math.max(3, Math.min(24, Math.round(p.cells)));
  const gy = Math.max(3, Math.round(gx * (fh / fw)));
  const F = [];
  for (let r = 0; r <= gy; r++) {
    const row = [];
    for (let c = 0; c <= gx; c++) {
      const sm = H.noise2(c * 0.55 + 13.7, r * 0.55 + 71.3, p.seed * 3 + 1);
      const rd = H.hash2(c, r, p.seed * 13 + 5);
      row.push(sm * (1 - p.rough) + rd * p.rough);
    }
    F.push(row);
  }
  let lo = 1e9, hi = -1e9;
  for (const row of F) for (const v of row) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { x0f, y0f, fw, fh, gx, gy, F, lo, hi };
};

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism + seed sensitivity */
{
  const a = JSON.stringify(run({}));
  const b = JSON.stringify(run({}));
  const c = JSON.stringify(run({ seed: 4 }));
  check("T1 determinism + seed", a === b && a !== c);
}

/* T2 field-value identity: every contour vertex on a grid edge, interpolating to its level */
{
  const p = P({ labels: false, levels: 12 });
  const { x0f, y0f, fw, fh, gx, gy, F, lo, hi } = layout(p);
  const out = run({ labels: false, levels: 12 }).paths;
  let bad = 0, checked = 0, offEdge = 0;
  for (const q of out) {
    for (const [x, y] of q.pts) {
      const cx2 = ((x - x0f) / fw) * gx, cy2 = ((y - y0f) / fh) * gy;
      const onX = Math.abs(cx2 - Math.round(cx2)) < 1e-6;
      const onY = Math.abs(cy2 - Math.round(cy2)) < 1e-6;
      if (!onX && !onY) { offEdge++; continue; }
      let fv;
      if (onX) {
        const c = Math.round(cx2), r0 = Math.floor(cy2), t = cy2 - r0;
        fv = r0 >= gy ? F[gy][c] : F[r0][c] + (F[r0 + 1][c] - F[r0][c]) * t;
      } else {
        const r = Math.round(cy2), c0 = Math.floor(cx2), t = cx2 - c0;
        fv = c0 >= gx ? F[r][gx] : F[r][c0] + (F[r][c0 + 1] - F[r][c0]) * t;
      }
      /* nearest level */
      const li = Math.round(((fv - lo) / (hi - lo)) * 12 - 0.5);
      const v = lo + (hi - lo) * ((Math.max(0, Math.min(11, li)) + 0.5) / 12);
      if (Math.abs(fv - v) > 1e-7) bad++;
      checked++;
    }
  }
  check("T2 vertices on grid edges at exact level values",
    offEdge === 0 && bad === 0 && checked > 200,
    "offEdge=" + offEdge + " bad=" + bad + " checked=" + checked);
}

/* T3 chain structure: open chains end on the field border; closed loops have >= 3 pts */
{
  const p = P({ labels: false });
  const { x0f, y0f, fw, fh } = layout(p);
  const out = run({ labels: false }).paths;
  const onB = ([x, y]) =>
    Math.abs(x - x0f) < 1e-6 || Math.abs(x - (x0f + fw)) < 1e-6 ||
    Math.abs(y - y0f) < 1e-6 || Math.abs(y - (y0f + fh)) < 1e-6;
  let badOpen = 0, badClosed = 0;
  for (const q of out) {
    if (q.closed) { if (q.pts.length < 3) badClosed++; }
    else if (!onB(q.pts[0]) || !onB(q.pts[q.pts.length - 1])) badOpen++;
  }
  check("T3 chain endpoints", badOpen === 0 && badClosed === 0,
    "badOpen=" + badOpen + " badClosed=" + badClosed);
}

/* T4 labels: digit strokes on the number pen, outside the field box, off-switch works */
{
  const p = P({ layer: 1, labelPen: 5 });
  const { x0f, y0f, fw, fh } = layout(p);
  const out = run({ layer: 1, labelPen: 5 }).paths;
  const lab = out.filter((q) => q.layer === 5);
  const inField = lab.filter((q) => q.pts.some(([x, y]) =>
    x > x0f + 1e-6 && x < x0f + fw - 1e-6 && y > y0f + 1e-6 && y < y0f + fh - 1e-6));
  const off = run({ labels: false, layer: 1, labelPen: 5 }).paths.filter((q) => q.layer === 5);
  check("T4 edge numbers", lab.length > 0 && inField.length === 0 && off.length === 0,
    "labels=" + lab.length + " inField=" + inField.length);
}

/* T5 pens cycling: pens 3 + layer 1 uses only pens 1..3 for contours */
{
  const out = run({ pens: 3, layer: 1, labels: false }).paths;
  const used = [...new Set(out.map((q) => q.layer))].sort((a, b) => a - b);
  check("T5 level pen cycle", used.every((v) => v >= 1 && v <= 3) && used.length === 3,
    "used=" + used.join(","));
}

/* T6 roughness + cells + levels all live */
{
  const a = JSON.stringify(run({}));
  check("T6 param sensitivity",
    a !== JSON.stringify(run({ rough: 0 })) &&
    a !== JSON.stringify(run({ cells: 16 })) &&
    a !== JSON.stringify(run({ levels: 30 })));
}

/* T7 sheet containment + budget at max settings */
{
  const out = run({ cells: 24, levels: 40, rough: 1, seed: 9 });
  let bad = 0;
  const total = out.paths.reduce((s, q) => s + q.pts.length, 0);
  for (const q of out.paths) for (const [x, y] of q.pts) {
    if (x < 0 || x > ctx.W || y < 0 || y > ctx.H) bad++;
  }
  check("T7 containment + budget", bad === 0 && total <= 118000,
    "bad=" + bad + " pts=" + total);
}

/* T8 degenerate canvas -> EMPTY, never throws */
{
  let ok = true, detail = "";
  try {
    const e = def.compute([undefined], P({ margin: 60 }), { W: 140, H: 140 });
    ok = e.paths.length === 0;
  } catch (e2) { ok = false; detail = "threw: " + e2.message; }
  check("T8 degenerate guard", ok, detail);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
