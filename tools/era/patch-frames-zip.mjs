/* patch-frames-zip.mjs — bundle the per-frame exports into ONE zip.
 *
 * exportAllFrames() used to fire one download per frame with a 450 ms gap.
 * At 12 frames that is merely noisy; at 50 (Mesh Slice grid pages, sheet
 * runs) browsers throttle or block the burst outright and the job arrives
 * half-finished. buildZip() already exists in App.jsx (used by the jig and
 * mega-tile exports), so the frames are collected and zipped instead:
 * one file, ordered names, nothing dropped. A single frame still downloads
 * bare, exactly as before.
 *
 * Anchored, MISS-aborts, idempotent (SKIP when already applied).
 * Usage: node tools/era/patch-frames-zip.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/App.jsx";
let src = readFileSync(FILE, "utf8");

const SENTINEL = "-frames-${kind}.zip";
if (src.includes(SENTINEL)) {
  console.log("SKIP: already applied (frames zip bundling present)");
  process.exit(0);
}

/* 1. collect files instead of downloading each one */
const A1 = `    const n = Math.max(1, frameCount);
    let f = 0;
    const doOne = () => {
      const ctxF = { W: megaW, H: megaH, frameIdx: f, frameCount: n };`;
const B1 = `    const n = Math.max(1, frameCount);
    let f = 0;
    const files = [];
    const doOne = () => {
      const ctxF = { W: megaW, H: megaH, frameIdx: f, frameCount: n };`;

/* 2. replace the per-frame download tail with accumulate + zip at the end */
const A2 = `      try {
        const blob = new Blob([text], { type: kind === "svg" ? "image/svg+xml" : "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = \`\${projName || "patch"}-f\${String(f).padStart(3, "0")}\${kind === "svg" ? ".svg" : kind === "dxf" ? ".dxf" : ".gcode"}\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      } catch (err) { /* hiekkalaatikko estaa lataukset */ }
      f++;
      if (f < n) setTimeout(doOne, 450);
    };
    doOne();`;
const B2 = `      const ext = kind === "svg" ? ".svg" : kind === "dxf" ? ".dxf" : ".gcode";
      files.push({ name: \`\${projName || "patch"}-f\${String(f).padStart(3, "0")}\${ext}\`, text });
      f++;
      setAnimBusy(f < n ? f / n : 0);
      if (f < n) { setTimeout(doOne, 8); return; }
      try {
        const single = files.length === 1;
        const blob = single
          ? new Blob([files[0].text], { type: kind === "svg" ? "image/svg+xml" : "text/plain" })
          : new Blob([buildZip(files)], { type: "application/zip" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = single ? files[0].name : \`\${projName || "patch"}-frames-\${kind}.zip\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      } catch (err) { /* hiekkalaatikko estaa lataukset */ }
    };
    setAnimBusy(0.001);
    doOne();`;

/* 3. progress state so a 50-frame run shows life instead of a frozen button */
const A3 = `  const [frameCount, setFrameCount] = useState(12);`;
const B3 = `  const [frameCount, setFrameCount] = useState(12);
  const [animBusy, setAnimBusy] = useState(0);`;

/* 4. surface the progress on the export buttons row */
const A4 = `                  G-code {"\\u00D7"} {frameCount}`;
const B4 = `                  G-code {"\\u00D7"} {frameCount}{animBusy > 0 ? " " + Math.round(animBusy * 100) + "%" : ""}`;

const edits = [
  { name: "file accumulator", find: A1, repl: B1 },
  { name: "zip bundling tail", find: A2, repl: B2 },
  { name: "progress state", find: A3, repl: B3 },
  { name: "progress readout", find: A4, repl: B4 },
];

for (const e of edits) {
  const hits = src.split(e.find).length - 1;
  if (hits === 0) {
    console.error("MISS: anchor not found for '" + e.name + "' - aborting, file untouched");
    process.exit(1);
  }
  if (hits > 1) {
    console.error("MISS: anchor for '" + e.name + "' matches " + hits + " times - aborting, file untouched");
    process.exit(1);
  }
}
for (const e of edits) {
  src = src.replace(e.find, e.repl);
  console.log("  OK  " + e.name);
}
writeFileSync(FILE, src);
console.log("APPLIED: " + FILE + " - per-frame exports now arrive as one zip");
