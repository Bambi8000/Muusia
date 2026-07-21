import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "displaceimg",
    name: "Displace by Image",
    cat: "mod",
    group: "deform",
    fileImage: true,
    ins: [Pin("paths", "Source")],
    outs: [Pin("paths")],
    params: [
      { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
      { key: "amount", label: "Amount mm", type: "slider", min: 0, max: 40, step: 0.5, def: 10 },
      { key: "mode", label: "Mode", type: "select", options: ["Darkness along angle", "Gradient (emboss)"], def: "Darkness along angle" },
      { key: "angle", label: "Angle deg", type: "slider", min: 0, max: 360, step: 1, def: 90 },
      { key: "invert", label: "Invert", type: "check", def: false },
      { key: "res", label: "Sample step mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1 },
      { key: "margin", label: "Image fit margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 }
    ],
    compute(ins, p, ctx, node) {
      const src = ins[0] || EMPTY;
      const img = node && node.data && node.data.img;
      if (!img) {
        return { paths: src.paths.map((pa) => ({ ...pa, pts: pa.pts.map((q) => q.slice()) })) };
      }
      const { W, H } = ctx;
      const m = Math.max(0, p.margin);
      const boxW = W - 2 * m, boxH = H - 2 * m;
      const sc = Math.min(boxW / img.w, boxH / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ox = (W - iw) / 2, oy = (H - ih) / 2;
      const darkAt = (x, y) => {
        const u = (x - ox) / sc - 0.5, v = (y - oy) / sc - 0.5;
        const iu = Math.floor(u), iv = Math.floor(v);
        const s = (a, b) => (a < 0 || b < 0 || a >= img.w || b >= img.h) ? 0 : img.g[b * img.w + a];
        const fu = u - iu, fv = v - iv;
        let d = s(iu, iv) * (1 - fu) * (1 - fv) + s(iu + 1, iv) * fu * (1 - fv) +
                s(iu, iv + 1) * (1 - fu) * fv + s(iu + 1, iv + 1) * fu * fv;
        return p.invert ? 1 - d : d;
      };
      const a = (p.angle * Math.PI) / 180;
      const adx = Math.cos(a), ady = Math.sin(a);
      const amt = Math.max(0, p.amount);
      const eps = Math.max(0.8, sc);
      const clampX = (x) => Math.max(0.5, Math.min(W - 0.5, x));
      const clampY = (y) => Math.max(0.5, Math.min(H - 0.5, y));
      const paths = src.paths.map((path) => ({
        ...path,
        pts: resample(path.pts, path.closed, Math.max(0.3, p.res)).map(([x, y]) => {
          let dx, dy;
          if (p.mode === "Gradient (emboss)") {
            dx = (darkAt(x + eps, y) - darkAt(x - eps, y)) * amt * 2;
            dy = (darkAt(x, y + eps) - darkAt(x, y - eps)) * amt * 2;
          } else {
            const d = darkAt(x, y) * amt;
            dx = adx * d; dy = ady * d;
          }
          return [clampX(x + dx), clampY(y + dy)];
        })
      }));
      return { paths };
    }
  
};
