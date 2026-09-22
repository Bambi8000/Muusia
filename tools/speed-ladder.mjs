#!/usr/bin/env node
/*
 * speed-ladder.mjs — Viivain motion-limit test generator.
 *
 * Writes a G-code file in the Viivain dialect (PEN_UP / PEN_DOWN macros,
 * G28 X Y + CLEAR_PAUSE start, work coordinates on top of PAPER_ZERO) that
 * steps Klipper's SET_VELOCITY_LIMIT through a ladder of velocity / accel
 * pairs, one sheet row per stage. Row 0 should be the current printer.cfg
 * limits so it acts as the control row.
 *
 * Each row, left to right:
 *   +  anchor cross, drawn at BASE limits before the stage limits are set
 *   |||||  hop comb: every tick is reached by a pen-up hop to a far sheet
 *          corner/edge and back at stage limits — uneven pitch or vertical
 *          drift = lost steps on long travels (the failure mode of §9)
 *   []  three nested squares at stage draw speed — corner overshoot =
 *       ringing, an open closure gap = steps lost while drawing
 *   /\/\  zigzag at stage draw speed — direction reversals stress accel;
 *         also shows whether the ink keeps up
 *   O  circle (72 segments) — flats at the quadrants = belt slack, ovality
 *   ×  return cross drawn over the + at BASE limits — the primary readout:
 *      a clean 8-point star means the stage lost nothing; any offset is the
 *      accumulated error of this stage, in mm, with its direction
 *   V100 A500  label (built-in single-stroke font)
 *   /  speed line: long shallow diagonal at stage limits - wobble, ink at speed
 *
 * A + at the sheet origin corner before stage 0 and a × over it after the
 * last stage give the whole-run error.
 *
 * Usage:
 *   node tools/speed-ladder.mjs --v 60,80,100,120,150 --a 500 --out ladder-v.gcode
 *   node tools/speed-ladder.mjs --v 60 --a 500,800,1200,1800,2500 --out ladder-a.gcode
 *
 * Options (defaults):
 *   --v        velocity list mm/s (60,80,100,120,150)
 *   --a        accel list mm/s^2 (500); shorter list is padded with its last value
 *   --base     BASE velocity,accel used for the crosses and labels (60,500)
 *   --sheet    WxH mm, X right, Y away from the operator (297x210 = A4 landscape)
 *   --margin   sheet margin mm (12)
 *   --hops     hops per row (6)
 *   --drawcap  cap on stage draw speed mm/s (none: draws at the stage velocity)
 *   --pause    1 = PAUSE after every stage so the crosses can be inspected (0)
 *   --z        plotting height, work Z mm (0 = paper surface set by Z_PAPER_BLOCK /
 *              PLOT_START; slightly negative = felt-tip preload). Emitted after
 *              PLOT_HEIGHT, which refuses to run without a paper-Z offset.
 *   --out      output path (speed-ladder.gcode)
 *
 * Deterministic: no randomness anywhere. Nothing here touches printer.cfg —
 * the file restores BASE limits at the end, and a FIRMWARE_RESTART resets
 * them anyway.
 */
import { writeFileSync } from "node:fs";
import { fontStrokes } from "../src/defs/helpers.js";

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf("--" + k);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d;
};
const list = (s) => String(s).split(",").map((x) => parseFloat(x)).filter((x) => isFinite(x) && x > 0);

const V = list(opt("v", "60,80,100,120,150"));
const A = list(opt("a", "500"));
const [BASE_V, BASE_A] = list(opt("base", "60,500"));
const [W, H] = String(opt("sheet", "297x210")).toLowerCase().split("x").map(parseFloat);
const M = parseFloat(opt("margin", "12"));
const HOPS = Math.max(2, parseInt(opt("hops", "6"), 10));
const DRAWCAP = opt("drawcap", null) ? parseFloat(opt("drawcap")) : Infinity;
const PAUSE = String(opt("pause", "0")) === "1";
const ZPLOT = parseFloat(opt("z", "0"));
const OUT = opt("out", "speed-ladder.gcode");

if (!V.length || !A.length || !isFinite(W) || !isFinite(H) || !isFinite(BASE_V) || !isFinite(BASE_A) || !isFinite(ZPLOT) || ZPLOT < -3 || ZPLOT > 8) {
  console.error("speed-ladder: bad arguments");
  process.exit(1);
}
const N = Math.max(V.length, A.length);
const stages = [];
for (let k = 0; k < N; k++) stages.push({ v: V[Math.min(k, V.length - 1)], a: A[Math.min(k, A.length - 1)] });

