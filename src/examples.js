/* Muusia — built-in Help examples.
 *
 * Each entry: { name, desc, make(defaults) => { nodes, edges } }.
 * `defaults(type)` is injected by App.jsx at load time so this file has no
 * imports and stays runnable in plain Node for validation
 * (tools/validate-examples.mjs).
 *
 * Conventions:
 * - node ids 9001+, edge ids "e9101"+ (loadExample resets NEXT_ID to 9500)
 * - start from defaults(type) and override only the params that differ
 * - built-in nodes only (no custom nodes, no file-import nodes)
 * - fixed seeds — an example must look good deterministically
 * - optional `canvas: { W, H }` per entry if the patch depends on sheet size
 */

export const EXAMPLES = [
  {
    name: "1 · Stamps", desc: "A yellow style wire (Dashed) feeds Tracks; Stamp rides the paths with triangles.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "viiva", x: 30, y: 20, params: { ...defaults("viiva"), dash: 24.5 } },
        { id: 9002, type: "radat", x: 340, y: 25, params: { ...defaults("radat"), rings: 30 } },
        { id: 9003, type: "stamp", x: 686, y: 38, params: { ...defaults("stamp"), spacing: 37, sizeMod: 1, pathVar: 0.6, motif: "Triangle", orientMode: "Along path", seed: 6727 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "2 · Seismic mountains", desc: "Mountains → Smear → Squiggle (Seismic): three modifiers become a new texture.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "mountains", x: 30, y: 20, params: { ...defaults("mountains"), rows: 53, height: 138 } },
        { id: 9002, type: "smear", x: 344, y: 93, params: { ...defaults("smear"), zx: 94, zw: 400, zh: 302, mode: "Horizontal" } },
        { id: 9003, type: "squiggle", x: 679, y: 126, params: { ...defaults("squiggle"), mode: "Seismic", amp: 0.5, levels: 3, seed: 6222 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "3 · Empty fill", desc: "Rippled terraces, then Empty Fill hatches the untouched paper with pen 4.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "parallel_lines", x: 30, y: 34, params: { ...defaults("parallel_lines"), spacing: 5, margin: 2, levels: 5, plateau: 58, relief: 0.67, fall: 1, mess: 1, layer: 7 } },
        { id: 9002, type: "ripple", x: 367, y: 20, params: { ...defaults("ripple"), waterline: 0.59, poolx: 28, poolw: 109, pooledge: 0.22, scale: 0.26, breakup: 0.31, stretch: 1.27, below: true, seed: 6635 } },
        { id: 9003, type: "empty_fill", x: 670, y: 131, params: { ...defaults("empty_fill"), pattern: "Hatch", gap: 6.2, angle: 38, seed: 9518, pen: 4 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "4 · Contours", desc: "One Voronoi, two treatments: SDF Contours and Mycelium Fill share the source.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "voronoi", x: 30, y: 52, params: defaults("voronoi") },
        { id: 9002, type: "sdfcontours", x: 393, y: 20, params: defaults("sdfcontours") },
        { id: 9003, type: "myceliumfill", x: 696, y: 263, params: { ...defaults("myceliumfill"), strands: 4, width: 10.5, boost: 0.2 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "5 · Potato ASCII", desc: "Potatoes rasterized into ASCII characters, then roughened by Hand Drawn.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "potato", x: 30, y: 20, params: { ...defaults("potato"), count: 14, eyes: "None" } },
        { id: 9002, type: "asciiart", x: 383, y: 47, params: { ...defaults("asciiart"), ramp: "Custom", rampCustom: ".oO0ÖCD" } },
        { id: 9003, type: "handdrawn", x: 720, y: 99, params: { ...defaults("handdrawn"), wobble: 3.7, waveLen: 87, tremor: 1.05 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "6 · Ribbon mosaic", desc: "Ribbon shattered by Cellular Mosaic, recolored with Set Pen, merged over the original.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), wander: 120, width: 55.5, widthVar: 1, margin: 23 } },
        { id: 9002, type: "cellular_mosaic", x: 336, y: 129, params: { ...defaults("cellular_mosaic"), scale: 10.5 } },
        { id: 9003, type: "setpen", x: 639, y: 438, params: { ...defaults("setpen"), layer: 7 } },
        { id: 9004, type: "merge", x: 934, y: 54, params: defaults("merge") },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
        { id: "e9103", from: 9001, fromPort: 0, to: 9004, toPort: 0 },
        { id: "e9104", from: 9003, fromPort: 0, to: 9004, toPort: 1 },
      ],
    }),
  },
  {
    name: "7 · Nature", desc: "Wood rings + spore print; Negative Space fills the background with Caustics.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "wood", x: 30, y: 20, params: { ...defaults("wood"), rings: 24, cx: 82, cy: 72 } },
        { id: 9002, type: "spore_print", x: 304, y: 110, params: { ...defaults("spore_print"), cx: 69 } },
        { id: 9003, type: "merge", x: 610, y: 182, params: defaults("merge") },
        { id: 9004, type: "caustics", x: 596, y: 529, params: defaults("caustics") },
        { id: 9005, type: "negspace", x: 899, y: 434, params: defaults("negspace") },
        { id: 9006, type: "merge", x: 1205, y: 219, params: defaults("merge") },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
        { id: "e9102", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
        { id: "e9103", from: 9003, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9104", from: 9004, fromPort: 0, to: 9005, toPort: 1 },
        { id: "e9105", from: 9003, fromPort: 0, to: 9006, toPort: 0 },
        { id: "e9106", from: 9005, fromPort: 0, to: 9006, toPort: 1 },
      ],
    }),
  },
  {
    name: "8 · Pebble", desc: "One Pebble, two fates: a contour halo and a glitched, shrunken pen-7 shadow.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "merge", x: 940, y: 48, params: defaults("merge") },
        { id: 9002, type: "setpen", x: 937, y: 460, params: { ...defaults("setpen"), from: 7, layer: 7 } },
        { id: 9003, type: "pebble", x: 30, y: 20, params: { ...defaults("pebble"), mode: "Mesh", angular: 0, facets: 19, detail: 0, rx: -41 } },
        { id: 9004, type: "move_scale", x: 638, y: 582, params: { ...defaults("move_scale"), dx: -5.5, dy: 2, scale: 33 } },
        { id: 9005, type: "glitch", x: 325, y: 150, params: defaults("glitch") },
        { id: 9006, type: "sdfcontours", x: 634, y: 20, params: { ...defaults("sdfcontours"), start: 11, step: 5.5, count: 8 } },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9001, toPort: 1 },
        { id: "e9102", from: 9004, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9103", from: 9005, fromPort: 0, to: 9004, toPort: 0 },
        { id: "e9104", from: 9003, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9105", from: 9006, fromPort: 0, to: 9001, toPort: 0 },
        { id: "e9106", from: 9003, fromPort: 0, to: 9006, toPort: 0 },
      ],
    }),
  },
  {
    name: "9 · Move & rotate", desc: "Two laser floors — one rotated — pushed apart by Move/Scale; a sphere floats between.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "retromesh", x: 41, y: 20, params: { ...defaults("retromesh"), mode: "Laser floor", size: 188, spokes: 12, throat: 0.68, persp: 0.54, terrain: 0.54, horizon: false, rx: -24, ry: 2 } },
        { id: 9002, type: "solids", x: 694, y: 51, params: { ...defaults("solids"), size: 43, rx: -48, ry: -3, rz: -31, persp: 0.1, lat: 14, px: 142, py: 101, layer: 2 } },
        { id: 9003, type: "merge", x: 1291, y: 22, params: { ...defaults("merge"), count: 3 } },
        { id: 9004, type: "retromesh", x: 30, y: 833, params: { ...defaults("retromesh"), mode: "Laser floor", size: 188, spokes: 12, throat: 0.68, persp: 0.54, terrain: 0.54, horizon: false, rx: -24, ry: 2, seed: 572 } },
        { id: 9005, type: "kierto", x: 346, y: 831, params: { ...defaults("kierto"), deg: -180 } },
        { id: 9006, type: "move_scale", x: 698, y: 803, params: { ...defaults("move_scale"), dx: -16, dy: -59.5 } },
        { id: 9007, type: "move_scale", x: 332, y: 96, params: { ...defaults("move_scale"), dx: 12.5, dy: 60.5 } },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
        { id: "e9102", from: 9004, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9103", from: 9005, fromPort: 0, to: 9006, toPort: 0 },
        { id: "e9104", from: 9006, fromPort: 0, to: 9003, toPort: 2 },
        { id: "e9105", from: 9001, fromPort: 0, to: 9007, toPort: 0 },
        { id: "e9106", from: 9007, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "10 \u00B7 Animation", desc: "Frame spins a solid over a static background. Press \u25B6 in ANIMATE.",
    make: (defaults) => {
      const so = defaults("solids"), ma = defaults("matem");
      so.shape = "Icosahedron"; so.size = 90;
      ma.op = "A \u00D7 B"; ma.b = 15;
      return {
        nodes: [
          { id: 9001, type: "frame", x: 30, y: 40, params: defaults("frame") },
          { id: 9002, type: "matem", x: 250, y: 40, params: ma },
          { id: 9003, type: "solids", x: 470, y: 120, params: so },
          { id: 9004, type: "mountains", x: 30, y: 330, params: defaults("mountains") },
          { id: 9005, type: "merge", x: 760, y: 200, params: defaults("merge") },
        ],
        edges: [
          { id: "e9101", from: 9001, fromPort: 1, to: 9002, toPort: 0 },
          { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: "p:ry" },
          { id: "e9103", from: 9004, fromPort: 0, to: 9005, toPort: 0 },
          { id: "e9104", from: 9003, fromPort: 0, to: 9005, toPort: 1 },
        ],
      };
    },
  },
];
