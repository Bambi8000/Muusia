# Reference plot

Supplied by Daniel on 2026-09-11. Original files are preserved unchanged.

| Property | Evidence |
| --- | --- |
| Canvas 297 × 210 mm (A4 landscape) | SVG width, height and viewBox |
| Marker side 15 mm | Four SVG square outlines |
| Marker centers (20,20), (277,20), (277,190), (20,190) | SVG outline coordinates |
| Top-left hole diameter 6 mm | SVG circle polyline, radius 3 mm |
| Twelve frames, four columns × three rows | SVG artwork and settings screenshot |
| Fill Animate, order Row-major, cell scale Map canvas | Settings screenshot |
| Margin 30 mm, gap 8 mm | Settings screenshot |
| Markers On, marker size 15 mm | Settings screenshot |
| Cell frames Off, frame numbers Off, empty label, black marker pen | Settings screenshot |
| No Frame Grid metadata | No `muusia-frame-grid` metadata element in SVG |

In the displayed portrait photograph the hole marker is at the bottom-left.
The photo's top-left must not be assumed to be the sheet's top-left.

`reference-settings.png` is Daniel's screenshot of the original Frame Grid
settings, supplied on 2026-09-11. It confirms margin 30 mm, gap 8 mm,
Row-major order and Map canvas scaling. All original sheet parameters needed
for M2 are now confirmed. The twelve SVG drawings fit these frame windows.
The app and fixture test share the explicit `src/reference-settings.ts`
preset, independent of application defaults. Frame-window cropping and zero
padding are Liike extraction choices, not parameters from the screenshot.

SVG path order is not animation order: export path optimization can reorder
strokes. Do not infer frame order from the sequence of SVG paths.

M2 verified in the Codex browser on 2026-09-11: `createImageBitmap` with
`imageOrientation: 'from-image'` decodes the original JPEG to 3024 × 4032,
matching the displayed portrait orientation. The four centers were placed
manually, and the resulting A4 landscape preview puts the hole at top-left
and all twelve drawings inside their respective frame windows. Dragging,
coordinate editing, pixel nudges, invalid assignments and state retention
between steps were checked in the browser. The 390 px viewport has no
horizontal page overflow.

`reference-registration.json` records those manual centers in original,
EXIF-oriented image pixels. They are an approximate comparison baseline for
M3, not a claim of subpixel accuracy. This fixture is not loaded automatically
by the app. The runtime never guesses reference-photo marker positions.

M3 verified on 2026-09-11 in the standalone production build: uploading the
original JPEG automatically finds all four markers and places the hole at
the sheet's top-left. All twelve drawings remain inside their frame windows.
`reference-auto-registration.json` records the resulting original-image
coordinates and comparison with the manual baseline. The largest difference
is approximately 0.81 mm; this is agreement with approximate manual placement,
not a measurement of absolute real-photo accuracy. Neither registration
fixture is used as runtime input.

Browser checks also cover rerunning detection, undoing successful placement,
preserving manual positions after a failed attempt with incompatible marker
settings, and a 390 px viewport without horizontal overflow.

Run `node --test kela/test/detection.test.mjs` from the repository root for
the synthetic detection oracle (also included in `npm run test:kela`).
`synthetic-photo.mjs` rasterizes the real Muusia SVG, including its hatched
markers and twelve drawings, and applies a separately implemented camera
transform. The tests cover 0°, 90°, 180°, 270° and 35° rotations, perspective,
seeded noise, uneven lighting, vignette, dark distractors and 8 mm markers.
Every accepted marker must be within 0.5 mm of its known position; every
recovered frame must match its own drawing more closely than the other eleven.
Mirrored photos, missing/multiple holes, blank input and incompatible marker
size must not produce accepted positions.

M4 verified on 2026-09-11 in the standalone production build: the original
JPEG produces twelve 1080 × 764 PNG frames from its full-resolution bitmap.
All twelve crops visibly contain the expected drawing. Browser checks cover
play/pause, last-frame stop with looping off, reverse and ping-pong order,
exclusion, manual arrow moves and drag reordering. A two-photo check using
the same fixture twice and `total = 13` produces twelve frames from sheet 1
and only the first from sheet 2. Missing photos disable extraction with a
specific message. Cancellation discards partial frames; changing resolution
or marker positions clears stale crops; extraction succeeds again afterwards.
The Sequence layout fits 390 px without horizontal overflow. No browser
console warnings or errors were observed in these checks.

