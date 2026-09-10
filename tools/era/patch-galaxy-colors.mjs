/* Era patch: Galaxy gains an Extended color mode — six pens in one galaxy.
 *
 * New Colors select (def "Classic (3 pens)" — byte-identical to the shipped
 * node, proven below against the PRE-PATCH module). "Extended" unlocks:
 *   - Halo pen: the spherical halo leaves Core pen (old faint stars)
 *   - Inner disc % + Inner disc pen: the disc splits into an inner (older,
 *     yellower) and outer population with a seeded dithered blend zone
 *   - HII regions % + HII pen: arm stars re-tag as star-forming knots,
 *     drawn 1.5x (magenta by default — the astronomical color)
 * All new rng() draws sit behind the Extended check so the Classic random
 * stream never moves.
 *
 * Run from the repo root: node tools/era/patch-galaxy-colors.mjs
 * The script snapshots the CURRENT node's output on a param sweep BEFORE
 * editing, applies the anchored edits, re-imports, and requires the sweep
 * to match byte-for-byte in Classic — a MISS or a mismatch aborts/flags.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FILE = resolve("src/defs/nodes/galaxy.js");
let src = readFileSync(FILE, "utf8");

if (src.includes('"Extended"')) {
  console.log("SKIP  galaxy.js already carries the Extended color mode");
  process.exit(0);
}

/* ---- pre-patch snapshot for the byte-identity oracle ---- */
const CTX = { W: 420, H: 297 };
const SWEEP = [
  {},
  { seed: 7, yaw: 120, pitch: 10 },
  { sparkle: 0, halo: 12, bulge: 40 },
  { shape: "Dash", stars: 2200 },
  { shape: "Point", grow: 1, persp: 0.8 },
  { arms: 6, twist: 4, armw: 0.5, size: 120 },
];
const defsOf = (d) => { const p = {}; for (const q of d.params) p[q.key] = q.def; return p; };
const runSweep = (d) => SWEEP.map((patch) =>
  JSON.stringify(d.compute([undefined], { ...defsOf(d), ...patch }, CTX)));
const before = runSweep((await import(pathToFileURL(FILE).href + "?pre=" + Date.now())).default);

let miss = 0;
const edit = (anchor, replacement, label) => {
  const parts = src.split(anchor);
  if (parts.length !== 2) {
    console.log("MISS  " + label + " (" + (parts.length - 1) + " hits, need exactly 1)");
    miss++;
    return;
  }
  src = parts[0] + replacement + parts[1];
  console.log("OK    " + label);
};

edit(
  "Sparkle pen for a Sparkle % of arm stars (young clusters, drawn\n     slightly larger).",
  "Sparkle pen for a Sparkle % of arm stars (young clusters, drawn\n" +
  "     slightly larger). Colors \"Extended\" splits halo / inner disc / HII\n" +
  "     regions onto three more pens - six pens in one galaxy; Classic stays\n" +
  "     byte-identical to the original three-pen output.",
  "header comment: Extended note"
);

edit(
  'or Point (a minimal 0.1 mm pen poke).",',
  "or Point (a minimal 0.1 mm pen poke). Colors Extended unlocks three more pens: Halo pen separates the spherical halo from the bulge, Inner disc % with Inner disc pen splits the disc into an inner (older, yellower) and outer population across a dithered blend zone, and HII regions % re-tags arm stars as star-forming knots on HII pen, drawn 1.5x - six pens in one galaxy. Classic (3 pens) keeps the original output byte-identical.\",",
  "desc: Extended sentence"
);

edit(
  '    { key: "sparklepen", label: "Sparkle pen", type: "pen", def: 2 },\n',
  '    { key: "sparklepen", label: "Sparkle pen", type: "pen", def: 2 },\n' +
  '    { key: "colors", label: "Colors", type: "select", options: ["Classic (3 pens)", "Extended"], def: "Classic (3 pens)" },\n' +
  '    { key: "halopen", label: "Halo pen", type: "pen", def: 9, showIf: (p) => p.colors === "Extended" },\n' +
  '    { key: "blend", label: "Inner disc %", type: "slider", min: 0, max: 100, step: 1, def: 45, showIf: (p) => p.colors === "Extended" },\n' +
  '    { key: "armpen2", label: "Inner disc pen", type: "pen", def: 10, showIf: (p) => p.colors === "Extended" },\n' +
  '    { key: "hii", label: "HII regions %", type: "slider", min: 0, max: 20, step: 1, def: 7, showIf: (p) => p.colors === "Extended" },\n' +
  '    { key: "hiipen", label: "HII pen", type: "pen", def: 7, showIf: (p) => p.colors === "Extended" },\n',
  "params: Colors select + five Extended params"
);

