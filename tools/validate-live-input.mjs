/* Validator for the live-input engine seam (src/live-input.jsx).
   Run from the repo root: node tools/validate-live-input.mjs

   The module is JSX, so Node cannot import it. Instead the pure block between
   the PURE-BEGIN / PURE-END markers is extracted and evaluated verbatim — the
   same text the browser runs, not a reimplementation. The extraction itself is
   checked (markers unique, block free of React/DOM/device references) and the
   surrounding file gets a smoke test, because a v2.50-style insertion accident
   can leave a file that still parses while the neighbour code is dead. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve("src/live-input.jsx");
const APP = resolve("src/App.jsx");

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

if (!existsSync(FILE)) { console.log("FAIL src/live-input.jsx not found - run from the repo root"); process.exit(1); }
const src = readFileSync(FILE, "utf8");
console.log("[module] src/live-input.jsx -", src.split("\n").length, "lines");

/* --- extraction integrity --- */
const beg = src.split("/* PURE-BEGIN");
const end = src.split("/* PURE-END */");
ok(beg.length === 2, "PURE-BEGIN marker appears exactly once");
ok(end.length === 2, "PURE-END marker appears exactly once");
if (beg.length !== 2 || end.length !== 2) { console.log("\ncannot extract - ABORT"); process.exit(1); }

const block = src.slice(src.indexOf("/* PURE-BEGIN"), src.indexOf("/* PURE-END */"));
/* the block's own comments explain what it must NOT do, so strip them before
   testing — otherwise the prose fails the check it describes */
