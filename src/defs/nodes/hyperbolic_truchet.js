import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
  key: "hyperbolic_truchet",
  name: "Hyperbolic Truchet Maze",
  cat: "gen",
  group: "geometric",
  desc: "Truchet arcs on a polar grid whose rings crowd toward the center or the rim (Ring Crowding), so the maze reads as a hyperbolic disc. Arc strands connect seamlessly across cells. Solve traces the strand network and recolors one strand running from the center to the outer rim onto the Solve pen (the longest strand if no full crossing exists; Arcs style only).",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "seed", label: "Seed", type: "seed", def: 2026 },
    { key: "rings", label: "Concentric Rings", type: "slider", min: 4, max: 40, step: 1, def: 18 },
    { key: "segments", label: "Ray Segments", type: "slider", min: 8, max: 120, step: 2, def: 48 },
    { key: "curvature", label: "Ring Crowding (- center / + edge)", type: "slider", min: -1, max: 1, step: 0.05, def: -0.5 },
    { key: "style", label: "Tile Style", type: "select", options: ["Arcs (Truchet)", "Diagonals"], def: "Arcs (Truchet)" },
    { key: "solve", label: "Solve (mark one strand)", type: "check", def: false },
    { key: "solvePen", label: "Solve pen", type: "pen", def: 2 },
    { key: "layer", label: "Pen Index", type: "pen", def: 0 }
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
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

    const arcs = []; /* { pts, n1, n2 } - node keys for strand tracing */
    for (let r = 0; r < ringCount; r++) {
      const rIn = radii[r], rOut = radii[r + 1];
      const rMid = (rIn + rOut) / 2;
      if (rOut - rIn < 0.4) continue;
      for (let s = 0; s < segCount; s++) {
        const a1 = (s / segCount) * TWO;
        const a2 = ((s + 1) / segCount) * TWO;
        const aMid = (a1 + a2) / 2;
        const cellHash = hash2(r, s, p.seed);
        const rayL = "y" + r + "_" + s;
        const rayR = "y" + r + "_" + ((s + 1) % segCount);
        const inner = "c" + r + "_" + s;
        const outer = "c" + (r + 1) + "_" + s;
        if (p.style === "Diagonals") {
          /* original behavior: corner-to-corner spiral diagonals */
          const from = cellHash > 0.5 ? a1 : a2;
          const to = cellHash > 0.5 ? a2 : a1;
          const arr = [];
          for (let j = 0; j <= 8; j++) {
            const u = j / 8;
            arr.push(P(from + (to - from) * u, rIn + (rOut - rIn) * u));
          }
          arcs.push({ pts: arr, n1: null, n2: null });
        } else {
          if (cellHash > 0.5) {
            arcs.push({ pts: arcMid(a1, rMid, aMid, rIn), n1: rayL, n2: inner });
            arcs.push({ pts: arcMid(aMid, rOut, a2, rMid), n1: outer, n2: rayR });
          } else {
            arcs.push({ pts: arcMid(a1, rMid, aMid, rOut), n1: rayL, n2: outer });
            arcs.push({ pts: arcMid(aMid, rIn, a2, rMid), n1: inner, n2: rayR });
          }
        }
      }
    }

    /* ---- solve: trace strands through shared edge midpoints ---- */
    const solveSet = new Set();
    if (p.solve && p.style !== "Diagonals" && arcs.length) {
      const adj = new Map(); /* node -> [arcIdx] */
      arcs.forEach((a, i) => {
        for (const nkey of [a.n1, a.n2]) {
          if (!adj.has(nkey)) adj.set(nkey, []);
          adj.get(nkey).push(i);
        }
      });
      const used = new Uint8Array(arcs.length);
      const chains = [];
      const trace = (startNode, firstArc) => {
        const chain = [];
        let node = startNode, ai = firstArc;
        let guard = 0;
        while (ai !== undefined && !used[ai] && guard++ < arcs.length + 2) {
          used[ai] = 1;
          chain.push(ai);
          node = arcs[ai].n1 === node ? arcs[ai].n2 : arcs[ai].n1;
          ai = (adj.get(node) || []).find((j) => !used[j]);
        }
        return { chain, endA: startNode, endB: node };
      };
      for (const [nkey, list] of adj) {
        if (list.length !== 1) continue; /* open ends live at boundaries */
        const ai = list.find((j) => !used[j]);
        if (ai !== undefined) chains.push(trace(nkey, ai));
      }
      const isCenter = (nk) => typeof nk === "string" && nk.startsWith("c0_");
      const isRim = (nk) => typeof nk === "string" && nk.startsWith("c" + ringCount + "_");
      let pick = chains.find((ch) =>
        (isCenter(ch.endA) && isRim(ch.endB)) || (isCenter(ch.endB) && isRim(ch.endA)));
      if (!pick && chains.length) {
        pick = chains.reduce((best, ch) => ch.chain.length > best.chain.length ? ch : best, chains[0]);
      }
      if (pick) for (const i of pick.chain) solveSet.add(i);
    }

    const SP = Math.round(p.solvePen);
    const paths = arcs.map((a, i) => ({
      pts: a.pts, closed: false, layer: solveSet.has(i) ? SP : L
    }));
    return applyStyle({ paths }, ins[0]);
  },
};