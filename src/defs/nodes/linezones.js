import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "linezones",
  name: "Line Zones",
  cat: "gen",
  group: "geometric",
  desc: "Op-art line compositions in the Vera Molnár tradition: the canvas is split into rectangular zones (seeded BSP — always splitting the largest zone along its long axis), and every zone is filled with a strict vertical or horizontal grating at a shared pitch. Balance sets the vertical/horizontal mix; a share of zones go Solid (lines at 0.45 mm — pen-width black) and a share go Dither (dashed lines with half-cell offsets forming a checkerboard, plus seeded dropouts for the noisy data-column look). Diagonal cuts truncate a random corner of some zones at 45°, so the line ends form the classic staircase edge. Phase jitter de-syncs the grating between neighbouring zones for the subtle seam, Zone gap leaves a white gutter, and Frame draws a solid border band. Every line stays strictly axis-aligned.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "zones", label: "Zones", type: "slider", min: 2, max: 30, step: 1, def: 9 },
    { key: "pitch", label: "Line pitch mm", type: "slider", min: 0.6, max: 6, step: 0.05, def: 1.3 },
    { key: "balance", label: "Balance V↔H", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "solidP", label: "Solid zones", type: "slider", min: 0, max: 1, step: 0.01, def: 0.15 },
    { key: "ditherP", label: "Dither zones", type: "slider", min: 0, max: 1, step: 0.01, def: 0.25 },
    { key: "cell", label: "Dither cell mm", type: "slider", min: 0.6, max: 4, step: 0.05, def: 1.3 },
    { key: "diag", label: "Diagonal cuts", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "gap", label: "Zone gap mm", type: "slider", min: 0, max: 4, step: 0.1, def: 0.8 },
    { key: "phase", label: "Phase jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 1 },
    { key: "frame", label: "Frame mm", type: "slider", min: 0, max: 15, step: 0.5, def: 5 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 314 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const fr = Math.max(0, p.frame);
    const SOLID_PITCH = 0.45;
    const rng = mulberry32((Math.round(p.seed) || 1) * 631 + 17);
    const L = Math.round(p.layer);
    const paths = [];
    let budget = 130000;
    const push = (pts) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed: false, layer: L });
    };

    /* ---- kehys: umpinauha sisakkaisina suorakaiteina ---- */
    if (fr > 0.3) {
      for (let t = 0.2; t <= fr - 0.2; t += SOLID_PITCH) {
        const x0 = m + t, y0 = m + t, x1 = W - m - t, y1 = H - m - t;
        if (x1 - x0 < 2 || y1 - y0 < 2) break;
        if (budget <= 0) break;
        budget -= 5;
        paths.push({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, layer: L });
      }
    }

    /* ---- BSP: halkaise aina suurin vyohyke pitkan akselin suuntaan ---- */
    const inset = m + (fr > 0.3 ? fr + Math.max(0.6, p.gap) : 0);
    let bx0 = inset, by0 = inset, bx1 = W - inset, by1 = H - inset;
    if (bx1 - bx0 < 15 || by1 - by0 < 15) return applyStyle({ paths }, ins[0]);
    const MINZ = 12;
    const rects = [[bx0, by0, bx1, by1]];
    const target = Math.round(p.zones);
    let guard = 0;
    while (rects.length < target && guard++ < target * 8) {
      let bi = 0, bs = -1;
      for (let i = 0; i < rects.length; i++) {
        const s = Math.max(rects[i][2] - rects[i][0], rects[i][3] - rects[i][1]);
        if (s > bs) { bs = s; bi = i; }
      }
      const [x0, y0, x1, y1] = rects[bi];
      const w = x1 - x0, h = y1 - y0;
      const ratio = 0.32 + rng() * 0.36;
      if (Math.max(w, h) < MINZ * 2.1) break;
      if (w >= h) {
        const cut = x0 + Math.max(MINZ, Math.min(w - MINZ, w * ratio));
        rects.splice(bi, 1, [x0, y0, cut, y1], [cut, y0, x1, y1]);
      } else {
        const cut = y0 + Math.max(MINZ, Math.min(h - MINZ, h * ratio));
        rects.splice(bi, 1, [x0, y0, x1, cut], [x0, cut, x1, y1]);
      }
    }

    /* ---- viivat per vyohyke ---- */
    const g2 = Math.max(0, p.gap) / 2;
    for (const [rx0, ry0, rx1, ry1] of rects) {
      const x0 = rx0 + g2, y0 = ry0 + g2, x1 = rx1 - g2, y1 = ry1 - g2;
      if (x1 - x0 < 2 || y1 - y0 < 2) continue;
      const zr = mulberry32(Math.floor(rx0 * 7 + ry0 * 131 + (Math.round(p.seed) || 1) * 977));
      const isSolid = zr() < p.solidP;
      const isDither = !isSolid && zr() < p.ditherP;
      const vert = zr() < p.balance;
      const pitch = isSolid ? SOLID_PITCH : Math.max(0.4, p.pitch);
      const ph = zr() * pitch * p.phase;

      /* viistoleikkaus: poista kolmio satunnaisesta nurkasta 45-asteessa */
      let cutFn = null;
      if (!isSolid && zr() < p.diag) {
        const corner = Math.floor(zr() * 4); /* 0=TL 1=TR 2=BR 3=BL */
        const s = Math.min(x1 - x0, y1 - y0) * (0.35 + zr() * 0.55);
        /* palauttaa sallitun [lo, hi] valin poikittaisakselilla; null = viiva pois */
        cutFn = (c, isV) => {
          /* c = viivan vakiokoordinaatti (x jos pysty, y jos vaaka) */
          if (isV) {
            let lo = y0, hi = y1;
            if (corner === 0) lo = Math.max(lo, y0 + s - (c - x0));
            if (corner === 1) lo = Math.max(lo, y0 + s - (x1 - c));
            if (corner === 2) hi = Math.min(hi, y1 - s + (x1 - c));
            if (corner === 3) hi = Math.min(hi, y1 - s + (c - x0));
            return hi - lo > 0.3 ? [lo, hi] : null;
          } else {
            let lo = x0, hi = x1;
            if (corner === 0) lo = Math.max(lo, x0 + s - (c - y0));
            if (corner === 3) lo = Math.max(lo, x0 + s - (y1 - c));
            if (corner === 1) hi = Math.min(hi, x1 - s + (c - y0));
            if (corner === 2) hi = Math.min(hi, x1 - s + (y1 - c));
            return hi - lo > 0.3 ? [lo, hi] : null;
          }
        };
      }

      const cell = Math.max(0.4, p.cell);
      const emitLine = (c, i, isV) => {
        let lo = isV ? y0 : x0, hi = isV ? y1 : x1;
        if (cutFn) {
          const span = cutFn(c, isV);
          if (!span) return;
          lo = span[0]; hi = span[1];
        }
        const mk = (a, b) => (isV ? [[c, a], [c, b]] : [[a, c], [b, c]]);
        if (!isDither) {
          push(i % 2 ? mk(hi, lo) : mk(lo, hi));
          return;
        }
        /* dither: shakkiruutu puolisolun offsetilla + kylvetyt pudotukset */
        const dr = mulberry32(Math.floor(c * 53) + i * 7 + (Math.round(p.seed) || 1));
        let t = lo - (i % 2) * cell;
        let on = true;
        while (t < hi) {
          const a = Math.max(lo, t), b = Math.min(hi, t + cell);
          if (on && b - a > 0.15 && dr() > 0.25) push(mk(a, b));
          t += cell;
          on = !on;
        }
      };

      if (vert) {
        let i = 0;
        for (let x = x0 + ph; x <= x1 + 1e-9; x += pitch) emitLine(Math.min(x, x1), i++, true);
      } else {
        let i = 0;
        for (let y = y0 + ph; y <= y1 + 1e-9; y += pitch) emitLine(Math.min(y, y1), i++, false);
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
