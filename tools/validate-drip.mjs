import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Pin, EMPTY, mulberry32, signedArea } from "../src/defs/helpers.js";

const built = new URL("../src/defs/nodes/drip.js", import.meta.url);
const lab = new URL("../nodes-lab/drip.plotternode.js", import.meta.url);
const def = fs.existsSync(built)
  ? (await import(built.href + `?t=${Date.now()}`)).default
  : vm.runInNewContext(fs.readFileSync(lab, "utf8"), { Pin, EMPTY, mulberry32, signedArea, Math, Number, Array });
const defaults = Object.fromEntries(def.params.map(x => [x.key, x.def]));
const context = { W: 297, H: 210 };
const line = { paths: [{ pts: [[25, 65], [270, 65]], closed: false, layer: 3 }] };
const rect = { paths: [{ pts: [[30, 30], [250, 30], [250, 100], [30, 100]], closed: true, layer: 2 }] };
const run = (params = {}, source = line, ctx = context) => def.compute([source], { ...defaults, ...params }, ctx);
const sig = x => JSON.stringify(x);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const finite = output => output.paths.every(path => path.pts.length >= 2 && !path.closed &&
  path.layer >= 0 && path.layer <= 11 && path.pts.every(([x,y]) => Number.isFinite(x) && Number.isFinite(y)));

check(def.key === "drip" && def.cat === "mod" && def.group === "deform", "modifier metadata");
check(def.ins.length === 1 && def.ins[0].type === "paths" && def.outs.length === 2 && def.outs.every(x => x.type === "paths"), "path input and both path outputs");
const [result, added] = run();
check(result.paths.length > added.paths.length && added.paths.length > 5, "result keeps source and adds many drips");
check(added.paths.every(q => q.layer === 3) && finite(added), "new paths inherit valid source pen");
check(sig(run()) === sig([result, added]), "deterministic output");
check(sig(line) === sig({ paths: [{ pts: [[25, 65], [270, 65]], closed: false, layer: 3 }] }), "source remains unchanged");
check(added.paths.every(q => Math.abs(q.pts[0][1] - 65) < 1e-6 && Math.abs(q.pts.at(-1)[1] - 65) < 1e-6), "every open contour attaches to source line at both ends");
check(added.paths.every(q => Math.max(...q.pts.map(p => p[1])) > 70), "default drips hang down");
const precise = run({ density: 100, variation: 0, sway: 0, length: 25, clip: false })[1];
check(precise.paths.every(q => Math.abs(Math.max(...q.pts.map(p => p[1])) - 90) < 1e-6), "fixed length reaches expected depth");
check(run({ spacing: 8 })[1].paths.length > run({ spacing: 24 })[1].paths.length, "spacing changes drip count");
check(run({ density: 0 })[1].paths.length === 0 && run({ density: 0 })[0].paths.length === 1, "zero density leaves source only");
check(sig(run({ keep: false })[0]) === sig(run({ keep: false })[1]), "keep source off makes Result equal Drips");
check(sig(run({ style: "Pointed" })[1]) !== sig(added), "pointed shape changes contours");
check(run({ style: "Thread" })[1].paths.every(q => q.pts.length <= 13 && !q.closed), "thread shape is one open centerline");
check(sig(run({ width: 12 })[1]) !== sig(added), "width changes rounded contour");
check(sig(run({ width: 12, style: "Thread" })[1]) === sig(run({ style: "Thread" })[1]), "width does not affect thread");
check(sig(run({ length: 45 })[1]) !== sig(added) && sig(run({ variation: 0 })[1]) !== sig(added), "length and variation change drawing");
check(sig(run({ sway: 12 })[1]) !== sig(added), "sway changes drawing");
check(sig(run({ seed: 38 })[1]) !== sig(added), "seed changes drawing");
check(sig(run({ direction: 60 })[1]) !== sig(added), "direction changes drawing");
const lower = run({ density: 100, variation: 0, sway: 0 }, rect)[1].paths;
check(lower.length > 0 && lower.every(q => Math.abs(q.pts[0][1] - 100) < 1e-6), "closed shape drips only from lower edge");
const reversed = { paths: [{ ...rect.paths[0], pts: [...rect.paths[0].pts].reverse() }] };
check(run({ density: 100, variation: 0, sway: 0 }, reversed)[1].paths.every(q => Math.abs(q.pts[0][1] - 100) < 1e-6), "winding does not change facing-edge selection");
const upper = run({ density: 100, direction: 270 }, rect)[1].paths;
check(upper.length > 0 && upper.every(q => Math.abs(q.pts[0][1] - 30) < 1e-6), "upward flow selects upper edge");
check(run({ edge: "All edges", density: 100 }, rect)[1].paths.length > lower.length, "all edges adds drips around contour");
const clipped = run({ length: 100, variation: 100, margin: 12, density: 100 }, line)[1];
check(clipped.paths.every(q => q.pts.every(([x,y]) => x >= 12 && x <= 285 && y >= 12 && y <= 198)), "drips clip to margin");
check(def.overlay(defaults, context).some(q => q.kind === "rect") && def.overlay(defaults, context).some(q => q.kind === "arrow"), "margin and flow guides");
check(def.overlay(defaults, {}).length === 0 && run({}, line, { W: Infinity, H: 210 })[0].paths.length === 0, "invalid canvas handled");
check(run({}, { paths: [{ pts: [[NaN, 0], [20, 0]], closed: false, layer: 0 }] })[0].paths.length === 0, "bad coordinates rejected whole");
check(run({ density: 100, spacing: 2 }, { paths: [{ pts: [[0, 0], [100000, 0]], closed: false, layer: 0 }] })[1].paths.length === 0, "oversized request rejected whole");
console.log(`${checks} Drip checks passed`);
