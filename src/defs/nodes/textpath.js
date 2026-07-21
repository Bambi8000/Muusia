import { Pin, resample, applyStyle, SFONT } from "../helpers.js";

export default {
  key: "textpath",
    name: "Text on Path",
    cat: "gen",
    group: "textimg",
    ins: [Pin("paths", "Path"), Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "text", label: "Text", type: "text", def: "MUUSIA" },
      { key: "size", label: "Size mm (cap height)", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
      { key: "track", label: "Tracking %", type: "slider", min: 50, max: 300, step: 1, def: 100 },
      { key: "align", label: "Align on path", type: "select", options: ["Start", "Center", "End"], def: "Center" },
      { key: "startPct", label: "Start offset %", type: "slider", min: -50, max: 100, step: 1, def: 0 },
      { key: "baseline", label: "Baseline offset mm", type: "slider", min: -40, max: 40, step: 0.5, def: 0 },
      { key: "side", label: "Side", type: "select", options: ["Along", "Flip (read other side)"], def: "Along" },
      { key: "repeat", label: "Repeat to fill", type: "check", def: false },
      { key: "gap", label: "Repeat gap mm", type: "slider", min: 0, max: 60, step: 0.5, def: 8 },
      { key: "res", label: "Curve sample mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.6 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const F = SFONT; /* baked-in: module scope */
      const sc = Math.max(0.01, p.size) / 10;
      const tr = Math.max(0.1, p.track / 100);
      const flip = p.side === "Flip (read other side)";

      /* fallback spine: straight horizontal line if nothing wired */
      const spines = ins[0] && ins[0].paths && ins[0].paths.length
        ? ins[0].paths
        : [{ pts: [[15, H / 2], [W - 15, H / 2]], closed: false, layer: L }];

      /* advance width of one glyph including inter-letter gap */
      const glyphW = (ch) => ((F[ch] || F[" "]).w + 2) * sc * tr;
      const strForWidth = (s) => {
        let w = 0;
        for (const ch of s) w += glyphW(ch);
        return w;
      };

      const chars = String(p.text || "").toUpperCase().split("");
      const oneW = strForWidth(chars);
      if (oneW <= 0) return applyStyle({ paths: [] }, ins[1]);

      const paths = [];

      for (const spine of spines) {
        const base = resample(spine.pts, spine.closed, Math.max(0.2, p.res));
        if (base.length < 2) continue;
        const closed = !!spine.closed;
        const pts2 = closed ? [...base, base[0]] : base;

        /* arc-length table */
        const cum = [0];
        for (let i = 1; i < pts2.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts2[i][0] - pts2[i - 1][0], pts2[i][1] - pts2[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 1) continue;

        /* position + unit tangent at arc-length s */
        const at = (s) => {
          if (closed) { s = ((s % total) + total) % total; }
          else { s = Math.max(0, Math.min(total, s)); }
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = pts2[lo][0] + (pts2[hi][0] - pts2[lo][0]) * f;
          const y = pts2[lo][1] + (pts2[hi][1] - pts2[lo][1]) * f;
          let tx = pts2[hi][0] - pts2[lo][0], ty = pts2[hi][1] - pts2[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };

        /* one pass lays out chars starting at arc-length s0 */
        const layout = (s0) => {
          let cursor = s0;
          for (const ch of chars) {
            const g = F[ch] || F[" "];
            const adv = glyphW(ch);
            /* place glyph centered on its own advance so rotation looks even */
            const glyphCenter = cursor + adv / 2;
            const [cx, cy, tx, ty] = at(glyphCenter);
            /* tangent (reading direction) and normal */
            let dx = tx, dy = ty, nx = -ty, ny = tx;
            if (flip) { dx = -dx; dy = -dy; nx = -nx; ny = -ny; }
            /* glyph local origin: left edge of glyph body, baseline at y=10*sc.
               We want the glyph's own left edge at (cursor) along the path and
               its baseline shifted by p.baseline along the normal. Local x measured
               from glyph left; recenter so text advance aligns with path arc-length. */
            const halfAdv = adv / 2;
            for (const stroke of g.s) {
              if (stroke.length < 2) continue;
              const outPts = stroke.map(([gx, gy]) => {
                /* local coords in mm: lx along reading dir (0..adv), ly up/down.
                   baseline of font is gy=10 (bottom); shift so baseline sits on path. */
                const lx = gx * sc - halfAdv;              /* center glyph on its advance */
                const ly = (gy * sc - 10 * sc) + p.baseline; /* 0 at baseline, negative = up */
                return [
                  cx + dx * lx + nx * ly,
                  cy + dy * lx + ny * ly,
                ];
              });
              paths.push({ pts: outPts, closed: false, layer: L });
            }
            cursor += adv;
          }
          return cursor;
        };

        if (p.repeat) {
          const stride = oneW + Math.max(0, p.gap);
          let s = (p.startPct / 100) * total;
          /* how many fit */
          const room = closed ? total : (total - s);
          let n = Math.max(1, Math.floor((room + Math.max(0, p.gap)) / stride));
          if (closed) n = Math.max(1, Math.floor(total / stride));
          for (let k = 0; k < n; k++) layout(s + k * stride);
        } else {
          let s0;
          if (p.startPct !== 0) {
            s0 = (p.startPct / 100) * total;
          } else if (p.align === "Center") {
            s0 = (total - oneW) / 2;
          } else if (p.align === "End") {
            s0 = total - oneW;
          } else {
            s0 = 0;
          }
          layout(s0);
        }
      }

      return applyStyle({ paths }, ins[1]);
    },
  
};
