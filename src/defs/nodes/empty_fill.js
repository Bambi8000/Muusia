import { Pin, EMPTY, PENS, hash2, noise2, resample, pathLength } from "../helpers.js";

export default {
  key: "empty_fill",
  name: "Empty Fill",
  cat: "mod",
  group: "fillstyle",
  desc: "Fills the EMPTY space around the input shapes with a repeating line texture \u2014 the doodle trick where stones stay blank and everything between them gets dense pattern. Closed input paths block by their area, open paths by proximity. Pattern: Coils (overlapping occluded circles, slinky look), Contours (distance ripples hugging every shape), Scales (fish-scale arcs), Hatch / Crosshatch, Waves. Spacing sets pattern pitch, Gap keeps a clean clearance ring around the shapes, Wobble adds hand-drawn waviness, Angle rotates the texture (Contours ignore it). Keep input passes the original shapes through on their own pens. Tip: feed it Potato or Pebble blobs for the classic stone-doodle page.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "pattern", label: "Pattern", type: "select",
      options: ["Coils", "Contours", "Scales", "Hatch", "Crosshatch", "Waves"], def: "Coils" },
    { key: "spacing", label: "Spacing", type: "slider", min: 1, max: 12, step: 0.1, def: 2.8 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 12, step: 0.1, def: 1.8 },
    { key: "angle", label: "Angle", type: "slider", min: 0, max: 180, step: 1, def: 0 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.25 },
    { key: "seed", label: "Seed", type: "seed", def: 3 },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 50, step: 1, def: 8 },
    { key: "keep", label: "Keep input", type: "check", def: true },
    { key: "pen", label: "Fill pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const { W, H } = ctx;
    const spacing = Math.max(0.6, p.spacing);
    const gap = Math.max(0, p.gap);
    const wob = Math.max(0, Math.min(1, p.wobble));
    const seed = Math.round(p.seed);
    const margin = Math.max(0, p.margin);
    const pen = Math.round(p.pen) % PENS.length;
    const out = [];
    if (p.keep) for (const q of src.paths) out.push(q);

    const lox = margin, loy = margin, hix = W - margin, hiy = H - margin;
    if (hix - lox < 4 || hiy - loy < 4) return { paths: out };

    /* ---------- distance field on a node grid ---------- */
    const cell = Math.max(0.6, Math.min(1.6, spacing * 0.35));
    const gw = Math.floor((hix - lox) / cell) + 1;
    const gh = Math.floor((hiy - loy) / cell) + 1;
    const BIG = 1e9;
    const D = new Float64Array(gw * gh).fill(BIG);
    let hasBlockers = false;

    for (const q of src.paths) {
      if (q.pts.length < 2) continue;
      hasBlockers = true;
      if (q.closed && q.pts.length >= 3) {
        // scanline fill of the polygon interior onto grid nodes
        let ymin = Infinity, ymax = -Infinity;
        for (const [, y] of q.pts) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
        const j0 = Math.max(0, Math.ceil((ymin - loy) / cell));
        const j1 = Math.min(gh - 1, Math.floor((ymax - loy) / cell));
        for (let j = j0; j <= j1; j++) {
          const y = loy + j * cell;
          const xs = [];
          const n = q.pts.length;
          for (let i = 0; i < n; i++) {
            const [x0, y0] = q.pts[i], [x1, y1] = q.pts[(i + 1) % n];
            if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y))
              xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const ia = Math.max(0, Math.ceil((xs[k] - lox) / cell));
            const ib = Math.min(gw - 1, Math.floor((xs[k + 1] - lox) / cell));
            for (let i = ia; i <= ib; i++) D[j * gw + i] = 0;
          }
        }
      }
      // stamp the outline / open path so thin shapes block too
      const dense = resample(q.pts, q.closed, cell * 0.6);
      for (const [x, y] of dense) {
        const i = Math.round((x - lox) / cell), j = Math.round((y - loy) / cell);
        if (i >= 0 && i < gw && j >= 0 && j < gh) D[j * gw + i] = 0;
      }
    }

    // two-pass chamfer distance transform (mm)
    const co = cell, cd = cell * 1.41421356;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      let v = D[k];
      if (i > 0) v = Math.min(v, D[k - 1] + co);
      if (j > 0) v = Math.min(v, D[k - gw] + co);
      if (i > 0 && j > 0) v = Math.min(v, D[k - gw - 1] + cd);
      if (i < gw - 1 && j > 0) v = Math.min(v, D[k - gw + 1] + cd);
      D[k] = v;
    }
    for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
      const k = j * gw + i;
      let v = D[k];
      if (i < gw - 1) v = Math.min(v, D[k + 1] + co);
      if (j < gh - 1) v = Math.min(v, D[k + gw] + co);
      if (i < gw - 1 && j < gh - 1) v = Math.min(v, D[k + gw + 1] + cd);
      if (i > 0 && j < gh - 1) v = Math.min(v, D[k + gw - 1] + cd);
      D[k] = v;
    }

    const distAt = (x, y) => {
      if (x < lox || x > hix || y < loy || y > hiy) return -1;
      const fx = (x - lox) / cell, fy = (y - loy) / cell;
      const i = Math.min(gw - 2, Math.max(0, Math.floor(fx)));
      const j = Math.min(gh - 2, Math.max(0, Math.floor(fy)));
      const tx = Math.min(1, Math.max(0, fx - i)), ty = Math.min(1, Math.max(0, fy - j));
      const k = j * gw + i;
      const a = D[k], b = D[k + 1], c = D[k + gw], d = D[k + gw + 1];
      return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    };

    let budget = 110000;
    const push = (pts, closed) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      out.push({ pts, closed, layer: pen });
    };
    const simplify = (pts, tol) => {
      if (pts.length < 3) return pts;
      const o = [pts[0]];
      let a = pts[0];
      for (let i = 1; i < pts.length - 1; i++) {
        const b = pts[i + 1], q = pts[i];
        const ux = b[0] - a[0], uy = b[1] - a[1];
        const L = Math.hypot(ux, uy) || 1;
        if (Math.abs((q[0] - a[0]) * uy - (q[1] - a[1]) * ux) / L > tol) {
          o.push(q); a = q;
        }
      }
      o.push(pts[pts.length - 1]);
      return o;
    };

    // split a sampled polyline into kept runs; keepFn(pt) -> bool
    const emitClipped = (pts, closed, keepFn, tol) => {
      const n = pts.length;
      if (n < 2) return;
      const ok = pts.map(keepFn);
      if (closed && ok.every(Boolean)) { push(simplify(pts, tol), true); return; }
      let start = 0;
      if (closed) {
        start = ok.findIndex((v) => !v);
        if (start < 0) start = 0;
      }
      let run = [];
      const flush = () => {
        if (run.length >= 2 && pathLength(run, false) > 1.1)
          push(simplify(run, tol), false);
        run = [];
      };
      const total = closed ? n : n;
      for (let s = 0; s < total; s++) {
        const i = closed ? (start + s) % n : s;
        if (ok[i]) run.push(pts[i].slice());
        else flush();
      }
      flush();
    };

    const baseKeep = ([x, y]) => distAt(x, y) > gap;

    /* ---------- rotated-frame helpers ---------- */
    const cx = W / 2, cy = H / 2;
    const ang = (p.angle * Math.PI) / 180;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const toWorld = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
    const DIAG = Math.hypot(hix - lox, hiy - loy) / 2 + spacing * 2;
    const wnoise = (x, y) => (noise2(x * 0.13, y * 0.13, seed) - 0.5) * spacing * 2 * wob;

    /* ---------- patterns ---------- */
    if (p.pattern === "Contours") {
      if (!hasBlockers) return { paths: out };
      // wobble the field itself for organic contours
      const V = new Float64Array(gw * gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const x = lox + i * cell, y = loy + j * cell;
        V[j * gw + i] = D[j * gw + i] + (wob > 0 ? wnoise(x, y) : 0);
      }
      let maxd = 0;
      for (let k = 0; k < V.length; k++) if (V[k] < BIG / 2) maxd = Math.max(maxd, V[k]);
      const L0 = Math.max(gap, 0.4);
      const key = (x, y) => Math.round(x * 128) + "," + Math.round(y * 128);
      for (let lev = L0, li = 0; lev <= maxd + spacing && li < 300 && budget > 0; lev += spacing, li++) {
        const segs = [];
        for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
          const a = V[j * gw + i], b = V[j * gw + i + 1];
          const d = V[(j + 1) * gw + i], c = V[(j + 1) * gw + i + 1];
          const idx = (a > lev ? 8 : 0) | (b > lev ? 4 : 0) | (c > lev ? 2 : 0) | (d > lev ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const x0 = lox + i * cell, y0 = loy + j * cell;
          const it = (va, vb) => (lev - va) / (vb - va);
          const T = [x0 + it(a, b) * cell, y0];
          const R = [x0 + cell, y0 + it(b, c) * cell];
          const B = [x0 + it(d, c) * cell, y0 + cell];
          const Lp = [x0, y0 + it(a, d) * cell];
          const avg = (a + b + c + d) / 4;
          const add = (u, v) => segs.push([u, v]);
          if (idx === 1 || idx === 14) add(Lp, B);
          else if (idx === 2 || idx === 13) add(B, R);
          else if (idx === 3 || idx === 12) add(Lp, R);
          else if (idx === 4 || idx === 11) add(T, R);
          else if (idx === 6 || idx === 9) add(T, B);
          else if (idx === 7 || idx === 8) add(T, Lp);
          else if (idx === 5) { if (avg > lev) { add(T, Lp); add(B, R); } else { add(T, R); add(Lp, B); } }
          else if (idx === 10) { if (avg > lev) { add(T, R); add(Lp, B); } else { add(T, Lp); add(B, R); } }
        }
        // chain segments into polylines
        const map = new Map();
        const link = (k, si, end) => {
          if (!map.has(k)) map.set(k, []);
          map.get(k).push([si, end]);
        };
        segs.forEach((s, si) => {
          link(key(s[0][0], s[0][1]), si, 0);
          link(key(s[1][0], s[1][1]), si, 1);
        });
        const used = new Array(segs.length).fill(false);
        for (let si = 0; si < segs.length && budget > 0; si++) {
          if (used[si]) continue;
          used[si] = true;
          let chain = [segs[si][0], segs[si][1]];
          let grew = true;
          while (grew) {
            grew = false;
            const tail = chain[chain.length - 1];
            for (const [oj, end] of map.get(key(tail[0], tail[1])) || []) {
              if (used[oj]) continue;
              used[oj] = true;
              chain.push(segs[oj][1 - end]);
              grew = true;
              break;
            }
          }
          let grew2 = true;
          while (grew2) {
            grew2 = false;
            const head = chain[0];
            for (const [oj, end] of map.get(key(head[0], head[1])) || []) {
              if (used[oj]) continue;
              used[oj] = true;
              chain.unshift(segs[oj][1 - end]);
              grew2 = true;
              break;
            }
          }
          const closed = Math.hypot(chain[0][0] - chain[chain.length - 1][0],
                                    chain[0][1] - chain[chain.length - 1][1]) < cell * 0.6;
          if (closed) chain.pop();
          if (chain.length >= 3 || (!closed && chain.length >= 2))
            push(simplify(chain, 0.05), closed);
        }
      }
      return { paths: out };
    }

    const sampleCircle = (mx, my, r, jseed) => {
      const n = Math.max(20, Math.ceil((2 * Math.PI * r) / 0.9));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        let rr = r;
        if (wob > 0) {
          const px = mx + Math.cos(a) * r, py = my + Math.sin(a) * r;
          rr = r * (1 + (noise2(px * 0.3, py * 0.3, seed + jseed) - 0.5) * 0.4 * wob);
        }
        pts.push([mx + Math.cos(a) * rr, my + Math.sin(a) * rr]);
      }
      return pts;
    };

    if (p.pattern === "Coils" || p.pattern === "Scales") {
      const coil = p.pattern === "Coils";
      const r = coil ? spacing * 1.5 : spacing * 1.3;
      const colP = coil ? r * 0.42 : r * 1.7;
      const rowP = coil ? r * 1.7 : spacing * 1.05;
      const jrow = Math.ceil(DIAG / rowP), jcol = Math.ceil(DIAG / colP);
      for (let j = -jrow; j <= jrow && budget > 0; j++) {
        for (let i = -jcol; i <= jcol && budget > 0; i++) {
          const jx = (hash2(i, j, seed) - 0.5) * spacing * 0.8 * wob;
          const jy = (hash2(i + 311, j, seed) - 0.5) * spacing * 0.8 * wob;
          const lxs = i * colP + (coil ? 0 : (j & 1) * colP * 0.5) + jx;
          const lys = j * rowP + jy;
          const [mx, my] = toWorld(lxs, lys);
          if (mx < lox - r || mx > hix + r || my < loy - r || my > hiy + r) continue;
          // occluders in local frame
          const occ = [];
          if (coil) {
            occ.push([lxs + colP - jx + (hash2(i + 1, j, seed) - 0.5) * spacing * 0.8 * wob,
                      lys - jy + (hash2(i + 312, j, seed) - 0.5) * spacing * 0.8 * wob]);
          } else {
            // two nearest circles of the row below occlude this one
            const off1 = ((j + 1) & 1) * colP * 0.5;
            const k0 = Math.floor((lxs - off1) / colP);
            occ.push([k0 * colP + off1, (j + 1) * rowP]);
            occ.push([(k0 + 1) * colP + off1, (j + 1) * rowP]);
          }
          const occW = occ.map(([x, y]) => toWorld(x, y));
          const keep = ([x, y]) => {
            if (distAt(x, y) <= gap) return false;
            for (const [ox2, oy2] of occW)
              if (Math.hypot(x - ox2, y - oy2) < r) return false;
            return true;
          };
          emitClipped(sampleCircle(mx, my, r, i * 613 + j * 31), true, keep, 0.03);
        }
      }
      return { paths: out };
    }

    // Hatch / Crosshatch / Waves — straight or wavy scan lines in rotated frame
    const angles = p.pattern === "Crosshatch" ? [0, Math.PI / 2] : [0];
    for (const extra of angles) {
      const c2 = Math.cos(ang + extra), s2 = Math.sin(ang + extra);
      const tw = (x, y) => [cx + x * c2 - y * s2, cy + x * s2 + y * c2];
      const step = Math.max(0.5, cell * 0.8);
      const wav = spacing * 5, amp = spacing * 0.45;
      for (let y = -DIAG; y <= DIAG && budget > 0; y += spacing) {
        const pts = [];
        for (let x = -DIAG; x <= DIAG; x += step) {
          let yy = y;
          if (p.pattern === "Waves") yy += Math.sin((x / wav) * Math.PI * 2) * amp;
          let [wx, wy] = tw(x, yy);
          if (wob > 0) {
            const d = wnoise(wx, wy);
            wx += -s2 * d; wy += c2 * d;
          }
          pts.push([wx, wy]);
        }
        emitClipped(pts, false, baseKeep, 0.05);
      }
    }
    return { paths: out };
  },
};
