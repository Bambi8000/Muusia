export const DIRECTION_PASSES = [
  { id: "horizontal", label: "Horizontal", file: "01-horizontal.gcode", port: 1 },
  { id: "vertical", label: "Vertical", file: "02-vertical.gcode", port: 2 },
  { id: "other", label: "Other", file: "03-other.gcode", port: 3 },
];

export function directionPassFiles(outputs, ctx, exportGcode, prepare = ps => ps) {
  const passes = DIRECTION_PASSES.map(pass => {
    const ps = prepare(outputs?.[pass.port] || { paths: [] });
    return { ...pass, ps, pathCount: ps.paths.length };
  });
  const files = passes.filter(pass => pass.pathCount).map(pass => ({
    name: pass.file,
    pass: pass.id,
    text: `; MUUSIA DIRECTION PASS: ${pass.label}\n; Manual tool rotation between files; unchanged canvas coordinates.\n` + exportGcode(pass.ps, ctx),
  }));
  const manifest = {
    format: "muusia-direction-passes", version: 1, canvasMm: { W: ctx.W, H: ctx.H },
    rotation: "Manual 90 degrees about the tool centre between Horizontal and Vertical",
    passes: passes.map(({ id, label, file, pathCount }) => ({ id, label, paths: pathCount, file: pathCount ? file : null })),
  };
  const instructions = [
    "MUUSIA — DIRECTION PASSES", "",
    `Canvas: ${ctx.W} × ${ctx.H} mm. Original physical scale and coordinates are retained.`,
    "1. Run 01-horizontal.gcode if present.",
    "2. With the pen raised, turn the tool manually 90 degrees about its centre.",
    "3. Run 02-vertical.gcode if present. Keep the paper position and machine origin unchanged.",
    "No tip geometry, tip spacing or compensation is assumed. The incoming paths define the drawing.",
    "Per-stroke automatic brush rotation is disabled for these manual-rotation passes.",
    "Routing is applied within each file only. Passes cannot interleave.",
    "Each file retains the active profile's origin, Flip Y, lift, feed, pen changes and start/end commands.",
    "Empty passes have no file. Their manifest entry is null.",
    ...(passes[2].pathCount ? ["03-other.gcode contains directions outside the node's horizontal/vertical tolerance. Review these separately and choose the tool orientation before plotting them."] : []),
    "",
  ].join("\n");
  return [...files, { name: "README.txt", text: instructions }, { name: "manifest.json", text: JSON.stringify(manifest, null, 2) + "\n" }];
}
