/* Validator for orbit_scribble — run from repo root:
   node tools/validate-orbit_scribble.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/orbit_scribble.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/orbit_scribble.js")).default;
  mode = "baked";
}
console.log("mode:", mode);

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  strands: 6, loops: 18, radius: 22, radVar: 0.55, spread: 55, wander: 0.5,
  wobble: 0.35, beads: true, beadGap: 4.5, beadSize: 0.55, falloff: 0.5,
  beadPen: 0, seed: 5, layer: 1, ...over
});
const run = (over) => def.compute([undefined], P(over), ctx);
const arcLen = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism + seed sensitivity */
{
  const a = JSON.stringify(run({}));
  const b = JSON.stringify(run({}));
  const c = JSON.stringify(run({ seed: 6 }));
  check("T1 determinism + seed", a === b && a !== c);
}

/* T2 strand structure: exactly Strands continuous open lines on the line pen,
   each roughly loops * circumference long */
{
  const out = run({ beads: false, strands: 4, loops: 10, radVar: 0, wobble: 0 }).paths;
  const lines = out.filter((q) => q.layer === 1);
  const minLen = 10 * 2 * Math.PI * 22 * 0.5;
  check("T2 strands continuous + long",
    out.length === 4 && lines.length === 4 &&
    lines.every((q) => !q.closed && arcLen(q.pts) > minLen),
    "n=" + out.length + " len0=" + Math.round(arcLen(lines[0] ? lines[0].pts : [[0, 0]])));
}

/* T3 beads: on the bead pen, off switch works, every bead anchored on a strand */
{
  const out = run({ beadPen: 4 }).paths;
  const beads = out.filter((q) => q.layer === 4);
  const lines = out.filter((q) => q.layer === 1);
  const off = run({ beads: false }).paths.filter((q) => q.layer === 4);
  let anchored = true;
  const lp = lines.flatMap((q) => q.pts);
  for (let i = 0; i < Math.min(25, beads.length); i++) {
    const b = beads[Math.floor((i / 25) * beads.length)].pts[0]; /* spiral starts at its center */
    let dmin = 1e9;
    for (const q of lp) { const d = Math.hypot(q[0] - b[0], q[1] - b[1]); if (d < dmin) dmin = d; }
    if (dmin > 1.2) anchored = false;
  }
  check("T3 beads on own pen + anchored on strands",
    beads.length > 50 && off.length === 0 && anchored,
    "beads=" + beads.length);
}

/* T4 core falloff: falloff 1 gives fewer beads and closer to center than falloff 0 */
{
  const b0 = run({ falloff: 0, beadPen: 4 }).paths.filter((q) => q.layer === 4);
  const b1 = run({ falloff: 1, beadPen: 4 }).paths.filter((q) => q.layer === 4);
  const meanD = (bs) => bs.reduce((s, q) => s + Math.hypot(q.pts[0][0] - 150, q.pts[0][1] - 100), 0) / Math.max(1, bs.length);
  check("T4 falloff thins the fringe",
    b1.length < b0.length * 0.9 && meanD(b1) < meanD(b0) - 2,
    "n0=" + b0.length + " n1=" + b1.length + " d0=" + meanD(b0).toFixed(1) + " d1=" + meanD(b1).toFixed(1));
}

/* T5 bead size obeys Bead size mm (spiral max radius <= ~beadSize) */
{
  const beads = run({ beadSize: 1.2, beadPen: 4, falloff: 0 }).paths.filter((q) => q.layer === 4);
  let ok = beads.length > 0;
  for (const q of beads.slice(0, 40)) {
    const c = q.pts[0];
    const r = Math.max(...q.pts.map(([x, y]) => Math.hypot(x - c[0], y - c[1])));
    if (r > 1.2 + 1e-6 || r < 0.05) ok = false;
  }
  check("T5 bead size bound", ok);
}

/* T6 spread contains the tangle: small spread keeps everything near center */
{
  const out = run({ spread: 10, radius: 12, beads: false }).paths;
  const far = out.flatMap((q) => q.pts).filter(([x, y]) => Math.hypot(x - 150, y - 100) > 10 + 12 + 6);
  check("T6 cloud containment", far.length === 0, "far pts=" + far.length);
}

/* T7 sheet clamp with reckless settings */
{
  const out = run({ spread: 150, radius: 80, strands: 8 }).paths;
  const bad = out.flatMap((q) => q.pts).filter(([x, y]) =>
    x < 0.5 - 1e-9 || x > ctx.W - 0.5 + 1e-9 || y < 0.5 - 1e-9 || y > ctx.H - 0.5 + 1e-9);
  check("T7 sheet clamp", bad.length === 0, "off=" + bad.length);
}

/* T8 budget under max settings */
{
  const out = run({ strands: 20, loops: 60, beadGap: 1.5, falloff: 0 });
  const total = out.paths.reduce((s, q) => s + q.pts.length, 0);
  check("T8 budget", total <= 120000, "pts=" + total);
}

/* T9 overlay: cloud + reach circles, never throws */
{
  let ok = true, detail = "";
  try {
    const g = def.overlay(P(), ctx);
    const circ = g.filter((q) => q.kind === "circle");
    ok = circ.length === 2 && Math.abs(circ[0].r - 55) < 1e-6 && Math.abs(circ[1].r - 77) < 1e-6;
    detail = "circles=" + circ.map((q) => q.r).join(",");
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T9 overlay", ok, detail);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
