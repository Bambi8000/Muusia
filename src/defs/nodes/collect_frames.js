import { Pin } from "../helpers.js";

export default {
  /* Collect Frames — the animation fan-out: wire in a Frame-clock-animated
   * branch and every animation frame comes out as its own output, ready to
   * plug straight into Frame Grid's input pins (or Sheets, or per-frame
   * restyling branches).
   *
   * This node needs the engine's frameFan seam (tools/era/patch-frame-fan.mjs):
   * when the engine reaches a frameFan node it re-evaluates the level once
   * per output with ctx.frameIdx = 0..N-1 and ctx.frameCount = N, and
   * collects this node's input across those runs. The Frames count on THIS
   * node therefore defines the animation's frame domain — the upstream
   * Frame node sees frameCount = N here regardless of the ANIMATE panel,
   * so the fan is complete and seamless whatever the panel is set to.
   *
   * Costs and bounds, stated honestly: every evaluation of a patch that
   * contains this node runs the level N extra times, so a heavy generator
   * behind a 16-frame collector multiplies its cost by 17 on every param
   * tweak. Inside a Group the level's own upstream animates but the group's
   * BOUND inputs arrive frozen at the outer frame; chained collectors do
   * not nest (the inner one yields empty frames during collection) — one
   * collector per dependency chain.
   *
   * Without the seam (validators, older builds, and the engine's own inner
   * collection passes) compute falls back to routing the single current
   * frame to its own output and leaving the rest empty.
   *
   * Pure per evaluation, no randomness — nothing to seed.
   */

  key: "collect_frames",
  name: "Collect Frames",
  cat: "duo",
  frameFan: true,
  desc: "Fans a Frame-clock-animated input out into one output per animation frame: the engine re-evaluates the upstream once per frame (frameIdx 0..N-1, frameCount = N) and each result gets its own pin, ready for Frame Grid. The Frames count here defines the animation's frame domain. Evaluation cost multiplies by the frame count.",

  ins: [Pin("paths", "animated")],
  outs: (node) => {
    const n = Math.max(2, Math.min(16, Math.round((node && node.params && node.params.count) || 6)));
    return Array.from({ length: n }, (_, i) => Pin("paths", "frame " + (i + 1)));
  },

  params: [
    { key: "count", label: "Frames", type: "slider", min: 2, max: 16, step: 1, def: 6 },
  ],

  compute(ins, p, ctx) {
    /* Fallback only — the frameFan engine seam computes the real outputs.
       Here the one frame this evaluation can see lands in its own output. */
    const n = Math.max(2, Math.min(16, Math.round(Number(p.count) || 6)));
    const idx = Math.min(n - 1, Math.max(0, (ctx && ctx.frameIdx) || 0));
    const src = ins[0];
    return Array.from({ length: n }, (_, k) =>
      k === idx && src && src.paths ? { paths: src.paths } : { paths: [] });
  },
};
