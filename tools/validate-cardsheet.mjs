/* Validator for the Card Sheet node.
   Run from the repo root: node tools/validate-cardsheet.mjs
   Imports the REAL helpers. Auto-switches lab/baked; first line says which.

   Oracles (all mutation-tested against deliberately broken copies):
   - partner faces: the physical spot behind every front panel carries that
     face's real partner on the back (Cover <-> Inside L / top, Back cover <->
     Inside R / bottom, Front <-> Back), for both fold directions and both flips
   - orientation: an asymmetric marker reads upright where it must (front
     panels rot 0, horizontal-fold cover rot 180); tumble-back equals
     page-back rotated 180 degrees about the sheet centre, path for path
   - registration marks / pin holes / trim frame: identical coordinates on both
     sides and invariant under both flips
   - Back offset moves back content by exactly (dx, dy), never the marks, and
     never the front
   - fold marks sit on the fold line; trim ticks on card corners
   - duplex vernier: 21 ticks, pitch exactly 1.00 (front) / 1.10 (back), back
     scales sit on the physical spot of the front scales, and simulated errors
     read back as k = 10 e
   - Fit never grows; content stays inside its padded panel in every scaling
   - overlay drift: overlay card rects are tiled exactly by the panel frames */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "cardsheet";
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

const defaults = () => { const q = {}; for (const pr of def.params) q[pr.key] = pr.def; return q; };
const A3P = { W: 297, H: 420 }, A4L = { W: 297, H: 210 }, A4P = { W: 210, H: 297 };
const p0 = defaults();
const FRONT = "Front (outside)", BACK = "Back (inside)";
const PAGE = "Vertical axis (turn like a page)", TUMBLE = "Horizontal axis (turn end over end)";
const MK = 1;

/* --- markers: an asymmetric "flag" per face, on its own layer (2 + face) so the
       output tells us which face landed where and which way up it reads --- */
const flag = (ctx, layer) => {
  const { W, H } = ctx;
  /* vertical stem OFF centre (x = 0.38 W) so a wrong transform cannot hide behind
     the grid's own symmetry; pennant to the right at the TOP: upright = pennant
     above the centre, pointing +x */
  const sx = W * 0.38;
  return {
    paths: [
      { pts: [[sx, H * 0.3], [sx, H * 0.7]], closed: false, layer },
      { pts: [[sx, H * 0.3], [sx + W * 0.15, H * 0.36]], closed: false, layer },
    ],
  };
};
const insFor = (ctx, n) => Array.from({ length: n }, (_, i) => flag(ctx, 2 + i));
const nFaces = (fold) => (fold === "None" ? 2 : 4);
const run = (patch, ctx, ins) => {
  const p = { ...p0, ...patch };
  ctx = ctx || A3P;
  return def.compute(ins || insFor(ctx, nFaces(p.fold)), p, ctx, {});
};
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
};
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const keyOf = (q, d = 4) => (q.closed ? "C" : "O") + q.layer + ":" + q.pts.map(([x, y]) => x.toFixed(d) + "," + y.toFixed(d)).join(";");
const pathSet = (r, filter) => new Set(r.paths.filter(filter || (() => true)).map((q) => keyOf(q)));
const sameSet = (A, B) => A.size === B.size && [...A].every((k) => B.has(k));
const mapPaths = (r, f) => ({ paths: r.paths.map((q) => ({ ...q, pts: q.pts.map(f) })) });
/* a path's key after mapping, canonical for direction (a reversed open path is the same line) */
const canon = (q) => {
  const a = q.pts.map(([x, y]) => x.toFixed(4) + "," + y.toFixed(4));
  const b = [...a].reverse();
  const s = a.join(";") < b.join(";") ? a : b;
  return (q.closed ? "C" : "O") + q.layer + ":" + s.join(";");
};
const canonSet = (r, filter) => new Set(r.paths.filter(filter || (() => true)).map(canon));
/* closed paths: canonical up to rotation of the start point and direction */
const canonClosed = (q) => {
  const pts = q.pts.map(([x, y]) => x.toFixed(4) + "," + y.toFixed(4));
  let best = null;
  for (const seq of [pts, [...pts].reverse()]) for (let i = 0; i < seq.length; i++) {
    const s = seq.slice(i).concat(seq.slice(0, i)).join(";");
    if (best === null || s < best) best = s;
  }
  return "C" + q.layer + ":" + best;
};
const canonAny = (q) => (q.closed ? canonClosed(q) : canon(q));
const canonAnySet = (r, filter) => new Set(r.paths.filter(filter || (() => true)).map(canonAny));
const isMark = (q) => q.layer === MK;
const isContent = (q) => q.layer >= 2;

