import { Pin, EMPTY, mulberry32, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "concrete",
    name: "Concrete Poetry", cat: "gen", group: "textimg",
    ins: [Pin("paths", "Region (optional)"), Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text (| = line, space = word)", type: "text", def: "WORD IS IMAGE" },
      { key: "mode", label: "Layout", type: "select", options: ["Fill region", "Spiral", "Wave", "Scatter words"], def: "Fill region" },
      { key: "size", label: "Size mm", type: "slider", min: 2, max: 40, step: 0.5, def: 7 },
      { key: "sizeVar", label: "Size variation (scatter)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "track", label: "Tracking", type: "slider", min: 0.6, max: 2.5, step: 0.05, def: 1 },
      { key: "lineh", label: "Line height ×", type: "slider", min: 0.9, max: 3, step: 0.05, def: 1.35 },
      { key: "turns", label: "Turns (spiral)", type: "slider", min: 1, max: 14, step: 0.5, def: 5 },
      { key: "waveAmp", label: "Wave amp mm", type: "slider", min: 0, max: 60, step: 1, def: 16 },
      { key: "waveLen", label: "Wave length mm", type: "slider", min: 20, max: 400, step: 5, def: 130 },
      { key: "count", label: "Words (scatter)", type: "slider", min: 5, max: 400, step: 5, def: 80 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 151 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = p.margin;
      const text = String(p.text || "").toUpperCase();
      const paths = [];
      /* alue: suljetut sisaantulopolut tai marginaalilaatikko */
      const regions = ins[0] && ins[0].paths ? ins[0].paths.filter((q) => q.closed && q.pts.length > 2) : [];
      const inside = (x, y) => {
        if (!regions.length) return x >= m && x <= W - m && y >= m && y <= H - m;
        let cnt = 0;
        for (const path of regions) {
          const pts = path.pts;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
                (x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0])) cnt++;
          }
        }
        return cnt % 2 === 1;
      };
      let bx0 = m, by0 = m, bx1 = W - m, by1 = H - m;
      if (regions.length) {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
        for (const path of regions) for (const [x, y] of path.pts) {
          if (x < bx0) bx0 = x; if (y < by0) by0 = y;
          if (x > bx1) bx1 = x; if (y > by1) by1 = y;
        }
      }
      /* glyyfin piirto: sijainti + rotaatio + skaala; palauttaa etenemismitan */
      const drawGlyph = (ch, x, y, size, ang, guard) => {
        const g = SFONT[ch] || SFONT[" "];
        const sc = size / 10;
        const adv = (g.w + 2) * sc * p.track;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        /* guard: piirra vain jos glyyfin keskikohta on alueen sisalla */
        const gcx = x + (adv / 2) * ca - (size / 2) * -sa;
        const gcy = y + (adv / 2) * sa + (size / 2) * -ca;
        if (guard && !inside(x + (adv / 2) * ca, y + (adv / 2) * sa - (size * 0.4) * ca * 0)) return adv;
        if (guard && !inside(gcx, gcy)) return adv;
        for (const stroke of g.s) {
          if (stroke.length < 2) continue;
          paths.push({
            pts: stroke.map(([gx, gy]) => {
              const lx = gx * sc, ly = (gy - 10) * sc; /* baseline y=0 */
              return [x + lx * ca - ly * sa, y + lx * sa + ly * ca];
            }),
            closed: false, layer: L,
          });
        }
        return adv;
      };
      const lineText = text.replace(/\|/g, " ");
      if (p.mode === "Fill region") {
        /* rivit toistuvaa tekstia; glyyfi piirtyy vain alueen sisalla */
        const src2 = lineText + "  ";
        let row = 0;
        for (let y = by0 + p.size; y <= by1; y += p.size * p.lineh, row++) {
          /* rivioffset ettei sama sana pinoudu */
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, 0, true);
          }
        }
      } else if (p.mode === "Spiral") {
        /* arkhimedeen spiraali ulkoa sisaan, teksti toistuu */
        const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const maxR = Math.min(bx1 - bx0, by1 - by0) / 2 - p.size;
        const loopGap = Math.max(p.size * p.lineh, maxR / Math.max(1, p.turns));
        const rAt = (th) => maxR - (th / (Math.PI * 2)) * loopGap;
        let th = 0, ci = 0;
        const srcT = lineText + " \u00B7 ";
        let guardCount = 0;
        while (rAt(th) > p.size && guardCount++ < 3000) {
          const r = rAt(th);
          const x = cx + Math.cos(th) * r;
          const y = cy + Math.sin(th) * r;
          const ch = srcT[ci % srcT.length];
          ci++;
          const g = SFONT[ch] || SFONT[" "];
          const adv = (g.w + 2) * (p.size / 10) * p.track;
          /* tangentin suunta + kaarevuuskorjattu kulma-askel */
          drawGlyph(ch, x, y, p.size, th + Math.PI / 2, false);
          th += adv / Math.max(2, r);
        }
      } else if (p.mode === "Wave") {
        const src2 = lineText + "  ";
        let row = 0;
        for (let y0 = by0 + p.size; y0 <= by1; y0 += p.size * p.lineh, row++) {
          let ci = Math.round(row * 3.7) % src2.length;
          let x = bx0;
          let guardCount = 0;
          while (x < bx1 && guardCount++ < 600) {
            const ph = (x / p.waveLen) * Math.PI * 2 + row * 0.7;
            const y = y0 + Math.sin(ph) * p.waveAmp * 0.5;
            /* kulma seuraa aallon derivaattaa */
            const slope = Math.cos(ph) * p.waveAmp * 0.5 * (Math.PI * 2 / p.waveLen);
            const ch = src2[ci % src2.length];
            ci++;
            x += drawGlyph(ch, x, y, p.size, Math.atan(slope), true) * Math.cos(Math.atan(slope) * 0.5);
          }
        }
      } else {
        /* Scatter: sanat hajallaan alueen sisalla */
        const words = lineText.split(/\s+/).filter(Boolean);
        if (!words.length) return EMPTY;
        const rng = mulberry32(p.seed * 6689 + 127);
        let placed = 0, guard = 0;
        while (placed < Math.round(p.count) && guard++ < p.count * 25) {
          const word = words[Math.floor(rng() * words.length)];
          const size = p.size * (1 - p.sizeVar * rng());
          const ang = (rng() - 0.5) * 1.1;
          const x0 = bx0 + rng() * (bx1 - bx0);
          const y0 = by0 + rng() * (by1 - by0);
          if (!inside(x0, y0)) continue;
          let x = x0;
          for (const ch of word) {
            x += drawGlyph(ch, x, y0 + (x - x0) * Math.tan(ang) * 0, size, ang, true);
          }
          placed++;
        }
      }
      return applyStyle({ paths }, ins[1]);
    },
  
};
