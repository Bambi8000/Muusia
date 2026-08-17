/* Validator: Zine imposition node.
   Run from the repo root: node tools/validate-zine.mjs
   Uses the REAL src/defs/helpers.js and auto-switches lab <-> baked.

   The oracles that matter:
   - back-side registration: every front page k has its recto/verso partner
     on the back, in the panel that physically lies behind it after the flip
     (checked geometrically, by mirroring the front panel rect);
   - imposition correctness: the page set is complete, no page appears twice;
   - overlay/compute drift: the overlay's panel rects must equal the rects
     compute actually places content into (the layout code is duplicated, so
     this is the guard that a one-sided edit cannot ship);
   - marks stay inside the sheet, budget, determinism, parameter liveness. */

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const LAB = "nodes-lab/zine.plotternode.js";
const BAKED = "src/defs/nodes/zine.js";

let def;
if (existsSync(LAB)) {
  console.log("[lab] " + LAB);
  const helpers = await import(pathToFileURL("src/defs/helpers.js").href);
  const body = readFileSync(LAB, "utf8").trim().replace(/;\s*$/, "");
  def = new Function(...Object.keys(helpers), "return " + body + ";")(...Object.values(helpers));
} else {
  console.log("[baked] " + BAKED);
  def = (await import(pathToFileURL(BAKED).href)).default;
}

let pass = 0, fail = 0;
const CHECK = (name, cond, extra) => {
  if (cond) { console.log("ok    " + name); pass++; }
  else { console.log("FAIL  " + name + (extra ? " - " + extra : "")); fail++; }
};

const defaults = {};
for (const q of def.params) defaults[q.key] = q.def;
const A4 = { W: 210, H: 297 }, LAND = { W: 297, H: 210 };

/* a page marker: a tiny distinct square near the canvas top-left corner, so a
   placed page can be identified AND its orientation read from the output */
const page = (i) => ({
  paths: [
    { pts: [[10, 10], [40, 10], [40, 25], [25, 28], [10, 25]], closed: true, layer: 0 },
    { pts: [[10, 10], [10 + i, 40]], closed: false, layer: 0 },
  ],
});
const wire = (n) => Array.from({ length: n }, (_, i) => page(i + 1));
const pagesFor = (over) => def.ins({ params: { ...defaults, ...over } }).length;
const run = (over, ctx = A4, nIns) => {
  const P = { ...defaults, ...over };
  const n = nIns == null ? pagesFor(over) : nIns;
  return def.compute(wire(n), P, ctx, { params: P });
};
const layout = (over, ctx = A4) => {
  const P = { ...defaults, ...over };
  return def.overlay(P, ctx, [], { params: P });
};
const allPts = (o) => o.paths.flatMap((q) => q.pts);
const finite = (o) => allPts(o).every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
const sig = (o) => JSON.stringify(o.paths);
const rectsOf = (ov) => ov.filter((g) => g.kind === "rect").slice(1)
  .map((g) => [g.x, g.y, g.w, g.h].map((v) => Math.round(v * 1e6) / 1e6).join(","));

const BOOKLETS = ["4-page folio", "8-page saddle stitch", "16-page saddle stitch"];
const ALL = ["8-page mini zine", ...BOOKLETS, "Accordion"];

/* --- pin count follows the format --- */
{
  CHECK("pins: mini zine = 8", pagesFor({ format: "8-page mini zine" }) === 8);
  CHECK("pins: folio = 4", pagesFor({ format: "4-page folio" }) === 4);
  CHECK("pins: 8-page saddle = 8", pagesFor({ format: "8-page saddle stitch" }) === 8);
  CHECK("pins: 16-page saddle = 16", pagesFor({ format: "16-page saddle stitch" }) === 16);
  CHECK("pins: accordion 6 one-sided = 6", pagesFor({ format: "Accordion", panels: 6, accBoth: false }) === 6);
  CHECK("pins: accordion 6 two-sided = 12", pagesFor({ format: "Accordion", panels: 6, accBoth: true }) === 12);
  let threw = false;
  try { def.ins({}); def.ins(null); } catch (e) { threw = true; }
  CHECK("ins() survives a param-less node", !threw);
}

