# Muusia Learn

An English companion guide to Muusia: seven complete tutorials, eighteen illustrated node guides, twenty-eight real UI screenshots, reproducible SVG comparisons, twenty-six downloadable patches and two reference export artifacts from the actual app: a per-pen SVG ZIP and a single test SVG. Three English animation-study pages add six motion examples, a combined Grid Hairs + Solids loop, a 310-node motion survey and eight earlier interactive probes. The studies add seven editable project downloads (33 patches in all). The site is static and has no external runtime network dependencies; animation data is fetched from the same site. Its manual-style layout uses a plain text title, compact navigation and practical reference pages; it has no separately invented Muusia logo.

## Build and preview

Public URL: [Muusia Learn](https://bambi8000.github.io/Muusia/learn/). The application remains at [Muusia](https://bambi8000.github.io/Muusia/).

Run `npm run build` from the repository root. It builds the standalone application and then the guide into `dist/learn/`. The existing Pages workflow publishes both in the same artifact. Nothing is published by the local build.

Read `docs/MUUSIA-AGENTS.md` before maintenance. To publish an update, run the shared release gate in order:

```sh
node tools/validate-catalog.mjs
npm run build
npm run check:learn
```

Commit and push the reviewed source and required assets to `main` only after all three pass. The existing GitHub Pages workflow repeats the build and Learn validation before publishing. Verify the workflow succeeds and open the public guide, a lesson and its downloads before announcing the update. Keep machine-profile implementation handoffs separate from the website artifact.

Run `npm run preview:learn`, then open `http://127.0.0.1:5183/learn/index.html`. The Open Muusia link opens the application at the same origin. Muusia's built web Help also links back to Learn; the link is omitted in the development server and a standalone `file://` application, where built guide pages are unavailable.

After changing guide content or styles, `npm run build:learn` rebuilds only the guide. `npm run check:learn` validates the built application and guide. Rebuild the application first if its code changes.

## Where things live

- `content.mjs`: authored tutorials, recipes, controls and troubleshooting.
- `lib/fixtures.mjs`: complete example graphs with explicit parameters, seeds, canvas dimensions and image data; imports the real node computations.
- `generate-assets.mjs`: renders full SVG geometry, comparisons, original image fixture and patch downloads, with deterministic validation.
- `generated/manifest.json`: versioned source metadata and artifact provenance. Generated, never hand-edited.
- `assets/screenshots/`: eighteen node captures, six tutorial graph captures, two Stack workflow captures and two machine/export captures from the actual Muusia application, plus their capture manifest and SVG-export provenance. There are no synthetic node cards or replacement connection diagrams.
- `build.mjs`, `site.css`, `site.js`: static page generation, responsive presentation and local node-library search. No external fonts or dependencies.
- `animation/`: English templates, authored motion/recipe text and all 310 proposal translations; its builder preserves the source studies’ geometry, graphs and capture evidence.
- `validate.mjs`: broken links, missing assets, page coverage, patch integrity and screenshot/provenance validation; also rejects Finnish Style labels, synthetic diagram references and the removed logo markup in published HTML.

## Reproducibility and screenshot capture

The seven foundation tutorials and eighteen illustrated node examples use A4 landscape (297 × 210 mm) and the default pen palette. The additional animation studies use a fixed 140 × 140 mm canvas and one pen. Geometry is generated with the actual node definitions, not approximated from descriptions. Comparison captions name the changed control. Frame uses 12 frames, and frame 2 is pictured; animation settings must be set after loading because Muusia does not save them in patches.

The two-pen tutorial chooses colours directly on the generators: Grid uses Pen 1 · Blue and feeds Wave, while Tracks uses Pen 2 · Red. Wave and Tracks feed Merge inputs 1 and 2, with Pen change per input off. Its variation changes Grid’s Pen to 3 · Green. The separate Set Pen example takes that finished multi-pen composition from Merge and uses Recolor All → To pen 0 · Black to put the whole drawing on one pen. Its comparisons show the original two-pen input, all-black output and all-green output.

Lesson 04, **Export a two-colour SVG set**, reuses that graph and adds the current Stack → Pens → SVG .zip workflow. Its quick reference and seven steps cover export settings, file-to-pen mapping, registration and handoff to external plotting software. Regular SVG groups are distinguished from Inkscape layers; manufacturer profile integration is not implied.

Lesson 05, **Transform, crop and fill shapes**, builds Tracks → Move / Scale → Rotate → Hatch Fill → Container. Its seven steps and quick reference explain independent axis scaling, the rotation pivot, closed regions, hatch pens and filling before clipping. The four associated node guides include genuine Focus screenshots and comparisons generated from the same source geometry. The final drawing contains blue cropped hatch strokes and a separate black frame.

Lesson 06, **Control a patch with numbers**, keeps Grid → Wave as the drawing branch and connects Value → Math A, Random → Math B, and Math → Wave’s Amplitude mm input. With Value 4, Random Min 1 / Max 2 / Seed 11, and Math set to A × B, the amplitude is approximately 6.54 mm. The lesson explains green numeric connections, connected controls, fallback values and repeatable seeds. Random and Math have separate guide patches and reproducible parameter comparisons: Random directly drives Wave with Min 2 / Max 8 / Seed 11; Math multiplies a connected Value 4 by its unwired B value 2. Keep Wave selected to see and export the drawing in all three examples.

Lesson 07, **Prepare your first physical plot**, provides separate SVG and G-code preparation routes around one small test drawing. Two Container nodes produce a 20 × 20 mm square and a right-pointing triangle; Grid → Move / Scale supplies three separate horizontal strokes, and Merge combines all five paths on Pen 0 · Black. The lesson distinguishes document dimensions, artwork bounds and machine work area; shows real Machine Setup and generated G-code; and explains the physical measurements the user must perform. Its nine steps and quick reference do not claim a calibrated device preset or a completed physical plot.

`examples/svg-workflow-per-pen.zip` was downloaded through the real Muusia UI with Merge selected, Sheet margin 0, Mirror/Numbers off and Drill marks Off. The red sheet was hidden in the preview to verify that the export still includes both colours. Its two files contain 24 blue wave paths and 12 red loop paths, each on the same 297 × 210 mm page. `assets/screenshots/svg-workflow-export.json` records checksums, source files and settings. This ZIP is a captured artifact, not regenerated by the illustration generator; recapture and validate it if export behavior changes.

`examples/physical-plot.svg` is the test drawing exported through the actual Muusia UI with Merge selected, Optimize route off, Preserve direction on and Mega Canvas off. It preserves the 297 × 210 mm page and five paths: two closed outlines and three open strokes. `assets/screenshots/physical-plot-export.json` records the patch/export checksums and source provenance. Its G-code software-check record is historical: the demo profile **Learn — example only** was checked in v2.106 on 2026-09-29. In that export, five drawing paths matched the patch at 0.01 mm precision, all rapid moves occurred with the pen up, and the result ended pen-up. It does not verify the later first-lift dwell change in v2.109. No machine was run. The captured SVG is supplied as a reference download; no ready-to-run machine G-code or calibrated profile is bundled.

Both reference artifacts were downloaded again through the actual Chrome UI on 2026-10-04 in Muusia v2.109, source commit `4f39746b7e1f5cd824350e31a71fd69eeffca244`. Their bytes match the original downloads exactly. The recapture used the External SVG workflow and profile **Learn — External SVG example**; its 330 × 240 mm work area was illustrative and not manufacturer-verified. This refresh verifies the SVG exports and their scoped source provenance. It does not refresh the PNGs, rerun the historical G-code check or verify any physical machine.

Capture the corresponding `examples/<node-key>.muusia.json` in Muusia. Choose A4 wide in the toolbar to synchronize the visible size fields, select the relevant output, then capture at 1120 × 900 pixels. Most node shots use Focus mode (F) at 100% graph zoom. Stroke, Value, Frame, Random and Math use the normal graph view at approximately 83% zoom so the driving connection and consuming node are visible. Keep each relevant node header and connected port clear of overlapping cards. Return with Esc; reloading the app restores the normal graph framing when switching examples. Long Focus panels scroll within the application; the control reference on the page covers settings below the pictured portion.

For each tutorial, load its complete example patch and capture the actual graph view with its real node cards and wires. The first three graph captures are `tutorial-first.png`, `tutorial-stamps.png` and `tutorial-two-pens.png`, corresponding to the identically named files in `examples/`. Later lessons have their own capture instructions below. Request a 1600-pixel-wide viewport, with heights 620, 800 and 980 pixels respectively. The current browser capture contains the left 1125 pixels, including the graph and node menu; the right-hand preview is intentionally outside these images because each tutorial supplies a separate result image. Use 100% graph zoom for the first two tutorials and approximately 83% for the two-pen composition. Record both requested viewport and actual captured dimensions in the manifest.

Frame the tutorial graph so all relevant nodes and connections are readable, select the final output, and preserve the genuine app controls. Do not redraw Muusia's nodes as simplified cards. Style input labels are English in the node definitions and should read **Style** in the captures.

For lesson 04, load `examples/tutorial-svg-workflow.muusia.json`, choose A4 wide, select Merge and open Stack → Pens at 1120 × 900 pixels. Use Paper background and turn Plexi off for readability; these are preview-only settings. `svg-stack.png` shows both sheets and `svg-stack-settings.png` shows Red hidden in the preview. Both captures show the export settings described above. Reuse `tutorial-two-pens.png` for the unchanged graph.

For lesson 05, capture the four new node examples in Focus view at 1120 × 1000 pixels with 100% graph zoom. All controls fit. Load `examples/tutorial-transform-fill.muusia.json` for the graph capture, select Tracks before zooming out three times to approximately 58%, then select Container. Request 1600 × 550 pixels; the capture is 1125 × 550 and includes all five cards and their wires. Container’s red dashed preview guide is an editing overlay; Draw region separately adds the black frame to the actual output.

For lesson 06 and its numeric guides, use the normal graph view at approximately 83% zoom with Wave selected. `satunnainen.png` is captured at the requested 1120 × 900 pixels and shows Grid, Random and Wave. For `matem.png` and `tutorial-numbers.png`, request 1600 × 820 pixels; the actual captures are 1125 × 820 and show the full connected graphs. The Math guide uses Grid, Value, Math and Wave; the tutorial adds Random to Math’s B input. Their numeric outputs feed a visible drawing consumer, rather than being mistaken for path geometry. UI checks confirmed Value 8 gives an amplitude of 13.07 mm, Seed 12 with Value 4 gives 4.83 mm, and restoring Seed 11 returns 6.54 mm.

For lesson 07, load `examples/tutorial-physical-plot.muusia.json`, choose A4 wide and select Merge. Keep both Container cards collapsed to show the real five-node graph clearly. At approximately 83% graph zoom, request 1600 × 950 pixels for `tutorial-physical-plot.png`; the actual capture is 1125 × 950. Capture `machine-setup.png` and `physical-export-gcode.png` at the requested 1120 × 1000 pixels, with Merge selected and the same zoom. Their demonstration profile is named **Learn — example only**, uses a 330 × 240 mm work area, origin 0/0, Flip Y off and servo mode; these values are illustrative, not device recommendations. The demonstrated start commands omit G28 homing, but the end commands still include G0 X0 Y0. Do not treat this as a file that makes no movement. Keep Optimize route off for the recorded reference, and do not execute it on hardware while recapturing the guide.

Screenshot status at the 2026-10-04 maintenance review: the 28 PNGs remain v2.106 captures. The two machine/export pictures predate Machine Setup's **Workflow** selector and the External SVG branch introduced in v2.108; they are historical illustrations, not current-control documentation. A separate UI refresh should show the G-code workflow and current generated output, then the External SVG profile with its optional metadata/work area and disabled G-code action. Keep the selected Merge, real UI labels and actual capture version in that refresh. Do not present a new SVG download or updated source checksum as evidence that these pictures were recaptured.

Use actual PNG encoding for `.png` files: some browser tools return JPEG bytes regardless of the output filename. Format conversion is acceptable; do not retouch controls, labels, connections or example geometry. Record the app version, patch, view, dimensions and SHA-256 checksum for all twenty-eight captures in `assets/screenshots/capture-manifest.json`. Graph entries use `view: "graph"`; Stack entries use `view: "stack"`; the two lesson 07 workflow entries use `view: "machine"` and `view: "export"`. On UI changes, recapture affected screenshots and review them beside the lesson. The validator checks that published pixels and their provenance match the source captures. Capture and reference-export versions may be older than the current app version, but must be well formed and cannot be newer. A passing provenance check does not establish that an older screenshot shows every current control.

## Export provenance maintenance

Reference exports use `sourceProvenanceVersion: 2` and `sourceFiles` records containing `path`, `selector` and `sha256`. Each artifact has a fixed required set of source scopes. The scopes cover the relevant SVG serializers, routing, selected-output and export actions, Stack export behavior, `src/machine.js` and the fixture's node/helper dependencies. They exclude `APP_VERSION`, Help copy and unrelated interface styling. Unrelated App or engine edits therefore do not invalidate an unchanged exporter merely because they share a source file; generated geometry and artifact checks still apply.

If a tracked export or machine scope changes, load the documented patch and settings in the actual app, export the affected reference again, inspect its geometry, and update its download checksum and provenance. Do not replace a hash simply to silence a failed check. A missing or ambiguous selector after a source refactor requires reviewing the selector and recapturing the affected artifact. Version 2 records do not accept the former `reviewedChange` bypass; the recovery path is an actual recapture. A future extraction of export logic into a dedicated module would simplify these scopes, but belongs to the app/node owner and is not required for Learn maintenance.

After the browser export, print the source fields with the shared helper. Use `physical-plot` instead of `svg-workflow` for the single test SVG:

```sh
node --input-type=module -e "import { computeExportSourceRecords, EXPORT_SOURCE_PROVENANCE_VERSION } from './learn/lib/export-provenance.mjs'; console.log(JSON.stringify({ sourceProvenanceVersion: EXPORT_SOURCE_PROVENANCE_VERSION, sourceFiles: await computeExportSourceRecords('svg-workflow') }, null, 2));"
```

Copy those fields into the corresponding `assets/screenshots/*-export.json` record alongside the actual capture version, date, source commit, settings and artifact checksums. This command records source identity; it does not perform or prove a browser export. `npm run check:learn` includes the focused scope-regression tests and provenance checks; the test file can also be run directly with `node --test learn/test/export-provenance.test.mjs` while editing the helper. The AST parser uses the explicit `rolldown` development dependency. No additional publication script or deployment step is required.

## Current scope

The current local build contains 31 static pages: the overview, tutorial index, node reference index, seven tutorials, eighteen node guides and three animation studies. Downloads include eighteen node patches, seven complete tutorial patches, one blank starter and seven animation projects, plus the captured per-pen SVG ZIP and SVG results. Adding the studies does not claim 310 completed illustrated node guides or an eighth foundation lesson.

Published nodes: Grid, Wave, Tracks, Stroke, Stamp, Set Pen, Merge, Value, Frame, Image, Polyhedron Studio, Travel Sort, Move / Scale, Rotate, Hatch Fill, Container, Random and Math. Other built-ins remain in the in-app catalog and are not represented as finished guides. Group/legacy guides and more advanced tutorials belong to the next stages in `docs/MUUSIA-LEARN-PLAN.md`.

The SVG examples and reference export artifacts are verified locally. The screenshot collection and lesson 07 demonstration G-code retain the historical verification described above. External manufacturer-software previews, controller compatibility, device calibration and physical plotting remain unverified. Machine-profile phase 1 from `docs/MUUSIA-MACHINE-PROFILES-CLAUDE-HANDOFF.md` is implemented in v2.108 and later; its new workflow controls still need fresh Learn screenshots.

Image art batch, 2026-10-04–05 (included in v2.111): Image adds Organic dots, Short strokes, Cross stitches and Square weave with up to six pens. The new blue Drawing input accepts paths from any node; Auto gives a connected drawing priority over the stored photo. Drawing stroke mm adjusts source coverage; Fill closed shapes uses even-odd interiors per pen and preserves holes. The purple Style port retains its original index for old patches. The guide and conditional-control reference cover these options; Help includes a Lissajous → Image example.

The existing Scanline wave example preserves its geometry. `image.png` was recaptured in the actual v2.110 development app on 2026-10-05 at its default 844 × 818 viewport, showing the Drawing port and Source controls. Its capture entry overrides the older manifest-level version/date and records the local node hash. Controls continue below the pictured area. All other screenshots keep their recorded capture versions. The previous 2026-10-04 Image screenshot is superseded by this actual capture.

## English animation studies (2026-10-09)

The global Animation link, Learn overview, tutorial index and guide sidebar lead to:

- `animation/index.html`: six motion examples with English controls/instructions, 24/36/48-frame playback, scrubbing, loop-join inspection, contact sheets and project downloads.
- `animation/combine-movements/index.html`: Grid Hairs moving down behind a rotating Solids sphere, with layer toggles, a project, first-frame SVG and contact sheet.
- `animation/node-motion/index.html`: the complete dated 310-node design survey, eight original 24/48-frame probes, readiness/category search, all proposals as TSV, Frame Grid plotting/capture instructions, time calculator and a clearly labelled development roadmap.

The original Finnish studies stay under `docs/animation-examples/`, `docs/animation-composite/` and `docs/animation-audit/`. `learn/animation/build.mjs` creates the English edition during the existing Learn build. Teaching text is in `content.mjs`, `proposals.en.tsv` and the three HTML templates; each template's module script is emitted separately as `study.js`. Only each of the six gallery projects' top-level `name` is translated. Every graph, parameter, edge, canvas, preview path and measurement remains identical to its source. The combined project already has an English name and is copied byte-for-byte.

`animation/provenance.json` distinguishes original file-byte SHA-256, original compact-JSON SHA-256 (the hash used by the original browser records), and the English published file-byte hash. Original geometry/browser records are copied unchanged. Their SVG SHA fields cover ordered path data, not downloaded SVG file bytes. The eight earlier probes are offline geometry tests; the gallery has eight browser export comparisons and the combined study has three (including the reported sphere-seam frame 08/36). Physical plotting and frame-batch ZIP capture are not claimed.

`npm run check:learn` now also checks translation coverage, unchanged graph/preview data, dynamically chosen assets, capture bindings and the editable examples' selected evaluator/SVG-exporter scopes plus node/helper dependencies. It does **not** gate on all of App.jsx. The broader survey is a dated snapshot: its historical full App.jsx hash is retained as review metadata only. If a tracked example dependency changes, rerun its original builder and obtain fresh affected browser exports, then rebuild the English edition. Do not merely overwrite capture hashes. An unrelated node update or UI/version edit must not require recapturing these examples.

The proposed loop controls and exporter fixes in the audit remain proposals; integration into Learn changes documentation only. These pages are included in the same Pages build as the application and existing tutorials.
