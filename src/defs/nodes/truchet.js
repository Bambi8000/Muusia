import { Pin, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "truchet",
  name: "Truchet",
  cat: "gen",
  group: "geometric",
  desc: "Tiled quarter-circle patterns. Tiles mode draws arc or diagonal tiles; Tile fill leaves a seeded share of tiles empty; Separate clamps arc radii and forces an edge gap so strands never meet or cross. Loop mode grows a spanning tree and emits one single closed line that fills the canvas - a maze you can plot without lifting the pen.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Pattern", type: "select", options: ["Tiles", "Loop"], def: "Tiles" },
    { key: "ttype", label: "Tile type", type: "select", options: ["Arcs", "Diagonals"], def: "Arcs" },
    { key: "fill", label: "Tile fill % (Tiles)", type: "slider", min: 10, max: 100, step: 1, def: 100 },
    { key: "sep", label: "Lines", type: "select", options: ["Connected", "Separate (never meet)"], def: "Connected" },
    { key: "tile", label: "Tile mm", type: "slider", min: 4, max: 60, step: 1, def: 15 },
    { key: "scale", label: "Scale %", type: "slider", min: 10, max: 400, step: 1, def: 100 },
    { key: "lines", label: "Lines per tile", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "spread", label: "Line spread %", type: "slider", min: 10, max: 100, step: 1, def: 100 },
    { key: "gapmm", label: "Arc gap mm", type: "slider", min: 0, max: 8, step: 0.1, def: 0 },
    { key: "round", label: "Corner radius % (loop)", type: "slider", min: 10, max: 100, step: 1, def: 100 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 9 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const t = Math.max(1.5, p.tile * (p.scale / 100));
    const L = Math.round(p.layer);

    /* ---------- LOOP: yksi suljettu kieppi (virittävä puu -> kiertoreitti) ---------- */
    if (p.mode === "Loop") {
      const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
      const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
      const s = t / 2; /* alihilan askel */
      const ox = (W - cols * t) / 2 + t / 4;
      const oy = (H - rows * t) / 2 + t / 4;
      const rng = mulberry32(p.seed * 811 + 3);
      /* virittava puu solujen ylitse (satunnainen DFS) */
      const visited = new Set();
      const treeH = new Set(); /* "i,j" = reuna (i,j)-(i+1,j) */
      const treeV = new Set(); /* "i,j" = reuna (i,j)-(i,j+1) */
      const stack = [[Math.floor(rng() * cols), Math.floor(rng() * rows)]];
      visited.add(stack[0][0] + "," + stack[0][1]);
      while (stack.length) {
        const [ci, cj] = stack[stack.length - 1];
        const nbrs = [];
        if (ci > 0 && !visited.has((ci - 1) + "," + cj)) nbrs.push([ci - 1, cj, "H", ci - 1, cj]);
        if (ci < cols - 1 && !visited.has((ci + 1) + "," + cj)) nbrs.push([ci + 1, cj, "H", ci, cj]);
        if (cj > 0 && !visited.has(ci + "," + (cj - 1))) nbrs.push([ci, cj - 1, "V", ci, cj - 1]);
        if (cj < rows - 1 && !visited.has(ci + "," + (cj + 1))) nbrs.push([ci, cj + 1, "V", ci, cj]);
        if (!nbrs.length) { stack.pop(); continue; }
        const [ni, nj, kind, ei, ej] = nbrs[Math.floor(rng() * nbrs.length)];
        (kind === "H" ? treeH : treeV).add(ei + "," + ej);
        visited.add(ni + "," + nj);
        stack.push([ni, nj]);
      }
      /* alihilan reunat: joka solu pieni rengas, puun reunat leikkaa+liittaa renkaat yhdeksi */
      const edges = new Set();
      const ek = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
      const vk = (x, y) => x + "," + y;
      const addE = (x1, y1, x2, y2) => edges.add(ek(vk(x1, y1), vk(x2, y2)));
      const delE = (x1, y1, x2, y2) => edges.delete(ek(vk(x1, y1), vk(x2, y2)));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = [2 * i, 2 * j], b = [2 * i + 1, 2 * j], c = [2 * i, 2 * j + 1], d = [2 * i + 1, 2 * j + 1];
        addE(...a, ...b); addE(...b, ...d); addE(...d, ...c); addE(...c, ...a);
      }
      for (const key of treeH) {
        const [i, j] = key.split(",").map(Number);
        delE(2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1);
        delE(2 * i + 2, 2 * j, 2 * i + 2, 2 * j + 1);
        addE(2 * i + 1, 2 * j, 2 * i + 2, 2 * j);
        addE(2 * i + 1, 2 * j + 1, 2 * i + 2, 2 * j + 1);
      }
      for (const key of treeV) {
        const [i, j] = key.split(",").map(Number);
        delE(2 * i, 2 * j + 1, 2 * i + 1, 2 * j + 1);
        delE(2 * i, 2 * j + 2, 2 * i + 1, 2 * j + 2);
        addE(2 * i, 2 * j + 1, 2 * i, 2 * j + 2);
        addE(2 * i + 1, 2 * j + 1, 2 * i + 1, 2 * j + 2);
      }
      /* jokaisen pisteen aste on 2 -> seuraa sykli */
      const adj = {};
      for (const e of edges) {
        const [a, b] = e.split("|");
        (adj[a] = adj[a] || []).push(b);
        (adj[b] = adj[b] || []).push(a);
      }
      const startK = vk(0, 0);
      const loop = [];
      let cur = startK, prev = null;
      for (let guard = 0; guard < edges.size + 2; guard++) {
        loop.push(cur);
        const nb = adj[cur] || [];
        const nxt = nb[0] === prev ? nb[1] : nb[0];
        if (nxt === undefined) break;
        prev = cur; cur = nxt;
        if (cur === startK) break;
      }
      const V = loop.map((k) => {
        const [x, y] = k.split(",").map(Number);
        return [ox + x * s, oy + y * s];
      });
      /* pyorista kulmat neljanneskaarilla -> truchet-ilme */
      const r = (s / 2) * (p.round / 100);
      const pts = [];
      const N = V.length;
      for (let i = 0; i < N; i++) {
        const v = V[i], pr = V[(i - 1 + N) % N], nx = V[(i + 1) % N];
        const d1 = [v[0] - pr[0], v[1] - pr[1]];
        const d2 = [nx[0] - v[0], nx[1] - v[1]];
        const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
        const u1 = [d1[0] / l1, d1[1] / l1], u2 = [d2[0] / l2, d2[1] / l2];
        const cross = u1[0] * u2[1] - u1[1] * u2[0];
        if (Math.abs(cross) < 0.01) { pts.push([v[0], v[1]]); continue; } /* suora jatkuu */
        const P1 = [v[0] - u1[0] * r, v[1] - u1[1] * r];
        const C = [P1[0] + u2[0] * r, P1[1] + u2[1] * r];
        const a1 = Math.atan2(P1[1] - C[1], P1[0] - C[0]);
        const sweep = (cross > 0 ? 1 : -1) * (Math.PI / 2);
        for (let k = 0; k <= 6; k++) {
          const a = a1 + (k / 6) * sweep;
          pts.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]);
        }
      }
      return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);
    }

    /* ---------- TILES: perinteinen truchet-laatoitus ---------- */
    const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
    const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
    const ox = (W - cols * t) / 2, oy = (H - rows * t) / 2;
    const paths = [];
    const nL = Math.round(p.lines);
    const spread = p.spread / 100;
    const sep = p.sep === "Separate (never meet)";
    const gmm = sep ? Math.max(1, p.gapmm) : p.gapmm;
    const fillP = Math.max(0.05, Math.min(1, p.fill / 100));
    const arc = (cx, cy, a0) => {
      const seen = new Set();
      for (let m = 0; m < nL; m++) {
        let rr = t / 2 + ((m + 0.5) / nL - 0.5) * t * spread;
        if (sep) rr = Math.min(rr, t * 0.7); /* opposite-corner families cannot cross */
        if (rr <= 0.3) continue;
        const rk = Math.round(rr * 20);
        if (seen.has(rk)) continue; /* clamp may collapse radii */
        seen.add(rk);
        const dA = Math.min(0.55, (gmm / 2) / rr);
        const a1 = a0 + dA, a2 = a0 + Math.PI / 2 - dA;
        if (a2 <= a1) continue;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const a = a1 + (i / 12) * (a2 - a1);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
    };
    const diag = (x0, y0, kind) => {
      for (let m = 0; m < nL; m++) {
        const o = ((m + 0.5) / nL - 0.5) * t * spread;
        let A, B;
        if (kind === "\\") {
          A = o >= 0 ? [x0 + o, y0] : [x0, y0 - o];
          B = o >= 0 ? [x0 + t, y0 + t - o] : [x0 + t + o, y0 + t];
        } else {
          A = o >= 0 ? [x0 + t - o, y0] : [x0 + t, y0 - o];
          B = o >= 0 ? [x0, y0 + t - o] : [x0 - o, y0 + t];
        }
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy);
        const g2 = gmm / 2;
        if (len > gmm + 0.5) {
          A = [A[0] + (dx / len) * g2, A[1] + (dy / len) * g2];
          B = [B[0] - (dx / len) * g2, B[1] - (dy / len) * g2];
          paths.push({ pts: [A, B], closed: false, layer: L });
        }
      }
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (fillP < 0.999 && hash2(c * 7 + 3, r * 13 + 5, p.seed + 77) > fillP) continue;
      const x0 = ox + c * t, y0 = oy + r * t;
      const flip = hash2(c, r, p.seed) > 0.5;
      if (p.ttype === "Arcs") {
        if (flip) { arc(x0, y0, 0); arc(x0 + t, y0 + t, Math.PI); }
        else { arc(x0 + t, y0, Math.PI / 2); arc(x0, y0 + t, -Math.PI / 2); }
      } else {
        diag(x0, y0, flip ? "\\" : "/");
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};