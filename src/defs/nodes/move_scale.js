import { Pin, EMPTY } from "../helpers.js";

function placement(src, p, ctx) {
  let ox, oy;
  if (p.origin === "Canvas center") { ox = ctx.W / 2; oy = ctx.H / 2; }
  else if (p.origin === "Custom point") { ox = p.ox; oy = p.oy; }
  else {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const path of src.paths || []) for (const [x, y] of path.pts) {
      if (x < x0) x0 = x; if (y < y0) y0 = y;
      if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    ox = Number.isFinite(x0) ? (x0 + x1) / 2 : ctx.W / 2;
    oy = Number.isFinite(y0) ? (y0 + y1) / 2 : ctx.H / 2;
  }
  const sx = p.scale / 100, sy = p.scaleY > 0 ? p.scaleY / 100 : sx;
  const state = { ox, oy, sx, sy, dx: p.dx, dy: p.dy, ax: 0, ay: 0 };
  if (!["Sway", "Orbit", "Breathe"].includes(p.motion)) return state;
  const num = (key, fallback, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+p[key]) ? +p[key] : fallback));
  const frames = Number.isFinite(+ctx.frameCount) ? Math.max(1, Math.floor(+ctx.frameCount)) : 1;
  const index = Number.isFinite(+ctx.frameIdx) ? Math.max(0, Math.min(frames - 1, Math.floor(+ctx.frameIdx))) : 0;
  const t = p.clock === "Manual" ? 0 : index / frames;
  const cycles = p.clock === "Manual" ? 1 : Math.round(num("cycles", 1, 1, 16));
  const phase = ((num("phase", 0, -1e9, 1e9) / 360 + cycles * t) % 1 + 1) % 1;
  const a = phase * Math.PI * 2;
  const snap = v => Math.abs(v) < 1e-12 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-12 ? Math.sign(v) : v;
  const sin = snap(Math.sin(a)), cos = snap(Math.cos(a));
  const zoom = 1 + num("scaleSwing", 1, 0, 90) / 100 * sin;
  state.sx *= zoom; state.sy *= zoom;
  if (p.motion !== "Breathe") {
    state.ax = num("travelX", 2, 0, 100); state.ay = num("travelY", 1, 0, 100);
    state.dx += state.ax * (p.motion === "Orbit" ? cos : sin);
    state.dy += state.ay * sin;
  }
  return state;
}

export default {
  key: "move_scale",
      name: "Move / Scale",
    cat: "mod", group: "transform",
    desc: "Translate and scale paths around Content center, Canvas center or a Custom point. Motion Off preserves the static transform. Sway moves back and forth; Orbit follows an ellipse; Breathe changes only scale. Travel X/Y are movement amplitudes in mm (2 mm means ±2 mm); Scale swing is a percentage of the base X/Y scales, preserving their ratio. Static Move X/Y remains the centre of the motion. Time source Timeline follows ANIMATE Play directly, without a Frame wire. Cycles is the integer number of loops per exported sequence; Phase offsets the loop. Manual ignores ANIMATE and lets you scrub Phase or wire Frame rot degrees into it. Outside a multi-frame timeline, the selected Phase is shown. The last frame is one time step before the first, avoiding a duplicated endpoint. Guides show the scale origin and centre travel, never plotted. The transform never clips or refits: allow room for the full motion on your paper. For moire, Merge a fixed Moire Disc with a second disc through this node; start with Travel X 2 mm, Y 1 mm and Scale swing 0. A phase difference lets two moving discs counter each other.",
    ins: [Pin("paths")],
    outs: [Pin("paths")],
    params: [
      { key: "dx", label: "Move X mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "dy", label: "Move Y mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0 },
      { key: "scale", label: "Scale %", type: "slider", min: 5, max: 400, step: 1, def: 100 },
      { key: "scaleY", label: "Scale Y % (0 = same)", type: "slider", min: 0, max: 400, step: 1, def: 0 },
      { key: "origin", label: "Scale origin", type: "select", options: ["Content center", "Canvas center", "Custom point"], def: "Content center" },
      { key: "ox", label: "Origin X mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 150, showIf: p => p.origin === "Custom point" },
      { key: "oy", label: "Origin Y mm (custom)", type: "slider", min: 0, max: 400, step: 1, def: 100, showIf: p => p.origin === "Custom point" },
      { key: "motion", label: "Motion", type: "select", options: ["Off", "Sway", "Orbit", "Breathe"], def: "Off" },
      { key: "clock", label: "Time source", type: "select", options: ["Timeline", "Manual"], def: "Timeline", showIf: p => ["Sway", "Orbit", "Breathe"].includes(p.motion) },
      { key: "travelX", label: "Travel X ±mm", type: "slider", min: 0, max: 100, step: .1, def: 2, showIf: p => ["Sway", "Orbit"].includes(p.motion) },
      { key: "travelY", label: "Travel Y ±mm", type: "slider", min: 0, max: 100, step: .1, def: 1, showIf: p => ["Sway", "Orbit"].includes(p.motion) },
      { key: "scaleSwing", label: "Scale swing ±%", type: "slider", min: 0, max: 90, step: .1, def: 1, showIf: p => ["Sway", "Orbit", "Breathe"].includes(p.motion) },
      { key: "cycles", label: "Cycles", type: "slider", min: 1, max: 16, step: 1, def: 1, showIf: p => ["Sway", "Orbit", "Breathe"].includes(p.motion) && p.clock !== "Manual" },
      { key: "phase", label: "Phase °", type: "slider", min: 0, max: 360, step: .5, def: 0, showIf: p => ["Sway", "Orbit", "Breathe"].includes(p.motion) },
    ],
    overlay(p, ctx, ins) {
      const q = placement(ins?.[0] || EMPTY, p, ctx);
      if (![q.ox, q.oy, q.dx, q.dy].every(Number.isFinite)) return [];
      const active = ["Sway", "Orbit", "Breathe"].includes(p.motion);
      const guides = active || p.origin !== "Content center" ? [{ kind: "point", x: q.ox, y: q.oy }] : [];
      if (!active) return guides;
      const x = q.ox + p.dx, y = q.oy + p.dy;
      guides.push({ kind: "point", x: q.ox + q.dx, y: q.oy + q.dy });
      if (p.motion === "Orbit" && q.ax > 0 && q.ay > 0) guides.push({ kind: "poly", pts: Array.from({ length: 65 }, (_, i) => [x + q.ax * Math.cos(i / 64 * 2 * Math.PI), y + q.ay * Math.sin(i / 64 * 2 * Math.PI)]) });
      else if (q.ax || q.ay) guides.push({ kind: "poly", pts: [[x - q.ax, y - q.ay], [x + q.ax, y + q.ay]] });
      return guides;
    },
    compute(ins, p, ctx) {
      const src = ins?.[0] || EMPTY;
      if (!Array.isArray(src.paths) || !src.paths.some(q => q.pts.length)) return EMPTY;
      const { ox, oy, sx, sy, dx, dy } = placement(src, p, ctx);
      const paths = src.paths.map((path) => ({
        ...path,
        pts: path.pts.map(([x, y]) => [
          ox + (x - ox) * sx + dx,
          oy + (y - oy) * sy + dy,
        ]),
      }));
      return { paths };
    }
  
};
