/* Era patch: make the Learn provenance checks survive an APP_VERSION bump.
   Run from the repo root. Anchored exact-string replacement; MISS aborts before
   anything is written; SKIP if already applied.

   Why: learn/validate.mjs required the screenshot capture version and both
   reference-export provenances to EQUAL the current app version, and pinned the
   exports to the exact sha256 of src/App.jsx - a file whose APP_VERSION line
   changes in every release. v2.107 (one new node, no UI or export change) broke
   the Pages deploy with "Screenshot capture version must match" and two
   "invalid reference SVG export (+ '2.106' - '2.107')" failures.

   After this patch: captures and exports may come from an EARLIER version (never
   a newer one, never malformed), and App.jsx is hashed with its APP_VERSION line
   normalised to the captured version - so a version bump passes while any real
   change to the export code still fails exactly as before. README and HANDOFF
   state the routine: npm run check:learn is part of every release. */

import { readFileSync, writeFileSync } from "node:fs";

const F_VAL = "learn/validate.mjs", F_README = "learn/README.md", F_HAND = "docs/MUUSIA-HANDOFF.md";
let val = readFileSync(F_VAL, "utf8"), readme = readFileSync(F_README, "utf8"), hand = readFileSync(F_HAND, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (val.includes("function versionNotNewer(")) { console.log("SKIP  patch-learn-version-tolerant already applied (sentinel found)"); process.exit(0); }

const one = (src, old, neu, name) => { const parts = src.split(old); if (parts.length === 2) { OK(name); return parts.join(neu); } MISS(name + (parts.length === 1 ? " (anchor not found)" : " (anchor not unique: " + (parts.length - 1) + " hits)")); return src; };
const all = (src, old, neu, name, expected) => { const parts = src.split(old); if (parts.length === expected + 1) { OK(name + " (" + expected + " sites)"); return parts.join(neu); } MISS(name + " (expected " + expected + " hits, got " + (parts.length - 1) + ")"); return src; };

/* ---- 1. version helper, inserted before assertExportSourceMatches ---- */
val = one(val,
  "async function assertExportSourceMatches(source) {\n  const bytes = await fs.readFile(path.resolve(HERE, '..', source.path));",
  `/** Captured provenance may be older than the running app (every release bumps APP_VERSION) but never newer or malformed. */
function versionNotNewer(captured, current) {
  const parse = value => (typeof value === 'string' && /^\\d+\\.\\d+$/.test(value) ? value.split('.').map(Number) : null);
  const a = parse(captured), b = parse(current);
  return Boolean(a && b && (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])));
}
function normaliseAppVersion(bytes, source, capturedVersion) {
  // The capture-time hash of src/App.jsx was taken with APP_VERSION = "<captured>"; only that constant may differ.
  if (source.path !== 'src/App.jsx' || !capturedVersion) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/APP_VERSION = "\\d+\\.\\d+"/, \`APP_VERSION = "\${capturedVersion}"\`), 'utf8');
}

async function assertExportSourceMatches(source, capturedVersion) {
  const bytes = normaliseAppVersion(await fs.readFile(path.resolve(HERE, '..', source.path)), source, capturedVersion);`,
  "validate.mjs: versionNotNewer + APP_VERSION-normalised App.jsx hash");

/* ---- 2. screenshot capture version ---- */
val = one(val,
  "check(captureManifest.appVersion === manifest.version, 'Screenshot capture version must match the generated source manifest.');",
  "check(versionNotNewer(captureManifest.appVersion, manifest.version), `Screenshot capture version (${captureManifest.appVersion}) must be a valid version no newer than the generated source manifest (${manifest.version}).`);",
  "validate.mjs: capture manifest version may be older");

/* ---- 3. export provenance versions (SVG + ZIP branches) ---- */
val = all(val,
  "assert.equal(provenance.appVersion, manifest.version);",
  "assert.ok(versionNotNewer(provenance.appVersion, manifest.version), `export captured with app ${provenance.appVersion}, which must be a valid version no newer than ${manifest.version}`);",
  "validate.mjs: export provenance version may be older", 2);

/* ---- 4. pass the captured version into the source-hash check (SVG + ZIP branches) ---- */
val = all(val,
  "for (const source of provenance.sourceFiles || []) await assertExportSourceMatches(source);",
  "for (const source of provenance.sourceFiles || []) await assertExportSourceMatches(source, provenance.appVersion);",
  "validate.mjs: hash check receives the captured version", 2);

/* ---- 5. README: state the policy ---- */
readme = one(readme,
  "On UI changes, recapture affected screenshots and review them beside the lesson. The validator checks that published pixels and their provenance match the source captures.",
  "On UI changes, recapture affected screenshots and review them beside the lesson. The validator checks that published pixels and their provenance match the source captures. A version bump alone does not require recapture: captures and reference exports may record an earlier app version (never a newer one), and the export source check hashes `src/App.jsx` with its `APP_VERSION` line normalised to the captured version, so only real changes to the export code or the other listed source files fail validation. `npm run check:learn` runs in the Pages deploy and is part of every release.",
  "README: version-bump policy");

/* ---- 6. HANDOFF: release routine ---- */
hand = one(hand,
  "- Deploy: git push → GitHub Pages via CI (`.github/workflows/deploy.yml`),\n  which serves **only the built `dist/`** — repo `docs/` is never online.",
  "- Learn check: `npm run build` also builds the Learn site (`build:learn`), and the\n  deploy workflow then runs `npm run check:learn` (learn/validate.mjs, ~18k checks:\n  links, assets, patch integrity, screenshot + export provenance). **Run it locally\n  after the build, before committing** — a red check:learn means Pages will not\n  deploy. Captures may be older than APP_VERSION (never newer); any real change to\n  src/App.jsx export code, stack-view.jsx or the listed node files breaks the export\n  provenance and needs a recapture or a reviewedChange entry (learn/README.md).\n- Deploy: git push → GitHub Pages via CI (`.github/workflows/deploy.yml`),\n  which serves **only the built `dist/`** — repo `docs/` is never online.",
  "HANDOFF: check:learn in the release routine");

if (miss > 0) { console.log("ABORT " + miss + " anchor(s) missed - nothing written"); process.exit(1); }
writeFileSync(F_VAL, val); writeFileSync(F_README, readme); writeFileSync(F_HAND, hand);
console.log("DONE  " + ok + " edits applied: " + [F_VAL, F_README, F_HAND].join(", "));
