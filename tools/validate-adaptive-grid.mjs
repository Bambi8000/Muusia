import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Pin, EMPTY, noise2, applyStyle } from "../src/defs/helpers.js";

const built = new URL("../src/defs/nodes/adaptive_grid.js", import.meta.url);
const lab = new URL("../nodes-lab/adaptive_grid.plotternode.js", import.meta.url);
const def = fs.existsSync(built)
  ? (await import(built.href + `?t=${Date.now()}`)).default
  : vm.runInNewContext(fs.readFileSync(lab, "utf8"), { Pin, EMPTY, noise2, applyStyle, Math, Number, Array, Map, Set });
const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const context = { W: 297, H: 210 };
const run = (p = {}, input, style, c = context) => def.compute([input, style], { ...defaults, ...p }, c);
const signature = x => JSON.stringify(x);
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const valid = (value, ctx = context, margin = 12) => value.paths.every(path =>
  Number.isInteger(path.layer) && path.layer >= 0 && path.layer <= 11 &&
  path.pts.length >= (path.closed ? 3 : 2) &&
  path.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) &&
    x >= margin - 1e-5 && x <= ctx.W - margin + 1e-5 &&
    y >= margin - 1e-5 && y <= ctx.H - margin + 1e-5));
const cells = (p = {}, input) => run(p, input)[1].paths;
const leftCells = paths => paths.filter(q => (q.pts[0][0] + q.pts[1][0]) / 2 < context.W / 2);
const rightCells = paths => paths.filter(q => (q.pts[0][0] + q.pts[1][0]) / 2 >= context.W / 2);

check(def.key === "adaptive_grid" && def.cat === "gen" && def.group === "geometric", "registry metadata");
check(def.ins[0].type === "paths" && def.ins[1].type === "style" && def.outs.length === 2 && def.outs.every(p => p.type === "paths"), "path/style inputs and two path outputs");
const [grid, regions] = run();
check(grid.paths.length > 0 && regions.paths.length > 0, "both outputs draw by default");
check(valid(grid) && valid(regions), "finite, bounded coordinates and valid pens");
check(grid.paths.every(q => !q.closed && q.pts.length === 2) && regions.paths.every(q => q.closed && q.pts.length === 4), "open edges and closed rectangles");
check(signature(run()) === signature([grid, regions]), "default output deterministic");
check(cells({ detail: 0 }).length < regions.paths.length, "detail increases cell count");
check(cells({ levels: 0 }).length === cells({ detail: 0 }).length, "zero levels remains coarse");
check(cells({ maxCell: 18, detail: 0 }).length > cells({ maxCell: 80, detail: 0 }).length, "max cell sets coarse spacing");
check(cells({ minCell: 20 }).length < regions.paths.length, "min cell bounds refinement");
check(cells({ radius: 25 }).length < cells({ radius: 130 }).length, "radius changes refined area");
check(signature(run({ focusX: 15, focusY: 20 })) !== signature(run()), "focus point moves detail");
check(leftCells(cells({ focusX: 20 })).length > rightCells(cells({ focusX: 20 })).length, "left focus refines left side");
check(signature(run({ source: "Noise" })) === signature(run({ source: "Noise" })), "seeded field deterministic");
check(signature(run({ source: "Noise", seed: 7 })) !== signature(run({ source: "Noise", seed: 31 })), "noise seed changes geometry");
check(signature(run({ source: "Noise", fieldSize: 25 })) !== signature(run({ source: "Noise", fieldSize: 100 })), "noise scale changes geometry");
const wire = { paths: [{ pts: [[38, 15], [38, 195]], closed: false, layer: 3 }] };
const inputParams = { source: "Input drawing", radius: 65 };
check(cells(inputParams, wire).length > cells(inputParams).length, "unwired input is coarse; drawing refines");
check(leftCells(cells(inputParams, wire)).length > rightCells(cells(inputParams, wire)).length, "input drawing attracts detail");
check(signature(wire) === signature({ paths: [{ pts: [[38, 15], [38, 195]], closed: false, layer: 3 }] }), "input path remains unchanged");
check(valid(run(inputParams, wire)[0]) && valid(run(inputParams, wire)[1]), "input-driven geometry fits margin");
const style = { kind: "style", mode: "Dashed", dash: 3, gap: 2, vary: 0, phase: 0, seed: 1 };
const styled = run({}, undefined, style);
check(styled[0].paths.length > grid.paths.length && styled[1].paths.length > regions.paths.length, "Style applies to both outputs");
check(run({ layer: 9 })[0].paths.every(q => q.layer === 9) && run({ layer: 9 })[1].paths.every(q => q.layer === 9), "pen applies to both outputs");
check(run({ layer: 99 })[0].paths.every(q => q.layer === 11), "pen clamps to available range");
const edgeGroups = new Map();
for (const path of grid.paths) {
  const [[x0,y0],[x1,y1]] = path.pts;
  const key = y0 === y1 ? `h:${y0}` : `v:${x0}`;
  const a = y0 === y1 ? x0 : y0, b = y0 === y1 ? x1 : y1;
  if (!edgeGroups.has(key)) edgeGroups.set(key, []);
  edgeGroups.get(key).push([a,b]);
}
check([...edgeGroups.values()].every(group => group.sort((a,b)=>a[0]-b[0]).every((q,i)=> i === 0 || q[0] > group[i-1][1] + 1e-6)), "grid edges do not overlap or double plot");
check(run({}, undefined, undefined, { W: Infinity, H: 210 })[0].paths.length === 0, "invalid paper returns empty");
check(run({ margin: 60 }, undefined, undefined, { W: 100, H: 100 })[0].paths.length === 0, "collapsed margin returns empty");
check(def.overlay(defaults, context).some(g => g.kind === "circle") && def.overlay(defaults, {})?.length === 0, "focus and margin guides");
console.log(`${checks} Adaptive Grid checks passed`);
