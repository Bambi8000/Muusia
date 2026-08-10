// Validator for Flow Traces. Run from repo root: node tools/validate-flow_traces.mjs
// Auto-switches: prefers baked src/defs/nodes/flow_traces.js, falls back to
// nodes-lab/flow_traces.plotternode.js evaluated with the REAL src/defs/helpers.js.
import fs from "fs";
import * as H from "../src/defs/helpers.js";

let N, source;
if (fs.existsSync("src/defs/nodes/flow_traces.js")) {
  N = (await import("../src/defs/nodes/flow_traces.js")).default;
  source = "baked";
} else {
  const txt = fs.readFileSync("nodes-lab/flow_traces.plotternode.js", "utf8");
  const keys = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample","pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  N = new Function(...keys, '"use strict"; return (' + txt + ");")(...keys.map((k) => H[k]));
  source = "lab";
}

const CTX = { W: 420, H: 297 };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defs(), ...over }, ctx, {});
const J = (r) => JSON.stringify(r.paths);
const nPts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const allPts = (r) => r.paths.flatMap((q) => q.pts);

// no two segments in the whole output may properly intersect (spatial hash);
// closed paths include their wrap segment
const countCrossings = (r) => {
  const segs = [];
  r.paths.forEach((q, pi) => {
    const n = q.pts.length;
    const m = q.closed ? n : n - 1;
    for (let i = 0; i < m; i++) segs.push([q.pts[i], q.pts[(i + 1) % n], pi, i, m]);
  });
  const CELL = 4;
  const hash = new Map();
  segs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s[0][0], s[1][0]) / CELL), x1 = Math.floor(Math.max(s[0][0], s[1][0]) / CELL);
    const y0 = Math.floor(Math.min(s[0][1], s[1][1]) / CELL), y1 = Math.floor(Math.max(s[0][1], s[1][1]) / CELL);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = x + ":" + y;
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k).push(i);
    }
  });
  const eps = 1e-9;
  let bad = 0;
  const seen = new Set();
  for (const list of hash.values()) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const ia = list[a], ib = list[b];
      const pk = ia < ib ? ia + "_" + ib : ib + "_" + ia;
      if (seen.has(pk)) continue;
      seen.add(pk);
      const A = segs[ia], B = segs[ib];
      if (A[2] === B[2]) {
        const di = Math.abs(A[3] - B[3]);
        if (di <= 1 || di === A[4] - 1) continue; // adjacent (incl. wrap)
      }
      const [p1, p2] = A, [p3, p4] = B;
      const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
      const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
      const den = d1x * d2y - d1y * d2x;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den;
      const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / den;
      if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) bad++;
    }
  }
  return bad;
};

console.log(`Flow Traces validator (${source} mode)`);

// 1. determinism
ok(J(run()) === J(run()), "determinism: identical JSON on double run");

// 2. structure, bounds, budget
for (const over of [{}, { seed: 5 }, { cols: 60, rows: 60, traces: 80, wave: 100, swirl: 100, radius: 12, minLen: 2, seed: 11 }]) {
  const r = run(over);
  const d = { ...defs(), ...over };
  const pad = d.tRadius + 0.1;
  ok(r.paths.length > 0 && r.paths.every((q) => q.pts.length >= 2), `structure: paths >= 2 pts (${JSON.stringify(over).slice(0, 40)})`);
  ok(allPts(r).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), "structure: finite coords");
  ok(allPts(r).every(([x, y]) => x >= d.margin - pad && x <= CTX.W - d.margin + pad && y >= d.margin - pad && y <= CTX.H - d.margin + pad),
    "bounds: inside margin box (+ terminal radius)");
  ok(nPts(r) <= 120000, `budget: ${nPts(r)} <= 120000`);
}

