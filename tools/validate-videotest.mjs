/* Validator: Video Test Card node.
   Run from the repo root: node tools/validate-videotest.mjs
   Uses the REAL src/defs/helpers.js and auto-switches lab <-> baked.

   Beyond the standard battery (determinism, finiteness, bounds, budget, pen
   layers, liveness of every parameter, every select option) this checks the
   things that make the card a CARD rather than decoration:
   - Aspect really letterboxes: the drawn frame carries the requested ratio;
   - the Fresnel property of the zone plate (ring radius follows sqrt(k));
   - the Siemens star emits exactly half its spoke count as wedges;
   - tone ordering: Outline < Hatch < Dense in ink laid down;
   - colour pens actually reach the palette, and collapse when switched off;
   - warp keeps the card on the sheet, and jitter is SEEDED (a 2-arg noise2
     call would silently return 0 and the jitter would be a constant shift). */

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const LAB = "nodes-lab/videotest.plotternode.js";
const BAKED = "src/defs/nodes/videotest.js";

let def;
if (existsSync(LAB)) {
  console.log("[lab] " + LAB);
  const helpers = await import(pathToFileURL("src/defs/helpers.js").href);
  const body = readFileSync(LAB, "utf8").trim().replace(/;\s*$/, "");
  def = new Function(...Object.keys(helpers), "return " + body + ";")(...Object.values(helpers));
} else {
  console.log("[baked] " + BAKED);
  def = (await import(pathToFileURL(BAKED).href)).default;
}

let pass = 0, fail = 0;
const CHECK = (name, cond, extra) => {
  if (cond) { console.log("ok    " + name); pass++; }
  else { console.log("FAIL  " + name + (extra ? " - " + extra : "")); fail++; }
};

const defaults = {};
for (const q of def.params) defaults[q.key] = q.def;
const LAND = { W: 297, H: 210 }, PORT = { W: 210, H: 297 };
const run = (over, ctx = LAND) => {
  const P = { ...defaults, ...over };
  return def.compute([null], P, ctx, { params: P });
};
const allPts = (o) => o.paths.flatMap((q) => q.pts);
const finite = (o) => allPts(o).every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
const sig = (o) => JSON.stringify(o.paths);
const bbox = (o) => {
  const q = allPts(o);
  const xs = q.map((t) => t[0]), ys = q.map((t) => t[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const inkLength = (o) => o.paths.reduce((a, q) => {
  let d = 0;
  for (let i = 1; i < q.pts.length; i++) d += Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1]);
  return a + d;
}, 0);

const PATTERNS = def.params.find((q) => q.key === "pattern").options;
CHECK("15 patterns in the collection", PATTERNS.length === 15, String(PATTERNS.length));

/* --- every pattern, both orientations --- */
for (const pattern of PATTERNS) {
  for (const [tag, ctx] of [["landscape", LAND], ["portrait", PORT]]) {
    const o = run({ pattern }, ctx);
    const ok = o.paths.length > 0 && finite(o)
      && allPts(o).every((q) => q[0] >= 0 && q[0] <= ctx.W && q[1] >= 0 && q[1] <= ctx.H)
      && o.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer < 12)
      && allPts(o).length <= 120000;
    CHECK("[" + pattern + "/" + tag + "] renders, finite, on sheet, valid pens, in budget", ok,
      o.paths.length + " paths / " + allPts(o).length + " pts");
  }
  CHECK("[" + pattern + "] deterministic", sig(run({ pattern })) === sig(run({ pattern })));
}

/* --- aspect really letterboxes --- */
for (const [aspect, ratio] of [["4:3", 4 / 3], ["16:9", 16 / 9], ["1:1", 1]]) {
  const b = bbox(run({ pattern: "Checkerboard", aspect }));
  const r = (b[2] - b[0]) / (b[3] - b[1]);
  CHECK("aspect " + aspect + " gives ratio " + ratio.toFixed(3), Math.abs(r - ratio) < 0.02, r.toFixed(3));
}
{
  const b = bbox(run({ pattern: "Checkerboard", aspect: "Canvas", margin: 12 }));
  CHECK("aspect Canvas fills the margin box", Math.abs((b[2] - b[0]) - (297 - 24)) < 1 && Math.abs((b[3] - b[1]) - (210 - 24)) < 1);
  const bp = bbox(run({ pattern: "Checkerboard", aspect: "4:3" }, PORT));
  CHECK("4:3 on a portrait sheet fits by width", Math.abs((bp[2] - bp[0]) - (210 - 24)) < 1.5);
}

