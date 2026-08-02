import { Pin, EMPTY, mulberry32, noise2, resample, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "scribbletype",
  name: "Scribble Type",
  cat: "gen",
  group: "textimg",
  desc: "The medical alphabet as real pen strokes: every character collapses into its own seeded scribble tangle — elliptical loops with drifting centers and noisy radii, one continuous pen stroke per character, optional stray tail flicks. Scribble mode None traces the glyph clean (hand tremor only), Sine runs a perpendicular wave along the strokes (Loops = cycles), Seismic lays a calm baseline with seeded quake bursts, Coil advances small dense loops ALONG the strokes like a coiled spring, so the glyph stays readable however messy the ink; Glitch orbit swings character-sized loops that swallow the form into the classic illegible scrawl. Legibility sets the loop radius (1 = near-clean tracing with hand tremor, 0 = full scribble). The Alphabet select swaps the skeleton itself: Latin, Runes (the real 24-rune Elder Futhark with standard Latin transliteration), Hieroglyphs (invented Egyptian-flavored pictograms), Cuneiform (cuneiform-STYLE invented wedge signs - authentic mechanics, not real Sumerian/Akkadian, which is syllabic and has no faithful letter mapping), Alchemy (circles-and-crosses symbols), or Asemic — a procedurally invented script where the Seed generates a whole new coherent alphabet and the same letter always maps to the same glyph, so the text is a substitution cipher you could learn to read. At Legibility 1 and low Messiness the node doubles as a clean ancient-script renderer. Tracking goes negative for piled, overlapping scrawl. Multi-line text with |, auto-fit to the margin box.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "text", label: "Text (| = new line)", type: "text", def: "A B C|D E F" },
    { key: "alphabet", label: "Alphabet", type: "select", options: ["Latin", "Runes", "Hieroglyphs", "Cuneiform", "Alchemy", "Asemic"], def: "Latin" },
    { key: "smode", label: "Scribble mode", type: "select", options: ["None", "Coil", "Sine", "Seismic", "Glitch orbit"], def: "Coil" },
    { key: "size", label: "Text size mm", type: "slider", min: 8, max: 120, step: 1, def: 32 },
    { key: "loops", label: "Loops", type: "slider", min: 2, max: 8, step: 1, def: 4 },
    { key: "mess", label: "Messiness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6 },
    { key: "legibility", label: "Legibility", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "tails", label: "Tails", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "track", label: "Tracking", type: "slider", min: -0.4, max: 2.5, step: 0.05, def: 1.2 },
    { key: "tx", label: "Text X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "ty", label: "Text Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 84 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    /* likimaarainen lohko-guide: leveys arvioidaan Latin-metriikalla (glyyfileveydet 5-9 kaikissa seteissa) */
    const lines = String(p.text || "").split("|");
    const sc0 = p.size / 10, tr = p.track;
    let bw = 0;
    for (const ln of lines) {
      let x = 0;
      for (const ch of String(ln).toUpperCase()) x += ((SFONT[ch] || SFONT[" "]).w + 2) * sc0 * tr;
      bw = Math.max(bw, Math.max(p.size * 0.6, x));
    }
    let bh = lines.length * p.size + (lines.length - 1) * p.size * 0.5;
    const m = Math.max(0, p.margin);
    const f = Math.min(1,
      (ctx.W - 2 * m - p.size * 0.4) / bw,
      (ctx.H - 2 * m - p.size * 0.4) / bh);
    bw *= f; bh *= f;
    const cx = (ctx.W * p.tx) / 100, cy = (ctx.H * p.ty) / 100;
    return [{ kind: "rect", x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 10 || H - 2 * m < 10) return EMPTY;
    const L = Math.round(p.layer);
    const seed = Math.round(p.seed) || 1;
    const paths = [];
    let budget = 120000;

    /* ---- glyyfisetit: SFONT-muoto {w, s} ruudukolla 0..10 ---- */
    const C = (cx2, cy2, r, n) => {
      const pts = [];
      const N = n || 12;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push([cx2 + Math.cos(a) * r, cy2 + Math.sin(a) * r]);
      }
      return pts;
    };
    /* vanhempi futhark, 24 riimua, y0=ylareuna: muodot aidon kirjaimiston mukaan */
    const RUNES = [
      { w: 6, s: [[[0,0],[0,10]], [[0,2.5],[5,0]], [[0,5.5],[5,3]]] },                   /* 0 fehu */
      { w: 6, s: [[[0,10],[0,0],[5,3],[5,10]]] },                                        /* 1 uruz */
      { w: 6, s: [[[0,0],[0,10]], [[0,2.5],[4.5,5],[0,7.5]]] },                          /* 2 thurisaz */
      { w: 6, s: [[[0,0],[0,10]], [[0,1],[5,3.5]], [[0,4],[5,6.5]]] },                   /* 3 ansuz */
      { w: 6, s: [[[0,0],[0,10]], [[0,0],[5,2.2],[0,4.5]], [[0,4.5],[5,10]]] },          /* 4 raido */
      { w: 6, s: [[[5,1],[0,5],[5,9]]] },                                                /* 5 kenaz */
      { w: 8, s: [[[0,1.5],[7,8.5]], [[0,8.5],[7,1.5]]] },                               /* 6 gebo */
      { w: 6, s: [[[0,0],[0,10]], [[0,0],[4.5,2.2],[0,4.5]]] },                          /* 7 wunjo */
      { w: 8, s: [[[0,0],[0,10]], [[7,0],[7,10]], [[0,3.5],[7,6.5]]] },                  /* 8 hagalaz */
      { w: 7, s: [[[3,0],[3,10]], [[0,6.5],[6,3.5]]] },                                  /* 9 nauthiz */
      { w: 3, s: [[[1,0],[1,10]]] },                                                     /* 10 isa */
      { w: 7, s: [[[1.5,1],[5,3],[1.5,5]], [[5,5],[1.5,7],[5,9]]] },                     /* 11 jera */
      { w: 7, s: [[[3,0],[3,10]], [[3,1.2],[6,0]], [[3,8.8],[0,10]]] },                  /* 12 eihwaz */
      { w: 6, s: [[[1,0],[1,10]], [[1,0],[5,2],[1,4.2]], [[1,5.8],[5,8],[1,10]]] },      /* 13 perthro */
      { w: 8, s: [[[3.5,3],[3.5,10]], [[0,0],[3.5,3],[7,0]]] },                          /* 14 algiz */
      { w: 6, s: [[[5,0],[1,3.8],[5,6.2],[1,10]]] },                                     /* 15 sowilo */
      { w: 8, s: [[[3.5,0],[3.5,10]], [[0,3],[3.5,0],[7,3]]] },                          /* 16 tiwaz */
      { w: 6, s: [[[0,0],[0,10]], [[0,0],[4,2.5],[0,5]], [[0,5],[4,7.5],[0,10]]] },      /* 17 berkano */
      { w: 8, s: [[[0,10],[0,0],[3.5,4],[7,0],[7,10]]] },                                /* 18 ehwaz */
      { w: 8, s: [[[0,0],[0,10]], [[7,0],[7,10]], [[0,0],[7,5]], [[7,0],[0,5]]] },       /* 19 mannaz */
      { w: 6, s: [[[0,0],[0,10]], [[0,0],[5,3.2]]] },                                    /* 20 laguz */
      { w: 8, s: [[[3.5,2],[6.5,5],[3.5,8],[0.5,5],[3.5,2]]] },                          /* 21 ingwaz */
      { w: 8, s: [[[3.5,0],[6.5,3.5],[3.5,7],[0.5,3.5],[3.5,0]], [[1.8,5.2],[0,10]], [[5.2,5.2],[7,10]]] }, /* 22 othala */
      { w: 8, s: [[[0,0],[0,10]], [[7,0],[7,10]], [[0,0],[7,10]], [[0,10],[7,0]]] },     /* 23 dagaz */
    ];
    /* standardi translitteraatio A-Z -> futhark (C/K/Q->kenaz, V/W->wunjo, X->gebo, Y->eihwaz, Z->algiz) */
    const RUNEMAP = [3,17,5,23,18,0,6,8,10,11,5,20,19,9,22,13,5,4,15,16,1,7,7,6,12,14];
    const HIERO = [
      { w: 9, s: [[[0,5],[2,3],[6,3],[8,5],[6,7],[2,7],[0,5]], C(4,5,1.2,10)] },         /* silma */
      { w: 9, s: [[[0,10],[2,6],[1,4],[3,2],[6,2],[8,4],[6,5],[3,5]], [[3,5],[4,10]], [[6,10],[5,5]]] }, /* lintu */
      { w: 9, s: [[[0,8],[2,6],[4,8],[6,6],[8,8]], [[8,8],[8,5],[7,4]]] },               /* kaarme */
      { w: 8, s: [C(4,5,3.4,16), C(4,5,0.7,8)] },                                        /* aurinko */
      { w: 9, s: [[[0,4],[2,2],[4,4],[6,2],[8,4]], [[0,7],[2,5],[4,7],[6,5],[8,7]]] },   /* vesi */
      { w: 7, s: [C(3.5,2.6,2.2,12), [[3.5,4.8],[3.5,10]], [[1,6.6],[6,6.6]]] },         /* ankh */
      { w: 6, s: [[[1,10],[1,1],[3,0],[5,2],[5,6]], [[1,3],[4,2]], [[1,6],[4.6,4.6]]] }, /* sulka */
      { w: 8, s: [[[0,6],[4,4],[8,6],[4,8],[0,6]]] },                                    /* suu */
      { w: 9, s: [[[0,10],[0,3],[4,0],[8,3],[8,10],[0,10]], [[3,10],[3,6],[5,6],[5,10]]] }, /* talo */
      { w: 6, s: [[[2,10],[2,0]], C(2,1.4,1.4,10)] },                                    /* sauva */
      { w: 9, s: [[[4,0],[4,10]], [[0,4],[8,4]], [[1,8],[4,4],[7,8]]] },                 /* nefer~ */
      { w: 8, s: [C(4,4,2.6,14), [[1,7],[0,9]], [[3,7.5],[2.5,10]], [[5,7.5],[5.5,10]], [[7,7],[8,9]]] }, /* skarabee */
      { w: 7, s: [[[5.5,1],[3,0],[1,2],[1,6],[3,8],[5.5,7],[4,6],[3.5,4],[4.5,2],[5.5,1]]] }, /* kuu */
      { w: 9, s: [[[0,7],[1,9],[7,9],[8,7]], [[1,9],[1,7]], [[7,9],[7,7]], [[4,9],[4,5],[2,4]]] }, /* vene */
    ];
    const WEDGE = (x, y, a, len2) => {
      const dx = Math.cos(a), dy = Math.sin(a);
      const px = -dy, py = dx;
      const w2 = len2 * 0.32;
      return [[x + px * w2, y + py * w2], [x + dx * len2, y + dy * len2], [x - px * w2, y - py * w2], [x + px * w2, y + py * w2]];
    };
    const CUNE = [
      { w: 7, s: [WEDGE(1,2,1.57,6), WEDGE(4,2,1.57,6)] },
      { w: 8, s: [WEDGE(0,5,0,6), WEDGE(0,8,0,6), WEDGE(5,1,1.57,4)] },
      { w: 7, s: [WEDGE(1,1,1.57,8), WEDGE(4,4,0.78,4), WEDGE(4,7,0.78,4)] },
      { w: 8, s: [WEDGE(0,3,0,7), WEDGE(2,6,1.57,4), WEDGE(5,6,1.57,4)] },
      { w: 6, s: [WEDGE(2,1,1.57,8)] },
      { w: 9, s: [WEDGE(0,2,0,5), WEDGE(0,5,0,5), WEDGE(0,8,0,5), WEDGE(7,1,1.57,8)] },
      { w: 7, s: [WEDGE(1,2,0.78,6), WEDGE(1,8,-0.78,6)] },
      { w: 8, s: [WEDGE(1,1,1.57,4), WEDGE(4,1,1.57,4), WEDGE(0,7,0,7)] },
      { w: 7, s: [WEDGE(3,1,1.57,8), WEDGE(0,4,0,3), WEDGE(4.5,4,0,3)] },
      { w: 8, s: [WEDGE(0,2,0.4,7), WEDGE(0,6,0,6), WEDGE(3,9,1.57,-4)] },
    ];
    const ALCH = [
      { w: 8, s: [C(4,3,2.6,14), [[4,5.6],[4,10]], [[2,7.8],[6,7.8]]] },                 /* venus */
      { w: 8, s: [C(3,6,2.6,14), [[4.9,4.2],[7,1]], [[7,1],[7,3.4]], [[7,1],[4.8,1]]] }, /* mars */
      { w: 7, s: [[[2,0],[2,7],[3,9],[5,9],[6,7.6]], [[0.5,2.5],[3.5,2.5]]] },           /* saturnus */
      { w: 8, s: [C(4,4.5,2.2,12), [[4,6.7],[4,10]], [[2.4,8.4],[5.6,8.4]], [[1.6,0.6],[2.6,2.2]], [[6.4,0.6],[5.4,2.2]]] }, /* merkurius */
      { w: 8, s: [[[4,1],[7.5,9],[0.5,9],[4,1]]] },                                      /* tuli */
      { w: 8, s: [[[4,9],[7.5,1],[0.5,1],[4,9]]] },                                      /* vesi */
      { w: 8, s: [[[4,1],[7.5,9],[0.5,9],[4,1]], [[1.6,6.2],[6.4,6.2]]] },               /* ilma */
      { w: 8, s: [C(4,5,3.4,16), C(4,5,0.6,8)] },                                        /* aurinko */
      { w: 7, s: [[[5.5,1],[3,0.5],[1.2,2.5],[1.2,7],[3,9.5],[5.5,9],[4,7.4],[3.6,5],[4.2,2.6],[5.5,1]]] }, /* kuu */
      { w: 9, s: [[[1,2],[1,8]], [[1,5],[6,5]], [[6,1],[6,10]], [[1,2],[4,0]]] },        /* jupiter~ */
      { w: 8, s: [C(4,5,3.2,14), [[0.8,5],[7.2,5]]] },                                   /* suola */
      { w: 8, s: [[[4,0],[6.5,4.5],[1.5,4.5],[4,0]], [[4,4.5],[4,9]], [[2.2,7],[5.8,7]]] }, /* rikki */
    ];
    /* asemic: seed generoi koko aakkoston; sama kirjain -> sama glyyfi */
    const asemicGlyph = (idx) => {
      const ar = mulberry32(seed * 997 + idx * 131 + 7);
      const w = 5 + Math.floor(ar() * 4);
      const s = [];
      /* selkaranka: vaeltava pystyveto baselinesta ylos */
      const spine = [[1 + ar() * 2, 10]];
      let sx2 = spine[0][0];
      const segsN = 2 + Math.floor(ar() * 2);
      for (let i = 1; i <= segsN; i++) {
        sx2 += (ar() - 0.5) * 3;
        sx2 = Math.max(0, Math.min(w, sx2));
        spine.push([sx2, 10 - (10 * i) / segsN]);
      }
      s.push(spine);
      /* 1-2 haaraa selkarangan pisteista */
      const nBr = 1 + (ar() < 0.6 ? 1 : 0);
      for (let b = 0; b < nBr; b++) {
        const from = spine[1 + Math.floor(ar() * (spine.length - 1))];
        const dir = ar() < 0.5 ? 1 : -1;
        const br = [[from[0], from[1]], [Math.max(0, Math.min(w, from[0] + dir * (2 + ar() * 3))), from[1] + (ar() - 0.5) * 3]];
        if (ar() < 0.5) br.push([br[1][0] + (ar() - 0.5) * 2, br[1][1] + 2 + ar() * 2]); /* koukku */
        s.push(br);
      }
      /* silmukka tai piste */
      if (ar() < 0.45) {
        const top = spine[spine.length - 1];
        s.push(C(Math.max(1, Math.min(w - 1, top[0])), Math.max(1.2, top[1]), 0.9 + ar() * 0.6, 10));
      } else if (ar() < 0.5) {
        s.push(C(w - 1, 9, 0.4, 8));
      }
      return { w, s };
    };
    const charIndex = (ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return c - 65;
      if (c >= 48 && c <= 57) return 26 + (c - 48);
      return (c * 7) % 36;
    };
    const glyphOf = (ch) => {
      if (ch === " ") return SFONT[" "] || { w: 6, s: [] };
      if (p.alphabet === "Latin") return SFONT[ch] || SFONT[" "];
      const idx = charIndex(ch);
      if (p.alphabet === "Runes") return RUNES[idx < 26 ? RUNEMAP[idx] : idx % RUNES.length];
      if (p.alphabet === "Hieroglyphs") return HIERO[idx % HIERO.length];
      if (p.alphabet === "Cuneiform") return CUNE[idx % CUNE.length];
      if (p.alphabet === "Alchemy") return ALCH[idx % ALCH.length];
      return asemicGlyph(idx);
    };

    /* ---- ladonta auto-fitilla; leveydet valitun setin metriikalla ---- */
    const lines = String(p.text || "").split("|");
    const tr = p.track;
    const lineW = (ln, sc) => {
      let x = 0;
      for (const ch of String(ln).toUpperCase()) x += (glyphOf(ch).w + 2) * sc * tr;
      return Math.max(sc * 6, x);
    };
    let bw0 = 0;
    for (const ln of lines) bw0 = Math.max(bw0, lineW(ln, p.size / 10));
    const bh0 = lines.length * p.size + (lines.length - 1) * p.size * 0.5;
    const pad = p.size * 0.4;
    const f = Math.min(1,
      (W - 2 * m - pad) / bw0,
      (H - 2 * m - pad) / bh0);
    const size = p.size * Math.max(0.05, f);
    const cx = (W * p.tx) / 100, cy = (H * p.ty) / 100;
    const lineH = size * 1.5;
    const bh = lines.length * size + (lines.length - 1) * size * 0.5;
    const sc0 = size / 10;
    const mess = Math.max(0, Math.min(1, p.mess));
    const leg = Math.max(0, Math.min(1, p.legibility));

    let charIdx = 0;
    lines.forEach((ln, k) => {
      const fsw = lineW(ln, sc0);
      const ox = cx - fsw / 2;
      const oy = cy - bh / 2 + k * lineH;
      const yMid = oy + size / 2;
      let xcur = 0;
      for (const ch of String(ln).toUpperCase()) {
        const g = glyphOf(ch);
        if (g.s.length) {
          const cw = g.w * sc0;
          const ccx = ox + xcur + cw / 2;
          const sd = seed * 101 + charIdx * 37 + ch.charCodeAt(0);
          const sr = mulberry32(sd);
          const R = Math.max(cw, size * 0.55) * 0.45;

          /* 1) jaljita glyyfin vedot YHDEKSI jatkuvaksi radaksi (kursiiviliitokset
             vetojen valilla) - aakkoston identiteetti sailyy kaikilla asetuksilla */
          const trace = [];
          for (const st of g.s) {
            for (const [gx2, gy2] of st) trace.push([ox + xcur + gx2 * sc0, oy + gy2 * sc0]);
          }
          if (trace.length < 2) { xcur += (g.w + 2) * sc0 * tr; charIdx++; continue; }

          /* 2) silmukointi: Coil = pienet tiheat silmukat ETENEVAT vetoa pitkin
             (kierrejousi radan ymparilla - muoto lukee vaikka jalki on toherrysta);
             Glitch orbit = merkin kokoinen orbitti joka nielaisee muodon (vanha kaytos) */
          let TL = 0;
          for (let i = 1; i < trace.length; i++)
            TL += Math.hypot(trace[i][0] - trace[i - 1][0], trace[i][1] - trace[i - 1][1]);
          let orbitR = 0, windings = 0;
          if (p.smode === "Glitch orbit") {
            orbitR = R * (1 - leg) * (0.55 + 0.45 * mess);
            windings = Math.max(1, Math.round(p.loops));
          } else if (p.smode === "Coil" || p.smode === "Sine") {
            orbitR = size * (0.007 + 0.135 * (1 - leg));
            const adv = Math.max(orbitR * 2.2, size * 0.06);
            windings = Math.min(320, Math.max(2, (TL / adv) * (p.loops / 4)));
          } else if (p.smode === "Seismic") {
            orbitR = size * (0.02 + 0.16 * (1 - leg)) * (0.5 + 0.5 * mess);
            windings = Math.min(320, TL / (size * 0.05));
          }
          /* Seismic: 1-3 seedattua pursketta kaarenpituudella, rauhallinen pohja */
          const bursts = [];
          if (p.smode === "Seismic") {
            const nB = 1 + Math.floor(sr() * 3);
            for (let b = 0; b < nB; b++)
              bursts.push([sr() * TL, TL * (0.05 + sr() * 0.1)]);
          }
          const N = Math.min(3600, Math.max(48, Math.ceil(windings * 12), Math.ceil(TL / 0.55)));
          const rp = resample(trace, false, Math.max(0.05, TL / N));
          const e = 1 - (0.2 + sr() * 0.35) * (0.4 + 0.6 * mess);
          const rot = sr() * Math.PI;
          const phase = sr() * Math.PI * 2;
          const pts = [];
          let d = 0;
          for (let i = 0; i < rp.length; i++) {
            if (i > 0) d += Math.hypot(rp[i][0] - rp[i - 1][0], rp[i][1] - rp[i - 1][1]);
            const ang = (d / Math.max(1e-9, TL)) * windings * Math.PI * 2 + phase;
            /* radan lokaali normaali Sine/Seismic-siirtymalle */
            const iN2 = Math.min(rp.length - 1, i + 1), iP2 = Math.max(0, i - 1);
            const tx3 = rp[iN2][0] - rp[iP2][0], ty3 = rp[iN2][1] - rp[iP2][1];
            const tl3 = Math.hypot(tx3, ty3) || 1;
            const nx3 = -ty3 / tl3, ny3 = tx3 / tl3;
            let exo = 0, eyo = 0;
            if (p.smode === "Coil" || p.smode === "Glitch orbit") {
              const rr = orbitR * (0.6 + 0.4 * noise2(Math.cos(ang) * 1.3 + sd * 0.13, Math.sin(ang) * 1.3 + i * 0.02, sd));
              exo = Math.cos(ang) * rr;
              eyo = Math.sin(ang) * rr * e;
            } else if (p.smode === "Sine") {
              const sv = Math.sin(ang) * orbitR;
              exo = nx3 * sv; eyo = ny3 * sv;
            } else if (p.smode === "Seismic") {
              let env = 0.12;
              for (const [bc, bw2] of bursts) {
                const u = (d - bc) / bw2;
                env += Math.exp(-u * u);
              }
              const w2 = (noise2(d / (size * 0.04), sd * 0.9, sd + 5) - 0.5) * 2;
              const sv = orbitR * Math.min(1.4, env) * w2;
              exo = nx3 * sv; eyo = ny3 * sv;
            }
            const driftOn = p.smode === "Coil" || p.smode === "Glitch orbit" ? 1 : 0;
            const dx0 = driftOn * (noise2(i * 0.045, sd * 0.7, sd + 1) - 0.5) * R * mess * (1 - leg) * 0.8;
            const dy0 = driftOn * (noise2(i * 0.045, sd * 0.3, sd + 2) - 0.5) * R * mess * (1 - leg) * 0.8;
            /* kasivapina pitaa puhtaankin jaljen elavana (kaarenpituus-domain -> paikkainvariantti) */
            const hx = (noise2(d * 0.7, sd * 0.9, sd + 3) - 0.5) * mess * 0.5;
            const hy = (noise2(d * 0.7 + 37, sd * 0.4, sd + 4) - 0.5) * mess * 0.5;
            const rotate = p.smode === "Coil" || p.smode === "Glitch orbit";
            pts.push([
              rp[i][0] + dx0 + hx + (rotate ? exo * Math.cos(rot) - eyo * Math.sin(rot) : exo),
              rp[i][1] + dy0 + hy + (rotate ? exo * Math.sin(rot) + eyo * Math.cos(rot) : eyo),
            ]);
          }
          if (sr() < p.tails) {
            const last = pts[pts.length - 1];
            let ang = Math.atan2(last[1] - (oy + size / 2), last[0] - ccx) + (sr() - 0.5) * 0.8;
            const tl = R * (0.7 + sr() * 0.7);
            const curl = (sr() - 0.5) * 0.5;
            let x = last[0], y = last[1];
            for (let i = 1; i <= 7; i++) {
              ang += curl;
              x += Math.cos(ang) * (tl / 7);
              y += Math.sin(ang) * (tl / 7);
              pts.push([x, y]);
            }
          }
          const clip = pts.map(([x, y]) => [Math.max(m, Math.min(W - m, x)), Math.max(m, Math.min(H - m, y))]);
          if (clip.length >= 2 && budget > 0) {
            budget -= clip.length;
            paths.push({ pts: clip, closed: false, layer: L });
          }
        }
        xcur += (g.w + 2) * sc0 * tr;
        charIdx++;
      }
    });
    return applyStyle({ paths }, ins[0]);
  },
};
