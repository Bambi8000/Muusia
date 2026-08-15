# MUUSIA — Project Handoff / Continuation Notes

Read this first when resuming Muusia development in a new chat. It captures the
current state, the conventions that must not be broken, and how work is done.
The repo itself is the source of truth; this file is the map.

## What Muusia is

A browser-based React node-graph editor for generative pen-plotter art, targeting a
pen-converted Ultimaker S5 and a salvaged X-Carve build (BTT Kraken + Klipper).
Build images by wiring nodes (generators → modifiers → export), get G-code or
layered SVG. Everything deterministic (seeded), everything live-previewed, every
numeric parameter drivable by other nodes including an animation frame clock.
Formerly "Plotter Patcher"; renamed to Muusia.

Daniel (Helsinki, AV/video systems + hardware maker) is the developer. Working
language of dev sessions is **Finnish**; code identifiers and all user-facing GUI
text are **English**.

## Repo layout (post-C0 split, v2.31)

- `src/App.jsx` — engine + UI only (~3.8k lines): graph evaluation, canvas, palette,
  inspector, preview (ZoomBox), export panel, machine setup, Mega Canvas, magnet jig,
  animation, help. Beginner examples moved to `src/examples.js` (loadExample
  injects `defaults` and honors an optional per-example `canvas:{W,H}`).
  Also hosts the two engine-bound DEFS entries: `group`, `reititys`.
- `src/defs/helpers.js` — shared node helpers: `Pin, EMPTY, PENS (+PENS_DEFAULT,
  savePens, resetPens), mulberry32, hash2, noise2, resample, pathLength, applyStyle,
  isStyle, signedArea, parseSVG, SFONT, fontStrokes`. PENS loads user colors from
  localStorage key `muusia-pens` at import time (try/catch — Node CLI runs warn
  harmlessly about localstorage).
- `src/defs/nodes/*.js` — one file per node, **237 files** (239 nodes total with
  group + reititys; Generators 140, Modifiers 69). ESM format:
  `import { ... } from "../helpers.js";` + `export default { key: "x", name, cat,
  group, desc, ins, outs, params, overlay?, compute };`
- `src/defs/index.js` — assembles `DEFS_NODES` via `import.meta.glob` (eager),
  alphabetical by filename. **Adding a built-in node = dropping a file here.**
- `src/examples.js` — Help beginner examples: `{ name, desc, make(defaults) }`
  factories, node ids 9001+ / edge ids e9101+ (loadExample resets NEXT_ID to
  9500), params as diffs over `defaults(type)`, built-in nodes only, fixed
  seeds, optional `canvas:{W,H}`. Zero imports — runs in plain Node; check
  with `node tools/validate-examples.mjs` before build. New examples arrive
  as module exports (`*-module.json`, whole graph selected) and are converted
  to entries (param-diff + id renumbering).
- `src/dro.jsx` — Moonraker DRO: self-contained read-only websocket client +
  top-bar chip (live X/Y/Z, homed-axes dimming, 3 s auto-reconnect,
  re-subscribe on klippy restart). URL in the machine profile
  (`moonrakerUrl`). LAN/local only by design — since v2.50 an https origin
  with a ws:// URL never attempts to connect (mixed content cannot succeed):
  the Pages build shows a static dim "DRO LAN only" chip instead of a retry
  loop. The chip is fixed-width (constant "DRO" label, state in the dot color
  + tooltip, always-rendered X/Y/Z slots with tabular figures and dashes) so
  state transitions never reflow the top bar.
  Wired into App.jsx via tools/era/patch-dro.mjs.
- `src/catalog-browser.jsx` — the visual node catalog (B / toolbar Catalog):
  every non-hidden node as a live thumbnail (compute with default params on a
  fixed 150×100 mm thumb canvas; paths inputs get standard fixtures — first
  input circle+squiggle+rows, later inputs squiggle+rows so duo nodes see two
  different sets; 6000-pt budget per thumb, lazy 3-per-tick chunks, session
  cache). Deep search + category/tag filters + Surprise me; value/style
  outputs and file-input nodes get typed placeholders. Self-contained module
  (DEFS/CATALOG/PENS/theme injected as props), wired via
  tools/era/patch-catalog-browser-v259.mjs.
- `src/stack-view.jsx` — 3D layer stack preview + physical export (S /
  toolbar Stack): the drawing split into sheets (animation frames, max 12,
  or pens) and stacked as translucent plexi/glass panes in a rotatable
  CSS-3D view — drag to rotate, sheet spacing in mm, reverse order,
  per-sheet visibility, plexi tint, dark/paper/custom background,
  auto-orbit. Sheets render once to cached canvases; rotation never
  re-evaluates the graph. PHYSICAL EXPORT: per-sheet SVG/DXF/G-code files
  as ONE ZIP (buildZip — no browser multi-download prompt), sheet margin
  (physical sheet = canvas + margin), Mirror for back-painting (plot files
  only; preview stays the front view), drill marks M3/M4/M5 (clearance
  3.2/4.3/5.3 mm, corner inset param) and SFONT n/N sheet numbers on a
  selectable Mark pen. Preview shows margin + marks live. Mega Canvas and
  the stack don't combine. Self-contained (PENS/theme/evalFrame/exportText/
  buildZip/fontStrokes injected as props), wired via
  tools/era/patch-stack-view.mjs + tools/era/patch-stack-export.mjs.
- `docs/` — MUUSIA-HANDOFF.md (this), MUUSIA-NODES.md (every node),
  MUUSIA-NODE-API.md (custom-node authoring spec, plotternode format),
  MUUSIA-MAP.md (OSM map import guide: overpass-turbo workflow, sizing, queries),
  MUUSIA-PLOTTER-MECH-HANDOFF.md (X-Carve build: mechanics + ink blot tool),
  MUUSIA-MAGNET-JIG-SPEC.md (safe-areas / laser jig feature, design complete),
  MUUSIA-NODES-SRC.md (generated here by `tools/make-src-bundle.mjs`),
  MUUSIA-TAGS.json (curated node tag vocabulary, ~55 tags; merged into
  src/defs/catalog.js by make-catalog.mjs — tag a new node here in the doc
  batch).
  MUUSIA-PORTRAIT-SPEC.md (Portrait node: face analysis + tonal rounds +
  one-line modes, design complete),
- `klipper/` — machine-side configs at the repo root: `printer.cfg` draft for
  the BTT Kraken, `moonraker-cors.snippet.conf`, pen-cal drafts, README with
  the firmware build recipe. Version-controlled source of truth; live copies
  on the Pi (`viivain`). Outside `src/` and `public/` — never touches the Vite
  build or Pages. Details: MUUSIA-PLOTTER-MECH-HANDOFF.md §1 and §5.1.
- `tools/` — living tools only; applied one-shots (surgery, versioned doc
  patches, era validators) live in `tools/era/` — do **not** re-run, anchored
  patches are not idempotent. Living: `extract.mjs`,
  `patch-docs.mjs`, `make-src-bundle.mjs`, **`bake.mjs`** (lab → built-in
  converter), `validate-examples.mjs` (structural check for src/examples.js). Every new node gets a
  `tools/validate-<name>.mjs` before it ships.
- `nodes-lab/` — experimental `.plotternode.js` files for the in-app **Node ⇣**
  import; not part of the build. Approved experiments graduate to `src/defs/nodes/`
  via `node tools/bake.mjs <name...>` (or `--all`): detects used helpers,
  writes the import line + `export default`, smoke-imports the result and
  deletes it on failure — no manual wrapper conversion. **Delete the lab file
  after a successful bake**: baked `src/defs/nodes/` is the source of truth,
  and a stale lab file can overwrite newer fixes on a re-bake (see
  nodes-lab/README.md).

## Build / release routine

- `npm run build` → `dist/index.html` (vite + vite-plugin-singlefile; standalone,
  offline). `npm run dev` for live work.
- Node count check: `ls src/defs/nodes | wc -l` (237) — the old
  `grep -c 'cat: "'` on App.jsx is dead.
- Version: single `APP_VERSION` constant in App.jsx (UI header + G-code stamp).
  Bump with `sed -i '' 's/APP_VERSION = "2.XX"/APP_VERSION = "2.YY"/' src/App.jsx`,
  verify with `grep -o 'APP_VERSION = "[^"]*"' src/App.jsx`.
- Deploy: git push → GitHub Pages via CI (`.github/workflows/deploy.yml`),
  which serves **only the built `dist/`** — repo `docs/` is never online.
  Anything that must be reachable on Pages goes in `public/` (Vite copies it
  verbatim into dist, e.g. `public/sim/` → /Muusia/sim/). CDN lags ~10 min; `curl -s <url> | wc -c` +
  version grep distinguishes broken deploy from cache.
