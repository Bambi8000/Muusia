/* Validator for gcode_in — run from repo root: node tools/validate-gcode_in.mjs
   First line tells which source was tested ([lab] vs [baked]) — read it.

   The core oracle is a ROUNDTRIP: fixtures are emitted by a mini-port of
   App.jsx toGcode (bed-Z with z-hop + brush Z, and the servo variant, with
   the real header/comment/pause vocabulary), parsed back through the node,
   and compared point-by-point at 0.006 mm (toGcode rounds to 0.01, so the
   worst per-coordinate error is 0.005). The comparator itself is mutation-
   tested. Foreign-dialect fixtures cover G91/G20, G2/G3 arcs (IJ + R),
   G1-travel files and Latu additions (INK_DOSE / AIR_PULSE / E words).

   NOTE on the template's generic bounds test: this node's True-scale output
   lives in the FILE's canvas frame, not the current ctx, so cross-orientation
   bounds are asserted in Fit-to-margin mode instead (True scale is asserted
   only on the matching canvas). */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "gcode_in";

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
const load = (text) => ({ data: { svg: def.onFile(text) } });
const run = (p, node, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, node || {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => pt.every((v) => Number.isFinite(v))));

/* ---------- structural: the file-intake pair (API pitfall) ---------- */
ok(typeof def.onFile === "function", "onFile exists");
ok(def.params.some((q) => q.type === "file"), "type:'file' param exists (picker renders)");
ok(typeof def.fileAccept === "string" && def.fileAccept.includes(".gcode"), "fileAccept covers .gcode");

/* ---------- mini-port of toGcode (App.jsx), bed-Z + servo ---------- */
const f2 = (v) => Math.round(v * 100) / 100;
function emit(ps, ctx, prof) {
  const oX = prof.originX || 0, oY = prof.originY || 0;
  const fx = (x) => x + oX;
  const fy = (y) => (prof.flipY ? ctx.H - y : y) + oY;
  const zServo = prof.zMode === "servo";
  const L = [];
  L.push("; Muusia v2.83 \u2014 raw G-code");
  L.push(`; Machine: test \u2014 work area 330 x 240 mm`);
  L.push(`; Canvas ${ctx.W} x ${ctx.H} mm at origin X${oX} Y${oY} \u2014 paths ${ps.paths.length}${prof.flipY ? " \u2014 Y flipped" : ""}`);
  if (zServo) L.push(`; Z mode: SERVO "pen" \u2014 up ${prof.servoUp}\u00b0 / down ${prof.servoDown}\u00b0 (bed-Z untouched)`);
  L.push("G21 ; mm");
  L.push("G90 ; absolute");
  L.push("G28 ; home");
  const travelZ = () => (prof.zHopOn ? f2(Math.min(prof.penUp, prof.penDown + prof.zHop)) : f2(prof.penUp));
  const brushZ = (q) => (!zServo && typeof q[2] === "number" && isFinite(q[2]))
    ? ` Z${f2(Math.min(prof.penUp, prof.penDown - Math.max(-6, Math.min(6, q[2]))))}` : "";
  const up = (fullLift) => {
    if (zServo) L.push(`SET_SERVO SERVO=pen ANGLE=${f2(prof.servoUp)}`);
    else L.push(`G1 Z${fullLift ? f2(prof.penUp) : travelZ()} F600`);
  };
  const downC = () => {
    if (zServo) L.push(`SET_SERVO SERVO=pen ANGLE=${f2(prof.servoDown)} ; pen down`);
    else L.push(`G1 Z${f2(prof.penDown)} F600`);
    L.push("G4 P120 ; settle before draw");
  };
  if (zServo) L.push(`SET_SERVO SERVO=pen ANGLE=${f2(prof.servoUp)} ; pen up (servo)`);
  else L.push(`G1 Z${f2(prof.penUp)} F600 ; pen up (bed-Z)`);
  const layers = [...new Set(ps.paths.map((q) => q.layer))].sort((a, b) => a - b);
  let first = true, drawn = 0;
  for (const Ly of layers) {
    if (!first) {
      up(true);
      L.push(`M0 ; CHANGE PEN -> ${Ly % 12}: ${H.PENS[Ly % 12].name}`);
    } else L.push(`; Pen ${Ly % 12}: ${H.PENS[Ly % 12].name}`);
    first = false;
    for (const path of ps.paths.filter((q) => q.layer === Ly)) {
      let pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
      pts = pts.map((q) => [q[0], fy(q[1]), q[2]]);
      if (prof.maintOn && drawn >= prof.maintEvery) {
        L.push("; --- maintenance pause ---");
        up(true);
        L.push("M0 ; MAINTENANCE: advance chalk");
        L.push("; --- resume ---");
        drawn = 0;
      }
      L.push(`G0 X${f2(fx(pts[0][0]))} Y${f2(pts[0][1])} F6000`);
      downC();
      if (brushZ(pts[0])) L.push(`G1${brushZ(pts[0])} F600 ; brush pressure`);
      for (let i = 1; i < pts.length; i++) {
        L.push(`G1 X${f2(fx(pts[i][0]))} Y${f2(pts[i][1])}${brushZ(pts[i])} F1800`);
        drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      }
      up(false);
    }
  }
  up(true);
  L.push("G0 X0 Y0");
  return L.join("\n");
}
const PROF_BED = { originX: 20, originY: 30, flipY: true, zMode: "bed", penUp: 3, penDown: 0, zHopOn: true, zHop: 1 };
const PROF_SERVO = { originX: 5, originY: 0, flipY: false, zMode: "servo", servoUp: 92, servoDown: 34, penUp: 3, penDown: 0 };

