# MUUSIA v1.7

**A node-graph editor for generative pen-plotter art.**

Muusia is a browser-based visual programming environment for creating plotter drawings.
You build images by wiring nodes together: **147 built-in nodes** — generators produce
line work, modifiers transform it, and the export panel turns the result into G-code
for a pen plotter or layered SVG for a laser cutter. The library spans classic plotter
machines (Harmonograph, Spirograph, L-System), simulation (Conway, Reaction-Diffusion,
Differential Growth, attractors), audio-DSP translated to geometry (LFO, ADSR, Filter,
Fold, Granulate, Bitcrush, Fourier), image-fed nodes (Trace, Displace by Image), and
plot-practical tools (Travel Sort, Occlude, Stencil, To Polar). Everything is deterministic (seeded), everything is
live-previewed, and every numeric parameter can be driven by other nodes — including a
frame clock for producing hand-plotted animations.

Muusia runs entirely locally, has zero network dependencies, and builds into a single
HTML file you can double-click.

---

## 1. Install & build

Requirements: Node.js (18+).

```bash
npm create vite@latest muusia -- --template react
cd muusia
npm install
npm install -D vite-plugin-singlefile
cp ~/Downloads/muusia.jsx src/App.jsx
# replace vite.config.js with the provided single-file config
cat > src/index.css << 'EOF'
* { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #0D1117; }
EOF
rm -f src/App.css
npm run build        # -> dist/index.html  (standalone, works offline)
npm run dev          # -> live dev server for development
```

`dist/index.html` is the whole application in one file. Archive versions as
`Muusia-v1.7.html` etc. On macOS you can wrap
`open -na "Google Chrome" --args --app=file:///path/Muusia.html` in an Automator
application for a dock icon, or use Safari's *File → Add to Dock*.

**Update routine:** `cp ~/Downloads/muusia.jsx src/App.jsx && npm run build`.

Known `file://` caveats: the *Set default* startup patch depends on browser storage
(reliable in Chrome, moody in Safari); the Copy button uses a fallback path. Everything
else — file save/load, exports, custom nodes — is identical to the dev server.

## 2. Core concepts

**Path set.** Everything on a blue wire is a set of polylines:
`{ paths: [{ pts: [[x,y],...], closed, layer }] }` in millimetres.
**Point order is pen direction** — a first-class property used by routing
("preserve direction"), brush rotation, and the Reverse node.

**Layers = pens.** Each path carries a pen index 0–5. Layers become pen-change stops
in G-code and `<g>` groups in SVG.

**Typed wires.** Blue = paths, green = numbers, yellow = stroke style. Only equal
types connect. Every numeric parameter automatically exposes a green input port, so
any value (Value, Random, Math, Frame) can modulate any parameter.

**Determinism.** No `Math.random()` anywhere: all randomness flows from seed
parameters. The same patch always plots the same drawing — which is what makes the
animation system possible.

## 3. The interface

- **Left palette** — nodes by category; drag to canvas. Custom nodes show a × to
  remove. Generators and Modifiers are organized into collapsible **theme folders**
  (Generators: Geometric, Organic & Flow, Drawing Machines, Nature, Creatures,
  Space, Scientific, Structural, Text & Image; Modifiers: Transform, Deform,
  Path Ops, Cut & Split, Fill & Style, Pen & Output). The **All nodes** checkbox at
  the top lists every node alphabetically within its category, ignoring folders.
- **Canvas** — the graph. Click selects, drag moves, drag from port to port wires.
  Cmd/Ctrl+Z undo, Shift+Cmd+Z redo, Delete removes, Cmd+G groups a selection into a
  subgraph (double-click to enter).
- **Quick-add** — press **G**/**M**/**D**/**C**/**X** for a searchable list of
  Generators / Modifiers / Decorators / Combiners / Math, **N** for all. Type to
  filter, arrows + Enter to place.
- **Right panel** — live preview of the selected node (Space = large overlay preview,
  with a route simulator showing draw order and travel moves), parameters, ANIMATE,
  Machine Setup, and export buttons.
- **? button** — in-app help and loadable beginner examples.
- **Per-node help** — every node header has a small **?**: hover for a quick tooltip,
  click to open a description of what the node does and how to wire it. Texts come
  from `MUUSIA-NODES.md`; imported custom nodes can ship their own via a `desc` field.
- Nodes with spatial parameters (Stretch, Crop, Magnet, Lens, Tangle Zone, Mirror,
  Explosion...) draw dashed **guide overlays** in the preview when selected.

## 4. Machines & export

