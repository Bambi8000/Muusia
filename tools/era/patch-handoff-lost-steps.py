#!/usr/bin/env python3
"""patch-handoff-lost-steps.py

Documents the 2026-09-04 lost-steps hunt and the motion tuning that fixed it.

Three edits to docs/MUUSIA-PLOTTER-MECH-HANDOFF.md:

  1. Section 1, PSU note: the standing advice "run steppers at moderate
     current (~1.3-1.8 A RMS)" is what caused the failure - 1.4 A was under
     half the SM57HT51's 2.8 A rating and the gantry lost steps on every long
     travel move. Replaced with the measured working value (2.0 A) and the
     thermal check that confirmed it.

  2. Section 1, control board: "- ordered." is stale; the Kraken has been in
     service since 2026-08-11.

  3. A new section 9 (session log 2026-09-04) with the diagnosis method, the
     false leads and why each was wrong, and a table of the motion settings
     that produce clean plots. The old section 9 becomes section 10.

Idempotent: SKIPs if applied, MISS-aborts if any anchor is missing.
Run from the repo root:

    python3 tools/era/patch-handoff-lost-steps.py
"""

import pathlib
import sys

TARGET = pathlib.Path("docs/MUUSIA-PLOTTER-MECH-HANDOFF.md")

OLD_PSU = """  parts bin — correct type for motors. Run steppers at moderate current
  (~1.3–1.8 A RMS), not full 2.8 A. Verify 230 V mains selector + test before use."""

NEW_PSU = """  parts bin — correct type for motors. Verify 230 V mains selector + test
  before use. **Current: X/Y/Y1 run at 2.0 A RMS** (measured working value,
  2026-09-04). The earlier "moderate 1.3–1.8 A" guidance was wrong for this
  frame: at 1.4 A — half the motor's 2.8 A rating — the gantry lost steps on
  every long travel move. At 2.0 A a 23 m plot ran clean with no `ot`/`otpw`
  in `DRV_STATUS`, so there is thermal headroom. Z stays at 1.4 A; it is
  slow, lightly loaded and has never missed."""

OLD_BOARD = "- **Control board:** BTT Kraken v1.1 (8× onboard TMC2160, SPI, up to 60 V) — ordered."
NEW_BOARD = "- **Control board:** BTT Kraken v1.1 (8× onboard TMC2160, SPI, up to 60 V) — in service since 2026-08-11."

ANCHOR_SEC9 = "## 9. Related project docs (software side — not needed for mechanics)"

