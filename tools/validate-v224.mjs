import zig from "../src/defs/nodes/zigzag.js";
import clouds from "../src/defs/nodes/clouds.js";

const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const P = (def, o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));
const inBounds = (ps) => ps.paths.every((pa) => pa.pts.every(([x, y]) => x > -1 && x < 301 && y > -1 && y < 201));
const CTX = { W: 300, H: 200 };

/* ---- zigzag ---- */
{
  const run = (o, spine) => zig.compute([spine, undefined], P(zig, o), CTX);
  for (const wave of ["Zigzag", "Sine", "Square"]) {
    const a = run({ wave, envelope: 0.7, seed: 5 });
    const b = run({ wave, envelope: 0.7, seed: 5 });
    if (!finiteAll(a) || !inBounds(a)) die("zigzag " + wave + " invalid output");
    if (JSON.stringify(a) !== JSON.stringify(b)) die("zigzag " + wave + " non-deterministic");
  }
  /* period: sine zero crossings on one row ~ 2 * len / T */
  const zc = (o) => {
    const row = run(o).paths[0];
    const y0 = row.pts.reduce((s, q) => s + q[1], 0) / row.pts.length;
    let n = 0;
    for (let i = 1; i < row.pts.length; i++) if ((row.pts[i][1] - y0) * (row.pts[i - 1][1] - y0) < 0) n++;
    return n;
  };
  const z12 = zc({ wave: "Sine", rows: 1, period: 12 });
  const z24 = zc({ wave: "Sine", rows: 1, period: 24 });
  if (!(z12 > z24 * 1.6)) die("period has no effect (" + z12 + " vs " + z24 + ")");
  /* envelope reduces mean deviation */
  const dev = (o) => {
    const row = run({ rows: 1, ...o }).paths[0];
    const y0 = row.pts.reduce((s, q) => s + q[1], 0) / row.pts.length;
    return row.pts.reduce((s, q) => s + Math.abs(q[1] - y0), 0) / row.pts.length;
  };
  if (!(dev({ envelope: 1 }) < dev({ envelope: 0 }) * 0.85)) die("envelope has no effect");
  /* phase differentiates rows */
  const p2 = run({ rows: 2, phase: 0.5, wave: "Sine" });
  const r0 = p2.paths[0].pts, r1 = p2.paths[1].pts;
  let diff = 0;
  for (let i = 0; i < Math.min(r0.length, r1.length); i++) diff = Math.max(diff, Math.abs((r0[i][1] - r0[0][1]) - (r1[i][1] - r1[0][1])));
  if (diff < 2) die("row phase has no effect");
  /* spine mode: circle in, rows*1 wavy rings out */
  const circ = { paths: [{ pts: Array.from({ length: 90 }, (_, k) => [150 + Math.cos(k / 90 * Math.PI * 2) * 55, 100 + Math.sin(k / 90 * Math.PI * 2) * 55]), closed: true, layer: 0 }] };
  const sp = run({ rows: 3, amp: 3 }, circ);
  if (sp.paths.length !== 3 || !finiteAll(sp)) die("spine mode broken");
  if (!sp.paths.every((pa) => pa.closed)) die("spine mode lost closed flag");
  console.log("zigzag OK (crossings " + z12 + "/" + z24 + ", spine rings 3)");
}
/* ---- clouds (baked) ---- */
{
  if (clouds.key !== "clouds" || clouds.name !== "Clouds") die("clouds key/name not rebaked");
  const run = (o) => clouds.compute([undefined], P(clouds, o), CTX);
  for (const seed of [33, 7, 500]) {
    const a = run({ seed }), b = run({ seed });
    if (!finiteAll(a) || !inBounds(a)) die("clouds invalid, seed " + seed);
    if (JSON.stringify(a) !== JSON.stringify(b)) die("clouds non-deterministic, seed " + seed);
  }
  console.log("clouds OK (engraved version baked as built-in)");
}
console.log("v2.24 nodes valid");