import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "lichen",
    name: "Lichen",
    cat: "gen",
    group: "textimg",
    desc: "Map-lichen and crustose growth after the real thing: Map builds polygon patches split by continuous wandering cracks, each patch grain clipped to its own cell; Rosettes grows ringed circular thalli with dark centers and pale rims (target-lichen); Colony scatters mixed-age patches across bare rock. Pens splits species across the palette; fill style (mosaic / rings / stipple) is seed-mixed; sizes follow a natural small-to-large distribution.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "style", label: "Style", type: "select", options: ["Map", "Rosettes", "Colony"], def: "Map" },
      { key: "density", label: "Density", type: "slider", min: 0.2, max: 1, step: 0.05, def: 0.6 },
      { key: "scale", label: "Feature size mm", type: "slider", min: 4, max: 40, step: 1, def: 14 },
      { key: "detail", label: "Fill detail", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "crackWidth", label: "Crack width", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "pens", label: "Pens (species split)", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "crackPen", label: "Crack / center pen", type: "pen", def: 0 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 12 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 2749 + 13);
      const S = Math.max(2, p.scale);
      const NPENS = Math.max(1, Math.min(6, Math.round(p.pens)));
      const crackPen = Math.round(p.crackPen);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const clampPt = (x, y) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))];
      const push = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return false;
        total += pts.length;
        paths.push({ pts: pts.map(([x, y]) => clampPt(x, y)), closed, layer });
        return true;
      };
      /* natural size: many small, few large (power law) */
      const sizeRoll = () => Math.pow(rng(), 1.7);
      /* wobbly blob outline */
      const blob = (cx, cy, r, wob, sd, res) => {
        const pts = [];
        const nn = Math.max(14, Math.round(r * (res || 1.4)));
        for (let i = 0; i < nn; i++) {
          const a = (i / nn) * Math.PI * 2;
          const rr = r * (1 + (noise2(Math.cos(a) * 1.6 + sd, Math.sin(a) * 1.6 + sd * 0.7, sd | 0) - 0.5) * 2 * wob);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        return pts;
      };
      const inBlob = (px, py, cx, cy, r, wob, sd) => {
        const dx = px - cx, dy = py - cy;
        const d = Math.hypot(dx, dy);
        if (d > r * (1 + wob)) return false;
        const a = Math.atan2(dy, dx);
        const rr = r * (1 + (noise2(Math.cos(a) * 1.6 + sd, Math.sin(a) * 1.6 + sd * 0.7, sd | 0) - 0.5) * 2 * wob);
        return d <= rr;
      };
      /* fill a region, clipped by a test function inside(px,py) */
      const fillRegion = (cx, cy, r, layer, kind, inside) => {
        const det = p.detail;
        if (det < 0.05) return;
        if (kind === 1) {
          /* concentric wobble rings */
          const rings = Math.max(1, Math.round((r / (S * 0.16)) * det));
          for (let k = 1; k <= rings; k++) {
            const rr = r * (k / (rings + 1));
            const ring = blob(cx, cy, rr, 0.05, cx + cy + k * 7);
            if (ring.every(([x, y]) => inside(x, y))) push(ring, true, layer);
          }
        } else if (kind === 2) {
          /* stipple: denser toward center */
          const nd = Math.round(r * r * 0.07 * det);
          for (let i = 0; i < nd; i++) {
            const a = rng() * Math.PI * 2;
            const rr = Math.pow(rng(), 0.6) * r;
            const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
            if (!inside(px, py)) continue;
            const len = 0.35 + rng() * 0.7;
            const da = rng() * Math.PI;
            push([[px, py], [px + Math.cos(da) * len, py + Math.sin(da) * len]], false, layer);
          }
        } else {
          /* mosaic: jittered-grid cellular polygons, each tested against the region */
          const step = Math.max(1.1, S * 0.15 * (1.3 - det));
          for (let gy = -r; gy <= r; gy += step) {
            for (let gx = -r; gx <= r; gx += step) {
              const px = cx + gx + (rng() - 0.5) * step;
              const py = cy + gy + (rng() - 0.5) * step;
              if (!inside(px, py)) continue;
              if (rng() > det) continue;
              const cs = step * (0.26 + rng() * 0.2);
              const nn = 4 + Math.floor(rng() * 2);
              const cell = [];
              const rot = rng() * Math.PI;
              for (let i = 0; i < nn; i++) {
                const a = rot + (i / nn) * Math.PI * 2;
                cell.push([px + Math.cos(a) * cs, py + Math.sin(a) * cs]);
              }
              push(cell, true, layer);
            }
          }
        }
      };
      const penOf = (i) => i % NPENS;

      /* ---------- Rosettes / Colony ---------- */
      if (p.style === "Rosettes" || p.style === "Colony") {
        const placed = [];
        const area = (x1 - x0) * (y1 - y0);
        const tries = Math.round((area / (S * S)) * p.density * 4);
        for (let t = 0; t < tries; t++) {
          const r = S * (0.28 + sizeRoll() * 0.9);
          const pad = r * 1.15;
          if (x1 - x0 < pad * 2 || y1 - y0 < pad * 2) continue;
          const cx = x0 + pad + rng() * (x1 - x0 - pad * 2);
          const cy = y0 + pad + rng() * (y1 - y0 - pad * 2);
          let ok = true;
          for (const q of placed) {
            if (Math.hypot(cx - q[0], cy - q[1]) < (r + q[2]) * 0.9) { ok = false; break; }
          }
          if (!ok) continue;
          if (p.style === "Colony" && rng() > p.density) continue;
          placed.push([cx, cy, r]);
          const layer = penOf(Math.floor(rng() * NPENS));
          const wob = 0.1 + rng() * 0.08;
          const sd = (cx * 7 + cy * 13) % 997;
          const inside = (x, y) => inBlob(x, y, cx, cy, r, wob, sd);
          push(blob(cx, cy, r, wob, sd), true, layer);
          const kind = Math.floor(rng() * 3);
          if (p.style === "Rosettes") {
            /* target-lichen: pale rim (thin outer ring) + dark center on the crack/center pen */
            push(blob(cx, cy, r * 0.82, wob * 0.8, sd + 3), true, layer);
            fillRegion(cx, cy, r * 0.6, crackPen, kind === 1 ? 1 : 2, inside); /* dark textured center */
            if (rng() < 0.4) push(blob(cx, cy, r * 0.34, 0.08, sd + 9), true, crackPen);
          } else {
            fillRegion(cx, cy, r * 0.9, layer, kind, inside);
            if (rng() < 0.35) push(blob(cx, cy, r * 0.5, 0.1, sd + 5), true, crackPen);
          }
          if (total > BUDGET) break;
        }
        return applyStyle({ paths }, ins[0]);
      }

      /* ---------- Map lichen ---------- */
      const sites = [];
      const nSites = Math.max(4, Math.round(((x1 - x0) * (y1 - y0)) / (S * S)));
      for (let i = 0; i < nSites; i++) {
        sites.push([
          x0 + rng() * (x1 - x0),
          y0 + rng() * (y1 - y0),
          penOf(Math.floor(rng() * NPENS)),
          rng(),                    /* bare-rock roll */
          Math.floor(rng() * 3)     /* fill kind */
        ]);
      }
      const cell = Math.max(1.0, S * 0.12);
      const cols = Math.min(340, Math.round((x1 - x0) / cell) + 1);
      const rows = Math.min(460, Math.round((y1 - y0) / cell) + 1);
      const gx = (c) => x0 + (c / (cols - 1)) * (x1 - x0);
      const gy = (r) => y0 + (r / (rows - 1)) * (y1 - y0);
      const warp = 0.35 + p.crackWidth * 0.5;
      const idAt = (x, y) => {
        let best = Infinity, bi = -1;
        const wx = (noise2(x * 0.035, y * 0.035, p.seed) - 0.5) * warp;
        const wy = (noise2(x * 0.035 + 40, y * 0.035 + 40, p.seed) - 0.5) * warp;
        for (let i = 0; i < sites.length; i++) {
          const dx = x - sites[i][0], dy = y - sites[i][1];
          const d = (dx * dx + dy * dy) * (1 + wx) + dx * dy * wy;
          if (d < best) { best = d; bi = i; }
        }
        return bi;
      };
      const owner = new Int16Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) owner[r * cols + c] = idAt(gx(c), gy(r));

      /* borders as a set of edge segments, then chained into continuous cracks */
      const segKey = new Map(); /* "x,y" -> list of {to:"x,y"} adjacency for border edges */
      const q = (v) => Math.round(v * 4) / 4;
      const nodeKey = (x, y) => q(x) + "," + q(y);
      const addEdge = (ax, ay, bx, by) => {
        const ka = nodeKey(ax, ay), kb = nodeKey(bx, by);
        if (ka === kb) return;
        if (!segKey.has(ka)) segKey.set(ka, []);
        if (!segKey.has(kb)) segKey.set(kb, []);
        segKey.get(ka).push(kb);
        segKey.get(kb).push(ka);
      };
      /* a border runs between two cells that differ: emit the shared edge (a grid crossing) */
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const id = owner[r * cols + c];
          if (owner[r * cols + c + 1] !== id) {
            const x = (gx(c) + gx(c + 1)) / 2;
            addEdge(x, gy(r), x, gy(r + 1));
          }
          if (owner[(r + 1) * cols + c] !== id) {
            const y = (gy(r) + gy(r + 1)) / 2;
            addEdge(gx(c), y, gx(c + 1), y);
          }
        }
      }
      /* chain adjacency into polylines: walk from odd-degree/unused nodes */
      const coord = (k) => k.split(",").map(Number);
      const usedEdge = new Set();
      const ekey = (a, b) => a < b ? a + "|" + b : b + "|" + a;
      const walk = (start) => {
        const line = [start];
        let cur = start;
        while (true) {
          const nbrs = segKey.get(cur) || [];
          let nxt = null;
          for (const nb of nbrs) {
            if (!usedEdge.has(ekey(cur, nb))) { nxt = nb; break; }
          }
          if (!nxt) break;
          usedEdge.add(ekey(cur, nxt));
          line.push(nxt);
          cur = nxt;
        }
        return line;
      };
      if (p.crackWidth > 0.001) {
        for (const k of segKey.keys()) {
          if ((segKey.get(k) || []).length === 0) continue;
          let hasFree = false;
          for (const nb of segKey.get(k)) if (!usedEdge.has(ekey(k, nb))) { hasFree = true; break; }
          if (!hasFree) continue;
          const line = walk(k);
          if (line.length >= 3) push(line.map(coord), false, crackPen);
          if (total > BUDGET) break;
        }
      }

      /* fills: each site clipped to its OWN cell via the owner grid */
      const insideCell = (i) => (px, py) => {
        if (px < x0 || px > x1 || py < y0 || py > y1) return false;
        const c = Math.round(((px - x0) / (x1 - x0)) * (cols - 1));
        const r = Math.round(((py - y0) / (y1 - y0)) * (rows - 1));
        if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
        return owner[r * cols + c] === i;
      };
      for (let i = 0; i < sites.length; i++) {
        if (sites[i][3] > p.density) continue; /* bare rock */
        fillRegion(sites[i][0], sites[i][1], S * 0.85, sites[i][2], sites[i][4], insideCell(i));
        if (total > BUDGET) break;
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
