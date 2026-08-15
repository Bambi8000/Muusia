/* validate-sheets.mjs — checks the Sheets node (frame-domain sheet selector).
 *
 * Uses the REAL src/defs/helpers.js (never a re-implementation). Auto-switch:
 * prefers the baked src/defs/nodes/sheets.js when present, otherwise
 * evaluates nodes-lab/sheets.plotternode.js — bake before validating a
 * re-opened lab file. Run from the repo root:
 *   node tools/validate-sheets.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { Pin, EMPTY } from "../src/defs/helpers.js";

let checks = 0, fails = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.log(`FAIL  ${msg}`); }
};

const BAKED = "src/defs/nodes/sheets.js";
const LAB = "nodes-lab/sheets.plotternode.js";
let def, sourceName;
if (existsSync(BAKED)) {
  def = (await import("../" + BAKED)).default;
  sourceName = BAKED + " (baked)";
} else if (existsSync(LAB)) {
  const text = readFileSync(LAB, "utf8");
  /* parens like the engine's evaluateNodeDef: prevents ASI when the lab
     file opens with a multi-line header comment */
  def = new Function("Pin", "EMPTY", `"use strict"; return (${text});`)(Pin, EMPTY);
  sourceName = LAB + " (lab)";
} else {
  console.log("FAIL  neither baked nor lab sheets file found");
  process.exit(1);
}
console.log(`using ${sourceName}`);

/* --- contract --- */
ok(def.key === "sheets", "key is 'sheets'");
ok(def.cat === "duo", "cat is duo (Combiners)");
ok(typeof def.ins === "function", "dynamic ins (Merge-shaped)");
ok(typeof def.compute === "function", "compute present");
const mkNode = (count) => ({ params: { count } });
ok(def.ins(mkNode(4)).length === 4 && def.ins(mkNode(12)).length === 12, "pin count follows the count param");
ok(def.ins(null).length === 4, "no node -> default pin count");
ok(def.ins(mkNode(4))[0].label === "sheet 1", "pins labelled sheet N");
const outs = typeof def.outs === "function" ? def.outs(null) : def.outs;
ok(outs.length === 1 && outs[0].type === "paths", "single paths output");
ok(def.params.length === 3, "three params (count, select, manual)");
const sel = def.params.find((p) => p.key === "select");
ok(sel && sel.type === "select" && Array.isArray(sel.options) && sel.options.join(",") === "Frame,Manual", "select param uses the options field (not opts) with Frame/Manual");
const cnt = def.params.find((p) => p.key === "count");
ok(cnt && cnt.min === 2 && cnt.max === 12, "count slider 2..12 (Stack View MAX_SHEETS)");

/* --- selection logic --- */
const mkPS = (tag) => ({ paths: [{ pts: [[tag, 0], [tag, 10]], closed: false, layer: tag % 12 }] });
const ins4 = [mkPS(0), mkPS(1), mkPS(2), mkPS(3)];
const P = { count: 4, select: "Frame", manual: 1 };
const pick = (r) => (r.paths && r.paths.length ? r.paths[0].pts[0][0] : -1);

ok(pick(def.compute(ins4, P, { frameIdx: 0, frameCount: 4 })) === 0, "frame 0 -> input 1");
ok(pick(def.compute(ins4, P, { frameIdx: 2, frameCount: 4 })) === 2, "frame 2 -> input 3");
ok(pick(def.compute(ins4, P, { frameIdx: 3, frameCount: 4 })) === 3, "frame 3 -> input 4");
ok(pick(def.compute(ins4, P, { frameIdx: 9, frameCount: 12 })) === 3, "frame beyond pins clamps to the last sheet");
ok(pick(def.compute(ins4, P, { frameIdx: -2, frameCount: 4 })) === 0, "negative frame clamps to the first sheet");
ok(pick(def.compute(ins4, P, {})) === 0, "missing frameIdx -> sheet 1 (no throw)");
ok(pick(def.compute(ins4, P, null)) === 0, "null ctx tolerated");

/* manual mode */
ok(pick(def.compute(ins4, { ...P, select: "Manual", manual: 3 }, { frameIdx: 0, frameCount: 4 })) === 2,
  "Manual 3 -> input 3 regardless of frame");
ok(pick(def.compute(ins4, { ...P, select: "Manual", manual: 99 }, { frameIdx: 0 })) === 3,
  "Manual beyond count clamps to the last sheet");

/* unwired input -> EMPTY */
const gap = [mkPS(0), undefined, mkPS(2), undefined];
const rGap = def.compute(gap, P, { frameIdx: 1, frameCount: 4 });
ok(rGap && Array.isArray(rGap.paths) && rGap.paths.length === 0, "unwired input -> empty sheet");

/* passthrough integrity: full pen colors preserved, no mutation */
const multi = { paths: [
  { pts: [[1, 1], [2, 2]], closed: false, layer: 3 },
  { pts: [[3, 3], [4, 4], [5, 5]], closed: true, layer: 7 },
] };
const frozen = JSON.stringify(multi);
const rM = def.compute([multi, mkPS(1)], { count: 2, select: "Frame", manual: 1 }, { frameIdx: 0, frameCount: 2 });
ok(JSON.stringify(multi) === frozen, "compute does not mutate its input");
ok(rM.paths.length === 2 && rM.paths[0].layer === 3 && rM.paths[1].layer === 7, "multi-pen sheet passes through with pens intact");
ok(rM.paths[1].closed === true, "closed flag preserved");

/* count clamp + determinism */
ok(pick(def.compute(ins4, { count: 99, select: "Frame", manual: 1 }, { frameIdx: 3 })) === 3, "count clamps to 12 without breaking selection");
const d1 = JSON.stringify(def.compute(ins4, P, { frameIdx: 2, frameCount: 4 }));
const d2 = JSON.stringify(def.compute(ins4, P, { frameIdx: 2, frameCount: 4 }));
ok(d1 === d2, "deterministic (double run equal)");

console.log(fails === 0 ? `sheets: ALL OK (${checks} checks)` : `sheets: ${fails}/${checks} FAILED`);
process.exit(fails === 0 ? 0 : 1);
