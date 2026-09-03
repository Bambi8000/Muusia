#!/usr/bin/env python3
"""patch-canvas-check-offset-guard.py

The CANVAS_CHECK travel guard compares the frame against machine limits WITHOUT
adding the active PAPER_ZERO gcode offset, so a misplaced job (wrong corner,
zero not jogged onto the paper) sails past the guard and only trips Klipper's
raw "Move out of range" spam once the moves start. This adds the gcode offset
to both sides of the comparison and rewrites the error message.

Idempotent: SKIPs if applied, MISS-aborts if the anchor is not found once.
Run from the repo root:

    python3 tools/era/patch-canvas-check-offset-guard.py
"""

import pathlib
import sys

TARGET = pathlib.Path("klipper/canvas-check.cfg")

OLD = """  {% set cfg = printer.configfile.settings %}
  {% if x0 < cfg.stepper_x.position_min or x1 > cfg.stepper_x.position_max
     or y0 < cfg.stepper_y.position_min or y1 > cfg.stepper_y.position_max %}
    { action_raise_error("CANVAS_CHECK: frame exceeds machine travel — job too large or badly placed") }
  {% endif %}"""

NEW = """  {% set cfg = printer.configfile.settings %}
  {% set ox = printer.gcode_move.homing_origin.x %}
  {% set oy = printer.gcode_move.homing_origin.y %}
  {% if x0 + ox < cfg.stepper_x.position_min or x1 + ox > cfg.stepper_x.position_max
     or y0 + oy < cfg.stepper_y.position_min or y1 + oy > cfg.stepper_y.position_max %}
    { action_raise_error("CANVAS_CHECK: frame at machine X%.0f..%.0f Y%.0f..%.0f exceeds travel - wrong zero corner, PAPER_ZERO not on the paper, or job too large" % (x0+ox, x1+ox, y0+oy, y1+oy)) }
  {% endif %}"""


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    src = TARGET.read_text()
    if "homing_origin.x" in src:
        print("SKIP  guard already includes the gcode offset")
        return 0
    n = src.count(OLD)
    print(f"anchor found: {n} (expected 1)")
    if n != 1:
        print("MISS  anchor text differs - nothing written")
        for i, ln in enumerate(src.splitlines(), 1):
            if "position_min" in ln or "position_max" in ln or "exceeds machine" in ln:
                print(f"{i}: {ln}")
        return 1
    TARGET.write_text(src.replace(OLD, NEW))
    print("OK    guard now adds PAPER_ZERO offset before comparing to travel")

    chk = TARGET.read_text()
    tests = {
        "offset x read": "{% set ox = printer.gcode_move.homing_origin.x %}" in chk,
        "offset y read": "{% set oy = printer.gcode_move.homing_origin.y %}" in chk,
        "comparison uses offset": "x1 + ox > cfg.stepper_x.position_max" in chk,
        "new message present": "wrong zero corner" in chk,
        "old message gone": "job too large or badly placed" not in chk,
        "no jinja comments": "{#" not in chk,
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())
    print("RESULT: ALL OK" if ok else "RESULT: FAILURES - do not scp or commit")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
