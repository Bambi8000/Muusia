/* patch-docs-zen-galaxy-zigzag.mjs — documentation batch for the
   zen_garden + galaxy + zigzag_path release.
   Run from the repo root AFTER baking all three and bumping APP_VERSION:
     node tools/era/patch-docs-zen-galaxy-zigzag.mjs
   Section counts are incremented from the values read out of the doc itself
   (robust to the two inline DEFS), the header total is cross-checked against
   the node file count on disk, version comes from src/App.jsx at runtime.
   Idempotent per file, MISS-aborts per file. */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

let anyFail = 0;
const OK = (m) => console.log("OK    " + m);
const SKIP = (m) => console.log("SKIP  " + m);
const MISS = (m) => { console.log("MISS  " + m); anyFail++; };

const app = readFileSync("src/App.jsx", "utf8");
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V = vm[1];
const nodeFiles = readdirSync("src/defs/nodes").filter((f) => f.endsWith(".js"));
for (const k of ["zen_garden", "galaxy", "zigzag_path"]) {
  if (!nodeFiles.includes(k + ".js")) {
    console.log("MISS  src/defs/nodes/" + k + ".js not baked yet - ABORT (bake first)");
    process.exit(1);
  }
}
const TOTAL = nodeFiles.length + 2; /* + inline group/reititys DEFS */
console.log("INFO  version " + V + ", " + TOTAL + " nodes total (from disk)");

const P_GALAXY = `**Galaxy** — a spiral galaxy as a rotatable 3D point cloud, deterministic from
Seed. *Stars* sets the dot count, *Arms* and *Twist* wind logarithmic spiral
arms with *Arm spread* scatter, *Bulge %* / *Bulge size* fill the core with a
3D gaussian ball, *Thickness* sets the disc depth and *Halo %* sprinkles a
sparse spherical halo. Three pens make it multicoloured: Core pen (bulge +
halo), Arm pen (disc), and *Sparkle %* of arm stars on Sparkle pen slightly
enlarged — young clusters along the arms; *Core glow* enlarges dots toward the
centre. Yaw / Pitch rotate in 3D (pitch 90 face-on, 0 edge-on), Perspective
foreshortens, and scaling is rotation-invariant, so wiring the animation Frame
into Yaw orbits the galaxy without size jumps. *Dot shape*: Circle (small
ring), Dash (a stroke streaking along the galactic rotation — star-trail
look) or Point (0.1 mm pen poke).`;

const P_ZEN = `**Zen Garden** — karesansui raked gravel around the closed shapes wired into
Stones (one Photo Trace outline, several via Merge, or any closed shapes).
Each stone sits in a pool of offset rings (*Rings*, starting at *Clearance*,
traced from an exact euclidean distance field), and the background rake
grooves end cleanly where they meet the outermost ring. Rake: *Straight*
(Direction), *Waves* (sine meander), *Circular* (rings from the canvas
centre), *Rings only* (rings expanding until they fill the sheet). *Spacing*
is the groove pitch; *Tines* splits every groove into a comb of parallel
lines with *Tine gap* between them, like the teeth of a real rake. *Wobble*
adds seeded hand-raked imperfection, *Detail* is the field grid cell in mm.
Lines never enter a stone or its clearance. *Keep stones* passes the
outlines through on Stone pen.`;

const P_ZZP = `**Zigzag Path** — redraws every input path as a patterned stroke following
the original line. Mode: *Zigzag* (sharp triangle wave, apex points inserted
analytically so corners stay exact), *Sine* (smooth wave) or *Coil* (dense
serpentine — perpendicular runs joined by rounded U-turns, pitch = half the
Wavelength). *Amplitude* is the half-width; *Vary amp* and *Vary wavelength*
drift the pattern smoothly over the *Vary length* scale via seeded noise —
hand movement, not per-vertex jitter. *Fade mm* ramps open strokes smoothly
in and out at both ends (in Coil the runs shrink toward the tips); closed
paths snap to whole periods and the drift wraps seamlessly. Each path keeps
its own pen.`;

const BULLET = `- **${V}** three nodes baked. **Zen Garden** (duo): karesansui raked gravel —
  exact euclidean distance field (Felzenszwalb 2-pass EDT, boundary-sampled
  seeds, scanline sign) puts a pool of offset rings around every Stones
  shape and clips the background rake (straight/waves/circular marching-
  squares iso-lines, Tines comb groups) to end at the pool via bilinear
  field interpolation; validator proves ring radii, exact far-field
  straightness (0.000 mm residual) and that no groove enters clearance.
  **Galaxy** (gen/scientific): procedural spiral-galaxy point cloud (disc +
  log-spiral arms + gaussian bulge + halo), three-pen colouring, tangential
  Dash star-trails, rotation-invariant scaling for Frame-driven orbits;
  validator uses de-rotated m-fold angular concentration as the arm oracle.
  **Zigzag Path** (mod/deform): input paths redrawn as zigzag / sine /
  serpentine coil with integrated-phase wavelength drift for organic
  variation; sine oracle exact to 1e-4 mm, zigzag apexes analytic, closed
  paths snap to whole periods. Marker-sheet chain: Photo Trace stones →
  Zen Garden → Zigzag Path rings for rippling gravel.`;

