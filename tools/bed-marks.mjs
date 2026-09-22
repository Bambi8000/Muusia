#!/usr/bin/env node
/*
 * bed-marks.mjs — permanent paper-alignment marks for the Viivain steel bed.
 *
 * Writes a G-code file in the Viivain dialect (PEN_UP / PEN_DOWN macros,
 * G28 X Y + CLEAR_PAUSE + PLOT_HEIGHT header, coordinates in the PAPER frame
 * that PLOT_START sets up). Run it after the normal PLOT_START ritual with NO
 * paper on the bed: the fixed Z block stands on the steel, so work Z0 is the
 * steel surface. Use a permanent / paint marker in the pen holder.
 *
 * Every sheet shares the paper origin corner, so the drawing is:
 *   - two baselines along x=0 and y=0 over the whole reachable area, with
 *     outward ticks every 50 mm and numbers every 100 mm (a ruler; numbers sit
 *     just inside the baselines and are skipped where they would touch a
 *     format edge)
 *   - for each format and orientation, the two far edges (x=W, y=H) as DASHED
 *     lines over their full length, overlapping spans between formats merged
 *     so no stretch is inked twice; plus L-brackets at the three non-origin
 *     corners whose legs continue the sheet edges past the corner, outside the
 *     paper, so the corners stay visible with the sheet in place. Label
 *     "A3 P" / "A3 L" beside the far corner.
 *   Sized for a thick marker (~2-3 mm line): labels 18 mm, numbers 12 mm,
 *   ticks 10 mm, dashes 15/15 mm.
 *   - A1 (594x841) exceeds the reachable area (751x793) in both orientations:
 *     partial marks only — the reachable edge gets a guide segment near the
 *     far end and a label noting the overhang. Skip with --a1 0.
 *   - the reachable-area corner (MAX) with an inward L and its size.
 *
 * SAFETY (opt-in): --clear N drops any mark at paper x<0 or y<0 within N mm
 * of the origin corner, for a bed where something stands next to the paper
 * corner. Default 0 = off: on Viivain the fixed Z block does not reach the
 * outward ticks (confirmed 2026-09-22), so the 50/100 mm ruler ticks are drawn.
 *
 * Usage:
 *   node tools/bed-marks.mjs --out ~/Desktop/bed-marks.gcode
 * Options (defaults):
 *   --origin   paper origin in machine mm, from PLOT_START (42,20)
 *   --travel   position_max X,Y from printer.cfg (793,813)
 *   --clear    origin exclusion square for negative coordinates, mm (0 = off)
 *   --leg      bracket leg length outside the corner, mm (15)
 *   --dash     dash length = gap length for the edge lines, mm (15)
 *   --text     label height mm (18); ruler numbers are 2/3 of this
 *   --a1       1 = include A1 partial marks, 0 = skip (1)
 *   --passes   how many times each line is drawn (1; 2 for a weak marker)
 *   --draw     draw speed mm/s (30 — slow for a marker on steel)
 *   --travelv  travel speed mm/s (150)
 *   --z        plotting height, work Z (0)
 *   --out      output path (bed-marks.gcode)
 */
import { writeFileSync } from "node:fs";
import { fontStrokes } from "../src/defs/helpers.js";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const pair = (s) => String(s).split(",").map(parseFloat);

const [OX, OY] = pair(opt("origin", "42,20"));
const [TX, TY] = pair(opt("travel", "793,813"));
const CLEAR = parseFloat(opt("clear", "0"));
const LEG = parseFloat(opt("leg", "15"));
const DASH = parseFloat(opt("dash", "15"));
const TEXT = parseFloat(opt("text", "18"));
const NUM = Math.round(TEXT * 2 / 3);
const TICK = 10;
const A1 = String(opt("a1", "1")) === "1";
const PASSES = Math.max(1, parseInt(opt("passes", "1"), 10));
const VDRAW = parseFloat(opt("draw", "30"));
const VTRAV = parseFloat(opt("travelv", "150"));
const ZPLOT = parseFloat(opt("z", "0"));
const OUT = opt("out", "bed-marks.gcode");
for (const v of [OX, OY, TX, TY, CLEAR, LEG, DASH, TEXT, VDRAW, VTRAV, ZPLOT]) if (!isFinite(v)) { console.error("bed-marks: bad arguments"); process.exit(1); }

