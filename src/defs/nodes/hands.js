import { Pin, mulberry32, noise2, resample, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "hands",
  name: "Hands",
  cat: "gen",
  group: "creatures",
  desc: "Anatomically proportioned arms with hands, each a single closed silhouette built by walking a skeleton contour (real finger ratios, knuckle arc, tapered forearm). Pose presets set spread and curl; Mutation slides from correct anatomy toward classic AI-hand chaos: joints past their limits, scattered knuckles, extra or missing fingers. Detail controls outline point density, so low values give the angular low-poly look independent of Mutation. Layout Rows plants a grid of hands (fingers up, arm down) fitted per cell; Layout Spine grows an arm along each wired path with the hand at its end. Cuff draws an open sleeve-tube mouth at the cut end; Nails adds small closed nail shapes. Chain into Hand Drawn for ink wobble.",
  ins: [Pin("style", "Style"), Pin("paths", "Spine")],
  outs: [Pin("paths")],
  params: [
    { key: "layout", label: "Layout", type: "select", options: ["Rows", "Spine"], def: "Rows" },
    { key: "mount", label: "Spine mount", type: "select", options: ["Along", "Left", "Right", "Both (alternate)", "Both (random)"], def: "Along", showIf: (p) => p.layout === "Spine" },
    { key: "space", label: "Spacing mm", type: "slider", min: 4, max: 120, step: 1, def: 30, showIf: (p) => p.layout === "Spine" && p.mount !== "Along" },
    { key: "count", label: "Hands", type: "slider", min: 1, max: 40, step: 1, def: 5, showIf: (p) => p.layout === "Rows" },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 6, step: 1, def: 1, showIf: (p) => p.layout === "Rows" },
    { key: "size", label: "Hand size mm", type: "slider", min: 10, max: 150, step: 1, def: 42 },
    { key: "which", label: "Left/right", type: "select", options: ["Mix", "Right", "Left"], def: "Mix" },
    { key: "armlen", label: "Arm", type: "select", options: ["Hand only", "Forearm", "Full arm"], def: "Forearm" },
    { key: "armw", label: "Arm width %", type: "slider", min: 40, max: 180, step: 1, def: 100 },
    { key: "cut", label: "Cut end", type: "select", options: ["Cuff", "Flat"], def: "Cuff" },
    { key: "pose", label: "Pose", type: "select", options: ["Relaxed", "Spread", "Point", "Pinch", "Claw", "Wave", "Flip the bird", "Rock horns", "Half heart", "Mix"], def: "Relaxed" },
    { key: "posejit", label: "Pose jitter %", type: "slider", min: 0, max: 100, step: 1, def: 25 },
    { key: "spread", label: "Spread %", type: "slider", min: 0, max: 150, step: 1, def: 100 },
    { key: "wrist", label: "Wrist bend °", type: "slider", min: -45, max: 45, step: 1, def: 0 },
    { key: "elbow", label: "Elbow bend °", type: "slider", min: -70, max: 70, step: 1, def: 18, showIf: (p) => p.armlen === "Full arm" },
    { key: "mut", label: "Mutation %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "detail", label: "Detail %", type: "slider", min: 0, max: 100, step: 1, def: 70 },
    { key: "nails", label: "Nails", type: "check", def: true },
    { key: "jitter", label: "Jitter %", type: "slider", min: 0, max: 100, step: 1, def: 30, showIf: (p) => p.layout === "Rows" || (p.layout === "Spine" && p.mount !== "Along") },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  overlay(p, ctx, ins) {
    const g = [];
    if (!ctx || !Number.isFinite(ctx.W) || !Number.isFinite(ctx.H)) return g;
    const W = ctx.W, H = ctx.H, M = 8;
    if (p && p.layout === "Spine") {
      const src = (ins && ins[1]) || { paths: [] };
      let n = 0;
      for (const q of src.paths || []) {
        if (!q || !q.pts || q.pts.length < 2) continue;
        if (n++ >= 12) break;
        g.push({ kind: "poly", pts: q.pts });
      }
      if (!g.length) g.push({ kind: "rect", x: M, y: M, w: Math.max(1, W - 2 * M), h: Math.max(1, H - 2 * M) });
      return g;
    }
    const count = Math.max(1, Math.min(60, Math.round((p && p.count) || 1)));
    const rows = Math.max(1, Math.min(Math.round((p && p.rows) || 1), count));
    const cols = Math.max(1, Math.ceil(count / rows));
    const cw = Math.max(1, (W - 2 * M) / cols), chh = Math.max(1, (H - 2 * M) / rows);
    for (let i = 0; i < count && g.length < 60; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      g.push({ kind: "rect", x: M + c * cw, y: M + r * chh, w: cw, h: chh });
    }
    return g;
  },

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const mul = (a, k) => [a[0] * k, a[1] * k];
    const vlen = (a) => Math.hypot(a[0], a[1]);
    const norm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l]; };
    const dirA = (deg) => { const a = (deg * Math.PI) / 180; return [Math.sin(a), Math.cos(a)]; };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    const seed = Math.round(p.seed || 0);
    const sizeMm = clamp(p.size || 42, 4, 400);
    const detail01 = clamp((p.detail || 0) / 100, 0, 1);
    const stepMm = 0.7 + (1 - detail01) * 4.3;
    const capK = 2 + Math.round(5 * detail01);
    const mutG = clamp((p.mut || 0) / 100, 0, 1.5);
    const aw = clamp((p.armw || 100) / 100, 0.2, 3);
    const spreadG = clamp((p.spread == null ? 100 : p.spread) / 100, 0, 2.5);
    const jit01 = clamp((p.posejit || 0) / 100, 0, 1.5);
    const layer = clamp(Math.round(p.layer || 0), 0, 11);

    const POSES = {
      Relaxed: { curl: [[10, 14, 9], [8, 12, 8], [10, 14, 9], [12, 16, 10]], spread: 1.0, thumbA: 0, thumbC: [10, 12] },
      Spread: { curl: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], spread: 1.7, thumbA: -16, thumbC: [0, 0] },
      Point: { curl: [[0, 0, 0], [55, 65, 30], [58, 68, 32], [60, 70, 34]], spread: 0.55, thumbA: 24, thumbC: [24, 30] },
      Pinch: { curl: [[22, 30, 18], [32, 38, 22], [34, 40, 24], [36, 42, 26]], spread: 0.8, thumbA: 30, thumbC: [18, 24] },
      Claw: { curl: [[26, 46, 36], [26, 46, 36], [26, 46, 36], [26, 46, 36]], spread: 1.35, thumbA: 6, thumbC: [22, 32] },
      Wave: { curl: [[4, 6, 4], [8, 10, 6], [12, 14, 8], [16, 18, 10]], spread: 1.15, thumbA: -8, thumbC: [6, 8] },
      "Flip the bird": { curl: [[60, 70, 35], [0, 0, 0], [60, 70, 35], [62, 72, 36]], spread: 0.5, thumbA: 26, thumbC: [26, 32] },
      "Rock horns": { curl: [[0, 0, 0], [58, 68, 34], [58, 68, 34], [0, 0, 0]], spread: 1.25, thumbA: 12, thumbC: [22, 30] },
      "Half heart": { curl: [[-16, -24, -18], [-13, -20, -15], [-11, -17, -13], [-10, -15, -11]], spread: 0.2, thumbA: -98, thumbC: [-10, -16] },
    };
    const POSE_KEYS = Object.keys(POSES);

    const FING = [
      { x: -0.2, y: 0.535, len: 0.414, ang: -7, r: 0.042 },
      { x: -0.068, y: 0.565, len: 0.445, ang: -1, r: 0.044 },
      { x: 0.068, y: 0.548, len: 0.432, ang: 4, r: 0.042 },
      { x: 0.198, y: 0.49, len: 0.343, ang: 14, r: 0.033 },
    ];
    const PHX = [0.505, 0.293, 0.202];

    // variable-radius side curves along a skeleton chain (local units)
    const sideCurves = (chain, stepL, rFn) => {
      let sm = resample(chain, false, Math.max(stepL, 1e-4));
      if (!sm || sm.length < 2) sm = [chain[0], chain[chain.length - 1]];
      const L = pathLength(sm, false) || 1;
      const left = [], right = []; let acc = 0;
      for (let i = 0; i < sm.length; i++) {
        if (i > 0) acc += vlen(sub(sm[i], sm[i - 1]));
        const t = acc / L;
        const tan = norm(sub(sm[Math.min(i + 1, sm.length - 1)], sm[Math.max(i - 1, 0)]));
        const n = [-tan[1], tan[0]];
        const r = Math.max(1e-4, rFn(t));
        left.push(add(sm[i], mul(n, r)));
        right.push(sub(sm[i], mul(n, r)));
      }
      const eTan = norm(sub(sm[sm.length - 1], sm[Math.max(0, sm.length - 2)]));
      return { left, right, tip: sm[sm.length - 1], eTan, rTip: Math.max(1e-4, rFn(1)) };
    };

    // elliptical cap from +normal side to -normal side, bulging along +tan
    const capPts = (T, tan, rAcross, rAlong, k) => {
      const n = [-tan[1], tan[0]]; const out = [];
      for (let j = 1; j < Math.max(2, k); j++) {
        const ph = (Math.PI * j) / Math.max(2, k);
        out.push(add(T, add(mul(n, rAcross * Math.cos(ph)), mul(tan, rAlong * Math.sin(ph)))));
      }
      return out;
    };

    // ---- build one hand+arm silhouette in local y-up frame (units: hand lengths) ----
    const buildHand = (rng, stepL) => {
      const jn = () => (rng() - 0.5) * 2;
      const pose = p.pose === "Mix"
        ? POSES[POSE_KEYS[Math.floor(rng() * POSE_KEYS.length)]]
        : POSES[p.pose] || POSES.Relaxed;
      const wristHalf = 0.175 * clamp(1 + mutG * jn() * 0.4, 0.4, 2);
      const spreadMul = pose.spread * spreadG * (1 + jn() * 0.5 * jit01);

      const fingers = [];
      for (let i = 0; i < 4; i++) {
        const f = FING[i];
        fingers.push({
          bx: f.x + mutG * jn() * 0.14,
          by: f.y + mutG * jn() * 0.1,
          len: f.len * clamp(1 + mutG * jn() * 1.4, 0.15, 3),
          ang: f.ang * spreadMul + jn() * 10 * jit01,
          r: f.r * clamp(1 + mutG * jn() * 1.1, 0.3, 3),
          curl: pose.curl[i].map((c) => c + jn() * 40 * jit01 + mutG * jn() * 150),
        });
      }
      if (mutG > 0.5) {
        const q = (mutG - 0.5) * 2;
        if (rng() < q * 0.5 && fingers.length > 2) fingers.splice(1 + Math.floor(rng() * (fingers.length - 1)), 1);
        if (rng() < q * 0.5 && fingers.length < 6) {
          const s0 = fingers[Math.floor(rng() * fingers.length)];
          fingers.push({ ...s0, bx: s0.bx + 0.06 + rng() * 0.06, ang: s0.ang + jn() * 30, curl: s0.curl.slice() });
        }
      }
      fingers.sort((a, b) => a.bx - b.bx);

      const chainOf = (bx, by, baseAng, segs, curls) => {
        const pts = [[bx, by]]; let ang = baseAng;
        for (let k = 0; k < segs.length; k++) {
          ang += curls[k] || 0;
          pts.push(add(pts[pts.length - 1], mul(dirA(ang), segs[k])));
        }
        return pts;
      };
      for (const f of fingers) {
        f.chain = chainOf(f.bx, f.by, f.ang, PHX.map((q) => q * f.len), f.curl);
        f.rTip = f.r * 0.76;
      }
      const thumb = {
        r: 0.052 * clamp(1 + mutG * jn() * 0.9, 0.35, 3), rTipMul: 0.72,
        chain: chainOf(-0.15 + mutG * jn() * 0.08, 0.135 + mutG * jn() * 0.06,
          -62 + pose.thumbA + jn() * 14 * jit01 + mutG * jn() * 60,
          [0.19, 0.135, 0.105].map((L) => L * clamp(1 + mutG * jn() * 1.0, 0.2, 3)),
          [0, pose.thumbC[0] + jn() * 20 * jit01 + mutG * jn() * 90, pose.thumbC[1] + jn() * 20 * jit01 + mutG * jn() * 90]),
      };
      thumb.rTip = thumb.r * thumb.rTipMul;

      const out = [];
      out.push([-wristHalf, 0]);
      out.push([-wristHalf - 0.014, 0.06]);
      const th = sideCurves(thumb.chain, stepL, (t) => lerp(thumb.r, thumb.rTip, t));
      out.push(...th.left);
      out.push(...capPts(th.tip, th.eTan, th.rTip, th.rTip, capK));
      out.push(...th.right.slice().reverse());
      const vTI = add(mul(add(thumb.chain[1], [fingers[0].bx, fingers[0].by]), 0.5), [0.01, -0.03]);
      out.push(vTI);
      const nailShapes = [];
      const nail = (chain, rTip) => {
        const tip = chain[chain.length - 1];
        const dl = Math.max(1e-4, vlen(sub(tip, chain[chain.length - 2])));
        const d = norm(sub(tip, chain[chain.length - 2]));
        const c = sub(tip, mul(d, dl * 0.42));
        const n = [-d[1], d[0]]; const a = dl * 0.3, b = rTip * 0.72;
        const e = [];
        for (let j = 0; j < 10; j++) {
          const ph = (Math.PI * 2 * j) / 10;
          e.push(add(c, add(mul(d, a * Math.cos(ph)), mul(n, b * Math.sin(ph)))));
        }
        nailShapes.push(e);
      };
      if (p.nails) nail(thumb.chain, thumb.rTip);
      const webFrac = 0.17;
      for (let i = 0; i < fingers.length; i++) {
        const f = fingers[i];
        const s = sideCurves(f.chain, stepL, (t) => lerp(f.r, f.rTip, t));
        const wi = Math.max(1, Math.min(s.left.length - 2, Math.round(webFrac * s.left.length)));
        const L = i > 0 ? s.left.slice(wi) : s.left;
        const R = i < fingers.length - 1 ? s.right.slice(wi) : s.right;
        out.push(...L);
        out.push(...capPts(s.tip, s.eTan, s.rTip, s.rTip * 1.12, capK));
        out.push(...R.slice().reverse());
        if (p.nails) nail(f.chain, f.rTip);
        const nx = fingers[i + 1];
        if (nx) {
          const m = mul(add([f.bx, f.by], [nx.bx, nx.by]), 0.5);
          const d = norm(add(dirA(f.ang), dirA(nx.ang)));
          out.push(add(m, mul(d, webFrac * 0.5 * (f.len + nx.len) * 0.505 - 0.015)));
        }
      }
      out.push([0.215 + mutG * jn() * 0.05, 0.3 + mutG * jn() * 0.04]);
      out.push([wristHalf, 0]);
      return { out, nailShapes, wristHalf };
    };

    // ---- arm radius profile (u: 0 = wrist, 1 = cut end), local hand-length units ----
    const armProfile = (mode) => {
      const stops = mode === "Full arm"
        ? [[0, 0.15], [0.25, 0.185], [0.47, 0.165], [0.78, 0.205], [1, 0.225]]
        : mode === "Forearm"
          ? [[0, 0.15], [0.35, 0.185], [1, 0.165]]
          : [[0, 0.15], [1, 0.155]];
      return (u) => {
        u = clamp(u, 0, 1);
        let r = stops[stops.length - 1][1];
        for (let i = 1; i < stops.length; i++) {
          if (u <= stops[i][0]) {
            const t = (u - stops[i - 1][0]) / Math.max(1e-6, stops[i][0] - stops[i - 1][0]);
            r = lerp(stops[i - 1][1], stops[i][1], t); break;
          }
        }
        const flare = p.cut === "Cuff" && u > 0.88 ? 1 + 0.35 * ((u - 0.88) / 0.12) : 1;
        return r * aw * flare;
      };
    };

    const budget = { n: 0 };
    const paths = [];
    const emit = (pts, closed) => {
      if (!pts || pts.length < 2) return;
      paths.push({ pts, closed, layer });
      budget.n += pts.length;
    };

    // arm sides + cap; spine runs wrist -> cut end (canvas or local coords)
    const armPieces = (spine, stepL, rFn) => {
      const s = sideCurves(spine, stepL, rFn);
      const cap = p.cut === "Flat" ? [] : capPts(s.tip, s.eTan, s.rTip, s.rTip * 0.38, Math.max(4, capK + 2));
      let rim = null;
      if (p.cut === "Cuff") {
        rim = [];
        const n = [-s.eTan[1], s.eTan[0]];
        const kk = Math.max(5, capK + 3);
        for (let j = 0; j <= kk; j++) {
          const ph = (Math.PI * j) / kk;
          rim.push(add(s.tip, add(mul(n, s.rTip * Math.cos(ph)), mul(s.eTan, -s.rTip * 0.3 * Math.sin(ph)))));
        }
      }
      return { s, cap, rim };
    };

    const jitAmt = clamp((p.jitter || 0) / 100, 0, 1.5);

    // local hand+arm silhouette in y-up hand frame; cutEnd = arm end point
    const localSilhouette = (rng, hb, noiseId) => {
      const jn = () => (rng() - 0.5) * 2;
      const stepL = stepMm / sizeMm;
      const armMode = p.armlen === "Full arm" || p.armlen === "Hand only" ? p.armlen : "Forearm";
      const spineL = [[0, 0]];
      const wbend = (p.wrist || 0) + jn() * 8 * jit01;
      if (armMode === "Hand only") {
        spineL.push(add([0, 0], mul(dirA(180 + wbend), 0.1)));
      } else {
        const elbowPt = add([0, 0], mul(dirA(180 + wbend), 1.5));
        spineL.push(elbowPt);
        if (armMode === "Full arm") spineL.push(add(elbowPt, mul(dirA(180 + wbend + (p.elbow || 0)), 1.65)));
      }
      let spineS = resample(spineL, false, Math.max(stepL, 1e-3));
      if (!spineS || spineS.length < 2) spineS = spineL;
      if (mutG > 0) {
        const LT = pathLength(spineS, false) || 1; let acc = 0;
        spineS = spineS.map((pt, k) => {
          if (k > 0) acc += vlen(sub(pt, spineS[k - 1]));
          const w = (noise2(acc * 2.2, noiseId * 3.7, seed) - 0.5) * mutG * 0.55 * Math.min(1, acc / (LT * 0.15));
          return [pt[0] + w, pt[1]];
        });
      }
      const rFn0 = armProfile(armMode);
      const rFn = (u) => (u < 0.1 ? lerp(hb.wristHalf, rFn0(0.1), u / 0.1) : rFn0(u));
      const A = armPieces(spineS, stepL, rFn);
      return {
        sil: hb.out.concat(A.s.left, A.cap, A.s.right.slice().reverse()),
        nails: hb.nailShapes, rim: A.rim, cutEnd: spineS[spineS.length - 1],
      };
    };

    const mode = p.layout === "Spine" ? "Spine" : "Rows";

    if (mode === "Spine") {
      const src = ins[1];
      if (!src || !src.paths || !src.paths.length) return applyStyle({ paths: [] }, ins[0]);
      const mount = p.mount || "Along";
      if (mount !== "Along") {
        let hn = 0;
        for (let pi = 0; pi < src.paths.length; pi++) {
          const q = src.paths[pi];
          if (hn >= 80 || budget.n > 110000) break;
          if (!q || !q.pts || q.pts.length < 2 || pathLength(q.pts, !!q.closed) < 3) continue;
          const spacing = Math.max(4, p.space || 30);
          let anchors = resample(q.pts, !!q.closed, spacing);
          if (!anchors || anchors.length < 1) anchors = [q.pts[0]];
          const rngS = mulberry32(seed * 883 + pi * 127 + 5);
          let alt = false;
          for (let i = 0; i < anchors.length; i++) {
            if (hn >= 80 || budget.n > 110000) break;
            const nI = Math.min(i + 1, anchors.length - 1), pI = Math.max(i - 1, 0);
            const tx = anchors[nI][0] - anchors[pI][0], ty = anchors[nI][1] - anchors[pI][1];
            let sgn;
            if (mount === "Left") sgn = 1;
            else if (mount === "Right") sgn = -1;
            else if (mount === "Both (alternate)") { sgn = alt ? 1 : -1; alt = !alt; }
            else sgn = rngS() > 0.5 ? 1 : -1;
            const rng = mulberry32(seed * 7919 + pi * 613 + i * 131 + 1);
            const jn = () => (rng() - 0.5) * 2;
            const ang = Math.atan2(tx, -ty) + (sgn < 0 ? Math.PI : 0) + jn() * 0.6 * jitAmt;
            const dirC = [Math.cos(ang), Math.sin(ang)];
            const bxC = [dirC[1], -dirC[0]];
            const mir = p.which === "Left" || (p.which === "Mix" && rng() < 0.5);
            const hb = buildHand(rng, stepMm / sizeMm);
            const L = localSilhouette(rng, hb, pi * 53 + i);
            const e = mir ? [-L.cutEnd[0], L.cutEnd[1]] : L.cutEnd;
            const anc = anchors[i];
            const T = (pt0) => {
              const pt = mir ? [-pt0[0], pt0[1]] : pt0;
              const px = (pt[0] - e[0]) * sizeMm, py = (pt[1] - e[1]) * sizeMm;
              return [anc[0] + bxC[0] * px + dirC[0] * py, anc[1] + bxC[1] * px + dirC[1] * py];
            };
            let sil = L.sil.map(T), nails = L.nails.map((ee) => ee.map(T)), rim = L.rim ? L.rim.map(T) : null;
            if (mir) { sil = sil.slice().reverse(); nails = nails.map((ee) => ee.slice().reverse()); }
            emit(sil, true);
            if (rim) emit(rim, false);
            for (const ee of nails) emit(ee, true);
            hn++;
          }
        }
        return applyStyle({ paths }, ins[0]);
      }
      let idx = 0;
      for (const q of src.paths) {
        if (idx >= 40 || budget.n > 110000) break;
        if (!q || !q.pts || q.pts.length < 2 || pathLength(q.pts, false) < 3) continue;
        const rng = mulberry32(seed * 7919 + idx * 131 + 1);
        idx++;
        const s = sizeMm;
        const sp = resample(q.pts.slice().reverse(), false, Math.max(stepMm, 0.3));
        if (!sp || sp.length < 2) continue;
        const wristPt = sp[0];
        let by = norm(sub(sp[0], sp[1]));
        const wb = ((p.wrist || 0) * Math.PI) / 180;
        by = [by[0] * Math.cos(wb) - by[1] * Math.sin(wb), by[0] * Math.sin(wb) + by[1] * Math.cos(wb)];
        const bx = [-by[1], by[0]];
        const T = (pt) => add(wristPt, add(mul(bx, pt[0] * s), mul(by, pt[1] * s)));
        const mir = p.which === "Left" || (p.which === "Mix" && rng() < 0.5);
        const hb = buildHand(rng, stepMm / s);
        let hpts = hb.out.map((pt) => T(mir ? [-pt[0], pt[1]] : pt));
        let nails = hb.nailShapes.map((e) => e.map((pt) => T(mir ? [-pt[0], pt[1]] : pt)));
        if (mir) { hpts = hpts.slice().reverse(); nails = nails.map((e) => e.slice().reverse()); }
        const rFn0 = armProfile("Forearm");
        const rFn = (u) => (u < 0.1 ? lerp(hb.wristHalf, rFn0(0.1), u / 0.1) : rFn0(u));
        const A = armPieces(sp, stepMm, (t) => rFn(t) * s);
        const wl = hpts[0], wr = hpts[hpts.length - 1];
        const dLL = vlen(sub(A.s.left[0], wl)) + vlen(sub(A.s.right[0], wr));
        const dLR = vlen(sub(A.s.left[0], wr)) + vlen(sub(A.s.right[0], wl));
        const first = dLR < dLL ? A.s.left : A.s.right;
        const second = dLR < dLL ? A.s.right : A.s.left;
        const cap = dLR < dLL ? A.cap.slice().reverse() : A.cap;
        const sil = hpts.concat(first, cap, second.slice().reverse());
        emit(sil, true);
        if (A.rim) emit(A.rim, false);
        for (const e of nails) emit(e, true);
      }
      return applyStyle({ paths }, ins[0]);
    }

    // ---- Rows mode ----
    const M = 8;
    const count = Math.max(1, Math.min(60, Math.round(p.count || 1)));
    const rows = Math.max(1, Math.min(Math.round(p.rows || 1), count));
    const cols = Math.max(1, Math.ceil(count / rows));
    const cw = Math.max(2, (W - 2 * M) / cols), chh = Math.max(2, (H - 2 * M) / rows);

    for (let i = 0; i < count; i++) {
      if (budget.n > 110000) break;
      const rng = mulberry32(seed * 7919 + i * 131 + 1);
      const jn = () => (rng() - 0.5) * 2;
      const mir = p.which === "Left" || (p.which === "Mix" && rng() < 0.5);
      const hb = buildHand(rng, stepMm / sizeMm);
      const L = localSilhouette(rng, hb, i);
      let sil = L.sil;
      let nails = L.nails;
      let rim = L.rim;

      const mx = (pt) => (mir ? [-pt[0], pt[1]] : pt);
      const th = jn() * 0.9 * jitAmt;
      const co = Math.cos(th), si = Math.sin(th);
      const place = (pt) => {
        const q = mx(pt);
        const fx = q[0] * sizeMm, fy = -q[1] * sizeMm;
        return [fx * co - fy * si, fx * si + fy * co];
      };
      let sp = sil.map(place), np = nails.map((e) => e.map(place)), rp = rim ? rim.map(place) : null;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const pt of sp) { x0 = Math.min(x0, pt[0]); x1 = Math.max(x1, pt[0]); y0 = Math.min(y0, pt[1]); y1 = Math.max(y1, pt[1]); }
      const k = Math.min(1, (cw * 0.94) / Math.max(1e-6, x1 - x0), (chh * 0.94) / Math.max(1e-6, y1 - y0));
      const c = i % cols, r = Math.floor(i / cols);
      const cx = M + cw * (c + 0.5) + jn() * jitAmt * cw * 0.08;
      const cy = M + chh * (r + 0.5) + jn() * jitAmt * chh * 0.08;
      const bx0 = (x0 + x1) / 2, by0 = (y0 + y1) / 2;
      const fin = (pt) => [cx + (pt[0] - bx0) * k, cy + (pt[1] - by0) * k];
      sp = sp.map(fin); np = np.map((e) => e.map(fin)); rp = rp ? rp.map(fin) : null;
      if (mir) { sp = sp.slice().reverse(); np = np.map((e) => e.slice().reverse()); }
      emit(sp, true);
      if (rp) emit(rp, false);
      for (const e of np) emit(e, true);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
