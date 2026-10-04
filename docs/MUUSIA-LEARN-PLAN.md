# Muusia Learn — website and content plan

Status: pilot prepared for publication on 2026-09-29 at https://bambi8000.github.io/Muusia/learn/ through the existing GitHub Pages workflow. Full-catalog expansion remains a future stage.
Initial content review: 2026-09-29, Muusia v2.106, commit `8f7245b`.
Maintenance source review: 2026-10-04, Muusia v2.109, commit `4f39746`.
Audience: beginners and experienced users in parallel, as confirmed by the owner.
All published tutorials, labels, captions and reference text will be in English.

Pilot delivered and expanded: 28 static pages, seven complete tutorials, eighteen illustrated node guides, twenty-eight real application screenshots, reproducible SVG comparisons, twenty-six downloadable patches and a searchable node library. Two reference export artifacts come from the actual UI: the per-pen SVG ZIP and the physical-test SVG.

Maintenance outcome on 2026-10-04: both reference exports were freshly downloaded through Chrome in Muusia v2.109 at source commit `4f39746b7e1f5cd824350e31a71fd69eeffca244`, using the External SVG workflow. Both files are byte-for-byte identical to the original artifacts. Their provenance now tracks relevant source scopes. The PNG collection and G-code software check remain historical v2.106 evidence; no new screenshots or physical test are claimed.

Lesson 04 adds the existing Stack → Pens → SVG .zip workflow, with actual export files and a quick reference for experienced users. Lesson 05 adds Move / Scale, Rotate, Hatch Fill and Container, with a fill-before-crop workflow, genuine screenshots and source-checked comparisons. Lesson 06 adds Random and Math alongside Value, using green numeric connections to control Wave amplitude with repeatable seeds and verified UI values. Lesson 07 adds separate SVG/G-code preparation routes, a 20 mm square and orientation/lift test, real Machine Setup and export screenshots, and an actual reference SVG. Its demonstration G-code was checked in v2.106 against all five drawing paths and pen-up rapid moves; that historical check does not verify later exporter changes. Physical plotting is still pending.

Each tutorial shows its actual Muusia graph; simplified node-card illustrations have been removed. The manual-style layout uses a plain text title without an invented Muusia logo. Visible Style ports and all guide text are English. The app build includes `dist/learn/`; web Help links to it. See `learn/README.md` for preview and maintenance instructions. Local checks cover generated assets, page links, downloads, screenshot provenance and per-pen SVG geometry. The remaining sections retain the broader content plan.

## 1. Intended result

A companion website, provisionally called **Muusia Learn**, with two equally clear entry points:

- **Start learning** — a guided progression from a first drawing to independently building and exporting patches.
- **Explore nodes** — a searchable visual reference for finding a node, understanding its controls and trying a working example.

The final scope includes every current built-in node, real application screenshots, explanatory illustrations and downloadable example patches. A smaller pilot is a production milestone, not a substitute for that final coverage.

Keep the main focus on Muusia. Link to Latu (G-code editing) and Liike (assembling captured animation sheets) where a workflow needs them; give those applications separate documentation later. Exclude experimental nodes-lab material from the built-in reference.

## 2. Verified starting point

This inventory records the initial v2.106 review, not a fixed count for later releases. Current website counts and version labels are derived from the registry and app source when the site is built.

| Resource | What can be reused | Caution |
| --- | --- | --- |
| `src/defs/nodes/*.js` + `src/defs/index.js` | 300 node definitions: names, keys, categories, ports, controls and computation | Some ports and controls change with the selected mode |
| `src/App.jsx` | Group and Route definitions, actual UI behavior, v2.106 | Group is a UI operation; Route is legacy and hidden |
| `docs/MUUSIA-NODES.md` | English reference text for all 302 built-ins | Dense reference prose needs teaching examples and editing |
| `docs/MUUSIA-TAGS.json`, `src/defs/catalog.js` | Tags and search descriptions | Catalog is generated; do not edit it by hand |
| `src/examples.js` | Ten deterministic, loadable Help examples | Canvas size, selected output and frame count need explicit tutorial setup |
| `src/catalog-browser.jsx` | Real node computation and SVG preview approach | 6,000-point thumbnail cap and generic inputs are unsuitable for some publication images |
| Portrait manual and Map guide in `docs/` | Substantial advanced guidance | Verify current behavior and supply reproducible example files |
| `.github/workflows/deploy.yml` | Existing GitHub Pages build/deployment workflow | Builds and validates Learn before publishing with the application |

