/* patch-docs-counts-api.mjs — three corrections found while shipping v2.65.
 *
 * 1. NODES.md counts were wrong in two ways and one of them was introduced by
 *    patch-docs-meshslice.mjs: "All N built-in nodes." was written as the
 *    src/defs/nodes FILE count, which silently excludes the two engine-bound
 *    DEFS entries (group, reititys) that live inline in App.jsx — and the
 *    Combiners heading never counted Group either, so the section headings
 *    summed to one less than the real registry. Every count is now computed
 *    from disk: files by cat, plus the inline entries parsed out of App.jsx.
 *
 * 2. MUUSIA-NODE-API.md never said that the file PICKER comes from a
 *    `type: "file"` param row. onFile/fileBinary/fileAccept/fileLabel are all
 *    definition-level and a node can declare every one of them and still show
 *    an inspector with no way to load anything (v2.65 Mesh Slice shipped that
 *    way to the browser and only a user question caught it).
 *
 * 3. MUUSIA-HANDOFF.md: era scripts must RESOLVE doc paths. The docs live in
 *    docs/, which HANDOFF already states — patch-docs-meshslice.mjs still
 *    assumed the repo root and MISS-aborted on the first run. Also refreshes
 *    the stale file/node counts in Repo layout and corrects the file-delivery
 *    bullet, which describes a workflow abandoned in v2.62.
 *
 * Anchored, MISS-aborts, idempotent (SKIP when already applied).
 * Usage: node tools/era/patch-docs-counts-api.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const NODES_DIR = "src/defs/nodes";
const APP = "src/App.jsx";

const SKIP = new Set(["node_modules", ".git", "dist", "build", "nodes-lab", ".vite"]);
const findFile = (name, dir, depth) => {
  if (depth > 3) return null;
  let ents;
  try { ents = readdirSync(dir); } catch (e) { return null; }
  if (ents.includes(name)) return join(dir, name);
  for (const e of ents) {
    if (SKIP.has(e) || e.startsWith(".")) continue;
    let st;
    try { st = statSync(join(dir, e)); } catch (err) { continue; }
    if (!st.isDirectory()) continue;
    const hit = findFile(name, join(dir, e), depth + 1);
    if (hit) return hit;
  }
  return null;
};
const resolve = (name) => {
  const hit = findFile(name, ".", 0);
  if (!hit) {
    console.error("MISS: " + name + " not found anywhere under the repo - aborting, nothing written");
    process.exit(1);
  }
  return hit;
};

if (!existsSync(APP) || !existsSync(NODES_DIR)) {
  console.error("MISS: " + APP + " / " + NODES_DIR + " not found - run this from the repo root");
  process.exit(1);
}
const MD = resolve("MUUSIA-NODES.md");
const API = resolve("MUUSIA-NODE-API.md");
const HANDOFF = resolve("MUUSIA-HANDOFF.md");
console.log("  docs: " + MD + ", " + API + ", " + HANDOFF);

/* ---------- counts from disk ---------- */
const SECTION = { gen: "Generators", mod: "Modifiers", dec: "Decorators", duo: "Combiners", math: "Math", route: "Routing" };
const counts = {};
const files = readdirSync(NODES_DIR).filter((f) => f.endsWith(".js"));
for (const f of files) {
  const m = readFileSync(NODES_DIR + "/" + f, "utf8").match(/\bcat:\s*"([a-z]+)"/);
  if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
}
const appSrc = readFileSync(APP, "utf8");
const inline = [...appSrc.matchAll(/name:\s*"([^"]+)",\s*cat:\s*"([a-z]+)"/g)].map((m) => ({ name: m[1], cat: m[2] }));
if (inline.length < 1 || inline.length > 5) {
  console.error("MISS: expected 1-5 inline DEFS entries in " + APP + ", found " + inline.length + " - aborting, nothing written");
  process.exit(1);
}
for (const e of inline) counts[e.cat] = (counts[e.cat] || 0) + 1;
const TOTAL = Object.values(counts).reduce((a, b) => a + b, 0);
console.log("  registry: " + files.length + " node files + " + inline.length + " inline (" + inline.map((e) => e.name).join(", ") + ") = " + TOTAL);
console.log("  by section: " + Object.entries(counts).map(([c, n]) => (SECTION[c] || c) + " " + n).join(", "));

let md = readFileSync(MD, "utf8");
let api = readFileSync(API, "utf8");
let handoff = readFileSync(HANDOFF, "utf8");

const API_SENTINEL = "the picker itself comes from a `type: \"file\"` param row";
if (api.includes(API_SENTINEL) && handoff.includes("resolve doc paths")) {
  console.log("SKIP: already applied");
  process.exit(0);
}

