import { Pin, PENS, applyStyle, fontStrokes } from "../helpers.js";

// 72 × 100 mm diagnostic card for the 512-dot receipt raster. Every tone is
// ordered black/white dots, so the same geometry reaches the one-bit printer.
function thermalReceipt(ins, p, ctx) {
  const W = Number(ctx.W), H = Number(ctx.H);
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return applyStyle({ paths: [] }, ins[0]);
  const scale = Math.min(W / 72, H / 100);
  const ox = (W - 72 * scale) / 2;
  const layer = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
  const paths = [];
  const add = (pts, closed = false) => paths.push({ pts: pts.map(([x, y]) => [ox + x * scale, y * scale]), closed, layer });
  const line = (x0, y0, x1, y1) => add([[x0, y0], [x1, y1]]);
  const rect = (x, y, w, h) => add([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
  const label = (str, x, y, size, maxWidth = Infinity) => {
    let font = fontStrokes(str, size, 1);
    if (font.width > maxWidth) font = fontStrokes(str, size * maxWidth / font.width, 1);
    for (const stroke of font.strokes) if (stroke.length >= 2) add(stroke.map(([sx, sy]) => [x + sx, y + sy]));
  };
  const arc = (cx, cy, radius, a0 = 0, a1 = Math.PI * 2) => {
    const count = Math.max(48, Math.ceil(radius * 18));
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const a = a0 + (a1 - a0) * i / count;
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
    add(pts);
  };
  const dotMm = 72 / 512;
  const bayer = [
    0, 48, 12, 60, 3, 51, 15, 63,
    32, 16, 44, 28, 35, 19, 47, 31,
    8, 56, 4, 52, 11, 59, 7, 55,
    40, 24, 36, 20, 43, 27, 39, 23,
    2, 50, 14, 62, 1, 49, 13, 61,
    34, 18, 46, 30, 33, 17, 45, 29,
    10, 58, 6, 54, 9, 57, 5, 53,
    42, 26, 38, 22, 41, 25, 37, 21,
  ];

  rect(1.2, 1.2, 69.6, 97.6);
  label("TM-T88V / 512 DOTS", 3.5, 2.8, 2.5, 65);
  line(3, 8, 69, 8);

  label("VERTICAL / CROSS GRID  1 2 3 4 DOT", 4, 9.4, 1.55, 64);
  for (let i = 0; i < 4; i++) {
    const x = 4 + i * 16, pitch = (i + 1) * dotMm;
    for (const [y, cross] of [[13, false], [20.5, true]]) {
      rect(x, y, 14.5, 5.5);
      for (let xx = x + pitch; xx < x + 14.5 - 0.25; xx += pitch) line(xx, y + 0.35, xx, y + 5.15);
      if (cross) for (let yy = y + pitch; yy < y + 5.5 - 0.25; yy += pitch) line(x + 0.35, yy, x + 14.15, yy);
    }
  }
  line(3, 28, 69, 28);

  label("CURVES / DIAGONALS", 4, 29.4, 1.7, 64);
  for (const r of [1, 2, 3, 4, 5, 6, 7]) arc(18.5, 39, r);
  for (const r of [1.4, 2.6, 3.8, 5, 6.2, 7.4]) arc(51, 39, r, -Math.PI * 0.85, Math.PI * 0.85);
  for (let i = 0; i < 11; i++) line(32 + i * 0.65, 33.2, 39 + i * 0.65, 45.1);
  line(3, 48.5, 69, 48.5);

  label("ORDERED HALFTONE  0 / 25 / 50 / 75 / 100", 4, 49.7, 1.55, 64);
  for (let swatch = 0; swatch < 5; swatch++) {
    const x = 4 + swatch * 13, y = 53, pitch = 2 * dotMm;
    const threshold = swatch * 16;
    rect(x, y, 11, 12);
    for (let row = 0, yy = y + pitch / 2; yy < y + 12 - pitch / 2; row++, yy += pitch) {
      for (let col = 0, xx = x + pitch / 2; xx < x + 11 - pitch / 2; col++, xx += pitch) {
        if (bayer[(row % 8) * 8 + (col % 8)] < threshold) line(xx, yy, xx + 0.04, yy);
      }
    }
    label(String(swatch * 25), x + 1.2, 66, 1.8, 9);
  }
  line(3, 70.5, 69, 70.5);

  label("SMALL DETAIL", 4, 71.7, 1.7, 64);
  for (const [y, size] of [[74.5, 1.2], [78.4, 1.7], [82.8, 2.3]]) label("ABC 123 / 08", 4, y, size, 28);
  label("DOTS", 35, 73.5, 1.5, 12);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
    const x = 35 + col * 1.35, y = 76.5 + row * 2.2;
    line(x, y, x + [0.02, 0.08, 0.18, 0.35][row], y);
  }
  for (let i = 0; i < 14; i++) line(52 + i * 1.05, 75, 53.8 + i * 1.05, 85);
  line(3, 87.5, 69, 87.5);

  label("THERMAL LOAD / FEED", 4, 88.7, 1.55, 64);
  for (let bar = 0; bar < 16; bar += 2) {
    const x = 4 + bar * 4;
    for (let y = 91; y <= 95.5; y += 0.22) line(x, y, x + 4, y);
  }
  line(4, 97, 68, 97);
  for (let x = 4; x <= 68; x += 4) line(x, 96.4, x, 97.6);
  return applyStyle({ paths }, ins[0]);
}

export default {
  key: "testcard",
  name: "Test Card",
  cat: "gen",
  group: "structural",
  desc: "Calibration sheets for pen and machine, plus a Thermal receipt mode for Epson TM-T88V print-quality testing on a 72 × 100 mm canvas: 1–4-dot grids, circles and arcs, ordered black/white halftone swatches, tiny lettering and dots, and thermal-load bars. The printed 'grays' are dithered dots, not multilevel ink. Pen tests retain their line weight, spacing, hatch, lift, fill, registration, speed and 12-pen palette tiles.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Card", type: "select", options: ["Pen tests", "Thermal receipt"], def: "Pen tests" },
    { key: "tests", label: "Tests", type: "multi", options: ["Line weight sweep", "Line spacing", "Hatch density", "Line weight sweep (thick)", "Line spacing (thick)", "Hatch density (thick)", "Arcs & circles", "Pen-lift dots", "Fill swatches", "Registration", "Speed ramp", "Pen palette (12)"], def: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches"], showIf: (p) => p.mode !== "Thermal receipt" },
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 4, step: 1, def: 2, showIf: (p) => p.mode !== "Thermal receipt" },
    { key: "cell", label: "Cell size mm", type: "slider", min: 30, max: 120, step: 1, def: 62, showIf: (p) => p.mode !== "Thermal receipt" },
    { key: "gap", label: "Cell gap mm", type: "slider", min: 4, max: 30, step: 1, def: 12, showIf: (p) => p.mode !== "Thermal receipt" },
    { key: "labels", label: "Labels", type: "check", def: true, showIf: (p) => p.mode !== "Thermal receipt" },
    { key: "labelPen", label: "Label pen", type: "pen", def: 0, showIf: (p) => p.mode !== "Thermal receipt" },
    { key: "labelSize", label: "Label size mm", type: "slider", min: 1.5, max: 12, step: 0.5, def: 2.2, showIf: (p) => p.mode !== "Thermal receipt" && !!p.labels },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12, showIf: (p) => p.mode !== "Thermal receipt" },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    if (p.mode === "Thermal receipt") return thermalReceipt(ins, p, ctx);
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const AP = Math.round(p.labelPen);
    const m = p.margin;
    /* nimiokoko: 2.2 mm on vanha kiintea koko, LS skaalaa kaikki nimiot siita.
       otsikkokaista solun ylla kasvaa nimion mukana (oletuksena 6 mm kuten ennen). */
    const LSZ = Math.max(1.5, Math.min(12, Number.isFinite(+p.labelSize) ? +p.labelSize : 2.2));
    const LS = LSZ / 2.2;
    const hdr = 6 + 2.6 * Math.max(0, LSZ - 2.2);
    const paths = [];
    const line = (a, b, ly) => paths.push({ pts: [a, b], closed: false, layer: ly === undefined ? L : ly });
    const poly = (pts, closed, ly) => paths.push({ pts, closed: !!closed, layer: ly === undefined ? L : ly });
    const arc = (cx, cy, r, a0, a1, n) => {
      const pts = [];
      const N = n || 40;
      for (let k = 0; k <= N; k++) {
        const a = a0 + (a1 - a0) * (k / N);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      poly(pts, false);
    };
    const label = (str, x, y, sz, ly) => {
      const fs = fontStrokes(String(str), sz || 3.2, 1);
      for (const st of fs.strokes) paths.push({ pts: st.map(([gx, gy]) => [x + gx, y + gy]), closed: false, layer: ly === undefined ? AP : ly });
    };
    /* --- yksittaiset testit; kukin piirtaa soluun (x0,y0,cs) --- */
    const drawTest = (name, x0, y0, cs) => {
      const thick = /\(thick\)$/.test(name);
      const base = thick ? name.replace(/ \(thick\)$/, "") : name;
      /* thick: 4 mm nimiot ja isompi otsikko - 2 mm+ kyna ei piirra 2 mm merkkeja.
         kutistuvat solun mukana; fine-testit pysyvat ennallaan (2.2 / 3.4). */
      /* Label size on absoluuttinen numerokorkeus; thick-oletus (2.2) nostaa sen 4 mm:iin */
      const LZ = thick ? Math.max(LSZ, Math.min(4, (cs - 6) / 14)) : LSZ;
      if (p.labels) {
        /* otsikko kutistuu solun levyiseksi - pitkat nimet eivat vuoda viereiseen soluun.
           kun otsikkokaista on oletusta korkeampi (Label size > 2.2), leveyden takia
           kutistettu otsikko rivittyy kahdelle riville sanarajasta, joka antaa
           kapeimman rivin - ja saa nain isomman koon. */
        const tw = fontStrokes(name, 10, 1).width / 10;
        const target = Math.min((thick ? 4.5 : 3.4) * LS, cs * (thick ? 0.075 : 0.055) * LS, hdr + 0.4);
        let lines = [name];
        let tz = Math.min(target, tw > 0 ? cs / tw : target);
        if (hdr > 6 && tz < target * 0.9) {
          const words = name.split(" ");
          let best = null;
          for (let k = 1; k < words.length; k++) {
            const a = words.slice(0, k).join(" "), b = words.slice(k).join(" ");
            const w = Math.max(fontStrokes(a, 10, 1).width, fontStrokes(b, 10, 1).width) / 10;
            if (!best || w < best.w) best = { w, a, b };
          }
          if (best && best.w > 0) {
            const tz2 = Math.min(target, cs / best.w, (hdr + 0.4) / 2.25);
            if (tz2 > tz * 1.15) { lines = [best.a, best.b]; tz = tz2; }
          }
        }
        const yLast = y0 - 3 - Math.max(0, tz - 3.4);
        for (let li = 0; li < lines.length; li++) label(lines[li], x0, yLast - (lines.length - 1 - li) * tz * 1.25, tz);
      }
      const pad = 3;
      const ix = x0 + pad, iy = y0 + pad, iw = cs - pad * 2, ih = cs - pad * 2;
      if (base === "Line weight sweep") {
        /* sama viiva monta kertaa: yksi veto, 2, 3... paallekkain -> nakyva paksuus/peitto.
           plotterilla toistoveto tummentaa; nakee myos kohdistustarkkuuden. */
        const rows = 6;
        /* thick: 0.8 mm askel levittaa 2 mm+ kynan vedot nauhaksi; kutistuu pienissa soluissa */
        const off = thick ? Math.min(0.8, (ih / rows) * 0.14) : 0.15;
        /* nimio "6x" on 2.2 x korkeus levea; viiva lyhenee jos nimio ei muuten mahdu */
        const big = thick || LS > 1;
        const lz = big ? Math.min(thick ? LZ : 2.6 * LS, (ih / rows) * 0.85) : 2.6;
        const lx = big ? Math.min(ix + iw * 0.84, ix + iw - 2.2 * lz) : ix + iw * 0.84;
        const lend = (big && p.labels) ? Math.min(ix + iw * 0.8, lx - 1) : ix + iw * 0.8;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const passes = r + 1;
          for (let q = 0; q < passes; q++) {
            line([ix, y + (q - passes / 2) * off], [lend, y + (q - passes / 2) * off]);
          }
          if (p.labels) label(passes + "x", lx, thick ? y - lz / 2 : y + 1.2, lz);
        }
      } else if (base === "Line spacing") {
        /* tihenevat pystyviivat: nakee milloin viivat sulautuvat / kynan leveys.
           jokainen ryhma pysyy omassa kaistassaan (ei vuoda seuraavaan), nimiot
           vuorottelevat kahdella rivilla ja kutistuvat kahden kaistan levyisiksi.
           thick: sarja 2 mm+ kynille. */
        const gaps = thick ? [8, 6, 4.5, 3.5, 2.5, 2] : [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25];
        const pitch = iw / gaps.length;
        /* nimio vie cw x korkeus leveytta; rivit (2..3) valitaan niin etta se mahtuu */
        const target = thick ? LZ : 2.2 * LS;
        const cw = thick ? 2.7 : 3.6;
        const big = thick || LS > 1;
        const rowsL = big ? Math.max(2, Math.min(3, Math.ceil(((cw + 0.6) * target) / pitch))) : 2;
        const sz = big
          ? Math.max(1, Math.min(target, (rowsL * pitch) / (cw + 0.6)))
          : Math.max(1, Math.min(target, (rowsL * pitch - 0.8) / cw));
        const lineH = big ? Math.max(ih * 0.3, ih - (rowsL * (sz + 0.8) + 2.2)) : ih * 0.78;
        for (let g = 0; g < gaps.length; g++) {
          const grp = ix + g * pitch;
          for (let k = 0; k < 5; k++) {
            const xx = grp + k * gaps[g];
            if (xx > grp + pitch - 1) break;
            line([xx, iy], [xx, iy + lineH]);
          }
          if (p.labels) {
            /* isot nimiot tasataan oman kaistansa oikeaan reunaan: samalla rivilla olevat
               ovat rowsL kaistaa erillaan ja nimio on kapeampi, joten ne eivat tormaa,
               ja viimeinen paattyy tasan solun reunaan */
            const lx = big ? grp + pitch - fontStrokes(gaps[g] + "", sz, 1).width : grp;
            label(gaps[g] + "", lx, iy + lineH + 1.4 + (g % rowsL) * (sz + 0.8), sz);
          }
        }
      } else if (base === "Hatch density") {
        /* nelja ruutua kasvavalla viivoitustiheydella + ristikko. nimio ruudun ALLA
           omassa kaistassaan (sisalla se meni viivoituksen ja reunan paalle).
           thick: sarja 2 mm+ kynille. */
        const dens = thick ? [8, 5, 3.5, 2.5] : [2.5, 1.5, 1, 0.6];
        const labH = LZ + 1.2;
        for (let i = 0; i < 4; i++) {
          const qx = ix + (i % 2) * (iw / 2), qy = iy + Math.floor(i / 2) * (ih / 2);
          const qw = iw / 2 - 2, qh = Math.max(2, ih / 2 - labH - 1);
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true);
          for (let y = qy + dens[i]; y < qy + qh; y += dens[i]) line([qx, y], [qx + qw, y]);
          if (i >= 2) for (let x = qx + dens[i]; x < qx + qw; x += dens[i]) line([x, qy], [x, qy + qh]);
          if (p.labels) label(dens[i] + "", qx, qy + qh + 0.8, LZ);
        }
      } else if (base === "Arcs & circles") {
        /* sisakkaiset ympyrat + kaaria eri sateilla: nakee pyoreyden ja nykimisen */
        const cx = ix + iw / 2, cy = iy + ih / 2;
        for (let r = ih * 0.08; r < ih * 0.48; r += ih * 0.09) arc(cx, cy, r, 0, Math.PI * 2, Math.max(24, r * 3));
        /* pienet kaaret kulmassa: tiukka kaarre = nykiva jos kiihtyvyys liian iso */
        for (let i = 0; i < 4; i++) arc(ix + iw * 0.5, iy + ih * 0.5, 2 + i * 1.2, 0, Math.PI * 1.5, 20);
      } else if (name === "Pen-lift dots") {
        /* pisteruudukko: jokainen = nosto+lasku+minimiveto. testaa noston toistettavuutta
           ja settle-viivetta (jos kyna vetaa hannan -> viive liian pieni). */
        const n = 8;
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          const x = ix + (c + 0.5) * (iw / n), y = iy + (r + 0.5) * (ih / n);
          /* minimiveto: pieni risti, paljastaa hannat molempiin suuntiin */
          line([x - 0.6, y], [x + 0.6, y]);
          line([x, y - 0.6], [x, y + 0.6]);
        }
        if (p.labels) label("lift x" + (n * n), ix, iy + ih + 0.5, 2.4 * LS);
      } else if (name === "Fill swatches") {
        /* kolme taytto-tyylia: vaaka, ristikko, spiraali -> kynan peittavyys */
        const sw = iw / 3 - 1;
        /* 1 vaakatäytto */
        for (let y = iy; y < iy + ih * 0.7; y += 0.8) line([ix, y], [ix + sw, y]);
        /* 2 ristikko */
        const x2 = ix + iw / 3;
        for (let y = iy; y < iy + ih * 0.7; y += 1) line([x2, y], [x2 + sw, y]);
        for (let x = x2; x < x2 + sw; x += 1) line([x, iy], [x, iy + ih * 0.7]);
        /* 3 spiraali */
        const cx = ix + iw * 0.83, cy = iy + ih * 0.35, sp = [];
        for (let t = 0; t < Math.PI * 12; t += 0.25) {
          const rr = t * 0.28;
          if (rr > sw / 2) break;
          sp.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
        }
        poly(sp, false);
        if (p.labels) { label("flat", ix, iy + ih * 0.78, 2.4 * LS); label("grid", x2, iy + ih * 0.78, 2.4 * LS); label("spir", cx - sw / 3, iy + ih * 0.78, 2.4 * LS); }
      } else if (name === "Registration") {
        /* kohdistusristi + neliot: monikynatoiston tarkkuus */
        const cx = ix + iw / 2, cy = iy + ih / 2;
        line([cx - iw * 0.4, cy], [cx + iw * 0.4, cy]);
        line([cx, cy - ih * 0.4], [cx, cy + ih * 0.4]);
        for (const r of [iw * 0.12, iw * 0.24, iw * 0.36]) poly([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], true);
        arc(cx, cy, iw * 0.06, 0, Math.PI * 2, 24);
      } else if (name === "Speed ramp") {
        /* siksak jonka amplitudi/tiheys kasvaa: nopeat suunnanvaihdot paljastavat
           kiihtyvyysrajan (pyoristyvat kulmat / helinä). */
        const rows = 5;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const teeth = 4 + r * 4;
          const amp = ih / rows * 0.35;
          const pts = [];
          for (let k = 0; k <= teeth; k++) {
            pts.push([ix + (k / teeth) * iw, y + (k % 2 ? amp : -amp)]);
          }
          poly(pts, false);
          if (p.labels) label(teeth + "", ix + iw + 0.5, y + 1, 2.4 * LS);
        }
      } else if (name === "Pen palette (12)") {
        /* 12 ruutua, kukin OMALLA kynallaan: mustesavyt, paksuudet ja
           kynanvaihtojen kohdistus yhdella arkilla. label-kaista ruudun alla. */
        const pc = 4, pr = 3;
        const labH = p.labels ? 5 * LS : 1.5;
        for (let i = 0; i < PENS.length; i++) {
          const c = i % pc, r = Math.floor(i / pc);
          const cellW = iw / pc, cellH = ih / pr;
          const qw = cellW - 2.5, qh = cellH - labH - 1;
          const qx = ix + c * cellW, qy = iy + r * cellH;
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true, i);
          for (let y = qy + 1; y < qy + qh - 0.4; y += 1.1) line([qx + 0.8, y], [qx + qw - 0.8, y], i);
          if (p.labels) label(i + "", qx + qw / 2 - 1.2 * LS, qy + qh + 1.2, 2.4 * LS, i);
        }
      }
    };
    /* --- ruudukkoasettelu: solukoko kutistuu jos ruudukko ei mahdu arkille --- */
    // An explicitly empty checklist means no tests, including a Bang-off frame.
    const sel = Array.isArray(p.tests) ? p.tests : ["Line weight sweep"];
    const cols = Math.round(p.cols);
    const gap = p.gap;
    const rowsN = Math.ceil(sel.length / cols);
    let cs = p.cell;
    const fitW = (W - 2 * m - (cols - 1) * gap) / cols;
    const fitH = (H - 2 * m - hdr - (rowsN - 1) * (gap + hdr) - 6) / rowsN;
    cs = Math.max(24, Math.min(cs, fitW, fitH));
    const gridW = cols * cs + (cols - 1) * gap;
    const startX = m + Math.max(0, (W - 2 * m - gridW) / 2);
    let startY = m + hdr;
    sel.forEach((name, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x0 = startX + c * (cs + gap);
      const y0 = startY + r * (cs + gap + hdr);
      drawTest(name, x0, y0, cs);
    });
    return applyStyle({ paths }, ins[0]);
  },
};
