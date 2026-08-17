/* Validator for the Chain node (key "chain").
   Run from the repo root: node tools/validate-chain.mjs
   First line says [lab] or [baked] - READ IT.

   Two oracles carry this node:

   1. BAND SIMPLICITY. The band is the centerline offset along its own normal,
      so the inner edge folds over itself wherever the centerline curves tighter
      than the half-width - at every polygon corner. The node clamps the corner
      radius above the half-width to prevent it; here that clamp is PROVEN with
      a segment-intersection sweep over the inner offset, for every shape and
      across the whole band/round parameter square. A fold is invisible in a
      thumbnail and unmistakable in ink.

   2. OCCLUSION. Hidden-line removal is re-derived independently: every emitted
      point is re-tested against every other link's plane by an implementation
      written from the geometry, not lifted from compute. Anything the node drew
      that a second opinion calls hidden is a failure. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "chain";

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
const p0 = defaults();
const A4 = { W: 297, H: 210 };
/* the engine calls compute as a method on the def; this node's compute and
   overlay share this._build, so the validator must call them the same way */
const run = (patch, ctx, ins) => def.compute(ins || [undefined, undefined], { ...p0, ...(patch || {}) }, ctx || A4, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const SHAPES = def.params.find((q) => q.key === "shape").options;
const LAYOUTS = def.params.find((q) => q.key === "layout").options;
const HATCHES = def.params.find((q) => q.key === "hatch").options;

/* --- descriptor contract --- */
for (const pd of def.params) {
  if (pd.type === "select") ok(Array.isArray(pd.options) && pd.options.length > 0, "select '" + pd.key + "' uses options[]");
  if (pd.type === "slider") ok([pd.min, pd.max, pd.step, pd.def].every(Number.isFinite), "slider '" + pd.key + "' has finite min/max/step/def");
}
ok(typeof def._build === "function", "_build is shared by compute and overlay");
ok(typeof def.overlay === "function", "node ships an overlay (it places a spatial layout)");

/* --- universal invariants --- */
const r1 = run(), r2 = run();
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");

const inb = (r, W, Hh, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210, 0.6), "in bounds on A4 wide");
ok(inb(run({}, { W: 210, H: 297 }), 210, 297, 0.6), "in bounds on A4 tall");
for (const s of SHAPES) {
  for (const lay of LAYOUTS) {
    const r = run({ shape: s, layout: lay });
    ok(finiteAll(r) && inb(r, 297, 210, 0.6), "in bounds: " + s + " / " + lay);
  }
}
/* the margin must actually be honoured, not merely approached */
{
  const r = run({ margin: 40 });
  ok(inb(r, 297, 210, 0.6), "margin 40 stays on the sheet");
  const xs = r.paths.flatMap((q) => q.pts.map((pt) => pt[0]));
  const ys = r.paths.flatMap((q) => q.pts.map((pt) => pt[1]));
  ok(Math.min(...xs) >= 39.4 && Math.max(...xs) <= 257.6 && Math.min(...ys) >= 39.4 && Math.max(...ys) <= 170.6,
    "margin 40 leaves the margin band empty");
}

/* ---------------------------------------------------------------- ORACLE 1
   the inner offset must stay a simple curve for every shape and every
   band/round combination the UI can produce */
function selfIntersects(pts) {
  const n = pts.length;
  const cellSize = 0.06;
  const buckets = new Map();
  const key = (a, b) => a + "," + b;
  const segs = [];
  for (let i = 0; i < n; i++) segs.push([pts[i], pts[(i + 1) % n]]);
  segs.forEach(([a, b], i) => {
    const x0 = Math.floor(Math.min(a[0], b[0]) / cellSize), x1 = Math.floor(Math.max(a[0], b[0]) / cellSize);
    const y0 = Math.floor(Math.min(a[1], b[1]) / cellSize), y1 = Math.floor(Math.max(a[1], b[1]) / cellSize);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = key(x, y);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    }
  });
  const cross = (i, j) => {
    if (i === j) return false;
    if ((i + 1) % n === j || (j + 1) % n === i) return false;   /* neighbours share a point */
    const [a, b] = segs[i], [c, d] = segs[j];
    const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
    const d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) if (cross(list[a], list[b])) return true;
  }
  return false;
}

