import myc from "../src/defs/nodes/myceliumfill.js";

const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const P = (o) => Object.assign(Object.fromEntries(myc.params.map((q) => [q.key, q.def])), o);
const CTX = { W: 300, H: 200 };
const run = (input, o) => myc.compute([input], P({ keep: false, wav: 0, ...o }), CTX);
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));

/* plus-network: 4 open struts meeting at center -> endpoint cluster deg 4 */
const plus = { paths: [
  { pts: [[150, 100], [190, 100]], closed: false, layer: 0 },
  { pts: [[150, 100], [110, 100]], closed: false, layer: 0 },
  { pts: [[150, 100], [150, 60]], closed: false, layer: 0 },
  { pts: [[150, 100], [150, 140]], closed: false, layer: 0 },
] };

/* determinism + finite */
{
  const a = run(plus, { wav: 0.5, seed: 21 }), b = run(plus, { wav: 0.5, seed: 21 });
  if (JSON.stringify(a) !== JSON.stringify(b)) die("non-deterministic");
  if (!finiteAll(a)) die("non-finite");
}
/* junction boost: east strut outermost strand is wider near the hub than far */
{
  const widthAt = (ps, x) => {
    let w = 0;
    for (const pa of ps.paths) for (const q of pa.pts) {
      if (Math.abs(q[0] - x) < 1.5 && Math.abs(q[1] - 100) < 30) w = Math.max(w, Math.abs(q[1] - 100));
    }
    return w;
  };
  const boosted = run(plus, { strands: 1, width: 6, boost: 2, taper: 0 });
  const nearW = widthAt(boosted, 156), farW = widthAt(boosted, 186);
  if (!(nearW > farW * 1.5)) die("junction boost weak: near " + nearW.toFixed(2) + " vs far " + farW.toFixed(2));
  const flat = run(plus, { strands: 1, width: 6, boost: 0, taper: 0 });
  const fn = widthAt(flat, 156), ff = widthAt(flat, 186);
  if (Math.abs(fn - ff) > 0.8) die("boost 0 not flat: " + fn.toFixed(2) + " vs " + ff.toFixed(2));
  console.log("junction boost OK (near " + nearW.toFixed(1) + " / far " + farW.toFixed(1) + " mm; flat " + fn.toFixed(1) + "/" + ff.toFixed(1) + ")");
}
/* taper: single line, ends thinner than middle */
{
  const line = { paths: [{ pts: [[60, 100], [240, 100]], closed: false, layer: 0 }] };
  const r = run(line, { strands: 1, width: 8, boost: 0, taper: 20 });
  let endW = 0, midW = 0;
  for (const pa of r.paths) for (const q of pa.pts) {
    const w = Math.abs(q[1] - 100);
    if (q[0] < 68 || q[0] > 232) endW = Math.max(endW, w);
    if (Math.abs(q[0] - 150) < 8) midW = Math.max(midW, w);
  }
  if (!(endW < midW * 0.6)) die("taper weak: end " + endW.toFixed(2) + " vs mid " + midW.toFixed(2));
  console.log("taper OK (end " + endW.toFixed(1) + " / mid " + midW.toFixed(1) + " mm)");
}
/* territory: two parallel lines, inner strands cut, outer survive */
{
  const par = { paths: [
    { pts: [[60, 90], [240, 90]], closed: false, layer: 0 },
    { pts: [[60, 110], [240, 110]], closed: false, layer: 0 },
  ] };
  const r = run(par, { strands: 1, width: 24, boost: 0, taper: 0 });
  let inner = 0, outer = 0;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (Math.abs(q[1] - 100) <= 3) inner++;
    if (q[1] < 82 || q[1] > 118) outer++;
  }
  if (inner > 0) die("territory cut failed: " + inner + " points in the shared gap");
  if (outer < 100) die("outer strands missing");
  console.log("territory OK (0 gap points, " + outer + " outer points)");
}
/* closed spine stays closed when uncut */
{
  const ring = { paths: [{ pts: Array.from({ length: 80 }, (_, k) => [150 + Math.cos(k / 80 * Math.PI * 2) * 50, 100 + Math.sin(k / 80 * Math.PI * 2) * 50]), closed: true, layer: 0 }] };
  const r = run(ring, { strands: 2, width: 5, boost: 0 });
  if (!r.paths.some((pa) => pa.closed)) die("closed spine lost closed strands");
  console.log("closed spine OK");
}
console.log("myceliumfill valid - build & test");