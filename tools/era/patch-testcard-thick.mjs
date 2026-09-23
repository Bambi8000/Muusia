/* Era patch: Test Card - label overlap fix + thick-pen (2 mm+) variants.
   Run from the repo root: node tools/era/patch-testcard-thick.mjs
   Anchored exact-string replacement across four files; idempotent (SKIP on the
   sentinel), MISS-aborts before writing anything, reports OK / MISS per edit.

   What changes:
   - src/defs/nodes/testcard.js
     * Line spacing: each gap group stays inside its own lane (no more lines
       running into the next group), labels alternate on two rows and shrink to
       fit two lanes, so "0.35" and "0.25" never overprint.
     * Hatch density: label moves BELOW its square (was inside, over the hatch
       and the border); squares get shorter by the label band.
     * Three new Tests options for thick pens: "Line weight sweep (thick)",
       "Line spacing (thick)", "Hatch density (thick)" - same tests, series
       chosen for 2 mm+ nibs (gaps 8..2 mm, hatch 8..2.5 mm, pass offset 0.8 mm).
     * Cell title shrinks to the cell width (long names no longer overflow).
     * Default Tests list unchanged; the two fixed tests do change geometry
       for saved patches (calibration sheet, not artwork).
   - docs/MUUSIA-NODES.md: Test Card paragraph + header version
   - docs/MUUSIA-HANDOFF.md: version-history entry
   - src/App.jsx: APP_VERSION bumped by one patch step (read from the repo)
*/

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

/* idempotence sentinel: only exists in the patched node */
if (src.node.includes('"Line spacing (thick)"')) {
  console.log("SKIP  patch-testcard-thick already applied (sentinel found)");
  process.exit(0);
}

/* facts from the repo */
const vm = src.app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
const vparts = V.split(".");
if (vparts.length !== 2 || !/^\d+$/.test(vparts[1])) { console.log("MISS  APP_VERSION '" + V + "' not in major.minor form - ABORT"); process.exit(1); }
const V2 = vparts[0] + "." + (parseInt(vparts[1], 10) + 1);
console.log("INFO  app version from repo: " + V + " -> " + V2);

const NEW_DESC = "Calibration sheets for pen and machine: line weight sweep (repeat passes), converging line spacing, hatch density squares, arcs and tight circles, pen-lift dot grid, fill swatches, registration marks, a speed-ramp zigzag - and a Pen palette that draws one labelled swatch per pen (all 12) for ink checks. The three pen tests also come in (thick) variants with series chosen for 2 mm+ nibs (gaps 8 to 2 mm, hatch 8 to 2.5 mm, wider pass offsets) - set Pen to the thick pen and keep Label pen fine. The grid auto-shrinks its cells to fit the current canvas.";

