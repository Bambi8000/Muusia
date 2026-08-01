import { Pin, EMPTY, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "windtunnel",
  name: "Wind Tunnel",
  cat: "duo",
  desc: "Streamlines flowing around the closed shapes wired into Obstacle, like smoke lines in a wind tunnel. A uniform flow (Angle) is steered tangentially when it enters the Influence band around a shape, so lines hug and part around the object at Clearance distance; Hug shapes how abruptly they wrap. Waviness adds gentle large-scale meander to the whole field, Wake turbulence churns the flow behind each shape and dies out over Wake length. Keep shape passes the obstacle through on its own pens. Unwired Obstacle gives plain flow lines. Tip: wire one region via Stencil to aim the tunnel at a single potato.",
  ins: [Pin("paths", "Obstacle"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "lines", label: "Lines", type: "slider", min: 3, max: 100, step: 1, def: 32 },
    { key: "angle", label: "Flow angle \u00b0", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "influence", label: "Influence mm", type: "slider", min: 2, max: 60, step: 0.5, def: 18 },
    { key: "clearance", label: "Clearance mm", type: "slider", min: 0, max: 6, step: 0.1, def: 1 },
    { key: "hug", label: "Hug", type: "slider", min: 0.5, max: 4, step: 0.05, def: 1.5 },
    { key: "waviness", label: "Waviness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.12 },
    { key: "wake", label: "Wake turbulence", type: "slider", min: 0, max: 1, step: 0.01, def: 0.4 },
    { key: "wakeLen", label: "Wake length mm", type: "slider", min: 10, max: 250, step: 1, def: 90 },
    { key: "step", label: "Flow step mm", type: "slider", min: 0.5, max: 3, step: 0.1, def: 1 },
    { key: "keep", label: "Keep shape", type: "check", def: true },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 19 },
    { key: "layer", label: "Flow pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const src = ins[0] || EMPTY;
    const L = Math.round(p.layer);
    const margin = Math.max(0, p.margin);
    const x0 = margin, y0 = margin, x1 = W - margin, y1 = H - margin;
    const nLines = Math.max(2, Math.round(p.lines));
    const R = Math.max(0.5, p.influence);
    const clr = Math.max(0, p.clearance);
    const hug = Math.max(0.1, p.hug);
    const seed = Math.round(p.seed);

    /* ---- obstacle geometry: segments + closed polys + per-shape wake anchors ---- */
    const segs = [];       /* [ax, ay, bx, by] */
    const polys = [];      /* closed original point lists for inside test */
    const wakes = [];      /* { cx, cy, r } per closed shape */
    for (const path of src.paths) {
      if (path.pts.length < 2) continue;
      const pts = resample(path.pts, path.closed, 1.5);
      const seq = path.closed ? [...pts, pts[0]] : pts;
      for (let i = 1; i < seq.length; i++) {
        segs.push([seq[i - 1][0], seq[i - 1][1], seq[i][0], seq[i][1]]);
      }
      if (path.closed && path.pts.length >= 3) {
        polys.push(path.pts);
        let cx = 0, cy = 0;
        for (const q of path.pts) { cx += q[0]; cy += q[1]; }
        cx /= path.pts.length; cy /= path.pts.length;
        let r = 0;
        for (const q of path.pts) r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cy));
        wakes.push({ cx, cy, r });
      }
    }

    /* spatial hash of segments for fast nearest queries */
    const CELL = Math.max(6, R * 0.75);
    const buckets = new Map();
    segs.forEach((s, i) => {
      const sx0 = Math.min(s[0], s[2]) - R, sx1 = Math.max(s[0], s[2]) + R;
      const sy0 = Math.min(s[1], s[3]) - R, sy1 = Math.max(s[1], s[3]) + R;
      for (let by = Math.floor(sy0 / CELL); by <= Math.floor(sy1 / CELL); by++)
        for (let bx = Math.floor(sx0 / CELL); bx <= Math.floor(sx1 / CELL); bx++) {
          const k = bx + "," + by;
          let a = buckets.get(k);
          if (!a) { a = []; buckets.set(k, a); }
          a.push(i);
        }
    });
    /* nearest surface point within R; returns null when nothing near */
    const nearest = (x, y) => {
      const a = buckets.get(Math.floor(x / CELL) + "," + Math.floor(y / CELL));
      if (!a) return null;
      let bd = Infinity, bx = 0, by = 0;
      for (const i of a) {
        const s = segs[i];
        const dx = s[2] - s[0], dy = s[3] - s[1];
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = s[0] + dx * t, py = s[1] + dy * t;
        const dd = (x - px) * (x - px) + (y - py) * (y - py);
        if (dd < bd) { bd = dd; bx = px; by = py; }
      }
      if (bd === Infinity) return null;
      return { d: Math.sqrt(bd), px: bx, py: by };
    };
    const inside = (x, y) => {
      for (const poly of polys) {
        let inn = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inn = !inn;
        }
        if (inn) return true;
      }
      return false;
    };

    /* ---- velocity field ---- */
    const baseA = (p.angle * Math.PI) / 180;
    const u0x = Math.cos(baseA), u0y = Math.sin(baseA);
    const p0x = -u0y, p0y = u0x; /* perpendicular */
    const vel = (x, y) => {
      /* large-scale meander */
      let ang = baseA;
      if (p.waviness > 0) {
        ang += (noise2(x * 0.02, y * 0.02, seed) - 0.5) * 2 * p.waviness * 0.7;
      }
      /* wake turbulence behind each closed shape */
      if (p.wake > 0 && wakes.length) {
        let amp = 0;
        for (const wk of wakes) {
          const rx = x - wk.cx, ry = y - wk.cy;
          const s = rx * u0x + ry * u0y;           /* downstream distance */
          if (s <= 0) continue;
          const l = rx * p0x + ry * p0y;           /* lateral offset */
          const lat = Math.exp(-(l * l) / ((wk.r + 6) * (wk.r + 6)));
          const rise = Math.min(1, s / Math.max(1, wk.r));
          const fall = Math.exp(-s / Math.max(5, p.wakeLen));
          amp = Math.max(amp, lat * rise * fall);
        }
        if (amp > 0) {
          ang += (noise2(x * 0.06, y * 0.06, seed + 77) - 0.5) * 2 * p.wake * 1.5 * amp;
        }
      }
      let vx = Math.cos(ang), vy = Math.sin(ang);
      /* steer tangentially inside the influence band */
      const nr = nearest(x, y);
      if (nr && nr.d < R + clr) {
        const d = Math.max(0, nr.d - clr);
        const w = Math.pow(Math.max(0, 1 - d / R), hug);
        let nx = (x - nr.px), ny = (y - nr.py);
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        if (inside(x, y)) { nx = -nx; ny = -ny; } /* degenerate: normal flips if we slipped in */
        const dot = vx * nx + vy * ny;
        if (dot < 0) {
          vx -= nx * dot * w;
          vy -= ny * dot * w;
        }
        /* hard shell: push out when at/inside clearance */
        if (nr.d < clr) {
          vx += nx * (1 - nr.d / Math.max(0.01, clr));
          vy += ny * (1 - nr.d / Math.max(0.01, clr));
        }
        const vl = Math.hypot(vx, vy) || 1;
        vx /= vl; vy /= vl;
      }
      return [vx, vy];
    };

    /* ---- integrate streamlines ---- */
    const diag = Math.hypot(W, H);
    let step = Math.max(0.3, p.step);
    let maxSteps = Math.ceil((diag * 1.6) / step);
    /* point budget guard */
    while (nLines * maxSteps > 100000) {
      step *= 1.5;
      maxSteps = Math.ceil((diag * 1.6) / step);
    }
    const cx = W / 2, cy = H / 2;
    const span = diag; /* seed line covers the sheet at any angle */
    const paths = [];
    const inRect = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    for (let li = 0; li < nLines; li++) {
      const f = nLines === 1 ? 0.5 : li / (nLines - 1);
      const off = (f - 0.5) * span;
      /* start upstream, outside the sheet */
      let x = cx - u0x * (diag * 0.55) + p0x * off;
      let y = cy - u0y * (diag * 0.55) + p0y * off;
      let run = [];
      const flush = () => {
        if (run.length > 1) paths.push({ pts: run, closed: false, layer: L });
        run = [];
      };
      for (let s = 0; s < maxSteps; s++) {
        const [vx, vy] = vel(x, y);
        const nx2 = x + vx * step, ny2 = y + vy * step;
        /* midpoint correction (RK2) for smoother hugging */
        const [mvx, mvy] = vel((x + nx2) / 2, (y + ny2) / 2);
        x = x + mvx * step;
        y = y + mvy * step;
        /* hard projection: never inside, never closer than clearance */
        const nr2 = nearest(x, y);
        let dropped = false;
        if (nr2) {
          const isIn = inside(x, y);
          if (isIn || nr2.d < clr) {
            let nx = x - nr2.px, ny = y - nr2.py;
            const nl = Math.hypot(nx, ny) || 1;
            nx /= nl; ny /= nl;
            if (isIn) { nx = -nx; ny = -ny; }
            const target = Math.max(clr, 0.15);
            x = nr2.px + nx * target;
            y = nr2.py + ny * target;
            if (inside(x, y)) dropped = true; /* concave pocket backstop */
          }
        }
        if (!dropped && inRect(x, y)) run.push([x, y]);
        else flush();
      }
      flush();
    }

    const out = applyStyle({ paths }, ins[1]);
    if (p.keep && src.paths.length) {
      for (const path of src.paths) {
        out.paths.push({ ...path, pts: path.pts.map((q) => q.slice()) });
      }
    }
    return out;
  },
};
