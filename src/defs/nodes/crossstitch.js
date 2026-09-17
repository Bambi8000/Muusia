import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "crossstitch",
  name: "Cross Stitch",
  cat: "gen",
  group: "textimg",
  desc: "Lettering for thread on paper. Text is set in a bitmap sampler font on a stitch grid; every filled cell is one cross stitch, and the cell's four corners are the holes the needle must pierce. Holes output carries those holes once each as small circles at Hole size, deduplicated where neighbouring stitches share a corner — chain it into Needle Punch with Punch at: Centers, or plot the circles with a fine pen and pierce by hand. Stitches output is the thread guide: an X per cell (or a half stitch, or a backstitch outline round the letters) to plot faintly on the back or to print as a chart. Font Sampler is the classic 5x7, Bold thickens it by one cell, Tiny is 3x5 for small work. Pitch is the physical hole spacing and stays exact unless the block cannot fit, when it shrinks. Border adds a one-stitch frame with a gap, Mirror flips the whole block for punching from the back, | starts a new line.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Holes"), Pin("paths", "Stitches")],
  params: [
    { key: "text", label: "Text (| = new line)", type: "text", def: "MUUSIA" },
    { key: "font", label: "Font", type: "select", options: ["Sampler 5x7", "Bold 5x7", "Tiny 3x5"], def: "Sampler 5x7" },
    { key: "pitch", label: "Pitch mm", type: "slider", min: 1.5, max: 12, step: 0.1, def: 4 },
    { key: "hole", label: "Hole size mm", type: "slider", min: 0.2, max: 3, step: 0.05, def: 0.8 },
    { key: "stitch", label: "Stitch guide", type: "select", options: ["Cross", "Half /", "Half \\", "Backstitch", "None"], def: "Cross" },
    { key: "gap", label: "Letter gap (cells)", type: "slider", min: 0, max: 4, step: 1, def: 1 },
    { key: "linegap", label: "Line gap (cells)", type: "slider", min: 0, max: 6, step: 1, def: 2 },
    { key: "border", label: "Border", type: "check", def: false },
    { key: "bgap", label: "Border gap (cells)", type: "slider", min: 1, max: 6, step: 1, def: 2, showIf: (p) => p.border },
    { key: "align", label: "Align", type: "select", options: ["Center", "Left", "Right"], def: "Center" },
    { key: "yoff", label: "Y offset mm", type: "slider", min: -140, max: 140, step: 1, def: 0 },
    { key: "mirror", label: "Mirror (punch side)", type: "check", def: false },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Holes pen", type: "pen", def: 0 },
    { key: "glayer", label: "Guide pen", type: "pen", def: 1 },
  ],

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const penH = clamp(Math.round(Number(p.layer) || 0), 0, 11), penG = clamp(Math.round(Number(p.glayer) || 0), 0, 11);
    const pitch0 = Math.max(0.3, Number(p.pitch) || 4);
    const holeR = Math.max(0.05, (Number(p.hole) || 0.8) / 2);
    const gap = clamp(Math.round(Number(p.gap) || 0), 0, 10), lineGap = clamp(Math.round(Number(p.linegap) || 0), 0, 12);
    const margin = Math.max(0, Number(p.margin) || 0);
    const bgap = clamp(Math.round(Number(p.bgap) || 2), 1, 10);
    const BUDGET = 112000;

    /* ------------------------------------------------------------- fonts */
    /* rows top to bottom, # = stitch. Column width is the string length. */
    const F57 = {
      A: ["..#..", ".#.#.", "#...#", "#...#", "#####", "#...#", "#...#"],
      B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
      C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
      D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
      E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
      F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
      G: [".####", "#....", "#....", "#..##", "#...#", "#...#", ".####"],
      H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
      I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
      J: ["....#", "....#", "....#", "....#", "#...#", "#...#", ".###."],
      K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
      L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
      M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
      N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
      O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
      P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
      Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
      R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
      S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
      T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
      U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
      V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
      W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
      X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
      Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
      Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
      "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
      "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
      "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
      "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
      "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
      "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
      "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
      "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
      "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
      "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
      ".": [".....", ".....", ".....", ".....", ".....", "..##.", "..##."],
      ",": [".....", ".....", ".....", ".....", "..##.", "...#.", "..#.."],
      "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
      "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
      "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
      ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
      "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
      "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
      "&": [".##..", "#..#.", "#..#.", ".##..", "#.#.#", "#..#.", ".##.#"],
      "<3": [".......", ".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
    };
    /* umlauts: two dot rows above a shortened letter body */
    F57["Ä"] = ["#...#", ".....", "..#..", ".#.#.", "#####", "#...#", "#...#"];
    F57["Ö"] = ["#...#", ".....", ".###.", "#...#", "#...#", "#...#", ".###."];
    F57["Å"] = ["..#..", ".....", "..#..", ".#.#.", "#####", "#...#", "#...#"];
    const F35 = {
      A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
      D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
      G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
      J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
      M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
      P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "###", "..#"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
      S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
      V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
      Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
      "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
      "3": ["###", "..#", ".##", "..#", "###"], "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "##.", "..#", "##."],
      "6": [".##", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
      "9": ["###", "#.#", "###", "..#", "##."], ".": ["...", "...", "...", "...", ".#."], "-": ["...", "...", "###", "...", "..."],
      "!": [".#.", ".#.", ".#.", "...", ".#."], "?": ["##.", "..#", ".#.", "...", ".#."], ":": ["...", ".#.", "...", ".#.", "..."],
      "Ä": ["#.#", "...", ".#.", "###", "#.#"], "Ö": ["#.#", "...", ".#.", "#.#", ".#."], "Å": [".#.", "...", ".#.", "###", "#.#"],
    };
    const tiny = p.font === "Tiny 3x5", bold = p.font === "Bold 5x7";
    const FONT = tiny ? F35 : F57;
    const ROWS = tiny ? 5 : 7;
    const glyph = (ch) => {
      let g = FONT[ch];
      if (!g) return null;
      if (!bold) return g;
      /* dilate right and down by one cell */
      const w = g[0].length + 1;
      const out = [];
      for (let r = 0; r <= ROWS; r++) {
        let row = "";
        for (let c = 0; c < w; c++) {
          const on = (rr, cc) => rr >= 0 && rr < ROWS && cc >= 0 && cc < g[0].length && g[rr][cc] === "#";
          row += on(r, c) || on(r - 1, c) || on(r, c - 1) || on(r - 1, c - 1) ? "#" : ".";
        }
        out.push(row);
      }
      return out;
    };
    const GROWS = bold ? ROWS + 1 : ROWS;

    /* ---------------------------------------------------- lay out cells */
    const lines = String(p.text || "").split("|");
    const lineCells = lines.map((line) => {
      const cells = new Set();     /* "c,r" */
      let x = 0;
      const chars = [...line.toUpperCase()];
      for (let i = 0; i < chars.length; i++) {
        let ch = chars[i];
        if (ch === "<" && chars[i + 1] === "3") { ch = "<3"; i++; }
        if (ch === " ") { x += (tiny ? 2 : 3); continue; }
        const g = glyph(ch);
        if (!g) continue;
        const gw = Math.max(...g.map((row) => row.length));
        for (let r = 0; r < g.length; r++) for (let c = 0; c < gw; c++) if (g[r][c] === "#") cells.add((x + c) + "," + r);
        x += gw + gap;
      }
      return { cells, width: Math.max(0, x - gap) };
    });
    let blockW = Math.max(0, ...lineCells.map((l) => l.width));
    let blockH = lines.length * GROWS + Math.max(0, lines.length - 1) * lineGap;
    /* merge lines into one cell set with alignment, then optional border */
    const all = new Set();
    lineCells.forEach((L, li) => {
      const off = p.align === "Left" ? 0 : p.align === "Right" ? blockW - L.width : Math.round((blockW - L.width) / 2);
      const r0 = li * (GROWS + lineGap);
      for (const k of L.cells) { const [c, r] = k.split(",").map(Number); all.add((c + off) + "," + (r + r0)); }
    });
    let cells = all;
    if (p.border && all.size) {
      const bw = blockW + 2 * bgap + 2, bh = blockH + 2 * bgap + 2;
      const shifted = new Set();
      for (const k of all) { const [c, r] = k.split(",").map(Number); shifted.add((c + bgap + 1) + "," + (r + bgap + 1)); }
      for (let c = 0; c < bw; c++) { shifted.add(c + ",0"); shifted.add(c + "," + (bh - 1)); }
      for (let r = 0; r < bh; r++) { shifted.add("0," + r); shifted.add((bw - 1) + "," + r); }
      cells = shifted; blockW = bw; blockH = bh;
    }
    if (!cells.size) return [EMPTY, EMPTY];

    /* physical grid: pitch stays exact unless the block cannot fit */
    const pitch = Math.min(pitch0, (W - 2 * margin) / Math.max(1, blockW), (H - 2 * margin) / Math.max(1, blockH));
    const gx0 = (W - blockW * pitch) / 2, gy0 = (H - blockH * pitch) / 2 + (Number(p.yoff) || 0);
    const mir = !!p.mirror;
    const X = (c) => gx0 + (mir ? blockW - c : c) * pitch;
    const Y = (r) => gy0 + r * pitch;

    /* ------------------------------------------------------------- holes */
    const holeSet = new Set();
    const holes = [];
    const circle = (cx, cy, r) => { const o = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
    const parsed = [...cells].map((k) => k.split(",").map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [c, r] of parsed) for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const k = (c + dc) + "," + (r + dr);
      if (holeSet.has(k)) continue;
      holeSet.add(k);
      holes.push({ pts: circle(X(c + dc), Y(r + dr), Math.min(holeR, pitch * 0.45)), closed: true, layer: penH });
    }

    /* ------------------------------------------------------------- guide */
    const guide = [];
    const st = p.stitch;
    if (st === "Cross" || st === "Half /" || st === "Half \\") {
      for (const [c, r] of parsed) {
        /* "/" runs lower-left to upper-right on the sheet */
        const slash = [[X(c), Y(r + 1)], [X(c + 1), Y(r)]], back = [[X(c), Y(r)], [X(c + 1), Y(r + 1)]];
        if (st !== "Half \\") guide.push({ pts: slash, closed: false, layer: penG });
        if (st !== "Half /") guide.push({ pts: back, closed: false, layer: penG });
      }
    } else if (st === "Backstitch") {
      /* outline of the stitched region: every cell edge with exactly one stitched side */
      const has = (c, r) => cells.has(c + "," + r);
      for (const [c, r] of parsed) {
        if (!has(c, r - 1)) guide.push({ pts: [[X(c), Y(r)], [X(c + 1), Y(r)]], closed: false, layer: penG });
        if (!has(c, r + 1)) guide.push({ pts: [[X(c), Y(r + 1)], [X(c + 1), Y(r + 1)]], closed: false, layer: penG });
        if (!has(c - 1, r)) guide.push({ pts: [[X(c), Y(r)], [X(c), Y(r + 1)]], closed: false, layer: penG });
        if (!has(c + 1, r)) guide.push({ pts: [[X(c + 1), Y(r)], [X(c + 1), Y(r + 1)]], closed: false, layer: penG });
      }
    }
    let total = 0;
    const cap = (arr) => { const o = []; for (const q of arr) { if (total > BUDGET) break; o.push(q); total += q.pts.length; } return o; };
    return [applyStyle({ paths: cap(holes) }, ins[0]), { paths: cap(guide) }];
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      return [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
    } catch (e) { return []; }
  },
};
