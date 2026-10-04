/* Validator for src/machine.js — the machine-profile model, normalisation and
   workflow gate (Phase 1 of the machine-profiles handoff). Run from the repo root:
   node tools/validate-machine.mjs */

import * as M from "../src/machine.js";

let fails = 0, n = 0;
const ok = (c, msg) => { n++; console.log((c ? "OK   " : "FAIL ") + msg); if (!c) fails++; };
const J = (v) => JSON.stringify(v);

/* --- defaults --- */
ok(M.DEFAULT_MACHINE.workflow === "gcode" && M.DEFAULT_MACHINE_B.workflow === "gcode", "legacy A/B templates are gcode workflow");
ok(M.DEFAULT_MACHINE.name.startsWith("A") && M.DEFAULT_MACHINE_B.zMode === "bed" && M.DEFAULT_MACHINE_B.rotOn === true, "A/B keep their legacy identity");
ok(M.DEFAULT_SVG_MACHINE.workflow === "svg-external" && M.DEFAULT_SVG_MACHINE.workW === 0 && M.DEFAULT_SVG_MACHINE.workH === 0, "SVG template: work area unset (0), not 330x240");
for (const k of ["startG", "endG", "moonrakerUrl", "zMode", "servoName", "feedDraw", "laserOnCmd", "pauseCmd", "originX", "flipY"])
  ok(!(k in M.DEFAULT_SVG_MACHINE), "SVG template carries no legacy field: " + k);
ok(M.SVG_PROFILE_KEYS.every((k) => k === "id" || k in M.DEFAULT_SVG_MACHINE), "allowed SVG keys all exist on the template");
ok(/SVG/.test(M.SVG_WORKFLOW_HELP) && /AxiDraw/.test(M.SVG_WORKFLOW_HELP) && !/https?:/.test(M.SVG_WORKFLOW_HELP), "help text is general, names the family, carries no links");

/* --- workflow detection --- */
ok(M.workflowOf({}) === "gcode" && M.workflowOf(null) === "gcode" && M.workflowOf({ workflow: "gcode" }) === "gcode", "missing / null / gcode -> gcode");
ok(M.workflowOf({ workflow: "svg-external" }) === "svg-external", "svg-external detected");
ok(M.isGcodeWorkflow(M.DEFAULT_MACHINE) && !M.isGcodeWorkflow(M.DEFAULT_SVG_MACHINE), "isGcodeWorkflow");

