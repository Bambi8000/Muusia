import { Pin, applyStyle } from "../helpers.js";

export default {
  key: "singlemarker",
  name: "Single Marker",
  cat: "gen",
  group: "structural",
  desc: "One movable marker at an exact X/Y mm position — at its simplest a solid ink dot. Styles: Dot (spiral-filled solid point), Circle, Cross +, Cross ×, Circle + cross (registration style), Circle + dot. Move it with the X/Y sliders (both are value ports, so they can be wired); a dashed guide shows the spot while the node is selected. Made for marking points: drop several markers, Merge them, then wire into Bridges (Points from: Path centers, Connect: Source order) to join the points in the exact order they are wired into Merge — Trim ends keeps the line off the dots, Close loop returns to the first marker. Connect: Chain joins them by nearest neighbour instead. Coordinates: DRO (laser) reads X/Y as DRO values — jog the laser dot onto the target spot on the bed, type the DRO reading in, and the marker lands at that exact physical position (laser offset and origin come from the machine profile, same convention as Image Underlay anchors).",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "x", label: "X mm", type: "slider", min: 0, max: 800, step: 0.5, def: 105 },
    { key: "y", label: "Y mm", type: "slider", min: 0, max: 800, step: 0.5, def: 148.5 },
    { key: "coord", label: "Coordinates", type: "select", options: ["Canvas mm", "DRO (laser)"], def: "Canvas mm" },
    { key: "style", label: "Style", type: "select", options: ["Dot", "Circle", "Cross +", "Cross \u00d7", "Circle + cross", "Circle + dot"], def: "Dot" },
    { key: "size", label: "Size mm", type: "slider", min: 0.5, max: 30, step: 0.5, def: 3 },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p, ctx) {
    const r = Math.max(0.25, p.size / 2);
    let gx = p.x, gy = p.y;
    if (p.coord === "DRO (laser)") {
      const M = (ctx && ctx.machine) || {};
      const mmx = (+p.x || 0) + (M.laserOffX || 0), mmy = (+p.y || 0) + (M.laserOffY || 0);
      gx = mmx - (M.originX || 0);
      const dyy = mmy - (M.originY || 0);
      gy = M.flipY ? ((ctx && ctx.H) || 0) - dyy : dyy;
    }
    return [
      { kind: "point", x: gx, y: gy },
      { kind: "circle", cx: gx, cy: gy, r: Math.max(r, 2) },
    ];
  },
  compute(ins, p, ctx) {
    let cx = p.x, cy = p.y;
    if (p.coord === "DRO (laser)") {
      const M = (ctx && ctx.machine) || {};
      const mmx = (+p.x || 0) + (M.laserOffX || 0), mmy = (+p.y || 0) + (M.laserOffY || 0);
      cx = mmx - (M.originX || 0);
      const dyy = mmy - (M.originY || 0);
      cy = M.flipY ? ((ctx && ctx.H) || 0) - dyy : dyy;
    }
    const r = Math.max(0.25, p.size / 2);
    const L = Math.max(0, Math.min(11, Math.round(p.layer)));
    const paths = [];
    const circle = (rad) => {
      const n = Math.max(12, Math.round(rad * 8));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
      }
      paths.push({ pts, closed: true, layer: L });
    };
    const seg = (x1, y1, x2, y2) => paths.push({ pts: [[x1, y1], [x2, y2]], closed: false, layer: L });
    const S = p.style;
    if (S === "Dot") {
      /* solid ink point: one spiral stroke rim -> center, ~0.4 mm pitch */
      const pitch = 0.4;
      const turns = Math.max(1, r / pitch);
      const n = Math.max(24, Math.round(turns * 24));
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const rad = r * (1 - t);
        const a = t * turns * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
      }
      paths.push({ pts, closed: false, layer: L });
    } else if (S === "Circle") {
      circle(r);
    } else if (S === "Cross +") {
      seg(cx - r, cy, cx + r, cy);
      seg(cx, cy - r, cx, cy + r);
    } else if (S === "Cross \u00d7") {
      const d = r * Math.SQRT1_2;
      seg(cx - d, cy - d, cx + d, cy + d);
      seg(cx - d, cy + d, cx + d, cy - d);
    } else if (S === "Circle + cross") {
      circle(r * 0.6);
      seg(cx - r, cy, cx + r, cy);
      seg(cx, cy - r, cx, cy + r);
    } else if (S === "Circle + dot") {
      circle(r);
      const dr = Math.max(0.2, Math.min(0.6, r * 0.22));
      const pts = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * dr, cy + Math.sin(a) * dr]);
      }
      paths.push({ pts, closed: true, layer: L });
    }
    return applyStyle({ paths }, ins[0]);
  },
};
