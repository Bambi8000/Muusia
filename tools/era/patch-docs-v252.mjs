// tools/era/patch-docs-v252.mjs — doc batch for the v2.52 five-node release
// (loom, torn, op_tunnel, woven_ribbon, flow_traces).
// Anchored inserts + counts computed AT RUNTIME from src/defs/nodes (never from
// HANDOFF - the v2.48 lesson). Idempotent: SKIPs if already applied.
// Run from repo root: node tools/era/patch-docs-v252.mjs
import fs from "fs";

const NODES_MD = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";
let okc = 0, miss = 0, skip = 0;
const OK = (m) => { okc++; console.log("OK   " + m); };
const MISS = (m) => { miss++; console.log("MISS " + m); };
const SKIP = (m) => { skip++; console.log("SKIP " + m); };

// ---- counts from the filesystem (source of truth)
const files = fs.readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
let gens = 0, mods = 0;
for (const f of files) {
  const t = fs.readFileSync("src/defs/nodes/" + f, "utf8");
  if (/cat:\s*"gen"/.test(t)) gens++;
  else if (/cat:\s*"mod"/.test(t)) mods++;
}
const total = files.length + 2; // + engine-bound group & reititys in App.jsx
console.log(`counts from src/defs/nodes: ${files.length} files, gen ${gens}, mod ${mods}, total ${total}`);

let nd = fs.readFileSync(NODES_MD, "utf8");
let hd = fs.readFileSync(HANDOFF, "utf8");

