import { Pin, EMPTY, applyStyle, fontStrokes } from "../helpers.js";

export default {
  key: "braille",
  name: "Braille",
  cat: "gen",
  group: "textimg",
  desc: "Grade 1 braille text as a grid of dot circles at standard geometry (2.5 mm dot pitch, 6 mm cell, 10 mm line at Scale 1) — chain into Needle Punch with Punch at: Centers to pierce every dot, or plot the circles directly with a pen. Letters a-z plus Nordic \u00e5/\u00e4/\u00f6; digits get the number sign, capitals the capital sign (Capital marks); punctuation follows the Finnish table (piste 3, huutomerkki 256, plus/sulut/yhtasuuruus included). | starts a new line. Mirror flips the whole block like a stamp (cells reverse AND dot columns swap) for punching from the front and reading embossed bumps from the back. When the node is selected, an overlay shows each cell's letter above it, unmirrored and readable (Show letters toggles this off). Unknown characters are skipped.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "text", label: "Text (| = new line)", type: "text", def: "MUUSIA" },
    { key: "tx", label: "X (mm)", type: "slider", min: 0, max: 200, step: 1, def: 20 },
    { key: "ty", label: "Y (mm)", type: "slider", min: 0, max: 280, step: 1, def: 30 },
    { key: "scale", label: "Scale", type: "slider", min: 0.5, max: 4, step: 0.05, def: 1 },
    { key: "dotR", label: "Dot size (mm)", type: "slider", min: 0.2, max: 2, step: 0.05, def: 0.6 },
    { key: "caps", label: "Capital marks", type: "check", def: true },
    { key: "mirror", label: "Mirror (punch side)", type: "check", def: false },
    { key: "guides", label: "Show letters", type: "check", def: true },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  /* Shared by compute and overlay (called as this._layout so guides always
     match the plotted dots; the engine invokes compute/overlay as methods on
     the def, so `this` is bound). Grade 1 braille, dots 1-6:  1 4
                                                               2 5
                                                               3 6
     Letters + Nordic \u00e5/\u00e4/\u00f6; digits = a-j behind the number sign (3456);
     capitals get the capital sign (6); punctuation per the FINNISH table
     (fi.wikipedia pistekirjoitus): piste 3, huutomerkki 256, pilkku 2,
     puolipiste 23, kaksoispiste 25, kysymysmerkki 26, viiva 36, plus 235,
     sulut 236/356, yhtasuuruus 2356. */
  _layout(p) {
    const BR = {
      a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4],
      g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5], k: [1, 3],
      l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
      p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4],
      t: [2, 3, 4, 5], u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6],
      x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
      "\u00e5": [1, 6], "\u00e4": [3, 4, 5], "\u00f6": [2, 4, 6],
      ".": [3], "!": [2, 5, 6], ",": [2], ";": [2, 3], ":": [2, 5],
      "?": [2, 6], "-": [3, 6], "+": [2, 3, 5], "(": [2, 3, 6],
      ")": [3, 5, 6], "=": [2, 3, 5, 6],
    };
    const DIGIT = "1234567890";
    const NUMSIGN = [3, 4, 5, 6];
    const CAPSIGN = [6];
    const s = Math.max(0.1, +p.scale || 1);
    const pitch = 2.5 * s, cellAdv = 6 * s, lineAdv = 10 * s;
    const tx = +p.tx || 0, ty = +p.ty || 0;
    const lines = String(p.text || "").split("|");
    const cells = []; /* {ch, x, y, dots, sign} in block-local mm */
    let blockW = 0;
    lines.forEach((line, li) => {
      let cx = 0;
      const y = li * lineAdv;
      let numRun = false;
      for (const ch of line) {
        const di = DIGIT.indexOf(ch);
        if (di >= 0) {
          if (!numRun) { cells.push({ ch: "", x: cx, y, dots: NUMSIGN, sign: true }); cx += cellAdv; numRun = true; }
          cells.push({ ch, x: cx, y, dots: BR["abcdefghij"[di]], sign: false }); cx += cellAdv;
          continue;
        }
        numRun = false;
        if (ch === " ") { cx += cellAdv; continue; }
        const lower = ch.toLowerCase();
        const dots = BR[lower];
        if (!dots) continue; /* unknown chars skipped */
        if (p.caps && ch !== lower) { cells.push({ ch: "", x: cx, y, dots: CAPSIGN, sign: true }); cx += cellAdv; }
        cells.push({ ch, x: cx, y, dots, sign: false }); cx += cellAdv;
      }
      blockW = Math.max(blockW, cx);
    });
    /* mirror = whole block flips like a stamp (punch from the front, read
       from the back): cell order reverses AND each cell's columns swap */
    if (p.mirror && blockW > 0) {
      for (const c of cells) c.x = (blockW - cellAdv) - c.x;
    }
    const pts = [];
    for (const c of cells) {
      for (const d of c.dots) {
        let col = d <= 3 ? 0 : 1;
        if (p.mirror) col = 1 - col;
        const row = (d - 1) % 3;
        pts.push([tx + c.x + col * pitch, ty + c.y + row * pitch]);
      }
    }
    return { cells, pts, pitch, cellAdv, lineAdv, tx, ty, blockW, blockH: lines.length * lineAdv };
  },
  compute(ins, p, ctx) {
    const L = this._layout(p);
    if (!L.pts.length) return applyStyle(EMPTY, ins[0]);
    /* dot = small closed polygon; radius capped so neighbours never touch */
    const r = Math.max(0.1, Math.min(+p.dotR || 0.1, L.pitch * 0.49));
    const layer = Math.round(+p.layer) || 0;
    const paths = L.pts.map(([cx, cy]) => {
      const pts = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return { pts, closed: true, layer };
    });
    return applyStyle({ paths }, ins[0]);
  },
  overlay(p, ctx) {
    try {
      if (!p.guides) return [];
      const L = this._layout(p);
      if (!L.cells.length) return [];
      const g = [{ kind: "rect", x: L.tx - L.pitch, y: L.ty - L.pitch, w: (L.blockW - L.cellAdv) + 3 * L.pitch, h: (L.blockH - L.lineAdv) + 4 * L.pitch }];
      const size = L.pitch * 1.4;
      for (const c of L.cells) {
        if (c.sign || !c.ch) continue;
        const F = fontStrokes(c.ch, size, 1);
        const ox = L.tx + c.x + L.pitch / 2 - F.width / 2;
        const oy = L.ty + c.y - size - L.pitch * 0.5;
        for (const st of F.strokes) {
          g.push({ kind: "poly", pts: st.map(([x, y]) => [ox + x, oy + y]) });
          if (g.length >= 600) return g;
        }
      }
      return g;
    } catch (e) { return []; }
  },
};