/* --- zone plate really is Fresnel: r(k) proportional to sqrt(k) --- */
{
  const o = run({ pattern: "Zone plate", rings: 8, tone: "Outline", circleOn: false });
  const cx = 297 / 2, cy = 210 / 2;
  const radii = o.paths.filter((q) => q.closed && q.pts.length > 20)
    .map((q) => q.pts.reduce((a, t) => a + Math.hypot(t[0] - cx, t[1] - cy), 0) / q.pts.length)
    .sort((a, b) => a - b);
  CHECK("zone plate emits 8 rings", radii.length === 8, String(radii.length));
  if (radii.length === 8) {
    const R = radii[7];
    const err = radii.map((r, i) => Math.abs(r - R * Math.sqrt((i + 1) / 8)));
    CHECK("zone plate radii follow sqrt(k) (equal-area rings)", Math.max(...err) < 0.6, Math.max(...err).toFixed(3));
    CHECK("zone plate rings get closer outward", (radii[1] - radii[0]) > (radii[7] - radii[6]));
  }
}

/* --- Siemens star spoke count --- */
for (const spokes of [24, 48, 96]) {
  const o = run({ pattern: "Siemens star", spokes, tone: "Outline", labels: false });
  const wedges = o.paths.filter((q) => q.closed && q.pts.length >= 4 && q.pts.length < 400).length;
  CHECK("Siemens star with " + spokes + " spokes emits " + spokes / 2 + " wedges", wedges >= spokes / 2 && wedges <= spokes / 2 + 2, String(wedges));
}

/* --- tone ordering: more tone means more ink --- */
for (const pattern of ["Checkerboard", "Colour bars", "Greyscale staircase", "Siemens star"]) {
  const a = inkLength(run({ pattern, tone: "Outline" }));
  const b = inkLength(run({ pattern, tone: "Hatch" }));
  const c = inkLength(run({ pattern, tone: "Dense" }));
  CHECK("[" + pattern + "] ink grows Outline < Hatch < Dense", a < b && b < c,
    [a, b, c].map((v) => Math.round(v)).join(" < "));
}
{
  const a = inkLength(run({ pattern: "Checkerboard", ink: 3.5 }));
  const b = inkLength(run({ pattern: "Checkerboard", ink: 0.6 }));
  CHECK("tighter ink spacing lays down more ink", b > a * 2);
}

/* --- colour pens --- */
{
  const on = new Set(run({ pattern: "Colour bars", colorPens: true }).paths.map((q) => q.layer));
  const off = new Set(run({ pattern: "Colour bars", colorPens: false }).paths.map((q) => q.layer));
  CHECK("colour bars reach the palette", on.size >= 7, [...on].join(","));
  CHECK("colour pens off collapses onto the two chosen pens", off.size <= 2, [...off].join(","));
  const moved = new Set(run({ pattern: "Colour bars", colorPens: false, layer: 5 }).paths.map((q) => q.layer));
  CHECK("Pen parameter is honoured", moved.has(5));
  const acc = new Set(run({ pattern: "Monoscope grid", pen2: 8 }).paths.map((q) => q.layer));
  CHECK("Accent pen parameter is honoured", acc.has(8));
}

/* --- warp and jitter: the artistic knobs must stay honest --- */
{
  const base = { pattern: "Monoscope grid" };
  CHECK("warp is live", sig(run({ ...base, warp: 0.4 })) !== sig(run(base)));
  CHECK("warp sign matters (barrel vs pincushion)", sig(run({ ...base, warp: 0.4 })) !== sig(run({ ...base, warp: -0.4 })));
  for (const warp of [-0.6, -0.3, 0.3, 0.6]) {
    const o = run({ ...base, warp });
    const b = bbox(o);
    CHECK("warp " + warp + " keeps the card on the sheet", b[0] >= 0 && b[1] >= 0 && b[2] <= 297 && b[3] <= 210 && finite(o));
  }
  CHECK("jitter is live", sig(run({ ...base, jitter: 0.5 })) !== sig(run(base)));
  /* the classic trap: a seedless noise2 call returns 0 forever, so two seeds
     would produce identical output while still LOOKING jittered */
  CHECK("jitter is seeded (different seeds differ)",
    sig(run({ ...base, jitter: 0.5, seed: 1 })) !== sig(run({ ...base, jitter: 0.5, seed: 2 })));
  CHECK("seed is inert without jitter", sig(run({ ...base, seed: 1 })) === sig(run({ ...base, seed: 999 })));
  /* and it must be a per-line tear, not one constant shift of the whole card */
  const o1 = run({ ...base, jitter: 0.6, seed: 3 });
  const rows = o1.paths.filter((q) => !q.closed && q.pts.length > 4);
  const shifts = rows.map((q) => q.pts[0][0]);
  CHECK("jitter varies along the card, not a constant offset",
    new Set(shifts.map((v) => Math.round(v * 10))).size > 3);
}

