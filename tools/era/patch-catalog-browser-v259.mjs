/* patch-catalog-browser-v259.mjs — ONE-SHOT era patch, do not re-run.
 *
 * Wires the visual node catalog (src/catalog-browser.jsx) into App.jsx:
 *   E1  import CatalogBrowser
 *   E2  catalogOpen state
 *   E3  keyboard: B toggles the catalog
 *   E4  toolbar: Catalog button next to Tidy
 *   E5  render the overlay (before the quick-add block)
 *   E6  Help text mentions the catalog
 *
 * Run once from repo root: node tools/era/patch-catalog-browser-v259.mjs
 * Sentinel afterwards: grep -c "CatalogBrowser" src/App.jsx   (expect 2)
 */

import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
let ok = 0, miss = 0;

function edit(id, anchor, replacement, mode) {
  const n = src.split(anchor).length - 1;
  if (n !== 1) { console.log("MISS " + id + " (anchor found " + n + "x)"); miss++; return; }
  src = src.replace(anchor,
    mode === "after" ? anchor + replacement :
    mode === "before" ? replacement + anchor : replacement);
  console.log("OK   " + id);
  ok++;
}

/* ---------- E1: import ---------- */
edit("E1 import CatalogBrowser",
  'import { makeAnalyzeButton, intakeImage } from "./analyze.js";',
  '\nimport CatalogBrowser from "./catalog-browser.jsx";',
  "after");

/* ---------- E2: state ---------- */
edit("E2 catalogOpen state",
  "const [quickAdd, setQuickAdd] = useState(null); /* {cat: null|'gen'|..., query, sel} */",
  "\n  const [catalogOpen, setCatalogOpen] = useState(false); /* visual node catalog overlay */",
  "after");

/* ---------- E3: keyboard B ---------- */
edit("E3 B key toggles catalog",
  '      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); tidyNodes(); }',
  '\n      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "b") { e.preventDefault(); setCatalogOpen((v) => !v); }',
  "after");

/* ---------- E4: toolbar button ---------- */
edit("E4 Catalog toolbar button",
  '>Tidy</button>',
  `>Tidy</button>
        <button style={toolBtn(true)} onClick={() => setCatalogOpen(true)} title="B \u2014 browse every node as a live thumbnail: deep search, category + tag filters, Surprise me">Catalog</button>`);

/* ---------- E5: render overlay ---------- */
edit("E5 render CatalogBrowser",
  "      {/* ---------- Pikahaku (G/M/D/C/X/N) ---------- */}",
  `      {/* ---------- Node catalog (visual browser) ---------- */}
      {catalogOpen && (
        <CatalogBrowser DEFS={DEFS} CATS={CATS} CATALOG={CATALOG} PENS={PENS} T={T} mono={mono} disp={disp}
          defaults={defaults} onAdd={(t) => addNode(t)} onClose={() => setCatalogOpen(false)} />
      )}

`,
  "before");

/* ---------- E6: help text ---------- */
edit("E6 help text",
  '"Drag nodes from the left palette to the canvas, or press G/M/D/C/X/N for quick-add search.",',
  '"Drag nodes from the left palette to the canvas, or press G/M/D/C/X/N for quick-add search. B (or the Catalog button) opens the visual node catalog: every node as a live thumbnail, with deep search, tag filters and a Surprise me button.",');

fs.writeFileSync(FILE, src);
console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
