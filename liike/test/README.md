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

Run `node --test liike/test/detection.test.mjs` from the repository root for
the synthetic detection oracle (also included in `npm run test:liike`).
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

### Manual registration access (2026-09-12)

The reported disabled Review markers button was caused by an extra photo,
not the detection result. `photos-ui.test.mjs` renders the real React screens
through Vite SSR to cover failed detection with two photos for one sheet,
incomplete photo sets, no photo/loading guards and the extra-photo registration
screen. The extraction regression confirms unregistered extras remain excluded
until frame count or photo order includes them. All 54 tests pass.

The production build was checked with two copies of `animtest.jpeg`, A4 and
an intentionally wrong 8 mm marker size to make both detections fail. Review
markers remains enabled; the second photo's Place markers manually button
opens that exact extra photo. All four centers can be placed and refined,
the extra-photo preview renders without out-of-range frame windows, and
positions survive switching photos. At 390 px both manual buttons remain
enabled without horizontal overflow. No browser errors or warnings appeared.

### Sharpen and Auto adjust (2026-09-12)

Five new regressions cover bounded whole-photo contrast estimates independent
of frame order/crop/count, light paper cleanup and retained mid-tone ink,
unsupported references and binary threshold output, sharpening against an
independent soft edge without displacement/overshoot, unchanged low-contrast
grain, and comparable physical edge width at preview/export resolutions.
The full suite has 59 passing tests. Existing paper-model isolation checks
still exclude artwork from illumination fitting; the separate automatic
contrast estimate intentionally reads ink across the complete sheet.

The production browser was checked with the original reference JPEG: both
options start off, Auto adjust includes the two paper controls, Sharpen starts
at 40%, strength/Original/Adjusted/frame selection and Reset work, and the
390 px layout has no horizontal overflow. Both enabled produce twelve
1080×764 frames and a playable 94 KB GIF. Changing Sharpen invalidates the old
frames and blocks their export until re-extraction. No browser errors or
warnings appeared. Export encoders continue to consume the processed PNG
crops, so the image treatment is shared by GIF, video and PNG ZIP.

A separate diagnostic on Daniel's supplied frame screenshot showed cleaner
paper and more distinct lines with Auto adjust and 40% Sharpen. This used the
cropped screenshot with an assumed physical size, not the original full-sheet
photograph; it does not establish the cause or removal of a distinct double
edge. No supplied image was changed or added as a published fixture.

SHA-256 (original bytes):

- `animtest.jpeg`: `90a3f095a5b758d967ecfabf5a790281256dcf3762fccd65536696bef4a9c1c2`
- `animtest.svg`: `f44b6b7ebc1a9511ccd09477b2e68cd96ad6cbabe10b46bcf1aa3e7d5160edac`

## Black paper — 2026-09-14

Daniel supplied `IMG_2609.jpeg` and confirmed A3 landscape, 4×3, margin
30 mm, gap 8 mm and 15 mm markers. This photo is labeled P 1/2; the check
uses the supplied first sheet only, with Total frames 12 and Frame window,
zero padding. The original remains outside the repository.

The standalone production build was checked with the original 4032×3024
JPEG in the Codex browser. With Paper color set to Black / dark before
import, all four bright green hatched markers were found automatically,
including the dark TL orientation hole. Adjust preserves green/yellow ink
on a dark background. Auto adjust plus Sharpen 40% produced twelve
1080×764 frames. A contact sheet of all twelve was also inspected from the
same processing functions. GIF generation and its actual encoded preview
were checked at 720×509 (12 frames, 1 second); MP4 generated and decoded as
720×510, 48 frames, 4 seconds; PNG ZIP generation completed with 12 frames.
These are generation/preview checks, not a new on-disk download check.

Switching paper color in Adjust replaced the paper model and cleared old
extracted frames. Reset adjustments retained Black / dark and disabled
white balance. The 390 px Adjust layout had no horizontal overflow. No
console warnings or errors were observed.

`dark-paper.test.mjs` adds 11 regression checks: colored bright markers at
0/90/180/270/35 degrees with an independent camera warp and <0.5 mm marker
error; missing/multiple holes and mirrored rejection; independently generated
additive glare and known green pigment; almost-black blank references;
consistent whole-sheet/crop corrections; preservation of source data;
black alpha/missing-pixel backgrounds; two-tone output with sharpening;
stabilization parity; unchanged physical layout and export paper metadata.
Together with existing white-paper checks, all 70 tests pass.

## Project save/load — 2026-09-14

Nine project tests cover original-byte preservation, duplicate photo names,
all saved controls, partial sheets and manual/excluded timeline identity after
runtime IDs change, empty/incomplete projects, stale-reference cleanup,
invalid types/versions/paths/geometry, corrupted/missing images, archive size
limits, cancellation and failure cleanup, immutable save snapshots and names.
All 79 tests pass, along with strict TypeScript/lint and both production builds.

The production browser test imported IMG_2609.jpeg twice as two test sheets
with Total frames 13 (not a claim to have received the actual second sheet).
The resulting 6.5 MB `.liike` file downloaded to disk. Both embedded originals
were verified byte-for-byte against the supplied JPEG. The downloaded file
was then opened after reloading the page to an empty session.

