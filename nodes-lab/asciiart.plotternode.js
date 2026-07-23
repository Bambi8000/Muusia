({
  key: "asciiart",
  name: "ASCII Art",
  cat: "gen",
  group: "textimg",
  desc: "Renders line work or an image as plottable ASCII characters (single-stroke font). Source Lines rasterizes the wired paths into a density grid - the more line length in a cell, the darker its character; Source Image samples a loaded picture's darkness. Ramp orders characters light-to-dark (Custom takes your own string); characters missing from the stroke font fall back to uppercase or are skipped. Gamma bends the mapping, Invert flips it, Threshold leaves the lightest cells empty. Columns sets resolution; characters are real pen strokes, so the result plots like any other geometry.",
  fileImage: true,
  ins: [Pin("paths", "Lines (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "source", label: "Source", type: "select", options: ["Lines (wired)", "Image (file)"], def: "Lines (wired)" },
    { key: "filename", label: "Image (Image mode)", type: "file", def: "" },
    { key: "cols", label: "Columns", type: "slider", min: 10, max: 120, step: 1, def: 48 },
    { key: "aspect", label: "Cell aspect (h/w)", type: "slider", min: 1, max: 2.4, step: 0.05, def: 1.7 },
    { key: "ramp", label: "Ramp (light to dark)", type: "select", options: ["Classic .:-=+*x#%@", "Digits 1-9", "Letters iltxvzoahkmw", "Binary 01", "Custom"], def: "Digits 1-9" },
    { key: "rampCustom", label: "Custom ramp", type: "text", def: ".oO0" },
    { key: "gamma", label: "Gamma", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1 },
    { key: "invert", label: "Invert", type: "check", def: false },
    { key: "thresh", label: "Threshold", type: "slider", min: 0, max: 0.6, step: 0.02, def: 0.06 },
    { key: "charSize", label: "Char size % of cell", type: "slider", min: 40, max: 100, step: 1, def: 78 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  compute(ins, p, ctx, node) {
    const { W, H } = ctx;
    const m = Math.max(0, p.margin);
    const gw = W - 2 * m, gh = H - 2 * m;
    if (gw < 10 || gh < 10) return applyStyle({ paths: [] }, ins[1]);
    const cols = Math.max(2, Math.round(p.cols));
    const cw = gw / cols;
    const chh = cw * Math.max(1, p.aspect);
    const rows = Math.max(1, Math.floor(gh / chh));
    const oy0 = m + (gh - rows * chh) / 2;
    /* ---- density grid ---- */
    const dens = new Float64Array(cols * rows);
    if (p.source === "Image (file)") {
      const img = node && node.data && node.data.img;
      if (!img) return applyStyle({ paths: [] }, ins[1]);
      const sc = Math.min((cols * cw) / img.w, (rows * chh) / img.h);
      const iw = img.w * sc, ih = img.h * sc;
      const ix0 = (cols * cw - iw) / 2, iy0 = (rows * chh - ih) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw - ix0, y = (r + 0.5) * chh - iy0;
        if (x < 0 || x >= iw || y < 0 || y >= ih) continue;
        const px = Math.min(img.w - 1, Math.floor((x / iw) * img.w));
        const py = Math.min(img.h - 1, Math.floor((y / ih) * img.h));
        dens[r * cols + c] = img.g[py * img.w + px];
      }
    } else {
      const src = ins[0];
      if (!src || !src.paths || !src.paths.length) return applyStyle({ paths: [] }, ins[1]);
      const step = Math.min(cw, chh) / 3;
      for (const pa of src.paths) {
        const pts = resample(pa.pts, pa.closed, step);
        for (const [x, y] of pts) {
          const c = Math.floor((x - m) / cw), r = Math.floor((y - oy0) / chh);
          if (c >= 0 && c < cols && r >= 0 && r < rows) dens[r * cols + c] += 1;
        }
      }
      let mx = 0;
      for (let i = 0; i < dens.length; i++) if (dens[i] > mx) mx = dens[i];
      if (mx < 1e-9) return applyStyle({ paths: [] }, ins[1]);
      for (let i = 0; i < dens.length; i++) dens[i] /= mx;
    }
    /* ---- ramp, sanitized against the stroke font ---- */
    let rampSrc;
    if (p.ramp === "Digits 1-9") rampSrc = "123456789";
    else if (p.ramp === "Letters iltxvzoahkmw") rampSrc = "iltxvzoahkmw";
    else if (p.ramp === "Binary 01") rampSrc = "01";
    else if (p.ramp === "Custom") rampSrc = String(p.rampCustom || ".oO0");
    else rampSrc = ".:-=+*x#%@";
    const glyphOf = (ch) => (SFONT[ch] ? ch : SFONT[ch.toUpperCase()] ? ch.toUpperCase() : null);
    let ramp = [...rampSrc].map(glyphOf).filter(Boolean);
    if (!ramp.length) ramp = [..."123456789"].map(glyphOf).filter(Boolean);
    if (!ramp.length) return applyStyle({ paths: [] }, ins[1]);
    /* ---- draw ---- */
    const L = Math.round(p.layer);
    const gamma = Math.max(0.05, p.gamma);
    const size = chh * (p.charSize / 100) * 0.72;
    const paths = [];
    const BUDGET = 118000;
    let total = 0;
    for (let r = 0; r < rows && total < BUDGET; r++) {
      for (let c = 0; c < cols && total < BUDGET; c++) {
        let d = Math.pow(Math.max(0, Math.min(1, dens[r * cols + c])), gamma);
        if (p.invert) d = 1 - d;
        if (d < p.thresh) continue;
        const ch = ramp[Math.min(ramp.length - 1, Math.floor(d * ramp.length))];
        const fs = fontStrokes(ch, size, 1);
        const gx0 = m + c * cw + cw * 0.18;
        const gy0 = oy0 + r * chh + (chh - size) / 2;
        for (const st of fs.strokes) {
          if (st.length < 2 || total + st.length > BUDGET) continue;
          paths.push({ pts: st.map(([gx, gy]) => [gx0 + gx, gy0 + gy]), closed: false, layer: L });
          total += st.length;
        }
      }
    }
    return applyStyle({ paths }, ins[1]);
  },
})