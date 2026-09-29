// Authored teaching content. Technical control metadata is generated from the node definitions.
// Examples use an A4 landscape canvas (297 × 210 mm) and the default pen palette.

export const tutorials = [
  {
    id: "first-drawing",
    number: "01",
    title: "Your first Muusia drawing",
    summary: "Turn straight lines into a flowing pattern, then save a patch you can edit and an SVG you can use elsewhere.",
    duration: "10–15 min",
    level: "Start here",
    nodeKeys: ["grid", "aaltoilu"],
    learn: ["Add and connect nodes", "Read the selected node’s output", "Change a pattern with two controls", "Save an editable patch and export an SVG"],
    prerequisite: "Muusia open in a desktop browser. No plotter, drawing experience or programming knowledge required.",
    steps: [
      {
        title: "Start with a blank patch",
        body: "If you have work open, click Save first. Download the empty starter patch from this page, then click Load in Muusia and choose blank.muusia.json. Loading replaces the current patch. Choose A4 wide from Size preset in the top bar after loading; this also refreshes the Canvas fields to show 297 × 210 mm.",
        tip: "A patch is the editable recipe: nodes, their settings and their connections. The canvas is your drawing area, measured in millimetres.",
        checkpoint: "The workspace contains no nodes, and the canvas reads 297 × 210 mm."
      },
      {
        title: "Make a field of straight lines",
        body: "Click an empty part of the workspace, press N, type Grid and choose Grid from the results. On its card, set Vertical lines to 0, Horizontal lines to 24, Margin mm to 24 and Resolution mm to 2. Leave Pen at 0 · Black. Type values into the number fields and press Enter to commit them. Click the Grid title to select it. Press F for the Focus view shown below, then Esc to return to the workspace before adding Wave.",
        tip: "N searches all nodes; shortcuts pause while you type in a field. Pen is a row of colour dots: hover a dot to see its number and name.",
        checkpoint: "The right-hand preview shows 24 horizontal lines with a clear border around them.",
        image: "assets/screenshots/grid.png"
      },
      {
        title: "Connect a Wave modifier",
        body: "Press N again and add Wave. Drag its title bar to place it to the right of Grid. Drag from the blue output dot on Grid’s right edge to the blue input dot on Wave’s left edge, then release. Set Wave’s Amplitude mm to 4, Wavelength mm to 45 and Phase to 0.",
        tip: "Blue ports carry paths: the lines that can be drawn. A modifier needs paths from another node before it can produce a result.",
        checkpoint: "One blue wire connects Grid to Wave. Wave’s small preview contains wavy lines."
      },
      {
        title: "Choose the result you want to see",
        body: "Click Wave’s title. The main preview now shows Wave’s result. Click Grid to compare the original straight lines, then select Wave again. Press F for the Focus view shown below: the selected node sits beside a large preview. Press Esc to return to the full workspace.",
        tip: "The selected node supplies the main preview and export. Selecting an earlier node shows an earlier stage of your drawing.",
        checkpoint: "With Wave selected, the large preview shows the same flowing pattern as the finished example.",
        image: "assets/screenshots/aaltoilu.png"
      },
      {
        title: "Feel what the controls do",
        body: "Try Amplitude mm at 0, 4 and 8: it changes how far the lines bend away from their original paths. Return it to 4. Try Wavelength mm at 25 and 70: smaller values fit more waves along each line. Return it to 45. Change one control at a time so you can see its effect.",
        checkpoint: "Your final settings are Amplitude mm 4, Wavelength mm 45 and Phase 0."
      },
      {
        title: "Save the recipe and export the drawing",
        body: "If Focus view is still open, press Esc to return. Click Save to download an editable .muusia.json patch. With Wave selected, scroll the right-hand panel to EXPORT SVG (laser / vector) and click it. In the generated output section, click Download .svg. The patch lets you keep editing; the SVG contains the drawing as vector paths.",
        tip: "After loading a saved or downloaded patch, select Wave again before exporting. Loading clears the selection.",
        checkpoint: "You have both a .muusia.json file and an .svg file. Open the SVG to check the complete 297 × 210 mm drawing."
      }
    ],
    experiment: "Make three variations using the same Grid: calm waves at Amplitude mm 2, deeper waves at 8, then short waves at Wavelength mm 20. Save your favourite as a separate patch.",
    troubleshooting: [
      { q: "The preview is empty.", a: "Select Wave by clicking its title. Check that Grid’s blue output is connected to Wave’s blue input, and that Horizontal lines is greater than zero." },
      { q: "I still see straight lines.", a: "Check that Wave is selected and Amplitude mm is above 0. Grid itself stays straight: the change happens in Wave." },
      { q: "The export button is disabled.", a: "Select Wave and confirm its preview contains paths. Export uses the selected output, so a blank selection cannot export a drawing." }
    ],
    next: "style-and-stamp"
  },
  {
    id: "style-and-stamp",
    number: "02",
    title: "Style and stamp a pattern",
    summary: "Give organic loops a dashed rhythm, then place small triangles along their paths.",
    duration: "15–20 min",
    level: "Build your skills",
    nodeKeys: ["viiva", "radat", "stamp"],
    learn: ["Connect a stroke style to a generator", "Keep a random pattern repeatable with Seed", "Place and orient motifs along paths", "Separate the host drawing from its decoration"],
    prerequisite: "Complete Your first Muusia drawing, or be comfortable adding nodes and connecting their ports.",
    steps: [
      {
        title: "Set up three nodes",
        body: "Save your current work, then Load the empty starter patch. Choose A4 wide from Size preset after loading, so the Canvas fields show 297 × 210 mm. Use N to add Stroke, Tracks and Stamp. Arrange them from left to right in that order.",
        checkpoint: "You have three separate nodes. Tracks already produces loops; Stamp will need a host connection."
      },
      {
        title: "Create a repeatable set of loops",
        body: "On Tracks, set Loops to 12, Gap mm to 6, Shape noise to 4, Drift to 2, Seed to 7 and Pen to 1 · Blue. Select Tracks, then press F for the Focus view shown below. Press Esc to return before connecting Stroke.",
        tip: "Seed picks a particular variation. Keeping Seed and the other settings unchanged reproduces the same pattern. The dice button chooses a different seed.",
        checkpoint: "Twelve blue loops form a softly uneven oval.",
        image: "assets/screenshots/radat.png"
      },
      {
        title: "Make the loops dashed",
        body: "On Stroke, set Type to Dashed, Dash mm to 16, Gap mm to 5, Variation to 0, Phase mm to 0 and Seed to 4. Connect Stroke’s purple output to Tracks’ purple Style input. Select Tracks again to see the dashes.",
        tip: "Stroke supplies a style, so it connects to a purple style input. Tracks applies that style and outputs blue paths. The dashes are actual separate path segments.",
        checkpoint: "The continuous loops are now broken into regular blue dashes."
      },
      {
        title: "Place triangles along the paths",
        body: "Connect Tracks’ blue output to Stamp’s Host path input. Leave Motif unwired. On Stamp choose Triangle in Motif (if unwired), set Spacing mm to 18, Size mm to 2.5, Size modulation to 0, Per-path variation to 1, Orientation to Along path and Angle ° to 0. Set Seed to 6727 and Motif pen to 3 · Green. Leave Keep motif colors off.",
        tip: "Spacing restarts on every input path. Because Stroke has split the loops into dashes, these triangles are placed on the dashes individually. To stamp along continuous loops, change Stroke’s Type to Solid.",
        checkpoint: "Select Stamp. Green triangles follow the direction of the blue dashes, though the blue host is still hidden if Include host path is off."
      },
      {
        title: "Keep both the host and the decoration",
        body: "Turn on Include host path in Stamp. The final result now contains the dashed loops and their triangles. Compare Orientation: Fixed keeps a common angle across the page; Along path turns motifs with each path; Perpendicular adds a quarter-turn. Return to Along path, select Stamp and press F for the Focus view shown below. Press Esc to return before exporting.",
        checkpoint: "With Stamp selected, you see blue dashes and green triangles together.",
        image: "assets/screenshots/stamp.png"
      },
      {
        title: "Save and export the complete pattern",
        body: "Return from Focus view with Esc if needed, then click Save to keep the editable patch. Select Stamp, click EXPORT SVG (laser / vector), then Download .svg. Selecting Tracks would export only the dashed loops; selecting Stroke would show a style sample instead of an exportable drawing.",
        tip: "The examples use the default pen palette. Pen numbers start at 0: 0 is Black, 1 Blue, 2 Red and 3 Green. Names and colours can be edited in Pens and may differ in your browser.",
        checkpoint: "The SVG contains both the host paths and the triangle motifs."
      }
    ],
    experiment: "Change Stroke’s Type to Solid and compare the rhythm of the stamps. Then try Stamp’s Size modulation at 0.5 while keeping Seed at 6727. Return to the same seed whenever you want to compare another control fairly.",
    troubleshooting: [
      { q: "The purple wire will not connect to Stamp.", a: "Stamp expects blue path inputs. Connect Stroke to Tracks’ Style input, then connect Tracks to Stamp’s Host path." },
      { q: "The blue loops disappeared.", a: "Turn on Include host path in Stamp. With it off, Stamp outputs only the motifs." },
      { q: "Changing Spacing mm has less effect than expected.", a: "Your host is split into short dashes. Stamp starts again at each dash, and keeps open-path endpoints. Try a Solid Stroke to see spacing along an entire loop." },
      { q: "Changing Seed does nothing to the triangles.", a: "Stamp’s Seed affects size variation. With Size modulation at 0, the motif sizes are constant. Tracks’ Seed separately controls the loop shapes." }
    ],
    next: "two-pen-composition"
  },
  {
    id: "two-pen-composition",
    number: "03",
    title: "Build a two-pen composition",
    summary: "Bring two independent branches together and keep control of the pen assigned to each one.",
    duration: "15–20 min",
    level: "Build your skills",
    nodeKeys: ["grid", "aaltoilu", "radat", "merge"],
    learn: ["Build independent branches in one patch", "Choose each generator’s Pen", "Combine branches without changing their pens", "Export the complete composition as an SVG grouped by pen"],
    prerequisite: "Know how to add and connect nodes. Your first Muusia drawing covers the Grid → Wave branch used here.",
    steps: [
      {
        title: "Start two independent branches",
        body: "Save your current work and Load the empty starter patch. Choose A4 wide from Size preset after loading, so the Canvas fields show 297 × 210 mm. Add four nodes: Grid, Wave, Tracks and Merge. Place Grid and Wave on the top row, Tracks below them, and Merge to the right.",
        tip: "A branch is a chain of connected nodes. Independent branches can make different parts of the same drawing."
      },
      {
        title: "Build the blue wave branch",
        body: "Set Grid to Vertical lines 0, Horizontal lines 24, Margin mm 24 and Resolution mm 2. Choose Pen 1 · Blue on Grid. Connect Grid’s blue output to Wave’s blue input. Set Wave to Amplitude mm 4, Wavelength mm 45 and Phase 0.",
        tip: "Choose a generator’s colour with its own Pen control. Wave preserves that assignment as it bends the paths.",
        checkpoint: "Selecting Wave shows a blue field of wavy horizontal lines."
      },
      {
        title: "Build the red loop branch",
        body: "On Tracks set Loops 12, Gap mm 6, Shape noise 4, Drift 2 and Seed 7. Choose Pen 2 · Red on Tracks. Leave its purple Style input empty so the loops stay continuous.",
        checkpoint: "Selecting Tracks shows twelve red loops on their own."
      },
      {
        title: "Merge both branches",
        body: "Set Merge’s Inputs to 2. Connect Wave’s blue output to Merge input 1 and Tracks’ blue output to input 2. Leave Pen change per input off, so Merge keeps the pens chosen on Grid and Tracks. Select Merge and press F for the Focus view shown below. Press Esc to return to the full workspace.",
        tip: "Merge collects paths together. It does not cut the loops at intersections, remove overlaps or blend ink colours.",
        checkpoint: "The main preview contains blue waves and red loops together.",
        image: "assets/screenshots/merge.png"
      },
      {
        title: "Check the pen assignments",
        body: "Select Wave and Tracks in turn to inspect their branches, then return to Merge. Check Grid’s Pen is 1 · Blue and Tracks’ Pen is 2 · Red. Open Pens if the colours differ from the example. Names and colours can be customised in your browser; the numbers identify the layers.",
        tip: "If you want the reference colours without resetting the whole palette, set pen 1 to #2A56A8 and pen 2 to #C23A30 in Pens.",
        checkpoint: "Each branch is on its intended pen, and Merge still has Pen change per input switched off."
      },
      {
        title: "Export the whole composition",
        body: "If Focus view is still open, press Esc to return. Click Save. Select Merge, click EXPORT SVG (laser / vector), then Download .svg. The SVG places each pen’s paths in its own group and uses the current palette colours. Open the file to confirm that both branches are present.",
        tip: "This lesson prepares a vector file. Physical plotting also needs your machine, paper, origin and pen settings configured for the hardware you use.",
        checkpoint: "Your saved patch can be edited again, and the SVG contains the complete two-pen composition."
      }
    ],
    experiment: "Change Grid’s Pen from 1 · Blue to 3 · Green. Wave carries that pen assignment through, so the waves turn green while Tracks’ loops stay red. Select Merge to inspect and export the complete variation.",
    troubleshooting: [
      { q: "Both branches changed colour when I connected Merge.", a: "Switch off Pen change per input. When enabled, Merge assigns input 1 to pen 0, input 2 to pen 1, and so on, replacing the branch assignments." },
      { q: "Only one branch appears in the exported file.", a: "Select Merge before exporting and verify that both numbered inputs have blue wires." },
      { q: "The palette looks different after loading a patch.", a: "Pen names and display colours are browser preferences and are not included in the patch file. Check the pen indices and the settings in Pens." }
    ],
    next: "export-two-colour-svg"
  },
  {
    id: "export-two-colour-svg",
    assetKey: "svg-workflow",
    number: "04",
    title: "Export a two-colour SVG set",
    summary: "Split a finished composition into one SVG per pen, keeping both colours aligned on the same page.",
    duration: "10–15 min",
    level: "Export workflow",
    nodeKeys: ["grid", "aaltoilu", "radat", "merge"],
    startMode: "example",
    graphScreenshot: "assets/screenshots/tutorial-two-pens.png",
    showOutputSteps: true,
    outputStepsTitle: "The drawing by pen",
    learn: ["Export the complete drawing from Merge", "Use Stack’s Pens mode to make separate colour files", "Match each file to a Muusia pen assignment", "Preserve page size and placement for aligned colour passes"],
    prerequisite: "Muusia open in a desktop browser and a way to open a ZIP archive and inspect SVG files. Use the completed patch from this page, or continue from Build a two-pen composition. This lesson prepares files; plotting follows your machine’s own software and setup instructions.",
    quickReference: [
      { label: "Selected output", value: "Merge; Inputs 2; Pen change per input off" },
      { label: "Canvas", value: "A4 wide · 297 × 210 mm" },
      { label: "Export route", value: "Stack → Pens → SVG .zip" },
      { label: "Physical export", value: "Sheet margin 0; Mirror off; Numbers off; Drill marks Off" },
      { label: "File order for this patch", value: "…-sheet01.svg = Pen 1 · Blue waves; …-sheet02.svg = Pen 2 · Red loops" },
      { label: "Registration", value: "Keep the same page size, viewBox, scale, orientation and drawing placement for both files" }
    ],
    steps: [
      {
        title: "Open the completed two-pen patch",
        body: "Save any work already open. Download this lesson’s example patch, click Load in Muusia and choose the downloaded .muusia.json file. Choose A4 wide from Size preset so the Canvas fields show 297 × 210 mm. Click Merge’s title to select it. If continuing from lesson 03, use the same canvas and select Merge.",
        tip: "Grid uses Pen 1 · Blue and feeds Wave, which connects to Merge input 1. Tracks uses Pen 2 · Red and connects to input 2. Merge’s Pen change per input stays off.",
        checkpoint: "Merge’s preview contains blue waves and red loops together."
      },
      {
        title: "Save the patch and a combined SVG",
        body: "Click Save to keep the editable patch. With Merge selected, click EXPORT SVG (laser / vector), then Download .svg. This file is a useful reference containing the whole composition. Its paths are grouped by pen and use the current palette colours.",
        tip: "Muusia’s regular SVG contains ordinary groups, not Inkscape layers. A coloured group alone does not make a selectable plotting layer or request a physical pen change. The next steps make one SVG per pen using the current app.",
        checkpoint: "The combined SVG contains both parts of the drawing on one 297 × 210 mm page."
      },
      {
        title: "Switch Stack to Pens",
        body: "Keep Merge selected and click Stack in the top bar. Stack initially opens in Frames mode; choose Pens. It now separates the selected output by the pens actually used in the drawing. Check the list for 1: Blue and 2: Red, or your customised names for those same indices.",
        image: "assets/screenshots/svg-stack.png",
        imageAlt: "Muusia Stack in Pens mode with blue waves and red loops listed as two separate sheets",
        imageCaption: "Stack → Pens splits the selected Merge output by pen. The 3D spacing is a preview effect; it does not move the exported artwork.",
        checkpoint: "Stack shows two sheets: one for the waves and one for the loops."
      },
      {
        title: "Keep the original page and placement",
        body: "In Stack’s Physical export section, set Sheet margin to 0 mm. Leave Mirror and Numbers off, and choose Off under Drill marks. These settings keep the drawing on its original page without adding marks or reflecting the paths.",
        image: "assets/screenshots/svg-stack-settings.png",
        imageAlt: "Muusia Stack with zero sheet margin, Mirror and Numbers off, Drill marks Off and the red sheet hidden in the preview; SVG export still includes both pens",
        imageCaption: "The Red sheet is hidden here only in the preview. SVG .zip still exports both pens. Keep the Physical export settings shown for aligned colour passes.",
        tip: "Sheet margin changes the page size and shifts the artwork inward. Mirror affects exported files even though Stack’s preview still shows the front view.",
        checkpoint: "The export keeps the 297 × 210 mm page and the same coordinates for both colours."
      },
      {
        title: "Download and identify the two SVGs",
        body: "Click SVG .zip and open the downloaded archive. The example produces Export a two-colour SVG set-sheet01.svg for Pen 1’s blue waves and Export a two-colour SVG set-sheet02.svg for Pen 2’s red loops. The prefix comes from the project name. Files follow ascending used pen indices: sheet01 means the first exported sheet, not necessarily pen 1.",
        tip: "Stack exports all sheets. Hiding one in the preview does not remove it from the ZIP. If a different patch uses pens 0 and 3, its sheet01 and sheet02 files correspond to those pens.",
        checkpoint: "You have two SVG files and know which drawing and physical pen each one represents."
      },
      {
        title: "Check that the colour files line up",
        body: "Open each SVG in an SVG editor or your plotting software and check the full page. Both files must remain 297 × 210 mm with the same viewBox, scale, orientation and artwork position. Compare their placement against the combined SVG. Keep those settings unchanged between colour passes; fitting or centring each colour separately would move the parts out of alignment.",
        tip: "Travel Sort leaves the visible drawing unchanged, but path order and direction can survive into SVG. The importing software may route the drawing again, so its plotting settings determine the final travel between strokes.",
        checkpoint: "The waves and loops occupy their original positions within identical page boundaries."
      },
      {
        title: "Prepare the handoff to your plotter",
        body: "For AxiDraw or NextDraw, use the manufacturer’s SVG workflow and setup instructions linked below. Assign the wave file to your blue pen and the loop file to your red pen. For separate passes, change the physical pen manually while keeping the paper fixed and retaining the same machine origin and document placement. SVG stroke colour is a reference; it does not automatically match or exchange physical pens.",
        tip: "If you prefer one file with selectable plotting layers, first convert the combined SVG’s pen groups into top-level Inkscape layers and name them according to the manufacturer’s layer-control instructions. This extra preparation is separate from Muusia’s current SVG export.",
        checkpoint: "The two colour files, their pen mapping and their common page placement are ready for your machine-specific plotting workflow."
      }
    ],
    experiment: "Change Grid’s Pen to 3 · Green while leaving Tracks on Pen 2 · Red, then select Merge and export a new set through Stack → Pens. Red is now the first used pen, so sheet01 contains the loops and sheet02 contains the green waves. Inspect the files before assigning physical pens.",
    troubleshooting: [
      { q: "The ZIP contains only one colour.", a: "Close Stack, select Merge and reopen Stack → Pens. Check that both branches reach Merge, Grid uses pen 1, Tracks uses pen 2 and Pen change per input is off." },
      { q: "I hid a sheet, but it is still in the ZIP.", a: "Sheet visibility changes only the Stack preview. The export always includes every sheet in the chosen mode." },
      { q: "Why are there many nearly identical files?", a: "Stack may still be in Frames mode. Choose Pens for one file per used pen; frame exports serve a different workflow." },
      { q: "The two colours no longer line up.", a: "Restore the same page dimensions, viewBox, orientation, scale and placement in both files. Keep Sheet margin at 0 and Mirror off, and avoid fitting each colour to its own bounds. On the machine, retain the same paper position and origin between passes." },
      { q: "Why can’t the plotter’s layer mode select a Muusia colour group?", a: "Regular Muusia SVG groups are not Inkscape layers. Use the separate per-pen files from this lesson, or prepare top-level Inkscape layers according to the manufacturer’s instructions." },
      { q: "The displayed colours differ from Blue and Red.", a: "Muusia’s palette is a browser preference. Check pen indices 1 and 2 in Pens and identify the wave and loop files visually; the physical pen choice remains yours." }
    ],
    sources: [
      { label: "AxiDraw: SVG plotting and layer selection", url: "https://axidraw.com/doc/cli_api/" },
      { label: "NextDraw: SVG plotting and layer selection", url: "https://bantam.tools/nd_cli/" },
      { label: "AxiDraw layer-control instructions", url: "https://wiki.evilmadscientist.com/AxiDraw_Layer_Control" },
      { label: "NextDraw layer-control instructions", url: "https://support.bantamtools.com/hc/en-us/articles/29473928061971-NextDraw-Layer-Control" }
    ],
    next: "transform-crop-fill"
  },
  {
    id: "transform-crop-fill",
    assetKey: "transform-fill",
    number: "05",
    title: "Transform, crop and fill shapes",
    summary: "Flatten and turn an organic outline, fill it with lines, then crop the result into a clean rectangular frame.",
    duration: "15–20 min",
    level: "Build your skills",
    nodeKeys: ["radat", "move_scale", "kierto", "hatch", "container"],
    startMode: "blank",
    graphScreenshot: "assets/screenshots/tutorial-transform-fill.png",
    showOutputSteps: true,
    outputStepsTitle: "Drawing stages",
    learn: ["Scale width and height independently", "Choose the pivot for a rotation", "Fill a closed outline with drawable strokes", "Crop the filled drawing without losing its hatching"],
    prerequisite: "Know how to add nodes, connect blue path ports and select an output. Start with the blank A4 patch, or load the completed example and inspect the same chain one node at a time.",
    quickReference: [
      { label: "Chain", value: "Tracks → Move / Scale → Rotate → Hatch Fill → Container" },
      { label: "Tracks", value: "Loops 1; Gap mm 6; Shape noise 8; Drift 0; Seed 7; Pen 1 · Blue" },
      { label: "Move / Scale", value: "Move X 20 mm; Move Y -5 mm; Scale 70%; Scale Y 45%; origin Content center" },
      { label: "Rotate", value: "Angle 25°; Per path on; Progressive off" },
      { label: "Hatch Fill", value: "Inside shapes; Angle 90°; Spacing 2.5 mm; Inset 0; Cross hatch off; Keep outlines and Keep shape colors on" },
      { label: "Container", value: "Rectangle; centre 148.5, 105 mm; size 150 × 90 mm; Rotate 0°; Inside; Gap 0; Draw region on; Region pen 0 · Black" }
    ],
    steps: [
      {
        title: "Start with one closed outline",
        body: "Save any work already open. Download the blank A4 starter, click Load and choose blank.muusia.json. Choose A4 wide from Size preset so the Canvas fields show 297 × 210 mm. Use N to add Tracks. Set Loops to 1, Gap mm to 6, Shape noise to 8, Drift to 0 and Seed to 7. Choose Pen 1 · Blue and leave the Style input empty.",
        tip: "A closed path joins its last point back to its first. That enclosed boundary gives Hatch Fill an area to fill later. One Tracks loop keeps the first example easy to read.",
        checkpoint: "Selecting Tracks shows one continuous blue organic outline."
      },
      {
        title: "Flatten and position the shape",
        body: "Add Move / Scale and connect Tracks’ blue output to its blue input. Choose Scale origin Content center. Set Scale % to 70, Scale Y % (0 = same) to 45, Move X mm to 20 and Move Y mm to -5. Select Move / Scale to inspect the result.",
        image: "assets/screenshots/move_scale.png",
        imageAlt: "Muusia Move / Scale with 70 percent width, 45 percent height and offsets of 20 and minus 5 millimetres",
        imageCaption: "Independent width and height scales flatten the outline; the Move controls position it afterward.",
        tip: "Scale Y 0 means use Scale % for both axes. Here 45 means 45% of the original height, while Scale 70 controls the width.",
        checkpoint: "The outline is narrower and flatter, with its centre moved right and slightly upward."
      },
      {
        title: "Turn the outline around its own centre",
        body: "Add Rotate after Move / Scale. Set Angle ° to 25, turn Per path (centroid) on and leave Progressive (Molnár) off. Select Rotate and compare its output with Move / Scale.",
        image: "assets/screenshots/kierto.png",
        imageAlt: "Muusia Rotate turning the transformed blue outline by 25 degrees with Per path enabled and Progressive disabled",
        imageCaption: "Per path turns this outline around its own point average. With it off, the pivot would be the canvas centre.",
        tip: "Per path uses the average of the stored points, not an area-weighted centre. Progressive stays off: with only one path, its first-path angle would be zero.",
        checkpoint: "The flattened outline is tilted and remains a closed blue path."
      },
      {
        title: "Fill the closed shape before cropping",
        body: "Add Hatch Fill and connect Rotate to it. Set Region to Inside shapes, Angle ° to 90, Spacing mm to 2.5 and Inset from edge mm to 0. Leave Cross hatch off; keep Keep outlines and Keep shape colors on. Select Hatch Fill to see the strokes inside the tilted outline.",
        image: "assets/screenshots/hatch.png",
        imageAlt: "Muusia Hatch Fill producing vertical blue strokes inside the rotated closed outline at 2.5 millimetre spacing",
        imageCaption: "The closed outline defines the fill area. Keep shape colors gives the new hatch strokes its blue pen.",
        tip: "Fill first. Cutting a closed outline at a crop boundary produces open pieces that cannot define the same fill area. Keep shape colors also means Hatch pen is not used for these strokes.",
        checkpoint: "The result contains the blue outline and 64 vertical blue hatch strokes."
      },
      {
        title: "Crop the filled drawing into a frame",
        body: "Add Container and connect Hatch Fill to Content. Leave Region (closed) unwired and choose Shape Rectangle. Set Center X mm to 148.5, Center Y mm to 105, Rect W mm to 150, Rect H mm to 90 and Rotate ° to 0. Choose Keep Inside and Gap mm (+grow / -shrink) 0. Enable Draw region and choose Region pen 0 · Black. Select Container.",
        image: "assets/screenshots/container.png",
        imageAlt: "Muusia Container cropping blue hatch strokes and their outline to a 150 by 90 millimetre rectangle with a black frame",
        imageCaption: "Container cuts the finished blue linework. Draw region adds a separate drawable frame; the editing guide itself is not exported.",
        tip: "Draw region adds the rectangle as another closed path. It does not close the pieces cut from the original outline. Gap 0 keeps the crop boundary aligned with the drawn frame.",
        checkpoint: "The top, bottom and right edges of the blue shape are cropped, and a black rectangular frame surrounds the result."
      },
      {
        title: "Read the chain from shape to finished drawing",
        body: "Select Rotate, then Hatch Fill, then Container. Rotate still holds the complete closed outline; Hatch Fill adds the interior strokes; Container trims both the strokes and the outline. The cropped blue pieces are open paths, while the added black frame is closed. Press F on the selected node for a larger Focus preview, then Esc to return.",
        tip: "To experiment with a different order, save a copy first. Cropping the outline before Hatch Fill can remove its closed state. Enabling Draw region creates a new fillable rectangle, not a repaired version of the cropped shape.",
        checkpoint: "Each selected node shows a distinct stage, and the final hatch pattern comes from filling before clipping."
      },
      {
        title: "Save and export the final crop",
        body: "Press Esc if Focus view is open, then click Save to keep the editable patch. Select Container, click EXPORT SVG (laser / vector), then Download .svg. Open the SVG and check that it contains the cropped blue linework and the black rectangle on a 297 × 210 mm page.",
        tip: "Selecting Hatch Fill would export the uncut filled shape. The selected output determines which stage you export; preview guides are not additional SVG paths.",
        checkpoint: "Your saved patch preserves all five stages, and the SVG contains the finished framed composition."
      }
    ],
    experiment: "Keep the chain order and change one setting at a time: try Hatch Fill’s Spacing mm at 5, enable Cross hatch, or turn Container’s Draw region off. For a different window, choose Container Shape Circle, set Circle / Triangle R mm to 55 and keep the same centre. The Hatch Fill and Container guides below explain how the resulting paths differ.",
    troubleshooting: [
      { q: "The cropped shape has no hatch fill.", a: "Check the order is Rotate → Hatch Fill → Container. A partly cropped outline is open, so placing Hatch Fill afterward cannot fill that original area." },
      { q: "The shape does not rotate.", a: "Turn Progressive (Molnár) off and check Angle ° is 25. Progressive applies zero rotation to the first path, which is the only path in this example." },
      { q: "Container leaves the full shape visible.", a: "Choose Shape Rectangle. Wired region with no valid closed input passes the content through unchanged. Confirm Hatch Fill is connected to Content, and select Container to preview its result." },
      { q: "Changing Hatch pen does not change the fill colour.", a: "Keep shape colors is on, so Hatch Fill uses the source outline’s pen. Turn it off if you want the new hatch strokes to use Hatch pen." },
      { q: "The rectangle and crop edge no longer match.", a: "Return Gap mm to 0. Gap changes the clipping region, while Draw region adds the original rectangle." },
      { q: "More Tracks loops create unexpected unfilled bands.", a: "Hatch Fill uses an even-odd rule across the closed outlines. Nested boundaries alternate filled and unfilled areas; the loops are not filled independently." }
    ],
    next: "control-with-numbers"
  },
  {
    id: "control-with-numbers",
    assetKey: "numbers",
    number: "06",
    title: "Control a patch with numbers",
    summary: "Give a wave pattern one main control, multiply its value, then add a repeatable random variation.",
    duration: "15–20 min",
    level: "Build your skills",
    nodeKeys: ["grid", "aaltoilu", "arvo", "matem", "satunnainen"],
    startMode: "blank",
    graphScreenshot: "assets/screenshots/tutorial-numbers.png",
    showOutputSteps: true,
    outputStepsTitle: "Compare the same control chain",
    learn: ["Connect a number to a specific control", "Combine two numbers with Math", "Use a seed to reproduce a Random value", "Recognise wired values and unused fallback settings"],
    prerequisite: "Know how to add nodes and connect blue path ports. This lesson uses the Grid → Wave drawing from lesson 01. Start with the blank A4 patch, or load the complete example and inspect the connections.",
    quickReference: [
      { label: "Drawing chain", value: "Grid → Wave; export Wave" },
      { label: "Numeric chain", value: "Value → Math A; Random → Math B; Math → Wave Amplitude mm" },
      { label: "Grid", value: "Vertical lines 0; Horizontal lines 24; Margin 24 mm; Resolution 2 mm; Pen 1 · Blue" },
      { label: "Wave", value: "Wavelength 45 mm; Phase 0; Amplitude controlled by Math" },
      { label: "Number settings", value: "Value 4; Math Operation A × B; Random Min 1, Max 2, Seed 11" },
      { label: "Expected result", value: "Random about 1.63; Math and Wave Amplitude about 6.54. Calculations use the full values behind the rounded display." }
    ],
    steps: [
      {
        title: "Build a blue wave pattern",
        body: "Save any work already open. Download the blank A4 starter, click Load and choose blank.muusia.json. Choose A4 wide from Size preset for a 297 × 210 mm canvas. Add Grid and Wave, then connect Grid’s blue output to Wave’s blue input. On Grid set Vertical lines 0, Horizontal lines 24, Margin mm 24, Resolution mm 2 and Pen 1 · Blue. On Wave set Amplitude mm 4, Wavelength mm 45 and Phase 0.",
        checkpoint: "Selecting Wave shows 24 blue wavy lines."
      },
      {
        title: "Give amplitude its own Value control",
        body: "Add Value and set its Value field to 4. Drag its green output to the small green port beside Wave’s Amplitude mm control. Keep the blue Grid → Wave connection in place. Select Wave, change Value to 8 to see deeper waves, then return Value to 4.",
        tip: "The green wire carries a number. Amplitude mm gives that number its meaning: here 4 means a 4 mm amplitude. Wave’s blue input still needs the paths from Grid.",
        checkpoint: "Wave’s Amplitude field shows 4 and becomes disabled; editing Value now changes the drawing."
      },
      {
        title: "Multiply the number with Math",
        body: "Add Math. Choose Operation A × B and set B (if unwired) to 2. Connect Value’s green output to the green input labelled A near the top of Math’s card. Connect Math’s output to Wave’s Amplitude mm port; this replaces Value’s direct connection to that control. Keep Value at 4 and select Wave.",
        image: "assets/screenshots/matem.png",
        imageAlt: "Muusia Value set to 4 feeding Math A, with multiplication by an unwired B value of 2 controlling Wave amplitude at 8",
        imageCaption: "Math uses the wired A value and the unwired B setting. Its result controls Wave’s Amplitude mm.",
        checkpoint: "Math outputs 8, and Wave’s disabled Amplitude field also shows 8."
      },
      {
        title: "Use a repeatable random multiplier",
        body: "Add Random. Set Min to 1, Max to 2 and Seed to 11. Connect its green output to Math’s input labelled B near the top of the card. Random now supplies the multiplier instead of B (if unwired). Select Wave to inspect the final drawing.",
        tip: "Random produces one number for the node. With the same Min, Max and Seed, it produces the same result again. It does not generate a different number for every path or automatically change over time.",
        checkpoint: "Random displays about 1.63; Math and Wave’s Amplitude display about 6.54. The calculation uses the full numbers, not the rounded display."
      },
      {
        title: "Check which settings are in control",
        body: "Math’s A and B inputs now receive numbers from Value and Random. Its A (if unwired) and B (if unwired) fields remain editable, but those fallback values are not used while the corresponding labelled inputs are wired. Wave’s Amplitude control behaves differently: its own parameter port is wired, so its manual field is disabled. Change the source number to change the result.",
        tip: "Use Math’s labelled A and B inputs for this lesson. The small green ports beside the fallback fields control those fallback settings themselves; they are separate connections.",
        checkpoint: "You can trace the active values from Value and Random through Math to Wave’s amplitude."
      },
      {
        title: "Compare changes you can reproduce",
        body: "Keep Random at Min 1, Max 2 and Seed 11. Try Value at 2, 4 and 8. Wave’s amplitude becomes about 3.27, 6.54 and 13.07 mm while the random multiplier stays the same. Return Value to 4. Change Random’s Seed to 12, then back to 11 to recover the same multiplier and drawing.",
        tip: "A seed identifies a repeatable variation. Keep the range and seed fixed when comparing another control, and restore all three settings to reproduce the same Random result.",
        checkpoint: "With Value 4 and Seed 11 restored, Wave’s Amplitude is about 6.54 again."
      },
      {
        title: "Save the controls and export the drawing",
        body: "Click Save to keep the nodes, wires, numeric settings and seed in an editable patch. Select Wave, click EXPORT SVG (laser / vector), then Download .svg. After loading the patch again, select Wave to see the same drawing. Selecting Value, Random or Math shows a number rather than exportable paths.",
        tip: "Numbers do not automatically acquire units or stay within a destination slider’s range. Choose values appropriate for the receiving control; the connected amplitude is not limited by Wave’s manual slider range.",
        checkpoint: "The saved patch preserves the control chain, and the SVG contains Wave’s blue paths."
      }
    ],
    experiment: "Set Random’s Min and Max both to 1. It becomes a fixed multiplier, so Wave’s amplitude equals Value exactly. Restore Min 1 and Max 2, then compare Math’s A + B and A × B operations with Value 4 and Seed 11 unchanged. Return Operation to A × B to match the example.",
    troubleshooting: [
      { q: "The green wire will not connect to Wave’s main input.", a: "That blue input accepts paths. Connect the numeric output to the small green port beside Amplitude mm, and keep Grid connected to the blue input." },
      { q: "Wave’s Amplitude slider is disabled.", a: "That is expected when its parameter port is wired. Change Value, Random or Math upstream. Removing the parameter connection restores the saved manual amplitude setting." },
      { q: "Math’s fallback fields are editable, but they do nothing.", a: "The labelled A and B inputs override the corresponding A (if unwired) and B (if unwired) settings. Edit the connected source nodes; those fallback fields are used only when the corresponding input is not supplying a number." },
      { q: "Random stays the same when I select another node or preview a frame.", a: "Random depends on Min, Max and Seed. Re-evaluation alone does not change its output. Change one of those settings to choose another result." },
      { q: "Why does 4 times the displayed 1.63 not exactly equal 6.54?", a: "The display rounds the numbers. Random’s full result is about 1.634068, and Math uses that full value, giving about 6.536273 before display rounding." },
      { q: "The preview shows only a number and export is disabled.", a: "Select Wave. Value, Random and Math produce numbers; Wave uses those numbers to produce the drawing paths." }
    ],
    next: "first-physical-plot"
  },
  {
    id: "first-physical-plot",
    assetKey: "physical-plot",
    number: "07",
    title: "Prepare your first physical plot",
    summary: "Use a small reference drawing to check scale, orientation and pen lifts, with separate preparation routes for SVG and G-code.",
    duration: "20–30 min preparation",
    level: "From screen to paper",
    nodeKeys: ["container", "grid", "move_scale", "merge"],
    startMode: "example",
    graphScreenshot: "assets/screenshots/tutorial-physical-plot.png",
    overviewImage: "assets/details/physical-plot.svg",
    overviewCaption: "Close view: the square is 20 × 20 mm on a 297 × 210 mm page. Coloured measurement labels explain the test and are not included in the exported drawing.",
    validationNote: "Software checks completed; physical plot pending. The example geometry and exports have been checked in software. No machine model or physical pen test has been verified for this lesson; the machine setup shown is an illustration, not a calibrated device preset.",
    learn: ["Separate document size from the machine’s usable work area", "Choose SVG or a compatible G-code workflow", "Prepare a named machine profile when using Muusia G-code", "Check a physical test for scale, orientation and clean pen-up moves"],
    prerequisite: "Use the prepared example; no new nodes need to be built. You can complete the software preparation without a connected machine. For the physical stages, use your plotter’s setup instructions, its supported software, one pen, paper and a ruler. Machine calibration time is separate from this lesson.",
    quickReference: [
      { label: "Selected output", value: "Merge; five paths on Pen 0 · Black" },
      { label: "Document", value: "A4 wide; 297 × 210 mm; export and plot at 1:1" },
      { label: "Reference drawing", value: "20 × 20 mm square; right-pointing triangle; three separate horizontal lines" },
      { label: "Artwork bounds", value: "Canvas X 20–79.7 mm; Y 20–60.5 mm, before machine placement or axis conversion" },
      { label: "SVG route", value: "Step 5, then steps 8–9. Machine placement, pen lift and speed are set in the plotter’s supported software." },
      { label: "G-code route", value: "Steps 6–7, then steps 8–9. Verify controller compatibility and every active machine setting; the supplied A/B profiles are examples." },
      { label: "G-code units", value: "Work area, origin and bed Z: mm. Draw F, Travel F and Z feed F: mm/min. Servo angles: degrees. Settling delays: ms." },
      { label: "Physical checks", value: "Square measures 20 mm both ways; marker orientation matches the preview; gaps between strokes remain unmarked." }
    ],
    steps: [
      {
        title: "Choose the route your machine supports",
        body: "Use the SVG route when your plotting software accepts SVG, including the manufacturer’s AxiDraw or NextDraw workflow. Use the G-code route only with a controller whose commands and pen-lift mechanism match Muusia’s output. Its current machine setup is oriented towards custom Klipper configurations; A and B are not universal plotter presets. Complete steps 2–4, then follow step 5 for SVG or steps 6–7 for G-code. Both routes finish at steps 8–9.",
        checkpoint: "You know which software will receive the exported file and which route applies to your machine."
      },
      {
        title: "Load the prepared test drawing",
        body: "Save your current work, download the complete example from this page, then click Load in Muusia and open the downloaded patch. Choose A4 wide from Size preset so the Canvas fields show 297 × 210 mm. Select Merge. Two Container nodes supply the square and triangle; Grid → Move / Scale supplies three short lines. Merge combines them with Pen change per input off. All paths use Pen 0 · Black.",
        tip: "The Container nodes have Draw region enabled, so their built-in shapes become drawable paths even with Content empty. Use Expand (▢) on either collapsed Container card to inspect its settings. Keep the prepared geometry unchanged for this first test.",
        checkpoint: "The preview contains one square, a triangle pointing right and three separate horizontal lines."
      },
      {
        title: "Match the page to the available work area",
        body: "The 297 × 210 mm canvas is the document page. The machine’s work area is the region its pen can actually reach, and the paper is the physical sheet inside it. Check the page placement against your machine’s documented limits. This drawing occupies only X 20–79.7 mm and Y 20–60.5 mm on the canvas, but that alone does not prove that the whole page, setup moves or machine origin are suitable.",
        tip: "Keep the artwork at 1:1. If you need a different document size or placement, check the revised preview and export again: Grid depends on the canvas dimensions, so changing the canvas can change the three test lines.",
        checkpoint: "The chosen paper and intended pen movements fit the usable area without scaling the 20 mm square."
      },
      {
        title: "Inspect the strokes and the spaces between them",
        body: "With Merge selected, compare the preview with the close view above. The square and triangle are closed outlines; the three lines are separate open paths. Press F for Focus view, then choose Simulate and enable Travel to see movement between strokes. Those travel links represent pen-up motion, not marks to draw. This is a path animation, not a simulation of the generated G-code or the physical machine. Press Esc to return before continuing with your chosen export route.",
        checkpoint: "There are five drawing paths, with clear spaces between the shapes and between all three horizontal lines."
      },
      {
        title: "SVG route — hand off a drawing at its actual size",
        body: "Select Merge, click EXPORT SVG (laser / vector), then Download .svg. Open the file in the software recommended for your exact plotter. Preserve its millimetre size and use 100% or 1:1 scale; avoid fitting the artwork to the page. Confirm that the square is 20 × 20 mm and that the triangle’s orientation and the job placement match your intended paper layout. Configure pen lift, speed and the machine origin in that plotting software. Continue at step 8.",
        tip: "Muusia’s Machine Setup origin and Flip Y settings are not applied to this SVG. The reference SVG download below contains the same test geometry. Stroke colour does not automatically select or exchange a physical pen.",
        checkpoint: "The plotting software shows the test at its intended size and position, ready for its documented machine setup."
      },
      {
        title: "G-code route — create a profile for the verified setup",
        body: "Open MACHINE SETUP. Click +, labelled Add machine (copies current), then give the copy a distinct Machine name. Enter the verified Work area W mm and Work area H mm for your setup. Set Origin X mm (canvas on bed) and Origin Y mm (canvas on bed) to the intended page placement. Choose Flip Y (machine Y up) according to the controller’s coordinate system. Review the page-on-bed diagram and resolve any fit warning before continuing.",
        image: "assets/screenshots/machine-setup.png",
        imageAlt: "Muusia Machine Setup with profile selection, work area, canvas origin, axis direction and pen-lift settings",
        imageCaption: "The real Machine Setup controls. Displayed values belong to an example profile and have not been calibrated for your plotter.",
        tip: "Copying a profile also copies its start and end commands and optional features. Renaming it does not make those settings correct for another machine.",
        checkpoint: "The copied profile has a clear name, verified work dimensions and an intentional page position and Y-axis convention."
      },
      {
        title: "G-code route — verify the lift commands and save the file",
        body: "Choose the verified Z MODE: A — Servo lifts the pen or B — Bed Z lifts the pen. Set the corresponding lift/contact values, Draw F, Travel F and settling delays from your calibrated setup. Review Pause command, START G-CODE, END G-CODE and every enabled optional feature. Servo mode emits Klipper SET_SERVO commands; bed mode uses G1 Z moves. These commands and the lifting scheme must match the controller and mechanism. Use ⇡ to export the profile, click Save for the patch, then select Merge and choose GENERATE G-CODE (selected node). Inspect the generated commands, then click Download .gcode.",
        image: "assets/screenshots/physical-export-gcode.png",
        imageAlt: "Muusia’s generated G-code preview for the five-path test using a profile named Learn — example only",
        imageCaption: "A local demonstration export. Its five drawing paths and pen-up moves were checked in the generated text; the profile values are not calibration instructions and no machine was run.",
        tip: "Check the start commands explicitly: a copied default may contain G28 homing. Generating or downloading the file does not run it. Bounds warnings are checks on the generated text, not a guarantee that the machine will prevent an unsuitable move.",
        checkpoint: "The profile is saved separately, and the reviewed G-code matches the actual controller, pen mechanism and intended job bounds."
      },
      {
        title: "Run the small test through your machine’s normal workflow",
        body: "Once your machine setup is verified, secure the paper and install one pen using its manufacturer’s instructions. Confirm the pen can lift clear of the paper and make contact correctly. Use the machine’s documented workflow to load and run the reviewed SVG job or G-code file. Keep the paper fixed throughout. This physical step is performed on your own setup; Muusia’s preview and this guide do not confirm that it has happened.",
        checkpoint: "Your physical result contains the square, the orientation marker and three separate lines on the intended part of the paper."
      },
      {
        title: "Measure the result before moving on",
        body: "Measure the square’s width and height: both should be 20 mm. Compare the triangle’s orientation and the drawing’s position with the preview. Check that the three horizontal lines are separate and that no unintended ink joins any of the five paths. Record the machine model, software, profile or export settings and the observed result. Correct any scale, placement or pen-lift issue, then repeat this same small drawing before moving to a larger job.",
        checkpoint: "A measured physical test confirms scale, orientation, placement and clean pen-up gaps on your particular machine."
      }
    ],
    experiment: "After the one-pen test passes, follow Export a two-colour SVG set (lesson 04) to try separate colour passes. Keep the paper fixed and preserve the same origin, scale and document placement while changing the physical pen manually. An SVG colour is a label for the intended pen, not an automatic colour-matching instruction.",
    troubleshooting: [
      { q: "The square is not 20 mm across.", a: "Check the imported SVG’s units and dimensions, then remove any fit-to-page or artwork scaling in the plotting software. For G-code, verify the start commands use the intended units. If the file is correctly sized, check the machine’s calibration using its own instructions." },
      { q: "The triangle points the wrong way or the drawing is misplaced.", a: "Compare the imported preview with the reference before plotting again. For SVG, check orientation and placement in the plotting software. For G-code, check the profile’s Origin X/Y and Flip Y against the actual machine coordinates. Changing those Muusia profile fields does not change the reference SVG." },
      { q: "Ink connects the shapes or horizontal lines.", a: "Those spaces should contain pen-up travel only. Check the supported plotting software’s lift settings, or the G-code profile’s lift/contact commands and settling times. Use your machine’s documented pen setup; changing the drawn paths will not repair an incorrect lift." },
      { q: "The machine does not recognise a generated command.", a: "Verify the controller and configured macros against the generated file before running it. Muusia’s current servo output uses Klipper SET_SERVO, and enabled options can add other machine-specific commands. Use the supported SVG route if that is the workflow provided for your plotter." },
      { q: "The drawing is small, but Muusia warns that the canvas exceeds the work area.", a: "The page and artwork have different bounds. Check the real page placement, usable area and every planned move. A small drawing does not validate a copied profile or a larger page; any document change needs a fresh geometry and export check." },
      { q: "Does the reference file prove the machine setup works?", a: "No. The supplied geometry and export are checked in software. A successful physical test requires the measured result from your own machine, paper and pen." }
    ],
    sources: [
      { label: "AxiDraw: official SVG plotting documentation", url: "https://axidraw.com/doc/cli_api/" },
      { label: "NextDraw: official SVG plotting documentation", url: "https://bantam.tools/nd_cli/" },
      { label: "Klipper: supported G-code and servo commands", url: "https://www.klipper3d.org/G-Codes.html" }
    ],
    next: null
  }
];

