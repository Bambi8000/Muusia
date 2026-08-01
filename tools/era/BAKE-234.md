# v2.34 bake & release checklist

Run from repo root. Lab files (nodes-lab/) and validators (tools/) from this
session must be in place first: diagram, empty_fill, volcano, nested_circles,
roadmap, map_import + their validate-*.mjs.

```bash
node tools/bake.mjs diagram empty_fill volcano nested_circles roadmap map_import

node tools/validate-diagram.mjs
node tools/validate-empty_fill.mjs
node tools/validate-volcano.mjs
node tools/validate-nested_circles.mjs
node tools/validate-roadmap.mjs
node tools/validate-map_import.mjs
```

Every validator auto-switches from the lab file to the baked
src/defs/nodes/*.js when it exists — expect "target: baked ..." on each.

```bash
ls src/defs/nodes | wc -l
```

Expect previous count + 6 (handoff patch assumes 186; if your tree differs,
fix the two count lines in the patched handoff).

```bash
node tools/patch-docs-234.mjs

sed -i '' 's/APP_VERSION = "2.33"/APP_VERSION = "2.34"/' src/App.jsx
grep -o 'APP_VERSION = "[^"]*"' src/App.jsx

npm run build
```

Visual pass in the browser (per pitfall notes: never judge by Quick Look),
then commit & push. CDN lags ~10 min; verify with byte size + version grep.
