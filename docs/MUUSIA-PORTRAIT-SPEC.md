# Muusia — Portrait Mode Feature Spec (handoff)

Status: **design complete, not implemented.** Agreed with Daniel in a design chat
(August 2026). This document is self-contained; verify implementation details
against the current v2.x source (image-node conventions, inspector, export panel,
NODE-API) before coding. Intended home: `docs/MUUSIA-PORTRAIT-SPEC.md`.

## Motivation

Camera-photo portraits, drawn the way a human artist works: block in the big
masses first, then refine over several passes, adding detail where it matters
(eyes, mouth, hair) — with the number of rounds and the amount of detail as
user parameters. Feature lines (eyes, nose, mouth, ears, hair, glasses) come
from ML face analysis rather than pure halftoning, and a set of single-line
modes produces one-continuous-line portraits.

The plotter is *not* put in a camera feedback loop. Key insight from the design
discussion: a paper-watching camera is nearly useless with pens, because Muusia
already knows exactly what it drew — the digital residual (target darkness minus
simulated ink) is more accurate than any photograph of the paper, with zero
calibration, lighting or perspective problems. The human at the pen-change pause
**is** the paper camera: each round maps to a pen, the G-code pauses at pen
changes, and Daniel looks at the sheet and decides whether to continue. A real
closed camera loop only pays off with stochastic media (Brush Z, ink blow, wet
media) and is explicitly out of scope here — future X-Carve territory.

## Locked decisions

- **One monolithic Portrait node** (gen). The ink field must persist across
  rounds inside one compute; it cannot travel over a path-set wire. No node
  split.
- **Analysis line: MediaPipe Face Landmarker + BiSeNet-style face parsing**
  (CelebAMask classes). Photo→sketch generative models are a possible fourth
  analysis backend later, not now.
- **Image intake: file upload only** (photo taken on a phone, transferred,
  uploaded). JPEG/PNG only via `fileAccept`; HEIC fails with a clear message,
  no in-browser converter. A getUserMedia capture button is a parked roadmap
  idea (would be a definition-level `fileCamera` flag benefiting all
  `fileImage` nodes), not part of phase 1.
- **Intake processing:** EXIF orientation applied
  (`createImageBitmap(file, { imageOrientation: "from-image" })`), then resize
  long side to **1280 px** before anything is stored.
- **Stored per node (`node.data`):** grayscale array for compute (existing
  `{w, h, g}` convention) **plus** the re-encoded JPEG as a dataURL
  (`node.data.src`, ~200–400 kB) so Analyze can run/re-run any time and the
  patch is fully self-contained (photo + analysis + params in one file).
- **Analyze is a manual inspector button**, never automatic — model download is
  a network event the user should trigger. Result frozen to
  `node.data.analysis`; compute reads only frozen data. Determinism principle:
  seed freezes randomness, Analyze freezes the world.
- **Libraries and the parsing model load lazily from CDN at Analyze time** via
  dynamic `import()` of full URLs — **never** as npm deps, or
  vite-plugin-singlefile inlines megabytes into `dist/index.html` that every
  Muusia user pays for. URLs pinned to exact versions (commit-hash style, no
  "latest"), model URL + file hash recorded in `analysis.engine`, downloads
  cached via the Cache API (second analysis works offline). If a CDN link ever
  dies, the loader can grow a URL fallback list ending in `public/models/` —
  operational change only, schema untouched.
- **All analysis geometry stored in image pixel coordinates**; mm mapping
  happens in compute through the standard margin-box fit (same as image.js /
  Stipple). Changing margin or paper size never requires re-analysis.
- **Schema policy: additive changes forever** (same spirit as frozen node
  keys): never rename a field, never change a field's meaning; bump `v` and
  accept all old versions, because v1 data lives in patches forever.
- **Infra before lab:** phase A wires `src/analyze.js` + the inspector button
  into the engine (a lab node cannot add inspector UI); phase B is the Portrait
  lab node reading frozen data.

## Implementation phasing

1. **Phase 1 — tonal rounds.** Intake pipeline + Portrait node with
   residual-driven multi-round hatching. No ML. Immediate artistic value.
   Single-line modes 1 and 2 (Spiral, TSP) can ship here — they need no
   analysis.
