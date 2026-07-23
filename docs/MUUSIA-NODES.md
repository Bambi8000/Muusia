# MUUSIA v2.32 — Node Reference

All 173 built-in nodes. Conventions used below: most generators accept a **Style**
input (wire a Stroke node to get dashes etc.) and have **Margin**, **Seed** and
**Pen** parameters; those are not repeated in every entry. All numeric parameters
accept value wires. *(mm)* means millimetres on the canvas.

---

## Generators (88)

**Image** — raster import (PNG/JPG, downsampled to grayscale). Render modes:
*Scanline wave* (darkness raises amplitude and frequency of horizontal waves),
*Halftone dots*, *Hatch levels* (four cross-hatch passes gated by darkness), and
*Flow shade* (noise streamlines seeded and lengthened by darkness). Gamma, invert,
white cutoff.

**Growth** — differential growth: a loop that grows (random edge splits + long-edge
splits) while short-range repulsion keeps it self-avoiding and cohesion keeps it
smooth — the organic meander classic. Circle or canvas bounds (guide overlay),
optional history rings every N iterations for the nested look. Point-capped.

**Test Card** — calibration sheets: line weight sweep, converging line spacing, hatch density, arcs & tight circles, pen-lift dot grid, fill swatches, registration marks, speed-ramp zigzag, and a *Pen palette* drawing one labelled swatch per pen (all 12). The grid auto-shrinks its cells to fit the current canvas.

**Clouds** — old-etching cumulus: each cloud is a row of overlapping lobe circles plus a few stacked on top, drawn as scalloped visible arcs. *Inner creases* lets each arc continue a little way behind its neighbour, like an engraver's line; *Hatch shading* adds horizontal rows that thin upward plus a dashed drop shadow under the flat base.

**Stone** — faceted rocks/boulders: irregular polygon outline with interior facet
lines from a highlight point (3-D chunk look) and optional hatch shadow (own pen).
Layouts: Scatter, Pile (gravity-stacked), Wall (grid — dry-stone look). Angularity
from smooth pebble to sharp shard.

**Asteroids** — vector-game asteroids: irregular polygons with in/out spikes (the
classic silhouette), plus an optional player ship (triangle) and stray bullets.
Jaggedness and vertex count shape the rocks.

**Seismic** — seismograph / EEG channel rows: a calm baseline per channel with 1–3 seeded burst events per row. Detail sets the channel count; annotations (ticks) go on their own pen.

**Concrete Poetry** — text as image, using the built-in single-stroke font.
Layouts: *Fill region* (repeating text rows clipped glyph-by-glyph to any closed
shape wired into the Region input — a poem in the shape of anything), *Spiral*
(text winds inward along an Archimedean spiral, letters rotated to the tangent),
*Wave* (undulating baselines, letters lean with the slope), *Scatter words* (seeded
dada scatter with size/rotation variation).

**Point Cloud** — 3D point clouds projected to the sheet. Source: a file
(.xyz/.csv/.txt with x y z per line, or ascii PLY) or a built-in parametric
cloud (Torus, Sphere, Cube, Octahedron, Pyramid, Spring, Mobius, Trefoil,
Klein bottle, Roman surface, Helicoid, Wave sheet, Galaxy). *Keep size* scales
by the rotation-invariant 3D bounding sphere so the object stays the same size
while Yaw/Pitch turn; off = always fit to sheet. Bitcrush: *Crush %* randomly
drops points (seeded), *Quantize %* snaps to a 3D grid — both act before
meshing. Output: dots, wire (3D k-nearest mesh) or both; *Max edge %* trims
long jumps, *Depth pens* splits near-to-far across pens.

**ASCII Art** — renders line work or an image as plottable ASCII characters in
the single-stroke font. *Source Lines* rasterizes the wired paths into a density
grid — the more line length in a cell, the darker its character; *Source Image*
samples a loaded picture's darkness. *Ramp* orders characters light-to-dark
(Custom takes your own string); characters missing from the stroke font fall
back to uppercase or are skipped. Gamma bends the mapping, Invert flips it,
Threshold leaves the lightest cells empty. Columns sets resolution; characters
are real pen strokes, so the result plots like any other geometry.

**Grid** — vertical/horizontal line grid. The plain sheet of paper of generative art;
feed it to Warp, Stretch or Lens to bend space itself.

