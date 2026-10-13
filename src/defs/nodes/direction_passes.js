import { Pin, EMPTY } from "../helpers.js";

export default {
  key: "direction_passes",
  name: "Direction Passes",
  cat: "mod",
  group: "penout",
  desc: "Separates an incoming drawing into Horizontal, Vertical and Other runs without moving or scaling it. Corners in joined paths and closed shapes become separate strokes for the corresponding pass. Angle tolerance accepts nearly horizontal or vertical segments without straightening them. Preview changes only the first output; the three pass outputs always remain complete. Use the Direction passes G-code downloads to run Horizontal, turn the tool manually 90 degrees about its centre, then run Vertical with the same paper position and machine origin. Other directions are kept in a separate file. No tip geometry or spacing is assumed.",
  ins: [Pin("paths", "Drawing")],
  outs: [Pin("paths", "Preview"), Pin("paths", "Horizontal"), Pin("paths", "Vertical"), Pin("paths", "Other")],
  params: [
    { key: "tolerance", label: "Angle tolerance °", type: "slider", min: 0, max: 15, step: 0.1, def: 0.1 },
    { key: "preview", label: "Preview", type: "select", options: ["All", "Horizontal", "Vertical", "Other"], def: "All" },
  ],
  compute(ins, p) {
    const src = ins[0] || EMPTY;
    const groups = [[], [], []];
    const tolerance = Math.max(0, Math.min(44.9, Number.isFinite(p.tolerance) ? p.tolerance : 0.1));
    const clone = path => ({ ...path, pts: path.pts.map(q => q.slice()) });
    for (const path of src.paths || []) {
      if (!path.pts || path.pts.length < 2) continue;
      const points = path.closed ? [...path.pts, path.pts[0]] : path.pts;
      const types = [];
      for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i - 1][0], dy = points[i][1] - points[i - 1][1];
        if (Math.hypot(dx, dy) <= 1e-9) { types.push(null); continue; }
        const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
        types.push(angle <= tolerance + 1e-9 ? 0 : angle >= 90 - tolerance - 1e-9 ? 1 : 2);
      }
      const first = types.find(type => type !== null);
      if (first === undefined) { groups[2].push(clone(path)); continue; }
      // Repeated XY points may carry depth changes; retain them with the run.
      let previous = first;
      for (let i = 0; i < types.length; i++) {
        if (types[i] === null) types[i] = previous;
        else previous = types[i];
      }
      const runs = [];
      for (let i = 0; i < types.length; i++) {
        const last = runs[runs.length - 1];
        if (last && last.type === types[i]) last.pts.push(points[i + 1]);
        else runs.push({ type: types[i], pts: [points[i], points[i + 1]] });
      }
      if (runs.length === 1) { groups[runs[0].type].push(clone(path)); continue; }
      if (path.closed && runs[0].type === runs[runs.length - 1].type) {
        const last = runs.pop();
        runs[0].pts = last.pts.concat(runs[0].pts.slice(1));
      }
      runs.forEach((run, i) => {
        const fragment = { ...path, closed: false, pts: run.pts.map(q => q.slice()) };
        if (i) delete fragment.__stop;
        groups[run.type].push(fragment);
      });
    }
    const passes = groups.map(paths => ({ paths }));
    const selected = ["Horizontal", "Vertical", "Other"].indexOf(p.preview);
    const preview = selected < 0 ? { paths: (src.paths || []).filter(path => path.pts && path.pts.length >= 2).map(clone) } : passes[selected];
    return [preview, ...passes];
  },
};
