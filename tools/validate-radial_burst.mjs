/* Validator for radial_burst — run from repo root:
   node tools/validate-radial_burst.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/radial_burst.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/radial_burst.js")).default;
}
console.log("mode:", mode || "baked");

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  spacing: 2.2, waveLen: 2.4, waveAmp: 0.8, waveform: "Zigzag", wobble: 0.35,
  innerR: 2, edgeVar: 0.35, useCenter: true, cx: 150, cy: 100,
  margin: 12, seed: 9, layer: 0, ...over
});
const run = (over) => def.compute([undefined], P(over), ctx);
const rOf = ([x, y], cx = 150, cy = 100) => Math.hypot(x - cx, y - cy);

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism + seed sensitivity */
{
  const a = JSON.stringify(run({}));
  check("T1 determinism + seed", a === JSON.stringify(run({})) && a !== JSON.stringify(run({ seed: 10 })));
}

/* T2 hairs run inside out, one continuous open stroke each */
{
  const out = run({}).paths;
  const badDir = out.filter((q) => rOf(q.pts[0]) >= rOf(q.pts[q.pts.length - 1]));
  check("T2 inside-out continuous hairs",
    out.length > 100 && out.every((q) => !q.closed) && badDir.length === 0,
    "hairs=" + out.length + " badDir=" + badDir.length);
}

/* T3 density preserved: hair count doubles with the radius - count tips near the rim
   vs hairs alive at half radius; and total hair count scales ~1/spacing */
{
  const out = run({ edgeVar: 0, wobble: 0, waveAmp: 0 }).paths;
  const baseR = Math.min(300 - 24, 200 - 24) / 2; /* 88 */
  const aliveAt = (r) => out.filter((q) => rOf(q.pts[0]) <= r && rOf(q.pts[q.pts.length - 1]) >= r).length;
  const nHalf = aliveAt(baseR * 0.5), nRim = aliveAt(baseR * 0.92);
  const ratio = nRim / Math.max(1, nHalf);
  const wide = run({ spacing: 4.4, edgeVar: 0, waveAmp: 0 }).paths.length;
  check("T3 density doubling + spacing scaling",
    ratio > 1.5 && ratio < 3 && wide < out.length * 0.75,
    "half=" + nHalf + " rim=" + nRim + " ratio=" + ratio.toFixed(2) + " wide=" + wide + "/" + out.length);
}

/* T4 inner hole: with innerR 25 nothing enters the core */
{
  const out = run({ innerR: 25 }).paths;
  const inside = out.flatMap((q) => q.pts).filter((q) => rOf(q) < 25 - 0.8 - 1.2);
  check("T4 inner radius hole", inside.length === 0, "inside=" + inside.length);
}

/* T5 tips reach the blob rim: edgeVar 0 -> every hair ends within a tight band of baseR */
{
  const out = run({ edgeVar: 0 }).paths;
  const baseR = 88;
  const ends = out.map((q) => rOf(q.pts[q.pts.length - 1]));
  const bad = ends.filter((r) => r < baseR * 0.94 || r > baseR * 1.06);
  check("T5 tips at the rim", bad.length === 0, "bad=" + bad.length);
}

