import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "zine",
  name: "Zine",
  cat: "duo",
  desc: "Imposition for folded booklets: lays wired compositions onto one sheet in the order the FOLDS require, so the plotted sheet folds into a finished zine. Each input is a full-canvas composition scaled into its page panel (Fit / Stretch), exactly like Mini Canvas - the page inputs appear and disappear with the chosen Format, so a 4-page folio shows four pins and a 16-page saddle stitch sixteen. Formats: 8-page mini zine (the classic one-sheet, one-cut zine - top row prints upside down and the middle slit is drawn for you), 4-page folio (A4 folded once into an A5 booklet), 8- and 16-page saddle stitch (2-up per sheet side, Sheet picks which sheet of the stack), and Accordion (a leporello strip of 3-12 panels, optionally continuing on the back). Double-sided work runs through the Side selector: plot Front, turn the paper over, set Side to Back and plot again. The back-side imposition is derived from the front, never typed in - the page on the reverse of page k is its own recto/verso partner, and its panel is mirrored according to Flip axis (Long edge keeps the artwork upright, Short edge turns it 180 degrees, matching what the paper actually does), so pages land back-to-back with no hand arithmetic. Registration marks print at identical sheet coordinates on both sides and are symmetric under both flips, so they overprint themselves when the sheet is turned - the visual check that the flip landed. Aspect: a page panel rarely has the sheet's proportions, so Scaling decides who gives way - Fit letterboxes the whole canvas into the panel, Fill (crop) covers the panel and clips the overflow, Stretch distorts, and Rotate 90 + Fit / Fill turn the canvas a quarter turn first, which on A-series paper lands EXACTLY on the page proportions (an A4 landscape canvas rotated is an A4 portrait page - full bleed, no crop, no distortion, the artwork simply reads sideways on the sheet). Whenever the scaling crops or rotates, the overlay draws the source region: the part of your canvas that actually survives onto a page, so you can compose inside it. Trim marks, fold ticks or dashed fold lines, the mini-zine cut slit and optional panel frames all go on their own Mark pen (plot them in pencil and erase). Page numbers draws a big single-stroke numeral in each panel in that panel's own orientation: print once, fold it, and the imposition is proven. One-sided formats output nothing on Back.",
  ins: (node) => {
    const p = (node && node.params) || {};
    const fmt = p.format || "8-page mini zine";
    let n = 8;
    if (fmt === "4-page folio") n = 4;
    else if (fmt === "8-page mini zine" || fmt === "8-page saddle stitch") n = 8;
    else if (fmt === "16-page saddle stitch") n = 16;
    else if (fmt === "Accordion") {
      const panels = Math.max(3, Math.min(12, Math.round(p.panels || 6)));
      n = p.accBoth ? panels * 2 : panels;
    }
    n = Math.max(1, Math.min(24, n));
    return Array.from({ length: n }, (_, i) => Pin("paths", String(i + 1)));
  },
  outs: [Pin("paths")],
  params: [
    { key: "format", label: "Format", type: "select", options: ["8-page mini zine", "4-page folio", "8-page saddle stitch", "16-page saddle stitch", "Accordion"], def: "8-page mini zine" },
    { key: "sheet", label: "Sheet #", type: "slider", min: 1, max: 4, step: 1, def: 1, showIf: (p) => p.format === "8-page saddle stitch" || p.format === "16-page saddle stitch" },
    { key: "panels", label: "Panels", type: "slider", min: 3, max: 12, step: 1, def: 6, showIf: (p) => p.format === "Accordion" },
    { key: "accBoth", label: "Accordion both sides", type: "check", def: false, showIf: (p) => p.format === "Accordion" },
    { key: "side", label: "Side", type: "select", options: ["Front", "Back"], def: "Front" },
    { key: "flip", label: "Flip axis", type: "select", options: ["Long edge (turn sideways)", "Short edge (turn end over end)"], def: "Long edge (turn sideways)" },
    { key: "margin", label: "Sheet margin mm", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
    { key: "pad", label: "Page padding mm", type: "slider", min: 0, max: 20, step: 0.5, def: 3 },
    { key: "mode", label: "Scaling", type: "select", options: ["Fit", "Fill (crop)", "Stretch", "Rotate 90 + Fit", "Rotate 90 + Fill"], def: "Fit" },
    { key: "trim", label: "Trim marks", type: "check", def: true },
    { key: "fold", label: "Fold marks", type: "select", options: ["None", "Ticks", "Dashed lines"], def: "Ticks" },
    { key: "slit", label: "Cut slit", type: "check", def: true, showIf: (p) => p.format === "8-page mini zine" },
    { key: "reg", label: "Registration marks", type: "check", def: true },
    { key: "numbers", label: "Page numbers", type: "check", def: false },
    { key: "frames", label: "Panel frames", type: "check", def: false },
    { key: "framepen", label: "Frame pen", type: "pen", def: 0 },
    { key: "markPen", label: "Mark pen (pencil)", type: "pen", def: 1 },
  ],

  /* ---------------------------------------------------------------
     LAYOUT - duplicated verbatim in compute() and overlay().
     Keep the two copies identical; tools/validate-zine.mjs compares
     the overlay panel rects against the compute placement and FAILS
     on any drift, so a one-sided edit cannot ship.
     --------------------------------------------------------------- */
  overlay(p, ctx) {
    const { W, H } = ctx;
    /* --- layout (copy A) --- */
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 5, p.margin));
    const bx = m, by = m, bw = W - 2 * m, bh = H - 2 * m;
    if (bw < 10 || bh < 10) return [];
    const fmt = p.format;
    const back = p.side === "Back";
    const longEdge = String(p.flip || "").indexOf("Long") === 0;
    let cols = 1, rows = 1, front = [], folds = [], slit = null, rev = null, oneSided = false;
    if (fmt === "8-page mini zine") {
      cols = 4; rows = 2; oneSided = true;
      const top = [5, 4, 3, 2], bot = [6, 7, 8, 1];
      for (let c = 0; c < 4; c++) front.push({ c, r: 0, page: top[c], rot: 180 });
      for (let c = 0; c < 4; c++) front.push({ c, r: 1, page: bot[c], rot: 0 });
    } else if (fmt === "4-page folio") {
      cols = 2; rows = 1;
      front = [{ c: 0, r: 0, page: 4, rot: 0 }, { c: 1, r: 0, page: 1, rot: 0 }];
      rev = (k) => (k % 2 ? k + 1 : k - 1);
    } else if (fmt === "8-page saddle stitch" || fmt === "16-page saddle stitch") {
      cols = 2; rows = 1;
      const N = fmt === "8-page saddle stitch" ? 8 : 16;
      const s = Math.max(1, Math.min(N / 4, Math.round(p.sheet)));
      front = [{ c: 0, r: 0, page: N - 2 * (s - 1), rot: 0 }, { c: 1, r: 0, page: 2 * s - 1, rot: 0 }];
      rev = (k) => (k % 2 ? k + 1 : k - 1);
    } else {
      const n = Math.max(3, Math.min(12, Math.round(p.panels)));
      cols = n; rows = 1;
      oneSided = !p.accBoth;
      for (let c = 0; c < n; c++) front.push({ c, r: 0, page: c + 1, rot: 0 });
      rev = (k) => 2 * n - k + 1;
    }
    const pw = bw / cols, ph = bh / rows;
    for (let c = 1; c < cols; c++) folds.push({ x1: bx + c * pw, y1: by, x2: bx + c * pw, y2: by + bh });
    for (let r = 1; r < rows; r++) folds.push({ x1: bx, y1: by + r * ph, x2: bx + bw, y2: by + r * ph });
    if (fmt === "8-page mini zine") slit = { x1: bx + pw, y1: by + ph, x2: bx + 3 * pw, y2: by + ph };
    let cells;
    if (!back) cells = front;
    else if (oneSided) cells = [];
    else cells = front.map((f) => ({
      c: longEdge ? cols - 1 - f.c : f.c,
      r: longEdge ? f.r : rows - 1 - f.r,
      page: rev(f.page),
      rot: longEdge ? f.rot : (f.rot + 180) % 360,
    }));
    const panels = cells.map((q) => ({ x: bx + q.c * pw, y: by + q.r * ph, w: pw, h: ph, page: q.page, rot: q.rot }));
    /* --- end layout --- */
    const g = [{ kind: "rect", x: bx, y: by, w: bw, h: bh }];
    for (const q of panels) g.push({ kind: "rect", x: q.x, y: q.y, w: q.w, h: q.h });
    for (const f of folds) g.push({ kind: "arrow", x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2 });
    if (slit) g.push({ kind: "arrow", x1: slit.x1, y1: slit.y1, x2: slit.x2, y2: slit.y2 });
    /* source region: the part of the canvas that actually survives onto a page.
       Only the cropping modes lose anything, so only they get the guide. */
    if ((p.mode === "Fill (crop)" || p.mode === "Rotate 90 + Fill") && panels.length) {
      const padO = Math.max(0, Math.min(Math.min(pw, ph) / 2 - 1, p.pad));
      const cw = pw - 2 * padO, ch = ph - 2 * padO;
      const r90 = p.mode === "Rotate 90 + Fill";
      const sw = r90 ? H : W, sh = r90 ? W : H;
      if (cw > 1 && ch > 1) {
        const sc = Math.max(cw / sw, ch / sh);
        const vw = Math.min(sw, cw / sc), vh = Math.min(sh, ch / sc);
        const u0 = (sw - vw) / 2, v0 = (sh - vh) / 2;
        g.push({
          kind: "poly",
          pts: [[u0, v0], [u0 + vw, v0], [u0 + vw, v0 + vh], [u0, v0 + vh]]
            .map(([u, v]) => (r90 ? [v, H - u] : [u, v])),
        });
      }
    }
    return g;
  },

  compute(ins, p, ctx) {
    const { W, H } = ctx;
    /* --- layout (copy B) --- */
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 5, p.margin));
    const bx = m, by = m, bw = W - 2 * m, bh = H - 2 * m;
    if (bw < 10 || bh < 10) return EMPTY;
    const fmt = p.format;
    const back = p.side === "Back";
    const longEdge = String(p.flip || "").indexOf("Long") === 0;
    let cols = 1, rows = 1, front = [], folds = [], slit = null, rev = null, oneSided = false;
    if (fmt === "8-page mini zine") {
      cols = 4; rows = 2; oneSided = true;
      const top = [5, 4, 3, 2], bot = [6, 7, 8, 1];
      for (let c = 0; c < 4; c++) front.push({ c, r: 0, page: top[c], rot: 180 });
      for (let c = 0; c < 4; c++) front.push({ c, r: 1, page: bot[c], rot: 0 });
    } else if (fmt === "4-page folio") {
      cols = 2; rows = 1;
      front = [{ c: 0, r: 0, page: 4, rot: 0 }, { c: 1, r: 0, page: 1, rot: 0 }];
      rev = (k) => (k % 2 ? k + 1 : k - 1);
    } else if (fmt === "8-page saddle stitch" || fmt === "16-page saddle stitch") {
      cols = 2; rows = 1;
      const N = fmt === "8-page saddle stitch" ? 8 : 16;
      const s = Math.max(1, Math.min(N / 4, Math.round(p.sheet)));
      front = [{ c: 0, r: 0, page: N - 2 * (s - 1), rot: 0 }, { c: 1, r: 0, page: 2 * s - 1, rot: 0 }];
      rev = (k) => (k % 2 ? k + 1 : k - 1);
    } else {
      const n = Math.max(3, Math.min(12, Math.round(p.panels)));
      cols = n; rows = 1;
      oneSided = !p.accBoth;
      for (let c = 0; c < n; c++) front.push({ c, r: 0, page: c + 1, rot: 0 });
      rev = (k) => 2 * n - k + 1;
    }
    const pw = bw / cols, ph = bh / rows;
    for (let c = 1; c < cols; c++) folds.push({ x1: bx + c * pw, y1: by, x2: bx + c * pw, y2: by + bh });
    for (let r = 1; r < rows; r++) folds.push({ x1: bx, y1: by + r * ph, x2: bx + bw, y2: by + r * ph });
    if (fmt === "8-page mini zine") slit = { x1: bx + pw, y1: by + ph, x2: bx + 3 * pw, y2: by + ph };
    let cells;
    if (!back) cells = front;
    else if (oneSided) cells = [];
    else cells = front.map((f) => ({
      c: longEdge ? cols - 1 - f.c : f.c,
      r: longEdge ? f.r : rows - 1 - f.r,
      page: rev(f.page),
      rot: longEdge ? f.rot : (f.rot + 180) % 360,
    }));
    const panels = cells.map((q) => ({ x: bx + q.c * pw, y: by + q.r * ph, w: pw, h: ph, page: q.page, rot: q.rot }));
    /* --- end layout --- */

    if (!panels.length) return EMPTY;

    const out = [];
    const BUDGET = 120000;
    let total = 0;
    const emit = (pts, closed, layer) => {
      if (pts.length < 2 || total + pts.length > BUDGET) return;
      total += pts.length;
      out.push({
        pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
        closed, layer,
      });
    };
    const mk = Math.round(p.markPen);
    const pad = Math.max(0, Math.min(Math.min(pw, ph) / 2 - 1, p.pad));

    /* --- segment clipping (Liang-Barsky), used by the Fill modes --- */
    const clipSeg = (a, b, x0, y0, x1, y1) => {
      let t0 = 0, t1 = 1;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const tests = [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]];
      for (const [pp, qq] of tests) {
        if (Math.abs(pp) < 1e-12) { if (qq < 0) return null; continue; }
        const r = qq / pp;
        if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
        else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
      return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
    };
    const clipRect = (pts, closed, x0, y0, x1, y1) => {
      const E = 1e-9;
      const inside = (q) => q[0] >= x0 - E && q[0] <= x1 + E && q[1] >= y0 - E && q[1] <= y1 + E;
      if (pts.every(inside)) return [{ pts, closed }];
      const seq = closed ? pts.concat([pts[0]]) : pts;
      const runs = [];
      let run = [];
      for (let i = 0; i < seq.length - 1; i++) {
        const seg = clipSeg(seq[i], seq[i + 1], x0, y0, x1, y1);
        if (!seg) { if (run.length >= 2) runs.push(run); run = []; continue; }
        if (!run.length) run.push(seg[0]);
        else {
          const last = run[run.length - 1];
          if (Math.hypot(last[0] - seg[0][0], last[1] - seg[0][1]) > 1e-7) {
            if (run.length >= 2) runs.push(run);
            run = [seg[0]];
          }
        }
        run.push(seg[1]);
      }
      if (run.length >= 2) runs.push(run);
      return runs.map((r) => ({ pts: r, closed: false }));
    };

    /* place a full-canvas composition into a panel.
       Scaling resolves the aspect clash between the sheet canvas and the page:
       Rotate 90 turns the canvas a quarter turn first (A-series: exact fit),
       Fill covers the panel and clips, Fit letterboxes, Stretch distorts. */
    const rot90 = p.mode === "Rotate 90 + Fit" || p.mode === "Rotate 90 + Fill";
    const fill = p.mode === "Fill (crop)" || p.mode === "Rotate 90 + Fill";
    const stretch = p.mode === "Stretch";
    /* source space: the canvas, optionally turned a quarter turn clockwise */
    const sw = rot90 ? H : W, sh = rot90 ? W : H;
    const toSrc = ([x, y]) => (rot90 ? [H - y, x] : [x, y]);
    const place = (src, q) => {
      const x0 = q.x + pad, y0 = q.y + pad, cw = q.w - 2 * pad, ch = q.h - 2 * pad;
      if (cw <= 1 || ch <= 1) return;
      let sx, sy;
      if (stretch) { sx = cw / sw; sy = ch / sh; }
      else { sx = sy = fill ? Math.max(cw / sw, ch / sh) : Math.min(cw / sw, ch / sh); }
      const ox = x0 + (cw - sw * sx) / 2, oy = y0 + (ch - sh * sy) / 2;
      const flipRot = q.rot === 180;
      for (const pa of src.paths) {
        const mapped = pa.pts.map((pt) => {
          const s2 = toSrc(pt);
          return [ox + s2[0] * sx, oy + s2[1] * sy];
        });
        const parts = fill ? clipRect(mapped, pa.closed, x0, y0, x0 + cw, y0 + ch) : [{ pts: mapped, closed: pa.closed }];
        for (const part of parts) {
          emit(flipRot
            ? part.pts.map(([px, py]) => [2 * q.x + q.w - px, 2 * q.y + q.h - py])
            : part.pts, part.closed, pa.layer);
        }
      }
    };

    /* single-stroke numerals on a 0.6 x 1.0 box, y down */
    const GLYPH = {
      "0": [[[0, 0.12], [0.15, 0], [0.45, 0], [0.6, 0.12], [0.6, 0.88], [0.45, 1], [0.15, 1], [0, 0.88], [0, 0.12]]],
      "1": [[[0.1, 0.17], [0.3, 0], [0.3, 1]], [[0.08, 1], [0.52, 1]]],
      "2": [[[0, 0.17], [0.16, 0], [0.44, 0], [0.6, 0.17], [0.6, 0.34], [0, 0.86], [0, 1], [0.6, 1]]],
      "3": [[[0, 0], [0.6, 0], [0.26, 0.44], [0.48, 0.44], [0.6, 0.6], [0.6, 0.86], [0.44, 1], [0.14, 1], [0, 0.86]]],
      "4": [[[0.46, 1], [0.46, 0], [0, 0.72], [0.6, 0.72]]],
      "5": [[[0.6, 0], [0, 0], [0, 0.42], [0.42, 0.42], [0.6, 0.6], [0.6, 0.86], [0.44, 1], [0.12, 1], [0, 0.88]]],
      "6": [[[0.54, 0.06], [0.3, 0], [0.08, 0.18], [0, 0.58], [0.08, 0.92], [0.32, 1], [0.56, 0.9], [0.6, 0.66], [0.44, 0.48], [0.14, 0.5], [0, 0.66]]],
      "7": [[[0, 0], [0.6, 0], [0.26, 1]]],
      "8": [[[0.3, 0.48], [0.06, 0.38], [0.06, 0.1], [0.3, 0], [0.54, 0.1], [0.54, 0.38], [0.3, 0.48], [0.02, 0.62], [0.02, 0.9], [0.3, 1], [0.58, 0.9], [0.58, 0.62], [0.3, 0.48]]],
      "9": [[[0.06, 0.94], [0.3, 1], [0.52, 0.82], [0.6, 0.42], [0.52, 0.08], [0.28, 0], [0.04, 0.1], [0, 0.34], [0.16, 0.52], [0.46, 0.5], [0.6, 0.34]]],
    };
    const numberIn = (q) => {
      const s = String(q.page);
      const gh = Math.min(q.h * 0.3, q.w * 0.4, 22);
      const gw = gh * 0.6, gap = gh * 0.16;
      const tw = s.length * gw + (s.length - 1) * gap;
      const lx = q.x + (q.w - tw) / 2;
      const ly = q.y + q.h * 0.62;
      for (let i = 0; i < s.length; i++) {
        const strokes = GLYPH[s[i]] || [];
        for (const st of strokes) {
          emit(st.map(([gx, gy]) => {
            const px = lx + i * (gw + gap) + gx * gh, py = ly + gy * gh;
            return q.rot === 180 ? [2 * q.x + q.w - px, 2 * q.y + q.h - py] : [px, py];
          }), false, mk);
        }
      }
    };

    /* content + frames + numbers */
    for (const q of panels) {
      const src = ins[q.page - 1];
      if (src && src.paths && src.paths.length) place(src, q);
      if (p.frames) emit([[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h]], true, Math.round(p.framepen));
      if (p.numbers) numberIn(q);
    }

    /* trim marks: outward into the margin when there is room, else inward */
    if (p.trim) {
      const outward = m >= 2;
      const T = Math.min(5, outward ? m - 0.6 : Math.min(pw, ph) / 3);
      if (T > 0.5) {
        for (const [cx, cy, dx, dy] of [
          [bx, by, -1, -1], [bx + bw, by, 1, -1],
          [bx + bw, by + bh, 1, 1], [bx, by + bh, -1, 1],
        ]) {
          const sgn = outward ? 1 : -1;
          emit([[cx, cy], [cx + dx * T * sgn, cy]], false, mk);
          emit([[cx, cy], [cx, cy + dy * T * sgn]], false, mk);
        }
      }
    }

    /* fold marks */
    if (p.fold === "Ticks" || p.fold === "Dashed lines") {
      const outward = m >= 2;
      const T = Math.min(4, outward ? m - 0.6 : Math.min(pw, ph) / 4);
      for (const f of folds) {
        const vert = Math.abs(f.x1 - f.x2) < 1e-9;
        if (p.fold === "Dashed lines") {
          const len = vert ? f.y2 - f.y1 : f.x2 - f.x1;
          const dash = 3, gap2 = 3;
          for (let d = 0; d < len; d += dash + gap2) {
            const d2 = Math.min(d + dash, len);
            emit(vert ? [[f.x1, f.y1 + d], [f.x1, f.y1 + d2]] : [[f.x1 + d, f.y1], [f.x1 + d2, f.y1]], false, mk);
          }
        } else if (T > 0.5) {
          const s = outward ? 1 : -1;
          if (vert) {
            emit([[f.x1, f.y1], [f.x1, f.y1 - T * s]], false, mk);
            emit([[f.x2, f.y2], [f.x2, f.y2 + T * s]], false, mk);
          } else {
            emit([[f.x1, f.y1], [f.x1 - T * s, f.y1]], false, mk);
            emit([[f.x2, f.y2], [f.x2 + T * s, f.y2]], false, mk);
          }
        }
      }
    }

    /* mini-zine cut slit: solid line with end ticks so it reads as a CUT */
    if (slit && p.slit && !back) {
      emit([[slit.x1, slit.y1], [slit.x2, slit.y2]], false, mk);
      for (const sx of [slit.x1, slit.x2]) emit([[sx, slit.y1 - 1.6], [sx, slit.y1 + 1.6]], false, mk);
    }

    /* registration marks: identical sheet coordinates on both sides and
       symmetric under both flip axes, so they overprint after the flip */
    if (p.reg && m >= 3) {
      const r = Math.min(2.2, m / 2.4);
      const spots = [
        [bx + bw / 2, by - m / 2], [bx + bw / 2, by + bh + m / 2],
        [bx - m / 2, by + bh / 2], [bx + bw + m / 2, by + bh / 2],
      ];
      for (const [rx, ry] of spots) {
        if (rx < 1 || ry < 1 || rx > W - 1 || ry > H - 1) continue;
        const n = 24, pts = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          pts.push([rx + Math.cos(a) * r, ry + Math.sin(a) * r]);
        }
        emit(pts, true, mk);
        emit([[rx - r * 1.7, ry], [rx + r * 1.7, ry]], false, mk);
        emit([[rx, ry - r * 1.7], [rx, ry + r * 1.7]], false, mk);
      }
    }

    return { paths: out };
  },
};