`frames.test.mjs` verifies crop sampling with independent spatial ramps across
both sheets and all traversal orders, as well as source pixel detail, crop
aspect/padding and incomplete registration rejection. `sequence.test.mjs`
checks exclusions, endpoint-free ping-pong, manual moves with replaced frames,
and elapsed-time playback boundaries.

M5 verified on 2026-09-11 in the standalone production build: Adjust previews
the reference JPEG with brighter, neutral paper while retaining the plotted
stroke. Original/Adjusted comparison, whole-sheet and per-frame selection,
tone controls, reset and Ink threshold were checked. A cutoff of 206 was
used to verify visibly black/white rendering across the full-resolution
sequence. The twelve output frames retain their 1080 × 764 dimensions.
Changing adjustments clears the old sequence; Build sequence renders the
new settings. At 390 px, the preview stays visible while adjusting Gamma,
and the page has no horizontal overflow.

`adjustments.test.mjs` applies independent smooth illumination and color casts
to the real SVG artwork. With default correction, sampled blank corners
across all twelve frames have a brightness spread below 5 levels (versus
over 40 before correction), near RGB 245, while every drawing retains dark
ink. Further tests cover different photo casts with common global settings,
dense artwork excluded from the reference estimate, neutral control defaults,
levels/gamma/saturation/threshold behavior, unsupported blank references,
unchanged source pixels and exact agreement at shared crop/sheet sample
positions. These synthetic bounds are regression checks, not an absolute
accuracy claim for arbitrary photographs. The full suite has 38 passing tests.

M6 verified on 2026-09-11 in the standalone production build: the reference
photo produces a 12-frame 1080 × 764 GIF (about 1.8 MB) and a PNG ZIP (about
11.9 MB). Native playback of the generated H.264 MP4 reports 1080 × 764 and
exactly 4 seconds, reaches the end normally, and contains the configured four
repeats (48 frames). Explicit VP9 WebM export also loads with those dimensions
and a 4-second duration. A 480 × 340 dithered GIF renders successfully.
Changing formats clears old output; cancelling a GIF and creating another
works. Export controls, preview and download link fit 390 px without horizontal
overflow. No browser warnings or errors were observed.

**Outstanding browser check:** download links were exercised, but the embedded
browser did not expose a download event or an on-disk file. Its asset inventory
also omits blob media. A separate native Chrome attempt was blocked by file
picker automation; its temporary tab was closed and the existing user tab was
preserved. Actual save-to-disk verification in a normal browser is still open.
Do not count a generated blob/preview as a verified file download.

`export.test.mjs` adds eight checks for excluded/manual/reverse/ping-pong
ordering, video-only repeats, proportional sizing and even padding, cumulative
GIF/video timing at every fps, injected H.264/VP9 support outcomes, a real GIF's
global palette/frame blocks/delays/loop extension, dithering without source
mutation, ZIP bytes/names/timing manifest, and WebM's final-frame duration.
GIF structure is parsed independently of the encoder. The ZIP round trip
checks bytes and source identity. The WebM regression builds an actual muxer
container with synthetic packets and verifies that only its duration field
changes; browser playback separately verifies real encoded video.
The full suite has 46 passing tests.

Stabilization follow-up on 2026-09-11: a fixed-grid extraction of the reference
JPEG reproduces position drift before any export. Independent polyline fits to
the supplied SVG show approximately 30-degree steps (largest deviation below
0.02 degrees) and near-identical rotated shapes. Matching frame identity in the
existing tests did not assert stable position in the real photograph.
The physical cause of the residual real-photo distortion remains uncertain.

An optional **Stabilize position** setting now shifts each crop around one
isolated drawing's area center. Size, rotation, sequence order and the original
photo sampling path are retained. The production browser successfully extracts
all twelve original-photo frames with this option at 1080 × 764. A diagnostic
with the EXIF-oriented 1500 × 2000 working copy reduces the measured vertical
center range from about 9% of frame height to under 0.2% (same estimator before
and after; this is a consistency check, not independent physical accuracy).

`stabilization.test.mjs` adds three independent checks: a rotating scalene
triangle whose true area center is known analytically, under translation,
lighting gradients, color cast, noise and small pen gaps; direct translated
sampling with preserved dimensions and pixel detail; and rejection of blank,
multiple, edge-clipped or unsafe crops. All 49 tests pass.

SHA-256 (original bytes):

- `animtest.jpeg`: `90a3f095a5b758d967ecfabf5a790281256dcf3762fccd65536696bef4a9c1c2`
- `animtest.svg`: `f44b6b7ebc1a9511ccd09477b2e68cd96ad6cbabe10b46bcf1aa3e7d5160edac`
