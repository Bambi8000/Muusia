import { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "roadmap",
  name: "Road Map",
  cat: "gen",
  group: "structural",
  desc: "Procedural city map. The canvas splits into seeded districts, each drawn in its own street pattern \u2014 rotated grids, organic lanes, ring-and-spoke radials, sparse industrial blocks — built by recursive block subdivision, so streets meet in T-junctions, kink at discrete points and trail off into dead ends (Irregularity drives split jitter, bends and stubs) \u2014 mixed by the four weight sliders, while Empty space leaves whole districts blank for negative space. Roads come in three weights: single-stroke streets (Raggedness breaks them into the worn dashed look), double-stroke arterials linking district centers, and triple-stroke motorways that cross the whole sheet in long straights with wide rounded bends (Motorway bend sets how much they deviate from dead straight); Ramps adds slip-road arcs where motorways meet arterials. River and lakes carve water with shorelines \u2014 streets and arterials keep off the banks, motorways bridge straight over. Fields hatches farm patches into empty districts and Landmarks stamps filled squares at junctions. Three pens: roads, water, fields. Tip: raise Empty space and Fields for a countryside sheet, or zero them for dense downtown.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 8 },
    { key: "districts", label: "Districts", type: "slider", min: 3, max: 24, step: 1, def: 10 },
    { key: "spacing", label: "Street spacing", type: "slider", min: 2, max: 10, step: 0.1, def: 4 },
    { key: "ragged", label: "Raggedness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "irregular", label: "Irregularity", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "wGrid", label: "Grid mix", type: "slider", min: 0, max: 1, step: 0.01, def: 1 },
    { key: "wOrg", label: "Organic mix", type: "slider", min: 0, max: 1, step: 0.01, def: 0.8 },
    { key: "wRad", label: "Radial mix", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "wSparse", label: "Sparse mix", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "empty", label: "Empty space", type: "slider", min: 0, max: 1, step: 0.01, def: 0.25 },
    { key: "highways", label: "Motorways", type: "slider", min: 0, max: 4, step: 1, def: 2 },
    { key: "hwWidth", label: "Motorway width", type: "slider", min: 1, max: 6, step: 0.1, def: 3 },
    { key: "ramps", label: "Ramps", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "hwBend", label: "Motorway bend", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "arterials", label: "Arterials", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7 },
    { key: "water", label: "Water", type: "select",
      options: ["None", "River", "Lakes", "River + lakes"], def: "River + lakes" },
    { key: "waterW", label: "River width", type: "slider", min: 4, max: 30, step: 0.5, def: 12 },
    { key: "fields", label: "Fields", type: "slider", min: 0, max: 20, step: 1, def: 6 },
    { key: "landmarks", label: "Landmarks", type: "slider", min: 0, max: 40, step: 1, def: 14 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 30, step: 1, def: 8 },
    { key: "roadPen", label: "Road pen", type: "pen", def: 0 },
    { key: "waterPen", label: "Water pen", type: "pen", def: 1 },
    { key: "fieldPen", label: "Field pen", type: "pen", def: 3 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed);
    const m = Math.max(0, p.margin);
    const lox = m, loy = m, hix = W - m, hiy = H - m;
    if (hix - lox < 20 || hiy - loy < 20) return EMPTY;
    const spacing = Math.max(1.5, p.spacing);
    const roadPen = Math.round(p.roadPen) % PENS.length;
    const waterPen = Math.round(p.waterPen) % PENS.length;
    const fieldPen = Math.round(p.fieldPen) % PENS.length;
    const inRegion = ([x, y]) => x >= lox && x <= hix && y >= loy && y <= hiy;

    const paths = [];
    let budget = 112000;
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      // clamp into the margin box: offset strokes (motorway/arterial edges)
      // may poke past the border; clamped runs follow the frame instead
      const cl = pts.map(([x, y]) => [
        Math.min(hix, Math.max(lox, x)),
        Math.min(hiy, Math.max(loy, y)),
      ]);
      paths.push({ pts: cl, closed, layer });
    };
    const offsetPath = (pts, d) => {
      const n = pts.length, out = [];
      for (let i = 0; i < n; i++) {
        const q = pts[i], pv = pts[Math.max(0, i - 1)], nx = pts[Math.min(n - 1, i + 1)];
        let d1 = [q[0] - pv[0], q[1] - pv[1]], d2 = [nx[0] - q[0], nx[1] - q[1]];
        const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
        if (l1 > 1e-9) d1 = [d1[0] / l1, d1[1] / l1];
        if (l2 > 1e-9) d2 = [d2[0] / l2, d2[1] / l2];
        if (i === 0 || l1 < 1e-9) d1 = d2;
        if (i === n - 1 || l2 < 1e-9) d2 = d1;
        const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
        let mm = [n1[0] + n2[0], n1[1] + n2[1]];
        const ml = Math.hypot(mm[0], mm[1]);
        mm = ml < 1e-6 ? n1 : [mm[0] / ml, mm[1] / ml];
        const co = Math.max(0.4, mm[0] * n1[0] + mm[1] * n1[1]);
        out.push([q[0] + (mm[0] * d) / co, q[1] + (mm[1] * d) / co]);
      }
      return out;
    };

    /* ================= WATER ================= */
    const rngW = mulberry32(seed * 7919 + 101);
    const wantRiver = p.water === "River" || p.water === "River + lakes";
    const wantLakes = p.water === "Lakes" || p.water === "River + lakes";
    const wW = Math.max(3, p.waterW);
    const rBase = loy + (hiy - loy) * (0.3 + 0.4 * rngW());
    const rAmp = (hiy - loy) * (0.1 + 0.12 * rngW());
    const riverY = (x) => Math.min(hiy - wW / 2 - 2, Math.max(loy + wW / 2 + 2,
      rBase + (noise2(x * 0.015, 7.3, seed + 17) - 0.5) * 2 * rAmp));
    const lakes = [];
    if (wantLakes) {
      const nl = 1 + Math.floor(rngW() * 2);
      for (let k = 0; k < nl; k++) {
        lakes.push({
          x: lox + 15 + rngW() * (hix - lox - 30),
          y: loy + 15 + rngW() * (hiy - loy - 30),
          r: 10 + rngW() * 16, k,
        });
      }
    }
    const lakeEdge = (L, ang) =>
      L.r * (1 + 0.3 * (noise2(Math.cos(ang) * 2 + 9, Math.sin(ang) * 2 + 9, seed + 31 + L.k) - 0.5) * 2);
    const waterAt = (pt, pad) => {
      if (wantRiver && Math.abs(pt[1] - riverY(pt[0])) < wW / 2 + pad) return true;
      for (const L of lakes) {
        const d = Math.hypot(pt[0] - L.x, pt[1] - L.y);
        if (d < L.r * 1.4 + pad && d < lakeEdge(L, Math.atan2(pt[1] - L.y, pt[0] - L.x)) + pad)
          return true;
      }
      return false;
    };
    // draw water
    if (wantRiver) {
      const C = [];
      for (let x = lox; x <= hix; x += 1.5) C.push([x, riverY(x)]);
      for (const off of wW / 2 > 4 ? [-wW / 2, -wW / 2 + 1.8, wW / 2 - 1.8, wW / 2] : [-wW / 2, wW / 2])
        push(offsetPath(C, off), false, waterPen);
    }
    for (const L of lakes) {
      for (const inset of [0, 1.8]) {
        const pts = [];
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          const e = Math.max(2, lakeEdge(L, a) - inset);
          pts.push([L.x + Math.cos(a) * e, L.y + Math.sin(a) * e]);
        }
        if (pts.every(inRegion)) push(pts, true, waterPen);
      }
    }

    /* ================= DISTRICTS ================= */
    const rngS = mulberry32(seed * 7919 + 211);
    const nD = Math.max(3, Math.round(p.districts));
    const sites = [];
    const minD = Math.max(20, Math.sqrt(((hix - lox) * (hiy - loy)) / nD) * 0.65);
    for (let i = 0; i < nD; i++) {
      let best = null;
      for (let t = 0; t < 60; t++) {
        const x = lox + 8 + rngS() * (hix - lox - 16);
        const y = loy + 8 + rngS() * (hiy - loy - 16);
        if (sites.every((s) => Math.hypot(s.x - x, s.y - y) >= minD)) { best = [x, y]; break; }
        if (!best) best = [x, y];
      }
      sites.push({ x: best[0], y: best[1] });
    }
    const weights = [Math.max(0, p.wGrid), Math.max(0, p.wOrg),
                     Math.max(0, p.wRad), Math.max(0, p.wSparse)];
    const wSum = weights.reduce((a, b) => a + b) || 1;
    const TYPES = ["grid", "organic", "radial", "sparse"];
    for (const s of sites) {
      if (rngS() < p.empty) { s.type = "empty"; continue; }
      let r = rngS() * wSum;
      s.type = "grid";
      for (let t = 0; t < 4; t++) { if (r < weights[t]) { s.type = TYPES[t]; break; } r -= weights[t]; }
      s.rot = rngS() * Math.PI;
      s.sp = spacing * (0.8 + 0.5 * rngS());
    }
    const nearest = (pt) => {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < nD; i++) {
        const d = (pt[0] - sites[i].x) ** 2 + (pt[1] - sites[i].y) ** 2;
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    };
    // coarse bbox per district
    const bb = sites.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
    for (let y = loy; y <= hiy; y += 5) for (let x = lox; x <= hix; x += 5) {
      const i = nearest([x, y]);
      bb[i][0] = Math.min(bb[i][0], x); bb[i][1] = Math.min(bb[i][1], y);
      bb[i][2] = Math.max(bb[i][2], x); bb[i][3] = Math.max(bb[i][3], y);
    }

    /* ================= STREET EMISSION ================= */
    const chopRagged = (run) => {
      if (p.ragged <= 0.01) return [run];
      const out = [];
      let cur = [], i = 0;
      while (i < run.length) {
        const q = run[i];
        const chunk = Math.max(4, Math.round((6 + 10 * hash2(q[0] * 0.5, q[1] * 0.5, seed + 71)) / 1.2));
        const keep = hash2(Math.round(q[0]), Math.round(q[1]), seed + 77) > p.ragged * 0.45;
        for (let k = 0; k < chunk && i < run.length; k++, i++)
          if (keep) cur.push(run[i]);
        if (!keep && cur.length) { out.push(cur); cur = []; }
      }
      if (cur.length) out.push(cur);
      return out;
    };
    const emitStreet = (pts, keep) => {
      let run = [];
      const flush = () => {
        for (const r of chopRagged(run))
          if (r.length >= 2 && pathLength(r, false) > 1.5) push(r, false, roadPen);
        run = [];
      };
      for (const q of pts) { if (keep(q)) run.push(q); else flush(); }
      flush();
    };
    const keepDistrict = (i) => (pt) =>
      inRegion(pt) && nearest(pt) === i && !waterAt(pt, 1.2);

    // split a convex polygon by the line through P with direction (dx,dy);
    // returns [halfA, halfB, chordEndpoints] or null
    const splitPoly = (poly, P, dx, dy) => {
      const side = poly.map(([x, y]) => (x - P[0]) * dy - (y - P[1]) * dx);
      const A = [], B = [], hits = [];
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        (side[i] >= 0 ? A : B).push(poly[i]);
        if ((side[i] > 0 && side[j] < 0) || (side[i] < 0 && side[j] > 0)) {
          const t = side[i] / (side[i] - side[j]);
          const X = [poly[i][0] + (poly[j][0] - poly[i][0]) * t,
                     poly[i][1] + (poly[j][1] - poly[i][1]) * t];
          A.push(X); B.push(X); hits.push(X);
        }
      }
      if (hits.length < 2 || A.length < 3 || B.length < 3) return null;
      return [A, B, [hits[0], hits[1]]];
    };
    const polyArea = (poly) => {
      let a = 0;
      for (let i = 0; i < poly.length; i++) {
        const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
        a += x0 * y1 - x1 * y0;
      }
      return Math.abs(a / 2);
    };
    const longestEdge = (poly) => {
      let bl = 0, be = [1, 0];
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        const ex = poly[j][0] - poly[i][0], ey = poly[j][1] - poly[i][1];
        const L = Math.hypot(ex, ey);
        if (L > bl) { bl = L; be = [ex / L, ey / L]; }
      }
      return { len: bl, dir: be };
    };
    // street from A to B with discrete bend points (real streets kink,
    // they do not wave): piecewise-linear offset profile
    const kinkedStreet = (A, B, irr, rngD) => {
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (L < 1) return [A, B];
      const ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
      const nx = -uy, ny = ux;
      const bp = [[0, 0]];
      const nk = irr < 0.12 || L < 8 ? 0 : 1 + Math.floor(rngD() * 2);
      for (let k = 0; k < nk; k++)
        bp.push([0.2 + 0.6 * rngD(), (rngD() - 0.5) * 2 * Math.min(3, irr * 3)]);
      bp.push([1, 0]);
      bp.sort((a, b) => a[0] - b[0]);
      const offAt = (t) => {
        for (let k = 1; k < bp.length; k++)
          if (t <= bp[k][0]) {
            const f = (t - bp[k - 1][0]) / Math.max(1e-9, bp[k][0] - bp[k - 1][0]);
            return bp[k - 1][1] + (bp[k][1] - bp[k - 1][1]) * f;
          }
        return 0;
      };
      const pts = [];
      for (let d = 0; d <= L; d += 1.2) {
        const o = offAt(d / L);
        pts.push([A[0] + ux * d + nx * o, A[1] + uy * d + ny * o]);
      }
      return pts;
    };

    for (let i = 0; i < nD && budget > 0; i++) {
      const s = sites[i];
      if (s.type === "empty" || bb[i][0] === Infinity) continue;
      const keep = keepDistrict(i);
      const cxd = (bb[i][0] + bb[i][2]) / 2, cyd = (bb[i][1] + bb[i][3]) / 2;
      const ext = Math.hypot(bb[i][2] - bb[i][0], bb[i][3] - bb[i][1]) / 2 + s.sp;
      if (s.type === "radial") {
        for (let r = s.sp; r <= ext; r += s.sp) {
          const pts = [];
          const nn = Math.max(24, Math.ceil((2 * Math.PI * r) / 1.2));
          for (let k = 0; k <= nn; k++) {
            const a = (k / nn) * Math.PI * 2;
            pts.push([s.x + Math.cos(a) * r, s.y + Math.sin(a) * r]);
          }
          emitStreet(pts, keep);
        }
        const spokes = 10 + Math.floor(hash2(i, 3, seed) * 8);
        for (let k = 0; k < spokes; k++) {
          const a = (k / spokes) * Math.PI * 2 + s.rot;
          const pts = [];
          for (let r = s.sp * 0.6; r <= ext; r += 1.2)
            pts.push([s.x + Math.cos(a) * r, s.y + Math.sin(a) * r]);
          emitStreet(pts, keep);
        }
        continue;
      }
      // recursive block subdivision: districts get irregular real-city
      // blocks with jittered split angles, kinked streets and dead-end stubs
      const sp = s.type === "sparse" ? s.sp * 2.4 : s.sp;
      const irr = Math.min(1.3, Math.max(0, p.irregular) *
        (s.type === "organic" ? 1.6 : s.type === "grid" ? 0.7 : 1));
      const rngD = mulberry32(seed * 7919 + 811 + i * 97);
      const ca = Math.cos(s.rot), sa = Math.sin(s.rot);
      const root = [[-ext, -ext], [ext, -ext], [ext, ext], [-ext, ext]]
        .map(([lx, ly]) => [cxd + lx * ca - ly * sa, cyd + lx * sa + ly * ca]);
      const stack = [root], final = [];
      let iter = 0;
      while (stack.length && iter++ < 500 && budget > 0) {
        const blk = stack.pop();
        const { len, dir } = longestEdge(blk);
        if (len < sp * 2 || polyArea(blk) < sp * sp * 2.2) { final.push(blk); continue; }
        let mx = 0, my = 0;
        for (const [x, y] of blk) { mx += x; my += y; }
        mx /= blk.length; my /= blk.length;
        const P = [mx + dir[0] * (rngD() - 0.5) * len * 0.35 * (0.3 + irr),
                   my + dir[1] * (rngD() - 0.5) * len * 0.35 * (0.3 + irr)];
        const ang = Math.atan2(dir[1], dir[0]) + Math.PI / 2 + (rngD() - 0.5) * 0.7 * irr;
        const cut = splitPoly(blk, P, Math.cos(ang), Math.sin(ang));
        if (!cut) { final.push(blk); continue; }
        emitStreet(kinkedStreet(cut[2][0], cut[2][1], irr, rngD), keep);
        stack.push(cut[0], cut[1]);
      }
      // dead-end stubs into some final blocks
      for (const blk of final) {
        if (rngD() > irr * 0.45) continue;
        const e = Math.floor(rngD() * blk.length);
        const A2 = blk[e], B2 = blk[(e + 1) % blk.length];
        const M = [(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2];
        let mx = 0, my = 0;
        for (const [x, y] of blk) { mx += x; my += y; }
        mx /= blk.length; my /= blk.length;
        const nl = Math.hypot(mx - M[0], my - M[1]) || 1;
        const len2 = (0.5 + 0.6 * rngD()) * nl;
        const E = [M[0] + ((mx - M[0]) / nl) * len2, M[1] + ((my - M[1]) / nl) * len2];
        emitStreet(kinkedStreet(M, E, irr * 0.7, rngD), keep);
      }
    }

    /* ================= ARTERIALS ================= */
    const rngA = mulberry32(seed * 7919 + 401);
    const arterialRuns = [];
    const linked = new Set();
    for (let i = 0; i < nD; i++) {
      const near2 = sites.map((s, j) => [Math.hypot(s.x - sites[i].x, s.y - sites[i].y), j])
        .filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]).slice(0, 2);
      for (const [, j] of near2) {
        const key = Math.min(i, j) + ":" + Math.max(i, j);
        if (linked.has(key)) continue;
        linked.add(key);
        const use = rngA() < p.arterials;
        const bow = (rngA() - 0.5) * 24;
        if (!use) continue;
        const A = sites[i], B = sites[j];
        const L = Math.hypot(B.x - A.x, B.y - A.y);
        const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
        const raw = [];
        for (let t = 0; t <= 1.0001; t += 1.2 / L) {
          const px0 = A.x + ux * t * L, py0 = A.y + uy * t * L;
          const d = Math.sin(Math.PI * t) * bow +
            (noise2(px0 * 0.02, py0 * 0.02, seed + 61) - 0.5) * 7 * p.irregular *
            Math.sin(Math.PI * t);
          raw.push([px0 - uy * d, py0 + ux * d]);
        }
        let run = [];
        const flush = () => {
          if (run.length >= 3 && pathLength(run, false) > 4) {
            arterialRuns.push(run);
            push(offsetPath(run, 0.55), false, roadPen);
            push(offsetPath(run, -0.55).reverse(), false, roadPen);
          }
          run = [];
        };
        for (const q of raw) {
          if (inRegion(q) && !waterAt(q, 1.0)) run.push(q); else flush();
        }
        flush();
      }
    }

    /* ================= MOTORWAYS + RAMPS ================= */
    const rngH = mulberry32(seed * 7919 + 307);
    const hwCenters = [];
    const edgePt = (e, t) => e === 0 ? [lox + t * (hix - lox), loy]
      : e === 1 ? [hix, loy + t * (hiy - loy)]
      : e === 2 ? [lox + t * (hix - lox), hiy]
      : [lox, loy + t * (hiy - loy)];
    const cornerRound = (pts, rad) => {
      if (pts.length < 3) return pts;
      const out = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], v = pts[i], b = pts[i + 1];
        const la = Math.hypot(v[0] - a[0], v[1] - a[1]);
        const lb = Math.hypot(b[0] - v[0], b[1] - v[1]);
        const c = Math.min(rad, la * 0.45, lb * 0.45);
        if (c < 1) { out.push(v); continue; }
        const da = [(v[0] - a[0]) / la, (v[1] - a[1]) / la];
        const db = [(b[0] - v[0]) / lb, (b[1] - v[1]) / lb];
        // nearly straight corner: rounding a collinear vertex would place the
        // arc center on the vertex itself and bulge a half-circle — skip it
        if (Math.abs(da[0] * db[1] - da[1] * db[0]) < 0.03 &&
            da[0] * db[0] + da[1] * db[1] > 0) { out.push(v); continue; }
        const p1 = [v[0] - da[0] * c, v[1] - da[1] * c];
        const p2 = [v[0] + db[0] * c, v[1] + db[1] * c];
        const cx0 = v[0] - da[0] * c + db[0] * c, cy0 = v[1] - da[1] * c + db[1] * c;
        const a0 = Math.atan2(p1[1] - cy0, p1[0] - cx0);
        const a1 = Math.atan2(p2[1] - cy0, p2[0] - cx0);
        let dA = a1 - a0;
        while (dA > Math.PI) dA -= 2 * Math.PI;
        while (dA < -Math.PI) dA += 2 * Math.PI;
        const steps = Math.max(4, Math.round(Math.abs(dA) / (Math.PI / 20)));
        for (let k = 0; k <= steps; k++) {
          const ang = a0 + (dA * k) / steps;
          out.push([cx0 + Math.cos(ang) * c, cy0 + Math.sin(ang) * c]);
        }
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    const nHW = Math.max(0, Math.round(p.highways));
    for (let h = 0; h < nHW; h++) {
      const e0 = Math.floor(rngH() * 4);
      const e1 = rngH() < 0.7 ? (e0 + 2) % 4 : (e0 + 1 + Math.floor(rngH() * 2)) % 4;
      const P0 = edgePt(e0, 0.15 + 0.7 * rngH());
      const P1 = edgePt(e1, 0.15 + 0.7 * rngH());
      const wp = [P0];
      const nwp = 1 + Math.floor(rngH() * 2);
      const px = -(P1[1] - P0[1]), py = P1[0] - P0[0];
      const pl = Math.hypot(px, py) || 1;
      for (let k = 0; k < nwp; k++) {
        // waypoints sit on the straight entry-exit line; Motorway bend
        // pushes them sideways -> 0 = dead straight
        const t = (k + 1) / (nwp + 1) + (rngH() - 0.5) * 0.15;
        const off = (rngH() - 0.5) * 2 * p.hwBend * 45;
        // clamp to the region only: the chord between two edge points is
        // always inside (convex box), so hwBend=0 stays perfectly straight
        wp.push([
          Math.min(hix - 2, Math.max(lox + 2, P0[0] + (P1[0] - P0[0]) * t + (px / pl) * off)),
          Math.min(hiy - 2, Math.max(loy + 2, P0[1] + (P1[1] - P0[1]) * t + (py / pl) * off)),
        ]);
      }
      wp.push(P1);
      const center = resample(cornerRound(wp, 12 + rngH() * 10), false, 1.5);
      hwCenters.push(center);
      const w2 = Math.max(0.6, p.hwWidth) / 2;
      for (const off of [-w2, 0, w2])
        push(offsetPath(center, off), false, roadPen);
    }
    // ramps at motorway x arterial crossings
    if (p.ramps > 0.01) {
      const rr = 4.5;
      for (const C of hwCenters) {
        for (const A of arterialRuns) {
          for (let a = 1; a < C.length; a += 1) {
            for (let b = 1; b < A.length; b += 2) {
              const P0 = C[a - 1], P1 = C[a], Q0 = A[b - 1], Q1 = A[b];
              const rx = P1[0] - P0[0], ry = P1[1] - P0[1];
              const sx = Q1[0] - Q0[0], sy = Q1[1] - Q0[1];
              const den = rx * sy - ry * sx;
              if (Math.abs(den) < 1e-9) continue;
              const qx = Q0[0] - P0[0], qy = Q0[1] - P0[1];
              const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
              if (t <= 0 || t >= 1 || u <= 0 || u >= 1) continue;
              const P = [P0[0] + rx * t, P0[1] + ry * t];
              if (hash2(Math.round(P[0]), Math.round(P[1]), seed + 55) > p.ramps) continue;
              const lH = Math.hypot(rx, ry), lR = Math.hypot(sx, sy);
              const dH = [rx / lH, ry / lH], dR = [sx / lR, sy / lR];
              const quads = [[1, 1], [-1, -1], [1, -1], [-1, 1]];
              const nq = 1 + Math.floor(hash2(Math.round(P[1]), Math.round(P[0]), seed + 56) * 2);
              for (let q = 0; q < nq; q++) {
                const [s1, s2] = quads[(q + Math.floor(hash2(a, b, seed + 57) * 4)) % 4];
                const Cc = [P[0] - dH[0] * s1 * rr + dR[0] * s2 * rr,
                            P[1] - dH[1] * s1 * rr + dR[1] * s2 * rr];
                const Aq = [P[0] - dH[0] * s1 * rr, P[1] - dH[1] * s1 * rr];
                const Bq = [P[0] + dR[0] * s2 * rr, P[1] + dR[1] * s2 * rr];
                const a0 = Math.atan2(Aq[1] - Cc[1], Aq[0] - Cc[0]);
                const a1 = Math.atan2(Bq[1] - Cc[1], Bq[0] - Cc[0]);
                let dA = a1 - a0;
                while (dA > Math.PI) dA -= 2 * Math.PI;
                while (dA < -Math.PI) dA += 2 * Math.PI;
                const pts = [];
                for (let k = 0; k <= 10; k++) {
                  const ang = a0 + (dA * k) / 10;
                  pts.push([Cc[0] + Math.cos(ang) * rr, Cc[1] + Math.sin(ang) * rr]);
                }
                if (pts.every((pt) => inRegion(pt))) push(pts, false, roadPen);
              }
            }
          }
        }
      }
    }

    /* ================= FIELDS ================= */
    const rngF = mulberry32(seed * 7919 + 503);
    const ruralIdx = sites.map((s, i) => [s, i])
      .filter(([s]) => s.type === "empty" || s.type === "sparse").map(([, i]) => i);
    const nF = Math.round(p.fields);
    for (let f = 0; f < nF && ruralIdx.length > 0; f++) {
      const i = ruralIdx[Math.floor(rngF() * ruralIdx.length)];
      const s = sites[i];
      const fx = s.x + (rngF() - 0.5) * 36, fy = s.y + (rngF() - 0.5) * 36;
      const fw = 8 + rngF() * 14, fh = 6 + rngF() * 10, fr = rngF() * Math.PI;
      const cu = Math.cos(fr), su = Math.sin(fr);
      const keep = (pt) => inRegion(pt) && nearest(pt) === i && !waterAt(pt, 1.2);
      const loc2w = (lx, ly) => [fx + lx * cu - ly * su, fy + lx * su + ly * cu];
      // outline
      const rect = [loc2w(-fw / 2, -fh / 2), loc2w(fw / 2, -fh / 2),
                    loc2w(fw / 2, fh / 2), loc2w(-fw / 2, fh / 2)];
      const dense = resample([...rect, rect[0]], false, 1.2);
      let run = [];
      const flushO = () => {
        if (run.length >= 2 && pathLength(run, false) > 2) push(run, false, fieldPen);
        run = [];
      };
      for (const q of dense) { if (keep(q)) run.push(q); else flushO(); }
      flushO();
      // hatch
      let flip = false;
      for (let o = -fh / 2 + 1.2; o < fh / 2 - 0.4; o += 1.3) {
        const pts = [];
        for (let t = -fw / 2; t <= fw / 2; t += 1.2) pts.push(loc2w(t, o));
        let r2 = [];
        const flushH = () => {
          if (r2.length >= 2 && pathLength(r2, false) > 1.5)
            push(flip ? r2.reverse() : r2, false, fieldPen);
          r2 = [];
        };
        for (const q of pts) { if (keep(q)) r2.push(q); else flushH(); }
        flushH();
        flip = !flip;
      }
    }

    /* ================= LANDMARKS ================= */
    const rngL = mulberry32(seed * 7919 + 601);
    const nL2 = Math.round(p.landmarks);
    for (let k = 0; k < nL2; k++) {
      const s = sites[Math.floor(rngL() * nD)];
      const x = s.x + (rngL() - 0.5) * 44, y = s.y + (rngL() - 0.5) * 44;
      const sz = 1.2 + rngL() * 2.2;
      if (!inRegion([x - sz, y - sz]) || !inRegion([x + sz, y + sz]) ||
          waterAt([x, y], sz)) continue;
      for (let f = sz; f > 0.3; f -= 0.9)
        push([[x - f, y - f], [x + f, y - f], [x + f, y + f], [x - f, y + f]], true, roadPen);
    }

    return applyStyle({ paths }, ins[0]);
  },
};
