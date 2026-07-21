import { Pin } from "../helpers.js";

export default {
  key: "viiva",
    name: "Stroke", cat: "gen", group: "textimg", ins: [], outs: [Pin("style")],
    params: [
      { key: "mode", label: "Type", type: "select", options: ["Solid", "Dashed", "Dots", "Dash-dot"], def: "Dashed" },
      { key: "dash", label: "Dash mm", type: "slider", min: 0.5, max: 30, step: 0.25, def: 4 },
      { key: "gap", label: "Gap mm", type: "slider", min: 0.3, max: 30, step: 0.25, def: 3 },
      { key: "vary", label: "Variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
      { key: "phase", label: "Phase mm", type: "slider", min: 0, max: 30, step: 0.5, def: 0 },
      { key: "seed", label: "Seed", type: "seed", def: 4 },
    ],
    compute(_ins, p) {
      return { kind: "style", mode: p.mode, dash: p.dash, gap: p.gap, vary: p.vary, phase: p.phase, seed: p.seed };
    },
  
};
