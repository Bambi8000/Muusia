/* Era patch: version bump + documentation batch for the Hair Web node
   (hairweb). Run from the repo root AFTER baking - node counts are read from
   src/defs/nodes. Anchored exact-string / single-match regex edits; MISS aborts
   before anything is written; SKIP if already applied. Edits:
     src/App.jsx           APP_VERSION  x.N -> x.(N+1)   (read from the repo)
     docs/MUUSIA-TAGS.json 1 entry, existing vocabulary only, keys kept sorted
     docs/MUUSIA-NODES.md  header version, total, section counts, 1 paragraph
     docs/MUUSIA-HANDOFF.md file/node counts, version-history entry            */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const F_APP = "src/App.jsx", F_TAGS = "docs/MUUSIA-TAGS.json", F_NODES = "docs/MUUSIA-NODES.md", F_HAND = "docs/MUUSIA-HANDOFF.md";
let app = readFileSync(F_APP, "utf8"), tagsTxt = readFileSync(F_TAGS, "utf8"), nodes = readFileSync(F_NODES, "utf8"), hand = readFileSync(F_HAND, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

/* ---- idempotence sentinel: the NODES.md paragraph that only exists after this patch ---- */
if (nodes.includes("**Hair Web** —")) { console.log("SKIP  patch-docs-hairweb already applied (sentinel found)"); process.exit(0); }

/* ---- facts from the repo ---- */
const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V_OLD = vm[1] + "." + vm[2], V_NEW = vm[1] + "." + (parseInt(vm[2], 10) + 1);
console.log("INFO  version " + V_OLD + " -> " + V_NEW);
const KEYS = ["hairweb"];
const files = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
for (const k of KEYS) if (!files.includes(k + ".js")) { console.log("MISS  src/defs/nodes/" + k + ".js not baked yet - ABORT"); process.exit(1); }
const cats = { gen: 0, mod: 0 };
for (const f of files) { const s = readFileSync("src/defs/nodes/" + f, "utf8"); const c = s.match(/\bcat:\s*"(\w+)"/); if (c && cats[c[1]] !== undefined) cats[c[1]]++; }
const N_FILES = files.length, N_TOTAL = N_FILES + 2;   /* group + reititys live inline in App.jsx */
console.log("INFO  files " + N_FILES + ", nodes " + N_TOTAL + ", gen " + cats.gen + ", mod " + cats.mod);

/* ---- helpers ---- */
const one = (src, old, neu, name) => { const parts = src.split(old); if (parts.length === 2) { OK(name); return parts.join(neu); } MISS(name + (parts.length === 1 ? " (anchor not found)" : " (anchor not unique: " + (parts.length - 1) + " hits)")); return src; };
const oneRe = (src, re, neu, name) => { const hits = src.match(new RegExp(re.source, re.flags.replace("g", "") + "g")) || []; if (hits.length === 1) { OK(name); return src.replace(re, neu); } MISS(name + " (regex hits: " + hits.length + ")"); return src; };
const wrap = (t, w = 78, indent = "") => { const words = t.replace(/\s+/g, " ").trim().split(" "); const lines = []; let cur = ""; for (const wd of words) { const lim = lines.length ? w - indent.length : w; if ((cur + " " + wd).trim().length > lim && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); } if (cur) lines.push(cur); return lines.map((l, i) => (i ? indent + l : l)).join("\n"); };

/* ---- 1. App.jsx version ---- */
app = one(app, 'APP_VERSION = "' + V_OLD + '"', 'APP_VERSION = "' + V_NEW + '"', "App.jsx APP_VERSION " + V_OLD + " -> " + V_NEW);

/* ---- 2. TAGS.json: parse, add, re-serialise sorted with the file's 1-space indent ---- */
const TAGS_NEW = {
  hairweb: ["connect", "noise", "organic", "scatter", "texture"],
};
let tags;
try { tags = JSON.parse(tagsTxt); } catch (e) { MISS("TAGS.json does not parse"); tags = null; }
if (tags) {
  const vocab = new Set(Object.values(tags).flat());
  let bad = 0;
  for (const [k, v] of Object.entries(TAGS_NEW)) {
    if (tags[k]) { MISS("TAGS.json already has " + k); bad++; continue; }
    const unknown = v.filter((t) => !vocab.has(t));
    if (unknown.length) { MISS("TAGS.json unknown tag(s) for " + k + ": " + unknown.join(",")); bad++; continue; }
    tags[k] = v;
  }
  if (!bad) { const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k]; tagsTxt = JSON.stringify(sorted, null, 1) + "\n"; OK("TAGS.json +1 entry (vocabulary " + vocab.size + " tags, unchanged)"); }
}

