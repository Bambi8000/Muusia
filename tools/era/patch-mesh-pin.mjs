/* patch-mesh-pin.mjs — add a fourth pin type: "mesh".
 *
 * Lets a generator hand a triangle mesh straight to Mesh Slice instead of the
 * user exporting an STL and loading it back. The connection rule needs no
 * change: finishWire compares pin type strings, so "mesh" already refuses to
 * connect to paths/value/style. Two things DO need patching:
 *
 *   - TYPE_COLOR has no entry, and the port dot reads it WITHOUT a fallback
 *     (background: TYPE_COLOR[pin.type]), so a mesh port would render as an
 *     invisible transparent circle. T.terra is a new warm tone, distinct from
 *     accent blue / value green / style violet / group amber.
 *   - defaultFor() returns EMPTY for unknown types. That is survivable (nodes
 *     guard on kind === "mesh") but null says what it means: no mesh wired.
 *
 * Anchored, MISS-aborts, idempotent (SKIP when already applied).
 * Usage: node tools/era/patch-mesh-pin.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = "src/App.jsx";
if (!existsSync(FILE)) {
  console.error("MISS: " + FILE + " not found - run this from the repo root");
  process.exit(1);
}
let src = readFileSync(FILE, "utf8");

if (src.includes("mesh: T.terra")) {
  console.log("SKIP: already applied (mesh pin type present)");
  process.exit(0);
}

const edits = [
  {
    name: "theme colour",
    find: `  value: "#45C4A0", style: "#B07CE8",`,
    repl: `  value: "#45C4A0", style: "#B07CE8", terra: "#D98A5B",`,
  },
  {
    name: "TYPE_COLOR entry",
    find: `const TYPE_COLOR = { paths: T.accent, value: T.value, style: T.style };`,
    repl: `const TYPE_COLOR = { paths: T.accent, value: T.value, style: T.style, mesh: T.terra };`,
  },
  {
    name: "defaultFor branch",
    find: `  if (type === "value") return 0;
  if (type === "style") return SOLID_STYLE;
  return EMPTY;`,
    repl: `  if (type === "value") return 0;
  if (type === "style") return SOLID_STYLE;
  if (type === "mesh") return null;
  return EMPTY;`,
  },
];

for (const e of edits) {
  const hits = src.split(e.find).length - 1;
  if (hits !== 1) {
    console.error("MISS: anchor for '" + e.name + "' matched " + hits + " times - aborting, file untouched");
    process.exit(1);
  }
}
for (const e of edits) {
  src = src.replace(e.find, e.repl);
  console.log("  OK  " + e.name);
}
writeFileSync(FILE, src);
console.log("APPLIED: " + FILE + " - pin type \"mesh\" is now wireable");
