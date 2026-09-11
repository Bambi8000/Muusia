import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "gcode_in",
  name: "G-code In",
  cat: "gen",
  group: "textimg",
  fileLabel: "Choose G-code\u2026",
  fileAccept: ".gcode,.nc,.ngc,.g,.txt",
  desc: "Imports G-code back into the graph as paths \u2014 the return leg of the Muusia \u2192 Latu \u2192 Muusia roundtrip, and a general importer for foreign plotter G-code. Muusia's own output is self-describing: the header comment carries canvas size, origin and Y-flip, pen changes are CHANGE PEN comments and the pen lift is either bed-Z or SET_SERVO \u2014 so with everything on Auto the geometry returns to canvas millimetres 1:1, in the original drawing order, with pen layers and closed paths reconstructed and Brush Z immersion preserved in the points' third component. Pen detect: Auto (Muusia/Latu) reads servo angles or standalone Z moves (down when at the lowest contact level, so z-hop travels stay lifted); G0 travel / G1 draw and Z threshold cover foreign files. Layers: Auto maps CHANGE PEN comments to pens (falling back to splitting at M0 pauses when none exist), or force Split at pauses / Single pen. Coordinates: Auto inverts the Muusia header transform; As written keeps raw machine mm; Flip Y mirrors over the content box for Y-up foreign files (Auto does the same when no header is found). Placement: True scale keeps millimetres exact with Offset X/Y nudges, Fit to margin rescales into the margin box. Latu additions (INK_DOSE, AIR_PULSE, E words), dips, maintenance blocks, CANVAS_CHECK, MANUAL_STEPPER and other macros are skipped as motion; G90/G91, G20/G21 and G2/G3 arcs (IJ and R forms, tessellated at ~0.5 mm) are supported for foreign files. Simplify drops points closer than the given millimetres to tame dense output. Fully deterministic \u2014 no seed.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "filename", label: "G-code file", type: "file", def: "" },
    { key: "mode", label: "Pen detect", type: "select", options: ["Auto (Muusia/Latu)", "G0 travel / G1 draw", "Z threshold"], def: "Auto (Muusia/Latu)" },
    { key: "zthresh", label: "Z threshold mm", type: "slider", min: -5, max: 20, step: 0.1, def: 0.5, showIf: (p) => p.mode === "Z threshold" },
    { key: "layers", label: "Layers", type: "select", options: ["Auto (pen comments)", "Split at pauses", "Single pen"], def: "Auto (pen comments)" },
    { key: "layer", label: "Pen (if single)", type: "pen", def: 0, showIf: (p) => p.layers === "Single pen" },
    { key: "coords", label: "Coordinates", type: "select", options: ["Auto (Muusia header)", "As written", "Flip Y"], def: "Auto (Muusia header)" },
    { key: "placement", label: "Placement", type: "select", options: ["True scale", "Fit to margin"], def: "True scale" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10, showIf: (p) => p.placement === "Fit to margin" },
    { key: "offx", label: "Offset X mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0, showIf: (p) => p.placement === "True scale" },
    { key: "offy", label: "Offset Y mm", type: "slider", min: -400, max: 400, step: 0.5, def: 0, showIf: (p) => p.placement === "True scale" },
    { key: "simplify", label: "Simplify mm", type: "slider", min: 0, max: 2, step: 0.05, def: 0 },
    { key: "brushz", label: "Brush Z", type: "select", options: ["Keep", "Ignore"], def: "Keep" },
  ],

  /* Tokenize once at load: line-level string work here, so compute only runs a
     cheap state machine when parameters change. Ops are compact arrays:
     ["M",g,x|null,y|null,z|null] motion \u00b7 ["A",g,x,y,i,j,r] arc \u00b7 ["Z",z]
     standalone Z \u00b7 ["S",angle] servo \u00b7 ["P"] pause \u00b7 ["L",pen] pen comment \u00b7
     ["H"] home \u00b7 ["G90"|"G91"|"G20"|"G21"] modes. Everything else is skipped. */
  onFile(text) {
    const ops = [];
    const meta = { muusia: false, cw: null, ch: null, ox: 0, oy: 0, flip: false, sUp: null, sDown: null };
    const lines = String(text || "").split(/\r?\n/);
    let skip = false;
    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li];
      const ci = raw.indexOf(";");
      const code = (ci >= 0 ? raw.slice(0, ci) : raw).trim();
      const com = ci >= 0 ? raw.slice(ci + 1).trim() : "";
      if (com === "--- dip ---" || com === "--- maintenance pause ---") { skip = true; continue; }
      if (com === "--- dip done ---" || com === "--- resume ---") { skip = false; continue; }
      if (skip) continue;
      if (com) {
        if (/^Muusia v/i.test(com)) meta.muusia = true;
        let m = com.match(/Canvas\s+([\d.]+)\s*x\s*([\d.]+)\s*mm at origin X(-?[\d.]+)\s*Y(-?[\d.]+)/i);
        if (m) { meta.cw = +m[1]; meta.ch = +m[2]; meta.ox = +m[3]; meta.oy = +m[4]; meta.flip = /Y flipped/i.test(com); }
        m = com.match(/Z mode: SERVO.*up\s+(-?[\d.]+).*down\s+(-?[\d.]+)/i);
        if (m) { meta.sUp = +m[1]; meta.sDown = +m[2]; }
        m = com.match(/CHANGE PEN\s*->\s*(\d+)/i) || com.match(/^Pen\s+(\d+):/i);
        if (m) ops.push(["L", parseInt(m[1], 10)]);
      }
      if (!code) continue;
      const U = code.toUpperCase();
      const w0 = U.split(/\s+/)[0];
      if (w0 === "SET_SERVO") {
        const m = U.match(/ANGLE=(-?[\d.]+)/);
        if (m) ops.push(["S", +m[1]]);
        continue;
      }
      if (w0 === "M0" || w0 === "M00" || w0 === "M1" || w0 === "M01" || w0 === "M25" || w0 === "M226" || w0 === "PAUSE") { ops.push(["P"]); continue; }
      if (w0 === "G90" || w0 === "G91" || w0 === "G20" || w0 === "G21") { ops.push([w0]); continue; }
      if (w0 === "G28") { ops.push(["H"]); continue; }
      const g = (w0 === "G0" || w0 === "G00") ? 0 : (w0 === "G1" || w0 === "G01") ? 1
        : (w0 === "G2" || w0 === "G02") ? 2 : (w0 === "G3" || w0 === "G03") ? 3 : -1;
      if (g < 0) continue;
      const P = {};
      const re = /([XYZIJR])\s*(-?\d*\.?\d+(?:[eE]-?\d+)?)/g;
      let mm;
      while ((mm = re.exec(U))) P[mm[1]] = +mm[2];
      if (g <= 1) {
        if (P.X === undefined && P.Y === undefined) {
          if (P.Z !== undefined) ops.push(["Z", P.Z]);
        } else {
          ops.push(["M", g,
            P.X !== undefined ? P.X : null,
            P.Y !== undefined ? P.Y : null,
            P.Z !== undefined ? P.Z : null]);
        }
      } else {
        ops.push(["A", g,
          P.X !== undefined ? P.X : null,
          P.Y !== undefined ? P.Y : null,
          P.I !== undefined ? P.I : null,
          P.J !== undefined ? P.J : null,
          P.R !== undefined ? P.R : null]);
      }
    }
    return { kind: "gcode", meta, ops };
  },

  compute(ins, p, ctx, node) {
    const d = node && node.data && node.data.svg;
    if (!d || d.kind !== "gcode" || !Array.isArray(d.ops) || !d.ops.length) return EMPTY;
    const meta = d.meta || {};
    const ops = d.ops;

    /* --- calibrate Auto pen detection from the file itself --- */
    let servoUp = meta.sUp != null ? meta.sUp : null;
    const servoDown = meta.sDown != null ? meta.sDown : null;
    let hasZop = false, hasServo = false, hasL = false;
    for (const o of ops) {
      if (o[0] === "S") { hasServo = true; if (servoUp === null) servoUp = o[1]; }
      else if (o[0] === "Z") hasZop = true;
      else if (o[0] === "L") hasL = true;
    }

    const auto = p.mode === "Auto (Muusia/Latu)";
    const gMode = p.mode === "G0 travel / G1 draw" || (auto && !hasServo && !hasZop);
    const single = p.layers === "Single pen";
    const useL = p.layers === "Auto (pen comments)" && hasL;
    const splitP = p.layers === "Split at pauses" || (p.layers === "Auto (pen comments)" && !hasL);
    const keepZ = p.brushz === "Keep" && auto && !hasServo;

    /* --- state machine over machine millimetres --- */
    let abs = true, unit = 1, x = 0, y = 0, z = null, down = false, pendImm = null;
    let contactZ = null, prevMotion = null; /* last motion's G number: 0 travel / 1 draw */
    let layer = single ? ((Math.round(p.layer) % 12) + 12) % 12 : 0;
    const polys = [];
    let cur = null;
    const endPath = () => { if (cur && cur.pts.length >= 2) polys.push(cur); cur = null; };
    const lift = () => { endPath(); down = false; };

    const appendMove = (nx, ny, nz, g) => {
      let isDraw;
      if (gMode) isDraw = g === 1;
      else if (p.mode === "Z threshold") { if (nz !== null) z = nz; isDraw = z !== null && z < p.zthresh; }
      else isDraw = down && g === 1;
      if (isDraw) {
        if (!cur) cur = { pts: [pendImm !== null && keepZ ? [x, y, pendImm] : [x, y]], layer };
        if (keepZ && nz !== null && contactZ !== null && Math.abs(contactZ - nz) > 0.005) cur.pts.push([nx, ny, contactZ - nz]);
        else cur.pts.push([nx, ny]);
      } else endPath();
      x = nx; y = ny;
      pendImm = null;
    };

    for (const o of ops) {
      const t = o[0];
      if (t === "M") {
        const nx = o[2] !== null ? (abs ? o[2] * unit : x + o[2] * unit) : x;
        const ny = o[3] !== null ? (abs ? o[3] * unit : y + o[3] * unit) : y;
        const nz = o[4] !== null ? o[4] * unit : null;
        appendMove(nx, ny, nz, o[1]);
        prevMotion = o[1];
      } else if (t === "A") {
        const g = o[1];
        const nx = o[2] !== null ? (abs ? o[2] * unit : x + o[2] * unit) : x;
        const ny = o[3] !== null ? (abs ? o[3] * unit : y + o[3] * unit) : y;
        let cx0 = null, cy0 = null;
        if (o[4] !== null || o[5] !== null) {
          cx0 = x + (o[4] || 0) * unit;
          cy0 = y + (o[5] || 0) * unit;
        } else if (o[6] !== null) {
          const r0 = Math.abs(o[6]) * unit;
          const dx = nx - x, dy = ny - y, dl = Math.hypot(dx, dy);
          if (dl > 1e-9 && dl <= 2 * r0 + 1e-6) {
            const h = Math.sqrt(Math.max(0, r0 * r0 - (dl / 2) * (dl / 2)));
            const sgn = (g === 2) !== (o[6] < 0) ? 1 : -1;
            cx0 = x + dx / 2 + sgn * (-dy / dl) * h;
            cy0 = y + dy / 2 + sgn * (dx / dl) * h;
          }
        }
        if (cx0 === null) { appendMove(nx, ny, null, 1); continue; }
        const r = Math.hypot(x - cx0, y - cy0);
        const a0 = Math.atan2(y - cy0, x - cx0);
        let a1 = Math.atan2(ny - cy0, nx - cx0);
        const full = Math.hypot(nx - x, ny - y) < 1e-9;
        if (g === 2) { if (full) a1 = a0 - 2 * Math.PI; else while (a1 >= a0 - 1e-12) a1 -= 2 * Math.PI; }
        else { if (full) a1 = a0 + 2 * Math.PI; else while (a1 <= a0 + 1e-12) a1 += 2 * Math.PI; }
        const steps = Math.max(4, Math.min(256, Math.ceil((Math.abs(a1 - a0) * Math.max(r, 0.1)) / 0.5)));
        for (let i = 1; i <= steps; i++) {
          const a = a0 + ((a1 - a0) * i) / steps;
          appendMove(cx0 + r * Math.cos(a), cy0 + r * Math.sin(a), null, 1);
        }
        if (cur) cur.pts[cur.pts.length - 1] = [nx, ny];
        x = nx; y = ny;
        prevMotion = 1;
      } else if (t === "Z") {
        const nz = o[1] * unit;
        z = nz;
        if (auto && !hasServo) {
          /* Context first: a standalone Z right after a travel is the down side
             (contact, or brush pressure relative to it); after draw moves it is
             a lift -- unless the value returns to a known contact level, which
             covers foreign files that travel with G1. */
          if (prevMotion === 0) {
            if (!down) { down = true; contactZ = nz; }
            else if (contactZ !== null && Math.abs(contactZ - nz) > 0.005) pendImm = contactZ - nz;
          } else if (contactZ !== null && nz <= contactZ + 0.05) {
            down = true;
          } else {
            lift();
          }
        } else if (p.mode === "Z threshold" && nz >= p.zthresh) endPath();
      } else if (t === "S") {
        if (auto) {
          const a = o[1];
          const isDown = servoDown !== null
            ? Math.abs(a - servoDown) < Math.abs(a - servoUp)
            : servoUp !== null && Math.abs(a - servoUp) > 0.5;
          if (isDown) down = true; else lift();
        }
      } else if (t === "L") {
        if (useL) { endPath(); layer = ((o[1] % 12) + 12) % 12; }
      } else if (t === "P") {
        endPath();
        if (splitP && !single) layer = (layer + 1) % 12;
      } else if (t === "H") {
        lift(); x = 0; y = 0; z = null; prevMotion = null; contactZ = null;
      } else if (t === "G90") abs = true;
      else if (t === "G91") abs = false;
      else if (t === "G20") unit = 25.4;
      else if (t === "G21") unit = 1;
    }
    endPath();
    if (!polys.length) return EMPTY;

    /* --- machine mm -> canvas frame --- */
    const useHdr = p.coords === "Auto (Muusia header)" && meta.cw != null && meta.ch != null;
    let flipLine = null;
    if (!useHdr && (p.coords === "Flip Y" || p.coords === "Auto (Muusia header)")) {
      let mn = Infinity, mx = -Infinity;
      for (const q of polys) for (const pt of q.pts) { if (pt[1] < mn) mn = pt[1]; if (pt[1] > mx) mx = pt[1]; }
      if (mn <= mx) flipLine = mn + mx;
    }
    const tf = (pt) => {
      let X = pt[0], Y = pt[1];
      if (useHdr) { X -= meta.ox; Y -= meta.oy; if (meta.flip) Y = meta.ch - Y; }
      else if (flipLine !== null) Y = flipLine - Y;
      return pt.length > 2 ? [X, Y, pt[2]] : [X, Y];
    };
    let paths = polys.map((q) => ({ pts: q.pts.map(tf), closed: false, layer: q.layer }));

    /* closed reconstruction: G-code loses the flag; toGcode rounds to 0.01 mm */
    for (const q of paths) {
      const a = q.pts[0], b = q.pts[q.pts.length - 1];
      if (q.pts.length >= 4 && Math.hypot(a[0] - b[0], a[1] - b[1]) <= 0.02) { q.closed = true; q.pts.pop(); }
    }

    /* simplify: drop points closer than the pitch, endpoints kept */
    if (p.simplify > 0.001) {
      paths = paths
        .map((q) => {
          const outp = [q.pts[0]];
          for (let i = 1; i < q.pts.length - 1; i++) {
            const l = outp[outp.length - 1];
            if (Math.hypot(q.pts[i][0] - l[0], q.pts[i][1] - l[1]) >= p.simplify) outp.push(q.pts[i]);
          }
          if (q.pts.length > 1) outp.push(q.pts[q.pts.length - 1]);
          return { pts: outp, closed: q.closed, layer: q.layer };
        })
        .filter((q) => q.pts.length >= 2);
      if (!paths.length) return EMPTY;
    }

    /* placement */
    if (p.placement === "Fit to margin") {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of paths) for (const pt of q.pts) {
        if (pt[0] < x0) x0 = pt[0];
        if (pt[0] > x1) x1 = pt[0];
        if (pt[1] < y0) y0 = pt[1];
        if (pt[1] > y1) y1 = pt[1];
      }
      const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
      const m = Math.max(0, Math.min(p.margin, ctx.W / 2 - 1, ctx.H / 2 - 1));
      const s = Math.min((ctx.W - 2 * m) / bw, (ctx.H - 2 * m) / bh);
      const ox2 = (ctx.W - bw * s) / 2 - x0 * s;
      const oy2 = (ctx.H - bh * s) / 2 - y0 * s;
      paths = paths.map((q) => ({
        ...q,
        pts: q.pts.map((pt) => pt.length > 2 ? [pt[0] * s + ox2, pt[1] * s + oy2, pt[2]] : [pt[0] * s + ox2, pt[1] * s + oy2]),
      }));
    } else if (p.offx || p.offy) {
      paths = paths.map((q) => ({
        ...q,
        pts: q.pts.map((pt) => pt.length > 2 ? [pt[0] + p.offx, pt[1] + p.offy, pt[2]] : [pt[0] + p.offx, pt[1] + p.offy]),
      }));
    }

    /* point budget: preserve file order, truncate at the tail */
    const BUDGET = 115000;
    let used = 0;
    const outPaths = [];
    for (const q of paths) {
      if (used >= BUDGET) break;
      if (used + q.pts.length <= BUDGET) { outPaths.push(q); used += q.pts.length; }
      else {
        const keep = BUDGET - used;
        if (keep >= 2) outPaths.push({ pts: q.pts.slice(0, keep), closed: false, layer: q.layer });
        used = BUDGET;
      }
    }
    return applyStyle({ paths: outPaths }, ins[0]);
  },

  /* Placement guide: Fit mode shows the margin box, True scale shows where the
     exported canvas frame lands (header size at the offset) \u2014 exactly the
     region compute maps into. Never throws; degrades to a point with no header. */
  overlay(p, ctx, ins, node) {
    try {
      if (!p || !ctx) return [];
      if (p.placement === "Fit to margin") {
        const m = Math.max(0, Math.min(p.margin, ctx.W / 2 - 1, ctx.H / 2 - 1));
        return [{ kind: "rect", x: m, y: m, w: Math.max(0, ctx.W - 2 * m), h: Math.max(0, ctx.H - 2 * m) }];
      }
      const meta = node && node.data && node.data.svg && node.data.svg.meta;
      if (meta && meta.cw != null && meta.ch != null) {
        return [{ kind: "rect", x: p.offx || 0, y: p.offy || 0, w: meta.cw, h: meta.ch }];
      }
      return [{ kind: "point", x: p.offx || 0, y: p.offy || 0 }];
    } catch (e) { return []; }
  },
};
