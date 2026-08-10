# Portrait — node manual

Portrait draws a photo the way a portraitist works. It has two engines that
can run together: a **feature engine** that turns a frozen face analysis into
lines (contours, hair flow, beard flow), and a **tonal engine** that shades by
residual rounds — drawing only where the image is still darker than the ink
already placed. The **Sketch nerve** slider is a structural switch between two
personalities: at 0 the node is a clean, precise renderer; above 0 it becomes
an obsessive sketcher in the Patrick Tresset tradition — ink piles onto the
feature lines, wandering worm-strokes escape from them, and large areas stay
white.

## Workflow

1. Choose image… (JPEG/PNG; EXIF is corrected, the photo is resized to
   1280 px and frozen into the node — it travels inside the patch).
2. Press **Analyze face** (needs an http origin, not file://; first run
   downloads ~92 MB of models once, then they are cached). The frozen
   analysis carries landmark chains, hair/glasses/skin/neck regions, a
   texture-detected beard, flow fields, and every face in the photo.
3. Select the node: the overlay shows the analysis as dashed guides —
   one glance tells whether it landed, before any ink.
4. Pick a mode, tune, plot. A new photo invalidates the old analysis;
   re-analyze after every image change.

Chain into **Travel Sort** before export — high-nerve drawings produce
thousands of short paths.

## Modes

| Mode | Needs analysis | What it does |
|---|---|---|
| Tonal | no | Pure residual shading, coarse-to-fine "squint" rounds. |
| Features+tonal | yes* | Feature lines + hair/beard flow first, tonal shading under them (feature ink is pre-deposited, shading avoids the lines). |
| Features only | yes* | The feature layer alone — contours, hair, beard. |
| One line | yes | The Picasso portrait: pruned chains of every face linked into ONE unbroken line, transitions arc over cheeks/forehead. Empty without an analysis. |
| Spiral | no | One Archimedean spiral, wave amplitude from darkness. |
| TSP | no | One line through a darkness-weighted dot cloud (Quality = 2-opt budget). |

*Degrades to pure Tonal bit-identically when the analysis is missing or
invalid.

## Parameters

**Rounds (1–8)** — tonal passes. Round = pen: with Pen assignment Cycle the
G-code pauses between rounds and you decide at the machine whether to
continue. The prefix invariant is locked: rounds=k is bit-identical to the
first k rounds of any larger setting. At nerve 0 more rounds = deeper, finer
shading. At nerve > 0 the packing gate tightens ×0.78 per round (floor 0.5),
so later rounds stack ink ever closer to the lines instead of spreading —
rounds becomes a piling knob.

**Detail (0–1)** — how fine the late rounds get: shorter minimum strokes,
faster blur-schedule decay, gradient-seeking weight.

**Pen width mm** — the simulated pen. Sets the ink one pass deposits and the
tonal grid resolution. Match it to the physical pen.

**Ink strength** — calibrates simulated darkness per pass. Plot a small hatch
swatch to set it. Counter-intuitive but important: LOW ink raises the piling
headroom — each stroke deposits less, so the over-ink guard allows many more
strokes in the same cells. Maximum pile-up wants ink ~0.5, not 3.

**Hatch mode** — Flow follows tonal contours, Cross-hatch rotates
45°→135°→90° per round, Mix alternates. Mostly visible at nerve 0; nerve
strokes choose their own courses.

**Gamma** — tone curve, and at nerve > 0 the main CONTRAST lever: the pile
floor is scaled by local darkness, so lower gamma deepens the knots in dark
areas while light areas keep single clean lines.

**White cutoff** — tones at or below this are hard white: no seeds, strokes
stop at the boundary (eye whites, catchlights, backgrounds). Raising it is
the second contrast lever — light surfaces drop out entirely.

