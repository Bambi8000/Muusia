import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Pin, hash2, applyStyle } from "../src/defs/helpers.js";

const built = new URL("../src/defs/nodes/isometric_blocks.js", import.meta.url);
const lab = new URL("../nodes-lab/isometric_blocks.plotternode.js", import.meta.url);
const def = fs.existsSync(built)
  ? (await import(built.href + `?t=${Date.now()}`)).default
  : vm.runInNewContext(fs.readFileSync(lab, "utf8"), { Pin, hash2, applyStyle });
const defaults = Object.fromEntries(def.params.map(row => [row.key, row.def]));
const page = { W: 297, H: 210 };
const run = (over = {}, style, ctx = page) => def.compute([style], { ...defaults, ...over }, ctx);
const sig = x => JSON.stringify(x);
const bounds = paths => paths.reduce((b, q) => q.pts.reduce((a, [x, y]) =>
  [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], b), [Infinity, Infinity, -Infinity, -Infinity]);
const area = path => Math.abs(path.pts.reduce((sum, [x, y], i) => {
  const [X, Y] = path.pts[(i + 1) % path.pts.length];
  return sum + x * Y - X * y;
}, 0) / 2);
const valid = (set, ctx = page, margin = 12) => set.paths.every(q =>
  Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11 &&
  q.pts.length >= (q.closed ? 3 : 2) &&
  q.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) &&
    x >= margin - 1e-7 && x <= ctx.W - margin + 1e-7 &&
    y >= margin - 1e-7 && y <= ctx.H - margin + 1e-7));
const blocksSeparate = result => {
  const boxes = result[1].paths.map((_, i) => bounds([result[1].paths[i], result[2].paths[i], result[3].paths[i]]));
  return boxes.every((a, i) => boxes.slice(i + 1).every(b =>
    a[2] <= b[0] + 1e-7 || b[2] <= a[0] + 1e-7 ||
    a[3] <= b[1] + 1e-7 || b[3] <= a[1] + 1e-7));
};
let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks++; };

check(def.key === "isometric_blocks" && def.cat === "gen" && def.group === "geometric", "palette metadata");
check(def.ins.length === 1 && def.ins[0].type === "style", "style input");
check(def.outs.length === 4 && def.outs.every(pin => pin.type === "paths"), "four path outputs");
check(def.params.find(row => row.key === "pattern")?.options.length === 4, "height pattern options descriptor");
check(def.params.find(row => row.key === "shading")?.options.length === 3, "shading options descriptor");
check(def.params.find(row => row.key === "hatchGap")?.showIf({ shading: "Side hatch" }) && !def.params.find(row => row.key === "hatchGap")?.showIf({ shading: "Edges only" }), "hatch slider visibility");
const all = run();
check(all.length === 4 && all[1].paths.length === 20 && all[2].paths.length === 20 && all[3].paths.length === 20, "default occupied cells and faces");
check(all[0].paths.length > all[1].paths.length * 4, "default has visible edge and hatch linework");
check(all.every(set => valid(set)), "all outputs have finite, bounded points and valid pens");
check(all.slice(1).every(set => set.paths.every(q => q.closed && q.pts.length === 4 && area(q) > 0.01)), "face outputs are fillable quads");
check(blocksSeparate(all), "individual isometric blocks do not overlap");
const top = all[1].paths[0].pts;
check(Math.abs((top[1][1] - top[0][1]) / (top[1][0] - top[0][0]) - 1 / Math.sqrt(3)) < 1e-10, "top edges use exact 30° isometric projection");
check(all[2].paths.every(q => Math.abs(q.pts[2][0] - q.pts[1][0]) < 1e-10) && all[3].paths.every(q => Math.abs(q.pts[2][0] - q.pts[1][0]) < 1e-10), "side edges are vertical");
check(sig(run()) === sig(all), "seeded default deterministic");
const edges = run({ shading: "Edges only" });
check(edges[0].paths.length === edges[1].paths.length * 4, "edges-only output draws each prism with one silhouette and three internal edges");
check(edges[0].paths.filter(q => q.closed).length === edges[1].paths.length, "one outer outline per block");
check(edges[0].paths.every(q => q.layer === 0), "edge pen controls linework");
const full = run({ shading: "All faces" });
check(full[0].paths.length > all[0].paths.length && full[0].paths.some(q => q.layer === 3), "All faces shades the top pen");
check(all[0].paths.some(q => q.layer === 1) && all[0].paths.some(q => q.layer === 2), "two side shade pens used");
check(run({ density: 100 })[1].paths.length === 21, "full density fills every cell");
check(run({ density: 5 })[1].paths.length < all[1].paths.length, "density leaves open cells");
check(sig(run({ seed: 34 })) !== sig(all), "seed changes occupancy");
for (const pattern of ["Stairs", "Wave", "Random"]) {
  const out = run({ pattern });
  check(sig(out) !== sig(all) && out.every(set => valid(set)), `${pattern} changes valid heights`);
}
const faceHeight = q => q.pts[2][1] - q.pts[1][1];
check(new Set(run({ levels: 1, density: 100 })[2].paths.map(q => faceHeight(q).toFixed(8))).size === 1, "one level makes equal-height blocks");
check(new Set(run({ levels: 5, density: 100 })[2].paths.map(q => faceHeight(q).toFixed(8))).size > 1, "levels make distinct heights");
check(sig(run({ stagger: false })) !== sig(all) && blocksSeparate(run({ stagger: false })), "stagger changes row layout without overlaps");
check(sig(run({ gap: 0.6 })) !== sig(all) && blocksSeparate(run({ gap: 0.6 })), "cell gap changes spacing");
check(sig(run({ height: 2.5 })) !== sig(all) && run({ height: 2.5 }).every(set => valid(set)), "height changes bounded projection");
check(run({ hatchGap: 0.7 })[0].paths.length > run({ hatchGap: 8 })[0].paths.length, "hatch spacing changes density");
check(run({ edgePen: 8, leftPen: 9, rightPen: 10, topPen: 11, shading: "All faces" })[0].paths.some(q => q.layer === 11), "separate pen controls reach all faces");
const dashed = { kind: "style", mode: "Dashed", dash: 2, gap: 1, vary: 0, phase: 0, seed: 2 };
const styled = run({}, dashed);
check(sig(styled[0]) !== sig(all[0]), "style affects Artwork");
check(all.slice(1).every((face, i) => sig(face) === sig(styled[i + 1])), "raw face regions ignore Style");
const densePage = { W: 5000, H: 5000 };
const dense = run({ cols: 24, rows: 16, density: 100, shading: "All faces", hatchGap: 0.7 }, undefined, densePage);
check(dense[1].paths.length === 384 && dense.every(set => valid(set, densePage)), "maximum grid stays bounded and complete");
check(dense[0].paths.reduce((n, q) => n + q.pts.length, 0) <= 120000, "large page uses bounded hatch work");
check(blocksSeparate(dense), "maximum grid blocks stay separate");
check(run({ margin: 60 }, undefined, { W: 100, H: 100 }).every(set => !set.paths.length), "collapsed margin returns empty");
check(run({}, undefined, { W: Infinity, H: 210 }).every(set => !set.paths.length), "invalid canvas returns empty");
check(def.overlay(defaults, page)[0].kind === "rect" && def.overlay(defaults, {}).length === 0, "margin overlay is safe");
console.log(`${checks} Isometric Blocks checks passed`);
