import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "raydrape",
    name: "Ray",
    cat: "duo",
    desc: "Houdini-style Ray: every point of A is cast along a direction until it hits B's lines, so A drapes over B like fabric or rain. Points that miss keep their place (or drop). Offset lands the line slightly before the surface.",
    ins: [Pin("paths", "A (to project)"), Pin("paths", "B (targets)")],
    outs: [Pin("paths")],
    params: [
      { key: "angle", label: "Direction deg (90=down)", type: "slider", min: 0, max: 360, step: 1, def: 90 },
      { key: "maxd", label: "Max distance mm (0=inf)", type: "slider", min: 0, max: 300, step: 5, def: 0 },
      { key: "offset", label: "Offset from surface mm", type: "slider", min: 0, max: 10, step: 0.25, def: 0.5 },
      { key: "misses", label: "Keep misses in place", type: "check", def: true },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 1 }
    ],
    compute(ins, p, ctx) {
      const A = ins[0] || EMPTY, B = ins[1] || EMPTY;
      if (!B.paths || !B.paths.length) {
        return { paths: A.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      const segs = [];
      for (const pa of B.paths) {
        const pts = pa.closed ? [...pa.pts, pa.pts[0]] : pa.pts;
        for (let i = 1; i < pts.length; i++) {
          segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
        }
      }
      const a = (p.angle * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);
      const maxd = p.maxd > 0 ? p.maxd : 1e9;
      /* ray (px,py)+t(dx,dy) vs segment: standard 2x2 solve */
      const cast = (px, py) => {
        let best = Infinity;
        for (const s of segs) {
          const ex = s[2] - s[0], ey = s[3] - s[1];
          const den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-12) continue;
          const qx = s[0] - px, qy = s[1] - py;
          const t = (qx * ey - qy * ex) / den;
          const u = (qx * dy - qy * dx) / den;
          if (t >= 0 && t <= maxd && u >= 0 && u <= 1 && t < best) best = t;
        }
        return best;
      };
      const paths = [];
      A.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        const out = [];
        for (const [px, py] of pts) {
          const t = cast(px, py);
          if (t === Infinity) {
            if (p.misses) out.push([px, py]);
            else { if (out.length > 1) paths.push({ pts: out.slice(), closed: false, layer: path.layer }); out.length = 0; }
          } else {
            const tt = Math.max(0, t - p.offset);
            out.push([px + dx * tt, py + dy * tt]);
          }
        }
        if (out.length > 1) paths.push({ pts: out, closed: path.closed && p.misses, layer: path.layer });
      });
      return { paths };
    }
  
};
