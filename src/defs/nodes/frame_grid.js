import { Pin, fontStrokes } from "../helpers.js";

export default {
  /* Frame Grid — animation frame imposition: lays animation frames into a
   * grid on one sheet, with camera fiducial markers for automated frame
   * extraction.
   *
   * Fill modes:
   *   - "Animate" (default): ONE input carrying the whole animation. The
   *     engine's frameFan seam (v2) re-evaluates the upstream once per
   *     frame (frameIdx 0..Total-1, frameCount = Total) and hands the
   *     collected frames to this node — Total frames on THIS node defines
   *     the animation's frame domain. Frames beyond one sheet's cells flow
   *     onto the next sheet: the OUTER ctx.frameIdx is the SHEET index
   *     (the Mesh Slice "Grid pages" idiom), so set ANIMATE Frames =
   *     ceil(Total / cells), scrub to flip sheets, and every per-frame
   *     export writes one complete sheet. Frame numbers run globally and a
   *     "P n/N" page tag lands bottom-right when there is more than one
   *     sheet. Evaluation cost multiplies by Total on every tweak.
   *   - "Inputs": Sheets-shaped — N paths inputs (2..16), input i lands in
   *     cell i. One export, one plot: the whole flipbook sheet in one job.
   *   - "Clock": a single input; its content lands in cell ctx.frameIdx
   *     (clamped). Set ANIMATE Frames = cell count and every per-frame
   *     export writes one cell; the files merge into the full sheet (same
   *     origin, disjoint cells). "Static parts" chooses whether markers /
   *     cell frames / numbers repeat in every per-frame file or appear only
   *     in frame 1's file.
   *
   * Geometry: every input is designed at full canvas size; the node maps
   * the WHOLE canvas rectangle into each cell with ONE uniform scale shared
   * by all cells (shrink, center, letterbox). This preserves frame-to-frame
   * registration — the property an animation lives on. "Fit each" instead
   * fits each input's own bounding box into its cell (contact-sheet use;
   * breaks registration, so it is not the default).
   *
   * Markers use the photo_trace marker language, plotted: four hatch-filled
   * squares whose CENTERS sit exactly 20 mm from the sheet corners, the
   * top-left one carrying a white center hole (diameter 0.4 x size) as the
   * orientation anchor. A frame-extraction tool can therefore reuse the
   * photo_trace 4-point DLT homography and marker detector unchanged.
   *
   * Content keeps its pen layers and any z component; chrome (markers,
   * cell frames, numbers, label) draws on its own pen. Chrome is emitted
   * FIRST so a point-budget truncation eats late cells, never the markers.
   * Unwired input = empty cell. No randomness — nothing to seed.
   */

  key: "frame_grid",
  name: "Frame Grid",
  cat: "duo",
  desc: "Animation frame imposition: lays frames into a grid with photo_trace-compatible fiducial markers for camera frame extraction. Animate mode takes the whole animation through ONE input via the frameFan engine seam and pages overflow frames onto further sheets (outer frameIdx = sheet, P n/N tag, global numbering; evaluation cost multiplies by Total frames). Inputs mode gives one pin per cell; Clock mode places a single input into cell frameIdx for per-frame export merging. Canvas maps into every cell with one shared scale so frames stay registered.",

  ins: (node) => {
    const p = node && node.params;
    const fill = (p && p.fill) || "Animate";
    if (fill === "Animate") return [Pin("paths", "animation")];
    if (fill === "Clock") return [Pin("paths", "frames")];
    const n = Math.max(2, Math.min(16, Math.round((p && p.count) || 6)));
    return Array.from({ length: n }, (_, i) => Pin("paths", "frame " + (i + 1)));
  },

  /* frameFan seam v2 hook: in Animate mode the engine collects this many
     frames of input 0 and passes them to compute as the ins array;
     returning 0 opts out (Inputs / Clock evaluate normally). */
  frameFan(node, merged) {
    const p = merged || (node && node.params) || {};
    if (((p.fill) || "Animate") !== "Animate") return 0;
    return Math.max(1, Math.min(64, Math.round(Number(p.total) || 12)));
  },
  outs: [Pin("paths")],

  params: [
    { key: "fill", label: "Fill", type: "select", options: ["Animate", "Inputs", "Clock"], def: "Animate" },
    { key: "total", label: "Total frames", type: "slider", min: 1, max: 64, step: 1, def: 12, showIf: (p) => p.fill === "Animate" },
    { key: "count", label: "Frames", type: "slider", min: 2, max: 16, step: 1, def: 6, showIf: (p) => p.fill === "Inputs" },
    { key: "layout", label: "Layout", type: "select", options: ["3\u00d72 \u00b7 6", "4\u00d73 \u00b7 12", "2\u00d72 \u00b7 4", "3\u00d73 \u00b7 9", "4\u00d74 \u00b7 16", "Custom"], def: "3\u00d72 \u00b7 6" },
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 6, step: 1, def: 3, showIf: (p) => p.layout === "Custom" },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 6, step: 1, def: 2, showIf: (p) => p.layout === "Custom" },
    { key: "order", label: "Order", type: "select", options: ["Row-major", "Column-major", "Boustrophedon"], def: "Row-major" },
    { key: "scale", label: "Cell scale", type: "select", options: ["Map canvas", "Fit each"], def: "Map canvas" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 30 },
    { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 20, step: 0.5, def: 8 },
    { key: "marks", label: "Markers", type: "select", options: ["On", "Off"], def: "On" },
    { key: "markSize", label: "Marker mm", type: "slider", min: 8, max: 15, step: 0.5, def: 15, showIf: (p) => p.marks === "On" },
    { key: "cellFrames", label: "Cell frames", type: "select", options: ["Off", "On"], def: "Off" },
    { key: "numbers", label: "Frame numbers", type: "select", options: ["Off", "On"], def: "Off" },
    { key: "labelText", label: "Label", type: "text", def: "" },
    { key: "chrome", label: "Static parts", type: "select", options: ["Every frame", "First frame only"], def: "Every frame", showIf: (p) => p.fill === "Clock" },
    { key: "penMark", label: "Marker pen", type: "pen", def: 0 },
  ],

  /* Shared layout: grid geometry, cell order and marker placement.
     compute() and overlay() both call this so the guides always match the ink
     (the Signature _layout pattern — the engine calls both as def methods). */
  _layout(p, ctx) {
    const W = (ctx && ctx.W) || 420, H = (ctx && ctx.H) || 297;
    const GRIDS = {
      "3\u00d72 \u00b7 6": [3, 2], "4\u00d73 \u00b7 12": [4, 3], "2\u00d72 \u00b7 4": [2, 2],
      "3\u00d73 \u00b7 9": [3, 3], "4\u00d74 \u00b7 16": [4, 4],
    };
    let cols, rows;
    if (p.layout === "Custom") {
      cols = Math.max(1, Math.min(6, Math.round(Number(p.cols) || 1)));
      rows = Math.max(1, Math.min(6, Math.round(Number(p.rows) || 1)));
    } else {
      const g = GRIDS[p.layout] || [3, 2];
      cols = g[0]; rows = g[1];
    }
    const m = Math.max(0, Number(p.margin) || 0);
    const gap = Math.max(0, Number(p.gap) || 0);
    const iw = W - 2 * m, ih = H - 2 * m;
    const cw = (iw - (cols - 1) * gap) / cols;
    const ch = (ih - (rows - 1) * gap) / rows;

    /* cell rects in reading positions (row-major grid walk) */
    const rects = [];
    if (cw > 1 && ch > 1) {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        rects.push({ x: m + c * (cw + gap), y: m + r * (ch + gap), w: cw, h: ch, c, r });
      }
    }

    /* frame index -> cell rect, per traversal order */
    const cells = [];
    if (rects.length) {
      if (p.order === "Column-major") {
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) cells.push(rects[r * cols + c]);
      } else if (p.order === "Boustrophedon") {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cc = r % 2 === 0 ? c : cols - 1 - c;
            cells.push(rects[r * cols + cc]);
          }
        }
      } else {
        for (const q of rects) cells.push(q);
      }
    }

    /* markers: photo_trace language — centers exactly 20 mm from the sheet
       corners, top-left carries the orientation hole (dia 0.4 x size) */
    const INSET = 20;
    const ms = Math.max(2, Math.min(15, Number(p.markSize) || 15));
    const markers = [
      { cx: INSET, cy: INSET, hole: true },
      { cx: W - INSET, cy: INSET, hole: false },
      { cx: W - INSET, cy: H - INSET, hole: false },
      { cx: INSET, cy: H - INSET, hole: false },
    ];

    /* one uniform canvas->cell scale, shared by all cells */
    const s = cw > 1 && ch > 1 ? Math.min(cw / W, ch / H) : 0;
    return { W, H, cols, rows, cw, ch, cells, markers, ms, s };
  },

  compute(ins, p, ctx, node) {
    const L = this._layout(p, ctx);
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.penMark) || 0)));
    const fill = p.fill || "Animate";
    const clock = fill === "Clock";
    const anim = fill === "Animate";
    const fIdx = (ctx && ctx.frameIdx) || 0;
    /* Animate paging: outer frameIdx = sheet index */
    const cellsN = L.cells.length;
    const total = anim ? Math.max(1, Math.min(64, Math.round(Number(p.total) || 12))) : 0;
    const pages = anim && cellsN ? Math.max(1, Math.ceil(total / cellsN)) : 1;
    const page = anim ? Math.min(pages - 1, Math.max(0, fIdx)) : 0;
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const push = (pts, closed, layer) => {
      if (used + pts.length > BUDGET) return false;
      used += pts.length;
      paths.push({ pts, closed, layer });
      return true;
    };

    /* ---- chrome first: markers, cell frames, numbers, label ----
       Animate draws full chrome on every sheet (each is a physical page) */
    const chromeOn = anim || !clock || p.chrome !== "First frame only" || fIdx === 0;

    if (chromeOn && p.marks === "On") {
      const h = L.ms / 2, PITCH = 0.6;
      for (const mk of L.markers) {
        push([[mk.cx - h, mk.cy - h], [mk.cx + h, mk.cy - h], [mk.cx + h, mk.cy + h], [mk.cx - h, mk.cy + h]], true, pen);
        const r = mk.hole ? 0.2 * L.ms : 0;
        const nL = Math.floor((L.ms - 0.6) / PITCH);
        for (let i = 0; i <= nL; i++) {
          const y = mk.cy - h + 0.3 + i * PITCH;
          if (y > mk.cy + h - 0.29) break;
          const flip = i % 2 === 1;
          const dy = y - mk.cy;
          if (r > 0 && Math.abs(dy) < r) {
            const dx = Math.sqrt(r * r - dy * dy);
            const a = [[mk.cx - h, y], [mk.cx - dx, y]];
            const b = [[mk.cx + dx, y], [mk.cx + h, y]];
            if (a[1][0] - a[0][0] > 0.2) push(flip ? [a[1], a[0]] : a, false, pen);
            if (b[1][0] - b[0][0] > 0.2) push(flip ? [b[1], b[0]] : b, false, pen);
          } else {
            const ln = [[mk.cx - h, y], [mk.cx + h, y]];
            push(flip ? [ln[1], ln[0]] : ln, false, pen);
          }
        }
        if (r > 0) {
          const c = [];
          for (let k = 0; k <= 32; k++) {
            const a = (k / 32) * Math.PI * 2;
            c.push([mk.cx + r * Math.cos(a), mk.cy + r * Math.sin(a)]);
          }
          c.pop();
          push(c, true, pen);
        }
      }
    }

    if (chromeOn && p.cellFrames === "On") {
      for (const q of L.cells) {
        push([[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h]], true, pen);
      }
    }

    if (chromeOn && p.numbers === "On") {
      const SZ = 3;
      L.cells.forEach((q, i) => {
        /* Animate: global frame numbers, only under occupied cells */
        const gi = anim ? page * cellsN + i : i;
        if (anim && gi >= total) return;
        const fs = fontStrokes(String(gi + 1), SZ);
        const tx = q.x + q.w / 2 - fs.width / 2;
        const ty = q.y + q.h + 1.2;
        if (ty + SZ > L.H - 0.5) return;
        for (const st of fs.strokes) push(st.map(([x, y]) => [tx + x, ty + y]), false, pen);
      });
    }

    if (chromeOn) {
      const txt = String(p.labelText == null ? "" : p.labelText).trim();
      if (txt) {
        const SZ = 4;
        const fs = fontStrokes(txt.toUpperCase(), SZ);
        const tx = L.W / 2 - fs.width / 2;
        const ty = L.H - 14;
        if (ty >= 0 && ty + SZ <= L.H - 0.5) {
          for (const st of fs.strokes) push(st.map(([x, y]) => [tx + x, ty + y]), false, pen);
        }
      }
      /* Animate multi-sheet: "P n/N" page tag bottom-right, clear of the
         BR marker (physical sheets read their own order) */
      if (anim && pages > 1) {
        const SZ = 4;
        const fs = fontStrokes("P " + (page + 1) + "/" + pages, SZ);
        const tx = L.W - 30 - fs.width;
        const ty = L.H - 14;
        if (tx >= 0 && ty >= 0 && ty + SZ <= L.H - 0.5) {
          for (const st of fs.strokes) push(st.map(([x, y]) => [tx + x, ty + y]), false, pen);
        }
      }
    }

    /* ---- content: one uniform map per cell ---- */
    const place = (src, q) => {
      if (!src || !src.paths || !src.paths.length || !q || L.s <= 0) return;
      let s, ox, oy;
      if (p.scale === "Fit each") {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const pa of src.paths) for (const pt of pa.pts) {
          if (pt[0] < x0) x0 = pt[0]; if (pt[0] > x1) x1 = pt[0];
          if (pt[1] < y0) y0 = pt[1]; if (pt[1] > y1) y1 = pt[1];
        }
        const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
        s = Math.min(q.w / bw, q.h / bh);
        ox = q.x + (q.w - bw * s) / 2 - x0 * s;
        oy = q.y + (q.h - bh * s) / 2 - y0 * s;
      } else {
        s = L.s;
        ox = q.x + (q.w - L.W * s) / 2;
        oy = q.y + (q.h - L.H * s) / 2;
      }
      for (const pa of src.paths) {
        const pts = pa.pts.map((pt) =>
          pt.length > 2 ? [ox + pt[0] * s, oy + pt[1] * s, pt[2]] : [ox + pt[0] * s, oy + pt[1] * s]);
        if (!push(pts, !!pa.closed, pa.layer)) return;
      }
    };

    if (anim) {
      /* the engine's frameFan seam passes the collected frames AS the ins
         array; without the seam ins holds whatever single frame was wired */
      for (let i = 0; i < cellsN; i++) {
        const gi = page * cellsN + i;
        if (gi < total) place(ins[gi], L.cells[i]);
      }
    } else if (clock) {
      const n = L.cells.length;
      if (n) place(ins[0], L.cells[Math.min(n - 1, Math.max(0, fIdx))]);
    } else {
      const n = Math.max(2, Math.min(16, Math.round(Number(p.count) || 6)));
      for (let i = 0; i < n && i < L.cells.length; i++) place(ins[i], L.cells[i]);
    }

    return { paths };
  },

  overlay(p, ctx) {
    const g = [];
    try {
      const L = this._layout(p, ctx);
      for (const q of L.cells) g.push({ kind: "rect", x: q.x, y: q.y, w: q.w, h: q.h });
      if (p.marks === "On") {
        const h = L.ms / 2;
        for (const mk of L.markers) {
          g.push({ kind: "rect", x: mk.cx - h, y: mk.cy - h, w: L.ms, h: L.ms });
          if (mk.hole) g.push({ kind: "circle", cx: mk.cx, cy: mk.cy, r: 0.2 * L.ms });
        }
      }
    } catch (e) { /* an overlay must never throw */ }
    return g.slice(0, 60);
  },
};
