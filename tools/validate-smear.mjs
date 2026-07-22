import fs from "fs";
const code = fs.readFileSync("nodes-lab/smear.plotternode.js", "utf8");
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
const CTX = { W: 300, H: 200 };
const Z = { zx: 50, zy: 20, zw: 200, zh: 80 }; /* zone 50..250 x 20..100 */
const run = (paths, o) => def.compute([{ paths }], P({ ...Z, ...o }), CTX);
const straight = (pa) => pa.pts.length === 2;
const inZone = ([x, y]) => x >= 50 - 0.05 && x <= 250 + 0.05 && y >= 20 - 0.05 && y <= 100 + 0.05;

/* V mode basics */
{
  const line = [{ pts: [[60, 180], [140, 60]], closed: false, layer: 2 }];
  const r = run(line, { mode: "Vertical" });
  if (JSON.stringify(r) !== JSON.stringify(run(line, { mode: "Vertical" }))) die("non-deterministic");
  const streaks = r.paths.filter(straight).filter((pa) => pa.pts.every(inZone));
  if (streaks.length !== 1) die("expected 1 streak, got " + streaks.length);
  const s = streaks[0];
  if (Math.abs(s.pts[0][0] - s.pts[1][0]) > 0.01) die("V streak not vertical");
  if (Math.abs(s.pts[1][1] - 20) > 0.1) die("V streak should reach zone top");
  if (s.layer !== 2) die("streak lost pen");
}
/* H + bridge (All) */
{
  const line = [{ pts: [[60, 180], [140, 60]], closed: false, layer: 0 }];
  const h = run(line, { mode: "Horizontal" }).paths.filter(straight).filter((pa) => pa.pts.every(inZone));
  if (h.length !== 1 || Math.abs(h[0].pts[0][1] - h[0].pts[1][1]) > 0.01) die("H streak not horizontal");
  const arc = [];
  for (let k = 0; k <= 120; k++) {
    const a = Math.PI * (k / 120);
    arc.push([150 + Math.cos(a) * 120, 150 - Math.sin(a) * 120]);
  }
  const fb = run([{ pts: arc, closed: false, layer: 4 }], { mode: "Free (bridge)" });
  if (fb.paths.length !== 1) die("bridge-all should keep one polyline, got " + fb.paths.length);
  const pts = fb.paths[0].pts;
  const zin = pts.map(inZone);
  const i0 = zin.indexOf(true), i1 = zin.lastIndexOf(true);
  const A = pts[i0], B = pts[i1];
  for (let i = i0; i <= i1; i++) {
    const [x, y] = pts[i];
    const t = Math.abs((B[0] - A[0]) * (A[1] - y) - (A[0] - x) * (B[1] - A[1])) / (Math.hypot(B[0] - A[0], B[1] - A[1]) || 1);
    if (t > 0.05) die("bridge interior not straight");
  }
}
/* bridge + From edge = Right: right crossing continues seamlessly, top crossing just cut */
{
  const path = [{ pts: [[280, 60], [150, 60], [150, 5]], closed: false, layer: 3 }];
  const r = run(path, { mode: "Free (bridge)", edge: "Right" });
  const withRay = r.paths.find((pa) => pa.pts.some(([x, y]) => Math.abs(x - 280) < 0.1 && Math.abs(y - 60) < 0.1));
  if (!withRay) die("edge-right: outside-right run missing");
  const reach = Math.min(...withRay.pts.map(([x]) => x));
  if (reach > 50.2) die("edge-right: ray does not cross the zone (min x " + reach.toFixed(1) + ")");
  if (!withRay.pts.every(([, y]) => Math.abs(y - 60) < 0.1)) die("edge-right: ray not tangent-straight");
  const topRun = r.paths.find((pa) => pa.pts.some(([x, y]) => Math.abs(x - 150) < 0.1 && Math.abs(y - 5) < 0.1));
  if (!topRun) die("edge-right: top-side remainder missing");
  if (topRun.pts.some(([x, y]) => inZone([x, y]) && y > 20.5)) die("edge-right: top side leaked into the zone");
}
/* V + From edge filter: only matching edge spawns streaks */
{
  const path = [{ pts: [[280, 60], [150, 60], [150, 5]], closed: false, layer: 0 }];
  const rt = run(path, { mode: "Vertical", edge: "Top" });
  const st = rt.paths.filter(straight).filter((pa) => pa.pts.every(inZone));
  if (st.length !== 1) die("edge-top V: expected 1 streak, got " + st.length);
  if (Math.abs(st[0].pts[0][0] - 150) > 0.2) die("edge-top V: streak not at top crossing");
  const rl = run(path, { mode: "Vertical", edge: "Left" });
  if (rl.paths.filter(straight).filter((pa) => pa.pts.every(inZone)).length !== 0) die("edge-left V: no crossings on left edge, streaks should be 0");
}
/* pass-through / len / keep / outside untouched */
{
  const line = [{ pts: [[150, 190], [150, 10]], closed: false, layer: 0 }];
  const r = run(line, { mode: "Vertical" });
  if (r.paths.filter(straight).filter((pa) => pa.pts.every(inZone)).length !== 1) die("pass-through should yield 1 streak");
  const st2 = run(line, { mode: "Vertical", len: 30 }).paths.filter(straight).filter((pa) => pa.pts.every(inZone))[0];
  const ll = Math.hypot(st2.pts[1][0] - st2.pts[0][0], st2.pts[1][1] - st2.pts[0][1]);
  if (Math.abs(ll - 30) > 0.1) die("len=30 streak is " + ll.toFixed(1));
  if (run(line, { keep: true }).paths.length <= r.paths.length) die("keep did not add interior content");
  const sq = [{ pts: [[10, 120], [40, 120], [40, 190], [10, 190]], closed: true, layer: 1 }];
  const r2 = run(sq, {});
  if (r2.paths.length !== 1 || !r2.paths[0].closed) die("outside path was modified");
}
console.log("smear OK: V/H streaks, bridge chords, From-edge seamless continuation + filtering, len/keep live");