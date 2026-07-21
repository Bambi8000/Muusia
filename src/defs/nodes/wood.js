import { Pin, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "wood",
      name: "Wood Rings",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Cut", type: "select", options: ["Rings (cross-cut)", "Grain (split face)"], def: "Rings (cross-cut)" },
      { key: "rings", label: "Rings (years)", type: "slider", min: 4, max: 90, step: 1, def: 30 },
      { key: "spacing", label: "Ring spacing mm", type: "slider", min: 0.5, max: 10, step: 0.1, def: 2.6 },
      { key: "yearVar", label: "Growth variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
      { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.14 },
      { key: "ecc", label: "Eccentricity", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "eccAng", label: "Eccentricity angle °", type: "slider", min: -180, max: 180, step: 1, def: 40 },
      { key: "cracks", label: "Cracks", type: "slider", min: 0, max: 8, step: 1, def: 3 },
      { key: "bark", label: "Bark", type: "check", def: true },
      { key: "flame", label: "Flame (grain mode)", type: "slider", min: 0.2, max: 3, step: 0.05, def: 1 },
      { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 150 },
      { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 100 },
      { key: "seed", label: "Seed", type: "seed", def: 131 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const rng = mulberry32(p.seed * 4271 + 83);
      const nR = Math.round(p.rings);
      const paths = [];
      /* kasvuvuodet: leveys vaihtelee (kuivat vuodet kapeita, hyvat leveita),
         hitaalla kohinalla jotta vuodet ryhmittyvat jaksoiksi */
      const widths = [];
      let radius = 0;
      for (let i = 0; i < nR; i++) {
        const w = p.spacing * (1 - p.yearVar * 0.85 * noise2(i * 0.35, 3.7, p.seed + 11));
        widths.push(Math.max(p.spacing * 0.12, w));
        radius += widths[i];
      }
      if (p.mode === "Rings (cross-cut)") {
        /* jaettu kulmakohina: renkaat samanmuotoisia -> eivat leikkaa toisiaan */
        const angNoise = (th, i) => {
          const x = Math.cos(th) * 1.6, y = Math.sin(th) * 1.6;
          const shared = noise2(x + 40, y + 40, p.seed) - 0.5;
          const evolve = (noise2(x * 2.3 + i * 0.06, y * 2.3, p.seed + 7) - 0.5) * 0.3;
          return shared + evolve;
        };
        const eA = (p.eccAng * Math.PI) / 180;
        let r = 0;
        /* ydin */
        const pith = [];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          pith.push([p.cx + Math.cos(a) * 0.7, p.cy + Math.sin(a) * 0.7]);
        }
        paths.push({ pts: pith, closed: true, layer: L });
        const ringPt = (th, rr, i) => {
          /* epakeskisyys: rengas venyy yhteen suuntaan (reaktiopuu) */
          const stretch = 1 + p.ecc * 0.55 * Math.cos(th - eA);
          const rad = rr * stretch * (1 + p.wobble * 2 * angNoise(th, i));
          return [p.cx + Math.cos(th) * rad, p.cy + Math.sin(th) * rad];
        };
        for (let i = 0; i < nR; i++) {
          r += widths[i];
          const nS = Math.max(40, Math.min(160, Math.round(r * 2.2)));
          const pts = [];
          for (let k = 0; k < nS; k++) {
            pts.push(ringPt((k / nS) * Math.PI * 2, r, i));
          }
          paths.push({ pts, closed: true, layer: L });
        }
        /* kaarna: rosoinen kaksoiskeha uloimman ulkopuolella */
        if (p.bark) {
          for (const extra of [0.35, 0.75]) {
            const rr = r + p.spacing * extra + 0.6;
            const nS = Math.max(60, Math.round(rr * 2.5));
            const pts = [];
            for (let k = 0; k < nS; k++) {
              const th = (k / nS) * Math.PI * 2;
              const rough = (hash2(k, Math.round(extra * 10), p.seed + 23) - 0.5) * p.spacing * 0.8;
              const [x, y] = ringPt(th, rr, nR);
              const d = Math.hypot(x - p.cx, y - p.cy) || 1;
              pts.push([x + ((x - p.cx) / d) * rough, y + ((y - p.cy) / d) * rough]);
            }
            paths.push({ pts, closed: true, layer: L });
          }
        }
        /* halkeamat: sateittaiset kapenevat kiilat sahalaidalla */
        const nC = Math.round(p.cracks);
        for (let c = 0; c < nC; c++) {
          const th = rng() * Math.PI * 2;
          const rIn = r * (0.15 + rng() * 0.25);
          const rOut = r * (0.85 + rng() * 0.14);
          const wid = 0.02 + rng() * 0.035; /* kiilan kulmapuolikas juuressa */
          for (const s of [1, -1]) {
            const pts = [];
            const nS = 14;
            for (let k = 0; k <= nS; k++) {
              const t = k / nS;
              const rr = rIn + (rOut - rIn) * t;
              const jag = (hash2(k, c * 7 + (s > 0 ? 0 : 50), p.seed + 31) - 0.5) * 0.04;
              const a = th + s * wid * (1 - t) + jag;
              pts.push(ringPt(a, rr, 0));
            }
            paths.push({ pts, closed: false, layer: L });
          }
        }
      } else {
        /* GRAIN: halkaistu pinta — sisakkaiset liekkikaaret.
           Rengas i leikkaa pinnan paraabelina: pieni i = tiukka katedraalikaari,
           iso i = loivenee lankun reunoja kohti. */
        const bw = Math.min(W - 20, radius * 3.2);
        const x0 = p.cx - bw / 2, x1 = p.cx + bw / 2;
        const apexY = p.cy - radius * 0.9;
        let a = 0;
        for (let i = 0; i < nR; i++) {
          a += widths[i];
          const focal = p.flame * (a * 0.9 + 6);
          const pts = [];
          const step = 1.4;
          for (let x = x0; x <= x1 + 0.01; x += step) {
            const u = x - p.cx;
            let y = apexY + a + (u * u) / (4 * focal);
            /* syykuvion elava varina, hitaasti kaarta pitkin */
            y += (noise2(x * 0.03, i * 0.4, p.seed + 3) - 0.5) * p.wobble * 26;
            /* pysty-epakeskisyys: kaaret kallistuvat */
            y += p.ecc * u * 0.12 * Math.sin(i * 0.3);
            if (y > apexY - 2 && y < H - 4 && y > 4) pts.push([x, y]);
            else if (pts.length > 1) {
              paths.push({ pts: pts.slice(), closed: false, layer: L });
              pts.length = 0;
            } else pts.length = 0;
          }
          if (pts.length > 1) paths.push({ pts, closed: false, layer: L });
        }
        /* halkeamat grain-pinnalla: pitkia kapeita pystyviiruja */
        const nC = Math.round(p.cracks);
        for (let c = 0; c < nC; c++) {
          const x = x0 + rng() * bw;
          const y0c = apexY + radius * (0.3 + rng() * 0.8);
          const len = 8 + rng() * 30;
          const pts = [];
          for (let k = 0; k <= 10; k++) {
            const t = k / 10;
            pts.push([x + (hash2(k, c * 11, p.seed + 41) - 0.5) * 1.6, y0c + len * t]);
          }
          paths.push({ pts, closed: false, layer: L });
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
