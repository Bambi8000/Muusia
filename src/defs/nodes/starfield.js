import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "starfield",
    name: "Starfield", cat: "gen", group: "space", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Stars", type: "slider", min: 10, max: 800, step: 5, def: 160 },
      { key: "dist", label: "Distribution", type: "select", options: ["Uniform", "Clustered"], def: "Clustered" },
      { key: "drawStars", label: "Draw stars", type: "check", def: true },
      { key: "starSize", label: "Star size mm", type: "slider", min: 0.2, max: 5, step: 0.1, def: 0.8 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "connect", label: "Connect", type: "select", options: ["None", "Near pairs (distance)", "K nearest", "Constellations"], def: "Constellations" },
      { key: "connDist", label: "Connect distance mm", type: "slider", min: 3, max: 100, step: 1, def: 28 },
      { key: "k", label: "K (nearest)", type: "slider", min: 1, max: 6, step: 1, def: 2 },
      { key: "starPen", label: "Star pen", type: "pen", def: 0 },
      { key: "linePen", label: "Line pen", type: "pen", def: 1 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 57 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 1201 + 11);
      const m = p.margin;
      /* tahdet */
      const stars = [];
      let guard = 0;
      while (stars.length < Math.round(p.count) && guard++ < p.count * 40) {
        const x = m + rng() * (W - 2 * m);
        const y = m + rng() * (H - 2 * m);
        if (p.dist === "Clustered") {
          const n = noise2(x * 0.012, y * 0.012, p.seed + 99);
          if (rng() > 0.08 + 0.92 * n * n) continue;
        }
        stars.push([x, y, 1 - p.sizeVar * rng()]);
      }
      const paths = [];
      const SP = Math.round(p.starPen), LP = Math.round(p.linePen);
      /* yhdysviivat */
      const seg = (a, b) => paths.push({ pts: [[stars[a][0], stars[a][1]], [stars[b][0], stars[b][1]]], closed: false, layer: LP });
      const d2 = (a, b) => {
        const dx = stars[a][0] - stars[b][0], dy = stars[a][1] - stars[b][1];
        return dx * dx + dy * dy;
      };
      if (p.connect === "Near pairs (distance)") {
        const lim = p.connDist * p.connDist;
        let nSeg = 0;
        for (let i = 0; i < stars.length && nSeg < 6000; i++) {
          for (let j = i + 1; j < stars.length && nSeg < 6000; j++) {
            if (d2(i, j) <= lim) { seg(i, j); nSeg++; }
          }
        }
      } else if (p.connect === "K nearest") {
        const done = new Set();
        for (let i = 0; i < stars.length; i++) {
          const near = stars.map((_, j) => j).filter((j) => j !== i)
            .sort((a, b) => d2(i, a) - d2(i, b)).slice(0, Math.round(p.k));
          for (const j of near) {
            const key = i < j ? i + "|" + j : j + "|" + i;
            if (!done.has(key)) { done.add(key); seg(i, j); }
          }
        }
      } else if (p.connect === "Constellations") {
        /* ketjuta: satunnainen aloitus, lahin vapaa naapuri sateella, 3-9 tahden kuvio */
        const used = new Set();
        const lim = p.connDist * p.connDist;
        const order = stars.map((_, i) => i).sort(() => rng() - 0.5);
        for (const start of order) {
          if (used.has(start)) continue;
          const chainLen = 3 + Math.floor(rng() * 7);
          const chain = [[stars[start][0], stars[start][1]]];
          used.add(start);
          let cur = start;
          for (let c = 1; c < chainLen; c++) {
            let best = -1, bd = lim;
            for (let j = 0; j < stars.length; j++) {
              if (used.has(j)) continue;
              const dd = d2(cur, j);
              if (dd <= bd) { bd = dd; best = j; }
            }
            if (best < 0) break;
            used.add(best);
            chain.push([stars[best][0], stars[best][1]]);
            cur = best;
          }
          if (chain.length > 1) paths.push({ pts: chain, closed: false, layer: LP });
        }
      }
      /* tahtipisteet paalle (piirtojarjestys: viivat ensin) */
      if (p.drawStars) {
        for (const [x, y, sz] of stars) {
          const r = Math.max(0.1, (p.starSize / 2) * sz);
          const pts = [];
          for (let q = 0; q < 8; q++) {
            const a = (q / 8) * Math.PI * 2;
            pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
          }
          paths.push({ pts, closed: true, layer: SP });
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
