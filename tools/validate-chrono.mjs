/* Validator for the Chronophoto node (key: chrono).
   Run from the repo root: node tools/validate-chrono.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "chrono";

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

const CTX = { W: 297, H: 210 };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx, ins) => def.compute(ins || [undefined, undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const MOTIONS = ["Long jump", "Walk", "Run", "High jump", "Standing jump", "Somersault"];
const WAVE = { paths: [{ pts: Array.from({ length: 40 }, (_, i) => [30 + i * 6, 120 + Math.sin(i / 6) * 40]), closed: false, layer: 0 }] };

/* ---------- universal ---------- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.01;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, 0), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, 0), "in bounds on A4 tall");
for (const mo of MOTIONS) ok(inb(run({ ...p0, motion: mo, height: 200, frames: 12 }), 297, 210, p0.margin), "fit (shrink only): " + mo + " at Height 200 stays inside the margin box");
{
  const Fs = def._frames([undefined, undefined], { ...p0, motion: "Walk", height: 30 }, CTX), Fb = def._frames([undefined, undefined], { ...p0, motion: "Walk", height: 60 }, CTX);
  const spine = (F) => { const A = F.toC(F.frames[0], F.proj(F.frames[0], "pelvis")), B = F.toC(F.frames[0], F.proj(F.frames[0], "neck")); return Math.hypot(A[0] - B[0], A[1] - B[1]); };
  ok(Math.abs(spine(Fb) / spine(Fs) - 2) < 1e-9 && Math.abs(spine(Fs) - 9) < 1e-9, "fit never grows: Height 60 spine is exactly twice Height 30 (" + spine(Fs).toFixed(2) + " -> " + spine(Fb).toFixed(2) + ")");
  const Ffit = def._frames([undefined, undefined], { ...p0, motion: "Long jump", height: 200, frames: 12 }, CTX);
  ok(spine(Ffit) < 60, "fit shrinks an oversized sequence (spine " + spine(Ffit).toFixed(1) + " < 60)");
}

/* ---------- skeleton access through the def's own planner ---------- */
const frames = (p, ins) => { const F = def._frames(ins || [undefined, undefined], p, CTX); return F; };
const jointC = (F, fr, j) => F.toC(fr, F.proj(fr, j));
const BONES = [["pelvis", "neck"], ["neck", "head"], ["shoulderR", "elbowR"], ["elbowR", "wristR"], ["hipR", "kneeR"], ["kneeR", "ankleR"], ["ankleR", "toeR"], ["shoulderL", "elbowL"], ["elbowL", "wristL"], ["hipL", "kneeL"], ["kneeL", "ankleL"], ["ankleL", "toeL"]];
const boneLen3 = (fr, a, b) => { const A = fr.sk.J[a], B = fr.sk.J[b]; return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
for (const mo of MOTIONS) {
  const F = frames({ ...p0, motion: mo, frames: 12 });
  const ref = BONES.map(([a, b]) => boneLen3(F.frames[0], a, b));
  const inv = F.frames.every((fr) => BONES.every(([a, b], k) => Math.abs(boneLen3(fr, a, b) - ref[k]) < 1e-9));
  ok(inv, mo + ": every bone length identical in all 12 frames (3-D)");
  ok(ref.every((l) => l > 0.04 * 70), mo + ": no zero-length bone");
  /* sagittal bone lengths in Side view are the true lengths (side projection of a sagittal skeleton) */
  const sideOK = F.frames.every((fr) => BONES.every(([a, b], k) => { const A = jointC(F, fr, a), B = jointC(F, fr, b); return Math.abs(Math.hypot(A[0] - B[0], A[1] - B[1]) - ref[k]) < 1e-9; }));
  ok(sideOK, mo + ": Side view preserves every bone length exactly");
  /* mutation: a scaled joint would break it */
  if (mo === "Walk") {
    const fr = F.frames[3];
    const A = fr.sk.J.kneeR, B = fr.sk.J.ankleR;
    ok(Math.abs(Math.hypot(A[0] - (B[0] * 1.1), A[1] - B[1], A[2] - B[2]) - ref[5]) > 1e-3, "oracle mutation: a stretched shank is detected");
  }
}

/* ---------- ground contact ---------- */
{
  for (const mo of MOTIONS) {
    const F = frames({ ...p0, motion: mo, frames: 16 });
    const gy = F.groundY;
    const feet = ["ankleR", "ankleL", "toeR", "toeL"];
    const above = F.frames.every((fr) => feet.every((j) => jointC(F, fr, j)[1] <= gy + 1e-6));
    ok(above, mo + ": no foot point below the ground line");
  }
  const Fw = frames({ ...p0, motion: "Walk", frames: 16 });
  const walkStance = Fw.frames.every((fr) => ["ankleR", "ankleL", "toeR", "toeL"].some((j) => Math.abs(jointC(Fw, fr, j)[1] - Fw.groundY) < 1e-6));
  ok(walkStance, "Walk: one foot on the ground in every frame (no flight)");
  const Fj = frames({ ...p0, motion: "Long jump", frames: 16 });
  const flight = Fj.frames.filter((fr) => ["ankleR", "ankleL", "toeR", "toeL"].every((j) => jointC(Fj, fr, j)[1] < Fj.groundY - 5)).length;
  ok(flight >= 3, "Long jump: several airborne frames (" + flight + ")");
  const groundLine = r1.paths.find((q) => !q.closed && q.pts.length === 2 && Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9 && Math.abs(q.pts[1][0] - q.pts[0][0]) > 200);
  ok(!!groundLine && Math.abs(groundLine.pts[0][1] - frames(p0).groundY) < 1e-6, "ground line drawn at the ground y across Ground extent");
  const noG = run({ ...p0, ground: false });
  ok(!noG.paths.some((q) => !q.closed && q.pts.length === 2 && Math.abs(q.pts[1][0] - q.pts[0][0]) > 200), "Ground line off: no floor");
}

/* ---------- trajectories, markers, numbers ---------- */
{
  const p = { ...p0, traj: "Head", penTraj: 5, penLab: 9, penFig: 0, frames: 7 };
  const F = frames(p);
  const r = run(p);
  const trj = r.paths.filter((q) => q.layer === 5 && !q.closed);
  const mk = r.paths.filter((q) => q.layer === 5 && q.closed);
  const lab = r.paths.filter((q) => q.layer === 9);
  ok(trj.length > 20, "Head trajectory: dashed curve made of many dashes (" + trj.length + ")");
  ok(mk.length === 7, "one marker per frame (" + mk.length + ")");
  const heads = F.frames.map((fr) => jointC(F, fr, "head"));
  const cen = (q) => q.pts.reduce((a, b) => [a[0] + b[0] / q.pts.length, a[1] + b[1] / q.pts.length], [0, 0]);
  ok(mk.every((q) => heads.some((h) => Math.hypot(cen(q)[0] - h[0], cen(q)[1] - h[1]) < 0.02)), "every marker centred on a frame's head joint");
  /* trajectory passes through the frame joints: nearest dash point within dash length */
  const near = heads.every((h) => trj.some((q) => q.pts.some((P) => Math.hypot(P[0] - h[0], P[1] - h[1]) < p0.dash * 1.7)));
  ok(near, "trajectory passes through every frame's joint (within one dash+gap)");
  ok(lab.length > 7, "numbers drawn (" + lab.length + " strokes)");
  /* label for frame i sits just above head i and is horizontally centred */
  const above = heads.every((h) => lab.some((q) => q.pts.every((P) => P[1] < h[1] && Math.abs(P[0] - h[0]) < p.numSize)));
  ok(above, "each number sits above its joint, centred");
  ok(r.paths.filter((q) => q.layer === 9).length === 0 || run({ ...p, numbers: false }).paths.filter((q) => q.layer === 9).length === 0, "Numbers off: no label strokes");
  ok(run({ ...p, markers: false }).paths.filter((q) => q.layer === 5 && q.closed).length === 0, "Markers off: no markers");
  const counts = ["None", "Head", "Head + hip", "Head + hip + hands + feet", "All joints"].map((t) => run({ ...p, traj: t }).paths.filter((q) => q.layer === 5 && q.closed).length);
  ok(counts[0] === 0 && counts[1] === 7 && counts[2] === 14 && counts[3] === 42 && counts[4] > 42, "trajectory sets: markers 0 / 7 / 14 / 42 / more (" + counts.join(",") + ")");
  const two = run({ ...p, numSize: 6 }).paths.filter((q) => q.layer === 9);
  const hgt = (arr) => { let a = Infinity, b = -Infinity; for (const q of arr) for (const [, y] of q.pts) { a = Math.min(a, y); b = Math.max(b, y); } return b - a; };
  ok(hgt(two.filter((q) => q.pts.every((P) => Math.abs(P[0] - heads[0][0]) < 6))) > hgt(lab.filter((q) => q.pts.every((P) => Math.abs(P[0] - heads[0][0]) < 3))), "Number size 6 draws taller digits");
}

/* ---------- far limbs / frame style / head / dash ---------- */
{
  const segCount = (r) => r.paths.filter((q) => q.layer === 0 && !q.closed).length;
  const d = run({ ...p0, traj: "None", ground: false }), s = run({ ...p0, traj: "None", ground: false, far: "Solid" }), h = run({ ...p0, traj: "None", ground: false, far: "Hidden" });
  ok(segCount(d) > segCount(s) && segCount(s) > segCount(h), "Far limbs: Dashed > Solid > Hidden segment counts (" + segCount(d) + " / " + segCount(s) + " / " + segCount(h) + ")");
  ok(segCount(s) === 7 * 16, "Far Solid: 16 solid segments per frame × 7 frames (" + segCount(s) + ")");
  ok(segCount(h) === 7 * 9, "Far Hidden: 9 segments per frame (trunk, neck-head, near side only)");
  const alt = run({ ...p0, traj: "None", ground: false, far: "Solid", frameStyle: "Alternate dashed" });
  ok(segCount(alt) > segCount(s), "Alternate dashed: odd frames dashed");
  const fade = run({ ...p0, traj: "None", ground: false, far: "Solid", frameStyle: "Fade" });
  ok(segCount(fade) > segCount(s), "Fade: early frames dashed");
  const dashes = (r) => r.paths.filter((q) => q.layer === 0 && !q.closed && q.pts.length === 2 && Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) <= 1.6 + 1e-6);
  ok(dashes(d).length > 0 && dashes(d).every((q) => Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) <= 1.6 + 1e-6), "dashes are at most Dash mm long");
  const dl = run({ ...p0, dash: 4, traj: "None", ground: false });
  ok(segCount(dl) < segCount(d), "Dash 4: fewer, longer dashes");
  const circ = run({ ...p0, traj: "None", ground: false }).paths.filter((q) => q.closed).length;
  const dot = run({ ...p0, traj: "None", ground: false, head: "Dot" }).paths.filter((q) => q.closed);
  ok(circ === 7 && dot.length === 7 && dot.every((q) => q.pts.length === 10), "Head Circle / Dot: one ring per frame");
  ok(run({ ...p0, traj: "None", ground: false, head: "None" }).paths.filter((q) => q.closed).length === 0, "Head None: no rings");
}