2. **Phase 2 — analysis infra + feature lines.** `src/analyze.js`, lazy model
   loading, vectorization, schema v1, Analyze button, overlay guides, feature
   line rendering + Line economy.
3. **Phase 3 — single-line mode 3** (continuous feature line, "Picasso mode").

## Intake pipeline (one function, three classic traps)

1. Reject non-JPEG/PNG with a message naming the reason (HEIC trap).
2. Decode with EXIF orientation honored — a sideways portrait makes the
   landmark model fail silently or wrongly (existing image nodes likely skip
   this; landscape photos hid it).
3. Resize long side to 1280 px (enough for the 512 px parsing input, landmark
   input and A3 tonal work; keeps `node.data` and patches sane — a 48 Mpix
   grayscale array would be tens of MB).
4. Store grayscale `{w, h, g}` + JPEG dataURL `node.data.src`.

## Analysis infra (`src/analyze.js`)

Self-contained module in the DRO mould: exports the analyze function and a
button component; the App.jsx seam is minimal — inspector shows the button when
the node definition carries a new flag (e.g. `faceAnalysis: true`) and
`node.data.src` exists. Button states: idle → downloading models (%) →
analyzing → ✓ / error text. On success, write `node.data.analysis` and trigger
recompute.

**Post-push guard (v2.44 lesson):** add a sentinel grep to the release routine,
e.g. `grep -c "AnalyzeButton" src/App.jsx` must print the expected count — era
insurance against a wholesale App.jsx overwrite silently dropping the seam.

**Models:**

- MediaPipe Face Landmarker (`@mediapipe/tasks-vision` from CDN + `.task` file,
  ~3 MB, Apache-2.0). ~478 landmarks with ready-made named contour chains
  (lips outer/inner, eyes, irises, brows, nose, face oval) + head pose from the
  transform matrix. Does **not** cover hair, ears, glasses.
- Face parsing (BiSeNet-type ONNX, CelebAMask classes, ~13 MB) via
  onnxruntime-web. 512×512 class map with distinct hair / ears / glasses /
  skin / brows / lips classes — covers exactly what the landmarker lacks.

**Inference → vectorization (heavy work once, compute gets polylines):**

- Landmarks → named chains + pose (yaw/pitch/roll) + confidences.
- Class map → per class: marching squares (Trace Image kin) →
  Douglas-Peucker simplify (~1–2 px tol) → light smoothing. Holes included
  (hair around a part or the face is a ring, not a disc).
- Hair flow: structure tensor of the grayscale inside the hair mask on a
  sparse grid (~16 px cell) → angle + coherence per cell.
- All private, in-browser; the photo never leaves the machine.

## `node.data.analysis` schema v1

```
analysis
├ v: 1                      schema version
├ engine: { landmarker: "<ver>", parsing: "<url>", modelHash }
├ img: { w, h }             pixel-space reference (must match node.data.img)
├ face
│ ├ found: bool             false is a VALID analysis (compute degrades
│ │                         to tonal-only; no special state, no crash)
│ ├ confidence, pose: { yaw, pitch, roll }
│ └ chains: named polylines, each with per-chain confidence:
│    faceOval, browL/R, eyeL/R, irisL/R,
│    noseBridge, nostrils, lipsOuter, lipsInner
├ regions: per class { outline, holes[], area, confidence }:
│    hair, earL/R, glasses, skin, neck
├ hairFlow: { cell, w, h, ang[], coh[] }
└ warnings: ["strong yaw", "glasses low confidence", "multiple faces", ...]
```

- Confidence on every element — Line economy pruning and the glasses problem
  need it (uncertain chains drop first).
- One face in v1 (largest/most confident wins, warning if several); multi-face
  is a future additive `faces[]`.
- A structural schema validator is shared by `tools/validate-portrait.mjs`
  **and** the app itself: an imported patch may carry garbage in `analysis`,
  and compute must survive it.

## Portrait node — compute design

### Tonal rounds (phase 1)

Two scalar fields on a coarse grid (0.5–1 mm cell):

