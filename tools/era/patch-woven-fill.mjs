/* Era patch: Woven Ribbon — Fill: Tracks / Rays / Square wave.
   Run once from the repo root:  node tools/era/patch-woven-fill.mjs
   Anchored exact-string edits on src/defs/nodes/woven_ribbon.js.
   MISS aborts before writing; SKIP if the Fill param already exists.
   Rays: perpendicular comb across the ribbon at Ray step along the spine
   (fans on curves, like radial-comb typography). Square wave: the same comb
   as ONE continuous meander (across, along the edge, back across). Both
   respect the under-pass gaps and Ray overhang lets the comb stick out. */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve("src/defs/nodes/woven_ribbon.js");
if (!existsSync(FILE)) { console.log("MISS " + FILE); process.exit(1); }
let src = readFileSync(FILE, "utf8");
if (src.includes('key: "fill"')) { console.log("SKIP already applied (Fill param present)"); process.exit(0); }

const report = [];
let miss = false;
const rep = (anchor, add, label) => {
  const n = src.split(anchor).length - 1;
  if (n !== 1) { report.push("MISS " + label + " (" + n + " hits)"); miss = true; return; }
  src = src.replace(anchor, add);
  report.push("OK   " + label);
};

/* 1. params: Fill / Ray step / Ray overhang after Gap */
rep(
  '    { key: "gap", label: "Gap (mm)", type: "slider", min: 0, max: 3, step: 0.1, def: 0.9 },\n',
  '    { key: "gap", label: "Gap (mm)", type: "slider", min: 0, max: 3, step: 0.1, def: 0.9 },\n' +
  '    { key: "fill", label: "Fill", type: "select", options: ["Tracks", "Rays", "Square wave"], def: "Tracks" },\n' +
  '    { key: "rayStep", label: "Ray step (mm)", type: "slider", min: 0.3, max: 6, step: 0.1, def: 1, showIf: (p) => p.fill !== "Tracks" },\n' +
  '    { key: "overhang", label: "Ray overhang (mm)", type: "slider", min: 0, max: 20, step: 0.5, def: 0, showIf: (p) => p.fill !== "Tracks" },\n',
  "params"
);

/* 2. desc: one sentence at the end */
rep(
  ' Track spacing auto-shrinks if the tracks would not fit the grid corners.",',
  ' Track spacing auto-shrinks if the tracks would not fit the grid corners. Fill Tracks draws the parallel tracks; Rays replaces them with a perpendicular comb across the whole ribbon width every Ray step along the spine — the teeth fan out on the outside of every bend like radial-comb lettering — and Square wave draws that same comb as ONE continuous meander (across, along the edge, back across), the plotter-friendly version; both keep the under-pass gaps, and Ray overhang lets the teeth stick out beyond the ribbon.",',
  "desc"
);

/* 3. emission: wrap the track loop, add rays / square wave */
rep(
  '    // ---- emit tracks (split at gaps) + optional end caps\n' +
  '    const paths = [];\n' +
  '    for (let k = -pairs; k <= pairs; k++) {\n' +
  '      const d = k * eff;\n' +
  '      let run = [];\n' +
  '      for (const q of pts) {\n' +
  '        if (inGap(q[2])) {\n' +
  '          if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n' +
  '          run = [];\n' +
  '          continue;\n' +
  '        }\n' +
  '        run.push([q[0] - q[4] * d, q[1] + q[3] * d]);\n' +
  '      }\n' +
  '      if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n' +
  '    }\n',
  '    // ---- emit tracks / rays / square wave (split at gaps) + optional end caps\n' +
  '    const paths = [];\n' +
  '    const fill = String(p.fill || "Tracks");\n' +
  '    if (fill === "Tracks") {\n' +
  '      for (let k = -pairs; k <= pairs; k++) {\n' +
  '        const d = k * eff;\n' +
  '        let run = [];\n' +
  '        for (const q of pts) {\n' +
  '          if (inGap(q[2])) {\n' +
  '            if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n' +
  '            run = [];\n' +
  '            continue;\n' +
  '          }\n' +
  '          run.push([q[0] - q[4] * d, q[1] + q[3] * d]);\n' +
  '        }\n' +
  '        if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n' +
  '      }\n' +
  '    } else {\n' +
  '      // perpendicular comb: sample the centerline every rayStep of arclength\n' +
  '      const hw = off + Math.max(0, +p.overhang || 0);\n' +
  '      let step = Math.max(0.3, +p.rayStep || 1);\n' +
  '      step = Math.max(step, totalS / 50000); // point budget\n' +
  '      let j = 0;\n' +
  '      const at = (sv) => {\n' +
  '        while (j < pts.length - 2 && pts[j + 1][2] < sv) j++;\n' +
  '        const a = pts[j], b = pts[Math.min(pts.length - 1, j + 1)];\n' +
  '        const span = b[2] - a[2];\n' +
  '        const t = span > 1e-9 ? Math.max(0, Math.min(1, (sv - a[2]) / span)) : 0;\n' +
  '        const q = t < 0.5 ? a : b; // tangent of the nearer sample (exact on lines, arc-accurate at DS)\n' +
  '        const L = Math.hypot(q[3], q[4]) || 1;\n' +
  '        return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -q[4] / L, ny: q[3] / L };\n' +
  '      };\n' +
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
  '      if (run.length >= 2) paths.push({ pts: run, closed: false, layer });\n' +
  '    }\n',
  "emit block"
);

for (const l of report) console.log(l);
if (miss) { console.log("ABORT — nothing written"); process.exit(1); }
writeFileSync(FILE, src);
console.log("DONE woven_ribbon: Fill Tracks / Rays / Square wave");
