import { Pin, EMPTY, mulberry32, noise2 } from "../helpers.js";

export default {
  key: "needlepunch",
  name: "Needle Punch",
  cat: "mod",
  group: "penout",
  desc: "Converts lines into needle piercings for a needle mounted in the pen carriage (paper raised on foam). Each punch is emitted as a zero-length path whose points carry z = Depth, the plunge in mm BELOW the machine profile's pen-down contact — set Pen down to the paper surface and Pen up / Z-hop in the machine profile for the lift heights. Interval walks every path and punches each Interval mm starting at Offset (Punch ends adds the endpoints of open paths); Intersections punches every line crossing, including self-crossings; Both combines them; Centers punches once at each path's centroid — chain the Braille or Single Marker node into it. Spacing mod varies the interval along the arc: Wave (sine of Mod length wavelength), Noise (smooth seeded drift), Ramp (spacing grows from tight to loose along each path), Jitter (seeded per-step randomness) — Mod amount sets the swing, up to ±100% of Interval, floored at 0.1 mm. Min gap merges punches closer than the given distance so the needle never stabs the same hole twice. Punches preview as round dots. Bed-Z machines only (servo mode ignores z) and place this node LAST in the chain: any modifier after it strips the z component.",
  ins: [Pin("paths", "Lines")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Punch at", type: "select", options: ["Interval", "Intersections", "Both", "Centers"], def: "Interval" },
    { key: "interval", label: "Interval (mm)", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
    { key: "offset", label: "Offset (mm)", type: "slider", min: 0, max: 20, step: 0.5, def: 0 },
    { key: "ends", label: "Punch ends", type: "check", def: true },
    { key: "mod", label: "Spacing mod", type: "select", options: ["Off", "Wave", "Noise", "Ramp", "Jitter"], def: "Off" },
    { key: "modAmt", label: "Mod amount", type: "slider", min: 0, max: 1, step: 0.05, def: 0.5 },
    { key: "modLen", label: "Mod length (mm)", type: "slider", min: 2, max: 100, step: 1, def: 25 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "depth", label: "Depth (mm)", type: "slider", min: 0.2, max: 6, step: 0.1, def: 2 },
    { key: "gap", label: "Min gap (mm)", type: "slider", min: 0, max: 5, step: 0.1, def: 0.5 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths || !src.paths.length) return EMPTY;
    const mode = p.mode || "Interval";
    const depth = Math.max(0.05, Math.min(6, +p.depth || 0));
    const interval = Math.max(0.1, +p.interval || 0.1);
    const offset = Math.max(0, +p.offset || 0);
    const layer = Math.round(+p.layer) || 0;
    const modMode = p.mod || "Off";
    const amt = Math.max(0, +p.modAmt || 0);
    const modLen = Math.max(1, +p.modLen || 1);
    const seed = Math.round(+p.seed) || 0;
    const EPS = 1e-9;
    const punches = [];

    /* --- Centers: one punch at each path's vertex centroid — the bridge
       from marker nodes (Braille dot circles, Single Marker) to piercings.
       A regular polygon's vertex mean is its exact center. --- */
    if (mode === "Centers") {
      for (const path of src.paths) {
        if (!path.pts || !path.pts.length) continue;
        let sx = 0, sy = 0, n = 0;
        for (const q of path.pts) {
          if (!isFinite(q[0]) || !isFinite(q[1])) continue;
          sx += q[0]; sy += q[1]; n++;
        }
        if (n > 0) punches.push([sx / n, sy / n]);
      }
    }

    /* --- Interval: global arc-length walk with modulated step --- */
    if (mode === "Interval" || mode === "Both") {
      src.paths.forEach((path, pi) => {
        if (!path.pts || path.pts.length < 2) return;
        /* drop consecutive duplicates so the cumulative table has no zero segs */
        const raw = path.closed ? [...path.pts, path.pts[0]] : path.pts;
        const pts = [raw[0]];
        for (let i = 1; i < raw.length; i++) {
          const a = pts[pts.length - 1];
          if (Math.hypot(raw[i][0] - a[0], raw[i][1] - a[1]) > EPS) pts.push(raw[i]);
        }
        if (pts.length < 2) return;
        const cum = [0];
        for (let i = 1; i < pts.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        }
        const L = cum[cum.length - 1];
        if (p.ends && !path.closed) punches.push([pts[0][0], pts[0][1]]);
        /* per-path rng stream: item i is stable when other paths change */
        const rng = mulberry32(seed * 7919 + pi * 613 + 17);
        /* modulation factor in [-1, 1] at arc position s */
        const f = (s) => {
          if (modMode === "Wave") return Math.sin((Math.PI * 2 * s) / modLen);
          if (modMode === "Noise") return noise2(s / modLen, pi * 3.7 + 1.3, seed) * 2 - 1;
          if (modMode === "Ramp") return (s / Math.max(EPS, L)) * 2 - 1;
          if (modMode === "Jitter") return rng() * 2 - 1;
          return 0;
        };
        let s = offset, k = 1;
        let guard = 0;
        while (s <= L + EPS && guard++ < 200000) {
          while (k < cum.length - 1 && cum[k] < s - EPS) k++;
          const segLen = cum[k] - cum[k - 1];
          const t = Math.min(1, Math.max(0, (s - cum[k - 1]) / segLen));
          const a = pts[k - 1], b = pts[k];
          punches.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          s += Math.max(0.1, interval * (1 + amt * f(s)));
        }
        if (p.ends && !path.closed) {
          const e = pts[pts.length - 1];
          punches.push([e[0], e[1]]);
        }
      });
    }

    /* --- Intersections: strict interior segment crossings, incl. self --- */
    if (mode === "Intersections" || mode === "Both") {
      const segs = [];
      src.paths.forEach((path, pi) => {
        if (!path.pts || path.pts.length < 2) return;
        const pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
        const n = pts.length - 1;
        for (let i = 1; i < pts.length; i++) {
          const x0 = pts[i - 1][0], y0 = pts[i - 1][1];
          const x1 = pts[i][0], y1 = pts[i][1];
          if (Math.hypot(x1 - x0, y1 - y0) <= EPS) continue;
          segs.push({ x0, y0, x1, y1, pi, si: i - 1, n, cl: !!path.closed });
        }
      });
      /* spatial hash so grids stay fast; Map/Set iteration is insertion-ordered
         and insertion is deterministic, so punch order is deterministic too */
      const CELL = 8;
      const grid = new Map();
      segs.forEach((s, idx) => {
        const ax = Math.floor(Math.min(s.x0, s.x1) / CELL), bx = Math.floor(Math.max(s.x0, s.x1) / CELL);
        const ay = Math.floor(Math.min(s.y0, s.y1) / CELL), by = Math.floor(Math.max(s.y0, s.y1) / CELL);
        for (let cx = ax; cx <= bx; cx++) for (let cy = ay; cy <= by; cy++) {
          const k = cx + ":" + cy;
          let arr = grid.get(k);
          if (!arr) grid.set(k, arr = []);
          arr.push(idx);
        }
      });
      const tested = new Set();
      const adjacent = (a, b) => {
        if (a.pi !== b.pi) return false;
        const d = Math.abs(a.si - b.si);
        if (d <= 1) return true;
        return a.cl && d === a.n - 1; /* closed wraparound: last seg touches first */
      };
      for (const arr of grid.values()) {
        for (let u = 0; u < arr.length; u++) {
          for (let v = u + 1; v < arr.length; v++) {
            const i = Math.min(arr[u], arr[v]), j = Math.max(arr[u], arr[v]);
            const pk = i + "|" + j;
            if (tested.has(pk)) continue;
            tested.add(pk);
            const a = segs[i], b = segs[j];
            if (adjacent(a, b)) continue;
            const den = (a.x1 - a.x0) * (b.y1 - b.y0) - (a.y1 - a.y0) * (b.x1 - b.x0);
            if (Math.abs(den) < 1e-12) continue;
            const ua = ((b.x0 - a.x0) * (b.y1 - b.y0) - (b.y0 - a.y0) * (b.x1 - b.x0)) / den;
            const ub = ((b.x0 - a.x0) * (a.y1 - a.y0) - (b.y0 - a.y0) * (a.x1 - a.x0)) / den;
            if (ua > EPS && ua < 1 - EPS && ub > EPS && ub < 1 - EPS) {
              punches.push([a.x0 + (a.x1 - a.x0) * ua, a.y0 + (a.y1 - a.y0) * ua]);
            }
          }
        }
      }
    }

    /* --- Min gap dedupe: greedy keep-first via point hash grid --- */
    const eff = Math.max(+p.gap || 0, 0.001);
    const kept = [];
    const pgrid = new Map();
    for (const q of punches) {
      if (!isFinite(q[0]) || !isFinite(q[1])) continue;
      const cx = Math.floor(q[0] / eff), cy = Math.floor(q[1] / eff);
      let hit = false;
      for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) {
        const arr = pgrid.get((cx + dx) + ":" + (cy + dy));
        if (!arr) continue;
        for (const o of arr) {
          if (Math.hypot(o[0] - q[0], o[1] - q[1]) < eff) { hit = true; break; }
        }
      }
      if (hit) continue;
      const k = cx + ":" + cy;
      let arr = pgrid.get(k);
      if (!arr) pgrid.set(k, arr = []);
      arr.push(q);
      kept.push(q);
    }

    /* degenerate 2-pt paths: pts.length >= 2 survives every export/preview
       filter, and the round linecap renders each as a visible dot */
    return {
      paths: kept.map(([x, y]) => ({
        pts: [[x, y, depth], [x, y, depth]],
        closed: false,
        layer,
      })),
    };
  },
};
