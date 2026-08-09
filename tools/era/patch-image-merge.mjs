/* tools/era/patch-image-merge.mjs — merge Trace Image into Image (v2.51)
 *
 * Image gains render mode "Contours (trace)": the traceimg algorithm
 * transcribed VERBATIM as a compute branch (byte-identical output — proven
 * by tools/validate-image-merge.mjs), plus its params (levels, low, high,
 * minlen) appended with traceimg defaults. gamma/strength/cutoff/seed have
 * no effect in Contours mode (traceimg never had them — required for
 * byte-identity). Trace Image becomes a HIDDEN legacy alias (the Route
 * precedent): compute untouched, old patches load and render unchanged,
 * the palette shows one Image node.
 *
 * Touches three files, all-or-nothing across ALL of them: any MISS in any
 * file aborts with nothing written anywhere.
 *
 * After a successful run:
 *   grep -c "Contours (trace)" src/defs/nodes/image.js -> 2
 *   grep -c "hidden: true" src/defs/nodes/traceimg.js  -> 1
 *   grep -c "Contours (trace)" src/App.jsx             -> 2
 *   node tools/validate-image-merge.mjs                -> ALL PASS
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILES = {
  image: "src/defs/nodes/image.js",
  traceimg: "src/defs/nodes/traceimg.js",
  app: "src/App.jsx",
};
const fileOf = (name) => name.startsWith("M") ? "image" : name.startsWith("T") ? "traceimg" : "app";
const srcs = { image: readFileSync(FILES.image, "utf8"), traceimg: readFileSync(FILES.traceimg, "utf8"), app: readFileSync(FILES.app, "utf8") };

const EDITS = [
  { name: "M1 image.js: import pathLength",
    find: "import { Pin, EMPTY, mulberry32, noise2, applyStyle } from \"../helpers.js\";",
    repl: "import { Pin, EMPTY, mulberry32, noise2, applyStyle, pathLength } from \"../helpers.js\";" },
  { name: "M2 image.js: mode option Contours (trace)",
    find: "{ key: \"mode\", label: \"Render\", type: \"select\", options: [\"Scanline wave\", \"Halftone dots\", \"Hatch levels\", \"Flow shade\"], def: \"Scanline wave\" },",
    repl: "{ key: \"mode\", label: \"Render\", type: \"select\", options: [\"Scanline wave\", \"Halftone dots\", \"Hatch levels\", \"Flow shade\", \"Contours (trace)\"], def: \"Scanline wave\" }," },
  { name: "M3 image.js: contour params after invert",
    find: "      { key: \"invert\", label: \"Invert\", type: \"check\", def: false },\n      { key: \"margin\", label: \"Margin mm\", type: \"slider\", min: 0, max: 60, step: 1, def: 12 },",
    repl: "      { key: \"invert\", label: \"Invert\", type: \"check\", def: false },\n      { key: \"levels\", label: \"Contour levels\", type: \"slider\", min: 1, max: 6, step: 1, def: 3 },\n      { key: \"low\", label: \"Lowest threshold\", type: \"slider\", min: 0.05, max: 0.9, step: 0.05, def: 0.25 },\n      { key: \"high\", label: \"Highest threshold\", type: \"slider\", min: 0.1, max: 0.95, step: 0.05, def: 0.75 },\n      { key: \"minlen\", label: \"Min contour mm\", type: \"slider\", min: 0, max: 30, step: 1, def: 5 },\n      { key: \"margin\", label: \"Margin mm\", type: \"slider\", min: 0, max: 60, step: 1, def: 12 }," },
  { name: "M4 image.js: Contours branch at compute top",
    find: "      const img = node && node.data && node.data.img;\n      if (!img) return EMPTY;\n",
    repl: "      const img = node && node.data && node.data.img;\n      if (!img) return EMPTY;\n      if (p.mode === \"Contours (trace)\") {\n        /* verbatim traceimg body \u2014 merged 2.51; traceimg is a hidden alias */\n      const { W, H } = ctx;\n      const m = Math.max(0, p.margin);\n      const boxW = W - 2 * m, boxH = H - 2 * m;\n      if (boxW < 10 || boxH < 10) return applyStyle({ paths: [] }, ins[0]);\n      const sc = Math.min(boxW / img.w, boxH / img.h);\n      const iw = img.w * sc, ih = img.h * sc;\n      const ox = (W - iw) / 2, oy = (H - ih) / 2;\n      const darkAt = (x, y) => {\n        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;\n        const iu = Math.floor(u), iv = Math.floor(v);\n        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];\n        const fu = u - iu, fv = v - iv;\n        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +\n                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;\n        return p.invert ? 1 - d : d;\n      };\n      const cell = Math.max(0.5, p.cell);\n      const cols = Math.max(2, Math.round(iw / cell) + 1);\n      const rows = Math.max(2, Math.round(ih / cell) + 1);\n      const gx = (c) => ox + (c / (cols - 1)) * iw;\n      const gy = (r) => oy + (r / (rows - 1)) * ih;\n      const F = new Float64Array(cols * rows);\n      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) F[r * cols + c] = darkAt(gx(c), gy(r));\n      const NL = Math.max(1, Math.min(8, Math.round(p.levels)));\n      const lo = Math.min(p.low, p.high), hi = Math.max(p.low, p.high);\n      const segs = [];\n      const interp = (a, b, lvl) => Math.abs(b - a) < 1e-12 ? 0.5 : (lvl - a) / (b - a);\n      for (let li = 0; li < NL; li++) {\n        const lvl = NL === 1 ? (lo + hi) / 2 : lo + (li / (NL - 1)) * (hi - lo);\n        for (let r = 0; r < rows - 1; r++) {\n          for (let c = 0; c < cols - 1; c++) {\n            const tl = F[r * cols + c], tr = F[r * cols + c + 1];\n            const bl = F[(r + 1) * cols + c], br = F[(r + 1) * cols + c + 1];\n            let idx = 0;\n            if (tl > lvl) idx |= 8; if (tr > lvl) idx |= 4;\n            if (br > lvl) idx |= 2; if (bl > lvl) idx |= 1;\n            if (idx === 0 || idx === 15) continue;\n            const xL = gx(c), xR = gx(c + 1), yT = gy(r), yB = gy(r + 1);\n            const eT = () => [xL + interp(tl, tr, lvl) * (xR - xL), yT];\n            const eB = () => [xL + interp(bl, br, lvl) * (xR - xL), yB];\n            const eL = () => [xL, yT + interp(tl, bl, lvl) * (yB - yT)];\n            const eR = () => [xR, yT + interp(tr, br, lvl) * (yB - yT)];\n            const S = (A, B) => segs.push([A, B]);\n            switch (idx) {\n              case 1: S(eL(), eB()); break; case 2: S(eB(), eR()); break;\n              case 3: S(eL(), eR()); break; case 4: S(eT(), eR()); break;\n              case 5: S(eL(), eT()); S(eB(), eR()); break;\n              case 6: S(eT(), eB()); break; case 7: S(eL(), eT()); break;\n              case 8: S(eL(), eT()); break; case 9: S(eT(), eB()); break;\n              case 10: S(eL(), eB()); S(eT(), eR()); break;\n              case 11: S(eT(), eR()); break; case 12: S(eL(), eR()); break;\n              case 13: S(eB(), eR()); break; case 14: S(eL(), eB()); break;\n            }\n          }\n        }\n      }\n      const q = (v) => Math.round(v * 100) / 100;\n      const kk = (pt) => q(pt[0]) + \",\" + q(pt[1]);\n      const map = new Map();\n      const items = segs.map((s) => ({ a: s[0], b: s[1], used: false }));\n      const push = (k, ref) => { let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(ref); };\n      items.forEach((s, i) => { push(kk(s.a), { i, end: \"a\" }); push(kk(s.b), { i, end: \"b\" }); });\n      const paths = [];\n      const L = Math.round(p.layer);\n      for (let i = 0; i < items.length; i++) {\n        if (items[i].used) continue;\n        items[i].used = true;\n        const chain = [items[i].a, items[i].b];\n        let grow = true;\n        while (grow) {\n          grow = false;\n          for (const ref of (map.get(kk(chain[chain.length - 1])) || [])) {\n            const s = items[ref.i];\n            if (s.used) continue;\n            chain.push(ref.end === \"a\" ? s.b : s.a);\n            s.used = true; grow = true; break;\n          }\n        }\n        grow = true;\n        while (grow) {\n          grow = false;\n          for (const ref of (map.get(kk(chain[0])) || [])) {\n            const s = items[ref.i];\n            if (s.used) continue;\n            chain.unshift(ref.end === \"a\" ? s.b : s.a);\n            s.used = true; grow = true; break;\n          }\n        }\n        if (chain.length < 3) continue;\n        if (p.minlen > 0 && pathLength(chain, false) < p.minlen) continue;\n        const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0], chain[0][1] - chain[chain.length - 1][1]) < cell * 1.5;\n        if (closed) chain.pop();\n        if (chain.length > 2) paths.push({ pts: chain, closed, layer: L });\n      }\n      return applyStyle({ paths }, ins[0]);\n      }\n" },
  { name: "T1 traceimg.js: hidden alias flag + desc",
    find: "  key: \"traceimg\",\n    name: \"Trace Image\",\n    cat: \"gen\",\n    group: \"textimg\",\n",
    repl: "  key: \"traceimg\",\n    name: \"Trace Image\",\n    cat: \"gen\",\n    group: \"textimg\",\n    hidden: true, /* merged into Image (Contours (trace) mode) in 2.51 \u2014 legacy alias, old patches keep loading unchanged */\n" },
  { name: "D1 App.jsx: image desc mentions Contours",
    find: "and *Flow shade* (noise streamlines seeded and lengthened by darkness). Gamma, invert, white cutoff.\",",
    repl: "and *Flow shade* (noise streamlines seeded and lengthened by darkness), plus *Contours (trace)* \u2014 1-6 tonal threshold levels traced as vector contour lines with a minimum-contour speck filter (the former Trace Image node; gamma/strength/cutoff/seed have no effect in this mode). Gamma, invert, white cutoff.\"," },
  { name: "D2 App.jsx: traceimg desc marks legacy",
    find: "traceimg: \"threshold contours of a loaded raster image (fileImage): 1-6 tonal levels traced as vector contours fitted to the margin box, with invert and a minimum-contour filter for specks.\",",
    repl: "traceimg: \"legacy alias hidden from the palette since 2.51 \u2014 merged into Image as the *Contours (trace)* render mode. Old patches keep loading and rendering unchanged. Threshold contours of a loaded raster image: 1-6 tonal levels traced as vector contours fitted to the margin box, with invert and a minimum-contour filter for specks.\"," },
];

