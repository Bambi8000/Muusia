#!/usr/bin/env node
/* patch-docs-v250.mjs — one-shot doc batch for the v2.50 release:
   Mega Canvas Roll (wallpaper) kind, DXF R12 export, DRO fixed-width chip +
   https blocked state, roll piece-label text. Updates docs/MUUSIA-NODES.md
   (title version — no node changes), README.md (export bullets + Mega Canvas
   paragraph), docs/MUUSIA-HANDOFF.md (repo-layout dro note, UI-systems
   bullets, version history entry, hard-won pitfall). Run ONCE from the repo
   root AFTER the App.jsx version bump:
     node tools/era/patch-docs-v250.mjs
   Anchored exact-string replacement, OK/MISS/SKIP report per file.
   NOT idempotent — do not re-run after success. */
import fs from "node:fs";

const FILES = {
  nodes: "docs/MUUSIA-NODES.md",
  readme: "README.md",
  handoff: "docs/MUUSIA-HANDOFF.md",
};

const EDITS = [
  /* ---------------- NODES.md: title only, no node changes ---------------- */
  {
    file: "nodes",
    name: "NODES title version",
    old: `# MUUSIA v2.49 — Node Reference`,
    neu: `# MUUSIA v2.50 — Node Reference`,
  },

  /* ---------------- README.md ---------------- */
  {
    file: "readme",
    name: "README export DXF bullet",
    old: `- **EXPORT SVG** — millimetre-true SVG with one group per pen layer.`,
    neu: `- **EXPORT SVG** — millimetre-true SVG with one group per pen layer.
- **EXPORT DXF** — DXF R12 for laser cutting: POLYLINE entities on one layer per
  pen (\`PEN_0\`…\`PEN_11\`, nearest-ACI colors so LightBurn/RDWorks pick them up as
  separate cut layers), y flipped to DXF's y-up so the file opens the same way up
  as the SVG. Millimetre-true; R12 carries no unit field, so answer "mm" if the
  importer asks. Point z (pen plunge) is dropped — laser output is 2D.`,
  },
  {
    file: "readme",
    name: "README Mega Canvas Roll paragraph",
    old: `**Mega Canvas (multi-sheet).** Compose on a virtual canvas of C x R sheets with
**Overlap** or **Gap** seams; export slices the work into per-sheet tiles with
optional crop marks on a chosen pen and downloads everything as **one ZIP**
(\`name-tile-01-r1c1.gcode\`, ...). The bed diagram and previews show the full mega
canvas. Optional tile labels draw a running number + row/col small in each sheet's
bottom-left corner on the mark pen, for sorting the physical sheets. *Download
full SVG (composed proof)* saves the whole composed work as one SVG at full mega
size — a proofing reference to compare against the preview; the numbered tiles
remain the plottable output.`,
    neu: `**Mega Canvas (multi-sheet).** Compose on a virtual canvas of C x R sheets with
**Overlap** or **Gap** seams; export slices the work into per-sheet tiles with
optional crop marks on a chosen pen and downloads everything as **one ZIP**
(\`name-tile-01-r1c1.gcode\`, ...). The bed diagram and previews show the full mega
canvas. Optional tile labels draw a running number + row/col small in each sheet's
bottom-left corner on the mark pen, for sorting the physical sheets. *Download
full SVG (composed proof)* saves the whole composed work as one SVG at full mega
size — a proofing reference to compare against the preview; the numbered tiles
remain the plottable output.

**Mega Canvas Roll (wallpaper).** Switch the mega **Kind** from Sheets to
**Roll** to compose onto adjacent wallpaper strips: set the **Roll width**
(530 mm default), the number of **Strips**, the strip **Length** (e.g. wall
height) and the **Piece** length one machine setup can plot. The seam +
Overlap/Gap applies only between strips (Overlap = hang overlapped and
double-cut; Gap = hang with spacing); along the roll there is **no seam** —
pieces continue exactly, and registration ticks are drawn on both roll edges at
every piece boundary: after advancing the roll, align the pen at y=0 with the
ticks plotted at the end of the previous piece. Piece labels read \`S1 P2\`
(strip/piece) and files download as \`name-strip-01-piece-02.gcode\` so they sort
in plotting order, one strip at a time. The last piece is shorter when Length
does not divide evenly; the summary warns if a piece exceeds the machine work
area. Works with G-code, SVG and DXF downloads and with the magnet jig.`,
  },

  /* ---------------- HANDOFF: repo layout dro note ---------------- */
  {
    file: "handoff",
    name: "HANDOFF dro.jsx repo-layout note",
    old: `- \`src/dro.jsx\` — Moonraker DRO: self-contained read-only websocket client +
  top-bar chip (live X/Y/Z, homed-axes dimming, 3 s auto-reconnect,
  re-subscribe on klippy restart). URL in the machine profile
  (\`moonrakerUrl\`). LAN/local only by design — the Pages build shows a
  red/failed DRO (https page cannot open insecure ws://; correct, not a bug).
  Wired into App.jsx via tools/era/patch-dro.mjs.`,
    neu: `- \`src/dro.jsx\` — Moonraker DRO: self-contained read-only websocket client +
  top-bar chip (live X/Y/Z, homed-axes dimming, 3 s auto-reconnect,
  re-subscribe on klippy restart). URL in the machine profile
  (\`moonrakerUrl\`). LAN/local only by design — since v2.50 an https origin
  with a ws:// URL never attempts to connect (mixed content cannot succeed):
  the Pages build shows a static dim "DRO LAN only" chip instead of a retry
  loop. The chip is fixed-width (constant "DRO" label, state in the dot color
  + tooltip, always-rendered X/Y/Z slots with tabular figures and dashes) so
  state transitions never reflow the top bar.
  Wired into App.jsx via tools/era/patch-dro.mjs.`,
  },

  /* ---------------- HANDOFF: UI systems bullets ---------------- */
  {
    file: "handoff",
    name: "HANDOFF UI DRO bullet",
    old: `- **Moonraker DRO:** top-bar chip (src/dro.jsx) — click toggles the
  connection; green = klippy ready, amber = connecting / klippy down, red =
  retrying. Requires the local dev origins in Moonraker's cors_domains
  (klipper/moonraker-cors.snippet.conf, applied on nakit). Read-only: it
  never sends G-code.`,
    neu: `- **Moonraker DRO:** top-bar chip (src/dro.jsx) — click toggles the
  connection; green = klippy ready, amber = connecting / klippy down, red =
  retrying; the label is always "DRO" and the X/Y/Z slots are fixed-width
  (dashes while offline), so the top bar never jumps. On an https origin
  with a ws:// URL the chip is a static dim "LAN only" (no retry loop).
  Requires the local dev origins in Moonraker's cors_domains
  (klipper/moonraker-cors.snippet.conf, applied on nakit). Read-only: it
  never sends G-code.`,
  },
  {
    file: "handoff",
    name: "HANDOFF UI Mega bullet",
    old: `- **Animation, Mega Canvas, Mini Canvas, magnet jig, machine profiles,
  Travel Stop, custom modules:** unchanged since v2.0–2.1 era; see MUUSIA-NODES.md
  and README for user-facing docs. Magnet jig functions (\`magnetPlacement\`,
  \`jigGcode\`, \`buildZip\`/\`crc32\`) live above APP_VERSION in App.jsx.`,
    neu: `- **Animation, Mini Canvas, magnet jig, machine profiles,
  Travel Stop, custom modules:** unchanged since v2.0–2.1 era; see MUUSIA-NODES.md
  and README for user-facing docs. Magnet jig functions (\`magnetPlacement\`,
  \`jigGcode\`, \`buildZip\`/\`crc32\`) live above APP_VERSION in App.jsx.
- **Mega Canvas Kinds (v2.50):** Sheets (the original C×R grid, sliceMega) or
  **Roll** — wallpaper strips: roll width × strips side by side (seam join in X
  only), pieces along the roll with no Y seam (sliceRoll, per-tile W/H, short
  last piece), registration ticks at piece boundaries, \`S# P#\` labels,
  \`strip-XX-piece-YY\` filenames, jig split and patch save/load fields
  (\`mega.kind\` + roll params; old patches load as Sheets byte-identically).
  Export kinds: G-code, SVG, and **DXF R12** (toDXF next to toSVG: POLYLINE
  per path on PEN_n layers, nearest-ACI colors, y-up flip, plunge z dropped).`,
  },

  /* ---------------- HANDOFF: version history entry ---------------- */
  {
    file: "handoff",
    name: "HANDOFF version history 2.50",
    old: `## Hard-won pitfalls (keep)`,
    neu: `- **2.50** app-level batch, no node changes. **Mega Canvas Roll kind**
  (wallpaper mode): sliceRoll beside sliceMega — C strips of fixed roll width
  (seam + Overlap/Gap in X only), seamless pieces along the roll (validated:
  Σ clipped = exact total length, exact butt joints), per-tile W/H with a
  short last piece, edge registration ticks at every internal boundary,
  S#/P# labels, strip-XX-piece-YY filenames, jig split, mega.kind + roll
  fields in patch save/load (old patches → Sheets). **DRO chip rewrite**
  (src/dro.jsx full replacement): constant-width chip — label always "DRO",
  state in dot color + tooltip, always-rendered fixed-width X/Y/Z slots with
  tabular figures — the top bar no longer reflows on the reconnect cycle;
  https origin + ws:// URL = static "LAN only" state with zero connection
  attempts (mixed content can never succeed). **DXF R12 export**: toDXF next
  to toSVG (POLYLINE entities preserving path continuity, PEN_n layers with
  nearest-ACI colors from the live pen palette, LTYPE/LAYER tables, y-up
  flip, -0 guard, plunge z dropped), EXPORT DXF button, dxf kind through
  preview/download/mega tiles. Applied via tools/era/patch-mega-roll.mjs,
  patch-roll-labels-text.mjs, patch-dxf-export.mjs + patch-dxf-hoist.mjs
  (see pitfall below — the pair is the correct as-applied history).
  Validators: validate-mega-roll.mjs (14 oracles incl. seam/continuity
  conservation), validate-dxf.mjs (20 oracles incl. module-scope + toSVG
  smoke). Lessons: era-patch INSERTION DIRECTION must be reviewed
  (\`NEW + anchor\` vs \`anchor + NEW\` — the dxf patch nested toDXF inside
  toSVG's return array, where the following template literal parsed as a
  tagged-template call: syntactically valid, build green, toSVG dead at
  runtime and toDXF gone from module scope); and a validator that extracts a
  function from App.jsx proves nothing about that function's scope — every
  extract-style validator now smoke-runs the neighbour function it was
  inserted next to.

## Hard-won pitfalls (keep)`,
  },

  /* ---------------- HANDOFF: pitfalls ---------------- */
  {
    file: "handoff",
    name: "HANDOFF pitfall tagged-template insertion",
    old: `- Era-patch changes to App.jsx can VANISH silently if a later session`,
    neu: `- Era-patch INSERTIONS can land inside the anchor's enclosing scope and stay
  syntactically valid: a function expression dropped into an array literal
  turns the next template-literal element into a tagged-template CALL — the
  build passes while the host function dies at runtime and the inserted
  function never reaches module scope (the v2.50 toDXF/toSVG incident).
  Review \`NEW + anchor\` vs \`anchor + NEW\` on every insertion edit, and give
  every extract-and-run validator a smoke test of the neighbour function.
- Era-patch changes to App.jsx can VANISH silently if a later session`,
  },
];

const texts = {};
for (const [k, p] of Object.entries(FILES)) {
  try { texts[k] = fs.readFileSync(p, "utf8"); }
  catch (e) { console.log(`MISS: cannot read ${p}`); process.exitCode = 1; }
}
if (process.exitCode) process.exit();

if (texts.handoff.includes("**2.50**")) {
  console.log("SKIP: HANDOFF already has a 2.50 entry — doc batch already applied.");
  process.exitCode = 0;
} else {
  let miss = 0;
  for (const e of EDITS) {
    const t = texts[e.file];
    const n = t.split(e.old).length - 1;
    if (n !== 1) {
      console.log(`MISS (${n} matches): ${e.name}`);
      miss++;
      continue;
    }
    texts[e.file] = t.replace(e.old, e.neu);
    console.log(`OK: ${e.name}`);
  }
  if (miss) {
    console.log(`\n${miss} anchor(s) MISSED — nothing written.`);
    process.exitCode = 1;
  } else {
    for (const [k, p] of Object.entries(FILES)) fs.writeFileSync(p, texts[k]);
    console.log(`\nAll ${EDITS.length} edits applied — ${Object.values(FILES).join(", ")} written.`);
  }
}
