# MUUSIA v1.2 — Node Reference

All 91 built-in nodes. Conventions used below: most generators accept a **Style**
input (wire a Stroke node to get dashes etc.) and have **Margin**, **Seed** and
**Pen** parameters; those are not repeated in every entry. All numeric parameters
accept value wires. *(mm)* means millimetres on the canvas.

---

## Generators (46)

**Image** — raster import (PNG/JPG, downsampled to grayscale). Render modes:
*Scanline wave* (darkness raises amplitude and frequency of horizontal waves),
*Halftone dots*, *Hatch levels* (four cross-hatch passes gated by darkness), and
*Flow shade* (noise streamlines seeded and lengthened by darkness). Gamma, invert,
white cutoff.

**Growth** — differential growth: a loop that grows (random edge splits + long-edge
splits) while short-range repulsion keeps it self-avoiding and cohesion keeps it
smooth — the organic meander classic. Circle or canvas bounds (guide overlay),
optional history rings every N iterations for the nested look. Point-capped.

**Creature** — bilaterally symmetric arthropods along a curving spine.
*Trilobite*: three-lobed carapace (cephalon/thorax/pygidium), axial furrows and
ring, glabella with eyes, backswept pleural ribs per segment, fused pygidial arcs.
*Shrimp*: arching body with overlapping abdominal armor plates that bulge rearward,
rostrum spike with serrations, five pereiopod pairs (front two with tiny claws),
pleopods, telson-and-uropod tail fan, and a pair of very long whip antennae.
Curl arches the body, Legs/Antennae toggle, Orientation rotates the whole animal.

**Scan** — medical & scientific imaging aesthetics, drawn as procedural specimens:
*X-ray* (ribcage: vertebra stack, double-line rib arcs, clavicles), *CT slice*
(skin/fat rings, organ blobs — one hatch-filled, vertebra with beam star, R/L
markers), *MRI head* (the iconic sagittal: face profile, skull, gyri meanders
inside the brain ellipse, cerebellum folds, brainstem), *Ultrasound* (sector beam,
noise-gated echo arcs = speckle, echogenic mass, depth ticks), *Microscope cells*
(field-of-view circle, cell blobs with nuclei and organelles, some in mitosis,
scale bar), *SEM diatom* (double frustule, radial ribs, pore rings), *EEG/Seismic*
(channel rows with burst envelopes). Annotations (crosshairs, ticks, "50 UM",
"SAG T1"...) on their own pen — they make the drawing a document.

**Concrete Poetry** — text as image, using the built-in single-stroke font.
Layouts: *Fill region* (repeating text rows clipped glyph-by-glyph to any closed
shape wired into the Region input — a poem in the shape of anything), *Spiral*
(text winds inward along an Archimedean spiral, letters rotated to the tangent),
*Wave* (undulating baselines, letters lean with the slope), *Scatter words* (seeded
dada scatter with size/rotation variation).

**Grid** — vertical/horizontal line grid. The plain sheet of paper of generative art;
feed it to Warp, Stretch or Lens to bend space itself.

**Tracks** — concentric rings (athletics-track offsets) around a centre. Ring count,
spacing, start radius.

**Flow Field** — streamlines traced through a noise vector field. Scale sets feature
size, steps set line length. The classic organic-flow workhorse.

**Truchet** — tiled quarter-circle patterns. *Tiles* mode draws arc tiles
(lines/spread/gap per tile); *Loop* mode grows a spanning tree and emits **one single
closed line** that fills the canvas — a maze you can plot without lifting the pen.

**Lissajous** — x/y sinusoids with frequency ratio and phase; the *damping* parameter
turns it into a harmonograph decay spiral.

**Phyllotaxis** — sunflower-seed spiral (golden angle); dot size can grow with index.

**L-System** — turtle-graphics rewriting systems. Presets (plant, Koch, dragon,
Sierpinski, Lightning with midpoint displacement) plus editable rules, angle jitter
and stochastic rule choice.

**Spirograph** — hypo/epitrochoid gear curves: ring/wheel teeth ratio and pen offset.

