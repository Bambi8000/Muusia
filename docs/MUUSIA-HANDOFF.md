# MUUSIA — Project Handoff / Continuation Notes

Read this first when resuming Muusia development in a new chat. It captures the
current state, the conventions that must not be broken, and how work is done.
The repo itself is the source of truth; this file is the map.

Read `docs/MUUSIA-AGENTS.md` and `docs/MUUSIA-WORKSTATE.json` before editing.
Claude and Astra can both author nodes; ownership is per task and file scope.
The shared agreement controls startup, integration, validation and project sync.

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
- **Pin types are a closed set of four:** `paths`, `value`, `style`, `mesh`
  (`mesh` added 2.66). finishWire compares the type strings, so a new type
  refuses wrong connections for free — but it also needs a `TYPE_COLOR` entry
  (the port dot reads it with no fallback and renders invisible without one)
  and a `defaultFor` branch. Mesh payload contract in MUUSIA-NODE-API.md.
- `src/defs/helpers.js` — shared node helpers: `Pin, EMPTY, PENS (+PENS_DEFAULT,
  savePens, resetPens), mulberry32, hash2, noise2, resample, pathLength, applyStyle,
  isStyle, signedArea, parseSVG, SFONT, fontStrokes`. PENS loads user colors from
  localStorage key `muusia-pens` at import time (try/catch — Node CLI runs warn
  harmlessly about localstorage).
- `src/defs/nodes/*.js` — one file per node, **304 files** (306 nodes total, with
  group + reititys, which are Combiners/Routing entries defined inline in
  App.jsx and therefore absent from this directory — every count in
  NODES.md includes them, so a bare `ls | wc -l` is always two short;
  Generators 191, Modifiers 76). ESM format:
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
  the BTT Kraken, `moonraker-cors.snippet.conf`, `viivain-screen.conf` (KlipperScreen menus, MECH-HANDOFF §7.1), pen-cal drafts, README with
  the firmware build recipe. Version-controlled source of truth; live copies
  on the Pi (`viivain`). Outside `src/` and `public/` — never touches the Vite
  build or Pages. Details: MUUSIA-PLOTTER-MECH-HANDOFF.md §1 and §5.1.
- `tools/` — living tools only; applied one-shots (surgery, versioned doc
  patches, era validators) live in `tools/era/` — do **not** re-run, anchored
  patches are not idempotent. Living: `extract.mjs`,
  `patch-docs.mjs`, `make-src-bundle.mjs`, **`bake.mjs`** (lab → built-in
  converter), `validate-examples.mjs` (structural check for src/examples.js), `speed-ladder.mjs` (Viivain motion-limit test G-code, MECH-HANDOFF §9.1), `bed-marks.mjs` (permanent bed alignment marks, MECH-HANDOFF §5.3). Every new node gets a
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
- Node count check: `ls src/defs/nodes | wc -l` (304, including Coral and Arc Mounds) — the old
  `grep -c 'cat: "'` on App.jsx is dead.
- Version: single `APP_VERSION` constant in App.jsx (UI header + G-code stamp).
  Bump with `sed -i '' 's/APP_VERSION = "2.XX"/APP_VERSION = "2.YY"/' src/App.jsx`,
  verify with `grep -o 'APP_VERSION = "[^"]*"' src/App.jsx`.
- Learn check: `npm run build` also builds the Learn site (`build:learn`), and the
  deploy workflow then runs `npm run check:learn` (learn/validate.mjs, ~18k checks:
  links, assets, patch integrity, screenshot + export provenance). **Run it locally
  after the build, before committing** — a red check:learn means Pages will not
  deploy. Captures may be older than APP_VERSION (never newer); any real change to
  tracked export/evaluation scope, machine.js or the listed helper/node dependencies
  needs an actual browser recapture (learn/README.md). Schema 2 does not hash the
  whole App.jsx and does not use the obsolete reviewedChange exception.
- Deploy: git push → GitHub Pages via CI (`.github/workflows/deploy.yml`),
  which serves **only the built `dist/`** — repo `docs/` is never online.
  Anything that must be reachable on Pages goes in `public/` (Vite copies it
  verbatim into dist, e.g. `public/sim/` → /Muusia/sim/). CDN lags ~10 min; `curl -s <url> | wc -c` +
  version grep distinguishes broken deploy from cache. Sentinel greps on
  `dist/index.html` must target string literals (GUI text, node keys) —
  minification renames identifiers, so variable/function names grep 0.
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
5. Update `docs/MUUSIA-NODES.md` (paragraph + counts), tags/catalog and the
   HANDOFF version history **in the same release commit, before push**. Both
   Claude and Astra follow the shared release gate in MUUSIA-AGENTS.md.

## Working conventions (collaboration)

`docs/MUUSIA-AGENTS.md` is the shared workflow. These delivery conventions apply
according to the session's actual capabilities:

- Both authors may build nodes; one task owns each active file scope in
  `docs/MUUSIA-WORKSTATE.json`. One integrator handles the release.
- A repository-capable agent performs authorized work directly and reports the
  result. A web-only Claude session supplies complete, zsh-safe command blocks
  (no interactive `#` comments), expected outputs and its snapshot base commit.
- Use complete files when suitable or an idempotent anchored era patch for a
  stale-copy-sensitive engine/doc change. Integrate against the actual checkout;
  a full replacement must never overwrite newer unrelated work.
- Update docs with the implementation before push. Era doc patches remain useful
  for web-delivered batches; routine direct repository doc edits do not require a
  throwaway patch script. Derive versions/counts from disk, never old chat text.
- Run `tools/project-files.sh` after integration, and upload/replace its files in
  the Claude project before continuing there. The snapshot manifest records HEAD,
  APP_VERSION, dirty state, original paths and hashes. The command itself does not
  upload files. It includes machine.js, all app modules and the current Learn gate.
- Downloaded deliveries are integrated from explicitly identified files into
  their intended paths, then validated and baked as needed. Do not select an
  unrelated file just because it is the newest matching download. Lab nodes are
  plain `({...})` object literals; bake.mjs rejects IIFEs.

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
- **Focus mode (v2.78, F):** the canvas narrows to a one-card strip (the
  selected node auto-scrolled into it, fully live: sliders, files, gear
  setup, promoted group params) and a large preview panel fills the rest.
  Two roles: EDIT (the node in the strip) and WATCH (the preview source).
  L / Lock watch pins WATCH so arrows only move EDIT — watch a Merge while
  tuning its inputs. ←/→ walk first-input upstream / first-consumer
  downstream, ↑/↓ cycle sibling inputs of the same consumer (fallback: all
  nodes in level order); only data edges count, param wires are not
  navigation. Guides button toggles overlay guides (drawn only when
  EDIT = WATCH). Right panel hidden while focused; Esc/F exits. Space fix
  shipped alongside: `primary` falls back to the last selected node
  (existence-checked per level) so Space always opens a preview, and the
  keydown guard passes Space through from focused range sliders with
  preventDefault — the browser default (page scroll) was the "canvas jumps
  to the bottom" bug.
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
- **2.65** Mesh Slice node (STL in, cut sheets out — the layered-object
  workflow gets its own geometry source). NEW GEN meshslice (structural):
  binary + ASCII STL intake via a `type: "file"` param with fileBinary
  (the definition-level onFile/fileAccept/fileLabel fields do NOT render a
  picker on their own — the param row is what creates it, caught only when
  the node reached the browser and the inspector came up empty), 120k
  triangle cap with a decimate message, normalised to a unit box at intake.
  Z-plane slicing at band mid-heights, segments chained on a 0.01 mm weld
  grid with 3x3 neighbour lookup so non-watertight AI meshes still yield
  open runs instead of nothing. Negative primitives (Sphere/Cube/
  Dodecahedron, 0-3) are cut per-plane in 2D, NOT by 3D CSG: the shell is
  clipped outside the hole sections and the hole sections are clipped
  inside the shell (even-odd point-in-polygon with a bbox pretest), runs
  under 0.5 mm dropped as chips. Dodecahedron sections come from the 20
  golden-ratio vertices and 30 edges via edge-plane intersections ordered
  by atan2. Rod holes 1-4, ring (radius + angle, a single hole ignoring
  the radius) or manual per-hole XY; a rod clips away where no material
  sits under it. Modes: Single, Frames, All contours, Grid layout and Grid
  pages (ANIMATE, canvas-sized pages labelled P n/total) — all true scale,
  the grid anchored to the bed corner with columns fitted between the Bed
  margins — plus two PREVIEW modes stamped PREVIEW NOT TO SCALE: Contact
  sheet (whole run shrunk to fit, unscaled number gutter so labels survive
  any shrink factor) and Isometric stack (axonometric projection of the
  real sliced geometry, View angle/elevation/Layer spacing). Preview
  sampling coarsens ADAPTIVELY (previewStep) because the fixed budget
  silently truncated a 40-sheet 400 mm run at sheet 31 — a preview that
  drops sheets is worse than a coarse one. Preview every Nth sheet thins
  dense runs. Tags 3d/grid/mesh/stack/structural. Validator
  tools/validate-meshslice.mjs (real helpers, lab/baked auto-switch, 158
  checks): synthetic STLs built in code (binary cube/box/sphere, ASCII
  tetra), parser rejections, cube slice perimeter/area/centring against
  exact numbers, hole clipping geometry, dodecahedron section radius,
  M4/M5 clearance diameters and ring spacing, rod-inside-void removal,
  grid disjointness and true scale, page coverage (5 pages x 12 = 50
  sheets exactly, frame clamping), preview fit and no-truncation at 200
  sheets, budget, non-watertight survival, every select option, showIf
  predicates, extremes, overlay guides in every mode, determinism and
  non-mutation. Two engine patches shipped alongside:
  tools/era/patch-frames-zip.mjs bundles the per-frame exports into ONE
  zip via the existing buildZip (they used to fire N separate downloads
  450 ms apart, which browsers throttle or block outright at 50 frames, so
  long runs arrived incomplete) with a percentage readout on the xN
  buttons, and tools/era/patch-stack-max48.mjs raises the Stack View sheet
  cap from 12 to 48.
- **2.66** Blob Mesh + a fourth pin type (generated geometry can now
  reach Mesh Slice without an STL round-trip). NEW PIN TYPE `mesh` via
  tools/era/patch-mesh-pin.mjs: finishWire already compares type strings so
  the connection rules needed nothing, but TYPE_COLOR did (the port dot reads
  `TYPE_COLOR[pin.type]` with NO fallback, so an undocumented type renders as
  an invisible circle) plus a `defaultFor` -> null branch. Payload
  `{ kind:"mesh", tri, v, dims }`, flat 9-per-triangle, centred and scaled to a
  unit longest dimension at the SOURCE so a wired mesh and an imported STL
  slice identically. tools/era/patch-meshslice-input.mjs adds Mesh at ins
  index 1 (after Style, so existing Style wires keep their port number); the
  wire wins over a loaded file and unplugging falls back to it. NEW GEN
  blobmesh (structural): body = 1-5 metaballs fused with a polynomial
  smooth-min, surface found by marching each ray and bisecting the OUTERMOST
  crossing — the naive inside-out bisection broke as soon as manual placement
  put the origin outside the union, so the sampling origin is the
  radius-weighted centroid of the ball centres. Placement Seeded or Manual
  (X/Y/Z + size per ball, seed ignored). Profile presets or wired paths, read
  as Cross-section (DEFAULT) or Vertical profile — the first release only had
  the vertical reading and a wired Superformula star therefore looked ignored,
  which is also how the second bug surfaced: the profile was mapped against a
  guessed height (`rz * 1.05`) instead of the real one, so Ball size 120%
  pushed the ends past the table and flattened them. Now two-pass: measure the
  Z extent, then apply profile/taper/twist against it. Surface distortion =
  seam-free fBm (three noise2 lookups on the direction vector, never on
  theta/phi, which would seam at 0/2pi) + angular lobes + vertical waves.
  Outputs Wireframe, Silhouette, Mesh in that order because the engine
  previews port 0 and a mesh there renders blank; the silhouette is real
  (front-face/back-face edge pairs chained), not a projected hull. Tags
  3d/mesh/noise/organic/structural. Validator tools/validate-blobmesh.mjs
  (113 checks): mesh contract (v.length === tri*9, unit normalisation,
  centring, 1e-4 rounding, S*(2R-2) triangle count), sphere/oval ratios,
  every profile option, cross-section vs vertical readings, Profile amount 0
  proven to be a true no-op, Hourglass pinch at ball size 120%, per-ball
  XYZ/size liveness, balls pulled fully apart, lobe/wave/noise liveness,
  wireframe ring+meridian counts, silhouette within the outline, view angle
  NOT affecting the mesh, budget at 128x128, extremes, and a live handshake
  slicing the generated mesh through the baked Mesh Slice. Mesh Slice
  validator grew to 169 (wired mesh precedence, fallback, EMPTY and garbage
  on the pin).
- **2.67** Preview Measure tool: a Measure button in the preview panel arms click-to-place of two points on the sheet (magnet-jig style draggable handles); a dashed line with a live mm readout connects them, drag to adjust, double-click a point to remove it. Works in the small preview and the big-preview overlay; toggling Measure off clears the points. GUI-only change, no nodes or engine seams touched. (tools/era/patch-measure-tool.mjs)

- **2.68** Moire Disc pie-slice sector cutter: new Sector deg (0-360, default 360 keeps every old patch byte-identical - verified against the pre-patch node on all nine content modes) and Sector start (showIf < 360). All content clips to the wedge through a shared push wrapper: closed loops re-seam at an outside point, cut ends land on the sector edges by bisection (oracle tolerance 5e-3 rad), the rim becomes the closed cake-slice outline drawn unclipped (its points ARE the boundary), the overlay shows the wedge poly. Sector < 0.05 deg is an explicit empty sector - a zero-width sector otherwise emits micro-whiskers where rings cross its edge ray exactly (caught by the validator). Frame clock into Sector deg = a filling pie; two complementary sectors with different contents = a two-fill pie chart. (tools/era/patch-moire-sector.mjs, tools/validate-moire-sector.mjs)