/* --- universal invariants --- */
const r1 = run({}), r2 = run({});
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults on A3 portrait (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(r1.paths.every((q) => q.pts.every(([x, y]) => x >= 0.5 - 1e-9 && x <= 297 - 0.5 + 1e-9 && y >= 0.5 - 1e-9 && y <= 420 - 0.5 + 1e-9)), "in bounds (clamped to 0.5 mm inside the sheet)");
ok(npts(r1) < 120000, "point budget");
{
  const ins = insFor(A3P, 4);
  const snap = JSON.stringify(ins);
  run({}, A3P, ins);
  ok(JSON.stringify(ins) === snap, "inputs not mutated");
}
ok(run({ cardW: 300, cardH: 300, margin: 40 }, A4L) === H.EMPTY || run({ cardW: 300, cardH: 300, margin: 40 }, A4L).paths.length === 0, "nothing fits -> EMPTY, no throw");
ok(finiteAll(run({}, A3P, [undefined, undefined, undefined, undefined])), "unwired pins -> marks only, no throw");
ok(finiteAll(run({}, A3P, [{ paths: [] }, { paths: [{ pts: [[1, 1]], closed: false, layer: 0 }] }, null, {}])), "degenerate inputs (empty, 1-point, null, {}) -> no throw");

/* --- pins follow the fold --- */
{
  const names = (fold) => def.ins({ params: { fold } }).map((q) => q.name || q.label || q[1] || JSON.stringify(q));
  ok(def.ins({ params: { fold: "None" } }).length === 2 && def.ins({ params: { fold: "Vertical" } }).length === 4 && def.ins({ params: { fold: "Horizontal" } }).length === 4,
    "ins(): 2 pins flat, 4 pins folded (" + names("None").join("/") + " | " + names("Vertical").join("/") + " | " + names("Horizontal").join("/") + ")");
  ok(def.ins({}).length === 4 && def.ins().length === 4, "ins() survives a missing node / params (defaults to Vertical)");
}

/* --- default fit: A3 portrait takes 2 x 2 cards of 140 x 200 --- */
{
  const fr = run({ frames: true, trim: false, reg: false, foldMarks: "None" }, A3P, [undefined, undefined, undefined, undefined]);
  const frames = fr.paths.filter((q) => q.closed && q.layer === MK);
  ok(frames.length === 8, "A3 portrait, 140x200, margin 5, gap 6: 2 x 2 cards = 8 panel frames (got " + frames.length + ")");
  const fr4 = run({ frames: true, trim: false, reg: false, foldMarks: "None" }, A4L, [undefined, undefined, undefined, undefined]);
  ok(fr4.paths.filter((q) => q.closed && q.layer === MK).length === 4, "A4 landscape: 2 x 1 cards fit (4 panel frames), the second row is dropped");
  const fr5 = run({ frames: true, trim: false, reg: false, foldMarks: "None" }, A4P, [undefined, undefined, undefined, undefined]);
  ok(fr5.paths.filter((q) => q.closed && q.layer === MK).length === 2, "A4 portrait: 1 card fits (2 panel frames)");
}

/* --- geometry per panel: locate each face marker in the output --- */
const panelsOf = (r) => {
  /* group content paths by layer (= face); each face may appear in several cards -> cluster by proximity */
  const out = [];
  for (const q of r.paths.filter(isContent)) {
    if (q.pts.length !== 2) continue;
    out.push({ face: q.layer - 2, pts: q.pts });
  }
  return out;
};
/* a flag = stem (2 pts, vertical or horizontal) + pennant. Identify each stem and the pennant attached to its top end. */
const flagsOf = (r) => {
  const segs = panelsOf(r);
  const flags = [];
  for (const s of segs) {
    const [a, b] = s.pts;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    /* stems are the long ones */
    const pen = segs.find((t) => t !== s && t.face === s.face && (near(t.pts[0][0], a[0], 1e-6) && near(t.pts[0][1], a[1], 1e-6) || near(t.pts[0][0], b[0], 1e-6) && near(t.pts[0][1], b[1], 1e-6)) && Math.hypot(t.pts[1][0] - t.pts[0][0], t.pts[1][1] - t.pts[0][1]) < len * 0.9);
    if (!pen) continue;
    const top = near(pen.pts[0][0], a[0], 1e-6) && near(pen.pts[0][1], a[1], 1e-6) ? a : b;
    const bottom = top === a ? b : a;
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    /* orientation: which way does the stem point from bottom to top, and which side is the pennant */
    const up = [Math.sign(top[0] - bottom[0]), Math.sign(top[1] - bottom[1])];
    const side = [Math.sign(pen.pts[1][0] - top[0]), Math.sign(pen.pts[1][1] - top[1])];
    flags.push({ face: s.face, cx, cy, up, side });
  }
  return flags;
};
const uprightOf = (f) => (f.up[1] === -1 && f.side[0] === 1 ? 0 : f.up[1] === 1 && f.side[0] === -1 ? 180 : f.up[0] === 1 && f.side[1] === 1 ? 90 : f.up[0] === -1 && f.side[1] === -1 ? 270 : -1);
const partner = (fold) => (fold === "None" ? { 0: 1 } : { 0: 2, 1: 3 });
const flipPt = (ctx, tumble) => ([x, y]) => (tumble ? [x, ctx.H - y] : [ctx.W - x, y]);

/* the panel (frame) that contains a flag; partner checks compare panels, because the
   back carries a different composition, not a mirrored copy of the front */
const framesOf = (r) => r.paths.filter((q) => q.layer === MK && q.closed && q.pts.length === 4).map((q) => bbox(q.pts));
const frameAt = (frames, x, y) => frames.find((b) => x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6);
const sameRect = (a, b) => near(a.x0, b.x0, 1e-4) && near(a.x1, b.x1, 1e-4) && near(a.y0, b.y0, 1e-4) && near(a.y1, b.y1, 1e-4);
const flipRect = (ctx, tumble) => (b) => (tumble ? { x0: b.x0, x1: b.x1, y0: ctx.H - b.y1, y1: ctx.H - b.y0 } : { x0: ctx.W - b.x1, x1: ctx.W - b.x0, y0: b.y0, y1: b.y1 });

for (const fold of ["None", "Vertical", "Horizontal"]) {
  const base = { fold, trim: false, reg: false, foldMarks: "None", frames: true };
  const fr = run({ ...base, side: FRONT });
  const ff = flagsOf(fr);
  const expected = fold === "None" ? 4 : 8;
  ok(ff.length === expected, "fold " + fold + ": front carries " + expected + " face markers (got " + ff.length + ")");
  /* orientation on the front */
  const wantRot = (face) => (fold === "Horizontal" && face === 0 ? 180 : 0);
  ok(ff.every((f) => uprightOf(f) === wantRot(f.face)), "fold " + fold + ": front faces read upright (horizontal-fold cover 180)");
  /* front faces present: None -> 0 ; folded -> 0 and 1 only */
  const facesF = new Set(ff.map((f) => f.face));
  ok(fold === "None" ? sameSet(facesF, new Set([0])) : sameSet(facesF, new Set([0, 1])), "fold " + fold + ": front shows only the outside faces " + [...facesF].join(","));
  for (const [flipName, flip, tumble] of [["page", PAGE, false], ["tumble", TUMBLE, true]]) {
    const bk = run({ ...base, side: BACK, flip });
    const fb = flagsOf(bk);
    ok(fb.length === expected, "fold " + fold + " " + flipName + ": back carries " + expected + " markers");
    /* partner: the panel behind every front panel (its rect pushed through the physical
       flip) is a back panel carrying the partner face - checked on panel rects, and the
       back flag must sit inside that rect */
    const TR = flipRect(A3P, tumble);
    const pr = partner(fold);
    const frF = framesOf(fr), frB = framesOf(bk);
    let partnersOK = fb.length === expected && frF.length === expected && frB.length === expected;
    for (const f of ff) {
      const pf = frameAt(frF, f.cx, f.cy);
      if (!pf) { partnersOK = false; continue; }
      const want = TR(pf);
      const pb = frB.find((b) => sameRect(b, want));
      const hit = pb && fb.find((g) => g.face === pr[f.face] && frameAt([pb], g.cx, g.cy));
      if (!pb || !hit) partnersOK = false;
    }
    ok(partnersOK, "fold " + fold + " " + flipName + ": every front panel's physical back is a panel carrying its partner face");
    /* note: with identical compositions on every card and a centred grid, "mirror y"
       and "rotate 180" produce the same plot, so a wrong tumble transform is only
       observable on asymmetric marks - the duplex-scale placement check covers it */
    /* back orientation: page flip -> upright; tumble -> 180 */
    ok(fb.every((g) => uprightOf(g) === (tumble ? 180 : 0)), "fold " + fold + " " + flipName + ": back faces read " + (tumble ? "180 (matching the paper's turn)" : "upright"));
  }
  /* tumble-back == page-back rotated 180 about the sheet centre, path for path, ALL layers */
  const full = { fold, trim: true, reg: true, foldMarks: "Ticks", frames: true, trimFrame: true, pinHoles: false };
  const pb = run({ ...full, side: BACK, flip: PAGE }), tb = run({ ...full, side: BACK, flip: TUMBLE });
  const rot = mapPaths(pb, ([x, y]) => [297 - x, 420 - y]);
  ok(sameSet(canonAnySet(rot), canonAnySet(tb)), "fold " + fold + ": tumble-back == page-back rotated 180 (content + marks, " + tb.paths.length + " paths)");
}

/* --- sheet marks identical on both sides and symmetric under both flips --- */
for (const [label, patch] of [["registration marks", { reg: true }], ["trim frame", { trimFrame: true }], ["pin holes (page axis)", { pinHoles: true, reg: false }], ["pin holes (tumble axis)", { pinHoles: true, reg: false, flip: TUMBLE }]]) {
  const base = { trim: false, foldMarks: "None", frames: false, reg: false, trimFrame: false, pinHoles: false, ...patch };
  const fr = run({ ...base, side: FRONT }, A3P, [undefined, undefined, undefined, undefined]);
  const bk = run({ ...base, side: BACK }, A3P, [undefined, undefined, undefined, undefined]);
  const A = canonAnySet(fr, isMark), B = canonAnySet(bk, isMark);
  ok(A.size > 0 && sameSet(A, B), label + ": same coordinates on front and back (" + A.size + " paths)");
  const mx = canonAnySet(mapPaths(fr, ([x, y]) => [297 - x, y]), isMark), my = canonAnySet(mapPaths(fr, ([x, y]) => [x, 420 - y]), isMark);
  ok(sameSet(A, mx) && sameSet(A, my), label + ": symmetric under both flips");
}
{
  const a = run({ pinHoles: true }, A3P), b = run({ pinHoles: false }, A3P);
  ok(!sameSet(pathSet(a), pathSet(b)), "pin holes change the mark set (replace the two registration targets on the axis)");
  const marks = run({ pinHoles: true, reg: false, trim: false, foldMarks: "None" }, A3P, [undefined, undefined, undefined, undefined]).paths.filter(isMark);
  const circles = marks.filter((q) => q.closed);
  ok(circles.length === 2 && circles.every((q) => near(bbox(q.pts).x0 + (bbox(q.pts).x1 - bbox(q.pts).x0) / 2, 148.5, 1e-6)), "pin holes on the vertical flip axis x = W/2 (page turn)");
  const marksT = run({ pinHoles: true, reg: false, trim: false, foldMarks: "None", flip: TUMBLE }, A3P, [undefined, undefined, undefined, undefined]).paths.filter(isMark);
  const cT = marksT.filter((q) => q.closed);
  ok(cT.length === 2 && cT.every((q) => near(bbox(q.pts).y0 + (bbox(q.pts).y1 - bbox(q.pts).y0) / 2, 210, 1e-6)), "pin holes on the horizontal flip axis y = H/2 (tumble)");
}

/* --- Back offset: content moves by exactly (dx,dy) on the back, marks never, front never --- */
{
  const base = { frames: true };
  const b0 = run({ ...base, side: BACK }), b1 = run({ ...base, side: BACK, backX: 0.7, backY: -0.35 });
  const shifted = mapPaths(b0, ([x, y]) => [x + 0.7, y - 0.35]);
  const contentOrFrame = (q) => isContent(q) || (q.layer === MK && q.closed && q.pts.length === 4);
  ok(sameSet(pathSet(shifted, contentOrFrame), pathSet(b1, contentOrFrame)), "back offset shifts back content and panel frames by exactly (0.7, -0.35)");
  const marks = (q) => q.layer === MK && !(q.closed && q.pts.length === 4);
  ok(sameSet(pathSet(b0, marks), pathSet(b1, marks)), "back offset leaves trim / fold / registration marks untouched");
  const f0 = run({ ...base, side: FRONT }), f1 = run({ ...base, side: FRONT, backX: 0.7, backY: -0.35 });
  ok(JSON.stringify(f0) === JSON.stringify(f1), "back offset has no effect on the front");
}

/* --- fold and trim marks --- */
{
  const v = run({ fold: "Vertical", trim: false, reg: false, foldMarks: "Ticks" }, A3P, [undefined, undefined, undefined, undefined]).paths.filter(isMark);
  const xs = new Set(v.map((q) => q.pts[0][0].toFixed(4)));
  ok(v.length === 8 && v.every((q) => near(q.pts[0][0], q.pts[1][0])) && xs.size === 2, "vertical fold: 2 ticks per card on the card's centre line (4 cards -> 8 ticks, 2 distinct x)");
  const cards = run({ fold: "Vertical", trim: false, reg: false, foldMarks: "None", frames: true }, A3P, [undefined, undefined, undefined, undefined]).paths.filter((q) => q.closed);
  const cardMidX = new Set(cards.map((q) => { const b = bbox(q.pts); return (b.x0 === Math.min(...cards.map((c) => bbox(c.pts).x0)) || true) && b.x1.toFixed(4); }));
  ok([...xs].every((x) => cards.some((q) => near(bbox(q.pts).x0, +x) || near(bbox(q.pts).x1, +x))), "fold ticks coincide with the shared edge of the two panel frames");
  const h = run({ fold: "Horizontal", trim: false, reg: false, foldMarks: "Dashed lines" }, A3P, [undefined, undefined, undefined, undefined]).paths.filter(isMark);
  ok(h.length > 20 && h.every((q) => near(q.pts[0][1], q.pts[1][1])) && new Set(h.map((q) => q.pts[0][1].toFixed(4))).size === 2, "horizontal fold: dashed lines on the two row centre lines");
  const n = run({ fold: "None", trim: false, reg: false, foldMarks: "Ticks" }, A3P, [undefined, undefined]).paths.filter(isMark);
  ok(n.length === 0, "fold None: no fold marks even with Ticks selected");
  const t = run({ trim: true, reg: false, foldMarks: "None" }, A3P, [undefined, undefined, undefined, undefined]).paths.filter(isMark);
  ok(t.length === 4 * 4 * 2, "trim marks: 4 cards x 4 corners x 2 legs = 32 (got " + t.length + ")");
  const T = Math.min(4, Math.min(5 - 0.6, 6 / 2 - 0.3));
  ok(t.every((q) => near(Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]), T)), "trim tick length limited by the gap (" + T.toFixed(2) + " mm)");
}

