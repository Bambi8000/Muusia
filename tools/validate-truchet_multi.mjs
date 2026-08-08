/* Validator for truchet_multi — run from repo root:
   node tools/validate-truchet_multi.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/truchet_multi.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/truchet_multi.js")).default;
}
console.log("mode:", mode || "baked");

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  cell: 18, strands: 2, tiles: "Arcs", subdiv: 0.35, sublevels: 1,
  pens: 1, margin: 12, seed: 6, layer: 0, ...over
});
const run = (over) => def.compute([undefined], P(over), ctx);
/* grid layout transcription */
const grid = (p) => {
  const m = Math.max(0, p.margin), cell = Math.max(4, p.cell);
  const cols = Math.floor((ctx.W - 2 * m) / cell);
  const rows = Math.floor((ctx.H - 2 * m) / cell);
  return { cell, cols, rows, ox: (ctx.W - cols * cell) / 2, oy: (ctx.H - rows * cell) / 2 };
};

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism + seed */
{
  const a = JSON.stringify(run({}));
  check("T1 determinism + seed", a === JSON.stringify(run({})) && a !== JSON.stringify(run({ seed: 7 })));
}

/* T2 chaining oracle: uniform grid (no subdivision) -> every path is a closed loop
   or an open stroke whose BOTH endpoints lie on the tiled region border */
{
  const p = P({ subdiv: 0 });
  const { cell, cols, rows, ox, oy } = grid(p);
  const onB = ([x, y]) =>
    Math.abs(x - ox) < 1e-6 || Math.abs(x - (ox + cols * cell)) < 1e-6 ||
    Math.abs(y - oy) < 1e-6 || Math.abs(y - (oy + rows * cell)) < 1e-6;
  const out = run({ subdiv: 0 }).paths;
  const bad = out.filter((q) => !q.closed && !(onB(q.pts[0]) && onB(q.pts[q.pts.length - 1])));
  const loops = out.filter((q) => q.closed).length;
  check("T2 loops or border-to-border strokes", bad.length === 0 && loops > 0 && out.length > 10,
    "bad=" + bad.length + " loops=" + loops + " paths=" + out.length);
}

/* T3 arc radius oracle: every vertex sits at a strand radius from some cell corner */
{
  const p = P({ subdiv: 0, strands: 2 });
  const { cell, cols, rows, ox, oy } = grid(p);
  const radii = [cell / 3, (2 * cell) / 3];
  const out = run({ subdiv: 0, strands: 2 }).paths;
  let bad = 0, checked = 0;
  for (const q of out) {
    for (const [x, y] of q.pts) {
      const cxn = ox + Math.round((x - ox) / cell) * cell;
      const cyn = oy + Math.round((y - oy) / cell) * cell;
      let best = 1e9;
      for (const dx of [-cell, 0, cell]) for (const dy of [-cell, 0, cell]) {
        const d = Math.hypot(x - (cxn + dx), y - (cyn + dy));
        for (const r of radii) best = Math.min(best, Math.abs(d - r));
      }
      if (best > 1e-6) bad++;
      checked++;
    }
  }
  check("T3 arc radii exact", bad === 0 && checked > 1000, "bad=" + bad + " checked=" + checked);
}

/* T4 Lines mode: every segment runs at exactly 45 degrees */
{
  const out = run({ tiles: "Lines", subdiv: 0 }).paths;
  let bad = 0;
  for (const q of out) {
    const pts = q.closed ? [...q.pts, q.pts[0]] : q.pts;
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
      const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
      if (Math.abs(dx - dy) > 1e-6) bad++;
    }
  }
  check("T4 chamfers at 45 degrees", bad === 0 && out.length > 5, "bad=" + bad);
}

/* T5 chaining compresses: far fewer paths than raw strands (2 strands x 2 corners x tiles) */
{
  const p = P({ subdiv: 0 });
  const { cols, rows } = grid(p);
  const rawStrands = cols * rows * 2 * 2;
  const out = run({ subdiv: 0 }).paths;
  check("T5 chain compression", out.length < rawStrands * 0.5,
    "paths=" + out.length + " raw=" + rawStrands);
}

/* T6 subdivision + pens by depth: sub levels create smaller cells on their own pens */
{
  const out = run({ subdiv: 0.5, sublevels: 2, pens: 3, layer: 1 }).paths;
  const used = [...new Set(out.map((q) => q.layer))].sort((a, b) => a - b);
  const flat = run({ subdiv: 0, sublevels: 2, pens: 3, layer: 1 }).paths;
  const flatUsed = [...new Set(flat.map((q) => q.layer))];
  check("T6 depth pens", used.join(",") === "1,2,3" && flatUsed.join(",") === "1",
    "used=" + used.join(",") + " flat=" + flatUsed.join(","));
}

/* T7 containment in the tiled region */
{
  const p = P({ subdiv: 0.6, sublevels: 2 });
  const { cell, cols, rows, ox, oy } = grid(p);
  const out = run({ subdiv: 0.6, sublevels: 2 }).paths;
  const bad = out.flatMap((q) => q.pts).filter(([x, y]) =>
    x < ox - 1e-6 || x > ox + cols * cell + 1e-6 || y < oy - 1e-6 || y > oy + rows * cell + 1e-6);
  check("T7 region containment", bad.length === 0, "bad=" + bad.length);
}

/* T8 budget + degenerate guard */
{
  let ok = true, detail = "";
  try {
    const out = run({ cell: 6, strands: 4, subdiv: 1, sublevels: 2, margin: 0 });
    const total = out.paths.reduce((s, q) => s + q.pts.length, 0);
    ok = total <= 118000;
    detail = "pts=" + total;
    const e = def.compute([undefined], P({ margin: 60 }), { W: 130, H: 130 });
    ok = ok && e.paths.length === 0;
  } catch (e2) { ok = false; detail = "threw: " + e2.message; }
  check("T8 budget + degenerate", ok, detail);
}

/* T9 overlay matches the grid rect */
{
  let ok = true, detail = "";
  try {
    const p = P();
    const { cell, cols, rows, ox, oy } = grid(p);
    const g = def.overlay(p, ctx);
    ok = g.length === 1 && g[0].kind === "rect" &&
      Math.abs(g[0].x - ox) < 1e-9 && Math.abs(g[0].w - cols * cell) < 1e-9 &&
      Math.abs(g[0].y - oy) < 1e-9 && Math.abs(g[0].h - rows * cell) < 1e-9;
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T9 overlay grid rect", ok, detail);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
