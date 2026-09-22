import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  /* Pleat — a ribbon of parallel lines folded like a paper strip. Creases come
     from a token script (one token per crease, chars combine):
       -  straight    / \  tilt ±Tilt°    ^ v  chevron apex toward -/+ axis
       < >  shift ∓/±Shift mm    ( )  narrow / wide (÷/× Pinch)
       x  twist (line order flips from here on)    ~ =  full cylinder / flat shade
     Each ribbon line is ONE polyline through every crease. Layout shared via
     this._layout (engine calls compute/overlay as def methods). */
  key: "pleat",
  name: "Pleat",
  cat: "gen",
  group: "geometric",
  desc: "A ribbon of parallel lines folded like a strip of paper: the band runs along the sheet and kinks at every crease, and between creases each line is straight, so the whole strip reads as a stack of tilted panels in perspective. Creases are written as a token script, one token per crease with characters that combine: - straight, / \\ tilted by Tilt, ^ v chevron (peak toward the start / end of the strip, Chevron mm), < > shifted sideways by Shift, ( ) narrow or wide by Pinch, x twist (the line order flips from that crease on — an hourglass), ~ or = force a fully cylindrical or flat line distribution on that crease. Presets give the classic folds (Zigzag is the drawn-paper look: chevron creases alternating left and right, wide fans at both ends); Custom reads the Folds field. Shade pushes lines toward the panel edges like a rolled cylinder; Spacing variation jitters the crease intervals with the Seed. Construction lines extend every crease edge from the ribbon corner to the margin on Guide pen, the way the pencil guides survive on the original drawing. Each ribbon line is one continuous stroke end to end.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "preset", label: "Preset", type: "select", options: ["Zigzag", "Accordion", "Twisted", "Fan", "Custom"], def: "Zigzag" },
    { key: "script", label: "Folds (tokens: - / \\ ^ v < > ( ) x ~ =)", type: "text", def: ") - ^< v> ^< v> ^< v> - )", showIf: (p) => p.preset === "Custom" },
    { key: "orient", label: "Orientation", type: "select", options: ["Vertical", "Horizontal"], def: "Vertical" },
    { key: "lines", label: "Lines", type: "slider", min: 10, max: 200, step: 1, def: 60 },
    { key: "width", label: "Width mm", type: "slider", min: 10, max: 200, step: 1, def: 90 },
    { key: "lenPct", label: "Length %", type: "slider", min: 20, max: 100, step: 1, def: 100 },
    { key: "spVar", label: "Spacing variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "tilt", label: "Tilt °", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "chevron", label: "Chevron mm", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
    { key: "shift", label: "Shift mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "pinch", label: "Pinch", type: "slider", min: 1, max: 3, step: 0.05, def: 1.5 },
    { key: "shade", label: "Shade", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "guides", label: "Construction lines", type: "check", def: true },
    { key: "guidePen", label: "Guide pen", type: "pen", def: 6, showIf: (p) => !!p.guides },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 4 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  _layout(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const seed = (Math.round(p.seed) || 1) >>> 0;
    const PRESETS = {
      Zigzag: ") - ^< v> ^< v> ^< v> - )",
      Accordion: "- /< \\> /< \\> /< \\> -",
      Twisted: "- x - x - x -",
      Fan: "( - - - )",
    };
    let script = p.preset === "Custom" ? String(p.script == null ? "" : p.script) : PRESETS[p.preset] || PRESETS.Zigzag;
    let tokens = script.split(/\s+/).filter((t) => t.length > 0);
    while (tokens.length < 2) tokens.push("-");
    if (tokens.length > 60) tokens = tokens.slice(0, 60);
    const vert = p.orient !== "Horizontal";
    const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 2));
    const alongFull = (vert ? H : W) - 2 * m;
    const acrossHalf = (vert ? W : H) / 2 - m;
    const lenF = Math.max(0.05, Math.min(1, p.lenPct / 100));
    const L = alongFull * lenF;
    const s0 = m + (alongFull - L) / 2;
    const K = tokens.length;
    const gap = L / (K - 1);
    const spVar = Math.max(0, Math.min(1, p.spVar));
    const tiltR = (Math.max(0, p.tilt) * Math.PI) / 180;
    const chev = Math.max(0, p.chevron), shift = Math.max(0, p.shift), pinch = Math.max(1, p.pinch);
    const shade = Math.max(0, Math.min(1, p.shade));
    const width = Math.max(1, p.width);
    const creases = [];
    let flip = false;
    for (let k = 0; k < K; k++) {
      const t = tokens[k];
      let tl = 0, ch = 0, sh = 0, wf = 1, sd = shade, tw = false;
      for (const c of t) {
        if (c === "/") tl += tiltR; else if (c === "\\") tl -= tiltR;
        else if (c === "^") ch -= chev; else if (c === "v") ch += chev;
        else if (c === "<") sh -= shift; else if (c === ">") sh += shift;
        else if (c === "(") wf /= pinch; else if (c === ")") wf *= pinch;
        else if (c === "x") tw = true;
        else if (c === "~") sd = 1; else if (c === "=") sd = 0;
      }
      if (tw) flip = !flip;
      let s = s0 + k * gap;
      if (k > 0 && k < K - 1 && spVar > 0) s += (hash2(k + 1, 3, seed) * 2 - 1) * gap * 0.4 * spVar;
      creases.push({ s, u: sh, tilt: tl, chev: ch, hw: (width * wf) / 2, shade: sd, flip, token: t });
    }
    /* local (u across, s along) -> canvas */
    const toXY = (u, s) => {
      const uu = Math.max(-acrossHalf, Math.min(acrossHalf, u));
      const ss = Math.max(m, Math.min(m + alongFull, s));
      return vert ? [W / 2 + uu, ss] : [ss, H / 2 + uu];
    };
    /* point on crease k at distribution value lam in [0,1] */
    const creasePt = (c, lam) => {
      const across = (lam - 0.5) * 2 * c.hw;
      const along = c.s + across * Math.tan(c.tilt) + c.chev * (1 - 2 * Math.abs(lam - 0.5));
      return [c.u + across, along];
    };
    return { W, H, m, vert, tokens, creases, toXY, creasePt, acrossHalf, alongFull };
  },

  overlay(p, ctx) {
    try {
      const Ly = this && this._layout ? this._layout(p, ctx) : null;
      if (!Ly) return [];
      const g = [{ kind: "rect", x: Ly.m, y: Ly.m, w: Ly.W - 2 * Ly.m, h: Ly.H - 2 * Ly.m }];
      for (const c of Ly.creases) { const [x, y] = Ly.toXY(c.u, c.s); g.push({ kind: "point", x, y }); }
      return g;
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const Ly = this && this._layout ? this._layout(p, ctx) : null;
    if (!Ly) return { paths: [] };
    const { creases, toXY, creasePt } = Ly;
    const N = Math.max(2, Math.min(400, Math.round(p.lines)));
    const pen = Math.round(p.layer);
    const paths = [];
    const dist = (c, u) => (1 - c.shade) * u + c.shade * (0.5 - 0.5 * Math.cos(Math.PI * u));
    for (let i = 0; i < N; i++) {
      const pts = [];
      for (const c of creases) {
        const idx = c.flip ? N - 1 - i : i;
        const u = idx / (N - 1);
        const [lu, ls] = creasePt(c, dist(c, u));
        pts.push(toXY(lu, ls));
      }
      paths.push({ pts, closed: false, layer: pen });
    }
    if (p.guides) {
      const gpen = Math.round(p.guidePen);
      const { W, H, m } = Ly;
      /* extend a crease edge from its outer corner P away from Q until the margin box */
      const extend = (P, Q) => {
        const dx = P[0] - Q[0], dy = P[1] - Q[1];
        const L = Math.hypot(dx, dy);
        if (L < 1e-6) return null;
        /* a corner already on the margin box (ribbon running off the sheet) gets no guide */
        if (Math.abs(P[0] - m) < 1e-6 || Math.abs(P[0] - (W - m)) < 1e-6 || Math.abs(P[1] - m) < 1e-6 || Math.abs(P[1] - (H - m)) < 1e-6) return null;
        const ux = dx / L, uy = dy / L;
        let t = Infinity;
        if (ux > 1e-9) t = Math.min(t, (W - m - P[0]) / ux); else if (ux < -1e-9) t = Math.min(t, (m - P[0]) / ux);
        if (uy > 1e-9) t = Math.min(t, (H - m - P[1]) / uy); else if (uy < -1e-9) t = Math.min(t, (m - P[1]) / uy);
        if (!Number.isFinite(t) || t < 2) return null;
        return { pts: [P, [P[0] + ux * t, P[1] + uy * t]], closed: false, layer: gpen };
      };
      for (const c of creases) {
        const A = toXY(...creasePt(c, 0)), B = toXY(...creasePt(c, 1));
        const inner = c.chev !== 0 ? toXY(...creasePt(c, 0.5)) : null;
        const gA = extend(A, inner || B), gB = extend(B, inner || A);
        if (gA) paths.push(gA);
        if (gB) paths.push(gB);
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
