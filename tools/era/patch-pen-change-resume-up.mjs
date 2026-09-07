/* tools/era/patch-pen-change-resume-up.mjs — one-shot.

   After a pen change PLOT_START leaves the pen DOWN, resting on the block for
   seating. RESUME then restores the drawing position with MOVE=1, which drags
   the pen across the sheet on the way back.

   mainsail.cfg's RESUME runs {client.user_resume_macro} immediately before
   RESUME_BASE, i.e. before the restore move, so PEN_UP goes there. No macro
   override, no race: the lift is part of the resume sequence itself.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-pen-change-resume-up.mjs                            */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CFG = ["klipper/printer.cfg", "printer.cfg", "config/printer.cfg"].find((p) => existsSync(p));
if (!CFG) { console.log("MISS  printer.cfg not found"); process.exit(1); }
let cfg = readFileSync(CFG, "utf8");

if (cfg.includes("variable_user_resume_macro")) { console.log("SKIP  variable_user_resume_macro already set"); process.exit(0); }
if (!/^\[gcode_macro _CLIENT_VARIABLE\]/m.test(cfg)) { console.log("MISS  [gcode_macro _CLIENT_VARIABLE] not found"); process.exit(1); }
if (!/^\[gcode_macro PEN_UP\]/m.test(cfg)) { console.log("MISS  [gcode_macro PEN_UP] not found"); process.exit(1); }

const edits = [];
const swap = (label, from, to) => {
  const n = cfg.split(from).length - 1;
  if (n !== 1) { console.log("MISS  " + label + " (" + n + " hits, need 1)"); process.exit(1); }
  cfg = cfg.replace(from, to);
  edits.push(label);
};

swap("RESUME lifts the pen before the restore move",
  "variable_unretract: 0.0",
  `variable_unretract: 0.0
# PLOT_START leaves the pen down on the block for seating, and RESUME restores
# the drawing position with MOVE=1 — without this the pen is dragged back
# across the sheet. mainsail.cfg runs this string just before RESUME_BASE.
variable_user_resume_macro: "PEN_UP"`);

/* the operator no longer has to remember the lift */
swap("pen-change prompt drops the manual PEN_UP",
  'RESPOND PREFIX=info MSG="PEN CHANGE: seat the new pen on the block, PEN_UP, then Resume"',
  'RESPOND PREFIX=info MSG="PEN CHANGE: seat the new pen on the block, then Resume"');
swap("M117 prompt drops the manual PEN_UP",
  "  M117 Seat the new pen on the block, PEN_UP, then Resume",
  "  M117 Seat the new pen on the block, then Resume");

writeFileSync(CFG, cfg);
for (const e of edits) console.log("OK    " + e);
console.log("DONE  sync to the Pi and RESTART when no plot is running");
