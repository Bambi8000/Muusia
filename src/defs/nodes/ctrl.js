import { Pin } from "../helpers.js";

export default {
  /* Controller - live hardware/keyboard input as graph values.

     DETERMINISM CONTRACT. This node is a PURE reader. It never touches the
     DOM, a gamepad or a key event. The live values live in PARAMS, and the
     engine-side listener (src/live-input.jsx) writes them with setParam. That
     is deliberate: params are saved in the patch, so a gesture is reproducible,
     exports and thumbnails re-evaluate to exactly what was on screen, and
     compute stays a pure function of (ins, p, ctx).

     ONE STORAGE MODEL. Every channel in every layout is stored NORMALISED
     0-1 in v1..v6 and mapped into Out min..Out max by compute. An earlier
     design gave each pad control its own natural unit - degrees, counts,
     0/1 - which forced the output range to apply to some layouts and not
     others, and needed a separate parameter per control. Keeping one unit
     means the range, the snap, the keyboard nudge and the panel readout are
     the same code for a stick axis, a d-pad step and a trigger.

     A layout therefore only decides WHICH physical control drives WHICH
     channel, and what the pins are called. The inspector rows stay CH1..CH4
     because parameter labels are static; the pin labels and the LIVE panel
     show the real names.

     _layouts is read by outs and compute here AND by src/live-input.jsx, which
     keeps its own copy; validate-ctrl.mjs asserts the two are identical,
     because a silent drift between them would wire a pin to the wrong
     control and nothing else would notice. */
  key: "ctrl",
  name: "Controller",
  cat: "math",
  desc: "Turns live input into graph values. Layout picks what drives the outputs. Channels is the generic 1-6 set nudged by the arrow keys or driven by gamepad axes. Sticks gives four pins, LX and LY from the left stick and RX and RY from the right, so each stick reaches two parameters at once. D-pad + triggers gives Pad X, Pad Y, L2 and R2: left and right step Pad X down and up by D-pad step, up and down do the same to Pad Y, and the two analog triggers land on their own pins - a stepped pair for exact increments alongside a pressure-sensitive pair for sweeps. Every channel is stored normalised 0-1 and mapped into Out min..Out max with optional Snap, so one output range covers all of them and the values save with the patch and replay identically on export. Axis mode Absolute maps stick position straight across the range while Jog integrates deflection over time, so a self-centring stick behaves like an endless jog wheel - push and the value travels, let go and it stays. Source Keyboard drives the ARMED Controller in any layout: up and down nudge the active channel, left and right pick it, Shift is coarse and Alt fine, and a Controller stays armed while you go on to select and preview other nodes. Freeze stops all live writing so a tuned value stays put.",
  ins: [],

  /* [param key, pin label, kind, gamepad index]
     kind: "axis" = stick axis · "dpad" = [minus button, plus button] · "trigger" */
  _layouts: {
    "Channels": null,
    "Sticks": [["v1", "LX", "axis", 0], ["v2", "LY", "axis", 1], ["v3", "RX", "axis", 2], ["v4", "RY", "axis", 3]],
    "D-pad + triggers": [["v1", "Pad X", "dpad", [14, 15]], ["v2", "Pad Y", "dpad", [13, 12]], ["v3", "L2", "trigger", 6], ["v4", "R2", "trigger", 7]],
  },

  outs(node) {
    const L = this && this._layouts ? this._layouts[(node && node.params && node.params.layout) || "Channels"] : null;
    if (L) return L.map((c) => Pin("value", c[1]));
    const c = (node && node.params && Math.round(node.params.count)) || 1;
    const n = Math.max(1, Math.min(6, c || 1));
    return Array.from({ length: n }, (_, i) => Pin("value", "CH" + (i + 1)));
  },

  params: [
    { key: "layout", label: "Layout", type: "select", options: ["Channels", "Sticks", "D-pad + triggers"], def: "Channels" },
    { key: "source", label: "Source", type: "select", options: ["Manual", "Keyboard", "Gamepad"], def: "Keyboard" },
    { key: "count", label: "Channels", type: "slider", min: 1, max: 6, step: 1, def: 2, showIf: (p) => p.layout === "Channels" },
    { key: "mode", label: "Axis mode", type: "select", options: ["Absolute", "Jog (integrate)"], def: "Jog (integrate)", showIf: (p) => p.source === "Gamepad" && p.layout !== "D-pad + triggers" },
    { key: "rate", label: "Jog rate / s", type: "slider", min: 0.05, max: 4, step: 0.05, def: 0.6, showIf: (p) => p.source === "Gamepad" && p.layout !== "D-pad + triggers" && p.mode === "Jog (integrate)" },
    { key: "dstep", label: "D-pad step %", type: "slider", min: 0.5, max: 25, step: 0.5, def: 5, showIf: (p) => p.layout === "D-pad + triggers" },
    { key: "dead", label: "Deadzone %", type: "slider", min: 0, max: 40, step: 1, def: 12, showIf: (p) => p.source === "Gamepad" },
    { key: "bind", label: "Binding", type: "text", def: "auto", showIf: (p) => p.source === "Gamepad" },
    { key: "min", label: "Out min", type: "slider", min: -100, max: 100, step: 0.5, def: 0 },
    { key: "max", label: "Out max", type: "slider", min: -100, max: 100, step: 0.5, def: 10 },
    { key: "snap", label: "Snap step (0 = free)", type: "slider", min: 0, max: 10, step: 0.1, def: 0 },
    { key: "freeze", label: "Freeze (stop live writes)", type: "check", def: false },
    { key: "v1", label: "CH1", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5 },
    { key: "v2", label: "CH2", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => p.layout !== "Channels" || Math.round(p.count) >= 2 },
    { key: "v3", label: "CH3", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => p.layout !== "Channels" || Math.round(p.count) >= 3 },
    { key: "v4", label: "CH4", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => p.layout !== "Channels" || Math.round(p.count) >= 4 },
    { key: "v5", label: "CH5", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => p.layout === "Channels" && Math.round(p.count) >= 5 },
    { key: "v6", label: "CH6", type: "slider", min: 0, max: 1, step: 0.001, def: 0.5, showIf: (p) => p.layout === "Channels" && Math.round(p.count) >= 6 },
  ],

  compute(ins, p) {
    const L = this && this._layouts ? this._layouts[p.layout] : null;
    const n = L ? L.length
      : Math.max(1, Math.min(6, Number.isFinite(Math.round(p.count)) ? (Math.round(p.count) || 1) : 1));
    const lo = Number.isFinite(p.min) ? p.min : 0;
    const hi = Number.isFinite(p.max) ? p.max : 1;
    const bot = Math.min(lo, hi), top = Math.max(lo, hi);
    const snap = Number.isFinite(p.snap) && p.snap > 0 ? p.snap : 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const raw = p[L ? L[i][0] : "v" + (i + 1)];
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
};