**Tracks** — concentric rings (athletics-track offsets) around a centre. Ring count,
spacing, start radius.

**Flow Field** — streamlines traced through a noise vector field. Scale sets feature
size, steps set line length. The classic organic-flow workhorse.

**Truchet** — tiled quarter-circle patterns. *Tiles* mode draws arc or diagonal tiles; *Tile fill* leaves a seeded share of tiles empty; *Separate* clamps arc radii and forces an edge gap so strands never meet or cross. *Loop* mode grows a spanning tree and emits **one single closed line** that fills the canvas — a maze you can plot without lifting the pen.

**Zigzag** — rows of zigzag, sine or square waves. *Skew* tilts the zigzag toward a sawtooth; *Envelope* modulates amplitude with a seeded noise envelope (bursts and quiet passages); *Row phase* offsets rows for interference. Wire any path into **Spine** and the waves follow it as parallel offset rows.

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

**Potato** — asymmetric blobs (low-frequency harmonics + random squash) with optional "eyes" texture as dots or curved arcs. Placement: *No overlap* keeps every potato fully separated using its true extent (fewer may fit on a tight sheet); *Loose* allows touching and light overlap.

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

**Tiles** — grid of tiles, each a separate closed path: parametric **Superellipse**, Circle, Triangle, Hexagon, Star, Reuleaux, Cross, with per-tile rotation and jitter. Layout: *Grid*, *Brick* (offset rows) or *Hex pack* (0.866 pitch — circles and hexagons at Size 100 touch their neighbours); *Alternate flip* rotates every other tile 180° so triangles tessellate. The natural Explosion input.

**Reg Marks** — registration marks in selectable corners (+ optional centre):
cross, printer's circle-and-cross, or inward corner-L; adjustable insets. For
multi-pen registration and scan alignment.

**Noise** — analog-TV static: cells randomly filled with square/circle pixels or
horizontal *scanline dashes*; size/position jitter and rolling *interference bands*
that modulate density row-wise. Budget-capped.

**Net** — netting with selectable mesh: Diamond (fishing net), Square, Triangle,
Hexagon (chicken wire, drawn without doubled edges). Whole net sags like it hangs;
irregularity jitters the knots; strands are subdivided so they bend smoothly.

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

**Caustics** — top-down shallow-water light caustics: the surface is a sum of
crossing noise wave trains, brightness is its curvature (Laplacian), and the bright
focus ridges are traced as marching-squares iso-contours stitched into flowing
threads. Focus gain, brightness threshold, contour bands, ripple scale, depth
stretch, minimum line length.

**Text on Path** — single-stroke text laid along a wired spine (same font as Text):
each glyph sits at its arc-length position rotated to the local tangent. Align
Start/Center/End, start offset %, baseline offset along the normal, Flip side,
Repeat-to-fill with gap, curve sampling. Open and closed spines; falls back to a
horizontal line when unwired.

**Lace** — classic lace in three patterns: *Doily* (center flower, ring bands with
seed-picked motifs — plain/double rings, zigzag diamond mesh, sector fans, picot
loops — and a scalloped picot edge), *Edging* (header lines, mesh strip, scallops
with fans and picots), *Mesh ground* (torchon diamond net with hashed spiders).
Sectors, rings, detail, picots on/off, edging depth.

**Knot** — a torus knot p·q drawn flat with real over/under crossings: at every planar self-intersection the strand passing underneath is cut with a gap, so the knot reads as woven. Coprime p/q give true knots; Tube sets the torus thickness.

**Murmuration** — a closed-form starling flock: every bird is a deterministic
function of (time, index) — flock center follows a guide path, the flock breathes
(pulse), swirls and stretches along travel. All time terms are sampled on a circle,
so t=0 ≡ t=1: wire Frame's *t* into Time for a seamless loop. Flock paths: Wander /
Oval / Figure-8 / Lissajous 2:3 / Trefoil, with a wander-mix for organic drift.
Bird shapes Dash/Chevron/Dot with size variation for depth; optional flight-history
trails whose point order equals flight direction.

**Dazzle Camouflage** — WWI razzle-dazzle: recursive straight-chord splits carve the
sheet into convex patches; each patch gets hatching at a quantized clashing angle
(never repeating its neighbor), with blank, cross-hatch and wavy patch styles, and
optional bold outlines. Serpentine stripe order.

