import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "endcaps",
    name: "End Caps", cat: "dec", ins: [Pin("paths")], outs: [Pin("paths")],
    params: [
      { key: "where", label: "Where", type: "select", options: ["End", "Start", "Both"], def: "End" },
      { key: "style", label: "Style", type: "select", options: ["Arrow", "Dot", "Circle", "Tick"], def: "Arrow" },
      { key: "size", label: "Size mm", type: "slider", min: 0.5, max: 15, step: 0.25, def: 3 },
      { key: "host", label: "Include host path", type: "check", def: true },
      { key: "layer", label: "Cap pen", type: "pen", def: 0 },
      { key: "keepCol", label: "Use path pen", type: "check", def: true },
    ],
    compute(ins, p) {
      const src = ins[0] || EMPTY;
      const paths = [];
      const cap = (pt, dirIn, layer) => {
        /* dirIn = polun kulkusuunta paatepisteessa (osoittaa ulos polusta) */
        const a = Math.atan2(dirIn[1], dirIn[0]);
        if (p.style === "Arrow") {
          const w = (25 * Math.PI) / 180;
          for (const s of [1, -1]) {
            paths.push({
              pts: [[pt[0], pt[1]], [pt[0] - Math.cos(a + s * w) * p.size, pt[1] - Math.sin(a + s * w) * p.size]],
              closed: false, layer,
            });
          }
        } else if (p.style === "Tick") {
          const h = p.size / 2;
          paths.push({
            pts: [[pt[0] - Math.sin(a) * h, pt[1] + Math.cos(a) * h], [pt[0] + Math.sin(a) * h, pt[1] - Math.cos(a) * h]],
            closed: false, layer,
          });
        } else {
          const n = p.style === "Dot" ? 8 : 16;
          const r = p.style === "Dot" ? p.size / 4 : p.size / 2;
          const c = [];
          for (let k = 0; k < n; k++) {
            const aa = (k / n) * Math.PI * 2;
            c.push([pt[0] + Math.cos(aa) * r, pt[1] + Math.sin(aa) * r]);
          }
          paths.push({ pts: c, closed: true, layer });
        }
      };
      for (const path of src.paths) {
        if (p.host) paths.push(path);
        if (path.closed || path.pts.length < 2) continue;
        const L = p.keepCol ? path.layer : Math.round(p.layer);
        const n = path.pts.length;
        if (p.where !== "Start") {
          const d = [path.pts[n - 1][0] - path.pts[n - 2][0], path.pts[n - 1][1] - path.pts[n - 2][1]];
          cap(path.pts[n - 1], d, L);
        }
        if (p.where !== "End") {
          const d = [path.pts[0][0] - path.pts[1][0], path.pts[0][1] - path.pts[1][1]];
          cap(path.pts[0], d, L);
        }
      }
      return { paths };
    },
  
};
