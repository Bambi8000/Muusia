/* Era patch: Test Card (thick) variants - bigger numerals and title.
   Run from the repo root: node tools/era/patch-testcard-thick-labels.mjs
   Requires patch-testcard-thick.mjs to be applied first (anchors live in it).
   Anchored exact-string replacement across four files; idempotent (SKIP on the
   sentinel), MISS-aborts before writing anything.

   What changes (thick variants only - fine tests are byte-identical):
   - numeric labels 4 mm cap height (2.2 mm before), shrinking with the cell
   - line-spacing lines shorten to leave room for two 4 mm label rows
   - hatch label band grows with the label
   - weight-sweep pass labels 4 mm, vertically centred on their row
   - cell title up to 4.5 mm (still capped by the cell width, so the long
     "(THICK)" names get bigger only as Cell size grows)
   - docs: NODES.md paragraph + header, HANDOFF entry, APP_VERSION +1 */

import { readFileSync, writeFileSync } from "node:fs";

const FILES = {
  node: "src/defs/nodes/testcard.js",
  nodes: "docs/MUUSIA-NODES.md",
  handoff: "docs/MUUSIA-HANDOFF.md",
  app: "src/App.jsx",
};
const src = {};
for (const k of Object.keys(FILES)) src[k] = readFileSync(FILES[k], "utf8");

let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.node.includes("const LZ = thick")) {
  console.log("SKIP  patch-testcard-thick-labels already applied (sentinel found)");
  process.exit(0);
}
if (!src.node.includes('"Line spacing (thick)"')) {
  console.log("MISS  patch-testcard-thick not applied yet - run it first - ABORT");
  process.exit(1);
}

const vm = src.app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
const vparts = V.split(".");
if (vparts.length !== 2 || !/^\d+$/.test(vparts[1])) { console.log("MISS  APP_VERSION '" + V + "' not in major.minor form - ABORT"); process.exit(1); }
const V2 = vparts[0] + "." + (parseInt(vparts[1], 10) + 1);
console.log("INFO  app version from repo: " + V + " -> " + V2);

const edits = [
  {
    file: "node", name: "drawTest header: LZ label size, bigger thick title",
    old: `      if (p.labels) {
        /* otsikko kutistuu solun levyiseksi - pitkat nimet eivat vuoda viereiseen soluun */
        const tw = fontStrokes(name, 10, 1).width / 10;
        label(name, x0, y0 - 3, Math.min(3.4, cs * 0.055, tw > 0 ? cs / tw : 3.4));
      }
      const thick = /\\(thick\\)$/.test(name);
      const base = thick ? name.replace(/ \\(thick\\)$/, "") : name;`,
    neu: `      const thick = /\\(thick\\)$/.test(name);
      const base = thick ? name.replace(/ \\(thick\\)$/, "") : name;
      /* thick: 4 mm nimiot ja isompi otsikko - 2 mm+ kyna ei piirra 2 mm merkkeja.
         kutistuvat solun mukana; fine-testit pysyvat ennallaan (2.2 / 3.4). */
      const LZ = thick ? Math.max(2.2, Math.min(4, (cs - 6) / 14)) : 2.2;
      if (p.labels) {
        /* otsikko kutistuu solun levyiseksi - pitkat nimet eivat vuoda viereiseen soluun */
        const tw = fontStrokes(name, 10, 1).width / 10;
        const tz = Math.min(thick ? 4.5 : 3.4, cs * (thick ? 0.075 : 0.055), tw > 0 ? cs / tw : 3.4);
        label(name, x0, y0 - 3 - Math.max(0, tz - 3.4), tz);
      }`,
  },
  {
    file: "node", name: "weight sweep pass labels: LZ-sized, centred on the row when thick",
    old: `          if (p.labels) label(passes + "x", ix + iw * 0.84, y + 1.2, 2.6);`,
    neu: `          if (p.labels) {
            const lz = thick ? Math.max(2.2, Math.min(LZ, (iw * 0.16 - 0.4) / 2.2)) : 2.6;
            label(passes + "x", ix + iw * 0.84, thick ? y - lz / 2 : y + 1.2, lz);
          }`,
  },
  {
    file: "node", name: "line spacing: thick label size + shorter lines for two 4 mm rows",
    old: `        const lineH = ih * 0.78;
        const sz = Math.max(1, Math.min(2.2, (2 * pitch - 0.8) / 3.6));`,
    neu: `        const sz = thick
          ? Math.max(1, Math.min(LZ, (2 * pitch - 0.8) / 2.7))
          : Math.max(1, Math.min(2.2, (2 * pitch - 0.8) / 3.6));
        const lineH = thick ? ih - (2 * sz + 3) : ih * 0.78;`,
  },
  {
    file: "node", name: "hatch density: label band grows with LZ",
    old: `        const labH = 3.4;
        for (let i = 0; i < 4; i++) {`,
    neu: `        const labH = LZ + 1.2;
        for (let i = 0; i < 4; i++) {`,
  },
  {
    file: "node", name: "hatch density: label drawn at LZ",
    old: `          if (p.labels) label(dens[i] + "", qx, qy + qh + 0.8, 2.2);`,
    neu: `          if (p.labels) label(dens[i] + "", qx, qy + qh + 0.8, LZ);`,
  },
  {
    file: "nodes", name: "NODES.md header version",
    old: "# MUUSIA v" + V + " — Node Reference",
    neu: "# MUUSIA v" + V2 + " — Node Reference",
  },
  {
    file: "nodes", name: "NODES.md Test Card paragraph",
    old: "gaps 8→2 mm, hatch 8→2.5 mm, wider pass offsets; set *Pen* to the thick pen and keep *Label pen* fine.",
    neu: "gaps 8→2 mm, hatch 8→2.5 mm, wider pass offsets and 4 mm numerals (they shrink with the cell); set *Pen* to the thick pen and keep *Label pen* fine, or plot everything with the thick pen.",
  },
  {
    file: "handoff", name: "HANDOFF version-history entry",
    old: "\n## Hard-won pitfalls (keep)\n",
    neu: `
- **${V2}** Test Card (thick) variants: 4 mm numerals (cap 2.2 → 4, shrinking
  with the cell), weight-sweep pass labels centred on their row, line-spacing
  lines shortened for two 4 mm label rows, hatch label band grows with the
  label, cell title up to 4.5 mm — still capped by the cell width, so the
  long "(THICK)" titles only grow with Cell size. Fine tests byte-identical
  (regression-checked in validate-testcard.mjs, now 103 checks incl. thick
  numeral height ≥ 1.7× fine). Era: tools/era/patch-testcard-thick-labels.mjs.

## Hard-won pitfalls (keep)
`,
  },
  {
    file: "app", name: "APP_VERSION bump",
    old: 'APP_VERSION = "' + V + '"',
    neu: 'APP_VERSION = "' + V2 + '"',
  },
];

for (const e of edits) {
  const parts = src[e.file].split(e.old);
  if (parts.length === 2) { src[e.file] = parts.join(e.neu); OK(e.name); }
  else if (parts.length === 1) MISS(e.name + " (anchor not found in " + FILES[e.file] + ")");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits in " + FILES[e.file] + ")");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - nothing written");
  process.exit(1);
}
for (const k of Object.keys(FILES)) writeFileSync(FILES[k], src[k]);
console.log("DONE  " + ok + "/" + edits.length + " edits applied; " + Object.values(FILES).join(", ") + " written; version " + V + " -> " + V2);
