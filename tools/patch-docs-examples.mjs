/* tools/patch-docs-examples.mjs — document the src/examples.js split in
 * docs/MUUSIA-HANDOFF.md. Anchored string replacement, OK/MISS per patch.
 *
 * Usage: node tools/patch-docs-examples.mjs
 */
import fs from "fs";

const FILE = "docs/MUUSIA-HANDOFF.md";
let text = fs.readFileSync(FILE, "utf8");

const PATCHES = [
  {
    name: "App.jsx bullet: examples moved out",
    find: "  animation, help. Also hosts the two engine-bound DEFS entries: `group`, `reititys`.",
    replace:
      "  animation, help. Beginner examples moved to `src/examples.js` (loadExample\n" +
      "  injects `defaults` and honors an optional per-example `canvas:{W,H}`).\n" +
      "  Also hosts the two engine-bound DEFS entries: `group`, `reititys`.",
  },
  {
    name: "Repo layout: src/examples.js bullet",
    find: "- `docs/` — MUUSIA-HANDOFF.md (this), MUUSIA-NODES.md (every node),",
    replace:
      "- `src/examples.js` — Help beginner examples: `{ name, desc, make(defaults) }`\n" +
      "  factories, node ids 9001+ / edge ids e9101+ (loadExample resets NEXT_ID to\n" +
      "  9500), params as diffs over `defaults(type)`, built-in nodes only, fixed\n" +
      "  seeds, optional `canvas:{W,H}`. Zero imports — runs in plain Node; check\n" +
      "  with `node tools/validate-examples.mjs` before build. New examples arrive\n" +
      "  as module exports (`*-module.json`, whole graph selected) and are converted\n" +
      "  to entries (param-diff + id renumbering).\n" +
      "- `docs/` — MUUSIA-HANDOFF.md (this), MUUSIA-NODES.md (every node),",
  },
  {
    name: "tools/ bullet: validate-examples.mjs",
    find: "  `patch-docs.mjs`, `make-src-bundle.mjs`, **`bake.mjs`** (lab → built-in\n  converter).",
    replace:
      "  `patch-docs.mjs`, `make-src-bundle.mjs`, **`bake.mjs`** (lab → built-in\n" +
      "  converter), `validate-examples.mjs` (structural check for src/examples.js).",
  },
];

let miss = 0;
for (const p of PATCHES) {
  const n = text.split(p.find).length - 1;
  if (n === 1) {
    text = text.replace(p.find, p.replace);
    console.log("OK    " + p.name);
  } else {
    miss++;
    console.log(`MISS  ${p.name} (anchor found ${n}\u00D7)`);
  }
}
if (!miss) fs.writeFileSync(FILE, text);
console.log(miss ? `\n${miss} patch(es) missed — file NOT written` : "\nAll patches applied, file written");
process.exit(miss ? 1 : 0);
