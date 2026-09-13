import { Pin, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  /* Mushroom - seven Finnish forest species as parametric 3D revolution
     models with angular noise modulation, drawn as line art from any
     camera angle (Yaw + Pitch, 0 = side profile, 90 = straight down).
     Gills are traced on the actual 3D surface with arc-length forking;
     visibility comes from one surface-normal depth test. The Mesh output
     carries the first mushroom as a watertight normalized mesh. */
  key: "mushroom",
  name: "Mushroom",
  cat: "gen",
  group: "nature",
  desc: "Forest mushrooms as true 3D models seen from any angle: Yaw spins them, Pitch tilts the camera from side profile (0) to straight overhead (90). Species: Chanterelle (wavy funnel, forking false gills), Funnel chanterelle (small cap, long slender stem), Black trumpet (deep ragged horn, sparse wrinkles), Gomphidius (slick cone cap, thick sparse decurrent gills), Bolete (barrel stem with net reticulation, bun cap with contour arcs, no gills), Fly agaric (dome cap with white warts, ring on the stem, bulbous base) and Sheep polypore (lumpy asymmetric bracket with wobbly contours). Mix picks a species per copy. Count scatters seeded copies in the margin with per-copy size, spin and lean - instant shirt-print sheets. Gill spacing sets the fork density at the rim, Waviness ruffles the edges, Stem curve bends the stalks. Cap texture Stipple dusts the cap top with dots (the classic top-view print look). Outlines toggles the silhouette and rim so gills and textures can be plotted alone. The Mesh output carries the FIRST mushroom as a watertight normalized mesh for Mesh Slice; the Style input touches only the paths.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Out"), Pin("mesh", "Mesh")],
  params: [
    { key: "species", label: "Species", type: "select", options: ["Chanterelle", "Funnel chanterelle", "Black trumpet", "Gomphidius", "Bolete", "Fly agaric", "Sheep polypore", "Mix"], def: "Chanterelle" },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "count", label: "Count", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "size", label: "Size", type: "slider", min: 20, max: 140, step: 1, def: 80 },
    { key: "sizevar", label: "Size variation", type: "slider", min: 0, max: 0.6, step: 0.05, def: 0.25, showIf: (p) => p.count > 1 },
    { key: "yaw", label: "Yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 20 },
    { key: "pitch", label: "Pitch deg", type: "slider", min: 0, max: 90, step: 1, def: 12 },
    { key: "anglejit", label: "Spin jitter", type: "slider", min: 0, max: 180, step: 5, def: 60, showIf: (p) => p.count > 1 },
    { key: "leanjit", label: "Lean jitter", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "gillsp", label: "Gill spacing", type: "slider", min: 1, max: 8, step: 0.1, def: 2.6 },
    { key: "wavy", label: "Waviness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "chaos", label: "Chaos", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "stemcurve", label: "Stem curve", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "captex", label: "Cap texture", type: "select", options: ["None", "Stipple"], def: "None" },
    { key: "outlines", label: "Outlines", type: "check", def: true },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "pen", label: "Pen", type: "pen", def: 0 },
  ],

  /* Placement + per-copy pose, shared by compute and overlay. */
  _layout(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const margin = Math.max(0, p.margin);
    const n = Math.max(1, Math.min(24, Math.round(p.count)));
    const SPECIES = ["Chanterelle", "Funnel chanterelle", "Black trumpet", "Gomphidius", "Bolete", "Fly agaric", "Sheep polypore"];
    const copies = [];
    for (let i = 0; i < n; i++) {
      const rng = mulberry32((p.seed >>> 0) * 7919 + i * 613 + 17);
      const jSize = (rng() * 2 - 1); /* always drawn so copy streams are count-invariant */
      const size = Math.max(8, p.size * (1 + (n > 1 ? jSize * p.sizevar : 0)));
      const sp = p.species === "Mix" ? SPECIES[Math.floor(rng() * SPECIES.length) % SPECIES.length] : p.species;
      const jYaw = (rng() * 2 - 1);
      const yaw = ((p.yaw + (n > 1 ? jYaw * p.anglejit : 0)) * Math.PI) / 180;
      const lean = (((rng() * 2 - 1) * p.leanjit) * Math.PI) / 180;
      const rad = size * 0.55;
      let x = W / 2, y = H / 2, placed = false;
      if (n === 1) {
        placed = true;
      } else {
        for (let t = 0; t < 200 && !placed; t++) {
          const sx = W - 2 * margin - 2 * rad * 0.8, sy = H - 2 * margin - 2 * rad * 0.8;
          const jx = rng(), jy = rng();
          if (sx <= 0 || sy <= 0) break;
          const cx = margin + rad * 0.8 + jx * sx;
          const cy = margin + rad * 0.8 + jy * sy;
          let ok = true;
          for (const q of copies) {
            if (Math.hypot(q.x - cx, q.y - cy) < (q.rad + rad) * 0.72) { ok = false; break; }
          }
          if (ok) { x = cx; y = cy; placed = true; }
        }
      }
      if (!placed) continue;
      copies.push({ x, y, size, rad, sp, yaw, lean, ci: i });
    }
    return { copies };
  },

  overlay(p, ctx, ins, node) {
    const guides = [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
    try {
      if (typeof this._layout !== "function") return guides;
      const L = this._layout(ins, p, ctx);
      for (const c of L.copies.slice(0, 24)) guides.push({ kind: "circle", cx: c.x, cy: c.y, r: c.rad });
    } catch (e) { /* never throw */ }
    return guides;
  },

  compute(ins, p, ctx, node) {
    const pen = Math.max(0, Math.min(11, Math.round(p.pen)));
    const TAU = Math.PI * 2;
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const push = (pts, closed) => {
      if (pts.length < 2 || used > BUDGET) return;
      used += pts.length;
      paths.push({ pts, closed, layer: pen });
    };
    const phi = (Math.max(0, Math.min(90, p.pitch)) * Math.PI) / 180;
    const cph = Math.cos(phi), sph = Math.sin(phi);
    const wavy = Math.max(0, Math.min(1.5, p.wavy));
    const chaos = Math.max(0, Math.min(1.5, p.chaos === undefined ? 0.6 : p.chaos));
    const gillsp = Math.max(0.6, p.gillsp);

    const L = this._layout(ins, p, ctx);
    let meshOut = null;

    /* species profile: parametric outer polyline from base to apex, plus
       gill support span and feature switches. All in unit height. */
    const model = (sp, rng) => {
      const pts = [];  /* [r, z, wamp] outer profile, base -> rim/apex */
      const put = (r, z, w) => pts.push([r, z, w]);
      const M = {
        prof: pts, gillT: null, gillFork: true, gillMul: 1,
        rim: -1, capTop: null, warts: false, ring: 0, net: false,
        contours: null, lumpy: 0, wfreq: 1.8, zflut: 0, inner: null, bulb: 0,
      };
      if (sp === "Chanterelle") {
        put(0.09, 0, 0); put(0.07, 0.18, 0); put(0.09, 0.34, 0.1);
        put(0.16, 0.52, 0.3); put(0.3, 0.72, 0.6); put(0.44, 0.88, 0.9); put(0.52, 1, 1);
        M.rim = pts.length - 1; M.gillT = [0.6, M.rim]; M.zflut = 0.07; M.wfreq = 1.8; M.funnel = 1;
        M.inner = [[0.4, 0.94], [0.2, 0.82], [0.06, 0.7], [0, 0.66]];
      } else if (sp === "Funnel chanterelle") {
        put(0.05, 0, 0); put(0.042, 0.3, 0); put(0.045, 0.55, 0);
        put(0.1, 0.72, 0.25); put(0.24, 0.88, 0.7); put(0.38, 1, 1);
        M.rim = pts.length - 1; M.gillT = [2.2, M.rim]; M.zflut = 0.05; M.wfreq = 2.1; M.gillMul = 1.35; M.funnel = 1;
        M.inner = [[0.26, 0.93], [0.1, 0.8], [0, 0.75]];
      } else if (sp === "Black trumpet") {
        put(0.05, 0, 0); put(0.05, 0.12, 0.05); put(0.09, 0.34, 0.25);
        put(0.17, 0.58, 0.55); put(0.28, 0.8, 0.9); put(0.38, 1, 1.25);
        M.rim = pts.length - 1; M.gillT = [0.5, M.rim]; M.gillFork = false; M.gillMul = 2.6;
        M.zflut = 0.09; M.wfreq = 2.6; M.funnel = 1;
        M.inner = [[0.28, 0.9], [0.12, 0.55], [0.03, 0.2], [0, 0.15]];
      } else if (sp === "Gomphidius") {
        put(0.11, 0, 0); put(0.09, 0.3, 0); put(0.1, 0.55, 0);
        put(0.42, 0.78, 0.2);
        M.rim = pts.length - 1; M.gillT = [2, M.rim]; M.gillMul = 2.2; M.wfreq = 1.4;
        put(0.3, 0.9, 0.1); put(0.12, 0.98, 0); put(0, 1, 0);
        M.contours = [0.88, 0.95];
      } else if (sp === "Bolete") {
        put(0.14, 0, 0); put(0.18, 0.18, 0); put(0.16, 0.4, 0); put(0.12, 0.55, 0);
        put(0.5, 0.68, 0.12);
        M.rim = pts.length - 1; M.net = [0.25, 0.55]; M.wfreq = 1.1;
        put(0.46, 0.85, 0.08); put(0.28, 0.97, 0); put(0, 1, 0);
        M.contours = [0.74, 0.82, 0.9, 0.96];
      } else if (sp === "Fly agaric") {
        put(0.12, 0, 0); put(0.08, 0.12, 0); put(0.065, 0.35, 0); put(0.06, 0.58, 0);
        put(0.55, 0.7, 0.1);
        M.rim = pts.length - 1; M.gillT = [3, M.rim]; M.gillMul = 1; M.ring = 0.5; M.bulb = 1;
        M.wfreq = 1.3;
        put(0.48, 0.85, 0.06); put(0.26, 0.97, 0); put(0, 1, 0);
        M.warts = true; M.contours = null;
      } else { /* Sheep polypore */
        put(0.13, 0, 0); put(0.12, 0.2, 0); put(0.13, 0.38, 0);
        put(0.5, 0.55, 0.3);
        M.rim = pts.length - 1; M.lumpy = 1; M.wfreq = 1.1;
        put(0.44, 0.72, 0.35); put(0.24, 0.85, 0.3); put(0, 0.9, 0.2);
        M.contours = [0.62, 0.7, 0.78, 0.85];
      }
      return M;
    };

    /* densify a parametric profile and return samples with tangents */
    const densify = (prof) => {
      const out = [];
      for (let i = 0; i < prof.length - 1; i++) {
        const a = prof[i], b = prof[i + 1];
        const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(2, Math.ceil(seg / 0.025));
        for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
          const t = k / n;
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, i + t]);
        }
      }
      for (let i = 0; i < out.length; i++) {
        const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
        const dr = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dr, dz) || 1;
        out[i].push(dz / l, -dr / l); /* outward 2d normal (nr, nz) */
      }
      return out;
    };

    for (const c of L.copies) {
      const rng = mulberry32((p.seed >>> 0) * 7919 + c.ci * 613 + 991);
      const M = model(c.sp, rng);
      const S = c.size;
      const kSeed = (p.seed >>> 0) * 101 + c.ci * 37 + 5;
      const cy0 = Math.cos(c.yaw), sy0 = Math.sin(c.yaw);
      const cl = Math.cos(c.lean), sl = Math.sin(c.lean);
      const bendA = rng() * TAU;
      const bendM = p.stemcurve * 0.16 * (0.4 + rng() * 0.6);
      const bx = Math.cos(bendA) * bendM, by = Math.sin(bendA) * bendM;
      const dprof = densify(M.prof);
      const zTop = M.prof[M.prof.length - 1][1];

      const asymDir = rng() * TAU;
      const wmod = (alpha, wamp, extraSeed, z) => {
        const fs = M.wfreq;
        const zz = (z || 0) * 1.4; /* folds twist as they descend */
        const n1 = noise2(Math.cos(alpha) * fs + 9.7 + zz, Math.sin(alpha) * fs + 3.1 + zz * 0.7, kSeed + (extraSeed || 0));
        const n2 = noise2(Math.cos(alpha) * fs * 2.6 + 31.2, Math.sin(alpha) * fs * 2.6 + 17.5, kSeed + 3);
        const lobe = noise2(Math.cos(alpha) * 0.85 + 50.3, Math.sin(alpha) * 0.85 + 60.1, kSeed + 7);
        const asym = Math.cos(alpha - asymDir);
        return 1 + wavy * wamp * ((n1 - 0.5) * 0.9 + chaos * (n2 - 0.5) * 0.65)
                 + chaos * wamp * ((lobe - 0.5) * 0.85 + asym * 0.22);
      };
      const lump = (alpha, z) => M.lumpy
        ? (noise2(Math.cos(alpha) * 1.6 + z * 2.2, Math.sin(alpha) * 1.6 + 4.4, kSeed + 71) - 0.5) * 0.22 * M.lumpy
        : 0;

      /* surface point at profile sample q, world angle alpha */
      const sway = (z) => chaos * 0.045 * (noise2(z * 2.3 + 5.5, 7.7, kSeed + 19) - 0.5) * 2;
      const sway2 = (z) => chaos * 0.045 * (noise2(z * 2.3 + 15.1, 3.3, kSeed + 23) - 0.5) * 2;
      const surf = (q, alpha) => {
        const r = q[0] * wmod(alpha, q[2], 0, q[1]) + ((q[2] > 0.05 || M.lumpy) ? lump(alpha, q[1]) * q[0] * 2 * (0.7 + chaos) : 0);
        const zf = M.zflut
          ? wavy * M.zflut * (1 + chaos * 0.8) * q[2] * ((noise2(Math.cos(alpha) * M.wfreq + 21.3, Math.sin(alpha) * M.wfreq + 8.8, kSeed + 13) - 0.5) * 2
            + chaos * (noise2(Math.cos(alpha) * M.wfreq * 2.4 + 41.9, Math.sin(alpha) * M.wfreq * 2.4 + 33.4, kSeed + 17) - 0.5))
          : 0;
        const z = q[1] + zf + (M.lumpy ? lump(alpha, q[1] + 3) * 0.4 : 0);
        const bend = z * z;
        return [r * Math.cos(alpha) + bx * bend + sway(z), r * Math.sin(alpha) + by * bend + sway2(z), z];
      };
      const proj = (P) => {
        const x1 = P[0] * cy0 - P[1] * sy0;
        const y1 = P[0] * sy0 + P[1] * cy0;
        const u = x1 * S;
        const v = (y1 * sph - P[2] * cph) * S;
        return [c.x + u * cl - v * sl, c.y + (u * sl + v * cl) + S * 0.48];
      };
      const depthN = (alpha, nr, nz) => Math.sin(alpha + c.yaw) * nr * cph + nz * sph;

      /* --- silhouette profiles at screen-extreme angles --- */
      if (p.outlines !== false) {
        /* profile curves are silhouettes only where the surface normal is
           near-perpendicular to the view: |nz|*sin(pitch) small; without
           this the profile draws a chord across the cap from above */
        for (const aScr of [0, Math.PI]) {
          const alpha = aScr - c.yaw;
          let seg = [];
          for (const q of dprof) {
            if (Math.abs(q[5]) * sph < 0.42) seg.push(proj(surf(q, alpha)));
            else if (seg.length) { if (seg.length > 1) push(seg, false); seg = []; }
          }
          if (seg.length > 1) push(seg, false);
        }
        /* rim sweep: a funnel rim is an open bowl edge - nothing ever
           occludes it, so draw the full closed loop; a domed cap hides
           its far rim behind the dome, so cull by the edge normal */
        const rimQ = dprof.filter((q) => Math.abs(q[3] - M.rim) < 0.02);
        const rq = rimQ.length ? rimQ[0] : dprof[dprof.length - 1];
        const NA = Math.max(48, Math.ceil((rq[0] * S * TAU) / 1));
        if (M.funnel) {
          const loop = [];
          for (let k = 0; k < NA; k++) loop.push(proj(surf(rq, (k / NA) * TAU)));
          push(loop, true);
        } else {
          let seg = [];
          for (let k = 0; k <= NA; k++) {
            const alpha = (k / NA) * TAU;
            if (depthN(alpha, 0.88, 0.48) > -0.06) seg.push(proj(surf(rq, alpha)));
            else if (seg.length) { push(seg, false); seg = []; }
          }
          if (seg.length) push(seg, false);
        }
        /* inner cavity of funnels: 1-2 throat rings when looking in */
        if (M.inner && sph > 0.3) {
          for (let ri = 0; ri < Math.min(2, M.inner.length); ri++) {
            const q = M.inner[ri];
            if (q[0] < 0.03) continue;
            const iq = [q[0], q[1], 0.25, 0, -0.8, 0.6];
            let seg2 = [];
            const NA2 = Math.max(24, Math.ceil((q[0] * S * TAU) / 1.2));
            for (let k = 0; k <= NA2; k++) {
              const alpha = (k / NA2) * TAU;
              if (depthN(alpha, -0.8, 0.6) > 0.03) seg2.push(proj(surf(iq, alpha)));
              else if (seg2.length) { if (seg2.length > 1) push(seg2, false); seg2 = []; }
            }
            if (seg2.length > 1) push(seg2, false);
          }
        }
      }

      /* --- gills on the actual wall, arc-length forking --- */
      if (M.gillT) {
        const [g0i, g1i] = M.gillT;
        const gspan = dprof.filter((q) => q[3] >= g0i && q[3] <= g1i);
        if (gspan.length > 3) {
          const rq = gspan[gspan.length - 1];
          const edgeR = rq[0] * S;
          const NG = Math.max(6, Math.round((TAU * edgeR) / (gillsp * M.gillMul)));
          const baseA = rng() * TAU;
          const gillBias = M.funnel ? -0.04 - Math.min(0.4, sph * 0.55) : -0.04;
          const gillsOn = M.funnel || cph > 0.45;
          for (let g = 0; g < NG && gillsOn; g++) {
            const alpha0 = baseA + (g / NG) * TAU + (rng() - 0.5) * ((0.35 + chaos * 1.3) / NG) * TAU;
            /* fork level: how deep toward the stem this gill reaches */
            let lvl = 0, gg = g;
            while (M.gillFork && gg % 2 === 1 && lvl < 4) { lvl++; gg = (gg - 1) / 2; }
            let reach = M.gillFork ? Math.min(1, 0.26 + lvl * 0.26) : 1;
            reach *= 1 - chaos * 0.3 * hash2(g, 5, kSeed + 61);
            const i0 = Math.round((gspan.length - 1) * (1 - reach));
            const pts = [];
            let gapUntil = -1;
            for (let i = i0; i < gspan.length; i++) {
              const q = gspan[i];
              const tt = (i - i0) / Math.max(1, gspan.length - 1 - i0);
              const dsc = M.gillFork ? 1 : 0.35;
              const drift = ((noise2(tt * 2.2 + g * 0.7, g * 1.3, kSeed + 29) - 0.5) * 0.12 * (1 + chaos * 1.5) * (1 - tt * 0.4)
                + chaos * (noise2(tt * 7.5 + g * 1.9, g * 0.4, kSeed + 31) - 0.5) * 0.045) * dsc;
              const alpha = alpha0 + drift;
              /* stochastic breaks: worn hand-drawn gill texture */
              if (i > gapUntil && chaos > 0 && hash2(g, i, kSeed + 67) < chaos * 0.02) {
                gapUntil = i + 2 + Math.floor(hash2(g, i, kSeed + 71) * 4);
              }
              const d = depthN(alpha, q[4], q[5]);
              if (d > gillBias && i > gapUntil) pts.push(proj(surf(q, alpha)));
              else { if (pts.length > 1) push(pts.splice(0), false); else pts.length = 0; }
              if (used > BUDGET) break;
            }
            if (pts.length > 1) push(pts, false);
            if (used > BUDGET) break;
          }
          /* interstitial dashes between gills - the loose tick marks of a
             hand-drawn hymenium */
          if (gillsOn && chaos > 0.05) {
            const ND = Math.round(NG * chaos * 0.55);
            for (let k2 = 0; k2 < ND; k2++) {
              const alpha0 = rng() * TAU;
              const t0 = 0.25 + rng() * 0.65;
              const i0 = Math.round((gspan.length - 1) * t0);
              const len = 2 + Math.floor(rng() * Math.min(8, gspan.length - i0 - 1));
              const pts = [];
              for (let i = i0; i < Math.min(gspan.length, i0 + len); i++) {
                const q = gspan[i];
                if (depthN(alpha0, q[4], q[5]) > gillBias) pts.push(proj(surf(q, alpha0)));
              }
              if (pts.length > 1) push(pts, false);
              if (used > BUDGET) break;
            }
          }
        }
      }

      /* --- funnel inner wall: ridge lines from the rim down the throat,
         culled by the inner-surface normal so the back side reads when
         looking into the funnel --- */
      if (M.funnel && M.inner && sph > 0.28 && M.gillT) {
        /* densified inner polyline from rim to throat with 2d normals */
        const rimP = M.prof[M.rim];
        const chainI = [[rimP[0], rimP[1], rimP[2]]].concat(M.inner.map((q) => [q[0], q[1], 0.25]));
        const di = [];
        for (let i = 0; i < chainI.length - 1; i++) {
          const a = chainI[i], b = chainI[i + 1];
          const nseg = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.03));
          for (let k = (i === 0 ? 0 : 1); k <= nseg; k++) {
            const t = k / nseg;
            di.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
          }
        }
        for (let i = 0; i < di.length; i++) {
          const a = di[Math.max(0, i - 1)], b = di[Math.min(di.length - 1, i + 1)];
          const dr = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dr, dz) || 1;
          let nr = dz / l, nz = -dr / l;
          if (nr > 0) { nr = -nr; nz = -nz; } /* inner surface faces the axis */
          di[i].push(0, nr, nz);
        }
        const rimR = rimP[0] * S;
        const NI = Math.max(7, Math.round((TAU * rimR) / (gillsp * M.gillMul * 3.4)));
        const baseA2 = mulberry32(kSeed + 57)() * TAU;
        for (let g = 0; g < NI; g++) {
          const alpha0 = baseA2 + (g / NI) * TAU;
          const pts = [];
          const skip = Math.floor(di.length * 0.14);
          let gapU = -1;
          for (let i = skip; i < di.length; i++) {
            const q = di[i];
            if (q[0] < 0.06) break;
            const drift = (noise2(i * 0.08 + g * 0.9, g * 0.6, kSeed + 43) - 0.5) * 0.1 * (1 + chaos * 1.5);
            const alpha = alpha0 + drift;
            if (i > gapU && hash2(g, i, kSeed + 83) < chaos * 0.015) gapU = i + 2 + Math.floor(hash2(g, i, kSeed + 87) * 5);
            if (depthN(alpha, q[4], q[5]) > 0.18 && i > gapU) pts.push(proj(surf(q, alpha)));
            else { if (pts.length > 3) push(pts.splice(0), false); else pts.length = 0; }
            if (used > BUDGET) break;
          }
          if (pts.length > 3) push(pts, false);
          if (used > BUDGET) break;
        }
      }

      /* --- cap contours (bolete, polypore) --- */
      if (M.contours) {
        for (const zc of M.contours) {
          /* find profile sample nearest this z on the cap top side */
          let best = dprof[M.rim ? Math.min(dprof.length - 1, 0) : 0], bd = Infinity;
          for (const q of dprof) {
            if (q[3] < M.rim) continue;
            const d = Math.abs(q[1] - zc);
            if (d < bd) { bd = d; best = q; }
          }
          let seg = [];
          const NA = Math.max(40, Math.ceil((best[0] * S * TAU) / 1.2));
          for (let k = 0; k <= NA; k++) {
            const alpha = (k / NA) * TAU;
            if (depthN(alpha, best[4], best[5]) > 0.03) seg.push(proj(surf(best, alpha)));
            else if (seg.length) { push(seg, false); seg = []; }
          }
          if (seg.length) push(seg, false);
          if (used > BUDGET) break;
        }
      }

      /* --- fly agaric: warts + ring + bulb --- */
      if (M.warts) {
        const NW = 26;
        for (let w = 0; w < NW; w++) {
          const ti = M.rim + 0.15 + rng() * (dprof[dprof.length - 1][3] - M.rim - 0.35);
          let best = dprof[dprof.length - 2], bd = Infinity;
          for (const q of dprof) { const d = Math.abs(q[3] - ti); if (d < bd) { bd = d; best = q; } }
          const alpha = rng() * TAU;
          if (depthN(alpha, best[4], best[5]) < 0.08) continue;
          const cw = surf(best, alpha);
          const pw = proj(cw);
          const wr = S * (0.012 + rng() * 0.014);
          const dots = [];
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * TAU;
            dots.push([pw[0] + Math.cos(a) * wr, pw[1] + Math.sin(a) * wr * (0.55 + 0.45 * sph)]);
          }
          push(dots, true);
        }
      }
      if (M.ring > 0 && p.outlines !== false && cph > 0.45) {
        const zr = M.ring;
        let best = dprof[0], bd = Infinity;
        for (const q of dprof) { if (q[3] > M.rim) continue; const d = Math.abs(q[1] - zr); if (d < bd) { bd = d; best = q; } }
        for (const [mul, dz] of [[2.6, 0], [2.1, -0.045]]) {
          const ringQ = [best[0] * mul, best[1] + dz, 0.05, best[3], 0.5, -0.85];
          let seg = [];
          for (let k = 0; k <= 48; k++) {
            const alpha = (k / 48) * TAU;
            if (depthN(alpha, 0.5, -0.55) > -0.05) seg.push(proj(surf(ringQ, alpha)));
            else if (seg.length) { push(seg, false); seg = []; }
          }
          if (seg.length) push(seg, false);
        }
      }

      /* --- bolete stem reticulation --- */
      if (M.net && cph > 0.45) {
        const [z0, z1] = M.net;
        for (let fam = -1; fam <= 1; fam += 2) {
          for (let k = 0; k < 8; k++) {
            const pts = [];
            let a0 = (k / 8) * TAU;
            for (let t = 0; t <= 12; t++) {
              const z = z0 + ((z1 - z0) * t) / 12;
              let best = dprof[0], bd = Infinity;
              for (const q of dprof) { if (q[3] > M.rim) continue; const d = Math.abs(q[1] - z); if (d < bd) { bd = d; best = q; } }
              const alpha = a0 + fam * (t / 12) * 1.6;
              if (depthN(alpha, 1, 0) > 0.05) pts.push(proj(surf(best, alpha)));
              else if (pts.length > 1) { push(pts.splice(0), false); }
              else pts.length = 0;
            }
            if (pts.length > 1) push(pts, false);
          }
        }
      }

      /* --- stipple cap texture --- */
      if (p.captex === "Stipple") {
        const NP = Math.min(900, Math.round((S * S) / 14));
        const tEnd = dprof[dprof.length - 1][3];
        const tLo = M.funnel ? Math.max(0, M.rim - 1.6) : M.rim;
        const tHi = M.funnel ? M.rim : tEnd;
        for (let k = 0; k < NP; k++) {
          const ti = tLo + rng() * Math.max(0.01, tHi - tLo);
          let best = dprof[dprof.length - 2], bd = Infinity;
          for (const q of dprof) { const d = Math.abs(q[3] - ti); if (d < bd) { bd = d; best = q; } }
          const alpha = rng() * TAU;
          const bias = M.funnel ? -0.05 - sph * 0.5 : 0.05;
          if (depthN(alpha, best[4], best[5]) < bias) continue;
          if (rng() > 0.35 + best[0]) continue; /* area weighting */
          const pw = proj(surf(best, alpha));
          const wr = S * 0.004 * (0.6 + rng());
          const dots = [];
          for (let d2 = 0; d2 < 5; d2++) {
            const a = (d2 / 5) * TAU;
            dots.push([pw[0] + Math.cos(a) * wr, pw[1] + Math.sin(a) * wr]);
          }
          push(dots, true);
          if (used > BUDGET) break;
        }
        /* funnels: stipple the inner cap too - the dense center ring of
           the classic top-view print */
        if (M.funnel && M.inner && sph > 0.25) {
          const NI = Math.min(700, Math.round((S * S) / 16));
          for (let k = 0; k < NI; k++) {
            const seg = Math.min(M.inner.length - 2, Math.floor(rng() * (M.inner.length - 1)));
            const t = rng();
            const a2 = M.inner[seg], b2 = M.inner[seg + 1];
            const rr = a2[0] + (b2[0] - a2[0]) * t;
            const zz = a2[1] + (b2[1] - a2[1]) * t;
            if (rr < 0.02) continue;
            if (rng() > 0.25 + rr * 2) continue;
            const alpha = rng() * TAU;
            if (depthN(alpha, -0.5, 0.85) < 0.05) continue;
            const pw = proj(surf([rr, zz, 0.15], alpha));
            const wr = S * 0.0038 * (0.6 + rng());
            const dots = [];
            for (let d2 = 0; d2 < 5; d2++) {
              const a = (d2 / 5) * TAU;
              dots.push([pw[0] + Math.cos(a) * wr, pw[1] + Math.sin(a) * wr]);
            }
            push(dots, true);
            if (used > BUDGET) break;
          }
        }
      }

      /* --- mesh from the first copy: revolve the closed profile --- */
      if (!meshOut) {
        const closed = [[0, 0, 0]].concat(M.prof.map((q) => q.slice(0, 3)));
        if (M.inner) {
          for (const q of M.inner) closed.push([q[0], q[1], 0.25]);
        }
        const last = closed[closed.length - 1];
        if (last[0] > 1e-4) closed.push([0, last[1], 0]);
        /* densify so sliced contours are smooth */
        const dcl = [];
        for (let i = 0; i < closed.length - 1; i++) {
          const a = closed[i], b = closed[i + 1];
          const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.045));
          for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
            const t = k / n;
            dcl.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
          }
        }
        closed.length = 0;
        for (const q of dcl) closed.push(q);
        const NAm = 40;
        const V = [];
        const P3 = (qi, k) => {
          const alpha = (k / NAm) * TAU;
          const q = closed[qi];
          const r = q[0] * wmod(alpha, q[2], 0, q[1]) + ((q[2] > 0.05 || M.lumpy) ? lump(alpha, q[1]) * q[0] * 2 * (0.7 + chaos) : 0);
          const z = q[1];
          const bend = z * z;
          return [r * Math.cos(alpha) + bx * bend + sway(z), r * Math.sin(alpha) + by * bend + sway2(z), z];
        };
        for (let qi = 0; qi < closed.length - 1; qi++) {
          for (let k = 0; k < NAm; k++) {
            const a = P3(qi, k), b = P3(qi + 1, k), cc = P3(qi + 1, k + 1), d = P3(qi, k + 1);
            V.push(a, b, cc, a, cc, d);
          }
        }
        /* normalize: center bbox, longest dim = 1 */
        let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (const v of V) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], v[i]); mx[i] = Math.max(mx[i], v[i]); }
        const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
        const big = Math.max(ext[0], ext[1], ext[2]) || 1;
        const ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
        const flat = [];
        for (const v of V) for (let i = 0; i < 3; i++) flat.push(Math.round(((v[i] - ctr[i]) / big) * 1e4) / 1e4);
        meshOut = { kind: "mesh", tri: V.length / 3, v: flat, dims: [Math.round((ext[0] / big) * 1e4) / 1e4, Math.round((ext[1] / big) * 1e4) / 1e4, Math.round((ext[2] / big) * 1e4) / 1e4] };
      }
      if (used > BUDGET) break;
    }

    return [applyStyle({ paths }, ins[0]), meshOut];
  },
};
