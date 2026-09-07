/* tools/era/patch-pen-change-block.mjs — one-shot.

   The Z block is bolted to the bed at MACHINE 0,0. Work 0,0 is the paper
   origin, so the block's work coordinate is -offset, which changes every time
   PAPER_ZERO moves the origin. A static custom_park_x/y is therefore right
   only for one particular offset and silently wrong for every other.

   So M0 parks itself: PAUSE_BASE (Klipper's own pause, which mainsail.cfg
   renames) saves the drawing position without parking, then M0 moves to
   machine 0,0 computed from the live gcode offset and drops to the block top.
   RESUME restores the drawing position exactly as before.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-pen-change-block.mjs                                 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CFG = ["klipper/printer.cfg", "printer.cfg", "config/printer.cfg"].find((p) => existsSync(p));
if (!CFG) { console.log("MISS  printer.cfg not found"); process.exit(1); }
let cfg = readFileSync(CFG, "utf8");

if (cfg.includes("PAUSE_BASE") && cfg.includes("machine 0,0 = the block")) { console.log("SKIP  already applied"); process.exit(0); }

const bh = cfg.match(/^variable_block_h:\s*([\d.]+)/m);
if (!bh) { console.log("MISS  variable_block_h not found in Z_PAPER_BLOCK"); process.exit(1); }
console.log("      block_h = " + parseFloat(bh[1]) + " mm (read from Z_PAPER_BLOCK)");
if (!/\[include mainsail\.cfg\]/.test(cfg)) { console.log("MISS  mainsail.cfg is not included; PAUSE_BASE may not exist"); process.exit(1); }

const OLD = `  PEN_UP
  M117 PEN CHANGE - swap pen, then Resume
  RESPOND PREFIX=info MSG="PEN CHANGE: place the block, seat the new pen, PEN_UP, then Resume"
  PAUSE
  # PAUSE has parked at work 0,0 (the block position) and saved the drawing
  # position; RESUME restores it, so nothing here needs undoing.
  G90
  G1 Z{printer["gcode_macro Z_PAPER_BLOCK"].block_h} F600
  PEN_DOWN
  M117 Seat the new pen on the block, PEN_UP, then Resume
`;
const NEW = `  # The block is bolted at machine 0,0 = the block. Work coordinates are shifted
  # by the paper origin, so the target is -offset, computed live: a hardcoded
  # work coordinate would break the next time PAPER_ZERO moves the origin.
  # PAUSE_BASE is Klipper's own pause (mainsail.cfg renames PAUSE to it): it
  # saves the drawing position WITHOUT parking, so this macro can park itself.
  {% set o = printer.gcode_move.homing_origin %}
  {% set bh = printer["gcode_macro Z_PAPER_BLOCK"].block_h %}
  PEN_UP
  RESPOND PREFIX=info MSG="PEN CHANGE: seat the new pen on the block, PEN_UP, then Resume"
  PAUSE_BASE
  G90
  G1 Z{bh + 4} F600
  G1 X{-o.x} Y{-o.y} F3600
  G1 Z{bh} F600
  PEN_DOWN
  M117 Seat the pen on the block, PEN_UP, then Resume
`;
const n = cfg.split(OLD).length - 1;
if (n !== 1) { console.log("MISS  M0 body found " + n + " times, need 1 — run patch-pen-change-height.mjs first"); process.exit(1); }
cfg = cfg.replace(OLD, NEW);

/* mainsail's park is no longer used by M0, but CANCEL_PRINT still calls it */
cfg = cfg.replace("variable_park_at_cancel: True    # cancel should also leave the carriage at 0,0",
  "variable_park_at_cancel: True    # cancel parks at work 0,0; M0 parks itself at machine 0,0");

writeFileSync(CFG, cfg);
console.log("OK    M0 now parks itself at machine 0,0 via PAUSE_BASE");
console.log("DONE  sync to the Pi and RESTART when no plot is running");
