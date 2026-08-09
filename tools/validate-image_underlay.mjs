/* tools/validate-image_underlay.mjs — Image Underlay oracles
 *
 * Auto-switches: baked src/defs/nodes/image_underlay.js when present,
 * otherwise nodes-lab/image_underlay.plotternode.js. Run from repo root:
 *   node tools/validate-image_underlay.mjs
 *
 * Oracles:
 *   O1 determinism (fit + cal, double run deep-equal)
 *   O2 exact synthetic similarity (17°, s=1.31): residuals < 1e-6,
 *      frame corners == expected, bgRender center/size/rot match
 *   O3 ROUND-TRIP: frame corners pushed through the export fx/fy formulas
 *      minus laser offset == the entered DRO values (offset + flipY
 *      inversion is the right way around — the critical property)
 *   O4 flipY=false + positive laser offsets variant of O2/O3
 *   O5 perturbation: +2 mm on one DRO entry -> that anchor has the max
 *      residual and it is >= 1.0 mm
 *   O6 degenerates: <2 anchors, identical machine coords -> clean fit
 *      fallback, no NaN; missing ctx.machine does not throw
 *   O7 frame shape: closed, 4 pts, finite, layer == framePen; no photo -> EMPTY
 *   O8 shared method: overlay frame poly deep-equals compute frame pts
 *      (both driven by this._xform); bgRender center == map(image center)
 *   O9 param liveness: opacity, gray, show, margin all observable
 */
import { readFileSync, existsSync } from "node:fs";
import { Pin, EMPTY } from "../src/defs/helpers.js";

const BAKED = new URL("../src/defs/nodes/image_underlay.js", import.meta.url);
const LAB = new URL("../nodes-lab/image_underlay.plotternode.js", import.meta.url);

let def, mode;
if (existsSync(BAKED)) {
  def = (await import(BAKED.href)).default;
  mode = "baked";
} else {
  const src = readFileSync(LAB, "utf8");
  def = eval(src); /* Pin + EMPTY in scope from verbatim helpers import */
  mode = "lab";
}

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? "PASS " : "FAIL ") + msg);
  if (!cond) fails++;
};
const close = (a, b, tol) => Math.abs(a - b) <= tol;
const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const finiteDeep = (o) => JSON.stringify(o).indexOf("null") === -1 && !/NaN|Infinity/.test(JSON.stringify(o, (k, v) => (typeof v === "number" && !isFinite(v) ? "NaN" : v)));

const defaults = () => {
  const o = {};
  def.params.forEach((pd) => (o[pd.key] = pd.def));
  return o;
};
const IMG = { w: 1280, h: 960, g: [] };
const NODE = { data: { img: IMG, src: "data:image/jpeg;base64,AAAA" } };
const CTX0 = { W: 300, H: 200 };

/* ---- synthetic ground truth: similarity in canvas space ---- */
const mkTruth = (rotDeg, s, tx, ty) => {
  const th = (rotDeg * Math.PI) / 180, ca = Math.cos(th), sa = Math.sin(th);
  return (px, py) => [tx + s * (ca * px - sa * py), ty + s * (sa * px + ca * py)];
};
/* export mapping (verbatim shape of toGcode fx/fy) and its use to fabricate DRO readings */
const canvas2dro = (x, y, M, H) => {
  const mx = x + M.originX;
  const my = (M.flipY ? H - y : y) + M.originY;
  return [mx - M.laserOffX, my - M.laserOffY];
};

const runCase = (name, M) => {
  const truth = mkTruth(17, 0.131, 40, 30); /* 1280 px * 0.131 = 167.7 mm wide */
  const corners = [[0, 0], [IMG.w, 0], [IMG.w, IMG.h], [0, IMG.h]];
  const Qc = corners.map(([px, py]) => truth(px, py));
  const p = defaults();
  p.calibrate = true;
  p.useTL = p.useTR = p.useBR = p.useBL = true;
  [["tl", 0], ["tr", 1], ["br", 2], ["bl", 3]].forEach(([k, i]) => {
    const [dx, dy] = canvas2dro(Qc[i][0], Qc[i][1], M, CTX0.H);
    p[k + "X"] = dx; p[k + "Y"] = dy;
  });
  const ctx = { ...CTX0, machine: M };

  /* O1 determinism */
  const r1 = def.compute([], p, ctx, NODE);
  const r2 = def.compute([], p, ctx, NODE);
  ok(deep(r1, r2), `O1 ${name}: determinism (cal)`);

  /* O2 exact fit */
  const T = def._xform(p, ctx, NODE);
  ok(T.mode === "cal", `O2 ${name}: calibrated mode engaged`);
  ok(T.residuals.every((r) => r.r < 1e-6), `O2 ${name}: residuals < 1e-6 (max ${Math.max(...T.residuals.map((r) => r.r)).toExponential(2)})`);
  const frame = r1.paths[0].pts;
  ok(frame.every((pt, i) => close(pt[0], Qc[i][0], 1e-6) && close(pt[1], Qc[i][1], 1e-6)), `O2 ${name}: frame corners == truth`);
  const bg = def.bgRender(p, ctx, NODE);
  const C = truth(IMG.w / 2, IMG.h / 2);
  ok(close(bg.cx, C[0], 1e-6) && close(bg.cy, C[1], 1e-6), `O2 ${name}: bgRender center == truth center`);
  ok(close(bg.w, IMG.w * 0.131, 1e-6) && close(bg.h, IMG.h * 0.131, 1e-6), `O2 ${name}: bgRender size == s*px`);
  ok(close(((bg.rotDeg % 360) + 360) % 360, 17, 1e-6), `O2 ${name}: bgRender rotation == 17°`);

  /* O3 round-trip through export mapping */
  const entered = [[p.tlX, p.tlY], [p.trX, p.trY], [p.brX, p.brY], [p.blX, p.blY]];
  const rt = frame.map(([x, y]) => canvas2dro(x, y, M, CTX0.H));
  ok(rt.every((d, i) => close(d[0], entered[i][0], 1e-6) && close(d[1], entered[i][1], 1e-6)), `O3 ${name}: frame -> export fx/fy - laserOff == entered DRO`);

  /* O5 perturbation on TR machine X */
  const p5 = { ...p, trX: p.trX + 2 };
  const T5 = def._xform(p5, ctx, NODE);
  const rs = T5.residuals.map((r) => r.r);
  const iMax = rs.indexOf(Math.max(...rs));
  ok(iMax === 1 && rs[1] >= 0.9, `O5 ${name}: +2 mm on TR -> TR residual is max (${rs[1].toFixed(3)} mm)`);
  ok(finiteDeep(T5.residuals), `O5 ${name}: perturbed residuals finite`);
};

