/* Validator for the Root Vegetables node (key: rootveg).
   Run from the repo root: node tools/validate-rootveg.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "rootveg";

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
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const KINDS = ["Carrot", "Turnip", "Swede", "Sugar beet", "Onion", "Garlic", "Leek", "Cauliflower", "Cabbage"];
const bodies = (r, p) => r.paths.filter((q) => q.closed && q.layer === Math.round((p || p0).layer) && q.pts.length >= 60);
const onPen = (r, pen) => r.paths.filter((q) => q.layer === pen);
const bbox = (q) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of q.pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };
const ringContains = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segDist = (P, A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2)); return Math.hypot(P[0] - (A[0] + dx * t), P[1] - (A[1] + dy * t)); };
const distToRing = (P, ring) => { let b = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) b = Math.min(b, segDist(P, ring[j], ring[i])); return b; };
const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
const segsCross = (A, B, C, D) => { const d1 = cross(C[0], C[1], D[0], D[1], A[0], A[1]), d2 = cross(C[0], C[1], D[0], D[1], B[0], B[1]); const d3 = cross(A[0], A[1], B[0], B[1], C[0], C[1]), d4 = cross(A[0], A[1], B[0], B[1], D[0], D[1]); return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)); };
const ringsCross = (P, Q) => { for (let i = 0, j = P.length - 1; i < P.length; j = i++) for (let k = 0, l = Q.length - 1; k < Q.length; l = k++) if (segsCross(P[j], P[i], Q[l], Q[k])) return true; return false; };

/* ---------- universal ---------- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(bodies(r1).length === p0.count, "default: " + p0.count + " specimens placed (" + bodies(r1).length + ")");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults (" + npts(r1) + ")");
const tol = 0.01;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "No overlap: everything (tops + roots) inside the margin box");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "in bounds on A4 tall");
ok(inb(run({ ...p0, place: "Loose (may overlap)" }), 297, 210, 0), "Loose: clamped to the sheet");

/* ---------- every kind: body, texture, tops, roots, accent ---------- */
for (const k of KINDS) {
  const p = { ...p0, kind: k, count: 4, size: 50, rotation: "Upright", sizeVar: 0 };
  const r = run(p);
  const B = bodies(r, p);
  ok(B.length >= 2 && B.length <= 4 && finiteAll(r), k + ": bodies drawn at Size 50 (" + B.length + " of 4 fit)");
  ok(bodies(run({ ...p, size: 30 }), p).length === 4, k + ": all 4 fit at Size 30");
  ok(B.every((q) => Math.abs(bbox(q)[3] - bbox(q)[1] - 50) < 1e-6), k + ": body height = Size exactly (Upright, no variation)");
  const rT0 = run({ ...p, texture: 0 });
  ok(onPen(rT0, p.layer).length === bodies(rT0, p).length && onPen(r, p.layer).length - B.length > 0, k + ": Texture adds body-pen lines, Texture 0 leaves the outline only");
  ok(onPen(r, p.penTops).length > 0 && onPen(run({ ...p, tops: "None" }), p.penTops).length === 0, k + ": Leaves on Tops pen; Tops None removes them");
  const stubs = onPen(run({ ...p, tops: "Cut stubs" }), p.penTops);
  ok(stubs.length > 0 && stubs.reduce((a, q) => a + q.pts.length, 0) < onPen(r, p.penTops).reduce((a, q) => a + q.pts.length, 0), k + ": Cut stubs use far fewer points than Leaves");
  const cut = k === "Cabbage" || k === "Cauliflower";
  ok(cut ? onPen(r, p.penRoots).length === 0 : onPen(r, p.penRoots).length > 0, k + (cut ? ": cut — no roots" : ": roots on Roots pen"));
  ok(onPen(run({ ...p, roots: 0 }), p.penRoots).length === 0, k + ": Roots 0 -> none");
  const acc = k === "Turnip" || k === "Swede";
  ok(acc ? onPen(r, p.penAccent).length > 0 : onPen(r, p.penAccent).length === 0, k + (acc ? ": purple shoulder on Accent pen" : ": no accent strokes"));
  /* roots start on the outline and never re-enter a body */
  if (!cut) {
    const roots = onPen(r, p.penRoots);
    const onEdge = roots.every((q) => B.some((b) => distToRing(q.pts[0], b.pts) < 0.1));
    const outside = roots.every((q) => q.pts.slice(2).every((P) => !B.some((b) => ringContains(b.pts, P[0], P[1]))));
    ok(onEdge, k + ": every root hair starts on a body outline");
    ok(outside, k + ": no root hair re-enters a body");
  }
  /* No overlap: bodies never cross each other */
  let crossN = false;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) if (ringsCross(B[i].pts, B[j].pts)) crossN = true;
  ok(!crossN, k + ": No overlap — bodies never intersect");
  /* tops reach at most Top length × size above the body (plus blade curl) */
  const topsB = onPen(r, p.penTops);
  const topY = Math.min(...topsB.flatMap((q) => q.pts.map((P) => P[1]))), bodyTopY = Math.min(...B.map((q) => bbox(q)[1]));
  ok(bodyTopY - topY <= 50 * p.topLen * 1.1 + 1e-6, k + ": tops rise at most ~Top length × size above the body (" + (bodyTopY - topY).toFixed(1) + " mm)");
}