The registry contains **302 built-ins**, with **298 visible in the catalog**. The hidden entries are Mask, Trace Image, Group and Route. Group still needs active documentation; the other three should be identified as hidden/compatibility entries rather than advertised as ordinary palette choices. Counts and version labels on the website should be derived from the source.

The README still says v2.36 / 195 nodes. Prefer current definitions, current UI and the v2.106 node reference when they disagree with older material.

The existing catalog and example validators pass. The example validator checks structure with stub defaults, so this does not establish visual correctness for all examples. The Stamps example was also loaded in the current UI: selecting Stamp produced a visible result and enabled export.

## 3. Website structure

| Section | Reader's goal | Main content |
| --- | --- | --- |
| **Start here** | Get a first result without prior node experience | First drawing, interface map, essential vocabulary, saving/loading |
| **Tutorials** | Learn by making something | Ordered lessons with prerequisites, visible outcomes and downloadable patches |
| **Node library** | Find a tool or understand a control | Search, categories, themes, tags, visual cards, individual node pages |
| **Projects** | Follow a more substantial creative recipe | Landscapes, typography, images, maps, animation, cards and layered work |
| **Plot & export** | Turn the preview into a usable file or physical drawing | Pens, SVG/DXF, machine profiles, G-code, routing, registration and tiling |
| **Troubleshooting** | Understand why a patch is not behaving as expected | Empty previews, wrong selected output, incompatible ports, fills, scale and imports |

Global search should find both node names and tasks such as “fill a shape”, “make a loop” or “reduce pen lifts”. Use official UI node names as page titles and stable internal keys as identifiers. Cross-link every lesson to its node pages, and every node page to relevant lessons.

Use a manual-style layout with a compact title and navigation, clear reference sections, comfortable reading width and an on-page contents list. Let actual Muusia graphs and drawing results carry the visual identity. Avoid a marketing hero, generic feature-card grids or an invented Muusia logo. The website should be comfortable to read on a phone even when the application steps require a desktop.

## 4. Learning progression

Durations below are editorial targets to verify through walkthroughs, not measured timings.

| Order | English working title | Outcome and teaching focus |
| --- | --- | --- |
| 1 | **Your first Muusia drawing** | Grid → Wave → SVG; add nodes, connect paths, change one control, select the final node, save the patch and export. Target 10–15 minutes. No plotter required. |
| 2 | **Style and stamp a pattern** | Stroke → Tracks → Stamp, adapted from the built-in Stamps example; style versus geometry, spacing, orientation and the Include host path option |
| 3 | **Build a two-pen composition** | Choose Pen directly on Grid and Tracks; connect Grid → Wave → Merge input 1 and Tracks → Merge input 2; preserve both pen assignments and export the complete SVG |
| 4 | **Export a two-colour SVG set** | Delivered: Stack → Pens → SVG .zip; one file per pen, shared page/coordinates, actual export settings, manual pen mapping and manufacturer workflow links |
| 5 | **Transform, crop and fill shapes** | Delivered: Tracks → Move / Scale → Rotate → Hatch Fill → Container; independent scaling, rotation pivot, closed regions, hatch pens and filling before clipping |
| 6 | **Control a patch with numbers** | Delivered: Grid → Wave; Value → Math A and Random → Math B, with A × B driving Wave Amplitude mm; connected controls, fallback values and repeatable seeds |
| 7 | **Prepare your first physical plot** | Delivered: a prepared 20 mm square, right-pointing triangle and three separate strokes; SVG and G-code branches, real Machine Setup, profile persistence, route preview and physical acceptance checks. Geometry and demonstration exports verified in software; physical plotting remains pending. |
| 8 | **Make a seamless animation** | Frame outputs, animated versus static branches, frame count and preview; prefer the current Frame node’s rot ° output for a simple looping rotation |
| 9 | **Build reusable patches** | Grouping, promoted parameters, modules, favorites, focus mode and preview locking |

