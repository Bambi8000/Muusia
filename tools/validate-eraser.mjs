import fs from "fs";
const code = fs.readFileSync("nodes-lab/eraser.plotternode.js", "utf8");
const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
function realResample(pts, closed, step) {
  if (pts.length < 2) return pts.map((q) => q.slice());
  const P = closed ? pts.concat([pts[0]]) : pts;
  const out = [pts[0].slice()];
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    let ax = P[i - 1][0], ay = P[i - 1][1];
    const bx = P[i][0], by = P[i][1];
    let seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= step && seg > 1e-9) {
      const t = (step - acc) / seg;
      ax += (bx - ax) * t; ay += (by - ay) * t;
      out.push([ax, ay]);
      seg = Math.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += seg;
  }
  const e = pts[pts.length - 1];
  if (!closed && Math.hypot(out[out.length - 1][0] - e[0], out[out.length - 1][1] - e[1]) > 0.01) out.push(e.slice());
  return out;
}
const H = {
  Pin: (t, l) => ({ type: t, label: l }), EMPTY: { paths: [] },
  PENS: Array.from({ length: 12 }, () => ({})),
  mulberry32: () => () => 0.5, hash2: () => 0.5, noise2: () => 0.5,
  resample: realResample, pathLength: () => 0, applyStyle: (ps) => ps, signedArea: () => 0,
};
const def = new Function(...Object.keys(H), '"use strict"; return (' + code.trim().replace(/^\(/, "").replace(/\)\s*;?\s*$/, "") + ");")(...Object.values(H));
const P = (o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const run = (paths, o) => def.compute([{ paths }], P(o), { W: 300, H: 200 });

/* rect erase: horizontal line through -> 2 runs, hole between 100..200, cut edges exact */
{
  const line = [{ pts: [[10, 100], [290, 100]], closed: false, layer: 3 }];
  const r = run(line, { shape: "Rectangle" }); /* rect 100..200 x 60..140 */
  if (JSON.stringify(r) !== JSON.stringify(run(line, { shape: "Rectangle" }))) die("non-deterministic");
  if (r.paths.length !== 2) die("rect: expected 2 runs, got " + r.paths.length);
  for (const pa of r.paths) {
    if (pa.layer !== 3) die("pen lost");
    for (const [x] of pa.pts) if (x > 100.05 && x < 199.95) die("point inside erased rect (x=" + x.toFixed(2) + ")");
  }
  const xs = r.paths.flatMap((pa) => pa.pts.map(([x]) => x));
  if (!xs.some((x) => Math.abs(x - 100) < 0.05) || !xs.some((x) => Math.abs(x - 200) < 0.05)) die("cut edges not at rect border");
}
/* circle erase: all kept points >= r from center; gap grows the hole */
{
  const line = [{ pts: [[10, 100], [290, 100]], closed: false, layer: 0 }];
  const r = run(line, { shape: "Circle" }); /* circle (150,100) r50 */
  for (const pa of r.paths) for (const [x, y] of pa.pts) {
    if (Math.hypot(x - 150, y - 100) < 49.9) die("point inside erased circle");
  }
  const rg = run(line, { shape: "Circle", gap: 10 });
  for (const pa of rg.paths) for (const [x, y] of pa.pts) {
    if (Math.hypot(x - 150, y - 100) < 59.9) die("gap did not grow the hole");
  }
}
/* invert: keep only inside; endpoints land on the boundary */
{
  const line = [{ pts: [[10, 100], [290, 100]], closed: false, layer: 0 }];
  const r = run(line, { shape: "Circle", invert: true });
  if (r.paths.length !== 1) die("invert: expected 1 run, got " + r.paths.length);
  for (const [x, y] of r.paths[0].pts) if (Math.hypot(x - 150, y - 100) > 50.1) die("invert kept an outside point");
  const ends = [r.paths[0].pts[0], r.paths[0].pts[r.paths[0].pts.length - 1]];
  for (const [x, y] of ends) if (Math.abs(Math.hypot(x - 150, y - 100) - 50) > 0.1) die("invert cut not on boundary");
}
/* closed ring crossing the zone reopens as arcs; untouched closed square stays closed */
{
  const ring = [];
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    ring.push([150 + Math.cos(a) * 55, 100 + Math.sin(a) * 55]);
  }
  const r = run([{ pts: ring, closed: true, layer: 0 }], { shape: "Rectangle" });
  if (!r.paths.length || r.paths.some((pa) => pa.closed)) die("cut ring should reopen");
  const bigRing = [];
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    bigRing.push([150 + Math.cos(a) * 70, 100 + Math.sin(a) * 70]);
  }
  const rb = run([{ pts: bigRing, closed: true, layer: 0 }], { shape: "Rectangle" });
  if (rb.paths.length !== 1 || !rb.paths[0].closed) die("ring encircling the zone without touching it should stay closed");
  const sq = [{ pts: [[10, 10], [40, 10], [40, 40], [10, 40]], closed: true, layer: 1 }];
  const r2 = run(sq, { shape: "Rectangle" });
  if (r2.paths.length !== 1 || !r2.paths[0].closed || r2.paths[0].pts.length !== 4) die("outside closed path was modified");
  /* fully inside -> gone */
  const dot = [{ pts: [[150, 100], [152, 100], [152, 102]], closed: true, layer: 0 }];
  if (run(dot, { shape: "Rectangle" }).paths.length) die("fully-inside path should vanish");
}
console.log("eraser OK: rect/circle cuts exact, gap grows, invert crops to boundary, closed handling correct");