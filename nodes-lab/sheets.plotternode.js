({
  /* Sheets — frame-domain sheet selector for layered plexi/glass pieces.
   *
   * Merge-shaped: N paths inputs, but instead of combining them it passes
   * through EXACTLY ONE — the input whose index equals the current animation
   * frame. Set ANIMATE Frames = the wired input count and every frame becomes
   * one sheet: the ANIMATE scrubber flips through sheets in the editor, the
   * Stack View overlay (S) shows them stacked in 3D (it auto-detects this
   * node and takes the sheet count from the wired inputs), and every
   * per-frame export (SVG/DXF/G-code x N, Stack View ZIP) writes one file
   * per sheet.
   *
   * Select "Manual" pins the output to one sheet regardless of the frame —
   * handy when tuning a single sheet without touching ANIMATE.
   *
   * Each sheet keeps its full pen colors: unlike pens-as-sheets, one sheet
   * here can be a complete multi-pen composition. Unwired inputs yield an
   * empty sheet. No randomness — nothing to seed.
   */

  key: "sheets",
  name: "Sheets", cat: "duo",
  ins: (node) => Array.from(
    { length: (node && node.params && Math.round(node.params.count)) || 4 },
    (_, i) => Pin("paths", "sheet " + (i + 1))
  ),
  outs: [Pin("paths")],
  params: [
    { key: "count", label: "Sheets", type: "slider", min: 2, max: 12, step: 1, def: 4 },
    { key: "select", label: "Select", type: "select", options: ["Frame", "Manual"], def: "Frame" },
    { key: "manual", label: "Manual sheet #", type: "slider", min: 1, max: 12, step: 1, def: 1 },
  ],
  compute(ins, p, ctx) {
    const n = Math.max(2, Math.min(12, Math.round(p.count) || 4));
    /* Frame mode follows the animation clock (and the ANIMATE scrubber in
       the editor); Manual pins one sheet. Both clamp into the pin range. */
    let idx = p.select === "Manual"
      ? Math.round(p.manual) - 1
      : ((ctx && ctx.frameIdx) || 0);
    idx = Math.min(n - 1, Math.max(0, idx));
    const src = ins[idx];
    return src && src.paths ? { paths: src.paths } : EMPTY;
  },
})
