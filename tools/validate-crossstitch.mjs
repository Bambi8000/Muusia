/* Validator for the Cross Stitch node. Run from the repo root: node tools/validate-crossstitch.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "crossstitch";

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
const runAll = (p, ctx) => def.compute([undefined], p, ctx || CTX, {});
const holes = (p, ctx) => runAll(p, ctx)[0];
const guide = (p, ctx) => runAll(p, ctx)[1];
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
const inb = (r, W, Hh, m, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - tol && x <= W - m + tol && y >= m - tol && y <= Hh - m + tol));
const cbox = (r) => { const cs = r.paths.map((q) => centre(q)); const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
const centre = (q) => [q.pts.reduce((a, pt) => a + pt[0], 0) / q.pts.length, q.pts.reduce((a, pt) => a + pt[1], 0) / q.pts.length];
const p0 = defaults();

/* --- definition shape --- */
ok(def.cat === "gen" && def.group === "textimg", "definition: gen/textimg");
ok(typeof def.desc === "string" && def.desc.length > 200, "definition: desc present");
ok(def.ins.length === 1 && def.ins[0].type === "style", "pins: Style input");
ok(def.outs.length === 2 && def.outs[0].label === "Holes" && def.outs[1].label === "Stitches", "pins: Holes + Stitches outputs");
ok(def.params.every((q) => /^[a-z][a-z0-9]*$/i.test(q.key)) && new Set(def.params.map((q) => q.key)).size === def.params.length, "params: unique keys");
ok(def.params.filter((q) => q.type === "pen").length === 2 && def.params.some((q) => q.type === "text"), "params: text and two pens (holes, guide)");

/* --- universal invariants --- */
const a1 = runAll(p0), a2 = runAll(p0);
ok(JSON.stringify(a1) === JSON.stringify(a2), "deterministic (double run byte-identical)");
ok(a1[0].paths.length > 0 && a1[1].paths.length > 0, "non-empty at defaults (" + a1[0].paths.length + " holes, " + a1[1].paths.length + " guide lines)");
ok(finiteAll(a1[0]) && finiteAll(a1[1]), "all coordinates finite");
ok(a1[0].paths.every((q) => q.closed && q.pts.length === 8), "every hole is a closed 8-point circle");
ok(a1[1].paths.every((q) => !q.closed && q.pts.length === 2), "every guide stitch is an open 2-point line");
ok(a1[0].paths.every((q) => q.layer === p0.layer) && a1[1].paths.every((q) => q.layer === p0.glayer), "holes on Holes pen, guide on Guide pen");
ok(inb(a1[0], 297, 210, p0.margin, 1.0) && inb(a1[1], 297, 210, p0.margin, 1.0), "in bounds inside margin on A4 wide");
const tall = runAll(p0, { W: 210, H: 297 });
ok(inb(tall[0], 210, 297, p0.margin, 1.0) && inb(tall[1], 210, 297, p0.margin, 1.0), "in bounds on A4 tall");

/* --- stitch geometry --- */
{
  const one = { ...p0, text: ".", font: "Tiny 3x5" };      /* the Tiny full stop is exactly one stitch */
  const [h, g] = runAll(one);
  ok(h.paths.length === 4, "one stitch = four holes (" + h.paths.length + ")");
  ok(g.paths.length === 2, "Cross guide = two diagonals per stitch (" + g.paths.length + ")");
  const cs = h.paths.map(centre);
  const xs = [...new Set(cs.map((c) => c[0].toFixed(3)))].map(Number).sort((a, b) => a - b), ys = [...new Set(cs.map((c) => c[1].toFixed(3)))].map(Number).sort((a, b) => a - b);
  ok(xs.length === 2 && ys.length === 2 && Math.abs(xs[1] - xs[0] - p0.pitch) < 1e-6 && Math.abs(ys[1] - ys[0] - p0.pitch) < 1e-6, "holes sit exactly one Pitch apart (" + (xs[1] - xs[0]).toFixed(3) + " mm)");
  const r = Math.hypot(h.paths[0].pts[0][0] - cs[0][0], h.paths[0].pts[0][1] - cs[0][1]);
  ok(Math.abs(r - p0.hole / 2) < 1e-6, "hole circle radius is half of Hole size (" + r.toFixed(3) + ")");
  ok(guide({ ...one, stitch: "Half /" }).paths.length === 1 && guide({ ...one, stitch: "Half \\" }).paths.length === 1, "half stitches draw one diagonal");
  const sl = guide({ ...one, stitch: "Half /" }).paths[0].pts;
  ok((sl[0][1] > sl[1][1]) === (sl[0][0] < sl[1][0]), "Half / rises to the right on the sheet");
  ok(guide({ ...one, stitch: "Backstitch" }).paths.length === 4, "Backstitch round one stitch is four edges");
  ok(guide({ ...one, stitch: "None" }).paths.length === 0 && holes({ ...one, stitch: "None" }).paths.length === 4, "Stitch guide None keeps the holes, drops the guide");
  const dash = holes({ ...p0, text: "-" });          /* 5 stitches in a row */
  ok(dash.paths.length === 12, "five stitches in a row share corners: 12 holes, not 20 (" + dash.paths.length + ")");
  const bs = guide({ ...p0, text: "-", stitch: "Backstitch" });
  ok(bs.paths.length === 12, "Backstitch round a 5-stitch bar is 12 edges (" + bs.paths.length + ")");
  const hole2 = holes({ ...p0, text: ".", hole: 2 });
  const r2 = Math.hypot(hole2.paths[0].pts[0][0] - centre(hole2.paths[0])[0], hole2.paths[0].pts[0][1] - centre(hole2.paths[0])[1]);
  ok(Math.abs(r2 - 1) < 1e-6, "Hole size 2 gives radius 1");
  const tight = holes({ ...p0, text: ".", pitch: 1.5, hole: 3 });
  const r3 = Math.hypot(tight.paths[0].pts[0][0] - centre(tight.paths[0])[0], tight.paths[0].pts[0][1] - centre(tight.paths[0])[1]);
  ok(r3 <= 1.5 * 0.45 + 1e-9, "hole radius is capped below half the pitch so holes never merge (" + r3.toFixed(3) + ")");
}

