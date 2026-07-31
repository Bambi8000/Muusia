/* validate-bridges-order.mjs — Source order rule + regression on existing rules.
   Run from repo root: node tools/validate-bridges-order.mjs */
import def from "../src/defs/nodes/bridges.js";

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK  " : "FAIL") + " " + msg); if (!cond) fails++; };
const ctx = { W: 210, H: 297 };
const defP = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };

/* markers as small closed squares; wire order is deliberately NOT the
   nearest-neighbour order from marker 0: A(20,20) -> B(180,20) -> C(30,30) -> D(170,40) */
const centers = [[20, 20], [180, 20], [30, 30], [170, 40]];
const square = ([cx, cy]) => ({
  pts: [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx + 1, cy + 1], [cx - 1, cy + 1]],
  closed: true, layer: 2,
});
const SRC = { paths: centers.map(square) };
const run = (over) => def.compute([SRC], { ...defP(), ...over }, ctx, {});
const bridgesOf = (r, keep) => r.paths.slice(keep ? SRC.paths.length : 0);
const near = (a, b, tol = 0.01) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;

/* 1. Source order follows gather (wire) order, not proximity */
{
  const r = run({ rule: "Source order" });
  const br = bridgesOf(r, true);
  ok(br.length === 1 && !br[0].closed, "Source order: one open stroke");
  const pts = br[0].pts;
  ok(pts.length === centers.length && centers.every((c, i) => near(pts[i], c)),
    "Source order: visits centroids exactly in wire order A->B->C->D");
}

/* 2. Chain regression: same input still connects by nearest neighbour (A->C->...) */
{
  const r = run({ rule: "Chain" });
  const br = bridgesOf(r, true);
  ok(br.length === 1 && near(br[0].pts[0], centers[0]) && near(br[0].pts[1], centers[2]),
    "Chain regression: still nearest-neighbour (A->C first hop)");
}

/* 3. Max bridge splits the ordered run at long jumps
   hops here: 40 / 100 / 30 mm — only the middle one exceeds maxLen 80 */
{
  const C2 = [[20, 20], [60, 20], [160, 20], [190, 20]];
  const S2 = { paths: C2.map(square) };
  const r = def.compute([S2], { ...defP(), rule: "Source order", maxLen: 80 }, ctx, {});
  const br = r.paths.slice(S2.paths.length);
  ok(br.length === 2, `Source order + maxLen: split into ${br.length} runs (expect 2)`);
  ok(br.every((pa) => pa.pts.length >= 2), "Source order + maxLen: no 1-pt runs");
  ok(near(br[0].pts[0], C2[0]) && near(br[0].pts[1], C2[1]) && near(br[1].pts[0], C2[2]) && near(br[1].pts[1], C2[3]),
    "Source order + maxLen: runs keep the wire order on both sides of the gap");
}

/* 4. Trim ends: individual segments, shortened by trim at both ends */
{
  const tr = 3;
  const r = run({ rule: "Source order", trim: tr });
  const br = bridgesOf(r, true);
  ok(br.length === centers.length - 1, "Source order + trim: n-1 segments");
  let pass = true;
  for (let i = 0; i < br.length; i++) {
    const full = Math.hypot(centers[i + 1][0] - centers[i][0], centers[i + 1][1] - centers[i][1]);
    const seg = Math.hypot(br[i].pts[1][0] - br[i].pts[0][0], br[i].pts[1][1] - br[i].pts[0][1]);
    if (Math.abs(seg - (full - 2 * tr)) > 0.01) pass = false;
    if (Math.hypot(br[i].pts[0][0] - centers[i][0], br[i].pts[0][1] - centers[i][1]) < tr - 0.01) pass = false;
  }
  ok(pass, "Source order + trim: every segment = full - 2*trim, ends off the markers");
  /* a 10 mm hop with trim 6 (threshold 12.4 mm) must be dropped, the 60 mm hop kept */
  const C3 = [[20, 20], [30, 20], [90, 20]];
  const S3 = { paths: C3.map(square) };
  const r2 = def.compute([S3], { ...defP(), rule: "Source order", trim: 6 }, ctx, {});
  ok(r2.paths.slice(S3.paths.length).length === 1, "Source order + trim: too-short hops dropped, long kept");
}

