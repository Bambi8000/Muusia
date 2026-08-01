#!/usr/bin/env node
/* tools/patch-docs-238.mjs
   v2.38 documentation batch: NODES.md (header/counts, Ribbon update, Comets
   cross-ref, three new node paragraphs), HANDOFF (2.38 history entry, standing
   post-push doc rule). Anchored replacement, OK/MISS report. Run from repo root:
     node tools/patch-docs-238.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const NODES = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

const EDITS = [
  { file: NODES, label: "header version",
    old: "# MUUSIA v2.37 \u2014 Node Reference",
    new: "# MUUSIA v2.38 \u2014 Node Reference" },
  { file: NODES, label: "header node count",
    old: "All 196 built-in nodes.",
    new: "All 199 built-in nodes." },
  { file: NODES, label: "Generators count",
    old: "## Generators (106)",
    new: "## Generators (107)" },
  { file: NODES, label: "Combiners count",
    old: "## Combiners (12)",
    new: "## Combiners (14)" },
  { file: NODES, label: "Ribbon paragraph: Ring mode",
    old: `**Ribbon** \u2014 a wandering backbone with parallel companion lines (1\u201360). At lines = 1
it is a clean single guide curve \u2014 a good Spine for Ruler or Follow Lines.`,
    new: `**Ribbon** \u2014 a wandering backbone with parallel companion lines (1\u201360). Shape *Line*
runs the spine left to right across the sheet; *Ring* closes it into a seamless loop
around the canvas center (Ring radius sets the base size, Wander makes the loop
breathe; the noise is sampled periodically so there is no seam) with every filament a
closed stroke. At lines = 1 it is a clean single guide curve \u2014 a good Spine for
Ruler or Follow Lines.` },
  { file: NODES, label: "Comets cross-ref + insert Pins paragraph",
    old: `**Comets** \u2014 nucleus and sweeping tail. Detailed draws the ball with coma arcs
and a fan of curved tail streamlines; Minimal is just a dot and a single line.
Body and tail on separate pens; tails point away from the sun direction.`,
    new: `**Comets** \u2014 nucleus and sweeping tail. Detailed draws the ball with coma arcs
and a fan of curved tail streamlines; Minimal is just a dot and a single line.
Body and tail on separate pens; tails point away from the sun direction. Unlike
Pins' order-to-chaos needle field, Comets is a few scene comets sharing one sun.

**Pins** \u2014 sewing pins: straight shafts with a ball head at the tip. Chaos runs
from a neat grid where every pin points at Angle (0) to a fully scattered jumble
of random positions and directions (1); the shaft stops exactly at the ball's
edge, pen travelling tail \u2192 head. Head fill draws the ball as an outline,
concentric rings or one continuous inward spiral; Head pens cycles the balls
across several pens like a real pin assortment while shafts keep Shaft pen; Bend
curves the needles. Every pin fits the margin whole. Unlike Comets, whose few
tails share a sun direction, Pins is an order-to-chaos field of up to 200 needles.` },
  { file: NODES, label: "insert Wind Tunnel + Container after Stencil",
    old: `**Stencil** \u2014 pick ONE closed region from the Regions input (index wraps, so the
slider steps next/previous \u2014 or wire Steps to animate the selection) and clip
the Content input inside it, with an edge inset. All-regions mode, outline
preview, and browse mode when Content is unwired.`,
    new: `**Stencil** \u2014 pick ONE closed region from the Regions input (index wraps, so the
slider steps next/previous \u2014 or wire Steps to animate the selection) and clip
the Content input inside it, with an edge inset. All-regions mode, outline
preview, and browse mode when Content is unwired.

**Wind Tunnel** \u2014 streamlines flowing around the closed shapes wired into
Obstacle, like smoke lines in a wind tunnel: a uniform flow (Angle) is steered
tangentially inside the Influence band, so lines hug and part around the object
at Clearance distance \u2014 never inside it (a hard projection guarantees the gap).
Hug shapes how abruptly they wrap; Waviness meanders the whole field; Wake
turbulence churns the flow behind each shape and dies out over Wake length.
Keep shape passes the obstacle through on its own pens; unwired Obstacle gives
plain flow lines. All closed input shapes act as obstacles \u2014 wire one via
Stencil to aim the tunnel at a single potato.

**Container** \u2014 limits content to a region: wire any closed shapes into Region
(the whole set acts as a union), or pick a built-in Rectangle, Circle or
Triangle placed with Center/Size/Rotate \u2014 both parametric and wired regions
show as dashed guides when the node is selected. Keep Inside boxes an effect
into the area, Outside punches a hole; Gap grows (+) or shrinks (\u2212) the region
from its edge, cuts are bisection-accurate at the border and fully-inside
closed paths stay closed. Draw region plots the container outline on its own
pen; unwired Region passes content through. Content \u2192 Squiggle \u2192 Container
confines every mark of an effect inside a Potato; Container first lets the
wave overshoot the edge.` },
  { file: HANDOFF, label: "2.38 version history entry",
    old: `  interior points excluded, collinear degenerates to one segment). Old
  Bridges params/rules untouched \u2014 old patches load unchanged.`,
    new: `  interior points excluded, collinear degenerates to one segment). Old
  Bridges params/rules untouched \u2014 old patches load unchanged.
- **2.38** three nodes + an engine extension. Nodes: **Wind Tunnel** (duo:
  streamlines steered around wired obstacles \u2014 tangential steering + a hard
  per-step clearance projection so lines never enter the shape; wake
  turbulence behind each obstacle), **Pins** (gen: order\u2194chaos needle field,
  ball heads with rings/spiral fills, multi-pen head assortment, shaft stops
  at the ball edge), **Container** (duo: clip content to a wired region or a
  parametric rect/circle/triangle with rotation, \u00b1Gap, bisection-accurate
  cuts \u2014 unifies Mask/Crop/Eraser; **Mask is now a deprecation candidate**).
  **Ribbon** gained Shape Line/Ring \u2014 Ring is a seamless periodic-noise loop
  of closed filaments; Line mode validated byte-identical to 2.37 against a
  transcription of the old compute, and a missing shape param falls into the
  Line branch so old patches load unchanged. Engine: **overlay(params, ctx,
  ins)** \u2014 primaryGuides resolves the selected node's data inputs and passes
  them as an optional third overlay argument (backward compatible; applied
  via tools/patch-overlay-ins.mjs, documented in NODE-API), so zone nodes can
  show WIRED regions as dashed guides. Validator lessons: name harnesses
  validate-<key>; a process.exit() before appended checks silently skips
  them \u2014 prefer process.exitCode.`,
  },
  { file: HANDOFF, label: "standing post-push doc rule",
    old: "5. Update `docs/MUUSIA-NODES.md` (paragraph + counts) \u2014 or leave for a doc batch.",
    new: "5. Update `docs/MUUSIA-NODES.md` (paragraph + counts) + the HANDOFF version\n   history **immediately after every push** \u2014 the standing doc-batch rule\n   (agreed v2.38): docs never lag a release." },
];

let miss = 0;
const GUARDS = {
  "header version": "v2.38 \u2014 Node Reference",
  "header node count": "All 199 built-in nodes.",
  "Generators count": "## Generators (107)",
  "Combiners count": "## Combiners (14)",
  "Ribbon paragraph: Ring mode": "Shape *Line*",
  "Comets cross-ref + insert Pins paragraph": "**Pins** \u2014 sewing pins",
  "insert Wind Tunnel + Container after Stencil": "**Wind Tunnel** \u2014 streamlines flowing",
  "2.38 version history entry": "- **2.38** three nodes",
  "standing post-push doc rule": "standing doc-batch rule",
};
for (const e of EDITS) {
  let txt;
  try { txt = readFileSync(e.file, "utf8"); }
  catch { console.log("MISS " + e.label + "  [" + e.file + " not found]"); miss++; continue; }
  const g = GUARDS[e.label];
  if (g && txt.includes(g)) { console.log("SKIP " + e.label + "  [already applied]"); continue; }
  const n = txt.split(e.old).length - 1;
  if (n !== 1) { console.log("MISS " + e.label + "  [anchor found " + n + " times]"); miss++; continue; }
  writeFileSync(e.file, txt.replace(e.old, e.new));
  console.log("OK   " + e.label);
}
process.exit(miss ? 1 : 0);
