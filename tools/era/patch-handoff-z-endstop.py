#!/usr/bin/env python3
"""patch-handoff-z-endstop.py

Updates the two places in the MECH handoff that still describe Z as having no
physical endstop:

  1. Section 1: "no Z switch -> [homing_override] virtual zero" is now wrong.
     Replaced with the real switch (MIN3/PF1, top of travel, machine Z 0..75),
     the new homing order (Z first, then X, then Y), and the two hardware
     findings that explain the tight homing parameters.

  2. The plotting workflow step: the old warning said a bare G28 would trip
     homing_override and re-zero Z at pen-up height, so exported files must
     never carry one. With a real switch a bare G28 homes Z upward instead,
     and the Z_ZERO_HERE gcode offset persists - so the warning is relaxed to
     "exporter unchanged, verify before relying on it" rather than deleted.

Idempotent: SKIPs if already applied, MISS-aborts if either anchor is not
found exactly once. Run from the repo root:

    python3 tools/era/patch-handoff-z-endstop.py
"""

import pathlib
import sys

TARGET = pathlib.Path("docs/MUUSIA-PLOTTER-MECH-HANDOFF.md")

OLD1 = """  switch on STOP2 or sensorless DIAG = future auto-square); no Z switch →
  `[homing_override]` virtual zero (jog Z to working height, G28 declares it
  Z=0; `Z_ZERO_HERE` re-declares after pen/paper changes). Pen servo macros"""

NEW1 = """  switch on STOP2 or sensorless DIAG = future auto-square). Z has a real NC
  switch on MIN3 (`^PF1`) at the TOP of travel, added 2026-08-24: machine Z
  runs 0 (bottom of travel) .. 75 (switch). `[homing_override]` homes Z first
  — upward, which also lifts the pen clear of the paper — then X, then Y, so
  homing is safe with a pen resting on the sheet. Work zero (pen contact
  height) is still a gcode offset from `Z_ZERO_HERE`, re-declared after
  pen/paper changes. The homing parameters are tight for measured reasons:
  only 2 mm from the trigger point to the mechanical end (hence
  `homing_speed: 5`, `second_homing_speed: 2`) and the lever stays depressed
  for 3–6 mm of downward travel (hence `homing_retract_dist: 10` — a shorter
  retract would start the second approach with the endstop still triggered).
  A jammed Z carriage will mimic a dead motor: it buzzes, Klipper still logs
  the steps, and the DRO advances while nothing moves — check that the screw
  turns by hand before suspecting the driver. Pen servo macros"""

OLD2 = """4. Upload the exported file to Mainsail → print. The file's `G28 X Y` re-homes
   XY only (a bare `G28` would trip homing_override and re-zero Z at pen-up
   height — the file must NEVER carry a bare G28), CLEAR_PAUSE resets stale"""

NEW2 = """4. Upload the exported file to Mainsail → print. The file's `G28 X Y` re-homes
   XY only, which remains the exporter default. Since the real Z switch was
   added a bare `G28` is no longer destructive — it homes Z upward against the
   switch and the `Z_ZERO_HERE` gcode offset persists — but the exporter has
   not been changed and this has not been verified on a live job, so treat
   `G28 X Y` as the contract for now. CLEAR_PAUSE resets stale"""


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1

    src = TARGET.read_text()

    if "real NC\n  switch on MIN3" in src:
        print("SKIP  handoff already describes the real Z endstop")
        return 0

    fail = False
    for name, old in (("section 1 Z description", OLD1), ("workflow G28 warning", OLD2)):
        n = src.count(old)
        print(f"anchor '{name}': found {n} (expected 1)")
        if n != 1:
            fail = True

    if fail:
        print("MISS  anchors do not match - file differs from expected, nothing written")
        return 1

    out = src.replace(OLD1, NEW1).replace(OLD2, NEW2)
    TARGET.write_text(out)
    print("OK    both passages replaced")

    chk = TARGET.read_text()
    tests = {
        "MIN3 / PF1 documented": "MIN3 (`^PF1`)" in chk,
        "machine range 0..75": "0 (bottom of travel) .. 75" in chk,
        "homing order documented": "homes Z first" in chk,
        "2 mm margin noted": "2 mm from the trigger point" in chk,
        "retract reason noted": "homing_retract_dist: 10" in chk,
        "jam symptom noted": "jammed Z carriage" in chk,
        "no stale 'no Z switch'": "no Z switch" not in chk,
        "no stale 'NEVER carry a bare G28'": "NEVER carry a bare G28" not in chk,
        "G28 X Y still the contract": "contract for now" in chk,
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())
    print("\nRESULT: ALL OK" if ok else "\nRESULT: FAILURES - do not commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
