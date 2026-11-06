/* Spiral Image: one finite, continuous, deterministic plotted path. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const key = "spiral_image";
const lab = resolve(`nodes-lab/${key}.plotternode.js`), baked = resolve(`src/defs/nodes/${key}.js`);
const useLab = process.argv.includes("--lab") || !existsSync(baked);
const def = useLab
  ? new Function(...Object.keys(H), `"use strict"; return ${readFileSync(lab, "utf8")}`)(...Object.values(H))
  : (await import(pathToFileURL(baked).href)).default;
const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const ctx = { W: 297, H: 210 }, w = 320, h = 210;
const g = Float32Array.from({ length: w * h }, (_, i) => {
  const u = (i % w) / w, v = Math.floor(i / w) / h;
  const disk = ((u - 0.38) / 0.26) ** 2 + ((v - 0.48) / 0.35) ** 2;
  return disk < 1 ? Math.max(0.1, Math.min(0.95, 0.3 + u * 0.65)) : 0;
});
const node = { data: { img: { w, h, g } } };
const run = p => def.compute([], { ...defaults, ...p }, ctx, node);
let checks = 0;
const ok = (cond, message) => { checks++; if (!cond) throw new Error(message); };
ok(def.key === key && def.fileImage && def.ins.length === 0 && def.outs.length === 1, "definition contract");
ok(def.compute([], defaults, ctx, {}).paths.length === 0, "empty image");
const a = run({}).paths, b = run({}).paths;
ok(a.length === 1 && a[0].closed === false, "one open path");
ok(JSON.stringify(a) === JSON.stringify(b), "deterministic");
ok(a[0].pts.length > 1000 && a[0].pts.length <= 30001, "complete sampled spiral");
for (const [x, y] of a[0].pts) ok(Number.isFinite(x) && Number.isFinite(y) && x >= 12 && x <= 285 && y >= 12 && y <= 198, "finite paper bounds");
ok(a[0].layer === 0, "default pen");
ok(run({ pen: 7 }).paths[0].layer === 7, "pen setting");
ok(JSON.stringify(run({ shape: "Circle" })) !== JSON.stringify(run({ shape: "Ellipse" })), "shape setting");
ok(run({ pitch: 4 }).paths[0].pts.length < a[0].pts.length, "turn spacing");
ok(JSON.stringify(run({ wiggle: 0 })) !== JSON.stringify(a), "tone wiggle");
ok(JSON.stringify(run({ centerX: 65, centerY: 40 })) !== JSON.stringify(a), "center point");
ok(JSON.stringify(run({ contrast: 2.5 })) !== JSON.stringify(a), "contrast");
ok(JSON.stringify(run({ wavelength: 6 })) !== JSON.stringify(a), "wavelength");
ok(JSON.stringify(run({ direction: "Inward" }).paths[0].pts) === JSON.stringify([...a[0].pts].reverse()), "reverse preserves exact path");
ok(def.compute([], defaults, { W: 80, H: 60 }, node).paths.length === 1, "small paper");
ok(def.compute([], { ...defaults, margin: 60 }, { W: 80, H: 60 }, node).paths.length === 0, "impossible margin");
console.log(`Spiral Image ${useLab ? "lab" : "baked"}: ${checks} checks passed; one ${a[0].pts.length}-point path`);
