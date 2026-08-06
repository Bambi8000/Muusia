/* validate-splitpens.mjs - Split Pens router.
   Auto-switches lab -> baked. Run from repo root: node tools/validate-splitpens.mjs */
import fs from "node:fs";
import * as H from "../src/defs/helpers.js";

let N, from;
const bakedUrl = new URL("../src/defs/nodes/splitpens.js", import.meta.url);
if (fs.existsSync(bakedUrl)) {
  N = (await import(bakedUrl.href)).default;
  from = "baked";
} else {
  const src = fs.readFileSync(new URL("../nodes-lab/splitpens.plotternode.js", import.meta.url), "utf8");
  const keys = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  N = new Function(...keys, '"use strict"; return (' + src + ");")(...keys.map((k) => H[k]));
  from = "lab";
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok  " + m); } else { fail++; console.log("  FAIL " + m); } };

const path = (layer, x) => ({ pts: [[x, 0], [x + 5, 5], [x + 10, 0]], closed: layer % 2 === 0, layer });
const input = { paths: [path(0, 0), path(3, 10), path(3, 20), path(11, 30), path(5, 40), path(0, 50)] };

console.log("[" + from + "] split pens");
{
  const outs = N.compute([input], { preview: "All" });
  ok(Array.isArray(outs) && outs.length === H.PENS.length + 1, "preview tap + one output per pen (" + outs.length + ")");
  const R = (i) => outs[i + 1]; /* routing outputs start at pin 1 */
  ok(R(0).paths.length === 2 && R(3).paths.length === 2 && R(11).paths.length === 1 && R(5).paths.length === 1,
    "paths land on their pens (0:2, 3:2, 11:1, 5:1)");
  const used = new Set([0, 3, 5, 11]);
  ok(H.PENS.every((_, i) => used.has(i) || (R(i).paths && R(i).paths.length === 0)), "unused pens emit empty");
  const total = outs.slice(1).reduce((s, o) => s + o.paths.length, 0);
  ok(total === input.paths.length, "partition is complete - nothing lost, nothing duplicated (" + total + ")");
  ok(R(3).paths[0].pts[0][0] === 10 && R(3).paths[1].pts[0][0] === 20, "input order preserved within a pen");
  ok(JSON.stringify(R(0).paths[0]) === JSON.stringify(input.paths[0]), "geometry, closed flag and layer pass through untouched");
  ok(JSON.stringify(N.compute([input], { preview: "All" })) === JSON.stringify(outs), "deterministic");
  ok(outs[0].paths.length === input.paths.length, "Preview=All taps the whole input");
  const solo = N.compute([input], { preview: H.PENS[3].name });
  ok(solo[0].paths.length === 2 && solo[0].paths[0].pts[0][0] === 10, "Preview=" + H.PENS[3].name + " taps only that pen");
  ok(JSON.stringify(solo.slice(1)) === JSON.stringify(outs.slice(1)), "the selector NEVER changes the routing outputs");
  const unk = N.compute([input], { preview: "Nonexistent" });
  ok(unk[0].paths.length === input.paths.length, "unknown selection falls back to All");
}

console.log("edge cases");
{
  const w0 = N.compute([{ paths: [path(13, 0), path(-1, 10), path(0.6, 20)] }], { preview: "All" });
  const w = w0.slice(1);
  ok(w[1].paths.length === 2, "layer 13 and rounded 0.6 both wrap to pen 1");
  ok(w[11].paths.length === 1, "layer -1 wraps to pen 11");
  ok(w[1].paths[0].pts[0][0] === 0 && w[11].paths[0].pts[0][0] === 10, "wrap targets hold the right paths");
  const rounded = N.compute([{ paths: [path(0.6, 20)] }], { preview: "All" }).slice(1);
  ok(rounded[1].paths.length === 1, "fractional layer rounds to nearest pen");
  const empty = N.compute([undefined], { preview: "All" });
  ok(empty.length === H.PENS.length + 1 && empty.every((o) => o.paths.length === 0), "no input -> all outputs empty");
}

console.log("\n" + pass + " passed, " + fail + " failed (" + from + " version)");
if (fail > 0) process.exitCode = 1;
