# KELA — HANDOFF

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

## 1. Input contract (authoritative — matches Muusia Frame Grid v2.78)

Two capture modes. **Mode B — per-frame close-up — is the MVP and the
default**: one photo per frame, the plotted cell frame rectangle is the
registration quad, a corner dot gives orientation. Mode A — whole-sheet with
the four filled corner markers — is an OPTIONAL later addition; the first
experiment does not plot the sheet markers at all (`Markers: Off`).

In both modes the sheet geometry is **computed from parameters, never
guessed from the image**; only the registration features are detected
optically, and manual 4-corner placement is always available as the
fallback.

### 1.1 Canvas

- `W`, `H` — canvas size in mm (presets: A3 420×297 / 297×420, A4 297×210 /
  210×297; free entry allowed). All sheet-frame math is in mm, y **down**,
  origin at the sheet's top-left (same convention as Muusia).

### 1.2 Sheet fiducial markers — Mode A only, optional

Four hatch-filled squares (plotted only when `Markers: On`; not used in
Mode B):

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

### 1.5 Per-frame close-up capture (Mode B — the MVP)

For resolution, every frame is photographed INDIVIDUALLY. The
sheet is then plotted with `Cell frames: On`, `Corner dots: On` and
`Clearance mm >= 3` (Frame Grid v2.78 close-up marks):

- The plotted **cell frame rectangle is the registration quad**: its mm size
  is exactly `cw x ch` from §1.3, so its four corners give the per-frame
  homography (image corners <-> `(0,0), (cw,0), (cw,ch), (0,ch)` mm).
- A **3 mm circle sits OUTSIDE the cell's top-left corner** — center exactly
  `(-2.5, -2.5)` mm from that corner, radius 1.5 mm — the rotation anchor:
  the rect corner nearest the dot is TL.
- `Clearance` guarantees an ink-free band of at least that many mm between
  the drawing and the frame line in EVERY cell (the shared canvas->cell
  scale shrinks by it: `s = min((cw-2c)/W, (ch-2c)/H)`), so rectangle
  detection never collides with artwork. The frame window (§1.4) uses this
  same clearance-aware `s`.

Mode B input: one photo per frame, added in frame order (photo order is the
frame order). Sheet-level corner markers are not needed and may be Off.
Detection: the largest 4-corner dark rectangle contour + a small dot blob
just outside one corner; manual 4-corner fallback applies here too.

### 1.6 Sheets and frame count

- `Total frames` and the layout give `framesPerSheet = cols·rows` and
  `sheets = ceil(total / framesPerSheet)`; the LAST sheet may be partially
  filled — only extract `total` frames.
- Multi-sheet: the user adds photos **in sheet order** (each sheet may carry
  a plotted `P n/N` tag bottom-right as a human aid; no OCR in MVP).

### 1.7 Test ground truth (not a runtime input)

Kela's input is the PHOTO, only. The sheet's Muusia SVG export lives in
`kela/test/` purely as ground truth for the synthetic oracle (§5): it is the
exact geometry the plotter drew, so rendering it and warping it with a known
homography exercises the whole registration path against production data.
The app itself never asks for or reads an SVG.

### 1.8 Reference plot

`animtest.jpeg` (the first real plot, WHOLE-SHEET) — the Mode A fixture,
kept in `kela/test/` together with its Muusia SVG export. Exact Frame Grid
parameters, read from the authoring patch:

```
fill:        Animate        total:   12
layout:      4×3 · 12       order:   Row-major
cellScale:   Map canvas
margin:      30 mm          gap:     8 mm
markers:     On             markSize: 15 mm
cellFrames:  Off            numbers: Off
label:       (empty)        markerPen: 0
canvas:      297 × 210 mm (A4 landscape — CONFIRM against the patch;
             every other value above is verified)
```

One sheet (12 frames ≤ 12 cells). This fixture exercises Mode A (M7).
The Mode B fixture — a set of per-frame phone close-ups of a v2.78 plot
(Cell frames On, Corner dots On, Clearance 3, Markers Off) — is shot when
M2 lands and drives the M2/M3 acceptance criteria.

---

## 2. Pipeline

### 2.1 Load

- Accept JPEG/PNG/WebP via file input and drag-drop; decode with
  `createImageBitmap` (honors EXIF orientation in modern browsers — verify,
  and if `imageOrientation: "from-image"` is needed, pass it). HEIC: not
  decodable in Chrome — detect and tell the user to export JPEG.
- Downscale a working copy to ≤ 2000 px long side for detection; keep the
  full-resolution bitmap for sampling.

### 2.2 Registration detection (hand-rolled, no OpenCV)

**Mode B (primary)** — per close-up photo:

1. Grayscale + blur + adaptive threshold as below.
2. Find the dominant rectangle: the largest 4-corner dark contour whose
   corner angles are near 90° after perspective allowance (the plotted cell
   frame). Subpixel corners from line-fit intersections of the four edges.
3. Find the orientation dot: a small dark blob just OUTSIDE the rectangle,
   nearest to one corner — that corner is TL. Expected geometry: dot center
   2.5 mm up-left of the corner, r 1.5 mm (use it to sanity-check scale).
4. Homography from the four rect corners ↔ `(0,0),(cw,0),(cw,ch),(0,ch)` mm.
5. Manual fallback: four draggable corner handles + a TL toggle. Acceptance
   for auto detection is a REAL PHONE PHOTO; manual placement must always
   rescue a failed detection.

**Mode A (optional, later)** — whole-sheet marker detection:

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

1. **Sheet** — capture mode `Per-frame close-up (B)` (default) /
   `Whole sheet (A)` (optional);
   canvas preset + orientation, layout, margin/gap, markSize (A) or
   clearance (B), order, total frames, number of sheets. "Muusia defaults"
   button (A3 landscape, 4×3·12, margin 30, gap 8, mark 15, row-major).
2. **Photos** — mode A: one photo per sheet, in order; mode B: one photo
   per FRAME, in order. Thumbnails; retake.
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
  tests asserting the §1.3–1.5 formulas (cells, windows incl. clearance,
  all three orders, partial last sheet).
- **M2** Mode B manual path: per-frame photo import (one photo per frame,
  photo order = frame order) + manual 4-corner placement + TL toggle + DLT
  + rectified frame-window preview. Acceptance: a phone close-up of the
  v2.78 test plot registers cleanly by hand.
- **M3** Mode B auto detection: rectangle quad + orientation dot +
  draggable refinement. Acceptance: the SAME phone close-up auto-detects
  within ~0.5 mm of the manual placement; synthetic test (§5) within
  0.3 mm; a failed detection falls back to M2's manual path without
  friction.
- **M4** frame sampling at full res; sequence screen with playback.
- **M5** flatten + auto WB + global sliders.
- **M6** exports: GIF, MP4 (H.264, WebM fallback), PNG ZIP.
- **M7** Mode A (optional): whole-sheet marker detection per §1.2/§2.2-A,
  multi-sheet flow; `animtest.jpeg` is its fixture.
- **M8** project save/load JSON; Random-order seed UI polish.

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
- Parameter hand-off from Muusia (a settings string or QR the user pastes /
  scans into the Sheet screen) — only if manual entry proves error-prone.
- Template-match registration refinement against SVG-rendered ink (sub-mm,
  per-frame verification).
- Boomerang/stutter sequence presets; frame interpolation experiments.
- APNG / WebP animation export.
