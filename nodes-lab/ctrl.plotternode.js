({
  /* Controller - live hardware/keyboard input as graph values.

     DETERMINISM CONTRACT. This node is a PURE reader. It never touches the
     DOM, a gamepad or a key event. The live values live in the v1..v6
     PARAMS, and the engine-side listener (src/live-input.jsx) writes them
     with setParam. That is deliberate: params are saved in the patch, so a
     gesture is reproducible, exports and thumbnails re-evaluate to exactly
     what was on screen, and compute stays a pure function of (ins, p, ctx).

     v1..v6 are always NORMALISED 0..1. compute maps them into the output
     range, so you can change min/max after the fact without destroying a
     recorded gesture. source / mode / rate / dead / bind / freeze are read
     ONLY by the engine listener - they are deliberately inert here, which
     the validator asserts. */
  key: "ctrl",
  name: "Controller",
  cat: "math",
  desc: "Turns live input into graph values: 1-6 value outputs driven by the arrow keys or a gamepad. Source Keyboard drives the SELECTED Controller node - up/down nudges the active channel, left/right picks the channel, Shift is coarse and Alt is fine. Source Gamepad polls a connected pad; Absolute maps stick position straight to the value, while Jog integrates deflection over time so a self-centring stick or 3D mouse behaves like an endless jog wheel. Manual leaves the channels to the sliders and the XY pad in the LIVE chip. Every channel is stored normalised 0-1 in v1..v6 and mapped into Out min..Out max, with optional Snap; because the values are ordinary parameters they save with the patch and replay identically on export. Freeze stops all live writing so a tuned value stays put.",
  ins: [],
  outs: (node) => {
    const c = (node && node.params && Math.round(node.params.count)) || 1;
    const n = Math.max(1, Math.min(6, c || 1));
    return Array.from({ length: n }, (_, i) => Pin("value", "CH" + (i + 1)));
  },
  params: [
    { key: "source", label: "Source", type: "select", options: ["Manual", "Keyboard", "Gamepad"], def: "Keyboard" },
    { key: "count", label: "Channels", type: "slider", min: 1, max: 6, step: 1, def: 2 },
    { key: "mode", label: "Axis mode", type: "select", options: ["Absolute", "Jog (integrate)"], def: "Jog (integrate)", showIf: (p) => p.source === "Gamepad" },
    { key: "rate", label: "Jog rate / s", type: "slider", min: 0.05, max: 4, step: 0.05, def: 0.6, showIf: (p) => p.source === "Gamepad" && p.mode === "Jog (integrate)" },
    { key: "dead", label: "Deadzone %", type: "slider", min: 0, max: 40, step: 1, def: 12, showIf: (p) => p.source === "Gamepad" },
    { key: "bind", label: "Binding", type: "text", def: "auto", showIf: (p) => p.source === "Gamepad" },
    { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
    { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
    { key: "snap", label: "Snap step (0 = free)", type: "slider", min: 0, max: 10, step: 0.1, def: 0 },
    { key: "freeze", label: "Freeze (stop live writes)", type: "check", def: false },
    { key: "v1", label: "CH1", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5 },
    { key: "v2", label: "CH2", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => Math.round(p.count) >= 2 },
    { key: "v3", label: "CH3", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => Math.round(p.count) >= 3 },
    { key: "v4", label: "CH4", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => Math.round(p.count) >= 4 },
    { key: "v5", label: "CH5", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => Math.round(p.count) >= 5 },
    { key: "v6", label: "CH6", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => Math.round(p.count) >= 6 },
  ],
  compute(ins, p) {
    const cRaw = Math.round(p.count);
    const n = Math.max(1, Math.min(6, Number.isFinite(cRaw) ? cRaw : 1));
    const lo = Number.isFinite(p.min) ? p.min : 0;
    const hi = Number.isFinite(p.max) ? p.max : 1;
    const bot = Math.min(lo, hi), top = Math.max(lo, hi);
    const snap = Number.isFinite(p.snap) && p.snap > 0 ? p.snap : 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const raw = p["v" + (i + 1)];
      let u = Number.isFinite(raw) ? raw : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      let v = lo + u * (hi - lo);
      if (snap > 0) v = Math.round(v / snap) * snap;
      /* clamp AFTER snapping: rounding can otherwise step just past the range */
      v = v < bot ? bot : v > top ? top : v;
      if (!Number.isFinite(v)) v = 0;
      out.push(Object.is(v, -0) ? 0 : v); /* -0 breaks naive equality and export dedupe */
    }
    /* the engine wraps a scalar itself when there is one out pin, and would
       nest an array into [[v]] - so return a bare number at count 1 */
    return n === 1 ? out[0] : out;
  },
})
