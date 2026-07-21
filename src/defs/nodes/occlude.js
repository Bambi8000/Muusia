import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "occlude",
    name: "Occlude",
    cat: "mod",
    group: "occlusion",
    ins: [Pin("paths", "Lines"), Pin("paths", "Occluders (closed)")],
    outs: [Pin("paths")],
    params: [
      { key: "gap", label: "Gap mm (+grow / -shrink)", type: "slider", min: -5, max: 8, step: 0.25, def: 0.8 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 },
      { key: "drawOcc", label: "Draw occluders", type: "check", def: true }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const twoInput = !!(ins[1] && ins[1].paths && ins[1].paths.length);
      const step = Math.max(0.25, p.res);
      const gap = p.gap;
      const paths = [];

      const pip = (x, y, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const yi = poly[i][1], yj = poly[j][1];
          if ((yi > y) !== (yj > y)) {
            const xi = poly[i][0], xj = poly[j][0];
            if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
          }
        }
        return c;
      };
      const edgeDist = (x, y, poly) => {
        let best = Infinity;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const ax = poly[j][0], ay = poly[j][1];
          const bx = poly[i][0], by = poly[i][1];
          const dx = bx - ax, dy = by - ay;
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
          if (d < best) best = d;
        }
        return best;
      };
      const prepOcc = (path) => {
        const poly = path.pts;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of poly) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const pad = Math.max(0, gap);
        return { poly, x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
      };
      const hidden = (x, y, occ) => {
        if (x < occ.x0 || x > occ.x1 || y < occ.y0 || y > occ.y1) return false;
        const inside = pip(x, y, occ.poly);
        if (gap >= 0) {
          return inside || (gap > 0 && edgeDist(x, y, occ.poly) < gap);
        }
        /* negative gap: occlusion shrinks inward */
        return inside && edgeDist(x, y, occ.poly) > -gap;
      };
      const emitVisible = (path, occs) => {
        if (!occs.length) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        const pts = resample(path.pts, path.closed, step);
        const vis = pts.map(([x, y]) => !occs.some((o) => hidden(x, y, o)));
        const runs = [];
        let run = [];
        for (let i = 0; i < pts.length; i++) {
          if (vis[i]) run.push(pts[i]);
          else { if (run.length > 1) runs.push(run); run = []; }
        }
        if (run.length > 1) runs.push(run);
        /* closed source with visible wrap: merge last run into first */
        if (path.closed && runs.length > 1 && vis[0] && vis[pts.length - 1]) {
          const last = runs.pop();
          runs[0] = last.concat(runs[0]);
        }
        if (path.closed && runs.length === 1 && vis.every(Boolean)) {
          paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
          return;
        }
        for (const r of runs) paths.push({ pts: r, closed: false, layer: path.layer });
      };

      if (twoInput) {
        const occs = ins[1].paths.filter((pa) => pa.closed && pa.pts.length >= 3).map(prepOcc);
        src.paths.forEach((path) => emitVisible(path, occs));
        if (p.drawOcc) {
          ins[1].paths.forEach((pa) => paths.push({ ...pa, pts: pa.pts.map((q) => q.slice()) }));
        }
      } else {
        /* painter mode: within the set, LATER closed shapes occlude EARLIER paths */
        const all = src.paths;
        const occAfter = all.map((pa, i) =>
          all.slice(i + 1).filter((o) => o.closed && o.pts.length >= 3).map(prepOcc));
        all.forEach((path, i) => emitVisible(path, occAfter[i]));
      }
      return { paths };
    }
  
};
