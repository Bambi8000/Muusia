/* tools/era/patch-potato-clean.mjs — one-shot, two inspector-level changes.

   1. Eyes defaults to None, so a freshly dropped Potato arrives as a clean
      blob and the texture is one click away.
   2. Eyes per potato hides while Eyes is None, instead of sitting in the
      inspector doing nothing. Hidden params keep their defaults and are still
      passed to compute, so only the inspector changes.

   Saved patches write every parameter out explicitly, so existing work is
   untouched; only newly added Potato nodes pick the new default up.

   Both guards test the PARAM LINE rather than the file, because the compute
   body also contains the string p.eyes !== "None" and a file-wide test reports
   a false SKIP on an unpatched node.

   Anchored, idempotent, MISS-aborts. Run once from the repo root:
     node tools/era/patch-potato-clean.mjs                                    */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const F = ["src/defs/nodes/potato.js", "defs/nodes/potato.js"].find((p) => existsSync(p));
if (!F) { console.log("MISS  src/defs/nodes/potato.js not found"); process.exit(1); }
let s = readFileSync(F, "utf8");

const lineOf = (needle) => {
  const rows = s.split("\n").map((l, i) => [l, i]).filter(([l]) => l.includes(needle));
  if (rows.length !== 1) { console.log("MISS  " + needle + " on " + rows.length + " lines, need 1"); process.exit(1); }
  return rows[0];
};

let changed = 0;

/* --- 1. clean default --- */
{
  const [line] = lineOf('key: "eyes"');
  if (!/def:\s*"None"/.test(line)) {
    const next = line.replace(/def:\s*"[^"]*"/, 'def: "None"');
    s = s.replace(line, next);
    console.log('OK    Potato Eyes default -> "None"');
    changed++;
  } else console.log("SKIP  Eyes already defaults to None");
}

/* --- 2. hide the eye count when there are no eyes --- */
{
  const [line] = lineOf('key: "eyeCount"');
  if (!line.includes("showIf")) {
    const next = line.replace(/\}\s*,\s*$/, ', showIf: (p) => p.eyes !== "None" },');
    if (next === line) { console.log("MISS  could not extend the eyeCount param line"); process.exit(1); }
    s = s.replace(line, next);
    console.log("OK    eyeCount hides while Eyes is None");
    changed++;
  } else console.log("SKIP  eyeCount already has a showIf");
}

if (!changed) { console.log("SKIP  nothing to do"); process.exit(0); }
writeFileSync(F, s);
console.log("DONE  bump the version and rebuild");
