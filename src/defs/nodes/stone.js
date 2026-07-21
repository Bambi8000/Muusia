import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "stone",
    name: "Stone", cat: "gen", group: "nature",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Stones", type: "slider", min: 1, max: 40, step: 1, def: 8 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 100, step: 1, def: 30 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "facets", label: "Facets", type: "slider", min: 5, max: 24, step: 1, def: 11 },
      { key: "angular", label: "Angularity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "shade", label: "Interior facets", type: "check", def: true },
      { key: "hatch", label: "Hatch shading", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "layout", label: "Layout", type: "select", options: ["Scatter", "Pile", "Wall"], def: "Scatter" },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 173 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
      { key: "shadePen", label: "Shade pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer), SP = Math.round(p.shadePen);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8419 + 71);
      const paths = [];
      const oneStone = (cx, cy, sz, sd) => {
        const rr = mulberry32(sd);
        const nF = Math.round(p.facets);
        const outline = [];
        const radii = [];
        for (let i = 0; i < nF; i++) {
          const a = (i / nF) * Math.PI * 2 + (rr() - 0.5) * 0.2;
          /* angularity: satunnainen sade -> rosoinen; sileampi kun pieni */
          const r = sz * 0.5 * (1 - p.angular * 0.5 * rr());
          radii.push(r);
          outline.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82]);
        }
        paths.push({ pts: outline, closed: true, layer: L });
        /* sisafasetit: muutama viiva reunapisteista sisaan -> kolmiulotteinen lohkare */
        if (p.shade) {
          const hi = [cx - sz * 0.12, cy - sz * 0.12];
          const nEdge = Math.min(nF, 3 + Math.floor(rr() * 3));
          for (let k = 0; k < nEdge; k++) {
            const idx = Math.floor(rr() * nF);
            paths.push({ pts: [outline[idx], hi], closed: false, layer: L });
          }
        }
        /* viivoitusvarjo alaoikealla */
        if (p.hatch > 0.05) {
          const nH = Math.round(p.hatch * 10);
          for (let s = 0; s < nH; s++) {
            const t = s / (nH + 1);
            const y = cy + sz * 0.1 + t * sz * 0.32;
            const half = sz * 0.4 * (1 - t) * 0.6;
            paths.push({ pts: [[cx + sz * 0.05, y], [cx + sz * 0.05 + half, y - half * 0.4]], closed: false, layer: SP });
          }
        }
      };
      const n = Math.round(p.count);
      const placed = [];
      let guard = 0;
      for (let i = 0; i < n && guard < n * 50; ) {
        guard++;
        const sz = p.size * (1 - p.sizeVar * rng());
        let cx, cy;
        if (p.layout === "Wall") {
          const cols = Math.ceil(Math.sqrt(n * (W / H)));
          const rows = Math.ceil(n / cols);
          const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
          const c = i % cols, r = Math.floor(i / cols);
          cx = m + (c + 0.5) * cw + (rng() - 0.5) * cw * 0.2;
          cy = m + (r + 0.5) * ch + (rng() - 0.5) * ch * 0.2;
        } else if (p.layout === "Pile") {
          cx = W / 2 + (rng() - 0.5) * (W - 2 * m) * 0.7;
          cy = H - m - sz * 0.5 - rng() * rng() * (H - 2 * m) * 0.8;
        } else {
          cx = m + sz / 2 + rng() * (W - 2 * m - sz);
          cy = m + sz / 2 + rng() * (H - 2 * m - sz);
        }
        let ok = true;
        for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * 0.44) { ok = false; break; }
        if (!ok && p.layout !== "Pile") continue;
        placed.push([cx, cy, sz]);
        oneStone(cx, cy, sz, p.seed + i * 29);
        i++;
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
