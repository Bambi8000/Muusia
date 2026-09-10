import { Pin, mulberry32, resample, applyStyle } from "../helpers.js";

export default {
  /* TV Antennas — the Mediterranean rooftop forest: tall thin masts carrying
   * SEVERAL different antennas stacked at heights, planted along a wired
   * Roofline path (or a baseline when unwired).
   *
   * The mast is the unit, not the antenna. Each mast draws 1..Heads heads at
   * descending heights, and every head rolls its own type, size, boom tilt
   * and a foreshortening factor (elements 30-100% length, as if seen from a
   * different angle) — so no two antennas are copies. Vary drives the
   * diversity: mast heights spread 0.5x-2.2x, sizes and angles scatter.
   *
   * Head types, from the real hardware: Yagi (longest reflector at the back,
   * folded-dipole loop, directors shrinking toward the front), Log-periodic
   * (geometric ladder, swept forward), VHF/UHF combo (long back elements,
   * corner-reflector V, tight UHF run), Panel (mesh grid with X-brace and
   * rungs — the classic UHF panel), FM star (radial-spoke turnstile on the
   * mast top), Dish (offset ellipse rim, feed arm, LNB blob). In Mixed, a
   * share of sites become DISH CLUSTERS on short stubs at parapet level
   * while the masts tower above — the skyline in every Rome photo.
   *
   * Braces "Struts" leans 1-2 single diagonal poles against the mast
   * (asymmetric, like the photos); "Guys" ties a symmetric wire pair.
   * Cables hangs catenaries between neighbouring mast tops and drops some
   * to the roof. Style "Cartoon" adds Wonk: bowed booms, jittered element
   * lengths, dot-capped tips, double-line masts, jaunty leans.
   *
   * Orientation "Up" keeps masts vertical whatever the roof slope (what
   * gravity does); Aim "Same way" points the neighbourhood at one
   * transmitter. A mast whose ink would leave the canvas retries at 0.72x
   * and 0.5x height before being skipped, so tall skylines stay dense and
   * edges stay clean. Roofline paths pass through untouched — this node
   * only ADDS ink; Merge it with the roofline branch.
   */

  key: "antenna",
  name: "TV Antennas",
  cat: "gen",
  group: "structural",
  desc: "The analog-era rooftop antenna forest planted along a wired Roofline path (baseline when unwired). Masts carry 1..Heads stacked heads and every head rolls its own type, size, boom tilt and element foreshortening, so no two antennas are copies; Vary spreads mast heights 0.5x-2.2x. Types: Yagi, Log-periodic, VHF/UHF combo, mesh Panel with X-brace, radial FM star, satellite Dish - and Mixed turns a share of sites into parapet-level dish clusters under towering masts. Braces lean diagonal struts or tie guy wires, Cables hangs catenaries between mast tops, Cartoon's Wonk bows booms and caps tips with dots. Oversized masts retry shorter before skipping, keeping edges clean.",
  ins: [Pin("paths", "Roofline"), Pin("style", "Style")],
  outs: [Pin("paths")],

  params: [
    { key: "type", label: "Type", type: "select", options: ["Mixed", "Yagi", "Log-periodic", "VHF/UHF combo", "Panel", "FM star", "Dish"], def: "Mixed" },
    { key: "style", label: "Style", type: "select", options: ["Accurate", "Cartoon"], def: "Accurate" },
    { key: "wonk", label: "Wonk", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5, showIf: (p) => p.style === "Cartoon" },
    { key: "spacing", label: "Spacing mm", type: "slider", min: 12, max: 120, step: 1, def: 34 },
    { key: "density", label: "Density %", type: "slider", min: 10, max: 100, step: 1, def: 90 },
    { key: "mast", label: "Mast mm", type: "slider", min: 8, max: 90, step: 0.5, def: 44 },
    { key: "heads", label: "Heads / mast", type: "slider", min: 1, max: 4, step: 1, def: 3 },
    { key: "vary", label: "Vary", type: "slider", min: 0, max: 1, step: 0.05, def: 0.7 },
    { key: "size", label: "Size mm", type: "slider", min: 6, max: 50, step: 0.5, def: 20 },
    { key: "elems", label: "Elements", type: "slider", min: 2, max: 10, step: 1, def: 6, showIf: (p) => p.type !== "Dish" && p.type !== "Panel" && p.type !== "FM star" },
    { key: "tilt", label: "Tilt \u00b0", type: "slider", min: -25, max: 25, step: 1, def: 0 },
    { key: "orient", label: "Orientation", type: "select", options: ["Up", "Path normal"], def: "Up" },
    { key: "aim", label: "Aim", type: "select", options: ["Same way", "Random"], def: "Same way" },
    { key: "braces", label: "Braces", type: "select", options: ["Off", "Struts", "Guys"], def: "Struts" },
    { key: "cables", label: "Cables", type: "select", options: ["Off", "On"], def: "On" },
    { key: "baseY", label: "Base Y % (unwired)", type: "slider", min: 10, max: 95, step: 1, def: 70 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],

  compute(ins, p, ctx) {
    const W = Math.max(1, Number(ctx && ctx.W) || 420), Hh = Math.max(1, Number(ctx && ctx.H) || 297);
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const rng = mulberry32(p.seed);
    const cr = mulberry32((p.seed ^ 0x9e3779b9) >>> 0); /* cable stream */
    const cartoon = p.style === "Cartoon";
    const w = cartoon ? Math.max(0, Math.min(1, Number(p.wonk) || 0)) : 0;
    const v = Math.max(0, Math.min(1, Number(p.vary) == null ? 0.7 : Number(p.vary)));
    const HEADPOOL = ["Yagi", "Log-periodic", "VHF/UHF combo", "Panel", "FM star"];
    const globalAim = rng() < 0.5 ? -1 : 1;

    const src = ins[0];
    const wired = src && src.paths && src.paths.length;
    const yb = (Hh * Math.max(10, Math.min(95, Number(p.baseY) || 70))) / 100;
    const lines = wired
      ? src.paths.filter((q) => q.pts && q.pts.length > 1)
      : [{ pts: [[12, yb], [W - 12, yb]], closed: false }];
    const step = Math.max(4, Number(p.spacing) || 34);

    const BUDGET = 110000;
    let total = 0;
    const paths = [];
    const emit = (pts, closed) => {
      if (total + pts.length > BUDGET) return false;
      total += pts.length;
      paths.push({ pts, closed: !!closed, layer: pen });
      return true;
    };
    const inCanvas = (pts) => pts.every(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= Hh);

    for (const path of lines) {
      const rpts = resample(path.pts, !!path.closed, step);
      const tops = [], anchors = []; /* for cables, world coords */

      for (let si = 0; si < rpts.length; si++) {
        if (!wired && si === 0) continue;
        if (rng() * 100 > p.density) continue;
        const siteSeed = Math.floor(rng() * 2147483647);

        /* local frame: origin at the anchor, +y up, +x forward (aim) */
        const a0 = rpts[Math.max(0, si - 1)], a1 = rpts[Math.min(rpts.length - 1, si + 1)];
        let ux = 0, uy = -1;
        if (p.orient === "Path normal") {
          const tx = a1[0] - a0[0], ty = a1[1] - a0[1], tl = Math.hypot(tx, ty);
          if (tl > 1e-9) { ux = ty / tl; uy = -tx / tl; if (uy > 0) { ux = -ux; uy = -uy; } }
        }

        /* build at shrinking scales until the ink fits the canvas */
        for (const sc of [1, 0.72, 0.5]) {
          const sr = mulberry32(siteSeed);
          const buf = [];
          const seg = (pts, closed) => buf.push({ pts, closed: !!closed });

          const lean = (p.tilt * Math.PI) / 180 +
            (cartoon ? (sr() - 0.5) * 2 * 0.26 * w : (sr() - 0.5) * 0.07 * v);
          const cl = Math.cos(lean), sl = Math.sin(lean);
          const Ux = ux * cl - uy * sl, Uy = ux * sl + uy * cl;
          const Rx = -Uy, Ry = Ux;
          const aim = p.aim === "Random" ? (sr() < 0.5 ? -1 : 1) : globalAim;
          const P = (lx, ly) => [rpts[si][0] + Rx * lx * aim + Ux * ly, rpts[si][1] + Ry * lx * aim + Uy * ly];

          const dishClusterSite = p.type === "Mixed" && sr() < 0.24;
          const hu = sr();
          const mastH = dishClusterSite || p.type === "Dish"
            ? Math.max(3, p.mast * sc * (0.16 + 0.14 * sr()))
            : Math.max(4, p.mast * sc * (1 + v * (0.5 + 1.7 * hu * hu - 1)));

          /* mast (cartoon: double line) */
          seg([[0, 0], [0, mastH]], false);
          if (cartoon) seg([[0.7, 0], [0.7, mastH * 0.97]], false);

          /* one antenna head at height hy: own tilt, size, foreshortening */
          const head = (t, hy, L, nE) => {
            const bt = (sr() - 0.5) * 2 * 0.30 * (0.15 + 0.85 * v) + (cartoon ? (sr() - 0.5) * 0.3 * w : 0);
            const cb = Math.cos(bt), sb = Math.sin(bt);
            const fore = 1 - 0.68 * v * sr(); /* element foreshortening */
            const hp = (hx, hyRel) => [hx * cb - hyRel * sb, hy + hyRel * cb + hx * sb];
            const hseg = (pts, closed) => seg(pts.map(([hx, hyRel]) => hp(hx, hyRel)), closed);
            const bow = cartoon ? (sr() - 0.5) * 2 * 0.14 * w * L : 0;
            const boomY = (bx) => -bow * Math.sin((Math.PI * (bx + L * 0.35)) / L);
            const boom = (x0, x1) => {
              const n = bow ? 7 : 1, pts2 = [];
              for (let k = 0; k <= n; k++) { const bx = x0 + ((x1 - x0) * k) / n; pts2.push([bx, boomY(bx)]); }
              hseg(pts2, false);
            };
            const elem = (bx, half, sweep) => {
              const len = half * fore * (1 + (cartoon ? (sr() - 0.5) * 0.5 * w : 0));
              const ang = (sweep || 0) + (cartoon ? (sr() - 0.5) * 0.42 * w : 0);
              const dx = Math.sin(ang), dy = Math.cos(ang), by = boomY(bx);
              hseg([[bx - dx * len, by - dy * len], [bx + dx * len, by + dy * len]], false);
              if (cartoon && w > 0.15) {
                for (const s of [-1, 1]) {
                  const c0 = hp(bx + s * dx * len, by + s * dy * len), r = 0.55, ring = [];
                  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ring.push([c0[0] + Math.cos(a) * r, c0[1] + Math.sin(a) * r]); }
                  seg(ring, true);
                }
              }
            };

            if (t === "Yagi") {
              const back = -L * 0.35, front = L * 0.65;
              boom(back, front);
              elem(back, L * 0.30);
              const dd = back + L * 0.18, dh = L * 0.27 * fore, dwd = Math.max(0.7, L * 0.03);
              hseg([[dd - dwd / 2, boomY(dd) - dh], [dd + dwd / 2, boomY(dd) - dh],
                    [dd + dwd / 2, boomY(dd) + dh], [dd - dwd / 2, boomY(dd) + dh]], true);
              for (let k = 0; k < nE; k++) elem(dd + ((front - dd) * (k + 1)) / nE, L * 0.26 * Math.pow(0.94, k + 1));
            } else if (t === "Log-periodic") {
              const back = -L * 0.3, front = L * 0.7, tau = 0.82;
              boom(back, front);
              for (let k = 0; k < nE; k++) {
                const f = (1 - Math.pow(tau, k + 1)) / (1 - Math.pow(tau, nE));
                elem(back + (front - back) * f, L * 0.30 * Math.pow(tau, k), 0.35);
              }
            } else if (t === "VHF/UHF combo") {
              const back = -L * 0.4, front = L * 0.6, jx = L * 0.12;
              boom(back, front);
              for (let k = 0; k < 3; k++) elem(back + k * L * 0.16, L * 0.30 * Math.pow(0.9, k));
              const vy = L * 0.16 * fore;
              hseg([[jx - vy * 0.7, boomY(jx) - vy], [jx, boomY(jx)], [jx - vy * 0.7, boomY(jx) + vy]], false);
              const nu = Math.max(3, nE);
              for (let k = 0; k < nu; k++) elem(jx + L * 0.07 + (k * (front - jx - L * 0.07)) / nu, L * 0.09);
            } else if (t === "Panel") {
              const gw = L * 0.20 * (0.5 + 0.5 * fore), gh = L * 0.32;
              hseg([[0, 0], [gw * 0.5, 0]], false); /* standoff */
              const x0 = gw * 0.5;
              hseg([[x0, -gh], [x0 + 2 * gw, -gh], [x0 + 2 * gw, gh], [x0, gh]], true);
              hseg([[x0, -gh], [x0 + 2 * gw, gh]], false);
              hseg([[x0, gh], [x0 + 2 * gw, -gh]], false);
              for (let k = 1; k <= 3; k++) { const gy = -gh + (2 * gh * k) / 4; hseg([[x0, gy], [x0 + 2 * gw, gy]], false); }
            } else if (t === "FM star") {
              const R = L * 0.34, r0 = R * 0.14, ring = [];
              for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push([Math.cos(a) * r0, Math.sin(a) * r0]); }
              hseg(ring, true);
              const nS = 10;
              for (let k = 0; k < nS; k++) {
                const a = (k / nS) * Math.PI * 2 + 0.2;
                hseg([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * R * (0.7 + 0.3 * fore), Math.sin(a) * R]], false);
              }
            } else if (t === "Dish") {
              const el = 0.35 + 0.4 * sr() + (cartoon ? (sr() - 0.5) * 0.5 * w : 0);
              const dxb = Math.cos(el), dyb = Math.sin(el);
              const mxa = -dyb, mya = dxb;
              const a2 = L * 0.42, b2 = a2 * (cartoon ? 0.55 : 0.22 + 0.2 * sr());
              const C = [L * 0.06, 0];
              const rim = (scale) => {
                const ring = [];
                for (let k = 0; k < 36; k++) {
                  const a = (k / 36) * Math.PI * 2;
                  ring.push([C[0] + (mxa * Math.cos(a) * a2 + dxb * Math.sin(a) * b2) * scale,
                             C[1] + (mya * Math.cos(a) * a2 + dyb * Math.sin(a) * b2) * scale]);
                }
                return ring;
              };
              hseg(rim(1), true);
              if (!cartoon) hseg(rim(0.8), true);
              const lo = [C[0] - mxa * a2 * 0.86, C[1] - mya * a2 * 0.86];
              const fp = [C[0] + dxb * a2 * 1.05, C[1] + dyb * a2 * 1.05];
              hseg([lo, [lo[0] + dxb * a2 * 0.55, lo[1] + dyb * a2 * 0.55], fp], false);
              const blob = [];
              for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; blob.push([fp[0] + Math.cos(a) * (cartoon ? 1.4 : 0.9), fp[1] + Math.sin(a) * (cartoon ? 1.4 : 0.9)]); }
              hseg(blob, true);
            }
          };

          if (dishClusterSite || p.type === "Dish") {
            const nD = dishClusterSite && sr() < 0.4 ? 2 : 1;
            for (let d = 0; d < nD; d++) {
              const hy = mastH * (1 - d * 0.15);
              head("Dish", hy, Math.max(4, p.size * sc * (0.9 + 0.5 * sr())), 0);
            }
          } else {
            const nH = 1 + Math.floor(sr() * Math.max(1, Math.round(p.heads)));
            let hy = mastH;
            for (let hI = 0; hI < nH && hy > mastH * 0.24; hI++) {
              const t = p.type === "Mixed" ? HEADPOOL[Math.floor(sr() * HEADPOOL.length)] : p.type;
              const L = Math.max(4, p.size * sc * (1 + (sr() - 0.5) * 1.0 * v) * Math.pow(0.85, hI));
              head(t, hy, L, Math.max(2, Math.min(10, Math.round(p.elems) || 6)));
              hy -= mastH * (0.26 + 0.16 * sr());
            }
            if (p.braces === "Struts") {
              const nB = 1 + (sr() < 0.5 ? 1 : 0);
              for (let b = 0; b < nB; b++) {
                const by = mastH * (0.5 + 0.28 * sr());
                const bx = (sr() < 0.5 ? -1 : 1) * mastH * (0.14 + 0.22 * sr());
                seg([[0, by], [bx, 0]], false);
              }
            } else if (p.braces === "Guys") {
              const gy = mastH * 0.75, gs = mastH * 0.5;
              seg([[0, gy], [-gs, 0]], false);
              seg([[0, gy], [gs, 0]], false);
            }
          }

          const world = buf.map((q) => ({ pts: q.pts.map(([lx, ly]) => P(lx, ly)), closed: q.closed }));
          if (world.every((q) => inCanvas(q.pts))) {
            let ok2 = true;
            for (const q of world) if (!emit(q.pts, q.closed)) { ok2 = false; break; }
            if (ok2) { tops.push(P(0, mastH)); anchors.push([rpts[si][0], rpts[si][1]]); }
            if (!ok2) return applyStyle({ paths }, ins[1]);
            break;
          }
        }
      }

      /* cables: catenaries between neighbouring mast tops, some drop to roof */
      if (p.cables === "On") {
        for (let k = 0; k + 1 < tops.length; k++) {
          const roll = cr();
          const t1 = tops[k];
          /* top-to-top only between roughly level neighbours; otherwise the
             cable is a feedline dropping to the roof (the photo look) */
          const level = Math.abs(tops[k + 1][1] - t1[1]) <
            0.35 * Math.hypot(tops[k + 1][0] - t1[0], tops[k + 1][1] - t1[1]);
          const t2 = roll < 0.35 && level ? tops[k + 1] : roll < 0.7 ? anchors[k + 1] : null;
          if (!t2) continue;
          const d = Math.hypot(t2[0] - t1[0], t2[1] - t1[1]);
          if (d < 3 || d > 110) continue;
          const sag = 0.8 + d * 0.035 * (0.6 + 0.8 * cr());
          const pts2 = [];
          for (let q = 0; q <= 10; q++) {
            const u = q / 10;
            pts2.push([t1[0] + (t2[0] - t1[0]) * u, t1[1] + (t2[1] - t1[1]) * u + sag * Math.sin(Math.PI * u)]);
          }
          if (inCanvas(pts2)) { if (!emit(pts2, false)) return applyStyle({ paths }, ins[1]); }
        }
      }
    }
    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx, ins) {
    try {
      const wired = ins && ins[0] && ins[0].paths && ins[0].paths.length;
      if (wired) return [];
      const W = (ctx && ctx.W) || 420, Hh = (ctx && ctx.H) || 297;
      const yb = (Hh * Math.max(10, Math.min(95, Number(p.baseY) || 70))) / 100;
      return [{ kind: "poly", pts: [[12, yb], [W - 12, yb]] }];
    } catch (e) { return []; }
  },
};