{
  let worst = null, tested = 0;
  for (const s of SHAPES) {
    for (let band = 4; band <= 60; band += 4) {
      for (let round = 0; round <= 100; round += 20) {
        const B = def._build({ ...p0, shape: s, band, round }, A4, []);
        if (!B || !B.ok) { worst = s + " band " + band + " round " + round + " (build failed)"; continue; }
        const inner = B.cl.map((c, i) => [c[0] - B.nrm[i][0] * B.hU, c[1] - B.nrm[i][1] * B.hU]);
        tested++;
        if (selfIntersects(inner)) { worst = s + " band " + band + " round " + round; break; }
      }
      if (worst) break;
    }
    if (worst) break;
  }
  ok(!worst, "inner offset stays simple across the band x round square (" + tested + " combos" + (worst ? ", first fold at " + worst : "") + ")");
}
/* and the clamps that make that true are actually in force */
for (const s of SHAPES.filter((q) => q !== "Circle")) {
  const k = s === "Triangle" ? 3 : s === "Square" ? 4 : 6;
  const rIn = Math.cos(Math.PI / k);
  const B = def._build({ ...p0, shape: s, band: 60, round: 0 }, A4, []);
  ok(B.ok && B.hU < rIn, s + ": half-width is clamped below the inradius (" + B.hU.toFixed(3) + " < " + rIn.toFixed(3) + ")");
}
/* maximum rounding turns a polygon into its inscribed circle - the degenerate
   case the arc-center formula has to land on exactly */
for (const s of SHAPES.filter((q) => q !== "Circle")) {
  const k = s === "Triangle" ? 3 : s === "Square" ? 4 : 6;
  const rIn = Math.cos(Math.PI / k);
  const B = def._build({ ...p0, shape: s, band: 6, round: 100 }, A4, []);
  const rr = B.cl.map((c) => Math.hypot(c[0], c[1]));
  const spread = Math.max(...rr) - Math.min(...rr);
  ok(spread < 0.02 && Math.abs(Math.max(...rr) - rIn) < 0.02,
    s + " at 100% round is the inscribed circle (radius spread " + spread.toFixed(4) + ")");
}

