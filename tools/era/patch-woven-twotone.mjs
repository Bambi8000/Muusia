/* Era patch: Woven Ribbon — Two-tone comb (Rays / Square wave split into two pens).
   Run once from the repo root after patch-woven-fill.mjs:  node tools/era/patch-woven-twotone.mjs
   Anchored exact-string edits on src/defs/nodes/woven_ribbon.js; MISS aborts, SKIP if applied. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve("src/defs/nodes/woven_ribbon.js");
if (!existsSync(FILE)) { console.log("MISS " + FILE); process.exit(1); }
let src = readFileSync(FILE, "utf8");
if (!src.includes('key: "fill"')) { console.log("MISS Fill param — run patch-woven-fill.mjs first"); process.exit(1); }
if (src.includes('key: "twoTone"')) { console.log("SKIP already applied (Two-tone param present)"); process.exit(0); }
const report = []; let miss = false;
const rep = (anchor, add, label) => {
  const n = src.split(anchor).length - 1;
  if (n !== 1) { report.push("MISS " + label + " (" + n + " hits)"); miss = true; return; }
  src = src.replace(anchor, add); report.push("OK   " + label);
};

/* 1. params after Ray overhang */
rep(
  '    { key: "overhang", label: "Ray overhang (mm)", type: "slider", min: 0, max: 20, step: 0.5, def: 0, showIf: (p) => p.fill !== "Tracks" },\n',
  '    { key: "overhang", label: "Ray overhang (mm)", type: "slider", min: 0, max: 20, step: 0.5, def: 0, showIf: (p) => p.fill !== "Tracks" },\n' +
  '    { key: "twoTone", label: "Two-tone comb", type: "check", def: false, showIf: (p) => p.fill !== "Tracks" },\n' +
  '    { key: "split", label: "Split (-1 left … 1 right)", type: "slider", min: -1, max: 1, step: 0.05, def: 0, showIf: (p) => p.fill !== "Tracks" && !!p.twoTone },\n' +
  '    { key: "pen2", label: "Second pen", type: "pen", def: 1, showIf: (p) => p.fill !== "Tracks" && !!p.twoTone },\n',
  "params"
);

/* 2. desc */
rep(
  "and Ray overhang lets the teeth stick out beyond the ribbon.\",",
  "and Ray overhang lets the teeth stick out beyond the ribbon. Two-tone comb cuts every tooth at the Split line (0 = the spine, ±1 = an edge) and draws the two halves on Pen and Second pen — for Square wave that is two meanders sharing the split line.\",",
  "desc"
);

/* 3. emit: two-tone branch */
rep(
  '      const n = Math.floor(totalS / step);\n' +
  '      let run = [];\n' +
  '      let side = 1;\n' +
  '      for (let i = 0; i <= n; i++) {\n' +
  '        const sv = i * step;\n' +
  '        if (inGap(sv)) {\n' +
  '          if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n' +
  '          run = [];\n' +
  '          continue;\n' +
  '        }\n' +
  '        const q = at(sv);\n' +
  '        const A = [q.x - q.nx * hw * side, q.y - q.ny * hw * side];\n' +
  '        const B = [q.x + q.nx * hw * side, q.y + q.ny * hw * side];\n' +
  '        if (fill === "Rays") paths.push({ pts: [A, B], closed: false, layer });\n' +
  '        else { run.push(A, B); }\n' +
  '        side = -side; // zigzag: rays alternate direction, square wave meanders\n' +
  '      }\n' +
  '      if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n',
  '      const n = Math.floor(totalS / step);\n' +
  '      const twoTone = !!p.twoTone;\n' +
  '      const pen2 = Math.round(+p.pen2 || 0);\n' +
  '      const sp = Math.max(-1, Math.min(1, +p.split || 0)) * hw; // split offset across the ribbon (0 = spine)\n' +
  '      let run = [], run2 = [];\n' +
  '      let side = 1;\n' +
  '      const flush = () => {\n' +
  '        if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n' +
  '        if (run2.length >= 2) paths.push({ pts: run2, closed: false, layer: pen2 });\n' +
  '        run = []; run2 = [];\n' +
  '      };\n' +
  '      for (let i = 0; i <= n; i++) {\n' +
  '        const sv = i * step;\n' +
  '        if (inGap(sv)) { flush(); continue; }\n' +
  '        const q = at(sv);\n' +
  '        if (!twoTone) {\n' +
  '          const A = [q.x - q.nx * hw * side, q.y - q.ny * hw * side];\n' +
  '          const B = [q.x + q.nx * hw * side, q.y + q.ny * hw * side];\n' +
  '          if (fill === "Rays") paths.push({ pts: [A, B], closed: false, layer });\n' +
  '          else { run.push(A, B); }\n' +
  '        } else {\n' +
  '          // two halves: left edge -> split on Pen, split -> right edge on Second pen; each half zigzags on its own\n' +
  '          const Lp = [q.x - q.nx * hw, q.y - q.ny * hw];\n' +
  '          const M = [q.x + q.nx * sp, q.y + q.ny * sp];\n' +
  '          const Rp = [q.x + q.nx * hw, q.y + q.ny * hw];\n' +
  '          const h1 = side > 0 ? [Lp, M] : [M, Lp];\n' +
  '          const h2 = side > 0 ? [M, Rp] : [Rp, M];\n' +
  '          if (fill === "Rays") { paths.push({ pts: h1, closed: false, layer }); paths.push({ pts: h2, closed: false, layer: pen2 }); }\n' +
  '          else { run.push(h1[0], h1[1]); run2.push(h2[0], h2[1]); }\n' +
  '        }\n' +
  '        side = -side; // zigzag: rays alternate direction, square wave meanders\n' +
  '      }\n' +
  '      flush();\n',
  "emit two-tone"
);

for (const l of report) console.log(l);
if (miss) { console.log("ABORT — nothing written"); process.exit(1); }
writeFileSync(FILE, src);
console.log("DONE woven_ribbon: Two-tone comb (Split, Second pen)");
