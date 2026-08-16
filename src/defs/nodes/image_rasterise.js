import { Pin, EMPTY, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "image_rasterise",
  name: "Image Rasterise",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  imageMax: 480,
  desc: "Loads a photo and separates it into classic CMYK halftone screens, each plate drawn with its own pen at its own screen angle - the standard 15/75/0/45 rosette by default. Dot style picks the plotter rendering: Dots (single circles sized by density), Rings (concentric circles), Spiral (ink-coverage spirals), or Dashes (a cheap line screen, best for large sheets). Print-defect controls make it art: Misregistration shifts each plate in a seeded direction, Plate skew rotates plates slightly, Dot gain fattens every dot like an over-inked press, Doubling prints each dot twice with a ghost offset (slur), and Ink noise adds per-dot density jitter. Angles set to Standard is a one-click reset that ignores the four angle sliders; switch to Custom to steer them (equal angles on two plates = instant moire). Black (GCR) controls how much gray is pulled into the K plate. Cell is the raster pitch in mm - raise it if the point budget truncates (plates draw K first, so a truncation eats yellow, not black). This node opts into a 480 px image intake (other fileImage nodes keep the 160 px default, so their output is unchanged). Needs an app build that stores RGB in the image intake; photos loaded with an older build fall back to a grayscale K-only separation until re-loaded.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "cell", label: "Cell mm", type: "slider", min: 1, max: 10, step: 0.1, def: 4.5 },
    { key: "dotstyle", label: "Dot style", type: "select", options: ["Dots", "Rings", "Spiral", "Dashes"], def: "Dots" },
    { key: "scale", label: "Dot scale", type: "slider", min: 0.5, max: 1.5, step: 0.05, def: 1.05 },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.08 },
    { key: "black", label: "Black (GCR)", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
    { key: "angles", label: "Angles", type: "select", options: ["Standard (15/75/0/45)", "Custom"], def: "Standard (15/75/0/45)" },
    { key: "angC", label: "Cyan angle", type: "slider", min: 0, max: 90, step: 0.5, def: 15, showIf: (p) => p.angles === "Custom" },
    { key: "angM", label: "Magenta angle", type: "slider", min: 0, max: 90, step: 0.5, def: 75, showIf: (p) => p.angles === "Custom" },
    { key: "angY", label: "Yellow angle", type: "slider", min: 0, max: 90, step: 0.5, def: 0, showIf: (p) => p.angles === "Custom" },
    { key: "angK", label: "Black angle", type: "slider", min: 0, max: 90, step: 0.5, def: 45, showIf: (p) => p.angles === "Custom" },
    { key: "misreg", label: "Misregistration", type: "slider", min: 0, max: 8, step: 0.05, def: 0.6 },
    { key: "skew", label: "Plate skew deg", type: "slider", min: 0, max: 3, step: 0.05, def: 0 },
    { key: "dotgain", label: "Dot gain", type: "slider", min: 0.5, max: 2, step: 0.05, def: 1 },
    { key: "doubling", label: "Doubling", type: "slider", min: 0, max: 2, step: 0.05, def: 0 },
    { key: "noise", label: "Ink noise", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "plates", label: "Plates", type: "select", options: ["CMYK", "CMY", "CM", "K only"], def: "CMYK" },
    { key: "penC", label: "Cyan pen", type: "pen", def: 11 },
    { key: "penM", label: "Magenta pen", type: "pen", def: 7 },
    { key: "penY", label: "Yellow pen", type: "pen", def: 10 },
    { key: "penK", label: "Black pen", type: "pen", def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 41 },
  ],

  _fitBox(p, ctx, img) {
    const m = Math.max(0, p.margin);
    const boxW = ctx.W - 2 * m, boxH = ctx.H - 2 * m;
    if (boxW < 5 || boxH < 5 || !img) return null;
    const sc = Math.min(boxW / img.w, boxH / img.h);
    const iw = img.w * sc, ih = img.h * sc;
    return { sc, iw, ih, ox: (ctx.W - iw) / 2, oy: (ctx.H - ih) / 2 };
  },

  _sampler(img, fit) {
    const hasRGB = img.rgb && img.rgb.length === img.w * img.h * 3;
    const at = (a, b, k) => {
      if (a < 0 || b < 0 || a >= img.w || b >= img.h) return 1;
      if (hasRGB) return img.rgb[(b * img.w + a) * 3 + k] / 255;
      return 1 - (img.g[b * img.w + a] || 0);
    };
    return (x, y) => {
      const u = (x - fit.ox) / fit.sc - 0.5, v = (y - fit.oy) / fit.sc - 0.5;
      const iu = Math.floor(u), iv = Math.floor(v);
      const fu = u - iu, fv = v - iv;
      const out = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        out[k] =
          at(iu, iv, k) * (1 - fu) * (1 - fv) + at(iu + 1, iv, k) * fu * (1 - fv) +
          at(iu, iv + 1, k) * (1 - fu) * fv + at(iu + 1, iv + 1, k) * fu * fv;
      }
      return out;
    };
  },

  _separate(rgb, mode, black) {
    const r = rgb[0], g = rgb[1], b = rgb[2];
    const cl = (v) => Math.max(0, Math.min(1, v));
    if (mode === "K only") return [0, 0, 0, cl(1 - (0.299 * r + 0.587 * g + 0.114 * b))];
    if (mode === "CMY") return [cl(1 - r), cl(1 - g), cl(1 - b), 0];
    if (mode === "CM") return [cl(1 - r), cl(1 - g), 0, 0];
    const k = cl(black * (1 - Math.max(r, g, b)));
    const den = 1 - k;
    if (den < 0.02) return [0, 0, 0, k];
    return [cl((1 - r - k) / den), cl((1 - g - k) / den), cl((1 - b - k) / den), k];
  },

  _angles(p) {
    return p.angles === "Custom" ? [p.angC, p.angM, p.angY, p.angK] : [15, 75, 0, 45];
  },

  overlay(p, ctx, ins, node) {
    try {
      const m = Math.max(0, p.margin);
      const g = [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
      const img = node && node.data && node.data.img;
      const fit = this._fitBox(p, ctx, img);
      if (fit) g.push({ kind: "rect", x: fit.ox, y: fit.oy, w: fit.iw, h: fit.ih });
      return g;
    } catch (e) {
      return [];
    }
  },

  compute(ins, p, ctx, node) {
    const img = node && node.data && node.data.img;
    if (!img || !img.g) return applyStyle(EMPTY, ins[0]);
    const fit = this._fitBox(p, ctx, img);
    if (!fit) return applyStyle(EMPTY, ins[0]);
    const seedI = Math.round(p.seed);
    const cell = Math.max(0.6, p.cell);
    const pens = [p.penC, p.penM, p.penY, p.penK].map((v) => Math.max(0, Math.min(11, Math.round(v))));
    const platesMap = { CMYK: [3, 0, 1, 2], CMY: [0, 1, 2], CM: [0, 1], "K only": [3] };
    const plates = platesMap[p.plates] || [0, 1, 2, 3];
    const angs = this._angles(p);
    const sample = this._sampler(img, fit);
    const cxm = fit.ox + fit.iw / 2, cym = fit.oy + fit.ih / 2;
    const pr = mulberry32(seedI * 7919 + 401);
    const plateOff = [], plateRot = [], dblDir = [];
    for (let c = 0; c < 4; c++) {
      const a = pr() * Math.PI * 2;
      const mg = p.misreg * (0.35 + 0.65 * pr());
      plateOff.push([Math.cos(a) * mg, Math.sin(a) * mg]);
      plateRot.push(((pr() - 0.5) * 2 * p.skew * Math.PI) / 180);
      const da = pr() * Math.PI * 2;
      dblDir.push([Math.cos(da) * p.doubling, Math.sin(da) * p.doubling]);
    }
    const gainR = Math.max(0.1, p.dotgain);
    const Rmax = 0.5 * cell * Math.max(0.1, p.scale) * gainR;
    const paths = [];
    let total = 0, full = false;
    const emit = (pts, closed, layer) => {
      if (total + pts.length > 115000) { full = true; return; }
      total += pts.length;
      paths.push({ pts, closed, layer });
    };
    const circle = (cx, cy, r, layer) => {
      const n = Math.max(6, Math.min(24, Math.round(r * 5) + 5));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      emit(pts, true, layer);
    };
    for (const c of plates) {
      if (full) break;
      const th = (angs[c] * Math.PI) / 180;
      const ux = Math.cos(th), uy = Math.sin(th);
      const rc = Math.cos(plateRot[c]), rs = Math.sin(plateRot[c]);
      const R = Math.hypot(fit.iw, fit.ih) / 2 + cell;
      const N = Math.ceil(R / cell);
      for (let i = -N; i <= N && !full; i++) {
        for (let j = -N; j <= N && !full; j++) {
          const px = cxm + ux * (i * cell) - uy * (j * cell);
          const py = cym + uy * (i * cell) + ux * (j * cell);
          if (px < fit.ox || px > fit.ox + fit.iw || py < fit.oy || py > fit.oy + fit.ih) continue;
          let dens = this._separate(sample(px, py), p.plates, p.black)[c];
          dens = Math.pow(Math.max(0, Math.min(1, dens)), Math.max(0.1, p.gamma));
          if (p.noise > 0) dens += (hash2(i * 7 + 3, j * 11 + c * 5 + 1, seedI + 61) - 0.5) * p.noise;
          dens = Math.max(0, Math.min(1, dens));
          if (dens <= p.cutoff) continue;
          const rx = px - cxm, ry = py - cym;
          const dx = cxm + rx * rc - ry * rs + plateOff[c][0];
          const dy = cym + rx * rs + ry * rc + plateOff[c][1];
          const spots = p.doubling > 0 ? [[dx, dy], [dx + dblDir[c][0], dy + dblDir[c][1]]] : [[dx, dy]];
          for (const [sx, sy] of spots) {
            if (full) break;
            if (p.dotstyle === "Dots") {
              const r = Rmax * Math.sqrt(dens);
              if (r >= 0.15) circle(sx, sy, r, pens[c]);
            } else if (p.dotstyle === "Rings") {
              const nr = Math.max(1, Math.round(dens * Math.max(1, Math.floor(Rmax / 0.5))));
              for (let q = 1; q <= nr && !full; q++) circle(sx, sy, (Rmax * q) / nr, pens[c]);
            } else if (p.dotstyle === "Spiral") {
              const turns = 0.4 + dens * 2.6;
              const len = Math.PI * Rmax * turns;
              const n = Math.max(8, Math.min(64, Math.round(len / 0.9)));
              const pts = [];
              for (let k = 0; k <= n; k++) {
                const t = k / n;
                const a = th + t * turns * Math.PI * 2;
                pts.push([sx + Math.cos(a) * Rmax * t, sy + Math.sin(a) * Rmax * t]);
              }
              emit(pts, false, pens[c]);
            } else {
              const len = Math.min(cell * 1.3, dens * cell * Math.max(0.1, p.scale) * gainR);
              if (len < 0.25) continue;
              const hx = (ux * len) / 2, hy = (uy * len) / 2;
              const flip = (i + j) & 1;
              const pts = flip
                ? [[sx + hx, sy + hy], [sx - hx, sy - hy]]
                : [[sx - hx, sy - hy], [sx + hx, sy + hy]];
              emit(pts, false, pens[c]);
            }
          }
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
