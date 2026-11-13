# LATU

## Muusia Print receipts

Muusia's receipt path sends a JSON job containing a 512-dot-wide, 1-bit bitmap to
the Raspberry Pi server. The server converts it to ESC/POS bytes for the printer;
neither format is G-code. Muusia can also download the bitmap as
`*.muusia-receipt.json` without a printer. In LATU choose **Document → Open receipt
preview…** or drop that file into the window. LATU also previews `.escpos` files
containing the current TM-T88V raster, feed and cut commands. The preview is
read-only because the raster has no editable vector strokes. Regular `.gcode`
files continue to open in LATU's editor.

Muusia's **ANIMATE → Receipt × N** downloads a ZIP of numbered receipt frames.
Open that ZIP in the same receipt preview to play the frames in order, pause,
step backward or forward, or scrub to a frame. The small frame number and crop
marks are already in each receipt's pixels; playback does not change the files.

Long receipts support up to 353,357 rows (about 50 m at the measured
400 dots = 56.6 mm scale). JSON and ESC/POS imports keep every raster row. Above
8192 rows, the viewer shows a movable 4096-row window using four 1024-row
canvases, keeping browser memory bounded. Regular receipt export fits the source
canvas to the 512-dot print width; Surface Composer retains calibrated size.

LATU is Muusia's line-preserving G-code reader/editor sub-app. The M0 viewer
provides Muusia servo/bed-Z parsing, canvas and text synchronization, file
open/save, zoom/pan, event markers, and timing statistics. M1 adds multi-stroke
and point selection, drag/numeric moves, delete/copy/paste/reverse/split/join,
exact point insertion and stroke creation, outline reordering, route
optimization, scale/fit/rotate transforms, undo/redo, and live safety warnings.
M2 adds persistent machine profiles, per-file profile stamps, profile JSON
import/export, configurable snippets, safe event insertion (pause, pen, dip,
maintenance, dose, air, rotation and laser), and proportional continuous feed.
M3 adds feed-accurate playback with a draggable timeline, 1–100× speed,
pause chapter markers, completed/remaining toolpath rendering, live tool
position, optional text following, and per-pen time totals.
The canvas also provides wheel-to-cursor and explicit +/-/Fit zoom controls,
plus a drag measurement tool reporting distance and machine-coordinate deltas.
The current editor also keeps the canvas viewport stable while geometry changes,
defaults to positive Y pointing up, supports multi-point moves and explicit
endpoint joins, moves strokes between pen sections, combines G-code files,
resizes canvas metadata, provides visible Find/Replace fields for the directly
editable G-code, and previews a persistent per-pen line width during playback.
Combined source files are now kept as named, movable file groups rather than
interleaved by pen. Pen display colors can be picked from a palette and stored
in LATU metadata, while playback exposes both paper color and clearly labelled
per-pen widths. Contextual selection tools and separate document/view menus
keep the toolbar compact; endpoint joining can add an explicit drawn connector
over longer gaps.

## Continue a stopped drawing

Open the original file and choose **Document → Continue from here…** (also
available in the selection panel). Click the intended start on the canvas or
select/type a G-code drawing line. A green START marker shows the chosen position.
The percentage slider chooses a point inside that move: 0% repeats the whole
move, while 100% starts at its endpoint. A selected canvas vertex starts at the
vertex, whereas selecting a text row starts before its move. For overlapping
paths, use the original line number to disambiguate the pass.

The panel reports the starting coordinates, required pen and remaining drawing.
After acknowledging the setup check, **Create continuation copy** replaces the
editor contents with a new `*-resume.gcode` document. The original file handle is
detached: Save prompts for the copy, rather than overwriting the opened original.
Review the result in Playback, then Save. Undo restores the full drawing in the
editor (the copy filename remains, so it still cannot silently overwrite the
original).

Choose how the continuation starts under **Machine startup**:

- **Keep current setup** (default) uses the machine's existing paper X/Y zero
  and plot height. Homing and entry macros are omitted.
- **Run original startup** retains the source file's setup and initial travel,
  in their original order, up to the first pen-down. This includes `G28`,
  `PLOT_GO`, `PLOT_HEIGHT`, canvas checks and explicit paper offsets when present.
  **View startup G-code** shows the included lines with original line numbers.
  Changing the startup choice resets the setup acknowledgement.

After that setup, LATU restores G21/G90 and the current motion limits, lifts the
pen, travels to the chosen START, lowers the pen to the original/interpolated
pressure, waits for it to settle and restores the drawing feed. No earlier
drawing is replayed. The original suffix, including subsequent pen changes and
end commands, is retained. Bed-Z homing/setup runs before the generated Z lift.

Paper must stay in its original position and the required pen must be loaded.
Only setup actually present in the source file is replayed; the active machine
profile's Start G-code is not substituted. Canvas origin metadata is preserved
without applying a second machine offset. `PLOT_GO` uses the machine's stored
paper setup; a file with only `PLOT_HEIGHT` does not restore paper X/Y zero and
the panel says so. Macro internals and physical homing are not simulated by
Playback.

Supported: absolute millimetre pen paths using source-calibrated servo controls,
`PEN_UP` / `PEN_DOWN`, or bed-Z (including interpolated pressure). The first
version rejects relative/inch modes, unknown macros, extrusion, laser/pin
output, rotary tools and saved/restored machine state. Explicit `G92 X/Y/Z` and
absolute `SET_GCODE_OFFSET` are supported only inside the replayed startup;
`G92` additionally requires the affected axes to be homed by that startup,
because it defines zero at the current physical position. Incremental offsets
and offset changes after startup remain unsupported. Both
X and Y must be explicitly positioned after setup and before the first drawing
move. Starts inside dip/maintenance blocks and files
with unfinished blocks are also refused. Actual printer motion is not tested by
the application test suite; inspect the generated file before a physical run.

From the repository root:

```sh
npm run dev:latu
npm run test:latu
npm run build:latu
```

The production build is a committed single-file app at
`public/latu/index.html`.
