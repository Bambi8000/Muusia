import { Pin, mulberry32, resample, applyStyle } from "../helpers.js";

export default {
  /* Snarled Line — a tangle of fishing line: long continuous strands with
   * COIL MEMORY, drifting into adjustable clumps.
   *
   * Each strand is one stroke integrated with curvature physics: the
   * curvature relaxes toward the spool's preferred loop (2 / Coil mm, so
   * loops come out the same familiar size — line remembers its reel),
   * Memory sets how firmly it returns, Mess shakes it and occasionally
   * flips the coiling handedness into figure-eights. Soft walls steer
   * strands back from the margin so the tangle never leaves the sheet.
   *
   * Clumping is the control surface: Clumps seeded attractor centers (or
   * wire any path into "Clump at" and the centers sit on ITS points —
   * vertices when few, resampled when many, capped at 12), Clumping pulls
   * wandering strands in, Clump size sets the dense zone and Tighten
   * shrinks the loop radius inside it — the yellow-core-in-green-halo look
   * of line snarled in water. Clump pen splits the in-zone segments onto
   * their own pen for exactly that two-color plot.
   *
   * Start chooses where strands enter: from the Edges (drifting in like
   * the photo), inside the Clumps, or Random. Deterministic per seed; the
   * overlay shows the live clump circles.
   */

  key: "snarl",
  name: "Snarled Line",
  cat: "gen",
  group: "organic",
  desc: "A tangle of fishing line: long continuous strands with coil memory - curvature relaxes toward the spool loop (Coil mm), Memory sets how firmly, Mess shakes it and flips handedness into figure-eights. Clumping pulls strands into seeded attractor centers (or wire a path into Clump at to place them), Clump size sets the dense zone, Tighten shrinks loops inside it, and Clump pen splits in-zone segments onto their own pen for the yellow-core-in-green-halo look. Strands start from the edges, the clumps or anywhere; soft walls keep the tangle on the sheet.",
  ins: [Pin("paths", "Clump at"), Pin("style", "Style")],
  outs: [Pin("paths")],

  params: [
    { key: "strands", label: "Strands", type: "slider", min: 1, max: 40, step: 1, def: 10 },
    { key: "length", label: "Strand mm", type: "slider", min: 100, max: 3000, step: 10, def: 900 },
    { key: "coil", label: "Coil mm", type: "slider", min: 4, max: 60, step: 0.5, def: 26 },
    { key: "memory", label: "Memory", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "mess", label: "Mess", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
    { key: "loopvary", label: "Loop vary", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "clumps", label: "Clumps", type: "slider", min: 0, max: 6, step: 1, def: 1 },
    { key: "clumping", label: "Clumping", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "clumpsize", label: "Clump size mm", type: "slider", min: 10, max: 120, step: 1, def: 45 },
    { key: "tighten", label: "Tighten", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "start", label: "Start", type: "select", options: ["Edges", "Clumps", "Random"], def: "Edges" },
    { key: "clumppen", label: "Clump pen", type: "select", options: ["Off", "On"], def: "Off" },
    { key: "cpen", label: "Core pen", type: "pen", def: 4, showIf: (p) => p.clumppen === "On" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 30, step: 1, def: 8 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],

  /* clump centers: wired path points (vertices when few, resampled when
     many, cap 12) or seeded positions — compute and overlay share this */
  _centers(p, ctx, ins) {
    const W = Math.max(1, Number(ctx && ctx.W) || 420), Hh = Math.max(1, Number(ctx && ctx.H) || 297);
    const src = ins && ins[0];
    if (src && src.paths && src.paths.length) {
      let pts = [];
      for (const q of src.paths) if (q.pts && q.pts.length) pts = pts.concat(q.pts);
      if (pts.length > 12) {
        pts = [];
        for (const q of src.paths) {
          if (!q.pts || q.pts.length < 2) { if (q.pts && q.pts.length) pts.push(q.pts[0]); continue; }
          pts = pts.concat(resample(q.pts, !!q.closed, Math.max(30, Number(p.clumpsize) || 45)));
        }
      }
      return pts.slice(0, 12).map(([x, y]) => [x, y]);
    }
    const n = Math.max(0, Math.min(6, Math.round(Number(p.clumps) || 0)));
    const cr = mulberry32(((p.seed | 0) ^ 0x51ab51ab) >>> 0);
    const cs = [];
    for (let k = 0; k < n; k++) cs.push([W * (0.22 + 0.56 * cr()), Hh * (0.22 + 0.56 * cr())]);
    return cs;
  },

  compute(ins, p, ctx) {
    const W = Math.max(1, Number(ctx && ctx.W) || 420), Hh = Math.max(1, Number(ctx && ctx.H) || 297);
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const cpen = Math.max(0, Math.min(11, Math.round(Number(p.cpen) == null ? 4 : Number(p.cpen))));
    const twoPen = p.clumppen === "On";
    const rng = mulberry32(p.seed);
    const m = Math.max(0, Math.min(Math.min(W, Hh) * 0.4, Number(p.margin) || 0));
    const x0 = m, x1 = W - m, y0 = m, y1 = Hh - m;
    const centers = this._centers(p, ctx, ins);
    const R = Math.max(4, Number(p.clumpsize) || 45);
    const kPref = 2 / Math.max(4, Number(p.coil) || 16);
    const mem = Math.max(0, Math.min(1, Number(p.memory) || 0));
    const mess = Math.max(0, Math.min(1, Number(p.mess) || 0));
    const pull = Math.max(0, Math.min(1, Number(p.clumping) || 0));
    const tight = Math.max(0, Math.min(1, Number(p.tighten) || 0));
    const lv = Math.max(0, Math.min(1, Number(p.loopvary) == null ? 0.5 : Number(p.loopvary)));
    const ds = 0.9;
    const BUDGET = 110000;
    let total = 0;
    const paths = [];
    const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

    const nS = Math.max(1, Math.min(40, Math.round(Number(p.strands) || 10)));
    const steps = Math.round(Math.max(100, Number(p.length) || 900) / ds);

    for (let s = 0; s < nS; s++) {
      /* start pose */
      let px, py, th;
      if (p.start === "Clumps" && centers.length) {
        const c = centers[Math.floor(rng() * centers.length)];
        const a = rng() * Math.PI * 2, rr = R * 0.4 * Math.sqrt(rng());
        px = c[0] + Math.cos(a) * rr; py = c[1] + Math.sin(a) * rr;
        th = rng() * Math.PI * 2;
      } else if (p.start === "Random" || !((x1 - x0) > 4 && (y1 - y0) > 4)) {
        px = x0 + (x1 - x0) * rng(); py = y0 + (y1 - y0) * rng();
        th = rng() * Math.PI * 2;
      } else {
        const side = Math.floor(rng() * 4), u = rng();
        if (side === 0) { px = x0 + (x1 - x0) * u; py = y0 + 0.5; }
        else if (side === 1) { px = x0 + (x1 - x0) * u; py = y1 - 0.5; }
        else if (side === 2) { px = x0 + 0.5; py = y0 + (y1 - y0) * u; }
        else { px = x1 - 0.5; py = y0 + (y1 - y0) * u; }
        th = Math.atan2(Hh / 2 - py, W / 2 - px) + (rng() - 0.5) * 1.2;
      }
      px = Math.min(x1, Math.max(x0, px)); py = Math.min(y1, Math.max(y0, py));
      let h = rng() < 0.5 ? -1 : 1;
      let k = h * kPref * (0.4 + 0.6 * rng());
      /* phase machine: real line alternates coiling with straight-ish runs —
         loops cluster, then the strand sweeps a long lazy arc to the next
         cluster (the photo look) */
      let coiling = rng() < 0.6;
      /* Loop vary: every coiling phase rolls its own loop size from a
         log-spread around Coil mm - no two loops need match */
      let kScale = Math.exp((rng() - 0.5) * 2 * 1.5 * lv);
      let phaseLeft = coiling
        ? (0.8 + 1.6 * rng()) * Math.PI * (2 / (kPref * kScale))
        : (18 + 70 * rng());

      let seg = [[px, py]];
      let segIn = null;
      const flushSeg = () => {
        if (seg.length > 1) {
          if (total + seg.length > BUDGET) return false;
          total += seg.length;
          paths.push({ pts: seg, closed: false, layer: twoPen && segIn ? cpen : pen });
        }
        return true;
      };

      for (let i = 0; i < steps; i++) {
        /* nearest clump */
        let cd = Infinity, cc = null;
        for (const c of centers) {
          const d = Math.hypot(c[0] - px, c[1] - py);
          if (d < cd) { cd = d; cc = c; }
        }
        const inClump = cc && cd < R;

        /* phase machine tick */
        phaseLeft -= ds;
        if (phaseLeft <= 0) {
          coiling = !coiling;
          if (coiling) {
            if (rng() < 0.35) h = -h;
            kScale = Math.exp((rng() - 0.5) * 2 * 1.5 * lv);
            /* snap most of the way to the new loop so it establishes
               within the phase instead of smearing through transitions */
            k = h * kPref * kScale * 0.7 + k * 0.3;
          }
          phaseLeft = coiling
            ? (0.8 + 1.6 * rng()) * Math.PI * (2 / (kPref * kScale))
            : (18 + 70 * rng());
        }

        /* coil memory toward the phase's preferred curvature: full loop
           when coiling, a gentle arc on the runs; Tighten shrinks in-clump
           loops and shortens the runs there */
        const runK = 0.12 + (inClump ? tight * 0.25 : 0);
        const kp = h * kPref * (coiling ? kScale * (inClump ? 1 + tight * 2.2 : 1) : runK);
        k += (kp - k) * mem * 0.08;
        k += (rng() - 0.5) * mess * 0.055;
        if (rng() < mess * 0.004) h = -h;

        /* clump attraction: steer toward the center; keep a floor inside so
           strands cross the core instead of orbiting a donut, and mostly on
           the runs so coils stay round */
        if (cc && pull > 0 && cd < R * 3.4) {
          const da = wrap(Math.atan2(cc[1] - py, cc[0] - px) - th);
          const fall = cd > R ? 1 : 0.35 + 0.65 * (cd / R);
          k += Math.max(-0.5, Math.min(0.5, da)) * pull * (coiling ? 0.02 : 0.07) * fall;
        }
        /* inside the clump the runs shorten so loops pile up */
        if (inClump && !coiling && tight > 0 && phaseLeft > 12) phaseLeft = 12;

        /* soft wall: steer back inside near the margin */
        const wd = Math.min(px - x0, x1 - px, py - y0, y1 - py);
        if (wd < 14) {
          const da = wrap(Math.atan2(Hh / 2 - py, W / 2 - px) - th);
          k += Math.max(-0.6, Math.min(0.6, da)) * (1 - wd / 14) * 0.22;
          /* don't let a coil park against the wall: force a run to sweep away */
          if (wd < 8 && coiling) { coiling = false; phaseLeft = Math.max(phaseLeft, 30); }
        }

        th += k * ds;
        let nx = px + Math.cos(th) * ds, ny = py + Math.sin(th) * ds;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) {
          /* hard turn: face the canvas center and step again */
          th = Math.atan2(Hh / 2 - py, W / 2 - px) + (rng() - 0.5) * 0.6;
          k = h * kPref;
          nx = Math.min(x1, Math.max(x0, px + Math.cos(th) * ds));
          ny = Math.min(y1, Math.max(y0, py + Math.sin(th) * ds));
        }
        px = nx; py = ny;

        if (twoPen) {
          if (segIn === null) segIn = inClump;
          if (inClump !== segIn) {
            if (!flushSeg()) return applyStyle({ paths }, ins[1]);
            seg = [seg.length ? seg[seg.length - 1] : [px, py]];
            segIn = inClump;
          }
        }
        seg.push([px, py]);
      }
      if (!flushSeg()) return applyStyle({ paths }, ins[1]);
    }
    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx, ins) {
    try {
      const cs = this._centers(p, ctx, ins);
      const R = Math.max(4, Number(p.clumpsize) || 45);
      return cs.slice(0, 12).map(([cx, cy]) => ({ kind: "circle", cx, cy, r: R }));
    } catch (e) { return []; }
  },
};