Machine Setup supports multiple machine profiles (work area, origin on the canvas,
flip-Y, Z heights, speeds, pen-change pause command, optional brush rotation and dip
routines). The active profile is used for G-code. Profiles import/export as
`.muusia-machine.json` via the ⇣/⇡ buttons, and a standalone configurator
(`muusia-machine-setup.html`) builds them with presets, a bed diagram and a
lift-time estimate — no JSON editing.

**Z modes — profile A (servo) and B (bed).** Machine Setup ships with two presets.
**A — Servo lifts the pen** (default): pen up/down is a Klipper servo
(`SET_SERVO SERVO=pen ANGLE=…`, name and angles configurable; define `[servo pen]`
in printer.cfg). The bed-Z is untouched, which frees it — and the extra stepper —
for tool duties like a multi-tip brush. **B — Bed Z lifts the pen** (the Ultimaker
S5 conversion): the heavy bed is the Z axis, with the tangential brush-rotation
stepper enabled. For bed mode two settings matter: **Z-hop** lifts only slightly
between nearby paths (full Lift height is reserved for pen changes), and **settle
delays** (down/up, in ms) pause after the bed moves so the pen doesn't drag before
the bed stops. A servo lift wants near-zero delay; a bed wants 80–150 ms and z-hop
on. **Z feed** sets bed lift speed. Old saved profiles without a Z mode behave
exactly as before (bed).

**Wearing media (chalk, charcoal, soft graphite).** These can't hold constant
pressure as the tip wears — the real fix is a spring-loaded / gravity / magnet pen
holder that keeps force constant and absorbs both wear and bed unevenness. To
schedule the periodic manual advance, enable **Maintenance pause**: every N mm drawn
the pen lifts and pauses (M0) with a custom message ("Advance chalk"), then resumes.
Staying in place preserves registration; parking uses Klipper SAVE/RESTORE_GCODE_STATE
to return exactly.

- **Optimize route** — greedy nearest-neighbour reordering per pen to minimize travel.
- **Preserve direction** — when on, paths are never reversed (brush work); when off,
  the router may flip paths to halve travel.
- Machine Setup shows a **bed diagram**: the work area with the canvas placed at the
  origin (red if it doesn't fit).
- **GENERATE G-CODE** exports the *selected node's* output; the header includes the
  machine, origin, a work-area warning and a time estimate (draw/travel meters and
  minutes).
- **EXPORT SVG** — millimetre-true SVG with one group per pen layer.

## 5. Animation

Physical animation: plot N papers as frames, scan, assemble.

1. Set **Frames** in the ANIMATE section.
2. Add a **Frame** node (Math category). Outputs: `t 0→1` (linear ramp),
   `frame #` (integer), `wave loop` and `ping-pong` (seamless loops — frame N
   continues into frame 0).
3. Wire outputs into any parameter. `frame #` into a Seed gives per-paper randomness
   (the hand-drawn "line boil"); `wave`/`ping-pong` into sizes/amounts gives smooth
   loops; for a full rotation use `frame # → Math (× 360/frameCount) → Rotate`.
4. **▶** previews the animation live. **G-code × N / SVG × N** re-evaluates the graph
   per frame and downloads one file per frame (`name-f000.gcode`, ...).

Anything *not* wired to Frame is identical on every paper. Add a **Reg Marks** node
last in your Merge for scan registration.

## 6. Custom nodes & modules

- **Node ⇣** imports a node definition file. The full authoring spec is in
  `MUUSIA-NODE-API.md` — it is written to be handed to an AI assistant, which can
  produce an importable node from it. Include a `desc: "..."` field so the node gets
  a help tooltip. Custom node sources are embedded in saved
  patches, so patches are self-contained. Re-importing a key updates the node;
  × in the palette removes it (blocked while instances exist).
- **Mod ⇡ / Mod ⇣** exports/imports a *selection* as a reusable module (subgraph
  with remapped ids).
- **Promoted parameters:** inside a group, click the ☆ next to any parameter to
  expose it on the group's face — the group card then shows that control directly
  (× removes it). This turns groups into reusable instruments.
- Patches save as `name.muusia.json` (old `plotter-patcher` files still load).

## 7. Architecture notes

One registry (`DEFS`) holds every node as a self-contained definition — type,
category, pins, typed parameter descriptors, an optional `overlay()` for preview
guides, and a pure `compute(ins, params, ctx, node)`. The engine knows nothing about
individual nodes; adding one never touches existing code. The same evaluation path
serves the live preview, the route simulator, and per-frame animation export. G-code
is generated by Muusia's own direction-aware exporter (not vpype), because stroke
direction is data here.

## 8. Roadmap / ideas

Custom pen palettes · per-pen time estimates · value ports on promoted group params ·
multi-tip brush tip selection replacing pen-change pauses (servo profile) ·
zMode support in the standalone machine configurator · a `nodes/` library folder for
the unbaked extras (Boolean, Morph, ...).
