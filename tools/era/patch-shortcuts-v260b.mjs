/* patch-shortcuts-v260b.mjs — ONE-SHOT follow-up to v260, do not re-run.
 * The Help modal's KEYBOARD SHORTCUTS section predates the popover and was
 * missing B (visual node catalog) and ? (the popover itself) — B only
 * appeared buried in the BASICS prose. Adds one line after the T row so
 * both shortcut lists agree.
 * Run once from repo root: node tools/era/patch-shortcuts-v260b.mjs
 * Sentinel: grep -c "visual node catalog" src/App.jsx   (expect 4)
 */
import fs from "fs";
const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const anchor = '"T \\u2014 tidy: arrange nodes left\\u2192right by dataflow (2+ selected: only the selection).",';
const n = src.split(anchor).length - 1;
if (n !== 1) { console.log("MISS help shortcuts B+? line (anchor found " + n + "x)"); process.exit(1); }
src = src.replace(anchor, anchor + '\n                "B \\u2014 visual node catalog (live thumbnails, tag filters, Surprise me) \\u00B7 ? \\u2014 keyboard shortcuts popover.",');
fs.writeFileSync(FILE, src);
console.log("OK   help shortcuts B+? line");
console.log("RESULT: ALL APPLIED 1 OK / 0 MISS");
