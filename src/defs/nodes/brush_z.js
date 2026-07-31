import { Pin, EMPTY, PENS, hash2, noise2, resample, pathLength } from "../helpers.js";

export default {
  key: "brush_z",
  name: "Brush Z",
  cat: "mod",
  group: "penout",
  desc: "Brush pressure modulation for a real Z axis: press down for a fat stroke, lift for a hairline. Encodes a Z value into every point (third component, millimetres below the profile's pen-down contact) that the G-code export turns into simultaneous Z moves \u2014 the brush breathes while it draws. Z min/max set the pressure band as fractions of Depth (mm of plunge at full press). Wave oscillates along each stroke's arc length: Sine, Triangle, Square, Pulse (with Duty), seeded Noise, Ramp up/down or Constant; Wavelength sets the period, Phase shifts it, Phase jitter and Amp jitter randomise per stroke, Noise adds seeded wobble on top of any wave. End taper eases pressure to zero at stroke ends for natural brush entry/exit (open paths only). Sample densifies points so the pressure curve is smooth. Ghost width draws a preview envelope of the stroke shape on its own pen (a visual aid \u2014 delete or keep). IMPORTANT: place this LAST in the chain; any modifier after it strips the Z data. Preview shows plain lines \u2014 the pressure lives in the export.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "zmin", label: "Z min", type: "slider", min: 0, max: 1, step: 0.01, def: 0.15 },
    { key: "zmax", label: "Z max", type: "slider", min: 0, max: 1, step: 0.01, def: 0.85 },
    { key: "depth", label: "Depth mm", type: "slider", min: 0.2, max: 5, step: 0.05, def: 1.5 },
    { key: "wave", label: "Wave", type: "select",
      options: ["Sine", "Triangle", "Square", "Pulse", "Noise", "Ramp up", "Ramp down", "Constant"],
      def: "Sine" },
    { key: "period", label: "Wavelength mm", type: "slider", min: 2, max: 100, step: 0.5, def: 25 },
    { key: "phase", label: "Phase", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "phaseJit", label: "Phase jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0.3 },
    { key: "ampJit", label: "Amp jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "noiseAmt", label: "Noise", type: "slider", min: 0, max: 1, step: 0.01, def: 0.15 },
    { key: "duty", label: "Pulse duty", type: "slider", min: 0.05, max: 0.95, step: 0.01, def: 0.3 },
    { key: "ends", label: "End taper mm", type: "slider", min: 0, max: 30, step: 0.5, def: 6 },
    { key: "sample", label: "Sample mm", type: "slider", min: 0.5, max: 4, step: 0.1, def: 1 },
    { key: "seed", label: "Seed", type: "seed", def: 2 },
    { key: "ghost", label: "Ghost width", type: "check", def: false },
    { key: "ghostW", label: "Ghost max width mm", type: "slider", min: 0.5, max: 8, step: 0.1, def: 3 },
    { key: "ghostPen", label: "Ghost pen", type: "pen", def: 6 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const seed = Math.round(p.seed);
    const zlo = Math.min(p.zmin, p.zmax);
    const zhi = Math.max(p.zmin, p.zmax);
    const depth = Math.max(0.05, p.depth);
    const period = Math.max(0.5, p.period);
    const step = Math.max(0.3, p.sample);
    const ghostPen = Math.round(p.ghostPen) % PENS.length;
    const frac = (t) => t - Math.floor(t);
    const paths = [];
    let budget = 112000;
    const push = (q) => {
      if (q.pts.length < 2 || budget <= 0) return;
      budget -= q.pts.length;
      paths.push(q);
    };

    src.paths.forEach((path, pi) => {
      if (path.pts.length < 2) { push({ ...path, pts: path.pts.map((q) => q.slice()) }); return; }
      const pts = resample(path.pts, path.closed, step);
      const total = pathLength(pts, path.closed);
      const ph0 = p.phase + p.phaseJit * hash2(pi, 1, seed);
      const zhiP = Math.max(zlo, zhi * (1 - 0.6 * p.ampJit * hash2(pi, 2, seed)));
      let s = 0;
      const zs = [];
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        const t = s / period + ph0;
        let v;
        if (p.wave === "Sine") v = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
        else if (p.wave === "Triangle") v = 1 - Math.abs(2 * frac(t) - 1);
        else if (p.wave === "Square") v = frac(t) < 0.5 ? 1 : 0;
        else if (p.wave === "Pulse") v = frac(t) < p.duty ? 1 : 0;
        else if (p.wave === "Noise") v = noise2(s * (2 / period), pi * 0.61 + 3, seed);
        else if (p.wave === "Ramp up") v = total > 0 ? s / total : 0;
        else if (p.wave === "Ramp down") v = total > 0 ? 1 - s / total : 1;
        else v = 1; // Constant
        if (p.noiseAmt > 0)
          v += (noise2(s * 0.11, pi * 0.37 + 9, seed + 7) - 0.5) * p.noiseAmt;
        v = Math.max(0, Math.min(1, v));
        let z = zlo + (zhiP - zlo) * v;
        if (!path.closed && p.ends > 0.1 && total > 0.5) {
          const e = Math.min(1, s / p.ends, (total - s) / p.ends);
          z *= Math.pow(Math.max(0, e), 0.7); // brush entry/exit
        }
        zs.push(z);
        out.push([pts[i][0], pts[i][1], z * depth]); // Z in mm below pen-down
      }
      push({ pts: out, closed: path.closed, layer: path.layer });

      /* ghost envelope: preview of the intended stroke width */
      if (p.ghost && out.length >= 2) {
        const wAt = (i) => 0.2 + zs[i] * Math.max(0, p.ghostW - 0.2);
        const n = out.length;
        const L = [], R = [];
        for (let i = 0; i < n; i++) {
          const a = out[Math.max(0, i - 1)], b = out[Math.min(n - 1, i + 1)];
          let dx = b[0] - a[0], dy = b[1] - a[1];
          const l = Math.hypot(dx, dy) || 1;
          dx /= l; dy /= l;
          const w2 = wAt(i) / 2;
          L.push([out[i][0] - dy * w2, out[i][1] + dx * w2]);
          R.push([out[i][0] + dy * w2, out[i][1] - dx * w2]);
        }
        if (path.closed) {
          push({ pts: L, closed: true, layer: ghostPen });
          push({ pts: R, closed: true, layer: ghostPen });
        } else {
          push({ pts: [...L, ...R.reverse()], closed: true, layer: ghostPen });
        }
      }
    });
    return { paths };
  },
};
