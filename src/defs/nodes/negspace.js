import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
  key: "negspace",
    name: "Negative Space",
    cat: "duo",
    desc: "Clips Fill into the space a Shape does NOT use: the shape's lines (plus a clearance band) and the inside of its closed paths count as occupied, and the fill flows around them - draw a background behind Tubes without touching them. Inverse mode keeps the fill only INSIDE the used space instead. Works with any geometry, open or closed, unlike Mask.",
    ins: [Pin("paths", "Shape (occupies)"), Pin("paths", "Fill")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Keep", type: "select", options: ["Background (outside)", "Inside (inverse)"], def: "Background (outside)" },
      { key: "clearance", label: "Clearance mm", type: "slider", min: 0, max: 20, step: 0.25, def: 2.5 },
      { key: "interior", label: "Closed interiors occupy", type: "check", def: true },
      { key: "res", label: "Cut precision mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "minlen", label: "Min piece mm", type: "slider", min: 0, max: 20, step: 0.5, def: 2 }
    ],
    compute(ins, p, ctx) {
      const A = ins[0] || EMPTY, B = ins[1] || EMPTY;
      if (!B.paths.length) return EMPTY;
      if (!A.paths.length) {
        return p.mode === "Background (outside)"
          ? { paths: B.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) }
          : EMPTY;
      }
      /* segment buckets of A for distance queries */
      const segs = [];
      for (const pa of A.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
      }
      const clr = Math.max(0, p.clearance);
      const bs = Math.max(3, clr * 1.5 + 2);
      const buckets = new Map();
      segs.forEach((s, i) => {
        const sx0 = Math.min(s[0], s[2]) - clr, sx1 = Math.max(s[0], s[2]) + clr;
        const sy0 = Math.min(s[1], s[3]) - clr, sy1 = Math.max(s[1], s[3]) + clr;
        for (let by = Math.floor(sy0 / bs); by <= Math.floor(sy1 / bs); by++) {
          for (let bx = Math.floor(sx0 / bs); bx <= Math.floor(sx1 / bs); bx++) {
            const k = bx + "," + by;
            let a = buckets.get(k);
            if (!a) { a = []; buckets.set(k, a); }
            a.push(i);
          }
        }
      });
      const nearLine = (x, y) => {
        const a = buckets.get(Math.floor(x / bs) + "," + Math.floor(y / bs));
        if (!a) return false;
        for (const i of a) {
          const s = segs[i];
          const dx = s[2] - s[0], dy = s[3] - s[1];
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const ddx = x - (s[0] + dx * t), ddy = y - (s[1] + dy * t);
          if (ddx * ddx + ddy * ddy <= clr * clr) return true;
        }
        return false;
      };
      /* closed interiors */
      const polys = p.interior ? A.paths.filter((pa) => pa.closed && pa.pts.length >= 3).map((pa) => {
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (const [x, y] of pa.pts) {
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
          if (y < by0) by0 = y; if (y > by1) by1 = y;
        }
        return { poly: pa.pts, bx0, by0, bx1, by1 };
      }) : [];
      const insidePoly = (x, y) => {
        for (const cp of polys) {
          if (x < cp.bx0 || x > cp.bx1 || y < cp.by0 || y > cp.by1) continue;
          let c = false;
          const poly = cp.poly;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const yi = poly[i][1], yj = poly[j][1];
            if ((yi > y) !== (yj > y)) {
              const xi = poly[i][0], xj = poly[j][0];
              if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
            }
          }
          if (c) return true;
        }
        return false;
      };
      const wantOccupied = p.mode !== "Background (outside)";
      const keep = (x, y) => ((nearLine(x, y) || insidePoly(x, y)) === wantOccupied);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      for (const pa of B.paths) {
        const pts = resample(pa.pts, pa.closed, Math.max(0.2, p.res));
        let run = [];
        const flush = () => {
          if (run.length > 1 && (p.minlen <= 0 || pathLength(run, false) >= p.minlen)) {
            if (total + run.length <= BUDGET) {
              total += run.length;
              paths.push({ pts: run, closed: false, layer: pa.layer });
            }
          }
          run = [];
        };
        let allKept = true;
        for (const [x, y] of pts) {
          if (keep(x, y)) run.push([x, y]);
          else { allKept = false; flush(); }
        }
        if (allKept && pa.closed && run.length > 2) {
          if (total + run.length <= BUDGET) { total += run.length; paths.push({ pts: run, closed: true, layer: pa.layer }); }
          run = [];
        } else flush();
        if (total > BUDGET) break;
      }
      return { paths };
    }
  
};
