import { Pin, EMPTY, hash2, applyStyle } from "../helpers.js";

export default {
  /* Stitch Type - bitmap lettering dressed in distance-ring stitch marks.

     The text is set in a pixel font, every font pixel becomes a Pixel x Pixel
     block of stitch cells, and each cell is then classified by its distance to
     the letter boundary:

       core  - inside, no 4-neighbour outside      (purple X in the reference)
       edge  - inside, touching the outside        (blue lattice)
       halo  - outside, 8-touching the letter      (red stripes)
       aura  - outside, next ring(s) out           (orange dashes, sparse)
       pins  - long bars along halo runs           (pink)

     Each ring gets its own mark type and pen, so the same skeleton yields the
     reference look (preset Sampler) or any of the variants. Layout is shared
     between compute and overlay through this._layout (the engine calls both as
     methods on the definition), so the guide box always matches the output. */
  key: "stitchtype",
  name: "Stitch Type",
  cat: "gen",
  group: "textimg",
  desc: "Bitmap lettering dressed in layered stitch marks, in the manner of an 8-bit sampler chart. Text is set in a pixel font (Sampler 5x7, Bold 5x7 or Tiny 3x5; A-Z, 0-9, ÄÖÅ, punctuation, | = new line) and every font pixel becomes a Pixel x Pixel block of stitch cells. Cells are then classified by distance to the letter boundary and each class is drawn with its own mark and pen: Core (inside, not touching the outside) carries the fill - cross X, plus, diamond, dots, hatch or rings; Edge (the letter's boundary ring) carries a lattice of joined plus marks, an outline, boxes, dots or diagonals; Halo (the ring of cells just outside) carries horizontal or vertical stripes at Halo stripes per cell, dashes, dots or a zigzag, and Aura (the next ring(s) out, Aura rings) scatters seeded dashes, dots, ticks or crosses at Aura fill density. Pins are long seeded bars laid along the halo runs beside the letter stems (Vertical, Horizontal, Both or None, density Pins). Preset Sampler is the reference chart; Circuit, Knit and Dotted are ready variants; Custom exposes every mark selector. Cell mm is the stitch pitch and stays exact unless the block (rings included) cannot fit inside Margin, when it shrinks. Collinear marks are merged into single strokes, so the lattice and the X fill plot as long lines rather than thousands of ticks. Five pens by default: Purple core, Blue edge, Red halo, Magenta pins, Orange aura.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "text", label: "Text (| = new line)", type: "text", def: "MUUSIA" },
    { key: "font", label: "Font", type: "select", options: ["Bold 5x7", "Sampler 5x7", "Tiny 3x5"], def: "Bold 5x7" },
    { key: "px", label: "Pixel (cells)", type: "slider", min: 1, max: 5, step: 1, def: 2 },
    { key: "cell", label: "Cell mm", type: "slider", min: 1, max: 12, step: 0.1, def: 3 },
    { key: "bridge", label: "Bridge diagonals", type: "check", def: true },
    { key: "gap", label: "Letter gap (px)", type: "slider", min: 0, max: 6, step: 1, def: 3 },
    { key: "linegap", label: "Line gap (px)", type: "slider", min: 0, max: 6, step: 1, def: 2 },
    { key: "align", label: "Align", type: "select", options: ["Center", "Left", "Right"], def: "Center" },
    { key: "yoff", label: "Y offset mm", type: "slider", min: -140, max: 140, step: 1, def: 0 },
    { key: "preset", label: "Preset", type: "select", options: ["Sampler", "Circuit", "Knit", "Dotted", "Custom"], def: "Sampler" },
    { key: "coreMark", label: "Core mark", type: "select", options: ["Cross X", "Plus +", "Diamond", "Dots", "Hatch /", "Hatch \\", "Rings", "None"], def: "Cross X", showIf: (p) => p.preset === "Custom" },
    { key: "edgeMark", label: "Edge mark", type: "select", options: ["Lattice +", "Outline", "Box", "Dots", "Diagonal /", "None"], def: "Lattice +", showIf: (p) => p.preset === "Custom" },
    { key: "haloMark", label: "Halo mark", type: "select", options: ["Stripes -", "Stripes |", "Dashes", "Dots", "Zigzag", "None"], def: "Stripes -", showIf: (p) => p.preset === "Custom" },
    { key: "auraMark", label: "Aura mark", type: "select", options: ["Dashes", "Dots", "Ticks |", "Crosses x", "None"], def: "Dashes", showIf: (p) => p.preset === "Custom" },
    { key: "pinMark", label: "Pins", type: "select", options: ["Vertical", "Horizontal", "Both", "None"], def: "Vertical", showIf: (p) => p.preset === "Custom" },
    { key: "haloLines", label: "Halo stripes / cell", type: "slider", min: 1, max: 5, step: 1, def: 3 },
    { key: "rings", label: "Aura rings", type: "slider", min: 0, max: 3, step: 1, def: 1 },
    { key: "auraFill", label: "Aura fill", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "pinFill", label: "Pin density", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "penCore", label: "Core pen", type: "pen", def: 5 },
    { key: "penEdge", label: "Edge pen", type: "pen", def: 1 },
    { key: "penHalo", label: "Halo pen", type: "pen", def: 2 },
    { key: "penPins", label: "Pins pen", type: "pen", def: 7 },
    { key: "penAura", label: "Aura pen", type: "pen", def: 4 },
  ],

  /* rows top to bottom, # = pixel */
  _F57: {
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
    "Ä": ["#...#", ".....", "..#..", ".#.#.", "#####", "#...#", "#...#"],
    "Ö": ["#...#", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
    "Å": ["..#..", ".....", "..#..", ".#.#.", "#####", "#...#", "#...#"],
  },
  _F35: {
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
  },

  /* mark set per preset; Custom reads the selectors */
  _PRESETS: {
    Sampler: { core: "Cross X", edge: "Lattice +", halo: "Stripes -", aura: "Dashes", pins: "Vertical" },
    Circuit: { core: "Dots", edge: "Box", halo: "Stripes |", aura: "Ticks |", pins: "Horizontal" },
    Knit: { core: "Diamond", edge: "Lattice +", halo: "Zigzag", aura: "Crosses x", pins: "None" },
    Dotted: { core: "Dots", edge: "Dots", halo: "Dots", aura: "Dots", pins: "None" },
  },

  /* Shared by compute and overlay. Returns null when there is nothing to draw.
     kind grid: 0 = far, 1 = core, 2 = edge, 3.. = exterior ring (3 = halo,
     4 = aura ring 1, 5 = aura ring 2, ...). */
  _layout(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const px = clamp(Math.round(Number(p.px) || 1), 1, 8);
    const gapPx = clamp(Math.round(Number(p.gap) || 0), 0, 10);
    const lineGapPx = clamp(Math.round(Number(p.linegap) || 0), 0, 12);
    const rings = clamp(Math.round(Number(p.rings) || 0), 0, 4);
    const margin = Math.max(0, Number(p.margin) || 0);
    const cell0 = Math.max(0.2, Number(p.cell) || 3);
    const tiny = p.font === "Tiny 3x5", bold = p.font === "Bold 5x7";
    const FONT = tiny ? this._F35 : this._F57;
    const ROWS = tiny ? 5 : 7;
    const glyph = (ch) => {
      const g = FONT[ch];
      if (!g) return null;
      if (!bold) return g;
      const gw = g[0].length;
      const on = (rr, cc) => rr >= 0 && rr < ROWS && cc >= 0 && cc < gw && g[rr][cc] === "#";
      const out = [];
      for (let r = 0; r <= ROWS; r++) {
        let row = "";
        for (let c = 0; c <= gw; c++) row += on(r, c) || on(r - 1, c) || on(r, c - 1) || on(r - 1, c - 1) ? "#" : ".";
        out.push(row);
      }
      return out;
    };
    const GROWS = bold ? ROWS + 1 : ROWS;

    /* ---- font pixels for every line ---- */
    const lines = String(p.text || "").split("|");
    const lineCells = lines.map((line) => {
      const cells = [];
      let x = 0;
      const chars = [...line.toUpperCase()];
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === " ") { x += tiny ? 2 : 3; continue; }
        const g = glyph(ch);
        if (!g) continue;
        const gw = g[0].length;
        for (let r = 0; r < g.length; r++) for (let c = 0; c < gw; c++) if (g[r][c] === "#") cells.push([x + c, r]);
        x += gw + gapPx;
      }
      return { cells, width: Math.max(0, x - gapPx) };
    });
    const blockWpx = Math.max(0, ...lineCells.map((l) => l.width));
    const blockHpx = lines.length * GROWS + Math.max(0, lines.length - 1) * lineGapPx;
    const pixels = [];
    lineCells.forEach((L, li) => {
      const off = p.align === "Left" ? 0 : p.align === "Right" ? blockWpx - L.width : Math.floor((blockWpx - L.width) / 2);
      const r0 = li * (GROWS + lineGapPx);
      for (const [c, r] of L.cells) pixels.push([c + off, r + r0]);
    });
    if (!pixels.length) return null;

    /* ---- stitch-cell grid with ring padding ---- */
    const R = 1 + rings;                       /* exterior rings incl. halo */
    const bw = blockWpx * px, bh = blockHpx * px;
    const cols = bw + 2 * R, rows = bh + 2 * R;
    const kind = new Uint8Array(cols * rows);
    const idx = (c, r) => r * cols + c;
    for (const [pc, pr] of pixels) for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) kind[idx(R + pc * px + i, R + pr * px + j)] = 1;
    /* bridge corner-touching diagonal pixels (Sampler/Tiny diagonals) with a
       2x2 block at the shared corner so the letter stays edge-connected */
    if (p.bridge) {
      const pset = new Set(pixels.map(([c, r]) => c + "," + r));
      const has = (c, r) => pset.has(c + "," + r);
      const put = (c, r) => { if (c >= 0 && r >= 0 && c < cols && r < rows) kind[idx(c, r)] = 1; };
      for (const [c, r] of pixels) {
        if (has(c + 1, r + 1) && !has(c + 1, r) && !has(c, r + 1)) { put(R + (c + 1) * px, R + (r + 1) * px - 1); put(R + (c + 1) * px - 1, R + (r + 1) * px); }
        if (has(c - 1, r + 1) && !has(c - 1, r) && !has(c, r + 1)) { put(R + c * px - 1, R + (r + 1) * px - 1); put(R + c * px, R + (r + 1) * px); }
      }
    }
    const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && (kind[idx(c, r)] === 1 || kind[idx(c, r)] === 2);
    /* edge = inside cell with a 4-neighbour outside */
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (kind[idx(c, r)] !== 1) continue;
      if (!inside(c - 1, r) || !inside(c + 1, r) || !inside(c, r - 1) || !inside(c, r + 1)) kind[idx(c, r)] = 2;
    }
    /* exterior rings by 8-neighbour dilation */
    for (let k = 0; k < R; k++) {
      const want = k === 0 ? null : 3 + k - 1;
      const mark = 3 + k;
      const hit = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && (want === null ? kind[idx(c, r)] === 1 || kind[idx(c, r)] === 2 : kind[idx(c, r)] === want);
      const next = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (kind[idx(c, r)] !== 0) continue;
        let near = false;
        for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) if ((dc || dr) && hit(c + dc, r + dr)) { near = true; break; }
        if (near) next.push(idx(c, r));
      }
      for (const i of next) kind[i] = mark;
    }

    /* ---- physical placement: shrink only ---- */
    const avW = Math.max(1, W - 2 * margin), avH = Math.max(1, H - 2 * margin);
    const cell = Math.min(cell0, avW / cols, avH / rows);
    const x0 = (W - cols * cell) / 2, y0 = (H - rows * cell) / 2 + (Number(p.yoff) || 0);
    return { cols, rows, kind, cell, x0, y0, R, bw, bh, margin, W, H };
  },

  compute(ins, p, ctx) {
    const L = this._layout(p, ctx);
    if (!L) return EMPTY;
    const { cols, rows, kind, cell, x0, y0, R } = L;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pen = (v) => clamp(Math.round(Number(v) || 0), 0, 11);
    const PC = pen(p.penCore), PE = pen(p.penEdge), PH = pen(p.penHalo), PP = pen(p.penPins), PA = pen(p.penAura);
    const seed = Math.round(Number(p.seed) || 0);
    const nStripes = clamp(Math.round(Number(p.haloLines) || 1), 1, 8);
    const auraFill = clamp(Number(p.auraFill) || 0, 0, 1);
    const pinFill = clamp(Number(p.pinFill) || 0, 0, 1);
    const preset = this._PRESETS[p.preset];
    const M = preset || { core: p.coreMark, edge: p.edgeMark, halo: p.haloMark, aura: p.auraMark, pins: p.pinMark };
    const BUDGET = 112000;

    const K = (c, r) => (c >= 0 && r >= 0 && c < cols && r < rows) ? kind[r * cols + c] : 0;
    const X = (c) => x0 + c * cell, Y = (r) => y0 + r * cell;
    const paths = [];
    let total = 0;
    const seg = (a, b, layer) => { paths.push({ pts: [a, b], closed: false, layer }); total += 2; };
    const poly = (pts, closed, layer) => { paths.push({ pts, closed, layer }); total += pts.length; };
    const circle = (cx, cy, r, layer, n) => { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(o, true, layer); };

    /* ---- run finders over a cell predicate; runs merge collinear marks ---- */
    const runsH = (pred, fn) => {
      for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols) {
          if (!pred(c, r)) { c++; continue; }
          const c0 = c; while (c + 1 < cols && pred(c + 1, r)) c++;
          fn(r, c0, c); c++;
        }
      }
    };
    const runsV = (pred, fn) => {
      for (let c = 0; c < cols; c++) {
        let r = 0;
        while (r < rows) {
          if (!pred(c, r)) { r++; continue; }
          const r0 = r; while (r + 1 < rows && pred(c, r + 1)) r++;
          fn(c, r0, r); r++;
        }
      }
    };
    /* "\" diagonals: cell (c,r) -> (c+1,r+1); consecutive along key c-r */
    const runsBack = (pred, fn) => {
      for (let key = -(rows - 1); key <= cols - 1; key++) {
        let c = Math.max(0, key);
        while (c < cols) {
          const r = c - key;
          if (r >= rows) break;
          if (!pred(c, r)) { c++; continue; }
          const c0 = c; while (c + 1 < cols && c + 1 - key < rows && pred(c + 1, c + 1 - key)) c++;
          fn(c0, c0 - key, c, c - key); c++;
        }
      }
    };
    /* "/" diagonals: cell (c,r) lower-left (c,r+1) -> upper-right (c+1,r); consecutive along key c+r */
    const runsSlash = (pred, fn) => {
      for (let key = 0; key <= cols + rows - 2; key++) {
        let c = Math.max(0, key - (rows - 1));
        while (c < cols) {
          const r = key - c;
          if (r < 0) break;
          if (!pred(c, r)) { c++; continue; }
          const c0 = c; while (c + 1 < cols && key - (c + 1) >= 0 && pred(c + 1, key - (c + 1))) c++;
          fn(c0, key - c0, c, key - c); c++;
        }
      }
    };
    const forCells = (pred, fn) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (pred(c, r)) fn(c, r); };

    const isCore = (c, r) => K(c, r) === 1;
    const isEdge = (c, r) => K(c, r) === 2;
    const isIn = (c, r) => { const k = K(c, r); return k === 1 || k === 2; };
    const isHalo = (c, r) => K(c, r) === 3;
    const isRing = (c, r) => K(c, r) >= 3;

    /* mark families reused by several rings */
    const lattice = (pred, layer) => {
      runsH(pred, (r, c0, c1) => seg([X(c0), Y(r + 0.5)], [X(c1 + 1), Y(r + 0.5)], layer));
      runsV(pred, (c, r0, r1) => seg([X(c + 0.5), Y(r0)], [X(c + 0.5), Y(r1 + 1)], layer));
    };
    const crossBack = (pred, layer) => runsBack(pred, (c0, r0, c1, r1) => seg([X(c0), Y(r0)], [X(c1 + 1), Y(r1 + 1)], layer));
    const crossSlash = (pred, layer) => runsSlash(pred, (c0, r0, c1, r1) => seg([X(c0), Y(r0 + 1)], [X(c1 + 1), Y(r1)], layer));
    const dots = (pred, layer, rad) => forCells(pred, (c, r) => circle(X(c + 0.5), Y(r + 0.5), cell * rad, layer, 8));
    const boxes = (pred, layer, inset) => forCells(pred, (c, r) => poly([[X(c + inset), Y(r + inset)], [X(c + 1 - inset), Y(r + inset)], [X(c + 1 - inset), Y(r + 1 - inset)], [X(c + inset), Y(r + 1 - inset)]], true, layer));
    const diamonds = (pred, layer) => forCells(pred, (c, r) => poly([[X(c + 0.5), Y(r + 0.06)], [X(c + 0.94), Y(r + 0.5)], [X(c + 0.5), Y(r + 0.94)], [X(c + 0.06), Y(r + 0.5)]], true, layer));
    const dashesH = (pred, layer, len) => forCells(pred, (c, r) => seg([X(c + 0.5 - len / 2), Y(r + 0.5)], [X(c + 0.5 + len / 2), Y(r + 0.5)], layer));
    const dashesV = (pred, layer, len) => forCells(pred, (c, r) => seg([X(c + 0.5), Y(r + 0.5 - len / 2)], [X(c + 0.5), Y(r + 0.5 + len / 2)], layer));
    const smallX = (pred, layer, s) => forCells(pred, (c, r) => {
      seg([X(c + 0.5 - s), Y(r + 0.5 - s)], [X(c + 0.5 + s), Y(r + 0.5 + s)], layer);
      seg([X(c + 0.5 - s), Y(r + 0.5 + s)], [X(c + 0.5 + s), Y(r + 0.5 - s)], layer);
    });

    /* ================================================== EDGE (blue) */
    if (M.edge === "Lattice +") lattice(isEdge, PE);
    else if (M.edge === "Outline") {
      runsH((c, r) => isIn(c, r) && !isIn(c, r - 1), (r, c0, c1) => seg([X(c0), Y(r)], [X(c1 + 1), Y(r)], PE));
      runsH((c, r) => isIn(c, r) && !isIn(c, r + 1), (r, c0, c1) => seg([X(c0), Y(r + 1)], [X(c1 + 1), Y(r + 1)], PE));
      runsV((c, r) => isIn(c, r) && !isIn(c - 1, r), (c, r0, r1) => seg([X(c), Y(r0)], [X(c), Y(r1 + 1)], PE));
      runsV((c, r) => isIn(c, r) && !isIn(c + 1, r), (c, r0, r1) => seg([X(c + 1), Y(r0)], [X(c + 1), Y(r1 + 1)], PE));
    }
    else if (M.edge === "Box") boxes(isEdge, PE, 0.15);
    else if (M.edge === "Dots") dots(isEdge, PE, 0.2);
    else if (M.edge === "Diagonal /") crossSlash(isEdge, PE);

    /* ================================================== CORE (purple) */
    if (M.core === "Cross X") { crossBack(isCore, PC); crossSlash(isCore, PC); }
    else if (M.core === "Plus +") lattice(isCore, PC);
    else if (M.core === "Diamond") diamonds(isCore, PC);
    else if (M.core === "Dots") dots(isCore, PC, 0.2);
    else if (M.core === "Hatch /") crossSlash(isCore, PC);
    else if (M.core === "Hatch \\") crossBack(isCore, PC);
    else if (M.core === "Rings") dots(isCore, PC, 0.42);

    /* ================================================== HALO (red) */
    const inset = 0.12;
    if (M.halo === "Stripes -") runsH(isHalo, (r, c0, c1) => {
      for (let k = 0; k < nStripes; k++) { const y = Y(r + (k + 0.5) / nStripes); seg([X(c0 + inset), y], [X(c1 + 1 - inset), y], PH); }
    });
    else if (M.halo === "Stripes |") runsV(isHalo, (c, r0, r1) => {
      for (let k = 0; k < nStripes; k++) { const x = X(c + (k + 0.5) / nStripes); seg([x, Y(r0 + inset)], [x, Y(r1 + 1 - inset)], PH); }
    });
    else if (M.halo === "Dashes") dashesH(isHalo, PH, 0.7);
    else if (M.halo === "Dots") dots(isHalo, PH, 0.16);
    else if (M.halo === "Zigzag") runsH(isHalo, (r, c0, c1) => {
      const pts = [];
      for (let c = c0; c <= c1; c++) { pts.push([X(c + inset), Y(r + 0.5 - 0.3)]); pts.push([X(c + 0.5), Y(r + 0.5 + 0.3)]); }
      pts.push([X(c1 + 1 - inset), Y(r + 0.5 - 0.3)]);
      poly(pts, false, PH);
    });

    /* ================================================== PINS (pink) */
    /* long seeded bars along halo runs beside the stems; short ones above and
       below at a lower rate. hash2 keyed on the run start so bars stay put
       when unrelated parameters move. */
    const pinV = M.pins === "Vertical" || M.pins === "Both", pinH = M.pins === "Horizontal" || M.pins === "Both";
    if (pinFill > 0 && pinV) runsV((c, r) => K(c, r) === 3 || K(c, r) === 4, (c, r0, r1) => {
      const len = r1 - r0 + 1;
      const h = hash2(c * 3 + 1, r0 * 5 + 2, seed + 101);
      const rate = K(c, r0) === 3 ? (len >= 3 ? pinFill : pinFill * 0.35) : (len >= 3 ? pinFill * 0.4 : pinFill * 0.15);
      if (h >= rate) return;
      const jx = (hash2(c * 7 + 3, r0 + 11, seed + 202) - 0.5) * 0.4;
      seg([X(c + 0.5 + jx), Y(r0 + 0.15)], [X(c + 0.5 + jx), Y(r1 + 1 - 0.15)], PP);
    });
    if (pinFill > 0 && pinH) runsH((c, r) => K(c, r) === 3 || K(c, r) === 4, (r, c0, c1) => {
      const len = c1 - c0 + 1;
      const h = hash2(c0 * 5 + 2, r * 3 + 1, seed + 303);
      const rate = K(c0, r) === 3 ? (len >= 3 ? pinFill : pinFill * 0.35) : (len >= 3 ? pinFill * 0.4 : pinFill * 0.15);
      if (h >= rate) return;
      const jy = (hash2(c0 + 11, r * 7 + 3, seed + 404) - 0.5) * 0.4;
      seg([X(c0 + 0.15), Y(r + 0.5 + jy)], [X(c1 + 1 - 0.15), Y(r + 0.5 + jy)], PP);
    });

    /* ================================================== AURA (orange) */
    if (auraFill > 0 && M.aura !== "None") {
      const auraOn = (c, r) => {
        const k = K(c, r);
        if (k < 4) return false;
        const decay = Math.pow(0.6, k - 4);
        return hash2(c, r, seed + 505 + k) < auraFill * decay;
      };
      if (M.aura === "Dashes") dashesH(auraOn, PA, 0.6);
      else if (M.aura === "Dots") dots(auraOn, PA, 0.14);
      else if (M.aura === "Ticks |") dashesV(auraOn, PA, 0.6);
      else if (M.aura === "Crosses x") smallX(auraOn, PA, 0.22);
    }

    /* budget: rings are the least important, drop from the end */
    if (total > BUDGET) {
      let acc = 0; const out = [];
      for (const q of paths) { if (acc + q.pts.length > BUDGET) break; out.push(q); acc += q.pts.length; }
      return applyStyle({ paths: out }, ins[0]);
    }
    return applyStyle({ paths }, ins[0]);
  },

  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      const guides = [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
      const L = this && typeof this._layout === "function" ? this._layout(p, ctx) : null;
      if (L) {
        guides.push({ kind: "rect", x: L.x0 + L.R * L.cell, y: L.y0 + L.R * L.cell, w: L.bw * L.cell, h: L.bh * L.cell });
        guides.push({ kind: "rect", x: L.x0, y: L.y0, w: L.cols * L.cell, h: L.rows * L.cell });
      }
      return guides;
    } catch (e) { return []; }
  },
};
