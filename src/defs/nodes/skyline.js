import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "skyline",
      name: "Skyline",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "mode", label: "Mode", type: "select", options: ["Forest", "City"], def: "Forest" },
      { key: "horizon", label: "Horizon Y mm", type: "slider", min: 10, max: 400, step: 1, def: 85 },
      { key: "height", label: "Height mm", type: "slider", min: 5, max: 150, step: 1, def: 38 },
      { key: "layers", label: "Layers (depth)", type: "slider", min: 1, max: 4, step: 1, def: 2 },
      { key: "rough", label: "Hill roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "detail", label: "Detail (trees/buildings)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
      { key: "texture", label: "Texture (trunks/windows)", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 97 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const w = W - 2 * m;
      if (w < 20) return EMPTY;
      const paths = [];
      const nL = Math.round(p.layers);
      for (let ly = 0; ly < nL; ly++) {
        /* kerros 0 = etummainen (korkein, horisontissa), taaemmat nousevat ylos ja madaltuvat */
        const back = ly / Math.max(1, nL - 1 || 1);
        const hgt = p.height * (1 - 0.45 * back);
        const yBase = p.horizon - back * p.height * 0.55;
        const lseed = p.seed + ly * 137;
        const rng = mulberry32(lseed * 761 + 5);
        if (p.mode === "Forest") {
          /* kukkulasiluetti fBm + havupiikit paalle */
          const hillAt = (x) => {
            const u = (x - m) / w;
            let v = 0, a = 1, f = 1, tot = 0;
            for (let o = 0; o < 3; o++) {
              v += a * noise2(u * (2 + p.rough * 5) * f, ly * 7.7, lseed);
              tot += a; a *= 0.5; f *= 2;
            }
            return yBase - (v / tot) * hgt;
          };
          const pts = [];
          let x = m;
          while (x <= W - m) {
            const hy = hillAt(x);
            /* kuusenlatva: piikki ylos ja alas takaisin, korkeus satunnainen */
            const spikeH = (0.5 + rng() * 1) * (1.5 + p.detail * 4) * (1 - 0.4 * back);
            const spikeW = 0.8 + rng() * (2.5 - p.detail * 1.2);
            if (p.detail > 0.02) {
              pts.push([x, hy]);
              pts.push([x + spikeW / 2, hy - spikeH]);
              pts.push([x + spikeW, hy]);
            } else {
              pts.push([x, hy]);
            }
            x += Math.max(0.6, spikeW);
          }
          paths.push({ pts, closed: false, layer: L });
          /* tekstuuri: runkoviiruja siluetista alaspain (vain etukerros) */
          if (p.texture && ly === 0) {
            const nT = Math.round(w / 6);
            for (let k = 0; k < nT; k++) {
              const tx = m + rng() * w;
              const ty = hillAt(tx);
              const tl = (2 + rng() * 6) * (0.5 + p.detail);
              paths.push({ pts: [[tx, ty + 1], [tx + (rng() - 0.5) * 0.8, ty + 1 + tl]], closed: false, layer: L });
            }
          }
        } else {
          /* CITY: porrastettu talosiluetti yhtena polylinena */
          const pts = [[m, yBase]];
          let x = m;
          let prevH = 0;
          const bldgs = [];
          while (x < W - m) {
            const bw = Math.min(W - m - x, (4 + rng() * 26) * (1 - p.detail * 0.5) + 2);
            /* korkeusjakauma: enimmakseen matalia, joskus torni */
            const tall = rng() < 0.14 ? 1 + rng() * 0.8 : 0.25 + rng() * 0.6;
            const bh = hgt * tall * (1 - 0.3 * back);
            pts.push([x, yBase - bh]);
            pts.push([x + bw, yBase - bh]);
            pts.push([x + bw, yBase]);
            bldgs.push([x, bw, bh]);
            /* antenni satunnaisesti korkeimpiin */
            if (tall > 1.2 && rng() < 0.6) {
              paths.push({ pts: [[x + bw / 2, yBase - bh], [x + bw / 2, yBase - bh - hgt * 0.18]], closed: false, layer: L });
            }
            x += bw;
          }
          paths.push({ pts, closed: false, layer: L });
          /* ikkunat: pienia vaakaviiruja rakennusten sisalla (etukerros) */
          if (p.texture && ly === 0) {
            for (const [bx, bw, bh] of bldgs) {
              if (bw < 5 || bh < 8) continue;
              const cols = Math.max(1, Math.floor(bw / 3.5));
              const rows = Math.max(1, Math.floor(bh / 4.5));
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  if (rng() < 0.45) continue;   /* osa ikkunoista pimeana */
                  const wx = bx + 1.6 + c * ((bw - 3.2) / Math.max(1, cols - 1 || 1));
                  const wy = yBase - bh + 2.5 + r * ((bh - 5) / Math.max(1, rows - 1 || 1));
                  paths.push({ pts: [[wx - 0.7, wy], [wx + 0.7, wy]], closed: false, layer: L });
                }
              }
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
