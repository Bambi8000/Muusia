/* tools/patch-docs-236.mjs — v2.36 documentation batch.
   Covers BOTH the pending 2.35 nodes (Spore Print, Brush Z — shipped without
   a doc batch while hardware testing was pending) and the 2.36 five
   (Double Pendulum, Gyroid, Cracked Paint, Wave Hatch, Burr Cluster), plus
   the NODE-API note on the optional third point component (Brush Z pressure).
   Anchored string replacement with OK/MISS reporting. Run from repo root:
   node tools/patch-docs-236.mjs */
import fs from "fs";

let fails = 0;
const patch = (file, edits) => {
  let s = fs.readFileSync(file, "utf8");
  for (const [name, from, to] of edits) {
    if (s.includes(from)) {
      s = s.replace(from, to);
      console.log("OK   " + file + " :: " + name);
    } else {
      console.log("MISS " + file + " :: " + name);
      fails++;
    }
  }
  fs.writeFileSync(file, s);
};

/* ---------------- MUUSIA-NODES.md ---------------- */

const GEN_PARAGRAPHS = `**Spore Print** \u2014 mushroom spore prints with real gill anatomy: primaries run
from the blank stem disc to the rim and shorter lamellula tiers spawn in the
widening gaps (closed-form binary hierarchy), keeping line spacing even across
the whole cap. Wobble bends the gills at constant mm amplitude, Swirl twists the
print, Edge roughens the cap rim, Fade breaks lines into a dusty falloff that
strengthens toward the rim, Dust scatters spore specks (own pen), Rim band adds
a dense edge ring. Count drops up to six varied caps on one sheet.

**Double Pendulum** \u2014 a real double pendulum drawing its chaotic trace (RK4,
fixed step, fully deterministic \u2014 no seed). Trace Bob 2 / Bob 1 / Both /
Midpoint; Traces runs up to eight pendulums with a tiny Perturb offset so chaos
tears the bundle apart, optionally one pen per trace. Damping spirals the line
into rest for a finite drawing; the trace provably stays inside Arm 1 + Arm 2
around the Pivot. Chain into Brush Z (Ramp down) for a chaotic brush stroke
fading with the energy.

**Gyroid** \u2014 the triply periodic minimal surface sliced into stacked contour
rings with the Retro Mesh camera (Perspective, Rot X/Y, fit). Cells sets the
period count, Iso slides through the level-set family, Warp bends the field
with seeded noise, Shape clips to Cube / Sphere / Cylinder. Surface Transparent
overprints retro-style; Solid ray-marches the implicit field for exact hidden
lines \u2014 front shells occlude the back while the holes still see through \u2014
with framing shared between the two so toggling never rescales.

**Cracked Paint** \u2014 peeling paint craquelure: a hierarchical crack network
splits the sheet into flakes, early cracks wide dark gaps and later ones
hairlines (Hierarchy), every crack noise-curved (Wobble), breathing in width
and pinching to hairline tips. Horizontal bias steers the primaries. Wide
cracks draw as varying-width outlines with lengthwise fill; Chips bulges dark
blobs along the cracks and knocks small flakes out as hatched voids (own pen);
Edge curl adds the lifted-flake inner line.

**Wave Hatch** \u2014 wave bands of dense vertical strokes: blank noise-wave seams
(structurally non-crossing) divide the sheet and every band fills with tight
upright lines seam to seam. Seam gap is the negative space that draws the
waves; Lean fans the strokes with the local slope, Hand wobble bends them and
jitters the pitch for the hand-hatched textile read. Serpentine ordering for
plotting economy.

**Burr Cluster** \u2014 a clustered mass of overlapping seed pods grown by chaining
noise-edged lobes. Each lobe fills with near-horizontal hatch (Angle jitter per
pod, Speckle gaps, Wobble), lobes layer so internal seams read like pressed
pods, and short bristle spikes radiate from every visible edge \u2014 silhouette
and seams \u2014 with jittered angles and crossing X pairs. Blots splatters small
filled ink dots.

## Modifiers`;

const MOD_PARAGRAPH = `**Brush Z** \u2014 brush pressure for a real Z axis: encodes millimetres of plunge
below pen-down contact into every point (third component) that the G-code
export turns into simultaneous Z moves \u2014 the brush breathes while it draws.
Eight waves oscillate along arc length (Sine / Triangle / Square / Pulse+Duty /
Noise / Ramps / Constant) with Wavelength, Phase and per-stroke jitters; End
taper eases pressure to zero at stroke ends; Ghost width previews the stroke
envelope on its own pen. MUST be last in the chain \u2014 downstream modifiers
strip the Z data. Bed-Z profiles only; servo mode ignores pressure.

## Decorators`;