- **2.69** Three nodes. **Zine** (duo): imposition for folded booklets - 8-page mini zine, 4-page folio, 8/16-page saddle stitch and accordion, with page pins created by the Format (dynamic `ins`) and one output plus a Side selector for double-sided work. The back imposition is DERIVED, not tabulated: the reverse of page k is its recto/verso partner and its panel mirrors by Flip axis (short-edge flip also turns the artwork 180 deg), proven by a geometric oracle that mirrors every front panel and finds its twin. Registration marks sit at identical sheet coordinates on both sides and are symmetric under both flips. Scaling gained Fill (crop, with a Liang-Barsky clip) and Rotate 90 modes after the first version letterboxed landscape canvases into portrait pages - Rotate 90 + Fit is exact on A-series at margin 0. **Video Test Card** (gen/scientific): 15 real cards (PM5544 composite, EIA 1956, monoscope, convergence, Siemens star, Fresnel zone plate, multiburst, EBU bars + PLUGE, greyscale, overscan, focus, checkerboard, line-pair ladder, circle geometry). Tone is hatch density throughout, since a pen has no grey; CRT warp is pinned at the card corners so the distortion can never walk off the sheet. **Polyhedron Studio** (gen/space): 21 solids GENERATED by rectify / truncate / dual from the five Platonics - Euler V-E+F=2 is validated for every one - with per-face fills computed in the face plane before projection, Even density (spacing divided by foreshortening) so edge-on faces do not collapse into slivers, and three outputs (Faces, Silhouette, Mesh). Stellate reshapes the solid and reaches the mesh; Explode is drawing only, and a validator oracle enforces that split. (tools/validate-zine.mjs, tools/validate-videotest.mjs, tools/validate-polystudio.mjs)

- **2.70** Three generators, all three built on exact hidden-line removal of a
  different kind. **Chain** (gen/geometric): interlocking links as FLAT hatched
  bands, one plane each — the depth of a plane is a closed-form solve at any
  screen point, so over/under at every crossing falls out of the geometry with
  no weaving bookkeeping anywhere in the node. Circle/triangle/square/hexagon
  links, chevron and herringbone hatch, per-link spin and alternating offset,
  Line/Ring/wired-spine layouts, one link upward. **Circuit** (gen/structural):
  constructivist schematic — solid hatched blocks in aligned columns, orthogonal
  trace bundles corridor-checked against the blocks (an unroutable trace is
  dropped, never drawn through a mass), baselines, empty frames, optional
  under-gap crossings. **Knot Tube** (gen/geometric): a closed 3-D knot as a
  canal surface (the union of spheres along the spine), cross-wound helices, the
  radius a function of arc length clamped locally under the curvature radius,
  and the winding closed by measuring the parallel-transport holonomy and
  spreading it over the loop. Torus, figure-eight, Lissajous and seeded Fourier
  tangle spines. Validator lessons this cycle are in the pitfalls below; each
  node's oracles were mutation-tested by disabling the invariant they guard and
  confirming the failure. (tools/validate-chain.mjs, tools/validate-circuit.mjs,
  tools/validate-knottube.mjs, tools/era/patch-docs-3nodes.mjs)

- **2.71** **Controller** (math) baked, plus the live-input engine seam it
  needs. The node had existed as a lab file and been loaded through Node ⇣ for
  several sessions, which registers it in the running session ONLY — it worked
  throughout development and was simply missing from dist. Three layouts:
  Channels (generic 1-6), Sticks (LX/LY/RX/RY, two channels per stick) and
  D-pad + triggers (Pad X and Pad Y stepped by the d-pad pairs on the rising
  edge, L2 and R2 analog on their own pins). Every channel normalised 0-1 in
  v1..v6 and mapped through Out min..Out max, so one storage model serves every
  layout — an intermediate design gave each control its own natural unit
  (degrees, counts, 0/1) and had to be collapsed. Engine seam
  `src/live-input.jsx` (era patches patch-live-input.mjs and
  patch-live-overlay.mjs, already applied): a LIVE toolbar chip, arming
  decoupled from selection, a readout mirrored above the big-preview overlay,
  20 Hz write throttling and one undo snapshot per gesture. The seam's rule —
  live input goes into parameters, never into `ctx` — is now written up in
  NODE-API §3. Also: `bind: "auto"` picks the first CONNECTED pad rather than
  index 0, because a Bluetooth pad that reconnects routinely lands on index 1-3
  and pinning slot 0 made a working controller look dead.
  (tools/validate-ctrl.mjs, tools/validate-live-input.mjs,
  tools/era/patch-docs-ctrl.mjs)
- **2.72** four generators baked out of nodes-lab. **Signature**
  (gen/textimg) sets name, date and edition number in the single-stroke font and
  anchors the block to a sheet corner; the Hand font is seeded tremor plus
  per-letter tilt and baseline drift with three averaging passes for nib inertia,
  and the rule runs through the same wobble at 0.55x so a hand-set mark is not
  framed by a ruler. **Dice Pips** (gen/geometric) draws die faces 0-9 from a
  range or digit string with Rings/Spiral pip fills. **Sand Painting**
  (gen/organic) rakes a dry garden around seeded stones. **Vision Chart**
  (gen/scientific) builds Landolt C, Tumbling E, Chinese 5-mark,
  Golovin-Sivtsev and pseudoisochromatic charts at true optotype size.
  Three real bugs were found by the validators rather than by eye, and all
  three were invisible in the preview: Sand Painting's size-variation and
  irregularity sliders were dead (`Math.min(1, x) / 100` clamps to 1 before
  dividing, so every value above 1 % meant 1 % — the stones were always clean
  ellipses); Vision Chart's hatch loops stopped short of the nominal radius by
  up to one ink pitch, which is 8.5 % of the diameter on the smallest optotypes
  and broke the 10^0.1 row scaling that is the whole point of a logMAR chart;
  and the pseudoisochromatic plate sampled its figure with the same uniform
  dart-throwing as the ground, so the hidden number never resolved at any
  density. The figure is now packed in its own phase with finer dots and an
  11 % side bearing between digits. Vision Chart's scale labels moved from a
  3x5 dot matrix to `fontStrokes` (697 -> 361 paths and actually legible) and
  the default viewing distance dropped 5 m -> 2.5 m, the one value that fills
  A4 for all four charts. The node was renamed from the lab key
  `vision_chart_lab` before baking, since keys freeze at bake.
  (tools/validate-signature.mjs, tools/validate-dice_pips.mjs,
  tools/validate-sand_painting.mjs, tools/validate-vision_chart.mjs,
  tools/era/patch-docs-v272.mjs)
- **2.73** two exporter changes driven by a real plot going wrong. A
  **pre-flight bounds guard** now scans the finished G-code for moves outside
  the machine work area and, if it finds any, splices a `; !! OUT OF BOUNDS`
  block plus an M117 above the first command. The magnet-jig exporter had a
  per-move check all along; the plot exporter only warned when the whole canvas
  was oversized, so a label overhanging by 4 mm shipped silently and was found
  on paper. Scanning the emitted lines rather than the path data means
  start/end G-code and macro-driven moves are covered too. Note it cannot see a
  runtime `SET_GCODE_OFFSET`, so an origin set by PLOT_START shifts the real
  extent. Second, an opt-in **pen colour announcement**: with *Announce pen
  colour* on, each pen change emits `RESPOND PREFIX=tgalarm MSG="Pen n: Name"`
  before the pause, which moonraker-telegram-bot forwards to the phone with a
  notification. Opt-in because RESPOND aborts a print on a Klipper without
  `[respond]`. (tools/era/patch-export-guard-tgpen.mjs)

