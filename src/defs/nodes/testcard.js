import { Pin, PENS, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "testcard",
  name: "Test Card",
  cat: "gen",
  group: "structural",
  desc: "Calibration sheets for pen and machine: line weight sweep (repeat passes), converging line spacing, hatch density squares, arcs and tight circles, pen-lift dot grid, fill swatches, registration marks, a speed-ramp zigzag - and a Pen palette that draws one labelled swatch per pen (all 12) for ink checks. The three pen tests also come in (thick) variants with series chosen for 2 mm+ nibs (gaps 8 to 2 mm, hatch 8 to 2.5 mm, wider pass offsets) - set Pen to the thick pen and keep Label pen fine. The grid auto-shrinks its cells to fit the current canvas.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "tests", label: "Tests", type: "multi", options: ["Line weight sweep", "Line spacing", "Hatch density", "Line weight sweep (thick)", "Line spacing (thick)", "Hatch density (thick)", "Arcs & circles", "Pen-lift dots", "Fill swatches", "Registration", "Speed ramp", "Pen palette (12)"], def: ["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches"] },
    { key: "cols", label: "Columns", type: "slider", min: 1, max: 4, step: 1, def: 2 },
    { key: "cell", label: "Cell size mm", type: "slider", min: 30, max: 120, step: 1, def: 62 },
    { key: "gap", label: "Cell gap mm", type: "slider", min: 4, max: 30, step: 1, def: 12 },
    { key: "labels", label: "Labels", type: "check", def: true },
    { key: "labelPen", label: "Label pen", type: "pen", def: 0 },
    { key: "labelSize", label: "Label size mm", type: "slider", min: 1.5, max: 12, step: 0.5, def: 2.2, showIf: (p) => !!p.labels },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx) {
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
    const sel = (p.tests && p.tests.length ? p.tests : ["Line weight sweep"]);
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