/* T6 Straight waveform ignores amplitude: straight rays even at waveAmp 0.8 */
{
  const out = run({ waveform: "Straight", waveAmp: 0.8, wobble: 0, edgeVar: 0 }).paths;
  let worst = 0;
  for (const q of out.slice(0, 40)) {
    const a = q.pts[0], b = q.pts[q.pts.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    for (const [x, y] of q.pts) {
      const d = Math.abs((x - a[0]) * dy - (y - a[1]) * dx) / len;
      if (d > worst) worst = d;
    }
  }
  check("T6 Straight rays ignore amp", worst < 1e-6, "worst=" + worst);
}

/* T7 movable center + waveform + params live */
{
  const a = JSON.stringify(run({}));
  const moved = run({ useCenter: false, cx: 80, cy: 60, innerR: 10 }).paths;
  const nearNew = moved.flatMap((q) => q.pts).filter(([x, y]) => Math.hypot(x - 80, y - 60) < 15).length;
  check("T7 center + waveform live",
    nearNew > 0 &&
    a !== JSON.stringify(run({ waveform: "Sine" })) &&
    a !== JSON.stringify(run({ waveform: "Square" })) &&
    a !== JSON.stringify(run({ waveform: "Saw" })) &&
    a !== JSON.stringify(run({ waveform: "Seismic" })) &&
    a !== JSON.stringify(run({ waveform: "Straight" })) &&
    a !== JSON.stringify(run({ waveLen: 5 })) &&
    a !== JSON.stringify(run({ edgeVar: 0.9 })));
}

/* T8 sheet clamp + budget at dense settings */
{
  const out = run({ spacing: 1, waveLen: 1, margin: 0 });
  const total = out.paths.reduce((s, q) => s + q.pts.length, 0);
  const bad = out.paths.flatMap((q) => q.pts).filter(([x, y]) =>
    x < 0.5 - 1e-9 || x > 299.5 + 1e-9 || y < 0.5 - 1e-9 || y > 199.5 + 1e-9);
  check("T8 clamp + budget", bad.length === 0 && total <= 118000,
    "bad=" + bad.length + " pts=" + total);
}

/* T9 overlay: center point + rim circle (+ inner circle when open), never throws */
{
  let ok = true, detail = "";
  try {
    const g1 = def.overlay(P({ innerR: 20 }), ctx);
    const g2 = def.overlay(P({ innerR: 0 }), ctx);
    ok = g1.filter((q) => q.kind === "circle").length === 2 &&
      g2.filter((q) => q.kind === "circle").length === 1 &&
      g1.some((q) => q.kind === "point");
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T9 overlay", ok, detail);
}


/* T10 rim gap oracle: with a calm silhouette the tip gaps never exceed ~2.6x spacing */
{
  const out = run({ edgeVar: 0, waveAmp: 0, waveform: "Straight", wobble: 0 }).paths;
  const baseR = 88;
  const tips = out.map((q) => q.pts[q.pts.length - 1])
    .map(([x, y]) => Math.atan2(y - 100, x - 150)).sort((a, b) => a - b);
  let maxGap = (tips[0] + 2 * Math.PI - tips[tips.length - 1]) * baseR;
  for (let i = 1; i < tips.length; i++) maxGap = Math.max(maxGap, (tips[i] - tips[i - 1]) * baseR);
  check("T10 rim gap bound", maxGap < 2.2 * 2.6 && out.length > 200,
    "maxGap=" + maxGap.toFixed(2) + " hairs=" + out.length);
}

/* T11 silhouette integrity at extreme Edge variation with inner 0:
   no bald wedges - every 15-degree sector keeps tips near its own edge
   and sector tip counts stay within 3x of the median */
{
  for (const over of [{ edgeVar: 1, innerR: 0 }, { edgeVar: 0.8, innerR: 0, waveLen: 8.8, spacing: 1.4 }]) {
    const out = run(over).paths;
    const bins = new Array(24).fill(0), maxTip = new Array(24).fill(0);
    for (const q of out) {
      const t = q.pts[q.pts.length - 1];
      const b = Math.floor(((Math.atan2(t[1] - 100, t[0] - 150) + Math.PI) / (2 * Math.PI)) * 24) % 24;
      bins[b]++;
      maxTip[b] = Math.max(maxTip[b], Math.hypot(t[0] - 150, t[1] - 100));
    }
    const med = [...bins].sort((a, b) => a - b)[12];
    const okBins = bins.every((n) => n >= med / 3) && maxTip.every((r) => r >= 0.5 * 88);
    check("T11 no bald wedges (" + JSON.stringify(over) + ")", okBins,
      "bins=" + bins.join(",") + " med=" + med);
  }
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
