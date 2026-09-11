#!/usr/bin/env node
/* tools/era/patch-favorites.mjs — Favorites + Most used (one-shot era patch)
 *
 * A hotkey opens the quick-add in Favorites mode: starred nodes in pick
 * order, then a Most used list (top 8 by lifetime add count). Typing
 * searches favorites first, full catalog below an ALL NODES divider.
 * Star toggle on every quick-add row (Tab toggles the highlighted row)
 * and on every catalog card. User-level localStorage: muusia-favs
 * (ordered key array) + muusia-use (add counter, bumped in addNodeAt).
 *
 * Anchored exact-string edits. MISS aborts before writing anything.
 * Idempotent: SKIP + exit 0 when muusia-favs already present.
 */
import fs from "node:fs";

const APP = ["src/App.jsx", "App.jsx"].find((p) => fs.existsSync(p));
const CAT = ["src/catalog-browser.jsx", "catalog-browser.jsx"].find((p) => fs.existsSync(p));
const HANDOFF = ["docs/MUUSIA-HANDOFF.md", "MUUSIA-HANDOFF.md"].find((p) => fs.existsSync(p));
if (!APP || !CAT || !HANDOFF) {
  console.error("MISS  file resolution app=" + APP + " cat=" + CAT + " handoff=" + HANDOFF);
  process.exit(1);
}

const buf = {};
for (const f of [APP, CAT, HANDOFF]) buf[f] = fs.readFileSync(f, "utf8");

if (buf[APP].includes("muusia-favs")) {
  console.log("SKIP  already applied (muusia-favs present in " + APP + ")");
  process.exit(0);
}

const mv = buf[APP].match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!mv) { console.error("MISS  APP_VERSION not found in " + APP); process.exit(1); }
const OLDV = mv[1] + "." + mv[2];
const NEWV = mv[1] + "." + (Number(mv[2]) + 1);

const L = (...lines) => lines.join("\n");
const edits = [];
const edit = (file, name, anchor, repl) => edits.push({ file, name, anchor, repl });

/* ---------- App.jsx ---------- */

/* E1: favorites + use-counter state, right after setNick (same pattern as muusia-nicks) */
const E1A = L(
  "  const setNick = (type, nick) => setNodeNicks((m) => {",
  "    const n = { ...m };",
  "    if (nick && nick.trim()) n[type] = nick.trim(); else delete n[type];",
  "    try { localStorage.setItem(\"muusia-nicks\", JSON.stringify(n)); } catch (e) {}",
  "    return n;",
  "  });"
);
edit(APP, "E1  favs + use state", E1A, L(
  E1A,
  "  const [nodeFavs, setNodeFavs] = useState(() => {",
  "    try { const a = JSON.parse(localStorage.getItem(\"muusia-favs\") || \"[]\"); return Array.isArray(a) ? a : []; } catch (e) { return []; }",
  "  }); /* favorite node TYPE keys in user pick order, user-level */",
  "  const toggleFav = (type) => setNodeFavs((a) => {",
  "    const n = a.includes(type) ? a.filter((t) => t !== type) : [...a, type];",
  "    try { localStorage.setItem(\"muusia-favs\", JSON.stringify(n)); } catch (e) {}",
  "    return n;",
  "  });",
  "  const [nodeUse, setNodeUse] = useState(() => {",
  "    try { return JSON.parse(localStorage.getItem(\"muusia-use\") || \"{}\") || {}; } catch (e) { return {}; }",
  "  }); /* per node TYPE add counter, user-level */",
  "  const bumpUse = (type) => setNodeUse((m) => {",
  "    const n = { ...m, [type]: (m[type] || 0) + 1 };",
  "    try { localStorage.setItem(\"muusia-use\", JSON.stringify(n)); } catch (e) {}",
  "    return n;",
  "  });"
));

