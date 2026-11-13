import assert from "node:assert/strict";
import fs from "node:fs";
import { Pin } from "../src/defs/helpers.js";
import baked from "../src/defs/nodes/surface-context.js";
const defs = [baked];
if (fs.existsSync('nodes-lab/surface-context.plotternode.js')) defs.push(Function('Pin', 'return ' + fs.readFileSync('nodes-lab/surface-context.plotternode.js', 'utf8'))(Pin));
for (const def of defs) {
  assert.equal(def.outs.length, 11);
  assert.deepEqual(def.compute([], {}, { W: 80, H: 200 }), [1,1,1,40,100,0,80,200,0,1,0]);
  const surface = { number: 4, printRank: 2, count: 3, centerXmm: -20, centerYmm: 135, rotationDeg: 270, widthMm: 80, lengthMm: 2000, distanceMm: 452, seed: 4294967295, t: .5 };
  assert.deepEqual(def.compute([], {}, { W:80,H:2000,surface }), Object.values(surface));
}
console.log('Surface Context prototype and built-in contract passed.');
