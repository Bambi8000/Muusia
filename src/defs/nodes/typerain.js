import { Pin, mulberry32, applyStyle, SFONT, fontStrokes } from "../helpers.js";

export default {
  /* Typewriter Rain — typewriter-art rain: a fixed character grid where each
     lane (column for Down, row for Right) carries seeded RUNS: one glyph
     repeated N cells on one pen, or a solid bar, or a slash ladder. Glyphs come
     from SFONT via fontStrokes. Optional Mask pin keeps cells inside closed
     shapes. Grid shared via this._grid (engine calls compute/overlay as def
     methods). */
  key: "typerain",
  name: "Typewriter Rain",
  cat: "gen",
  group: "textimg",
  desc: "Typewriter art as rain: the sheet becomes a fixed character grid (Size sets the cap height, Pitch X / Y the cell in cap-height units — a real machine sits near 1.2 × 1.7) and every column (Direction Down) or row (Right) is filled with seeded runs, each run one glyph from Glyphs repeated cell after cell on one pen, separated by at least Gap empty cells. Repeat a character in Glyphs to weight it; lowercase is typed as capitals, unknown characters are dropped. Bars turns a share of the runs into solid ruled lines through the cell centres, Slashes forces a share into / ladders — the diagonal stairs of the original. Density is the filled share of every lane, Run length and Run variation shape the runs (most short, a few long). Grid Strict keeps every run on the row pitch; Free lets each run slip a fraction of a cell like a platen that was never quite aligned. Double strike overtypes each glyph with a 0.15 mm shift, once or twice, for the heavy ribbon look. Pens used from First pen picks a seeded colour per run. Wire closed shapes into Mask and the rain falls only inside them. Cells are typed lane by lane, so a point-budget cut loses the far lanes first.",
  ins: [Pin("paths", "Mask (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "glyphs", label: "Glyphs", type: "text", def: "MY/T" },
    { key: "size", label: "Size mm (cap height)", type: "slider", min: 1.5, max: 12, step: 0.1, def: 3 },
    { key: "pitchX", label: "Pitch X (× size)", type: "slider", min: 1, max: 3, step: 0.05, def: 1.2 },
    { key: "pitchY", label: "Pitch Y (× size)", type: "slider", min: 1.1, max: 3, step: 0.05, def: 1.7 },
    { key: "direction", label: "Direction", type: "select", options: ["Down", "Right"], def: "Down" },
    { key: "density", label: "Density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
    { key: "runLen", label: "Run length (cells)", type: "slider", min: 1, max: 30, step: 1, def: 8 },
    { key: "runVar", label: "Run variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.7 },
    { key: "bars", label: "Bars", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "slashes", label: "Slashes", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "grid", label: "Grid", type: "select", options: ["Strict", "Free"], def: "Strict" },
    { key: "gap", label: "Gap (cells)", type: "slider", min: 1, max: 6, step: 1, def: 2 },
    { key: "dbl", label: "Double strike", type: "slider", min: 0, max: 2, step: 1, def: 0 },
    { key: "pens", label: "Pens used", type: "slider", min: 1, max: 12, step: 1, def: 5 },
    { key: "pen0", label: "First pen", type: "pen", def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 8 },
    { key: "seed", label: "Seed", type: "seed", def: 12 },
  ],

  _grid(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 2));
    const size = Math.max(1, p.size);
    const cw = size * Math.max(1, p.pitchX), ch = size * Math.max(1.05, p.pitchY);
    const cols = Math.max(0, Math.floor((W - 2 * m) / cw)), rows = Math.max(0, Math.floor((H - 2 * m) / ch));
    /* centre the grid in the margin box */
    const ox = m + ((W - 2 * m) - cols * cw) / 2, oy = m + ((H - 2 * m) - rows * ch) / 2;
    const down = p.direction !== "Right";
    return { W, H, m, size, cw, ch, cols, rows, ox, oy, down, lanes: down ? cols : rows, along: down ? rows : cols };
  },

  overlay(p, ctx) {
    try {
      const G = this && this._grid ? this._grid(p, ctx) : null;
      if (!G) return [];
      const g = [{ kind: "rect", x: G.ox, y: G.oy, w: G.cols * G.cw, h: G.rows * G.ch }];
      const n = Math.min(200, G.lanes + 1);
      for (let i = 0; i <= n && i <= G.lanes; i++) {
        if (G.down) g.push({ kind: "poly", pts: [[G.ox + i * G.cw, G.oy], [G.ox + i * G.cw, G.oy + G.rows * G.ch]] });
        else g.push({ kind: "poly", pts: [[G.ox, G.oy + i * G.ch], [G.ox + G.cols * G.cw, G.oy + i * G.ch]] });
      }
      return g;
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const G = this && this._grid ? this._grid(p, ctx) : null;
    if (!G || G.cols < 1 || G.rows < 1) return { paths: [] };
    const seed = (Math.round(p.seed) || 1) >>> 0;
    const paths = [];
    /* glyph set: capitals only, unknown dropped, empty -> M */
    let glyphs = "";
    for (const ch of String(p.glyphs == null ? "" : p.glyphs).toUpperCase()) if (SFONT[ch] && ch !== " ") glyphs += ch;
    if (!glyphs.length) glyphs = "M";
    const density = Math.max(0, Math.min(1, p.density));
    const runLen = Math.max(1, Math.round(p.runLen));
    const runVar = Math.max(0, Math.min(1, p.runVar));
    const bars = Math.max(0, Math.min(1, p.bars)), slashes = Math.max(0, Math.min(1, p.slashes));
    const gapMin = Math.max(1, Math.round(p.gap));
    const dbl = Math.max(0, Math.min(2, Math.round(p.dbl)));
    const pensN = Math.max(1, Math.min(12, Math.round(p.pens))), pen0 = Math.round(p.pen0);
    const free = p.grid === "Free";
    const BUDGET = 110000;
    let pts = 0;
    /* mask */
    const rings = [];
    if (ins && ins[0] && ins[0].paths) for (const pa of ins[0].paths) {
      if (pa && pa.closed && pa.pts && pa.pts.length >= 3 && pa.pts.every((q) => q && Number.isFinite(q[0]) && Number.isFinite(q[1]))) rings.push(pa.pts);
    }
    const inMask = (x, y) => {
      if (!rings.length) return true;
      let c = false;
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
      }
      return c;
    };
    /* cell origin for (lane, k) */
    const cell = (lane, k) => G.down ? [G.ox + lane * G.cw, G.oy + k * G.ch] : [G.ox + k * G.cw, G.oy + lane * G.ch];
    const glyphCache = {};
    const glyph = (ch) => {
      if (!glyphCache[ch]) {
        const fs = fontStrokes(ch, G.size, 1);
        let x0 = Infinity, x1 = -Infinity;
        for (const st of fs.strokes) for (const [x] of st) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
        glyphCache[ch] = { strokes: fs.strokes, x0: x0 === Infinity ? 0 : x0, inkW: x0 === Infinity ? 0 : x1 - x0 };
      }
      return glyphCache[ch];
    };
    const typeGlyph = (ch, cx, cy, pen) => {
      const fs = glyph(ch);
      /* centre the INK box in the cell (fontStrokes' width includes tracking) */
      const gx = cx + (G.cw - fs.inkW) / 2 - fs.x0, gy = cy + (G.ch - G.size) / 2;
      const shifts = dbl === 0 ? [0] : dbl === 1 ? [0, 0.15] : [0, 0.15, -0.15];
      for (const sh of shifts) for (const st of fs.strokes) {
        paths.push({ pts: st.map(([x, y]) => [x + gx + sh, y + gy]), closed: false, layer: pen });
        pts += st.length;
      }
    };
    if (density <= 0) return applyStyle({ paths }, ins && ins[1]);
    const extraMean = Math.max(0, (runLen * (1 - density)) / Math.max(density, 1e-6) - gapMin);
    for (let lane = 0; lane < G.lanes && pts < BUDGET; lane++) {
      const rng = mulberry32(seed * 31 + lane * 7919 + 5);
      /* start with a partial gap so lanes don't all begin with a run */
      let k = Math.floor(rng() * (gapMin + extraMean + 1));
      while (k < G.along && pts < BUDGET) {
        const u = rng();
        const f = (1 - runVar) + runVar * (0.15 + 2 * u * u * u);
        const L = Math.max(1, Math.min(G.along - k, Math.round(runLen * f)));
        const kindU = rng();
        const kind = kindU < bars ? "bar" : kindU < bars + slashes ? "slash" : "glyph";
        const ch = kind === "slash" ? "/" : glyphs[Math.floor(rng() * glyphs.length)];
        const pen = ((pen0 + Math.floor(rng() * pensN)) % 12 + 12) % 12;
        const slip = free ? rng() * 0.5 : 0; /* fraction of a cell, along the lane */
        if (kind === "bar") {
          /* solid rule through the cell centres of the run; the mask can break it into stretches */
          let runStart = -1;
          for (let i = 0; i <= L; i++) {
            let inside = false;
            if (i < L) { const c = cell(lane, k + i); inside = inMask(c[0] + G.cw / 2 + (G.down ? 0 : slip * G.cw), c[1] + G.ch / 2 + (G.down ? slip * G.ch : 0)); }
            if (inside && runStart < 0) runStart = i;
            if (!inside && runStart >= 0) {
              const a0 = cell(lane, k + runStart), a1 = cell(lane, k + i - 1);
              const A = G.down ? [a0[0] + G.cw / 2, a0[1] + slip * G.ch] : [a0[0] + slip * G.cw, a0[1] + G.ch / 2];
              const B = G.down ? [a1[0] + G.cw / 2, a1[1] + G.ch + slip * G.ch] : [a1[0] + G.cw + slip * G.cw, a1[1] + G.ch / 2];
              paths.push({ pts: [A, B], closed: false, layer: pen });
              pts += 2;
              runStart = -1;
            }
          }
        } else {
          for (let i = 0; i < L && pts < BUDGET; i++) {
            const c = cell(lane, k + i);
            const cx = c[0] + (G.down ? 0 : slip * G.cw), cy = c[1] + (G.down ? slip * G.ch : 0);
            if (!inMask(cx + G.cw / 2, cy + G.ch / 2)) continue;
            typeGlyph(ch, cx, cy, pen);
          }
        }
        k += L;
        const extra = extraMean > 0 ? Math.floor(-Math.log(1 - Math.min(0.999999, rng())) * extraMean) : 0;
        k += gapMin + extra;
      }
    }
    return applyStyle({ paths }, ins && ins[1]);
  },
};
