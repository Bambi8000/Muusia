import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "smoke",
    name: "Smoke",
    cat: "gen",
    group: "organic",
    desc: "Incense smoke in 3D: a laminar stream rises smoothly, then breaks into turbulent curls past the break height. The line is a ribbon of parallel filaments that twist around the stream and fold like real smoke sheets. Wind bends the column; View yaw orbits it; wire Drift to Frame and the smoke flows through an animation. Each filament is one continuous pen stroke.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "streams", label: "Streams", type: "slider", min: 1, max: 4, step: 1, def: 1 },
      { key: "rise", label: "Rise mm", type: "slider", min: 60, max: 300, step: 5, def: 200 },
      { key: "laminar", label: "Laminar fraction", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.3 },
      { key: "turb", label: "Turbulence", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "swirl", label: "Swirl size mm", type: "slider", min: 8, max: 80, step: 1, def: 30 },
      { key: "windAng", label: "Wind direction deg", type: "slider", min: 0, max: 360, step: 5, def: 20 },
      { key: "wind", label: "Wind strength", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "filaments", label: "Ribbon filaments", type: "slider", min: 1, max: 9, step: 1, def: 5 },
      { key: "width", label: "Ribbon width mm", type: "slider", min: 1, max: 25, step: 0.5, def: 8 },
      { key: "yaw", label: "View yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 0 },
      { key: "drift", label: "Drift (wire Frame)", type: "slider", min: 0, max: 10, step: 0.05, def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 4 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const NS = Math.max(1, Math.min(4, Math.round(p.streams)));
      const K = Math.max(1, Math.min(12, Math.round(p.filaments)));
      const ds = 1.1;
      const steps = Math.min(500, Math.round(Math.max(20, p.rise) / ds));
      const f = 1 / Math.max(4, p.swirl);
      const wa = (p.windAng * Math.PI) / 180;
      const windX = Math.cos(wa) * p.wind, windZ = Math.sin(wa) * p.wind;
      const breakH = p.laminar * p.rise;
      const D = p.drift * 3.7;
      const L = Math.round(p.layer);
      const rawStreams = [];
      for (let s = 0; s < NS; s++) {
        const sd = p.seed * 131 + s * 977;
        /* centerline: integrate with directional inertia for flowing curves */
        const C = [], T = [];
        let px = (s - (NS - 1) / 2) * p.rise * 0.18, py = 0, pz = (hash2(s, 3, p.seed) - 0.5) * 10;
        let dx = 0, dy = 1, dz = 0;
        for (let i = 0; i < steps; i++) {
          C.push([px, py, pz]);
          T.push([dx, dy, dz]);
          const h = py;
          /* turbulence ramps in after the break height; a whisper of wobble before */
          const ramp = breakH >= p.rise ? 0 : Math.max(0, Math.min(1, (h - breakH) / (p.rise * 0.18 + 1)));
          const amp = p.turb * 2.4 * ramp + 0.06;
          const tx = (noise2(py * f + D, pz * f + s * 7, sd + 1) - 0.5) * amp;
          const ty = (noise2(px * f + D, pz * f + s * 7, sd + 2) - 0.5) * amp * 0.45;
          const tz = (noise2(px * f, py * f + D, sd + 3) - 0.5) * amp;
          let vx = windX * 0.9 + tx, vy = 1 + ty, vz = windZ * 0.9 + tz;
          /* inertia: blend previous direction for smooth curls */
          vx = dx * 0.78 + vx * 0.22; vy = dy * 0.78 + vy * 0.22; vz = dz * 0.78 + vz * 0.22;
          const vl = Math.hypot(vx, vy, vz) || 1;
          dx = vx / vl; dy = vy / vl; dz = vz / vl;
          px += dx * ds; py += dy * ds; pz += dz * ds;
        }
        /* rotation-minimizing frames */
        const N = [], B = [];
        for (let i = 0; i < C.length; i++) {
          const t = T[i];
          if (i === 0) {
            let nx = -t[1], ny = t[0], nz = 0;
            const nl = Math.hypot(nx, ny, nz) || 1;
            N.push([nx / nl, ny / nl, nz / nl]);
          } else {
            const pn = N[i - 1];
            const d = pn[0] * t[0] + pn[1] * t[1] + pn[2] * t[2];
            let nx = pn[0] - d * t[0], ny = pn[1] - d * t[1], nz = pn[2] - d * t[2];
            const nl = Math.hypot(nx, ny, nz) || 1;
            N.push([nx / nl, ny / nl, nz / nl]);
          }
          const n = N[i];
          B.push([
            t[1] * n[2] - t[2] * n[1],
            t[2] * n[0] - t[0] * n[2],
            t[0] * n[1] - t[1] * n[0]
          ]);
        }
        rawStreams.push({ C, N, B, sd });
      }
      /* filaments in 3D: twist around the tangent + width envelope + sheet folding */
      const pts3 = []; /* per filament: array of [x,y,z] */
      for (const st of rawStreams) {
        for (let k = 0; k < K; k++) {
          const e = K > 1 ? (k / (K - 1) - 0.5) : 0;
          const fil = [];
          for (let i = 0; i < st.C.length; i++) {
            const h = st.C[i][1];
            const env = 0.12 + 0.88 * Math.min(1, h / (p.rise * 0.25 + 1));
            const fold = 1 + 0.8 * (noise2(h * 0.025 + k * 0.7, D + 9.3, st.sd + 4) - 0.5);
            const tw = (noise2(h * 0.014 + D * 0.5, k * 0.31, st.sd + 5) - 0.5) * Math.PI * 2.2;
            const off = e * p.width * env * fold;
            const ca = Math.cos(tw) * off, sa = Math.sin(tw) * off;
            fil.push([
              st.C[i][0] + st.N[i][0] * ca + st.B[i][0] * sa,
              st.C[i][1] + st.N[i][1] * ca + st.B[i][1] * sa,
              st.C[i][2] + st.N[i][2] * ca + st.B[i][2] * sa
            ]);
          }
          pts3.push(fil);
        }
      }
      /* project: yaw around the vertical axis, mild perspective, y up -> screen y down */
      const ya = (p.yaw * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const FOC = p.rise * 2.5;
      const proj = ([x, y, z]) => {
        const X = x * cy2 + z * sy2;
        const Z = -x * sy2 + z * cy2;
        const sc = FOC / Math.max(FOC * 0.15, FOC + Z);
        return [X * sc, -y * sc];
      };
      const proj2 = pts3.map((fil) => fil.map(proj));
      /* fit into the margin box */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const fil of proj2) for (const [x, y] of fil) {
        if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const paths = proj2.map((fil) => ({
        pts: fil.map(([x, y]) => [
          Math.max(0.5, Math.min(W - 0.5, x * sc + ox)),
          Math.max(0.5, Math.min(H - 0.5, y * sc + oy))
        ]),
        closed: false, layer: L
      }));
      return applyStyle({ paths }, ins[0]);
    }
  
};
