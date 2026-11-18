# GIF to Receipt fixtures

Regenerate the two GIFs and exact-pixel oracle with
`node tools/preview-gif-receipt.mjs /private/tmp/gif-receipt-preview`.
No external assets or new dependencies are needed.

- `colour-orbit.gif`: 24 actual colour frames, with unequal delays. Exercises
  import, channel conversion, colouring outlines and every-frame export.
- `disposal-interlace.gif`: five deliberately small partial images, local colour
  tables, transparency, restore-background (2), restore-previous (3) and an
  interlaced patch. The expected RGB frames are constructed directly from the
  input pixel functions, separately from browser decoding.
- `legacy-raster.js`: frozen receipt renderer at base commit `176ff8b4`, including
  the pre-existing strip clipping. The browser probe compares exact output bytes
  at both short and >4096-dot heights. Do not update this oracle to match a
  regression in the current renderer.

Run `node tools/validate-gif-receipt.mjs --baked` for geometry, timing and packed-row
checks. With the local Vite app running, open
`/tools/gif-receipt-browser-probe.html` for real ImageDecoder and fallback decoding,
background/transparency variants, legacy receipt byte parity and all 24 joined
frame bodies. Before baking use `?lab` to test the prototype.

For end-to-end verification, import `colour-orbit.gif` through the node picker,
choose Outlines, export Receipt ×24 and Receipt strip ×24, then open both in Print
without submitting a print job. The strip must have 17712 rows, each exact
738-row frame in source order, and one cut command only after the entire raster
when Cut is enabled. Cut off omits that final command too.
