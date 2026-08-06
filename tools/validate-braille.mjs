/* validate-braille.mjs — Braille node invariants + Needle Punch chain test.
   Run from repo root: node tools/validate-braille.mjs
   Auto-switches lab -> baked; lab evaluation uses the REAL src/defs/helpers.js. */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import("file://" + path.join(root, "src/defs/helpers.js"));
const helperNames = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2",
  "resample", "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG",
  "SFONT", "fontStrokes"];
const load = async (name) => {
  const baked = path.join(root, "src/defs/nodes/" + name + ".js");
  if (fs.existsSync(baked)) {
    console.log("Testing BAKED:", name);
    return (await import("file://" + baked)).default;
  }
  console.log("Testing LAB:", name);
  const src = fs.readFileSync(path.join(root, "nodes-lab/" + name + ".plotternode.js"), "utf8");
  return new Function(...helperNames, '"use strict"; return (' + src + ");")(
    ...helperNames.map((k) => H[k]));
};
const N = await load("braille");
const NP = await load("needlepunch");

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? "  PASS " : "  FAIL ") + msg);
  if (!cond) { fails++; process.exitCode = 1; }
};
const defaults = (D) => {
  const p = {};
  for (const pr of D.params) p[pr.key] = pr.def;
  return p;
};
const ctx = { W: 210, H: 297 };
const run = (over = {}) => N.compute([undefined], { ...defaults(N), tx: 20, ty: 30, ...over }, ctx, {});
const centers = (r) => r.paths.map((pa) => {
  let sx = 0, sy = 0;
  for (const q of pa.pts) { sx += q[0]; sy += q[1]; }
  return [sx / pa.pts.length, sy / pa.pts.length];
});
const near = (a, b, tol = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
const hasDot = (C, x, y) => C.some((c) => near(c, [x, y], 1e-6));

console.log("\n[1] Structure: dots are closed 8-pt circles, finite, pen honored");
{
  const r = run({ text: "abc", layer: 5 });
  ok(r.paths.length > 0, "produces dots");
  ok(r.paths.every((pa) => pa.closed === true && pa.pts.length === 8), "closed 8-pt polygons");
  ok(r.paths.every((pa) => pa.layer === 5), "layer follows Pen");
  ok(r.paths.every((pa) => pa.pts.every((q) => q.every(Number.isFinite))), "all coords finite");
}

console.log("\n[2] Determinism");
{
  const a = JSON.stringify(run({ text: "Muusia 123 \u00e4\u00f6\u00e5" }));
  ok(a === JSON.stringify(run({ text: "Muusia 123 \u00e4\u00f6\u00e5" })), "double run identical");
}

console.log("\n[3] Letter geometry: 'a' = dot 1 at cell origin; 'l' = column 1,2,3");
{
  const C = centers(run({ text: "a", caps: false }));
  ok(C.length === 1 && near(C[0], [20, 30], 1e-6), `'a' -> one dot at (20,30) (got ${C.length})`);
  const Cl = centers(run({ text: "l", caps: false }));
  ok(Cl.length === 3, "'l' -> 3 dots");
  ok(hasDot(Cl, 20, 30) && hasDot(Cl, 20, 32.5) && hasDot(Cl, 20, 35), "at rows 0/2.5/5 in column 0");
  const Cw = centers(run({ text: "w", caps: false }));
  ok(Cw.length === 4 && hasDot(Cw, 20 + 2.5, 30) && hasDot(Cw, 20 + 2.5, 35), "'w' (2456) uses column 1");
}

console.log("\n[4] Cell / line advance: 6 mm and 10 mm at Scale 1");
{
  const C = centers(run({ text: "aa", caps: false }));
  ok(C.length === 2 && hasDot(C, 26, 30), "second cell at tx+6");
  const C2 = centers(run({ text: "a|a", caps: false }));
  ok(C2.length === 2 && hasDot(C2, 20, 40), "second line at ty+10");
  const C3 = centers(run({ text: "a a", caps: false }));
  ok(C3.length === 2 && hasDot(C3, 32, 30), "space advances one cell (third cell at tx+12)");
}

console.log("\n[5] Scale: doubles every pitch");
{
  const C = centers(run({ text: "aa|a", caps: false, scale: 2 }));
  ok(hasDot(C, 32, 30) && hasDot(C, 20, 50), "cell 12 mm, line 20 mm at Scale 2");
}

console.log("\n[6] Number sign: once per digit run");
{
  const c1 = centers(run({ text: "1", caps: false }));
  ok(c1.length === 5, `'1' = numsign(4) + a(1) = 5 dots (got ${c1.length})`);
  const c12 = centers(run({ text: "12", caps: false }));
  ok(c12.length === 7, `'12' = 4+1+2 = 7 dots, sign once (got ${c12.length})`);
  const c1a1 = centers(run({ text: "1a1", caps: false }));
  ok(c1a1.length === 4 + 1 + 1 + 4 + 1, `letter breaks the run -> sign again (got ${c1a1.length})`);
  ok(hasDot(c1, 26, 30), "digit 'a'-cell sits in slot 2");
}

console.log("\n[7] Capital sign: dot 6 cell, toggleable");
{
  const on = centers(run({ text: "A", caps: true }));
  ok(on.length === 2, `caps on: sign + a = 2 dots (got ${on.length})`);
  ok(hasDot(on, 22.5, 35), "capital sign = dot 6 (col 1, row 2) in cell 1");
  ok(hasDot(on, 26, 30), "'a' shifted to cell 2");
  const off = centers(run({ text: "A", caps: false }));
  ok(off.length === 1 && hasDot(off, 20, 30), "caps off: bare 'a' in cell 1");
}

console.log("\n[8] Nordic letters + unknown chars skipped");
{
  ok(centers(run({ text: "\u00e4", caps: false })).length === 3, "\u00e4 (345) -> 3 dots");
  ok(centers(run({ text: "\u00f6", caps: false })).length === 3, "\u00f6 (246) -> 3 dots");
  ok(centers(run({ text: "\u00e5", caps: false })).length === 2, "\u00e5 (16) -> 2 dots");
  const a = JSON.stringify(run({ text: "a\u20acb", caps: false }));
  const b = JSON.stringify(run({ text: "ab", caps: false }));
  ok(a === b, "unknown char skipped without a gap");
}

console.log("\n[9] Mirror: whole-block reflection around the CELL GRID (not ink bbox)");
{
  const plain = centers(run({ text: "ab|c", caps: false })).map(([x, y]) => [x, y]);
  const mir = centers(run({ text: "ab|c", caps: false, mirror: true }));
  /* grid extent for 'ab' (widest line, 2 cells): columns 0 .. (blockW-cellAdv)+pitch
     = 0..8.5 block-local -> reflection x' = 2*tx + 8.5 - x */
  const axis = 2 * 20 + (2 * 6 - 6) + 2.5;
  ok(plain.length === mir.length, "same dot count");
  ok(plain.every((q) => mir.some((m) => near(m, [axis - q[0], q[1]], 1e-6))), "every dot reflected around the grid axis");
  ok(mir.every((m) => plain.some((q) => near(q, [axis - m[0], m[1]], 1e-6))), "reflection is a bijection");
  ok(JSON.stringify(plain) !== JSON.stringify(mir), "mirror is live");
}

console.log("\n[10] Dot size: circle radius follows param, capped below pitch");
{
  const r1 = run({ text: "a", caps: false, dotR: 0.8 });
  const dx = Math.max(...r1.paths[0].pts.map((q) => q[0])) - Math.min(...r1.paths[0].pts.map((q) => q[0]));
  ok(Math.abs(dx - 1.6) < 1e-9, `diameter 1.6 at dotR 0.8 (got ${dx.toFixed(3)})`);
  const r2 = run({ text: "a", caps: false, dotR: 5 });
  const dx2 = Math.max(...r2.paths[0].pts.map((q) => q[0])) - Math.min(...r2.paths[0].pts.map((q) => q[0]));
  ok(dx2 < 2.5, `wire-pushed dotR 5 capped under pitch (diameter ${dx2.toFixed(3)})`);
}

console.log("\n[11] Overlay: letters as poly guides, toggle kills it, never throws");
{
  const p = { ...defaults(N), text: "abc", tx: 20, ty: 30 };
  const g = N.overlay(p, ctx);
  ok(Array.isArray(g) && g.length > 1, `guides present (${g.length})`);
  ok(g[0].kind === "rect", "block rect first");
  ok(g.some((x) => x.kind === "poly" && x.pts.every((q) => q.every(Number.isFinite))), "letter polys finite");
  ok(N.overlay({ ...p, guides: false }, ctx).length === 0, "Show letters off -> no guides");
  let threw = false;
  try { N.overlay({ text: null, scale: NaN, guides: true }, ctx); } catch (e) { threw = true; }
  ok(!threw, "garbage params do not throw");
  const gm = N.overlay({ ...p, mirror: true }, ctx);
  ok(gm.length === g.length, "mirrored overlay has same guide count");
}

console.log("\n[12] Budget: a paragraph stays well under 120k points");
{
  const long = ("pakkaa yl\u00e4peilit taskuun 1234567890 ").repeat(8) + "|" + ("mind the braille standard ").repeat(8);
  const r = run({ text: long });
  const pts = r.paths.reduce((a, pa) => a + pa.pts.length, 0);
  ok(pts < 120000, `${r.paths.length} dots = ${pts} pts`);
}

console.log("\n[13] CHAIN: Braille -> Needle Punch (Centers) pierces every dot exactly");
{
  const br = run({ text: "Muusia 42|\u00e4\u00e4ni", ty: 30 });
  const pnp = { ...defaults(NP), mode: "Centers", depth: 2, gap: 0.5 };
  const r = NP.compute([br], pnp, ctx, {});
  ok(r.paths.length === br.paths.length, `punch count = dot count (${r.paths.length} = ${br.paths.length})`);
  const dotC = centers(br);
  ok(r.paths.every((pa) => dotC.some((c) => near(c, [pa.pts[0][0], pa.pts[0][1]], 1e-9))), "every punch at an exact dot center");
  ok(r.paths.every((pa) => pa.pts.length === 2 && pa.pts[0][2] === 2), "punches carry z = depth");
}

console.log("\n[14] Finnish punctuation (fi.wikipedia table): exact dot positions");
{
  const dots = (t) => centers(run({ text: t, caps: false }));
  const cell = (C, list) => C.length === list.length && list.every(([c, r]) => hasDot(C, 20 + c * 2.5, 30 + r * 2.5));
  ok(cell(dots("."), [[0, 2]]), "piste = 3 (NOT UEB 256)");
  ok(cell(dots("!"), [[0, 1], [1, 1], [1, 2]]), "huutomerkki = 256 (NOT UEB 235)");
  ok(cell(dots(","), [[0, 1]]), "pilkku = 2");
  ok(cell(dots(";"), [[0, 1], [0, 2]]), "puolipiste = 23");
  ok(cell(dots("?"), [[0, 1], [1, 2]]), "kysymysmerkki = 26");
  ok(cell(dots("-"), [[0, 2], [1, 2]]), "viiva = 36");
  ok(cell(dots("+"), [[0, 1], [0, 2], [1, 1]]), "plusmerkki = 235");
  ok(cell(dots("("), [[0, 1], [0, 2], [1, 2]]), "sulkumerkki alku = 236");
  ok(cell(dots(")"), [[0, 2], [1, 1], [1, 2]]), "sulkumerkki loppu = 356");
  ok(cell(dots("="), [[0, 1], [0, 2], [1, 1], [1, 2]]), "yhtasuuruus = 2356");
  const a = JSON.stringify(run({ text: "a'b", caps: false }));
  ok(a === JSON.stringify(run({ text: "ab", caps: false })), "apostrophe removed (would collide with piste 3)");
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS");
