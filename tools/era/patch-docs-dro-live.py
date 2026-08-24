#!/usr/bin/env python3
"""patch-docs-dro-live.py

Updates the `dro/` row in klipper/README.md: the old status text still says
"DIGIT_MAP pending first hookup test", which is now three revisions out of
date (DIGIT_MAP verified, Z display moved to BCM 20/21, WorkingDirectory fix,
live_position readout).

Idempotent: SKIPs if already applied, MISS-aborts if the anchor row is not
found exactly once. Run from the repo root:

    python3 tools/era/patch-docs-dro-live.py
"""

import pathlib
import re
import sys

TARGET = pathlib.Path("klipper/README.md")

NEW_ROW = (
    "| `dro/` | TM1637 DRO service: `dro_tm1637.py` (stdlib + python3-lgpio; polls "
    "Moonraker HTTP 10 Hz for `motion_report.live_position`, converted to work "
    "coordinates via the gcode_move offset, so the displays follow real motion "
    "rather than the queued target; bit-banged TM1637, `--test` mode for "
    "solder/digit-order checks) + `dro.service` systemd unit "
    "(`WorkingDirectory` required - lgpio writes its `.lgd-nfy*` files to CWD). "
    "Pin/cable plan in MECH handoff §1. Power from 3V3 only. "
    "| Verified on viivain 2026-08-24: DIGIT_MAP = [2,1,0,5,4,3] (cross-wired "
    "boards), Z display on BCM 20/21 (phys 38/40), live readout running |"
)


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1

    src = TARGET.read_text()

    if "live_position" in src:
        print("SKIP  README dro row already documents the live readout")
        return 0

    rows = [ln for ln in src.splitlines() if ln.startswith("| `dro/` |")]
    if len(rows) != 1:
        print(f"MISS  found {len(rows)} rows starting with '| `dro/` |' (expected 1)")
        for ln in src.splitlines():
            if "dro" in ln:
                print("   ", ln[:120])
        return 1

    out = src.replace(rows[0], NEW_ROW)
    TARGET.write_text(out)
    print("OK    README dro row updated")

    check = TARGET.read_text()
    n_rows = len([ln for ln in check.splitlines() if ln.startswith("| `dro/` |")])
    stale = "DIGIT_MAP pending" in check
    print("---- verify ----")
    print(f"dro rows:                  {n_rows} (expected 1)")
    print(f"stale 'DIGIT_MAP pending': {stale} (expected False)")
    print(f"live_position documented:  {'live_position' in check} (expected True)")
    ok = n_rows == 1 and not stale and "live_position" in check
    print("RESULT: ALL OK" if ok else "RESULT: FAILURES - do not commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
