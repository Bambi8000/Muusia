/* Era patch: version bump + HANDOFF entry for machine profiles phase 1
   (export workflow). Run from the repo root after patch-machine-workflow.mjs.
   Reads the version from the repo and bumps it; MISS aborts; SKIP if applied. */

import { readFileSync, writeFileSync } from "node:fs";

const F_APP = "src/App.jsx", F_NODES = "docs/MUUSIA-NODES.md", F_HAND = "docs/MUUSIA-HANDOFF.md";
let app = readFileSync(F_APP, "utf8"), nodes = readFileSync(F_NODES, "utf8"), hand = readFileSync(F_HAND, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };
if (hand.includes("patch-machine-workflow.mjs")) { console.log("SKIP  patch-docs-machine-workflow already applied (sentinel found)"); process.exit(0); }
if (!app.includes('from "./machine.js"')) { console.log("MISS  App.jsx not yet patched (run tools/era/patch-machine-workflow.mjs first) - ABORT"); process.exit(1); }

const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V_OLD = vm[1] + "." + vm[2], V_NEW = vm[1] + "." + (parseInt(vm[2], 10) + 1);
console.log("INFO  version " + V_OLD + " -> " + V_NEW);
const minApp = (readFileSync("src/machine.js", "utf8").match(/MACHINE_MIN_APP = "([^"]+)"/) || [])[1];
if (minApp !== V_NEW) console.log("WARN  src/machine.js MACHINE_MIN_APP is " + minApp + " but this release is " + V_NEW + " - fix machine.js if they should match");

const one = (src, old, neu, name) => { const parts = src.split(old); if (parts.length === 2) { OK(name); return parts.join(neu); } MISS(name + (parts.length === 1 ? " (anchor not found)" : " (anchor not unique: " + (parts.length - 1) + " hits)")); return src; };
const oneRe = (src, re, neu, name) => { const hits = src.match(new RegExp(re.source, re.flags.replace("g", "") + "g")) || []; if (hits.length === 1) { OK(name); return src.replace(re, neu); } MISS(name + " (regex hits: " + hits.length + ")"); return src; };
const wrap = (t, w = 78, indent = "") => { const words = t.replace(/\s+/g, " ").trim().split(" "); const lines = []; let cur = ""; for (const wd of words) { const lim = lines.length ? w - indent.length : w; if ((cur + " " + wd).trim().length > lim && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); } if (cur) lines.push(cur); return lines.map((l, i) => (i ? indent + l : l)).join("\n"); };

app = one(app, 'APP_VERSION = "' + V_OLD + '"', 'APP_VERSION = "' + V_NEW + '"', "App.jsx APP_VERSION " + V_OLD + " -> " + V_NEW);
nodes = oneRe(nodes, /^# MUUSIA v\d+\.\d+ — Node Reference$/m, "# MUUSIA v" + V_NEW + " — Node Reference", "NODES.md header version");

const entry = wrap(`- **${V_NEW}** Machine profiles phase 1 — explicit export workflow (docs/MUUSIA-MACHINE-PROFILES-CLAUDE-HANDOFF.md). New module \`src/machine.js\` (pure, no React): DEFAULT_MACHINE / DEFAULT_MACHINE_B moved here as the single source; DEFAULT_SVG_MACHINE (own small template: no Klipper commands, no Moonraker URL, work area unset = 0, never a 330×240 default); \`workflow: "gcode" | "svg-external"\` (missing = legacy gcode); normalizeMachine / normalizeMachines (patch lists: valid entries kept, invalid skipped with per-entry messages, all-invalid → caller keeps its list, machineFormat > 2 rejected), readMachineFile (v1 / bare → legacy, v2, unsupported version rejected), writeMachineFile (v2, minApp on svg-external, session id stripped), assignIds / nextId (running machine-N), clampIdx, convertWorkflow, machineCtx, gcodeRefusal. App.jsx: every G-code route (normal export, Mega preview + zip, animation frames, Stack, laser jig ×4) goes through toGcodeGated / jigGcodeGated and returns the ;-comment refusal for svg-external; buttons disabled with a reason; Stack hides its G-code zip via new gcodeEnabled prop; DRO gets no URL; profile switch or workflow change clears the generated preview; patches carry machineFormat: 2; MACHINE SETUP has a Workflow select and an svg-external branch (manufacturer, model, work area with "not set", source URL, verified-on, external-program instructions, min app version) with all G-code sections hidden. Validator tools/validate-machine.mjs (62 checks: legacy identity round trip, field whitelist, rejects, ids, clamping, patch lists, file versions, conversion, ctx). Era: tools/era/patch-machine-workflow.mjs (22 anchored edits, JSX parse-checked). **Learn coordination (AGENTS §3/§5):** this changes src/App.jsx and src/stack-view.jsx, both pinned by the Learn export provenance — the physical-plot and svg-workflow exports and the Machine Setup screenshots must be recaptured against this build before the commit is pushed; geometry is unchanged, only provenance and the Machine Setup pictures move. Phase 2 (Inkscape-layer SVG per pen) is separate work.`, 78, "  ");
hand = one(hand, "\n## Hard-won pitfalls (keep)", "\n" + entry + "\n\n## Hard-won pitfalls (keep)", "HANDOFF version-history entry " + V_NEW);

if (miss > 0) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_APP, app); writeFileSync(F_NODES, nodes); writeFileSync(F_HAND, hand);
console.log("DONE  " + ok + " edits applied: " + [F_APP, F_NODES, F_HAND].join(", "));
