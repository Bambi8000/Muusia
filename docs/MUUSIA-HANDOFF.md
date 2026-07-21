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

## Repo layout (post-C0 split, v2.29)

- `src/App.jsx` — engine + UI only (~3.8k lines): graph evaluation, canvas, palette,
  inspector, preview (ZoomBox), export panel, machine setup, Mega Canvas, magnet jig,
  animation, help. Also hosts the two engine-bound DEFS entries: `group`, `reititys`.
- `src/defs/helpers.js` — shared node helpers: `Pin, EMPTY, PENS (+PENS_DEFAULT,
  savePens, resetPens), mulberry32, hash2, noise2, resample, pathLength, applyStyle,
  isStyle, signedArea, parseSVG, SFONT, fontStrokes`. PENS loads user colors from
  localStorage key `muusia-pens` at import time (try/catch — Node CLI runs warn
  harmlessly about localstorage).
- `src/defs/nodes/*.js` — one file per node, **166 files** (168 nodes total with
  group + reititys; Generators 86, Modifiers 55). ESM format:
  `import { ... } from "../helpers.js";` + `export default { key: "x", name, cat,
  group, desc, ins, outs, params, overlay?, compute };`
- `src/defs/index.js` — assembles `DEFS_NODES` via `import.meta.glob` (eager),
  alphabetical by filename. **Adding a built-in node = dropping a file here.**
- `docs/` — MUUSIA-HANDOFF.md (this), MUUSIA-NODES.md (every node),
  MUUSIA-NODE-API.md (custom-node authoring spec, plotternode format).
- `tools/` — era scripts (historical surgery + validators), `extract.mjs`,
  `patch-docs.mjs`, `make-src-bundle.mjs`. Every new node gets a
  `tools/validate-<name>.mjs` before it ships.
- `nodes-lab/` — experimental `.plotternode.js` files for the in-app **Node ⇣**
  import; not part of the build. Approved experiments graduate to `src/defs/nodes/`
  (wrapper conversion: `({ ... })` → import line + `export default { ... };`).

## Build / release routine

- `npm run build` → `dist/index.html` (vite + vite-plugin-singlefile; standalone,
  offline). `npm run dev` for live work.
- Node count check: `ls src/defs/nodes | wc -l` (166) — the old
  `grep -c 'cat: "'` on App.jsx is dead.
- Version: single `APP_VERSION` constant in App.jsx (UI header + G-code stamp).
  Bump with `sed -i '' 's/APP_VERSION = "2.XX"/APP_VERSION = "2.YY"/' src/App.jsx`,
  verify with `grep -o 'APP_VERSION = "[^"]*"' src/App.jsx`.
- Deploy: git push → GitHub Pages. CDN lags ~10 min; `curl -s <url> | wc -c` +
  version grep distinguishes broken deploy from cache.
- zsh does not accept `#` comments in pasted commands.
- `.gitignore` covers `src/App.jsx.bak-*` (surgery-era backups).
- Hard-removal policy: nodes/params may be removed or change defaults between
  versions; old patches referencing removed keys are accepted casualties (Daniel
  keeps no critical legacy patches).

## Node authoring recipe (current)

1. Experiment as `nodes-lab/x.plotternode.js` (spec: MUUSIA-NODE-API.md), import
   via **Node ⇣**, iterate on look with Daniel.
2. Write/convert to `src/defs/nodes/x.js` (ESM format above). Import only the
   helpers actually used.
3. Write `tools/validate-x.mjs`: plain ESM imports of the node (no stubs needed),
   assert determinism (double run equal), finite coords, ≥2-pt paths, in-bounds,
   and every parameter's *liveness* plus any invariant that matters (symmetry,
   no-overlap gap, monotonic width, graph connectivity...). Run before build.
4. `npm run build` is the syntax gate — errors point at the exact node file.
5. Update `docs/MUUSIA-NODES.md` (paragraph + counts) — or leave for a doc batch.

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

## Hard-won pitfalls (keep)

- Browsers do NOT overwrite downloads (`name (1).ext`) — irrelevant post-C0 for
  code, still true for any downloaded file.
- NODE_HELP-style strings may contain escaped quotes: regex-replacing doc strings
  needs `(?:[^"\\]|\\.)*`, plain `[^"]*` breaks on `\"`.
- Chain-walking regexes over `else if (M === "...")` must anchor on the quoted
  string, not `\([^)]*\)` — option labels contain parentheses.
- Test assertions must not measure pinned endpoints when checking smoothing.
- `import.meta.glob` order = filename order; palette groups sort alphabetically.

## Roadmap / ideas

Frame-sequence export as single ZIP · per-pen time estimates · value ports on
promoted group params · multi-tip brush tool change (servo) · zoned vacuum table
workflow for wet media · registration marks for mega sheets · SimView zoom ·
GitHub nodes library curation.