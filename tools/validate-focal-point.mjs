import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Pin } from "../src/defs/helpers.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let def;
try { def = (await import(resolve(root, "src/defs/nodes/focal_point.js"))).default; }
catch { def = new Function("Pin", `return ${await readFile(resolve(root, "nodes-lab/focal_point.plotternode.js"), "utf8")}`)(Pin); }
assert.equal(def.key, "focal_point");
assert.equal(def.cat, "math");
assert.ok(def.outs.every(q => q.type === "value"));
const p = Object.fromEntries(def.params.map(q => [q.key, q.def]));
assert.deepEqual(def.compute([], p, { W: 420, H: 297 }), [50, 50, 210, 148.5, 95]);
assert.deepEqual(def.compute([], { ...p, x: 20, y: 80, radius: 0 }, { W: 297, H: 210 }), [20, 80, 59.4, 168, 0]);
assert.deepEqual(def.compute([], { ...p, x: -50, y: 500, radius: -1 }, { W: 200, H: 100 }), [0, 100, 0, 100, 0]);
assert.ok(def.compute([], p, {}) .every(Number.isFinite));
const guide = def.overlay({ ...p, x: 20, y: 80 }, { W: 200, H: 100 });
assert.deepEqual(guide[0], { kind: "point", x: 40, y: 80 });
assert.deepEqual(guide[1], { kind: "circle", cx: 40, cy: 80, r: 95 });
assert.deepEqual(def.overlay(p, {}), []);
console.log("Focal Point validated: value outputs, clamping, millimetres and guides.");
