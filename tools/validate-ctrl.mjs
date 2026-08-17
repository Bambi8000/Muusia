/* Validator for the Controller node (key "ctrl").
   Run from the repo root: node tools/validate-ctrl.mjs
   The first output line says [lab] or [baked] - READ IT. Baked wins when
   src/defs/nodes/ctrl.js exists, so bake before validating a reopened lab file.

   The load-bearing check here is LAYOUT AGREEMENT: the node's _layouts table
   and the copy inside src/live-input.jsx must be byte-identical, because the
   node decides which pin is which and the module decides which control writes
   which param. Drift between them wires a pin to the wrong button, and nothing
   else in the suite would notice.

   Controller is a VALUE node: it emits numbers, not paths, so the usual
   bounds / pen-layer / point-budget checks do not apply. What matters here
   instead is the purity split - v1..v6 and the range params must move the
   output, and the engine-side params (source/mode/rate/dead/bind/freeze,
   which only src/live-input.jsx reads) must NOT. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "ctrl";

const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href)).default;
  mode = "[baked]";
} else {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (patch) => def.compute([], { ...defaults(), ...(patch || {}) }, { W: 297, H: 210 }, {});
const arr = (patch) => { const r = run(patch); return Array.isArray(r) ? r : [r]; };
const p0 = defaults();

/* --- identity and shape --- */
ok(def.key === KEY, "key is " + KEY);
ok(def.cat === "math", "category math");
ok(Array.isArray(def.ins) && def.ins.length === 0, "no data inputs");
ok(typeof def.outs === "function", "outs is a function (dynamic channel count)");
ok(typeof def.desc === "string" && def.desc.length > 80, "has a description");

/* ---------------------------------------------------------------- LAYOUTS */
const LAY = def._layouts;
ok(LAY && typeof LAY === "object", "the node ships a _layouts table");
ok(LAY.Channels === null, "Channels is the dynamic layout");
const PADLAYS = Object.keys(LAY).filter((k) => LAY[k]);
ok(PADLAYS.length === 2, "two pad layouts: " + PADLAYS.join(", "));
{
  const opts = def.params.find((q) => q.key === "layout").options;
  ok(opts.length === Object.keys(LAY).length && opts.every((o) => o in LAY),
    "every Layout option has a table entry and vice versa");
  ok(opts[0] === "Channels", "Channels is first, and stays the default, so existing patches keep their pins");
  ok(def.params.find((q) => q.key === "layout").def === "Channels", "Channels is the default layout");
  for (const n of PADLAYS) {
    ok(LAY[n].length === 4, n + " is four channels wide (a constant card height)");
    ok(LAY[n].map((c) => c[0]).join(",") === "v1,v2,v3,v4",
      n + " stores into v1..v4 - one normalised storage model for every layout");
    for (const c of LAY[n]) {
      const pd = def.params.find((q) => q.key === c[0]);
      ok(!!pd, n + ": '" + c[0] + "' has a matching parameter");
      if (pd) ok(pd.min === 0 && pd.max === 1, n + ": '" + c[0] + "' is a 0..1 channel");
      ok(["axis", "dpad", "trigger"].includes(c[2]), n + ": '" + c[1] + "' has a known control kind");
    }
  }
  ok(LAY.Sticks.map((c) => c[1]).join(",") === "LX,LY,RX,RY", "each stick reaches two channels");
  ok(LAY["D-pad + triggers"].map((c) => c[1]).join(",") === "Pad X,Pad Y,L2,R2",
    "the d-pad pairs and both triggers share one layout");
}

/* the engine module keeps its own copy - it MUST be the same table */
{
  const modPath = resolve("src/live-input.jsx");
  if (!existsSync(modPath)) ok(false, "src/live-input.jsx not found - the node is useless without its engine seam");
  else {
    const msrc = readFileSync(modPath, "utf8");
    const m = msrc.match(/const LAYOUTS = (\{[\s\S]*?\n\};)/);
    ok(!!m, "found the LAYOUTS table in src/live-input.jsx");
    if (m) {
      let modLay = null;
      try { modLay = new Function("return " + m[1].replace(/;\s*$/, "")) (); } catch (e) { modLay = null; }
      ok(!!modLay, "the module's LAYOUTS table parses");
      if (modLay) {
        ok(JSON.stringify(modLay) === JSON.stringify(LAY),
          "the node and src/live-input.jsx agree on the layout table exactly");
      }
    }
  }
}

