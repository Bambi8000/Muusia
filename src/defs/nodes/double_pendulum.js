import { Pin, PENS, applyStyle } from "../helpers.js";
import { fitCanvasPaths } from "../canvas-fit.js";
import { drawFullDisc, fullDiscFrame } from "../double-pendulum-disc.js";

export default {
  key: "double_pendulum",
  name: "Double Pendulum",
  cat: "gen",
  group: "scientific",
  desc: "Mode Full disc is a driven drawing extension that distributes one continuous stroke around the whole disc instead of letting gravity settle it at the bottom. Fill centre removes the unequal-arm inner hole; equal arms already reach the centre. Slow radial breathing spreads circular turning points. Avoid retracing is on by default in this mode: Line spacing mm sets the clearance from older near-parallel ink (including opposite directions), sharp backtracking is refused, and checked smooth detours can rejoin a later free part of the motion. Crossings at other angles remain possible. The route can stop before the requested duration when the bounded search finds no continuation; it never lifts to restart. Traces adds 1–8 successive perturbed runs to the same continuous driven route for a denser result, with Time per run and Perturb deg gradually changing the second arm phase. The whole route shares the same retracing protection and bounded point budget, so crowding can limit the effective density. Trace and Pen per trace are unused in Full disc, which always has one path and one pen before Style. A dashed Style can split it. Fit canvas fits the complete circle and its guide to the sheet without rescaling the clearance afterwards. Physical nib width, pressure, paper and repeated crossings still affect wear. Mode Gravity retains the original simulation: A real double pendulum drawing its chaotic trace \u2014 two arms under gravity, integrated with fixed-step RK4, fully deterministic from the parameters. Trace picks what draws: the classic Bob 2 tip, Bob 1, Both, or the arm Midpoint. Traces runs several pendulums side by side with a tiny angle offset (Perturb, degrees) between them: chaos tears the bundle apart \u2014 the butterfly effect on paper \u2014 optionally one pen per trace. Arm 1/2 are millimetres (the trace provably stays inside their sum around the Pivot), Mass 2 skews the dynamics, Gravity scales tempo, Damping bleeds energy so the line spirals into rest for a finite drawing (0 = endless chaos, cut by Time). Start angles set the drop; Detail decimates the trace by distance. Tip: Traces 6, Perturb 0.05, pen per trace, Damping 0.05 is the poster.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "motion", label: "Mode", type: "select", options: ["Gravity", "Full disc"], def: "Gravity" },
    { key: "fillCentre", label: "Fill centre", type: "check", def: true, showIf: p => p.motion === "Full disc" },
    { key: "noRetrace", label: "Avoid retracing", type: "check", def: true, showIf: p => p.motion === "Full disc" },
    { key: "lineGap", label: "Line spacing mm", type: "slider", min: .2, max: 3, step: .1, def: .6, showIf: p => p.motion === "Full disc" && p.noRetrace !== false },
    { key: "fitCanvas", label: "Fit canvas", type: "check", def: true },
    { key: "trace", label: "Trace", type: "select",
      options: ["Bob 2", "Bob 1", "Both", "Midpoint"], def: "Bob 2", showIf: p => p.motion !== "Full disc" },
    { key: "traces", label: "Traces", type: "slider", min: 1, max: 8, step: 1, def: 1 },
    { key: "perturb", label: "Perturb deg", type: "slider", min: 0.001, max: 2, step: 0.001, def: 0.05 },
    { key: "l1", label: "Arm 1 mm", type: "slider", min: 10, max: 80, step: 0.5, def: 40 },
    { key: "l2", label: "Arm 2 mm", type: "slider", min: 10, max: 80, step: 0.5, def: 40 },
    { key: "m2", label: "Mass 2", type: "slider", min: 0.2, max: 5, step: 0.05, def: 1 },
    { key: "a1", label: "Start angle 1", type: "slider", min: -180, max: 180, step: 1, def: 120 },
    { key: "a2", label: "Start angle 2", type: "slider", min: -180, max: 180, step: 1, def: -35 },
    { key: "grav", label: "Gravity", type: "slider", min: 0.2, max: 3, step: 0.05, def: 1 },
    { key: "damp", label: "Damping", type: "slider", min: 0, max: 0.5, step: 0.005, def: 0.04 },
    { key: "time", label: "Time s", type: "slider", min: 1, max: 120, step: 1, def: 25 },
    { key: "detail", label: "Detail mm", type: "slider", min: 0.3, max: 2, step: 0.05, def: 0.6 },
    { key: "cx", label: "Pivot X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Pivot Y %", type: "slider", min: 0, max: 100, step: 1, def: 42 },
    { key: "penEach", label: "Pen per trace", type: "check", def: false, showIf: p => p.motion !== "Full disc" },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    if (p.motion === "Full disc") {
      const { x, y, radius } = fullDiscFrame(p, ctx);
      return [{ kind: "point", x, y }, { kind: "circle", cx: x, cy: y, r: radius }];
    }
    const X = (ctx.W * p.cx) / 100, Y = (ctx.H * p.cy) / 100;
    return [
      { kind: "point", x: X, y: Y },
      { kind: "circle", cx: X, cy: Y, r: p.l1 },
      { kind: "circle", cx: X, cy: Y, r: p.l1 + p.l2 },
    ];
  },
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const X = (W * p.cx) / 100, Y = (H * p.cy) / 100;
    const L1 = Math.max(1, p.l1), L2 = Math.max(1, p.l2);
    const m1 = 1, m2 = Math.max(0.05, p.m2);
    const g = 9810 * Math.max(0.05, p.grav); // mm / s^2
    const c = Math.max(0, p.damp);
    const dt = 0.004;
    const steps = Math.min(60000, Math.round(Math.max(0.5, p.time) / dt));
    const nT = Math.max(1, Math.round(p.traces));
    const basePen = Math.round(p.layer) % PENS.length;
    const det = Math.max(0.1, p.detail);
    const paths = [];
    let budget = 112000;
    const push = (pts, layer) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed: false, layer });
    };

    // equations of motion (standard double pendulum) + velocity damping
    const accel = (t1, t2, w1, w2) => {
      const d = t1 - t2;
      const sd = Math.sin(d), cd = Math.cos(d);
      const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
      const a1 =
        (-g * (2 * m1 + m2) * Math.sin(t1) -
          m2 * g * Math.sin(t1 - 2 * t2) -
          2 * sd * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cd)) /
        (L1 * den) - c * w1;
      const a2 =
        (2 * sd *
          (w1 * w1 * L1 * (m1 + m2) +
            g * (m1 + m2) * Math.cos(t1) +
            w2 * w2 * L2 * m2 * cd)) /
        (L2 * den) - c * w2;
      return [a1, a2];
    };
    const step = (s) => {
      // RK4 on state [t1, t2, w1, w2]
      const f = ([t1, t2, w1, w2]) => {
        const [a1, a2] = accel(t1, t2, w1, w2);
        return [w1, w2, a1, a2];
      };
      const add = (a, b, h) => a.map((v, i) => v + b[i] * h);
      const k1 = f(s);
      const k2 = f(add(s, k1, dt / 2));
      const k3 = f(add(s, k2, dt / 2));
      const k4 = f(add(s, k3, dt));
      return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    };

    if (p.motion === "Full disc") {
      const pts = drawFullDisc(p, ctx, step);
      return applyStyle({ paths: pts.length > 1 ? [{ pts, closed: false, layer: (basePen + PENS.length) % PENS.length }] : [] }, ins[0]);
    }

    for (let k = 0; k < nT; k++) {
      const layer = p.penEach ? (basePen + k) % PENS.length : basePen;
      let s = [
        ((p.a1 + 0) * Math.PI) / 180,
        ((p.a2 + k * p.perturb) * Math.PI) / 180,
        0, 0,
      ];
      const bob1 = (st) => [X + Math.sin(st[0]) * L1, Y + Math.cos(st[0]) * L1];
      const bob2 = (st) => {
        const b = bob1(st);
        return [b[0] + Math.sin(st[1]) * L2, b[1] + Math.cos(st[1]) * L2];
      };
      const want = [];
      if (p.trace === "Bob 2" || p.trace === "Both") want.push(bob2);
      if (p.trace === "Bob 1" || p.trace === "Both") want.push(bob1);
      if (p.trace === "Midpoint")
        want.push((st) => {
          const b1 = bob1(st), b2 = bob2(st);
          return [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
        });

      const runs = want.map((fn) => [fn(s)]);
      const last = runs.map((r) => r[0]);
      for (let i = 0; i < steps && budget > runs.length * 4; i++) {
        s = step(s);
        for (let w = 0; w < want.length; w++) {
          const q = want[w](s);
          if (Math.hypot(q[0] - last[w][0], q[1] - last[w][1]) >= det) {
            runs[w].push(q);
            last[w] = q;
          }
        }
      }
      for (const r of runs) push(r, layer);
    }
    return applyStyle({ paths: p.fitCanvas === false ? paths : fitCanvasPaths(paths, ctx) }, ins[0]);
  },
};