**Root Web** — hyphal growth: queued tips step through noise-steered incremental
turns and split into binary branches at a seeded rate; edge and point budgets end
strands. Spore count, growth cycles, split rate, wander, internode, spawn radius.

**Sand Line Hatch** — broken multi-segment scanlines whose ink probability is
noise × density, producing grain-gradient fields; runs collapse to 2-point
segments and lines alternate direction (serpentine).

**Gravity Cascade** — particles launched into a field of gravity wells trace decaying orbits. *Wells layout* places the attractors (Triangle, Line, Ring, Center + ring, Random with a Wells count); *Launch* picks the start (Ring around the center, Top rain from the upper edge, Spiral). Paths end at the sheet edge.

**Hyperbolic Truchet Maze** — Truchet arcs on a polar grid whose rings crowd toward the center or the rim (Ring Crowding), so the maze reads as a hyperbolic disc. Arc strands connect seamlessly across cells; *Solve* traces the strand network and recolors one strand running from the center to the outer rim onto the Solve pen (arcs style only).

**Voronoi** — seeded sites carved into cells by half-plane clipping, with optional
Lloyd relaxation (0-3) for even cell sizes. Shared edges are emitted exactly once,
so no line is drawn twice. Optional site crosses.

**Metaballs** — a blob field (sum of r²/d²) contoured with marching squares into
1-5 nested iso-bands; segments are stitched into closed organic loops that merge
where blobs meet.

**Trace Image** — threshold contours of a loaded raster image (fileImage): 1-6 tonal
levels traced as vector contours fitted to the margin box, with invert and a
minimum-contour filter for specks.

**Harmonograph** — the classic twin-pendulum drawing machine: two damped
oscillators per axis trace one continuous stroke that spirals inward as it dies.
Near-integer frequency ratios plus a small detune give the iconic almost-closing
loops.

**FM Rose** — FM synthesis as a polar curve: a modulator warps the carrier that shapes the radius. Low index gives rosettes, high index chaotic flowers; Rings stacks scaled copies with per-ring rotation, and *Ring pens* cycles successive rings through that many pens.

**Conway** — Game of Life replayed deterministically from a seeded board for N
generations per compute; wire a value into Generations to animate growth. Live
cells drawn as squares, dots or diamonds, with optional edge wrap.

**Superformula** — the Gielis superformula: one equation spanning stars,
flowers, polygons and diatoms via m/n1/n2/n3. Rings with twist fill the shape
concentrically.

**Delaunay** — triangulation of input path points (resampled or raw vertices)
or seeded random sites; the dual of Voronoi. Shared edges emitted once. Feed any
artwork in for a low-poly version.

**Attractor** — Clifford / De Jong maps or the Lorenz system iterated thousands of times, fitted to the sheet. In Lorenz mode the four sliders map to the system (a→rho, b→sigma, c→beta, d→speed) and *Plane* picks the projection (x-z / x-y / y-z). Polyline is one chaotic thread, Dashes the classic attractor dust.

**Julia** — escape-time fractal contours of the Julia or Mandelbrot set, banded
by normalized iteration count. The c-parameters accept value wires, so an LFO
turns the fractal into a living, loop-seamless organism.

**Differential Growth** — the classic organic-growth algorithm: a seed circle
whose points repel neighbours and split stretched edges until the line fills
space like coral. Deterministic (position-hashed chaos); wire Iterations to
animate. Heavier at high iteration counts.

**Runes** — asemic writing: a seeded alphabet of invented angular glyphs laid out
in words and lines. Repeating letters from a finite alphabet make it read as
language; every seed is a new script.

**Network** — a seeded graph laid out by deterministic force simulation:
nearest-neighbour links plus a few long-range ones untangle into constellation
diagrams. Edges stop at node circles; node size can follow connection count;
wire Iterations to animate the untangling.

**Tubes** — tubes wandering and crossing in 3D, projected with perspective and
drawn with real hidden lines: tubes break where they pass behind each other and
their own back side is hidden. Surface is one continuous spiral per tube or a
ring-and-line wireframe; radius is noise-modulated; wire Drift to animate.

**Girih** — Islamic star patterns by Hankin's method: rays leave every tile-edge
midpoint at a contact angle and weave a continuous star-and-polygon lattice over
a hexagon or square tiling. One angle slider (54 deg classic) morphs the family.

