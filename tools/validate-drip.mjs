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
const fill = run({ fill: "Cross hatch" });
const contours = fill[1].paths.filter(q => q.pts.length > 2);
const hatch = fill[1].paths.filter(q => q.pts.length === 2);
check(contours.length === added.paths.length && hatch.length > contours.length, "cross hatch fills every rounded drip");
check(sig(contours) === sig(added.paths), "enabling fill preserves original drip contours exactly");
check(finite({ paths: hatch }) && hatch.every(q => q.layer === 3), "fill has finite, open two-point strokes in source pen");
check(sig(run({ fill: "Cross hatch" })) === sig(fill), "cross hatch deterministic");
const inside = (point, polygon) => {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < a[0] + (point[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) yes = !yes;
  }
  return yes;
};
check(hatch.every(q => {
  const a = q.pts[0], b = q.pts[1], mid = [(a[0]+b[0])/2,(a[1]+b[1])/2];
  return contours.some(c => inside(a,c.pts) && inside(mid,c.pts) && inside(b,c.pts));
}), "every hatch segment stays inside one drip contour");
let owningContour = null;
check(fill[1].paths.every(q => {
  if (q.pts.length > 2) { owningContour = q; return true; }
  return owningContour && q.pts.every(point => inside(point, owningContour.pts));
}), "hatch segments belong to their own preceding drip contour");
const hatchDirections = new Set(hatch.map(q => {
  const a=q.pts[0], b=q.pts[1];
  return Math.round((((Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI)%180)+180)%180);
}));
check(hatchDirections.has(45) && hatchDirections.has(135), "cross hatch draws two perpendicular directions");
check(run({ fill: "Cross hatch", hatchSpacing: .8 })[1].paths.length > run({ fill: "Cross hatch", hatchSpacing: 3 })[1].paths.length, "hatch spacing changes density");
check(sig(run({ fill: "Cross hatch", hatchAngle: 20 })[1]) !== sig(fill[1]), "hatch angle rotates both passes");
const hatchLength = paths => paths.filter(q=>q.pts.length===2).reduce((n,q)=>n+Math.hypot(q.pts[1][0]-q.pts[0][0],q.pts[1][1]-q.pts[0][1]),0);
check(hatchLength(run({ fill: "Cross hatch", hatchInset: 1 })[1].paths) < hatchLength(run({ fill: "Cross hatch", hatchInset: 0 })[1].paths), "inset pulls hatch away from outline");
const twoPens = run({ fill: "Cross hatch", hatchOwnPen: true, hatchPen: 9 });
check(twoPens[1].paths.filter(q=>q.pts.length===2).every(q=>q.layer===9) && twoPens[1].paths.filter(q=>q.pts.length>2).every(q=>q.layer===3) && twoPens[0].paths[0].layer===3, "separate hatch pen leaves source and outlines alone");
check(run({ fill: "Cross hatch", style: "Pointed" })[1].paths.some(q=>q.pts.length===2), "pointed drops can be filled");
check(sig(run({ fill: "Cross hatch", style: "Thread" })) === sig(run({ style: "Thread" })), "Thread has no filled area");
check(sig(run({ hatchSpacing: .5, hatchAngle: 10, hatchOwnPen: true, hatchPen: 9 })) === sig(run()), "old unfilled patches remain unchanged");
check(def.params.find(x=>x.key==="fill").showIf({style:"Round"}) && !def.params.find(x=>x.key==="fill").showIf({style:"Thread"}), "fill controls follow shape mode");
const clipped = run({ length: 100, variation: 100, margin: 12, density: 100 }, line)[1];
check(clipped.paths.every(q => q.pts.every(([x,y]) => x >= 12 && x <= 285 && y >= 12 && y <= 198)), "drips clip to margin");
const clippedHatch = run({ fill: "Cross hatch", length: 100, variation: 100, margin: 12, density: 100 }, line)[1];
check(clippedHatch.paths.every(q => q.pts.every(([x,y]) => x >= 12-1e-6 && x <= 285+1e-6 && y >= 12-1e-6 && y <= 198+1e-6)), "cross hatch respects drip clipping");
check(def.overlay(defaults, context).some(q => q.kind === "rect") && def.overlay(defaults, context).some(q => q.kind === "arrow"), "margin and flow guides");
check(def.overlay(defaults, {}).length === 0 && run({}, line, { W: Infinity, H: 210 })[0].paths.length === 0, "invalid canvas handled");
check(run({}, { paths: [{ pts: [[NaN, 0], [20, 0]], closed: false, layer: 0 }] })[0].paths.length === 0, "bad coordinates rejected whole");
check(run({ density: 100, spacing: 2 }, { paths: [{ pts: [[0, 0], [100000, 0]], closed: false, layer: 0 }] })[1].paths.length === 0, "oversized request rejected whole");
const overfilled = run({ fill: "Cross hatch", hatchSpacing: .35, spacing: 2, density: 100, length: 250, width: 50, variation: 0, sway: 0, clip: false },
  { paths: [{ pts: [[20, 70], [1200, 70]], closed: false, layer: 0 }] }, { W: 1400, H: 800 });
check(overfilled[0].paths.length === 0 && overfilled[1].paths.length === 0, "excessive cross hatch rejects whole drawing");
console.log(`${checks} Drip checks passed`);