/* ---------- fixture path set (canvas 297x210, inside margins) ---------- */
const circle = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const F_PS = { paths: [
  { pts: [[30, 40], [120, 40], [120, 90], [30, 90]], closed: true, layer: 0 },
  { pts: [[40, 120], [80, 160], [120, 120], [160, 160]], closed: false, layer: 0 },
  { pts: [[180, 60, 0.8], [220, 60, 1.2], [260, 90, -0.5], [270, 120]], closed: false, layer: 2 },
  { pts: circle(200, 160, 30, 240), closed: true, layer: 2 },
] };
const CTX = { W: 297, H: 210 };
const G_BED = emit(F_PS, CTX, PROF_BED);
const G_BED_M = emit(F_PS, CTX, { ...PROF_BED, maintOn: true, maintEvery: 150 });
const G_SERVO = emit(F_PS, CTX, PROF_SERVO);
/* Latu-style additions injected into the bed fixture */
const G_LATU = G_BED
  .replace("G90 ; absolute", "G90 ; absolute\nM83 ; relative extrusion\nINK_DOSE UL=12\nAIR_PULSE MS=40")
  .replace(/G1 X120 Y/, "G1 E0.4 X120 Y");

const p0 = defaults();
const nBed = load(G_BED);

/* ---------- universal invariants ---------- */
const r1 = run(p0, nBed), r2 = run(p0, nBed);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length === F_PS.paths.length, "path count survives roundtrip (" + r1.paths.length + ")");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults (" + npts(r1) + ")");
ok(JSON.stringify(run(p0, {})) === JSON.stringify(H.EMPTY), "no file -> EMPTY");
ok(JSON.stringify(run(p0, load(""))) === JSON.stringify(H.EMPTY), "empty file -> EMPTY");
ok(JSON.stringify(run(p0, load("hello world\nthis is not gcode ; comment"))) === JSON.stringify(H.EMPTY), "garbage -> EMPTY");

