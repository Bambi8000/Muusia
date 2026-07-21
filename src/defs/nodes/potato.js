import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "potato",
      name: "Potato",
    cat: "gen", group: "nature",
    desc: "Asymmetric blobs (low-frequency harmonics + random squash) with optional eye texture as dots or curved arcs. Placement: No overlap keeps every potato fully separated using its true extent (fewer may fit on a tight sheet); Loose allows touching and light overlap.",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "count", label: "Potatoes", type: "slider", min: 1, max: 60, step: 1, def: 9 },
      { key: "size", label: "Size mm", type: "slider", min: 5, max: 120, step: 1, def: 38 },
      { key: "sizeVar", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: "irr", label: "Irregularity", type: "slider", min: 0, max: 0.6, step: 0.02, def: 0.22 },
      { key: "place", label: "Placement", type: "select", options: ["No overlap", "Loose (may overlap)"], def: "No overlap" },
      { key: "eyes", label: "Eyes (texture)", type: "select", options: ["None", "Dots", "Arcs (eyes)"], def: "Arcs (eyes)" },
      { key: "eyeCount", label: "Eyes per potato", type: "slider", min: 1, max: 30, step: 1, def: 7 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
      { key: "seed", label: "Seed", type: "seed", def: 73 },
      { key: "layer", label: "Pen", type: "pen", def: 0 },
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const rng = mulberry32(p.seed * 2311 + 41);
      const L = Math.round(p.layer);
      const paths = [];
      const placed = []; /* [cx, cy, rMax, R] */
      const noOv = p.place !== "Loose (may overlap)";
      const target = Math.round(p.count);
      let guard = 0;
      while (placed.length < target && guard++ < target * 80) {
        const R = (p.size / 2) * (1 - p.sizeVar * rng());
        /* shape FIRST so the true extent is known before placement */
        const nH = 3;
        const amps = [], phs = [];
        for (let h = 0; h < nH; h++) {
          amps.push((p.irr * R * (0.4 + 0.6 * rng())) / (h + 1));
          phs.push(rng() * Math.PI * 2);
        }
        const squash = 0.75 + 0.2 * rng();
        const sqA = rng() * Math.PI;
        const rAt = (th) => {
          let r = R;
          for (let h = 0; h < nH; h++) r += amps[h] * Math.sin((h + 2) * th + phs[h]);
          return Math.max(R * 0.3, r);
        };
        const ca = Math.cos(sqA), sa = Math.sin(sqA);
        const shape = [];
        let rMax = 0;
        for (let k = 0; k < 72; k++) {
          const th = (k / 72) * Math.PI * 2;
          const r = rAt(th);
          let x = Math.cos(th) * r, y = Math.sin(th) * r;
          const u = x * ca + y * sa, v = -x * sa + y * ca;
          x = u * ca - v * squash * sa;
          y = u * sa + v * squash * ca;
          shape.push([x, y]);
          const d = Math.hypot(x, y);
          if (d > rMax) rMax = d;
        }
        const pad = noOv ? rMax : R;
        if (W - 2 * p.margin < 2 * pad || H - 2 * p.margin < 2 * pad) continue;
        const cx = p.margin + pad + rng() * (W - 2 * p.margin - 2 * pad);
        const cy = p.margin + pad + rng() * (H - 2 * p.margin - 2 * pad);
        let ok = true;
        for (const q of placed) {
          const d = Math.hypot(cx - q[0], cy - q[1]);
          if (noOv ? d < rMax + q[2] + 0.8 : d < (R + q[3]) * 0.75) { ok = false; break; }
        }
        if (!ok && (noOv || guard < target * 40)) continue;
        placed.push([cx, cy, rMax, R]);
        paths.push({ pts: shape.map(([x, y]) => [cx + x, cy + y]), closed: true, layer: L });
        /* silmat */
        if (p.eyes !== "None") {
          for (let e = 0; e < Math.round(p.eyeCount); e++) {
            const th = rng() * Math.PI * 2;
            const rr = Math.sqrt(rng()) * 0.62 * rAt(th) * squash;
            const ex = cx + Math.cos(th) * rr;
            const ey = cy + Math.sin(th) * rr;
            if (p.eyes === "Dots") {
              const er = 0.5 + rng() * 0.9;
              const dot = [];
              for (let q = 0; q < 7; q++) {
                const a = (q / 7) * Math.PI * 2;
                dot.push([ex + Math.cos(a) * er, ey + Math.sin(a) * er]);
              }
              paths.push({ pts: dot, closed: true, layer: L });
            } else {
              const ea = rng() * Math.PI * 2;
              const el = 1 + rng() * 2.2;
              const eca = Math.cos(ea), esa = Math.sin(ea);
              const arc = [[-el, -el * 0.25], [-el * 0.35, el * 0.28], [el * 0.35, el * 0.28], [el, -el * 0.25]];
              paths.push({
                pts: arc.map(([ax, ay]) => [ex + ax * eca - ay * esa, ey + ax * esa + ay * eca]),
                closed: false, layer: L,
              });
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