/* ---- docs/MUUSIA-NODES.md ---- */
{
  const FILE = "docs/MUUSIA-NODES.md";
  let src = readFileSync(FILE, "utf8");
  if (src.includes("**Zen Garden**")) {
    SKIP(FILE + " already has the trio");
  } else {
    let miss = 0, txt = src;
    const hv = txt.match(/^# MUUSIA v([\d.]+) — Node Reference$/m);
    if (!hv) { MISS(FILE + ": header version line not found"); miss++; }
    const tv = txt.match(/All (\d+) built-in nodes/);
    if (!tv) { MISS(FILE + ": total count not found"); miss++; }
    else if (Number(tv[1]) !== TOTAL - 3) { MISS(FILE + ": total is " + tv[1] + ", disk expects " + (TOTAL - 3) + " before patch"); miss++; }
    const gv = txt.match(/^## Generators \((\d+)\)$/m);
    const mv2 = txt.match(/^## Modifiers \((\d+)\)$/m);
    const cv = txt.match(/^## Combiners \((\d+)\)$/m);
    if (!gv || !mv2 || !cv) { MISS(FILE + ": section heading(s) not found"); miss++; }
    if (!miss) {
      const edits = [
        [hv[0], "# MUUSIA v" + V + " — Node Reference"],
        ["All " + tv[1] + " built-in nodes", "All " + TOTAL + " built-in nodes"],
        ["## Generators (" + gv[1] + ")\n\n", "## Generators (" + (Number(gv[1]) + 1) + ")\n\n" + P_GALAXY + "\n\n"],
        ["## Modifiers (" + mv2[1] + ")\n\n", "## Modifiers (" + (Number(mv2[1]) + 1) + ")\n\n" + P_ZZP + "\n\n"],
        ["## Combiners (" + cv[1] + ")\n\n", "## Combiners (" + (Number(cv[1]) + 1) + ")\n\n" + P_ZEN + "\n\n"],
      ];
      for (const [o, n] of edits) {
        const parts = txt.split(o);
        if (parts.length === 2) txt = parts.join(n);
        else { MISS(FILE + ": anchor '" + o.slice(0, 40).replace(/\n/g, "\\n") + "...' " + (parts.length - 1) + " hits"); miss++; }
      }
    }
    if (miss) { console.log("ABORT " + FILE + " NOT written"); }
    else { writeFileSync(FILE, txt); OK(FILE + " (v" + V + ", " + TOTAL + " nodes, three paragraphs inserted)"); }
  }
}

/* ---- docs/MUUSIA-TAGS.json ---- */
{
  const FILE = "docs/MUUSIA-TAGS.json";
  const raw = readFileSync(FILE, "utf8");
  const obj = JSON.parse(raw);
  const NEW = {
    galaxy: ["3d", "dots", "scatter", "space"],
    zen_garden: ["combine", "nature", "region", "texture"],
    zigzag_path: ["deform", "texture", "wave"],
  };
  const todo = Object.keys(NEW).filter((k) => !obj[k]);
  if (!todo.length) {
    SKIP(FILE + " already has all three");
  } else if (JSON.stringify(obj, null, 1) + "\n" !== raw && JSON.stringify(obj, null, 1) !== raw) {
    MISS(FILE + ": formatting is not JSON.stringify(,null,1) - refusing to rewrite, add entries manually");
  } else {
    for (const k of todo) obj[k] = NEW[k];
    const sorted = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
    writeFileSync(FILE, JSON.stringify(sorted, null, 1) + (raw.endsWith("\n") ? "\n" : ""));
    OK(FILE + " (" + todo.join(", ") + ")");
  }
}

/* ---- docs/MUUSIA-HANDOFF.md ---- */
{
  const FILE = "docs/MUUSIA-HANDOFF.md";
  let src = readFileSync(FILE, "utf8");
  if (src.includes("**Zen Garden** (duo): karesansui")) {
    SKIP(FILE + " already has the version bullet");
  } else {
    const anchor = "\n\n## Hard-won pitfalls (keep)";
    const parts = src.split(anchor);
    if (parts.length !== 2) {
      MISS(FILE + ": pitfalls heading anchor " + (parts.length - 1) + " hits");
      console.log("ABORT " + FILE + " NOT written");
    } else {
      writeFileSync(FILE, parts[0] + "\n" + BULLET + anchor + parts[1]);
      OK(FILE + " (version history bullet " + V + ")");
    }
  }
}

console.log(anyFail === 0 ? "DONE" : "DONE WITH " + anyFail + " MISSES - fix and re-run");
process.exit(anyFail === 0 ? 0 : 1);
