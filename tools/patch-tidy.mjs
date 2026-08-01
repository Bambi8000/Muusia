#!/usr/bin/env node
/* tools/patch-tidy.mjs
   v2.39 editor QoL: (1) addNode places new nodes into EMPTY viewport space
   (grid scan against measured card boxes, old stagger fallback), (2) toolbar
   Tidy button lays nodes out in left-to-right dependency columns (longest-path
   depth, barycenter row order, measured heights; 2+ selected = selection only).
   Anchored replacement with guards, OK/SKIP/MISS report. Run from repo root:
     node tools/patch-tidy.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const APP = "src/App.jsx";
const NODES = "docs/MUUSIA-NODES.md";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";

const EDITS = [
  {
    file: APP,
    label: "addNode: empty-space placement + tidyNodes",
    guard: "const tidyNodes = () => {",
    old: `  const addNode = (type) => {
    const sl = areaRef.current ? areaRef.current.scrollLeft / zoom : 0;
    const st = areaRef.current ? areaRef.current.scrollTop / zoom : 0;
    addNodeAt(type, sl + 80 + (lvl.nodes.length % 4) * 40, st + 80 + (lvl.nodes.length % 5) * 40);
  };`,
    new: `  const cardBoxH = (id) => (cardEls.current[id] && cardEls.current[id].offsetHeight) || 300;
  const addNode = (type) => {
    const sl = areaRef.current ? areaRef.current.scrollLeft / zoom : 0;
    const st = areaRef.current ? areaRef.current.scrollTop / zoom : 0;
    const vw = areaRef.current ? areaRef.current.clientWidth / zoom : 900;
    const vh = areaRef.current ? areaRef.current.clientHeight / zoom : 600;
    /* find empty space in the visible viewport: coarse grid scan against
       measured card boxes (+14 air); fall back to the old stagger when full */
    const boxes = lvl.nodes.map((n) => ({ x: n.x, y: n.y, w: NODE_W, h: cardBoxH(n.id) }));
    const free = (x, y) =>
      boxes.every((b) => x + NODE_W + 14 <= b.x || b.x + b.w + 14 <= x || y + 314 <= b.y || b.y + b.h + 14 <= y);
    let px = sl + 80 + (lvl.nodes.length % 4) * 40;
    let py = st + 80 + (lvl.nodes.length % 5) * 40;
    outer:
    for (let ry = st + 24; ry < st + vh - 120; ry += 40) {
      for (let rx = sl + 24; rx < sl + vw - NODE_W - 8; rx += 46) {
        if (free(rx, ry)) { px = rx; py = ry; break outer; }
      }
    }
    addNodeAt(type, Math.max(0, Math.min(AREA_W - NODE_W - 10, px)), Math.max(0, Math.min(AREA_H - 60, py)));
  };
  /* Tidy: left-to-right dependency columns (longest-path depth), barycenter
     row order within a column, measured card heights. 2+ selected = selection only. */
  const tidyNodes = () => {
    const sel = selIds.length >= 2 ? new Set(selIds) : null;
    const pick = lvl.nodes.filter((n) => !sel || sel.has(n.id));
    if (pick.length < 2) return;
    const ids = new Set(pick.map((n) => n.id));
    const preds = {};
    for (const n of pick) preds[n.id] = [];
    for (const e of lvl.edges) if (ids.has(e.from) && ids.has(e.to)) preds[e.to].push(e.from);
    const depth = {};
    const dep = (id, guard) => {
      if (depth[id] !== undefined) return depth[id];
      if (guard.has(id)) return 0; /* cycle safety */
      guard.add(id);
      const d = preds[id].length ? 1 + Math.max(...preds[id].map((q) => dep(q, guard))) : 0;
      guard.delete(id);
      depth[id] = d;
      return d;
    };
    for (const n of pick) dep(n.id, new Set());
    const cols = {};
    for (const n of pick) (cols[depth[n.id]] = cols[depth[n.id]] || []).push(n);
    const oldY = {};
    for (const n of pick) oldY[n.id] = n.y;
    const GAPX = 56, GAPY = 26, X0 = 60, Y0 = 60;
    const pos = {};
    for (const d of Object.keys(cols).map(Number).sort((a, b) => a - b)) {
      const col = cols[d];
      col.sort((a, b) => {
        const key = (n) => preds[n.id].length
          ? preds[n.id].reduce((s, q) => s + (pos[q] ? pos[q].y : oldY[q]), 0) / preds[n.id].length
          : oldY[n.id];
        return key(a) - key(b);
      });
      let y = Y0;
      for (const n of col) {
        pos[n.id] = {
          x: Math.min(AREA_W - NODE_W - 10, X0 + d * (NODE_W + GAPX)),
          y: Math.min(AREA_H - 60, y),
        };
        y += cardBoxH(n.id) + GAPY;
      }
    }
    setNodesL((ns) => ns.map((n) => (pos[n.id] ? { ...n, x: pos[n.id].x, y: pos[n.id].y } : n)));
  };`,
  },
  {
    file: APP,
    label: "toolbar: Tidy button after redo",
    guard: "onClick={tidyNodes}",
    old: `        <button style={toolBtn(histLens[1] > 0)} onClick={redo} title="Redo (Cmd/Ctrl+Shift+Z)">\u21B7</button>`,
    new: `        <button style={toolBtn(histLens[1] > 0)} onClick={redo} title="Redo (Cmd/Ctrl+Shift+Z)">\u21B7</button>
        <button style={toolBtn(lvl.nodes.length > 1)} onClick={tidyNodes} title="Arrange nodes left\u2192right by dataflow \u00b7 2+ selected: tidy only the selection">Tidy</button>`,
  },
  {
    file: APP,
    label: "APP_VERSION 2.38 -> 2.39",
    guard: 'APP_VERSION = "2.39"',
    old: 'APP_VERSION = "2.38"',
    new: 'APP_VERSION = "2.39"',
  },
  {
    file: NODES,
    label: "NODES.md header version",
    guard: "v2.39 \u2014 Node Reference",
    old: "# MUUSIA v2.38 \u2014 Node Reference",
    new: "# MUUSIA v2.39 \u2014 Node Reference",
  },
  {
    file: HANDOFF,
    label: "2.39 version history entry",
    guard: "- **2.39** editor QoL",
    old: `  validate-<key>; a process.exit() before appended checks silently skips
  them \u2014 prefer process.exitCode.`,
    new: `  validate-<key>; a process.exit() before appended checks silently skips
  them \u2014 prefer process.exitCode.
