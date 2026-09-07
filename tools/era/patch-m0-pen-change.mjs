/* tools/era/patch-m0-pen-change.mjs — one-shot: add the M0 pen-change macro.

   Muusia's exporter writes `M0 ; CHANGE PEN -> n` between pen groups, but M0 is
   not a Klipper command and is not defined by mainsail.cfg, so a multi-pen plot
   aborts with "Unknown command: M0" after the first pen. This defines it.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-m0-pen-change.mjs                                    */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CANDIDATES = ["klipper/printer.cfg", "printer.cfg", "config/printer.cfg"];
const CFG = CANDIDATES.find((p) => existsSync(p));
if (!CFG) { console.log("MISS  printer.cfg not found in " + CANDIDATES.join(", ")); process.exit(1); }

let cfg = readFileSync(CFG, "utf8");

if (/^\[gcode_macro M0\]/m.test(cfg)) { console.log("SKIP  [gcode_macro M0] already defined in " + CFG); process.exit(0); }

/* PAUSE must exist, or M0 would pause into nothing */
if (!/rename_existing:\s*PAUSE_BASE/.test(cfg) && !/\[pause_resume\]/.test(cfg) && !/\[include mainsail\.cfg\]/.test(cfg)) {
  console.log("MISS  no [pause_resume] and no mainsail.cfg include — PAUSE is not available");
  process.exit(1);
}
if (!/^\[gcode_macro PEN_UP\]/m.test(cfg)) { console.log("MISS  [gcode_macro PEN_UP] not found"); process.exit(1); }

const MACRO = `
[gcode_macro M0]
# Muusia writes "M0 ; CHANGE PEN -> n" between pen groups. M0 is not a Klipper
# command and mainsail.cfg does not define it, so without this macro a
# multi-pen plot stops with "Unknown command: M0" after the first pen.
# PEN_UP is belt-and-braces: the exporter already lifts before the pause, but a
# felt tip left resting on paper blots within seconds.
description: Operator pause for a pen change
gcode:
  PEN_UP
  M117 PEN CHANGE - swap pen, then Resume
  RESPOND PREFIX=info MSG="PEN CHANGE: swap the pen, then press Resume"
  PAUSE

[gcode_macro M1]
description: Alias of M0 (some senders emit M1 for an operator pause)
gcode:
  M0
`;

/* insert after the PEN_DOWN block so the pen macros stay together */
const anchor = "\n[gcode_macro _PEN_VARS]";
const parts = cfg.split(anchor);
if (parts.length !== 2) { console.log("MISS  anchor [gcode_macro _PEN_VARS] found " + (parts.length - 1) + " times, need 1"); process.exit(1); }
cfg = parts[0] + MACRO + anchor + parts[1];

writeFileSync(CFG, cfg);
console.log("OK    [gcode_macro M0] + M1 alias added to " + CFG);
console.log("DONE  sync to the Pi and RESTART when no plot is running");