/* ---------- Mix ---------- */
{
  const r = run({ ...p0, count: 14, size: 30, sizeVar: 0, rotation: "Upright" });
  const B = bodies(r, p0);
  const aspects = new Set(B.map((q) => { const b = bbox(q); return Math.round(((b[2] - b[0]) / (b[3] - b[1])) * 10); }));
  ok(B.length >= 10 && aspects.size >= 4, "Mix: several kinds present (" + aspects.size + " distinct aspect classes among " + B.length + " bodies)");
  /* Mix cycles all nine kinds before repeating: 9 specimens on a big sheet -> exactly one carrot-tall body (aspect < 0.35) and one leek (aspect < 0.25 with a taller-than-wide...) — checked via extremes */
  const r9 = run({ ...p0, count: 9, size: 25, sizeVar: 0, rotation: "Upright", tops: "None", roots: 0 }, { W: 420, H: 297 });
  const asp9 = bodies(r9, p0).map((q) => { const b = bbox(q); return (b[2] - b[0]) / (b[3] - b[1]); }).sort((a, b) => a - b);
  ok(asp9.length === 9 && asp9[0] < 0.3 && asp9[1] < 0.3 && asp9[8] > 1.1, "Mix: 9 specimens = every kind once (leek + carrot slender, turnip wide)");
}

/* ---------- size / variation / rotation / roots / tops scaling ---------- */
{
  const hgt = (p) => bodies(run(p), p).map((q) => { const b = bbox(q); return b[3] - b[1]; });
  const h40 = hgt({ ...p0, kind: "Carrot", sizeVar: 0, rotation: "Upright", size: 40 }), h80 = hgt({ ...p0, kind: "Carrot", sizeVar: 0, rotation: "Upright", size: 80 });
  ok(h40.every((v) => Math.abs(v - 40) < 1e-6) && h80.every((v) => Math.abs(v - 80) < 1e-6), "Size 40 / 80: body heights exact");
  const hv = hgt({ ...p0, kind: "Onion", sizeVar: 0.8, rotation: "Upright", size: 60 });
  ok(hv.some((v) => v < 45) && hv.every((v) => v <= 60 + 1e-6), "Size variation 0.8: heights scatter downward, never above Size");
  const hr = hgt({ ...p0, kind: "Carrot", sizeVar: 0, rotation: "Random", size: 60 });
  ok(hr.some((v) => v < 59), "Rotation Random: bodies tilt (bbox height shrinks)");
  const ht = hgt({ ...p0, kind: "Carrot", sizeVar: 0, rotation: "Tilt", tilt: 45, size: 60 });
  ok(ht.every((v) => v <= 60 + 1e-6) && ht.some((v) => v < 59.5), "Tilt 45: bodies lean within the cone");
  const rl = (p) => { const r = run(p); const B = bodies(r, p); const R = onPen(r, p.penRoots); return Math.max(...R.flatMap((q) => q.pts.map((P) => P[1]))) - Math.max(...B.map((q) => bbox(q)[3])); };
  const base = { ...p0, kind: "Onion", sizeVar: 0, rotation: "Upright", size: 60, count: 3, tops: "None" };
  ok(rl({ ...base, rootLen: 1 }) > rl({ ...base, rootLen: 0.3 }) && rl({ ...base, rootLen: 1 }) <= 60 * 1 + 1e-6, "Root length: longer tuft, never beyond Root length × size");
  ok(onPen(run({ ...base, roots: 1 }), base.penRoots).length > onPen(run({ ...base, roots: 0.2 }), base.penRoots).length, "Roots 1 vs 0.2: more hairs");
  const tl = (p) => { const r = run(p); const B = bodies(r, p); const T = onPen(r, p.penTops); return Math.min(...B.map((q) => bbox(q)[1])) - Math.min(...T.flatMap((q) => q.pts.map((P) => P[1]))); };
  const bt = { ...p0, kind: "Leek", sizeVar: 0, rotation: "Upright", size: 60, count: 3, roots: 0 };
  ok(tl({ ...bt, topLen: 1.5 }) > tl({ ...bt, topLen: 0.5 }), "Top length: taller leaves");
  const cnt = (p) => bodies(run(p), p).length;
  ok(cnt({ ...p0, count: 40, size: 150 }) < 40 && cnt({ ...p0, count: 40, size: 150 }) >= 1, "40 specimens at Size 150: fewer fit, none forced");
  ok(cnt({ ...p0, count: 20, size: 25, place: "Loose (may overlap)" }) === 20, "Loose: all 20 small specimens placed");
}

