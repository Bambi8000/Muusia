/* Era patch: version bump + documentation for the Controller node and the
   live-input engine seam. Run ONCE from the repo root, AFTER baking ctrl:

     node tools/bake.mjs ctrl
     rm -f nodes-lab/ctrl.plotternode.js
     node tools/era/patch-docs-ctrl.mjs

   WHY THIS EXISTS SEPARATELY. Controller lived as a lab file and was loaded
   through Node ⇣, which registers it in the RUNNING session only. Lab files are
   not part of the build, so the node worked all through development and was
   simply absent from dist - a class of bug that no validator can catch, because
   the node itself is fine. Baking is what puts it in the build; documenting is
   what stops the next session from rediscovering it.

   ORDER. This patch REQUIRES patch-docs-3nodes to have run, so that the
   version it bumps from is one that already has a HANDOFF entry. Running them
   the other way round would bump twice for one release. If the 3-node batch has
   not run yet, this aborts and says so.

   As with that patch, the version and every count are read off disk and never
   copied from the previous documents. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

const findDoc = (name) => {
  for (const dir of ["docs", ".", "doc"]) { const p = join(dir, name); if (existsSync(p)) return p; }
  return null;
};
const APP = "src/App.jsx";
const NODES_DIR = "src/defs/nodes";
const F_NODES = findDoc("MUUSIA-NODES.md");
const F_TAGS = findDoc("MUUSIA-TAGS.json");
const F_HAND = findDoc("MUUSIA-HANDOFF.md");
const F_API = findDoc("MUUSIA-NODE-API.md");
for (const [label, p] of [["src/App.jsx", APP], ["src/defs/nodes", NODES_DIR], ["MUUSIA-NODES.md", F_NODES],
  ["MUUSIA-TAGS.json", F_TAGS], ["MUUSIA-HANDOFF.md", F_HAND], ["MUUSIA-NODE-API.md", F_API]]) {
  if (!p || !existsSync(p)) { console.log("MISS  " + label + " not found - run from the repo root - ABORT"); process.exit(1); }
}

/* ---- the node must be baked, and the lab copy gone ---- */
if (!existsSync(join(NODES_DIR, "ctrl.js"))) {
  console.log("MISS  " + NODES_DIR + "/ctrl.js not found - run `node tools/bake.mjs ctrl` first - ABORT");
  process.exit(1);
}
if (existsSync("nodes-lab/ctrl.plotternode.js")) {
  console.log("MISS  nodes-lab/ctrl.plotternode.js still present - delete it after baking, or a re-bake will fight it - ABORT");
  process.exit(1);
}
if (!existsSync("src/live-input.jsx")) {
  console.log("MISS  src/live-input.jsx not found - the node is useless without its engine seam - ABORT");
  process.exit(1);
}

let hand = readFileSync(F_HAND, "utf8");
if (hand.includes("Controller** (math)")) {
  console.log("SKIP  patch-docs-ctrl already applied (sentinel found in HANDOFF)");
  process.exit(0);
}
if (!hand.includes("Chain** (gen/geometric)")) {
  console.log("MISS  patch-docs-3nodes has not been applied - run it first, or this bumps twice for one release - ABORT");
  process.exit(1);
}

/* ---- facts from disk ---- */
let app = readFileSync(APP, "utf8");
const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const VOLD = vm[1] + "." + vm[2];
const VNEW = vm[1] + "." + String(Number(vm[2]) + 1).padStart(2, "0");
if (!hand.includes("- **" + VOLD + "**")) {
  console.log("MISS  no HANDOFF history entry for the current version " + VOLD + " - ABORT");
  process.exit(1);
}

const files = readdirSync(NODES_DIR).filter((f) => f.endsWith(".js"));
const catOf = (f) => { const m = readFileSync(join(NODES_DIR, f), "utf8").match(/\bcat:\s*"([a-z]+)"/); return m ? m[1] : "?"; };
const cats = {};
for (const f of files) { const c = catOf(f); cats[c] = (cats[c] || 0) + 1; }
const TOTAL = files.length + 2;
const MATH = cats.math || 0;
console.log("INFO  version " + VOLD + " -> " + VNEW);
console.log("INFO  " + files.length + " files on disk, " + TOTAL + " nodes total (Math " + MATH + ")");

