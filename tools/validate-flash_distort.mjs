/* Validator for flash_distort — run from repo root:
   node tools/validate-flash_distort.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/flash_distort.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/flash_distort.js")).default;
  mode = "baked";
}
console.log("mode:", mode);

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  angle: 0, segs: 6, widthMode: "Uniform", widthAmt: 0.5,
  shift: 10, shiftMode: "Alternate", jitter: 0, closeCuts: false, seed: 7, ...over
});
const paths = (...ps) => ({ paths: ps.map(([pts, closed]) => ({ pts, closed, layer: 2 })) });
const hline = [[[10, 100], [290, 100]], false];
const run = (inp, over) => def.compute([inp], P(over), ctx);

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism */
{
  const a = JSON.stringify(run(paths(hline), { widthMode: "Random", shiftMode: "Random", jitter: 0.5 }));
  const b = JSON.stringify(run(paths(hline), { widthMode: "Random", shiftMode: "Random", jitter: 0.5 }));
  check("T1 determinism", a === b);
}

/* T2 Alternate oracle: angle 0, uniform, jitter 0 -> every point exactly y0 +/- shift, x untouched */
{
  const out = run(paths(hline), {}).paths;
  const ys = new Set(), xsOK = out.every((q) => q.pts.every(([x]) => x >= 10 - 1e-6 && x <= 290 + 1e-6));
  out.forEach((q) => q.pts.forEach(([, y]) => ys.add(Math.round(y * 1000) / 1000)));
  const want = new Set([90, 110]);
  check("T2 alternate +/- shift, x preserved",
    xsOK && ys.size === 2 && [...ys].every((y) => want.has(y)),
    "ys=" + [...ys].join(","));
}

/* T3 piece count: a full-width line across 6 uniform strips -> 6 pieces, layer preserved */
{
  const out = run(paths(hline), {}).paths;
  check("T3 piece count + layer", out.length === 6 && out.every((q) => q.layer === 2 && !q.closed),
    "n=" + out.length);
}

/* T4 path inside one strip stays whole, closed, rigidly shifted */
{
  /* strips at angle 0 are 50 mm wide: square at x 60..80 sits in strip 1 (50..100) -> shift -10 */
  const sq = [[[60, 80], [80, 80], [80, 120], [60, 120]], true];
  const out = run(paths(sq), {}).paths;
  const q = out[0];
  const ok = out.length === 1 && q.closed &&
    q.pts.every(([x, y], i) => {
      /* resampled square: every point x in 60..80, y shifted by -10 => 70..110 */
      return x >= 60 - 1e-6 && x <= 80 + 1e-6 && y >= 70 - 1e-6 && y <= 110 + 1e-6;
    });
  check("T4 in-strip path stays closed + rigid shift", ok, "n=" + out.length);
}

/* T5 angle 90: horizontal strips shift horizontally; a horizontal line keeps its y */
{
  const out = run(paths(hline), { angle: 90 }).paths;
  const yOK = out.every((q) => q.pts.every(([, y]) => Math.abs(y - 100) < 1e-6));
  const xShifted = out.some((q) => q.pts.some(([x]) => Math.abs(x - 10) > 1 && Math.abs(x - 290) > 1));
  check("T5 rotated strips shift along themselves", out.length === 1 && yOK && xShifted,
    "n=" + out.length);
}

/* T6 Ramp staircase: piece mean y decreases monotonically left to right (shift -1 -> +1, screen y down) */
{
  const out = run(paths(hline), { shiftMode: "Ramp", segs: 8 }).paths;
  const means = out.map((q) => ({
    x: q.pts.reduce((s, v) => s + v[0], 0) / q.pts.length,
    y: q.pts.reduce((s, v) => s + v[1], 0) / q.pts.length
  })).sort((a, b) => a.x - b.x);
  let mono = true;
  for (let i = 1; i < means.length; i++) if (means[i].y < means[i - 1].y - 1e-6) mono = false;
  check("T6 ramp staircase monotonic", out.length === 8 && mono, "n=" + out.length);
}

/* T7 width variation moves the cuts; jitter changes shifts; walk differs from random */
{
  const a = JSON.stringify(run(paths(hline), { widthMode: "Random", widthAmt: 0 }));
  const b = JSON.stringify(run(paths(hline), { widthMode: "Random", widthAmt: 0.8 }));
  const c = JSON.stringify(run(paths(hline), { jitter: 0.6 }));
  const d = JSON.stringify(run(paths(hline), {}));
  const e = JSON.stringify(run(paths(hline), { shiftMode: "Walk" }));
  const f = JSON.stringify(run(paths(hline), { shiftMode: "Random" }));
  check("T7 width/jitter/mode sensitivity", a !== b && c !== d && e !== f);
}

