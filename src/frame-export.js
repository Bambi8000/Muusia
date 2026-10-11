/* Animation print passes. Split only: never fit, translate or duplicate marks. */
export function splitFramePens(ps, pens) {
  const groups = new Map();
  for (const path of ps.paths) {
    if (path.pts.length < 2) continue;
    const layer = Number.isFinite(path.layer) ? Math.round(path.layer) : 0;
    const pen = ((layer % pens.length) + pens.length) % pens.length;
    if (!groups.has(pen)) groups.set(pen, []);
    groups.get(pen).push({ ...path, layer: pen });
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([pen, paths]) => ({ pen, ps: { ...ps, paths } }));
}
const safeName = value => String(value).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'patch';
export function penFrameName(project, pen, frame, kind) {
  return `pen-${String(pen).padStart(2, '0')}/${safeName(project || 'patch')}-frame-${String(frame + 1).padStart(3, '0')}.${kind}`;
}
export function finishPenPasses(files, { frameCount, W, H, pens, kind }) {
  files.sort((a, b) => a.pen - b.pen || a.frame - b.frame);
  const used = [...new Set(files.map(f => f.pen))];
  const passes = used.map(pen => ({
    pen, name: pens[pen].name, colour: pens[pen].c,
    frames: Array.from({ length: frameCount }, (_, frame) => {
      const f = files.find(f => f.pen === pen && f.frame === frame);
      return { frame: frame + 1, file: f?.name || null, paths: f?.pathCount || 0 };
    }),
  }));
  const manifest = { format: 'muusia-pen-passes', version: 1, kind, frameCount, canvasMm: { W, H }, passes };
  const instructions = [
    'MUUSIA — ALL FRAMES BY PEN', '',
    `Canvas: ${W} × ${H} mm. ${frameCount} frames/sheets. File frame numbers start at 001.`,
    'Print every file in the first pen folder, in frame-number order. Then change pen and repeat with the SAME numbered sheets in the next folder.',
    ...passes.map((p, i) => `${i + 1}. pen-${String(p.pen).padStart(2, '0')}: ${p.name} (${p.colour}), ${p.frames.filter(f => f.file).length} files.`), '',
    'Use a fixed paper stop/jig and the same machine origin, scale and orientation for every pass. Keep the sheets in order. Let the ink dry before handling.',
    'Coordinates and page size are identical across passes. Do not auto-fit a small highlight file to the page in your SVG/DXF plotting software.',
    'Marks and frame numbers stay on their assigned pen, once only. Set Frame Grid Marker pen to the base pen before export; use Map canvas, not Fit each.',
    'Empty pen/frame combinations have no plot file (skip that sheet in this pass). manifest.json lists every frame; null means nothing to draw.',
    'Each G-code file contains one pen. Machine start/end commands, homing and any explicitly configured service pauses still apply. This is a folder of separate sheet jobs, not one unattended job.',
    'For Frame Grid with multiple cells, each exported frame is one SHEET; set ANIMATE Frames to the page count. For one frame per A4, use Custom 1 × 1 and match Total frames to ANIMATE Frames.', '',
  ].join('\n');
  return [...files.map(({ name, text }) => ({ name, text })), { name: 'README.txt', text: instructions }, { name: 'manifest.json', text: JSON.stringify(manifest, null, 2) + '\n' }];
}
