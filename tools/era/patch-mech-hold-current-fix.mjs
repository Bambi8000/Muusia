#!/usr/bin/env node
/*
 * patch-mech-hold-current-fix.mjs — the 1.0 A version of patch-mech-hold-current
 * was applied before the decision moved to 0.7 A; cfg is 0.7, docs said 1.0.
 * Aligns §9 table row and §9.2 text with the cfg. Anchored, MISS aborts, SKIP
 * if applied. One-shot.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const MECH = "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md";
for (const f of [MECH, "klipper/printer.cfg"]) if (!existsSync(f)) { console.log(`MISS  ${f} not found — run from the repo root`); process.exit(1); }
const holds = (readFileSync("klipper/printer.cfg", "utf8").match(/^hold_current:\s*([\d.]+)/gm) || []).map((l) => l.split(/:\s*/)[1]);
if (holds.length !== 3 || holds.some((h) => h !== "0.7")) { console.log(`MISS  klipper/printer.cfg hold_current lines: ${JSON.stringify(holds)}; expected three 0.7`); process.exit(1); }
let mech = readFileSync(MECH, "utf8");
const edits = [
  { name: "§9 table row 1.0 -> 0.7",
    from: "| `hold_current` X/Y/Y1 | **1.0 A** | printer.cfg — spreadCycle standstill hiss at 2.0 A hold; 0.7 tested silent, 1.0 keeps holding torque for pen changes (§9.2) |",
    to:   "| `hold_current` X/Y/Y1 | **0.7 A** | printer.cfg — spreadCycle standstill hiss at 2.0 A hold; 0.7 tested silent (§9.2) |" },
  { name: "§9.2 text 1.0 -> 0.7",
    from: "`hold_current: 1.0` on X/Y/Y1: quiet enough, less idle heat, and still enough\nholding torque that pushing on the carriage during a pen change does not\nshift the position. Not applied:",
    to:   "`hold_current: 0.7` on X/Y/Y1: silent, less idle heat. Holding torque at 0.7 A\nis lower — if a plot ever resumes misaligned after an M0 pen change, suspect\nthe carriage having been pushed during the change and raise hold_current to\n1.0 before anything else. Not applied:" },
];
const pending = edits.filter((e) => mech.includes(e.from));
if (!pending.length) { console.log("SKIP  docs already say 0.7"); console.log("DONE  (nothing to do)"); process.exit(0); }
let miss = 0;
for (const e of pending) { const n = mech.split(e.from).length - 1; if (n !== 1) { console.log(`MISS  ${e.name} (${n} hits)`); miss++; } }
if (miss) { console.log(`ABORT ${miss} anchor(s) missed — nothing written`); process.exit(1); }
for (const e of pending) { mech = mech.replace(e.from, e.to); console.log(`OK    ${e.name}`); }
writeFileSync(MECH, mech);
console.log(`DONE  ${MECH}`);
