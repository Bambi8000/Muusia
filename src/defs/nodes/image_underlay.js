import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "image_underlay",
  name: "Image Underlay",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  bgImage: true,
  desc: "Shows an image behind the preview without ever plotting it — a tracing reference for drawing over a physical print. Without calibration the image sits in the margin box. With Calibrate on, jog the machine so the laser dot hits 2–4 corners of the physical print, type each DRO X/Y reading into the matching anchor, and the node fits a similarity transform (position + rotation + uniform scale) so the on-screen image lands exactly where the print lies on the bed. Laser offset and canvas origin come from the machine profile. Anchor residual errors are shown as red arrows in the preview — a long arrow means that reading is off. The Frame output is the image's outline as a closed path: wire it into a region/containment node to keep your drawing on the print.",
  ins: [],
  outs: [Pin("paths", "Frame")],
  params: [
    { key: "image", label: "Image", type: "file", def: "" },
    { key: "show", label: "Show underlay", type: "check", def: true },
    { key: "opacity", label: "Opacity %", type: "slider", min: 5, max: 100, step: 1, def: 40 },
    { key: "gray", label: "Grayscale", type: "check", def: true },
    { key: "margin", label: "Fit margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "calibrate", label: "Calibrate (laser anchors)", type: "check", def: false },
    { key: "useTL", label: "Use top-left", type: "check", def: true },
    { key: "tlX", label: "TL DRO X mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "tlY", label: "TL DRO Y mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "useTR", label: "Use top-right", type: "check", def: true },
    { key: "trX", label: "TR DRO X mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "trY", label: "TR DRO Y mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "useBR", label: "Use bottom-right", type: "check", def: true },
    { key: "brX", label: "BR DRO X mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "brY", label: "BR DRO Y mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "useBL", label: "Use bottom-left", type: "check", def: false },
    { key: "blX", label: "BL DRO X mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "blY", label: "BL DRO Y mm", type: "number", min: -50, max: 800, step: 0.01, def: 0 },
    { key: "framePen", label: "Frame pen", type: "pen", def: 0 },
  ],

  /* Shared transform: fit (margin box) or cal (similarity from anchors).
     Returns { mode, s, rot, cx, cy, w, h, residuals, map } or null when no
     image is loaded. Called as a method (this._xform) by compute, overlay
     and bgRender so all three can never drift apart. Must never throw. */
  _xform(p, ctx, node) {
    const img = node && node.data && node.data.img;
    if (!img || !(img.w > 0) || !(img.h > 0)) return null;
    const W = (ctx && ctx.W) || 300, H = (ctx && ctx.H) || 200;
    const fit = () => {
      const m = Math.max(0, Math.min(p.margin || 0, Math.min(W, H) / 2 - 1));
      const s = Math.max(1e-9, Math.min((W - 2 * m) / img.w, (H - 2 * m) / img.h));
      const map = (px, py) => [W / 2 + (px - img.w / 2) * s, H / 2 + (py - img.h / 2) * s];
      return { mode: "fit", s, rot: 0, cx: W / 2, cy: H / 2, w: img.w * s, h: img.h * s, residuals: [], map };
    };
    if (!p.calibrate) return fit();
    const M = (ctx && ctx.machine) || {};
    const oX = M.originX || 0, oY = M.originY || 0, fY = !!M.flipY;
    const lx = M.laserOffX || 0, ly = M.laserOffY || 0;
    /* DRO reading -> laser dot machine coord -> canvas mm (inverse of export fx/fy) */
    const m2c = (dx, dy) => {
      const mx = dx + lx, my = dy + ly;
      const x = mx - oX, yy = my - oY;
      return [x, fY ? H - yy : yy];
    };
    const corners = [
      { use: p.useTL, P: [0, 0], dx: p.tlX, dy: p.tlY },
      { use: p.useTR, P: [img.w, 0], dx: p.trX, dy: p.trY },
      { use: p.useBR, P: [img.w, img.h], dx: p.brX, dy: p.brY },
      { use: p.useBL, P: [0, img.h], dx: p.blX, dy: p.blY },
    ].filter((c) => c.use);
    if (corners.length < 2) return fit();
    const pairs = corners.map((c) => ({ P: c.P, Q: m2c(+c.dx || 0, +c.dy || 0) }));
    /* 2D Umeyama similarity, closed form, no reflection */
    let pcx = 0, pcy = 0, qcx = 0, qcy = 0;
    for (const { P, Q } of pairs) { pcx += P[0]; pcy += P[1]; qcx += Q[0]; qcy += Q[1]; }
    const n = pairs.length;
    pcx /= n; pcy /= n; qcx /= n; qcy /= n;
    let a = 0, b = 0, n2 = 0;
    for (const { P, Q } of pairs) {
      const px = P[0] - pcx, py = P[1] - pcy, qx = Q[0] - qcx, qy = Q[1] - qcy;
      a += px * qx + py * qy;
      b += px * qy - py * qx;
      n2 += px * px + py * py;
    }
    if (!(n2 > 1e-9)) return fit();
    const s = Math.hypot(a, b) / n2;
    if (!isFinite(s) || s < 1e-9) return fit();
    const th = Math.atan2(b, a), ca = Math.cos(th), sa = Math.sin(th);
    const map = (px, py) => {
      const dx = px - pcx, dy = py - pcy;
      return [qcx + s * (ca * dx - sa * dy), qcy + s * (sa * dx + ca * dy)];
    };
    const residuals = pairs.map(({ P, Q }) => {
      const F = map(P[0], P[1]);
      return { qx: Q[0], qy: Q[1], fx: F[0], fy: F[1], r: Math.hypot(F[0] - Q[0], F[1] - Q[1]) };
    });
    const C = map(img.w / 2, img.h / 2);
    return { mode: "cal", s, rot: (th * 180) / Math.PI, cx: C[0], cy: C[1], w: img.w * s, h: img.h * s, residuals, map };
  },

  /* Engine hook (bgImage flag): what the preview draws under the paths. */
  bgRender(p, ctx, node) {
    if (p.show === false) return null;
    if (!node || !node.data || !node.data.src) return null;
    const T = this._xform(p, ctx, node);
    if (!T) return null;
    const op = Math.max(0.05, Math.min(1, (p.opacity == null ? 40 : p.opacity) / 100));
    return { src: node.data.src, cx: T.cx, cy: T.cy, w: T.w, h: T.h, rotDeg: T.rot, opacity: op, gray: !!p.gray };
  },

  overlay(p, ctx, ins, node) {
    const T = this._xform(p, ctx, node);
    if (!T) return [];
    const g = [];
    const img = node.data.img;
    const F = [T.map(0, 0), T.map(img.w, 0), T.map(img.w, img.h), T.map(0, img.h)];
    g.push({ kind: "poly", pts: F });
    for (const r of T.residuals) {
      g.push({ kind: "point", x: r.qx, y: r.qy });
      if (r.r > 0.05) g.push({ kind: "arrow", x1: r.qx, y1: r.qy, x2: r.fx, y2: r.fy });
    }
    return g;
  },

  compute(ins, p, ctx, node) {
    const T = this._xform(p, ctx, node);
    if (!T) return EMPTY;
    const img = node.data.img;
    const pts = [T.map(0, 0), T.map(img.w, 0), T.map(img.w, img.h), T.map(0, img.h)];
    return { paths: [{ pts, closed: true, layer: Math.round(p.framePen || 0) }] };
  },
};