patch("docs/MUUSIA-NODES.md", [
  ["version header",
    "# MUUSIA v2.34 \u2014 Node Reference",
    "# MUUSIA v2.36 \u2014 Node Reference"],
  ["total count",
    "All 188 built-in nodes.",
    "All 195 built-in nodes."],
  ["generators count",
    "## Generators (99)",
    "## Generators (105)"],
  ["modifiers count + insert 6 generators",
    "## Modifiers (62)",
    GEN_PARAGRAPHS + " (63)"],
  ["insert Brush Z before Decorators",
    "## Decorators (5)",
    MOD_PARAGRAPH + " (5)"],
]);

/* ---------------- MUUSIA-NODE-API.md ---------------- */

patch("docs/MUUSIA-NODE-API.md", [
  ["optional third point component documented",
    "- `pts` \u2014 array of `[x, y]` points in **millimetres**, canvas coordinates\n  (origin top-left, x \u2192 right, y \u2192 down). Canvas size comes from `ctx.W` / `ctx.H`.",
    "- `pts` \u2014 array of `[x, y]` points in **millimetres**, canvas coordinates\n  (origin top-left, x \u2192 right, y \u2192 down). Canvas size comes from `ctx.W` / `ctx.H`.\n- Points MAY carry an optional third component `[x, y, z]`: millimetres of\n  Z plunge below the machine profile's pen-down contact (written by Brush Z,\n  read by the G-code export as simultaneous Z moves, clamped to 6 mm). The\n  component is silently dropped by any modifier that maps `([x, y]) => ...`,\n  so pressure nodes must sit LAST in the chain. SVG export and preview\n  ignore it."],
]);

/* ---------------- MUUSIA-HANDOFF.md ---------------- */

patch("docs/MUUSIA-HANDOFF.md", [
  ["repo layout node counts",
    "- `src/defs/nodes/*.js` \u2014 one file per node, **186 files** (188 nodes total with\n  group + reititys; Generators 99, Modifiers 62).",
    "- `src/defs/nodes/*.js` \u2014 one file per node, **193 files** (195 nodes total with\n  group + reititys; Generators 105, Modifiers 63)."],
  ["node count check",
    "- Node count check: `ls src/defs/nodes | wc -l` (186) \u2014 the old",
    "- Node count check: `ls src/defs/nodes | wc -l` (193) \u2014 the old"],
  ["version history 2.35 + 2.36",
    "  Shared-geometry hardening: collinear-corner rounding no longer bulges a\n  half-circle (cornerize/cornerRound in Diagram + Road Map).",
    `  Shared-geometry hardening: collinear-corner rounding no longer bulges a
  half-circle (cornerize/cornerRound in Diagram + Road Map).
- **2.35** two nodes + AN ARCHITECTURE CHANGE. Nodes: **Spore Print** (mushroom
  gill anatomy: binary lamellula hierarchy, fade, dust, rim band, multi-cap
  sheets), **Brush Z** (mod/penout: brush pressure as the optional THIRD point
  component = mm plunge below pen-down; 8 waves along arc length, end taper,
  ghost width preview; must be last in chain). Architecture: **G-code export
  now reads the z component** (tools/patch-brushz-gcode.mjs, 5 anchored edits
  to toGcode) \u2014 draw moves become G1 X Y Z F so Klipper interpolates pressure
  continuously; activates purely by z presence, servo mode skips Z, 6 mm safety
  clamp, plain paths byte-identical. Physical brush test pending hardware.
- **2.36** five nodes: **Double Pendulum** (RK4 chaos traces, perturbation
  bundles, damping settles to rest \u2014 validated against physics invariants),
  **Gyroid** (TPMS slice contours + Retro Mesh camera; Surface Solid =
  ray-marched exact hidden lines against the implicit field, Solid output is a
  strict subset of Transparent with shared framing), **Cracked Paint**
  (hierarchical craquelure via BSP flakes, generation-width cracks, chips,
  edge curl), **Wave Hatch** (non-crossing noise seams + vertical stroke
  bands, negative-space waves), **Burr Cluster** (chained noise lobes, layered
  hatch, visible-edge bristle spikes, ink blots). Validator lessons this
  cycle: test against baked versions (caught a stale-lab-file bake once),
  independent oracles over screen-space proxies, and calibrate thresholds by
  measuring the node before asserting (gyroid iso sweep).`],
]);

/* ---------------- README.md ---------------- */

/* README anchors tolerate both the post-2.34 state and an older copy */
{
  let s = fs.readFileSync("README.md", "utf8");
  const tryEdit = (name, froms, to) => {
    for (const f of froms) {
      if (s.includes(f)) { s = s.replace(f, to); console.log("OK   README.md :: " + name); return; }
    }
    console.log("MISS README.md :: " + name);
    fails++;
  };
  tryEdit("version header", ["# MUUSIA v2.35", "# MUUSIA v2.34", "# MUUSIA v2.31"], "# MUUSIA v2.36");
  tryEdit("node count", ["**188 built-in nodes**", "**169 built-in nodes**"], "**195 built-in nodes**");
  fs.writeFileSync("README.md", s);
}

console.log(fails ? `\n${fails} MISSES \u2014 fix anchors before committing`
  : "\nALL PATCHES OK");
process.exit(fails ? 1 : 0);