Advanced project tracks follow the foundation: generative landscapes and textures; image/portrait workflows; lettering and maps; Mini Canvas/Card Sheet/Zine production; Mega Canvas and rolls; mesh slicing and layer stacks; Frame Grid and Liike. Reuse the existing ten examples as source material after checking their current behavior.

Each tutorial contains: finished result → what you will learn → prerequisites → numbered steps with exact UI labels → checkpoints showing the expected output → a small experiment → common mistakes → starter/final patch downloads → next lesson.

## 5. Standard node page

Every finished node page should answer “What does this do, when would I use it, and how do I get a useful result?”

1. Official name, category, tags and a short **What it does** explanation.
2. A large real output image and **Use this when…** examples.
3. An actual screenshot of a minimal working patch, including the relevant node card, connection and preview.
4. **Inputs & outputs**: data types, required versus optional connections, and mode-dependent ports.
5. **Try it**: a short recipe with a downloadable `.muusia.json` patch.
6. **Key controls**: selected controls explained through two or three comparable output images.
7. A complete, expandable control reference derived from the definitions: UI labels, defaults, units, choices and visibility conditions.
8. Common pitfalls and related nodes/tutorials. Mention performance or physical output behavior where it changes how the node should be used.
9. A tested version and traceable example/asset information.

Use different demonstrations for different outputs: modifiers need before/after images; combiners need their separate inputs and combined result; numeric nodes need a downstream effect or value chart; Stroke needs a consuming node; mesh outputs need a consumer such as Mesh Slice; Travel Sort needs a route comparison because the final drawing itself can remain unchanged.

Proposed 12-node pilot: **Grid, Wave, Tracks, Stroke, Stamp, Set Pen, Merge, Value, Frame, Image, Polyhedron Studio and Travel Sort**. This supports the first three tutorials and exercises geometry, style, values, files, multiple outputs, conditional controls and route-only effects. Lesson 05 adds Move / Scale, Rotate, Hatch Fill and Container. Lesson 06 expands the published library to eighteen guides with Random and Math; numeric examples show the downstream effect on Wave rather than presenting a number as path output.

Teach pen choice at its simplest useful location. Grid and Tracks already have Pen controls, so the two-pen tutorial uses four nodes and no Set Pen modifiers; Merge has Pen change per input off. The Set Pen reference instead demonstrates converting the complete blue-and-red composition into one black pen after Merge, with an all-green comparison. Its Single mode remains a secondary control reference for remapping one existing pen. The Polyhedron Studio silhouette example uses a Merge with only the Silhouette input connected and preserves the node’s Edge / silhouette pen setting.

## 6. Image and screenshot production

Use two complementary image types:

- **Actual UI screenshots** for where to click, how ports connect and which settings to change. Use real Muusia node cards and wires in every graph example. Keep the app controls and their labels intact, and put explanations in surrounding text and captions.
- **Actual Muusia output** for example artwork and parameter comparisons. Export as SVG when possible; use raster derivatives where needed for web display.

Screenshots and output examples must come from Muusia. Do not reconstruct node cards or substitute synthetic connection diagrams for the application. The current site contains eighteen node screenshots, six full tutorial graph screenshots, two Stack workflow screenshots and two machine/export workflow screenshots. All 28 PNGs remain v2.106 captures at the 2026-10-04 review. Lesson 04 reuses the unchanged two-pen graph. Generated SVGs show actual computation results and parameter comparisons, rather than imitations of the interface; both downloadable reference artifacts were exported through the app UI. Lesson 07's machine profile is explicitly illustrative; neither the screenshots nor the generated G-code establish calibration for a user's controller. Its two machine/export images are labelled historical and need a separate refresh for current G-code and External SVG workflow controls.

