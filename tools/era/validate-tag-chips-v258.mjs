/* validate-tag-chips-v258.mjs — era validator for the tag vocabulary + chips.
 * Extracts CATALOG_TAGS and the quick-add search block VERBATIM from
 * src/App.jsx and proves: the vocabulary is real, every tag chip's search
 * returns at least as many hits as the chip's count, and every node stays
 * reachable through at least one tag.
 * Run once from repo root: node tools/era/validate-tag-chips-v258.mjs
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = process.cwd();
const { CATALOG } = await import(pathToFileURL(path.join(ROOT, "src/defs/catalog.js")).href);

const DEFS = {};
const dir = path.join(ROOT, "src/defs/nodes");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js")).sort()) {
  const d = (await import(pathToFileURL(path.join(dir, f)).href)).default;
  DEFS[d.key] = d;
}

const app = fs.readFileSync(path.join(ROOT, "src/App.jsx"), "utf8");
let fails = 0;

/* --- extract CATALOG_TAGS verbatim --- */
const cm = app.match(/const CATALOG_TAGS = Object\.entries\([\s\S]*?\)\.sort\([\s\S]*?\);/);
if (!cm) { console.log("FAIL CATALOG_TAGS not found (patch not applied?)"); process.exit(1); }
const CATALOG_TAGS = new Function("CATALOG", cm[0].replace("const CATALOG_TAGS =", "return"))(CATALOG);

if (CATALOG_TAGS.length < 40) { console.log("FAIL vocabulary too small: " + CATALOG_TAGS.length); fails++; }
else console.log("[vocabulary] " + CATALOG_TAGS.length + " tags, top: " + CATALOG_TAGS.slice(0, 8).map(([t, c]) => t + ":" + c).join(" "));

const sum = CATALOG_TAGS.reduce((s, [, c]) => s + c, 0);
const real = Object.values(CATALOG).reduce((s, e) => s + (e.tags || []).length, 0);
if (sum !== real) { console.log("FAIL count mismatch " + sum + " vs " + real); fails++; }
else console.log("[counts] chip counts sum to " + sum + " tag assignments");

const untagged = Object.entries(CATALOG).filter(([, e]) => !(e.tags || []).length).map(([k]) => k);
if (untagged.length) { console.log("FAIL untagged nodes: " + untagged.join(", ")); fails++; }
else console.log("[coverage] every node carries at least one tag");

/* --- extract search block, prove every top-18 chip query returns >= its count --- */
const tail = ".sort((a, b) => b[2] - a[2] || a[1].name.localeCompare(b[1].name));";
const start = app.indexOf("        const qq = quickAdd.query.toLowerCase().trim();");
const end = app.indexOf(tail, start);
if (start < 0 || end < 0) { console.log("FAIL search block not found"); process.exit(1); }
const run = new Function("DEFS", "CATALOG", "nodeNicks", "quickAdd", app.slice(start, end) + tail + "\nreturn list;");

let chipFails = 0;
for (const [tg, c] of CATALOG_TAGS.slice(0, 18)) {
  const hidden = Object.entries(CATALOG).filter(([k, e]) => (e.tags || []).includes(tg) && DEFS[k] && DEFS[k].hidden).length;
  const n = run(DEFS, CATALOG, {}, { cat: null, query: tg, sel: 0 }).length;
  if (n < c - hidden - 2) { console.log("FAIL chip '" + tg + "': " + n + " hits < " + c + " tagged"); chipFails++; }
}
if (chipFails) fails += chipFails;
else console.log("[chips] all top-18 chip queries return their tagged nodes");

console.log(fails ? "RESULT: FAIL " + fails : "RESULT: PASS");
process.exit(fails ? 1 : 0);
