# MUUSIA — Project Handoff / Continuation Notes

Read this first when resuming Muusia development in a new chat. It captures the
current state, the conventions that must not be broken, and what's next. Pair it
with the four source/doc files, which are the source of truth.

## What Muusia is

A browser-based React node-graph editor for generative pen-plotter art, targeting a
pen-converted Ultimaker S5. Build images by wiring nodes (generators → modifiers →
export), get G-code or layered SVG. Everything deterministic (seeded), everything
live-previewed, every numeric parameter drivable by other nodes including an
animation frame clock. Formerly "Plotter Patcher"; renamed to Muusia.

Daniel (Helsinki, AV/video systems + hardware maker) is the developer. Working
language of these sessions is **Finnish**; code identifiers and all user-facing GUI
text are **English**.

## Files (all in outputs)

- `muusia.jsx` — the whole app, one React file (~8750 lines, **91 nodes**, v1.2).
  Build target: `src/App.jsx` in a Vite project.
- `MUUSIA-README.md` — project doc: install, concepts, UI, machines, animation, arch.
- `MUUSIA-NODES.md` — every node explained.
- `MUUSIA-NODE-API.md` — custom-node authoring spec (written to hand to an AI).
- `muusia-machine-setup.html` — standalone machine-profile configurator (own file).

## Build / update routine

Vite + `vite-plugin-singlefile` → `dist/index.html` (standalone, offline).
Daniel's update loop: `cp ~/Downloads/muusia.jsx src/App.jsx && npm run build`.
Project lives at `~/plotter-patcher`. zsh chokes on pasted `#` comments.

## Architecture — do not break these

- **One registry `DEFS`.** Each node is a self-contained entry: `name, cat, ins,
  outs, params, optional overlay(p,ctx), compute(ins, p, ctx, node)`. The engine
  knows nothing about specific nodes. Adding a node never touches existing code.
- **path-set datatype:** `{ paths: [{ pts:[[x,y]...], closed, layer }] }` in mm.
  **Point order = pen direction** (first-class; routing, brush rotation, Reverse all
  respect it).
- **Typed wires:** paths (blue) / value (green) / style (yellow). Every numeric
  param auto-exposes a green input port; value wires encode as `toPort: "p:paramKey"`.
- **Determinism:** no `Math.random()` anywhere — all randomness from seed params via
  `mulberry32`/`hash2`/`noise2`. This is what makes animation reproducible.
- **Node helpers** available inside `compute`: `Pin, EMPTY, PENS, mulberry32, hash2,
  noise2, resample, pathLength, applyStyle, signedArea`, plus module-level `SFONT`
  and `fontStrokes()` (single-stroke font) for text-drawing nodes.
- **Legacy Finnish internal keys** (do NOT rename — patches depend on them):
  `viiva`=Tracks-ish, `radat`=Tracks, `arvo`=Value, `matem`=Math,
  `satunnainen`=Random, `tyylita`=Apply Style. Their display names are English.
- Custom-node sources embed in saved patches. Patch id `"muusia"` (old
  `"plotter-patcher"` still loads), extension `.muusia.json`; modules
  `"muusia-module"`. `localStorage` key is still `"plotterpatcher-default"`.

## Node authoring recipe (how new nodes were added this project)

1. Write the node as a standalone `({ key:"x", name, cat, ins, outs, params,
   overlay?, compute })` file, e.g. `x.plotternode.js`.
2. Validate in Node.js by extracting the def between its `key: {` and the next
   `\n  },\n`, stubbing the helpers, and running `compute` for every mode/toggle:
   check all coords finite, no <2-point paths, determinism (two identical runs
   equal), and any invariant that matters (rings don't cross, curve monotonic,
   bilateral symmetry, bounded in zone, etc.). **Verify inside the node's block, not
   the whole file** (a past Explosion bug came from matching the wrong indentation).
3. Bake into `muusia.jsx`: strip the `key:` line, indent +2, insert before the
   `  origami: {` anchor in DEFS.
4. Update `MUUSIA-NODES.md` and the node counts in both docs.
5. Re-check global bracket/brace balance (string-strip then count). A persistent
   "paren diff −1" is a **measurement artifact** (regex literals + the `"("`/`")"`
   glyph keys in SFONT), not a real error — esbuild compiles clean.

## Current node inventory (91)

