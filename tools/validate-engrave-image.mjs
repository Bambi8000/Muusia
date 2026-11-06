/* Engrave Image: lab and baked definitions with the real shared helpers. */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const key = "engrave_image";
const lab = resolve(`nodes-lab/${key}.plotternode.js`);
const baked = resolve(`src/defs/nodes/${key}.js`);
const useLab = process.argv.includes("--lab") || !existsSync(baked);
const def = useLab
  ? new Function(...Object.keys(H), `"use strict"; return ${readFileSync(lab, "utf8")}`)(...Object.values(H))
  : (await import(pathToFileURL(baked).href)).default;
const params = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const context = { W: 297, H: 210 };
const w = 320, h = 210, g = new Float32Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const u = x / w, v = y / h;
  const ellipse = ((u - 0.33) / 0.26) ** 2 + ((v - 0.48) / 0.37) ** 2;
  const vase = Math.abs(u - 0.73) < 0.10 + 0.055 * Math.sin((v - 0.15) * Math.PI) && v > 0.22 && v < 0.88;
  const shadow = Math.exp(-(((u - 0.5) / 0.35) ** 2) - (((v - 0.89) / 0.055) ** 2));
  g[y * w + x] = Math.max(0, Math.min(1,
    (ellipse < 1 ? 0.30 + 0.56 * (u - 0.1) + 0.09 * (v - 0.1) : 0) +
    (vase ? 0.42 + 0.3 * (u - 0.6) + 0.12 * (v - 0.2) : 0) + 0.3 * shadow));
}
const node = { data: { img: { w, h, g } } };
let checks = 0;
const assert = (v, message) => { checks++; if (!v) throw new Error(message); };
const run = p => def.compute([null], { ...params, ...p }, context, node);
const count = v => v.reduce((n, layer) => n + layer.paths.length, 0);
assert(def.key === key && def.fileImage && def.outs.length === 5, "definition contract");
assert(def.params.some(p => p.key === "file" && p.type === "file"), "image picker");
assert(count(def.compute([null], params, context, {})) === 0, "empty image");
const a = run({ mode: "Flow" }), b = run({ mode: "Flow" });
assert(JSON.stringify(a) === JSON.stringify(b), "deterministic");
assert(a[0].paths.length > 100 && a[1].paths.length > 0 && a[2].paths.length > 0 && a[3].paths.length > 0 && a[4].paths.length > 0, "all layers drawn");
assert(a[0].paths.length === a.slice(1).reduce((n, layer) => n + layer.paths.length, 0), "artwork combines layers");
assert(a.slice(1).every((layer, i) => layer.paths.every(path => path.layer === [0, 1, 2, 3][i])), "default pen layers");
for (const layer of a) for (const path of layer.paths) {
  assert(Array.isArray(path.pts) && path.pts.length >= 2, "valid path");
  assert(path.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 11.999 && x <= 285.001 && y >= 11.999 && y <= 198.001), "paper bounds");
  assert(Number.isInteger(path.layer) && path.layer >= 0 && path.layer <= 11, "pen index");
}
assert(run({ mode: "Straight" })[2].paths.length > 0, "straight mode");
assert(run({ mode: "Facets" })[2].paths.length > 0, "facets mode");
assert(JSON.stringify(a[2]) !== JSON.stringify(run({ mode: "Straight" })[2]), "flow differs from straight");
assert(JSON.stringify(a[2]) !== JSON.stringify(run({ mode: "Facets" })[2]), "flow differs from facets");
assert(run({ cross: false })[3].paths.length === 0, "crosshatch toggle");
assert(run({ outline: false })[1].paths.length === 0, "outline toggle");
assert(run({ dots: false })[4].paths.length === 0, "dots toggle");
assert(run({ cutoff: 0.45 })[2].paths.length < a[2].paths.length, "white cutoff changes marks");
assert(run({ spacing: 5 })[2].paths.length < a[2].paths.length, "spacing changes marks");
assert(run({ seed: 44 })[2].paths.some((path, i) => JSON.stringify(path) !== JSON.stringify(a[2].paths[i])), "seed changes geometry");
assert(run({ outlinePen: 8, hatchPen: 9, shadowPen: 10, dotPen: 11 }).slice(1).every((layer, i) => layer.paths.every(path => path.layer === [8, 9, 10, 11][i])), "independent pens");

if (process.argv.includes("--render")) {
  const modes = ["Flow", "Straight", "Facets"];
  const colors = ["#272d3b", "#333745", "#65759a", "#8d9abb"];
  for (const mode of modes) {
    const out = run({ mode });
    const elements = out.slice(1).flatMap((layer, i) => layer.paths.map(path => {
      const d = path.pts.map((pt, j) => `${j ? "L" : "M"}${pt[0].toFixed(3)} ${pt[1].toFixed(3)}`).join(" ") + (path.closed ? " Z" : "");
      return `<path d="${d}" stroke="${colors[i]}"/>`;
    })).join("\n");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297 210" width="1188" height="840"><rect width="297" height="210" fill="#f8f5eb"/><g fill="none" stroke-width="0.19" stroke-linecap="round" stroke-linejoin="round">${elements}</g></svg>`;
    writeFileSync(`/private/tmp/muusia-engrave-${mode.toLowerCase()}.svg`, svg);
  }
}
console.log(`Engrave Image ${useLab ? "lab" : "baked"}: ${checks} checks passed; Flow ${a[0].paths.length} paths`);
