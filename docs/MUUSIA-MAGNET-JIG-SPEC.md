# Muusia — Magnet Placement / Laser Jig Feature Spec (handoff)

Status: **design complete, not implemented.** Agreed with Daniel in a hardware-planning
chat (July 2026). This document is self-contained; verify implementation details
against the current v2.x source (Mega Canvas structure, export panel, machine
profile schema) before coding.

## Motivation

Daniel's new plotter (X-Carve frame + BTT Kraken v1.1 + Klipper) uses a steel bed
with magnets to hold paper. Magnets may sit **anywhere on the sheet, including
inside the drawing area** — the only constraint is that the pen must never collide
with a magnet. The tool's job: given the final drawing, **propose the N safest
magnet positions**, then drive the machine (pen up, laser pointer on) to each
position so Daniel can drop a magnet exactly where the laser dot lands.

## Core placement model

Grid-based, fixed cell size (default **10 mm**).

A cell is a **valid magnet location** iff:
1. Distance to the nearest pen path ≥ `clearance` (magnet radius + safety).
   Implementation: mark all cells touched by any path point/segment, dilate by
   `clearance`. Everything else is candidate space — inside or outside the drawing
   makes no difference. Empty interior regions of a drawing are explicitly
   desirable magnet spots (best paper hold-down).
2. Distance to every sheet edge ≥ `magnetMargin` (keeps proposals away from the
   outer rim where corner magnets / paper handling already live and where paper
   can slip).
3. Chosen magnets keep ≥ `minSpacing` between each other.

**Selection:** compute a distance transform (distance to nearest pen line) over
valid cells; greedily pick the N cells with the largest distance while enforcing
`minSpacing`. Magnets thus gravitate to the safest open areas automatically —
whether that's a blank center or an edge strip.

**Failure mode (must be graceful):** if fewer than N cells satisfy the
constraints, report clearly ("not enough safe space for N magnets — reduce
magnetMargin / clearance / magnet count"). Never silently place magnets too close
to pen lines, never crash on an empty candidate set.

### Parameters

| key | meaning | default idea |
|---|---|---|
| `magnets` | how many positions to propose | 4–6 |
| `grid` | cell size, mm | 10 |
| `clearance` | min distance from any pen line, mm | magnet radius + ~5 |
| `magnetMargin` | min distance from sheet edges, mm | ~10 |
| `minSpacing` | min distance between magnets, mm | ~40 |

## Architectural placement — export level, not a node

Agreed decision: the real logic lives in the **export panel**, alongside routing,
animation export and Mega Canvas ZIP — because it needs three things a DEFS node
cannot see:

1. The **final** geometry (after routing / tile clipping).
2. The **machine profile** (laser offset, commands).
3. The **Mega Canvas tiling** (per-sheet coordinates).

Optionally add a lightweight **preview-only node** ("Safe Areas", cat `mod`,
group `penout`): pass-through `compute`, `overlay` draws proposed magnet circles
(and optionally a safety heat map) for the single-canvas case. The export-side
calculation remains the source of truth.

## Mega Canvas behavior

Magnets hold a **physical sheet**, so everything is computed **per tile**:

- Run the placement per sheet, in that sheet's **local coordinates**
  (0..sheetW, 0..sheetH), using that sheet's **clipped** content.
- `magnetMargin` is measured from each tile's own edges (tile-clipped art often
  runs right to the seam, so the margin matters most here).
- Output: one jig per sheet. Preferred workflow interleaves per sheet:
  run jig N → place magnets → plot sheet N → swap paper → repeat.
  (Open question below: how to package this in the ZIP.)

## Laser pointer & machine profile

A small laser pointer mounts on the pen holder, inevitably offset from the pen
tip. The offset is a **machine property** → new machine-profile fields (safe to
add: profile import merges over `DEFAULT_MACHINE`, old profiles gain defaults):

```
laserOn      boolean — laser jig available on this machine
laserOffX    mm, laser dot offset from pen tip, X
laserOffY    mm, laser dot offset from pen tip, Y
laserOnCmd   g-code to switch laser on  (e.g. Klipper SET_PIN PIN=laser VALUE=1)
laserOffCmd  g-code to switch laser off
```

**Offset compensation (in jig g-code generation):** to point the laser at magnet
position `(x, y)`, move the *pen* to `(x − laserOffX, y − laserOffY)`. The pen
being off to the side is fine — it stays up the whole time.

## Jig g-code shape

```
home → pen up (stays up throughout) → laserOnCmd
for each magnet position (offset-compensated):
    travel move → stop (M0 "continue" OR G4 dwell — open question)
laserOffCmd → park/home
```

No pen-down moves anywhere. Conceptually this is a sibling of Travel Stop's
lift + M0 pattern, but generated as its **own small g-code file**, separate from
the artwork g-code.

## Open questions (decide during implementation)

1. **Laser control command** on the Kraken — depends on which Klipper pin/FET
   Daniel wires it to (`SET_PIN` macro vs `M3`/`M5` spindle-style). Leave the
   commands as free-text profile fields.
2. **Stop style at each magnet point:** `M0` (wait for user, relaxed) vs `G4`
   dwell (faster, rushed). M0 tentatively preferred.
3. **Mega Canvas ZIP packaging:** interleaved per sheet (jig-1, art-1, jig-2,
   art-2 …) vs two groups. Interleaved matches the physical workflow.

## Validation checklist (Node.js sandbox, before baking)

- All proposed positions ≥ `clearance` from every path segment (not just
  vertices — test with a long straight 2-point path).
- All positions ≥ `magnetMargin` from sheet edges, ≥ `minSpacing` pairwise.
- Deterministic: two identical runs → identical positions (no Math.random;
  greedy tie-break must be stable, e.g. by cell index).
- Graceful empty result: dense drawing + large margins → clear error, no crash,
  no unsafe placements.
- Pass-through preview node: output path set deep-equals input.
- Mega mode: positions expressed in tile-local coordinates; a path crossing a
  tile boundary blocks cells in **both** adjacent tiles' jigs.
- Laser offset: generated g-code coordinates = position − offset; offsets may be
  negative; offset must not push moves outside machine work area (clamp/warn).
