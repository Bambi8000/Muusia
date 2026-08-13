/* validate-catalog-search-v257.mjs — era validator for the catalog deep search.
 * Extracts the patched quick-add search block VERBATIM from src/App.jsx and runs
 * it against the real DEFS + CATALOG. Run once from repo root after the patch:
 *   node tools/era/validate-catalog-search-v257.mjs
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
const tail = ".sort((a, b) => b[2] - a[2] || a[1].name.localeCompare(b[1].name));";
const start = app.indexOf("        const qq = quickAdd.query.toLowerCase().trim();");
const end = app.indexOf(tail, start);
if (start < 0 || end < 0) { console.log("FAIL search block not found in App.jsx (patch not applied?)"); process.exit(1); }
const run = new Function("DEFS", "CATALOG", "nodeNicks", "quickAdd", app.slice(start, end) + tail + "\nreturn list;");

let fails = 0;
const check = (q, mustInclude, mustExclude) => {
  const list = run(DEFS, CATALOG, {}, { cat: null, query: q, sel: 0 });
  const names = list.map((e) => e[1].name);
  console.log("[" + q + "] " + list.length + " hits: " + names.slice(0, 6).join(", "));
  for (const n of mustInclude) if (!names.includes(n)) { console.log("   FAIL missing: " + n); fails++; }
  for (const n of mustExclude) if (names.includes(n)) { console.log("   FAIL false hit: " + n); fails++; }
};

check("round", ["Round Canvas"], []);
check("mesh", ["Mesh", "Perforated Mesh", "Retro Mesh", "Gyroid"], []);
check("ribbon", ["Ribbon", "Woven Ribbon"], []);
check("rib", ["Ribbon"], []);
check("concentric ring", ["Organic Rings"], []);
check("hidden line", ["Occlude", "Gyroid"], []);
check("footprint", ["Gull Tracks"], []);
check("zzqx-nothing", [], []);

const empty = run(DEFS, CATALOG, {}, { cat: null, query: "", sel: 0 });
if (empty.length < 200) { console.log("FAIL empty query returned " + empty.length); fails++; }
else console.log("[empty] " + empty.length + " visible nodes listed");

const gen = run(DEFS, CATALOG, {}, { cat: "gen", query: "mesh", sel: 0 });
if (gen.some((e) => e[1].cat !== "gen")) { console.log("FAIL cat filter leaked"); fails++; }
else console.log("[cat filter] holds (" + gen.length + " gen hits)");

const a = JSON.stringify(run(DEFS, CATALOG, {}, { cat: null, query: "spiral", sel: 0 }).map((e) => e[0]));
const b = JSON.stringify(run(DEFS, CATALOG, {}, { cat: null, query: "spiral", sel: 0 }).map((e) => e[0]));
if (a !== b) { console.log("FAIL nondeterministic ordering"); fails++; }
else console.log("[determinism] ok");

const snips = run(DEFS, CATALOG, {}, { cat: null, query: "footprint", sel: 0 });
if (!snips[0] || !snips[0][3]) { console.log("FAIL deep-only hit carries no snippet"); fails++; }
else console.log("[snippet] ok: " + snips[0][3]);

console.log(fails ? "RESULT: FAIL " + fails : "RESULT: PASS");
process.exit(fails ? 1 : 0);
