({
  key: "patternfill",
  name: "Pattern Fill",
  cat: "mod",
  group: "fillstyle",
  desc: "Shades every closed shape with a drawn texture from a pattern library: Hatch, Cross-hatch, sketchy Scribble, Stipple dots, small Circles, Chevron rows, broken Dashes, Crosses, or random Sprinkles — or Mix, which gives each shape its own pattern like a swatch sheet. Offset from edge keeps the fill away from the outline (negative bleeds it past the edge and into holes, like sloppy coloring outside the lines); shapes nested inside another act as holes. Gradient fades the ink density toward the Light angle for instant volume; Vary per shape rotates and loosens the pattern per shape; Wobble adds hand tremor to line patterns. Pens used sprays fills across pens from the base pen, or Inherit shape pens matches each fill to its shape. Open paths pass through untouched — chain Smooth or Hand Drawn after for extra life.",
  ins: [Pin("paths", "Shapes")],
  outs: [Pin("paths")],
  params: [
    { key: "pattern", label: "Pattern", type: "select", options: ["Hatch", "Cross-hatch", "Scribble", "Stipple", "Circles", "Chevron", "Dashes", "Crosses", "Sprinkles", "Mix"], def: "Mix" },
    { key: "spacing", label: "Spacing mm", type: "slider", min: 0.6, max: 10, step: 0.1, def: 2.2 },
    { key: "angle", label: "Angle °", type: "slider", min: 0, max: 180, step: 1, def: 45 },
    { key: "inset", label: "Offset from edge mm", type: "slider", min: -10, max: 10, step: 0.1, def: 1.5 },
    { key: "hand", label: "Wobble", type: "slider", min: 0, max: 1, step: 0.01, def: 0.25 },
    { key: "grad", label: "Gradient", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "gdir", label: "Light angle °", type: "slider", min: 0, max: 360, step: 1, def: 300 },
    { key: "vary", label: "Vary per shape", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "pens", label: "Pens used", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "inherit", label: "Inherit shape pens", type: "check", def: false },
    { key: "outlines", label: "Keep outlines", type: "check", def: true },
    { key: "seed", label: "Seed", type: "seed", def: 11 },
    { key: "layer", label: "Fill pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const seed = Math.round(p.seed) || 1;
    const inset = Math.max(-30, Math.min(30, p.inset));
    const grow = Math.max(0, -inset); // negative offset = bleed outward
    const hand = Math.max(0, Math.min(1.5, p.hand));
    const grad = Math.max(0, Math.min(1, p.grad));
    const vary = Math.max(0, Math.min(1.5, p.vary));
    const pensN = Math.max(1, Math.min(12, Math.round(p.pens)));
    const baseL = Math.round(p.layer);
    const PATS = ["Hatch", "Cross-hatch", "Scribble", "Stipple", "Circles", "Chevron", "Dashes", "Crosses", "Sprinkles"];

    const closed = src.paths.filter((pa) => pa.closed && pa.pts.length > 2);
    const open = src.paths.filter((pa) => !pa.closed || pa.pts.length <= 2);
    const out = [];
    if (p.outlines) for (const pa of closed) out.push(pa);
    for (const pa of open) out.push(pa);
    if (!closed.length) return { paths: out };

    // ---- ring helpers ----
    const ringContains = (ring, x, y) => {
      let insd = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) insd = !insd;
      }
      return insd;
    };
    const distToRing = (ring, x, y, best) => {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        const dx = xj - xi, dy = yj - yi;
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - xi) * dx + (y - yi) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        const ex = xi + dx * t - x, ey = yi + dy * t - y;
        const d = ex * ex + ey * ey;
        if (d < best) best = d;
      }
      return best;
    };

    // ---- group: top-level shapes own the rings nested inside them ----
    const tops = [];
    for (let i = 0; i < closed.length; i++) {
      const [x0, y0] = closed[i].pts[0];
      let insideAny = false;
      for (let k = 0; k < closed.length && !insideAny; k++)
        if (k !== i && ringContains(closed[k].pts, x0, y0)) insideAny = true;
      if (!insideAny) tops.push(i);
    }
    const groups = tops.map((ti) => {
      const rings = [closed[ti].pts];
      for (let k = 0; k < closed.length; k++)
        if (k !== ti && ringContains(closed[ti].pts, closed[k].pts[0][0], closed[k].pts[0][1])) rings.push(closed[k].pts);
      let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
      for (const [x, y] of closed[ti].pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
      return { rings, bx0, bx1, by0, by1, srcLayer: closed[ti].layer };
    });

    // ---- budget-aware spacing ----
    let spacing = Math.max(0.4, p.spacing);
    const passes = p.pattern === "Cross-hatch" ? 2 : p.pattern === "Scribble" ? 1.6 : p.pattern === "Mix" ? 1.7 : 1;
    const totArea = groups.reduce((s, G) => s + (G.bx1 - G.bx0) * (G.by1 - G.by0), 0);
    const est = (totArea / (spacing * 0.7)) * passes;
    if (est > 100000) spacing *= est / 100000;

    const gux = Math.cos((p.gdir * Math.PI) / 180), guy = Math.sin((p.gdir * Math.PI) / 180);

    for (let gi = 0; gi < groups.length; gi++) {
      const G = groups[gi];
      const rng = mulberry32(seed * 7919 + gi * 613 + 5);
      const pat = p.pattern === "Mix" ? PATS[Math.floor(rng() * PATS.length)] : p.pattern;
      const ang = ((p.angle + (rng() - 0.5) * 60 * vary) * Math.PI) / 180;
      const sp = spacing * (1 + (rng() - 0.5) * 0.5 * vary);
      const L = p.inherit ? Math.round(G.srcLayer) : ((baseL + Math.floor(rng() * pensN)) % 12 + 12) % 12;
      const cx = (G.bx0 + G.bx1) / 2, cy = (G.by0 + G.by1) / 2;
      const R = Math.hypot(G.bx1 - G.bx0, G.by1 - G.by0) / 2 + sp + grow;
      const gExt = Math.max(1e-6, Math.abs((G.bx1 - G.bx0) * gux) / 2 + Math.abs((G.by1 - G.by0) * guy) / 2);

      const keepQ = (x, y) => {
        if (grad <= 0) return true;
        const t = ((x - cx) * gux + (y - cy) * guy) / gExt; // -1 dark side .. +1 light side
        const q = 1 - grad * Math.max(0, Math.min(1, (t + 1) / 2));
        return hash2(x * 13.7, y * 9.3, seed * 5 + 3) < q;
      };
      const okAt = (x, y, extra) => {
        let insd = false;
        for (const r of G.rings) if (ringContains(r, x, y)) insd = !insd;
        const lim = inset + (extra || 0);
        if (lim > 0) {
          if (!insd) return false;
          let best = lim * lim;
          for (const r of G.rings) { best = distToRing(r, x, y, best); if (best < lim * lim - 1e-9) break; }
          return best >= lim * lim - 1e-9;
        }
        if (lim < 0) {
          if (insd) return true;
          let best = lim * lim + 1e-9;
          for (const r of G.rings) { best = distToRing(r, x, y, best); if (best <= lim * lim - 1e-9) break; }
          return best <= lim * lim;
        }
        return insd;
      };

      // clip a polyline: sample at 0.7mm, keep visible runs
      const clipLine = (pts) => {
        let cur = [];
        const flush = () => { if (cur.length >= 2) out.push({ pts: cur, closed: false, layer: L }); cur = []; };
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
          const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.7));
          for (let k = i === 1 ? 0 : 1; k <= n; k++) {
            let x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
            if (hand > 0) {
              const w = (noise2(x * 0.12, y * 0.12, seed * 9 + gi * 3 + 1) - 0.5) * 2 * hand * sp * 0.35;
              x += -Math.sin(ang) * w; y += Math.cos(ang) * w;
            }
            if (okAt(x, y, 0) && keepQ(x, y)) cur.push([x, y]);
            else flush();
          }
        }
        flush();
      };
      const stamp = (x, y, r) => okAt(x, y, r) && keepQ(x, y);
      const dot = (x, y, r) => {
        const pts = [];
        for (let q = 0; q < 7; q++) { const a = (q / 7) * Math.PI * 2; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
        out.push({ pts, closed: true, layer: L });
      };
      const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
      const lineAt = (d, jx) => {
        const pts = [];
        const ph = jx || 0;
        pts.push([cx + vx * d - ux * R + ux * ph, cy + vy * d - uy * R + uy * ph]);
        pts.push([cx + vx * d + ux * R + ux * ph, cy + vy * d + uy * R + uy * ph]);
        return pts;
      };

      if (pat === "Hatch" || pat === "Cross-hatch") {
        for (let d = -R; d <= R; d += sp) clipLine(lineAt(d));
        if (pat === "Cross-hatch") {
          const a2 = ang + Math.PI / 2, u2x = Math.cos(a2), u2y = Math.sin(a2), v2x = -u2y, v2y = u2x;
          for (let d = -R; d <= R; d += sp)
            clipLine([[cx + v2x * d - u2x * R, cy + v2y * d - u2y * R], [cx + v2x * d + u2x * R, cy + v2y * d + u2y * R]]);
        }
      } else if (pat === "Scribble") {
        for (let pass = 0; pass < 2; pass++) {
          const psp = pass === 0 ? sp : sp * 1.7;
          for (let d = -R; d <= R; d += psp) {
            const ja = ang + (rng() - 0.5) * (0.12 + hand * 0.12);
            const jux = Math.cos(ja), juy = Math.sin(ja), jvx = -juy, jvy = jux;
            const dd = d + (rng() - 0.5) * psp * 0.5;
            clipLine([[cx + jvx * dd - jux * R, cy + jvy * dd - juy * R], [cx + jvx * dd + jux * R, cy + jvy * dd + juy * R]]);
          }
        }
      } else if (pat === "Stipple") {
        const c = sp;
        for (let y = G.by0 - c - grow; y <= G.by1 + c + grow; y += c) for (let x = G.bx0 - c - grow; x <= G.bx1 + c + grow; x += c) {
          const jx = x + (hash2(x * 3.1, y * 7.7, seed + gi) - 0.5) * c * 0.9;
          const jy = y + (hash2(x * 5.3, y * 2.9, seed * 2 + gi) - 0.5) * c * 0.9;
          const r = sp * 0.18 * (0.7 + hash2(x, y, seed * 3 + gi) * 0.7);
          if (stamp(jx, jy, r)) dot(jx, jy, r);
        }
      } else if (pat === "Circles") {
        const c = sp * 2;
        for (let y = G.by0 - c - grow; y <= G.by1 + c + grow; y += c) for (let x = G.bx0 - c - grow; x <= G.bx1 + c + grow; x += c) {
          const jx = x + (hash2(x * 3.1, y * 7.7, seed + gi) - 0.5) * c * 0.6;
          const jy = y + (hash2(x * 5.3, y * 2.9, seed * 2 + gi) - 0.5) * c * 0.6;
          const r = sp * 0.32 * (0.7 + hash2(x, y, seed * 3 + gi) * 0.6);
          if (stamp(jx, jy, r)) {
            const pts = [];
            const n = Math.max(10, Math.ceil((2 * Math.PI * r) / 0.6));
            for (let q = 0; q < n; q++) { const a = (q / n) * Math.PI * 2; pts.push([jx + Math.cos(a) * r, jy + Math.sin(a) * r]); }
            out.push({ pts, closed: true, layer: L });
          }
        }
      } else if (pat === "Chevron") {
        const rowS = sp * 1.6, per = sp * 2.2, amp = sp * 0.55;
        for (let d = -R; d <= R; d += rowS) {
          const pts = [];
          for (let s = -R; s <= R; s += per / 2) {
            const zig = (Math.round(s / (per / 2)) % 2 === 0 ? -1 : 1) * amp;
            pts.push([cx + vx * (d + zig) + ux * s, cy + vy * (d + zig) + uy * s]);
          }
          clipLine(pts);
        }
      } else if (pat === "Dashes") {
        const dash = sp * 1.4, gap = sp * 0.9;
        for (let d = -R; d <= R; d += sp) {
          const ph = rng() * (dash + gap);
          for (let s = -R + ph; s < R; s += dash + gap)
            clipLine([[cx + vx * d + ux * s, cy + vy * d + uy * s], [cx + vx * d + ux * Math.min(R, s + dash), cy + vy * d + uy * Math.min(R, s + dash)]]);
        }
      } else if (pat === "Crosses") {
        const c = sp * 2.4, arm = sp * 0.4;
        for (let y = G.by0 - c - grow; y <= G.by1 + c + grow; y += c) for (let x = G.bx0 - c - grow; x <= G.bx1 + c + grow; x += c) {
          const jx = x + (hash2(x * 3.1, y * 7.7, seed + gi) - 0.5) * c * 0.25;
          const jy = y + (hash2(x * 5.3, y * 2.9, seed * 2 + gi) - 0.5) * c * 0.25;
          if (stamp(jx, jy, arm)) {
            out.push({ pts: [[jx - arm, jy], [jx + arm, jy]], closed: false, layer: L });
            out.push({ pts: [[jx, jy - arm], [jx, jy + arm]], closed: false, layer: L });
          }
        }
      } else if (pat === "Sprinkles") {
        const nS = Math.round(((G.bx1 - G.bx0 + 2 * grow) * (G.by1 - G.by0 + 2 * grow)) / (sp * sp * 2));
        for (let k = 0; k < nS; k++) {
          const x = G.bx0 - grow + rng() * (G.bx1 - G.bx0 + 2 * grow), y = G.by0 - grow + rng() * (G.by1 - G.by0 + 2 * grow);
          const a = rng() * Math.PI, len = sp * (0.8 + rng() * 0.9);
          const hx = (Math.cos(a) * len) / 2, hy = (Math.sin(a) * len) / 2;
          if (stamp(x, y, len / 2)) out.push({ pts: [[x - hx, y - hy], [x + hx, y + hy]], closed: false, layer: L });
        }
      }
    }
    return { paths: out };
  },
})