/* --- descriptor field names are engine contract, not convention --- */
for (const pd of def.params) {
  if (pd.type === "select") ok(Array.isArray(pd.options) && pd.options.length > 0,
    "select '" + pd.key + "' uses options[] (not opts)");
  if (pd.type === "slider") ok([pd.min, pd.max, pd.step, pd.def].every(Number.isFinite),
    "slider '" + pd.key + "' has finite min/max/step/def");
  ok(pd.def !== undefined, "param '" + pd.key + "' declares a default");
}

/* --- determinism --- */
ok(JSON.stringify(run()) === JSON.stringify(run()), "deterministic (double run identical)");
ok(JSON.stringify(run({ v1: 0.31, v2: 0.77 })) === JSON.stringify(run({ v1: 0.31, v2: 0.77 })),
  "deterministic with moved channels");

/* --- output shape follows count: scalar at 1, array beyond --- */
ok(typeof run({ count: 1 }) === "number", "count 1 returns a bare number (engine would nest an array)");
for (let n = 2; n <= 6; n++) {
  const r = run({ count: n });
  ok(Array.isArray(r) && r.length === n, "count " + n + " returns an array of " + n);
}
for (let n = 1; n <= 6; n++) {
  const pins = def.outs({ params: { ...p0, count: n } });
  ok(pins.length === n, "outs() declares " + n + " pins at count " + n);
  ok(pins.every((q) => q.type === "value"), "outs() pins are all value at count " + n);
  const vals = arr({ count: n });
  ok(vals.length === pins.length, "compute width matches pin count at count " + n);
}
ok(def.outs({ params: { ...p0, count: 0 } }).length === 1, "count 0 clamps to 1 pin");
ok(def.outs({ params: { ...p0, count: 99 } }).length === 6, "count 99 clamps to 6 pins");
ok(def.outs({}).length === 1, "outs() survives a node with no params");
for (const n of PADLAYS) {
  const pins = def.outs({ params: { ...p0, layout: n } });
  ok(pins.length === 4, n + ": outs() declares four pins");
  ok(pins.every((q) => q.type === "value"), n + ": all pins are value pins");
  ok(pins.map((q) => q.label).join(",") === LAY[n].map((c) => c[1]).join(","), n + ": pin labels come from the table");
  const vals = arr({ layout: n });
  ok(vals.length === 4 && vals.every(Number.isFinite), n + ": compute returns four finite values");
}
ok(def.outs({ params: { ...p0, layout: "Nonsense" } }).length >= 1, "an unknown layout falls back to Channels pins");

/* --- values are finite, in range, never -0 --- */
const inRange = (vals, lo, hi) => vals.every((v) => Number.isFinite(v) && v >= Math.min(lo, hi) - 1e-9 && v <= Math.max(lo, hi) + 1e-9);
ok(inRange(arr(), p0.min, p0.max), "defaults land inside Out min..Out max");
ok(arr({ v1: 0, v2: 0 }).every((v) => v === p0.min), "v = 0 maps to Out min");
ok(arr({ v1: 1, v2: 1 }).every((v) => v === p0.max), "v = 1 maps to Out max");
ok(arr({ v1: 0.5 }).every((v) => !Object.is(v, -0)), "no negative zero at defaults");
ok(!Object.is(arr({ min: -10, max: 10, snap: 1, v1: 0.499 })[0], -0), "snapping never produces -0");

/* range mapping is exact and monotone */
{
  let mono = true, prev = -Infinity;
  for (let i = 0; i <= 20; i++) { const v = arr({ min: -30, max: 70, v1: i / 20 })[0]; if (v < prev - 1e-9) mono = false; prev = v; }
  ok(mono, "output is monotone in v1 across the range");
  ok(Math.abs(arr({ min: -30, max: 70, v1: 0.25 })[0] - (-5)) < 1e-9, "linear map is exact (-30..70 at 0.25 = -5)");
}

