/* patch-tag-chips-v258.mjs — ONE-SHOT era patch, do not re-run.
 *
 *   E1  module-scope CATALOG_TAGS: tag vocabulary + node counts aggregated
 *       from CATALOG (source: docs/MUUSIA-TAGS.json via make-catalog.mjs)
 *   E2  quick-add modal: browsable tag chips under the search input while the
 *       query is empty — click sets the query to the tag (the deep search
 *       already scores tags at weight 2)
 *
 * Requires the v257 catalog-search patch to be applied first.
 * Run once from repo root: node tools/era/patch-tag-chips-v258.mjs
 * Sentinel afterwards: grep -c "CATALOG_TAGS" src/App.jsx   (expect 2)
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

/* ---------- E1: tag vocabulary at module scope ---------- */
edit("E1 CATALOG_TAGS const",
  'import { CATALOG } from "./defs/catalog.js";',
`
const CATALOG_TAGS = Object.entries(
  Object.values(CATALOG).reduce((m, e) => { for (const t of e.tags || []) m[t] = (m[t] || 0) + 1; return m; }, {})
).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));`,
  "after");

/* ---------- E2: chips row in the quick-add modal ---------- */
edit("E2 tag chips row",
  '              <div style={{ maxHeight: 300, overflowY: "auto", padding: 6 }}>',
`              {!terms.length && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 10px", borderBottom: \`1px solid \${T.line}\` }}>
                  {CATALOG_TAGS.slice(0, 18).map(([tg, c]) => (
                    <span key={tg} onClick={() => setQuickAdd((q) => ({ ...q, query: tg, sel: 0 }))}
                      style={{ fontSize: 9, fontFamily: mono, color: T.dim, background: T.panel2, border: \`1px solid \${T.line}\`, borderRadius: 9, padding: "2px 7px", cursor: "pointer", userSelect: "none" }}>
                      {tg} <span style={{ opacity: 0.55 }}>{c}</span>
                    </span>
                  ))}
                </div>
              )}
`,
  "before");

fs.writeFileSync(FILE, src);
console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
