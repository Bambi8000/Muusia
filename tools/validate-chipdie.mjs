/* Validator for the Chip Die node. Run from the repo root: node tools/validate-chipdie.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "chipdie";

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
const run = (p, ctx) => runAll(p, ctx)[0];
const blocks = (p, ctx) => runAll(p, ctx)[1];
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
const inb = (r, W, Hh, m, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - tol && x <= W - m + tol && y >= m - tol && y <= Hh - m + tol));
const p0 = defaults();
const STYLES = def.params.find((q) => q.key === "style").options;

/* --- definition shape --- */
ok(def.cat === "gen" && def.group === "structural", "definition: gen/structural");
ok(typeof def.desc === "string" && def.desc.length > 200, "definition: desc present");
ok(def.ins.length === 1 && def.ins[0].type === "style", "pins: Style input");
ok(def.outs.length === 2 && def.outs[0].label === "Lines" && def.outs[1].label === "Blocks", "pins: Lines + Blocks outputs");
ok(def.params.every((q) => /^[a-z][a-z0-9]*$/i.test(q.key)) && new Set(def.params.map((q) => q.key)).size === def.params.length, "params: unique keys");
ok(def.params.some((q) => q.type === "seed") && def.params.some((q) => q.type === "pen"), "params: seed and pen present");

