import { Pin, mulberry32, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "bluesprig",
    name: "Blueberry Sprig",
    cat: "gen",
    group: "nature",
    desc: "Hand-drawn blueberry sprigs after an embroidered original: a wandering main stem with sharp little kinks, sparse side branches, berries as small circles on stalk tips (sometimes clustered), and loose open cup flowers. Tip mix balances berries against cups; Leaves adds pointed ovals along the branches. A light ink wobble is baked in - chain into Hand Drawn for more.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "sprigs", label: "Sprigs", type: "slider", min: 1, max: 5, step: 1, def: 1 },
      { key: "height", label: "Height mm", type: "slider", min: 40, max: 240, step: 5, def: 150 },
      { key: "branches", label: "Branches", type: "slider", min: 1, max: 7, step: 1, def: 4 },
      { key: "tipMix", label: "Tips: berries - cups", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "leaves", label: "Leaves", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "wobble", label: "Ink wobble", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 14 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 20 || y1 - y0 < 30) return applyStyle({ paths: [] }, ins[0]);
      const L = Math.round(p.layer);
      const paths = [];
      const BUDGET = 120000;
      let total = 0;
      const push = (pts, closed) => {
        if (pts.length < 2 || total + pts.length > BUDGET) return;
        total += pts.length;
        paths.push({
          pts: pts.map(([x, y]) => [Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]),
          closed, layer: L
        });
      };
      const NS = Math.max(1, Math.min(5, Math.round(p.sprigs)));
      const HT = Math.min(p.height, y1 - y0 - 6);
      for (let s = 0; s < NS; s++) {
        const sd = (p.seed * 733 + s * 419) | 0;
        const rng = mulberry32(sd);
        const wob = (x, y, k) => (noise2(x * 0.09 + k * 7, y * 0.09, sd + k) - 0.5) * 2 * p.wobble * 1.1;
        const jig = (pts) => pts.map(([x, y], i) => [x + wob(x, y, 1), y + wob(x, y, 2)]);
        /* base position: sprigs spread horizontally, tails clear of margins */
        const bx = x0 + ((s + 0.5) / NS) * (x1 - x0) + (rng() - 0.5) * (x1 - x0) * 0.1 / NS;
        const by = y1 - 2;
        /* --- main stem: upward wander with sharp little kinks --- */
        const segLen = HT / 15;
        let x = bx, y = by;
        let ang = -Math.PI / 2 + (rng() - 0.5) * 0.2;
        const stem = [[x, y]];
        const nSeg = 15;
        for (let i = 0; i < nSeg; i++) {
          /* smooth wander + occasional sharp kink like the stitched original */
          ang += (rng() - 0.5) * 0.28;
          if (rng() < 0.22) ang += (rng() < 0.5 ? 1 : -1) * (0.5 + rng() * 0.5);
          /* pull back upright and inside */
          ang = ang * 0.82 + (-Math.PI / 2) * 0.18;
          if (x < x0 + 14) ang = ang * 0.7 + (-Math.PI / 3) * 0.3;
          if (x > x1 - 14) ang = ang * 0.7 + (-Math.PI * 2 / 3) * 0.3;
          x += Math.cos(ang) * segLen;
          y += Math.sin(ang) * segLen;
          stem.push([x, y]);
        }
        /* interpolate stem finer for drawing */
        const fine = resample(stem, false, 1.6);
        push(jig(fine), false);
        /* --- tips: stem top + branch ends carry berries or cups --- */
        const tipAt = (tx, ty, dirAng) => {
          const roll = rng();
          if (roll < 1 - p.tipMix) {
            /* berry cluster: 1-3 circles on short fanning stalklets */
            const nb = 1 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
            for (let b = 0; b < nb; b++) {
              const fa = dirAng + (b - (nb - 1) / 2) * 0.55 + (rng() - 0.5) * 0.25;
              const sl = 4 + rng() * 5;
              const ex = tx + Math.cos(fa) * sl, ey = ty + Math.sin(fa) * sl;
              push(jig([[tx, ty], [ex, ey]]), false);
              const r = 1.4 + rng() * 1.1;
              const cx2 = ex + Math.cos(fa) * r, cy2 = ey + Math.sin(fa) * r;
              const nn = 10 + Math.round(rng() * 3);
              const c = [];
              for (let k = 0; k < nn; k++) {
                const a = (k / nn) * Math.PI * 2;
                c.push([cx2 + Math.cos(a) * r, cy2 + Math.sin(a) * r]);
              }
              push(jig(c), true);
            }
          } else {
            /* loose open cup flower: irregular arc from ~210deg to ~-30deg, open at the mouth */
            const sl = 3 + rng() * 4;
            const ex = tx + Math.cos(dirAng) * sl, ey = ty + Math.sin(dirAng) * sl;
            push(jig([[tx, ty], [ex, ey]]), false);
            const cw = 5 + rng() * 4, ch = 6 + rng() * 4;
            const rot = dirAng + Math.PI / 2 + (rng() - 0.5) * 0.4;
            const cup = [];
            const nn = 9 + Math.round(rng() * 3);
            const a0 = Math.PI * 1.18, a1 = -Math.PI * 0.18;
            const cr = rot - Math.PI / 2;
            const cc = Math.cos(cr), cs = Math.sin(cr);
            for (let k = 0; k <= nn; k++) {
              const a = a0 + (k / nn) * (a1 - a0);
              const rr = 1 + (rng() - 0.5) * 0.22;
              const px = Math.cos(a) * cw * 0.5 * rr;
              const py = Math.sin(a) * ch * 0.55 * rr + ch * 0.4;
              cup.push([ex + px * cc - py * cs, ey + px * cs + py * cc]);
            }
            push(jig(cup), false);
          }
        };
        /* stem top tip */
        const tip = fine[fine.length - 1];
        const tipPrev = fine[Math.max(0, fine.length - 4)];
        tipAt(tip[0], tip[1], Math.atan2(tip[1] - tipPrev[1], tip[0] - tipPrev[0]));
        /* --- branches --- */
        const NB = Math.round(p.branches);
        for (let b = 0; b < NB; b++) {
          const t = 0.25 + (b / Math.max(1, NB - 1)) * 0.6 + (rng() - 0.5) * 0.06;
          const idx = Math.min(fine.length - 2, Math.max(1, Math.round(t * fine.length)));
          const bp = fine[idx];
          const sd2 = Math.atan2(fine[idx + 1][1] - fine[idx - 1][1], fine[idx + 1][0] - fine[idx - 1][0]);
          const side = rng() < 0.5 ? 1 : -1;
          let ba = sd2 + side * (0.5 + rng() * 0.55);
          const blen = HT * (0.12 + rng() * 0.16) * (1 - t * 0.4);
          const bSegs = 4 + Math.round(rng() * 3);
          let bx2 = bp[0], by2 = bp[1];
          const br = [[bx2, by2]];
          for (let i = 0; i < bSegs; i++) {
            ba += (rng() - 0.5) * 0.35;
            ba = ba * 0.85 + (-Math.PI / 2) * 0.15; /* branches also reach up */
            bx2 += Math.cos(ba) * (blen / bSegs);
            by2 += Math.sin(ba) * (blen / bSegs);
            br.push([bx2, by2]);
          }
          const bf = resample(br, false, 1.6);
          push(jig(bf), false);
          tipAt(bx2, by2, ba);
          /* leaves along the branch */
          if (rng() < p.leaves * 1.6) {
            const li = Math.max(1, Math.round(bf.length * (0.3 + rng() * 0.4)));
            const lp = bf[Math.min(bf.length - 2, li)];
            const la = ba + (rng() < 0.5 ? 1 : -1) * (0.9 + rng() * 0.4);
            const ll = 5 + rng() * 4;
            const leaf = [];
            const half = 7;
            const lw = ll * 0.32;
            for (let k = 0; k <= half; k++) {          /* base -> tip, one side */
              const t2 = k / half;
              const along = t2 * ll, w2 = Math.sin(t2 * Math.PI) * lw;
              leaf.push([lp[0] + Math.cos(la) * along - Math.sin(la) * w2,
                         lp[1] + Math.sin(la) * along + Math.cos(la) * w2]);
            }
            for (let k = half - 1; k > 0; k--) {       /* tip -> base, other side */
              const t2 = k / half;
              const along = t2 * ll, w2 = -Math.sin(t2 * Math.PI) * lw;
              leaf.push([lp[0] + Math.cos(la) * along - Math.sin(la) * w2,
                         lp[1] + Math.sin(la) * along + Math.cos(la) * w2]);
            }
            push(jig(leaf), true);
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