- **Target D(x,y):** image darkness, gamma + white cutoff, standard fit.
- **Ink I(x,y):** simulated darkness of strokes placed so far; every accepted
  stroke deposits pen-width ink into the grid **immediately** (greedy update).

**Residual R = max(0, D − I)**, with both fields blurred by the **same** kernel
before comparison — mismatched blur produces ringing and strokes hunting noise.

The blur amount is the round's "squint", scheduled coarse→fine:

1. **Block-in (round 1):** heavy blur (~5–8 mm) — only the big masses exist.
   Long strokes, sparse spacing.
2. **Modeling (middle rounds):** narrowing blur, cross-hatch second angle
   where residual stays dark. Medium strokes.
3. **Detail (last rounds):** little/no blur; weighting shifts from pure
   darkness to gradient: weight ≈ R × (1 + k·|∇D|). Eyes, nostrils, lip line
   are the image's strongest gradients and get short precise strokes with no
   ML at all. Detail rounds may switch strategy from hatching to edge tracing
   (marching squares on residual edges).

**Stroke placement:** seeded dart-throwing (Stipple spirit), candidates
weighted by residual; accepted seeds grow a stroke along a direction field.
Direction modes: **Flow** (perpendicular to blurred ∇D — follows tonal
contours like a portraitist hatching along form; step limit + fixed-angle
fallback where |∇D| drops below threshold, or flow wanders in flat regions)
and **Cross-hatch** (fixed angle per round: 45° → 135° → vertical). A stroke
grows while residual along the path exceeds a threshold and **hard-stops at
the white-cutoff boundary** — face-critical: if a stroke overruns even 1 mm
into the eye white / catchlight, the eye dies.

Greedy deposit self-regulates density: never place a stroke where
I ≥ D + tolerance (over-ink guard; protects paper across many rounds), and a
round ends early when residual drops below epsilon — later rounds then add
nothing.

**Prefix invariant (locked):** rounds=k output is bit-identical to the first k
rounds of rounds=N. Achieved by sequential rounds with per-round rng streams
(`mulberry32(seed + round·prime)`) and no look-ahead. This is what makes
**round = pen** work: one export, G-code pauses at every pen change, human
inspects and decides — the artist loop with zero new export machinery. Finer
tips can be swapped in for detail rounds. Paper never leaves the magnet jig.

**Focus ellipse:** draggable ellipse (X/Y/RX/RY + boost) multiplying detail
weight inside — the ML-free manual-attention answer to "eyes need special
treatment". Spatial params ship overlay guides per NODE-API rule.

**Ink calibration:** the model's "pen width × one pass = darkness X" never
matches a real pen; one **Ink strength** param calibrates it. A small test
swatch (Test Card spirit: hatch pitches 0.3–2 mm with the session's pen and
paper) finds the value in a minute. Without it: under-exposed or muddy.

### Feature lines (phase 2)

Raw landmark chains drawn 1:1 are geometrically right and artistically dead —
polygonal, uniformly weighted, everywhere. A real artist omits: half the jaw,
only the shadow-side nostril. Therefore:

- Chains smoothed to splines (Smooth machinery exists); **every feature
  carries an importance value**, and a **Line economy** param prunes lines in
  importance order — max = all contours, min = eyes + lip centerline + a
  couple of jaw arcs (the sparse look).
- **Hair is flow, not outline:** streamlines seeded inside the mask along the
  hairFlow field, density from darkness — the phase-1 flow-hatch machinery
  reused. Uniformly dark hair loses gradient → fallback to mask centerline
  direction.
- **Tonal layer optional underneath:** round 1 = feature lines, later rounds =
  residual hatching with the feature ink already deposited into I, so shading
  automatically avoids the lines.
- **Glasses are the weakest link:** parsing finds the region, but thin metal
  frames and lens reflections make the outline unreliable — expect the most
  cleanup (simplify + symmetrize) or a manual off-switch for the glasses
  layer.
- Landmarker assumes a fairly frontal head; profiles and strong rotation break
  chains — analysis reports confidence and pose warnings so the user knows
  before plotting.
