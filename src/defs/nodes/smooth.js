import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "smooth",
    name: "Smooth", cat: "mod", group: "pathops",
    desc: "Smooths paths. Relax runs an arc-length moving average (Radius mm) over the line - visible on typical densely sampled Muusia geometry; endpoints stay pinned and closed paths wrap. Round corners is classic Chaikin corner-cutting, useful on sparse polylines like Random Lines or Delaunay edges.",
    ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Relax", "Round corners"], def: "Relax" },
      { key: "radius", label: "Radius mm (Relax)", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
      { key: "iter", label: "Iterations", type: "slider", min: 1, max: 5, step: 1, def: 2 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const it = Math.max(1, Math.min(8, Math.round(p.iter)));
      if (p.mode === "Round corners") {
        const chaikin = (pts, closed) => {
          if (pts.length < 3) return pts;
          const out = [];
          const N = pts.length;
          const last = closed ? N : N - 1;
          if (!closed) out.push(pts[0].slice());
          for (let i = 0; i < last; i++) {
            const a = pts[i], b = pts[(i + 1) % N];
            out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
            out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
          }
          if (!closed) out.push(pts[N - 1].slice());
          return out;
        };
        const paths = src.paths.map((path) => {
          let pts = path.pts;
          for (let i = 0; i < it; i++) pts = chaikin(pts, path.closed);
          return { ...path, pts };
        });
        return { paths };
      }
      /* Relax: moving average over a Radius-mm arc-length window */
      const R = Math.max(0.2, p.radius);
      const step = Math.max(0.4, Math.min(1.5, R / 4));
      const w = Math.max(1, Math.round(R / step));
      const paths = src.paths.map((path) => {
        if (path.pts.length < 3) return path;
        let pts = resample(path.pts, path.closed, step);
        const N = pts.length;
        if (N < 5) return path;
        for (let n = 0; n < it; n++) {
          const out = new Array(N);
          for (let i = 0; i < N; i++) {
            if (!path.closed && (i === 0 || i === N - 1)) { out[i] = pts[i]; continue; }
            let sx = 0, sy = 0, cnt = 0;
            for (let k = -w; k <= w; k++) {
              let j = i + k;
              if (path.closed) j = ((j % N) + N) % N;
              else { if (j < 0) j = 0; else if (j > N - 1) j = N - 1; }
              sx += pts[j][0]; sy += pts[j][1]; cnt++;
            }
            out[i] = [sx / cnt, sy / cnt];
          }
          pts = out;
        }
        return { ...path, pts };
      });
      return { paths };
    },
  
};
