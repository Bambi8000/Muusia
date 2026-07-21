import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "stencil",
    name: "Stencil",
    cat: "duo",
    ins: [Pin("paths", "Regions (closed)"), Pin("paths", "Content")],
    outs: [Pin("paths")],
    params: [
      { key: "region", label: "Region index (next/prev, wire Steps)", type: "slider", min: 0, max: 63, step: 1, def: 0 },
      { key: "all", label: "All regions", type: "check", def: false },
      { key: "inset", label: "Edge inset mm", type: "slider", min: -5, max: 8, step: 0.25, def: 1 },
      { key: "outline", label: "Show region outline", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const regsIn = ins[0], contentIn = ins[1];
      if (!regsIn || !regsIn.paths || !regsIn.paths.length) return EMPTY;

      /* collect closed loops, ordered deterministically top-left -> bottom-right
         so the index slider steps through them predictably */
      const loops = regsIn.paths
        .filter((pa) => pa.closed && pa.pts.length >= 3)
        .map((pa) => {
          let cx = 0, cy = 0;
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const [x, y] of pa.pts) {
            cx += x; cy += y;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          cx /= pa.pts.length; cy /= pa.pts.length;
          return { pa, cx, cy, x0, y0, x1, y1 };
        })
        .sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
      if (!loops.length) return EMPTY;

      /* selection: index wraps modulo count -> any slider/wired value is valid */
      const idx = ((Math.floor(p.region) % loops.length) + loops.length) % loops.length;
      const active = p.all ? loops : [loops[idx]];

      const inset = p.inset;
      const pad = Math.max(0, -inset);
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
      /* point is kept if it lies in ANY active region, respecting the inset */
      const keepPt = (x, y) => {
        for (const lo of active) {
          if (x < lo.x0 - pad || x > lo.x1 + pad || y < lo.y0 - pad || y > lo.y1 + pad) continue;
          const inside = pip(x, y, lo.pa.pts);
          if (inset > 0) {
            if (inside && edgeDist(x, y, lo.pa.pts) >= inset) return true;
          } else if (inset < 0) {
            if (inside || edgeDist(x, y, lo.pa.pts) <= -inset) return true;
          } else if (inside) return true;
        }
        return false;
      };

      const paths = [];
      if (p.outline) {
        for (const lo of active) {
          paths.push({ ...lo.pa, pts: lo.pa.pts.map((q) => q.slice()) });
        }
      }
      if (contentIn && contentIn.paths && contentIn.paths.length) {
        const step = Math.max(0.25, p.res);
        contentIn.paths.forEach((path) => {
          if (path.pts.length < 2) return;
          const pts = resample(path.pts, path.closed, step);
          const vis = pts.map(([x, y]) => keepPt(x, y));
          const runs = [];
          let run = [];
          for (let i = 0; i < pts.length; i++) {
            if (vis[i]) run.push(pts[i]);
            else { if (run.length > 1) runs.push(run); run = []; }
          }
          if (run.length > 1) runs.push(run);
          if (path.closed && runs.length > 1 && vis[0] && vis[pts.length - 1]) {
            const last = runs.pop();
            runs[0] = last.concat(runs[0]);
          }
          if (path.closed && runs.length === 1 && vis.every(Boolean)) {
            paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
            return;
          }
          for (const r of runs) paths.push({ pts: r, closed: false, layer: path.layer });
        });
      }
      return { paths };
    }
  
};
