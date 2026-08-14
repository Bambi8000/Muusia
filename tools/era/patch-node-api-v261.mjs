import { readFileSync, writeFileSync } from "node:fs";

const FILE = "docs/MUUSIA-NODE-API.md";
let src = readFileSync(FILE, "utf8");
let ok = 0, miss = 0;
const OK = (m) => { console.log("OK    " + m); ok++; };
const MISS = (m) => { console.log("MISS  " + m); miss++; };

if (src.includes("| `fileImage` |")) {
  console.log("SKIP  patch-node-api-v261 already applied (fileImage row found)");
  process.exit(0);
}

const app = readFileSync("src/App.jsx", "utf8");
const vm = app.match(/APP_VERSION = "([^"]+)"/);
if (!vm) { console.log("MISS  APP_VERSION not found in src/App.jsx - ABORT"); process.exit(1); }
const V = vm[1];
console.log("INFO  app version from repo: " + V);

const FILEIMAGE_ROW = "| `fileImage` | boolean, optional | Definition-level flag. The file picker reads a **dataURL** and the engine decodes the raster itself; the button label becomes \"Choose image\u2026\" automatically. The result is frozen at **`node.data.img`** = `{ w, h, g, rgb }`: `w`/`h` are the downsampled pixel dimensions (long side capped at 160 px), `g` is a `w*h` array of **darkness** 0..1 (1 = black, alpha composited over white), and `rgb` (since 2.61) is a `w*h*3` array of 0..255 channel bytes in the same pixel order, also flattened over white. Read a pixel as `img.g[y * img.w + x]` / `img.rgb[(y * img.w + x) * 3 + channel]`. **`rgb` may be absent** on photos loaded by a pre-2.61 build \u2014 always guard (`img.rgb && img.rgb.length === img.w * img.h * 3`) and fall back to `g` (see Image Rasterise, which degrades to a K-only separation). `compute` must read `node && node.data && node.data.img` and return `EMPTY` when it is missing. |\n";

const FACE_ROW = "| `faceAnalysis` | boolean, optional | Definition-level flag. File intake switches to the portrait pipeline (EXIF orientation honored, long side resized to 1280 px, re-encoded JPEG frozen at `node.data.src`) and the inspector shows an **Analyze face** button when a photo is loaded. The result is frozen to `node.data.analysis` (schema: MUUSIA-PORTRAIT-SPEC.md); a new photo invalidates it. Compute reads only frozen data. |\n";

const edits = [];

edits.push({
  name: "header version -> v1.4, app v" + V,
  old: "# Muusia \u2014 Custom Node API (v1.3, app v2.45)",
  neu: "# Muusia \u2014 Custom Node API (v1.4, app v" + V + ")",
});

edits.push({
  name: "orphaned faceAnalysis row below the Pins paragraph removed",
  old: "\n" + FACE_ROW,
  neu: "",
});

edits.push({
  name: "fileImage + faceAnalysis rows added to the definition-fields table",
  old: "Set `fileAccept` too \u2014 it now wins over the `image/*` default. |\n",
  neu: "Set `fileAccept` too \u2014 it now wins over the `image/*` default. |\n" + FILEIMAGE_ROW + FACE_ROW,
});

edits.push({
  name: "section 9: raster-node testing note",
  old: "helper makes the harness test a different node than the app runs (v2.45 lesson):",
  neu: "helper makes the harness test a different node than the app runs (v2.45 lesson):\n\nA `fileImage` node needs no browser: build a synthetic image by hand and pass it\nas the fourth `compute` argument \u2014\n`def.compute([undefined], p, {W:297,H:210}, { data: { img: { w, h, g, rgb } } })`\n\u2014 then assert the no-image case returns `EMPTY`, that a pure-white image emits\nnothing, and that an `img` without `rgb` still renders (the pre-2.61 fallback).",
});

for (const e of edits) {
  const parts = src.split(e.old);
  if (parts.length === 2) {
    src = parts.join(e.neu);
    OK(e.name);
  } else if (parts.length === 1) {
    MISS(e.name + " (anchor not found)");
  } else {
    MISS(e.name + " (anchor not unique: " + (parts.length - 1) + " hits)");
  }
}

if (miss > 0) {
  console.log("ABORT " + miss + " anchor(s) missed - " + FILE + " NOT written");
  process.exit(1);
}
writeFileSync(FILE, src);
console.log("DONE  " + ok + "/4 edits applied, " + FILE + " written");
