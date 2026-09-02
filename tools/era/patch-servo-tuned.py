#!/usr/bin/env python3
"""patch-servo-tuned.py

Puts the real pen servo into service after tuning on the machine (2026-08-24):

  - _PEN_VARS: up_angle 135, down_angle 80 (measured on the actual linkage;
    the range sits mid-travel, away from the servo's internal end stops)
  - [servo pen] initial_angle -> 135, so the pen is UP on every Klipper
    restart. 90 (the old value) is close to pen-down and would dot the paper
    on boot if Z happened to be near work zero.
  - PEN_UP / PEN_DOWN: reverted from the makeshift absolute Z moves back to
    SET_SERVO, plus a G4 P250 dwell so the servo actually arrives before the
    next move starts (without it the first millimetres of every stroke are
    drawn while the pen is still travelling).
  - [idle_timeout]: PEN_UP + PEN_RELEASE + M84. Safe again now that PEN_UP no
    longer moves Z, and PEN_RELEASE stops the servo holding torque for hours.

Division of labour from here: Z sets the coarse paper contact height
(Z_ZERO_HERE), the servo does the per-stroke lift.

Idempotent: SKIPs if already applied, MISS-aborts on any unexpected state.
Run from the repo root:

    python3 tools/era/patch-servo-tuned.py
"""

import pathlib
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

UP_ANGLE = 135
DOWN_ANGLE = 80

REPLACEMENTS = [
    (
        "servo pin comment",
        'pin: PE7                       # TODO: verify header silkscreen ("SERVOS" / probe header)',
        "pin: PE7                       # SERVOS header, verified 2026-08-24",
    ),
    (
        "initial_angle",
        "initial_angle: 90              # TODO: set to the real pen-up angle once tuned",
        f"initial_angle: {UP_ANGLE}             # pen UP on boot",
    ),
    (
        "_PEN_VARS angles",
        "variable_up_angle: 120         # TODO: tune on the real linkage\n"
        "variable_down_angle: 60        # TODO: tune on the real linkage",
        f"variable_up_angle: {UP_ANGLE}         # tuned on the real linkage 2026-08-24\n"
        f"variable_down_angle: {DOWN_ANGLE}        # spring just compressed at this angle",
    ),
    (
        "PEN_UP macro",
        "[gcode_macro PEN_UP]\ngcode:\n  G90\n  G1 Z5 F600",
        "[gcode_macro PEN_UP]\ngcode:\n"
        '  SET_SERVO SERVO=pen ANGLE={printer["gcode_macro _PEN_VARS"].up_angle}\n'
        "  G4 P250",
    ),
    (
        "PEN_DOWN macro",
        "[gcode_macro PEN_DOWN]\ngcode:\n  G90\n  G1 Z0 F600",
        "[gcode_macro PEN_DOWN]\ngcode:\n"
        '  SET_SERVO SERVO=pen ANGLE={printer["gcode_macro _PEN_VARS"].down_angle}\n'
        "  G4 P250",
    ),
    (
        "idle_timeout",
        "[idle_timeout]\ntimeout: 1800\ngcode:\n  M84",
        "[idle_timeout]\ntimeout: 1800\ngcode:\n  PEN_UP\n  PEN_RELEASE\n  M84",
    ),
]


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1

    src = TARGET.read_text()

    if "tuned on the real linkage" in src:
        print("SKIP  servo already tuned in printer.cfg")
        return 0

    fail = False
    for name, old, _ in REPLACEMENTS:
        n = src.count(old)
        print(f"anchor '{name}': found {n} (expected 1)")
        if n != 1:
            fail = True

    if fail:
        print("MISS  anchors do not match - nothing written")
        return 1

    out = src
    for _, old, new in REPLACEMENTS:
        out = out.replace(old, new)
    TARGET.write_text(out)
    print("OK    servo angles, PEN macros and idle_timeout updated")

    chk = TARGET.read_text()
    tests = {
        f"up_angle {UP_ANGLE}": f"variable_up_angle: {UP_ANGLE}" in chk,
        f"down_angle {DOWN_ANGLE}": f"variable_down_angle: {DOWN_ANGLE}" in chk,
        f"initial_angle {UP_ANGLE}": f"initial_angle: {UP_ANGLE}" in chk,
        "PEN_UP uses SET_SERVO": "[gcode_macro PEN_UP]\ngcode:\n  SET_SERVO" in chk,
        "PEN_DOWN uses SET_SERVO": "[gcode_macro PEN_DOWN]\ngcode:\n  SET_SERVO" in chk,
        "dwells present": chk.count("G4 P250") == 2,
        "no makeshift Z in PEN_UP": "G1 Z5 F600" not in chk,
        "no makeshift Z in PEN_DOWN": "G1 Z0 F600" not in chk,
        "idle_timeout releases servo": "PEN_UP\n  PEN_RELEASE\n  M84" in chk,
        "no Jinja comments": "{#" not in chk,
        "no leftover TODO on servo": "TODO: verify header silkscreen" not in chk,
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())

    print("\n---- PEN macros as written ----")
    lines = chk.splitlines()
    for i, ln in enumerate(lines):
        if ln.startswith("[gcode_macro PEN_") or ln.startswith("[gcode_macro _PEN_VARS]"):
            print("\n".join(lines[i:i + 4]))
            print()

    print("RESULT: ALL OK" if ok else "RESULT: FAILURES - do not scp or commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
