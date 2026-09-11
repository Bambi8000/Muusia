#!/usr/bin/env node
/* tools/era/patch-favorites-star-visibility.mjs — fix for v2.83 favorites:
 * unstarred \u2606 was drawn in T.line (panel border color), invisible on the
 * dark theme and on the highlighted row. Recolor to T.dim and bump the
 * glyph size a little for a better click target. Quick-add row + catalog
 * card. Idempotent, MISS aborts before writing.
 */
import fs from "node:fs";

const APP = ["src/App.jsx", "App.jsx"].find((p) => fs.existsSync(p));
const CAT = ["src/catalog-browser.jsx", "catalog-browser.jsx"].find((p) => fs.existsSync(p));
if (!APP || !CAT) { console.error("MISS  file resolution app=" + APP + " cat=" + CAT); process.exit(1); }

const buf = { [APP]: fs.readFileSync(APP, "utf8"), [CAT]: fs.readFileSync(CAT, "utf8") };

if (buf[APP].includes("favSet.has(type) ? T.accent : T.dim")) {
  console.log("SKIP  already applied");
  process.exit(0);
}

const edits = [
  [APP, "E1 quick-add row star color",
    "style={{ fontSize: 12, lineHeight: 1, cursor: \"pointer\", color: favSet.has(type) ? T.accent : T.line, padding: \"0 2px\", flexShrink: 0, userSelect: \"none\" }}>",
    "style={{ fontSize: 14, lineHeight: 1, cursor: \"pointer\", color: favSet.has(type) ? T.accent : T.dim, padding: \"0 2px\", flexShrink: 0, userSelect: \"none\" }}>"],
  [CAT, "E2 catalog card star color",
    "style={{ fontSize: 11, lineHeight: 1, cursor: \"pointer\", color: (nodeFavs || []).includes(type) ? T.accent : T.line, userSelect: \"none\", alignSelf: \"center\", flexShrink: 0 }}>",
    "style={{ fontSize: 13, lineHeight: 1, cursor: \"pointer\", color: (nodeFavs || []).includes(type) ? T.accent : T.dim, userSelect: \"none\", alignSelf: \"center\", flexShrink: 0 }}>"],
];

let fail = 0;
for (const [file, name, anchor, repl] of edits) {
  const parts = buf[file].split(anchor);
  if (parts.length !== 2) { console.error("MISS  " + name + " (hits: " + (parts.length - 1) + ") in " + file); fail = 1; continue; }
  buf[file] = parts[0] + repl + parts[1];
  console.log("OK    " + name);
}
if (fail) { console.error("ABORT \u2014 nothing written."); process.exit(1); }

for (const f of [APP, CAT]) fs.writeFileSync(f, buf[f]);
console.log("DONE  wrote " + APP + ", " + CAT);