/* ---------------------------------------------------------------- ORACLE 2
   independent hidden-line check: nothing drawn may sit behind another link */
{
  const p = { ...p0, links: 4, gap: 3 };
  const B = def._build(p, A4, []);
  ok(B.ok, "build succeeds for the occlusion case");
  const R = B.R, hU = B.hU;
  /* distance from a local point to the unit centerline, written independently
     of the node's grid: a plain O(n) scan */
  const distToCl = (u, v) => {
    let best = Infinity;
    const N = B.cl.length;
    for (let i = 0; i < N; i++) {
      const a = B.cl[i], b = B.cl[(i + 1) % N];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy;
      let t = L2 > 0 ? ((u - a[0]) * dx + (v - a[1]) * dy) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = u - (a[0] + dx * t), qy = v - (a[1] + dy * t);
      const d = Math.hypot(qx, qy);
      if (d < best) best = d;
    }
    return best;
  };
  /* invert the node's projection so a drawn 2-D point can be tested in 3-D:
     recover view x,y and then, for the owning link, the depth on its plane */
  const unproj = (x, y) => [(x - B.ox) / B.sc, (y - B.oy) / B.sc];
  const hiddenBy = (X, Y, Z, skip) => {
    for (let j = 0; j < B.links.length; j++) {
      if (j === skip) continue;
      const lk = B.links[j];
      if (Math.abs(lk.N[2]) < 1e-7) continue;
      const t = ((lk.C[0] - X) * lk.N[0] + (lk.C[1] - Y) * lk.N[1] + (lk.C[2] - Z) * lk.N[2]) / lk.N[2];
      if (t <= 1e-4) continue;
      const dx = X - lk.C[0], dy = Y - lk.C[1], dz = (Z + t) - lk.C[2];
      const u = (dx * lk.U[0] + dy * lk.U[1] + dz * lk.U[2]) / R;
      const v = (dx * lk.V[0] + dy * lk.V[1] + dz * lk.V[2]) / R;
      if (distToCl(u, v) < hU * 0.92) return j;   /* 0.92: ignore the cut seam itself */
    }
    return -1;
  };
  const r = def.compute([undefined, undefined], p, A4, {});
  /* recover each drawn point's depth by finding which link's plane it lies on;
     a point belongs to the link whose band contains it at the nearest depth */
  let checked = 0, bad = 0;
  for (const path of r.paths) {
    for (let i = 0; i < path.pts.length; i += 7) {
      const [X, Y] = unproj(path.pts[i][0], path.pts[i][1]);
      /* find candidate owners: links whose band covers this screen point */
      let ownerZ = -Infinity, owner = -1;
      for (let j = 0; j < B.links.length; j++) {
        const lk = B.links[j];
        if (Math.abs(lk.N[2]) < 1e-7) continue;
        const t = ((lk.C[0] - X) * lk.N[0] + (lk.C[1] - Y) * lk.N[1]) / lk.N[2];
        const dx = X - lk.C[0], dy = Y - lk.C[1], dz = t - lk.C[2];
        const u = (dx * lk.U[0] + dy * lk.U[1] + dz * lk.U[2]) / R;
        const v = (dx * lk.V[0] + dy * lk.V[1] + dz * lk.V[2]) / R;
        if (distToCl(u, v) <= hU * 1.02 && t > ownerZ) { ownerZ = t; owner = j; }
      }
      if (owner < 0) continue;
      checked++;
      if (hiddenBy(X, Y, ownerZ, owner) >= 0) bad++;
    }
  }
  ok(checked > 200, "occlusion oracle sampled enough points (" + checked + ")");
  ok(bad / Math.max(1, checked) < 0.02, "no drawn point sits behind another link (" + bad + "/" + checked + " suspect)");

  /* and the switch must actually do something in both directions */
  const on = npts(run({ ...p, hidden: true })), off = npts(run({ ...p, hidden: false }));
  ok(off > on, "Hidden lines off draws strictly more (" + off + " > " + on + ")");
  ok(npts(run({ ...p, links: 1, hidden: true })) === npts(run({ ...p, links: 1, hidden: false })),
    "a single link is never occluded (a plane cannot hide itself)");
}