- **2.39** editor QoL, no node/export changes: **empty-space add** (palette
  click / quick-add scans the visible viewport in a coarse grid against
  MEASURED card boxes \u2014 cardEls offsetHeight, +14 air \u2014 and falls back to the
  old stagger when the view is full) and a toolbar **Tidy** button (left\u2192right
  dependency columns by longest-path depth with cycle guard, barycenter row
  order within a column, measured heights + 26 gap; with 2+ nodes selected it
  arranges only the selection). Applied via tools/patch-tidy.mjs.`,
  },
  {
    file: HANDOFF,
    label: "UI systems bullet: Add & Tidy",
    guard: "**Add & Tidy:**",
    old: `- **Node card header:** ? help \u00b7 \u2699 slider setup \u00b7 **D duplicate (that node)** \u00b7
  minimize. \`duplicateIds(ids)\` is the core; Cmd/Ctrl+D duplicates the selection.`,
    new: `- **Node card header:** ? help \u00b7 \u2699 slider setup \u00b7 **D duplicate (that node)** \u00b7
  minimize. \`duplicateIds(ids)\` is the core; Cmd/Ctrl+D duplicates the selection.
- **Add & Tidy:** \`addNode\` grid-scans the visible viewport for empty space
  (measured card boxes via \`cardEls\`); toolbar **Tidy** = \`tidyNodes()\`
  dependency-column layout (both live next to \`addNodeAt\` in App.jsx).`,
  },
];

let miss = 0;
for (const e of EDITS) {
  let txt;
  try { txt = readFileSync(e.file, "utf8"); }
  catch { console.log("MISS " + e.label + "  [" + e.file + " not found]"); miss++; continue; }
  if (e.guard && txt.includes(e.guard)) { console.log("SKIP " + e.label + "  [already applied]"); continue; }
  const n = txt.split(e.old).length - 1;
  if (n !== 1) { console.log("MISS " + e.label + "  [anchor found " + n + " times]"); miss++; continue; }
  writeFileSync(e.file, txt.replace(e.old, e.new));
  console.log("OK   " + e.label);
}
process.exit(miss ? 1 : 0);
