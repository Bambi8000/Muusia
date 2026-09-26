/* Era patch: fix Import SVG "Error: M_ID is not defined".
   Root cause: the C0 split moved parseSVG() into src/defs/helpers.js but left
   its module-private dependencies (M_ID, mMul, mApply, parseTransform,
   flattenCubic, flattenQuad, flattenArc, parsePathD) behind in App.jsx, where
   nothing uses them any more. helpers.js therefore throws a ReferenceError the
   moment any SVG is loaded. This patch moves the whole block, verbatim, into
   helpers.js directly above parseSVG, bumps APP_VERSION (read from disk) and
   writes the HANDOFF/NODES.md entries.
   Anchored exact-string edits, idempotent, MISS aborts before any write.
   Run from the repo root: node tools/era/patch-svgimport-deps.mjs */

import { readFileSync, writeFileSync } from "node:fs";

const APP = "src/App.jsx";
const HELP = "src/defs/helpers.js";
const HANDOFF = "docs/MUUSIA-HANDOFF.md";
const NODES = "docs/MUUSIA-NODES.md";

let app = readFileSync(APP, "utf8");
let help = readFileSync(HELP, "utf8");
let hand = readFileSync(HANDOFF, "utf8");
let nodes = readFileSync(NODES, "utf8");

let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };
const uniq = (hay, needle, what) => {
  const n = hay.split(needle).length - 1;
  if (n === 1) return true;
  MISS(what + (n === 0 ? " (anchor not found)" : " (anchor not unique: " + n + " hits)"));
  return false;
};

/* idempotence: helpers.js owns M_ID only in the finished state */
if (/^const M_ID = /m.test(help)) {
  console.log("SKIP  patch-svgimport-deps already applied (M_ID lives in " + HELP + ")");
  process.exit(0);
}

/* facts from the repo */
const vm = app.match(/APP_VERSION = "(\d+)\.(\d+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found - ABORT"); process.exit(1); }
const V_OLD = vm[1] + "." + vm[2];
const V_NEW = vm[1] + "." + (parseInt(vm[2], 10) + 1);
console.log("INFO  app version from repo: " + V_OLD + " -> " + V_NEW);

/* ---- edit 1: cut the SVG parsing block out of App.jsx ---- */
const BLOCK_START = "/* ---------- SVG-jäsennys (import-nodea varten) ---------- */\nconst M_ID = [1, 0, 0, 1, 0, 0];\n";
const BLOCK_END = "  flush();\n  return subs;\n}\n\n";
let block = null;
if (uniq(app, BLOCK_START, "App.jsx: SVG block start") && uniq(app, BLOCK_END, "App.jsx: SVG block end")) {
  const a = app.indexOf(BLOCK_START), b = app.indexOf(BLOCK_END) + BLOCK_END.length;
  if (b <= a) MISS("App.jsx: SVG block end precedes start");
  else {
    block = app.slice(a, b);
    const need = ["function mMul(", "function mApply(", "function parseTransform(", "function flattenCubic(",
      "function flattenQuad(", "function flattenArc(", "function parsePathD("];
    const missing = need.filter((s) => !block.includes(s));
    if (missing.length) MISS("App.jsx: SVG block incomplete, lacks " + missing.join(", "));
    else if (block.includes("\nexport ") || block.includes("\nconst DEFS") || block.length > 12000) MISS("App.jsx: SVG block overshoots (" + block.length + " chars)");
    else {
      /* nothing else in App.jsx may still call the moved functions */
      const rest = app.slice(0, a) + app.slice(b);
      const still = ["M_ID", "mMul(", "mApply(", "parseTransform(", "flattenCubic(", "flattenQuad(", "flattenArc(", "parsePathD("]
        .filter((s) => rest.includes(s));
      if (still.length) MISS("App.jsx still references " + still.join(", ") + " outside the block");
      else { app = rest; OK("App.jsx: removed SVG parsing block (" + block.length + " chars, " + block.split("\n").length + " lines)"); }
    }
  }
}

