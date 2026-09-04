#!/usr/bin/env python3
"""patch-plot-start-reset-before-home.py

PLOT_START reset offsets AFTER G28. When a previous run had left a Z offset
(11) active, G28's homing_override ran in that shifted frame, and the
subsequent G1 Z{block_z} ended up in the wrong place (carriage stayed at the
homing top, machine Z75, instead of descending to the block). Run by hand with
offsets already zero, the identical sequence worked - proving the culprit is
the leftover offset during homing.

Fix: reset offsets BEFORE G28, so homing always happens in clean machine
coordinates.

  before:  G28 -> SET_GCODE_OFFSET X0 Y0 Z0 -> PEN_DOWN -> G1 Z...
  after:   SET_GCODE_OFFSET X0 Y0 Z0 -> G28 -> PEN_DOWN -> G1 Z...

Idempotent: SKIPs if applied, MISS-aborts if the body differs.
Run from the repo root:

    python3 tools/era/patch-plot-start-reset-before-home.py
"""

import pathlib
import re
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

OLD = '''  {% set v = printer["gcode_macro PLOT_START"] %}
  G28
  SET_GCODE_OFFSET X=0 Y=0 Z=0
  PEN_DOWN'''

NEW = '''  {% set v = printer["gcode_macro PLOT_START"] %}
  SET_GCODE_OFFSET X=0 Y=0 Z=0
  G28
  PEN_DOWN'''


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    s = TARGET.read_text()
    if "SET_GCODE_OFFSET X=0 Y=0 Z=0\n  G28\n  PEN_DOWN" in s:
        print("SKIP  PLOT_START already resets before homing")
        return 0
    n = s.count(OLD)
    print(f"anchor found: {n} (expected 1)")
    if n != 1:
        print("MISS  body differs - nothing written")
        m = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", s, re.S)
        print(m.group(0) if m else "(not found)")
        return 1
    s = s.replace(OLD, NEW, 1)
    TARGET.write_text(s)
    print("OK    offsets now reset before G28")

    chk = TARGET.read_text()
    seg = re.search(r"\[gcode_macro PLOT_START\].*?(?=\n\[gcode_macro)", chk, re.S).group(0)
    tests = {
        "reset before G28": "SET_GCODE_OFFSET X=0 Y=0 Z=0\n  G28\n  PEN_DOWN" in seg,
        "reset not after G28": "G28\n  SET_GCODE_OFFSET X=0 Y=0 Z=0" not in seg,
        "one G28": seg.count("G28") == 1,
        "measure still present": "G1 Z{v.block_z} F600" in seg,
        "Z_PAPER_BLOCK present": "Z_PAPER_BLOCK" in seg,
        "paper offset present": "SET_GCODE_OFFSET X={v.paper_x} Y={v.paper_y}" in seg,
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