/* ---------- roundtrip oracle + its mutation test ---------- */
const cmp = (src, got, tol) => {
  if (got.paths.length !== src.paths.length) return "path count " + got.paths.length + " != " + src.paths.length;
  for (let i = 0; i < src.paths.length; i++) {
    const a = src.paths[i], b = got.paths[i];
    if (!!a.closed !== !!b.closed) return "path " + i + " closed flag";
    if (a.layer % 12 !== b.layer) return "path " + i + " layer " + b.layer + " != " + (a.layer % 12);
    if (a.pts.length !== b.pts.length) return "path " + i + " pts " + b.pts.length + " != " + a.pts.length;
    for (let j = 0; j < a.pts.length; j++) {
      if (Math.abs(a.pts[j][0] - b.pts[j][0]) > tol) return "path " + i + " pt " + j + " x";
      if (Math.abs(a.pts[j][1] - b.pts[j][1]) > tol) return "path " + i + " pt " + j + " y";
      const ia = a.pts[j].length > 2 ? a.pts[j][2] : 0;
      const ib = b.pts[j].length > 2 ? b.pts[j][2] : 0;
      if (Math.abs(ia - ib) > tol) return "path " + i + " pt " + j + " brushZ " + ib + " != " + ia;
    }
  }
  return null;
};
{
  const e = cmp(F_PS, r1, 0.006);
  ok(e === null, "ROUNDTRIP bed-Z + z-hop + flipY + brush Z exact to 0.006 mm" + (e ? " (" + e + ")" : ""));
  /* mutation-test the oracle: it must fail on shifted points, wrong layer, dropped closed */
  const mut1 = JSON.parse(JSON.stringify(r1)); mut1.paths[1].pts[1][0] += 0.1;
  ok(cmp(F_PS, mut1, 0.006) !== null, "oracle mutation: 0.1 mm shift is caught");
  const mut2 = JSON.parse(JSON.stringify(r1)); mut2.paths[3].layer = 5;
  ok(cmp(F_PS, mut2, 0.006) !== null, "oracle mutation: wrong layer is caught");
  const mut3 = JSON.parse(JSON.stringify(r1)); mut3.paths[0].closed = false; mut3.paths[0].pts.push(mut3.paths[0].pts[0]);
  ok(cmp(F_PS, mut3, 0.006) !== null, "oracle mutation: lost closed flag is caught");
  const mut4 = JSON.parse(JSON.stringify(r1)); mut4.paths[2].pts[1] = [mut4.paths[2].pts[1][0], mut4.paths[2].pts[1][1]];
  ok(cmp(F_PS, mut4, 0.006) !== null, "oracle mutation: dropped brush Z is caught");
}
{
  const e = cmp(F_PS, run(p0, load(G_SERVO)), 0.006);
  ok(e === null || e.indexOf("brushZ") >= 0, "ROUNDTRIP servo mode geometry exact" + (e && e.indexOf("brushZ") < 0 ? " (" + e + ")" : ""));
  /* servo mode cannot carry brush Z; assert XY-only equality */
  const got = run(p0, load(G_SERVO));
  let xyok = got.paths.length === F_PS.paths.length;
  for (let i = 0; xyok && i < F_PS.paths.length; i++)
    for (let j = 0; xyok && j < F_PS.paths[i].pts.length; j++)
      xyok = Math.abs(F_PS.paths[i].pts[j][0] - got.paths[i].pts[j][0]) <= 0.006
        && Math.abs(F_PS.paths[i].pts[j][1] - got.paths[i].pts[j][1]) <= 0.006;
  ok(xyok, "servo roundtrip XY exact to 0.006 mm");
}
{
  const e = cmp(F_PS, run(p0, load(G_BED_M)), 0.006);
  ok(e === null, "maintenance M0 mid-file does not break layers or paths" + (e ? " (" + e + ")" : ""));
  const e2 = cmp(F_PS, run(p0, load(G_LATU)), 0.006);
  ok(e2 === null, "Latu additions (M83/INK_DOSE/AIR_PULSE/E word) are transparent" + (e2 ? " (" + e2 + ")" : ""));
}
{
  /* drawing order preserved: first points appear in file order */
  const starts = r1.paths.map((q) => q.pts[0].slice(0, 2));
  const want = F_PS.paths.map((q) => q.pts[0]);
  ok(starts.every((s, i) => Math.hypot(s[0] - want[i][0], s[1] - want[i][1]) <= 0.006), "drawing order preserved");
}

