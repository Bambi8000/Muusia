/* tools/era/patch-pen-change-height.mjs — one-shot.

   A pen change needs the carriage at the seating height, not parked at the top
   of Z travel. PLOT_START already establishes that height: the pen tip touches
   the top of the setup block, which Z_PAPER_BLOCK declares as work Z = block_h.
   M0 now goes there with the pen down, so a new pen is seated mechanically
   against the block instead of re-zeroed in software — which also sidesteps
   RESUME's RESTORE_GCODE_STATE wiping any offset set during the pause.

   block_h is read from Z_PAPER_BLOCK at runtime: one number, one place.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-pen-change-height.mjs                                */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CFG = ["klipper/printer.cfg", "printer.cfg", "config/printer.cfg"].find((p) => existsSync(p));
if (!CFG) { console.log("MISS  printer.cfg not found"); process.exit(1); }
let cfg = readFileSync(CFG, "utf8");

if (cfg.includes("Seat the new pen")) { console.log("SKIP  already applied"); process.exit(0); }

const bh = cfg.match(/^variable_block_h:\s*([\d.]+)/m);
if (!bh) { console.log("MISS  variable_block_h not found in Z_PAPER_BLOCK"); process.exit(1); }
const blockH = parseFloat(bh[1]);
console.log("      block_h = " + blockH + " mm (read from Z_PAPER_BLOCK)");

const edits = [];
const swap = (label, from, to) => {
  const n = cfg.split(from).length - 1;
  if (n !== 1) { console.log("MISS  " + label + " (" + n + " hits, need 1)"); process.exit(1); }
  cfg = cfg.replace(from, to);
  edits.push(label);
};

/* the park travel must clear the block, not just the paper */
swap("park hop clears the block",
  "variable_custom_park_dz: 3.0     # lift before parking; pen clears the paper",
  "variable_custom_park_dz: " + (blockH + 4).toFixed(1) + "    # clears the " + blockH + " mm setup block on the way to the park");

/* land on the seating height with the pen down */
swap("M0 drops to the seating height",
  '  RESPOND PREFIX=info MSG="PEN CHANGE: swap the pen, then press Resume"\n  PAUSE\n',
  '  RESPOND PREFIX=info MSG="PEN CHANGE: place the block, seat the new pen, PEN_UP, then Resume"\n'
  + "  PAUSE\n"
  + "  # PAUSE has parked at work 0,0 (the block position) and saved the drawing\n"
  + "  # position; RESUME restores it, so nothing here needs undoing.\n"
  + "  G90\n"
  + '  G1 Z{printer["gcode_macro Z_PAPER_BLOCK"].block_h} F600\n'
  + "  PEN_DOWN\n"
  + "  M117 Seat the new pen on the block, PEN_UP, then Resume\n");

writeFileSync(CFG, cfg);
for (const e of edits) console.log("OK    " + e);
console.log("DONE  sync to the Pi and RESTART when no plot is running");