/* ---- content ---- */
const PARA = `**Controller** — turns live input into graph values. *Layout* picks
what drives the outputs. **Channels** is the generic 1-6 set nudged by the arrow
keys or driven by gamepad axes. **Sticks** gives four pins — LX and LY from the
left stick, RX and RY from the right — so each stick reaches two parameters at
once. **D-pad + triggers** gives Pad X, Pad Y, L2 and R2: left and right step
Pad X down and up by *D-pad step*, up and down do the same to Pad Y, and the two
analog triggers land on their own pins — a stepped pair for exact increments
beside a pressure-sensitive pair for sweeps. Both d-pad directions act on the
rising edge, so holding the pad does not run the value away.

Every channel, in every layout, is stored NORMALISED 0-1 in v1..v6 and mapped
into *Out min*..*Out max* with optional *Snap*. That one storage model is why the
range, the snap, the keyboard nudge and the panel readout are the same code for
a stick axis, a d-pad step and a trigger — and why the values save with the patch
and replay identically on export. (The inspector rows stay CH1..CH4 in the named
layouts because parameter labels are static; the pin labels and the LIVE panel
show the real names.)

*Axis mode* Absolute maps stick position straight across the range, while Jog
integrates deflection over time so a self-centring stick behaves like an endless
jog wheel — push and the value travels, let go and it stays. Source **Keyboard**
drives the ARMED Controller in any layout: ↑↓ nudge the active channel, ←→ pick
it, Shift is coarse and Alt fine. A Controller stays armed while you go on to
select and preview other nodes, which is necessary because the big preview only
opens on a node that outputs paths and a Controller never can; with it open a
compact readout mirrors the channels above the overlay. *Binding* overrides the
pad index and, in Channels, the axis mapping; \`auto\` takes the first CONNECTED
pad rather than slot 0. *Freeze* stops all live writing so a tuned value stays
put. Wire a channel into any value port.

`;

const APISECTION = `### Live input: the Controller seam (v${VNEW})

A node must never read a device. \`ctx\` is not a way round it either: exports,
thumbnails and every animation frame re-evaluate the graph, and a value that
differs between those runs breaks determinism silently. The rule is:

> **Live input is written into PARAMETERS by the engine, never read inside
> \`compute\`.**

\`src/live-input.jsx\` listens to the keyboard and the Gamepad API and calls
\`setParam\` on every Controller node in the current graph level. \`compute\` stays
a pure function of \`(ins, p, ctx)\`; the params save with the patch, so a gesture
is reproducible and an export replays exactly what was on screen.

Three costs come with that seam, and all three are managed in the module rather
than in the node:

- **Re-evaluation.** Every param write re-runs the whole graph, so a 60 Hz input
  stream would lock a heavy patch. Writes are capped at 20 Hz per node and
  skipped entirely when nothing moved past the channel's quantum.
- **Undo history.** App.jsx coalesces changes inside 400 ms, far too short for a
  continuous stream — a long gesture would flush real history out of the
  60-entry buffer. \`histRef.current.live\` marks a gesture in progress and the
  history effect pushes ONE snapshot for it.
- **The adoption race.** \`setParam\` is async, so on the frame after a write the
  incoming props still carry the old value. Adopting it would fight your own
  value and jitter. Each channel carries a pending flag and ignores the prop
  until it catches up, which is also what lets a manual slider edit or an undo
  win.

Two things are worth copying if you build a similar seam. Keep ONE unit for
every channel and let the node map it — per-control natural units force the
output range to apply to some layouts and not others, and need a parameter per
control. And if a table has to exist in both the node and the module, have the
validator parse the module's copy and compare: the node decides which pin is
which and the module decides which control writes which param, so a drift wires
a pin to the wrong control and nothing else notices.

`;

const HIST = `- **${VNEW}** **Controller** (math) baked, plus the live-input engine seam it
  needs. The node had existed as a lab file and been loaded through Node ⇣ for
  several sessions, which registers it in the running session ONLY — it worked
  throughout development and was simply missing from dist. Three layouts:
  Channels (generic 1-6), Sticks (LX/LY/RX/RY, two channels per stick) and
  D-pad + triggers (Pad X and Pad Y stepped by the d-pad pairs on the rising
  edge, L2 and R2 analog on their own pins). Every channel normalised 0-1 in
  v1..v6 and mapped through Out min..Out max, so one storage model serves every
  layout — an intermediate design gave each control its own natural unit
  (degrees, counts, 0/1) and had to be collapsed. Engine seam
  \`src/live-input.jsx\` (era patches patch-live-input.mjs and
  patch-live-overlay.mjs, already applied): a LIVE toolbar chip, arming
  decoupled from selection, a readout mirrored above the big-preview overlay,
  20 Hz write throttling and one undo snapshot per gesture. The seam's rule —
  live input goes into parameters, never into \`ctx\` — is now written up in
  NODE-API §3. Also: \`bind: "auto"\` picks the first CONNECTED pad rather than
  index 0, because a Bluetooth pad that reconnects routinely lands on index 1-3
  and pinning slot 0 made a working controller look dead.
  (tools/validate-ctrl.mjs, tools/validate-live-input.mjs,
  tools/era/patch-docs-ctrl.mjs)

`;

const PIT = `- A LAB FILE IS NOT IN THE BUILD. Node ⇣ registers a custom node in the running
  session only, so a node developed that way works perfectly for weeks and is
  absent from \`dist\` — no validator can catch it, because the node is fine. Bake
  before shipping, and grep the built \`dist/index.html\` for the node KEY as part
  of the release check, not just for the version string.
- When one table has to live in two files, make a validator PARSE the second
  copy and compare it to the first. Controller's layout table sits in the node
  (which pin is which) and in src/live-input.jsx (which control writes which
  param); a drift between them wires a pin to the wrong control while every
  other test stays green. Mutation-test the comparison itself, or you have only
  added a check that always passes.
- Giving each value its own natural unit sounds tidier than one shared unit and
  is usually the opposite. Controller briefly stored degrees, press counts and
  0/1 in separate per-control parameters, which forced Out min..Out max to apply
  to some layouts and not others and needed a parameter per control. Collapsing
  everything to normalised 0-1, mapped once by compute, removed a third of the
  node and made the range, the snap, the keyboard nudge and the panel readout
  one code path.
`;

