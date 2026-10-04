/* Machine profiles — data model, normalisation and the export-workflow gate.
   Pure logic, no React: App.jsx imports this, tools/validate-machine.mjs
   tests it in Node.

   Every profile has an explicit workflow:
     "gcode"        — Muusia generates the machine file (the legacy profiles;
                      Klipper servo / bed-Z commands, Moonraker DRO, laser jig).
     "svg-external" — Muusia exports SVG; the plotter's own software drives the
                      machine (AxiDraw / NextDraw family and any other plotter
                      that plots SVG). No machine commands, no network address,
                      no assumed work area.
   A profile without a workflow field is a legacy profile and means "gcode".

   File format: { app: "muusia-machine", v: 2, minApp: "2.108", prof }.
   v1 files (no workflow) and bare profile objects are read as legacy gcode
   profiles. Patches carry machineFormat: 2 beside machines / machineIdx. */

export const MACHINE_FILE_VERSION = 2;
export const MACHINE_MIN_APP = "2.108";
export const WORKFLOWS = ["gcode", "svg-external"];

/* Legacy project machines — the only place these are defined. */
export const DEFAULT_MACHINE = {
  workflow: "gcode",
  name: "A — Servo Z (multi-tip brush)",
  workW: 330, workH: 240, originX: 0, originY: 0, flipY: false, pauseCmd: "M0", tgPen: false,
  startG: "G21 ; mm\nG90 ; absolute\nG28 ; home",
  endG: "G0 X0 Y0",
  zMode: "servo", servoName: "pen", servoUp: 90, servoDown: 35,
  penUp: 3, penDown: 0, feedDraw: 1800, feedTravel: 6000, zFeed: 600,
  zHop: 1.5, zHopOn: true, penDelayDown: 120, penDelayUp: 80,
  rotOn: false, rotStepper: "pen_rotate", rotThresh: 20,
  dipOn: false, dipX: 320, dipY: 20, dipZ: -2, dipEvery: 800, dipDwell: 600,
  maintOn: false, maintEvery: 4000, maintMsg: "Advance chalk / re-sharpen", maintPark: false, maintX: 20, maintY: 20,
  laserOn: false, laserOffX: 0, laserOffY: 0, laserOnCmd: "SET_PIN PIN=laser VALUE=1", laserOffCmd: "SET_PIN PIN=laser VALUE=0",
  moonrakerUrl: "ws://192.168.0.57:7125/websocket",
  canvasCheckOn: false,
};
export const DEFAULT_MACHINE_B = {
  ...DEFAULT_MACHINE,
  name: "B — Bed Z + rotation",
  zMode: "bed", rotOn: true,
};
/* Gentle: fragile tips (0.35 mm technical pens). Slow feeds, long settles,
   and the Viivain Klipper macros (klipper/printer.cfg): GENTLE_ON caps accel +
   corner velocity for the job, PLOT_GO leaves the fixed Z block pen-up and slow
   before lowering to plot height (it replaces a bare PLOT_HEIGHT in startG),
   GENTLE_OFF restores the limits (CANCEL_PRINT runs it too). MECH-HANDOFF 9.3. */
export const DEFAULT_MACHINE_C = {
  ...DEFAULT_MACHINE,
  name: "C — Gentle (technical pen)",
  feedDraw: 1200, feedTravel: 3000, zFeed: 300, penDelayDown: 300, penDelayUp: 350,
  startG: "G21 ; mm\nG90 ; absolute\nCLEAR_PAUSE\nGENTLE_ON ; 50 mm/s, 250 mm/s2, SCV 2 for fragile tips\nPLOT_GO ; leave the Z block pen-up and slow, then plot height",
  endG: "GENTLE_OFF ; restore printer.cfg motion limits\nG0 X0 Y0 F3000",
};

/* The External SVG template: built from its own small object, never from DEFAULT_MACHINE.
   workW / workH 0 means "not set" — the user enters the verified travel of their own plotter. */