- zsh does not accept `#` comments in pasted commands.
- `.gitignore` covers `src/App.jsx.bak-*` (surgery-era backups).
- Hard-removal policy: nodes/params may be removed or change defaults between
  versions; old patches referencing removed keys are accepted casualties (Daniel
  keeps no critical legacy patches).

## Node authoring recipe (current)

1. Experiment as `nodes-lab/x.plotternode.js` (spec: MUUSIA-NODE-API.md), import
   via **Node ⇣**, iterate on look with Daniel.
2. Bake: `node tools/bake.mjs x` → `src/defs/nodes/x.js` (auto helper-import
   detection + ESM wrapper + import smoke-test; failed bakes are removed),
   then delete the lab file.
3. Write `tools/validate-x.mjs`: plain ESM imports of the node (no stubs needed),
   assert determinism (double run equal), finite coords, ≥2-pt paths, in-bounds,
   and every parameter's *liveness* plus any invariant that matters (symmetry,
   no-overlap gap, monotonic width, graph connectivity...). Run before build.
4. `npm run build` is the syntax gate — errors point at the exact node file.
5. Update `docs/MUUSIA-NODES.md` (paragraph + counts) + the HANDOFF version
   history **immediately after every push** — the standing doc-batch rule
   (agreed v2.38): docs never lag a release.

## Working conventions (collaboration)

- **Command sequences, always in full:** every procedure — release, patch,
  test run, file moves — is delivered as complete copy-paste-ready zsh-safe
  command blocks with expected outputs stated, never described in prose only.
  No `#` comments in interactive commands (zsh).
- **Complete files over diffs** when an edit is complex or error-prone:
  deliver the whole replacement file rather than fragments to hand-merge.
- **Docs never lag a release:** the doc batch (NODES.md paragraph + counts,
  HANDOFF version history, NODE-API when the API moved) happens immediately
  after every push — see the node authoring recipe above.
- **Session start:** refresh project files (HANDOFF, NODES, NODES-SRC via
  `make-src-bundle.mjs`, NODE-API, App.jsx, analyze.js) so work never runs
  against stale copies.

- **Doc batches as era scripts:** version-numbered doc updates (NODES.md
  counts/paragraph anchors, HANDOFF history, NODE-API) ship as a one-shot
  script in tools/era/ (patch-docs-vXXX.mjs) with OK/MISS/SKIP reporting —
  no manual file surgery. Run once from the repo root, commit the script
  with the docs.
- **File delivery:** Daniel moves downloaded lab nodes to nodes-lab/ and
  validators to tools/ himself; sessions deliver files + commands only, no
  cp-from-Downloads sequences. Lab nodes must be plain ({...}) object
  literals — bake.mjs rejects IIFEs; share compute/overlay logic via a
  this._helper method (the engine calls both as methods on the def).

## Architecture — do not break these

- **One registry `DEFS`** = `{ ...DEFS_NODES, group, reititys }` in App.jsx. The
  engine knows nothing about specific nodes.
- **path-set datatype:** `{ paths: [{ pts:[[x,y]...], closed, layer }] }` in mm.
  **Point order = pen direction** (routing, brush rotation, Reverse respect it).
- **Pens:** 12 (indices 0–11), colors user-editable via the toolbar **Pens**
  popover (persisted in localStorage, preview/SVG only — G-code just names them:
  `; Pen 7: Magenta`). Nodes cycle with `% PENS.length`.
- **Typed wires:** paths (blue) / value (green) / style (yellow). Every numeric
  param auto-exposes a green input port (`toPort: "p:paramKey"`).
- **Determinism:** no `Math.random()` — all randomness from seed params via
  `mulberry32`/`hash2`/`noise2`.
- **Legacy Finnish internal keys** (do NOT rename — patches depend on them):
  `viiva`=Stroke, `radat`=Tracks, `arvo`=Value, `matem`=Math,
  `satunnainen`=Random, `tyylita`=Apply Style, `aaltoilu`=Wave. Display names
  are English; more Finnish keys exist in `src/defs/nodes/` filenames — never
  rename a node's `key`, only its `name`.
- Custom-node sources embed in saved patches. Patch id `"muusia"` (old
  `"plotter-patcher"` still loads), extension `.muusia.json`; `localStorage`
  default-patch key is still `"plotterpatcher-default"`.
- Custom import keys must not collide with built-ins (`evaluateNodeDef` rejects).

## UI systems (beyond nodes)

- **Preview zoom:** ZoomBox wraps the sidebar preview and the big preview — wheel
  zooms to cursor (1–16×), drag pans (magnet handles keep their own drag: pan
  ignores mousedown on circle/text), dblclick resets. The pop-out window zooms by
  width % with cursor-anchored scroll compensation + grab-drag pan.
- **Paper presets:** toolbar select (A5/A4/A3/A2 × wide/tall) sets canvas W×H;
  NumBoxes remain for custom sizes.
- **Node card header:** ? help · ⚙ slider setup · **D duplicate (that node)** ·
  minimize. `duplicateIds(ids)` is the core; Cmd/Ctrl+D duplicates the selection.
- **Add & Tidy:** `addNode` grid-scans the visible viewport for empty space
  (measured card boxes via `cardEls`); toolbar **Tidy** = `tidyNodes()`
  dependency-column layout (both live next to `addNodeAt` in App.jsx).
- **Moonraker DRO:** top-bar chip (src/dro.jsx) — click toggles the
  connection; green = klippy ready, amber = connecting / klippy down, red =
  retrying; the label is always "DRO" and the X/Y/Z slots are fixed-width
  (dashes while offline), so the top bar never jumps. On an https origin
  with a ws:// URL the chip is a static dim "LAN only" (no retry loop).
  Requires the local dev origins in Moonraker's cors_domains
  (klipper/moonraker-cors.snippet.conf, applied on viivain). Read-only: it
  never sends G-code.
- **Animation, Mini Canvas, magnet jig, machine profiles,
  Travel Stop, custom modules:** unchanged since v2.0–2.1 era; see MUUSIA-NODES.md
  and README for user-facing docs. Magnet jig functions (`magnetPlacement`,
  `jigGcode`, `buildZip`/`crc32`) live above APP_VERSION in App.jsx.
- **Mega Canvas Kinds (v2.50):** Sheets (the original C×R grid, sliceMega) or
  **Roll** — wallpaper strips: roll width × strips side by side (seam join in X
  only), pieces along the roll with no Y seam (sliceRoll, per-tile W/H, short
  last piece), registration ticks at piece boundaries, `S# P#` labels,
  `strip-XX-piece-YY` filenames, jig split and patch save/load fields
  (`mega.kind` + roll params; old patches load as Sheets byte-identically).
  Export kinds: G-code, SVG, and **DXF R12** (toDXF next to toSVG: POLYLINE
  per path on PEN_n layers, nearest-ACI colors, y-up flip, plunge z dropped).

## Version history (condensed)

- **2.21** removed 8 nodes (Macrame, Reaction-Diffusion, String, Tape Saturation
  Harmonics, Planets, Solar System, Building, Filter); Scan→**Seismic** (seismic
  branch only); Power Pole trimmed to 3 models; Mycelial Net→**Root Web**;
  Trace→**Trace Image**; baked **Set Pen** (mod/penout).
- **2.22** fixes: Mountains cross-mesh (dead `rowStep` ReferenceError), Delaunay
  spacing (600-pt cap masked the slider → spacing escalation), **Smooth rewrite**
  (Relax mm-radius moving average + Round corners/Chaikin), Potato **No overlap**
  default (true-extent check), Moon Craters default Top view.
- **2.23** **12 editable pens** + Pens popover (localStorage), paper size presets,
  node **D** button, preview zoom everywhere, pen index in G-code comments.
- **C0** (no version bump): split 163 nodes into `src/defs/nodes/`, helpers module,
  tools/ + nodes-lab/. Engine/UI now ~3.8k lines.
- **2.24** Clouds rebaked as the **engraved** version (lobe circles, scalloped
  visible arcs, inner creases, upward-thinning hatch, dashed drop shadow); new
  **Zigzag** generator (Zigzag/Sine/Square, skew, noise envelope, row phase,
  Spine input).
- **2.25** new **Bridges** modifier (points from path centers/vertices/endpoints;
  k-nearest / within-distance / chain / Delaunay; trim ends; per-point cap).
- **2.26** new **Mycelium Fill** modifier (junction-swelling strands along a line
  network; junction detection = endpoint clusters deg≥3 + cross-path
  intersections; territory cut with junction-merge exception).
- **2.27** Knot torus-only (Lissajous removed), FM Rose ring pen cycling,
  Attractor Lorenz full params (a→ρ, b→σ, c→β, d→speed; legacy "Lorenz (x-z)"
  string still matches via startsWith) + projection plane.
