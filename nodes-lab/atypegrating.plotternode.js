({
  key: "atypegrating",
  name: "Atype Grating",
  cat: "gen",
  group: "textimg",
  desc: "Atypography for the plotter: text concealed inside a strict vertical or horizontal line grating, readable up close, pure op-art from a distance. The single-stroke font is thickened into a glyph mask (Glyph stroke mm) and first ABSTRACTED — Glyph style Modular quantizes the letterforms onto a module grid so they become blocky tetromino-like shapes (the modular-font heart of the Atype movement), Fragments keeps only a seeded window of each stroke's design path (path highlighting), Plain keeps the letters as-is. The grating then reacts to the abstracted mask with one of five encodings — Break (lines gap inside), Phase shift (lines jog sideways by half a pitch, staying one continuous pen stroke with square jogs), Density (extra midlines double the frequency), Dashes (a seeded checker), or Weight (strokes triple up). Invert swaps figure and ground. Multi-line text with |, position in % of canvas, auto-fit to the margin box, every line strictly axis-aligned. Chain two instances at crossed directions for woven double encodings.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "text", label: "Text (| = new line)", type: "text", def: "ATYPE" },
    { key: "mode", label: "Encode", type: "select", options: ["Break", "Phase shift", "Density", "Dashes", "Weight"], def: "Phase shift" },
    { key: "dir", label: "Lines", type: "select", options: ["Vertical", "Horizontal"], def: "Vertical" },
    { key: "pitch", label: "Line pitch mm", type: "slider", min: 0.6, max: 6, step: 0.05, def: 1.4 },
    { key: "size", label: "Text size mm", type: "slider", min: 10, max: 120, step: 1, def: 30 },
    { key: "gstyle", label: "Glyph style", type: "select", options: ["Plain", "Modular", "Fragments"], def: "Modular" },
    { key: "module", label: "Module mm", type: "slider", min: 2, max: 15, step: 0.5, def: 6 },
    { key: "frag", label: "Fragment keep", type: "slider", min: 0.2, max: 0.9, step: 0.01, def: 0.55 },
    { key: "sw", label: "Glyph stroke mm", type: "slider", min: 2, max: 25, step: 0.5, def: 7 },
    { key: "track", label: "Tracking", type: "slider", min: 0.6, max: 2, step: 0.05, def: 1 },
    { key: "tx", label: "Text X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "ty", label: "Text Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "invert", label: "Invert", type: "check", def: false },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 27 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    /* tekstilohkon bbox-guide siirrettavia tx/ty varten; sama auto-fit kuin computessa */
    const lines = String(p.text || "").split("|");
    let bw = 0;
    for (const ln of lines) bw = Math.max(bw, fontStrokes(ln, p.size, p.track).width);
    let bh = lines.length * p.size + (lines.length - 1) * p.size * 0.5;
    const m = Math.max(0, p.margin);
    const f = Math.min(1,
      bw > 0 ? (ctx.W - 2 * m - p.sw) / bw : 1,
      bh > 0 ? (ctx.H - 2 * m - p.sw) / bh : 1);
    bw *= f; bh *= f;
    const cx = (ctx.W * p.tx) / 100, cy = (ctx.H * p.ty) / 100;
    return [{ kind: "rect", x: cx - bw / 2 - p.sw / 2, y: cy - bh / 2 - p.sw / 2, w: bw + p.sw, h: bh + p.sw }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 10 || H - 2 * m < 10) return EMPTY;
    const L = Math.round(p.layer);
    const pitch = Math.max(0.4, p.pitch);
    const seed = Math.round(p.seed) || 1;
    const paths = [];
    let budget = 130000;
    const push = (pts) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed: false, layer: L });
    };

    /* ---- tekstin ladonta (auto-fit marginaalilaatikkoon) ---- */
    const lines = String(p.text || "").split("|");
    let bw0 = 0;
    for (const ln of lines) bw0 = Math.max(bw0, fontStrokes(ln, p.size, p.track).width);
    const bh0 = lines.length * p.size + (lines.length - 1) * p.size * 0.5;
    const f = Math.min(1,
      bw0 > 0 ? (W - 2 * m - p.sw) / bw0 : 1,
      bh0 > 0 ? (H - 2 * m - p.sw) / bh0 : 1);
    const size = p.size * Math.max(0.05, f);
    const cx = (W * p.tx) / 100, cy = (H * p.ty) / 100;
    const lineH = size * 1.5;
    const bh = lines.length * size + (lines.length - 1) * size * 0.5;
    const glyphSegs = []; /* [x0,y0,x1,y1] */
    let strokeIdx = 0;
    lines.forEach((ln, k) => {
      const fs = fontStrokes(ln, size, p.track);
      const ox = cx - fs.width / 2;
      const oy = cy - bh / 2 + k * lineH;
      for (const st of fs.strokes) {
        let poly = st.map(([sx2, sy2]) => [ox + sx2, oy + sy2]);
        /* Fragments: pida vain seedattu ikkuna vedon kaarenpituudesta */
        if (p.gstyle === "Fragments" && poly.length > 1) {
          const fr = mulberry32(seed * 53 + strokeIdx * 17 + 5);
          const cum = [0];
          for (let i = 1; i < poly.length; i++)
            cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
          const TL = cum[cum.length - 1];
          const keep = Math.max(0.05, Math.min(0.95, p.frag));
          const a = fr() * (1 - keep) * TL, b = a + keep * TL;
          const at2 = (d) => {
            let i = 1;
            while (i < cum.length - 1 && cum[i] < d) i++;
            const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
            return [poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * t,
                    poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * t];
          };
          const cut = [at2(a)];
          for (let i = 0; i < poly.length; i++) if (cum[i] > a && cum[i] < b) cut.push(poly[i]);
          cut.push(at2(b));
          poly = cut;
        }
        strokeIdx++;
        for (let i = 1; i < poly.length; i++)
          glyphSegs.push([poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1]]);
      }
    });

    /* ---- glyyfimaski: paksunnetut vedot rasteroituna hilaan ---- */
    const r = Math.max(0.5, p.sw) / 2;
    let gx0 = 1e9, gy0 = 1e9, gx1 = -1e9, gy1 = -1e9;
    for (const [x0s, y0s, x1s, y1s] of glyphSegs) {
      gx0 = Math.min(gx0, x0s, x1s); gx1 = Math.max(gx1, x0s, x1s);
      gy0 = Math.min(gy0, y0s, y1s); gy1 = Math.max(gy1, y0s, y1s);
    }
    const hasText = glyphSegs.length > 0;
    gx0 -= r + 1; gy0 -= r + 1; gx1 += r + 1; gy1 += r + 1;
    const gc = 0.32;
    const gcols = hasText ? Math.max(2, Math.ceil((gx1 - gx0) / gc) + 1) : 2;
    const grows = hasText ? Math.max(2, Math.ceil((gy1 - gy0) / gc) + 1) : 2;
    const gmask = new Uint8Array(gcols * grows);
    if (hasText) {
      const rc = Math.ceil(r / gc);
      for (const [x0s, y0s, x1s, y1s] of glyphSegs) {
        const len = Math.hypot(x1s - x0s, y1s - y0s);
        const n = Math.max(1, Math.ceil(len / (gc * 0.5)));
        for (let k = 0; k <= n; k++) {
          const px = x0s + (x1s - x0s) * (k / n), py = y0s + (y1s - y0s) * (k / n);
          const cc = Math.round((px - gx0) / gc), cr = Math.round((py - gy0) / gc);
          for (let jr = Math.max(0, cr - rc); jr <= Math.min(grows - 1, cr + rc); jr++)
            for (let jc = Math.max(0, cc - rc); jc <= Math.min(gcols - 1, cc + rc); jc++) {
              const dx = gx0 + jc * gc - px, dy = gy0 + jr * gc - py;
              if (dx * dx + dy * dy <= r * r) gmask[jr * gcols + jc] = 1;
            }
        }
      }
    }
    const inFine = (x, y) => {
      if (!hasText || x < gx0 || y < gy0 || x > gx1 || y > gy1) return false;
      return gmask[Math.round((y - gy0) / gc) * gcols + Math.round((x - gx0) / gc)] === 1;
    };
    /* Modular: kvantisoi maski moduuliruudukkoon -> abstraktit palikkamuodot */
    let inGlyphRaw = inFine;
    if (p.gstyle === "Modular" && hasText) {
      const M = Math.max(1, p.module);
      const mcols = Math.max(1, Math.ceil((gx1 - gx0) / M));
      const mrows = Math.max(1, Math.ceil((gy1 - gy0) / M));
      const cover = new Float64Array(mcols * mrows);
      const tot = new Float64Array(mcols * mrows);
      for (let r2 = 0; r2 < grows; r2++) for (let c2 = 0; c2 < gcols; c2++) {
        const mc = Math.min(mcols - 1, Math.floor((c2 * gc) / M));
        const mr2 = Math.min(mrows - 1, Math.floor((r2 * gc) / M));
        tot[mr2 * mcols + mc]++;
        if (gmask[r2 * gcols + c2]) cover[mr2 * mcols + mc]++;
      }
      const mmask = new Uint8Array(mcols * mrows);
      for (let i = 0; i < mmask.length; i++) mmask[i] = cover[i] / Math.max(1, tot[i]) >= 0.3 ? 1 : 0;
      const mx1 = gx0 + mcols * M, my1 = gy0 + mrows * M;
      inGlyphRaw = (x, y) => {
        if (x < gx0 || y < gy0 || x >= mx1 || y >= my1) return false;
        const mc = Math.floor((x - gx0) / M);
        const mr2 = Math.floor((y - gy0) / M);
        return mmask[mr2 * mcols + mc] === 1;
      };
    }
    const inG = p.invert ? (x, y) => !inGlyphRaw(x, y) : inGlyphRaw;

    /* ---- viivan skannaus: [a, b, sisalla] -segmentit bisektio-tarkennuksella ---- */
    const isV = p.dir === "Vertical";
    const lo = m, hi = isV ? H - m : W - m;
    const at = (c, t) => (isV ? inG(c, t) : inG(t, c));
    const scan = (c) => {
      const segs = [];
      const st = 0.3;
      let a = lo, state = at(c, lo);
      let prev = lo;
      for (let t = lo + st; t <= hi + 1e-9; t += st) {
        const s2 = at(c, Math.min(t, hi));
        if (s2 !== state) {
          /* tarkenna raja bisektiolla */
          let t0 = prev, t1 = Math.min(t, hi);
          for (let it = 0; it < 6; it++) {
            const tm = (t0 + t1) / 2;
            if (at(c, tm) === state) t0 = tm; else t1 = tm;
          }
          segs.push([a, t1, state]);
          a = t1; state = s2;
        }
        prev = Math.min(t, hi);
      }
      segs.push([a, hi, state]);
      return segs.filter((s) => s[1] - s[0] > 0.05);
    };

    /* ---- emissio per moodi ---- */
    const mk = (c, a, b) => (isV ? [[c, a], [c, b]] : [[a, c], [b, c]]);
    const cLo = m, cHi = isV ? W - m : H - m;
    let li = 0;
    for (let c = cLo; c <= cHi + 1e-9; c += pitch, li++) {
      const cc = Math.min(c, cHi);
      const segs = scan(cc);
      const rev = li % 2 === 1;
      if (p.mode === "Break") {
        for (const [a, b, s] of segs) if (!s) push(rev ? mk(cc, b, a) : mk(cc, a, b));
      } else if (p.mode === "Phase shift") {
        /* yhtenainen polyline: sisalla oleva osuus hyppaa pitch/2 sivuun suorakulmaisella jogilla */
        const off = pitch / 2;
        const pts = [];
        const ordered = rev ? [...segs].reverse() : segs;
        for (const [a, b, s] of ordered) {
          const ce = s ? cc + off : cc;
          const p0 = isV ? [ce, rev ? b : a] : [rev ? b : a, ce];
          const p1 = isV ? [ce, rev ? a : b] : [rev ? a : b, ce];
          pts.push(p0, p1);
        }
        push(pts);
      } else if (p.mode === "Density") {
        push(rev ? mk(cc, hi, lo) : mk(cc, lo, hi));
        for (const [a, b, s] of segs) if (s && cc + pitch / 2 <= cHi) push(mk(cc + pitch / 2, a, b));
      } else if (p.mode === "Dashes") {
        const dr = mulberry32(Math.floor(cc * 53) + seed);
        for (const [a, b, s] of segs) {
          if (!s) { push(rev ? mk(cc, b, a) : mk(cc, a, b)); continue; }
          let t = a - (li % 2) * pitch;
          let on = true;
          while (t < b) {
            const da = Math.max(a, t), db = Math.min(b, t + pitch);
            if (on && db - da > 0.12 && dr() > 0.2) push(mk(cc, da, db));
            t += pitch; on = !on;
          }
        }
      } else { /* Weight */
        push(rev ? mk(cc, hi, lo) : mk(cc, lo, hi));
        for (const [a, b, s] of segs) if (s) {
          push(mk(cc - 0.22, a, b));
          push(mk(cc + 0.22, b, a));
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
