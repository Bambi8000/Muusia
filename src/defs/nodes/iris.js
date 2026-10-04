import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "iris",
  name: "Iris",
  cat: "gen",
  group: "nature",
  desc: "Large iris studies made from seeded, interleaved radial fibres. Human, Cat, Goat and Gecko are stylised pupil shapes, not anatomical simulations. Centre rays removes the pupil and starts every fibre at the centre. Diameter is in mm; Fit inside paper reduces it to respect Margin, while Exact diameter allows deliberate cropping/oversize artwork. A complete A3 iris fits at 277 mm with 10 mm margins; a 420 mm iris needs a larger sheet. Fibres controls line density, Flow bends the strands, Texture adds a broken collarette and outer rings, and Edge fray loosens the rim. Monochrome uses only Main pen. Two pens adds Inner pen around the pupil; Three pens also adds Accent pen in outer fibres and rings. Four pens adds Midtone pen between the inner band and rim; Five pens adds Outer pen at the rim; Six pens threads Highlight pen through selected fibres. Each pen is independently selectable, and colour modes preserve the drawing geometry. Pupil hatch uses real pen strokes with a physical Hatch gap, never a filled bitmap. Set colours in Muusia's Pens palette. Seed reproduces the drawing. Export the selected Iris to SVG or G-code; test a small crop with your actual nib before a large plot.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "species", label: "Eye shape", type: "select", options: ["Human", "Cat", "Goat", "Gecko"], def: "Human" },
    { key: "centre", label: "Centre", type: "select", options: ["Pupil", "Centre rays"], def: "Pupil" },
    { key: "diameter", label: "Diameter mm", type: "slider", min: 20, max: 600, step: 1, def: 277 },
    { key: "sizing", label: "Sizing", type: "select", options: ["Fit inside paper", "Exact diameter"], def: "Fit inside paper" },
    { key: "pupil", label: "Pupil size", type: "slider", min: 0.08, max: 0.55, step: 0.01, def: 0.28 },
    { key: "pupilFill", label: "Pupil finish", type: "select", options: ["Open", "Hatched"], def: "Hatched" },
    { key: "hatchGap", label: "Hatch gap mm", type: "slider", min: 0.2, max: 2, step: 0.05, def: 0.55 },
    { key: "fibres", label: "Fibres", type: "slider", min: 80, max: 2400, step: 20, def: 1000 },
    { key: "flow", label: "Flow", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "texture", label: "Texture", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55 },
    { key: "fray", label: "Edge fray", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "colours", label: "Colour mode", type: "select", options: ["Monochrome", "Two pens", "Three pens", "Four pens", "Five pens", "Six pens"], def: "Monochrome" },
    { key: "layer", label: "Main pen", type: "pen", def: 0 },
    { key: "innerPen", label: "Inner pen", type: "pen", def: 4 },
    { key: "accentPen", label: "Accent pen", type: "pen", def: 1 },
    { key: "midtonePen", label: "Midtone pen", type: "pen", def: 6 },
    { key: "outerPen", label: "Outer pen", type: "pen", def: 5 },
    { key: "highlightPen", label: "Highlight pen", type: "pen", def: 10 },
    { key: "rotation", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "cx", label: "Centre X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Centre Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 17 },
  ],
  _number(value, fallback, lo, hi) {
    return Math.max(lo, Math.min(hi, Number.isFinite(Number(value)) ? Number(value) : fallback));
  },
  _region(p, ctx) {
    const W = this._number(ctx.W, 297, 0, 100000), H = this._number(ctx.H, 210, 0, 100000);
    const margin = this._number(p.margin, 10, 0, Math.min(W, H) / 2);
    let R = this._number(p.diameter, 277, 1, 1200) / 2;
    let cx = W * this._number(p.cx, 50, 0, 100) / 100;
    let cy = H * this._number(p.cy, 50, 0, 100) / 100;
    if (p.sizing !== "Exact diameter") {
      R = Math.min(R, Math.max(0, Math.min(W, H) / 2 - margin));
      cx = Math.max(margin + R, Math.min(W - margin - R, cx));
      cy = Math.max(margin + R, Math.min(H - margin - R, cy));
    }
    return { R, cx, cy, rotation: this._number(p.rotation, 0, -36000, 36000) * Math.PI / 180 };
  },
  _pupil(a, p) {
    if (p.centre === "Centre rays") return 0;
    const size = this._number(p.pupil, 0.28, 0.04, 0.55);
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    if (p.species === "Cat") return size / Math.pow(Math.pow(c / 0.34, 1.5) + Math.pow(s / 1.58, 1.5), 1 / 1.5);
    if (p.species === "Goat") return size / Math.pow(Math.pow(c / 1.55, 4) + Math.pow(s / 0.46, 4), 0.25);
    if (p.species === "Gecko") {
      // A continuous notched slit: artistic, deliberately not disconnected apertures.
      const r = 1 / Math.hypot(c / 0.43, s / 1.65);
      return size * r * (0.72 + 0.28 * Math.pow(Math.cos(3 * Math.PI * r * Math.sin(a) / 1.65), 2));
    }
    return size;
  },
  overlay(p, ctx) {
    const g = this._region(p, ctx), { R, cx, cy, rotation } = g;
    if (R <= 0) return [];
    const out = [{ kind: "circle", cx, cy, r: R }, { kind: "point", x: cx, y: cy }];
    if (p.centre !== "Centre rays") {
      const pts = Array.from({ length: 361 }, (_, i) => {
        const a = i * Math.PI / 180, r = R * this._pupil(a, p);
        return [cx + r * Math.cos(a + rotation), cy + r * Math.sin(a + rotation)];
      });
      out.push({ kind: "poly", pts });
    }
    return out;
  },
  compute(ins, p, ctx) {
    const { R, cx, cy, rotation } = this._region(p, ctx);
    if (R < 0.5) return { paths: [] };
    const TAU = Math.PI * 2, rays = p.centre === "Centre rays";
    const n = Math.round(this._number(p.fibres, 1000, 40, 3000));
    const seed = Math.round(this._number(p.seed, 17, -2147483648, 2147483647));
    const flow = this._number(p.flow, 0.55, 0, 1), texture = this._number(p.texture, 0.55, 0, 1);
    const fray = this._number(p.fray, 0.3, 0, 1);
    const pen = (key, fallback = 0) => Math.round(this._number(p[key], fallback, 0, 11));
    const colourCount = Math.max(1, ["Monochrome", "Two pens", "Three pens", "Four pens", "Five pens", "Six pens"].indexOf(p.colours) + 1);
    const main = pen("layer"), inner = colourCount >= 2 ? pen("innerPen") : main;
    const accent = colourCount >= 3 ? pen("accentPen") : main;
    const midtone = pen("midtonePen", 6), outer = pen("outerPen", 5), highlight = pen("highlightPen", 10);
    const rng = mulberry32(seed);
    const paths = [];
    let budget = 112000;
    const at = (a, r) => [cx + R * r * Math.cos(a + rotation), cy + R * r * Math.sin(a + rotation)];
    const field = (a, frequency, radial = 0) => noise2(14 + Math.cos(a) * frequency + radial, 27 + Math.sin(a) * frequency + radial * 0.7, seed);
    const push = (pts, layer, closed = false) => {
      if (pts.length < (closed ? 3 : 2) || pts.length > budget) return;
      paths.push({ pts, closed, layer });
      budget -= pts.length;
    };

    // Bound the work before sampling so high density does not chop off half an iris.
    const steps = Math.max(16, Math.min(110, Math.ceil(R / 1.6), Math.floor(80000 / n) - 4));
    for (let i = 0; i < n; i++) {
      const a0 = TAU * (i + rng() * 0.65) / n;
      const start = rays || rng() > texture * 0.42 ? 0 : 0.12 + rng() * 0.46;
      const end = 1 - fray * (0.04 + rng() * 0.12 + 0.13 * field(a0, 13));
      const phase = rng() * TAU, local = rng() - 0.5;
      const split = 0.2 + 0.12 * field(a0, 6);
      const accentFibre = field(a0, 9) > 0.57 && i % 3 !== 0;
      let pts = [], lastPen;
      for (let j = 0; j <= steps; j++) {
        const t = start + (end - start) * j / steps;
        const a = a0 + flow * Math.sin(Math.PI * t) * (
          0.12 * (field(a0, 4, t * 3) - 0.5) +
          0.014 * Math.sin(t * 18 + phase) + 0.024 * local * Math.sin(t * 7));
        const hole = this._pupil(a, p);
        const clearance = rays ? 0 : Math.min(0.006, 0.45 / R);
        const r = hole + clearance + (1 - hole - clearance) * t;
        const pt = at(a, r);
        // Extra colours interleave with the original fibres. No new random draws
        // or geometric segments: split existing paths into contiguous pen runs.
        let layer = t < split ? inner : t > 0.58 && accentFibre ? accent : main;
        if (colourCount >= 4 && t >= split && i % 3 !== 0 && !(t > 0.58 && accentFibre)) layer = midtone;
        if (colourCount >= 5 && t > 0.72 && !accentFibre) layer = outer;
        if (colourCount >= 6 && i % 11 < 2 && t > split * 0.6) layer = highlight;
        if (pts.length && layer !== lastPen) {
          // Shared endpoint at a colour boundary, with no overlapping segment.
          const joint = pts[pts.length - 1];
          push(pts, lastPen);
          pts = [joint];
        }
        pts.push(pt); lastPen = layer;
      }
      push(pts, lastPen);
    }

    if (!rays) {
      // Physical hatch strokes, clipped by the same pupil polygon as the outline.
      const outline = Array.from({ length: 720 }, (_, i) => {
        const a = i * TAU / 720, r = this._pupil(a, p) * R;
        return [r * Math.cos(a), r * Math.sin(a)];
      });
      const world = ([x, y]) => [cx + x * Math.cos(rotation) - y * Math.sin(rotation), cy + x * Math.sin(rotation) + y * Math.cos(rotation)];
      push(outline.map(world), main, true);
      if (p.pupilFill === "Hatched") {
        const gap = Math.max(this._number(p.hatchGap, 0.55, 0.15, 10), R / 1400);
        const ymax = Math.max(...outline.map(pt => pt[1]));
        let alternate = false;
        for (let y = -ymax + gap / 2; y < ymax; y += gap) {
          const xs = [];
          for (let k = 0; k < outline.length; k++) {
            const a = outline[k], b = outline[(k + 1) % outline.length];
            if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const pts = [world([xs[k], y]), world([xs[k + 1], y])];
            if (alternate) pts.reverse();
            push(pts, main); alternate = !alternate;
          }
        }
      }
    }

    // Fragmented rings reinforce the collarette and limbal band without solid fills.
    const rings = Math.round(texture * 14);
    const samples = Math.max(180, Math.min(720, Math.ceil(TAU * R / 1.6)));
    for (let k = 0; k < rings; k++) {
      let pts = [];
      const collar = k < Math.ceil(rings * 0.55);
      for (let j = 0; j <= samples; j++) {
        const a = j * TAU / samples;
        const t = collar ? 0.16 + k * 0.008 + 0.08 * field(a, 11) : 0.88 + (k - Math.ceil(rings * 0.55)) * 0.009;
        const hole = this._pupil(a, p);
        const r = hole + (1 - hole) * t + 0.006 * texture * Math.sin(a * 71 + k * 0.4);
        const visible = field(a, 18, k * 0.27) > (collar ? 0.38 : 0.46);
        if (visible) pts.push(at(a, r));
        else { push(pts, collar ? inner : accent); pts = []; }
      }
      push(pts, collar ? inner : accent);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
