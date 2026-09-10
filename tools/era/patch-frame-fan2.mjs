/* Era patch: frameFan seam v2 in evalLevel (App.jsx).
 *
 * v2 generalizes the seam: `frameFan: true` still fans the collected frames
 * out as the node's own outputs (Collect Frames), and `frameFan` as a
 * FUNCTION `(node, mergedParams) => N` collects N frames of input 0 and
 * hands them to the node's compute AS THE INS ARRAY (Frame Grid "Animate"
 * fill) — returning 0 opts out for the current parameter state, so a
 * mode select can switch the seam off. ctx._ff still guards the inner
 * collection passes against recursion.
 *
 * Handles every starting state: installs v2 into a clean evalLevel,
 * upgrades an applied v1 branch in place, or SKIPs when v2 is present.
 *
 * Run from the repo root: node tools/era/patch-frame-fan2.mjs
 * Then EXTRACTS the patched evalLevel and proves BOTH seam forms by
 * running a fan-out and an Animate-style consumer through it.
 * Restart the dev server after this patch (App.jsx edit).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve("src/App.jsx");
let src = readFileSync(FILE, "utf8");

if (src.includes("frameFan seam v2")) {
  console.log("SKIP  App.jsx already carries the frameFan v2 seam");
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

const BASE_ANCHOR =
  "      } else {\n" +
  "        const r = DEFS[node.type].compute(ins, merged, ctx, node);";

const V1_BRANCH =
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

const V2_BRANCH =
  "      } else if (DEFS[node.type] && DEFS[node.type].frameFan && !ctx._ff) {\n" +
  "        /* frameFan seam v2: re-evaluate the level once per animation frame\n" +
  "           and collect this node's input across the runs. frameFan: true\n" +
  "           fans the frames out as the node's own outputs (Collect Frames);\n" +
  "           frameFan as a function (node, params) => N hands the N collected\n" +
  "           frames to compute as the ins array (Frame Grid Animate) —\n" +
  "           returning 0 opts out for the current parameter state. */\n" +
  "        const ff = DEFS[node.type].frameFan;\n" +
  "        const nF = typeof ff === \"function\"\n" +
  "          ? Math.max(0, Math.min(64, Math.round(ff(node, merged) || 0)))\n" +
  "          : outSpec.length;\n" +
  "        if (!nF) {\n" +
  "          const r = DEFS[node.type].compute(ins, merged, ctx, node);\n" +
  "          outs = outSpec.length > 1 ? (Array.isArray(r) ? r : [r]) : [r];\n" +
  "        } else {\n" +
  "          const eF = level.edges.find((ed) => ed.to === id && ed.toPort === 0);\n" +
  "          const frames = [];\n" +
  "          for (let f = 0; f < nF; f++) {\n" +
  "            if (!eF) { frames.push(EMPTY); continue; }\n" +
  "            const sub = evalLevel(level, { ...ctx, frameIdx: f, frameCount: nF, _ff: true }, boundIns);\n" +
  "            const v = (sub.out[eF.from] || [])[eF.fromPort || 0];\n" +
  "            frames.push(v && v.paths ? v : EMPTY);\n" +
  "          }\n" +
  "          if (typeof ff === \"function\") {\n" +
  "            const r = DEFS[node.type].compute(frames, merged, ctx, node);\n" +
  "            outs = outSpec.length > 1 ? (Array.isArray(r) ? r : [r]) : [r];\n" +
  "          } else {\n" +
  "            outs = frames;\n" +
  "          }\n" +
  "        }\n";

if (src.includes(V1_BRANCH)) {
  edit(V1_BRANCH, V2_BRANCH, "upgrade v1 frameFan branch to v2 in place");
} else {
  edit(BASE_ANCHOR, V2_BRANCH + BASE_ANCHOR, "install v2 frameFan branch before the compute branch");
}

if (miss) {
  console.log("ABORT " + miss + " missed anchor(s) - nothing written");
  process.exit(1);
}
writeFileSync(FILE, src);

