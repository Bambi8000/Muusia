import { Pin } from "../helpers.js";

export default {
  key: "focal_point",
  name: "Focal Point",
  cat: "math",
  desc: "One shared focus for several nodes. Wire X % and Y % to their Focus or Center percentage controls; Adaptive Grid, Portrait, Spiral Image and other nodes then move together. X mm and Y mm expose the same point in paper millimetres for nodes that use absolute coordinates. Radius mm can drive an influence radius. The selected node shows a point and radius guide; the guides do not plot. All controls can be animated with Frame.",
  ins: [],
  outs: [Pin("value", "X %"), Pin("value", "Y %"), Pin("value", "X mm"), Pin("value", "Y mm"), Pin("value", "Radius mm")],
  params: [
    { key: "x", label: "X %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "y", label: "Y %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "radius", label: "Radius mm", type: "slider", min: 0, max: 300, step: 1, def: 95 },
  ],
  overlay(p, ctx) {
    const W = +ctx?.W, H = +ctx?.H;
    if (!(Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0)) return [];
    const n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d;
    const x = W * n(p.x, 0, 100, 50) / 100, y = H * n(p.y, 0, 100, 50) / 100;
    const r = n(p.radius, 0, 300, 95);
    return r > 0 ? [{ kind: "point", x, y }, { kind: "circle", cx: x, cy: y, r }] : [{ kind: "point", x, y }];
  },
  compute(ins, p, ctx) {
    const n = (v, lo, hi, d) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d;
    const x = n(p.x, 0, 100, 50), y = n(p.y, 0, 100, 50), r = n(p.radius, 0, 300, 95);
    const W = Number.isFinite(+ctx?.W) && +ctx.W > 0 ? +ctx.W : 0;
    const H = Number.isFinite(+ctx?.H) && +ctx.H > 0 ? +ctx.H : 0;
    return [x, y, W * x / 100, H * y / 100, r];
  },
};
