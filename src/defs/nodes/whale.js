import { Pin, mulberry32, hash2, noise2, resample, applyStyle } from "../helpers.js";

export default {
  key: "whale",
  name: "Whale",
  cat: "gen",
  group: "creatures",
  desc: "Line-drawn whales in two hands, with an octopus hiding in the species list. Simple is a child's whale: a fat blob body, heart-shaped flukes, a fountain spout, one eye and a smile, every stroke shaken by Wobble so it reads as crayon. Detailed is a naturalist's ink drawing: a species body profile (blue whale, humpback, sperm whale, orca, narwhal or Generic), the flukes turned to show both lobes, a species dorsal fin, a swept flipper, eye, mouth line, spout and species markings such as throat pleats, humpback tubercles, sperm-whale wrinkles and knuckles, orca patches or a narwhal tusk with its spiral. Octopus swaps the whole plan for a mantle, slit-pupil eyes, siphon and eight tapered arms with suckers. Mixed rolls the style and the species per creature. Layout Rows fills a Count x Rows grid, School scatters a pod swimming toward Heading with Turn jitter, Spine strings creatures along a wired path facing its travel direction. Bodies output carries the closed silhouettes for fill and hatch nodes (mantle plus each arm for the octopus).",
  ins: [Pin("style", "Style"), Pin("paths", "Spine")],
  outs: [Pin("paths", "Lines"), Pin("paths", "Bodies")],
  params: [
    { key: "style", label: "Style", type: "select", options: ["Simple", "Detailed", "Mixed"], def: "Detailed" },
    { key: "species", label: "Species", type: "select", options: ["Mixed", "Generic", "Blue", "Humpback", "Sperm", "Orca", "Narwhal", "Octopus"], def: "Mixed" },
    { key: "layout", label: "Layout", type: "select", options: ["Rows", "School", "Spine"], def: "Rows" },
    { key: "count", label: "Count", type: "slider", min: 1, max: 60, step: 1, def: 3, showIf: (p) => p.layout !== "Spine" },
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 12, step: 1, def: 3, showIf: (p) => p.layout === "Rows" },
    { key: "space", label: "Spacing mm", type: "slider", min: 5, max: 200, step: 1, def: 60, showIf: (p) => p.layout === "Spine" },
    { key: "mount", label: "Spine mount", type: "select", options: ["On path", "Left", "Right", "Both (alternate)", "Both (random)"], def: "On path", showIf: (p) => p.layout === "Spine" },
    { key: "size", label: "Size mm", type: "slider", min: 8, max: 250, step: 1, def: 70 },
    { key: "vary", label: "Size vary", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
    { key: "facing", label: "Facing", type: "select", options: ["Right", "Left", "Mixed"], def: "Right", showIf: (p) => p.layout !== "Spine" },
    { key: "heading", label: "Heading °", type: "slider", min: -180, max: 180, step: 1, def: 0, showIf: (p) => p.layout === "School" },
    { key: "turn", label: "Turn jitter °", type: "slider", min: 0, max: 90, step: 1, def: 15, showIf: (p) => p.layout === "School" },
    { key: "detail", label: "Detail %", type: "slider", min: 0, max: 100, step: 1, def: 60 },
    { key: "texture", label: "Skin texture", type: "check", def: true, showIf: (p) => p.style !== "Simple" },
    { key: "mouth", label: "Mouth", type: "select", options: ["Mixed", "Closed", "Open"], def: "Closed" },
    { key: "spout", label: "Spout", type: "check", def: true },
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
    /* t runs 0 (tail stock) .. 1 (nose). Profile half-height(t) = ped + (1-ped) * sin(PI*u*t^q)^k.
       Whale anatomy in side view: flukes are horizontal, so they are drawn as the classic
       illustration convention — the tail stock turns and both lobes show, the near one larger. */
    const SP = {
      Generic: { asp: 0.24, top: [0.8, 1.0, 0.86], bot: [1.0, 0.9, 0.9], ped: 0.14, snout: 0.5, tail: 0.14, fluke: 0.52, dorsal: { t: 0.32, h: 0.22, type: "small" }, flip: { t: 0.72, len: 0.16, wid: 0.06, ang: 0.16 }, eye: [0.86, 0.15, 0.03], mouth: { len: 0.22, drop: 0.3 }, mark: "grooves" },
      Blue: { asp: 0.16, top: [0.45, 1.0, 0.9], bot: [0.9, 0.8, 0.92], ped: 0.14, snout: 0.22, tail: 0.13, fluke: 0.5, dorsal: { t: 0.2, h: 0.14, type: "small" }, flip: { t: 0.7, len: 0.14, wid: 0.04, ang: 0.14 }, eye: [0.8, 0.22, 0.02], mouth: { len: 0.32, drop: 0.28 }, mark: "mottle" },
      Humpback: { asp: 0.25, top: [0.7, 1.05, 0.88], bot: [1.1, 0.85, 0.9], ped: 0.14, snout: 0.35, tail: 0.15, fluke: 0.58, dorsal: { t: 0.36, h: 0.18, type: "hump" }, flip: { t: 0.7, len: 0.32, wid: 0.06, ang: 0.22 }, eye: [0.84, 0.18, 0.025], mouth: { len: 0.26, drop: 0.32 }, mark: "tubercles" },
      Sperm: { asp: 0.24, top: [0.35, 0.7, 0.78], bot: [1.0, 1.0, 0.97], ped: 0.16, snout: 0.12, tail: 0.13, fluke: 0.5, dorsal: { t: 0.3, h: 0.14, type: "knuckles" }, flip: { t: 0.66, len: 0.13, wid: 0.06, ang: 0.2 }, eye: [0.66, 0.05, 0.025], mouth: { len: 0.3, drop: 0.92 }, mark: "wrinkles" },
      Orca: { asp: 0.26, top: [0.9, 1.0, 0.86], bot: [1.0, 0.9, 0.9], ped: 0.16, snout: 0.62, tail: 0.14, fluke: 0.5, dorsal: { t: 0.5, h: 0.6, type: "tall" }, flip: { t: 0.7, len: 0.2, wid: 0.11, ang: 0.3 }, eye: [0.85, 0.12, 0.025], mouth: { len: 0.2, drop: 0.35 }, mark: "orca" },
      Narwhal: { asp: 0.24, top: [0.9, 1.0, 0.86], bot: [1.0, 0.95, 0.9], ped: 0.14, snout: 0.66, tail: 0.14, fluke: 0.54, dorsal: { t: 0.35, h: 0.05, type: "ridge" }, flip: { t: 0.72, len: 0.14, wid: 0.07, ang: 0.2 }, eye: [0.87, 0.05, 0.025], mouth: { len: 0.1, drop: 0.5 }, mark: "tusk" },
    };
    const SPECIES_KEYS = ["Generic", "Blue", "Humpback", "Sperm", "Orca", "Narwhal", "Octopus"];

    /* ------------------------------------------------------------- utilities */
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

    /* a tapered limb around a centreline: returns closed polygon */
    const limb = (cl, w0, taper) => {
      const l = [], r = [];
      for (let i = 0; i < cl.length; i++) {
        const a = cl[Math.max(0, i - 1)], b = cl[Math.min(cl.length - 1, i + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl, ny = tx / tl;
        const s = i / (cl.length - 1), w = w0 * Math.pow(1 - s, taper) * 0.5 + w0 * 0.01;
        l.push([cl[i][0] + nx * w, cl[i][1] + ny * w]);
        r.push([cl[i][0] - nx * w, cl[i][1] - ny * w]);
      }
      return l.concat(r.reverse());
    };

    /* ---------------------------------------------------------- one creature */
    /* Returns { ess: paths[], ext: paths[], bodies: pts[][] } in LOCAL mm: nose toward +x,
       origin at body centre, length L. ess = always drawn, ext = decoration drawn while budget lasts. */
    const drawWhale = (L, styleSimple, spKey, rng, fi, mouthOpen) => {
      const ess = [], ext = [], bodiesL = [];
      const L2 = L / 2;
      const wobAmp = L * 0.02 * wobble * (styleSimple ? 1.6 : 0.25);
      const wstep = Math.max(0.6, L * 0.03);
      const push = (arr, pts, closed, wk) => { if (pts.length >= 2) { arr.push({ pts: wob(pts, closed, wobAmp, fi * 17 + wk, wstep), closed, layer: pen }); return arr[arr.length - 1].pts; } return null; };
      const spout = (sx, sy, hgt, wk) => {
        const n = 3 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + ((k / (n - 1)) - 0.5) * Math.PI * 0.7;
          const len = hgt * (0.7 + rng() * 0.5);
          const pts = [];
          for (let i = 0; i <= 6; i++) { const s = i / 6; pts.push([sx + Math.cos(a) * len * s + Math.sin(a) * len * s * s * 0.35, sy + Math.sin(a) * len * s - len * s * s * 0.15]); }
          push(ext, pts, false, wk + k);
          if (detail > 0.5) push(ext, circle(pts[6][0] + (rng() - 0.5) * hgt * 0.1, pts[6][1] - hgt * 0.08, hgt * 0.03, 6), true, wk + 10 + k);
        }
      };

      /* ================================================================ octopus */
      if (spKey === "Octopus") {
        if (styleSimple) {
          const R = L * 0.22;
          const hx = L2 - R * 1.1, hy = -L * 0.12;
          const head = circle(hx, hy, R, 28).map(([x, y], i) => [x, y + (i > 14 ? 0 : -R * 0.15 * Math.sin((i / 14) * Math.PI))]);
          bodiesL.push(push(ess, head, true, 1));
          const er = R * (0.14 + rng() * 0.08);
          push(ess, circle(hx + R * 0.35, hy - R * 0.05, er, 12), true, 2);
          push(ess, circle(hx - R * 0.35, hy - R * 0.05, er, 12), true, 3);
          if (rng() < 0.8) { push(ess, circle(hx + R * 0.4, hy - R * 0.05, er * 0.4, 6), true, 4); push(ess, circle(hx - R * 0.3, hy - R * 0.05, er * 0.4, 6), true, 5); }
          push(ess, arc(hx, hy + R * 0.3, R * 0.28, R * 0.18, Math.PI * 0.15, Math.PI * 0.85, 8), false, 6);
          const nArms = 6 + Math.floor(rng() * 3);
          for (let k = 0; k < nArms; k++) {
            const a0 = Math.PI * 0.15 + (k / (nArms - 1)) * Math.PI * 0.7;
            const bx = hx + Math.cos(a0) * R * 0.95, by = hy + Math.sin(a0) * R * 0.95;
            const len = L * (0.32 + rng() * 0.22), wig = R * (0.12 + rng() * 0.2), freq = 1.5 + rng() * 2;
            const dir = a0 + (rng() - 0.5) * 0.5;
            const pts = [];
            for (let i = 0; i <= 14; i++) { const s = i / 14; const px = bx + Math.cos(dir) * len * s, py = by + Math.sin(dir) * len * s; const off = Math.sin(s * Math.PI * freq) * wig * s; pts.push([px - Math.sin(dir) * off, py + Math.cos(dir) * off]); }
            push(ess, pts, false, 10 + k);
            if (detail > 0.5 && rng() < 0.5) for (let i = 3; i < 14; i += 3) push(ext, circle(pts[i][0], pts[i][1], R * 0.05, 5), true, 30 + k * 5 + i);
          }
          if (p.spout) spout(hx - R * 0.9, hy + R * 0.1, L * 0.12, 60);
          return { ess, ext, bodies: bodiesL };
        }
        /* naturalist's octopus: mantle egg up-back, head with eyes at +x, eight tapered arms */
        const mL = L * 0.42, mH = L * 0.26;
        const mx = -L * 0.04, my = -L * 0.1;
        /* silhouette = union of the mantle egg and the head circle, walked as one ray sweep */
        const hx = mx + mL * 0.5 * 0.9, hy = my + mH * 0.18, hr = mH * 0.5;
        const sil = [];
        const nSil = 56;
        for (let i = 0; i < nSil; i++) {
          const a = (i / nSil) * Math.PI * 2;
          const rr = 1 + 0.12 * Math.cos(a) - 0.06 * Math.cos(2 * a);      /* egg: fatter toward the head */
          const exr = mL * 0.5 * rr, eyr = mH * 0.5 * (1 + 0.1 * Math.sin(a));
          const rEgg = 1 / Math.sqrt(Math.pow(Math.cos(a) / exr, 2) + Math.pow(Math.sin(a) / eyr, 2));
          /* far intersection of the ray with the head circle (radius hr*1.1) */
          const dx = hx - mx, dy = hy - my, ca = Math.cos(a), sa = Math.sin(a);
          const bq = -2 * (dx * ca + dy * sa), cq = dx * dx + dy * dy - hr * hr * 1.21;
          const disc = bq * bq - 4 * cq;
          const rHead = disc > 0 ? (-bq + Math.sqrt(disc)) / 2 : -1;
          const r = Math.max(rEgg, rHead);
          sil.push([mx + ca * r, my + sa * r]);
        }
        bodiesL.push(push(ess, sil, true, 1));
        /* eyes: bulging, with horizontal slit pupils */
        const er = hr * 0.32, ex = hx + hr * 0.55, ey = hy - hr * 0.42;
        push(ess, circle(ex, ey, er, 14), true, 2);
        push(ess, [[ex - er * 0.55, ey], [ex + er * 0.55, ey]], false, 3);
        push(ext, arc(ex, ey, er * 0.5, er * 0.32, Math.PI * 1.1, Math.PI * 1.9, 6), false, 4);
        /* siphon: a short tube under the mantle, angled back */
        const sxp = mx - mL * 0.1, syp = my + mH * 0.42;
        push(ess, [[sxp + L * 0.03, syp - L * 0.01], [sxp - L * 0.05, syp + L * 0.04], [sxp - L * 0.045, syp + L * 0.06], [sxp + L * 0.02, syp + L * 0.02]], false, 5);
        /* arms: eight, fanning from under the head; near-side four thicker */
        const nArms = 8;
        for (let k = 0; k < nArms; k++) {
          const u = k / (nArms - 1);
          const phi = Math.PI * 0.08 + u * Math.PI * 0.84 + (rng() - 0.5) * 0.12;   /* around the lower half of the head */
          const a0 = phi + (rng() - 0.5) * 0.3;
          const len = L * (0.34 + rng() * 0.2) * (1 - 0.2 * Math.abs(u - 0.5));
          const curl = (rng() - 0.5) * 2.2 + (u < 0.5 ? -0.9 : 0.9);
          const nS = 18 + Math.round(detail * 10);
          const cl = [];
          let px = hx + Math.cos(phi) * hr * 0.9, py = hy + Math.sin(phi) * hr * 0.75, ang = a0;
          const wig = (rng() - 0.5) * 1.2;
          for (let i = 0; i <= nS; i++) {
            const s = i / nS;
            cl.push([px, py]);
            ang = a0 + curl * Math.pow(s, 1.6) + Math.sin(s * Math.PI * 2 + k) * 0.25 * wig;
            px += Math.cos(ang) * (len / nS) * (1 - 0.3 * s); py += Math.sin(ang) * (len / nS) * (1 - 0.3 * s);
          }
          const w0 = hr * (0.42 + rng() * 0.12) * (k % 2 === 0 ? 1 : 0.8);
          const poly = limb(cl, w0, 0.85);
          bodiesL.push(push(ess, poly, true, 10 + k));
          /* suckers along the inner edge, shrinking toward the tip */
          if (p.texture && detail > 0.1) {
            const every = Math.max(1, Math.round(4 - detail * 2.5));
            for (let i = 2; i < nS - 1; i += every) {
              const a = cl[i - 1], b = cl[i + 1];
              const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
              const side = curl > 0 ? -1 : 1;
              const s = i / nS, w = w0 * Math.pow(1 - s, 0.85) * 0.5;
              const r = Math.max(0.15, w * 0.32);
              push(ext, circle(cl[i][0] + (-ty / tl) * side * w * 0.55, cl[i][1] + (tx / tl) * side * w * 0.55, r, 6), true, 40 + k * 20 + (i % 20));
            }
          }
        }
        /* skin: a few papillae bumps on the mantle top */
        if (p.texture) {
          const nb = 4 + Math.round(detail * 8);
          for (let k = 0; k < nb; k++) {
            const a = -Math.PI * (0.15 + rng() * 0.7);
            const rr = 1 + 0.12 * Math.cos(a) - 0.06 * Math.cos(2 * a);
            const bx = mx + Math.cos(a) * mL * 0.5 * rr, by = my + Math.sin(a) * mH * 0.5 * (1 + 0.1 * Math.sin(a));
            const r = L * (0.006 + rng() * 0.006);
            push(ext, arc(bx, by, r * 1.6, r, a + Math.PI * 0.5 + Math.PI, a + Math.PI * 0.5, 5), false, 200 + k);
          }
        }
        if (p.spout) { for (let k = 0; k < 3; k++) { const r = L * (0.012 + k * 0.008); push(ext, circle(sxp - L * (0.08 + k * 0.06), syp + L * (0.05 - k * 0.02), r, 8), true, 220 + k); } }
        return { ess, ext, bodies: bodiesL };
      }

      /* ================================================================ whale */
      if (styleSimple) {
        /* child's whale: fat blob body, heart-shaped flukes, fountain spout */
        const fat = 0.2 + rng() * 0.12;
        const hH = L * fat;
        const tailLen = L * (0.14 + rng() * 0.08);
        const flukeH = hH * (0.7 + rng() * 0.5);
        const xJ = -L2 + tailLen, bodyL = L2 - xJ;
        const skewT = 0.7 + rng() * 0.3, skewB = 1.0 + rng() * 0.5;
        const outline = [];
        const n = 26;
        for (let i = 0; i <= n; i++) { const t = i / n; outline.push([xJ + bodyL * t, -hH * Math.pow(Math.sin(Math.PI * Math.pow(t, skewT)), 0.85)]); }
        for (let i = n - 1; i >= 1; i--) { const t = i / n; outline.push([xJ + bodyL * t, hH * 0.7 * Math.pow(Math.sin(Math.PI * Math.pow(t, skewB)), 0.6)]); }
        outline.push([xJ, hH * 0.12]);
        /* flukes: two rounded lobes like a heart turned sideways */
        const lob = (sgn) => arc(xJ - tailLen * 0.55, sgn * flukeH * 0.55, tailLen * 0.5, flukeH * 0.5, sgn > 0 ? Math.PI * 0.05 : -Math.PI * 0.05, sgn > 0 ? Math.PI * 1.05 : -Math.PI * 1.05, 10);
        const lower = lob(1), upper = lob(-1);
        lower.forEach((q) => outline.push(q));
        outline.push([xJ - tailLen * 0.2, 0]);
        upper.slice().reverse().forEach((q) => outline.push(q));
        bodiesL.push(push(ess, outline, true, 1));
        /* eye + smile */
        const er = hH * (0.1 + rng() * 0.07);
        const ex = L2 - bodyL * (0.12 + rng() * 0.1), ey = -hH * (0.15 + rng() * 0.25);
        push(ess, circle(ex, ey, er, 14), true, 2);
        if (rng() < 0.7) push(ess, circle(ex + er * 0.2, ey - er * 0.1, er * 0.4, 8), true, 3);
        const mx = L2 - bodyL * 0.02, my = hH * 0.18;
        if (mouthOpen) push(ess, circle(mx - hH * 0.35, my + hH * 0.1, hH * 0.14, 10), true, 4);
        else push(ess, arc(mx - hH * 0.55, my - hH * 0.1, hH * 0.5, hH * 0.25, Math.PI * 0.1, Math.PI * 0.85, 10), false, 4);
        /* belly line + flipper */
        if (rng() < 0.7) { const bl = []; for (let i = 0; i <= 10; i++) { const t = 0.25 + 0.6 * (i / 10); bl.push([xJ + bodyL * t, hH * 0.7 * Math.pow(Math.sin(Math.PI * Math.pow(t, skewB)), 0.6) * 0.55]); } push(ext, bl, false, 5); }
        const fx = xJ + bodyL * (0.6 + rng() * 0.1), fy = hH * 0.45;
        push(ext, [[fx, fy], [fx - bodyL * 0.12, fy + hH * 0.35], [fx - bodyL * 0.22, fy + hH * 0.3], [fx - bodyL * 0.1, fy]], true, 6);
        if (p.spout) spout(L2 - bodyL * 0.22, -hH * 0.9, L * 0.18, 10);
        return { ess, ext, bodies: bodiesL };
      }

      /* naturalist's whale */
      const S = SP[spKey] || SP.Generic;
      const hH = L * S.asp * 0.5;
      const tailLen = L * S.tail;
      const xB0 = -L2 + tailLen;
      const bodyL = L2 - xB0;
      const half = (t, side) => { const [k, q, u] = side; return hH * (S.ped + (1 - S.ped) * Math.pow(Math.max(0, Math.sin(Math.PI * u * Math.pow(t, q))), k)); };
      const X = (t) => xB0 + bodyL * t;
      const topAt = (t) => -half(t, S.top);
      const botAt = (t) => half(t, S.bot);
      const tangentTop = (t) => { const d = 0.004; const dx = bodyL * d * 2, dy = topAt(Math.min(1, t + d)) - topAt(Math.max(0, t - d)); const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

      /* silhouette with flukes */
      const nB = 40 + Math.round(detail * 24);
      const outline = [];
      for (let i = 0; i <= nB; i++) { const t = i / nB; outline.push([X(t), topAt(t)]); }
      const t1 = topAt(1), b1 = botAt(1), cy = (t1 + b1) / 2, ry = (b1 - t1) / 2, rx = Math.max(ry * S.snout * 2, L * 0.01);
      const nose = arc(L2, cy, rx, ry, -Math.PI / 2, Math.PI / 2, 12);
      for (let i = 1; i < nose.length - 1; i++) outline.push(nose[i]);
      for (let i = nB; i >= 0; i--) { const t = i / nB; outline.push([X(t), botAt(t)]); }
      /* flukes: near lobe (lower, larger) and far lobe (upper, smaller, foreshortened), notch between */
      const span = hH * 2 * S.fluke, xT = -L2;
      const pedT = topAt(0), pedB = botAt(0);
      const stockLen = tailLen * 0.3, tl = tailLen - stockLen, xs = xB0 - stockLen;
      const bez = (a, c, b, n) => { const o = []; for (let i = 1; i <= n; i++) { const u = i / n, v = 1 - u; o.push([v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]); } return o; };
      outline.push([xs, pedB * 0.9]);
      const tipN = [xT + tl * 0.02, span * 0.62], notch = [xT + tl * 0.55, span * 0.03], tipF = [xT + tl * 0.16, -span * 0.48];
      bez([xs, pedB * 0.9], [xs - tl * 0.15, pedB * 0.9 + span * 0.28], tipN, 8).forEach((q) => outline.push(q));
      bez(tipN, [xT + tl * 0.12, span * 0.42], notch, 7).forEach((q) => outline.push(q));
      bez(notch, [xT + tl * 0.24, -span * 0.32], tipF, 7).forEach((q) => outline.push(q));
      bez(tipF, [xs - tl * 0.1, pedT * 0.9 - span * 0.2], [xs, pedT * 0.9], 8).forEach((q) => outline.push(q));
      bodiesL.push(push(ess, outline, true, 1));
      /* fluke trailing-edge crease */
      push(ext, [[xs + stockLen * 0.3, (pedT + pedB) / 2], [notch[0] + tl * 0.05, notch[1]]], false, 2);

      /* dorsal fin */
      const D = S.dorsal;
      if (D.type !== "none") {
        const t = D.t, bx = X(t), by = topAt(t);
        const [tx, ty] = tangentTop(t);
        const nx = ty, ny = -tx;
        const h = D.h * hH * 2;
        let fin = [];
        if (D.type === "tall") {
          const w = L * 0.09;
          fin = [[bx + w * 0.6, by], [bx + w * 0.45, by + ny * h * 0.4 - ty * h * 0.05], [bx + w * 0.2, by + ny * h * 0.85 - ty * h * 0.1], [bx - w * 0.05, by + ny * h - ty * h * 0.12], [bx - w * 0.5, by + ny * h * 0.55], [bx - w * 0.9, by + ny * h * 0.15], [bx - w * 1.05, by]];
        } else if (D.type === "small") {
          const w = L * 0.05;
          fin = [[bx + w * 0.6, by], [bx + w * 0.3, by + ny * h * 0.7], [bx - w * 0.1, by + ny * h], [bx - w * 0.55, by + ny * h * 0.55], [bx - w * 0.9, by]];
        } else if (D.type === "hump") {
          const w = L * 0.08;
          fin = [[bx + w, by], [bx + w * 0.5, by + ny * h * 0.55], [bx + w * 0.15, by + ny * h * 0.95], [bx - w * 0.15, by + ny * h], [bx - w * 0.5, by + ny * h * 0.6], [bx - w * 1.1, by]];
        } else if (D.type === "knuckles") {
          const w = L * 0.07;
          fin = [[bx + w * 0.8, by], [bx + w * 0.3, by + ny * h * 0.7], [bx - w * 0.1, by + ny * h], [bx - w * 0.5, by + ny * h * 0.5], [bx - w * 0.9, by]];
          for (let k = 1; k <= 4 + Math.round(detail * 3); k++) { const tk = t - 0.04 * k; if (tk < 0.02) break; const kx = X(tk), ky = topAt(tk); push(ext, arc(kx, ky, L * 0.012, L * 0.008, Math.PI, Math.PI * 2, 5), false, 20 + k); }
        } else {
          fin = [[bx + L * 0.06, by], [bx, by + ny * h], [bx - L * 0.08, by]];
        }
        if (fin.length) push(ess, fin.map((q) => [q[0], q[1]]).filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-6), D.type === "ridge" ? false : true, 3);
      }

      /* flipper: a long paddle from the lower flank, swept back and down */
      const F = S.flip;
      const fx = X(F.t), fy = botAt(F.t) * 0.55;
      const flen = L * F.len, fwid = L * F.wid, fang = Math.PI * (1 + F.ang);
      const flip = [];
      const nF = 12;
      for (let i = 0; i <= nF; i++) { const u = i / nF; const w = fwid * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.8) * (0.35 + 0.65 * (1 - u)); flip.push([fx + Math.cos(fang) * flen * u - Math.sin(fang) * w * 0.4, fy + Math.sin(fang) * flen * u + Math.cos(fang) * w * 0.4]); }
      for (let i = nF - 1; i >= 1; i--) { const u = i / nF; let w = fwid * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.8); if (spKey === "Humpback") w *= 1 + 0.12 * Math.sin(u * Math.PI * 9); flip.push([fx + Math.cos(fang) * flen * u + Math.sin(fang) * w * 0.6, fy + Math.sin(fang) * flen * u - Math.cos(fang) * w * 0.6]); }
      push(ess, flip, true, 4);

      /* eye + mouth */
      const er = Math.max(L * 0.006, hH * 2 * S.eye[2]);
      const ex = X(S.eye[0]), ey = hH * 2 * S.eye[1] * 0.5 * (spKey === "Sperm" ? 1 : 1);
      push(ess, circle(ex, ey, er, 10), true, 5);
      push(ext, arc(ex, ey, er * 1.6, er * 1.1, Math.PI * 1.15, Math.PI * 1.85, 5), false, 6);
      const M = S.mouth;
      const mTip = [L2 + rx * 0.96, cy + ry * M.drop * 0.9];
      if (spKey === "Sperm") {
        /* underslung jaw: mouth runs along the underside from the nose back */
        const jaw = [];
        for (let i = 0; i <= 10; i++) { const s = i / 10; const t = 1 - M.len * s; jaw.push([X(t), botAt(t) * (0.55 + 0.4 * s)]); }
        jaw[0] = [L2 + rx * 0.5, botAt(1) * 0.55];
        push(ess, jaw, false, 7);
        if (mouthOpen) { const hinge = jaw[jaw.length - 1]; push(ess, [hinge, [hinge[0] + (mTip[0] - hinge[0]) * 0.9, hinge[1] + hH * 0.5]], false, 8); }
      } else {
        const mouth = [];
        for (let i = 0; i <= 10; i++) { const s = i / 10; const t = 1 - M.len * s; mouth.push([i === 0 ? mTip[0] : X(t), cy + ry * M.drop + (botAt(t) - (cy + ry * M.drop)) * (spKey === "Blue" || spKey === "Humpback" ? 0.35 * Math.pow(s, 0.8) : 0.1 * s) * (1 - 0.6 * s * s)]); }
        push(ess, mouth, false, 7);
        if (mouthOpen) { const hinge = mouth[mouth.length - 1]; push(ess, [hinge, [mTip[0] - M.len * L * 0.15, botAt(0.97) + hH * 0.35]], false, 8); }
      }
      if (p.spout) spout(X(0.86), topAt(0.86) - L * 0.005, L * 0.16, 100);

      /* species markings */
      const mk = S.mark;
      if (mk === "grooves" || spKey === "Blue" || spKey === "Humpback") {
        /* ventral pleats along the throat */
        if (p.texture) {
          const ng = 3 + Math.round(detail * 4);
          for (let k = 0; k < ng; k++) {
            const gl = [];
            for (let i = 0; i <= 8; i++) { const t = 0.62 + 0.34 * (i / 8); gl.push([X(t), botAt(t) * (0.55 + k * 0.35 / ng) + Math.sin(i / 8 * Math.PI) * hH * 0.02]); }
            push(ext, gl, false, 120 + k);
          }
        }
      }
      if (mk === "mottle" && p.texture) {
        const nm = 14 + Math.round(detail * 26);
        for (let k = 0; k < nm; k++) {
          const t = 0.1 + rng() * 0.78;
          const yy = topAt(t) * (0.15 + rng() * 0.75);
          const len = L * (0.008 + rng() * 0.012), a = rng() * Math.PI;
          push(ext, arc(X(t), yy, len, len * 0.5, a, a + Math.PI * 1.6, 5), false, 160 + k);
        }
      }
      if (mk === "tubercles" && p.texture) {
        const nt = 6 + Math.round(detail * 8);
        for (let k = 0; k < nt; k++) { const t = 0.8 + 0.19 * (k / nt); const r = L * 0.006; push(ext, circle(X(t) + (rng() - 0.5) * L * 0.01, topAt(t) + r * 0.6 + (k % 2) * hH * 0.12, r, 6), true, 200 + k); }
        for (let k = 0; k < 4; k++) { const t = 0.86 + 0.03 * k; push(ext, circle(X(t), botAt(t) * 0.9 - hH * 0.1, L * 0.006, 6), true, 220 + k); }
      }
      if (mk === "wrinkles" && p.texture) {
        const nw = 6 + Math.round(detail * 10);
        for (let k = 0; k < nw; k++) {
          const t = 0.2 + 0.4 * (k / nw) + rng() * 0.03;
          const wl = [];
          for (let i = 0; i <= 8; i++) { const s = i / 8; const y = topAt(t) * 0.85 + (botAt(t) * 0.7 - topAt(t) * 0.85) * s; wl.push([X(t) + Math.sin(s * Math.PI * 3 + k) * L * 0.006 + s * s * L * 0.02, y]); }
          push(ext, wl, false, 240 + k);
        }
      }
      if (mk === "orca") {
        /* eye patch: white oval behind and above the eye; saddle: pale curve behind the dorsal; belly boundary */
        const px = ex - L * 0.03, py = ey - hH * 0.35;
        push(ess, arc(px, py, L * 0.06, hH * 0.32, 0, Math.PI * 2, 14).slice(0, 14).map(([x, y]) => [x - (y - py) * 0.5, y]), true, 260);
        const sd = [];
        for (let i = 0; i <= 10; i++) { const s = i / 10; const t = 0.5 - 0.22 * s; sd.push([X(t), topAt(t) * (1 - 0.45 * Math.sin(s * Math.PI))]); }
        push(ess, sd, false, 261);
        const bl = [];
        for (let i = 0; i <= 14; i++) { const s = i / 14; const t = 0.06 + 0.9 * s; bl.push([X(t), botAt(t) * (0.15 + 0.5 * Math.pow(Math.sin(s * Math.PI * 0.9 + 0.1), 1.5))]); }
        push(ess, bl, false, 262);
        const ch = [];
        for (let i = 0; i <= 6; i++) { const s = i / 6; const t = 0.86 + 0.13 * s; ch.push([X(t), botAt(t) * (0.15 + 0.7 * s)]); }
        push(ext, ch, false, 263);
      }
      if (mk === "tusk") {
        const tk = L * (0.45 + 0.2 * detail), tx0 = L2 + rx * 0.7, ty0 = cy - ry * 0.2;
        const dir = -0.08;
        push(ess, [[tx0, ty0], [tx0 + Math.cos(dir) * tk, ty0 + Math.sin(dir) * tk]], false, 280);
        push(ess, [[tx0, ty0 + hH * 0.14], [tx0 + Math.cos(dir) * tk, ty0 + Math.sin(dir) * tk + hH * 0.015]], false, 281);
        if (p.texture) {
          const ns = 8 + Math.round(detail * 18);
          for (let k = 1; k < ns; k++) { const s = k / ns; const w = hH * 0.14 * (1 - 0.9 * s); const ax = tx0 + Math.cos(dir) * tk * s, ay = ty0 + Math.sin(dir) * tk * s; push(ext, [[ax + w * 0.3, ay], [ax - w * 0.3, ay + w]], false, 282 + k); }
        }
        if (p.texture) { const nm = 10 + Math.round(detail * 14); for (let k = 0; k < nm; k++) { const t = 0.15 + rng() * 0.7; push(ext, circle(X(t), topAt(t) * (0.3 + rng() * 0.6), L * (0.004 + rng() * 0.006), 6), true, 320 + k); } }
      }
      return { ess, ext, bodies: bodiesL };
    };

    /* ---------------------------------------------------------- placement */
    const styleMode = p.style, spMode = p.species, layout = p.layout;
    const baseSize = Math.max(2, Number(p.size) || 40);
    const rngG = mulberry32(seed * 7919 + 11);
    const placements = [];   /* { cx, cy, ang, L, mirror } */
    const extraFront = 0.04;   /* the fit step handles tusks and arms; this only nudges the grid cell */
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
      const F = drawWhale(pl.L, simple, spKey, rng, i, mouthOpen);
      const c = Math.cos(pl.ang), sn = Math.sin(pl.ang), mx = pl.mirror ? -1 : 1;
      const T0 = ([x, y]) => { const xx = x * mx; return [pl.cx + xx * c - y * sn, pl.cy + xx * sn + y * c]; };
      const tE = F.ess.map((q) => ({ pts: q.pts.map(T0), closed: q.closed, layer: q.layer }));
      const tX = F.ext.map((q) => ({ pts: q.pts.map(T0), closed: q.closed, layer: q.layer }));
      const tB = F.bodies.filter((b) => b && b.length > 2).map((b) => b.map(T0));
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
          tB.forEach((b) => { for (let j = 0; j < b.length; j++) b[j] = fix(b[j]); });
        }
      }
      for (const q of tE) { if (pl.mirror && q.closed) q.pts.reverse(); lines.push(q); total += q.pts.length; }
      tB.forEach((b) => { if (pl.mirror) b.reverse(); bodies.push({ pts: b, closed: true, layer: pen }); });
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
