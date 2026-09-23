/* Era docs patch for the Card Sheet node (cardsheet).
   Run from the repo root AFTER `node tools/bake.mjs cardsheet`:
     node tools/era/patch-docs-cardsheet.mjs
   All counts come from the filesystem, the version from src/App.jsx.
   Idempotent (SKIP on sentinel), MISS-aborts before writing anything.

   Touches: docs/MUUSIA-NODES.md (header version, total count, Combiners count,
   new paragraph at the end of Combiners), docs/MUUSIA-TAGS.json (one entry,
   existing vocabulary only, keys kept sorted), docs/MUUSIA-HANDOFF.md (file /
   node counts, version-history entry), src/App.jsx (APP_VERSION +1). */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const FILES = { nodes: "docs/MUUSIA-NODES.md", tags: "docs/MUUSIA-TAGS.json", handoff: "docs/MUUSIA-HANDOFF.md", app: "src/App.jsx" };
const src = {};
for (const k of Object.keys(FILES)) src[k] = readFileSync(FILES[k], "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.nodes.includes("**Card Sheet** —")) { console.log("SKIP  Card Sheet paragraph already present"); process.exit(0); }
if (!existsSync("src/defs/nodes/cardsheet.js")) { console.log("MISS  src/defs/nodes/cardsheet.js not baked yet - run node tools/bake.mjs cardsheet first - ABORT"); process.exit(1); }

/* --- facts from disk --- */
const files = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
const nFiles = files.length;
const nTotal = nFiles + 2;                 /* group + reititys are inline in App.jsx */
const catCount = (cat) => files.filter((f) => new RegExp('cat:\\s*"' + cat + '"').test(readFileSync("src/defs/nodes/" + f, "utf8"))).length;
const nDuo = catCount("duo"), nComb = catCount("comb");
const nCombiners = nDuo + nComb + 1;      /* + Group (inline) */
const vm = src.app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1], vp = V.split(".");
if (vp.length !== 2 || !/^\d+$/.test(vp[1])) { console.log("MISS  APP_VERSION '" + V + "' not major.minor - ABORT"); process.exit(1); }
const V2 = vp[0] + "." + (parseInt(vp[1], 10) + 1);
console.log(`INFO  files ${nFiles} -> total ${nTotal}; duo ${nDuo} + comb ${nComb} + Group = Combiners ${nCombiners}; version ${V} -> ${V2}`);