const WMAX = TX - OX;            /* reachable paper area */
const HMAX = TY - OY;
const XMIN = -OX, YMIN = -OY;    /* machine 0 in paper coords */
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

/* ---------- emitter ---------- */
const lines = [];
const out = (s) => lines.push(s);
let penDown = false, dropped = 0, dupes = 0, segs = 0;
const PEN_UP = () => { if (penDown) { out("PEN_UP"); penDown = false; } };
const PEN_DOWN = () => { if (!penDown) { out("PEN_DOWN"); penDown = true; } };
const inReach = (x, y) => x >= XMIN && y >= YMIN && x <= WMAX && y <= HMAX;
const inBlockZone = (x, y) => (x < 0 || y < 0) && x < CLEAR && y < CLEAR;
const ok = (pts) => pts.every(([x, y]) => inReach(x, y) && !inBlockZone(x, y));
const seen = new Set();
const poly = (pts) => {
  if (!ok(pts)) { dropped++; return; }
  const key = pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join("|");
  const rkey = [...pts].reverse().map(([x, y]) => `${f2(x)},${f2(y)}`).join("|");
  if (seen.has(key) || seen.has(rkey)) { dupes++; return; }   /* shared corners (A2 L / A1 P) inked once */
  seen.add(key);
  for (let pass = 0; pass < PASSES; pass++) {
    const p = pass % 2 === 0 ? pts : [...pts].reverse();
    if (pass === 0) out(`G0 X${f2(p[0][0])} Y${f2(p[0][1])} F${Math.round(VTRAV * 60)}`);
    PEN_DOWN();
    for (let i = 1; i < p.length; i++) out(`G1 X${f2(p[i][0])} Y${f2(p[i][1])} F${Math.round(VDRAW * 60)}`);
  }
  PEN_UP();
  segs++;
};
const seg = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y1]]);
const label = (x, y, text, h) => {
  const { strokes } = fontStrokes(text, h, 1);
  for (const s of strokes) poly(s.map(([gx, gy]) => [x + gx, y + (h - gy)]));
};

/* ---------- formats (mm, portrait W×H) ---------- */
const A = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841] };
const sheets = [];
for (const k of ["A4", "A3", "A2"]) {
  const [w, h] = A[k];
  sheets.push({ name: `${k} P`, W: w, H: h });
  sheets.push({ name: `${k} L`, W: h, H: w });
}

/* ---------- header ---------- */
out(`; Viivain bed alignment marks - tools/bed-marks.mjs`);
out(`; paper frame: origin machine (${OX},${OY}), reachable ${WMAX}x${HMAX} mm (travel ${TX}x${TY})`);
out(CLEAR > 0 ? `; block zone: no marks at x<0 or y<0 when x<${CLEAR} and y<${CLEAR}` : `; block zone: off (all ruler ticks drawn)`);
out(`; run after PLOT_START with NO paper on the bed; marker pen; passes ${PASSES}`);
out(`G21`);
out(`G90`);
out(`G28 X Y`);
out(`CLEAR_PAUSE`);
out(`PEN_UP`);
out(`PLOT_HEIGHT ; work Z0 = steel (block stands on the bed)`);
if (ZPLOT !== 0) out(`G1 Z${f2(ZPLOT)} F300`);
out(`M117 Bed marks: ${sheets.length} formats${A1 ? " + A1 partial" : ""}`);

