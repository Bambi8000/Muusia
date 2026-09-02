#!/usr/bin/env python3
"""patch-z-endstop.py

Activates the real Z endstop on the Kraken MIN3 header (PF1, NC, mounted at
the TOP of Z travel) and rewrites [homing_override] so Z homes physically.

Measured on the machine 2026-08-24:
  - travel bottom..switch = 75 mm  -> position_max / position_endstop = 75
  - switch trigger point to mechanical end = 2 mm  -> homing_speed lowered to
    5 mm/s and a slow second approach added
  - the lever stays depressed for 3..6 mm of downward travel -> retract 10 mm,
    otherwise the second approach would start with the endstop still triggered

Coordinate convention: machine Z = 0 at the bottom of travel, 75 at the
switch. Work zero (pen contact height) stays a gcode offset set by
Z_ZERO_HERE, exactly as before, so PEN_UP / PEN_DOWN keep working unchanged.

Idempotent: SKIPs if already applied, MISS-aborts on any unexpected state.
Run from the repo root:

    python3 tools/era/patch-z-endstop.py
"""

import pathlib
import re
import sys

TARGET = pathlib.Path("klipper/printer.cfg")

# Desired keys inside [stepper_z]
Z_KEYS = {
    "endstop_pin": "^PF1              # MIN3 header, NC switch at the TOP of travel",
    "position_endstop": "75             # switch trigger point, measured 2026-08-24",
    "position_min": "0",
    "position_max": "75",
    "homing_positive_dir": "true",
    "homing_speed": "5              # only 2 mm from trigger to the mechanical end",
    "second_homing_speed": "2",
    "homing_retract_dist": "10             # lever stays depressed for 3-6 mm",
}

NEW_OVERRIDE = """[homing_override]
axes: xyz
gcode:
  {% set want = params.X is defined or params.Y is defined or params.Z is defined %}
  {% set homed = printer.toolhead.homed_axes %}
  {% if not want or params.Z is defined %}
    G28 Z
  {% elif 'z' not in homed %}
    G28 Z
  {% endif %}
  {% if not want or params.X is defined %}
    G28 X
  {% endif %}
  {% if not want or params.Y is defined %}
    G28 Y
  {% endif %}
"""


def section_bounds(lines, header):
    """Returns (start, end) line indices for a [section], end exclusive."""
    start = None
    for i, ln in enumerate(lines):
        if ln.strip() == header:
            start = i
            break
    if start is None:
        return None
    for j in range(start + 1, len(lines)):
        if lines[j].startswith("["):
            return (start, j)
    return (start, len(lines))


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1

    src = TARGET.read_text()

    if "MIN3 header, NC switch at the TOP" in src:
        print("SKIP  Z endstop already activated")
        return 0

    lines = src.splitlines()

    # ---------- [stepper_z] ----------
    b = section_bounds(lines, "[stepper_z]")
    if b is None:
        print("MISS  [stepper_z] section not found")
        return 1
    start, end = b
    body = lines[start + 1:end]

    seen = set()
    out_body = []
    for ln in body:
        m = re.match(r"^([a-z_]+):", ln)
        key = m.group(1) if m else None
        if key in Z_KEYS:
            out_body.append(f"{key}: {Z_KEYS[key]}")
            seen.add(key)
        else:
            out_body.append(ln)

    # append any keys that were not present before (e.g. second_homing_speed)
    missing = [k for k in Z_KEYS if k not in seen]
    tail_blanks = 0
    while out_body and out_body[-1].strip() == "":
        out_body.pop()
        tail_blanks += 1
    for k in missing:
        out_body.append(f"{k}: {Z_KEYS[k]}")
    out_body.extend([""] * tail_blanks)

    lines[start + 1:end] = out_body
    print(f"OK    [stepper_z] keys set (updated: {sorted(seen)}, added: {sorted(missing)})")

    # ---------- [homing_override] ----------
    b2 = section_bounds(lines, "[homing_override]")
    if b2 is None:
        print("MISS  [homing_override] section not found")
        return 1
    s2, e2 = b2
    trailing = []
    while e2 - 1 > s2 and lines[e2 - 1].strip() == "":
        trailing.append(lines[e2 - 1])
        e2 -= 1
    lines[s2:e2] = NEW_OVERRIDE.rstrip("\n").splitlines()
    print("OK    [homing_override] rewritten (Z homes first, then X, then Y)")

    out = "\n".join(lines) + "\n"

    # ---------- stale comments ----------
    out = out.replace(
        "# NO physical Z endstop on this frame. Homing is handled by [homing_override]:\n"
        "# jog Z to your working height, run G28, and that position becomes Z=0.\n"
        "# The endstop_pin below points at the unused STOP3 header and never triggers.",
        "# Real Z endstop on MIN3 (PF1, NC) at the TOP of travel, added 2026-08-24.\n"
        "# G28 Z homes upward, which also lifts the pen clear of the paper; work zero\n"
        "# (pen contact height) is still a gcode offset set by Z_ZERO_HERE.",
    )
    out = out.replace("dir_pin: !PB8                   # TODO: verify direction (Z+ = up)",
                      "dir_pin: !PB8                   # verified: Z+ = up")
    out = re.sub(r"rotation_distance: 2\.117\s+# TODO: verify\.",
                 "rotation_distance: 2.117       # verified by measurement (10 mm commanded = 10 mm).",
                 out)

    TARGET.write_text(out)

    # ---------- verify ----------
    print("---- verify ----")
    chk = TARGET.read_text()
    zb = section_bounds(chk.splitlines(), "[stepper_z]")
    zbody = "\n".join(chk.splitlines()[zb[0]:zb[1]])
    tests = {
        "endstop_pin ^PF1": "endstop_pin: ^PF1" in zbody,
        "position_endstop 75": re.search(r"^position_endstop: 75", zbody, re.M) is not None,
        "position_min 0": re.search(r"^position_min: 0\s*$", zbody, re.M) is not None,
        "position_max 75": re.search(r"^position_max: 75\s*$", zbody, re.M) is not None,
        "homing_positive_dir true": "homing_positive_dir: true" in zbody,
        "homing_speed 5": re.search(r"^homing_speed: 5", zbody, re.M) is not None,
        "second_homing_speed 2": "second_homing_speed: 2" in zbody,
        "homing_retract_dist 10": "homing_retract_dist: 10" in zbody,
        "no PF2 left": "^PF2" not in chk,
        "no temporary 120": "position_max: 120" not in chk,
        "override axes xyz": "axes: xyz" in chk,
        "no set_position_z": "set_position_z" not in chk,
        "one homing_override": chk.count("[homing_override]") == 1,
        "one stepper_z": chk.count("[stepper_z]") == 1,
    }
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())
    print("\n---- [stepper_z] as written ----")
    print(zbody)
    print("\nRESULT: ALL OK" if ok else "\nRESULT: FAILURES - do not scp or commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
