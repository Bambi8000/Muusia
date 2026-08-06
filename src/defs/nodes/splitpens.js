import { Pin, EMPTY, PENS } from "../helpers.js";

export default {
  key: "splitpens",
  name: "Split Pens",
  cat: "mod",
  group: "penout",
  desc: "Routes every incoming path to the output of its pen - one output per pen, in PENS order (pins 2 onward). Paths pass through untouched (geometry, closed flags and pen assignments all preserved) and keep their input order within each output; unused pens emit empty. The FIRST output is a preview tap: the Preview pen selector picks which single pen it carries (or All), and since the app's preview window always shows a selected node's first output, flipping the selector steps through the drawing one color at a time without disturbing the routing outputs at all - they never change with the selector, so nothing can be accidentally soloed out of an export. The natural partner of round = pen workflows: run Portrait with Pen assignment Cycle, split, and the feature lines, each shading round, or a background layer become independently routable branches - restyle one with Set Pen, thin one out, or drop it entirely, then bring the survivors back together with Merge. Layer numbers outside 0-11 wrap around modulo the pen count. No randomness: a pure router.",
  ins: [Pin("paths")],
  outs: [Pin("paths", "Preview")].concat(PENS.map((pen) => Pin("paths", pen.name))),
  params: [
    { key: "preview", label: "Preview pen", type: "select", options: ["All"].concat(PENS.map((pen) => pen.name)), def: "All" },
  ],
  compute(ins, p) {
    const src = ins[0] || EMPTY;
    const n = PENS.length;
    const buckets = PENS.map(() => []);
    for (const pa of src.paths || []) {
      const L = ((Math.round(pa.layer || 0) % n) + n) % n;
      buckets[L].push(pa);
    }
    /* preview tap: unknown/renamed selections fall back to All */
    const pi = PENS.findIndex((pen) => pen.name === p.preview);
    const prev = pi >= 0 ? (buckets[pi].length ? { paths: buckets[pi] } : EMPTY)
      : (src.paths && src.paths.length ? { paths: src.paths } : EMPTY);
    return [prev].concat(buckets.map((b) => (b.length ? { paths: b } : EMPTY)));
  },
};
