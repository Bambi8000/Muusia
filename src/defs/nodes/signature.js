import { Pin, mulberry32, noise2, resample, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "signature",
  name: "Signature",
  cat: "gen",
  group: "textimg",
  desc: "The artist's mark for a finished plot: name, date and edition number set in the single-stroke font, anchored to a sheet corner so it lands in the same place on every print. Signature text, Date and the Edition selector (n/N, No. n, n of N) are three independent fields; Layout either runs them together on one line with the chosen Separator, splits name from the rest on two lines, or stacks all three. Font is the hand of the mark: Plain is the bare font, Italic leans it, Hand redraws every stroke with seeded tremor plus per-letter tilt, size and baseline drift so it reads as written rather than plotted (Tremor sets how much, Seed picks a different hand). Anchor places the block against a corner at Margin distance with Nudge X/Y for the final millimetres, or Custom for a free position; Rotate turns the whole block, Slant shears the letters. Rule adds an Underline, a Box or Brackets around the block. Keep it on its own pen and plot it last so the mark goes on with a finer nib.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "text", label: "Signature text", type: "text", def: "VIIVAIN/DR" },
    { key: "date", label: "Date", type: "text", def: "2026" },
    { key: "edMode", label: "Edition", type: "select", options: ["None", "n/N", "No. n", "n of N"], def: "n/N" },
    { key: "num", label: "Copy no.", type: "slider", min: 1, max: 500, step: 1, def: 1, showIf: (p) => p.edMode !== "None" },
    { key: "total", label: "Edition size", type: "slider", min: 1, max: 500, step: 1, def: 25, showIf: (p) => p.edMode === "n/N" || p.edMode === "n of N" },
    { key: "font", label: "Font", type: "select", options: ["Plain", "Italic", "Hand"], def: "Plain" },
    { key: "layout", label: "Layout", type: "select", options: ["One line", "Two lines", "Stacked"], def: "One line" },
    { key: "sep", label: "Separator", type: "select", options: ["Dash", "Slash", "Dot", "Space"], def: "Dash" },
    { key: "size", label: "Size mm (cap height)", type: "slider", min: 1.5, max: 40, step: 0.5, def: 4 },
    { key: "track", label: "Tracking %", type: "slider", min: 50, max: 250, step: 1, def: 88 },
    { key: "lineh", label: "Line height %", type: "slider", min: 90, max: 300, step: 1, def: 170, showIf: (p) => p.layout !== "One line" },
    { key: "align", label: "Align", type: "select", options: ["Left", "Center", "Right"], def: "Right", showIf: (p) => p.layout !== "One line" },
    { key: "slant", label: "Slant deg", type: "slider", min: -30, max: 30, step: 1, def: 0 },
    { key: "tremor", label: "Tremor", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4, showIf: (p) => p.font === "Hand" },
    { key: "anchor", label: "Anchor", type: "select", options: ["Bottom right", "Bottom center", "Bottom left", "Top left", "Top right", "Center", "Custom"], def: "Bottom right" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 80, step: 0.5, def: 12 },
    { key: "px", label: "Pos X mm", type: "slider", min: 0, max: 400, step: 1, def: 20, showIf: (p) => p.anchor === "Custom" },
    { key: "py", label: "Pos Y mm", type: "slider", min: 0, max: 400, step: 1, def: 40, showIf: (p) => p.anchor === "Custom" },
    { key: "offX", label: "Nudge X mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
    { key: "offY", label: "Nudge Y mm", type: "slider", min: -80, max: 80, step: 0.5, def: 0 },
    { key: "rot", label: "Rotate deg", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "rule", label: "Rule", type: "select", options: ["None", "Underline", "Box", "Bracket"], def: "None" },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  /* Shared layout: text assembly, metrics and block placement.
     compute() and overlay() both call this so the guide always matches the ink. */
  _layout(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const size = Math.max(0.2, Number(p.size) || 0.2);
    const sc = size / 10;
    const tr = Math.max(0.05, (Number(p.track) || 100) / 100);
    const SEP = { Dash: " - ", Slash: " / ", Dot: " . ", Space: "   " };
    const sep = SEP[p.sep] || " - ";

    const nm = String(p.text == null ? "" : p.text).toUpperCase();
    const dt = String(p.date == null ? "" : p.date).toUpperCase();
    const n = Math.max(1, Math.round(Number(p.num) || 1));
    const N = Math.max(1, Math.round(Number(p.total) || 1));
    let ed = "";
    if (p.edMode === "n/N") ed = n + "/" + N;
    else if (p.edMode === "No. n") ed = "NO. " + n;
    else if (p.edMode === "n of N") ed = n + " OF " + N;

    const parts = [nm, dt, ed].filter((s) => s.replace(/\s+/g, "").length > 0);
    let lines;
    if (!parts.length) lines = [];
    else if (p.layout === "Stacked") lines = parts.slice();
    else if (p.layout === "Two lines") lines = [parts[0], parts.slice(1).join(sep)].filter((s) => s.length > 0);
    else lines = [parts.join(sep)];

    const adv = (ch) => ((SFONT[ch] || SFONT[" "]).w + 2) * sc * tr;
    const lineW = (s) => {
      let w = 0;
      for (const ch of s) w += adv(ch);
      return Math.max(0, w - 2 * sc * tr);
    };
    const widths = lines.map(lineW);

    const baseSlant = p.font === "Italic" ? 12 : p.font === "Hand" ? 3 : 0;
    const tanS = Math.tan(((Number(p.slant) || 0) + baseSlant) * Math.PI / 180);
    const shear = Math.abs(tanS) * size;

    const lineStep = size * Math.max(0.5, (Number(p.lineh) || 170) / 100);
    const blockW = Math.max(0.1, (widths.length ? Math.max.apply(null, widths) : 0) + shear);
    const blockH = Math.max(0.1, size + Math.max(0, lines.length - 1) * lineStep);

    const m = Math.max(0, Number(p.margin) || 0);
    let ox = 0, oy = 0;
    switch (p.anchor) {
      case "Bottom left": ox = m; oy = H - m - blockH; break;
      case "Bottom center": ox = (W - blockW) / 2; oy = H - m - blockH; break;
      case "Top left": ox = m; oy = m; break;
      case "Top right": ox = W - m - blockW; oy = m; break;
      case "Center": ox = (W - blockW) / 2; oy = (H - blockH) / 2; break;
      case "Custom": ox = Number(p.px) || 0; oy = Number(p.py) || 0; break;
      default: ox = W - m - blockW; oy = H - m - blockH; break;
    }
    ox += Number(p.offX) || 0;
    oy += Number(p.offY) || 0;

    const rad = (Number(p.rot) || 0) * Math.PI / 180;
    return {
      lines, widths, size, sc, tr, tanS, shear, lineStep, blockW, blockH, ox, oy,
      cx: ox + blockW / 2, cy: oy + blockH / 2, ca: Math.cos(rad), sa: Math.sin(rad),
    };
  },

  compute(ins, p, ctx) {
    const L = this && this._layout ? this._layout(p, ctx) : null;
    if (!L || !L.lines.length) return applyStyle({ paths: [] }, ins[0]);

    const { lines, widths, size, sc, tr, tanS, lineStep, blockW, ox, oy, cx, cy, ca, sa } = L;
    const layer = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const hand = p.font === "Hand";
    const T = hand ? Math.max(0, Math.min(1, Number(p.tremor) || 0)) : 0;
    const rng = mulberry32(Math.round(Number(p.seed) || 0) * 1013 + 7);
    const nSeed = Math.round(Number(p.seed) || 0) * 31 + 5;
    const step = Math.max(0.3, size / 9);
    const amp = 0.16 * size * T;
    const nf = 3.4 / size;
    const out = [];
    let budget = 60000;

    /* seeded hand wobble: densify, displace by noise, then average the corners
       round the way a moving nib does. Used for the glyph strokes and, at a
       lower amount, for the rule so a hand-set mark is not framed by a ruler. */
    const wobble = (pts, loop, mult) => {
      if (!hand || T <= 0 || pts.length < 2) return pts;
      const a = amp * mult;
      let q = resample(pts, loop, step).map(([qx, qy]) => [
        qx + (noise2(qx * nf, qy * nf, nSeed) - 0.5) * a,
        qy + (noise2(qx * nf + 37.1, qy * nf - 19.7, nSeed) - 0.5) * a,
      ]);
      const wgt = 0.5 * T;
      for (let pass = 0; pass < 3; pass++) {
        const prev = q, n2 = prev.length;
        if (n2 < 3) break;
        const nx = prev.map((v) => [v[0], v[1]]);
        for (let i = 0; i < n2; i++) {
          if (!loop && (i === 0 || i === n2 - 1)) continue;
          const a2 = prev[(i - 1 + n2) % n2], b2 = prev[i], c2 = prev[(i + 1) % n2];
          nx[i] = [b2[0] + ((a2[0] + c2[0]) / 2 - b2[0]) * wgt, b2[1] + ((a2[1] + c2[1]) / 2 - b2[1]) * wgt];
        }
        q = nx;
      }
      return q;
    };

    const align = p.layout === "One line" ? "Left" : p.align;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lw = widths[li];
      const yTop = oy + li * lineStep;
      let x = ox + (align === "Center" ? (blockW - lw) / 2 : align === "Right" ? blockW - lw : 0);

      let ci = -1;
      for (const ch of line) {
        ci++;
        const g = SFONT[ch] || SFONT[" "];
        let jx = 0, jy = 0, jc = 1, js = 0, jsc = 1;
        if (hand) {
          jx = (rng() - 0.5) * 0.16 * size * T;
          jy = (rng() - 0.5) * 0.20 * size * T + (noise2(ci * 0.55, li * 4.3, nSeed) - 0.5) * 0.30 * size * T;
          const ja = (rng() - 0.5) * 0.20 * T;
          jc = Math.cos(ja); js = Math.sin(ja);
          jsc = 1 + (rng() - 0.5) * 0.14 * T;
        }

        for (const stroke of g.s) {
          if (!stroke || stroke.length < 2) continue;
          const a = stroke[0], b = stroke[stroke.length - 1];
          const loop = stroke.length > 3 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
          const src = loop ? stroke.slice(0, stroke.length - 1) : stroke;

          let pts = src.map(([gx, gy]) => {
            let px = gx * sc, py = gy * sc;
            px += (size - py) * tanS;
            if (hand) {
              const rx = px * jsc, ry = (py - size) * jsc;
              px = rx * jc - ry * js + jx;
              py = ry * jc + rx * js + size + jy;
            }
            return [x + px, yTop + py];
          });

          pts = wobble(pts, loop, 1);
          if (pts.length < 2) continue;
          if (budget - pts.length < 0) { budget = -1; break; }
          budget -= pts.length;
          out.push({ pts, closed: loop });
        }
        if (budget < 0) break;
        x += ((g.w + 2) * sc * tr);
      }
      if (budget < 0) break;
    }

    /* rule / frame around the nominal block */
    const bw = blockW, bh = L.blockH;
    const pad = 0.5 * size;
    if (p.rule === "Underline") {
      const y = oy + bh + 0.45 * size;
      out.push({ pts: wobble([[ox, y], [ox + bw, y]], false, 0.55), closed: false });
    } else if (p.rule === "Box") {
      out.push({
        pts: wobble([[ox - pad, oy - pad], [ox + bw + pad, oy - pad], [ox + bw + pad, oy + bh + pad], [ox - pad, oy + bh + pad]], true, 0.55),
        closed: true,
      });
    } else if (p.rule === "Bracket") {
      const t = Math.max(0.3, 0.35 * size);
      out.push({ pts: wobble([[ox - pad + t, oy - pad], [ox - pad, oy - pad], [ox - pad, oy + bh + pad], [ox - pad + t, oy + bh + pad]], false, 0.55), closed: false });
      out.push({ pts: wobble([[ox + bw + pad - t, oy - pad], [ox + bw + pad, oy - pad], [ox + bw + pad, oy + bh + pad], [ox + bw + pad - t, oy + bh + pad]], false, 0.55), closed: false });
    }

    const paths = out.map((q) => ({
      pts: q.pts.map(([qx, qy]) => {
        const dx = qx - cx, dy = qy - cy;
        return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
      }),
      closed: q.closed,
      layer,
    }));

    return applyStyle({ paths }, ins[0]);
  },

  overlay(p, ctx) {
    try {
      const L = this && this._layout ? this._layout(p, ctx) : null;
      if (!L || !L.lines.length) return [];
      const { ox, oy, blockW, blockH, cx, cy, ca, sa } = L;
      const R = (x, y) => {
        const dx = x - cx, dy = y - cy;
        return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca];
      };
      const c = [R(ox, oy), R(ox + blockW, oy), R(ox + blockW, oy + blockH), R(ox, oy + blockH)];
      const guides = [{ kind: "poly", pts: c.concat([c[0]]) }];
      const bl = R(ox, oy + L.size);
      guides.push({ kind: "point", x: bl[0], y: bl[1] });
      return guides;
    } catch (e) { return []; }
  },
};
