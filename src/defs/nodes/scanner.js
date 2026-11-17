import { Pin, mulberry32 } from "../helpers.js";

export default {
  key: "scanner", name: "Scanner", cat: "mod", group: "deform",
  desc: "Move a drawing while a virtual scanner reads it. Smooth preserves each complete input stroke; Bands cuts at scan strips and never bridges a jump. Direction sets scan travel. Motion X/Y set the displacement in mm, Speed the motion cycles per scan, Shake a repeatable irregular movement, and Zoom the changing scale. Optional Motion uses the FIRST Draw Path as a recorded gesture, scaled to Motion X/Y; an open gesture plays forwards and backwards. Phase % can be animated. The same spatial scan field affects every stroke, independent of point density. Existing pen, width and Z data survive. Output may leave the page: add Fit or Crop afterwards. This modifies vector paths; convert photos with Portrait or Image Contours first. Excessive input/detail returns empty rather than dropping later paths.",
  ins: [Pin("paths", "Drawing"), Pin("paths", "Motion")], outs: [Pin("paths")],
  params: [
    { key: "mode", label: "Mode", type: "select", options: ["Smooth", "Bands"], def: "Smooth" },
    { key: "direction", label: "Scan direction", type: "select", options: ["Left to right", "Right to left", "Top to bottom", "Bottom to top"], def: "Top to bottom" },
    { key: "motionX", label: "Motion X mm", type: "slider", min: -70, max: 70, step: .5, def: 18 },
    { key: "motionY", label: "Motion Y mm", type: "slider", min: -70, max: 70, step: .5, def: 0 },
    { key: "speed", label: "Speed", type: "slider", min: .1, max: 6, step: .1, def: 1.5 },
    { key: "shake", label: "Shake mm", type: "slider", min: 0, max: 15, step: .25, def: 2 },
    { key: "zoom", label: "Zoom change %", type: "slider", min: -50, max: 50, step: 1, def: 0 },
    { key: "band", label: "Band width mm", type: "slider", min: .5, max: 30, step: .5, def: 5, showIf: p => p.mode === "Bands" },
    { key: "phase", label: "Phase %", type: "slider", min: 0, max: 100, step: 1, def: 0 },
    { key: "seed", label: "Seed", type: "seed", def: 27 }
  ],
  overlay(p, ctx) {
    const vertical = p.direction === "Top to bottom" || p.direction === "Bottom to top";
    const reverse = p.direction === "Right to left" || p.direction === "Bottom to top";
    return [{ kind: "arrow", x1: vertical ? ctx.W / 2 : reverse ? ctx.W : 0, y1: vertical ? reverse ? ctx.H : 0 : ctx.H / 2, x2: vertical ? ctx.W / 2 : reverse ? 0 : ctx.W, y2: vertical ? reverse ? 0 : ctx.H : ctx.H / 2 }];
  },
  compute(ins, p, ctx) {
    const empty = { paths: [] }, source = ins[0]?.paths;
    if (!Array.isArray(source) || !source.length || source.length > 12000) return empty;
    const num = (x, d, a, b) => Math.max(a, Math.min(b, Number.isFinite(+x) ? +x : d));
    const { W, H } = ctx;
    if (![W, H].every(v => Number.isFinite(v) && v > 0 && v <= 1e6)) return empty;
    const vertical = p.direction === "Top to bottom" || p.direction === "Bottom to top";
    const reverse = p.direction === "Right to left" || p.direction === "Bottom to top";
    const dim = vertical ? H : W, axis = vertical ? 1 : 0;
    const mx = num(p.motionX, 18, -70, 70), my = num(p.motionY, 0, -70, 70);
    const shake = num(p.shake, 2, 0, 15), zoom = num(p.zoom, 0, -50, 50) / 100;
    const speed = num(p.speed, 1.5, .1, 6), phase = num(p.phase, 0, 0, 100) / 100;
    const band = num(p.band, 5, .5, 30), bands = p.mode === "Bands";
    let count = 0;
    for (const path of source) {
      if (!Array.isArray(path?.pts) || path.pts.length < (path.closed ? 3 : 2)) return empty;
      count += path.pts.length;
      if (count > 120000 || path.pts.some(q => !Array.isArray(q) || q.length < 2 || q.length > 3 || q.some(v => !Number.isFinite(v)) || Math.abs(q[0]) > 1e6 || Math.abs(q[1]) > 1e6)) return empty;
    }
    if (!mx && !my && !shake && !zoom) return { paths: source.map(path => ({ ...path, pts: path.pts.map(q => q.slice()) })) };
    const rawMotion = ins[1]?.paths;
    let gesture = null, distances = [], total = 0;
    if (Array.isArray(rawMotion) && rawMotion.length) {
      const path = rawMotion[0];
      if (!Array.isArray(path?.pts) || path.pts.length > 12000 || path.pts.some(q => !Array.isArray(q) || q.length < 2 || !q.slice(0, 2).every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))) return empty;
      gesture = path.pts.map(q => q.slice(0, 2));
      if (path.closed && gesture.length) gesture.push(gesture[0]);
      if (gesture.length < 2) return empty;
      distances = [0];
      for (let i = 1; i < gesture.length; i++) { total += Math.hypot(gesture[i][0] - gesture[i-1][0], gesture[i][1] - gesture[i-1][1]); distances.push(total); }
      if (!(total > 1e-8) || !Number.isFinite(total)) return empty;
      const xs = gesture.map(q => q[0]), ys = gesture.map(q => q[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
      gesture = gesture.map(q => [(q[0] - (x0 + x1) / 2) / Math.max(1e-8, (x1-x0)/2), (q[1] - (y0+y1)/2) / Math.max(1e-8, (y1-y0)/2)]);
    }
    const rng = mulberry32(Math.round(num(p.seed, 27, -2e9, 2e9)));
    const offsets = [rng()*6, rng()*6, rng()*6, rng()*6];
    const motion = time => {
      const angle = time * Math.PI * 2;
      let x = Math.sin(angle), y = Math.sin(angle * 2 + .7);
      if (gesture) {
        // Ping-pong parameterisation is continuous at both ends, even for open gestures.
        const u = (1 - Math.cos(angle)) / 2 * total;
        let lo = 0, hi = distances.length - 1;
        while (hi - lo > 1) { const mid = (lo+hi)>>1; if (distances[mid] < u) lo = mid; else hi = mid; }
        const t = Math.max(0, Math.min(1, (u-distances[lo]) / (distances[hi]-distances[lo] || 1)));
        x = gesture[lo][0] + (gesture[hi][0]-gesture[lo][0])*t;
        y = gesture[lo][1] + (gesture[hi][1]-gesture[lo][1])*t;
      }
      return [mx*x + shake*(Math.sin(angle*3+offsets[0])*.65 + Math.sin(angle*7+offsets[1])*.35), my*y + shake*(Math.sin(angle*4+offsets[2])*.65 + Math.sin(angle*9+offsets[3])*.35), 1+zoom*Math.sin(angle)];
    };
    const coordinate = q => reverse ? dim-q[axis] : q[axis];
    const transform = (q, u) => {
      const [dx,dy,scale] = motion(u/dim*speed+phase);
      return [W/2+(q[0]-W/2)*scale+dx, H/2+(q[1]-H/2)*scale+dy, ...q.slice(2)];
    };
    const interpolate = (a,b,t) => Array.from({length:Math.max(a.length,b.length)},(_,k) => (a[k]??0)+((b[k]??0)-(a[k]??0))*t);
    const step = Math.min(.7, dim/(speed*(shake ? 160 : 60)), gesture ? dim/(speed*Math.max(60, gesture.length*6)) : Infinity);
    let planned = 0;
    for (const path of source) {
      planned++;
      for (let i=0; i<path.pts.length-(path.closed?0:1); i++) {
        const a=path.pts[i], b=path.pts[(i+1)%path.pts.length];
        planned += bands ? 2+2*Math.ceil(Math.abs(coordinate(b)-coordinate(a))/band) : Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
        if (planned>120000) return empty;
      }
    }
    const paths=[];
    for (const path of source) {
      if (!bands) {
        const pts=[];
        for (let i=0; i<path.pts.length-(path.closed?0:1); i++) {
          const a=path.pts[i], b=path.pts[(i+1)%path.pts.length], n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
          for (let j=0;j<n;j++) { const q=interpolate(a,b,j/n); pts.push(transform(q,coordinate(q))); }
        }
        if (!path.closed) { const q=path.pts.at(-1); pts.push(transform(q,coordinate(q))); }
        paths.push({...path,pts});
      } else {
        const runs=[]; let run=null;
        for (let i=0;i<path.pts.length-(path.closed?0:1);i++) {
          const a=path.pts[i], b=path.pts[(i+1)%path.pts.length], ua=coordinate(a), ub=coordinate(b), cuts=[0,1];
          if (Math.abs(ub-ua)>1e-9) for (let k=Math.floor(Math.min(ua,ub)/band)+1;k*band<Math.max(ua,ub)-1e-9;k++) cuts.push((k*band-ua)/(ub-ua));
          cuts.sort((a,b)=>a-b);
          for (let j=0;j<cuts.length-1;j++) {
            const t0=cuts[j],t1=cuts[j+1], strip=Math.floor((ua+(ub-ua)*(t0+t1)/2)/band);
            const start=transform(interpolate(a,b,t0),(strip+.5)*band), end=transform(interpolate(a,b,t1),(strip+.5)*band);
            if (!run || run.strip!==strip) { run={strip,pts:[start]};runs.push(run); }
            run.pts.push(end);
          }
        }
        if (path.closed && runs.length>1 && runs[0].strip===runs.at(-1).strip) {
          runs[0].pts=[...runs.at(-1).pts.slice(0,-1),...runs[0].pts];runs.pop();
        }
        for (const r of runs) {
          const closed=!!path.closed && runs.length===1;
          if(closed)r.pts.pop();
          if(r.pts.length>=(closed?3:2))paths.push({...path,pts:r.pts,closed});
        }
      }
    }
    return {paths};
  }
};
