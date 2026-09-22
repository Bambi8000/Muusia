/* Era patch: documentation for Root Vegetables (rootveg).
   Run once from the repo root after baking + version bump:  node tools/era/patch-docs-rootveg.mjs
   Resolves docs/ paths, reads APP_VERSION from src/App.jsx, counts from src/defs/nodes.
   Anchored edits, MISS aborts before writing, SKIP if already applied. */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const find = (name) => { for (const d of ["docs", "."]) { const p = resolve(d, name); if (existsSync(p)) return p; } throw new Error("cannot find " + name); };
const NODES = find("MUUSIA-NODES.md"), TAGS = find("MUUSIA-TAGS.json"), HANDOFF = find("MUUSIA-HANDOFF.md");
const ver = (readFileSync(resolve("src/App.jsx"), "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!ver) { console.log("MISS APP_VERSION"); process.exit(1); }
const files = readdirSync(resolve("src/defs/nodes")).filter((f) => f.endsWith(".js"));
if (!files.includes("rootveg.js")) { console.log("MISS baked node src/defs/nodes/rootveg.js — bake first"); process.exit(1); }
const catOf = (f) => (readFileSync(resolve("src/defs/nodes", f), "utf8").match(/cat:\s*"(\w+)"/) || [])[1];
const nGen = files.filter((f) => catOf(f) === "gen").length, nMod = files.filter((f) => catOf(f) === "mod").length;
const nFiles = files.length, nTotal = nFiles + 2;

let nodes = readFileSync(NODES, "utf8"), tagsRaw = readFileSync(TAGS, "utf8"), handoff = readFileSync(HANDOFF, "utf8");
if (nodes.includes("**Root Vegetables** —")) { console.log("SKIP already applied"); process.exit(0); }
const report = []; let miss = false;
const rx = (text, re, repl, label) => { const hits = text.match(new RegExp(re.source, "gm")) || []; if (hits.length !== 1) { report.push("MISS " + label + " (" + hits.length + " hits)"); miss = true; return text; } report.push("OK   " + label); return text.replace(re, repl); };
const ins = (text, anchor, add, after, label) => { const parts = text.split(anchor); if (parts.length !== 2) { report.push("MISS " + label + " (" + (parts.length - 1) + " hits)"); miss = true; return text; } report.push("OK   " + label); return after ? parts[0] + anchor + add + parts[1] : parts[0] + add + anchor + parts[1]; };

nodes = rx(nodes, /^# MUUSIA v[\d.]+ — Node Reference$/m, "# MUUSIA v" + ver + " — Node Reference", "NODES header version");
nodes = rx(nodes, /^All \d+ built-in nodes\./m, "All " + nTotal + " built-in nodes.", "NODES total count");
nodes = rx(nodes, /^## Generators \(\d+\)$/m, "## Generators (" + nGen + ")", "NODES generator count");
nodes = rx(nodes, /^## Modifiers \(\d+\)$/m, "## Modifiers (" + nMod + ")", "NODES modifier count");
const PARA = `**Root Vegetables** — the Kosmos Botanika root cellar, Potato's companion:
*Kind* Carrot, Turnip, Swede, Sugar beet, Onion, Garlic, Leek, Cauliflower,
Cabbage, or Mix (a seeded shuffle that shows every kind before any repeats).
Each specimen is a botanical-plate outline built from a kind-specific
half-width profile along a vertical axis — carrot cone with a rounded
shoulder, flat turnip, necked swede, wedge beet, onion and garlic with a cut
neck, leek shaft, curd dome, leaf ball — roughened by *Irregularity* with
different harmonics on each side. *Texture* adds the lines that belong to the
kind: carrot ring scars, onion skin meridians, garlic clove ridges and papery
cracks, the beet's two grooves and wrinkles, leek shaft lines, cauliflower
curds, cabbage leaf edges and veins, and the purple shoulder of turnip and
swede on *Accent pen*. *Tops* Leaves draws feathery carrot tops, spoon leaves
on stems for turnip / swede / beet, hollow onion tubes, flat garlic and leek
blades, wrapping cauliflower and cabbage leaves (each blade with a midrib),
Cut stubs the trimmed stems; *Top length* scales them (never more than that
above the body). *Roots* hangs fine wandering root hairs from the right
places — an onion / garlic / leek tuft at the base, a carrot taproot tail with
lateral hairs, beet rootlets along the lower body, a turnip taproot — every
hair starting on the outline and never re-entering the body; *Root length*
scales them; cabbage and cauliflower are cut and have none. *Size* is the body
height exactly, *Size variation* scatters it downward; *Rotation* Upright /
Tilt (± *Tilt °*) / Random; *Placement* No overlap keeps whole specimens (tops
and roots included) apart by bounding box — a rejection sampler like Potato's,
so oversized requests fit fewer — Loose lets bodies touch. Pens: body,
*Accent*, *Tops*, *Roots*.

`;
nodes = ins(nodes, "## Generators (" + nGen + ")\n\n", PARA, true, "NODES paragraph (newest first)");

let tags; try { tags = JSON.parse(tagsRaw); } catch (e) { report.push("MISS TAGS parse"); miss = true; }
if (tags) {
  const vocab = new Set(Object.values(tags).flat());
  if (tags.rootveg) { report.push("MISS TAGS rootveg present"); miss = true; }
  else { const v = ["nature", "organic", "plants", "scatter"]; const bad = v.filter((t) => !vocab.has(t)); if (bad.length) { report.push("MISS TAGS unknown " + bad); miss = true; } else { tags.rootveg = v; report.push("OK   TAGS rootveg"); } }
  const sorted = {}; for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
  tagsRaw = JSON.stringify(sorted, null, 1) + "\n";
}

handoff = rx(handoff, /\*\*\d+ files\*\* \(\d+ nodes total/, "**" + nFiles + " files** (" + nTotal + " nodes total", "HANDOFF file/node counts");
handoff = rx(handoff, /Generators \d+, Modifiers \d+\)/, "Generators " + nGen + ", Modifiers " + nMod + ")", "HANDOFF category counts");
handoff = rx(handoff, /`ls src\/defs\/nodes \| wc -l` \(\d+\)/, "`ls src/defs/nodes | wc -l` (" + nFiles + ")", "HANDOFF wc count");
const HIST = `- **${ver}** **Root Vegetables** (gen/nature, \`rootveg\`) — Kosmos Botanika
  root cellar: nine kinds + Mix, half-width-profile bodies with asymmetric
  harmonics, kind-specific textures (accent shoulder on turnip / swede),
  Leaves / Cut stubs tops, Fray-lite root hairs that start on the outline and
  never re-enter the body, bbox rejection placement with 80 positions per
  grown specimen. Validator 178 checks (body height = Size exactly, roots on
  outline < 0.1 mm, bodies never intersect under No overlap, tops ≤ Top
  length × size, Mix cycles all nine kinds). Doc batch:
  tools/era/patch-docs-rootveg.mjs.

`;
handoff = ins(handoff, "## Hard-won pitfalls (keep)\n", HIST, false, "HANDOFF version history entry");

for (const l of report) console.log(l);
if (miss) { console.log("ABORT — nothing written"); process.exit(1); }
writeFileSync(NODES, nodes); writeFileSync(TAGS, tagsRaw); writeFileSync(HANDOFF, handoff);
console.log("DONE v" + ver + " — " + nTotal + " nodes (" + nFiles + " files; gen " + nGen + ", mod " + nMod + ")");