- **2.74** **Calibration Sheet** (gen/structural) baked: an exact-size
  square with diagonals, corner crosses, a tick ruler, repeat passes that
  alternate direction, and an origin cross drawn first and last as a step-loss
  detector. The node refuses to scale — the validator proves side lengths to
  1e-9 mm and renders the same params on four canvas sizes to assert the
  geometry is byte-identical, so a fit transform added later turns the suite
  red. Two bugs were caught by writing that suite: a label on a narrow square
  overhung the footprint (now shrunk to the square's width), and a large
  *Cross size* pushed the origin cross to a negative coordinate that Klipper
  would refuse (now clamped to the sheet).
  (tools/validate-calib_sheet.mjs, tools/era/patch-docs-v274.mjs)
- **2.75** **Photo Trace** (gen/textimg) baked, plus printable marker sheets
  (`public/markers/muusia-markers-a4.png` / `-a3.png`, generated by the new
  zero-dependency `tools/make-marker-sheets.mjs` — 300 DPI grayscale PNG via
  node:zlib with a 5×7 bitmap font and a 100 mm verification bar). Photograph
  an object on the printed sheet and the node recovers its outline at true
  physical size and position: 3 solid + 1 donut (anchor) 15 mm corner markers
  → per-image-corner blob pick → 4-point DLT homography px→mm → largest
  interior blob → Moore contour trace → RDP → Chaikin → normal-offset Grow.
  The validator synthesizes the sheet and a known ellipse under a known
  perspective homography and proves recovery to ≤0.27 mm (centroid ≤0.22 mm)
  in all four camera rotations, with the sheet's own scale bar and text row
  present as decoy blobs; supersampled soft edges keep Threshold testable.
  imageMax 1200 (engine allows up to 1600), ~14 ms/compute at full
  resolution. Intended chain: Photo Trace → Wind Tunnel Obstacle — plot the
  flow around the blank spot, then glue the object into it.
- **2.76** three nodes baked. **Zen Garden** (duo): karesansui raked gravel —
  exact euclidean distance field (Felzenszwalb 2-pass EDT, boundary-sampled
  seeds, scanline sign) puts a pool of offset rings around every Stones
  shape and clips the background rake (straight/waves/circular marching-
  squares iso-lines, Tines comb groups) to end at the pool via bilinear
  field interpolation; validator proves ring radii, exact far-field
  straightness (0.000 mm residual) and that no groove enters clearance.
  **Galaxy** (gen/scientific): procedural spiral-galaxy point cloud (disc +
  log-spiral arms + gaussian bulge + halo), three-pen colouring, tangential
  Dash star-trails, rotation-invariant scaling for Frame-driven orbits;
  validator uses de-rotated m-fold angular concentration as the arm oracle.
  **Zigzag Path** (mod/deform): input paths redrawn as zigzag / sine /
  serpentine coil with integrated-phase wavelength drift for organic
  variation; sine oracle exact to 1e-4 mm, zigzag apexes analytic, closed
  paths snap to whole periods. Marker-sheet chain: Photo Trace stones →
  Zen Garden → Zigzag Path rings for rippling gravel.

- **2.77** the animation batch: five nodes baked plus an engine seam.
  **frameFan seam v2** in evalLevel: a def with `frameFan: true` re-evaluates
  the level once per output frame (ctx.frameIdx 0..N-1, frameCount = N,
  ctx._ff recursion guard) and fans the collected input out as its own
  outputs; `frameFan` as a function (node, merged) => N instead hands the N
  collected frames to compute AS the ins array (returning 0 opts out).
  Applied era patches: patch-frame-fan2.mjs (installs clean or upgrades v1,
  extract-and-run proves both forms), patch-frame-rot.mjs (Frame node fifth
  output `rot °` = tl·360, old outputs byte-identical), patch-galaxy-
  colors.mjs (Galaxy Colors Extended: Halo pen, dithered Inner disc split,
  HII knots ×1.5 — Classic proven byte-identical pre/post across a sweep).
  **Frame Grid** (duo): flipbook imposition with photo_trace-language plotted
  markers; Animate fill = the whole animation through one input, overflow
  pages to sheets (outer frameIdx = sheet, P n/N tag, global numbers);
  Inputs and Clock fills for manual workflows; one shared canvas→cell scale
  preserves frame registration. **Frame Split** (duo): ink-length /
  path-count chopper — exact arc cuts, z interpolation, build-up / windows,
  ease, reverse. **Collect Frames** (duo): the generic frame fan-out on the
  seam. **TV Antennas** (gen/structural): mast-as-unit rooftop forest —
  stacked heads with per-head type / size / boom tilt / foreshortening,
  Panel and FM-star types, parapet dish clusters, struts, inter-mast cables,
  retry-shrink at canvas edges. **Snarled Line** (gen/organic): coil-memory
  strand physics with a coil/run phase machine, Loop vary log-spread loop
  sizes, multi-clump attractors (wire Clump at to place them), Tighten and
  Clump pen core split; validators prove the clump ink fraction (0.03→0.80)
  and log-radius spread growth.

- **2.78** **Focus mode** (engine, era patch patch-focus-mode.mjs): F
  narrows the canvas to a one-card strip + big WATCH preview beside it;
  EDIT/WATCH roles with L lock; arrow-key wire-graph navigation (←/→
  stream, ↑/↓ siblings); Guides overlay toggle; Simulate + direction +
  stats in the panel; right panel hidden while focused. Space-preview
  fixes: last-selected fallback for `primary`, and Space from a focused
  range slider no longer scrolls the canvas (guard passes it through with
  preventDefault).

- **2.79** drag release fix (era patch patch-drag-release.mjs): node
  drag / pending wire state was cleared only by mouseup on the canvas area
  div — releasing over the palette, panels, focus preview or outside the
  window left the node following the mouse ("stuck hand"). Now window-level
  mouseup + blur clear the state anywhere (bubble phase, so port finishWire
  still wins), and onAreaMouseMove drops stale state whenever the primary
  button is up (e.buttons guard).

- **2.80** range-slider key passthrough (era patch
  patch-range-keys.mjs): the focus-mode keydown guard let only Space
  through from a focused range input, so F did nothing right after a
  fader drag. Space, F, L and Escape now pass through; arrows stay native
  (slider value), Delete and letter shortcuts stay blocked from sliders.

- **2.81** range arrow passthrough (era patch patch-range-arrows.mjs):
  in focus mode arrow keys pass through from focused range sliders and
  always navigate nodes (the branch blurs the stale slider focus first).
  Intentional tradeoff: no arrow-key slider fine-tune while focus mode is
  on; outside focus mode slider arrows stay native.

- **2.82** **BG Fill** (gen/geometric) baked: seven background fills under
  one Mode select — Drape (fur-stroke arc bands folded by sharp creases),
  Magnet (iron-filing dipole dashes, Attract/Repel), Grain (woodgrain flow
  parting around voids, optional Crack), Scales (fish-scale dash rain), Torn
  (strokes fanning off a spine into a wobbly rip lens), Pleat (triangle-wave
  diamond pleats, amplitude clamped below the line-crossing bound k < cw/4)
  and Circles (greedy largest-first packing with occupancy-grid dart pruning;
  Rings fills each circle at Line pitch, big-first emission so a budget cut
  eats small circles). Void input = Negative Space semantics: closed
  interiors cut AND every wired line (open or closed) carves a Void clearance
  band via bucketed segment distance; the band uses RAW input points when
  affordable — resampling shaved sharp star corners ~1 mm, caught by the
  validator's exact-edge test. Grain deflects around open lines with a
  VECTOR-SUM push over nearby segments so a ribbon's opposite banks cancel
  inside the corridor — nearest-seg push shoved lines across into the far
  bank's cut zone. Torn with a wired path makes IT the rip: rays From center
  or Perpendicular (±3-sample smoothed tangents), open polylines ray both
  sides, box entry/exit binary-refined; unwired keeps the lens fallback.
  tools/validate-bg_fill.mjs: 207 checks — per-mode invariants, clearance
  violations by segment distance, mutation smoke on the void oracle,
  Rings + min-pitch budget.

- **2.83** Favorites + Most used (UI only, no engine changes). **A** opens
  the quick-add in Favorites mode: starred nodes in pick order, then a Most
  used list (top 8 by lifetime add count, count >= 2, unstarred only);
  typing searches favorites first with the full catalog below an ALL NODES
  divider, so stars can be added and removed without leaving the popup.
  Every quick-add row (G/M/D/C/X/N/A) and every catalog card gets a
  ☆/★ toggle; Tab stars the highlighted quick-add row. User-level
  localStorage: `muusia-favs` (ordered key array) + `muusia-use` (counter
  map) — same pattern and origin-specificity caveat as `muusia-nicks`.
  The counter bumps in addNodeAt, the single add funnel, so palette drag,
  quick-add, catalog click and Surprise me all count. Shipped as
  tools/era/patch-favorites.mjs.

- **2.84** **G-code In** (gen/textimg) baked: imports G-code back as paths —
  the Muusia→Latu→Muusia return leg. Auto inverts the Muusia header transform
  (canvas/origin/flipY) for a 1:1 roundtrip, maps CHANGE PEN comments to pen
  layers, reconstructs closed paths and Brush Z immersion, and classifies
  standalone bed-Z moves contextually (contact after travel, lift after draw,
  value fallback for foreign G1 travels) so z-hop and brush-pressure Z coexist;
  servo mode via SET_SERVO angles. Dip/maintenance blocks skipped via their
  comment markers (maintenance M0 is NOT a split point); Latu additions
  (INK_DOSE/AIR_PULSE/M83 E words) transparent. Foreign dialects: G0/G1 and
  Z-threshold pen detect, G90/G91, G20/G21, G2/G3 arcs (IJ+R, ~0.5 mm
  tessellation), Flip Y over content bbox, Fit to margin. Validator: 73 checks
  incl. a mutation-tested roundtrip oracle at 0.006 mm against a toGcode
  mini-port (bed-Z + z-hop + brush Z, servo, maintenance, dip, Latu fixtures).
- **2.85** **Ink Relief** (mod/deform) baked, from a photograph of a
  plot where the ballpoint had beaded into a glossy bead at every spike and a
  solid black bar down a pinched waist. Two detectors, six reliefs: corners
  (Round, Fan, Notch) and overlapping runs (Spread, Thin, Taper), both gated on
  how many passes crowd the same place and both scaling relief with that count.
  The validator measures ink rather than shape — a node that only moved points
  around would pass a geometry test and still bead — by building a 28-ring
  spike stack and a 26-pass neck and asserting how much path length survives
  inside a small disc: Round 28 %, Fan 11 % at 6 mm, Notch 0 %, Thin 46 %,
  Taper 23 %. Spread needs its own oracle because it does not remove ink at
  all, it widens the band, so that test asserts band width instead: 1.25 mm to
  6.49 mm, monotonic in Amount. Two false positives are tested for explicitly:
  thirty lines crossing at a point are not an overlap, and a shape with no
  pile-up comes through byte-identical. Writing those tests turned up that a
  spike stack genuinely contains overlaps as well, since the edges feeding the
  tip run near-parallel, so Target Both is stronger than either pass alone.
  Also in this release: **Potato** now defaults to clean blobs — Eyes was
  defaulting to "Arcs (eyes)", so every freshly dropped node arrived textured
  (9 paths become 72) — and *Eyes per potato* gained a showIf so it stops
  sitting in the inspector doing nothing. Saved patches write every parameter
  explicitly, so existing work keeps whatever it had; only new nodes change.
  The first attempt at that patch reported a false SKIP, because its guard
  searched the whole file for `p.eyes !== "None"` and the compute body already
  contained that string — guards have to test the param line, not the file.
  (tools/validate-ink_relief.mjs, tools/era/patch-potato-clean.mjs,
  tools/era/patch-docs-v275.mjs)

- **2.86** **Belt Drive** (gen/machines) + **Mushroom** (gen/nature) baked.
  Belt: directed-circle tangent serpentine, roller-collision deflection,
  measured auto-idler pinch fix (never-worse guarantee), Ribbon rails,
  Empty-regions second output. Mushroom: 7 species as 3D revolution models
  (Yaw/Pitch camera), surface-traced forking decurrent gills, one-normal
  visibility, funnel rims always full closed loops, Chaos disorder layer,
  watertight normalized Mesh output (count-invariant first copy).

- **2.87** new **Shuffle Seams** modifier (mod/pathops): rotates every
  closed path's start point (Golden spiral / Random / Fixed step) via exact
  arc-length cut with z interpolation so nested-ring pen-down seams never
  line up; optional Overlap mm runs past the seam as an open path to hide
  the pen dot. Born from the first Belt Drive plot on Viivain.

- **2.88** three new generators. **Plaid Grids 3D** (gen/geometric):
  band-line grid planes in a rotatable 3D world, true pinhole perspective,
  Phase = one full camera orbit with a byte-perfect seamless loop, per-line
  hashed dropout so frames never flicker, orbit-scanned fit so the whole
  loop stays on the sheet. **Star Chart** (gen/scientific): Galaxis-style
  polar/cartesian graticule with ring bundles, wear, tangential labels and
  a patchy density field of dot hits on a separate pen. **Broken Grid**
  (gen/geometric): per-edge grid decay with either-or zone territories,
  lattice shifts, dash gaps and doubles — plus an always-on guard that
  detects isolated swastika-reading motifs (both chiralities, arms 1-2,
  with an isolation rule) and breaks them deterministically.

- **2.89** three new **creatures** generators. **Hands** (gen/creatures):
  anatomically proportioned arms and hands as single closed silhouettes built by
  a skeleton-to-outline walk (anthropometric phalanx ratios, knuckle arc,
  tapering forearm), ten poses including Mix, *Mutation %* sliding anatomy into
  AI-hand chaos independently of *Detail %* point density, Rows grid or a wired
  Spine with perpendicular mounts. It was written and validated at 84 checks in
  an earlier session but shipped only now: the lab file was graduated and
  deleted while the baked `src/defs/nodes/hands.js` was never staged, so commit
  eec9836 landed the validator alone and the node lived on only in the browser
  session that had imported it through Node ⇣. Recovered from the delivered lab
  file, re-baked, committed with `git add -f` on the explicit path. Lesson in
  the pitfalls. **Fish**
  (gen/creatures): Simple / Detailed / Mixed styles, seven species body
  profiles by a half-height function `ped + (1-ped) sin(pi u t^q)^k` with a
  species snout arc, rayed fins, gill, lateral line, markings and crescent
  scales; Rows / School / Spine layouts, Spine on the Fur Left/Right
  convention; shrink-only fit measured after placement; Lines + Bodies outputs;
  decoration emitted last so a budget cut removes scales before fish.
  121-check validator. **Whale** (gen/creatures): same frame, new drawing
  machine — flukes turned to show both lobes, species dorsals and flippers,
  sperm-whale box head with underslung jaw, orca patches, narwhal tusk — and an
  **Octopus** species (mantle+head as one ray-swept union, eight tapered arms
  with suckers) that Mixed rolls in among the whales in both styles.
  125-check validator. Both nodes reuse one placement block: Rows grid with
  jitter, School rejection-sampled scatter with heading and turn jitter, Spine
  resampled along wired paths with a default centre line when unwired.

- **2.90** five generators. **Snowflake** (gen/nature): one arm grown from
  the seed and rotated *Arms* times, five styles (Dendrite, Fern, Stellar,
  Plate, Paper), rod outlines, rime, Rows/Scatter; the validator proves the
  symmetry by rotating every point and finding its twin. **Lettering**
  (gen/textimg): Bold/Block/Roman capitals as a stamped distance field —
  clean unions, Outline/Hatch/Inline fills — plus 3D extrusion as the field's
  sliding minimum with Zigzag/Lines/Hatch side textures; the cursive Script
  and Copperplate hands that were prototyped were dropped before baking.
  **Cross Stitch** (gen/textimg): bitmap sampler fonts to deduplicated needle
  holes on the Holes pin for Needle Punch, thread guide (X, half, backstitch)
  on a second pin. **Chip Die** (gen/structural): hierarchical floorplan with
  bus channels, SRAM/logic/analog/cap/IO/routed textures, Processor cores
  mirrored from one template, Vintage routed dies with power ring and bond
  wires, Colour by type across seven pens. **Drape** (gen/structural): mesh
  cloth relaxed over seeded or wired objects (paths or a mesh pin), z-buffer
  hidden lines, Wire/Weave/Contour/Hatch, Fit/Square/Round sheet, Lock size
  by the rotation-invariant bounding circle. A Skull node was prototyped as an
  SDF surface and shelved. All five reuse the shared placement/fit pattern:
  measure after placement, shrink only, never grow.
- **2.91** new **Perspective Hall** generator (gen/structural, `persp_hall`): a
  one-point perspective corridor as a real 3D box (walls, floor, ceiling, far
  wall, stepped ledges with doorways) projected from the VP, every plane hatched
  at constant 3D spacing. Grid mode = classic laser-line perspective grid; Hatch
  mode = per-plane Across/Along/Both/None with *Hand* wobble, ragged ends and
  broken strokes for the organic ink-drawing look. Level of detail: when the
  projected spacing falls under *Min gap*, lines are dropped (stride doubling
  when ruled, stochastic survival when hand-drawn) so the hatch reaches the VP
  without clogging; one shared reference extent keeps the resulting density
  bands at the same depth on all planes regardless of Aspect, with a per-plane
  clog guard for walls much narrower than the reference. *Walls* = Sheet edges
  puts the eye off-axis so the corner lines hit the frame corners (asymmetric
  extents Xl/Xr/Yt/Yb throughout). Occlusion is exact t-interval arithmetic on
  projected segments (1/Z linear along a line; Cyrus–Beck against each ledge's
  convex-hull silhouette, owner excluded). 102-check validator incl. door
  emptiness, ledge occlusion, min-spacing, band alignment across aspects and
  corner hits; mutation-tested (removing occlusion, doors or LOD each trips its
  own checks).

- **2.92** new **Stitch Type** generator (gen/textimg, `stitchtype`): bitmap
  lettering (Bold/Sampler 5x7, Tiny 3x5, Pixel = cells per font pixel) with a
  distance-ring classification of the stitch grid — core / edge (inside),
  halo / aura rings (outside, 8-neighbour dilation) — and one mark family +
  pen per class (X · lattice · stripes · dashes · pink pins = the reference
  sampler chart; Circuit / Knit / Dotted presets; Custom exposes all five
  selectors). Collinear marks merge into runs (diagonals grouped by c−r / c+r,
  lattice by row/column), Bridge diagonals adds a 2×2 block at corner-only
  pixel contacts so thin-font diagonals stay connected, seed scoped to pins +
  aura only. Layout shared via `this._layout` (compute + overlay; overlay
  guarded for unbound this). 137-check validator rebuilds the grid through
  `_layout` and proves ring geometry, per-pen ring membership by sampling
  stroke interiors, both-diagonal coverage of every core cell, stripe count
  per run, seed scope, shrink-only fit and connectivity; mutation-tested
  (edge classification, halo ring, seedless hash2, bridge, merge, pin
  predicate, fit and 4- vs 8-neighbour rings each trip their own checks).

- **2.93** new **Kolam** generator (gen/geometric, `kolam`): sikku kolam
  as Gerdes mirror curves on a dot lattice. Midpoints stored in doubled
  integer coords; a ray at 45° crosses or reflects at each midpoint (boundary
  edges always reflect → border teardrop loops); state = (midpoint, outgoing
  dir), both orientations marked per traced cycle so each geometric strand is
  found once. Turns % = seeded interior mirrors; Single line / Target count =
  greedy toggling of an edge whose two sides belong to different strands
  (merge, −1) or the same strand (split attempt), retracing after each toggle.
  Layouts Interlaced (idukku pulli, u=i−j / v=i+j rectangle with parity),
  Square, Diamond, Wired region (lattice points inside the wired polygon,
  pitch kept exact). Rendering: control polygon = midpoints with turning
  points pushed outward (Loop reach / Turn size), Chaikin ×0–4 (collinear
  crossings stay exact X); Under gaps cuts only the pass parallel to the
  under direction (the same strand also crosses on top) using the checkerboard
  rule (horizontal-edge crossing: NE/SW over; vertical: NW/SE over) which
  alternates along every strand through turns; Ribbon / Contours = distance
  field over bucketed segments + marching squares (sdfcontours lineage),
  isolines at Width/2 + k·step. SFONT row / strand numbers, dots, pen per
  strand. 121-check validator: gcd law on n × m grids, single line over 192
  layout × seed × turns cases, every pass covered once, exact 90° crossings
  on the raw polygon, one open piece per crossing + two piece ends per
  crossing + alternation derived from the output, isoline distance ± field
  cell, border loop apex, chart-style bottom-up row numbers, wired-region
  containment; mutation-tested (mirrors ignored, reverse orientation, merge
  disabled, non-alternating over/under, double cut, reach, ribbon width,
  fit, row order each trip their own checks).

- **2.94** new **Conformal Grid** generator (gen/geometric, `conformal`): Smith chart
  family as conformal maps of an R × X grid (Smith / Admittance / Immittance,
  Inversion, Joukowski, Log-polar, Power). Lines are polylines sampled by
  clipped rendered length (coarse 64-sample estimate → N = length / step);
  Smith parametrises R and X through tan so the infinite lines are uniform on
  their image circles. Chart-style adaptive subdivision: majors (Smith value
  list 0…50) whole, minors (÷ Minor per major) and fine levels (halvings ×
  Fine depth) gap-pruned per sample against the nearest same-or-coarser-level
  neighbour (gap ≥ Cell mm), giving the fade-out hatching of the printed
  chart. Generic clip (Disc / Sheet / Wired shape) by predicate + bisection.
  Dressing: axis, angle and wavelength rings with ticks and radially rotated
  SFONT numbers, R labels vertical on the axis, X labels at the rim; text
  size capped at 4 % of the radius. Output bucketed by level and assembled
  coarse-first under the budget (skeleton truncated if it alone exceeds the
  budget, finer levels all-or-nothing). 97-check validator: conformality from
  the OUTPUT on all five map kinds (majors cross at 90° ± 2.5° at analytic
  crossing points), rim = full unit circle, R = 1 through the centre,
  Admittance = byte-level mirror, Immittance = Smith + mirror, Cell-mm
  pruning monotonic and parallel-neighbour distance ≥ 0.9 Cell, tick counts
  (144 + 36 / 200 + 50, ticks identified as radial 2-point segments), label
  stroke counts, clip containment, shrink-only fit incl. rings; 9 mutations
  each trip their own checks (stretched map, wrong Joukowski sign, prune
  threshold, no pruning, loose clip, tick spacing, one-axis mirror, no fit,
  unprotected skeleton).

- **2.95** new **Mosaic** modifier (mod/fillstyle, `mosaic`, Shape pin
  optional): mosaic as a TILE-ID FIELD. Fine raster over the margin box;
  figure mask by scanline parity (holes work); nearest-outline transform by
  8SSEDT-style propagation with exact sample positions (outline resampled at
  cell/2, boundary cells seeded, four corners brute-force seeded, two
  sweeps) giving distance d and arc-length s per cell. Ids: ground grid cell
  (snapped tx/ty so whole rows fit; border ring → pens), figure Contour rows
  (band = ⌊d/T⌋, cut by s scaled with the band perimeter ± 2π k T so inner
  rows keep their pitch, staggered; nearest-side rule yields the collision
  core), Grid, Fan (polar rings/sectors about the outermost container's
  centroid), None; thin grout zone along the outline belongs to no tile.
  Boundaries = edges between differing ids, chained per tile into loops
  (Tiles: Chaikin + Douglas-Peucker + inward bisector shrink by Grout/2,
  sliver fallback Grout/4, Min tile area filter) or chained once between
  junctions (Seams). Irregularity: hashed cut/grid-line jitter and noise2
  band wobble. 93-check validator: one tile per grid cell and border ring
  counts, grid-fit extents, tile areas = (Tile−Grout)², figure tiles inside
  / ground tiles outside the ring by distance, grout gap on both sides, rows
  from both boundaries, rim tile count = perimeter/pitch, no overlapping
  tiles (centroid test), Fan centroids at ring centres, Grid alignment with
  the ground, Seams ≈ half the ink of Tiles and Both = sum, seed scope, raster
  independence of the tile count, off-sheet outline fills the box; 12
  mutations each trip their own checks (no propagation, no grout zone, no
  pitch scaling, double bands, border pens, no shrink, grid fit ignored, fan
  sectors/rings, wobble ignored).

- **2.96** new **Gravity** generator (gen/geometric, `gravity`, Stamp pin
  optional): grid of stamps releasing from the bottom up. Release score =
  row position + noise2 clump field + hashed softness; released elements get
  a hashed fall fraction (Progress = landed share, the rest skewed toward
  just-released by a 2.2 power), Drift / Spin / Size mod ramp with the
  fraction, Grid jitter shakes intact elements near the line (zero at
  Release 0 so the grid is exact). Heap = seeded landing order into a 1-D
  height field with downhill rolling (sandpile), Pile spread pulls landings
  toward the centre, Packing sets increments; Floor / None alternatives.
  Wired stamps normalised to a unit box; built-in Dot segments sized by
  plotted radius and trimmed under the budget (80 × 80 Ring stays under
  112 k pts). Palette 1–4 with Diagonal / Rows / Columns / Random
  assignment, colour travels with the element. 106-check validator via
  `_layout` states and output geometry: exact grid at Release 0, crisp line
  at Softness 0 + Clumps 0, landed share ≈ Progress, drift/spin/size scaling
  with the fall, no same-column overlap and a sandpile slope limit in the
  heap, mound position vs Pile spread, Floor / None counts, stamp
  normalisation, pen assignment incl. landed elements, seed scope; 10
  mutations each trip their own checks. Also fixes Mosaic's palette folder
  (group texture → fillstyle; "texture" was not a MOD_GROUPS key so the node
  was invisible in folder view).

- **2.96** Gravity: new *Spin / size apply to* select (Fallen only = ramp with
  the fall as before; All = every element, intact included, carries its own
  hashed spin direction and size amount). Both modes share the per-element
  hash so switching keeps directions. Validator +10 checks (116).

- **2.97** five nodes, one batch (lab → validator → visual proof → bake).
  **Ray Fill** (mod/fillstyle, `rayfill`): even-odd ray fill of closed
  shapes, Per shape centres (Centroid / Random inside / Edge / Outside / Mix)
  or Shared centres (Nearest / All), spacing-at-rim density, core gap, fill
  fraction; validator 115 checks with mutation-tested midpoint-inside,
  segment-vs-outline and hole oracles; bbox rejection kept output
  byte-identical at 4× speed. **Fray** (mod/deform, `fray`): threads off a
  source line with hitches, beads and coil/ring/knot ends, one stroke per
  thread; *Avoid source* (interior test) and *Crossings None* (spatial-hash
  steering, spiral coils, beads beside the thread) — validator 95 checks
  proves zero proper crossings over the whole result and root-on-source
  < 0.05 mm. **Pleat** (gen/geometric, `pleat`): folded ribbon of parallel
  lines from a crease token script (`- / \ ^ v < > ( ) x ~ =`, presets
  Zigzag / Accordion / Twisted / Fan / Custom), cylinder shade, construction
  lines to the margin; validator 83 checks proves every token to the
  millimetre. **Chronophoto** (gen/scientific, `chrono`): Marey stick-figure
  motion analysis — 3-D skeleton, six keyframed motions, Side / Front,
  far-limb dashing, dashed joint trajectories with markers and SFONT
  numbers, ground line, optional Path pin for the pelvis route, *Animate*
  (Single instant / Onion skin, Phase wired from Frame, Trail write-on) with
  a layout fixed from the whole time window; validator 173 checks (bone
  invariance in every motion, no foot below ground, Phase 0/1 = plate first/
  last exposure, fixed ground across phases). **Typewriter Rain**
  (gen/textimg, `typerain`): typewriter grid with seeded glyph runs, bars
  and slash ladders, Down / Right, Strict / Free grid, double strike, Mask
  pin; validator 75 checks (single-cell strokes, one glyph + one pen per run,
  gap oracle mutation-tested). Engine lesson reconfirmed: shared geometry via
  `this._helper` methods (`_plan`, `_roots`, `_layout`, `_frames`,
  `_grid`) works because the engine calls compute/overlay as def methods.
  Doc batch: tools/era/patch-docs-v297.mjs.

- **2.98** Woven Ribbon: *Fill* Tracks / Rays / Square wave (+ *Ray step*,
  *Ray overhang*). Rays = perpendicular comb sampled every Ray step of spine
  arclength across the full ribbon width, alternating direction; Square wave =
  the same comb as one continuous meander (vertices identical to the Rays
  endpoints, proven). Both honour the under-pass gap windows; Tracks output is
  byte-identical to v2.97 (regression-checked). Era: tools/era/patch-woven-
  fill.mjs (node) + patch-docs-woven-fill.mjs (docs); validator
  tools/validate-woven-fill.mjs, 37 checks.

- **2.99** Woven Ribbon: *Two-tone comb* (+ *Split*, *Second pen*) for Rays /
  Square wave — every tooth cut at the split line, halves on two pens, the
  meander becomes two meanders sharing the split line. Two-tone off is
  byte-identical to v2.98 in all three fills (regression-checked). Era:
  tools/era/patch-woven-twotone.mjs + patch-docs-woven-twotone.mjs;
  validate-woven-fill.mjs now 50 checks.

- **2.100** **Root Vegetables** (gen/nature, `rootveg`) — Kosmos Botanika
  root cellar: nine kinds + Mix, half-width-profile bodies with asymmetric
  harmonics, kind-specific textures (accent shoulder on turnip / swede),
  Leaves / Cut stubs tops, Fray-lite root hairs that start on the outline and
  never re-enter the body, bbox rejection placement with 80 positions per
  grown specimen. Validator 178 checks (body height = Size exactly, roots on
  outline < 0.1 mm, bodies never intersect under No overlap, tops ≤ Top
  length × size, Mix cycles all nine kinds). Doc batch:
  tools/era/patch-docs-rootveg.mjs.

- **2.101** Test Card fixes + thick-pen variants. Line spacing: gap groups no
  longer run into the next lane (lines clip at their own pitch), labels sit on
  two alternating rows and shrink to two lanes' width — "0.35"/"0.25" used to
  overprint. Hatch density: label moved BELOW its square (was inside, over the
  hatch and the border). Three new Tests options — *Line weight sweep (thick)*,
  *Line spacing (thick)*, *Hatch density (thick)* — same tests with series for
  2 mm+ nibs (gaps 8/6/4.5/3.5/2.5/2, hatch 8/5/3.5/2.5, pass offset 0.8 mm);
  cell titles shrink to the cell width. Default Tests list unchanged; the two
  fixed tests change geometry for saved patches (calibration sheet, accepted).
  Era: tools/era/patch-testcard-thick.mjs (node + docs + version, one
  all-or-nothing patch). New tools/validate-testcard.mjs (label clusters =
  label count, labels never overlap test lines, lanes hold, thick series
  exact, thick ≠ fine, Pen pin only on Pen) — mutation-tested against the
  pre-patch node (cluster and lane checks fail there).

- **2.102** Test Card (thick) variants: 4 mm numerals (cap 2.2 → 4, shrinking
  with the cell), weight-sweep pass labels centred on their row, line-spacing
  lines shortened for two 4 mm label rows, hatch label band grows with the
  label, cell title up to 4.5 mm — still capped by the cell width, so the
  long "(THICK)" titles only grow with Cell size. Fine tests byte-identical
  (regression-checked in validate-testcard.mjs, now 103 checks incl. thick
  numeral height ≥ 1.7× fine). Era: tools/era/patch-testcard-thick-labels.mjs.

- **2.103** Test Card: *Label size mm* (1.5–12, def 2.2 = the old fixed size,
  showIf labels). Numerals are labelSize tall (thick keeps 4 mm at the
  default), other labels scale by labelSize/2.2; big Line-spacing labels sit
  right-aligned in their own lane on 2–3 rows; the header band grows with it
  (6 + 2.6·(size−2.2)) and, once taller than the default, width-shrunk titles
  wrap onto two lines at the word split giving the narrowest line. Line
  spacing picks 2 or 3 label rows as the numerals need and shortens its lines;
  weight sweep shortens lines so the pass label fits; hatch and palette label
  bands grow. Motivation: a Textmark 500 plot showed the nib is ~2.3 mm on
  paper, so 4 mm numerals are blobs — legible needs ~10 mm. Default output
  byte-identical to 2.102 (fine tests; regression-checked). Era:
  tools/era/patch-testcard-labelsize.mjs; validate-testcard.mjs (182 checks) now covers
  labelSize liveness and 8/10 mm thick layouts for overlap.

- **2.104** New node **Card Sheet** (`cardsheet`, duo): two-sided imposition
  for postcards and folded cards. Grid of cards on the sheet, compositions
  scaled into faces (Zine's Fit/Fill/Stretch/Rotate 90 placement), dynamic pins
  by *Fold* (None → Front/Back; Vertical → Cover/Back cover/Inside L/R;
  Horizontal → …/Inside top/bottom, cover on top turned 180 as the paper
  works). Back layout derived: back view = front mirrored in x (page turn),
  tumble = that rotated 180 = mirror y; faces paired (Cover ↔ Inside L/top,
  Back cover ↔ Inside R/bottom). Shared `_layout` method for compute + overlay.
  Registration: symmetric reg marks, *Back offset X/Y* (content only), *Trim
  frame* (trim-first), *Pin holes* (two 6 mm centres on the flip axis, replace
  the two reg targets on that axis). *Mode* Duplex test: vernier scales at four
  points, 1.00 mm front / 1.10 mm back on opposite sides of the baseline,
  coincident pair k → offset 0.1·k mm. Default 140×200 card, margin 5, gap 6:
  A3 portrait takes 2×2, A4 landscape 2×1. Validator
  tools/validate-cardsheet.mjs (123 checks): partner-face oracle on panel
  rects, orientation flags, tumble-back == rot180(page-back) path-for-path,
  mark symmetry, back-offset isolation, vernier pitch + arithmetic, overlay
  tiling drift — mutation-tested against 12 deliberate breakages. Docs era:
  tools/era/patch-docs-cardsheet.mjs.

- **2.105** Import SVG fix: every SVG load failed with `Error: M_ID is not
  defined`. The C0 split moved `parseSVG` into src/defs/helpers.js but left
  its module-private helpers (`M_ID, mMul, mApply, parseTransform,
  flattenCubic, flattenQuad, flattenArc, parsePathD`) behind in App.jsx, where
  nothing referenced them any more; the ReferenceError only fires at file-load
  time, so build and every validator stayed green. The block now lives in
  helpers.js directly above `parseSVG` (verbatim, still module-private — the
  helper API is unchanged). New tools/validate-svgimport.mjs exercises the REAL
  `parseSVG` + baked node in Node (jsdom/linkedom if installed, else a
  built-in minimal XML DOM) and accepts an optional SVG path to smoke-test a
  user file. Era: tools/era/patch-svgimport-deps.mjs.

- **2.106** Eight new nodes (302 nodes, 187 generators, 76 modifiers).
  **Scaffolding** (`scaffolding`, structural): tube-and-coupler scaffold as a
  3-D wireframe with Full / Ragged / Stairs / Pyramid skylines, braces, decks,
  guardrails, couplers, Line / Double tubes, camera yaw / pitch / perspective.
  **Fruits** (`fruits`, nature): Root Vegetables' companion, 9 kinds whole or
  halved, outline + peel Fill (Hatch / Contours / Stipple clipped to the peel
  band and around the sticker) + kind Details, produce Sticker with
  stroke-font label, Catmull-Rom `spline()` profile helper. **Cage Dipoles**
  (`cagedipole`, structural): UTR-2 fat dipoles, wires as single 4-point
  polylines alternating direction, rows / fields on poles, true camera with
  Eye height. **Duga Array** (`duga`, structural): Chernobyl-2 receiver in
  metres — two curtains of square lattice masts, cage dipoles on stand-offs,
  ladder feeds, reflector screen; View Camera / Front elevation (orthographic
  2-D). **Stripe Discs** (`stripediscs`, deform): Riley-style rotated-disc
  lens on the built-in stripes or any wired Field; analytic circle clipping,
  Grid / Random layout, six rotation modulations, `_discs()` shared by compute
  + overlay. **Ribbon Type** (`ribbontype`, textimg): monoline skeleton
  alphabet a–z swept as offset curves — mitre / bevel joins, curvature
  collapse to a pinhole, Facets 1–8, Stretch X/Y + Slant on the skeleton only,
  Asymmetry per stroke (chained strokes scale about their join, `["@",x,y]`
  pins an anchor). **Reeds in Snow** (`reedsnow`, nature): charcoal reeds —
  multi-pass weight at 0.18 mm pitch with taper, broken / fallen stalks, wind
  marks / tangles / wisps on a light pen. **Data Chart** (`datachart`,
  scientific): first data-import node — CSV / TSV / semicolon-CSV (decimal
  comma) / JSON via onFile → node.data.svg, or pasted Data; 8 chart types,
  nice 1-2-5 axes, stroke-font labels shifted (never clipped) into the margin,
  hatch fills. Validators tools/validate-<key>.mjs (88 / 118 / 54 / 77 / 74 /
  90 / 60 / 134 checks). Lessons: two params defaulting to the same pen make
  layer-based oracles ambiguous — set distinct pens in the test base; rotated
  text and marker radii must be reserved in the layout, not clipped
  afterwards; a generator whose specimen may not fit must check the body-only
  bbox before building details (Fruits went from 2.7 s to 0 ms on skipped
  sizes). Docs era: tools/era/patch-docs-eight-nodes.mjs.

- **2.107** New node **Hair Web** (`hairweb`, organic; 303 nodes, 188
  generators): thousands of hairline cubic-Bezier arcs between anchors (Grid /
  Random / Ring with weights), Bulge ± variation, S-curves, petal Loops back
  into the same anchor, Locality (distance falloff on neighbour spacing, 1 =
  neighbours only), Hubs (weight = rng^(3·hubs)), Light share on a second pen,
  strands redrawn with a smaller bow instead of clipped at the margin,
  alternating direction for pen travel. `_anchors()` shared by compute +
  overlay (points). Validator tools/validate-hairweb.mjs (59 checks):
  endpoints on anchors, loop share, straight-chord / bow oracles, locality-1
  neighbour test (either end may be the origin since strands alternate
  direction), hub unevenness, light-share fraction. Docs era:
  tools/era/patch-docs-hairweb.mjs.

- **2.108** Machine profiles phase 1 — explicit export workflow
  (docs/MUUSIA-MACHINE-PROFILES-CLAUDE-HANDOFF.md). New module
  `src/machine.js` (pure, no React): DEFAULT_MACHINE / DEFAULT_MACHINE_B moved
  here as the single source; DEFAULT_SVG_MACHINE (own small template: no
  Klipper commands, no Moonraker URL, work area unset = 0, never a 330×240
  default); `workflow: "gcode" | "svg-external"` (missing = legacy gcode);
  normalizeMachine / normalizeMachines (patch lists: valid entries kept,
  invalid skipped with per-entry messages, all-invalid → caller keeps its
  list, machineFormat > 2 rejected), readMachineFile (v1 / bare → legacy, v2,
  unsupported version rejected), writeMachineFile (v2, minApp on svg-external,
  session id stripped), assignIds / nextId (running machine-N), clampIdx,
  convertWorkflow, machineCtx, gcodeRefusal. App.jsx: every G-code route
  (normal export, Mega preview + zip, animation frames, Stack, laser jig ×4)
  goes through toGcodeGated / jigGcodeGated and returns the ;-comment refusal
  for svg-external; buttons disabled with a reason; Stack hides its G-code zip
  via new gcodeEnabled prop; DRO gets no URL; profile switch or workflow
  change clears the generated preview; patches carry machineFormat: 2; MACHINE
  SETUP has a Workflow select and an svg-external branch (manufacturer, model,
  work area with "not set", source URL, verified-on, external-program
  instructions, min app version) with all G-code sections hidden. Validator
  tools/validate-machine.mjs (62 checks: legacy identity round trip, field
  whitelist, rejects, ids, clamping, patch lists, file versions, conversion,
  ctx). Era: tools/era/patch-machine-workflow.mjs (22 anchored edits, JSX
  parse-checked). **Learn coordination (AGENTS §3/§5):** this changes
  src/App.jsx and src/stack-view.jsx, both pinned by the Learn export
  provenance — the physical-plot and svg-workflow exports and the Machine
  Setup screenshots must be recaptured against this build before the commit is
  pushed; geometry is unchanged, only provenance and the Machine Setup
  pictures move. Phase 2 (Inkscape-layer SVG per pen) is separate work.
- **2.109** Gentle profile + first-lift dwell (hardware incident 2026-10-04:
  a 0.35 mm technical-pen tip broke at job start — MECH-HANDOFF §9.3).
  Exporter: a `penDelayUp` settle dwell now follows the very first pen-up,
  before the first travel; previously `SET_SERVO` and `G0 ... F9000` were
  adjacent lines and the gantry accelerated while the servo was still lifting
  the spring-loaded pen. New template **C — Gentle (technical pen)** in
  src/machine.js: Draw F1200 / Travel F3000 / Z F300, settle 300 / 350 ms,
  startG `GENTLE_ON` + `PLOT_GO`, endG `GENTLE_OFF`. Klipper side shipped
  as the Viivain commit before this one (tools/era/patch-plot-go.mjs):
  `PLOT_GO` leaves the fixed Z block pen-up with dwell, Z to block top + 6 mm,
  10 mm/s to an apron at work (10, 0), then PLOT_HEIGHT — it REPLACES a bare
  PLOT_HEIGHT in every profile startG and is the RESUME hook;
  `GENTLE_ON/OFF` set and restore SET_VELOCITY_LIMIT (OFF also via
  `user_cancel_macro`); `block_h` 8.0 → 8.5 (tape under the block). Saved
  profiles live in patch files, so existing Viivain profiles swap PLOT_HEIGHT →
  PLOT_GO by hand. Rule: nothing lowers Z and nothing travels fast while over
  the block. Era: tools/era/patch-gentle-profile.mjs.

- **L** 2026-10-04 Learn: owner-authorized repair of export provenance after
  v2.108–2.109. Replace the whole-App checksum with explicit export-source
  scopes and the machine module; unrelated App edits and plain version bumps
  must not require recapturing an unchanged SVG. Keep artifact, patch and
  geometry checks. Actual changes to a tracked export or machine scope still
  require a fresh UI export and provenance review. Local proof remains
  `npm run check:learn` after the shared catalog/build gate (AGENTS §1).
  Announced shared-file addition: list the existing `rolldown` 1.1.4 parser
  explicitly in devDependencies for AST selectors; package scripts and the
  deployment workflow stay unchanged. Focused selector regression tests run
  through the existing `check:learn` command.
  This supersedes the legacy `reviewedChange` advice in Build / release
  routine: schema 2 requires actual recapture after a tracked export change,
  and does not accept a whole-App checksum or Help-copy exception.
  SVG recapture and machine-workflow screenshot status are recorded in
  `learn/README.md`; do not infer fresh screenshots from a passing source check.
  Both reference SVG artifacts were freshly downloaded through the v2.109
  Chrome UI at `4f39746` and are byte-for-byte unchanged. All PNGs and the
  dated G-code software check remain v2.106 evidence; current machine-workflow
  screenshots are still pending. Lesson 07 now selects the workflow explicitly
  and labels those historical images. No hardware was run.

- **W** 2026-10-04 Shared workflow: Daniel authorizes Astra node work alongside
  Learn. Replace identity-based ownership with per-task file scopes in
  `MUUSIA-WORKSTATE.json`, one writer per checkout and one release integrator.
  Both authors use the same node/visual/validation recipe and catalog → build →
  Learn gate. Claude web work starts from a manifest-backed project snapshot and
  delivers its base commit; stale copies never overwrite newer engine work.
  `tools/project-files.sh [directory]` now prepares all current app modules,
  bundled nodes, shared docs, Learn checks and existing hardware references with
  exact source paths/checksums in MUUSIA-SOURCE-SNAPSHOT.json. It does not upload.
  Proof: export to a temporary directory, verify every manifest hash and rerun
  the exporter while preserving an unrelated file. Catalog validation, build
  and Learn (18,073 checks) pass; the release gate remains unchanged. No app
  version bump or node implementation in this workflow change.

- **W / local node pilot** 2026-10-04 Astra: **Iris** (`iris`, gen/nature) on
  `codex/iris-node`, based on `3fb34aa`. Not merged to main or published; app
  version remains 2.109 until a release integrator chooses the next version.
  Seeded radial fibres, Human / Cat / Goat / Gecko-inspired pupils, Open or
  Hatched pupil, Centre rays, 1–3 actual pen layers, physical diameter and
  fit/exact sizing. A3 fits a 277 mm iris with 10 mm margins; 420 mm needs a
  larger sheet. No engine/helper/exporter changes. 302 node files / 304 total,
  189 generators including hidden ones. Node imported with Node ⇣ in the real
  app, then baked, lab source removed and fresh-load built-in checked.
  `tools/validate-iris.mjs`: 181 checks with real helpers, including determinism,
  numerical wire extremes, shape/bounds/budget invariants, pupil clearance,
  Style behavior and colour changes preserving geometry. Default A3:
  1,389 paths / 80,637 points, about 98 m of drawing, ~9 ms compute locally.
  Help has Iris · A3 study and Iris · 420 mm examples. Catalog, source bundle,
  tags and node reference updated. `tools/render-iris.mjs [directory]` creates
  six reproducible SVG/patch studies and a local review gallery; these generated
  SVGs are artwork, not browser-export provenance. Animal forms are stylised;
  the Gecko slit is continuous, unlike fully constricted separate apertures.
  Actual browser SVG output: Cat, A3, 2,533 paths, separate pens 0/4/6.
  G-code software check on A4 in default 330 × 240 mm profile: finite output,
  pen-change pauses for 4/6, no bounds warning. A3 correctly warns against that
  smaller profile. No physical plot or device connection. Local QA artifacts:
  `/tmp/muusia-iris-qa/verification.json`; gallery and real UI capture:
  `/tmp/muusia-iris-pilot/`. Catalog → build → Learn gate passes (18,073 Learn
  checks); all 12 Help examples pass structural validation. Existing Learn
  content and reference exports unchanged. Next: Daniel's visual review, then
  release integration/version bump and a dedicated Iris Learn lesson/captures.

- **W / local node pilot** 2026-10-04 Iris colour extension, on Daniel's request:
  add Four pens, Five pens and Six pens to Colour mode. Independently selectable
  Midtone, Outer and Highlight pens interleave through the existing fibres.
  All six modes preserve geometry; the three original modes were compared with
  the `96eeeac` source across all four species (12 byte-identical outputs).
  New Help example Iris · Six colours and a seventh gallery study use pens
  0/4/1/6/5/10 (black/orange/blue/teal/purple/ochre). Node reference, search
  catalog and generated source bundle updated. No engine or exporter changes.
  `validate-iris`: 244 checks, including six-pen species/centre rays, individual
  pen choices, shared inks, missing new parameters and extreme budgets.
  All 13 Help examples pass. Catalog → build → Learn passes (18,073 checks).
  Fresh browser A3 SVG: 3,037 paths, six separate pen groups; A4 G-code in the
  default 330 × 240 mm profile: five pen-change pauses, finite coordinates,
  no bounds warning. Actual export text and UI capture retained locally in
  `/tmp/muusia-iris-six-qa/`. This continues the unpublished `codex/iris-node`
  pilot at app version 2.109; no hardware was run.

- **2.110** 2026-10-04 Astra release integration, authorized by Daniel: promote
  the Iris pilot (`96eeeac`, `17cec53`) to the built-in main release. This
  supersedes the local-only status of the two pilot entries above. Iris supports
  one to six independently selected pens, Human / Cat / Goat / Gecko-inspired
  pupils, open or hatched pupils, centre rays, seeded fibres and physical-size
  controls. Help includes Iris · Six colours, Iris · A3 study and Iris · 420 mm.
  302 node files / 304 total built-ins. APP_VERSION 2.109 → 2.110 is the only
  additional engine-file change; machine profiles and export behavior stay as
  previously verified. Regenerated the source bundle, catalog and Learn outputs;
  the study gallery now links to public Muusia and requires v2.110 or later.
  Release checks: 244 Iris checks, all 13 Help examples, catalog validation,
  production build and 18,073 Learn checks pass. The existing reference SVGs
  pass scoped provenance without recapture. Real six-pen browser exports were
  checked in the pilot as documented above; no hardware was run. Next: a dedicated
  Iris Learn lesson and real screenshots. Refresh Claude's project snapshot from
  the final main commit, then verify its manifest; Pages publication is verified
  against that exact pushed commit by the integrating session.

- **W / local node batch** 2026-10-04 Astra: **Coral** (`coral`, gen/nature)
  is ready for Daniel's visual review on `codex/coral-node-batch`, based on
  `e81eff14f8c1b3d718737b741367b827bcba80b5`. Daniel requested several nodes
  before the next commit/push: this is the first, still uncommitted and unpublished.
  APP_VERSION remains 2.110; bump once when the complete batch is integrated.
  Brain coral and Cells use a seeded Gray–Scott field; Radial coral uses warped
  radial waves with a textured centre. Closed marching-squares contours have
  exact edge stitching, a saddle decider and smoothed corners. Controls cover
  density, growth, ridge width, edge texture, 1–4 actual contour bands, 1–6 pens
  by whole contour or average radius, mm diameter, fit/exact sizing and placement.
  A3 with 10 mm margins fits a 277 mm bounding circle. A one-entry field cache
  avoids resimulation for pen/size/width/band changes; new fields can take a few
  seconds, particularly at high Density/Growth. 112,000-point pre-Style budget.
  Prototype imported through Node ⇣, baked with bake.mjs, matched to the source,
  and lab copy removed; fresh built-in Help examples and actual Focus preview
  checked. No engine/helper/exporter changes. Help includes Coral · Brain study
  and Coral · Radial colours. Catalog/tags/node reference/source bundle updated;
  303 node files / 305 total built-ins. `tools/render-coral.mjs` generates six
  reproducible A3 studies and editable patches; local gallery at port 5188.
  Validation: 178 Coral checks with real helpers; all 15 Help examples; catalog,
  production build and all 18,073 Learn checks pass. Existing Learn reference
  SVGs retain their valid scoped provenance. Actual final six-pen browser SVG:
  A3 420 × 297 mm, 167 closed paths / 29,720 points in six pen groups, all
  coordinates match node output within SVG's 0.005 mm rounding. SHA-256
  `6df9cd990826851233c5ba3b33ee29d00a51b583f1133caba430cb070d4ffa04`.
  Actual A4 297 × 210 mm G-code in the 330 × 240 mm Servo Z profile, route
  optimization off: 30,586 lines, 167 pen-downs, five pen-change pauses, finite
  in-bounds motion, all XY travels with the pen up, no bounds warning. SHA-256
  `eeb5eb28035c7eb510fba655202426b8595890b9d0e22a80c5fbc5610a5770c3`.
  Local export files, source-hash manifest and UI capture are in
  `/tmp/muusia-coral-qa/`; review drawings in `/tmp/muusia-coral-pilot/`.
  No hardware was run. Next: Daniel's next node in this batch, then a single
  release integration, shared gate, commit/push and Claude project refresh.
  Keep the work-state claim until batch integration; Claude's uploaded snapshot
  still describes the released e81eff1 state, not this local work.

- **W / local node batch** 2026-10-04 Astra: extend the existing **Image** node
  (`image`), as Daniel requested, rather than adding another image-import node.
  Same uncommitted `codex/coral-node-batch` based on e81eff1; Coral is retained,
  APP_VERSION stays 2.110, total remains 305. New Render choices: Organic dots,
  Short strokes and Cross stitches. Organic dots offers Outline / Spiral fill /
  Concentric rings, seeded jitter and neighbour-aware circle spacing. Strokes
  follow a local image structure tensor, seeded flow or a fixed angle; shadow
  passes add parallel strokes, and cross stitches add the perpendicular family.
  New modes select 1–6 pens using nearest actual Pens colours or light-to-dark
  tone bands; grayscale-only old image data falls back to tone bands. Colour
  changes preserve geometry. Work/point limits distribute reduced detail across
  the whole fitted image, never truncate at one row. Dense filled work can thin
  noticeably; increase spacing, or start with the A4 Help presets.
  `imageMax: 640` uses the existing RGB intake seam; no engine/helper/exporter
  changes. Confirmed a real Choose image import, Save and reload: 640 × 640
  pixels, 409,600 grayscale values and 1,228,800 RGB values from the repository's
  existing portrait fixture. Earlier saved images keep their stored resolution
  until reloaded. The five earlier modes are byte-identical on a frozen baseline
  fixture; the original Trace Image alias sweep still passes. Mode-specific
  controls hide irrelevant fields. Baked the existing key through the lab/HMR
  route and deleted the verified lab copy; did not import a duplicate built-in.
  Added two Help templates (choose your own photo) and `tools/render-image-art.mjs`
  for six reproducible studies/patches from decoded image data. Local review is
  at port 5189; studies use the real browser-decoded photo, A4, 12 mm margins.
  Checked actual Focus views for dots, short strokes and colours. Node docs,
  search catalog and source bundle updated. Learn's first build correctly stopped
  at `image.levels: conditional field needs an explicit explanation`; added
  node-scoped visibility notes and updated the existing Image guide. Refreshed
  its real Scanline wave screenshot at default 1280 × 720, with per-capture
  v2.110/date/working-tree hash metadata. Existing Learn geometry is unchanged.
  Validation: 1,516 new Image assertions, original Image/Trace oracles, all 17
  Help templates, catalog and application build pass. Rebuilt Learn after its
  content/capture updates: all 18,105 checks pass, including both unchanged
  reference-export provenances. Browser six-ink dot SVG: A4 portrait, 4,870 paths,
  86,580 points, six pen groups; every point matches node output within 0.005 mm.
  SHA-256 `cd71c46eeb11ee75200338d0db8c58045714836618beede490310a02bc4d3190`.
  Browser G-code: A4 landscape within the 330 × 240 mm Servo Z profile, route
  optimization off, 106,091 lines, 4,870 drawing paths and five pen-change pauses;
  every point matches the wide-canvas node output within 0.005 mm, finite motion,
  all rapid XY moves pen-up, finishes pen-up, no bounds warning. SHA-256
  `2e9df76fbfc5d1e9efc9ce06bd77bbf3cde2fecb54d363472abc5349958220fa`.
  Evidence/manifest in `/tmp/muusia-image-qa/`, gallery `/tmp/muusia-image-art/`.
  No hardware run. No commit, push, publication or Claude upload in this turn.
  Next: Daniel reviews this second batch item or supplies the next one; integrate
  the final batch once, rerun the shared release gate, then refresh Claude.

- **W / local Image square extension** 2026-10-04 Astra: Daniel's staggered-square
  reference adds **Square weave** to the existing Image Render menu. Darkness
  controls square area; Square layout selects Staggered or aligned Grid. Jitter
  0 gives regular rows. Square fill offers Outline, a continuous serpentine Hatch
  fill, or Woven fill alternating horizontal/vertical hatches. Centreline bounds
  stay separate even at maximum jitter; physical ink coverage depends on pen
  width. The existing 1–6 pens, Source colours / Tone bands and point budget apply.
  No new node, engine or export contract. Lab/bake verified and lab copy removed.
  Added Image · Square weave in Help, English node/Learn controls and two review
  studies at `http://127.0.0.1:5189/#squares` (eight studies total). Existing Image
  Scanline wave capture still records its actual earlier source hash; it was not
  relabelled as a new screenshot, and its shown control layout is unchanged.
  Validation: 2,338 Image assertions including square area, staggering, bounds,
  hatch pitch, non-overlap, colour geometry and the byte-identical previous eight
  render modes; Image/Trace legacy oracles, all 18 Help examples, catalog, build
  and all 18,109 Learn checks pass. Real browser fresh load, Outline/Grid change
  and six-colour Woven fill checked. Browser SVG: 210 × 297 mm, 2,005 paths,
  41,053 points, six ink groups, every point within 0.005 mm of node output;
  SHA-256 `31da66c57f99414c11fce22e9c7f23d323dfdde36606f99c2f45ca36d2a638c2`.
  Browser G-code: A4 wide, 49,104 lines, 2,005 drawing paths, five pen changes,
  all XY rapids pen-up, ends pen-up, no bounds warning, point match within
  0.005 mm; SHA-256
  `af30f7232ba1691a27d6e646cfc394417b41e16a57783d5f5bbde4bfe03d5471`.
  Evidence: `/tmp/muusia-image-square-qa/verification.json`, both browser exports
  and actual UI capture. No hardware run. Same local `codex/coral-node-batch`,
  base e81eff1 and APP_VERSION 2.110; no commit/push/publication/Claude upload.
  Next: finish Daniel's node batch, integrate/version once, run the release gate
  and refresh Claude's project after the resulting commit.

- **W / local Image Drawing input** 2026-10-05 Astra: appended a blue **Drawing**
  Paths input to Image (port 1); Style stays at port 0, preserving old patch wires.
  Source Auto uses a connected drawing, otherwise the stored image; Image (file)
  and Drawing (wired) explicitly select either source. Empty connected drawings
  never fall back to stale photos. All nine render modes use this source seam.
  Pure node-local rasterisation, no DOM or engine/export changes: clipped round
  strokes with adjustable Drawing stroke mm, optional even-odd closed fills per
  source pen (including nested holes), source RGB from actual Pens, no pen-up
  connectors, original canvas placement inside the margin. Output Style remains
  separate. Dense drawings reduce the full raster from 640 toward 96 px rather
  than truncating source paths; the overlay uses the same adaptive fit. Very fine
  drawing details can disappear: increase Drawing stroke mm or reduce mark spacing.
  Added Image · Drawing to blocks Help example and two wired studies to the existing
  gallery (`http://127.0.0.1:5189/#drawing-blocks`, ten studies total). Verified the
  actual blue-wire drag from Lissajous into Drawing; output changed from 0 to 2,063
  paths, and changing source Freq X 3 → 5 changed it to 2,802, then restored it.
  Verified explicit Image (file) with no photo gives 0 and Auto restores the wire.
  Source-free old photo modes are byte-identical, including the prior Square weave.
  Validation: 93 Drawing-input assertions, 2,339 art/legacy assertions, Image/Trace
  oracles and all 19 Help examples. Catalog, app build and all 18,114 Learn checks
  pass. Image guide/conditional controls and actual 844 × 818 Focus PNG refreshed
  on 2026-10-05, recorded local source hash, unchanged Scanline wave geometry.
  Browser wired SVG: A4 wide, 2,063 paths / 31,669 points on Pen 0, all coordinates
  match the real graph within 0.005 mm; SHA-256
  `96386f84cc0cb7a724873dc848a4f410b3f135a72316824443ed1eb084929a5e`.
  Browser G-code: 39,937 lines, 2,063 drawing paths, 2,064 pen-up XY travels,
  ends pen-up, no bounds warnings, point match within 0.005 mm; SHA-256
  `d1a4b7c422b0f0f77233275ea24e3aa1bdf5640b094acf4c7e857751032ba7bd`.
  Evidence and current source hashes in `/tmp/muusia-image-input-qa/verification.json`.
  No hardware run. Same uncommitted `codex/coral-node-batch`, base e81eff1,
  APP_VERSION 2.110. No push/publication/Claude upload; finish Daniel's batch,
  integrate/version once, rerun release gate and refresh Claude after commit.

- **W / local Concrete Poetry motion** 2026-10-05 Astra: extended the existing
  `concrete` node, retaining its key, Region/Style ports and all four legacy
  layouts with byte-identical Motion Off output. Added Columns (1–4 columns,
  alternating outer anchors, left/centre alignment, `|` row phrases) and twelve
  real-geometry motions: Row squeeze, Word collapse, Wave, Breathing, Accordion,
  Row slide, Ripple, Orbit, Vortex, Swarm, Letter flip and Typewriter. Word collapse
  reflows an ordered subsequence such as THURSDAY 1 OCTOBER 2026 → THU 1 OCT 26;
  removed letters shrink away. Non-subsequence targets use whole-row compression.
  Timeline reads ctx.frameIdx / ctx.frameCount directly, Phase input is manual or
  wired, integer Cycles loops without a seam, lags distribute the movement, and
  Swarm is seeded. Margin clipping splits strokes without drawing connectors.
  Point budget is 112,000 before Style; dense/long compositions adapt size and
  retain a fixed glyph subset across frames. Region sets initial placement;
  moving letters may leave its outline. Single-stroke uppercase font retained.
  Added Poetry · Living columns / Living waves Help examples, animation/text tags,
  full node docs, catalog/source regeneration, and two copy-only corrections in
  App.jsx explaining built-in Timeline motion (no engine/export logic changed).
  Local review gallery: `http://127.0.0.1:5190/`, generated by
  `tools/render-concrete-motion.mjs`: 12 modes × 32 genuine computed SVG frames,
  play/pause/scrub and editable patches. Not fabricated screenshots or export proof.
  Validation: 831 focused assertions using actual helpers, all 5 layouts × 12
  modes, frozen legacy hashes, deterministic seeds, period/Phase equivalence,
  clipping, subsequence reflow, dense/long text limits and real Style input;
  21 Help examples; catalog, app build and 18,114 Learn checks pass. Lab source
  baked, body equality verified, graduated copy removed. Real browser fresh Help
  load, Play advancing at 36 frames, Focus and Phase 0.25 checked. Browser SVGs
  at frame indices 0 / 9: A4 portrait, 3,360 / 3,400 paths and 15,704 / 15,900
  points; every coordinate matches the node within 0.005 mm. Phase 0.25 SVG is
  byte-identical to Timeline frame 9/36. Capture SHA-256s:
  `0370400aeaa521f38f2167650838f108c1ab4e0eebf46d65f182277371f6df18`
  and `fe9c8a261c826cfcc43009beb7c13ea8abb14e07893706f2a47615365a4f65e1`.
  Evidence: `/tmp/muusia-poetry-qa/` exports, verification and actual UI JPEG.
  Multi-file download and hardware plotting were not exercised in this task.
  Still local `codex/coral-node-batch`, base e81eff1, APP_VERSION 2.110; no
  commit/push/publication/Claude upload. Finish Daniel's node batch, integrate
  and version once, rerun the release gate and refresh Claude after commit.

- **W / local Concrete Poetry Shift** 2026-10-05 Astra: on Daniel's follow-up,
  added **Shift** as the thirteenth motion in the existing `concrete` node.
  It permutes letters between fixed, uniformly spaced cells: **Rows**, **Columns**
  or seeded **Shuffle**. Every destination gets one letter; order changes in whole
  letter steps, with no disappearing-letter transition. Use Fill region for a
  full text field. Spaces, `|` and unsupported glyphs are omitted in Shift only;
  narrow letters are centred in their cells. Row lag applies to Rows, Amount is
  hidden for Shift. The stable glyph budget reserves the largest glyph cost per
  cell so changing letters cannot change the selected cells. Very dense text
  still follows the documented adaptive-size / fixed-subset limit.
  Added **Poetry · Shift field** to Help (22 examples total), expanded the local
  motion gallery to 13 × 32 computed frames, updated node docs and regenerated
  catalog/source bundle. Baked body equality checked, graduated lab removed.
  Validation: 1,139 focused assertions, including analytic row/column order,
  per-frame occupancy and letter-inventory conservation, seeded shuffle,
  periodicity, whitespace handling, A3 budget, all 5 layouts × 13 motions and
  frozen legacy output. Catalog, build and 18,114 Learn checks pass.
  Actual browser: fresh Help load, Play advancing at 36 frames, all three Shift
  patterns and Focus checked. Actual SVG exports at frame indices 0 / 9 are A4
  portrait, 2,289 / 2,276 paths, 10,028 / 10,024 points; all coordinates match the
  baked node within export rounding (0.005 mm). SHA-256s:
  `7e3feed95e3f2a2e689371e23c0c5c4208e378d910e54cbda2f8ce25fb7f1f94`
  and `fff305927133317e1b52e27651bd65633dc03b1d4dfe4aaa3a4981c405c1836d`.
  Evidence and source hashes: `/tmp/muusia-poetry-shift-qa/verification.json`;
  captures and actual Focus JPEG in the same directory. Gallery remains
  `http://127.0.0.1:5190/`, app `http://127.0.0.1:5186/`.
  Same uncommitted node batch, base e81eff1, APP_VERSION 2.110. No release or
  Claude upload yet; integrate/version and refresh Claude after the batch commit.

- **W / local Concrete Poetry Zoom** 2026-10-05 Astra: added **Zoom** as the
  fourteenth motion on Daniel's request: one N grows into a large N built from
  additional small Ns, keeping each small letter's physical size unchanged.
  Every character in a phrase uses copies of itself. Zoom uses a centred text
  block, spaces separate words, `|` starts a line; the existing Layout controls
  are hidden for this motion. **Max rows**, **Cell spacing ×**, and **Zoom cycle**
  control the cell grid and direction. **In & out** returns to one letter;
  **Zoom in/out** restart at their cycle boundary. Growth is in whole-cell steps.
  Timeline / Phase / Cycles work with the existing animation engine. Region
  centres the block and admits stamp centres inside it; page clipping remains
  optional. No glyph scaling, DOM, raster source or engine changes. Stroke-grid
  cells are deduplicated at joints; a 112,000-point reserve and bounded sampling
  stop extreme jobs without enlarging their small letters.
  Added **Poetry · Zoom letter / Zoom word** Help examples (24 total), updated
  docs/catalog/source bundle and the local gallery (14 motions × 32 frames).
  Validation: 1,581 focused assertions include fixed-size emitted N geometry,
  count growth, complete large-N rails/diagonal, O counter, no duplicate cells,
  words/lines, cycle directions, Region/Style, budget, input purity, all earlier
  motions and legacy hashes. Fresh browser Help load, 48-frame Play, both examples,
  all cycle controls and manual Phase checked. Actual SVG frame 0 / 24 captures:
  A4 portrait, 1 / 105 paths, 4 / 420 points; all coordinates match the built-in
  node within 0.005 mm. SHA-256s:
  `335c8d76e69b59d4767a120a3b15a539003245c8b09a2ab6928ef2ac310f151a`
  and `471c8348964cdeaaa75798df7765bd71d0b75e5bdbc58e4126ba89fafed1f53b`.
  Evidence, current source hashes and actual UI captures are in
  `/tmp/muusia-poetry-zoom-qa/`. Catalog, build and 18,114 Learn checks pass.
  Lab/built-in equality verified and graduated lab removed. Same local batch,
  base e81eff1, APP_VERSION 2.110; no commit/push/publication/Claude upload yet.
  Integrate/version once at the end of Daniel's batch and refresh Claude then.

- **W / local Ribbon Angular** 2026-10-05 Astra: extended the existing `ribbon`
  node on Daniel's sharp, multicolour ribbon reference. Kept Woven Ribbon separate:
  its lattice-based over/under gaps are a different tool from Ribbon's overprinted
  parallel bands. No third node or combined mega-node was added. **Shape Angular**
  offers seeded **Free folds**, regular **Zigzag**, and a closed **Star** route;
  straight segments meet at exact offset mitres or **Bevel** corners. **Corner
  limit** bevels excessive mitres, **Turns / Star points / Rotate** shape the
  route. **Angular fill** Lines uses individual filaments; **Stripes** uses real
  parallel strokes at **Pen pitch mm**, with **Stripe gap mm** between colour
  bands. **Colours** selects up to six explicit pens and also colours the existing
  Line/Ring filaments without changing their geometry. Original defaults and
  missing new fields preserve the old one-pen results exactly.
  Angular fits the full outer envelope within Margin, uniformly shrinking only
  if needed; width and pitch shrink together. Dense bands coarsen pitch under
  the point budget. Preview/export colours are opaque; real ink mixing depends
  on the pens/paper. Crossings intentionally keep both strokes, without weave
  occlusion. Existing Style port index 0 and node key retained; no engine edits.
  Added three Help examples: **Ribbon · Sharp stripes / Sharp zigzag / Star loop**
  (27 total examples), docs/tags and generated catalog/source. Six local review
  studies with editable patches: `http://127.0.0.1:5191/`, generated by
  `tools/render-ribbon-angular.mjs`; these are computed review artwork, not export
  evidence. App remains `http://127.0.0.1:5186/`.
  Validation: 352 focused assertions cover analytic offsets/closure, capped
  corners, all layouts/fills/joins and 1–6 pens, seeds, rotation, full envelope
  bounds, extreme budgets, Style and frozen Line/Ring hashes. Existing Ribbon
  validator and all 27 examples pass. Fresh real-app Help load, shape/layout/
  corner/fill controls and Focus checked. Browser SVG: A3 portrait, six matching
  pen groups, 92 paths / 1,288 points; SHA-256
  `1f82257372abd564d6d843d531e2bd8bb14b9570bdbb199c72aa47957d757d66`.
  The current machine profile is 330 × 240 mm: A3 G-code correctly warned of
  out-of-bounds moves. Recaptured the G-code verification at A4 landscape:
  92 paths / 1,012 points, six pens, five pen-change pauses, all travel pen-up,
  ending pen-up, no bounds warnings; SHA-256
  `7e73ebf85fbdb3c2138989e84e5e7a6f6104adc26edb57763e7e1f4afcc1f582`.
  Both verified exports match actual node coordinates within 0.005 mm. No
  hardware run or machine-setting change. Evidence/source hashes and screenshots:
  `/tmp/muusia-ribbon-qa/verification.json`. Catalog, build and 18,114 Learn checks
  pass. Lab body equality checked and graduated copy removed. Same uncommitted
  `codex/coral-node-batch`, base e81eff1, APP_VERSION 2.110. Finish the node batch,
  integrate/version once, then commit/push and refresh Claude under Daniel's scope.

- **W / local Ribbon palette** 2026-10-05 Astra: Daniel requested colours
  distinct from the reference. Ribbon's three Help examples and six local gallery
  studies now use Purple, Magenta, Gray, Teal, Green and Black (five in Star;
  the monochrome study stays Black). New node extra-pen defaults use the same
  colour family; the original one-pen Black default and saved pen choices remain.
  No geometry or global pen palette changes. Rebuilt gallery patches/SVGs and
  source bundle, checked the gallery visually, and passed 352 Ribbon assertions,
  all 27 Help examples, catalog/build and 18,114 Learn checks. The browser export
  hashes in the previous entry describe the earlier palette; no new machine
  export or hardware run was needed for this colour-only update. Still local on
  `codex/coral-node-batch`; include with the pending batch integration.

- **W / local Ribbon No crossings** 2026-10-05 Astra: added Angular layout
  **No crossings**, a deterministic seeded route that rejects collisions of the
  complete padded band, including its corner envelope. **Clearance mm** reserves
  space between non-adjacent spans; **Turns** is a maximum and crowded settings
  can produce a shorter route. Clearance shrinks with the width when page fitting
  is needed. The convex strip test prevents fold-backs; inner corners meet at a
  mitre, while Sharp/Bevel and Corner limit control outside joins in this layout.
  Existing layouts and legacy Line/Ring results are unchanged. Added **Ribbon ·
  No crossings** in Help (28 examples) and as the first local gallery study
  (seven studies). No new node or engine changes. Node source graduated through
  lab/bake and equality checked before deleting the lab copy.
  Validation: 496 assertions including an independent emitted-segment collision
  oracle across seeds/widths/corners, extreme crowded cases, full-band clearance,
  deterministic generation, bounds and legacy hashes; original Ribbon validator,
  all 28 Help examples, catalog/build and 18,114 Learn checks pass. Fresh app load,
  No crossings and Sharp/Bevel controls visually checked. Actual browser exports:
  A3 SVG 92 paths / 1,058 points, six pen groups, SHA-256
  `e2cfbfbffded3f8f55f4fed345f1e14f0c8df9e2dfb36ce7664d21806b276c91`;
  A4 landscape G-code 92 paths / 828 points, five pen-change pauses, all travel
  pen-up, ends pen-up, no bounds warnings, SHA-256
  `8510d5bc4315cc24e50b323ccef6ce50447bc5dfa59f6e57cd68d0b0f54381f2`.
  Both match actual node coordinates within 0.005 mm. Evidence/source hashes and
  app screenshot: `/tmp/muusia-ribbon-no-crossings-qa/`. No hardware run.
  Same local uncommitted batch on `codex/coral-node-batch`, APP_VERSION 2.110.

- **W / local Ribbon open turns** 2026-10-05 Astra: Daniel requested that
  No crossings need not turn inward. The route now starts near an edge, seeks
  open space with shorter spans, mixes left/right bends and limits repeated
  same-side turns and accumulated winding. The A3 example retains nine turns
  in an open meandering composition. Full-band clearance still applies. Added
  absolute corner-tangent reservations: tight opposite turns must leave enough
  span for the outside bevel and the next inside join. No new node/control or
  engine edit. Help/gallery copy and generated source/catalog updated.
  Validation: 760 Ribbon assertions (including mixed turn signs, bounded winding,
  collision/clearance and tight-corner regressions), legacy Ribbon checks, all
  28 examples and catalog/build/Learn pass. Fresh Muusia load and Focus checked.
  New browser SVG A3: 92 paths / 1,012 points, six pens, SHA-256
  `84330e2a2d74c8e601ec7baaf10efcc2ed20da2d6ee922313bb7174a7732c5eb`;
  G-code A4 landscape: 92 paths / 920 points, five pen changes, no bounds warnings,
  travel/ending pen-up, SHA-256
  `567ba119f74a2ef890a5b173c77584db377481533ca78f04c240257a6667610d`.
  Both match current node coordinates within 0.005 mm. Evidence and screenshot:
  `/tmp/muusia-ribbon-open-turns-qa/`. Previous No crossings captures describe the
  superseded inward-prone route. Lab/baked equality verified; lab removed.
  Same local uncommitted batch, no hardware run or publication.

- **W / Arc Mounds and completed node batch** 2026-10-05 Astra: added
  **Arc Mounds** (`arc_mounds`, gen/organic), Daniel's final node in this batch.
  Rounded overlapping bodies contain only curved pen paths, with analytic
  segment/ellipse foreground clipping and no opaque fills. Field and Single,
  physical width, fullness, overlap, seeded variation, arc flow/tilt, pitch,
  optional silhouette and 1–6 whole-body pens. Daniel's follow-up requested
  stronger size modulation and more sensual forms: **Size contrast** now spans
  small and large bodies; **Body curves / Curve scale mm** add soft asymmetry,
  fuller lobes and narrower waists through two boundary-pinned invertible shears.
  The warp preserves depth ordering and page bounds. Dense settings regenerate
  with coarser pitch/sampling for a full-page 110,000-point pre-Style budget.
  Lab/baked equality verified before lab deletion. Three Help examples added
  (31 total); docs/tags/catalog/source updated, 304 node files / 306 built-ins,
  191 generators. Six visual studies/patches: `http://127.0.0.1:5192/` generated
  by `tools/render-arc-mounds.mjs`. Fresh built-in app/Focus checked. Default A3
  drawing: 1,589 paths / 103,259 points; cold computation about 0.2 s locally.
  Validation: 309 Arc Mounds assertions cover analytic occlusion, rotated ellipse
  and page clipping, curve continuity, bounds/budget, no filled payloads, warp
  invertibility, size contrast, pen-independent geometry and actual Style.
  Browser three-ink SVG A3 matches actual geometry within 0.005 mm, SHA-256
  `f59df635666d49b08ec9887618189d44d35d07737babf8eb6171bec8b42c0a66`.
  A4 landscape G-code: 826 paths / 52,302 points including closed returns, three
  pens / two changes, no bounds warnings, travel and ending pen-up; SHA-256
  `ad8ed1fba1cb312e0cb925f89d7613472d38925cd39b6849faf6823cac95c42d`.
  Capture verification/source hashes and screenshot: `/tmp/muusia-arc-mounds-qa/`.
  No hardware run. Final batch regressions: Coral 178, Image art 2,339 + Drawing
  input 93 + original merge/rasterise checks, Concrete Poetry 1,581, Ribbon 760
  + original Ribbon checks, 31 Help examples, catalog/build and Learn.
  Daniel authorized commit/push after the node batch: deliver on
  `codex/coral-node-batch`, based on e81eff1. This feature-branch delivery includes
  Coral, Image art/Drawing input, Concrete Poetry's 14 motions, Ribbon Angular
  with open non-crossing routes, Arc Mounds, and the Image Learn update.
  Main/Pages remain unchanged; APP_VERSION stays 2.110 until final main/release
  integration, where it should be bumped once. Refresh the local Claude snapshot
  after the commit; do not claim a web-project upload. A later integrator should
  fetch current main, recheck the shared gate and refresh/upload Claude's project
  after release. Historical local entries above describe earlier batch stages.

- **W / Arc Mounds — Rolls** 2026-10-05 Astra: Daniel asked to retain the
  existing forms and add a more elongated option. **Form → Rolls** adds long,
  round-ended tubes with transverse ribs to the same node; **Soft bodies** is
  still the default, including patches without the new parameter. Original
  Field/Single hashes are frozen in the validator and unchanged. Rolls projects
  a capped cylinder, clips hidden strokes against exact capsule silhouettes,
  then applies the existing invertible body warp. Field/Single, size contrast,
  fullness, curve controls, 1–6 pens and Style all work in the new form.
  **Arc Mounds · Rolls** is Help example 4 (32 examples total); gallery study 2
  at `http://127.0.0.1:5192/#rolls`. Existing six studies remain unchanged.
  A3 example: 1,263 paths / 72,197 points. Lab/baked equality verified and lab
  removed. 451 Arc Mounds checks, 32 examples, catalog, build and 18,114 Learn
  checks passed. Fresh app: Field, Single and Focus inspected. Actual browser
  SVG A3 and G-code A4 landscape match current node coordinates within 0.005 mm;
  capture evidence/source hashes: `/tmp/muusia-arc-rolls-qa/`. SVG SHA-256:
  `e3ed83d63874789eb51e41ca78ef45957ee6083e4887f229cfe813314dfbdb9e`.
  G-code: 885 paths / 54,943 points including closed returns, no bounds warnings,
  travel/ending pen-up; SHA-256
  `ad3f216c7eea467a67f80b65455e17a9659391c5e29244f1a442b1f9c30e96e5`.
  No hardware run. This is a local follow-up to batch commit `3401f39` on
  `codex/coral-node-batch`; main/Pages and APP_VERSION 2.110 remain unchanged.
  **Delivery blocker:** automatic approval review rejected the earlier GitHub
  push as insufficiently explicit authorization for that repository/payload.
  An explicit permission question is pending; do not retry the push until
  Daniel answers. Refresh the local Claude snapshot after this commit; that
  preparation is not a verified Claude web-project upload.

- **2.111** 2026-10-05 Astra release integration, explicitly authorized by
  Daniel after the final Rolls review: promote `3401f39` and `ab5e48d` from
  `codex/coral-node-batch` to `main` in `Bambi8000/Muusia`, then publish via the
  existing Pages workflow. Remote main was still `e81eff1` when fetched; no
  concurrent changes or merge conflicts. The previous push-approval blocker
  is resolved by Daniel's instruction to commit and publish the full batch.
  Release includes **Coral**, **Arc Mounds** with Soft bodies and Rolls, Image's
  Organic dots / Short strokes / Cross stitches / Square weave and blue Drawing
  input, Concrete Poetry's 14 motions including Shift and recursive glyph Zoom,
  and Ribbon Angular with mixed-turn No crossings routes. Image's Learn guide
  and actual node capture are included; the other Learn lessons are unchanged.
  304 node files / 306 total built-ins / 191 generators / 32 Help examples.
  APP_VERSION 2.110 → 2.111; no export-engine or machine-profile change in this
  integration. Regenerated source/catalog/Learn metadata and updated local
  review galleries to link to public Muusia with a v2.111 requirement.
  Focused release checks: Coral 178, Image art 2,339, Drawing input 93,
  Image merge/rasterise regressions, Concrete Poetry 1,581, Ribbon Angular 760
  plus original Ribbon checks, Arc Mounds 451 and all 32 Help examples.
  Shared catalog/build/Learn gate passed (18,114 Learn checks). Actual browser
  export evidence for this batch is recorded in the preceding entries; the
  version bump does not alter their geometry. No hardware run.
  After push, verify the Pages run for the exact release commit and the public
  v2.111 app/Learn result. Refresh the clean local Claude project snapshot;
  a local snapshot is not a verified upload to Claude's web project.

- **W** 2026-10-05 Astra — **Portrait: continuous Scribble**. Daniel asked
  for looping, one-line photo portraits in the existing Portrait node, using
  his five references as visual direction. Added **Scribble** alongside the
  six existing modes; Tonal remains the default and old compute branches are
  unchanged. New controls: Scribble density, Loop size mm, Wander and Feature
  contrast. Existing image intake, Gamma/cutoff, Detail/Quality, Focus,
  Pen width/Ink strength, Margin, Seed and one Pen apply. No Analyze face or
  new model is needed. Legacy-only controls are hidden in this mode.
  Seeded irregular partial loops follow tonal gradients and spend a residual
  ink field. Cubic connecting strokes count as deposited ink too. Exactly one
  open path for a nonblank image, empty for white/cutoff-only inputs; crossings
  over white gaps are intentional to keep continuity. Bounded search/working
  geometry and whole-route simplification keep plain output <=118k points.
  Wired dashed Style may split the line. No engine/machine/export edits.
  Added the manual/spec extension, searchable catalog paragraph/tags, Help
  **Portrait · Continuous scribble** (33 examples total) and reproducible
  `tools/portrait-scribble-preview.mjs`. Local gallery:
  `http://127.0.0.1:5193/` (Vite dependency `http://127.0.0.1:5186/`), with
  Fine thread / Loose gesture / Ink in the shadows, local photo upload,
  editable patches and computed review SVGs. Existing repository photo
  fixture used for visual QA; no reference screenshot was traced.
  Validation: **209** focused Scribble checks including lab/baked parity,
  **96** legacy Portrait checks, all 33 examples; shared catalog → build →
  **18,114 Learn checks** passed. Graduated lab file removed. Actual fresh-app
  load shows Scribble controls and a single output; imported gallery patch
  matches. Actual browser exports checked point-for-point to <=0.005 mm:
  SVG A3 **1 path / 117,574 points / 88.05 m**; G-code A4 wide **1 path /
  99,579 points**, one pen-down event, zero pen changes, no bounds warnings,
  final pen up. A4 was used for G-code to fit the existing 330 × 240 machine;
  no hardware run. Evidence, full captured files and source hashes:
  `/tmp/muusia-portrait-scribble-qa/verification.json`.
  SVG SHA-256 `eac1d6b326686ec7817948f1e67716742facc8fc13352ba8d4ab2cc913f813e1`;
  G-code `0368f3147e29fb6f330c686121bc0d3bca5707eb21a537067618d152597284c6`.
  **Local, uncommitted review** on `codex/portrait-continuous-scribble`, base
  `34e8fcc7c560cc5e797ab89bfe47b6daae6c39dd`; APP_VERSION/main/Pages stay at
  v2.111. Review likeness with Daniel's own cropped photo next. On authorized
  integration, bump the release once, remove the ready claim, run the gates
  and refresh Claude's project after commit. Claude currently has the clean
  v2.111 snapshot; this uncommitted feature has not been uploaded there.

- **W** 2026-10-05 Astra — **Latest nodes and pen-change homing audit**.
  Added **Latest nodes** to the toolbar and **Shift+N** to the keyboard/Help
  lists. The searchable quick-add list contains all selectable nodes, ordered
  by the latest node-source update; dates include improvements to existing
  nodes. Arrow keys browse, Enter adds, Escape closes. Normal N/category/
  favorites menus keep their previous sorting. Unknown custom-node dates sort
  after recorded built-ins. Hidden/internal node definitions remain hidden.
  `tools/make-node-recency.mjs` records Git history plus local source updates
  in `src/defs/node-recency-data.js`; unchanged source hashes preserve their dates.
  Run it after future node edits. `validate-catalog` rejects stale/missing
  metadata, so the list cannot silently miss new node changes. Source history
  begins with the repository import for older nodes, not their invention date.
  Daniel confirmed **Viivain / Klipper + M0**. A read-only Moonraker config
  query on 2026-10-05 verified the actual running configuration: M0 lifts the
  pen, PAUSE_BASE saves the position, PLOT_START executes G28 and sets up the
  block/paper origin; the RESUME hook is PLOT_GO. Thus pen changes already
  re-home. Added this explanation beside Pause command in Machine Setup;
  **no extra G28, exporter change, profile migration or firmware edit**.
  The app text explicitly describes the supplied Viivain configuration,
  rather than claiming every machine's M0 does this. Drift is not diagnosed:
  homing before seating cannot prevent movement during seating or drift later
  within a long colour layer. No movement, printer command or restart issued.
  Validation: recency checks cover all **304** source definitions; real browser
  shows **302** selectable nodes, Portrait/Arc Mounds/latest batch first,
  search preserves recency, arrows/Enter add, empty results and Escape work,
  Shift+N works and typing in a project-name field does not open the menu.
  Actual exporter function checked with 1/2/6 pens: 0/1/5 M0 changes, each
  preceded by pen-up and settle; Travel Stop Pen change also emits M0.
  Shared catalog → build → **18,114 Learn checks** passed, including both
  unchanged reference-export provenance checks; no recapture was required.
  **Local, uncommitted**, sequential with Portrait on
  `codex/portrait-continuous-scribble`, base
  `34e8fcc7c560cc5e797ab89bfe47b6daae6c39dd`. APP_VERSION stays 2.111.
  On authorized integration, bump once for the whole release, remove ready
  claims and refresh Claude's project snapshot after the commit.

- **W** 2026-10-05 Astra — **Colour Scribble**. New `colour_scribble`
  generator in Organic & Flow, inspired by Daniel's four coloured-hatching
  references. Compositions **Knot / Burst / River / Islands** place bundles
  of parallel pen gestures; **Hatching / Arcs / Zigzags / Mixed** chooses
  their shape. Controls cover bundle count and line density, physical length
  and width, spread, size variation, disorder, curvature, wandering threads,
  rotation/centre, margin, seed and **1–6 independent pens**. Colour changes
  preserve every geometric point; all marks are open, unfilled vector paths.
  Per-bundle seeded random streams isolate placement from density/pen changes.
  Segment clipping respects the page margin without artificial boundary
  strokes. Sampling is budgeted across the whole composition (base output
  <110k points before Style); malformed numeric wires are bounded. Standard
  Style input and preview region/centre guides. No app/engine/export change.
  Four A3 landscape Help examples added (**37 total**), reference/tags,
  generated source/catalog/recency refreshed (**305 node files / 307 total
  definitions / 192 generators**). `tools/render-colour-scribble.mjs` creates
  four computed SVGs, editable patches and a local gallery at
  `http://127.0.0.1:5194/`. These review SVGs are separate from browser capture
  evidence. Graduated lab file removed after parity verification.
  Validation: **315** focused checks including lab/baked parity (**314** with
  the graduated lab removed); determinism, all 16 composition/gesture pairs,
  clipping, bounds, malformed/extreme parameters, style, colour invariance,
  source recency and all 37 examples passed. Fresh browser load, Help example,
  node selection, composition/gesture controls and Latest nodes verified;
  no browser console errors. Catalog → build → **18,114 Learn checks** passed.
  Actual browser SVG: A3 420×297, **1,455 paths / 29,692 points / six pen
  groups**. Actual G-code: A4 297×210 (fits the 330×240 default test profile),
  **1,455 paths / 29,618 points / five M0 pen changes**, no bounds warning.
  Both compared point-for-point with the node output, max error <0.005 mm;
  route optimisation was off. No hardware run. Files, hashes and source
  provenance: `/tmp/muusia-colour-scribble-qa/verification.json`.
  SVG SHA-256 `ed07753594c8ffee7259bae6d426748e105494f9d150e42999fec75281e7d587`;
  G-code `35235333f5e643f27a9b8ecd51ac16749a123803570b00268fbb1c6a7380d0e1`.
  **Local, uncommitted**, alongside Portrait and Latest nodes on
  `codex/portrait-continuous-scribble`, base
  `34e8fcc7c560cc5e797ab89bfe47b6daae6c39dd`. Version remains 2.111 until the
  final authorized release. Refresh Claude after integration, not from an
  unlabeled dirty tree.

- **2.112** 2026-10-05 Astra release integration, authorized by Daniel's
  “julkaise”. Integrates the three accepted W2026-10-05 changes above:
  Portrait's continuous **Scribble** mode, **Latest nodes** (Shift+N), and
  **Colour Scribble** (Knot / Burst / River / Islands; four gestures; 1–6 pens).
  Help contains 37 examples; the catalog contains 307 definitions from 305 node
  files. Existing Portrait modes remain compatible. Machine Setup explains the
  supplied Viivain M0 → PLOT_START → G28 behaviour; no exporter, machine profile
  or firmware change, and no physical homing/plot test was performed.
  Release prep renames generated recency metadata to
  `src/defs/node-recency-data.js` so Claude's flat project snapshot can also
  include `src/node-recency.js` without a filename collision. The recency
  generator suppresses expected missing-HEAD-file diagnostics for new nodes.
  APP_VERSION is 2.112; catalog, source bundle and Learn manifest regenerated.
  Focused release checks: 208 Portrait Scribble, 96 legacy Portrait, 314 Colour
  Scribble, 305 current recency records and 37 examples pass. Prior real-browser
  SVG/G-code captures and their checksums are recorded in the entries above;
  version/metadata changes do not affect those exporters. Shared gate passed:
  catalog validation → build → check:learn (18,114 checks, 28 English pages).
  Release base: `34e8fcc7c560cc5e797ab89bfe47b6daae6c39dd`. Completed claims are
  removed in this integration. The release task must push the integration to
  main, verify the exact Pages run and public 2.112 result, then refresh the
  clean Claude snapshot. Preparation alone must not be reported as an upload.

## Hard-won pitfalls (keep)

- Extracting a function into helpers.js must take its module-private
  dependencies with it. `parseSVG` moved in C0 but `M_ID`/`parsePathD` and
  friends stayed in App.jsx as dead code; the ReferenceError surfaces only
  when a user loads a file (undetected from the C0 split until v2.105). Vite does not
  cross-module-check free identifiers. Any helper that is only reached via
  `onFile`/user action needs a Node validator that actually calls it.
- A GRADUATED LAB FILE IS NOT A SHIPPED NODE, AND A BAKED NODE IS NOT A
  DOCUMENTED ONE. `bake.mjs` writes `src/defs/nodes/<key>.js` and the lab file
  is deleted by hand afterwards; if the new file then misses `git add`, nothing
  complains. The app keeps working for the rest of the session because Node ⇣
  registered the def in memory, the validator keeps passing in baked mode, and
  the loss only surfaces when the node is missing from the palette after a
  refresh or a deploy. v2.89: hands was validated at 84 checks, committed as
  "add hands validator, drop graduated lab file" with the node itself absent,
  and the source survived only as a chat attachment — `nodes-lab/` is not even
  gitignored, the file was simply never staged. Its doc batch was then deferred
  by one session and forgotten too, so the node sat in the build untagged until
  the next release's patch reported one node missing from TAGS.json. After every
  bake: `ls -l src/defs/nodes/<key>.js`, `git add -f` the explicit path, read
  `git status --short` for the `A` line, and run the doc batch in the same
  sitting.

- SENTINELS IN dist MUST BE STRING LITERALS. Vite minification renames every
  local identifier, so `grep -c someVarName dist/index.html` returns 0 even
  when the feature is in the build (v2.81: `rArrow` greppd 0, feature was
  fine). Grep dist for GUI text or another string literal ("Unlock watch",
  a node key, a param label); identifiers are only valid sentinels against
  `src/`.
- A LAB FILE IS NOT IN THE BUILD. Node ⇣ registers a custom node in the running
  session only, so a node developed that way works perfectly for weeks and is
  absent from `dist` — no validator can catch it, because the node is fine. Bake
  before shipping, and grep the built `dist/index.html` for the node KEY as part
  of the release check, not just for the version string.
- When one table has to live in two files, make a validator PARSE the second
  copy and compare it to the first. Controller's layout table sits in the node
  (which pin is which) and in src/live-input.jsx (which control writes which
  param); a drift between them wires a pin to the wrong control while every
  other test stays green. Mutation-test the comparison itself, or you have only
  added a check that always passes.
- Giving each value its own natural unit sounds tidier than one shared unit and
  is usually the opposite. Controller briefly stored degrees, press counts and
  0/1 in separate per-control parameters, which forced Out min..Out max to apply
  to some layouts and not others and needed a parameter per control. Collapsing
  everything to normalised 0-1, mapped once by compute, removed a third of the
  node and made the range, the snap, the keyboard nudge and the panel readout
  one code path.
- A NORMALISING FIT silently converts a size control into a density
  control. Chain fitted its drawing to the margin box, so Link size never
  changed the drawing at all — it only changed how many hatch rungs were packed
  in before the scale-down, which reads as a density knob and was reported as
  "the size parameter is broken". Fit must SHRINK ONLY (`Math.min(1, ...)`),
  and any spacing quoted in millimetres has to be divided by that shrink or it
  is not the millimetres the label claims.
- Drawing the SAME rng() TWICE inside one route is how an orthogonal generator
  grows diagonals: Circuit computed a corner's displacement and then recomputed
  it for the point that had to share the coordinate. Finite, in bounds, in
  budget, and wrong — only a render caught it. Any node whose premise is a
  constraint (right angles, symmetry, planarity) needs that constraint asserted
  directly; and never CLAMP a point back into the box, because clamping x and y
  independently moves a corner off its own axis. Reject the route instead.
- Offsetting a curve along its own normal AMPLIFIES the source curve's faceting
  by the compression ratio at corners, until the error rivals the spacing
  between offset points and the offset edge steps backwards. The fix is density
  in the raw construction plus an arc-length resample, not a bigger tolerance.
- A canal surface's boundary circle is NOT perpendicular to the tangent where
  the radius varies: it is pulled back by r·r' and shrunk by sqrt(1 - r'^2).
  Drawing the naive circle puts the surface inside its own neighbouring spheres,
  the visibility test correctly calls those points hidden, and the tube renders
  as torn shreds (Knot Tube). Related: sample a parametric spine by ARC LENGTH
  before estimating curvature — where a Fourier or Lissajous parametrisation
  crawls, the samples bunch and the curvature estimate explodes, pinching the
  tube at a bend that is not sharp.
- Clamp ORDER matters when several bounds apply to one array: smoothing can
  RAISE a value, so a curvature clamp has to be reapplied after it, while a
  Lipschitz sweep only lowers and can safely come last. And a generous floor
  (`Math.max(0.25, ...)`) placed outside the clamp silently overrides it
  exactly where the clamp mattered most.
- An oracle can be wrong in the node's favour AND against it. Knot Tube's
  envelope test first measured penetration into the whole union of spheres and
  failed the correct code, because two strands of a knot fuse on purpose and a
  point of one buried inside the other is a correct picture of a merged solid.
  Narrowing the window did not fix it either. The right test was the analytic
  envelope condition (F = 0 and dF/ds = 0), which is immune to fusion — when an
  oracle fails, ask whether it is measuring the invariant or something adjacent.

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
