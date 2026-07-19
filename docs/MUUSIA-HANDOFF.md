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

- `muusia.jsx` — the whole app, one React file (~15280 lines, **172 nodes**, v2.20).
  Build target: `src/App.jsx` in a Vite project.
- `MUUSIA-README.md` — project doc: install, concepts, UI, machines, animation, arch.
- `MUUSIA-NODES.md` — every node explained.
- `MUUSIA-NODE-API.md` — custom-node authoring spec (written to hand to an AI).
- `muusia-machine-setup.html` — standalone machine-profile configurator (own file).

## Build / update routine

Vite + `vite-plugin-singlefile` → `dist/index.html` (standalone, offline).
Daniel's update loop: `cp ~/Downloads/muusia.jsx src/App.jsx && npm run build`.
Project lives at `~/plotter-patcher`. zsh chokes on pasted `#` comments.

## Palette grouping (generators)

Both generators and modifiers carry a `group` field placing them in collapsible
palette subfolders. `GEN_GROUPS`: geometric, organic, machines, nature, creatures,
space, scientific, structural, textimg. `MOD_GROUPS`: transform, deform, pathops,
cutsplit, fillstyle, penout. New gen/mod nodes MUST set `group`. Other categories
(dec/duo/math/route) are flat. Collapse state is `openGroups`. An **"All nodes" toggle** (`flatAZ`) lists every node alphabetically within its category (gen first, then mod, ...), ignoring folders. NOTE: JSX text does NOT process \uXXXX escapes — use literal characters or {"\u2013"} expressions in JSX text/attributes.

Travel Stop (mod/penout) tags paths with `__stop:{mode,msg}`; the G-code loop reads
it to emit a lift + M0/pen-change. It's the in-graph counterpart to the machine
profile's Maintenance pause. Route optimize reorders paths (preserving `__stop` via
spread) but that shifts distance spacing, so Travel Stop should be last + route opt
off.

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

## Magnet jig (v2.8)

Steel bed + magnets hold the paper; magnets may sit anywhere, including inside
the drawing, as long as the pen never hits one. The export panel's MAGNET JIG
section proposes the N safest spots (10 mm grid; exact segment-distance
clearance check + chamfer distance transform for ranking; greedy farthest-first
with min spacing; stable tie-break by cell index; partial results warn, empty
results error — never unsafe placements). `magnetPlacement(ps, sw, sh, opts)`
and `jigGcode(positions, prof, sheetW, sheetH, label)` are top-level, tested
functions right above APP_VERSION. Jig g-code: startG → pen up (servo or bed) →
laserOnCmd → per magnet a travel move (position MINUS laser offset, same
fx/fy origin+flipY mapping as toGcode) + pauseCmd stop → laserOffCmd → endG.
Off-work-area targets emit WARNING comments + UI notes. Machine profile gained
laserOn/laserOffX/laserOffY/laserOnCmd/laserOffCmd (merge-safe defaults;
LASER JIG section in machine settings). Mega: one jig per sheet in sheet-local
coords computed from that sheet's clipped tile (boundary-crossing art blocks
both tiles); files named `-tile-NN-rRcC-jig.gcode` sort next to their tiles;
multiple jigs bundle into `-jigs.zip`, single sheet downloads plain .gcode.
can't see node inputs, so it draws rings via compute on its own pen; export
remains the source of truth.

## Mega canvas (v1.9)

Works larger than one sheet: the MEGA CANVAS panel (right sidebar, above export)
multiplies the canvas into cols × rows sheets. Nodes need no changes — ctx.W/H
simply become the mega dimensions, so every node composes at full size. Preview
shows the whole work; per-sheet bed-fit check still uses single-sheet size.
Export previews tile 1 and Download saves ALL tiles as numbered files inside a
single ZIP (`name-tiles-gcode.zip`) — browsers block sequential programmatic
downloads, so the app has a minimal STORE-mode zip builder (`buildZip`/`crc32`,
verified against real unzip). Seam modes: **Overlap** (adjacent sheets repeat the
seam strip — cut through it and butt-join) and **Gap** (a seam-wide strip is
skipped — mount with spacing). Optional L-shaped crop marks at each tile's cut
rectangle corners. Settings persist in the project file. The slicer
(`sliceMega`, Liang-Barsky clipping) keeps fully-inside closed paths closed and
splits spanning paths into open runs. `APP_VERSION` is the single version
constant used by both the UI header and the G-code stamp.

## Pop-out preview (v2.0)

The ⧉ button in the preview header opens the live preview in its own window
(React portal into `window.open`; inline styles mean no stylesheet copying).
It tracks the popup's resize, follows all graph edits and animation live, and
detects closing by polling. Made for two-display work: nodes on one screen,
drawing on the other.

## Release routine pitfalls (hard-won)

- Browsers do NOT overwrite existing files in ~/Downloads — they save
  `name (1).ext`, so `cp ~/Downloads/name` silently picks the OLD file. Run
  `rm ~/Downloads/muusia.jsx MUUSIA-*.md` before downloading, and always verify
  with `grep -c 'cat: "' src/App.jsx` (node count) and `head -1 docs/*.md`
  (version headers) before committing.
