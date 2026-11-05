import assert from "node:assert/strict";
import N from "../src/defs/nodes/reaction_labyrinth.js";

const defaults = Object.fromEntries(N.params.map(q => [q.key, q.def]));
const ctx = { W: 210, H: 297 };
const run = (params = {}, canvas = ctx) => N.compute([], { ...defaults, ...params }, canvas);
const total = r => r.paths.reduce((n, q) => n + q.pts.length, 0);
const json = r => JSON.stringify(r);
let checks = 0;
const ok = (x, why) => { assert.ok(x, why); checks++; };

ok(N.key === "reaction_labyrinth" && N.cat === "gen" && N.group === "organic", "built-in identity");
ok(defaults.mode === "Continuous path", "continuous mode is default");
for (const mode of ["Continuous path", "Separate contours"]) {
  const r = run({ mode });
  ok(r.paths.length > 0, `${mode}: paths exist`);
  ok(total(r) < 112000, `${mode}: bounded output`);
  ok(r.paths.every(q => q.pts.length >= 2 && q.layer === 0), `${mode}: valid pen paths`);
  ok(r.paths.every(q => q.pts.every(pt => pt.length === 2 && pt.every(Number.isFinite))), `${mode}: finite coordinates`);
  ok(r.paths.every(q => q.pts.every(([x, y]) => x >= 0 && x <= ctx.W && y >= 0 && y <= ctx.H)), `${mode}: fits page`);
  ok(json(r) === json(run({ mode })), `${mode}: deterministic`);
}
const one = run();
ok(one.paths.length === 1 && !one.paths[0].closed, "one continuous open path");
ok(one.paths[0].pts.length > 2000, "one path is smooth and long");
const radial = one.paths[0].pts.map(([x, y]) => Math.hypot(x - 105, y - 148.5));
ok(radial[0] > radial.at(-1) * 4, "continuous path travels from rim inward");
const stride = Math.round((radial.length - 1) / defaults.turns);
ok(radial.slice(0, radial.length - stride).every((r, i) => i % 23 || r > radial[i + stride]), "successive turns advance inward without crossing");
const many = run({ mode: "Separate contours" });
ok(many.paths.length > 10 && many.paths.every(q => q.closed), "separate mode makes many closed loops");
ok(json(one) !== json(many), "modes differ");
ok(json(run({ turns: 5 })) !== json(one), "turns changes continuous geometry");
ok(json(run({ meander: 0 })) !== json(one), "meander changes continuous geometry");
ok(json(run({ mode: "Separate contours", threshold: 0.1 })) !== json(many), "threshold changes contours");
ok(total(run({ mode: "Separate contours", bands: 3 })) > total(many), "bands adds contour lines");
ok(json(run({ evolution: 0.1 })) !== json(one), "evolution changes field-guided line");
ok(json(run({ scale: 12, mode: "Separate contours" })) !== json(many), "pattern scale changes contours");
ok(json(run({ seed: 99 })) !== json(one), "seed changes continuous geometry");
ok(json(run({ seed: 99, mode: "Separate contours" })) !== json(many), "seed changes contours");
ok(run({ layer: 6 }).paths.every(q => q.layer === 6), "pen choice used");
ok(total(run({ diameter: 80 })) > 0 && json(run({ diameter: 80 })) !== json(one), "diameter changes placement");
ok(json(run({ cx: 35 })) !== json(one) && json(run({ cy: 65 })) !== json(one), "centre controls change placement");
for (const mode of ["Continuous path", "Separate contours"]) {
  const r = run({ mode, diameter: 500, margin: 20, bands: 3 }, { W: 110, H: 90 });
  ok(r.paths.every(q => q.pts.every(([x, y]) => x >= 20 && x <= 90 && y >= 20 && y <= 70)), `${mode}: fit and margin on small page`);
}
ok(run({}, { W: 0, H: 0 }).paths.length === 0, "degenerate page stays empty");
ok(N.overlay(defaults, ctx).some(q => q.kind === "circle"), "size guide shown");
for (const key of ["turns", "meander", "threshold", "bands"]) {
  ok(typeof N.params.find(q => q.key === key)?.showIf === "function", `${key}: mode-specific control`);
}
console.log(`${checks} Reaction Labyrinth checks passed`);
