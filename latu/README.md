# LATU

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

Continuation does **not** home the machine, restore lost paper offsets, or replay
`PLOT_GO` / `PLOT_HEIGHT`. Before running, the operator must establish the original
paper X/Y zero, safe plot height and correct pen, with the machine homed and the
paper unmoved. LATU emits G21/G90, a source-matched pen lift, pen-up travel to the
start, the pen-down/pressure command, settle time and drawing feed. The original
suffix, including subsequent pen changes and end commands, is retained.

Supported: absolute millimetre pen paths using source-calibrated servo controls,
`PEN_UP` / `PEN_DOWN`, or bed-Z (including interpolated pressure). The first
version rejects relative/inch modes, unknown macros, offset changes, extrusion,
laser/pin output, rotary tools and saved/restored machine state; it does not
guess how to reconstruct them. Starts inside dip/maintenance blocks and files
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
