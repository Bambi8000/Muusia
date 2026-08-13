/* patch-docs-v260.mjs — ONE-SHOT doc batch for v2.60, do not re-run.
 *
 *   D1  docs/MUUSIA-NODES.md title v2.59 -> v2.60
 *   D2  HANDOFF version history: 2.60 entry
 *
 * Run once from repo root: node tools/era/patch-docs-v260.mjs
 */

import fs from "fs";

let ok = 0, miss = 0;

function editFile(file, id, anchor, replacement, mode) {
  let src = fs.readFileSync(file, "utf8");
  const n = src.split(anchor).length - 1;
  if (n !== 1) { console.log("MISS " + id + " (anchor found " + n + "x in " + file + ")"); miss++; return; }
  src = src.replace(anchor,
    mode === "after" ? anchor + replacement :
    mode === "before" ? replacement + anchor : replacement);
  fs.writeFileSync(file, src);
  console.log("OK   " + id);
  ok++;
}

editFile("docs/MUUSIA-NODES.md", "D1 title v2.60",
  "# MUUSIA v2.59 \u2014 Node Reference",
  "# MUUSIA v2.60 \u2014 Node Reference");

editFile("docs/MUUSIA-HANDOFF.md", "D2 HANDOFF 2.60 entry",
  "deep search (2.57) + tags (2.58) + visual catalog (2.59).",
`deep search (2.57) + tags (2.58) + visual catalog (2.59).

- **2.60** Keyboard shortcuts popover: toolbar **Keys** button (next to
  Pens, same fixed-overlay popover pattern) and the **?** key toggle a
  grouped two-column list of every shortcut (Add nodes / Edit / View),
  with a footnote that shortcuts pause while typing and a wheel/drag/
  dblclick zoom reminder. Data lives inline in the popover \u2014 when a new
  shortcut is added to the onKey handler, add its row here in the same
  patch. Also: \`wip/\` gitignored as the local staging area for
  unapplied patch drafts (never pushed; applied one-shots still graduate
  to tools/era/ committed).`,
  "after");

console.log((miss ? "RESULT: INCOMPLETE " : "RESULT: ALL APPLIED ") + ok + " OK / " + miss + " MISS");
process.exit(miss ? 1 : 0);
