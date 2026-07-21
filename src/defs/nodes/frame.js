import { Pin } from "../helpers.js";

export default {
  key: "frame",
    name: "Frame", cat: "math", ins: [],
    outs: [Pin("value", "t 0\u21921"), Pin("value", "frame #"), Pin("value", "wave loop"), Pin("value", "ping-pong")],
    params: [],
    compute(ins, p, ctx) {
      /* animaatioaika: t = lineaarinen ramppi (viim. freimi = 1),
         wave & ping-pong = saumattomat luupit (freimi N == freimi 0) */
      const n = Math.max(1, ctx.frameCount || 1);
      const i = Math.min(n - 1, Math.max(0, ctx.frameIdx || 0));
      const t = n > 1 ? i / (n - 1) : 0;
      const tl = i / n;
      const wave = 0.5 - 0.5 * Math.cos(tl * Math.PI * 2);
      const pp = tl < 0.5 ? tl * 2 : 2 - tl * 2;
      return [t, i, wave, pp];
    },
  
};