**Aggregate** — WASP-style discrete aggregation: copies of a module (wired in,
or built-in) snap together at bounding-box connectors with collision checks,
growing a crystal-like assembly part by part. Wire Iterations to animate growth.

**Turtle** — classic turtle graphics from a command string: F/B move drawing, M moves pen-up, R/L turn, U/D pen up/down, [ ] branch, N[...] repeats. *Preset* picks a ready-made program (Hex flower, Pentagram, Spun squares, Rose window, Radial burst, Turning square, Branch tree, Zigzag ribbon); Custom uses the Program field. Auto-fits to the sheet; deterministic.

**Lichen** — map-lichen and crustose growth after the real thing: Map builds
polygon patches split by continuous wandering cracks, each patch grain clipped to
its own cell; Rosettes grows ringed thalli with dark textured centers and pale
rims (target-lichen); Colony scatters mixed-age patches across bare rock. Pens
splits species across the palette; Crack width tunes the gaps (0 = seamless);
fill style (mosaic / rings / stipple) is seed-mixed; sizes follow a natural
small-to-large distribution.

**Smoke** — incense smoke in 3D: a laminar stream rises smoothly, then breaks
into turbulent curls past the break height. The line is a ribbon of parallel
filaments twisting around the stream and folding like real smoke sheets. Wind
bends the column, View yaw orbits it, and Drift wired to Frame makes the smoke
flow through an animation. Each filament is one continuous pen stroke.

**Himmeli** — the traditional Finnish straw mobile in 3D: octahedral straw units
built into classic forms — Single crystal (nested at higher complexity), Column
(units tip to tip on threads), Chandelier (center with hanging side units), or
Cluster (a two-layer cloud with pendants swinging on seeded thread lengths and
angles). Rotate with View yaw and pitch; wire Frame into Yaw and the mobile
spins through the animation. Shared straws are deduplicated.

**Polka Dots** — plain dots or circles on a grid: Square rows, Hex (net-like
offset rows), or Random with even spacing. Dot size 0 plots a bare pen touch;
larger sizes draw circles; Size variation makes the field breathe.

**Subway Map** — a transit map in classic Massimo Vignelli style: octilinear
routes (0/45/90 only), lines bundling into shared corridors with even spacing
and splitting off at 45 degrees, station dots on each line's own pen, larger
interchange rings where lines meet, and terminal bars at route ends. Lines
cycle through the pens — one color per route.

**PCB Tracks** — printed circuit board copper: octilinear tracks (45-degree
bends only) routed between round pads, IC footprints as twin rows of pads
feeding tracks outward, and via dots along the runs.

**Moon Craters** — cratered lunar terrain from a heightfield of bowl-and-rim craters. Top view (default) draws rim/floor outlines or a relief-displaced mesh; 3D view looks across the plain to a horizon — rotate with Yaw, raise the camera with Pitch. 3D Mesh uses classic silhouette occlusion; 3D Outlines drapes the crater rings over the terrain.

**Comets** — nucleus and sweeping tail. Detailed draws the ball with coma arcs
and a fan of curved tail streamlines; Minimal is just a dot and a single line.
Body and tail on separate pens; tails point away from the sun direction.

**Blueberry Sprig** — hand-drawn blueberry sprigs after an embroidered original:
a wandering main stem with sharp little kinks, sparse side branches, berries as
small circles on stalk tips (sometimes clustered), and loose open cup flowers.
Tip mix balances berries against cups; Leaves adds pointed ovals; a light ink
wobble is baked in — chain into Hand Drawn for more.

**Power Pole** — wireframe 3D utility poles: Finnish Wood (single pole, crossarm, pin insulators, guy wire), US Utility (double crossarm, cylinder transformer), Japanese Concrete (stacked arms, transformer drums). Wires hangs catenary cables from the insulators; rotate with Yaw/Pitch, wire Frame to orbit.

## Modifiers (58)

**Apply Style** — applies a Stroke style to existing paths.

**Wave** — sinusoidal displacement along/across paths.

**Squiggle** — replaces each line with a waveform travelling along it in the
path's own frame. *Loops* draws overlapping pen coils (trochoid — loops appear
when Amplitude × 2π exceeds Period); *Sine*, *Triangle* and *Square* are classic
waves; *Seismic* is seeded noise bursts between calm stretches; *Glitch* holds
quantized offset steps that jump every period. On closed paths the period snaps
so whole cycles fit and the seam stays continuous. Compare Zigzag's Spine input:
that draws wave rows around a path — this rewrites the line itself.