/* ---------- foreign dialects ---------- */
const G_FOREIGN_Z = [
  "G21", "G90",
  "G0 X10 Y10 Z5", "G1 Z0 F300",
  "G1 X50 Y10 F1000", "G1 X50 Y50",
  "G1 Z5",
  "G1 X80 Y80 F3000",
  "G1 Z0", "G1 X90 Y80", "G1 Z5",
].join("\n");
{
  const base = { ...p0, coords: "As written" };
  const rAuto = run(base, load(G_FOREIGN_Z));
  ok(rAuto.paths.length === 2, "foreign z-file, Auto: G1 travel at safe Z stays a travel (" + rAuto.paths.length + " paths)");
  const rG01 = run({ ...base, mode: "G0 travel / G1 draw" }, load(G_FOREIGN_Z));
  ok(JSON.stringify(rG01) !== JSON.stringify(rAuto), "param live: mode (Auto vs G0/G1 differ on foreign file)");
  const rT1 = run({ ...base, mode: "Z threshold", zthresh: 0.5 }, load(G_FOREIGN_Z));
  const rT2 = run({ ...base, mode: "Z threshold", zthresh: 10 }, load(G_FOREIGN_Z));
  ok(rT1.paths.length === 2 && rT2.paths.length === 1, "Z threshold semantics (0.5 -> 2 paths, 10 -> 1 merged)");
  ok(JSON.stringify(rT1) !== JSON.stringify(rT2), "param live: zthresh (in Z threshold mode)");
}
const G_FOREIGN_ARC = [
  "G20", "G90",
  "G0 X1 Y1",
  "G2 X2 Y1 I0.5 J0 F10",
  "G91", "G1 X0.5 Y0", "G90",
  "G3 X3.5 Y1 R0.25",
].join("\n");
{
  const r = run({ ...p0, mode: "G0 travel / G1 draw", coords: "As written" }, load(G_FOREIGN_ARC));
  ok(r.paths.length === 1 && finiteAll(r), "foreign arcs+units parse to one polyline");
  const pts = r.paths[0].pts;
  const last = pts[pts.length - 1];
  ok(Math.abs(last[0] - 3.5 * 25.4) <= 0.01 && Math.abs(last[1] - 1 * 25.4) <= 0.01, "G20 inch scaling + G91 relative + arc endpoints land exactly");
  /* every IJ-arc point sits on the radius: slice between the arc's endpoints */
  const cx = 1.5 * 25.4, cy = 1 * 25.4, rr = 0.5 * 25.4;
  const near = (q, X, Y) => Math.hypot(q[0] - X, q[1] - Y) <= 0.01;
  const i0 = pts.findIndex((q) => near(q, 1 * 25.4, 1 * 25.4));
  const i1 = pts.findIndex((q) => near(q, 2 * 25.4, 1 * 25.4));
  const arcPts = i0 >= 0 && i1 > i0 ? pts.slice(i0, i1 + 1) : [];
  const onR = arcPts.every((q) => Math.abs(Math.hypot(q[0] - cx, q[1] - cy) - rr) <= 0.05);
  ok(arcPts.length >= 20 && onR, "IJ arc tessellated on the radius (" + arcPts.length + " pts, ~0.5 mm step)");
}

/* ---------- parameter liveness ---------- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, node, base) =>
  ok(JSON.stringify(run({ ...(base || p0), ...patch }, node || nBed)) !== JSON.stringify(base ? run(base, node || nBed) : r1) && true,
    "param live: " + label);
diff({ layers: "Single pen" }, "layers (Auto vs Single)");
diff({ layer: 3 }, "layer (in Single mode)", nBed, { ...p0, layers: "Single pen" });
diff({ coords: "As written" }, "coords (header inversion vs raw)");
diff({ placement: "Fit to margin" }, "placement");
diff({ margin: 30 }, "margin (in Fit mode)", nBed, { ...p0, placement: "Fit to margin" });
diff({ offx: 20 }, "offx");
diff({ offy: 20 }, "offy");
diff({ simplify: 1.5 }, "simplify");
diff({ brushz: "Ignore" }, "brushz");

/* simplify semantics: fewer points, endpoints kept */
{
  const rs = run({ ...p0, simplify: 1.5 }, nBed);
  ok(npts(rs) < npts(r1), "simplify reduces points (" + npts(r1) + " -> " + npts(rs) + ")");
  const a0 = r1.paths[1].pts[0], b0 = rs.paths[1].pts[0];
  const aN = r1.paths[1].pts[r1.paths[1].pts.length - 1], bN = rs.paths[1].pts[rs.paths[1].pts.length - 1];
  ok(Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) < 1e-9 && Math.hypot(aN[0] - bN[0], aN[1] - bN[1]) < 1e-9, "simplify keeps endpoints");
}
/* brushz Ignore really strips third components */
{
  const ri = run({ ...p0, brushz: "Ignore" }, nBed);
  ok(ri.paths.every((q) => q.pts.every((pt) => pt.length === 2)), "brushz Ignore strips immersion");
  ok(r1.paths[2].pts.some((pt) => pt.length === 3), "brushz Keep carries immersion");
}
/* layer modulo guard */
{
  const g13 = G_BED.replace("CHANGE PEN -> 2:", "CHANGE PEN -> 13:");
  const r13 = run(p0, load(g13));
  ok(r13.paths.every((q) => q.layer >= 0 && q.layer <= 11), "CHANGE PEN -> 13 wraps into 0..11");
}
/* Split at pauses overrides pen comments; maintenance blocks are skipped so
   their M0 is NOT a split point */
{
  const rsp = run({ ...p0, layers: "Split at pauses" }, load(G_BED_M));
  const Ls = [...new Set(rsp.paths.map((q) => q.layer))].sort((a, b) => a - b);
  ok(Ls.length === 2, "Split at pauses: pen-change M0 splits, maintenance M0 does not: " + JSON.stringify(Ls));
}
/* dip block is transparent (skipped between its comment markers) */
{
  const G_DIP = G_BED.replace("G28 ; home",
    "G28 ; home\n; --- dip ---\nG1 Z3 F600\nG0 X310 Y5 F6000\nG1 Z-2 F600 ; plunge\nG4 P400 ; dwell ms\nG1 Z3 F600\n; --- dip done ---");
  const e = cmp(F_PS, run(p0, load(G_DIP)), 0.006);
  ok(e === null, "dip block is transparent" + (e ? " (" + e + ")" : ""));
}

