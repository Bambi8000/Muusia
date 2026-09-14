import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  /* Broken Grid - a grid whose every cell edge is an independent seeded
     decision, steered by a low-frequency zone field: some regions keep
     both directions (boxes), some collapse into columns of vertical
     dashes or runs of horizontals, some fall silent. Early-computer-art
     drawing in the Vera Molnar tradition. */
  key: "broken_grid",
  name: "Broken Grid",
  cat: "gen",
  group: "geometric",
  desc: "A grid falling apart by regions. Every cell edge is its own seeded decision driven by two noise fields, one for vertical edges and one for horizontal: Zones sets the size of the regions, Contrast sharpens them from gentle drift to hard either-or territories, Density scales everything, and Mix couples the two fields - at 0 vertical and horizontal zones live separate lives (columns of dashes here, rows there), at 1 they agree and the drawing becomes solid boxes against empty voids. Every drawn edge is a dash: Gap shortens it at both ends with per-edge jitter, Shift knocks it off the lattice by a fraction of the cell, Doubles gives a share of edges a second parallel stroke (the inked-twice look) and Wobble bends them by hand. All decisions are hashed per edge - fully deterministic. A built-in guard scans the lattice for isolated swastika-reading motifs (both chiralities, arm lengths 1-2) and deterministically removes one bend edge from any it finds, so the pattern can never accidentally form one; motifs buried inside dense grid regions do not read and are left alone.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "cell", label: "Cell", type: "slider", min: 3, max: 20, step: 0.5, def: 8 },
    { key: "zones", label: "Zones", type: "slider", min: 0.4, max: 3, step: 0.1, def: 1.4 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 1, step: 0.05, def: 0.7 },
    { key: "density", label: "Density", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.75 },
    { key: "mix", label: "Mix", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 0.45, step: 0.01, def: 0.12 },
    { key: "shift", label: "Shift", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "doubles", label: "Doubles", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "pen", label: "Pen", type: "pen", def: 0 },
  ],

  overlay(p, ctx, ins, node) {
    return [{ kind: "rect", x: p.margin, y: p.margin, w: ctx.W - 2 * p.margin, h: ctx.H - 2 * p.margin }];
  },

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const BUDGET = 110000;
    let used = 0;
    const paths = [];
    const pen = Math.max(0, Math.min(11, Math.round(p.pen)));
    const push = (pts) => {
      if (pts.length < 2 || used > BUDGET) return;
      used += pts.length;
      paths.push({ pts, closed: false, layer: pen });
    };
    const kSeed = (p.seed >>> 0) * 101 + 23;
    const m = Math.max(0, p.margin);
    const cell = Math.max(1.5, p.cell);
    const nx = Math.max(1, Math.floor((W - 2 * m) / cell));
    const ny = Math.max(1, Math.floor((H - 2 * m) / cell));
    const ox = (W - nx * cell) / 2;
    const oy = (H - ny * cell) / 2;
    const zf = Math.max(0.1, p.zones) * 0.9;
    const con = Math.max(0, Math.min(1, p.contrast));
    const den = Math.max(0, Math.min(1, p.density));
    const mix = Math.max(0, Math.min(1, p.mix));
    const shf = Math.max(0, p.shift) * cell * 0.35;
    const dg = Math.max(0, Math.min(0.45, p.gap));
    const wob = Math.max(0, p.wobble);

    /* two zone fields, coupled by Mix; Contrast pushes them toward hard
       either-or territories */
    const field = (x, y, which) => {
      const u = (x / Math.max(W, H)) * 4.2 / zf;
      const v = (y / Math.max(W, H)) * 4.2 / zf;
      const a = noise2(u + 3.1, v + 7.7, kSeed + 5);
      const b = noise2(u * 2.3 + 41.2, v * 2.3 + 19.5, kSeed + 9);
      /* Mix 0: horizontal territory is the OPPOSITE of vertical (hard
         either-or regions); Mix 1: both agree (boxes vs voids); a smaller
         independent field adds ragged territory borders */
      const n = which === 0 ? a : mix * a + (1 - mix) * (1 - a);
      const c = (n - 0.5) * (1 + con * 5) + 0.5 + (b - 0.5) * 0.35;
      return Math.max(0, Math.min(1, c)) * den;
    };

    /* one dash: from a to b, shortened, shifted, wobbled, maybe doubled */
    const dash = (ax, ay, bx, by, id) => {
      const g0 = dg * (0.5 + hash2(id, 1, kSeed + 11));
      const g1 = dg * (0.5 + hash2(id, 2, kSeed + 13));
      const t0 = Math.min(0.45, g0), t1 = Math.max(0.55, 1 - g1);
      const sx = (hash2(id, 3, kSeed + 17) - 0.5) * 2 * shf;
      const sy = (hash2(id, 4, kSeed + 19) - 0.5) * 2 * shf;
      const x0 = ax + (bx - ax) * t0 + sx, y0 = ay + (by - ay) * t0 + sy;
      const x1 = ax + (bx - ax) * t1 + sx, y1 = ay + (by - ay) * t1 + sy;
      const dx = x1 - x0, dy = y1 - y0;
      const L = Math.hypot(dx, dy);
      if (L < 0.4) return;
      const nxu = -dy / L, nyu = dx / L;
      const emit = (off) => {
        if (wob > 0.01) {
          const n = Math.max(2, Math.ceil(L / 2));
          const pts = [];
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const w = (noise2(t * 4 + id * 0.13, id * 0.71, kSeed + 29) - 0.5) * 2 * wob * 0.35;
            pts.push([x0 + dx * t + nxu * (w + off), y0 + dy * t + nyu * (w + off)]);
          }
          push(pts);
        } else {
          push([[x0 + nxu * off, y0 + nyu * off], [x1 + nxu * off, y1 + nyu * off]]);
        }
      };
      emit(0);
      if (hash2(id, 5, kSeed + 23) < p.doubles) emit(0.55);
    };

    /* pass 1: every edge decision into a lattice
       (vertical: node (i,j)->(i,j+1); horizontal: (i,j)->(i+1,j)) */
    const EV = [], EH = [];
    for (let i = 0; i <= nx; i++) {
      EV.push([]); EH.push([]);
      for (let j = 0; j <= ny; j++) {
        const x = ox + i * cell, y = oy + j * cell;
        EV[i].push(j < ny && hash2(i * 4096 + j * 2 + 0, 7, kSeed + 3) < field(x, y + cell / 2, 0));
        EH[i].push(i < nx && hash2(i * 4096 + j * 2 + 1, 7, kSeed + 3) < field(x + cell / 2, y, 1));
      }
    }
    const gV = (i, j) => i >= 0 && j >= 0 && i <= nx && j < ny && EV[i][j];
    const gH = (i, j) => i >= 0 && j >= 0 && i < nx && j <= ny && EH[i][j];

    /* pass 2: swastika guard - an isolated motif (both chiralities, arm
       lengths 1..2) gets one bend edge removed; buried motifs inside a
       dense region do not read and are left alone. Removals only delete
       edges, so the sweep converges. */
    {
      const motif = (i, j, L, cw) => {
        const edges = [];
        for (let k = 1; k <= L; k++) {
          if (!gV(i, j - k)) return null;
          edges.push(["V", i, j - k]);
          if (!gV(i, j + k - 1)) return null;
          edges.push(["V", i, j + k - 1]);
          if (!gH(i + k - 1, j)) return null;
          edges.push(["H", i + k - 1, j]);
          if (!gH(i - k, j)) return null;
          edges.push(["H", i - k, j]);
        }
        const bends = cw
          ? [["H", i, j - L], ["V", i + L, j], ["H", i - 1, j + L], ["V", i - L, j - 1]]
          : [["H", i - 1, j - L], ["V", i + L, j - 1], ["H", i, j + L], ["V", i - L, j]];
        for (const [t, a, b] of bends) {
          if (t === "V" ? !gV(a, b) : !gH(a, b)) return null;
          edges.push([t, a, b]);
        }
        /* isolation: count drawn edges touching motif nodes beyond the motif */
        const nodes = [[i, j]];
        for (let k = 1; k <= L; k++) nodes.push([i, j - k], [i, j + k], [i + k, j], [i - k, j]);
        nodes.push(cw ? [i + 1, j - L] : [i - 1, j - L]);
        nodes.push(cw ? [i + L, j + 1] : [i + L, j - 1]);
        nodes.push(cw ? [i - 1, j + L] : [i + 1, j + L]);
        nodes.push(cw ? [i - L, j - 1] : [i - L, j + 1]);
        const inMotif = new Set(edges.map((e) => e.join(",")));
        let extra = 0;
        for (const [a, b] of nodes) {
          if (gV(a, b) && !inMotif.has("V," + a + "," + b)) extra++;
          if (gV(a, b - 1) && !inMotif.has("V," + a + "," + (b - 1))) extra++;
          if (gH(a, b) && !inMotif.has("H," + a + "," + b)) extra++;
          if (gH(a - 1, b) && !inMotif.has("H," + (a - 1) + "," + b)) extra++;
        }
        if (extra > 3) return null;
        return { bends };
      };
      let guard = 0, found = true;
      while (found && guard++ < 60) {
        found = false;
        for (let i = 1; i < nx && !found; i++) {
          for (let j = 1; j < ny && !found; j++) {
            for (const L of [1, 2]) {
              for (const cw of [true, false]) {
                const mm = motif(i, j, L, cw);
                if (!mm) continue;
                const pick = mm.bends[Math.floor(hash2(i, j, kSeed + 97) * 4) % 4];
                if (pick[0] === "V") EV[pick[1]][pick[2]] = false;
                else EH[pick[1]][pick[2]] = false;
                found = true;
                break;
              }
              if (found) break;
            }
          }
        }
      }
    }

    /* pass 3: render */
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const x = ox + i * cell, y = oy + j * cell;
        if (gV(i, j)) dash(x, y, x, y + cell, i * 4096 + j * 2 + 0);
        if (gH(i, j)) dash(x, y, x + cell, y, i * 4096 + j * 2 + 1);
        if (used > BUDGET) break;
      }
      if (used > BUDGET) break;
    }
    return applyStyle({ paths }, ins[0]);
  },
};