const edits = [
  /* ---------------- node ---------------- */
  {
    file: "node", name: "node desc",
    old: 'desc: "Calibration sheets for pen and machine: line weight sweep (repeat passes), converging line spacing, hatch density squares, arcs and tight circles, pen-lift dot grid, fill swatches, registration marks, a speed-ramp zigzag - and a Pen palette that draws one labelled swatch per pen (all 12) for ink checks. The grid auto-shrinks its cells to fit the current canvas.",',
    neu: 'desc: "' + NEW_DESC + '",',
  },
  {
    file: "node", name: "Tests options: three thick variants",
    old: 'options: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles",',
    neu: 'options: ["Line weight sweep", "Line spacing", "Hatch density", "Line weight sweep (thick)", "Line spacing (thick)", "Hatch density (thick)", "Arcs & circles",',
  },
  {
    file: "node", name: "drawTest header: thick flag, base name, title fits cell",
    old: `    const drawTest = (name, x0, y0, cs) => {
      if (p.labels) label(name, x0, y0 - 3, Math.min(3.4, cs * 0.055));
      const pad = 3;
      const ix = x0 + pad, iy = y0 + pad, iw = cs - pad * 2, ih = cs - pad * 2;
      if (name === "Line weight sweep") {`,
    neu: `    const drawTest = (name, x0, y0, cs) => {
      if (p.labels) {
        /* otsikko kutistuu solun levyiseksi - pitkat nimet eivat vuoda viereiseen soluun */
        const tw = fontStrokes(name, 10, 1).width / 10;
        label(name, x0, y0 - 3, Math.min(3.4, cs * 0.055, tw > 0 ? cs / tw : 3.4));
      }
      const thick = /\\(thick\\)$/.test(name);
      const base = thick ? name.replace(/ \\(thick\\)$/, "") : name;
      const pad = 3;
      const ix = x0 + pad, iy = y0 + pad, iw = cs - pad * 2, ih = cs - pad * 2;
      if (base === "Line weight sweep") {`,
  },
  {
    file: "node", name: "Line weight sweep: pass offset by nib class",
    old: `        const rows = 6;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const passes = r + 1;
          for (let q = 0; q < passes; q++) {
            line([ix, y + (q - passes / 2) * 0.15], [ix + iw * 0.8, y + (q - passes / 2) * 0.15]);
          }`,
    neu: `        const rows = 6;
        /* thick: 0.8 mm askel levittaa 2 mm+ kynan vedot nauhaksi; kutistuu pienissa soluissa */
        const off = thick ? Math.min(0.8, (ih / rows) * 0.14) : 0.15;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const passes = r + 1;
          for (let q = 0; q < passes; q++) {
            line([ix, y + (q - passes / 2) * off], [ix + iw * 0.8, y + (q - passes / 2) * off]);
          }`,
  },
  {
    file: "node", name: "Line spacing + Hatch density blocks (lanes, two-row labels, labels below squares, thick series)",
    old: `      } else if (name === "Line spacing") {
        /* tihenevat pystyviivat: nakee milloin viivat sulautuvat / kynan leveys */
        const gaps = [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25];
        let x = ix;
        for (let g = 0; g < gaps.length && x < ix + iw; g++) {
          const grp = ix + (g / gaps.length) * iw;
          for (let k = 0; k < 5; k++) {
            const xx = grp + k * gaps[g];
            if (xx < ix + iw) line([xx, iy], [xx, iy + ih * 0.82]);
          }
          if (p.labels) label(gaps[g] + "", grp, iy + ih * 0.9, 2.2);
        }
      } else if (name === "Hatch density") {
        /* nelja ruutua kasvavalla viivoitustiheydella + ristikko */
        const dens = [2.5, 1.5, 1, 0.6];
        for (let i = 0; i < 4; i++) {
          const qx = ix + (i % 2) * (iw / 2), qy = iy + Math.floor(i / 2) * (ih / 2);
          const qw = iw / 2 - 2, qh = ih / 2 - 2;
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true);
          for (let y = qy + dens[i]; y < qy + qh; y += dens[i]) line([qx, y], [qx + qw, y]);
          if (i >= 2) for (let x = qx + dens[i]; x < qx + qw; x += dens[i]) line([x, qy], [x, qy + qh]);
          if (p.labels) label(dens[i] + "", qx + 1, qy + qh - 1, 2.2);
        }
      } else if (name === "Arcs & circles") {`,
    neu: `      } else if (base === "Line spacing") {
        /* tihenevat pystyviivat: nakee milloin viivat sulautuvat / kynan leveys.
           jokainen ryhma pysyy omassa kaistassaan (ei vuoda seuraavaan), nimiot
           vuorottelevat kahdella rivilla ja kutistuvat kahden kaistan levyisiksi.
           thick: sarja 2 mm+ kynille. */
        const gaps = thick ? [8, 6, 4.5, 3.5, 2.5, 2] : [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25];
        const pitch = iw / gaps.length;
        const lineH = ih * 0.78;
        const sz = Math.max(1, Math.min(2.2, (2 * pitch - 0.8) / 3.6));
        for (let g = 0; g < gaps.length; g++) {
          const grp = ix + g * pitch;
          for (let k = 0; k < 5; k++) {
            const xx = grp + k * gaps[g];
            if (xx > grp + pitch - 1) break;
            line([xx, iy], [xx, iy + lineH]);
          }
          if (p.labels) label(gaps[g] + "", grp, iy + lineH + 1.4 + (g % 2) * (sz + 0.8), sz);
        }
      } else if (base === "Hatch density") {
        /* nelja ruutua kasvavalla viivoitustiheydella + ristikko. nimio ruudun ALLA
           omassa kaistassaan (sisalla se meni viivoituksen ja reunan paalle).
           thick: sarja 2 mm+ kynille. */
        const dens = thick ? [8, 5, 3.5, 2.5] : [2.5, 1.5, 1, 0.6];
        const labH = 3.4;
        for (let i = 0; i < 4; i++) {
          const qx = ix + (i % 2) * (iw / 2), qy = iy + Math.floor(i / 2) * (ih / 2);
          const qw = iw / 2 - 2, qh = ih / 2 - labH - 1;
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true);
          for (let y = qy + dens[i]; y < qy + qh; y += dens[i]) line([qx, y], [qx + qw, y]);
          if (i >= 2) for (let x = qx + dens[i]; x < qx + qw; x += dens[i]) line([x, qy], [x, qy + qh]);
          if (p.labels) label(dens[i] + "", qx, qy + qh + 0.8, 2.2);
        }
      } else if (base === "Arcs & circles") {`,
  },
  /* ---------------- docs ---------------- */
  {
    file: "nodes", name: "NODES.md header version",
    old: "# MUUSIA v" + V + " — Node Reference",
    neu: "# MUUSIA v" + V2 + " — Node Reference",
  },
  {
    file: "nodes", name: "NODES.md Test Card paragraph",
    old: "**Test Card** — calibration sheets: line weight sweep, converging line spacing, hatch density, arcs & tight circles, pen-lift dot grid, fill swatches, registration marks, speed-ramp zigzag, and a *Pen palette* drawing one labelled swatch per pen (all 12). The grid auto-shrinks its cells to fit the current canvas.",
    neu: "**Test Card** — calibration sheets: line weight sweep, converging line spacing, hatch density, arcs & tight circles, pen-lift dot grid, fill swatches, registration marks, speed-ramp zigzag, and a *Pen palette* drawing one labelled swatch per pen (all 12). The three pen tests also come as *(thick)* variants with series chosen for 2 mm+ nibs — gaps 8→2 mm, hatch 8→2.5 mm, wider pass offsets; set *Pen* to the thick pen and keep *Label pen* fine. Line-spacing groups each stay in their own lane with labels on two alternating rows, hatch labels sit below their squares. The grid auto-shrinks its cells to fit the current canvas.",
  },
  {
    file: "handoff", name: "HANDOFF version-history entry",
    old: "\n## Hard-won pitfalls (keep)\n",
    neu: `
- **${V2}** Test Card fixes + thick-pen variants. Line spacing: gap groups no
  longer run into the next lane (lines clip at their own pitch), labels sit on
  two alternating rows and shrink to two lanes' width — "0.35"/"0.25" used to
  overprint. Hatch density: label moved BELOW its square (was inside, over the
  hatch and the border). Three new Tests options — *Line weight sweep (thick)*,
  *Line spacing (thick)*, *Hatch density (thick)* — same tests with series for
  2 mm+ nibs (gaps 8/6/4.5/3.5/2.5/2, hatch 8/5/3.5/2.5, pass offset 0.8 mm);
  cell titles shrink to the cell width. Default Tests list unchanged; the two
  fixed tests change geometry for saved patches (calibration sheet, accepted).
  Era: tools/era/patch-testcard-thick.mjs (node + docs + version, one
  all-or-nothing patch). New tools/validate-testcard.mjs (label clusters =
  label count, labels never overlap test lines, lanes hold, thick series
  exact, thick ≠ fine, Pen pin only on Pen) — mutation-tested against the
  pre-patch node (cluster and lane checks fail there).

## Hard-won pitfalls (keep)
`,
  },
  /* ---------------- version ---------------- */
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
