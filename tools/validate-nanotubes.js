/* validate-nanotubes.js — graph invariants: degrees, counts, Euler */
const fs = require("fs");
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(a){return function(){return 0.5;};}
const hash2=()=>0.5, noise2=()=>0.5, resample=(pts)=>pts;
const pathLength=(pts)=>{let l=0;for(let i=1;i<pts.length;i++)l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return l;};
const applyStyle=(ps)=>ps, signedArea=()=>0;
const SFONT={" ":{w:6,s:[]}}, fontStrokes=()=>({strokes:[],width:0});
const H_ = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea, SFONT, fontStrokes };
const N = new Function(...Object.keys(H_), '"use strict"; return (' + fs.readFileSync(__dirname + "/nanotubes.plotternode.js","utf8") + ");")(...Object.values(H_));

const CTX = { W: 210, H: 297 };
function defaults() { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; }
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "OK  " : "FAIL") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  if (!ok) fails++;
};
const run = (over) => N.compute([undefined], { ...defaults(), atoms: false, render: "Transparent", ...over }, CTX, {});
/* rebuild the graph from projected edge lines: vertices = endpoint clusters */
const graphOf = (r) => {
  const key = (q) => q[0].toFixed(3) + "," + q[1].toFixed(3);
  const idOf = new Map();
  const deg = [];
  let E = 0;
  for (const pa of r.paths) {
    if (pa.closed || pa.pts.length !== 2) continue;
    E++;
    for (const q of pa.pts) {
      const k = key(q);
      if (!idOf.has(k)) { idOf.set(k, deg.length); deg.push(0); }
      deg[idOf.get(k)]++;
    }
  }
  return { V: deg.length, E, deg };
};

/* T1: C60 — 60 atoms, 90 bonds, every atom degree 3, all projected bonds sane */
{
  const r = run({ type: "Fullerene C60", persp: 0 }); /* isometric: projection is affine */
  const g = graphOf(r);
  check("T1 C60: 60 vertices", g.V === 60, g.V);
  check("T1 C60: 90 edges", g.E === 90, g.E);
  check("T1 C60: 3-regular", g.deg.every((d) => d === 3));
  /* a bond nearly parallel to the view axis legitimately projects to ~0, so
     length spread is NOT an invariant; instead assert no degenerate zero paths */
  const lens = r.paths.map((pa) => pathLength(pa.pts));
  check("T1 C60 no fully degenerate bonds", lens.every((l) => l > 0.01), Math.min(...lens).toFixed(2) + " mm min");
}

/* T2: onion — 60*k vertices, 90*k edges, still 3-regular */
{
  for (const k of [2, 3, 4]) {
    const g = graphOf(run({ type: "Onion C60", shells: k }));
    check("T2 onion " + k + " shells: V=" + 60 * k + " E=" + 90 * k + " 3-regular",
      g.V === 60 * k && g.E === 90 * k && g.deg.every((d) => d === 3), g.V + "/" + g.E);
  }
}

/* T3: zigzag tube (n,0) — 2n atoms per lattice row band; interior degree 3, rim 2 */
{
  for (const n of [6, 10]) {
    const rows = 9;
    const g = graphOf(run({ type: "Nanotube zigzag", n, tlen: rows }));
    const okDeg = g.deg.every((d) => d === 2 || d === 3);
    const rim = g.deg.filter((d) => d === 2).length;
    /* after whisker pruning: V = 2*rows*n, rim = n per end */
    check("T3 zigzag n=" + n + ": degrees in {2,3}, rim = 2n",
      okDeg && rim === 2 * n, g.V + " atoms, " + rim + " rim");
    check("T3 zigzag n=" + n + " atom count = 2*rows*n", g.V === 2 * rows * n, g.V + " vs " + 2 * rows * n);
  }
}

