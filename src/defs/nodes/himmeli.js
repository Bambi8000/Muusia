import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "himmeli",
    name: "Himmeli",
    cat: "gen",
    group: "structural",
    desc: "Traditional Finnish straw mobile in 3D: octahedral straw units built into classic forms - Single crystal, Column (units tip to tip on threads), Chandelier (center with hanging side units), or Cluster (a two-layer cloud with pendants swinging on threads at seeded lengths and angles). Rotate with View yaw and pitch; wire Frame into Yaw and the mobile spins through the animation.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "model", label: "Model", type: "select", options: ["Single", "Column", "Chandelier", "Cluster"], def: "Cluster" },
      { key: "size", label: "Unit size mm", type: "slider", min: 10, max: 60, step: 1, def: 28 },
      { key: "elong", label: "Elongation", type: "slider", min: 0.8, max: 2.2, step: 0.05, def: 1.35 },
      { key: "complexity", label: "Complexity", type: "slider", min: 1, max: 5, step: 1, def: 3 },
      { key: "pendants", label: "Hanging pendants", type: "check", def: true },
      { key: "threads", label: "Draw threads", type: "check", def: true },
      { key: "yaw", label: "View yaw deg (wire Frame)", type: "slider", min: 0, max: 360, step: 1, def: 28 },
      { key: "pitch", label: "View pitch deg", type: "slider", min: -30, max: 60, step: 1, def: 12 },
      { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: "margin", label: "Margin mm", type: "slider", min: 5, max: 60, step: 1, def: 15 },
      { key: "seed", label: "Seed", type: "seed", def: 8 },
      { key: "layer", label: "Pen", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const m = Math.max(2, p.margin);
      const bw = W - 2 * m, bh = H - 2 * m;
      if (bw < 20 || bh < 20) return applyStyle({ paths: [] }, ins[0]);
      const rng = mulberry32(p.seed * 419 + 3);
      const S = Math.max(4, p.size);
      const EL = p.elong;
      const C = Math.max(1, Math.min(5, Math.round(p.complexity)));
      const segs = [];    /* 3D straw segments: [x1,y1,z1,x2,y2,z2] */
      const threads = []; /* 3D thread segments */
      /* one octahedral unit: center (cx,cy,cz), width w, own yaw rotation ry.
         y axis points UP in model space. */
      const unit = (cx, cy, cz, w, ry) => {
        const hw = w / 2, hh = (w * EL) / 2;
        const ca = Math.cos(ry), sa = Math.sin(ry);
        const rot = (x, z) => [x * ca + z * sa, -x * sa + z * ca];
        const eq = [];
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          const [rx, rz] = rot(Math.cos(a) * hw, Math.sin(a) * hw);
          eq.push([cx + rx, cy, cz + rz]);
        }
        const top = [cx, cy + hh, cz], bot = [cx, cy - hh, cz];
        for (let k = 0; k < 4; k++) {
          const nk = (k + 1) % 4;
          segs.push([...eq[k], ...eq[nk]]);
          segs.push([...top, ...eq[k]]);
          segs.push([...bot, ...eq[k]]);
        }
        return { top, bot, eq, hh };
      };
      const thread = (a, b) => threads.push([...a, ...b]);

      if (p.model === "Single") {
        const u = unit(0, 0, 0, S, Math.PI / 4);
        if (C >= 3) unit(0, 0, 0, S * 0.5, 0); /* nested inner crystal */
        if (p.threads) thread([0, u.hh + S * 0.5, 0], u.top);
      } else if (p.model === "Column") {
        /* pitkähimmeli: units tip to tip with short thread gaps, sizes easing */
        const n = C + 1;
        const gap = S * 0.14;
        let y = 0;
        let prevBot = null;
        for (let i = 0; i < n; i++) {
          const w = S * (1 - 0.13 * i);
          const hh = (w * EL) / 2;
          const cy = y - hh;
          const u = unit(0, cy, 0, w, (i % 2) * (Math.PI / 4));
          if (p.threads) {
            if (prevBot) thread(prevBot, u.top);
            else thread([0, y + S * 0.4, 0], u.top);
          }
          prevBot = u.bot;
          y = cy - hh - gap;
        }
      } else if (p.model === "Chandelier") {
        const u = unit(0, 0, 0, S, Math.PI / 4);
        if (p.threads) thread([0, u.hh + S * 0.5, 0], u.top);
        if (p.pendants) {
          const sides = Math.min(6, C + 1);
          for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2;
            const px = Math.cos(a) * S * 0.72, pz = Math.sin(a) * S * 0.72;
            const drop = S * (0.55 + rng() * 0.35);
            const pw = S * (0.42 + rng() * 0.18);
            const pu = unit(px, -drop - (pw * EL) / 2, pz, pw, rng() * Math.PI);
            if (p.threads) thread([Math.cos(a) * S * 0.5, 0, Math.sin(a) * S * 0.5], pu.top);
          }
          const bw2 = S * 0.5;
          const bu = unit(0, -u.hh - S * 0.45 - (bw2 * EL) / 2, 0, bw2, 0);
          if (p.threads) thread(u.bot, bu.top);
        }
      } else {
        /* Cluster: two stacked grid layers + swinging pendants (the photo) */
        const g = Math.max(2, C);
        const w = S, hh = (w * EL) / 2;
        const bots = [];
        for (let gz = 0; gz < g; gz++) {
          for (let gxi = 0; gxi < g; gxi++) {
            const x = (gxi - (g - 1) / 2) * w;
            const z = (gz - (g - 1) / 2) * w;
            unit(x, 0, z, w, Math.PI / 4);
          }
        }
        for (let gz = 0; gz < g - 1; gz++) {
          for (let gxi = 0; gxi < g - 1; gxi++) {
            const x = (gxi - (g - 2) / 2) * w;
            const z = (gz - (g - 2) / 2) * w;
            const u = unit(x, -hh * 1.02, z, w, 0);
            bots.push(u);
          }
        }
        if (p.threads) thread([0, hh + S * 0.5, 0], [0, hh, 0]);
        if (p.pendants && bots.length) {
          const nP = Math.min(bots.length, 3 + C * 2);
          /* pick spread-out parents deterministically */
          const order = bots.map((u, i) => [rng(), i]).sort((a, b) => a[0] - b[0]);
          for (let k = 0; k < nP; k++) {
            const u = bots[order[k][1]];
            const drop = S * (0.5 + rng() * 1.1);
            const pw = S * (0.45 + rng() * 0.4);
            const px = u.bot[0] + (rng() - 0.5) * S * 0.15;
            const pz = u.bot[2] + (rng() - 0.5) * S * 0.15;
            const pu = unit(px, u.bot[1] - drop - (pw * EL) / 2, pz, pw, rng() * Math.PI);
            if (p.threads) thread(u.bot, pu.top);
          }
        }
      }

      /* project: yaw around vertical, pitch, perspective; y up -> screen y down */
      const ya = (p.yaw * Math.PI) / 180, pa2 = (p.pitch * Math.PI) / 180;
      const cy2 = Math.cos(ya), sy2 = Math.sin(ya);
      const cp2 = Math.cos(pa2), sp2 = Math.sin(pa2);
      let ext = S;
      for (const s of segs) ext = Math.max(ext, Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2]), Math.abs(s[3]), Math.abs(s[4]), Math.abs(s[5]));
      const FOC = ext * 2 * (0.8 + 6 * (1 - p.persp));
      const proj = (x, y, z) => {
        const X = x * cy2 + z * sy2;
        let Z = -x * sy2 + z * cy2;
        const Y = y * cp2 - Z * sp2;
        Z = y * sp2 + Z * cp2;
        const sc = FOC / Math.max(FOC * 0.12, FOC + Z);
        return [X * sc, -Y * sc];
      };
      /* dedupe identical straws (shared between touching units) */
      const seen = new Set();
      const q = (v) => Math.round(v * 10) / 10;
      const out2 = [];
      const addSeg = (s, isThread) => {
        const A = proj(s[0], s[1], s[2]), B = proj(s[3], s[4], s[5]);
        const k1 = q(A[0]) + "," + q(A[1]) + "|" + q(B[0]) + "," + q(B[1]);
        const k2 = q(B[0]) + "," + q(B[1]) + "|" + q(A[0]) + "," + q(A[1]);
        if (seen.has(k1) || seen.has(k2)) return;
        seen.add(k1);
        out2.push({ A, B, isThread });
      };
      for (const s of segs) addSeg(s, false);
      if (p.threads) for (const s of threads) addSeg(s, true);
      /* fit */
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const o of out2) {
        for (const P of [o.A, o.B]) {
          if (P[0] < fx0) fx0 = P[0]; if (P[0] > fx1) fx1 = P[0];
          if (P[1] < fy0) fy0 = P[1]; if (P[1] > fy1) fy1 = P[1];
        }
      }
      const sc = Math.min(bw / ((fx1 - fx0) || 1), bh / ((fy1 - fy0) || 1));
      const ox = m + (bw - (fx1 - fx0) * sc) / 2 - fx0 * sc;
      const oy = m + (bh - (fy1 - fy0) * sc) / 2 - fy0 * sc;
      const L = Math.round(p.layer);
      const cl = (v, lim) => Math.max(0.5, Math.min(lim - 0.5, v));
      const paths = out2.map((o) => ({
        pts: [[cl(o.A[0] * sc + ox, W), cl(o.A[1] * sc + oy, H)], [cl(o.B[0] * sc + ox, W), cl(o.B[1] * sc + oy, H)]],
        closed: false, layer: L
      }));
      return applyStyle({ paths }, ins[0]);
    }
  
};
