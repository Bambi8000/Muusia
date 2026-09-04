#!/usr/bin/env python3
"""patch-plot-start-macro.py

Adds PLOT_START, a single-button plot-setup macro for the fixed-block workflow:

  - The 8 mm Z reference block is permanently mounted at the homing origin
    (machine X0 Y0). The pen tip touches its top at machine Z20 (measured,
    constant because the block never moves - only a pen change alters it, and
    the pen is seated to reach the block, which is the human "measurement").
  - The paper origin is at machine X20 Y20 (a margin in from the block).

Sequence (safe order - the pen only travels in XY while UP):
  G28                       home; carriage lands on the block at X0 Y0, Z75
  PEN_DOWN                  servo to draw pose
  G1 Z20                    lower tip onto the fixed block (constant height)
  Z_PAPER_BLOCK             declare work Z0 = paper surface (block_h below tip)
  PEN_UP                    lift
  G1 X20 Y20                move to the paper origin (pen up, safe)
  PAPER_ZERO                declare work XY origin here
  pause for the operator to place paper, then run the job

Idempotent: SKIPs if present, MISS-aborts if the insertion anchor is missing.
Run from the repo root:

    python3 tools/era/patch-plot-start-macro.py
"""

import pathlib
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

# Insert right after the PLOT_HEIGHT macro block (known to exist).
ANCHOR = '''[gcode_macro PLOT_HEIGHT]'''

MACRO = '''[gcode_macro PLOT_START]
description: One-button setup - home, measure the fixed Z block, go to paper origin
variable_block_z: 20.0
variable_paper_x: 20.0
variable_paper_y: 20.0
gcode:
  {% set v = printer["gcode_macro PLOT_START"] %}
  G28
  PEN_DOWN
  G90
  G1 Z{v.block_z} F600
  Z_PAPER_BLOCK
  PEN_UP
  G1 X{v.paper_x} Y{v.paper_y} F6000
  PAPER_ZERO
  M117 Paper zero set. Place paper, then run the job.

[gcode_macro PLOT_HEIGHT]'''


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    s = TARGET.read_text()
    if "[gcode_macro PLOT_START]" in s:
        print("SKIP  PLOT_START already present")
        return 0
    n = s.count(ANCHOR)
    print(f"anchor '[gcode_macro PLOT_HEIGHT]': found {n} (expected 1)")
    if n != 1:
        print("MISS  anchor not unique - nothing written")
        return 1
    s = s.replace(ANCHOR, MACRO, 1)
    TARGET.write_text(s)
    print("OK    PLOT_START inserted before PLOT_HEIGHT")

    chk = TARGET.read_text()
    tests = {
        "PLOT_START present": "[gcode_macro PLOT_START]" in chk,
        "block_z 20": "variable_block_z: 20.0" in chk,
        "paper 20/20": "variable_paper_x: 20.0" in chk and "variable_paper_y: 20.0" in chk,
        "homes first": chk.split("[gcode_macro PLOT_START]")[1].lstrip().find("G28") < 200,
        "Z_PAPER_BLOCK called": "Z_PAPER_BLOCK" in chk.split("[gcode_macro PLOT_START]")[1].split("[gcode_macro PLOT_HEIGHT]")[0],
        "PAPER_ZERO called": "PAPER_ZERO" in chk.split("[gcode_macro PLOT_START]")[1].split("[gcode_macro PLOT_HEIGHT]")[0],
        "PLOT_HEIGHT still there": chk.count("[gcode_macro PLOT_HEIGHT]") == 1,
        "no jinja comments": "{#" not in chk,
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())
    print("\n---- PLOT_START as written ----")
    seg = chk.split("[gcode_macro PLOT_START]")[1].split("[gcode_macro PLOT_HEIGHT]")[0]
    print("[gcode_macro PLOT_START]" + seg)
    print("RESULT: ALL OK" if ok else "RESULT: FAILURES - do not scp or commit")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
