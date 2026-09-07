/* tools/era/patch-pen-change-park.mjs — one-shot.

   Mainsail's PAUSE ends in _TOOLHEAD_PARK_PAUSE_CANCEL, which without a
   [_CLIENT_VARIABLE] block parks at axis_maximum - 5 — on Viivain that is
   X788 Y808, the far corner. A pen change has to happen at X0 Y0 where the
   Z block lives, so the new pen can be re-zeroed against it.

   This also fixes CANCEL_PRINT, which parks through the same helper.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-pen-change-park.mjs                                  */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CFG = ["klipper/printer.cfg", "printer.cfg", "config/printer.cfg"].find((p) => existsSync(p));
if (!CFG) { console.log("MISS  printer.cfg not found"); process.exit(1); }
let cfg = readFileSync(CFG, "utf8");

if (/^\[gcode_macro _CLIENT_VARIABLE\]/m.test(cfg)) {
  console.log("SKIP  [gcode_macro _CLIENT_VARIABLE] already defined in " + CFG);
  process.exit(0);
}
if (!/^\[gcode_macro M0\]/m.test(cfg)) { console.log("MISS  [gcode_macro M0] not found — run patch-m0-pen-change.mjs first"); process.exit(1); }

/* park inside the real travel limits, read from the config rather than assumed */
const xs = cfg.match(/^position_min:\s*(-?[\d.]+)/gm) || [];
if (!xs.length) { console.log("MISS  no position_min found; cannot verify 0,0 is reachable"); process.exit(1); }
const minX = parseFloat(xs[0].split(":")[1]);
if (minX > 0) { console.log("MISS  stepper_x position_min is " + minX + ", so X0 is outside the travel"); process.exit(1); }

const BLOCK = `
[gcode_macro _CLIENT_VARIABLE]
# Read by mainsail.cfg's PAUSE / CANCEL_PRINT helper. Without this block it
# parks at axis_maximum - 5 (X788 Y808 here), which puts the carriage in the
# far corner where the pen cannot be reached or re-zeroed. The Z block sits at
# X0 Y0, so that is where a pen change belongs.
variable_use_custom_pos: True
variable_custom_park_x: 0.0
variable_custom_park_y: 0.0
variable_custom_park_dz: 3.0     # lift before parking; pen clears the paper
variable_speed_hop: 10           # mm/s, ACME screw resonates above ~5 mm/s under load
variable_speed_move: 60          # mm/s, matches max_velocity
variable_retract: 0.0            # no extruder on this machine
variable_unretract: 0.0
variable_park_at_cancel: True    # cancel should also leave the carriage at 0,0
gcode:
`;

const anchor = "\n[gcode_macro M0]";
const parts = cfg.split(anchor);
if (parts.length !== 2) { console.log("MISS  anchor [gcode_macro M0] found " + (parts.length - 1) + " times, need 1"); process.exit(1); }
cfg = parts[0] + BLOCK + anchor + parts[1];

writeFileSync(CFG, cfg);
console.log("OK    [gcode_macro _CLIENT_VARIABLE] added to " + CFG + " (park X0 Y0, dz 3 mm)");
console.log("DONE  sync to the Pi and RESTART when no plot is running");