**Focus X/Y/RX/RY % + Focus boost** — a manual attention ellipse (dashed in
the overlay). Inside it, tonal seeds are favored and strokes get shorter and
denser — higher resolution, never more ink than the tone allows. Put it on
the eyes. Affects the tonal engine only.

**Pen assignment** — Same / Cycle / Start+1. Feature lines take the node's
own Pen; tonal rounds continue on the following pens. Cycle + Split Pens
gives every round its own routable branch.

**Quality (1–8)** — attempt budget per round (and the TSP 2-opt budget).
High nerve piling wants high quality.

**Margin mm** — the image fit box. Feature geometry is generated in analysis
pixel space, so margin/paper changes are a pure affine remap.

**Seed** — at nerve > 0 the seed changes the whole handwriting: worm shapes,
fan angles, pile placement. Browse seeds like Paul draws a new sketch of the
same sitter each session.

**Line economy (0–1)** — prunes feature contours in importance order:
1 = every contour, 0 = just the eyes. The face oval splits into a
high-importance jaw arc and an early-dropping upper arc; the jaw is clipped
outside the beard mask.

**Glasses lines** — the parsed glasses region, behind its own switch (and
the economy gate at importance 0.7).

**Sketch nerve (0–1)** — the Tresset switch. 0 = clean drawing,
bit-identical to the pre-nerve node. Above 0, all at once:
- contours are re-stated up to 5× with per-pass drift; from the 3rd pass
  restates are PARTIAL fragments and closed loops break open,
- open contours overshoot their ends (flyaways, growing per pass),
- tonal seeds are gated to a tight zone around the feature lines
  (white space emerges) and split into two populations: ~88 % **piles** —
  5–21 mm scribbles along the contour whose seed weight has a tone-scaled
  floor, so dark hotspots re-seed and stack — and ~12 % **escapees**:
  worm-strokes on a frozen outward course with bounded meander, crossing
  existing ink over length-scaled bridges,
- hair and beard streamlines stray off the flow field, lanes break and cross.

## Presets

**Classic tonal print** — Mode Tonal · nerve 0 · rounds 4 · detail 0.6 ·
gamma 0.7 · cutoff 0.12 · quality 4 · Focus on the eyes, boost 2 · Cycle.
The precise multi-pen shading portrait; decide pen changes at the machine.

**Clean feature portrait** — Features+tonal · nerve 0 · rounds 2 ·
economy 0.85 · gamma 0.8 · Cycle. Contours + hair/beard flow with light
shading under them.

**Picasso** — One line · economy 0.6–0.85 · nerve 0–0.3. One unbroken line;
economy chooses how much of the face rides along. Works on group photos —
one line through every face.

**Tresset sketch** — Features+tonal · nerve 0.7 · rounds 3 · quality 5 ·
ink 0.8 · penW 0.4 · gamma 0.7 · cutoff 0.15 · economy 0.9 · Same.
The balanced obsessive sketch: piles on the features, a few escapees,
clear white.

**Tresset max pile** — Features+tonal · nerve 1 · rounds 6 · quality 8 ·
ink 0.5 · penW 0.3–0.35 · gamma 0.65 · cutoff 0.2 · detail 0.7 ·
economy 1 · Focus on the eyes, boost 2.5 · Same. Black knots on brows, eye
sockets and the beard edge, white cheeks, wild strays. Expect ~1–2 s compute,
the 118 k point budget as the ceiling, and Travel Sort as mandatory.

**One-line posters** — Spiral (detail sets pitch) or TSP (quality = tour
optimization). No analysis needed.

## Plotting notes

Ballpoint is the native pen for nerve work — piling literally drives the pen
over the same grooves repeatedly, which a ballpoint rewards with dark sheen
and a felt tip punishes with bleed. Calibrate Ink strength with a hatch
swatch on the actual paper; browse 3–4 seeds and pick the sketch you like;
the blur schedule and nerve sweet spot live on paper, not on screen
(screen previews tend to flatter nerve values ~0.2 higher than print).
