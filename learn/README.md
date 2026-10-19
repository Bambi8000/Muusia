# Muusia Learn

An English companion guide to Muusia: seven foundation tutorials, twelve Craft tutorials, ten Shapes tutorials, twenty illustrated node guides, thirty real UI screenshots, reproducible SVG comparisons and forty downloadable patches (twenty node examples, seven tutorial projects, a blank starter, seven animation projects, a printable Murmuration project and four Microbes studies). Two reference export artifacts come from the actual app: a per-pen SVG ZIP and a single test SVG. Three English animation-study pages add six motion examples, a combined Grid Hairs + Solids loop, a dated 310-node motion survey and eight earlier interactive probes. Murmuration and Microbes also have live players inside their node guides. The site is static and has no external runtime network dependencies. Its manual-style layout uses a plain text title, compact navigation and practical reference pages; it has no separately invented Muusia logo.

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

The seven foundation tutorials and twenty illustrated node examples use A4 landscape (297 × 210 mm) and the default pen palette. The additional animation studies use a fixed 140 × 140 mm canvas and one pen. Geometry is generated with the actual node definitions, not approximated from descriptions. Comparison captions name the changed control. Frame uses 12 frames, and frame 2 is pictured; animation settings must be set after loading because Muusia does not save them in patches.

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

2026-10-19 Craft suite maintenance (local v2.130 development tree): Lens gained
opt-in Twist/Vortex and Array gained opt-in layouts. The original Travelling
pinch study and Grid Hairs / Solids composite were downloaded again through the
actual app as 36-frame SVG ZIPs with route optimization off. All 72 SVG frames
match the current evaluator/exporter exactly; each study's 24/36/48-frame output
also matches its original pre-extension node definition. Original patches,
measurements, screenshots and other capture records are unchanged. Per-study
`refreshes` entries record the two new captures and current dependency hashes.
No hardware or historical G-code test was rerun.


2026-10-16 complete-output maintenance (local v2.129 development tree): removed
engine-wide 120,000-point prefix truncation. The supplied Organic Rings / Torn +
BG Fill / Negative Space composition now retains all 9,473 paths and 148,512
points, including later halo loops and the background branch. Generators retain
their own work limits; combining existing geometry preserves it completely.
The physical SVG and both Stack Pens SVG sheets were downloaded again through
the real app and match the existing reference bytes. The selected saved profile
was Viivain - Gentle (technical pen), with its illustrative/unverified 793 × 813 mm
area; no hardware was run. All six animation studies and the composite were
recaptured as 36-frame SVG ZIPs: all 252 frames match actual graph output, and
historical comparison signatures are unchanged. Provenance records identify this
working tree. Existing Learn PNGs and the historical G-code check were not refreshed.


2026-10-16 Move / Scale motion maintenance: the physical-plot reference SVG was
downloaded again through the actual development UI (header v2.128). Its original
five-path A4 fixture, Merge selection, route optimization off, direction preserved
and Mega Canvas off were retained. The SVG bytes are identical; source records
now cover the opt-in motion implementation, whose missing/Off setting preserves
legacy transforms. The unchanged machine A profile remained selected. No hardware
or historical G-code test was rerun, and existing screenshots remain historical.
The Move / Scale guide now documents motion controls and labels its earlier
static screenshot as predating them.
The original Grid Hairs + rotating Solids composite was rebuilt with explicit
Motion Off defaults and freshly exported as an actual 36-frame SVG ZIP. All
278381 points match current graph output; its three historical comparison
signatures and all offline 24/36/48-frame geometry remain unchanged. Composite
capture provenance now covers this Move / Scale source; the other six gallery
projects and their unaffected capture records retain their original provenance.

Reference exports use `sourceProvenanceVersion: 2` and `sourceFiles` records containing `path`, `selector` and `sha256`. Each artifact has a fixed required set of source scopes. The scopes cover the relevant SVG serializers, routing, selected-output and export actions, Stack export behavior, `src/machine.js` and the fixture's node/helper dependencies. They exclude `APP_VERSION`, Help copy and unrelated interface styling. Unrelated App or engine edits therefore do not invalidate an unchanged exporter merely because they share a source file; generated geometry and artifact checks still apply.

If a tracked export or machine scope changes, load the documented patch and settings in the actual app, export the affected reference again, inspect its geometry, and update its download checksum and provenance. Do not replace a hash simply to silence a failed check. A missing or ambiguous selector after a source refactor requires reviewing the selector and recapturing the affected artifact. Version 2 records do not accept the former `reviewedChange` bypass; the recovery path is an actual recapture. A future extraction of export logic into a dedicated module would simplify these scopes, but belongs to the app/node owner and is not required for Learn maintenance.

