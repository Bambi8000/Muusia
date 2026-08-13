/* patch-chips-all-tags-v258b.mjs — ONE-SHOT follow-up to v258 chips, do not re-run.
 * Shows ALL tags in the quick-add chip cloud instead of the top 18 —
 * the vocabulary is meant to be browsed, and rarer tags (chaos, weave,
 * maze...) are exactly the inspiring ones.
 * Run once from repo root: node tools/era/patch-chips-all-tags-v258b.mjs
 * Sentinel: grep -c "CATALOG_TAGS.map" src/App.jsx   (expect 1)
 */
import fs from "fs";
const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const anchor = "CATALOG_TAGS.slice(0, 18).map(([tg, c]) => (";
const n = src.split(anchor).length - 1;
if (n !== 1) { console.log("MISS chips-all-tags (anchor found " + n + "x)"); process.exit(1); }
src = src.replace(anchor, "CATALOG_TAGS.map(([tg, c]) => (");
fs.writeFileSync(FILE, src);
console.log("OK   chips show all tags");
console.log("RESULT: ALL APPLIED 1 OK / 0 MISS");
