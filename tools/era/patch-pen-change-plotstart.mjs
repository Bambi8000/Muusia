/* tools/era/patch-pen-change-plotstart.mjs — one-shot.

   Replaces the hand-computed park in M0 with PLOT_START, which already homes,
   drives to the bolted block, seats the coordinate system and prompts for the
   pen. No second implementation of a position that is already calibrated.

   PAUSE_BASE (Klipper's own pause, renamed by mainsail.cfg) saves the drawing
   position without parking, so PLOT_START is free to home and re-zero. RESUME
   restores position and offsets afterwards; every pen is seated against the
   same physical block, so the restored Z offset is the correct one for the new
   pen too.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-pen-change-plotstart.mjs                             */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CFG = ["klipper/printer.cfg", "printer.cfg", "config/printer.cfg"].find((p) => existsSync(p));
if (!CFG) { console.log("MISS  printer.cfg not found"); process.exit(1); }
let cfg = readFileSync(CFG, "utf8");

if (cfg.includes("PLOT_START\n  M117 Seat the new pen")) { console.log("SKIP  already applied"); process.exit(0); }
if (!/^\[gcode_macro PLOT_START\]/m.test(cfg)) { console.log("MISS  [gcode_macro PLOT_START] not found"); process.exit(1); }

const OLD = `  # The block is bolted at machine 0,0 = the block. Work coordinates are shifted
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
const NEW = `  # PLOT_START already homes, drives to the bolted block, re-zeroes and leaves
  # the pen resting on it. That position is calibrated, so it is used as-is
  # rather than recomputed here.
  # PAUSE_BASE is Klipper's own pause (mainsail.cfg renames PAUSE to it): it
  # saves the drawing position without parking, leaving PLOT_START free to home
  # and re-zero. RESUME restores position and offsets afterwards, and since
  # every pen is seated against the same block, the restored Z offset is right
  # for the new pen as well.
  PEN_UP
  RESPOND PREFIX=info MSG="PEN CHANGE: seat the new pen on the block, PEN_UP, then Resume"
  PAUSE_BASE
  PLOT_START
  M117 Seat the new pen on the block, PEN_UP, then Resume
`;
const n = cfg.split(OLD).length - 1;
if (n !== 1) { console.log("MISS  M0 body found " + n + " times, need 1"); process.exit(1); }
cfg = cfg.replace(OLD, NEW);
writeFileSync(CFG, cfg);
console.log("OK    M0 now runs PLOT_START for the pen change");
console.log("DONE  sync to the Pi and RESTART when no plot is running");
