import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "flow_traces",
  name: "Flow Traces",
  cat: "gen",
  group: "structural",
  desc: "Circuit-atlas routing: continuous non-touching traces walk an orthogonal grid, steered by a flow field - Flow angle sets the main direction, Swirl blends in rotation around the canvas center, Wave adds a periodic side-to-side urge that turns runs into square-wave detours, and Turn bias favors right over left turns. Traces are strictly self-avoiding (a lattice point is used once, ever), so nothing in the output touches or crosses - pen-plotter clean. Corners become exact arcs (Corner radius, auto-clamped to the cell), ends get terminals (Dots / Rings / Pads / None) with the centerline trimmed back so even the terminal never intersects its own trace. Columns/Rows set the grid, Traces how many routes are attempted, Min length prunes stubs. Sibling of PCB Tracks (octilinear pads) - this one is pure orthogonal flow.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 83 },
    { key: "cols", label: "Columns", type: "slider", min: 6, max: 60, step: 1, def: 22 },
    { key: "rows", label: "Rows", type: "slider", min: 6, max: 60, step: 1, def: 24 },
    { key: "traces", label: "Traces", type: "slider", min: 2, max: 80, step: 1, def: 34 },
    { key: "minLen", label: "Min length (cells)", type: "slider", min: 2, max: 20, step: 1, def: 5 },
    { key: "flow", label: "Flow angle", type: "slider", min: -180, max: 180, step: 1, def: -8 },
    { key: "swirl", label: "Swirl %", type: "slider", min: 0, max: 100, step: 1, def: 18 },
    { key: "wave", label: "Wave %", type: "slider", min: 0, max: 100, step: 1, def: 26 },
    { key: "turnBias", label: "Turn bias %", type: "slider", min: 0, max: 100, step: 1, def: 74 },
    { key: "radius", label: "Corner radius", type: "slider", min: 0.5, max: 12, step: 0.1, def: 4.2 },
    { key: "terminals", label: "Terminals", type: "select", options: ["Dots", "Rings", "Pads", "None"], def: "Dots" },
    { key: "tRadius", label: "Terminal radius", type: "slider", min: 0.3, max: 3, step: 0.05, def: 0.75 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(ctx.W, ctx.H) / 2 - 2));
    const a = ((+p.flow || 0) * Math.PI) / 180;
    const L = 25;
    return [
      { kind: "rect", x: mg, y: mg, w: ctx.W - 2 * mg, h: ctx.H - 2 * mg },
      { kind: "arrow", x1: ctx.W / 2, y1: ctx.H / 2, x2: ctx.W / 2 + Math.cos(a) * L, y2: ctx.H / 2 + Math.sin(a) * L },
    ];
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const S = Math.round(+p.seed || 0);
    const mg = Math.max(0, Math.min(+p.margin || 0, Math.min(W, H) / 2 - 2));
    const nx = Math.max(3, Math.min(120, Math.round(+p.cols || 22)));
    const ny = Math.max(3, Math.min(120, Math.round(+p.rows || 24)));
    const w = W - 2 * mg, h = H - 2 * mg;
    if (w < 8 || h < 8) return EMPTY;
    const cell = Math.min(w / nx, h / ny);
    if (cell < 1.2) return EMPTY;
    const ox = mg + (w - nx * cell) / 2;
    const oy = mg + (h - ny * cell) / 2;
    const XY = (v) => [ox + v[0] * cell, oy + v[1] * cell];
    const nTr = Math.max(1, Math.min(200, Math.round(+p.traces || 34)));
    const minLen = Math.max(2, Math.round(+p.minLen || 5));
    const flowA = ((+p.flow || 0) * Math.PI) / 180;
    const swirl = Math.max(0, Math.min(1, (+p.swirl || 0) / 100));
    const wave = Math.max(0, Math.min(1, (+p.wave || 0) / 100));
    const tb = Math.max(0, Math.min(1, (+p.turnBias || 0) / 100));
    const R0 = Math.max(0.2, +p.radius || 4);
    const term = String(p.terminals || "Dots");
    const tr = Math.max(0.1, Math.min(cell * 0.45, +p.tRadius || 0.75));
    const layer = Math.round(+p.layer || 0);
    const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const R = Math.min(R0, cell / 2 - 0.05);

    // preferred flow direction at a lattice point, with per-trace wave phase
    const cx0 = W / 2, cy0 = H / 2;
    const pref = (v, stepIdx, phase) => {
      const q = XY(v);
      let a = flowA;
      if (swirl > 0) {
        const ta = Math.atan2(q[1] - cy0, q[0] - cx0) + Math.PI / 2;
        let d = ta - a;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        a += d * swirl;
      }
      if (wave > 0) a += Math.sin(stepIdx * (Math.PI / 3) + phase) * wave * 1.3;
      return a;
    };

    // strictly self-avoiding walks: every lattice vertex used at most once, ever
    const used = new Uint8Array((nx + 1) * (ny + 1));
    const VI = (v) => v[1] * (nx + 1) + v[0];
    const rng = mulberry32(S * 7919 + 101);
    const walks = [];
    let attempts = 0;
    while (walks.length < nTr && attempts < nTr * 8) {
      attempts++;
      const start = [Math.floor(rng() * (nx + 1)), Math.floor(rng() * (ny + 1))];
      if (used[VI(start)]) continue;
      const phase = rng() * Math.PI * 2;
      const walk = [start.slice()];
      used[VI(start)] = 1;
      const pa = pref(start, 0, phase);
      let d = [[1, 0], [0, 1], [-1, 0], [0, -1]]
        .map((q, i) => [i, q[0] * Math.cos(pa) + q[1] * Math.sin(pa)])
        .sort((a, b) => b[1] - a[1])[0][0];
      let pos = start;
      for (let st = 0; st < nx * ny; st++) {
        const a = pref(pos, st, phase);
        const px = Math.cos(a), py = Math.sin(a);
        const cand = [];
        for (const nd of [d, (d + 1) % 4, (d + 3) % 4]) {
          const t = [pos[0] + DIRS[nd][0], pos[1] + DIRS[nd][1]];
          if (t[0] < 0 || t[0] > nx || t[1] < 0 || t[1] > ny) continue;
          if (used[VI(t)]) continue;
          const align = DIRS[nd][0] * px + DIRS[nd][1] * py;
          let wgt = Math.exp(align * 1.8) * (nd === d ? 1.7 : 1);
          if (nd !== d) {
            const rightTurn = nd === (d + 1) % 4;
            wgt *= rightTurn ? 0.5 + 1.5 * tb : 0.5 + 1.5 * (1 - tb);
          }
          cand.push([nd, t, wgt]);
        }
        if (!cand.length) break;
        let sum = 0;
        for (const c of cand) sum += c[2];
        let r = rng() * sum, pick = cand[0];
        for (const c of cand) { r -= c[2]; if (r <= 0) { pick = c; break; } }
        d = pick[0];
        pos = pick[1];
        used[VI(pos)] = 1;
        walk.push(pos.slice());
      }
      if (walk.length - 1 < minLen) {
        for (const v of walk) used[VI(v)] = 0; // erase stub, free the cells
        continue;
      }
      walks.push(walk);
    }
    if (!walks.length) return EMPTY;

    // centerline geometry: lines + exact corner arcs, trimmed at terminals
    const DS = 0.7;
    const paths = [];
    const trim = term === "None" ? 0 : tr + 0.25;
    for (const walk of walks) {
      const pts = [];
      let cur = XY(walk[0]);
      pts.push(cur.slice());
      const pushLine = (to) => {
        const len = Math.hypot(to[0] - cur[0], to[1] - cur[1]);
        const n = Math.max(1, Math.ceil(len / DS));
        for (let u = 1; u <= n; u++) {
          const t = u / n;
          pts.push([cur[0] + (to[0] - cur[0]) * t, cur[1] + (to[1] - cur[1]) * t]);
        }
        cur = to;
      };
      for (let i = 1; i < walk.length; i++) {
        const din = [walk[i][0] - walk[i - 1][0], walk[i][1] - walk[i - 1][1]];
        if (i === walk.length - 1) { pushLine(XY(walk[i])); break; }
        const dout = [walk[i + 1][0] - walk[i][0], walk[i + 1][1] - walk[i][1]];
        if (din[0] === dout[0] && din[1] === dout[1]) { pushLine(XY(walk[i])); continue; }
        const P = XY(walk[i]);
        const A = [P[0] - din[0] * R, P[1] - din[1] * R];
        const O = [A[0] + dout[0] * R, A[1] + dout[1] * R];
        pushLine(A);
        const a0 = Math.atan2(A[1] - O[1], A[0] - O[0]);
        const sweep = (Math.PI / 2) * Math.sign(din[0] * dout[1] - din[1] * dout[0]);
        const n = Math.max(3, Math.ceil((Math.abs(sweep) * R) / DS));
        for (let u = 1; u <= n; u++) {
          const a = a0 + sweep * (u / n);
          pts.push([O[0] + Math.cos(a) * R, O[1] + Math.sin(a) * R]);
        }
        cur = pts[pts.length - 1].slice();
      }
      // trim both ends back so the line never enters its terminal
      let line = pts;
      if (trim > 0) {
        const cut = (arr) => {
          let acc = 0, i = 1;
          while (i < arr.length && acc + Math.hypot(arr[i][0] - arr[i - 1][0], arr[i][1] - arr[i - 1][1]) < trim) {
            acc += Math.hypot(arr[i][0] - arr[i - 1][0], arr[i][1] - arr[i - 1][1]);
            i++;
          }
          if (i >= arr.length) return null;
          const seg = Math.hypot(arr[i][0] - arr[i - 1][0], arr[i][1] - arr[i - 1][1]);
          const t = (trim - acc) / seg;
          const first = [arr[i - 1][0] + (arr[i][0] - arr[i - 1][0]) * t, arr[i - 1][1] + (arr[i][1] - arr[i - 1][1]) * t];
          return [first, ...arr.slice(i)];
        };
        line = cut(line);
        if (line) line = cut(line.slice().reverse());
        if (line) line.reverse();
      }
      if (line && line.length >= 2) paths.push({ pts: line, closed: false, layer });

      // terminals at the untrimmed walk endpoints
      if (term !== "None") {
        for (const endV of [walk[0], walk[walk.length - 1]]) {
          const C = XY(endV);
          if (term === "Pads") {
            const s = tr;
            paths.push({ pts: [[C[0] - s, C[1] - s], [C[0] + s, C[1] - s], [C[0] + s, C[1] + s], [C[0] - s, C[1] + s]], closed: true, layer });
          } else {
            const n = Math.max(8, Math.ceil((Math.PI * 2 * tr) / 0.5));
            const ring = [];
            for (let u = 0; u < n; u++) {
              const a = (u / n) * Math.PI * 2;
              ring.push([C[0] + Math.cos(a) * tr, C[1] + Math.sin(a) * tr]);
            }
            paths.push({ pts: ring, closed: true, layer });
            if (term === "Dots" && tr > 0.5) {
              const r2 = tr * 0.45;
              const n2 = Math.max(6, Math.ceil((Math.PI * 2 * r2) / 0.5));
              const ring2 = [];
              for (let u = 0; u < n2; u++) {
                const a = (u / n2) * Math.PI * 2;
                ring2.push([C[0] + Math.cos(a) * r2, C[1] + Math.sin(a) * r2]);
              }
              paths.push({ pts: ring2, closed: true, layer });
            }
          }
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
