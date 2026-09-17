/* Validator for the Drape node. Run from the repo root: node tools/validate-drape.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "drape";

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
const CTX = { W: 297, H: 210 };
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
const inb = (r, W, Hh, m, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - tol && x <= W - m + tol && y >= m - tol && y <= Hh - m + tol));
const longest = (r) => { let m = 0; for (const q of r.paths) for (let i = 1; i < q.pts.length; i++) m = Math.max(m, Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1])); return m; };

const p0 = defaults();
const STYLES = def.params.find((q) => q.key === "style").options;

/* --- definition shape --- */
ok(def.cat === "gen" && def.group === "structural", "definition: gen/structural");
ok(typeof def.desc === "string" && def.desc.length > 200, "definition: desc present");
ok(def.ins.length === 3 && def.ins[0].type === "style" && def.ins[1].type === "paths" && def.ins[2].type === "mesh" && def.outs.length === 1, "pins: Style, Objects (paths), Mesh in; one paths out");
ok(def.params.every((q) => /^[a-z][a-z0-9]*$/i.test(q.key)) && new Set(def.params.map((q) => q.key)).size === def.params.length, "params: unique keys");
ok(def.params.some((q) => q.type === "seed") && def.params.some((q) => q.type === "pen"), "params: seed and pen present");

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 20, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
ok(inb(r1, 297, 210, p0.margin, 1.0), "in bounds inside margin on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin, 1.0), "in bounds inside margin on A4 tall");
{
  const bb = bbox(run({ ...p0, lock: false }));
  ok(Math.abs(bb.w - (297 - 20)) < 0.05 || Math.abs(bb.h - (210 - 20)) < 0.05, "Lock size off: fitted to the margins on one axis (" + bb.w.toFixed(1) + " x " + bb.h.toFixed(1) + ")");
  ok(Math.abs((bb.x0 + bb.x1) / 2 - 148.5) < 0.05 && Math.abs((bb.y0 + bb.y1) / 2 - 105) < 0.05, "Lock size off: centred on the sheet");
  const bl = bbox(r1);
  ok(bl.w < 277 && bl.h < 190 && bl.w > 120, "Lock size on: leaves turning room inside the margins (" + bl.w.toFixed(1) + " x " + bl.h.toFixed(1) + ")");
}

/* --- styles --- */
for (const st of STYLES) {
  const r = run({ ...p0, style: st });
  ok(r.paths.length > 10 && finiteAll(r) && inb(r, 297, 210, p0.margin, 1.0), "style '" + st + "' renders in bounds (" + r.paths.length + " paths, " + npts(r) + " pts)");
}
{
  const wire = run({ ...p0, style: "Wire" }), weave = run({ ...p0, style: "Weave" });
  ok(weave.paths.length > wire.paths.length * 3, "Weave breaks the grid at alternate crossings into many short runs (" + wire.paths.length + " -> " + weave.paths.length + ")");
  const cont = run({ ...p0, style: "Contour" });
  ok(cont.paths.some((q) => q.pts.length > 30), "Contour chains its segments into long polylines (longest " + Math.max(...cont.paths.map((q) => q.pts.length)) + ")");
  const h1 = run({ ...p0, style: "Hatch", light: 0 }), h2 = run({ ...p0, style: "Hatch", light: 180 });
  ok(JSON.stringify(h1) !== JSON.stringify(h2), "Hatch responds to Light angle");
}

/* --- geometry --- */
{
  const flat = run({ ...p0, style: "Wire", pitch: 90, persp: 0, yaw: 0, hidden: false });
  const vertical = flat.paths.filter((q) => q.pts.every((pt) => Math.abs(pt[0] - q.pts[0][0]) < 1e-6)).length;
  const horizontal = flat.paths.filter((q) => q.pts.every((pt) => Math.abs(pt[1] - q.pts[0][1]) < 1e-6)).length;
  ok(vertical >= 30 && horizontal >= 20 && vertical + horizontal === flat.paths.length, "top-down orthographic view is a straight lattice (" + vertical + " + " + horizontal + " lines)");
  const N = p0.density;
  ok(vertical === N + 1, "Density " + N + " gives " + (N + 1) + " warp lines (" + vertical + ")");
  const hid = run({ ...p0, style: "Wire", hidden: true }), noh = run({ ...p0, style: "Wire", hidden: false });
  ok(npts(noh) > npts(hid), "hidden lines remove something at an oblique view (" + npts(hid) + " vs " + npts(noh) + " pts)");
  const lowE = run({ ...p0, style: "Wire", pitch: 10, hidden: true }), lowN = run({ ...p0, style: "Wire", pitch: 10, hidden: false });
  ok(npts(lowN) > npts(lowE) * 1.15, "a low view hides more of the grid than a high one");
  const t0 = run({ ...p0, tension: 0 }), t40 = run({ ...p0, tension: 40 });
  ok(JSON.stringify(t0) !== JSON.stringify(t40), "Tension relaxes the sheet");
  /* tension never lets the sheet sink below an object: the highest point is the same with and without relaxation */
  const top = (pp) => { const r = run({ ...pp, style: "Wire", pitch: 10, persp: 0, hidden: false, wrinkles: 0 }); return bbox(r).y0; };
  ok(Math.abs(top({ ...p0, tension: 0 }) - top({ ...p0, tension: 40 })) < 1.5, "relaxation keeps the sheet on top of the objects (peak height unchanged)");
  const w0 = run({ ...p0, wrinkles: 0 }), w100 = run({ ...p0, wrinkles: 100 });
  ok(JSON.stringify(w0) !== JSON.stringify(w100), "Wrinkles fold the raised sheet");
  const one = run({ ...p0, count: 1 }), many = run({ ...p0, count: 10 });
  ok(JSON.stringify(one) !== JSON.stringify(many), "Count changes the scene");
}
for (const sh of def.params.find((q) => q.key === "shapes").options) {
  const r = run({ ...p0, shapes: sh });
  ok(r.paths.length > 10 && finiteAll(r), "objects '" + sh + "' render (" + r.paths.length + " paths)");
}

/* --- lock size, wired objects --- */
{
  const top = { ...p0, pitch: 90, persp: 0, hidden: false, style: "Wire", lock: true };
  const b0 = bbox(run({ ...top, yaw: 0 })), b90 = bbox(run({ ...top, yaw: 90 })), b45 = bbox(run({ ...top, yaw: 45 }));
  ok(Math.abs(b0.w - b90.h) < 0.05 && Math.abs(b0.h - b90.w) < 0.05, "Lock size: turning 90° swaps width and height exactly (" + b0.w.toFixed(1) + " x " + b0.h.toFixed(1) + " -> " + b90.w.toFixed(1) + " x " + b90.h.toFixed(1) + ")");
  ok(Math.abs(b45.w - (b0.w + b0.h) * Math.SQRT1_2) < 0.05 && b45.w < 277.5 && b45.h < 190.5, "Lock size: at 45° the box is (w+h)/√2 of the same sheet, inside the margins (" + b45.w.toFixed(1) + ")");
  const free0 = bbox(run({ ...top, yaw: 0, lock: false })), free45 = bbox(run({ ...top, yaw: 45, lock: false }));
  ok(Math.abs(free0.w - 277) < 0.05 && Math.max(free45.w / 277, free45.h / 190) > 0.999 && b0.w < 277 - 0.5, "Lock size off refits to the margins at every yaw");
  const cxs = [0, 30, 60, 120].map((yw) => { const b = bbox(run({ ...top, yaw: yw })); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; });
  ok(cxs.every((c) => Math.abs(c[0] - 148.5) < 0.05 && Math.abs(c[1] - 105) < 0.05), "Lock size: the sheet centre stays put while turning");
  /* sheet shapes */
  const rnd = (yw) => bbox(run({ ...p0, sheet: "Round", yaw: yw }));
  const r0 = rnd(0), r37 = rnd(37), r90 = rnd(90);
  ok(Math.abs(r0.w - r37.w) < 0.6 && Math.abs(r0.h - r37.h) < 0.6 && Math.abs(r0.w - r90.w) < 0.6, "Sheet Round: the outline does not change with Yaw (" + r0.w.toFixed(1) + " / " + r37.w.toFixed(1) + " / " + r90.w.toFixed(1) + " wide)");
  const sq0 = bbox(run({ ...p0, sheet: "Square", pitch: 90, persp: 0, yaw: 0, hidden: false }));
  ok(Math.abs(sq0.w - sq0.h) < 0.05, "Sheet Square is square (" + sq0.w.toFixed(1) + " x " + sq0.h.toFixed(1) + ")");
  const rw = run({ ...p0, sheet: "Round", style: "Wire" });
  ok(rw.paths.some((q) => q.pts.length >= 48), "Sheet Round draws its rim as one long polyline");
  for (const st of STYLES) ok(finiteAll(run({ ...p0, sheet: "Round", style: st })) && inb(run({ ...p0, sheet: "Round", style: st }), 297, 210, p0.margin, 1.0), "Sheet Round renders style '" + st + "' in bounds");
  /* wired objects */
  const sq = { paths: [{ pts: [[120, 70], [180, 70], [180, 130], [120, 130]], closed: true, layer: 0 }] };
  const runW = (pp, insX) => def.compute(insX, pp, CTX, {});
  const w1 = runW({ ...p0, count: 1, style: "Wire", pitch: 90, persp: 0, yaw: 0, hidden: false, tension: 0, wrinkles: 0 }, [undefined, sq, null]);
  const w2 = runW({ ...p0, count: 9, style: "Wire", pitch: 90, persp: 0, yaw: 0, hidden: false, tension: 0, wrinkles: 0 }, [undefined, sq, null]);
  ok(JSON.stringify(w1) === JSON.stringify(w2), "a wired Objects path replaces the seeded objects (Count no longer matters)");
  const side = runW({ ...p0, style: "Wire", pitch: 20, persp: 0, yaw: 0, hidden: false, tension: 0, wrinkles: 0, lock: false }, [undefined, sq, null]);
  const flat = runW({ ...p0, style: "Wire", pitch: 20, persp: 0, yaw: 0, hidden: false, tension: 0, wrinkles: 0, lock: false }, [undefined, { paths: [] }, null]);
  ok(side.paths.length > 0 && finiteAll(side), "closed path renders as a block");
  ok(JSON.stringify(side) !== JSON.stringify(flat), "an EMPTY Objects input falls back to seeded objects");
  const ridge = runW({ ...p0, style: "Wire", tension: 0 }, [undefined, { paths: [{ pts: [[30, 105], [260, 105]], closed: false, layer: 0 }] }, null]);
  ok(ridge.paths.length > 0 && finiteAll(ridge), "open path renders as a ridge");
  /* mesh: a pyramid, apex in the middle */
  const A = [-0.5, -0.5, -0.25], B = [0.5, -0.5, -0.25], C = [0.5, 0.5, -0.25], D = [-0.5, 0.5, -0.25], T = [0, 0, 0.25];
  const tris = [[A, B, T], [B, C, T], [C, D, T], [D, A, T], [A, C, B], [A, D, C]];
  const mesh = { kind: "mesh", tri: 6, v: tris.flat(2), dims: [1, 1, 0.5] };
  const m1 = runW({ ...p0, style: "Wire", pitch: 10, persp: 0, yaw: 0, hidden: false, tension: 0, wrinkles: 0, lock: false }, [undefined, undefined, mesh]);
  const none = runW({ ...p0, style: "Wire", pitch: 10, persp: 0, yaw: 0, hidden: false, tension: 0, wrinkles: 0, lock: false, count: 1, size: 5, height: 5 }, [undefined, { paths: [{ pts: [[1, 1], [2, 2]], closed: false, layer: 0 }] }, null]);
  ok(m1.paths.length > 0 && finiteAll(m1) && bbox(m1).h > bbox(none).h * 1.2, "a wired mesh raises the sheet (pyramid seen edge-on is taller than a flat sheet)");
  const hm = runW({ ...p0, style: "Wire", pitch: 10, persp: 0, yaw: 0, hidden: false, tension: 0, wrinkles: 0, lock: false, height: 90 }, [undefined, undefined, mesh]);
  ok(bbox(hm).h > bbox(m1).h, "Height scales a wired mesh");
  ok(finiteAll(runW(p0, [undefined, { paths: [{ pts: [[50, 50]], closed: false, layer: 0 }] }, { kind: "mesh", tri: 0, v: [], dims: [1, 1, 1] }])), "degenerate wired inputs do not throw");
}

/* --- every parameter must do something --- */
const J = (p) => JSON.stringify(run(p));
const baseJ = J(p0);
const diff = (patch, label, base) => ok(J({ ...(base || p0), ...patch }) !== (base ? J(base) : baseJ), "param live: " + label);
diff({ style: "Weave" }, "style");
diff({ shapes: "Boxes" }, "shapes");
diff({ sheet: "Round" }, "sheet");
diff({ count: 2 }, "count");
diff({ size: 50 }, "size");
diff({ height: 90 }, "height");
diff({ tension: 0 }, "tension");
diff({ wrinkles: 80 }, "wrinkles");
diff({ density: 20 }, "density");
diff({ yaw: 80 }, "yaw");
diff({ pitch: 80 }, "pitch (Elevation)");
diff({ persp: 0 }, "persp");
diff({ hidden: false }, "hidden");
diff({ lock: false }, "lock");
diff({ light: 90 }, "light (Hatch)", { ...p0, style: "Hatch" });
diff({ margin: 30 }, "margin");
diff({ seed: 99 }, "seed");
diff({ layer: 3 }, "layer");
ok(run({ ...p0, layer: 3 }).paths.every((q) => q.layer === 3), "layer applies to every path");

/* --- degenerate and extreme --- */
ok(finiteAll(run({ ...p0, count: 0, size: 0, height: 0, tension: 0, wrinkles: 0, density: 0, margin: 0, persp: 0, pitch: 0 })), "degenerate params produce no NaN");
ok(finiteAll(run({ ...p0, count: -5, size: 999, height: -50, tension: 9999, wrinkles: -20, density: 9999, yaw: 720, pitch: 200, persp: 9, margin: -5 })), "out-of-range wired values produce no NaN");
ok(finiteAll(run({ ...p0, margin: 200 })), "margin larger than the sheet does not throw");
ok(finiteAll(run(p0, { W: 30, H: 20 })), "tiny sheet does not throw");
for (const st of STYLES) {
  const t0 = Date.now();
  const ext = run({ ...p0, style: st, density: 90, count: 12, wrinkles: 100, tension: 60, persp: 1, pitch: 8 });
  ok(finiteAll(ext) && npts(ext) <= 120000 && ext.paths.length > 0 && inb(ext, 297, 210, p0.margin, 1.0), "extreme " + st + ": density 90, 12 objects, low view — finite, budget, in bounds (" + npts(ext) + " pts, " + (Date.now() - t0) + " ms)");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
  ok(vis({ ...p0, style: "Hatch" }).includes("light") && !vis({ ...p0, style: "Wire" }).includes("light"), "showIf: Light angle only for Hatch");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "rect", "overlay: margin rect");
  let threw = false;
  try { def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined); def.overlay({}, {}, null, null); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
} else ok(false, "overlay missing");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
