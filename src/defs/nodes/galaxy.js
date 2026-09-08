import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  /* Galaxy — a procedural spiral galaxy as a rotatable 3D point cloud.
     Deterministic from Seed: an exponential disc winds Arms logarithmic
     spiral arms (Twist turns, Arm spread scatter), a 3D gaussian bulge sits
     in the core, a sparse spherical halo surrounds it, and the thin disc has
     a gaussian Thickness. Dots are plotted as small rings (Point Cloud
     convention) with three pens: Core pen for bulge + halo, Arm pen for the
     disc, Sparkle pen for a Sparkle % of arm stars (young clusters, drawn
     slightly larger). Yaw / Pitch rotate the world, Perspective foreshortens,
     and scaling is rotation-invariant (bounding sphere), so wiring the
     animation Frame into Yaw orbits the galaxy without size jumps. */
  key: "galaxy",
  name: "Galaxy",
  cat: "gen",
  group: "scientific",
  desc: "A spiral galaxy as a rotatable 3D point cloud, deterministic from Seed. Stars sets the dot count, Arms and Twist wind the logarithmic spiral arms, Arm spread scatters stars around them, Bulge % and Bulge size fill the core with a 3D gaussian ball, Thickness sets the disc's vertical depth and Halo % sprinkles a sparse spherical halo. Three pens make it multicoloured: Core pen draws the bulge and halo, Arm pen the disc stars, and Sparkle % of arm stars land on Sparkle pen slightly enlarged - young star clusters along the arms. Core glow enlarges dots toward the centre. Yaw and Pitch rotate the whole galaxy in 3D (pitch 90 is face-on, 0 is edge-on), Perspective adds depth foreshortening, and the size is rotation-invariant, so wire the animation Frame into Yaw and the galaxy orbits smoothly. Dot shape picks the plotted mark: Circle (small ring sized by Dot mm), Dash (a short stroke streaking along the galactic rotation - star-trail look), or Point (a minimal 0.1 mm pen poke).",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "stars", label: "Stars", type: "slider", min: 200, max: 4000, step: 50, def: 1400 },
    { key: "arms", label: "Arms", type: "slider", min: 2, max: 6, step: 1, def: 3 },
    { key: "twist", label: "Twist", type: "slider", min: 0.5, max: 4, step: 0.1, def: 2.2 },
    { key: "armw", label: "Arm spread", type: "slider", min: 0.05, max: 0.6, step: 0.01, def: 0.18 },
    { key: "bulge", label: "Bulge %", type: "slider", min: 0, max: 60, step: 1, def: 25 },
    { key: "bulger", label: "Bulge size %", type: "slider", min: 5, max: 40, step: 1, def: 16 },
    { key: "flat", label: "Thickness %", type: "slider", min: 1, max: 40, step: 1, def: 6 },
    { key: "halo", label: "Halo %", type: "slider", min: 0, max: 15, step: 1, def: 4 },
    { key: "yaw", label: "Yaw \u00b0", type: "slider", min: 0, max: 360, step: 1, def: 30 },
    { key: "pitch", label: "Pitch \u00b0", type: "slider", min: -90, max: 90, step: 1, def: 55 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
    { key: "size", label: "Size %", type: "slider", min: 20, max: 120, step: 1, def: 85 },
    { key: "dot", label: "Dot mm", type: "slider", min: 0.3, max: 3, step: 0.1, def: 0.6 },
    { key: "shape", label: "Dot shape", type: "select", options: ["Circle", "Dash", "Point"], def: "Circle" },
    { key: "grow", label: "Core glow", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "sparkle", label: "Sparkle %", type: "slider", min: 0, max: 40, step: 1, def: 12 },
    { key: "corepen", label: "Core pen", type: "pen", def: 1 },
    { key: "armpen", label: "Arm pen", type: "pen", def: 0 },
    { key: "sparklepen", label: "Sparkle pen", type: "pen", def: 2 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 42 },
  ],
  compute(ins, p, ctx) {
    const st = ins[0];
    const m = Math.max(0, p.margin);
    const W = ctx.W, Hh = ctx.H;
    const bw = W - 2 * m, bh = Hh - 2 * m;
    if (bw < 4 || bh < 4) return applyStyle({ paths: [] }, st);
    const rng = mulberry32(p.seed);
    const gauss = () => {
      const u1 = Math.max(1e-12, rng()), u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };

    /* ---- generate stars in unit galaxy space (radius <= ~1.15) ---- */
    const nStars = Math.round(p.stars);
    const nBulge = Math.round((nStars * p.bulge) / 100);
    const nHalo = Math.round((nStars * p.halo) / 100);
    const nDisc = Math.max(0, nStars - nBulge - nHalo);
    const bulgeR = p.bulger / 100;
    const zSig = p.flat / 100;
    const arms = Math.round(p.arms);
    const pts = []; /* [x, y, z, kind, rn] kind: 0 core, 1 arm, 2 sparkle */
    for (let i = 0; i < nBulge; i++) {
      const x = gauss() * bulgeR, y = gauss() * bulgeR, z = gauss() * bulgeR * 0.8;
      const rr = Math.hypot(x, y, z);
      if (rr > bulgeR * 2.5) { i--; continue; }
      pts.push([x, y, z, 0, rr]);
    }
    for (let i = 0; i < nDisc; i++) {
      const rn = Math.pow(rng(), 0.55);
      const arm = Math.floor(rng() * arms);
      const base = (arm / arms) * 2 * Math.PI;
      const wind = p.twist * 2 * Math.PI * Math.sqrt(rn);
      const scatter = gauss() * p.armw * (0.5 + rn);
      const th = base + wind + scatter;
      const rr = rn * (1 + gauss() * 0.04);
      const x = rr * Math.cos(th), y = rr * Math.sin(th);
      const z = gauss() * zSig * (0.4 + 0.6 * (1 - rn));
      const kind = rng() * 100 < p.sparkle ? 2 : 1;
      pts.push([x, y, z, kind, rn]);
    }
    for (let i = 0; i < nHalo; i++) {
      const th = rng() * 2 * Math.PI, ph = Math.acos(2 * rng() - 1);
      const rr = 0.35 + 0.8 * Math.pow(rng(), 0.7);
      pts.push([rr * Math.sin(ph) * Math.cos(th), rr * Math.sin(ph) * Math.sin(th), rr * Math.cos(ph), 0, rr]);
    }
    if (!pts.length) return applyStyle({ paths: [] }, st);

    /* ---- rotate (yaw around z in-plane, pitch tilts the disc), project ---- */
    const ya = (p.yaw * Math.PI) / 180, pa = (p.pitch * Math.PI) / 180;
    const cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
    let sphere = 0;
    for (const q of pts) { const r2 = q[0] * q[0] + q[1] * q[1] + q[2] * q[2]; if (r2 > sphere) sphere = r2; }
    sphere = Math.sqrt(sphere) || 1;
    const rot = pts.map(([x0, y0, z0, kind, rn]) => {
      const rx = x0 * cy - y0 * sy, ry = x0 * sy + y0 * cy;
      const ry2 = ry * cp - z0 * sp, rz = ry * sp + z0 * cp;
      /* orbital tangent (-y, x, 0) through the same rotation, projected:
         Dash strokes streak along the galactic rotation */
      const tl = Math.hypot(x0, y0);
      let tsx = 1, tsy = 0;
      if (tl > 1e-9) {
        const txw = -y0 / tl, tyw = x0 / tl;
        const trx = txw * cy - tyw * sy, tryy = txw * sy + tyw * cy;
        const trz = tryy * sp;
        const sl = Math.hypot(trx, -trz);
        if (sl > 1e-6) { tsx = trx / sl; tsy = -trz / sl; }
      }
      return [rx, ry2, rz, kind, rn, tsx, tsy];
    });
    let dLo = Infinity, dHi = -Infinity;
    for (const q of rot) { if (q[1] < dLo) dLo = q[1]; if (q[1] > dHi) dHi = q[1]; }
    const dRange = dHi - dLo || 1;
    const sc = (Math.min(bw, bh) / 2) * Math.max(0.05, p.size / 100) / sphere;
    const cx = W / 2, cyc = Hh / 2;

    /* ---- dots as small rings, pens by kind ---- */
    const BUDGET = 110000;
    let total = 0;
    const paths = [];
    const penOf = [Math.round(p.corepen), Math.round(p.armpen), Math.round(p.sparklepen)];
    for (const [x, d, z, kind, rn, tsx, tsy] of rot) {
      const dn = (d - dLo) / dRange;
      const ps = 1 / (1 + p.persp * dn * 1.4);
      const sx = x * ps * sc + cx, sy2 = -z * ps * sc + cyc;
      let r = (p.dot / 2) * (1 + p.grow * 1.6 * Math.exp(-rn / 0.3)) * (0.8 + 0.4 * rng());
      if (kind === 2) r *= 1.35;
      r = Math.max(0.15, r * ps);
      const rc = p.shape === "Point" ? 0.15 : r;
      if (sx < m + rc || sx > W - m - rc || sy2 < m + rc || sy2 > Hh - m - rc) continue;
      if (p.shape === "Dash") {
        if (total + 2 > BUDGET) break;
        paths.push({ pts: [[sx - tsx * r, sy2 - tsy * r], [sx + tsx * r, sy2 + tsy * r]], closed: false, layer: penOf[kind] });
        total += 2;
      } else if (p.shape === "Point") {
        if (total + 2 > BUDGET) break;
        paths.push({ pts: [[sx, sy2], [sx + 0.1, sy2]], closed: false, layer: penOf[kind] });
        total += 2;
      } else {
        const segs = r * 2 >= 1 ? 8 : 5;
        if (total + segs > BUDGET) break;
        const ring = [];
        for (let k2 = 0; k2 < segs; k2++) {
          const a = (k2 / segs) * Math.PI * 2;
          ring.push([sx + Math.cos(a) * r, sy2 + Math.sin(a) * r]);
        }
        paths.push({ pts: ring, closed: true, layer: penOf[kind] });
        total += segs;
      }
    }
    return applyStyle({ paths }, st);
  },
};