- **2.28** Truchet **Tile fill %** + **Separate (never meet)** (radius clamp
  ≤0.7·tile + forced ≥1 mm edge gap = provably crossing-free), Tiles
  **Brick/Hex-pack** layouts + **Alternate flip**, Hyperbolic Maze **Solve**
  strand (edge-midpoint graph trace, center→rim, arcs style only).
- **2.29** Turtle **presets** (8 programs, Custom default), Gravity Cascade
  **wells layouts** (Triangle/Line/Ring/Center+ring/Random) + **launch modes**
  (Ring/Top rain/Spiral; Triangle+Ring preserves classic rng order), Test Card
  **Pen palette (12)** + grid auto-fit to canvas.
- **2.30** Mega Canvas: **composed full-SVG proof export** (one SVG at mega size,
  proofing reference vs preview) + **tile labels** (running number + R/C at each
  sheet's bottom-left, mark pen, persisted in project files); fixed XML comment
  placement in mega SVG exports (comments must follow the declaration — Chrome
  rejects, Quick Look silently accepts); sliceMega portrait regression validator.
- **2.31** new **Smear** modifier (pixel-stretch for lines: V/H streaks or Free
  bridge chords at zone boundary crossings, From-edge filter for seamless
  one-sided continuation).
- **2.32** four new nodes: **Point Cloud** (13 parametric shapes + xyz/ply
  import, 3D k-nearest wire mesh, bitcrush, keep-size), **ASCII Art**
  (lines/image → stroke-font characters), **Eraser** (zone erase/crop, gap,
  invert), **Squiggle** (per-line waveform rewrite, closed-path period snap);
  custom-node sandbox completed (SFONT/fontStrokes/isStyle/parseSVG);
  `fileAccept` for file params.
- **2.33** nine new nodes: **Parallel Lines** (terraced line field, Grass/
  Shoulder/Cascade tops), **Perforated Mesh** (cube-sphere/cube/pyramid quad
  mesh, funnel craters, mesh flow, Solid/Transparent), **Glyph Halftone**
  (noise/image → dot/ring/cluster/stripe/chevron grid, 2×2 big cells),
  **Pattern Fill** (nine-texture shape shading + Mix, gradient light, ± edge
  offset), **Pebble** (spiral-shell moiré stone + 3D mesh, Round–Angular
  fader), **Organic Rings** (agate strands, knot bulges, dot halo),
  **Round Canvas** (distorted circular crop), **Retro Mesh** (perspective
  hourglass/funnel/horn + laser floor), **Ripple** (water reflection,
  Full/Pool/Box areas, guide overlays); overlay guideline added to NODE-API
  (spatial params must ship overlay guides).
- **2.34** six new nodes: **Diagram** (flow diagrams: orthogonal arrow routing,
  Under-crossings, filled heads), **Empty Fill** (mod: pattern-fills the empty
  space around shapes via chamfer distance field — Coils/Contours/Scales/Hatch/
  Waves), **Volcano** (3-D crater mountain, float-horizon hidden lines, five
  render styles incl. altitude-sized Dots, Yaw/Tilt fly-over), **Nested Circles**
  (woven over/under ring discs, Weave/Weave fill/Stack + Opaque/Transparent
  background), **Road Map** (Voronoi districts, recursive block-subdivision
  streets, 3-weight road hierarchy, motorways + ramps, river/lakes, fields,
  landmarks), **Map Import** (OSM GeoJSON → weighted plottable city; guide in
  docs/MUUSIA-MAP.md). Engine conventions documented in NODE-API: onFile results
  land at node.data.svg; fileLabel/fileAccept are definition-level fields.
  Shared-geometry hardening: collinear-corner rounding no longer bulges a
  half-circle (cornerize/cornerRound in Diagram + Road Map).
- **2.35** two nodes + AN ARCHITECTURE CHANGE. Nodes: **Spore Print** (mushroom
  gill anatomy: binary lamellula hierarchy, fade, dust, rim band, multi-cap
  sheets), **Brush Z** (mod/penout: brush pressure as the optional THIRD point
  component = mm plunge below pen-down; 8 waves along arc length, end taper,
  ghost width preview; must be last in chain). Architecture: **G-code export
  now reads the z component** (tools/patch-brushz-gcode.mjs, 5 anchored edits
  to toGcode) — draw moves become G1 X Y Z F so Klipper interpolates pressure
  continuously; activates purely by z presence, servo mode skips Z, 6 mm safety
  clamp, plain paths byte-identical. Physical brush test pending hardware.
- **2.36** five nodes: **Double Pendulum** (RK4 chaos traces, perturbation
  bundles, damping settles to rest — validated against physics invariants),
  **Gyroid** (TPMS slice contours + Retro Mesh camera; Surface Solid =
  ray-marched exact hidden lines against the implicit field, Solid output is a
  strict subset of Transparent with shared framing), **Cracked Paint**
  (hierarchical craquelure via BSP flakes, generation-width cracks, chips,
  edge curl), **Wave Hatch** (non-crossing noise seams + vertical stroke
  bands, negative-space waves), **Burr Cluster** (chained noise lobes, layered
  hatch, visible-edge bristle spikes, ink blots). Validator lessons this
  cycle: test against baked versions (caught a stale-lab-file bake once),
  independent oracles over screen-space proxies, and calibrate thresholds by
  measuring the node before asserting (gyroid iso sweep).
- **2.37** new **Single Marker** generator (one movable point marker at exact
  X/Y mm — Dot spiral / Circle / crosses / registration styles; every style
  collapses to exactly one Bridges "Path centers" point at its center) +
  **Bridges** grew two Connect rules: **Source order** (connects points in
  Merge input order — the connect-the-dots workflow with Single Marker; Trim
  ends gives separated segments, new **Close loop** check returns to the
  first point, Max bridge splits and suppresses the loop) and **Hull
  (outline)** (monotone-chain convex outline only, no interior lines;
  interior points excluded, collinear degenerates to one segment). Old
  Bridges params/rules untouched — old patches load unchanged.
- **2.38** three nodes + an engine extension. Nodes: **Wind Tunnel** (duo:
  streamlines steered around wired obstacles — tangential steering + a hard
  per-step clearance projection so lines never enter the shape; wake
  turbulence behind each obstacle), **Pins** (gen: order↔chaos needle field,
  ball heads with rings/spiral fills, multi-pen head assortment, shaft stops
  at the ball edge), **Container** (duo: clip content to a wired region or a
  parametric rect/circle/triangle with rotation, ±Gap, bisection-accurate
  cuts — unifies Mask/Crop/Eraser; **Mask is now a deprecation candidate**).
  **Ribbon** gained Shape Line/Ring — Ring is a seamless periodic-noise loop
  of closed filaments; Line mode validated byte-identical to 2.37 against a
  transcription of the old compute, and a missing shape param falls into the
  Line branch so old patches load unchanged. Engine: **overlay(params, ctx,
  ins)** — primaryGuides resolves the selected node's data inputs and passes
  them as an optional third overlay argument (backward compatible; applied
  via tools/patch-overlay-ins.mjs, documented in NODE-API), so zone nodes can
  show WIRED regions as dashed guides. Validator lessons: name harnesses
  validate-<key>; a process.exit() before appended checks silently skips
  them — prefer process.exitCode. Same push window: **Moonraker DRO**
  shipped (src/dro.jsx + machine-profile `moonrakerUrl`, applied via
  tools/era/patch-dro.mjs) — read-only live-position websocket chip in the
  top bar; see UI systems. The klipper/ folder gained printer.cfg and the
  CORS snippet in the same session (MECH handoff §1).
- **2.39** editor QoL, no node/export changes: **empty-space add** (palette
  click / quick-add scans the visible viewport in a coarse grid against
  MEASURED card boxes — cardEls offsetHeight, +14 air — and falls back to the
  old stagger when the view is full) and a toolbar **Tidy** button (hotkey **T**; left→right
  dependency columns by longest-path depth with cycle guard, barycenter row
  order within a column, measured heights + 26 gap; with 2+ nodes selected it
  arranges only the selection). Applied via tools/patch-tidy.mjs.
- **2.40** **Mask deprecated** (soft): `hidden: true` removes it from the
  palette and quick-add, but the def stays in DEFS so every old patch loads
  and runs unchanged — the v2.21 hard-removal precedent was rejected here
  because Mask is old and common in saved patches. Desc + NODES.md point to
  **Container**, which supersedes it (wired regions + parametric shapes,
  rotation, ±Gap, bisection-accurate cuts). Node counts unchanged: Mask
  remains a built-in, just unlisted. Applied via
  tools/patch-mask-deprecation.mjs.
- **2.41** glyph-loop fix: SFONT authors loop glyphs (O 0 D Q 8 B Ö, dot
  punctuation) with the first point repeated at the end, but **ASCII Art**
  and **Text** emitted every stroke closed: false — a geometric loop the
  region nodes could not see, so Pattern Fill on letters did nothing. Both
  now detect first==last strokes (>3 pts, 1e-6), drop the duplicate point
  and emit closed: true; plotted ink identical, Travel Sort may pick a
  different loop entry vertex. Known follow-up if ever needed: Text on Path
  and Concrete Poetry still emit open glyph strokes (clipped/rotated glyphs
  — left untouched deliberately). B/P/R refonted in SFONT (their bowls closed
  against the stem, not their own start, so loop detection could not see
  them): bowls are now authored closed loops + separate stems — P/R ink
  identical, B redraws the shared mid bar once. 6/9/4/A counters left as-is
  (single spiral strokes, no clean split). Applied via
  tools/patch-glyph-loops.mjs + tools/patch-glyph-brp.mjs.
- **2.42** three nodes + an export extension. **Slide Rule** (gen/scientific:
  nine real scales as checkboxes, adaptive tick subdivision against a
  physical min-gap, Mannheim frame + slide separators or Circular
  decade-per-360° rings, value-drivable cursor; validated to machine
  precision against the scale mathematics — CI proven the exact mirror of
  C). **Nanotubes** (gen/scientific: C60 from exact truncated-icosahedron
  coordinates — 60V/90E 3-regular — armchair/zigzag tubes from a rolled
  honeycomb with wraparound bond metric + whisker pruning, graphene,
  seamless nanotorus with E = 1.5V exactly, C60 onion; Front-half culling
  proven a strict subset of Transparent). **Fade Out** (mod/penout:
  slow-lift comet tails as NEGATIVE point z — export patch
  tools/patch-fadeout-gcode.mjs widens the z clamp to ±6 mm capped at
  pen-up, plunge behaviour byte-identical, NODE-API z spec updated).
  **Molecule** (24 hydrocarbons + caffeine / glucose / fructose / sucrose /
  betulin / gasoline blend, Kekulé by perfect matching, 20/20 checks) was
  built and validated but CUT by decision before bake — second cut after
  the Opus-era version. Validator lessons: negative zero breaks toFixed
  dedupe keys ((-1e-17).toFixed(4) !== "0.0000" — caused degree-4 atoms in
  the armchair lattice), and patch guard strings must not straddle line
  breaks (bit twice this session).
- **2.43** six nodes, all grown from reference images in one lab session.
  **Stipple** (gen: darkness-adaptive dart-throwing stipple — dot size from
  image darkness, radius-aware packing, Kusama honeycomb in the blacks),
  **Shade** (mod/fillstyle: movable-light tonal shading — chamfer feature
  transform for edge distance + facing, corner kernels with concave bias,
  level-gated cross-hatch; scanline mask + per-ring normal voting took A3
  worst case 1412→392 ms), **Blob Rings** (gen/organic: stadium-erosion
  nested rings, coherent per-blob wobble field so rings stay quasi-parallel),
  **Line Zones** (gen/geometric: BSP zones of strict V/H gratings, solid and
  dither-checker zones, 45° corner cuts proven as exact staircases),
  **Type Grating** (gen/textimg: text concealed in a grating via a glyph
  mask shaped Plain/Modular/Fragments/Outline/Stencil, encoded Break/Phase
  shift/Density/Dashes/Weight; RENAMED from atypegrating while still in the
  lab — key renames are free pre-bake, frozen after), **Scribble Type**
  (gen/textimg: skeleton-tracing pen with five displacement modes
  None/Coil/Sine/Seismic/Glitch-orbit and six alphabets incl. a truthful
  Elder Futhark transliteration and a seed-generated Asemic script).
  Validator lessons: stencil cuts must clear the thickened MASK, not the
  skeleton (a +0.1% ink delta exposed cuts being swallowed by the radius);
  scribble displacement must scale to TEXT size, not glyph size, or every
  alphabet converges to the same tangle (a skeleton-coverage invariant now
  guards the regression); position-invariance (same char at two tx values
  must be a pure translation) tests glyph consistency without duplicating
  glyph tables in the harness; sample hand-tremor noise in the arc-length
  domain, not canvas position, or that invariance breaks.
- **2.44** restore, no new features: the **Moonraker DRO** integration had
  silently vanished from App.jsx somewhere in the 2.38→2.43 window (an
  App.jsx overwrite from a pre-DRO base; src/dro.jsx and the era patch
  survived untouched). Re-applied via tools/era/patch-dro.mjs — all four
  anchors still matched on the 2.43 file. Post-push guard added to the
  routine: `grep -c "DroPanel" src/App.jsx` must print 2.
- **2.45** two nodes. **Mini Squares** (gen/geometric: occupancy-grid square
  mosaic, big-first placement, fBm x spread-falloff density, concentric/corner
  nesting with per-cell rng streams; validator proves every square pair
  interior-disjoint or strictly nested across seeds/styles/gaps). **Color Mesh**
  (gen/geometric: BSP convex facets + per-facet cross-hatch with light-aligned
  spacing gradient, noise-zoned pens; **Mode 3D**: hash-lifted vertices —
  bitwise-identical shared cut points keep the surface continuous —
  fan-triangle fold interpolation, adaptive resample + tilt + margin refit,
  Lambert spacing modulation normalized so relief 0 reproduces Flat
  line-for-line; output z stripped, since a third point component means pen
  plunge). Validator lessons: harness helper stubs MUST be verbatim copies of
  src/defs/helpers.js — the NODE-API §9 snippet had drifted (different
  hash2/noise2 family), making a lab-mode pass and a baked-mode fail on the
  same node (fixed in NODE-API v1.3 this release); a stub `resample` silently
  skipped the whole 3D lift (straight lines, zero deviation); and single-facet
  oracles must size the facet so the effect exceeds the detection threshold
  (an A4 facet under ±15 mm relief tilts <1° — the Lambert check needed a
  60x60 canvas to have power).
  - **2.46** Portrait phase 2A - face analysis infra, no node compute changes.
  src/analyze.js (DRO mould, no react import so validators import it
  directly): intake for faceAnalysis nodes (EXIF orientation, 1280 px,
  frozen JPEG at node.data.src - legacy 160 px path untouched for all
  other image nodes), lazy CDN engines with Cache API + SHA-256 recorded
  in analysis.engine, MediaPipe landmarker chains, SegFormer face parsing
  (jonathandinu/face-parsing, pinned commit; CELEB table matches the
  model's ACTUAL id2label - hair=13, glasses=3, NOT classic BiSeNet
  order), marching-squares vectorization + DP + smoothing, hairFlow
  structure tensor, schema v1 + shared structural validator. Analyze
  button seam applied via tools/era/patch-analyze.mjs (3 anchors);
  POST-PUSH GUARD: grep -c "AnalyzeButton" src/App.jsx must print 3
  (alongside DroPanel 2). Real-photo fixture frozen to fixtures/
  (portrait-photo.jpg + portrait-analysis-v1.json) - phase B geometry
  tests run against it with no ML and no network. Validator lesson: the
  guessed parsing-model URL and label order were both wrong until
  verified against the live repo - pin AND verify, never assume.
  
  - **2.47** Portrait phase 2B + Split Pens. Portrait baked (lab graduated):
  feature lines from the frozen analysis - importance table (IMP const, tune
  by eye), Line economy pruning, jaw/upper-oval split, glasses checkbox
  (open question 5: manual), hair streamlines along the frozen hairFlow field
  with px-space occupancy spacing (OC const). LOCKED: all feature geometry is
  generated in ANALYSIS PIXEL SPACE and mapped to mm only on emit, so margin
  and paper changes are a pure affine remap (validated to 3e-14 mm); the
  first mm-space implementation failed this and was redesigned. Feature lines
  take the node's Pen slot, tonal rounds shift by one (open question 4).
  Feature ink pre-deposited into I so shading avoids the lines; invalid or
  missing analysis degrades bit-identically to pure Tonal. Engine: overlay()
  gains an additive 4th argument (the node) via tools/era/patch-overlay-node.mjs
  so nodes carrying frozen data can draw it as guides; POST-PUSH GUARD:
  grep -c "oins, primaryNode" src/App.jsx -> 1 (alongside DroPanel 2,
  AnalyzeButton 3). Split Pens baked: 12-way pen router + Preview tap on
  pin 1 (selector never touches routing outputs). Validators run against the
  real-photo fixture in fixtures/.

- **2.48** two nodes, the needle-toolhead workflow. **Needle Punch**
  (mod/penout: lines → piercings as degenerate 2-pt paths carrying z = plunge
  below pen-down — ZERO engine changes: the Brush Z / Fade Out z architecture
  plus the existing penDown/penUp/zHop profile fields already produce the stab
  cycle, proven by running punches through toGcode; Interval/Intersections/
  Both/Centers modes, arc-length spacing modulation Wave/Noise/Ramp/Jitter with
  a 0.1 mm progress floor, Min gap dedupe so the needle never re-stabs a hole;
  punches render as dots via the preview's round linecap). **Braille**
  (gen/textimg: Grade 1 dot circles on the 2.5 mm grid, Nordic å/ä/ö,
  punctuation verified against the Finnish table on fi.wikipedia — piste 3 and
  huutomerkki 256 differ from UEB; number/capital signs, cell-level stamp
  Mirror, SFONT letter overlay with Show letters toggle; one _layout method
  shared by compute and overlay so guides cannot drift — called via this,
  which works because the engine invokes compute/overlay as methods on the
  def). Lessons: bake.mjs rejects IIFE-wrapped lab files ("Unexpected token
  ')'") — lab nodes must be plain ({...}) literals, share logic via a
  this._helper instead; mirror must reflect around the CELL GRID, not the
  occupied-ink bbox; intersection punches need the adjacency skip incl. closed
  wraparound or path joints punch falsely; a stale Downloads copy ("name
  (1).ext", the known browser no-overwrite pitfall) shipped an old node once
  — grep a sentinel string after moving files; and HANDOFF's own repo-layout
  counts were stale (213 files pre-bake, not 208) — doc counts come from
  `ls src/defs/nodes | wc -l` + per-cat greps, never from HANDOFF.

- **2.49** big batch: one engine seam, one node fix, EIGHT new nodes.
  Engine: **fileBinary** definition flag (tools/era/patch-file-binary.mjs) —
  file params read as dataURL and routed to the existing onFile branch, so
  onFile can base64-decode binary formats; fileAccept now wins over the
  image/* default; sentinel grep -c "fileBinary" src/App.jsx -> 1. Fix:
  **Origami Glitch Fold** gained a movable pivot (Pivot X/Y + Pivot-at-center,
  legacy Axis Position preserved, old patches byte-identical via useCenter
  default) and the previously missing overlay (fold line clipped to the sheet
  + pivot + mirrored-side arrow). New nodes: **Sound Line** (gen/textimg:
  self-contained WAV parser in onFile — RIFF chunk walk, PCM 8/16/24/32 +
  float32/64 + WAVE_FORMAT_EXTENSIBLE, mono mix, peak-normalize, freeze
  ≤16384-sample signal + 2048-bin min/max envelope into node.data; Wave/
  Envelope over margin Rows or wired Anchor paths, Fit / Speed mm/s + Loop,
  Start/Segment, Smooth), **Flash Distort** (mod/deform: canvas-spanning
  rotatable strips with patterned widths + shifts, EXACT boundary
  interpolation — no resample gaps — and Sutherland-Hodgman Close cut faces
  for the filled poster look), **Orbit Scribble** (gen/organic: continuous
  drifting-loop strands in a soft-radially-bounded noise cloud + bead spirals
  with core falloff on their own pen), **Smoke Mesh** (gen/organic: folded
  ribbon-sheet veils as parallel filaments, twist/fold/ripple, auto detail
  shrink under the point budget), **Contour Field** (gen/scientific: coarse-
  grid marching squares with saddle disambiguation, chained level lines,
  SFONT edge numbers with greedy collision avoidance; validator holds a
  vertex-on-grid-edge == exact-level oracle), **Radial Burst** (gen/organic:
  gap-driven ray insertion — hairs born whenever neighbour gap × radius
  exceeds spacing, silhouette-aware so density stays uniform to the LOCAL
  edge; 6 waveforms incl. Seismic and Straight; validator: rim-gap bound +
  no-bald-wedge sector oracle after the level-doubling version tore wedges),
  **Truchet Multiscale** (gen/geometric: sibling of built-in Truchet — cross-
  tile CHAINED strands into closed loops / border strokes, Carlson multiscale
  subdivision, pens by depth; renamed from "truchet" after the built-in key
  collision), **Fingerprint** (gen/organic: soft-min distance-field ridges at
  constant spacing, LSE merge, domain-warp wobble, dashed breaks with ink
  dots; oracles: single-seed exact-gap circles with curvature-aware tolerance
  and ridge-length × gap ≈ area coverage). Lessons: a lab key colliding with
  a built-in is caught at import — check DEFS before naming; scanline crossing
  spacing ≠ perpendicular ridge spacing (gap/|sin θ|), measure coverage as
  length × gap / area; chain walks must START from the border endpoint;
  soft-min k beyond ~2× gap visibly stretches saddle spacing.

- **2.50** app-level batch, no node changes. **Mega Canvas Roll kind**
  (wallpaper mode): sliceRoll beside sliceMega — C strips of fixed roll width
  (seam + Overlap/Gap in X only), seamless pieces along the roll (validated:
  Σ clipped = exact total length, exact butt joints), per-tile W/H with a
  short last piece, edge registration ticks at every internal boundary,
  S#/P# labels, strip-XX-piece-YY filenames, jig split, mega.kind + roll
  fields in patch save/load (old patches → Sheets). **DRO chip rewrite**
  (src/dro.jsx full replacement): constant-width chip — label always "DRO",
  state in dot color + tooltip, always-rendered fixed-width X/Y/Z slots with
  tabular figures — the top bar no longer reflows on the reconnect cycle;
  https origin + ws:// URL = static "LAN only" state with zero connection
  attempts (mixed content can never succeed). **DXF R12 export**: toDXF next
  to toSVG (POLYLINE entities preserving path continuity, PEN_n layers with
  nearest-ACI colors from the live pen palette, LTYPE/LAYER tables, y-up
  flip, -0 guard, plunge z dropped), EXPORT DXF button, dxf kind through
  preview/download/mega tiles. Applied via tools/era/patch-mega-roll.mjs,
  patch-roll-labels-text.mjs, patch-dxf-export.mjs + patch-dxf-hoist.mjs
  (see pitfall below — the pair is the correct as-applied history).
  Validators: validate-mega-roll.mjs (14 oracles incl. seam/continuity
  conservation), validate-dxf.mjs (20 oracles incl. module-scope + toSVG
  smoke). Lessons: era-patch INSERTION DIRECTION must be reviewed
  (`NEW + anchor` vs `anchor + NEW` — the dxf patch nested toDXF inside
  toSVG's return array, where the following template literal parsed as a
  tagged-template call: syntactically valid, build green, toSVG dead at
  runtime and toDXF gone from module scope); and a validator that extracts a
  function from App.jsx proves nothing about that function's scope — every
  extract-style validator now smoke-runs the neighbour function it was
  inserted next to.
- **2.51** three nodes, one merge, one marker feature, two engine seams.
  Engine: **bgImage seam** (tools/era/patch-bg-image.mjs) — def flag
  `bgImage` routes file intake to the Portrait image pipeline (EXIF, 1280
  px, JPEG dataURL at node.data.src + node.data.img), `ctx.machine`
  additively exposes the active profile subset {originX/Y, flipY,
  laserOffX/Y, workW/H}, and the preview draws the first bgImage node's
  `bgRender()` under the paths in both PathsSVG call sites. **A1 canvas
  presets** (patch-a1-preset.mjs). Nodes: **Image Underlay** (bgImage
  tracing reference; 2-4 laser/DRO corner anchors -> least-squares 2D
  similarity fit, per-anchor mm residuals as arrow guides, Frame output
  for masking; renamed from photo_underlay in the lab BEFORE bake — keys
  freeze on bake), **Clock Face** (hands-free dial: parametric hour count,
  keystone baton quads, quarter emphasis on exact quarter fractions
  `(i*4)%hours===0`, minute dots/lines on their own pen, spiral center,
  rim %), **Sweep 3D** (profile swept along Helix / Cone spiral / Flat
  spiral / Circle / Figure 8 / Line; wired-profile input bbox-fitted; End
  scale + deterministic sine modulation + Twist; ortho Tilt/Yaw; 90k point
  budget coarsens the profile, never drops instances). **Single Marker**
  gained *Coordinates: DRO (laser)* (patch-marker-dro.mjs) — the machine
  inversion INLINED in compute+overlay per the this-binding pitfall, with
  an agreement oracle; X/Y slider max 800. **Image + Trace Image merged**
  (patch-image-merge.mjs): Image gained *Contours (trace)* as a VERBATIM
  transcription (byte-identity proven across an 8-combo sweep in
  validate-image-merge.mjs); traceimg is now a `hidden: true` legacy alias
  (the Route precedent) — old patches byte-identical. Validators:
  image_underlay 33, singlemarker 17, image-merge 23, clockface 27,
  sweep3d 23 oracles. Lessons: an exactness oracle must measure along the
  feature's own axis, not corner radii (clockface C4 — corner distance is
  hypot(r, halfWidth)); equivalence harnesses must unify param DEFAULTS
  across both defs before comparing (image-merge B1 — image cell 2.4 vs
  traceimg 1.6 broke deep-equal until traceimg defaults won).

- **2.52** five nodes, one release batch. **Loom** (gen/structural: draped
  warp/weft mesh; Shape noise rumple + Drift directional ramp added as SHARED
  fields so warp and weft stay woven; drift-ramp monotonicity + noise-amplitude
  oracles), **Torn** (mod/cutsplit: tear band, per-crossing Bridge/Fling/Snap,
  Gape, ragged edge; vertex-based BY DESIGN — the sparse-input hard-quantized
  tear was evaluated, an adaptive-densify fix built and validated, and then
  REJECTED as the better look; Detail>0 gives the smooth cut), **Op Tunnel**
  (gen/geometric: sector-striped polygon tunnel, per-sector geometric ratio
  from an off-center vanishing point, half-period glitch patches, alternate-
  band fill; parallel-to-edge oracle over every segment + constant-ratio
  oracle at 1e-15; overlay/compute geometry INLINED per the this-binding
  pitfall), **Woven Ribbon** (gen/structural: lattice-walk spine -> exact
  corner arcs -> offset track pairs, under pass clipped by over-pass width at
  every self-crossing; walk is rollout-scored — pure random stalled in dead
  ends, greedy backtracking DFS collapsed to a perimeter spiral, 40 seeded
  rollouts scored length + 6x crossings won), **Flow Traces** (gen/structural:
  strictly self-avoiding orthogonal flow-field router — flow angle, center
  swirl, square-wave Wave detours, turn bias; trimmed Dots/Rings/Pads
  terminals; sibling of PCB Tracks). Validators: loom 35, torn 36, op_tunnel
  34, woven_ribbon 41, flow_traces 44 oracles; woven_ribbon and flow_traces
  share THE weave oracle — a spatial-hash proof of ZERO segment intersections
  in the entire output across seeds, weave modes and extreme params. Lesson:
  a greedy DFS finds *a* maximum-length walk, not an interesting one; scored
  rollouts beat both pure randomness and backtracking for generative walks.
- **2.53** cross-stack feature: **Canvas check** — laser-framed job bounds
  before plotting. Klipper side: `klipper/canvas-check.cfg` (`CANVAS_CHECK`
  macro: pen up, laser traces the bounds rectangle, refuses unhomed or
  beyond machine travel — doubles as an oversized-job guard; inside a job it
  PAUSEs with a Continue/Abort touch prompt; runs laser-dark with an M117
  note until `[output_pin laser]` exists, so it smoke-tests without the
  laser). Muusia side: `toGcode()` emits `CANVAS_CHECK X_MIN=.. Y_MAX=..
  LASER_OFF_X=..` right after startG from real path bounds (through fx/fy so
  origin + flipY are baked in; `__stop` marker paths excluded), gated by
  profile `canvasCheckOn` (opt-in — the macro pauses the job); CANVAS CHECK
  toggle sits after the laser-jig section. Extract-and-run validated:
  origin, flipY, opt-out, stop-only cases. Shipped as commit cb72882
  mislabeled "v2.45" + bump 29a03fa — the repo was already at 2.52 (see the
  sed pitfall below).

- **2.54** Portrait phase 3 + Tresset + beard + multi-face (commit 7be678a
  shipped these under a stale 2.53 stamp with a v2.48 message — the sed
  pitfall struck AGAIN from a different session's stale context; this bump
  corrects the stamp). **One line** (Picasso): economy-pruned chains of
  every found face ordered by an endpoint tour (greedy NN + seeded pair
  swaps), closed loops entered at the nearest point and traversed fully,
  transitions as quadratic arcs bulging AWAY from the face centroid so they
  ride the cheeks/forehead; requires analysis, degrades to EMPTY like image
  nodes without an image. **Sketch nerve** (Tresset): contours re-stated
  1–3× with coordinate-noise jitter, shading strokes wobble (white-cutoff-
  guarded), open contours get flyaway overshoot ends; nerve 0 is
  bit-identical to the clean drawing and the prefix invariant provably
  survives (noise2 only — no rng consumption). **Beard**: no parsing class
  exists (CelebAMask limitation) — `detectBeard()` in `src/analyze.js` finds
  facial hair as TEXTURE vs the same face's smooth-cheek median inside a
  landmark-derived zone (below the mouth, past the chin); ADDITIVE fields
  `regions.beard` + `beardFlow`; jaw/oval chains are clipped OUTSIDE the
  beard mask (draw the mass, not the bone — lips can never enter the mask
  since lip classes are not skinLike), beard streamlines share the
  generalized `drawFlow` with hair, tighter lanes (OC 6 vs 8). **Multi-
  face**: `analysis.faces[]` largest-first (`face` stays primary for
  back-compat, proven bit-identical), regions carry all components as
  `parts[]` so a second person's hair survives, the node draws every face,
  and One line links them all into a single unbroken line. Validators
  49 (analyze) + 87 (portrait) against the real-photo fixture; the jaw-clip
  test isolates clipping via a beard-without-flow fixture variant.
  
  - **2.55** Portrait: the nerve arc - one long calibration session. Sketch
  nerve is now a STRUCTURAL switch, not a tremor: a chamfer distance field
  from the feature ink GATES tonal seeds (falloff 10-7.5*NERVE mm,
  tightening x0.78 per round with floor 0.5 - rounds became a piling knob);
  seeds split into two populations - ~88% PILES: 5-21 mm absolute scribbles
  whose course runs ALONG the contour (outward-gradient normal) and whose
  seed weight has a floor SCALED BY LOCAL TONE (the contrast mechanism:
  dark areas stack into knots, light areas keep single clean lines) - and
  ~12% ESCAPEES: frozen outward launch course + bounded two-wavelength
  meander (worms that travel; heading random-walks knot, position noise
  makes rulers - both were tried and measured out), ink-only blocking with
  length-scaled bridging so strokes cross existing lines like Tresset's pen.
  Restates up to 5x with per-pass drift, PARTIAL fragments from pass 3,
  flyaways grow per pass; hair/beard strands get per-strand heading
  deviation off the flow field. Six structural oracles guard the look
  (packing distance, coverage shrink, 16-bin splay, rooted-pile median +
  escapee tail count, straightness window 0.2-0.85, two-tone contrast
  ratio). MUUSIA-PORTRAIT-MANUAL.md added (parameter meanings + presets).
  TWO PITFALLS FOUND: see below.

- **2.56** Four nodes in one session. **Gull Tracks** (gen/creatures):
  webbed gull footprint trails, alternating feet + toe-in, every print unique
  via per-print rng streams; validator proves uniqueness (480/480 distinct
  shapes) and the vary=0 identical-stamp invariant. **Ink Burst**
  (gen/organic): decalcomania squash print - coherent-field striations with a
  core void, Breakup lens gaps, tendrils whose stem CONTINUES into the droplet
  spiral (one pen-down); R-clamp covers edge bulge (1.3x) and spiral extent
  (1.8 x blob) - both found by the bounds oracle. **Ripple Chain** (dec):
  concentric ring clusters beading along any input path, optional Amplitude
  input samples a wired curve's deviation (Sound Line -> ring sizes; NO audio
  parsing duplicated in the node). Post-import fix: point budget was
  first-come-first-served and big radii blanked later paths - now shared by
  arc length with a dry-run + even step-stretch so oversubscribed paths thin
  uniformly; adaptive ring sampling (arc step grows with radius) halves big-
  cluster cost. Guarded by two regression oracles (all loops decorated at max
  radius; serpentine tail still beads). **Moire Disc** (gen/geometric): one
  disc, nine fill contents (Rings/Spiral/Spokes/Hatch/Mesh/Hex/Grid/Random/
  Phyllotaxis), Pitch + Angle + X/Y as the moire levers, Disorder morphs
  order->chaos, hard invariant: content never leaks outside the disc at any
  disorder (keeps overlaps clean). Endgame proven: Rings+Rings offset =
  hyperbolic arcs, Hatch+Hatch at 4 deg = shadow bands.

- **2.57** Node catalog + deep search (discovery phase 1 of 3). NEW GENERATED
  MODULE src/defs/catalog.js: tools/make-catalog.mjs parses the per-node
  paragraphs out of docs/MUUSIA-NODES.md (+ optional curated tags from
  docs/MUUSIA-TAGS.json, phase 2 seam) into { key: { t, tags } } — NODES.md
  is the single source of the search text, so the doc batch now also feeds
  the in-app search. tools/validate-catalog.mjs is a build gate: FAILS when
  the committed catalog differs from a fresh regeneration (stale), on orphan
  keys or malformed tags; WARNS on paragraph-less nodes. Quick-add (G/M/D/C/
  X/N) became a DEEP search via tools/era/patch-catalog-search-v257.mjs:
  scored word-start matching (name/nick 3, tags 2, desc + catalog paragraph
  1, AND per word — "rib" hits Ribbon, "round" does not hit "background"),
  deep-only hits show a match snippet under the node name, Cmd/Ctrl+K opens
  the all-nodes search. Era validator extracts the search block VERBATIM
  from App.jsx and runs 12 oracles against the real DEFS + catalog. The
  catalog generator immediately exposed doc debt: braille, mm_paper,
  needlepunch, numerals and river had NO NODES.md paragraph — written in
  this batch. Phases ahead: tag vocabulary + palette chips (2), visual
  thumbnail catalog (3).

- **2.58** Tag vocabulary + chips (discovery phase 2 of 3). NEW DOC
  docs/MUUSIA-TAGS.json: a curated ~55-tag vocabulary over all 237 nodes
  (avg 3.7 tags/node, every node tagged) — built as a rule-based pass over
  name + desc + NODES.md paragraph with the palette's cat/group taxonomy as
  base tags, capped at 6 per node preferring rarer (more specific) tags,
  then hand-corrected. make-catalog.mjs merges it into catalog.js (the
  phase-2 seam shipped in 2.57), so tags score at weight 2 in the deep
  search with zero engine changes. patch-tag-chips-v258.mjs adds a
  module-scope CATALOG_TAGS aggregate and a browsable chips row in the
  quick-add modal (empty query only): the full tag cloud with node counts
  (v258b widened it from top-18 — the rare tags are the inspiring ones), click
  = search that tag. Era validator extracts CATALOG_TAGS + the search
  block verbatim from App.jsx and proves vocabulary size, count sums,
  full node coverage and that every top-18 chip query returns its tagged
  nodes. TAGGING RULE: every new node gets a MUUSIA-TAGS.json entry in
  the doc batch — validate-tag-chips fails on untagged nodes. Next: the
  visual thumbnail catalog (phase 3).visual thumbnail catalog (phase 3).

- **2.59** Visual node catalog (discovery phase 3 of 3). NEW MODULE
  src/catalog-browser.jsx (dro.jsx pattern: self-contained, everything
  injected as props, wired by an anchored era patch): a full-screen overlay
  — B key or the toolbar Catalog button — rendering every non-hidden node
  as a LIVE thumbnail: compute with default params on a fixed 150x100 mm
  thumb ctx, exact engine call signature (ins, params, ctx, node); paths
  inputs get standard fixtures, and the SECOND paths input gets a
  DIFFERENT fixture than the first so duo/region nodes (Container, Wind
  Tunnel, Occlude...) show a real interaction instead of self-erasure.
  Dynamic ins (a function of params, e.g. Merge) are resolved before
  wiring. 6000-pt budget per thumb, lazy 3-per-tick chunked computation
  (the overlay opens instantly), per-session cache keyed by node — default
  seeds make every thumbnail deterministic. Value outputs render the
  number, style outputs a dash sample, file-input nodes a "needs a file"
  badge; coverage 215/233 live + 9 value + 1 style + 7 file, 0 errors
  (only negspace has no preview — it needs genuinely overlapping inputs).
  Deep search (same scoring as quick-add), category chips, full tag-cloud
  filter, Surprise me (adds a random node from the current filter), click
  a card = addNode with an Added-flash, browser stays open. Era validator
  extracts fixture+computeThumb VERBATIM from the module and runs it over
  every def: no escaped exceptions, budget held, finite coords, >=85%
  live-thumbnail rate, byte-identical re-runs. Discovery series complete:
  deep search (2.57) + tags (2.58) + visual catalog (2.59).deep search (2.57) + tags (2.58) + visual catalog (2.59).

- **2.60** Keyboard shortcuts popover: toolbar **Keys** button (next to
  Pens, same fixed-overlay popover pattern) and the **?** key toggle a
  grouped two-column list of every shortcut (Add nodes / Edit / View),
  with a footnote that shortcuts pause while typing and a wheel/drag/
  dblclick zoom reminder. Data lives inline in the popover — when a new
  shortcut is added to the onKey handler, add its row here in the same
  patch. Also: `wip/` gitignored as the local staging area for
  unapplied patch drafts (never pushed; applied one-shots still graduate
  to tools/era/ committed).

- **2.61** Two prepress nodes + an engine seam. NEW GEN **CMYK
  Registration** (scientific): thirteen authentic print registration/control
  marks (crosshair, bullseye, GATF star, Japanese tombo center/corner, crop,
  color bar at real screen angles C15/M75/Y0/K45, ladder gauge, eye marks,
  quartered target, micro cross, collation steps, scale cross), registration-
  color marks drawn once per plate with seeded misregistration + wobble;
  layouts Grid (default) / Single / Press sheet / Ring / Border / Scatter -
  mark checkboxes drive the multi layouts, the Single mark dropdown drives
  Single (no button param type exists; a Standard/Custom select is the reset
  idiom). NEW GEN **Image Rasterise** (textimg): true CMYK halftone separation
  of a loaded photo - per-plate screen angles (Angles select: Standard
  15/75/0/45 = one-click reset, Custom frees the sliders), dot styles
  Dots/Rings/Spiral/Dashes, GCR black slider, press-defect controls
  (misregistration, plate skew, dot gain, doubling/slur ghosts, ink noise);
  plates draw K-first so a budget truncation eats yellow, grayscale-only
  images (older intake) fall back to a K-only separation. ENGINE
  tools/era/patch-image-rgb.mjs (applied): the fileImage intake decode loop
  now also stores img.rgb flattened alpha-over-white - backwards compatible,
  every fileImage node keeps reading img.g.

- **2.62** Stack View (3D layer stack preview, phase 1 of the layered
  plexi/glass workflow). NEW MODULE src/stack-view.jsx (dro/catalog
  pattern: self-contained, everything injected as props, wired by
  tools/era/patch-stack-view.mjs): a full-screen overlay — S key or the
  toolbar Stack button — that splits the drawing into sheets and stacks
  them in 3D as translucent panes. Sheet sources: *Frames* (per-frame
  graph re-evaluation via the exportAllFrames mechanism, lazy one frame
  per tick, capped at 12 sheets) and *Pens* (one evaluation split by pen
  index, full pen colors per sheet). Each sheet draws once onto its own
  transparent canvas (120k-point budget with a "trunc" badge); the stack
  is posed with CSS 3D (perspective + drag rotateX/rotateY + per-sheet
  translateZ centered on the stack middle), so rotating costs a CSS
  transform, never a re-evaluation. Controls: spacing (mm = sheet
  thickness + air gap), perspective amount, reverse order, per-sheet
  visibility, plexi outline/tint, dark/paper/custom background,
  auto-orbit. PHYSICAL EXPORT in the overlay
  (tools/era/patch-stack-export.mjs injects exportText/buildZip/
  projName/fontStrokes): per-sheet SVG/DXF/G-code files written as ONE
  ZIP via buildZip — sidesteps the browser multi-download permission
  entirely. Transforms shared by preview and export (WYSIWYG, decorate):
  sheet margin (physical sheet = canvas + margin per edge, art translated
  inward, marks in the margin zone), drill marks M3/M4/M5 (clearance
  3.2/4.3/5.3 mm, corner inset param, identical on every sheet), SFONT
  n/N sheet numbers, all on a selectable Mark pen; Mirror (for painting/
  engraving the sheet BACK) applies to the plot files only — the 3D
  preview always shows the front view. Export writes ALL sheets; hiding
  a sheet is a preview aid. Planned phase: a Sheets node (Merge-shaped
  frame-domain selector: input i passes on frame i). Validator
  tools/validate-stack-view.mjs extracts the pure functions VERBATIM
  from the module (splitByPens, sheetZ, mirrorX incl. z-component
  preservation and double-mirror identity, translatePS, drillMarks
  centers/radius/closed) plus contract sentinels and wiring checks.
  ALSO: the per-frame (ANIMATE) export gains DXF — exportAllFrames
  handles kind "dxf" via toDXF, a "DXF x N" button joins G-code/SVG in
  the panel, Help bullet updated (tools/era/patch-anim-dxf.mjs).

- **2.63** Sheets node (phase 3 of the layered plexi/glass workflow — the
  stack pipeline is complete). NEW NODE sheets (duo, Merge-shaped): N paths
  inputs (count 2–12), passes through exactly ONE — the input whose index
  equals ctx.frameIdx (clamped into the pin range) — so with ANIMATE
  Frames = wired inputs every frame is one sheet; each sheet keeps its full
  pen colors, unlike pens-as-sheets. Select Manual pins one sheet for
  editing without touching ANIMATE; the ANIMATE scrubber flips sheets live
  (frameIdx rides the main eval ctx). Unwired input → EMPTY. No randomness.
  Tags animation/combine/stack — "stack" is a NEW vocabulary tag so the
  deep search finds the node at tag weight for "stack" queries; the plural
  "stacks" hits via the NODES.md paragraph at deep weight (word-start
  matching: query must prefix-match the text, not vice versa).
  Stack View auto-detect: tools/era/patch-stack-sheets.mjs injects a
  sheetsCount prop (recursive graph scan incl. groups for type "sheets",
  max distinct wired numeric toPorts — param wires "p:key" excluded);
  when > 0 the overlay takes its sheet count from the node instead of the
  ANIMATE frame count, labels switch frame→sheet and a hint shows the
  wired-input count. Validator tools/validate-sheets.mjs uses the REAL
  src/defs/helpers.js, auto-switches baked/lab, and covers pin-count
  dynamics, frame/Manual selection, clamping both ways, null-ctx
  tolerance, unwired→EMPTY, multi-pen passthrough without mutation,
  count clamp and determinism. Docs counts in this batch read from
  src/defs/nodes at patch run time, never from stale docs.

- **2.64** Morph Layers node (the plexi stack family grows). NEW NODE
  morphlayers (duo): inputs first/last, builds the in-between layers by
  shape interpolation — Layers 2–12, Samples (per-path arc-length
  resampling to a COMMON point count via a local resampleN, because the
  resample helper takes a step in mm, not a count — contract read from
  helpers.js first this time), Ease Linear/Smooth (endpoints stay exact).
  Match modes: Split & merge (DEFAULT, added after the first lab test
  showed nearest-centroid clumping on 3D Glitch cut lines — the fragment
  side assigns to nearest targets and each target perimeter partitions
  into consecutive arcs proportional to fragment lengths, ordered by
  outline position, works both directions, degenerates to Nearest on
  equal counts, fragment-less targets fall back to birth/death); Nearest
  (centroid pairing + birth/death); By order (modulo index cycling). All
  deterministic, no seed; closed 1:1 pairs align by start-index rotation
  + direction reversal minimizing summed squared distance (kills lerp
  twist); dead paths dropped when the bbox diagonal falls under 0.05 mm.
  Output
  Sheets = frame-domain (layer ctx.frameIdx only, cheap: one layer built
  per eval, source pens kept); Output Pens = all layers at once, pen
  (First pen + i) mod 12. tools/era/patch-stack-morph.mjs extends the
  Stack View sheetsCount walk: a morphlayers node with Output "Sheets"
  drives the sheet count with its Layers param (Pens mode never does).
  Tags animation/combine/deform/stack. Validator
  tools/validate-morphlayers.mjs (real helpers, lab/baked auto-switch,
  paren-wrapped eval): bbox-exact endpoints, midpoint between, closed
  handling, sample-count exactness, frame clamping, null-ctx, pen walk,
  nearest-centroid vs input order, birth/death both directions,
  EMPTY on missing/empty inputs, no mutation, determinism, finiteness,
  Split & merge both directions (fragment count and cut structure kept at
  both ends, arc lengths partition the full perimeter, mid layers free of
  birth/death clumps), By order modulo — 42 checks.

## Hard-won pitfalls (keep)

- Era-patch INSERTIONS can land inside the anchor's enclosing scope and stay
  syntactically valid: a function expression dropped into an array literal
  turns the next template-literal element into a tagged-template CALL — the
  build passes while the host function dies at runtime and the inserted
  function never reaches module scope (the v2.50 toDXF/toSVG incident).
  Review `NEW + anchor` vs `anchor + NEW` on every insertion edit, and give
  every extract-and-run validator a smoke test of the neighbour function.
- Era-patch changes to App.jsx can VANISH silently if a later session
  rewrites App.jsx from an older base (the v2.44 DRO regression: module file
  survived, integration gone). Cheap insurance: after any session that
  touches App.jsx wholesale, grep for sentinel strings of past era patches
  (e.g. `DroPanel`). Re-running an era patch is correct ONLY when its target
  has demonstrably reverted to the unpatched state — the OK/MISS anchor
  report is the proof either way.
- Version bumps via `sed` fail SILENTLY when the assumed current version is
  wrong (the "v2.45" mislabel: the repo had moved to 2.52 in other sessions,
  sed matched nothing, and the feature shipped under an unbumped version in
  a mislabeled commit). The `grep -o 'APP_VERSION = ...'` line after every
  bump is not decoration — READ its output before building. Between chats
  the repo moves: verify version numbers in command sequences against the
  working copy, never against the previous session's state.
- Validator auto-switch PREFERS BAKED: re-opening a lab file for an
  already-baked node and running the validator silently tests the OLD baked
  node — the v2.54 session saw 14 "failures" that were just the new tests
  hitting the 2.47 bake. The `[lab]`/`[baked]` tag on the first output line
  is the tell — READ it. Bake before validating whenever the lab file is a
  reincarnation of a baked key.
- Browsers do NOT overwrite downloads (`name (1).ext`) — irrelevant post-C0 for
  code, still true for any downloaded file.
- Param descriptor FIELD NAMES are engine contract, not convention: a select
  param uses `options`, NOT `opts`. The inspector renders
  `def.options.map(...)` unguarded, so a wrong field name throws the moment
  the node's param card paints — and React unmounts the whole tree, i.e. the
  app goes WHITE the instant the node is added from the palette (v2.63
  Sheets). Worse, a hand-written validator can PASS the broken node when it
  asserts against the same wrong assumption; the v2.63 validator checked
  `sel.opts` and reported ALL OK. Read the field name out of an existing
  `src/defs/nodes/*.js` (or the inspector's renderer in App.jsx) before
  writing any descriptor, and make the validator assert the real field —
  same rule as the real-helpers rule, applied to descriptors.
- Injected helper RETURN SHAPES bite the same way: `fontStrokes` returns
  `{strokes, width}`, not an array. `for (const s of fontStrokes(...))`
  throws on a non-iterable and whites out the app (v2.62 Stack View sheet
  numbers). There is no error boundary in App.jsx — ANY throw inside a
  module's render or effect takes the entire UI down, so a feature that
  "crashes the browser" is almost always a contract typo, not a
  performance problem. Prove new helper use in a Node harness that imports
  the REAL `src/defs/helpers.js` before shipping.
- `bake.mjs` requires the lab file to BEGIN literally with `({` — a header
  comment above the literal fails the precheck with
  `SKIP <key>: expected ({ ... }) wrapper` (v2.63 Sheets). Documentation
  comments belong INSIDE the object literal, as the first thing after `({`.
  Same family as the IIFE rejection: the precheck is textual, not a parse.
- React overlays must HIDE, never UNMOUNT, cached-canvas content: a
  per-sheet visibility checkbox that renders `cond ? null : <div>` drops the
  canvas element, and when it remounts the draw effect does not re-run
  (visibility is not in its deps), so the sheet returns BLANK (v2.63 Stack
  View). Use `display: "none"`. Any `useEffect` that paints into a ref'd
  canvas has this hazard wherever conditional rendering can unmount it.
- NODE_HELP-style strings may contain escaped quotes: regex-replacing doc strings
  needs `(?:[^"\\]|\\.)*`, plain `[^"]*` breaks on `\"`.
- Chain-walking regexes over `else if (M === "...")` must anchor on the quoted
  string, not `\([^)]*\)` — option labels contain parentheses.
- Test assertions must not measure pinned endpoints when checking smoothing.
- `import.meta.glob` order = filename order; palette groups sort alphabetically.
- macOS Quick Look scales tall SVGs to window width and shows only the top —
  judge exported tiles in a browser tab or by validator, never by space-bar
  preview (a "slicing bug" in 2.30 investigation was exactly this illusion).
- Custom-node sandbox (NODE_HELPERS) must list every helper the NODE-API
  documents — a missing one fails silently as an empty node.
- Validator harness helpers must be verbatim copies of src/defs/helpers.js —
  stubs or drifted snippets pass in lab mode and fail (or worse, silently
  under-test) in baked mode. When lab and baked runs disagree, diff the
  harness helpers against helpers.js first.
  - helpers `hash2`/`noise2` REQUIRE the seed argument: a 2-arg call computes
  `undefined + x` -> NaN -> bit-ops -> ALWAYS 0, silently. Eighteen call
  sites in the v2.55 session produced constant-offset "jitter" and dead-
  straight "worms" before this was caught - the user literally described
  the bug ("copies of each other with a small offset") before the code
  audit found it. The tell: noise-driven variation that looks like a
  CONSTANT shift. Every hash2/noise2 call gets a seed, no exceptions.
- Node ⇣ collision guard refuses imports for already-baked keys (by
  design, the truchet lesson) - iterating a baked node happens via
  bake + dev-server HMR with the lab file as the working copy, never via
  browser import. Symptom of forgetting: "the slider does nothing" while
  editing the lab file - the browser is running the old bake.

## Roadmap / ideas

Frame-sequence export as single ZIP · per-pen time estimates · value ports on
promoted group params · multi-tip brush tool change (servo) · zoned vacuum table
workflow for wet media · registration marks for mega sheets · SimView zoom ·
GitHub nodes library curation · surface compute errors on the node card
(engine currently swallows compute exceptions silently) · built-in Truchet
"Chain strokes" opt-in backport (def false to keep old patches byte-identical;
see Truchet Multiscale).