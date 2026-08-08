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
- `src/defs/nodes/*.js` — one file per node, **215 files** (217 nodes total with
  group + reititys; Generators 121, Modifiers 67). ESM format:
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
  (`moonrakerUrl`). LAN/local only by design — the Pages build shows a
  red/failed DRO (https page cannot open insecure ws://; correct, not a bug).
  Wired into App.jsx via tools/era/patch-dro.mjs.
- `docs/` — MUUSIA-HANDOFF.md (this), MUUSIA-NODES.md (every node),
  MUUSIA-NODE-API.md (custom-node authoring spec, plotternode format),
  MUUSIA-MAP.md (OSM map import guide: overpass-turbo workflow, sizing, queries),
  MUUSIA-PLOTTER-MECH-HANDOFF.md (X-Carve build: mechanics + ink blot tool),
  MUUSIA-MAGNET-JIG-SPEC.md (safe-areas / laser jig feature, design complete),
  MUUSIA-NODES-SRC.md (generated here by `tools/make-src-bundle.mjs`).
  MUUSIA-PORTRAIT-SPEC.md (Portrait node: face analysis + tonal rounds +
  one-line modes, design complete),
- `klipper/` — machine-side configs at the repo root: `printer.cfg` draft for
  the BTT Kraken, `moonraker-cors.snippet.conf`, pen-cal drafts, README with
  the firmware build recipe. Version-controlled source of truth; live copies
  on the Pi (`nakit`). Outside `src/` and `public/` — never touches the Vite
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
- Node count check: `ls src/defs/nodes | wc -l` (223) — the old
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
  retrying. Requires the local dev origins in Moonraker's cors_domains
  (klipper/moonraker-cors.snippet.conf, applied on nakit). Read-only: it
  never sends G-code.
- **Animation, Mega Canvas, Mini Canvas, magnet jig, machine profiles,
  Travel Stop, custom modules:** unchanged since v2.0–2.1 era; see MUUSIA-NODES.md
  and README for user-facing docs. Magnet jig functions (`magnetPlacement`,
  `jigGcode`, `buildZip`/`crc32`) live above APP_VERSION in App.jsx.

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

## Hard-won pitfalls (keep)

- Era-patch changes to App.jsx can VANISH silently if a later session
  rewrites App.jsx from an older base (the v2.44 DRO regression: module file
  survived, integration gone). Cheap insurance: after any session that
  touches App.jsx wholesale, grep for sentinel strings of past era patches
  (e.g. `DroPanel`). Re-running an era patch is correct ONLY when its target
  has demonstrably reverted to the unpatched state — the OK/MISS anchor
  report is the proof either way.
- Browsers do NOT overwrite downloads (`name (1).ext`) — irrelevant post-C0 for
  code, still true for any downloaded file.
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

## Roadmap / ideas

Frame-sequence export as single ZIP · per-pen time estimates · value ports on
promoted group params · multi-tip brush tool change (servo) · zoned vacuum table
workflow for wet media · registration marks for mega sheets · SimView zoom ·
GitHub nodes library curation · surface compute errors on the node card
(engine currently swallows compute exceptions silently) · built-in Truchet
"Chain strokes" opt-in backport (def false to keep old patches byte-identical;
see Truchet Multiscale).