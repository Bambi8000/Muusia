import { Pin, EMPTY, PENS, mulberry32, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "portrait",
  name: "Portrait",
  cat: "gen",
  group: "textimg",
  fileImage: true,
  faceAnalysis: true,
  fileAccept: ".jpg,.jpeg,.png",
  desc: "Draws a photo the way a portraitist works. Modes Features+tonal and Features only read the frozen face analysis (Analyze face button): landmark chains become smoothed splines pruned in importance order by Line economy (max = all contours, min = just the eyes), the face oval splits into a high-importance jaw arc and an early-dropping upper arc, glasses come from the parsed region behind their own checkbox, and hair is drawn as FLOW, not outline - streamlines seeded in the hair mask along the frozen flow field, density from image darkness. Feature lines take the node's Pen; tonal rounds continue on the next pens with the feature ink already deposited, so shading automatically avoids the lines. Without a valid analysis the feature modes degrade to pure Tonal. Tonal works with no ML at all: several ROUNDS over the same sheet, each hatching only where the image is still darker than the ink already placed (a digital residual), the 'squint' blur narrowing round by round - big masses first, detail last. Round = pen: with Pen assignment Cycle the G-code pauses at every round and you decide at the machine whether to continue. Hatch mode Flow follows tonal contours, Cross-hatch rotates 45/135/90 degrees per round, Mix alternates. Ink strength calibrates the simulated pen darkness (plot a small hatch swatch first). The Focus ellipse multiplies detail weight inside it. Strokes hard-stop at the White cutoff boundary so eye whites and catchlights stay clean. Mode One line is the Picasso portrait: the pruned feature chains are ordered by a small endpoint tour and linked with light arcs bulging over the cheeks and forehead - one unbroken line, requiring an analysis (empty without one). Sketch nerve brings the Tresset look: contours re-stated by nervous slightly-offset passes and shading strokes that wobble - 0 is the clean drawing, bit-identical to before. Modes Spiral and TSP draw the whole image as ONE unbroken line from tone alone. Chain into Travel Sort as usual; layer boundaries are preserved.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "file", label: "Image (PNG/JPG)", type: "file", def: "" },
    { key: "mode", label: "Mode", type: "select", options: ["Tonal", "Features+tonal", "Features only", "One line", "Spiral", "TSP"], def: "Tonal" },
    { key: "economy", label: "Line economy", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7 },
    { key: "glassesOn", label: "Glasses lines", type: "check", def: true },
    { key: "nerve", label: "Sketch nerve", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
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

  overlay(p, ctx, ins, node) {
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
    /* frozen analysis as dashed guides - one glance shows whether the
       analysis landed, before any ink (needs the engine's 4th overlay arg) */
    try {
      const a = node && node.data && node.data.analysis;
      const img = node && node.data && node.data.img;
      if (a && a.v === 1 && a.img && a.img.w > 0 && img && img.w > 0) {
        const boxW = W - 2 * m, boxH = H - 2 * m;
        const sc = Math.min(boxW / img.w, boxH / img.h);
        const pxs = sc * (img.w / a.img.w);
        const x0 = (W - img.w * sc) / 2, y0 = (H - img.h * sc) / 2;
        const put = (cpts, closed) => {
          if (!Array.isArray(cpts) || cpts.length < 2) return;
          const q = cpts.map((u) => [x0 + u[0] * pxs, y0 + u[1] * pxs]);
          if (closed) q.push(q[0].slice());
          guides.push({ kind: "poly", pts: q });
        };
        const ovFaces = Array.isArray(a.faces) && a.faces.length ? a.faces
          : (a.face && a.face.found && a.face.chains ? [a.face] : []);
        let nC = 0;
        for (const fc of ovFaces) {
          if (!fc || !fc.chains) continue;
          for (const c of Object.values(fc.chains)) {
            if (nC >= 26 || !c || !Array.isArray(c.pts)) continue;
            put(c.pts, !!c.closed); nC++;
          }
        }
        for (const key of ["hair", "beard", "glasses"]) {
          const r = a.regions && a.regions[key];
          if (!r || !Array.isArray(r.outline)) continue;
          put(r.outline, true);
          (r.holes || []).slice(0, 4).forEach((hh) => put(hh, true));
        }
      }
    } catch (e) { /* garbage analysis never breaks the overlay */ }
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
    /* decision (spec open question 4): feature lines take the node's own Pen
       slot; tonal rounds continue the assignment sequence AFTER it */
    let penShift = 0;
    const penFor = (r) =>
      p.penAssign === "Cycle" ? (L0 + penShift + r) % PENS.length :
      p.penAssign === "Start+1" ? Math.min(PENS.length - 1, L0 + penShift + r) : L0;

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

    /* ================= FEATURE LINES (phase 2B) =================
       Raw landmark chains drawn 1:1 are geometrically right and artistically
       dead - so: importance-ordered pruning (Line economy), splines, hair as
       FLOW not outline, and every feature line deposits its ink into I so the
       tonal rounds underneath automatically avoid the lines.
       Degradation rule: missing/garbage analysis -> both feature modes run
       pure Tonal; a valid analysis without a face still draws hair. */
    const oneLine = p.mode === "One line";
    const featMode = p.mode === "Features+tonal" || p.mode === "Features only" || oneLine;
    /* Sketch nerve (Tresset): the aesthetic of apparent imprecision - contours
       re-stated by nervous slightly-offset passes, shading strokes wobbling.
       All jitter is coordinate-based noise2 - no rng stream is consumed, so
       nerve NEVER moves the prefix invariant, and nerve 0 is bit-identical
       to the clean output. */
    const NERVE = Math.max(0, Math.min(1, p.nerve || 0));
    if (featMode) {
      const A = (() => {
        try {
          const a = node && node.data && node.data.analysis;
          if (!a || a.v !== 1 || !a.img || !(a.img.w > 0) || !(a.img.h > 0)) return null;
          return a;
        } catch (e) { return null; }
      })();
      if (oneLine && !A) return applyStyle({ paths: [] }, ins[0]); /* spec: no analysis -> EMPTY, like image nodes without an image */
      let featCount = 0;
      const segs = []; /* One line: collected px-space chains for the linker */
      if (A) {
        const pxs = sc * (img.w / A.img.w); /* analysis px -> mm, survives res drift */
        const toMM = (q) => [x0 + q[0] * pxs, y0 + q[1] * pxs];
        const finitePts = (c) => Array.isArray(c) && c.length >= 2 &&
          c.every((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]));
        const pipG = (x, y, poly) => {
          let inside = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
          }
          return inside;
        };
        /* region -> outline/hole polygon lists (parts-aware for multi-face) */
        const polysOf = (reg) => {
          const src2 = reg.parts && reg.parts.length ? reg.parts : [reg];
          const O = [], HH = [];
          for (const pp of src2) {
            if (!finitePts(pp.outline)) continue;
            O.push(pp.outline);
            for (const hh of (pp.holes || [])) if (finitePts(hh)) HH.push(hh);
          }
          return { O, HH };
        };
        const beardPolys = (() => {
          const b = A.regions && A.regions.beard;
          if (!b || !finitePts(b.outline)) return [];
          return polysOf(b).O;
        })();
        const inBeard = (x, y) => beardPolys.some((poly) => pipG(x, y, poly));
        /* an artist draws the beard mass, not the chin bone through it:
           jaw/oval runs inside the beard are clipped away */
        const clipOutsideBeard = (pts2) => {
          if (!beardPolys.length) return [pts2];
          const runs = [];
          let cur = [];
          for (const q of pts2) {
            if (inBeard(q[0], q[1])) { if (cur.length >= 3) runs.push(cur); cur = []; }
            else cur.push(q);
          }
          if (cur.length >= 3) runs.push(cur);
          return runs;
        };
        const chaikin = (pts, closed, iters) => {
          let cur = pts;
          for (let k = 0; k < iters; k++) {
            const out = [];
            const n = cur.length;
            const lim = closed ? n : n - 1;
            if (!closed) out.push(cur[0].slice());
            for (let i = 0; i < lim; i++) {
              const a0 = cur[i], b0 = cur[(i + 1) % n];
              out.push([a0[0] * 0.75 + b0[0] * 0.25, a0[1] * 0.75 + b0[1] * 0.25]);
              out.push([a0[0] * 0.25 + b0[0] * 0.75, a0[1] * 0.25 + b0[1] * 0.75]);
            }
            if (!closed) out.push(cur[n - 1].slice());
            cur = out;
          }
          return cur;
        };
        const depositPath = (ptsMM, closed) => {
          const q = resample(ptsMM, closed, cell); /* one deposit per grid cell of travel */
          for (const [qx, qy] of q) {
            const ci = cellIdxAt(qx, qy);
            if (ci >= 0) I[ci] += dep * 1.15; /* feature ink slightly heavy: shading keeps clear */
          }
        };
        /* AFFINE INVARIANT (spec checklist): all feature geometry is generated
           in ANALYSIS PIXEL SPACE - smoothing, resampling, seeding, marching -
           and mapped to mm only on emit. Margin/paper changes are then a pure
           affine remap of the output, bit-comparable across fits. */
        const PX_STEP = 2.5; /* chain resample step, analysis px */
        /* coordinate-based smooth jitter, px space (affine-safe) */
        const jit = (pts, tag, ampPx) => ampPx <= 0 ? pts : pts.map(([qx, qy]) => [
          qx + (noise2(qx * 0.055 + tag, qy * 0.055) - 0.5) * 2 * ampPx,
          qy + (noise2(qx * 0.055 + 31.7 + tag, qy * 0.055 + 7.3) - 0.5) * 2 * ampPx,
        ]);
        const restates = NERVE > 0 ? 1 + Math.round(NERVE * 2) : 1;
        const emitFeat = (ptsPx, closed) => {
          if (!finitePts(ptsPx)) return;
          let base = chaikin(ptsPx, closed, 2);
          base = resample(base, closed, PX_STEP);
          if (!base || base.length < 2) return;
          const passes = oneLine ? 1 : restates; /* one line stays one line */
          for (let rs = 0; rs < passes; rs++) {
            let q = NERVE > 0 ? jit(base, rs * 13.7, NERVE * (rs === 0 ? 1.4 : 2.6)) : base;
            /* Tresset flyaways: open contours overshoot their ends */
            if (NERVE > 0 && !closed && !oneLine && q.length >= 3) {
              const fly = (a0, a1, tag2) => {
                const dx = a0[0] - a1[0], dy = a0[1] - a1[1];
                const m = Math.hypot(dx, dy) || 1;
                const L = NERVE * (2.5 + 7 * noise2(a0[0] * 0.13 + tag2, a0[1] * 0.13));
                return [a0[0] + (dx / m) * L, a0[1] + (dy / m) * L];
              };
              q = [fly(q[0], q[1], rs * 3.1)].concat(q, [fly(q[q.length - 1], q[q.length - 2], rs * 3.1 + 50)]);
            }
            if (oneLine) { segs.push({ pts: q, closed }); featCount++; break; }
            if (total + q.length > POINT_BUDGET) return;
            const mm = q.map(toMM);
            paths.push({ pts: mm, closed, layer: L0 });
            total += mm.length;
            featCount++;
            if (rs === 0) depositPath(mm, closed); /* ink counted once per contour */
          }
        };

        /* importance table (spec open question 3 - initial values, tune by eye):
           economy 0 keeps only the eyes, 1 keeps everything */
        const IMP = { eyeL: 1, eyeR: 1, irisL: 0.95, irisR: 0.95, lipsOuter: 0.9, jaw: 0.85,
          browL: 0.8, browR: 0.8, nostrils: 0.75, glasses: 0.7, lipsInner: 0.55,
          noseBridge: 0.5, ovalUpper: 0.3 };
        const thr = 0.97 - 0.94 * Math.max(0, Math.min(1, p.economy));
        const keep = (k) => (IMP[k] != null ? IMP[k] : 0.5) >= thr;

        /* every found face: additive analysis.faces, single-face fallback */
        const FACES = Array.isArray(A.faces) && A.faces.length
          ? A.faces.filter((f) => f && f.found === true && f.chains)
          : (A.face && A.face.found === true && A.face.chains ? [A.face] : []);
        for (const face of FACES) {
          const F = face.chains;
          for (const [k, c] of Object.entries(F)) {
            if (k === "faceOval" || !keep(k) || !c || !finitePts(c.pts)) continue;
            emitFeat(c.pts, !!c.closed);
          }
          /* faceOval splits: jaw (lower arc, high importance) vs upper oval
             (drops early - a real artist omits half the outline); both are
             clipped outside the beard */
          const ov = F.faceOval;
          if (ov && finitePts(ov.pts) && ov.pts.length >= 6) {
            const cy = ov.pts.reduce((s, q) => s + q[1], 0) / ov.pts.length;
            const n = ov.pts.length;
            const lower = ov.pts.map((q) => q[1] > cy);
            let s0 = -1; /* start of the longest lower run (wraparound-safe) */
            for (let i = 0; i < n; i++) if (lower[i] && !lower[(i - 1 + n) % n]) { s0 = i; break; }
            if (s0 >= 0) {
              const jaw = [], upper = [];
              for (let i = 0; i < n; i++) {
                const q = ov.pts[(s0 + i) % n];
                (lower[(s0 + i) % n] ? jaw : upper).push(q);
              }
              if (keep("jaw") && jaw.length >= 3) for (const run of clipOutsideBeard(jaw)) emitFeat(run, false);
              if (keep("ovalUpper") && upper.length >= 3) for (const run of clipOutsideBeard(upper)) emitFeat(run, false);
            } else if (keep("ovalUpper")) emitFeat(ov.pts, !!ov.closed);
          }
        }

        /* glasses: manual checkbox (spec open question 5) AND economy gate */
        const gl = A.regions && A.regions.glasses;
        if (p.glassesOn && keep("glasses") && gl && finitePts(gl.outline)) {
          emitFeat(gl.outline, true);
          (gl.holes || []).forEach((hh) => { if (finitePts(hh)) emitFeat(hh, true); });
        }

        /* One line skips flow regions - the Picasso line is chains only (v1).
           Hair AND beard share the same machinery: streamlines along a frozen
           flow field inside a (parts-aware) region, density from darkness,
           px-space occupancy spacing. */
        const drawFlow = (reg, HF, streamTag, OC) => {
          if (!reg || !finitePts(reg.outline) || !HF || !Array.isArray(HF.ang) ||
              HF.ang.length !== HF.w * HF.h || !(HF.cell > 0)) return;
          const { O, HH } = polysOf(reg);
          if (!O.length) return;
          const inReg = (x, y) => O.some((o) => pipG(x, y, o)) && !HH.some((hh) => pipG(x, y, hh));
          const darkPx = (x, y) => {
            const xi = Math.max(0, Math.min(A.img.w - 1, Math.round((x / A.img.w) * img.w)));
            const yi = Math.max(0, Math.min(A.img.h - 1, Math.round((y / A.img.h) * img.h)));
            const v = img.g[Math.min(img.h - 1, yi) * img.w + Math.min(img.w - 1, xi)];
            return Math.pow(Math.max(0, Math.min(1, v)), gamma);
          };
          const flowAt = (x, y) => {
            const gxp = Math.max(0, Math.min(HF.w - 1, Math.floor(x / HF.cell)));
            const gyp = Math.max(0, Math.min(HF.h - 1, Math.floor(y / HF.cell)));
            const i = gyp * HF.w + gxp;
            return { a: HF.ang[i], c: HF.coh[i] };
          };
          let dsx = 0, dsy = 0;
          for (let i = 0; i < HF.ang.length; i++) { dsx += HF.coh[i] * Math.cos(2 * HF.ang[i]); dsy += HF.coh[i] * Math.sin(2 * HF.ang[i]); }
          const domA = 0.5 * Math.atan2(dsy, dsx);
          const ow = Math.max(1, Math.ceil(A.img.w / OC)), ohh = Math.max(1, Math.ceil(A.img.h / OC));
          const occ = new Uint8Array(ow * ohh);
          const occAt = (x, y) => Math.max(0, Math.min(ohh - 1, Math.floor(y / OC))) * ow + Math.max(0, Math.min(ow - 1, Math.floor(x / OC)));
          let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
          for (const o of O) for (const q of o) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
          const rngH = mulberry32(p.seed * 7919 + streamTag);
          const stepH = 3, maxStepsH = 200, minLenPx = 16;
          const marchH = (sx0, sy0, sgn) => {
            const out = [];
            let x = sx0, y = sy0, prev = null;
            for (let s = 0; s < maxStepsH; s++) {
              const f = flowAt(x, y);
              const aa = f.c < 0.2 ? domA : f.a;
              let dx = Math.cos(aa), dy = Math.sin(aa);
              if (prev ? (dx * prev[0] + dy * prev[1] < 0) : sgn < 0) { dx = -dx; dy = -dy; }
              prev = [dx, dy];
              const nx = x + dx * stepH, ny = y + dy * stepH;
              if (!inReg(nx, ny) || darkPx(nx, ny) <= cut) break;
              if (occ[occAt(nx, ny)] >= 2) break; /* lane already taken */
              out.push([nx, ny]);
              x = nx; y = ny;
            }
            return out;
          };
          const attemptsH = quality * 1400;
          for (let a2 = 0; a2 < attemptsH; a2++) {
            if (total > POINT_BUDGET - 2000) break;
            const x = bx0 + rngH() * (bx1 - bx0), y = by0 + rngH() * (by1 - by0);
            if (!inReg(x, y)) continue;
            const d = darkPx(x, y);
            if (d <= cut) continue;
            if (rngH() > (d - cut) / (1 - cut)) continue;
            if (occ[occAt(x, y)] >= 1) continue; /* seed only in free lanes */
            const fwd = marchH(x, y, 1), bck = marchH(x, y, -1);
            const ptsPx = [];
            for (let i = bck.length - 1; i >= 0; i--) ptsPx.push(bck[i]);
            ptsPx.push([x, y]);
            for (const q of fwd) ptsPx.push(q);
            if ((ptsPx.length - 1) * stepH < minLenPx) continue;
            if (NERVE > 0) { /* light liveliness, px space */
              for (let i = 0; i < ptsPx.length; i++) {
                const [qx, qy] = ptsPx[i];
                ptsPx[i] = [qx + (noise2(qx * 0.07, qy * 0.07 + 2.2) - 0.5) * 2 * NERVE * 1.8,
                            qy + (noise2(qx * 0.07 + 5.5, qy * 0.07) - 0.5) * 2 * NERVE * 1.8];
              }
            }
            if (total + ptsPx.length > POINT_BUDGET) break;
            for (const q of ptsPx) { const oi = occAt(q[0], q[1]); if (occ[oi] < 255) occ[oi]++; }
            const mm = ptsPx.map(toMM);
            paths.push({ pts: mm, closed: false, layer: L0 });
            total += mm.length;
            featCount++;
            depositPath(mm, false);
          }
        };
        if (!oneLine) {
          drawFlow(A.regions && A.regions.hair, A.hairFlow, 331, 8);
          /* beard lanes tighter - whiskers pack denser than scalp hair */
          drawFlow(A.regions && A.regions.beard, A.beardFlow, 733, 6);
        }
      /* ============ ONE LINE (Picasso, spec phase 3) ============
         Order the collected chains with a small endpoint-TSP (greedy NN +
         seeded pair-swap improvement), then link them with light bezier arcs
         that bulge AWAY from the face centroid - transitions ride over the
         cheeks and forehead, and the pen never lifts. */
      if (oneLine) {
        if (!segs.length) return applyStyle({ paths: [] }, ins[0]);
        let ccx = 0, ccy = 0, cn = 0;
        for (const s of segs) for (const q of s.pts) { ccx += q[0]; ccy += q[1]; cn++; }
        ccx /= cn; ccy /= cn;
        const tip = (s, rev) => s.closed ? s.pts[0] : (rev ? s.pts[0] : s.pts[s.pts.length - 1]);
        const entry = (s, from) => { /* nearest entry point index + reversed flag */
          if (s.closed) {
            let bi = 0, bd = Infinity;
            for (let i = 0; i < s.pts.length; i += 2) {
              const dd = (s.pts[i][0] - from[0]) ** 2 + (s.pts[i][1] - from[1]) ** 2;
              if (dd < bd) { bd = dd; bi = i; }
            }
            return { d: Math.sqrt(bd), i: bi, rev: false };
          }
          const d0 = Math.hypot(s.pts[0][0] - from[0], s.pts[0][1] - from[1]);
          const d1 = Math.hypot(s.pts[s.pts.length - 1][0] - from[0], s.pts[s.pts.length - 1][1] - from[1]);
          return d0 <= d1 ? { d: d0, i: 0, rev: false } : { d: d1, i: 0, rev: true };
        };
        /* order by greedy NN, then improve with seeded pair swaps */
        const orderCost = (ord) => {
          let c = 0, at = segs[ord[0]].pts[0];
          for (let k = 0; k < ord.length; k++) {
            const e = entry(segs[ord[k]], at);
            c += e.d;
            at = tip(segs[ord[k]], e.rev);
          }
          return c;
        };
        let order = [];
        {
          const used = new Uint8Array(segs.length);
          let cur = 0; /* start at the first collected chain (deterministic) */
          used[0] = 1; order.push(0);
          let at = tip(segs[0], false);
          for (let k = 1; k < segs.length; k++) {
            let bi = -1, bd = Infinity, be = null;
            for (let j = 0; j < segs.length; j++) {
              if (used[j]) continue;
              const e = entry(segs[j], at);
              if (e.d < bd) { bd = e.d; bi = j; be = e; }
            }
            used[bi] = 1; order.push(bi);
            at = tip(segs[bi], be.rev);
          }
          const rngO = mulberry32(p.seed * 7919 + 577);
          let cost = orderCost(order);
          for (let it = 0; it < 3000; it++) {
            const i = 1 + Math.floor(rngO() * (order.length - 1));
            const j = 1 + Math.floor(rngO() * (order.length - 1));
            if (i === j) continue;
            const cand = order.slice();
            const t = cand[i]; cand[i] = cand[j]; cand[j] = t;
            const cc = orderCost(cand);
            if (cc < cost) { order = cand; cost = cc; }
          }
        }
        /* walk the order, linking with quadratic arcs */
        const line = [];
        const pushPts = (pts2) => { for (const q of pts2) line.push(q); };
        const bez = (a, c, b) => {
          const LSTEP = 2.5; /* px, same density as the chain resample */
          const out = [];
          const n2 = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / LSTEP));
          for (let k = 1; k <= n2; k++) {
            const t = k / n2, u = 1 - t;
            out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
                      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
          }
          return out;
        };
        let at = null;
        for (const oi of order) {
          const s = segs[oi];
          const e = at ? entry(s, at) : { i: 0, rev: false };
          let pts2;
          if (s.closed) {
            pts2 = s.pts.slice(e.i).concat(s.pts.slice(0, e.i));
            pts2.push(pts2[0].slice()); /* traverse the loop and come back */
          } else pts2 = e.rev ? s.pts.slice().reverse() : s.pts.slice();
          if (at) {
            const target = pts2[0];
            const mx = (at[0] + target[0]) / 2, my = (at[1] + target[1]) / 2;
            const away = Math.hypot(mx - ccx, my - ccy) || 1;
            const bulge = Math.min(30, Math.hypot(target[0] - at[0], target[1] - at[1]) * 0.35);
            const ctrl = [mx + ((mx - ccx) / away) * bulge, my + ((my - ccy) / away) * bulge];
            pushPts(bez(at, ctrl, target));
          } else line.push(pts2[0]);
          pushPts(pts2.slice(1));
          at = line[line.length - 1];
        }
        if (line.length < 2) return applyStyle({ paths: [] }, ins[0]);
        const mm = line.slice(0, POINT_BUDGET).map(toMM);
        return applyStyle({ paths: [{ pts: mm, closed: false, layer: L0 }] }, ins[0]);
      }
      } /* end if (A) */
      if (p.mode === "Features only" && featCount > 0) return applyStyle({ paths }, ins[0]);
      penShift = featCount > 0 ? 1 : 0;
      /* Features only with nothing to draw falls through to Tonal (degrade) */
    }

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
        /* Sketch nerve: nervous lateral wobble on shading strokes (Tresset);
           coordinate noise only - the rng streams and prefix stay untouched.
           A wobbled point never enters a white-cutoff cell. */
        if (NERVE > 0) {
          const wAmp = NERVE * penW * 1.1;
          for (let i = 0; i < pts.length; i++) {
            const [qx, qy] = pts[i];
            const wx = qx + (noise2(qx * 0.9, qy * 0.9 + 4.2) - 0.5) * 2 * wAmp;
            const wy = qy + (noise2(qx * 0.9 + 9.1, qy * 0.9) - 0.5) * 2 * wAmp;
            const wi = cellIdxAt(wx, wy);
            if (wi >= 0 && !cutM[wi]) pts[i] = [wx, wy];
          }
        }

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
};
