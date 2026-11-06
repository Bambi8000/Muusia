import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Pin } from "../src/defs/helpers.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lab = resolve(root, "nodes-lab/image_compare.plotternode.js");
const baked = resolve(root, "src/defs/nodes/image_compare.js");
let def;
try { def = (await import(baked)).default; }
catch { def = new Function("Pin", `return ${await readFile(lab, "utf8")}`)(Pin); }
assert.equal(def.key, "image_compare");
assert.equal(def.fileImage, true);
assert.equal(def.params.find(q => q.key === "file")?.type, "file");
assert.equal(def.params.find(q => q.key === "file2")?.type, "file");
assert.deepEqual(def.fileImageSlots, { file: "img", file2: "img2" });
assert.deepEqual(def.fileButtonLabels, { file: "Choose image A…", file2: "Choose image B…" });
assert.equal(def.outs.length, 5);
const defaults = Object.fromEntries(def.params.map(q => [q.key, q.def]));
const img = { w: 96, h: 72, g: Array.from({ length: 96 * 72 }, (_, i) => {
  const x = i % 96, y = Math.floor(i / 96);
  const circle = ((x - 31) ** 2 / 28 ** 2 + (y - 37) ** 2 / 27 ** 2) < 1;
  const bar = x > 58 && x < 83 && y > 11 && y < 62;
  return circle ? 0.3 + 0.7 * x / 96 : bar ? 0.9 : 0;
}) };
const node = { data: { img } };
const imgB = { w: 64, h: 64, g: Array.from({ length: 64 * 64 }, (_, i) => {
  const x = i % 64, y = Math.floor(i / 64);
  return (x + y) % 16 < 8 && x > 9 && x < 54 && y > 9 && y < 54 ? 0.95 : 0;
}) };
let checks = 0;
function validate(out, W, H) {
  assert.equal(out.length, 5); checks++;
  const all = out[0].paths, union = out.slice(1).flatMap(q => q.paths);
  assert.equal(all.length, union.length); checks++;
  for (let i = 0; i < all.length; i++) { assert.equal(all[i], union[i]); checks++; }
  for (const path of all) {
    assert.ok(Array.isArray(path.pts) && path.pts.length >= 2); checks++;
    assert.ok(Number.isInteger(path.layer) && path.layer >= 0 && path.layer <= 11); checks++;
    for (const [x, y] of path.pts) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= -1e-8 && x <= W + 1e-8 && y >= -1e-8 && y <= H + 1e-8); checks++;
    }
  }
}
const zero = def.compute([], defaults, { W: 420, H: 297 }, {});
assert.equal(zero.length, 5); assert.ok(zero.every(q => q.paths.length === 0)); checks += 2;
const base = def.compute([], defaults, { W: 420, H: 297 }, node);
validate(base, 420, 297);
assert.ok(base.slice(1).every(q => q.paths.length > 0)); checks++;
const twice = def.compute([], defaults, { W: 420, H: 297 }, node);
assert.deepEqual(twice, base); checks++;
const both = def.compute([], defaults, { W: 420, H: 297 }, { data: { img, img2: imgB } });
validate(both, 420, 297);
assert.deepEqual(both[1], base[1]); checks++;
assert.deepEqual(both[3], base[3]); checks++;
assert.notDeepEqual(both[2], base[2]); checks++;
assert.notDeepEqual(both[4], base[4]); checks++;
const onlyB = def.compute([], defaults, { W: 420, H: 297 }, { data: { img2: imgB } });
validate(onlyB, 420, 297);
assert.deepEqual(onlyB[2], both[2]); checks++;
assert.deepEqual(onlyB[4], both[4]); checks++;
assert.notDeepEqual(onlyB[1], both[1]); checks++;
const badB = def.compute([], defaults, { W: 420, H: 297 }, { data: { img, img2: { w: 1, h: 1, g: [] } } });
assert.deepEqual(badB, base); checks++;
const oldStyles = def.compute([], { ...defaults, styleA: "Flow", styleB: "Straight", styleC: "Facets", styleD: "Spiral" }, { W: 420, H: 297 }, node);
assert.ok(oldStyles.slice(1).every(q => q.paths.length > 0)); checks++;
const two = def.compute([], { ...defaults, layout: "Two", frame: false, penA: 2, penB: 4 }, { W: 297, H: 210 }, node);
validate(two, 297, 210);
assert.ok(two[2].paths.every(q => q.layer === 4)); checks++;
assert.ok(two[1].paths.every(q => q.layer === 2)); checks++;
assert.ok(two[3].paths.length === 0 && two[4].paths.length === 0); checks++;
const alternate = def.compute([], { ...defaults, styleA: "Spiral", styleD: "Flow", spacing: 3, contrast: 2.5 }, { W: 420, H: 297 }, node);
validate(alternate, 420, 297);
assert.notDeepEqual(alternate[1], base[1]); checks++;
assert.notDeepEqual(alternate[4], base[4]); checks++;
const tiny = def.compute([], defaults, { W: 25, H: 25 }, node);
assert.ok(tiny.every(q => q.paths.length === 0)); checks++;
for (const [W, H, p] of [[210, 297, { spacing: 0.8, margin: 0 }], [594, 420, { spacing: 4, gutter: 30, frame: false }], [297, 210, { styleB: "Spiral", styleC: "Straight", cutoff: 0.4 }]]) {
  validate(def.compute([], { ...defaults, ...p }, { W, H }, node), W, H);
}
console.log(`Image Compare validated: ${checks} checks.`);