export const DEFAULT_SVG_MACHINE = {
  workflow: "svg-external",
  name: "External SVG plotter",
  manufacturer: "", model: "",
  units: "mm", workW: 0, workH: 0,
  sourceUrl: "", verifiedOn: "",
  notes: "",
};
/* Fields an svg-external profile may carry. Anything else (machine commands, URLs, speeds) is dropped. */
export const SVG_PROFILE_KEYS = ["workflow", "id", "name", "manufacturer", "model", "units", "workW", "workH", "sourceUrl", "verifiedOn", "notes"];

export const SVG_WORKFLOW_HELP =
  "This profile prepares an SVG for an external plotter program; Muusia does not generate machine commands for it. " +
  "Export SVG (or Stack \u2192 Pens \u2192 SVG .zip for several pens) and open the file in your plotter's own software \u2014 " +
  "for AxiDraw / NextDraw the Inkscape extension or the command-line tool; choose the model, paper placement and pen height there. " +
  "The work area below is a comparison picture only, not a verified home position.";

export const workflowOf = (prof) => (prof && prof.workflow === "svg-external" ? "svg-external" : "gcode");
export const isGcodeWorkflow = (prof) => workflowOf(prof) === "gcode";

/* The one refusal every G-code route returns for an svg-external profile. Starts with ';' so it is
   never a runnable command, and names the fix. */
export function gcodeRefusal(prof) {
  const name = (prof && prof.name) || "unnamed";
  return [
    "; MUUSIA: G-code export is disabled for this machine profile.",
    `; "${name}" uses the External SVG workflow: export SVG (or Stack -> Pens -> SVG .zip for several pens)`,
    "; and open it in your plotter's own software; choose the model there.",
    "; To generate G-code, pick a G-code profile in MACHINE SETUP or set this profile's Workflow to G-code.",
  ].join("\n");
}

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const finitePos = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

/* Normalise one profile object (file payload, patch entry, legacy prof).
   -> { prof } or { error }. Never throws, never mutates its input. */
export function normalizeMachine(raw) {
  if (!isObj(raw)) return { error: "Machine profile must be an object." };
  const wf = raw.workflow == null ? "gcode" : raw.workflow;
  if (!WORKFLOWS.includes(wf)) return { error: `Unknown machine workflow "${String(raw.workflow)}" (expected gcode or svg-external).` };
  if (wf === "gcode") {
    /* legacy merge: the user's commands, numbers and A/B choices win over the defaults */
    const prof = { ...DEFAULT_MACHINE, ...raw, workflow: "gcode" };
    return { prof };
  }
  /* svg-external: start from its own template and copy only the allowed fields */
  const prof = { ...DEFAULT_SVG_MACHINE };
  for (const k of SVG_PROFILE_KEYS) if (raw[k] !== undefined) prof[k] = raw[k];
  prof.workflow = "svg-external";
  for (const k of ["name", "manufacturer", "model", "sourceUrl", "verifiedOn", "notes"]) prof[k] = raw[k] == null ? DEFAULT_SVG_MACHINE[k] : String(raw[k]);
  if (prof.units !== "mm") return { error: `SVG profile units must be "mm" (got "${String(prof.units)}").` };
  for (const k of ["workW", "workH"]) {
    const v = raw[k];
    if (v === undefined || v === null || v === "" || v === 0) { prof[k] = 0; continue; }
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!finitePos(n)) return { error: `SVG profile ${k} must be a positive number of millimetres or left unset (got ${JSON.stringify(v)}).` };
    prof[k] = n;
  }
  if (!prof.name.trim()) prof.name = DEFAULT_SVG_MACHINE.name;
  return { prof };
}

/* Assign running ids (machine-1, machine-2, ...) to profiles that have none; keeps existing ids,
   avoids duplicates. Ids are session bookkeeping, not identity across files. */
export function assignIds(list) {
  const used = new Set(list.map((m) => m && m.id).filter(Boolean));
  let n = 0;
  return list.map((m) => {
    if (m.id) return m;
    do { n++; } while (used.has("machine-" + n));
    used.add("machine-" + n);
    return { ...m, id: "machine-" + n };
  });
}
export const nextId = (list) => assignIds([...list.map((m) => ({ ...m, id: m.id || "x" })), {}]).pop().id;