/* --- fonts --- */
for (const f of def.params.find((q) => q.key === "font").options) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ÄÖÅ.-!?:";
  let missing = [];
  for (const ch of chars) { const h = holes({ ...p0, font: f, text: ch, pitch: 2 }); if (h.paths.length < 4 || !finiteAll(h)) missing.push(ch); }
  ok(missing.length === 0, "font '" + f + "' renders every letter, digit and Nordic vowel" + (missing.length ? " — missing " + missing.join("") : ""));
}
{
  const s = holes({ ...p0, text: "E", font: "Sampler 5x7" }), b = holes({ ...p0, text: "E", font: "Bold 5x7" }), t = holes({ ...p0, text: "E", font: "Tiny 3x5" });
  ok(b.paths.length > s.paths.length && s.paths.length > t.paths.length, "Bold has more holes than Sampler, Sampler more than Tiny (" + b.paths.length + " > " + s.paths.length + " > " + t.paths.length + ")");
  ok(cbox(s).h > cbox(t).h && Math.abs(cbox(s).h - 7 * p0.pitch) < 1e-6 && Math.abs(cbox(t).h - 5 * p0.pitch) < 1e-6, "Sampler is 7 rows tall, Tiny 5, at exact pitch (hole centres)");
  ok(holes({ ...p0, text: "<3" }).paths.length > 20, "<3 is the heart glyph");
  ok(holes({ ...p0, text: "muusia" }).paths.length === holes({ ...p0, text: "MUUSIA" }).paths.length, "input is upper-cased");
}

