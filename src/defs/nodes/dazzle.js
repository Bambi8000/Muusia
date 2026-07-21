import { Pin, mulberry32, hash2, applyStyle, signedArea } from "../helpers.js";

export default {
  key: "dazzle",
    name: "Dazzle Camouflage",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "patches", label: "Patches", type: "slider", min: 2, max: 60, step: 1, def: 14 },
      { key: "spacing", label: "Stripe spacing mm", type: "slider", min: 1, max: 12, step: 0.25, def: 3 },
      { key: "jitter", label: "Angle jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4 },
      { key: "blank", label: "Blank patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
      { key: "cross", label: "Cross-hatch patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15 },
      { key: "wavy", label: "Wavy patches", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
      { key: "outline", label: "Patch outlines", type: "check", def: true },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 17 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const L = Math.round(p.layer);
      const m = Math.max(0, p.margin);
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      if (x1 - x0 < 15 || y1 - y0 < 15) return applyStyle({ paths: [] }, ins[0]);

      const rng = mulberry32((p.seed | 0) * 2654435761 + 7);
      const target = Math.max(1, Math.min(80, Math.round(p.patches)));
      const sp = Math.max(0.8, p.spacing);
      const MINAREA = Math.max(60, sp * sp * 6);

      /* --- recursive BSP: split the largest convex patch with a random chord --- */
      const area = (poly) => Math.abs(signedArea(poly));
      const centroid = (poly) => {
        let cx = 0, cy = 0;
        for (const q of poly) { cx += q[0]; cy += q[1]; }
        return [cx / poly.length, cy / poly.length];
      };
      const splitConvex = (poly, px, py, ang) => {
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        const d = nx * px + ny * py;
        const A = [], B = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          const a = poly[i], b = poly[(i + 1) % n];
          const da = nx * a[0] + ny * a[1] - d;
          const db = nx * b[0] + ny * b[1] - d;
          if (da >= -1e-9) A.push(a);
          if (da <= 1e-9) B.push(a);
          if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
            const t = da / (da - db);
            const ip = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            A.push(ip); B.push(ip);
          }
        }
        return [A, B];
      };

      let polys = [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
      let guard = 0;
      while (polys.length < target && guard++ < 400) {
        /* pick largest patch */
        let bi = 0, ba = -1;
        for (let i = 0; i < polys.length; i++) {
          const a = area(polys[i]);
          if (a > ba) { ba = a; bi = i; }
        }
        if (ba < MINAREA * 2.2) break; /* nothing big enough left to split */
        const poly = polys[bi];
        const [ccx, ccy] = centroid(poly);
        const px = ccx + (rng() - 0.5) * Math.sqrt(ba) * 0.4;
        const py = ccy + (rng() - 0.5) * Math.sqrt(ba) * 0.4;
        const ang = rng() * Math.PI;
        const [A, B] = splitConvex(poly, px, py, ang);
        if (A.length >= 3 && B.length >= 3 && area(A) > MINAREA && area(B) > MINAREA) {
          polys.splice(bi, 1, A, B);
        }
        /* else: retry with new random point/angle next iteration */
      }

      /* --- per-patch styling: clashing quantized angles --- */
      const paths = [];
      const clampRect = (q) => [
        Math.max(x0, Math.min(x1, q[0])),
        Math.max(y0, Math.min(y1, q[1])),
      ];
      const angleSteps = [0, 30, 60, 90, 120, 150];
      let prevIdx = -1;

      const hatch = (poly, phi, spacing, wavyAmp, wavePhase) => {
        const dx = Math.cos(phi), dy = Math.sin(phi);
        const nx = -dy, ny = dx;
        let cmin = Infinity, cmax = -Infinity;
        for (const q of poly) {
          const c = nx * q[0] + ny * q[1];
          if (c < cmin) cmin = c;
          if (c > cmax) cmax = c;
        }
        let rev = false;
        for (let c = cmin + spacing / 2; c < cmax; c += spacing) {
          /* intersect infinite line (n·q = c) with convex polygon edges */
          const hits = [];
          const n = poly.length;
          for (let i = 0; i < n; i++) {
            const a = poly[i], b = poly[(i + 1) % n];
            const da = nx * a[0] + ny * a[1] - c;
            const db = nx * b[0] + ny * b[1] - c;
            if ((da > 0 && db <= 0) || (da <= 0 && db > 0)) {
              const t = da / (da - db);
              hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
          }
          if (hits.length < 2) continue;
          hits.sort((u, v) => (u[0] * dx + u[1] * dy) - (v[0] * dx + v[1] * dy));
          let A = hits[0], B = hits[hits.length - 1];
          const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
          if (len < 0.6) continue;
          if (rev) { const t = A; A = B; B = t; } /* serpentine: pen-friendly */
          rev = !rev;
          if (wavyAmp > 0.05 && len > 4) {
            const K = Math.max(3, Math.round(len / 2));
            const pts = [];
            for (let k = 0; k <= K; k++) {
              const u = k / K;
              const bx = A[0] + (B[0] - A[0]) * u;
              const by = A[1] + (B[1] - A[1]) * u;
              const off = Math.sin(u * len * 0.9 + wavePhase + c * 0.3) * wavyAmp;
              pts.push(clampRect([bx + nx * off, by + ny * off]));
            }
            paths.push({ pts, closed: false, layer: L });
          } else {
            paths.push({ pts: [A, B], closed: false, layer: L });
          }
        }
      };

      for (let i = 0; i < polys.length; i++) {
        const poly = polys[i];
        if (poly.length < 3 || area(poly) < 1) continue;
        if (p.outline) {
          paths.push({ pts: poly.map((q) => q.slice()), closed: true, layer: L });
        }
        const h1 = hash2(i * 7 + 1, 3, p.seed);
        if (h1 < Math.max(0, Math.min(1, p.blank))) { prevIdx = -1; continue; }
        /* clashing angle: quantized palette, never repeat the previous patch */
        let ai = Math.floor(hash2(i * 7 + 2, 9, p.seed) * angleSteps.length) % angleSteps.length;
        if (ai === prevIdx) ai = (ai + 2) % angleSteps.length;
        prevIdx = ai;
        const jit = (hash2(i * 7 + 3, 11, p.seed) - 0.5) * 24 * Math.max(0, Math.min(1, p.jitter));
        const phi = ((angleSteps[ai] + jit) * Math.PI) / 180;
        const spLocal = sp * (0.75 + 0.5 * hash2(i * 7 + 4, 13, p.seed));
        const isWavy = hash2(i * 7 + 5, 15, p.seed) < Math.max(0, Math.min(1, p.wavy));
        const amp = isWavy ? Math.min(spLocal * 0.32, 1.6) : 0;
        const phase = hash2(i * 7 + 6, 17, p.seed) * Math.PI * 2;
        hatch(poly, phi, spLocal, amp, phase);
        if (hash2(i * 7 + 8, 19, p.seed) < Math.max(0, Math.min(1, p.cross))) {
          hatch(poly, phi + Math.PI / 2 + 0.12, spLocal * 1.4, 0, 0);
        }
      }
      return applyStyle({ paths }, ins[0]);
    },
  
};