After the browser export, print the source fields with the shared helper. Use `physical-plot` instead of `svg-workflow` for the single test SVG:

```sh
node --input-type=module -e "import { computeExportSourceRecords, EXPORT_SOURCE_PROVENANCE_VERSION } from './learn/lib/export-provenance.mjs'; console.log(JSON.stringify({ sourceProvenanceVersion: EXPORT_SOURCE_PROVENANCE_VERSION, sourceFiles: await computeExportSourceRecords('svg-workflow') }, null, 2));"
```

Copy those fields into the corresponding `assets/screenshots/*-export.json` record alongside the actual capture version, date, source commit, settings and artifact checksums. This command records source identity; it does not perform or prove a browser export. `npm run check:learn` includes the focused scope-regression tests and provenance checks; the test file can also be run directly with `node --test learn/test/export-provenance.test.mjs` while editing the helper. The AST parser uses the explicit `rolldown` development dependency. No additional publication script or deployment step is required.

## Current scope

The current build contains 36 static pages: the overview, tutorial index, node reference index, seven foundation tutorials, twenty node guides, three animation studies and three typography pages. Its 69 editable patches include the extra Murmuration and Microbes studies described below. Adding the studies does not claim a completed illustrated guide for every node or an eighth foundation lesson.

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

### 2026-10-11 animation pen-pass maintenance

Both reference exports were downloaded again through the actual in-app browser
from the local 2.115 working tree on `codex/murmuration-pen-passes`, based on
`b6744ba81089cb377c9d2d5fb77838a98d07151b`. The recorded External SVG profile,
canvas and export settings were reproduced; both artifacts are byte-identical
to the previous downloads. Source coverage now also includes `src/frame-export.js`
and the Animation export order state/imports. This protects the new **All frames
by pen** path without fingerprinting unrelated App UI. Existing screenshots and
the historical physical-plot G-code record were not recaptured.


### Murmuration guide and camera comparison · 2026-10-11

`nodes/murmuration/index.html#camera-comparison` contains the English edition of
`docs/murmuration-tracking/`: Follow group beside Follow animal 17, Reindeer /
Bird, 24 / 48 frames, ground modes, scrubbing and separate base/highlight previews.
The player starts paused. It runs the actual node, using the existing Rolldown
dependency to bundle only the node and its used helpers into a standalone browser
module. The published page does not fetch `/src/` or require a development server.
The ordinary guide includes real static results, three camera comparisons,
all conditional controls, a genuine 2.115 Focus screenshot and a single-node patch.
Its screenshot is frame 1 of 48; controls below the viewport are not shown.

The additional `examples/murmuration-tracking.muusia.json` download is copied
byte-for-byte from the tested local study. It is a 24-sheet Murmuration → Frame
Grid patch; set both Total frames and ANIMATE Frames to 48 for a 48-sheet job.
The guide explains All frames by pen, fixed page coordinates, paper stops and
Liike's separate role in photo alignment. Three actual 24 × 2 app batch exports
(SVG/G-code/DXF) are recorded in the source study's `browser-checks.json`.
Physical two-pass registration remains untested. The Learn validator checks this
additional patch's identity, key printing settings and its match to the node example.
The module is rebuilt from source on each Learn build. Regenerate the ordinary
assets and capture affected UI if the node controls or illustrated fixture change.


### Microbes guide and living microscope · 2026-10-11

`nodes/microbes/index.html#living-study` embeds the reviewed English local study:
four presets, six selectable specimens, Still/Drift/Breathe/Swimming, one to six
colours, 24/48 frames, play/pause and scrubbing. It starts paused and pauses when
the page is hidden. The same `docs/microbes/study.js` player is bundled with the
actual node and Help examples for static hosting; no development `/src/` requests.
The four extra patches are copied byte-for-byte from `docs/microbes/`, whose
builder regenerates them from Help. `check:learn` checks their identity and current
Help graph/page parity. The ordinary guide fixture is the six-colour microscope.

`microbes.png` is a real v2.117 Focus capture at 1120 × 900, frame 1 of 48,
A4 wide, using `examples/microbes.muusia.json`. Canvas size was chosen explicitly
after loading. Its individual manifest entry records the node hash and capture
version; older screenshots keep their own provenance. The guide explains that
crowded specimens shrink to fit, and covers all conditional controls. Three real
node comparisons show Cell, Rod and Ciliate enlarged. Use the paper preset and
set ANIMATE Frames after loading; these patch files do not restore those UI
settings. Four study downloads include one A4 portrait example.

