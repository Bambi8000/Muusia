({
  key: "calib_sheet",
  name: "Calibration Sheet",
  cat: "gen",
  group: "structural",
  desc: "A dimensional test sheet for measuring the machine rather than the pen: a square of exactly Size mm with both diagonals, corner registration crosses, a 10 mm tick ruler along two edges, and the same square traced Repeats times, each pass starting from a different corner and alternating direction so backlash shows up as a doubled line. Unlike Test Card this node NEVER scales to fit — a millimetre on the sheet is a millimetre, and if the square does not fit the canvas it refuses to draw and plots a warning instead of quietly shrinking. Origin cross draws an identical cross as the very first and very last stroke of the file: if the two do not land on top of each other, the machine lost steps during the plot — this one needs *Optimize route* switched OFF in the export panel, because a nearest-neighbour sort sees two identical crosses in the same spot as zero travel and plots them back to back, which measures nothing. Every mark stays inside the square plus its crosses, ruler and one label line, so the footprint on paper is predictable. Measure the square's sides for step calibration, its two diagonals against each other for gantry squareness, and the repeat passes for backlash.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "size", label: "Square size mm", type: "slider", min: 20, max: 600, step: 1, def: 100 },
    { key: "anchor", label: "Position", type: "select", options: ["Centre", "Custom"], def: "Centre" },
    { key: "posX", label: "Left edge X mm", type: "slider", min: 0, max: 700, step: 1, def: 30, showIf: (p) => p.anchor === "Custom" },
    { key: "posY", label: "Top edge Y mm", type: "slider", min: 0, max: 700, step: 1, def: 30, showIf: (p) => p.anchor === "Custom" },
    { key: "diagonals", label: "Diagonals (squareness)", type: "check", def: true },
    { key: "repeats", label: "Repeat passes", type: "slider", min: 1, max: 6, step: 1, def: 3 },
    { key: "crosses", label: "Corner crosses", type: "check", def: true },
    { key: "crossSize", label: "Cross size mm", type: "slider", min: 4, max: 40, step: 1, def: 12 },
    { key: "ruler", label: "Tick ruler", type: "check", def: true },
    { key: "tickStep", label: "Tick step mm", type: "slider", min: 5, max: 50, step: 5, def: 10 },
    { key: "tickLen", label: "Tick length mm", type: "slider", min: 2, max: 15, step: 0.5, def: 4 },
    { key: "originCross", label: "Origin cross first + last", type: "check", def: true },
    { key: "originX", label: "Origin cross X mm", type: "slider", min: 0, max: 700, step: 1, def: 15 },
    { key: "originY", label: "Origin cross Y mm", type: "slider", min: 0, max: 700, step: 1, def: 15 },
    { key: "labels", label: "Labels", type: "check", def: true },
    { key: "textSize", label: "Label size mm", type: "slider", min: 2, max: 12, step: 0.5, def: 4 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "markPen", label: "Marks + label pen", type: "pen", def: 1 },
  ],

  /* Shared placement. No fit transform anywhere in this node: the numbers the
     user types are the numbers that reach the paper, or nothing is drawn. */
  _layout(p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const size = Math.max(1, Math.round(Number(p.size) || 1));
    const x0 = p.anchor === "Custom" ? (Number(p.posX) || 0) : (W - size) / 2;
    const y0 = p.anchor === "Custom" ? (Number(p.posY) || 0) : (H - size) / 2;
    const cs = Math.max(1, Number(p.crossSize) || 1);
    const pad = (p.crosses ? cs / 2 : 0) + (p.ruler ? Math.max(0, Number(p.tickLen) || 0) : 0);
    /* the label hangs below the ruler; reserve it so the fit test is honest */
    const labelH = p.labels ? Math.max(1.5, Number(p.textSize) || 4) * 1.6 : 0;
    const fits = x0 - pad >= 0 && y0 - pad >= 0 && x0 + size + pad <= W && y0 + size + pad + labelH <= H;
    return { W, H, size, x0, y0, x1: x0 + size, y1: y0 + size, cs, pad, labelH, fits };
  },

  compute(ins, p, ctx) {
    const L = this && this._layout ? this._layout(p, ctx) : null;
    if (!L) return applyStyle({ paths: [] }, ins[0]);
    const { W, H, size, x0, y0, x1, y1, cs, fits } = L;
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const mark = Math.max(0, Math.min(11, Math.round(Number(p.markPen) || 0)));
    const out = [];
    const add = (pts, closed, ly) => out.push({ pts, closed: !!closed, layer: ly === undefined ? pen : ly });
    const text = (str, tx, ty, h, ly) => {
      const fs = fontStrokes(String(str).toUpperCase(), Math.max(1.5, h), 1);
      for (const st of fs.strokes) if (st.length >= 2) add(st.map(([sx, sy]) => [tx + sx, ty + sy]), false, ly);
      return fs.width;
    };

    /* refuse to shrink: a square that does not fit is a setup error, and a
       silently scaled calibration square is worse than no square at all */
    if (!fits) {
      const m = 10, tw = Math.max(20, W - 2 * m), th = Math.max(20, H - 2 * m);
      add([[m, m], [m + tw, m], [m + tw, m + th], [m, m + th]], true, mark);
      add([[m, m], [m + tw, m + th]], false, mark);
      add([[m + tw, m], [m, m + th]], false, mark);
      /* the warning must never overflow the sheet, or the only thing on the
         page is a clipped complaint about something not fitting */
      const fit = (str, ty, maxH) => {
        const probe = fontStrokes(String(str).toUpperCase(), 10, 1).width || 1;
        const h = Math.max(1.5, Math.min(maxH, 10 * (tw - 12) / probe));
        text(str, m + 6, ty, h, mark);
        return h;
      };
      const h0 = Math.max(2, Math.min(12, th / 12));
      fit(size + " MM DOES NOT FIT " + Math.round(W) + "X" + Math.round(H), m + th / 2 - h0 * 1.6, h0);
      fit("NOTHING IS SCALED HERE", m + th / 2 + h0 * 0.4, h0);
      return applyStyle({ paths: out }, ins[0]);
    }

    const oc = () => {
      const a = cs / 2;
      /* keep the fiducial on the sheet: a cross whose arm runs off the paper
         is both unmeasurable and a move the machine may refuse */
      const ox = Math.min(Math.max(Number(p.originX) || 0, a), Math.max(a, W - a));
      const oy = Math.min(Math.max(Number(p.originY) || 0, a), Math.max(a, H - a));
      add([[ox - a, oy], [ox + a, oy]], false, mark);
      add([[ox, oy - a], [ox, oy + a]], false, mark);
    };
    if (p.originCross) oc();

    /* the square, traced once per repeat: each pass starts at a different
       corner and alternates winding, so backlash cannot hide in one direction */
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const passes = Math.max(1, Math.round(Number(p.repeats) || 1));
    for (let i = 0; i < passes; i++) {
      const start = i % 4, cw = i % 2 === 0;
      const pts = [];
      for (let k = 0; k < 4; k++) pts.push(corners[(start + (cw ? k : 4 - k)) % 4]);
      add(pts.map((q) => [q[0], q[1]]), true);
    }

    if (p.diagonals) {
      add([[x0, y0], [x1, y1]], false);
      add([[x1, y0], [x0, y1]], false);
    }

    if (p.crosses) {
      const a = cs / 2;
      for (const [cx, cy] of corners) {
        add([[cx - a, cy], [cx + a, cy]], false, mark);
        add([[cx, cy - a], [cx, cy + a]], false, mark);
      }
    }

    if (p.ruler) {
      const stp = Math.max(1, Number(p.tickStep) || 10);
      const tl = Math.max(0.5, Number(p.tickLen) || 4);
      for (let d = 0; d <= size + 1e-9; d += stp) {
        const long = Math.abs(d / stp % 5) < 1e-9 ? tl : tl * 0.55;
        add([[x0 + d, y1], [x0 + d, y1 + long]], false, mark);
        add([[x0, y0 + d], [x0 - long, y0 + d]], false, mark);
      }
    }

    if (p.labels) {
      /* The label is shrunk to the square's own width and tucked under the
         ruler, so the node's footprint is never wider than the square plus its
         marks. A calibration sheet that overhangs the paper by a label is a
         calibration sheet you cannot plot. */
      const want = Math.max(1.5, Number(p.textSize) || 4);
      const str = size + " MM  " + passes + "X";
      const probe = fontStrokes(str, 10, 1).width || 1;
      const h = Math.min(want, 10 * size / probe);
      const below = (p.ruler ? Math.max(0, Number(p.tickLen) || 0) : 0) + (p.crosses ? cs / 2 : 0);
      text(str, x0, y1 + below + h * 0.5, h, mark);
    }

    /* the closing cross: identical geometry, plotted last. Any offset between
       this and the opening cross is accumulated step loss, measured on paper. */
    if (p.originCross) oc();

    return applyStyle({ paths: out }, ins[0]);
  },

  overlay(p, ctx) {
    try {
      const L = this && this._layout ? this._layout(p, ctx) : null;
      if (!L) return [];
      if (!L.fits) return [{ kind: "rect", x: 0, y: 0, w: L.W, h: L.H }];
      const g = [{ kind: "rect", x: L.x0, y: L.y0, w: L.size, h: L.size }];
      if (p.originCross) {
        const a = L.cs / 2;
        g.push({ kind: "point",
          x: Math.min(Math.max(Number(p.originX) || 0, a), Math.max(a, L.W - a)),
          y: Math.min(Math.max(Number(p.originY) || 0, a), Math.max(a, L.H - a)) });
      }
      return g;
    } catch (e) { return []; }
  },
})