/* ---------- view ---------- */
{
  const Fs = frames({ ...p0, motion: "Run", view: "Side" }), Ff = frames({ ...p0, motion: "Run", view: "Front" });
  const sw = (F, fr) => Math.abs(jointC(F, fr, "shoulderR")[0] - jointC(F, fr, "shoulderL")[0]);
  ok(Fs.frames.every((fr) => sw(Fs, fr) < 1e-9), "Side: both shoulders project onto one point");
  ok(Ff.frames.every((fr) => Math.abs(sw(Ff, fr) - 0.22 * 70) < 1e-6), "Front: shoulders 0.22·Height apart");
  const rf = run({ ...p0, motion: "Run", view: "Front", traj: "None", ground: false, far: "Solid" });
  ok(rf.paths.filter((q) => q.layer === 0 && !q.closed).length === 7 * 14, "Front: 14 solid segments per frame (shoulder + hip bars, no neck-shoulder / pelvis-hip)");
}

/* ---------- Path input ---------- */
{
  const p = { ...p0, motion: "Walk", frames: 10, height: 40 };
  const F = frames(p, [WAVE, undefined]);
  const on = F.frames.every((fr) => {
    const P = jointC(F, fr, "pelvis");
    let best = Infinity;
    for (let i = 0; i + 1 < WAVE.paths[0].pts.length; i++) {
      const A = WAVE.paths[0].pts[i], B = WAVE.paths[0].pts[i + 1];
      const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2));
      best = Math.min(best, Math.hypot(P[0] - (A[0] + dx * t), P[1] - (A[1] + dy * t)));
    }
    return best < 1e-6;
  });
  ok(on, "Path input: every frame's pelvis lies on the wired line");
  const first = jointC(F, F.frames[0], "pelvis"), last = jointC(F, F.frames[9], "pelvis");
  ok(Math.hypot(first[0] - 30, first[1] - 120) < 1e-6 && Math.abs(last[0] - (30 + 39 * 6)) < 1e-6, "Path input: frames span the whole wire, start to end");
  const inv = F.frames.every((fr) => BONES.every(([a, b], k) => Math.abs(boneLen3(fr, a, b) - boneLen3(F.frames[0], a, b)) < 1e-9));
  ok(inv, "Path input: bones still rigid");
  const r = run(p, CTX, [WAVE, undefined]);
  ok(finiteAll(r) && inb(r, 297, 210, 0), "Path input: finite, in bounds");
  const lowest = Math.max(...F.frames.flatMap((fr) => ["ankleR", "ankleL", "toeR", "toeL"].map((j) => jointC(F, fr, j)[1])));
  const gl = r.paths.find((q) => !q.closed && q.pts.length === 2 && Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9 && Math.abs(q.pts[1][0] - q.pts[0][0]) > 200);
  ok(gl && Math.abs(gl.pts[0][1] - lowest) < 1e-6, "Path input: ground line at the lowest foot point");
  ok(JSON.stringify(run(p, CTX, [{ paths: [] }, undefined])) === JSON.stringify(run(p)), "empty Path input behaves like no wire");
  ok(finiteAll(run(p, CTX, [{ paths: [{ pts: [[5, 5], [5, 5]], closed: false }] }, undefined])), "zero-length Path: falls back, finite");
}

