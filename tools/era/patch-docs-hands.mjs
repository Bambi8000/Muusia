#!/usr/bin/env node
/* patch-docs-hands.mjs — the Hands documentation that v2.89 shipped without.
 *
 * Hands was baked and committed but its doc batch (patch-docs-v289.mjs) was
 * never run, so NODES.md has no Hands paragraph and TAGS.json no hands entry.
 * The Fish/Whale batch then set every count from disk, which is why the counts
 * are already correct and only the paragraph, the tag and the history are
 * missing. This patch adds exactly those, changes no count and no version, and
 * folds Hands into the existing v2.89 history entry — which is the truth:
 * all three creatures nodes went out in that build.
 *
 * One-shot, idempotent, anchored. Run from the repo root.
 */

import fs from "node:fs";
import path from "node:path";

let miss = 0;
const ok = (m) => console.log("OK   " + m);
const bad = (m) => { console.log("MISS " + m); miss++; };

const findFile = (name) => {
  for (const d of [".", "docs", "../docs"]) { const p = path.join(d, name); if (fs.existsSync(p)) return p; }
  return null;
};
const P_NODES = findFile("MUUSIA-NODES.md");
const P_TAGS = findFile("MUUSIA-TAGS.json");
const P_HAND = findFile("MUUSIA-HANDOFF.md");
const P_APP = fs.existsSync("src/App.jsx") ? "src/App.jsx" : findFile("App.jsx");
const NODEDIR = "src/defs/nodes";

for (const [n, p] of [["MUUSIA-NODES.md", P_NODES], ["MUUSIA-TAGS.json", P_TAGS], ["MUUSIA-HANDOFF.md", P_HAND], ["App.jsx", P_APP]]) {
  if (!p) { console.log("MISS cannot locate " + n + " — run from the repo root"); process.exit(1); }
}
if (!fs.existsSync(path.join(NODEDIR, "hands.js"))) { console.log("MISS src/defs/nodes/hands.js does not exist"); process.exit(1); }