/* ---- extract-and-run: prove BOTH seam forms in the patched evalLevel ---- */
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
chk(/frameFan seam v2/.test(fnText), "v2 seam present inside evalLevel body");

const EMPTY = { paths: [] };
const SOLID_STYLE = { kind: "style", mode: "Solid" };
const DEFS = {
  clockgen: {
    ins: [], outs: [{ type: "paths" }], params: [],
    compute: (ins, p, ctx) => ({ paths: [{ pts: [[ctx.frameIdx || 0, ctx.frameCount || 0], [1, 1]], closed: false, layer: 0 }] }),
  },
  collector: {
    frameFan: true,
    ins: [{ type: "paths" }],
    outs: (node) => Array.from({ length: (node && node.params && node.params.count) || 4 }, () => ({ type: "paths" })),
    params: [{ key: "count", type: "slider" }],
    compute: () => [EMPTY],
  },
  consumer: {
    /* Animate-style: frameFan function -> compute receives the frames array */
    frameFan: (node, merged) => (merged && merged.on ? merged.total || 0 : 0),
    ins: [{ type: "paths" }], outs: [{ type: "paths" }],
    params: [{ key: "total", type: "slider" }, { key: "on", type: "check" }],
    compute: (ins, p, ctx) => ({
      paths: ins.filter((s) => s && s.paths && s.paths.length)
        .map((s) => ({ pts: s.paths[0].pts, closed: false, layer: (ctx.frameIdx || 0) })),
    }),
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

/* form 1: frameFan true — outputs are the frames */
const lvl1 = {
  nodes: [{ id: "g", type: "clockgen", params: {} }, { id: "c", type: "collector", params: { count: 4 } }],
  edges: [{ from: "g", fromPort: 0, to: "c", toPort: 0 }],
};
const r1 = evalLevel(lvl1, { W: 420, H: 297, frameIdx: 2, frameCount: 99 });
chk(r1.out["c"].length === 4 && r1.out["c"].every((o, k) => o.paths.length === 1 && o.paths[0].pts[0][0] === k),
  "fan form: output k = input on frame k (0..3)");

/* form 2: frameFan function — compute receives the frames as ins */
const lvl2 = {
  nodes: [{ id: "g", type: "clockgen", params: {} }, { id: "u", type: "consumer", params: { total: 5, on: true } }],
  edges: [{ from: "g", fromPort: 0, to: "u", toPort: 0 }],
};
const r2 = evalLevel(lvl2, { W: 420, H: 297, frameIdx: 3, frameCount: 99 });
const cp = r2.out["u"][0].paths;
chk(cp.length === 5 && cp.every((q, k) => q.pts[0][0] === k && q.pts[0][1] === 5),
  "consumer form: compute got 5 frames, upstream saw frameCount 5");
chk(cp.every((q) => q.layer === 3), "consumer form: outer ctx (sheet frameIdx 3) reaches compute untouched");

/* opt-out: function returning 0 -> normal single-frame compute */
const lvl3 = {
  nodes: [{ id: "g", type: "clockgen", params: {} }, { id: "u", type: "consumer", params: { total: 5, on: false } }],
  edges: [{ from: "g", fromPort: 0, to: "u", toPort: 0 }],
};
const r3 = evalLevel(lvl3, { W: 420, H: 297, frameIdx: 3, frameCount: 99 });
chk(r3.out["u"][0].paths.length === 1 && r3.out["u"][0].paths[0].pts[0][0] === 3,
  "opt-out (N=0): normal compute with the outer frame's input");

const bare = evalLevel({ nodes: [{ id: "u", type: "consumer", params: { total: 3, on: true } }], edges: [] },
  { W: 420, H: 297 });
chk(bare.out["u"][0].paths.length === 0, "unwired consumer: empty frames, no throw");

console.log(bad === 0 ? "DONE  App.jsx at frameFan seam v2, both forms proven" : "DONE WITH " + bad + " FAILURES");
process.exit(bad === 0 ? 0 : 1);
