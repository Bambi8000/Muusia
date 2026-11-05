import { Pin, EMPTY, pathLength, noise2 } from "../helpers.js";

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(value)) ? Number(value) : lo));

export default {
  key: "wind",
  name: "Wind",
  cat: "mod",
  group: "deform",
  desc: "Bends paths in a chosen wind direction. Position X/Y places the wind source on the page; Width sets the breadth of its airflow. Angle 0° blows right and 90° blows down. Turbulence adds smooth seeded gusts. Open lines can hold both ends or release either end; closed shapes can hold their windward edge, one windward point, or pass through unchanged. Force, Bendability and Stiffness set the amount of bending.",
  ins: [Pin("paths")],
  outs: [Pin("paths")],
  params: [
    { key: "angle", label: "Wind direction °", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "positionX", label: "Position X %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "positionY", label: "Position Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "width", label: "Wind width mm", type: "slider", min: 20, max: 300, step: 1, def: 100 },
    { key: "force", label: "Wind force", type: "slider", min: 0, max: 40, step: 0.5, def: 16 },
    { key: "bendability", label: "Bendability", type: "slider", min: 0, max: 1, step: 0.01, def: 0.75 },
    { key: "stiffness", label: "Stiffness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.45 },
    { key: "turbulence", label: "Turbulence", type: "slider", min: 0, max: 1, step: 0.01, def: 0 },
    { key: "gustScale", label: "Gust size mm", type: "slider", min: 5, max: 200, step: 1, def: 35 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
    { key: "openAnchor", label: "Open line anchors", type: "select", options: ["Both ends", "Start only", "End only"], def: "Both ends" },
    { key: "closedMode", label: "Closed shapes", type: "select", options: ["Windward edge", "Single anchor", "Off"], def: "Windward edge" },
  ],
  overlay(p, ctx) {
    if (!ctx || !Number.isFinite(ctx.W) || !Number.isFinite(ctx.H)) return [];
    const x = ctx.W * clamp(p.positionX ?? 0, 0, 100) / 100;
    const y = ctx.H * clamp(p.positionY ?? 50, 0, 100) / 100;
    const angle = clamp(p.angle ?? 0, 0, 360) * Math.PI / 180;
    return [{ kind: "point", x, y }, { kind: "arrow", x1: x, y1: y, x2: x + 30 * Math.cos(angle), y2: y + 30 * Math.sin(angle) }];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    if (!src.paths?.length) return EMPTY;
    const force = clamp(p.force, 0, 40);
    const bendability = clamp(p.bendability, 0, 1);
    if (!force || !bendability) return src;

    const angle = clamp(p.angle, 0, 360) * Math.PI / 180;
    const wx = Math.cos(angle), wy = Math.sin(angle);
    const stiffness = clamp(p.stiffness, 0, 1);
    const sourceX = (ctx?.W ?? 300) * clamp(p.positionX ?? 0, 0, 100) / 100;
    const sourceY = (ctx?.H ?? 200) * clamp(p.positionY ?? 50, 0, 100) / 100;
    const width = clamp(p.width ?? 100, 20, 300);
    const turbulence = clamp(p.turbulence ?? 0, 0, 1);
    const gustScale = clamp(p.gustScale ?? 35, 5, 200);
    const seed = Math.round(clamp(p.seed ?? 7, 0, 999999));
    const openAnchor = p.openAnchor || "Both ends";
    const closedMode = p.closedMode || "Windward edge";
    const totalLength = src.paths.reduce((sum, path) =>
      sum + (path.pts?.length > 1 && (!path.closed || closedMode !== "Off") ? pathLength(path.pts, !!path.closed) : 0), 0);
    const step = Math.max(2.5, totalLength / 90000);

    const paths = src.paths.map((path) => {
      if (!path.pts || path.pts.length < 2 || (path.closed && closedMode === "Off")) return path;
      const closed = !!path.closed;
      const sourcePts = path.pts;
      const repeatedSeam = closed && sourcePts.length > 2 && Math.hypot(sourcePts[0][0] - sourcePts.at(-1)[0], sourcePts[0][1] - sourcePts.at(-1)[1]) < 1e-9;
      const sourceCount = sourcePts.length - (repeatedSeam ? 1 : 0);
      if (closed && sourceCount < 3) return path;
      const length = pathLength(sourcePts.slice(0, sourceCount), closed);
      if (length < 1e-9) return path;

      // Keep original corners and sample the closing segment without repeating the seam.
      const pts = [sourcePts[0].slice()];
      const distances = [0];
      let travelled = 0;
      const segments = closed ? sourceCount : sourceCount - 1;
      for (let i = 0; i < segments; i++) {
        const a = sourcePts[i], b = sourcePts[(i + 1) % sourceCount];
        const segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (segment < 1e-9) continue;
        const count = Math.max(!closed && sourceCount === 2 ? 2 : 1, Math.ceil(segment / step));
        for (let j = 1; j <= count; j++) {
          if (closed && i === segments - 1 && j === count) continue;
          const t = j / count;
          pts.push(j === count ? b.slice() : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          distances.push(travelled + segment * t);
        }
        travelled += segment;
      }
      if (pts.length < 3) return path;

      const amount = Math.min(60, force * bendability * Math.min(length / 50, 3) / (1 + 5 * stiffness));
      let windward = 0, minProjection = Infinity, maxProjection = -Infinity;
      const projection = closed ? pts.map((pt, i) => {
        const value = pt[0] * wx + pt[1] * wy;
        if (value < minProjection) { minProjection = value; windward = i; }
        maxProjection = Math.max(maxProjection, value);
        return value;
      }) : null;
      if (closed && maxProjection - minProjection < 1e-9) return path;
      const smoothstep = (value) => {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
      };
      const bent = pts.map((pt, i) => {
        if (!closed && ((i === 0 && openAnchor !== "End only") || (i === pts.length - 1 && openAnchor !== "Start only"))) return pt;
        let envelope;
        if (!closed) {
          const t = distances[i] / length;
          envelope = openAnchor === "Start only" ? smoothstep(t)
            : openAnchor === "End only" ? smoothstep(1 - t)
            : 16 * t * t * (1 - t) * (1 - t);
        } else if (closedMode === "Single anchor") {
          const d = Math.abs(distances[i] - distances[windward]);
          envelope = smoothstep(2 * Math.min(d, length - d) / length);
        } else {
          const u = (projection[i] - minProjection) / (maxProjection - minProjection);
          envelope = smoothstep((u - 0.15) / 0.85);
        }
        if (envelope === 0) return pt;
        const prev = pts[closed ? (i - 1 + pts.length) % pts.length : Math.max(0, i - 1)];
        const next = pts[closed ? (i + 1) % pts.length : Math.min(pts.length - 1, i + 1)];
        const tx = next[0] - prev[0], ty = next[1] - prev[1];
        const tangentLength = Math.hypot(tx, ty);
        if (tangentLength < 1e-9) return pt;
        const ux = tx / tangentLength, uy = ty / tangentLength;
        const relX = pt[0] - sourceX, relY = pt[1] - sourceY;
        const forward = relX * wx + relY * wy;
        const side = relX * wy - relY * wx;
        const field = smoothstep((forward + 10) / 20) * Math.exp(-0.5 * (side / width) ** 2);
        if (field < 1e-9) return pt;
        const localAngle = angle + (turbulence ? (noise2(pt[0] / gustScale, pt[1] / gustScale, seed) - 0.5) * 1.8 * turbulence : 0);
        const localX = Math.cos(localAngle), localY = Math.sin(localAngle);
        const gust = turbulence ? Math.max(0.2, 1 + 2.4 * turbulence * (noise2(pt[0] / gustScale + 19, pt[1] / gustScale - 11, seed + 1) - 0.5)) : 1;
        const along = localX * ux + localY * uy;
        const dx = localX - along * ux, dy = localY - along * uy;
        return [pt[0] + dx * amount * envelope * field * gust, pt[1] + dy * amount * envelope * field * gust];
      });
      return { ...path, pts: bent };
    });
    return { ...src, paths };
  },
};
