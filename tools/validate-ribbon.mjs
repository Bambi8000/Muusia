/* tools/validate-ribbon.mjs - runs against the BAKED node (v2.36 lesson) */
import N from "../src/defs/nodes/ribbon.js";
import { noise2, applyStyle } from "../src/defs/helpers.js";

/* ---- baked ribbon.js compute, transcribed verbatim from MUUSIA-NODES-SRC.md ---- */
function bakedRibbon(ins, p, ctx) {
  const { W, H } = ctx;
  const NN = 160;
  const bb = [];
  for (let i = 0; i <= NN; i++) {
    const t = i / NN;
    const x = p.margin + (W - 2 * p.margin) * t;
    const y = H / 2 + (noise2(t * 4 * p.wscale, 3.3, p.seed) - 0.5) * 2 * p.wander;
    bb.push([x, Math.max(p.margin, Math.min(H - p.margin, y))]);
  }
  const widthAt = (t) => {
    const v = noise2(t * 5 * p.wscale + 40, 8.8, p.seed + 9);
    const w = p.width * (1 - p.widthVar + p.widthVar * Math.max(0, v * 1.5 - 0.25));
    return Math.max(0.3, w);
  };
  const normals = bb.map((pt, i) => {
    const nI = Math.min(i + 1, bb.length - 1), pI = Math.max(i - 1, 0);
    const tx = bb[nI][0] - bb[pI][0], ty = bb[nI][1] - bb[pI][1];
    const tl = Math.hypot(tx, ty) || 1;
    return [-ty / tl, tx / tl];
  });
  const K = Math.round(p.lines);
  const paths = [];
  for (let k = 0; k < K; k++) {
    const f = K === 1 ? 0 : k / (K - 1) - 0.5;
    const pts = bb.map((pt, i) => {
      const w = widthAt(i / NN);
      return [pt[0] + normals[i][0] * f * w, pt[1] + normals[i][1] * f * w];
    });
    paths.push({ pts, closed: false, layer: Math.round(p.layer) });
  }
  return applyStyle({ paths }, ins[0]);
}

const CTX = { W: 210, H: 297 };
function defaults() { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; }
function countPts(r) { let n = 0; for (const pa of r.paths) n += pa.pts.length; return n; }
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};

/* T1 REGRESSION: Line mode identical to baked output across a parameter sweep */
{
  let allEq = true, worst = "";
  const combos = [
    {}, { seed: 1 }, { seed: 999, wander: 100 }, { wscale: 3.5, widthVar: 0 },
    { lines: 1 }, { lines: 60, width: 80 }, { margin: 0 }, { margin: 60, layer: 7 },
  ];
  for (const over of combos) {
    const p = { ...defaults(), ...over, shape: "Line" };
    const a = JSON.stringify(N.compute([undefined], p, CTX, {}));
    const b = JSON.stringify(bakedRibbon([undefined], p, CTX));
    if (a !== b) { allEq = false; worst = JSON.stringify(over); }
  }
  check("T1 Line mode === baked ribbon (8 combos, exact JSON)", allEq, worst || "identical");
}

/* T1b: missing shape param (old saved patch) falls into Line branch */
{
  const p = defaults();
  delete p.shape;
  const a = JSON.stringify(N.compute([undefined], p, CTX, {}));
  const b = JSON.stringify(bakedRibbon([undefined], p, CTX));
  check("T1b shape undefined -> baked-identical (old patches safe)", a === b);
}

/* T2 Ring: closed loops, correct count, finite, on-sheet */
{
  const p = { ...defaults(), shape: "Ring" };
  const r = N.compute([undefined], p, CTX, {});
  check("T2 line count", r.paths.length === p.lines, r.paths.length);
  check("T2 all closed", r.paths.every((pa) => pa.closed));
  let finite = true;
  for (const pa of r.paths) for (const q of pa.pts) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
  }
  check("T2 finite", finite);
  /* backbone (middle filament when widthVar irrelevant) stays inside sheet;
     filaments may exceed by width/2 at most */
  let maxOut = 0;
  for (const pa of r.paths) for (const [x, y] of pa.pts) {
    maxOut = Math.max(maxOut, -x, x - CTX.W, -y, y - CTX.H);
  }
  check("T2 filaments within sheet + width/2 slack", maxOut <= p.width / 2 + 0.01, "overshoot " + maxOut.toFixed(2) + " mm");
  /* no duplicated first point at the end (closed convention) */
  const pa0 = r.paths[0];
  const same = Math.hypot(pa0.pts[0][0] - pa0.pts[pa0.pts.length - 1][0], pa0.pts[0][1] - pa0.pts[pa0.pts.length - 1][1]) < 1e-9;
  check("T2 closed path does not repeat first point", !same);
}

