import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "minicanvas",
    name: "Mini Canvas",
    cat: "duo",
    desc: "Lays out miniatures of full-canvas compositions on one sheet. Auto grid packs each wired input (A-F) into its own cell - a contact sheet. Fixed size makes production runs: set one mini size (e.g. postcard 148 x 105) and a count, and copies fill the sheet, cycling through the wired inputs. L cut marks at every mini's corners and T fold marks (position in mm from the card's left/top edge, vertical/horizontal/both) go on their own Mark pen - plot them in pencil and erase after cutting. Fit preserves aspect; Stretch fills.",
    ins: [Pin("paths", "A"), Pin("paths", "B"), Pin("paths", "C"), Pin("paths", "D"), Pin("paths", "E"), Pin("paths", "F")],
    outs: [Pin("paths")],
    params: [
      { key: "layout", label: "Layout", type: "select", options: ["Auto grid", "Fixed size"], def: "Auto grid" },
      { key: "miniW", label: "Mini width mm", type: "slider", min: 20, max: 400, step: 1, def: 148 },
      { key: "miniH", label: "Mini height mm", type: "slider", min: 20, max: 400, step: 1, def: 105 },
      { key: "count", label: "Copies (Fixed)", type: "slider", min: 1, max: 64, step: 1, def: 12 },
      { key: "cols", label: "Columns (Auto)", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 30, step: 0.5, def: 8 },
      { key: "mode", label: "Scaling", type: "select", options: ["Fit", "Stretch"], def: "Fit" },
      { key: "cutMarks", label: "L cut marks", type: "check", def: false },
      { key: "fold", label: "T fold marks", type: "select", options: ["None", "Vertical", "Horizontal", "Both"], def: "None" },
      { key: "foldMM", label: "Fold at mm (from left/top)", type: "slider", min: 1, max: 400, step: 0.5, def: 74 },
      { key: "markPen", label: "Mark pen (pencil)", type: "pen", def: 1 },
      { key: "frames", label: "Cell frames", type: "check", def: false },
      { key: "framepen", label: "Frame pen", type: "pen", def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const wired = [];
      for (let i = 0; i < 6; i++) if (ins[i] && ins[i].paths) wired.push(ins[i]);
      if (!wired.length) return EMPTY;
      const m = Math.max(0, p.margin);
      const gap = Math.max(0, p.gap);
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const emit = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        out.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      /* place one composition into cell (cx0,cy0,cw,ch) */
      const place = (src, cx0, cy0, cw, ch) => {
        let sx = cw / W, sy = ch / H, ox = cx0, oy = cy0;
        if (p.mode === "Fit") {
          const s = Math.min(sx, sy);
          ox = cx0 + (cw - W * s) / 2;
          oy = cy0 + (ch - H * s) / 2;
          sx = sy = s;
        }
        for (const pa of src.paths) {
          emit(pa.pts.map(([x, y]) => [ox + x * sx, oy + y * sy]), pa.closed, pa.layer);
        }
      };
      const mk = Math.round(p.markPen);
      const ML = 5; /* mark stroke mm */
      const cellMarks = (x0, y0, cw, ch) => {
        if (p.frames) {
          emit([[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]], true, Math.round(p.framepen));
        }
        if (p.cutMarks) {
          const L2 = Math.min(ML, cw / 3, ch / 3);
          for (const [cx, cy, dx, dy] of [
            [x0, y0, 1, 1], [x0 + cw, y0, -1, 1],
            [x0 + cw, y0 + ch, -1, -1], [x0, y0 + ch, 1, -1]
          ]) {
            emit([[cx, cy], [cx + dx * L2, cy]], false, mk);
            emit([[cx, cy], [cx, cy + dy * L2]], false, mk);
          }
        }
        if (p.fold !== "None") {
          const T = Math.min(4, cw / 4, ch / 4);
          const tee = (cx, cy, inward) => { /* crossbar along edge + stem inward */
            if (inward === "down" || inward === "up") {
              emit([[cx - T, cy], [cx + T, cy]], false, mk);
              emit([[cx, cy], [cx, cy + (inward === "down" ? T : -T)]], false, mk);
            } else {
              emit([[cx, cy - T], [cx, cy + T]], false, mk);
              emit([[cx, cy], [cx + (inward === "right" ? T : -T), cy]], false, mk);
            }
          };
          if (p.fold === "Vertical" || p.fold === "Both") {
            const fx = x0 + Math.min(Math.max(p.foldMM, 1), cw - 1);
            tee(fx, y0, "down");
            tee(fx, y0 + ch, "up");
          }
          if (p.fold === "Horizontal" || p.fold === "Both") {
            const fy = y0 + Math.min(Math.max(p.foldMM, 1), ch - 1);
            tee(x0, fy, "right");
            tee(x0 + cw, fy, "left");
          }
        }
      };

      if (p.layout === "Fixed size") {
        const mw = Math.max(5, p.miniW), mh = Math.max(5, p.miniH);
        const cols = Math.max(1, Math.floor((W - 2 * m + gap) / (mw + gap)));
        const rows = Math.max(1, Math.floor((H - 2 * m + gap) / (mh + gap)));
        const cap = cols * rows;
        const n = Math.min(Math.round(p.count), cap);
        const usedCols = Math.min(cols, n);
        const usedRows = Math.ceil(n / cols);
        const blockW = usedCols * mw + (usedCols - 1) * gap;
        const blockH = usedRows * mh + (usedRows - 1) * gap;
        const bx = m + (W - 2 * m - blockW) / 2;
        const by = m + (H - 2 * m - blockH) / 2;
        for (let i = 0; i < n; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          const x0 = bx + c * (mw + gap), y0 = by + r * (mh + gap);
          place(wired[i % wired.length], x0, y0, mw, mh);
          cellMarks(x0, y0, mw, mh);
        }
        return { paths: out };
      }
      /* Auto grid: each wired input its own cell (original behavior) */
      const cols = Math.max(1, Math.min(6, Math.round(p.cols)));
      const rows = Math.ceil(wired.length / cols);
      const cw = (W - 2 * m - (cols - 1) * gap) / cols;
      const ch = (H - 2 * m - (rows - 1) * gap) / rows;
      if (cw <= 2 || ch <= 2) return EMPTY;
      for (let i = 0; i < wired.length; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x0 = m + c * (cw + gap), y0 = m + r * (ch + gap);
        place(wired[i], x0, y0, cw, ch);
        cellMarks(x0, y0, cw, ch);
      }
      return { paths: out };
    }
  
};
