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

From the repository root:

```sh
npm run dev:latu
npm run test:latu
npm run build:latu
```

The production build is a committed single-file app at
`public/latu/index.html`.
