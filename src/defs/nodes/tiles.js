import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "tiles",
  name: "Tiles",
  cat: "gen",
  group: "geometric",
  desc: "Grid of tiles, each a separate closed path: parametric Superellipse, Circle, Triangle, Hexagon, Star, Reuleaux or Cross, with per-tile rotation and jitter. Layout: Grid, Brick (odd rows offset half a cell) or Hex pack (offset rows at 0.866 pitch - circles and hexagons at Size 100 touch their neighbours). Alternate flip rotates every other tile 180 degrees so triangles tessellate. The natural Explosion input.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 40, step: 1, def: 10 },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 40, step: 1, def: 7 },
    { key: "layout", label: "Layout", type: "select", options: ["Grid", "Brick (offset rows)", "Hex pack"], def: "Grid" },
    { key: "flipAlt", label: "Alternate flip (triangles)", type: "check", def: false },
    { key: "shape", label: "Shape", type: "select", options: ["Superellipse", "Circle", "Triangle", "Hexagon", "Star", "Reuleaux", "Cross"], def: "Superellipse" },
    { key: "superN", label: "Superellipse N", type: "slider", min: 0.4, max: 8, step: 0.05, def: 2.5 },
    { key: "sizeX", label: "Size X %", type: "slider", min: 10, max: 100, step: 1, def: 78 },
    { key: "sizeY", label: "Size Y % (0 = same)", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "starPts", label: "Star points", type: "slider", min: 3, max: 12, step: 1, def: 5 },
    { key: "starIn", label: "Star inner %", type: "slider", min: 10, max: 90, step: 1, def: 45 },
    { key: "rot", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "rotJit", label: "Rotation jitter °", type: "slider", min: 0, max: 180, step: 1, def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 101 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const m = p.margin;
    const cols = Math.round(p.cols), rows = Math.round(p.rows);
    const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
    const rng = mulberry32(p.seed * 3169 + 61);
    const a = (cw / 2) * (p.sizeX / 100);
    const b = (ch / 2) * ((p.sizeY > 0 ? p.sizeY : p.sizeX) / 100);
    /* muodon pisteet yksikkokoossa (a,b sisaan skaalattuna) */
    const shapePts = () => {
      const pts = [];
      if (p.shape === "Superellipse") {
        /* |x/a|^n + |y/b|^n = 1 : N 1 = timantti, 2 = ellipsi, iso = suorakulmio, <1 = astroidi */
        const e = 2 / Math.max(0.05, p.superN);
        for (let k = 0; k < 64; k++) {
          const t = (k / 64) * Math.PI * 2;
          const c = Math.cos(t), s = Math.sin(t);
          pts.push([
            a * Math.sign(c) * Math.pow(Math.abs(c), e),
            b * Math.sign(s) * Math.pow(Math.abs(s), e),
          ]);
        }
      } else if (p.shape === "Circle") {
        for (let k = 0; k < 48; k++) {
          const t = (k / 48) * Math.PI * 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Triangle") {
        for (let k = 0; k < 3; k++) {
          const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Hexagon") {
        for (let k = 0; k < 6; k++) {
          const t = (k / 6) * Math.PI * 2;
          pts.push([a * Math.cos(t), b * Math.sin(t)]);
        }
      } else if (p.shape === "Star") {
        const n = Math.round(p.starPts);
        for (let k = 0; k < n * 2; k++) {
          const t = (k / (n * 2)) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? 1 : p.starIn / 100;
          pts.push([a * rr * Math.cos(t), b * rr * Math.sin(t)]);
        }
      } else if (p.shape === "Reuleaux") {
        /* kolme kaarta, keskukset kolmion vastakkaisissa karjissa */
        const V = [0, 1, 2].map((k) => {
          const t = (k / 3) * Math.PI * 2 - Math.PI / 2;
          return [Math.cos(t), Math.sin(t)];
        });
        const R = Math.hypot(V[1][0] - V[0][0], V[1][1] - V[0][1]);
        for (let k = 0; k < 3; k++) {
          const c = V[k];
          const a1 = Math.atan2(V[(k + 1) % 3][1] - c[1], V[(k + 1) % 3][0] - c[0]);
          const a2 = Math.atan2(V[(k + 2) % 3][1] - c[1], V[(k + 2) % 3][0] - c[0]);
          let d = a2 - a1;
          while (d < 0) d += Math.PI * 2;
          for (let q = 0; q < 12; q++) {
            const t = a1 + (q / 12) * d;
            pts.push([(c[0] + Math.cos(t) * R) * a * 0.62, (c[1] + Math.sin(t) * R) * b * 0.62]);
          }
        }
      } else {
        /* Cross: risti */
        const t = 0.36;
        const cr = [
          [-t, -1], [t, -1], [t, -t], [1, -t], [1, t], [t, t],
          [t, 1], [-t, 1], [-t, t], [-1, t], [-1, -t], [-t, -t],
        ];
        for (const [x, y] of cr) pts.push([x * a, y * b]);
      }
      return pts;
    };
    const base = shapePts();
    const hexPack = p.layout === "Hex pack";
    const brick = p.layout === "Brick (offset rows)";
    const pitch = hexPack ? ch * 0.866 : ch;
    const totalH = (rows - 1) * pitch + ch;
    const oy0 = hexPack ? m + Math.max(0, (H - 2 * m - totalH) / 2) : m;
    const paths = [];
    for (let r = 0; r < rows; r++) {
      const off = (brick || hexPack) && r % 2 === 1;
      const nC = off ? Math.max(1, cols - 1) : cols;
      for (let c = 0; c < nC; c++) {
        const cx = m + (c + 0.5) * cw + (off ? cw / 2 : 0);
        const cy = oy0 + (hexPack ? r * pitch + ch / 2 : (r + 0.5) * ch);
        let ang = ((p.rot + (rng() - 0.5) * 2 * p.rotJit) * Math.PI) / 180;
        if (p.flipAlt && (r + c) % 2 === 1) ang += Math.PI;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        paths.push({
          pts: base.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]),
          closed: true,
          layer: L,
        });
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};