import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "turtle",
    name: "Turtle",
    cat: "gen",
    group: "geometric",
    desc: "Classic turtle graphics from a command string: F/B move drawing, M moves pen-up, R/L turn in degrees, U/D pen up/down, [ ] branch (push/pop), and N[...] repeats a block N times. Example: 36[F8 R10] draws a circle, 5[F40 R144] a star. Auto-fits to the sheet. Deterministic - no seed needed.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "prog", label: "Program", type: "text", def: "12[6[F14 R60] R30]" },
      { key: "startAng", label: "Start angle deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "fit", label: "Fit to sheet", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      /* parse into an op tree: {op, val} or {rep, body} or {branch, body} */
      const src = String(p.prog || "");
      let pos = 0;
      const parseBlock = (depth) => {
        const ops = [];
        while (pos < src.length) {
          const ch = src[pos];
          if (ch === "]") { pos++; return ops; }
          if (/\s|,/.test(ch)) { pos++; continue; }
          if (ch === "[") { pos++; ops.push({ branch: parseBlock(depth + 1) }); continue; }
          if (/[0-9]/.test(ch)) {
            let num = "";
            while (pos < src.length && /[0-9.]/.test(src[pos])) num += src[pos++];
            while (pos < src.length && /\s/.test(src[pos])) pos++;
            if (src[pos] === "[") { pos++; ops.push({ rep: Math.min(200, Math.max(0, Math.round(+num))), body: parseBlock(depth + 1) }); }
            continue; /* bare numbers are ignored */
          }
          const op = ch.toUpperCase();
          pos++;
          if ("FBMRL".includes(op)) {
            let num = "";
            while (pos < src.length && /\s/.test(src[pos])) pos++;
            while (pos < src.length && /[0-9.\-]/.test(src[pos])) num += src[pos++];
            ops.push({ op, val: num === "" ? (op === "R" || op === "L" ? 90 : 10) : +num });
          } else if (op === "U" || op === "D") {
            ops.push({ op });
          } /* unknown chars ignored */
          if (depth > 24) return ops;
        }
        return ops;
      };
      const tree = parseBlock(0);
      /* execute */
      const paths = [];
      let cur = null;
      const st = { x: 0, y: 0, ang: (p.startAng - 90) * Math.PI / 180, pen: true };
      const stack = [];
      let steps = 0;
      const endPath = () => { if (cur && cur.length > 1) paths.push({ pts: cur, closed: false, layer: L }); cur = null; };
      const moveTo = (nx, ny, draw) => {
        if (draw && st.pen) {
          if (!cur) cur = [[st.x, st.y]];
          cur.push([nx, ny]);
        } else endPath();
        st.x = nx; st.y = ny;
      };
      const run = (ops) => {
        for (const o of ops) {
          if (steps++ > 40000) return;
          if (o.rep !== undefined) { for (let i = 0; i < o.rep; i++) { run(o.body); if (steps > 40000) return; } }
          else if (o.branch) {
            stack.push({ ...st });
            endPath();
            run(o.branch);
            endPath();
            const back = stack.pop();
            st.x = back.x; st.y = back.y; st.ang = back.ang; st.pen = back.pen;
          }
          else if (o.op === "F") moveTo(st.x + Math.cos(st.ang) * o.val, st.y + Math.sin(st.ang) * o.val, true);
          else if (o.op === "B") moveTo(st.x - Math.cos(st.ang) * o.val, st.y - Math.sin(st.ang) * o.val, true);
          else if (o.op === "M") moveTo(st.x + Math.cos(st.ang) * o.val, st.y + Math.sin(st.ang) * o.val, false);
          else if (o.op === "R") st.ang += (o.val * Math.PI) / 180;
          else if (o.op === "L") st.ang -= (o.val * Math.PI) / 180;
          else if (o.op === "U") { st.pen = false; endPath(); }
          else if (o.op === "D") st.pen = true;
        }
      };
      run(tree);
      endPath();
      if (!paths.length) return applyStyle({ paths: [] }, ins[0]);
      /* place: fit to margin box or center as-is */
      const m = Math.max(0, p.margin);
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const pa of paths) for (const [x, y] of pa.pts) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
      const bw = W - 2 * m, bh = H - 2 * m;
      const sc = p.fit ? Math.min(bw / ((bx1 - bx0) || 1), bh / ((by1 - by0) || 1)) : 1;
      const ox = m + (bw - (bx1 - bx0) * sc) / 2 - bx0 * sc;
      const oy = m + (bh - (by1 - by0) * sc) / 2 - by0 * sc;
      const out = paths.map((pa) => ({
        ...pa,
        pts: pa.pts.map(([x, y]) => [
          Math.max(0.5, Math.min(W - 0.5, x * sc + ox)),
          Math.max(0.5, Math.min(H - 0.5, y * sc + oy))
        ])
      }));
      return applyStyle({ paths: out }, ins[0]);
    }
  
};
