({
  key: "mm_paper",
  name: "Millimeter Paper",
  cat: "gen",
  group: "geometric",
  desc: "Technical millimeter / graph paper: a grid of Fine step lines with every Nth line promoted to a Medium and every Nth to a Major line, each level drawn with its own pen so the classic three-weight look comes from three colors (or the same pen plotted 2-3 times for real line weight). Whole major cells snaps the grid area down to complete major squares and centers it inside the margin; Border toggles the outermost frame lines. Each line is drawn once at its highest level, lines serpentine (alternate direction) for faster plotting. Set Medium or Major every to 0 to disable a level, untick Fine lines for a cm-only grid. Chain tip: wire a Stroke style for dashed engineering grids, or feed the output through Wave/Lens for distorted graph-paper art.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "fine", label: "Fine step mm", type: "slider", min: 0.5, max: 10, step: 0.5, def: 1 },
    { key: "midEvery", label: "Medium every", type: "slider", min: 0, max: 20, step: 1, def: 5 },
    { key: "majorEvery", label: "Major every", type: "slider", min: 0, max: 50, step: 1, def: 10 },
    { key: "fineOn", label: "Fine lines", type: "check", def: true },
    { key: "snap", label: "Whole major cells", type: "check", def: true },
    { key: "border", label: "Border", type: "check", def: true },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "penFine", label: "Fine pen", type: "pen", def: 0 },
    { key: "penMid", label: "Medium pen", type: "pen", def: 1 },
    { key: "penMajor", label: "Major pen", type: "pen", def: 2 },
  ],
  overlay(p, ctx) {
    const m = Math.min(Math.max(0, p.margin), Math.min(ctx.W, ctx.H) / 2 - 2);
    const fine = Math.max(0.25, p.fine);
    const midE = Math.max(0, Math.round(p.midEvery));
    const majE = Math.max(0, Math.round(p.majorEvery));
    const cell = fine * (majE > 0 ? majE : midE > 0 ? midE : 1);
    let gw = ctx.W - 2 * m, gh = ctx.H - 2 * m;
    if (p.snap) { gw = Math.floor(gw / cell) * cell; gh = Math.floor(gh / cell) * cell; }
    else { gw = Math.floor(gw / fine) * fine; gh = Math.floor(gh / fine) * fine; }
    if (gw < fine || gh < fine) return [];
    return [{ kind: "rect", x: (ctx.W - gw) / 2, y: (ctx.H - gh) / 2, w: gw, h: gh }];
  },
  compute(ins, p, ctx) {
    const m = Math.min(Math.max(0, p.margin), Math.min(ctx.W, ctx.H) / 2 - 2);
    const fine = Math.max(0.25, p.fine);
    const midE = Math.max(0, Math.round(p.midEvery));
    const majE = Math.max(0, Math.round(p.majorEvery));
    const cell = fine * (majE > 0 ? majE : midE > 0 ? midE : 1);
    let gw = ctx.W - 2 * m, gh = ctx.H - 2 * m;
    if (p.snap) { gw = Math.floor(gw / cell) * cell; gh = Math.floor(gh / cell) * cell; }
    else { gw = Math.floor(gw / fine) * fine; gh = Math.floor(gh / fine) * fine; }
    const g = (gw < fine || gh < fine) ? null
      : { x0: (ctx.W - gw) / 2, y0: (ctx.H - gh) / 2, x1: (ctx.W + gw) / 2, y1: (ctx.H + gh) / 2, fine, midE, majE };
    if (!g) return applyStyle(EMPTY, ins[0]);
    const { x0, y0, x1, y1 } = g;
    const MAXL = 4200;
    const level = (i, n) => {
      if ((i === 0 || i === n) && !p.border) return -1;
      if (majE > 0 && i % majE === 0) return 2;
      if (midE > 0 && i % midE === 0) return 1;
      return p.fineOn ? 0 : -1;
    };
    const pens = [Math.round(p.penFine), Math.round(p.penMid), Math.round(p.penMajor)];
    const paths = [];
    const emit = (lv, a, b, flip) =>
      paths.push({ pts: flip ? [b, a] : [a, b], closed: false, layer: pens[lv] });

    const nx = Math.round((x1 - x0) / fine);
    const ny = Math.round((y1 - y0) / fine);
    if (nx + ny + 2 > MAXL) return applyStyle(EMPTY, ins[0]);

    let dir = 0;
    for (let lv = 2; lv >= 0; lv--) {
      // verticals then horizontals per level, serpentine within each pass
      for (let i = 0; i <= nx; i++) {
        if (level(i, nx) !== lv) continue;
        const x = x0 + i * fine;
        emit(lv, [x, y0], [x, y1], dir++ % 2 === 1);
      }
      for (let i = 0; i <= ny; i++) {
        if (level(i, ny) !== lv) continue;
        const y = y0 + i * fine;
        emit(lv, [x0, y], [x1, y], dir++ % 2 === 1);
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
