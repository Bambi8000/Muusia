import { Pin, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "cmyk_registration",
  name: "CMYK Registration",
  cat: "gen",
  group: "scientific",
  desc: "A love letter to prepress furniture: authentic printing registration and control marks as plotter art. Thirteen mark types from across print history - crosshair targets, letterpress bullseyes, GATF-style star targets, Japanese tombo trim marks (center and corner), Western crop marks, a CMYK color bar with real screen angles (C 15, M 75, Y 0, K 45 deg), slur/ladder gauges, flexo eye-mark stacks, quartered survey targets, micro-registration crosses, bookbinding collation steps, and graduated scale crosses. Registration-color marks plot once per plate with a seeded per-plate Misregistration offset (plus optional per-mark Wobble), recreating classic out-of-register ghosting; single-channel patches (color bar, eye marks, collation steps) plot only on their own plate. Tick the mark checkboxes to choose which types appear; the layout then arranges a seeded mix of the ticked marks (none ticked falls back to crosshairs). Grid, Ring, Border and Scatter spread them as a pattern; Press sheet builds a full imposition sheet around the trim frame using only the ticked types. Single draws one mark at the canvas center, chosen with the Single mark dropdown (the checkboxes only drive the other layouts) - except Tombo corner and Crop marks, which place one properly oriented mark at each trim-frame corner. Map the four plate pens to your cyan, magenta, yellow and black pens; Fill pitch sets the hatch spacing of solid patches.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "layout", label: "Layout", type: "select", options: ["Grid", "Single", "Press sheet", "Ring", "Border", "Scatter"], def: "Grid" },
    { key: "single", label: "Single mark", type: "select", options: ["Crosshair target", "Bullseye", "Star target", "Tombo center", "Tombo corner", "Crop marks", "Color bar", "Ladder gauge", "Eye marks", "Quartered target", "Micro cross", "Collation steps", "Scale cross"], def: "Crosshair target", showIf: (p) => p.layout === "Single" },
    { key: "mCross", label: "Crosshair target", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mBull", label: "Bullseye", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mStar", label: "Star target", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mTomboC", label: "Tombo center", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mTomboK", label: "Tombo corner", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mCrop", label: "Crop marks", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mBar", label: "Color bar", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mLadder", label: "Ladder gauge", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mEye", label: "Eye marks", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mQuart", label: "Quartered target", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mMicro", label: "Micro cross", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mSteps", label: "Collation steps", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "mScale", label: "Scale cross", type: "check", def: true, showIf: (p) => p.layout !== "Single" },
    { key: "size", label: "Mark size", type: "slider", min: 4, max: 40, step: 0.5, def: 12 },
    { key: "count", label: "Count", type: "slider", min: 1, max: 60, step: 1, def: 14, showIf: (p) => p.layout !== "Single" && p.layout !== "Press sheet" },
    { key: "margin", label: "Margin", type: "slider", min: 4, max: 60, step: 0.5, def: 16 },
    { key: "misreg", label: "Misregistration", type: "slider", min: 0, max: 8, step: 0.05, def: 0.8 },
    { key: "wobble", label: "Wobble", type: "slider", min: 0, max: 5, step: 0.05, def: 0 },
    { key: "hatch", label: "Fill pitch", type: "slider", min: 0.3, max: 2, step: 0.05, def: 0.7 },
    { key: "plates", label: "Plates", type: "select", options: ["CMYK", "CMY", "CM", "K only"], def: "CMYK" },
    { key: "frame", label: "Trim frame", type: "check", def: true },
    { key: "penC", label: "Cyan pen", type: "pen", def: 11 },
    { key: "penM", label: "Magenta pen", type: "pen", def: 7 },
    { key: "penY", label: "Yellow pen", type: "pen", def: 10 },
    { key: "penK", label: "Black pen", type: "pen", def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],

  _circlePts(cx, cy, r) {
    const n = Math.max(12, Math.min(72, Math.round(r * 5) + 8));
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  },

  _arcPts(cx, cy, r, a0, a1) {
    const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) * r * 1.4) + 1);
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const a = a0 + (a1 - a0) * (k / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  },

  _clipSeg(x0, y0, x1, y1, rx0, ry0, rx1, ry1) {
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const p = [-dx, dx, -dy, dy];
    const q = [x0 - rx0, rx1 - x0, y0 - ry0, ry1 - y0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return null; }
      else {
        const r = q[i] / p[i];
        if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
        else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
    }
    return [[x0 + dx * t0, y0 + dy * t0], [x0 + dx * t1, y0 + dy * t1]];
  },

  _hatchEls(x, y, w, h, angDeg, step, ch) {
    const els = [];
    const st = Math.max(0.25, step);
    const a = (angDeg * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const nx = -dy, ny = dx;
    const cxm = x + w / 2, cym = y + h / 2;
    const ext = Math.hypot(w, h) / 2 + 0.5;
    const cnt = Math.min(300, Math.floor((2 * ext) / st));
    let flip = false;
    for (let k = 0; k < cnt; k++) {
      const c = -ext + (k + 0.5) * st;
      if (c > ext) break;
      const px = cxm + nx * c, py = cym + ny * c;
      const seg = this._clipSeg(px - dx * ext * 1.6, py - dy * ext * 1.6, px + dx * ext * 1.6, py + dy * ext * 1.6, x, y, x + w, y + h);
      if (seg) {
        els.push({ pts: flip ? [seg[1], seg[0]] : seg, closed: false, ch });
        flip = !flip;
      }
    }
    return els;
  },

  _rectEls(x, y, w, h, ch) {
    return [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true, ch }];
  },

  _KEYS: [["mCross", "crosshair"], ["mBull", "bullseye"], ["mStar", "star"], ["mTomboC", "tombo_center"], ["mTomboK", "tombo_corner"], ["mCrop", "crop"], ["mBar", "colorbar"], ["mLadder", "ladder"], ["mEye", "eyemark"], ["mQuart", "quartered"], ["mMicro", "micro"], ["mSteps", "steps"], ["mScale", "scalecross"]],

  _enabled(p) {
    const on = this._KEYS.filter(([k]) => p[k]).map(([, t]) => t);
    return on.length ? on : ["crosshair"];
  },

  _singleType(p) {
    const MAP = {
      "Crosshair target": "crosshair", "Bullseye": "bullseye", "Star target": "star",
      "Tombo center": "tombo_center", "Tombo corner": "tombo_corner", "Crop marks": "crop",
      "Color bar": "colorbar", "Ladder gauge": "ladder", "Eye marks": "eyemark",
      "Quartered target": "quartered", "Micro cross": "micro", "Collation steps": "steps",
      "Scale cross": "scalecross",
    };
    return MAP[p.single] || "crosshair";
  },

  _ext(t, s) {
    if (t === "colorbar") return s * 2.5;
    if (t === "steps") return s * 1.4;
    if (t === "eyemark") return s * 1.2;
    if (t === "micro") return s * 0.4;
    if (t === "crop") return s * 1.0;
    return s * 1.1;
  },

  _mark(t, sz, hatch) {
    const s = Math.max(2, sz);
    const els = [];
    const L = (x0, y0, x1, y1, ch) => els.push({ pts: [[x0, y0], [x1, y1]], closed: false, ch });
    const C = (r, ch) => els.push({ pts: this._circlePts(0, 0, r), closed: true, ch });
    const ANG = [15, 75, 0, 45];
    const ht = Math.max(0.3, hatch);
    if (t === "crosshair") {
      C(s * 0.55, -1);
      L(-s, 0, s, 0, -1);
      L(0, -s, 0, s, -1);
    } else if (t === "bullseye") {
      C(s * 0.14, -1);
      C(s * 0.4, -1);
      C(s * 0.72, -1);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        L(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8, Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05, -1);
      }
    } else if (t === "star") {
      C(s, -1);
      const n = 24, d = (Math.PI * 2) / n, r0 = s * 0.07;
      for (let j = 0; j < n; j += 2) {
        const a0 = j * d, a1 = a0 + d, am = (a0 + a1) / 2;
        const pts = [[Math.cos(am) * r0, Math.sin(am) * r0], [Math.cos(a0) * s * 0.96, Math.sin(a0) * s * 0.96]];
        const arc = this._arcPts(0, 0, s * 0.96, a0, a1);
        for (let q = 1; q < arc.length; q++) pts.push(arc[q]);
        els.push({ pts, closed: true, ch: -1 });
      }
    } else if (t === "tombo_center") {
      const g = s * 0.3;
      L(-s, 0, s, 0, -1);
      L(0, -s, 0, s, -1);
      L(-s * 0.5, -g, s * 0.5, -g, -1);
    } else if (t === "tombo_corner") {
      const g = s * 0.3;
      L(0, 0, s, 0, -1);
      L(-g, -g, s, -g, -1);
      L(0, 0, 0, s, -1);
      L(-g, -g, -g, s, -1);
    } else if (t === "crop") {
      const g = s * 0.28;
      L(-s, 0, -g, 0, -1);
      L(0, -s, 0, -g, -1);
    } else if (t === "colorbar") {
      const pw = s * 0.55, gap = pw * 0.14, ph = s * 0.55;
      const tot = 8 * pw + 7 * gap;
      let x = -tot / 2;
      for (let ch = 0; ch < 4; ch++) {
        for (const tint of [1, 0.5]) {
          for (const e of this._rectEls(x, -ph / 2, pw, ph, ch)) els.push(e);
          for (const e of this._hatchEls(x, -ph / 2, pw, ph, ANG[ch], ht / tint, ch)) els.push(e);
          x += pw + gap;
        }
      }
    } else if (t === "ladder") {
      const bw = s * 0.9, bh = s * 0.55, gap = s * 0.14;
      for (const e of this._rectEls(-bw - gap / 2, -bh / 2, bw, bh, -1)) els.push(e);
      for (const e of this._hatchEls(-bw - gap / 2, -bh / 2, bw, bh, 0, ht, -1)) els.push(e);
      for (const e of this._rectEls(gap / 2, -bh / 2, bw, bh, -1)) els.push(e);
      for (const e of this._hatchEls(gap / 2, -bh / 2, bw, bh, 90, ht, -1)) els.push(e);
    } else if (t === "eyemark") {
      const ew = s * 1.15, eh = s * 0.42, gap = s * 0.16;
      const tot = 4 * eh + 3 * gap;
      for (let ch = 0; ch < 4; ch++) {
        const y = -tot / 2 + ch * (eh + gap);
        for (const e of this._rectEls(-ew / 2, y, ew, eh, ch)) els.push(e);
        for (const e of this._hatchEls(-ew / 2, y, ew, eh, 45, ht * 0.8, ch)) els.push(e);
      }
    } else if (t === "quartered") {
      C(s, -1);
      L(-s, 0, s, 0, -1);
      L(0, -s, 0, s, -1);
      const rstep = Math.max(ht, s / 80);
      for (let q = 0; q < 2; q++) {
        const a0 = q * Math.PI, a1 = a0 + Math.PI / 2;
        for (let r = rstep; r < s * 0.96; r += rstep) {
          els.push({ pts: this._arcPts(0, 0, r, a0, a1), closed: false, ch: -1 });
        }
      }
    } else if (t === "micro") {
      L(-s * 0.35, 0, s * 0.35, 0, -1);
      L(0, -s * 0.35, 0, s * 0.35, -1);
    } else if (t === "steps") {
      const rw = s * 0.55, rh = s * 0.3;
      for (let k = 0; k < 6; k++) {
        const x = (k - 2.5) * rw * 0.6, y = (k - 2.5) * rh * 0.95;
        for (const e of this._rectEls(x - rw / 2, y - rh / 2, rw, rh, k % 4)) els.push(e);
        for (const e of this._hatchEls(x - rw / 2, y - rh / 2, rw, rh, 45, ht * 0.9, k % 4)) els.push(e);
      }
    } else if (t === "scalecross") {
      L(-s, 0, s, 0, -1);
      L(0, -s, 0, s, -1);
      C(s * 0.18, -1);
      const n = 5;
      for (let k = -n; k <= n; k++) {
        if (!k) continue;
        const d = (k / n) * s;
        const tl = Math.abs(k) === n ? s * 0.14 : s * 0.08;
        L(d, -tl, d, tl, -1);
        L(-tl, d, tl, d, -1);
      }
    }
    return els;
  },

  _place(p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const m = Math.max(2, Math.min(p.margin, Math.min(W, H) * 0.45));
    const s = Math.max(2, Math.min(p.size, Math.min(W, H) * 0.6));
    const seedI = Math.round(p.seed);
    const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const iw = Math.max(1, x1 - x0), ih = Math.max(1, y1 - y0);
    const off = m * 0.5;
    const HP = Math.PI / 2;
    const out = [];
    const enabled = this._enabled(p);
    const typeAt = (i) => enabled[Math.floor(hash2(i * 13 + 1, 7, seedI + 31) * enabled.length) % enabled.length];
    const qrot = (i, t) => ((t === "tombo_corner" || t === "crop")
      ? Math.floor(hash2(i * 7 + 3, 5, seedI + 13) * 4) * HP
      : 0);
    const clampP = (x, y, e, bx0, by0, bx1, by1) => {
      const ex = Math.min(e + 0.5, (bx1 - bx0) / 2), ey = Math.min(e + 0.5, (by1 - by0) / 2);
      return [Math.min(Math.max(x, bx0 + ex), bx1 - ex), Math.min(Math.max(y, by0 + ey), by1 - ey)];
    };
    const n = Math.max(1, Math.min(400, Math.round(p.count)));

    if (p.layout === "Single") {
      const t = this._singleType(p);
      if (t === "tombo_corner" || t === "crop") {
        out.push({ x: x0, y: y0, t, rot: 0, s });
        out.push({ x: x1, y: y0, t, rot: HP, s });
        out.push({ x: x1, y: y1, t, rot: 2 * HP, s });
        out.push({ x: x0, y: y1, t, rot: 3 * HP, s });
      } else {
        out.push({ x: W / 2, y: H / 2, t, rot: 0, s });
      }
    } else if (p.layout === "Press sheet") {
      const push = (x, y, t, rot, sz) => { if (enabled.indexOf(t) !== -1) out.push({ x, y, t, rot, s: sz }); };
      push(x0, y0, "tombo_corner", 0, s);
      push(x1, y0, "tombo_corner", HP, s);
      push(x1, y1, "tombo_corner", 2 * HP, s);
      push(x0, y1, "tombo_corner", 3 * HP, s);
      push(cx, y0, "tombo_center", 0, s * 0.9);
      push(x0, cy, "tombo_center", HP, s * 0.9);
      push(x1, cy, "tombo_center", HP, s * 0.9);
      push(x0 - off * 0.55, y0 + ih * 0.25, "crosshair", 0, Math.min(s * 0.8, m * 0.9));
      push(x0 - off * 0.55, y0 + ih * 0.75, "crosshair", 0, Math.min(s * 0.8, m * 0.9));
      push(x1 + off * 0.55, y0 + ih * 0.25, "crosshair", 0, Math.min(s * 0.8, m * 0.9));
      push(x1 + off * 0.55, y0 + ih * 0.75, "crosshair", 0, Math.min(s * 0.8, m * 0.9));
      push(cx, y1 + off * 0.55, "colorbar", 0, Math.min(s, m * 1.1));
      push(x0 + iw * 0.16, y1 + off * 0.55, "star", 0, Math.min(s * 0.85, m * 0.85));
      push(x1 - iw * 0.16, y1 + off * 0.55, "star", 0, Math.min(s * 0.85, m * 0.85));
      push(cx - iw * 0.24, y0 - off * 0.55, "ladder", 0, Math.min(s * 0.9, m * 1.2));
      push(cx + iw * 0.24, y0 - off * 0.55, "quartered", 0, Math.min(s * 0.7, m * 0.8));
      push(x1 + off * 0.55, y0 + ih * 0.6, "eyemark", 0, Math.min(s * 0.65, m * 0.7));
      push(x0 - off * 0.55, y0 + ih * 0.4, "steps", 0, Math.min(s * 0.6, m * 0.6));
      push(cx, cy, "scalecross", 0, s * 1.1);
      const d = s * 0.7;
      push(x0 + d, y0 + d, "micro", 0, s * 0.5);
      push(x1 - d, y0 + d, "micro", 0, s * 0.5);
      push(x1 - d, y1 - d, "micro", 0, s * 0.5);
      push(x0 + d, y1 - d, "micro", 0, s * 0.5);
    } else if (p.layout === "Grid") {
      const cols = Math.max(1, Math.round(Math.sqrt((n * iw) / ih)));
      const rows = Math.max(1, Math.ceil(n / cols));
      for (let i = 0; i < n; i++) {
        const gx = i % cols, gy = Math.floor(i / cols);
        const x = x0 + iw * ((gx + 0.5) / cols);
        const y = y0 + ih * ((gy + 0.5) / rows);
        const t = typeAt(i);
        const c = clampP(x, y, this._ext(t, s), x0, y0, x1, y1);
        out.push({ x: c[0], y: c[1], t, rot: qrot(i, t), s });
      }
    } else if (p.layout === "Ring") {
      const rx = Math.max(1, iw / 2 - s * 1.2), ry = Math.max(1, ih / 2 - s * 1.2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - HP;
        const t = typeAt(i);
        const c = clampP(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, this._ext(t, s), x0, y0, x1, y1);
        out.push({ x: c[0], y: c[1], t, rot: qrot(i, t), s });
      }
    } else if (p.layout === "Border") {
      const per = 2 * (iw + ih);
      for (let i = 0; i < n; i++) {
        const d = ((i + 0.5) / n) * per;
        let x, y, rot;
        if (d < iw) { x = x0 + d; y = y0; rot = 0; }
        else if (d < iw + ih) { x = x1; y = y0 + (d - iw); rot = HP; }
        else if (d < 2 * iw + ih) { x = x1 - (d - iw - ih); y = y1; rot = 2 * HP; }
        else { x = x0; y = y1 - (d - 2 * iw - ih); rot = 3 * HP; }
        const t = typeAt(i);
        const c = clampP(x, y, this._ext(t, s), 0, 0, W, H);
        out.push({ x: c[0], y: c[1], t, rot, s });
      }
    } else {
      for (let i = 0; i < n; i++) {
        const t = typeAt(i);
        const e = this._ext(t, s);
        const sx = Math.max(0, iw - 2 * e), sy = Math.max(0, ih - 2 * e);
        const x = sx > 0 ? x0 + e + hash2(i * 3 + 1, 2, seedI + 51) * sx : cx;
        const y = sy > 0 ? y0 + e + hash2(i * 3 + 2, 9, seedI + 52) * sy : cy;
        const c = clampP(x, y, e, x0, y0, x1, y1);
        out.push({ x: c[0], y: c[1], t, rot: qrot(i, t), s });
      }
    }
    return out;
  },

  overlay(p, ctx, ins, node) {
    try {
      const m = Math.max(2, Math.min(p.margin, Math.min(ctx.W, ctx.H) * 0.45));
      const g = [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
      const places = this._place(p, ctx, node);
      for (let i = 0; i < Math.min(places.length, 80); i++) {
        g.push({ kind: "point", x: places[i].x, y: places[i].y });
      }
      return g;
    } catch (e) {
      return [];
    }
  },

  compute(ins, p, ctx, node) {
    const seedI = Math.round(p.seed);
    const hatch = Math.max(0.3, p.hatch);
    const pens = [p.penC, p.penM, p.penY, p.penK].map((v) => Math.max(0, Math.min(11, Math.round(v))));
    const platesMap = { CMYK: [0, 1, 2, 3], CMY: [0, 1, 2], CM: [0, 1], "K only": [3] };
    const plates = platesMap[p.plates] || [0, 1, 2, 3];
    const places = this._place(p, ctx, node);
    const marks = places.map((pl) => ({ pl, els: this._mark(pl.t, pl.s, hatch) }));
    if (p.frame) {
      const m = Math.max(2, Math.min(p.margin, Math.min(ctx.W, ctx.H) * 0.45));
      marks.push({
        pl: { x: 0, y: 0, rot: 0 },
        els: [{ pts: [[m, m], [ctx.W - m, m], [ctx.W - m, ctx.H - m], [m, ctx.H - m]], closed: true, ch: -1 }],
      });
    }
    const pr = mulberry32(seedI * 7919 + 401);
    const plateOff = [];
    for (let c = 0; c < 4; c++) {
      const a = pr() * Math.PI * 2;
      const mg = p.misreg * (0.35 + 0.65 * pr());
      plateOff.push([Math.cos(a) * mg, Math.sin(a) * mg]);
    }
    const paths = [];
    let total = 0, full = false;
    for (const c of plates) {
      if (full) break;
      for (let i = 0; i < marks.length; i++) {
        if (full) break;
        const mk = marks[i];
        const wx = (hash2(i * 5 + c + 1, 17, seedI + 91) - 0.5) * 2 * p.wobble;
        const wy = (hash2(i * 5 + c + 1, 53, seedI + 92) - 0.5) * 2 * p.wobble;
        const ox = mk.pl.x + plateOff[c][0] + wx;
        const oy = mk.pl.y + plateOff[c][1] + wy;
        const co = Math.cos(mk.pl.rot), si = Math.sin(mk.pl.rot);
        for (const el of mk.els) {
          if (el.ch !== -1 && el.ch !== c) continue;
          if (total + el.pts.length > 110000) { full = true; break; }
          const pts = el.pts.map(([x, y]) => [ox + x * co - y * si, oy + x * si + y * co]);
          total += pts.length;
          paths.push({ pts, closed: !!el.closed, layer: pens[c] });
        }
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
