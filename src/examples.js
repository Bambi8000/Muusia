/* Muusia — built-in Help examples.
 *
 * Each entry: { name, desc, make(defaults) => { nodes, edges } }.
 * `defaults(type)` is injected by App.jsx at load time so this file has no
 * imports and stays runnable in plain Node for validation
 * (tools/validate-examples.mjs).
 *
 * Conventions:
 * - node ids 9001+, edge ids "e9101"+ (loadExample resets NEXT_ID to 9500)
 * - start from defaults(type) and override only the params that differ
 * - built-in nodes only (no custom nodes, no file-import nodes)
 * - fixed seeds — an example must look good deterministically
 * - optional `canvas: { W, H }` per entry if the patch depends on sheet size
 */

export const EXAMPLES = [
  {
    name: "Arc Mounds · Billows", desc: "An A3 field of soft, overlapping bodies made entirely from curved pen strokes. Size contrast mixes small and large forms. Body curves adds asymmetry and waists; Curve scale changes how broadly they bend. Foreground shapes hide the lines behind them. Arc pitch sets density; Seed changes the composition. No solid fills are plotted.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds") } }], edges: [] }),
  },
  {
    name: "Arc Mounds · Soft body", desc: "A single asymmetric form with fuller lobes and a narrower waist. Body curves 0 restores the smooth oval. Try Curve scale, Fullness, Tilt and Arc flow to reshape the silhouette and its curved ribs. Every line is a real plotter stroke.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds"), layout: "Single", size: 260, fullness: 1.15, flow: 36, tilt: 15, bodyCurves: 0.9, curveScale: 260 } }], edges: [] }),
  },
  {
    name: "Arc Mounds · Three inks", desc: "The same soft field drawn with purple, magenta and teal. Colours assigns pens to whole forms and keeps all geometry unchanged. Select each pen on the node. Increase Size contrast for tiny shapes against broad curves; Arc pitch controls how much linework is drawn.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds"), colours: 3, layer: 5, pen2: 7, pen3: 6 } }], edges: [] }),
  },
  {
    name: "Arc Mounds · Rolls", desc: "Long, round-ended rolls with curved ribs across their bodies. Form → Rolls keeps the original Soft bodies option available. Body curves and Curve scale bend the tubes; Fullness changes their thickness. Use Single to isolate a roll, or Colours for up to six whole-body pens.",
    canvas: { W: 297, H: 420 },
    make: defaults => ({ nodes: [{ id: 9001, type: "arc_mounds", x: 30, y: 20, params: { ...defaults("arc_mounds"), form: "Rolls", size: 240, fullness: 1, tilt: 16, sizeContrast: 0.65, bodyCurves: 0.9, curveScale: 260, pitch: 1.8, flow: 35 } }], edges: [] }),
  },
  {
    name: "Ribbon · No crossings", desc: "An open six-colour sharp ribbon with mixed left and right turns that avoids itself. Angular layout → No crossings checks the full band width, including the corners. Clearance mm adds space between separate spans. Seed finds a new route; Turns is a maximum, so a wide band or large gap may produce fewer turns. Width and clearance scale together if the composition needs to fit the page. Choose a gap suitable for your actual pen width.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "No crossings", seed: 27, turns: 9, clearance: 6, width: 28, pitch: 0.3, stripeGap: 0.5, colours: 6, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3, pen6: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Ribbon · Sharp stripes", desc: "An A3 ribbon with long straight spans, sharp corners and six selected pens. Shape → Angular, layout → Free folds. Change Seed for a new route, Turns for complexity, Width for the band, or Corners for sharp/bevel joins. Stripes uses real parallel strokes at Pen pitch; crossings overprint. Woven Ribbon is the separate over/under option.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "Free folds", seed: 27, turns: 9, width: 28, pitch: 0.3, stripeGap: 0.5, colours: 6, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3, pen6: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Ribbon · Sharp zigzag", desc: "Six colour bands follow a regular zigzag. Corners → Sharp, with Corner limit 8 for pointed joins. Use Bevel for short flat tips. Switch Angular fill to Lines for a sparse drawing, or lower Colours for fewer pens. The complete band shrinks only if needed to fit the page margins.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "Zigzag", turns: 4, width: 24, miterLimit: 8, pitch: 0.3, stripeGap: 0.5, colours: 6, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3, pen6: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Ribbon · Star loop", desc: "A closed five-point star drawn as parallel colour stripes. Every filament is a closed pen stroke. Star points changes the polygon, Rotate turns the composition, and Stripe gap separates the colour bands. Crossings keep every stroke; use Woven Ribbon when you want actual underpass gaps.",
    canvas: { W: 297, H: 420 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), shape: "Angular", angularLayout: "Star", starPoints: 5, width: 25, rotate: 18, miterLimit: 4, pitch: 0.3, stripeGap: 0.5, colours: 5, layer: 5, pen2: 7, pen3: 9, pen4: 6, pen5: 3 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Zoom letter", desc: "One N grows into a large N made from many small Ns. Their physical size stays at 5 mm. Press Play in ANIMATE (try 48 frames), or use Phase input: 0 is one letter, 0.5 is full zoom. Max rows sets the largest letter grid; Cell spacing changes the gaps. Try Zoom in or Zoom out for a one-way cycle. Each small letter is real plotter geometry.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), text: "N", motion: "Zoom", size: 5, zoomRows: 32, zoomSpacing: 1.25 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Zoom word", desc: "ZOOM grows from four small letters into a word built from fixed-size Zs, Os and Ms. Press Play in ANIMATE (try 48 frames). Each character is built from copies of itself; a | in Text starts another centred line. A longer phrase needs a smaller Max rows setting to stay on the page.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), text: "ZOOM", motion: "Zoom", size: 3, zoomRows: 12, zoomSpacing: 1.2 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Shift field", desc: "A full field of letter cells stays in place while their order changes. Press Play in ANIMATE (try 36 frames). Shift pattern → Rows cycles each row, Columns cycles vertically, Shuffle rearranges the same letters with Seed. Spaces are omitted to keep the field filled; Phase selects an exact permutation.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), mode: "Fill region", text: "WORDS KEEP CHANGING", size: 5, lineh: 1.1, motion: "Shift", shiftPattern: "Rows", rowLag: 0.02 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Living columns", desc: "Repeated phrases shorten to THU 1 OCT 26 and expand again. Select Concrete Poetry, set ANIMATE to 36 frames and press Play. Try the fourteen Motion modes; Phase input lets you scrub or wire Phase 0–1. Motion Off restores the still composition. SVG × frames exports the moving geometry as separate drawings.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), mode: "Columns", text: "THURSDAY 1 OCTOBER 2026", shortText: "THU 1 OCT 26", size: 4.5, lineh: 1.2, motion: "Word collapse", amount: 1, rowLag: 0.04 } }],
      edges: [],
    }),
  },
  {
    name: "Poetry · Living waves", desc: "Real stroke letters ripple along repeated rows. Select Concrete Poetry and press Play in ANIMATE; 24–36 frames makes a smoother loop. Try Swarm, Letter flip or Typewriter, adjust Travel mm and the two lags, or pause to export a single drawing. Seed changes Swarm's scattering.",
    canvas: { W: 297, H: 210 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "concrete", x: 30, y: 20, params: { ...defaults("concrete"), mode: "Columns", columns: 1, align: "Centre", text: "WORDS IN MOTION", size: 10, lineh: 1.7, margin: 24, motion: "Wave", distance: 5, amount: 1, layer: 1, clip: false } }],
      edges: [],
    }),
  },
  {
    name: "Image · Drawing to blocks", desc: "A blue wire takes Lissajous into Image’s Drawing input. No photo needed: Square weave rebuilds the curve from filled squares. Try Organic dots or Short strokes, change the Lissajous frequencies, and use Drawing stroke mm to thicken the source interpretation. Source Auto follows the wire.",
    canvas: { W: 297, H: 210 },
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "lissajous", x: 30, y: 20, params: { ...defaults("lissajous"), fx: 3, fy: 4, turns: 1, margin: 26, layer: 0 } },
        { id: 9002, type: "image", x: 350, y: 20, params: { ...defaults("image"), source: "Auto", mode: "Square weave", cell: 1.8, drawingWidth: 3, strength: 1, gamma: 0.8, jitter: 0, pitch: 0.25 } },
      ],
      edges: [{ id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 1 }],
    }),
  },
  {
    name: "Image · Square weave", desc: "Choose your photo on Image. Staggered squares grow in darker regions; Hatch fill draws their interiors as real pen strokes. Jitter 0 keeps regular rows. Try Woven fill, Outline, an aligned Grid or Colours 6 with Tone bands.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "image", x: 30, y: 20, params: { ...defaults("image"), mode: "Square weave", cell: 3.2, strength: 1, gamma: 1.25, jitter: 0, pitch: 0.25 } }],
      edges: [],
    }),
  },
  {
    name: "Image · Organic dots", desc: "Choose your photo on the Image node. Organic dots turns its tones into filled circles. Try Dot fill → Outline, or Colours → 6 with Tone bands for a colourful print. A4 portrait with 12 mm margins.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "image", x: 30, y: 20, params: { ...defaults("image"), mode: "Organic dots", cell: 2.2, strength: 1, gamma: 1.4, jitter: 0.35 } }],
      edges: [],
    }),
  },
  {
    name: "Image · Short strokes", desc: "Choose your photo on the Image node. Short strokes follows tonal edges; try Flow field or Fixed angle for a different texture. Shadow passes adds lines in dark areas. Colours can follow the source or your own tone palette.",
    canvas: { W: 210, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "image", x: 30, y: 20, params: { ...defaults("image"), mode: "Short strokes", cell: 1.5, strength: 1, gamma: 1.1, flow: 1, pitch: 0.2, jitter: 0.2 } }],
      edges: [],
    }),
  },
  {
    name: "Coral · Brain study", desc: "An A3 coral medallion built from closed, winding contours. Three nested bands add line density. Try Form → Cells, change Seed, or set Colours to 6. Growth and Density take longer to recompute than colour or size.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "coral", x: 30, y: 20, params: { ...defaults("coral"), bands: 3 } }],
      edges: [],
    }),
  },
  {
    name: "Coral · Radial colours", desc: "Warped radial coral with a textured centre and teal, blue and ochre contour bands. Colours are assigned by each contour's average radius; all marks are real vector pen paths.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "coral", x: 30, y: 20, params: { ...defaults("coral"), form: "Radial coral", bands: 3, colours: 3, colouring: "By radius", layer: 6, pen2: 1, pen3: 10, growth: 0.9, density: 18 } }],
      edges: [],
    }),
  },
  {
    name: "Iris · Six colours", desc: "A3 iris with six separate pen layers: black, orange, blue, teal, purple and ochre. Colour mode → Six pens; choose each colour on the node and customise the inks in Pens.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "iris", x: 30, y: 20, params: { ...defaults("iris"), colours: "Six pens", layer: 0, innerPen: 4, accentPen: 1, midtonePen: 6, outerPen: 5, highlightPen: 10 } }],
      edges: [],
    }),
  },
  {
    name: "Iris · A3 study", desc: "A 277 mm iris on A3. Try Human, Cat, Goat or Gecko, or switch Centre to Centre rays. Three real pen layers: teal fibres, orange inner fibres, black accents.",
    canvas: { W: 420, H: 297 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "iris", x: 30, y: 20, params: { ...defaults("iris"), colours: "Three pens", layer: 6, innerPen: 4, accentPen: 0 } }],
      edges: [],
    }),
  },
  {
    name: "Iris · 420 mm", desc: "A full 420 mm iris on a 440 × 440 mm sheet. Monochrome, 1,400 fibres and an open pupil. This circle is wider than the short side of A3; use a larger sheet or Mega Canvas.",
    canvas: { W: 440, H: 440 },
    make: (defaults) => ({
      nodes: [{ id: 9001, type: "iris", x: 30, y: 20, params: { ...defaults("iris"), diameter: 420, fibres: 1400, pupilFill: "Open" } }],
      edges: [],
    }),
  },
  {
    name: "1 · Stamps", desc: "A yellow style wire (Dashed) feeds Tracks; Stamp rides the paths with triangles.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "viiva", x: 30, y: 20, params: { ...defaults("viiva"), dash: 24.5 } },
        { id: 9002, type: "radat", x: 340, y: 25, params: { ...defaults("radat"), rings: 30 } },
        { id: 9003, type: "stamp", x: 686, y: 38, params: { ...defaults("stamp"), spacing: 37, sizeMod: 1, pathVar: 0.6, motif: "Triangle", orientMode: "Along path", seed: 6727 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "2 · Seismic mountains", desc: "Mountains → Smear → Squiggle (Seismic): three modifiers become a new texture.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "mountains", x: 30, y: 20, params: { ...defaults("mountains"), rows: 53, height: 138 } },
        { id: 9002, type: "smear", x: 344, y: 93, params: { ...defaults("smear"), zx: 94, zw: 400, zh: 302, mode: "Horizontal" } },
        { id: 9003, type: "squiggle", x: 679, y: 126, params: { ...defaults("squiggle"), mode: "Seismic", amp: 0.5, levels: 3, seed: 6222 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "3 · Empty fill", desc: "Rippled terraces, then Empty Fill hatches the untouched paper with pen 4.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "parallel_lines", x: 30, y: 34, params: { ...defaults("parallel_lines"), spacing: 5, margin: 2, levels: 5, plateau: 58, relief: 0.67, fall: 1, mess: 1, layer: 7 } },
        { id: 9002, type: "ripple", x: 367, y: 20, params: { ...defaults("ripple"), waterline: 0.59, poolx: 28, poolw: 109, pooledge: 0.22, scale: 0.26, breakup: 0.31, stretch: 1.27, below: true, seed: 6635 } },
        { id: 9003, type: "empty_fill", x: 670, y: 131, params: { ...defaults("empty_fill"), pattern: "Hatch", gap: 6.2, angle: 38, seed: 9518, pen: 4 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "4 · Contours", desc: "One Voronoi, two treatments: SDF Contours and Mycelium Fill share the source.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "voronoi", x: 30, y: 52, params: defaults("voronoi") },
        { id: 9002, type: "sdfcontours", x: 393, y: 20, params: defaults("sdfcontours") },
        { id: 9003, type: "myceliumfill", x: 696, y: 263, params: { ...defaults("myceliumfill"), strands: 4, width: 10.5, boost: 0.2 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "5 · Potato ASCII", desc: "Potatoes rasterized into ASCII characters, then roughened by Hand Drawn.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "potato", x: 30, y: 20, params: { ...defaults("potato"), count: 14, eyes: "None" } },
        { id: 9002, type: "asciiart", x: 383, y: 47, params: { ...defaults("asciiart"), ramp: "Custom", rampCustom: ".oO0ÖCD" } },
        { id: 9003, type: "handdrawn", x: 720, y: 99, params: { ...defaults("handdrawn"), wobble: 3.7, waveLen: 87, tremor: 1.05 } },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "6 · Ribbon mosaic", desc: "Ribbon shattered by Cellular Mosaic, recolored with Set Pen, merged over the original.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "ribbon", x: 30, y: 20, params: { ...defaults("ribbon"), wander: 120, width: 55.5, widthVar: 1, margin: 23 } },
        { id: 9002, type: "cellular_mosaic", x: 336, y: 129, params: { ...defaults("cellular_mosaic"), scale: 10.5 } },
        { id: 9003, type: "setpen", x: 639, y: 438, params: { ...defaults("setpen"), layer: 7 } },
        { id: 9004, type: "merge", x: 934, y: 54, params: defaults("merge") },
      ],
      edges: [
        { id: "e9101", from: 9001, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: 0 },
        { id: "e9103", from: 9001, fromPort: 0, to: 9004, toPort: 0 },
        { id: "e9104", from: 9003, fromPort: 0, to: 9004, toPort: 1 },
      ],
    }),
  },
  {
    name: "7 · Nature", desc: "Wood rings + spore print; Negative Space fills the background with Caustics.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "wood", x: 30, y: 20, params: { ...defaults("wood"), rings: 24, cx: 82, cy: 72 } },
        { id: 9002, type: "spore_print", x: 304, y: 110, params: { ...defaults("spore_print"), cx: 69 } },
        { id: 9003, type: "merge", x: 610, y: 182, params: defaults("merge") },
        { id: 9004, type: "caustics", x: 596, y: 529, params: defaults("caustics") },
        { id: 9005, type: "negspace", x: 899, y: 434, params: defaults("negspace") },
        { id: 9006, type: "merge", x: 1205, y: 219, params: defaults("merge") },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
        { id: "e9102", from: 9001, fromPort: 0, to: 9003, toPort: 0 },
        { id: "e9103", from: 9003, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9104", from: 9004, fromPort: 0, to: 9005, toPort: 1 },
        { id: "e9105", from: 9003, fromPort: 0, to: 9006, toPort: 0 },
        { id: "e9106", from: 9005, fromPort: 0, to: 9006, toPort: 1 },
      ],
    }),
  },
  {
    name: "8 · Pebble", desc: "One Pebble, two fates: a contour halo and a glitched, shrunken pen-7 shadow.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "merge", x: 940, y: 48, params: defaults("merge") },
        { id: 9002, type: "setpen", x: 937, y: 460, params: { ...defaults("setpen"), from: 7, layer: 7 } },
        { id: 9003, type: "pebble", x: 30, y: 20, params: { ...defaults("pebble"), mode: "Mesh", angular: 0, facets: 19, detail: 0, rx: -41 } },
        { id: 9004, type: "move_scale", x: 638, y: 582, params: { ...defaults("move_scale"), dx: -5.5, dy: 2, scale: 33 } },
        { id: 9005, type: "glitch", x: 325, y: 150, params: defaults("glitch") },
        { id: 9006, type: "sdfcontours", x: 634, y: 20, params: { ...defaults("sdfcontours"), start: 11, step: 5.5, count: 8 } },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9001, toPort: 1 },
        { id: "e9102", from: 9004, fromPort: 0, to: 9002, toPort: 0 },
        { id: "e9103", from: 9005, fromPort: 0, to: 9004, toPort: 0 },
        { id: "e9104", from: 9003, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9105", from: 9006, fromPort: 0, to: 9001, toPort: 0 },
        { id: "e9106", from: 9003, fromPort: 0, to: 9006, toPort: 0 },
      ],
    }),
  },
  {
    name: "9 · Move & rotate", desc: "Two laser floors — one rotated — pushed apart by Move/Scale; a sphere floats between.",
    make: (defaults) => ({
      nodes: [
        { id: 9001, type: "retromesh", x: 41, y: 20, params: { ...defaults("retromesh"), mode: "Laser floor", size: 188, spokes: 12, throat: 0.68, persp: 0.54, terrain: 0.54, horizon: false, rx: -24, ry: 2 } },
        { id: 9002, type: "solids", x: 694, y: 51, params: { ...defaults("solids"), size: 43, rx: -48, ry: -3, rz: -31, persp: 0.1, lat: 14, px: 142, py: 101, layer: 2 } },
        { id: 9003, type: "merge", x: 1291, y: 22, params: { ...defaults("merge"), count: 3 } },
        { id: 9004, type: "retromesh", x: 30, y: 833, params: { ...defaults("retromesh"), mode: "Laser floor", size: 188, spokes: 12, throat: 0.68, persp: 0.54, terrain: 0.54, horizon: false, rx: -24, ry: 2, seed: 572 } },
        { id: 9005, type: "kierto", x: 346, y: 831, params: { ...defaults("kierto"), deg: -180 } },
        { id: 9006, type: "move_scale", x: 698, y: 803, params: { ...defaults("move_scale"), dx: -16, dy: -59.5 } },
        { id: 9007, type: "move_scale", x: 332, y: 96, params: { ...defaults("move_scale"), dx: 12.5, dy: 60.5 } },
      ],
      edges: [
        { id: "e9101", from: 9002, fromPort: 0, to: 9003, toPort: 1 },
        { id: "e9102", from: 9004, fromPort: 0, to: 9005, toPort: 0 },
        { id: "e9103", from: 9005, fromPort: 0, to: 9006, toPort: 0 },
        { id: "e9104", from: 9006, fromPort: 0, to: 9003, toPort: 2 },
        { id: "e9105", from: 9001, fromPort: 0, to: 9007, toPort: 0 },
        { id: "e9106", from: 9007, fromPort: 0, to: 9003, toPort: 0 },
      ],
    }),
  },
  {
    name: "10 \u00B7 Animation", desc: "Frame spins a solid over a static background. Press \u25B6 in ANIMATE.",
    make: (defaults) => {
      const so = defaults("solids"), ma = defaults("matem");
      so.shape = "Icosahedron"; so.size = 90;
      ma.op = "A \u00D7 B"; ma.b = 15;
      return {
        nodes: [
          { id: 9001, type: "frame", x: 30, y: 40, params: defaults("frame") },
          { id: 9002, type: "matem", x: 250, y: 40, params: ma },
          { id: 9003, type: "solids", x: 470, y: 120, params: so },
          { id: 9004, type: "mountains", x: 30, y: 330, params: defaults("mountains") },
          { id: 9005, type: "merge", x: 760, y: 200, params: defaults("merge") },
        ],
        edges: [
          { id: "e9101", from: 9001, fromPort: 1, to: 9002, toPort: 0 },
          { id: "e9102", from: 9002, fromPort: 0, to: 9003, toPort: "p:ry" },
          { id: "e9103", from: 9004, fromPort: 0, to: 9005, toPort: 0 },
          { id: "e9104", from: 9003, fromPort: 0, to: 9005, toPort: 1 },
        ],
      };
    },
  },
];
