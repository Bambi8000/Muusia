import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "girih",
    name: "Girih",
    cat: "gen",
    group: "geometric",
    desc: "Islamic star patterns by Hankin's method: a polygon tiling where two rays leave every edge midpoint at a contact angle and meet inside the tile, weaving a continuous star-and-polygon lattice. One angle slider morphs through the whole pattern family (54 deg is the classic); hexagon and square tilings.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tiling", label: "Tiling", type: "select", options: ["Hexagons", "Squares"], def: "Hexagons" },
      { key: "cell", label: "Tile size mm", type: "slider", min: 8, max: 60, step: 1, def: 24 },
      { key: "angle", label: "Contact angle deg (wire LFO)", type: "slider", min: 15, max: 85, step: 0.5, def: 54 },
      { key: "tileLines", label: "Draw tile edges", type: "check", def: false },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);
      const s = Math.max(4, p.cell);
      const tiles = [];
      if (p.tiling === "Squares") {
        for (let y = y0; y + s <= y1 + 0.01; y += s) {
          for (let x = x0; x + s <= x1 + 0.01; x += s) {
            tiles.push([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]);
          }
        }
      } else {
        /* pointy-top hexagons in axial rows */
        const r = s / 2;
        const w = Math.sqrt(3) * r, h = 1.5 * r;
        for (let row = 0; ; row++) {
          const cy = y0 + r + row * h;
          if (cy + r > y1) break;
          const off = (row % 2) * (w / 2);
          for (let col = 0; ; col++) {
            const cx = x0 + w / 2 + off + col * w;
            if (cx + w / 2 > x1) break;
            const hex = [];
            for (let k = 0; k < 6; k++) {
              const a = (Math.PI / 3) * k + Math.PI / 6;
              hex.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
            }
            tiles.push(hex);
          }
        }
      }
      const th = (p.angle * Math.PI) / 180;
      const paths = [];
      const L = Math.round(p.layer);
      for (const poly of tiles) {
        const n = poly.length;
        /* per edge: midpoint + the two Hankin ray directions into the tile */
        const mids = [], d1 = [], d2 = [];
        let cx2 = 0, cy2 = 0;
        for (const [x, y] of poly) { cx2 += x; cy2 += y; }
        cx2 /= n; cy2 /= n;
        for (let i = 0; i < n; i++) {
          const A = poly[i], B = poly[(i + 1) % n];
          const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
          let ex = B[0] - A[0], ey = B[1] - A[1];
          const el = Math.hypot(ex, ey) || 1;
          ex /= el; ey /= el;
          /* inward normal */
          let nx = -ey, ny = ex;
          if ((cx2 - mx) * nx + (cy2 - my) * ny < 0) { nx = -nx; ny = -ny; }
          mids.push([mx, my]);
          d1.push([Math.cos(th) * ex + Math.sin(th) * nx, Math.cos(th) * ey + Math.sin(th) * ny]);
          d2.push([-Math.cos(th) * ex + Math.sin(th) * nx, -Math.cos(th) * ey + Math.sin(th) * ny]);
        }
        /* ray from edge i (dir d1) meets ray from edge i+1 (dir d2) */
        const ring = [];
        let ok = true;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const P = mids[i], D = d1[i], Q = mids[j], E = d2[j];
          const den = D[0] * E[1] - D[1] * E[0];
          let X;
          if (Math.abs(den) < 1e-9) {
            X = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
          } else {
            const t = ((Q[0] - P[0]) * E[1] - (Q[1] - P[1]) * E[0]) / den;
            if (t < 0 || t > s * 2) { ok = false; break; }
            X = [P[0] + D[0] * t, P[1] + D[1] * t];
          }
          ring.push(mids[i].slice(), X);
        }
        if (!ok || ring.length < 4) continue;
        paths.push({ pts: ring, closed: true, layer: L });
        if (p.tileLines) paths.push({ pts: poly.map((q) => q.slice()), closed: true, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