Both photos and all eight marker centers returned. Black / dark paper,
Auto adjust, Sharpen 41%, Gamma 1.05, 1080 px extraction, manual frame order
with source 3 moved before source 2, excluded source 2, speed 11 fps and loop
off were preserved. Extraction produced 13 source frames with 12 included
playback frames. Export restored Video/WebM, 720 px, Standard quality and
6 repeats. Loading a deliberately truncated project kept the existing photos,
name and controls intact and displayed an error. The 390 px viewport had no
horizontal overflow and the project controls remained usable. No console
warnings or errors were observed.

The project download/restore round trip is verified on disk. Earlier notes
about the initial M6 media-download test describe that earlier test only;
this verification does not independently repeat every media format download.
User photos and downloaded project files remain outside the repository.

## Close-up capture proof — 2026-09-15

`closeup-detection.test.mjs` exercises the experimental cell-outline and
external 3 mm ring detector. Fourteen tests cover light/dark paper, four
right-angle rotations plus 25°, perspective, noise, lighting gradients,
open rings, missing/ambiguous orientation, dense artwork, and clipped
neighboring cells. Recovered synthetic corners must be within 0.3 mm.
All 93 tests and strict TypeScript/lint pass.

The supplied IMG_2635.jpeg and IMG_2636.jpeg each produce one correctly
oriented quad, including after all four right-angle rotations. Rotating back
changes fitted corners by at most 0.73 working pixels. Both source images
are 3024 × 4032 after EXIF orientation. Direct full-resolution sampling
produced 2160 × 1888 PNGs using the same 1 mm inset from the 84 × 73.6667 mm
cell. The corresponding source widths are approximately 2654 and 2458 px.
Overlays and complete drawings were visually checked. These checks validate
two photos, not full-animation stability or broad camera compatibility.

At the proof stage, the prototype was not yet wired into the app UI or released.
The integrated mode is described below. The local
review images and processing notes are in ignored `wip/liike-closeups/`;
the original photos remain in Downloads. Frame-window cropping would clip
some upper strokes in these drawings, so the proof uses a fixed cell inset.
The future capture UI must keep the cell/window choice and plot clearance
separate from border trimming, and preserve a shared crop and scale.

## Individual frames integration — 2026-09-15

The capture tests cover cell-local geometry, independent clearance/trim,
shared crop and scale across different camera distances, one photo per frame,
photo order and extra photos, mode-switch registration guards, light/dark blank
paper references independent of artwork, and close-up PNG source metadata.
Project tests add v1 sheet migration, v2 frame identity/geometry restoration,
and the 24 × 12 MP photo budget. All 102 tests pass with strict TypeScript/lint.

The production browser imported the supplied IMG_2635.jpeg and IMG_2636.jpeg.
Both outlines and orientations were found. Clearing and re-detecting corners
restored registration. With A3/4×3/30 mm margin/8 mm gap, Full cell, 1 mm trim
and 3 mm clearance, extraction produced two 2160×1888 frames. The downloaded
PNG ZIP retained the complete drawings at those dimensions, in manually
reversed order, with 11 fps timing. The downloaded v2 project restored both
photos, eight corners, capture mode, crop geometry, Auto adjust, Sharpen 40%,
Gamma 1.05, 2160 px, stabilization off and manual order/loop-off settings.
Embedded original JPEGs matched the supplied files byte for byte. This is a
two-photo check, not evidence of full-animation stability on every camera.

The final build also restored the older v1 black-paper QA project and rebuilt
13 source frames with its 12 included playback frames. Switching to the other
capture mode hid incompatible registration points and disabled extraction;
switching back restored the original corners. GIF download was verified as
two 720×629 frames with 90 ms delays; MP4 creation/download completed at
720×630 with eight frames (four repeats). The desktop layout had no horizontal
overflow, and no console warnings or errors were observed. Both production
builds passed.

## Printed frame numbers — 2026-09-15

Regression coverage separates printed numbers from upload positions: an
unnumbered close-up does not claim to be frame 1; an explicitly assigned 5
survives sorting, manual/excluded playback and PNG metadata. Sorting validates
missing, duplicate and invalid numbers without mutating photos or geometry.
Version 3 project saves retain numbers; versions 1 and 2 migrate with numbers
unset. Partial assignments are valid work in progress. All 107 tests, strict
TypeScript/lint and both production builds pass.

In the production browser the earlier v2 close-up QA project opened with no
invented printed numbers. Assigning 5 to the first test photo changed the
registration overlay to 5 without changing its corners. Assigning 2 to the
second photo and sorting reversed their photo order while retaining labels.
The sequence and downloaded PNG ZIP reported sources 2, 5. The downloaded
v3 project preserved both original JPEGs byte-for-byte; after reload both
numbers and the frame-5 overlay returned. These numbers were assigned for
this regression test, not read from the photographed artwork. No console
warnings/errors or desktop horizontal overflow were observed.