/* E2: count every add in the single funnel (palette drag, quick-add, catalog, Surprise me) */
const E2A = L(
  "  const addNodeAt = (type, x, y) => {",
  "    const id = NEXT_ID++;"
);
edit(APP, "E2  bumpUse in addNodeAt", E2A, L(
  "  const addNodeAt = (type, x, y) => {",
  "    bumpUse(type);",
  "    const id = NEXT_ID++;"
));

/* E3: A hotkey -> quick-add in Favorites mode */
const E3A = "      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === \"b\") { e.preventDefault(); setCatalogOpen((v) => !v); }";
edit(APP, "E3  A hotkey", E3A, L(
  E3A,
  "      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === \"a\") { e.preventDefault(); setQuickAdd({ cat: null, fav: true, query: \"\", sel: 0 }); }"
));

/* E4: fav-aware list building in the quick-add popup */
const E4A = L(
  "        const list = Object.entries(DEFS)",
  "          .map(([t, d]) => {",
  "            if (d.hidden || (quickAdd.cat !== null && d.cat !== quickAdd.cat)) return null;",
  "            const [s, snip] = scoreOf(t, d);",
  "            return s > 0 ? [t, d, s, snip] : null;",
  "          })",
  "          .filter(Boolean)",
  "          .sort((a, b) => b[2] - a[2] || a[1].name.localeCompare(b[1].name));"
);
edit(APP, "E4  fav list building", E4A, L(
  "        const favSet = new Set(nodeFavs);",
  "        const baseList = Object.entries(DEFS)",
  "          .map(([t, d]) => {",
  "            if (d.hidden || (quickAdd.cat !== null && d.cat !== quickAdd.cat)) return null;",
  "            const [s, snip] = scoreOf(t, d);",
  "            return s > 0 ? [t, d, s, snip] : null;",
  "          })",
  "          .filter(Boolean)",
  "          .sort((a, b) => b[2] - a[2] || a[1].name.localeCompare(b[1].name));",
  "        let list = baseList;",
  "        if (quickAdd.fav) {",
  "          if (!terms.length) {",
  "            const favRows = nodeFavs.filter((t) => DEFS[t] && !DEFS[t].hidden).map((t) => [t, DEFS[t], 1, null, null]);",
  "            const used = Object.entries(nodeUse)",
  "              .filter(([t, c]) => c >= 2 && !favSet.has(t) && DEFS[t] && !DEFS[t].hidden)",
  "              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))",
  "              .slice(0, 8)",
  "              .map(([t]) => [t, DEFS[t], 1, null, \"MOST USED\"]);",
  "            list = [...favRows, ...used];",
  "          } else {",
  "            list = [",
  "              ...baseList.filter(([t]) => favSet.has(t)),",
  "              ...baseList.filter(([t]) => !favSet.has(t)).map((r) => [r[0], r[1], r[2], r[3], \"ALL NODES\"]),",
  "            ];",
  "          }",
  "        }"
));

/* E5: popup title */
const E5A = "        const catLabel = quickAdd.cat === null ? \"All nodes\" : (CATS[quickAdd.cat] ? CATS[quickAdd.cat].label : quickAdd.cat);";
edit(APP, "E5  Favorites title", E5A,
  "        const catLabel = quickAdd.fav ? \"Favorites\" : quickAdd.cat === null ? \"All nodes\" : (CATS[quickAdd.cat] ? CATS[quickAdd.cat].label : quickAdd.cat);");

/* E6: no tag-chip row in Favorites mode */
const E6A = L(
  "              {!terms.length && (",
  "                <div style={{ display: \"flex\", flexWrap: \"wrap\", gap: 4, padding: \"8px 10px\", borderBottom: `1px solid ${T.line}` }}>"
);
edit(APP, "E6  hide tag chips", E6A, L(
  "              {!terms.length && !quickAdd.fav && (",
  "                <div style={{ display: \"flex\", flexWrap: \"wrap\", gap: 4, padding: \"8px 10px\", borderBottom: `1px solid ${T.line}` }}>"
));