/* --- universal invariants --- */
const a1 = runAll(p0), a2 = runAll(p0);
ok(JSON.stringify(a1) === JSON.stringify(a2), "deterministic (double run byte-identical)");
ok(a1[0].paths.length > 500 && a1[1].paths.length > 3, "non-empty at defaults (" + a1[0].paths.length + " lines, " + a1[1].paths.length + " blocks)");
ok(finiteAll(a1[0]) && finiteAll(a1[1]), "all coordinates finite");
ok(a1[0].paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(a1[0].paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(a1[0]) < 120000, "point budget at defaults (" + npts(a1[0]) + ")");
ok(inb(a1[0], 297, 210, p0.margin, 1.0) && inb(a1[1], 297, 210, p0.margin, 1.0), "in bounds inside margin on A4 wide");
const tall = runAll(p0, { W: 210, H: 297 });
ok(inb(tall[0], 210, 297, p0.margin, 1.0), "in bounds on A4 tall");
ok(a1[1].paths.every((q) => q.closed && q.pts.length === 4), "every block is a closed 4-point rectangle");
{
  const db = bbox(a1[0]);
  const blk = bbox(a1[1]);
  ok(blk.x0 > db.x0 + 5 && blk.x1 < db.x1 - 5 && blk.y0 > db.y0 + 5 && blk.y1 < db.y1 - 5, "blocks sit inside the pad ring, inside the die");
  const rectsOnly = a1[0].paths.every((q) => q.pts.every((pt, i, a) => i === 0 || Math.abs(pt[0] - a[i - 1][0]) < 1e-6 || Math.abs(pt[1] - a[i - 1][1]) < 1e-6));
  ok(rectsOnly, "every segment is axis-aligned (Manhattan geometry, like a real layout)");
}

/* --- die size and shape --- */
{
  const d = bbox(run({ ...p0, size: 100, aspect: 1 }));
  ok(Math.abs(d.w - 100) < 1e-6 && Math.abs(d.h - 100) < 1e-6, "Die width 100 aspect 1 is exactly 100 x 100 mm (" + d.w.toFixed(2) + " x " + d.h.toFixed(2) + ")");
  const t = bbox(run({ ...p0, size: 100, aspect: 1.6 }));
  ok(Math.abs(t.h - 160) < 1e-6 && Math.abs(t.w - 100) < 1e-6, "Aspect 1.6 makes it 100 x 160");
  const big = bbox(run({ ...p0, size: 280, aspect: 1 }));
  ok(Math.abs(big.h - 190) < 1e-6 && Math.abs(big.w - 190) < 1e-6, "shrink only: a 280 mm die is fitted to the 190 mm sheet height (" + big.w.toFixed(1) + ")");
  const c = bbox(run(p0));
  ok(Math.abs((c.x0 + c.x1) / 2 - 148.5) < 1e-6 && Math.abs((c.y0 + c.y1) / 2 - 105) < 1e-6, "die is centred on the sheet");
}

/* --- styles --- */
for (const st of STYLES) {
  const [l, b] = runAll({ ...p0, style: st });
  ok(l.paths.length > 300 && finiteAll(l) && inb(l, 297, 210, p0.margin, 1.0) && b.paths.length >= 4, "style '" + st + "' renders in bounds (" + l.paths.length + " lines, " + b.paths.length + " blocks)");
}
{
  const fp = (n) => blocks({ ...p0, style: "FPGA", cores: n }).paths.length;
  ok(fp(3) === 25 && fp(5) === 49, "FPGA: Cores+2 squared tiles (" + fp(3) + ", " + fp(5) + ")");
  const mem = (n) => blocks({ ...p0, style: "Memory", cores: n }).paths.length;
  ok(mem(2) === 2 * 2 + 2 && mem(6) === 2 * 6 + 2, "Memory: two blocks per bank (array + decoder) plus IO and analog (" + mem(2) + ", " + mem(6) + ")");
  const pr2 = blocks({ ...p0, style: "Processor", cores: 2 }).paths.length, pr6 = blocks({ ...p0, style: "Processor", cores: 6 }).paths.length;
  ok(pr6 > pr2, "Processor: more cores, more blocks (" + pr2 + " -> " + pr6 + ")");
  const m1 = run({ ...p0, style: "Processor", cores: 2, mirror: true }), m0 = run({ ...p0, style: "Processor", cores: 2, mirror: false });
  ok(JSON.stringify(m1) !== JSON.stringify(m0) && m1.paths.length === m0.paths.length, "Mirror cores flips the second core without changing its content (" + m1.paths.length + " paths both)");
  /* mirrored cores: the block set of the second core is the mirror image of the first */
  const bl = blocks({ ...p0, style: "Processor", cores: 2, mirror: true, pads: false, seal: false }).paths;
  const db = bbox(run({ ...p0, style: "Processor", cores: 2, mirror: true, pads: false, seal: false }));
  const cx = (db.x0 + db.x1) / 2;
  const key = (q) => { const b = bbox({ paths: [q] }); return b.w.toFixed(3) + "," + b.h.toFixed(3) + "," + b.y0.toFixed(3); };
  const inBand = (q) => { const b = bbox({ paths: [q] }); return b.y0 > db.y0 + db.h * 0.26 && b.y1 < db.y1 - db.h * 0.125; };   /* the core band only */
  const left = bl.filter((q) => inBand(q) && bbox({ paths: [q] }).x1 <= cx + 1e-6).map(key).sort();
  const right = bl.filter((q) => inBand(q) && bbox({ paths: [q] }).x0 >= cx - 1e-6).map(key).sort();
  ok(left.length > 2 && JSON.stringify(left) === JSON.stringify(right), "the two cores have identical block shapes (" + left.length + " each)");
  const rnd1 = blocks({ ...p0, style: "Random", depth: 1 }).paths.length, rnd6 = blocks({ ...p0, style: "Random", depth: 6 }).paths.length;
  ok(rnd6 > rnd1 && rnd1 >= 2, "Random: Split depth grows the floorplan (" + rnd1 + " -> " + rnd6 + ")");
  const spirals = [1, 2, 3, 4, 5].map((sd) => Math.max(...run({ ...p0, style: "Analog", seed: sd }).paths.map((q) => q.pts.length)));
  ok(spirals.every((n) => n > 30), "Analog always contains a spiral inductor (longest paths " + spirals.join("/") + " pts over five seeds)");
}

/* --- vintage, routing, colours, bond wires --- */
{
  const [vl, vb] = runAll({ ...p0, style: "Vintage" });
  ok(vl.paths.length > 300 && finiteAll(vl) && inb(vl, 297, 210, p0.margin, 1.0) && vb.paths.length >= 3 && vb.paths.length <= 5, "Vintage: one routed die with a few transistor islands (" + vb.paths.length + " blocks)");
  const thick = run({ ...p0, style: "Vintage", trace: 1 }), thin = run({ ...p0, style: "Vintage", trace: 0 });
  ok(thick.paths.filter((q) => q.closed && q.pts.length > 4).length > 50, "Trace width > 0 draws traces as closed rods (" + thick.paths.filter((q) => q.closed && q.pts.length > 4).length + ")");
  ok(thin.paths.filter((q) => !q.closed && q.pts.length >= 2).length > 50 && thin.paths.filter((q) => q.closed && q.pts.length > 4).length < 5, "Trace width 0 draws traces as centre lines");
  /* rods never overlap: every via square is at a distinct grid point */
  const vias = thick.paths.filter((q) => q.closed && q.pts.length === 4 && bbox({ paths: [q] }).w < 3).map((q) => { const b = bbox({ paths: [q] }); return ((b.x0 + b.x1) / 2).toFixed(1) + "," + ((b.y0 + b.y1) / 2).toFixed(1); });
  ok(vias.length > 50 && new Set(vias).size === vias.length, "routing never reuses a grid cell: all " + vias.length + " vias are distinct");
  const mono = run(p0), col = run({ ...p0, colours: true });
  ok(new Set(mono.paths.map((q) => q.layer)).size === 1 && new Set(col.paths.map((q) => q.layer)).size >= 5, "Colour by type spreads Processor over at least five pens (" + new Set(col.paths.map((q) => q.layer)).size + ")");
  ok(col.paths.length === mono.paths.length, "colouring changes pens only, not geometry");
  const colB = blocks({ ...p0, colours: true });
  ok(new Set(colB.paths.map((q) => q.layer)).size >= 3, "block outlines follow their content's pen");
  const wrap = run({ ...p0, colours: true, layer: 10 });
  ok(wrap.paths.every((q) => q.layer >= 0 && q.layer <= 11), "pens wrap modulo 12 from a high Pen");
  const bw = run({ ...p0, style: "Vintage", bondwires: true }), nbw = run({ ...p0, style: "Vintage", bondwires: false });
  ok(bw.paths.length > nbw.paths.length + 20 && inb(bw, 297, 210, p0.margin, 1.0), "Bond wires add arcs outside the die and still inside the margin (" + (bw.paths.length - nbw.paths.length) + " extra paths)");
  ok(bbox(bw).w > bbox(nbw).w + 4 && bbox(blocks({ ...p0, style: "Vintage", bondwires: true, size: 280 })).w < bbox(blocks({ ...p0, style: "Vintage", size: 280 })).w, "a sheet-filling die shrinks to leave room for the wires");
  ok(run({ ...p0, style: "Random", depth: 5, seed: 5 }).paths.length > 0, "Random can place routed blocks");
}

/* --- toggles --- */
{
  const on = run(p0), noBus = run({ ...p0, buses: false }), noPads = run({ ...p0, pads: false }), noSeal = run({ ...p0, seal: false });
  ok(noBus.paths.length < on.paths.length - 50, "Buses off removes the channel traces (" + on.paths.length + " -> " + noBus.paths.length + ")");
  const die = bbox(on);
  const frames = (r) => r.paths.filter((q) => q.closed && q.pts.length === 4 && bbox({ paths: [q] }).x0 < die.x0 + 3 && bbox({ paths: [q] }).w > die.w * 0.9).length;
  ok(frames(on) === 3 && frames(noSeal) === 1, "Seal ring is two frames just inside the die edge (" + frames(on) + " with, " + frames(noSeal) + " without)");
  /* a bond pad is a small square with a concentric inner square, sitting in the band just inside the top edge */
  const pads = (r) => {
    const sq = r.paths.filter((q) => q.closed && q.pts.length === 4).map((q) => bbox({ paths: [q] })).filter((b) => b.w < 8 && b.y0 < die.y0 + 8);
    let n = 0;
    for (const a of sq) for (const b of sq) if (b !== a && b.w < a.w * 0.7 && Math.abs((a.x0 + a.x1) - (b.x0 + b.x1)) < 0.2 && Math.abs((a.y0 + a.y1) - (b.y0 + b.y1)) < 0.2) n++;
    return n;
  };
  ok(pads(on) > 15 && pads(noPads) === 0, "Bond pads are nested squares along the top edge, gone when off (" + pads(on) + " -> " + pads(noPads) + ")");
  ok(bbox(blocks({ ...p0, pads: false })).w > bbox(blocks(p0)).w + 4, "without pads the core area grows outward");
  const lo = run({ ...p0, density: 0 }), hi = run({ ...p0, density: 100 });
  ok(hi.paths.length > lo.paths.length * 1.5, "Density raises the line count (" + lo.paths.length + " -> " + hi.paths.length + ")");
  const busCount = (g) => run({ ...p0, gutter: g, buses: true }).paths.length - run({ ...p0, gutter: g, buses: false }).paths.length;
  ok(busCount(6) > busCount(1) * 1.5, "wider channels carry more bus traces (" + busCount(1) + " -> " + busCount(6) + ")");
}

/* --- every parameter must do something --- */
const J = (p) => JSON.stringify(runAll(p));
const baseJ = J(p0);
const diff = (patch, label, base) => ok(J({ ...(base || p0), ...patch }) !== (base ? J(base) : baseJ), "param live: " + label);
diff({ style: "Memory" }, "style");
diff({ cores: 2 }, "cores");
diff({ depth: 2 }, "depth (Random)", { ...p0, style: "Random" });
diff({ density: 20 }, "density");
diff({ gutter: 1 }, "gutter");
diff({ buses: false }, "buses");
diff({ pads: false }, "pads");
diff({ seal: false }, "seal");
diff({ trace: 0 }, "trace (Vintage)", { ...p0, style: "Vintage" });
diff({ colours: true }, "colours");
diff({ bondwires: true }, "bondwires");
diff({ mirror: false }, "mirror");
diff({ size: 80 }, "size");
diff({ aspect: 1.5 }, "aspect");
diff({ margin: 40 }, "margin (with a sheet-filling die)", { ...p0, size: 280 });
diff({ seed: 99 }, "seed");
diff({ layer: 3 }, "layer");
ok(run({ ...p0, layer: 3 }).paths.every((q) => q.layer === 3) && blocks({ ...p0, layer: 3 }).paths.every((q) => q.layer === 3), "layer applies to every path on both outputs");

/* --- degenerate and extreme --- */
ok(finiteAll(run({ ...p0, size: 0, aspect: 0, density: -5, gutter: 0, cores: 0, depth: 0, margin: 0 })), "degenerate params produce no NaN");
ok(finiteAll(run({ ...p0, size: -50, aspect: 99, density: 500, gutter: 99, cores: 99, depth: 99, margin: -9 })), "out-of-range wired values produce no NaN");
ok(finiteAll(run({ ...p0, margin: 200 })), "margin larger than the sheet does not throw");
ok(finiteAll(run(p0, { W: 30, H: 20 })), "tiny sheet does not throw");
for (const st of STYLES) {
  const t0 = Date.now();
  const ext = run({ ...p0, style: st, size: 280, density: 100, cores: 8, depth: 6, gutter: 8 });
  ok(finiteAll(ext) && npts(ext) <= 120000 && ext.paths.length > 0 && inb(ext, 297, 210, p0.margin, 1.0), "extreme " + st + ": full sheet, density 100, 8 cores — finite, budget, in bounds (" + npts(ext) + " pts, " + (Date.now() - t0) + " ms)");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
  ok(vis({ ...p0, style: "Processor" }).includes("cores") && vis({ ...p0, style: "Processor" }).includes("mirror") && !vis({ ...p0, style: "Processor" }).includes("depth"), "showIf: Processor shows Cores and Mirror, hides Split depth");
  ok(vis({ ...p0, style: "Random" }).includes("depth") && !vis({ ...p0, style: "Random" }).includes("cores") && !vis({ ...p0, style: "Random" }).includes("mirror"), "showIf: Random shows Split depth, hides Cores and Mirror");
  ok(vis({ ...p0, style: "Memory" }).includes("cores") && !vis({ ...p0, style: "Memory" }).includes("mirror"), "showIf: Memory shows banks, no Mirror");
  ok(vis({ ...p0, style: "Vintage" }).includes("trace") && !vis({ ...p0, style: "Processor" }).includes("trace") && !vis({ ...p0, pads: false }).includes("bondwires"), "showIf: Trace width for routed styles, Bond wires only with pads");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 2 && g1.every((g) => g.kind === "rect"), "overlay: margin rect + die rect");
  const d = bbox(run(p0));
  ok(Math.abs(g1[1].x - d.x0) < 1e-6 && Math.abs(g1[1].w - d.w) < 1e-6, "overlay die rect matches the drawn die");
  let threw = false;
  try { def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined); def.overlay({}, {}, null, null); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
} else ok(false, "overlay missing");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
