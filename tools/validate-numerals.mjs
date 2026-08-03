// tools/validate-numerals.mjs — Numerals harness.
// Run from repo root: node tools/validate-numerals.mjs
// Auto-switches to the baked version (src/defs/nodes/numerals.js) when it exists.
import fs from "node:fs";
import * as HELP from "../src/defs/helpers.js";

const BAKED = new URL("../src/defs/nodes/numerals.js", import.meta.url);
const LAB = new URL("../nodes-lab/numerals.plotternode.js", import.meta.url);
let N;
if (fs.existsSync(BAKED)) {
  N = (await import(BAKED)).default;
  console.log("target: BAKED src/defs/nodes/numerals.js");
} else {
  const H = {
    Pin: HELP.Pin, EMPTY: HELP.EMPTY, PENS: HELP.PENS,
    mulberry32: HELP.mulberry32, hash2: HELP.hash2, noise2: HELP.noise2,
    resample: HELP.resample, pathLength: HELP.pathLength,
    applyStyle: HELP.applyStyle, signedArea: HELP.signedArea,
    fontStrokes: HELP.fontStrokes, SFONT: HELP.SFONT,
  };
  const src = fs.readFileSync(LAB, "utf8");
  N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));
  console.log("target: LAB nodes-lab/numerals.plotternode.js");
}

const defs = {};
for (const pr of N.params) defs[pr.key] = pr.def;
const CTX = { W: 297, H: 210 };
const run = (over = {}) => N.compute([undefined], { ...defs, ...over }, CTX, {});
const J = (r) => JSON.stringify(r);
const bbox = (r) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of r.paths) for (const [x, y] of p.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};

let fails = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra ? "  (" + extra + ")" : ""));
  if (!ok) { fails++; process.exitCode = 1; }
};

const SYSTEMS = N.params.find((q) => q.key === "system").options;

// 1. every system renders 0-9 / sample values with finite on-sheet coords
let allLive = true, allFinite = true;
for (const sys of SYSTEMS) {
  const r = run({ system: sys, value: "0 1 2 3 4 5 6 7 8 9", size: 12 });
  if (!r.paths.length) { allLive = false; console.log("   dead system: " + sys); }
  for (const p of r.paths) for (const q of p.pts)
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1]) || q[0] < -1 || q[0] > CTX.W + 1 || q[1] < -1 || q[1] > CTX.H + 1) allFinite = false;
}
check("all 16 systems live for 0..9", allLive);
check("all coords finite and on sheet", allFinite);

// 2. determinism (no seed by design)
check("deterministic (double run)", J(run()) === J(run()));

// 3. digit scripts: 10 distinct digit shapes each
let distinctOk = true;
for (const sys of ["Western", "Eastern Arabic", "Persian", "Devanagari", "Mongolian", "Chinese", "Dot matrix", "7-segment", "14-segment"]) {
  const seen = new Set();
  for (let d = 0; d <= 9; d++) {
    const r = run({ system: sys, value: String(d), tx: 0, ty: 0 });
    const b = bbox(r);
    const norm = r.paths.map((p) => p.pts.map(([x, y]) => [(x - b.x0).toFixed(2), (y - b.y0).toFixed(2)]));
    const k = JSON.stringify(norm);
    if (seen.has(k)) { distinctOk = false; console.log("   duplicate glyph in " + sys + ": " + d); }
    seen.add(k);
  }
}
check("digit scripts have 10 distinct glyphs", distinctOk);

// 4. Roman conversion oracle: stroke counts per letter I1 V2 X2 L1 C1 D2 M1 N1
const romanPaths = (v) => run({ system: "Roman", value: String(v) }).paths.length;
check("Roman 1988 = MCMLXXXVIII = 15 strokes", romanPaths(1988) === 15, romanPaths(1988) + "");
check("Roman 0 = N (nulla)", romanPaths(0) === 1);
check("Roman 4 = IV = 3 strokes", romanPaths(4) === 3);
check("Roman 4000 = MMMM = 4 strokes", romanPaths(4000) === 4);

// 5. Maya base-20 oracle: 2026 = [5,1,6] = bar + dot + (bar+dot) = 4 paths, 3 cells tall
const rMaya = run({ system: "Maya", value: "2026", size: 20 });
check("Maya 2026 = [5,1,6] = 4 paths", rMaya.paths.length === 4, rMaya.paths.length + "");
const mb = bbox(rMaya);
check("Maya 2026 stacks 3 cells vertically", mb.y1 - mb.y0 > 20 * 2 && mb.x1 - mb.x0 < 20 * 1.2,
  (mb.y1 - mb.y0).toFixed(1) + "mm tall");
check("Maya 0 = shell (3 strokes)", run({ system: "Maya", value: "0" }).paths.length === 3);
check("Maya 19 = 3 bars + 4 dots", run({ system: "Maya", value: "19" }).paths.length === 7);