- **Generators (46):** Grid, Tracks, Flow Field, Truchet, Lissajous, Phyllotaxis,
  L-System, Spirograph, Pendulum, Cycloid Machine, Contours, Circle Packing,
  Barcode, Solids, Mountains, Random Lines, Starfield, Ruler, Cables, Lathe, Fabric,
  Hairs, Potato, Trunks, Water, Skyline, Tiles, Reg Marks, Noise, Net, Building,
  Follow Lines, Wood Rings, Worm, Image, Growth, Concrete Poetry, Scan, Creature,
  Origami, Mesh, Ribbon, Halftone, Import SVG, Stroke, Text.
- **Modifiers (29):** Apply Style, Wave, Jitter, Rotate, Glitch, Offset, Symmetry,
  Smooth, Magnet, Trim/Extend, Join Ends, Simplify, Lens, Warp, Mirror, Move/Scale,
  Fit to Canvas, Reverse, Skew, Align, Crop, Explosion, Stretch, Tangle Zone,
  Scatter, Pen Cycle, Chop, Hatch Fill, Fresnel Lens.
- **Decorators (5):** Stamp, Outline, Coil, Fur, End Caps.
- **Combiners (5):** Mask, Merge, Split, Array, Group.
- **Math (5):** Frame, Value, Math, Random, Fan.
- **Routing (1):** Route (hidden; routing lives in the export panel).

## Systems added over the project (beyond nodes)

- **Animation:** Frame node (t / frame# / wave / ping-pong, seamless loops),
  ANIMATE panel with live ▶ preview, per-frame G-code/SVG export (one file per
  frame). Full rotation = `frame# × (360/frameCount)`, not `t × 360` (avoids a
  duplicate loop frame). Anything not wired to Frame is identical every frame.
- **Help & Examples:** "? Help" button (accent-outlined) → overlay with 5 loadable
  beginner patches (built programmatically) + sections KEYBOARD SHORTCUTS / BASICS /
  EXPORT & MACHINE / ANIMATION / CUSTOM NODES.
- **Custom nodes / modules:** Node ⇣ import (embeds source), Mod ⇡/⇣ subgraph
  export/import.
- **Group parameter promotion:** ☆ next to a param inside a group exposes it on the
  group's face (`node.promoted[{nodeId,key}]`); × removes. No value ports yet
  (roadmap).
- **Image node:** raster → grayscale (async decode in inspector), 4 render modes
  (Scanline wave / Halftone dots / Hatch levels / Flow shade).
- **Growth node:** differential growth (spatial hash, neighbor-excluded repulsion,
  growth-pressure + long-edge splits, MAXP 2400, history rings).
- **Machine Setup:** multiple profiles, bed diagram (canvas on bed + fit warning),
  profile import/export (⇣/⇡, `.muusia-machine.json`). **Bed-plotter Z handling:**
  `zHop`+`zHopOn` (small travel lift; full `penUp` reserved for pen changes),
  `penDelayDown`/`penDelayUp` (ms settle dwells via `G4 P`), `zFeed` lift speed.
  Standalone `muusia-machine-setup.html` builds profiles with presets (S5 bed /
  servo / brush), bed diagram, and a lift-time estimate.

## Machine profile schema (for the configurator ↔ app contract)

`{ app:"muusia-machine", v:1, prof:{ name, workW, workH, originX, originY, flipY,
pauseCmd, startG, endG, penUp, penDown, zHop, zHopOn, zFeed, penDelayDown,
penDelayUp, feedDraw, feedTravel, rotOn, rotStepper, rotThresh, dipOn, dipX, dipY,
dipZ, dipEvery, dipDwell } }`. Import merges over `DEFAULT_MACHINE` so old profiles
gain new fields.

## Roadmap / open ideas (priority order)

1. **GitHub repo** — Daniel said "later"; v1.x + docs are ready to be the README.
2. **Value ports on promoted group params** (currently manual-edit only).
3. **Custom pen palettes** + **per-pen time estimates**.
4. **Klipper/Marlin profile presets** in the configurator once the S5 conversion is
   confirmed on hardware.
5. First real plot pending: S5 pen conversion (clogged-nozzle repurpose; Cura route
   with extruder/heater disabled is the preferred g-code shape). Bed-Z lift is slow —
   z-hop + settle delays were added for exactly this. Start Draw F low (~800).

## Hardware reality (context for machine advice)

Ultimaker S5, pen-converted. The Z axis is the heavy heated bed → every lift is a
slow big-mass move, and the pen can drag if it moves before the bed settles. That's
why z-hop (don't lift full height between nearby paths) and settle delays (pause
after bed moves) exist. Firmware is picky about print-job-shaped g-code.
