import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "clockface",
  name: "Clock Face",
  cat: "gen",
  group: "geometric",
  desc: "A clock dial without hands or numerals: hour batons around a circle, minute marks between them, an optional center dot and rim ring. Each hour marker is a closed quad — Keystone tapers it (0 = rectangle, positive = wider at the rim like a classic radial baton, negative = wider toward the center; at ±1 it collapses to a triangle). Hours is a parameter (12 = a clock, 24 = a day dial, other counts go abstract). Quarter scale enlarges the markers at the quarter positions (with 12 hours: 12, 3, 6 and 9 — the markers that land exactly on a quarter fraction of the circle grow, so counts not divisible by 4 scale fewer of them — e.g. 10 hours scales top and bottom only). Minute marks: None, Dots or radial Lines, with Subdivisions per hour gap; they draw on their own pen. Rim is an optional full circle whose radius is set as a percentage of the dial radius. Outlines only — wire the output through a hatch or fill node to blacken the batons. Center X/Y and Diameter are value ports, so the whole dial can be driven or animated.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "hours", label: "Hours", type: "slider", min: 2, max: 24, step: 1, def: 12 },
    { key: "diameter", label: "Diameter mm", type: "slider", min: 10, max: 400, step: 1, def: 120 },
    { key: "cx", label: "Center X %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "cy", label: "Center Y %", type: "slider", min: 0, max: 100, step: 0.5, def: 50 },
    { key: "rot", label: "Rotate \u00b0", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "len", label: "Baton length mm", type: "slider", min: 1, max: 60, step: 0.5, def: 12 },
    { key: "wid", label: "Baton width mm", type: "slider", min: 0.5, max: 30, step: 0.5, def: 4 },
    { key: "keystone", label: "Keystone", type: "slider", min: -1, max: 1, step: 0.05, def: 0 },
    { key: "inset", label: "Rim inset mm", type: "slider", min: 0, max: 40, step: 0.5, def: 0 },
    { key: "quarterScale", label: "Quarter scale", type: "slider", min: 0.5, max: 2, step: 0.05, def: 1 },
    { key: "minutes", label: "Minute marks", type: "select", options: ["None", "Dots", "Lines"], def: "Lines" },
    { key: "subs", label: "Subdivisions", type: "slider", min: 1, max: 9, step: 1, def: 4 },
    { key: "minDot", label: "Dot mm", type: "slider", min: 0.3, max: 5, step: 0.1, def: 1 },
    { key: "minTick", label: "Tick length mm", type: "slider", min: 0.5, max: 20, step: 0.5, def: 3 },
    { key: "showCenter", label: "Show center", type: "check", def: true },
    { key: "centerSize", label: "Center mm", type: "slider", min: 0.5, max: 10, step: 0.5, def: 2 },
    { key: "rim", label: "Rim circle", type: "check", def: false },
    { key: "rimR", label: "Rim % of radius", type: "slider", min: 20, max: 140, step: 1, def: 100 },
    { key: "penH", label: "Markers pen", type: "pen", def: 0 },
    { key: "penM", label: "Minutes pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const X = (ctx.W * p.cx) / 100, Y = (ctx.H * p.cy) / 100;
    const R = Math.max(1, p.diameter / 2);
    const g = [
      { kind: "point", x: X, y: Y },
      { kind: "circle", cx: X, cy: Y, r: R },
    ];
    if (p.rim) g.push({ kind: "circle", cx: X, cy: Y, r: (R * p.rimR) / 100 });
    return g;
  },
  compute(ins, p, ctx) {
    const X = (ctx.W * p.cx) / 100, Y = (ctx.H * p.cy) / 100;
    const R = Math.max(1, p.diameter / 2);
    const hours = Math.max(2, Math.round(p.hours));
    const LH = Math.round(p.penH), LM = Math.round(p.penM);
    const paths = [];
    const D2R = Math.PI / 180;
    /* angle 0 = 12 o'clock (screen up), positive = clockwise on screen */
    const dir = (aDeg) => {
      const a = aDeg * D2R;
      return [Math.sin(a), -Math.cos(a)];
    };
    const circle = (cx0, cy0, rad, layer) => {
      const n = Math.max(12, Math.round(rad * 8));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([cx0 + Math.cos(a) * rad, cy0 + Math.sin(a) * rad]);
      }
      paths.push({ pts, closed: true, layer });
    };
    /* hour batons: closed trapezoids (keystone quads) */
    const k = Math.max(-1, Math.min(1, p.keystone));
    const step = 360 / hours;
    for (let i = 0; i < hours; i++) {
      const q = p.quarterScale !== 1 && (i * 4) % hours === 0 ? p.quarterScale : 1;
      const a = p.rot + i * step;
      const [dx, dy] = dir(a);
      const tx = -dy, ty = dx; /* tangent, clockwise-consistent */
      const rOut = Math.max(0, R - p.inset);
      const rIn = Math.max(0, rOut - p.len * q);
      const hOut = Math.max(0, (p.wid * q * (1 + k)) / 2);
      const hIn = Math.max(0, (p.wid * q * (1 - k)) / 2);
      const P = (r, h, s) => [X + dx * r + tx * h * s, Y + dy * r + ty * h * s];
      const pts = [P(rOut, hOut, -1), P(rOut, hOut, 1), P(rIn, hIn, 1), P(rIn, hIn, -1)];
      paths.push({ pts, closed: true, layer: LH });
    }
    /* minute marks between the hours */
    if (p.minutes !== "None") {
      const subs = Math.max(1, Math.round(p.subs));
      const per = subs + 1;
      const total = hours * per;
      const rOut = Math.max(0, R - p.inset);
      for (let j = 0; j < total; j++) {
        if (j % per === 0) continue; /* hour position */
        const a = p.rot + (j / total) * 360;
        const [dx, dy] = dir(a);
        if (p.minutes === "Dots") {
          const rr = Math.max(0.15, p.minDot / 2);
          circle(X + dx * (rOut - rr), Y + dy * (rOut - rr), rr, LM);
        } else {
          const rIn = Math.max(0, rOut - p.minTick);
          paths.push({ pts: [[X + dx * rOut, Y + dy * rOut], [X + dx * rIn, Y + dy * rIn]], closed: false, layer: LM });
        }
      }
    }
    /* center: spiral-filled solid dot (Single Marker Dot convention) */
    if (p.showCenter) {
      const r = Math.max(0.25, p.centerSize / 2);
      const pitch = 0.4;
      const turns = Math.max(1, r / pitch);
      const n = Math.max(24, Math.round(turns * 24));
      const pts = [];
      for (let kk = 0; kk <= n; kk++) {
        const t = kk / n;
        const rad = r * (1 - t);
        const a = t * turns * Math.PI * 2;
        pts.push([X + Math.cos(a) * rad, Y + Math.sin(a) * rad]);
      }
      paths.push({ pts, closed: false, layer: LH });
    }
    /* rim ring */
    if (p.rim) circle(X, Y, Math.max(0.5, (R * p.rimR) / 100), LH);
    return applyStyle({ paths }, ins[0]);
  },
};