The guide links from the Learn overview, tutorial index and node library, with
steps for Frame Grid and All frames by pen. Single-frame SVG and G-code were
checked in the real app during node development; see `docs/microbes/browser-checks.json`.
Physical plotting and a Microbes-specific batch ZIP inspection remain unclaimed.

### Typography tutorial and all text tools · v2.118

`typography/index.html` teaches outlined lettering, Pattern Fill, the new blue
Stitch Type Motif input and Concrete Poetry animation (including Shift and
fixed-letter Zoom). `typography/nodes/index.html` documents all fourteen existing
text tools, using real computed illustrations and mode-dependent parameter tables.
These are fourteen reference sections, not fourteen additional illustrated node
pages. The separate `typography/research/` companion publishes the 311-node audit
and twelve original study projects as a dated v2.117 snapshot; its first proposed
extension is now implemented. The new section adds 17 current example projects
plus those 12 original projects to the previous 40 downloads.

`learn/typography/` owns its builder, source fixtures, live Concrete Poetry player
and validators. The player is bundled from the real node, starts paused and offers
all fourteen motions with 24/36/48 frames. Shift and Zoom switch to appropriate
recipes; their downloadable patches are separate. Shared validation computes 216
frames across the three starting recipes and verifies periodic endpoints.

`motif-ui.png` is the actual development Focus view of the Microbes → Stitch Type
INK example (424 paths). `capture.json` separately records complete browser SVG
and G-code captures of the smaller I / Pixel 1 variation: 32 paths, 5,120 points,
200 × 140 mm, pen 6. `validate-capture.mjs` compares all SVG geometry and G-code
segments to the current node, including pen-up rapid moves. The exporter route
optimization may reorder paths. These evidence files are retained in the source,
not offered as ready-to-run machine downloads. The development header was still
v2.117 when captured; source hash pins the new implementation. No physical plot.

### Type Studio · v2.119

The Typography tutorial now starts with a real Type Studio playground: ten
treatments preserving study numbers 01–05, 07–08 and 10–12. Text survives treatment
switching; conditional controls, reset and a project download use the actual node
parameters. `studio-player.js` is bundled with the same node implementation.
The existing twelve study recipes remain unchanged as historical evidence.
The text reference now has 15 sections; 11 new current projects (the default node
and ten Help treatments) bring this subsection to 28 current patches and Learn
to 80 total patch files. The page count stays 36.

`docs/type-studio/ui.jpg` is a real development Focus screenshot, copied into the
lesson. Browser SVG/G-code evidence is kept in that same source directory and
checked by `tools/validate-type-studio.mjs`; these are not machine presets.
The feature is included in the v2.119 release. The screenshot and browser export
evidence retain their original v2.118 development header; the captured node
implementation is unchanged.

### Frame Bang and checkbox inputs · local preparation 2026-10-15

Frame appends Bang and Toggle after its five original clock ports. The Frame
control reference covers periodic fractions, seeded Random and numeric checkbox
thresholds. Its older screenshot remains a dated illustration of the original
clock controls. The original turn fixture and geometry are unchanged.

The checkbox evaluator change required fresh browser captures of both reference
exports. They were downloaded from the actual local in-app browser again at
v2.124; the single SVG and per-pen ZIP match the previous files byte-for-byte.
Fresh selected source records are stored in their provenance JSON. Route
optimization was off, direction preserved, and the Stack test hid Red while
exporting both pens. The existing A — Servo Z profile stayed in G-code workflow;
only SVG reference files were downloaded, without changing machine settings.
No hardware was run. Historical G-code evidence and PNG captures stay unchanged.

The selected animation evaluator and Frame dependency also changed. All eight
gallery SVG-panel comparisons and all three combined-motion comparisons were
recaptured in the actual in-app browser at 36 frames, with route optimization
off. Ordered path signatures, point counts and page dimensions all match the
previous records. The original builders were rerun; their historical Frame
nodes retain empty saved settings, so all seven graphs and their geometry stay
unchanged. Browser records now identify the current local sources. These are
SVG-panel comparisons, separate from the new Bang example's actual 16-frame
SVG/G-code ZIP checks; they do not claim downloaded-byte checks or hardware.

### Every checkbox and checklist choice · local preparation 2026-10-15

The shared checkbox path covers 298 ordinary checks in 162 node modules and
the hidden inline Route check. Each of Test Card's 12 Tests options now also
has a green value port (`p:tests[0]` through `p:tests[11]`), giving 311 inputs
across 163 built-in nodes. Stored tests remain an array; wires alter only their
own option during evaluation. An explicitly empty Test Card selection draws
nothing. Guide lists each option's live state and source. Animation batch
buttons accept an empty paths frame, so a Bang-off preview cannot block a loop
whose later frames contain drawing.

