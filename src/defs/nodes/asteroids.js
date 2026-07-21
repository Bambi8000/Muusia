import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "asteroids",
    name: "Asteroids", cat: "gen", group: "space",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "count", label: "Asteroids", type: "slider", min: 1, max: 40, step: 1, def: 10 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 90, step: 1, def: 28 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "verts", label: "Vertices", type: "slider", min: 6, max: 16, step: 1, def: 10 },
      { key: "jag", label: "Jaggedness", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.4 },
      { key: "ship", label: "Player ship", type: "check", def: true },
      { key: "bullets", label: "Bullets", type: "slider", min: 0, max: 12, step: 1, def: 4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 175 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8747 + 83);
      const paths = [];
      /* klassinen vektoriasteroidi: epasaannollinen monikulmio jossa sisaan/ulos-piikkeja */
      const oneRock = (cx, cy, sz, sd) => {
        const rr = mulberry32(sd);
        const nV = Math.round(p.verts);
        const pts = [];
        for (let i = 0; i < nV; i++) {
          const a = (i / nV) * Math.PI * 2;
          /* piikit: osa pisteista sisaan, osa ulos -> Asteroids-siluetti */
          const spike = rr() < 0.4 ? 1 - p.jag : 1 + p.jag * 0.5;
          const r = sz * 0.5 * spike;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        paths.push({ pts, closed: true, layer: L });
      };
      const n = Math.round(p.count);
      const placed = [];
      let guard = 0;
      for (let i = 0; i < n && guard < n * 40; ) {
        guard++;
        const sz = p.size * (1 - p.sizeVar * rng());
        const cx = m + sz / 2 + rng() * (W - 2 * m - sz);
        const cy = m + sz / 2 + rng() * (H - 2 * m - sz);
        let ok = true;
        for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * 0.5) { ok = false; break; }
        if (!ok) continue;
        placed.push([cx, cy, sz]);
        oneRock(cx, cy, sz, p.seed + i * 37);
        i++;
      }
      /* alus: klassinen kolmio + peräliekki-viiri */
      if (p.ship) {
        const sx = W / 2, sy = H * 0.7, ss = p.size * 0.6;
        const dir = -Math.PI / 2 + (rng() - 0.5) * 0.6;
        const tip = [sx + Math.cos(dir) * ss, sy + Math.sin(dir) * ss];
        const l = [sx + Math.cos(dir + 2.4) * ss * 0.8, sy + Math.sin(dir + 2.4) * ss * 0.8];
        const r = [sx + Math.cos(dir - 2.4) * ss * 0.8, sy + Math.sin(dir - 2.4) * ss * 0.8];
        const bl = [sx + Math.cos(dir + Math.PI) * ss * 0.35, sy + Math.sin(dir + Math.PI) * ss * 0.35];
        paths.push({ pts: [tip, l, bl, r, tip], closed: true, layer: L });
      }
      /* ammukset: pienet viivanpätkät */
      for (let b = 0; b < Math.round(p.bullets); b++) {
        const bx = m + rng() * (W - 2 * m), by = m + rng() * (H - 2 * m);
        const a = rng() * Math.PI * 2;
        paths.push({ pts: [[bx, by], [bx + Math.cos(a) * 2, by + Math.sin(a) * 2]], closed: false, layer: L });
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