/* ---- edit 2: paste it into helpers.js above parseSVG ---- */
const PARSE_ANCHOR = "export function parseSVG(text) {";
if (block && uniq(help, PARSE_ANCHOR, "helpers.js: parseSVG anchor")) {
  const moved = block.replace(
    "/* ---------- SVG-jäsennys (import-nodea varten) ---------- */",
    "/* ---------- SVG parsing internals for parseSVG (moved here from App.jsx in v" + V_NEW + "; module-private, not part of the node API) ---------- */");
  help = help.replace(PARSE_ANCHOR, moved + PARSE_ANCHOR);
  OK("helpers.js: inserted SVG parsing block above parseSVG");
}

/* ---- edit 3: version bump ---- */
const VA = 'APP_VERSION = "' + V_OLD + '"';
if (uniq(app, VA, "App.jsx: APP_VERSION")) { app = app.replace(VA, 'APP_VERSION = "' + V_NEW + '"'); OK("App.jsx: APP_VERSION " + V_OLD + " -> " + V_NEW); }

/* ---- edit 4: NODES.md header version ---- */
const NH = "# MUUSIA v" + V_OLD + " — Node Reference";
if (uniq(nodes, NH, "NODES.md: header")) { nodes = nodes.replace(NH, "# MUUSIA v" + V_NEW + " — Node Reference"); OK("NODES.md: header -> v" + V_NEW); }

/* ---- edit 5: HANDOFF version history entry (appended before the pitfalls section) ---- */
const PIT = "\n## Hard-won pitfalls (keep)\n\n";
const ENTRY =
  "- **" + V_NEW + "** Import SVG fix: every SVG load failed with `Error: M_ID is not\n" +
  "  defined`. The C0 split moved `parseSVG` into src/defs/helpers.js but left\n" +
  "  its module-private helpers (`M_ID, mMul, mApply, parseTransform,\n" +
  "  flattenCubic, flattenQuad, flattenArc, parsePathD`) behind in App.jsx, where\n" +
  "  nothing referenced them any more; the ReferenceError only fires at file-load\n" +
  "  time, so build and every validator stayed green. The block now lives in\n" +
  "  helpers.js directly above `parseSVG` (verbatim, still module-private — the\n" +
  "  helper API is unchanged). New tools/validate-svgimport.mjs exercises the REAL\n" +
  "  `parseSVG` + baked node in Node (jsdom/linkedom if installed, else a\n" +
  "  built-in minimal XML DOM) and accepts an optional SVG path to smoke-test a\n" +
  "  user file. Era: tools/era/patch-svgimport-deps.mjs.\n";
if (uniq(hand, PIT, "HANDOFF: pitfalls heading")) { hand = hand.replace(PIT, "\n" + ENTRY + PIT); OK("HANDOFF: version history entry " + V_NEW); }

/* ---- edit 6: HANDOFF pitfall ---- */
const PIT_HEAD = "## Hard-won pitfalls (keep)\n\n";
const PITFALL =
  "- Extracting a function into helpers.js must take its module-private\n" +
  "  dependencies with it. `parseSVG` moved in C0 but `M_ID`/`parsePathD` and\n" +
  "  friends stayed in App.jsx as dead code; the ReferenceError surfaces only\n" +
  "  when a user loads a file (undetected from the C0 split until v" + V_NEW + "). Vite does not\n" +
  "  cross-module-check free identifiers. Any helper that is only reached via\n" +
  "  `onFile`/user action needs a Node validator that actually calls it.\n";
if (uniq(hand, PIT_HEAD, "HANDOFF: pitfalls heading (pitfall insert)")) { hand = hand.replace(PIT_HEAD, PIT_HEAD + PITFALL); OK("HANDOFF: pitfall entry"); }

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - nothing written");
  process.exit(1);
}
writeFileSync(APP, app);
writeFileSync(HELP, help);
writeFileSync(HANDOFF, hand);
writeFileSync(NODES, nodes);
console.log("DONE  " + ok + " edits applied; wrote " + [APP, HELP, HANDOFF, NODES].join(", "));