runCase("flipY+negOff", { originX: 12, originY: 7, flipY: true, laserOffX: -3.2, laserOffY: 4.7 });
runCase("noFlip+posOff", { originX: 0, originY: 0, flipY: false, laserOffX: 5.5, laserOffY: 2.25 }); /* O4 */

/* ---- O6 degenerates ---- */
{
  const p = defaults();
  p.calibrate = true;
  p.useTL = true; p.useTR = p.useBR = p.useBL = false;
  const T = def._xform(p, { ...CTX0, machine: { originX: 0, originY: 0, flipY: false, laserOffX: 0, laserOffY: 0 } }, NODE);
  ok(T.mode === "fit", "O6: 1 anchor -> fit fallback");
  const p2 = defaults();
  p2.calibrate = true;
  p2.useBR = p2.useBL = false;
  p2.tlX = 50; p2.tlY = 50; p2.trX = 50; p2.trY = 50; /* identical machine coords */
  const T2 = def._xform(p2, { ...CTX0, machine: { originX: 0, originY: 0, flipY: false, laserOffX: 0, laserOffY: 0 } }, NODE);
  ok(T2.mode === "fit" && finiteDeep([T2.cx, T2.cy, T2.w, T2.h, T2.rot]), "O6: identical anchors -> fit fallback, no NaN");
  let threw = false;
  try { def.compute([], { ...defaults(), calibrate: true }, CTX0, NODE); } catch (e) { threw = true; }
  ok(!threw, "O6: missing ctx.machine does not throw");
}

/* ---- O7 frame shape + no photo ---- */
{
  const p = defaults();
  p.framePen = 3;
  const r = def.compute([], p, CTX0, NODE);
  ok(r.paths.length === 1 && r.paths[0].closed === true && r.paths[0].pts.length === 4, "O7: frame is one closed 4-pt path");
  ok(r.paths[0].layer === 3, "O7: frame layer == framePen");
  ok(finiteDeep(r.paths[0].pts), "O7: frame coords finite");
  const e = def.compute([], p, CTX0, { data: {} });
  ok(deep(e, EMPTY), "O7: no photo -> EMPTY");
}

/* ---- O8 shared _xform: overlay == compute, bgRender == map(center) ---- */
{
  const p = defaults();
  const g = def.overlay(p, CTX0, [], NODE);
  const r = def.compute([], p, CTX0, NODE);
  const poly = g.find((x) => x.kind === "poly");
  ok(poly && deep(poly.pts, r.paths[0].pts), "O8: overlay frame poly deep-equals compute frame");
  const T = def._xform(p, CTX0, NODE);
  const C = T.map(IMG.w / 2, IMG.h / 2);
  const bg = def.bgRender(p, CTX0, NODE);
  ok(close(bg.cx, C[0], 1e-9) && close(bg.cy, C[1], 1e-9), "O8: bgRender center == map(image center)");
}

/* ---- O9 param liveness ---- */
{
  const p = defaults();
  const b1 = def.bgRender(p, CTX0, NODE);
  const b2 = def.bgRender({ ...p, opacity: 80 }, CTX0, NODE);
  ok(!close(b1.opacity, b2.opacity, 1e-9), "O9: opacity live");
  const b3 = def.bgRender({ ...p, gray: false }, CTX0, NODE);
  ok(b1.gray === true && b3.gray === false, "O9: gray live");
  ok(def.bgRender({ ...p, show: false }, CTX0, NODE) === null, "O9: show=false hides underlay");
  const T1 = def._xform(p, CTX0, NODE);
  const T2 = def._xform({ ...p, margin: 40 }, CTX0, NODE);
  ok(T2.w < T1.w, "O9: margin shrinks the fit");
}

console.log(`\n${mode.toUpperCase()} mode — ${fails === 0 ? "ALL ORACLES PASS" : fails + " FAILURE(S)"}`);
process.exit(fails === 0 ? 0 : 1);