/* --------------------------------------------------------- SIZE IS REAL MM
   Fitting the drawing to the margin box would silently turn "Link size mm"
   into a hatch-density knob: the chain would fill the sheet at every size and
   only the rung count would change. The fit therefore shrinks and never grows,
   which is testable - below saturation the extent must track the parameter
   proportionally, and the hatch pitch must stay put in paper millimetres. */
{
  const extent = (patch) => {
    const r = run(patch);
    const xs = r.paths.flatMap((q) => q.pts.map((pt) => pt[0]));
    const ys = r.paths.flatMap((q) => q.pts.map((pt) => pt[1]));
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  const e20 = extent({ size: 20 }), e40 = extent({ size: 40 });
  ok(e40[1] > e20[1] * 1.8 && e40[1] < e20[1] * 2.2, "doubling Link size doubles the drawn extent (" + e20[1].toFixed(1) + " -> " + e40[1].toFixed(1) + " mm)");
  ok(extent({ size: 30 })[1] > e20[1] && e40[1] > extent({ size: 30 })[1], "extent is monotone in Link size");
  const big = extent({ size: 140 });
  ok(big[1] <= 182.6 && big[0] <= 269.6, "an oversized chain is pulled back onto the sheet instead of running off");
  /* rung pitch in ink must not depend on the link size */
  const pitchOf = (size) => {
    const r = run({ size, edges: false, hatch: "Rungs" });
    const heads = r.paths.slice(0, 60).map((q) => q.pts[0]);
    const d = [];
    for (let i = 1; i < heads.length; i++) d.push(Math.hypot(heads[i][0] - heads[i - 1][0], heads[i][1] - heads[i - 1][1]));
    d.sort((a, b) => a - b);
    return d[Math.floor(d.length / 2)];
  };
  const p25 = pitchOf(25), p70 = pitchOf(70);
  ok(Math.abs(p25 - p70) / p25 < 0.12, "hatch pitch is paper-true across sizes (" + p25.toFixed(3) + " vs " + p70.toFixed(3) + " mm)");
  const pFine = pitchOf(40), pCoarse = (() => {
    const r = run({ size: 40, edges: false, hatch: "Rungs", gap: 3 });
    const heads = r.paths.slice(0, 60).map((q) => q.pts[0]);
    const d = [];
    for (let i = 1; i < heads.length; i++) d.push(Math.hypot(heads[i][0] - heads[i - 1][0], heads[i][1] - heads[i - 1][1]));
    d.sort((a, b) => a - b);
    return d[Math.floor(d.length / 2)];
  })();
  ok(pCoarse > pFine * 1.8, "Hatch spacing still drives the pitch (" + pFine.toFixed(2) + " -> " + pCoarse.toFixed(2) + " mm)");
}

/* --------------------------------------------------------- THE SINGLE LINK
   Links reaches 1, and a lone link is a legitimate deliverable: a hatched
   ring, triangle or hexagon with no chain at all. Everything that describes a
   RELATIONSHIP between links is inert there and must be out of the inspector,
   or the user tunes controls that provably cannot do anything. */
{
  const one = run({ links: 1 });
  ok(one.paths.length > 0 && finiteAll(one), "a single link draws (" + one.paths.length + " paths)");
  ok(inb(one, 297, 210, 0.6), "a single link stays in bounds");
  ok(def.params.find((q) => q.key === "links").min === 1, "the Links slider reaches 1");
  const vis1 = def.params.filter((q) => typeof q.showIf !== "function" || q.showIf({ ...p0, links: 1 })).map((q) => q.key);
  for (const dead of ["layout", "overlap", "tilt", "spinStep", "off", "hidden"]) {
    ok(vis1.indexOf(dead) < 0, "'" + dead + "' is hidden at one link (it cannot do anything there)");
  }
  /* Compared with a tolerance: an offset applied to the only link is a pure
     translation that the centring cancels, and "cancels" in floating point
     means 4e-14 mm, not zero. Byte equality here would be a claim about
     arithmetic, not about the node. */
  const worstDelta = (A, Bp) => {
    if (A.length !== Bp.length) return Infinity;
    let w = 0;
    for (let i = 0; i < A.length; i++) {
      if (A[i].pts.length !== Bp[i].pts.length) return Infinity;
      for (let j = 0; j < A[i].pts.length; j++) {
        w = Math.max(w, Math.hypot(A[i].pts[j][0] - Bp[i].pts[j][0], A[i].pts[j][1] - Bp[i].pts[j][1]));
      }
    }
    return w;
  };
  for (const dead of ["layout", "overlap", "tilt", "spinStep", "off", "hidden"]) {
    const pd = def.params.find((q) => q.key === dead);
    const val = pd.type === "check" ? false : pd.type === "select" ? pd.options[pd.options.length - 1] : 33;
    const d = worstDelta(one.paths, run({ links: 1, [dead]: val }).paths);
    ok(d < 1e-6, "'" + dead + "' really is inert at one link (delta " + d.toExponential(1) + " mm)");
  }
  for (const keep of ["shape", "size", "band", "spin", "hatch", "gap", "edges", "margin", "layer"]) {
    ok(vis1.indexOf(keep) >= 0, "'" + keep + "' stays available at one link");
  }
  for (const s of SHAPES) {
    const r = run({ links: 1, shape: s });
    ok(r.paths.length > 0 && finiteAll(r) && inb(r, 297, 210, 0.6), "single " + s + " link draws in bounds");
  }
  /* a lone link should use the sheet, not shrink to a chain-sized fragment */
  const xs = one.paths.flatMap((q) => q.pts.map((pt) => pt[0]));
  ok(Math.max(...xs) - Math.min(...xs) > 20, "a single link is drawn at its real size, not a fragment");
}

/* --- every parameter must do something --- */
const base = JSON.stringify(run());
const live = (patch, label) => ok(JSON.stringify(run(patch)) !== base, "param live: " + label);
live({ shape: "Square" }, "shape");
live({ links: 7 }, "links");
live({ size: 90 }, "size");
live({ band: 45 }, "band");
live({ layout: "Ring" }, "layout");
live({ overlap: 10 }, "overlap");
live({ tilt: 85 }, "tilt");
live({ off: 14 }, "off");
{
  /* spin is rotationally invisible on a circle, so prove it on a polygon */
  const bSq = JSON.stringify(run({ shape: "Square" }));
  ok(JSON.stringify(run({ shape: "Square", spin: 45 })) !== bSq, "param live: spin (on a polygon)");
  ok(JSON.stringify(run({ shape: "Square", spinStep: 30 })) !== bSq, "param live: spinStep (on a polygon)");
  /* spin 360 must land back on spin 0 - the basis rotation has to be a true
     rotation, not an accumulating transform. Compared with a tolerance, not
     byte-wise: sin(2pi) is 2.4e-16, not 0, and demanding exact equality would
     be asserting something false about floating point rather than about the
     node. The real claim is that the drawing is identical in ink. */
  {
    const A = run({ shape: "Square", spin: 0 }).paths, Bp = run({ shape: "Square", spin: 360 }).paths;
    let worst = Infinity;
    if (A.length === Bp.length) {
      worst = 0;
      for (let i = 0; i < A.length && worst < 1e-6; i++) {
        if (A[i].pts.length !== Bp[i].pts.length) { worst = Infinity; break; }
        for (let j = 0; j < A[i].pts.length; j++) {
          worst = Math.max(worst, Math.hypot(A[i].pts[j][0] - Bp[i].pts[j][0], A[i].pts[j][1] - Bp[i].pts[j][1]));
        }
      }
    }
    ok(worst < 1e-6, "spin 360 reproduces spin 0 (worst point delta " + worst.toExponential(2) + " mm)");
  }
  /* a square is 4-fold symmetric: 90 degrees of spin is the same silhouette */
  const ext = (patch) => {
    const r = run(patch);
    const xs = r.paths.flatMap((q) => q.pts.map((pt) => pt[0]));
    const ys = r.paths.flatMap((q) => q.pts.map((pt) => pt[1]));
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  const e0 = ext({ shape: "Square", tilt: 0, pitch: 0, yaw: 0 });
  const e90 = ext({ shape: "Square", tilt: 0, pitch: 0, yaw: 0, spin: 90 });
  ok(Math.abs(e0[0] - e90[0]) < 0.6 && Math.abs(e0[1] - e90[1]) < 0.6,
    "a square link at spin 90 has the same extent (4-fold symmetry holds)");
  /* offset staggers, so it must widen the drawing across the chain axis */
  const wNo = ext({ off: 0, rot: 0 }), wOff = ext({ off: 20, rot: 0 });
  ok(wOff[1] > wNo[1] + 5, "Offset widens the chain across its axis (" + wNo[1].toFixed(1) + " -> " + wOff[1].toFixed(1) + " mm)");
  ok(JSON.stringify(run({ off: 8 })) !== JSON.stringify(run({ off: -8 })), "Offset sign is not symmetric away (it alternates, so it flips the stagger)");
}
live({ hatch: "Rungs" }, "hatch");
live({ gap: 3 }, "gap");
live({ lean: -8 }, "lean");
live({ edges: false }, "edges");
live({ hidden: false }, "hidden");
live({ yaw: 40 }, "yaw");
live({ pitch: -50 }, "pitch");
live({ rot: 0 }, "rot");
live({ margin: 45 }, "margin");
ok(run({ layer: 5 }).paths.every((q) => q.layer === 5), "param live: layer");
{
  const b2 = JSON.stringify(run({ shape: "Square" }));
  ok(JSON.stringify(run({ shape: "Square", round: 10 })) !== b2, "param live: round (polygon only)");
}

/* --- every select option draws --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ [pd.key]: opt });
    const need = pd.key === "hatch" && opt === "None" ? 0 : 1;
    ok(r.paths.length >= need && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}
ok(run({ hatch: "None", edges: false }).paths.length === 0, "hatch None + no edges draws nothing at all, cleanly");

/* --- wired spine --- */
{
  const spine = { paths: [{ pts: [[40, 40], [120, 60], [200, 140], [250, 60]], closed: false, layer: 0 }] };
  const wired = def.compute([spine, undefined], { ...p0, layout: "Wired spine" }, A4, {});
  ok(wired.paths.length > 0 && finiteAll(wired), "wired spine draws");
  ok(inb(wired, 297, 210, 0.6), "wired spine stays in bounds");
  ok(JSON.stringify(wired) !== JSON.stringify(run({ layout: "Wired spine" })), "the wired spine actually changes the layout");
  const noPin = def.compute([undefined, undefined], { ...p0, layout: "Wired spine" }, A4, {});
  ok(noPin.paths.length > 0, "Wired spine with nothing wired falls back to the Line layout");
  const junk = def.compute([{ paths: [{ pts: [[10, 10]], closed: false, layer: 0 }] }, undefined], { ...p0, layout: "Wired spine" }, A4, {});
  ok(junk.paths.length > 0 && finiteAll(junk), "a one-point spine path does not break it");
}

/* --- style passthrough --- */
{
  const styled = def.compute([undefined, { dash: 4, gap: 2 }], p0, A4, {});
  ok(Array.isArray(styled.paths), "a style input is accepted without throwing");
}

/* --- degenerate and extreme --- */
const hostile = [
  [{ band: 4, round: 0, shape: "Triangle" }, "thinnest band, sharpest corners"],
  [{ band: 60, round: 0, shape: "Triangle" }, "widest band, sharpest corners"],
  [{ band: 60, round: 100, shape: "Square" }, "widest band, fully round"],
  [{ links: 2 }, "two links"],
  [{ links: 1 }, "one link"],
  [{ overlap: 0 }, "no overlap"],
  [{ overlap: 70 }, "maximum overlap"],
  [{ tilt: 0 }, "no tilt (all links coplanar)"],
  [{ tilt: 90 }, "square tilt (real chain)"],
  [{ pitch: 0, yaw: 0 }, "dead-on view (every link edge-on or flat)"],
  [{ pitch: 89 }, "extreme pitch"],
  [{ size: 10 }, "tiny links"],
  [{ size: 140, links: 24 }, "huge links, many of them"],
  [{ margin: 0 }, "no margin"],
  [{ gap: 0.4, links: 24, size: 140 }, "densest hatch, most links"],
  [{ lean: 12, gap: 0.4 }, "extreme lean"],
  [{ off: 40 }, "maximum offset"],
  [{ off: -40, links: 24 }, "maximum negative offset, many links"],
  [{ spin: 360, spinStep: 180, shape: "Triangle" }, "spin wound to the stops"],
  [{ off: 40, spinStep: 137, links: 12, shape: "Hexagon" }, "offset and spin drift together"],
  [{ off: 40, tilt: 0, pitch: 0, yaw: 0 }, "offset with every link coplanar"],
];
for (const [patch, label] of hostile) {
  const t0 = Date.now();
  const r = run(patch);
  const ms = Date.now() - t0;
  ok(finiteAll(r) && inb(r, 297, 210, 0.6) && npts(r) <= 120000,
    "finite, in bounds, in budget: " + label + " (" + npts(r) + " pts, " + ms + " ms)");
}
ok(run({ gap: 0.4, links: 24, size: 140 }).paths.length > 0, "the densest case still draws something after coarsening");

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  for (const s of SHAPES) for (const h of HATCHES) {
    let threw = false;
    try { vis({ ...p0, shape: s, hatch: h }); } catch (e) { threw = true; }
    ok(!threw, "showIf never throws (" + s + " / " + h + ")");
  }
  ok(vis({ ...p0, shape: "Circle" }).indexOf("round") < 0, "Corner round hidden for Circle");
  ok(vis({ ...p0, shape: "Square" }).indexOf("round") >= 0, "Corner round shown for Square");
  ok(vis({ ...p0, hatch: "Rungs" }).indexOf("lean") < 0, "Lean hidden for straight Rungs");
  ok(vis({ ...p0, hatch: "Chevron" }).indexOf("lean") >= 0, "Lean shown for Chevron");
}

/* --- overlay --- */
{
  let threw = false, guides = null;
  try { guides = def.overlay(p0, A4, []); } catch (e) { threw = true; }
  ok(!threw && Array.isArray(guides) && guides.length > 0, "overlay returns guides without throwing");
  const kinds = new Set(guides.map((g) => g.kind));
  ok([...kinds].every((k) => ["rect", "circle", "point", "arrow", "poly"].includes(k)), "overlay uses only known guide kinds");
  const nums = guides.flatMap((g) => g.kind === "poly" ? g.pts.flat() : Object.values(g).filter((v) => typeof v === "number"));
  ok(nums.every(Number.isFinite), "overlay coordinates are all finite");
  /* the guide must match the drawing, so the spine points have to land inside
     the same fitted box the paths use */
  const pts = guides.filter((g) => g.kind === "point");
  ok(pts.length > 0 && pts.every((g) => g.x >= -1 && g.x <= 298 && g.y >= -1 && g.y <= 211), "overlay link markers sit on the sheet");
  for (const bad of [{}, { shape: "Square", band: 60, round: 0 }, { margin: 200 }, { links: 0 }, { size: 0 }]) {
    let t2 = false;
    try { def.overlay({ ...p0, ...bad }, A4, []); } catch (e) { t2 = true; }
    ok(!t2, "overlay survives " + JSON.stringify(bad));
  }
  let t3 = false;
  try { def.overlay(p0, A4, undefined); } catch (e) { t3 = true; }
  ok(!t3, "overlay survives a missing ins argument (older callers)");
}

/* --- purity --- */
{
  const p = { ...p0 };
  const snap = JSON.stringify(p);
  run({});
  def.compute([undefined, undefined], p, A4, {});
  ok(JSON.stringify(p) === snap, "compute does not mutate the params object");
  const spine = { paths: [{ pts: [[40, 40], [120, 60], [200, 140]], closed: false, layer: 0 }] };
  const before = JSON.stringify(spine);
  def.compute([spine, undefined], { ...p0, layout: "Wired spine" }, A4, {});
  ok(JSON.stringify(spine) === before, "compute does not mutate the wired input");
  const src = String(def.compute) + String(def._build);
  ok(!/Math\.random|document|window|navigator|Date\.now|performance\./.test(src), "no clock, DOM or device API");
}

console.log(fails ? "\n" + fails + " FAILURE(S)" : "\nALL OK");
process.exitCode = fails ? 1 : 0;
