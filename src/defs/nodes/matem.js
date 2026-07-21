import { Pin } from "../helpers.js";

export default {
  key: "matem",
    name: "Math", cat: "math", ins: [Pin("value", "A"), Pin("value", "B")], outs: [Pin("value")],
    params: [
      { key: "op", label: "Operation", type: "select", options: ["A + B", "A − B", "A × B", "A ÷ B", "min", "max", "A ^ B", "A mod B"], def: "A + B" },
      { key: "a", label: "A (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 1 },
      { key: "b", label: "B (if unwired)", type: "slider", min: -100, max: 100, step: 0.5, def: 1 },
    ],
    compute(ins, p) {
      const A = typeof ins[0] === "number" ? ins[0] : p.a;
      const B = typeof ins[1] === "number" ? ins[1] : p.b;
      switch (p.op) {
        case "A + B": return A + B;
        case "A − B": return A - B;
        case "A × B": return A * B;
        case "A ÷ B": return B === 0 ? 0 : A / B;
        case "min": return Math.min(A, B);
        case "max": return Math.max(A, B);
        case "A ^ B": return Math.pow(A, B);
        case "A mod B": return B === 0 ? 0 : A % B;
        default: return A;
      }
    },
  
};