const code = block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok(!/\breact\b|useState|useRef|useEffect/i.test(code), "pure block references no React");
ok(!/\b(document|window|navigator|performance|requestAnimationFrame)\b/.test(code), "pure block touches no DOM or device API");
ok(!/<[A-Za-z]/.test(code), "pure block contains no JSX");
ok(!/Math\.random\(/.test(code), "pure block is deterministic");

const CONSTS = "const NODE_KEY = \"ctrl\"; const CHAN_MAX = 6;\n";
let M;
try {
  M = new Function(CONSTS + block + "\nreturn { clamp01, isCtrl, chanCount, chansOf, stepPad, stepAxis, syncState, planWrite, parseBind, LAYOUTS };")();
  ok(true, "pure block evaluates");
} catch (e) {
  ok(false, "pure block evaluates (" + e.message + ")");
  console.log("\n" + fails + " FAILURE(S)");
  process.exit(1);
}
const { clamp01, isCtrl, chanCount, chansOf, stepPad, stepAxis, syncState, planWrite, parseBind, LAYOUTS } = M;

/* --- clamp01 --- */
ok(clamp01(-3) === 0 && clamp01(3) === 1 && clamp01(0.4) === 0.4, "clamp01 bounds to 0..1");

/* --- node recognition --- */
ok(isCtrl({ type: "ctrl", params: {} }) === true || !!isCtrl({ type: "ctrl", params: {} }), "recognises a Controller node");
ok(!isCtrl({ type: "arvo", params: {} }), "ignores other node types");
ok(!isCtrl({ type: "ctrl" }), "ignores a Controller with no params (mid-load)");
ok(!isCtrl(null) && !isCtrl(undefined), "survives a null node");

/* --- channel count mirrors the node's own clamp --- */
for (const [inp, want] of [[1, 1], [2, 2], [6, 6], [0, 1], [-4, 1], [99, 6], [2.4, 2], [2.6, 3], [NaN, 1], [undefined, 1]]) {
  ok(chanCount({ params: { count: inp } }) === want, "chanCount(" + inp + ") = " + want);
}
ok(chanCount({ params: {} }) === 1, "chanCount with no count param = 1");

/* --- axis mapping: Absolute --- */
{
  const abs = (raw, dz) => stepAxis(raw, 0.5, dz, false, 1, 0.016);
  ok(Math.abs(abs(-1, 0) - 0) < 1e-9, "Absolute: axis -1 -> 0");
  ok(Math.abs(abs(1, 0) - 1) < 1e-9, "Absolute: axis +1 -> 1");
  ok(Math.abs(abs(0, 0) - 0.5) < 1e-9, "Absolute: centre -> 0.5");
  ok(Math.abs(abs(0.05, 0.12) - 0.5) < 1e-9, "Absolute: inside the deadzone reads as centre");
  ok(Math.abs(abs(1, 0.12) - 1) < 1e-9, "Absolute: full deflection still reaches 1 with a deadzone");
  /* the rescale must be continuous at the deadzone edge, not a step */
  const just = abs(0.1201, 0.12);
  ok(Math.abs(just - 0.5) < 0.002, "Absolute: leaving the deadzone does not jump (" + just.toFixed(4) + ")");
  ok(abs(0.6, 0) > 0.5 && abs(-0.6, 0) < 0.5, "Absolute: sign is preserved");
  ok(Number.isFinite(abs(NaN, 0.12)) && abs(NaN, 0.12) === 0.5, "Absolute: NaN axis leaves the value alone");
}

/* --- axis mapping: Jog --- */
{
  ok(stepAxis(0, 0.4, 0.12, true, 1, 0.1) === 0.4, "Jog: centred stick holds the value (self-centring device)");
  ok(stepAxis(0.05, 0.4, 0.12, true, 1, 0.1) === 0.4, "Jog: deadzone holds the value");
  const up = stepAxis(1, 0.4, 0, true, 1, 0.1);
  ok(Math.abs(up - 0.5) < 1e-9, "Jog: full deflection, rate 1, dt 0.1 adds exactly 0.1");
  ok(stepAxis(-1, 0.4, 0, true, 1, 0.1) < 0.4, "Jog: negative axis decreases");
  ok(stepAxis(1, 0.98, 0, true, 4, 0.1) === 1, "Jog: clamps at 1");
  ok(stepAxis(-1, 0.02, 0, true, 4, 0.1) === 0, "Jog: clamps at 0");
  /* a stalled tab can hand back a huge dt — it must not teleport the value */
  ok(stepAxis(1, 0.5, 0, true, 4, 30) <= 1 && stepAxis(1, 0.5, 0, true, 4, 30) - 0.5 <= 0.4001,
    "Jog: an absurd dt is capped, no teleport");
  ok(Number.isFinite(stepAxis(1, 0.5, NaN, true, NaN, NaN)), "Jog: NaN rate/dt/deadzone stay finite");
  /* integrating a held stick is monotone and reaches the end */
  let v = 0;
  for (let i = 0; i < 200; i++) v = stepAxis(1, v, 0.12, true, 0.6, 0.016);
  ok(v === 1, "Jog: a held stick integrates all the way to 1");
  let w = 1;
  for (let i = 0; i < 200; i++) w = stepAxis(-1, w, 0.12, true, 0.6, 0.016);
  ok(w === 0, "Jog: a held stick integrates all the way to 0");
}

/* --- write planning and the adoption race ---
   This is the state machine that decides whether a frame costs a whole graph
   re-evaluation. The async gap between setParam and the props catching up is
   simulated explicitly, because that gap is where jitter would live. */
{
  const fresh = () => ({ v: [], w: [], pend: [], prev: [], sig: null });
  const CH = chansOf({ params: { layout: "Channels", count: 2 } });
  const P = (o) => Object.assign({ v1: 0.5, v2: 0.5 }, o);

  let st = syncState(fresh(), P(), CH);
  ok(st.v[0] === 0.5 && st.w[0] === 0.5, "first sync adopts the params");
  ok(planWrite(st, CH) === null, "an unmoved channel plans no write (no re-evaluation)");

  st.v[0] = 0.5 + 0.0001;
  ok(planWrite(st, CH) === null, "a sub-quantum nudge plans no write");

  st.v[0] = 0.62;
  const plan = planWrite(st, CH);
  ok(plan && plan.v1 === 0.62 && plan.v2 === undefined, "only the moved channel is written");
  ok(st.pend[0] === true && st.pend[1] === false, "the written channel is marked pending");

  /* the frame after the write: props have NOT caught up yet */
  syncState(st, P({ v1: 0.5 }), CH);
  ok(st.v[0] === 0.62, "stale props during a pending write do not claw the value back");
  syncState(st, P({ v1: 0.62 }), CH);
  ok(st.pend[0] === false, "pending clears once the props catch up");
  ok(st.v[0] === 0.62, "value survives the round trip");

  syncState(st, P({ v1: 0.1 }), CH);
  ok(st.v[0] === 0.1, "a manual edit is adopted once nothing is in flight");

  /* quantisation is per channel, not a global 0.001 */
  const ONE = chansOf({ params: { layout: "Channels", count: 1 } });
  st = syncState(fresh(), P({ v1: 0 }), ONE);
  st.v[0] = 0.12344;
  const r1 = planWrite(st, ONE);
  ok(r1 && Math.abs(r1.v1 - 0.123) < 1e-9, "channels quantise to their 0.001 step");
  const STK = chansOf({ params: { layout: "Sticks" } });
  let sa = syncState(fresh(), { v1: 0, v2: 0, v3: 0, v4: 0 }, STK);
  sa.v[0] = 0.73456;
  const ra = planWrite(sa, STK);
  ok(ra && Math.abs(ra.v1 - 0.735) < 1e-9, "a stick channel quantises to the same 0.001 step");

  /* hostile local state must not escape into a param */
  st = syncState(fresh(), P({ v1: 0.5 }), ONE);
  st.v[0] = NaN;
  ok(planWrite(st, ONE) === null, "a NaN local value is never written");
  ok(Number.isFinite(st.v[0]), "a NaN local value is repaired from the last write");

  st = syncState(fresh(), { v1: NaN }, ONE);
  ok(st.v[0] === 0 && st.w[0] === 0, "a NaN param syncs to the channel minimum");
  st = syncState(fresh(), { v1: 7 }, ONE);
  ok(st.v[0] === 1, "an out-of-range param is clamped on adoption");

  /* CHANGING LAYOUT renames every channel, so the index-keyed mirror must be
     dropped - otherwise channel 2 keeps the previous layout's value */
  let sw = syncState(fresh(), P({ v1: 0.9, v2: 0.1 }), CH);
  ok(sw.v[0] === 0.9, "channels layout adopted");
  const DP = chansOf({ params: { layout: "D-pad + triggers" } });
  sw = syncState(sw, { v1: 0.42, v2: 0.07, v3: 0, v4: 0 }, DP);
  ok(sw.v[0] === 0.42 && sw.v[1] === 0.07, "switching layout re-seeds the mirror from the params");
  ok(sw.sig === "v1,v2,v3,v4", "the mirror records which channel set it holds");
}

/* --- layouts and the d-pad stepper --- */
{
  ok(LAYOUTS.Channels === null, "the Channels layout is the dynamic one");
  const names = Object.keys(LAYOUTS).filter((k) => LAYOUTS[k]);
  ok(names.length === 2, "two pad layouts (" + names.join(", ") + ")");
  for (const n of names) {
    ok(LAYOUTS[n].length === 4, n + " is exactly four channels wide (the card height must not move)");
    ok(LAYOUTS[n].every((c) => typeof c[0] === "string" && typeof c[1] === "string"
      && ["axis", "dpad", "trigger"].includes(c[2])), n + " channel tuples are well formed");
    ok(LAYOUTS[n].map((c) => c[0]).join(",") === "v1,v2,v3,v4",
      n + " stores into v1..v4 (one storage model for every layout)");
  }
  const dp = LAYOUTS["D-pad + triggers"];
  ok(Array.isArray(dp[0][3]) && dp[0][3].length === 2, "a dpad channel names a [minus, plus] button pair");
  ok(dp[0][3][0] === 14 && dp[0][3][1] === 15, "Pad X is left(-) and right(+)");
  ok(dp[1][3][0] === 13 && dp[1][3][1] === 12, "Pad Y is down(-) and up(+), so up increases");
  ok(dp[2][2] === "trigger" && dp[3][2] === "trigger", "L2 and R2 are triggers, each on its own channel");
  const idx = [dp[0][3], dp[1][3]].flat().concat([dp[2][3], dp[3][3]]);
  ok(new Set(idx).size === idx.length, "no gamepad button is claimed twice");
  const ax = LAYOUTS.Sticks.map((c) => c[3]);
  ok(ax.join(",") === "0,1,2,3", "the sticks take axes 0..3 - two channels per stick");

  /* chansOf */
  ok(chansOf({ params: { layout: "Channels", count: 4 } }).length === 4, "chansOf follows count in Channels");
  ok(chansOf({ params: {} }).length === 1, "chansOf defaults to Channels with one channel");
  ok(chansOf({ params: { layout: "Sticks" } }).map((c) => c.label).join(",") === "LX,LY,RX,RY", "chansOf returns the pin labels in order");
  ok(chansOf({ params: { layout: "Nonsense" } }).length >= 1, "an unknown layout falls back to Channels");
  ok(chansOf({ params: { layout: "Sticks" } }).every((c) => c.min === 0 && c.max === 1),
    "every channel is normalised 0..1 whatever the layout");

  /* the d-pad stepper acts on the rising edge and clamps */
  ok(Math.abs(stepPad(false, false, false, true, 0.5, 0.05) - 0.55) < 1e-9, "a right press steps up");
  ok(Math.abs(stepPad(false, false, true, false, 0.5, 0.05) - 0.45) < 1e-9, "a left press steps down");
  ok(stepPad(false, true, false, true, 0.5, 0.05) === 0.5, "holding does not run the value away");
  ok(stepPad(true, false, true, false, 0.5, 0.05) === 0.5, "holding minus does not run either");
  ok(stepPad(false, false, false, false, 0.5, 0.05) === 0.5, "nothing pressed, nothing moves");
  ok(stepPad(false, false, true, true, 0.5, 0.05) === 0.5, "both directions at once cancel out");
  ok(stepPad(false, false, false, true, 0.98, 0.05) === 1, "stepping up clamps at 1");
  ok(stepPad(false, false, true, false, 0.02, 0.05) === 0, "stepping down clamps at 0");
  ok(Number.isFinite(stepPad(false, false, false, true, NaN, NaN)), "NaN state and step stay finite");
  {
    let v = 0;
    for (let i = 0; i < 25; i++) v = stepPad(false, false, false, true, v, 0.05);
    ok(v === 1, "twenty presses at 5% cross the range and stop");
  }
}

/* --- binding parser --- *//* --- binding parser --- *//* --- binding parser --- */
{
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(eq(parseBind("auto", 3), { pad: null, axes: [0, 1, 2] }), "bind 'auto' = first connected pad, axes 0..n-1");
  ok(eq(parseBind("", 2), { pad: null, axes: [0, 1] }), "empty binding falls back to auto");
  ok(eq(parseBind(undefined, 2), { pad: null, axes: [0, 1] }), "undefined binding falls back to auto");
  ok(eq(parseBind("total nonsense", 2), { pad: null, axes: [0, 1] }), "unparseable binding falls back to auto");
  ok(parseBind("axis:0-5", 6).pad === null, "an axis-only binding leaves the pad on auto");
  ok(eq(parseBind("axis:0-5", 6).axes, [0, 1, 2, 3, 4, 5]), "range binding");
  ok(eq(parseBind("axis:5-0", 6).axes, [0, 1, 2, 3, 4, 5]), "reversed range is normalised");
  ok(eq(parseBind("axis:0,1,3", 3).axes, [0, 1, 3]), "list binding");
  ok(eq(parseBind("AXIS: 2 , 4", 2).axes, [2, 4]), "case and whitespace tolerated");
  ok(eq(parseBind("pad:1 axis:2-3", 2), { pad: 1, axes: [2, 3] }), "pad and axes together");
  ok(parseBind("pad:0 axis:0", 1).pad === 0, "an explicit pad:0 is honoured, not treated as auto");
  ok(parseBind("pad:9 axis:0", 1).pad === 3, "pad index clamps to 3");
  ok(parseBind("pad:-2 axis:0", 1).pad === null, "a nonsense pad index stays on auto rather than pinning slot 0");
  ok(parseBind("axis:0-40", 2).axes.length === 41, "a long range is accepted verbatim (the poller guards missing axes)");
}

/* --- module-level contracts that the extraction cannot see --- */
ok(/export default function LiveInput/.test(src), "module default-exports the LiveInput component");
ok(/WRITE_MS\s*=\s*\d+/.test(src) && /IDLE_MS\s*=\s*\d+/.test(src), "throttle and idle constants are declared");
ok(/histRef/.test(src), "the component takes histRef (undo gating)");
ok(/st\.pend\[i\]/.test(src), "the pending-write guard is present (adoption race)");
ok(!/localStorage|sessionStorage/.test(src), "no browser storage");

/* --- App.jsx integration (era patch landed and survived) --- */
if (existsSync(APP)) {
  const app = readFileSync(APP, "utf8");
  ok(app.split('import LiveInput from "./live-input.jsx";').length === 2, "App.jsx imports LiveInput exactly once");
  ok(app.split("<LiveInput ").length === 2, "App.jsx mounts <LiveInput> exactly once");
  ok(app.split("const setParamsMulti").length === 2, "App.jsx declares setParamsMulti exactly once");
  ok(app.split("if (h.live) {").length === 2, "App.jsx history effect has the live gate");
  ok(app.split("DroPanel").length === 3, "sentinel: DroPanel still appears twice in App.jsx");
} else {
  console.log("SKIP src/App.jsx not present - integration checks not run");
}

console.log(fails ? "\n" + fails + " FAILURE(S)" : "\nALL OK");
process.exitCode = fails ? 1 : 0;