/* ---------- spacing / stride / window / lean ---------- */
{
  const F0 = frames({ ...p0, motion: "Run", spacing: 0 });
  const xs = F0.frames.map((fr) => jointC(F0, fr, "pelvis")[0]);
  ok(xs.every((x) => Math.abs(x - xs[0]) < 1e-9), "Spacing 0: every pelvis on one x");
  const w = (p) => { const F = frames(p); const a = F.frames.map((fr) => jointC(F, fr, "pelvis")[0]); return Math.max(...a) - Math.min(...a); };
  ok(Math.abs(w({ ...p0, motion: "Walk", stride: 150 }) / w({ ...p0, motion: "Walk", stride: 100 }) - 1.5) < 1e-6, "Stride 150: travel × 1.5");
  ok(Math.abs(w({ ...p0, motion: "Walk", spacing: 50 }) / w({ ...p0, motion: "Walk", spacing: 100 }) - 0.5) < 1e-6, "Spacing 50: travel × 0.5");
  const Fw = frames({ ...p0, motion: "Long jump", t0: 50, t1: 100, frames: 5 });
  ok(Fw.frames.every((fr) => fr.ph >= 0.5 - 1e-9 && fr.ph <= 1 + 1e-9) && Math.abs(Fw.frames[0].ph - 0.5) < 1e-9, "Time window 50-100: frames sample that phase range");
  ok(finiteAll(run({ ...p0, t0: 95, t1: 5 })), "inverted window: clamped, finite");
  const Fl = frames({ ...p0, motion: "Walk", lean: 20, frames: 3 }), Fn = frames({ ...p0, motion: "Walk", lean: 0, frames: 3 });
  const dxl = jointC(Fl, Fl.frames[0], "neck")[0] - jointC(Fl, Fl.frames[0], "pelvis")[0];
  const dxn = jointC(Fn, Fn.frames[0], "neck")[0] - jointC(Fn, Fn.frames[0], "pelvis")[0];
  ok(dxl > dxn + 1, "Trunk lean 20: neck moves forward of the pelvis");
}