export const nodeGuides = {
  grid: {
    summary: "Make evenly spaced straight lines across the canvas. Grid is a clear starting point for learning how modifiers change paths.",
    useWhen: "You need a regular background, parallel lines to deform, or a simple test drawing with predictable spacing.",
    recipe: ["Load the example patch, or add Grid on a 297 × 210 mm canvas.", "Set Vertical lines to 0, Horizontal lines to 24, Margin mm to 24 and Resolution mm to 2.", "Select Grid to inspect the straight lines. Connect its blue output to Wave when you are ready to bend them."],
    controls: [
      { name: "Vertical lines / Horizontal lines", text: "These are counts, not spacing values. Zero disables that direction. One line sits at the centre; two or more span the area between the margins." },
      { name: "Margin mm", text: "Insets the line endpoints and outermost lines from the canvas edges. It leaves room for later modifiers to move the drawing." },
      { name: "Resolution mm", text: "Controls the distance between points along each straight line. Smaller values add points without adding more lines. The difference becomes useful when a downstream node moves those points." },
      { name: "Pen", text: "Assigns all grid paths to one pen. The default index 0 is Black; the palette can be customised." }
    ],
    portNotes: "The purple Style input is optional. Connect Stroke there for dashed or dotted paths. The blue output carries the generated paths. Green ports beside numeric controls accept values.",
    comparisonIntro: "Change the line counts to alter the structure. Wave can then change the shape while keeping the same Grid settings.",
    pitfalls: [
      { q: "Why is the output empty?", a: "At least one of the two line counts must be greater than zero." },
      { q: "Why do I see the original grid after connecting Wave?", a: "Grid remains unchanged. Select Wave to see its modified output." },
      { q: "Why does a very large margin behave strangely?", a: "Keep the margin below half the smaller canvas dimension. Grid uses the entered dimensions directly." }
    ],
    related: ["aaltoilu", "viiva", "arvo", "matem"],
    tutorials: ["first-drawing", "two-pen-composition", "export-two-colour-svg", "control-with-numbers", "first-physical-plot"]
  },
  aaltoilu: {
    summary: "Bend existing paths into waves. The displacement follows each path’s local direction, so straight lines, curves and loops all respond differently.",
    useWhen: "You want a flowing line field, rippled contours or a repeatable deformation of an existing drawing.",
    recipe: ["Load the example patch with its Grid → Wave connection.", "Set Amplitude mm to 4, Wavelength mm to 45 and Phase to 0.", "Select Wave to see the result. Select Grid briefly to compare the source, then return to Wave before exporting."],
    controls: [
      { name: "Amplitude mm", text: "The maximum offset to either side of the source path. At 0, there is no wave displacement. Start small to keep neighbouring lines from colliding." },
      { name: "Wavelength mm", text: "The distance travelled along a path for one complete wave. Smaller values create more tightly packed waves." },
      { name: "Phase", text: "Shifts the wave cycle without changing its height or wavelength. This is an angle in radians: roughly 6.28 makes one complete cycle." }
    ],
    portNotes: "Connect blue paths to the blue input. Wave preserves pen assignments. Its green parameter ports can receive Value or Frame-driven numbers.",
    comparisonIntro: "Keep Wavelength mm fixed and compare Amplitude mm 0, 4 and 8. Then keep amplitude fixed and compare different wavelengths.",
    pitfalls: [
      { q: "Why does an unconnected Wave show nothing?", a: "Wave modifies incoming paths; it does not generate its own. Connect a generator such as Grid." },
      { q: "Why can a closed loop have a noticeable seam?", a: "Each path starts its wave cycle from its own beginning. A loop whose length does not fit a whole number of wavelengths can meet at different offsets." },
      { q: "Why did the waves move beyond my original margin?", a: "Wave can displace a path by its amplitude. Leave enough space in the source drawing, or reduce the amplitude." }
    ],
    related: ["grid", "arvo", "satunnainen", "matem", "frame"],
    tutorials: ["first-drawing", "two-pen-composition", "export-two-colour-svg", "control-with-numbers"]
  },
  radat: {
    summary: "Generate nested, slightly irregular loops. Shape noise and drifting centres turn a regular ring pattern into an organic contour drawing.",
    useWhen: "You need a contour-like centrepiece, a host for stamps, or smooth loops to style and combine with another branch.",
    recipe: ["Use a 297 × 210 mm canvas and add Tracks.", "Set Loops 12, Gap mm 6, Shape noise 4, Drift 2 and Seed 7. Choose Pen 1 · Blue.", "Select Tracks. For dashes, connect a Stroke output to its purple Style input."],
    controls: [
      { name: "Loops", text: "The requested number of loops, generated from the outside inward. Generation stops when a remaining loop would be too small, so not every count fits every gap and canvas." },
      { name: "Gap mm", text: "The step inward between successive base rings. It is not a guarantee of exact distance between the final irregular curves." },
      { name: "Shape noise", text: "Changes the radius around each loop. At 0 the loops become regular ovals; higher values create stronger bulges." },
      { name: "Drift", text: "Offsets the centres of inner loops. It changes how the loops nest without moving the whole drawing as a unit." },
      { name: "Seed", text: "Chooses the noise pattern. Keep it fixed while comparing other controls; reuse it with the same settings to reproduce a result." },
      { name: "Pen", text: "Sets the pen for the generated paths. The default index 1 is Blue." }
    ],
    portNotes: "Tracks generates closed paths without a required input. Its optional purple Style port accepts Stroke style; a dashed style splits those loops into open segments.",
    comparisonIntro: "Hold Seed at 7 to isolate the effect of Shape noise. A different seed changes the particular pattern as well as its appearance.",
    pitfalls: [
      { q: "Why are there fewer loops than I requested?", a: "The available radius has run out. Reduce Gap mm or use a larger canvas." },
      { q: "Why do loops cross or extend past the page?", a: "Shape noise and Drift can move them beyond their base shape. Reduce these values or scale the result before export." },
      { q: "Why does Stamp see lots of small paths?", a: "A connected Dashed Stroke has already split the loops into dashes. Use Solid if you want continuous host loops." }
    ],
    related: ["viiva", "stamp", "setpen"],
    tutorials: ["style-and-stamp", "two-pen-composition", "export-two-colour-svg", "transform-crop-fill"]
  },
  viiva: {
    summary: "Describe a solid, dashed, dotted or dash-dot stroke. A compatible generator applies the style to its own paths.",
    useWhen: "You want rhythm and gaps along a generator’s lines, with the gaps represented in the actual exported geometry.",
    recipe: ["Load the example patch, which connects Stroke to Grid on a 297 × 210 mm canvas. Grid has 14 horizontal lines, no vertical lines and a 24 mm margin.", "On Stroke choose Type Dashed, Dash mm 16, Gap mm 5, Variation 0, Phase mm 0 and Seed 4. Its purple output connects to Grid’s Style input.", "Select Grid to see and export the styled drawing. Selecting Stroke alone shows a style sample. The tutorial applies the same idea to Tracks."],
    controls: [
      { name: "Type", text: "Solid leaves paths intact. Dashed creates separated strokes. Dots uses very short drawn segments. Dash-dot alternates a dash with a short dot segment." },
      { name: "Dash mm / Gap mm", text: "Set drawn dash length and the gap after each mark. Dash mm does not change the short dot length in Dots mode; Gap mm still controls their separation." },
      { name: "Variation", text: "Adds seeded variation to dash lengths and gaps. Keep it at 0 for regular spacing; increase it for a less mechanical rhythm." },
      { name: "Phase mm", text: "Offsets the first mark from the beginning of each path. A large offset can hide a path that is shorter than the offset." },
      { name: "Seed", text: "Selects the random variation pattern. With Variation at 0, changing Seed has no visible effect." }
    ],
    portNotes: "Stroke outputs purple style data, not blue paths. Connect it to a Style input on a compatible generator. The preview sample is illustrative and is not the generator’s final drawing.",
    comparisonIntro: "Compare styles on the same Grid geometry. The geometry and seed stay fixed so the rhythm is the only change.",
    pitfalls: [
      { q: "Why can’t I export the selected Stroke node?", a: "Its output is a style. Select the generator that consumes it, or the final downstream path node." },
      { q: "Why can’t I connect it to Wave?", a: "Wave expects paths, not a style. Apply Stroke at a compatible generator such as Grid or Tracks, then pass that generator’s paths to Wave." },
      { q: "Why did later decoration change?", a: "Dashes are separate open paths. Nodes such as Stamp start their work again on each individual dash." }
    ],
    related: ["grid", "radat", "stamp"],
    tutorials: ["style-and-stamp"]
  },
  stamp: {
    summary: "Place repeated motifs along incoming paths. Use a built-in shape or connect your own drawing as the motif.",
    useWhen: "You want beads around a contour, small marks along lines, or a repeating custom symbol that follows a path.",
    recipe: ["Load the example patch and select Stamp. Tracks feeds Host path; Motif is left unwired.", "Choose Triangle, Spacing mm 18, Size mm 2.5, Orientation Along path and Angle ° 0. Keep Size modulation 0 and Seed 6727.", "Enable Include host path, leave Keep motif colors off and choose Motif pen 3 · Green."],
    controls: [
      { name: "Spacing mm", text: "Sets the sampling interval along each host path. Sampling restarts for every path; open-path endpoints are retained, so the last gap may be shorter." },
      { name: "Size mm", text: "Sets the motif’s overall scale. A custom motif is centred and scaled so its larger bounding-box dimension matches this size, before size modulation." },
      { name: "Size modulation / Per-path variation", text: "Size modulation varies motif sizes with seeded noise. Per-path variation changes how much individual host paths differ. With Size modulation at 0, both the variation pattern and Seed have no visible size effect." },
      { name: "Motif (if unwired)", text: "Choose Circle, Square, Triangle or Line. A non-empty drawing connected to Motif takes precedence over this choice." },
      { name: "Orientation / Angle °", text: "Fixed gives every motif the same angle. Along path adds the local path angle; Perpendicular adds another 90°. Angle ° supplies an extra rotation in every mode." },
      { name: "Include host path", text: "Keeps the original host geometry alongside the motifs. With it off, only the motifs are output." },
      { name: "Keep motif colors / Motif pen", text: "A custom motif can retain its own pen assignments when Keep motif colors is on. Otherwise, all motifs use Motif pen. Included host paths keep their original pens." },
      { name: "Seed", text: "Chooses the noise pattern for size modulation. Keep it fixed when comparing sizes or orientations." }
    ],
    portNotes: "Host path and Motif both take blue paths. Host path is needed for placement; Motif is optional. The output combines generated motifs and, optionally, the host.",
    comparisonIntro: "Compare orientations on the same paths, or switch Include host path to see exactly which geometry Stamp adds.",
    pitfalls: [
      { q: "Why do built-in motif changes do nothing?", a: "A connected, non-empty Motif input overrides the built-in motif selector." },
      { q: "Why are there more marks than spacing suggests?", a: "Each host path starts its own sampling. Short dashes can each receive marks, including their endpoints." },
      { q: "Why does my custom motif overlap itself?", a: "Increase Spacing mm or reduce Size mm. The motif is centred at each placement point and can extend to either side." }
    ],
    related: ["radat", "viiva", "setpen"],
    tutorials: ["style-and-stamp"]
  },
  setpen: {
    summary: "Put a finished multi-pen drawing onto one pen without changing its geometry. Set Pen can also remap one pen within an existing composition.",
    useWhen: "You have combined or imported a drawing that uses several pens and want to draw the whole work with one pen. To choose the colour of an individual generator, use that node’s own Pen control when it has one.",
    recipe: ["Load the example patch and select Merge. It combines blue waves from Grid → Wave with red loops from Tracks; Merge’s Pen change per input is off.", "Connect Merge’s blue output to Set Pen’s Paths input. On Set Pen choose Recolor All and To pen 0 · Black.", "Select Set Pen. Both the waves and the loops now use the black pen, while their shapes and positions stay the same.", "Compare Merge’s two-pen output with Set Pen’s single-pen output. Select Set Pen before exporting the complete black drawing."],
    controls: [
      { name: "Recolor", text: "All assigns every incoming path to To pen. Single changes only paths whose current pen matches From pen (Single). Other paths pass through with their existing pens." },
      { name: "From pen (Single)", text: "The source pen to remap when Recolor is Single. It has no effect in All mode even though the control remains visible." },
      { name: "To pen", text: "The destination pen. Indices begin at 0: the default 0 is Black, 1 Blue, 2 Red and 3 Green. These are pen assignments, not mixed or translucent colours." }
    ],
    portNotes: "Connect blue paths to Paths. The output preserves the path shapes, direction and open/closed state, with updated pen assignments.",
    comparisonIntro: "Start with the blue-and-red composition, then compare Recolor All with To pen 0 · Black and 3 · Green. Each result puts the whole drawing on one pen; the geometry stays identical.",
    pitfalls: [
      { q: "Do I need Set Pen to choose a generator’s colour?", a: "Use the generator’s own Pen control when it has one. Set Pen is useful after several pen assignments have already been combined or imported." },
      { q: "Why does part of the drawing keep its old colour?", a: "Choose Recolor All to put every incoming path on the target pen. Single changes only the selected source pen." },
      { q: "Why did Single mode make no visible change?", a: "Check that the input actually contains paths on From pen (Single), and that To pen is different." },
      { q: "Why does Merge change the colour again?", a: "Merge’s Pen change per input overrides incoming assignments. Turn it off to preserve the Set Pen results." },
      { q: "Why isn’t pen 1 black?", a: "Muusia numbers pens from 0. The default black pen is 0, and the default blue pen is 1. Names and colours can also be changed in Pens." }
    ],
    related: ["merge", "radat", "grid"],
    tutorials: []
  },
  merge: {
    summary: "Collect paths from two to six branches into a single output. Keep their pen assignments or assign a separate pen to each input.",
    useWhen: "You have several parts of one composition and want to preview or export them together.",
    recipe: ["Load the two-pen example patch. Grid uses Pen 1 · Blue and feeds Wave; Tracks uses Pen 2 · Red.", "Keep Merge’s Inputs at 2. Connect Wave directly to input 1 and Tracks directly to input 2.", "Leave Pen change per input off to preserve the pens chosen on Grid and Tracks. Select Merge before exporting the combined drawing."],
    controls: [
      { name: "Inputs", text: "Changes the number of visible path inputs from 2 to 6. Each input can carry an entire branch. Empty inputs add nothing to the result." },
      { name: "Pen change per input", text: "Off preserves all incoming pen assignments. On assigns input 1 to pen 0, input 2 to pen 1, and so on. It replaces any pen differences within each input." }
    ],
    portNotes: "The numbered blue inputs appear or disappear as Inputs changes. The blue output contains the collected paths. Set the input count before wiring your branches.",
    comparisonIntro: "Inspect each input separately, then select Merge to see the composition. Overlaps remain part of the drawing.",
    pitfalls: [
      { q: "Why is only one branch in my SVG?", a: "Select Merge before exporting. A selected upstream node exports only its own output." },
      { q: "Why are intersecting lines still drawn twice?", a: "Merge combines path lists. It does not remove duplicates, cut at intersections or perform a shape union." },
      { q: "Why did my carefully chosen colours disappear?", a: "Turn Pen change per input off. Choose each generator’s colour with its own Pen control; Merge will preserve those assignments." }
    ],
    related: ["setpen", "grid", "radat", "travelsort"],
    tutorials: ["two-pen-composition", "export-two-colour-svg", "first-physical-plot"]
  },
  arvo: {
    summary: "Send one number to another node’s numeric control. A shared Value lets several connected controls change together.",
    useWhen: "You want one obvious control for a patch, or want to understand the green numeric connections before trying animation.",
    recipe: ["Start with Grid connected to Wave, then add Value.", "Connect Value’s green output to the green port beside Wave’s Amplitude mm. Set Value to 4.", "Select Wave to inspect the drawing. Change Value to 0, 4 and 8 to compare the effect."],
    controls: [
      { name: "Value", text: "The number sent to every connected destination. Its meaning comes from the destination: 4 connected to Amplitude mm means 4 mm; the same number connected to a count means a count." }
    ],
    portNotes: "Value produces a green number output, not paths. Connect it to a green numeric input. A connected parameter uses the incoming value and its manual control becomes disabled; disconnect the wire to edit it manually again.",
    comparisonIntro: "The image shows Value through its effect on Wave. A number by itself has no drawable geometry.",
    pitfalls: [
      { q: "Why can’t I change Wave’s amplitude slider now?", a: "The connected Value controls it. Edit Value, or detach the connection to return to the manual amplitude setting." },
      { q: "Why can’t I connect Value to the blue input?", a: "Blue ports expect paths. Use the green port beside the numeric parameter you want to control." },
      { q: "Why is export disabled when Value is selected?", a: "Value outputs a number. Select the downstream node that produces the drawing, such as Wave." }
    ],
    related: ["aaltoilu", "matem", "satunnainen", "frame", "grid"],
    tutorials: ["first-drawing", "control-with-numbers"]
  },
  satunnainen: {
    summary: "Generate one repeatable random number between two bounds. The same range and seed reproduce the same value.",
    useWhen: "You want a reproducible variation in a numeric setting, such as a wave amplitude, scale or angle, without changing the whole patch by hand.",
    recipe: ["Load the example patch on a 297 × 210 mm canvas. Grid feeds Wave’s blue path input, while Random feeds the green Amplitude mm port.", "Set Random’s Min to 2, Max to 8 and Seed to 11. Keep Wave’s Wavelength mm at 45 and Phase at 0.", "Select Wave to inspect the paths. Random supplies an amplitude of about 5.80 mm; its full value is used internally.", "Try a different Seed, then return to 11 with the same Min and Max to reproduce the original drawing."],
    screenshotCaption: "Random supplies Wave’s Amplitude mm in the actual Muusia graph. Wave is selected so the preview shows the drawing controlled by that number.",
    controls: [
      { name: "Min / Max", text: "Set the output interval. Use Min below Max for a clear range; equal values produce that fixed number. Random produces a floating-point value, so integer bounds do not restrict the result to whole numbers." },
      { name: "Seed", text: "Chooses a deterministic result within the range. Keeping Seed, Min and Max unchanged reproduces it. The dice button chooses a different seed; it does not turn on continuous randomisation." }
    ],
    portNotes: "Random has a green number output and no ordinary inputs. It produces one scalar value for the node, not a list of values per path. Connect it to a green numeric parameter port or Math’s A or B input. Its own Min, Max and Seed parameter ports can receive numbers too.",
    comparisonIntro: "Keep Min and Max fixed while changing Seed to compare repeatable amplitude variations in the same Wave drawing.",
    pitfalls: [
      { q: "Why does the result stay still during animation?", a: "Random has no built-in time input. It changes only when Min, Max or Seed changes. You can wire a changing value, such as Frame’s frame #, to Seed if you deliberately want frame-dependent variation." },
      { q: "Why do all paths receive the same value?", a: "A Random node returns one number. A connection to Wave’s Amplitude applies that one amplitude to the node’s entire input drawing." },
      { q: "Why is the value a decimal?", a: "Random samples a continuous numeric interval. It does not round the output to an integer or match the destination slider’s step size." },
      { q: "Why does restoring Seed alone give a different result?", a: "Min and Max are part of the calculation too. Restore all three settings, and check any wires feeding them, to reproduce the same value." },
      { q: "Why is export unavailable with Random selected?", a: "Random outputs a number. Select the downstream path-producing node, such as Wave, to preview or export the drawing." }
    ],
    related: ["arvo", "matem", "aaltoilu", "frame"],
    tutorials: ["control-with-numbers"]
  },
  matem: {
    summary: "Combine two numbers with arithmetic, a minimum or a maximum. Use connected inputs or the fallback values on the card.",
    useWhen: "You want to multiply a control, add an offset, compare two values or turn an upstream number into the setting another node needs.",
    recipe: ["Load the example patch. Grid feeds Wave, Value feeds Math’s labelled A input, and Math’s output feeds Wave’s Amplitude mm parameter port.", "Set Value to 4. On Math choose Operation A × B and set B (if unwired) to 2; leave the labelled B input unwired.", "Select Wave to see the drawing at 8 mm amplitude. Math’s numeric output is 4 × 2 = 8.", "Change Value to compare amplitudes, or connect Random to the labelled B input for a repeatable multiplier. A number supplied there overrides B (if unwired)."],
    screenshotCaption: "Value supplies Math’s A input; B uses the fallback value 2. Math outputs 8 to Wave’s Amplitude mm, with Wave selected for the drawing preview.",
    controls: [
      { name: "Operation", text: "A + B adds; A − B subtracts B from A; A × B multiplies; A ÷ B divides A by B. min and max select the smaller or larger input. A ^ B raises A to the power B. A mod B returns the JavaScript remainder." },
      { name: "A (if unwired) / B (if unwired)", text: "These values are used when the corresponding labelled A or B input is not supplying a number. Ordinary A/B input wires override them, but the fallback fields remain editable. A green wire directly to a fallback parameter’s own small port instead controls that fallback value." }
    ],
    portNotes: "The labelled green A and B inputs receive numbers, and the green output carries one calculated number. Small ports beside the fallback fields are separate parameter connections. Math does not convert units or clamp its result to another node’s slider range; the receiving control determines what the number means.",
    comparisonIntro: "Keep A at 4 and Operation at A × B, then compare B (if unwired) at 1, 2 and 3. Wave’s amplitude becomes 4, 8 and 12 mm as the multiplier increases.",
    pitfalls: [
      { q: "Why does editing A (if unwired) have no effect?", a: "A number is connected to the labelled A input. That input takes priority over the fallback setting. Edit its source, or remove the input connection to use the fallback again." },
      { q: "Why does dividing by zero produce 0?", a: "Math explicitly returns 0 when B is zero for A ÷ B and A mod B. It does not return an infinity or an error for those two cases." },
      { q: "Why is A mod B negative?", a: "This operation is the JavaScript remainder, not a non-negative mathematical modulo. For example, -5 mod 3 returns -2." },
      { q: "Why can a result exceed the target slider’s limit?", a: "Numeric wires pass their finite values directly; manual slider limits do not clamp them. Choose input values and an operation suitable for the destination." },
      { q: "Why does an unusual power calculation not reach the target?", a: "A ^ B can produce a non-finite result for some inputs. Numeric parameter connections accept only finite numbers; an invalid result leaves the destination using its saved manual value. Choose inputs that give a finite real result." },
      { q: "Why do I see a number rather than my drawing?", a: "Math produces numbers. Select the downstream drawing node, such as Wave, to preview and export its paths." }
    ],
    related: ["arvo", "satunnainen", "aaltoilu", "frame"],
    tutorials: ["control-with-numbers"]
  },
  frame: {
    summary: "Turn the current animation frame into useful numbers: a progress ramp, an index, two looping curves and a rotation angle.",
    useWhen: "You want a parameter to change between frames, a smoothly turning object or a repeatable family of drawings.",
    recipe: ["Load the example patch. In the right-hand ANIMATE section, set Frames to 12 and move the frame slider to the beginning.", "The patch connects Frame’s rot ° output directly to Polyhedron Studio’s Rotate Y deg input. The solid is a Cube with Size mm 145, Face fill Concentric inset and Fill step mm 3.", "Select Polyhedron Studio rather than Frame. Press Next frame once for the pictured frame 2 of 12, a 30° Y rotation. Use Play preview to watch the full turn.", "Set Frames again after reopening a patch: animation frame count and current frame are not stored in the patch file."],
    controls: [
      { name: "Frames in ANIMATE", text: "Frame has no controls on its own card. The ANIMATE panel sets how many frames the outputs describe. More frames give more samples of the same cycle." },
      { name: "t 0→1", text: "A linear progress value. The first frame is 0 and the last is 1. Useful for a one-way transition; using it for a full rotation repeats the end position at the loop boundary." },
      { name: "frame #", text: "The zero-based frame index: 0 to Frames minus 1. The ANIMATE heading instead counts displayed frames from 1. Connect this to a Seed for a different deterministic pattern on each frame." },
      { name: "wave loop / ping-pong", text: "Both travel from 0 toward 1 and back toward 0. wave loop eases smoothly; ping-pong uses straight ramps. They sample a repeating cycle without duplicating the final endpoint." },
      { name: "rot °", text: "The angle for one seamless revolution. At 24 frames it produces 0°, 15°, 30° and so on up to 345°; the next loop returns to 0°." }
    ],
    portNotes: "The five green outputs have different ranges and shapes. Choose the one that matches the destination control. Parts of a patch that do not depend on Frame remain unchanged as the animation advances.",
    comparisonIntro: "These are frames 1, 2 and 3 of a 12-frame turn: 0°, 30° and 60° around Y. Set Frames to 12 to reproduce the same positions.",
    pitfalls: [
      { q: "Why is the drawing static?", a: "Check Frames is greater than 1, connect a Frame output to a numeric parameter, select the downstream drawing node and advance or play the animation." },
      { q: "Why does my rotation pause at the loop boundary?", a: "Use rot ° for a full loop. A t 0→1 ramp scaled to 360° includes both 0° and 360°, which show the same orientation twice." },
      { q: "Why did the animation change after loading the patch?", a: "The patch preserves the nodes and wires, but not Frames or the current frame. Restore them in ANIMATE." },
      { q: "How do I save all frames?", a: "Select the final path node and use SVG × N in ANIMATE for one SVG per frame. The ordinary EXPORT SVG action captures the current frame." }
    ],
    related: ["arvo", "polystudio", "aaltoilu"],
    tutorials: []
  },
  image: {
    summary: "Interpret a PNG or JPG as drawable paths. Choose waves, circles, hatching, flowing strokes or tonal contours to translate light and dark into linework.",
    useWhen: "You want a plotter-friendly interpretation of an image, with a visual treatment you can control and combine with other paths.",
    recipe: ["Load the example patch to start with the supplied tonal-shapes.png image already included, or add Image and click Choose image… to load your own PNG or JPG.", "Use the 297 × 210 mm canvas. Set Render to Scanline wave, Cell / spacing mm to 2.4, Strength to 0.8 and Margin mm to 20. Leave the other controls at their defaults.", "Select Image to inspect its paths. Compare Render modes one at a time and export the selected result as SVG."],
    controls: [
      { name: "Render", text: "Scanline wave varies horizontal waves with darkness. Halftone dots draws small circle outlines of varying size. Hatch levels adds up to four line directions in darker areas. Flow shade draws short flowing strokes. Contours (trace) follows boundaries between tonal levels." },
      { name: "Cell / spacing mm", text: "Sets line or sample spacing, depending on the render mode. Smaller values give finer detail and usually more paths. In Contours (trace), it sets the grid used to trace tonal boundaries." },
      { name: "Strength", text: "Changes wave amplitude, circle size, hatch coverage or flow-stroke length according to the mode. It has no effect in Contours (trace)." },
      { name: "Gamma / Invert", text: "Gamma above 1 reduces midtone darkness; below 1 increases it. Invert swaps light and dark. Contours (trace) uses Invert but ignores Gamma." },
      { name: "White cutoff", text: "Omits the lightest regions in Scanline wave, Halftone dots and Flow shade. It does not control Hatch levels or Contours (trace)." },
      { name: "Contour levels / Lowest threshold / Highest threshold", text: "Used only by Contours (trace), though visible in all modes. Contour levels sets how many tonal thresholds are traced between the lowest and highest values. A single level uses their midpoint." },
      { name: "Min contour mm", text: "Used only by Contours (trace). Discards short traced paths to reduce tiny specks. It is a path-length filter, not a minimum area." },
      { name: "Margin mm / Pen", text: "The image is centred and fitted inside the margins while preserving its proportions. Pen assigns the generated paths to one pen; the source image’s colours do not become separate pens." },
      { name: "Seed", text: "Changes the flowing pattern in Flow shade. The other render modes do not use it." }
    ],
    portNotes: "The image is loaded through Choose image… on the node. The optional purple Style input accepts Stroke. The blue output contains generated vector paths; it does not contain an embedded photograph for export.",
    comparisonIntro: "Compare render modes with the same input image and canvas. Each mode uses different marks to represent the same tonal information.",
    pitfalls: [
      { q: "Why is the output blank?", a: "Load an image first. For a very pale image, lower White cutoff in the modes that use it, or adjust Gamma. For contours, try thresholds that cross visible tonal regions." },
      { q: "Why doesn’t a control change my contours?", a: "Contours (trace) ignores Strength, Gamma, White cutoff and Seed. Use contour thresholds, Cell / spacing mm, Invert and Min contour mm instead." },
      { q: "Why is fine detail missing?", a: "This node downsamples the source image for processing. A smaller Cell / spacing mm refines the path sampling, but cannot recover detail lost from the source." },
      { q: "Why do halftone dots look like rings?", a: "They are closed circle-like paths that a pen can draw, rather than filled raster pixels." }
    ],
    related: ["viiva", "setpen", "travelsort"],
    tutorials: []
  },
  polystudio: {
    summary: "Build a three-dimensional solid and draw a pattern inside each face before projecting it onto the page. Separate outputs provide face paths, a silhouette and a mesh.",
    useWhen: "You want geometric line art with convincing depth, an animated turning solid, or a generated mesh for a later slicing workflow.",
    recipe: ["Load the example patch and select Polyhedron Studio to view its Faces output.", "The reference uses Shape Icosahedron, Size mm 150, Pen 1 · Blue and Edge / silhouette pen 0 · Black. Leave the other controls at their defaults, including Face fill Concentric inset and Even density on.", "Compare Face fill options and rotate the solid. Connect Frame’s rot ° output to Rotate Y deg for animation, then set the frame count in ANIMATE."],
    controls: [
      { name: "Shape / Sides / Frequency", text: "Shape selects the solid. Sides appears for Prism, Antiprism, Pyramid and Bipyramid. Frequency appears for Geodesic sphere and increases its subdivision detail." },
      { name: "Size mm / X % / Y %", text: "Size sets the base scale of the projected body. X % and Y % place its centre relative to the canvas. Perspective, stellation and explosion can extend the drawing beyond that base size." },
      { name: "Rotate X deg / Rotate Y deg / Rotate Z deg", text: "Rotate the solid in three dimensions. Their green numeric ports accept Value or Frame output; these rotations also affect the Mesh output." },
      { name: "Perspective", text: "Changes the strength of the perspective projection. At 0, depth does not change apparent scale. Higher values make near and far parts differ more strongly." },
      { name: "Visibility", text: "Solid (hide back) omits back-facing faces. Transparent retains them. X-ray (back thinned) retains the back faces with more widely spaced fill marks." },
      { name: "Face fill", text: "Concentric inset nests polygons; Face hatch rules parallel lines; Spiral winds outward; Nested rings adds circles; Centroid fan radiates toward the boundary; Dots adds small rings. None leaves face outlines." },
      { name: "Fill step mm / Face inset mm", text: "Fill step sets the base spacing of interior marks. Face inset shrinks the face drawing inward to leave a channel along its edges. A large inset can consume a small face." },
      { name: "Hatch angle deg / Dot size mm", text: "Hatch angle deg appears for Face hatch. Dot size mm appears for Dots. These mode-specific controls change the marks within each face’s plane." },
      { name: "Draw edges / Edge / silhouette pen", text: "Draw edges adds the original face boundaries to the Faces output. Edge / silhouette pen assigns those edges and the separate silhouette to a pen; Pen controls the face pattern." },
      { name: "Stellate / Explode mm", text: "Stellate raises or indents the faces and changes the real mesh. Explode mm separates the face drawings along their normals; it does not explode the Mesh output or the separate silhouette." },
      { name: "Depth cue / Even density", text: "Depth cue opens fill spacing on more distant faces. Even density opens spacing on oblique faces to avoid dense slivers after projection." }
    ],
    portNotes: "Faces is the first blue output and is used when the node is selected. To preview or export Silhouette separately, connect that blue output to Merge input 1, keep Inputs at 2, leave input 2 empty and turn Pen change per input off. Select Merge to see the silhouette using the pen chosen in Edge / silhouette pen. Mesh carries 3D data for a compatible node such as Mesh Slice; it cannot connect to a blue path input. The optional purple Style input applies to the path outputs.",
    comparisonIntro: "Compare face fills with the shape, viewpoint and spacing held constant. The marks are created in each face’s plane, so they turn with the solid.",
    pitfalls: [
      { q: "Where are Sides, Frequency or Hatch angle deg?", a: "These controls appear only for the shape or fill mode that uses them. Choose a prism-family shape for Sides, Geodesic sphere for Frequency or Face hatch for Hatch angle deg." },
      { q: "Why doesn’t the silhouette match every indentation?", a: "The silhouette is the convex outline of the projected body. It encloses the body rather than tracing concave gaps, and does not follow exploded faces." },
      { q: "Why doesn’t Explode change the Mesh output?", a: "Explode is a drawing treatment. Stellate changes the solid itself and is included in the mesh." },
      { q: "Why is the result too dense?", a: "Increase Fill step mm, use Solid (hide back), and keep Even density on. Dense fills on highly subdivided shapes can be costly to compute and draw." }
    ],
    related: ["frame", "arvo", "merge", "viiva"],
    tutorials: []
  },
  move_scale: {
    summary: "Move existing paths and change their width and height around a chosen origin. Shape outlines, pen assignments and open or closed states are preserved.",
    useWhen: "You want to position artwork on the page, fit a shape into a composition or stretch it before applying another effect.",
    screenshotCaption: "Move / Scale in Muusia. Content center uses the bounds of the input shape; Move offsets are applied after scaling.",
    recipe: ["Load the example patch on a 297 × 210 mm canvas. Tracks supplies one closed blue outline to Move / Scale.", "Choose Scale origin Content center. Set Scale % to 70 and Scale Y % (0 = same) to 45.", "Set Move X mm to 20 and Move Y mm to -5. Select Move / Scale to see the narrowed, flattened outline moved right and slightly upward."],
    controls: [
      { name: "Move X mm / Move Y mm", text: "Translate the result after scaling. Positive X moves right; positive Y moves down in Muusia’s canvas coordinates. These offsets are measured in millimetres." },
      { name: "Scale %", text: "100 keeps the original width; 70 makes it 70% as wide. It also controls the height when Scale Y % (0 = same) is 0." },
      { name: "Scale Y % (0 = same)", text: "A positive value sets the height scale independently: 45 means 45% of the original height. Zero uses Scale % for both axes; it does not flatten the drawing to zero height." },
      { name: "Scale origin", text: "Content center uses the centre of the bounding box around all input paths. Canvas center uses the centre of the page. Custom point uses the two origin coordinates. Scaling keeps the chosen origin fixed before the Move offsets are added." },
      { name: "Origin X mm (custom) / Origin Y mm (custom)", text: "Set the scaling anchor when Scale origin is Custom point. The fields do not affect Content center or Canvas center." }
    ],
    portNotes: "Connect blue paths to the input and send the transformed paths onward. The operation keeps closed outlines closed, so they can still feed Hatch Fill. Green ports beside numeric controls accept values.",
    comparisonIntro: "Compare the original outline with independent width and height scales. Keep the origin and movement fixed when comparing size alone.",
    pitfalls: [
      { q: "Why does Scale Y at 0 keep a full-height shape?", a: "Zero means use the Scale % value for Y too. Choose a small positive Scale Y % to make the shape flatter." },
      { q: "Why does the drawing move when I scale it?", a: "Points move toward or away from Scale origin. A shape away from the canvas centre will change position when scaled around Canvas center. Content center keeps its bounding-box centre fixed before the Move offsets." },
      { q: "Why did adding another shape change the scale anchor?", a: "Content center uses the bounds of all input paths together. Use Custom point if the anchor must stay at a fixed page coordinate." },
      { q: "Why do the custom origin fields have no effect?", a: "Set Scale origin to Custom point. The other origin modes calculate their own anchor." }
    ],
    related: ["kierto", "container", "hatch", "arvo"],
    tutorials: ["transform-crop-fill", "first-physical-plot"]
  },
  kierto: {
    summary: "Turn existing paths around the canvas centre or around each path’s own centre. A progressive mode gives successive paths different angles.",
    useWhen: "You want to tilt a motif, rotate a composition around the page centre or build a sequence of increasingly rotated shapes.",
    recipe: ["Load the example patch with Tracks → Move / Scale → Rotate on a 297 × 210 mm canvas.", "Set Angle ° to 25, enable Per path (centroid) and leave Progressive (Molnár) off.", "Select Rotate to inspect the tilted blue outline. Select Move / Scale to compare its unrotated shape, then return to Rotate."],
    controls: [
      { name: "Angle °", text: "Sets the rotation in degrees. Zero preserves the input orientation. Positive angles turn clockwise in the normal screen view, where Y increases downward." },
      { name: "Per path (centroid)", text: "Off rotates every path around the canvas centre. On rotates each path around the average of its stored point coordinates. Despite the label, this is a point average, not an area-weighted polygon centroid; uneven point spacing can shift the pivot." },
      { name: "Progressive (Molnár)", text: "Scales the angle by each path’s zero-based index divided by the total path count. With four paths and Angle 40°, the rotations are 0°, 10°, 20° and 30°. The first path never rotates in this mode, and a single path therefore stays unchanged." }
    ],
    portNotes: "The blue input receives paths and the blue output carries their rotated points. Rotation preserves pen assignments and whether a path is open or closed. The green Angle ° port can receive Value or Frame output.",
    comparisonIntro: "Compare angles using the same input and pivot. The example uses Per path so its shifted outline turns around its own point average.",
    pitfalls: [
      { q: "Why does my shape orbit the page instead of turning in place?", a: "With Per path off, Rotate uses the canvas centre, not the content centre. Enable Per path to rotate around each path’s own point average." },
      { q: "Why does Angle do nothing to my single outline?", a: "Turn Progressive off. Its first path receives zero rotation; a one-path input contains only that first path." },
      { q: "Why doesn’t the last progressive shape reach the full angle?", a: "The multiplier is index divided by path count, so the last path receives less than the entered angle. This is the current progressive rule." },
      { q: "Why does a path turn around an unexpected centre?", a: "Per path averages stored vertices. Extra points concentrated on one side affect that average, even if the visible outline looks balanced." }
    ],
    related: ["move_scale", "hatch", "frame", "arvo"],
    tutorials: ["transform-crop-fill"]
  },
  hatch: {
    summary: "Fill closed shapes with parallel drawing strokes. Add a crossing direction, keep the original outlines or hatch the space outside the shapes.",
    useWhen: "You want a drawable line fill inside an outline, controlled shading or a background that leaves the shapes empty.",
    recipe: ["Load the example patch and select Rotate to inspect its one closed blue outline.", "Connect Rotate to Hatch Fill. Choose Region Inside shapes, Angle ° 90, Spacing mm 2.5 and Inset from edge mm 0.", "Leave Cross hatch off; keep Keep outlines and Keep shape colors on. Select Hatch Fill to see blue vertical strokes inside the blue outline.", "Connect Hatch Fill to Container when you want to crop the filled result. Filling first keeps the source outline closed during the fill operation."],
    controls: [
      { name: "Region / Invert margin mm", text: "Inside shapes fills closed input regions using an even-odd rule: nested outlines and overlapping regions can create unfilled areas. Outside (invert) adds a canvas rectangle around the shapes and fills the alternating region. Invert margin mm sets that rectangle’s distance from the page edges and only affects Outside mode." },
      { name: "Angle ° / Spacing mm", text: "Angle sets the stroke direction: 0° is horizontal and 90° is vertical. Spacing measures the gap between parallel hatch rows. Smaller spacing makes a denser fill and more drawing strokes." },
      { name: "Inset from edge mm", text: "Moves the fill boundary inward, including away from hole edges, to leave breathing room around the outline. Kept outlines stay in their original position. Large insets can distort or consume narrow areas." },
      { name: "Cross hatch", text: "Adds a second set of hatch strokes at a right angle to the first. It increases density without changing the region boundaries." },
      { name: "Keep outlines", text: "Includes the original closed outlines alongside the new hatch strokes. Turning it off removes those closed outlines; original open paths still pass through." },
      { name: "Keep shape colors / Hatch pen", text: "With Keep shape colors on, hatch strokes take their pen from the input shape boundaries. Turn it off to use Hatch pen for the new strokes. Kept outlines and open input paths retain their original pens." }
    ],
    portNotes: "Connect paths to the blue input. Inside shapes needs closed outlines with at least three points; open paths pass through without defining a filled area. New hatch strokes are open paths, so the output can contain both open strokes and closed outlines.",
    comparisonIntro: "Compare hatch spacing and direction on the same closed outline. Keep shape colors retains the outline’s blue pen in this example.",
    pitfalls: [
      { q: "Why does my cropped outline receive no fill?", a: "A partly clipped outline becomes open. Hatch Fill cannot use that open fragment as an inside region. Apply Hatch Fill before Container, then crop the finished strokes." },
      { q: "Why do nested loops leave holes?", a: "Hatch Fill applies even-odd filling across the closed boundaries. Moving inside another nested boundary switches between filled and unfilled regions; it does not fill every loop independently." },
      { q: "Why does Hatch pen make no difference?", a: "Turn Keep shape colors off to use Hatch pen. With it on, the input shape boundaries determine the hatch pens." },
      { q: "Why do some lines remain after I turn Keep outlines off?", a: "Open input paths always pass through. Keep outlines controls the original closed outlines, not the new hatch strokes or existing open paths." }
    ],
    related: ["container", "radat", "kierto", "travelsort"],
    tutorials: ["transform-crop-fill"]
  },
  container: {
    summary: "Keep the parts of a drawing inside or outside a region. Use a built-in shape or supply closed paths as the boundary, and optionally draw the region outline.",
    useWhen: "You want to crop linework to a frame, restrict a filled shape to a window or remove the part of a drawing inside a chosen region.",
    screenshotCaption: "The region guide is a preview overlay. Draw region is enabled in this example, so separate boundary paths also appear in the exported drawing.",
    recipe: ["Load the example patch. Hatch Fill feeds Container’s Content input after the source outline has been moved and rotated.", "Choose Shape Rectangle. Set Center X mm to 148.5, Center Y mm to 105, Rect W mm to 150, Rect H mm to 90 and Rotate ° to 0.", "Choose Keep Inside and Gap mm (+grow / -shrink) 0. Enable Draw region and set Region pen to 0 · Black.", "Select Container. The blue filled shape is cropped to the rectangular window, with the black region outline added to the drawing."],
    controls: [
      { name: "Shape", text: "Wired region takes closed boundaries from Region (closed). Rectangle, Circle and Triangle use their built-in controls instead of that input. Several wired boundaries form the combined inside of those regions." },
      { name: "Center X mm / Center Y mm", text: "Position a built-in region on the page. They do not translate a wired region; move its source paths before connecting them." },
      { name: "Rect W mm / Rect H mm", text: "Set the full width and height of a built-in Rectangle. These controls do not affect Circle, Triangle or Wired region." },
      { name: "Circle / Triangle R mm / Rotate °", text: "Radius sets the size of Circle or Triangle. Rotate turns a built-in Rectangle or Triangle around its centre. A circle looks the same when rotated; wired regions keep their incoming orientation." },
      { name: "Keep", text: "Inside keeps portions within the region. Outside keeps portions beyond it, cutting a hole in the drawing. Paths crossing the boundary are split into open fragments." },
      { name: "Gap mm (+grow / -shrink)", text: "Positive values grow the clipping region outward; negative values shrink it inward. This adjusts the clipping test, not the separate outline added by Draw region or the dashed preview guide." },
      { name: "Draw region / Region pen", text: "Adds the original region boundaries as drawable closed paths on Region pen. It does not close clipped source fragments. With Draw region off, the dashed preview guide is only an overlay and is not exported." }
    ],
    portNotes: "Connect the drawing to Content. Region (closed) is used only when Shape is Wired region and needs closed paths with at least three points. A missing or unsuitable wired region passes Content through unchanged. Closed paths retained in full stay closed; partly cut paths become open fragments.",
    comparisonIntro: "Compare Inside and Outside, or change the region size while keeping the incoming artwork fixed. The region controls clipping; it does not scale the content to fit.",
    pitfalls: [
      { q: "Why does an unwired Container leave everything unchanged?", a: "Its default Shape is Wired region. Connect valid closed boundaries to Region (closed), or choose a built-in Rectangle, Circle or Triangle." },
      { q: "Why does the hatch disappear if I put Container first?", a: "Clipping can turn the original closed outline into open fragments. Fill the closed shape first, then clip the hatch strokes. Draw region only adds a separate frame; it does not repair those fragments." },
      { q: "Why don’t the cuts match the drawn frame after changing Gap?", a: "Gap grows or shrinks the clipping region, while Draw region adds the original boundary. Use Gap 0 when the frame and cut line should coincide." },
      { q: "Why do I see a dashed shape that is missing from my SVG?", a: "The dashed shape is a preview guide. Enable Draw region to add the actual boundary to the output, and select Container before exporting." },
      { q: "Why doesn’t the drawing shrink into the rectangle?", a: "Container clips paths; it does not resize them. Use Move / Scale before Container to change their size and position." }
    ],
    related: ["hatch", "move_scale", "kierto", "radat"],
    tutorials: ["transform-crop-fill", "first-physical-plot"]
  },
  travelsort: {
    summary: "Reorder paths so the pen can travel between nearby endpoints. The drawing stays in place, while the order and sometimes the direction of its strokes change.",
    useWhen: "You want to inspect or control travel within the patch, especially for a drawing with many separate marks or loops.",
    exportNote: "Travel Sort does not change how the SVG or DXF drawing looks. It can change the stored path order and direction, but these exports contain no pen-up travel commands. The software that imports the file determines the final plotting route and may optimise it again. Check that software’s preview and routing settings before plotting.",
    recipe: ["Load the example patch and select the node before Travel Sort to inspect the original drawing.", "Enable Show direction in the preview. Keep it on while switching between the source node and Travel Sort: the arrowheads reveal which strokes have reversed, while the drawn shapes stay in place.", "Turn off Optimize route in the export panel while comparing: otherwise the simulator and exporter apply another route optimisation after the selected node.", "Select Travel Sort and keep Allow reversing, Rotate closed starts and Group by pen on. Open the large preview with Space to inspect the direction arrows. To follow the drawing order and pen-up moves, choose Simulate and enable Travel.", "Leave Optimize route off if you want export to use Travel Sort’s order directly."],
    controls: [
      { name: "Allow reversing", text: "Lets the sorter enter an open path from either end. This can shorten travel but changes stroke direction. Turn it off when the direction matters to your pen or brush." },
      { name: "Rotate closed starts", text: "Moves the starting point of a closed loop to a nearer existing vertex. The loop’s shape and winding direction remain the same." },
      { name: "Group by pen", text: "Keeps each pen’s paths together, with pen groups ordered by their first appearance in the input. Turn it off to sort across pens; that may interleave pen assignments." }
    ],
    portNotes: "Connect blue paths to Source. The output has the same geometry and pen assignments, in a new sequence. The sort begins at the canvas origin, so compare it as a routing heuristic rather than a measured machine-time guarantee.",
    comparisonIntro: "Enable Show direction in Muusia’s preview, then switch between the source node and Travel Sort to compare stroke directions. With Allow reversing on, the arrowheads make reversed strokes visible. The comparisons below show travel between strokes; to inspect those moves in Muusia, choose Simulate and enable Travel.",
    pitfalls: [
      { q: "Why does the artwork look unchanged?", a: "Travel Sort keeps the marks in place. Enable Show direction in the preview to see strokes reversed by Allow reversing. To see the drawing sequence and pen-up moves, choose Simulate and enable Travel; Show direction alone does not show the path order." },
      { q: "Why doesn’t the exported route match this node?", a: "The export panel’s Optimize route setting can sort the result again. Turn it off to avoid that extra pass. SVG also groups paths by pen, and the software importing SVG or DXF may choose its own plotting order." },
      { q: "Why does it leave a very large group unsorted?", a: "To limit processing cost, groups containing more than 3,000 paths pass through without sorting. Very small inputs of fewer than three paths also pass through unchanged." },
      { q: "Does sorting remove pen lifts?", a: "It shortens travel where possible, but does not join separate paths. The number of separate strokes remains the same." }
    ],
    related: ["merge", "stamp", "image"],
    tutorials: ["two-pen-composition"]
  }
};
