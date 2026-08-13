/* patch-docs-4nodes-gulltracks-inkburst-ripplechain-moiredisc.mjs
   ONE-SHOT era patch - do not re-run (SKIP guard included).
   Run from repo root AFTER the version bump: node tools/era/patch-docs-4nodes-gulltracks-inkburst-ripplechain-moiredisc.mjs
   - Reads APP_VERSION from src/App.jsx at runtime (never hardcoded)
   - Recomputes ALL node counts from the live filesystem (src/defs/nodes)
   - Appends 4 node paragraphs to docs/MUUSIA-NODES.md (3 gen before "## Modifiers", 1 dec before "## Combiners")
   - Patches every section count + header version + HANDOFF repo-layout counts
   - Prepends a version-history entry to docs/MUUSIA-HANDOFF.md before "## Hard-won pitfalls" */
import fs from "fs";

const report = [];
const okr = (t) => report.push("OK   " + t);
const miss = (t) => report.push("MISS " + t);
let failed = false;

const NODES_MD = "docs/MUUSIA-NODES.md";
const HANDOFF_MD = "docs/MUUSIA-HANDOFF.md";
let nodesDoc = fs.readFileSync(NODES_MD, "utf8");
let handoff = fs.readFileSync(HANDOFF_MD, "utf8");

/* ---- SKIP guard ---- */
if (nodesDoc.includes("**Gull Tracks**")) {
  console.log("SKIP: docs already contain Gull Tracks - this one-shot has been applied. Nothing written.");
  process.exit(0);
}

/* ---- live state ---- */
const vm = fs.readFileSync("src/App.jsx", "utf8").match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS APP_VERSION in src/App.jsx - aborting, nothing written."); process.exit(1); }
const VERSION = vm[1];
okr(`APP_VERSION read from repo: ${VERSION}`);

const files = fs.readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
const cats = { gen: 0, mod: 0, dec: 0, duo: 0, math: 0 };
for (const f of files) {
  const m = fs.readFileSync("src/defs/nodes/" + f, "utf8").match(/cat:\s*"(\w+)"/);
  if (m && cats[m[1]] !== undefined) cats[m[1]]++;
}
const TOTAL = files.length;
okr(`live counts: ${TOTAL} files | gen ${cats.gen}, mod ${cats.mod}, dec ${cats.dec}, duo ${cats.duo}, math ${cats.math}`);
for (const key of ["gull_tracks", "ink_burst", "ripple_chain", "moire_disc"]) {
  if (!files.includes(key + ".js")) { miss(`baked node src/defs/nodes/${key}.js not found - bake before docs`); failed = true; }
}

/* ---- new paragraphs ---- */
const GEN_PARAS = `**Gull Tracks** — seagull footprint trails on wet sand: seeded walks that steer
themselves back inside the margin box, steps alternating left/right at Straddle
width, each webbed three-toe print turned slightly inward (Toe-in) like the real
bird. Every print is unique — Variation jitters toe angles, lengths, curvatures
and the web attach points per print (0 = identical stamps). Web sag pulls the
webbing toward the heel; Hind toe adds the tiny rear hallux mark. Several nodes
at different Foot sizes reads like a whole flock came through.

**Ink Burst** — a decalcomania squash print: dense radial filaments around a
blank core void, bent together into suction channels by a coherent noise field
and torn into lens gaps by Breakup; beyond the body, Tendrils launch outward
with long-tail lengths (Reach), curl as they go, and each ends in an ink droplet
drawn as the SAME continuous stroke — stem flows into an inward spiral fill, one
pen-down per tendril. Beads dot the stems, stray blobs spatter the mid ring,
Aspect ovals the burst, Edge roughens the outline. Loves a thick pen.

**Moire Disc** — one disc filled with fine regular structure, built to be
overlapped: Rings, Spiral (one continuous line), Spokes, Hatch, Mesh, Hex / Grid
/ Random packed circles (optionally concentric via Circle rings) or Phyllotaxis.
Pitch is the spacing, Angle rotates the pattern, Disorder morphs order toward
chaos — and content never leaks outside the disc, so overlaps stay clean. Drop
two with Pitch off by 5%, Angle off by 2-5 degrees or centers a few mm apart and
the interference becomes moire; every knob has a value port, so Frame-driven
moire breathes through an animation.

`;
const DEC_PARA = `**Ripple Chain** — chains of concentric ring clusters strung along the input
path like beads. The walk stamps a cluster every 2 x radius x Spacing (1 =
touching); size breathes via a slow Wave along the path, long-tail per-cluster
Variation, and — when a curve is wired into the Amplitude input — an envelope
sampled from that curve's deviation, so Sound Line's waveform drives ring sizes
along the path. Ring gap, Hollow core, per-ring Drift, Scatter off the path and
Satellite companion rings shape the look. The point budget is shared between
input paths by arc length and an oversubscribed path thins evenly along its
whole length — large radii never leave loops or tails blank.

`;

