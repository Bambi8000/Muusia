import { Pin, applyStyle } from "../helpers.js";

export default {
  /* Duga Array — the Chernobyl-2 over-the-horizon radar receiver (Duga-1,
     often miscalled Duga-3): two curtain arrays of wire-cage dipoles hung on
     free-standing square lattice masts in front of a wire reflector screen,
     fed by ladder lines. World in metres: X along the curtain, Y toward the
     viewer is negative (dipoles in front of the masts, screen behind), Z up.
     Camera yaw / pitch / perspective with an eye height; View = Front
     elevation forces the orthographic front view. Deterministic, no seed. */
  key: "duga",
  name: "Duga Array",
  cat: "gen",
  group: "structural",
  desc: "The Chernobyl-2 over-the-horizon radar receiver (Duga-1 - the 'Russian Woodpecker', often miscalled Duga-3) as a rotatable 3-D wireframe: a low-band curtain about 150 m tall and 500 m long and a high-band curtain about 90 m by 250 m beside it, each a row of free-standing square lattice masts carrying horizontal trusses, wire-cage dipoles hung in every bay at Dipole pitch on stand-off pipes in front of the masts, ladder-line Feed lines running up each bay, and a wire reflector Screen behind. Sections picks Both, Low band or High band; Tower detail trades lattice bracing for speed; Stagger offsets alternate dipole levels by half a bay. View = Front elevation is the orthographic 2-D drawing; Camera uses Yaw / Pitch / Perspective / Eye height (wire Frame into Yaw to orbit). Everything fits inside Margin. Pens: masts and trusses, Dipoles (with feed lines), Screen (with the ground line).",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "sections", label: "Sections", type: "select", options: ["Both", "Low band", "High band"], def: "Both" },
    { key: "towersA", label: "Low-band masts", type: "slider", min: 2, max: 16, step: 1, def: 11, showIf: (p) => p.sections !== "High band" },
    { key: "towersB", label: "High-band masts", type: "slider", min: 2, max: 12, step: 1, def: 6, showIf: (p) => p.sections !== "Low band" },
    { key: "bay", label: "Mast spacing m", type: "slider", min: 20, max: 80, step: 1, def: 50 },
    { key: "heightA", label: "Low-band height m", type: "slider", min: 40, max: 250, step: 5, def: 150, showIf: (p) => p.sections !== "High band" },
    { key: "heightB", label: "High-band height m", type: "slider", min: 30, max: 200, step: 5, def: 90, showIf: (p) => p.sections !== "Low band" },
    { key: "gapAB", label: "Section gap m", type: "slider", min: 0, max: 200, step: 5, def: 60, showIf: (p) => p.sections === "Both" },
    { key: "towerW", label: "Mast width m", type: "slider", min: 2, max: 12, step: 0.5, def: 5 },
    { key: "detail", label: "Tower detail", type: "select", options: ["Full lattice", "Light", "Outline"], def: "Full lattice" },
    { key: "pitchZ", label: "Dipole pitch m", type: "slider", min: 6, max: 40, step: 1, def: 13 },
    { key: "dipLen", label: "Dipole length (x bay)", type: "slider", min: 0.3, max: 0.95, step: 0.05, def: 0.7 },
    { key: "dipDia", label: "Cage diameter m", type: "slider", min: 1, max: 12, step: 0.5, def: 5 },
    { key: "wires", label: "Cage wires", type: "slider", min: 4, max: 16, step: 1, def: 8 },
    { key: "standoff", label: "Stand-off m", type: "slider", min: 0, max: 30, step: 1, def: 10 },
    { key: "stagger", label: "Stagger levels", type: "check", def: false },
    { key: "feeds", label: "Feed lines", type: "check", def: true },
    { key: "screen", label: "Screen", type: "select", options: ["None", "Vertical", "Mesh"], def: "Vertical" },
    { key: "screenGap", label: "Screen wire spacing m", type: "slider", min: 2, max: 20, step: 0.5, def: 6, showIf: (p) => p.screen !== "None" },
    { key: "ground", label: "Ground line", type: "check", def: true },
    { key: "view", label: "View", type: "select", options: ["Camera", "Front elevation"], def: "Camera" },
    { key: "yaw", label: "Yaw deg (wire Frame)", type: "slider", min: -90, max: 90, step: 1, def: 48, showIf: (p) => p.view === "Camera" },
    { key: "pitch", label: "Pitch deg", type: "slider", min: -45, max: 60, step: 1, def: -8, showIf: (p) => p.view === "Camera" },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 3, step: 0.05, def: 1.6, showIf: (p) => p.view === "Camera" },
    { key: "eye", label: "Eye height m", type: "slider", min: 0, max: 300, step: 1, def: 2, showIf: (p) => p.view === "Camera" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "pen", label: "Mast pen", type: "pen", def: 0 },
    { key: "penDip", label: "Dipole pen", type: "pen", def: 0 },
    { key: "penScreen", label: "Screen pen", type: "pen", def: 9 },
  ],
  overlay(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const m = Math.max(0, +(p && p.margin) || 0);
    return [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const TWO_PI = Math.PI * 2;
    const bay = cl(p.bay, 5, 200), tw = cl(p.towerW, 0.5, bay * 0.45);
    const pitchZ = cl(p.pitchZ, 2, 200);
    const dipLen = cl(p.dipLen, 0.1, 0.98) * bay, R = cl(p.dipDia, 0.2, bay) / 2;
    const NW = clampI(p.wires, 3, 32);
    const off = cl(p.standoff, 0, 200);
    const pen = clampI(p.pen, 0, 11), penD = clampI(p.penDip, 0, 11), penS = clampI(p.penScreen, 0, 11);
    const front = p.view === "Front elevation";

    /* --- sections: [x0, masts, height] --- */
    const secs = [];
    const nA = clampI(p.towersA, 2, 40), nB = clampI(p.towersB, 2, 40);
    const hA = cl(p.heightA, 5, 1000), hB = cl(p.heightB, 5, 1000);
    if (p.sections !== "High band") secs.push({ x0: 0, n: nA, h: hA });
    if (p.sections !== "Low band") secs.push({ x0: secs.length ? (nA - 1) * bay + cl(p.gapAB, 0, 2000) : 0, n: nB, h: hB });
    const xEnd = secs[secs.length - 1].x0 + (secs[secs.length - 1].n - 1) * bay;
    const xMid = xEnd / 2;

    /* --- camera --- */
    const yaw = front ? 0 : cl(p.yaw, -720, 720) * Math.PI / 180;
    const pit = front ? 0 : cl(p.pitch, -85, 85) * Math.PI / 180;
    const persp = front ? 0 : cl(p.persp, 0, 6);
    const eye = front ? 0 : cl(p.eye, -1000, 5000);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const view = (x, y, z) => { const wx = x - xMid, vz = z - eye; const vx = wx * cy - y * sy, vy = wx * sy + y * cy; return [vx, vy * cp - vz * sp, vz * cp + vy * sp]; };

    const raw = [];
    let budget = 115000;
    const add = (wpts, closed, layer) => {
      if (budget <= 0 || wpts.length < 2) return;
      budget -= wpts.length;
      raw.push({ v: wpts.map((q) => view(q[0], q[1], q[2])), closed, layer });
    };

    /* --- masts: square lattice, legs + horizontal rings + X bracing on front/back faces --- */
    const det = p.detail;
    const panel = Math.max(2, tw * 1.5);
    const mast = (x, h) => {
      const hw = tw / 2;
      const corners = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
      for (let c = 0; c < 4; c++) add([[x + corners[c][0], corners[c][1], 0], [x + corners[c][0], corners[c][1], h]], false, pen);
      const nP = Math.max(1, Math.round(h / panel));
      const step = det === "Full lattice" ? 1 : det === "Light" ? 2 : nP;
      for (let k = step; k <= nP; k += step) {
        const z = (k / nP) * h;
        add(corners.map(([dx, dy]) => [x + dx, dy, z]), true, pen);
      }
      if (det === "Full lattice") for (let k = 0; k < nP; k++) {
        const z0 = (k / nP) * h, z1 = ((k + 1) / nP) * h;
        for (const yf of [-hw, hw]) {
          if (k % 2 === 0) add([[x - hw, yf, z0], [x + hw, yf, z1]], false, pen); else add([[x + hw, yf, z0], [x - hw, yf, z1]], false, pen);
        }
      }
    };

    /* --- cage dipole centred at (xc, y, z), along X, total length dipLen --- */
    const cage = (xc, y, z, flip) => {
      const g = R * 0.15, half = dipLen / 2, cyl = 0.55;
      const NR = 14;
      for (const sgn of [1, -1]) {
        const xa = xc + sgn * g, xe = xc + sgn * half;
        const cone = (half - g) * (1 - cyl) / 2;
        const x1 = xa + sgn * cone, x2 = xe - sgn * cone;
        for (let k = 0; k < NW; k++) {
          const a = (k / NW) * TWO_PI + Math.PI / NW;
          const dy = Math.cos(a) * R, dz = Math.sin(a) * R;
          const w = [[xa, y, z], [x1, y + dy, z + dz], [x2, y + dy, z + dz], [xe, y, z]];
          add((k + (sgn < 0 ? 1 : 0) + (flip ? 1 : 0)) % 2 ? w.reverse() : w, false, penD);
        }
        for (const xr of [x1, x2]) {
          const ring = [];
          for (let i = 0; i < NR; i++) { const a = (i / NR) * TWO_PI; ring.push([xr, y + Math.cos(a) * R, z + Math.sin(a) * R]); }
          add(ring, true, penD);
        }
      }
      /* stand-off pipe from the mast plane into the feed point, and the boom through the cage */
      add([[xc, 0, z], [xc, y, z]], false, pen);
    };

    for (const s of secs) {
      const xs = []; for (let i = 0; i < s.n; i++) xs.push(s.x0 + i * bay);
      const levels = []; for (let z = pitchZ * 0.9; z <= s.h - R - 1; z += pitchZ) levels.push(z);
      /* top truss and level trusses between masts (mast plane y = 0) */
      add([[xs[0], 0, s.h], [xs[xs.length - 1], 0, s.h]], false, pen);
      for (const z of levels) add([[xs[0], 0, z], [xs[xs.length - 1], 0, z]], false, pen);
      for (const x of xs) mast(x, s.h);
      /* dipoles, one per bay per level, optionally staggered by half a bay on alternate levels */
      let flip = false;
      for (let li = 0; li < levels.length; li++) {
        const z = levels[li];
        const shift = p.stagger && li % 2 ? bay / 2 : 0;
        for (let b = 0; b < s.n - 1; b++) {
          const xc = xs[b] + bay / 2 + shift;
          if (xc + dipLen / 2 > xs[s.n - 1] + 0.01) continue;
          cage(xc, -off, z, flip); flip = !flip;
        }
      }
      /* ladder-line feeds: two parallel wires up the bay centre with a rung at every dipole level */
      if (p.feeds && levels.length) {
        const zTop = s.h, lw = Math.max(0.3, R * 0.25), yf = -off * 0.55;
        for (let b = 0; b < s.n - 1; b++) {
          const xc = xs[b] + bay / 2;
          add([[xc - lw, yf, levels[0]], [xc - lw, yf, zTop]], false, penD);
          add([[xc + lw, yf, zTop], [xc + lw, yf, levels[0]]], false, penD);
          for (const z of levels) add([[xc - lw, yf, z], [xc + lw, yf, z]], false, penD);
        }
      }
      /* reflector screen behind the masts */
      if (p.screen !== "None") {
        const sg = cl(p.screenGap, 0.5, 100), ys = tw / 2 + 1.5;
        const xa = xs[0], xb = xs[xs.length - 1];
        let dir = false;
        for (let x = xa + sg; x < xb - sg / 2; x += sg) { add(dir ? [[x, ys, s.h], [x, ys, 0]] : [[x, ys, 0], [x, ys, s.h]], false, penS); dir = !dir; }
        if (p.screen === "Mesh") for (let z = sg * 3; z < s.h; z += sg * 3) add([[xa, ys, z], [xb, ys, z]], false, penS);
      }
    }
    if (p.ground) {
      const ext = bay * 0.6;
      add([[-ext, 0, 0], [xEnd + ext, 0, 0]], false, penS);
    }

    /* --- project with perspective, then fit into the margin box --- */
    let dMin = Infinity, dMax = -Infinity;
    for (const q of raw) for (const v of q.v) { if (v[1] < dMin) dMin = v[1]; if (v[1] > dMax) dMax = v[1]; }
    const S = Math.max(1e-6, dMax - dMin);
    const proj = raw.map((q) => ({ closed: q.closed, layer: q.layer, s: q.v.map((v) => { const sc = 1 / (1 + persp * (v[1] - dMin) / S); return [v[0] * sc, -v[2] * sc]; }) }));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of proj) for (const s of q.s) { if (s[0] < x0) x0 = s[0]; if (s[0] > x1) x1 = s[0]; if (s[1] < y0) y0 = s[1]; if (s[1] > y1) y1 = s[1]; }
    const m = Math.max(0, +p.margin || 0);
    const boxW = Math.max(1, W - 2 * m), boxH = Math.max(1, H - 2 * m);
    const k = Math.min(boxW / Math.max(1e-6, x1 - x0), boxH / Math.max(1e-6, y1 - y0));
    const cx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
    const paths = proj.map((q) => ({ pts: q.s.map(([x, y]) => [W / 2 + (x - cx) * k, H / 2 + (y - cyy) * k]), closed: q.closed, layer: q.layer }));
    return applyStyle({ paths }, ins[0]);
  },
};
