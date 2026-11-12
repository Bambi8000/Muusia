import { Pin, EMPTY, mulberry32, hash2, noise2, applyStyle, fontStrokes } from "../helpers.js";

const num = (v, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : fallback));
const path = (pts, layer, closed = false) => ({ pts, closed, layer });

function roundedRectPoints(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  const pts = [];
  for (const [cx, cy, start] of [
    [x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI],
  ]) {
    for (let i = 0; i <= 8; i++) {
      const a = start + i * Math.PI / 16;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

function roundedRect(paths, x, y, w, h, radius, layer) {
  paths.push(path(roundedRectPoints(x, y, w, h, radius), layer, true));
}

function insideRounded(x, y, b) {
  const cx = Math.max(b.x + b.r, Math.min(b.x + b.w - b.r, x));
  const cy = Math.max(b.y + b.r, Math.min(b.y + b.h - b.r, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= b.r ** 2;
}

function clipSegment(a, b, polygon) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let lo = 0, hi = 1;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const side = ex * (a[1] - p[1]) - ey * (a[0] - p[0]);
    const slope = ex * dy - ey * dx;
    if (Math.abs(slope) < 1e-12) {
      if (side < -1e-9) return null;
      continue;
    }
    const t = -side / slope;
    if (slope > 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return null;
  }
  if (hi - lo < 1e-9) return null;
  return [[a[0] + dx * lo, a[1] + dy * lo], [a[0] + dx * hi, a[1] + dy * hi]];
}

function drawProgram(paths, source, W, H, screen, layer) {
  if (!source?.paths?.length) return;
  const polygon = roundedRectPoints(screen.x, screen.y, screen.w, screen.h, screen.r);
  const inset = Math.min(0.7, screen.r * 0.12);
  const scale = Math.min((screen.w - 2 * inset) / W, (screen.h - 2 * inset) / H);
  if (!(scale > 0)) return;
  const map = ([x, y]) => [
    screen.x + screen.w / 2 + (x - W / 2) * scale,
    screen.y + screen.h / 2 + (y - H / 2) * scale,
  ];
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-7;
  for (const original of source.paths) {
    if (!Array.isArray(original.pts) || original.pts.length < 2) continue;
    const mapped = original.pts.filter(pt => Array.isArray(pt) && Number.isFinite(+pt[0]) && Number.isFinite(+pt[1])).map(map);
    if (mapped.length < 2) continue;
    const pen = Number.isFinite(+original.layer) ? Math.round(+original.layer) : layer;
    if (mapped.every(([x, y]) => insideRounded(x, y, screen))) {
      paths.push({ ...original, pts: mapped, layer: pen });
      continue;
    }
    let run = [];
    const flush = () => {
      if (run.length > 1) paths.push({ ...original, pts: run, closed: false, layer: pen });
      run = [];
    };
    const count = original.closed ? mapped.length : mapped.length - 1;
    for (let i = 0; i < count; i++) {
      const clipped = clipSegment(mapped[i], mapped[(i + 1) % mapped.length], polygon);
      if (!clipped) { flush(); continue; }
      if (run.length && !near(run.at(-1), clipped[0])) flush();
      if (!run.length) run.push(clipped[0]);
      if (!near(run.at(-1), clipped[1])) run.push(clipped[1]);
    }
    flush();
  }
}

function drawBlackout(paths, screen, layer) {
  const pitch = 0.24; // Slightly overlaps Muusia's 0.3 mm preview stroke.
  const lines = Math.max(1, Math.ceil(screen.h / pitch));
  for (let i = 0; i < lines; i++) {
    const y = screen.y + (i + 0.5) * screen.h / lines;
    const dy = Math.max(0, screen.r - Math.min(y - screen.y, screen.y + screen.h - y));
    const inset = dy > 0 ? screen.r - Math.sqrt(Math.max(0, screen.r ** 2 - dy ** 2)) : 0;
    paths.push(path([[screen.x + inset, y], [screen.x + screen.w - inset, y]], layer));
  }
}

function drawPatentTV(paths, W, H, margin, layer) {
  const s = Math.min((W - 2 * margin) / 240, (H - 2 * margin) / 180);
  if (!(s > 0)) return null;
  const ox = (W - 240 * s) / 2, oy = (H - 180 * s) / 2;
  const pt = (x, y) => [ox + x * s, oy + y * s];
  const poly = (points, closed = false) => paths.push(path(points.map(([x, y]) => pt(x, y)), layer, closed));
  const line = (x1, y1, x2, y2) => poly([[x1, y1], [x2, y2]]);
  const box = (x, y, w, h, r) => roundedRect(paths, ox + x * s, oy + y * s, w * s, h * s, r * s, layer);
  const circle = (cx, cy, r) => poly(Array.from({ length: 32 }, (_, i) => {
    const a = i * Math.PI * 2 / 32;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }), true);
  const label = (text, x, y, size = 4) => {
    const glyphs = fontStrokes(text, size * s, 1);
    for (const stroke of glyphs.strokes) {
      paths.push(path(stroke.map(([gx, gy]) => [ox + x * s + gx, oy + y * s + gy]), layer));
    }
  };

  // Front elevation of a tabletop tube set, with a recessed glass face.
  box(20, 30, 198, 119, 13);
  box(24, 34, 190, 111, 10);
  box(33, 43, 131, 91, 12);
  box(37, 47, 123, 83, 9);
  box(40, 50, 117, 77, 7);
  line(169, 43, 169, 134);
  for (const cy of [66, 98]) {
    circle(190, cy, 11); circle(190, cy, 7.5); circle(190, cy, 1.2);
    line(190, cy - 7, 190, cy - 10);
  }
  for (let i = 0; i < 7; i++) line(177 + i * 4.3, 120, 177 + i * 4.3, 133);
  for (const [x, y] of [[30, 39], [207, 39], [30, 140], [207, 140]]) circle(x, y, 1);
  poly([[45, 149], [66, 149], [63, 157], [48, 157]], true);
  poly([[172, 149], [193, 149], [190, 157], [175, 157]], true);

  // Numbered leader lines and figure caption give the drawing its patent-plate syntax.
  poly([[31, 57], [13, 50], [6, 50]]); label("10", 2, 43);
  poly([[151, 50], [164, 20], [179, 20]]); label("12", 180, 17);
  poly([[201, 66], [224, 62], [231, 62]]); label("14", 223, 55);
  poly([[198, 126], [224, 139], [231, 139]]); label("16", 223, 132);
  poly([[53, 153], [36, 164], [21, 164]]); label("18", 10, 158);
  line(70, 167, 170, 167); label("FIG. 1", 101, 173, 5);
  return { x: ox + 40 * s, y: oy + 50 * s, w: 117 * s, h: 77 * s, r: 7 * s };
}

export default {
  key: "tvnoise",
  name: "Noise",
  cat: "gen", group: "scientific",
  desc: "Animated analog-TV snow. Patent TV draws an antenna-free CRT illustration. Wire paths to Program to place a drawing on its rounded screen; Screen signal can show the program, snow or both. Black frame chance interrupts the signal with dense ink. Timeline follows ANIMATE; Manual selects a frame; Still holds the seed.",
  ins: [Pin("style", "Style"), Pin("paths", "Program")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Full sheet", "Patent TV"], def: "Full sheet" },
    { key: "motion", label: "Motion", type: "select", options: ["Timeline", "Manual", "Still"], def: "Timeline" },
    { key: "manualFrame", label: "Frame #", type: "slider", min: 0, max: 999, step: 1, def: 0, showIf: p => p.motion === "Manual" },
    { key: "signal", label: "Screen signal", type: "select", options: ["Auto", "Snow", "Program", "Program + snow"], def: "Auto", showIf: p => p.mode === "Patent TV" },
    { key: "blackoutChance", label: "Black frame chance %", type: "slider", min: 0, max: 100, step: 1, def: 18, showIf: p => p.mode === "Patent TV" },
    { key: "shape", label: "Pixel shape", type: "select", options: ["Square", "Circle", "Dash (scanline)"], def: "Square" },
    { key: "cell", label: "Cell size mm", type: "slider", min: 0.8, max: 15, step: 0.1, def: 3 },
    { key: "density", label: "Density", type: "slider", min: 0.02, max: 1, step: 0.02, def: 0.3 },
    { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "posJit", label: "Position jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
    { key: "bands", label: "Interference bands", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 107 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const W = num(ctx?.W, 0, 0, 10000), H = num(ctx?.H, 0, 0, 10000);
    const margin = num(p.margin, 10, 0, 60);
    if (W <= 2 * margin || H <= 2 * margin) return EMPTY;
    const layer = Math.round(num(p.layer, 0, 0, 11));
    const paths = [];
    const tv = p.mode === "Patent TV";
    const screen = tv ? drawPatentTV(paths, W, H, margin, layer) : null;
    const b = screen || { x: margin, y: margin, w: W - 2 * margin, h: H - 2 * margin };
    const frames = Math.floor(num(ctx?.frameCount, 1, 1, 100000));
    const frame = p.motion === "Still" ? 0 : p.motion === "Manual"
      ? Math.round(num(p.manualFrame, 0, 0, 999))
      : Math.floor(num(ctx?.frameIdx, 0, 0, frames - 1));
    const baseSeed = Math.round(num(p.seed, 107, -1e9, 1e9));
    const seed = baseSeed + frame * 104729;
    const blackoutChance = num(p.blackoutChance, 18, 0, 100) / 100;
    const blackout = tv && (blackoutChance >= 1 || (frame > 0 && blackoutChance > 0
      && mulberry32((baseSeed ^ Math.imul(frame, 0x9e3779b9) ^ 0x5f3759df) | 0)() < blackoutChance));
    if (blackout) {
      drawBlackout(paths, screen, layer);
      return applyStyle({ paths }, ins[0]);
    }
    const program = ins[1];
    const hasProgram = !!program?.paths?.length;
    const signal = p.signal || "Auto";
    if (tv && hasProgram && (signal === "Auto" || signal === "Program" || signal === "Program + snow")) {
      drawProgram(paths, program, W, H, screen, layer);
    }
    const showSnow = !tv || signal === "Snow" || signal === "Program + snow" || (signal === "Auto" && !hasProgram);
    if (!showSnow) return applyStyle({ paths }, ins[0]);
    const cell = num(p.cell, 3, 0.5, 15);
    const cols = Math.min(400, Math.floor(b.w / cell));
    const rows = Math.min(400, Math.floor(b.h / cell));
    if (cols < 1 || rows < 1) return applyStyle({ paths }, ins[0]);
    const density = num(p.density, 0.3, 0, 1);
    const bands = num(p.bands, 0.3, 0, 1);
    const sizeVar = num(p.sizeVar, 0.5, 0, 1);
    const posJit = num(p.posJit, 0.4, 0, 1);
    let budget = 9000;
    for (let r = 0; r < rows && budget > 0; r++) {
      const band = bands > 0
        ? 1 - bands * (0.5 + 0.5 * Math.sin((r + frame * 1.7) * 0.7 + noise2(0.3, r * 0.13, seed + 7) * 6))
        : 1;
      for (let c = 0; c < cols && budget > 0; c++) {
        if (hash2(c, r, seed) > density * band) continue;
        const rng = mulberry32((r * 7919 + c) * 31 + seed);
        const sz = cell * 0.425 * (1 - sizeVar * rng());
        const x = b.x + (c + 0.5) * cell + (rng() - 0.5) * cell * posJit;
        const y = b.y + (r + 0.5) * cell + (rng() - 0.5) * cell * posJit;
        if (tv && !insideRounded(x, y, screen)) continue;
        let pts, closed;
        if (p.shape === "Circle") {
          const n = sz < 1 ? 6 : 10;
          pts = Array.from({ length: n }, (_, k) => {
            const a = k * Math.PI * 2 / n;
            return [x + Math.cos(a) * sz, y + Math.sin(a) * sz];
          });
          closed = true;
        } else if (p.shape === "Dash (scanline)") {
          const len = sz * (1.5 + rng() * 3);
          pts = [[x - len, y], [x + len, y]];
          closed = false;
        } else {
          pts = [[x - sz, y - sz], [x + sz, y - sz], [x + sz, y + sz], [x - sz, y + sz]];
          closed = true;
        }
        if (tv && !pts.every(([px, py]) => insideRounded(px, py, screen))) continue;
        paths.push(path(pts, layer, closed));
        budget--;
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
