/* patch-doc-minify-sentinel.mjs — document the minification sentinel lesson.
 *
 * v2.81 release check greppd dist/index.html for a local variable name
 * (rArrow) and got 0 even though the feature was in the build: Vite minifies
 * identifiers, only string literals survive. Adds a pitfall bullet and a
 * build-routine note to docs/MUUSIA-HANDOFF.md. Docs only, no version bump.
 *
 * Anchored exact-string edits. MISS aborts. Idempotent. Run from repo root.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const handoffPath = ["docs/MUUSIA-HANDOFF.md", "MUUSIA-HANDOFF.md"]
  .map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
if (!handoffPath) {
  console.error("ABORT: MUUSIA-HANDOFF.md not found (looked in docs/ and root)");
  process.exit(1);
}

let hoff = fs.readFileSync(handoffPath, "utf8");

if (hoff.includes("SENTINELS IN dist MUST BE STRING LITERALS")) {
  console.log("SKIP: minify sentinel lesson already documented");
  process.exit(0);
}

const J = (a) => a.join("\n");

const edits = [];

edits.push({
  name: "pitfalls: dist sentinels must be string literals",
  find: '## Hard-won pitfalls (keep)',
  replace: J([
    '## Hard-won pitfalls (keep)',
    '',
    '- SENTINELS IN dist MUST BE STRING LITERALS. Vite minification renames every',
    '  local identifier, so `grep -c someVarName dist/index.html` returns 0 even',
    '  when the feature is in the build (v2.81: `rArrow` greppd 0, feature was',
    '  fine). Grep dist for GUI text or another string literal ("Unlock watch",',
    '  a node key, a param label); identifiers are only valid sentinels against',
    '  `src/`.',
  ]),
});

edits.push({
  name: "build routine: sentinel note on the deploy bullet",
  find: '  version grep distinguishes broken deploy from cache.',
  replace: J([
    '  version grep distinguishes broken deploy from cache. Sentinel greps on',
    '  `dist/index.html` must target string literals (GUI text, node keys) —',
    '  minification renames identifiers, so variable/function names grep 0.',
  ]),
});

let miss = 0;
for (const e of edits) {
  const n = hoff.split(e.find).length - 1;
  if (n !== 1) { console.error("MISS (" + n + " hits) " + e.name); miss++; }
}
if (miss) {
  console.error("ABORT: " + miss + " anchor(s) not found exactly once — nothing written");
  process.exit(1);
}

for (const e of edits) { hoff = hoff.split(e.find).join(e.replace); console.log("OK  " + e.name); }

fs.writeFileSync(handoffPath, hoff);
console.log("DONE: minify sentinel lesson documented");
