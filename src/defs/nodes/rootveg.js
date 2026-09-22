import { Pin, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  /* Root Vegetables — Kosmos Botanika companion to Potato: carrots, turnips,
     swedes, sugar beets, onions, garlic, leeks, cauliflowers and cabbages.
     Each specimen: body silhouette from a half-width profile hw(t) along a
     vertical axis (plus asymmetric harmonics), kind-specific texture lines,
     leaves (Tops), and Fray-style root hairs that avoid the body interior.
     All parts are built in the specimen's local frame, rotated, measured, and
     then placed by axis-aligned bbox rejection (No overlap) like Potato. */
  key: "rootveg",
  name: "Root Vegetables",
  cat: "gen",
  group: "nature",
  desc: "A root-cellar harvest for the Kosmos Botanika plates: Carrot, Turnip, Swede, Sugar beet, Onion, Garlic, Leek, Cauliflower and Cabbage, or Mix for a seeded medley. Every specimen is drawn as a botanical-plate outline — a kind-specific silhouette (carrot cone with rounded shoulder, flat turnip, necked swede, wedge beet with its two grooves, onion and garlic with a cut neck, leek shaft, curd dome, leaf ball) roughened by Irregularity with different harmonics on each side — with Texture lines that belong to the kind: carrot ring scars, onion skin meridians, garlic clove ridges, beet grooves and wrinkles, leek shaft lines, cauliflower curds, cabbage leaf edges and veins, and the purple shoulder of turnip and swede on Accent pen. Tops adds Leaves (feathery carrot tops, spoon leaves on turnip / swede / beet, hollow onion tubes, flat garlic and leek blades, wrapping cauliflower and cabbage leaves, each with a midrib) or Cut stubs, scaled by Top length; Roots hangs fine wandering root hairs from the right places — an onion, garlic or leek tuft at the base, a carrot taproot tail with lateral hairs, beet rootlets — that never re-enter the body, scaled by Root length (cabbage and cauliflower are cut, no roots). Size is the body height, Size variation scatters it; Rotation Upright / Tilt / Random; Placement No overlap keeps whole specimens (tops and roots included) apart by bounding box, Loose lets bodies touch. Pens: body, Accent, Tops, Roots.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "kind", label: "Kind", type: "select", options: ["Mix", "Carrot", "Turnip", "Swede", "Sugar beet", "Onion", "Garlic", "Leek", "Cauliflower", "Cabbage"], def: "Mix" },
    { key: "count", label: "Specimens", type: "slider", min: 1, max: 40, step: 1, def: 7 },
    { key: "size", label: "Size mm (body height)", type: "slider", min: 10, max: 150, step: 1, def: 55 },
    { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "irr", label: "Irregularity", type: "slider", min: 0, max: 0.6, step: 0.02, def: 0.14 },
    { key: "place", label: "Placement", type: "select", options: ["No overlap", "Loose (may overlap)"], def: "No overlap" },
    { key: "rotation", label: "Rotation", type: "select", options: ["Upright", "Tilt", "Random"], def: "Tilt" },
    { key: "tilt", label: "Tilt °", type: "slider", min: 0, max: 60, step: 1, def: 18, showIf: (p) => p.rotation === "Tilt" },
    { key: "texture", label: "Texture", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "tops", label: "Tops", type: "select", options: ["Leaves", "Cut stubs", "None"], def: "Leaves" },
    { key: "topLen", label: "Top length (× size)", type: "slider", min: 0.2, max: 2, step: 0.05, def: 0.9, showIf: (p) => p.tops !== "None" },
    { key: "roots", label: "Roots", type: "slider", min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: "rootLen", label: "Root length (× size)", type: "slider", min: 0.1, max: 1.5, step: 0.05, def: 0.5, showIf: (p) => p.roots > 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 19 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "penAccent", label: "Accent pen", type: "pen", def: 7 },
    { key: "penTops", label: "Tops pen", type: "pen", def: 4 },
    { key: "penRoots", label: "Roots pen", type: "pen", def: 9 },
  ],

  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 2));
      return [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }];
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 2));
    const seed = (Math.round(p.seed) || 1) >>> 0;
    const rng = mulberry32(seed * 2311 + 97);
    const KINDS = ["Carrot", "Turnip", "Swede", "Sugar beet", "Onion", "Garlic", "Leek", "Cauliflower", "Cabbage"];
    const penB = Math.round(p.layer), penA = Math.round(p.penAccent), penT = Math.round(p.penTops), penR = Math.round(p.penRoots);
    const irr = Math.max(0, Math.min(0.6, p.irr));
    const tex = Math.max(0, Math.min(1, p.texture));
    const rootsD = Math.max(0, Math.min(1, p.roots));
    const rootLen = Math.max(0.05, p.rootLen);
    const topLen = Math.max(0.1, p.topLen);
    const TWO_PI = Math.PI * 2;
    const paths = [];
    const BUDGET = 110000;
    let pts = 0;

    /* ---------------- kind profiles: hw(t) in [0,1] × half-width, t = 0 top … 1 bottom ---------------- */
    const circ = (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)));
    const PROF = {
      Carrot: { aspect: 4.2, hw: (t) => (t < 0.1 ? Math.sqrt(Math.max(0, 1 - ((0.1 - t) / 0.1) ** 2)) : Math.pow((1 - t) / 0.9, 1.15)) },
      Turnip: { aspect: 0.72, hw: (t) => Math.pow(circ(t), 0.9) },
      Swede: { aspect: 0.95, hw: (t) => circ(t) * (0.78 + 0.22 * Math.sqrt(Math.min(1, t / 0.4))) },
      "Sugar beet": { aspect: 2.0, hw: (t) => (t < 0.22 ? Math.sqrt(Math.max(0, 1 - ((0.22 - t) / 0.22) ** 2)) : Math.pow((1 - t) / 0.78, 1.4)) },
      Onion: { aspect: 1.05, hw: (t) => Math.max(Math.pow(circ(t), 0.8), t < 0.12 ? 0.16 * (1 - t / 0.12) + 0.001 : 0) },
      Garlic: { aspect: 1.0, hw: (t) => Math.max(Math.pow(circ(t), 0.75) * (1 + 0.05 * Math.cos(t * Math.PI * 5)), t < 0.12 ? 0.14 * (1 - t / 0.12) + 0.001 : 0) },
      Leek: { aspect: 5.5, hw: (t) => (t > 0.92 ? Math.sqrt(Math.max(0, 1 - ((t - 0.92) / 0.08) ** 2)) : 1) * (0.85 + 0.15 * t) },
      Cauliflower: { aspect: 0.9, hw: (t) => (t > 0.86 ? Math.pow(circ(0.86), 0.7) * Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : Math.pow(circ(t), 0.7)) },
      Cabbage: { aspect: 1.0, hw: (t) => Math.pow(circ(t), 0.9) },
    };

    /* ---------------- generic helpers (local frame: x right, y down, body centre at 0,0) ---------------- */
    const push = (arr, list, pen, closed) => { if (list.length >= 2) arr.push({ pts: list, closed: !!closed, layer: pen }); };
    const noiseAt = (a, b) => noise2(a, b, seed + 11);
    /* leaf blade: closed spoon outline along a curved centreline + midrib */
    const blade = (out, base, ang, len, wid, bend, pen, midrib) => {
      const N = 14, L = [], R = [], C = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const a = ang + bend * u;
        const cx = base[0] + Math.cos(a) * len * u, cy = base[1] + Math.sin(a) * len * u;
        const w = wid * Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, u * 0.92 + 0.04))), 0.8);
        const nx = -Math.sin(a), ny = Math.cos(a);
        L.push([cx + nx * w, cy + ny * w]); R.push([cx - nx * w, cy - ny * w]); C.push([cx, cy]);
      }
      push(out, [...L, ...R.reverse()], pen, true);
      if (midrib) push(out, C.slice(1, N), pen, false);
    };
    const stem = (out, base, ang, len, bend, pen) => {
      const N = 8, C = [];
      for (let i = 0; i <= N; i++) { const u = i / N, a = ang + bend * u; C.push([base[0] + Math.cos(a) * len * u, base[1] + Math.sin(a) * len * u]); }
      push(out, C, pen, false);
      return C;
    };
    /* root hair: short Fray-style march that stays outside the body polygon */
    const hair = (out, inside, base, ang, len, wig, pen, r) => {
      const DS = 0.8, C = [base.slice()];
      let x = base[0], y = base[1], a = ang;
      const id = r() * 100;
      for (let s = DS; s <= len; s += DS) {
        a += 0.35 * wig * noiseAt(s * 0.15, id);
        a += 0.02 * Math.sin(Math.PI / 2 - a); /* gravity: ease toward straight down */
        const nx = x + Math.cos(a) * DS, ny = y + Math.sin(a) * DS;
        if (s > 1.2 && inside(nx, ny)) break;
        x = nx; y = ny; C.push([x, y]);
      }
      if (C.length >= 3) push(out, C, pen, false);
    };

    /* ---------------- one specimen in local coords ---------------- */
    const specimen = (kind, h, r) => {
      const P = PROF[kind];
      const w2 = h / P.aspect / 2;
      const out = [], bodyOut = [];
      /* side wobble: different harmonics per side for asymmetry */
      const ph = [r() * TWO_PI, r() * TWO_PI, r() * TWO_PI, r() * TWO_PI];
      const wob = (t, side) => 1 + irr * (0.6 * Math.sin(TWO_PI * t * 1.3 + ph[side * 2]) + 0.4 * Math.sin(TWO_PI * t * 2.7 + ph[side * 2 + 1]));
      const yAt = (t) => -h / 2 + h * t;
      const hwAt = (t, side) => Math.max(0, P.hw(t)) * w2 * wob(t, side);
      const M = 56;
      const tOf = (i) => 0.5 - 0.5 * Math.cos((Math.PI * i) / M); /* clustered at both ends */
      const right = [], left = [];
      for (let i = 0; i <= M; i++) { const t = tOf(i); right.push([hwAt(t, 0), yAt(t)]); left.push([-hwAt(t, 1), yAt(t)]); }
      /* remove duplicate apex points when hw = 0 at the ends */
      const body = [...right, ...left.reverse()].filter((q, i, arr) => i === 0 || Math.hypot(q[0] - arr[i - 1][0], q[1] - arr[i - 1][1]) > 1e-6);
      push(bodyOut, body, penB, true);
      const inside = (x, y) => {
        let c = false;
        for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
          const [xi, yi] = body[i], [xj, yj] = body[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      const top = [0, yAt(0)], bottom = [0, yAt(1)];
      const topW = hwAt(0, 0); /* neck half-width (0 for pointed tops) */
      /* meridian: line following the body at fraction k of the half-width */
      const meridian = (k, t0, t1, pen, arr) => {
        const C = [];
        for (let i = 0; i <= 20; i++) { const t = t0 + (t1 - t0) * (i / 20); C.push([k * hwAt(t, k < 0 ? 1 : 0), yAt(t)]); }
        push(arr || out, C, pen, false);
      };
      const ring = (t, a, b, sag, pen) => {
        const C = [];
        const xa = -hwAt(t, 1) * a, xb = hwAt(t, 0) * b;
        for (let i = 0; i <= 8; i++) { const u = i / 8; C.push([xa + (xb - xa) * u, yAt(t) + sag * Math.sin(Math.PI * u)]); }
        push(out, C, pen, false);
      };

      /* ---- texture ---- */
      if (tex > 0) {
        if (kind === "Carrot") { const n = Math.round(4 + tex * 14); for (let i = 0; i < n; i++) { const t = 0.12 + r() * 0.82; ring(t, 0.25 + r() * 0.7, 0.25 + r() * 0.7, h * 0.006 * (0.5 + r()), penB); } }
        else if (kind === "Turnip" || kind === "Swede") {
          const ts = kind === "Turnip" ? 0.34 : 0.42;
          const C = []; for (let i = 0; i <= 24; i++) { const u = i / 24; const x = -hwAt(ts, 1) + (hwAt(ts, 1) + hwAt(ts, 0)) * u; C.push([x, yAt(ts) + h * 0.02 * noiseAt(u * 4, 3)]); }
          push(out, C, penA, false);
          const n = Math.round(tex * 8); for (let i = 0; i < n; i++) { const t = ts * (0.35 + 0.6 * r()); const x = (r() * 2 - 1) * 0.6 * hwAt(t, 0); push(out, [[x, yAt(t)], [x + h * 0.01 * (r() - 0.5), yAt(t) + h * 0.04 + h * 0.03 * r()]], penA, false); }
          push(out, [[0, yAt(1) - h * 0.02], [0, yAt(1)]], penB, false);
        }
        else if (kind === "Sugar beet") { meridian(0.42, 0.24, 0.9, penB); meridian(-0.42, 0.24, 0.9, penB); const n = Math.round(tex * 9); for (let i = 0; i < n; i++) { const t = 0.2 + r() * 0.65; const side = r() < 0.5 ? -1 : 1; const a = 0.5 + r() * 0.4; if (side < 0) ring(t, a, -0.45, h * 0.004, penB); else ring(t, -0.45, a, h * 0.004, penB); } }
        else if (kind === "Onion") { const n = Math.round(2 + tex * 4); for (let i = 1; i <= n; i++) { const k = (i / (n + 1)) * 1.7 - 0.85; meridian(k, 0.1, 0.97, penB); } }
        else if (kind === "Garlic") { const n = Math.round(2 + tex * 3); for (let i = 1; i <= n; i++) { const k = (i / (n + 1)) * 1.6 - 0.8; meridian(k, 0.12, 0.93, penB); } const nn = Math.round(tex * 10); for (let i = 0; i < nn; i++) { const t = 0.2 + r() * 0.7, x = (r() * 2 - 1) * 0.7 * hwAt(t, 0); push(out, [[x, yAt(t)], [x + h * 0.02 * (r() - 0.5), yAt(t) + h * 0.05 * (0.4 + r())]], penB, false); } }
        else if (kind === "Leek") { meridian(0.4, 0.07, 0.9, penB); meridian(-0.4, 0.07, 0.9, penB); if (tex > 0.5) { meridian(0.75, 0.07, 0.85, penB); } ring(0.06, 1, 1, 0, penB); }
        else if (kind === "Cauliflower") {
          const n = Math.round(10 + tex * 70);
          for (let i = 0; i < n; i++) {
            const t = 0.06 + r() * 0.78, x = (r() * 2 - 1) * 0.9 * hwAt(t, 0);
            const rr = h * (0.012 + r() * 0.022), C = [];
            for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI; C.push([x + Math.cos(a) * rr, yAt(t) + Math.sin(a) * rr * 0.8]); }
            push(out, C, penB, false);
          }
        }
        else if (kind === "Cabbage") {
          const n = Math.round(2 + tex * 4);
          for (let i = 1; i <= n; i++) { /* nested leaf edges sweeping from the base up one side */
            const k = i / (n + 1), side = i % 2 ? 1 : -1, C = [];
            for (let j = 0; j <= 16; j++) { const u = j / 16; const t = 0.98 - u * (0.55 + 0.35 * k); const x = side * hwAt(t, side > 0 ? 0 : 1) * (0.15 + 0.8 * k) * Math.sin(Math.PI * Math.min(1, u * 1.15)); C.push([x, yAt(t)]); }
            push(out, C, penB, false);
          }
          const nv = Math.round(3 + tex * 6);
          for (let i = 0; i < nv; i++) { const a = -Math.PI / 2 + (i / (nv - 1) - 0.5) * 1.6; const C = []; for (let j = 1; j <= 8; j++) { const u = j / 8; const t = 0.95 - u * 0.75; const x = Math.cos(a) * u * hwAt(t, 0) * 0.95; C.push([x, yAt(Math.min(1, t + 0.05 * u * u))]); } push(out, C, penB, false); }
        }
      }

      /* ---- tops ---- */
      const L = h * topLen;
      if (p.tops === "Cut stubs") {
        if (kind === "Cabbage" || kind === "Cauliflower") { push(out, [[-h * 0.05, yAt(0.98)], [-h * 0.06, yAt(1) + h * 0.1]], penT, false); push(out, [[h * 0.05, yAt(0.98)], [h * 0.06, yAt(1) + h * 0.1]], penT, false); }
        else { const n = 3 + Math.floor(r() * 4); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 0.9; stem(out, [(r() - 0.5) * 2 * Math.max(topW, h * 0.02), top[1]], a, h * (0.08 + r() * 0.1), 0, penT); } }
      } else if (p.tops === "Leaves") {
        if (kind === "Carrot") {
          const n = 3 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.3 + (r() - 0.5) * 0.3, len = L * (0.55 + r() * 0.45), bend = (r() - 0.5) * 0.8;
            const C = stem(out, [(r() - 0.5) * h * 0.04, top[1]], a, len, bend, penT);
            for (let k = 3; k < C.length; k++) { const q = C[k], d = [C[k][0] - C[k - 1][0], C[k][1] - C[k - 1][1]]; const dl = Math.hypot(d[0], d[1]) || 1; const lf = len * 0.12 * (0.5 + r() * 0.6); for (const s of [-1, 1]) { const ax = Math.atan2(d[1], d[0]) + s * 0.9; push(out, [q, [q[0] + Math.cos(ax) * lf, q[1] + Math.sin(ax) * lf], [q[0] + Math.cos(ax + s * 0.5) * lf * 1.4, q[1] + Math.sin(ax + s * 0.5) * lf * 1.4]], penT, false); } }
          }
        } else if (kind === "Turnip" || kind === "Swede" || kind === "Sugar beet") {
          const n = 3 + Math.floor(r() * 4);
          for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 1.4 + (r() - 0.5) * 0.2, sl = L * (0.3 + r() * 0.2), bend = (r() - 0.5) * 0.6;
            const C = stem(out, [(r() - 0.5) * h * 0.06, top[1]], a, sl, bend, penT);
            const e = C[C.length - 1], ea = a + bend;
            blade(out, e, ea + (r() - 0.5) * 0.3, L * (0.3 + r() * 0.2), L * (0.09 + r() * 0.05), (r() - 0.5) * 0.5, penT, true);
          }
        } else if (kind === "Onion" || kind === "Garlic") {
          const n = kind === "Onion" ? 3 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 1.1 + (r() - 0.5) * 0.2, len = L * (0.5 + r() * 0.5), bend = (r() - 0.5) * 1.1;
            const N = 14, Lp = [], Rp = [], w0 = Math.max(topW, h * 0.03) * (kind === "Onion" ? 0.8 : 0.9) / Math.max(1, n * 0.6);
            for (let j = 0; j <= N; j++) { const u = j / N, aa = a + bend * u; const cx = Math.cos(aa) * len * u + (i / Math.max(1, n - 1) - 0.5) * 2 * topW * 0.8, cy = top[1] + Math.sin(aa) * len * u; const w = w0 * (1 - u * 0.92); Lp.push([cx - Math.sin(aa) * w, cy + Math.cos(aa) * w]); Rp.push([cx + Math.sin(aa) * w, cy - Math.cos(aa) * w]); }
            push(out, [...Lp, ...Rp.reverse()], penT, true);
          }
        } else if (kind === "Leek") {
          const n = 5 + Math.floor(r() * 4);
          for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; const a = -Math.PI / 2 + side * (0.15 + 0.6 * (i / n)) + (r() - 0.5) * 0.1; blade(out, [side * w2 * 0.35 * (i / n), yAt(0.02 + 0.06 * (i / n))], a, L * (0.55 + r() * 0.45), w2 * 0.5, side * (0.4 + r() * 0.5), penT, true); }
        } else if (kind === "Cauliflower") {
          const n = 4 + Math.floor(r() * 4);
          for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; const t = 0.62 + r() * 0.25; const a = -Math.PI / 2 + side * (0.35 + r() * 0.45); blade(out, [side * hwAt(t, side > 0 ? 0 : 1) * 0.9, yAt(t)], a, L * (0.5 + r() * 0.4), h * (0.12 + r() * 0.08), -side * (0.5 + r() * 0.5), penT, true); }
          push(out, [[-h * 0.05, yAt(0.99)], [-h * 0.06, yAt(1) + h * 0.08]], penT, false); push(out, [[h * 0.05, yAt(0.99)], [h * 0.06, yAt(1) + h * 0.08]], penT, false);
        } else if (kind === "Cabbage") {
          const n = 2 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; const t = 0.8 + r() * 0.15; const a = -Math.PI / 2 + side * (0.9 + r() * 0.5); blade(out, [side * hwAt(t, side > 0 ? 0 : 1) * 0.6, yAt(t)], a, L * (0.55 + r() * 0.35), h * (0.18 + r() * 0.08), -side * (0.7 + r() * 0.5), penT, true); }
          push(out, [[-h * 0.05, yAt(0.99)], [-h * 0.06, yAt(1) + h * 0.08]], penT, false); push(out, [[h * 0.05, yAt(0.99)], [h * 0.06, yAt(1) + h * 0.08]], penT, false);
        }
      }

      /* ---- roots ---- */
      if (rootsD > 0 && kind !== "Cabbage" && kind !== "Cauliflower") {
        const RL = h * rootLen;
        if (kind === "Onion" || kind === "Garlic" || kind === "Leek") {
          const n = Math.round(6 + rootsD * 26);
          for (let i = 0; i < n; i++) { const t = 0.93 + r() * 0.07; const side = r() < 0.5 ? -1 : 1; const bx = side * hwAt(t, side > 0 ? 0 : 1); const u = r(); hair(out, inside, [bx, yAt(t)], Math.PI / 2 + (r() - 0.5) * 1.2, RL * (0.2 + 0.8 * u * u), 0.7, penR, r); }
        } else if (kind === "Carrot" || kind === "Sugar beet") {
          hair(out, inside, bottom, Math.PI / 2 + (r() - 0.5) * 0.3, RL * (0.6 + r() * 0.4), 0.7, penR, r);
          const n = Math.round(rootsD * 22), t0 = kind === "Carrot" ? 0.15 : 0.4;
          for (let i = 0; i < n; i++) { const t = t0 + r() * (0.97 - t0); const side = r() < 0.5 ? -1 : 1; const bx = side * hwAt(t, side > 0 ? 0 : 1); hair(out, inside, [bx, yAt(t)], side > 0 ? 0.55 : Math.PI - 0.55, RL * (0.1 + r() * 0.25), 1.2, penR, r); }
        } else { /* Turnip, Swede */
          hair(out, inside, bottom, Math.PI / 2 + (r() - 0.5) * 0.3, RL * (0.4 + r() * 0.4), 0.8, penR, r);
          const n = Math.round(rootsD * 7);
          for (let i = 0; i < n; i++) { const t = 0.8 + r() * 0.17; const side = r() < 0.5 ? -1 : 1; const bx = side * hwAt(t, side > 0 ? 0 : 1); hair(out, inside, [bx, yAt(t)], side > 0 ? 0.9 : Math.PI - 0.9, RL * (0.1 + r() * 0.25), 1.2, penR, r); }
        }
      }
      return { body: bodyOut, parts: out };
    };

    /* ---------------- placement ---------------- */
    const rot = (list, ca, sa) => list.map((q) => ({ ...q, pts: q.pts.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]) }));
    const bboxOf = (lists) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of lists) for (const [x, y] of q.pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };
    const noOv = p.place !== "Loose (may overlap)";
    const target = Math.max(1, Math.round(p.count));
    const placed = [];
    let guard = 0, made = 0;
    /* Mix: a seeded shuffle of all kinds, cycled — every kind appears before any repeats */
    const order = KINDS.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    while (made < target && guard++ < target * 12 && pts < BUDGET) {
      const kind = p.kind === "Mix" ? order[made % order.length] : (PROF[p.kind] ? p.kind : "Carrot");
      const h = Math.max(4, p.size * (1 - Math.max(0, Math.min(1, p.sizeVar)) * rng()));
      const spec = specimen(kind, h, rng);
      let ang = 0;
      if (p.rotation === "Tilt") ang = (rng() * 2 - 1) * (Math.max(0, p.tilt) * Math.PI) / 180;
      else if (p.rotation === "Random") ang = rng() * TWO_PI;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const body = rot(spec.body, ca, sa), parts = rot(spec.parts, ca, sa);
      const bb = noOv ? bboxOf([...body, ...parts]) : bboxOf(body);
      const bw = bb[2] - bb[0], bh = bb[3] - bb[1];
      if (bw > W - 2 * m || bh > H - 2 * m) continue;
      /* try many positions for this specimen before growing a new one */
      let cx = 0, cy = 0, box = null, ok = false;
      for (let tries = 0; tries < 80 && !ok; tries++) {
        cx = m - bb[0] + rng() * (W - 2 * m - bw); cy = m - bb[1] + rng() * (H - 2 * m - bh);
        box = [bb[0] + cx, bb[1] + cy, bb[2] + cx, bb[3] + cy];
        ok = true;
        for (const q of placed) { if (noOv ? !(box[2] + 1 < q[0] || box[0] - 1 > q[2] || box[3] + 1 < q[1] || box[1] - 1 > q[3]) : Math.hypot((box[0] + box[2]) / 2 - (q[0] + q[2]) / 2, (box[1] + box[3]) / 2 - (q[1] + q[3]) / 2) < 0.35 * Math.min(bw + q[2] - q[0], bh + q[3] - q[1])) { ok = false; break; } }
      }
      if (!ok) continue;
      placed.push(box);
      for (const q of [...body, ...parts]) { paths.push({ pts: q.pts.map(([x, y]) => [x + cx, y + cy]), closed: q.closed, layer: q.layer }); pts += q.pts.length; }
      made++;
    }
    /* clamp to sheet (Loose placement measures the body only, tops may poke out) */
    for (const q of paths) q.pts = q.pts.map(([x, y]) => [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
    return applyStyle({ paths }, ins && ins[0]);
  },
};
