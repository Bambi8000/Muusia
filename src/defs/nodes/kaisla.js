import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

const num = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback));
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export default {
  key: "kaisla",
  name: "Kaisla",
  cat: "gen",
  group: "nature",
  desc: "Long reeds for narrow receipt rolls. Stalk length % follows the canvas length; Length variation scatters the tips. Sway and Lean bend across the available paper width without shortening the stalks. Sway repeat, Joint spacing and Leaf spacing are physical millimetres, so the detail repeats along metre-long stems. Stem width tapers into a fine tip using real parallel strokes at Pen pitch. Leaves are pointed outlines with optional veins; Seed head adds Feathery reeds or Cattail clubs. Orientation turns the whole growth horizontally. Every mark stays inside Margin. Dense requests coarsen sampling and feature spacing evenly across all stalks rather than dropping their tips. Pens change colour only; no solid preview-only fills. Search: reed, reeds, rush, kaisla, ruoko, receipt, roll.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "orientation", label: "Orientation", type: "select", options: ["Vertical", "Horizontal"], def: "Vertical" },
    { key: "count", label: "Stalks", type: "slider", min: 1, max: 40, step: 1, def: 7 },
    { key: "length", label: "Stalk length %", type: "slider", min: 10, max: 100, step: 1, def: 97 },
    { key: "lengthVar", label: "Length variation", type: "slider", min: 0, max: 0.8, step: 0.05, def: 0.28 },
    { key: "width", label: "Stem width mm", type: "slider", min: 0.2, max: 4, step: 0.1, def: 0.7 },
    { key: "pitch", label: "Pen pitch mm", type: "slider", min: 0.15, max: 1, step: 0.05, def: 0.25 },
    { key: "taper", label: "Taper", type: "slider", min: 0, max: 1, step: 0.05, def: 0.85 },
    { key: "lean", label: "Lean mm", type: "slider", min: -60, max: 60, step: 1, def: 5 },
    { key: "sway", label: "Sway mm", type: "slider", min: 0, max: 40, step: 0.5, def: 6 },
    { key: "swayLength", label: "Sway repeat mm", type: "slider", min: 40, max: 2000, step: 10, def: 550, showIf: p => p.sway > 0 },
    { key: "roughness", label: "Roughness", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
    { key: "joints", label: "Joints", type: "check", def: true },
    { key: "jointSpacing", label: "Joint spacing mm", type: "slider", min: 30, max: 1000, step: 10, def: 180, showIf: p => !!p.joints },
    { key: "leaves", label: "Leaves", type: "check", def: true },
    { key: "leafSpacing", label: "Leaf spacing mm", type: "slider", min: 80, max: 2000, step: 10, def: 420, showIf: p => !!p.leaves },
    { key: "leafLength", label: "Leaf length mm", type: "slider", min: 10, max: 600, step: 5, def: 120, showIf: p => !!p.leaves },
    { key: "leafWidth", label: "Leaf width mm", type: "slider", min: 0.5, max: 12, step: 0.5, def: 2.5, showIf: p => !!p.leaves },
    { key: "leafVeins", label: "Leaf veins", type: "check", def: false, showIf: p => !!p.leaves },
    { key: "head", label: "Seed head", type: "select", options: ["None", "Feathery", "Cattail"], def: "Feathery" },
    { key: "headLength", label: "Head length mm", type: "slider", min: 10, max: 240, step: 5, def: 65, showIf: p => p.head !== "None" },
    { key: "headWidth", label: "Head width mm", type: "slider", min: 1, max: 20, step: 0.5, def: 7, showIf: p => p.head !== "None" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 30, step: 1, def: 5 },
    { key: "seed", label: "Seed", type: "seed", def: 17 },
    { key: "layer", label: "Stem pen", type: "pen", def: 0 },
    { key: "detailPen", label: "Leaf / head pen", type: "pen", def: 0, showIf: p => p.leaves || p.head !== "None" },
  ],
  overlay(p, ctx) {
    const m = num(p.margin, 5, 0, Math.min(ctx.W, ctx.H) / 2);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const W = num(ctx.W, 0, 0, 100000), H = num(ctx.H, 0, 0, 100000);
    const m = num(p.margin, 5, 0, Math.min(W, H) / 2), horizontal = p.orientation === "Horizontal";
    const across = (horizontal ? H : W) - 2 * m, along = (horizontal ? W : H) - 2 * m;
    if (across < 2 || along < 10) return EMPTY;
    const count = Math.round(num(p.count, 7, 1, 60)), seed = num(p.seed, 17, -1e9, 1e9);
    const pen = Math.round(num(p.layer, 0, 0, 11)), detailPen = Math.round(num(p.detailPen, 0, 0, 11));
    const width = num(p.width, 0.7, 0.1, Math.min(6, across / 4)), pitch = num(p.pitch, 0.25, 0.15, 1);
    const passes = Math.max(1, Math.min(25, Math.ceil(width / pitch)));
    const taper = num(p.taper, 0.85, 0, 1), roughness = num(p.roughness, 0.15, 0, 1);
    const maxLength = along * num(p.length, 97, 10, 100) / 100;
    // Reserve independent budgets for full stems and botanical details. The
    // entire length is sampled for every stem, even on exceptionally long rolls.
    const step = Math.max(1.2, count * passes * maxLength / 72000);
    const swayPeriod = Math.max(num(p.swayLength, 550, 40, 10000), step * 24);
    const jointSpacing = Math.max(num(p.jointSpacing, 180, 30, 10000), count * along / 3000);
    const leafSpacing = Math.max(num(p.leafSpacing, 420, 80, 10000), count * along / 180);
    const leafLength = num(p.leafLength, 120, 10, 2000), leafWidth = num(p.leafWidth, 2.5, 0.5, 20);
    const headLength = num(p.headLength, 65, 10, 500), headWidth = num(p.headWidth, 7, 1, Math.min(30, across / 2));
    const reserve = Math.min(across * 0.22, Math.max(width / 2 + 0.2, p.head !== "None" ? headWidth / 2 + 0.2 : width));
    const toXY = (u, s) => horizontal ? [m + s, m + u] : [m + u, H - m - s];
    const paths = [];
    const emit = (pts, layer = pen, closed = false) => paths.push({ pts: pts.map(([u, s]) => toXY(u, s)), closed, layer });
    for (let stalk = 0; stalk < count; stalk++) {
      const rng = mulberry32(seed * 6151 + stalk * 977 + 3);
      const base = reserve + ((stalk + 0.5 + (rng() - 0.5) * 0.45) / count) * (across - 2 * reserve);
      const baseS = Math.min(along * 0.015, 8) * rng();
      const len = Math.min(along - baseS, maxLength * (1 - num(p.lengthVar, 0.28, 0, 0.8) * rng()));
      const phase = rng() * Math.PI * 2, lean = num(p.lean, 5, -200, 200) * (0.5 + rng() * 0.5);
      const sway = num(p.sway, 6, 0, 200) * (0.7 + rng() * 0.3);
      const stalkWidth = width * (0.7 + rng() * 0.3);
      const centre = s => {
        const t = s / len;
        const raw = lean * smooth(t) + sway * Math.sin(s / swayPeriod * Math.PI * 2 + phase) * smooth(t * 4)
          + roughness * 0.7 * (noise2(s / Math.max(12, step * 12), stalk * 3.1, seed) - 0.5) * smooth(t * 8);
        const room = raw >= 0 ? across - reserve - base : base - reserve;
        // A soft lateral limit preserves the full height instead of shortening
        // tilted reeds against the receipt's side edges.
        return [base + room * Math.tanh(raw / Math.max(0.01, room)), baseS + s];
      };
      const widthAt = s => stalkWidth * (1 - taper * smooth(s / len));
      const N = Math.max(2, Math.ceil(len / step));
      for (let k = 0; k < passes; k++) {
        const v = passes === 1 ? 0 : k / (passes - 1) - 0.5;
        const pts = Array.from({ length: N + 1 }, (_, i) => {
          const s = len * i / N, q = centre(s);
          return [q[0] + v * widthAt(s), q[1]];
        });
        if (k % 2) pts.reverse();
        emit(pts);
      }
      if (p.joints) {
        for (let s = jointSpacing * (0.6 + rng() * 0.35); s < len * 0.92; s += jointSpacing) {
          const [u, y] = centre(s), half = Math.min(reserve * 0.9, widthAt(s) * 0.9 + 0.35);
          emit([[u - half, y], [u, y + Math.min(0.5, len - s)], [u + half, y]]);
        }
      }
      if (p.leaves) {
        let side = rng() < 0.5 ? -1 : 1;
        for (let s = leafSpacing * (0.4 + rng() * 0.5); s < len * 0.82; s += leafSpacing) {
          side *= -1;
          const [u, y] = centre(s), room = side > 0 ? across - u : u;
          const wantedWidth = Math.min(leafWidth * (0.6 + rng() * 0.4), room * 0.25);
          const reach = Math.min(room - wantedWidth, leafLength * (0.14 + rng() * 0.12));
          const w = Math.min(wantedWidth, reach * 0.8, u * 1.8, (across - u) * 1.8);
          const rise = Math.min(len - s, leafLength * (0.7 + rng() * 0.3));
          if (reach < 0.2 || rise < 1) continue;
          const M = Math.max(8, Math.min(32, Math.ceil(rise / 4)));
          const leaf = (t, edge) => [u + side * reach * (2 * t - t * t) + edge * w * Math.sin(Math.PI * t) / 2, y + rise * t];
          const outline = [];
          for (let i = 0; i <= M; i++) outline.push(leaf(i / M, 1));
          for (let i = M - 1; i > 0; i--) outline.push(leaf(i / M, -1));
          emit(outline, detailPen, true);
          if (p.leafVeins) emit(Array.from({ length: M + 1 }, (_, i) => leaf(i / M, 0)), detailPen);
        }
      }
      const headLen = Math.min(headLength, len * 0.22);
      const half = Math.min(headWidth / 2, reserve * 0.85);
      if (p.head === "Cattail") {
        // Parallel tapered rails draw the club in ink, not as a screen fill.
        for (let k = 0; k < 7; k++) {
          const v = k / 6 * 2 - 1, pts = [];
          for (let i = 0; i <= 32; i++) {
            const t = i / 32, s = len - headLen + t * headLen, q = centre(s);
            pts.push([q[0] + v * half * Math.min(1, Math.sin(Math.PI * t) * 4), q[1]]);
          }
          emit(pts, detailPen);
        }
      } else if (p.head !== "None") {
        for (let i = 0; i < 18; i++) {
          const t = (i + 0.5) / 18, s = len - headLen + t * headLen, q = centre(s);
          const fan = Math.sin(Math.PI * t) ** 0.7 * half;
          for (const side of [-1, 1]) {
            const reach = fan * (0.6 + rng() * 0.4), rise = Math.min(len - s, headLen * (0.1 + rng() * 0.13));
            const mid = [q[0] + side * reach * 0.65, q[1] + rise * 0.4], tip = [q[0] + side * reach, q[1] + rise];
            emit([q, mid, tip], detailPen);
            emit([mid, [mid[0] + side * reach * 0.2, mid[1] + rise * 0.5]], detailPen);
          }
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
