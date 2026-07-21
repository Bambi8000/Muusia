import bridges from "../src/defs/nodes/bridges.js";

const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const P = (o) => Object.assign(Object.fromEntries(bridges.params.map((q) => [q.key, q.def])), o);
const CTX = { W: 300, H: 200 };
const run = (input, o) => bridges.compute([input], P(o), CTX);

/* phyllotaxis-like dot field: 40 small circles */
const dots = { paths: [] };
for (let i = 0; i < 40; i++) {
  const a = i * 2.39996, r = 6 * Math.sqrt(i);
  const cx = 150 + Math.cos(a) * r, cy = 100 + Math.sin(a) * r;
  const ring = [];
  for (let k = 0; k < 10; k++) {
    const t = (k / 10) * Math.PI * 2;
    ring.push([cx + Math.cos(t) * 2, cy + Math.sin(t) * 2]);
  }
  dots.paths.push({ pts: ring, closed: true, layer: 0 });
}
const centers = dots.paths.map((pa) => {
  let sx = 0, sy = 0;
  for (const q of pa.pts) { sx += q[0]; sy += q[1]; }
  return [sx / pa.pts.length, sy / pa.pts.length];
});
const bridgesOf = (ps) => ps.paths.filter((pa) => !pa.closed && pa.pts.length === 2);

/* determinism + all rules run */
for (const rule of ["k-nearest", "Within distance", "Chain", "Delaunay"]) {
  const a = run(dots, { rule }), b = run(dots, { rule });
  if (JSON.stringify(a) !== JSON.stringify(b)) die(rule + " non-deterministic");
  if (!a.paths.every((pa) => pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])))) die(rule + " non-finite");
}
/* k-nearest: bridges exist, endpoints sit on centers, maxPer respected */
{
  const r = run(dots, { rule: "k-nearest", k: 3, maxPer: 4 });
  const br = bridgesOf(r);
  if (br.length < 30) die("k-nearest too few bridges: " + br.length);
  const nearC = ([x, y]) => Math.min(...centers.map(([cx, cy]) => Math.hypot(x - cx, y - cy)));
  for (const pa of br) for (const q of pa.pts) if (nearC(q) > 0.2) die("bridge endpoint not on a center");
  const deg = new Map();
  for (const pa of br) for (const q of pa.pts) {
    const k2 = Math.round(q[0] * 10) + "," + Math.round(q[1] * 10);
    deg.set(k2, (deg.get(k2) || 0) + 1);
  }
  if (Math.max(...deg.values()) > 4) die("maxPer violated");
  console.log("k-nearest OK (" + br.length + " bridges, max degree " + Math.max(...deg.values()) + ")");
}
/* within distance: every bridge <= dist */
{
  const r = run(dots, { rule: "Within distance", dist: 20, minLen: 5 });
  for (const pa of bridgesOf(r)) {
    const d = Math.hypot(pa.pts[1][0] - pa.pts[0][0], pa.pts[1][1] - pa.pts[0][1]);
    if (d > 20.01 || d < 5 - 0.01) die("within-distance length violated: " + d.toFixed(2));
  }
  console.log("within-distance OK");
}
/* trim: endpoints exactly trim away from centers */
{
  const r = run(dots, { rule: "k-nearest", k: 2, trim: 3 });
  const nearC = ([x, y]) => Math.min(...centers.map(([cx, cy]) => Math.hypot(x - cx, y - cy)));
  for (const pa of bridgesOf(r)) for (const q of pa.pts) {
    const d = nearC(q);
    if (Math.abs(d - 3) > 0.3) die("trim not respected: endpoint at " + d.toFixed(2) + " mm");
  }
  console.log("trim OK");
}
/* chain: one continuous stroke visiting all centers; maxLen splits it */
{
  const r = run(dots, { rule: "Chain", keep: false });
  if (r.paths.length !== 1) die("chain should be 1 path, got " + r.paths.length);
  if (r.paths[0].pts.length !== centers.length) die("chain misses points: " + r.paths[0].pts.length + "/" + centers.length);
  const r2 = run(dots, { rule: "Chain", keep: false, maxLen: 8 });
  if (r2.paths.length < 2) die("chain maxLen should split");
  console.log("chain OK (1 stroke, " + r.paths[0].pts.length + " pts; maxLen splits to " + r2.paths.length + ")");
}
/* endpoints source: open lines in, ends connected */
{
  const lines = { paths: Array.from({ length: 8 }, (_, i) => ({ pts: [[20 + i * 30, 40], [30 + i * 30, 160]], closed: false, layer: 0 })) };
  const r = run(lines, { source: "Endpoints", rule: "k-nearest", k: 1 });
  if (bridgesOf(r).length < 4) die("endpoints source broken");
  console.log("endpoints OK");
}
console.log("bridges valid - copy done, build & test");