/* inverted range must still be honoured and bounded */
ok(inRange(arr({ min: 40, max: -40 }), 40, -40), "inverted range (min > max) stays bounded");
ok(Math.abs(arr({ min: 40, max: -40, v1: 1 })[0] - -40) < 1e-9, "inverted range: v = 1 reaches max");

/* snapping stays inside the range and lands on the grid */
for (const s of [0.1, 0.5, 1, 3, 7]) {
  const vals = arr({ min: 0, max: 10, snap: s, v1: 0.37, v2: 0.94 });
  ok(inRange(vals, 0, 10), "snap " + s + " stays inside 0..10");
  ok(vals.every((v) => Math.abs(v / s - Math.round(v / s)) < 1e-9 || Math.abs(v - 0) < 1e-9 || Math.abs(v - 10) < 1e-9),
    "snap " + s + " lands on the grid or on a clamped end");
}

/* --------------------------------------------------- PAD LAYOUT SEMANTICS */
{
  const at = (patch, i) => arr(patch)[i];
  /* one storage model means the output range applies everywhere - the whole
     point of dropping per-control units */
  for (const n of PADLAYS) {
    ok(arr({ layout: n }).length === 4, n + ": four values out");
    ok(at({ layout: n, v1: 0, min: -50, max: 50 }, 0) === -50, n + ": channel 0 maps to Out min");
    ok(at({ layout: n, v1: 1, min: -50, max: 50 }, 0) === 50, n + ": channel 1 maps to Out max");
    ok(at({ layout: n, v1: 0.5, min: 0, max: 10 }, 0) === 5, n + ": a centred channel lands mid-range");
    ok(at({ layout: n, v1: 5 }, 0) === p0.max, n + ": an out-of-range param clamps");
    ok(at({ layout: n, v1: -5 }, 0) === p0.min, n + ": a negative param clamps");
    ok(Number.isFinite(at({ layout: n, v1: NaN }, 0)), n + ": a NaN param stays finite");
    ok(at({ layout: n, v1: 0.37, min: 0, max: 10, snap: 2 }, 0) === 4, n + ": Snap applies in pad layouts too");
    /* every channel moves exactly its own pin */
    for (let i = 0; i < 4; i++) {
      const key = LAY[n][i][0];
      const base2 = arr({ layout: n });
      const bumped = arr({ layout: n, [key]: 0.77 });
      let moved = 0;
      for (let j = 0; j < 4; j++) if (bumped[j] !== base2[j]) moved++;
      ok(moved === 1, n + ": '" + LAY[n][i][1] + "' moves exactly one pin");
    }
  }
  /* count is a Channels-only control and must not resize a pad layout */
  for (const n of PADLAYS) ok(arr({ layout: n, count: 6 }).length === 4, n + ": Channels count does not resize it");
  ok(arr({ layout: "Channels", count: 6 }).length === 6, "Channels still resizes with count");
}

/* --- compute params must be live --- */
const base = JSON.stringify(run());
const live = (patch, label) => ok(JSON.stringify(run(patch)) !== base, "param live: " + label);
live({ layout: "Sticks" }, "layout");
live({ v1: 0.9 }, "v1");
live({ v2: 0.9 }, "v2");
live({ count: 4 }, "count");
live({ min: -50 }, "min");
live({ max: 50 }, "max");
live({ snap: 4 }, "snap");
for (let i = 3; i <= 6; i++) {
  const b = JSON.stringify(run({ count: 6 }));
  ok(JSON.stringify(run({ count: 6, ["v" + i]: 0.123 })) !== b, "param live: v" + i + " (at count 6)");
}

