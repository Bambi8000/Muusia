/* validate-catalog.mjs — build-gate checks for src/defs/catalog.js
 *
 * FAILS (exit 1) when:
 *   - src/defs/catalog.js is missing
 *   - the committed file differs from a fresh buildCatalog() run (stale catalog:
 *     NODES.md or TAGS.json changed without regenerating)
 *   - a catalog key matches no node def (and is not group/reititys)
 *   - a tag is not a lowercase non-empty string
 *
 * WARNS (exit 0) when:
 *   - a node has an empty search text (paragraph missing from NODES.md — doc debt)
 *
 * Run from repo root:  node tools/validate-catalog.mjs
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { buildCatalog } from "./make-catalog.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/defs/catalog.js");
let fail = 0;

if (!fs.existsSync(OUT)) {
  console.log("FAIL src/defs/catalog.js missing — run: node tools/make-catalog.mjs");
  process.exit(1);
}

const committed = fs.readFileSync(OUT, "utf8");
const { code } = await buildCatalog();
if (committed !== code) {
  console.log("FAIL src/defs/catalog.js is STALE — NODES.md/TAGS.json moved. Run: node tools/make-catalog.mjs");
  fail = 1;
} else {
  console.log("ok   catalog matches a fresh regeneration (not stale)");
}

const { CATALOG } = await import(pathToFileURL(OUT).href);
const NODES_DIR = path.join(ROOT, "src/defs/nodes");
const keys = new Set(["group", "reititys"]);
for (const f of fs.readdirSync(NODES_DIR).filter((x) => x.endsWith(".js"))) {
  const mod = await import(pathToFileURL(path.join(NODES_DIR, f)).href);
  keys.add(mod.default.key);
}

const orphans = Object.keys(CATALOG).filter((k) => !keys.has(k));
if (orphans.length) { console.log("FAIL catalog keys with no node def: " + orphans.join(", ")); fail = 1; }
else console.log("ok   every catalog key maps to a real node (" + Object.keys(CATALOG).length + ")");

const badTags = [];
for (const [k, e] of Object.entries(CATALOG))
  for (const t of e.tags || [])
    if (typeof t !== "string" || !t || t !== t.toLowerCase()) badTags.push(k + ":" + t);
if (badTags.length) { console.log("FAIL malformed tags: " + badTags.join(", ")); fail = 1; }
else console.log("ok   tags well-formed");

const empty = Object.entries(CATALOG).filter(([, e]) => !e.t).map(([k]) => k);
if (empty.length) console.log("WARN " + empty.length + " nodes without a NODES.md paragraph (search falls back to name/desc/tags): " + empty.join(", "));
else console.log("ok   every node has search text");

process.exit(fail);