/* T8 sheet clamp under extreme shift */
{
  const out = run(paths(hline, [[[150, 5], [150, 195]], false]), { shift: 80, shiftMode: "Random", segs: 30, widthMode: "Random" });
  const bad = out.paths.flatMap((q) => q.pts).filter(([x, y]) =>
    x < 0.5 - 1e-9 || x > ctx.W - 0.5 + 1e-9 || y < 0.5 - 1e-9 || y > ctx.H - 0.5 + 1e-9);
  check("T8 sheet clamp", bad.length === 0, "off=" + bad.length);
}

/* T9 closed path crossing cuts: wrap seam merged (first/last runs joined), pieces open */
{
  const ring = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    ring.push([150 + Math.cos(a) * 90, 100 + Math.sin(a) * 70]);
  }
  const out = run(paths([ring, true]), { segs: 4 }).paths;
  /* 4 strips, ring spans strips 0..3 -> crossings: strip sequence around the ring
     has 6 boundary crossings -> 6 runs, wrap-merged to 6 (first==last strip merged) */
  const allOpen = out.every((q) => !q.closed);
  check("T9 ring split, wrap merged", allOpen && out.length >= 4 && out.length <= 8,
    "n=" + out.length);
}

/* T10 overlay: segs+1 cut guides at angle 0 + one arrow; boundaries match compute cuts; never throws */
{
  let ok = true, detail = "";
  try {
    const g = def.overlay(P({ segs: 6 }), ctx);
    const lines = g.filter((q) => q.kind === "poly");
    const arrow = g.filter((q) => q.kind === "arrow");
    /* angle 0, uniform: vertical cut lines at x = 0,50,...,300 */
    const xs = lines.map((q) => Math.round(q.pts[0][0] * 100) / 100).sort((a, b) => a - b);
    const want = [0, 50, 100, 150, 200, 250, 300];
    ok = lines.length === 7 && arrow.length === 1 && xs.every((x, i) => Math.abs(x - want[i]) < 1e-6);
    detail = "lines=" + lines.length + " xs=" + xs.join(",");
    def.overlay(P({ angle: 137, segs: 60, widthMode: "Random" }), ctx); /* must not throw */
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T10 overlay cuts", ok, detail);
}

/* T11 empty input + budget */
{
  const e = def.compute([undefined], P(), ctx);
  let ok = e.paths.length === 0, total = 0;
  const many = [];
  for (let k = 0; k < 60; k++) many.push([[[10, 3 + k * 3.2], [290, 3 + k * 3.2]], false]);
  const out = run(paths(...many), { segs: 60, widthMode: "Random", shiftMode: "Random" });
  total = out.paths.reduce((s, q) => s + q.pts.length, 0);
  check("T11 empty + budget", ok && total <= 120000, "pts=" + total);
}


/* T12 Close cut faces: closed band across 6 uniform strips -> 6 closed pieces,
   each piece's u-extent (unshifted: u is invariant under the shift) inside its strip */
{
  const band = [[[10, 90], [290, 60], [290, 80], [10, 110]], true];
  const out = run(paths(band), { closeCuts: true }).paths;
  const allClosed = out.length === 6 && out.every((q) => q.closed && q.layer === 2);
  let inStrip = true;
  for (const q of out.paths || out) {
    const usv = q.pts.map(([x]) => x); /* angle 0: u = x, unchanged by vertical shift */
    const mn = Math.min(...usv), mx = Math.max(...usv);
    const k = Math.min(5, Math.max(0, Math.floor(mn / 50 + 1e-9)));
    if (mn < k * 50 - 1e-6 || mx > (k + 1) * 50 + 1e-6) inStrip = false;
  }
  check("T12 closed cut faces per strip", allClosed && inStrip, "n=" + out.length);
}

/* T13 exact cuts: with zero shift the pieces of a line tile it with NO gaps */
{
  const out = run(paths(hline), { shift: 0, segs: 7 }).paths;
  const ends = out.map((q) => [q.pts[0][0], q.pts[q.pts.length - 1][0]]).sort((a, b) => a[0] - b[0]);
  let gaps = 0;
  for (let i = 1; i < ends.length; i++) if (Math.abs(ends[i][0] - ends[i - 1][1]) > 1e-9) gaps++;
  const span = Math.abs(ends[0][0] - 10) < 1e-9 && Math.abs(ends[ends.length - 1][1] - 290) < 1e-9;
  check("T13 gapless exact cuts", gaps === 0 && span, "gaps=" + gaps);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