/* --- parameter liveness --- */
{
  const L = (a, b, name, base) => CHECK(name + " is live",
    sig(run({ ...(base || {}), ...a })) !== sig(run({ ...(base || {}), ...b })));
  L({ margin: 4 }, { margin: 40 }, "margin", { pattern: "Monoscope grid" });
  L({ density: 6 }, { density: 26 }, "density", { pattern: "Convergence crosshatch" });
  L({ density: 6 }, { density: 26 }, "density (checkerboard)", { pattern: "Checkerboard" });
  L({ steps: 4 }, { steps: 14 }, "steps", { pattern: "Greyscale staircase" });
  L({ steps: 4 }, { steps: 14 }, "steps (multiburst)", { pattern: "Multiburst sweep" });
  L({ steps: 4 }, { steps: 14 }, "steps (ladder)", { pattern: "Line-pair ladder" });
  L({ spokes: 16 }, { spokes: 120 }, "spokes", { pattern: "Siemens star" });
  L({ rings: 6 }, { rings: 30 }, "rings", { pattern: "Zone plate" });
  L({ rings: 6 }, { rings: 12 }, "rings (circle geometry)", { pattern: "Circle geometry" });
  L({ tone: "Outline" }, { tone: "Dense" }, "tone", { pattern: "Checkerboard" });
  L({ ink: 0.6 }, { ink: 3.5 }, "ink", { pattern: "Greyscale staircase" });
  L({ circleOn: true }, { circleOn: false }, "circleOn", { pattern: "Monoscope grid" });
  L({ labels: true }, { labels: false }, "labels", { pattern: "Greyscale staircase" });
  L({ aspect: "4:3" }, { aspect: "16:9" }, "aspect", { pattern: "Checkerboard" });
  for (const aspect of ["Canvas", "4:3", "16:9", "1:1"])
    CHECK("aspect option renders: " + aspect, run({ pattern: "Philips circle", aspect }).paths.length > 0);
  for (const tone of ["Outline", "Hatch", "Dense"])
    CHECK("tone option renders: " + tone, run({ pattern: "Colour bars", tone }).paths.length > 0);
}

/* --- labels: numerals appear and vanish cleanly --- */
{
  const on = run({ pattern: "Greyscale staircase", labels: true }).paths.length;
  const off = run({ pattern: "Greyscale staircase", labels: false }).paths.length;
  CHECK("labels add geometry", on > off);
  CHECK("labels off leaves the card intact", off > 10);
}

/* --- degenerate and extreme values --- */
{
  const cases = [
    { pattern: "Philips circle", margin: 60, ink: 0.4, tone: "Dense" },
    { pattern: "Siemens star", spokes: 144, tone: "Dense", ink: 0.4 },
    { pattern: "Zone plate", rings: 40, tone: "Dense", ink: 0.4 },
    { pattern: "Line-pair ladder", steps: 16, ink: 0.4, tone: "Dense" },
    { pattern: "Convergence dots", density: 32, tone: "Dense" },
    { pattern: "EIA 1956 resolution", margin: 0, warp: -0.6, jitter: 1 },
    { pattern: "Colour bars", ink: 4, tone: "Outline", labels: false },
  ];
  let ok = true, inb = true, budget = true;
  for (const c of cases) {
    const o = run(c);
    if (!finite(o)) ok = false;
    if (allPts(o).some((q) => q[0] < 0 || q[0] > 297 || q[1] < 0 || q[1] > 210)) inb = false;
    if (allPts(o).length > 120000) budget = false;
  }
  CHECK("extreme values: finite, no NaN", ok);
  CHECK("extreme values: nothing off the sheet", inb);
  CHECK("extreme values: point budget held", budget);
  const tiny = def.compute([null], { ...defaults, margin: 40 }, { W: 70, H: 70 }, { params: defaults });
  CHECK("tiny sheet degrades gracefully", Array.isArray(tiny.paths) && finite(tiny));
  const nil = def.compute([null], { ...defaults, margin: 60 }, { W: 60, H: 60 }, { params: defaults });
  CHECK("impossible card returns empty rather than throwing", Array.isArray(nil.paths));
}

/* --- style input --- */
{
  let threw = false;
  try { def.compute([undefined], { ...defaults }, LAND, { params: defaults }); } catch (e) { threw = true; }
  CHECK("unwired Style input does not throw", !threw);
}

/* --- overlay --- */
{
  let threw = false;
  try {
    for (const pattern of PATTERNS) for (const aspect of ["Canvas", "4:3", "16:9", "1:1"]) {
      def.overlay({ ...defaults, pattern, aspect }, LAND, [null], { params: defaults });
      def.overlay({ ...defaults, pattern, aspect, margin: 60 }, { W: 60, H: 60 }, [null], { params: defaults });
    }
  } catch (e) { threw = true; }
  CHECK("overlay never throws", !threw);
  const ov = def.overlay({ ...defaults, pattern: "Checkerboard", aspect: "16:9" }, LAND, [null], { params: defaults });
  const fr = ov.find((g) => g.kind === "rect");
  CHECK("overlay frame carries the chosen aspect", !!fr && Math.abs(fr.w / fr.h - 16 / 9) < 0.02);
  const b = bbox(run({ pattern: "Checkerboard", aspect: "16:9" }));
  CHECK("overlay frame matches the drawn card",
    !!fr && Math.abs(fr.x - b[0]) < 0.6 && Math.abs(fr.y - b[1]) < 0.6
    && Math.abs(fr.x + fr.w - b[2]) < 0.6 && Math.abs(fr.y + fr.h - b[3]) < 0.6);
}

console.log((fail ? "FAILED " : "ALL OK ") + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
