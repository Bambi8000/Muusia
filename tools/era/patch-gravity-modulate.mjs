/* Gravity: add "Spin / size apply to" (Fallen only / All) + doc lines.
   Run once from the repo root AFTER the version bump: node tools/era/patch-gravity-modulate.mjs
   Edits src/defs/nodes/gravity.js (baked) or nodes-lab/gravity.plotternode.js (lab),
   docs/MUUSIA-NODES.md and docs/MUUSIA-HANDOFF.md. Anchored; MISS aborts; SKIP if applied. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

let miss = 0;
const OK = (m) => console.log("OK    " + m), MISS = (m) => { console.log("MISS  " + m); miss++; };
const nodeFile = existsSync("src/defs/nodes/gravity.js") ? "src/defs/nodes/gravity.js" : existsSync("nodes-lab/gravity.plotternode.js") ? "nodes-lab/gravity.plotternode.js" : null;
const find = (n) => { for (const d of ["docs", "."]) { const f = resolve(d, n); if (existsSync(f)) return f; } return null; };
const F_NODES = find("MUUSIA-NODES.md"), F_HAND = find("MUUSIA-HANDOFF.md"), F_APP = "src/App.jsx";
if (!nodeFile) MISS("gravity node file"); if (!F_NODES) MISS("MUUSIA-NODES.md"); if (!F_HAND) MISS("MUUSIA-HANDOFF.md"); if (!existsSync(F_APP)) MISS("src/App.jsx");
if (miss) { console.log("ABORT"); process.exit(1); }
const V = (readFileSync(F_APP, "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!V) { console.log("MISS  APP_VERSION - ABORT"); process.exit(1); }

let src = readFileSync(nodeFile, "utf8"), nodes = readFileSync(F_NODES, "utf8"), hand = readFileSync(F_HAND, "utf8");
if (src.includes('key: "modulate"') && nodes.includes("*Spin / size apply to*") && hand.includes("Spin / size apply to")) { console.log("SKIP  already applied"); process.exit(0); }
if (src.includes('key: "modulate"')) { console.log("SKIP  node already patched (" + nodeFile + ")"); }
else {
  const rep = (o, n, label) => { const c = src.split(o).length - 1; if (c !== 1) { MISS(label + " (" + c + " hits)"); return; } src = src.replace(o, n); OK(label); };
  rep(`    { key: "sizeMod", label: "Size mod", type: "slider", min: -1, max: 1, step: 0.05, def: 0 },`,
      `    { key: "sizeMod", label: "Size mod", type: "slider", min: -1, max: 1, step: 0.05, def: 0 },
    { key: "modulate", label: "Spin / size apply to", type: "select", options: ["Fallen only", "All"], def: "Fallen only" },`, "node: modulate param");
  rep(`      const e = { i, j, x: x0, y: y0, r: r0, ang: 0, pen: penOf(i, j), state: "grid" };
      if (!rel) {`,
      `      const e = { i, j, x: x0, y: y0, r: r0, ang: 0, pen: penOf(i, j), state: "grid" };
      /* All: every element carries its own hashed spin and size, intact ones
         included; Fallen only: both ramp with the fall fraction */
      const all = p.modulate === "All";
      const spinDir = (hash2(i, j, seed + 7) - 0.5) * 2;
      const sizeAmt = hash2(i, j, seed + 11);
      if (all) { e.ang = (spin * Math.PI / 180) * spinDir; e.r = r0 * clamp(1 + sizeMod * sizeAmt, 0.05, 3); }
      if (!rel) {`, "node: per-element spin/size for All");
  rep(`      e.f = f;
      e.r = r0 * clamp(1 + sizeMod * f, 0.05, 3);
      e.ang = (spin * Math.PI / 180) * f * (hash2(i, j, seed + 7) - 0.5) * 2;`,
      `      e.f = f;
      if (!all) { e.r = r0 * clamp(1 + sizeMod * f, 0.05, 3); e.ang = (spin * Math.PI / 180) * f * spinDir; }`, "node: fall ramp only in Fallen only");
  rep(`Size mod shrinks or grows it; Grid jitter shakes the intact elements near the line.`,
      `Size mod shrinks or grows it; Spin / size apply to chooses whether those two ramp with the fall (Fallen only) or every element, intact ones included, carries its own hashed spin and size (All); Grid jitter shakes the intact elements near the line.`, "node: desc");
}
/* docs */
const nodesAnchor = `*Size mod* shrinks or grows them, and *Grid jitter*`;
if (nodes.includes("*Spin / size apply to*")) console.log("SKIP  NODES already patched");
else if (nodes.split(nodesAnchor).length - 1 !== 1) MISS("NODES anchor");
else { nodes = nodes.replace(nodesAnchor, `*Size mod* shrinks or grows them — *Spin / size apply to* makes those two
ramp with the fall (Fallen only) or gives every element, intact ones
included, its own hashed spin and size (All) — and *Grid jitter*`); OK("NODES paragraph"); }
const histAnchor = "\n## Hard-won pitfalls (keep)\n";
if (hand.includes("Spin / size apply to")) console.log("SKIP  HANDOFF already patched");
else if (hand.split(histAnchor).length - 1 !== 1) MISS("HANDOFF anchor");
else { hand = hand.replace(histAnchor, `\n- **${V}** Gravity: new *Spin / size apply to* select (Fallen only = ramp with
  the fall as before; All = every element, intact included, carries its own
  hashed spin direction and size amount). Both modes share the per-element
  hash so switching keeps directions. Validator +10 checks (116).

## Hard-won pitfalls (keep)\n`); OK("HANDOFF entry"); }
if (miss) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(nodeFile, src); writeFileSync(F_NODES, nodes); writeFileSync(F_HAND, hand);
console.log("DONE  " + nodeFile + " + docs (v" + V + ")");