/* ---------- Animate ---------- */
{
  const pa = { ...p0, animate: "Single instant", frames: 7 };
  const F0 = frames({ ...pa, phase: 0 }), F1 = frames({ ...pa, phase: 1 }), Fp = frames(p0);
  const same = (Fa, fa, Fb, fb) => Fa.JOINTS.every((j) => { const A = jointC(Fa, fa, j), B = jointC(Fb, fb, j); return Math.hypot(A[0] - B[0], A[1] - B[1]) < 1e-9; });
  ok(F0.frames.length === 1 && same(F0, F0.frames[0], Fp, Fp.frames[0]), "Phase 0: the single figure is exactly the plate's first exposure");
  ok(F1.frames.length === 1 && same(F1, F1.frames[0], Fp, Fp.frames[6]), "Phase 1: exactly the plate's last exposure");
  const Fh = frames({ ...pa, phase: 0.5 });
  ok(same(Fh, Fh.frames[0], Fp, Fp.frames[3]), "Phase 0.5 with 7 frames: exactly exposure 4");
  const gys = [0, 0.13, 0.5, 0.77, 1].map((ph) => frames({ ...pa, phase: ph }).groundY);
  ok(gys.every((g) => Math.abs(g - gys[0]) < 1e-9) && Math.abs(gys[0] - Fp.groundY) < 1e-9, "layout fixed: ground y identical at every Phase and equal to the plate's");
  const spineL = (F) => { const A = jointC(F, F.frames[0], "pelvis"), B = jointC(F, F.frames[0], "neck"); return Math.hypot(A[0] - B[0], A[1] - B[1]); };
  ok(Math.abs(spineL(F0) - spineL(F1)) < 1e-9, "layout fixed: same scale at Phase 0 and 1");
  const xs = [0, 0.5, 1].map((ph) => { const F = frames({ ...pa, phase: ph }); return jointC(F, F.frames[0], "pelvis")[0]; });
  ok(xs[0] < xs[1] && xs[1] < xs[2], "the figure travels across the sheet as Phase advances (" + xs.map((v) => v.toFixed(1)).join(" -> ") + ")");
  for (const ph of [0, 0.3, 0.6, 1]) ok(inb(run({ ...pa, phase: ph, motion: "Long jump" }), 297, 210, p0.margin), "Animate in bounds at Phase " + ph);
  /* onion skin */
  const po = { ...pa, animate: "Onion skin", onion: 3 };
  const Fo = frames({ ...po, phase: 0.5 });
  const step = 1 / 6;
  ok(Fo.ghosts.length === 3 && Fo.ghosts.every((g, k) => Math.abs(g.ph - (0.5 - (k + 1) * step)) < 1e-9), "Onion 3 at Phase 0.5: three ghosts at the previous exposure instants");
  ok(frames({ ...po, phase: 0 }).ghosts.length === 0 && frames({ ...po, phase: step * 1.5 }).ghosts.length === 1, "ghosts never reach before the window start");
  const segs = (r) => r.paths.filter((q) => q.layer === 0 && !q.closed).length;
  const rSingle = run({ ...pa, phase: 0.5, traj: "None", ground: false, far: "Solid" });
  const rOnion = run({ ...po, phase: 0.5, traj: "None", ground: false, far: "Solid" });
  const rOnionS = run({ ...po, phase: 0.5, traj: "None", ground: false, far: "Solid", onionStyle: "Solid" });
  ok(segs(rSingle) === 16 && segs(rOnionS) === 16 * 4 && segs(rOnion) > segs(rOnionS), "Single: 16 segments; Onion Solid: 4 figures; Onion Dashed: dashed ghosts");
  ok(run({ ...po, phase: 0.5, traj: "None", ground: false, head: "Circle" }).paths.filter((q) => q.closed).length === 4, "Onion: each ghost keeps its head");
  /* trail */
  const mk = (p) => run(p).paths.filter((q) => q.layer === 5 && q.closed).length;
  const pt = { ...pa, traj: "Head", penTraj: 5, phase: 0.5 };
  ok(mk({ ...pt, trail: "Trajectories so far" }) === 4 && mk({ ...pt, trail: "Full trajectories" }) === 7 && mk({ ...pt, trail: "None" }) === 0, "Trail: markers so far 4 / full 7 / none 0 at Phase 0.5");
  const trj = (p) => run(p).paths.filter((q) => q.layer === 5 && !q.closed);
  const maxX = (arr) => Math.max(...arr.flatMap((q) => q.pts.map((P) => P[0])));
  const headNow = jointC(Fh, Fh.frames[0], "head")[0];
  ok(maxX(trj({ ...pt, trail: "Trajectories so far" })) <= headNow + 1e-6 && maxX(trj({ ...pt, trail: "Full trajectories" })) > headNow + 5, "Trail so far: trajectory writes on only up to the current head");
  ok(trj({ ...pt, trail: "None" }).length === 0, "Trail None: no trajectory");
  /* Off ignores phase */
  ok(JSON.stringify(run({ ...p0, phase: 0.7 })) === JSON.stringify(run(p0)), "Animate Off: Phase is inert");
  ok(JSON.stringify(run({ ...pa, phase: 0.3 })) !== JSON.stringify(run({ ...pa, phase: 0.6 })), "Animate on: Phase is live");
  ok(JSON.stringify(run({ ...po, phase: 0.6 })) !== JSON.stringify(run({ ...po, phase: 0.6, onion: 1 })), "Onion frames live");
  ok(JSON.stringify(run({ ...po, phase: 0.6 })) !== JSON.stringify(run({ ...po, phase: 0.6, onionStyle: "Solid" })), "Onion style live");
  /* path input + animate */
  const Fpa = frames({ ...pa, motion: "Walk", phase: 0.5, height: 40 }, [WAVE, undefined]);
  const Ppl = frames({ ...p0, motion: "Walk", height: 40 }, [WAVE, undefined]);
  ok(same(Fpa, Fpa.frames[0], Ppl, Ppl.frames[3]), "Path input + Animate: Phase 0.5 sits where exposure 4 of the plate sits");
  ok(def.overlay({ ...pa, phase: 0.5 }, CTX, [undefined, undefined], {}).some((q) => q.kind === "point"), "overlay in Animate: current pelvis point");
}