/* ---------- geometry ---------- */
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const rh = (H - 2 * M) / N;                  /* row height */
const EH = Math.min(26, rh - 6);             /* element height */
if (EH < 10) {
  console.error(`speed-ladder: ${N} rows on ${W}x${H} leaves only ${rh.toFixed(1)} mm per row — use fewer stages or a bigger sheet`);
  process.exit(1);
}
const CROSS = 8;                              /* cross arm span */
const TICK_PITCH = 5;
const TICK_LEN = 6;
const GAP = 8;
const ZZ_W = 30, ZZ_PITCH = 3;
const LABEL_H = Math.min(5, EH * 0.22);

const lines = [];
const out = (s) => lines.push(s);
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const seen = (x, y) => {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
};

let penDown = false;
const PEN_UP = () => { if (penDown) { out("PEN_UP"); penDown = false; } };
const PEN_DOWN = () => { if (!penDown) { out("PEN_DOWN"); penDown = true; } };
const travel = (x, y, vmm) => { PEN_UP(); seen(x, y); out(`G0 X${f2(x)} Y${f2(y)} F${Math.round(vmm * 60)}`); };
const draw = (x, y, vmm) => { seen(x, y); out(`G1 X${f2(x)} Y${f2(y)} F${Math.round(vmm * 60)}`); };
/* polyline: travel to first point, pen down, draw the rest */
const poly = (pts, vTravel, vDraw) => {
  travel(pts[0][0], pts[0][1], vTravel);
  PEN_DOWN();
  for (let i = 1; i < pts.length; i++) draw(pts[i][0], pts[i][1], vDraw);
  PEN_UP();
};
const limits = (v, a, note) => out(`SET_VELOCITY_LIMIT VELOCITY=${v} ACCEL=${a}${note ? ` ; ${note}` : ""}`);

const crossPlus = (cx, cy) => {
  const h = CROSS / 2;
  poly([[cx - h, cy], [cx + h, cy]], BASE_V, 30);
  poly([[cx, cy - h], [cx, cy + h]], BASE_V, 30);
};
const crossX = (cx, cy) => {
  const h = (CROSS / 2) * Math.SQRT1_2;
  poly([[cx - h, cy - h], [cx + h, cy + h]], BASE_V, 30);
  poly([[cx - h, cy + h], [cx + h, cy - h]], BASE_V, 30);
};
const label = (x, y, text) => {
  const { strokes } = fontStrokes(text, LABEL_H, 1);
  /* SFONT is y-down (0 = top); G-code Y is up */
  for (const s of strokes) poly(s.map(([gx, gy]) => [x + gx, y + (LABEL_H - gy)]), BASE_V, 30);
};

/* ---------- header ---------- */
out(`; Viivain speed ladder - tools/speed-ladder.mjs`);
out(`; sheet ${W}x${H} mm, margin ${M}, ${N} stages, ${HOPS} hops/row, base ${BASE_V}/${BASE_A}, plot Z${f2(ZPLOT)}${isFinite(DRAWCAP) ? `, drawcap ${DRAWCAP}` : ""}`);
stages.forEach((s, k) => out(`; stage ${k}: V${s.v} A${s.a}${k === 0 ? "  (control row - should equal printer.cfg)" : ""}`));
out(`; Read: X-cross over + = clean. Offset of X-cross from + = error of that stage (mm, direction).`);
out(`G21`);
out(`G90`);
out(`G28 X Y`);
out(`CLEAR_PAUSE`);
out(`PEN_UP`);
out(`PLOT_HEIGHT ; work Z0 = paper (PLOT_START leaves Z on the 8 mm block)`);
if (ZPLOT !== 0) out(`G1 Z${f2(ZPLOT)} F300 ; plotting height override`);
limits(BASE_V, BASE_A, "base limits");
out(`M117 Speed ladder: ${N} stages`);

/* origin cross before anything else */
out(`; ---- origin reference`);
crossPlus(M, M);