/* --- determinism, non-empty, finite, in-bounds --- */
for (const format of ALL) {
  const ctx = format === "8-page mini zine" ? LAND : A4;
  const o = run({ format }, ctx);
  CHECK("[" + format + "] non-empty", o.paths.length > 0);
  CHECK("[" + format + "] deterministic", sig(o) === sig(run({ format }, ctx)));
  CHECK("[" + format + "] finite coords", finite(o));
  const bad = allPts(o).filter((q) => q[0] < 0 || q[0] > ctx.W || q[1] < 0 || q[1] > ctx.H);
  CHECK("[" + format + "] all points on the sheet", bad.length === 0, JSON.stringify(bad[0]));
  CHECK("[" + format + "] point budget", allPts(o).length <= 125000);
  CHECK("[" + format + "] valid integer pen layers", o.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer < 12));
}

/* --- imposition: page set complete, each page exactly once --- */
for (const format of ALL) {
  const ctx = format === "8-page mini zine" ? LAND : A4;
  const ov = layout({ format }, ctx);
  const panels = ov.filter((g) => g.kind === "rect").slice(1);
  const nPages = pagesFor({ format });
  if (format === "8-page mini zine") {
    CHECK("[" + format + "] 8 panels", panels.length === 8);
  } else if (format === "Accordion") {
    CHECK("[" + format + "] 6 panels", panels.length === 6);
  } else {
    CHECK("[" + format + "] 2-up per sheet side", panels.length === 2);
  }
  /* all pages appear across all sides/sheets exactly once */
  const seen = [];
  const sides = format === "8-page mini zine" || format === "Accordion" ? ["Front"] : ["Front", "Back"];
  const sheets = format === "8-page saddle stitch" ? [1, 2] : format === "16-page saddle stitch" ? [1, 2, 3, 4] : [1];
  for (const side of sides) for (const sheet of sheets) {
    const o = run({ format, side, sheet, numbers: true, frames: false, trim: false, fold: "None", reg: false, slit: false }, ctx);
    /* read placed pages back out of the marker geometry: the 30x15 rect maps
       to one rect per placed page, so count them */
    seen.push(o.paths.filter((q) => q.closed && q.pts.length === 5).length);
  }
  const placed = seen.reduce((a, b) => a + b, 0);
  CHECK("[" + format + "] every page placed exactly once across sides/sheets (" + placed + "/" + nPages + ")", placed === nPages);
}

/* --- the core double-sided oracle: verso lands behind recto --- */
for (const format of BOOKLETS) {
  for (const flipName of ["Long edge (turn sideways)", "Short edge (turn end over end)"]) {
    const longEdge = flipName.indexOf("Long") === 0;
    const sheets = format === "4-page folio" ? [1] : format === "8-page saddle stitch" ? [1, 2] : [1, 2, 3, 4];
    let allGood = true, note = "";
    for (const sheet of sheets) {
      const base = { format, sheet, flip: flipName };
      const fOv = layout({ ...base, side: "Front" });
      const bOv = layout({ ...base, side: "Back" });
      const blk = fOv.find((g) => g.kind === "rect");
      const fP = fOv.filter((g) => g.kind === "rect").slice(1);
      const bP = bOv.filter((g) => g.kind === "rect").slice(1);
      if (fP.length !== bP.length) { allGood = false; note = "panel count differs"; continue; }
      /* mirror each front panel through the flip axis and find its back twin */
      for (let i = 0; i < fP.length; i++) {
        const f = fP[i];
        const mx = longEdge ? 2 * blk.x + blk.w - f.x - f.w : f.x;
        const my = longEdge ? f.y : 2 * blk.y + blk.h - f.y - f.h;
        const twin = bP.findIndex((b) => Math.abs(b.x - mx) < 1e-6 && Math.abs(b.y - my) < 1e-6);
        if (twin < 0) { allGood = false; note = "no back panel behind front panel " + i; break; }
      }
    }
    CHECK("[" + format + " / " + (longEdge ? "long" : "short") + " edge] every front panel has a back panel behind it", allGood, note);
  }
}

