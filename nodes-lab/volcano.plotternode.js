({
  key: "volcano",
  name: "Volcano",
  cat: "gen",
  group: "geometric",
  desc: "A 3D volcano rendered with hidden-line removal: the flank climbs to a crater rim peak, then dips inward into a bowl. Render picks the drawing style \u2014 Rows (horizontal terrain scanlines, Joy Division look), Rings (contour circles around the cone), Spokes (radial profile curves) or Mesh (rings + spokes). Tilt is the viewing elevation: low angles hide the crater floor behind the near rim, steep angles look down into the bowl. Steepness curves the flank (higher = sharper peak), Dip sets crater depth, Roughness adds seeded fBm rock noise and Flutes carve radial erosion gullies into the flank (Flute depth sets how deep). Spacing controls row/ring pitch, Spokes their count. Yaw spins the volcano around its axis (flutes, rock noise, spokes and dots turn with it — rows stay screen-aligned). Dots render draws the surface as individual repeating rings on a polar grid; Dot grow scales them by altitude toward the Peak or the Base (None keeps them equal), Dot jitter adds seeded random size variation per dot, and Dot size sets the maximum. Tip: animate Tilt or Yaw with the frame clock for a fly-over.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "render", label: "Render", type: "select",
      options: ["Rows", "Rings", "Spokes", "Mesh", "Dots"], def: "Rows" },
    { key: "size", label: "Base radius", type: "slider", min: 20, max: 140, step: 1, def: 70 },
    { key: "crater", label: "Crater radius", type: "slider", min: 2, max: 60, step: 0.5, def: 18 },
    { key: "height", label: "Height", type: "slider", min: 5, max: 100, step: 1, def: 50 },
    { key: "dip", label: "Dip", type: "slider", min: 0, max: 80, step: 0.5, def: 16 },
    { key: "steep", label: "Steepness", type: "slider", min: 0.5, max: 4, step: 0.05, def: 1.8 },
    { key: "tilt", label: "Tilt", type: "slider", min: 15, max: 85, step: 1, def: 40 },
    { key: "yaw", label: "Yaw", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "spacing", label: "Spacing", type: "slider", min: 1, max: 8, step: 0.1, def: 2.2 },
    { key: "spokes", label: "Spokes", type: "slider", min: 6, max: 90, step: 1, def: 36 },
    { key: "rough", label: "Roughness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.25 },
    { key: "flutes", label: "Flutes", type: "slider", min: 0, max: 20, step: 1, def: 8 },
    { key: "flDepth", label: "Flute depth", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "dotSize", label: "Dot size", type: "slider", min: 0.3, max: 4, step: 0.05, def: 1.2 },
    { key: "dotGrow", label: "Dot grow", type: "select", options: ["Peak", "Base", "None"], def: "Peak" },
    { key: "dotJitter", label: "Dot jitter", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 5 },
    { key: "cx", label: "Center X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Center Y %", type: "slider", min: 0, max: 100, step: 1, def: 55 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const X = (ctx.W * p.cx) / 100, Y = (ctx.H * p.cy) / 100;
    const el = (p.tilt * Math.PI) / 180, se = Math.sin(el), ce = Math.cos(el);
    const R = Math.max(5, p.size);
    const Rc = Math.min(Math.max(1, p.crater), R * 0.85);
    const h = Math.max(1, p.height);
    const ell = (r, z) => {
      const pts = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        pts.push([X + Math.cos(a) * r, Y - (Math.sin(a) * r * se + z * ce)]);
      }
      return { kind: "poly", pts };
    };
    return [ell(R, 0), ell(Rc, h), { kind: "point", x: X, y: Y }];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const X = (W * p.cx) / 100, Y = (H * p.cy) / 100;
    const R = Math.max(5, p.size);
    const Rc = Math.min(Math.max(1, p.crater), R * 0.85);
    const h = Math.max(1, p.height);
    const dip = Math.min(Math.max(0, p.dip), h);
    const steep = Math.max(0.3, p.steep);
    const el = (p.tilt * Math.PI) / 180, se = Math.sin(el), ce = Math.cos(el);
    const yaw = (p.yaw * Math.PI) / 180, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const spacing = Math.max(0.8, p.spacing);
    const nspokes = Math.max(3, Math.round(p.spokes));
    const rough = Math.max(0, p.rough);
    const flutes = Math.max(0, Math.round(p.flutes));
    const flDepth = Math.max(0, p.flDepth);
    const seed = Math.round(p.seed);
    const layer = Math.round(p.layer) % PENS.length;

    const ns = 3 / R; // noise feature scale relative to size
    const fbm = (x, y) =>
      noise2(x * ns, y * ns, seed) * 0.55 +
      noise2(x * ns * 2, y * ns * 2, seed + 7) * 0.3 +
      noise2(x * ns * 4, y * ns * 4, seed + 13) * 0.15;

    // heightfield: local coords, volcano centered at (0,0)
    const zAt = (x, y) => {
      const r = Math.hypot(x, y);
      if (r >= R) return 0;
      let z;
      let flank = 0; // 0..1 position on flank for flute mask
      if (r >= Rc) {
        const t = (R - r) / (R - Rc);
        flank = t;
        z = h * Math.pow(t, steep);
      } else {
        z = h - dip * (1 - (r / Rc) * (r / Rc));
      }
      if (flutes > 0 && flDepth > 0 && r >= Rc) {
        const a = Math.atan2(y, x);
        z *= 1 + flDepth * 0.4 * Math.cos(a * flutes) * Math.sin(Math.PI * flank);
      }
      if (rough > 0) {
        const mask = Math.sqrt(Math.min(1, z / h));
        z += (fbm(x, y) - 0.5) * rough * h * 0.3 * Math.max(0.15, mask);
      }
      return Math.max(0, z);
    };

    // world height: rotate world coords into object frame (yaw spins the volcano)
    const zW = (x, y) => zAt(x * cyw + y * syw, -x * syw + y * cyw);

    /* ---------- build surface polylines (local 3D) ---------- */
    const polys = []; // each: array of [x, y, z]
    const EXT = R + spacing; // rows cover a square ground patch
    const step = 0.8;
    const addRow = (y) => {
      const P = [];
      const n = Math.ceil((2 * EXT) / step);
      for (let k = 0; k <= n; k++) {
        const x = -EXT + (2 * EXT * k) / n; // symmetric about 0
        P.push([x, y, zW(x, y)]);
      }
      polys.push(P);
    };
    const addRing = (r) => {
      const n = Math.max(24, Math.ceil((2 * Math.PI * r) / step));
      const P = [];
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        P.push([x, y, zW(x, y)]);
      }
      polys.push(P);
    };
    const addSpoke = (a) => {
      const P = [];
      const dx = Math.cos(a), dy = Math.sin(a);
      const n = Math.ceil(R / step);
      for (let k = 0; k <= n; k++) {
        const r = (R * k) / n;
        P.push([dx * r, dy * r, zW(dx * r, dy * r)]);
      }
      polys.push(P);
    };
    const mode = p.render;
    if (mode === "Rows") {
      const nr = Math.ceil((2 * EXT) / spacing);
      for (let k = 0; k <= nr; k++) addRow(-EXT + (2 * EXT * k) / nr);
    }
    if (mode === "Rings" || mode === "Mesh") {
      for (let r = spacing; r <= R + 0.01; r += spacing) addRing(Math.min(r, R));
    }
    if (mode === "Spokes" || mode === "Mesh") {
      for (let i = 0; i < nspokes; i++) addSpoke((i / nspokes) * Math.PI * 2 + yaw);
    }
    let noEmitBefore = 0, dotStart = Infinity;
    const dotR = [];
    if (mode === "Dots") {
      // dense hidden probe rows: build a correct horizon even though the
      // emitted dots themselves are sparse
      const nr = Math.ceil((2 * EXT) / 1.2);
      for (let k = 0; k <= nr; k++) addRow(-EXT + (2 * EXT * k) / nr);
      noEmitBefore = polys.length;
      dotStart = polys.length;
      // polar grid of dot centers in object frame, rotated to world by yaw
      let ri = 0;
      for (let r = spacing; r <= R + 0.01; r += spacing, ri++) {
        const rr = Math.min(r, R);
        const n = Math.max(6, Math.round((2 * Math.PI * rr) / Math.max(1.4, p.dotSize * 2.6)));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const ox = Math.cos(a) * rr, oy = Math.sin(a) * rr;
          const x = ox * cyw - oy * syw, y = ox * syw + oy * cyw;
          const z = zW(x, y);
          polys.push([[x, y, z]]);
          const zn = Math.min(1, z / h);
          const grow = p.dotGrow === "Peak" ? 0.35 + 0.65 * zn
            : p.dotGrow === "Base" ? 1 - 0.65 * zn : 1;
          const jit = p.dotJitter > 0
            ? Math.max(0.1, 1 + (hash2(ri, k, seed + 31) - 0.5) * 1.4 * p.dotJitter)
            : 1;
          dotR.push(Math.max(0.15, p.dotSize * grow * jit) / 2);
        }
      }
    }

    /* ---------- project + hidden-line removal (float horizon) ---------- */
    // screen: sx = X + x ; sy = Y - (y*sin(el) + z*cos(el))
    // process all samples in ascending world y (near -> far);
    // a sample is visible iff it pokes above the horizon built so far.
    const proj = polys.map((P) => P.map(([x, y, z]) =>
      [X + x, Y - (y * se + z * ce), y]));
    const order = [];
    proj.forEach((P, pi) => P.forEach((q, qi) => order.push([q[2], pi, qi])));
    order.sort((a, b) => a[0] - b[0]);

    const bin = 0.4, eps = 0.12;
    const minSx = X - EXT - 1, cols = Math.ceil((2 * (EXT + 1)) / bin) + 2;
    const horizon = new Float64Array(cols).fill(Infinity);
    const vis = proj.map((P) => new Array(P.length).fill(false));
    for (const [, pi, qi] of order) {
      const [sx, sy] = proj[pi][qi];
      const c = Math.round((sx - minSx) / bin);
      if (c < 0 || c >= cols) continue;
      if (sy < horizon[c] - eps) vis[pi][qi] = true;
      if (sy < horizon[c]) horizon[c] = sy;
      // guard adjacent bin against leaks
      const c2 = sx - minSx - c * bin > 0 ? c + 1 : c - 1;
      if (c2 >= 0 && c2 < cols && sy < horizon[c2]) horizon[c2] = sy;
    }

    /* ---------- emit visible runs ---------- */
    const paths = [];
    let budget = 110000;
    for (let pi = noEmitBefore; pi < Math.min(dotStart, proj.length) && budget > 0; pi++) {
      let run = [];
      const flush = () => {
        if (run.length >= 2 && pathLength(run, false) > 0.8) {
          budget -= run.length;
          paths.push({ pts: run, closed: false, layer });
        }
        run = [];
      };
      for (let qi = 0; qi < proj[pi].length; qi++) {
        if (vis[pi][qi]) run.push([proj[pi][qi][0], proj[pi][qi][1]]);
        else flush();
      }
      flush();
    }
    for (let pi = dotStart; pi < proj.length && budget > 0; pi++) {
      if (!vis[pi][0]) continue;
      const [sx, sy] = proj[pi][0];
      const rr = dotR[pi - dotStart];
      const n = Math.max(8, Math.ceil((2 * Math.PI * rr) / 0.5));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr]);
      }
      budget -= n;
      paths.push({ pts, closed: true, layer });
    }
    return applyStyle({ paths }, ins[0]);
  },
})
