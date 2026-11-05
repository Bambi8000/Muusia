import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { Pin, mulberry32, applyStyle } from "../src/defs/helpers.js";

const built = new URL("../src/defs/nodes/leaf_field.js", import.meta.url);
const lab = new URL("../nodes-lab/leaf_field.plotternode.js", import.meta.url);
const def = fs.existsSync(built) && !process.argv.includes("--lab")
  ? (await import(built.href + `?t=${Date.now()}`)).default
  : vm.runInNewContext(fs.readFileSync(lab, "utf8"), { Pin, mulberry32, applyStyle });
const defaults = Object.fromEntries(def.params.map(row => [row.key, row.def]));
const ctx = { W: 297, H: 210 };
const run = (overrides = {}, style, page = ctx) => def.compute([style], { ...defaults, ...overrides }, page);
const sig = value => JSON.stringify(value);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const valid = (result, page = ctx, margin = 12) => result.paths.every(path =>
  Number.isInteger(path.layer) && path.layer >= 0 && path.layer <= 11 &&
  path.pts.length >= (path.closed ? 3 : 2) &&
  path.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) &&
    x >= margin - 1e-7 && x <= page.W - margin + 1e-7 &&
    y >= margin - 1e-7 && y <= page.H - margin + 1e-7));
const bbox = paths => {
  const xy = paths.flatMap(path => path.pts);
  return [Math.min(...xy.map(q => q[0])), Math.min(...xy.map(q => q[1])), Math.max(...xy.map(q => q[0])), Math.max(...xy.map(q => q[1]))];
};
const area = path => Math.abs(path.pts.reduce((sum, q, i) => {
  const r = path.pts[(i + 1) % path.pts.length];
  return sum + q[0] * r[1] - r[0] * q[1];
}, 0) / 2);

check(def.key === "leaf_field" && def.cat === "gen" && def.group === "nature", "generator metadata");
check(def.ins.length === 1 && def.ins[0].type === "style", "style input");
check(def.outs.length === 3 && def.outs.every(pin => pin.type === "paths"), "three path outputs");
check(def.params.find(row => row.key === "shape")?.options.length === 5, "shape selector uses actual options descriptor");
check(def.params.find(row => row.key === "noOverlap")?.type === "check" && def.params.find(row => row.key === "noOverlap")?.def === false, "No overlap is a backwards-compatible checkbox");
check(def.params.find(row => row.key === "gap")?.showIf({ noOverlap: true }) && !def.params.find(row => row.key === "gap")?.showIf({ noOverlap: false }), "gap appears only in No overlap mode");
const [art, leaves, veins] = run();
check(leaves.paths.length === 70 && veins.paths.length === 70 * 9, "default count and vein pairs");
check(art.paths.length === leaves.paths.length + veins.paths.length, "Artwork combines both parts");
check(leaves.paths.every(q => q.closed && q.pts.length === 144), "closed full leaf outlines");
check(veins.paths.every(q => !q.closed), "open botanical details");
check(valid(art) && valid(leaves) && valid(veins), "all outputs are valid and margin bounded");
check(leaves.paths.every(q => area(q) > 0.1), "leaves have nonzero fillable area");
check(sig(run()) === sig(run()), "fixed seed is deterministic");
check(createHash("sha256").update(sig(run())).digest("hex") === "583f97f53d8d8844b38d57a7c801a309ef7f460038e791f502814a4de2ae3489", "old saved fields keep exact v2.155 geometry");
check(sig(run({ noOverlap: undefined })) === sig(run()), "missing checkbox from old patch defaults off");
check(sig(run({ seed: 43 })) !== sig(run()), "seed changes geometry");
check(run({ count: 17 })[1].paths.length === 17, "count changes leaf total");
check(sig(run({ size: 39 })) !== sig(run()), "size changes geometry");
check(sig(run({ sizeVar: 0 })) !== sig(run()), "size variation changes geometry");
check(sig(run({ width: 0.8 })) !== sig(run()), "width changes geometry");
check(sig(run({ scatter: 0 })) !== sig(run({ scatter: 1 })), "scatter changes layout");
check(sig(run({ angle: 200 })) !== sig(run()), "angle changes orientation");
check(sig(run({ angleVar: 0 })) !== sig(run()), "spread changes orientation");
check(sig(run({ direction: "Aligned" })) !== sig(run({ direction: "Whorl" })), "direction modes differ");
check(sig(run({ bend: 0 })) !== sig(run()), "bend changes leaves");
for (const shape of ["Lance", "Oval", "Lobed", "Serrated", "Mixed"]) {
  const output = run({ shape });
  check(valid(output[1]) && output[1].paths.length === 70, `${shape} silhouette is valid`);
}
check(sig(run({ shape: "Lance" })[1]) !== sig(run({ shape: "Serrated" })[1]), "shape alters outlines");
check(run({ veins: 0 })[2].paths.length === 70, "zero vein pairs leaves midribs");
check(run({ veins: 10 })[2].paths.length === 70 * 21, "maximum vein pairs bounded");
check(sig(run({ stems: false })[2]) !== sig(veins), "stem switch changes details");
check(run({ leafPen: 7, veinPen: 9 })[1].paths.every(q => q.layer === 7) &&
  run({ leafPen: 7, veinPen: 9 })[2].paths.every(q => q.layer === 9), "separate pens");