if (nd.includes("**Flow Traces** —")) {
  SKIP("NODES.md already contains the v2.52 entries - nothing to do");
} else {
  // ---- new generator paragraphs, inserted at the end of the Generators section
  const GEN_BLOCK = `**Loom** — a dense woven mesh: warp (row) and weft (column) threads on a
regular grid; *Density* is the thread spacing in mm, auto-coarsened to the
point budget. *Drape* bends the fabric with low-frequency noise, *Shape noise*
adds finer rumple at its own scale, and *Drift* drags the whole cloth toward an
angle with a ramp across the sheet — all three are shared displacement fields,
so the two thread directions stay woven together. The intact companion of the
Torn modifier.

**Op Tunnel** — op-art perspective tunnel: an (optionally irregular) polygon is
split into wedge sectors from a vanishing point and each sector is striped
parallel to its outer edge with geometrically shrinking spacing — *Edge gap*
sets the stripe period at the rim and a per-sector ratio keeps rim density
uniform even off-center. *Depth %* is the center hole, *Fill step* hatches
every second band solid for the painted look, and *Glitches* punch seeded
rectangular patches where stripes shift half a period inward, flipping the
apparent color. VP X/Y place the vanishing point.

**Woven Ribbon** — a multi-track ribbon woven over and under itself: a seeded
lattice walk (no edge reused; an already-visited point is crossed straight
through, so crossings are always perpendicular) becomes a spine with exact
corner arcs, offset into a center line plus *Offset pairs* parallel tracks. At
every self-crossing the under pass is clipped by the full over-pass width plus
*Gap* — cover-underpasses weaving, so nothing in the output intersects
(validated). *Weave*: Alternate (basket parity), Later over, Earlier over;
*End caps* close the loose ends with nested semicircles.

**Flow Traces** — circuit-atlas routing: strictly self-avoiding traces walk an
orthogonal grid steered by a flow field — *Flow angle* plus *Swirl* around the
canvas center plus *Wave* (periodic side-urge that turns runs into square-wave
detours) plus *Turn bias*. Every lattice point is used at most once, so nothing
touches or crosses (validated). Corners are exact arcs; ends get terminals
(*Dots* double rings, *Rings*, *Pads*, *None*) with the centerline trimmed
back clear of its own terminal. Sibling of PCB Tracks — that one is octilinear
copper with pads, this one pure orthogonal flow.

`;
  const genAnchor = /\n## Modifiers \(\d+\)\n/;
  if (genAnchor.test(nd)) {
    nd = nd.replace(genAnchor, (m) => "\n" + GEN_BLOCK + m.slice(1));
    OK("NODES.md: 4 generator paragraphs inserted before ## Modifiers");
  } else MISS("NODES.md: ## Modifiers header not found");

  // ---- Torn paragraph at the end of the Modifiers section
  const TORN_BLOCK = `**Torn** — rips the wired paths open along a tear band: every crossing
deterministically *bridges* the gap as one straight span, is *flung* aside as a
coherent burst (*Fling* mm reach, *Chaos* angular spread), or *snaps* into two
spiky loose ends — *Fling %* / *Snap %* set the mix, the rest bridge. *Gape*
pushes intact geometry apart so the wound opens, *Ragged* roughens the edge,
*Detail* resamples the input first. Tearing is vertex-based: sparse inputs
(e.g. 2-point stripes from Op Tunnel) tear whole-segment with hard quantized
edges — raise Detail for smooth edge cuts; both are intended looks. Stack
several Torn nodes for multiple rips; classic pairings: Loom → Torn,
Op Tunnel → Torn.

`;
  const modAnchor = "\n## Routing (1)\n";
  if (nd.includes(modAnchor)) {
    nd = nd.replace(modAnchor, "\n" + TORN_BLOCK + "## Routing (1)\n");
    OK("NODES.md: Torn paragraph inserted before ## Routing");
  } else MISS("NODES.md: ## Routing header not found");

  // ---- counts + version in NODES.md (computed values, not deltas)
  if (/# MUUSIA v2\.51 — Node Reference/.test(nd)) {
    nd = nd.replace(/# MUUSIA v2\.51 — Node Reference/, "# MUUSIA v2.52 — Node Reference");
    OK("NODES.md: title bumped to v2.52");
  } else MISS("NODES.md: v2.51 title not found");
  if (/All \d+ built-in nodes/.test(nd)) {
    nd = nd.replace(/All \d+ built-in nodes/, `All ${total} built-in nodes`);
    OK(`NODES.md: total -> ${total}`);
  } else MISS("NODES.md: 'All N built-in nodes' not found");
  if (/## Generators \(\d+\)/.test(nd)) {
    nd = nd.replace(/## Generators \(\d+\)/, `## Generators (${gens})`);
    OK(`NODES.md: Generators -> ${gens}`);
  } else MISS("NODES.md: Generators header not found");
  if (/## Modifiers \(\d+\)/.test(nd)) {
    nd = nd.replace(/## Modifiers \(\d+\)/, `## Modifiers (${mods})`);
    OK(`NODES.md: Modifiers -> ${mods}`);
  } else MISS("NODES.md: Modifiers header not found");
  fs.writeFileSync(NODES_MD, nd);
}

// ---- HANDOFF: version history entry + layout/count updates
if (hd.includes("- **2.52**")) {
  SKIP("HANDOFF already has a 2.52 entry");
} else {
  const ENTRY = `- **2.52** five nodes, one release batch. **Loom** (gen/structural: draped
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

`;
  const pitfallAnchor = "\n## Hard-won pitfalls (keep)\n";
  if (hd.includes(pitfallAnchor)) {
    hd = hd.replace(pitfallAnchor, "\n" + ENTRY + "## Hard-won pitfalls (keep)\n");
    OK("HANDOFF: 2.52 version-history entry inserted");
  } else MISS("HANDOFF: pitfalls header anchor not found");

  const layoutRe = /\*\*\d+ files\*\* \((\s|\S)*?Generators \d+, Modifiers \d+\)/;
  if (layoutRe.test(hd)) {
    hd = hd.replace(layoutRe, `**${files.length} files** (${total} nodes total with\n  group + reititys; Generators ${gens}, Modifiers ${mods})`);
    OK(`HANDOFF: layout counts -> ${files.length} files / ${gens} gen / ${mods} mod`);
  } else MISS("HANDOFF: layout count pattern not found");

  const wcRe = /`ls src\/defs\/nodes \| wc -l` \(\d+\)/;
  if (wcRe.test(hd)) {
    hd = hd.replace(wcRe, `\`ls src/defs/nodes | wc -l\` (${files.length})`);
    OK(`HANDOFF: wc -l check -> ${files.length}`);
  } else MISS("HANDOFF: wc -l count pattern not found");
  fs.writeFileSync(HANDOFF, hd);
}

console.log(`\n${okc} OK, ${miss} MISS, ${skip} SKIP`);
process.exit(miss ? 1 : 0);