**Jitter** — per-point random displacement (densifies first).

**Rotate** — rotates content around a point.

**Glitch** — segment displacement/slicing artifacts.

**Offset** — parallel copies at a distance, with *Clean corners* cusp removal.

**Symmetry** — mirror/radial kaleidoscope repetition.

**Smooth** — smooths paths in two modes. *Relax* runs an arc-length moving average (Radius mm) over the line — visible on typical densely sampled geometry; endpoints stay pinned and closed paths wrap. *Round corners* is classic Chaikin corner-cutting for sparse polylines like Random Lines or Delaunay edges.

**Magnet** — attracts/repels points within a radius (guide overlay).

**Trim/Extend** — shortens or lengthens path ends.

**Bridges** — connects points of the input with bridge lines. Points from *Path centers* (Polka Dots / Phyllotaxis circles become nodes), *Vertices* (resampled at a spacing) or *Endpoints*; rules *k-nearest*, *Within distance*, *Chain* (one continuous nearest-neighbour stroke, split at long jumps) or *Delaunay* edges. *Trim ends* stops each bridge short of its points so lines never pierce the dots.

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

**Eraser** — erases a region: everything inside the zone (rectangle or circle,
dashed guide when selected) is removed and crossing paths are cut cleanly at
the border. *Invert* keeps only the inside instead — a circular or rectangular
crop for any geometry. *Gap* grows (+) or shrinks (−) the erased area from its
edge, so a positive gap leaves breathing room at the cut. Closed paths that get
cut reopen as arcs.

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

**Smear** — pixel-stretch for lines inside a rectangular zone (guide overlay). *Vertical* / *Horizontal* replace zone content with straight axis-aligned streaks at the boundary crossings (sign follows travel direction; Streak length 0 runs to the far edge). *Free (bridge)* instead joins each path's entry and exit with one straight chord, so the line continues unbroken through the zone. *From edge* picks which zone edge feeds the effect — e.g. Right continues only right-edge crossings seamlessly along their own tangents while other edges are simply cut. Compare Stretch: that remaps geometry, this replaces it.

**Stretch** — monotonic band remap: geometry entering the band stretches uniformly
along it and everything beyond shifts by the amount — no folds, straight smears.
Directional or vanishing-point perspective mode; edge falloff shapes; per-path
jitter. The pixel-smear effect, done right. Guide overlay.

**Tangle Zone** — melts geometry into wandering tangle inside a zone, anchored at
the zone edge (guide overlay).

**Scatter** — breaks paths into displaced fragments.

**Pen Cycle** — assigns pens to whole paths in rotation.

**Set Pen** — recolors the input onto another pen. *All* moves everything to the target pen; *Single* remaps only one source pen and leaves the rest untouched — handy for swapping a single color in a multi-pen patch.

**Travel Stop** — inserts a pause or pen-change after a set distance of drawing, for
wearing/refilling media (chalk, charcoal, dip/fountain pens). Every N mm of drawn
length it tags the next path so the G-code lifts and pauses (M0) with your message
("Advance chalk / refill"), or treats it as a pen change. Unlike the machine
profile's Maintenance pause (which is fixed per machine), this lives in the graph and
travels with the patch. Place it LAST and keep route optimize off so the distance
spacing stays accurate.

**Chop** — cuts paths into arc-length pieces (length ± variation, optional physical
gap) and deals the pieces across 1–6 pens, cycling or randomly. Multi-colour within
a single stroke.

**Mycelium Fill** — grows organic flesh along a line network: parallel strands follow each input line and the width swells near junctions (3+ path ends meeting, or crossings between paths), so joints read thicker — a slime-mould look on a Voronoi or Network input. Strands invading a neighbouring strut's territory are cut, except near junctions where they merge; *Waviness* adds hyphal wobble, *Taper* thins open ends.

**Hatch Fill** — fills closed shapes with hatching (angle, spacing, inset from both
edges with parity checking); *Outside* region mode inverts via a synthetic frame
ring.

**Glitch Loom** — slices paths at horizontal loom rows and shifts each row by a
seeded warp offset (clamped to the sheet); torn ends may spawn frayed threads that
drip downward. Pitch, max shift, fray probability and length.

