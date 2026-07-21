import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "trunks",
      name: "Trunks",
    cat: "gen", group: "nature",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Trunks", type: "slider", min: 1, max: 30, step: 1, def: 7 },
      { key: "width", label: "Width mm", type: "slider", min: 2, max: 60, step: 0.5, def: 16 },
      { key: "widthVar", label: "Width variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "smooth", label: "Smoothness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65 },
      { key: "lean", label: "Lean", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "artifacts", label: "Artifacts (bark)", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: "taper", label: "Taper", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "markPen", label: "Bark pen", type: "pen", def: 0 },
      { key: "sameAsTrunk", label: "Bark = trunk pen", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "seed", label: "Seed", type: "seed", def: 79 },
      { key: "layer", label: "Trunk pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const MP = p.sameAsTrunk ? L : Math.round(p.markPen);
      const paths = [];
      const rngG = mulberry32(p.seed * 2903 + 53);
      /* rungot jaettuna leveydelle kevyella jitterilla */
      const n = Math.round(p.count);
      const slots = [];
      for (let i = 0; i < n; i++) slots.push((i + 0.5) / n + (rngG() - 0.5) * (0.5 / n));
      for (let c = 0; c < n; c++) {
        const rng = mulberry32(p.seed * 2903 + c * 419 + 7);
        const w0 = p.width * (1 - p.widthVar * rng());
        const cx0 = p.margin + slots[c] * (W - 2 * p.margin);
        const leanAmt = (rng() - 0.5) * 2 * p.lean * w0 * 2.5;
        /* reunojen vaellus: smoothness pienentaa amplitudia ja hidastaa taajuutta */
        const amp = (1 - p.smooth) * w0 * 0.45;
        const fq = 2 + (1 - p.smooth) * 6;
        const nS = 110;
        const left = [], right = [];
        const edgeAt = (t) => {
          const cx = cx0 + leanAmt * t + (noise2(t * 1.2, c * 7.3, p.seed) - 0.5) * w0 * 0.7 * (1 - p.smooth);
          const w = (w0 / 2) * (1 - p.taper * (1 - t));   /* kapenee ylospain */
          const wl = (noise2(t * fq, c * 11.1, p.seed + 2) - 0.5) * 2 * amp;
          const wr = (noise2(t * fq, c * 11.1 + 50, p.seed + 3) - 0.5) * 2 * amp;
          return [cx - w + wl, cx + w + wr, cx, w * 2];
        };
        for (let i = 0; i <= nS; i++) {
          const t = i / nS;
          const y = p.margin + t * (H - 2 * p.margin);
          const [xl, xr] = edgeAt(t);
          left.push([xl, y]);
          right.push([xr, y]);
        }
        paths.push({ pts: left, closed: false, layer: L });
        paths.push({ pts: right, closed: false, layer: L });
        /* koivun kaarnamerkit: vaakasuuntaisia kaaria rungon sisalla,
           satunnainen osuus leveydesta, kevyt kaarevuus alaspain */
        const nMarks = Math.round(p.artifacts * 26 * (H / 200));
        for (let m = 0; m < nMarks; m++) {
          const t = 0.03 + rng() * 0.94;
          const y = p.margin + t * (H - 2 * p.margin);
          const [xl, xr] = edgeAt(t);
          const wSpan = xr - xl;
          if (wSpan < 1.5) continue;
          const a = rng() * 0.55;
          const b = a + 0.15 + rng() * Math.min(0.8, 1 - a - 0.15);
          const x0 = xl + wSpan * a, x1 = xl + wSpan * Math.min(0.97, b);
          const sagY = (0.3 + rng() * 0.9);
          const mid = [(x0 + x1) / 2, y + sagY];
          paths.push({ pts: [[x0, y], mid, [x1, y]], closed: false, layer: MP });
          /* osa merkeista kaksinkertaisia (paksu kaarnaviiru) */
          if (rng() < 0.3) {
            paths.push({ pts: [[x0, y + 1], [(x0 + x1) / 2, y + 1 + sagY], [x1, y + 1]], closed: false, layer: MP });
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
