import knot from "../src/defs/nodes/mathknot.js";
import rose from "../src/defs/nodes/fmrose.js";
import attr from "../src/defs/nodes/attractor.js";

const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const P = (def, o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const CTX = { W: 300, H: 200 };
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));

{ /* knot: torus only; legacy Lissajous params tolerated */
  if (knot.params.some((q) => ["type", "fz", "seed"].includes(q.key))) die("knot legacy params still present");
  const a = knot.compute([undefined], P(knot, {}), CTX);
  const b = knot.compute([undefined], P(knot, {}), CTX);
  if (!finiteAll(a) || !a.paths.length) die("knot invalid");
  if (JSON.stringify(a) !== JSON.stringify(b)) die("knot non-deterministic");
  const legacy = knot.compute([undefined], Object.assign(P(knot, {}), { type: "Lissajous", fz: 7, seed: 5 }), CTX);
  if (!finiteAll(legacy) || !legacy.paths.length) die("knot chokes on legacy patch params");
  console.log("knot OK (torus only, gap cuts " + a.paths.length + " strands, legacy params ignored)");
}
{ /* fmrose: pen cycling */
  const one = rose.compute([undefined], P(rose, { rings: 6, pens: 1, layer: 2 }), CTX);
  if (new Set(one.paths.map((pa) => pa.layer)).size !== 1) die("fmrose pens=1 should be single pen");
  const cyc = rose.compute([undefined], P(rose, { rings: 6, pens: 3, layer: 2 }), CTX);
  const layers = [...new Set(cyc.paths.map((pa) => pa.layer))].sort((a, b) => a - b);
  if (layers.join(",") !== "2,3,4") die("fmrose cycle wrong: " + layers.join(","));
  if (!finiteAll(cyc)) die("fmrose invalid");
  console.log("fmrose OK (rings cycle pens " + layers.join("/") + ")");
}
{ /* attractor: lorenz planes + param liveness + legacy type string */
  const run = (o) => attr.compute([undefined], P(attr, { type: "Lorenz", iters: 4000, ...o }), CTX);
  for (const plane of ["x-z", "x-y", "y-z"]) {
    const a = run({ plane }), b = run({ plane });
    if (!finiteAll(a) || !a.paths.length) die("lorenz " + plane + " invalid");
    if (JSON.stringify(a) !== JSON.stringify(b)) die("lorenz " + plane + " non-deterministic");
  }
  if (JSON.stringify(run({ plane: "x-z" })) === JSON.stringify(run({ plane: "x-y" }))) die("plane has no effect");
  if (JSON.stringify(run({ b: 0 })) === JSON.stringify(run({ b: 2 }))) die("sigma (b) has no effect");
  if (JSON.stringify(run({ c: 0 })) === JSON.stringify(run({ c: 2 }))) die("beta (c) has no effect");
  if (JSON.stringify(run({ d: 0 })) === JSON.stringify(run({ d: 2 }))) die("dt (d) has no effect");
  const legacy = attr.compute([undefined], P(attr, { type: "Lorenz (x-z)", iters: 4000 }), CTX);
  if (!finiteAll(legacy) || !legacy.paths.length) die("legacy 'Lorenz (x-z)' type string broken");
  const cliff = attr.compute([undefined], P(attr, {}), CTX);
  if (!finiteAll(cliff)) die("clifford regression");
  console.log("attractor OK (3 planes live, b/c/d live, legacy type string works)");
}
console.log("era 1 valid");