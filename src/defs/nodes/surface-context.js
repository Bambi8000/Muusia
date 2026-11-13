import { Pin } from "../helpers.js";

export default {
  key: "surfacecontext", name: "Surface Context", cat: "math", ins: [],
  desc: "Paper-local context for Surface Composer Independent Content. Connect Paper #, position, angle or stable Seed to graph parameters. X/Y and distance use the full surface; width/length use the original paper, even when resuming a range. Outside independent evaluation the outputs describe one unrotated canvas.",
  outs: [Pin("value", "Paper #"), Pin("value", "Print rank"), Pin("value", "Count"), Pin("value", "X mm"), Pin("value", "Y mm"), Pin("value", "Angle deg"), Pin("value", "Width mm"), Pin("value", "Length mm"), Pin("value", "Distance mm"), Pin("value", "Seed"), Pin("value", "Index 0-1")],
  params: [],
  compute(ins, p, ctx) {
    const s = ctx.surface;
    if (!s) return [1, 1, 1, ctx.W / 2, ctx.H / 2, 0, ctx.W, ctx.H, 0, 1, 0];
    return [s.number, s.printRank, s.count, s.centerXmm, s.centerYmm, s.rotationDeg, s.widthMm, s.lengthMm, s.distanceMm, s.seed, s.t];
  }
};
