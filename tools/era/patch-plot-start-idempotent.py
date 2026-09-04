#!/usr/bin/env python3
"""patch-plot-start-idempotent.py

Fixes two problems in PLOT_START found on the machine (2026-09-04):

  1. Offsets accumulated. The macro measured the block with a previous
     SET_GCODE_OFFSET still active, so `G1 Z{block_z}` moved in the shifted
     work frame (Z20 command -> machine Z32 when a 12 offset was live), the
     tip never reached the block, and Z_PAPER_BLOCK stacked a second offset
     on top (gcode homing Z showed 24 = 12 + 12). Fix: reset all offsets to
     zero right after G28, before measuring. Makes PLOT_START idempotent -
     safe to run repeatedly, always the same result.

  2. block_z 20 -> 19. Re-measured in a clean frame: the pen tip touches the
     fixed block at machine Z19 with the pen seated as it is now.

Idempotent: SKIPs if applied, MISS-aborts if the body differs.
Run from the repo root:

    python3 tools/era/patch-plot-start-idempotent.py
"""

import pathlib
import re
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

OLD = '''variable_block_z: 20.0
variable_paper_x: 42.0
variable_paper_y: 20.0
gcode:
  {% set v = printer["gcode_macro PLOT_START"] %}
  G28
  PEN_DOWN
  G90
  G1 Z{v.block_z} F600
  Z_PAPER_BLOCK'''

NEW = '''variable_block_z: 19.0
variable_paper_x: 42.0
variable_paper_y: 20.0
gcode:
  {% set v = printer["gcode_macro PLOT_START"] %}
  G28
  SET_GCODE_OFFSET X=0 Y=0 Z=0
  PEN_DOWN
  G90
  G1 Z{v.block_z} F600
  Z_PAPER_BLOCK'''


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    s = TARGET.read_text()
    if "SET_GCODE_OFFSET X=0 Y=0 Z=0\n  PEN_DOWN" in s:
        print("SKIP  PLOT_START already resets offsets before measuring")
        return 0
    n = s.count(OLD)
    print(f"anchor found: {n} (expected 1)")
    if n != 1:
        print("MISS  PLOT_START body differs - nothing written")
        m = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", s, re.S)
        print(m.group(0) if m else "(not found)")
        return 1
    s = s.replace(OLD, NEW, 1)
    TARGET.write_text(s)
    print("OK    reset added after G28, block_z 20 -> 19")

    chk = TARGET.read_text()
    seg = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", chk, re.S).group(0)
    tests = {
        "block_z 19": "variable_block_z: 19.0" in seg,
        "reset before measure": "G28\n  SET_GCODE_OFFSET X=0 Y=0 Z=0\n  PEN_DOWN" in seg,
        "measure move present": "G1 Z{v.block_z} F600" in seg,
        "Z_PAPER_BLOCK after reset": seg.find("Z_PAPER_BLOCK") > seg.find("SET_GCODE_OFFSET X=0"),
        "paper offset still there": "SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}" in seg,
        "only one G28": seg.count("G28") == 1,
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
