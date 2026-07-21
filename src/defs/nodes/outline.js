import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "outline",
    name: "Outline", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "width", label: "Width mm", type: "slider", min: 0.4, max: 12, step: 0.1, def: 2 },
      { key: "clean", label: "Clean corners", type: "check", def: true },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "layer", label: "Outline pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const r = p.width / 2;
      const paths = [];
      const cleanSide = (out, orig, closed) => {
        if (!p.clean) return out;
        const keep = new Array(out.length).fill(true);
        for (let i = 1; i < out.length; i++) {
          const odx = orig[i][0] - orig[i - 1][0], ody = orig[i][1] - orig[i - 1][1];
          const fdx = out[i][0] - out[i - 1][0], fdy = out[i][1] - out[i - 1][1];
          if (odx * fdx + ody * fdy < 0) keep[i] = false;
        }
        const res = [];
        for (let i = 0; i < out.length; i++) {
          if (!keep[i]) continue;
          const last = res[res.length - 1];
          if (!last || Math.hypot(out[i][0] - last[0], out[i][1] - last[1]) > 0.06) res.push(out[i]);
        }
        return res;
      };
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        const L = p.keepCol ? path.layer : Math.round(p.layer);
        const pts = resample(path.pts, path.closed, Math.max(0.5, r / 2));
        if (pts.length < 2) continue;
        const N = pts.length;
        const nl = pts.map((pt, i) => {
          const nI = path.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
          const pI = path.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [-ty / tl, tx / tl];
        });
        if (path.closed) {
          /* suljettu polku -> kaksi rengasta (nauha) */
          for (const s of [1, -1]) {
            const out = cleanSide(pts.map((pt, i) => [pt[0] + nl[i][0] * r * s, pt[1] + nl[i][1] * r * s]), pts, true);
            if (out.length > 2) paths.push({ pts: out, closed: true, layer: L });
          }
          continue;
        }
        /* avoin polku -> kapseli: vasen kylki + paatykaari + oikea kylki + alkukaari */
        const left = cleanSide(pts.map((pt, i) => [pt[0] + nl[i][0] * r, pt[1] + nl[i][1] * r]), pts, false);
        const rightFwd = cleanSide(pts.map((pt, i) => [pt[0] - nl[i][0] * r, pt[1] - nl[i][1] * r]), pts, false);
        const right = [...rightFwd].reverse();
        const capArc = (center, fromV) => {
          /* puoliympyra: fromV-suunnasta 180 astetta myotapaivaan */
          const a0 = Math.atan2(fromV[1], fromV[0]);
          const out = [];
          for (let k = 1; k < 10; k++) {
            const a = a0 - (Math.PI * k) / 10;
            out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]);
          }
          return out;
        };
        const capsule = [
          ...left,
          ...capArc(pts[N - 1], nl[N - 1]),
          ...right,
          ...capArc(pts[0], [-nl[0][0], -nl[0][1]]),
        ];
        if (capsule.length > 3) paths.push({ pts: capsule, closed: true, layer: L });
      }
      return { paths };
    },
  
};
