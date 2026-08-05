({
  key: "portrait",
  name: "Portrait",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  faceAnalysis: true,
  fileAccept: ".jpg,.jpeg,.png",
  desc: "Draws a photo the way a portraitist works: several ROUNDS over the same sheet, each round hatching only where the image is still darker than the ink already placed (a digital residual), with the 'squint' blur narrowing round by round - big masses first, detail last. Round = pen: with Pen assignment Cycle each round gets the next pen, so the G-code pauses at every round and you decide at the machine whether to continue (finer tip for detail rounds). Hatch mode Flow follows tonal contours, Cross-hatch rotates 45/135/90 degrees per round, Mix alternates. Detail scales how fine the last rounds get; Ink strength calibrates the simulated pen darkness (plot the value in with a small hatch swatch first). The Focus ellipse multiplies detail weight inside it - put it on the eyes. Strokes hard-stop at the White cutoff boundary so eye whites and catchlights stay clean. Modes Spiral and TSP instead draw the whole image as ONE unbroken line: Spiral modulates a wave along an Archimedean spiral by darkness, TSP densifies a dot cloud and links it with a seeded traveling-salesman tour (Quality = 2-opt budget). Chain into Travel Sort as usual; round layer boundaries are preserved.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "mode", label: "Mode", type: "select", options: ["Tonal", "Spiral", "TSP"], def: "Tonal" },
    { key: "rounds", label: "Rounds", type: "slider", min: 1, max: 8, step: 1, def: 4 },
    { key: "detail", label: "Detail", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5 },
    { key: "penW", label: "Pen width mm", type: "slider", min: 0.2, max: 2, step: 0.05, def: 0.5 },
    { key: "ink", label: "Ink strength", type: "slider", min: 0.2, max: 3, step: 0.05, def: 1 },
    { key: "hatch", label: "Hatch mode", type: "select", options: ["Flow", "Cross-hatch", "Mix"], def: "Flow" },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "cutoff", label: "White cutoff", type: "slider", min: 0, max: 0.9, step: 0.01, def: 0.1 },
    { key: "focusX", label: "Focus X %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "focusY", label: "Focus Y %", type: "slider", min: 0, max: 100, step: 0.5, def: 40 },
    { key: "focusRX", label: "Focus RX %", type: "slider", min: 2, max: 60, step: 0.5, def: 24 },
    { key: "focusRY", label: "Focus RY %", type: "slider", min: 2, max: 60, step: 0.5, def: 16 },
    { key: "focusBoost", label: "Focus boost", type: "slider", min: 0, max: 3, step: 0.05, def: 0 },
    { key: "penAssign", label: "Pen assignment", type: "select", options: ["Same", "Cycle", "Start+1"], def: "Cycle" },
    { key: "quality", label: "Quality", type: "slider", min: 1, max: 8, step: 1, def: 3 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 77 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  overlay(p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const guides = [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
    /* focus ellipse as a 40-pt poly (no ellipse guide kind); same math as focusMul in compute */
    const ex = (W * p.focusX) / 100, ey = (H * p.focusY) / 100;
    const rx = Math.max(1, (W * p.focusRX) / 100), ry = Math.max(1, (H * p.focusRY) / 100);
    const pts = [];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      pts.push([ex + Math.cos(a) * rx, ey + Math.sin(a) * ry]);
    }
    guides.push({ kind: "poly", pts });
    guides.push({ kind: "point", x: ex, y: ey });
    return guides;
  },

  compute(ins, p, ctx, node) {
    const img = node && node.data && node.data.img;
    if (!img || !img.w || !img.h || !img.g) return applyStyle({ paths: [] }, ins[0]);
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const boxW = W - 2 * m, boxH = H - 2 * m;
    if (boxW < 5 || boxH < 5) return applyStyle({ paths: [] }, ins[0]);

    /* image fitted to the margin box, aspect preserved (image.js / Stipple convention) */
    const sc = Math.min(boxW / img.w, boxH / img.h);
    const iw = img.w * sc, ih = img.h * sc;
    const x0 = (W - iw) / 2, y0 = (H - ih) / 2;

    const penW = Math.max(0.1, p.penW);
    const gamma = Math.max(0.05, p.gamma);
    const cut = Math.max(0, Math.min(0.95, p.cutoff));
    const inkK = Math.max(0.05, p.ink);
    const POINT_BUDGET = 118000;

    /* darkness in [0,1] after gamma; 1 = black; white outside the image */
    const darkAt = (x, y) => {
      const u = (x - x0) / sc, v = (y - y0) / sc;
      if (u < 0 || v < 0 || u >= img.w - 1 || v >= img.h - 1) return 0;
      const ui = Math.floor(u), vi = Math.floor(v);
      const fu = u - ui, fv = v - vi;
      const g = img.g;
      const a = g[vi * img.w + ui], b = g[vi * img.w + ui + 1];
      const c = g[(vi + 1) * img.w + ui], d0 = g[(vi + 1) * img.w + ui + 1];
      const d = a + (b - a) * fu + (c - a) * fv + (a - b - c + d0) * fu * fv;
      return Math.pow(Math.max(0, Math.min(1, d)), gamma);
    };

    /* ================= single-line mode: SPIRAL ================= */
    if (p.mode === "Spiral") {
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(iw, ih) / 2 - penW;
      if (maxR < 4) return applyStyle({ paths: [] }, ins[0]);
      const pitch = Math.max(penW * 1.6, 4.6 - 3.3 * p.detail);
      const waveLen = Math.max(1.0, penW * 2.5);
      /* projected length ~ pi*maxR^2/pitch; pick a step that respects the budget */
      const approxLen = (Math.PI * maxR * maxR) / pitch;
      const step = Math.max(0.3, approxLen / (POINT_BUDGET * 0.8));
      const pts = [];
      let th = 0, phase = 0;
      while (pts.length < POINT_BUDGET) {
        const r = (pitch * th) / (2 * Math.PI);
        if (r > maxR) break;
        const bx = cx + Math.cos(th) * r, by = cy + Math.sin(th) * r;
        const d = darkAt(bx, by);
        const amp = d > cut ? ((d - cut) / (1 - cut)) * Math.max(0, pitch / 2 - penW * 0.6) : 0;
        const rr = r + Math.sin(phase * Math.PI * 2) * amp;
        pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
        th += step / Math.max(0.5, r);
        phase += step / waveLen;
      }
      if (pts.length < 2) return applyStyle({ paths: [] }, ins[0]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    }

    /* ================= single-line mode: TSP ================= */
    if (p.mode === "TSP") {
      const sMin = Math.max(penW * 1.5, 2.4 - 1.5 * p.detail);
      const sMax = sMin * 4;
      const rng = mulberry32(p.seed * 7919 + 911);
      const cellSz = sMax;
      const grid = new Map();
      const gKey = (gx, gy) => gx + "," + gy;
      const dots = []; /* {x, y, s} - s = this point's own required spacing */
      const MAXP = 2600;
      /* placement budget is FIXED: Quality is the 2-opt budget only (spec),
         so the point set is identical across Quality values */
      const attempts = 130000;
      for (let a = 0; a < attempts && dots.length < MAXP; a++) {
        const x = x0 + rng() * iw;
        const y = y0 + rng() * ih;
        const d = darkAt(x, y);
        if (d <= cut) continue;
        const t = (d - cut) / (1 - cut);
        if (rng() > t) continue; /* density from darkness */
        const s = sMin + (sMax - sMin) * (1 - t);
        const gx = Math.floor(x / cellSz), gy = Math.floor(y / cellSz);
        let ok = true;
        for (let jy = gy - 1; jy <= gy + 1 && ok; jy++)
          for (let jx = gx - 1; jx <= gx + 1 && ok; jx++) {
            const b = grid.get(gKey(jx, jy));
            if (!b) continue;
            for (const i of b) {
              const q = dots[i];
              const need = (s + q.s) / 2;
              const dx = x - q.x, dy = y - q.y;
              if (dx * dx + dy * dy < need * need) { ok = false; break; }
            }
          }
        if (!ok) continue;
        const k = gKey(gx, gy);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(dots.length);
        dots.push({ x, y, s });
      }
      if (dots.length < 2) return applyStyle({ paths: [] }, ins[0]);
      /* nearest-neighbour tour */
      const n = dots.length;
      const used = new Uint8Array(n);
      const tour = new Array(n);
      tour[0] = 0; used[0] = 1;
      for (let i = 1; i < n; i++) {
        const c = dots[tour[i - 1]];
        let best = -1, bd = Infinity;
        for (let j = 0; j < n; j++) {
          if (used[j]) continue;
          const dx = dots[j].x - c.x, dy = dots[j].y - c.y;
          const dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = j; }
        }
        tour[i] = best; used[best] = 1;
      }
      /* seeded 2-opt; budget = Quality */
      const dist = (a, b) => Math.hypot(dots[a].x - dots[b].x, dots[a].y - dots[b].y);
      const rng2 = mulberry32(p.seed * 7919 + 1723);
      const budget = Math.round(p.quality) * 24000;
      for (let it = 0; it < budget; it++) {
        let i = 1 + Math.floor(rng2() * (n - 2));
        let j = 1 + Math.floor(rng2() * (n - 2));
        if (i === j) continue;
        if (i > j) { const t = i; i = j; j = t; }
        const a = tour[i - 1], b = tour[i], c = tour[j], d = tour[j + 1] !== undefined ? tour[j + 1] : -1;
        const oldL = dist(a, b) + (d >= 0 ? dist(c, d) : 0);
        const newL = dist(a, c) + (d >= 0 ? dist(b, d) : 0);
        if (newL < oldL - 1e-9) {
          for (let lo = i, hi = j; lo < hi; lo++, hi--) { const t = tour[lo]; tour[lo] = tour[hi]; tour[hi] = t; }
        }
      }
      const pts = tour.map((i) => [dots[i].x, dots[i].y]);
      return applyStyle({ paths: [{ pts, closed: false, layer: Math.round(p.layer) }] }, ins[0]);
    }

    /* ================= TONAL ROUNDS ================= */
    /* Two fields on a coarse grid over the image box:
       D = target darkness (gamma + white cutoff), I = simulated ink.
       Residual R = max(0, blur(D) - blur(I)), SAME kernel on both.
       Prefix invariant (locked): everything per-round is a function of the
       round index r only - never of the total round count - and rounds run
       sequentially with per-round rng streams. rounds=k is bit-identical
       to the first k rounds of rounds=N. */

    let cell = Math.max(0.5, Math.min(1.2, penW));
    {
      const cells = Math.ceil(iw / cell) * Math.ceil(ih / cell);
      const CAP = 260000;
      if (cells > CAP) cell *= Math.sqrt(cells / CAP);
    }
    const gw = Math.max(2, Math.ceil(iw / cell));
    const gh = Math.max(2, Math.ceil(ih / cell));
    const NC = gw * gh;
    const D = new Float32Array(NC);
    const cutM = new Uint8Array(NC); /* 1 = white-cutoff cell, hard-forbidden */
    for (let cy = 0; cy < gh; cy++) {
      for (let cx = 0; cx < gw; cx++) {
        const d = darkAt(x0 + (cx + 0.5) * cell, y0 + (cy + 0.5) * cell);
        const i = cy * gw + cx;
        if (d <= cut) { cutM[i] = 1; D[i] = 0; }
        else D[i] = (d - cut) / (1 - cut);
      }
    }
    const I = new Float32Array(NC);

    /* separable 3-pass box blur ~ gaussian */
    const blurred = (src, radCells) => {
      if (radCells < 1) return Float32Array.from(src);
      let a = Float32Array.from(src);
      let b = new Float32Array(NC);
      const r = radCells, w = 2 * r + 1;
      for (let pass = 0; pass < 3; pass++) {
        /* horizontal */
        for (let y = 0; y < gh; y++) {
          const off = y * gw;
          let s = 0;
          for (let x = -r; x <= r; x++) s += a[off + Math.max(0, Math.min(gw - 1, x))];
          for (let x = 0; x < gw; x++) {
            b[off + x] = s / w;
            const xr = Math.max(0, Math.min(gw - 1, x + r + 1));
            const xl = Math.max(0, Math.min(gw - 1, x - r));
            s += a[off + xr] - a[off + xl];
          }
        }
        /* vertical */
        for (let x = 0; x < gw; x++) {
          let s = 0;
          for (let y = -r; y <= r; y++) s += b[Math.max(0, Math.min(gh - 1, y)) * gw + x];
          for (let y = 0; y < gh; y++) {
            a[y * gw + x] = s / w;
            const yr = Math.max(0, Math.min(gh - 1, y + r + 1));
            const yl = Math.max(0, Math.min(gh - 1, y - r));
            s += b[yr * gw + x] - b[yl * gw + x];
          }
        }
      }
      return a;
    };

    const detail = Math.max(0, Math.min(1, p.detail));
    const L0 = Math.round(p.layer);
    const penFor = (r) =>
      p.penAssign === "Cycle" ? (L0 + r) % PENS.length :
      p.penAssign === "Start+1" ? Math.min(PENS.length - 1, L0 + r) : L0;

    /* focus ellipse multiplier - same math as overlay() */
    const ex = (W * p.focusX) / 100, ey = (H * p.focusY) / 100;
    const frx = Math.max(1, (W * p.focusRX) / 100), fry = Math.max(1, (H * p.focusRY) / 100);
    const boost = Math.max(0, p.focusBoost);
    const focusMul = (x, y) => {
      if (boost <= 0) return 1;
      const qx = (x - ex) / frx, qy = (y - ey) / fry;
      const q = qx * qx + qy * qy;
      return q >= 1 ? 1 : 1 + boost * (1 - q);
    };

    const dep = inkK * Math.min(1.5, penW / cell); /* ink one pass deposits into a cell */
    const OVER_TOL = 0.3;   /* over-ink guard: never stroke where I >= D + tol */
    const STOP_R = 0.05;    /* residual below this stops growth / rejects seeds */
    const EPS_MEAN = 0.008; /* round-start mean residual epsilon: later rounds add nothing */
    const stepMm = cell * 0.9;
    const rounds = Math.max(1, Math.round(p.rounds));
    const quality = Math.max(1, Math.round(p.quality));
    const fall = Math.max(0.4, Math.min(0.8, 0.78 - 0.33 * detail)); /* blur schedule decay */

    const cellIdxAt = (x, y) => {
      const cx = Math.floor((x - x0) / cell), cy = Math.floor((y - y0) / cell);
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return -1;
      return cy * gw + cx;
    };

    const paths = [];
    let total = 0;

    for (let r = 0; r < rounds; r++) {
      const brMm = 6 * Math.pow(fall, r);           /* the round's "squint" */
      const radC = Math.round(brMm / cell);
      const Db = blurred(D, radC);
      const Ib = blurred(I, radC);
      const R = new Float32Array(NC);
      let rsum = 0;
      for (let i = 0; i < NC; i++) { const v = Db[i] - Ib[i]; R[i] = v > 0 ? v : 0; rsum += R[i]; }
      if (rsum / NC < EPS_MEAN) break; /* residual epsilon - depends only on state so far */

      /* gradient of Db (per mm) for flow direction + detail weighting */
      const gradAt = (x, y) => {
        const cx = Math.max(1, Math.min(gw - 2, Math.floor((x - x0) / cell)));
        const cy = Math.max(1, Math.min(gh - 2, Math.floor((y - y0) / cell)));
        const i = cy * gw + cx;
        return [(Db[i + 1] - Db[i - 1]) / (2 * cell), (Db[i + gw] - Db[i - gw]) / (2 * cell)];
      };

      const kGrad = detail * r * 0.9; /* weight shifts toward gradient in later rounds */
      const angDeg = [45, 135, 90][r % 3];
      const fixDir = [Math.cos((angDeg * Math.PI) / 180), Math.sin((angDeg * Math.PI) / 180)];
      const flowRound = p.hatch === "Flow" || (p.hatch === "Mix" && r % 2 === 0);
      const GTHR = 0.012; /* |grad| below this: flow falls back to the fixed angle */

      const maxLenMm = Math.max(6, Math.min(110, brMm * 12));
      const minLenMm = Math.max(penW * 2, brMm * 0.9 * (1 - 0.5 * detail));
      const maxSteps = Math.ceil(maxLenMm / stepMm);

      const rng = mulberry32(p.seed * 7919 + r * 104729 + 5); /* per-round stream */
      const attempts = quality * 5000;
      let accepted = 0, dry = 0;

      const dirAt = (x, y, prev) => {
        if (flowRound) {
          const [gx, gy] = gradAt(x, y);
          const mg = Math.hypot(gx, gy);
          if (mg > GTHR) {
            let dx = -gy / mg, dy = gx / mg; /* perpendicular to grad = along tonal contour */
            if (prev && dx * prev[0] + dy * prev[1] < 0) { dx = -dx; dy = -dy; }
            return [dx, dy];
          }
        }
        if (prev && fixDir[0] * prev[0] + fixDir[1] * prev[1] < 0) return [-fixDir[0], -fixDir[1]];
        return fixDir;
      };

      const march = (sx, sy, sign, stepCap) => {
        const out = [];
        let x = sx, y = sy, prev = null;
        for (let s = 0; s < stepCap; s++) {
          let d = dirAt(x, y, prev);
          if (sign < 0 && s === 0) d = [-d[0], -d[1]];
          prev = d;
          const nx = x + d[0] * stepMm, ny = y + d[1] * stepMm;
          const ci = cellIdxAt(nx, ny);
          if (ci < 0 || cutM[ci]) break;             /* hard stop at the white-cutoff boundary */
          if (R[ci] < STOP_R) break;                  /* residual exhausted */
          if (I[ci] >= D[ci] + OVER_TOL) break;       /* over-ink guard */
          out.push([nx, ny]);
          x = nx; y = ny;
        }
        return out;
      };

      for (let a = 0; a < attempts; a++) {
        if (total >= POINT_BUDGET) break;
        const ci0 = Math.floor(rng() * NC);
        const jx = (rng() - 0.5) * cell, jy = (rng() - 0.5) * cell;
        if (cutM[ci0]) continue;
        const sx = x0 + ((ci0 % gw) + 0.5) * cell + jx;
        const sy = y0 + (Math.floor(ci0 / gw) + 0.5) * cell + jy;
        const [ggx, ggy] = gradAt(sx, sy);
        const fm = focusMul(sx, sy);
        const w = R[ci0] * (1 + kGrad * Math.hypot(ggx, ggy)) * fm;
        if (w <= STOP_R) { dry++; if (dry > attempts / 6 && !accepted) break; continue; }
        if (rng() >= w / (w + 0.3)) continue; /* residual-weighted rejection sampling */
        if (I[ci0] >= D[ci0] + OVER_TOL) continue;

        /* focus = detail weighting: inside the ellipse strokes get shorter
           (finer rendering), not just more likely - same ink, denser strokes */
        const stepCap = Math.max(2, Math.ceil(maxSteps / (1 + 0.6 * (fm - 1))));
        const fwd = march(sx, sy, 1, stepCap);
        const bck = march(sx, sy, -1, stepCap);
        const pts = [];
        for (let i = bck.length - 1; i >= 0; i--) pts.push(bck[i]);
        pts.push([sx, sy]);
        for (const q of fwd) pts.push(q);
        if (pts.length < 2) continue;
        if ((pts.length - 1) * stepMm < minLenMm / fm) continue;
        if (total + pts.length > POINT_BUDGET) break;

        /* greedy deposit: into unblurred I, and locally out of this round's R */
        for (const [qx, qy] of pts) {
          const ci = cellIdxAt(qx, qy);
          if (ci < 0) continue;
          I[ci] += dep;
          R[ci] = Math.max(0, R[ci] - dep);
          const cx = ci % gw, cy = (ci - cx) / gw;
          if (cx > 0) R[ci - 1] = Math.max(0, R[ci - 1] - dep * 0.35);
          if (cx < gw - 1) R[ci + 1] = Math.max(0, R[ci + 1] - dep * 0.35);
          if (cy > 0) R[ci - gw] = Math.max(0, R[ci - gw] - dep * 0.35);
          if (cy < gh - 1) R[ci + gw] = Math.max(0, R[ci + gw] - dep * 0.35);
        }
        paths.push({ pts, closed: false, layer: penFor(r) });
        total += pts.length;
        accepted++;
      }
      if (total >= POINT_BUDGET) break;
    }

    return applyStyle({ paths }, ins[0]);
  },
})