/* E7: Tab toggles the highlighted row's star */
const E7A = "                  else if (e.key === \"Enter\" && list[sel]) { addSelected(list[sel][0]); }";
edit(APP, "E7  Tab toggles star", E7A, L(
  E7A,
  "                  else if (e.key === \"Tab\" && list[sel]) { e.preventDefault(); toggleFav(list[sel][0]); }"
));

/* E8a: row map opens with section dividers (Fragment wrapper) */
const E8aA = L(
  "                {list.map(([type, d, _s, snip], i) => (",
  "                  <div key={type} onClick={() => addSelected(type)}"
);
edit(APP, "E8a row map + dividers", E8aA, L(
  "                {list.map(([type, d, _s, snip, sec], i) => (",
  "                  <React.Fragment key={type}>",
  "                    {sec && sec !== (list[i - 1] || [])[4] && (",
  "                      <div style={{ padding: \"6px 8px 1px\", fontSize: 8, color: T.dim, letterSpacing: \"0.12em\" }}>{sec}</div>",
  "                    )}",
  "                    <div onClick={() => addSelected(type)}"
));

/* E8b: star at the row's right edge + Fragment close */
const E8bA = L(
  "                    <div style={{ fontSize: 9, color: T.dim }}>{(CATS[d.cat] || {}).label || d.cat}</div>",
  "                  </div>",
  "                ))}"
);
edit(APP, "E8b row star + close", E8bA, L(
  "                    <div style={{ fontSize: 9, color: T.dim }}>{(CATS[d.cat] || {}).label || d.cat}</div>",
  "                      <span onClick={(e) => { e.stopPropagation(); toggleFav(type); }}",
  "                        title={favSet.has(type) ? \"Remove from favorites (Tab)\" : \"Add to favorites (Tab)\"}",
  "                        style={{ fontSize: 12, lineHeight: 1, cursor: \"pointer\", color: favSet.has(type) ? T.accent : T.line, padding: \"0 2px\", flexShrink: 0, userSelect: \"none\" }}>",
  "                        {favSet.has(type) ? \"\\u2605\" : \"\\u2606\"}",
  "                      </span>",
  "                    </div>",
  "                  </React.Fragment>",
  "                ))}"
));

/* E8c: friendlier empty state in Favorites mode */
const E8cA = "                {!list.length && <div style={{ padding: 10, fontSize: 11, color: T.dim }}>No matches</div>}";
edit(APP, "E8c empty state", E8cA,
  "                {!list.length && <div style={{ padding: 10, fontSize: 11, color: T.dim }}>{quickAdd.fav && !terms.length ? \"No favorites yet \\u2014 star nodes with \\u2606 in any quick-add list or on catalog cards, or type to search all nodes.\" : \"No matches\"}</div>}");

/* E9: Keys popover row */
const E9A = "                  [\"B\", \"visual node catalog\"],";
edit(APP, "E9  Keys popover", E9A, L(
  "                  [\"A\", \"favorites + most used (\\u2606/\\u2605, Tab)\"],",
  E9A
));

/* E10: in-app manual, KEYBOARD SHORTCUTS */
const E10A = "                \"B \\u2014 visual node catalog (live thumbnails, tag filters, Surprise me) \\u00B7 ? \\u2014 keyboard shortcuts popover.\",";
edit(APP, "E10 manual shortcuts", E10A,
  "                \"B \\u2014 visual node catalog (live thumbnails, tag filters, Surprise me) \\u00B7 A \\u2014 favorites: starred nodes + Most used (\\u2606/\\u2605 on quick-add rows and catalog cards, Tab toggles the highlighted row) \\u00B7 ? \\u2014 keyboard shortcuts popover.\",");

/* E11: in-app manual, BASICS */
const E11A = "for quick-add search. B (or the Catalog button)";
edit(APP, "E11 manual basics", E11A,
  "for quick-add search, A for your starred favorites. B (or the Catalog button)");

