import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import ribbon from "../src/defs/nodes/ribbon.js";
import kaisla from "../src/defs/nodes/kaisla.js";
import { applyStyle, pathLength } from "../src/defs/helpers.js";
import { EXAMPLES } from "../src/examples.js";

const defaults = n => Object.fromEntries(n.params.map(p => [p.key, p.def]));
const run = (n, overrides = {}, ctx = { W: 80, H: 3000 }, ins = []) => n.compute(ins, { ...defaults(n), ...(n === ribbon ? { shape: "Long" } : {}), ...overrides }, ctx);
const hash = x => createHash("sha256").update(JSON.stringify(x)).digest("hex");
let cases = 0;
function valid(n, p = {}, ctx = { W: 80, H: 3000 }) {
  const r = run(n, p, ctx), m = Number.isFinite(p.margin) ? p.margin : defaults(n).margin;
  let points = 0;
  assert.ok(r.paths.length, `${n.key}: nonempty`);
  for (const path of r.paths) {
    assert.ok(path.pts.length >= (path.closed ? 3 : 2));
    assert.ok(Number.isInteger(path.layer) && path.layer >= 0 && path.layer < 12);
    assert.ok(pathLength(path.pts, path.closed) > 1e-8);
    for (const [x, y] of path.pts) {
      points++;
      assert.ok(Number.isFinite(x) && Number.isFinite(y), "finite coordinates");
      assert.ok(x >= m - 1e-7 && x <= ctx.W - m + 1e-7 && y >= m - 1e-7 && y <= ctx.H - m + 1e-7, `${n.key}: within margins (${x},${y})`);
    }
  }
  assert.ok(points <= (n === ribbon ? 100000 : 120000), `${n.key}: ${points} point budget`);
  assert.equal(hash(r), hash(run(n, p, ctx)), "seeded determinism");
  cases++;
  return r;
}
for (const length of [1000, 3000, 10000]) for (const orientation of ["Vertical", "Horizontal"]) {
  const ctx = orientation === "Vertical" ? { W: 80, H: length } : { W: length, H: 80 };
  for (const longForm of ["Line", "Pleated", "Channels"]) for (const pocketFill of longForm === "Channels" ? ["Open", "Outline", "Hatch"] : ["Open"]) {
    const r = valid(ribbon, { orientation, longForm, pocketFill }, ctx);
    const axis = orientation === "Vertical" ? 1 : 0;
    for (const path of r.paths.slice(0, defaults(ribbon).lines)) {
      assert.equal(path.pts[0][axis], 12);
      assert.equal(path.pts.at(-1)[axis], length - 12, "every filament reaches the far end");
    }
  }
  for (const head of ["None", "Feathery", "Cattail"]) valid(kaisla, { orientation, head, leafVeins: true }, ctx);
}
for (const n of [ribbon, kaisla]) {
  for (const ctx of [{ W: 10, H: 1000 }, { W: 18, H: 10000 }, { W: 80, H: 100000 }, { W: 10000, H: 58 }]) {
    valid(n, { margin: 0, seed: 0, lines: 200, count: 60, width: 400, wander: 300, ripple: 8, pitch: 0.15, bendLength: 20, swellLength: 20, foldLength: 20, pocketSpacing: 20, longForm: "Channels", pocketFill: "Hatch", leafWidth: 20, leafLength: 10, leafVeins: true, headWidth: 20, head: "Cattail", sway: 200, lean: 200 }, ctx);
  }
  assert.deepEqual(run(n, { margin: 40 }, { W: 80, H: 1000 }).paths, [], "empty margins");
  assert.deepEqual(run(n, {}, { W: 0, H: 1000 }).paths, [], "empty canvas");
  valid(n, Object.fromEntries(n.params.filter(p => ["slider", "pen", "seed"].includes(p.type)).map(p => [p.key, NaN])));
  assert.equal(new Set(n.params.map(p => p.key)).size, n.params.length);
  for (const p of n.params.filter(p => p.options)) assert.ok(p.options.includes(p.def));
  const base = run(n), before = structuredClone(base);
  assert.notEqual(hash(base), hash(run(n, { seed: 99 })), "seed changes drawing");
  const style = { kind: "style", mode: "Dashed", dash: 2, gap: 1, vary: 0, phase: 0, seed: 2 };
  assert.deepEqual(run(n, {}, undefined, [style]), applyStyle(base, style), "real Style helper");
  assert.deepEqual(base, before, "results are not mutated");
}
const geometry = r => r.paths.map(({ pts, closed }) => ({ pts, closed }));
assert.deepEqual(geometry(run(ribbon, { colours: 1 })), geometry(run(ribbon, { colours: 6 })), "Ribbon pens do not move strokes");
assert.deepEqual(geometry(run(kaisla, { layer: 5, detailPen: 7 })), geometry(run(kaisla)), "Kaisla pens do not move strokes");
// Verify physical dimensions independently: an untapered straight ribbon keeps
// a 10 mm width and the complete drawable length as the canvas grows.
for (const H of [1024, 3024]) {
  const r = run(ribbon, { longForm: "Line", width: 10, wander: 0, ripple: 0, taper: 0, widthVar: 0, lines: 2 }, { W: 80, H });
  for (const path of r.paths) assert.ok(Math.abs(pathLength(path.pts, false) - (H - 24)) < 1e-7);
  const xs = r.paths.map(p => p.pts[0][0]);
  assert.equal(xs[1] - xs[0], 10, "physical width survives length changes");
}
const one = run(ribbon, { longForm: "Line", margin: 5, taper: 0, lines: 2, width: 10, wander: 0, ripple: 0, swellLength: 200 }, { W: 80, H: 1010 });
const three = run(ribbon, { longForm: "Line", margin: 5, taper: 0, lines: 2, width: 10, wander: 0, ripple: 0, swellLength: 200 }, { W: 80, H: 3010 });
const at = (r, y) => {
  const pts = r.paths[0].pts, i = pts.findIndex(q => q[1] >= y), a = pts[Math.max(0, i - 1)], b = pts[i];
  return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
};
for (const y of [105, 305, 505, 705]) assert.ok(Math.abs(at(one, y) - at(three, y)) < 0.002, "swells keep their physical period");
// A narrow canvas and a large lean still retain requested stem height.
const straight = run(kaisla, { count: 1, length: 100, lengthVar: 0, sway: 0, roughness: 0, lean: 200, leaves: false, joints: false, head: "None" });
for (const path of straight.paths) assert.ok(Math.abs(path.pts[0][1] - path.pts.at(-1)[1]) > 2980, "lean never shortens stems");
assert.deepEqual(run(kaisla, { leaves: false, leafLength: 10, leafWidth: 12, leafVeins: true }), run(kaisla, { leaves: false }), "inactive leaf controls");
assert.deepEqual(run(ribbon, { longForm: "Line", foldLength: 20, pocketSpacing: 20, pocketFill: "Hatch" }), run(ribbon, { longForm: "Line" }), "inactive long-form controls");
for (const ex of EXAMPLES.filter(ex => /^(Ribbon · One metre|Kaisla ·)/.test(ex.name))) {
  const graph = ex.make(type => defaults(type === "kaisla" ? kaisla : ribbon));
  for (const node of graph.nodes) valid(node.type === "kaisla" ? kaisla : ribbon, node.params, ex.canvas);
}
console.log(`Long rolls: ${cases} geometry cases pass; full lengths, narrow margins, budgets, physical scale, pens, Style and Help examples verified.`);
