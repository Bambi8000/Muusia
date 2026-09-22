import { Pin, EMPTY, mulberry32, hash2 } from "../helpers.js";

export default {
  /* Ray Fill — fills every closed shape with rays clipped to its interior.
     Centres: Per shape (Centroid / Random inside / Edge / Outside / Mix) or
     Shared (N seeded centres on the sheet; Nearest centre or All centres).
     Even-odd clipping: nested rings are holes. Geometry shared between
     compute and overlay via this._plan (engine calls both as def methods). */
  key: "rayfill",
  name: "Ray Fill",
  cat: "mod",
  group: "fillstyle",
  desc: "Fills every closed shape with straight rays that fan out from a centre and are clipped to the shape (nested shapes act as holes). Centres · Per shape gives each shape its own centre: Centroid (starburst), Random inside (off-centre burst), Edge (a fan from the outline) or Outside (sweeping near-parallel chords through the shape) — Mix lets each shape draw its own kind for the varied look of a hand-filled map. Centres · Shared scatters a few seeded centres over the sheet; Nearest centre fills each shape only from the centre closest to it, All centres lets every centre radiate through the whole sheet so one burst spills across many shapes. Spacing at rim sets the ray gap at the shape's far edge — rays converge toward the core exactly like a real pen starburst; Core gap opens a hole there instead of an ink pool. Fill fraction fills only a seeded share of the shapes and leaves the rest blank. Jitter wobbles ray angles by hand; Min length drops slivers; Alternate direction plots rays as a zigzag (off = every ray drawn from the core outward). Keep outlines passes the shapes through, Inherit shape pens colours the rays with each shape's pen.",
  ins: [Pin("paths", "Shapes")],
  outs: [Pin("paths")],
  params: [
    { key: "centres", label: "Centres", type: "select", options: ["Per shape", "Shared"], def: "Per shape" },
    { key: "place", label: "Placement", type: "select", options: ["Centroid", "Random inside", "Edge", "Outside", "Mix"], def: "Mix", showIf: (p) => p.centres === "Per shape" },
    { key: "nCentres", label: "Centres count", type: "slider", min: 1, max: 12, step: 1, def: 3, showIf: (p) => p.centres === "Shared" },
    { key: "assign", label: "Assign", type: "select", options: ["Nearest centre", "All centres"], def: "Nearest centre", showIf: (p) => p.centres === "Shared" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10, showIf: (p) => p.centres === "Shared" },
    { key: "spacing", label: "Spacing at rim mm", type: "slider", min: 0.5, max: 12, step: 0.1, def: 2 },
    { key: "coreGap", label: "Core gap mm", type: "slider", min: 0, max: 20, step: 0.5, def: 0 },
    { key: "minLen", label: "Min length mm", type: "slider", min: 0, max: 5, step: 0.1, def: 0.6 },
    { key: "jitter", label: "Jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.1 },
    { key: "fillFrac", label: "Fill fraction", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
    { key: "alternate", label: "Alternate direction", type: "check", def: true },
    { key: "outlines", label: "Keep outlines", type: "check", def: true },
    { key: "inherit", label: "Inherit shape pens", type: "check", def: false },
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "layer", label: "Fill pen", type: "pen", def: 11 },
  ],

  /* Shared planner: rings -> groups (outer + holes) -> jobs { cx, cy, rings }.
     Pure function of (ins, p, ctx). Returns { jobs, groups }. */
  _plan(ins, p, ctx) {
    const src = (ins && ins[0]) || EMPTY;
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const seed = (Math.round(p.seed) || 1) >>> 0;
    const rings = [];
    for (const pa of src.paths || []) {
      if (!pa || !pa.closed || !pa.pts || pa.pts.length < 3) continue;
      let okp = true;
      for (const q of pa.pts) if (!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) { okp = false; break; }
      if (!okp) continue;
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const [x, y] of pa.pts) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      rings.push({ pts: pa.pts, layer: Number.isInteger(pa.layer) ? pa.layer : 0, bb: [bx0, by0, bx1, by1], bc: [(bx0 + bx1) / 2, (by0 + by1) / 2], br: Math.hypot(bx1 - bx0, by1 - by0) / 2 });
    }
    const contains = (ring, x, y) => {
      let ins2 = false;
      if (ring.bb && (x < ring.bb[0] || x > ring.bb[2] || y < ring.bb[1] || y > ring.bb[3])) return false;
      const P = ring.pts || ring;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i], [xj, yj] = P[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins2 = !ins2;
      }
      return ins2;
    };
    /* nesting depth by containment of a representative vertex */
    const depth = rings.map((r, i) => {
      let c = 0;
      const [x, y] = r.pts[0];
      for (let k = 0; k < rings.length; k++) if (k !== i && contains(rings[k], x, y)) c++;
      return c;
    });
    const groups = [];
    for (let i = 0; i < rings.length; i++) {
      if (depth[i] % 2 !== 0) continue;
      const outer = rings[i];
      const holes = [];
      for (let k = 0; k < rings.length; k++) {
        if (depth[k] !== depth[i] + 1) continue;
        if (contains(outer, rings[k].pts[0][0], rings[k].pts[0][1])) holes.push(rings[k]);
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of outer.pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      /* area-weighted centroid, fallback bbox centre */
      let a = 0, cx = 0, cy = 0;
      const P = outer.pts;
      for (let k = 0, j = P.length - 1; k < P.length; j = k++) {
        const cr = P[j][0] * P[k][1] - P[k][0] * P[j][1];
        a += cr; cx += (P[j][0] + P[k][0]) * cr; cy += (P[j][1] + P[k][1]) * cr;
      }
      if (Math.abs(a) > 1e-9) { cx /= 3 * a; cy /= 3 * a; } else { cx = (minX + maxX) / 2; cy = (minY + maxY) / 2; }
      if (!(cx >= minX && cx <= maxX && cy >= minY && cy <= maxY)) { cx = (minX + maxX) / 2; cy = (minY + maxY) / 2; }
      groups.push({ id: groups.length, rings: [outer, ...holes], bbox: [minX, minY, maxX, maxY], cen: [cx, cy], layer: outer.layer });
    }
    const inGroup = (g, x, y) => {
      let ins2 = false;
      for (const r of g.rings) if (contains(r, x, y)) ins2 = !ins2;
      return ins2;
    };
    const frac = Math.max(0, Math.min(1, p.fillFrac));
    const active = groups.filter((g) => frac >= 1 || hash2(g.id + 1, 17, seed) < frac);
    const jobs = [];
    if (p.centres === "Shared") {
      const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 1));
      const n = Math.max(1, Math.min(12, Math.round(p.nCentres) || 1));
      const rng = mulberry32(seed * 977 + 13);
      const cs = [];
      for (let i = 0; i < n; i++) {
        /* best-candidate sampling: spread the centres apart */
        let best = null, bestD = -1;
        const tries = i === 0 ? 1 : 12;
        for (let t = 0; t < tries; t++) {
          const x = m + rng() * (W - 2 * m), y = m + rng() * (H - 2 * m);
          let d = Infinity;
          for (const c of cs) d = Math.min(d, Math.hypot(c[0] - x, c[1] - y));
          if (d > bestD) { bestD = d; best = [x, y]; }
        }
        cs.push(best);
      }
      if (p.assign === "All centres") {
        const all = [];
        for (const g of active) for (const r of g.rings) all.push(r);
        for (let i = 0; i < cs.length; i++) jobs.push({ cx: cs[i][0], cy: cs[i][1], rings: all, kind: "shared" });
      } else {
        const buckets = cs.map(() => []);
        for (const g of active) {
          let bi = 0, bd = Infinity;
          for (let i = 0; i < cs.length; i++) {
            const d = Math.hypot(cs[i][0] - g.cen[0], cs[i][1] - g.cen[1]);
            if (d < bd) { bd = d; bi = i; }
          }
          for (const r of g.rings) buckets[bi].push(r);
        }
        for (let i = 0; i < cs.length; i++) jobs.push({ cx: cs[i][0], cy: cs[i][1], rings: buckets[i], kind: "shared" });
      }
      return { jobs, groups, centres: cs, marginBox: [m, m, W - 2 * m, H - 2 * m] };
    }
    /* Per shape */
    const KINDS = ["Centroid", "Random inside", "Edge", "Outside"];
    for (const g of active) {
      const rng = mulberry32(seed * 131 + g.id * 7919 + 3);
      let kind = p.place;
      if (kind === "Mix") {
        const u = rng();
        kind = u < 0.3 ? "Centroid" : u < 0.6 ? "Random inside" : u < 0.8 ? "Edge" : "Outside";
      }
      if (KINDS.indexOf(kind) < 0) kind = "Centroid";
      const [minX, minY, maxX, maxY] = g.bbox;
      const bw = maxX - minX, bh = maxY - minY;
      const diag = Math.hypot(bw, bh) || 1;
      let cx = g.cen[0], cy = g.cen[1];
      if (kind === "Random inside") {
        for (let t = 0; t < 60; t++) {
          const x = minX + rng() * bw, y = minY + rng() * bh;
          if (inGroup(g, x, y)) { cx = x; cy = y; break; }
        }
      } else if (kind === "Edge") {
        const P = g.rings[0].pts;
        let per = 0;
        const segL = [];
        for (let k = 0; k < P.length; k++) { const q = P[(k + 1) % P.length]; const l = Math.hypot(q[0] - P[k][0], q[1] - P[k][1]); segL.push(l); per += l; }
        let s = rng() * per, k = 0;
        while (k < P.length - 1 && s > segL[k]) { s -= segL[k]; k++; }
        const A = P[k], B = P[(k + 1) % P.length];
        const l = segL[k] || 1, tt = Math.min(1, s / l);
        const ex = A[0] + (B[0] - A[0]) * tt, ey = A[1] + (B[1] - A[1]) * tt;
        const nx = -(B[1] - A[1]) / l, ny = (B[0] - A[0]) / l;
        const push = 0.5;
        if (inGroup(g, ex + nx * push, ey + ny * push)) { cx = ex - nx * push; cy = ey - ny * push; }
        else { cx = ex + nx * push; cy = ey + ny * push; }
      } else if (kind === "Outside") {
        const ang = rng() * Math.PI * 2;
        const dist = diag * (0.5 + 0.3 + rng() * 0.9);
        cx = (minX + maxX) / 2 + Math.cos(ang) * dist;
        cy = (minY + maxY) / 2 + Math.sin(ang) * dist;
      }
      jobs.push({ cx, cy, rings: g.rings, kind });
    }
    return { jobs, groups, centres: jobs.map((j) => [j.cx, j.cy]), marginBox: null };
  },

  overlay(p, ctx, ins) {
    try {
      const plan = this && this._plan ? this._plan(ins, p, ctx) : null;
      if (!plan) return [];
      const g = [];
      if (plan.marginBox) g.push({ kind: "rect", x: plan.marginBox[0], y: plan.marginBox[1], w: plan.marginBox[2], h: plan.marginBox[3] });
      for (const c of plan.centres.slice(0, 200)) if (Number.isFinite(c[0]) && Number.isFinite(c[1])) g.push({ kind: "point", x: c[0], y: c[1] });
      return g;
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const src = (ins && ins[0]) || EMPTY;
    const paths = [];
    for (const pa of src.paths || []) if (pa && pa.pts && (p.outlines || !pa.closed)) paths.push(pa);
    const plan = this && this._plan ? this._plan(ins, p, ctx) : { jobs: [] };
    const seed = (Math.round(p.seed) || 1) >>> 0;
    const sp = Math.max(0.3, p.spacing);
    const coreGap = Math.max(0, p.coreGap);
    const minLen = Math.max(0, p.minLen);
    const jit = Math.max(0, Math.min(1, p.jitter));
    const pen = Math.round(p.layer);
    const BUDGET = 55000;
    let segs = 0;
    const TWO_PI = Math.PI * 2;
    for (let ji = 0; ji < plan.jobs.length && segs < BUDGET; ji++) {
      const job = plan.jobs[ji];
      const { cx, cy } = job;
      if (!job.rings.length) continue;
      /* extent + angular span of everything this job clips against */
      let rMax = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const r of job.rings) for (const [x, y] of r.pts) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > rMax) rMax = d;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (rMax < 1e-6) continue;
      const n = Math.max(6, Math.min(1440, Math.round((TWO_PI * rMax) / sp)));
      const dth = TWO_PI / n;
      let base = 0, span = TWO_PI, k0 = 0, kN = n;
      const inside = cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
      if (!inside) {
        base = Math.atan2((minY + maxY) / 2 - cy, (minX + maxX) / 2 - cx);
        let lo = 0, hi = 0, wide = false;
        for (const r of job.rings) for (const [x, y] of r.pts) {
          let a = Math.atan2(y - cy, x - cx) - base;
          while (a > Math.PI) a -= TWO_PI;
          while (a < -Math.PI) a += TWO_PI;
          if (Math.abs(a) >= Math.PI / 2) { wide = true; break; }
          if (a < lo) lo = a; if (a > hi) hi = a;
        }
        if (!wide) { k0 = Math.floor(lo / dth) - 1; kN = Math.ceil(hi / dth) + 2; span = (kN - k0) * dth; }
      }
      const ts = [], tl = [];
      let rayIdx = 0;
      for (let k = k0; k < kN && segs < BUDGET; k++, rayIdx++) {
        const th = base + k * dth + (jit ? (hash2(k + 1000, ji + 1, seed) * 2 - 1) * dth * 0.45 * jit : 0);
        const dx = Math.cos(th), dy = Math.sin(th);
        ts.length = 0; tl.length = 0;
        for (const r of job.rings) {
          /* line-vs-bbox rejection: perpendicular distance from the ray line to the bbox centre */
          if (r.bc && Math.abs(dx * (r.bc[1] - cy) - dy * (r.bc[0] - cx)) > r.br) continue;
          const P = r.pts;
          for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
            const ax = P[j][0] - cx, ay = P[j][1] - cy, bx = P[i][0] - cx, by = P[i][1] - cy;
            const sa = dx * ay - dy * ax, sb = dx * by - dy * bx;
            if ((sa > 0) !== (sb > 0)) {
              const ta = ax * dx + ay * dy, tb = bx * dx + by * dy;
              ts.push(ta + ((tb - ta) * (0 - sa)) / (sb - sa));
              tl.push(r.layer);
            }
          }
        }
        if (ts.length < 2) continue;
        const order = ts.map((_, i) => i).sort((i, j) => ts[i] - ts[j]);
        for (let q = 0; q + 1 < order.length && segs < BUDGET; q += 2) {
          let tA = ts[order[q]], tB = ts[order[q + 1]];
          if (tB <= coreGap) continue;
          if (tA < coreGap) tA = coreGap;
          if (tB - tA < Math.max(minLen, 0.05)) continue;
          const lay = p.inherit ? tl[order[q]] : pen;
          const A = [cx + dx * tA, cy + dy * tA], B = [cx + dx * tB, cy + dy * tB];
          paths.push({ pts: p.alternate && rayIdx % 2 === 1 ? [B, A] : [A, B], closed: false, layer: lay });
          segs++;
        }
      }
    }
    return { paths };
  },
};
