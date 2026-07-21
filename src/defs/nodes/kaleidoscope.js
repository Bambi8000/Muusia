import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "kaleidoscope",
    name: "Kaleidoscope",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "sectors", label: "Sectors", type: "slider", min: 2, max: 24, step: 1, def: 6 },
      { key: "mirror", label: "Mirror alternate", type: "check", def: true },
      { key: "rot", label: "Rotate offset deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const cx = W / 2, cy = H / 2;
      const N = Math.max(2, Math.min(32, Math.round(p.sectors)));
      const wedge = (Math.PI * 2) / N;
      const base = (p.rot * Math.PI) / 180;
      const paths = [];
      const clamp = ([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      /* 1) clip the source to one wedge, 2) replicate the runs N times,
         mirroring every other copy when Mirror is on */
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        const inWedge = pts.map(([x, y]) => {
          let a = Math.atan2(y - cy, x - cx) - base;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          return a < wedge;
        });
        const runs = [];
        let run = [];
        for (let i = 0; i < pts.length; i++) {
          if (inWedge[i]) run.push(pts[i]);
          else { if (run.length > 1) runs.push(run); run = []; }
        }
        if (run.length > 1) runs.push(run);
        for (const r of runs) {
          /* run in wedge-local polar coordinates */
          const local = r.map(([x, y]) => {
            const dx = x - cx, dy = y - cy;
            let a = Math.atan2(dy, dx) - base;
            a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            return [Math.hypot(dx, dy), a];
          });
          for (let k = 0; k < N; k++) {
            const flip = p.mirror && (k % 2 === 1);
            paths.push({
              pts: local.map(([rad, a]) => {
                const aa = base + k * wedge + (flip ? wedge - a : a);
                return clamp([cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad]);
              }),
              closed: false, layer: path.layer
            });
          }
        }
      });
      return { paths };
    }
  
};
