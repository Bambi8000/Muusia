/* patch-docs.mjs - doc catch-up v2.20 -> v2.29 (soft edits + report) */
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
/* paragraph replace: "**Name** — ...blank line" */
const para = (name) => new RegExp("\\*\\*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\*\\* — [\\s\\S]*?\\n\\n");

/* ============ README.md ============ */
patchFile("README.md", [
  { from: "# MUUSIA v2.20", to: "# MUUSIA v2.29", what: "title" },
  { from: "**172 built-in nodes**", to: "**168 built-in nodes**", what: "node count" },
  { re: /```bash\nnpm create vite@latest[\s\S]*?```/, to: [
    "```bash",
    "git clone https://github.com/Bambi8000/Muusia.git",
    "cd Muusia",
    "npm install",
    "npm run build        # -> dist/index.html  (standalone, works offline)",
    "npm run dev          # -> live dev server for development",
    "```",
  ].join("\n"), what: "install block (repo is the project now)" },
  { from: "**Update routine:** `cp ~/Downloads/muusia.jsx src/App.jsx && npm run build`.",
    to: "**Update routine:** edit in the repo (`src/App.jsx` for engine/UI, `src/defs/nodes/*.js` for nodes) and `npm run build`.",
    what: "update routine" },
  { from: "**Layers = pens.** Each path carries a pen index 0–5.",
    to: "**Layers = pens.** Each path carries a pen index 0–11; pen colors and names are editable via the toolbar **Pens** popover (persisted locally; preview/SVG colors only — G-code names the pen in comments).",
    what: "pens 0-11" },
  { from: "One registry (`DEFS`) holds every node as a self-contained definition",
    to: "One registry (`DEFS`) holds every node as a self-contained definition. Since the C0 split each built-in node lives in its own file under `src/defs/nodes/` (assembled by `src/defs/index.js`); the engine in `App.jsx` knows nothing about specific nodes",
    what: "architecture split note" },
]);
{
  let s = fs.readFileSync("README.md", "utf8");
  const anchor = "## 8. Roadmap";
  const add = [
    "## UI conveniences (v2.23+)",
    "",
    "- **Paper presets** — toolbar select (A5–A2, wide/tall) sets the canvas size; the mm boxes stay for custom sizes.",
    "- **Preview zoom** — wheel zooms to cursor, drag pans, double-click resets; works in the sidebar preview, the enlarged preview and the pop-out window.",
    "- **Pens popover** — edit all 12 pen colors and names; saved locally.",
    "- **D button** — duplicates a single node from its title bar (Cmd/Ctrl+D still duplicates the selection).",
    "",
  ].join("\n");
  if (s.includes(anchor) && !s.includes("## UI conveniences")) {
    s = s.replace(anchor, add + anchor);
    report.push("OK   README.md :: UI conveniences section");
  } else report.push("MISS README.md :: UI conveniences section");
  fs.writeFileSync("README.md", s);
}

