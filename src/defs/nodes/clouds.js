import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "clouds",
    name: "Clouds", cat: "gen", group: "nature",
    ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "type", label: "Cloud type", type: "select", options: ["Cumulus", "Stratus", "Cirrus", "Cumulonimbus", "Altocumulus"], def: "Cumulus" },
      { key: "count", label: "Amount", type: "slider", min: 1, max: 30, step: 1, def: 6 },
      { key: "size", label: "Size mm", type: "slider", min: 10, max: 140, step: 1, def: 50 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "detail", label: "Detail / texture", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "shade", label: "Shading", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 0, max: 400, step: 1, def: 130 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 171 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
      { key: "shadePen", label: "Shade pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer), SP = Math.round(p.shadePen);
      const m = p.margin;
      const rng = mulberry32(p.seed * 8123 + 61);
      const paths = [];
      /* realistinen pilvi: reuna rakennetaan noise-moduloiduista sateista, ei
         tasaisista kaarilohkoista. eri tyypeilla eri profiili + tekstuuri. */
      const cloudOutline = (cx, cy, w, h, lumpy, sd, flatBase) => {
        const rr = mulberry32(sd);
        const ph = rr() * 100;
        const pts = [];
        const N = Math.max(60, Math.round(w));
        for (let k = 0; k < N; k++) {
          const t = k / N;
          const a = t * Math.PI * 2;
          /* peruskaari: leveä ja matala ellipsi */
          let ex = Math.cos(a), ey = Math.sin(a);
          /* monikerroksinen kohina reunalle -> kuhmurainen mutta ei sahalaita */
          let bump = 0;
          bump += (noise2(ex * lumpy + ph, ey * lumpy, sd) - 0.5) * 1.0;
          bump += (noise2(ex * lumpy * 2.3 + ph, ey * lumpy * 2.3, sd + 3) - 0.5) * 0.5 * p.detail;
          bump += (noise2(ex * lumpy * 4.7 + ph, ey * lumpy * 4.7, sd + 7) - 0.5) * 0.25 * p.detail;
          const rad = 1 + bump * 0.55;
          let x = cx + ex * w * 0.5 * rad;
          let y = cy + ey * h * 0.5 * rad;
          /* litteä pohja: alapuoli puristetaan vaakasuoraksi */
          if (flatBase && ey > 0) {
            y = cy + ey * h * 0.5 * rad * (1 - ey * 0.75);
          }
          pts.push([x, y]);
        }
        return pts;
      };
      const hatchRegion = (pts, dir, gap, penL, coverTop) => {
        /* viivoita monikulmion sisä (even-odd) — pehmeä varjo pohjaan */
        let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
        for (const [x, y] of pts) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
        for (let y = y0 + gap; y < y1; y += gap) {
          /* varjo painottuu alaosaan ellei coverTop */
          if (!coverTop && y < y0 + (y1 - y0) * 0.45) continue;
          const xs = [];
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if ((pts[i][1] > y) !== (pts[j][1] > y)) {
              xs.push(pts[j][0] + (pts[i][0] - pts[j][0]) * (y - pts[j][1]) / (pts[i][1] - pts[j][1]));
            }
          }
          xs.sort((a, b) => a - b);
          for (let q = 0; q + 1 < xs.length; q += 2) {
            if (xs[q + 1] - xs[q] > 1) paths.push({ pts: [[xs[q], y], [xs[q + 1], y]], closed: false, layer: penL });
          }
        }
      };
      const place = (n, yBand, spread, drawer) => {
        const placed = [];
        let guard = 0;
        for (let i = 0; i < n && guard < n * 40; ) {
          guard++;
          const sz = p.size * (1 - p.sizeVar * rng());
          const cx = m + sz * 0.6 + rng() * (W - 2 * m - sz * 1.2);
          const cy = yBand[0] + rng() * (yBand[1] - yBand[0]);
          let ok = true;
          for (const [px, py, ps] of placed) if (Math.hypot(cx - px, cy - py) < (sz + ps) * spread) { ok = false; break; }
          if (!ok) continue;
          placed.push([cx, cy, sz]);
          drawer(cx, cy, sz, p.seed + i * 53);
          i++;
        }
      };
      const T = p.type;
      const hor = p.horizon;
      if (T === "Cumulus") {
        /* pörheä, litteäpohjainen, pystysuora kohoama */
        place(p.count, [m + p.size * 0.5, hor - p.size * 0.2], 0.5, (cx, cy, sz, sd) => {
          const out = cloudOutline(cx, cy, sz * 1.3, sz * 0.9, 2.2, sd, true);
          paths.push({ pts: out, closed: true, layer: L });
          if (p.shade > 0.05) hatchRegion(out, 0, Math.max(1.2, 3 - p.shade * 2), SP, false);
        });
      } else if (T === "Stratus") {
        /* matala, venynyt, kerroksellinen sumuvyö */
        place(Math.max(2, Math.round(p.count * 0.7)), [hor - p.size * 0.5, hor], 0.35, (cx, cy, sz, sd) => {
          const out = cloudOutline(cx, cy, sz * 2.6, sz * 0.42, 1.6, sd, false);
          paths.push({ pts: out, closed: true, layer: L });
          /* sisäiset vaakajuovat -> kerrokset */
          const rr = mulberry32(sd + 1);
          const nLayer = Math.round(1 + p.detail * 4);
          for (let l = 0; l < nLayer; l++) {
            const yy = cy - sz * 0.15 + l * sz * 0.12;
            const half = sz * 1.1 * (0.5 + rr() * 0.4);
            paths.push({ pts: [[cx - half, yy], [cx + half, yy]], closed: false, layer: SP });
          }
        });
      } else if (T === "Cirrus") {
        /* ohut, sulkamainen — kaarevat harjaviivat, ei täyttä ääriviivaa */
        place(p.count, [m + p.size * 0.3, hor - p.size * 0.5], 0.3, (cx, cy, sz, sd) => {
          const rr = mulberry32(sd);
          const dir = -0.3 + rr() * 0.6;
          const nStrand = Math.round(3 + p.detail * 8);
          /* pääharja */
          const spine = [];
          for (let k = 0; k <= 20; k++) {
            const t = k / 20;
            spine.push([cx - sz + t * sz * 2, cy + Math.sin(t * 2.5 + dir) * sz * 0.15 + dir * t * sz]);
          }
          paths.push({ pts: spine, closed: false, layer: L });
          /* haivenet: lyhyet kaaret harjasta ylös taakse (fallstreak) */
          for (let s = 0; s < nStrand; s++) {
            const idx = Math.floor(rr() * (spine.length - 1));
            const [bx, by] = spine[idx];
            const wisp = [];
            const wl = sz * (0.3 + rr() * 0.5);
            const wa = -Math.PI * 0.5 + (rr() - 0.5) * 0.8 + dir;
            for (let k = 0; k <= 8; k++) {
              const t = k / 8;
              wisp.push([bx + Math.cos(wa) * wl * t + t * t * sz * 0.2, by + Math.sin(wa) * wl * t]);
            }
            paths.push({ pts: wisp, closed: false, layer: L });
          }
        });
      } else if (T === "Cumulonimbus") {
        /* massiivinen ukkospilvi: pystykohoama + levinnyt alasin ylhäällä */
        place(Math.max(1, Math.round(p.count * 0.5)), [hor - p.size * 0.3, hor - p.size * 0.1], 0.9, (cx, cy, sz, sd) => {
          /* runko */
          const body = cloudOutline(cx, cy - sz * 0.2, sz * 1.1, sz * 1.8, 2.0, sd, true);
          paths.push({ pts: body, closed: true, layer: L });
          /* alasin: leveä litteä yläosa */
          const anvil = cloudOutline(cx, cy - sz * 1.05, sz * 2.4, sz * 0.5, 1.8, sd + 5, false);
          paths.push({ pts: anvil, closed: true, layer: L });
          if (p.shade > 0.05) { hatchRegion(body, 0, Math.max(1.2, 3 - p.shade * 2), SP, false); }
          /* sadeviirut pohjasta */
          if (p.detail > 0.3) {
            const rr = mulberry32(sd + 9);
            for (let r = 0; r < Math.round(p.detail * 10); r++) {
              const rx = cx + (rr() - 0.5) * sz * 1.6;
              const ry = cy + sz * 1.4;
              paths.push({ pts: [[rx, ry], [rx + (rr() - 0.5) * sz * 0.1, ry + sz * (0.3 + rr() * 0.5)]], closed: false, layer: SP });
            }
          }
        });
      } else {
        /* Altocumulus: säännöllinen laikkukenttä ("lampaita") */
        const cols = Math.round(4 + p.count);
        const rows = Math.round(2 + p.count * 0.4);
        const cw = (W - 2 * m) / cols, ch = Math.min(cw, (hor - m) / rows);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (rng() < 0.15) continue;
          const cx = m + (c + 0.5) * cw + (rng() - 0.5) * cw * 0.3;
          const cy = m + (r + 0.5) * ch + (rng() - 0.5) * ch * 0.2;
          const sz = Math.min(cw, ch) * (0.55 + rng() * 0.3) * (1 - p.sizeVar * 0.3 * rng());
          const out = cloudOutline(cx, cy, sz * 1.2, sz * 0.75, 2.5, p.seed + r * 31 + c * 7, false);
          paths.push({ pts: out, closed: true, layer: L });
          if (p.shade > 0.1) {
            /* pieni varjo alle */
            paths.push({ pts: [[cx - sz * 0.4, cy + sz * 0.4], [cx + sz * 0.4, cy + sz * 0.4]], closed: false, layer: SP });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