/* --- NODES.md --- */
const hdr = src.nodes.match(/^# MUUSIA v([^ ]+) — Node Reference/m);
if (hdr) { src.nodes = src.nodes.replace(hdr[0], "# MUUSIA v" + V2 + " — Node Reference"); OK("NODES.md header " + hdr[1] + " -> " + V2); } else MISS("NODES.md header");
const tot = src.nodes.match(/^All (\d+) built-in nodes\./m);
if (tot) { src.nodes = src.nodes.replace(tot[0], "All " + nTotal + " built-in nodes."); OK("NODES.md total " + tot[1] + " -> " + nTotal); } else MISS("NODES.md total count");
const comb = src.nodes.match(/^## Combiners \((\d+)\)/m);
if (comb) { src.nodes = src.nodes.replace(comb[0], "## Combiners (" + nCombiners + ")"); OK("NODES.md Combiners " + comb[1] + " -> " + nCombiners); } else MISS("NODES.md Combiners header");

const PARA = `**Card Sheet** — imposition for postcards and folded cards, both sides of the
paper. A grid of cards (*Card width/height*, *Columns*, *Rows*, *Gap*, *Sheet
margin*; cards that do not fit are dropped and the overlay shows the grid that
did) is laid on the sheet and a full-canvas composition is scaled into each
card face as in Mini Canvas — *Scaling*: Fit, Fill (crop), Stretch, Rotate 90 +
Fit / Fill. *Fold* None gives a flat postcard with Front and Back pins;
Vertical or Horizontal folds the card in the middle and the pins become Cover,
Back cover and the two inside faces (Inside L/R or Inside top/bottom). The
outside of a horizontal-fold card is laid out the way the paper works: cover on
top, upside down, so it reads upright once the card is folded. Two-sided work
runs through *Side*: plot Front (outside), turn the sheet, switch to Back
(inside), plot again. The back layout is derived, never typed — the face behind
each panel is its real partner (behind the cover sits the inside page you see
when you open the card) and the sheet is mirrored according to *Flip axis*:
Vertical axis for turning the sheet like a page (columns swap, artwork upright),
Horizontal axis for turning it end over end (rows swap and everything turns
180°). Registration marks print at identical sheet coordinates on both sides and
are symmetric under both flips. Three ways to nail the back to the front:
*Back offset X/Y* shifts back-side content only (read it off the Duplex test);
*Trim frame* draws one outline around the whole grid — cut the sheet to it after
the front and the sheet edges become plotter-accurate, so the back registers
against them; *Pin holes* marks two 6 mm hole centres on the flip axis in the
waste margin for pin registration, which makes the paper's cut tolerance
irrelevant. *Mode* Duplex test replaces the content with vernier scales at four
points — front ticks 1.00 mm apart above the baseline, back ticks 1.10 mm below
it; hold the sheet against the light with the back facing you and the pair that
lines up, k ticks from the centre toward the arrow, means Back offset = 0.1·k
mm on that axis. Trim marks, fold ticks or dashed fold lines and panel frames go
on the Mark pen. Compare **Zine** (booklet imposition, page order by folds) and
**Mini Canvas** (contact sheets and one-sided production runs).

`;
if (src.nodes.includes("\n## Math (")) { src.nodes = src.nodes.replace("\n## Math (", "\n" + PARA + "## Math ("); OK("NODES.md Card Sheet paragraph inserted at the end of Combiners"); } else MISS("NODES.md '## Math (' anchor");
/* the paragraph above ends with a blank line and the replacement keeps the blank line before ## Math */
src.nodes = src.nodes.replace(PARA + "## Math (", PARA.replace(/\n\n$/, "\n\n") + "## Math (");

/* --- TAGS.json --- */
{
  let tags;
  try { tags = JSON.parse(src.tags); } catch (e) { tags = null; }
  if (!tags || typeof tags !== "object") MISS("TAGS.json parse");
  else if (tags.cardsheet) MISS("TAGS.json already has cardsheet");
  else {
    const vocab = new Set(Object.values(tags).flat());
    const mine = ["clip", "combine", "grid", "repeat", "structural"];
    const bad = mine.filter((t) => !vocab.has(t));
    if (bad.length) MISS("TAGS.json vocabulary would grow: " + bad.join(","));
    else {
      tags.cardsheet = mine;
      const sorted = {};
      for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
      src.tags = JSON.stringify(sorted, null, 1) + "\n";
      OK("TAGS.json cardsheet: " + mine.join(", ") + " (vocabulary unchanged, " + vocab.size + " tags)");
    }
  }
}

/* --- HANDOFF --- */
const hf = src.handoff.match(/\*\*(\d+) files\*\* \((\d+) nodes total/);
if (hf) { src.handoff = src.handoff.replace(hf[0], `**${nFiles} files** (${nTotal} nodes total`); OK(`HANDOFF file/node counts ${hf[1]}/${hf[2]} -> ${nFiles}/${nTotal}`); } else MISS("HANDOFF files/nodes count");
const hc = src.handoff.match(/`ls src\/defs\/nodes \| wc -l` \((\d+)\)/);
if (hc) { src.handoff = src.handoff.replace(hc[0], "`ls src/defs/nodes | wc -l` (" + nFiles + ")"); OK("HANDOFF ls count " + hc[1] + " -> " + nFiles); } else MISS("HANDOFF ls count");
const ENTRY = `
- **${V2}** New node **Card Sheet** (\`cardsheet\`, duo): two-sided imposition
  for postcards and folded cards. Grid of cards on the sheet, compositions
  scaled into faces (Zine's Fit/Fill/Stretch/Rotate 90 placement), dynamic pins
  by *Fold* (None → Front/Back; Vertical → Cover/Back cover/Inside L/R;
  Horizontal → …/Inside top/bottom, cover on top turned 180 as the paper
  works). Back layout derived: back view = front mirrored in x (page turn),
  tumble = that rotated 180 = mirror y; faces paired (Cover ↔ Inside L/top,
  Back cover ↔ Inside R/bottom). Shared \`_layout\` method for compute + overlay.
  Registration: symmetric reg marks, *Back offset X/Y* (content only), *Trim
  frame* (trim-first), *Pin holes* (two 6 mm centres on the flip axis, replace
  the two reg targets on that axis). *Mode* Duplex test: vernier scales at four
  points, 1.00 mm front / 1.10 mm back on opposite sides of the baseline,
  coincident pair k → offset 0.1·k mm. Default 140×200 card, margin 5, gap 6:
  A3 portrait takes 2×2, A4 landscape 2×1. Validator
  tools/validate-cardsheet.mjs (123 checks): partner-face oracle on panel
  rects, orientation flags, tumble-back == rot180(page-back) path-for-path,
  mark symmetry, back-offset isolation, vernier pitch + arithmetic, overlay
  tiling drift — mutation-tested against 12 deliberate breakages. Docs era:
  tools/era/patch-docs-cardsheet.mjs.

## Hard-won pitfalls (keep)
`;
if (src.handoff.includes("\n## Hard-won pitfalls (keep)\n")) { src.handoff = src.handoff.replace("\n## Hard-won pitfalls (keep)\n", ENTRY); OK("HANDOFF version-history entry " + V2); } else MISS("HANDOFF '## Hard-won pitfalls (keep)' anchor");

/* --- version --- */
src.app = src.app.replace('APP_VERSION = "' + V + '"', 'APP_VERSION = "' + V2 + '"'); OK("APP_VERSION " + V + " -> " + V2);

if (miss > 0) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
for (const k of Object.keys(FILES)) writeFileSync(FILES[k], src[k]);
console.log("DONE  " + ok + " edits; " + Object.values(FILES).join(", ") + " written");