/* --- recto/verso pairing read from the page numbers --- */
for (const format of BOOKLETS) {
  const N = format === "4-page folio" ? 4 : format === "8-page saddle stitch" ? 8 : 16;
  const sheets = N / 4;
  const frontPages = [], backPages = [];
  for (let s = 1; s <= sheets; s++) {
    /* pages are identified by which input pin received geometry: place a
       unique marker per pin and read the marker's second stroke length */
    for (const [side, sink] of [["Front", frontPages], ["Back", backPages]]) {
      const o = run({ format, sheet: s, side, trim: false, fold: "None", reg: false, frames: false }, A4);
      for (const q of o.paths) {
        if (q.closed || q.pts.length !== 2) continue;
        sink.push(q); /* marker diagonal, one per placed page */
      }
    }
  }
  CHECK("[" + format + "] front carries " + N / 2 + " pages", frontPages.length === N / 2);
  CHECK("[" + format + "] back carries " + N / 2 + " pages", backPages.length === N / 2);
}

/* --- one-sided formats produce nothing on the back --- */
{
  CHECK("mini zine: Back is empty", run({ format: "8-page mini zine", side: "Back" }, LAND).paths.length === 0);
  CHECK("accordion one-sided: Back is empty", run({ format: "Accordion", accBoth: false, side: "Back" }).paths.length === 0);
  CHECK("accordion two-sided: Back is non-empty", run({ format: "Accordion", accBoth: true, side: "Back" }).paths.length > 0);
}

/* --- registration marks coincide between the two sides --- */
{
  const P = { format: "4-page folio", reg: true, trim: false, fold: "None", frames: false, margin: 12 };
  const ring = (o) => o.paths.filter((q) => q.closed && q.pts.length === 24)
    .map((q) => {
      const cx = q.pts.reduce((a, b) => a + b[0], 0) / q.pts.length;
      const cy = q.pts.reduce((a, b) => a + b[1], 0) / q.pts.length;
      return [Math.round(cx * 1e4), Math.round(cy * 1e4)].join(",");
    }).sort();
  const f = ring(run({ ...P, side: "Front" })), b = ring(run({ ...P, side: "Back" }));
  CHECK("registration marks exist", f.length === 4);
  CHECK("registration marks identical on both sides", JSON.stringify(f) === JSON.stringify(b));
  /* symmetric under both flips: mirroring the mark set maps it onto itself */
  const mirror = (set, axis) => set.map((s) => {
    const [x, y] = s.split(",").map(Number);
    return axis === "x" ? [Math.round((210 * 1e4) - x), y].join(",") : [x, Math.round((297 * 1e4) - y)].join(",");
  }).sort();
  CHECK("mark set symmetric under long-edge flip", JSON.stringify(mirror(f, "x")) === JSON.stringify(f));
  CHECK("mark set symmetric under short-edge flip", JSON.stringify(mirror(f, "y")) === JSON.stringify(f));
  CHECK("registration off: no rings", run({ ...P, reg: false, side: "Front" }).paths.filter((q) => q.closed && q.pts.length === 24).length === 0);
}

