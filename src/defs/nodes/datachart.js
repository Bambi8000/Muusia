import { Pin, EMPTY, applyStyle, fontStrokes } from "../helpers.js";

export default {
  /* Data Chart — plottable charts from imported data. Data comes from a CSV /
     TSV / JSON file (onFile -> node.data.svg, engine convention) or from the
     Data text param (rows separated by ";" or newlines, cells by "," or tab).
     First column may hold category labels; a header row is detected when the
     first row is non-numeric; every further numeric column is a series.
     Eight chart types share one axis/label/legend layer; bars and donut
     wedges are filled with hatch lines, text is drawn with the stroke font. */
  key: "datachart",
  name: "Data Chart",
  cat: "gen",
  group: "scientific",
  desc: "Plottable charts from your own data. Load a CSV, TSV or JSON file (first column labels, further columns numeric series, header row optional; JSON as an array of objects or arrays) or paste rows straight into Data, separated by ; with label,value cells. Chart picks Bars, Stacked bars, Lollipop, Lines, Area, Scatter (first two numeric columns as x and y), Donut or Radar; several series get one pen each when Cycle pens is on. Axes, Grid and Ticks draw the frame on the Frame pen with a nice 1-2-5 value scale that includes zero; Labels writes categories, tick values, legend and Title in the stroke font at Label size. Fill hatches bars and wedges (None / Hatch / Cross, Fill density), Bar width sets the bar-to-slot ratio, Smooth rounds lines, Markers dots the data points, Sort reorders categories by the first series. Everything stays inside Margin.",
  fileLabel: "Choose data file\u2026",
  fileAccept: ".csv,.tsv,.txt,.json,text/csv,application/json",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "src", label: "Data file (CSV / TSV / JSON)", type: "file", def: "" },
    { key: "data", label: "Data (rows ; cells , - used when no file)", type: "text", def: "Jan,12,8;Feb,19,11;Mar,7,14;Apr,23,9;May,17,16;Jun,30,12;Jul,26,20;Aug,14,18" },
    { key: "chart", label: "Chart", type: "select", options: ["Bars", "Stacked bars", "Lollipop", "Lines", "Area", "Scatter", "Donut", "Radar"], def: "Bars" },
    { key: "title", label: "Title", type: "text", def: "" },
    { key: "labels", label: "Labels", type: "check", def: true },
    { key: "labelSize", label: "Label size mm", type: "slider", min: 1.5, max: 10, step: 0.25, def: 3.5, showIf: (p) => !!p.labels },
    { key: "axes", label: "Axes", type: "check", def: true },
    { key: "grid", label: "Grid", type: "check", def: true },
    { key: "ticks", label: "Ticks", type: "slider", min: 2, max: 12, step: 1, def: 5 },
    { key: "fill", label: "Fill", type: "select", options: ["None", "Hatch", "Cross"], def: "Hatch" },
    { key: "fillDens", label: "Fill density", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.45, showIf: (p) => p.fill !== "None" },
    { key: "barW", label: "Bar width", type: "slider", min: 0.2, max: 1, step: 0.05, def: 0.65 },
    { key: "smooth", label: "Smooth lines", type: "check", def: false },
    { key: "markers", label: "Markers", type: "check", def: true },
    { key: "sort", label: "Sort", type: "select", options: ["None", "Ascending", "Descending"], def: "None" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "layer", label: "Frame pen", type: "pen", def: 0 },
    { key: "seriesPen", label: "Series pen", type: "pen", def: 1 },
    { key: "cyclePens", label: "Cycle pens per series", type: "check", def: true },
    { key: "gridPen", label: "Grid pen", type: "pen", def: 9 },
  ],

  /* ---- parsing: text -> { cats, series:[{name, values}] } ---- */
  _parse(text) {
    const t = String(text == null ? "" : text).trim();
    if (!t) return { cats: [], series: [] };
    let rows = [];
    if (/^[\[{]/.test(t)) {
      try {
        const j = JSON.parse(t);
        const arr = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : Array.isArray(j.rows) ? j.rows : [];
        if (arr.length && Array.isArray(arr[0])) rows = arr.map((r) => r.map((v) => String(v)));
        else if (arr.length && typeof arr[0] === "object" && arr[0]) { const keys = Object.keys(arr[0]); rows = [keys, ...arr.map((o) => keys.map((k) => String(o[k] == null ? "" : o[k])))]; }
      } catch (e) { rows = []; }
    }
    if (!rows.length) {
      const lines = t.split(/\r?\n/).length > 1 ? t.split(/\r?\n/) : t.split(/;/);
      const first = lines.find((l) => l.trim()) || "";
      const delim = (first.match(/\t/g) || []).length ? "\t" : (first.match(/;/g) || []).length && t.split(/\r?\n/).length > 1 ? ";" : ",";
      const decimalComma = delim !== ",";
      rows = lines.map((l) => l.trim()).filter((l) => l.length).map((l) => l.split(delim).map((c) => { c = c.trim().replace(/^"|"$/g, ""); return decimalComma ? c.replace(/,/g, ".") : c; }));
    }
    rows = rows.filter((r) => r.length && r.some((c) => c !== ""));
    if (!rows.length) return { cats: [], series: [] };
    const num = (c) => { const v = parseFloat(String(c).replace(/\s/g, "")); return Number.isFinite(v) ? v : null; };
    const ncol = Math.max(...rows.map((r) => r.length));
    /* header: first row has a non-numeric cell in a column that is numeric in the rest */
    const colNumeric = (ci, from) => rows.slice(from).some((r) => num(r[ci]) !== null) && rows.slice(from).every((r) => r[ci] === undefined || r[ci] === "" || num(r[ci]) !== null);
    let header = null;
    if (rows.length > 1) { const hasNonNum = rows[0].some((c, ci) => num(c) === null && colNumeric(ci, 1)); if (hasNonNum) header = rows.shift(); }
    const labelCol = !colNumeric(0, 0) ? 0 : -1;
    const cats = rows.map((r, i) => (labelCol === 0 ? String(r[0]) : String(i + 1)));
    const series = [];
    for (let ci = 0; ci < ncol; ci++) {
      if (ci === labelCol) continue;
      if (!colNumeric(ci, 0)) continue;
      series.push({ name: header && header[ci] ? String(header[ci]) : "S" + (series.length + 1), values: rows.map((r) => { const v = num(r[ci]); return v === null ? 0 : v; }) });
    }
    return { cats, series };
  },
  onFile(text) { return this && this._parse ? this._parse(text) : { cats: [], series: [] }; },

  overlay(p, ctx) {
    try {
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const m = Math.max(0, Math.min(+(p && p.margin) || 0, Math.min(W, H) / 2 - 1));
      return [{ kind: "rect", x: m, y: m, w: W - 2 * m, h: H - 2 * m }];
    } catch (e) { return []; }
  },

  compute(ins, p, ctx, node) {
    const W = ctx.W, H = ctx.H;
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const m = Math.max(0, Math.min(cl(p.margin, 0, 1e4), Math.min(W, H) / 2 - 1));
    const penF = Math.max(0, Math.min(11, Math.round(+p.layer || 0)));
    const penS0 = Math.max(0, Math.min(11, Math.round(+p.seriesPen || 0)));
    const penG = Math.max(0, Math.min(11, Math.round(+p.gridPen || 0)));
    const sPen = (i) => (p.cyclePens ? (penS0 + i) % 12 : penS0);
    const fileData = node && node.data && node.data.svg && Array.isArray(node.data.svg.series) ? node.data.svg : null;
    let D = fileData || this._parse(p.data);
    if (!D.series.length || !D.cats.length) return EMPTY;
    /* sort by the first series */
    if (p.sort !== "None") {
      const idx = D.cats.map((_, i) => i).sort((a, b) => (D.series[0].values[a] - D.series[0].values[b]) * (p.sort === "Ascending" ? 1 : -1));
      D = { cats: idx.map((i) => D.cats[i]), series: D.series.map((s) => ({ name: s.name, values: idx.map((i) => s.values[i]) })) };
    }
    const N = D.cats.length, S = D.series.length;
    const paths = [];
    let budget = 115000;
    const emit = (pts, layer, closed) => { if (pts.length < 2 || budget <= 0) return; budget -= pts.length; paths.push({ pts, closed: !!closed, layer }); };
    const ls = cl(p.labelSize, 0.5, 50);
    const labelsOn = !!p.labels;
    /* text: top-left anchored stroke font, y down; align l / c / r */
    const text = (str, x, y, size, align, layer, rot) => {
      const F = fontStrokes(String(str), size, 1);
      const ox = align === "c" ? -F.width / 2 : align === "r" ? -F.width : 0;
      const ca = Math.cos(rot || 0), sa = Math.sin(rot || 0);
      /* keep the glyph box inside the margin box: shift, never clip */
      const corners = [[ox, 0], [ox + F.width, 0], [ox, size], [ox + F.width, size]].map(([u, v]) => [x + u * ca - v * sa, y + u * sa + v * ca]);
      let dx = 0, dy = 0;
      const minX = Math.min(...corners.map((c) => c[0])), maxX = Math.max(...corners.map((c) => c[0]));
      const minY = Math.min(...corners.map((c) => c[1])), maxY = Math.max(...corners.map((c) => c[1]));
      if (minX < m) dx = m - minX; else if (maxX > W - m) dx = W - m - maxX;
      if (minY < m) dy = m - minY; else if (maxY > H - m) dy = H - m - maxY;
      for (const st of F.strokes) emit(st.map(([gx, gy]) => [x + dx + (gx + ox) * ca - gy * sa, y + dy + (gx + ox) * sa + gy * ca]), layer);
      return F.width;
    };
    const textW = (str, size) => fontStrokes(String(str), size, 1).width;
    const fmt = (v) => { const a = Math.abs(v); const s = a >= 100 ? v.toFixed(0) : a >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString(); return s; };
    /* hatch an axis-aligned rect */
    const dens = cl(p.fillDens, 0.05, 1);
    const hatchRect = (x, y, w, h, layer) => {
      if (p.fill === "None" || w <= 0 || h <= 0) return;
      const sp = Math.max(0.5, 3.4 - 2.9 * dens);
      const angles = p.fill === "Cross" ? [Math.PI / 4, -Math.PI / 4] : [Math.PI / 4];
      for (const a of angles) {
        const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
        const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2 + sp;
        let flip = false;
        for (let d = -R; d <= R; d += sp) {
          const ox = cx + nx * d, oy = cy + ny * d;
          let t0 = -Infinity, t1 = Infinity;
          for (const [o, dir, lo, hi] of [[ox, ca, x, x + w], [oy, sa, y, y + h]]) {
            if (Math.abs(dir) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; } continue; }
            const ta = (lo - o) / dir, tb = (hi - o) / dir; t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
          }
          if (t1 - t0 < 0.3) continue;
          const A = [ox + ca * t0, oy + sa * t0], B = [ox + ca * t1, oy + sa * t1];
          emit(flip ? [B, A] : [A, B], layer); flip = !flip;
        }
      }
    };
    const rect = (x, y, w, h, layer) => emit([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], layer, true);
    const circle = (cx, cy, r, layer, n) => { const k = n || Math.max(8, Math.min(48, Math.round(r * 4))); const pts = []; for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } emit(pts, layer, true); };
    /* nice scale including zero */
    const allVals = D.series.flatMap((s) => s.values);
    const stacked = p.chart === "Stacked bars";
    let vMax = stacked ? Math.max(...D.cats.map((_, i) => D.series.reduce((a, s) => a + Math.max(0, s.values[i]), 0))) : Math.max(...allVals);
    let vMin = stacked ? Math.min(0, ...D.cats.map((_, i) => D.series.reduce((a, s) => a + Math.min(0, s.values[i]), 0))) : Math.min(...allVals);
    vMax = Math.max(vMax, 0); vMin = Math.min(vMin, 0);
    if (vMax - vMin < 1e-9) vMax = vMin + 1;
    const nTicks = Math.max(2, Math.min(20, Math.round(+p.ticks || 5)));
    const niceStep = (range, n) => { const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw))); const r = raw / mag; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag; };
    const step = niceStep(vMax - vMin, nTicks);
    const tMax = Math.ceil(vMax / step - 1e-9) * step, tMin = Math.floor(vMin / step + 1e-9) * step;

    /* ---- layout ---- */
    let top = m, left = m, right = W - m, bottom = H - m;
    const title = String(p.title == null ? "" : p.title).trim();
    if (labelsOn && title) { text(title, W / 2, top, ls * 1.4, "c", penF); top += ls * 1.4 + ls; }
    const isPolar = p.chart === "Donut" || p.chart === "Radar";
    const legendOn = labelsOn && S > 1 && p.chart !== "Donut" && p.chart !== "Scatter";
    if (legendOn && !isPolar) { /* legend row above the plot: swatch + name per series */
      let lx = left; const lh = ls;
      const widths = D.series.map((s) => textW(s.name, ls) + lh * 2.6);
      const total = widths.reduce((a, b) => a + b, 0);
      lx = Math.max(left, W / 2 - total / 2);
      D.series.forEach((s, i) => { rect(lx, top, lh, lh, sPen(i)); if (p.fill !== "None") hatchRect(lx, top, lh, lh, sPen(i)); text(s.name, lx + lh * 1.5, top, ls, "l", penF); lx += widths[i]; });
      top += ls * 2;
    }
    if (!isPolar) {
      const tickW = labelsOn ? Math.max(...[tMin, tMax].map((v) => textW(fmt(v), ls))) + ls * 0.8 : 0;
      const scatter0 = p.chart === "Scatter";
      const maxCatW = labelsOn && !scatter0 ? Math.max(...D.cats.map((c) => textW(c, ls))) : 0;
      const rotCats = maxCatW > ((right - left - tickW) / N) * 0.9;
      const catH = labelsOn ? (rotCats ? ls * 0.8 + (maxCatW + ls) * 0.707 : ls * 1.8) : 0;
      /* markers poke past the data extremes: reserve their radius at the plot edges */
      const mr = scatter0 ? 4.6 : p.chart === "Lollipop" ? ls * 1.2 + 0.2 : p.markers && (p.chart === "Lines" || p.chart === "Area") ? ls * 0.3 + 0.6 : 0;
      const px0 = left + tickW, px1 = right - mr, py0 = top + ls * 0.5 + mr, py1 = bottom - catH;
      const pw = Math.max(1, px1 - px0), ph = Math.max(1, py1 - py0);
      const Y = (v) => py1 - ((v - tMin) / (tMax - tMin)) * ph;
      const scatter = p.chart === "Scatter";
      /* x scale */
      let xOf, xMinS = 0, xMaxS = 1;
      if (scatter && S >= 2) { const xs = D.series[0].values; xMinS = Math.min(...xs); xMaxS = Math.max(...xs); if (xMaxS - xMinS < 1e-9) xMaxS = xMinS + 1; const sx = niceStep(xMaxS - xMinS, nTicks); xMinS = Math.floor(xMinS / sx) * sx; xMaxS = Math.ceil(xMaxS / sx) * sx; xOf = (v) => px0 + ((v - xMinS) / (xMaxS - xMinS)) * pw; }
      else xOf = (i) => px0 + ((i + 0.5) / N) * pw;
      /* grid + ticks */
      for (let v = tMin; v <= tMax + step * 1e-6; v += step) {
        const y = Y(v);
        if (p.grid && Math.abs(v) > 1e-9) emit([[px0, y], [px1, y]], penG);
        if (p.axes) emit([[px0 - ls * 0.4, y], [px0, y]], penF);
        if (labelsOn) text(fmt(v), px0 - ls * 0.7, y - ls / 2, ls, "r", penF);
      }
      if (p.axes) { emit([[px0, py0], [px0, py1]], penF); emit([[px0, Y(0)], [px1, Y(0)]], penF); }
      /* category labels */
      if (labelsOn && !scatter) {
        /* long labels run up toward their tick at 45 deg, ending just under the axis */
        D.cats.forEach((c, i) => { const x = xOf(i); if (rotCats) text(c, x, py1 + ls * 0.9, ls, "r", penF, -Math.PI / 4); else text(c, x, py1 + ls * 0.6, ls, "c", penF); });
      }
      if (labelsOn && scatter && S >= 2) {
        const sx = niceStep(xMaxS - xMinS, nTicks);
        for (let v = xMinS; v <= xMaxS + sx * 1e-6; v += sx) { const x = xOf(v); if (p.axes) emit([[x, py1], [x, py1 + ls * 0.4]], penF); text(fmt(v), x, py1 + ls * 0.6, ls, "c", penF); }
        /* axis titles instead of a legend: x series name bottom right, y series name top left */
        text(D.series[0].name, px1, py1 + ls * 0.6, ls, "r", penF, 0);
        text(D.series[1].name, px0 + ls * 0.4, py0 - ls * 0.4, ls, "l", penF, 0);
      }
      /* series */
      const bw = cl(p.barW, 0.05, 1);
      if (p.chart === "Bars" || p.chart === "Lollipop") {
        const slot = pw / N, groupW = slot * bw, each = groupW / S;
        D.series.forEach((s, si) => s.values.forEach((v, i) => {
          const xc = xOf(i) - groupW / 2 + each * (si + 0.5), y0 = Y(0), y1 = Y(v);
          if (p.chart === "Bars") { const bx = xc - each / 2 * 0.92, bwid = each * 0.92; rect(bx, Math.min(y0, y1), bwid, Math.abs(y1 - y0), sPen(si)); hatchRect(bx, Math.min(y0, y1), bwid, Math.abs(y1 - y0), sPen(si)); }
          else { emit([[xc, y0], [xc, y1]], sPen(si)); circle(xc, y1, Math.min(ls * 1.2, Math.max(0.8, each * 0.18)), sPen(si)); }
        }));
      } else if (stacked) {
        const slot = pw / N, bwid = slot * bw;
        for (let i = 0; i < N; i++) {
          let up = 0, down = 0;
          D.series.forEach((s, si) => { const v = s.values[i]; const base = v >= 0 ? up : down; const y0 = Y(base), y1 = Y(base + v); const bx = xOf(i) - bwid / 2; rect(bx, Math.min(y0, y1), bwid, Math.abs(y1 - y0), sPen(si)); hatchRect(bx, Math.min(y0, y1), bwid, Math.abs(y1 - y0), sPen(si)); if (v >= 0) up += v; else down += v; });
        }
      } else if (p.chart === "Lines" || p.chart === "Area") {
        D.series.forEach((s, si) => {
          let pts = s.values.map((v, i) => [xOf(i), Y(v)]);
          if (p.smooth && pts.length > 2) { /* Catmull-Rom */
            const out = []; for (let i = 0; i < pts.length - 1; i++) { const P0 = pts[Math.max(0, i - 1)], P1 = pts[i], P2 = pts[i + 1], P3 = pts[Math.min(pts.length - 1, i + 2)]; for (let k = 0; k < 8; k++) { const u = k / 8, u2 = u * u, u3 = u2 * u; out.push([0.5 * (2 * P1[0] + (-P0[0] + P2[0]) * u + (2 * P0[0] - 5 * P1[0] + 4 * P2[0] - P3[0]) * u2 + (-P0[0] + 3 * P1[0] - 3 * P2[0] + P3[0]) * u3), 0.5 * (2 * P1[1] + (-P0[1] + P2[1]) * u + (2 * P0[1] - 5 * P1[1] + 4 * P2[1] - P3[1]) * u2 + (-P0[1] + 3 * P1[1] - 3 * P2[1] + P3[1]) * u3)]); } } out.push(pts[pts.length - 1]); pts = out;
          }
          emit(pts, sPen(si));
          if (p.chart === "Area") {
            /* close down to zero and hatch with vertical lines clipped under the curve */
            emit([[pts[0][0], Y(0)], pts[0]], sPen(si)); emit([pts[pts.length - 1], [pts[pts.length - 1][0], Y(0)]], sPen(si));
            if (p.fill !== "None") { const sp = Math.max(0.6, 3.4 - 2.9 * dens); let flip = false; for (let x = pts[0][0] + sp; x < pts[pts.length - 1][0]; x += sp) { let j = 0; while (j < pts.length - 2 && pts[j + 1][0] < x) j++; const a = pts[j], b = pts[j + 1]; const t = (x - a[0]) / ((b[0] - a[0]) || 1); const y = a[1] + (b[1] - a[1]) * t; const seg = flip ? [[x, y], [x, Y(0)]] : [[x, Y(0)], [x, y]]; if (Math.abs(y - Y(0)) > 0.3) emit(seg, sPen(si)); flip = !flip; } }
          }
          if (p.markers) s.values.forEach((v, i) => circle(xOf(i), Y(v), ls * 0.25 + 0.4, sPen(si), 10));
        });
      } else if (scatter) {
        /* two numeric columns: x, y (third scales the marker); one column: index vs value */
        const xs = S >= 2 ? D.series[0].values : D.cats.map((_, i) => i), ys = S >= 2 ? D.series[1].values : D.series[0].values, zs = S >= 3 ? D.series[2].values : null;
        const zMax = zs ? Math.max(...zs.map(Math.abs), 1e-9) : 1;
        for (let i = 0; i < N; i++) { const r = zs ? 0.8 + 3.5 * Math.sqrt(Math.abs(zs[i]) / zMax) : ls * 0.3 + 0.5; const x = xOf(xs[i]), y = Y(ys[i]); circle(x, y, r, sPen(0)); if (p.fill !== "None" && zs) circle(x, y, r * 0.6, sPen(0)); }
      }
    } else {
      /* ---- polar charts ---- */
      const cx = (left + right) / 2, cy = (top + bottom) / 2 + (legendOn ? 0 : 0);
      const R = Math.max(2, Math.min(right - left, bottom - top) / 2 - (labelsOn ? ls * 3.2 : ls * 0.5));
      if (p.chart === "Donut") {
        const vals = D.series[0].values.map((v) => Math.max(0, v)), tot = vals.reduce((a, b) => a + b, 0) || 1;
        const r0 = R * 0.5, r1 = R;
        let a = -Math.PI / 2;
        const arc = (r, a0, a1) => { const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 1.2)); const pts = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * (i / n); pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return pts; };
        vals.forEach((v, i) => {
          const a1 = a + (v / tot) * Math.PI * 2; if (a1 - a < 1e-6) return;
          const outer = arc(r1, a, a1), inner = arc(r0, a1, a).slice(0);
          emit([...outer, ...inner], sPen(i), true);
          if (p.fill !== "None") { const sp = Math.max(0.9, (3.4 - 2.9 * dens) * 1.6); const n = Math.max(1, Math.floor(((a1 - a) * (r0 + r1) / 2) / sp)); let flip = false; for (let k = 1; k < n; k++) { const t = a + (a1 - a) * (k / n); const A = [cx + Math.cos(t) * r0, cy + Math.sin(t) * r0], B = [cx + Math.cos(t) * r1, cy + Math.sin(t) * r1]; emit(flip ? [B, A] : [A, B], sPen(i)); flip = !flip; } }
          if (labelsOn) { const mid = (a + a1) / 2, lx = cx + Math.cos(mid) * (r1 + ls * 0.8), ly = cy + Math.sin(mid) * (r1 + ls * 0.8); text(D.cats[i] + " " + fmt(v), lx, ly - ls / 2, ls, Math.cos(mid) < -0.2 ? "r" : Math.cos(mid) > 0.2 ? "l" : "c", penF); }
          a = a1;
        });
      } else { /* Radar */
        const spokes = N;
        const rings = nTicks;
        for (let k = 1; k <= rings; k++) { const r = (R * k) / rings; const pts = []; for (let i = 0; i < spokes; i++) { const t = -Math.PI / 2 + (i / spokes) * Math.PI * 2; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } if (p.grid || k === rings) emit(pts, k === rings ? penF : penG, true); }
        for (let i = 0; i < spokes; i++) { const t = -Math.PI / 2 + (i / spokes) * Math.PI * 2; if (p.axes) emit([[cx, cy], [cx + Math.cos(t) * R, cy + Math.sin(t) * R]], penG); if (labelsOn) text(D.cats[i], cx + Math.cos(t) * (R + ls * 0.8), cy + Math.sin(t) * (R + ls * 0.8) - ls / 2, ls, Math.cos(t) < -0.2 ? "r" : Math.cos(t) > 0.2 ? "l" : "c", penF); }
        const rOf = (v) => (R * Math.max(0, v - Math.min(0, tMin))) / (tMax - Math.min(0, tMin));
        D.series.forEach((s, si) => { const pts = s.values.map((v, i) => { const t = -Math.PI / 2 + (i / spokes) * Math.PI * 2; return [cx + Math.cos(t) * rOf(v), cy + Math.sin(t) * rOf(v)]; }); emit(pts, sPen(si), true); if (p.markers) pts.forEach((q) => circle(q[0], q[1], ls * 0.25 + 0.4, sPen(si), 10)); });
        if (labelsOn) text(fmt(tMax), cx + ls * 0.4, cy - R - ls * 0.2, ls * 0.8, "l", penG);
      }
      if (legendOn) { let ly = top; D.series.forEach((s, i) => { rect(left, ly, ls, ls, sPen(i)); text(s.name, left + ls * 1.5, ly, ls, "l", penF); ly += ls * 1.6; }); }
    }
    /* clamp to sheet */
    for (const q of paths) q.pts = q.pts.map(([x, y]) => [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
    return applyStyle({ paths }, ins[0]);
  },
};