const report = [];
let miss = 0, skip = 0, ok = 0;
for (const e of EDITS) {
  const s = srcs[fileOf(e.name)];
  if (s.includes(e.repl)) { report.push(`SKIP  ${e.name} (already applied)`); skip++; continue; }
  const n = s.split(e.find).length - 1;
  if (n === 1) { report.push(`OK    ${e.name}`); ok++; }
  else { report.push(`MISS  ${e.name} (found ${n} occurrences, need exactly 1)`); miss++; }
}
console.log(report.join("\n"));
if (miss > 0) { console.log(`\nABORT — ${miss} MISS, nothing written to any file.`); process.exit(1); }
if (ok === 0) { console.log("\nAll edits already applied — nothing to do."); process.exit(0); }
for (const e of EDITS) {
  const f = fileOf(e.name);
  if (srcs[f].includes(e.repl)) continue;
  srcs[f] = srcs[f].split(e.find).join(e.repl);
}
for (const [k, path] of Object.entries(FILES)) writeFileSync(path, srcs[k]);
console.log(`\nWROTE ${Object.values(FILES).join(", ")} — ${ok} applied, ${skip} skipped.`);
console.log('Verify: grep -c "Contours (trace)" src/defs/nodes/image.js (2), grep -c "hidden: true" src/defs/nodes/traceimg.js (1), grep -c "Contours (trace)" src/App.jsx (2), then node tools/validate-image-merge.mjs');