- **Overlay:** when the node is selected, `overlay()` draws analysis chains
  and region outlines as dashed guides — one glance shows whether the
  analysis landed, before any ink.

### Single-line modes

1. **Spiral / scanline AM** — one spiral or serpentine whose wave amplitude
   (or frequency) modulates with darkness. No ML, Squiggle kin, classic
   one-line look. Phase 1 candidate.
2. **TSP art** — Stipple points (constant size, density from darkness) + a
   traveling-salesman tour: nearest-neighbor + seeded 2-opt budget
   (budget = Quality slider). One unbroken line that darkens by densifying.
   Deterministic. Phase 1 candidate. Validator gem: exactly one path visiting
   every point once.
3. **Continuous feature line ("Picasso mode")** — ML feature chains ordered
   and *linked* into one line: a small TSP over chain endpoints, transitions
   carried as light arcs through low-importance areas (cheek, forehead); the
   pen never lifts. Falls out of the feature pipeline; the linker is the only
   new piece. Phase 3.

Modes 1–2 work from the image alone; mode 3 requires analysis and degrades
cleanly (no `analysis` → EMPTY, like image nodes without an image).

### Parameter sketch (GUI English, non-binding)

file (Image) · Rounds (1–8) · Detail (0–1: scales blur-schedule endpoint,
per-round stroke budget, min stroke length) · Pen width mm · Ink strength ·
Hatch mode (Flow / Cross-hatch / Mix) · Mode (Tonal / Features+tonal /
Features only / Spiral / TSP / One line) · Line economy (0–1) · Focus X/Y/RX/RY
+ Focus boost · Pen assignment (Same / Cycle / Start+1 per round) · gamma ·
White cutoff · Quality · Margin mm · Seed · Pen.

## Performance notes

A4 at 0.5 mm cells ≈ 250k cells; per-stroke deposit is cheap; blur per round
and weighted candidate sampling need budgeting (Shade's scanline lessons
apply). Quality slider as in Stipple. Stroke placement order jumps around the
image — irrelevant, Travel Sort handles ordering; round layer boundaries must
be preserved.

## Validation (fixture-based, no ML, no network)

Repo carries **one real photo + its frozen analysis JSON** (fixtures folder);
the whole geometry pipeline (chains → splines → lines, masks → streamlines,
schema validator) is tested deterministically against it. The ML itself is
never validated — it is data preparation, not part of the graph. If a model
version ever changes and yields slightly different landmarks, **old patches do
not change**, because their data is frozen in the patch.

Checklist for `tools/validate-portrait.mjs`:

- Determinism: double run identical.
- **Prefix invariant:** rounds=2 paths bit-identical to first two rounds of
  rounds=5.
- Residual monotonically non-increasing per round.
- Over-ink guard: no stroke where local I ≥ saturation.
- Cutoff regions untouched: synthetic test image with a known white disc
  (eye-white test) — zero ink inside.
- Detail liveness: higher Detail → more/shorter strokes in the final round.
- Focus liveness: stroke density higher inside the ellipse when boost > 0.
- Flow mode: strokes locally ⊥ to ∇D within tolerance.
- TSP mode: exactly one path, every point visited once.
- One-line modes: path count == 1, pen never lifts (single open path).
- Schema validator rejects malformed `analysis` without crashing compute;
  `found:false` degrades to tonal.
- Fixture pipeline: feature chains map to mm through the fit box; margin
  change is a pure affine remap of output (no re-analysis dependency).

## Open questions (decide during implementation)

1. Exact CDN sources + pinned versions for `@mediapipe/tasks-vision`, the
   `.task` file, onnxruntime-web, and the parsing ONNX (prefer commit-hash
   URLs; record hash in `analysis.engine`).
2. Blur-schedule curve (linear vs geometric coarse→fine) and default kernel
   sizes — calibrate on real prints, not on screen.
3. Importance table for Line economy (which chains drop first) — tune by eye
   in the lab phase.
4. Whether feature lines occupy round 1 always, or get their own pen slot
   independent of the round counter.
5. Glasses layer: auto-include above a confidence threshold vs always manual
   checkbox.
