import fs from "fs";
const code = fs.readFileSync("nodes-lab/squiggle.plotternode.js", "utf8");
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
  mulberry32: () => () => 0.5,
  hash2: (x, y, s) => {
    let h = s + x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  noise2: (x, y, s) => {
    const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
    return v - Math.floor(v);
  },
  resample: realResample,
  pathLength: (pts, closed) => {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    return L;
  },
  applyStyle: (ps) => ps, signedArea: () => 0,
};
const def = new Function(...Object.keys(H), '"use strict"; return (' + code.trim().replace(/^\(/, "").replace(/\)\s*;?\s*$/, "") + ");")(...Object.values(H));
const P = (o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const run = (paths, o) => def.compute([{ paths }], P(o), { W: 300, H: 200 });
const hline = [{ pts: [[20, 100], [280, 100]], closed: false, layer: 4 }];
const plen = (pa) => { let l = 0; for (let i = 1; i < pa.pts.length; i++) l += Math.hypot(pa.pts[i][0] - pa.pts[i - 1][0], pa.pts[i][1] - pa.pts[i - 1][1]); return l; };

/* all modes: deterministic, finite, pen kept, amplitude bounded */
for (const mode of ["Loops", "Sine", "Triangle", "Square", "Seismic", "Glitch"]) {
  const a = run(hline, { mode, amp: 3 });
  if (JSON.stringify(a) !== JSON.stringify(run(hline, { mode, amp: 3 }))) die(mode + " non-deterministic");
  if (a.paths.length !== 1 || a.paths[0].layer !== 4) die(mode + " path/pen lost");
  for (const [x, y] of a.paths[0].pts) {
    if (!isFinite(x) || !isFinite(y)) die(mode + " non-finite");
    if (Math.abs(y - 100) > 3 * 2.2 + 0.01) die(mode + " exceeds amplitude bound");
  }
}
/* sine: zero-crossing count matches period; square: samples hug +-A */
{
  const s = run(hline, { mode: "Sine", amp: 3, period: 10 }).paths[0];
  let zc = 0;
  for (let i = 1; i < s.pts.length; i++) if ((s.pts[i][1] - 100) * (s.pts[i - 1][1] - 100) < 0) zc++;
  const expect = 2 * 260 / 10;
  if (Math.abs(zc - expect) > 4) die("sine crossings " + zc + " (expected ~" + expect + ")");
  const q = run(hline, { mode: "Square", amp: 3, period: 10 }).paths[0];
  const off = q.pts.filter(([, y]) => Math.abs(Math.abs(y - 100) - 3) > 0.4).length;
  if (off / q.pts.length > 0.12) die("square: too many samples off the rails (" + off + "/" + q.pts.length + ")");
}
/* loops: trochoid must be much longer than the spine and double back (dx < 0 somewhere) */
{
  const l = run(hline, { mode: "Loops", amp: 3, period: 7 }).paths[0];
  if (!(plen(l) > 260 * 1.6)) die("loops: path not longer than spine (" + plen(l).toFixed(0) + ")");
  if (!l.pts.some((q2, i) => i > 0 && q2[0] < l.pts[i - 1][0] - 0.01)) die("loops: never doubles back - not looping");
}
/* glitch: offsets quantized to `levels` values, seed changes pattern */
{
  const g = run(hline, { mode: "Glitch", amp: 4, period: 12, levels: 4, seed: 17 }).paths[0];
  const vals = new Set(g.pts.map(([, y]) => Math.round((y - 100) * 10) / 10));
  if (vals.size > 4) die("glitch: more offset levels than requested (" + [...vals].join(",") + ")");
  if (JSON.stringify(g) === JSON.stringify(run(hline, { mode: "Glitch", amp: 4, period: 12, levels: 4, seed: 18 }).paths[0])) die("glitch seed has no effect");
}
/* closed circle: stays closed, seam continuous for periodic mode */
{
  const ring = [];
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * Math.PI * 2;
    ring.push([150 + Math.cos(a) * 60, 100 + Math.sin(a) * 60]);
  }
  const r = run([{ pts: ring, closed: true, layer: 0 }], { mode: "Sine", amp: 3, period: 9 });
  if (!r.paths[0].closed) die("closed spine lost closed flag");
  const q = r.paths[0].pts;
  const seamR = [Math.hypot(q[0][0] - 150, q[0][1] - 100), Math.hypot(q[q.length - 1][0] - 150, q[q.length - 1][1] - 100)];
  if (Math.abs(seamR[0] - seamR[1]) > 1.2) die("closed seam discontinuous (" + seamR.map((v) => v.toFixed(1)).join(" vs ") + ")");
}
console.log("squiggle OK: 6 modes live, sine period exact, loops loop, square rails, glitch quantized+seeded, closed seam continuous");