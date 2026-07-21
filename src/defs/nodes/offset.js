import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "offset",
    name: "Offset", cat: "mod", group: "pathops", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "copies", label: "Copies", type: "slider", min: 1, max: 8, step: 1, def: 2 },
      { key: "spacing", label: "Spacing mm", type: "slider", min: 0.1, max: 10, step: 0.05, def: 0.5 },
      { key: "side", label: "Side", type: "select", options: ["Both", "Left", "Right"], def: "Both" },
      { key: "orig", label: "Include original", type: "check", def: true },
      { key: "clean", label: "Clean corners", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const sides = p.side === "Both" ? [1, -1] : p.side === "Left" ? [1] : [-1];
      const paths = [];
      for (const path of src.paths) {
        if (p.orig) paths.push(path);
        const pts = resample(path.pts, path.closed, Math.max(0.8, p.spacing));
        if (pts.length < 2) continue;
        const N = pts.length;
        const normals = pts.map((pt, i) => {
          const nI = path.closed ? (i + 1) % N : Math.min(i + 1, N - 1);
          const pI = path.closed ? (i - 1 + N) % N : Math.max(i - 1, 0);
          const tx = pts[nI][0] - pts[pI][0], ty = pts[nI][1] - pts[pI][1];
          const tl = Math.hypot(tx, ty) || 1;
          return [-ty / tl, tx / tl];
        });
        for (const s of sides) {
          for (let k = 1; k <= Math.round(p.copies); k++) {
            const off = s * k * p.spacing;
            let out = pts.map((pt, i) => [pt[0] + normals[i][0] * off, pt[1] + normals[i][1] * off]);
            if (p.clean) {
              /* poista kaantyneet segmentit: offset-segmentti vs alkuperainen suunta */
              const keep = new Array(out.length).fill(true);
              for (let i = 1; i < out.length; i++) {
                const oi = path.closed ? i % N : i;
                const opi = path.closed ? (i - 1) % N : i - 1;
                const odx = pts[oi][0] - pts[opi][0], ody = pts[oi][1] - pts[opi][1];
                const fdx = out[i][0] - out[i - 1][0], fdy = out[i][1] - out[i - 1][1];
                if (odx * fdx + ody * fdy < 0) keep[i] = false; /* cusp: segmentti kaantyi */
              }
              out = out.filter((_, i) => keep[i]);
              /* siivoa jaljelle jaaneet mikroluupit: pisteet liian lahella toisiaan */
              const out2 = [];
              for (const q of out) {
                const last = out2[out2.length - 1];
                if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.08) out2.push(q);
              }
              out = out2;
            }
            if (out.length > 1) paths.push({ pts: out, closed: path.closed, layer: path.layer });
          }
        }
      }
      return { paths };
    },
  
};
