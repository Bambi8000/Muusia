/* validate sliceMega on a PORTRAIT mega (A2 tall 2x2, Overlap 5) */
import fs from "fs";
const src = fs.readFileSync("src/App.jsx", "utf8");
const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const i0 = src.indexOf("function sliceMega");
if (i0 < 0) die("sliceMega not found");
let depth = 0, i = src.indexOf("{", i0), end = -1;
for (; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (!depth) { end = i; break; } }
}
const sliceMega = new Function('"use strict"; return (' + src.slice(i0, end + 1).replace("function sliceMega", "function ") + ")")();

const sw = 420, sh = 594, C = 2, R = 2, seam = 5;
const strideX = sw - seam, strideY = sh - seam; /* Overlap */
/* content: ring centered on the mega + one probe dot per tile center */
const megaW = C * sw - seam, megaH = R * sh - seam;
const cx = megaW / 2, cy = megaH / 2, rad = 290;
const circle = [];
for (let k = 0; k <= 720; k++) {
  const a = (k / 720) * Math.PI * 2;
  circle.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
}
const probes = [];
for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
  const px = c * strideX + sw / 2, py = r * strideY + sh / 2;
  probes.push({ pts: [[px, py], [px + 2, py], [px + 2, py + 2]], closed: false, layer: 1 });
}
const ps = { paths: [{ pts: circle, closed: false, layer: 0 }, ...probes] };
const tiles = sliceMega(ps, sw, sh, C, R, seam, "Overlap", false, 0);
if (tiles.length !== 4) die("expected 4 tiles, got " + tiles.length);

const len = (pa) => { let l = 0; for (let q = 1; q < pa.pts.length; q++) l += Math.hypot(pa.pts[q][0] - pa.pts[q - 1][0], pa.pts[q][1] - pa.pts[q - 1][1]); return l; };
tiles.forEach((t, ti) => {
  const r = Math.floor(ti / C), c = ti % C;
  const x0 = c * strideX, y0 = r * strideY;
  /* 1) everything inside the sheet */
  for (const pa of t.paths) for (const [x, y] of pa.pts) {
    if (x < -0.01 || x > sw + 0.01 || y < -0.01 || y > sh + 0.01) die("tile " + ti + " point outside sheet: " + x.toFixed(1) + "," + y.toFixed(1));
  }
  /* 2) probe dot present at the tile's own center */
  const hasProbe = t.paths.some((pa) => pa.layer === 1 && pa.pts.some(([x, y]) => Math.abs(x - sw / 2) < 0.1 && Math.abs(y - sh / 2) < 0.1));
  if (!hasProbe) die("tile " + ti + " (r" + (r + 1) + "c" + (c + 1) + ") missing its center probe");
  /* 3) circle points map back onto the true circle */
  for (const pa of t.paths) {
    if (pa.layer !== 0) continue;
    for (const [x, y] of pa.pts) {
      const d = Math.hypot(x + x0 - cx, y + y0 - cy);
      if (Math.abs(d - rad) > 0.5) die("tile " + ti + " circle point off-circle by " + Math.abs(d - rad).toFixed(2) + " mm");
    }
  }
  const blue = t.paths.filter((pa) => pa.layer === 0).reduce((s, pa) => s + len(pa), 0);
  console.log("tile r" + (r + 1) + "c" + (c + 1) + ": ring length " + blue.toFixed(0) + " mm, probe OK");
});
const total = tiles.reduce((s, t) => s + t.paths.filter((pa) => pa.layer === 0).reduce((s2, pa) => s2 + len(pa), 0), 0);
const circ = 2 * Math.PI * rad;
if (total < circ - 2) die("ring fragments shorter than circumference: " + total.toFixed(0) + " vs " + circ.toFixed(0));
console.log("total ring across tiles " + total.toFixed(0) + " mm (circumference " + circ.toFixed(0) + " + overlap duplication) - sliceMega OK on portrait mega");