/* ---- edits ---- */
const edits = [];
edits.push({ file: APP, name: "APP_VERSION " + VOLD + " -> " + VNEW,
  old: 'APP_VERSION = "' + VOLD + '"', neu: 'APP_VERSION = "' + VNEW + '"' });

let nodes = readFileSync(F_NODES, "utf8");
const hm = nodes.match(/^# MUUSIA v[\d.]+ — Node Reference/m);
if (!hm) { console.log("MISS  NODES.md header not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md header version", old: hm[0], neu: "# MUUSIA v" + VNEW + " — Node Reference" });

const tm = nodes.match(/^All \d+ built-in nodes\./m);
if (!tm) { console.log("MISS  NODES.md total-count line not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md total count -> " + TOTAL, old: tm[0], neu: "All " + TOTAL + " built-in nodes." });

const mmath = nodes.match(/^## Math \(\d+\)$/m);
if (!mmath) { console.log("MISS  NODES.md Math heading not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md Math count -> " + MATH, old: mmath[0], neu: "## Math (" + MATH + ")" });

const mrout = nodes.match(/^## Routing \(\d+\)$/m);
if (!mrout) { console.log("MISS  NODES.md Routing heading not found - ABORT"); process.exit(1); }
edits.push({ file: F_NODES, name: "NODES.md Controller paragraph", old: mrout[0], neu: PARA + mrout[0] });

let api = readFileSync(F_API, "utf8");
const av = api.match(/^# Muusia — Custom Node API \(v[\d.]+, app v[\d.]+\)$/m);
if (av) edits.push({ file: F_API, name: "NODE-API header app version",
  old: av[0], neu: av[0].replace(/app v[\d.]+/, "app v" + VNEW) });
else MISS("NODE-API header line (skipped, wording changed)");
const asec = api.match(/^## 4\. Parameter UI types$/m);
if (!asec) { console.log("MISS  NODE-API section 4 heading not found - ABORT"); process.exit(1); }
edits.push({ file: F_API, name: "NODE-API live-input seam section", old: asec[0], neu: APISECTION + asec[0] });

const pm = hand.match(/^## Hard-won pitfalls \(keep\)$/m);
if (!pm) { console.log("MISS  HANDOFF pitfalls heading not found - ABORT"); process.exit(1); }
edits.push({ file: F_HAND, name: "HANDOFF version history entry for " + VNEW, old: pm[0], neu: HIST + pm[0] });
edits.push({ file: F_HAND, name: "HANDOFF pitfall: a lab file is not in the build",
  old: "## Hard-won pitfalls (keep)\n", neu: "## Hard-won pitfalls (keep)\n" + PIT });

const fm = hand.match(/\*\*\d+ files\*\* \(\d+ nodes total with/);
if (fm) edits.push({ file: F_HAND, name: "HANDOFF repo-layout counts",
  old: fm[0], neu: "**" + files.length + " files** (" + TOTAL + " nodes total with" });
else MISS("HANDOFF repo-layout count line (skipped, wording changed)");

const buf = { [APP]: app, [F_NODES]: nodes, [F_HAND]: hand, [F_API]: api };
for (const e of edits) {
  const parts = buf[e.file].split(e.old);
  if (parts.length === 2) { buf[e.file] = parts.join(e.neu); OK(e.name); }
  else if (parts.length === 1) MISS(e.name + " (anchor not found)");
  else MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
}

const tags = JSON.parse(readFileSync(F_TAGS, "utf8"));
const VOCAB = new Set(Object.values(tags).flat());
const NEW = ["animation", "math"];
for (const t of NEW) if (!VOCAB.has(t)) MISS("tag '" + t + "' is not in the existing vocabulary");
if (!miss) { tags.ctrl = NEW.slice().sort(); OK("TAGS.json entry for ctrl"); }

if (miss > 0) { console.log("ABORT " + miss + " edit(s) missed - nothing written"); process.exit(1); }

writeFileSync(APP, buf[APP]);
writeFileSync(F_NODES, buf[F_NODES]);
writeFileSync(F_HAND, buf[F_HAND]);
writeFileSync(F_API, buf[F_API]);
const sorted = {};
for (const k of Object.keys(tags).sort()) sorted[k] = tags[k];
writeFileSync(F_TAGS, JSON.stringify(sorted, null, 1) + "\n");

console.log("DONE  " + ok + " edits applied · v" + VNEW + " · " + TOTAL + " nodes (Math " + MATH + ")");
console.log("      written: " + APP + ", " + F_NODES + ", " + F_TAGS + ", " + F_HAND + ", " + F_API);
