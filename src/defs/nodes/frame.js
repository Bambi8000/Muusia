import { Pin, mulberry32 } from "../helpers.js";

export default {
  key: "frame",
  name: "Frame", cat: "math", ins: [],
  desc: "Animation clock with repeatable frame triggers. The first five outputs stay t, frame # (zero-based), wave loop, ping-pong and rot degrees. Bang is a one-frame 1/0 pulse: 1/4 fires on displayed frames 4, 8, 12; Custom uses Every N frames. Random uses Chance % and Seed, so scrubbing and exports repeat the same sequence. With rate/chance/seed fixed during a loop, Toggle starts Off before frame 1 and flips on each Bang, holding until the next hit. Connect Bang to a green checkbox port for momentary On, or Toggle for held On/Off states. Numeric checkbox inputs below 0.5 are Off; 0.5 or above are On. An even number of hits per animation makes Toggle return to its starting state at the loop boundary.",
  outs: [Pin("value", "t 0→1"), Pin("value", "frame #"), Pin("value", "wave loop"), Pin("value", "ping-pong"), Pin("value", "rot °"), Pin("value", "Bang"), Pin("value", "Toggle")],
  params: [
    { key: "bangRate", label: "Bang rate", type: "select", options: ["1/1", "1/2", "1/3", "1/4", "1/6", "1/8", "1/12", "1/16", "1/24", "1/32", "Custom", "Random"], def: "1/4" },
    { key: "bangEvery", label: "Every N frames", type: "slider", min: 1, max: 128, step: 1, def: 4, showIf: p => p.bangRate === "Custom" },
    { key: "bangChance", label: "Chance %", type: "slider", min: 0, max: 100, step: 1, def: 25, showIf: p => p.bangRate === "Random" },
    { key: "bangSeed", label: "Bang seed", type: "seed", def: 41, showIf: p => p.bangRate === "Random" && (Number.isFinite(+p.bangChance) ? +p.bangChance : 25) > 0 && (Number.isFinite(+p.bangChance) ? +p.bangChance : 25) < 100 },
  ],
  compute(ins, p, ctx) {
    // Keep the original five clock outputs and their port indices unchanged.
    const n = Math.max(1, ctx.frameCount || 1);
    const i = Math.min(n - 1, Math.max(0, ctx.frameIdx || 0));
    const t = n > 1 ? i / (n - 1) : 0;
    const tl = i / n;
    const wave = 0.5 - 0.5 * Math.cos(tl * Math.PI * 2);
    const pp = tl < 0.5 ? tl * 2 : 2 - tl * 2;
    const frame = Math.floor(i) + 1;
    let bang, hits;
    if (p.bangRate === "Random") {
      const chance = Number.isFinite(+p.bangChance) ? Math.max(0, Math.min(100, +p.bangChance)) / 100 : .25;
      const seed = Number.isFinite(+p.bangSeed) ? Math.round(+p.bangSeed) | 0 : 41;
      // Reconstruct the prefix from its seed: no playback history or mutable state.
      const rng = mulberry32(seed); hits = 0; bang = 0;
      for (let k = 0; k < frame; k++) { const hit = rng() < chance; if (hit) hits++; if (k === frame - 1) bang = +hit; }
    } else {
      const parsed = /^1\/(\d+)$/.exec(p.bangRate || "1/4");
      const requested = p.bangRate === "Custom" ? +p.bangEvery : parsed ? +parsed[1] : 4;
      const every = Number.isFinite(requested) ? Math.max(1, Math.min(1000000, Math.round(requested))) : 4;
      hits = Math.floor(frame / every); bang = frame % every === 0 ? 1 : 0;
    }
    return [t, i, wave, pp, tl * 360, bang, hits % 2];
  },
};