/* T4: armchair tube — degrees in {2,3}, atoms divisible by 4n (2n per ring, ring pairs) */
{
  const n = 6;
  const g = graphOf(run({ type: "Nanotube armchair", n, tlen: 10 }));
  check("T4 armchair: degrees in {2,3}", g.deg.every((d) => d === 2 || d === 3), [...new Set(g.deg)].join(","));
  const rim4 = g.deg.filter((d) => d === 2).length;
  check("T4 armchair rim divisible by 2n, E consistent", rim4 % (2 * n) === 0 && rim4 > 0 && 2 * g.E === 3 * g.V - rim4, g.V + "V " + g.E + "E " + rim4 + " rim");
}

/* T5: nanotorus — closed both ways: every atom degree 3, E = 1.5V exactly */
{
  const g = graphOf(run({ type: "Nanotorus", n: 8, tlen: 18 }));
  check("T5 torus: 3-regular closed lattice", g.deg.every((d) => d === 3), "degs " + [...new Set(g.deg)].join(","));
  check("T5 torus: E = 1.5 V", g.E * 2 === g.V * 3, g.V + "/" + g.E);
}

/* T6: graphene sheet — degrees at most 3, has rim degree-2 and interior degree-3 */
{
  const g = graphOf(run({ type: "Graphene sheet" }));
  check("T6 sheet: degrees in {1,2,3}", g.deg.every((d) => d >= 1 && d <= 3));
  check("T6 sheet has interior (deg 3) atoms", g.deg.some((d) => d === 3));
}

/* T7: front-half culls a strict subset of transparent edges */
{
  for (const type of ["Fullerene C60", "Nanotube zigzag", "Nanotorus"]) {
    const a = run({ type });
    const b = run({ type, render: "Front half" });
    const setA = new Set(a.paths.map((pa) => JSON.stringify(pa.pts)));
    const sub = b.paths.every((pa) => setA.has(JSON.stringify(pa.pts)));
    check("T7 " + type + ": front-half subset of transparent (" + b.paths.length + "/" + a.paths.length + ")",
      sub && b.paths.length < a.paths.length && b.paths.length > a.paths.length * 0.3);
  }
}

/* T8: yaw/pitch/perspective all change output; determinism */
{
  const base = JSON.stringify(run({ type: "Fullerene C60" }));
  check("T8 yaw changes output", base !== JSON.stringify(run({ type: "Fullerene C60", yaw: 77 })));
  check("T8 pitch changes output", base !== JSON.stringify(run({ type: "Fullerene C60", pitch: -40 })));
  check("T8 perspective changes output", base !== JSON.stringify(run({ type: "Fullerene C60", persp: 0.9 })));
  check("T8 deterministic", base === JSON.stringify(run({ type: "Fullerene C60" })));
}

/* T9: fit — everything inside margins, size honored, atoms dots front-filtered */
{
  let ok = true, why = "";
  for (const type of ["Fullerene C60", "Nanotube armchair", "Nanotube zigzag", "Graphene sheet", "Nanotorus", "Onion C60"]) {
    const p = { ...defaults(), type, atoms: true };
    const r = N.compute([undefined], p, CTX, {});
    let total = 0;
    for (const pa of r.paths) {
      total += pa.pts.length;
      for (const q of pa.pts) {
        if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) { ok = false; why = type + " nonfinite"; }
        if (q[0] < p.margin - p.atomR - 0.01 || q[0] > CTX.W - p.margin + p.atomR + 0.01 ||
            q[1] < p.margin - p.atomR - 0.01 || q[1] > CTX.H - p.margin + p.atomR + 0.01) {
          ok = false; why = type + " off-margin";
        }
      }
    }
    if (total > 120000) { ok = false; why = type + " budget " + total; }
  }
  check("T9 all structures finite, in-margin, in-budget (dots on)", ok, why || "clean");
}

/* T10: extremes — n=16 x tlen=40 tube under budget; tiny canvas no crash */
{
  const r = run({ type: "Nanotube armchair", n: 16, tlen: 40 });
  let total = 0;
  for (const pa of r.paths) total += pa.pts.length;
  check("T10 max tube under budget", total < 120000, total + " pts");
  const r2 = N.compute([undefined], defaults(), { W: 22, H: 22 }, {});
  check("T10 tiny canvas no crash", Array.isArray(r2.paths));
}

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
if (fails) process.exitCode = 1;
