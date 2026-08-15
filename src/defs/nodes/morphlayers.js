import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  /* Morph Layers — in-between generator for layered plexi/glass pieces.
   *
   * Wire the FIRST and LAST compositions in; the node builds the missing
   * layers between them by shape interpolation. Output modes:
   *   - Sheets: frame-domain like the Sheets node — layer i appears on
   *     frame i, so with ANIMATE Frames = Layers every frame is one plexi
   *     sheet; Stack View auto-detects the node and takes its sheet count
   *     from the Layers param. Paths keep their source pens.
   *   - Pens:   every layer at once, layer i drawn with pen
   *     (First pen + i) mod 12 — pen separations of the morph on one sheet.
   *
   * Match modes (how paths correspond):
   *   - Split & merge (default): built for CUT/FRAGMENTED geometry. The
   *     side with more paths is the fragment side; fragments assign to
   *     their nearest target, and each target's perimeter is partitioned
   *     into consecutive arcs proportional to the fragments' lengths,
   *     ordered by where each fragment sits along the target — so many
   *     glitch fragments morph smoothly INTO the outline of one shape
   *     (and back out), keeping the cut structure. Targets left without
   *     fragments fall back to birth/death.
   *   - Nearest: per-path pairing by nearest centroid; unpaired paths are
   *     born from / die into their own centroid. Right for scenes of
   *     separate blobs.
   *   - By order: index pairing with modulo cycling — every extra path
   *     morphs to a shared target. Cheap chaos.
   *
   * Mechanics: every pair is resampled to a common point count by arc
   * length (local resampleN — the resample helper takes a step in mm, not
   * a count); closed 1:1 pairs align by rotating the start index and
   * reversing direction to the least total squared distance (kills lerp
   * twist); open pairs align by direction only. Points lerp with
   * t = layer/(Layers-1), optionally smoothstep-eased. Deterministic, no
   * seed. A pair is closed only when both sources are closed.
   */
  key: "morphlayers",
  name: "Morph Layers", cat: "duo",
  ins: [Pin("paths", "first"), Pin("paths", "last")],
  outs: [Pin("paths")],
  params: [
    { key: "layers", label: "Layers", type: "slider", min: 2, max: 12, step: 1, def: 4 },
    { key: "match", label: "Match", type: "select", options: ["Split & merge", "Nearest", "By order"], def: "Split & merge" },
    { key: "output", label: "Output", type: "select", options: ["Sheets", "Pens"], def: "Sheets" },
    { key: "pen", label: "First pen (Pens mode)", type: "slider", min: 0, max: 11, step: 1, def: 0 },
    { key: "samples", label: "Samples", type: "slider", min: 16, max: 512, step: 16, def: 128 },
    { key: "ease", label: "Ease", type: "select", options: ["Linear", "Smooth"], def: "Linear" },
  ],
  compute(ins, p, ctx) {
    const A = ins[0], B = ins[1];
    if (!A || !A.paths || !A.paths.length || !B || !B.paths || !B.paths.length) return EMPTY;

    const nL = Math.max(2, Math.min(12, Math.round(p.layers) || 4));
    const S = Math.max(16, Math.min(512, Math.round(p.samples) || 128));

    /* --- uniform arc-length resampling to EXACTLY n points --- */
    const resampleN = (pts, closed, n) => {
      const src = closed ? [...pts, pts[0]] : pts;
      const cum = [0];
      for (let i = 1; i < src.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
      }
      const L = cum[cum.length - 1];
      if (L <= 0) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]]);
      const out = [];
      let seg = 1;
      for (let k = 0; k < n; k++) {
        const s = closed ? (k / n) * L : (k / (n - 1)) * L;
        while (seg < cum.length - 1 && cum[seg] < s) seg++;
        const s0 = cum[seg - 1], s1 = cum[seg];
        const u = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
        out.push([
          src[seg - 1][0] + (src[seg][0] - src[seg - 1][0]) * u,
          src[seg - 1][1] + (src[seg][1] - src[seg - 1][1]) * u,
        ]);
      }
      return out;
    };

    const centroid = (pts) => {
      let x = 0, y = 0;
      for (const q of pts) { x += q[0]; y += q[1]; }
      return [x / pts.length, y / pts.length];
    };
    const arcLen = (pts, closed) => {
      let L = 0;
      for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
      return L;
    };
    const sumSq = (a, b, off) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) {
        const q = b[(i + off) % b.length];
        s += (a[i][0] - q[0]) * (a[i][0] - q[0]) + (a[i][1] - q[1]) * (a[i][1] - q[1]);
      }
      return s;
    };
    /* direction only (open pairs / fragments vs arcs) */
    const alignDir = (ref, cand) => {
      const rev = [...cand].reverse();
      return sumSq(ref, cand, 0) <= sumSq(ref, rev, 0) ? cand : rev;
    };
    /* rotation + direction (closed 1:1 pairs) */
    const alignClosed = (ref, cand) => {
      let best = cand, bs = Infinity;
      for (const c of [cand, [...cand].reverse()]) {
        for (let off = 0; off < c.length; off++) {
          const s = sumSq(ref, c, off);
          if (s < bs) { bs = s; best = c.slice(off).concat(c.slice(0, off)); }
        }
      }
      return best;
    };

    const prep = (ps) => ps.paths
      .filter((q) => q.pts && q.pts.length >= 2)
      .map((q) => {
        const closed = !!q.closed;
        const r = resampleN(q.pts, closed, S);
        return { r, closed, layer: ((q.layer ?? 0) % 12 + 12) % 12, c: centroid(r), len: arcLen(q.pts, closed) };
      });
    const pa = prep(A), pb = prep(B);
    if (!pa.length || !pb.length) return EMPTY;

    /* pairs: { a: pts, b: pts, closed, layer } — b is pre-aligned to a,
       so layerAt is a pure uniform lerp for every mode */
    const pairs = [];
    const pushPair = (aP, bP, closed, layer) => pairs.push({ a: aP, b: bP, closed, layer });
    const dieInto = (e) => pushPair(e.r, e.r.map(() => e.c), e.closed, e.layer);
    const bornFrom = (e) => pushPair(e.r.map(() => e.c), e.r, e.closed, e.layer);
    const pairFull = (a, b) => {
      const closed = a.closed && b.closed;
      const bAl = closed ? alignClosed(a.r, b.r) : alignDir(a.r, b.r);
      pushPair(a.r, bAl, closed, a.layer);
    };

    /* nearest-centroid greedy assignment: list -> targets, A order kept */
    const assignNearest = (list, targets, unique) => {
      const used = new Set();
      return list.map((e) => {
        let best = -1, bd = Infinity;
        for (let j = 0; j < targets.length; j++) {
          if (unique && used.has(j)) continue;
          const d = (e.c[0] - targets[j].c[0]) ** 2 + (e.c[1] - targets[j].c[1]) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
        if (best >= 0 && unique) used.add(best);
        return best;
      });
    };

    const mode = p.match || "Split & merge";

    if (mode === "By order") {
      const n = Math.max(pa.length, pb.length);
      for (let i = 0; i < n; i++) pairFull(pa[i % pa.length], pb[i % pb.length]);

    } else if (mode === "Nearest" || pa.length === pb.length) {
      /* Nearest — and Split & merge degenerates to it on equal counts */
      const asg = assignNearest(pa, pb, true);
      const usedB = new Set(asg.filter((j) => j >= 0));
      pa.forEach((a, i) => (asg[i] >= 0 ? pairFull(a, pb[asg[i]]) : dieInto(a)));
      pb.forEach((b, j) => { if (!usedB.has(j)) bornFrom(b); });

    } else {
      /* Split & merge with unequal counts: fragments vs targets */
      const aIsFrag = pa.length > pb.length;
      const frags = aIsFrag ? pa : pb;
      const targets = aIsFrag ? pb : pa;
      const asg = assignNearest(frags, targets, false);
      const perTarget = targets.map(() => []);
      frags.forEach((f, i) => { if (asg[i] >= 0) perTarget[asg[i]].push(f); });

      targets.forEach((t, j) => {
        const group = perTarget[j];
        if (!group.length) { (aIsFrag ? bornFrom : dieInto)(t); return; }
        if (group.length === 1 && group[0].closed && t.closed) {
          /* single closed fragment on a closed target: a normal pair */
          const f = group[0];
          aIsFrag ? pairFull(f, t) : pairFull(t, f);
          return;
        }
        /* target polyline with cumulative arc positions (its own closure) */
        const R = t.closed ? [...t.r, t.r[0]] : t.r;
        const cum = [0];
        for (let i = 1; i < R.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]));
        }
        const L = cum[cum.length - 1] || 1;
        const posAt = (s) => {
          let ss = t.closed ? ((s % L) + L) % L : Math.min(L, Math.max(0, s));
          let seg = 1;
          while (seg < cum.length - 1 && cum[seg] < ss) seg++;
          const s0 = cum[seg - 1], s1 = cum[seg];
          const u = s1 > s0 ? (ss - s0) / (s1 - s0) : 0;
          return [
            R[seg - 1][0] + (R[seg][0] - R[seg - 1][0]) * u,
            R[seg - 1][1] + (R[seg][1] - R[seg - 1][1]) * u,
          ];
        };
        /* order fragments by where they sit along the target */
        const sOf = (f) => {
          let bi = 0, bd = Infinity;
          for (let i = 0; i < t.r.length; i++) {
            const d = (f.c[0] - t.r[i][0]) ** 2 + (f.c[1] - t.r[i][1]) ** 2;
            if (d < bd) { bd = d; bi = i; }
          }
          return (bi / t.r.length) * L;
        };
        const ordered = group.map((f) => ({ f, s: sOf(f) })).sort((x, y) => x.s - y.s);
        const totalLen = ordered.reduce((s, o) => s + Math.max(o.f.len, 0.001), 0);
        /* consecutive arcs proportional to fragment lengths, anchored at
           the first fragment's position (open targets start at 0) */
        let cursor = t.closed ? ordered[0].s : 0;
        for (const o of ordered) {
          const portion = (Math.max(o.f.len, 0.001) / totalLen) * L;
          const arc = [];
          for (let k = 0; k < S; k++) arc.push(posAt(cursor + (k / (S - 1)) * portion));
          cursor += portion;
          const fAl = alignDir(arc, o.f.r);
          /* the fragment stays a fragment: open strokes at both ends */
          aIsFrag ? pushPair(fAl, arc, false, o.f.layer)
                  : pushPair(arc, fAl, false, o.f.layer);
        }
      });
    }

    /* --- one morph layer at parameter t: pure lerp over aligned pairs --- */
    const layerAt = (t) => {
      const paths = [];
      for (const pr of pairs) {
        const pts = pr.a.map((q, i) => [
          q[0] + (pr.b[i][0] - q[0]) * t,
          q[1] + (pr.b[i][1] - q[1]) * t,
        ]);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
        if (Math.hypot(x1 - x0, y1 - y0) > 0.05) paths.push({ pts, closed: pr.closed, layer: pr.layer });
      }
      return paths;
    };

    const ease = (t) => (p.ease === "Smooth" ? t * t * (3 - 2 * t) : t);
    const tOf = (i) => ease(i / (nL - 1));

    if (p.output === "Pens") {
      const paths = [];
      for (let i = 0; i < nL; i++) {
        const pen = ((Math.round(p.pen) || 0) + i) % 12;
        for (const q of layerAt(tOf(i))) paths.push({ ...q, layer: pen });
      }
      return { paths };
    }

    /* Sheets: frame-domain — this frame's layer only, source pens kept */
    let idx = (ctx && ctx.frameIdx) || 0;
    idx = Math.min(nL - 1, Math.max(0, idx));
    return { paths: layerAt(tOf(idx)) };
  },
};
