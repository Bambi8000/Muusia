import { Pin, resample, pathLength, applyStyle, fontStrokes } from "../helpers.js";

export default {
  /* Mesh Slice — import an STL, slice it along Z into sheet contours for
     laser/knife-cut layered objects (lamps!). Negative primitives carve the
     interior per-slice in 2D (no 3D CSG): the cut line of (slice − hole) is
     the slice contour clipped OUTSIDE the holes plus the hole contours
     clipped INSIDE the slice. A rod hole (M3..M10 clearance) is just one
     more hole present on every sheet. All geometry is true scale (mm) —
     nothing auto-fits, because the export is a cutting file. */
  key: "meshslice",
  name: "Mesh Slice",
  cat: "gen",
  group: "structural",
  fileBinary: true,
  fileLabel: "Load STL\u2026",
  fileAccept: ".stl,model/stl,application/sla,application/octet-stream",
  desc: "Slices an imported STL mesh into flat sheet contours for building layered objects (lamps, sculptures) from cardboard or plexi. Wire a mesh generator such as Blob Mesh into the Mesh input, or load a binary or ASCII STL (max 120k triangles \u2014 decimate bigger meshes in Blender first); the model is centered and scaled so its longest dimension equals Size mm, rotated by Rot X/Y/Z, then cut by horizontal planes at each sheet's mid-height. Slice by Count or by real Sheet thickness. CUTTING outputs are always true scale and never fitted: Single slice, Frames (ANIMATE) (one slice per frame), Grid layout (the whole run tiled from the bed corner, columns fitted between the Bed margins, overflowing downwards when the run is long) and Grid pages (ANIMATE) (the same tiling split into canvas-sized pages, one page per frame, each labelled P n/total \u2014 set the ANIMATE frame count to the page count and use SVG \u00d7N / DXF \u00d7N to get the whole job as one zip). PREVIEW outputs are scaled to fit and marked PREVIEW NOT TO SCALE: Contact sheet shows every sheet shrunk onto one canvas so the negative primitives can be judged across the whole run without touching Size, and Isometric stack projects the real sliced geometry as a 3D stack (View angle, View elevation, Layer spacing \u00d7 for an exploded view). Preview every Nth sheet thins dense runs, and preview sampling coarsens automatically so no sheet is ever dropped. All contours overlays every contour in place, a topographic drawing. Up to 3 negative primitives (Sphere/Cube/Dodecahedron, position and size in % of Size) carve the interior; where a primitive breaks the outer surface the shell opens into a window. Rod holes adds 1\u20134 threaded-rod clearance holes (ISO medium fit) on every sheet, on a ring or placed by hand \u2014 a hole vanishes on sheets where there is no material under it, so check All contours for the common core before choosing the ring radius. Contour step is the sampling resolution in mm.",
  ins: [Pin("style", "Style"), Pin("mesh", "Mesh")],
  outs: [Pin("paths")],
  params: [
    { key: "file", label: "STL file", type: "file", def: "" },
    { key: "mode", label: "Output", type: "select", options: ["Single slice", "Frames (ANIMATE)", "All contours", "Grid layout", "Grid pages (ANIMATE)", "Contact sheet (preview)", "Isometric stack (preview)"], def: "All contours" },
    { key: "slice", label: "Slice #", type: "slider", min: 1, max: 200, step: 1, def: 1, showIf: (p) => p.mode === "Single slice" },
    { key: "sliceBy", label: "Slice by", type: "select", options: ["Count", "Sheet thickness"], def: "Count" },
    { key: "slices", label: "Slices", type: "slider", min: 2, max: 200, step: 1, def: 24, showIf: (p) => p.sliceBy === "Count" },
    { key: "thick", label: "Sheet thickness mm", type: "slider", min: 0.5, max: 20, step: 0.1, def: 3, showIf: (p) => p.sliceBy === "Sheet thickness" },
    { key: "size", label: "Size mm", type: "slider", min: 20, max: 600, step: 1, def: 160 },
    { key: "rotX", label: "Rot X\u00b0", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "rotY", label: "Rot Y\u00b0", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "rotZ", label: "Rot Z\u00b0", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "step", label: "Contour step mm", type: "slider", min: 0.2, max: 3, step: 0.05, def: 0.6 },
    { key: "negN", label: "Negative shapes", type: "slider", min: 0, max: 3, step: 1, def: 0 },
    { key: "negType1", label: "Shape 1", type: "select", options: ["Sphere", "Cube", "Dodecahedron"], def: "Sphere", showIf: (p) => p.negN >= 1 },
    { key: "negX1", label: "Shape 1 X %", type: "slider", min: -100, max: 100, step: 1, def: 0, showIf: (p) => p.negN >= 1 },
    { key: "negY1", label: "Shape 1 Y %", type: "slider", min: -100, max: 100, step: 1, def: 0, showIf: (p) => p.negN >= 1 },
    { key: "negZ1", label: "Shape 1 Z %", type: "slider", min: -100, max: 100, step: 1, def: 0, showIf: (p) => p.negN >= 1 },
    { key: "negS1", label: "Shape 1 size %", type: "slider", min: 5, max: 150, step: 1, def: 55, showIf: (p) => p.negN >= 1 },
    { key: "negType2", label: "Shape 2", type: "select", options: ["Sphere", "Cube", "Dodecahedron"], def: "Sphere", showIf: (p) => p.negN >= 2 },
    { key: "negX2", label: "Shape 2 X %", type: "slider", min: -100, max: 100, step: 1, def: 30, showIf: (p) => p.negN >= 2 },
    { key: "negY2", label: "Shape 2 Y %", type: "slider", min: -100, max: 100, step: 1, def: 0, showIf: (p) => p.negN >= 2 },
    { key: "negZ2", label: "Shape 2 Z %", type: "slider", min: -100, max: 100, step: 1, def: 20, showIf: (p) => p.negN >= 2 },
    { key: "negS2", label: "Shape 2 size %", type: "slider", min: 5, max: 150, step: 1, def: 35, showIf: (p) => p.negN >= 2 },
    { key: "negType3", label: "Shape 3", type: "select", options: ["Sphere", "Cube", "Dodecahedron"], def: "Sphere", showIf: (p) => p.negN >= 3 },
    { key: "negX3", label: "Shape 3 X %", type: "slider", min: -100, max: 100, step: 1, def: -30, showIf: (p) => p.negN >= 3 },
    { key: "negY3", label: "Shape 3 Y %", type: "slider", min: -100, max: 100, step: 1, def: 0, showIf: (p) => p.negN >= 3 },
    { key: "negZ3", label: "Shape 3 Z %", type: "slider", min: -100, max: 100, step: 1, def: -20, showIf: (p) => p.negN >= 3 },
    { key: "negS3", label: "Shape 3 size %", type: "slider", min: 5, max: 150, step: 1, def: 35, showIf: (p) => p.negN >= 3 },
    { key: "rodHole", label: "Rod hole", type: "select", options: ["None", "M3", "M4", "M5", "M6", "M8", "M10", "Custom"], def: "None" },
    { key: "rodDia", label: "Rod dia mm", type: "slider", min: 1, max: 30, step: 0.1, def: 8, showIf: (p) => p.rodHole === "Custom" },
    { key: "rodN", label: "Rod count", type: "slider", min: 1, max: 4, step: 1, def: 1, showIf: (p) => p.rodHole !== "None" },
    { key: "rodLayout", label: "Rod layout", type: "select", options: ["Ring", "Manual"], def: "Ring", showIf: (p) => p.rodHole !== "None" && p.rodN > 1 },
    { key: "rodX", label: "Rod center X %", type: "slider", min: -100, max: 100, step: 1, def: 0, showIf: (p) => p.rodHole !== "None" && p.rodLayout !== "Manual" },
    { key: "rodY", label: "Rod center Y %", type: "slider", min: -100, max: 100, step: 1, def: 0, showIf: (p) => p.rodHole !== "None" && p.rodLayout !== "Manual" },
    { key: "rodR", label: "Rod ring radius %", type: "slider", min: 0, max: 100, step: 1, def: 35, showIf: (p) => p.rodHole !== "None" && p.rodLayout !== "Manual" && p.rodN > 1 },
    { key: "rodA", label: "Rod ring angle\u00b0", type: "slider", min: -180, max: 180, step: 1, def: 0, showIf: (p) => p.rodHole !== "None" && p.rodLayout !== "Manual" && p.rodN > 1 },
    { key: "rodX1", label: "Rod 1 X %", type: "slider", min: -100, max: 100, step: 1, def: -30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 1 },
    { key: "rodY1", label: "Rod 1 Y %", type: "slider", min: -100, max: 100, step: 1, def: -30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 1 },
    { key: "rodX2", label: "Rod 2 X %", type: "slider", min: -100, max: 100, step: 1, def: 30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 2 },
    { key: "rodY2", label: "Rod 2 Y %", type: "slider", min: -100, max: 100, step: 1, def: -30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 2 },
    { key: "rodX3", label: "Rod 3 X %", type: "slider", min: -100, max: 100, step: 1, def: 30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 3 },
    { key: "rodY3", label: "Rod 3 Y %", type: "slider", min: -100, max: 100, step: 1, def: 30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 3 },
    { key: "rodX4", label: "Rod 4 X %", type: "slider", min: -100, max: 100, step: 1, def: -30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 4 },
    { key: "rodY4", label: "Rod 4 Y %", type: "slider", min: -100, max: 100, step: 1, def: 30, showIf: (p) => p.rodHole !== "None" && p.rodLayout === "Manual" && p.rodN >= 4 },
    { key: "prevEvery", label: "Preview every Nth sheet", type: "slider", min: 1, max: 10, step: 1, def: 1, showIf: (p) => p.mode === "Contact sheet (preview)" || p.mode === "Isometric stack (preview)" },
    { key: "isoAz", label: "View angle\u00b0", type: "slider", min: -180, max: 180, step: 1, def: 35, showIf: (p) => p.mode === "Isometric stack (preview)" },
    { key: "isoEl", label: "View elevation\u00b0", type: "slider", min: 5, max: 85, step: 1, def: 30, showIf: (p) => p.mode === "Isometric stack (preview)" },
    { key: "isoSpread", label: "Layer spacing \u00d7", type: "slider", min: 0, max: 6, step: 0.1, def: 1, showIf: (p) => p.mode === "Isometric stack (preview)" },
    { key: "gridCols", label: "Grid columns (0 = fit bed)", type: "slider", min: 0, max: 20, step: 1, def: 0, showIf: (p) => (p.mode === "Grid layout" || p.mode === "Grid pages (ANIMATE)" || p.mode === "Contact sheet (preview)") },
    { key: "gridGap", label: "Grid gap mm", type: "slider", min: 0, max: 30, step: 0.5, def: 5, showIf: (p) => (p.mode === "Grid layout" || p.mode === "Grid pages (ANIMATE)" || p.mode === "Contact sheet (preview)") },
    { key: "bedMargin", label: "Bed / preview margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10, showIf: (p) => p.mode !== "Single slice" && p.mode !== "Frames (ANIMATE)" && p.mode !== "All contours" },
    { key: "gridNum", label: "Sheet numbers", type: "check", def: true, showIf: (p) => p.mode === "Grid layout" || p.mode === "Grid pages (ANIMATE)" || p.mode === "Contact sheet (preview)" },
    { key: "numSize", label: "Number size mm", type: "slider", min: 2, max: 15, step: 0.5, def: 5, showIf: (p) => (p.mode === "Grid layout" || p.mode === "Grid pages (ANIMATE)" || p.mode === "Contact sheet (preview)") && p.gridNum },
    { key: "markPen", label: "Number / label pen", type: "pen", def: 1, showIf: (p) => p.mode !== "Single slice" && p.mode !== "Frames (ANIMATE)" && p.mode !== "All contours" },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  onFile(dataUrl) {
    const s = String(dataUrl);
    if (!s.startsWith("data:")) throw new Error("binary intake missing - update the app");
    const b64 = s.slice(s.indexOf(",") + 1);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const CAP = 120000;
    let tris = null;
    if (u8.length >= 84) {
      const dv = new DataView(u8.buffer);
      const nT = dv.getUint32(80, true);
      if (nT > 0 && 84 + 50 * nT === u8.length) {
        if (nT > CAP) throw new Error("STL has " + nT + " triangles - decimate below " + CAP + " (Blender: Decimate modifier) and re-export");
        tris = new Array(nT * 9);
        for (let t = 0; t < nT; t++) {
          const o = 84 + t * 50 + 12;
          for (let k = 0; k < 9; k++) tris[t * 9 + k] = dv.getFloat32(o + k * 4, true);
        }
      }
    }
    if (!tris) {
      /* ASCII STL: bin already is the text */
      if (!/^\s*solid/.test(bin)) throw new Error("not an STL file (no binary header match, no 'solid' keyword)");
      const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
      tris = [];
      let m;
      while ((m = re.exec(bin))) {
        tris.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
        if (tris.length > CAP * 9) throw new Error("STL exceeds " + CAP + " triangles - decimate and re-export");
      }
      if (tris.length < 9 || tris.length % 9 !== 0) throw new Error("ASCII STL parse failed (" + tris.length / 3 + " vertices, not a multiple of 3)");
    }
    const n = tris.length / 9;
    /* normalize: center at origin, longest dimension = 1, round for compact patches */
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < tris.length; i += 3) {
      const x = tris[i], y = tris[i + 1], z = tris[i + 2];
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) throw new Error("STL contains non-finite coordinates");
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const dim = Math.max(x1 - x0, y1 - y0, z1 - z0);
    if (!(dim > 0)) throw new Error("STL is degenerate (zero size)");
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const v = new Array(tris.length);
    for (let i = 0; i < tris.length; i += 3) {
      v[i] = Math.round(((tris[i] - cx) / dim) * 10000) / 10000;
      v[i + 1] = Math.round(((tris[i + 1] - cy) / dim) * 10000) / 10000;
      v[i + 2] = Math.round(((tris[i + 2] - cz) / dim) * 10000) / 10000;
    }
    return { kind: "mesh", tri: n, v, dims: [Math.round(((x1 - x0) / dim) * 10000) / 10000, Math.round(((y1 - y0) / dim) * 10000) / 10000, Math.round(((z1 - z0) / dim) * 10000) / 10000] };
  },
  overlay(p, ctx, ins, node) {
    try {
      const g = [];
      const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
      const size = Math.max(5, Math.min(2000, +p.size || 160));
      const mesh = ins && ins[1] && ins[1].kind === "mesh" ? ins[1] : (node && node.data && node.data.svg && node.data.svg.kind === "mesh" ? node.data.svg : null);
      let bw = size, bh = size;
      if (mesh && mesh.v && mesh.v.length >= 9) {
        const rx = ((+p.rotX || 0) * Math.PI) / 180, ry = ((+p.rotY || 0) * Math.PI) / 180, rz = ((+p.rotZ || 0) * Math.PI) / 180;
        const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry), cZ = Math.cos(rz), sZ = Math.sin(rz);
        let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity, az0 = Infinity, az1 = -Infinity;
        const vv = mesh.v;
        for (let i = 0; i < vv.length; i += 3) {
          let x = vv[i], y = vv[i + 1], z = vv[i + 2];
          let y2 = y * cX - z * sX, z2 = y * sX + z * cX;
          let x3 = x * cY + z2 * sY, z3 = -x * sY + z2 * cY;
          let x4 = x3 * cZ - y2 * sZ, y4 = x3 * sZ + y2 * cZ;
          if (x4 < ax0) ax0 = x4; if (x4 > ax1) ax1 = x4;
          if (y4 < ay0) ay0 = y4; if (y4 > ay1) ay1 = y4;
          if (z3 < az0) az0 = z3; if (z3 > az1) az1 = z3;
        }
        const md = Math.max(ax1 - ax0, ay1 - ay0, az1 - az0) || 1;
        const s = size / md;
        bw = (ax1 - ax0) * s; bh = (ay1 - ay0) * s;
      }
      const cxm = W / 2, cym = H / 2;
      if (p.mode === "Contact sheet (preview)" || p.mode === "Isometric stack (preview)") {
        const mg = Math.max(0, Math.min(200, +p.bedMargin == null ? 10 : +p.bedMargin));
        g.push({ kind: "rect", x: mg, y: mg, w: Math.max(1, W - 2 * mg), h: Math.max(1, H - 2 * mg) });
      } else if (p.mode === "Grid layout" || p.mode === "Grid pages (ANIMATE)") {
        let nSl = 1;
        if (p.sliceBy === "Sheet thickness") nSl = Math.max(1, Math.round(size / Math.max(0.2, +p.thick || 3)));
        else nSl = Math.max(1, Math.round(+p.slices || 24));
        nSl = Math.min(400, nSl);
        const gap = Math.max(0, +p.gridGap || 0);
        const mg = Math.max(0, Math.min(200, +p.bedMargin == null ? 10 : +p.bedMargin));
        const cw = bw + gap, ch = bh + gap;
        let cols = Math.round(+p.gridCols || 0);
        if (cols < 1) cols = Math.floor((W - 2 * mg + gap) / Math.max(0.001, cw));
        cols = Math.max(1, Math.min(40, cols));
        const paged = p.mode === "Grid pages (ANIMATE)";
        let rowsPer = Math.max(1, Math.min(40, Math.floor((H - 2 * mg + gap) / Math.max(0.001, ch))));
        const rows = paged ? rowsPer : Math.ceil(nSl / cols);
        const gy0 = paged ? mg : Math.max(mg, cym - (rows * ch) / 2);
        g.push({ kind: "rect", x: mg, y: mg, w: Math.max(1, W - 2 * mg), h: Math.max(1, H - 2 * mg) });
        g.push({ kind: "rect", x: mg, y: gy0, w: cols * cw - gap, h: rows * ch - gap });
        g.push({ kind: "rect", x: mg, y: gy0, w: bw, h: bh });
      } else {
        g.push({ kind: "rect", x: cxm - bw / 2, y: cym - bh / 2, w: bw, h: bh });
        const nn = Math.max(0, Math.min(3, Math.round(+p.negN || 0)));
        for (let i = 1; i <= nn; i++) {
          const hx = cxm + ((+p["negX" + i] || 0) / 100) * size;
          const hy = cym + ((+p["negY" + i] || 0) / 100) * size;
          const D = ((+p["negS" + i] || 40) / 100) * size;
          if (p["negType" + i] === "Cube") g.push({ kind: "rect", x: hx - D / 2, y: hy - D / 2, w: D, h: D });
          else g.push({ kind: "circle", cx: hx, cy: hy, r: D / 2 });
        }
        if (p.rodHole && p.rodHole !== "None") {
          const RD = { M3: 3.4, M4: 4.5, M5: 5.5, M6: 6.6, M8: 9, M10: 11 };
          const d = p.rodHole === "Custom" ? Math.max(0.5, +p.rodDia || 8) : RD[p.rodHole] || 5.5;
          const nR = Math.max(1, Math.min(4, Math.round(+p.rodN || 1)));
          const centers = [];
          if (p.rodLayout === "Manual") {
            for (let i = 1; i <= nR; i++) centers.push([((+p["rodX" + i] || 0) / 100) * size, ((+p["rodY" + i] || 0) / 100) * size]);
          } else {
            const bx = ((+p.rodX || 0) / 100) * size, by = ((+p.rodY || 0) / 100) * size;
            if (nR === 1) centers.push([bx, by]);
            else {
              const R = Math.max(0, ((+p.rodR == null ? 35 : +p.rodR) / 100) * size);
              const a0 = ((+p.rodA || 0) * Math.PI) / 180;
              for (let i = 0; i < nR; i++) { const a = a0 + (i / nR) * Math.PI * 2; centers.push([bx + Math.cos(a) * R, by + Math.sin(a) * R]); }
            }
          }
          for (const [hx, hy] of centers) g.push({ kind: "circle", cx: cxm + hx, cy: cym + hy, r: d / 2 });
        }
      }
      return g;
    } catch (e) {
      return [];
    }
  },
  compute(ins, p, ctx, node) {
    const mesh = ins && ins[1] && ins[1].kind === "mesh" ? ins[1] : (node && node.data && node.data.svg && node.data.svg.kind === "mesh" ? node.data.svg : null);
    if (!mesh || !mesh.v || mesh.v.length < 9 || mesh.v.length % 9 !== 0) return applyStyle({ paths: [] }, ins[0]);
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const size = Math.max(5, Math.min(2000, +p.size || 160));
    let step = Math.max(0.15, Math.min(5, +p.step || 0.6));
    const layer = ((Math.round(+p.layer || 0) % 12) + 12) % 12;
    const BUDGET = 115000;

    /* ---- transform: rotate (X then Y then Z), scale longest dim to size, center at 0 ---- */
    const vv = mesh.v;
    const nV = vv.length / 3;
    const rx = ((+p.rotX || 0) * Math.PI) / 180, ry = ((+p.rotY || 0) * Math.PI) / 180, rz = ((+p.rotZ || 0) * Math.PI) / 180;
    const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry), cZ = Math.cos(rz), sZ = Math.sin(rz);
    const V = new Float64Array(vv.length);
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < vv.length; i += 3) {
      const x = vv[i], y = vv[i + 1], z = vv[i + 2];
      const y2 = y * cX - z * sX, zA = y * sX + z * cX;
      const x3 = x * cY + zA * sY, zB = -x * sY + zA * cY;
      const x4 = x3 * cZ - y2 * sZ, y4 = x3 * sZ + y2 * cZ;
      V[i] = x4; V[i + 1] = y4; V[i + 2] = zB;
      if (x4 < x0) x0 = x4; if (x4 > x1) x1 = x4;
      if (y4 < y0) y0 = y4; if (y4 > y1) y1 = y4;
      if (zB < z0) z0 = zB; if (zB > z1) z1 = zB;
    }
    const md = Math.max(x1 - x0, y1 - y0, z1 - z0);
    if (!(md > 0)) return applyStyle({ paths: [] }, ins[0]);
    const s = size / md;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    for (let i = 0; i < V.length; i += 3) {
      V[i] = (V[i] - mx) * s;
      V[i + 1] = (V[i + 1] - my) * s;
      V[i + 2] = (V[i + 2] - mz) * s;
    }
    const zLo = (z0 - mz) * s, zHi = (z1 - mz) * s;
    const height = zHi - zLo;

    /* ---- slice plane list (band centers) ---- */
    let nSl;
    if (p.sliceBy === "Sheet thickness") nSl = Math.max(1, Math.round(height / Math.max(0.2, +p.thick || 3)));
    else nSl = Math.max(1, Math.round(+p.slices || 24));
    nSl = Math.min(400, nSl);
    const dz = height / nSl;
    const planeZ = (i) => zLo + (i + 0.5) * dz;

    /* ---- mesh slicing: triangle-plane segments ---- */
    const nTri = V.length / 9;
    const sliceSegs = (z) => {
      const segs = [];
      for (let t = 0; t < nTri; t++) {
        const o = t * 9;
        let dA = V[o + 2] - z; if (dA === 0) dA = 1e-12;
        let dB = V[o + 5] - z; if (dB === 0) dB = 1e-12;
        let dC = V[o + 8] - z; if (dC === 0) dC = 1e-12;
        if ((dA > 0 && dB > 0 && dC > 0) || (dA < 0 && dB < 0 && dC < 0)) continue;
        const px = [], py = [];
        const edge = (i0, i1, d0, d1) => {
          if ((d0 > 0) === (d1 > 0)) return;
          const t2 = d0 / (d0 - d1);
          px.push(V[o + i0] + (V[o + i1] - V[o + i0]) * t2);
          py.push(V[o + i0 + 1] + (V[o + i1 + 1] - V[o + i0 + 1]) * t2);
        };
        edge(0, 3, dA, dB); edge(3, 6, dB, dC); edge(6, 0, dC, dA);
        if (px.length === 2) {
          const L = Math.hypot(px[1] - px[0], py[1] - py[0]);
          if (L > 1e-6) segs.push(px[0], py[0], px[1], py[1]);
        }
      }
      return segs;
    };

    /* ---- chain segments into loops (0.01 mm weld grid, 3x3 neighbor lookup) ---- */
    const chain = (segs) => {
      const nS = segs.length / 4;
      const map = new Map();
      const KQ = 100;
      const put = (x, y, idx) => {
        const k = Math.round(x * KQ) + ":" + Math.round(y * KQ);
        const a = map.get(k);
        if (a) a.push(idx); else map.set(k, [idx]);
      };
      for (let i = 0; i < nS; i++) {
        put(segs[i * 4], segs[i * 4 + 1], i * 2);
        put(segs[i * 4 + 2], segs[i * 4 + 3], i * 2 + 1);
      }
      const used = new Uint8Array(nS);
      const endPt = (e) => {
        const i = e >> 1, o = i * 4 + (e & 1 ? 2 : 0);
        return [segs[o], segs[o + 1]];
      };
      const find = (x, y) => {
        const bx = Math.round(x * KQ), by = Math.round(y * KQ);
        for (let dx2 = -1; dx2 <= 1; dx2++) for (let dy2 = -1; dy2 <= 1; dy2++) {
          const a = map.get((bx + dx2) + ":" + (by + dy2));
          if (a) for (const e of a) {
            if (used[e >> 1]) continue;
            const q = endPt(e);
            if (Math.hypot(q[0] - x, q[1] - y) < 0.025) return e;
          }
        }
        return -1;
      };
      const loops = [];
      for (let i = 0; i < nS; i++) {
        if (used[i]) continue;
        used[i] = 1;
        const pts = [endPt(i * 2), endPt(i * 2 + 1)];
        let closed = false;
        for (;;) {
          const tail = pts[pts.length - 1];
          const e = find(tail[0], tail[1]);
          if (e < 0) break;
          used[e >> 1] = 1;
          const other = endPt(e ^ 1);
          const head = pts[0];
          if (Math.hypot(other[0] - head[0], other[1] - head[1]) < 0.025) { closed = true; break; }
          pts.push(other);
        }
        if (!closed) {
          for (;;) {
            const head = pts[0];
            const e = find(head[0], head[1]);
            if (e < 0) break;
            used[e >> 1] = 1;
            const other = endPt(e ^ 1);
            const tail = pts[pts.length - 1];
            if (Math.hypot(other[0] - tail[0], other[1] - tail[1]) < 0.025) { closed = true; break; }
            pts.unshift(other);
          }
        }
        if (pts.length >= 2) loops.push({ pts, closed });
      }
      return loops;
    };

    /* ---- negative primitives: cross-section polygon at plane z ---- */
    const PHI = (1 + Math.sqrt(5)) / 2;
    const dodecaVerts = () => {
      const q = 1 / PHI, verts = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) verts.push([a, b, c]);
      for (const a of [-1, 1]) for (const b of [-1, 1]) { verts.push([0, a * q, b * PHI]); verts.push([a * q, b * PHI, 0]); verts.push([a * PHI, 0, b * q]); }
      return verts;
    };
    const edgesByLen = (verts, eLen) => {
      const E = [];
      for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
        const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]);
        if (Math.abs(d - eLen) < 1e-6) E.push([i, j]);
      }
      return E;
    };
    const convexSection = (verts, edges, hz) => {
      const pts = [];
      let zz = hz;
      for (const v of verts) if (Math.abs(v[2] - zz) < 1e-9) { zz += 1e-7; break; }
      for (const [i, j] of edges) {
        const a = verts[i], b = verts[j];
        const dA = a[2] - zz, dB = b[2] - zz;
        if ((dA > 0) === (dB > 0)) continue;
        const t = dA / (dA - dB);
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      if (pts.length < 3) return null;
      let gx = 0, gy = 0;
      for (const q of pts) { gx += q[0]; gy += q[1]; }
      gx /= pts.length; gy /= pts.length;
      pts.sort((A, B) => Math.atan2(A[1] - gy, A[0] - gx) - Math.atan2(B[1] - gy, B[0] - gx));
      return pts;
    };
    /* ---- rod holes: 1..4, ring or manual ---- */
    const rodDiaMM = () => {
      const RD = { M3: 3.4, M4: 4.5, M5: 5.5, M6: 6.6, M8: 9, M10: 11 };
      return p.rodHole === "Custom" ? Math.max(0.5, Math.min(60, +p.rodDia || 8)) : RD[p.rodHole] || 5.5;
    };
    const rodCenters = () => {
      if (!p.rodHole || p.rodHole === "None") return [];
      const nR = Math.max(1, Math.min(4, Math.round(+p.rodN || 1)));
      if (p.rodLayout === "Manual") {
        const out = [];
        for (let i = 1; i <= nR; i++) out.push([((+p["rodX" + i] || 0) / 100) * size, ((+p["rodY" + i] || 0) / 100) * size]);
        return out;
      }
      const bx = ((+p.rodX || 0) / 100) * size, by = ((+p.rodY || 0) / 100) * size;
      if (nR === 1) return [[bx, by]];
      const R = Math.max(0, ((+p.rodR == null ? 35 : +p.rodR) / 100) * size);
      const a0 = ((+p.rodA || 0) * Math.PI) / 180;
      const out = [];
      for (let i = 0; i < nR; i++) {
        const a = a0 + (i / nR) * Math.PI * 2;
        out.push([bx + Math.cos(a) * R, by + Math.sin(a) * R]);
      }
      return out;
    };
    const holeSectionsAt = (z) => {
      const out = [];
      const nn = Math.max(0, Math.min(3, Math.round(+p.negN || 0)));
      for (let i = 1; i <= nn; i++) {
        const hx = ((+p["negX" + i] || 0) / 100) * size;
        const hy = ((+p["negY" + i] || 0) / 100) * size;
        const hz = ((+p["negZ" + i] || 0) / 100) * size;
        const D = Math.max(0.5, ((+p["negS" + i] || 40) / 100) * size);
        const typ = p["negType" + i] || "Sphere";
        const dzz = z - hz;
        if (typ === "Sphere") {
          const r = D / 2;
          if (Math.abs(dzz) >= r) continue;
          const rr = Math.sqrt(r * r - dzz * dzz);
          if (rr < 0.1) continue;
          const nP = Math.max(16, Math.min(96, Math.ceil((2 * Math.PI * rr) / step)));
          const pts = [];
          for (let k = 0; k < nP; k++) {
            const a = (k / nP) * Math.PI * 2;
            pts.push([hx + Math.cos(a) * rr, hy + Math.sin(a) * rr]);
          }
          out.push(pts);
        } else if (typ === "Cube") {
          const e = D;
          if (Math.abs(dzz) >= e / 2) continue;
          const h2 = e / 2;
          out.push([[hx - h2, hy - h2], [hx + h2, hy - h2], [hx + h2, hy + h2], [hx - h2, hy + h2]]);
        } else {
          const base = dodecaVerts();
          const sc = (D / 2) / Math.sqrt(3);
          const verts = base.map((v) => [hx + v[0] * sc, hy + v[1] * sc, hz + v[2] * sc]);
          const E = edgesByLen(verts, (2 / PHI) * sc);
          const sec = convexSection(verts, E, z);
          if (sec) out.push(sec);
        }
      }
      for (const [cxr, cyr] of rodCenters()) {
        const d = rodDiaMM();
        const nP = Math.max(24, Math.min(72, Math.ceil((Math.PI * d) / Math.min(step, 0.5))));
        const pts = [];
        for (let k = 0; k < nP; k++) {
          const a = (k / nP) * Math.PI * 2;
          pts.push([cxr + (Math.cos(a) * d) / 2, cyr + (Math.sin(a) * d) / 2]);
        }
        out.push(pts);
      }
      return out;
    };

    /* ---- even-odd point-in-polygon (bbox pretest) ---- */
    const withBB = (pts) => {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const [x, y] of pts) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
      return { pts, bb: [a, b, c, d] };
    };
    const inPoly = (x, y, P) => {
      const bb = P.bb;
      if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) return false;
      const pts = P.pts;
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const inLoops = (x, y, polys) => {
      let c = 0;
      for (const P of polys) if (inPoly(x, y, P)) c++;
      return (c & 1) === 1;
    };

    /* ---- build one slice: contours clipped by holes, holes clipped by slice ---- */
    const emitRuns = (pts, keep, closed, push) => {
      const n = pts.length;
      let all = true, none = true;
      for (let i = 0; i < n; i++) { if (keep[i]) none = false; else all = false; }
      if (none) return;
      if (all) { push(pts, closed); return; }
      let start = 0;
      if (closed) { while (start < n && keep[start]) start++; }
      const flush = (r) => { if (r && r.length >= 2 && pathLength(r) > 0.5) push(r, false); };
      let run = null;
      for (let k = 0; k <= n; k++) {
        const idx = closed ? (start + k) % n : k;
        const on = k < n && keep[idx];
        if (on) { if (!run) run = []; run.push(pts[idx]); }
        else if (run) { flush(run); run = null; }
        if (!closed && k === n - 1) break;
      }
      flush(run);
    };
    const buildSlice = (z) => {
      const loops = chain(sliceSegs(z));
      const holes = holeSectionsAt(z).map(withBB);
      const closedPolys = loops.filter((L) => L.closed && L.pts.length >= 3).map((L) => withBB(L.pts));
      const out = [];
      const push = (pts, closed) => out.push({ pts, closed });
      for (const L of loops) {
        const pts = resample(L.pts, L.closed, step);
        if (pts.length < 2) continue;
        if (!holes.length) { push(pts, L.closed); continue; }
        const keep = pts.map(([x, y]) => {
          for (const hp of holes) if (inPoly(x, y, hp)) return false;
          return true;
        });
        emitRuns(pts, keep, L.closed, push);
      }
      for (let hI = 0; hI < holes.length; hI++) {
        const hp = holes[hI];
        const pts = resample(hp.pts, true, Math.min(step, 0.5));
        if (pts.length < 2) continue;
        const keep = pts.map(([x, y]) => {
          if (closedPolys.length && !inLoops(x, y, closedPolys)) return false;
          for (let j = 0; j < holes.length; j++) if (j !== hI && inPoly(x, y, holes[j])) return false;
          return true;
        });
        emitRuns(pts, keep, true, push);
      }
      return out;
    };

    /* ---- preview modes must show EVERY sheet, so coarsen the sampling until the
       whole run fits the budget rather than truncating the run halfway ---- */
    const previewStep = (count) => {
      const per = 2 * ((x1 - x0) * s + (y1 - y0) * s) * 2;
      const est = ((count == null ? nSl : count) * per) / step;
      const room = BUDGET * 0.8;
      return est > room ? Math.min(20, step * (est / room)) : step;
    };

    /* ---- output modes ---- */
    const paths = [];
    let budget = BUDGET;
    const cxm = W / 2, cym = H / 2;
    const addSlice = (sl, ox, oy, k) => {
      const f = k == null ? 1 : k;
      for (const q of sl) {
        if (budget <= 0) return;
        const pts = q.pts.map(([x, y]) => [ox + x * f, oy + y * f]);
        budget -= pts.length;
        paths.push({ pts, closed: q.closed, layer });
      }
    };
    const mode = p.mode || "All contours";
    if (mode === "Single slice" || mode === "Frames (ANIMATE)") {
      let idx;
      if (mode === "Single slice") idx = Math.round(+p.slice || 1) - 1;
      else idx = ctx && ctx.frameIdx != null ? Math.round(ctx.frameIdx) : 0;
      idx = Math.max(0, Math.min(nSl - 1, idx));
      addSlice(buildSlice(planeZ(idx)), cxm, cym);
    } else if (mode === "All contours") {
      for (let i = 0; i < nSl && budget > 0; i++) addSlice(buildSlice(planeZ(i)), cxm, cym);
    } else if (mode === "Isometric stack (preview)") {
      /* PREVIEW ONLY — axonometric projection of the real sliced geometry, scaled
         to fit the canvas. Shows how the negative primitives cut through the stack
         in 3D. Never a cutting file: the scale is whatever fits. */
      const az = ((+p.isoAz == null ? 35 : +p.isoAz) * Math.PI) / 180;
      const el = (Math.max(1, Math.min(89, +p.isoEl == null ? 30 : +p.isoEl)) * Math.PI) / 180;
      const spread = Math.max(0, Math.min(8, +p.isoSpread == null ? 1 : +p.isoSpread));
      const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
      const mg = Math.max(0, Math.min(200, +p.bedMargin == null ? 10 : +p.bedMargin));
      step = previewStep(Math.ceil(nSl / Math.max(1, Math.min(10, Math.round(+p.prevEvery || 1)))));
      const raw = [];
      let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity;
      let left = BUDGET;
      const evy = Math.max(1, Math.min(10, Math.round(+p.prevEvery || 1)));
      for (let i = 0; i < nSl && left > 0; i += evy) {
        const zc = planeZ(i) * spread;
        for (const q of buildSlice(planeZ(i))) {
          if (left <= 0) break;
          const pr = new Array(q.pts.length);
          for (let k = 0; k < q.pts.length; k++) {
            const X = q.pts[k][0] * ca - q.pts[k][1] * sa;
            const Y = q.pts[k][0] * sa + q.pts[k][1] * ca;
            const sx = X, sy = Y * se - zc * ce;
            if (sx < ax0) ax0 = sx; if (sx > ax1) ax1 = sx;
            if (sy < ay0) ay0 = sy; if (sy > ay1) ay1 = sy;
            pr[k] = [sx, sy];
          }
          left -= pr.length;
          raw.push({ pts: pr, closed: q.closed });
        }
      }
      const pw = ax1 - ax0, ph = ay1 - ay0;
      if (pw > 0 && ph > 0) {
        const k = Math.min((W - 2 * mg) / pw, (H - 2 * mg) / ph);
        const ox = cxm - ((ax0 + ax1) / 2) * k, oy = cym - ((ay0 + ay1) / 2) * k;
        for (const q of raw) paths.push({ pts: q.pts.map(([x, y]) => [ox + x * k, oy + y * k]), closed: q.closed, layer });
      }
      budget = 0;
      const mPen = ((Math.round(+p.markPen || 0) % 12) + 12) % 12;
      const fs = fontStrokes("PREVIEW NOT TO SCALE", Math.min(5, Math.max(2, mg - 2)));
      for (const st of fs.strokes) paths.push({ pts: st.map(([x, y]) => [2 + x, 2 + y]), closed: false, layer: mPen });
    } else if (mode === "Contact sheet (preview)") {
      /* PREVIEW ONLY — the whole run tiled and shrunk until it fits, so the negative
         primitives can be judged across every sheet without touching Size. The gap and
         the number gutter stay unscaled so labels remain legible at any shrink factor. */
      const bw = (x1 - x0) * s, bh = (y1 - y0) * s;
      const gapU = Math.max(0, Math.min(100, +p.gridGap || 0));
      const mg = Math.max(0, Math.min(200, +p.bedMargin == null ? 10 : +p.bedMargin));
      const evy = Math.max(1, Math.min(10, Math.round(+p.prevEvery || 1)));
      const shown = [];
      for (let i = 0; i < nSl; i += evy) shown.push(i);
      const nShow = shown.length;
      const numOn = !!p.gridNum;
      const lsize = Math.max(1.8, Math.min(+p.numSize || 5, 6));
      const gut = numOn ? lsize * 1.25 : 0;
      let cols = Math.round(+p.gridCols || 0);
      if (cols < 1) cols = Math.max(1, Math.round(Math.sqrt((nShow * (W / Math.max(1, H)) * (bh + gapU + gut)) / Math.max(0.001, bw + gapU))));
      cols = Math.max(1, Math.min(40, cols));
      const rows = Math.ceil(nShow / cols);
      const availW = Math.max(1, W - 2 * mg), availH = Math.max(1, H - 2 * mg);
      const kW = (availW - cols * gapU) / Math.max(0.001, cols * bw);
      const kH = (availH - rows * (gapU + gut)) / Math.max(0.001, rows * bh);
      const k = Math.max(0.01, Math.min(kW, kH, 4));
      step = previewStep(nShow);
      const cellW = bw * k + gapU, cellH = bh * k + gapU + gut;
      const gx0 = cxm - (cols * cellW) / 2, gy0 = cym - (rows * cellH) / 2;
      const mPen = ((Math.round(+p.markPen || 0) % 12) + 12) % 12;
      for (let c = 0; c < nShow && budget > 0; c++) {
        const i = shown[c];
        const col = c % cols, row = Math.floor(c / cols);
        const cx0 = gx0 + col * cellW, cy0 = gy0 + row * cellH;
        addSlice(buildSlice(planeZ(i)), cx0 + (bw * k) / 2, cy0 + gut + (bh * k) / 2, k);
        if (numOn && budget > 0) {
          const lab = fontStrokes(String(i + 1), lsize);
          for (const st of lab.strokes) {
            if (budget <= 0) break;
            const pts = st.map(([x, y]) => [cx0 + x, cy0 + y]);
            budget -= pts.length;
            paths.push({ pts, closed: false, layer: mPen });
          }
        }
      }
      const fs = fontStrokes("PREVIEW NOT TO SCALE", Math.min(5, Math.max(2, mg - 2)));
      for (const st of fs.strokes) paths.push({ pts: st.map(([x, y]) => [2 + x, 2 + y]), closed: false, layer: mPen });
    } else {
      /* Grid layout / Grid pages — true scale, anchored to the bed corner, never fitted.
         Columns default to what fits between the bed margins; Grid pages splits the
         run into canvas-sized pages and picks one via the ANIMATE frame index. */
      const bw = (x1 - x0) * s, bh = (y1 - y0) * s;
      const gap = Math.max(0, Math.min(100, +p.gridGap || 0));
      const mg = Math.max(0, Math.min(200, +p.bedMargin == null ? 10 : +p.bedMargin));
      const cw = bw + gap, ch = bh + gap;
      let cols = Math.round(+p.gridCols || 0);
      if (cols < 1) cols = Math.floor((W - 2 * mg + gap) / Math.max(0.001, cw));
      cols = Math.max(1, Math.min(40, cols));
      const paged = mode === "Grid pages (ANIMATE)";
      let rowsPer = Math.floor((H - 2 * mg + gap) / Math.max(0.001, ch));
      rowsPer = Math.max(1, Math.min(40, rowsPer));
      const perPage = paged ? cols * rowsPer : nSl;
      const pages = Math.max(1, Math.ceil(nSl / perPage));
      let page = 0;
      if (paged) {
        page = ctx && ctx.frameIdx != null ? Math.round(ctx.frameIdx) : 0;
        page = Math.max(0, Math.min(pages - 1, page));
      }
      const first = page * perPage;
      const last = Math.min(nSl, first + perPage);
      const rows = paged ? rowsPer : Math.ceil(nSl / cols);
      const gx0 = mg, gy0 = paged ? mg : Math.max(mg, cym - (rows * ch) / 2);
      const numOn = !!p.gridNum;
      const nSize = Math.max(2, Math.min(30, +p.numSize || 5));
      const mPen = ((Math.round(+p.markPen || 0) % 12) + 12) % 12;
      const label = (str, tx, ty, sz) => {
        const fs = fontStrokes(str, sz);
        for (const st of fs.strokes) {
          if (budget <= 0) break;
          const pts = st.map(([x, y]) => [tx + x, ty + y]);
          budget -= pts.length;
          paths.push({ pts, closed: false, layer: mPen });
        }
      };
      for (let i = first; i < last && budget > 0; i++) {
        const k = i - first;
        const col = k % cols, row = Math.floor(k / cols);
        const ox = gx0 + col * cw + bw / 2, oy = gy0 + row * ch + bh / 2;
        addSlice(buildSlice(planeZ(i)), ox, oy);
        if (numOn && budget > 0) label(String(i + 1), gx0 + col * cw + 1.2, gy0 + row * ch + 1.2, nSize);
      }
      if (paged && numOn && budget > 0 && mg >= 4) {
        label("P" + (page + 1) + "/" + pages + " S" + (first + 1) + "-" + last, gx0, Math.max(0, gy0 - nSize - 1.5), Math.min(nSize, mg - 1.5));
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
