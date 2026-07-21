import { Pin, EMPTY, noise2, resample } from "../helpers.js";

export default {
  key: "stamp",
    name: "Stamp", cat: "dec", ins: [Pin("paths", "Host path"), Pin("paths", "Motif")], outs: [Pin("paths")],
    params: [
      { key: "spacing", label: "Spacing mm", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
      { key: "size", label: "Size mm", type: "slider", min: 0.5, max: 25, step: 0.25, def: 3 },
      { key: "sizeMod", label: "Size modulation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "pathVar", label: "Per-path variation", type: "slider", min: 0, max: 1, step: 0.05, def: 1 },
      { key: "motif", label: "Motif (if unwired)", type: "select", options: ["Circle", "Square", "Triangle", "Line"], def: "Circle" },
      { key: "orientMode", label: "Orientation", type: "select", options: ["Fixed", "Along path", "Perpendicular"], def: "Fixed" },
      { key: "angle", label: "Angle °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "host", label: "Include host path", type: "check", def: false },
      { key: "keepCol", label: "Keep motif colors", type: "check", def: false },
      { key: "seed", label: "Seed", type: "seed", def: 2 },
      { key: "layer", label: "Motif pen", type: "pen", def: 3 },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const motifIn = ins[1];
      const useCustom = motifIn && motifIn.paths && motifIn.paths.length;
      /* normalisoi custom-motiivi: keskitä ja skaalaa yksikkökokoon */
      let motifNorm = null;
      if (useCustom) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const mp of motifIn.paths) for (const [x, y] of mp.pts) {
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        }
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const dim = Math.max(maxX - minX, maxY - minY) || 1;
        motifNorm = motifIn.paths.map((mp) => ({
          pts: mp.pts.map(([x, y]) => [(x - cx) / dim, (y - cy) / dim]),
          closed: mp.closed, layer: mp.layer,
        }));
      }
      const paths = [];
      const corners = p.motif === "Circle" ? 20 : p.motif === "Square" ? 4 : 3;
      const rotOff = p.motif === "Square" ? Math.PI / 4 : -Math.PI / 2;
      src.paths.forEach((path, pIdx) => {
        if (p.host) paths.push(path);
        const pts = resample(path.pts, path.closed, Math.max(0.5, p.spacing));
        pts.forEach((pt, i) => {
          const m = 1 + (noise2(
            pt[0] * 0.05 + pIdx * 7.31 * p.pathVar,
            pt[1] * 0.05 + pIdx * 3.77 * p.pathVar,
            p.seed) - 0.5) * 2 * p.sizeMod;
          const S = Math.max(0.2, p.size * m);
          let ang = (p.angle * Math.PI) / 180;
          if (p.orientMode !== "Fixed" && pts.length > 1) {
            const nb = pts[Math.min(i + 1, pts.length - 1)], pb = pts[Math.max(i - 1, 0)];
            const tang = Math.atan2(nb[1] - pb[1], nb[0] - pb[0]);
            ang += p.orientMode === "Perpendicular" ? tang + Math.PI / 2 : tang;
          }
          const ca = Math.cos(ang), sa = Math.sin(ang);
          if (motifNorm) {
            for (const mp of motifNorm) {
              const out = mp.pts.map(([x, y]) => {
                const xs = x * S, ys = y * S;
                return [pt[0] + xs * ca - ys * sa, pt[1] + xs * sa + ys * ca];
              });
              paths.push({ pts: out, closed: mp.closed, layer: p.keepCol ? mp.layer : Math.round(p.layer) });
            }
          } else if (p.motif === "Line") {
            /* viivamotiivi: pituus = Size, suunta orientaation mukaan */
            const h = S / 2;
            paths.push({
              pts: [[pt[0] - h * ca, pt[1] - h * sa], [pt[0] + h * ca, pt[1] + h * sa]],
              closed: false, layer: Math.round(p.layer),
            });
          } else {
            const r = S / 2;
            const mp = [];
            for (let k = 0; k < corners; k++) {
              const a = (k / corners) * Math.PI * 2 + rotOff + ang;
              mp.push([pt[0] + Math.cos(a) * r, pt[1] + Math.sin(a) * r]);
            }
            paths.push({ pts: mp, closed: true, layer: Math.round(p.layer) });
          }
        });
      });
      return { paths };
    },
  
};