const VERSION = (fs.readFileSync(P_APP, "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!VERSION) { console.log("MISS APP_VERSION not found"); process.exit(1); }
const files = fs.readdirSync(NODEDIR).filter((f) => f.endsWith(".js"));
const N_FILES = files.length, N_TOTAL = N_FILES + 2;
console.log(`     version ${VERSION}  files ${N_FILES}  registry ${N_TOTAL}`);

let nodesTxt = fs.readFileSync(P_NODES, "utf8");
let handTxt = fs.readFileSync(P_HAND, "utf8");
const tagsRaw = fs.readFileSync(P_TAGS, "utf8");
const tags = JSON.parse(tagsRaw);

if (nodesTxt.includes("**Hands** —") && tags.hands) { console.log("SKIP already applied — nothing to do"); process.exit(0); }

const swap = (txt, needle, repl, label) => {
  const parts = txt.split(needle);
  if (parts.length === 2) { ok(label); return parts.join(repl); }
  bad(label + " (" + (parts.length - 1) + " hits, need exactly 1)");
  return txt;
};

/* ---------- content ---------- */

const PARA = `**Hands** — anatomically proportioned arms and hands, each drawn as one
closed silhouette. The construction is a skeleton walk rather than a morph of
stock shapes: a palm with five jointed finger chains on anthropometric phalanx
ratios, knuckles set on an arc, and a forearm about 1.6x the hand length
tapering from elbow to wrist. The outline is traced once around that skeleton —
up the arm edge, around the thumb, finger by finger through the webs, back down
the far edge and across the cut end — so every hand is a single closed path and
routes, hatches and transforms downstream like any other outline. *Pose* picks
the shape: Relaxed, Spread, Point, Pinch, Claw, Wave, Flip the bird, Rock horns,
Half heart, or Mix, which rolls a different pose per hand from the seed; *Pose
jitter*, *Spread*, *Wrist bend* and *Elbow bend* vary it further, and *Which*
mirrors the whole thing between a left and a right hand. *Mutation %* slides
from believable anatomy toward AI-hand chaos — joints past their physiological
limits, knuckles off the arc, and past roughly half way fingers that duplicate,
vanish or cross — while *Detail %* sets outline point density on its own, so
angular low-poly and smooth-but-deformed are independent choices. *Arm length*
(Hand only / Forearm / Full arm), *Arm width*, *Cut end* (Flat or a rounded
Cuff) and *Nails* finish the anatomy, and *Size* scales the whole unit. Layout
Rows lays *Count* x *Rows* hands onto a grid loosened by *Jitter %*; Layout
Spine takes a wired path, where *Spine mount* either runs the arm Along it with
the hand at the far end, or sprouts hands perpendicular at *Spacing mm*
intervals — Left, Right, Both (alternate) or Both (random). Left and Right
follow the path's travel direction, the Fur convention, not the screen: a spine
drawn left to right puts Left above it.`;

const HIST_LEAD = `three new **creatures** generators. **Hands** (gen/creatures):
  anatomically proportioned arms and hands as single closed silhouettes built by
  a skeleton-to-outline walk (anthropometric phalanx ratios, knuckle arc,
  tapering forearm), ten poses including Mix, *Mutation %* sliding anatomy into
  AI-hand chaos independently of *Detail %* point density, Rows grid or a wired
  Spine with perpendicular mounts. It was written and validated at 84 checks in
  an earlier session but shipped only now: the lab file was graduated and
  deleted while the baked \`src/defs/nodes/hands.js\` was never staged, so commit
  eec9836 landed the validator alone and the node lived on only in the browser
  session that had imported it through Node ⇣. Recovered from the delivered lab
  file, re-baked, committed with \`git add -f\` on the explicit path. Lesson in
  the pitfalls. **Fish**`;

const PITFALL = `
- A GRADUATED LAB FILE IS NOT A SHIPPED NODE, AND A BAKED NODE IS NOT A
  DOCUMENTED ONE. \`bake.mjs\` writes \`src/defs/nodes/<key>.js\` and the lab file
  is deleted by hand afterwards; if the new file then misses \`git add\`, nothing
  complains. The app keeps working for the rest of the session because Node ⇣
  registered the def in memory, the validator keeps passing in baked mode, and
  the loss only surfaces when the node is missing from the palette after a
  refresh or a deploy. v${VERSION}: hands was validated at 84 checks, committed as
  "add hands validator, drop graduated lab file" with the node itself absent,
  and the source survived only as a chat attachment — \`nodes-lab/\` is not even
  gitignored, the file was simply never staged. Its doc batch was then deferred
  by one session and forgotten too, so the node sat in the build untagged until
  the next release's patch reported one node missing from TAGS.json. After every
  bake: \`ls -l src/defs/nodes/<key>.js\`, \`git add -f\` the explicit path, read
  \`git status --short\` for the \`A\` line, and run the doc batch in the same
  sitting.
`;

/* ---------- NODES.md: Hands goes below Fish, newest first ---------- */

nodesTxt = swap(nodesTxt, "so a point-budget cut removes scales before it removes fish.\n\n",
  "so a point-budget cut removes scales before it removes fish.\n\n" + PARA + "\n\n",
  "NODES.md Hands paragraph (below Fish)");

/* counts are read-only here: verify, never rewrite */
const sections = [...nodesTxt.matchAll(/^## [A-Za-z]+ \((\d+)\)$/gm)].map((m) => Number(m[1]));
const sum = sections.reduce((a, b) => a + b, 0);
if (sum !== N_TOTAL) bad(`NODES.md section headings sum to ${sum}, registry is ${N_TOTAL} — counts drifted, fix before shipping`);
else ok(`NODES.md counts already correct (${sum} = registry)`);

/* ---------- TAGS.json ---------- */

const VOCAB = new Set(Object.values(tags).flat());
const HANDS_TAGS = ["creature", "grid", "organic", "repeat"];
const unknown = HANDS_TAGS.filter((t) => !VOCAB.has(t));
if (unknown.length) bad("TAGS.json unknown tags: " + unknown.join(", "));
else { tags.hands = HANDS_TAGS; ok("TAGS.json hands entry -> " + HANDS_TAGS.join(", ")); }

const sortedTags = {};
for (const k of Object.keys(tags).sort()) sortedTags[k] = tags[k];
let tagsOut = JSON.stringify(sortedTags, null, 1);
if (tagsRaw.endsWith("\n")) tagsOut += "\n";
const nTags = Object.keys(sortedTags).length;
if (nTags !== N_TOTAL) bad(`TAGS.json would have ${nTags} entries against a registry of ${N_TOTAL} — another node is still untagged`);
else ok(`TAGS.json complete after this (${nTags} = registry)`);

/* ---------- HANDOFF ---------- */

handTxt = swap(handTxt, "two new **creatures** generators, siblings of Hands. **Fish**", HIST_LEAD,
  `HANDOFF v${VERSION} history entry now covers Hands`);
handTxt = swap(handTxt, "## Hard-won pitfalls (keep)\n", "## Hard-won pitfalls (keep)\n" + PITFALL,
  "HANDOFF pitfall entry");

/* ---------- write ---------- */

if (miss) { console.log(`\nABORTED — ${miss} MISS, nothing written.`); process.exit(1); }

fs.writeFileSync(P_NODES, nodesTxt);
fs.writeFileSync(P_TAGS, tagsOut);
fs.writeFileSync(P_HAND, handTxt);
console.log(`\nDONE — Hands documented under v${VERSION}.`);
