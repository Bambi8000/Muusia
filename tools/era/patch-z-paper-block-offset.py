#!/usr/bin/env python3
"""patch-z-paper-block-offset.py

Reworks the paper-Z setup for the real Z endstop (block measured 8.0 mm with
calipers, 2026-08-24):

  printer.cfg:
  - Z_PAPER_BLOCK: SET_KINEMATIC_POSITION -> SET_GCODE_OFFSET. The kinematic
    version was correct while Z had no switch, but now it shifts the machine
    frame away from the homed switch position (position_max 75 could then
    command the carriage into the switch's 2 mm mechanical margin) and it
    blocks spring preload (position_min 0 forbids negative Z, while a gcode
    offset leaves machine Z positive when work Z dips below paper).
    block_h 9.0 -> 8.0, plus a homed-Z guard.
  - PAPER_ZERO_CLEAR also clears the Z offset, so one macro returns the
    machine to true machine coordinates.

  MECH handoff section 7 step 3:
  - 9 mm -> 8 mm, kinematic -> offset wording, removes the stale "(PEN_UP
    goes to Z5 ...)" parenthetical (PEN_UP is a servo move again), and adds
    the previously undocumented step: lower Z to plotting height before
    starting, with the faint-line preload recipe.

Idempotent: SKIPs if already applied, MISS-aborts if an anchor is not found
exactly once. Run from the repo root:

    python3 tools/era/patch-z-paper-block-offset.py
"""

import pathlib
import sys

CFG = pathlib.Path("klipper/printer.cfg")
DOC = pathlib.Path("docs/MUUSIA-PLOTTER-MECH-HANDOFF.md")

OLD_BLOCK = """[gcode_macro Z_PAPER_BLOCK]
description: Pen tip touching the 9 mm block on paper -> declare Z so Z0 = paper
variable_block_h: 9.0
gcode:
  SET_KINEMATIC_POSITION Z={printer["gcode_macro Z_PAPER_BLOCK"].block_h}
  M117 Z set: block top = {printer["gcode_macro Z_PAPER_BLOCK"].block_h} mm, paper = Z0. REMOVE BLOCK, then PEN_UP."""

NEW_BLOCK = """[gcode_macro Z_PAPER_BLOCK]
description: Pen tip touching the 8 mm block on paper -> work Z0 = paper (gcode offset)
variable_block_h: 8.0
gcode:
  {% if "z" not in printer.toolhead.homed_axes %}
    { action_raise_error("Z_PAPER_BLOCK: home Z first (G28)") }
  {% endif %}
  SET_GCODE_OFFSET Z={printer.toolhead.position.z - printer["gcode_macro Z_PAPER_BLOCK"].block_h}
  M117 Z offset set: block top = work Z{printer["gcode_macro Z_PAPER_BLOCK"].block_h}, paper = work Z0. REMOVE BLOCK."""

OLD_CLEAR = """[gcode_macro PAPER_ZERO_CLEAR]
description: Clear the paper origin offset (back to machine coordinates)
gcode:
  SET_GCODE_OFFSET X=0 Y=0
  M117 Paper zero cleared"""

NEW_CLEAR = """[gcode_macro PAPER_ZERO_CLEAR]
description: Clear paper origin and paper-Z offsets (back to machine coordinates)
gcode:
  SET_GCODE_OFFSET X=0 Y=0 Z=0
  M117 Paper zero cleared (XY and Z)"""

OLD_DOC = """3. Pen in → 9 mm setup block ON the paper → jog Z down (pen-down pose) until
   the tip touches the block top → **Z_PAPER_BLOCK** (declares that height as
   Z=9, so Z0 = paper surface — no marks on the paper; block height is
   `variable_block_h`) → **REMOVE THE BLOCK** → PEN_UP. (PEN_UP goes to Z5,
   below the block top — pressing it with the block in place drives the pen
   into the block.)"""

NEW_DOC = """3. Pen in → 8 mm setup block ON the paper → jog Z down (pen-down pose) until
   the tip touches the block top → **Z_PAPER_BLOCK** (a `SET_GCODE_OFFSET` for
   Z, the same primitive PAPER_ZERO uses for XY: that height becomes work Z=8
   so work Z0 = the paper surface, with no marks on the paper; machine
   coordinates and the Z switch stay untouched, block height lives in
   `variable_block_h`) → **REMOVE THE BLOCK** → lower Z to plotting height:
   `G90` + `G1 Z0 F300` puts the tip exactly at paper level in the pen-down
   pose. If lines come out faint or broken, step down 0.1–0.5 mm — work Z
   goes slightly negative, which is fine because machine Z stays positive
   (this is the felt-tip preload finding). Z then stays put for the whole
   job; the servo does every lift. `PAPER_ZERO_CLEAR` now clears the Z offset
   too."""


def apply(path, pairs, skip_marker):
    src = path.read_text()
    if skip_marker in src:
        print(f"SKIP  {path} already patched")
        return True, False
    ok = True
    for name, old, _ in pairs:
        n = src.count(old)
        print(f"anchor '{name}': found {n} (expected 1)")
        if n != 1:
            ok = False
    if not ok:
        return False, False
    for _, old, new in pairs:
        src = src.replace(old, new)
    path.write_text(src)
    return True, True


def main():
    for p in (CFG, DOC):
        if not p.exists():
            print(f"MISS  {p} not found - run from the repo root")
            return 1

    ok1, w1 = apply(CFG, [("Z_PAPER_BLOCK macro", OLD_BLOCK, NEW_BLOCK),
                          ("PAPER_ZERO_CLEAR macro", OLD_CLEAR, NEW_CLEAR)],
                    "SET_GCODE_OFFSET Z={printer.toolhead.position.z")
    ok2, w2 = apply(DOC, [("workflow step 3", OLD_DOC, NEW_DOC)],
                    "lower Z to plotting height")
    if not (ok1 and ok2):
        print("MISS  anchors do not match - report output, nothing else written")
        return 1
    if w1 or w2:
        print("OK    patched")

    cfg = CFG.read_text()
    doc = DOC.read_text()
    tests = {
        "block_h 8.0": "variable_block_h: 8.0" in cfg,
        "gcode offset used": "SET_GCODE_OFFSET Z={printer.toolhead.position.z" in cfg,
        "no kinematic Z declare": 'SET_KINEMATIC_POSITION Z={printer["gcode_macro Z_PAPER_BLOCK"]' not in cfg,
        "homed guard present": "Z_PAPER_BLOCK: home Z first" in cfg,
        "clear resets Z too": "SET_GCODE_OFFSET X=0 Y=0 Z=0" in cfg,
        "doc says 8 mm block": "8 mm setup block" in doc,
        "doc plotting-height step": "lower Z to plotting height" in doc,
        "doc stale PEN_UP-to-Z5 gone": "PEN_UP goes to Z5" not in doc,
        "no jinja comments in cfg": "{#" not in cfg,
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")

    leftovers = [ln for ln in (cfg + doc).splitlines() if "9 mm" in ln or "block_h: 9" in ln]
    if leftovers:
        print("---- review manually: remaining '9 mm' mentions ----")
        for ln in leftovers:
            print("   ", ln.strip()[:100])

    ok = all(tests.values())
    print("\nRESULT: ALL OK" if ok else "\nRESULT: FAILURES - do not scp or commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
