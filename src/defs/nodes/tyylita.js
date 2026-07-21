import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "tyylita",
    name: "Apply Style", cat: "mod", group: "fillstyle", ins: [Pin("paths"), Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [],
    compute(ins) { return applyStyle(ins[0] || EMPTY, ins[1]); },
  
};
