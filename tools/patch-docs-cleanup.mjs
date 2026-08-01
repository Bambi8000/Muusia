// patch-docs-cleanup.mjs — doc batch: repo cleanup + deployment conventions
// Run from repo root: node tools/patch-docs-cleanup.mjs
// One-shot, anchored string replacement, OK/MISS report. NOT idempotent —
// move to tools/era/ after applying.
import fs from "fs";

let okAll = true;
function patchFile(path, edits) {
  let txt = fs.readFileSync(path, "utf8");
  for (const [name, anchor, replacement, sentinel] of edits) {
    if (txt.includes(sentinel)) {
      console.log(`SKIP  ${name}  (already applied) in ${path}`);
      continue;
    }
    const n = txt.split(anchor).length - 1;
    if (n !== 1) {
      console.log(`MISS  ${name}  (anchor found ${n}x) in ${path}`);
      okAll = false;
      continue;
    }
    txt = txt.replace(anchor, replacement);
    console.log(`OK    ${name}`);
  }
  fs.writeFileSync(path, txt);
}

/* ---------------- docs/MUUSIA-HANDOFF.md ---------------- */
patchFile("docs/MUUSIA-HANDOFF.md", [
  [
    "docs-list: plotter docs + generated NODES-SRC",
    "  MUUSIA-MAP.md (OSM map import guide: overpass-turbo workflow, sizing, queries).",
    "  MUUSIA-MAP.md (OSM map import guide: overpass-turbo workflow, sizing, queries),\n" +
    "  MUUSIA-PLOTTER-MECH-HANDOFF.md (X-Carve build: mechanics + ink blot tool),\n" +
    "  MUUSIA-MAGNET-JIG-SPEC.md (safe-areas / laser jig feature, design complete),\n" +
    "  MUUSIA-NODES-SRC.md (generated here by `tools/make-src-bundle.mjs`).",
    "MUUSIA-PLOTTER-MECH-HANDOFF.md (X-Carve build"
  ],
  [
    "tools-list: era one-shots subfolder",
    "- `tools/` — era scripts (historical surgery + validators), `extract.mjs`,",
    "- `tools/` — living tools only; applied one-shots (surgery, versioned doc\n" +
    "  patches, era validators) live in `tools/era/` — do **not** re-run, anchored\n" +
    "  patches are not idempotent. Living: `extract.mjs`,",
    "live in `tools/era/`"
  ],
  [
    "nodes-lab: graduate-then-delete rule",
    "  deletes it on failure — no manual wrapper conversion.",
    "  deletes it on failure — no manual wrapper conversion. **Delete the lab file\n" +
    "  after a successful bake**: baked `src/defs/nodes/` is the source of truth,\n" +
    "  and a stale lab file can overwrite newer fixes on a re-bake (see\n" +
    "  nodes-lab/README.md).",
    "**Delete the lab file"
  ],
  [
    "deploy: public/ vs docs/ rule",
    "- Deploy: git push → GitHub Pages. CDN lags ~10 min;",
    "- Deploy: git push → GitHub Pages via CI (`.github/workflows/deploy.yml`),\n" +
    "  which serves **only the built `dist/`** — repo `docs/` is never online.\n" +
    "  Anything that must be reachable on Pages goes in `public/` (Vite copies it\n" +
    "  verbatim into dist, e.g. `public/sim/` → /Muusia/sim/). CDN lags ~10 min;",
    "serves **only the built `dist/`**"
  ],
  [
    "recipe step 2: delete lab file",
    "   detection + ESM wrapper + import smoke-test; failed bakes are removed).",
    "   detection + ESM wrapper + import smoke-test; failed bakes are removed),\n" +
    "   then delete the lab file.",
    "then delete the lab file."
  ],
]);

/* ---------------- docs/MUUSIA-PLOTTER-MECH-HANDOFF.md ---------------- */
patchFile("docs/MUUSIA-PLOTTER-MECH-HANDOFF.md", [
  [
    "ink blot: design tool reference",
    "regulator, not a per-blot parameter.",
    "regulator, not a per-blot parameter.\n\n" +
    "Design tool: `public/sim/ink-blow-sim.html` (served at /Muusia/sim/ on\n" +
    "Pages) — interactive drop + blow simulator; parameters map 1:1 to this\n" +
    "hardware. Physics coefficients are uncalibrated first guesses until the\n" +
    "first real blot tests (50 µl per ink per paper, measure Ø + branch lengths).",
    "Design tool: `public/sim/ink-blow-sim.html`"
  ],
]);

console.log(okAll ? "\nALL OK" : "\nSOME EDITS MISSED — review before committing");
process.exit(okAll ? 0 : 1);
