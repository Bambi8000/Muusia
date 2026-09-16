import { Pin, mulberry32, hash2, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "fish",
  name: "Fish",
  cat: "gen",
  group: "creatures",
  desc: "Line-drawn fish in two hands. Simple is a child's fish: a lens body, a triangle tail, one big eye, a smile, a few fins and stripes, every stroke shaken by Wobble so it reads as crayon rather than geometry. Detailed is a naturalist's ink drawing: a species body profile (perch, pike, roach, bream, burbot, trout or Generic), rayed fins, gill cover, lateral line, eye with pupil, species markings and crescent scales whose density follows Detail %. Mixed rolls the style and the species per fish. Layout Rows fills a Count x Rows grid, School scatters a shoal swimming toward Heading with Turn jitter, Spine strings fish along a wired path facing its travel direction, offset to a side or sitting on the line. Bodies output carries the closed body-and-tail silhouettes for fill and hatch nodes.",
  ins: [Pin("style", "Style"), Pin("paths", "Spine")],
  outs: [Pin("paths", "Lines"), Pin("paths", "Bodies")],
  params: [
    { key: "style", label: "Style", type: "select", options: ["Simple", "Detailed", "Mixed"], def: "Detailed" },
    { key: "species", label: "Species", type: "select", options: ["Mixed", "Generic", "Perch", "Pike", "Roach", "Bream", "Burbot", "Trout"], def: "Mixed", showIf: (p) => p.style !== "Simple" },
    { key: "layout", label: "Layout", type: "select", options: ["Rows", "School", "Spine"], def: "Rows" },
    { key: "count", label: "Count", type: "slider", min: 1, max: 60, step: 1, def: 4, showIf: (p) => p.layout !== "Spine" },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 12, step: 1, def: 3, showIf: (p) => p.layout === "Rows" },
    { key: "space", label: "Spacing mm", type: "slider", min: 5, max: 200, step: 1, def: 45, showIf: (p) => p.layout === "Spine" },
    { key: "mount", label: "Spine mount", type: "select", options: ["On path", "Left", "Right", "Both (alternate)", "Both (random)"], def: "On path", showIf: (p) => p.layout === "Spine" },
    { key: "size", label: "Size mm", type: "slider", min: 8, max: 200, step: 1, def: 40 },
    { key: "vary", label: "Size vary", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "facing", label: "Facing", type: "select", options: ["Right", "Left", "Mixed"], def: "Right", showIf: (p) => p.layout !== "Spine" },
    { key: "heading", label: "Heading °", type: "slider", min: -180, max: 180, step: 1, def: 0, showIf: (p) => p.layout === "School" },
    { key: "turn", label: "Turn jitter °", type: "slider", min: 0, max: 90, step: 1, def: 15, showIf: (p) => p.layout === "School" },
    { key: "detail", label: "Detail %", type: "slider", min: 0, max: 100, step: 1, def: 60 },
    { key: "scales", label: "Scales", type: "check", def: true, showIf: (p) => p.style !== "Simple" },
    { key: "mouth", label: "Mouth", type: "select", options: ["Mixed", "Closed", "Open"], def: "Mixed" },
    { key: "bubbles", label: "Bubbles", type: "check", def: true },
    { key: "wobble", label: "Wobble %", type: "slider", min: 0, max: 100, step: 1, def: 60 },
    { key: "jitter", label: "Jitter %", type: "slider", min: 0, max: 100, step: 1, def: 25, showIf: (p) => p.layout === "Rows" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const seed = Math.round(Number(p.seed) || 0);
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const detail = clamp(Number(p.detail) || 0, 0, 100) / 100;
    const wobble = clamp(Number(p.wobble) || 0, 0, 100) / 100;
    const vary = clamp(Number(p.vary) || 0, 0, 1);
    const margin = Math.max(0, Number(p.margin) || 0);
    const BUDGET = 112000;

    /* ---------------------------------------------------------------- species */
    /* t runs 0 (tail base) .. 1 (nose). Fin spans are [t0, t1, height x body, type].
       Profile: half-height(t) = ped + (1-ped) * sin(PI * u * t^q)^k, u < 1 keeps a snout. */
    const SP = {
      Generic: { asp: 0.32, top: [1.0, 1.0, 0.90], bot: [1.0, 1.0, 0.90], ped: 0.22, snout: 0.5, tailLen: 0.20, tailH: 0.56, fork: 0.35,
        dorsal: [[0.34, 0.64, 0.42, "soft"]], anal: [0.16, 0.34, 0.26], pect: [0.68, 0.16], pelv: [0.52, 0.11], eye: [0.90, -0.14, 0.075], gill: 0.78, mouth: 0.12, mark: "none" },
      Perch: { asp: 0.36, top: [0.9, 1.15, 0.90], bot: [1.1, 0.9, 0.88], ped: 0.24, snout: 0.45, tailLen: 0.18, tailH: 0.52, fork: 0.28,
        dorsal: [[0.54, 0.80, 0.55, "spiny"], [0.30, 0.50, 0.36, "soft"]], anal: [0.18, 0.32, 0.24], pect: [0.70, 0.16], pelv: [0.62, 0.13], eye: [0.90, -0.16, 0.08], gill: 0.80, mouth: 0.14, mark: "bars" },
      Pike: { asp: 0.19, top: [0.6, 1.0, 0.985], bot: [0.7, 0.9, 0.985], ped: 0.30, snout: 0.15, tailLen: 0.17, tailH: 0.50, fork: 0.30,
        dorsal: [[0.16, 0.34, 0.42, "soft"]], anal: [0.14, 0.30, 0.34], pect: [0.66, 0.13], pelv: [0.44, 0.11], eye: [0.84, -0.20, 0.07], gill: 0.72, mouth: 0.30, mark: "spots" },
      Roach: { asp: 0.30, top: [1.0, 1.0, 0.90], bot: [1.0, 1.0, 0.90], ped: 0.24, snout: 0.45, tailLen: 0.20, tailH: 0.58, fork: 0.40,
        dorsal: [[0.44, 0.62, 0.44, "soft"]], anal: [0.18, 0.34, 0.26], pect: [0.68, 0.15], pelv: [0.50, 0.11], eye: [0.90, -0.12, 0.095], gill: 0.78, mouth: 0.10, mark: "none" },
      Bream: { asp: 0.46, top: [0.85, 1.05, 0.86], bot: [1.0, 1.0, 0.86], ped: 0.16, snout: 0.6, tailLen: 0.19, tailH: 0.60, fork: 0.42,
        dorsal: [[0.40, 0.58, 0.62, "soft"]], anal: [0.14, 0.46, 0.30], pect: [0.68, 0.16], pelv: [0.54, 0.12], eye: [0.90, -0.12, 0.08], gill: 0.78, mouth: 0.09, mark: "none" },
      Burbot: { asp: 0.20, top: [0.55, 0.85, 0.95], bot: [0.7, 1.0, 0.95], ped: 0.32, snout: 0.55, tailLen: 0.13, tailH: 0.36, fork: 0.0,
        dorsal: [[0.10, 0.70, 0.28, "long"], [0.74, 0.84, 0.30, "soft"]], anal: [0.10, 0.60, 0.24], pect: [0.70, 0.15], pelv: [0.64, 0.10], eye: [0.90, -0.18, 0.06], gill: 0.76, mouth: 0.16, mark: "mottle" },
      Trout: { asp: 0.26, top: [0.9, 1.0, 0.92], bot: [1.0, 1.0, 0.92], ped: 0.26, snout: 0.4, tailLen: 0.18, tailH: 0.54, fork: 0.22,
        dorsal: [[0.46, 0.64, 0.40, "soft"], [0.24, 0.30, 0.18, "soft"]], anal: [0.20, 0.32, 0.26], pect: [0.68, 0.15], pelv: [0.48, 0.11], eye: [0.90, -0.14, 0.075], gill: 0.78, mouth: 0.16, mark: "dots" },
    };
    const SPECIES_KEYS = ["Generic", "Perch", "Pike", "Roach", "Bream", "Burbot", "Trout"];

    /* ------------------------------------------------------------- utilities */
    const pt2 = (x, y) => [x, y];
    const arc = (cx, cy, rx, ry, a0, a1, n) => {
      const out = [];
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
      return out;
    };
    const circle = (cx, cy, r, n) => { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; };

    /* hand tremor: densify, then push every point by two independent noise fields */
    const wob = (pts, closed, amp, k, step) => {
      if (amp <= 0.001 || pts.length < 2) return pts;
      const dense = resample(pts, closed, step);
      if (closed && dense.length > 2) {
        const a = dense[0], b = dense[dense.length - 1];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < step * 0.25) dense.pop();
      }
      if (!closed) {
        const e = pts[pts.length - 1], d = dense[dense.length - 1];
        if (Math.hypot(e[0] - d[0], e[1] - d[1]) > step * 0.2) dense.push([e[0], e[1]]);
      }
      if (dense.length < 2) return pts.map((q) => [q[0], q[1]]);
      const f = 0.35 / Math.max(0.5, amp * 12);
      return dense.map(([x, y]) => {
        const n1 = noise2(x * f + k * 3.1, y * f, seed + k) - 0.5;
        const n2 = noise2(x * f + 57.3, y * f + 19.7 + k * 2.3, seed + k + 101) - 0.5;
        const h = (hash2(Math.round(x * 4), Math.round(y * 4), seed + k) - 0.5) * 0.12;
        return [x + (n1 + h) * 2 * amp, y + (n2 + h) * 2 * amp];
      });
    };

    /* ---------------------------------------------------------- one fish */
    /* Returns { ess: paths[], ext: paths[], body: pts } in LOCAL mm: nose toward +x,
       origin at body centre, length L. ess = always drawn, ext = decoration drawn while budget lasts. */
    const drawFish = (L, styleSimple, spKey, rng, fi, mouthOpen) => {
      const ess = [], ext = [];
      let body = null;
      const L2 = L / 2;
      const wobAmp = L * 0.02 * wobble * (styleSimple ? 1.6 : 0.25);
      const wstep = Math.max(0.6, L * 0.03);
      const push = (arr, pts, closed, wk) => { if (pts.length >= 2) arr.push({ pts: wob(pts, closed, wobAmp, fi * 17 + wk, wstep), closed, layer: pen }); };

      if (styleSimple) {
        /* ------------------------------ child's fish */
        const fat = 0.22 + rng() * 0.16;
        const hH = L * fat;
        const tailLen = L * (0.16 + rng() * 0.14);
        const tailH = hH * (0.6 + rng() * 0.6);
        const xJ = -L2 + tailLen;                /* body/tail junction */
        const bodyL = L2 - xJ;
        const skew = 0.85 + rng() * 0.3;         /* lens asymmetry */
        const n = 26;
        const outline = [];
        for (let i = 0; i <= n; i++) { const t = i / n; const s = Math.pow(t, skew); outline.push([xJ + bodyL * t, -hH * Math.sin(Math.PI * s)]); }
        for (let i = n - 1; i >= 1; i--) { const t = i / n; const s = Math.pow(t, skew); outline.push([xJ + bodyL * t, hH * Math.sin(Math.PI * s) * (0.85 + 0.15 * rng())]); }
        outline.push([xJ, 0]);
        outline.push([xJ - tailLen, tailH]);
        if (rng() < 0.6) outline.push([xJ - tailLen * (0.55 + rng() * 0.25), 0]);
        outline.push([xJ - tailLen, -tailH]);
        push(ess, outline, true, 1);
        body = ess[ess.length - 1].pts;

        /* eye: big, sometimes in the wrong place */
        const er = hH * (0.22 + rng() * 0.16);
        const ex = L2 - bodyL * (0.16 + rng() * 0.12), ey = -hH * (0.05 + rng() * 0.3);
        push(ess, circle(ex, ey, er, 18), true, 2);
        if (rng() < 0.75) push(ess, circle(ex + er * 0.15, ey - er * 0.1, er * (0.3 + rng() * 0.2), 10), true, 3);

        /* mouth: smile / o / line */
        const mk = rng();
        const mx = L2 - bodyL * 0.05, my = hH * 0.25;
        if (mouthOpen || mk < 0.25) push(ess, circle(mx - hH * 0.12, my, hH * 0.1, 10), true, 4);
        else if (mk < 0.7) push(ess, arc(mx - hH * 0.2, my - hH * 0.08, hH * 0.2, hH * 0.14, Math.PI * 0.15, Math.PI * 0.85, 8), false, 4);
        else push(ess, [[mx - hH * 0.35, my], [mx, my - hH * 0.05]], false, 4);

        /* fins: 0-2 triangles on top, 0-1 below */
        const nTop = Math.floor(rng() * 3), nBot = rng() < 0.55 ? 1 : 0;
        const finAt = (tt, sgn, k) => {
          const s = Math.pow(tt, skew);
          const bx = xJ + bodyL * tt, by = sgn * hH * Math.sin(Math.PI * s);
          const fw = bodyL * (0.08 + rng() * 0.1), fh = hH * (0.25 + rng() * 0.35);
          push(ext, [[bx - fw, by], [bx - fw * (0.2 + rng() * 0.6), by + sgn * fh], [bx + fw, by]], true, 10 + k);
        };
        for (let k = 0; k < nTop; k++) finAt(0.3 + k * 0.25 + rng() * 0.1, -1, k);
        if (nBot) finAt(0.35 + rng() * 0.2, 1, 5);

        /* scales as a few U's, stripes as vertical lines */
        const nSc = Math.round(rng() * 7 * (0.3 + detail));
        for (let k = 0; k < nSc; k++) {
          const tt = 0.15 + rng() * 0.55, s = Math.pow(tt, skew);
          const hh = hH * Math.sin(Math.PI * s) * 0.75;
          const cx = xJ + bodyL * tt, cy = (rng() * 2 - 1) * hh, r = hH * (0.1 + rng() * 0.08);
          push(ext, arc(cx, cy, r, r, Math.PI * 0.15, Math.PI * 0.85, 7), false, 20 + k);
        }
        const nSt = rng() < 0.5 ? Math.round(1 + rng() * 3) : 0;
        for (let k = 0; k < nSt; k++) {
          const tt = 0.2 + rng() * 0.5, s = Math.pow(tt, skew);
          const hh = hH * Math.sin(Math.PI * s) * 0.8;
          const cx = xJ + bodyL * tt;
          push(ext, [[cx, -hh], [cx + hH * 0.06, 0], [cx, hh]], false, 30 + k);
        }
        /* bubbles in front */
        if (p.bubbles) {
          const nb = 1 + Math.floor(rng() * 3);
          for (let k = 0; k < nb; k++) {
            const r = hH * (0.08 + rng() * 0.1);
            push(ext, circle(L2 + L * (0.06 + k * 0.06) + r, -hH * (0.1 + k * 0.28 + rng() * 0.15), r, 12), true, 40 + k);
          }
        }
        return { ess, ext, body };
      }

      /* ---------------------------------- naturalist's fish */
      const S = SP[spKey] || SP.Generic;
      const hH = L * S.asp * 0.5;
      const tailLen = L * S.tailLen;
      const xB0 = -L2 + tailLen;                /* tail base */
      const bodyL = L2 - xB0;
      const half = (t, side) => { const [k, q, u] = side; return hH * (S.ped + (1 - S.ped) * Math.pow(Math.max(0, Math.sin(Math.PI * u * Math.pow(t, q))), k)); };
      const X = (t) => xB0 + bodyL * t;
      const topAt = (t) => -half(t, S.top);
      const botAt = (t) => half(t, S.bot);
      const tangentTop = (t) => { const d = 0.004; const dx = bodyL * d * 2, dy = topAt(Math.min(1, t + d)) - topAt(Math.max(0, t - d)); const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
      const tangentBot = (t) => { const d = 0.004; const dx = bodyL * d * 2, dy = botAt(Math.min(1, t + d)) - botAt(Math.max(0, t - d)); const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

      /* silhouette: dorsal edge -> snout arc -> ventral edge -> caudal fin */
      const nB = 36 + Math.round(detail * 26);
      const outline = [];
      for (let i = 0; i <= nB; i++) { const t = i / nB; outline.push([X(t), topAt(t)]); }
      const t1 = topAt(1), b1 = botAt(1), cy = (t1 + b1) / 2, ry = (b1 - t1) / 2, rx = ry * S.snout * 2;
      const nose = arc(L2, cy, rx, ry, -Math.PI / 2, Math.PI / 2, 10);
      for (let i = 1; i < nose.length - 1; i++) outline.push(nose[i]);
      for (let i = nB; i >= 0; i--) { const t = i / nB; outline.push([X(t), botAt(t)]); }
      const tailH = hH * S.tailH * 2, xT = -L2;
      const pedT = topAt(0), pedB = botAt(0);
      const lobe = (yTip, yPed) => [[xB0 - tailLen * 0.35, yPed + (yTip - yPed) * 0.25], [xB0 - tailLen * 0.7, yPed + (yTip - yPed) * 0.7], [xT, yTip]];
      lobe(tailH, pedB).forEach((q) => outline.push(q));
      if (S.fork > 0.01) {
        outline.push([xT + tailLen * S.fork * 0.6, tailH * 0.45]);
        outline.push([xT + tailLen * S.fork, 0]);
        outline.push([xT + tailLen * S.fork * 0.6, -tailH * 0.45]);
      } else {
        outline.push([xT - tailLen * 0.12, tailH * 0.5]);
        outline.push([xT - tailLen * 0.18, 0]);
        outline.push([xT - tailLen * 0.12, -tailH * 0.5]);
      }
      lobe(-tailH, pedT).reverse().forEach((q) => outline.push(q));
      push(ess, outline, true, 1);
      body = ess[ess.length - 1].pts;

      /* caudal rays */
      const nRay = 3 + Math.round(detail * 7);
      for (let i = 0; i <= nRay; i++) {
        const s = i / nRay, yE = -tailH + tailH * 2 * s;
        const xEdge = S.fork > 0.01 ? xT + tailLen * S.fork * (1 - Math.pow(Math.abs(s - 0.5) * 2, 1.5)) : xT - tailLen * 0.18 * (1 - Math.pow(Math.abs(s - 0.5) * 2, 2));
        const yP = pedT + (pedB - pedT) * s;
        push(ext, [[xB0 - tailLen * 0.15, yP], [xEdge, yE]], false, 50 + i);
      }

      /* dorsal + anal fins */
      const fin = (t0, t1f, hgt, type, onTop, wk) => {
        const at = onTop ? topAt : botAt, tg = onTop ? tangentTop : tangentBot;
        const sgn = onTop ? -1 : 1;
        const nS = Math.max(4, Math.round(6 + detail * 10 * (t1f - t0) * 4));
        const base = [], outer = [];
        for (let i = 0; i <= nS; i++) {
          const s = i / nS, t = t0 + (t1f - t0) * s;            /* s: tail -> head */
          const bx = X(t), by = at(t);
          const [tx, ty] = tg(t);
          let h;
          if (type === "spiny") h = 0.3 + 0.7 * Math.pow(s, 1.4);
          else if (type === "long") h = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, s * 1.4));
          else h = Math.pow(Math.sin(Math.PI * Math.min(0.999, 0.1 + s * 0.85)), 0.7);
          if (s > 0.92) h *= (1 - s) / 0.08;                     /* leading edge drops to the body */
          if (type === "spiny" && i % 2 === 1 && s < 0.9) h *= 0.72;   /* membrane sag between spines */
          const H1 = hgt * hH * 2 * h, rake = type === "spiny" ? 0.25 : 0.55;
          const nx = sgn * -ty, ny = sgn * tx;                    /* outward normal */
          base.push([bx, by]);
          outer.push([bx + nx * H1 - tx * H1 * rake, by + ny * H1 - ty * H1 * rake]);
        }
        const shape = outer.slice().concat(base.slice().reverse());
        push(ess, shape, true, wk);
        const rayEvery = detail > 0.35 ? (type === "spiny" ? 1 : 2) : 3;
        for (let i = 1; i < nS; i += rayEvery) push(ext, [base[i], [base[i][0] + (outer[i][0] - base[i][0]) * 0.92, base[i][1] + (outer[i][1] - base[i][1]) * 0.92]], false, wk + 30 + i);
      };
      S.dorsal.forEach((d, k) => fin(d[0], d[1], d[2], d[3], true, 60 + k * 60));
      fin(S.anal[0], S.anal[1], S.anal[2], "soft", false, 180);

      /* pectoral + pelvic leaves */
      const leaf = (ax, ay, len, wid, ang, wk) => {
        const c = Math.cos(ang), s = Math.sin(ang), pts = [];
        const n = 10;
        for (let i = 0; i <= n; i++) { const u = i / n, w = wid * Math.sin(Math.PI * u); pts.push([ax + c * len * u - s * w, ay + s * len * u + c * w]); }
        for (let i = n - 1; i >= 1; i--) { const u = i / n, w = -wid * Math.sin(Math.PI * u) * 0.5; pts.push([ax + c * len * u - s * w, ay + s * len * u + c * w]); }
        push(ess, pts, true, wk);
        if (detail > 0.5) { push(ext, [[ax, ay], [ax + c * len * 0.9, ay + s * len * 0.9]], false, wk + 1); push(ext, [[ax, ay], [ax + c * len * 0.7 - s * wid * 0.6, ay + s * len * 0.7 + c * wid * 0.6]], false, wk + 2); }
      };
      const pT = S.pect[0];
      leaf(X(pT), botAt(pT) * 0.25, L * S.pect[1], L * S.pect[1] * 0.32, Math.PI * (1 + 0.14), 200);
      const vT = S.pelv[0];
      leaf(X(vT), botAt(vT) * 0.92, L * S.pelv[1], L * S.pelv[1] * 0.3, Math.PI * (1 + 0.28), 210);

      /* gill cover + eye + mouth */
      const g = S.gill;
      const gill = [];
      for (let i = 0; i <= 12; i++) { const s = i / 12; const y = topAt(g) * 0.88 + (botAt(g) * 0.9 - topAt(g) * 0.88) * s; gill.push([X(g) - Math.sin(Math.PI * s) * bodyL * 0.055 + (s - 0.5) * bodyL * 0.02, y]); }
      push(ess, gill, false, 220);
      if (detail > 0.45) { push(ext, gill.slice(2, 11).map(([x, y]) => [x + bodyL * 0.035, y * 0.95]), false, 221); }
      const er = hH * 2 * S.eye[2];
      const ex = X(S.eye[0]), ey = hH * 2 * S.eye[1] * 0.5;
      push(ess, circle(ex, ey, er, 16), true, 230);
      push(ess, circle(ex + er * 0.12, ey, er * 0.42, 10), true, 231);
      const mL = L * S.mouth, mTip = [L2 + rx * 0.98, cy + ry * 0.15];
      if (mouthOpen) {
        const hinge = [mTip[0] - mL, cy + ry * 0.55];
        push(ess, [mTip, hinge], false, 240);
        const a = Math.atan2(mTip[1] - hinge[1], mTip[0] - hinge[0]) + 0.55, jl = mL * 0.95;
        push(ess, [hinge, [hinge[0] + Math.cos(a) * jl, hinge[1] + Math.sin(a) * jl]], false, 241);
      } else {
        push(ess, [mTip, [mTip[0] - mL * 0.55, cy + ry * 0.5], [mTip[0] - mL, cy + ry * 0.62]], false, 240);
      }
      if (spKey === "Burbot") push(ext, [[mTip[0] - mL * 0.6, botAt(0.97)], [mTip[0] - mL * 0.55, botAt(0.97) + hH * 0.5]], false, 242);

      /* lateral line */
      const lat = [];
      for (let i = 0; i <= 16; i++) { const t = 0.03 + (g - 0.08 - 0.03) * (i / 16); lat.push([X(t), topAt(t) * 0.28 + Math.sin(t * Math.PI) * hH * 0.05]); }
      push(ext, lat, false, 250);

      /* species markings */
      const mk = S.mark;
      if (mk === "bars") {
        const nb = 5 + Math.round(detail * 3);
        for (let k = 0; k < nb; k++) {
          const t = 0.12 + (g - 0.16 - 0.12) * ((k + 0.5) / nb);
          const bar = [];
          for (let i = 0; i <= 6; i++) { const s = i / 6; const tt = t + (s - 0.5) * 0.04; bar.push([X(tt), topAt(t) * 0.85 + (botAt(t) * 0.55 - topAt(t) * 0.85) * s]); }
          push(ext, bar, false, 260 + k * 3);
          push(ext, bar.map(([x, y]) => [x + bodyL * 0.02, y * 0.97]), false, 261 + k * 3);
          if (detail > 0.55) for (let i = 1; i < 6; i += 2) push(ext, [bar[i], [bar[i][0] + bodyL * 0.02, bar[i][1] * 0.97]], false, 262 + k * 3);
        }
      } else if (mk === "spots") {
        const rowsN = 2, perRow = 5 + Math.round(detail * 4);
        for (let r = 0; r < rowsN; r++) for (let k = 0; k < perRow; k++) {
          const t = 0.1 + (g - 0.14 - 0.1) * ((k + 0.5 + r * 0.5) / perRow);
          const yy = topAt(t) * (r === 0 ? 0.55 : -0.05) + botAt(t) * (r === 0 ? 0 : 0.5);
          push(ext, arc(X(t), yy, bodyL * 0.02, hH * 0.14, 0, Math.PI * 2, 8).slice(0, 8), true, 300 + r * 20 + k);
        }
      } else if (mk === "dots") {
        const nd = 10 + Math.round(detail * 24);
        for (let k = 0; k < nd; k++) {
          const t = 0.08 + rng() * (g - 0.12 - 0.08);
          const yy = topAt(t) * (0.15 + rng() * 0.75);
          const r = hH * (0.03 + rng() * 0.05);
          push(ext, circle(X(t), yy, r, 6), true, 340 + k);
        }
      } else if (mk === "mottle") {
        const nm = 8 + Math.round(detail * 16);
        for (let k = 0; k < nm; k++) {
          const t = 0.08 + rng() * (g - 0.12 - 0.08);
          const yy = topAt(t) * (0.9 - rng() * 1.5);
          const len = bodyL * (0.03 + rng() * 0.05), a = rng() * Math.PI;
          push(ext, [[X(t) - Math.cos(a) * len, yy - Math.sin(a) * len * 0.4], [X(t), yy + hH * 0.06 * (rng() - 0.5)], [X(t) + Math.cos(a) * len, yy + Math.sin(a) * len * 0.4]], false, 380 + k);
        }
      }

      /* scales: crescents on a staggered grid, tail base to gill */
      if (p.scales && detail > 0.05 && L > 1) {
        const r = Math.max(0.05, L * (0.014 + 0.03 * (1 - detail)));
        const dx = r * 1.7, dy = r * 1.45;
        const x0 = X(0.06), x1 = X(g - 0.06);
        let row = 0, count = 0;
        for (let yy = -hH * 0.92; yy <= hH * 0.92; yy += dy, row++) {
          for (let xx = x0 + (row % 2) * dx * 0.5; xx <= x1; xx += dx) {
            const t = (xx - xB0) / bodyL;
            if (yy - r * 0.6 < topAt(t) * 0.86 || yy + r * 0.6 > botAt(t) * 0.86) continue;
            /* skip the lateral-line groove */
            if (Math.abs(yy - topAt(t) * 0.28) < r * 0.7) continue;
            push(ext, arc(xx, yy, r, r, Math.PI * 0.38, Math.PI * 1.62, 5), false, 500 + (count % 37));
            count++;
            if (count > 900) break;
          }
        }
      }
      if (p.bubbles && mouthOpen) {
        for (let k = 0; k < 2; k++) { const r = hH * (0.12 + k * 0.08); push(ext, circle(L2 + rx + L * (0.05 + k * 0.07) + r, cy - hH * (0.5 + k * 0.7), r, 12), true, 600 + k); }
      }
      return { ess, ext, body };
    };

    /* ---------------------------------------------------------- placement */
    const styleMode = p.style, spMode = p.species, layout = p.layout;
    const baseSize = Math.max(2, Number(p.size) || 40);
    const rngG = mulberry32(seed * 7919 + 11);
    const placements = [];   /* { cx, cy, ang, L, mirror } */
    const extraFront = p.bubbles ? 0.2 : 0.02;   /* bubbles stick out past the nose */
    const totalW = (L) => L * (1 + extraFront);

    if (layout === "Rows") {
      const cols = Math.max(1, Math.round(Number(p.count) || 1)), rows = Math.max(1, Math.round(Number(p.rows) || 1));
      const cw = (W - 2 * margin) / cols, ch = (H - 2 * margin) / rows;
      const Lfit = Math.min(baseSize, cw * 0.92 / (1 + extraFront), ch * 0.9 / 0.62);   /* shrink only */
      const jit = clamp(Number(p.jitter) || 0, 0, 100) / 100;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const L = Math.max(0.5, Lfit * (1 - vary * 0.55 * rngG()));
        const cx0 = margin + cw * (c + 0.5) - L * extraFront * 0.5, cy0 = margin + ch * (r + 0.5);
        const fx = (cw - totalW(L)) / 2 * jit * (rngG() * 2 - 1), fy = (ch - L * 0.62) / 2 * jit * (rngG() * 2 - 1);
        const mirror = p.facing === "Left" ? true : p.facing === "Mixed" ? rngG() < 0.5 : false;
        placements.push({ cx: cx0 + fx, cy: cy0 + fy, ang: 0, L, mirror, box: [margin + cw * c + cw * 0.03, margin + ch * r + ch * 0.03, margin + cw * (c + 1) - cw * 0.03, margin + ch * (r + 1) - ch * 0.03] });
      }
    } else if (layout === "School") {
      const N = Math.max(1, Math.round(Number(p.count) || 1));
      const head = ((Number(p.heading) || 0) * Math.PI) / 180, turn = ((Number(p.turn) || 0) * Math.PI) / 180;
      const avail = Math.min(W, H) - 2 * margin;
      const Lmax = Math.min(baseSize, Math.max(2, avail * 0.7));
      for (let i = 0; i < N; i++) {
        const L = Lmax * (1 - vary * 0.6 * rngG());
        const R = L * 0.62;
        let best = null, bestD = -Infinity;
        for (let a = 0; a < 30; a++) {
          const cx = margin + R + rngG() * Math.max(0, W - 2 * margin - 2 * R);
          const cy = margin + R + rngG() * Math.max(0, H - 2 * margin - 2 * R);
          let d = 1e9;
          for (const q of placements) d = Math.min(d, Math.hypot(q.cx - cx, q.cy - cy) - (q.L + L) * 0.42);
          if (d > bestD) { bestD = d; best = [cx, cy]; }
          if (d > 0) break;
        }
        const mirror = p.facing === "Left" ? true : p.facing === "Mixed" ? rngG() < 0.5 : false;
        placements.push({ cx: best[0], cy: best[1], ang: head + (rngG() * 2 - 1) * turn, L, mirror, box: [margin, margin, W - margin, H - margin] });
      }
    } else {
      /* Spine */
      const src = ins[1] && ins[1].paths && ins[1].paths.length ? ins[1] : null;
      const spines = src ? src.paths.filter((q) => q.pts && q.pts.length >= 2) : [{ pts: [[margin + baseSize * 0.6, H / 2], [W - margin - baseSize * 0.6, H / 2]], closed: false }];
      const space = Math.max(3, Number(p.space) || 45);
      let alt = false;
      spines.forEach((sp, si) => {
        const pts = resample(sp.pts, sp.closed, space);
        const rngS = mulberry32(seed * 883 + si * 127 + 5);
        pts.forEach((pt, i) => {
          if (placements.length > 4000) return;
          const nI = Math.min(i + 1, pts.length - 1), pI = Math.max(i - 1, 0);
          let tx0 = pts[nI][0] - pts[pI][0], ty0 = pts[nI][1] - pts[pI][1];
          if (Math.hypot(tx0, ty0) < 1e-9) { const a0 = sp.pts[0], a1 = sp.pts[sp.pts.length - 1]; tx0 = a1[0] - a0[0]; ty0 = a1[1] - a0[1]; }
          const tl = Math.hypot(tx0, ty0) || 1, tx = tx0 / tl, ty = ty0 / tl;
          const L = baseSize * (1 - vary * 0.55 * rngS());
          let s = 0;
          if (p.mount === "Left") s = 1;
          else if (p.mount === "Right") s = -1;
          else if (p.mount === "Both (alternate)") { s = alt ? 1 : -1; alt = !alt; }
          else if (p.mount === "Both (random)") s = rngS() > 0.5 ? 1 : -1;
          /* Fur convention: Left normal is (-ty, tx) relative to travel */
          const off = s === 0 ? 0 : L * 0.36;
          placements.push({ cx: pt[0] + (-ty) * s * off, cy: pt[1] + tx * s * off, ang: Math.atan2(ty, tx), L, mirror: false, box: null });
        });
      });
    }

    /* ------------------------------------------------------------ assemble */
    /* Each fish is transformed, then fitted into its box: shrink only (never grow),
       then slid so the whole drawing stays inside the box. Spine fish have no box. */
    const lines = [], bodies = [];
    const extras = [];
    let total = 0;
    for (let i = 0; i < placements.length; i++) {
      if (total > BUDGET) break;
      const pl = placements[i];
      const rng = mulberry32(seed * 104729 + i * 131 + 17);
      const simple = styleMode === "Simple" ? true : styleMode === "Detailed" ? false : rng() < 0.5;
      const spKey = spMode === "Mixed" ? SPECIES_KEYS[Math.floor(rng() * SPECIES_KEYS.length)] : spMode;
      const mouthOpen = p.mouth === "Open" ? true : p.mouth === "Closed" ? false : rng() < 0.3;
      const F = drawFish(pl.L, simple, spKey, rng, i, mouthOpen);
      const c = Math.cos(pl.ang), sn = Math.sin(pl.ang), mx = pl.mirror ? -1 : 1;
      const T0 = ([x, y]) => { const xx = x * mx; return [pl.cx + xx * c - y * sn, pl.cy + xx * sn + y * c]; };
      const tE = F.ess.map((q) => ({ pts: q.pts.map(T0), closed: q.closed, layer: q.layer }));
      const tX = F.ext.map((q) => ({ pts: q.pts.map(T0), closed: q.closed, layer: q.layer }));
      const tB = F.body ? F.body.map(T0) : null;
      if (pl.box) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        const grow = (pts) => { for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } };
        tE.forEach((q) => grow(q.pts)); tX.forEach((q) => grow(q.pts));
        const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
        const [bx0, by0, bx1, by1] = pl.box;
        const k = Math.min(1, (bx1 - bx0) / bw, (by1 - by0) / bh);
        const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2;
        let ncx = cxm, ncy = cym;
        const hw = bw * k / 2, hh = bh * k / 2;
        ncx = Math.min(bx1 - hw, Math.max(bx0 + hw, cxm));
        ncy = Math.min(by1 - hh, Math.max(by0 + hh, cym));
        const fix = ([x, y]) => [ncx + (x - cxm) * k, ncy + (y - cym) * k];
        if (k < 0.9999 || Math.abs(ncx - cxm) > 1e-9 || Math.abs(ncy - cym) > 1e-9) {
          tE.forEach((q) => { q.pts = q.pts.map(fix); });
          tX.forEach((q) => { q.pts = q.pts.map(fix); });
          if (tB) for (let j = 0; j < tB.length; j++) tB[j] = fix(tB[j]);
        }
      }
      for (const q of tE) { if (pl.mirror && q.closed) q.pts.reverse(); lines.push(q); total += q.pts.length; }
      if (tB) { if (pl.mirror) tB.reverse(); bodies.push({ pts: tB, closed: true, layer: pen }); }
      extras.push(tX.map((q) => { if (pl.mirror && q.closed) q.pts.reverse(); return q; }));
    }
    /* decoration last, so a budget cut removes scales before it removes fish */
    outer: for (const ext of extras) {
      for (const q of ext) { if (total > BUDGET) break outer; lines.push(q); total += q.pts.length; }
    }
    return [applyStyle({ paths: lines }, ins[0]), { paths: bodies }];
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      const g = [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
      if (p.layout === "Rows") {
        const cols = Math.max(1, Math.round(Number(p.count) || 1)), rows = Math.max(1, Math.round(Number(p.rows) || 1));
        const cw = (W - 2 * m) / cols, ch = (H - 2 * m) / rows;
        if (cols * rows <= 80) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.push({ kind: "rect", x: m + cw * c, y: m + ch * r, w: cw, h: ch });
      } else if (p.layout === "Spine") {
        const src = ins && ins[1] && ins[1].paths && ins[1].paths.length ? ins[1] : null;
        if (src) src.paths.slice(0, 40).forEach((q) => { if (q.pts && q.pts.length >= 2) g.push({ kind: "poly", pts: q.pts }); });
        else { const L = Math.max(2, Number(p.size) || 40); g.push({ kind: "arrow", x1: m + L * 0.6, y1: H / 2, x2: W - m - L * 0.6, y2: H / 2 }); }
      } else {
        const a = ((Number(p.heading) || 0) * Math.PI) / 180, r = Math.min(W, H) * 0.12;
        g.push({ kind: "arrow", x1: W / 2 - Math.cos(a) * r, y1: H / 2 - Math.sin(a) * r, x2: W / 2 + Math.cos(a) * r, y2: H / 2 + Math.sin(a) * r });
      }
      return g;
    } catch (e) { return []; }
  },
};