**Origami Glitch Fold** — mirrors everything on one side of an adjustable fold line
back across it, with a distance-proportional crease warp; optional Keep Original
for layered folds. Output clamped to the sheet.

**Cellular Mosaic Displace** — assigns points to lattice cells, splits paths at
cell borders and displaces each fragment by its cell's seeded offset; optional
sub-lattice quantize snap for a crystalline look. Duplicate points cleaned.

**Occlude** (occlusion) — hidden-line removal. Wire closed shapes into the
Occluders input to hide the Lines input behind them, or leave it unwired for
painter mode where later closed shapes in the set hide earlier paths. Gap grows
(+) or shrinks (-) the occlusion region so lines die cleanly before an edge.

**Cage Warp** (deform) — a seeded 2-6-cell FFD lattice bends everything smoothly;
Pin edges keeps the canvas border still. Output clamped to the sheet.

**Carve** (deform) — parametric window t0..t1 of every path by arc length, with
interpolated cut points. Wire Frame t into End t for a write-on animation; Invert
keeps the complement, wrapping correctly on closed paths.

**Echo** (deform) — 1-12 progressive copies where translate, rotate and scale
compound per copy; pivot at canvas center or path centroid; optional pen cycling
per echo.

**Displace by Image** (deform) — a loaded raster (fileImage) displaces paths:
darkness pushes along a chosen angle, or the darkness gradient makes lines flow
toward tonal edges (emboss). Untouched passthrough when no image is loaded.

**Travel Sort** (penout) — greedy nearest-neighbour reordering of the plot:
open paths may be reversed, closed loops are entered at the vertex nearest the
pen, and pen groups stay intact. Same geometry, drastically less pen-up travel;
place last before export.

**Cull** (penout) — drop paths by criterion: Random keep-probability (seeded),
Every Nth, or Shorter/Longer than a length, with Invert.

**Granulate** (deform) — granular synthesis for paths: the line is chopped into
grains that each get jitter, rotation and scale, dissolving geometry into a
cloud of its own fragments. Density thins the cloud.

**Fold** (deform) — a wavefolder for geometry: points beyond the window reflect
back inside, repeatedly. Gain drives the shape outward before folding, exactly
like input gain on a synth wavefolder, multiplying the creases.

**Bitcrush** (deform) — sample-rate and bit-depth reduction: coarse resampling
makes paths angular, grid quantization snaps coordinates. Consecutive duplicate
points are removed.

**Tile Shuffle** (deform) — the canvas is cut into a grid and tiles are permuted
with optional flips/180s (bounds-safe). Cuts at tile borders are exact, so no
ink is lost at the seams. Amount selects how many tiles join the shuffle.

**Kaleidoscope** (deform) — clips the source to one wedge around the canvas
center and replicates it N times, mirroring alternate copies. A mandala from
anything.

**To Polar** (deform) — cartesian-to-polar remap: x becomes angle, y becomes
radius, bending any horizontal composition into rings, discs or fans. Turns,
start angle and inner radius shape the wrap.

**Fourier** (deform) — elliptic Fourier reconstruction of closed shapes from the
first K harmonics: K=1 is an ellipse, K=64 the original. Wire a value into
Harmonics to morph detail in over an animation; optional epicycle ghost circles.

**SDF Contours** (deform) — distance-field isolines around ALL input geometry:
unlike per-path Offset, nearby shapes merge into one smooth halo, like
metaballs. Inside adds negative offsets within closed shapes; open lines get
stadium-shaped halos.

**3D View** (deform) — puts the drawing into 3D and views it from any angle:
yaw/pitch/roll with adjustable perspective (0 = isometric, 1 = dramatic).
Z source Flat tilts the sheet like paper, Pens stacked gives each pen layer its
own depth (parallax when rotated), Noise relief bends the drawing over a
heightfield. Wire Frame into Yaw for a spinning-drawing animation.

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

**Hand Drawn** — makes any line look drawn by hand: smooth low-frequency wobble
along the stroke's arc length, fine tremor on top, optional ink breaks (the pen
skips), and end overshoot / fall-short so strokes don't stop exactly where they
should. Every path wobbles differently, so parallel lines live like a real
sketch. Unlike Jitter (raw point noise), the wobble follows the stroke itself.

**Rect Collage** — cuts random rectangles of different sizes out of the input
and rearranges the pieces at random positions, optionally rotated in 90-degree
steps. Unlike Tile Shuffle's regular grid, pieces vary in size and land
anywhere; Keep rest passes the uncut remainder through underneath.