**Pendulum** — chained damped oscillator arms (1–3). Each arm's pivot rides the
previous tip; *Coupling* modulates an arm's frequency by the previous arm's angle
(real interaction: 0 = pure epicycles, high = chaos); rotating table; exponential
damping. One continuous stroke.

**Cycloid Machine** — simulation of the classic wooden drawing machine: two cranks,
two linkage rods, the pen at the rods' circle-intersection, paper on a slowly
rotating table. Continuity-safe branch selection; auto-fits to canvas.

**Contours** — marching-squares contour lines over fBm terrain or wave interference;
segments are chained into long polylines.

**Circle Packing** — non-overlapping circles grown by rejection sampling; size range
and optional noise-weighted density.

**Barcode** — vertical bars of varying width filled with boustrophedon strokes;
a stark rhythm generator (feed it to Stretch).

**Solids** — wireframe 3-D: Sphere (lat/lon rings; *Solid* hides the back
hemisphere, *Transparent* shows all), Cube, Tetra/Octa/Icosa/Dodecahedron (edges
derived from geometry). Rotate X/Y/Z, perspective 0–1, position. Rotations are
value-drivable — the animation star.

**Mountains** — fBm heightfield rendered as ridge lines with true hidden-line removal
(screen-space horizon buffer). Perspective (rows converge and compress with depth),
oblique skew, island edge-fade, optional cross-line mesh.

**Random Lines** — Molnár-style random segments: free endpoints or fixed length with
angle constraints (any / H+V / diagonals / 45° quantized).

**Starfield** — stars (uniform or noise-clustered, size variation) plus connection
modes: none, all pairs within a distance, k-nearest, or *Constellations* (chained
3–9-star figures). Separate star and line pens.

**Ruler** — tick scales with a minor/medium/major hierarchy. Linear or logarithmic
(slide-rule) spacing; numbers (built-in single-stroke font) or cycling symbols at
majors; ticks up/down/both. Optional **Spine input**: the ruler follows any path —
feed a Ribbon or Tracks ring to get curved measuring tape.

**Cables** — tangled wires: inertia-driven noise walks with soft edge steering.
*Edges* layout (cables enter and leave) or *Pile*; optional pen per cable.

**Lathe** — revolved profile rendered as stacked ellipses ("Rings"), a mirrored
silhouette ("Profile"), or both. Shed shapes: *Skirt* (the ceramic high-voltage
insulator default), round wave, sharp zigzag; view tilt; ends taper automatically.

**Fabric** — warp and weft lines deformed by one shared displacement field (so the
weave stays coherent): *Curtain* folds deepening downward with sag, *Flag* traveling
wave, *Silk* pure noise flow; plus fine rumple.

**Hairs** — area fill of short curved hairs. Direction: noise flow / fixed angle /
radial; curl with random handedness; gravity droop. Optional **Region input**: wire
closed shapes (Text outlines, silhouettes) and hairs grow only inside (even-odd).

**Potato** — asymmetric blobs (low-frequency harmonics + random squash) with light
overlap avoidance; optional "eyes" texture as dots or curved arcs.

**Trunks** — birch trunks only, no branches: two wandering edge lines per trunk.
Smoothness (edge waver), lean, upward taper, and *Artifacts*: horizontal bark
dashes (some doubled), on their own pen if desired.

**Water** — lake/sea surface: ripple rows compressed toward a horizon
(perspective), wave + slower swell + noise, and *Choppiness* that breaks lines into
glinting dashes via a noise gate.

**Skyline** — horizon silhouettes in 1–4 receding layers. *Forest*: fBm hills with
conifer-spike tops and optional trunk texture; *City*: stepped building skyline with
height distribution, antennas and window dashes (some dark). Shares its Horizon Y
convention with Water.

**Tiles** — grid of tiles, each a separate closed path. Shapes: parametric
**Superellipse** (N slides astroid → diamond → circle → squircle → rectangle),
Circle, Triangle, Hexagon, Star (points + inner radius), Reuleaux, Cross. Per-tile
rotation + jitter. The natural Explosion input.

