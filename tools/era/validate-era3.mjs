import turtle from "../src/defs/nodes/turtle.js";
import grav from "../src/defs/nodes/gravity_cascade.js";
import card from "../src/defs/nodes/testcard.js";

const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const P = (def, o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const CTX = { W: 300, H: 200 };
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));

{ /* turtle presets */
  const run = (o) => turtle.compute([undefined], P(turtle, o), CTX);
  const presets = turtle.params.find((q) => q.key === "preset").options.slice(1);
  if (presets.length !== 8) die("expected 8 presets, got " + presets.length);
  const custom = run({});
  if (!finiteAll(custom) || !custom.paths.length) die("custom program broken");
  const sigs = new Set([JSON.stringify(custom)]);
  for (const preset of presets) {
    const a = run({ preset }), b = run({ preset });
    if (!finiteAll(a) || !a.paths.length) die("preset '" + preset + "' invalid");
    if (JSON.stringify(a) !== JSON.stringify(b)) die("preset '" + preset + "' non-deterministic");
    sigs.add(JSON.stringify(a));
  }
  if (sigs.size < presets.length) die("some presets draw identical output");
  console.log("turtle OK (8 presets, all distinct, custom intact)");
}
{ /* gravity cascade */
  const run = (o) => grav.compute([undefined], P(grav, o), CTX);
  const sigs = new Map();
  for (const wells of ["Triangle", "Line", "Ring", "Center + ring", "Random"]) {
    const a = run({ wells }), b = run({ wells });
    if (!finiteAll(a) || a.paths.length < 3) die("wells '" + wells + "' invalid");
    if (JSON.stringify(a) !== JSON.stringify(b)) die("wells '" + wells + "' non-deterministic");
    for (const pa of a.paths) for (const [x, y] of pa.pts) {
      if (x < 8 - 0.01 || x > 292.01 || y < 8 - 0.01 || y > 192.01) die("wells '" + wells + "' leaks outside margin");
    }
    sigs.set(wells, JSON.stringify(a));
  }
  if (new Set(sigs.values()).size !== 5) die("some wells layouts identical");
  const l1 = run({ launch: "Top rain" }), l2 = run({ launch: "Spiral" });
  if (!finiteAll(l1) || !finiteAll(l2)) die("launch modes invalid");
  if (JSON.stringify(l1) === JSON.stringify(sigs.get("Triangle"))) die("launch has no effect");
  console.log("gravity OK (5 wells layouts distinct, launches live, all inside margin)");
}
{ /* test card */
  const run = (o, ctx2) => card.compute([undefined], P(card, o), ctx2 || CTX);
  const pal = run({ tests: ["Pen palette (12)"], cols: 1 });
  const layers = new Set(pal.paths.map((pa) => pa.layer));
  for (let i = 0; i < 12; i++) if (!layers.has(i)) die("pen palette misses pen " + i);
  if (!finiteAll(pal)) die("pen palette invalid");
  /* auto-fit: 8 tests, 2 cols, big cell on a small sheet must stay inside */
  const small = run({ tests: card.params.find((q) => q.key === "tests").options.slice(0, 8), cols: 2, cell: 120 }, { W: 210, H: 148 });
  for (const pa of small.paths) for (const [x, y] of pa.pts) {
    if (x < -0.5 || x > 210.5 || y < -0.5 || y > 152) die("grid overflows A5 (" + x.toFixed(1) + "," + y.toFixed(1) + ")");
  }
  console.log("testcard OK (12 pens present, grid auto-fits A5)");
}
console.log("era 3 valid");