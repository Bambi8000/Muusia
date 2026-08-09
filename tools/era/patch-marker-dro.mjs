/* tools/era/patch-marker-dro.mjs — Single Marker: DRO (laser) coordinate mode
 *
 * Adds a Coordinates select (Canvas mm / DRO (laser)). In DRO mode X/Y are
 * DRO readings; the marker position is the inverse of the export mapping:
 * (DRO + laserOff) - origin, flipY-inverted — identical convention to the
 * Image Underlay anchors, using ctx.machine. Canvas mode (and any old patch
 * with no coord param) is byte-identical to the previous behavior. The
 * conversion is deliberately INLINED in both compute and overlay (the
 * this._helper binding pitfall in the engine/bake call path); the validator
 * asserts they agree.
 *
 * X/Y slider max raised 420/594 -> 800 (typed NumBox values clamp to max;
 * X-Carve DRO readings exceed the old caps). Per-node ⚙ pmax still extends.
 *
 * Anchored exact-string replacement on src/defs/nodes/singlemarker.js.
 * Idempotent (SKIP), all-or-nothing (MISS aborts without writing).
 *
 * After a successful run:
 *   grep -c "DRO (laser)" src/defs/nodes/singlemarker.js -> 4
 *   node tools/validate-singlemarker.mjs -> ALL PASS
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/defs/nodes/singlemarker.js";
let src = readFileSync(FILE, "utf8");

const DRO_BLOCK = (xv, yv) => `if (p.coord === "DRO (laser)") {
      const M = (ctx && ctx.machine) || {};
      const mmx = (+p.x || 0) + (M.laserOffX || 0), mmy = (+p.y || 0) + (M.laserOffY || 0);
      ${xv} = mmx - (M.originX || 0);
      const dyy = mmy - (M.originY || 0);
      ${yv} = M.flipY ? ((ctx && ctx.H) || 0) - dyy : dyy;
    }`;

const EDITS = [
  {
    name: "E1 params: x/y max 800 + coord select",
    find: `    { key: "x", label: "X mm", type: "slider", min: 0, max: 420, step: 0.5, def: 105 },
    { key: "y", label: "Y mm", type: "slider", min: 0, max: 594, step: 0.5, def: 148.5 },`,
    repl: `    { key: "x", label: "X mm", type: "slider", min: 0, max: 800, step: 0.5, def: 105 },
    { key: "y", label: "Y mm", type: "slider", min: 0, max: 800, step: 0.5, def: 148.5 },
    { key: "coord", label: "Coordinates", type: "select", options: ["Canvas mm", "DRO (laser)"], def: "Canvas mm" },`,
  },
  {
    name: "E2 overlay: DRO conversion",
    find: `  overlay(p, ctx) {
    const r = Math.max(0.25, p.size / 2);
    return [
      { kind: "point", x: p.x, y: p.y },
      { kind: "circle", cx: p.x, cy: p.y, r: Math.max(r, 2) },
    ];
  },`,
    repl: `  overlay(p, ctx) {
    const r = Math.max(0.25, p.size / 2);
    let gx = p.x, gy = p.y;
    ${DRO_BLOCK("gx", "gy")}
    return [
      { kind: "point", x: gx, y: gy },
      { kind: "circle", cx: gx, cy: gy, r: Math.max(r, 2) },
    ];
  },`,
  },
  {
    name: "E3 compute: DRO conversion",
    find: `  compute(ins, p, ctx) {
    const cx = p.x, cy = p.y;`,
    repl: `  compute(ins, p, ctx) {
    let cx = p.x, cy = p.y;
    ${DRO_BLOCK("cx", "cy")}`,
  },
  {
    name: "E4 desc: DRO mode sentence",
    find: `Connect: Chain joins them by nearest neighbour instead.",`,
    repl: `Connect: Chain joins them by nearest neighbour instead. Coordinates: DRO (laser) reads X/Y as DRO values — jog the laser dot onto the target spot on the bed, type the DRO reading in, and the marker lands at that exact physical position (laser offset and origin come from the machine profile, same convention as Image Underlay anchors).",`,
  },
];

const report = [];
let miss = 0, skip = 0, ok = 0;
for (const e of EDITS) {
  if (src.includes(e.repl)) { report.push(`SKIP  ${e.name} (already applied)`); skip++; continue; }
  const parts = src.split(e.find);
  if (parts.length === 2) { report.push(`OK    ${e.name}`); ok++; }
  else { report.push(`MISS  ${e.name} (found ${parts.length - 1} occurrences, need exactly 1)`); miss++; }
}
console.log(report.join("\n"));
if (miss > 0) {
  console.log(`\nABORT — ${miss} MISS, nothing written.`);
  process.exit(1);
}
if (ok === 0) {
  console.log("\nAll edits already applied — nothing to do.");
  process.exit(0);
}
for (const e of EDITS) {
  if (src.includes(e.repl)) continue;
  src = src.split(e.find).join(e.repl);
}
writeFileSync(FILE, src);
console.log(`\nWROTE ${FILE} — ${ok} applied, ${skip} skipped.`);
console.log(`Verify: grep -c "DRO (laser)" ${FILE} (expect 4), then node tools/validate-singlemarker.mjs`);
