import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Pin, EMPTY } from "../src/defs/helpers.js";
import adaptiveGrid from "../src/defs/nodes/adaptive_grid.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let def;
try { def = (await import(resolve(root, "src/defs/nodes/colour_neighbours.js"))).default; }
catch { def = new Function("Pin", "EMPTY", `return ${await readFile(resolve(root, "nodes-lab/colour_neighbours.plotternode.js"), "utf8")}`)(Pin, EMPTY); }
assert.equal(def.key, "colour_neighbours");
assert.equal(def.ins[0].type, "paths");
assert.equal(def.outs.length, 2);
const p = Object.fromEntries(def.params.map(q => [q.key, q.def]));
const sq = (x, y, size = 10) => ({ pts: [[x, y], [x + size, y], [x + size, y + size], [x, y + size]], closed: true, layer: 9 });
const four = { paths: [sq(0, 0), sq(10, 0), sq(0, 10), sq(10, 10)] };
assert.deepEqual(def.compute([EMPTY], p), [EMPTY, EMPTY]);
const colored = def.compute([four], p);
assert.equal(colored[0].paths.length, 4);
assert.equal(new Set(colored[0].paths.map(q => q.layer)).size, 4);
assert.equal(colored[1].paths.length, 0);
for (let i = 0; i < 4; i++) { assert.equal(colored[0].paths[i].pts, four.paths[i].pts); assert.equal(colored[0].paths[i].closed, true); }
assert.deepEqual(def.compute([four], p), colored);
const two = def.compute([four], { ...p, colors: 2, pen1: 3, pen2: 7 });
assert.ok(two[0].paths.every(q => q.layer === 3 || q.layer === 7));
assert.ok(two[1].paths.length > 0);
const open = { pts: [[20, 25], [33, 36]], closed: false, layer: 11 };
const mixed = def.compute([{ paths: [...four.paths, open] }], p);
assert.equal(mixed[0].paths[4], open);
const apart = { paths: [sq(0, 0), sq(11, 0)] };
assert.equal(def.compute([apart], { ...p, pen2: 0, colors: 2, touch: 0 })[1].paths.length, 0);
assert.equal(def.compute([apart], { ...p, pen2: 0, colors: 2, touch: 1.1 })[1].paths.length, 1);
const nested = { paths: [sq(0, 0, 30), sq(10, 10, 5)] };
assert.equal(def.compute([nested], { ...p, colors: 2 })[1].paths.length, 0);
assert.notEqual(...def.compute([nested], { ...p, colors: 2 })[0].paths.map(q => q.layer));
const huge = { paths: Array.from({ length: 2201 }, (_, i) => sq(i * 20, 0)) };
assert.equal(def.compute([huge], p)[0].paths, huge.paths);
const gridP = Object.fromEntries(adaptiveGrid.params.map(q => [q.key, q.def]));
const cells = adaptiveGrid.compute([EMPTY, undefined], { ...gridP, levels: 2, minCell: 10, maxCell: 35 }, { W: 210, H: 148 })[1];
assert.ok(cells.paths.length > 4);
const gridColored = def.compute([cells], p);
assert.equal(gridColored[0].paths.length, cells.paths.length);
assert.equal(gridColored[1].paths.length, 0);
assert.ok(gridColored[0].paths.every((q, i) => q.pts === cells.paths[i].pts));
console.log(`Colour Neighbours validated: ${gridColored[0].paths.length} real Adaptive Grid cells, exact geometry, deterministic colouring, conflicts and limits.`);
