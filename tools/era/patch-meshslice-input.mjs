/* patch-meshslice-input.mjs — give Mesh Slice a wireable Mesh input.
 *
 * Until now the only way in was a loaded STL frozen at node.data.svg. With the
 * "mesh" pin type (tools/era/patch-mesh-pin.mjs) a generator such as Blob Mesh
 * can hand its geometry over directly — no STL export/import round trip, and
 * the shape stays live: change the blob and every slice, hole and rod follows.
 *
 * The wired mesh WINS over a loaded file when both are present, so plugging a
 * generator into a node that already has an STL loaded does the obvious thing;
 * unplug it and the file comes back.
 *
 * The Mesh pin goes at index 1, AFTER the existing Style pin, so patches with
 * a Style wire keep their connection (edges store a numeric port index).
 *
 * Anchored, MISS-aborts, idempotent (SKIP when already applied).
 * Usage: node tools/era/patch-meshslice-input.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BAKED = "src/defs/nodes/meshslice.js";
const LAB = "nodes-lab/meshslice.plotternode.js";
const FILE = existsSync(BAKED) ? BAKED : LAB;
if (!existsSync(FILE)) {
  console.error("MISS: neither " + BAKED + " nor " + LAB + " found - run this from the repo root");
  process.exit(1);
}
let src = readFileSync(FILE, "utf8");
console.log("  target: " + FILE);

if (src.includes('Pin("mesh", "Mesh")')) {
  console.log("SKIP: already applied (Mesh input present)");
  process.exit(0);
}

/* 1. the input pin */
const A1 = `  ins: [Pin("style", "Style")],`;
const B1 = `  ins: [Pin("style", "Style"), Pin("mesh", "Mesh")],`;
if (src.split(A1).length - 1 !== 1) {
  console.error("MISS: ins anchor not found or not unique - aborting, file untouched");
  process.exit(1);
}

/* 2. both mesh lookups (compute and overlay) prefer the wire */
const A2 = `const mesh = node && node.data && node.data.svg && node.data.svg.kind === "mesh" ? node.data.svg : null;`;
const B2 = `const mesh = ins && ins[1] && ins[1].kind === "mesh" ? ins[1] : (node && node.data && node.data.svg && node.data.svg.kind === "mesh" ? node.data.svg : null);`;
const hits = src.split(A2).length - 1;
if (hits !== 2) {
  console.error("MISS: expected the mesh lookup twice (compute + overlay), found " + hits + " - aborting, file untouched");
  process.exit(1);
}

/* 3. describe the new intake */
const A3 = `Load a binary or ASCII STL`;
const B3 = `Wire a mesh generator such as Blob Mesh into the Mesh input, or load a binary or ASCII STL`;
if (src.split(A3).length - 1 !== 1) {
  console.error("MISS: desc anchor not found or not unique - aborting, file untouched");
  process.exit(1);
}

src = src.replace(A1, B1);
console.log("  OK  Mesh pin added at index 1 (Style keeps index 0)");
src = src.split(A2).join(B2);
console.log("  OK  compute + overlay prefer the wired mesh over a loaded file");
src = src.replace(A3, B3);
console.log("  OK  desc mentions the Mesh input");

writeFileSync(FILE, src);
console.log("APPLIED: " + FILE + " - Mesh Slice now accepts a wired mesh");