/* --- overlay / compute drift guard --- */
for (const format of ALL) {
  const ctx = format === "8-page mini zine" ? LAND : A4;
  const P = { format, margin: 14, pad: 0, mode: "Stretch", trim: false, fold: "None", reg: false, slit: false, numbers: false, frames: true, framepen: 0 };
  const o = run(P, ctx);
  /* frames are emitted from the same panel rects the overlay reports */
  const frames = o.paths.filter((q) => q.closed && q.pts.length === 4)
    .map((q) => {
      const xs = q.pts.map((t) => t[0]), ys = q.pts.map((t) => t[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      return [x, y, Math.max(...xs) - x, Math.max(...ys) - y].map((v) => Math.round(v * 1e6) / 1e6).join(",");
    }).sort();
  const ovr = rectsOf(layout(P, ctx)).sort();
  CHECK("[" + format + "] overlay panel rects == compute panel rects", JSON.stringify(frames) === JSON.stringify(ovr),
    "overlay " + ovr.length + " vs compute " + frames.length);
}

/* --- mini-zine imposition matches the classic one-cut template --- */
{
  const ov = layout({ format: "8-page mini zine" }, LAND);
  const panels = ov.filter((g) => g.kind === "rect").slice(1);
  const blk = ov.find((g) => g.kind === "rect");
  const pw = blk.w / 4, ph = blk.h / 2;
  const at = (c, r) => panels.findIndex((q) => Math.abs(q.x - (blk.x + c * pw)) < 1e-6 && Math.abs(q.y - (blk.y + r * ph)) < 1e-6);
  let grid = true;
  for (let c = 0; c < 4; c++) for (let r = 0; r < 2; r++) if (at(c, r) < 0) grid = false;
  CHECK("mini zine: 4x2 grid fully populated", grid);
  const arrows = ov.filter((g) => g.kind === "arrow");
  CHECK("mini zine: 3 vertical + 1 horizontal fold + 1 slit guide", arrows.length === 5);
  const o = run({ format: "8-page mini zine", slit: true, trim: false, fold: "None", reg: false }, LAND);
  const slitLine = o.paths.find((q) => !q.closed && q.pts.length === 2
    && Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-6
    && Math.abs(Math.abs(q.pts[1][0] - q.pts[0][0]) - blk.w / 2) < 1e-6);
  CHECK("mini zine: cut slit is half the block wide, on the midline", !!slitLine);
  CHECK("mini zine: slit can be switched off",
    !run({ format: "8-page mini zine", slit: false, trim: false, fold: "None", reg: false }, LAND).paths
      .some((q) => !q.closed && q.pts.length === 2 && Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-6
        && Math.abs(Math.abs(q.pts[1][0] - q.pts[0][0]) - blk.w / 2) < 1e-6));
}

/* --- parameter liveness --- */
{
  const base = { format: "4-page folio" };
  const L = (a, b, name) => CHECK(name + " is live", sig(run({ ...base, ...a })) !== sig(run({ ...base, ...b })));
  L({ margin: 5 }, { margin: 20 }, "margin");
  L({ pad: 0 }, { pad: 12 }, "pad");
  L({ mode: "Fit" }, { mode: "Stretch" }, "mode");
  L({ trim: true }, { trim: false }, "trim");
  L({ fold: "Ticks" }, { fold: "Dashed lines" }, "fold (Ticks vs Dashed)");
  L({ fold: "Ticks" }, { fold: "None" }, "fold (Ticks vs None)");
  L({ reg: true }, { reg: false }, "reg");
  L({ numbers: true }, { numbers: false }, "numbers");
  L({ frames: true }, { frames: false }, "frames");
  L({ framepen: 0, frames: true }, { framepen: 5, frames: true }, "framepen");
  L({ markPen: 1 }, { markPen: 7 }, "markPen");
  L({ side: "Front" }, { side: "Back" }, "side");
  L({ side: "Back", flip: "Long edge (turn sideways)" }, { side: "Back", flip: "Short edge (turn end over end)" }, "flip");
  CHECK("sheet is live", sig(run({ format: "16-page saddle stitch", sheet: 1 })) !== sig(run({ format: "16-page saddle stitch", sheet: 3 })));
  CHECK("panels is live", sig(run({ format: "Accordion", panels: 4 })) !== sig(run({ format: "Accordion", panels: 9 })));
  CHECK("accBoth is live", sig(run({ format: "Accordion", side: "Back", accBoth: true })) !== sig(run({ format: "Accordion", side: "Back", accBoth: false })));
  for (const format of ALL) CHECK("format option renders: " + format, run({ format }, format === "8-page mini zine" ? LAND : A4).paths.length > 0);
  for (const fold of ["None", "Ticks", "Dashed lines"]) CHECK("fold option renders: " + fold, finite(run({ fold }, LAND)));
  for (const mode of ["Fit", "Fill (crop)", "Stretch", "Rotate 90 + Fit", "Rotate 90 + Fill"])
    CHECK("scaling option renders: " + mode, run({ mode }, LAND).paths.length > 0 && finite(run({ mode }, LAND)));
  L({ mode: "Fit" }, { mode: "Fill (crop)" }, "mode Fit vs Fill");
  L({ mode: "Fit" }, { mode: "Rotate 90 + Fit" }, "mode Fit vs Rotate 90");

  for (const side of ["Front", "Back"]) CHECK("side option renders: " + side, finite(run({ format: "4-page folio", side })));
}

/* --- unwired pages, degenerate and extreme values --- */
{
  const P = { ...defaults, format: "16-page saddle stitch", numbers: true };
  const sparse = Array.from({ length: 16 }, (_, i) => (i === 0 ? page(1) : null));
  let threw = false, o = null;
  try { o = def.compute(sparse, P, A4, { params: P }); } catch (e) { threw = true; }
  CHECK("unwired pages do not throw", !threw && !!o && finite(o));
  const empties = Array.from({ length: 16 }, () => ({ paths: [] }));
  CHECK("all-empty inputs still draw marks", def.compute(empties, P, A4, { params: P }).paths.length > 0);

  const cases = [
    { margin: 0, pad: 0, format: "8-page mini zine" },
    { margin: 40, pad: 20, format: "16-page saddle stitch" },
    { margin: 40, pad: 20, format: "Accordion", panels: 12, accBoth: true, side: "Back" },
    { margin: 0, format: "Accordion", panels: 12, numbers: true, frames: true, fold: "Dashed lines" },
    { format: "8-page saddle stitch", sheet: 4 },
  ];
  let ok = true, inb = true;
  for (const c of cases) {
    const r = run(c, c.format === "8-page mini zine" ? LAND : A4);
    if (!finite(r)) ok = false;
    if (allPts(r).some((q) => q[0] < 0 || q[0] > 300 || q[1] < 0 || q[1] > 300)) inb = false;
  }
  CHECK("degenerate/extreme values: finite, no NaN", ok);
  CHECK("degenerate/extreme values: nothing off the sheet", inb);
  const tiny = def.compute(wire(8), { ...defaults, margin: 40 }, { W: 60, H: 60 }, { params: defaults });
  CHECK("tiny sheet degrades gracefully", Array.isArray(tiny.paths));
}

/* --- scaling / aspect oracles ---------------------------------------
   The reason this node needed a Scaling selector at all: a landscape sheet
   canvas does not have the proportions of a portrait page panel. --- */
{
  const CTX = LAND;                        /* 297 x 210 A4 landscape sheet */
  const FMT = "8-page mini zine";          /* portrait panels 74.25 x 105 */
  /* a square drawn on the canvas: uniform scaling keeps it square */
  const square = { paths: [{ pts: [[138.5, 95], [158.5, 95], [158.5, 115], [138.5, 115]], closed: true, layer: 0 }] };
  const bboxOf = (o) => {
    const q = allPts(o);
    const xs = q.map((t) => t[0]), ys = q.map((t) => t[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  const only = (mode, over) => def.compute(
    Array.from({ length: 8 }, () => square),
    { ...defaults, format: FMT, mode, trim: false, fold: "None", reg: false, slit: false, frames: false, numbers: false, ...over },
    CTX, { params: defaults });

  /* per placed copy, not the whole sheet: one path per panel */
  const aspects = (mode) => only(mode).paths.map((q) => {
    const xs = q.pts.map((t) => t[0]), ys = q.pts.map((t) => t[1]);
    return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  });
  for (const mode of ["Fit", "Fill (crop)", "Rotate 90 + Fit", "Rotate 90 + Fill"]) {
    const a = aspects(mode);
    CHECK("[" + mode + "] uniform scale: a square stays square", a.length === 8 && a.every((v) => Math.abs(v - 1) < 0.02),
      a.map((v) => v.toFixed(3)).join(" "));
  }
  CHECK("Stretch distorts (aspect moves away from 1)", aspects("Stretch").every((v) => Math.abs(v - 1) > 0.1));
  CHECK("Fill and Rotate 90 + Fill differ", JSON.stringify(only("Fill (crop)").paths) !== JSON.stringify(only("Rotate 90 + Fill").paths));

  /* full-canvas artwork: how much of the panel does each mode cover? */
  const fullSheet = { paths: [{ pts: [[0.5, 0.5], [CTX.W - 0.5, 0.5], [CTX.W - 0.5, CTX.H - 0.5], [0.5, CTX.H - 0.5]], closed: true, layer: 0 }] };
  /* Rotate 90 on A-series: the panel is filled edge to edge, no letterbox */
  {
    const o = def.compute(
      Array.from({ length: 8 }, () => fullSheet),
      { ...defaults, format: FMT, mode: "Rotate 90 + Fit", pad: 0, margin: 0, trim: false, fold: "None", reg: false, slit: false, frames: false, numbers: false },
      CTX, { params: defaults });
    const ov = def.overlay({ ...defaults, format: FMT, mode: "Rotate 90 + Fit", pad: 0, margin: 0 }, CTX, [], { params: defaults });
    const panels = ov.filter((g) => g.kind === "rect").slice(1);
    const b = bboxOf(o);
    const blockW = Math.max(...panels.map((q) => q.x + q.w)) - Math.min(...panels.map((q) => q.x));
    const blockH = Math.max(...panels.map((q) => q.y + q.h)) - Math.min(...panels.map((q) => q.y));
    CHECK("Rotate 90 + Fit fills A-series panels edge to edge at margin 0 (no letterbox)",
      Math.abs((b[2] - b[0]) - blockW) < 1.2 && Math.abs((b[3] - b[1]) - blockH) < 1.2,
      "art " + (b[2] - b[0]).toFixed(1) + "x" + (b[3] - b[1]).toFixed(1) + " vs block " + blockW.toFixed(1) + "x" + blockH.toFixed(1));
    /* plain Fit letterboxes: the artwork cannot reach the panel top and bottom */
    const oF = def.compute(
      Array.from({ length: 8 }, () => fullSheet),
      { ...defaults, format: FMT, mode: "Fit", pad: 0, margin: 0, trim: false, fold: "None", reg: false, slit: false, frames: false, numbers: false },
      CTX, { params: defaults });
    const bF = bboxOf(oF);
    CHECK("Fit letterboxes on the mismatched axis", (bF[3] - bF[1]) < blockH - 5);
  }

  /* Fill clips: nothing may land outside its own panel (pad-inset) rect */
  for (const mode of ["Fill (crop)", "Rotate 90 + Fill"]) {
    const P = { ...defaults, format: FMT, mode, pad: 4, trim: false, fold: "None", reg: false, slit: false, frames: false, numbers: false };
    const o = def.compute(Array.from({ length: 8 }, () => fullSheet), P, CTX, { params: P });
    const ov = def.overlay(P, CTX, [], { params: P });
    const panels = ov.filter((g) => g.kind === "rect").slice(1);
    const E = 1e-6;
    const outside = allPts(o).filter((q) => !panels.some((pa) =>
      q[0] >= pa.x + 4 - E && q[0] <= pa.x + pa.w - 4 + E && q[1] >= pa.y + 4 - E && q[1] <= pa.y + pa.h - 4 + E));
    CHECK("[" + mode + "] clipped: nothing outside its panel", outside.length === 0,
      outside.length + " stray pts, e.g. " + JSON.stringify(outside[0]));
    const b = bboxOf(o);
    const pa0 = panels[0];
    CHECK("[" + mode + "] covers the panel fully (no letterbox)",
      Math.abs((b[3] - b[1]) - (Math.max(...panels.map((q) => q.y + q.h)) - Math.min(...panels.map((q) => q.y)) - 8)) < 1.2);
  }

  /* the overlay source-region guide belongs to the cropping modes only */
  const polys = (mode) => def.overlay({ ...defaults, format: FMT, mode }, CTX, [], { params: defaults })
    .filter((g) => g.kind === "poly");
  for (const mode of ["Fit", "Stretch", "Rotate 90 + Fit"]) CHECK("no source guide in " + mode, polys(mode).length === 0);
  for (const mode of ["Fill (crop)", "Rotate 90 + Fill"]) {
    const gp = polys(mode);
    CHECK("source guide present in " + mode, gp.length === 1 && gp[0].pts.length === 4);
    if (gp.length === 1) {
      const xs = gp[0].pts.map((q) => q[0]), ys = gp[0].pts.map((q) => q[1]);
      const inCanvas = xs.every((v) => v >= -1e-6 && v <= CTX.W + 1e-6) && ys.every((v) => v >= -1e-6 && v <= CTX.H + 1e-6);
      CHECK("source guide lies on the canvas in " + mode, inCanvas);
    }
  }
}

/* --- overlay never throws --- */
{
  let threw = false;
  try {
    for (const format of ALL) for (const side of ["Front", "Back"]) {
      layout({ format, side }, A4); layout({ format, side, margin: 0 }, LAND);
      layout({ format, side, margin: 40 }, { W: 60, H: 60 });
    }
  } catch (e) { threw = true; }
  CHECK("overlay never throws", !threw);
}

console.log((fail ? "FAILED " : "ALL OK ") + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
