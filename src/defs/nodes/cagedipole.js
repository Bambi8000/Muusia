import { Pin, applyStyle } from "../helpers.js";

export default {
  /* Cage Dipoles — the UTR-2 (Kharkiv) broadband "fat dipole": two wire-cage
     arms on a common boom, each a cylinder of longitudinal wires closed by a
     cone to the feed gap and a cone to the boom end, hoops at the cylinder
     ends, optional diagonal stays. Rows of dipoles sit end to end on one boom
     carried by poles; a field is several rows. World: X along the boom, Y
     across rows, Z up; camera yaw / pitch / perspective; the projected
     drawing is fitted into the margin box. Purely deterministic, no seed. */
  key: "cagedipole",
  name: "Cage Dipoles",
  cat: "gen",
  group: "structural",
  desc: "The broadband wire-cage dipoles of the UTR-2 radio telescope at Kharkiv (the same fat-dipole family the Duga over-the-horizon radar used): two cage arms on a common boom, each a cylinder of longitudinal Wires closed by a cone to the feed Gap and a cone to the boom end, Hoops at the cylinder ends and along it, optional diagonal Stays. Per row puts dipoles end to end on one boom, Rows lines up several booms at Row gap, Poles carries the booms on posts of Pole height with a short cross-arm, Ground draws the horizon under the field. Diameter and Cylinder shape the cage. Yaw / Pitch / Perspective set the camera - wire Frame into Yaw to orbit; everything is fitted inside Margin. Poles and ground draw on the Pole pen.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "rows", label: "Rows", type: "slider", min: 1, max: 8, step: 1, def: 4 },
    { key: "perRow", label: "Per row", type: "slider", min: 1, max: 12, step: 1, def: 4 },
    { key: "rowGap", label: "Row gap (x dipole)", type: "slider", min: 0.3, max: 3, step: 0.05, def: 1.1, showIf: (p) => p.rows > 1 },
    { key: "dia", label: "Diameter (x dipole)", type: "slider", min: 0.08, max: 0.5, step: 0.01, def: 0.22 },
    { key: "cyl", label: "Cylinder (of arm)", type: "slider", min: 0.2, max: 0.85, step: 0.05, def: 0.55 },
    { key: "gap", label: "Feed gap (x dipole)", type: "slider", min: 0, max: 0.12, step: 0.005, def: 0.03 },
    { key: "wires", label: "Wires", type: "slider", min: 4, max: 24, step: 1, def: 14 },
    { key: "hoops", label: "Hoops per arm", type: "slider", min: 2, max: 6, step: 1, def: 3 },
    { key: "stays", label: "Stays", type: "check", def: true },
    { key: "poles", label: "Poles", type: "check", def: true },
    { key: "poleH", label: "Pole height (x dipole)", type: "slider", min: 0.2, max: 2, step: 0.05, def: 0.7, showIf: (p) => !!p.poles },
    { key: "ground", label: "Ground frame", type: "check", def: false, showIf: (p) => !!p.poles },
    { key: "yaw", label: "Yaw deg (wire Frame)", type: "slider", min: -90, max: 90, step: 1, def: 14 },
    { key: "pitch", label: "Pitch deg", type: "slider", min: -30, max: 60, step: 1, def: -4 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 3, step: 0.05, def: 1.6 },
    { key: "eye", label: "Eye height (x dipole, 0 = boom)", type: "slider", min: -2, max: 2, step: 0.05, def: -0.5 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 15 },
    { key: "pen", label: "Pen", type: "pen", def: 0 },
    { key: "penPole", label: "Pole pen", type: "pen", def: 8 },
  ],
  overlay(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const m = Math.max(0, +(p && p.margin) || 0);
    return [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
  },
  compute(ins, p, ctx) {
    const W = ctx.W, H = ctx.H;
    const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
    const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
    const rows = clampI(p.rows, 1, 16), per = clampI(p.perRow, 1, 24);
    const rowGap = cl(p.rowGap, 0.1, 5);
    const R = cl(p.dia, 0.02, 0.8) / 2;             /* cage radius, dipole length = 1 */
    const cyl = cl(p.cyl, 0.05, 0.95);
    const g = cl(p.gap, 0, 0.2);
    const NW = clampI(p.wires, 3, 48), NH = clampI(p.hoops, 2, 12);
    const polesOn = !!p.poles, poleH = polesOn ? cl(p.poleH, 0.05, 4) : 0;
    const pen = clampI(p.pen, 0, 11), penP = clampI(p.penPole, 0, 11);
    const TWO_PI = Math.PI * 2;

    /* --- camera --- */
    const yaw = cl(p.yaw, -720, 720) * Math.PI / 180;
    const pit = cl(p.pitch, -85, 85) * Math.PI / 180;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const persp = cl(p.persp, 0, 6);
    const eye = cl(p.eye, -10, 10);
    /* camera sits at eye height: far geometry converges toward the eye's horizon, not the boom */
    const view = (x, y, z) => { const vx = x * cy - y * sy, vy = x * sy + y * cy, vz = z - eye; return [vx, vy * cp - vz * sp, vz * cp + vy * sp]; };

    /* --- world geometry: collect view-space polylines, project + fit at the end --- */
    const raw = [];
    let budget = 115000;
    const add = (wpts, closed, layer) => {
      if (budget <= 0 || wpts.length < 2) return;
      budget -= wpts.length;
      raw.push({ v: wpts.map((q) => view(q[0], q[1], q[2])), closed, layer });
    };
    const arm = (x0, y, sgn, flip) => {
      /* one cage arm from feed apex (x0 + sgn*g) to boom end (x0 + sgn*0.5) */
      const xa = x0 + sgn * g, xe = x0 + sgn * 0.5;
      const armLen = Math.abs(xe - xa);
      const cone = armLen * (1 - cyl) / 2;
      const x1 = xa + sgn * cone, x2 = xe - sgn * cone;
      /* longitudinal wires, alternating direction to shorten pen travel */
      for (let k = 0; k < NW; k++) {
        const a = (k / NW) * TWO_PI + Math.PI / NW;
        const dy = Math.cos(a) * R, dz = Math.sin(a) * R;
        const w = [[xa, y, 0], [x1, y + dy, dz], [x2, y + dy, dz], [xe, y, 0]];
        add((k + (flip ? 1 : 0)) % 2 ? w.reverse() : w, false, pen);
      }
      /* hoops along the cylinder */
      const NR = Math.max(12, Math.min(40, Math.round(R * 160)));
      for (let h = 0; h < NH; h++) {
        const x = x1 + (x2 - x1) * (NH === 1 ? 0.5 : h / (NH - 1));
        const ring = [];
        for (let i = 0; i < NR; i++) { const a = (i / NR) * TWO_PI; ring.push([x, y + Math.cos(a) * R, Math.sin(a) * R]); }
        add(ring, true, pen);
      }
      /* diagonal stays between the end hoops, four of them a quarter turn apart */
      if (p.stays) for (let s = 0; s < 4; s++) {
        const a0 = (s / 4) * TWO_PI + Math.PI / 4, a1 = a0 + Math.PI / 2;
        add([[x1, y + Math.cos(a0) * R, Math.sin(a0) * R], [x2, y + Math.cos(a1) * R, Math.sin(a1) * R]], false, pen);
      }
    };

    const halfX = per / 2;
    const yOf = (r) => (r - (rows - 1) / 2) * rowGap;
    for (let r = 0; r < rows; r++) {
      const y = yOf(r);
      /* boom: one line for the whole row plus a short overhang */
      add([[-halfX - 0.06, y, 0], [halfX + 0.06, y, 0]], false, pen);
      for (let d = 0; d < per; d++) {
        const x0 = -halfX + d + 0.5;
        arm(x0, y, 1, false);
        arm(x0, y, -1, true);
      }
      if (polesOn) {
        for (let j = 0; j <= per; j++) {
          const x = -halfX + j;
          add([[x, y, -poleH], [x, y, -0.02]], false, penP);
          add([[x, y - 0.06, -0.03], [x, y + 0.06, -0.03]], false, penP);   /* cross-arm under the boom */
          add([[x, y, -0.03], [x, y, 0]], false, penP);
        }
      }
    }
    if (polesOn && p.ground) {
      const y0 = yOf(0) - rowGap * 0.5, y1 = yOf(rows - 1) + rowGap * 0.5;
      const ext = 0.4;
      add([[-halfX - ext, y0, -poleH], [halfX + ext, y0, -poleH]], false, penP);
      if (rows > 1) add([[-halfX - ext, y1, -poleH], [halfX + ext, y1, -poleH]], false, penP);
      add([[-halfX - ext, y0, -poleH], [-halfX - ext, y1, -poleH]], false, penP);
      add([[halfX + ext, y0, -poleH], [halfX + ext, y1, -poleH]], false, penP);
    }

    /* --- project with perspective, then fit into the margin box --- */
    let dMin = Infinity, dMax = -Infinity;
    for (const q of raw) for (const v of q.v) { if (v[1] < dMin) dMin = v[1]; if (v[1] > dMax) dMax = v[1]; }
    const S = Math.max(1e-6, dMax - dMin);
    const proj = raw.map((q) => ({ ...q, s: q.v.map((v) => { const s = 1 / (1 + persp * (v[1] - dMin) / S); return [v[0] * s, -v[2] * s]; }) }));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of proj) for (const s of q.s) { if (s[0] < x0) x0 = s[0]; if (s[0] > x1) x1 = s[0]; if (s[1] < y0) y0 = s[1]; if (s[1] > y1) y1 = s[1]; }
    const m = Math.max(0, +p.margin || 0);
    const boxW = Math.max(1, W - 2 * m), boxH = Math.max(1, H - 2 * m);
    const k = Math.min(boxW / Math.max(1e-6, x1 - x0), boxH / Math.max(1e-6, y1 - y0));
    const cx = (x0 + x1) / 2, cyy = (y0 + y1) / 2;
    const paths = proj.map((q) => ({ pts: q.s.map(([x, y]) => [W / 2 + (x - cx) * k, H / 2 + (y - cyy) * k]), closed: q.closed, layer: q.layer }));
    return applyStyle({ paths }, ins[0]);
  },
};
