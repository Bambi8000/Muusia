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
    name: "1 · Hello Tracks", desc: "Generator \u2192 export. One node is already art.",
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "radat", x: 60, y: 60, params: defaults("radat") }],
      edges: [],
    }),
  },
  {
    name: "2 · Modifier chain", desc: "Tracks \u2192 Jitter \u2192 Symmetry: chain modifiers left to right.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "radat", x: 40, y: 60, params: defaults("radat") },
        { id: 9002, type: "jitter", x: 320, y: 60, params: defaults("jitter") },
        { id: 9003, type: "symmetry", x: 600, y: 60, params: defaults("symmetry") },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "3 · Value wires", desc: "Random drives Grid line count: green ports modulate anything.",
    make: (defaults) => {
      const g = defaults("grid");
      return {
        nodes: [
          { id: 9001, type: "satunnainen", x: 40, y: 40, params: defaults("satunnainen") },
          { id: 9002, type: "grid", x: 320, y: 80, params: g },
        ],
        edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: "p:vlines" }],
      };
    },
  },
  {
    name: "4 · Landscape", desc: "Skyline + Water share Horizon Y; Merge combines layers.",
    make: (defaults) => {
      const sk = defaults("skyline"), wa = defaults("water");
      sk.horizon = 85; wa.horizon = 85;
      return {
        nodes: [
          { id: 9001, type: "skyline", x: 40, y: 30, params: sk },
          { id: 9002, type: "water", x: 40, y: 320, params: wa },
          { id: 9003, type: "merge", x: 360, y: 160, params: defaults("merge") },
        ],
        edges: [
          { id: "e9101", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
          { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
        ],
      };
    },
  },
  {
    name: "5 · Animation", desc: "Frame spins a solid over a static background. Press \u25B6 in ANIMATE.",
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