NEW_SECTION = """## 9. Session log 2026-09-04 — the lost-steps hunt (read this before tuning motion)

The first long plots (23 m, 60 paths, 16 min) failed the same way every run:
somewhere mid-job the machine chattered, then everything after that point was
drawn shifted, and the pen ended up dragging across the Z reference block.
The cause was **motor current too low**, but it took a long detour to get
there — so the elimination order matters more than the answer.

**The one measurement that splits the problem in two.** Run `GET_POSITION`
while the fault is live (pause the job, don't home — homing destroys the
evidence) and compare three things: the `stepper` line (Klipper's machine
position), `gcode base` (the active offsets), and where the carriage
physically is.

- `gcode base` changed from what PLOT_START set → **software**: something
  wiped or stacked an offset mid-job.
- `gcode base` unchanged but `stepper` disagrees with the physical carriage →
  **mechanical/dynamic**: steps were lost. Klipper has no idea and the logs
  stay clean, because sending pulses that the motor fails to follow is not an
  error condition.

In the failing run `gcode base` read X42 Y20 Z11 — exactly what PLOT_START
set — while the carriage sat ~25 mm further out in X than Klipper believed.
That settled it: lost steps, and the shortfall pointed along the direction of
travel, i.e. the carriage never completed the big moves toward low
coordinates.

**Do not trust `LOST_STEPS` in `DUMP_TMC`.** It read `00000000` through every
failed plot. It reflects stallGuard bookkeeping, not "the motor failed to keep
up", and it is meaningless without the stallGuard/coolStep registers
configured. `GSTAT` was clean too.

**False leads, and why each was wrong** (all cost real time):

- *Timelapse park moving the head.* `timelapse.cfg` really does contain
  `SET_GCODE_OFFSET X=0 Y=0`, which would wipe PAPER_ZERO — but it sits
  inside the park branch, `variable_park: {'enable': False}`, and Mainsail's
  Timelapse was `Enabled: off` anyway. A `grep -c TIMELAPSE_TAKE_FRAME` on
  klippy.log returned 210 and looked damning; those were config-dump lines,
  not executed commands. **klippy.log does not log executed G-code**, so
  grepping it cannot prove a command did or did not run.
- *Collision with the Z block.* Plausible on paper (the block is 100×100 mm at
  the machine origin, the paper origin was X42 Y20 inside its footprint), and
  there were pen marks on the block — but those were a *consequence*: once the
  coordinate frame had shifted, the pen was driven over the block. The
  carriage never actually struck it.
- *The G-code file.* Analysed in full: longest pen-down segment 7.94 mm, no
  jumps, no `G92`/`SET_KINEMATIC_POSITION`/`SET_GCODE_OFFSET`, all coordinates
  in range. The unwanted straight lines on paper were not in the file.
- *Paper movement.* The sheet was held by magnets and did not move.
- *`max_accel` too high.* 1500 was genuinely wrong for this gantry and was
  lowered to 500, but the fault survived the change — which was the clue that
  it was a torque limit, not an acceleration limit.

**The tell that identifies it as current, not speed.** The failure landed on
the same paths every run: the ones entered by a ~286 mm travel hop from the
far right of the canvas to the bottom-left corner. Long moves are the ones
that reach full velocity and therefore demand the most from the motors when
decelerating; short moves never get there. When the fault persisted at 50 mm/s
travel and 500 mm/s² accel, speed was no longer a credible explanation.

**Motion settings that produce clean plots** (2026-09-04):

| Setting | Value | Where |
|---|---|---|
| `run_current` X/Y/Y1 | **2.0 A** | printer.cfg `[tmc5160 stepper_*]` |
| `run_current` Z | 1.4 A | printer.cfg |
| `stealthchop_threshold` X/Y/Y1 | **0** (spreadCycle) | printer.cfg — stealthChop dropped steps on short fast pen-lift moves |
| `stealthchop_threshold` Z | 999999 (stealth) | printer.cfg — quiet, and Z is slow |
| `max_accel` | 500 | printer.cfg `[printer]` |
| `max_velocity` | 60 | printer.cfg `[printer]` |
| `max_z_velocity` | 5 | printer.cfg — ACME screw resonates audibly above ~5 mm/s |
| `max_z_accel` | 60 | printer.cfg |
| Draw F | 1800 | Muusia profile |
| Travel F | 3000 | Muusia profile |

Room to move: current has thermal headroom to ~2.2 A if a heavier tool needs
it, and `max_velocity`/`max_accel` can be raised stepwise now that the torque
floor is fixed — raise one at a time and re-run a long-travel job, because
short test moves will not reproduce the failure.

## 10. Related project docs (software side — not needed for mechanics)"""


def main():
    if not TARGET.exists():
        print(f"MISS  {TARGET} not found - run from the repo root")
        return 1
    s = TARGET.read_text()

    if "the lost-steps hunt" in s:
        print("SKIP  handoff already documents the lost-steps hunt")
        return 0

    fail = False
    for name, old in (("PSU current advice", OLD_PSU),
                      ("control board line", OLD_BOARD),
                      ("section 9 heading", ANCHOR_SEC9)):
        n = s.count(old)
        print(f"anchor '{name}': found {n} (expected 1)")
        if n != 1:
            fail = True
    if fail:
        print("MISS  anchors do not match - nothing written")
        return 1

    s = (s.replace(OLD_PSU, NEW_PSU, 1)
          .replace(OLD_BOARD, NEW_BOARD, 1)
          .replace(ANCHOR_SEC9, NEW_SECTION, 1))
    TARGET.write_text(s)
    print("OK    PSU note, board line and new session log written")

    chk = TARGET.read_text()
    tests = {
        "2.0 A recorded": "X/Y/Y1 run at 2.0 A RMS" in chk,
        "old 1.3-1.8 advice gone": "Run steppers at moderate current" not in chk,
        "board no longer 'ordered'": "up to 60 V) — ordered." not in chk,
        "new section 9 present": "## 9. Session log 2026-09-04" in chk,
        "old section renumbered to 10": "## 10. Related project docs" in chk,
        "only one section 9 heading": chk.count("## 9. ") == 1,
        "no duplicate related-docs": chk.count("Related project docs") == 1,
        "GET_POSITION method documented": "gcode base` unchanged but `stepper` disagrees" in chk,
        "LOST_STEPS caveat present": "Do not trust `LOST_STEPS`" in chk,
        "settings table present": "| `run_current` X/Y/Y1 | **2.0 A** |" in chk,
    }
    print("---- verify ----")
    for k, v in tests.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    ok = all(tests.values())
    print("\nRESULT: ALL OK" if ok else "\nRESULT: FAILURES - do not commit, report output")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