/* --- normalizeMachine: legacy --- */
{
  const legacy = { name: "My plotter", workW: 500, workH: 400, startG: "G28\nG1 Z5", endG: "M2", zMode: "bed", feedDraw: 999, moonrakerUrl: "ws://10.0.0.5:7125/websocket" };
  const r = M.normalizeMachine(legacy);
  ok(r.prof && !r.error, "bare legacy profile accepted");
  ok(r.prof.workflow === "gcode", "legacy profile becomes gcode workflow");
  ok(r.prof.startG === legacy.startG && r.prof.endG === "M2" && r.prof.feedDraw === 999 && r.prof.zMode === "bed" && r.prof.moonrakerUrl === legacy.moonrakerUrl, "legacy: user's commands, numbers and URL preserved");
  ok(r.prof.servoName === "pen" && r.prof.laserOnCmd === M.DEFAULT_MACHINE.laserOnCmd, "legacy: missing fields filled from DEFAULT_MACHINE (old files keep upgrading)");
  ok(J(legacy) === J({ name: "My plotter", workW: 500, workH: 400, startG: "G28\nG1 Z5", endG: "M2", zMode: "bed", feedDraw: 999, moonrakerUrl: "ws://10.0.0.5:7125/websocket" }), "input not mutated");
  const a = M.normalizeMachine(M.DEFAULT_MACHINE), b = M.normalizeMachine(M.DEFAULT_MACHINE_B);
  ok(J(a.prof) === J(M.DEFAULT_MACHINE) && J(b.prof) === J(M.DEFAULT_MACHINE_B), "A/B round trip through normalisation is the identity");
}
/* --- normalizeMachine: svg-external --- */
{
  const raw = { workflow: "svg-external", name: "NextDraw 8511", manufacturer: "Bantam Tools", model: "NextDraw 8511", workW: 300, workH: 218, sourceUrl: "", verifiedOn: "",
    startG: "G28", moonrakerUrl: "ws://evil", servoUp: 90, originX: 10, flipY: true, laserOn: true };
  const r = M.normalizeMachine(raw);
  ok(r.prof && !r.error, "svg-external profile accepted");
  ok(J(Object.keys(r.prof).sort()) === J([...new Set([...Object.keys(M.DEFAULT_SVG_MACHINE)])].sort()), "svg-external: exactly the template's fields, nothing inherited (" + Object.keys(r.prof).sort().join(",") + ")");
  ok(r.prof.workW === 300 && r.prof.workH === 218 && r.prof.manufacturer === "Bantam Tools", "svg-external: metadata and work area kept");
  ok(!("startG" in r.prof) && !("moonrakerUrl" in r.prof) && !("originX" in r.prof) && !("flipY" in r.prof), "svg-external: machine commands, URL, origin, flip dropped");
  ok(M.normalizeMachine({ workflow: "svg-external" }).prof.workW === 0, "svg-external without work area: unset (0), no hidden default");
  ok(M.normalizeMachine({ workflow: "svg-external", workW: "297", workH: "210" }).prof.workW === 297, "svg-external: numeric strings parsed");
  ok(!!M.normalizeMachine({ workflow: "svg-external", workW: -5 }).error, "svg-external: negative work area rejected");
  ok(!!M.normalizeMachine({ workflow: "svg-external", workW: Infinity }).error && !!M.normalizeMachine({ workflow: "svg-external", workH: "abc" }).error, "svg-external: non-finite / non-numeric work area rejected");
  ok(!!M.normalizeMachine({ workflow: "svg-external", units: "in" }).error, "svg-external: non-mm units rejected");
  ok(M.normalizeMachine({ workflow: "svg-external", name: "   " }).prof.name === M.DEFAULT_SVG_MACHINE.name, "svg-external: blank name falls back to the template name");
}
/* --- normalizeMachine: rejects --- */
ok(!!M.normalizeMachine(null).error && !!M.normalizeMachine([]).error && !!M.normalizeMachine("x").error, "non-objects rejected");
ok(/Unknown machine workflow/.test(M.normalizeMachine({ workflow: "usb-direct" }).error || ""), "unknown workflow rejected with a clear message");

/* --- ids --- */
{
  const l = M.assignIds([{ name: "a" }, { name: "b", id: "machine-1" }, { name: "c" }]);
  ok(l.map((m) => m.id).join() === "machine-2,machine-1,machine-3", "running ids skip the ones in use (" + l.map((m) => m.id).join() + ")");
  ok(M.nextId(l) === "machine-4", "nextId after the list");
  ok(M.nextId([]) === "machine-1", "nextId on an empty list");
}
/* --- clampIdx --- */
ok(M.clampIdx(0, 3) === 0 && M.clampIdx(2, 3) === 2 && M.clampIdx(5, 3) === 2, "clampIdx within range / above");
ok(M.clampIdx(-1, 3) === 0 && M.clampIdx(NaN, 3) === 0 && M.clampIdx("1.7", 3) === 1 && M.clampIdx(undefined, 3) === 0 && M.clampIdx(1, 0) === 0, "clampIdx negative / NaN / string / undefined / empty list -> safe");

