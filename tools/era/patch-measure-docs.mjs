/* Era patch: MUUSIA-HANDOFF.md version-history entry for the current release.
   Reads APP_VERSION from src/App.jsx, finds the PREVIOUS version's history
   heading in docs/MUUSIA-HANDOFF.md, mirrors its exact prefix/separator style
   and list order (ascending or descending), and inserts the new entry next to
   it. Aborts (writing nothing) if the previous entry can't be located
   unambiguously, printing every candidate line for a manual follow-up. */

import { readFileSync, writeFileSync } from "node:fs";

const APP = "src/App.jsx";
const DOC = "docs/MUUSIA-HANDOFF.md";

const ENTRY_TEXT =
  "Preview Measure tool: a Measure button in the preview panel arms " +
  "click-to-place of two points on the sheet (magnet-jig style draggable " +
  "handles); a dashed line with a live mm readout connects them, drag to " +
  "adjust, double-click a point to remove it. Works in the small preview and " +
  "the big-preview overlay; toggling Measure off clears the points. GUI-only " +
  "change, no nodes or engine seams touched. (tools/era/patch-measure-tool.mjs)";

const vm = readFileSync(APP, "utf8").match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in " + APP + " - ABORT"); process.exit(1); }
const V = vm[1];
const [maj, min] = V.split(".").map(Number);
if (!Number.isFinite(maj) || !Number.isFinite(min) || min < 1) {
  console.log("MISS  cannot derive previous version from " + V + " - ABORT"); process.exit(1);
}
const PREV = maj + "." + (min - 1);
console.log("INFO  app version " + V + ", previous " + PREV);

let doc = readFileSync(DOC, "utf8");
const lines = doc.split("\n");

const headRe = (ver) => new RegExp("^(#{1,6}\\s+|[-*]\\s+\\**|\\*\\*)v?" + ver.replace(".", "\\.") + "\\b");

if (lines.some((l) => headRe(V).test(l))) {
  console.log("SKIP  " + DOC + " already has a v" + V + " entry");
  process.exit(0);
}

const prevIdx = [];
lines.forEach((l, i) => { if (headRe(PREV).test(l)) prevIdx.push(i); });
if (prevIdx.length !== 1) {
  console.log("MISS  expected exactly 1 heading line for v" + PREV + ", found " + prevIdx.length + " - ABORT");
  for (const i of prevIdx) console.log("      line " + (i + 1) + ": " + lines[i]);
  if (!prevIdx.length) {
    console.log("      candidates containing '" + PREV + "':");
    lines.forEach((l, i) => { if (l.includes(PREV)) console.log("      line " + (i + 1) + ": " + l); });
  }
  process.exit(1);
}
const pi = prevIdx[0];
const tpl = lines[pi];
console.log("INFO  template entry (line " + (pi + 1) + "): " + tpl.slice(0, 90));

/* mirror the template: prefix up to the version token + the separator after it */
const m = tpl.match(new RegExp("^(.*?v?)(" + PREV.replace(".", "\\.") + ")((?:\\*\\*)?[\\s:\\u2014\\u2013-]*)"));
if (!m) { console.log("MISS  could not parse template line style - ABORT"); process.exit(1); }
const newLine = m[1] + V + m[3] + ENTRY_TEXT;

/* list order: compare all version headings top-to-bottom */
const anyHead = /^(?:#{1,6}\s+|[-*]\s+\**|\*\*)v?(\d+\.\d+)\b/;
const found = [];
lines.forEach((l, i) => { const h = l.match(anyHead); if (h) found.push({ i, v: h[1] }); });
const num = (s) => { const [a, b] = s.split(".").map(Number); return a * 1000 + b; };
const ascending = found.length >= 2 ? num(found[0].v) < num(found[found.length - 1].v) : true;
console.log("INFO  history order: " + (ascending ? "ascending (newest last)" : "descending (newest first)") + ", " + found.length + " entries");

let insertAt;
if (ascending) {
  insertAt = pi + 1;
  while (insertAt < lines.length && !anyHead.test(lines[insertAt]) && !/^#{1,6}\s/.test(lines[insertAt])) insertAt++;
  while (insertAt > pi + 1 && lines[insertAt - 1].trim() === "") insertAt--;
} else {
  insertAt = pi;
}
const blankSep = (pi > 0 && lines[pi - 1].trim() === "") || (pi + 1 < lines.length && lines[pi + 1].trim() === "");
lines.splice(insertAt, 0, ...(blankSep ? (ascending ? ["", newLine] : [newLine, ""]) : [newLine]));
writeFileSync(DOC, lines.join("\n"));
console.log("OK    inserted v" + V + " entry at line " + (insertAt + 1));
console.log("DONE  " + DOC + " written");
