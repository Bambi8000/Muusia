/* MUUSIA Era A surgery — v2.20 -> v2.21
   Removes: Macrame, Reaction-Diffusion, String, Tape Saturation Harmonics,
            Planets, Solar System, Building, Filter
   Scan -> Seismic (seismic branch only), Power Pole -> 3 models,
   Mycelial Net -> Root Web, Trace -> Trace Image, bakes setpen if present.
   Run: node era-a.mjs        (writes src/App.jsx, backup in App.jsx.bak-era-a) */
import fs from "fs";

const FILE = "src/App.jsx";
let src = fs.readFileSync(FILE, "utf8");
const log = [];
const die = (m) => { console.error("ABORT: " + m + " - nothing written."); process.exit(1); };

function assertOnce(needle, what) {
  const i = src.indexOf(needle);
  if (i < 0) die("anchor not found (" + what + "): " + needle.slice(0, 60));
  if (src.indexOf(needle, i + 1) >= 0) die("anchor not unique (" + what + ")");
  return i;
}
/* brace walker: s[open] must be "{"; skips strings, template literals, comments */
function matchBrace(s, open) {
  let depth = 0, mode = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (mode === null) {
      if (c === '"' || c === "'" || c === "`") mode = c;
      else if (c === "/" && n === "/") { mode = "//"; i++; }
      else if (c === "/" && n === "*") { mode = "/*"; i++; }
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) return i; }
    } else if (mode === "//") { if (c === "\n") mode = null; }
    else if (mode === "/*") { if (c === "*" && n === "/") { mode = null; i++; } }
    else { if (c === "\\") i++; else if (c === mode) mode = null; }
  }
  die("unbalanced braces in walk");
}

