import { Pin, EMPTY, noise2, applyStyle } from "../helpers.js";

export default {
  key: "retromesh",
  name: "Retro Mesh",
  cat: "gen",
  group: "geometric",
  desc: "80s diagram wireframes in true perspective. Hourglass is the wormhole double funnel (rings + meridian spokes flaring from a shared throat), Funnel and Horn are its single-ended siblings — Flare bends the profile, Throat sets the neck-to-mouth ratio, Height stretches it. Laser floor is the synthwave grid plane receding to a vanishing point, with Terrain raising noise mountains that leave a flat corridor down the middle and an optional Horizon line. Perspective goes from near-orthographic to wide-angle drama, Rot X tilts, Rot Y spins. Everything is drawn transparent (no hidden-line removal), matching the retro print look — pair with Solids for a planet disc in the throat.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Shape", type: "select", options: ["Hourglass", "Funnel", "Horn", "Laser floor"], def: "Hourglass" },
    { key: "size", label: "Size", type: "slider", min: 20, max: 280, step: 1, def: 170 },
    { key: "rings", label: "Rings / rows", type: "slider", min: 3, max: 40, step: 1, def: 9 },
    { key: "spokes", label: "Spokes / cols", type: "slider", min: 4, max: 48, step: 1, def: 16 },
    { key: "flare", label: "Flare", type: "slider", min: 0.5, max: 4, step: 0.05, def: 2 },
    { key: "throat", label: "Throat", type: "slider", min: 0.05, max: 0.9, step: 0.01, def: 0.28 },
    { key: "height", label: "Height", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1.3 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "terrain", label: "Terrain (floor)", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "horizon", label: "Horizon line", type: "check", def: true },
    { key: "rx", label: "Rot X", type: "slider", min: -90, max: 90, step: 1, def: 10 },
    { key: "ry", label: "Rot Y", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 6 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const seed = Math.round(p.seed) || 1;
    const size = Math.max(10, p.size);
    const nR = Math.max(2, Math.round(p.rings));
    const nS = Math.max(3, Math.round(p.spokes));
    const flare = Math.max(0.2, p.flare);
    const throat = Math.max(0.02, Math.min(0.95, p.throat));
    const hgt = Math.max(0.1, p.height);
    const persp = Math.max(0, Math.min(1, p.persp));
    const layer = Math.round(p.layer);
    const TAU = Math.PI * 2;
    const fbm2 = (x, y, s) => noise2(x, y, s) * 0.6 + noise2(x * 2.3 + 5, y * 2.3 + 9, s + 7) * 0.4;

    // ---- build world-space polylines per mode (unit-ish scale) ----
    const lines = []; // { pts: [[x,y,z],...], closed }
    const prof = (t) => throat + (1 - throat) * Math.pow(t, flare); // radius along a funnel half
    if (p.mode !== "Laser floor") {
      const halves = p.mode === "Hourglass" ? [-1, 1] : [1];
      const hh = p.mode === "Hourglass" ? hgt / 2 : hgt;
      for (const sgn of halves) {
        const rj = p.mode === "Hourglass" ? nR : nR; // rings per half
        for (let j = 0; j <= rj; j++) {
          const t = j / rj;
          const r = p.mode === "Horn" ? throat + (1 - throat) * (Math.exp(flare * t) - 1) / (Math.exp(flare) - 1) : prof(t);
          const y = -sgn * t * hh; // world y up = -screen
          const ring = [];
          const nA = 96;
          for (let k = 0; k < nA; k++) {
            const a = (k / nA) * TAU;
            ring.push([Math.cos(a) * r, y, Math.sin(a) * r]);
          }
          lines.push({ pts: ring, closed: true });
        }
        for (let s = 0; s < nS; s++) {
          const a = (s / nS) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          const mer = [];
          for (let j = 0; j <= 48; j++) {
            const t = j / 48;
            const r = p.mode === "Horn" ? throat + (1 - throat) * (Math.exp(flare * t) - 1) / (Math.exp(flare) - 1) : prof(t);
            mer.push([ca * r, -sgn * t * hh, sa * r]);
          }
          lines.push({ pts: mer, closed: false });
        }
      }
    } else {
      // laser floor: grid plane below the camera, receding in +z
      const Wg = 4, z0 = 0.7, z1 = 6;
      const terr = Math.max(0, p.terrain);
      const hAt = (x, z) => {
        if (terr <= 0) return 0;
        const corridor = Math.min(1, Math.max(0, (Math.abs(x) - 0.45) / 0.9));
        return -terr * 0.9 * corridor * Math.pow(fbm2(x * 1.3 + 7, z * 1.3 + 3, seed * 3 + 1), 1.5);
      };
      for (let j = 0; j <= nR; j++) {
        const z = z0 + (j / nR) * (z1 - z0);
        const row = [];
        for (let k = 0; k <= 80; k++) {
          const x = -Wg / 2 + (k / 80) * Wg;
          row.push([x, 0.9 + hAt(x, z), z]);
        }
        lines.push({ pts: row, closed: false });
      }
      for (let s = 0; s <= nS; s++) {
        const x = -Wg / 2 + (s / nS) * Wg;
        const col = [];
        for (let j = 0; j <= 64; j++) {
          const z = z0 + (j / 64) * (z1 - z0);
          col.push([x, 0.9 + hAt(x, z), z]);
        }
        lines.push({ pts: col, closed: false });
      }
    }

    // ---- rotate, perspective-project, cull behind camera, fit ----
    const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180;
    const cX = Math.cos(ax), sX = Math.sin(ax), cY = Math.cos(ay), sY = Math.sin(ay);
    const camD = p.mode === "Laser floor" ? 0 : (2.2 + (1 - persp) * 7) * Math.max(1, hgt / 2 + 0.5);
    const fl = p.mode === "Laser floor" ? 1 : (2.2 + (1 - persp) * 7);
    const proj = (v) => {
      let x = v[0] * cY + v[2] * sY, y = v[1], z = -v[0] * sY + v[2] * cY;
      const y2 = y * cX - z * sX, z2 = y * sX + z * cX;
      const zc = z2 + camD;
      if (zc < 0.15) return null;
      const k = p.mode === "Laser floor" ? 1 / zc : fl / zc;
      return [x * k, y2 * k];
    };
    const runs = [];
    for (const ln of lines) {
      const P = ln.closed ? [...ln.pts, ln.pts[0]] : ln.pts;
      let cur = [];
      let all = true;
      for (const q of P) {
        const pr = proj(q);
        if (pr) cur.push(pr);
        else {
          all = false;
          if (cur.length >= 2) runs.push({ pts: cur, closed: false });
          cur = [];
        }
      }
      if (cur.length >= 2) {
        if (ln.closed && all) { cur.pop(); runs.push({ pts: cur, closed: true }); }
        else runs.push({ pts: cur, closed: false });
      }
    }
    if (p.mode === "Laser floor" && p.horizon) {
      // horizon = projection of a very distant point on the ground plane's center line
      const pr = proj([0, 0.9, 4000]);
      if (pr) runs.push({ pts: [[-2.4, pr[1]], [2.4, pr[1]]], closed: false });
    }
    if (!runs.length) return applyStyle(EMPTY, ins[0]);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const r of runs) for (const [x, y] of r.pts) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const s = size / Math.max(x1 - x0, y1 - y0, 1e-6);
    const ox = W / 2 - (s * (x0 + x1)) / 2, oy = H / 2 - (s * (y0 + y1)) / 2;
    const clampP = (v, lim) => Math.min(lim - 0.2, Math.max(0.2, v));
    const paths = runs.map((r) => ({
      pts: r.pts.map(([x, y]) => [clampP(x * s + ox, W), clampP(y * s + oy, H)]),
      closed: !!r.closed, layer,
    })).filter((pp) => pp.pts.length >= 2);
    return applyStyle({ paths }, ins[0]);
  },
};
