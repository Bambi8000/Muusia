/* validate-morphlayers.mjs — checks the Morph Layers node.
 *
 * Uses the REAL src/defs/helpers.js. Auto-switch: prefers the baked
 * src/defs/nodes/morphlayers.js, otherwise evaluates
 * nodes-lab/morphlayers.plotternode.js (paren-wrapped against ASI).
 * Run from the repo root: node tools/validate-morphlayers.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { Pin, EMPTY } from "../src/defs/helpers.js";

let checks = 0, fails = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.log(`FAIL  ${msg}`); }
};

const BAKED = "src/defs/nodes/morphlayers.js";
const LAB = "nodes-lab/morphlayers.plotternode.js";
let def, sourceName;
if (existsSync(BAKED)) {
  def = (await import("../" + BAKED)).default;
  sourceName = BAKED + " (baked)";
} else if (existsSync(LAB)) {
  const text = readFileSync(LAB, "utf8");
  def = new Function("Pin", "EMPTY", `"use strict"; return (${text});`)(Pin, EMPTY);
  sourceName = LAB + " (lab)";
} else {
  console.log("FAIL  neither baked nor lab morphlayers file found");
  process.exit(1);
}
console.log(`using ${sourceName}`);

/* --- contract --- */
ok(def.key === "morphlayers", "key is 'morphlayers'");
ok(def.cat === "duo", "cat is duo (Combiners)");
ok(Array.isArray(def.ins) && def.ins.length === 2, "two inputs");
ok(def.ins[0].label === "first" && def.ins[1].label === "last", "pins labelled first/last");
const mat = def.params.find((q) => q.key === "match");
ok(mat && mat.type === "select" && Array.isArray(mat.options)
  && mat.options.join("|") === "Split & merge|Nearest|By order" && mat.def === "Split & merge",
  "match select uses the options field with Split & merge/Nearest/By order, default Split & merge");
const outp = def.params.find((q) => q.key === "output");
ok(outp && outp.type === "select" && Array.isArray(outp.options) && outp.options.join(",") === "Sheets,Pens",
  "output select uses the options field (not opts) with Sheets/Pens");
const easep = def.params.find((q) => q.key === "ease");
ok(easep && Array.isArray(easep.options), "ease select uses the options field");
const lay = def.params.find((q) => q.key === "layers");
ok(lay && lay.min === 2 && lay.max === 12, "layers slider 2..12 (Stack View MAX_SHEETS)");

/* --- fixtures: square (A) -> same-count square elsewhere (B) --- */
const sq = (x, y, w, pen) => ({
  pts: [[x, y], [x + w, y], [x + w, y + w], [x, y + w]], closed: true, layer: pen,
});
const bboxOf = (ps) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of ps.paths) for (const pt of q.pts) {
    x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]); x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]);
  }
  return [x0, y0, x1, y1];
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const A1 = { paths: [sq(0, 0, 10, 2)] };
const B1 = { paths: [sq(100, 40, 30, 5)] };
const P = { layers: 4, output: "Sheets", pen: 0, samples: 64, ease: "Linear", match: "Nearest" };

/* endpoints and midpoint (Sheets mode) */
const r0 = def.compute([A1, B1], P, { frameIdx: 0, frameCount: 4 });
const rE = def.compute([A1, B1], P, { frameIdx: 3, frameCount: 4 });
const b0 = bboxOf(r0), bE = bboxOf(rE);
ok(near(b0[0], 0, 0.01) && near(b0[2], 10, 0.01) && near(b0[1], 0, 0.01) && near(b0[3], 10, 0.01),
  "layer 0 geometry == first input (bbox exact)");
ok(near(bE[0], 100, 0.01) && near(bE[2], 130, 0.01) && near(bE[1], 40, 0.01) && near(bE[3], 70, 0.01),
  "last layer geometry == last input (bbox exact)");
const rM = def.compute([A1, B1], P, { frameIdx: 1, frameCount: 4 });
const bM = bboxOf(rM);
ok(bM[0] > b0[0] && bM[0] < bE[0] && bM[2] > b0[2] && bM[2] < bE[2], "middle layer sits between the ends");
ok(r0.paths[0].closed === true, "closed+closed pair stays closed");
ok(r0.paths[0].pts.length === 64, "samples param respected (closed: exactly S points)");
ok(r0.paths[0].layer === 2, "Sheets mode keeps the source pen");

