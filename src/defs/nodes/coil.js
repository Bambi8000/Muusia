import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "coil",
    name: "Coil", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "radius", label: "Radius mm", type: "slider", min: 0.5, max: 15, step: 0.1, def: 3 },
      { key: "pitch", label: "Pitch mm / loop", type: "slider", min: 0.5, max: 25, step: 0.1, def: 4 },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "layer", label: "Coil pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        const base = resample(path.pts, path.closed, 0.5);
        if (base.length < 3) continue;
        const cum = [0];
        for (let i = 1; i < base.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 1) continue;
        const at = (s) => {
          s = Math.max(0, Math.min(total, s));
          let lo = 0, hi = cum.length - 1;
          while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) lo = mid; else hi = mid;
          }
          const f = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
          const x = base[lo][0] + (base[hi][0] - base[lo][0]) * f;
          const y = base[lo][1] + (base[hi][1] - base[lo][1]) * f;
          const tx = base[hi][0] - base[lo][0], ty = base[hi][1] - base[lo][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [x, y, tx / tl, ty / tl];
        };
        /* trokoidi: ympyraliike etenevan pisteen ymparilla -> silmukat kun pitch < 2*pi*r */
        const loops = total / Math.max(0.2, p.pitch);
        const stepsPerLoop = Math.max(12, Math.ceil((Math.PI * 2 * p.radius) / 0.7));
        const nSteps = Math.min(60000, Math.ceil(loops * stepsPerLoop));
        const pts = [];
        for (let i = 0; i <= nSteps; i++) {
          const th = (i / nSteps) * loops * Math.PI * 2;
          const s = (th / (Math.PI * 2)) * p.pitch;
          const [x, y, tx, ty] = at(s);
          const cr = p.radius * Math.cos(th), sr = p.radius * Math.sin(th);
          pts.push([x + tx * cr - ty * sr, y + ty * cr + tx * sr]);
        }
        paths.push({ pts, closed: false, layer: p.keepCol ? path.layer : Math.round(p.layer) });
      }
      return { paths };
    },
  
};