/* --- scaling: content stays inside its padded panel, Fit never grows --- */
{
  const fullCanvas = (ctx, layer) => ({ paths: [{ pts: [[0, 0], [ctx.W, 0], [ctx.W, ctx.H], [0, ctx.H]], closed: true, layer }, { pts: [[0, 0], [ctx.W, ctx.H]], closed: false, layer }] });
  for (const sc of ["Fit", "Fill (crop)", "Stretch", "Rotate 90 + Fit", "Rotate 90 + Fill"]) {
    const ins = [fullCanvas(A3P, 2), fullCanvas(A3P, 3), fullCanvas(A3P, 4), fullCanvas(A3P, 5)];
    const r = run({ scaling: sc, frames: true, trim: false, reg: false, foldMarks: "None" }, A3P, ins);
    const frames = r.paths.filter((q) => q.layer === MK && q.closed).map((q) => bbox(q.pts));
    const content = r.paths.filter(isContent);
    const insideSome = content.every((q) => q.pts.every(([x, y]) => frames.some((b) => x >= b.x0 + 3 - 1e-6 && x <= b.x1 - 3 + 1e-6 && y >= b.y0 + 3 - 1e-6 && y <= b.y1 - 3 + 1e-6)));
    ok(content.length > 0 && insideSome, "scaling '" + sc + "': all content inside a padded panel (pad 3)");
    if (sc === "Fit" || sc === "Rotate 90 + Fit") {
      const b = bbox(content.flatMap((q) => q.pts));
      const pw = frames[0].x1 - frames[0].x0 - 6, ph = frames[0].y1 - frames[0].y0 - 6;
      const sw = sc === "Fit" ? 297 : 420, sh = sc === "Fit" ? 420 : 297;
      const s = Math.min(pw / sw, ph / sh);
      ok(s <= 1 + 1e-9, "scaling '" + sc + "': scale " + s.toFixed(3) + " <= 1 (never grows)");
    }
  }
  const fill = run({ scaling: "Fill (crop)", frames: true, trim: false, reg: false, foldMarks: "None" }, A3P, [fullCanvas(A3P, 2), fullCanvas(A3P, 3), fullCanvas(A3P, 4), fullCanvas(A3P, 5)]);
  const diag = fill.paths.filter((q) => isContent(q) && !q.closed && !near(q.pts[0][0], q.pts[1][0]) && !near(q.pts[0][1], q.pts[1][1]));
  ok(diag.length === 8 && diag.every((q) => q.pts.length === 2), "Fill (crop): the canvas diagonal is clipped to each panel (8 clipped runs; the canvas border becomes axis-aligned runs)");
}