/* Clamp a machine index to a valid integer position; anything invalid -> 0. */
export function clampIdx(idx, n) {
  const i = Math.floor(Number(idx));
  if (!Number.isFinite(i) || i < 0) return 0;
  return Math.min(i, Math.max(0, n - 1));
}

/* Normalise a list from a patch: valid entries are kept, invalid ones reported.
   -> { machines, machineIdx, errors } ; machines is null when nothing valid came in
   (callers then keep their current list - a failed import never empties it). */
export function normalizeMachines(list, idx, format) {
  const errors = [];
  if (format !== undefined && format !== null && (!Number.isInteger(format) || format > MACHINE_FILE_VERSION))
    return { machines: null, machineIdx: 0, errors: [`Unsupported machine format ${String(format)} (this Muusia reads up to ${MACHINE_FILE_VERSION}).`] };
  if (!Array.isArray(list) || !list.length) return { machines: null, machineIdx: 0, errors };
  const out = [];
  list.forEach((m, i) => { const r = normalizeMachine(m); if (r.prof) out.push(r.prof); else errors.push(`machine ${i + 1}: ${r.error}`); });
  if (!out.length) return { machines: null, machineIdx: 0, errors };
  return { machines: assignIds(out), machineIdx: clampIdx(idx, out.length), errors };
}

/* Read a standalone .muusia-machine.json payload (parsed JSON). -> { prof } or { error }. */
export function readMachineFile(data) {
  if (!isObj(data)) return { error: "Machine file must contain a JSON object." };
  if (data.app === "muusia-machine") {
    const v = data.v == null ? 1 : data.v;
    if (!Number.isInteger(v) || v < 1 || v > MACHINE_FILE_VERSION) return { error: `Unsupported machine file version ${String(data.v)} (this Muusia reads 1\u2013${MACHINE_FILE_VERSION}).` };
    if (!isObj(data.prof)) return { error: "Machine file has no profile." };
    return normalizeMachine(data.prof);
  }
  if (data.app) return { error: `Not a machine profile (app: ${String(data.app)}).` };
  return normalizeMachine(data);   /* bare legacy object */
}

/* Serialise one profile to the current file format (without the id, which is session-local). */
export function writeMachineFile(prof) {
  const { id, ...rest } = prof || {};
  const out = { app: "muusia-machine", v: MACHINE_FILE_VERSION, prof: rest };
  if (workflowOf(prof) === "svg-external") out.minApp = MACHINE_MIN_APP;
  return JSON.stringify(out, null, 1);
}

/* Convert a profile to the other workflow, keeping what carries over (name, work area). */
export function convertWorkflow(prof, wf) {
  if (wf === workflowOf(prof)) return prof;
  if (wf === "svg-external") {
    return { ...DEFAULT_SVG_MACHINE, id: prof.id, name: prof.name || DEFAULT_SVG_MACHINE.name, workW: finitePos(prof.workW) ? prof.workW : 0, workH: finitePos(prof.workH) ? prof.workH : 0 };
  }
  return { ...DEFAULT_MACHINE, id: prof.id, name: prof.name || DEFAULT_MACHINE.name, workW: finitePos(prof.workW) ? prof.workW : DEFAULT_MACHINE.workW, workH: finitePos(prof.workH) ? prof.workH : DEFAULT_MACHINE.workH };
}

/* What a node sees as ctx.machine. svg-external has no origin / flip / laser offset. */
export function machineCtx(prof) {
  if (!isGcodeWorkflow(prof)) return { originX: 0, originY: 0, flipY: false, laserOffX: 0, laserOffY: 0, workW: prof.workW || 0, workH: prof.workH || 0, workflow: "svg-external" };
  return { originX: prof.originX || 0, originY: prof.originY || 0, flipY: !!prof.flipY, laserOffX: prof.laserOffX || 0, laserOffY: prof.laserOffY || 0, workW: prof.workW || 0, workH: prof.workH || 0, workflow: "gcode" };
}