Build an asset manifest for each example: node keys, application version/commit, saved patch, canvas dimensions, parameter overrides, seed, palette, frame index/count, selected output, input assets, capture settings and explanatory caption/alt text. Freeze these values so changes can be reproduced.

For comparisons, change one parameter while keeping the rest fixed and label each value. Use curated fixtures: open and closed paths, multiple pens, masks/regions, a sample image, a mesh and multi-input compositions. Do not treat the catalog's “needs a file” placeholder as a finished illustration.

Reuse the catalog's computation approach to generate output images in batches, with suitable point budgets and per-node inputs. Add a repeatable browser capture workflow for UI screenshots. Review every published image for clipped geometry, readable text and agreement with the instructions. Use lazy-loaded thumbnails, larger click-to-enlarge images, descriptive alt text, and labels in addition to wire colors.

## 7. Implementation proposal

Keep Learn inside this repository as a separately built static companion under a provisional `/learn/` path. Preserve Muusia's standalone single-file build. The existing React/Vite setup can support reusable page components and search; generate static readable page content and a lightweight search index rather than shipping the whole Muusia engine on every documentation page.

Current pilot source layout:

- `learn/content.mjs` — authored English tutorials and curated node explanations, recipes and pitfalls.
- `learn/lib/fixtures.mjs` — reproducible tutorial and node fixtures that use real node definitions.
- `learn/examples/` — generated complete patches and an empty starter patch.
- `learn/assets/` — reviewed application screenshots, actual SVG results and comparisons.
- `learn/generated/` — derived node metadata and asset provenance.
- `learn/build.mjs`, `learn/site.css`, `learn/site.js` — static page generation, responsive manual layout and local search.
- `learn/generate-assets.mjs`, `learn/validate.mjs` — reproducible output generation and publication checks.

Generate the documentation output into `dist/learn/` after the application build and before the Pages artifact is packaged. Keep hosting base paths and direct page links compatible with a GitHub project site. No backend or user account system is needed for this documentation scope.

Treat node definitions as authoritative for controls and ports; use the existing node reference and tags for editorial/search content. Keep new educational content separate from generated metadata and link it by node key. Avoid maintaining independent copies of all parameter tables. Initially retain the existing catalog generation flow; any later consolidation of prose sources should be explicit and validated.

Use **Download example patch** plus the app's Load action first. A future **Open in Muusia** action would require a deliberate import/deep-link feature; do not present that as something the app already supports. Add links from in-app Help and node help to the relevant Learn pages during integration.

## 8. Delivery stages

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Pilot | Homepage, tutorial layout, node-page layout; 3 complete tutorials and 12 complete node pages with real visuals and patches | Instructions can be followed from a clean session; page layout and image style work for both audiences |
| 2. Full inventory | Searchable entries for all 298 catalog nodes, grouping guide and 3 hidden/compatibility entries | Every registry entry has a destination; unfinished visual/deep-guide coverage is tracked honestly |
| 3. Complete visual reference | Every catalog node has a verified example, readable screenshot and meaningful result/effect illustration; parameters and pitfalls reviewed in category batches | All 298 visible-node pages meet the standard in section 5; hidden entries are appropriately explained |
| 4. Complete learning paths | Foundation lessons and prioritized advanced projects, export/troubleshooting guides, app help links | Each route through the site leads to a concrete verified outcome |
| 5. Publish and maintain | Reviewed static site, publication through the existing hosting workflow, documentation update checks | Links, search, downloads, desktop/mobile readability and current-version coverage verified |

The pilot makes the remaining work measurable: record authoring, fixture preparation, screenshot capture and review effort before estimating the full 298-page visual expansion. Do not estimate that expansion merely from the number of existing text entries.

## 9. Accuracy checks to handle during content production