/* ---------- every select option renders finite, non-empty ---------- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt }, nBed);
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* ---------- bounds ---------- */
const tol = 0.05;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every((pt) => pt[0] >= -tol && pt[0] <= W + tol && pt[1] >= -tol && pt[1] <= Hh + tol));
ok(inb(r1, 297, 210), "True scale in bounds on the matching canvas");
ok(inb(run({ ...p0, placement: "Fit to margin" }, nBed, { W: 297, H: 210 }), 297, 210), "Fit in bounds on A4 wide");
ok(inb(run({ ...p0, placement: "Fit to margin" }, nBed, { W: 210, H: 297 }), 210, 297), "Fit in bounds on A4 tall");

/* ---------- degenerate and extreme ---------- */
ok(finiteAll(run({ ...p0, simplify: 2, offx: -400, offy: 400 }, nBed)), "extreme offsets/simplify: no NaN");
ok(finiteAll(run({ ...p0, placement: "Fit to margin", margin: 60 }, nBed, { W: 100, H: 80 })), "tiny canvas + max margin: no NaN");
ok(finiteAll(run({ ...p0, mode: "Z threshold", zthresh: -5 }, nBed)) , "zthresh -5: no NaN (may be empty)");
{
  /* budget: one giant path truncates cleanly at 115000 */
  const big = ["G90", "G0 X0 Y0", "G1 Z0"];
  for (let i = 1; i <= 120010; i++) big.push("G1 X" + (i % 200) + " Y" + Math.floor(i / 200));
  const rb = run({ ...p0, coords: "As written" }, load(big.join("\n")));
  ok(npts(rb) === 115000 && finiteAll(rb), "point budget capped at 115000 (" + npts(rb) + ")");
}

/* ---------- showIf ---------- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  const v0 = vis(p0);
  ok(!v0.includes("zthresh") && !v0.includes("layer") && !v0.includes("margin") && v0.includes("offx"), "showIf at defaults: offsets visible, zthresh/layer/margin hidden");
  ok(vis({ ...p0, mode: "Z threshold" }).includes("zthresh"), "showIf: zthresh appears in Z threshold mode");
  ok(vis({ ...p0, placement: "Fit to margin" }).includes("margin") && !vis({ ...p0, placement: "Fit to margin" }).includes("offx"), "showIf: Fit swaps offsets for margin");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "hidden params still carry defaults");
}

/* ---------- overlay ---------- */
{
  const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, nBed);
  ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "rect" && g1[0].w === 297 && g1[0].h === 210, "overlay True scale: header canvas rect");
  const g2 = def.overlay({ ...p0, placement: "Fit to margin", margin: 10 }, { W: 297, H: 210 }, undefined, nBed);
  ok(g2.length === 1 && g2[0].kind === "rect" && g2[0].x === 10, "overlay Fit: margin box");
  const g3 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g3) && g3.length === 1 && g3[0].kind === "point", "overlay without data: offset point");
  let threw = false;
  try { def.overlay(null, null, undefined, undefined); def.overlay(p0, { W: 4, H: 4 }, undefined, { data: { svg: { meta: null } } }); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
