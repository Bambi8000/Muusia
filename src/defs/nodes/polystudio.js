import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "polystudio",
  name: "Polyhedron Studio",
  cat: "gen",
  group: "space",
  desc: "Polyhedra rendered face by face in 3D. The catalogue is generated rather than tabulated: the five Platonic solids are exact, and every Archimedean and Catalan form is derived from them by three operators the node implements - rectify (edge midpoints), truncate (corner cutting) and dual (polar reciprocal) - so Cuboctahedron is a rectified cube, Rhombicosidodecahedron a twice-rectified icosahedron and Rhombic triacontahedron the dual of the icosidodecahedron, all with planar faces and no hand-typed coordinates. Prisms, antiprisms, pyramids and bipyramids take any side count; the Geodesic sphere subdivides an icosahedron 1-4 times onto the sphere. Every face is then filled IN ITS OWN PLANE before projection, so the pattern rides the perspective instead of lying flat on the paper: Concentric inset nests the face into itself (the signature look - pair it with Face inset for the white channel along every edge), Face hatch rules parallel lines at an angle, Spiral winds from the centroid out to the boundary, Nested rings, Centroid fan, and Dots. Back faces are culled by their true normal against the camera, or kept (Transparent), or thinned (X-ray) so the far side shows through as a lighter texture. Stellate raises each face on a pyramid along its normal - negative dimples it inward - and this reshapes the real solid, so it also reaches the Mesh output; Explode slides faces apart along their normals as a drawing convention only. Depth cue opens up the hatch on receding faces, and Even density divides the fill spacing by the foreshortening of each face, so a face seen almost edge-on thins out instead of collapsing into a solid sliver - the texture then reads evenly across the whole body. Three outputs: Faces (paths), Silhouette (the projected outline as one closed path, for a heavier pen or a cut line) and Mesh - the rotated, normalised triangle payload, so what you see on screen is exactly what Mesh Slice will cut. Rotations and Stellate are value ports: wire the Frame clock into Rotate Y for a turning solid.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Faces"), Pin("paths", "Silhouette"), Pin("mesh", "Mesh")],
  params: [
    { key: "shape", label: "Shape", type: "select", options: ["Tetrahedron", "Cube", "Octahedron", "Dodecahedron", "Icosahedron", "Truncated tetrahedron", "Truncated cube", "Truncated octahedron", "Truncated dodecahedron", "Truncated icosahedron", "Cuboctahedron", "Icosidodecahedron", "Rhombicuboctahedron", "Rhombicosidodecahedron", "Rhombic dodecahedron", "Rhombic triacontahedron", "Prism", "Antiprism", "Pyramid", "Bipyramid", "Geodesic sphere"], def: "Icosahedron" },
    { key: "sides", label: "Sides", type: "slider", min: 3, max: 16, step: 1, def: 6, showIf: (p) => p.shape === "Prism" || p.shape === "Antiprism" || p.shape === "Pyramid" || p.shape === "Bipyramid" },
    { key: "freq", label: "Frequency", type: "slider", min: 1, max: 4, step: 1, def: 2, showIf: (p) => p.shape === "Geodesic sphere" },
    { key: "size", label: "Size mm", type: "slider", min: 20, max: 260, step: 1, def: 150 },
    { key: "x", label: "X %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "y", label: "Y %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "rx", label: "Rotate X deg", type: "slider", min: -180, max: 180, step: 1, def: -22 },
    { key: "ry", label: "Rotate Y deg", type: "slider", min: -180, max: 180, step: 1, def: 32 },
    { key: "rz", label: "Rotate Z deg", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "vis", label: "Visibility", type: "select", options: ["Solid (hide back)", "Transparent", "X-ray (back thinned)"], def: "Solid (hide back)" },
    { key: "fill", label: "Face fill", type: "select", options: ["Concentric inset", "Face hatch", "Spiral", "Nested rings", "Centroid fan", "Dots", "None"], def: "Concentric inset" },
    { key: "step", label: "Fill step mm", type: "slider", min: 0.6, max: 12, step: 0.1, def: 2.4 },
    { key: "hatchAng", label: "Hatch angle deg", type: "slider", min: 0, max: 180, step: 1, def: 30, showIf: (p) => p.fill === "Face hatch" },
    { key: "dotSize", label: "Dot size mm", type: "slider", min: 0.3, max: 6, step: 0.1, def: 1, showIf: (p) => p.fill === "Dots" },
    { key: "inset", label: "Face inset mm", type: "slider", min: 0, max: 12, step: 0.1, def: 1.5 },
    { key: "edges", label: "Draw edges", type: "check", def: true },
    { key: "stellate", label: "Stellate", type: "slider", min: -0.6, max: 2, step: 0.02, def: 0 },
    { key: "explode", label: "Explode mm", type: "slider", min: 0, max: 60, step: 0.5, def: 0 },
    { key: "depthCue", label: "Depth cue", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "evenDensity", label: "Even density", type: "check", def: true },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
    { key: "pen2", label: "Edge / silhouette pen", type: "pen", def: 0 },
  ],

  overlay(p, ctx) {
    const cx = (ctx.W * p.x) / 100, cy = (ctx.H * p.y) / 100;
    return [{ kind: "circle", cx, cy, r: Math.max(2, p.size / 2) }, { kind: "point", x: cx, y: cy }];
  },

  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const EPS = 1e-7;
    /* ---------- vector helpers ---------- */
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const len = (a) => Math.sqrt(dot(a, a));
    const nrm = (a) => { const l = len(a); return l < EPS ? [0, 0, 1] : mul(a, 1 / l); };
    const centroid = (pts) => {
      const s = pts.reduce((a, q) => add(a, q), [0, 0, 0]);
      return mul(s, 1 / Math.max(1, pts.length));
    };
    /* Newell normal: correct for any planar polygon */
    const newell = (pts) => {
      let n = [0, 0, 0];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
      }
      return nrm(n);
    };
    /* every face wound so its normal points away from the body centre */
    const orient = (M) => {
      for (const f of M.f) {
        const pts = f.map((i) => M.v[i]);
        const c = centroid(pts);
        if (dot(newell(pts), c) < 0) f.reverse();
      }
      return M;
    };
    const rescale = (M) => {
      let mx = 0;
      for (const q of M.v) mx = Math.max(mx, len(q));
      if (mx > EPS) M.v = M.v.map((q) => mul(q, 1 / mx));
      return M;
    };
    const vkey = (q) => q.map((t) => Math.round(t * 1e5)).join(",");
    const weld = (M) => {
      const map = new Map(), nv = [], idx = [];
      M.v.forEach((q) => {
        const k = vkey(q);
        if (!map.has(k)) { map.set(k, nv.length); nv.push(q); }
        idx.push(map.get(k));
      });
      return { v: nv, f: M.f.map((f) => f.map((i) => idx[i])).filter((f) => new Set(f).size >= 3) };
    };
    /* neighbours of a vertex, ordered cyclically around its own direction */
    const ringOrder = (M, vi, items, dirOf) => {
      const axis = nrm(M.v[vi]);
      let ref = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const u = nrm(crs(axis, ref)), w = crs(axis, u);
      return items.slice().sort((a, b) => {
        const da = dirOf(a), db = dirOf(b);
        return Math.atan2(dot(da, w), dot(da, u)) - Math.atan2(dot(db, w), dot(db, u));
      });
    };
    const vertFaces = (M) => {
      const vf = M.v.map(() => []);
      M.f.forEach((f, fi) => f.forEach((i) => vf[i].push(fi)));
      return vf;
    };
    const vertNbrs = (M) => {
      const vn = M.v.map(() => new Set());
      for (const f of M.f) for (let i = 0; i < f.length; i++) {
        vn[f[i]].add(f[(i + 1) % f.length]);
        vn[f[i]].add(f[(i - 1 + f.length) % f.length]);
      }
      return vn.map((s) => [...s]);
    };
    /* ---------- the three operators ---------- */
    const rectify = (M) => {
      const mid = new Map(), nv = [];
      const key = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
      const getMid = (a, b) => {
        const k = key(a, b);
        if (!mid.has(k)) { mid.set(k, nv.length); nv.push(mul(add(M.v[a], M.v[b]), 0.5)); }
        return mid.get(k);
      };
      const nf = [];
      for (const f of M.f) nf.push(f.map((a, i) => getMid(a, f[(i + 1) % f.length])));
      const vn = vertNbrs(M);
      M.v.forEach((q, vi) => {
        const ring = ringOrder(M, vi, vn[vi], (n) => sub(mul(add(q, M.v[n]), 0.5), q));
        if (ring.length >= 3) nf.push(ring.map((n) => getMid(vi, n)));
      });
      return rescale(orient(weld({ v: nv, f: nf })));
    };
    const truncate = (M, t) => {
      const nv = [], key = new Map();
      const get = (a, b) => {
        const k = a + ">" + b;
        if (!key.has(k)) { key.set(k, nv.length); nv.push(add(M.v[a], mul(sub(M.v[b], M.v[a]), t))); }
        return key.get(k);
      };
      const nf = [];
      for (const f of M.f) {
        const poly = [];
        for (let i = 0; i < f.length; i++) {
          const a = f[i], pv = f[(i - 1 + f.length) % f.length], nx = f[(i + 1) % f.length];
          poly.push(get(a, pv), get(a, nx));
        }
        nf.push(poly);
      }
      const vn = vertNbrs(M);
      M.v.forEach((q, vi) => {
        const ring = ringOrder(M, vi, vn[vi], (n) => sub(M.v[n], q));
        if (ring.length >= 3) nf.push(ring.map((n) => get(vi, n)));
      });
      return rescale(orient(weld({ v: nv, f: nf })));
    };
    /* polar reciprocal: keeps the dual's faces planar (centroids do not) */
    const dual = (M) => {
      const nv = M.f.map((f) => {
        const pts = f.map((i) => M.v[i]);
        const n = newell(pts), d = dot(n, centroid(pts));
        return mul(n, 1 / Math.max(0.05, d));
      });
      const vf = vertFaces(M);
      const nf = [];
      M.v.forEach((q, vi) => {
        const ring = ringOrder(M, vi, vf[vi], (fi) => sub(nv[fi], q));
        if (ring.length >= 3) nf.push(ring.slice());
      });
      return rescale(orient(weld({ v: nv, f: nf })));
    };
    /* ---------- seed solids ---------- */
    const PHI = (1 + Math.sqrt(5)) / 2;
    const base = (name) => {
      if (name === "Tetrahedron") return { v: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], f: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]] };
      if (name === "Cube") return {
        v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
        f: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]],
      };
      if (name === "Octahedron") return {
        v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
        f: [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]],
      };
      /* Icosahedron */
      return {
        v: [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI],
        [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]],
        f: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
        [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
        [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]],
      };
    };
    const family = (kind, n) => {
      const v = [], f = [];
      const r = 1, hh = kind === "Prism" ? 0.9 : kind === "Antiprism" ? 0.85 : 1.25;
      const ring = (yy, off) => {
        const s = v.length;
        for (let i = 0; i < n; i++) {
          const a = ((i + off) / n) * Math.PI * 2;
          v.push([Math.cos(a) * r, yy, Math.sin(a) * r]);
        }
        return s;
      };
      if (kind === "Prism") {
        const a = ring(-hh / 2, 0), b = ring(hh / 2, 0);
        f.push(Array.from({ length: n }, (_, i) => a + i));
        f.push(Array.from({ length: n }, (_, i) => b + n - 1 - i));
        for (let i = 0; i < n; i++) f.push([a + i, a + (i + 1) % n, b + (i + 1) % n, b + i]);
      } else if (kind === "Antiprism") {
        const a = ring(-hh / 2, 0), b = ring(hh / 2, 0.5);
        f.push(Array.from({ length: n }, (_, i) => a + i));
        f.push(Array.from({ length: n }, (_, i) => b + n - 1 - i));
        for (let i = 0; i < n; i++) {
          f.push([a + i, a + (i + 1) % n, b + i]);
          f.push([b + i, a + (i + 1) % n, b + (i + 1) % n]);
        }
      } else if (kind === "Pyramid") {
        const a = ring(-hh / 3, 0);
        v.push([0, (hh * 2) / 3, 0]);
        const apex = v.length - 1;
        f.push(Array.from({ length: n }, (_, i) => a + i));
        for (let i = 0; i < n; i++) f.push([a + i, a + (i + 1) % n, apex]);
      } else {
        const a = ring(0, 0);
        v.push([0, hh, 0]); v.push([0, -hh, 0]);
        const up = v.length - 2, dn = v.length - 1;
        for (let i = 0; i < n; i++) {
          f.push([a + i, a + (i + 1) % n, up]);
          f.push([a + (i + 1) % n, a + i, dn]);
        }
      }
      return rescale(orient({ v, f }));
    };
    const geodesic = (freq) => {
      let M = base("Icosahedron");
      M.v = M.v.map(nrm);
      for (let s = 0; s < freq - 1; s++) {
        const nv = M.v.slice(), mid = new Map(), nf = [];
        const gm = (a, b) => {
          const k = a < b ? a + "_" + b : b + "_" + a;
          if (!mid.has(k)) { mid.set(k, nv.length); nv.push(nrm(mul(add(M.v[a], M.v[b]), 0.5))); }
          return mid.get(k);
        };
        for (const f of M.f) {
          const [a, b, c] = f;
          const ab = gm(a, b), bc = gm(b, c), ca = gm(c, a);
          nf.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
        }
        M = { v: nv, f: nf };
      }
      return rescale(orient(M));
    };
    const buildShape = (name) => {
      const n = Math.max(3, Math.min(16, Math.round(p.sides)));
      switch (name) {
        case "Tetrahedron": case "Cube": case "Octahedron": case "Icosahedron":
          return rescale(orient(base(name)));
        case "Dodecahedron": return dual(rescale(orient(base("Icosahedron"))));
        case "Truncated tetrahedron": return truncate(rescale(orient(base("Tetrahedron"))), 1 / 3);
        case "Truncated cube": return truncate(rescale(orient(base("Cube"))), 1 - Math.SQRT1_2 * 0.828);
        case "Truncated octahedron": return truncate(rescale(orient(base("Octahedron"))), 1 / 3);
        case "Truncated icosahedron": return truncate(rescale(orient(base("Icosahedron"))), 1 / 3);
        case "Truncated dodecahedron": return truncate(dual(rescale(orient(base("Icosahedron")))), 0.28);
        case "Cuboctahedron": return rectify(rescale(orient(base("Cube"))));
        case "Icosidodecahedron": return rectify(rescale(orient(base("Icosahedron"))));
        case "Rhombicuboctahedron": return rectify(rectify(rescale(orient(base("Cube")))));
        case "Rhombicosidodecahedron": return rectify(rectify(rescale(orient(base("Icosahedron")))));
        case "Rhombic dodecahedron": return dual(rectify(rescale(orient(base("Cube")))));
        case "Rhombic triacontahedron": return dual(rectify(rescale(orient(base("Icosahedron")))));
        case "Prism": case "Antiprism": case "Pyramid": case "Bipyramid": return family(name, n);
        default: return geodesic(Math.max(1, Math.min(4, Math.round(p.freq))));
      }
    };

    let M;
    try { M = buildShape(p.shape); } catch (e) { return EMPTY; }
    if (!M || !M.v.length || !M.f.length) return EMPTY;

    /* ---------- stellation reshapes the real solid ---------- */
    const st = Math.max(-0.6, Math.min(2, p.stellate));
    if (Math.abs(st) > 0.005) {
      const nv = M.v.slice(), nf = [];
      for (const f of M.f) {
        const pts = f.map((i) => M.v[i]);
        const c = centroid(pts), nn = newell(pts);
        let inr = Infinity;
        for (let i = 0; i < pts.length; i++) inr = Math.min(inr, len(sub(pts[i], c)));
        nv.push(add(c, mul(nn, st * (isFinite(inr) ? inr : 0.3))));
        const apex = nv.length - 1;
        for (let i = 0; i < f.length; i++) nf.push([f[i], f[(i + 1) % f.length], apex]);
      }
      M = orient({ v: nv, f: nf });
    }

    /* ---------- rotate ---------- */
    const ax = (p.rx * Math.PI) / 180, ay = (p.ry * Math.PI) / 180, az = (p.rz * Math.PI) / 180;
    const cX = Math.cos(ax), sX = Math.sin(ax), cY = Math.cos(ay), sY = Math.sin(ay), cZ = Math.cos(az), sZ = Math.sin(az);
    const rot = ([x, y, z]) => {
      const y1 = y * cX - z * sX, z1 = y * sX + z * cX;
      const x2 = x * cY + z1 * sY, z2 = -x * sY + z1 * cY;
      return [x2 * cZ - y1 * sZ, x2 * sZ + y1 * cZ, z2];
    };
    const S = Math.max(10, p.size) / 2;
    const RV = M.v.map((q) => mul(rot(q), S));

    /* ---------- project ---------- */
    const ccx = (W * Math.max(0, Math.min(100, p.x))) / 100;
    const ccy = (H * Math.max(0, Math.min(100, p.y))) / 100;
    const camD = S * (6 - 4.6 * Math.max(0, Math.min(1, p.persp)));
    const cam = [0, 0, -camD];
    const proj = ([x, y, z]) => {
      const f = p.persp > 0 ? camD / Math.max(camD * 0.15, camD + z) : 1;
      return [ccx + x * f, ccy + y * f];
    };

    const L = Math.round(p.layer), L2 = Math.round(p.pen2);
    const paths = [];
    const BUDGET = 115000;
    let total = 0;
    const emit = (pts2, closed, layer) => {
      if (pts2.length < 2 || total > BUDGET) return;
      total += pts2.length;
      paths.push({ pts: pts2, closed: !!closed, layer });
    };
    const emit3 = (pts3, closed, layer) => emit(pts3.map(proj), closed, layer);

    /* ---------- per-face work ---------- */
    const step0 = Math.max(0.6, p.step);
    const inset0 = Math.max(0, p.inset);
    const cue = Math.max(0, Math.min(1, p.depthCue));
    const explode = Math.max(0, p.explode);
    const dotR = Math.max(0.15, p.dotSize / 2);
    const hAng = (p.hatchAng * Math.PI) / 180;
    const mode = p.fill;
    const vis = p.vis;

    /* depth range for the cue */
    let zMin = Infinity, zMax = -Infinity;
    for (const q of RV) { zMin = Math.min(zMin, q[2]); zMax = Math.max(zMax, q[2]); }
    const zSpan = Math.max(1e-6, zMax - zMin);

    const faces = M.f.map((f) => {
      const pts = f.map((i) => RV[i]);
      const c = centroid(pts);
      const n = newell(pts);
      return { f, pts, c, n, front: dot(n, sub(c, cam)) < 0 };
    });
    /* painter order: far faces first, so a transparent stack reads correctly */
    faces.sort((a, b) => b.c[2] - a.c[2]);

    for (const F of faces) {
      if (total > BUDGET) break;
      if (!F.front && vis === "Solid (hide back)") continue;
      const thin = !F.front && vis === "X-ray (back thinned)" ? 2.2 : 1;
      const depth = 1 + cue * 1.6 * ((F.c[2] - zMin) / zSpan);
      /* foreshortening: a face seen edge-on squeezes its fill into a sliver,
         so open the spacing by 1/cos and the density on PAPER stays even */
      const cosF = p.evenDensity
        ? Math.max(0.12, Math.abs(dot(F.n, nrm(sub(F.c, cam)))))
        : 1;
      const step = (step0 * thin * depth) / cosF;
      const layer = L;
      /* in-plane basis */
      const u = nrm(sub(F.pts[0], F.c));
      const w = nrm(crs(F.n, u));
      const to2 = (q) => { const d = sub(q, F.c); return [dot(d, u), dot(d, w)]; };
      const to3 = ([a, b]) => add(add(F.c, mul(u, a)), mul(w, b));
      const P2 = F.pts.map(to2);
      /* face offset for the exploded view */
      const off = explode > 0 ? mul(F.n, explode) : null;
      const place = (q3) => (off ? add(q3, off) : q3);
      /* inradius: centroid to the nearest edge, in plane */
      let inr = Infinity;
      for (let i = 0; i < P2.length; i++) {
        const a = P2[i], b = P2[(i + 1) % P2.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const l2 = ex * ex + ey * ey;
        if (l2 < EPS) continue;
        inr = Math.min(inr, Math.abs(ex * (0 - a[1]) - ey * (0 - a[0])) / Math.sqrt(l2));
      }
      if (!isFinite(inr) || inr < 0.05) continue;
      const shrink = (k) => P2.map(([a, b]) => [a * k, b * k]);
      const kIn = Math.max(0, 1 - inset0 / inr);
      const OUT = shrink(kIn);
      if (kIn > 0.02) emit3(OUT.map((q) => place(to3(q))), true, layer);
      const inside = (x, y) => {
        let c2 = false;
        for (let i = 0, j = OUT.length - 1; i < OUT.length; j = i++) {
          const [xi, yi] = OUT[i], [xj, yj] = OUT[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c2 = !c2;
        }
        return c2;
      };
      const inrIn = inr * kIn;
      if (mode === "None" || kIn <= 0.02) { /* outline only */ }
      else if (mode === "Concentric inset") {
        for (let d = step; d < inrIn - 0.05; d += step) {
          const k = 1 - d / inrIn;
          if (k <= 0.02) break;
          emit3(OUT.map(([a, b]) => place(to3([a * k, b * k]))), true, layer);
        }
      } else if (mode === "Face hatch") {
        const ca = Math.cos(hAng), sa = Math.sin(hAng);
        let rMax = 0;
        for (const [a, b] of OUT) rMax = Math.max(rMax, Math.hypot(a, b));
        let li = 0;
        for (let d = -rMax; d <= rMax; d += step, li++) {
          /* line: origin + t*(ca,sa) offset by d along the normal (-sa,ca) */
          const ox = -sa * d, oy = ca * d;
          const hits = [];
          for (let i = 0; i < OUT.length; i++) {
            const A = OUT[i], B = OUT[(i + 1) % OUT.length];
            const ex = B[0] - A[0], ey = B[1] - A[1];
            const den = ex * sa - ey * ca;
            if (Math.abs(den) < 1e-9) continue;
            const s = ((ox - A[0]) * sa - (oy - A[1]) * ca) / den;
            if (s < -1e-9 || s > 1 + 1e-9) continue;
            const px = A[0] + ex * s, py = A[1] + ey * s;
            hits.push((px - ox) * ca + (py - oy) * sa);
          }
          if (hits.length < 2) continue;
          hits.sort((a, b) => a - b);
          const t0 = hits[0], t1 = hits[hits.length - 1];
          if (t1 - t0 < 0.05) continue;
          const A3 = place(to3([ox + ca * t0, oy + sa * t0]));
          const B3 = place(to3([ox + ca * t1, oy + sa * t1]));
          emit3(li % 2 ? [B3, A3] : [A3, B3], false, layer);
        }
      } else if (mode === "Spiral") {
        const turns = Math.max(1, Math.round(inrIn / step));
        const seg = Math.max(24, Math.min(720, turns * 24));
        const pts3 = [];
        for (let i = 0; i <= turns * seg; i++) {
          const t = i / (turns * seg);
          const a = t * turns * Math.PI * 2;
          /* boundary distance at this angle keeps the spiral inside the face */
          let bd = inrIn;
          const cxr = Math.cos(a), syr = Math.sin(a);
          for (let e = 0; e < OUT.length; e++) {
            const A = OUT[e], B = OUT[(e + 1) % OUT.length];
            const ex = B[0] - A[0], ey = B[1] - A[1];
            const den = cxr * ey - syr * ex;
            if (Math.abs(den) < 1e-9) continue;
            const s = (cxr * (A[1] - 0) - syr * (A[0] - 0)) / -den;
            if (s < 0 || s > 1) continue;
            const px = A[0] + ex * s, py = A[1] + ey * s;
            const rr = px * cxr + py * syr;
            if (rr > 0) bd = Math.min(bd === inrIn ? Infinity : bd, rr);
          }
          if (!isFinite(bd)) bd = inrIn;
          pts3.push(place(to3([Math.cos(a) * bd * t * 0.96, Math.sin(a) * bd * t * 0.96])));
          if (pts3.length > 4000) break;
        }
        emit3(pts3, false, layer);
      } else if (mode === "Nested rings") {
        for (let r = step; r < inrIn; r += step) {
          const n2 = Math.max(12, Math.ceil((Math.PI * 2 * r) / 1.2));
          const ring = [];
          for (let i = 0; i < n2; i++) {
            const a = (i / n2) * Math.PI * 2;
            ring.push(place(to3([Math.cos(a) * r, Math.sin(a) * r])));
          }
          emit3(ring, true, layer);
        }
      } else if (mode === "Centroid fan") {
        let per = 0;
        for (let i = 0; i < OUT.length; i++) per += Math.hypot(OUT[(i + 1) % OUT.length][0] - OUT[i][0], OUT[(i + 1) % OUT.length][1] - OUT[i][1]);
        const n2 = Math.max(3, Math.min(400, Math.round(per / step)));
        let acc = 0;
        for (let k = 0; k < n2; k++) {
          const t = (k / n2) * per;
          let run = 0, pt = OUT[0];
          for (let i = 0; i < OUT.length; i++) {
            const A = OUT[i], B = OUT[(i + 1) % OUT.length];
            const d = Math.hypot(B[0] - A[0], B[1] - A[1]);
            if (run + d >= t) { const s = (t - run) / Math.max(EPS, d); pt = [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s]; break; }
            run += d;
          }
          acc++;
          /* stop short of the centroid: a hard convergence point floods the
             paper with ink and tears the paper on a real plotter */
          const A3 = place(to3([pt[0] * 0.12, pt[1] * 0.12]));
          const B3 = place(to3(pt));
          emit3(acc % 2 ? [A3, B3] : [B3, A3], false, layer);
        }
      } else if (mode === "Dots") {
        let rMax = 0;
        for (const [a, b] of OUT) rMax = Math.max(rMax, Math.hypot(a, b));
        const g = Math.max(step, dotR * 2.2);
        for (let yy = -rMax; yy <= rMax; yy += g * 0.87) {
          const rowOff = (Math.round(yy / (g * 0.87)) % 2) * g * 0.5;
          for (let xx = -rMax + rowOff; xx <= rMax; xx += g) {
            if (!inside(xx, yy)) continue;
            const n2 = 12, ring = [];
            for (let i = 0; i < n2; i++) {
              const a = (i / n2) * Math.PI * 2;
              ring.push(place(to3([xx + Math.cos(a) * dotR, yy + Math.sin(a) * dotR])));
            }
            emit3(ring, true, layer);
            if (total > BUDGET) break;
          }
          if (total > BUDGET) break;
        }
      }
      /* true edges, drawn full length on their own pen */
      if (p.edges && (F.front || vis !== "Solid (hide back)")) {
        emit3(F.pts.map(place), true, L2);
      }
    }

    /* ---------- silhouette: 2D hull of the projected body ---------- */
    const silPaths = [];
    {
      const pts = RV.map(proj);
      const idx = pts.map((_, i) => i).sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
      const cross2 = (o, a, b) => (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
      const lower = [], upper = [];
      for (const i of idx) {
        while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
        lower.push(i);
      }
      for (let q = idx.length - 1; q >= 0; q--) {
        const i = idx[q];
        while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
        upper.push(i);
      }
      const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
      if (hull.length >= 3) silPaths.push({ pts: hull.map((i) => pts[i]), closed: true, layer: L2 });
    }

    /* ---------- mesh payload: rotated, normalised, fan-triangulated ---------- */
    let mesh = null;
    {
      const tris = [];
      for (const f of M.f) for (let i = 1; i + 1 < f.length; i++) tris.push([f[0], f[i], f[i + 1]]);
      if (tris.length) {
        let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (const q of RV) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]); }
        const dim = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
        const big = Math.max(dim[0], dim[1], dim[2]) || 1;
        const mid = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
        const r4 = (t) => Math.round(t * 1e4) / 1e4;
        const v = [];
        for (const t of tris) for (const i of t) {
          v.push(r4((RV[i][0] - mid[0]) / big), r4((RV[i][1] - mid[1]) / big), r4((RV[i][2] - mid[2]) / big));
        }
        mesh = { kind: "mesh", tri: tris.length, v, dims: [r4(dim[0] / big), r4(dim[1] / big), r4(dim[2] / big)] };
      }
    }

    const styled = applyStyle({ paths }, ins[0]);
    return [styled, applyStyle({ paths: silPaths }, ins[0]), mesh];
  },
};
