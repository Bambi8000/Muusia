import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "mooncraters",
    name: "Moon Craters",
    cat: "gen",
    group: "nature",
    desc: "Cratered lunar terrain from a heightfield of bowl-and-rim craters (natural size mix). Top view draws rim and floor outlines or a relief-displaced mesh; 3D view looks across the plain to a horizon (not a sphere) - rotate with Yaw, raise the camera with Pitch. 3D Mesh uses classic silhouette occlusion (near ridges hide far ones); 3D Outlines drapes the crater rings over the terrain.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "view", label: "View", type: "select", options: ["Top", "3D"], def: "Top" },
      { key: "style", label: "Style", type: "select", options: ["Outlines", "Mesh"], def: "Mesh" },
      { key: "craters", label: "Craters", type: "slider", min: 3, max: 60, step: 1, def: 18 },
      { key: "size", label: "Max crater mm", type: "slider", min: 8, max: 70, step: 1, def: 34 },
      { key: "depth", label: "Relief", type: "slider", min: 0.1, max: 1.5, step: 0.05, def: 0.7 },
      { key: "density", label: "Mesh density", type: "slider", min: 0.3, max: 1, step: 0.05, def: 0.6 },
      { key: "yaw", label: "Yaw deg (wire Frame)", type: "slider", min: 0, max: 360, step: 1, def: 20 },
      { key: "pitch", label: "Pitch deg (3D)", type: "slider", min: 8, max: 55, step: 1, def: 20 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 11 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 5077 + 29);
      const L = Math.round(p.layer);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer: L
        });
      };
      /* terrain: square patch side S in model units, craters with bowl + raised rim */
      const S = Math.max(bw, bh);
      const craters = [];
      const NC = Math.round(p.craters);
      for (let i = 0; i < NC; i++) {
        const R = (p.size / 2) * (0.18 + Math.pow(rng(), 1.8) * 0.82);
        craters.push({
          x: (rng() - 0.5) * S * 0.92,
          y: (rng() - 0.5) * S * 0.92,
          R, d: R * 0.5
        });
      }
      const heightAt = (x, y) => {
        let h = (noise2(x * 0.02 + 30, y * 0.02 + 30, p.seed) - 0.5) * p.size * 0.12; /* gentle rolling base */
        for (const c of craters) {
          const r = Math.hypot(x - c.x, y - c.y);
          if (r < c.R) h += c.d * ((r / c.R) * (r / c.R) - 1);        /* parabolic bowl */
          const dr = (r - c.R) / (c.R * 0.22);
          if (dr > -3 && dr < 3) h += c.d * 0.35 * Math.exp(-dr * dr); /* raised rim */
        }
        return h * p.depth;
      };
      const circle3 = (cx, cy, r, nn) => {
        const c = [];
        for (let k = 0; k < nn; k++) {
          const a = (k / nn) * Math.PI * 2;
          c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        return c;
      };

      if (p.view === "Top") {
        const fit = ([x, y]) => [m + ((x / S) + 0.5) * bw, m + ((y / S) + 0.5) * bh];
        if (p.style === "Outlines") {
          for (const c of craters) {
            const nn = Math.max(12, Math.round(c.R * 1.6));
            push(circle3(c.x, c.y, c.R, nn).map(fit), true);            /* rim crest */
            push(circle3(c.x, c.y, c.R * 0.55, nn).map(fit), true);     /* floor */
            if (c.R > p.size * 0.28) push(circle3(c.x, c.y, c.R * 0.8, nn).map(fit), true); /* terrace */
          }
        } else {
          /* relief-displaced mesh: grid lines pushed by the height gradient */
          const n = Math.round(26 + p.density * 44);
          const eps = S / n;
          const disp = (x, y) => {
            const gx = (heightAt(x + eps, y) - heightAt(x - eps, y)) / (2 * eps);
            const gy = (heightAt(x, y + eps) - heightAt(x, y - eps)) / (2 * eps);
            const k = S * 0.045;
            return [x + gx * k, y + gy * k];
          };
          for (let r = 0; r <= n; r++) {
            const row = [];
            for (let c2 = 0; c2 <= n; c2++) row.push(fit(disp(-S / 2 + (c2 / n) * S, -S / 2 + (r / n) * S)));
            push(row, false);
          }
          for (let c2 = 0; c2 <= n; c2++) {
            const col = [];
            for (let r = 0; r <= n; r++) col.push(fit(disp(-S / 2 + (c2 / n) * S, -S / 2 + (r / n) * S)));
            push(col, false);
          }
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---- 3D: look across the plain to the horizon ---- */
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      const rowSpread = S * 0.62 * Math.min(1, Math.max(0.15, Math.tan(pa2)) * 1.2);
      const hMul = 1.2 + p.depth * 1.6;
      const nRows = Math.round(28 + p.density * 42);
      const nCols = Math.round(60 + p.density * 60);
      /* precompute projected rows near->far */
      const rowsP = [];
      for (let r = 0; r <= nRows; r++) {
        const y = -S / 2 + (r / nRows) * S;     /* model y; will be depth after yaw... sample in ROTATED space */
        const row = [];
        for (let c2 = 0; c2 <= nCols; c2++) {
          const x = -S / 2 + (c2 / nCols) * S;
          /* sample terrain in world coords rotated INTO view: inverse-rotate view grid */
          const wx = x * cy2 - y * sy2;
          const wy = x * sy2 + y * cy2;
          const h = heightAt(wx, wy);
          const t = (y / S + 0.5);
          const persp = 1 / (0.55 + t * 1.6 * (0.35 / Math.max(0.15, Math.tan(pa2))));
          row.push([x * persp, -t * rowSpread - h * persp * hMul, t]);
        }
        rowsP.push(row);
      }
      /* fit to box */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const row of rowsP) for (const [x, y] of row) {
        if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const toScreen = ([x, y]) => [x * sc + ox, y * sc + oy];

      if (p.style === "Mesh") {
        /* silhouette occlusion, near rows drawn first hide far rows */
        const BK = 900;
        const minY = new Float32Array(BK).fill(Infinity);
        const bucket = (x) => Math.max(0, Math.min(BK - 1, Math.round(((x - (fx0 * sc + ox)) / ((fx1 - fx0) * sc || 1)) * (BK - 1))));
        for (let r = 0; r < rowsP.length; r++) {
          const row = rowsP[r].map(toScreen);
          /* visibility against the silhouette of nearer rows */
          let run = [];
          for (const q of row) {
            if (q[1] < minY[bucket(q[0])] - 0.15) run.push(q);
            else {
              if (run.length > 1) push(run, false);
              run = [];
            }
          }
          if (run.length > 1) push(run, false);
          /* rasterize this row's FULL profile into the silhouette (it is in front of all later rows) */
          for (let i = 1; i < row.length; i++) {
            const b0 = bucket(row[i - 1][0]), b1 = bucket(row[i][0]);
            const lo2 = Math.min(b0, b1), hi2 = Math.max(b0, b1);
            for (let b = lo2; b <= hi2; b++) {
              const t2 = hi2 > lo2 ? (b - b0) / (b1 - b0 || 1) : 0;
              const yv = row[i - 1][1] + (row[i][1] - row[i - 1][1]) * Math.max(0, Math.min(1, t2));
              if (yv < minY[b]) minY[b] = yv;
            }
          }
        }
      } else {
        /* Outlines: crater rim + floor rings draped over the terrain, plus the horizon line */
        const drape = (cx0, cy0, r) => {
          const nn = Math.max(16, Math.round(r * 2));
          const ring = [];
          for (let k = 0; k <= nn; k++) {
            const a = (k / nn) * Math.PI * 2;
            const wx = cx0 + Math.cos(a) * r, wy = cy0 + Math.sin(a) * r;
            /* world -> view rotated coords */
            const vx = wx * cy2 + wy * sy2;
            const vy = -wx * sy2 + wy * cy2;
            if (vy < -S / 2 || vy > S / 2 || vx < -S / 2 || vx > S / 2) { if (ring.length > 1) { push(ring.map(toScreen), false); ring.length = 0; } continue; }
            const t = (vy / S + 0.5);
            const persp = 1 / (0.55 + t * 1.6 * (0.35 / Math.max(0.15, Math.tan(pa2))));
            const h = heightAt(wx, wy);
            ring.push([vx * persp, -t * rowSpread - h * persp * hMul]);
          }
          if (ring.length > 1) push(ring.map(toScreen), false);
        };
        for (const c of craters) {
          drape(c.x, c.y, c.R);
          drape(c.x, c.y, c.R * 0.55);
        }
        /* horizon = far edge row */
        push(rowsP[rowsP.length - 1].map(toScreen), false);
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
