import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "stipple",
  name: "Stipple",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  desc: "Organic adaptive stippling (the Kusama look): darkness sets each dot's SIZE, and dots pack until they almost touch, so dark areas become a honeycomb of large filled cells while light areas thin out to sparse specks. Dots are placed by seeded dart-throwing with a radius-aware spacing rule — never a grid. Dot min/max set the size range, Gap is the constant white web between neighbours, Light spread adds extra spacing as the image fades to white (sparse fringes), Wobble deforms circles into organic blobs, Fill pitch is the concentric-fill spacing (match your pen width for solid blacks). Quality raises the packing attempt budget: higher = tighter, slower.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "dotMin", label: "Dot min mm", type: "slider", min: 0.15, max: 3, step: 0.05, def: 0.35 },
    { key: "dotMax", label: "Dot max mm", type: "slider", min: 0.5, max: 8, step: 0.1, def: 2.8 },
    { key: "gap", label: "Gap mm", type: "slider", min: 0, max: 3, step: 0.05, def: 0.4 },
    { key: "spread", label: "Light spread mm", type: "slider", min: 0, max: 12, step: 0.25, def: 3 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.9, step: 0.01, def: 0.08 },
    { key: "invert", label: "Invert", type: "check", def: false },
    { key: "pitch", label: "Fill pitch mm", type: "slider", min: 0.2, max: 2, step: 0.05, def: 0.5 },
    { key: "quality", label: "Quality", type: "slider", min: 1, max: 8, step: 1, def: 3 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 421 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx, node) {
    const img = node && node.data && node.data.img;
    if (!img) return EMPTY;
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const boxW = W - 2 * m, boxH = H - 2 * m;
    if (boxW < 5 || boxH < 5) return EMPTY;
    /* sovita kuva marginaalilaatikkoon mittasuhteet sailyttaen (kuten image.js) */
    const sc = Math.min(boxW / img.w, boxH / img.h);
    const iw = img.w * sc, ih = img.h * sc;
    const x0 = (W - iw) / 2, y0 = (H - ih) / 2;
    const darkAt = (x, y) => {
      /* bilineaarinen naytteistys; kuvan ulkopuolella valkoista */
      const u = (x - x0) / sc, v = (y - y0) / sc;
      if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
      const ui = Math.floor(u), vi = Math.floor(v);
      const fu = u - ui, fv = v - vi;
      const g = img.g;
      const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
      const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
      let d = a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
      if (p.invert) d = 1 - d;
      return Math.pow(Math.max(0, Math.min(1, d)), p.gamma);
    };

    const rmin = Math.min(p.dotMin, p.dotMax);
    const rmax = Math.max(p.dotMin, p.dotMax);
    const gap = Math.max(0, p.gap);
    const spread = Math.max(0, p.spread);
    const cut = Math.min(0.98, p.cutoff);
    const wobAmp = p.wobble * 0.35; /* max sadepoikkeama osuutena sateesta */

    /* --- dart-throwing pakkaus: hilakiihdytys naapurihaulle --- */
    const cellSz = 2 * rmax + gap + spread; /* >= suurin mahdollinen vaadittu keskietaisyys */
    const grid = new Map();
    const gKey = (gx, gy) => gx + "," + gy;
    const dots = []; /* {x, y, r, ex} — ex = tama pisteen puolikas lisavali */
    const MAXD = 12000;
    const attempts = Math.round(p.quality) * 30000;
    const rng = mulberry32(p.seed * 977 + 13);

    for (let a = 0; a < attempts && dots.length < MAXD; a++) {
      const x = x0 + rng() * iw;
      const y = y0 + rng() * ih;
      const d = darkAt(x, y);
      if (d <= cut) continue;
      const t = (d - cut) / (1 - cut);
      const r = rmin + (rmax - rmin) * t;
      const ex = spread * (1 - t) * 0.5;
      /* pyoryla wobblen kanssa pysyttava kankaalla */
      const rw = r * (1 + wobAmp) + 0.2;
      if (x - rw < 0 || x + rw > W || y - rw < 0 || y + rw > H) continue;
      const gx = Math.floor(x / cellSz), gy = Math.floor(y / cellSz);
      let ok = true;
      for (let jy = gy - 1; jy <= gy + 1 && ok; jy++) {
        for (let jx = gx - 1; jx <= gx + 1 && ok; jx++) {
          const bucket = grid.get(gKey(jx, jy));
          if (!bucket) continue;
          for (const i of bucket) {
            const q = dots[i];
            const need = r + q.r + gap + ex + q.ex;
            const dx = x - q.x, dy = y - q.y;
            if (dx * dx + dy * dy < need * need) { ok = false; break; }
          }
        }
      }
      if (!ok) continue;
      const k = gKey(gx, gy);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(dots.length);
      dots.push({ x, y, r, ex });
    }

    /* --- piirto: jokainen pyoryla = sisakkaiset wobbleoidut renkaat (kiintea taytto) --- */
    const L = Math.round(p.layer);
    const pitch = Math.max(0.15, p.pitch);
    const paths = [];
    for (const dot of dots) {
      /* wobble naytteistetaan suljetulta silmukalta kohinakentassa -> sauma jatkuva */
      const wob = (ang) =>
        (noise2(dot.x * 0.37 + Math.cos(ang) * 1.7, dot.y * 0.37 + Math.sin(ang) * 1.7, p.seed) - 0.5) * 2;
      let rr = dot.r;
      let first = true;
      while (first || rr > pitch * 0.45) {
        const n = Math.max(10, Math.ceil((Math.PI * 2 * rr) / 0.5));
        const pts = [];
        const scale = rr / dot.r; /* sisarenkaat perivat muodon -> eivat leikkaa */
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * Math.PI * 2;
          const rad = rr * (1 + wob(ang) * wobAmp * (0.3 + 0.7 * scale));
          pts.push([dot.x + Math.cos(ang) * rad, dot.y + Math.sin(ang) * rad]);
        }
        paths.push({ pts, closed: true, layer: L });
        rr -= pitch;
        first = false;
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