/* frame clamping + null ctx */
ok(near(bboxOf(def.compute([A1, B1], P, { frameIdx: 99 }))[0], 100, 0.01), "frame beyond layers clamps to the last");
ok(near(bboxOf(def.compute([A1, B1], P, null))[0], 0, 0.01), "null ctx -> layer 0");

/* ease endpoints unchanged */
const PSm = { ...P, ease: "Smooth" };
ok(near(bboxOf(def.compute([A1, B1], PSm, { frameIdx: 0 }))[0], 0, 0.01)
  && near(bboxOf(def.compute([A1, B1], PSm, { frameIdx: 3 }))[0], 100, 0.01),
  "Smooth ease keeps the endpoints exact");

/* --- Pens mode: all layers, walking pen --- */
const rP = def.compute([A1, B1], { ...P, output: "Pens", pen: 10 }, { frameIdx: 0 });
ok(rP.paths.length === 4, "Pens mode emits every layer");
ok(rP.paths.map((q) => q.layer).join(",") === "10,11,0,1", "pens walk (first pen + i) mod 12");

/* --- nearest-centroid pairing beats input order --- */
const A2 = { paths: [sq(0, 0, 10, 0), sq(200, 0, 10, 1)] };
const B2 = { paths: [sq(200, 100, 10, 4), sq(0, 100, 10, 3)] }; /* reversed order */
const rC = def.compute([A2, B2], { ...P, layers: 3 }, { frameIdx: 1, frameCount: 3 });
const xs = rC.paths.map((q) => q.pts.reduce((s, pt) => s + pt[0], 0) / q.pts.length).sort((a, b) => a - b);
ok(rC.paths.length === 2 && near(xs[0], 5, 1) && near(xs[1], 205, 1),
  "pairing by nearest centroid: shapes morph straight up, not across the canvas");

/* --- birth/death of unpaired paths --- */
const A3 = { paths: [sq(0, 0, 10, 0), sq(50, 0, 10, 1)] };
const B3 = { paths: [sq(0, 0, 10, 0)] };
const mid3 = def.compute([A3, B3], { ...P, layers: 5 }, { frameIdx: 2, frameCount: 5 });
const end3 = def.compute([A3, B3], { ...P, layers: 5 }, { frameIdx: 4, frameCount: 5 });
ok(mid3.paths.length === 2, "dying path still alive mid-morph");
const dying = mid3.paths.find((q) => q.layer === 1);
const dyBox = (() => { let x0 = 1e9, x1 = -1e9; for (const pt of dying.pts) { x0 = Math.min(x0, pt[0]); x1 = Math.max(x1, pt[0]); } return x1 - x0; })();
ok(dyBox > 0.5 && dyBox < 10, "dying path shrinks toward its centroid");
ok(end3.paths.length === 1, "fully collapsed path is dropped on the last layer");
const grow = def.compute([B3, A3], { ...P, layers: 5 }, { frameIdx: 2, frameCount: 5 });
ok(grow.paths.length === 2, "born path grows out mid-morph (reverse direction)");

/* --- Split & merge: fragments morph into the target outline --- */
const fragSeg = (x0, y0, x1, y1, pen) => ({ pts: [[x0, y0], [x1, y1]], closed: false, layer: pen });
/* six open fragments tracing a 40x40 square perimeter at origin */
const FR = { paths: [
  fragSeg(0, 0, 20, 0, 0), fragSeg(20, 0, 40, 0, 0),
  fragSeg(40, 0, 40, 40, 1), fragSeg(40, 40, 20, 40, 1),
  fragSeg(20, 40, 0, 40, 2), fragSeg(0, 40, 0, 0, 2),
] };
const TGT = { paths: [sq(200, 200, 40, 7)] };
const PS2 = { layers: 5, output: "Sheets", pen: 0, samples: 32, ease: "Linear", match: "Split & merge" };

