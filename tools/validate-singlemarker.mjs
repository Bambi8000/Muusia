/* validate-singlemarker.mjs — validates the baked node.
   Run from repo root: node tools/validate-singlemarker.mjs */
import def from "../src/defs/nodes/singlemarker.js";

const N = def;
const pathLength = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK  " : "FAIL") + " " + msg); if (!cond) fails++; };
const defP = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const ctx = { W: 210, H: 297 };
const run = (p) => N.compute([undefined], p, ctx, {});
const allPts = (r) => r.paths.flatMap((pa) => pa.pts);
const centroid = (r) => { const pts = allPts(r); let sx=0, sy=0; for (const [x,y] of pts){sx+=x;sy+=y;} return [sx/pts.length, sy/pts.length]; };

/* 1. determinism */
{
  const p = defP();
  ok(JSON.stringify(run(p)) === JSON.stringify(run(p)), "determinism: double run identical");
}

/* 2. every style: output exists, finite, >=2-pt paths, centroid at (x,y) */
const styles = N.params.find((q) => q.key === "style").options;
for (const S of styles) {
  const p = { ...defP(), style: S, x: 60, y: 80, size: 6 };
  const r = run(p);
  ok(r.paths.length >= 1, `style "${S}": produces paths (${r.paths.length})`);
  ok(r.paths.every((pa) => pa.pts.length >= 2), `style "${S}": every path >= 2 pts`);
  ok(allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), `style "${S}": finite coords`);
  const [cx, cy] = centroid(r);
  ok(Math.hypot(cx - 60, cy - 80) < 0.6, `style "${S}": centroid ~ (x,y) — Bridges "Path centers" lands on the marker (off ${Math.hypot(cx-60,cy-80).toFixed(3)} mm)`);
  const R = Math.max(...allPts(r).map(([x, y]) => Math.hypot(x - 60, y - 80)));
  ok(R <= p.size / 2 + 1e-6, `style "${S}": stays inside size/2 radius (max ${R.toFixed(2)})`);
}

/* 3. X/Y liveness: moving the marker translates the output exactly */
{
  const a = run({ ...defP(), x: 40, y: 50 });
  const b = run({ ...defP(), x: 140, y: 210 });
  const pa = allPts(a), pb = allPts(b);
  ok(pa.length === pb.length, "x/y liveness: same point count");
  let maxErr = 0;
  for (let i = 0; i < pa.length; i++) maxErr = Math.max(maxErr, Math.hypot(pb[i][0] - (pa[i][0] + 100), pb[i][1] - (pa[i][1] + 160)));
  ok(maxErr < 1e-9, `x/y liveness: pure translation (err ${maxErr.toExponential(1)})`);
}

/* 4. size liveness */
for (const S of styles) {
  const small = allPts(run({ ...defP(), style: S, size: 2 }));
  const big = allPts(run({ ...defP(), style: S, size: 20 }));
  const ext = (pts) => Math.max(...pts.map(([x, y]) => Math.hypot(x - 105, y - 148.5)));
  ok(ext(big) > ext(small) * 3, `style "${S}": size is live (${ext(small).toFixed(1)} -> ${ext(big).toFixed(1)} mm)`);
}

/* 5. Dot style is one continuous stroke (single pen-down) with tight pitch */
{
  const r = run({ ...defP(), style: "Dot", size: 6 });
  ok(r.paths.length === 1 && !r.paths[0].closed, "Dot: one open spiral stroke");
  ok(pathLength(r.paths[0].pts) > 6, "Dot: spiral actually fills (length > diameter)");
}

/* 6. pen clamp + wire abuse: out-of-range values must not crash or leak NaN */
{
  const r = run({ ...defP(), layer: 99, x: -50, y: 900, size: -3 });
  ok(r.paths.every((pa) => pa.layer >= 0 && pa.layer <= 11), "pen clamps to 0..11");
  ok(allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), "extreme wire values: finite output");
}

/* 7. overlay shares compute math */
{
  const p = { ...defP(), x: 33, y: 44, size: 10 };
  const g = N.overlay(p, ctx);
  const pt = g.find((q) => q.kind === "point");
  const ci = g.find((q) => q.kind === "circle");
  ok(pt && pt.x === 33 && pt.y === 44, "overlay point at (x,y)");
  ok(ci && ci.cx === 33 && ci.cy === 44 && Math.abs(ci.r - 5) < 1e-9, "overlay circle radius = size/2");
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS");
process.exit(fails ? 1 : 0);
