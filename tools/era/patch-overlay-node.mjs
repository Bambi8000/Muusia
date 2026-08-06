/* patch-overlay-node.mjs - Portrait phase 2B: pass the node object to
   overlay() as an ADDITIVE 4th argument, so nodes carrying frozen data
   (Portrait's node.data.analysis) can draw it as dashed guides. No existing
   node changes behavior - they simply ignore the extra argument.
   ERA PATCH - one anchored edit, NOT idempotent. Run from repo root:
     node tools/era/patch-overlay-node.mjs
   Post-push guard: grep -c "oins, primaryNode" src/App.jsx  -> 1 */

import fs from "node:fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("oins, primaryNode")) {
  console.log("SKIP: overlay already receives the node - patch refused (era patches are one-shot).");
  process.exit(0);
}

const anchor = "try { return def.overlay(merged, ctx, oins); } catch (e) { return null; }";
const n = src.split(anchor).length - 1;
if (n !== 1) {
  console.log("MISS (anchor found " + n + " times, need exactly 1) - App.jsx has drifted.");
  process.exitCode = 1;
} else {
  src = src.replace(anchor,
    "try { return def.overlay(merged, ctx, oins, primaryNode); } catch (e) { return null; }");
  fs.writeFileSync(FILE, src);
  console.log("OK   overlay(params, ctx, ins, node) - additive 4th argument");
  console.log('Guard: grep -c "oins, primaryNode" src/App.jsx  -> 1');
}