// 6. Cistercian oracles
const cis = (v) => run({ system: "Cistercian", value: String(v) }).paths.length;
check("Cistercian 0 = bare stave", cis(0) === 1);
check("Cistercian 9999 = stave + 4x3 strokes", cis(9999) === 13, cis(9999) + "");
check("Cistercian 1 = stave + top bar", cis(1) === 2);
const c10 = run({ system: "Cistercian", value: "10", tx: 0, ty: 0 }), c1 = run({ system: "Cistercian", value: "1", tx: 0, ty: 0 });
const staveX = (r) => r.paths[0].pts[0][0];
const nonStave = (r) => r.paths.slice(1).flatMap((p) => p.pts.map((q) => q[0]));
check("Cistercian tens mirror left of stave", nonStave(c10).every((x) => x <= staveX(c10) + 0.01) &&
  nonStave(c1).every((x) => x >= staveX(c1) - 0.01));

// 7. Babylonian base-60 oracles
const bab = (v) => run({ system: "Babylonian", value: String(v) }).paths.length;
check("Babylonian 59 = 5 tens + 9 units = 28 strokes", bab(59) === 28, bab(59) + "");
check("Babylonian 60 = [1;0] = unit wedge + placeholder", bab(60) === 5, bab(60) + "");
check("Babylonian 1 = one wedge (2 strokes)", bab(1) === 2);

// 8. Kaktovik: nonzero digits are single connected strokes
const kak = (v) => run({ system: "Kaktovik", value: String(v) });
check("Kaktovik 7 = one connected stroke", kak(7).paths.length === 1);
check("Kaktovik 20 = [1,0] = two glyphs", kak(20).paths.length === 2);
check("Kaktovik 19 = one connected stroke", kak(19).paths.length === 1);

// 9. Counting rods: 2026 = 6v(2) + 2h(2) + 0(blank) + 2h(2)
const rods = run({ system: "Counting rods", value: "2026" });
check("Counting rods 2026 = 6 strokes with blank zero", rods.paths.length === 6, rods.paths.length + "");
// orientation alternates: token "11" = units vertical line + tens horizontal line
const r11 = run({ system: "Counting rods", value: "11" });
const isVert = (p) => Math.abs(p.pts[0][0] - p.pts[p.pts.length - 1][0]) < 1e-6;
check("Counting rods alternate orientation", r11.paths.length === 2 && isVert(r11.paths[1]) && !isVert(r11.paths[0]));

// 10. Braille: number sign toggle
const b5 = run({ system: "Braille", value: "5", numSign: true }).paths.length;
const b5n = run({ system: "Braille", value: "5", numSign: false }).paths.length;
check("Braille 5 = numsign(4) + e(2) dots", b5 === 6 && b5n === 2, b5 + "/" + b5n);

// 11. Dot matrix 8 = 17 lit dots; 7-seg 8 = 7; 14-seg 8 = 8
check("Dot matrix 8 = 17 dots", run({ system: "Dot matrix", value: "8" }).paths.length === 17);
check("7-segment 8 = 7 segments", run({ system: "7-segment", value: "8" }).paths.length === 7);
check("7-segment 1 = 2 segments", run({ system: "7-segment", value: "1" }).paths.length === 2);
check("14-segment 8 = 8 segments", run({ system: "14-segment", value: "8" }).paths.length === 8);

// 12. layout: tx/ty shift exactly, perLine wraps, size/spacing live
const base = run({ value: "12 34 56 78" });
const shifted = run({ value: "12 34 56 78", tx: 20, ty: -15 });
const b0 = bbox(base), b1 = bbox(shifted);
check("tx/ty shift exact", Math.abs(b1.x0 - b0.x0 - 20) < 1e-9 && Math.abs(b1.y0 - b0.y0 + 15) < 1e-9);
const wrapped = run({ value: "12 34 56 78", perLine: 2 });
check("perLine wraps to taller block", bbox(wrapped).y1 - bbox(wrapped).y0 > b0.y1 - b0.y0 + 10);
check("size live", J(run({ size: 50 })) !== J(run()));
check("spacing live", J(run({ system: "Western", value: "123", spacing: 0.5 })) !== J(run({ system: "Western", value: "123" })));
check("lineGap live", J(run({ value: "1 2", perLine: 1, lineGap: 1 })) !== J(run({ value: "1 2", perLine: 1 })));
check("dot size live for Braille", J(run({ system: "Braille", value: "5", dot: 3 })) !== J(run({ system: "Braille", value: "5" })));

// 13. pen + style + empties
check("pen applied", run({ layer: 4 }).paths.every((p) => p.layer === 4));
check("empty value -> EMPTY", run({ value: "  " }).paths.length === 0);
check("non-numeric token for Roman -> EMPTY", run({ system: "Roman", value: "abc" }).paths.length === 0);

// 14. budget sanity: full table hostile
const big = run({ system: "Dot matrix", value: "0123456789 0123456789 0123456789 0123456789", perLine: 1, size: 10 });
const pts = big.paths.reduce((a, p) => a + p.pts.length, 0);
check("dot matrix table within budget", pts > 0 && pts < 30000, pts + " pts");

// 15. overlay anchor point
if (N.overlay) {
  const g = N.overlay({ ...defs, tx: 10, ty: -5 }, CTX)[0];
  check("overlay point at anchor", g.kind === "point" && g.x === CTX.W / 2 + 10 && g.y === CTX.H / 2 - 5);
} else check("overlay present", false);

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL CHECKS PASSED");
