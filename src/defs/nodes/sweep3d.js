import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "sweep3d",
  name: "Sweep 3D",
  cat: "gen",
  group: "geometric",
  desc: "A profile shape repeated along a 3D path and projected flat — the classic transparent-wireframe sweep where all the overlapping outlines build a moir\u00e9 body (no hidden-line removal, on purpose). Profile: Circle, Rectangle, Polygon, Star or Line, sized by Width/Height (an oval is a Circle with unequal Width/Height) — or wire any paths into the Profile input to sweep them instead (they are centered and fitted into the Width/Height box). Path: Helix (constant radius), Cone spiral (radius shrinks to Path end %), Flat spiral (Archimedean, in plane, outer to Path end %), Circle, Figure 8, or Line; Path width/depth make elliptical orbits, Rise is the vertical travel, Turns and Phase place the revolutions. Along the way the profile can shrink or grow (End scale %) and breathe (Mod amount/cycles, a deterministic sine). Twist rotates the profile around the path over the full length. View: orthographic Tilt/Yaw. Fully deterministic \u2014 no seed. Point budget: the profile is automatically coarsened when Instances \u00d7 resolution would explode.",
  ins: [Pin("paths", "Profile"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "profile", label: "Profile", type: "select", options: ["Circle", "Rectangle", "Polygon", "Star", "Line"], def: "Polygon" },
    { key: "pw", label: "Width mm", type: "slider", min: 2, max: 200, step: 0.5, def: 57 },
    { key: "ph", label: "Height mm", type: "slider", min: 1, max: 200, step: 0.5, def: 18 },
    { key: "sides", label: "Sides", type: "slider", min: 3, max: 12, step: 1, def: 5 },
    { key: "inner", label: "Star inner %", type: "slider", min: 10, max: 90, step: 1, def: 45 },
    { key: "path", label: "Path", type: "select", options: ["Helix", "Cone spiral", "Flat spiral", "Circle", "Figure 8", "Line"], def: "Helix" },
    { key: "pathW", label: "Path width mm", type: "slider", min: 0, max: 200, step: 0.5, def: 45 },
    { key: "pathD", label: "Path depth mm", type: "slider", min: 0, max: 200, step: 0.5, def: 45 },
    { key: "rise", label: "Rise mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
    { key: "turns", label: "Turns", type: "slider", min: 0.25, max: 10, step: 0.05, def: 1.5 },
    { key: "phase", label: "Phase \u00b0", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "pathEnd", label: "Path end %", type: "slider", min: 2, max: 150, step: 1, def: 35 },
    { key: "instances", label: "Instances", type: "slider", min: 8, max: 800, step: 1, def: 432 },
    { key: "endScale", label: "End scale %", type: "slider", min: 2, max: 200, step: 1, def: 100 },
    { key: "modAmt", label: "Mod amount %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "modCyc", label: "Mod cycles", type: "slider", min: 0.5, max: 12, step: 0.5, def: 3 },
    { key: "twist", label: "Twist \u00b0", type: "slider", min: -1080, max: 1080, step: 5, def: 0 },
    { key: "tilt", label: "Tilt \u00b0", type: "slider", min: -90, max: 90, step: 1, def: 0 },
    { key: "yaw", label: "Yaw \u00b0", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "cx", label: "Center X %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "cy", label: "Center Y %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  /* Path point in world mm (X right, Y up, Z depth) at t in [0,1].
     Kept as a def method shared by compute and overlay via `this`. */
  _path(p, t) {
    const TAU = Math.PI * 2;
    const th = (p.phase * Math.PI) / 180 + t * p.turns * TAU;
    const Rx = p.pathW, Rz = p.pathD, rise = p.rise;
    const endF = p.pathEnd / 100;
    switch (p.path) {
      case "Cone spiral": {
        const s = 1 + (endF - 1) * t;
        return [Rx * s * Math.cos(th), rise * (t - 0.5), Rz * s * Math.sin(th)];
      }
      case "Flat spiral": {
        const s = 1 + (endF - 1) * t;
        return [Rx * s * Math.cos(th), 0, Rz * s * Math.sin(th)];
      }
      case "Circle":
        return [Rx * Math.cos(th), 0, Rz * Math.sin(th)];
      case "Figure 8":
        return [Rx * Math.sin(th), rise * (t - 0.5), Rz * Math.sin(th) * Math.cos(th)];
      case "Line":
        return [Rx * (t * 2 - 1), rise * (t - 0.5), 0];
      default: /* Helix */
        return [Rx * Math.cos(th), rise * (t - 0.5), Rz * Math.sin(th)];
    }
  },

  overlay(p, ctx) {
    const X = (ctx.W * p.cx) / 100, Y = (ctx.H * p.cy) / 100;
    const ty = (p.tilt * Math.PI) / 180, yw = (p.yaw * Math.PI) / 180;
    const proj = (w) => {
      const x1 = w[0] * Math.cos(yw) + w[2] * Math.sin(yw);
      const z1 = -w[0] * Math.sin(yw) + w[2] * Math.cos(yw);
      const y1 = w[1] * Math.cos(ty) - z1 * Math.sin(ty);
      return [X + x1, Y - y1];
    };
    const g = [{ kind: "point", x: X, y: Y }];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const a = proj(this._path(p, i / N)), b = proj(this._path(p, (i + 1) / N));
      g.push({ kind: "arrow", x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
    }
    return g;
  },

  compute(ins, p, ctx) {
    const X = (ctx.W * p.cx) / 100, Y = (ctx.H * p.cy) / 100;
    const N = Math.max(2, Math.round(p.instances));
    const L = Math.round(p.layer);
    const TAU = Math.PI * 2;

    /* ---- profile in local (u, v) mm, centered; array of {pts, closed} ---- */
    const halfW = Math.max(0.1, p.pw) / 2, halfH = Math.max(0.1, p.ph) / 2;
    const subs = [];
    const wired = ins[0] && ins[0].paths && ins[0].paths.length ? ins[0].paths : null;
    /* budget: coarsen the profile so N * pts stays sane */
    const MAXPTS = 90000;
    if (wired) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, tot = 0;
      for (const pa of wired) for (const q of pa.pts) {
        if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
        if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
        tot++;
      }
      const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
      const s = Math.min((halfW * 2) / bw, (halfH * 2) / bh);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const skip = Math.max(1, Math.ceil((tot * N) / MAXPTS));
      for (const pa of wired) {
        const pts = [];
        for (let i = 0; i < pa.pts.length; i += skip) pts.push([(pa.pts[i][0] - mx) * s, (pa.pts[i][1] - my) * s]);
        if (skip > 1 && !pa.closed && (pa.pts.length - 1) % skip !== 0) {
          const q = pa.pts[pa.pts.length - 1];
          pts.push([(q[0] - mx) * s, (q[1] - my) * s]);
        }
        if (pts.length > 1) subs.push({ pts, closed: !!pa.closed });
      }
    } else {
      const seg = (pts, closed, step) => {
        /* subdivide straight edges so twist and projection bend them smoothly */
        const out = [];
        const n = pts.length;
        const lim = closed ? n : n - 1;
        for (let i = 0; i < lim; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const k = Math.max(1, Math.round(d / step));
          for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
        }
        if (!closed) out.push(pts[n - 1].slice());
        return out;
      };
      let base = null, closed = true;
      if (p.profile === "Circle") {
        const per = Math.PI * (halfW + halfH) * 2;
        base = [];
        const n = Math.max(16, Math.round(per / 1.2));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU;
          base.push([Math.cos(a) * halfW, Math.sin(a) * halfH]);
        }
      } else if (p.profile === "Rectangle") {
        base = seg([[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]], true, 2);
      } else if (p.profile === "Polygon") {
        const n = Math.max(3, Math.round(p.sides));
        const vs = [];
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + (k / n) * TAU;
          vs.push([Math.cos(a) * halfW, Math.sin(a) * halfH]);
        }
        base = seg(vs, true, 2);
      } else if (p.profile === "Star") {
        const n = Math.max(3, Math.round(p.sides));
        const vs = [];
        for (let k = 0; k < n * 2; k++) {
          const a = -Math.PI / 2 + (k / (n * 2)) * TAU;
          const f = k % 2 === 0 ? 1 : p.inner / 100;
          vs.push([Math.cos(a) * halfW * f, Math.sin(a) * halfH * f]);
        }
        base = seg(vs, true, 2);
      } else { /* Line */
        base = seg([[-halfW, 0], [halfW, 0]], false, 2);
        closed = false;
      }
      const skip = Math.max(1, Math.ceil((base.length * N) / MAXPTS));
      const pts = [];
      for (let i = 0; i < base.length; i += skip) pts.push(base[i]);
      subs.push({ pts, closed });
    }

    /* ---- projection ---- */
    const ty = (p.tilt * Math.PI) / 180, yw = (p.yaw * Math.PI) / 180;
    const cyw = Math.cos(yw), syw = Math.sin(yw), cty = Math.cos(ty), sty = Math.sin(ty);
    const proj = (wx, wy, wz) => {
      const x1 = wx * cyw + wz * syw;
      const z1 = -wx * syw + wz * cyw;
      const y1 = wy * cty - z1 * sty;
      return [X + x1, Y - y1];
    };

    /* ---- sweep ---- */
    const paths = [];
    const h = 1e-4;
    for (let i = 0; i < N; i++) {
      const t = N === 1 ? 0 : i / (N - 1);
      const P = this._path(p, t);
      /* frame: tangent by central difference, up-referenced */
      const Pa = this._path(p, Math.min(1, t + h)), Pb = this._path(p, Math.max(0, t - h));
      let Tv = [Pa[0] - Pb[0], Pa[1] - Pb[1], Pa[2] - Pb[2]];
      let tl = Math.hypot(Tv[0], Tv[1], Tv[2]);
      if (tl < 1e-12) Tv = [1, 0, 0]; else Tv = [Tv[0] / tl, Tv[1] / tl, Tv[2] / tl];
      let up = Math.abs(Tv[1]) > 0.999 ? [1, 0, 0] : [0, 1, 0];
      /* B = T x up, Nf = B x T */
      let B = [Tv[1] * up[2] - Tv[2] * up[1], Tv[2] * up[0] - Tv[0] * up[2], Tv[0] * up[1] - Tv[1] * up[0]];
      let bl = Math.hypot(B[0], B[1], B[2]);
      if (bl < 1e-12) B = [0, 0, 1]; else B = [B[0] / bl, B[1] / bl, B[2] / bl];
      const Nf = [B[1] * Tv[2] - B[2] * Tv[1], B[2] * Tv[0] - B[0] * Tv[2], B[0] * Tv[1] - B[1] * Tv[0]];
      /* size along the path: taper x sine modulation, floored at 1% */
      const s = Math.max(0.01, (1 + (p.endScale / 100 - 1) * t) * (1 + (p.modAmt / 100) * Math.sin(TAU * p.modCyc * t)));
      const tw = ((p.twist * Math.PI) / 180) * t;
      const ct = Math.cos(tw), st = Math.sin(tw);
      for (const sub of subs) {
        const pts = [];
        for (const q of sub.pts) {
          const u = (q[0] * ct - q[1] * st) * s;
          const v = (q[0] * st + q[1] * ct) * s;
          pts.push(proj(P[0] + B[0] * u + Nf[0] * v, P[1] + B[1] * u + Nf[1] * v, P[2] + B[2] * u + Nf[2] * v));
        }
        if (pts.length > 1) paths.push({ pts, closed: sub.closed, layer: L });
      }
    }
    return applyStyle({ paths }, ins[1]);
  },
};
