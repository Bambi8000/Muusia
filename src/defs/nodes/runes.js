import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "runes",
    name: "Runes",
    cat: "gen",
    group: "textimg",
    desc: "Asemic writing: a seeded alphabet of invented angular glyphs, laid out in words and lines like real text. Because letters repeat from a finite alphabet, it reads as language. Complexity sets strokes per glyph; every seed is a new script.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "size", label: "Glyph height mm", type: "slider", min: 3, max: 20, step: 0.5, def: 7 },
      { key: "alphabet", label: "Alphabet size", type: "slider", min: 6, max: 30, step: 1, def: 16 },
      { key: "complexity", label: "Strokes per glyph", type: "slider", min: 2, max: 6, step: 1, def: 3 },
      { key: "linesp", label: "Line spacing", type: "slider", min: 1.2, max: 3, step: 0.1, def: 1.8 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 18 },
      { key: "seed", label: "Seed", type: "seed", def: 77 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 20) return applyStyle({ paths: [] }, ins[0]);
      const gh = Math.max(2, p.size);
      const gw = gh * 0.62;
      /* build a seeded alphabet: glyphs = strokes on a 3x4 lattice */
      const K = Math.max(4, Math.min(40, Math.round(p.alphabet)));
      const CPX = Math.max(1, Math.min(8, Math.round(p.complexity)));
      const rng = mulberry32(p.seed * 3323 + 7);
      const LX = 3, LY = 4;
      const alphabet = [];
      for (let g = 0; g < K; g++) {
        const strokes = [];
        const nStrokes = 1 + Math.floor(rng() * CPX);
        for (let s = 0; s < nStrokes; s++) {
          /* each stroke: 2-3 lattice points, no zero-length hops */
          const nPts = 2 + (rng() < 0.4 ? 1 : 0);
          const pts = [];
          let last = -1;
          for (let i = 0; i < nPts; i++) {
            let pt;
            do { pt = Math.floor(rng() * LX * LY); } while (pt === last);
            last = pt;
            pts.push([(pt % LX) / (LX - 1), Math.floor(pt / LX) / (LY - 1)]);
          }
          strokes.push(pts);
        }
        /* every glyph gets a baseline anchor stroke sometimes (stability) */
        if (rng() < 0.35) strokes.push([[0, 1], [1, 1]]);
        alphabet.push(strokes);
      }
      /* text stream: seeded glyph sequence with Zipf-ish letter frequency + words */
      const paths = [];
      const L = Math.round(p.layer);
      const lineH = gh * Math.max(1.1, p.linesp);
      const step = gw * 1.28;
      const space = gw * 0.9;
      const zipf = () => {
        /* low indices much more common, like real letters */
        const r = rng();
        return Math.min(K - 1, Math.floor(K * r * r));
      };
      let y = y0;
      while (y + gh <= y1) {
        let x = x0;
        let word = 2 + Math.floor(rng() * 7);
        while (x + gw <= x1) {
          if (word <= 0) {
            x += space;
            word = 2 + Math.floor(rng() * 7);
            continue;
          }
          const strokes = alphabet[zipf()];
          for (const st of strokes) {
            const pts = st.map(([u, v]) => [x + u * gw, y + v * gh]);
            paths.push({ pts, closed: false, layer: L });
          }
          x += step;
          word--;
        }
        y += lineH;
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
