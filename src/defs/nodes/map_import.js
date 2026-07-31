import { Pin, EMPTY, PENS, pathLength, applyStyle } from "../helpers.js";

export default {
  key: "map_import",
  name: "Map Import",
  cat: "gen",
  group: "structural",
  desc: "Plots a real city from an OpenStreetMap extract. Export GeoJSON from overpass-turbo.eu (or any OSM tool), load it with the file button, and the map fits the canvas. Roads are weighted by OSM class \u2014 motorways plot as three parallel strokes, primary/secondary as two, residential as one (turn Road weights off for single strokes everywhere) \u2014 while Minor paths adds footways and cycle paths. Water draws river and lake outlines, Buildings their footprints, each on its own pen. Fit: Contain shows the whole extract, Cover fills the sheet and crops. Simplify decimates dense OSM vertices in millimetres \u2014 raise it if a big city trips the point budget. Rotate turns the map. Tip: in overpass-turbo query highway=* plus natural=water for a clean plottable sheet; Siilinj\u00e4rvi fits at Simplify 0.2, Tokyo wants 0.8+.",
  fileLabel: "Choose GeoJSON\u2026",
  fileAccept: ".geojson,.json,application/geo+json,application/json",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "src", label: "GeoJSON file", type: "file", def: "" },
    { key: "fit", label: "Fit", type: "select", options: ["Contain", "Cover"], def: "Contain" },
    { key: "rotate", label: "Rotate", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "simplify", label: "Simplify", type: "slider", min: 0, max: 2, step: 0.05, def: 0.25 },
    { key: "weights", label: "Road weights", type: "check", def: true },
    { key: "roads", label: "Roads", type: "check", def: true },
    { key: "minor", label: "Minor paths", type: "check", def: false },
    { key: "waterOn", label: "Water", type: "check", def: true },
    { key: "bldg", label: "Buildings", type: "check", def: false },
    { key: "rail", label: "Rail", type: "check", def: true },
    { key: "margin", label: "Margin", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "roadPen", label: "Road pen", type: "pen", def: 0 },
    { key: "waterPen", label: "Water pen", type: "pen", def: 1 },
    { key: "bldgPen", label: "Building pen", type: "pen", def: 3 },
  ],
  overlay(p, ctx) {
    const m = Math.max(0, p.margin);
    return [{ kind: "rect", x: m, y: m, w: ctx.W - 2 * m, h: ctx.H - 2 * m }];
  },
  onFile(text) {
    const gj = JSON.parse(text);
    const feats = gj.type === "FeatureCollection" ? gj.features
      : gj.type === "Feature" ? [gj] : [];
    const MAJOR = { motorway: 1, motorway_link: 1, trunk: 1, trunk_link: 1 };
    const MID = { primary: 1, primary_link: 1, secondary: 1, secondary_link: 1, tertiary: 1, tertiary_link: 1 };
    const FOOT = { footway: 1, path: 1, cycleway: 1, steps: 1, pedestrian: 1, track: 1, bridleway: 1 };
    const lines = [], polys = [];
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    const eat = (coords) => {
      for (const [lon, lat] of coords) {
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      }
    };
    for (const f of feats) {
      const g = f.geometry, pr = f.properties || {};
      if (!g) continue;
      let cls = null;
      if (pr.highway) cls = MAJOR[pr.highway] ? "major" : MID[pr.highway] ? "mid"
        : FOOT[pr.highway] ? "minor" : "street";
      else if (pr.railway) cls = "rail";
      else if (pr.waterway) cls = "waterline";
      const isWaterPoly = pr.natural === "water" || pr.water ||
        pr.landuse === "reservoir" || pr.waterway === "riverbank";
      const isBldg = !!pr.building;
      const addLine = (c) => { if (cls) { eat(c); lines.push({ c, cls }); } };
      const addPoly = (rings, kind) => {
        for (const ring of rings) { eat(ring); polys.push({ c: ring, kind }); }
      };
      if (g.type === "LineString") addLine(g.coordinates);
      else if (g.type === "MultiLineString") for (const c of g.coordinates) addLine(c);
      else if (g.type === "Polygon") {
        if (isWaterPoly) addPoly(g.coordinates, "water");
        else if (isBldg) addPoly(g.coordinates, "bldg");
        else if (cls) addLine(g.coordinates[0]); // closed highways (roundabouts)
      } else if (g.type === "MultiPolygon") {
        for (const pg of g.coordinates) {
          if (isWaterPoly) addPoly(pg, "water");
          else if (isBldg) addPoly(pg, "bldg");
        }
      }
    }
    if (!lines.length && !polys.length) return { empty: true };
    // equirectangular projection scaled to metres-ish at the extract centre
    const lat0 = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const kx = Math.cos(lat0);
    const proj = ({ c, ...rest }) => ({
      ...rest,
      pts: c.map(([lon, lat]) => [lon * kx, -lat]),
    });
    return {
      lines: lines.map(proj),
      polys: polys.map(proj),
      bbox: [minLon * kx, -maxLat, maxLon * kx, -minLat],
    };
  },
  compute(ins, p, ctx, node) {
    const { W, H } = ctx;
    // the app stores every onFile result at node.data.svg (engine convention)
    const D = node && node.data && node.data.svg;
    if (!D || D.empty || !D.bbox) return EMPTY;
    const m = Math.max(0, p.margin);
    const lox = m, loy = m, hix = W - m, hiy = H - m;
    if (hix - lox < 5 || hiy - loy < 5) return EMPTY;
    const roadPen = Math.round(p.roadPen) % PENS.length;
    const waterPen = Math.round(p.waterPen) % PENS.length;
    const bldgPen = Math.round(p.bldgPen) % PENS.length;

    const [bx0, by0, bx1, by1] = D.bbox;
    const bw = Math.max(1e-9, bx1 - bx0), bh = Math.max(1e-9, by1 - by0);
    const rot = (p.rotate * Math.PI) / 180;
    const ca = Math.cos(rot), sa = Math.sin(rot);
    // rotated extent for the fit
    const rw = Math.abs(bw * ca) + Math.abs(bh * sa);
    const rh = Math.abs(bw * sa) + Math.abs(bh * ca);
    const sC = Math.min((hix - lox) / rw, (hiy - loy) / rh);
    const sV = Math.max((hix - lox) / rw, (hiy - loy) / rh);
    const S = p.fit === "Cover" ? sV : sC;
    const cx0 = (bx0 + bx1) / 2, cy0 = (by0 + by1) / 2;
    const CX = (lox + hix) / 2, CY = (loy + hiy) / 2;
    const tx = (x, y) => {
      const dx = (x - cx0) * S, dy = (y - cy0) * S;
      return [CX + dx * ca - dy * sa, CY + dx * sa + dy * ca];
    };
    const inRegion = ([x, y]) => x >= lox && x <= hix && y >= loy && y <= hiy;

    const paths = [];
    let budget = 115000;
    const push = (pts, closed, layer) => {
      if (pts.length < 2 || budget <= 0) return;
      budget -= pts.length;
      paths.push({ pts, closed, layer });
    };
    const tol = Math.max(0, p.simplify);
    const simplify = (pts) => {
      if (tol < 0.01 || pts.length < 3) return pts;
      const out = [pts[0]];
      let a = pts[0];
      for (let i = 1; i < pts.length - 1; i++) {
        const b = pts[i + 1], q = pts[i];
        const ux = b[0] - a[0], uy = b[1] - a[1];
        const L = Math.hypot(ux, uy) || 1;
        if (Math.abs((q[0] - a[0]) * uy - (q[1] - a[1]) * ux) / L > tol ||
            Math.hypot(q[0] - a[0], q[1] - a[1]) > 25) {
          out.push(q); a = q;
        }
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    const offsetPath = (pts, d) => {
      const n = pts.length, out = [];
      for (let i = 0; i < n; i++) {
        const q = pts[i], pv = pts[Math.max(0, i - 1)], nx = pts[Math.min(n - 1, i + 1)];
        let d1 = [q[0] - pv[0], q[1] - pv[1]], d2 = [nx[0] - q[0], nx[1] - q[1]];
        const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
        if (l1 > 1e-9) d1 = [d1[0] / l1, d1[1] / l1];
        if (l2 > 1e-9) d2 = [d2[0] / l2, d2[1] / l2];
        if (i === 0 || l1 < 1e-9) d1 = d2;
        if (i === n - 1 || l2 < 1e-9) d2 = d1;
        const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
        let mm = [n1[0] + n2[0], n1[1] + n2[1]];
        const ml = Math.hypot(mm[0], mm[1]);
        mm = ml < 1e-6 ? n1 : [mm[0] / ml, mm[1] / ml];
        const co = Math.max(0.4, mm[0] * n1[0] + mm[1] * n1[1]);
        out.push([q[0] + (mm[0] * d) / co, q[1] + (mm[1] * d) / co]);
      }
      return out;
    };
    // clip point b of segment a->b to the margin box border
    const clipToBox = (a, b) => {
      let t = 1;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      if (dx > 0) t = Math.min(t, (hix - a[0]) / dx);
      if (dx < 0) t = Math.min(t, (lox - a[0]) / dx);
      if (dy > 0) t = Math.min(t, (hiy - a[1]) / dy);
      if (dy < 0) t = Math.min(t, (loy - a[1]) / dy);
      t = Math.max(0, Math.min(1, t));
      return [a[0] + dx * t, a[1] + dy * t];
    };
    // emit with crop to the margin box (needed for Cover fit); runs are cut
    // exactly at the frame so cropped roads touch the border
    const cropRuns = (seq, layer) => {
      let run = [];
      const flush = () => {
        if (run.length >= 2 && pathLength(run, false) > 0.6) push(run, false, layer);
        run = [];
      };
      for (let i = 0; i < seq.length; i++) {
        const q = seq[i], prev = seq[i - 1];
        if (inRegion(q)) {
          if (run.length === 0 && prev && !inRegion(prev))
            run.push(clipToBox(q, prev));
          run.push(q);
        } else {
          if (run.length && prev && inRegion(prev)) run.push(clipToBox(prev, q));
          flush();
        }
      }
      flush();
    };
    const emit = (pts, closed, layer) => {
      const P = simplify(pts.map(([x, y]) => tx(x, y)));
      if (P.every(inRegion)) { push(P, closed, layer); return; }
      cropRuns(closed ? [...P, P[0]] : P, layer);
    };
    const emitWeighted = (pts, cls) => {
      const P = simplify(pts.map(([x, y]) => tx(x, y)));
      const offs = !p.weights ? [0]
        : cls === "major" ? [-0.55, 0, 0.55]
        : cls === "mid" ? [-0.35, 0.35] : [0];
      for (const o of offs) {
        const Q = o === 0 ? P : offsetPath(P, o);
        if (Q.every(inRegion)) { push(Q, false, roadPen); continue; }
        cropRuns(Q, roadPen);
      }
    };

    for (const L of D.lines) {
      if (budget <= 0) break;
      if (L.cls === "waterline") { if (p.waterOn) emit(L.pts, false, waterPen); continue; }
      if (L.cls === "rail") { if (p.rail) emit(L.pts, false, roadPen); continue; }
      if (L.cls === "minor" && !p.minor) continue;
      if (!p.roads) continue;
      emitWeighted(L.pts, L.cls);
    }
    for (const G of D.polys) {
      if (budget <= 0) break;
      if (G.kind === "water" && p.waterOn) emit(G.pts, true, waterPen);
      if (G.kind === "bldg" && p.bldg) emit(G.pts, true, bldgPen);
    }
    return applyStyle({ paths }, ins[0]);
  },
};
