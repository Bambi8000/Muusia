/* Era patch: Test Card - "Label size mm" parameter.
   Run from the repo root: node tools/era/patch-testcard-labelsize.mjs
   Requires patch-testcard-thick.mjs and patch-testcard-thick-labels.mjs first.
   Anchored exact-string replacement across four files; idempotent (SKIP on the
   sentinel), MISS-aborts before writing anything.

   Why: a 2.3 mm marker needs ~10 mm numerals to be legible; 4 mm fixed labels
   plot as blobs. Label size mm (def 2.2, the old fine size) scales every
   numeral and label in the node and the cell title with it. At the default the
   fine tests are byte-identical to before (regression-checked).

   What changes:
   - new param labelSize "Label size mm" 1.5..12 (showIf labels)
   - numerals are labelSize tall (thick keeps 4 mm at the default 2.2); the
     other labels scale by labelSize / 2.2
   - header band above each cell grows with the label size
     (hdr = 6 + 2.6 * max(0, labelSize - 2.2)); when it is taller than the
     default 6 mm, a title that would be shrunk to fit the cell width wraps
     onto two lines (split at the word boundary that gives the narrowest line)
   - line spacing: label rows 2 or 3 (as many lanes as the numerals need), lines
     shorten to leave room; weight sweep: lines shorten so the pass label fits;
     hatch label band and palette label band grow with the size
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

if (src.node.includes('key: "labelSize"')) {
  console.log("SKIP  patch-testcard-labelsize already applied (sentinel found)");
  process.exit(0);
}
if (!src.node.includes("const LZ = thick")) {
  console.log("MISS  patch-testcard-thick-labels not applied yet - run it first - ABORT");
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
    file: "node", name: "param: Label size mm",
    old: `    { key: "labelPen", label: "Label pen", type: "pen", def: 0 },`,
    neu: `    { key: "labelPen", label: "Label pen", type: "pen", def: 0 },
    { key: "labelSize", label: "Label size mm", type: "slider", min: 1.5, max: 12, step: 0.5, def: 2.2, showIf: (p) => !!p.labels },`,
  },
  {
    file: "node", name: "compute: label scale LS and header band hdr",
    old: `    const m = p.margin;`,
    neu: `    const m = p.margin;
    /* nimiokoko: 2.2 mm on vanha kiintea koko, LS skaalaa kaikki nimiot siita.
       otsikkokaista solun ylla kasvaa nimion mukana (oletuksena 6 mm kuten ennen). */
    const LSZ = Math.max(1.5, Math.min(12, Number.isFinite(+p.labelSize) ? +p.labelSize : 2.2));
    const LS = LSZ / 2.2;
    const hdr = 6 + 2.6 * Math.max(0, LSZ - 2.2);`,
  },
  {
    file: "node", name: "drawTest header: LZ scales, title wraps when the band allows",
    old: `      const LZ = thick ? Math.max(2.2, Math.min(4, (cs - 6) / 14)) : 2.2;
      if (p.labels) {
        /* otsikko kutistuu solun levyiseksi - pitkat nimet eivat vuoda viereiseen soluun */
        const tw = fontStrokes(name, 10, 1).width / 10;
        const tz = Math.min(thick ? 4.5 : 3.4, cs * (thick ? 0.075 : 0.055), tw > 0 ? cs / tw : 3.4);
        label(name, x0, y0 - 3 - Math.max(0, tz - 3.4), tz);
      }`,
    neu: `      /* Label size on absoluuttinen numerokorkeus; thick-oletus (2.2) nostaa sen 4 mm:iin */
      const LZ = thick ? Math.max(LSZ, Math.min(4, (cs - 6) / 14)) : LSZ;
      if (p.labels) {
        /* otsikko kutistuu solun levyiseksi - pitkat nimet eivat vuoda viereiseen soluun.
           kun otsikkokaista on oletusta korkeampi (Label size > 2.2), leveyden takia
           kutistettu otsikko rivittyy kahdelle riville sanarajasta, joka antaa
           kapeimman rivin - ja saa nain isomman koon. */
        const tw = fontStrokes(name, 10, 1).width / 10;
        const target = Math.min((thick ? 4.5 : 3.4) * LS, cs * (thick ? 0.075 : 0.055) * LS, hdr + 0.4);
        let lines = [name];
        let tz = Math.min(target, tw > 0 ? cs / tw : target);
        if (hdr > 6 && tz < target * 0.9) {
          const words = name.split(" ");
          let best = null;
          for (let k = 1; k < words.length; k++) {
            const a = words.slice(0, k).join(" "), b = words.slice(k).join(" ");
            const w = Math.max(fontStrokes(a, 10, 1).width, fontStrokes(b, 10, 1).width) / 10;
            if (!best || w < best.w) best = { w, a, b };
          }
          if (best && best.w > 0) {
            const tz2 = Math.min(target, cs / best.w, (hdr + 0.4) / 2.25);
            if (tz2 > tz * 1.15) { lines = [best.a, best.b]; tz = tz2; }
          }
        }
        const yLast = y0 - 3 - Math.max(0, tz - 3.4);
        for (let li = 0; li < lines.length; li++) label(lines[li], x0, yLast - (lines.length - 1 - li) * tz * 1.25, tz);
      }`,
  },
  {
    file: "node", name: "weight sweep: pass label at LZ, line shortens so the label fits",
    old: `        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const passes = r + 1;
          for (let q = 0; q < passes; q++) {
            line([ix, y + (q - passes / 2) * off], [ix + iw * 0.8, y + (q - passes / 2) * off]);
          }
          if (p.labels) {
            const lz = thick ? Math.max(2.2, Math.min(LZ, (iw * 0.16 - 0.4) / 2.2)) : 2.6;
            label(passes + "x", ix + iw * 0.84, thick ? y - lz / 2 : y + 1.2, lz);
          }
        }`,
    neu: `        /* nimio "6x" on 2.2 x korkeus levea; viiva lyhenee jos nimio ei muuten mahdu */
        const big = thick || LS > 1;
        const lz = big ? Math.min(thick ? LZ : 2.6 * LS, (ih / rows) * 0.85) : 2.6;
        const lx = big ? Math.min(ix + iw * 0.84, ix + iw - 2.2 * lz) : ix + iw * 0.84;
        const lend = (big && p.labels) ? Math.min(ix + iw * 0.8, lx - 1) : ix + iw * 0.8;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const passes = r + 1;
          for (let q = 0; q < passes; q++) {
            line([ix, y + (q - passes / 2) * off], [lend, y + (q - passes / 2) * off]);
          }
          if (p.labels) label(passes + "x", lx, thick ? y - lz / 2 : y + 1.2, lz);
        }`,
  },
  {
    file: "node", name: "line spacing: 2-3 label rows as the numerals need, lines shorten",
    old: `        const sz = thick
          ? Math.max(1, Math.min(LZ, (2 * pitch - 0.8) / 2.7))
          : Math.max(1, Math.min(2.2, (2 * pitch - 0.8) / 3.6));
        const lineH = thick ? ih - (2 * sz + 3) : ih * 0.78;`,
    neu: `        /* nimio vie cw x korkeus leveytta; rivit (2..3) valitaan niin etta se mahtuu */
        const target = thick ? LZ : 2.2 * LS;
        const cw = thick ? 2.7 : 3.6;
        const big = thick || LS > 1;
        const rowsL = big ? Math.max(2, Math.min(3, Math.ceil(((cw + 0.6) * target) / pitch))) : 2;
        const sz = big
          ? Math.max(1, Math.min(target, (rowsL * pitch) / (cw + 0.6)))
          : Math.max(1, Math.min(target, (rowsL * pitch - 0.8) / cw));
        const lineH = big ? Math.max(ih * 0.3, ih - (rowsL * (sz + 0.8) + 2.2)) : ih * 0.78;`,
  },
  {
    file: "node", name: "line spacing: label row index by rowsL",
    old: `          if (p.labels) label(gaps[g] + "", grp, iy + lineH + 1.4 + (g % 2) * (sz + 0.8), sz);`,
    neu: `          if (p.labels) {
            /* isot nimiot tasataan oman kaistansa oikeaan reunaan: samalla rivilla olevat
               ovat rowsL kaistaa erillaan ja nimio on kapeampi, joten ne eivat tormaa,
               ja viimeinen paattyy tasan solun reunaan */
            const lx = big ? grp + pitch - fontStrokes(gaps[g] + "", sz, 1).width : grp;
            label(gaps[g] + "", lx, iy + lineH + 1.4 + (g % rowsL) * (sz + 0.8), sz);
          }`,
  },
  {
    file: "node", name: "hatch density: square height guarded",
    old: `          const qw = iw / 2 - 2, qh = ih / 2 - labH - 1;`,
    neu: `          const qw = iw / 2 - 2, qh = Math.max(2, ih / 2 - labH - 1);`,
  },
  {
    file: "node", name: "pen-lift label scales",
    old: `        if (p.labels) label("lift x" + (n * n), ix, iy + ih + 0.5, 2.4);`,
    neu: `        if (p.labels) label("lift x" + (n * n), ix, iy + ih + 0.5, 2.4 * LS);`,
  },
  {
    file: "node", name: "fill swatch labels scale",
    old: `        if (p.labels) { label("flat", ix, iy + ih * 0.78, 2.4); label("grid", x2, iy + ih * 0.78, 2.4); label("spir", cx - sw / 3, iy + ih * 0.78, 2.4); }`,
    neu: `        if (p.labels) { label("flat", ix, iy + ih * 0.78, 2.4 * LS); label("grid", x2, iy + ih * 0.78, 2.4 * LS); label("spir", cx - sw / 3, iy + ih * 0.78, 2.4 * LS); }`,
  },
  {
    file: "node", name: "speed ramp labels scale",
    old: `          if (p.labels) label(teeth + "", ix + iw + 0.5, y + 1, 2.4);`,
    neu: `          if (p.labels) label(teeth + "", ix + iw + 0.5, y + 1, 2.4 * LS);`,
  },
  {
    file: "node", name: "pen palette: label band and label scale",
    old: `        const labH = p.labels ? 5 : 1.5;`,
    neu: `        const labH = p.labels ? 5 * LS : 1.5;`,
  },
  {
    file: "node", name: "pen palette: label drawn at scale",
    old: `          if (p.labels) label(i + "", qx + qw / 2 - 1.2, qy + qh + 1.2, 2.4, i);`,
    neu: `          if (p.labels) label(i + "", qx + qw / 2 - 1.2 * LS, qy + qh + 1.2, 2.4 * LS, i);`,
  },
  {
    file: "node", name: "layout: header band hdr in fitH",
    old: `    const fitH = (H - 2 * m - 6 - (rowsN - 1) * (gap + 6) - 6) / rowsN;`,
    neu: `    const fitH = (H - 2 * m - hdr - (rowsN - 1) * (gap + hdr) - 6) / rowsN;`,
  },
  {
    file: "node", name: "layout: header band hdr in startY",
    old: `    let startY = m + 6;`,
    neu: `    let startY = m + hdr;`,
  },
  {
    file: "node", name: "layout: header band hdr in row pitch",
    old: `      const y0 = startY + r * (cs + gap + 6);`,
    neu: `      const y0 = startY + r * (cs + gap + hdr);`,
  },
  {
    file: "nodes", name: "NODES.md header version",
    old: "# MUUSIA v" + V + " — Node Reference",
    neu: "# MUUSIA v" + V2 + " — Node Reference",
  },
  {
    file: "nodes", name: "NODES.md Test Card paragraph",
    old: "wider pass offsets and 4 mm numerals (they shrink with the cell); set *Pen* to the thick pen and keep *Label pen* fine, or plot everything with the thick pen.",
    neu: "wider pass offsets and 4 mm numerals (they shrink with the cell). *Label size mm* scales every numeral and the cell titles — a 2.3 mm marker wants ~10 mm to stay legible; the header band grows with it and long titles wrap onto two lines. Or set *Pen* to the thick pen and keep *Label pen* fine.",
  },
  {
    file: "handoff", name: "HANDOFF version-history entry",
    old: "\n## Hard-won pitfalls (keep)\n",
    neu: `
- **${V2}** Test Card: *Label size mm* (1.5–12, def 2.2 = the old fixed size,
  showIf labels). Numerals are labelSize tall (thick keeps 4 mm at the
  default), other labels scale by labelSize/2.2; big Line-spacing labels sit
  right-aligned in their own lane on 2–3 rows; the header band grows with it
  (6 + 2.6·(size−2.2)) and, once taller than the default, width-shrunk titles
  wrap onto two lines at the word split giving the narrowest line. Line
  spacing picks 2 or 3 label rows as the numerals need and shortens its lines;
  weight sweep shortens lines so the pass label fits; hatch and palette label
  bands grow. Motivation: a Textmark 500 plot showed the nib is ~2.3 mm on
  paper, so 4 mm numerals are blobs — legible needs ~10 mm. Default output
  byte-identical to ${V} (fine tests; regression-checked). Era:
  tools/era/patch-testcard-labelsize.mjs; validate-testcard.mjs (182 checks) now covers
  labelSize liveness and 8/10 mm thick layouts for overlap.

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
