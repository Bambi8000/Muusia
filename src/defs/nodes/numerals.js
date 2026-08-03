import { Pin, EMPTY, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "numerals",
  name: "Numerals",
  cat: "gen",
  group: "textimg",
  desc: "Numbers in sixteen numeral systems from around the world, as plottable strokes. Value takes one or more numbers separated by spaces; digit scripts (Western, Eastern Arabic, Persian, Devanagari, Mongolian, Chinese) render digit by digit, value systems convert the whole number: Roman (subtractive, M repeats past 3999, N for zero), Maya (base-20 vertical stacks of dots and bars, shell zero), Cistercian (one monk-glyph per number 0-9999), Babylonian (base-60 cuneiform wedges with the late placeholder zero), Counting rods (rod numerals with alternating orientation per place), Kaktovik (Inupiaq base-20 connected strokes), plus Braille (with optional number sign), Dot matrix 5x7, 7-segment and 14-segment displays. Size is the digit height, Tokens per line wraps a sequence into a table, Dot mm sets the pen dot size for Braille and Dot matrix. The block centers on the canvas plus the X/Y offset. Chain tip: run a whole counting table (0 1 2 ... 19) per system, or stack the same number in every system down the sheet.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "value", label: "Value", type: "text", def: "2026" },
    { key: "system", label: "System", type: "select", options: ["Western", "Eastern Arabic", "Persian", "Devanagari", "Mongolian", "Chinese", "Roman", "Maya", "Cistercian", "Babylonian", "Counting rods", "Kaktovik", "Braille", "Dot matrix", "7-segment", "14-segment"], def: "Cistercian" },
    { key: "size", label: "Size mm", type: "slider", min: 4, max: 120, step: 1, def: 30 },
    { key: "spacing", label: "Spacing", type: "slider", min: 0, max: 1, step: 0.02, def: 0.14 },
    { key: "perLine", label: "Tokens per line", type: "slider", min: 0, max: 20, step: 1, def: 0 },
    { key: "lineGap", label: "Line gap", type: "slider", min: 0, max: 2, step: 0.05, def: 0.4 },
    { key: "tx", label: "Offset X", type: "slider", min: -200, max: 200, step: 1, def: 0 },
    { key: "ty", label: "Offset Y", type: "slider", min: -200, max: 200, step: 1, def: 0 },
    { key: "dot", label: "Dot mm", type: "slider", min: 0.6, max: 6, step: 0.1, def: 1.6 },
    { key: "numSign", label: "Braille number sign", type: "check", def: true },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    return [{ kind: "point", x: ctx.W / 2 + p.tx, y: ctx.H / 2 + p.ty }];
  },
  compute(ins, p, ctx, node) {
    const size = Math.max(1, p.size);
    const sp = Math.max(0, p.spacing);
    const dotR = Math.max(0.15, p.dot / 2) / size; // dot radius in glyph units

    // ---------- small geometry helpers (glyph units, y down, 1 = digit height) ----------
    const circle = (cx, cy, r, n) => {
      const m = n || 14, o = [];
      for (let i = 0; i < m; i++) { const a = (i / m) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      return o;
    };
    const chaikin = (pts, closed, it) => {
      let q = pts;
      for (let k = 0; k < (it || 2); k++) {
        const o = [], n = q.length, end = closed ? n : n - 1;
        if (!closed) o.push(q[0]);
        for (let i = 0; i < end; i++) {
          const a = q[i], b = q[(i + 1) % n];
          o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        if (!closed) o.push(q[n - 1]);
        q = o;
      }
      return q;
    };
    // stroke spec: { p: [[x,y]..], c: closed, sm: chaikin iterations }
    const S = (pts, opt) => ({ p: pts, c: !!(opt && opt.c), sm: (opt && opt.sm) || 0 });
    const DOT = (x, y, r) => S(circle(x, y, r || dotR, 10), { c: 1 });

    // ---------- digit glyph tables (per system: array [0..9] of {a: advance, s: strokes}) ----------
    const G = {};
    G.western = null; // via fontStrokes
    G.arabic = [
      { a: 0.42, s: [DOT(0.21, 0.55, 0.055)] },
      { a: 0.38, s: [S([[0.22, 0.06], [0.2, 0.5], [0.15, 0.95]], { sm: 1 })] },
      { a: 0.62, s: [S([[0.1, 0.34], [0.08, 0.16], [0.22, 0.06], [0.45, 0.06], [0.53, 0.16], [0.53, 0.55], [0.5, 0.95]], { sm: 2 })] },
      { a: 0.68, s: [S([[0.08, 0.32], [0.06, 0.15], [0.15, 0.07], [0.25, 0.15], [0.33, 0.06], [0.44, 0.06], [0.55, 0.15], [0.57, 0.55], [0.54, 0.95]], { sm: 2 })] },
      { a: 0.62, s: [S([[0.58, 0.06], [0.2, 0.16], [0.52, 0.38], [0.14, 0.5], [0.16, 0.86], [0.58, 0.88]], { sm: 1 })] },
      { a: 0.58, s: [S([[0.3, 0.08], [0.5, 0.28], [0.48, 0.7], [0.3, 0.9], [0.12, 0.7], [0.1, 0.28]], { c: 1, sm: 2 })] },
      { a: 0.52, s: [S([[0.1, 0.12], [0.42, 0.06], [0.36, 0.5], [0.3, 0.95]], { sm: 1 })] },
      { a: 0.6, s: [S([[0.08, 0.1], [0.3, 0.92], [0.52, 0.1]])] },
      { a: 0.6, s: [S([[0.08, 0.92], [0.3, 0.1], [0.52, 0.92]])] },
      { a: 0.56, s: [S(circle(0.27, 0.28, 0.2, 12), { c: 1 }), S([[0.47, 0.3], [0.47, 0.95]])] },
    ];
    G.persian = G.arabic.map((g) => g); // copy refs, override 4 5 6
    G.persian[4] = { a: 0.62, s: [S([[0.14, 0.14], [0.34, 0.44], [0.54, 0.08], [0.54, 0.95]], { sm: 1 })] };
    G.persian[5] = { a: 0.6, s: [S([[0.3, 0.14], [0.54, 0.3], [0.5, 0.8], [0.3, 0.62], [0.12, 0.8], [0.08, 0.3]], { c: 1, sm: 2 })] };
    G.persian[6] = { a: 0.58, s: [S([[0.54, 0.12], [0.42, 0.03], [0.3, 0.12], [0.36, 0.25], [0.5, 0.22], [0.3, 0.52], [0.17, 0.88]], { sm: 2 })] };
    G.devanagari = [
      { a: 0.74, s: [S(circle(0.36, 0.5, 0.33, 16), { c: 1 })] },
      { a: 0.72, s: [S(circle(0.3, 0.3, 0.22, 12), { c: 1 }), S([[0.52, 0.32], [0.54, 0.95]], { sm: 1 })] },
      { a: 0.72, s: [S([[0.16, 0.3], [0.2, 0.1], [0.42, 0.05], [0.54, 0.18], [0.46, 0.42], [0.26, 0.62], [0.19, 0.8]], { sm: 2 }), S([[0.19, 0.8], [0.6, 0.8]]), S([[0.19, 0.8], [0.16, 0.95]])] },
      { a: 0.72, s: [S([[0.32, 0.22], [0.22, 0.1], [0.34, 0.04], [0.48, 0.09], [0.53, 0.24], [0.4, 0.37], [0.55, 0.45], [0.58, 0.64], [0.46, 0.86], [0.26, 0.9], [0.16, 0.76]], { sm: 2 })] },
      { a: 0.76, s: [S([[0.14, 0.88], [0.28, 0.74], [0.42, 0.5], [0.44, 0.16], [0.3, 0.05], [0.16, 0.16], [0.2, 0.38], [0.36, 0.47], [0.5, 0.36]], { sm: 2 }), S([[0.58, 0.06], [0.58, 0.95]])] },
      { a: 0.76, s: [S([[0.18, 0.1], [0.42, 0.05], [0.48, 0.28], [0.34, 0.46], [0.2, 0.48], [0.13, 0.66], [0.26, 0.8], [0.4, 0.72]], { sm: 2 }), S([[0.58, 0.06], [0.58, 0.95]])] },
      { a: 0.74, s: [S([[0.52, 0.1], [0.32, 0.04], [0.2, 0.15], [0.3, 0.28], [0.46, 0.28], [0.28, 0.4], [0.18, 0.6], [0.28, 0.84], [0.48, 0.88], [0.58, 0.72], [0.48, 0.58], [0.34, 0.64]], { sm: 2 })] },
      { a: 0.72, s: [S(circle(0.27, 0.2, 0.13, 10), { c: 1 }), S([[0.39, 0.26], [0.54, 0.42], [0.55, 0.7], [0.42, 0.92]], { sm: 1 })] },
      { a: 0.7, s: [S([[0.5, 0.06], [0.3, 0.09], [0.2, 0.26], [0.32, 0.4], [0.5, 0.48], [0.57, 0.68], [0.46, 0.87], [0.28, 0.9]], { sm: 2 })] },
      { a: 0.72, s: [S(circle(0.32, 0.28, 0.2, 12), { c: 1 }), S([[0.52, 0.3], [0.5, 0.7], [0.56, 0.92]], { sm: 1 })] },
    ];
    G.mongolian = [
      { a: 0.7, s: [S(circle(0.34, 0.5, 0.3, 16), { c: 1 })] },
      { a: 0.66, s: [S([[0.3, 0.6], [0.2, 0.4], [0.26, 0.16], [0.44, 0.08], [0.56, 0.24], [0.54, 0.6], [0.38, 0.86], [0.26, 0.82]], { sm: 2 })] },
      { a: 0.74, s: [S([[0.14, 0.5], [0.16, 0.2], [0.32, 0.08], [0.48, 0.2], [0.5, 0.6], [0.54, 0.86], [0.66, 0.84], [0.66, 0.72]], { sm: 2 })] },
      { a: 0.78, s: [S([[0.12, 0.42], [0.14, 0.16], [0.26, 0.08], [0.34, 0.24], [0.42, 0.08], [0.54, 0.16], [0.55, 0.6], [0.6, 0.86], [0.7, 0.82], [0.7, 0.72]], { sm: 2 })] },
      { a: 0.7, s: [S([[0.3, 0.4], [0.22, 0.2], [0.36, 0.06], [0.54, 0.14], [0.58, 0.45], [0.5, 0.78], [0.32, 0.86], [0.24, 0.72], [0.34, 0.62]], { sm: 2 })] },
      { a: 0.74, s: [S([[0.18, 0.34], [0.12, 0.5], [0.2, 0.8], [0.42, 0.28], [0.48, 0.16], [0.68, 0.82]], { sm: 1 })] },
      { a: 0.7, s: [S([[0.56, 0.16], [0.4, 0.06], [0.22, 0.16], [0.18, 0.5], [0.24, 0.82], [0.44, 0.9], [0.56, 0.76], [0.54, 0.6], [0.38, 0.56]], { sm: 2 })] },
      { a: 0.76, s: [S([[0.12, 0.42], [0.14, 0.16], [0.26, 0.08], [0.34, 0.24], [0.42, 0.08], [0.56, 0.16], [0.6, 0.5], [0.56, 0.72], [0.42, 0.74], [0.38, 0.58], [0.5, 0.52]], { sm: 2 })] },
      { a: 0.7, s: [S([[0.4, 0.08], [0.58, 0.1], [0.2, 0.82], [0.62, 0.82], [0.66, 0.72]], { sm: 1 })] },
      { a: 0.7, s: [S([[0.58, 0.16], [0.42, 0.06], [0.26, 0.14], [0.22, 0.45], [0.26, 0.78], [0.46, 0.88], [0.58, 0.76], [0.54, 0.58], [0.38, 0.55]], { sm: 2 })] },
    ];
    G.chinese = [
      { a: 1.0, s: [S(circle(0.5, 0.5, 0.36, 16), { c: 1 })] },
      { a: 1.0, s: [S([[0.08, 0.52], [0.92, 0.52]])] },
      { a: 1.0, s: [S([[0.16, 0.3], [0.84, 0.3]]), S([[0.08, 0.74], [0.92, 0.74]])] },
      { a: 1.0, s: [S([[0.16, 0.2], [0.84, 0.2]]), S([[0.2, 0.5], [0.8, 0.5]]), S([[0.08, 0.82], [0.92, 0.82]])] },
      { a: 1.0, s: [S([[0.1, 0.2], [0.9, 0.2], [0.9, 0.84], [0.1, 0.84]], { c: 1 }), S([[0.38, 0.22], [0.3, 0.6]], { sm: 1 }), S([[0.58, 0.22], [0.58, 0.52], [0.66, 0.6]], { sm: 1 })] },
      { a: 1.0, s: [S([[0.14, 0.16], [0.86, 0.16]]), S([[0.46, 0.16], [0.32, 0.82]]), S([[0.34, 0.48], [0.66, 0.48], [0.7, 0.82]], { sm: 1 }), S([[0.08, 0.82], [0.92, 0.82]])] },
      { a: 1.0, s: [S([[0.5, 0.06], [0.54, 0.2]]), S([[0.1, 0.32], [0.9, 0.32]]), S([[0.38, 0.46], [0.16, 0.86]]), S([[0.62, 0.46], [0.84, 0.86]])] },
      { a: 1.0, s: [S([[0.08, 0.46], [0.92, 0.38]]), S([[0.48, 0.08], [0.5, 0.72], [0.58, 0.85], [0.8, 0.85], [0.84, 0.76]], { sm: 1 })] },
      { a: 1.0, s: [S([[0.44, 0.2], [0.34, 0.5], [0.14, 0.86]], { sm: 1 }), S([[0.56, 0.2], [0.66, 0.5], [0.86, 0.86]], { sm: 1 })] },
      { a: 1.0, s: [S([[0.4, 0.1], [0.36, 0.5], [0.14, 0.86]], { sm: 1 }), S([[0.2, 0.34], [0.62, 0.34], [0.66, 0.76], [0.76, 0.86], [0.86, 0.72]], { sm: 1 })] },
    ];
    // 7-segment: A top, B tr, C br, D bottom, E bl, F tl, G mid
    const seg7 = (() => {
      const w = 0.55, ym = 0.5, gp = 0.05;
      const L = {
        A: [[gp, 0], [w - gp, 0]], B: [[w, gp], [w, ym - gp]], C: [[w, ym + gp], [w, 1 - gp]],
        D: [[gp, 1], [w - gp, 1]], E: [[0, ym + gp], [0, 1 - gp]], F: [[0, gp], [0, ym - gp]], G: [[gp, ym], [w - gp, ym]],
      };
      const map = ["ABCDEF", "BC", "ABGED", "ABGCD", "FGBC", "AFGCD", "AFGECD", "ABC", "ABCDEFG", "ABCDFG"];
      return map.map((m) => ({ a: 0.55, s: [...m].map((k) => S(L[k])) }));
    })();
    // 14-segment
    const seg14 = (() => {
      const w = 0.62, xm = w / 2, ym = 0.5, gp = 0.05;
      const L = {
        A: [[gp, 0], [w - gp, 0]], B: [[w, gp], [w, ym - gp]], C: [[w, ym + gp], [w, 1 - gp]],
        D: [[gp, 1], [w - gp, 1]], E: [[0, ym + gp], [0, 1 - gp]], F: [[0, gp], [0, ym - gp]],
        g: [[gp, ym], [xm - gp, ym]], h: [[xm + gp, ym], [w - gp, ym]],
        H: [[gp, gp], [xm - gp, ym - gp]], J: [[w - gp, gp], [xm + gp, ym - gp]],
        K: [[gp, 1 - gp], [xm - gp, ym + gp]], M: [[w - gp, 1 - gp], [xm + gp, ym + gp]],
      };
      const map = ["ABCDEFJK", "BC", "ABghED", "ABCDh", "FghBC", "AFghCD", "AFghECD", "ABC", "ABCDEFgh", "ABCDFgh"];
      return map.map((m) => ({ a: 0.62, s: [...m].map((k) => S(L[k])) }));
    })();
    // dot matrix 5x7
    const dmBits = [
      ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
      ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
      ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
      ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
      ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
      ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
      ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
      ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
      ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
      ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    ];
    const dotmatrix = dmBits.map((rows) => {
      const pitch = 1 / 7, r = Math.min(dotR, pitch * 0.42);
      const s = [];
      rows.forEach((row, ry) => [...row].forEach((b, cx) => {
        if (b === "1") s.push(DOT(pitch / 2 + cx * pitch, pitch / 2 + ry * pitch, r));
      }));
      return { a: 5 * (1 / 7), s };
    });
    // braille (a-j patterns; 1=digit 1 ... 0=digit 10/j)
    const brBits = ["245", "1", "12", "14", "145", "15", "124", "1245", "125", "24"]; // index = digit
    const brCell = (bits) => {
      const px = [0.18, 0.5], py = [0.16, 0.5, 0.84];
      const pos = { 1: [px[0], py[0]], 2: [px[0], py[1]], 3: [px[0], py[2]], 4: [px[1], py[0]], 5: [px[1], py[1]], 6: [px[1], py[2]] };
      return { a: 0.68, s: [...bits].map((b) => { const q = pos[b]; return DOT(q[0], q[1]); }) };
    };
    const braille = brBits.map(brCell);
    const brNumSign = brCell("3456");

    const DIGIT_SYS = {
      "Eastern Arabic": G.arabic, "Persian": G.persian, "Devanagari": G.devanagari,
      "Mongolian": G.mongolian, "Chinese": G.chinese, "Dot matrix": dotmatrix,
      "7-segment": seg7, "14-segment": seg14, "Braille": braille,
    };

    // ---------- token renderers -> { s: strokes, w, h } (glyph units) ----------
    const rowOf = (glyphs) => {
      const s = []; let x = 0;
      for (const g of glyphs) {
        for (const st of g.s) s.push({ ...st, p: st.p.map(([px2, py2]) => [px2 + x, py2]) });
        x += g.a + sp;
      }
      return { s, w: Math.max(0, x - sp), h: 1 };
    };
    const renderers = {
      digits(tok, tab, prefix) {
        const gs = [];
        if (prefix) gs.push(prefix);
        for (const ch of tok) if (ch >= "0" && ch <= "9") gs.push(tab[+ch]);
        return gs.length ? rowOf(gs) : null;
      },
      western(tok) {
        const fr = fontStrokes(tok, 1, 1 + sp);
        return { s: fr.strokes.map((st) => S(st)), w: fr.width - 0.2 * (1 + sp), h: 1 };
      },
      roman(nRaw) {
        let n = nRaw;
        const GL = {
          I: { a: 0.2, s: [S([[0.1, 0], [0.1, 1]])] },
          V: { a: 0.62, s: [S([[0.02, 0], [0.31, 1]]), S([[0.6, 0], [0.31, 1]])] },
          X: { a: 0.6, s: [S([[0.02, 0], [0.58, 1]]), S([[0.58, 0], [0.02, 1]])] },
          L: { a: 0.52, s: [S([[0.06, 0], [0.06, 1], [0.5, 1]])] },
          C: { a: 0.62, s: [S(circle(0.34, 0.5, 0.42, 20).filter((q, i) => i >= 2 && i <= 18).reverse())] },
          D: { a: 0.66, s: [S([[0.08, 0], [0.08, 1]]), S(chaikin([[0.08, 0], [0.55, 0.08], [0.62, 0.5], [0.55, 0.92], [0.08, 1]], false, 2))] },
          M: { a: 0.82, s: [S([[0.02, 1], [0.08, 0], [0.41, 0.72], [0.74, 0], [0.8, 1]])] },
          N: { a: 0.62, s: [S([[0.06, 1], [0.06, 0], [0.56, 1], [0.56, 0]])] },
        };
        if (n <= 0) return rowOf([GL.N]);
        let out = "";
        while (n >= 1000) { out += "M"; n -= 1000; }
        const tbl = [[900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
        for (const [v, sy] of tbl) while (n >= v) { out += sy; n -= v; }
        return rowOf([...out].map((ch) => GL[ch]));
      },
      maya(n) {
        const digs = [];
        if (n === 0) digs.push(0);
        else { let m = n; while (m > 0) { digs.push(m % 20); m = Math.floor(m / 20); } }
        digs.reverse();
        const s = []; const cellH = 0.8, gap = 0.24;
        digs.forEach((d, i) => {
          const top = i * (cellH + gap);
          const bars = Math.floor(d / 5), dotsN = d % 5;
          if (d === 0) {
            // shell: pointed lens + inner ticks
            const lens = chaikin([[0.14, top + cellH - 0.16], [0.5, top + cellH - 0.34], [0.86, top + cellH - 0.16], [0.5, top + cellH + 0.0 - 0.02]], true, 2);
            s.push({ p: lens, c: 1, sm: 0 });
            s.push(S([[0.38, top + cellH - 0.24], [0.34, top + cellH - 0.1]]));
            s.push(S([[0.62, top + cellH - 0.24], [0.66, top + cellH - 0.1]]));
          } else {
            for (let b = 0; b < bars; b++) {
              const y = top + cellH - 0.08 - b * 0.16;
              s.push(S([[0.08, y - 0.05], [0.92, y - 0.05], [0.92, y + 0.05], [0.08, y + 0.05]], { c: 1 }));
            }
            if (dotsN > 0) {
              const y = top + cellH - 0.08 - bars * 0.16 - 0.1;
              const span = (dotsN - 1) * 0.2;
              for (let k = 0; k < dotsN; k++) s.push(DOT(0.5 - span / 2 + k * 0.2, y, 0.075));
            }
          }
        });
        return { s, w: 1, h: digs.length * (cellH + gap) - gap };
      },
      cistercian(nRaw) {
        const n = Math.max(0, Math.min(9999, nRaw));
        const dx = 0.36, y3 = 0.3;
        const q = (d, mx, my) => {
          // units quadrant strokes, mirrored by mx (x) / my (y)
          const X = (x) => 0.5 + (x - 0.5) * mx, Y = (y) => my > 0 ? y : 1 - y;
          const seg = (x1, y1, x2, y2) => S([[X(x1), Y(y1)], [X(x2), Y(y2)]]);
          const top = seg(0.5, 0, 0.5 + dx, 0), mid = seg(0.5, y3, 0.5 + dx, y3);
          const d1 = seg(0.5, 0, 0.5 + dx, y3), d2 = seg(0.5, y3, 0.5 + dx, 0);
          const vv = seg(0.5 + dx, 0, 0.5 + dx, y3);
          return [[], [top], [mid], [d1], [d2], [top, d2], [vv], [top, vv], [mid, vv], [top, mid, vv]][d];
        };
        const s = [S([[0.5, 0], [0.5, 1]])];
        s.push(...q(n % 10, 1, 1));
        s.push(...q(Math.floor(n / 10) % 10, -1, 1));
        s.push(...q(Math.floor(n / 100) % 10, 1, -1));
        s.push(...q(Math.floor(n / 1000) % 10, -1, -1));
        return { s, w: 1, h: 1 };
      },
      babylonian(n) {
        const digs = [];
        if (n === 0) digs.push(0);
        else { let m = n; while (m > 0) { digs.push(m % 60); m = Math.floor(m / 60); } }
        digs.reverse();
        const s = []; let x = 0;
        const wedgeV = (cx, ty, sc) => [ // unit wedge: triangle head + stem
          S([[cx - 0.07 * sc, ty], [cx + 0.07 * sc, ty], [cx, ty + 0.11 * sc]], { c: 1 }),
          S([[cx, ty + 0.11 * sc], [cx, ty + 0.3 * sc]]),
        ];
        const wedgeC = (lx, cy, sc) => [ // Winkelhaken: open corner + head
          S([[lx + 0.16 * sc, cy - 0.09 * sc], [lx, cy], [lx + 0.16 * sc, cy + 0.09 * sc]]),
          S([[lx + 0.1 * sc, cy - 0.05 * sc], [lx, cy], [lx + 0.1 * sc, cy + 0.05 * sc]]),
        ];
        for (const d of digs) {
          if (d === 0) { // late placeholder: two slanted small wedges
            s.push(S([[x + 0.05, 0.35], [x + 0.2, 0.5]]), S([[x + 0.12, 0.28], [x + 0.27, 0.43]]),
              S([[x + 0.05, 0.35], [x + 0.12, 0.28]], { c: 0 }));
            x += 0.42 + 0.35;
            continue;
          }
          const tens = Math.floor(d / 10), ones = d % 10;
          let gx = x;
          if (tens > 0) {
            const rows = Math.ceil(tens / 3);
            for (let t = 0; t < tens; t++) {
              const row = Math.floor(t / 3), col = t % 3;
              const inRow = Math.min(3, tens - row * 3);
              for (const st of wedgeC(gx + col * 0.2, 0.22 + row * 0.26 + (3 - inRow) * 0, 1)) s.push(st);
            }
            gx += Math.min(3, tens) * 0.2 + 0.08;
          }
          if (ones > 0) {
            const rows = Math.ceil(ones / 3);
            for (let u = 0; u < ones; u++) {
              const row = Math.floor(u / 3), col = u % 3;
              for (const st of wedgeV(gx + 0.08 + col * 0.16, 0.1 + row * 0.3, 1)) s.push(st);
            }
            gx += Math.min(3, ones) * 0.16 + 0.06;
          }
          x = Math.max(gx, x + 0.3) + 0.32;
        }
        return { s, w: Math.max(0.3, x - 0.32), h: 1 };
      },
      rods(tok) {
        const digs = [...tok].filter((c) => c >= "0" && c <= "9").map(Number);
        const s = []; let x = 0;
        const cw = 0.55;
        digs.forEach((d, idx) => {
          const fromRight = digs.length - 1 - idx;
          const vertical = fromRight % 2 === 0;
          if (d > 0) {
            if (vertical) {
              const n5 = d > 5 ? 1 : 0, nn = d - n5 * 5;
              if (n5) s.push(S([[x + 0.06, 0.18], [x + cw - 0.06, 0.18]]));
              const span = (nn - 1) * 0.12;
              for (let k = 0; k < nn; k++) s.push(S([[x + cw / 2 - span / 2 + k * 0.12, n5 ? 0.3 : 0.15], [x + cw / 2 - span / 2 + k * 0.12, 0.85]]));
            } else {
              const n5 = d > 5 ? 1 : 0, nn = d - n5 * 5;
              if (n5) s.push(S([[x + cw / 2, 0.12], [x + cw / 2, 0.34]]));
              const span = (nn - 1) * 0.14;
              for (let k = 0; k < nn; k++) s.push(S([[x + 0.06, (n5 ? 0.44 : 0.3) + k * 0.14], [x + cw - 0.06, (n5 ? 0.44 : 0.3) + k * 0.14]]));
            }
          }
          x += cw + sp;
        });
        return digs.length ? { s, w: x - sp, h: 1 } : null;
      },
      kaktovik(n) {
        const digs = [];
        if (n === 0) digs.push(0);
        else { let m = n; while (m > 0) { digs.push(m % 20); m = Math.floor(m / 20); } }
        digs.reverse();
        const gs = digs.map((d) => {
          if (d === 0) {
            return { a: 0.72, s: [S(chaikin([[0.12, 0.55], [0.3, 0.75], [0.52, 0.6], [0.4, 0.9], [0.6, 0.8]], false, 1))] };
          }
          const fives = Math.floor(d / 5), ones = d % 5;
          const pts = [];
          const topY0 = 0.08, topY1 = 0.42, botY0 = 0.55, botY1 = 0.95;
          const fw = 0.3, ow = 0.17;
          // fives: long zigzag on top (down-up-down...), left to right
          for (let k = 0; k <= fives; k++) if (fives) pts.push([0.06 + k * fw, k % 2 === 0 ? topY0 : topY1]);
          // connect into ones zigzag below (starts where fives ended or fresh)
          const startX = 0.06 + (fives ? fives * fw : 0);
          if (fives && ones) pts.push([startX, botY1]);
          for (let k = 0; k <= ones; k++) if (ones) pts.push([startX + k * ow, k % 2 === 0 ? botY1 : botY0]);
          const w = Math.max(fives * fw, (fives ? fives * fw : 0) + ones * ow) + 0.12;
          return { a: Math.max(0.35, w), s: [S(pts)] };
        });
        return rowOf(gs);
      },
    };

    const sys = p.system;
    const tokens = String(p.value == null ? "" : p.value).trim().split(/\s+/).filter((t) => t.length);
    const parseN = (t) => { const d = t.replace(/[^0-9]/g, ""); return d.length ? Math.min(1e9, parseInt(d, 10)) : null; };

    const boxes = [];
    for (const tok of tokens) {
      let b = null;
      if (sys === "Western") b = renderers.western(tok);
      else if (DIGIT_SYS[sys]) b = renderers.digits(tok, DIGIT_SYS[sys], sys === "Braille" && p.numSign ? brNumSign : null);
      else if (sys === "Counting rods") b = renderers.rods(tok);
      else {
        const n = parseN(tok);
        if (n != null) {
          if (sys === "Roman") b = renderers.roman(n);
          else if (sys === "Maya") b = renderers.maya(n);
          else if (sys === "Cistercian") b = renderers.cistercian(n);
          else if (sys === "Babylonian") b = renderers.babylonian(n);
          else if (sys === "Kaktovik") b = renderers.kaktovik(n);
        }
      }
      if (b) boxes.push(b);
    }
    if (!boxes.length) return applyStyle(EMPTY, ins[0]);

    // ---------- layout: lines of tokens, bottom-aligned, block centered ----------
    const perLine = Math.max(0, Math.round(p.perLine));
    const lines = [];
    if (perLine > 0) for (let i = 0; i < boxes.length; i += perLine) lines.push(boxes.slice(i, i + perLine));
    else lines.push(boxes);
    const wordGap = 0.5 + sp;
    const lineDims = lines.map((ln) => ({
      w: ln.reduce((a, b) => a + b.w, 0) + wordGap * (ln.length - 1),
      h: Math.max(...ln.map((b) => b.h)),
    }));
    const blockW = Math.max(...lineDims.map((d) => d.w));
    const blockH = lineDims.reduce((a, d) => a + d.h, 0) + Math.max(0, p.lineGap) * (lines.length - 1);

    const paths = [];
    let ly = 0;
    lines.forEach((ln, li) => {
      const lh = lineDims[li].h;
      let lx = (blockW - lineDims[li].w) / 2;
      for (const b of ln) {
        const yOff = ly + (lh - b.h); // bottom align
        for (const st of b.s) {
          let pts = st.p.map(([gx, gy]) => [gx + lx, gy + yOff]);
          if (st.sm) pts = chaikin(pts, st.c, st.sm);
          paths.push({
            pts: pts.map(([gx, gy]) => [
              ctx.W / 2 + p.tx - (blockW * size) / 2 + gx * size,
              ctx.H / 2 + p.ty - (blockH * size) / 2 + gy * size,
            ]),
            closed: st.c, layer: Math.round(p.layer),
          });
        }
        lx += b.w + wordGap;
      }
      ly += lh + Math.max(0, p.lineGap);
    });
    return applyStyle({ paths }, ins[0]);
  },
};