/* ---------- edge lines: merge spans per coordinate, then dash ---------- */
const vert = new Map(), horz = new Map();           /* x -> [[y0,y1]] , y -> [[x0,x1]] */
const addSpan = (map, k, a, b) => { if (!map.has(k)) map.set(k, []); map.get(k).push([Math.min(a, b), Math.max(a, b)]); };
const merge = (spans) => {
  spans.sort((p, q) => p[0] - q[0]);
  const res = [];
  for (const s of spans) { const l = res[res.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else res.push([...s]); }
  return res;
};
for (const s of sheets) { addSpan(vert, s.W, 0, s.H); addSpan(horz, s.H, 0, s.W); }
const edgeX = [...vert.keys()], edgeY = [...horz.keys()];
const dashed = (fixed, a, b, vertical) => {
  for (let t = a; t < b; t += 2 * DASH) {
    const e = Math.min(t + DASH, b);
    if (vertical) seg(fixed, t, fixed, e); else seg(t, fixed, e, fixed);
  }
};

/* ---------- baselines + ruler ---------- */
out(`; ---- baselines`);
seg(0, 0, WMAX, 0);
seg(0, 0, 0, HMAX);
for (let x = 50; x <= WMAX; x += 50) seg(x, 0, x, -TICK);        /* outward = below y=0 */
for (let y = 50; y <= HMAX; y += 50) seg(0, y, -TICK, y);        /* outward = left of x=0 */
const clearOf = (lo, hi, edges) => edges.every((e) => e < lo - 4 || e > hi + 4);
for (let x = 100; x <= WMAX - 20; x += 100) {                    /* numbers inside, left of the tick */
  const w = fontStrokes(String(x), NUM, 1).width, x0 = x - 6 - w;
  if (x0 > 0 && clearOf(x0, x - 6, edgeX)) label(x0, 4, String(x), NUM);
}
for (let y = 100; y <= HMAX - 10; y += 100) {                    /* numbers inside, below the tick */
  const y0 = y - 8 - NUM;
  if (clearOf(y0, y - 8, edgeY)) label(4, y0, String(y), NUM);
}

/* ---------- corner brackets ---------- */
const bracket = (x, y, dx, dy) => {           /* legs continue the sheet edges past the corner */
  seg(x, y, x + dx * LEG, y);
  seg(x, y, x, y + dy * LEG);
};
out(`; ---- dashed edges (merged spans)`);
for (const [x, spans] of vert) for (const [a, b] of merge(spans)) dashed(x, a, b, true);
for (const [y, spans] of horz) for (const [a, b] of merge(spans)) dashed(y, a, b, false);
for (const s of sheets) {
  out(`; ---- ${s.name} ${s.W}x${s.H}`);
  bracket(s.W, s.H, 1, 1);      /* far corner */
  bracket(s.W, 0, 1, -1);       /* bottom-right: leg along y=0 to the right, leg down below the sheet */
  bracket(0, s.H, -1, 1);       /* top-left: leg to the left, leg up */
  label(s.W + 6, s.H + 6, s.name, TEXT);
}

/* ---------- A1 partial ---------- */
if (A1) {
  const [w, h] = A.A1;
  out(`; ---- A1 P partial: ${w} wide, ${h} tall -> top edge at ${h} is ${h - HMAX} mm beyond reach`);
  bracket(w, 0, 1, -1);
  seg(w, HMAX - 60, w, HMAX);                 /* right-edge guide near the far end */
  seg(w, HMAX, w + LEG, HMAX);
  label(w + 6, HMAX - 50 - TEXT, `A1 P`, TEXT);
  label(w + 6, HMAX - 56 - TEXT - NUM, `TOP +${h - HMAX}`, NUM);
  out(`; ---- A1 L partial: ${h} wide -> right edge at ${h} is ${h - WMAX} mm beyond reach; top-left = A2 P`);
  seg(WMAX - 60, w, WMAX, w);                 /* top-edge guide near the far end */
  seg(WMAX, w, WMAX, w + LEG);
  label(WMAX - 60, w + 6, `A1 L`, TEXT);
  label(WMAX - 6 - fontStrokes(`RIGHT +${h - WMAX}`, NUM, 1).width, w + 6 + TEXT + 6, `RIGHT +${h - WMAX}`, NUM);
}

/* ---------- MAX corner ---------- */
out(`; ---- reachable-area corner`);
seg(WMAX, HMAX, WMAX - LEG, HMAX);
seg(WMAX, HMAX, WMAX, HMAX - LEG);
label(WMAX - 6 - fontStrokes(`MAX ${WMAX}x${HMAX}`, NUM, 1).width, HMAX - 6 - NUM, `MAX ${WMAX}x${HMAX}`, NUM);

/* ---------- footer ---------- */
PEN_UP();
out(`G0 X0 Y0 F${Math.round(VTRAV * 60)}`);
out(`M117 Bed marks done`);

writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`bed-marks: ${segs} polylines, ${dropped} dropped by reach/block-zone rule, ${dupes} shared duplicates skipped -> ${OUT}`);
console.log(`  reachable ${WMAX}x${HMAX} mm from origin (${OX},${OY}); formats: ${sheets.map((s) => s.name).join(", ")}${A1 ? ", A1 P/L partial" : ""}`);
console.log(`  ${lines.length} lines, passes ${PASSES}, draw ${VDRAW} mm/s, travel ${VTRAV} mm/s`);