const dashed = { kind: "style", mode: "Dashed", dash: 3, gap: 2, vary: 0, phase: 0, seed: 1 };
const styled = run({}, dashed);
check(styled[0].paths.length > art.paths.length, "style affects Artwork");
check(sig(styled[1]) === sig(leaves) && sig(styled[2]) === sig(veins), "separate outputs remain raw and fillable");
const specimenBoxes = (output, veinPairs) => output[1].paths.map((leaf, i) =>
  bbox([leaf, ...output[2].paths.slice(i * (veinPairs * 2 + 1), (i + 1) * (veinPairs * 2 + 1))]));
const separated = (boxes, gap) => boxes.every((a, i) => boxes.slice(i + 1).every(b =>
  a[2] + gap <= b[0] + 1e-7 || b[2] + gap <= a[0] + 1e-7 ||
  a[3] + gap <= b[1] + 1e-7 || b[3] + gap <= a[1] + 1e-7));
const clear = run({ noOverlap: true });
check(clear[1].paths.length > 50 && clear[1].paths.length <= 70, "No overlap fills most of a normal page");
check(clear[2].paths.length === clear[1].paths.length * 9 && clear[0].paths.length === clear[1].paths.length + clear[2].paths.length, "skipped leaves keep all outputs in sync");
check(clear.every(o => valid(o)), "No overlap stays inside margin");
check(separated(specimenBoxes(clear, 4), 1.5), "all complete specimens, including stems, keep the requested gap");
check(sig(clear) === sig(run({ noOverlap: true })), "No overlap placement is seeded");
const wideGap = run({ noOverlap: true, gap: 5 });
check(separated(specimenBoxes(wideGap, 4), 5) && wideGap[1].paths.length <= clear[1].paths.length, "gap control increases clearance and can reduce count");
const whirl = run({ noOverlap: true, direction: "Whorl", shape: "Serrated", veins: 2, stems: false, seed: 19 });
check(separated(specimenBoxes(whirl, 2), 1.5) && whirl.every(o => valid(o)), "Whorl and serrated leaves also stay separate");
const small = { W: 180, H: 130 };
const extreme = run({ count: 300, size: 90, width: 0.9, margin: 60, veins: 10, scatter: 1 }, undefined, small);
check(extreme[1].paths.length === 300 && extreme[2].paths.length === 300 * 21, "extreme request completes without truncating leaves");
check(extreme.every(output => valid(output, small, 60)), "extreme request stays inside tiny margin region");
check(extreme[1].paths.every(q => area(q) > 0), "extreme leaves retain area");
const crowded = run({ noOverlap: true, count: 300, size: 90, width: 0.9, margin: 60, veins: 10, scatter: 1 }, undefined, small);
check(crowded[1].paths.length > 0 && crowded[1].paths.length < 300, "crowded page skips entire leaves rather than overlap or truncate paths");
check(crowded[2].paths.length === crowded[1].paths.length * 21 && crowded.every(o => valid(o, small, 60)), "crowded outputs remain complete and bounded");
check(separated(specimenBoxes(crowded, 10), 1.5), "crowded specimens retain clearance");
check(bbox(leaves.paths)[2] > 200 && bbox(leaves.paths)[3] > 130, "field covers the page");
check(run({}, undefined, { W: Infinity, H: 210 }).every(o => !o.paths.length), "invalid paper returns empty");
check(run({ margin: 60 }, undefined, { W: 100, H: 100 }).every(o => !o.paths.length), "collapsed margin returns empty");
check(def.overlay(defaults, ctx)[0].kind === "rect" && def.overlay(defaults, {}).length === 0, "margin guide is safe");
console.log(`${checks} Leaf Field checks passed`);
