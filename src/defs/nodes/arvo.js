import { Pin } from "../helpers.js";

export default {
  key: "arvo",
    name: "Value", cat: "math", ins: [], outs: [Pin("value")],
    params: [{ key: "v", label: "Value", type: "slider", min: -100, max: 100, step: 0.5, def: 4 }],
    compute(_ins, p) { return p.v; },
  
};