- **Preview/export selection:** loading a Help example clears the selection. Tell the reader which output node to select; a blank preview is not necessarily a broken patch.
- **Canvas and animation setup:** current examples do not fix the canvas, and loading them does not set frame count. Every tutorial needs explicit dimensions and animation settings.
- **Wire colors:** the UI uses purple (`T.style`) for style, blue for paths, green for numbers and amber for mesh. Follow current labels and colors, and explain the data type in words.
- **English labels:** visible Style input labels have been translated in the node definitions. Recapture affected screenshots when any UI label changes; the publication check rejects the former Finnish label in HTML.
- **Animation:** the existing example uses frame # × 15, while the default is 12 frames. A full rotation with that multiplier needs 24 frames; the current Frame node also offers a direct rot ° output.
- **Offline behavior:** do not repeat the README's blanket zero-network claim for features such as Portrait analysis, whose manual describes model downloads and HTTP-origin requirements.
- **Conditional UI:** derive and review mode-dependent controls and dynamic ports, rather than treating one default screenshot as the whole node interface.
- **Compatibility:** distinguish Group from hidden legacy nodes and link old node names to current workflows.

Quality checks for the implemented site: source-to-page coverage, valid links/downloads, reproducible nonempty outputs where applicable, input/output type checks, relevant mode coverage, image review, keyboard-accessible search/navigation, responsive reading layouts and a clean-session tutorial walkthrough. Validate all twenty-eight PNG files, their capture-manifest checksums and their matching example patches, and require each tutorial's genuine graph screenshot. Verify the downloaded per-pen SVG set retains the expected geometry and shared page coordinates. Verify the physical-test SVG retains the A4 page, 20 mm square, right-pointing triangle and three separate strokes. Keep the v2.106 demonstration G-code check separately dated: five matching paths at 0.01 mm precision, pen-up rapid moves and no hardware execution. Do not treat it as validation of v2.109's first-lift dwell change. Reject obsolete synthetic diagram references and the removed logo markup. Physical plotting verification is a separate test from successful SVG or G-code generation.

## 10. Next work after the pilot

The pilot's visual direction has been revised with the owner. **Export a two-colour SVG set**, **Transform, crop and fill shapes**, **Control a patch with numbers**, and **Prepare your first physical plot** now follow the three original lessons. The next planned foundation topic is seamless animation. A measured plot on a specific machine remains a separate validation step. Use the accepted templates for full-catalog production batches. The next broad content milestone is complete registry coverage with honest status labels, followed by verified visuals and deeper lessons in category batches. Publication uses the existing GitHub Pages workflow with Learn validation before deployment; local maintenance follows the shared gate in `docs/MUUSIA-AGENTS.md`.

Machine-profile phase 1 from `docs/MUUSIA-MACHINE-PROFILES-CLAUDE-HANDOFF.md` is implemented in the app as of v2.108. Machine Setup distinguishes G-code from External SVG, whose profile stores descriptive metadata and an optional work area without machine commands. External SVG disables G-code generation and directs users to their plotter's own software. This does not provide manufacturer calibration or implement the separate Inkscape-layer export proposal. Lesson 07's workflow instructions and captures need to reflect those controls; refreshed export provenance alone is not a screenshot refresh.

Publication maintenance: the application Help description omits fixed tutorial and guide counts, while Learn derives its counts from content. Reference-export provenance version 2 records explicit `path` / `selector` / `sha256` scopes for relevant export behavior, machine profiles and fixture dependencies. It no longer hashes the entire App or reverses a Help-copy replacement. Plain version changes and unrelated App edits do not invalidate the reference downloads. Actual tracked export/machine changes require a new UI export and updated provenance; a selector broken by refactoring requires a reviewed selector update and recapture. The former `reviewedChange` bypass is not supported for these records. `npm run check:learn` verifies the scoped sources as well as artifact bytes and geometry. See `learn/README.md` for the recovery procedure and capture status. A dedicated exporter module is an optional future change for the app/node owner, not a prerequisite for this repair.

Shared-file announcement for this repair: add the already installed `rolldown` 1.1.4 parser as an explicit development dependency for AST source selection. The existing `check:learn` command includes focused scope-regression tests; no new package script or deployment step is introduced. The shared catalog/build/Learn gate remains the release check.
