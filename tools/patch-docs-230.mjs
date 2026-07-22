/* doc catch-up v2.30 (mega proof + labels) + v2.31 (Smear) */
import fs from "fs";
const report = [];
function patchFile(path, edits) {
  let s = fs.readFileSync(path, "utf8");
  for (const e of edits) {
    const before = s;
    if (e.re) s = s.replace(e.re, e.to);
    else if (s.includes(e.from)) s = s.replace(e.from, e.to);
    report.push((s !== before ? "OK   " : "MISS ") + path + " :: " + e.what);
  }
  fs.writeFileSync(path, s);
}

/* README: title, counts, mega section */
patchFile("README.md", [
  { from: "# MUUSIA v2.29", to: "# MUUSIA v2.31", what: "title" },
  { from: "**168 built-in nodes**", to: "**169 built-in nodes**", what: "node count" },
  { from: "Optional L-shaped crop marks at each tile's cut rectangle corners.",
    to: "Optional L-shaped crop marks at each tile's cut rectangle corners, and tile labels (running number + row/col, drawn small in each sheet's bottom-left corner on the mark pen) for sorting the physical sheets. *Download full SVG (composed proof)* saves the whole composed work as one SVG at full mega size — a proofing reference to compare against the preview; the numbered tiles remain the plottable output.",
    what: "mega section additions" },
]);

/* NODES.md: title, counts, Smear paragraph before Stretch */
patchFile("docs/MUUSIA-NODES.md", [
  { from: "# MUUSIA v2.29 — Node Reference", to: "# MUUSIA v2.31 — Node Reference", what: "title" },
  { from: "All 168 built-in nodes", to: "All 169 built-in nodes", what: "count intro" },
  { from: "## Modifiers (55)", to: "## Modifiers (56)", what: "mod count" },
  { from: "**Stretch** — monotonic band remap:",
    to: "**Smear** — pixel-stretch for lines inside a rectangular zone (guide overlay). *Vertical* / *Horizontal* replace zone content with straight axis-aligned streaks at the boundary crossings (sign follows travel direction; Streak length 0 runs to the far edge). *Free (bridge)* instead joins each path's entry and exit with one straight chord, so the line continues unbroken through the zone. *From edge* picks which zone edge feeds the effect — e.g. Right continues only right-edge crossings seamlessly along their own tangents while other edges are simply cut. Compare Stretch: that remaps geometry, this replaces it.\n\n**Stretch** — monotonic band remap:",
    what: "insert Smear before Stretch" },
]);

/* HANDOFF: version history + counts */
patchFile("docs/MUUSIA-HANDOFF.md", [
  { from: "## Repo layout (post-C0 split, v2.29)", to: "## Repo layout (post-C0 split, v2.31)", what: "layout title" },
  { from: "**166 files** (168 nodes total with\n  group + reititys; Generators 86, Modifiers 55)",
    to: "**167 files** (169 nodes total with\n  group + reititys; Generators 86, Modifiers 56)", what: "file counts" },
  { from: "`ls src/defs/nodes | wc -l` (166)", to: "`ls src/defs/nodes | wc -l` (167)", what: "count check" },
  { from: "  **Pen palette (12)** + grid auto-fit to canvas.",
    to: [
      "  **Pen palette (12)** + grid auto-fit to canvas.",
      "- **2.30** Mega Canvas: **composed full-SVG proof export** (one SVG at mega size,",
      "  proofing reference vs preview) + **tile labels** (running number + R/C at each",
      "  sheet's bottom-left, mark pen, persisted in project files); fixed XML comment",
      "  placement in mega SVG exports (comments must follow the declaration — Chrome",
      "  rejects, Quick Look silently accepts); sliceMega portrait regression validator.",
      "- **2.31** new **Smear** modifier (pixel-stretch for lines: V/H streaks or Free",
      "  bridge chords at zone boundary crossings, From-edge filter for seamless",
      "  one-sided continuation).",
    ].join("\n"), what: "version history 2.30 + 2.31" },
  { from: "- `import.meta.glob` order = filename order; palette groups sort alphabetically.",
    to: [
      "- `import.meta.glob` order = filename order; palette groups sort alphabetically.",
      "- macOS Quick Look scales tall SVGs to window width and shows only the top —",
      "  judge exported tiles in a browser tab or by validator, never by space-bar",
      "  preview (a \"slicing bug\" in 2.30 investigation was exactly this illusion).",
    ].join("\n"), what: "Quick Look pitfall" },
]);

report.forEach((l) => console.log(l));
const miss = report.filter((l) => l.startsWith("MISS")).length;
console.log(miss ? miss + " edits missed - fix by hand" : "all edits landed");