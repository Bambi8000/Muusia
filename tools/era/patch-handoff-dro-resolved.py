#!/usr/bin/env python3
"""patch-handoff-dro-resolved.py

Replaces the "Open item: DIGIT_MAP" paragraph in the MECH handoff with the
resolved state (verified 2026-08-24), and records the two hardware findings
from the hookup: the cross-wired digit map and the dead original Z pin pair.

Idempotent: SKIPs if already applied, MISS-aborts if the anchor paragraph is
not found exactly once. Run from the repo root:

    python3 tools/era/patch-handoff-dro-resolved.py
"""

import pathlib
import sys

TARGET = pathlib.Path("docs/MUUSIA-PLOTTER-MECH-HANDOFF.md")

OLD = """  Open item: `DIGIT_MAP` — 6-digit TM1637 boards often cross-wire the two
  3-digit groups ("123456" renders "321654"); verify with
  `python3 ~/dro-service/dro_tm1637.py --test` (stop `dro.service` first,
  both claim the same GPIO lines) and fix the map in BOTH the Pi copy and
  `klipper/dro/`. The service shows `------` while Moonraker is unreachable."""

NEW = """  Resolved at hookup (2026-08-24): the boards are cross-wired, so
  `DIGIT_MAP = [2, 1, 0, 5, 4, 3]`. The Z display stayed dark on the original
  GPIO26/16 pair even after swapping CLK/DIO (module and wiring were fine —
  it worked on X's pins), so Z moved to GPIO20/21. `dro.service` also needs
  `WorkingDirectory` set: lgpio writes its `.lgd-nfy*` files to CWD, which is
  `/` for a systemd unit, and the service crash-loops without it.

  The displays read `motion_report.live_position` converted to work
  coordinates (the gcode_move offset is subtracted), so they follow the
  toolhead as it actually moves rather than jumping to the queued target.
  Re-verify any wiring change with
  `python3 ~/dro-service/dro_tm1637.py --test` (stop `dro.service` first,
  both claim the same GPIO lines) and fix values in BOTH the Pi copy and
  `klipper/dro/`. The service shows `------` while Moonraker is unreachable
  or the machine is unhomed."""


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1

    src = TARGET.read_text()

    if "Resolved at hookup" in src:
        print("SKIP  handoff already records the resolved DRO state")
        return 0

    n = src.count(OLD)
    if n != 1:
        print(f"MISS  anchor paragraph found {n} times (expected 1)")
        for i, line in enumerate(src.splitlines(), 1):
            if "DIGIT_MAP" in line or "Open item" in line:
                print(f"{i}: {line}")
        return 1

    TARGET.write_text(src.replace(OLD, NEW))
    print("OK    handoff DRO paragraph replaced with resolved state")

    check = TARGET.read_text()
    print("---- verify ----")
    tests = {
        "Resolved at hookup present": "Resolved at hookup" in check,
        "DIGIT_MAP value recorded": "[2, 1, 0, 5, 4, 3]" in check,
        "GPIO20/21 mentioned": "GPIO20/21" in check,
        "WorkingDirectory noted": "WorkingDirectory" in check,
        "no stale 'Open item: `DIGIT_MAP`'": "Open item: `DIGIT_MAP`" not in check,
    }
    for k, v in tests.items():
        print(f"{k}: {v}")
    ok = all(tests.values())
    print("RESULT: ALL OK" if ok else "RESULT: FAILURES - do not commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
