import { Pin, EMPTY, mulberry32, noise2, resample, pathLength, applyStyle, signedArea } from "../helpers.js";
import { guillocheFamily, guillocheSamples, guillocheCurveCount } from "../guilloche-family.js";
import { clipPolylineToRect } from "../clip-rectangle.js";

export default {
  key: "bg_fill",
  name: "BG Fill",
  cat: "gen",
  group: "geometric",
  desc: "Eight full-sheet background fills in one node, picked with Mode. Drape: concentric fur-stroke arc bands folded by sharp creases like hanging fabric. Magnet: iron-filing dashes tracing a two-pole field, Attract or Repel. Grain: dense parallel woodgrain lines that part around voids and leave them blank. Scales: staggered fish-scale rows rendered as rain of vertical dashes, best with a light pen on dark paper. Torn: fine straight strokes fanning off a diagonal spine and stopping at a wobbly lens-shaped rip. Pleat: vertical lines pinched into a diamond pleat grid like folded wallpaper. Circles: greedy largest-first circle packing, tangent at Gap 0 for the Apollonian look; Rings fills every circle with concentric rings at Line pitch. Guilloché: a real security-paper backdrop - identical banknote plates (Rosette, Rings, Fan, Weave or Spiral) tiled edge to edge across the whole sheet, so the fine lines fill every corner instead of one round region. Motif size and Overlap set the lattice spacing; Waves, Copies, Amplitude, Growth and Jitter shape each motif exactly like the Guilloché node; Fill collapses each plate's ring family toward its centre so every motif becomes a complete bullseye and the tiled field covers every millimetre - lower it for a mesh of open rings; Angle rotates the whole lattice, and an optional Accent share draws part of every motif in a second pen; the Margin frame trims the lattice like every other mode - set it to 0 for true edge-to-edge engraving. The field reduces sampling and, when necessary, grows the lattice spacing evenly to keep the whole sheet within the point budget; enlarge Motif size for smoother lines. The optional Void input cuts wired geometry out of every mode - closed interiors AND a Void clearance band around every line, open or closed, so a wired Ribbon carves its stroke out of the fill; in Grain mode the flow also bends around them (built-in seeded voids are used when nothing is wired) while open lines deflect the flow like riverbanks, and in Torn mode a wired path becomes the rip itself: rays shoot out of it From center or Perpendicular to the line, open polylines raying both sides. Line pitch is the master density for the other modes - halve it for double ink. Tip: two BG Fills on different pens with different modes make an instant layered backdrop.",
  ins: [Pin("style", "Style"), Pin("paths", "Void")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Drape", "Magnet", "Grain", "Scales", "Torn", "Pleat", "Circles", "Guilloché"], def: "Grain" },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "pitch", label: "Line pitch", type: "slider", min: 0.6, max: 4, step: 0.05, def: 1.2 },
    { key: "folds", label: "Folds", type: "slider", min: 0, max: 12, step: 1, def: 5, showIf: (p) => p.mode === "Drape" },
    { key: "foldDepth", label: "Fold depth", type: "slider", min: 0, max: 40, step: 0.5, def: 18, showIf: (p) => p.mode === "Drape" },
    { key: "bandW", label: "Band width", type: "slider", min: 4, max: 40, step: 0.5, def: 14, showIf: (p) => p.mode === "Drape" },
    { key: "bandGap", label: "Band gap", type: "slider", min: 0, max: 0.6, step: 0.01, def: 0.22, showIf: (p) => p.mode === "Drape" },
    { key: "strokeLen", label: "Stroke length", type: "slider", min: 2, max: 20, step: 0.5, def: 8, showIf: (p) => p.mode === "Drape" },
    { key: "fuzz", label: "Fuzz", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5, showIf: (p) => p.mode === "Drape" },
    { key: "poles", label: "Poles", type: "select", options: ["Attract", "Repel"], def: "Attract", showIf: (p) => p.mode === "Magnet" },
    { key: "poleDist", label: "Pole distance", type: "slider", min: 40, max: 240, step: 1, def: 130, showIf: (p) => p.mode === "Magnet" },
    { key: "dashLen", label: "Dash length", type: "slider", min: 1, max: 10, step: 0.1, def: 3.5, showIf: (p) => p.mode === "Magnet" },
    { key: "density", label: "Density", type: "slider", min: 0.2, max: 3, step: 0.05, def: 1, showIf: (p) => p.mode === "Magnet" },
    { key: "falloff", label: "Pole falloff", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55, showIf: (p) => p.mode === "Magnet" },
    { key: "gDir", label: "Direction", type: "select", options: ["Vertical", "Horizontal"], def: "Vertical", showIf: (p) => p.mode === "Grain" },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35, showIf: (p) => p.mode === "Grain" },
    { key: "wscale", label: "Wobble scale", type: "slider", min: 20, max: 200, step: 1, def: 90, showIf: (p) => p.mode === "Grain" },
    { key: "voids", label: "Voids", type: "slider", min: 0, max: 5, step: 1, def: 2, showIf: (p) => p.mode === "Grain" },
    { key: "voidSize", label: "Void size", type: "slider", min: 5, max: 60, step: 0.5, def: 22, showIf: (p) => p.mode === "Grain" },
    { key: "push", label: "Flow push", type: "slider", min: 0, max: 1, step: 0.01, def: 0.7, showIf: (p) => p.mode === "Grain" },
    { key: "crack", label: "Crack", type: "check", def: false, showIf: (p) => p.mode === "Grain" },
    { key: "scaleW", label: "Scale width", type: "slider", min: 6, max: 40, step: 0.5, def: 16, showIf: (p) => p.mode === "Scales" },
    { key: "rowOver", label: "Row overlap", type: "slider", min: 0.3, max: 0.9, step: 0.01, def: 0.55, showIf: (p) => p.mode === "Scales" },
    { key: "lenVary", label: "Length vary", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5, showIf: (p) => p.mode === "Scales" },
    { key: "rayMode", label: "Rays", type: "select", options: ["From center", "Perpendicular"], def: "From center", showIf: (p) => p.mode === "Torn" },
    { key: "spineAng", label: "Spine angle", type: "slider", min: 0, max: 180, step: 1, def: 45, showIf: (p) => p.mode === "Torn" },
    { key: "voidLen", label: "Rip length", type: "slider", min: 20, max: 90, step: 1, def: 55, showIf: (p) => p.mode === "Torn" },
    { key: "voidW", label: "Rip width", type: "slider", min: 5, max: 80, step: 0.5, def: 32, showIf: (p) => p.mode === "Torn" },
    { key: "vWobble", label: "Rip wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5, showIf: (p) => p.mode === "Torn" },
    { key: "fan", label: "Fan", type: "slider", min: 0, max: 1, step: 0.01, def: 0.5, showIf: (p) => p.mode === "Torn" },
    { key: "cMin", label: "Min radius", type: "slider", min: 0.8, max: 10, step: 0.1, def: 2, showIf: (p) => p.mode === "Circles" },
    { key: "cMax", label: "Max radius", type: "slider", min: 10, max: 120, step: 1, def: 55, showIf: (p) => p.mode === "Circles" },
    { key: "cGap", label: "Gap", type: "slider", min: 0, max: 3, step: 0.05, def: 0, showIf: (p) => p.mode === "Circles" },
    { key: "cStyle", label: "Circle style", type: "select", options: ["Outline", "Rings"], def: "Outline", showIf: (p) => p.mode === "Circles" },
    { key: "cellW", label: "Diamond width", type: "slider", min: 15, max: 80, step: 1, def: 38, showIf: (p) => p.mode === "Pleat" },
    { key: "cellH", label: "Diamond height", type: "slider", min: 15, max: 80, step: 1, def: 30, showIf: (p) => p.mode === "Pleat" },
    { key: "foldP", label: "Fold depth", type: "slider", min: 0, max: 1, step: 0.01, def: 0.6, showIf: (p) => p.mode === "Pleat" },
    { key: "stagger", label: "Stagger", type: "check", def: true, showIf: (p) => p.mode === "Pleat" },
    { key: "gStyle", label: "Plate", type: "select", options: ["Rosette", "Rings", "Fan", "Weave", "Spiral"], def: "Rosette", showIf: (p) => p.mode === "Guilloché" },
    { key: "gWaves", label: "Waves", type: "slider", min: 4, max: 360, step: 1, def: 48, showIf: (p) => p.mode === "Guilloché" },
    { key: "gCopies", label: "Copies", type: "slider", min: 1, max: 200, step: 1, def: 14, showIf: (p) => p.mode === "Guilloché" },
    { key: "gAmp", label: "Amplitude", type: "slider", min: 0, max: 2, step: 0.01, def: 0.18, showIf: (p) => p.mode === "Guilloché" },
    { key: "gGrowth", label: "Growth", type: "slider", min: 0, max: 1, step: 0.002, def: 0.012, showIf: (p) => p.mode === "Guilloché" && p.gStyle !== "Fan" && p.gStyle !== "Spiral" },
    { key: "gJit", label: "Jitter", type: "slider", min: 0, max: 5, step: 0.01, def: 0.15, showIf: (p) => p.mode === "Guilloché" },
    { key: "gAngle", label: "Angle °", type: "slider", min: -360, max: 360, step: 1, def: 0, showIf: (p) => p.mode === "Guilloché" },
    { key: "gSize", label: "Motif size", type: "slider", min: 20, max: 600, step: 5, def: 180, showIf: (p) => p.mode === "Guilloché" },
    { key: "gOver", label: "Overlap", type: "slider", min: 0, max: 0.95, step: 0.01, def: 0.45, showIf: (p) => p.mode === "Guilloché" },
    { key: "gFill", label: "Fill", type: "slider", min: 0, max: 1, step: 0.01, def: 1, showIf: (p) => p.mode === "Guilloché" },
    { key: "gAccent", label: "Accent %", type: "slider", min: 0, max: 100, step: 1, def: 0, showIf: (p) => p.mode === "Guilloché" },
    { key: "pen2", label: "Accent pen", type: "pen", def: 3, showIf: (p) => p.mode === "Guilloché" },
    { key: "vClear", label: "Void clearance", type: "slider", min: 0, max: 20, step: 0.25, def: 2 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  overlay(p, ctx, ins) {
    const g = [];
    const m = Math.max(0, p.margin || 0);
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    g.push({ kind: "rect", x: m, y: m, w: Math.max(1, W - 2 * m), h: Math.max(1, H - 2 * m) });
    try {
      const seed = Math.round(p.seed || 0);
      if (p.mode === "Magnet") {
        const d = Math.max(10, p.poleDist) / 2;
        const rng = mulberry32(seed * 7 + 11);
        const ang = (rng() - 0.5) * 0.5;
        const ux = Math.cos(ang), uy = Math.sin(ang);
        g.push({ kind: "point", x: W / 2 - ux * d, y: H / 2 - uy * d });
        g.push({ kind: "point", x: W / 2 + ux * d, y: H / 2 + uy * d });
      }
      if (p.mode === "Guilloché") {
        const size = Math.max(20, p.gSize || 180);
        const N = Math.max(1, Math.round(p.gCopies || 14));
        const growth = p.gStyle === "Fan" || p.gStyle === "Spiral" ? 0 : Math.max(0, p.gGrowth || 0);
        const ext = size * (1 + (N - 1) * growth) + size * Math.max(0, p.gAmp || 0) * (1 + 0.5 * Math.max(0, p.gJit || 0)) + 2;
        g.push({ kind: "circle", cx: W / 2, cy: H / 2, r: ext });
      }
      if (p.mode === "Torn") {
        const a = ((p.spineAng || 0) * Math.PI) / 180;
        const ux = Math.cos(a), uy = Math.sin(a);
        const L = Math.hypot(W, H) * 0.5;
        g.push({ kind: "arrow", x1: W / 2 - ux * L, y1: H / 2 - uy * L, x2: W / 2 + ux * L, y2: H / 2 + uy * L });
      }
      if (p.mode === "Grain") {
        const wired = ins && ins[1] && ins[1].paths && ins[1].paths.length;
        if (!wired) {
          const nv = Math.max(0, Math.round(p.voids || 0));
          const rng = mulberry32(seed * 131 + 5);
          for (let i = 0; i < nv && i < 8; i++) {
            const cx = m + (0.15 + 0.7 * rng()) * (W - 2 * m);
            const cy = m + (0.15 + 0.7 * rng()) * (H - 2 * m);
            const r = Math.max(2, p.voidSize) * (0.5 + 0.6 * rng());
            rng(); rng();
            g.push({ kind: "circle", cx, cy, r });
          }
        }
      }
      const vin = ins && ins[1];
      if (vin && vin.paths) {
        let n = 0;
        for (const q of vin.paths) {
          if (q.closed && q.pts && q.pts.length >= 3 && n < 20) { g.push({ kind: "poly", pts: q.pts }); n++; }
        }
      }
    } catch (e) {}
    return g;
  },

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const m = Math.max(0, p.margin);
    const lox = m, loy = m, hix = W - m, hiy = H - m;
    const bw = hix - lox, bh = hiy - loy;
    if (bw < 10 || bh < 10) return EMPTY;
    const seed = Math.round(p.seed);
    const pitch = Math.max(0.3, p.pitch);
    const layer = Math.max(0, Math.min(11, Math.round(p.layer)));
    const BUDGET = 115000;
    let cnt = 0;
    const paths = [];
    const emit = (pts, closed) => {
      if (cnt >= BUDGET || pts.length < 2) return;
      if (cnt + pts.length > BUDGET) pts = pts.slice(0, Math.max(2, BUDGET - cnt));
      cnt += pts.length;
      paths.push({ pts, closed: !!closed, layer });
    };
    const inBox = (x, y) => x >= lox && x <= hix && y >= loy && y <= hiy;

    /* Void input: closed interiors cut, and EVERY line (open or closed) occupies
       a clearance band around it, Negative Space style - a wired Ribbon carves
       its stroke out of the fill */
    const voidPolys = [];
    const voidSegPaths = [];
    const clr = Math.max(0, p.vClear);
    const vin = ins[1];
    if (vin && vin.paths) {
      let totLen = 0;
      for (const q of vin.paths) if (q.pts && q.pts.length >= 2) totLen += pathLength(q.pts, !!q.closed);
      const segStep = Math.max(2, totLen / 1500);
      let rawBudget = 3000;
      for (const q of vin.paths) {
        if (!q.pts || q.pts.length < 2) continue;
        if (q.closed && q.pts.length >= 3 && voidPolys.length < 64) {
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, cx = 0, cy = 0;
          for (const pt of q.pts) {
            if (pt[0] < x0) x0 = pt[0]; if (pt[0] > x1) x1 = pt[0];
            if (pt[1] < y0) y0 = pt[1]; if (pt[1] > y1) y1 = pt[1];
            cx += pt[0]; cy += pt[1];
          }
          cx /= q.pts.length; cy /= q.pts.length;
          const r = Math.max(1, Math.sqrt(Math.abs(signedArea(q.pts)) / Math.PI));
          voidPolys.push({ pts: q.pts, x0, y0, x1, y1, cx, cy, r });
        }
        if (voidSegPaths.length < 64) {
          /* keep original points when affordable - resampling shaves sharp corners */
          const useRaw = q.pts.length <= 400 && rawBudget >= q.pts.length;
          if (useRaw) rawBudget -= q.pts.length;
          const rp = useRaw ? q.pts : resample(q.pts, !!q.closed, segStep);
          if (rp && rp.length >= 2) {
            const ptsL = q.closed ? [...rp, rp[0]] : rp;
            const segs = [];
            let sx0 = 1e9, sy0 = 1e9, sx1 = -1e9, sy1 = -1e9;
            for (const pt of ptsL) {
              if (pt[0] < sx0) sx0 = pt[0]; if (pt[0] > sx1) sx1 = pt[0];
              if (pt[1] < sy0) sy0 = pt[1]; if (pt[1] > sy1) sy1 = pt[1];
            }
            for (let i = 1; i < ptsL.length; i++) segs.push([ptsL[i - 1][0], ptsL[i - 1][1], ptsL[i][0], ptsL[i][1]]);
            voidSegPaths.push({ segs, open: !q.closed, x0: sx0, y0: sy0, x1: sx1, y1: sy1 });
          }
        }
      }
    }
    const hasVoid = voidPolys.length > 0 || voidSegPaths.length > 0;
    const closestOnSeg = (x, y, s) => {
      const dx = s[2] - s[0], dy = s[3] - s[1];
      const L2 = dx * dx + dy * dy;
      const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / L2));
      return [s[0] + dx * t, s[1] + dy * t];
    };
    let segBuckets = null;
    const allSegs = [];
    for (const g of voidSegPaths) for (const sg of g.segs) allSegs.push(sg);
    const segBS = Math.max(3, clr * 1.5 + 2);
    if (allSegs.length && clr > 0) {
      segBuckets = new Map();
      allSegs.forEach((sgm, i) => {
        const sx0 = Math.min(sgm[0], sgm[2]) - clr, sx1 = Math.max(sgm[0], sgm[2]) + clr;
        const sy0 = Math.min(sgm[1], sgm[3]) - clr, sy1 = Math.max(sgm[1], sgm[3]) + clr;
        for (let by = Math.floor(sy0 / segBS); by <= Math.floor(sy1 / segBS); by++) {
          for (let bx = Math.floor(sx0 / segBS); bx <= Math.floor(sx1 / segBS); bx++) {
            const k = bx + "," + by;
            let a = segBuckets.get(k);
            if (!a) { a = []; segBuckets.set(k, a); }
            a.push(i);
          }
        }
      });
    }
    const nearLine = (x, y) => {
      const a = segBuckets.get(Math.floor(x / segBS) + "," + Math.floor(y / segBS));
      if (!a) return false;
      for (const i of a) {
        const [qx, qy] = closestOnSeg(x, y, allSegs[i]);
        const ddx = x - qx, ddy = y - qy;
        if (ddx * ddx + ddy * ddy <= clr * clr) return true;
      }
      return false;
    };
    const inPoly = (pts, x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const inAnyVoid = (x, y) => {
      if (segBuckets && nearLine(x, y)) return true;
      for (const v of voidPolys) {
        if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
        if (inPoly(v.pts, x, y)) return true;
      }
      return false;
    };
    /* march a point stream, splitting into separate paths at void / box cuts */
    const emitClipped = (stream) => {
      let cur = [];
      for (const pt of stream) {
        const okp = pt && inBox(pt[0], pt[1]) && !(hasVoid && inAnyVoid(pt[0], pt[1]));
        if (okp) cur.push(pt);
        else { if (cur.length >= 2) emit(cur); cur = []; }
      }
      if (cur.length >= 2) emit(cur);
    };

    /* ============================ DRAPE ============================ */
    if (p.mode === "Drape") {
      const rng = mulberry32(seed * 9173 + 1);
      const cx = lox - (0.05 + 0.2 * rng()) * bw;
      const cy = loy + (0.2 + 0.6 * rng()) * bh;
      const nf = Math.max(0, Math.round(p.folds));
      const depth = Math.max(0, p.foldDepth);
      /* creases: sharp zigzag radial offset as a function of y */
      const by = [], bv = [];
      by.push(loy - 20); bv.push(0);
      let yy = loy;
      for (let i = 0; i < nf; i++) {
        yy += (bh / Math.max(1, nf)) * (0.5 + rng());
        if (yy > hiy) break;
        by.push(yy);
        bv.push((rng() - 0.5) * 2 * depth);
      }
      by.push(hiy + 20); bv.push((rng() - 0.5) * 2 * depth * 0.5);
      const F = (y) => {
        let i = 0;
        while (i < by.length - 2 && y > by[i + 1]) i++;
        const t = Math.min(1, Math.max(0, (y - by[i]) / Math.max(1e-6, by[i + 1] - by[i])));
        return bv[i] + (bv[i + 1] - bv[i]) * t;
      };
      /* visible angle range from box corners */
      let a0 = 1e9, a1 = -1e9;
      for (const [qx, qy] of [[lox, loy], [hix, loy], [lox, hiy], [hix, hiy]]) {
        const a = Math.atan2(qy - cy, qx - cx);
        if (a < a0) a0 = a; if (a > a1) a1 = a;
      }
      a0 -= 0.08; a1 += 0.08;
      const rMax = Math.max(
        Math.hypot(hix - cx, loy - cy), Math.hypot(hix - cx, hiy - cy),
        Math.hypot(lox - cx, loy - cy), Math.hypot(lox - cx, hiy - cy)) + depth + 5;
      const band = Math.max(3, p.bandW);
      const gapF = Math.min(0.9, Math.max(0, p.bandGap));
      const fillW = band * (1 - gapF);
      const sLen = Math.max(1, p.strokeLen);
      const fz = Math.min(1, Math.max(0, p.fuzz));
      const ds = Math.max(0.9, pitch * 0.9);
      const srng = mulberry32(seed * 271 + 9);
      for (let r0 = band * 0.5; r0 < rMax && cnt < BUDGET; r0 += band) {
        for (let rr = r0; rr < r0 + fillW && cnt < BUDGET; rr += pitch) {
          /* march the folded contour re(x,y)=rr in short fur strokes */
          let a = a0;
          let stroke = [];
          let sTarget = sLen * (0.6 + 0.8 * srng());
          let sAcc = 0;
          let rJit = (srng() - 0.5) * pitch * 0.9 * fz;
          let drift = (srng() - 0.5) * 0.06 * fz;
          while (a <= a1 && cnt < BUDGET) {
            /* solve r = rr - F(y) by fixed point */
            let r = rr;
            for (let k = 0; k < 3; k++) r = rr - F(cy + r * Math.sin(a));
            const rEff = r + rJit + sAcc * drift;
            const x = cx + rEff * Math.cos(a), y = cy + rEff * Math.sin(a);
            const okp = inBox(x, y) && !(hasVoid && inAnyVoid(x, y));
            if (okp) stroke.push([x, y]); else { if (stroke.length >= 2) emit(stroke); stroke = []; sAcc = 0; }
            const step = ds / Math.max(8, rEff);
            a += step; sAcc += ds;
            if (sAcc >= sTarget) {
              if (stroke.length >= 2) emit(stroke);
              stroke = []; sAcc = 0;
              sTarget = sLen * (0.6 + 0.8 * srng());
              rJit = (srng() - 0.5) * pitch * 0.9 * fz;
              drift = (srng() - 0.5) * 0.06 * fz;
              a += (ds * (0.3 + 0.8 * srng() * fz)) / Math.max(8, rEff);
            }
          }
          if (stroke.length >= 2) emit(stroke);
        }
      }
    }

    /* ============================ MAGNET ============================ */
    if (p.mode === "Magnet") {
      const rng = mulberry32(seed * 7 + 11);
      const ang = (rng() - 0.5) * 0.5;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const d = Math.max(10, p.poleDist) / 2;
      const p1x = W / 2 - ux * d, p1y = H / 2 - uy * d;
      const p2x = W / 2 + ux * d, p2y = H / 2 + uy * d;
      const q2 = p.poles === "Repel" ? 1 : -1;
      const dl = Math.max(0.8, p.dashLen);
      const fo = Math.min(1, Math.max(0, p.falloff));
      const field = (x, y) => {
        let fx = 0, fy = 0;
        const d1x = x - p1x, d1y = y - p1y, r1 = d1x * d1x + d1y * d1y + 1e-6;
        const d2x = x - p2x, d2y = y - p2y, r2 = d2x * d2x + d2y * d2y + 1e-6;
        fx += d1x / r1; fy += d1y / r1;
        fx += (q2 * d2x) / r2; fy += (q2 * d2y) / r2;
        const L = Math.hypot(fx, fy) + 1e-9;
        return [fx / L, fy / L];
      };
      const nWant = Math.round(((bw * bh) / (pitch * dl)) * 0.55 * Math.max(0.05, p.density));
      const N = Math.min(nWant, Math.floor(BUDGET / 5));
      const drng = mulberry32(seed * 4241 + 3);
      let tries = 0;
      let made = 0;
      while (made < N && tries < N * 6 && cnt < BUDGET) {
        tries++;
        const x = lox + drng() * bw, y = loy + drng() * bh;
        const dm = Math.min(Math.hypot(x - p1x, y - p1y), Math.hypot(x - p2x, y - p2y));
        if (dm < 4.5) continue;
        const keep = (1 - fo) + fo * Math.min(1, 18 / dm);
        if (drng() > keep) continue;
        const len = dl * (0.55 + 0.9 * drng());
        const half = len / 2, step = Math.max(0.7, len / 4);
        const pts = [[x, y]];
        let cxp = x, cyp = y;
        for (let s = 0; s < half; s += step) {
          const [fx, fy] = field(cxp, cyp);
          cxp += fx * step; cyp += fy * step;
          pts.push([cxp, cyp]);
        }
        cxp = x; cyp = y;
        for (let s = 0; s < half; s += step) {
          const [fx, fy] = field(cxp, cyp);
          cxp -= fx * step; cyp -= fy * step;
          pts.unshift([cxp, cyp]);
        }
        let okAll = true;
        for (const pt of pts) if (!inBox(pt[0], pt[1]) || (hasVoid && inAnyVoid(pt[0], pt[1]))) { okAll = false; break; }
        if (!okAll) continue;
        emit(pts);
        made++;
      }
    }

    /* ============================ GRAIN ============================ */
    if (p.mode === "Grain") {
      const vert = p.gDir !== "Horizontal";
      const rng = mulberry32(seed * 131 + 5);
      /* built-in voids only when nothing is wired */
      const gv = [];
      if (!hasVoid) {
        const nv = Math.max(0, Math.round(p.voids));
        for (let i = 0; i < nv; i++) {
          const cx = lox + (0.15 + 0.7 * rng()) * bw;
          const cy = loy + (0.15 + 0.7 * rng()) * bh;
          const r = Math.max(2, p.voidSize) * (0.5 + 0.6 * rng());
          const el = 1.3 + 1.2 * rng();
          const ph = rng() * 100;
          gv.push({ cx, cy, r, el, ph });
        }
        if (p.crack) {
          const cx = lox + (0.2 + 0.6 * rng()) * bw;
          gv.push({ cx, cy: (loy + hiy) / 2, r: 2.2, el: bh / 2.2, ph: rng() * 100, crack: true });
        }
      } else {
        for (const v of voidPolys) gv.push({ cx: v.cx, cy: v.cy, r: v.r, el: 1, ph: 0, poly: v });
      }
      const wob = Math.min(1, Math.max(0, p.wobble));
      const ws = Math.max(5, p.wscale);
      const pushK = Math.min(1, Math.max(0, p.push));
      /* open input lines deflect the flow like riverbanks */
      const R = clr * 4 + 10;
      const openSegs = [];
      for (const g of voidSegPaths) if (g.open) for (const sg of g.segs) openSegs.push(sg);
      let obk = null;
      if (openSegs.length) {
        obk = new Map();
        openSegs.forEach((sgm, i) => {
          const sx0 = Math.min(sgm[0], sgm[2]) - R, sx1 = Math.max(sgm[0], sgm[2]) + R;
          const sy0 = Math.min(sgm[1], sgm[3]) - R, sy1 = Math.max(sgm[1], sgm[3]) + R;
          for (let by = Math.floor(sy0 / R); by <= Math.floor(sy1 / R); by++) {
            for (let bx = Math.floor(sx0 / R); bx <= Math.floor(sx1 / R); bx++) {
              const k = bx + "," + by;
              let a = obk.get(k);
              if (!a) { a = []; obk.set(k, a); }
              a.push(i);
            }
          }
        });
      }
      const along = vert ? bh : bw;
      const across = vert ? bw : bh;
      const stepA = 1.4;
      const n0 = vert ? lox : loy;
      for (let li = n0; li <= n0 + across && cnt < BUDGET; li += pitch) {
        const stream = [];
        for (let t = 0; t <= along; t += stepA) {
          const bx = vert ? li : lox + t;
          const by = vert ? loy + t : li;
          /* coherent waviness: low frequency across lines, wobble along */
          const nA = vert ? bx : by, nB = vert ? by : bx;
          let off = wob * 18 * (noise2(nA * 0.02, nB / ws, seed) - 0.5) * 2;
          let cut = false;
          for (const v of gv) {
            const dx = bx - v.cx, dy = (by - v.cy) / v.el;
            const dd = Math.hypot(dx, dy) + 1e-6;
            let bnd = v.r;
            if (!v.poly) {
              bnd = v.r * (1 + 0.35 * (noise2(Math.atan2(dy, dx) * 1.6 + v.ph, v.ph, seed + 77) - 0.5) * 2);
              if (dd < bnd) { cut = true; break; }
            }
            const s = Math.min(1, bnd / dd);
            const pk = pushK * bnd * s * s;
            if (vert) off += (dx / dd) * pk; else off += ((by - v.cy) / (dd * v.el)) * pk;
          }
          if (cut) { stream.push(null); continue; }
          if (obk) {
            const a = obk.get(Math.floor(bx / R) + "," + Math.floor(by / R));
            if (a) {
              /* vector sum over nearby segments: opposite banks cancel, so the
                 corridor inside a ribbon stays calm and gets cut cleanly */
              let bd = R, wx = 0, wy = 0, wsum = 0;
              for (const i2 of a) {
                const [px2, py2] = closestOnSeg(bx, by, openSegs[i2]);
                const d2 = Math.max(1e-6, Math.hypot(bx - px2, by - py2));
                if (d2 >= R) continue;
                if (d2 < bd) bd = d2;
                const w = (1 - d2 / R) * (1 - d2 / R);
                wx += ((bx - px2) / d2) * w;
                wy += ((by - py2) / d2) * w;
                wsum += w;
              }
              if (bd < R && wsum > 1e-6) {
                const mag = Math.hypot(wx, wy);
                const coher = Math.min(1, mag / wsum);
                const fall = 1 - bd / R;
                const amt = pushK * R * 0.55 * fall * fall * coher;
                if (mag > 1e-6) {
                  if (vert) off += (wx / mag) * amt; else off += (wy / mag) * amt;
                }
              }
            }
          }
          const x = vert ? bx + off : bx;
          const y = vert ? by : by + off;
          stream.push([x, y]);
        }
        if (((li - n0) / pitch) % 2 > 0.99) stream.reverse();
        emitClipped(stream);
      }
    }

    /* ============================ SCALES ============================ */
    if (p.mode === "Scales") {
      const sw = Math.max(4, p.scaleW);
      const R = sw / 2;
      const sy = Math.max(2, R * 2 * Math.min(0.95, Math.max(0.2, p.rowOver)));
      const lv = Math.min(1, Math.max(0, p.lenVary));
      const rows = Math.ceil(bh / sy) + 2;
      /* arc y of the row's scale surface at x, bulging down */
      const arcY = (row, x) => {
        const stag = (row % 2 + 2) % 2 ? sw / 2 : 0;
        const cy = loy + row * sy;
        const i = Math.round((x - lox - stag) / sw);
        const cx = lox + stag + i * sw;
        const dx = x - cx;
        if (Math.abs(dx) > R) return cy;
        return cy - Math.sqrt(Math.max(0, R * R - dx * dx));
      };
      const drng = mulberry32(seed * 613 + 21);
      for (let row = -1; row < rows && cnt < BUDGET; row++) {
        const dir = row % 2 ? -1 : 1;
        for (let ci = 0; ci <= Math.floor(bw / pitch) && cnt < BUDGET; ci++) {
          const x = dir > 0 ? lox + ci * pitch : hix - ci * pitch;
          const y0 = arcY(row, x);
          const y1 = arcY(row + 1, x);
          if (y1 - y0 < 1.2) continue;
          const trim = 1 - lv * drng() * 0.75;
          const ya = Math.max(loy, y0);
          const yb = Math.min(hiy, y0 + (y1 - y0) * trim);
          if (yb - ya < 1.0) continue;
          const stream = [];
          for (let y = ya; y <= yb; y += 1.6) stream.push([x, y]);
          stream.push([x, yb]);
          emitClipped(stream);
        }
      }
    }

    /* ============================ TORN ============================ */
    if (p.mode === "Torn" && vin && vin.paths && vin.paths.some((q) => q.pts && q.pts.length >= 2)) {
      /* wired: the input paths are the rip - rays radiate out of them */
      const radial = p.rayMode !== "Perpendicular";
      const vwb = Math.min(1, Math.max(0, p.vWobble));
      const reach = Math.hypot(bw, bh) * 1.1;
      const bstep = Math.max(0.8, pitch);
      const marchRay = (bx, by, dx0, dy0) => {
        const wg = vwb * 0.35 * (noise2(bx * 0.05, by * 0.05, seed + 31) - 0.5) * 2;
        const cw2 = Math.cos(wg), sw2 = Math.sin(wg);
        const dxr = dx0 * cw2 - dy0 * sw2, dyr = dx0 * sw2 + dy0 * cw2;
        const stream = [];
        let entered = false, rIn = 0;
        for (let r = 0.5; r <= reach; r += 1.6) {
          const x = bx + dxr * r, y = by + dyr * r;
          if (inBox(x, y)) {
            if (!entered && r > 0.5) {
              let a2 = Math.max(0.5, r - 1.6), b2 = r;
              for (let k2 = 0; k2 < 5; k2++) {
                const mid = (a2 + b2) / 2;
                if (inBox(bx + dxr * mid, by + dyr * mid)) b2 = mid; else a2 = mid;
              }
              stream.push([bx + dxr * b2, by + dyr * b2]);
            }
            entered = true; rIn = r;
            stream.push([x, y]);
          } else if (entered) {
            let a2 = rIn, b2 = r;
            for (let k2 = 0; k2 < 5; k2++) {
              const mid = (a2 + b2) / 2;
              if (inBox(bx + dxr * mid, by + dyr * mid)) a2 = mid; else b2 = mid;
            }
            stream.push([bx + dxr * a2, by + dyr * a2]);
            break;
          } else if (r > reach * 0.7) break;
        }
        emitClipped(stream);
      };
      for (const q of vin.paths) {
        if (!q.pts || q.pts.length < 2 || cnt >= BUDGET) continue;
        const bpts = resample(q.pts, !!q.closed, bstep);
        if (!bpts || bpts.length < 2) continue;
        let cx0 = 0, cy0 = 0;
        for (const pt of bpts) { cx0 += pt[0]; cy0 += pt[1]; }
        cx0 /= bpts.length; cy0 /= bpts.length;
        const n = bpts.length;
        for (let i = 0; i < n && cnt < BUDGET; i++) {
          const [bx, by] = bpts[i];
          if (radial) {
            const dx = bx - cx0, dy = by - cy0;
            const L = Math.hypot(dx, dy);
            if (L < 0.5) continue;
            marchRay(bx, by, dx / L, dy / L);
          } else {
            const wnd = 3;
            const pa = bpts[q.closed ? (i - wnd + n * wnd) % n : Math.max(0, i - wnd)];
            const pb = bpts[q.closed ? (i + wnd) % n : Math.min(n - 1, i + wnd)];
            const tx = pb[0] - pa[0], ty = pb[1] - pa[1];
            const tl = Math.hypot(tx, ty);
            if (tl < 1e-6) continue;
            let nx0 = -ty / tl, ny0 = tx / tl;
            if (q.closed && q.pts.length >= 3) {
              if (inPoly(q.pts, bx + nx0 * 0.7, by + ny0 * 0.7)) { nx0 = -nx0; ny0 = -ny0; }
              marchRay(bx, by, nx0, ny0);
            } else {
              marchRay(bx, by, nx0, ny0);
              marchRay(bx, by, -nx0, -ny0);
            }
          }
        }
      }
    } else if (p.mode === "Torn") {
      const a = (p.spineAng * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a);
      const nx = -uy, ny = ux;
      const cx = (lox + hix) / 2, cy = (loy + hiy) / 2;
      const L = Math.hypot(bw, bh);
      const half = L / 2;
      const ripHalf = (half * Math.min(95, Math.max(5, p.voidLen))) / 100;
      const vw = Math.max(1, p.voidW);
      const vwb = Math.min(1, Math.max(0, p.vWobble));
      const fanK = Math.min(1, Math.max(0, p.fan));
      const reach = L;
      for (let s = -half * 1.6; s <= half * 1.6 && cnt < BUDGET; s += pitch) {
        const px = cx + ux * s, py = cy + uy * s;
        const t = s / ripHalf;
        const lens = Math.abs(t) < 1 ? Math.pow(1 - t * t, 1.15) : 0;
        for (const side of [-1, 1]) {
          const wob = 1 + vwb * 0.7 * (noise2(s * 0.03, side * 3.7, seed + 13) - 0.5) * 2;
          const w0 = lens * vw * wob * (side > 0 ? 1 : 0.75 + 0.25 * wob);
          const fa = fanK * 0.5 * (s / (half * 1.6)) * side;
          const dxr = nx * side * Math.cos(fa) - ny * side * Math.sin(fa);
          const dyr = nx * side * Math.sin(fa) + ny * side * Math.cos(fa);
          const stream = [];
          let entered = false, rIn = w0;
          for (let r = w0; r <= reach; r += 1.6) {
            const x = px + dxr * r, y = py + dyr * r;
            if (inBox(x, y)) {
              if (!entered && r > w0) {
                let a2 = Math.max(w0, r - 1.6), b2 = r;
                for (let k2 = 0; k2 < 5; k2++) {
                  const mid = (a2 + b2) / 2;
                  if (inBox(px + dxr * mid, py + dyr * mid)) b2 = mid; else a2 = mid;
                }
                stream.push([px + dxr * b2, py + dyr * b2]);
              }
              entered = true; rIn = r;
              stream.push([x, y]);
            } else {
              if (entered) {
                let a2 = rIn, b2 = r;
                for (let k2 = 0; k2 < 5; k2++) {
                  const mid = (a2 + b2) / 2;
                  if (inBox(px + dxr * mid, py + dyr * mid)) a2 = mid; else b2 = mid;
                }
                stream.push([px + dxr * a2, py + dyr * a2]);
                break;
              }
              if (r - w0 > reach * 1.5) break;
            }
          }
          emitClipped(stream);
        }
      }
    }

    /* ============================ PLEAT ============================ */
    if (p.mode === "Pleat") {
      const cw = Math.max(6, p.cellW), ch = Math.max(6, p.cellH);
      const k = Math.min(0.24, Math.min(1, Math.max(0, p.foldP)) * 0.38) * cw;
      const doStag = !!p.stagger;
      for (let x = lox; x <= hix && cnt < BUDGET; x += pitch) {
        const stream = [];
        for (let y = loy; y <= hiy; y += 1.4) {
          let u = (x - lox) / cw;
          const v = (y - loy) / ch;
          if (doStag && Math.floor(v) % 2) u += 0.5;
          const fu = u - Math.floor(u), fv = v - Math.floor(v);
          const tv = 1 - 2 * Math.abs(fv - 0.5);
          const tw = fu < 0.25 ? 4 * fu : fu < 0.75 ? 2 - 4 * fu : 4 * fu - 4;
          const dx = -k * tw * tv;
          stream.push([x + dx, y]);
        }
        if (Math.round((x - lox) / pitch) % 2) stream.reverse();
        emitClipped(stream);
      }
    }

    /* ============================ CIRCLES ============================ */
    if (p.mode === "Circles") {
      const rMin = Math.max(0.5, Math.min(p.cMin, p.cMax));
      const rMax = Math.max(rMin, p.cMax);
      const gap = Math.max(0, p.cGap);
      const rings = p.cStyle === "Rings";
      const rng = mulberry32(seed * 523 + 7);
      const circles = [];
      /* coarse occupancy grid prunes darts landing inside placed circles */
      const cell = 4;
      const gw = Math.max(1, Math.ceil(bw / cell)), gh = Math.max(1, Math.ceil(bh / cell));
      const covered = new Uint8Array(gw * gh);
      const cover = (c) => {
        const i0 = Math.max(0, Math.floor((c.x - c.r - lox) / cell));
        const i1 = Math.min(gw - 1, Math.floor((c.x + c.r - lox) / cell));
        const j0 = Math.max(0, Math.floor((c.y - c.r - loy) / cell));
        const j1 = Math.min(gh - 1, Math.floor((c.y + c.r - loy) / cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const gx = lox + (i + 0.5) * cell, gy = loy + (j + 0.5) * cell;
          if (Math.hypot(gx - c.x, gy - c.y) < c.r - cell * 0.75) covered[j * gw + i] = 1;
        }
      };
      const segDist = (x, y, ax, ay, bx2, by2) => {
        const dx = bx2 - ax, dy = by2 - ay;
        const L2 = dx * dx + dy * dy;
        const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
        return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      };
      const maxRAt = (x, y) => {
        let r = Math.min(x - lox, hix - x, y - loy, hiy - y, rMax);
        if (r < rMin) return 0;
        for (const v of voidPolys) {
          if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1 && inPoly(v.pts, x, y)) return 0;
        }
        for (const g of voidSegPaths) {
          if (x < g.x0 - r - clr || x > g.x1 + r + clr || y < g.y0 - r - clr || y > g.y1 + r + clr) continue;
          for (const sgm of g.segs) {
            const d = segDist(x, y, sgm[0], sgm[1], sgm[2], sgm[3]) - gap - clr - 0.05;
            if (d < r) { r = d; if (r < rMin) return 0; }
          }
        }
        for (const c of circles) {
          const d = Math.hypot(x - c.x, y - c.y) - c.r - gap;
          if (d < r) { r = d; if (r < rMin) return 0; }
        }
        return r;
      };
      const CAND = 22;
      let candBudget = 26000;
      while (candBudget > 0 && circles.length < 1400 && cnt < BUDGET) {
        let bx = 0, by = 0, br = 0;
        for (let k = 0; k < CAND && candBudget > 0; k++, candBudget--) {
          const x = lox + rng() * bw, y = loy + rng() * bh;
          const gi = Math.min(gw - 1, Math.floor((x - lox) / cell)) + Math.min(gh - 1, Math.floor((y - loy) / cell)) * gw;
          if (covered[gi]) continue;
          const r = maxRAt(x, y);
          if (r > br) { br = r; bx = x; by = y; }
        }
        if (br < rMin) continue;
        const c = { x: bx, y: by, r: Math.min(br, rMax) };
        circles.push(c);
        cover(c);
      }
      circles.sort((a, b) => b.r - a.r);
      for (const c of circles) {
        if (cnt >= BUDGET) break;
        for (let rr = c.r; rr > pitch * 0.55; rr -= pitch) {
          if (cnt >= BUDGET) break;
          const nSeg = Math.max(12, Math.ceil((2 * Math.PI * rr) / 1.2));
          const pts = [];
          for (let i2 = 0; i2 < nSeg; i2++) {
            const a2 = (i2 / nSeg) * Math.PI * 2;
            pts.push([c.x + Math.cos(a2) * rr, c.y + Math.sin(a2) * rr]);
          }
          emit(pts, true);
          if (!rings) break;
        }
      }
    }

    /* ---- Guilloché: identical banknote plates tiled edge to edge, so the fine
       lines fill every corner of the sheet - not just a round region around one
       centre. The lattice bleeds off all four edges of the Margin box (staggered
       half-step grid, seeded drift per cell, whole-lattice Angle rotation) and is
       cut by the same inBox / void rules as every other mode; each motif is drawn
       with the same shared guilloche-family mathematics as the Guilloché node
       but on its own per-plate seed, and the field thins its sampling to stay
       under the point budget instead of cutting the sheet. A wired Void carves
       its stroke out of the field. ---- */
    if (p.mode === "Guilloché") {
      const num = (v, d, lo, hi) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
      const style = typeof p.gStyle === "string" && p.gStyle ? p.gStyle : "Rosette";
      const size = num(p.gSize, 180, 20, 600);
      const over = num(p.gOver, 0.45, 0, 0.95);
      const k = Math.round(num(p.gWaves, 48, 1, 4000));
      const N = Math.round(num(p.gCopies, 14, 1, 200));
      const e = num(p.gAmp, 0.18, 0, 2);
      const g = style === "Fan" || style === "Spiral" ? 0 : num(p.gGrowth, 0.012, 0, 1);
      const j = num(p.gJit, 0.15, 0, 5);
      const rot = num(p.gAngle, 0, -3600, 3600) * Math.PI / 180;
      const fill = num(p.gFill, 1, 0, 1);
      const accentF = num(p.gAccent, 0, 0, 100) / 100;
      const layer2 = Math.max(0, Math.min(11, Math.round(num(p.pen2, 3, 0, 11))));
      const ext = size * (1 + Math.max(0, N - 1) * g) + size * e * (1 + 0.5 * j) + 2;

      const rngL = mulberry32((seed ^ 0x51ab7) | 0);
      const jx = rngL() * 2 - 1, jy = rngL() * 2 - 1;   // per-sheet lattice drift
      const tilt = (rngL() * 2 - 1) * j * 0.15;         // per-motif hand-cut nudge
      const a2 = rot + tilt;
      const cosA = Math.cos(rot), sinA = Math.sin(rot);

      const emitG = (pts, closed, pen) => {
        // Clip crossing segments too: both sampled endpoints can be outside
        // while the line between them is visible on the sheet.
        for (const part of clipPolylineToRect(pts, closed, lox, loy, hix, hiy)) {
          if (!hasVoid) { emitRaw(part.pts, part.closed, pen); continue; }
          let cur = [], cut = false;
          let lastGood = part.pts[0];
          const flush = () => {
            if (cur.length >= 2) emitRaw(cur, false, pen);
            cur = [];
          };
          // Long clipped chords must also respect the Void input between their
          // endpoints. Probe the mask, retaining vertices only at real cuts.
          const visit = (pt, vertex) => {
            if (inAnyVoid(pt[0], pt[1])) {
              if (cur.length && Math.hypot(cur.at(-1)[0] - lastGood[0], cur.at(-1)[1] - lastGood[1]) > 1e-6) cur.push(lastGood);
              cut = true; flush();
            } else {
              if (!cur.length || vertex) cur.push(pt);
              lastGood = pt;
            }
          };
          visit(part.pts[0], true);
          for (let i = 0; i < part.pts.length - (part.closed ? 0 : 1); i++) {
            const a = part.pts[i], b = part.pts[(i + 1) % part.pts.length];
            const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .5));
            for (let j = 1; j <= steps; j++) visit([
              a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps,
            ], j === steps);
          }
          if (cut) flush(); else emitRaw(part.pts, part.closed, pen);
        }
      };
      const emitRaw = (pts, closed, pen) => {
        if (pts.length < 2) return;
        cnt += pts.length;
        paths.push({ pts, closed: !!closed, layer: pen });
      };

      // Budget the entire lattice before drawing any plate. On dense sheets
      // grow its spacing uniformly, keeping a full family and at least sixteen
      // samples per curve at every surviving motif, including the bottom rows.
      const diag = Math.hypot(W, H) / 2;
      // Huge growing rings need not add thousands of far-away motifs. Keep
      // nearby plates around the whole page and bound the off-page halo.
      const halo = Math.min(ext, diag * 2);
      const corners = [[lox, loy], [hix, loy], [lox, hiy], [hix, hiy]].map(([x, y]) => [
        (x - W / 2) * cosA + (y - H / 2) * sinA + W / 2,
        -(x - W / 2) * sinA + (y - H / 2) * cosA + H / 2,
      ]);
      const xmin = Math.min(...corners.map((q) => q[0])) - halo;
      const xmax = Math.max(...corners.map((q) => q[0])) + halo;
      const ymin = Math.min(...corners.map((q) => q[1])) - halo;
      const ymax = Math.max(...corners.map((q) => q[1])) + halo;
      const curvesPerPlate = guillocheCurveCount(style, N);
      const maxPlates = Math.min(1200, Math.floor(BUDGET / (curvesPerPlate * 17)));
      const layout = (sp) => {
        const centers = [];
        const driftX = jx * sp * 0.35, driftY = jy * sp * 0.35;
        for (let row = Math.floor((ymin - driftY) / sp); row * sp <= ymax - driftY; row++) {
          const rowOff = row % 2 ? sp * 0.5 : 0;
          for (let col = Math.floor((xmin - driftX - rowOff) / sp); col * sp + rowOff <= xmax - driftX; col++) {
            const px = col * sp + rowOff + driftX, py = row * sp + driftY;
            const rx = (px - W / 2) * cosA - (py - H / 2) * sinA + W / 2;
            const ry = (px - W / 2) * sinA + (py - H / 2) * cosA + H / 2;
            if (Math.hypot(rx - W / 2, ry - H / 2) > diag + halo) continue;
            centers.push([rx, ry]);
            if (centers.length > maxPlates) return null;
          }
        }
        return centers;
      };
      let spacing = Math.max(6, size * (1 - over));
      let centers = layout(spacing);
      while (centers === null) {
        spacing *= 1.15;
        centers = layout(spacing);
      }
      // Open curves have S+1 points; reserving that extra point also bounds
      // closed curves. Clipping can add intersection points, handled below.
      const S = Math.max(16, Math.min(
        guillocheSamples(style, k, N),
        Math.floor(BUDGET / curvesPerPlate / Math.max(1, centers.length)) - 1));

      for (let i = 0; i < centers.length; i++) {
        const [cx, cy] = centers[i];
        const pseed = (seed ^ Math.imul(i + 1, 0x9e3779b9) | 0) >>> 0;
        const fam = guillocheFamily({ mode: style, waves: k, copies: N, amplitude: e, growth: g, jitter: j, angle: a2, seed: pseed, R: size, cx, cy, accent: accentF, samples: S });
        // Fill collapses the ring family toward the plate centre (shape-preserving
        // star scaling): at 1 every motif is a complete bullseye, so the tiled
        // field covers every millimetre of sheet; lower it for open ring meshes.
        const m1 = Math.max(1, N - 1);
        for (let i = 0; i < fam.length; i++) {
          const f = fam[i];
          let pts = f.pts;
          if (fill > 0 && style !== "Spiral") {
            // Star-scale toward the centre; clamp so every promised copy survives
            // as at least a tiny bullseye ring instead of vanishing.
            const s = Math.max(0.03, 1 - (fill * i) / m1);
            pts = f.pts.map((q) => [cx + (q[0] - cx) * s, cy + (q[1] - cy) * s]);
          }
          emitG(pts, f.closed, f.slot === 1 ? layer2 : layer);
        }
      }
      // Intersection points can take clipped curves over the raw-point
      // allocation. Thin every region together, never stop at a top-row prefix.
      while (cnt > BUDGET) {
        const before = cnt;
        for (const path of paths) {
          // Do not replace void-following bends with chords through the mask.
          if (hasVoid || path.pts.length <= (path.closed ? 3 : 2)) continue;
          const pts = [path.pts[0]];
          for (let i = 2; i < path.pts.length - 1; i += 2) pts.push(path.pts[i]);
          pts.push(path.pts.at(-1));
          if (path.closed && pts.length < 3) pts.splice(1, 0, path.pts[1]);
          cnt -= path.pts.length - pts.length;
          path.pts = pts;
        }
        if (cnt === before) {
          let kept = 0;
          cnt = 0;
          for (let i = 0; i < paths.length; i += 2) {
            paths[kept++] = paths[i]; cnt += paths[i].pts.length;
          }
          paths.length = kept;
        }
      }
    }

    if (!paths.length) return EMPTY;
    return applyStyle({ paths }, ins[0]);
  },
};
