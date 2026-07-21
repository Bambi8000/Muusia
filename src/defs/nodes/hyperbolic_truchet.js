import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  key: "hyperbolic_truchet",
    name: "Hyperbolic Truchet Maze",
    cat: "gen",
    group: "geometric",
    ins: [Pin("style", "Style")],
    outs: [Pin("paths")],
    params: [
      { key: "seed", label: "Seed", type: "seed", def: 2026 },
      { key: "rings", label: "Concentric Rings", type: "slider", min: 4, max: 40, step: 1, def: 18 },
      { key: "segments", label: "Ray Segments", type: "slider", min: 8, max: 120, step: 2, def: 48 },
      { key: "curvature", label: "Ring Crowding (- center / + edge)", type: "slider", min: -1, max: 1, step: 0.05, def: -0.5 },
      { key: "style", label: "Tile Style", type: "select", options: ["Arcs (Truchet)", "Diagonals"], def: "Arcs (Truchet)" },
      { key: "layer", label: "Pen Index", type: "pen", def: 0 }
    ],
    compute(ins, p, ctx) {
      const { W, H } = ctx;
      const paths = [];
      const cx = W / 2, cy = H / 2;
      const maxRadius = Math.min(W, H) * 0.45;
      const L = Math.round(p.layer);
      const ringCount = Math.max(1, Math.round(p.rings));
      const segCount = Math.max(4, Math.round(p.segments));
      const TWO = Math.PI * 2;

      /* ring distribution: exponential mapping, sign of curvature picks
         whether rings crowd toward the center (event horizon) or the rim */
      const k = Math.max(-1, Math.min(1, p.curvature)) * 3;
      const remap = (t) => Math.abs(k) < 0.01 ? t : (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
      const radii = [];
      for (let r = 0; r <= ringCount; r++) {
        radii.push(maxRadius * remap(r / ringCount));
      }

      const P = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      /* quarter-ellipse in (angle, radius) space: enters/leaves cell edges
         perpendicular-ish so strands connect seamlessly across cells */
      const arcMid = (aFrom, rFrom, aTo, rTo) => {
        const chord = Math.hypot(P(aTo, rTo)[0] - P(aFrom, rFrom)[0], P(aTo, rTo)[1] - P(aFrom, rFrom)[1]);
        const K = Math.max(4, Math.min(24, Math.round(chord / 1.1) + 3));
        const pts = [];
        for (let j = 0; j <= K; j++) {
          const u = j / K;
          const a = aFrom + (aTo - aFrom) * Math.sin(u * Math.PI / 2);
          const rr = rFrom + (rTo - rFrom) * (1 - Math.cos(u * Math.PI / 2));
          pts.push(P(a, rr));
        }
        return pts;
      };

      for (let r = 0; r < ringCount; r++) {
        const rIn = radii[r], rOut = radii[r + 1];
        const rMid = (rIn + rOut) / 2;
        if (rOut - rIn < 0.4) continue;
        for (let s = 0; s < segCount; s++) {
          const a1 = (s / segCount) * TWO;
          const a2 = ((s + 1) / segCount) * TWO;
          const aMid = (a1 + a2) / 2;
          const cellHash = hash2(r, s, p.seed);
          if (p.style === "Diagonals") {
            /* original behavior: corner-to-corner spiral diagonals */
            const from = cellHash > 0.5 ? a1 : a2;
            const to = cellHash > 0.5 ? a2 : a1;
            const arc = [];
            for (let j = 0; j <= 8; j++) {
              const u = j / 8;
              arc.push(P(from + (to - from) * u, rIn + (rOut - rIn) * u));
            }
            paths.push({ pts: arc, closed: false, layer: L });
          } else {
            /* true Truchet: two arcs joining EDGE MIDPOINTS, flipped by hash.
               Midpoints: left ray (a1,rMid), right ray (a2,rMid),
               inner arc (aMid,rIn), outer arc (aMid,rOut).
               Shared midpoints make strands continue across neighbors. */
            if (cellHash > 0.5) {
              paths.push({ pts: arcMid(a1, rMid, aMid, rIn), closed: false, layer: L });
              paths.push({ pts: arcMid(aMid, rOut, a2, rMid), closed: false, layer: L });
            } else {
              paths.push({ pts: arcMid(a1, rMid, aMid, rOut), closed: false, layer: L });
              paths.push({ pts: arcMid(aMid, rIn, a2, rMid), closed: false, layer: L });
            }
          }
        }
      }
      return applyStyle({ paths }, ins[0]);
    }
  
};
