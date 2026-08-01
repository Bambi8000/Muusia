#!/usr/bin/env node
/* tools/patch-docs-242.mjs
   Docs for the 2.42 release: Slide Rule + Nanotubes (Generators 107->109),
   Fade Out (Modifiers 63->64), total 199->202, version headers, HANDOFF
   entry (including the Molecule build-and-cut decision). Node paragraphs
   anchor after ASCII Art (Generators) and Brush Z (Modifiers/penout) for
   anchor stability. Run from repo root AFTER baking and the gcode patch:
     node tools/patch-docs-242.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const APP = "src/App.jsx";
const NODES = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

const EDITS = [
  { file: APP, label: "APP_VERSION 2.41 -> 2.42", guard: 'APP_VERSION = "2.42"',
    old: 'APP_VERSION = "2.41"', new: 'APP_VERSION = "2.42"' },
  { file: NODES, label: "NODES.md header version", guard: "v2.42 \u2014 Node Reference",
    old: "# MUUSIA v2.41 \u2014 Node Reference", new: "# MUUSIA v2.42 \u2014 Node Reference" },
  { file: NODES, label: "total count 199 -> 202", guard: "All 202 built-in nodes.",
    old: "All 199 built-in nodes.", new: "All 202 built-in nodes." },
  { file: NODES, label: "Generators 107 -> 109", guard: "## Generators (109)",
    old: "## Generators (107)", new: "## Generators (109)" },
  { file: NODES, label: "Modifiers 63 -> 64", guard: "## Modifiers (64)",
    old: "## Modifiers (63)", new: "## Modifiers (64)" },
  {
    file: NODES,
    label: "Slide Rule + Nanotubes paragraphs (after ASCII Art)",
    guard: "**Slide Rule** \u2014 slide rule scales",
    old: `letters (O 0 D Q 8 \u00d6, dots) come out as real closed shapes, so Pattern Fill,
Container and the other region nodes see them.`,
    new: `letters (O 0 D Q 8 \u00d6, dots) come out as real closed shapes, so Pattern Fill,
Container and the other region nodes see them.

**Slide Rule** \u2014 slide rule scales with the real mathematics: C/D (log), A/B
(two decades), K (cubes), CI (inverted C on its own pen \u2014 the classic red),
L (linear mantissa), S (sines at 1+log10 sin) and T (tangents), each a
checkbox. Tick subdivision adapts so gaps never drop below *Min tick gap*;
three graded tick heights, stroke-font numerals and scale letters. *Straight*
stacks a Mannheim rule with body frame and slide separators around B/CI/C;
*Circular* wraps every decade around a full 360\u00b0 ring \u2014 multiplication is
angle addition, like a real circular rule. The *Cursor position* hairline is
value-drivable: wire Frame into it and the cursor sweeps the scales.

**Nanotubes** \u2014 3D carbon wireframes: Fullerene C60 (exact truncated-
icosahedron coordinates \u2014 60 atoms, 90 bonds, 3-regular), armchair (n,n) and
zigzag (n,0) nanotubes built by rolling a real honeycomb lattice into a
cylinder (n sets the diameter), Graphene sheet, Nanotorus (the lattice closed
seamlessly in both directions) and Onion (nested C60 shells). Yaw / Pitch /
Perspective are value-drivable \u2014 wire Frame into Yaw for a spinning molecule;
*Front half* culls bonds facing away by surface normal for a solid look;
*Atom dots* marks the carbons.`,
  },
  {
    file: NODES,
    label: "Fade Out paragraph (after Brush Z)",
    guard: "**Fade Out** \u2014 comet tails",
    old: `MUST be last in the chain \u2014 downstream modifiers
strip the Z data. Bed-Z profiles only; servo mode ignores pressure.`,
    new: `MUST be last in the chain \u2014 downstream modifiers
strip the Z data. Bed-Z profiles only; servo mode ignores pressure.

**Fade Out** \u2014 comet tails by lifting the pen SLOWLY while it still moves:
the ink starves and the stroke fades out. Encodes a negative Z (lift above
pen-down) into the point third component; the export turns it into
simultaneous Z moves (bed-Z only, \u00b16 mm clamp, capped at pen-up \u2014 needs the
2.42 export patch). *Fade length* ramps the lift inside the stroke's last
millimetres, *Tail extension* continues past the end along the exit tangent;
ramps Linear / Soft / Long (the pen hugs the paper and lets go late \u2014 longest
visible tail) / Quick. End / Start / Both, seeded per-stroke Variation; short
strokes and closed paths pass through. MUST be last in the chain, like
Brush Z. Note: Travel Sort may reverse strokes, turning a fade-out into a
soft landing.`,
  },
  {
    file: HANDOFF,
    label: "2.42 version history entry",
    guard: "- **2.42** three nodes",
    old: `  tools/patch-glyph-loops.mjs + tools/patch-glyph-brp.mjs.`,
    new: `  tools/patch-glyph-loops.mjs + tools/patch-glyph-brp.mjs.
- **2.42** three nodes + an export extension. **Slide Rule** (gen/scientific:
  nine real scales as checkboxes, adaptive tick subdivision against a
  physical min-gap, Mannheim frame + slide separators or Circular
  decade-per-360\u00b0 rings, value-drivable cursor; validated to machine
  precision against the scale mathematics \u2014 CI proven the exact mirror of
  C). **Nanotubes** (gen/scientific: C60 from exact truncated-icosahedron
  coordinates \u2014 60V/90E 3-regular \u2014 armchair/zigzag tubes from a rolled
  honeycomb with wraparound bond metric + whisker pruning, graphene,
  seamless nanotorus with E = 1.5V exactly, C60 onion; Front-half culling
  proven a strict subset of Transparent). **Fade Out** (mod/penout:
  slow-lift comet tails as NEGATIVE point z \u2014 export patch
  tools/patch-fadeout-gcode.mjs widens the z clamp to \u00b16 mm capped at
  pen-up, plunge behaviour byte-identical, NODE-API z spec updated).
  **Molecule** (24 hydrocarbons + caffeine / glucose / fructose / sucrose /
  betulin / gasoline blend, Kekul\u00e9 by perfect matching, 20/20 checks) was
  built and validated but CUT by decision before bake \u2014 second cut after
  the Opus-era version. Validator lessons: negative zero breaks toFixed
  dedupe keys ((-1e-17).toFixed(4) !== "0.0000" \u2014 caused degree-4 atoms in
  the armchair lattice), and patch guard strings must not straddle line
  breaks (bit twice this session).`,
  },
];

let miss = 0;
for (const e of EDITS) {
  let txt;
  try { txt = readFileSync(e.file, "utf8"); }
  catch { console.log("MISS " + e.label + "  [" + e.file + " not found]"); miss++; continue; }
  if (e.guard && txt.includes(e.guard)) { console.log("SKIP " + e.label + "  [already applied]"); continue; }
  const n = txt.split(e.old).length - 1;
  if (n !== 1) { console.log("MISS " + e.label + "  [anchor found " + n + " times]"); miss++; continue; }
  writeFileSync(e.file, txt.replace(e.old, e.new));
  console.log("OK   " + e.label);
}
process.exit(miss ? 1 : 0);
