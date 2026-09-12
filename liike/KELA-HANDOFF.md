# KELA — HANDOFF

Current naming (2026-09-12): the app is **Liike**, the source directory is
`liike/`, the generated app is `public/liike/index.html`, and npm scripts use
`:liike`. The Pages address is `/Muusia/liike/`; the old `/Muusia/kela/` path
has no redirect. The original specification and dated history below retain
the former Kela name and paths as historical context.

Working title **Kela** ("reel"). A browser tool that turns a photograph of a
plotted Muusia **Frame Grid** sheet into an animation. Companion to Muusia
(authoring) and Latu (G-code); closes the loop: patch → plot → photograph →
animation.

Everything runs client-side in the browser (photos never leave the device),
so the whole flow works on a phone: plot, photograph, open the page, export
a GIF. Ships as a sub-app of the `plotter-patcher` repo, the Latu pattern:
own Vite project in `kela/`, built to `public/kela/index.html`, deployed on
GitHub Pages next to Muusia.

Conversation in Finnish; all code identifiers, GUI text and docs in English.

---

## 1. Input contract (authoritative — matches Muusia Frame Grid v2.77)

The sheet geometry is **computed from parameters, never guessed from the
image**. The user enters (or picks presets for) the same parameters the plot
was made with. Only the four corner markers are detected optically.

### 1.1 Canvas

- `W`, `H` — canvas size in mm (presets: A3 420×297 / 297×420, A4 297×210 /
  210×297; free entry allowed). All sheet-frame math is in mm, y **down**,
  origin at the sheet's top-left (same convention as Muusia).

### 1.2 Fiducial markers (photo_trace marker language, plotted)

Four hatch-filled squares:

- Centers at exactly `(20, 20)`, `(W−20, 20)`, `(W−20, H−20)`, `(20, H−20)`.
  The 20 mm inset is **fixed**, not a parameter.
- Side length = `markSize` mm (Frame Grid slider 8–15, default **15**).
- Fill: horizontal hatch lines at 0.6 mm pitch + square outline → in a photo
  a marker reads as a mid-dark square (NOT solid black). Blur before
  thresholding so it segments as one blob.
- **Top-left marker carries a white circular hole**, diameter `0.4 ×
  markSize`, centered — the orientation anchor. The other three are filled
  through.

The photo may be taken in any rotation (the test photo is a portrait shot of
a landscape sheet). The hole disambiguates all four rotations. A mirrored
image cannot happen with a normal photo: if the best marker assignment only
works mirrored, warn instead of silently flipping.

### 1.3 Cell layout (verbatim Frame Grid math)

Parameters: `layout` preset (`3×2·6`, `4×3·12`, `2×2·4`, `3×3·9`, `4×4·16`,
or custom `cols`/`rows` 1–6), `margin` mm (default 30), `gap` mm (default 8).

```
iw = W − 2·margin            ih = H − 2·margin
cw = (iw − (cols−1)·gap) / cols
ch = (ih − (rows−1)·gap) / rows
cell(c, r) = { x: margin + c·(cw+gap),  y: margin + r·(ch+gap),  w: cw, h: ch }
```

Cells are enumerated in **reading positions** row-major; the frame→cell
assignment follows the plot's `order` parameter: `Row-major` (default),
`Column-major`, or `Boustrophedon` (left→right on even rows, right→left on
odd). Expose the same select.

### 1.4 Frame window (what to crop)

Frame Grid maps the WHOLE canvas rectangle into every cell with **one shared
scale** (registration!):

```
s  = min(cw / W, ch / H)
window(c, r) = rect centered in cell(c, r), size (W·s) × (H·s)
```

That letterboxed window is the registered animation area — **crop the
window, not the cell**. Every frame's window has identical mm size and the
same canvas→window mapping, so the crops are pixel-registered by
construction. Offer `Crop: Frame window (default) / Full cell` plus a
`Pad %` (default 0) that grows the crop symmetrically.

### 1.5 Sheets and frame count

- `Total frames` and the layout give `framesPerSheet = cols·rows` and
  `sheets = ceil(total / framesPerSheet)`; the LAST sheet may be partially
  filled — only extract `total` frames.
- Multi-sheet: the user adds photos **in sheet order** (each sheet may carry
  a plotted `P n/N` tag bottom-right as a human aid; no OCR in MVP).

