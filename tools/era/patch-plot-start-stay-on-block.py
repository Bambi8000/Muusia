#!/usr/bin/env python3
"""patch-plot-start-stay-on-block.py

Rewrites PLOT_START so the carriage STAYS on the Z block after measuring, and
the paper origin is declared as a fixed offset WITHOUT travelling there.

Why: the paper origin (machine X42 Y20) is marked physically on the bed with a
pen, so the carriage never needs to drive to it. The operator seats the pen
against the fixed block (at the homing origin) while the carriage waits there;
the first G0 of the job takes the pen to the paper.

PAPER_ZERO reads the CURRENT position, so it cannot be used here (the carriage
is at 0,0 on the block). Instead SET_GCODE_OFFSET is given the paper origin as
absolute values: machine X42 Y20 becomes work 0,0.

New sequence:
  G28                 home; carriage lands on the block at X0 Y0, Z75
  PEN_DOWN            draw pose
  G1 Z20              tip onto the fixed 8 mm block
  Z_PAPER_BLOCK       work Z0 = paper surface
  PEN_UP              lift
  SET_GCODE_OFFSET X42 Y20   paper origin, declared not driven
  (carriage stays on the block; operator seats the pen, places paper, runs job)

Idempotent: SKIPs if applied, MISS-aborts if PLOT_START body differs.
Run from the repo root:

    python3 tools/era/patch-plot-start-stay-on-block.py
"""

import pathlib
import re
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

OLD = '''[gcode_macro PLOT_START]
description: One-button setup - home, measure the fixed Z block, go to paper origin
variable_block_z: 20.0
variable_paper_x: 30.0
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
  M117 Paper zero set. Place paper, then run the job.'''

NEW = '''[gcode_macro PLOT_START]
description: One-button setup - home, measure fixed Z block, stay on block, declare paper origin
variable_block_z: 20.0
variable_paper_x: 42.0
variable_paper_y: 20.0
gcode:
  {% set v = printer["gcode_macro PLOT_START"] %}
  G28
  PEN_DOWN
  G90
  G1 Z{v.block_z} F600
  Z_PAPER_BLOCK
  PEN_UP
  SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}
  M117 Seat pen on block, place paper at X{v.paper_x|int} Y{v.paper_y|int}, run job.'''


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    s = TARGET.read_text()
    if "stay on block" in s or "Seat pen on block" in s:
        print("SKIP  PLOT_START already stays on the block")
        return 0
    n = s.count(OLD)
    print(f"anchor (current PLOT_START body): found {n} (expected 1)")
    if n != 1:
        print("MISS  PLOT_START body differs from expected - nothing written")
        print("---- current PLOT_START ----")
        m = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", s, re.S)
        print(m.group(0) if m else "(not found)")
        return 1
    s = s.replace(OLD, NEW, 1)
    TARGET.write_text(s)
    print("OK    PLOT_START now stays on the block and declares paper origin X42 Y20")

    chk = TARGET.read_text()
    seg = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", chk, re.S).group(0)
    tests = {
        "paper_x 42": "variable_paper_x: 42.0" in seg,
        "paper_y 20": "variable_paper_y: 20.0" in seg,
        "uses SET_GCODE_OFFSET": "SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}" in seg,
        "no PAPER_ZERO call": "PAPER_ZERO" not in seg,
        "no travel to paper": "G1 X{v.paper_x}" not in seg,
        "still measures block": "Z_PAPER_BLOCK" in seg,
        "still homes": "G28" in seg,
        "pen lifted after measure": seg.find("PEN_UP") > seg.find("Z_PAPER_BLOCK"),
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())
    print("\n---- PLOT_START as written ----")
    print(seg)
    print("\nRESULT: ALL OK" if ok else "\nRESULT: FAILURES - do not scp or commit")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
