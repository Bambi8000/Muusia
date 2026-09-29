import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  key: "scaffolding",
  name: "Scaffolding",
  cat: "gen",
  group: "structural",
  desc: "Tube-and-coupler scaffolding as a 3-D wireframe: standards, ledgers, transoms, a kick lift at the base, facade and end braces, deck boards, guardrails, toe boards, base plates and couplers. Bays x Lifts x Rows sets the grid; Shape (Full / Ragged / Stairs / Pyramid) with Vary makes a half-built skyline. Tube = Double draws every tube as two lines with open-end caps, Line keeps a bare wireframe. Yaw / Pitch / Perspective set the camera - wire Frame into Yaw to orbit. Decks and rails draw on the Deck pen. Fits inside Margin.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "bays", label: "Bays", type: "slider", min: 1, max: 14, step: 1, def: 6 },
    { key: "lifts", label: "Lifts", type: "slider", min: 1, max: 12, step: 1, def: 5 },
    { key: "rows", label: "Rows (depth)", type: "slider", min: 1, max: 3, step: 1, def: 2 },
    { key: "liftR", label: "Lift height (x bay)", type: "slider", min: 0.4, max: 1.6, step: 0.05, def: 0.8 },
    { key: "depthR", label: "Depth (x bay)", type: "slider", min: 0.15, max: 0.8, step: 0.05, def: 0.35 },
    { key: "shape", label: "Shape", type: "select", options: ["Full", "Ragged", "Stairs", "Pyramid"], def: "Ragged" },
    { key: "vary", label: "Vary", type: "slider", min: 0, max: 1, step: 0.05, def: 0.4, showIf: (p) => p.shape !== "Full" },
    { key: "braces", label: "Braces", type: "select", options: ["None", "Ends", "Zigzag", "Lattice", "Random"], def: "Zigzag" },
    { key: "decks", label: "Decks", type: "select", options: ["None", "Top", "Every lift", "Alternate"], def: "Every lift" },
    { key: "boards", label: "Boards per deck", type: "slider", min: 2, max: 6, step: 1, def: 3, showIf: (p) => p.decks !== "None" },
    { key: "rails", label: "Guardrails + toe boards", type: "check", def: true, showIf: (p) => p.decks !== "None" },
    { key: "couplers", label: "Couplers", type: "check", def: true },
    { key: "tube", label: "Tube", type: "select", options: ["Line", "Double"], def: "Double" },
    { key: "tubeW", label: "Tube width mm", type: "slider", min: 0.4, max: 3, step: 0.1, def: 1.2 },
    { key: "yaw", label: "Yaw deg (wire Frame)", type: "slider", min: -80, max: 80, step: 1, def: 28 },
    { key: "pitch", label: "Pitch deg", type: "slider", min: 0, max: 60, step: 1, def: 18 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "pen", label: "Tube pen", type: "pen", def: 0 },
    { key: "deckPen", label: "Deck pen", type: "pen", def: 10 },
  ],
  overlay(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const m = Math.max(0, +(p && p.margin) || 0);
    return [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
  },
  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
    const bays = clampI(p.bays, 1, 40);
    const lifts = clampI(p.lifts, 1, 40);
    const rows = clampI(p.rows, 1, 4);
    const spans = rows - 1;
    const L = Math.max(0.1, +p.liftR || 0.8);
    const D = Math.max(0.05, +p.depthR || 0.35);
    const depth = spans * D;
    const seed = Math.round(+p.seed || 0);
    const vary = Math.max(0, Math.min(1, +p.vary || 0));
    const tw = Math.max(0.1, +p.tubeW || 1);
    const dbl = p.tube === "Double";
    const sh = dbl ? tw / 2 : 0;
    const pen = clampI(p.pen, 0, 11);
    const dpen = clampI(p.deckPen, 0, 11);

    /* --- column heights in lifts (shared across rows) --- */
    const hs = [];
    for (let i = 0; i <= bays; i++) {
      let f = 1;
      if (p.shape === "Ragged") f = 1 - vary * hash2(i, 7, seed * 31 + 1);
      else if (p.shape === "Stairs") f = 1 - vary * (1 - i / bays);
      else if (p.shape === "Pyramid") f = 1 - vary * Math.abs(i - bays / 2) / (bays / 2 || 1);
      hs.push(Math.max(1, Math.round(lifts * f)));
    }
    let maxH = 1;
    for (const h of hs) maxH = Math.max(maxH, h);

    /* --- camera: yaw about the vertical, pitch tilts the camera down --- */
    const yaw = (+p.yaw || 0) * Math.PI / 180;
    const pit = Math.max(-1.5, Math.min(1.5, (+p.pitch || 0) * Math.PI / 180));
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const persp = Math.max(0, Math.min(3, +p.persp || 0));
    const view = (x, y, z) => {
      const vx = x * cy - y * sy, vy = x * sy + y * cy;
      return [vx, vy * cp - z * sp, z * cp + vy * sp];
    };
    const railsOn = p.decks !== "None" && !!p.rails && spans > 0;
    const zTop = maxH * L + (railsOn ? 0.55 * L : 0);
    const padW = 0.08;
    const corners = [];
    for (const x of [-padW, bays + padW]) for (const y of [-padW, depth + padW]) for (const z of [0, zTop]) corners.push(view(x, y, z));
    let dMin = Infinity, dMax = -Infinity;
    for (const c of corners) { dMin = Math.min(dMin, c[1]); dMax = Math.max(dMax, c[1]); }
    const S = Math.max(1e-6, dMax - dMin);
    const pv = (v) => { const s = 1 / (1 + persp * (v[1] - dMin) / S); return [v[0] * s, -v[2] * s]; };

    /* --- fit the projected padded box into the margin box --- */
    const m = Math.max(0, +p.margin || 0);
    const pad = tw * 1.2;
    const boxW = Math.max(1, W - 2 * m - 2 * pad), boxH = Math.max(1, H - 2 * m - 2 * pad);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of corners) { const q = pv(c); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const k = Math.min(boxW / Math.max(1e-6, x1 - x0), boxH / Math.max(1e-6, y1 - y0));
    const cx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
    const P = (x, y, z) => { const q = pv(view(x, y, z)); return [W / 2 + (q[0] - cx) * k, H / 2 + (q[1] - cyy) * k]; };

    /* --- emission with a point budget; least important geometry last --- */
    const paths = [];
    let budget = 115000;
    const add = (pts, closed, layer) => { if (budget <= 0 || pts.length < 2) return; budget -= pts.length; paths.push({ pts, closed, layer }); };
    const tube = (a, b, layer, sa, sb) => {
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return;
      dx /= len; dy /= len;
      sa = sa || 0; sb = sb || 0;
      if (len - sa - sb < 0.05) return;
      const A = [a[0] + dx * sa, a[1] + dy * sa], B = [b[0] - dx * sb, b[1] - dy * sb];
      if (!dbl) { add([A, B], false, layer); return; }
      const nx = -dy * tw / 2, ny = dx * tw / 2;
      add([[A[0] + nx, A[1] + ny], [B[0] + nx, B[1] + ny]], false, layer);
      add([[B[0] - nx, B[1] - ny], [A[0] - nx, A[1] - ny]], false, layer);
    };
    const Y = (r) => r * D;
    const zBase = 0.12 * L;
    const levelsTo = (h) => { const lv = [zBase]; for (let j = 1; j <= h; j++) lv.push(j * L); return lv; };

    /* decks: which bay/lift carries boards */
    const deckAt = (i, j) => {
      if (i < 0 || i >= bays) return false;
      const hm = Math.min(hs[i], hs[i + 1]);
      if (spans <= 0 || j < 1 || j > hm) return false;
      if (p.decks === "Top") return j === hm;
      if (p.decks === "Every lift") return true;
      if (p.decks === "Alternate") return (hm - j) % 2 === 0;
      return false;
    };
    /* a standard runs on to guardrail height when a deck sits at its top */
    const topZ = (i) => hs[i] * L + (railsOn && (deckAt(i - 1, hs[i]) || deckAt(i, hs[i])) ? 0.55 * L : 0);

    /* standards + open-end caps */
    for (let i = 0; i <= bays; i++) for (let r = 0; r < rows; r++) {
      const a = P(i, Y(r), 0), b = P(i, Y(r), topZ(i));
      tube(a, b, pen);
      if (dbl) {
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const nx = -ty, ny = tx;
        const rx = tw / 2, ry = (tw / 2) * Math.max(0.15, Math.abs(sp));
        const pts = [];
        for (let q = 0; q < 10; q++) {
          const a2 = (q / 10) * Math.PI * 2;
          const u = Math.cos(a2) * rx, v = Math.sin(a2) * ry;
          pts.push([b[0] + nx * u + tx * v, b[1] + ny * u + ty * v]);
        }
        add(pts, true, pen);
      }
    }
    /* ledgers along the facade */
    for (let i = 0; i < bays; i++) {
      const lv = levelsTo(Math.min(hs[i], hs[i + 1]));
      for (let r = 0; r < rows; r++) for (const z of lv) tube(P(i, Y(r), z), P(i + 1, Y(r), z), pen, sh, sh);
    }
    /* transoms across the depth */
    for (let i = 0; i <= bays; i++) {
      const lv = levelsTo(hs[i]);
      for (let r = 0; r < spans; r++) for (const z of lv) tube(P(i, Y(r), z), P(i, Y(r + 1), z), pen, sh, sh);
    }
    /* braces on the outer face (y = 0) */
    const bm = p.braces;
    const braceDir = (i, j) => {
      if (bm === "Ends") return (i === 0 || i === bays - 1) ? (j & 1) : -1;
      if (bm === "Zigzag") return (i % 3 === 0 || i === bays - 1) ? (j & 1) : -1;
      if (bm === "Lattice") return (i + j) & 1;
      if (bm === "Random") return hash2(i, j, seed * 17 + 3) < 0.45 ? (hash2(i, j, seed * 23 + 5) < 0.5 ? 0 : 1) : -1;
      return -1;
    };
    const off = 0.08 * L;
    for (let i = 0; i < bays; i++) {
      const hm = Math.min(hs[i], hs[i + 1]);
      for (let j = 0; j < hm; j++) {
        const d = braceDir(i, j);
        if (d < 0) continue;
        const z0 = (j === 0 ? zBase : j * L) + off, z1 = (j + 1) * L - off;
        const a = P(d === 0 ? i : i + 1, 0, z0), b = P(d === 0 ? i + 1 : i, 0, z1);
        tube(a, b, pen);
      }
    }
    /* end braces across the depth on both end faces */
    if (spans > 0 && bm !== "None") {
      for (const i of [0, bays]) for (let j = 0; j < hs[i]; j++) {
        if (bm === "Random" && hash2(i + 101, j, seed * 17 + 3) >= 0.45) continue;
        const d = (j + (i === 0 ? 0 : 1)) & 1;
        const z0 = (j === 0 ? zBase : j * L) + off, z1 = (j + 1) * L - off;
        const a = P(i, d === 0 ? 0 : depth, z0), b = P(i, d === 0 ? depth : 0, z1);
        tube(a, b, pen);
      }
    }
    /* guardrails, end rails and toe boards */
    if (railsOn) {
      for (let i = 0; i < bays; i++) for (let j = 1; j <= Math.min(hs[i], hs[i + 1]); j++) {
        if (!deckAt(i, j)) continue;
        const z = j * L;
        tube(P(i, 0, z + 0.25 * L), P(i + 1, 0, z + 0.25 * L), pen, sh, sh);
        tube(P(i, 0, z + 0.5 * L), P(i + 1, 0, z + 0.5 * L), pen, sh, sh);
        add([P(i + 0.02, 0, z), P(i + 0.98, 0, z), P(i + 0.98, 0, z + 0.08 * L), P(i + 0.02, 0, z + 0.08 * L)], true, dpen);
      }
      for (const i of [0, bays]) {
        const bi = i === 0 ? 0 : bays - 1;
        for (let j = 1; j <= Math.min(hs[bi], hs[bi + 1]); j++) {
          if (!deckAt(bi, j)) continue;
          const z = j * L;
          tube(P(i, 0, z + 0.25 * L), P(i, depth, z + 0.25 * L), pen, sh, sh);
          tube(P(i, 0, z + 0.5 * L), P(i, depth, z + 0.5 * L), pen, sh, sh);
        }
      }
    }
    /* base plates */
    const bp = 0.05;
    for (let i = 0; i <= bays; i++) for (let r = 0; r < rows; r++) {
      const y = Y(r);
      add([P(i - bp, y - bp, 0), P(i + bp, y - bp, 0), P(i + bp, y + bp, 0), P(i - bp, y + bp, 0)], true, pen);
    }
    /* deck boards */
    if (spans > 0 && p.decks !== "None") {
      const nb = clampI(p.boards, 1, 12);
      const bw = depth / nb, g = 0.06 * bw;
      for (let i = 0; i < bays; i++) for (let j = 1; j <= Math.min(hs[i], hs[i + 1]); j++) {
        if (!deckAt(i, j)) continue;
        const z = j * L;
        for (let b = 0; b < nb; b++) {
          const ya = b * bw + g, yb = (b + 1) * bw - g;
          const e0 = 0.015 + 0.025 * hash2(i * 7 + b, j, seed * 41 + 9);
          const e1 = 0.015 + 0.025 * hash2(i * 7 + b, j + 500, seed * 41 + 9);
          add([P(i + e0, ya, z), P(i + 1 - e1, ya, z), P(i + 1 - e1, yb, z), P(i + e0, yb, z)], true, dpen);
        }
      }
    }
    /* couplers at every ledger/standard joint (screen-space clamps) */
    if (p.couplers) {
      const cw = tw * 2.1, ch = Math.max(0.4, tw * 1.1);
      for (let i = 0; i <= bays; i++) for (let r = 0; r < rows; r++) {
        const q0 = P(i, Y(r), 0), q1 = P(i, Y(r), L);
        let tx = q1[0] - q0[0], ty = q1[1] - q0[1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const nx = -ty, ny = tx;
        for (const z of levelsTo(hs[i])) {
          const q = P(i, Y(r), z);
          add([
            [q[0] + tx * ch / 2 + nx * cw / 2, q[1] + ty * ch / 2 + ny * cw / 2],
            [q[0] + tx * ch / 2 - nx * cw / 2, q[1] + ty * ch / 2 - ny * cw / 2],
            [q[0] - tx * ch / 2 - nx * cw / 2, q[1] - ty * ch / 2 - ny * cw / 2],
            [q[0] - tx * ch / 2 + nx * cw / 2, q[1] - ty * ch / 2 + ny * cw / 2],
          ], true, pen);
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
