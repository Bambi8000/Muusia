/* tools/validate-clockface.mjs — Clock Face oracles
 *
 * Auto-switches: baked src/defs/nodes/clockface.js when present, otherwise
 * nodes-lab/clockface.plotternode.js. Run from repo root:
 *   node tools/validate-clockface.mjs
 *
 * Oracles:
 *   C1 determinism
 *   C2 path counts: hours*batons + minute marks + center + rim, exact,
 *      across Lines/Dots/None, center on/off, rim on/off
 *   C3 keystone=0 -> every baton is a true rectangle (equal opposite
 *      sides, perpendicular corners); keystone=k -> outer/inner width
 *      ratio == (1+k)/(1-k)
 *   C4 quarter rule: hours=12 + quarterScale=1.5 -> batons 0/3/6/9 have
 *      1.5x radial length, others 1.0x; hours=10 -> only baton 0
 *   C5 12-o'clock baton axis-aligned at rot=0: centered on X, outer edge
 *      at Y - (R - inset); rot=90 rotates every baton point by exactly 90deg
 *   C6 minute marks never sit at hour angles; tick length == minTick
 *   C7 rim radius == R * rimR/100 (max distance from center); layer routing:
 *      batons/center/rim on penH, minutes on penM
 *   C8 degenerate safety: keystone=±1 (triangle), inset > R, len > R,
 *      hours=2 — no NaN, no throw
 */
import { readFileSync, existsSync } from "node:fs";
import { Pin, EMPTY, applyStyle } from "../src/defs/helpers.js";

const BAKED = new URL("../src/defs/nodes/clockface.js", import.meta.url);
const LAB = new URL("../nodes-lab/clockface.plotternode.js", import.meta.url);
let def, mode;
if (existsSync(BAKED)) { def = (await import(BAKED.href)).default; mode = "baked"; }
else { def = eval(readFileSync(LAB, "utf8")); mode = "lab"; }

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const close = (a, b, t) => Math.abs(a - b) <= t;
const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CTX = { W: 300, H: 200 };
const base = () => { const o = {}; def.params.forEach((pd) => (o[pd.key] = pd.def)); return o; };
const finiteAll = (r) => r.paths.every((pa) => pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));

/* C1 */
{
  const p = { ...base(), rim: true, minutes: "Dots" };
  ok(deep(def.compute([], p, CTX), def.compute([], p, CTX)), "C1: determinism");
}

/* C2 counts */
{
  const cases = [
    [{ minutes: "Lines" }, 12 + 12 * 4 + 1 + 0],
    [{ minutes: "Dots" }, 12 + 12 * 4 + 1 + 0],
    [{ minutes: "None" }, 12 + 0 + 1 + 0],
    [{ minutes: "None", showCenter: false }, 12],
    [{ minutes: "None", showCenter: false, rim: true }, 13],
    [{ hours: 24, subs: 2, minutes: "Lines", showCenter: false }, 24 + 24 * 2],
  ];
  for (const [over, want] of cases) {
    const r = def.compute([], { ...base(), ...over }, CTX);
    ok(r.paths.length === want, `C2: ${JSON.stringify(over)} -> ${r.paths.length} paths (want ${want})`);
  }
}

/* C3 keystone geometry */
{
  const p = { ...base(), minutes: "None", showCenter: false, keystone: 0 };
  const r = def.compute([], p, CTX);
  let rectOK = true;
  for (const pa of r.paths) {
    const [A, B, C, D] = pa.pts;
    const d = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    const dot = (u, v, w) => (v[0] - u[0]) * (w[0] - v[0]) + (v[1] - u[1]) * (w[1] - v[1]);
    if (!close(d(A, B), d(C, D), 1e-9) || !close(d(B, C), d(D, A), 1e-9)) rectOK = false;
    if (Math.abs(dot(A, B, C)) > 1e-6) rectOK = false;
  }
  ok(rectOK, "C3: keystone=0 -> true rectangles (4 right-angled equal-opposite quads)");
  const k = 0.4;
  const r2 = def.compute([], { ...p, keystone: k }, CTX);
  const [A, B, C, D] = r2.paths[0].pts;
  const outerW = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const innerW = Math.hypot(C[0] - D[0], C[1] - D[1]);
  ok(close(outerW / innerW, (1 + k) / (1 - k), 1e-9), `C3: keystone=${k} -> width ratio (1+k)/(1-k) (got ${(outerW / innerW).toFixed(6)})`);
}