All 311 inputs were checked through the actual evaluator for pulse, group
binding, saved-state restoration and Guide port recognition (2,527 total
Frame/engine cases). The real UI verifies all 12 option ports, pulse and held
Toggle, native connect/disconnect, and 16-frame SVG/G-code ZIPs launched from
an empty frame. All path data and drawing coordinates match node computation.
The two reference SVG artifacts and all 11 animation panel comparisons were
recaptured again after this evaluator extension: bytes/signatures and the seven
original graphs stay unchanged. The records identify the new selected sources;
historical PNG/G-code evidence remains untouched. No hardware execution.

## Craft tutorials (local 2026-10-19)

`craft/` adds twelve step-by-step lessons: Marbling, Shape Packing, Path Bend,
Seamless Tile, Reaction Patterns, Crystal Growth, Mesh Render, Array, Lens,
3D View, Drape and Gravity. Published Learn pages remain English. The same
bilingual authored content also builds a separate Finnish companion with
`buildFinnish(outputDirectory)` from `craft/build.mjs`; it is not another
published language route. The companion uses the same patches, screenshots,
reference SVGs and captured frame player.

Each lesson has five steps, exact port-to-port connections, control values read
from its complete patch, two experiments, troubleshooting and export guidance.
Ten have ready-wired animation patches and actual twelve-frame SVG batches;
packing and repeat tiling are taught as static compositions. There are 22 complete
patches, 12 actual reference SVGs, 24 genuine UI captures (12 Focus and 12 graph),
and ten ZIPs / 120 captured vector frames. PNG conversion only changes encoding
when the browser returns JPEG bytes; no controls or connections are redrawn.

`craft/capture-manifest.json` records the local v2.130 development build containing
the Craft source, file hashes, capture dimensions, scoped evaluator/exporter
hashes and node/helper dependencies. The previously published v2.130 did not yet
contain these nodes. Actual captures used route optimization off and fixed
297 × 210 mm pages. The graph captures minimize source cards to show connections;
Focus captures show the output node at a larger scale. Red guides in the graph
view are editing overlays. These captures verify software geometry, not hardware.

`craft/fixtures.mjs` uses the actual app evaluator and SVG serializer. The builder
copies captured output; it does not replace UI evidence with synthetic cards.
`craft/validate.mjs --source` checks the bilingual lessons, pin types, parameter
ranges, every reference SVG coordinate and all captured animation frames.
`npm run check:learn` also checks the built copies and all page links under both
supported deployment prefixes. The player reads bundled SVG files and uses no
external runtime API. Source changes affecting these examples require review
and actual recapture; `craft/record-captures.mjs` is deliberately not a build step.

The new pages are linked from Overview, Tutorials and the guide sidebar. This
work is local until the suite and guide are integrated and publication is
verified. Older screenshots elsewhere in Learn retain their own provenance.


## Shape and field projects (local, 2026-10-19)

`learn/shapes/` adds ten English lessons at `learn/shapes/index.html`: Flow Field
even pole streams, Wave interference, To Polar spiral morph, Warp cell
interpolation, Truchet bands, Tiles field variation, Mini Squares rectangle
packing, Network drift, Cell Strands and Block Field. The collection includes
eighteen runnable patches, twenty actual Muusia PNG captures, ten actual SVG
downloads and eight actual twelve-frame SVG ZIPs with offline players. Ten raw
G-code captures in the source-only verification directory are software evidence,
not machine presets or ready-to-run downloads. The suite validator compares every
SVG and G-code coordinate and all 96 animated frames with the actual evaluator.

Run `node tools/validate-shapes-suite.mjs` and
`node learn/shapes/validate.mjs --source` for focused checks. `--record` is only
for fresh actual browser evidence, never part of the build. Keep the image
intake/save fixture and receipt in the source verification directory. UI image
format conversion is permitted; pixel retouching is not. Global build and Learn
checks include all eleven new pages and their downloads. The site now has sixty
English pages. Nothing in this local implementation authorizes publication.

Wave retains its original Along path drawing, but gains a second blue input and
new controls. Its older foundation screenshot is explicitly historical. The
two-pen Stack SVG reference was downloaded again after this extension, with
Red hidden in preview, no margin, Mirror/Numbers off, Drill Off and route
optimization off. Both exported SVG files are byte-identical to the originals;
the new source patch contains the explicit neutral new defaults. Capture
provenance identifies the actual local A servo demonstration profile (330 × 240
mm, unverified). Historical screenshots and physical G-code checks are unchanged.
