import { Pin, EMPTY, mulberry32, resample } from "../helpers.js";

export default {
  key: "rectcollage",
    name: "Rect Collage",
    cat: "mod",
    group: "cutsplit",
    desc: "Cuts random rectangles of different sizes out of the input and rearranges the pieces at random positions (optionally rotated in 90-degree steps). Unlike Tile Shuffle's regular grid, pieces vary in size and land anywhere. Keep rest passes the uncut remainder through underneath.",
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "pieces", label: "Pieces", type: "slider", min: 1, max: 24, step: 1, def: 8 },
      { key: "minSize", label: "Min size mm", type: "slider", min: 5, max: 80, step: 1, def: 15 },
      { key: "maxSize", label: "Max size mm", type: "slider", min: 10, max: 160, step: 1, def: 60 },
      { key: "rotate", label: "Rotate 90 steps", type: "check", def: true },
      { key: "keepRest", label: "Keep rest", type: "check", def: false },
      { key: "res", label: "Cut step mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.8 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 8 },
      { key: "seed", label: "Seed", type: "seed", def: 6 }
    ],
    compute(ins, p, ctx) {
      const src = ins[0] || EMPTY;
      if (!src.paths.length) return EMPTY;
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const rng = mulberry32(p.seed * 7213 + 3);
      const lo = Math.min(p.minSize, p.maxSize), hi2 = Math.max(p.minSize, p.maxSize);
      const NP = Math.round(p.pieces);
      /* source rects + target placements */
      const rects = [];
      for (let i = 0; i < NP; i++) {
        const rw = lo + rng() * (hi2 - lo);
        const rh = lo + rng() * (hi2 - lo);
        const sx = rng() * Math.max(1, W - rw);
        const sy = rng() * Math.max(1, H - rh);
        const rot = p.rotate ? Math.floor(rng() * 4) : 0;
        const tw = rot % 2 ? rh : rw, th = rot % 2 ? rw : rh;
        const tx = m + rng() * Math.max(1, W - 2 * m - tw);
        const ty = m + rng() * Math.max(1, H - 2 * m - th);
        rects.push({ sx, sy, rw, rh, rot, tx, ty });
      }
      const out = [];
      const BUDGET = 120000;
      let total = 0;
      const emit = (pts, closed, layer) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        out.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer
        });
      };
      const step = Math.max(0.2, p.res);
      /* per piece: clip source runs inside rect, map to target with rotation */
      for (const R of rects) {
        const inR = (x, y) => x >= R.sx && x <= R.sx + R.rw && y >= R.sy && y <= R.sy + R.rh;
        const map = (x, y) => {
          let u = x - R.sx, v = y - R.sy; /* 0..rw, 0..rh */
          let a, b2;
          if (R.rot === 0) { a = u; b2 = v; }
          else if (R.rot === 1) { a = R.rh - v; b2 = u; }
          else if (R.rot === 2) { a = R.rw - u; b2 = R.rh - v; }
          else { a = v; b2 = R.rw - u; }
          return [R.tx + a, R.ty + b2];
        };
        for (const pa of src.paths) {
          const pts = resample(pa.pts, pa.closed, step);
          let run = [];
          let all = true;
          for (const [x, y] of pts) {
            if (inR(x, y)) run.push(map(x, y));
            else {
              all = false;
              if (run.length > 1) emit(run, false, pa.layer);
              run = [];
            }
          }
          if (all && pa.closed && run.length > 2) emit(run, true, pa.layer);
          else if (run.length > 1) emit(run, false, pa.layer);
        }
      }
      /* keep the uncut remainder */
      if (p.keepRest) {
        for (const pa of src.paths) {
          const pts = resample(pa.pts, pa.closed, step);
          let run = [];
          let all = true;
          for (const [x, y] of pts) {
            const cut = rects.some((R) => x >= R.sx && x <= R.sx + R.rw && y >= R.sy && y <= R.sy + R.rh);
            if (!cut) run.push([x, y]);
            else {
              all = false;
              if (run.length > 1) emit(run, false, pa.layer);
              run = [];
            }
          }
          if (all && pa.closed && run.length > 2) emit(run, true, pa.layer);
          else if (run.length > 1) emit(run, false, pa.layer);
        }
      }
      return { paths: out };
    }
  
};
