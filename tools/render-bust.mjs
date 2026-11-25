/* Render the Bust node headlessly to A4 SVG previews: every Form x Style combo.
   Run: node tools/render-bust.mjs  -> writes output/bust-preview/*.svg */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const def = (await import(pathToFileURL(resolve("src/defs/nodes/bust.js")).href + "?v=" + Date.now())).default;
const PW = 297, PH = 210;

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };

const svgOf = (out) => {
  let body = "";
  for (const pa of out.paths) {
    if (!pa.pts.length) continue;
    const d = pa.pts.map((pt, i) => (i ? "L" : "M") + pt[0].toFixed(2) + " " + pt[1].toFixed(2)).join("") + (pa.closed ? "Z" : "");
    const w = pa.layer === 0 ? 1.0 : 0.35; /* main pen vs 0.35 mm detail pen */
    body += `<path d="${d}" fill="none" stroke="#181818" stroke-width="${w}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 ${PW} ${PH}"><rect width="${PW}" height="${PH}" fill="#fdfdfa"/>${body}</svg>`;
};

const dir = resolve("output/bust-preview");
mkdirSync(dir, { recursive: true });

let fails = 0;
for (const form of ["Female", "Male"]) {
  for (const style of ["Outline", "Contours", "Curved hatch", "Crosshatch", "Stipple", "Rosette"]) {
    const p = defaults();
    p.form = form; p.style = style;
    p.size = 150;               /* larger figure fills the A4 preview better */
    try {
      const t0 = Date.now();
      const out = def.compute([undefined], p, { W: PW, H: PH });
      const nPaths = out.paths.length;
      const ms = Date.now() - t0;
      const f = resolve(dir, `${form}-${style.replace(/\s/g, "-").toLowerCase()}.svg`);
      writeFileSync(f, svgOf(out));
      console.log(`OK   ${form} / ${style.padEnd(13)} ${String(nPaths).padStart(4)} paths  ${ms}ms  -> ${f.split("/").pop()}`);
    } catch (e) {
      fails++;
      console.error(`FAIL ${form} / ${style}: ${e.message}`);
    }
  }
}
console.log(fails ? `\n${fails} failures` : "\nall 12 rendered");

/* Optional before/after: regenerate the v5 (gaussian radial profile) renders
   through the current renderer when the reconstructed module is present, so
   the sheet compares geometry, not renderer generations. */
const v5File = resolve("src/defs/nodes/__v5bust.mjs");
if (existsSync(v5File)) {
  const defV5 = (await import(pathToFileURL(v5File).href + "?v=" + Date.now())).default;
  for (const form of ["Female", "Male"]) {
    for (const style of ["Outline", "Contours", "Curved hatch", "Crosshatch", "Stipple", "Rosette"]) {
      const p = {};
      for (const pr of defV5.params) p[pr.key] = pr.def;
      p.form = form; p.style = style; p.size = 150;
      const out = defV5.compute([undefined], p, { W: PW, H: PH });
      writeFileSync(resolve(dir, `v5-${form}-${style.replace(/\s/g, "-").toLowerCase()}.svg`), svgOf(out));
    }
  }
  console.log("v5 comparison renders written (delete src/defs/nodes/__v5bust.mjs when done comparing)");
}
