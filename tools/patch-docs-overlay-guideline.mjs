#!/usr/bin/env node
// patch-docs-overlay-guideline.mjs — adds the overlay guideline to MUUSIA-NODE-API.md
// Anchored string replacement with OK/MISS reporting. Run from repo root:
//   node tools/patch-docs-overlay-guideline.mjs
import fs from "fs";

const FILE = "docs/MUUSIA-NODE-API.md";
let src = fs.readFileSync(FILE, "utf8");
let okCount = 0, missCount = 0;

const patch = (name, anchor, replacement) => {
  if (src.includes(replacement)) { console.log(`SKIP ${name} (already applied)`); return; }
  if (!src.includes(anchor)) { console.log(`MISS ${name}`); missCount++; return; }
  src = src.replace(anchor, replacement);
  console.log(`OK   ${name}`);
  okCount++;
};

// 1) Strengthen the overlay row in the definition-fields table
patch(
  "overlay table row",
  '| `overlay` | function, optional | `(params, ctx) => guides[]` — dashed preview guides shown when the node is selected. Guide kinds: `{kind:"rect",x,y,w,h}`, `{kind:"circle",cx,cy,r}`, `{kind:"point",x,y}`, `{kind:"arrow",x1,y1,x2,y2}`, `{kind:"poly",pts}`. Never plotted. |',
  '| `overlay` | function, expected for spatial params | `(params, ctx) => guides[]` — dashed preview guides shown when the node is selected. Guide kinds: `{kind:"rect",x,y,w,h}`, `{kind:"circle",cx,cy,r}`, `{kind:"point",x,y}`, `{kind:"arrow",x1,y1,x2,y2}`, `{kind:"poly",pts}`. Never plotted. **Required convention:** any node whose parameters place, size or bound a spatial region — zones, masks, pools, margins, placement offsets, effect areas — must provide an overlay showing that region (see Smear, Ripple, Eraser). Compute the guide with the same math as `compute` so the guide matches the output exactly. |'
);

// 2) Add a pitfall entry so the checklist catches it
patch(
  "pitfalls entry",
  "- Coordinates outside `0..W / 0..H` are allowed (modifiers may pull them back) but\n  anything still outside at export prints off-canvas; prefer a `margin` param.",
  "- Coordinates outside `0..W / 0..H` are allowed (modifiers may pull them back) but\n  anything still outside at export prints off-canvas; prefer a `margin` param.\n- Spatial-region params without an `overlay` — if the node has a zone, area, mask,\n  margin box or placement the user tunes blind, add `overlay()` guides for it.\n  Reuse the exact region math from `compute` (share the formula, don't approximate),\n  so the dashed guide and the plotted result never disagree."
);

fs.writeFileSync(FILE, src);
console.log(`\n${okCount} OK, ${missCount} MISS`);
process.exit(missCount === 0 ? 0 : 1);
