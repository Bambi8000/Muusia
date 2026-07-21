import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "subway",
    name: "Subway Map",
    cat: "gen",
    group: "structural",
    desc: "A transit map in classic Massimo Vignelli style: octilinear routes (0/45/90 degrees only), lines bundling into shared corridors with even spacing and splitting off at 45, station dots on each line's own pen, larger interchange rings where lines meet, and terminal bars at route ends. Lines cycle through your pens - one color per route.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "lines", label: "Lines", type: "slider", min: 1, max: 8, step: 1, def: 5 },
      { key: "grid", label: "Grid step mm", type: "slider", min: 6, max: 24, step: 1, def: 12 },
      { key: "gap", label: "Line gap mm", type: "slider", min: 1, max: 4, step: 0.25, def: 2 },
      { key: "length", label: "Route length", type: "slider", min: 0.3, max: 1, step: 0.05, def: 0.7 },
      { key: "bend", label: "Bendiness", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.4 },
      { key: "stations", label: "Stations", type: "check", def: true },
      { key: "statEvery", label: "Station every mm", type: "slider", min: 12, max: 60, step: 1, def: 26 },
      { key: "statPen", label: "Interchange pen", type: "pen", def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 7 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 30 || y1 - y0 < 30) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 3181 + 7);
      const G = Math.max(4, p.grid);
      const N = Math.max(1, Math.min(8, Math.round(p.lines)));
      const GAP = p.gap;
      const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      /* octilinear walk inside the margin box */
      const walk = (sx, sy, d, steps) => {
        const pts = [[sx, sy]];
        let x = sx, y = sy;
        let sinceTurn = 0;
        for (let i = 0; i < steps; i++) {
          /* steer back inside if next step exits — never a full reversal */
          const fits = (dd) => {
            const nx = x + DIR[dd][0] * G, ny = y + DIR[dd][1] * G;
            return nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
          };
          if (!fits(d)) {
            const sgn = rng() < 0.5 ? 1 : -1;
            let found = -1;
            for (const t of [sgn, -sgn, 2 * sgn, -2 * sgn, 3 * sgn, -3 * sgn]) {
              const dd = ((d + t) % 8 + 8) % 8;
              if (fits(dd)) { found = dd; break; }
            }
            if (found < 0) break;
            d = found;
          }
          x += DIR[d][0] * G; y += DIR[d][1] * G;
          pts.push([x, y]);
          sinceTurn++;
          if (sinceTurn >= 2 && rng() < p.bend * 0.45) {
            d = (d + (rng() < 0.5 ? 1 : 7)) % 8;
            sinceTurn = 0;
          }
        }
        /* collapse spikes (A-B-A) so offsets can't tear them open */
        for (let i = pts.length - 2; i >= 1; i--) {
          if (Math.abs(pts[i - 1][0] - pts[i + 1][0]) < 0.01 && Math.abs(pts[i - 1][1] - pts[i + 1][1]) < 0.01) {
            pts.splice(i, 2);
            if (i > pts.length - 1) i = pts.length - 1;
          }
        }
        return pts;
      };
      /* lateral offset with 45/90-degree miters (bisector) */
      const offsetPoly = (pts, off) => {
        if (Math.abs(off) < 0.01 || pts.length < 2) return pts.map((q) => q.slice());
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const b = pts[i];
          /* endpoints: pure segment normal, no miter */
          if (i === 0 || i === pts.length - 1) {
            const q = i === 0 ? pts[1] : pts[pts.length - 2];
            let dx = i === 0 ? q[0] - b[0] : b[0] - q[0];
            let dy = i === 0 ? q[1] - b[1] : b[1] - q[1];
            const l = Math.hypot(dx, dy) || 1;
            out.push([b[0] + (-dy / l) * off, b[1] + (dx / l) * off]);
            continue;
          }
          const a = pts[i - 1], c = pts[i + 1];
          let d1x = b[0] - a[0], d1y = b[1] - a[1];
          let d2x = c[0] - b[0], d2y = c[1] - b[1];
          const l1 = Math.hypot(d1x, d1y) || 1, l2 = Math.hypot(d2x, d2y) || 1;
          d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
          const n1x = -d1y, n1y = d1x, n2x = -d2y, n2y = d2x;
          let bx = n1x + n2x, by = n1y + n2y;
          const bl = Math.hypot(bx, by);
          if (bl < 0.01) { bx = n1x; by = n1y; }
          else {
            bx /= bl; by /= bl;
            const dot = bx * n1x + by * n1y;
            const miter = Math.min(3.0, 1 / Math.max(0.3, dot));
            bx *= miter; by *= miter;
          }
          out.push([b[0] + bx * off, b[1] + by * off]);
        }
        return out;
      };
      /* trunks: shared corridors */
      const T = Math.max(1, Math.round(N / 3));
      const trunks = [];
      const area = Math.min(x1 - x0, y1 - y0);
      const trunkSteps = Math.round((area / G) * 2.2 * p.length);
      for (let t = 0; t < T; t++) {
        const sx = x0 + G + Math.round(rng() * ((x1 - x0 - 2 * G) / G)) * G;
        const sy = y0 + G + Math.round(rng() * ((y1 - y0 - 2 * G) / G)) * G;
        trunks.push({ pts: walk(sx, sy, Math.floor(rng() * 8), trunkSteps), slots: 0 });
      }
      /* lines: follow a span of a trunk at their slot offset + own 45-degree tails */
      const linePolys = [];
      for (let i = 0; i < N; i++) {
        const tr = trunks[i % T];
        const slot = tr.slots++;
        const off = (slot - (Math.ceil(N / T) - 1) / 2) * GAP;
        const M2 = tr.pts.length;
        if (M2 < 6) continue;
        const a = Math.floor(rng() * M2 * 0.25);
        const b = M2 - 1 - Math.floor(rng() * M2 * 0.25);
        const span = tr.pts.slice(a, b + 1);
        /* tails: continue from span ends, first step turns off the corridor */
        const tail = (end) => {
          const e = end ? span[span.length - 1] : span[0];
          const e2 = end ? span[span.length - 2] : span[1];
          let dx = e[0] - e2[0], dy = e[1] - e2[1];
          let d = DIR.findIndex(([qx, qy]) => Math.abs(qx * G - dx) < 0.5 && Math.abs(qy * G - dy) < 0.5);
          if (d < 0) d = 0;
          d = (d + (rng() < 0.5 ? 1 : 7)) % 8;
          const tl = walk(e[0], e[1], d, Math.round(trunkSteps * (0.15 + rng() * 0.3)));
          return tl.slice(1);
        };
        const tEnd = tail(true), tStart = tail(false).reverse();
        const full = [...tStart, ...span, ...tEnd];
        const poly = offsetPoly(full, off);
        linePolys.push({ poly, layer: i, off });
        push(poly, false, i);
      }
      /* terminal bars: short perpendicular tick at each end */
      for (const L of linePolys) {
        const P = L.poly;
        for (const end of [0, 1]) {
          const a = end ? P[P.length - 1] : P[0];
          const b = end ? P[P.length - 2] : P[1];
          let dx = a[0] - b[0], dy = a[1] - b[1];
          const l = Math.hypot(dx, dy) || 1;
          const nx = -dy / l, ny = dx / l;
          const r = GAP * 1.1;
          push([[a[0] - nx * r, a[1] - ny * r], [a[0] + nx * r, a[1] + ny * r]], false, L.layer);
        }
      }
      /* stations */
      if (p.stations) {
        const segD = (x, y, s) => {
          const dx = s[2] - s[0], dy = s[3] - s[1];
          const L2 = dx * dx + dy * dy;
          let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          return Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
        };
        const lineSegs = linePolys.map((L) => {
          const segs = [];
          for (let i = 1; i < L.poly.length; i++) segs.push([L.poly[i - 1][0], L.poly[i - 1][1], L.poly[i][0], L.poly[i][1]]);
          return segs;
        });
        const circle = (cx, cy, r) => {
          const nn = Math.max(10, Math.round(r * 6));
          const c = [];
          for (let k = 0; k < nn; k++) {
            const a = (k / nn) * Math.PI * 2;
            c.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
          return c;
        };
        for (let li = 0; li < linePolys.length; li++) {
          const P = linePolys[li].poly;
          let acc = p.statEvery * 0.5;
          for (let i = 1; i < P.length; i++) {
            const ds = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
            let s = 0;
            while (acc + (ds - s) >= p.statEvery) {
              const need = p.statEvery - acc;
              s += need;
              const t = s / ds;
              const sx = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t;
              const sy = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t;
              /* interchange? close to another line */
              let inter = false;
              for (let lj = 0; lj < lineSegs.length && !inter; lj++) {
                if (lj === li) continue;
                for (const sg of lineSegs[lj]) {
                  if (segD(sx, sy, sg) < GAP * 1.8) { inter = true; break; }
                }
              }
              if (inter) push(circle(sx, sy, GAP * 1.3), true, Math.round(p.statPen));
              else push(circle(sx, sy, 1.0), true, linePolys[li].layer);
              acc = 0;
            }
            acc += ds - s;
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
