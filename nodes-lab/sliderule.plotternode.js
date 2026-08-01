({
  key: "sliderule",
  name: "Slide Rule",
  cat: "gen",
  group: "scientific",
  desc: "Slide rule scales with real mathematics: C and D (log 1-10), A and B (two decades, squares), K (three decades, cubes), CI (inverted C, classically red - own pen), L (linear mantissa), S (sines, 5.74-90 deg at 1+log10 sin) and T (tangents to 45 deg). Tick subdivision adapts to physical length so gaps never drop below Min tick gap; three graded tick heights, single-stroke numerals and scale letters. Style Straight stacks the enabled scales as a Mannheim rule with body frame and slide separators around B/CI/C; Circular wraps each decade around a full 360-degree ring (multiplication = angle addition), numerals rotated to the tangent. Cursor draws a hairline across all scales at Cursor position - wire Frame into it and the cursor sweeps through an animation.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "style", label: "Style", type: "select", options: ["Straight", "Circular"], def: "Straight" },
    { key: "scA", label: "A (x\u00b2)", type: "check", def: true },
    { key: "scB", label: "B (x\u00b2 slide)", type: "check", def: false },
    { key: "scCI", label: "CI (1/x)", type: "check", def: true },
    { key: "scC", label: "C", type: "check", def: true },
    { key: "scD", label: "D", type: "check", def: true },
    { key: "scK", label: "K (x\u00b3)", type: "check", def: false },
    { key: "scL", label: "L (lg x)", type: "check", def: true },
    { key: "scS", label: "S (sin)", type: "check", def: false },
    { key: "scT", label: "T (tan)", type: "check", def: false },
    { key: "tickH", label: "Tick height mm", type: "slider", min: 1.5, max: 10, step: 0.1, def: 4 },
    { key: "tickMin", label: "Min tick gap mm", type: "slider", min: 0.4, max: 3, step: 0.05, def: 0.8 },
    { key: "rowGap", label: "Row gap mm (straight)", type: "slider", min: 4, max: 30, step: 0.5, def: 11 },
    { key: "numbers", label: "Numerals", type: "check", def: true },
    { key: "numSize", label: "Numeral size mm", type: "slider", min: 1.5, max: 8, step: 0.1, def: 2.6 },
    { key: "frame", label: "Body frame", type: "check", def: true },
    { key: "cursor", label: "Cursor line", type: "check", def: true },
    { key: "cursorPos", label: "Cursor position %", type: "slider", min: 0, max: 100, step: 0.1, def: 31.4 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Scale pen", type: "pen", def: 0 },
    { key: "numPen", label: "Numeral pen", type: "pen", def: 0 },
    { key: "ciPen", label: "CI pen", type: "pen", def: 2 },
    { key: "curPen", label: "Cursor pen", type: "pen", def: 3 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
    if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
    const paths = [];
    const L = Math.round(p.layer), NP = Math.round(p.numPen), CIP = Math.round(p.ciPen);

    /* ---------- scale definitions: pos(v) in 0..1 + numeral/segment plan ---- */
    const lg = Math.log10 ? ((v) => Math.log10(v)) : ((v) => Math.log(v) / Math.LN10);
    /* decades(k): k stacked decades (A=2, K=3); numerals single-digit per decade */
    const decades = (k) => {
      const majors = [];
      const segs = [];
      for (let d = 0; d < k; d++) {
        for (let v = 1; v <= (d === k - 1 ? 10 : 9); v++) {
          majors.push({ pos: (d + lg(v)) / k, txt: String(v === 10 ? 10 : v) });
        }
        for (let v = 1; v < 10; v++) {
          segs.push({ a: v, b: v + 1, pos: (x) => (d + lg(x)) / k });
        }
      }
      return { majors, segs };
    };
    const sinScale = () => {
      const angles = [6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 40, 50, 60, 70, 80, 90];
      const f = (a) => 1 + lg(Math.sin((a * Math.PI) / 180));
      const majors = angles.map((a) => ({ pos: f(a), txt: String(a) }));
      const segs = [];
      for (let i = 0; i < angles.length - 1; i++) segs.push({ a: angles[i], b: angles[i + 1], pos: f });
      return { majors, segs };
    };
    const tanScale = () => {
      const angles = [6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45];
      const f = (a) => 1 + lg(Math.tan((a * Math.PI) / 180));
      const majors = angles.map((a) => ({ pos: f(a), txt: String(a) }));
      const segs = [];
      for (let i = 0; i < angles.length - 1; i++) segs.push({ a: angles[i], b: angles[i + 1], pos: f });
      return { majors, segs };
    };
    const linScale = () => {
      const majors = [];
      const segs = [];
      for (let v = 0; v <= 10; v++) majors.push({ pos: v / 10, txt: String(v) });
      for (let v = 0; v < 10; v++) segs.push({ a: v, b: v + 1, pos: (x) => x / 10 });
      return { majors, segs };
    };
    const inv = (sc) => ({
      majors: sc.majors.map((mj) => ({ pos: 1 - mj.pos, txt: mj.txt })),
      segs: sc.segs.map((sg) => ({ a: sg.a, b: sg.b, pos: (x) => 1 - sg.pos(x) })),
    });

    const DEFS2 = [
      { key: "scK", name: "K", make: () => decades(3), group: "body" },
      { key: "scA", name: "A", make: () => decades(2), group: "body" },
      { key: "scB", name: "B", make: () => decades(2), group: "slide" },
      { key: "scCI", name: "CI", make: () => inv(decades(1)), group: "slide", pen: CIP },
      { key: "scC", name: "C", make: () => decades(1), group: "slide" },
      { key: "scD", name: "D", make: () => decades(1), group: "body" },
      { key: "scL", name: "L", make: () => linScale(), group: "body" },
      { key: "scS", name: "S", make: () => sinScale(), group: "body" },
      { key: "scT", name: "T", make: () => tanScale(), group: "body" },
    ];
    const enabled = DEFS2.filter((d) => p[d.key]);
    if (!enabled.length) return applyStyle({ paths: [] }, ins[0]);

    /* ---------- tick list for one scale at physical length len ------------- */
    const tickMin = Math.max(0.15, p.tickMin);
    const ticksFor = (sc, len) => {
      const out = sc.majors.map((mj) => ({ pos: mj.pos, lvl: 0, txt: mj.txt }));
      for (const sg of sc.segs) {
        const span = sg.b - sg.a;
        /* candidate value-steps, coarse to fine */
        const cands = [span / 2, span / 4, span / 10, span / 20, span / 50, span / 100];
        let step = 0, rank = -1;
        for (let ci = 0; ci < cands.length; ci++) {
          const st = cands[ci];
          /* worst-case physical gap within this segment at this step */
          let worst = Infinity;
          for (let v = sg.a; v < sg.b - 1e-9; v += st) {
            const g = Math.abs(sg.pos(Math.min(sg.b, v + st)) - sg.pos(v)) * len;
            worst = Math.min(worst, g);
          }
          if (worst >= tickMin) { step = st; rank = ci; }
        }
        if (!step) continue;
        const nSub = Math.round(span / step);
        for (let k = 1; k < nSub; k++) {
          const v = sg.a + k * step;
          /* level: halves are mid, everything finer is fine */
          const isHalf = Math.abs(v - (sg.a + span / 2)) < step * 0.25;
          out.push({ pos: sg.pos(v), lvl: isHalf ? 1 : 2 });
        }
      }
      return out;
    };
    const HN = [1, 0.62, 0.36]; /* tick height by level */

    /* ---------- numerals via stroke font -------------------------------- */
    const glyph = (txt, x, y, size, ang, pen) => {
      const fss = fontStrokes(txt, size, 1);
      const cA = Math.cos(ang), sA = Math.sin(ang);
      const ox2 = -fss.width / 2, oy2 = -size; /* centered above anchor */
      for (const st of fss.strokes) {
        const pts = st.map(([gx, gy]) => {
          const lx = ox2 + gx, ly = oy2 + gy;
          return [x + lx * cA - ly * sA, y + lx * sA + ly * cA];
        });
        const loop = pts.length > 3 &&
          Math.abs(pts[0][0] - pts[pts.length - 1][0]) < 1e-6 &&
          Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-6;
        if (loop) pts.pop();
        paths.push({ pts, closed: loop, layer: pen });
      }
    };

    if (p.style === "Straight") {
      /* left gutter for scale letters */
      const gut = 8 + p.numSize;
      const sx0 = x0 + gut, sx1 = x1 - 4;
      const len = sx1 - sx0;
      const n = enabled.length;
      const rowGap = Math.min(p.rowGap, (y1 - y0 - 10) / Math.max(1, n));
      const totalH = (n - 1) * rowGap;
      const yTop = (y0 + y1) / 2 - totalH / 2;
      const rows = enabled.map((d, i) => ({ ...d, y: yTop + i * rowGap }));

      rows.forEach((row) => {
        const pen = row.pen !== undefined ? row.pen : L;
        const sc = row.make();
        /* baseline */
        paths.push({ pts: [[sx0, row.y], [sx1, row.y]], closed: false, layer: pen });
        /* scale letter */
        if (p.numbers) glyph(row.name, x0 + gut / 2 - 2, row.y + p.numSize * 1.3, p.numSize, 0, pen === CIP ? CIP : NP);
        /* ticks down, numerals above */
        for (const t of ticksFor(sc, len)) {
          const tx = sx0 + t.pos * len;
          const h = p.tickH * HN[t.lvl];
          paths.push({ pts: [[tx, row.y], [tx, row.y + h]], closed: false, layer: pen });
          if (t.txt !== undefined && p.numbers) {
            glyph(t.txt, tx, row.y - 0.8, p.numSize, 0, pen === CIP ? CIP : NP);
          }
        }
      });
      if (p.frame) {
        const fy0 = rows[0].y - p.tickH - p.numSize * 1.6;
        const fy1 = rows[rows.length - 1].y + p.tickH + p.numSize * 0.6;
        paths.push({ pts: [[x0, fy0], [x1, fy0], [x1, fy1], [x0, fy1]], closed: true, layer: L });
        /* slide separators around the B/CI/C group */
        const sRows = rows.filter((r) => r.group === "slide");
        if (sRows.length && sRows.length < rows.length) {
          const sy0 = sRows[0].y - rowGap * 0.5;
          const sy1 = sRows[sRows.length - 1].y + rowGap * 0.5;
          if (sy0 > fy0 + 1) paths.push({ pts: [[x0, sy0], [x1, sy0]], closed: false, layer: L });
          if (sy1 < fy1 - 1) paths.push({ pts: [[x0, sy1], [x1, sy1]], closed: false, layer: L });
        }
      }
      if (p.cursor) {
        const cxx = sx0 + (Math.max(0, Math.min(100, p.cursorPos)) / 100) * len;
        const cy0 = rows[0].y - p.tickH - 1;
        const cy1 = rows[rows.length - 1].y + p.tickH + 1;
        paths.push({ pts: [[cxx, cy0], [cxx, cy1]], closed: false, layer: Math.round(p.curPen) });
      }
    } else {
      /* -------- Circular: one ring per scale, decade wraps 360deg -------- */
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const Rmax = Math.min(x1 - x0, y1 - y0) / 2 - p.numSize * 2 - 2;
      const ringGap = Math.max(p.tickH + p.numSize * 1.5 + 1.5, Rmax / (enabled.length + 1));
      enabled.forEach((row, i) => {
        const pen = row.pen !== undefined ? row.pen : L;
        const r = Rmax - i * ringGap;
        if (r < 6) return;
        const sc = row.make();
        /* baseline circle */
        const nC = Math.max(48, Math.ceil((Math.PI * 2 * r) / 0.7));
        const cpts = [];
        for (let k = 0; k < nC; k++) {
          const a = (k / nC) * Math.PI * 2;
          cpts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        paths.push({ pts: cpts, closed: true, layer: pen });
        /* ticks inward, numerals outside rotated to tangent */
        for (const t of ticksFor(sc, Math.PI * 2 * r)) {
          const a = -Math.PI / 2 + t.pos * Math.PI * 2;
          const ux = Math.cos(a), uy = Math.sin(a);
          const h = p.tickH * HN[t.lvl];
          paths.push({
            pts: [[cx + ux * r, cy + uy * r], [cx + ux * (r - h), cy + uy * (r - h)]],
            closed: false, layer: pen,
          });
          if (t.txt !== undefined && p.numbers) {
            glyph(t.txt, cx + ux * (r + 0.8), cy + uy * (r + 0.8), p.numSize, a + Math.PI / 2, pen === CIP ? CIP : NP);
          }
        }
        /* scale letter inside the ring at the top */
        if (p.numbers) glyph(row.name, cx, cy - r + p.tickH + p.numSize * 1.6, p.numSize, 0, pen === CIP ? CIP : NP);
      });
      if (p.cursor) {
        const a = -Math.PI / 2 + (Math.max(0, Math.min(100, p.cursorPos)) / 100) * Math.PI * 2;
        const rIn = Math.max(4, Rmax - enabled.length * ringGap);
        paths.push({
          pts: [[cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn], [cx + Math.cos(a) * (Rmax + p.numSize * 1.8), cy + Math.sin(a) * (Rmax + p.numSize * 1.8)]],
          closed: false, layer: Math.round(p.curPen),
        });
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
