import { Pin } from "../helpers.js";

export default {
  /* Frame Split — chops ONE drawing into animation frames: a single paths
   * input fans out to N outputs (frame 1..N) ready to wire straight into
   * Frame Grid's input pins.
   *
   * Split by:
   *   - "Ink length": the drawing's total drawn length divides into N spans
   *     and paths are CUT mid-stroke at the exact arc position (a z
   *     component interpolates through the cut). This is the progressive-
   *     reveal split — the flipbook shows the plotter drawing the piece.
   *   - "Path count": whole paths in draw order, chunked into N groups —
   *     no cutting, geometry passes through as copies.
   *
   * Frames are:
   *   - "Build-up" (default): frame i contains everything from the start up
   *     to boundary i; the last frame is the complete drawing.
   *   - "Windows": frame i contains only its own span.
   *
   * Ease reshapes the boundary spacing (Linear / Ease in-out / in / out) so
   * the reveal can accelerate or settle; Direction "Reverse" splits from
   * the end — a Build-up in Reverse is the drawing un-drawing itself.
   *
   * A closed path stays closed only once it is entirely inside a frame;
   * a partial cut of it emits as an open run along its perimeter. Pen
   * layers pass through. Pure and deterministic — nothing to seed.
   */

  key: "frame_split",
  name: "Frame Split",
  cat: "duo",
  desc: "Chops one drawing into animation frames: N outputs that wire straight into Frame Grid. Split by exact ink length (paths cut mid-stroke, z interpolated) or by whole paths in draw order; frames build up cumulatively or hold disjoint windows; easing curves the boundary spacing and Reverse un-draws.",

  ins: [Pin("paths")],
  outs: (node) => {
    const n = Math.max(2, Math.min(16, Math.round((node && node.params && node.params.count) || 6)));
    return Array.from({ length: n }, (_, i) => Pin("paths", "frame " + (i + 1)));
  },

  params: [
    { key: "count", label: "Frames", type: "slider", min: 2, max: 16, step: 1, def: 6 },
    { key: "by", label: "Split by", type: "select", options: ["Ink length", "Path count"], def: "Ink length" },
    { key: "mode", label: "Frames are", type: "select", options: ["Build-up", "Windows"], def: "Build-up" },
    { key: "ease", label: "Ease", type: "select", options: ["Linear", "Ease in-out", "Ease in", "Ease out"], def: "Linear" },
    { key: "dir", label: "Direction", type: "select", options: ["Forward", "Reverse"], def: "Forward" },
  ],

  compute(ins, p, ctx, node) {
    const n = Math.max(2, Math.min(16, Math.round(Number(p.count) || 6)));
    const src = ins[0];
    if (!src || !src.paths || !src.paths.length) {
      return Array.from({ length: n }, () => ({ paths: [] }));
    }

    /* working copy in split order: Reverse walks the drawing from its end,
       so both the path list and every polyline flip */
    let works = src.paths.map((pa) => ({
      pts: pa.pts.map((pt) => pt.slice()),
      closed: !!pa.closed,
      layer: pa.layer,
    }));
    if (p.dir === "Reverse") {
      works = works.slice().reverse();
      for (const w of works) w.pts = w.pts.slice().reverse();
    }

    const EASE = {
      "Ease in-out": (u) => 0.5 - 0.5 * Math.cos(u * Math.PI),
      "Ease in": (u) => u * u,
      "Ease out": (u) => 1 - (1 - u) * (1 - u),
    };
    const ez = EASE[p.ease] || ((u) => u);
    /* boundary k sits at eased fraction of the whole; b[0]=0, b[n]=1 exactly */
    const bounds = Array.from({ length: n + 1 }, (_, k) =>
      k === 0 ? 0 : k === n ? 1 : ez(k / n));

    const outs = [];

    if (p.by === "Path count") {
      const P = works.length;
      const idx = bounds.map((u) => Math.max(0, Math.min(P, Math.round(u * P))));
      for (let k = 1; k <= n; k++) {
        const a = p.mode === "Windows" ? idx[k - 1] : 0;
        const b = idx[k];
        outs.push({ paths: works.slice(a, b).map((w) => ({
          pts: w.pts.map((pt) => pt.slice()), closed: w.closed, layer: w.layer })) });
      }
      return outs;
    }

    /* --- ink length: effective polyline of a closed path includes the
       closing segment; cuts interpolate every point component --- */
    const polys = works.map((w) => {
      const eff = w.closed && w.pts.length > 1 ? w.pts.concat([w.pts[0]]) : w.pts;
      const cum = [0];
      for (let i = 1; i < eff.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(eff[i][0] - eff[i - 1][0], eff[i][1] - eff[i - 1][1]));
      }
      return { w, eff, cum, L: cum[cum.length - 1] };
    });
    const totalL = polys.reduce((a, q) => a + q.L, 0);
    if (!(totalL > 1e-9)) {
      /* nothing measurable to split: everything lands in frame 1 / every build-up frame */
      return Array.from({ length: n }, (_, k) => (p.mode === "Windows" && k > 0
        ? { paths: [] }
        : { paths: works.map((w) => ({ pts: w.pts.map((pt) => pt.slice()), closed: w.closed, layer: w.layer })) }));
    }

    const lerpPt = (a, b, t) => {
      const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (a.length > 2 || b.length > 2) {
        const az = a.length > 2 ? a[2] : 0, bz = b.length > 2 ? b[2] : 0;
        q.push(az + (bz - az) * t);
      }
      return q;
    };
    /* sub-polyline of one poly between local distances a..b */
    const cutPoly = (q, a, b) => {
      const { eff, cum } = q;
      const pts = [];
      for (let i = 0; i < eff.length - 1; i++) {
        const s0 = cum[i], s1 = cum[i + 1];
        if (s1 <= a + 1e-9 || s0 >= b - 1e-9) continue;
        const seg = s1 - s0 || 1;
        const t0 = Math.max(0, (a - s0) / seg), t1 = Math.min(1, (b - s0) / seg);
        const p0 = lerpPt(eff[i], eff[i + 1], t0);
        if (!pts.length) pts.push(p0);
        pts.push(lerpPt(eff[i], eff[i + 1], t1));
      }
      return pts;
    };
    const extract = (d0, d1) => {
      const paths = [];
      let cum = 0;
      for (const q of polys) {
        const a = Math.max(0, d0 - cum), b = Math.min(q.L, d1 - cum);
        cum += q.L;
        if (!(b - a > 1e-9)) continue;
        const whole = a <= 1e-9 && b >= q.L - 1e-9;
        if (whole) {
          paths.push({ pts: q.w.pts.map((pt) => pt.slice()), closed: q.w.closed, layer: q.w.layer });
        } else {
          const pts = cutPoly(q, a, b);
          if (pts.length > 1) paths.push({ pts, closed: false, layer: q.w.layer });
        }
      }
      return paths;
    };

    for (let k = 1; k <= n; k++) {
      const d0 = (p.mode === "Windows" ? bounds[k - 1] : 0) * totalL;
      const d1 = bounds[k] * totalL;
      outs.push({ paths: extract(d0, d1) });
    }
    return outs;
  },
};