/* C4 quarter rule */
{
  const X = 150, Y = 100;
  const radialLen = (pa, i, hours) => {
    /* project corners on the baton's own radial axis — corner distance from
       center is hypot(r, halfWidth), so plain radii would leak width in */
    const a = ((i * 360) / hours) * (Math.PI / 180);
    const dx = Math.sin(a), dy = -Math.cos(a);
    const t = pa.pts.map((q) => (q[0] - X) * dx + (q[1] - Y) * dy);
    return Math.max(...t) - Math.min(...t);
  };
  const p = { ...base(), minutes: "None", showCenter: false, quarterScale: 1.5 };
  const r = def.compute([], p, CTX);
  let good = true;
  r.paths.forEach((pa, i) => {
    const L = radialLen(pa, i, 12);
    const want = [0, 3, 6, 9].includes(i) ? p.len * 1.5 : p.len;
    if (!close(L, want, 1e-6)) good = false;
  });
  ok(good, "C4: hours=12 quarterScale=1.5 -> 0/3/6/9 are 1.5x radial length");
  const r10 = def.compute([], { ...p, hours: 10 }, CTX);
  let good10 = true;
  r10.paths.forEach((pa, i) => {
    const L = radialLen(pa, i, 10);
    const want = [0, 5].includes(i) ? p.len * 1.5 : p.len; /* 0 and 1/2 are the only exact quarter fractions of 10 */
    if (!close(L, want, 1e-6)) good10 = false;
  });
  ok(good10, "C4: hours=10 -> exactly the quarter-fraction markers scale (top + bottom)");
}

/* C5 orientation */
{
  const p = { ...base(), minutes: "None", showCenter: false, inset: 5 };
  const r = def.compute([], p, CTX);
  const top = r.paths[0].pts;
  const X = 150, Y = 100, R = p.diameter / 2;
  ok(close((top[0][0] + top[1][0]) / 2, X, 1e-9), "C5: 12-o'clock baton centered on X");
  ok(close(Math.min(...top.map((q) => q[1])), Y - (R - p.inset), 1e-9), "C5: outer edge at Y - (R - inset)");
  const r90 = def.compute([], { ...p, rot: 90 }, CTX);
  let rotOK = true;
  r.paths.forEach((pa, i) => {
    pa.pts.forEach((q, j) => {
      const rx = X - (q[1] - Y), ry = Y + (q[0] - X); /* +90deg clockwise, screen coords */
      const q2 = r90.paths[i].pts[j];
      if (!close(q2[0], rx, 1e-9) || !close(q2[1], ry, 1e-9)) rotOK = false;
    });
  });
  ok(rotOK, "C5: rot=90 rotates every baton point by exactly 90 degrees");
}

/* C6 minutes */
{
  const p = { ...base(), minutes: "Lines", showCenter: false };
  const r = def.compute([], p, CTX);
  const ticks = r.paths.slice(12);
  ok(ticks.length === 48, `C6: 12h x 4 subs -> 48 ticks (got ${ticks.length})`);
  const X = 150, Y = 100;
  let lenOK = true, angOK = true;
  const hourAngles = new Set();
  for (let i = 0; i < 12; i++) hourAngles.add(Math.round((i * 30) * 1000));
  for (const t of ticks) {
    const L = Math.hypot(t.pts[0][0] - t.pts[1][0], t.pts[0][1] - t.pts[1][1]);
    if (!close(L, p.minTick, 1e-9)) lenOK = false;
    const a = ((Math.atan2(t.pts[0][0] - X, -(t.pts[0][1] - Y)) * 180) / Math.PI + 360) % 360;
    if (hourAngles.has(Math.round(a * 1000))) angOK = false;
  }
  ok(lenOK, "C6: tick length == minTick");
  ok(angOK, "C6: no tick sits at an hour angle");
}

/* C7 rim + pens */
{
  const p = { ...base(), minutes: "Lines", rim: true, rimR: 80, penH: 2, penM: 5 };
  const r = def.compute([], p, CTX);
  const X = 150, Y = 100, R = p.diameter / 2;
  const rim = r.paths[r.paths.length - 1];
  const maxD = Math.max(...rim.pts.map((q) => Math.hypot(q[0] - X, q[1] - Y)));
  ok(close(maxD, (R * 80) / 100, 1e-6), `C7: rim radius == R*rimR/100 (got ${maxD.toFixed(3)})`);
  const batons = r.paths.slice(0, 12), ticks = r.paths.slice(12, 60);
  ok(batons.every((pa) => pa.layer === 2) && rim.layer === 2, "C7: batons + rim on Markers pen");
  ok(ticks.every((pa) => pa.layer === 5), "C7: minute marks on Minutes pen");
}

/* C8 degenerates */
{
  for (const over of [{ keystone: 1 }, { keystone: -1 }, { inset: 40, diameter: 40 }, { len: 60, diameter: 20 }, { hours: 2 }]) {
    let threw = false, r = null;
    try { r = def.compute([], { ...base(), ...over, rim: true }, CTX); } catch (e) { threw = true; }
    ok(!threw && r && finiteAll(r), `C8: ${JSON.stringify(over)} — no throw, all coords finite`);
  }
  let othrew = false;
  try { def.overlay({ ...base(), diameter: 0 }, CTX); } catch (e) { othrew = true; }
  ok(!othrew, "C8: overlay never throws (diameter 0)");
}

console.log(`\n${mode.toUpperCase()} mode — ${fails === 0 ? "ALL ORACLES PASS" : fails + " FAILURE(S)"}`);
process.exit(fails === 0 ? 0 : 1);