/* ============ docs/MUUSIA-NODES.md ============ */
const N = "docs/MUUSIA-NODES.md";
patchFile(N, [
  { from: "# MUUSIA v2.20 — Node Reference", to: "# MUUSIA v2.29 — Node Reference", what: "title" },
  { from: "All 172 built-in nodes", to: "All 168 built-in nodes", what: "count intro" },
  { re: /## Generators \(\d+\)/, to: "## Generators (86)", what: "gen count" },
  { re: /## Modifiers \(\d+\)/, to: "## Modifiers (55)", what: "mod count" },
  /* removals */
  { re: para("Macrame"), to: "", what: "remove Macrame" },
  { re: para("Reaction-Diffusion"), to: "", what: "remove Reaction-Diffusion" },
  { re: para("String"), to: "", what: "remove String" },
  { re: para("Tape Saturation Harmonics"), to: "", what: "remove Tape Saturation" },
  { re: para("Planets"), to: "", what: "remove Planets" },
  { re: para("Solar System"), to: "", what: "remove Solar System" },
  { re: para("Building"), to: "", what: "remove Building" },
  { re: /\*\*Filter\*\* \(deform\) — [\s\S]*?\n\n/, to: "", what: "remove Filter" },
  /* replacements */
  { re: para("Scan"), to: "**Seismic** — seismograph / EEG channel rows: a calm baseline per channel with 1–3 seeded burst events per row. Detail sets the channel count; annotations (ticks) go on their own pen.\n\n", what: "Scan -> Seismic" },
  { re: /\*\*Mycelial Net\*\*/, to: "**Root Web**", what: "Root Web rename" },
  { re: /\*\*Trace\*\* —/, to: "**Trace Image** —", what: "Trace Image rename" },
  { re: para("Power Pole"), to: "**Power Pole** — wireframe 3D utility poles: Finnish Wood (single pole, crossarm, pin insulators, guy wire), US Utility (double crossarm, cylinder transformer), Japanese Concrete (stacked arms, transformer drums). Wires hangs catenary cables from the insulators; rotate with Yaw/Pitch, wire Frame to orbit.\n\n", what: "Power Pole trim" },
  { re: para("Smooth"), to: "**Smooth** — smooths paths in two modes. *Relax* runs an arc-length moving average (Radius mm) over the line — visible on typical densely sampled geometry; endpoints stay pinned and closed paths wrap. *Round corners* is classic Chaikin corner-cutting for sparse polylines like Random Lines or Delaunay edges.\n\n", what: "Smooth rewrite" },
  { re: para("Potato"), to: "**Potato** — asymmetric blobs (low-frequency harmonics + random squash) with optional \"eyes\" texture as dots or curved arcs. Placement: *No overlap* keeps every potato fully separated using its true extent (fewer may fit on a tight sheet); *Loose* allows touching and light overlap.\n\n", what: "Potato rewrite" },
  { re: para("Clouds"), to: "**Clouds** — old-etching cumulus: each cloud is a row of overlapping lobe circles plus a few stacked on top, drawn as scalloped visible arcs. *Inner creases* lets each arc continue a little way behind its neighbour, like an engraver's line; *Hatch shading* adds horizontal rows that thin upward plus a dashed drop shadow under the flat base.\n\n", what: "Clouds engraved" },
  { re: para("Moon Craters"), to: "**Moon Craters** — cratered lunar terrain from a heightfield of bowl-and-rim craters. Top view (default) draws rim/floor outlines or a relief-displaced mesh; 3D view looks across the plain to a horizon — rotate with Yaw, raise the camera with Pitch. 3D Mesh uses classic silhouette occlusion; 3D Outlines drapes the crater rings over the terrain.\n\n", what: "Moon Craters default" },
  { re: para("Truchet"), to: "**Truchet** — tiled quarter-circle patterns. *Tiles* mode draws arc or diagonal tiles; *Tile fill* leaves a seeded share of tiles empty; *Separate* clamps arc radii and forces an edge gap so strands never meet or cross. *Loop* mode grows a spanning tree and emits **one single closed line** that fills the canvas — a maze you can plot without lifting the pen.\n\n", what: "Truchet modes" },
  { re: para("Tiles"), to: "**Tiles** — grid of tiles, each a separate closed path: parametric **Superellipse**, Circle, Triangle, Hexagon, Star, Reuleaux, Cross, with per-tile rotation and jitter. Layout: *Grid*, *Brick* (offset rows) or *Hex pack* (0.866 pitch — circles and hexagons at Size 100 touch their neighbours); *Alternate flip* rotates every other tile 180° so triangles tessellate. The natural Explosion input.\n\n", what: "Tiles layouts" },
  { re: para("Hyperbolic Truchet Maze"), to: "**Hyperbolic Truchet Maze** — Truchet arcs on a polar grid whose rings crowd toward the center or the rim (Ring Crowding), so the maze reads as a hyperbolic disc. Arc strands connect seamlessly across cells; *Solve* traces the strand network and recolors one strand running from the center to the outer rim onto the Solve pen (arcs style only).\n\n", what: "Hyperbolic solve" },
  { re: para("Turtle"), to: "**Turtle** — classic turtle graphics from a command string: F/B move drawing, M moves pen-up, R/L turn, U/D pen up/down, [ ] branch, N[...] repeats. *Preset* picks a ready-made program (Hex flower, Pentagram, Spun squares, Rose window, Radial burst, Turning square, Branch tree, Zigzag ribbon); Custom uses the Program field. Auto-fits to the sheet; deterministic.\n\n", what: "Turtle presets" },
  { re: para("Gravity Cascade"), to: "**Gravity Cascade** — particles launched into a field of gravity wells trace decaying orbits. *Wells layout* places the attractors (Triangle, Line, Ring, Center + ring, Random with a Wells count); *Launch* picks the start (Ring around the center, Top rain from the upper edge, Spiral). Paths end at the sheet edge.\n\n", what: "Gravity modes" },
  { re: para("Knot"), to: "**Knot** — a torus knot p·q drawn flat with real over/under crossings: at every planar self-intersection the strand passing underneath is cut with a gap, so the knot reads as woven. Coprime p/q give true knots; Tube sets the torus thickness.\n\n", what: "Knot torus-only" },
  { re: para("FM Rose"), to: "**FM Rose** — FM synthesis as a polar curve: a modulator warps the carrier that shapes the radius. Low index gives rosettes, high index chaotic flowers; Rings stacks scaled copies with per-ring rotation, and *Ring pens* cycles successive rings through that many pens.\n\n", what: "FM Rose pens" },
  { re: para("Attractor"), to: "**Attractor** — Clifford / De Jong maps or the Lorenz system iterated thousands of times, fitted to the sheet. In Lorenz mode the four sliders map to the system (a→rho, b→sigma, c→beta, d→speed) and *Plane* picks the projection (x-z / x-y / y-z). Polyline is one chaotic thread, Dashes the classic attractor dust.\n\n", what: "Attractor Lorenz" },
  { re: para("Test Card"), to: "**Test Card** — calibration sheets: line weight sweep, converging line spacing, hatch density, arcs & tight circles, pen-lift dot grid, fill swatches, registration marks, speed-ramp zigzag, and a *Pen palette* drawing one labelled swatch per pen (all 12). The grid auto-shrinks its cells to fit the current canvas.\n\n", what: "Test Card update" },
  /* insertions: anchor paragraph/opening preserved, new text attached */
  { from: "**Pen Cycle** — assigns pens to whole paths in rotation.\n\n",
    to: "**Pen Cycle** — assigns pens to whole paths in rotation.\n\n**Set Pen** — recolors the input onto another pen. *All* moves everything to the target pen; *Single* remaps only one source pen and leaves the rest untouched — handy for swapping a single color in a multi-pen patch.\n\n",
    what: "insert Set Pen after Pen Cycle" },
  { from: "**Lissajous** — x/y sinusoids",
    to: "**Zigzag** — rows of zigzag, sine or square waves. *Skew* tilts the zigzag toward a sawtooth; *Envelope* modulates amplitude with a seeded noise envelope (bursts and quiet passages); *Row phase* offsets rows for interference. Wire any path into **Spine** and the waves follow it as parallel offset rows.\n\n**Lissajous** — x/y sinusoids",
    what: "insert Zigzag before Lissajous" },
  { from: "**Join Ends** — connects nearby path endpoints",
    to: "**Bridges** — connects points of the input with bridge lines. Points from *Path centers* (Polka Dots / Phyllotaxis circles become nodes), *Vertices* (resampled at a spacing) or *Endpoints*; rules *k-nearest*, *Within distance*, *Chain* (one continuous nearest-neighbour stroke, split at long jumps) or *Delaunay* edges. *Trim ends* stops each bridge short of its points so lines never pierce the dots.\n\n**Join Ends** — connects nearby path endpoints",
    what: "insert Bridges before Join Ends" },
  { from: "**Hatch Fill** — fills closed shapes",
    to: "**Mycelium Fill** — grows organic flesh along a line network: parallel strands follow each input line and the width swells near junctions (3+ path ends meeting, or crossings between paths), so joints read thicker — a slime-mould look on a Voronoi or Network input. Strands invading a neighbouring strut's territory are cut, except near junctions where they merge; *Waviness* adds hyphal wobble, *Taper* thins open ends.\n\n**Hatch Fill** — fills closed shapes",
    what: "insert Mycelium Fill before Hatch Fill" },
]);

/* ============ docs/MUUSIA-NODE-API.md ============ */
patchFile("docs/MUUSIA-NODE-API.md", [
  { from: "(v1.1, app v2.20)", to: "(v1.2, app v2.29)", what: "title version" },
  { from: "integer pen index `0..5` (Black, Blue, Red, Green, Orange, Purple)",
    to: "integer pen index `0..11` (12 pens; colors/names user-editable in the app)",
    what: "pen range" },
  { from: "6 color dots → integer 0–5", to: "12 color dots → integer 0–11", what: "pen param row" },
  { from: "Array of 6 `{ name, c }` pen colors", to: "Array of 12 `{ name, c }` pen colors", what: "PENS helper row" },
  { from: 'const PENS = Array.from({ length: 6 }, (_, i) => ({ name: "P" + i, c: "#000" }));',
    to: 'const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));',
    what: "harness PENS" },
  { from: "imported in the app via the **Node ⇣** button (top toolbar).",
    to: "imported in the app via the **Node ⇣** button (top toolbar). (Built-in nodes use the same definition object in ESM form under `src/defs/nodes/` — an import line plus `export default { ... };` — but this plotternode format is the one for user imports.)",
    what: "ESM note" },
]);

report.forEach((l) => console.log(l));
const miss = report.filter((l) => l.startsWith("MISS")).length;
console.log(miss ? miss + " edits missed - fix by hand (list above)" : "all edits landed");