/* 5. Close loop: unbroken run becomes a closed path (pen returns to start) */
{
  const r = run({ rule: "Source order", closeLoop: true });
  const br = bridgesOf(r, true);
  ok(br.length === 1 && br[0].closed === true && br[0].pts.length === centers.length,
    "Close loop: single closed path, first point not repeated");
  const r2 = run({ rule: "Source order", closeLoop: true, trim: 2 });
  ok(bridgesOf(r2, true).length === centers.length, "Close loop + trim: n segments incl. closing one");
  const r3 = run({ rule: "Source order", closeLoop: true, maxLen: 100 });
  ok(bridgesOf(r3, true).every((pa) => !pa.closed), "Close loop + split run: stays open (no fake loop)");
}

/* 6. Keep source off: only bridges out */
{
  const r = run({ rule: "Source order", keep: false });
  ok(r.paths.length === 1, "keep=false: only the bridge stroke");
}

/* 7. Hull (outline): outer boundary only, interior points excluded */
{
  /* rectangle corners + one interior point; wire order deliberately scrambled */
  const C4 = [[40, 40], [160, 120], [100, 80] /* interior */, [160, 40], [40, 120]];
  const S4 = { paths: C4.map(square) };
  const r = def.compute([S4], { ...defP(), rule: "Hull (outline)" }, ctx, {});
  const br = r.paths.slice(S4.paths.length);
  ok(br.length === 1 && br[0].closed === true, "Hull: one closed outline path");
  ok(br[0].pts.length === 4, `Hull: 4 corners, interior point excluded (${br[0].pts.length})`);
  ok(!br[0].pts.some((q) => near(q, [100, 80])), "Hull: interior point not on the outline");
  /* no diagonals: every hull edge must be a rectangle side (120 or 80 mm) */
  let sides = true;
  for (let i = 0; i < 4; i++) {
    const a = br[0].pts[i], b = br[0].pts[(i + 1) % 4];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Math.abs(d - 120) > 0.01 && Math.abs(d - 80) > 0.01) sides = false;
  }
  ok(sides, "Hull: edges are the rectangle sides only — no interior/diagonal lines");
  /* trim mode: separated edge segments */
  const r2 = def.compute([S4], { ...defP(), rule: "Hull (outline)", trim: 3 }, ctx, {});
  const br2 = r2.paths.slice(S4.paths.length);
  ok(br2.length === 4 && br2.every((pa) => !pa.closed && pa.pts.length === 2),
    "Hull + trim: 4 open trimmed edge segments");
  /* degenerate: collinear points -> one finite segment */
  const C5 = [[20, 50], [60, 50], [100, 50]];
  const S5 = { paths: C5.map(square) };
  const r3 = def.compute([S5], { ...defP(), rule: "Hull (outline)" }, ctx, {});
  const br3 = r3.paths.slice(S5.paths.length);
  ok(br3.length === 1 && !br3[0].closed &&
    br3[0].pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
    "Hull degenerate (collinear): one finite open segment");
}

/* 8. Determinism + other rules smoke (params unchanged for old patches) */
{
  ok(JSON.stringify(run({ rule: "Source order" })) === JSON.stringify(run({ rule: "Source order" })),
    "determinism: double run identical");
  for (const rule of ["k-nearest", "Within distance", "Delaunay"]) {
    const r = def.compute([SRC], { ...defP(), rule, dist: 300 }, ctx, {});
    ok(bridgesOf(r, true).length > 0, `${rule} regression: still produces bridges`);
    ok(r.paths.flatMap((pa) => pa.pts).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)),
      `${rule} regression: finite coords`);
  }
  const keys = def.params.map((q) => q.key).join(",");
  ok(keys === "source,spacing,rule,k,dist,maxPer,minLen,maxLen,closeLoop,trim,keep,layer",
    "param keys: old keys untouched, closeLoop added");
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS");
process.exit(fails ? 1 : 0);