### 1.6 SVG sidecar (optional input)

The user can drop the sheet's Muusia SVG export next to the photos. A plain
export gives autofill: `W`/`H` from the viewBox and `markSize` from the four
outline squares at the 20 mm-inset corners. Once Muusia embeds a
`<metadata id="muusia-frame-grid">` JSON blob (layout, margin, gap,
markSize, order, total, fill — a small Muusia-side era patch, planned) the
SVG fills EVERY §1 parameter and the Sheet screen collapses to a
confirmation. The SVG is also the ground truth for the synthetic test (§5)
and, later, for template-match registration refinement (§7). It never
replaces the photo — the photo is the artwork.

### 1.7 Reference plot

`animtest.jpeg` (Daniel's first real plot): A4-class sheet, 4×3·12,
markers 15 mm, no cell frames, no numbers. Keep it in `kela/test/` as the
canonical real-world fixture.

---

## 2. Pipeline

### 2.1 Load

- Accept JPEG/PNG/WebP via file input and drag-drop; decode with
  `createImageBitmap` (honors EXIF orientation in modern browsers — verify,
  and if `imageOrientation: "from-image"` is needed, pass it). HEIC: not
  decodable in Chrome — detect and tell the user to export JPEG.
- Downscale a working copy to ≤ 2000 px long side for detection; keep the
  full-resolution bitmap for sampling.

### 2.2 Marker detection (hand-rolled, no OpenCV)

1. Grayscale the working copy; box-blur radius ≈ working-px equivalent of
   ~1.2 mm (estimate mm scale later; first pass: radius = longSide/600).
2. Adaptive threshold (mean of a large window minus offset) → binary.
3. Connected components; candidate = component whose bbox is roughly square
   (aspect 0.6–1.6 — perspective skews), fill ratio 0.5–0.95 (hatch +
   outline), area within a plausible band, and located in the outer ~30 % of
   the image. Take the 4 best spread candidates (maximize the quad area).
4. Subpixel center = intensity-weighted centroid on the blurred image.
5. Orientation: the marker whose center region is bright (hole) is TL.
   Order the remaining three so that TL→TR→BR→BL runs clockwise in image
   space (positive cross products).
6. **Manual fallback is mandatory UX**: show the photo with the four
   detected centers as draggable handles; the user can nudge or place them
   from scratch. Detection failure must never block the flow.

### 2.3 Homography

4-point DLT from mm corners `(20,20) … (20,H−20)` ↔ image centers (the same
math as photo_trace — reuse its conventions). `Hinv` maps mm → image px.
MVP is exact 4-point; a later milestone can refine with the marker square
edges.

### 2.4 Sampling

For each frame window, sample directly from the FULL-RES bitmap through
`Hinv` with bilinear interpolation into an output raster:

- Output size: user `Resolution` (long side px, default 1080; the window's
  aspect = canvas aspect).
- No intermediate whole-sheet rectification needed (cheaper, sharper), but a
  whole-sheet rectified preview at low dpi is useful for the review screen.

### 2.5 Auto white balance + global adjustments

Phone photos have colored, uneven light. Order of operations per photo:

1. **Paper flatten** (the important one): estimate the illumination field by
   heavily blurring the rectified sheet (or a coarse mm-grid of local
   bright-quantile samples away from ink), divide each channel by it,
   re-scale to the paper level. Toggle, default ON.
2. **Auto WB**: white-patch from paper — median RGB of known-blank mm areas
   (margins outside cells and away from markers); scale channels to neutral.
3. **Global adjustments** (sliders, applied to ALL frames of all sheets
   identically — per-frame edits would break the animation's consistency):
   black point, white point, gamma, saturation, and an optional `Ink
   threshold` posterize for a clean 2-tone look. Live preview.

Per-sheet WB/flatten is computed per photo (each photo has its own light),
but the slider adjustments are global.

### 2.6 Sequence

- Thumbnail strip/grid in current order, numbered.
- `Order`: `Original` / `Reverse` / `Ping-pong` (1..N..2, seamless loop) /
  `Random` (seeded — show the seed, re-roll button, deterministic) /
  `Manual` (drag to reorder; any drag switches mode to Manual).
- Exclude toggle per frame (skip a botched frame).
- Playback preview: fps slider (1–30, default 12), loop, play/pause,
  scrub. This preview is the export truth.

### 2.7 Export

- **GIF**: `gifenc` (tiny, fast). Options: fps, size, dither on/off,
  infinite loop.
- **H.264 MP4**: WebCodecs `VideoEncoder` (`avc1.42…`) + `mp4-muxer`.
  Options: fps, size (even dimensions!), quality/bitrate, `Loops` (bake N
  repeats into the file, default 4, since video players don't loop GIFs'
  way). If H.264 unsupported (Firefox), fall back to VP9/WebM via
  `webm-muxer` and label the button accordingly.
- **PNG frames ZIP** (cheap, useful for other tools): `fflate`.

Allowed deps: `gifenc`, `mp4-muxer` (+ `webm-muxer`), `fflate`. Everything
else hand-rolled. No server, no uploads, no OpenCV/ffmpeg-wasm.

---

## 3. UI flow (single-page wizard, phone-first)

1. **Sheet** — canvas preset + orientation, layout, margin/gap, markSize,
   order, total frames, number of sheets. "Muusia defaults" button (A3
   landscape, 4×3·12, margin 30, gap 8, mark 15, row-major).
2. **Photos** — add one photo per sheet, in order; thumbnails; retake.
3. **Register** — per photo: detected markers over the image, draggable
   handles, rectified preview with the cell grid + frame windows overlaid
   (the moment of truth — the user SEES whether windows sit on the drawings).
4. **Adjust** — flatten/WB toggles + global sliders, before/after preview.
5. **Sequence** — reorder, exclude, fps, live playback.
6. **Export** — GIF / MP4 / PNG ZIP with their options.

State persists in memory only (refresh = restart) for MVP; a `Save
project`/`Load project` JSON (settings + marker points, not photos) is M7.

---

## 4. Milestones

- **M0** repo scaffold: `kela/` Vite+React sub-app, build to
  `public/kela/`, hello-page deployed. Root `package.json` script
  `build:kela` mirroring Latu's.
- **M1** sheet-setup screen + the layout math module `layout.ts` with unit
  tests asserting the §1.3–1.4 formulas (cells, windows, all three orders,
  partial last sheet).
- **M2** photo load + manual 4-corner registration + DLT + rectified
  preview with grid overlay. Acceptance: with `animtest.jpeg` and manually
  placed corners, all 12 windows visibly land on the drawings.
- **M3** automatic marker detection + orientation from the TL hole +
  draggable refinement. Acceptance: `animtest.jpeg` auto-detects within
  ~1 mm of manual placement; synthetic test (§5) within 0.5 mm.
- **M4** frame sampling at full res; sequence screen with playback.
- **M5** flatten + auto WB + global sliders.
- **M6** exports: GIF, MP4 (H.264, WebM fallback), PNG ZIP.
- **M7** project save/load JSON; multi-sheet polish; Random-order seed UI.

Each milestone lands as its own commit with a one-line note in this file's
history section.

## 5. Test assets & validation

- `kela/test/animtest.jpeg` — the real plot (A4-class, 4×3·12).
- **Synthetic oracle**: a script renders the sheet geometry — preferably a
  real Muusia SVG export of the test patch, falling back to painted markers
  + numbered window rectangles — warps it with a known homography + noise +
  vignette, then runs detection end-to-end and asserts recovered marker
  centers < 0.5 mm and per-window content matches the expected frame. This is the regression test for the whole
  registration path — keep it in `kela/test/` and runnable with `node`.
- Layout math unit tests share expected values with Muusia's
  `tools/validate-frame_grid.mjs` oracle constants (margin 30, gap 8, A3:
  s = min(cw/420, ch/297) etc.).

## 6. Pitfalls (learned already — do not relearn)

- **Markers are hatched, not solid** — blur before threshold or components
  shatter into stripes.
- **EXIF orientation**: trust `createImageBitmap`, but verify on iPhone
  portrait shots; a sideways homography "works" and silently swaps
  cols/rows.
- The dashed cell rectangles visible in Muusia are **overlay-only, never
  plotted** — nothing but the markers (and optional cell frames / numbers /
  label / P-tag) exists on paper. Never depend on plotted cell frames.
- Crop the **frame window**, not the cell — cell aspect ≠ canvas aspect and
  full-cell crops de-register the animation.
- The last sheet may be partially filled; extract exactly `total` frames.
- mm frame is y-down; keep it y-down end to end (Muusia convention) and
  flip only at raster output if a lib needs it.
- Global color adjustments must be global — per-frame auto-anything makes
  the animation flicker. Per-PHOTO flatten/WB is fine (and needed).
- H.264 needs even pixel dimensions; round the output size.

## 7. Later ideas (out of MVP)

- P n/N tag OCR for automatic sheet ordering.
- Onion-skin preview; per-frame nudge (±px registration trim).
- Muusia-side era patch: embed the §1 parameters as
  `<metadata id="muusia-frame-grid">` JSON in the SVG export (supersedes any
  separate sidecar file); Kela reads it per §1.6.
- Template-match registration refinement against the SVG-rendered ink
  (sub-mm, per-frame verification).
- Boomerang/stutter sequence presets; frame interpolation experiments.
- APNG / WebP animation export.

## 8. Implementation history

- 2026-09-11 — M0 local foundation: created the React/Vite shell and root dev/build scripts using the Latu pattern; deployment and milestone commit remain pending.
- 2026-09-11 — M1 local implementation: added supplied JPEG/SVG fixtures, sheet controls, live window preview, strict TypeScript and layout/oracle tests; reference margin/gap/order await confirmation, deployment and milestone commit remain pending.
- 2026-09-11 — Reference settings confirmed from Daniel's screenshot: margin 30 mm, gap 8 mm, Row-major, Map canvas, 4×3 and 12 frames; saved screenshot and independent reference preset, removing the remaining M2 sheet-parameter uncertainty.
- 2026-09-11 — M2 local implementation: photo library, EXIF-aware decoding, manual draggable markers with fine controls, normalized four-point DLT and rectified grid/window preview; all 12 windows verified on animtest.jpeg, 15 tests pass; deployment and milestone commits remain pending.
- 2026-09-11 — M3 local implementation: worker-based automatic hatched-marker detection and TL-hole orientation, manual refinement and undo; production build finds all four animtest.jpeg markers within 0.81 mm of the approximate manual baseline, synthetic SVG oracle meets <0.5 mm with correct frame identity, all 25 tests pass; deployment and milestone commits remain pending.
- 2026-09-11 — M4 local implementation: full-resolution direct frame sampling in an inline worker, numbered thumbnails, playback/scrub/fps/loop, Original/Reverse/Ping-pong/Manual ordering and exclusions; reference JPEG yields twelve 1080×764 crops, multi-sheet partial extraction and cancellation/invalidation verified in the production browser, all 32 tests pass; deployment and milestone commits remain pending.
- 2026-09-11 — M5 local implementation: blank-paper illumination model and white balance per photo, shared levels/gamma/saturation/ink threshold, live Original/Adjusted preview and matching full-resolution sequence processing; reference photo and 390 px controls verified, synthetic lighting/cast/ink-preservation checks pass with all 38 tests; deployment and milestone commits remain pending.
- 2026-09-11 — M6 local implementation: worker-based global-palette GIF with optional dithering, WebCodecs H.264 MP4 with VP9 WebM fallback and repeat/quality controls, numbered PNG ZIP plus timing manifest; real-photo GIF/video/ZIP generation, MP4 playback, WebM duration, cancellation and 390 px layout verified, all 46 tests pass. Embedded-browser save-to-disk verification remains open; deployment and milestone commits remain pending.
- 2026-09-11 — Renamed the app to Liike at Daniel's request: visible name, page title, export filenames and manifest app name updated; repository directory, commands and URL path remain `kela`.
- 2026-09-11 — Reproduced reference-photo wobble before export despite correct SVG frame windows; added optional Sequence position stabilization using one isolated drawing's hull area center and translated direct-photo sampling, preserving size/rotation and all export paths; ambiguous crops stop extraction, all 49 tests pass. The exact physical source of the photo's residual distortion remains uncertain.
- 2026-09-11 — Daniel approved the initial GitHub release: M0–M6, the Liike name and optional position stabilization are bundled into one initial release commit, with the generated single-file app included in the existing Pages build at `/Muusia/kela/`. The milestones above describe local implementation stages, not separate Git commits; M7 remains future work.
- 2026-09-12 — Renamed the source and generated app directories to `liike`, updated npm scripts and current documentation, and moved the Pages address to `/Muusia/liike/` at Daniel's request. The old `kela` directory is removed with no redirect.