const s0 = def.compute([FR, TGT], PS2, { frameIdx: 0, frameCount: 5 });
ok(s0.paths.length === 6, "split: first layer keeps the fragment count");
const sb0 = bboxOf(s0);
ok(near(sb0[0], 0, 0.01) && near(sb0[2], 40, 0.01), "split: first layer geometry == fragments exactly");
ok(s0.paths.every((q) => q.closed === false), "split: fragments stay open strokes");

const sE = def.compute([FR, TGT], PS2, { frameIdx: 4, frameCount: 5 });
ok(sE.paths.length === 6, "split: last layer keeps the cut structure (6 arcs)");
const sbE = bboxOf(sE);
ok(near(sbE[0], 200, 0.5) && near(sbE[2], 240, 0.5) && near(sbE[1], 200, 0.5) && near(sbE[3], 240, 0.5),
  "split: arcs of the last layer compose the target outline (bbox)");
const arcTotal = sE.paths.reduce((s, q) => {
  let l = 0;
  for (let i = 1; i < q.pts.length; i++) l += Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1]);
  return s + l;
}, 0);
ok(near(arcTotal, 160, 4), "split: arc lengths partition the full perimeter (sum ~ 160)");

const sM = def.compute([FR, TGT], PS2, { frameIdx: 2, frameCount: 5 });
const sbM = bboxOf(sM);
ok(sM.paths.length === 6 && sbM[0] > sb0[0] && sbM[0] < sbE[0], "split: mid layer between, no birth/death clumps");

/* reverse direction: one shape splits into fragments */
const g0 = def.compute([TGT, FR], PS2, { frameIdx: 0, frameCount: 5 });
const gb0 = bboxOf(g0);
ok(g0.paths.length === 6 && near(gb0[0], 200, 0.5) && near(gb0[2], 240, 0.5),
  "split reverse: first layer = target outline as arcs");
const gE = def.compute([TGT, FR], PS2, { frameIdx: 4, frameCount: 5 });
ok(near(bboxOf(gE)[0], 0, 0.01) && near(bboxOf(gE)[2], 40, 0.01), "split reverse: last layer == fragments exactly");

/* equal counts degenerate to Nearest */
const eq = def.compute([A2, B2], { ...PS2, layers: 3 }, { frameIdx: 1, frameCount: 3 });
ok(eq.paths.length === 2, "split with equal counts pairs 1:1 like Nearest");

/* --- By order: modulo cycling, every extra path shares the target --- */
const rO = def.compute([A3, B3], { ...P, match: "By order", layers: 3 }, { frameIdx: 2, frameCount: 3 });
ok(rO.paths.length === 2, "by order: modulo keeps every path");
const oxs = rO.paths.map((q) => q.pts.reduce((s, pt) => s + pt[0], 0) / q.pts.length);
ok(oxs.every((x) => near(x, 5, 1)), "by order: both paths land on the shared target");

/* --- inputs and integrity --- */
ok(def.compute([A1, undefined], P, { frameIdx: 0 }) === EMPTY, "missing last input -> EMPTY");
ok(def.compute([undefined, B1], P, { frameIdx: 0 }) === EMPTY, "missing first input -> EMPTY");
ok(def.compute([{ paths: [] }, B1], P, { frameIdx: 0 }) === EMPTY, "empty first input -> EMPTY");
const frozenA = JSON.stringify(A1), frozenB = JSON.stringify(B1);
def.compute([A1, B1], { ...P, output: "Pens" }, { frameIdx: 0 });
ok(JSON.stringify(A1) === frozenA && JSON.stringify(B1) === frozenB, "compute does not mutate its inputs");
const d1 = JSON.stringify(def.compute([A2, B2], P, { frameIdx: 1, frameCount: 4 }));
const d2 = JSON.stringify(def.compute([A2, B2], P, { frameIdx: 1, frameCount: 4 }));
ok(d1 === d2, "deterministic (double run equal)");
const allFinite = def.compute([A1, B1], { ...P, output: "Pens" }, {}).paths
  .every((q) => q.pts.every((pt) => pt.every(Number.isFinite)));
ok(allFinite, "finite coordinates in every layer");

console.log(fails === 0 ? `morphlayers: ALL OK (${checks} checks)` : `morphlayers: ${fails}/${checks} FAILED`);
process.exit(fails === 0 ? 0 : 1);
