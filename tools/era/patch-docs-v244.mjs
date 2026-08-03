#!/usr/bin/env node
/* HANDOFF: v2.44 history entry + the era-patch regression pitfall.
   Anchored replacement, OK/MISS report, writes only if ALL anchors hit once.
   ONE-SHOT — move to tools/era/ after running. Run from the repo root:
     node tools/patch-docs-v244.mjs */

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "docs/MUUSIA-HANDOFF.md";
let src = readFileSync(FILE, "utf8");

const edits = [
  {
    name: "D1 version history: 2.44",
    find: "  domain, not canvas position, or that invariance breaks.",
    replace: `  domain, not canvas position, or that invariance breaks.
- **2.44** restore, no new features: the **Moonraker DRO** integration had
  silently vanished from App.jsx somewhere in the 2.38→2.43 window (an
  App.jsx overwrite from a pre-DRO base; src/dro.jsx and the era patch
  survived untouched). Re-applied via tools/era/patch-dro.mjs — all four
  anchors still matched on the 2.43 file. Post-push guard added to the
  routine: \`grep -c "DroPanel" src/App.jsx\` must print 2.`,
  },
  {
    name: "D2 pitfall: era patches can regress silently",
    find: `## Hard-won pitfalls (keep)

- Browsers do NOT overwrite downloads`,
    replace: `## Hard-won pitfalls (keep)

- Era-patch changes to App.jsx can VANISH silently if a later session
  rewrites App.jsx from an older base (the v2.44 DRO regression: module file
  survived, integration gone). Cheap insurance: after any session that
  touches App.jsx wholesale, grep for sentinel strings of past era patches
  (e.g. \`DroPanel\`). Re-running an era patch is correct ONLY when its target
  has demonstrably reverted to the unpatched state — the OK/MISS anchor
  report is the proof either way.
- Browsers do NOT overwrite downloads`,
  },
];

let ok = true;
for (const e of edits) {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error(`MISS  ${e.name} — anchor found ${n}x (expected 1)`); ok = false; }
}
if (!ok) { console.error("No changes written."); process.exit(1); }
for (const e of edits) { src = src.replace(e.find, e.replace); console.log(`OK    ${e.name}`); }
writeFileSync(FILE, src);
console.log(`Wrote ${FILE}. Move this script to tools/era/.`);
