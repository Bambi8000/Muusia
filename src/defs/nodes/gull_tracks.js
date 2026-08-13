import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "gull_tracks",
  name: "Gull Tracks",
  cat: "gen",
  group: "creatures",
  desc: "Seagull footprint trails wandering across the sheet - the webbed three-toe prints gulls leave on wet sand. Each trail is a seeded walk that steers itself back inside the margin box; steps alternate left/right foot at Straddle width and each foot turns slightly inward (Toe-in), like the real bird. Every single print is unique: Variation jitters toe angles, lengths, curvatures and the web attach points per print (0 = identical rubber-stamp prints, 1 = wildly individual). Foot size and Toe spread shape the print, Web sag pulls the webbing curve back toward the heel, Hind toe adds the tiny rear hallux mark. Wander bends the walking line, Step length sets the stride. Tip: two or three trails at different Foot sizes on one sheet reads like a whole flock came through; chain into Smudge or Jitter for wet-sand softness.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "trails", label: "Trails", type: "slider", min: 1, max: 12, step: 1, def: 3 },
    { key: "steps", label: "Steps / trail", type: "slider", min: 2, max: 200, step: 1, def: 30 },
    { key: "stride", label: "Step length mm", type: "slider", min: 4, max: 60, step: 0.5, def: 18 },
    { key: "straddle", label: "Straddle mm", type: "slider", min: 0, max: 30, step: 0.5, def: 6 },
    { key: "foot", label: "Foot size mm", type: "slider", min: 2, max: 40, step: 0.5, def: 12 },
    { key: "spread", label: "Toe spread deg", type: "slider", min: 30, max: 140, step: 1, def: 75 },
    { key: "websag", label: "Web sag", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "vary", label: "Variation", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "wander", label: "Wander", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "toein", label: "Toe-in deg", type: "slider", min: 0, max: 25, step: 0.5, def: 8 },
    { key: "hind", label: "Hind toe", type: "check", def: false },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 1 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 2));
    const trails = Math.max(1, Math.min(12, Math.round(p.trails)));
    const steps = Math.max(1, Math.min(300, Math.round(p.steps)));
    const stride = Math.max(1, p.stride);
    const straddle = Math.max(0, p.straddle);
    const S = Math.max(0.5, p.foot);
    const spread = (Math.max(10, Math.min(170, p.spread)) * Math.PI) / 180;
    const sag = Math.max(0, Math.min(1, p.websag));
    const vary = Math.max(0, Math.min(1, p.vary));
    const wander = Math.max(0, Math.min(1, p.wander));
    const toein = (Math.max(0, Math.min(45, p.toein)) * Math.PI) / 180;
    const hind = !!p.hind;
    const seed = Math.round(p.seed);

    /* every print must fit: longest toe (1.12x jitter) x trail scale (1.08x) + half straddle */
    const pad = S * 1.12 * 1.08 + straddle * 0.5 + 0.5;
    const bx0 = m + pad, by0 = m + pad, bx1 = W - m - pad, by1 = H - m - pad;
    if (bx1 - bx0 < 2 || by1 - by0 < 2) return applyStyle({ paths: [] }, ins[0]);
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;

    const paths = [];
    const maxPrints = 4000;
    let printCount = 0;

    /* one footprint; emits exactly 3 paths (4 with hind toe), in this order:
       outer-toe V [tipL, bulgeL, heel, bulgeR, tipR] -> middle toe -> web (-> hind).
       tools/validate-gull_tracks.mjs chunks the output by this contract. */
    const stamp = (hx, hy, footA, SS, rng) => {
      const j = () => (rng() - 0.5) * 2 * vary; /* [-vary, vary] */
      const midLen = SS * (1 + 0.12 * j());
      const lenL = SS * (0.78 + 0.1 * j());
      const lenR = SS * (0.78 + 0.1 * j());
      const angM = footA + spread * 0.09 * j();
      const angL = footA - (spread / 2) * (1 + 0.15 * j());
      const angR = footA + (spread / 2) * (1 + 0.15 * j());
      const tip = (a, l) => [hx + Math.cos(a) * l, hy + Math.sin(a) * l];
      const tipM = tip(angM, midLen), tipL = tip(angL, lenL), tipR = tip(angR, lenR);
      /* slight per-toe curvature: midpoint pushed off the toe axis */
      const bulge = (t, a, l, amt) => {
        const mxp = hx + Math.cos(a) * l * 0.5, myp = hy + Math.sin(a) * l * 0.5;
        return [mxp - Math.sin(a) * amt, myp + Math.cos(a) * amt];
      };
      const bL = bulge(tipL, angL, lenL, SS * 0.08 * j());
      const bR = bulge(tipR, angR, lenR, SS * 0.08 * j());
      const bM = bulge(tipM, angM, midLen, SS * 0.08 * j());
      paths.push({ pts: [tipL, bL, [hx, hy], bR, tipR], closed: false, layer: L });
      paths.push({ pts: [[hx, hy], bM, tipM], closed: false, layer: L });
      /* webbing: two quadratic arcs sagging toward the heel */
      const att = (a, l, f) => tip(a, l * f);
      const wL = att(angL, lenL, 0.88 + 0.06 * j());
      const wM = att(angM, midLen, 0.88 + 0.06 * j());
      const wR = att(angR, lenR, 0.88 + 0.06 * j());
      const pull = 0.15 + 0.75 * sag + 0.08 * j();
      const web = [];
      const quad = (A, B, skipFirst) => {
        const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        const C = [mid[0] + (hx - mid[0]) * pull, mid[1] + (hy - mid[1]) * pull];
        const n = 8;
        for (let i = skipFirst ? 1 : 0; i <= n; i++) {
          const t = i / n, u = 1 - t;
          web.push([u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]]);
        }
      };
      quad(wL, wM, false);
      quad(wM, wR, true);
      paths.push({ pts: web, closed: false, layer: L });
      if (hind) {
        const ha = footA + Math.PI + 0.4 * j();
        const hl = SS * 0.18 * (1 + 0.4 * j());
        paths.push({ pts: [[hx, hy], [hx + Math.cos(ha) * hl, hy + Math.sin(ha) * hl]], closed: false, layer: L });
      }
    };

    for (let ti = 0; ti < trails; ti++) {
      const tRng = mulberry32(seed * 7919 + ti * 613 + 17);
      const scale = 1 + (tRng() - 0.5) * 0.16 * vary; /* birds differ a bit */
      let x = bx0 + tRng() * (bx1 - bx0);
      let y = by0 + tRng() * (by1 - by0);
      let a = tRng() * Math.PI * 2;
      const bias = (tRng() - 0.5) * 0.1 * wander;
      for (let k = 0; k < steps; k++) {
        if (printCount >= maxPrints) break;
        const side = k % 2 === 0 ? 1 : -1;
        const nx0 = -Math.sin(a), ny0 = Math.cos(a);
        const fx = x + nx0 * (straddle / 2) * side;
        const fy = y + ny0 * (straddle / 2) * side;
        const footA = a - side * toein;
        const pRng = mulberry32(seed * 7919 + ti * 613 + k * 31 + 5);
        stamp(fx, fy, footA, S * scale, pRng);
        printCount++;
        a += bias + (noise2(k * 0.17, ti * 13.7, seed * 3 + 7) - 0.5) * 2 * wander * 0.55;
        let nxp = x + Math.cos(a) * stride, nyp = y + Math.sin(a) * stride;
        let tries = 0;
        while ((nxp < bx0 || nxp > bx1 || nyp < by0 || nyp > by1) && tries < 4) {
          a = Math.atan2(cy - y, cx - x) + (tRng() - 0.5) * 0.6;
          nxp = x + Math.cos(a) * stride;
          nyp = y + Math.sin(a) * stride;
          tries++;
        }
        x = Math.max(bx0, Math.min(bx1, nxp));
        y = Math.max(by0, Math.min(by1, nyp));
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
