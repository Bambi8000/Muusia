import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "colour_neighbours",
  name: "Colour Neighbours",
  cat: "mod",
  group: "penout",
  desc: "Assign pens to closed shapes, trying to give touching or overlapping neighbours different colours. Feed closed Cells from Adaptive Grid, tiles or other region shapes into Regions. Touch distance mm also treats nearby borders as neighbours. Open paths keep their original pen. Colored preserves the exact input geometry and path order; Conflicts draws links between any neighbours that still share a pen, for cases with too few distinct pens or a colouring the heuristic cannot resolve. Choose up to six pens. For very large inputs (over 2200 regions or 50000 vertices), the node passes paths through unchanged rather than silently colouring only part of the drawing.",
  ins: [Pin("paths", "Regions")],
  outs: [Pin("paths", "Colored"), Pin("paths", "Conflicts")],
  params: [
    { key: "colors", label: "Pens in use", type: "slider", min: 2, max: 6, step: 1, def: 4 },
    { key: "touch", label: "Touch distance mm", type: "slider", min: 0, max: 8, step: 0.1, def: 0.4 },
    { key: "pen1", label: "Pen 1", type: "pen", def: 0 },
    { key: "pen2", label: "Pen 2", type: "pen", def: 1 },
    { key: "pen3", label: "Pen 3", type: "pen", def: 2, showIf: p => +p.colors >= 3 },
    { key: "pen4", label: "Pen 4", type: "pen", def: 3, showIf: p => +p.colors >= 4 },
    { key: "pen5", label: "Pen 5", type: "pen", def: 4, showIf: p => +p.colors >= 5 },
    { key: "pen6", label: "Pen 6", type: "pen", def: 5, showIf: p => +p.colors >= 6 },
    { key: "conflictPen", label: "Conflict pen", type: "pen", def: 2 },
  ],
  overlay(p, ctx, ins) {
    const paths = ins?.[0]?.paths || [];
    return paths.filter(q => q?.closed && Array.isArray(q.pts) && q.pts.length >= 3).slice(0, 12)
      .map(q => ({ kind: "poly", pts: q.pts }));
  },
  compute(ins, p) {
    const src = ins?.[0]?.paths;
    if (!Array.isArray(src) || src.length === 0) return [EMPTY, EMPTY];
    const finite = v => Number.isFinite(+v);
    const n = (v, lo, hi, d) => finite(v) ? Math.max(lo, Math.min(hi, +v)) : d;
    const max = Math.round(n(p.colors, 2, 6, 4)), gap = n(p.touch, 0, 8, 0.4);
    const palette = [];
    for (let i = 1; i <= max; i++) {
      const pen = Math.round(n(p["pen" + i], 0, 11, i - 1));
      if (!palette.includes(pen)) palette.push(pen);
    }
    const regions = [];
    let vertices = 0;
    for (let i = 0; i < src.length; i++) {
      const q = src[i], pts = q?.pts;
      if (!q?.closed || !Array.isArray(pts) || pts.length < 3 || !pts.every(v => Array.isArray(v) && finite(v[0]) && finite(v[1]))) continue;
      vertices += pts.length;
      if (regions.length >= 2200 || vertices > 50000) return [{ paths: src }, EMPTY];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const v of pts) { x0 = Math.min(x0, +v[0]); x1 = Math.max(x1, +v[0]); y0 = Math.min(y0, +v[1]); y1 = Math.max(y1, +v[1]); }
      regions.push({ index: i, pts, box: [x0, y0, x1, y1], cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
    if (!regions.length) return [{ paths: src }, EMPTY];
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const pointSegment = (q, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], d = dx * dx + dy * dy;
      const t = d > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / d)) : 0;
      return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
    };
    const segmentsNear = (a, b, c, d) => {
      if (Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) > Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + gap ||
          Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) > Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + gap) return false;
      const ab1 = cross(a, b, c), ab2 = cross(a, b, d), cd1 = cross(c, d, a), cd2 = cross(c, d, b);
      if (ab1 * ab2 <= 0 && cd1 * cd2 <= 0) return true;
      return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b)) <= gap + 1e-9;
    };
    const inside = (pt, poly) => {
      let yes = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
      }
      return yes;
    };
    const adjacent = (a, b) => {
      const A = a.box, B = b.box;
      if (A[0] > B[2] + gap || B[0] > A[2] + gap || A[1] > B[3] + gap || B[1] > A[3] + gap) return false;
      if (inside(a.pts[0], b.pts) || inside(b.pts[0], a.pts)) return true;
      for (let i = 0; i < a.pts.length; i++) {
        const p0 = a.pts[i], p1 = a.pts[(i + 1) % a.pts.length];
        for (let j = 0; j < b.pts.length; j++) if (segmentsNear(p0, p1, b.pts[j], b.pts[(j + 1) % b.pts.length])) return true;
      }
      return false;
    };
    const links = regions.map(() => new Set());
    for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
      if (adjacent(regions[i], regions[j])) { links[i].add(j); links[j].add(i); }
    }
    const assignment = Array(regions.length).fill(null), usage = new Map(palette.map(q => [q, 0]));
    for (let step = 0; step < regions.length; step++) {
      let best = -1, bestSat = -1, bestDegree = -1;
      for (let i = 0; i < regions.length; i++) {
        if (assignment[i] !== null) continue;
        const sat = new Set([...links[i]].map(j => assignment[j]).filter(q => q !== null)).size;
        const degree = links[i].size;
        if (sat > bestSat || sat === bestSat && degree > bestDegree) { best = i; bestSat = sat; bestDegree = degree; }
      }
      const conflicts = pen => [...links[best]].filter(j => assignment[j] === pen).length;
      const pen = [...palette].sort((a, b) => conflicts(a) - conflicts(b) || usage.get(a) - usage.get(b) || palette.indexOf(a) - palette.indexOf(b))[0];
      assignment[best] = pen; usage.set(pen, usage.get(pen) + 1);
    }
    const colored = [...src];
    for (let i = 0; i < regions.length; i++) colored[regions[i].index] = { ...src[regions[i].index], layer: assignment[i] };
    const conflictPen = Math.round(n(p.conflictPen, 0, 11, 2)), conflicts = [];
    for (let i = 0; i < regions.length; i++) for (const j of links[i]) if (j > i && assignment[i] === assignment[j]) {
      const a = regions[i], b = regions[j];
      const pts = a.cx === b.cx && a.cy === b.cy ? [[a.cx - 1, a.cy - 1], [a.cx + 1, a.cy + 1]] : [[a.cx, a.cy], [b.cx, b.cy]];
      conflicts.push({ pts, closed: false, layer: conflictPen });
    }
    return [{ paths: colored }, { paths: conflicts }];
  },
};