**Reg Marks** — registration marks in selectable corners (+ optional centre):
cross, printer's circle-and-cross, or inward corner-L; adjustable insets. For
multi-pen registration and scan alignment.

**Noise** — analog-TV static: cells randomly filled with square/circle pixels or
horizontal *scanline dashes*; size/position jitter and rolling *interference bands*
that modulate density row-wise. Budget-capped.

**Net** — netting with selectable mesh: Diamond (fishing net), Square, Triangle,
Hexagon (chicken wire, drawn without doubled edges). Whole net sags like it hangs;
irregularity jitters the knots; strands are subdivided so they bend smoothly.

**Building** — brutalist Soviet panel block: floors × sections (stairwells), panel seams every
floor/section, windows (some lit with diagonals), balconies (none / alternating
columns / all) with railing lines, doors with canopies, roof machine room and
antennas, and an optional oblique side face with its own seams and end windows.

**Follow Lines** — the "follow the previous stroke" marker technique: iterative
offsets whose distance varies along the length (*Drift*), so bundles pinch into
dense ridges and fan into light sheets; *Relax* straightens successive lines.
One-sided or both; multiple generated wave bands, or wire any curve as the Spine.

**Wood Rings** — tree cross-section: growth rings with year-width variation grouped
by slow noise, shared angular wobble (rings never cross), eccentric reaction-wood
stretch, radial drying cracks, rough bark, pith. *Grain* mode instead renders the
split-face cathedral flame arches with vertical checks.

**Worm** — worm or centipede: an inertia-walk spine dressed in flattened cross-hoops
with a tapered width profile (round head, pointed tail). *Centipede* adds two-joint
leg pairs with alternating gait; optional antennae.

**Origami** — crease-pattern style folded-paper facets.

**Mesh** — jittered structural grid with selectable diagonals (none, \\, /,
alternating, random) — truss look (compare Fabric/Net for cloth).

**Ribbon** — a wandering backbone with parallel companion lines (1–60). At lines = 1
it is a clean single guide curve — a good Spine for Ruler or Follow Lines.

**Halftone** — dot/pattern shading driven by a noise field.

**Import SVG** — load an SVG file's paths onto the canvas (no text/CSS support).

**Stroke** — not geometry: produces a *style* (dash patterns etc.) for generators'
Style inputs.

**Text** — single-stroke plotter typography: built-in geometric uppercase font
(A–Z 0–9 **ÄÖÅ** punctuation), `|` for new lines, size = cap height, tracking, line
height, alignment, canvas centring. Every letter is pen strokes, not outlines.

## Modifiers (29)

**Apply Style** — applies a Stroke style to existing paths.

**Wave** — sinusoidal displacement along/across paths.

**Jitter** — per-point random displacement (densifies first).

**Rotate** — rotates content around a point.

**Glitch** — segment displacement/slicing artifacts.

**Offset** — parallel copies at a distance, with *Clean corners* cusp removal.

**Symmetry** — mirror/radial kaleidoscope repetition.

**Smooth** — corner-rounding relaxation.

**Magnet** — attracts/repels points within a radius (guide overlay).

**Trim/Extend** — shortens or lengthens path ends.

**Join Ends** — connects nearby path endpoints into longer polylines
(distance × angle scoring, rounds of batch pairing, optional same-pen-only).
Run before export to reduce pen lifts.

**Simplify** — removes points within a tolerance (Douglas-Peucker-style).

**Lens** — bulge/pinch distortion inside a circle (guide overlay).

**Warp** — 4-corner perspective or full lattice grid deformation.

**Mirror** — reflection orbits around a movable centre: left-right, up-down,
quad (4), or full 8-way D4 (cardinal + diagonal). Axes shown as guides. Mirrored
copies honestly reverse stroke direction.

**Move / Scale** — translate + scale (X/Y separable) around content centre, canvas
centre, or a custom point.

