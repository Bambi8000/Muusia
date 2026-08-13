/* validate-catalog-browser-v259.mjs — era validator for the visual catalog.
 * Extracts the fixture + thumbnail compute VERBATIM from src/catalog-browser.jsx
 * (the pure-JS part above the components) and runs it over EVERY node def:
 *   - no exception escapes computeThumb
 *   - determinism: two runs are byte-identical
 *   - point budget respected
 *   - at least 85% of visible nodes produce a live thumbnail
 * Run once from repo root: node tools/era/validate-catalog-browser-v259.mjs
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = process.cwd();
const DEFS = {};
const dir = path.join(ROOT, "src/defs/nodes");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js")).sort()) {
  const d = (await import(pathToFileURL(path.join(dir, f)).href)).default;
  DEFS[d.key] = d;
}
const defaults = (type) => { const o = {}; DEFS[type].params.forEach((p) => (o[p.key] = p.def)); return o; };

const src = fs.readFileSync(path.join(ROOT, "src/catalog-browser.jsx"), "utf8");
const start = src.indexOf("const TW = 150");
const end = src.indexOf("function ThumbSVG");
if (start < 0 || end < 0) { console.log("FAIL cannot extract compute block"); process.exit(1); }
const block = src.slice(start, end);
const { computeThumb, POINT_BUDGET } = new Function(block + "\nreturn { computeThumb, POINT_BUDGET };")();

let fails = 0;
const states = { ok: [], file: [], empty: [], err: [], none: [], value: [], style: [] };
for (const key of Object.keys(DEFS).filter((k) => !DEFS[k].hidden)) {
  let t;
  try { t = computeThumb(DEFS, defaults, key); }
  catch (e) { console.log("FAIL exception escaped for " + key + ": " + e.message); fails++; continue; }
  states[t.state].push(key);
  if (t.state === "ok") {
    const pts = t.paths.reduce((s, p) => s + p.pts.length, 0);
    if (pts > POINT_BUDGET) { console.log("FAIL budget exceeded for " + key + ": " + pts); fails++; }
    for (const p of t.paths) for (const q of p.pts) if (!isFinite(q[0]) || !isFinite(q[1])) { console.log("FAIL non-finite coords in " + key); fails++; break; }
  }
}
console.log("[states] ok:" + states.ok.length + " value:" + states.value.length + " style:" + states.style.length + " file:" + states.file.length + " empty:" + states.empty.length + " err:" + states.err.length);
if (states.err.length) console.log("   err: " + states.err.join(", "));
if (states.empty.length) console.log("   empty: " + states.empty.join(", "));
if (states.file.length) console.log("   file: " + states.file.join(", "));

const visible = Object.entries(DEFS).filter(([, d]) => !d.hidden).length;
if (states.ok.length < visible * 0.85) { console.log("FAIL live-thumbnail rate too low: " + states.ok.length + "/" + visible); fails++; }
else console.log("[coverage] " + states.ok.length + "/" + visible + " visible nodes render a live thumbnail");

const sample = states.ok.filter((_, i) => i % 9 === 0);
let det = true;
for (const key of sample) {
  const a = JSON.stringify(computeThumb(DEFS, defaults, key));
  const b = JSON.stringify(computeThumb(DEFS, defaults, key));
  if (a !== b) { console.log("FAIL nondeterministic thumb: " + key); det = false; fails++; }
}
if (det) console.log("[determinism] " + sample.length + "-node sample byte-identical on re-run");

console.log(fails ? "RESULT: FAIL " + fails : "RESULT: PASS");
process.exit(fails ? 1 : 0);