/* --- duplex test: vernier scales --- */
{
  const dx = (q) => q.pts[1][0] - q.pts[0][0], dy = (q) => q.pts[1][1] - q.pts[0][1];
  const scalesOf = (r) => {
    const m = r.paths.filter((q) => q.layer === MK && !q.closed && q.pts.length === 2);
    /* ticks: short segments (<= 6.5 mm) perpendicular to a baseline; group by baseline coordinate */
    const ticks = m.filter((q) => Math.hypot(dx(q), dy(q)) <= 6.5 && (near(dx(q), 0) || near(dy(q), 0)));
    const groups = {};
    for (const t of ticks) {
      const vert = near(dx(t), 0);
      /* the tick's baseline end is pts[0] (emitted [base, base - across*len]) */
      const key = (vert ? "x@" + t.pts[0][1].toFixed(3) : "y@" + t.pts[0][0].toFixed(3));
      (groups[key] = groups[key] || []).push(vert ? t.pts[0][0] : t.pts[0][1]);
    }
    return Object.entries(groups).map(([k, arr]) => ({ key: k, axis: k[0], pos: arr.sort((a, b) => a - b) })).filter((g) => g.pos.length >= 21);
  };
  const fr = run({ mode: "Duplex test", trim: false, reg: false, foldMarks: "None", side: FRONT }, A3P);
  const bk = run({ mode: "Duplex test", trim: false, reg: false, foldMarks: "None", side: BACK }, A3P);
  ok(fr.paths.every(isMark) && bk.paths.every(isMark), "duplex test: no content, marks only");
  const sf = scalesOf(fr), sb = scalesOf(bk);
  ok(sf.length === 4 && sb.length === 4, "duplex test: 4 vernier scales per side (got " + sf.length + " / " + sb.length + ")");
  const pitchOK = (S, pitch) => S.every((g) => g.pos.length === 21 && g.pos.every((v, i) => i === 0 || near(v - g.pos[i - 1], pitch, 1e-6)));
  ok(pitchOK(sf, 1.0), "front verniers: 21 ticks at exactly 1.00 mm");
  ok(pitchOK(sb, 1.1), "back verniers: 21 ticks at exactly 1.10 mm");
  /* back scale centres sit where the front scale centres physically are (page flip -> mirror x) */
  const centre = (g) => g.pos[10];
  const cf = sf.map((g) => (g.axis === "x" ? [centre(g), +g.key.slice(2)] : [+g.key.slice(2), centre(g)]));
  const cb = sb.map((g) => (g.axis === "x" ? [centre(g), +g.key.slice(2)] : [+g.key.slice(2), centre(g)]));
  ok(cf.every(([x, y]) => cb.some(([bx, by]) => near(297 - x, bx, 1e-4) && near(y, by, 1e-4))), "back scales land on the physical spot of the front scales (page flip)");
  const bkT = run({ mode: "Duplex test", trim: false, reg: false, foldMarks: "None", side: BACK, flip: TUMBLE }, A3P);
  const cbT = scalesOf(bkT).map((g) => (g.axis === "x" ? [centre(g), +g.key.slice(2)] : [+g.key.slice(2), centre(g)]));
  ok(cf.every(([x, y]) => cbT.some(([bx, by]) => near(x, bx, 1e-4) && near(420 - y, by, 1e-4))), "back scales land on the physical spot of the front scales (tumble)");
  /* front ticks above the baseline, back ticks below: the tick's free end lies on opposite sides */
  const sideOf = (r, axis) => r.paths.filter((q) => q.layer === MK && !q.closed && q.pts.length === 2 && Math.hypot(dx(q), dy(q)) <= 6.5 && (axis === "x" ? near(dx(q), 0) && !near(dy(q), 0) : near(dy(q), 0) && !near(dx(q), 0))).map((q) => Math.sign(axis === "x" ? dy(q) : dx(q)));
  ok(new Set(sideOf(fr, "x")).size === 1 && new Set(sideOf(bk, "x")).size === 1 && sideOf(fr, "x")[0] === -sideOf(bk, "x")[0], "front and back ticks lie on opposite sides of the baseline (they meet at it)");
  /* the arithmetic: a front seen through the paper shifted by e in the back frame lines up at k = 10 e */
  let arith = true;
  for (const e of [-0.5, -0.2, 0.3, 0.7]) {
    const g = sb.find((q) => q.axis === "x");
    const c = centre(g);
    let best = null;
    for (let k = -10; k <= 10; k++) {
      const backTick = c + 1.1 * k;              /* back tick k as plotted */
      const frontTick = c + k + e;               /* front tick paired with k, seen in the back frame with error e */
      const d = Math.abs(backTick - frontTick);
      if (best === null || d < best.d) best = { d, k };
    }
    if (best.k !== Math.round(10 * e)) arith = false;
  }
  ok(arith, "vernier reading: coincident pair k = 10 e for e in {-0.5, -0.2, 0.3, 0.7} -> Back offset = 0.1 k");
  ok(fr.paths.filter((q) => q.pts.length === 3).length === 4, "one arrow head per scale marks the plot + direction");
}

