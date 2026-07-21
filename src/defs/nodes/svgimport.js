import { Pin, EMPTY, PENS, applyStyle, signedArea, parseSVG } from "../helpers.js";

export default {
  key: "svgimport",
    name: "Import SVG", cat: "gen", group: "textimg", ins: [Pin("style", "Tyyli")], outs: [Pin("paths")],
    params: [
      { key: "filename", label: "SVG file", type: "file", def: "" },
      { key: "fit", label: "Fit", type: "select", options: ["Fit to canvas", "Scale %"], def: "Fit to canvas" },
      { key: "scale", label: "Scale %", type: "slider", min: 1, max: 400, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "offx", label: "Offset X mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "offy", label: "Offset Y mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "dirs", label: "Directions", type: "select", options: ["Original", "Closed clockwise", "Closed counter-clockwise"], def: "Original" },
      { key: "colmode", label: "Colors", type: "select", options: ["From SVG colors", "Single pen"], def: "From SVG colors" },
      { key: "layer", label: "Pen (if single)", type: "pen", def: 0 },
    ],
    onFile(text) { return parseSVG(text); },
    compute(ins, p, ctx, node) {
      const svg = node && node.data && node.data.svg;
      if (!svg) return EMPTY;
      const { W, H } = ctx;
      let s, ox, oy;
      if (p.fit === "Fit to canvas") {
        s = Math.min((W - 2 * p.margin) / svg.bbox.w, (H - 2 * p.margin) / svg.bbox.h);
        ox = (W - svg.bbox.w * s) / 2 - svg.bbox.x * s;
        oy = (H - svg.bbox.h * s) / 2 - svg.bbox.y * s;
      } else {
        s = p.scale / 100;
        ox = p.margin - svg.bbox.x * s;
        oy = p.margin - svg.bbox.y * s;
      }
      const paths = svg.paths.map((sp) => {
        let pts = sp.pts.map(([x, y]) => [x * s + ox + p.offx, y * s + oy + p.offy]);
        if (sp.closed && p.dirs !== "Original") {
          const cw = signedArea(pts) > 0; // y-alas -koordinaatistossa
          const wantCw = p.dirs === "Closed clockwise";
          if (cw !== wantCw) pts = [...pts].reverse();
        }
        return {
          pts, closed: sp.closed,
          layer: p.colmode === "Single pen" ? Math.round(p.layer) : sp.colorIdx % PENS.length,
        };
      });
      return applyStyle({ paths }, ins[0]);
    },
  
};
