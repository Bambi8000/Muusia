/* Era patch: the frameFan engine seam in evalLevel (App.jsx).
 *
 * A node definition carrying `frameFan: true` (Collect Frames) is evaluated
 * specially: instead of one compute call, the engine re-evaluates the level
 * once per output pin with ctx.frameIdx = 0..N-1 and ctx.frameCount = N,
 * and collects the node's input across those runs — output k is the input
 * as it stood on frame k. The internal ctx._ff flag makes the inner passes
 * skip the seam (a frameFan node inside a collection pass falls back to its
 * own compute), so collection always terminates and chained collectors
 * cannot recurse.
 *
 * Run from the repo root: node tools/era/patch-frame-fan.mjs
 * Reports OK / MISS / SKIP per edit; then EXTRACTS the patched evalLevel and
 * runs a real fan-out through it — the smoke test proves the seam, not just
 * the string edit. Restart the dev server after this patch (App.jsx edit).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve("src/App.jsx");
let src = readFileSync(FILE, "utf8");

if (src.includes("frameFan")) {
  console.log("SKIP  App.jsx already carries the frameFan seam");
  process.exit(0);
}

let miss = 0;
const edit = (anchor, replacement, label) => {
  const parts = src.split(anchor);
  if (parts.length !== 2) {
    console.log("MISS  " + label + " (" + (parts.length - 1) + " hits, need exactly 1)");
    miss++;
    return;
  }
  src = parts[0] + replacement + parts[1];
  console.log("OK    " + label);
};

const ANCHOR =
  "      } else {\n" +
  "        const r = DEFS[node.type].compute(ins, merged, ctx, node);";
const BRANCH =
  "      } else if (DEFS[node.type] && DEFS[node.type].frameFan && !ctx._ff) {\n" +
  "        /* frameFan seam: re-evaluate the level once per output frame and\n" +
  "           collect this node's input across the runs (Collect Frames) */\n" +
  "        const nF = outSpec.length;\n" +
  "        const eF = level.edges.find((ed) => ed.to === id && ed.toPort === 0);\n" +
  "        outs = [];\n" +
  "        for (let f = 0; f < nF; f++) {\n" +
  "          if (!eF) { outs.push(EMPTY); continue; }\n" +
  "          const sub = evalLevel(level, { ...ctx, frameIdx: f, frameCount: nF, _ff: true }, boundIns);\n" +
  "          const v = (sub.out[eF.from] || [])[eF.fromPort || 0];\n" +
  "          outs.push(v && v.paths ? v : EMPTY);\n" +
  "        }\n";

edit(ANCHOR, BRANCH + ANCHOR, "evalLevel: frameFan branch before the compute branch");

if (miss) {
  console.log("ABORT " + miss + " missed anchor(s) - nothing written");
  process.exit(1);
}
writeFileSync(FILE, src);

/* ---- extract-and-run: the patched evalLevel must actually fan frames ---- */
let bad = 0;
const chk = (cond, msg) => { console.log((cond ? "OK    " : "FAIL  ") + msg); if (!cond) bad++; };

const start = src.indexOf("function evalLevel(level, ctx, boundIns) {");
chk(start > 0, "patched evalLevel found");
let depth = 0, end = start;
for (let i = src.indexOf("{", start); i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
const fnText = src.slice(start, end);
chk(/frameFan/.test(fnText) && /_ff/.test(fnText), "seam present inside evalLevel body");

/* faithful stubs of the engine helpers evalLevel closes over */
const EMPTY = { paths: [] };
const SOLID_STYLE = { kind: "style", mode: "Solid" };
const DEFS = {
  clockgen: {
    /* draws the frame index and frame count it was evaluated with */
    ins: [], outs: [{ type: "paths" }], params: [],
    compute: (ins, p, ctx) => ({ paths: [{ pts: [[ctx.frameIdx || 0, ctx.frameCount || 0], [1, 1]], closed: false, layer: 0 }] }),
  },
  collector: {
    frameFan: true,
    ins: [{ type: "paths" }],
    outs: (node) => Array.from({ length: (node && node.params && node.params.count) || 4 }, () => ({ type: "paths" })),
    params: [{ key: "count", type: "slider" }],
    compute: (ins, p, ctx) => {
      const n = (p && p.count) || 4;
      const idx = Math.min(n - 1, Math.max(0, (ctx && ctx.frameIdx) || 0));
      return Array.from({ length: n }, (_, k) => (k === idx && ins[0] ? { paths: ins[0].paths } : { paths: [] }));
    },
  },
};
const defIns = (node) => { const d = DEFS[node.type]; return !d ? [] : typeof d.ins === "function" ? d.ins(node) : d.ins || []; };
const defOuts = (node) => { const d = DEFS[node.type]; return !d ? [] : typeof d.outs === "function" ? d.outs(node) : d.outs || []; };
const numericParams = (node) => { const d = DEFS[node.type]; return !d ? [] : (d.params || []).filter((q) => q.type === "slider" || q.type === "number" || q.type === "seed"); };
const defaultFor = (type) => type === "value" ? 0 : type === "style" ? SOLID_STYLE : type === "mesh" ? null : EMPTY;

const evalLevel = new Function(
  "DEFS", "EMPTY", "SOLID_STYLE", "defIns", "defOuts", "numericParams", "defaultFor",
  '"use strict"; return (' + fnText + ");"
)(DEFS, EMPTY, SOLID_STYLE, defIns, defOuts, numericParams, defaultFor);

const level = {
  nodes: [
    { id: "g", type: "clockgen", params: {} },
    { id: "c", type: "collector", params: { count: 4 } },
  ],
  edges: [{ from: "g", fromPort: 0, to: "c", toPort: 0 }],
};
const res = evalLevel(level, { W: 420, H: 297, frameIdx: 2, frameCount: 99 });
const outs = res.out["c"];
chk(outs.length === 4, "collector yields 4 outputs");
chk(outs.every((o, k) => o.paths.length === 1 && o.paths[0].pts[0][0] === k),
  "output k carries the input as evaluated on frame k (0,1,2,3)");
chk(outs.every((o) => o.paths[0].pts[0][1] === 4),
  "upstream sees frameCount = collector count (4), not the panel's 99");

const bare = evalLevel({ nodes: [{ id: "c", type: "collector", params: { count: 3 } }], edges: [] },
  { W: 420, H: 297 });
chk(bare.out["c"].length === 3 && bare.out["c"].every((o) => o.paths.length === 0),
  "unwired collector yields empty frames, no throw");

const chained = {
  nodes: [
    { id: "g", type: "clockgen", params: {} },
    { id: "c1", type: "collector", params: { count: 3 } },
    { id: "c2", type: "collector", params: { count: 3 } },
  ],
  edges: [
    { from: "g", fromPort: 0, to: "c1", toPort: 0 },
    { from: "c1", fromPort: 0, to: "c2", toPort: 0 },
  ],
};
const res2 = evalLevel(chained, { W: 420, H: 297, frameIdx: 0, frameCount: 3 });
chk(Array.isArray(res2.out["c2"]) && res2.out["c2"].length === 3,
  "chained collectors terminate (no recursion hang)");

console.log(bad === 0 ? "DONE  App.jsx patched, seam proven by extract-and-run" : "DONE WITH " + bad + " FAILURES");
process.exit(bad === 0 ? 0 : 1);
