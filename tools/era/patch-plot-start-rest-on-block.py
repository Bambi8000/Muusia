#!/usr/bin/env python3
"""patch-plot-start-rest-on-block.py

The operator wants the pen to REST on the block (pen down, tip touching, at the
measured height) and stay there until they seat the pen and run PEN_UP
themselves. The previous "lift 3 mm" move computed its target in the work
frame AFTER Z_PAPER_BLOCK set a Z offset (11), so G1 Z22 became machine Z33 -
far too high.

Fix: remove the clearance move entirely. After measuring, keep the pen down on
the block (machine Z = block_z) and just declare the paper origin. The tip
stays touching the block; the operator seats the pen and lifts it manually.

Removes the "G1 Z{block_z + lift_after}" line and the now-unused lift_after
variable.

Idempotent: SKIPs if applied, MISS-aborts if the body differs.
Run from the repo root:

    python3 tools/era/patch-plot-start-rest-on-block.py
"""

import pathlib
import re
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

OLD_VARS = '''variable_block_z: 19.0
variable_lift_after: 3.0
variable_paper_x: 42.0
variable_paper_y: 20.0'''

NEW_VARS = '''variable_block_z: 19.0
variable_paper_x: 42.0
variable_paper_y: 20.0'''

OLD_BODY = '''  Z_PAPER_BLOCK
  SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}
  G1 Z{v.block_z + v.lift_after} F600
  M117 Pen DOWN on block. Seat the pen, PEN_UP, place paper, run job.'''

NEW_BODY = '''  Z_PAPER_BLOCK
  SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}
  M117 Pen resting on block. Seat pen, run PEN_UP, place paper, plot.'''


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    s = TARGET.read_text()
    if "variable_lift_after" not in s and "Pen resting on block" in s:
        print("SKIP  PLOT_START already rests on the block")
        return 0
    for name, old in (("vars", OLD_VARS), ("body", OLD_BODY)):
        n = s.count(old)
        print(f"anchor '{name}': found {n} (expected 1)")
        if n != 1:
            print("MISS  differs - nothing written")
            m = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", s, re.S)
            print(m.group(0) if m else "(not found)")
            return 1
    s = s.replace(OLD_VARS, NEW_VARS, 1).replace(OLD_BODY, NEW_BODY, 1)
    TARGET.write_text(s)
    print("OK    clearance move removed; pen rests on block after measuring")

    chk = TARGET.read_text()
    seg = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", chk, re.S).group(0)
    # Look only at command lines (strip the M117 message and description)
    cmd_lines = [ln for ln in seg.splitlines()
                 if ln.strip() and not ln.strip().startswith(("M117", "description", "variable_", "#"))]
    cmds = "\n".join(cmd_lines)
    tests = {
        "lift_after var gone": "variable_lift_after" not in seg,
        "no clearance move": "block_z + v.lift_after" not in seg,
        "measures block": "Z_PAPER_BLOCK" in cmds,
        "paper offset set": "SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}" in cmds,
        "offset reset present": "SET_GCODE_OFFSET X=0 Y=0 Z=0" in cmds,
        "last motion is the measure (Z19)": cmds.rstrip().endswith("SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}"),
        "no PEN_UP command": "PEN_UP" not in cmds,
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