edit(
  "    const rng = mulberry32(p.seed);",
  "    const rng = mulberry32(p.seed);\n" +
  '    const EXT = p.colors === "Extended";',
  "compute: EXT flag"
);

edit(
  "      const kind = rng() * 100 < p.sparkle ? 2 : 1;\n      pts.push([x, y, z, kind, rn]);",
  "      let kind = rng() * 100 < p.sparkle ? 2 : 1;\n" +
  "      /* Extended populations: HII knots, then the inner/outer disc split\n" +
  "         (dithered boundary) - extra rng() draws only in Extended, so the\n" +
  "         Classic stream never moves */\n" +
  "      if (EXT && kind === 1 && rng() * 100 < p.hii) kind = 3;\n" +
  "      if (EXT && kind === 1 && p.blend > 0 && rn + (rng() - 0.5) * 0.16 < p.blend / 100) kind = 4;\n" +
  "      pts.push([x, y, z, kind, rn]);",
  "compute: disc star Extended kinds"
);

edit(
  "pts.push([rr * Math.sin(ph) * Math.cos(th), rr * Math.sin(ph) * Math.sin(th), rr * Math.cos(ph), 0, rr]);",
  "pts.push([rr * Math.sin(ph) * Math.cos(th), rr * Math.sin(ph) * Math.sin(th), rr * Math.cos(ph), EXT ? 5 : 0, rr]);",
  "compute: halo kind in Extended"
);

edit(
  "    const penOf = [Math.round(p.corepen), Math.round(p.armpen), Math.round(p.sparklepen)];",
  "    const penOf = [Math.round(p.corepen), Math.round(p.armpen), Math.round(p.sparklepen),\n" +
  "      Math.round(p.hiipen == null ? 7 : p.hiipen), Math.round(p.armpen2 == null ? 10 : p.armpen2),\n" +
  "      Math.round(p.halopen == null ? 9 : p.halopen)];",
  "compute: pen table for kinds 3-5"
);

edit(
  "      if (kind === 2) r *= 1.35;",
  "      if (kind === 2) r *= 1.35;\n      if (kind === 3) r *= 1.5;",
  "compute: HII knot size boost"
);

if (miss) {
  console.log("ABORT " + miss + " missed anchor(s) - nothing written");
  process.exit(1);
}
writeFileSync(FILE, src);

/* ---- post-patch checks ---- */
let bad = 0;
const chk = (cond, msg) => { console.log((cond ? "OK    " : "FAIL  ") + msg); if (!cond) bad++; };
const def = (await import(pathToFileURL(FILE).href + "?post=" + Date.now())).default;
const after = runSweep(def);
chk(after.length === before.length && after.every((s, i) => s === before[i]),
  "Classic byte-identical to the pre-patch node across " + SWEEP.length + " param sets");

const p0 = defsOf(def);
const pE = { ...p0, colors: "Extended", halo: 8 };
const layers = (r) => [...new Set(r.paths.map((q) => q.layer))].sort((a, b) => a - b);
const rE = def.compute([undefined], pE, CTX);
chk([7, 9, 10].every((pen) => layers(rE).includes(pen)),
  "Extended defaults draw HII (7), Halo (9) and Inner disc (10) pens [" + layers(rE) + "]");
chk(JSON.stringify(def.compute([undefined], pE, CTX)) === JSON.stringify(rE), "Extended deterministic");
const rB0 = def.compute([undefined], { ...pE, blend: 0 }, CTX);
chk(!layers(rB0).includes(10), "Inner disc % = 0 -> no inner-disc pen");
const rH0 = def.compute([undefined], { ...pE, hii: 0 }, CTX);
chk(!layers(rH0).includes(7) || p0.sparklepen === 7, "HII % = 0 -> no HII pen");
chk(JSON.stringify(def.compute([undefined], { ...pE, halopen: 3, hiipen: 5, armpen2: 6 }, CTX)) !==
    JSON.stringify(rE), "new pen params live");
const finite = (r) => r.paths.every((q) => q.pts.every((pt) => pt.every(Number.isFinite)));
chk(finite(rE) && finite(def.compute([undefined], { ...pE, blend: 100, hii: 20, stars: 4000 }, CTX)),
  "Extended extremes finite");

console.log(bad === 0 ? "DONE  galaxy.js patched, Classic proven byte-identical" : "DONE WITH " + bad + " FAILURES");
process.exit(bad === 0 ? 0 : 1);