/* --- normalizeMachines (patch lists) --- */
{
  const r = M.normalizeMachines([M.DEFAULT_MACHINE, { workflow: "svg-external", name: "Ext" }], 1);
  ok(r.machines && r.machines.length === 2 && r.machineIdx === 1 && r.errors.length === 0, "mixed list normalised, index kept");
  ok(r.machines[0].id === "machine-1" && r.machines[1].id === "machine-2", "ids assigned to patch entries");
  const bad = M.normalizeMachines([{ workflow: "nope" }, { workflow: "svg-external", workW: -1 }], 0);
  ok(bad.machines === null && bad.errors.length === 2, "all-invalid list -> null (caller keeps current machines) with per-entry errors");
  const part = M.normalizeMachines([{ workflow: "nope" }, M.DEFAULT_MACHINE_B], 1);
  ok(part.machines && part.machines.length === 1 && part.machineIdx === 0 && part.errors.length === 1, "partly invalid list: valid entries kept, index clamped");
  ok(M.normalizeMachines([], 0).machines === null && M.normalizeMachines(undefined, 0).machines === null, "empty / missing list -> null");
  ok(M.normalizeMachines([M.DEFAULT_MACHINE], 0, 2).machines !== null && M.normalizeMachines([M.DEFAULT_MACHINE], 0, 1).machines !== null, "machineFormat 1 and 2 accepted");
  const fut = M.normalizeMachines([M.DEFAULT_MACHINE], 0, 3);
  ok(fut.machines === null && /Unsupported machine format 3/.test(fut.errors[0]), "machineFormat from the future rejected with a message");
}
/* --- machine files --- */
{
  const v1 = { app: "muusia-machine", v: 1, prof: { name: "Old", workW: 400, workH: 300, startG: "G28" } };
  const r1 = M.readMachineFile(v1);
  ok(r1.prof && r1.prof.workflow === "gcode" && r1.prof.startG === "G28" && r1.prof.workW === 400, "v1 file -> legacy gcode profile, content preserved");
  const bare = M.readMachineFile({ name: "Bare", workW: 100, workH: 100 });
  ok(bare.prof && bare.prof.workflow === "gcode", "bare object file -> legacy gcode profile");
  const txt = M.writeMachineFile({ ...M.DEFAULT_SVG_MACHINE, id: "machine-7", name: "Ext", workW: 300, workH: 218 });
  const data = JSON.parse(txt);
  ok(data.app === "muusia-machine" && data.v === 2 && data.minApp === M.MACHINE_MIN_APP && !("id" in data.prof), "svg-external file: v2, minApp, no session id");
  const back = M.readMachineFile(data);
  ok(back.prof && J(back.prof) === J({ ...M.DEFAULT_SVG_MACHINE, name: "Ext", workW: 300, workH: 218 }), "svg-external file round trip is lossless");
  const g = JSON.parse(M.writeMachineFile(M.DEFAULT_MACHINE));
  ok(g.v === 2 && !("minApp" in g) && J(M.readMachineFile(g).prof) === J(M.DEFAULT_MACHINE), "gcode file round trip is lossless, no minApp");
  ok(/Unsupported machine file version 9/.test(M.readMachineFile({ app: "muusia-machine", v: 9, prof: {} }).error), "file version 9 rejected");
  ok(!!M.readMachineFile({ app: "muusia", v: 1, root: {} }).error, "a patch is not a machine file");
  ok(!!M.readMachineFile({ app: "muusia-machine", v: 2 }).error && !!M.readMachineFile(42).error, "file without profile / non-object rejected");
}
/* --- conversion --- */
{
  const toSvg = M.convertWorkflow({ ...M.DEFAULT_MACHINE, id: "machine-1", name: "Mine" }, "svg-external");
  ok(toSvg.workflow === "svg-external" && toSvg.name === "Mine" && toSvg.workW === 330 && toSvg.id === "machine-1" && !("startG" in toSvg), "gcode -> svg: name, id and work area carried, commands dropped");
  const toG = M.convertWorkflow({ ...M.DEFAULT_SVG_MACHINE, id: "machine-2", name: "Ext" }, "gcode");
  ok(toG.workflow === "gcode" && toG.name === "Ext" && toG.workW === 330 && toG.startG === M.DEFAULT_MACHINE.startG, "svg (unset area) -> gcode: defaults restored, name kept");
  ok(M.convertWorkflow(M.DEFAULT_MACHINE, "gcode") === M.DEFAULT_MACHINE, "same workflow: identity");
}
/* --- refusal + ctx --- */
{
  const t = M.gcodeRefusal({ name: "Ext" });
  ok(t.split("\n").every((l) => l.startsWith(";")) && /Ext/.test(t) && /SVG/.test(t) && /MACHINE SETUP/.test(t), "refusal is all comments, names the profile and the fix");
  const c1 = M.machineCtx({ ...M.DEFAULT_MACHINE, originX: 5, flipY: true, laserOffX: 2 });
  ok(c1.originX === 5 && c1.flipY === true && c1.laserOffX === 2 && c1.workW === 330 && c1.workflow === "gcode", "gcode ctx.machine as before (+ workflow)");
  const c2 = M.machineCtx({ ...M.DEFAULT_SVG_MACHINE, workW: 300, workH: 218 });
  ok(c2.originX === 0 && c2.flipY === false && c2.laserOffX === 0 && c2.workW === 300 && c2.workflow === "svg-external", "svg ctx.machine: no origin / flip / laser offset, work area passed through");
}

console.log(fails === 0 ? `ALL OK (${n} checks)` : `${fails} FAILURES of ${n}`);
process.exit(fails === 0 ? 0 : 1);
