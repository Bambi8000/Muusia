/* Era patch: safe departure from the fixed Z block + Gentle motion limits.
   Files: klipper/printer.cfg, docs/MUUSIA-PLOTTER-MECH-HANDOFF.md.
   Run from the repo root. Anchored exact-string edits: idempotent, MISS-aborts,
   reports per edit. Nothing is written unless every edit on every file lands.

   Why (2026-10-04): a 0.35 mm technical-pen tip broke when a job started on the
   block. The profile startG ran PLOT_HEIGHT (Z down 8 mm) while XY was still
   over the block, the exporter's first SET_SERVO pen-up had no dwell, and the
   first G0 left at 150 mm/s with the tip still on the block. Servo lift is
   ~10 mm, block top is 8.5 mm: a lifted pen at plot height clears the block by
   ~1.5 mm, so "lift then lower on the block" never had a margin. */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CFG = "klipper/printer.cfg";
const MECH = "docs/MUUSIA-PLOTTER-MECH-HANDOFF.md";
for (const f of [CFG, MECH]) {
  if (!existsSync(f)) { console.log("MISS  " + f + " not found - ABORT (run from the repo root)"); process.exit(1); }
}
let cfg = readFileSync(CFG, "utf8");
let mech = readFileSync(MECH, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

/* Idempotence: sentinels that only exist in the finished state. */
if (cfg.includes("[gcode_macro PLOT_GO]") && mech.includes("### 9.3 ")) {
  console.log("SKIP  patch-plot-go already applied (sentinels found)");
  process.exit(0);
}
if (cfg.includes("[gcode_macro PLOT_GO]") !== mech.includes("### 9.3 ")) {
  console.log("MISS  half-applied state: printer.cfg and MECH-HANDOFF disagree - ABORT, inspect by hand");
  process.exit(1);
}

const PLOT_GO_BLOCK = `
# -----------------------------------------------------------------------------
# PLOT_GO - leave the fixed Z block safely. Called from the job's start G-code
# (it REPLACES a bare PLOT_HEIGHT there) and by RESUME via user_resume_macro.
# Order matters: PEN_UP first, with its dwell, so the servo has arrived before
# anything moves; Z up to block top + clear_z; XY at block_f to the apron just
# off the block; only there PLOT_HEIGHT. Harmless when already off the block
# (second job in a row): it re-lifts, re-seats and continues.
# Geometry 2026-10-04: servo lift ~10 mm, block top 8.5 mm - a pen lifted at
# plot height clears the block by only ~1.5 mm, so a job may never lower Z or
# travel fast while over the block (MECH-HANDOFF 9.3).
# -----------------------------------------------------------------------------
[gcode_macro PLOT_GO]
description: Leave the Z block - pen up, Z clear of the block, slow XY to the apron, then plot height
variable_clear_z: 6.0       # work mm above the block top while over the block
variable_apron_x: 10.0      # work XY of the apron, just off the block (block ends ~20 mm before work X0)
variable_apron_y: 0.0
variable_block_f: 600       # mm/min for the moves that may still be over the block
gcode:
  {% if "xyz" not in printer.toolhead.homed_axes %}
    { action_raise_error("PLOT_GO: home first (PLOT_START)") }
  {% endif %}
  {% if printer.gcode_move.homing_origin.z == 0.0 %}
    { action_raise_error("PLOT_GO: no paper-Z offset - run PLOT_START first") }
  {% endif %}
  {% set v = printer["gcode_macro PLOT_GO"] %}
  {% set bh = printer["gcode_macro Z_PAPER_BLOCK"].block_h %}
  PEN_UP
  G90
  G1 Z{bh + v.clear_z} F300
  M400
  G1 X{v.apron_x} Y{v.apron_y} F{v.block_f}
  M400
  PLOT_HEIGHT

# -----------------------------------------------------------------------------
# Gentle motion limits for fragile tips (0.35 mm technical pens). The job's
# start G-code calls GENTLE_ON, its end G-code GENTLE_OFF, and CANCEL_PRINT
# runs GENTLE_OFF through user_cancel_macro - SET_VELOCITY_LIMIT persists until
# restart, so the restore is not optional. Feedrates in the file cap speed;
# these cap acceleration and corner velocity, which is what jerks a needle.
# -----------------------------------------------------------------------------
[gcode_macro GENTLE_ON]
description: Technical-pen motion limits for this job (GENTLE_OFF restores)
variable_velocity: 50
variable_accel: 250
variable_scv: 2.0
gcode:
  {% set v = printer["gcode_macro GENTLE_ON"] %}
  SET_VELOCITY_LIMIT VELOCITY={v.velocity} ACCEL={v.accel} SQUARE_CORNER_VELOCITY={v.scv}
  M117 Gentle: {v.velocity} mm/s, {v.accel} mm/s2, SCV {v.scv}

[gcode_macro GENTLE_OFF]
description: Restore the motion limits from printer.cfg [printer]
gcode:
  {% set c = printer.configfile.settings.printer %}
  SET_VELOCITY_LIMIT VELOCITY={c.max_velocity} ACCEL={c.max_accel} SQUARE_CORNER_VELOCITY={c.square_corner_velocity}
  M117 Motion limits restored: {c.max_velocity} mm/s, {c.max_accel} mm/s2
`;

const cfgEdits = [
  {
    name: "Z_PAPER_BLOCK header: fixed block, servo lift vs block top, incident note",
    old: `# REMOVE THE BLOCK before PEN_UP / starting the job: PEN_UP goes to Z5, which
# is BELOW the block top (9) and would press the pen into the block.
# Block height lives in block_h below — edit if you switch to another block.`,
    neu: `# The block is FIXED (bolted at machine X0 Y0, double-sided tape underneath:
# 8.0 mm block + 0.5 mm tape = block_h 8.5). Servo pen-up is ~10 mm, so a pen
# lifted at plot height clears the block top by only ~1.5 mm - never run
# PLOT_HEIGHT or travel fast while over the block; PLOT_GO leaves it first.
# 2026-10-04: a 0.35 mm technical-pen tip broke exactly that way (startG ran
# PLOT_HEIGHT on the block, first G0 dragged the tip across it; MECH-HANDOFF 9.3).
# Block height lives in block_h below - edit if the block or its tape changes.`,
  },
  {
    name: "block_h 8.0 -> 8.5 (double-sided tape under the block)",
    old: `variable_block_h: 8.0`,
    neu: `variable_block_h: 8.5          # 8.0 mm block + 0.5 mm double-sided tape (2026-10-04)`,
  },
  {
    name: "Z_PAPER_BLOCK M117: no block to remove",
    old: `paper = work Z0. REMOVE BLOCK.`,
    neu: `paper = work Z0. Leave the block with PLOT_GO.`,
  },
  {
    name: "PLOT_START M117: mention PLOT_GO",
    old: `M117 Pen resting on block. Seat pen, run PEN_UP, place paper, plot.`,
    neu: `M117 Pen resting on block. Seat pen, run PEN_UP, place paper, plot (startG runs PLOT_GO).`,
  },
  {
    name: "PLOT_HEIGHT description: never over the block",
    old: `description: Lower Z to plotting height (work Z0 + plot_z) - run after removing the block`,
    neu: `description: Lower Z to plotting height (work Z0 + plot_z) - called by PLOT_GO at the apron, never while over the block`,
  },
  {
    name: "_CLIENT_VARIABLE: resume via PLOT_GO, cancel restores Gentle limits",
    old: `# PLOT_START leaves the pen down on the block for seating, and RESUME restores
# the drawing position with MOVE=1 — without this the pen is dragged back
# across the sheet. mainsail.cfg runs this string just before RESUME_BASE.
variable_user_resume_macro: "PEN_UP"`,
    neu: `# PLOT_START leaves the pen down on the block for seating, and RESUME restores
# the drawing position with MOVE=1. PLOT_GO lifts the pen (with dwell), raises
# Z clear of the block, walks slowly off it and lowers to plot height at the
# apron, so the MOVE=1 restore is a flat move at plot height instead of a
# diagonal from the block top. mainsail.cfg runs this just before RESUME_BASE.
variable_user_resume_macro: "PLOT_GO"
# A cancelled Gentle job never reaches its endG, so CANCEL_PRINT restores the
# motion limits here (mainsail.cfg runs this string inside CANCEL_PRINT).
variable_user_cancel_macro: "GENTLE_OFF"`,
  },
  {
    name: "append PLOT_GO / GENTLE_ON / GENTLE_OFF after PLOT_HEIGHT",
    old: `  G1 Z{printer["gcode_macro PLOT_HEIGHT"].plot_z} F300\n`,
    neu: `  G1 Z{printer["gcode_macro PLOT_HEIGHT"].plot_z} F300\n` + PLOT_GO_BLOCK,
  },
];

const mechEdits = [
  {
    name: "MECH-HANDOFF 9.3: broken technical pen - fixed block departure",
    old: `## 10. Related project docs (software side`,
    neu: `### 9.3 Broken technical pen - leaving the fixed Z block (2026-10-04)

A 0.35 mm technical-pen tip snapped at job start. The block top carried many
colours of streaks from one point (the home position) running ~50 mm to the
block's corner, where a doubled, over-the-edge tape made a small step: every
job start had dragged its pen across the block, and the needle was the first
tip that could not take it. Speed was the trigger, not the cause.

Numbers: servo lift (pen-down to pen-up tip) is **~10 mm**; the block is
8.0 mm plus 0.5 mm of double-sided tape = **8.5 mm** (\`block_h\` corrected from
8.0, which had put work Z0 half a millimetre above the steel). A lifted pen at
plot height clears the block top by **~1.5 mm** - no margin for pen seating,
felt-tip preload or tape. The profile startG was \`G21 / G90 / CLEAR_PAUSE /
PLOT_HEIGHT / RESPOND timelapse\`, so Z dropped 8 mm with the pen still on the
block; then the exporter emitted \`SET_SERVO ... ANGLE=135\` with no dwell and
\`G0 ... F9000\` on the next line, so the gantry accelerated while the servo
was still swinging the spring-loaded pen. At 500 mm/s2 a 300-400 ms swing is
25-40 mm of dragging - the length of the streaks.

Fix, all four parts shipped together:
- **\`PLOT_GO\`** (printer.cfg): PEN_UP with dwell, Z to block top + 6 mm, XY at
  10 mm/s to an apron at work (10, 0), then PLOT_HEIGHT. Called from every
  profile's startG **instead of PLOT_HEIGHT**, and by RESUME
  (\`user_resume_macro\`) so a pen change restores with a flat move at plot
  height rather than a diagonal from the block top. Idempotent when already
  off the block.
- **\`GENTLE_ON\` / \`GENTLE_OFF\`** (printer.cfg): SET_VELOCITY_LIMIT 50 mm/s,
  250 mm/s2, SCV 2 for the job; OFF restores \`[printer]\` values and also runs
  from CANCEL_PRINT (\`user_cancel_macro\`), because SET_VELOCITY_LIMIT persists
  until restart.
- **Muusia** exporter: a settle dwell (\`penDelayUp\`) after the very first
  pen-up, before the first travel; new preset **C - Gentle (technical pen)**
  (F1200 / F3000, settle 300 / 350, GENTLE_ON + PLOT_GO in startG, GENTLE_OFF
  in endG). Existing saved profiles must swap PLOT_HEIGHT -> PLOT_GO by hand
  (profiles live in the patch file, not in the app).
- Block edges stripped of over-the-edge tape: a smooth surface costs a dragged
  tip its coating, a step costs the needle.

Rule from this: **nothing lowers Z and nothing travels fast while over the
block.** The block does not reach the paper area (it ends ~20 mm before work
X0), so the only exposure is the departure - and that is PLOT_GO's job.

## 10. Related project docs (software side`,
  },
];

function apply(label, text, edits) {
  for (const e of edits) {
    const parts = text.split(e.old);
    if (parts.length === 2) { text = parts.join(e.neu); OK(label + ": " + e.name); }
    else if (parts.length === 1) MISS(label + ": " + e.name + " (anchor not found)");
    else MISS(label + ": " + e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
  }
  return text;
}

cfg = apply("printer.cfg", cfg, cfgEdits);
mech = apply("MECH-HANDOFF", mech, mechEdits);

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - nothing written");
  process.exit(1);
}
writeFileSync(CFG, cfg);
writeFileSync(MECH, mech);
console.log("DONE  " + ok + "/" + (cfgEdits.length + mechEdits.length) + " edits applied, " + CFG + " + " + MECH + " written");
