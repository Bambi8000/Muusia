import { Pin, EMPTY, mulberry32, noise2, signedArea } from "../helpers.js";

export default {
  /* Fray — loose threads fraying off a source line: wavy wandering strands that
     leave the outline, carry hitches (small self-loops) and beads (tiny rings)
     and end in a coil. One continuous stroke per thread, root -> coil.
     Avoid source keeps threads off the interior of closed source shapes.
     Crossings: None -> hitches off, coils become spirals, beads sit beside the
     thread, and every thread steers around / stops at other threads and the
     source (spatial-hash segment test). Roots shared via this._roots. */
  key: "fray",
  name: "Fray",
  cat: "mod",
  group: "deform",
  desc: "Loose threads fraying off the source line, like yarn ends pulled out of an embroidered outline: strands leave the path at Spacing intervals, head Outward (or Left / Right / Both / Alternate for open lines) within Spread of the normal, wave with Wave amp / length, Wander off course and lean toward the Drift angle; lengths scatter by Length variation (most short, a few long) and stop at the Margin when Clip to margin is on. Along the way Hitches tie small self-loops and Beads hang tiny rings; every thread ends in a Coil (loose overlapping loops), a Ring, a Knot (tight tangle), a Mix, or None (frayed tip) at Coil size. Each thread is ONE continuous stroke from root to coil end. Avoid source keeps threads off the interior of closed shapes; Crossings None makes the whole drawing crossing-free — coils turn into inward spirals, hitches vanish, beads move beside the thread, and threads steer around or stop at other threads and the source. Pens: First pen + Pens used picks a seeded colour per thread; Inherit source pens uses the shape's pen instead.",
  ins: [Pin("paths", "Source")],
  outs: [Pin("paths")],
  params: [
    { key: "spacing", label: "Spacing mm", type: "slider", min: 2, max: 40, step: 0.5, def: 8 },
    { key: "spJit", label: "Spacing jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "side", label: "Side", type: "select", options: ["Outward", "Left", "Right", "Both", "Alternate"], def: "Outward" },
    { key: "avoid", label: "Avoid source", type: "check", def: false },
    { key: "spread", label: "Spread °", type: "slider", min: 0, max: 80, step: 1, def: 25 },
    { key: "driftAng", label: "Drift angle °", type: "slider", min: 0, max: 360, step: 1, def: 270 },
    { key: "drift", label: "Drift", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "length", label: "Length mm", type: "slider", min: 10, max: 300, step: 1, def: 80 },
    { key: "lenVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.7 },
    { key: "clip", label: "Clip to margin", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8, showIf: (p) => !!p.clip },
    { key: "waveAmp", label: "Wave amp mm", type: "slider", min: 0, max: 6, step: 0.1, def: 1.2 },
    { key: "waveLen", label: "Wave length mm", type: "slider", min: 3, max: 40, step: 0.5, def: 12 },
    { key: "wander", label: "Wander", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    { key: "hitches", label: "Hitches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3, showIf: (p) => p.crossings !== "None" },
    { key: "beads", label: "Beads", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "end", label: "End", type: "select", options: ["Coil", "Ring", "Knot", "Mix", "None"], def: "Mix" },
    { key: "coilSize", label: "Coil size mm", type: "slider", min: 1, max: 15, step: 0.5, def: 5, showIf: (p) => p.end !== "None" },
    { key: "coilVar", label: "Coil variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5, showIf: (p) => p.end !== "None" },
    { key: "crossings", label: "Crossings", type: "select", options: ["Allowed", "None"], def: "Allowed" },
    { key: "pen0", label: "First pen", type: "pen", def: 0 },
    { key: "pens", label: "Pens used", type: "slider", min: 1, max: 12, step: 1, def: 6, showIf: (p) => !p.inherit },
    { key: "inherit", label: "Inherit source pens", type: "check", def: false },
    { key: "keepSrc", label: "Keep source", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 3 },
  ],

  /* roots: [{x,y,nx,ny,layer,id}] sampled by arc length on every source path */
  _roots(ins, p) {
    const src = (ins && ins[0]) || EMPTY;
    const seed = (Math.round(p.seed) || 1) >>> 0;
    const sp = Math.max(1, p.spacing);
    const jit = Math.max(0, Math.min(1, p.spJit));
    const roots = [];
    const closedRings = [];
    let pi = 0;
    for (const pa of src.paths || []) {
      if (!pa || !pa.pts || pa.pts.length < 2) continue;
      let bad = false;
      for (const q of pa.pts) if (!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) { bad = true; break; }
      if (bad) continue;
      pi++;
      const P = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
      if (pa.closed && pa.pts.length >= 3) closedRings.push(pa.pts);
      /* orientation: signedArea>0 = clockwise on screen (y-down); left-normal of travel then points OUTWARD for ccw... derive explicitly below */
      const cw = pa.closed ? signedArea(pa.pts) > 0 : true;
      const rng = mulberry32(seed * 7 + pi * 1013);
      let total = 0;
      const segL = [];
      for (let i = 0; i + 1 < P.length; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); segL.push(l); total += l; }
      if (total < 1e-6) continue;
      let s = sp * (0.3 + rng() * 0.4);
      let k = 0, acc = 0, ri = 0;
      while (s < total && roots.length < 4000) {
        while (k < segL.length - 1 && acc + segL[k] < s) { acc += segL[k]; k++; }
        const l = segL[k] || 1, t = Math.max(0, Math.min(1, (s - acc) / l));
        const A = P[k], B = P[k + 1];
        const tx = (B[0] - A[0]) / l, ty = (B[1] - A[1]) / l;
        /* left normal of travel (y-down screen): (ty, -tx). For a clockwise ring that is the outside. */
        let nx = ty, ny = -tx;
        if (pa.closed && !cw) { nx = -nx; ny = -ny; }
        const layer = Number.isInteger(pa.layer) ? pa.layer : 0;
        let sideSign = 1;
        if (p.side === "Left") sideSign = 1;
        else if (p.side === "Right") sideSign = -1;
        else if (p.side === "Both") sideSign = rng() < 0.5 ? 1 : -1;
        else if (p.side === "Alternate") sideSign = ri % 2 === 0 ? 1 : -1;
        else if (!pa.closed) sideSign = rng() < 0.5 ? 1 : -1; /* Outward on an open line -> Both */
        if (p.side === "Left" || p.side === "Right" || p.side === "Both" || p.side === "Alternate") { nx = ty; ny = -tx; }
        roots.push({ x: A[0] + (B[0] - A[0]) * t, y: A[1] + (B[1] - A[1]) * t, nx: nx * sideSign, ny: ny * sideSign, layer, id: roots.length, u: rng() });
        ri++;
        s += sp * (1 + (rng() * 2 - 1) * jit * 0.8);
      }
    }
    return { roots, closedRings };
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const g = [];
      if (p.clip) { const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 1)); g.push({ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }); }
      const R = this && this._roots ? this._roots(ins, p) : { roots: [] };
      for (const r of R.roots.slice(0, 300)) g.push({ kind: "point", x: r.x, y: r.y });
      return g;
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const src = (ins && ins[0]) || EMPTY;
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const paths = [];
    if (p.keepSrc) for (const pa of src.paths || []) if (pa && pa.pts) paths.push(pa);
    const R = this && this._roots ? this._roots(ins, p) : { roots: [], closedRings: [] };
    if (!R.roots.length) return { paths };
    const seed = (Math.round(p.seed) || 1) >>> 0;
    const noCross = p.crossings === "None";
    const avoid = !!p.avoid;
    const m = p.clip ? Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 1)) : 0;
    const spread = (Math.max(0, p.spread) * Math.PI) / 180;
    const driftA = (p.driftAng * Math.PI) / 180;
    const drift = Math.max(0, Math.min(1, p.drift));
    const wander = Math.max(0, Math.min(1, p.wander));
    const amp = Math.max(0, p.waveAmp), wl = Math.max(2, p.waveLen);
    const hitchP = noCross ? 0 : Math.max(0, Math.min(1, p.hitches));
    const beadP = Math.max(0, Math.min(1, p.beads));
    const coilR0 = Math.max(0.5, p.coilSize);
    const coilVar = Math.max(0, Math.min(1, p.coilVar));
    const pensN = Math.max(1, Math.min(12, Math.round(p.pens)));
    const pen0 = Math.round(p.pen0);
    const DS = 0.6;
    const BUDGET = 110000;
    let pts = 0;
    const TWO_PI = Math.PI * 2;

    /* --- inside test for Avoid source (even-odd over closed source rings) --- */
    const contains = (ring, x, y) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const insideSrc = (x, y) => { let c = false; for (const r of R.closedRings) if (contains(r, x, y)) c = !c; return c; };

    /* --- spatial hash of segments for Crossings: None --- */
    const CELL = 4;
    const hash = new Map();
    const ckey = (cx, cy) => cx * 100003 + cy;
    const crossv = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const segsCross = (A, B, C, D) => {
      const d1 = crossv(C[0], C[1], D[0], D[1], A[0], A[1]), d2 = crossv(C[0], C[1], D[0], D[1], B[0], B[1]);
      const d3 = crossv(A[0], A[1], B[0], B[1], C[0], C[1]), d4 = crossv(A[0], A[1], B[0], B[1], D[0], D[1]);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    };
    /* does segment A-B cross anything stored, ignoring segments with tag === skipTag and index >= skipFrom (own recent tail)? */
    const hits = (A, B, ownTag, ownFrom) => {
      const x0 = Math.floor(Math.min(A[0], B[0]) / CELL), x1 = Math.floor(Math.max(A[0], B[0]) / CELL);
      const y0 = Math.floor(Math.min(A[1], B[1]) / CELL), y1 = Math.floor(Math.max(A[1], B[1]) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const arr = hash.get(ckey(cx, cy));
        if (!arr) continue;
        for (const s of arr) {
          if (s[2] === ownTag && s[3] >= ownFrom) continue;
          if (segsCross(A, B, s[0], s[1])) return true;
        }
      }
      return false;
    };
    const addPoly = (P, closed, tag) => {
      for (let i = 0; i + 1 < P.length; i++) { const s = [P[i], P[i + 1], tag, i]; addSeg2(s); }
      if (closed && P.length > 2) addSeg2([P[P.length - 1], P[0], tag, P.length - 1]);
    };
    const addSeg2 = (s) => {
      const [A, B] = s;
      const x0 = Math.floor(Math.min(A[0], B[0]) / CELL), x1 = Math.floor(Math.max(A[0], B[0]) / CELL);
      const y0 = Math.floor(Math.min(A[1], B[1]) / CELL), y1 = Math.floor(Math.max(A[1], B[1]) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const k = ckey(cx, cy);
        let arr = hash.get(k);
        if (!arr) { arr = []; hash.set(k, arr); }
        arr.push(s);
      }
    };
    if (noCross) {
      let t = 0;
      for (const pa of src.paths || []) {
        if (!pa || !pa.pts || pa.pts.length < 2) continue;
        let bad = false;
        for (const q of pa.pts) if (!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) { bad = true; break; }
        if (!bad) addPoly(pa.pts, !!pa.closed, "src" + t++);
      }
    }
    const inSheet = (x, y) => !p.clip || (x >= m && x <= W - m && y >= m && y <= H - m);
    const clampSheet = (x, y) => [Math.max(m, Math.min(W - m, x)), Math.max(m, Math.min(H - m, y))];

    /* --- thread plan: lengths first so long threads are emitted first (truncation eats short ones) --- */
    const plan = R.roots.map((r) => {
      const rng = mulberry32(seed * 31 + r.id * 7919 + 11);
      const u = rng();
      const lenVar = Math.max(0, Math.min(1, p.lenVar));
      const f = (1 - lenVar) + lenVar * (0.2 + 1.8 * u * u * u);
      const L = Math.max(4, p.length * f);
      let endKind = p.end;
      if (endKind === "Mix") { const v = rng(); endKind = v < 0.55 ? "Coil" : v < 0.8 ? "Ring" : v < 0.92 ? "Knot" : "None"; }
      const layer = p.inherit ? r.layer : ((pen0 + Math.floor(rng() * pensN)) % 12 + 12) % 12;
      const th0 = Math.atan2(r.ny, r.nx) + (rng() * 2 - 1) * spread;
      const wavePhase = rng() * TWO_PI;
      const coilR = coilR0 * (1 + (rng() * 2 - 1) * coilVar * 0.7);
      return { r, L, endKind, layer, th0, wavePhase, coilR, rngSeed: seed * 31 + r.id * 7919 + 11 };
    });
    plan.sort((a, b) => b.L - a.L || a.r.id - b.r.id);

    const beadsOut = [];
    for (let ti = 0; ti < plan.length && pts < BUDGET - 200; ti++) {
      const T = plan[ti];
      const tag = "t" + ti;
      const rng = mulberry32(T.rngSeed + 977);
      let x = T.r.x, y = T.r.y, th = T.th0;
      const out = [[x, y]];
      let s = 0;
      let nextHitch = 12 + rng() * 25;
      let nextBead = 6 + rng() * 20;
      let alive = true;
      let lastDrawn = [x, y];
      let ownIdx = 0;
      const pushDrawn = (Q) => {
        if (noCross) { addSeg2([lastDrawn, Q, tag, ownIdx]); ownIdx++; }
        out.push(Q); lastDrawn = Q; pts++;
      };
      const tryStep = (thTry) => {
        const nx = x + Math.cos(thTry) * DS, ny = y + Math.sin(thTry) * DS;
        const ns = s + DS;
        const env = 0.55 + 0.45 * noise2(ns * 0.03, T.r.id * 0.37, seed + 5);
        const w = amp * env * Math.sin((TWO_PI * ns) / wl + T.wavePhase);
        const Q = [nx + Math.cos(thTry + Math.PI / 2) * w, ny + Math.sin(thTry + Math.PI / 2) * w];
        if (!inSheet(Q[0], Q[1])) return null;
        if (avoid && ns > 1.5 && insideSrc(Q[0], Q[1])) return null;
        if (noCross && hits(lastDrawn, Q, tag, ownIdx - 1)) return null;
        return { nx, ny, Q };
      };
      while (alive && s < T.L && pts < BUDGET - 200) {
        /* heading update: wander noise + drift toward Drift angle */
        const dth = wander * 0.045 * noise2(s * 0.03, T.r.id * 1.7, seed + 9);
        let dd = driftA - th;
        while (dd > Math.PI) dd -= TWO_PI;
        while (dd < -Math.PI) dd += TWO_PI;
        th += dth + dd * drift * 0.04;
        let st = tryStep(th);
        if (!st) {
          const opts = [0.6, -0.6, 1.2, -1.2];
          for (const o of opts) { st = tryStep(th + o); if (st) { th += o; break; } }
        }
        if (!st) { alive = false; break; }
        x = st.nx; y = st.ny; s += DS;
        pushDrawn(st.Q);
        /* hitch: a small self-crossing loop drawn in the local frame (prolate cycloid) */
        if (hitchP > 0 && s > nextHitch) {
          nextHitch = s + 15 + rng() * 40;
          if (rng() < hitchP) {
            const rr = 0.8 + rng() * 0.9, kk = 1.9, sgn = rng() < 0.5 ? 1 : -1;
            const tx = Math.cos(th), ty = Math.sin(th), nnx = -ty, nny = tx;
            const base = out[out.length - 1];
            const N = 18;
            for (let i = 1; i <= N; i++) {
              const ph = (i / N) * TWO_PI;
              const lx = rr * (ph - kk * Math.sin(ph)), ly = sgn * rr * kk * (1 - Math.cos(ph));
              const Q = [base[0] + tx * lx + nnx * ly, base[1] + ty * lx + nny * ly];
              if (!inSheet(Q[0], Q[1]) || (avoid && insideSrc(Q[0], Q[1]))) break;
              pushDrawn(Q);
            }
            const adv = rr * TWO_PI;
            x += Math.cos(th) * adv; y += Math.sin(th) * adv; s += adv;
          }
        }
        /* bead: tiny ring on (or beside) the thread */
        if (beadP > 0 && s > nextBead) {
          nextBead = s + 10 + rng() * 30;
          if (rng() < beadP) {
            const br = 0.6 + rng() * 0.9;
            const c = out[out.length - 1];
            let bx = c[0], by = c[1];
            if (noCross) { const side = rng() < 0.5 ? 1 : -1; bx += Math.cos(th + Math.PI / 2) * side * (br + 0.5); by += Math.sin(th + Math.PI / 2) * side * (br + 0.5); }
            const N = 16, ring = [];
            for (let i = 0; i < N; i++) { const a = (i / N) * TWO_PI; ring.push([bx + Math.cos(a) * br, by + Math.sin(a) * br]); }
            let okB = ring.every((Q) => inSheet(Q[0], Q[1]) && !(avoid && insideSrc(Q[0], Q[1])));
            if (okB && noCross) { for (let i = 0; i < N && okB; i++) if (hits(ring[i], ring[(i + 1) % N], "bead", 0)) okB = false; }
            if (okB) { beadsOut.push({ pts: ring, closed: true, layer: T.layer }); pts += N; if (noCross) addPoly(ring, true, "b" + ti); }
          }
        }
      }
      /* end piece */
      if (out.length >= 2 && T.endKind !== "None") {
        const kind = T.endKind;
        let Rr = T.coilR * (kind === "Coil" ? 1 : kind === "Ring" ? 0.45 : 0.35);
        const turns = kind === "Coil" ? 3 + Math.floor(rng() * 5) : kind === "Ring" ? (noCross ? 1.2 : 1.6) : 4 + Math.floor(rng() * 3);
        const dir = rng() < 0.5 ? 1 : -1;
        const lastP = out[out.length - 1];
        const buildCoil = (Rc) => {
          const cxc = lastP[0] + Math.cos(th) * Rc, cyc = lastP[1] + Math.sin(th) * Rc;
          const a0 = Math.atan2(lastP[1] - cyc, lastP[0] - cxc);
          const N = Math.max(12, Math.round(turns * 34));
          const arr = [];
          let jx = 0, jy = 0;
          for (let i = 1; i <= N; i++) {
            const f = i / N, a = a0 + dir * f * turns * TWO_PI;
            let rad;
            if (noCross) rad = Rc * (1 - 0.85 * f);
            else if (kind === "Knot") rad = Rc * (0.45 + 0.55 * noise2(f * 9, T.r.id, seed + 21));
            else rad = Rc * (0.5 + 0.6 * noise2(f * 5, T.r.id * 0.7, seed + 31));
            if (!noCross && kind === "Coil") { jx = 0.45 * Rc * noise2(f * 4, T.r.id + 50, seed + 41); jy = 0.45 * Rc * noise2(f * 4 + 7, T.r.id + 50, seed + 43); }
            arr.push([cxc + jx + Math.cos(a) * rad, cyc + jy + Math.sin(a) * rad]);
          }
          return arr;
        };
        let coil = null;
        for (let attempt = 0; attempt < 3 && !coil; attempt++) {
          const cand = buildCoil(Rr);
          let okC = cand.every((Q) => inSheet(Q[0], Q[1]) && !(avoid && insideSrc(Q[0], Q[1])));
          if (okC && noCross) {
            let prev = lastP;
            for (let i = 0; i < cand.length && okC; i++) { if (hits(prev, cand[i], tag, ownIdx - 1)) okC = false; prev = cand[i]; }
          }
          if (okC) coil = cand; else Rr *= 0.55;
        }
        if (coil) for (const Q of coil) pushDrawn(Q);
      }
      if (out.length >= 2) {
        paths.push({ pts: out, closed: false, layer: T.layer });
      }
    }
    for (const b of beadsOut) paths.push(b);
    return { paths };
  },
};