/* --- layout --- */
{
  const one = holes({ ...p0, text: "I" }), two = holes({ ...p0, text: "I I" });
  ok(bbox(two).w > bbox(one).w + 2 * p0.pitch, "a space advances the grid");
  const g0 = bbox(holes({ ...p0, text: "II", gap: 0 })), g3 = bbox(holes({ ...p0, text: "II", gap: 3 }));
  ok(Math.abs((g3.w - g0.w) - 3 * p0.pitch) < 1e-6, "Letter gap adds whole cells (" + ((g3.w - g0.w) / p0.pitch).toFixed(2) + " cells)");
  const l0 = bbox(holes({ ...p0, text: "I|I", linegap: 0 })), l4 = bbox(holes({ ...p0, text: "I|I", linegap: 4 }));
  ok(Math.abs((l4.h - l0.h) - 4 * p0.pitch) < 1e-6, "Line gap adds whole cells");
  const nb = holes({ ...p0, text: "I" }), wb = holes({ ...p0, text: "I", border: true });
  ok(wb.paths.length > nb.paths.length + 40 && bbox(wb).w > bbox(nb).w + 4 * p0.pitch, "Border frames the block with a stitch row and a gap (" + nb.paths.length + " -> " + wb.paths.length + " holes)");
  const L = cbox(holes({ ...p0, text: "I|MMM", align: "Left" })), R = cbox(holes({ ...p0, text: "I|MMM", align: "Right" })), C = cbox(holes({ ...p0, text: "I|MMM", align: "Center" }));
  const topRow = (p) => { const h = holes({ ...p0, text: "I|MMM", align: p }); const ys = h.paths.map(centre); const minY = Math.min(...ys.map((c) => c[1])); const xs = ys.filter((c) => Math.abs(c[1] - minY) < 1e-6).map((c) => c[0]); return [Math.min(...xs), Math.max(...xs)]; };
  const tl = topRow("Left"), tr = topRow("Right"), tc = topRow("Center");
  ok(Math.abs(tl[0] - L.x0) < 1e-6 && Math.abs(tr[1] - R.x1) < 1e-6 && tc[0] > C.x0 && tc[1] < C.x1, "Align moves the short line to the left edge, right edge, or centre");
  const y0 = bbox(holes(p0)), y40 = bbox(holes({ ...p0, yoff: -40 }));
  ok(Math.abs((y0.y0 - y40.y0) - 40) < 1e-6, "Y offset moves the block exactly");
  const m = holes({ ...p0, text: "F" }), mm = holes({ ...p0, text: "F", mirror: true });
  const cx = (bbox(m).x0 + bbox(m).x1) / 2;
  const set = new Set(m.paths.map(centre).map((c) => (2 * cx - c[0]).toFixed(3) + "," + c[1].toFixed(3)));
  ok(mm.paths.length === m.paths.length && mm.paths.map(centre).every((c) => set.has(c[0].toFixed(3) + "," + c[1].toFixed(3))), "Mirror flips every hole about the block centre");
  const big = runAll({ ...p0, text: "A LINE FAR TOO LONG FOR THE SHEET AT THIS PITCH", pitch: 8 });
  ok(inb(big[0], 297, 210, p0.margin, 1.0) && bbox(big[0]).w > 250, "shrink only: an over-long line reduces the pitch to fit (" + bbox(big[0]).w.toFixed(0) + " mm wide)");
  const exact = cbox(holes({ ...p0, text: "MUUSIA", pitch: 6 }));
  ok(Math.abs(exact.h - 7 * 6) < 1e-6, "a short line keeps the exact pitch (" + exact.h.toFixed(1) + " = 42)");
}

/* --- every parameter must do something --- */
const J = (p) => JSON.stringify(runAll(p));
const baseJ = J(p0);
const diff = (patch, label, base) => ok(J({ ...(base || p0), ...patch }) !== (base ? J(base) : baseJ), "param live: " + label);
diff({ text: "OTHER" }, "text");
diff({ font: "Tiny 3x5" }, "font");
diff({ pitch: 3 }, "pitch");
diff({ hole: 1.2 }, "hole");
diff({ stitch: "Backstitch" }, "stitch");
diff({ gap: 3 }, "gap");
diff({ linegap: 5 }, "linegap", { ...p0, text: "A|B" });
diff({ border: true }, "border");
diff({ bgap: 5 }, "bgap (with border)", { ...p0, border: true });
diff({ align: "Left" }, "align", { ...p0, text: "I|MMM" });
diff({ yoff: 30 }, "yoff");
diff({ mirror: true }, "mirror");
diff({ margin: 40 }, "margin (with an over-long line)", { ...p0, text: "A LINE FAR TOO LONG FOR THE SHEET AT THIS PITCH", pitch: 8 });
diff({ layer: 3 }, "layer");
diff({ glayer: 4 }, "glayer");

/* --- degenerate --- */
{
  const e = runAll({ ...p0, text: "" });
  ok(e[0].paths.length === 0 && e[1].paths.length === 0, "empty text gives two empty outputs");
  ok(runAll({ ...p0, text: "§¤{}" })[0].paths.length === 0, "unknown characters only give empty output, no throw");
  ok(finiteAll(runAll({ ...p0, text: "|||" })[0]), "empty lines do not throw");
  ok(finiteAll(runAll({ ...p0, text: "MUUSIA", pitch: 0, hole: 0, gap: -3, linegap: -2, margin: -5, bgap: 0, border: true })[0]), "degenerate params produce no NaN");
  ok(finiteAll(runAll(p0, { W: 30, H: 20 })[0]), "tiny sheet does not throw");
  const ext = runAll({ ...p0, text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ|0123456789ÄÖÅ.,!?|ABCDEFGHIJKLMNOPQRSTUVWXYZ|0123456789ÄÖÅ.,!?", font: "Bold 5x7", border: true, pitch: 12 });
  ok(finiteAll(ext[0]) && finiteAll(ext[1]) && npts(ext[0]) + npts(ext[1]) <= 240000 && inb(ext[0], 297, 210, p0.margin, 1.0), "extreme: four bold lines with border fit and stay finite (" + ext[0].paths.length + " holes)");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis({ ...p0, border: false }).includes("bgap") && vis({ ...p0, border: true }).includes("bgap"), "showIf: Border gap only with Border");
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