/* ---- NODES.md edits ---- */
const modAnchor = nodesDoc.match(/\n## Modifiers \(\d+\)/);
if (modAnchor) {
  nodesDoc = nodesDoc.replace(modAnchor[0], "\n" + GEN_PARAS.trimEnd() + "\n" + modAnchor[0]);
  okr("3 generator paragraphs inserted before '## Modifiers'");
} else { miss("anchor '## Modifiers (N)' in NODES.md"); failed = true; }

const combAnchor = nodesDoc.match(/\n## Combiners \(\d+\)/);
if (combAnchor) {
  nodesDoc = nodesDoc.replace(combAnchor[0], "\n" + DEC_PARA.trimEnd() + "\n" + combAnchor[0]);
  okr("Ripple Chain paragraph inserted before '## Combiners'");
} else { miss("anchor '## Combiners (N)' in NODES.md"); failed = true; }

const countPatches = [
  [/# MUUSIA v[\d.]+ — Node Reference/, `# MUUSIA v${VERSION} — Node Reference`],
  [/All \d+ built-in nodes/, `All ${TOTAL} built-in nodes`],
  [/## Generators \(\d+\)/, `## Generators (${cats.gen})`],
  [/## Modifiers \(\d+\)/, `## Modifiers (${cats.mod})`],
  [/## Decorators \(\d+\)/, `## Decorators (${cats.dec})`],
  [/## Combiners \(\d+\)/, `## Combiners (${cats.duo})`],
  [/## Math \(\d+\)/, `## Math (${cats.math})`],
];
for (const [re, rep] of countPatches) {
  if (re.test(nodesDoc)) { nodesDoc = nodesDoc.replace(re, rep); okr(`count patched: ${rep}`); }
  else miss(`count line ${re}`);
}

/* ---- HANDOFF edits ---- */
const histEntry = `- **${VERSION}** Four nodes in one session. **Gull Tracks** (gen/creatures):
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

`;
const pitAnchor = "\n## Hard-won pitfalls (keep)";
if (handoff.includes(pitAnchor)) {
  handoff = handoff.replace(pitAnchor, "\n" + histEntry.trimEnd() + "\n" + pitAnchor);
  okr("HANDOFF version-history entry inserted before '## Hard-won pitfalls'");
} else { miss("anchor '## Hard-won pitfalls (keep)' in HANDOFF"); failed = true; }

const layoutRe = /\*\*\d+ files\*\* \(\d+ nodes total with\n?\s*group \+ reititys; Generators \d+, Modifiers \d+\)/;
if (layoutRe.test(handoff)) {
  handoff = handoff.replace(layoutRe, `**${TOTAL} files** (${TOTAL + 2} nodes total with\n  group + reititys; Generators ${cats.gen}, Modifiers ${cats.mod})`);
  okr(`HANDOFF repo-layout counts patched: ${TOTAL} files / ${TOTAL + 2} total`);
} else miss("HANDOFF repo-layout count line (non-critical)");

/* ---- write only if all critical anchors hit ---- */
console.log(report.join("\n"));
if (failed) {
  console.log("\nCRITICAL MISS - nothing written. Check anchors against the working copy.");
  process.exit(1);
}
fs.writeFileSync(NODES_MD, nodesDoc);
fs.writeFileSync(HANDOFF_MD, handoff);
console.log(`\nWROTE ${NODES_MD} and ${HANDOFF_MD} for v${VERSION}.`);