/* T3 Ring seam: turn angle at the seam is no worse than elsewhere on the loop */
{
  const p = { ...defaults(), shape: "Ring", wander: 90, wscale: 3, widthVar: 1 };
  const r = N.compute([undefined], p, CTX, {});
  let maxSeam = 0, maxBody = 0;
  const turn = (a, b, c) => {
    const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
    const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
    return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2))));
  };
  for (const pa of r.paths) {
    const P = pa.pts, n = P.length;
    /* seam wraps between last and first point */
    maxSeam = Math.max(maxSeam, turn(P[n - 2], P[n - 1], P[0]), turn(P[n - 1], P[0], P[1]));
    for (let i = 1; i < n - 1; i++) maxBody = Math.max(maxBody, turn(P[i - 1], P[i], P[i + 1]));
  }
  check("T3 seam turn <= body max turn (seamless loop)", maxSeam <= maxBody + 1e-9,
    "seam " + (maxSeam * 180 / Math.PI).toFixed(1) + "\u00b0 vs body " + (maxBody * 180 / Math.PI).toFixed(1) + "\u00b0");
}

/* T4 Ring radius parameter actually scales the loop */
{
  const p = { ...defaults(), shape: "Ring", wander: 0 };
  const rad = (pct) => {
    const r = N.compute([undefined], { ...p, ringR: pct, lines: 1 }, CTX, {});
    const cx = CTX.W / 2, cy = CTX.H / 2;
    let s = 0;
    for (const q of r.paths[0].pts) s += Math.hypot(q[0] - cx, q[1] - cy);
    return s / r.paths[0].pts.length;
  };
  const r40 = rad(40), r80 = rad(80);
  check("T4 ringR scales radius (80% ~ 2x of 40%)", Math.abs(r80 / r40 - 2) < 0.02, r40.toFixed(1) + " -> " + r80.toFixed(1) + " mm");
}

/* T5 widthVar=0 -> filament offsets constant along the loop */
{
  const p = { ...defaults(), shape: "Ring", widthVar: 0, wander: 30, lines: 2 };
  const r = N.compute([undefined], p, CTX, {});
  const A = r.paths[0].pts, B = r.paths[1].pts;
  let mn = Infinity, mx = 0;
  for (let i = 0; i < A.length; i++) {
    const d = Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]);
    mn = Math.min(mn, d); mx = Math.max(mx, d);
  }
  check("T5 widthVar=0 -> constant band width", mx - mn < 1e-6, "spread " + (mx - mn).toExponential(1));
}

/* T6 determinism + seed effect (Ring) */
{
  const p = { ...defaults(), shape: "Ring" };
  const a = JSON.stringify(N.compute([undefined], p, CTX, {}));
  const b = JSON.stringify(N.compute([undefined], p, CTX, {}));
  check("T6 deterministic", a === b);
  const c = JSON.stringify(N.compute([undefined], { ...p, seed: 4096 }, CTX, {}));
  check("T6 seed changes output", a !== c);
}

/* T7 budget + extremes */
{
  const p = { ...defaults(), shape: "Ring", lines: 60, wander: 120, wscale: 4, margin: 0 };
  const r = N.compute([undefined], p, CTX, {});
  check("T7 budget", countPts(r) < 120000, countPts(r) + " pts");
  let finite = true;
  for (const pa of r.paths) for (const q of pa.pts) if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) finite = false;
  check("T7 extremes finite", finite);
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
process.exit(fails ? 1 : 0);