/* ---------- liveness ---------- */
const J = (r) => JSON.stringify(r);
const live = (b, patch, label) => ok(J(run({ ...b, ...patch })) !== J(run(b)), "param live: " + label);
live(p0, { kind: "Leek" }, "kind");
live(p0, { count: 3 }, "count");
live(p0, { size: 30 }, "size");
live(p0, { sizeVar: 0 }, "sizeVar");
live(p0, { irr: 0 }, "irr");
live(p0, { place: "Loose (may overlap)" }, "place");
live(p0, { rotation: "Upright" }, "rotation");
live(p0, { tilt: 50 }, "tilt (Tilt mode)");
live(p0, { texture: 0 }, "texture");
live(p0, { tops: "None" }, "tops");
live(p0, { topLen: 1.5 }, "topLen");
live(p0, { roots: 0 }, "roots");
live(p0, { rootLen: 1.2 }, "rootLen");
live(p0, { margin: 30 }, "margin");
live(p0, { seed: 5 }, "seed");
live(p0, { layer: 2 }, "layer");
live({ ...p0, kind: "Turnip" }, { penAccent: 3 }, "penAccent (Turnip)");
live(p0, { penTops: 5 }, "penTops");
live(p0, { penRoots: 6 }, "penRoots");

/* ---------- selects / showIf / extremes ---------- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) { const r = run({ ...p0, [pd.key]: opt }); ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")"); }
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(vis(p0).includes("tilt") && !vis({ ...p0, rotation: "Upright" }).includes("tilt"), "showIf: Tilt ° only in Tilt mode");
  ok(vis(p0).includes("topLen") && !vis({ ...p0, tops: "None" }).includes("topLen"), "showIf: Top length hidden for Tops None");
  ok(vis(p0).includes("rootLen") && !vis({ ...p0, roots: 0 }).includes("rootLen"), "showIf: Root length hidden at Roots 0");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
  const ext = run({ ...p0, count: 40, size: 150, sizeVar: 0, texture: 1, roots: 1, rootLen: 1.5, topLen: 2, place: "Loose (may overlap)", rotation: "Random" }, { W: 420, H: 297 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme (A3, 40 × 150 mm loose, everything max): finite + budget (" + npts(ext) + ")");
  ok(finiteAll(run(p0, { W: 30, H: 30 })), "tiny canvas: no throw");
  ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "margin larger than half the sheet: clamped, finite");
  let threw = false; try { def.overlay(p0, { W: 4, H: 4 }); def.overlay(p0, undefined); } catch (e) { threw = true; }
  ok(!threw && def.overlay(p0, CTX).some((q) => q.kind === "rect"), "overlay: margin rect, never throws");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
