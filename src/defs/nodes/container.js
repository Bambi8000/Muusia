import { Pin, EMPTY, resample } from "../helpers.js";

export default {
  key: "container",
  name: "Container",
  cat: "duo",
  desc: "Limits content to a region: wire any closed shapes into Region (a Potato, a Pebble, text outlines), or pick a built-in Rectangle, Circle or Triangle placed with Center/Size/Rotate (dashed guide). Keep Inside boxes an effect into the area, Outside punches a hole. Gap grows (+) or shrinks (-) the region from its edge; cuts are bisection-accurate at the border and fully-inside closed paths stay closed. Draw region plots the container outline itself on its own pen. Unwired Region in Wired mode passes content through untouched. Tip: content -> Container(Potato) -> Squiggle confines the whole chain's effect to the potato.",
  ins: [Pin("paths", "Content"), Pin("paths", "Region (closed)")],
  outs: [Pin("paths")],
  params: [
    { key: "shape", label: "Shape", type: "select", options: ["Wired region", "Rectangle", "Circle", "Triangle"], def: "Wired region" },
    { key: "cx", label: "Center X mm", type: "slider", min: 0, max: 400, step: 1, def: 105 },
    { key: "cy", label: "Center Y mm", type: "slider", min: 0, max: 400, step: 1, def: 148 },
    { key: "rw", label: "Rect W mm", type: "slider", min: 5, max: 400, step: 1, def: 120 },
    { key: "rh", label: "Rect H mm", type: "slider", min: 5, max: 400, step: 1, def: 90 },
    { key: "cr", label: "Circle / Triangle R mm", type: "slider", min: 2, max: 250, step: 1, def: 55 },
    { key: "rot", label: "Rotate \u00b0", type: "slider", min: 0, max: 360, step: 1, def: 0 },
    { key: "keep", label: "Keep", type: "select", options: ["Inside", "Outside"], def: "Inside" },
    { key: "gap", label: "Gap mm (+grow / -shrink)", type: "slider", min: -20, max: 20, step: 0.5, def: 0 },
    { key: "draw", label: "Draw region", type: "check", def: false },
    { key: "regionPen", label: "Region pen", type: "pen", def: 1 },
  ],
  overlay(p, ctx, ins) {
    /* wired regions arrive via the optional ins argument (engine overlay-ins patch);
       on an engine without the patch ins is undefined and wired mode shows no guide */
    if (p.shape === "Wired region") {
      const wired = (ins && ins[1]) || EMPTY;
      const guides = [];
      for (const pa of wired.paths) {
        if (pa.closed && pa.pts.length >= 3) guides.push({ kind: "poly", pts: pa.pts });
        if (guides.length >= 64) break;
      }
      return guides;
    }
    if (p.shape === "Rectangle") {
      const a = (p.rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const pts = [[-p.rw / 2, -p.rh / 2], [p.rw / 2, -p.rh / 2], [p.rw / 2, p.rh / 2], [-p.rw / 2, p.rh / 2]]
        .map(([x, y]) => [p.cx + x * ca - y * sa, p.cy + x * sa + y * ca]);
      return [{ kind: "poly", pts }];
    }
    if (p.shape === "Circle") return [{ kind: "circle", cx: p.cx, cy: p.cy, r: p.cr }];
    if (p.shape === "Triangle") {
      const pts = [];
      for (let k = 0; k < 3; k++) {
        const a = ((p.rot - 90 + k * 120) * Math.PI) / 180;
        pts.push([p.cx + Math.cos(a) * p.cr, p.cy + Math.sin(a) * p.cr]);
      }
      return [{ kind: "poly", pts }];
    }
    return [];
  },
  compute(ins, p, ctx) {
    const src = ins[0] || EMPTY;
    const wired = ins[1] || EMPTY;

    /* ---- region polygons ---- */
    const polys = [];
    if (p.shape === "Wired region") {
      for (const pa of wired.paths) {
        if (pa.closed && pa.pts.length >= 3) polys.push(pa.pts);
      }
      if (!polys.length) return src; /* nothing to contain: pass through */
    } else if (p.shape === "Rectangle") {
      const a = (p.rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      polys.push([[-p.rw / 2, -p.rh / 2], [p.rw / 2, -p.rh / 2], [p.rw / 2, p.rh / 2], [-p.rw / 2, p.rh / 2]]
        .map(([x, y]) => [p.cx + x * ca - y * sa, p.cy + x * sa + y * ca]));
    } else if (p.shape === "Circle") {
      const n = Math.max(24, Math.ceil((Math.PI * 2 * Math.max(2, p.cr)) / 0.7));
      const pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([p.cx + Math.cos(a) * p.cr, p.cy + Math.sin(a) * p.cr]);
      }
      polys.push(pts);
    } else { /* Triangle */
      const pts = [];
      for (let k = 0; k < 3; k++) {
        const a = ((p.rot - 90 + k * 120) * Math.PI) / 180;
        pts.push([p.cx + Math.cos(a) * Math.max(2, p.cr), p.cy + Math.sin(a) * Math.max(2, p.cr)]);
      }
      polys.push(pts);
    }

    /* ---- region test with gap: inside-any XOR grown/shrunk by boundary distance ---- */
    const segs = [];
    for (const poly of polys) {
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        segs.push([poly[j][0], poly[j][1], poly[i][0], poly[i][1]]);
      }
    }
    const distToBoundary = (x, y) => {
      let bd = Infinity;
      for (const s of segs) {
        const dx = s[2] - s[0], dy = s[3] - s[1];
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = s[0] + dx * t, py = s[1] + dy * t;
        const dd = (x - px) * (x - px) + (y - py) * (y - py);
        if (dd < bd) bd = dd;
      }
      return Math.sqrt(bd);
    };
    const insideAny = (x, y) => {
      for (const poly of polys) {
        let inn = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inn = !inn;
        }
        if (inn) return true;
      }
      return false;
    };
    const g = p.gap;
    const inRegion = (x, y) => {
      const inn = insideAny(x, y);
      if (g === 0) return inn;
      if (g > 0) return inn || distToBoundary(x, y) <= g;   /* grow */
      return inn && distToBoundary(x, y) >= -g;             /* shrink */
    };
    const wantInside = p.keep === "Inside";
    const want = ([x, y]) => inRegion(x, y) === wantInside;

    /* ---- clip with bisection-accurate boundary points (crop.js convention) ---- */
    const cross = (a, b) => { /* a wanted, b not */
      let lo = a, hi = b;
      for (let i = 0; i < 10; i++) {
        const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
        if (want(mid)) lo = mid; else hi = mid;
      }
      return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    };
    const paths = [];
    for (const path of src.paths) {
      const pts = resample(path.pts, path.closed, 0.8);
      const seq = path.closed && pts.length > 1 ? [...pts, pts[0]] : pts;
      let run = [];
      const flush = () => {
        if (run.length > 1) paths.push({ pts: run, closed: false, layer: path.layer });
        run = [];
      };
      for (let i = 0; i < seq.length; i++) {
        const cur = seq[i];
        if (want(cur)) {
          if (run.length === 0 && i > 0 && !want(seq[i - 1])) run.push(cross(cur, seq[i - 1]));
          run.push(cur);
        } else if (run.length > 0) {
          run.push(cross(seq[i - 1], cur));
          flush();
        }
      }
      /* a closed path that never crossed the border stays closed */
      if (path.closed && run.length === seq.length) {
        run.pop();
        paths.push({ pts: run, closed: true, layer: path.layer });
      } else flush();
    }

    if (p.draw) {
      const RP = Math.round(p.regionPen);
      for (const poly of polys) {
        paths.push({ pts: poly.map((q) => q.slice()), closed: true, layer: RP });
      }
    }
    return { paths };
  },
};
