#!/usr/bin/env python3
"""patch-plot-start-stay-pendown.py

The operator seats/changes the pen with the servo DOWN, tip near the block, so
they can see it reach the block top. The macro was lifting the pen (PEN_UP)
right after measuring, which made that impossible.

Change: after Z_PAPER_BLOCK, keep the servo DOWN and leave the tip a few mm
above the block (block_z + lift_after) so the operator can seat the pen against
it. The paper-origin offset is still declared. The operator lifts the pen
themselves (PEN_UP / button) once the pen is set and paper is placed.

Removes the PEN_UP that followed Z_PAPER_BLOCK; adds a small clearance move
that stays in the pen-down pose.

Idempotent: SKIPs if applied, MISS-aborts if the body differs.
Run from the repo root:

    python3 tools/era/patch-plot-start-stay-pendown.py
"""

import pathlib
import re
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

OLD = '''  G1 Z{v.block_z} F600
  Z_PAPER_BLOCK
  PEN_UP
  SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}
  M117 Seat pen on block, place paper at X{v.paper_x|int} Y{v.paper_y|int}, run job.'''

NEW = '''  G1 Z{v.block_z} F600
  Z_PAPER_BLOCK
  SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}
  G1 Z{v.block_z + v.lift_after} F600
  M117 Pen DOWN on block. Seat the pen, PEN_UP, place paper, run job.'''

# also add the lift_after variable next to the others
OLD_VARS = '''variable_block_z: 19.0
variable_paper_x: 42.0
variable_paper_y: 20.0'''

NEW_VARS = '''variable_block_z: 19.0
variable_lift_after: 3.0
variable_paper_x: 42.0
variable_paper_y: 20.0'''


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    s = TARGET.read_text()
    if "variable_lift_after" in s:
        print("SKIP  PLOT_START already stays pen-down")
        return 0
    for name, old in (("gcode body", OLD), ("vars", OLD_VARS)):
        n = s.count(old)
        print(f"anchor '{name}': found {n} (expected 1)")
        if n != 1:
            print("MISS  body differs - nothing written")
            m = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", s, re.S)
            print(m.group(0) if m else "(not found)")
            return 1
    s = s.replace(OLD_VARS, NEW_VARS, 1).replace(OLD, NEW, 1)
    TARGET.write_text(s)
    print("OK    PLOT_START stays pen-down above the block; PEN_UP removed")

    chk = TARGET.read_text()
    seg = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", chk, re.S).group(0)
    tests = {
        "lift_after var 3.0": "variable_lift_after: 3.0" in seg,
        "no PEN_UP in macro": "PEN_UP" not in seg,
        "clearance move present": "G1 Z{v.block_z + v.lift_after} F600" in seg,
        "still measures": "Z_PAPER_BLOCK" in seg,
        "paper offset present": "SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}" in seg,
        "offset reset still there": "SET_GCODE_OFFSET X=0 Y=0 Z=0" in seg,
        "clearance after offset": seg.find("block_z + v.lift_after") > seg.find("X={v.paper_x}"),
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
