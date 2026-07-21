import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  key: "tubes",
    name: "Tubes",
    cat: "gen",
    group: "structural",
    desc: "Tubes wandering and crossing in 3D, projected with perspective and drawn with real hidden lines: tubes break cleanly where they pass behind each other, and their own back side is hidden. Surface is one continuous spiral per tube (single pen-down) or a ring+line wireframe mesh. Radius is noise-modulated; wire Drift to make the tubes move over an animation.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "tubes", label: "Tubes", type: "slider", min: 1, max: 6, step: 1, def: 3 },
      { key: "radius", label: "Radius mm", type: "slider", min: 2, max: 20, step: 0.5, def: 8 },
      { key: "rmod", label: "Radius modulation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.3 },
      { key: "wander", label: "Wander", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.5 },
      { key: "length", label: "Tube length mm", type: "slider", min: 80, max: 400, step: 10, def: 220 },
      { key: "surface", label: "Surface", type: "select", options: ["Spiral", "Mesh"], def: "Spiral" },
      { key: "density", label: "Spiral turns / ring gap", type: "slider", min: 1, max: 10, step: 0.5, def: 4 },
      { key: "longs", label: "Mesh longitudinals", type: "slider", min: 3, max: 10, step: 1, def: 6 },
      { key: "hidden", label: "Hidden lines", type: "check", def: true },
      { key: "drift", label: "Drift (wire Frame)", type: "slider", min: 0, max: 10, step: 0.05, def: 0 },
      { key: "yaw", label: "View yaw deg", type: "slider", min: 0, max: 360, step: 1, def: 25 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 9 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const NT = Math.max(1, Math.min(8, Math.round(p.tubes)));
      const R0 = Math.max(1, p.radius);
      const DEPTH = Math.min(bw, bh) * 1.2;
      const box = { x: bw / 2, y: bh / 2, z: DEPTH / 2 };
      /* --- 1) center curves: smooth bouncing walks in a 3D box --- */
      const STEP = 1.4;
      const tubesC = [];
      for (let tI = 0; tI < NT; tI++) {
        const s = p.seed * 131 + tI * 977;
        let x = (hash2(tI * 3 + 1, 1, p.seed) - 0.5) * box.x * 1.4;
        let y = (hash2(tI * 3 + 2, 2, p.seed) - 0.5) * box.y * 1.4;
        let z = (hash2(tI * 3 + 3, 3, p.seed) - 0.5) * box.z * 1.4;
        let th = hash2(tI * 3 + 4, 4, p.seed) * Math.PI * 2;
        let ph = (hash2(tI * 3 + 5, 5, p.seed) - 0.5) * Math.PI * 0.8;
        const pts = [];
        const nSteps = Math.round(Math.max(40, p.length) / STEP);
        for (let i = 0; i <= nSteps; i++) {
          pts.push([x, y, z]);
          const u = i * STEP * 0.02;
          th += (noise2(u + tI * 7.3, p.drift + 11.1, s) - 0.5) * p.wander * 0.9;
          ph += (noise2(u + tI * 7.3, p.drift + 53.7, s + 1) - 0.5) * p.wander * 0.7;
          ph = Math.max(-1.1, Math.min(1.1, ph));
          x += Math.cos(th) * Math.cos(ph) * STEP;
          y += Math.sin(th) * Math.cos(ph) * STEP;
          z += Math.sin(ph) * STEP;
          /* bounce off the box walls to stay composed */
          if (x > box.x || x < -box.x) { th = Math.PI - th; x = Math.max(-box.x, Math.min(box.x, x)); }
          if (y > box.y || y < -box.y) { th = -th; y = Math.max(-box.y, Math.min(box.y, y)); }
          if (z > box.z || z < -box.z) { ph = -ph; z = Math.max(-box.z, Math.min(box.z, z)); }
        }
        tubesC.push(pts);
      }
      /* radius along each tube: noise-modulated */
      const rAt = (tI, i, n) => {
        const u = (i / n) * 6;
        const taper = Math.min(1, Math.min(i, n - i) / (n * 0.12));
        return R0 * (1 + (noise2(u + tI * 3.1, p.drift + 29.5, p.seed + 7 + tI) - 0.5) * 2 * p.rmod * 0.6) * (0.35 + 0.65 * taper);
      };
      /* --- 2) rotation-minimizing frames --- */
      const frames = tubesC.map((pts) => {
        const T = [], Nn = [], B = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
          const tl = Math.hypot(tx, ty, tz) || 1;
          tx /= tl; ty /= tl; tz /= tl;
          T.push([tx, ty, tz]);
          if (i === 0) {
            let nx = -ty, ny = tx, nz = 0;
            const nl = Math.hypot(nx, ny, nz) || 1;
            if (nl < 0.1) { nx = 1; ny = 0; nz = 0; }
            Nn.push([nx / nl, ny / nl, nz / nl]);
          } else {
            /* project previous normal off the new tangent */
            const pn = Nn[i - 1];
            const d = pn[0] * tx + pn[1] * ty + pn[2] * tz;
            let nx = pn[0] - d * tx, ny = pn[1] - d * ty, nz = pn[2] - d * tz;
            const nl = Math.hypot(nx, ny, nz) || 1;
            Nn.push([nx / nl, ny / nl, nz / nl]);
          }
          const t2 = T[i], n2 = Nn[i];
          B.push([
            t2[1] * n2[2] - t2[2] * n2[1],
            t2[2] * n2[0] - t2[0] * n2[2],
            t2[0] * n2[1] - t2[1] * n2[0]
          ]);
        }
        return { T, N: Nn, B };
      });
      /* --- 3) view: yaw around Y + slight pitch, perspective --- */
      const ya = (p.yaw * Math.PI) / 180, pa2 = 0.25;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      const FOC = DEPTH * 2.2;
      const proj = (x, y, z) => {
        let X = x * cy2 + z * sy2;
        let Z = -x * sy2 + z * cy2;
        let Y = y * cp2 - Z * sp2;
        Z = y * sp2 + Z * cp2;
        const s = FOC / (FOC + Z);
        return [X * s, Y * s, Z, s];
      };
      /* projected center samples per tube (occlusion buffer) */
      const centers = tubesC.map((pts, tI) => pts.map((q, i) => {
        const [X, Y, Z, s] = proj(q[0], q[1], q[2]);
        return { X, Y, Z, rp: rAt(tI, i, pts.length - 1) * s };
      }));
      /* --- 4) surface geometry (projected, with depth + occlusion info) --- */
      const rawPaths = []; /* { pts: [[X,Y,Z,tI]], layer } split later */
      const TWO = Math.PI * 2;
      for (let tI = 0; tI < NT; tI++) {
        const C = tubesC[tI], Fp = frames[tI];
        const n = C.length - 1;
        const surfPt = (i, ang) => {
          const r = rAt(tI, i, n);
          const Nv = Fp.N[i], Bv = Fp.B[i];
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const x = C[i][0] + (Nv[0] * ca + Bv[0] * sa) * r;
          const y = C[i][1] + (Nv[1] * ca + Bv[1] * sa) * r;
          const z = C[i][2] + (Nv[2] * ca + Bv[2] * sa) * r;
          const [X, Y, Z] = proj(x, y, z);
          return [X, Y, Z];
        };
        if (p.surface === "Spiral") {
          const turnsPer = Math.max(0.5, p.density);
          const pts = [];
          /* substep so the helix stays smooth */
          const SUB = 6;
          for (let i = 0; i < n; i++) {
            for (let ss = 0; ss < SUB; ss++) {
              const fi = i + ss / SUB;
              const i0 = Math.floor(fi);
              const ang = (fi * STEP / 10) * turnsPer * TWO;
              pts.push([...surfPt(i0, ang), tI, i0]);
            }
          }
          rawPaths.push({ pts, tI });
        } else {
          /* rings */
          const gap = Math.max(1.5, 12 / Math.max(0.5, p.density));
          const every = Math.max(1, Math.round(gap / STEP));
          for (let i = 0; i <= n; i += every) {
            const ring = [];
            for (let k = 0; k <= 24; k++) {
              ring.push([...surfPt(i, (k / 24) * TWO), tI, i]);
            }
            rawPaths.push({ pts: ring, tI });
          }
          /* longitudinals */
          const NL = Math.max(2, Math.min(12, Math.round(p.longs)));
          for (let l = 0; l < NL; l++) {
            const ang = (l / NL) * TWO;
            const line = [];
            for (let i = 0; i <= n; i++) line.push([...surfPt(i, ang), tI, i]);
            rawPaths.push({ pts: line, tI });
          }
        }
      }
      /* --- 5) fit to sheet --- */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const rp of rawPaths) for (const q of rp.pts) {
        if (q[0] < fx0) fx0 = q[0]; if (q[0] > fx1) fx1 = q[0];
        if (q[1] < fy0) fy0 = q[1]; if (q[1] > fy1) fy1 = q[1];
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      /* occlusion buffer in sheet coords, bucketed */
      const occ = [];
      centers.forEach((cs, tI) => cs.forEach((c, i) => occ.push({
        x: c.X * sc + ox, y: c.Y * sc + oy, z: c.Z, r: c.rp * sc, tI, i
      })));
      const bs = Math.max(4, R0 * sc * 1.5);
      const grid = new Map();
      occ.forEach((o, k) => {
        const key = Math.floor(o.x / bs) + "," + Math.floor(o.y / bs);
        let a = grid.get(key);
        if (!a) { a = []; grid.set(key, a); }
        a.push(k);
      });
      const isHidden = (x, y, z, tI, ci) => {
        const bx = Math.floor(x / bs), by = Math.floor(y / bs);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const a = grid.get((bx + dx) + "," + (by + dy));
            if (!a) continue;
            for (const k of a) {
              const o = occ[k];
              if (o.tI === tI && Math.abs(o.i - ci) < 14) continue; /* not our own neighbourhood */
              if (o.z < z - o.r * 0.4 && Math.hypot(x - o.x, y - o.y) < o.r * 0.96) return true;
            }
          }
        }
        return false;
      };
      /* back side of the own tube: sample z behind own center z */
      const centerZ = (tI, i) => centers[tI][Math.min(centers[tI].length - 1, i)].Z;
      const paths = [];
      const L = Math.round(p.layer);
      for (const rp of rawPaths) {
        let run = [];
        const flush = () => { if (run.length > 1) paths.push({ pts: run, closed: false, layer: L }); run = []; };
        for (const q of rp.pts) {
          const x = q[0] * sc + ox, y = q[1] * sc + oy, z = q[2];
          const tI = q[3], ci = q[4];
          let vis = true;
          if (p.hidden) {
            if (z > centerZ(tI, ci) + 0.6) vis = false; /* own back side */
            else if (isHidden(x, y, z, tI, ci)) vis = false;
          }
          if (vis) run.push([Math.max(0.5, Math.min(W - 0.5, x)), Math.max(0.5, Math.min(H - 0.5, y))]);
          else flush();
        }
        flush();
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
