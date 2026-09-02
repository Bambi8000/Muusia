#!/usr/bin/env python3
"""patch-handoff-servo-live.py

Two edits to the MECH handoff after the Z endstop + servo session (2026-08-24):

  1. The status paragraph still says the servo is "loose on the desk - no
     holder yet" and that a makeshift marker taped to Z does the plotting.
     Both are now false: the holder is built, the servo is mounted and tuned
     (down 80 / up 135), and PEN_UP / PEN_DOWN are SET_SERVO again.

  2. Three new pitfalls appended to the session log, all of which cost real
     time today and none of which are guessable from the outside.

Idempotent: SKIPs if already applied, MISS-aborts if an anchor is not found
exactly once. Run from the repo root:

    python3 tools/era/patch-handoff-servo-live.py
"""

import pathlib
import sys

TARGET = pathlib.Path("docs/MUUSIA-PLOTTER-MECH-HANDOFF.md")

OLD_STATUS = """Workflow commissioning DONE (2026-08-12): the S0017M servo is bench-tested on
the Kraken SERVO header (PE7, loose on the desk — no holder yet), the full
Muusia → Mainsail → plot chain is proven in an air run (canvas check frames
the job, pauses with a Continue/Abort prompt, then plots), the paper-setup
macros (PAPER_ZERO / Z_PAPER_BLOCK) are in printer.cfg, and per-print
timelapse video lands in Telegram automatically. Details + hard-won pitfalls
in section 8 (session log). A makeshift marker taped to Z still plots via
PEN_UP/PEN_DOWN as Z moves. Next tasks: **first ink test + calibration
figure**, then **design the pen holder / carriage** and revert the makeshift
pen macros when the servo moves onto it."""

NEW_STATUS = """Workflow commissioning DONE (2026-08-12): the full Muusia → Mainsail → plot
chain is proven in an air run (canvas check frames the job, pauses with a
Continue/Abort prompt, then plots), the paper-setup macros (PAPER_ZERO /
Z_PAPER_BLOCK) are in printer.cfg, and per-print timelapse video lands in
Telegram automatically. Z endstop + servo DONE (2026-08-24): a real NC switch
sits on MIN3 (`^PF1`) at the top of Z travel (machine Z 0..75; homing order is
Z first, then X, then Y, so homing is safe with a pen resting on the sheet),
and the S0017M is mounted on the finished pen holder with tuned angles — down
80, up 135, `initial_angle: 135` so the pen is up after every restart.
PEN_UP / PEN_DOWN are `SET_SERVO` again with a `G4 P250` dwell so the servo
arrives before the stroke starts; the makeshift Z-move versions are gone.
Division of labour from here: **Z sets the coarse paper contact height**
(jog + `Z_ZERO_HERE`), **the servo does the per-stroke lift**. Details +
hard-won pitfalls in section 8 (session log). Next task: **first plot with the
real pen — the calibration figure** (100 mm square + diagonals + circle +
registration marks), which checks dimensional accuracy, corner registration,
servo timing and pen pressure on one sheet."""

ANCHOR9 = "## 9. Related project docs"

NEW_PITFALLS = """- **A temporary macro that moves Z + an automatic timeout = a 70 mm plunge.**
  While there was no Z switch, PEN_UP was a stand-in `G1 Z5` (absolute), which
  was correct when Z=0 meant paper contact. Adding the real endstop changed
  the meaning of Z=5 to "5 mm off the bottom of travel", and
  `[idle_timeout] gcode: PEN_UP / M84` then drove Z from the homed 75 down to
  5 by itself after 30 min of idling — pen straight into the sheet, then M84
  dropped the homing so the evidence was gone. Lesson: when a macro is a
  stand-in for missing hardware, audit **every** automatic caller of it
  (idle_timeout, start/end G-code, homing_override) before changing the
  coordinate system underneath it.
- **A jammed Z carriage is indistinguishable from a dead driver over the
  wire.** A tight carriage buzzed, refused to move, and Klipper cheerfully
  logged the steps — `DUMP_TMC` was clean (`GSTAT: 00000000`, no open-load,
  `LOST_STEPS: 0`, MSCNT advancing) and the DRO counted up to a position the
  machine never reached. Always check the screw turns by hand (`M84` first)
  before suspecting electronics.
- **Servos are open loop — there is no way to read the current angle.** With
  the servo already bolted to the holder and its position unknown, the safe
  order is: `PEN_RELEASE` (kill the pulse so it stops fighting whatever it is
  jammed against), `G28 Z` to park the pen 75 mm up where it cannot reach
  anything, remove the pen from the holder, then step 5° at a time with
  `G4 P800` dwells to find which way the angle grows. Consecutive `SET_SERVO`
  lines pasted as a block execute in milliseconds and look like nothing
  happened — the dwells are what make the test observable. Avoid 0° / 180°:
  the configured pulse range is wider than most servos' real travel, so the
  ends can stall the gears. If the working range lands near an end, move the
  horn a tooth on the spline instead of stretching the config.

"""


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1

    src = TARGET.read_text()

    if "Z endstop + servo DONE" in src:
        print("SKIP  handoff already records the mounted servo")
        return 0

    fail = False
    for name, old in (("status paragraph", OLD_STATUS), ("section 9 heading", ANCHOR9)):
        n = src.count(old)
        print(f"anchor '{name}': found {n} (expected 1)")
        if n != 1:
            fail = True
    if fail:
        print("MISS  anchors do not match - nothing written")
        return 1

    out = src.replace(OLD_STATUS, NEW_STATUS).replace(ANCHOR9, NEW_PITFALLS + ANCHOR9)
    TARGET.write_text(out)
    print("OK    status paragraph rewritten and 3 pitfalls appended to the session log")

    chk = TARGET.read_text()
    tests = {
        "servo mounted recorded": "mounted on the finished pen holder" in chk,
        "angles 80/135 recorded": "down\n80, up 135" in chk or "down 80" in chk,
        "initial_angle noted": "`initial_angle: 135`" in chk,
        "division of labour noted": "the servo does the per-stroke lift" in chk,
        "next task is calibration figure": "the calibration figure" in chk,
        "no stale 'loose on the desk'": "loose on the desk" not in chk,
        "no stale makeshift marker": "makeshift marker taped to Z" not in chk,
        "pitfall: idle_timeout plunge": "70 mm plunge" in chk,
        "pitfall: jam vs driver": "jammed Z carriage" in chk and "DUMP_TMC` was clean" in chk,
        "pitfall: servos open loop": "Servos are open loop" in chk,
        "section 9 still present": chk.count("## 9. Related project docs") == 1,
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())
    print("\nRESULT: ALL OK" if ok else "\nRESULT: FAILURES - do not commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