/* ---------- liveness ---------- */
const J = (r) => JSON.stringify(r);
const live = (b, patch, label) => ok(J(run({ ...b, ...patch })) !== J(run(b)), "param live: " + label);
live(p0, { motion: "Walk" }, "motion");
live(p0, { view: "Front" }, "view");
live(p0, { frames: 5 }, "frames");
live(p0, { t0: 30 }, "t0");
live(p0, { t1: 70 }, "t1");
live(p0, { height: 50 }, "height");
live(p0, { animate: "Single instant" }, "animate");
live({ ...p0, animate: "Single instant" }, { trail: "None" }, "trail");
live(p0, { spacing: 50 }, "spacing");
live(p0, { stride: 120 }, "stride");
live(p0, { lean: 15 }, "lean");
live(p0, { far: "Solid" }, "far");
live(p0, { frameStyle: "Fade" }, "frameStyle");
live(p0, { dash: 3 }, "dash");
live(p0, { head: "Dot" }, "head");
live(p0, { traj: "Head" }, "traj");
live(p0, { markers: false }, "markers");
live(p0, { numbers: false }, "numbers");
live(p0, { numSize: 5 }, "numSize");
live(p0, { ground: false }, "ground");
live(p0, { groundExt: 50 }, "groundExt");
live({ ...p0, motion: "Walk", height: 200 }, { margin: 40 }, "margin (fit case)");
live(p0, { penFig: 3 }, "penFig");
live(p0, { penTraj: 4 }, "penTraj");
live(p0, { penLab: 6 }, "penLab");

