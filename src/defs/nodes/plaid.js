import { Pin, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  /* Plaid Grids 3D - overlapping band-line grids living on planes in a
     rotatable 3D world. True pinhole perspective (straight lines stay
     straight), orbit camera: Phase 0..1 spins a full 360 degrees so a
     Frame Grid sweep loops seamlessly. Dropout and wobble are hashed per
     line, never from phase, so nothing flickers between frames. */
  key: "plaid",
  name: "Plaid Grids 3D",
  cat: "gen",
  group: "geometric",
  desc: "Overlapping hand-drawn grids as planes in a fully rotatable 3D world. Each grid gets a seeded character: cell size, band structure (every line is a bundle of 1..Bands parallel strokes - the tartan look), extent, wobble and dropout. Arrangement Stack floats parallel panes in depth like sheets of glass (orbiting makes them slide past each other in parallax), Box aligns planes to the three axis orientations, Random tumbles them freely; Depth spread scatters the panes. Yaw and Pitch orbit the camera by hand and Perspective bends the view from flat orthographic to a deep pinhole lens. Phase adds a full 360-degree orbit turn from 0 to 1 - wire ANIMATE Steps into it and the loop closes seamlessly, with Bob adding a pitch sway that also loops. Dropout and wobble are hashed per line, never from phase, so frames never flicker. Pen per grid cycles pens by plane for instant multicolour plaid.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "grids", label: "Grids", type: "slider", min: 2, max: 8, step: 1, def: 4 },
    { key: "arrange", label: "Arrangement", type: "select", options: ["Stack", "Box", "Random"], def: "Stack" },
    { key: "spread", label: "Depth spread", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "size", label: "Size", type: "slider", min: 40, max: 220, step: 2, def: 140 },
    { key: "cellmin", label: "Cell min", type: "slider", min: 2, max: 30, step: 0.5, def: 6 },
    { key: "cellmax", label: "Cell max", type: "slider", min: 2, max: 40, step: 0.5, def: 16 },
    { key: "bands", label: "Bands", type: "slider", min: 1, max: 6, step: 1, def: 3 },
    { key: "bandgap", label: "Band gap", type: "slider", min: 0.4, max: 4, step: 0.1, def: 1.1 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "dropout", label: "Dropout", type: "slider", min: 0, max: 0.9, step: 0.05, def: 0.15 },
    { key: "yaw", label: "Yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 25 },
    { key: "pitch", label: "Pitch deg", type: "slider", min: -80, max: 80, step: 1, def: 15 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "phase", label: "Phase (wire Steps)", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "bob", label: "Bob deg", type: "slider", min: 0, max: 30, step: 1, def: 0 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "pen", label: "Pen", type: "pen", def: 0 },
    { key: "penper", label: "Pen per grid", type: "check", def: false },
  ],

  /* per-grid planes, shared by compute and overlay */
  _layout(ins, p, ctx) {
    const nG = Math.max(1, Math.min(12, Math.round(p.grids)));
    const spread = Math.max(0, Math.min(1, p.spread));
    let cmin = Math.min(p.cellmin, p.cellmax), cmax = Math.max(p.cellmin, p.cellmax);
    cmin = Math.max(0.8, cmin); cmax = Math.max(cmin, cmax);
    const planes = [];
    for (let gi = 0; gi < nG; gi++) {
      const rng = mulberry32((p.seed >>> 0) * 7919 + gi * 613 + 29);
      /* basis vectors u,v spanning the plane, in world space */
      let u, v;
      if (p.arrange === "Box") {
        const o = gi % 3;
        u = o === 0 ? [1, 0, 0] : o === 1 ? [1, 0, 0] : [0, 1, 0];
        v = o === 0 ? [0, 0, 1] : o === 1 ? [0, 1, 0] : [0, 0, 1];
      } else if (p.arrange === "Random") {
        const a1 = rng() * Math.PI * 2, a2 = Math.acos(2 * rng() - 1), a3 = rng() * Math.PI * 2;
        const n = [Math.sin(a2) * Math.cos(a1), Math.sin(a2) * Math.sin(a1), Math.cos(a2)];
        const t = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        const ux = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
        const ul = Math.hypot(...ux) || 1;
        u = ux.map((x) => x / ul);
        const vv = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
        const c3 = Math.cos(a3), s3 = Math.sin(a3);
        const u2 = u.map((x, i) => x * c3 + vv[i] * s3);
        v = u.map((x, i) => -x * s3 + vv[i] * c3);
        u = u2;
      } else { /* Stack: upright panes facing the camera at yaw 0 */
        u = [1, 0, 0];
        v = [0, 0, 1];
      }
      const center = p.arrange === "Stack"
        ? [(rng() * 2 - 1) * 0.14 * spread, (gi / Math.max(1, nG - 1) - 0.5) * 1.1 * spread, (rng() * 2 - 1) * 0.14 * spread]
        : [(rng() * 2 - 1) * 0.42 * spread, (rng() * 2 - 1) * 0.42 * spread, (rng() * 2 - 1) * 0.42 * spread];
      const a = 0.32 + rng() * 0.24;
      const b = 0.32 + rng() * 0.24;
      const cell = (cmin + rng() * (cmax - cmin)) / Math.max(20, p.size);
      const nb = 1 + Math.floor(rng() * Math.max(1, Math.min(6, Math.round(p.bands))));
      planes.push({ gi, u, v, center, a, b, cell, nb, drop: rng() * 1e6 });
    }
    return { planes };
  },

  overlay(p, ctx, ins, node) {
    const guides = [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
    try {
      if (typeof this._layout !== "function") return guides;
      const L = this._layout(ins, p, ctx);
      for (const pl of L.planes.slice(0, 12)) {
        guides.push({ kind: "circle", cx: ctx.W / 2 + pl.center[0] * p.size * 0.5, cy: ctx.H / 2 - pl.center[2] * p.size * 0.5, r: Math.max(2, pl.a * p.size * 0.25) });
      }
    } catch (e) { /* never throw */ }
    return guides;
  },

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const push = (pts, layer) => {
      if (pts.length < 2 || used > BUDGET) return;
      used += pts.length;
      paths.push({ pts, closed: false, layer });
    };
    const d0v = 1.25 / Math.max(0.02, p.persp);
    const projAt = (P, cy, sy, cp, sp) => {
      const x1 = P[0] * cy - P[1] * sy;
      const y1 = P[0] * sy + P[1] * cy;
      const sv = y1 * sp - P[2] * cp;
      const depth = y1 * cp + P[2] * sp;
      const k = d0v / Math.max(0.25, d0v - depth);
      return [x1 * k, sv * k];
    };
    const wob = Math.max(0, p.wobble);
    const drop = Math.max(0, Math.min(0.95, p.dropout));

    /* camera: yaw orbit (+ full turn per phase cycle), pitch with looping bob */
    const ph = p.phase - Math.floor(p.phase); /* 1.0 wraps to 0 exactly: byte-perfect loop */
    const yaw = ((p.yaw / 360 + ph) % 1) * Math.PI * 2;
    const pit = ((p.pitch + p.bob * Math.sin(ph * Math.PI * 2)) * Math.PI) / 180;
    const cy0 = Math.cos(yaw), sy0 = Math.sin(yaw);
    const cph = Math.cos(pit), sph = Math.sin(pit);

    const L = this._layout(ins, p, ctx);

    /* fit: measure this configuration's own extent over the FULL orbit
       (plane corner points x 48 yaw samples x bob pitch extremes) so the
       whole loop is guaranteed in frame without a per-frame re-fit; the
       scan covers every phase, so the scale is phase-independent */
    let ext = 0.05;
    {
      const pits = p.bob > 0
        ? [((p.pitch - p.bob) * Math.PI) / 180, (p.pitch * Math.PI) / 180, ((p.pitch + p.bob) * Math.PI) / 180]
        : [(p.pitch * Math.PI) / 180];
      for (const pl of L.planes) {
        for (const [su, sv2] of [[-pl.a, -pl.b], [-pl.a, pl.b], [pl.a, -pl.b], [pl.a, pl.b], [0, -pl.b], [0, pl.b], [-pl.a, 0], [pl.a, 0]]) {
          const P = [
            pl.center[0] + pl.u[0] * su + pl.v[0] * sv2,
            pl.center[1] + pl.u[1] * su + pl.v[1] * sv2,
            pl.center[2] + pl.u[2] * su + pl.v[2] * sv2,
          ];
          for (let oi = 0; oi < 48; oi++) {
            const a2 = (oi / 48) * Math.PI * 2;
            const cy2 = Math.cos(a2), sy2 = Math.sin(a2);
            for (const pt2 of pits) {
              const q = projAt(P, cy2, sy2, Math.cos(pt2), Math.sin(pt2));
              ext = Math.max(ext, Math.abs(q[0]), Math.abs(q[1]));
            }
          }
        }
      }
    }
    const S = Math.min(Math.max(20, p.size), Math.max(12, (0.97 * (Math.min(W, H) / 2 - Math.max(0, p.margin) - 1.2)) / ext));
    const proj = (P) => {
      const q = projAt(P, cy0, sy0, cph, sph);
      return [W / 2 + q[0] * S, H / 2 + q[1] * S];
    };
    const bg = Math.max(0.2, p.bandgap) / S;
    for (const pl of L.planes) {
      const layer = p.penper ? (Math.round(p.pen) + pl.gi) % 12 : Math.max(0, Math.min(11, Math.round(p.pen)));
      const kSeed = (p.seed >>> 0) * 101 + pl.gi * 37 + 11;
      /* two families of band lines on the plane */
      for (let fam = 0; fam < 2; fam++) {
        const along = fam === 0 ? pl.v : pl.u;   /* line direction */
        const across = fam === 0 ? pl.u : pl.v;  /* stepping direction */
        const half = fam === 0 ? pl.a : pl.b;
        const lineHalf = fam === 0 ? pl.b : pl.a;
        const nLines = Math.max(1, Math.floor((2 * half) / pl.cell));
        for (let li = 0; li <= nLines; li++) {
          if (hash2(li * 2 + fam, pl.gi * 7 + 1, kSeed) < drop) continue;
          const off = -half + li * pl.cell;
          for (let bi = 0; bi < pl.nb; bi++) {
            if (pl.nb > 1 && hash2(li * 11 + bi, pl.gi * 5 + fam, kSeed + 3) < drop * 0.6) continue;
            const boff = off + (bi - (pl.nb - 1) / 2) * bg;
            if (boff < -half - 1e-9 || boff > half + 1e-9) continue;
            const P0 = [], seg = [];
            const wobAmp = (wob * 0.8) / S;
            const nS = wob > 0.01 ? Math.max(2, Math.ceil((2 * lineHalf * S) / 2.5)) : 1;
            for (let si = 0; si <= nS; si++) {
              const t = -lineHalf + (2 * lineHalf * si) / nS;
              const w = wob > 0.01
                ? (noise2(t * 7 + li * 1.7 + bi * 0.9, pl.gi * 3.1 + fam * 5.5, kSeed + 7) - 0.5) * 2 * wobAmp
                : 0;
              const o = boff + w;
              seg.push([
                pl.center[0] + pl.u[0] * (fam === 0 ? o : t) + pl.v[0] * (fam === 0 ? t : o),
                pl.center[1] + pl.u[1] * (fam === 0 ? o : t) + pl.v[1] * (fam === 0 ? t : o),
                pl.center[2] + pl.u[2] * (fam === 0 ? o : t) + pl.v[2] * (fam === 0 ? t : o),
              ]);
            }
            push(seg.map(proj), layer);
            if (used > BUDGET) break;
          }
          if (used > BUDGET) break;
        }
        if (used > BUDGET) break;
      }
      if (used > BUDGET) break;
    }
    return applyStyle({ paths }, ins[0]);
  },
};
