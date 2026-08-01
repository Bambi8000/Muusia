({
  key: "nanotubes",
  name: "Nanotubes",
  cat: "gen",
  group: "scientific",
  desc: "3D carbon structures as wireframe bond networks: Fullerene C60 (exact truncated-icosahedron coordinates - 60 atoms, 90 bonds, 12 pentagons among the hexagons), Nanotube armchair (n,n) and zigzag (n,0) built by rolling a real honeycomb lattice into a cylinder (n sets the diameter, Tube length the rows), Graphene sheet, Nanotorus (the lattice closed in both directions) and Onion (nested C60 shells). Yaw and Pitch rotate the model - wire Frame into Yaw for a spinning molecule - and Perspective runs from isometric to wide-angle. Render Front half culls bonds facing away by surface normal for a solid look; Atom dots marks the carbons (front side only in Front half).",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "type", label: "Structure", type: "select", options: ["Fullerene C60", "Nanotube armchair", "Nanotube zigzag", "Graphene sheet", "Nanotorus", "Onion C60"], def: "Fullerene C60" },
    { key: "n", label: "Tube index n", type: "slider", min: 4, max: 16, step: 1, def: 8 },
    { key: "tlen", label: "Tube length (rows)", type: "slider", min: 3, max: 40, step: 1, def: 14 },
    { key: "shells", label: "Onion shells", type: "slider", min: 2, max: 4, step: 1, def: 3 },
    { key: "yaw", label: "Yaw \u00b0", type: "slider", min: 0, max: 360, step: 1, def: 25 },
    { key: "pitch", label: "Pitch \u00b0", type: "slider", min: -90, max: 90, step: 1, def: 18 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35 },
    { key: "size", label: "Size mm", type: "slider", min: 20, max: 260, step: 1, def: 120 },
    { key: "render", label: "Render", type: "select", options: ["Transparent", "Front half"], def: "Transparent" },
    { key: "atoms", label: "Atom dots", type: "check", def: false },
    { key: "atomR", label: "Dot radius mm", type: "slider", min: 0.2, max: 2.5, step: 0.05, def: 0.7 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
    const nIdx = Math.max(3, Math.round(p.n));
    const rows = Math.max(2, Math.round(p.tlen));

    /* ============ structure builders: atoms [x,y,z], normals [nx,ny,nz] ==== */
    const S3 = Math.sqrt(3);
    const buildC60 = (scale, atoms, normals) => {
      const PHI = (1 + Math.sqrt(5)) / 2;
      const fams = [
        [0, 1, 3 * PHI],
        [1, 2 + PHI, 2 * PHI],
        [PHI, 2, 2 * PHI + 1],
      ];
      const seen = new Set();
      for (const [a, b, c] of fams) {
        for (const perm of [[a, b, c], [b, c, a], [c, a, b]]) {
          for (const s1 of [1, -1]) for (const s2 of [1, -1]) for (const s3 of [1, -1]) {
            const v = [perm[0] * s1, perm[1] * s2, perm[2] * s3];
            const k = v.map((q) => q.toFixed(6)).join(",");
            if (seen.has(k)) continue;
            seen.add(k);
            atoms.push(v.map((q) => q * scale));
            const nl = Math.hypot(v[0], v[1], v[2]) || 1;
            normals.push([v[0] / nl, v[1] / nl, v[2] / nl]);
          }
        }
      }
    };
    /* honeycomb generator in chiral-vector frame: u along circumference,
       v along the axis. armchair: |C| = 3n; zigzag: |C| = sqrt3 * n. */
    const honeycomb = (armchair, cols, vRows) => {
      /* lattice in (u,v): armchair rows repeat with period 3 along u? Build
         via standard a1/a2 basis then rotate so C is along u. */
      const a1 = [S3, 0], a2 = [S3 / 2, 1.5];
      const A = [], B = [];
      for (let i = -1; i <= cols + 1; i++) {
        for (let j = -1; j <= vRows + 1; j++) {
          A.push([i * a1[0] + j * a2[0], i * a1[1] + j * a2[1]]);
          B.push([i * a1[0] + j * a2[0], i * a1[1] + j * a2[1] + 1]);
        }
      }
      const pts = [...A.map((q) => [q[0], q[1], 0]), ...B.map((q) => [q[0], q[1], 1])];
      if (!armchair) return pts.map(([x, y]) => [x, y]);
      /* armchair: rotate -30deg so C = n*(a1+a2) lies along u */
      const ca = Math.cos(-Math.PI / 6), sa = Math.sin(-Math.PI / 6);
      return pts.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
    };
    const dedupe = (raw, keep) => {
      const outPts = [];
      const seen = new Map();
      const kk = (v) => (Math.round(v * 1e4) / 1e4 + 0).toFixed(4); /* kills -0 */
      for (const q of raw) {
        if (!keep(q)) continue;
        const k = kk(q[0]) + "," + kk(q[1]);
        if (seen.has(k)) continue;
        seen.set(k, outPts.length);
        outPts.push(q);
      }
      return outPts;
    };
    /* bonds on the flat lattice under a wraparound metric, then prune any
       dangling degree<=1 atoms (open tube ends leave whiskers) */
    const latticeGraph = (flat, wrapU, wrapV) => {
      const du = (a, b) => { let d = Math.abs(a - b); if (wrapU) d = Math.min(d, wrapU - d); return d; };
      const dv = (a, b) => { let d = Math.abs(a - b); if (wrapV) d = Math.min(d, wrapV - d); return d; };
      let pts = flat.map((q) => q.slice());
      let edges = [];
      for (;;) {
        edges = [];
        const deg = pts.map(() => 0);
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const d = Math.hypot(du(pts[i][0], pts[j][0]), dv(pts[i][1], pts[j][1]));
            if (Math.abs(d - 1) < 0.02) { edges.push([i, j]); deg[i]++; deg[j]++; }
          }
        }
        if (!pts.length || deg.every((d) => d >= 2)) break;
        pts = pts.filter((_, i) => deg[i] >= 2);
      }
      return { pts, edges };
    };
    const modWrap = (q, wrapU, wrapV) => [
      wrapU ? ((q[0] % wrapU) + wrapU) % wrapU : q[0],
      wrapV ? ((q[1] % wrapV) + wrapV) % wrapV : q[1],
    ];
    const buildTube = (armchair, torus, atoms, normals) => {
      const circ = armchair ? 3 * nIdx : S3 * nIdx;
      const R = circ / (2 * Math.PI);
      const per = torus ? 3 * Math.max(2, Math.round(rows / 3)) : 0;
      const raw = honeycomb(armchair, Math.ceil(circ / S3) + Math.ceil(rows) + 4, rows + 3)
        .map((q) => modWrap(q, circ, per));
      const flat = dedupe(raw, (q) => q[0] >= -1e-4 && q[0] < circ - 1e-4 &&
        (torus ? q[1] >= -1e-4 && q[1] < per - 1e-4 : q[1] >= -1e-4 && q[1] <= rows * 1.5 + 1e-4));
      const g = latticeGraph(flat, circ, per);
      if (torus) {
        const R0 = per / (2 * Math.PI) + R * 1.2;
        for (const [u, v] of g.pts) {
          const a = (u / circ) * Math.PI * 2;
          const b = (v / per) * Math.PI * 2;
          const rr = R0 + Math.cos(a) * R;
          atoms.push([Math.cos(b) * rr, Math.sin(b) * rr, Math.sin(a) * R]);
          normals.push([Math.cos(b) * Math.cos(a), Math.sin(b) * Math.cos(a), Math.sin(a)]);
        }
      } else {
        const vSpan = rows * 1.5;
        for (const [u, v] of g.pts) {
          const a = (u / circ) * Math.PI * 2;
          atoms.push([Math.cos(a) * R, v - vSpan / 2, Math.sin(a) * R]);
          normals.push([Math.cos(a), 0, Math.sin(a)]);
        }
      }
      return g.edges;
    };
    const buildSheet = (atoms, normals) => {
      const cols = Math.ceil(nIdx * 1.5), vRows = rows;
      const raw = honeycomb(false, cols, vRows);
      const flat = dedupe(raw, (q) => q[0] >= -1e-4 && q[0] <= cols * S3 + 1e-4 && q[1] >= -1e-4 && q[1] <= vRows * 1.5 + 1e-4);
      const g = latticeGraph(flat, 0, 0);
      let cx = 0, cy = 0;
      for (const q of g.pts) { cx += q[0]; cy += q[1]; }
      cx /= g.pts.length || 1; cy /= g.pts.length || 1;
      for (const [u, v] of g.pts) {
        atoms.push([u - cx, v - cy, 0]);
        normals.push([0, 0, 1]);
      }
      return g.edges;
    };
    const fullerEdges = (atoms, off) => {
      const per = 60;
      let dmin = Infinity;
      for (let i = 0; i < per; i++) for (let j = i + 1; j < per; j++) {
        const d = Math.hypot(atoms[off + i][0] - atoms[off + j][0], atoms[off + i][1] - atoms[off + j][1], atoms[off + i][2] - atoms[off + j][2]);
        if (d < dmin) dmin = d;
      }
      const out = [];
      for (let i = 0; i < per; i++) for (let j = i + 1; j < per; j++) {
        const d = Math.hypot(atoms[off + i][0] - atoms[off + j][0], atoms[off + i][1] - atoms[off + j][1], atoms[off + i][2] - atoms[off + j][2]);
        if (d < dmin * 1.01) out.push([off + i, off + j]);
      }
      return out;
    };
    /* ---- assemble atoms + normals + edges for the chosen structure ---- */
    const atoms = [], normals = [];
    let edges = [];
    if (p.type === "Fullerene C60") { buildC60(1, atoms, normals); edges = fullerEdges(atoms, 0); }
    else if (p.type === "Onion C60") {
      const k = Math.max(2, Math.round(p.shells));
      for (let s = 0; s < k; s++) {
        const off = atoms.length;
        buildC60(1 + s * 0.62, atoms, normals);
        edges = edges.concat(fullerEdges(atoms, off));
      }
    } else if (p.type === "Nanotube armchair") edges = buildTube(true, false, atoms, normals);
    else if (p.type === "Nanotube zigzag") edges = buildTube(false, false, atoms, normals);
    else if (p.type === "Nanotorus") edges = buildTube(false, true, atoms, normals);
    else edges = buildSheet(atoms, normals);
    if (!atoms.length || !edges.length) return applyStyle({ paths: [] }, ins[0]);

    /* ---- project ---- */
    const yaw = (p.yaw * Math.PI) / 180, pit = (p.pitch * Math.PI) / 180;
    const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw);
    const cp2 = Math.cos(pit), sp2 = Math.sin(pit);
    const rot3 = ([x, y, z]) => {
      const x1 = x * cy2 + z * sy2, z1 = -x * sy2 + z * cy2;
      const y2 = y * cp2 - z1 * sp2, z2 = y * sp2 + z1 * cp2;
      return [x1, y2, z2];
    };
    const rpts = atoms.map(rot3);
    const rnorm = normals.map(rot3);
    let rMax = 0;
    for (const q of rpts) rMax = Math.max(rMax, Math.hypot(q[0], q[1], q[2]));
    const camD = rMax * (1.2 + 6 * (1 - Math.min(1, Math.max(0, p.persp))));
    const proj = (q) => {
      const f = camD / Math.max(camD * 0.2, camD - q[2]);
      return [q[0] * f, q[1] * f, q[2]];
    };
    const ppts = rpts.map(proj);
    /* fit into margins at Size */
    let x0f = Infinity, x1f = -Infinity, y0f = Infinity, y1f = -Infinity;
    for (const q of ppts) { x0f = Math.min(x0f, q[0]); x1f = Math.max(x1f, q[0]); y0f = Math.min(y0f, q[1]); y1f = Math.max(y1f, q[1]); }
    const s = Math.min(p.size, W - 2 * m, H - 2 * m) / Math.max(x1f - x0f, y1f - y0f, 1e-6);
    const ox = W / 2 - ((x0f + x1f) / 2) * s;
    const oy = H / 2 - ((y0f + y1f) / 2) * s;
    const P2 = (i) => [ppts[i][0] * s + ox, ppts[i][1] * s + oy];

    const frontOnly = p.render === "Front half";
    const visible = (i, j) => {
      if (!frontOnly) return true;
      return (rnorm[i][2] + rnorm[j][2]) / 2 > -0.05;
    };
    const L = Math.round(p.layer);
    const paths = [];
    for (const [i, j] of edges) {
      if (!visible(i, j)) continue;
      paths.push({ pts: [P2(i), P2(j)], closed: false, layer: L });
    }
    if (p.atoms) {
      const r = Math.max(0.15, p.atomR);
      for (let i = 0; i < atoms.length; i++) {
        if (frontOnly && rnorm[i][2] < -0.05) continue;
        const [x, y] = P2(i);
        const cpts = [];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          cpts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        paths.push({ pts: cpts, closed: true, layer: L });
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
})