// 3. THE oracle: zero proper intersections - traces, arcs and terminals included
for (const seed of [83, 1, 42]) {
  const bad = countCrossings(run({ seed }));
  ok(bad === 0, `no-cross: 0 intersections (seed ${seed}) - found ${bad}`);
}
for (const term of ["Rings", "Pads", "None"]) {
  const bad = countCrossings(run({ terminals: term }));
  ok(bad === 0, `no-cross: 0 intersections (terminals ${term}) - found ${bad}`);
}
{
  const bad = countCrossings(run({ cols: 50, rows: 50, traces: 80, radius: 12, wave: 100, tRadius: 3, seed: 9 }));
  ok(bad === 0, `no-cross: 0 intersections at extreme params - found ${bad}`);
}

// 4. terminals: closed-path counts follow the mode exactly
{
  const opens = (r) => r.paths.filter((q) => !q.closed).length;
  const closes = (r) => r.paths.filter((q) => q.closed).length;
  const rn = run({ terminals: "None" });
  ok(closes(rn) === 0, "terminals: None -> zero closed paths");
  const rr = run({ terminals: "Rings" });
  ok(closes(rr) === 2 * opens(rr), `terminals: Rings -> exactly 2 per trace (${closes(rr)} / ${opens(rr)})`);
  const rp = run({ terminals: "Pads" });
  ok(closes(rp) === 2 * opens(rp), "terminals: Pads -> exactly 2 per trace");
  const rd = run({ terminals: "Dots", tRadius: 0.75 });
  ok(closes(rd) === 4 * opens(rd), "terminals: Dots (r > 0.5) -> double rings, 4 per trace");
}

// 5. trim: no open-path endpoint may sit inside any terminal
{
  const r = run({ terminals: "Dots" });
  const centers = [];
  for (const q of r.paths) {
    if (!q.closed) continue;
    let sx = 0, sy = 0;
    for (const [x, y] of q.pts) { sx += x; sy += y; }
    centers.push([sx / q.pts.length, sy / q.pts.length]);
  }
  const tr = defs().tRadius;
  let bad = 0;
  for (const q of r.paths) {
    if (q.closed) continue;
    for (const e of [q.pts[0], q.pts[q.pts.length - 1]]) {
      for (const c of centers) if (Math.hypot(e[0] - c[0], e[1] - c[1]) < tr - 1e-6) bad++;
    }
  }
  ok(bad === 0, `trim: 0 trace endpoints inside a terminal (found ${bad})`);
}

// 6. min length: every trace at least half its nominal cell length (corners shorten)
{
  const d = defs();
  const cell = Math.min((CTX.W - 2 * d.margin) / d.cols, (CTX.H - 2 * d.margin) / d.rows);
  const r = run();
  const short = r.paths.filter((q) => !q.closed && H.pathLength(q.pts, false) < d.minLen * cell * 0.5).length;
  ok(short === 0, `minLen: 0 traces shorter than half the nominal minimum (found ${short})`);
}

// 7. more traces -> at least as many routes
ok(run({ traces: 60 }).paths.filter((q) => !q.closed).length >= run({ traces: 10 }).paths.filter((q) => !q.closed).length,
  "traces: 60 attempts route at least as many as 10");

// 8. liveness
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "liveness: seed");
for (const [k, v] of Object.entries({ cols: 30, rows: 14, traces: 12, minLen: 9, flow: 60, swirl: 70, wave: 80, turnBias: 10, radius: 1.5, tRadius: 1.6, margin: 30, layer: 4 }))
  ok(J(run({ [k]: v })) !== J(run()), `liveness: ${k}`);
ok(J(run({ terminals: "Pads" })) !== J(run()), "liveness: terminals");

// 9. pen routing
ok(run({ layer: 6 }).paths.every((q) => q.layer === 6), "pen: layer routes to every path");

// 10. overlay: exact margin rect + flow arrow
{
  const g = N.overlay({ ...defs(), margin: 20 }, CTX);
  const rect = g.find((q) => q.kind === "rect");
  ok(rect && rect.x === 20 && rect.w === CTX.W - 40 && g.some((q) => q.kind === "arrow"), "overlay: margin rect + flow arrow");
}

// 11. degenerate guard
ok(run({}, { W: 12, H: 12 }).paths.length === 0, "guard: tiny canvas returns EMPTY");

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