/* --- engine-side params must be INERT in compute --- */
const inert = (patch, label) => ok(JSON.stringify(run(patch)) === base, "engine-side param inert in compute: " + label);
inert({ source: "Gamepad" }, "source");
inert({ source: "Manual" }, "source Manual");
inert({ mode: "Absolute" }, "mode");
inert({ rate: 3.5 }, "rate");
inert({ dead: 40 }, "dead");
inert({ bind: "pad:1 axis:2-5" }, "bind");
inert({ freeze: true }, "freeze");
inert({ dstep: 20 }, "dstep (the d-pad step is applied in the engine)");

/* --- every select option computes --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const vals = arr({ [pd.key]: opt });
    ok(vals.every(Number.isFinite), pd.key + " '" + opt + "' computes finite values");
  }
}

/* --- degenerate and hostile inputs --- */
const hostile = [
  [{ v1: NaN, v2: NaN }, "NaN channels"],
  [{ v1: undefined, v2: undefined }, "undefined channels"],
  [{ v1: Infinity, v2: -Infinity }, "infinite channels"],
  [{ v1: -5, v2: 5 }, "out-of-range channels (wires can push past the slider)"],
  [{ min: NaN, max: NaN }, "NaN range"],
  [{ min: 0, max: 0 }, "zero-width range"],
  [{ snap: NaN }, "NaN snap"],
  [{ snap: -3 }, "negative snap"],
  [{ snap: 1e6 }, "absurd snap"],
  [{ count: 0 }, "count 0"],
  [{ count: 2.4 }, "fractional count"],
  [{ count: NaN }, "NaN count"],
  [{ count: 99 }, "count far past max"],
  [{ min: -1e6, max: 1e6, v1: 1 }, "huge range"],
];
for (const [patch, label] of hostile) {
  const vals = arr(patch);
  ok(vals.length >= 1 && vals.length <= 6 && vals.every(Number.isFinite), "no NaN and 1..6 wide: " + label);
}
ok(arr({ v1: -5, min: 0, max: 10 })[0] === 0, "below-range v1 clamps to Out min");
ok(arr({ v1: 5, min: 0, max: 10 })[0] === 10, "above-range v1 clamps to Out max");

/* --- showIf --- */
{
  const withShow = def.params.filter((q) => typeof q.showIf === "function");
  ok(withShow.length > 0, "node uses showIf for mode-dependent rows");
  ok(withShow.every((q) => p0[q.key] !== undefined), "showIf rows still carry defaults (compute never sees undefined)");
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  for (const src of ["Manual", "Keyboard", "Gamepad"]) {
    for (let n = 1; n <= 6; n++) {
      const pp = { ...p0, source: src, count: n };
      let threw = false;
      try { vis(pp); } catch (e) { threw = true; }
      ok(!threw, "showIf predicates never throw (" + src + ", count " + n + ")");
    }
  }
  ok(vis({ ...p0, source: "Manual" }).indexOf("bind") < 0, "Binding hidden unless source is Gamepad");
  ok(vis({ ...p0, source: "Gamepad" }).indexOf("bind") >= 0, "Binding visible for Gamepad");
  ok(vis({ ...p0, source: "Gamepad", mode: "Absolute" }).indexOf("rate") < 0, "Jog rate hidden in Absolute mode");
  ok(vis({ ...p0, count: 1 }).indexOf("v2") < 0, "CH2 row hidden at count 1");
  ok(vis({ ...p0, count: 6 }).indexOf("v6") >= 0, "CH6 row visible at count 6");
  ok(vis({ ...p0, count: 1 }).indexOf("v1") >= 0, "CH1 row always visible");
}

/* --- purity: no leakage between calls, no mutation of the param object --- */
{
  const p = { ...p0, v1: 0.4 };
  const snapshot = JSON.stringify(p);
  run(p);
  ok(JSON.stringify(p) === snapshot, "compute does not mutate the params object");
  const src = String(def.compute);
  ok(!/Math\.random|document|window|navigator|Date\.now|performance\./.test(src),
    "compute touches no clock, DOM or device API");
}

console.log(fails ? "\n" + fails + " FAILURE(S)" : "\nALL OK");
process.exitCode = fails ? 1 : 0;
