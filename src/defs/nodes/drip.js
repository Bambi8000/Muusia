import { Pin, EMPTY, mulberry32, signedArea } from "../helpers.js";

export default {
  key: "drip", name: "Drip", cat: "mod", group: "deform",
  desc: "Grow hanging ink drips from any incoming path drawing. Open strokes drip along their length; closed shapes drip from the edges facing Flow direction by default. Round makes a narrow-necked, bulb-ended contour; Pointed makes a sharp tapered drip; Thread makes a single flowing line. Cross hatch fills Round or Pointed drops with two clipped line directions; spacing, angle, inset and an optional separate pen control the fill. Spacing, Density, Length, Variation, Width, Sway and Seed shape the rhythm. Keep source includes the original paths in Result; Drips outputs only the new marks for further effects. Clip to margin bounds the added drips without changing the incoming drawing.",
  ins: [Pin("paths", "Source")],
  outs: [Pin("paths", "Result"), Pin("paths", "Drips")],
  params: [
    { key: "style", label: "Drip shape", type: "select", options: ["Round", "Pointed", "Thread"], def: "Round" },
    { key: "edge", label: "Closed shape edge", type: "select", options: ["Facing flow", "All edges"], def: "Facing flow" },
    { key: "spacing", label: "Spacing mm", type: "slider", min: 4, max: 40, step: .5, def: 12 },
    { key: "density", label: "Density %", type: "slider", min: 0, max: 100, step: 1, def: 88 },
    { key: "length", label: "Length mm", type: "slider", min: 3, max: 100, step: 1, def: 28 },
    { key: "variation", label: "Length variation %", type: "slider", min: 0, max: 100, step: 1, def: 65 },
    { key: "width", label: "Width mm", type: "slider", min: .5, max: 16, step: .5, def: 5, showIf: p => p.style !== "Thread" },
    { key: "fill", label: "Drop fill", type: "select", options: ["None", "Cross hatch"], def: "None", showIf: p => p.style !== "Thread" },
    { key: "hatchSpacing", label: "Hatch spacing mm", type: "slider", min: .5, max: 8, step: .1, def: 1.7, showIf: p => p.style !== "Thread" && p.fill === "Cross hatch" },
    { key: "hatchAngle", label: "Hatch angle °", type: "slider", min: 0, max: 180, step: 1, def: 45, showIf: p => p.style !== "Thread" && p.fill === "Cross hatch" },
    { key: "hatchInset", label: "Hatch inset mm", type: "slider", min: 0, max: 2, step: .1, def: .3, showIf: p => p.style !== "Thread" && p.fill === "Cross hatch" },
    { key: "hatchOwnPen", label: "Separate hatch pen", type: "check", def: false, showIf: p => p.style !== "Thread" && p.fill === "Cross hatch" },
    { key: "hatchPen", label: "Hatch pen", type: "pen", def: 1, showIf: p => p.style !== "Thread" && p.fill === "Cross hatch" && !!p.hatchOwnPen },
    { key: "direction", label: "Flow direction °", type: "slider", min: 0, max: 360, step: 1, def: 90 },
    { key: "sway", label: "Sway mm", type: "slider", min: 0, max: 20, step: .5, def: 3 },
    { key: "keep", label: "Keep source", type: "check", def: true },
    { key: "clip", label: "Clip drips to margin", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 8, showIf: p => !!p.clip },
    { key: "seed", label: "Seed", type: "seed", def: 37 },
  ],
  _settings(p, c) {
    const W = +c?.W, H = +c?.H;
    if (!(Number.isFinite(W) && Number.isFinite(H) && W > 2 && H > 2)) return null;
    const n = (key, def, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+p[key]) ? +p[key] : def));
    const angle = n("direction", 90, -3600, 3600) * Math.PI / 180;
    const margin = p.clip ? n("margin", 8, 0, Math.max(0, Math.min(W, H) / 2 - 1)) : 0;
    return { W, H, margin, dx: Math.cos(angle), dy: Math.sin(angle),
      spacing: n("spacing", 12, 2, 100), density: n("density", 88, 0, 100) / 100,
      length: n("length", 28, 1, 250), variation: n("variation", 65, 0, 100) / 100,
      width: n("width", 5, .2, 50), sway: n("sway", 3, 0, 80),
      hatchSpacing: n("hatchSpacing", 1.7, .35, 20),
      hatchAngle: n("hatchAngle", 45, -3600, 3600),
      hatchInset: n("hatchInset", .3, 0, 5),
      hatchPen: Math.round(n("hatchPen", 1, 0, 11)),
      seed: Math.round(n("seed", 37, -1e9, 1e9)),
      style: ["Round", "Pointed", "Thread"].includes(p.style) ? p.style : "Round",
      edge: p.edge === "All edges" ? "All edges" : "Facing flow" };
  },
  overlay(p, c) {
    const s = this._settings(p, c);
    if (!s) return [];
    const x = s.W / 2, y = s.H / 2, out = [];
    if (p.clip) out.push({ kind: "rect", x: s.margin, y: s.margin, w: s.W - 2 * s.margin, h: s.H - 2 * s.margin });
    out.push({ kind: "arrow", x1: x - 12 * s.dx, y1: y - 12 * s.dy, x2: x + 12 * s.dx, y2: y + 12 * s.dy });
    return out;
  },
  compute(ins, p, c) {
    const s = this._settings(p, c), source = ins?.[0] || EMPTY;
    if (!s || !Array.isArray(source.paths) || source.paths.length > 10000) return [EMPTY, EMPTY];
    const original = [], drips = [];
    let inputPoints = 0, dripPoints = 0, dripCount = 0, hatchRows = 0;
    const crossHatch = p.fill === "Cross hatch" && s.style !== "Thread";
    const hatchContour = (polygon, sourceLayer) => {
      const filled = [];
      const layer = p.hatchOwnPen ? s.hatchPen : sourceLayer;
      for (const degrees of [s.hatchAngle, s.hatchAngle + 90]) {
        const angle = degrees * Math.PI / 180, ca = Math.cos(angle), sa = Math.sin(angle);
        const rotated = polygon.map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca]);
        let minY = Infinity, maxY = -Infinity;
        for (const q of rotated) { minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
        const start = Math.ceil((minY + 1e-7) / s.hatchSpacing) * s.hatchSpacing;
        for (let y = start, row = 0; y < maxY - 1e-7; y += s.hatchSpacing, row++) {
          if (++hatchRows > 60000) return null;
          const xs = [];
          for (let i = 0, j = rotated.length - 1; i < rotated.length; j = i++) {
            const a = rotated[i], b = rotated[j];
            if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
          }
          xs.sort((a, b) => a - b);
          for (let i = 0; i + 1 < xs.length; i += 2) {
            const x0 = xs[i] + s.hatchInset, x1 = xs[i + 1] - s.hatchInset;
            if (x1 - x0 < .35) continue;
            const a = row % 2 ? x1 : x0, b = row % 2 ? x0 : x1;
            const back = x => [x * ca - y * sa, x * sa + y * ca];
            filled.push({ pts: [back(a), back(b)], closed: false, layer });
            if (filled.length > 50000 || dripPoints + filled.length * 2 + (p.keep ? inputPoints : 0) > 118000) return null;
          }
        }
      }
      return filled;
    };
    for (let pi = 0; pi < source.paths.length; pi++) {
      const path = source.paths[pi];
      if (!Array.isArray(path?.pts)) return [EMPTY, EMPTY];
      const pts = path.pts;
      inputPoints += pts.length;
      if (inputPoints > 120000) return [EMPTY, EMPTY];
      if (pts.some(q => !q || !Number.isFinite(+q[0] + +q[1]))) return [EMPTY, EMPTY];
      const layer = Math.max(0, Math.min(11, Math.round(Number.isFinite(+path.layer) ? +path.layer : 0)));
      if (p.keep && pts.length >= 2) original.push({ pts: pts.map(q => q.slice()), closed: !!path.closed, layer });
      if (pts.length < 2 || (path.closed && pts.length < 3)) continue;
      const closed = !!path.closed;
      const segmentCount = closed ? pts.length : pts.length - 1;
      const lengths = [];
      let total = 0;
      for (let i = 0; i < segmentCount; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        lengths.push(len); total += len;
      }
      if (total > 1e7) return [EMPTY, EMPTY];
      if (!(total >= s.spacing * .6) || s.density === 0) continue;
      if (Math.ceil(total / (s.spacing * .68)) + dripCount > 2400) return [EMPTY, EMPTY];
      const orientation = closed && signedArea(pts) < 0 ? -1 : 1;
      const rng = mulberry32((s.seed + pi * 1299721) >>> 0);
      let distance = s.spacing * (.4 + .25 * rng()), seg = 0, before = 0;
      while (distance < total) {
        while (seg < lengths.length - 1 && before + lengths[seg] < distance) { before += lengths[seg]; seg++; }
        const a = pts[seg], b = pts[(seg + 1) % pts.length], len = lengths[seg];
        if (len > 1e-9) {
          const tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
          const face = orientation * (ty * s.dx - tx * s.dy);
          const t = (distance - before) / len, ax = a[0] + (b[0] - a[0]) * t, ay = a[1] + (b[1] - a[1]) * t;
          const take = rng() < s.density;
          const lengthRand = rng(), widthRand = rng(), swayRand = rng();
          if (take && (!closed || s.edge === "All edges" || face > .15) &&
            (!p.clip || (ax >= s.margin && ax <= s.W - s.margin && ay >= s.margin && ay <= s.H - s.margin))) {
            if (++dripCount > 2400) return [EMPTY, EMPTY];
            const L = s.length * (1 - .5 * s.variation + 1.5 * s.variation * Math.pow(lengthRand, 3));
            const width = s.width * (.8 + .4 * widthRand);
            const sway = s.sway * (2 * swayRand - 1);
            const px = -s.dy, py = s.dx;
            const alignment = tx * px + ty * py >= 0 ? 1 : -1;
            const point = (u, side, half) => {
              const drift = sway * u * u * (3 - 2 * u);
              let x = ax + s.dx * L * u + px * drift;
              let y = ay + s.dy * L * u + py * drift;
              if (side) {
                const blend = Math.min(1, u * 5);
                const vx = tx * (1 - blend) + px * alignment * blend;
                const vy = ty * (1 - blend) + py * alignment * blend;
                const vl = Math.hypot(vx, vy) || 1;
                x += side * half * vx / vl; y += side * half * vy / vl;
              }
              if (p.clip) { x = Math.max(s.margin, Math.min(s.W - s.margin, x)); y = Math.max(s.margin, Math.min(s.H - s.margin, y)); }
              return [x, y];
            };
            let out;
            if (s.style === "Thread") {
              out = Array.from({ length: 13 }, (_, i) => point(i / 12, 0, 0));
            } else {
              const U = [0,.12,.24,.36,.48,.6,.7,.78,.85,.91,.96,1];
              const half = u => s.style === "Pointed"
                ? width * .5 * (1 - u)
                : width * .5 * (.25 + 1.35 * Math.exp(-Math.pow((u - .82) / .19, 2))) * Math.pow(1 - u, .42);
              out = U.map(u => point(u, -1, half(u)));
              for (let i = U.length - 2; i >= 0; i--) out.push(point(U[i], 1, half(U[i])));
            }
            const clean = [];
            for (const q of out) if (!clean.length || Math.hypot(q[0] - clean[clean.length-1][0], q[1] - clean[clean.length-1][1]) > .05) clean.push(q);
            if (clean.length >= 2) {
              drips.push({ pts: clean, closed: false, layer }); dripPoints += clean.length;
              if (crossHatch && clean.length >= 3) {
                const filled = hatchContour(clean, layer);
                if (!filled) return [EMPTY, EMPTY];
                drips.push(...filled);
                dripPoints += filled.length * 2;
              }
            }
            if (dripPoints + (p.keep ? inputPoints : 0) > 118000) return [EMPTY, EMPTY];
          }
        }
        distance += s.spacing * (.68 + .64 * rng());
      }
    }
    if (dripPoints + (p.keep ? inputPoints : 0) > 118000) return [EMPTY, EMPTY];
    const dripSet = { paths: drips };
    return [{ paths: original.concat(drips) }, dripSet];
  },
};
