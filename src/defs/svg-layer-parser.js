import { parseSVG } from "./helpers.js";

// Keep parseSVG's long-standing geometry and ordering intact. This second pass
// attaches source-group metadata to those paths for the Import SVG inspector.
export function parseSvgWithLayers(text) {
  const drawing = parseSVG(text);
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.querySelector("svg");
  const layers = [];
  let next = 0;
  const layerFor = (el, visible) => {
    const name = el.getAttribute("inkscape:label") || el.getAttribute("data-name") || el.getAttribute("id") || `Layer ${layers.length + 1}`;
    layers.push({ id: layers.length, name, visible });
    return layers.length - 1;
  };
  const shown = (el) => {
    const style = el.getAttribute("style") || "";
    return el.getAttribute("display") !== "none" && el.getAttribute("visibility") !== "hidden"
      && !/(?:^|;)\s*display\s*:\s*none(?:\s*;|\s*$)/i.test(style)
      && !/(?:^|;)\s*visibility\s*:\s*hidden(?:\s*;|\s*$)/i.test(style);
  };
  const count = (el, tag) => {
    if (tag === "path") {
      const d = el.getAttribute("d") || "";
      const escaped = d.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      try { return parseSVG(`<svg><path d="${escaped}"/></svg>`).paths.length; } catch (err) { return 0; }
    }
    if (tag === "polyline" || tag === "polygon")
      return (el.getAttribute("points") || "").split(/[\s,]+/).filter(Boolean).length >= 4 ? 1 : 0;
    return ["line", "rect", "circle", "ellipse"].includes(tag) ? 1 : 0;
  };
  function walk(el, inheritedLayer = null, visible = true) {
    let defaultLayer = inheritedLayer;
    for (const ch of Array.from(el.children)) {
      const tag = ch.tagName.toLowerCase();
      const selfVisible = shown(ch);
      if (tag === "g" || tag === "svg") {
        const isLayer = tag === "g" && (el === svg || !selfVisible || ch.getAttribute("inkscape:groupmode") === "layer" || ch.getAttribute("groupmode") === "layer");
        walk(ch, isLayer ? layerFor(ch, visible && selfVisible) : defaultLayer, visible && selfVisible);
        continue;
      }
      const n = count(ch, tag);
      if (!n) continue;
      if (defaultLayer == null) defaultLayer = layerFor(svg, visible);
      for (let k = 0; k < n && next < drawing.paths.length; k++) {
        const index = next++;
        drawing.paths[index] = { ...drawing.paths[index], sourceLayer: defaultLayer, shapeVisible: selfVisible };
      }
    }
  }
  walk(svg);
  if (next !== drawing.paths.length) {
    return { ...drawing, paths: drawing.paths.map(p => ({ ...p, sourceLayer: 0 })), layers: [{ id: 0, name: "Drawing", visible: true }] };
  }
  return { ...drawing, layers };
}
