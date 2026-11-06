import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "spiral_image",
  name: "Spiral Image",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  imageMax: 640,
  desc: "Turn a PNG/JPG into exactly one continuous, open spiral pen path. The spiral always traverses light areas so the pen never lifts; darker tones increase tiny radial wiggles along it. Pitch sets the distance between turns, Tone wiggle controls dark mark depth, and Wiggle wavelength controls texture. Circle makes a round engraving; Ellipse uses more of a wide or tall image. Center X/Y moves the focus while keeping the whole line within the image and paper margins. The node coarsens Pitch uniformly if a large drawing would exceed its point budget. Image processing stays on this device. Leave Style unwired: dashes would break the one-line guarantee.",
  ins: [],
  outs: [Pin("paths", "One line")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "shape", label: "Spiral shape", type: "select", options: ["Ellipse", "Circle"], def: "Ellipse" },
    { key: "pitch", label: "Turn spacing mm", type: "slider", min: 0.6, max: 7, step: 0.1, def: 1.7 },
    { key: "wiggle", label: "Tone wiggle mm", type: "slider", min: 0, max: 3, step: 0.05, def: 1.8 },
    { key: "wavelength", label: "Wiggle wavelength mm", type: "slider", min: 1.5, max: 10, step: 0.1, def: 4.5 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0.5, max: 3, step: 0.05, def: 1.75 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.5, step: 0.01, def: 0.12 },
    { key: "centerX", label: "Center X %", type: "slider", min: 20, max: 80, step: 1, def: 50 },
    { key: "centerY", label: "Center Y %", type: "slider", min: 20, max: 80, step: 1, def: 50 },
    { key: "direction", label: "Direction", type: "select", options: ["Outward", "Inward"], def: "Outward" },
    { key: "angle", label: "Start angle °", type: "slider", min: -180, max: 180, step: 1, def: -90 },
    { key: "pen", label: "Pen", type: "pen", def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
  ],
  overlay(p, ctx, ins, node) {
    const W = ctx?.W, H = ctx?.H;
    if (!Number.isFinite(W) || !Number.isFinite(H)) return [];
    const m = Math.max(0, Math.min(60, Number(p.margin) || 0));
    const img = node?.data?.img;
    if (img?.w > 0 && img?.h > 0 && W > 2 * m && H > 2 * m) {
      const sc = Math.min((W - 2 * m) / img.w, (H - 2 * m) / img.h);
      const w = img.w * sc, h = img.h * sc;
      return [{ kind: "rect", x: (W - w) / 2, y: (H - h) / 2, w, h }];
    }
    return W > 2 * m && H > 2 * m ? [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }] : [];
  },
  compute(ins, p, ctx, node) {
    const empty = EMPTY;
    const img = node?.data?.img, W = ctx?.W, H = ctx?.H;
    if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0 ||
      !img || !Number.isInteger(img.w) || !Number.isInteger(img.h) || img.w < 2 || img.h < 2 ||
      img.w * img.h > 2560000 || !img.g || img.g.length !== img.w * img.h) return empty;
    const n = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : fallback;
    const margin = n(p.margin, 0, 60, 12);
    if (W - 2 * margin < 4 || H - 2 * margin < 4) return empty;
    const sc = Math.min((W - 2 * margin) / img.w, (H - 2 * margin) / img.h);
    const iw = img.w * sc, ih = img.h * sc, x0 = (W - iw) / 2, y0 = (H - ih) / 2;
    const cx = x0 + iw * n(p.centerX, 20, 80, 50) / 100;
    const cy = y0 + ih * n(p.centerY, 20, 80, 50) / 100;
    const shape = p.shape === "Circle" ? "Circle" : "Ellipse";
    let rx = Math.min(cx - x0, x0 + iw - cx) - 2;
    let ry = Math.min(cy - y0, y0 + ih - cy) - 2;
    if (shape === "Circle") rx = ry = Math.min(rx, ry);
    if (rx < 3 || ry < 3) return empty;
    const rmin = Math.min(rx, ry);
    const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const requestedPitch = n(p.pitch, 0.6, 7, 1.7);
    const pitch = Math.max(requestedPitch, circumference * rmin / (30000 * 1.35));
    const turns = Math.min(250, Math.max(2, Math.floor(rmin / pitch)));
    const amplitude = Math.min(n(p.wiggle, 0, 3, 1.8), pitch * 1.1);
    const wavelength = n(p.wavelength, 1.5, 10, 4.5);
    const contrast = n(p.contrast, 0.5, 3, 1.75), cutoff = n(p.cutoff, 0, 0.5, 0.12);
    const startAngle = n(p.angle, -180, 180, -90) * Math.PI / 180;
    const pen = Math.round(n(p.pen, 0, 11, 0));
    const totalLength = circumference * turns / 2;
    const samples = Math.min(30000, Math.max(32, Math.ceil(circumference * turns / 1.35)));
    const sample = (x, y) => {
      const u = Math.max(0, Math.min(img.w - 1, (x - x0) / sc - 0.5));
      const v = Math.max(0, Math.min(img.h - 1, (y - y0) / sc - 0.5));
      const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
      const at = (a, b) => { const q = Number(img.g[Math.min(img.h - 1, b) * img.w + Math.min(img.w - 1, a)]); return Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0; };
      const value = at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
      return Math.max(0, Math.min(1, ((value - 0.5) * contrast + 0.5 - cutoff) / (1 - cutoff)));
    };
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const theta = startAngle + 2 * Math.PI * turns * t;
      const ux = Math.cos(theta), uy = Math.sin(theta);
      const bx = cx + rx * t * ux, by = cy + ry * t * uy;
      const tone = Math.sqrt(sample(bx, by));
      const wave = amplitude * tone * Math.sin(2 * Math.PI * (totalLength * t * t) / wavelength);
      const x = cx + (rx * t + wave) * ux, y = cy + (ry * t + wave) * uy;
      pts.push([Math.max(x0, Math.min(x0 + iw, x)), Math.max(y0, Math.min(y0 + ih, y))]);
    }
    if (p.direction === "Inward") pts.reverse();
    return { paths: [{ pts, closed: false, layer: pen }] };
  },
};
