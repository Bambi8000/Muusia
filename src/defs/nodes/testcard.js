import { Pin, PENS, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "testcard",
  name: "Test Card",
  cat: "gen",
  group: "structural",
  desc: "Calibration sheets for pen and machine: line weight sweep (repeat passes), converging line spacing, hatch density squares, arcs and tight circles, pen-lift dot grid, fill swatches, registration marks, a speed-ramp zigzag - and a Pen palette that draws one labelled swatch per pen (all 12) for ink checks. The grid auto-shrinks its cells to fit the current canvas.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "tests", label: "Tests", type: "multi", options: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches", "Registration", "Speed ramp", "Pen palette (12)"], def: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches"] },
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 4, step: 1, def: 2 },
    { key: "cell", label: "Cell size mm", type: "slider", min: 30, max: 120, step: 1, def: 62 },
    { key: "gap", label: "Cell gap mm", type: "slider", min: 4, max: 30, step: 1, def: 12 },
    { key: "labels", label: "Labels", type: "check", def: true },
    { key: "labelPen", label: "Label pen", type: "pen", def: 0 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
    const { W, H } = ctx;
    const L = Math.round(p.layer);
    const AP = Math.round(p.labelPen);
    const m = p.margin;
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
      if (p.labels) label(name, x0, y0 - 3, Math.min(3.4, cs * 0.055));
      const pad = 3;
      const ix = x0 + pad, iy = y0 + pad, iw = cs - pad * 2, ih = cs - pad * 2;
      if (name === "Line weight sweep") {
        /* sama viiva monta kertaa: yksi veto, 2, 3... paallekkain -> nakyva paksuus/peitto.
           plotterilla toistoveto tummentaa; nakee myos kohdistustarkkuuden. */
        const rows = 6;
        for (let r = 0; r < rows; r++) {
          const y = iy + (r + 0.5) * (ih / rows);
          const passes = r + 1;
          for (let q = 0; q < passes; q++) {
            line([ix, y + (q - passes / 2) * 0.15], [ix + iw * 0.8, y + (q - passes / 2) * 0.15]);
          }
          if (p.labels) label(passes + "x", ix + iw * 0.84, y + 1.2, 2.6);
        }
      } else if (name === "Line spacing") {
        /* tihenevat pystyviivat: nakee milloin viivat sulautuvat / kynan leveys */
        const gaps = [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25];
        let x = ix;
        for (let g = 0; g < gaps.length && x < ix + iw; g++) {
          const grp = ix + (g / gaps.length) * iw;
          for (let k = 0; k < 5; k++) {
            const xx = grp + k * gaps[g];
            if (xx < ix + iw) line([xx, iy], [xx, iy + ih * 0.82]);
          }
          if (p.labels) label(gaps[g] + "", grp, iy + ih * 0.9, 2.2);
        }
      } else if (name === "Hatch density") {
        /* nelja ruutua kasvavalla viivoitustiheydella + ristikko */
        const dens = [2.5, 1.5, 1, 0.6];
        for (let i = 0; i < 4; i++) {
          const qx = ix + (i % 2) * (iw / 2), qy = iy + Math.floor(i / 2) * (ih / 2);
          const qw = iw / 2 - 2, qh = ih / 2 - 2;
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true);
          for (let y = qy + dens[i]; y < qy + qh; y += dens[i]) line([qx, y], [qx + qw, y]);
          if (i >= 2) for (let x = qx + dens[i]; x < qx + qw; x += dens[i]) line([x, qy], [x, qy + qh]);
          if (p.labels) label(dens[i] + "", qx + 1, qy + qh - 1, 2.2);
        }
      } else if (name === "Arcs & circles") {
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
        if (p.labels) label("lift x" + (n * n), ix, iy + ih + 0.5, 2.4);
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
        if (p.labels) { label("flat", ix, iy + ih * 0.78, 2.4); label("grid", x2, iy + ih * 0.78, 2.4); label("spir", cx - sw / 3, iy + ih * 0.78, 2.4); }
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
          if (p.labels) label(teeth + "", ix + iw + 0.5, y + 1, 2.4);
        }
      } else if (name === "Pen palette (12)") {
        /* 12 ruutua, kukin OMALLA kynallaan: mustesavyt, paksuudet ja
           kynanvaihtojen kohdistus yhdella arkilla. label-kaista ruudun alla. */
        const pc = 4, pr = 3;
        const labH = p.labels ? 5 : 1.5;
        for (let i = 0; i < PENS.length; i++) {
          const c = i % pc, r = Math.floor(i / pc);
          const cellW = iw / pc, cellH = ih / pr;
          const qw = cellW - 2.5, qh = cellH - labH - 1;
          const qx = ix + c * cellW, qy = iy + r * cellH;
          poly([[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]], true, i);
          for (let y = qy + 1; y < qy + qh - 0.4; y += 1.1) line([qx + 0.8, y], [qx + qw - 0.8, y], i);
          if (p.labels) label(i + "", qx + qw / 2 - 1.2, qy + qh + 1.2, 2.4, i);
        }
      }
    };
    /* --- ruudukkoasettelu: solukoko kutistuu jos ruudukko ei mahdu arkille --- */
    const sel = (p.tests && p.tests.length ? p.tests : ["Line weight sweep"]);
    const cols = Math.round(p.cols);
    const gap = p.gap;
    const rowsN = Math.ceil(sel.length / cols);
    let cs = p.cell;
    const fitW = (W - 2 * m - (cols - 1) * gap) / cols;
    const fitH = (H - 2 * m - 6 - (rowsN - 1) * (gap + 6) - 6) / rowsN;
    cs = Math.max(24, Math.min(cs, fitW, fitH));
    const gridW = cols * cs + (cols - 1) * gap;
    const startX = m + Math.max(0, (W - 2 * m - gridW) / 2);
    let startY = m + 6;
    sel.forEach((name, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x0 = startX + c * (cs + gap);
      const y0 = startY + r * (cs + gap + 6);
      drawTest(name, x0, y0, cs);
    });
    return applyStyle({ paths }, ins[0]);
  },
};