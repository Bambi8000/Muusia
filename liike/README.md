# Liike

A browser companion to Muusia: photograph a plotted Frame Grid and turn it
into an animation. The image pipeline runs entirely on the device.
The app is named Liike; its repository directory, build scripts and URL path
use `liike`.

GitHub Pages: [Open Liike](https://bambi8000.github.io/Muusia/liike/).

## Development

Use Node 22.18+ (or Node 24+) for the TypeScript tests.
From the repository root, run `npm ci`, then `npm run dev:liike`.
Run `npm run build:liike` to generate `public/liike/index.html`, following
Latu's single-file Vite build. Run the root `npm run build` afterwards to
include Liike in the Pages artifact at `dist/liike/index.html`.

## Status

The initial release implements M0–M6: a React/TypeScript sheet setup screen,
live geometry preview, A3/A4 and custom canvas sizes, all five grid presets,
custom grids, all three traversal orders, partial-sheet pagination, crop
selection and padding. The handoff defaults are A3 landscape and 4×3; the
Frame Grid node itself currently defaults to 3×2, so match the actual plot.

The reference-sheet button loads the confirmed test plot: A4 landscape,
4×3, 12 frames, margin 30 mm, gap 8 mm, 15 mm markers and Row-major order.
The supplied Frame Grid screenshot confirms Map canvas scaling. This preset
is independent of application defaults; extraction uses Frame window and no
padding.

Photos accepts JPEG/PNG/WebP files, including multiple photos in sheet order,
with replacement, removal and reordering. Loading a photo starts automatic
marker detection in a worker. The hole (white on light paper, dark on black paper) identifies the physical TL
marker and the sheet orientation. Register provides draggable refinement,
manual placement, zoom/pan, a magnifier, coordinate fields and pixel nudges.
The sheet is rectified with the photo_trace DLT
convention and bilinear sampling; cells and occupied frame windows overlay
the preview. Mirrored/crossed/degenerate assignments show actionable errors.

Sequence extracts full-resolution crops in a worker and provides playback,
scrubbing, frame exclusion and Original/Frame number/Reverse/Ping-pong/Manual ordering.
Adjust adds per-photo paper lighting correction and white balance, plus shared
tone controls with a live original/adjusted preview. The same processing is
applied to the full-resolution sequence. Export creates GIF, H.264 MP4 with
WebM fallback, and PNG ZIP files in a worker. Optional position stabilization
centers an isolated drawing without changing its size or rotation. Save/load
restores a complete local project, including the original photographs. Remaining
M7 work is multi-sheet polish and seeded Random order.
See [KELA-HANDOFF.md](./KELA-HANDOFF.md) for the supplied project specification.

## Individual frame photographs

Choose **Sheet → Capture mode → Individual frames** to photograph each
cell close up. The existing **Whole sheets** mode remains available.

1. In Muusia, enable **Cell frames**, **Corner dots** and **Frame numbers**. Each cell needs a
   complete rectangular outline and the 3 mm circle just outside its top-left
   corner (center 2.5 mm left and above the corner). Use **Clearance mm** of
   at least 3 mm to leave blank paper inside the outline. Liike detects the outline
   and orientation, then reads the printed 3 mm Muusia digit label at the bottom edge.
2. Match the original sheet size, grid, margin, gap and **Plot clearance** in
   Liike. These establish the physical cell size even though each photo shows
   only one cell. Select the appropriate light or dark paper color.
3. Photograph one complete cell per photo, keeping its outline and top-left
   circle and bottom number visible. Small parts of neighboring cells are fine.
   Upload order can differ from frame order. Check **Frame number on paper**
   in Photos, Register or Sequence. **Read number** reads that photo again
   without changing its corners; **Read missing numbers** fills only unset
   numbers. Unclear or clipped digits stay unset and can be entered manually.
   Photos’ **Order by frame number** sorts all loaded photos, including extras;
   it requires unique numbers on every photo.
   **Use these N frames** matches Total frames to the number of photos.
4. **Review corners** checks the detected outline and orientation. If detection
   is uncertain, **Place corners manually** always opens registration: place
   TL beside the circle, then TR, BR, BL at the frame-line intersections.
   Drag, magnify or nudge the points to refine them. **Rotate corner labels**
   corrects a cyclic orientation assignment.
5. The default crop is **Full cell**, with **Border trim 1 mm** to remove the
   outline, no padding and a **2160 px** long side. Every photo uses the same
   physical crop and scale. Plot clearance describes the drawing's blank
   border; Border trim controls the output crop. They are independent.
   **Frame window** follows the original canvas aspect and plot clearance;
   check the green crop outline carefully because it can cut drawings that
   extend beyond that window. Stabilize position starts off in this mode.
6. Adjust, build the sequence and export as usual. **Frame number** is the
   default close-up playback order. Sequence’s **Order by frame number**
   sorts the extracted frames immediately, without extracting again. Reverse
   and Ping-pong also follow numeric order. Missing or duplicate numbers block
   numeric playback/export until corrected or excluded. **Photo order** and
   **Manual** remain available; dragging switches to Manual. Auto paper correction
   samples the blank band inside the outline. Auto contrast uses shared limits
   across close-ups to avoid changing with each drawing's ink coverage.
   If the blank band is too narrow, correction is skipped with a visible
   explanation; shared tones and sharpening remain usable.

Each photo produces exactly one frame. The printed number stays with its photo
when reordered, replaced or saved. It does not change the crop or require
missing frames to be filled (a two-photo sequence may contain frames 2 and 5).
Unknown numbers remain unset when older projects are opened; use Read missing
numbers after checking the saved corners. Older close-up projects that used
Original order migrate to numeric order, while explicit Manual order is retained.
Capture mode, clearance, trim, corner positions, frame numbers and original photos are included in Save/Load. Switching modes
requires registration for the new geometry before extraction; sheet-marker
centers are never reused as frame corners. PNG export metadata identifies the
source photo and the assigned printed frame number (`sourceFrame` is null
when unset), rather than implying each close-up is a separate physical sheet.

Number recognition runs locally without external OCR downloads. It is tailored
to Muusia’s plotting font, not general handwriting; check the proposed numbers.
A photographed label can overlap the frame border. The reader isolates that
line and matches the remaining digit strokes.

The supplied IMG_2635.jpeg and IMG_2636.jpeg register automatically and retain
all strokes with the default Full cell crop. More pixels help preserve fine
lines, but output size cannot restore missing focus detail. Full animation
stability still depends on the photographed sequence and paper flatness.

## Save and load a project

The **Project name**, **Save project** and **Load project** controls are
available above every workflow step.

1. Give the project a name and choose **Save project**. Keep the downloaded
   `.liike` file. If the download does not start, use **Download project** in
   the status area. The file includes the original photos, sheet settings,
   photo order and marker positions, paper color, all adjustments, extraction
   resolution, stabilization, playback order/exclusions/speed/loop and export
   settings. You can save before all photos or markers are ready.
2. Choose **Load project** and select the saved file, including after closing
   or refreshing the page. All photos are decoded and checked before the
   current session is replaced. A failed or cancelled load leaves it intact.
   Save the current work before switching to another project.
3. Review the restored photos/markers, then choose **Build sequence** in
   Adjust or **Extract frames** in Sequence. Generated crops and finished
   GIF/video/PNG exports are rebuilt from the saved originals and settings.
   Save again after making edits; earlier files are independent snapshots.

This is a local file workflow. There is no upload, account, cloud storage or
implicit autosave. Refreshing still clears the in-memory session; Load project
restores a saved one. Original files are embedded byte-for-byte, without image
re-encoding. Projects currently allow up to 64 photos, 40 MB per photo,
255 MB of source files and 400 million decoded photo pixels in total.
Originals are decoded one photo at a time for extraction, rather than retaining
a full-resolution bitmap for every photo. Larger
projects show a request to use fewer or smaller sheet photos.

The `.liike` file is a ZIP container with a versioned `project.json` and
numbered files under `photos/`. The loader validates the schema, archive paths,
expanded sizes, unique identifiers, frame references, SHA-256 photo checksums
and decoded dimensions. New saves use version 4; the loader also migrates versions 1–3
without changing their geometry and rejects unsupported versions
without changing the session. New runtime photo identifiers prevent stale
crop reuse; saved sequence references are remapped consistently. No executable
content or remote image URLs are accepted. Save/load includes extra photos
and incomplete manual registrations; it does not silently rerun detection.

## Register a photograph

1. Match Sheet settings to the plot, or choose **Use reference sheet** for
   `animtest.jpeg`. Choose **Paper color → Black / dark** for bright ink on
   dark paper before adding the photo; **White / light** is the default.
2. Choose **Add photos**, select the JPEG, wait for detection, then choose
   **Review markers**. If detection fails, choose **Place markers manually**
   on the desired photo to open it directly. Missing or extra photos do not
   block registration of photos already loaded.
3. Check the detected centers. If detection needs help, tap the center of the
   marker with the hole (TL), then continue clockwise around the photo:
   TR, BR, BL. These labels refer to the physical sheet, not the photo's screen
   corners. In the reference photo TL is bottom-left.
4. Drag a handle to refine it. The magnifier, X/Y fields and nudge buttons
   help with precise positioning. Focused handles also accept arrow keys;
   Shift + arrow moves ten original-photo pixels. At 2×/3× zoom, enable
   **Pan view** to scroll the image on a touch device; disable it to place.
5. Check the straightened preview: the hole belongs at top-left and each
   drawing belongs inside its green window. Toggle guides for an unobstructed
   look. Select each photographed sheet to register multi-sheet sequences.

Register includes all loaded photos, including extras. Extra photos can be
registered in advance, but have no frame windows and are excluded from the
sequence until **Total frames** requires them or they are moved earlier in
Photos. The app keeps this distinction visible without blocking manual work.

Use **Detect markers** to try again after correcting sheet dimensions,
marker size or paper color. Failed or ambiguous detection preserves existing positions;
**Undo auto placement** restores the positions from before a successful rerun.
Manual edits cancel pending detection so a late result cannot replace them.
Missing or multiple holes, mirrored photos and near-square sheets can make
orientation uncertain; use the manual controls when automatic placement is
unavailable. Always review the straightened preview before continuing.

Photos and marker points stay in memory while you work. Changing steps or sheet
settings preserves them; replacing a photo clears that photo's points. Save a
project before refreshing, then use Load project to restore it. Full-resolution EXIF-oriented bitmaps are used for frame extraction;
the working raster is at most 2000 px on its long side and the rectified
preview is 900 px. No photos are transmitted and no dependencies were added
for image processing. HEIC files get a request to export as JPEG.

## Black paper and bright ink

Choose **Paper color → Black / dark** in Sheet or Adjust. This is one shared
setting for the sequence; it changes marker polarity, paper correction and
background padding without inverting the photograph's colors or its geometry.
The detector looks for bright hatched squares and a dark orientation hole.
If a photo was loaded in light-paper mode, open Register and choose
**Detect markers** again, or place the centers manually.

With dark paper, **Paper flatten** subtracts smooth RGB background glare to
bring the background close to black. **Auto adjust** additionally deepens
blacks and lifts bright ink using one bounded contrast range per photo.
Color contrast uses the brightest ink channel so colored pens are not treated
as white references. **Auto white balance** is unavailable on dark paper;
switching back to light paper restores its previous selection. Shared tone
sliders and **Sharpen** work in both modes. Leave **Ink threshold** off for
colored ink; when enabled it makes white ink on black, and a lower cutoff
retains dimmer strokes.

Switching paper color refreshes the paper estimate and invalidates extracted
frames. **Reset adjustments** keeps the chosen paper color. The same look
feeds the preview, sequence, GIF, video and PNG files. Optional stabilization
also detects bright drawings on dark paper. All photographs in a sequence
currently share one paper color.

## Adjust paper and tones

Choose **Adjust paper & tones** after registration, or open **Adjust**.
Select the photographed sheet and a source frame or Whole sheet. Switch
between **Original** and **Adjusted** to compare; on phones the preview stays
visible above the controls while scrolling.

For **White / light** paper:

- **Auto adjust**, off by default, combines paper flattening, white balance
  and automatic contrast. It estimates one black/white range for each entire
  photograph, using ink across all cells and the blank paper references.
  It lightens paper residue and strengthens ink without adjusting frames
  separately. While enabled, it includes Paper flatten and Auto white balance;
  turning it off restores their earlier selections. Shared tone sliders still
  work after the automatic correction. Compare faint strokes with Original.
- **Paper flatten**, on by default, estimates smooth illumination across the
  sheet, evens it out and lifts paper brightness. It retains the paper's cast
  when white balance is off.
- **Auto white balance**, also on by default, neutralizes the paper reference.
  With flattening on, the reference paper is brought near RGB 245; with
  flattening off, white balance preserves the brightest reference channel.
- **Black point**, **White point**, **Gamma** and **Saturation** apply equally
  to every frame on every sheet. Defaults are 0, 255, 1 and 100%. Higher gamma
  brightens midtones; lower gamma darkens them.
- **Sharpen**, off by default, defines soft edges with adjustable strength
  from 0–100% (40% when first enabled). It works on brightness, leaves
  low-contrast paper grain alone and limits new light/dark halos. Its radius
  follows sheet millimeters, with pixel limits for small/large outputs.
  No frame is shifted or blended with another frame.
- **Ink threshold** makes a two-tone black/white result after the other tone
  operations. It is off by default. Raising **Ink cutoff** retains lighter
  strokes; compare with Original to check fine lines.

The paper model uses a 540 px rectified working image. It samples blank
margins and gaps outside full cells, excluding marker squares and sheet
edges. Bright quantiles for light paper and dark quantiles for black paper
in local tiles suppress small marks; a quadratic RGB
surface models smooth lighting. Artwork inside cells never determines the
paper lighting estimate; Auto adjust analyzes it separately for contrast.
The model is independent of frame selection, crop, order, output size
and global sliders, so each photographed sheet has one consistent correction.
Preview and extraction estimate it from the same working pixels. The live
crop preview has a 1080 px long side sampled from the original photo, as are
final crops.

If too little blank paper is available, the app reports that automatic
correction was skipped for that sheet; manual tones and sharpening still apply.
This smooth model does not reconstruct clipped highlights or sharp shadows.
Auto adjust can remove faint paper residue, but may also lighten intentional
pale strokes. Sharpen improves mild softness; neither option reconstructs
missing focus detail or reliably removes a distinct photographed double line.
Both options use the same processing in the preview and extracted frames,
which supply GIF, video and PNG exports. Ink threshold runs last, preserving
strictly black/white output. Changing either option invalidates old crops;
choose **Build sequence** or **Extract frames** to render the latest settings.
**Reset adjustments** restores defaults. Original photos are never modified.
**Build sequence** renders the current look, keeping completed frames when
their inputs have not changed.

## Extract and play

1. After reviewing the markers and tones, choose **Build sequence** in Adjust,
   or open **Sequence**.
   All required photos must have valid marker positions. A missing or invalid
   sheet is identified before extraction starts.
2. Choose **Resolution · long side** (480, 720, 1080 or 2160 px; default 1080 for sheets, 2160 for individual frames),
   then **Extract frames**. Every frame is bilinearly sampled directly from
   the original EXIF-oriented bitmap through its sheet transform, then receives
   the chosen paper and tone adjustments. Frame-window
   crops keep the canvas aspect; Full cell uses the cell aspect. Padding keeps
   the same center and aspect. Samples beyond the photograph use the selected paper background (white or black).
3. Use **Play**, **Pause**, the position slider or previous/next buttons. Speed
   ranges from 1–30 fps, default 12. With Loop off, playback stops after holding
   the last frame for its full interval. Hidden tabs pause playback.
4. Choose Original, Reverse or Ping-pong; the latter follows 1…N…2 without
   repeating endpoints. Excluded drawings are removed before building this
   timeline. Drag thumbnails to reorder, or use the arrow buttons on a phone
   or keyboard; either action selects Manual. Source numbers continue to refer
   to the original plot. **Include all** restores skipped drawings.

Extraction processes one full-resolution photo at a time and keeps lossless
PNG crops plus small JPEG thumbnails in memory. It includes exactly the total
frame count, across photos in sheet order, and skips empty final-sheet cells
and surplus photos. Cancelling or failing extraction discards the partial
result. Changing photos, marker positions, sheet/crop settings, adjustments or resolution
cancels pending work and clears old crops; extract again to update playback.
Changing workflow steps alone retains completed crops and sequence settings.
The worker is embedded in the single-file build; no image-processing package
or network service is required.

## Stabilize a spinning drawing

A four-marker perspective correction aligns the sheet as a plane. In the
reference photograph, the individual drawings still drift within their fixed
windows; matching the corner markers and checking that each drawing fits was
not sufficient to verify smooth rotation. The reference SVG itself advances
by approximately 30 degrees per frame about a shared pivot. The exact cause of
the photo's residual displacement (paper shape, lens or plotting) has not been
isolated.

In **Sequence**, enable **Stabilize position**, then **Extract frames**. This
optional correction centers one isolated drawing in each frame while keeping
crop size and rotation. It is off by default so plotted travel is preserved.
Use it for a single object spinning or changing shape in place. All thumbnails,
playback and file exports use the same corrected crops. Adjust and Register
continue to show the unshifted sheet geometry. Turning stabilization on/off
invalidates old extracted frames; the latest look is rebuilt from the photo.

The worker measures a 480 px crop before tone adjustments, uses local contrast
to separate ink from paper, joins small pen gaps and locates the area center
of the drawing's convex hull. An axis-aligned bounding-box center is avoided
because its extrema move as an asymmetric shape rotates. The final sampling
rectangle shifts in sheet millimeters; the original full-resolution photo is
sampled directly, with no per-frame scaling, rotation or intermediate image
translation. Position estimation is independent of output resolution and
sequence order. All sheets use the same normalized output center.

Blank, ambiguous, edge-clipped or excessively offset drawings stop extraction
with their source-frame number, rather than mixing centered and uncentered
frames. Turn stabilization off to preserve the complete plotted composition.
This centers the drawing as a whole; it does not reconstruct a specific pivot,
lens distortion or changing shape/scale caused by a curved photograph.

## Export a file

1. Build your frames in **Sequence**, then choose **Export animation**.
2. Choose Animated GIF, Video or PNG frames · ZIP. **Export size** retains
   the extracted resolution by default, or reduces it without upscaling.
   **Speed** shares the Sequence setting (1–30 fps). Every format follows
   the included timeline, including manual order and the ping-pong return.
3. Choose **Create**, wait for the progress indicator, then **Download**.
   GIF and video show the actual encoded file as a preview. Download before
   leaving Export; changing settings, navigating away or refreshing releases
   the previous output. **Cancel export** releases the running worker and
   permits a fresh attempt. Original photos and extracted frames are retained.

**GIF:** uses a single palette of up to 256 colors sampled across all included
unique drawings. Optional serpentine Floyd–Steinberg dithering softens color
steps. **Loop forever** shares the Sequence loop setting; off produces one
pass. Delays use cumulative hundredths-of-a-second rounding, keeping timing
error below 5 ms instead of accumulating an error at speeds such as 12 fps.

**Video:** probes WebCodecs in the export worker. Automatic mode prefers
H.264 MP4, then VP9 WebM; an MP4 encoding failure also retries as WebM when
available. WebM can be selected explicitly. If neither codec works, try a
smaller size or GIF/PNG. Quality controls bitrate. **Repeats** (1–20, default
4) determines the file length independently of the playback loop toggle.
Video is silent. Odd dimensions get a one-pixel edge matching the paper color so the image is
not stretched or clipped. WebM metadata includes the final frame's interval.

**PNG ZIP:** contains one timeline cycle as `frames/frame-000001.png`, etc.,
plus `sequence.json` with fps, dimensions, duration and each frame's source
sheet/frame, paper color and microsecond timing. Full-size PNGs retain their extracted
bytes; smaller sizes are resampled once. PNG files are stored without an
extra compression pass since PNG is already compressed.

The embedded worker uses `gifenc`, `mp4-muxer`, `webm-muxer` and `fflate`, the
handoff's allowed export dependencies. Decoding is sequential; memory retains
encoded frames/output, not a decoded full reel. No server, uploads or external
encoder downloads are used. The two muxer packages are upstream-deprecated;
they are retained here for the specified MVP scope. See `test/README.md` for
browser checks and the outstanding on-disk download verification.

## Verification

- `npm run check:liike`: strict TypeScript checking and the repository linter.
- `npm run test:liike`: layout oracles, parity with Muusia's actual Frame Grid
  node across paper sizes/layouts/orders, partial sheets, crop/padding,
  marker positions, invalid geometry and reference SVG compatibility. Also
  exercises perspective recovery, all four rotations, inverse mapping,
  degenerate/mirrored assignments, pixel-center/bilinear sampling, working-copy
  scaling and a synthetic rotated photo across all twelve frame windows.
  Detection tests rasterize the actual reference SVG, then apply an independent
  camera transform, rotations, perspective, noise and uneven lighting. They
  require every recovered marker to be within 0.5 mm and every extracted
  window to match its own SVG drawing. They also cover smaller markers,
  distractors and safe rejection of ambiguous or incompatible photos.
  Frame/sequence tests check multi-sheet crop sampling in all three traversal
  orders, partial final sheets, full-resolution pixel detail, crop aspect and
  padding, incomplete registrations, exclusions, manual moves, ping-pong
  endpoints and elapsed-time playback. Adjustment tests cover independently
  generated lighting/casts, ink preservation, exclusion of artwork from the
  paper estimate, consistent color across photos, control defaults and limits,
  unsupported references and matching crop/full-sheet processing. The suite
  currently has 79 tests, including bounded automatic contrast, light-residue
  cleanup, sharpening against an independent soft-edge target, noise/halo
  limits, consistent physical radius, and manual registration access after failed
  detection with missing/extra photos, plus export timelines, timing, palettes, GIF
  structure, video capability fallback, ZIP contents and final-frame duration.
  Dark-paper tests cover rotated colored markers, a dark orientation hole,
  additive glare, ink colors, almost-black references, shared crop tones,
  alpha/background handling, threshold, stabilization and export metadata.
  Project tests cover byte-for-byte image round trips, all settings, partial
  sheets, manual/excluded frame identity, unfinished registrations, corrupted
  or oversized archives, unsupported versions, staged-photo cleanup on failure
  or cancellation, immutable snapshots and portable filenames.
- `npm run build:liike`: standalone single-file build.

Layout rectangles use sheet mm, origin top-left, y down. Cell indices always
refer to reading positions; `frameToCell` applies the chosen traversal.
`framesOnSheet` returns only occupied frames, with zero-based global frame
indices. Frame windows use the shared canvas scale. Pad % expands the crop
by that percentage of its width/height on each side (10% → 1.2× dimensions).
Cells <= 1 mm are rejected because Muusia emits no cells at that size.

## Reference assets

The original JPEG, SVG and settings screenshot are in `test/`, copied
byte-for-byte from the user-supplied files. They are fixtures only and are not
bundled into the app.
See [test/README.md](./test/README.md) for confirmed values and validation results.