- zsh does not accept `#` comments in interactive commands — never paste
  commands with trailing comments.
- Live-page debugging: `curl -s <url> | wc -c` + version grep distinguishes
  "deploy broken" from "browser/CDN cache" (Pages CDN lags ~10 min).

## Current node inventory (172)

- **Generators (82):** Grid, Tracks, Flow Field, Truchet, Lissajous, Phyllotaxis,
  L-System, Spirograph, Pendulum, Cycloid Machine, Contours, Circle Packing,
  Barcode, Solids, Mountains, Random Lines, Starfield, Ruler, Cables, Lathe, Fabric,
  Hairs, Potato, Trunks, Water, Skyline, Tiles, Reg Marks, Noise, Net, Building,
  Follow Lines, Wood Rings, Worm, Image, Growth, Concrete Poetry, Scan, Clouds, Stone,
  Asteroids, Planets, Solar System, Test Card, Origami, Mesh, Ribbon, Halftone, Import SVG, Stroke, Text,
  Caustics, Text on Path, Lace, Macrame, Knot, Murmuration, Dazzle Camouflage,
  Mycelial Net, Sand Line Hatch, Gravity Cascade, Tape Saturation Harmonics,
  Hyperbolic Truchet Maze, Voronoi, Metaballs, Trace, Harmonograph, FM Rose, Conway, Superformula, String,
  Delaunay, Attractor, Reaction-Diffusion, Julia, Differential Growth, Runes,
  Network, Tubes, Girih, Aggregate, Turtle, Lichen, Smoke, Himmeli, Polka Dots.
- **Modifiers (50):** Apply Style, Wave, Jitter, Rotate, Glitch, Offset, Symmetry,
  Smooth, Magnet, Trim/Extend, Join Ends, Simplify, Lens, Warp, Mirror, Move/Scale,
  Fit to Canvas, Reverse, Skew, Align, Crop, Explosion, Stretch, Tangle Zone,
  Scatter, Pen Cycle, Chop, Hatch Fill, Fresnel Lens, Travel Stop, Glitch Loom,
  Origami Glitch Fold, Cellular Mosaic Displace, Occlude, Cage Warp, Carve, Echo,
  Displace by Image, Travel Sort, Cull, Granulate, Fold, Bitcrush, Tile Shuffle,
  Kaleidoscope, To Polar, Filter, Fourier, SDF Contours, 3D View.
- **Decorators (5):** Stamp, Outline, Coil, Fur, End Caps.
- **Combiners (10):** Mask, Merge, Split, Array, Group, Copy to Points, Stencil, Switch, Ray, Mini Canvas, Negative Space, Diff Pens, Hand Drawn, Subway Map, PCB Tracks, Moon Craters, Comets, Rect Collage, Blueberry Sprig, 3D Glitch, Power Pole.
- **Math (9):** Frame, Value, Math, Random, Fan, LFO, Steps, Shaper, ADSR.
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
dipZ, dipEvery, dipDwell, maintOn, maintEvery, maintMsg, maintPark, maintX, maintY } }`. Import merges over `DEFAULT_MACHINE` so old profiles
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


## v2.18 UI features
- Canvas W/H inputs use NumBox (type freely, clamps to >=10 on blur, no upper cap — 1 m bed sizes work).
- Node slider setup mode: gear icon in the node header opens SLIDER SETUP, a per-node
  max override for every slider/number param, stored in node.pmax (saved with the project,
  reset arrow restores the default). ParamRow applies the override via def substitution.
- Magnet jig preview: "Show magnets in preview" checkbox in the export panel's MAGNET JIG
  section overlays dashed rings + crosshairs (guides channel, never plots) at the proposed
  positions — per tile with correct offsets in Mega mode (Gap: c*(W+seam), Overlap: c*(W-seam)).
- Safe Areas node removed: the jig preview toggle covers it at export level (the source of truth).

## v2.19: manual magnet placement
- MAGNET JIG has Mode: Auto | Manual. Manual: "+ Place magnets" arms click-to-place in
  BOTH previews (small + big overlay); drag moves a magnet, double-click removes, Clear wipes.
- Magnets render as a direct interactive SVG layer in PathsSVG (props magnets/onMagnets/placing)
  - NOT the guides channel. This also fixed invisible auto-markers (root cause: magnetPlacement
  returns [x,y] arrays, first preview code read q.x/q.y).
- Coordinates: exact mm, 0.1 precision; single sheet = canvas mm, mega = mega mm, and export
  splits per tile (cc=floor(x/dx), local=x-cc*dx, clamped into sheet).
- Persisted in project JSON as jig:{mode, magnets}; loading old projects resets to Auto/[].
- Auto mode unchanged (jigShow checkbox previews computed positions through the same layer).

## v2.20: node nicknames
User-level nicknames per node TYPE (localStorage muusia-nicks, not in project files).
Edited in the gear panel (now NODE SETUP: Nickname field + slider maxes). Shown in node
headers (replaces name), palette rows and quick-add results (accent, after name); quick-add
search matches name OR nickname.
