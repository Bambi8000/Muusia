import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  /* Blob Mesh — a procedural 3D blob built to be sliced. Body = 1-5 metaballs
     fused with a polynomial smooth-min, solved as a star-shaped radius R(dir)
     by bisection along each ray. A profile curve (preset or wired paths) then
     scales the radius along Z, and the surface is displaced by seam-free fBm
     built from three noise2 lookups on the direction vector, plus angular
     lobes and vertical waves. Outputs paths first so the node previews itself;
     the mesh rides on port 2 into Mesh Slice. */
  key: "blobmesh",
  name: "Blob Mesh",
  cat: "gen",
  group: "structural",
  desc: "Generates a plump 3D blob and hands it straight to Mesh Slice \u2014 no STL round-trip. The body is 1-5 metaballs fused by a smooth-min union, solved as a star-shaped radius per direction, so overlapping balls melt into one swollen mass rather than reading as separate spheres. Ball placement is either Seeded (Spread, Size variation \u2014 shuffle with the seed) or Manual, which exposes X/Y/Z and size per ball: drag a ball outwards and the surface stretches into a lobe after it, which is the direct way to sculpt an asymmetric form. Blend controls how far the balls melt together \u2014 at 0 they meet in a hard crease, high values swallow them into one mass. Radius X/Y/Z squashes the result from round to oval. Profile reshapes it further: presets (Egg, Pear, Hourglass, Barrel, Teardrop) or any paths wired into the Profile input, read either as a Cross-section (the outline becomes the horizontal shape \u2014 wire a Superformula star and the blob becomes star-shaped in plan) or as a Vertical profile (the outline's half-width becomes the radius at each height, the Sweep 3D convention). Profile amount blends the effect in \u2014 at 0 the profile does nothing at all, which is the usual reason a wired shape appears to be ignored. Surface distortion is three-layered and seeded: fBm noise along the normal (Noise amount, Noise scale, Octaves), angular Lobes and vertical Waves. Twist and Taper finish the form. Outputs: Wireframe (the ring/meridian cage at View angle/elevation, no hidden-line removal, every Nth line), Silhouette (the true outline \u2014 edges where a front face meets a back face, chained, so interior folds show too) and Mesh, which wires into the Mesh Slice Mesh input for slicing, negative primitives and rod holes. The mesh is centred and normalised exactly like an imported STL, so both sources slice identically. Keep Rings x Segments low while sculpting and raise it before slicing.",
  ins: [Pin("paths", "Profile"), Pin("style", "Style")],
  outs: [Pin("paths", "Wireframe"), Pin("paths", "Silhouette"), Pin("mesh", "Mesh")],
  params: [
    { key: "balls", label: "Balls", type: "slider", min: 1, max: 5, step: 1, def: 3 },
    { key: "ballMode", label: "Ball placement", type: "select", options: ["Seeded", "Manual"], def: "Seeded", showIf: (p) => p.balls > 1 },
    { key: "spread", label: "Spread %", type: "slider", min: 0, max: 100, step: 1, def: 30, showIf: (p) => p.balls > 1 && p.ballMode !== "Manual" },
    { key: "ballSize", label: "Ball size %", type: "slider", min: 20, max: 120, step: 1, def: 62 },
    { key: "sizeVar", label: "Size variation %", type: "slider", min: 0, max: 80, step: 1, def: 25, showIf: (p) => p.balls > 1 && p.ballMode !== "Manual" },
    { key: "blend", label: "Blend %", type: "slider", min: 0, max: 100, step: 1, def: 45, showIf: (p) => p.balls > 1 },
    { key: "bX1", label: "Ball 1 X %", type: "slider", min: -120, max: 120, step: 1, def: 0, showIf: (p) => p.balls >= 1 && p.ballMode === "Manual" },
    { key: "bY1", label: "Ball 1 Y %", type: "slider", min: -120, max: 120, step: 1, def: 0, showIf: (p) => p.balls >= 1 && p.ballMode === "Manual" },
    { key: "bZ1", label: "Ball 1 Z %", type: "slider", min: -120, max: 120, step: 1, def: 0, showIf: (p) => p.balls >= 1 && p.ballMode === "Manual" },
    { key: "bR1", label: "Ball 1 size %", type: "slider", min: 10, max: 150, step: 1, def: 100, showIf: (p) => p.balls >= 1 && p.ballMode === "Manual" },
    { key: "bX2", label: "Ball 2 X %", type: "slider", min: -120, max: 120, step: 1, def: 45, showIf: (p) => p.balls >= 2 && p.ballMode === "Manual" },
    { key: "bY2", label: "Ball 2 Y %", type: "slider", min: -120, max: 120, step: 1, def: 0, showIf: (p) => p.balls >= 2 && p.ballMode === "Manual" },
    { key: "bZ2", label: "Ball 2 Z %", type: "slider", min: -120, max: 120, step: 1, def: 25, showIf: (p) => p.balls >= 2 && p.ballMode === "Manual" },
    { key: "bR2", label: "Ball 2 size %", type: "slider", min: 10, max: 150, step: 1, def: 75, showIf: (p) => p.balls >= 2 && p.ballMode === "Manual" },
    { key: "bX3", label: "Ball 3 X %", type: "slider", min: -120, max: 120, step: 1, def: -40, showIf: (p) => p.balls >= 3 && p.ballMode === "Manual" },
    { key: "bY3", label: "Ball 3 Y %", type: "slider", min: -120, max: 120, step: 1, def: 20, showIf: (p) => p.balls >= 3 && p.ballMode === "Manual" },
    { key: "bZ3", label: "Ball 3 Z %", type: "slider", min: -120, max: 120, step: 1, def: -30, showIf: (p) => p.balls >= 3 && p.ballMode === "Manual" },
    { key: "bR3", label: "Ball 3 size %", type: "slider", min: 10, max: 150, step: 1, def: 75, showIf: (p) => p.balls >= 3 && p.ballMode === "Manual" },
    { key: "bX4", label: "Ball 4 X %", type: "slider", min: -120, max: 120, step: 1, def: 0, showIf: (p) => p.balls >= 4 && p.ballMode === "Manual" },
    { key: "bY4", label: "Ball 4 Y %", type: "slider", min: -120, max: 120, step: 1, def: -45, showIf: (p) => p.balls >= 4 && p.ballMode === "Manual" },
    { key: "bZ4", label: "Ball 4 Z %", type: "slider", min: -120, max: 120, step: 1, def: 15, showIf: (p) => p.balls >= 4 && p.ballMode === "Manual" },
    { key: "bR4", label: "Ball 4 size %", type: "slider", min: 10, max: 150, step: 1, def: 70, showIf: (p) => p.balls >= 4 && p.ballMode === "Manual" },
    { key: "bX5", label: "Ball 5 X %", type: "slider", min: -120, max: 120, step: 1, def: 30, showIf: (p) => p.balls >= 5 && p.ballMode === "Manual" },
    { key: "bY5", label: "Ball 5 Y %", type: "slider", min: -120, max: 120, step: 1, def: 35, showIf: (p) => p.balls >= 5 && p.ballMode === "Manual" },
    { key: "bZ5", label: "Ball 5 Z %", type: "slider", min: -120, max: 120, step: 1, def: -10, showIf: (p) => p.balls >= 5 && p.ballMode === "Manual" },
    { key: "bR5", label: "Ball 5 size %", type: "slider", min: 10, max: 150, step: 1, def: 70, showIf: (p) => p.balls >= 5 && p.ballMode === "Manual" },
    { key: "radX", label: "Radius X %", type: "slider", min: 20, max: 200, step: 1, def: 100 },
    { key: "radY", label: "Radius Y %", type: "slider", min: 20, max: 200, step: 1, def: 100 },
    { key: "radZ", label: "Radius Z %", type: "slider", min: 20, max: 200, step: 1, def: 120 },
    { key: "profile", label: "Profile", type: "select", options: ["None", "Egg", "Pear", "Hourglass", "Barrel", "Teardrop", "Wired input"], def: "None" },
    { key: "wiredAs", label: "Wired input as", type: "select", options: ["Cross-section", "Vertical profile"], def: "Cross-section", showIf: (p) => p.profile === "Wired input" },
    { key: "profileAmt", label: "Profile amount %", type: "slider", min: 0, max: 100, step: 1, def: 100, showIf: (p) => p.profile !== "None" },
    { key: "noiseAmp", label: "Noise amount %", type: "slider", min: 0, max: 60, step: 1, def: 8 },
    { key: "noiseScale", label: "Noise scale", type: "slider", min: 0.3, max: 8, step: 0.1, def: 2.2, showIf: (p) => p.noiseAmp > 0 },
    { key: "noiseOct", label: "Octaves", type: "slider", min: 1, max: 4, step: 1, def: 2, showIf: (p) => p.noiseAmp > 0 },
    { key: "lobeN", label: "Lobes", type: "slider", min: 0, max: 12, step: 1, def: 0 },
    { key: "lobeAmp", label: "Lobe depth %", type: "slider", min: 0, max: 60, step: 1, def: 15, showIf: (p) => p.lobeN > 0 },
    { key: "waveN", label: "Vertical waves", type: "slider", min: 0, max: 12, step: 1, def: 0 },
    { key: "waveAmp", label: "Wave depth %", type: "slider", min: 0, max: 60, step: 1, def: 12, showIf: (p) => p.waveN > 0 },
    { key: "twist", label: "Twist\u00b0", type: "slider", min: -360, max: 360, step: 1, def: 0 },
    { key: "taper", label: "Taper %", type: "slider", min: -80, max: 80, step: 1, def: 0 },
    { key: "rings", label: "Rings", type: "slider", min: 8, max: 128, step: 1, def: 40 },
    { key: "segs", label: "Segments", type: "slider", min: 8, max: 128, step: 1, def: 56 },
    { key: "size", label: "Preview size mm", type: "slider", min: 20, max: 400, step: 1, def: 150 },
    { key: "viewAz", label: "View angle\u00b0", type: "slider", min: -180, max: 180, step: 1, def: 30 },
    { key: "viewEl", label: "View elevation\u00b0", type: "slider", min: 5, max: 85, step: 1, def: 25 },
    { key: "wireEvery", label: "Wireframe every Nth", type: "slider", min: 1, max: 8, step: 1, def: 3 },
    { key: "silPen", label: "Silhouette pen", type: "pen", def: 1 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx, node) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const seed = Math.round(+p.seed || 0);
    const R = Math.max(6, Math.min(160, Math.round(+p.rings || 40)));
    const S = Math.max(6, Math.min(160, Math.round(+p.segs || 56)));
    const layer = ((Math.round(+p.layer || 0) % 12) + 12) % 12;
    const silPen = ((Math.round(+p.silPen || 0) % 12) + 12) % 12;
    const BUDGET = 115000;

    /* ---- metaball centres (seeded, ball 0 at origin so the ray origin is inside) ---- */
    const nB = Math.max(1, Math.min(5, Math.round(+p.balls || 1)));
    const spread = Math.max(0, Math.min(1, (+p.spread || 0) / 100));
    const bSize = Math.max(0.05, (+p.ballSize == null ? 62 : +p.ballSize) / 100);
    const sVar = Math.max(0, Math.min(0.8, (+p.sizeVar || 0) / 100));
    const rnd = mulberry32(seed * 7919 + 13);
    const balls = [];
    if (p.ballMode === "Manual" && nB > 1) {
      for (let i = 1; i <= nB; i++) {
        balls.push([
          ((+p["bX" + i] || 0) / 100),
          ((+p["bY" + i] || 0) / 100),
          ((+p["bZ" + i] || 0) / 100),
          Math.max(0.03, bSize * ((+p["bR" + i] == null ? 100 : +p["bR" + i]) / 100)),
        ]);
      }
    } else {
      for (let i = 0; i < nB; i++) {
        if (i === 0) { balls.push([0, 0, 0, bSize]); continue; }
        const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = Math.cbrt(rnd());
        const sp = Math.sqrt(Math.max(0, 1 - u * u));
        balls.push([
          spread * rr * sp * Math.cos(th),
          spread * rr * sp * Math.sin(th),
          spread * rr * u,
          Math.max(0.03, bSize * (1 + (rnd() * 2 - 1) * sVar)),
        ]);
      }
    }
    /* Manual placement can leave the origin outside the union, and the ray then
       has no inside to start from. Shift the sampling origin to the centroid of
       the ball centres weighted by radius, which is inside any sane arrangement. */
    let oX = 0, oY = 0, oZ = 0, wSum = 0;
    for (const b of balls) { const w = b[3] * b[3] * b[3]; oX += b[0] * w; oY += b[1] * w; oZ += b[2] * w; wSum += w; }
    if (wSum > 0) { oX /= wSum; oY /= wSum; oZ /= wSum; }
    const kBlend = Math.max(0.001, ((+p.blend == null ? 45 : +p.blend) / 100) * 0.6);
    const field = (x, y, z) => {
      let d = Math.hypot(x - balls[0][0], y - balls[0][1], z - balls[0][2]) - balls[0][3];
      for (let i = 1; i < balls.length; i++) {
        const b = balls[i];
        const di = Math.hypot(x - b[0], y - b[1], z - b[2]) - b[3];
        const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (di - d)) / kBlend));
        d = di + (d - di) * h - kBlend * h * (1 - h);
      }
      return d;
    };
    let hiMax = 0;
    for (const b of balls) hiMax = Math.max(hiMax, Math.hypot(b[0] - oX, b[1] - oY, b[2] - oZ) + b[3]);
    hiMax = hiMax * 1.2 + kBlend + 0.05;
    const STEPS = 20;
    const rayR = (dx, dy, dz) => {
      /* walk outwards and keep the LAST inside sample: with balls pulled apart the
         ray can leave and re-enter, and the outer surface is what gets sliced */
      let lastIn = -1;
      for (let k = 1; k <= STEPS; k++) {
        const t = (k / STEPS) * hiMax;
        if (field(oX + dx * t, oY + dy * t, oZ + dz * t) < 0) lastIn = t;
      }
      if (lastIn < 0) return 0;
      let lo = lastIn, hi = Math.min(hiMax, lastIn + hiMax / STEPS);
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (field(oX + dx * mid, oY + dy * mid, oZ + dz * mid) < 0) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };

    /* ---- profile: preset table or wired paths (half-width per height) ---- */
    const NP = 96;
    const prof = new Float64Array(NP).fill(1);
    const NA = 128;
    const xsec = new Float64Array(NA).fill(1);
    let xsecOn = false;
    const pMode = p.profile || "None";
    const wiredXsec = pMode === "Wired input" && (p.wiredAs || "Cross-section") === "Cross-section";
    if (wiredXsec) {
      /* the outline read as a HORIZONTAL cross-section: radius per angle around
         its own centroid, normalised so the widest direction keeps radius 1 */
      const src = ins && ins[0] && ins[0].paths ? ins[0].paths : null;
      if (src && src.length) {
        let cx = 0, cy = 0, n = 0;
        for (const q of src) for (const [x, y] of q.pts) { cx += x; cy += y; n++; }
        if (n > 2) {
          cx /= n; cy /= n;
          const acc = new Float64Array(NA);
          for (const q of src) for (const [x, y] of q.pts) {
            const a = Math.atan2(y - cy, x - cx);
            const k = ((Math.round(((a + Math.PI) / (2 * Math.PI)) * NA) % NA) + NA) % NA;
            const r = Math.hypot(x - cx, y - cy);
            if (r > acc[k]) acc[k] = r;
          }
          let mx = 0;
          for (let i = 0; i < NA; i++) if (acc[i] > mx) mx = acc[i];
          if (mx > 1e-9) {
            let any = false;
            for (let i = 0; i < NA; i++) if (acc[i] > 0) any = true;
            if (any) {
              for (let i = 0; i < NA; i++) {
                if (acc[i] > 0) continue;
                let a = i, b = i;
                for (let k = 1; k < NA; k++) { const q = (i - k + NA) % NA; if (acc[q] > 0) { a = q; break; } }
                for (let k = 1; k < NA; k++) { const q = (i + k) % NA; if (acc[q] > 0) { b = q; break; } }
                acc[i] = (acc[a] + acc[b]) / 2;
              }
              for (let i = 0; i < NA; i++) xsec[i] = Math.max(0.05, acc[i] / mx);
              xsecOn = true;
            }
          }
        }
      }
    }
    if (pMode === "Wired input" && !wiredXsec) {
      const src = ins && ins[0] && ins[0].paths ? ins[0].paths : null;
      if (src && src.length) {
        let a = Infinity, b = -Infinity, cx = 0, n = 0;
        for (const q of src) for (const [x, y] of q.pts) { if (y < a) a = y; if (y > b) b = y; cx += x; n++; }
        if (n > 0 && b - a > 1e-6) {
          cx /= n;
          const acc = new Float64Array(NP), cnt = new Float64Array(NP);
          for (const q of src) for (const [x, y] of q.pts) {
            const t = (y - a) / (b - a);
            const k = Math.max(0, Math.min(NP - 1, Math.round(t * (NP - 1))));
            const w = Math.abs(x - cx);
            if (w > acc[k]) acc[k] = w;
            cnt[k] = 1;
          }
          let mx = 0;
          for (let i = 0; i < NP; i++) if (acc[i] > mx) mx = acc[i];
          if (mx > 1e-6) {
            let last = 1;
            for (let i = 0; i < NP; i++) {
              if (cnt[i]) { prof[i] = acc[i] / mx; last = prof[i]; } else prof[i] = last;
            }
            for (let i = NP - 1, nx = prof[NP - 1]; i >= 0; i--) {
              if (!cnt[i]) prof[i] = (prof[i] + nx) / 2; else nx = prof[i];
            }
          }
        }
      }
    } else if (pMode !== "None") {
      for (let i = 0; i < NP; i++) {
        const t = i / (NP - 1);
        let v = 1;
        if (pMode === "Egg") v = Math.sin(Math.PI * Math.pow(t, 0.78));
        else if (pMode === "Pear") v = Math.sin(Math.PI * Math.pow(t, 1.45));
        else if (pMode === "Hourglass") v = 0.42 + 0.58 * Math.abs(Math.cos(Math.PI * t));
        else if (pMode === "Barrel") v = 0.62 + 0.38 * Math.sin(Math.PI * t);
        else if (pMode === "Teardrop") v = Math.pow(Math.sin(Math.PI * t), 0.55) * (1 - 0.55 * t);
        prof[i] = Math.max(0.04, v);
      }
    }
    const pAmt = Math.max(0, Math.min(1, (+p.profileAmt == null ? 1 : +p.profileAmt / 100)));
    const xsecAt = (th) => {
      if (!xsecOn) return 1;
      const f = (((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * NA;
      const i0 = Math.floor(f) % NA, i1 = (i0 + 1) % NA, fr = f - Math.floor(f);
      const v = xsec[i0] + (xsec[i1] - xsec[i0]) * fr;
      return 1 + (v - 1) * pAmt;
    };
    const profAt = (t) => {
      if (pMode === "None" || xsecOn) return 1;
      const f = Math.max(0, Math.min(1, (t + 1) / 2)) * (NP - 1);
      const i0 = Math.floor(f), i1 = Math.min(NP - 1, i0 + 1), fr = f - i0;
      const v = prof[i0] + (prof[i1] - prof[i0]) * fr;
      return 1 + (v - 1) * pAmt;
    };

    /* ---- surface distortion ---- */
    const nAmp = Math.max(0, (+p.noiseAmp || 0) / 100);
    const nSc = Math.max(0.1, +p.noiseScale == null ? 2.2 : +p.noiseScale);
    const oct = Math.max(1, Math.min(4, Math.round(+p.noiseOct || 1)));
    const lobeN = Math.max(0, Math.min(12, Math.round(+p.lobeN || 0)));
    const lobeA = Math.max(0, (+p.lobeAmp || 0) / 100);
    const waveN = Math.max(0, Math.min(12, Math.round(+p.waveN || 0)));
    const waveA = Math.max(0, (+p.waveAmp || 0) / 100);
    const fbm3 = (x, y, z) => {
      let sum = 0, amp = 1, f = nSc, norm = 0;
      for (let o = 0; o < oct; o++) {
        const a = noise2(x * f, y * f, seed + o * 31);
        const b = noise2(y * f, z * f, seed + o * 31 + 11);
        const c = noise2(z * f, x * f, seed + o * 31 + 23);
        sum += ((a + b + c) / 3 - 0.5) * 2 * amp;
        norm += amp;
        amp *= 0.5; f *= 2.03;
      }
      return norm > 0 ? sum / norm : 0;
    };

    /* ---- build the vertex grid ---- */
    const nV = (R + 1) * S;
    const VX = new Float64Array(nV), VY = new Float64Array(nV), VZ = new Float64Array(nV);
    const rx = Math.max(0.05, (+p.radX == null ? 100 : +p.radX) / 100);
    const ry = Math.max(0.05, (+p.radY == null ? 100 : +p.radY) / 100);
    const rz = Math.max(0.05, (+p.radZ == null ? 100 : +p.radZ) / 100);
    const tw = ((+p.twist || 0) * Math.PI) / 180;
    const tp = Math.max(-0.8, Math.min(0.8, (+p.taper || 0) / 100));
    /* pass 1 — base radius and raw Z, so the profile can be mapped against the
       REAL height instead of a guessed constant (ball size used to push the ends
       past the end of the table and clip them flat) */
    const RB = new Float64Array(nV), TH = new Float64Array(nV), PHs = new Float64Array(nV);
    let zLo = Infinity, zHi = -Infinity;
    for (let i = 0; i <= R; i++) {
      const ph = (i / R) * Math.PI;
      const sp = Math.sin(ph), cp = Math.cos(ph);
      for (let j = 0; j < S; j++) {
        const th = (j / S) * Math.PI * 2;
        const dx = sp * Math.cos(th), dy = sp * Math.sin(th), dz = cp;
        let r = rayR(dx, dy, dz);
        let m = 1;
        if (nAmp > 0) m += nAmp * fbm3(dx, dy, dz);
        if (lobeN > 0) m += lobeA * Math.cos(lobeN * th) * sp;
        if (waveN > 0) m += waveA * Math.sin(waveN * ph);
        if (xsecOn) m *= xsecAt(th);
        r = Math.max(0.001, r * m);
        const k = i * S + j;
        RB[k] = r; TH[k] = th; PHs[k] = ph;
        const z = dz * r * rz + oZ * rz;
        if (z < zLo) zLo = z; if (z > zHi) zHi = z;
      }
    }
    const zSpan = Math.max(1e-9, zHi - zLo);
    const zMid = (zLo + zHi) / 2, zHalf = zSpan / 2;
    /* pass 2 — profile, taper and twist against the measured height */
    for (let i = 0; i <= R; i++) {
      for (let j = 0; j < S; j++) {
        const k = i * S + j;
        const r = RB[k], th = TH[k], ph = PHs[k];
        const sp = Math.sin(ph), cp = Math.cos(ph);
        const z = cp * r * rz + oZ * rz;
        const t = (z - zMid) / zHalf;
        const pf = profAt(t);
        const tf = 1 + tp * t;
        const sc = Math.max(0.01, pf * tf);
        const x = (sp * Math.cos(th) * r + oX) * rx * sc;
        const y = (sp * Math.sin(th) * r + oY) * ry * sc;
        const a = tw * t;
        const ca = Math.cos(a), sa = Math.sin(a);
        VX[k] = x * ca - y * sa;
        VY[k] = x * sa + y * ca;
        VZ[k] = z;
      }
    }

    /* ---- normalise exactly like the STL intake: centre, longest dim = 1 ---- */
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < nV; k++) {
      if (VX[k] < x0) x0 = VX[k]; if (VX[k] > x1) x1 = VX[k];
      if (VY[k] < y0) y0 = VY[k]; if (VY[k] > y1) y1 = VY[k];
      if (VZ[k] < z0) z0 = VZ[k]; if (VZ[k] > z1) z1 = VZ[k];
    }
    const dim = Math.max(x1 - x0, y1 - y0, z1 - z0);
    if (!(dim > 0) || !isFinite(dim)) return [EMPTY, EMPTY, null];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    const NX = new Float64Array(nV), NY = new Float64Array(nV), NZ = new Float64Array(nV);
    for (let k = 0; k < nV; k++) {
      NX[k] = (VX[k] - mx) / dim;
      NY[k] = (VY[k] - my) / dim;
      NZ[k] = (VZ[k] - mz) / dim;
    }

    /* ---- triangles (poles collapse to single triangles) ---- */
    const tris = [];
    const rnd4 = (v) => Math.round(v * 10000) / 10000;
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < S; j++) {
        const j2 = (j + 1) % S;
        const a = i * S + j, b = i * S + j2, c = (i + 1) * S + j2, d = (i + 1) * S + j;
        if (i === 0) tris.push([a, c, d]);
        else if (i === R - 1) tris.push([a, b, c]);
        else { tris.push([a, b, c]); tris.push([a, c, d]); }
      }
    }
    const v = new Array(tris.length * 9);
    for (let t = 0; t < tris.length; t++) {
      for (let c = 0; c < 3; c++) {
        const k = tris[t][c];
        v[t * 9 + c * 3] = rnd4(NX[k]);
        v[t * 9 + c * 3 + 1] = rnd4(NY[k]);
        v[t * 9 + c * 3 + 2] = rnd4(NZ[k]);
      }
    }
    const mesh = {
      kind: "mesh",
      tri: tris.length,
      v,
      dims: [rnd4((x1 - x0) / dim), rnd4((y1 - y0) / dim), rnd4((z1 - z0) / dim)],
    };

    /* ---- projection shared by wireframe and silhouette ---- */
    const az = ((+p.viewAz == null ? 30 : +p.viewAz) * Math.PI) / 180;
    const el = (Math.max(1, Math.min(89, +p.viewEl == null ? 25 : +p.viewEl)) * Math.PI) / 180;
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const size = Math.max(5, Math.min(2000, +p.size || 150));
    const PX = new Float64Array(nV), PY = new Float64Array(nV);
    for (let k = 0; k < nV; k++) {
      const X = NX[k] * ca - NY[k] * sa;
      const Y = NX[k] * sa + NY[k] * ca;
      PX[k] = X * size;
      PY[k] = (Y * se - NZ[k] * ce) * size;
    }
    let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
    for (let k = 0; k < nV; k++) {
      if (PX[k] < px0) px0 = PX[k]; if (PX[k] > px1) px1 = PX[k];
      if (PY[k] < py0) py0 = PY[k]; if (PY[k] > py1) py1 = PY[k];
    }
    const ox = W / 2 - (px0 + px1) / 2, oy = H / 2 - (py0 + py1) / 2;
    const SX = (k) => ox + PX[k], SY = (k) => oy + PY[k];

    /* ---- wireframe: rings + meridians, every Nth, no hidden-line removal ---- */
    let budget = BUDGET;
    const wire = [];
    const every = Math.max(1, Math.min(8, Math.round(+p.wireEvery || 1)));
    for (let i = 0; i <= R; i += every) {
      if (budget <= 0) break;
      const pts = [];
      for (let j = 0; j < S; j++) pts.push([SX(i * S + j), SY(i * S + j)]);
      budget -= pts.length;
      wire.push({ pts, closed: true, layer });
    }
    for (let j = 0; j < S; j += every) {
      if (budget <= 0) break;
      const pts = [];
      for (let i = 0; i <= R; i++) pts.push([SX(i * S + j), SY(i * S + j)]);
      budget -= pts.length;
      wire.push({ pts, closed: false, layer });
    }

    /* ---- silhouette: edges where a front face meets a back face ---- */
    const sil = [];
    const faceSign = new Int8Array(tris.length);
    for (let t = 0; t < tris.length; t++) {
      const a = tris[t][0], b = tris[t][1], c = tris[t][2];
      const ux = PX[b] - PX[a], uy = PY[b] - PY[a];
      const wx = PX[c] - PX[a], wy = PY[c] - PY[a];
      const cr = ux * wy - uy * wx;
      faceSign[t] = cr >= 0 ? 1 : -1;
    }
    const emap = new Map();
    for (let t = 0; t < tris.length; t++) {
      const T3 = tris[t];
      for (let e = 0; e < 3; e++) {
        const a = T3[e], b = T3[(e + 1) % 3];
        const key = a < b ? a + ":" + b : b + ":" + a;
        const prev = emap.get(key);
        if (prev === undefined) emap.set(key, t);
        else if (prev >= 0 && faceSign[prev] !== faceSign[t]) emap.set(key, -1 - a);
        else emap.set(key, -1000000);
      }
    }
    const segs = [];
    for (const [key, val] of emap) {
      if (val <= -1 && val > -1000000) {
        const parts = key.split(":");
        segs.push([+parts[0], +parts[1]]);
      }
    }
    if (segs.length && budget > 0) {
      const adj = new Map();
      for (let i = 0; i < segs.length; i++) {
        for (const end of segs[i]) {
          const a = adj.get(end);
          if (a) a.push(i); else adj.set(end, [i]);
        }
      }
      const used = new Uint8Array(segs.length);
      for (let i = 0; i < segs.length && budget > 0; i++) {
        if (used[i]) continue;
        used[i] = 1;
        const chainIdx = [segs[i][0], segs[i][1]];
        for (let guard = 0; guard < segs.length; guard++) {
          const tail = chainIdx[chainIdx.length - 1];
          const cand = adj.get(tail);
          if (!cand) break;
          let nxt = -1;
          for (const ci of cand) if (!used[ci]) { nxt = ci; break; }
          if (nxt < 0) break;
          used[nxt] = 1;
          chainIdx.push(segs[nxt][0] === tail ? segs[nxt][1] : segs[nxt][0]);
        }
        if (chainIdx.length < 3) continue;
        const closed = chainIdx[0] === chainIdx[chainIdx.length - 1];
        const pts = (closed ? chainIdx.slice(0, -1) : chainIdx).map((k) => [SX(k), SY(k)]);
        if (pts.length < 3) continue;
        budget -= pts.length;
        sil.push({ pts, closed, layer: silPen });
      }
    }

    const st = ins && ins[1];
    return [applyStyle({ paths: wire }, st), applyStyle({ paths: sil }, st), mesh];
  },
  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const size = Math.max(5, Math.min(2000, +p.size || 150));
      const rz = Math.max(0.05, (+p.radZ == null ? 100 : +p.radZ) / 100);
      const rx = Math.max(0.05, (+p.radX == null ? 100 : +p.radX) / 100);
      const el = (Math.max(1, Math.min(89, +p.viewEl == null ? 25 : +p.viewEl)) * Math.PI) / 180;
      const mx = Math.max(rx, rz);
      const w = (size * rx) / mx, h = (size * rz * Math.cos(el)) / mx;
      return [
        { kind: "rect", x: W / 2 - w / 2, y: H / 2 - h / 2, w: Math.max(1, w), h: Math.max(1, h) },
        { kind: "circle", cx: W / 2, cy: H / 2, r: Math.max(1, size * 0.02) },
      ];
    } catch (e) {
      return [];
    }
  },
};