/* E12: pass favorites into the catalog browser */
const E12A = L(
  "        <CatalogBrowser DEFS={DEFS} CATS={CATS} CATALOG={CATALOG} PENS={PENS} T={T} mono={mono} disp={disp}",
  "          defaults={defaults} onAdd={(t) => addNode(t)} onClose={() => setCatalogOpen(false)} />"
);
edit(APP, "E12 catalog props", E12A, L(
  "        <CatalogBrowser DEFS={DEFS} CATS={CATS} CATALOG={CATALOG} PENS={PENS} T={T} mono={mono} disp={disp}",
  "          defaults={defaults} nodeFavs={nodeFavs} toggleFav={toggleFav} onAdd={(t) => addNode(t)} onClose={() => setCatalogOpen(false)} />"
));

/* ---------- catalog-browser.jsx ---------- */

const C1A = "export default function CatalogBrowser({ DEFS, CATS, CATALOG, PENS, T, mono, disp, defaults, onAdd, onClose }) {";
edit(CAT, "C1  catalog props", C1A,
  "export default function CatalogBrowser({ DEFS, CATS, CATALOG, PENS, T, mono, disp, defaults, nodeFavs, toggleFav, onAdd, onClose }) {");

const C2A = "                <div style={{ fontSize: 8, color: T.dim }}>{d.group || d.cat}</div>";
edit(CAT, "C2  card star", C2A, L(
  C2A,
  "                <span onClick={(e) => { e.stopPropagation(); toggleFav && toggleFav(type); }}",
  "                  title={(nodeFavs || []).includes(type) ? \"Remove from favorites\" : \"Add to favorites\"}",
  "                  style={{ fontSize: 11, lineHeight: 1, cursor: \"pointer\", color: (nodeFavs || []).includes(type) ? T.accent : T.line, userSelect: \"none\", alignSelf: \"center\", flexShrink: 0 }}>",
  "                  {(nodeFavs || []).includes(type) ? \"\\u2605\" : \"\\u2606\"}",
  "                </span>"
));

/* ---------- HANDOFF ---------- */

const H1A = "\n## Hard-won pitfalls (keep)";
edit(HANDOFF, "H1  version history", H1A, L(
  "",
  "- **" + NEWV + "** Favorites + Most used (UI only, no engine changes). **A** opens",
  "  the quick-add in Favorites mode: starred nodes in pick order, then a Most",
  "  used list (top 8 by lifetime add count, count >= 2, unstarred only);",
  "  typing searches favorites first with the full catalog below an ALL NODES",
  "  divider, so stars can be added and removed without leaving the popup.",
  "  Every quick-add row (G/M/D/C/X/N/A) and every catalog card gets a",
  "  \u2606/\u2605 toggle; Tab stars the highlighted quick-add row. User-level",
  "  localStorage: `muusia-favs` (ordered key array) + `muusia-use` (counter",
  "  map) \u2014 same pattern and origin-specificity caveat as `muusia-nicks`.",
  "  The counter bumps in addNodeAt, the single add funnel, so palette drag,",
  "  quick-add, catalog click and Surprise me all count. Shipped as",
  "  tools/era/patch-favorites.mjs.",
  "",
  "## Hard-won pitfalls (keep)"
));

/* ---------- verify + apply (in memory), write only if every edit lands ---------- */

let fail = 0;
for (const e of edits) {
  const parts = buf[e.file].split(e.anchor);
  if (parts.length !== 2) {
    console.error("MISS  " + e.name + " (hits: " + (parts.length - 1) + ") in " + e.file);
    fail = 1;
    continue;
  }
  buf[e.file] = parts[0] + e.repl + parts[1];
  console.log("OK    " + e.name);
}
if (fail) { console.error("ABORT \u2014 nothing written."); process.exit(1); }

buf[APP] = buf[APP].replace("APP_VERSION = \"" + OLDV + "\"", "APP_VERSION = \"" + NEWV + "\"");
console.log("OK    version " + OLDV + " -> " + NEWV);

for (const f of [APP, CAT, HANDOFF]) fs.writeFileSync(f, buf[f]);
console.log("DONE  wrote " + APP + ", " + CAT + ", " + HANDOFF);