/* ---------- selects ---------- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* ---------- extreme / degenerate ---------- */
{
  for (const mo of MOTIONS) {
    const ext = run({ ...p0, motion: mo, frames: 16, traj: "All joints", height: 200, dash: 0.5, numSize: 8 });
    ok(finiteAll(ext) && npts(ext) <= 120000 && inb(ext, 297, 210, 0), mo + " extreme: finite, budget, in bounds (" + npts(ext) + " pts)");
  }
  ok(finiteAll(run(p0, { W: 30, H: 30 })), "tiny canvas: finite");
  ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "margin larger than half the sheet: clamped, finite");
  ok(finiteAll(run({ ...p0, height: 20, frames: 3 })), "minimum height / frames: finite");
}

/* ---------- showIf ---------- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis({ ...p0, traj: "None" }).includes("markers") && vis(p0).includes("numSize") && !vis({ ...p0, numbers: false }).includes("numSize"), "showIf: trajectory sub-params follow Trajectories / Numbers");
  ok(vis(p0).includes("groundExt") && !vis({ ...p0, ground: false }).includes("groundExt"), "showIf: Ground extent follows Ground line");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
}

/* ---------- overlay ---------- */
{
  const g = def.overlay(p0, CTX, [undefined, undefined], {});
  ok(Array.isArray(g) && g.some((q) => q.kind === "rect") && g.some((q) => q.kind === "poly"), "overlay: bounding rect + ground line");
  const gp = def.overlay(p0, CTX, [WAVE, undefined], {});
  ok(gp.some((q) => q.kind === "rect") && !gp.some((q) => q.kind === "poly"), "overlay with Path input: rect only (no fixed ground)");
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }, undefined, undefined); def.overlay(p0, undefined, [{ paths: [{ pts: [[NaN, 0], [1, 1]] }] }]); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