/* ---- 3. NODES.md ---- */
nodes = oneRe(nodes, /^# MUUSIA v\d+\.\d+ — Node Reference$/m, "# MUUSIA v" + V_NEW + " — Node Reference", "NODES.md header version");
nodes = oneRe(nodes, /^All \d+ built-in nodes\./m, "All " + N_TOTAL + " built-in nodes.", "NODES.md total count -> " + N_TOTAL);
nodes = oneRe(nodes, /^## Generators \(\d+\)$/m, "## Generators (" + cats.gen + ")", "NODES.md Generators count -> " + cats.gen);
nodes = oneRe(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + cats.mod + ")", "NODES.md Modifiers count -> " + cats.mod);

const GEN_PARAS = [
  `**Hair Web** — a tangle of thousands of hairline arcs strung between anchor points: dark star bursts where the strands meet and a grey haze between, after the pen-plotter network drawings where every connection is one thin curve. Anchors: *Layout* Grid (*Columns* × *Rows*, *Jitter*), Random (*Count*, kept apart) or Ring (*Count*), pulled in from the edge by *Anchor inset* so the outer arcs have room. *Strands* sets how many arcs are drawn. Each strand is a cubic curve from one anchor to another, bowed sideways by *Bulge* (× distance) with *Bulge variation*; *S-curves* turns a share into twisted S-shapes, *Loops* sends a share out of an anchor and back into it as a petal. *Locality* prefers nearby partners (0 = any anchor, 1 = neighbours only), *Hubs* makes some anchors far busier than others so a few nodes go black. *Light share* draws that fraction of strands on the *Light pen* for depth. Every strand starts and ends exactly on an anchor, consecutive strands run in opposite directions, and a strand that would leave *Margin* is redrawn with a smaller bow rather than clipped. Seeded; wire Frame into *Seed* for a boiling animation. Pen choice matters: 0.1–0.2 mm keeps the haze grey, a broad nib needs far fewer strands.`,
];
const MOD_PARAS = [];
const genAnchor = "## Generators (" + cats.gen + ")\n\n";
const modAnchor = "## Modifiers (" + cats.mod + ")\n\n";
nodes = one(nodes, genAnchor, genAnchor + GEN_PARAS.map((t) => wrap(t)).join("\n\n") + "\n\n", "NODES.md +1 generator paragraph");
void modAnchor;

/* ---- 4. HANDOFF.md counts + version entry ---- */
hand = oneRe(hand, /one file per node, \*\*\d+ files\*\* \(\d+ nodes total with/, "one file per node, **" + N_FILES + " files** (" + N_TOTAL + " nodes total with", "HANDOFF repo-layout counts");
hand = oneRe(hand, /Node count check: `ls src\/defs\/nodes \| wc -l` \(\d+\)/, "Node count check: `ls src/defs/nodes | wc -l` (" + N_FILES + ")", "HANDOFF node-count check");
const entry = (`- **${V_NEW}** New node **Hair Web** (\`hairweb\`, organic; ${N_TOTAL} nodes, ${cats.gen} generators): thousands of hairline cubic-Bezier arcs between anchors (Grid / Random / Ring with weights), Bulge ± variation, S-curves, petal Loops back into the same anchor, Locality (distance falloff on neighbour spacing, 1 = neighbours only), Hubs (weight = rng^(3·hubs)), Light share on a second pen, strands redrawn with a smaller bow instead of clipped at the margin, alternating direction for pen travel. \`_anchors()\` shared by compute + overlay (points). Validator tools/validate-hairweb.mjs (59 checks): endpoints on anchors, loop share, straight-chord / bow oracles, locality-1 neighbour test (either end may be the origin since strands alternate direction), hub unevenness, light-share fraction. Docs era: tools/era/patch-docs-hairweb.mjs.`);
hand = one(hand, "\n## Hard-won pitfalls (keep)", "\n" + wrap(entry, 78, "  ") + "\n\n## Hard-won pitfalls (keep)", "HANDOFF version-history entry " + V_NEW);

/* ---- write only if everything landed ---- */
if (miss > 0) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_APP, app); writeFileSync(F_TAGS, tagsTxt); writeFileSync(F_NODES, nodes); writeFileSync(F_HAND, hand);
console.log("DONE  " + ok + " edits applied: " + [F_APP, F_TAGS, F_NODES, F_HAND].join(", "));
