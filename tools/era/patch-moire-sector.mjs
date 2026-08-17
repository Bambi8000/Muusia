/* Era patch: Moire Disc pie-slice sector cutter.
   Adds "Sector deg" (0-360, default 360 = legacy full disc, byte-identical
   output) and "Sector start deg" (showIf sweep < 360). All content modes are
   clipped to the wedge with bisection-clean cut edges; the rim circle becomes
   the closed cake-slice outline (arc + both cut radii); the overlay shows the
   wedge. Wire the Frame clock into Sector deg and the disc fills like a pie
   chart. Idempotent, MISS-aborts, anchored exact-string edits. */

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/defs/nodes/moire_disc.js";
let src = readFileSync(FILE, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.includes("inSector")) {
  console.log("SKIP  patch-moire-sector already applied (sentinel found)");
  process.exit(0);
}

const edits = [
  {
    name: "desc: mention the sector cutter",
    old: `Hatch vs Hatch at 3 degrees is the finest shimmer."`,
    neu: `Hatch vs Hatch at 3 degrees is the finest shimmer. Sector deg cuts the disc down to a pie slice (a cake cutter): every content mode is clipped to the wedge with clean cut edges, Sector start turns the slice around the center, and the rim becomes the closed wedge outline - wire the Frame clock into Sector deg and the disc fills up like a pie chart."`,
  },
  {
    name: "params: Sector deg + Sector start deg after Angle",
    old: `    { key: "angle", label: "Angle deg", type: "slider", min: 0, max: 180, step: 0.5, def: 0 },`,
    neu: `    { key: "angle", label: "Angle deg", type: "slider", min: 0, max: 180, step: 0.5, def: 0 },
    { key: "sweep", label: "Sector deg", type: "slider", min: 0, max: 360, step: 0.5, def: 360 },
    { key: "sectorStart", label: "Sector start deg", type: "slider", min: 0, max: 360, step: 0.5, def: 0, showIf: (p) => p.sweep < 360 },`,
  },
  {
    name: "overlay: wedge guide when sector < 360",
    old: `  overlay(p, ctx) {
    const cx = (ctx.W * p.x) / 100, cy = (ctx.H * p.y) / 100;
    return [{ kind: "circle", cx, cy, r: Math.max(1, p.radius) }];
  },`,
    neu: `  overlay(p, ctx) {
    const cx = (ctx.W * p.x) / 100, cy = (ctx.H * p.y) / 100;
    const R = Math.max(1, p.radius);
    const sweepDeg = Math.max(0, Math.min(360, p.sweep == null ? 360 : p.sweep));
    if (sweepDeg >= 359.999) return [{ kind: "circle", cx, cy, r: R }];
    const th0 = (((p.sectorStart == null ? 0 : p.sectorStart) - 90) * Math.PI) / 180;
    const sweepR = (sweepDeg * Math.PI) / 180;
    const pts = [[cx, cy]];
    const n = 32;
    for (let k = 0; k <= n; k++) {
      const a = th0 + (k / n) * sweepR;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    return [{ kind: "circle", cx, cy, r: R }, { kind: "poly", pts }];
  },`,
  },
  {
    name: "compute: sector constants + clip machinery",
    old: `    const paths = [];
    const BUDGET = 110000;
    let total = 0;
    const push = (pts, closed) => {
      if (pts.length < 2 || total > BUDGET) return;
      total += pts.length;
      paths.push({ pts, closed: !!closed, layer: L });
    };`,
    neu: `    /* pie-slice sector: 360 = full disc, legacy output stays byte-identical */
    const sweepDeg = Math.max(0, Math.min(360, p.sweep == null ? 360 : p.sweep));
    const fullDisc = sweepDeg >= 359.999;
    const nilDisc = sweepDeg < 0.05;
    const th0 = (((p.sectorStart == null ? 0 : p.sectorStart) - 90) * Math.PI) / 180;
    const sweepR = (sweepDeg * Math.PI) / 180;
    const TAU = Math.PI * 2;
    const inSector = (x, y) => {
      if (fullDisc) return true;
      if (nilDisc) return false;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < 0.0025) return true; /* apex counts as inside */
      let d = (Math.atan2(dy, dx) - th0) % TAU;
      if (d < 0) d += TAU;
      return d <= sweepR;
    };
    /* boundary point between two samples on opposite sides (bisection) */
    const edgeCross = (A, B) => {
      let a = A, b = B;
      const ia = inSector(a[0], a[1]);
      for (let i = 0; i < 18; i++) {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (inSector(m[0], m[1]) === ia) a = m; else b = m;
      }
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    };
    /* split a polyline into runs inside the wedge; closed loops re-seam at an outside point */
    const clipWedge = (pts, closed) => {
      if (fullDisc) return [{ pts, closed }];
      const n = pts.length;
      const flags = pts.map((q) => inSector(q[0], q[1]));
      if (flags.every(Boolean)) return [{ pts, closed }];
      if (!flags.some(Boolean)) return [];
      let start = 0;
      if (closed) { while (start < n && flags[start]) start++; }
      const seq = [];
      for (let s = 0; s < n; s++) seq.push(pts[closed ? (start + s) % n : s]);
      if (closed) seq.push(pts[start]);
      const runs = [];
      let run = null;
      for (let s = 0; s < seq.length; s++) {
        const q = seq[s];
        if (inSector(q[0], q[1])) {
          if (!run) { run = []; if (s > 0) run.push(edgeCross(seq[s - 1], q)); }
          run.push([q[0], q[1]]);
        } else if (run) {
          run.push(edgeCross(q, seq[s - 1]));
          if (run.length >= 2) runs.push({ pts: run, closed: false });
          run = null;
        }
      }
      if (run && run.length >= 2) runs.push({ pts: run, closed: false });
      return runs;
    };

    const paths = [];
    const BUDGET = 110000;
    let total = 0;
    const push = (pts, closed) => {
      if (pts.length < 2 || total > BUDGET) return;
      for (const r of clipWedge(pts, closed)) {
        if (r.pts.length < 2) continue;
        total += r.pts.length;
        paths.push({ pts: r.pts, closed: !!r.closed, layer: L });
        if (total > BUDGET) break;
      }
    };`,
  },
  {
    name: "rim: closed cake-slice outline when sector < 360",
    old: `    if (p.rim) circle(cx, cy, R);`,
    neu: `    if (p.rim) {
      if (fullDisc) circle(cx, cy, R);
      else if (!nilDisc && total <= BUDGET) {
        /* wedge outline drawn directly (its points ARE the boundary - no clip) */
        const ds = Math.min(1.2, Math.max(0.6, R / 14));
        const n = Math.max(8, Math.ceil((R * sweepR) / ds));
        const pts = [[cx, cy]];
        for (let k = 0; k <= n; k++) {
          const a = th0 + (k / n) * sweepR;
          pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
        }
        total += pts.length;
        paths.push({ pts, closed: true, layer: L });
      }
    }`,
  },
];

for (const e of edits) {
  const parts = src.split(e.old);
  if (parts.length === 2) { src = parts.join(e.neu); OK(e.name); }
  else if (parts.length === 1) MISS(e.name + " (anchor not found)");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - " + FILE + " NOT written");
  process.exit(1);
}
writeFileSync(FILE, src);
console.log("DONE  " + ok + "/" + edits.length + " edits applied, " + FILE + " written");
