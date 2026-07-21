import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "powerpole",
    name: "Power Pole",
    cat: "gen",
    group: "structural",
    desc: "Wireframe 3D utility poles: Finnish Wood (single pole, crossarm, pin insulators, guy wire), US Utility (double crossarm, cylinder transformer), Japanese Concrete (stacked arms, transformer drums). The Wires toggle hangs catenary cables from the insulators. Rotate with Yaw and Pitch - wire Frame into Yaw to orbit.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "model", label: "Model", type: "select", options: ["Finnish Wood", "US Utility", "Japanese Concrete"], def: "Finnish Wood" },
      { key: "height", label: "Height mm", type: "slider", min: 60, max: 260, step: 5, def: 180 },
      { key: "wires", label: "Wires", type: "check", def: true },
      { key: "sag", label: "Wire sag", type: "slider", min: 0.02, max: 0.3, step: 0.01, def: 0.1 },
      { key: "yaw", label: "Yaw deg (wire Frame)", type: "slider", min: 0, max: 360, step: 1, def: 25 },
      { key: "pitch", label: "Pitch deg", type: "slider", min: -10, max: 40, step: 1, def: 8 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 4 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 911 + 5);
      const HT = p.height;
      const segs = [];   /* [x1,y1,z1,x2,y2,z2] , y up */
      const rings = [];  /* horizontal circles: {x,y,z,r,n} */
      const line = (a, b) => segs.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
      const ring = (x, y, z, r, n) => rings.push({ x, y, z, r, n: n || Math.max(8, Math.round(r * 3)) });
      /* tapered square post: 4 corner edges + top square (+optional base square) */
      const post = (cx, cz, y0, y1, r0, r1, topSquare) => {
        const c0 = [[-r0, -r0], [r0, -r0], [r0, r0], [-r0, r0]];
        const c1 = [[-r1, -r1], [r1, -r1], [r1, r1], [-r1, r1]];
        for (let k = 0; k < 4; k++) line([cx + c0[k][0], y0, cz + c0[k][1]], [cx + c1[k][0], y1, cz + c1[k][1]]);
        if (topSquare) for (let k = 0; k < 4; k++) {
          const nk = (k + 1) % 4;
          line([cx + c1[k][0], y1, cz + c1[k][1]], [cx + c1[nk][0], y1, cz + c1[nk][1]]);
        }
      };
      /* round wooden pole: 2 front/back edges + a couple of rings (light wireframe) */
      const wood = (cx, cz, y0, y1, r0, r1) => {
        line([cx - r0, y0, cz], [cx - r1, y1, cz]);
        line([cx + r0, y0, cz], [cx + r1, y1, cz]);
        ring(cx, y1, cz, r1);
        ring(cx, y0 + (y1 - y0) * 0.5, cz, (r0 + r1) / 2);
      };
      /* pin insulator: stub up + small disc */
      const pin = (x, y, z) => {
        line([x, y, z], [x, y + HT * 0.03, z]);
        ring(x, y + HT * 0.03, z, HT * 0.012, 8);
        return [x, y + HT * 0.03, z];
      };
      /* hanging insulator string: vertical + 3 discs, returns bottom attach point */
      const stringIns = (x, y, z) => {
        const len = HT * 0.07;
        line([x, y, z], [x, y - len, z]);
        for (let k = 1; k <= 3; k++) ring(x, y - (len * k) / 3.5, z, HT * 0.012, 8);
        return [x, y - len, z];
      };
      /* transformer cylinder mounted at side: axis vertical */
      const transformer = (x, y, z, r, h) => {
        ring(x, y, z, r); ring(x, y + h, z, r);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          line([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r]);
        }
      };
      const attach = []; /* wire attachment points */
      const M = p.model;

      if (M === "Finnish Wood") {
        wood(0, 0, 0, HT, HT * 0.018, HT * 0.011);
        const ay = HT * 0.93, aw = HT * 0.18;
        line([-aw, ay, 0], [aw, ay, 0]);                       /* crossarm */
        line([-aw, ay - HT * 0.006, 0], [aw, ay - HT * 0.006, 0]);
        line([-aw * 0.55, ay, 0], [0, ay - HT * 0.08, 0]);     /* brackets */
        line([aw * 0.55, ay, 0], [0, ay - HT * 0.08, 0]);
        attach.push(pin(-aw * 0.85, ay, 0), pin(0, HT, 0), pin(aw * 0.85, ay, 0));
        /* guy wire to ground */
        line([0, HT * 0.85, 0], [HT * 0.32, 0, HT * 0.1]);
      } else if (M === "US Utility") {
        wood(0, 0, 0, HT, HT * 0.02, HT * 0.012);
        for (const [ay, aw] of [[HT * 0.95, HT * 0.2], [HT * 0.85, HT * 0.17]]) {
          line([-aw, ay, 0], [aw, ay, 0]);
          line([-aw, ay - HT * 0.006, 0], [aw, ay - HT * 0.006, 0]);
          line([-aw * 0.5, ay, 0], [0, ay - HT * 0.06, 0]);
          line([aw * 0.5, ay, 0], [0, ay - HT * 0.06, 0]);
          for (const fx of [-0.85, -0.4, 0.4, 0.85]) attach.push(pin(aw * fx, ay, 0));
        }
        transformer(HT * 0.05, HT * 0.62, HT * 0.05, HT * 0.045, HT * 0.1);
        /* telecom line lower: simple attachment both sides */
        attach.push([0, HT * 0.45, 0]);
      } else if (M === "Japanese Concrete") {
        wood(0, 0, 0, HT, HT * 0.022, HT * 0.013);
        ring(0, HT * 0.3, 0, HT * 0.02); ring(0, HT * 0.6, 0, HT * 0.017);
        for (const [ay, aw, nz] of [[HT * 0.97, HT * 0.13, 0], [HT * 0.9, HT * 0.11, HT * 0.02], [HT * 0.82, HT * 0.12, -HT * 0.02], [HT * 0.74, HT * 0.1, 0]]) {
          line([-aw, ay, nz], [aw, ay, nz]);
          attach.push(pin(-aw * 0.8, ay, nz), pin(aw * 0.8, ay, nz));
        }
        transformer(HT * 0.07, HT * 0.55, 0, HT * 0.05, HT * 0.11);
        transformer(-HT * 0.07, HT * 0.42, HT * 0.03, HT * 0.045, HT * 0.1);
      }

      /* wires: catenary along +-Z from each attach point */
      const wires3 = [];
      if (p.wires) {
        const span = HT * 0.95;
        for (const a of attach) {
          for (const dir of [-1, 1]) {
            const sagAmt = span * p.sag * (0.8 + rng() * 0.4);
            const wpts = [];
            const n = 14;
            for (let k = 0; k <= n; k++) {
              const t = k / n;
              const dy = -sagAmt * (1 - (2 * t - 1) * (2 * t - 1));
              wpts.push([a[0], a[1] + dy + t * t * 0, a[2] + dir * t * span]);
            }
            wires3.push(wpts);
          }
        }
      }
      /* project: yaw around vertical, pitch, perspective; fit */
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      const FOC = HT * 2 * (0.8 + 6 * (1 - p.persp));
      const proj = (x, y, z) => {
        const X = x * cy2 + z * sy2;
        let Z = -x * sy2 + z * cy2;
        const Y = y * cp2 - Z * sp2;
        Z = y * sp2 + Z * cp2;
        const sc = FOC / Math.max(FOC * 0.12, FOC + Z);
        return [X * sc, -Y * sc];
      };
      const polys = [];
      for (const s of segs) polys.push({ pts: [proj(s[0], s[1], s[2]), proj(s[3], s[4], s[5])], closed: false });
      for (const r of rings) {
        const c = [];
        for (let k = 0; k < r.n; k++) {
          const a = (k / r.n) * Math.PI * 2;
          c.push(proj(r.x + Math.cos(a) * r.r, r.y, r.z + Math.sin(a) * r.r));
        }
        polys.push({ pts: c, closed: true });
      }
      for (const wpts of wires3) polys.push({ pts: wpts.map((q) => proj(q[0], q[1], q[2])), closed: false });
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const pl of polys) for (const [x, y] of pl.pts) {
        if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const L = Math.round(p.layer);
      const paths = polys.map((pl) => ({
        pts: pl.pts.map(([x, y]) => [
          Math.max(0.5, Math.min(W - 0.5, x * sc + ox)),
          Math.max(0.5, Math.min(H - 0.5, y * sc + oy))
        ]),
        closed: pl.closed, layer: L
      }));
      return applyStyle({ paths }, ins[0]);
    }
  
};