/* ---------- 1. hard removals by display name ---------- */
const removedKeys = [];
function removeNode(displayName) {
  const ni = assertOnce('name: "' + displayName + '"', "remove " + displayName);
  const head = src.slice(0, ni);
  const heads = [...head.matchAll(/\n  ([a-z0-9_]+): \{/g)];
  if (!heads.length) die("entry head not found for " + displayName);
  const m = heads[heads.length - 1];
  const start = m.index + 1;
  const brace = m.index + m[0].length - 1;
  const close = matchBrace(src, brace);
  let end = close + 1;
  if (src[end] === ",") end++;
  if (src[end] === "\n") end++;
  const block = src.slice(start, end);
  if (!block.includes("compute")) die("block without compute for " + displayName);
  if (!block.includes('name: "' + displayName + '"')) die("name fell outside block: " + displayName);
  src = src.slice(0, start) + src.slice(end);
  removedKeys.push(m[1]);
  log.push("removed " + displayName + " (key " + m[1] + ", " + block.length + " chars)");
}
["Macrame", "Reaction-Diffusion", "String", "Tape Saturation Harmonics",
 "Planets", "Solar System", "Building", "Filter"].forEach(removeNode);

/* ---------- 2. renames ---------- */
function rename(a, b) {
  const i = assertOnce('name: "' + a + '"', "rename " + a);
  src = src.slice(0, i) + 'name: "' + b + '"' + src.slice(i + ('name: "' + a + '"').length);
  log.push("renamed " + a + " -> " + b);
}
rename("Mycelial Net", "Root Web");
rename("Trace", "Trace Image");
src = src.split("Mycelial Net").join("Root Web");

/* ---------- 3. Power Pole: 3 models, drop pylon branches ---------- */
const ppOld = 'options: ["Finnish Wood", "US Utility", "Japanese Concrete", "Lattice Pylon", "Wide-Base Lattice", "Lattice Portal", "H-Frame Portal"]';
assertOnce(ppOld, "powerpole options");
src = src.replace(ppOld, 'options: ["Finnish Wood", "US Utility", "Japanese Concrete"]');
const ppDesc = src.match(/desc: "Wireframe 3D utility poles[^"]*"/);
if (!ppDesc) die("powerpole desc not found");
src = src.replace(ppDesc[0], 'desc: "Wireframe 3D utility poles: Finnish Wood (single pole, crossarm, pin insulators, guy wire), US Utility (double crossarm, cylinder transformer), Japanese Concrete (stacked arms, transformer drums). The Wires toggle hangs catenary cables from the insulators. Rotate with Yaw and Pitch - wire Frame into Yaw to orbit."');
{
  const a = assertOnce('} else if (M === "Lattice Pylon") {', "powerpole dead chain");
  const cutFrom = a + 1;
  let pos = src.indexOf("{", a + 2);
  let cutTo;
  while (true) {
    const close = matchBrace(src, pos);
    const tail = src.slice(close + 1);
    const em = tail.match(/^\s*else(\s+if\s*\(M === "[^"]*"\))?\s*\{/);
    if (!em) { cutTo = close; break; }
    pos = close + 1 + em[0].length - 1;
  }
  src = src.slice(0, cutFrom) + src.slice(cutTo + 1);
  log.push("powerpole: removed 4 lattice/portal branches");
}

/* ---------- 4. Scan -> Seismic ---------- */
{
  const h = assertOnce("\n  scan: {", "scan entry");
  const open = src.indexOf("{", h + 1);
  const close = matchBrace(src, open);
  let blk = src.slice(h, close + 1);
  if (!blk.includes('name: "Scan"')) die("scan name not in block");
  blk = blk.replace('name: "Scan"', 'name: "Seismic"');
  const modeLine = blk.match(/\n\s*\{ key: "mode",[^\n]*\n/);
  if (!modeLine) die("scan mode param not found");
  blk = blk.replace(modeLine[0], "\n");
  const mLine = blk.match(/\n\s*const M = p\.mode;[^\n]*\n/);
  if (!mLine) die("scan 'const M = p.mode' not found - inspect manually");
  blk = blk.replace(mLine[0], "\n");
  const ifStart = blk.indexOf('if (M === "X-ray');
  if (ifStart < 0) die("scan if-chain not found");
  let pos = blk.indexOf("{", ifStart);
  let body = null, chainEnd = null;
  while (true) {
    const c2 = matchBrace(blk, pos);
    const tail = blk.slice(c2 + 1);
    const em = tail.match(/^\s*else(\s+if\s*\(M === "[^"]*"\))?\s*\{/);
    if (!em) die("scan chain ended without final else");
    const nOpen = c2 + 1 + em[0].length - 1;
    if (!em[1]) {
      const bClose = matchBrace(blk, nOpen);
      body = blk.slice(nOpen + 1, bClose);
      chainEnd = bClose;
      break;
    }
    pos = nOpen;
  }
  blk = blk.slice(0, ifStart) + body.replace(/^\n+/, "").trimEnd() + "\n" + blk.slice(chainEnd + 1);
  src = src.slice(0, h) + blk + src.slice(close + 1);
  log.push("scan -> Seismic (seismic branch only)");
}

/* ---------- 5. bake Set Pen if the file is here ---------- */
if (fs.existsSync("setpen.plotternode.js")) {
  let s = fs.readFileSync("setpen.plotternode.js", "utf8").trim();
  const stub = (x) => x;
  const H = { Pin: (t, l) => ({ type: t, label: l }), EMPTY: { paths: [] },
    PENS: Array.from({ length: 6 }, (_, i) => ({ name: "P" + i, c: "#000" })),
    mulberry32: (s2) => () => ((s2 = (s2 + 0x6D2B79F5) | 0), (Math.imul(s2 ^ (s2 >>> 15), 1 | s2) >>> 0) / 4294967296),
    hash2: () => 0.5, noise2: () => 0.5, resample: (p2) => p2, pathLength: () => 0,
    applyStyle: stub, signedArea: () => 0 };
  const def = new Function(...Object.keys(H), '"use strict"; return (' + s.replace(/^\(/, "").replace(/\)\s*;?\s*$/, "") + ");")(...Object.values(H));
  if (!def.key || typeof def.compute !== "function") die("setpen def invalid");
  const test = def.compute([{ paths: [{ pts: [[0, 0], [10, 10]], closed: false, layer: 0 }] }],
    Object.fromEntries(def.params.map((q) => [q.key, q.def])), { W: 300, H: 200 }, {});
  if (!test || !Array.isArray(test.paths)) die("setpen compute smoke test failed");
  let inner = s.replace(/^\(\s*\{/, "").replace(/\}\s*\)\s*;?\s*$/, "");
  const km = inner.match(/\n?\s*key:\s*"[a-z0-9_]+"\s*,/);
  if (!km) die("setpen key line not found");
  inner = inner.replace(km[0], "");
  const entry = "  " + def.key + ": {\n" +
    inner.split("\n").map((l) => (l.trim() ? "  " + l : l)).join("\n").replace(/^\n+|\s+$/g, "") +
    "\n  },\n";
  const anchor = assertOnce("\n  origami: {", "origami bake anchor");
  src = src.slice(0, anchor + 1) + entry + src.slice(anchor + 1);
  log.push("baked Set Pen (key " + def.key + ")");
} else {
  log.push("NOTE: setpen.plotternode.js not in cwd - skipped bake");
}

/* ---------- 6. version + final checks ---------- */
const vm = src.match(/APP_VERSION\s*=\s*"([^"]+)"/);
if (!vm) die("APP_VERSION not found");
if (vm[1] !== "2.20") die("expected APP_VERSION 2.20, found " + vm[1]);
src = src.replace(vm[0], vm[0].replace("2.20", "2.21"));

for (const k of removedKeys) {
  const hits = (src.match(new RegExp('"' + k + '"', "g")) || []).length;
  if (hits) log.push("WARNING: removed key '" + k + "' still referenced " + hits + "x - check manually");
}
const count = (src.match(/cat: "/g) || []).length;
log.push("node count (cat: \") = " + count + " (expected 164, or 165 with Set Pen)");

fs.writeFileSync(FILE + ".bak-era-a", fs.readFileSync(FILE));
fs.writeFileSync(FILE, src);
log.forEach((l) => console.log(l));
console.log("OK - now run: npm run build");