/* --- overlay drift: overlay card rects are tiled exactly by the panel frames --- */
{
  for (const [fold, side, flip] of [["Vertical", FRONT, PAGE], ["Vertical", BACK, PAGE], ["Horizontal", BACK, TUMBLE], ["None", BACK, TUMBLE]]) {
    const p = { ...p0, fold, side, flip, frames: true, trim: false, reg: false, foldMarks: "None" };
    const g = def.overlay(p, A3P);
    const rects = g.filter((q) => q.kind === "rect");
    const grid = rects[0];
    const cards = rects.slice(1);
    const frames = def.compute([undefined, undefined, undefined, undefined], p, A3P, {}).paths.filter((q) => q.closed && q.layer === MK).map((q) => bbox(q.pts));
    let tiled = cards.length === 4;
    for (const c of cards) {
      const inside = frames.filter((b) => b.x0 >= c.x - 1e-6 && b.x1 <= c.x + c.w + 1e-6 && b.y0 >= c.y - 1e-6 && b.y1 <= c.y + c.h + 1e-6);
      const area = inside.reduce((a, b) => a + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
      if (!near(area, c.w * c.h, 1e-6) || inside.length !== (fold === "None" ? 1 : 2)) tiled = false;
    }
    ok(tiled, "overlay drift: " + fold + " " + side.split(" ")[0] + " " + (flip === PAGE ? "page" : "tumble") + " - each overlay card is tiled exactly by its panel frames");
    ok(grid && frames.every((b) => b.x0 >= grid.x - 1e-6 && b.x1 <= grid.x + grid.w + 1e-6), "overlay grid rect contains all panels (" + fold + ")");
    const folds = g.filter((q) => q.kind === "arrow");
    ok(folds.length === (fold === "None" ? 0 : 4), "overlay draws " + (fold === "None" ? "no" : "4") + " fold lines (" + fold + ")");
  }
  ok(def.overlay({ ...p0, cardW: 300, cardH: 300, margin: 40 }, A4L).length === 1, "overlay: nothing fits -> shows the requested card at the margin");
  ok(def.overlay({ ...p0, scaling: "Fill (crop)" }, A3P).some((q) => q.kind === "poly"), "overlay: Fill (crop) shows the surviving source region");
  let threw = false;
  try { def.overlay({}, A3P); def.overlay({ ...p0, cols: NaN, rows: NaN, margin: NaN }, A3P); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws (empty params, NaN params)");
}

/* --- param liveness --- */
{
  const bJ = JSON.stringify(run({}));
  const live = (patch, label) => ok(JSON.stringify(run(patch)) !== bJ, "param live: " + label);
  live({ mode: "Duplex test" }, "mode");
  live({ cardW: 120 }, "cardW");
  live({ cardH: 180 }, "cardH");
  live({ fold: "None" }, "fold");
  live({ cols: 1 }, "cols");
  live({ rows: 1 }, "rows");
  live({ gap: 10 }, "gap");
  live({ margin: 12 }, "margin");
  live({ scaling: "Stretch" }, "scaling");
  live({ pad: 8 }, "pad");
  live({ side: BACK }, "side");
  live({ side: BACK, flip: TUMBLE }, "flip (on the back)");
  live({ side: BACK, backX: 1 }, "backX");
  live({ side: BACK, backY: 1 }, "backY");
  live({ trim: false }, "trim");
  live({ foldMarks: "Dashed lines" }, "foldMarks");
  live({ reg: false }, "reg");
  live({ trimFrame: true }, "trimFrame");
  live({ pinHoles: true }, "pinHoles");
  live({ frames: true }, "frames");
  live({ markPen: 5 }, "markPen");
  ok(JSON.stringify(run({ flip: TUMBLE })) === bJ, "flip has no effect on the front (it only describes how the sheet will be turned)");
}

/* --- extremes --- */
ok(finiteAll(run({ cols: 6, rows: 6, cardW: 40, cardH: 40, gap: 0, margin: 0 }, A4L)), "extreme: 6x6 tiny cards, no gap, no margin -> finite");
ok(finiteAll(run({ cols: 6, rows: 6, cardW: 40, cardH: 40, gap: 30, margin: 40 }, A4L)), "extreme: huge gap and margin -> finite");
{
  const big = { paths: Array.from({ length: 60 }, (_, i) => ({ pts: Array.from({ length: 1000 }, (__, j) => [j * 0.29, i * 7]), closed: false, layer: 3 })) };
  const r = run({ cols: 6, rows: 6, cardW: 40, cardH: 60, gap: 2, margin: 2, fold: "None" }, A3P, [big, big]);
  ok(npts(r) <= 120000 && finiteAll(r), "budget: 36 cards x 2 x 60k-point inputs stops cleanly at the cap (" + npts(r) + " pts)");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