/* ---------- 1. NODES.md counts ---------- */
const allRe = /^All \d+ built-in nodes\./m;
if (!allRe.test(md)) {
  console.error("MISS: NODES.md 'All N built-in nodes.' line not found - aborting, nothing written");
  process.exit(1);
}
md = md.replace(allRe, "All " + TOTAL + " built-in nodes.");
for (const [cat, name] of Object.entries(SECTION)) {
  if (!counts[cat]) continue;
  const re = new RegExp("^## " + name + " \\(\\d+\\)$", "m");
  if (!re.test(md)) {
    console.error("MISS: NODES.md heading '## " + name + " (N)' not found - aborting, nothing written");
    process.exit(1);
  }
  md = md.replace(re, "## " + name + " (" + counts[cat] + ")");
}

/* ---------- 2. NODE-API.md file-picker note ---------- */
const API_ANCHOR = "| `file` | — | File picker; pair with `onFile`. |";
if (md.length && api.split(API_ANCHOR).length - 1 !== 1) {
  console.error("MISS: NODE-API.md '| `file` |' table row not found or not unique - aborting, nothing written");
  process.exit(1);
}
const API_ROW = "| `file` | — | File picker; pair with `onFile`. **This row is what renders the picker.** `onFile`, `fileBinary`, `fileAccept` and `fileLabel` are all definition-level and none of them creates a button: a node declaring every one of them but no `type: \"file\"` param opens an inspector with no way to load anything (v2.65 Mesh Slice reached the browser like that). |";
api = api.replace(API_ANCHOR, API_ROW);

const NOTE_ANCHOR = "\n**Pins:** create with `Pin(type, label?)`";
if (api.split(NOTE_ANCHOR).length - 1 !== 1) {
  console.error("MISS: NODE-API.md '**Pins:**' anchor not found or not unique - aborting, nothing written");
  process.exit(1);
}
const NOTE = `
**File intake needs two halves.** The definition-level fields above configure how
a file is read (\`onFile\`, \`fileBinary\`, \`fileImage\`, \`fileAccept\`, \`fileLabel\`),
but the picker itself comes from a \`type: "file"\` param row in \`params\`. Declare
both, or the node loads nothing and gives no clue why — validators should assert
the param exists rather than trusting the definition fields.
`;
api = api.replace(NOTE_ANCHOR, "\n" + NOTE + NOTE_ANCHOR);

/* ---------- 3. HANDOFF ---------- */
const cntRe = /\*\*\d+ files\*\* \(\d+ nodes total with\n  group \+ reititys; Generators \d+, Modifiers \d+\)/;
if (!cntRe.test(handoff)) {
  console.error("MISS: HANDOFF repo-layout count sentence not found - aborting, nothing written");
  process.exit(1);
}
handoff = handoff.replace(
  cntRe,
  "**" + files.length + " files** (" + TOTAL + " nodes total with\n  group + reititys, which are Combiners/Routing entries defined inline in\n  App.jsx and therefore absent from this directory — every count in\n  NODES.md includes them, so a bare `ls | wc -l` is always two short;\n  Generators " + (counts.gen || 0) + ", Modifiers " + (counts.mod || 0) + ")"
);

const ERA_ANCHOR = `  script in tools/era/ (patch-docs-vXXX.mjs) with OK/MISS/SKIP reporting —
  no manual file surgery. Run once from the repo root, commit the script
  with the docs.`;
if (handoff.split(ERA_ANCHOR).length - 1 !== 1) {
  console.error("MISS: HANDOFF era-script bullet not found or not unique - aborting, nothing written");
  process.exit(1);
}
handoff = handoff.replace(
  ERA_ANCHOR,
  `  script in tools/era/ (patch-docs-vXXX.mjs) with OK/MISS/SKIP reporting —
  no manual file surgery. Run once from the repo root, commit the script
  with the docs. Scripts must **resolve doc paths** (search for
  MUUSIA-*.md/.json rather than assuming the repo root — they live in
  \`docs/\`) and must **compute counts and versions from disk** (APP_VERSION
  read from App.jsx, node counts from src/defs/nodes plus the inline pair);
  a hardcoded path or version is how a doc batch either MISS-aborts or,
  worse, files an entry under the wrong release.`
);

const DELIV_ANCHOR = `- **File delivery:** Daniel moves downloaded lab nodes to nodes-lab/ and
  validators to tools/ himself; sessions deliver files + commands only, no
  cp-from-Downloads sequences.`;
if (handoff.split(DELIV_ANCHOR).length - 1 === 1) {
  handoff = handoff.replace(
    DELIV_ANCHOR,
    `- **File delivery (revised v2.62):** Daniel downloads to ~/Downloads and the
  session's command block does the moving — a find-based \`mv\` into
  nodes-lab/, tools/ and tools/era/, chained straight into validation and
  bake, so no step is left to hand.`
  );
  console.log("  OK  HANDOFF file-delivery bullet refreshed (described the pre-2.62 workflow)");
} else {
  console.log("  --  HANDOFF file-delivery bullet already revised or reworded, left alone");
}

writeFileSync(MD, md);
writeFileSync(API, api);
writeFileSync(HANDOFF, handoff);
console.log("  OK  " + MD + " (All " + TOTAL + ", section headings recomputed)");
console.log("  OK  " + API + " (file-picker requirement)");
console.log("  OK  " + HANDOFF + " (counts, era-script path/version rule)");
console.log("APPLIED: counts + API + conventions");
