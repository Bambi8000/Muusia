#!/usr/bin/env python3
"""patch-dro-live-position.py

Switches the TM1637 DRO from Moonraker's commanded gcode_position to
motion_report.live_position (the toolhead's real position as the steppers
move), while staying in work coordinates by subtracting the current gcode
offset (G92 base + SET_GCODE_OFFSET / Z_ZERO_HERE).

Idempotent: SKIPs if already applied, MISS-aborts if the anchor is not found
exactly once. Run from the repo root:

    python3 tools/era/patch-dro-live-position.py
"""

import pathlib
import sys

TARGET = pathlib.Path("klipper/dro/dro_tm1637.py")

OLD = '''QUERY = MOONRAKER + "/printer/objects/query?gcode_move=gcode_position"


def read_position():
    """Returns [x, y, z, e] work coordinates, or None on any failure."""
    try:
        with urllib.request.urlopen(QUERY, timeout=1.0) as r:
            data = json.load(r)
        return data["result"]["status"]["gcode_move"]["gcode_position"]
    except Exception:
        return None
'''

NEW = '''QUERY = (MOONRAKER + "/printer/objects/query"
         "?motion_report=live_position&gcode_move=gcode_position,position")


def read_position():
    """Returns [x, y, z] live work coordinates, or None on any failure.

    live_position is where the toolhead actually is right now (it advances as
    the steppers step), but it is expressed in machine coordinates. The
    commanded pair from gcode_move gives the offset currently in force
    (G92 base + SET_GCODE_OFFSET, i.e. Z_ZERO_HERE); subtracting it lands the
    reading back in work coordinates - the same origin Mainsail shows, but
    following real motion instead of the queued target.
    """
    try:
        with urllib.request.urlopen(QUERY, timeout=1.0) as r:
            data = json.load(r)
        st = data["result"]["status"]
        live = st["motion_report"]["live_position"]
        gm = st["gcode_move"]
        off = [gm["position"][i] - gm["gcode_position"][i] for i in range(3)]
        return [live[i] - off[i] for i in range(3)]
    except Exception:
        return None
'''


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1

    src = TARGET.read_text()

    if "motion_report" in src:
        print("SKIP  already reading motion_report.live_position")
        return 0

    n = src.count(OLD)
    if n != 1:
        print(f"MISS  anchor found {n} times (expected 1) - file differs from expected")
        print("---- current QUERY / read_position region ----")
        for i, line in enumerate(src.splitlines(), 1):
            if "QUERY" in line or "read_position" in line or "gcode_position" in line:
                print(f"{i}: {line}")
        return 1

    TARGET.write_text(src.replace(OLD, NEW))
    print("OK    read_position now uses motion_report.live_position (work coords)")

    check = TARGET.read_text()
    ok = ("live_position" in check
          and "gcode_move=gcode_position,position" in check
          and check.count("def read_position") == 1)
    print("---- verify ----")
    print(f"live_position present:      {'live_position' in check}")
    print(f"combined query present:     {'gcode_move=gcode_position,position' in check}")
    print(f"read_position definitions:  {check.count('def read_position')} (expected 1)")
    print("RESULT: ALL OK" if ok else "RESULT: FAILURES - do not commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
