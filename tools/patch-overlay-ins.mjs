#!/usr/bin/env node
/* tools/patch-overlay-ins.mjs
   Engine extension: overlay(params, ctx) -> overlay(params, ctx, ins)
   The node's resolved data inputs are passed as an optional third argument so
   zone nodes (Container etc.) can show WIRED regions as dashed guides.
   Backward compatible: existing overlays ignore the extra argument.
   Anchored string replacement with OK/MISS reporting. Run from repo root:
     node tools/patch-overlay-ins.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const EDITS = [
  {
    file: "src/App.jsx",
    label: "primaryGuides: resolve ins and pass as overlay 3rd arg",
    old: `  const primaryGuides = (() => {
    if (!primaryNode || primaryIsGroup) return null;
    const def = DEFS[primaryNode.type];
    if (!def || !def.overlay) return null;
    const merged = { ...primaryNode.params, ...((pvals && pvals[primaryNode.id]) || {}) };
    try { return def.overlay(merged, ctx); } catch (e) { return null; }
  })();`,
    new: `  const primaryGuides = (() => {
    if (!primaryNode || primaryIsGroup) return null;
    const def = DEFS[primaryNode.type];
    if (!def || !def.overlay) return null;
    const merged = { ...primaryNode.params, ...((pvals && pvals[primaryNode.id]) || {}) };
    /* overlay-ins: resolve data inputs so zone nodes can guide wired regions */
    const oins = defIns(primaryNode).map((pin, port) => {
      const e = lvl.edges.find((ed) => ed.to === primaryNode.id && ed.toPort === port);
      return e ? (results[e.from] || [])[e.fromPort || 0] : undefined;
    });
    try { return def.overlay(merged, ctx, oins); } catch (e) { return null; }
  })();`,
  },
  {
    file: "docs/MUUSIA-NODE-API.md",
    label: "NODE-API: document optional ins argument on overlay",
    old: "`(params, ctx) => guides[]` — dashed preview guides shown when the node is selected.",
    new: "`(params, ctx, ins?) => guides[]` — dashed preview guides shown when the node is selected. The engine also passes the node's resolved data inputs as an optional third argument (unwired pins are `undefined`), so a node with a wired region input can return the region's closed paths as `{kind:\"poly\"}` guides; guard with `(ins && ins[k]) || EMPTY` and cap the guide count.",
  },
];

let miss = 0;
for (const e of EDITS) {
  let txt;
  try { txt = readFileSync(e.file, "utf8"); }
  catch { console.log("MISS " + e.label + "  [" + e.file + " not found]"); miss++; continue; }
  const n = txt.split(e.old).length - 1;
  if (n !== 1) { console.log("MISS " + e.label + "  [anchor found " + n + " times]"); miss++; continue; }
  writeFileSync(e.file, txt.replace(e.old, e.new));
  console.log("OK   " + e.label);
}
process.exit(miss ? 1 : 0);