/* ---------- stages ---------- */
stages.forEach(({ v, a }, k) => {
  const yTop = H - M - k * rh;
  const yc = yTop - rh / 2;
  const vDraw = Math.min(v, DRAWCAP);
  let x = M + 6;

  out(`; ---- stage ${k}: V${v} A${a}`);
  out(`M117 Stage ${k}/${N - 1}: V${v} A${a}`);

  /* 1. anchor + at base limits */
  const ax = x, ay = yc;
  crossPlus(ax, ay);

  /* 2. stage limits */
  limits(v, a, `stage ${k}`);

  /* 3. hop comb */
  x += 12;
  const combX0 = x;
  const yFar = (yc - M) > (H - M - yc) ? M : H - M;    /* the far sheet edge in Y */
  for (let i = 0; i < HOPS; i++) {
    const tx = combX0 + i * TICK_PITCH;
    let target;
    switch (i % 4) {
      case 0: target = [W - M, M]; break;            /* far bottom-right */
      case 1: target = [W - M, H - M]; break;        /* far top-right */
      case 2: target = [tx, yFar]; break;            /* pure Y */
      default: target = [W - M, yc]; break;          /* pure X */
    }
    travel(target[0], target[1], v);
    travel(tx, yc + TICK_LEN / 2, v);
    PEN_DOWN();
    draw(tx, yc - TICK_LEN / 2, vDraw);
    PEN_UP();
  }
  x = combX0 + (HOPS - 1) * TICK_PITCH + GAP;

  /* 4. nested squares */
  const sq = (cx, cy, s) => {
    const h = s / 2;
    poly([[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx - h, cy - h]], v, vDraw);
  };
  const scx = x + EH / 2;
  sq(scx, yc, EH);
  sq(scx, yc, EH * 0.7);
  sq(scx, yc, EH * 0.4);
  x += EH + GAP;

  /* 5. zigzag */
  const zz = [];
  const nz = Math.floor(ZZ_W / ZZ_PITCH);
  for (let j = 0; j <= nz; j++) {
    const zx = x + j * ZZ_PITCH;
    const up = j % 2 === 0;
    zz.push([zx, up ? yc - EH / 2 : yc + EH / 2]);
    zz.push([zx, up ? yc + EH / 2 : yc - EH / 2]);
  }
  poly(zz, v, vDraw);
  x += ZZ_W + GAP;

  /* 6. circle */
  const ccx = x + EH / 2, r = EH / 2;
  const circ = [];
  for (let j = 0; j <= 72; j++) {
    const t = (j / 72) * Math.PI * 2;
    circ.push([ccx + r * Math.cos(t), yc + r * Math.sin(t)]);
  }
  poly(circ, v, vDraw);
  x += EH + GAP;

  /* 7. speed line: one long shallow diagonal at stage limits, both axes
     moving, long enough to reach full velocity - shows wobble and whether
     the ink keeps up at speed */
  const text = `V${v} A${a}`;
  const labelX = x;
  const labelW = fontStrokes(text, LABEL_H, 1).width;
  const lx0 = labelX + labelW + GAP;
  if (W - M - lx0 > 30) poly([[lx0, yc - EH / 2], [W - M, yc + EH / 2]], v, vDraw);

  /* 8. back to base limits, X-cross over the anchor */
  limits(BASE_V, BASE_A, "base limits");
  crossX(ax, ay);

  /* 9. label */
  label(labelX, yc - LABEL_H / 2, text);

  /* 10. optional pause */
  if (PAUSE && k < N - 1) {
    out(`M117 Stage ${k} done - check the cross, RESUME for stage ${k + 1}`);
    out(`PAUSE`);
  }
});

/* ---------- footer ---------- */
out(`; ---- origin check`);
limits(BASE_V, BASE_A, "base limits");
crossX(M, M);
PEN_UP();
out(`G0 X0 Y0 F${Math.round(BASE_V * 60)}`);
out(`M117 Speed ladder done - read the crosses`);

/* ---------- self-check + write ---------- */
if (minX < 0 || minY < 0 || maxX > W || maxY > H) {
  console.error(`speed-ladder: geometry out of sheet: x ${f2(minX)}..${f2(maxX)} y ${f2(minY)}..${f2(maxY)}`);
  process.exit(1);
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`speed-ladder: ${N} stages -> ${OUT}`);
stages.forEach((s, k) => console.log(`  stage ${k}: V${s.v} A${s.a}`));
console.log(`  ${lines.length} lines, bounds x ${f2(minX)}..${f2(maxX)} y ${f2(minY)}..${f2(maxY)} (sheet ${W}x${H})`);
console.log(`  row height ${rh.toFixed(1)} mm, elements ${EH.toFixed(1)} mm, pause ${PAUSE ? "on" : "off"}, plot Z${f2(ZPLOT)}`);
