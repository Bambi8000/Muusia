import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "cardsheet",
  name: "Card Sheet",
  cat: "duo",
  desc: "Imposition for postcards and folded cards, both sides of the paper. Lays a grid of cards on the sheet (the canvas is the paper) and scales a full-canvas composition into each card face, as Mini Canvas does - Fit letterboxes, Fill (crop) covers and clips, Stretch distorts, Rotate 90 turns the canvas a quarter turn first. Fold None gives a flat postcard with Front and Back pins; Vertical or Horizontal folds the card in the middle and the pins become Cover, Back cover and the two inside faces - the outside of a horizontal-fold card is laid out the way the paper really works (cover on top, upside down, so it reads upright once the card is folded and stands). Two-sided work runs through Side: plot Front (outside), turn the sheet over, switch to Back (inside) and plot again. The back layout is derived, never typed: the face behind each panel is its real partner (the back of the cover is the inside page you see when you open the card) and the whole sheet is mirrored according to Flip axis - Vertical axis for turning the sheet like a page (columns swap, artwork stays upright), Horizontal axis for turning it end over end (rows swap and everything turns 180 degrees, matching what the paper does). Registration marks print at identical sheet coordinates on both sides and are symmetric under both flips, so they overprint themselves when the flip lands. Three ways to nail the back to the front: (1) Back offset X/Y shifts the back-side content only, read off the Duplex test; (2) Trim frame draws one outline around the whole card grid - cut the sheet to it after the front, and the sheet's edges are now plotter-accurate instead of paper-mill-accurate, so the back registers against them; (3) Pin holes marks two 6 mm hole centres on the flip axis in the waste margin - punch them, register both sides on two pins, and the paper's cut tolerance stops mattering. Mode Duplex test draws no content but vernier scales at four points: front ticks 1.00 mm apart above the baseline, back ticks 1.10 mm apart below it. Hold the plotted sheet against the light with the back facing you: the tick pair that lines up, k ticks from the centre toward the arrow, means the back needs Back offset = 0.1 x k mm on that axis (negative when the pair is on the far side). Trim marks, fold ticks or dashed fold lines and panel frames go on the Mark pen; cards that do not fit the sheet are dropped and the overlay shows the grid that did.",
  ins: (node) => {
    const p = (node && node.params) || {};
    const fold = p.fold || "Vertical";
    if (fold === "None") return [Pin("paths", "Front"), Pin("paths", "Back")];
    if (fold === "Horizontal") return [Pin("paths", "Cover"), Pin("paths", "Back cover"), Pin("paths", "Inside top"), Pin("paths", "Inside bottom")];
    return [Pin("paths", "Cover"), Pin("paths", "Back cover"), Pin("paths", "Inside L"), Pin("paths", "Inside R")];
  },
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Cards", "Duplex test"], def: "Cards" },
    { key: "cardW", label: "Card width mm", type: "slider", min: 40, max: 300, step: 1, def: 140 },
    { key: "cardH", label: "Card height mm", type: "slider", min: 40, max: 300, step: 1, def: 200 },
    { key: "fold", label: "Fold", type: "select", options: ["None", "Vertical", "Horizontal"], def: "Vertical" },
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 6, step: 1, def: 2 },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 6, step: 1, def: 2 },
    { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 30, step: 0.5, def: 6 },
    { key: "margin", label: "Sheet margin mm", type: "slider", min: 0, max: 40, step: 0.5, def: 5 },
    { key: "scaling", label: "Scaling", type: "select", options: ["Fit", "Fill (crop)", "Stretch", "Rotate 90 + Fit", "Rotate 90 + Fill"], def: "Fit" },
    { key: "pad", label: "Panel padding mm", type: "slider", min: 0, max: 20, step: 0.5, def: 3 },
    { key: "side", label: "Side", type: "select", options: ["Front (outside)", "Back (inside)"], def: "Front (outside)" },
    { key: "flip", label: "Flip axis", type: "select", options: ["Vertical axis (turn like a page)", "Horizontal axis (turn end over end)"], def: "Vertical axis (turn like a page)" },
    { key: "backX", label: "Back offset X mm", type: "slider", min: -3, max: 3, step: 0.05, def: 0 },
    { key: "backY", label: "Back offset Y mm", type: "slider", min: -3, max: 3, step: 0.05, def: 0 },
    { key: "trim", label: "Trim marks", type: "check", def: true },
    { key: "foldMarks", label: "Fold marks", type: "select", options: ["None", "Ticks", "Dashed lines"], def: "Ticks", showIf: (p) => p.fold !== "None" },
    { key: "reg", label: "Registration marks", type: "check", def: true },
    { key: "trimFrame", label: "Trim frame", type: "check", def: false },
    { key: "pinHoles", label: "Pin holes", type: "check", def: false },
    { key: "frames", label: "Panel frames", type: "check", def: false },
    { key: "markPen", label: "Mark pen (pencil)", type: "pen", def: 1 },
  ],

  /* ---------------------------------------------------------------------
     LAYOUT - one function, used by compute() and overlay() so the guide
     can never drift from the output. Everything is computed in FRONT-VIEW
     sheet coordinates first; the back view is the front view mirrored about
     the vertical centre line (what a page turn shows), and a tumble flip is
     that mirror followed by a 180-degree turn of the whole sheet. That single
     rule covers card positions, panel positions, content orientation, the
     registration marks and the duplex scales alike.
     --------------------------------------------------------------------- */
  _layout(p, ctx) {
    const W = ctx.W, H = ctx.H;
    const m = Math.max(0, Math.min(Math.min(W, H) / 2 - 5, +p.margin || 0));
    const gap = Math.max(0, +p.gap || 0);
    const cw = Math.max(10, +p.cardW || 140);
    const ch = Math.max(10, +p.cardH || 200);
    const fitC = Math.max(0, Math.floor((W - 2 * m + gap) / (cw + gap) + 1e-9));
    const fitR = Math.max(0, Math.floor((H - 2 * m + gap) / (ch + gap) + 1e-9));
    const cols = Math.min(Math.max(1, Math.round(+p.cols || 1)), fitC);
    const rows = Math.min(Math.max(1, Math.round(+p.rows || 1)), fitR);
    const fold = p.fold === "None" || p.fold === "Horizontal" ? p.fold : "Vertical";
    const back = String(p.side || "").indexOf("Back") === 0;
    const tumble = String(p.flip || "").indexOf("Horizontal") === 0;
    const out = { W, H, m, gap, cw, ch, cols, rows, fold, back, tumble, dropped: (Math.round(+p.cols || 1) > cols) || (Math.round(+p.rows || 1) > rows), cards: [], panels: [], folds: [], grid: null };
    if (cols < 1 || rows < 1) return out;
    const gw = cols * cw + (cols - 1) * gap, gh = rows * ch + (rows - 1) * gap;
    const gx = (W - gw) / 2, gy = (H - gh) / 2;
    out.grid = { x: gx, y: gy, w: gw, h: gh };

    /* front-view faces per card: {fx, fy, fw, fh (fractions of the card), face, rot}
       faces: None -> 0 Front, 1 Back
              folded -> 0 Cover, 1 Back cover, 2 Inside L / top, 3 Inside R / bottom
       The back-view list is what a page turn reveals (already mirrored in x). */
    let frontFaces, backFaces;
    if (fold === "None") {
      frontFaces = [{ fx: 0, fy: 0, fw: 1, fh: 1, face: 0, rot: 0 }];
      backFaces = [{ fx: 0, fy: 0, fw: 1, fh: 1, face: 1, rot: 0 }];
    } else if (fold === "Vertical") {
      frontFaces = [{ fx: 0, fy: 0, fw: 0.5, fh: 1, face: 1, rot: 0 }, { fx: 0.5, fy: 0, fw: 0.5, fh: 1, face: 0, rot: 0 }];
      backFaces = [{ fx: 0, fy: 0, fw: 0.5, fh: 1, face: 2, rot: 0 }, { fx: 0.5, fy: 0, fw: 0.5, fh: 1, face: 3, rot: 0 }];
    } else {
      frontFaces = [{ fx: 0, fy: 0, fw: 1, fh: 0.5, face: 0, rot: 180 }, { fx: 0, fy: 0.5, fw: 1, fh: 0.5, face: 1, rot: 0 }];
      backFaces = [{ fx: 0, fy: 0, fw: 1, fh: 0.5, face: 2, rot: 0 }, { fx: 0, fy: 0.5, fw: 1, fh: 0.5, face: 3, rot: 0 }];
    }
    const faces = back ? backFaces : frontFaces;

    /* the view transform: front view = identity; back view = mirror x
       (page turn); tumble = mirror x then rotate 180 = mirror y. Applied to
       rects and to the content rotation (a rotate-180 flips upright/upside-down). */
    const mirX = back && !tumble, mirY = back && tumble;
    const xf = (x, w) => (mirX ? W - x - w : x);
    const yf = (y, h) => (mirY ? H - y - h : y);
    const rotf = (r) => (mirY ? (r + 180) % 360 : r);
    /* (mirror x, then rotate 180 about the centre) == mirror y: the tumble swaps
       rows instead of columns and turns every panel's content upside down */

    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = gx + c * (cw + gap), y = gy + r * (ch + gap);
      const card = { x: xf(x, cw), y: yf(y, ch), w: cw, h: ch, c, r };
      out.cards.push(card);
      for (const f of faces) {
        /* face fractions are given in the PAGE-TURN view already, so inside the
           (already transformed) card only the tumble moves them: rot180 of the card */
        const fx = mirY ? 1 - f.fx - f.fw : f.fx, fy = mirY ? 1 - f.fy - f.fh : f.fy;
        const pw = f.fw * cw, ph = f.fh * ch;
        out.panels.push({ x: card.x + fx * cw, y: card.y + fy * ch, w: pw, h: ph, face: f.face, rot: rotf(f.rot), card });
      }
      if (fold === "Vertical") out.folds.push({ x1: card.x + cw / 2, y1: card.y, x2: card.x + cw / 2, y2: card.y + ch });
      else if (fold === "Horizontal") out.folds.push({ x1: card.x, y1: card.y + ch / 2, x2: card.x + cw, y2: card.y + ch / 2 });
    }
    /* point transform for marks that must land on the same physical spot */
    out.pt = ([x, y]) => [mirX ? W - x : x, mirY ? H - y : y];
    return out;
  },

  overlay(p, ctx) {
    const L = this._layout(p, ctx);
    const g = [];
    if (L.grid) g.push({ kind: "rect", x: L.grid.x, y: L.grid.y, w: L.grid.w, h: L.grid.h });
    for (const c of L.cards) g.push({ kind: "rect", x: c.x, y: c.y, w: c.w, h: c.h });
    for (const f of L.folds) g.push({ kind: "arrow", x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2 });
    if (!L.cards.length) {
      /* nothing fits: show the requested card at the margin so the clash is visible */
      g.push({ kind: "rect", x: L.m, y: L.m, w: L.cw, h: L.ch });
    }
    /* source region for the cropping modes: the part of the canvas that survives */
    if ((p.scaling === "Fill (crop)" || p.scaling === "Rotate 90 + Fill") && L.panels.length) {
      const q = L.panels[0];
      const pad = Math.max(0, Math.min(Math.min(q.w, q.h) / 2 - 1, +p.pad || 0));
      const cw = q.w - 2 * pad, ch = q.h - 2 * pad;
      const r90 = p.scaling === "Rotate 90 + Fill";
      const sw = r90 ? L.H : L.W, sh = r90 ? L.W : L.H;
      if (cw > 1 && ch > 1) {
        const sc = Math.max(cw / sw, ch / sh);
        const vw = Math.min(sw, cw / sc), vh = Math.min(sh, ch / sc);
        const u0 = (sw - vw) / 2, v0 = (sh - vh) / 2;
        g.push({
          kind: "poly",
          pts: [[u0, v0], [u0 + vw, v0], [u0 + vw, v0 + vh], [u0, v0 + vh]].map(([u, v]) => (r90 ? [v, L.H - u] : [u, v])),
        });
      }
    }
    return g;
  },

  compute(ins, p, ctx) {
    const L = this._layout(p, ctx);
    const { W, H, m } = L;
    if (!L.cards.length) return EMPTY;
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
    const mk = Math.round(+p.markPen || 0);
    const duplex = p.mode === "Duplex test";
    /* back-side compensation: content and frames only, never the sheet marks */
    const ox = L.back ? (+p.backX || 0) : 0, oy = L.back ? (+p.backY || 0) : 0;
    const shift = (pts) => (ox || oy ? pts.map(([x, y]) => [x + ox, y + oy]) : pts);

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

    /* --- place a full-canvas composition into a panel (as Zine / Mini Canvas) --- */
    const rot90 = p.scaling === "Rotate 90 + Fit" || p.scaling === "Rotate 90 + Fill";
    const fill = p.scaling === "Fill (crop)" || p.scaling === "Rotate 90 + Fill";
    const stretch = p.scaling === "Stretch";
    const sw = rot90 ? H : W, sh = rot90 ? W : H;
    const toSrc = ([x, y]) => (rot90 ? [H - y, x] : [x, y]);
    const place = (src, q) => {
      const pad = Math.max(0, Math.min(Math.min(q.w, q.h) / 2 - 1, +p.pad || 0));
      const x0 = q.x + pad, y0 = q.y + pad, cw = q.w - 2 * pad, ch = q.h - 2 * pad;
      if (cw <= 1 || ch <= 1) return;
      let sx, sy;
      if (stretch) { sx = cw / sw; sy = ch / sh; }
      else { sx = sy = fill ? Math.max(cw / sw, ch / sh) : Math.min(cw / sw, ch / sh); }
      const ox0 = x0 + (cw - sw * sx) / 2, oy0 = y0 + (ch - sh * sy) / 2;
      const turned = q.rot === 180;
      for (const pa of src.paths) {
        if (!pa || !pa.pts || pa.pts.length < 2) continue;
        const mapped = pa.pts.map((pt) => { const s2 = toSrc(pt); return [ox0 + s2[0] * sx, oy0 + s2[1] * sy]; });
        const parts = fill ? clipRect(mapped, pa.closed, x0, y0, x0 + cw, y0 + ch) : [{ pts: mapped, closed: pa.closed }];
        for (const part of parts) {
          const pts = turned ? part.pts.map(([px, py]) => [2 * q.x + q.w - px, 2 * q.y + q.h - py]) : part.pts;
          emit(shift(pts), part.closed, pa.layer);
        }
      }
    };

    /* --- content + frames --- */
    if (!duplex) {
      for (const q of L.panels) {
        const src = ins[q.face];
        if (src && src.paths && src.paths.length) place(src, q);
        if (p.frames) emit(shift([[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h]]), true, mk);
      }
    }

    /* --- trim marks: L ticks at every card corner, into the gap / margin --- */
    const room = Math.min(m > 0.5 ? m - 0.6 : 0, L.gap > 0.5 ? L.gap / 2 - 0.3 : Infinity);
    const T = Math.min(4, room > 0.5 ? room : 0);
    if (p.trim && T > 0.5) {
      for (const c of L.cards) {
        for (const [cx, cy, dx, dy] of [[c.x, c.y, -1, -1], [c.x + c.w, c.y, 1, -1], [c.x + c.w, c.y + c.h, 1, 1], [c.x, c.y + c.h, -1, 1]]) {
          emit([[cx, cy], [cx + dx * T, cy]], false, mk);
          emit([[cx, cy], [cx, cy + dy * T]], false, mk);
        }
      }
    }

    /* --- fold marks --- */
    if (L.fold !== "None" && (p.foldMarks === "Ticks" || p.foldMarks === "Dashed lines")) {
      for (const f of L.folds) {
        const vert = Math.abs(f.x1 - f.x2) < 1e-9;
        if (p.foldMarks === "Dashed lines") {
          const len = vert ? f.y2 - f.y1 : f.x2 - f.x1;
          for (let d = 0; d < len; d += 6) {
            const d2 = Math.min(d + 3, len);
            emit(vert ? [[f.x1, f.y1 + d], [f.x1, f.y1 + d2]] : [[f.x1 + d, f.y1], [f.x1 + d2, f.y1]], false, mk);
          }
        } else if (T > 0.5) {
          if (vert) { emit([[f.x1, f.y1], [f.x1, f.y1 - T]], false, mk); emit([[f.x2, f.y2], [f.x2, f.y2 + T]], false, mk); }
          else { emit([[f.x1, f.y1], [f.x1 - T, f.y1]], false, mk); emit([[f.x2, f.y2], [f.x2 + T, f.y2]], false, mk); }
        }
      }
    }

    /* --- trim frame: one outline around the whole grid (trim-first registration) --- */
    if (p.trimFrame && L.grid) {
      const g = L.grid;
      emit([[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]], true, mk);
    }

    /* --- registration marks and pin holes: on the flip axis / sheet midlines,
           symmetric under both flips, so both sides overprint --- */
    const target = (rx, ry, r) => {
      if (rx < 1 || ry < 1 || rx > W - 1 || ry > H - 1) return;
      const n = 24, pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pts.push([rx + Math.cos(a) * r, ry + Math.sin(a) * r]); }
      emit(pts, true, mk);
      emit([[rx - r * 1.7, ry], [rx + r * 1.7, ry]], false, mk);
      emit([[rx, ry - r * 1.7], [rx, ry + r * 1.7]], false, mk);
    };
    const pinsV = p.pinHoles && !L.tumble, pinsH = p.pinHoles && L.tumble;
    if (p.reg && m >= 3) {
      const r = Math.min(2.2, m / 2.4);
      if (!pinsV) { target(W / 2, m / 2, r); target(W / 2, H - m / 2, r); }
      if (!pinsH) { target(m / 2, H / 2, r); target(W - m / 2, H / 2, r); }
    }
    if (p.pinHoles && m >= 4) {
      const r = Math.min(3, m / 2 - 0.6);
      const spots = pinsV ? [[W / 2, m / 2], [W / 2, H - m / 2]] : [[m / 2, H / 2], [W - m / 2, H / 2]];
      for (const [px, py] of spots) {
        const n = 32, pts = [];
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pts.push([px + Math.cos(a) * r, py + Math.sin(a) * r]); }
        emit(pts, true, mk);
        emit([[px - r * 1.4, py], [px + r * 1.4, py]], false, mk);
        emit([[px, py - r * 1.4], [px, py + r * 1.4]], false, mk);
      }
    }

    /* --- duplex test: vernier scales. Front pitch 1.00 above the baseline,
           back pitch 1.10 below it; the coincident pair k gives 0.1 k mm.
           Positions are defined in the front view and pushed through the same
           flip transform as the content, so both halves meet on the paper. --- */
    if (duplex && L.grid) {
      const g = L.grid;
      const pitch = L.back ? 1.1 : 1.0;
      const K = 10, tick = 4;
      const inset = Math.min(12, Math.max(6, m + 4));
      /* front-view anchors: two horizontal (X) scales top/bottom, two vertical (Y) scales left/right */
      const anchors = [
        { x: g.x + g.w * 0.25, y: g.y + inset, axis: "x" },
        { x: g.x + g.w * 0.75, y: g.y + g.h - inset, axis: "x" },
        { x: g.x + inset, y: g.y + g.h * 0.25, axis: "y" },
        { x: g.x + g.w - inset, y: g.y + g.h * 0.75, axis: "y" },
      ];
      const sgn = L.back ? -1 : 1;
      for (const a of anchors) {
        const c = L.pt([a.x, a.y]);
        const along = a.axis === "x" ? [1, 0] : [0, 1];
        const across = a.axis === "x" ? [0, 1] : [1, 0];
        /* baseline */
        emit([[c[0] - along[0] * (K + 1) * pitch, c[1] - along[1] * (K + 1) * pitch], [c[0] + along[0] * (K + 1) * pitch, c[1] + along[1] * (K + 1) * pitch]], false, mk);
        for (let k = -K; k <= K; k++) {
          const len = k === 0 ? tick * 1.6 : (k % 5 === 0 ? tick * 1.25 : tick);
          const bx = c[0] + along[0] * k * pitch, by = c[1] + along[1] * k * pitch;
          emit([[bx, by], [bx - across[0] * len * sgn, by - across[1] * len * sgn]], false, mk);
        }
        /* arrow head at the + end (plot X / Y direction) */
        const ex = c[0] + along[0] * (K + 1) * pitch, ey = c[1] + along[1] * (K + 1) * pitch;
        emit([[ex - along[0] * 2 - across[0] * 1.2, ey - along[1] * 2 - across[1] * 1.2], [ex, ey], [ex - along[0] * 2 + across[0] * 1.2, ey - along[1] * 2 + across[1] * 1.2]], false, mk);
      }
    }

    return { paths: out };
  },
};
