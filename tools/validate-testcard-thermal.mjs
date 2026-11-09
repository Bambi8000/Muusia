import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import testcard from "../src/defs/nodes/testcard.js";

const defaults = Object.fromEntries(testcard.params.map(param => [param.key, param.def]));
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const legacy = testcard.compute([], defaults, { W: 297, H: 210 });
assert.equal(legacy.paths.length, 577);
assert.equal(hash(legacy), "ab833507d7ca52b62aaa8be60c9555a46e29cc5594f3c576e4219c841b12a3f6");

const params = { ...defaults, mode: "Thermal receipt" };
const card = testcard.compute([], params, { W: 72, H: 100 });
assert.equal(hash(card), hash(testcard.compute([], params, { W: 72, H: 100 })));
assert(card.paths.length > 3000 && card.paths.length < 10000);
let points = 0;
for (const path of card.paths) {
  assert(path.pts.length >= 2);
  for (const [x, y] of path.pts) {
    assert(Number.isFinite(x) && Number.isFinite(y));
    assert(x >= 0 && x <= 72 && y >= 0 && y <= 100);
    points++;
  }
}
assert(points < 120000);

const swatchDots = Array.from({ length: 5 }, (_, index) => {
  const left = 4 + index * 13;
  return card.paths.filter(path => path.pts.length === 2 && path.pts.every(([x, y]) => x > left + 0.1 && x < left + 10.9 && y > 53.1 && y < 64.9)).length;
});
assert.equal(swatchDots[0], 0);
for (let i = 1; i < swatchDots.length; i++) assert(swatchDots[i] > swatchDots[i - 1]);
assert(card.paths.some(path => path.pts.length > 100 && path.pts.every(([, y]) => y > 30 && y < 48)));

const small = testcard.compute([], params, { W: 58, H: 70 });
for (const path of small.paths) for (const [x, y] of path.pts) assert(x >= 0 && x <= 58 && y >= 0 && y <= 70);
assert(testcard.compute([], params, { W: 0, H: 100 }).paths.length === 0);
assert(testcard.compute([], { ...params, layer: 3 }, { W: 72, H: 100 }).paths.every(path => path.layer === 3));

console.log(`ok   Test Card thermal receipt: ${card.paths.length} paths, ${points} points, halftone dots ${swatchDots.join("/")}; legacy card unchanged`);