**3D Glitch** — throws the drawing into 3D space and corrupts it: the sheet
undulates with noise relief, tilts with yaw and pitch under perspective, then
glitches in screen space — horizontal bands tear loose and shift sideways, some
quantizing into blocky steps. Color split adds a displaced duplicate on another
pen (plotter chromatic aberration). Wire Drift to Frame and the corruption
crawls through an animation.

## Combiners (12)

**Mask** — clips paths by closed mask shapes (keep inside/outside).

**Merge** — combines up to several path inputs; later inputs plot later.

**Split** — separates paths into multiple outputs by rule (e.g. layer, index).

**Array** — grid/linear repetition of the input with per-copy deltas.

**Group** — a subgraph in a box (created with Cmd+G); double-click to enter.

**Copy to Points** — instances the Motif input onto the Points input's path
points (resampled at a spacing, or raw vertices): per-copy scale and rotation
jitter, tangent-aligned or random rotation, keep probability, point budget.

**Stencil** — pick ONE closed region from the Regions input (index wraps, so the
slider steps next/previous — or wire Steps to animate the selection) and clip
the Content input inside it, with an edge inset. All-regions mode, outline
preview, and browse mode when Content is unwired.

**Switch** — a selector gate: the Select value picks which of the wired path
inputs passes through; unwired inputs are skipped and the index wraps. Wire
Steps into Select for per-frame scene switching.

**Ray** — Houdini-style projection: every point of A is cast along a direction
until it hits B's lines, so A drapes over B like fabric or rain. Misses keep
their place for a continuous drape; Offset lands the line just before the
surface.

**Mini Canvas** — lays out miniatures of full-canvas compositions on one
sheet. Auto grid packs each wired input (A–F) into its own cell — a contact
sheet. Fixed size makes production runs: set one mini size (postcard 148x105)
and a count, and copies fill the sheet cycling through the wired inputs. L cut
marks at every mini's corners and T fold marks (position in mm from the
card's left/top edge, vertical/horizontal/both) go on their own Mark pen — plot in pencil, erase
after cutting.

**Negative Space** — clips Fill into the space a Shape does NOT use: the shape's
lines plus a clearance band, and the inside of its closed paths, count as
occupied, and the fill flows around them — a background behind Tubes without
touching it. Inverse mode keeps the fill only INSIDE the used space. Works with
any geometry, open or closed, unlike Mask.

**Diff Pens** — compares Modified against Original and recolors only what
changed: paths present in both keep their pen, anything NEW in Modified moves
to the Diff pen. Feed a sprig to Original and the same sprig through Fur to
Modified — the sprig stays one color, the fur gets another. Exact match is fast
for add-only modifiers; Distance match tolerates wobble and splits (Hand Drawn)
within the tolerance.

## Math (9)

**Frame** — the animation clock. Outputs: `t 0→1` linear ramp (last frame = 1),
`frame #` integer, `wave loop` and `ping-pong` (seamless: frame N continues into
frame 0). Reads the ANIMATE panel's frame state.

**Value** — a constant number.

**Math** — A op B: + − × ÷ min max pow mod; inputs override the sliders.

**Random** — a seeded random number in a range; re-rolls per seed, not per frame.

**Fan** — duplicates one value to several outputs with per-output offsets — one knob
driving many parameters.

**LFO** — a value oscillator for animation: Sine / Triangle / Saw / Square /
Noise loop, an integer number of cycles per loop (so wired Frame t stays
loop-seamless), phase, and min/max output range.

**Steps** — quantized step sequencer: t is split into N steps patterned as
Ramp up/down, Ping-pong or seeded Random, scaled to min/max.

**Shaper** — easing curves for t: Linear, Smoothstep, Ease in/out/in-out,
Bounce, Reverse, Triangle, with an integer repeat. End-inclusive: t=1 maps to
the end of the curve, so a Frame-driven write-on never snaps back on its final
frame; use Triangle for seamless loops.

**ADSR** — a multi-segment envelope for t: attack, decay, sustain level and
release as fractions of the loop. Starts and ends at zero, ideal for animations
that appear, hold, and fade.

## Routing (1)

**Route** — legacy in-graph route optimizer (hidden from the palette; routing now
lives in the export panel as *Optimize route* + *Preserve direction*).
