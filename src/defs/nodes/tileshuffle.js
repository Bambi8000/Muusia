import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "tileshuffle",
    name: "Tile Shuffle",
    cat: "mod",
    group: "deform",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "cols", label: "Columns", type: "slider", min: 2, max: 12, step: 1, def: 4 },
      { key: "rows", label: "Rows", type: "slider", min: 2, max: 12, step: 1, def: 5 },
      { key: "amount", label: "Shuffle amount", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "flips", label: "Random flips / 180", type: "check", def: true },
      { key: "res", label: "Cut step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "seed", label: "Seed", type: "seed", def: 47 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      const { W, H } = ctx;
      const C = Math.max(1, Math.min(16, Math.round(p.cols)));
      const R = Math.max(1, Math.min(16, Math.round(p.rows)));
      const tw = W / C, th = H / R;
      const NT = C * R;
      /* seeded permutation over a subset chosen by Amount */
      const rng = mulberry32(p.seed * 5501 + 9);
      const inShuffle = [];
      for (let i = 0; i < NT; i++) if (rng() < p.amount) inShuffle.push(i);
      const perm = new Array(NT);
      for (let i = 0; i < NT; i++) perm[i] = i;
      const pool = inShuffle.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      inShuffle.forEach((tile, k) => { perm[tile] = pool[k]; });
      /* per-tile flip/rotation (bounds-safe: flips + 180 only) */
      const mode = new Array(NT).fill(0);
      if (p.flips) {
        for (let i = 0; i < NT; i++) {
          if (perm[i] !== i || rng() < p.amount * 0.3) mode[i] = Math.floor(rng() * 4); /* 0=none 1=flipX 2=flipY 3=180 */
        }
      }
      const paths = [];
      src.paths.forEach((path) => {
        const pts = resample(path.pts, path.closed, Math.max(0.25, p.res));
        let run = [], lastTile = -1, prev = null;
        const flushRun = () => {
          if (run.length > 1) {
            const tile = lastTile;
            const dst = perm[tile];
            const sx = (tile % C) * tw, sy = Math.floor(tile / C) * th;
            const dx = (dst % C) * tw, dy = Math.floor(dst / C) * th;
            const mo = mode[tile];
            paths.push({
              pts: run.map(([x, y]) => {
                let lx = x - sx, ly = y - sy;
                if (mo === 1 || mo === 3) lx = tw - lx;
                if (mo === 2 || mo === 3) ly = th - ly;
                return [dx + lx, dy + ly];
              }),
              closed: false, layer: path.layer
            });
          }
          run = [];
        };
        for (const pt of pts) {
          const tx = Math.min(C - 1, Math.max(0, Math.floor(pt[0] / tw)));
          const ty = Math.min(R - 1, Math.max(0, Math.floor(pt[1] / th)));
          const tile = ty * C + tx;
          if (tile !== lastTile && run.length && prev) {
            /* exact cut: intersect the crossing segment with the tile border
               and give the boundary point to BOTH runs (no ink lost at seams) */
            const px = prev[0], py = prev[1];
            const dx = pt[0] - px, dy = pt[1] - py;
            const ptx = Math.floor(px / tw), pty = Math.floor(py / th);
            let t = 1;
            if (tx !== ptx && Math.abs(dx) > 1e-12) {
              const xb = tw * Math.max(ptx, tx);
              t = Math.min(t, (xb - px) / dx);
            }
            if (ty !== pty && Math.abs(dy) > 1e-12) {
              const yb = th * Math.max(pty, ty);
              t = Math.min(t, (yb - py) / dy);
            }
            t = Math.max(0, Math.min(1, t));
            const bp = [px + dx * t, py + dy * t];
            run.push(bp);
            flushRun();
            run = [bp.slice()];
          }
          lastTile = tile;
          run.push(pt);
          prev = pt;
        }
        flushRun();
      });
      return { paths };
    }
  
};
