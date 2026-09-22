import { Pin, applyStyle, SFONT, fontStrokes } from "../helpers.js";

export default {
  /* Chronophoto — Marey-style chronophotographic analysis: an articulated
     stick figure drawn at N successive instants of a keyframed motion, near
     limbs solid / far limbs dashed, smooth dashed joint trajectories with
     instant markers and SFONT numbers, ground line. 3-D skeleton (sagittal
     angles + lateral offsets) so Side and Front views project one model.
     Optional Path pin drives the pelvis along a wired line. Layout shared via
     this._frames (engine calls compute/overlay as def methods). */
  key: "chrono",
  name: "Chronophoto",
  cat: "gen",
  group: "scientific",
  desc: "Étienne-Jules Marey's chronophotographic motion analysis as a drawing: an articulated stick figure (head, trunk, both arms and legs with feet) is drawn at Frames successive instants of a motion — Walk, Run, Long jump (approach run, take-off, hang, landing), High jump, Standing jump or Somersault — with bone lengths held exactly constant, so the figures overlap the way superimposed exposures do. Near limbs are solid and Far limbs dashed as in the originals; Frame style can dash alternate or early instants. Trajectories trace chosen joints as smooth dashed curves sampled from the motion itself, with a marker at every instant and SFONT Numbers 1…N beside them. View Side is Marey's plate; Front turns the camera round. Time window crops the motion to a phase range, Spacing scales the forward displacement (0 stacks every instant on one spot), Stride stretches the travel, Trunk lean tilts the figure. Wire a line into Path and the pelvis follows it instead — the motion supplies the poses, the wire supplies the route. Ground line draws the floor with its end dot. Animate turns the plate into an animation: Single instant draws one figure at Phase (wire the Frame clock's t into it), Onion skin adds the previous exposures as ghosts, and Trail lets the trajectories write on up to the current instant — the layout, scale and ground are computed from the whole Time window, so the figure travels across a fixed sheet frame by frame. Pens: Figure, Trajectory, Labels.",
  ins: [Pin("paths", "Path (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "motion", label: "Motion", type: "select", options: ["Long jump", "Walk", "Run", "High jump", "Standing jump", "Somersault"], def: "Long jump" },
    { key: "view", label: "View", type: "select", options: ["Side", "Front"], def: "Side" },
    { key: "frames", label: "Frames", type: "slider", min: 3, max: 16, step: 1, def: 7 },
    { key: "t0", label: "Time window start %", type: "slider", min: 0, max: 95, step: 1, def: 0 },
    { key: "t1", label: "Time window end %", type: "slider", min: 5, max: 100, step: 1, def: 100 },
    { key: "animate", label: "Animate", type: "select", options: ["Off", "Single instant", "Onion skin"], def: "Off" },
    { key: "phase", label: "Phase (wire Frame t)", type: "slider", min: 0, max: 1, step: 0.01, def: 0, showIf: (p) => p.animate !== "Off" },
    { key: "onion", label: "Onion frames", type: "slider", min: 1, max: 8, step: 1, def: 3, showIf: (p) => p.animate === "Onion skin" },
    { key: "onionStyle", label: "Onion style", type: "select", options: ["Dashed", "Solid"], def: "Dashed", showIf: (p) => p.animate === "Onion skin" },
    { key: "trail", label: "Trail", type: "select", options: ["Trajectories so far", "Full trajectories", "None"], def: "Trajectories so far", showIf: (p) => p.animate !== "Off" },
    { key: "height", label: "Height mm", type: "slider", min: 20, max: 200, step: 1, def: 70 },
    { key: "spacing", label: "Spacing %", type: "slider", min: 0, max: 200, step: 1, def: 100 },
    { key: "stride", label: "Stride %", type: "slider", min: 50, max: 150, step: 1, def: 100 },
    { key: "lean", label: "Trunk lean °", type: "slider", min: -30, max: 30, step: 1, def: 0 },
    { key: "far", label: "Far limbs", type: "select", options: ["Dashed", "Solid", "Hidden"], def: "Dashed" },
    { key: "frameStyle", label: "Frame style", type: "select", options: ["All solid", "Alternate dashed", "Fade"], def: "All solid" },
    { key: "dash", label: "Dash mm", type: "slider", min: 0.5, max: 6, step: 0.1, def: 1.6 },
    { key: "head", label: "Head", type: "select", options: ["Circle", "Dot", "None"], def: "Circle" },
    { key: "traj", label: "Trajectories", type: "select", options: ["None", "Head", "Head + hip", "Head + hip + hands + feet", "All joints"], def: "Head + hip + hands + feet" },
    { key: "markers", label: "Trajectory markers", type: "check", def: true, showIf: (p) => p.traj !== "None" },
    { key: "numbers", label: "Numbers", type: "check", def: true, showIf: (p) => p.traj !== "None" },
    { key: "numSize", label: "Number size mm", type: "slider", min: 1.5, max: 8, step: 0.1, def: 3, showIf: (p) => p.traj !== "None" && !!p.numbers },
    { key: "ground", label: "Ground line", type: "check", def: true },
    { key: "groundExt", label: "Ground extent %", type: "slider", min: 20, max: 100, step: 1, def: 90, showIf: (p) => !!p.ground },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "penFig", label: "Figure pen", type: "pen", def: 0 },
    { key: "penTraj", label: "Trajectory pen", type: "pen", def: 0 },
    { key: "penLab", label: "Label pen", type: "pen", def: 0 },
  ],

  /* ---- motion library: keyframe tables [phase, value], degrees; lift in body heights ---- */
  _motion(name) {
    const WALK = {
      cyclic: true, dist: 0.85, trunk: [[0, 3]],
      hipR: [[0, 25], [0.15, 18], [0.35, 0], [0.5, -12], [0.62, -8], [0.8, 15], [1, 25]],
      kneeR: [[0, 5], [0.12, 16], [0.3, 6], [0.45, 12], [0.6, 45], [0.72, 62], [0.85, 30], [1, 5]],
      ankR: [[0, -4], [0.12, 0], [0.4, -8], [0.55, 14], [0.68, 4], [0.85, -2], [1, -4]],
      shR: [[0, -22], [0.25, -8], [0.5, 22], [0.75, 8], [1, -22]],
      elR: [[0, 12], [0.5, 32], [1, 12]],
      lift: [[0, 0]],
    };
    const RUN = {
      cyclic: true, dist: 1.6, trunk: [[0, 8]],
      hipR: [[0, 32], [0.12, 22], [0.28, -8], [0.4, -22], [0.55, -12], [0.7, 25], [0.85, 45], [1, 32]],
      kneeR: [[0, 22], [0.1, 38], [0.25, 18], [0.38, 35], [0.5, 80], [0.62, 118], [0.75, 100], [0.88, 48], [1, 22]],
      ankR: [[0, -6], [0.15, -4], [0.3, 12], [0.4, 22], [0.55, 6], [0.75, 0], [1, -6]],
      shR: [[0, -40], [0.25, -15], [0.5, 40], [0.75, 12], [1, -40]],
      elR: [[0, 75], [0.5, 100], [1, 75]],
      lift: [[0, 0], [0.3, 0], [0.4, 0.045], [0.5, 0], [0.8, 0], [0.9, 0.045], [1, 0]],
    };
    /* non-cyclic tables give both sides explicitly */
    const LONGJ = { /* phase >= 0.45: take-off (right foot planted), hang, landing */
      cyclic: false, dist: 3.4,
      trunk: [[0.45, 8], [0.52, -6], [0.62, -4], [0.75, 6], [0.9, 35], [1, 45]],
      hipR: [[0.45, 32], [0.5, 8], [0.55, -22], [0.65, 10], [0.75, 60], [0.88, 85], [1, 70]],
      kneeR: [[0.45, 22], [0.5, 12], [0.55, 4], [0.62, 60], [0.72, 95], [0.85, 20], [1, 45]],
      ankR: [[0.45, -6], [0.52, 30], [0.6, 12], [0.75, 0], [1, -10]],
      hipL: [[0.45, -20], [0.5, 30], [0.55, 70], [0.65, 55], [0.75, 60], [0.88, 85], [1, 70]],
      kneeL: [[0.45, 70], [0.5, 90], [0.55, 95], [0.65, 40], [0.72, 95], [0.85, 20], [1, 45]],
      ankL: [[0.45, 10], [0.55, 0], [0.75, 0], [1, -10]],
      shR: [[0.45, -40], [0.52, 60], [0.6, 150], [0.75, 165], [0.88, 60], [1, 20]],
      elR: [[0.45, 75], [0.55, 40], [0.7, 15], [1, 25]],
      shL: [[0.45, 40], [0.52, 100], [0.6, 160], [0.75, 165], [0.88, 60], [1, 20]],
      elL: [[0.45, 100], [0.55, 40], [0.7, 15], [1, 25]],
      lift: [[0.45, 0], [0.5, 0], [0.62, 0.32], [0.75, 0.5], [0.88, 0.3], [1, 0]],
    };
    const HIGHJ = {
      cyclic: false, dist: 2.6,
      trunk: [[0.4, 8], [0.48, -10], [0.6, -20], [0.72, -60], [0.85, -30], [1, 15]],
      hipR: [[0.4, 32], [0.47, 5], [0.55, 60], [0.7, 30], [0.85, 20], [1, 60]],
      kneeR: [[0.4, 22], [0.47, 8], [0.55, 90], [0.7, 40], [0.85, 10], [1, 70]],
      ankR: [[0.4, -6], [0.47, 30], [0.6, 5], [1, 0]],
      hipL: [[0.4, -20], [0.47, 70], [0.55, 90], [0.7, 30], [0.85, 20], [1, 60]],
      kneeL: [[0.4, 70], [0.47, 100], [0.55, 30], [0.7, 40], [0.85, 10], [1, 70]],
      ankL: [[0.4, 10], [0.6, 0], [1, 0]],
      shR: [[0.4, -40], [0.47, 120], [0.6, 170], [0.75, 175], [0.9, 90], [1, 30]],
      elR: [[0.4, 75], [0.5, 30], [0.7, 10], [1, 30]],
      shL: [[0.4, 40], [0.47, 120], [0.6, 170], [0.75, 175], [0.9, 90], [1, 30]],
      elL: [[0.4, 100], [0.5, 30], [0.7, 10], [1, 30]],
      lift: [[0.4, 0], [0.47, 0], [0.6, 0.45], [0.72, 0.75], [0.85, 0.45], [1, 0]],
    };
    const STANDJ = {
      cyclic: false, dist: 1.4,
      trunk: [[0, 0], [0.25, 45], [0.35, 10], [0.5, -5], [0.65, 15], [0.8, 40], [1, 20]],
      hipR: [[0, 0], [0.25, 85], [0.35, 5], [0.45, -15], [0.6, 70], [0.75, 80], [0.85, 90], [1, 30]],
      kneeR: [[0, 0], [0.25, 95], [0.35, 5], [0.5, 15], [0.6, 105], [0.75, 30], [0.85, 90], [1, 25]],
      ankR: [[0, 0], [0.25, -20], [0.35, 35], [0.5, 15], [0.7, -10], [0.85, 0], [1, 0]],
      hipL: [[0, 0], [0.25, 85], [0.35, 5], [0.45, -15], [0.6, 70], [0.75, 80], [0.85, 90], [1, 30]],
      kneeL: [[0, 0], [0.25, 95], [0.35, 5], [0.5, 15], [0.6, 105], [0.75, 30], [0.85, 90], [1, 25]],
      ankL: [[0, 0], [0.25, -20], [0.35, 35], [0.5, 15], [0.7, -10], [0.85, 0], [1, 0]],
      shR: [[0, 0], [0.25, -50], [0.35, 90], [0.5, 165], [0.65, 120], [0.8, 40], [1, 10]],
      elR: [[0, 10], [0.25, 20], [0.4, 10], [1, 20]],
      shL: [[0, 0], [0.25, -50], [0.35, 90], [0.5, 165], [0.65, 120], [0.8, 40], [1, 10]],
      elL: [[0, 10], [0.25, 20], [0.4, 10], [1, 20]],
      lift: [[0, 0], [0.33, 0], [0.5, 0.28], [0.6, 0.36], [0.72, 0.28], [0.84, 0], [1, 0]],
    };
    const SOMER = {
      cyclic: false, dist: 1.6,
      trunk: [[0, 0], [0.22, 40], [0.32, 5], [0.42, 60], [0.55, 180], [0.68, 300], [0.8, 365], [0.9, 380], [1, 370]],
      hipR: [[0, 0], [0.22, 80], [0.32, 0], [0.45, 110], [0.7, 120], [0.85, 30], [1, 40]],
      kneeR: [[0, 0], [0.22, 90], [0.32, 5], [0.45, 120], [0.7, 130], [0.85, 20], [1, 40]],
      ankR: [[0, 0], [0.32, 35], [0.5, 20], [1, 0]],
      hipL: [[0, 0], [0.22, 80], [0.32, 0], [0.45, 110], [0.7, 120], [0.85, 30], [1, 40]],
      kneeL: [[0, 0], [0.22, 90], [0.32, 5], [0.45, 120], [0.7, 130], [0.85, 20], [1, 40]],
      ankL: [[0, 0], [0.32, 35], [0.5, 20], [1, 0]],
      shR: [[0, 0], [0.22, -40], [0.32, 150], [0.45, 60], [0.7, 40], [0.85, 120], [1, 20]],
      elR: [[0, 10], [0.32, 10], [0.5, 90], [0.7, 100], [0.9, 20], [1, 20]],
      shL: [[0, 0], [0.22, -40], [0.32, 150], [0.45, 60], [0.7, 40], [0.85, 120], [1, 20]],
      elL: [[0, 10], [0.32, 10], [0.5, 90], [0.7, 100], [0.9, 20], [1, 20]],
      lift: [[0, 0], [0.3, 0], [0.45, 0.45], [0.6, 0.62], [0.75, 0.45], [0.88, 0], [1, 0]],
    };
    const kf = (tab, ph, cyc) => {
      if (!tab || !tab.length) return 0;
      if (tab.length === 1) return tab[0][1];
      let t = ph;
      if (cyc) t = ((ph % 1) + 1) % 1;
      const n = tab.length;
      if (!cyc) { if (t <= tab[0][0]) return tab[0][1]; if (t >= tab[n - 1][0]) return tab[n - 1][1]; }
      let i = 0;
      while (i < n - 1 && !(t >= tab[i][0] && t <= tab[i + 1][0])) i++;
      if (i >= n - 1) return tab[n - 1][1];
      const P = (k) => {
        if (cyc) { const kk = ((k % (n - 1)) + (n - 1)) % (n - 1); return tab[kk][1]; }
        return tab[Math.max(0, Math.min(n - 1, k))][1];
      };
      const x0 = tab[i][0], x1 = tab[i + 1][0];
      const u = x1 > x0 ? (t - x0) / (x1 - x0) : 0;
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const u2 = u * u, u3 = u2 * u;
      return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
    };
    const cyclicPose = (M, ph) => ({
      trunk: kf(M.trunk, ph, true),
      hipR: kf(M.hipR, ph, true), kneeR: kf(M.kneeR, ph, true), ankR: kf(M.ankR, ph, true),
      hipL: kf(M.hipR, ph + 0.5, true), kneeL: kf(M.kneeR, ph + 0.5, true), ankL: kf(M.ankR, ph + 0.5, true),
      shR: kf(M.shR, ph, true), elR: kf(M.elR, ph, true),
      shL: kf(M.shR, ph + 0.5, true), elL: kf(M.elR, ph + 0.5, true),
      lift: kf(M.lift, ph, true),
    });
    const tablePose = (M, ph) => {
      const o = {};
      for (const k of ["trunk", "hipR", "kneeR", "ankR", "hipL", "kneeL", "ankL", "shR", "elR", "shL", "elL", "lift"]) o[k] = kf(M[k], ph, false);
      return o;
    };
    const blend = (a, b, w) => { const o = {}; for (const k in a) o[k] = a[k] * (1 - w) + b[k] * w; return o; };
    if (name === "Walk") return { dist: WALK.dist, pose: (ph) => cyclicPose(WALK, ph), stance: true };
    if (name === "Run") return { dist: RUN.dist, pose: (ph) => cyclicPose(RUN, ph), stance: false };
    if (name === "High jump") return {
      dist: HIGHJ.dist,
      pose: (ph) => { if (ph < 0.4) return cyclicPose(RUN, (ph / 0.4) * 1); const a = tablePose(HIGHJ, ph); if (ph < 0.44) return blend(cyclicPose(RUN, 1), a, (ph - 0.4) / 0.04); return a; },
    };
    if (name === "Standing jump") return { dist: STANDJ.dist, pose: (ph) => tablePose(STANDJ, ph) };
    if (name === "Somersault") return { dist: SOMER.dist, pose: (ph) => tablePose(SOMER, ph) };
    return { /* Long jump */
      dist: LONGJ.dist,
      pose: (ph) => { if (ph < 0.45) return cyclicPose(RUN, (ph / 0.45) * 2); const a = tablePose(LONGJ, ph); if (ph < 0.49) return blend(cyclicPose(RUN, 2), a, (ph - 0.45) / 0.04); return a; },
    };
  },

  /* ---- forward kinematics: body coords, x forward, y up, z lateral (right = +) ---- */
  _skeleton(pose, Hh, leanDeg) {
    const D = Math.PI / 180;
    const headR = 0.06 * Hh, neck = 0.05 * Hh, spine = 0.30 * Hh, ua = 0.17 * Hh, fa = 0.16 * Hh;
    const th = 0.245 * Hh, sh = 0.245 * Hh, ft = 0.15 * Hh, shW = 0.11 * Hh, hipW = 0.06 * Hh;
    const T = (pose.trunk + leanDeg) * D;
    const pelvis = [0, 0, 0];
    const neckJ = [spine * Math.sin(T), spine * Math.cos(T), 0];
    const headC = [neckJ[0] + (neck + headR) * Math.sin(T), neckJ[1] + (neck + headR) * Math.cos(T), 0];
    const J = { pelvis, neck: neckJ, head: headC };
    for (const s of ["R", "L"]) {
      const z = s === "R" ? 1 : -1;
      const shoulder = [neckJ[0], neckJ[1], z * shW];
      const sa = T + pose["sh" + s] * D;
      const elbow = [shoulder[0] + ua * Math.sin(sa), shoulder[1] - ua * Math.cos(sa), z * shW];
      const ea = sa + pose["el" + s] * D;
      const wrist = [elbow[0] + fa * Math.sin(ea), elbow[1] - fa * Math.cos(ea), z * shW];
      const hip = [0, 0, z * hipW];
      const ha = T + pose["hip" + s] * D;
      const knee = [hip[0] + th * Math.sin(ha), hip[1] - th * Math.cos(ha), z * hipW];
      const ka = ha - pose["knee" + s] * D;
      const ankle = [knee[0] + sh * Math.sin(ka), knee[1] - sh * Math.cos(ka), z * hipW];
      const fb = ka - pose["ank" + s] * D;
      const toe = [ankle[0] + ft * Math.cos(fb), ankle[1] + ft * Math.sin(fb), z * hipW];
      J["shoulder" + s] = shoulder; J["elbow" + s] = elbow; J["wrist" + s] = wrist;
      J["hip" + s] = hip; J["knee" + s] = knee; J["ankle" + s] = ankle; J["toe" + s] = toe;
    }
    return { J, headR };
  },

  /* ---- frames + trajectory samples in canvas coordinates ---- */
  _frames(ins, p, ctx, fitScale) {
    const W = (ctx && ctx.W) || 297, H = (ctx && ctx.H) || 210;
    const m = Math.max(0, Math.min(p.margin, Math.min(W, H) / 2 - 2));
    let Hh = Math.max(5, p.height);
    if (fitScale) Hh *= fitScale;
    const N = Math.max(2, Math.min(24, Math.round(p.frames)));
    const t0 = Math.max(0, Math.min(1, p.t0 / 100));
    let t1 = Math.max(0, Math.min(1, p.t1 / 100));
    if (t1 <= t0 + 0.01) t1 = Math.min(1, t0 + 0.01);
    const M = this._motion(p.motion);
    const front = p.view === "Front";
    const strideF = Math.max(0.1, p.stride / 100);
    const spacing = Math.max(0, p.spacing / 100);
    const src = (ins && ins[0] && ins[0].paths && ins[0].paths.length) ? ins[0].paths.find((q) => q && q.pts && q.pts.length >= 2 && q.pts.every((v) => Number.isFinite(v[0]) && Number.isFinite(v[1]))) : null;
    /* pelvis placement for a phase: body-space (x forward, y up) before layout */
    let pathPts = null, pathCum = null, pathLen = 0;
    if (src) {
      pathPts = src.closed ? [...src.pts, src.pts[0]] : src.pts;
      pathCum = [0];
      for (let i = 1; i < pathPts.length; i++) pathCum.push(pathCum[i - 1] + Math.hypot(pathPts[i][0] - pathPts[i - 1][0], pathPts[i][1] - pathPts[i - 1][1]));
      pathLen = pathCum[pathCum.length - 1];
      if (pathLen < 1e-6) { pathPts = null; }
    }
    const pathAt = (f) => {
      const s = f * pathLen;
      let i = 1;
      while (i < pathCum.length - 1 && pathCum[i] < s) i++;
      const a = pathCum[i - 1], b = pathCum[i];
      const u = b > a ? (s - a) / (b - a) : 0;
      return [pathPts[i - 1][0] + (pathPts[i][0] - pathPts[i - 1][0]) * u, pathPts[i - 1][1] + (pathPts[i][1] - pathPts[i - 1][1]) * u];
    };
    /* one instant: joints in body-mm with ground at y=0 (y up), pelvis at forward x */
    const instant = (ph) => {
      const pose = M.pose(ph);
      const sk = this._skeleton(pose, Hh, p.lean);
      let low = Infinity;
      for (const s of ["R", "L"]) { low = Math.min(low, sk.J["ankle" + s][1], sk.J["toe" + s][1]); }
      const py = -low + Math.max(0, pose.lift) * Hh;
      const px = M.dist * Hh * strideF * ph * spacing;
      return { sk, px, py, ph };
    };
    /* project a body joint to layout space (x right, y up) */
    const proj = (inst, j) => {
      const v = inst.sk.J[j];
      const x = front ? v[2] : v[0];
      return [inst.px + x, inst.py + v[1]];
    };
    const frames = [];
    for (let i = 0; i < N; i++) frames.push(instant(t0 + ((t1 - t0) * i) / (N - 1)));
    const SAMP = 160;
    const samples = [];
    for (let i = 0; i <= SAMP; i++) samples.push(instant(t0 + ((t1 - t0) * i) / SAMP));
    const JOINTS = ["head", "neck", "pelvis", "shoulderR", "elbowR", "wristR", "hipR", "kneeR", "ankleR", "toeR", "shoulderL", "elbowL", "wristL", "hipL", "kneeL", "ankleL", "toeL"];
    /* layout: body space -> canvas */
    let toC;
    let groundY = null;
    if (pathPts) {
      /* wired path: pelvis of instant i sits on the path at its phase fraction; y-down canvas */
      toC = (inst, pt) => {
        const f = (inst.ph - t0) / Math.max(1e-9, t1 - t0);
        const P = pathAt(Math.max(0, Math.min(1, f)));
        return [P[0] + (pt[0] - inst.px), P[1] - (pt[1] - inst.py)];
      };
    } else {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const fr of frames) for (const j of JOINTS) { const q = proj(fr, j); if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0]; if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1]; }
      minY = Math.min(minY, 0); maxY = Math.max(maxY, minY + 1);
      const hr = 0.06 * Hh;
      const cNum = p.traj !== "None" && p.numbers ? Math.max(1, p.numSize) + 1.5 : 0; /* label height does not scale with the figure */
      minX -= hr + 1; maxX += hr + 1; maxY += hr; minY -= hr + cNum;
      /* fit: shrink only, never grow — the sequence must stay inside the margin box.
         Constant parts (label height, 1 mm side pads) are removed before solving the scale. */
      if (!fitScale) {
        const sc = Math.min(1, (W - 2 * m - 2) / Math.max(1e-6, maxX - minX - 2), (H - 2 * m - cNum) / Math.max(1e-6, maxY - minY - cNum));
        if (sc < 0.999) return this._frames(ins, p, ctx, Math.max(0.02, sc));
      }
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const ox = W / 2 - cx, oy = H / 2 + cy;
      toC = (inst, pt) => [pt[0] + ox, oy - pt[1]];
      groundY = oy;
    }
    /* animation: layout above came from the whole plate; now pick what this frame draws */
    const anim = p.animate === "Single instant" || p.animate === "Onion skin";
    let draw = frames, ghosts = [], phaseCur = t1, drawSamples = samples, plateVisible = frames;
    if (anim) {
      const ph = Math.max(0, Math.min(1, Number.isFinite(p.phase) ? p.phase : 0));
      phaseCur = t0 + (t1 - t0) * ph;
      const cur = instant(phaseCur);
      const step = (t1 - t0) / (N - 1);
      if (p.animate === "Onion skin") {
        const K = Math.max(1, Math.min(8, Math.round(p.onion)));
        for (let k = 1; k <= K; k++) { const gp = phaseCur - k * step; if (gp < t0 - 1e-9) break; ghosts.push(instant(gp)); }
      }
      draw = [cur];
      if (p.trail === "None") { drawSamples = []; plateVisible = []; }
      else if (p.trail === "Trajectories so far") { drawSamples = samples.filter((sm) => sm.ph <= phaseCur + 1e-9); plateVisible = frames.filter((fr) => fr.ph <= phaseCur + 1e-9); }
    }
    return { W, H, m, Hh, N, frames: draw, ghosts, plate: frames, plateVisible, samples: drawSamples, anim, phaseCur, JOINTS, proj, toC, groundY, front, pathPts, headR: 0.06 * Hh };
  },

  overlay(p, ctx, ins) {
    try {
      const F = this && this._frames ? this._frames(ins, p, ctx) : null;
      if (!F) return [];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const fr of F.plate) for (const j of F.JOINTS) { const q = F.toC(fr, F.proj(fr, j)); if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0]; if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1]; }
      const g = [{ kind: "rect", x: minX, y: minY, w: maxX - minX, h: maxY - minY }];
      if (F.anim) { const c = F.toC(F.frames[0], F.proj(F.frames[0], "pelvis")); g.push({ kind: "point", x: c[0], y: c[1] }); }
      if (F.groundY != null) g.push({ kind: "poly", pts: [[F.m, F.groundY], [F.W - F.m, F.groundY]] });
      return g.every((q) => Object.values(q).every((v) => typeof v !== "number" || Number.isFinite(v))) ? g : [];
    } catch (e) { return []; }
  },

  compute(ins, p, ctx) {
    const F = this && this._frames ? this._frames(ins, p, ctx) : null;
    if (!F) return { paths: [] };
    const { frames, samples, proj, toC, N, front } = F;
    const paths = [];
    const penF = Math.round(p.penFig), penT = Math.round(p.penTraj), penL = Math.round(p.penLab);
    const dash = Math.max(0.3, p.dash), gapL = dash * 0.6;
    const dashed = (pts, pen) => {
      /* split a polyline into dashes of `dash` mm with `gapL` gaps */
      let carry = 0, on = true;
      let cur = null;
      for (let i = 0; i + 1 < pts.length; i++) {
        const A = pts[i], B = pts[i + 1];
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (L < 1e-9) continue;
        let s = 0;
        while (s < L) {
          const need = (on ? dash : gapL) - carry;
          const e = Math.min(L, s + need);
          const P0 = [A[0] + ((B[0] - A[0]) * s) / L, A[1] + ((B[1] - A[1]) * s) / L];
          const P1 = [A[0] + ((B[0] - A[0]) * e) / L, A[1] + ((B[1] - A[1]) * e) / L];
          if (on) { if (!cur) cur = [P0]; cur.push(P1); }
          if (e - s >= need - 1e-9) { if (on && cur && cur.length >= 2) { paths.push({ pts: cur, closed: false, layer: pen }); } cur = null; on = !on; carry = 0; }
          else carry += e - s;
          s = e;
        }
      }
      if (on && cur && cur.length >= 2) paths.push({ pts: cur, closed: false, layer: pen });
    };
    const seg = (fr, a, b, pen, isDashed) => {
      const A = toC(fr, proj(fr, a)), B = toC(fr, proj(fr, b));
      if (isDashed) dashed([A, B], pen); else paths.push({ pts: [A, B], closed: false, layer: pen });
    };
    const frameDashed = (i) => p.frameStyle === "Alternate dashed" ? i % 2 === 1 : p.frameStyle === "Fade" ? i < N / 2 : false;
    /* ghosts first (oldest first) so a truncation would eat them before the live figure */
    const drawList = [];
    for (let k = F.ghosts.length - 1; k >= 0; k--) drawList.push({ fr: F.ghosts[k], fd: p.onionStyle !== "Solid" });
    for (let i = 0; i < frames.length; i++) drawList.push({ fr: frames[i], fd: F.anim ? false : frameDashed(i) });
    /* far side in Side view is the left side (figure travels to the right, right side toward the camera) */
    for (let i = 0; i < drawList.length; i++) {
      const fr = drawList[i].fr;
      const fd = drawList[i].fd;
      seg(fr, "pelvis", "neck", penF, fd);
      if (p.head !== "None") {
        const C = toC(fr, proj(fr, "head"));
        const r = p.head === "Dot" ? 0.6 : F.headR;
        const ring = [];
        const n = p.head === "Dot" ? 10 : 24;
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; ring.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]); }
        paths.push({ pts: ring, closed: true, layer: penF });
        seg(fr, "neck", "head", penF, fd);
      }
      if (front) {
        seg(fr, "shoulderL", "shoulderR", penF, fd);
        seg(fr, "hipL", "hipR", penF, fd);
      }
      for (const s of ["R", "L"]) {
        const farSide = !front && s === "L";
        if (farSide && p.far === "Hidden") continue;
        const d = fd || (farSide && p.far === "Dashed");
        if (!front) seg(fr, "neck", "shoulder" + s, penF, d);
        seg(fr, "shoulder" + s, "elbow" + s, penF, d);
        seg(fr, "elbow" + s, "wrist" + s, penF, d);
        if (!front) seg(fr, "pelvis", "hip" + s, penF, d);
        seg(fr, "hip" + s, "knee" + s, penF, d);
        seg(fr, "knee" + s, "ankle" + s, penF, d);
        seg(fr, "ankle" + s, "toe" + s, penF, d);
      }
    }
    /* trajectories */
    const TRJ = {
      "None": [],
      "Head": ["head"],
      "Head + hip": ["head", "pelvis"],
      "Head + hip + hands + feet": ["head", "pelvis", "wristR", "wristL", "toeR", "toeL"],
      "All joints": F.JOINTS.filter((j) => j !== "neck" && j !== "hipR" && j !== "hipL" && j !== "shoulderR" && j !== "shoulderL"),
    };
    const joints = TRJ[p.traj] || [];
    for (const j of joints) {
      const pts = samples.map((sm) => toC(sm, proj(sm, j)));
      if (pts.length >= 2) dashed(pts, penT);
      if (p.markers) for (const fr of F.plateVisible) {
        const C = toC(fr, proj(fr, j));
        const ring = [];
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push([C[0] + Math.cos(a) * 0.45, C[1] + Math.sin(a) * 0.45]); }
        paths.push({ pts: ring, closed: true, layer: penT });
      }
      if (p.numbers) {
        const sz = Math.max(1, p.numSize);
        for (let i = 0; i < F.plateVisible.length; i++) {
          const C = toC(F.plateVisible[i], proj(F.plateVisible[i], j));
          const fs = fontStrokes(String(i + 1), sz, 1);
          const ox = C[0] - fs.width / 2, oy = C[1] - sz - 1.2;
          for (const st of fs.strokes) paths.push({ pts: st.map(([x, y]) => [x + ox, y + oy]), closed: false, layer: penL });
        }
      }
    }
    /* ground */
    if (p.ground) {
      let gy = F.groundY;
      if (gy == null) {
        gy = -Infinity;
        for (const fr of F.plate) for (const j of ["ankleR", "ankleL", "toeR", "toeL"]) gy = Math.max(gy, toC(fr, proj(fr, j))[1]);
      }
      const ext = Math.max(0.05, Math.min(1, p.groundExt / 100));
      const half = ((F.W - 2 * F.m) * ext) / 2;
      const x0 = F.W / 2 - half, x1 = F.W / 2 + half;
      paths.push({ pts: [[x0, gy], [x1, gy]], closed: false, layer: penF });
      const ring = [];
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ring.push([x1 + Math.cos(a) * 0.5, gy + Math.sin(a) * 0.5]); }
      paths.push({ pts: ring, closed: true, layer: penF });
    }
    /* clamp everything to the sheet (a long stride or a wired path can push a hand past the edge) */
    const { W, H } = F;
    for (const q of paths) q.pts = q.pts.map(([x, y]) => [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
    return applyStyle({ paths }, ins && ins[1]);
  },
};
