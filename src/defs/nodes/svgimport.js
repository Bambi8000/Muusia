import { Pin, EMPTY } from "../helpers.js";
import { placeImportedPaths } from "../import-placement.js";
import { parseSvgWithLayers } from "../svg-layer-parser.js";

export default {
  key: "svgimport",
    name: "Import SVG", cat: "gen", group: "textimg", ins: [Pin("style", "Style")], outs: [Pin("paths")],
    params: [
      { key: "filename", label: "SVG file", type: "file", def: "" },
      { key: "fit", label: "Fit", type: "select", options: ["Fit to canvas", "Scale %"], def: "Fit to canvas" },
      { key: "scale", label: "Scale %", type: "slider", min: 1, max: 400, step: 1, def: 100 },
      { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
      { key: "offx", label: "Offset X mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "offy", label: "Offset Y mm", type: "slider", min: -200, max: 200, step: 0.5, def: 0 },
      { key: "editScale", label: "Size %", type: "slider", min: 1, max: 500, step: 1, def: 100 },
      { key: "rotation", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
      { key: "dirs", label: "Directions", type: "select", options: ["Original", "Closed clockwise", "Closed counter-clockwise"], def: "Original" },
      { key: "colmode", label: "Colors", type: "select", options: ["From SVG colors", "Single pen"], def: "From SVG colors" },
      { key: "layer", label: "Pen (if single)", type: "pen", def: 0 },
    ],
    onFile(text) { return parseSvgWithLayers(text); },
    compute(ins, p, ctx, node) {
      const svg = node && node.data && node.data.svg;
      if (!svg) return EMPTY;
      return placeImportedPaths(svg, p, ctx, ins[0], (sp) => {
        if (sp.shapeVisible === false) return false;
        const id = sp.sourceLayer;
        if (id == null) return true; // legacy frozen patches
        return p.visibleLayers?.[id] ?? svg.layers?.[id]?.visible ?? true;
      });
    },
  
};
