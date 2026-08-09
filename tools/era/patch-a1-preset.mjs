/* tools/era/patch-a1-preset.mjs — add A1 (841 x 594 mm) to the paper size presets
 *
 * Anchored exact-string replacement, idempotent (SKIP when applied),
 * aborts without writing on MISS.
 *
 * After a successful run:
 *   grep -c "841x594" src/App.jsx -> 1
 *   grep -c "594x841" src/App.jsx -> 1
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const FIND = `            <option value="594x420">A2 wide</option>
            <option value="420x594">A2 tall</option>`;
const REPL = `            <option value="594x420">A2 wide</option>
            <option value="420x594">A2 tall</option>
            <option value="841x594">A1 wide</option>
            <option value="594x841">A1 tall</option>`;

if (src.includes(REPL)) {
  console.log("SKIP  A1 presets (already applied)");
  process.exit(0);
}
const parts = src.split(FIND);
if (parts.length !== 2) {
  console.log(`MISS  A1 presets (found ${parts.length - 1} occurrences, need exactly 1) — ABORT, nothing written.`);
  process.exit(1);
}
writeFileSync(FILE, parts.join(REPL));
console.log("OK    A1 presets\n\nWROTE " + FILE + ' — verify: grep -c "841x594" src/App.jsx (expect 1).');
