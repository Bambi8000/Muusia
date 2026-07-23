import { Pin, PENS, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "pointcloud",
  name: "Point Cloud",
  cat: "gen",
  group: "textimg",
  desc: "3D point clouds projected to the sheet. Source: a file (.xyz / .csv / .txt with x y z per line, or ascii PLY) or a built-in parametric cloud (Torus, Sphere, Cube, Octahedron, Pyramid, Spring, Mobius, Trefoil, Klein bottle, Roman surface, Helicoid, Wave sheet, Galaxy). Keep size scales by the rotation-invariant 3D bounding sphere so the object stays the same size while Yaw/Pitch turn; Size % sets that locked scale (share of the margin box short side). Off = always fit to sheet. Bitcrush: Crush % randomly drops points (seeded), Quantize % snaps to a 3D grid - both act before meshing. Output: Dots, Wire (3D k-nearest mesh) or both; Max edge % trims jumps, Depth pens splits near-to-far across pens.",
  fileLabel: "Choose points…",
  fileAccept: ".xyz,.csv,.txt,.ply,.pts,.asc",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "source", label: "Source", type: "select", options: ["File", "Torus", "Sphere", "Cube", "Octahedron", "Pyramid", "Spring", "Mobius", "Trefoil", "Klein bottle", "Roman surface", "Helicoid", "Wave sheet", "Galaxy"], def: "Torus" },
    { key: "filename", label: "Point file (File)", type: "file", def: "" },
    { key: "output", label: "Output", type: "select", options: ["Dots", "Wire (3D mesh)", "Dots + wire"], def: "Dots" },
    { key: "maxPts", label: "Max points", type: "slider", min: 100, max: 6000, step: 100, def: 2000 },
    { key: "keepSize", label: "Keep size (no refit on rotate)", type: "check", def: false },
    { key: "size", label: "Size % (Keep size)", type: "slider", min: 10, max: 100, step: 1, def: 80 },
    { key: "crush", label: "Crush % (random drop)", type: "slider", min: 0, max: 95, step: 1, def: 0 },
    { key: "crushSeed", label: "Crush seed", type: "seed", def: 7 },
    { key: "quant", label: "Quantize % (3D grid)", type: "slider", min: 0, max: 10, step: 0.1, def: 0 },
    { key: "up", label: "Up axis (File)", type: "select", options: ["Z up", "Y up"], def: "Z up" },
    { key: "yaw", label: "Yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 30 },
    { key: "pitch", label: "Pitch deg", type: "slider", min: -90, max: 90, step: 1, def: 20 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "dot", label: "Dot size mm", type: "slider", min: 0.3, max: 4, step: 0.1, def: 0.8 },
    { key: "k", label: "Mesh neighbours k", type: "slider", min: 1, max: 8, step: 1, def: 3 },
    { key: "maxEdge", label: "Max edge % (0 = off)", type: "slider", min: 0, max: 30, step: 0.5, def: 6 },
    { key: "depthPens", label: "Depth pens", type: "slider", min: 1, max: 12, step: 1, def: 1 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 15 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  onFile(text) {
    const pts = [];
    let lines = text.split(/\r?\n/);
    let start = 0;
    if (/^ply\b/i.test((lines[0] || "").trim())) {
      let ascii = false, n = -1;
      for (let i = 1; i < Math.min(lines.length, 200); i++) {
        const l = lines[i].trim();
        if (/^format\s+ascii/i.test(l)) ascii = true;
        else if (/^format/i.test(l)) throw new Error("binary PLY not supported - export as ascii PLY");
        const m = l.match(/^element\s+vertex\s+(\d+)/i);
        if (m) n = +m[1];
        if (/^end_header/i.test(l)) { start = i + 1; break; }
      }
      if (!ascii) throw new Error("PLY: ascii format only");
      lines = n > 0 ? lines.slice(start, start + n) : lines.slice(start);
      start = 0;
    }
    for (let i = start; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || t[0] === "#" || t[0] === "/") continue;
      const nums = t.split(/[,;\s]+/).map(Number);
      if (nums.length >= 2 && Number.isFinite(nums[0]) && Number.isFinite(nums[1])) {
        pts.push([nums[0], nums[1], nums.length >= 3 && Number.isFinite(nums[2]) ? nums[2] : 0]);
      }
      if (pts.length >= 60000) break;
    }
    if (pts.length < 3) throw new Error("no points found (expect 'x y z' per line, or ascii PLY)");
    return { pts3: pts, count: pts.length };
  },
  compute(ins, p, ctx, node) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    if (W - 2 * m < 10 || H - 2 * m < 10) return applyStyle({ paths: [] }, ins[0]);
    const NMAX = Math.max(10, Math.round(p.maxPts));
    const TWO = Math.PI * 2;
    const f1 = (i) => (i * 0.6180339887) % 1;
    const f2 = (i) => (i * 0.7548776662) % 1;
    let cloud;
    if (p.source === "File") {
      cloud = node && node.data && node.data.svg && node.data.svg.pts3;
      if (!cloud || cloud.length < 3) return applyStyle({ paths: [] }, ins[0]);
    } else {
      cloud = [];
      const n = NMAX;
      for (let i = 0; i < n; i++) {
        if (p.source === "Torus") {
          const u = f1(i) * TWO, v = f2(i) * TWO;
          cloud.push([(30 + 12 * Math.cos(v)) * Math.cos(u), (30 + 12 * Math.cos(v)) * Math.sin(u), 12 * Math.sin(v)]);
        } else if (p.source === "Sphere") {
          const zc = 1 - (2 * i + 1) / n;
          const r = Math.sqrt(Math.max(0, 1 - zc * zc));
          const th = i * Math.PI * (3 - Math.sqrt(5));
          cloud.push([30 * r * Math.cos(th), 30 * r * Math.sin(th), 30 * zc]);
        } else if (p.source === "Cube") {
          const face = i % 6;
          const a = (f1(i) - 0.5) * 40, b = (f2(i) - 0.5) * 40, h = 20;
          if (face === 0) cloud.push([a, b, h]);
          else if (face === 1) cloud.push([a, b, -h]);
          else if (face === 2) cloud.push([a, h, b]);
          else if (face === 3) cloud.push([a, -h, b]);
          else if (face === 4) cloud.push([h, a, b]);
          else cloud.push([-h, a, b]);
        } else if (p.source === "Octahedron") {
          const o = i % 8;
          const sx = o & 1 ? -1 : 1, sy2 = o & 2 ? -1 : 1, sz2 = o & 4 ? -1 : 1;
          let a = f1(i), b = f2(i);
          if (a + b > 1) { a = 1 - a; b = 1 - b; }
          const c = 1 - a - b;
          const s = 28;
          cloud.push([sx * s * a, sy2 * s * b, sz2 * s * c]);
        } else if (p.source === "Pyramid") {
          const s = 24, hgt = 34;
          const face = i % 5;
          let a = f1(i), b = f2(i);
          if (face === 0) {
            cloud.push([(a - 0.5) * 2 * s, (b - 0.5) * 2 * s, 0]);
          } else {
            if (a + b > 1) { a = 1 - a; b = 1 - b; }
            const corners = [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]][face - 1];
            const [A, B] = corners;
            cloud.push([
              A[0] + (B[0] - A[0]) * a + (0 - (A[0] + (B[0] - A[0]) * a)) * b,
              A[1] + (B[1] - A[1]) * a + (0 - (A[1] + (B[1] - A[1]) * a)) * b,
              hgt * b,
            ]);
          }
        } else if (p.source === "Spring") {
          const t = f1(i) * 5 * TWO;
          const ta = f2(i) * TWO;
          const R = 20, tr = 5;
          const cx2 = R * Math.cos(t), cy2 = R * Math.sin(t), cz = (t / (5 * TWO) - 0.5) * 50;
          const rx = Math.cos(t), ry = Math.sin(t);
          cloud.push([cx2 + Math.cos(ta) * tr * rx, cy2 + Math.cos(ta) * tr * ry, cz + Math.sin(ta) * tr]);
        } else if (p.source === "Mobius") {
          const u = f1(i) * TWO, w = (f2(i) - 0.5) * 2;
          const R = 26, band = 10;
          const r = R + w * band * Math.cos(u / 2);
          cloud.push([r * Math.cos(u), r * Math.sin(u), w * band * Math.sin(u / 2)]);
        } else if (p.source === "Trefoil") {
          const t = f1(i) * TWO, ta = f2(i) * TWO;
          const sc2 = 9, tr = 3.5;
          const px = sc2 * (Math.sin(t) + 2 * Math.sin(2 * t));
          const py = sc2 * (Math.cos(t) - 2 * Math.cos(2 * t));
          const pz = sc2 * (-Math.sin(3 * t));
          const dx = sc2 * (Math.cos(t) + 4 * Math.cos(2 * t));
          const dy = sc2 * (-Math.sin(t) + 4 * Math.sin(2 * t));
          const dz = sc2 * (-3 * Math.cos(3 * t));
          const dl = Math.hypot(dx, dy, dz) || 1;
          let n1x = -dy / dl, n1y = dx / dl;
          const n1l = Math.hypot(n1x, n1y) || 1;
          n1x /= n1l; n1y /= n1l;
          const n2x = (dy / dl) * 0 - (dz / dl) * n1y;
          const n2y = (dz / dl) * n1x - (dx / dl) * 0;
          const n2z = (dx / dl) * n1y - (dy / dl) * n1x;
          cloud.push([
            px + tr * (Math.cos(ta) * n1x + Math.sin(ta) * n2x),
            py + tr * (Math.cos(ta) * n1y + Math.sin(ta) * n2y),
            pz + tr * (Math.sin(ta) * n2z),
          ]);
        } else if (p.source === "Klein bottle") {
          const u = f1(i) * TWO, v = f2(i) * TWO;
          const R = 18, band = 6;
          const w = Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v);
          cloud.push([
            (R + band * w) * Math.cos(u),
            (R + band * w) * Math.sin(u),
            band * (Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v)),
          ]);
        } else if (p.source === "Roman surface") {
          const u = f1(i) * TWO, v = f2(i) * Math.PI / 2;
          const s = 42;
          cloud.push([
            s * Math.cos(u) * Math.cos(v) * Math.sin(v),
            s * Math.sin(u) * Math.cos(v) * Math.sin(v),
            s * Math.cos(u) * Math.sin(u) * Math.cos(v) * Math.cos(v),
          ]);
        } else if (p.source === "Helicoid") {
          const u = (f1(i) - 0.5) * 2 * TWO;
          const v = (f2(i) - 0.5) * 2 * 22;
          cloud.push([v * Math.cos(u), v * Math.sin(u), u * 4.5]);
        } else if (p.source === "Wave sheet") {
          const u = (f1(i) - 0.5) * 2, v = (f2(i) - 0.5) * 2;
          cloud.push([u * 35, v * 35, Math.sin(u * 3.1) * Math.cos(v * 3.1) * 9]);
        } else {
          const arm = i % 2;
          const t = f1(i) * 3.1;
          const r = 5 + t * 10.5;
          const ang = t * 2.7 + arm * Math.PI + (hash2(i, arm, 51) - 0.5) * 0.5;
          const th = (hash2(i, 13, 97) - 0.5) * 5 * Math.max(0.25, 1 - t / 3.4);
          cloud.push([r * Math.cos(ang), r * Math.sin(ang), th]);
        }
      }
    }
    /* ---- quantize (bit depth) ---- */
    if (p.quant > 0.01) {
      let lo0 = [Infinity, Infinity, Infinity], hi0 = [-Infinity, -Infinity, -Infinity];
      for (const q of cloud) for (let a = 0; a < 3; a++) {
        if (q[a] < lo0[a]) lo0[a] = q[a];
        if (q[a] > hi0[a]) hi0[a] = q[a];
      }
      const dg = Math.hypot(hi0[0] - lo0[0], hi0[1] - lo0[1], hi0[2] - lo0[2]) || 1;
      const g = (p.quant / 100) * dg;
      const seen = new Set();
      const qz = [];
      for (const [x, y, z] of cloud) {
        const qx = Math.round(x / g) * g, qy = Math.round(y / g) * g, qz2 = Math.round(z / g) * g;
        const k2 = Math.round(qx / g) + "," + Math.round(qy / g) + "," + Math.round(qz2 / g);
        if (seen.has(k2)) continue;
        seen.add(k2);
        qz.push([qx, qy, qz2]);
      }
      cloud = qz;
      if (cloud.length < 3) return applyStyle({ paths: [] }, ins[0]);
    }
    /* ---- crush (sample rate) ---- */
    if (p.crush > 0.5) {
      const keep = 1 - p.crush / 100;
      const rng = mulberry32(p.crushSeed * 6151 + 11);
      const kept = cloud.filter(() => rng() < keep);
      if (kept.length >= 3) cloud = kept;
    }
    /* ---- stride to budget ---- */
    let P3 = cloud;
    if (cloud.length > NMAX) {
      const stride = cloud.length / NMAX;
      P3 = [];
      for (let i = 0; i < NMAX; i++) P3.push(cloud[Math.floor(i * stride)]);
    }
    const yUp = p.source === "File" && p.up === "Y up";
    let pts = P3.map(([x, y, z]) => (yUp ? [x, z, y] : [x, y, z]));
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const q of pts) for (let a = 0; a < 3; a++) {
      if (q[a] < lo[a]) lo[a] = q[a];
      if (q[a] > hi[a]) hi[a] = q[a];
    }
    const c3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
    const ya = (p.yaw * Math.PI) / 180, pa = (p.pitch * Math.PI) / 180;
    const cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
    const rot = pts.map(([x0, y0, z0]) => {
      const x = x0 - c3[0], y = y0 - c3[1], z = z0 - c3[2];
      const rx = x * cy - y * sy, ry = x * sy + y * cy;
      const ry2 = ry * cp - z * sp, rz = ry * sp + z * cp;
      return [rx, ry2, rz];
    });
    let dLo = Infinity, dHi = -Infinity;
    for (const q of rot) { if (q[1] < dLo) dLo = q[1]; if (q[1] > dHi) dHi = q[1]; }
    const dRange = dHi - dLo || 1;
    const proj = rot.map(([x, d, z]) => {
      const dn = (d - dLo) / dRange;
      const s = 1 / (1 + p.persp * dn * 1.4);
      return [x * s, -z * s, dn];
    });
    /* ---- placement: keep size (rotation-invariant sphere * Size %) or fit ---- */
    let scr;
    if (p.keepSize) {
      const sc = (Math.min(W - 2 * m, H - 2 * m) * Math.max(0.05, p.size / 100)) / diag;
      scr = proj.map(([x, y, dn]) => [x * sc + W / 2, y * sc + H / 2, dn]);
    } else {
      let px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
      for (const q of proj) {
        if (q[0] < px0) px0 = q[0]; if (q[0] > px1) px1 = q[0];
        if (q[1] < py0) py0 = q[1]; if (q[1] > py1) py1 = q[1];
      }
      const sc = Math.min((W - 2 * m) / ((px1 - px0) || 1), (H - 2 * m) / ((py1 - py0) || 1));
      const ox = m + (W - 2 * m - (px1 - px0) * sc) / 2 - px0 * sc;
      const oy = m + (H - 2 * m - (py1 - py0) * sc) / 2 - py0 * sc;
      scr = proj.map(([x, y, dn]) => [x * sc + ox, y * sc + oy, dn]);
    }
    const NP = Math.max(1, Math.min(PENS.length, Math.round(p.depthPens)));
    const L = Math.round(p.layer);
    const penOf = (dn) => NP === 1 ? L % PENS.length : (L + Math.min(NP - 1, Math.floor(dn * NP))) % PENS.length;
    const paths = [];
    const BUDGET = 118000;
    let total = 0;
    const wantDots = p.output !== "Wire (3D mesh)";
    const wantWire = p.output !== "Dots";
    if (wantWire) {
      const N = rot.length;
      const cell = diag / 24;
      const grid = new Map();
      const gk = (a, b, c) => a + "," + b + "," + c;
      const ci = (q) => [Math.floor(q[0] / cell), Math.floor(q[1] / cell), Math.floor(q[2] / cell)];
      rot.forEach((q, i) => {
        const k2 = gk(...ci(q));
        if (!grid.has(k2)) grid.set(k2, []);
        grid.get(k2).push(i);
      });
      const K = Math.max(1, Math.round(p.k));
      const maxE = p.maxEdge > 0.01 ? (p.maxEdge / 100) * diag : Infinity;
      const eseen = new Set();
      for (let i = 0; i < N; i++) {
        const [ga, gb, gc] = ci(rot[i]);
        const best = [];
        for (let ring = 1; ring <= 3; ring++) {
          for (let a = ga - ring; a <= ga + ring; a++) for (let b = gb - ring; b <= gb + ring; b++) for (let c = gc - ring; c <= gc + ring; c++) {
            if (ring > 1 && Math.max(Math.abs(a - ga), Math.abs(b - gb), Math.abs(c - gc)) < ring) continue;
            for (const j of grid.get(gk(a, b, c)) || []) {
              if (j === i) continue;
              const d = Math.hypot(rot[i][0] - rot[j][0], rot[i][1] - rot[j][1], rot[i][2] - rot[j][2]);
              if (d <= maxE) best.push([d, j]);
            }
          }
          if (best.length >= K * 3) break;
        }
        best.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (let q = 0; q < Math.min(K, best.length); q++) {
          const j = best[q][1];
          const ek = i < j ? i + "_" + j : j + "_" + i;
          if (eseen.has(ek)) continue;
          eseen.add(ek);
          if (total + 2 > BUDGET) break;
          const A = scr[i], B = scr[j];
          paths.push({ pts: [[A[0], A[1]], [B[0], B[1]]], closed: false, layer: penOf(Math.min(A[2], B[2])) });
          total += 2;
        }
      }
    }
    if (wantDots) {
      const r = Math.max(0.15, p.dot / 2);
      const segs = p.dot >= 1 ? 8 : 5;
      for (const [x, y, dn] of scr) {
        if (total + segs > BUDGET) break;
        const ring = [];
        for (let k2 = 0; k2 < segs; k2++) {
          const a = (k2 / segs) * Math.PI * 2;
          ring.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        paths.push({ pts: ring, closed: true, layer: penOf(dn) });
        total += segs;
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