**Fit to Canvas** — scales and centres content into the margins: contain, stretch,
fit-width or fit-height. The "fix my composition" node.

**Reverse** — flips path direction: all, every 2nd (manual boustrophedon), or
random. Because direction is data.

**Skew** — X/Y shear in degrees (italicise Text, axonometry from Grid).

**Align** — snaps the content bounding box left/centre/right and top/middle/bottom
within margins.

**Crop** — clips to a rectangle (keep inside or outside), with bisection-accurate
boundary points; fully-inside closed paths stay closed. Guide overlay.

**Explosion** — rigid per-shape translation (shapes keep their form). Blast from a
point (*Outward/Inward* with distance falloffs) or *Directional* at a fixed angle;
effect limited to a circle or rectangle zone, and in rectangle mode movement can be
constrained to the horizontal or vertical axis only. Jitter + angular spread keep it
organic. Guide overlay with arrows.

**Fresnel Lens** — lens refraction that resets per concentric zone, exactly like a
real Fresnel lens: within each groove the radial mapping is monotonic (no folds),
and the groove boundaries produce the characteristic concentric shear
discontinuities. Circular or linear (sheet-lens) mode, groove pitch, smooth-lens or
prism profile, edge falloff; overlay shows the lens and a few grooves.

**Stretch** — monotonic band remap: geometry entering the band stretches uniformly
along it and everything beyond shifts by the amount — no folds, straight smears.
Directional or vanishing-point perspective mode; edge falloff shapes; per-path
jitter. The pixel-smear effect, done right. Guide overlay.

**Tangle Zone** — melts geometry into wandering tangle inside a zone, anchored at
the zone edge (guide overlay).

**Scatter** — breaks paths into displaced fragments.

**Pen Cycle** — assigns pens to whole paths in rotation.

**Chop** — cuts paths into arc-length pieces (length ± variation, optional physical
gap) and deals the pieces across 1–6 pens, cycling or randomly. Multi-colour within
a single stroke.

**Hatch Fill** — fills closed shapes with hatching (angle, spacing, inset from both
edges with parity checking); *Outside* region mode inverts via a synthetic frame
ring.

## Decorators (5)

**Stamp** — repeats a motif (or built-in marks; Line + Perpendicular = railway
sleepers) along paths, with per-path variation. Takes a Motif input.

**Outline** — encloses each stroke in a closed capsule (offset both sides +
semicircle caps); closed paths become two-ring bands. Turns strokes into fillable
shapes: Outline → Hatch Fill = fat filled lines.

**Coil** — replaces the line with a trochoid: overlapping loops when pitch < 2πr
(cursive eee / phone cord), stretched waves otherwise; constant loop density thanks
to arc-length sampling.

**Fur** — short hairs along the path edge: spacing, length ± jitter, angle jitter,
side (left/right/both alternating or random).

**End Caps** — arrows, dots, circles or ticks at open-path ends (start/end/both),
oriented by the path's final direction. Flow Field's missing arrowheads.

## Combiners (5)

**Mask** — clips paths by closed mask shapes (keep inside/outside).

**Merge** — combines up to several path inputs; later inputs plot later.

**Split** — separates paths into multiple outputs by rule (e.g. layer, index).

**Array** — grid/linear repetition of the input with per-copy deltas.

**Group** — a subgraph in a box (created with Cmd+G); double-click to enter.

## Math (5)

**Frame** — the animation clock. Outputs: `t 0→1` linear ramp (last frame = 1),
`frame #` integer, `wave loop` and `ping-pong` (seamless: frame N continues into
frame 0). Reads the ANIMATE panel's frame state.

**Value** — a constant number.

**Math** — A op B: + − × ÷ min max pow mod; inputs override the sliders.

**Random** — a seeded random number in a range; re-rolls per seed, not per frame.

**Fan** — duplicates one value to several outputs with per-output offsets — one knob
driving many parameters.

## Routing (1)

**Route** — legacy in-graph route optimizer (hidden from the palette; routing now
lives in the export panel as *Optimize route* + *Preserve direction*).
