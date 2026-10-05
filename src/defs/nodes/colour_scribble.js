import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
  key: "colour_scribble",
  name: "Colour Scribble",
  cat: "gen",
  group: "organic",
  desc: "Overlapping coloured bundles of pen strokes: a compact Knot, flying Burst, winding River or scattered Islands. Gesture chooses straight Hatching, bending Arcs, angular Zigzags or a Mixed drawing. Bundles controls the number of gestures; Lines per bundle changes their density without moving their centres. Stroke length and Bundle width are physical millimetres. Spread opens the composition, Size variation mixes small and large marks, and Disorder loosens their alignment. Curvature bends Arcs and Mixed strokes; Loose threads adds wandering lines between the dense patches. One to six independently chosen pens colour whole bundles, with the same geometry in mono and colour. Rotation turns the composition around Centre X/Y. Every mark is an open, unfilled plotter path clipped to Margin. Seed reproduces the drawing. Dense settings reduce curve sampling evenly to stay within the point budget. Use a fine pen to keep overlapping colours readable; SVG colours become separate pen groups, not transparency effects.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "layout", label: "Composition", type: "select", options: ["Knot", "Burst", "River", "Islands"], def: "Knot" },
    { key: "gesture", label: "Gesture", type: "select", options: ["Hatching", "Arcs", "Zigzags", "Mixed"], def: "Mixed" },
    { key: "bundles", label: "Bundles", type: "slider", min: 10, max: 300, step: 1, def: 110 },
    { key: "density", label: "Lines per bundle", type: "slider", min: 2, max: 36, step: 1, def: 13 },
    { key: "length", label: "Stroke length mm", type: "slider", min: 3, max: 100, step: 1, def: 32 },
    { key: "width", label: "Bundle width mm", type: "slider", min: 1, max: 30, step: 0.5, def: 10 },
    { key: "spread", label: "Spread", type: "slider", min: 0.1, max: 1, step: 0.05, def: 0.65 },
    { key: "variation", label: "Size variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65 },
    { key: "disorder", label: "Disorder", type: "slider", min: 0, max: 1, step: 0.05, def: 0.55 },
    { key: "curve", label: "Curvature", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45, showIf: p => p.gesture === "Arcs" || p.gesture === "Mixed" },
    { key: "threads", label: "Loose threads", type: "slider", min: 0, max: 1, step: 0.05, def: 0.2 },
    { key: "rotation", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "cx", label: "Centre X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Centre Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 41 },
    { key: "colours", label: "Colours", type: "slider", min: 1, max: 6, step: 1, def: 6 },
    { key: "layer", label: "Pen 1", type: "pen", def: 1 },
    { key: "pen2", label: "Pen 2", type: "pen", def: 7, showIf: p => p.colours >= 2 },
    { key: "pen3", label: "Pen 3", type: "pen", def: 6, showIf: p => p.colours >= 3 },
    { key: "pen4", label: "Pen 4", type: "pen", def: 4, showIf: p => p.colours >= 4 },
    { key: "pen5", label: "Pen 5", type: "pen", def: 5, showIf: p => p.colours >= 5 },
    { key: "pen6", label: "Pen 6", type: "pen", def: 10, showIf: p => p.colours >= 6 },
  ],
  _num(v, d, lo, hi) { return Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : d)); },
  _region(p, ctx) {
    const W = this._num(ctx.W, 297, 0, 10000), H = this._num(ctx.H, 420, 0, 10000);
    const m = this._num(p.margin, 10, 0, Math.min(W, H) / 2);
    return { W, H, m, x0: m, y0: m, x1: W - m, y1: H - m,
      cx: W * this._num(p.cx, 50, 0, 100) / 100, cy: H * this._num(p.cy, 50, 0, 100) / 100 };
  },
  overlay(p, ctx) {
    const r = this._region(p, ctx);
    return [{ kind: "rect", x: r.m, y: r.m, w: r.x1-r.m, h: r.y1-r.m }, { kind: "point", x: r.cx, y: r.cy }];
  },
  // Segment clipping splits strokes at the page boundary; no edge clamping
  // or artificial line joining across excursions outside the drawing area.
  _clip(pts, r) {
    const pieces = []; let cur = [];
    const flush = () => { if (cur.length > 1) pieces.push(cur); cur = []; };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i-1], b = pts[i], dx = b[0]-a[0], dy = b[1]-a[1];
      let lo = 0, hi = 1;
      const edges = [[-dx,a[0]-r.x0],[dx,r.x1-a[0]],[-dy,a[1]-r.y0],[dy,r.y1-a[1]]];
      for (const [d,q] of edges) {
        if (Math.abs(d) < 1e-12) { if (q < 0) { hi = -1; break; } }
        else if (d < 0) lo = Math.max(lo,q/d); else hi = Math.min(hi,q/d);
      }
      if (lo > hi || hi-lo < 1e-10) { flush(); continue; }
      const u = [a[0]+lo*dx,a[1]+lo*dy], v = [a[0]+hi*dx,a[1]+hi*dy];
      if (Math.hypot(v[0]-u[0],v[1]-u[1]) < 1e-8) continue;
      if (cur.length && Math.hypot(cur.at(-1)[0]-u[0],cur.at(-1)[1]-u[1]) > 1e-7) flush();
      if (!cur.length) cur.push(u); cur.push(v);
      if (hi < 1-1e-10) flush();
    }
    flush(); return pieces;
  },
  compute(ins, p, ctx) {
    const r = this._region(p, ctx), rw = r.x1-r.x0, rh = r.y1-r.y0;
    if (rw < 0.01 || rh < 0.01) return EMPTY;
    const n = Math.round(this._num(p.bundles,110,1,300)), density = Math.round(this._num(p.density,13,2,36));
    const seed = Math.round(this._num(p.seed,41,-2147483648,2147483647));
    const spread = this._num(p.spread,0.65,0.05,1.5), variation = this._num(p.variation,0.65,0,1);
    const disorder = this._num(p.disorder,0.55,0,1), curve = this._num(p.curve,0.45,0,1), threads = this._num(p.threads,0.2,0,1);
    const length = this._num(p.length,32,0.5,600), width = this._num(p.width,10,0.1,150);
    const angle = this._num(p.rotation,0,-36000,36000)*Math.PI/180, co = Math.cos(angle), si = Math.sin(angle);
    const colours = Math.round(this._num(p.colours,6,1,6));
    const palette = [p.layer,p.pen2,p.pen3,p.pen4,p.pen5,p.pen6].map((v,i)=>Math.round(this._num(v,[1,7,6,4,5,10][i],0,11)));
    const world = ([x,y]) => [r.cx+x*co-y*si,r.cy+x*si+y*co];
    const paths = [];
    // Worst-case clipping can double the number of sampled points. Budget
    // all bundles up front so dense settings still draw the whole composition.
    const maxSegments = Math.max(2, Math.min(80,Math.floor(50000/(n*(density+2)))-1));
    const add = (pts, layer) => { for (const part of this._clip(pts.map(world),r)) paths.push({pts:part,closed:false,layer}); };
    const islandsRng = mulberry32(seed+907);
    const islands = Array.from({length:9},()=>[(islandsRng()*2-1)*rw*0.43,(islandsRng()*2-1)*rh*0.43]);
    for (let i = 0; i < n; i++) {
      // Per-bundle streams make edits to density, pens and threads independent
      // of the placement of every later bundle.
      const rng = mulberry32(seed+Math.imul(i+1,104729));
      const a = rng()*Math.PI*2, rad = Math.pow(rng(),0.85);
      let x, y, direction, scale = 1;
      if (p.layout === "River") {
        const u = rng()*2-1, branch = rng()<0.23 ? 1 : -1;
        x = u*rw*0.43;
        y = rh*(0.20*Math.sin(u*2.9+0.5)+branch*0.06*Math.cos(u*5)+(rng()-0.5)*0.11);
        direction = Math.atan2(rh*(0.58*Math.cos(u*2.9+0.5)-branch*0.3*Math.sin(u*5)),rw*0.43);
      } else if (p.layout === "Islands") {
        const centre = islands[i%islands.length];
        x = centre[0]+Math.cos(a)*rad*rw*0.075; y = centre[1]+Math.sin(a)*rad*rh*0.055;
        direction = a+Math.PI/3; scale = 0.5+0.65*(0.5+0.5*Math.sin(i%9*2.7));
      } else if (p.layout === "Burst") {
        const tail = rng()<0.24, distance = tail ? 0.24+rad*0.34 : rad*0.23;
        x = Math.cos(a)*rw*distance; y = Math.sin(a)*rh*distance;
        direction = a+0.6; scale = tail ? 0.45+rad*0.3 : 1;
      } else {
        x = Math.cos(a)*rad*rw*(0.30+0.07*Math.sin(a*3));
        y = Math.sin(a)*rad*rh*(0.27+0.04*Math.cos(a*5));
        direction = a+Math.PI/2;
      }
      x *= spread; y *= spread;
      const turn = direction+(rng()-0.5)*Math.PI*2*disorder;
      const dx = Math.cos(turn), dy = Math.sin(turn), nx = -dy, ny = dx;
      scale *= 1+variation*(Math.pow(rng(),1.5)*2.8-0.8);
      const len = length*scale, wide = width*scale*(0.65+rng()*0.7);
      const bend = (rng()*2-1)*curve*len*0.65, slant = (rng()-0.5)*len*0.4;
      const kind = p.gesture === "Mixed" ? (rng()<0.65 ? "Arcs" : "Hatching") : p.gesture;
      const colourIndex = i%colours, layer = palette[colourIndex];
      const segments = kind === "Hatching" ? 1 : kind === "Zigzags" ? Math.min(6,maxSegments) : Math.min(maxSegments,Math.max(4,Math.ceil(len/0.8)));
      for (let j = 0; j < density; j++) {
        const lrng = mulberry32(seed+Math.imul(i+1,104729)+Math.imul(j+1,8191));
        const q = j/(density-1)-0.5;
        const profile = 0.65+0.35*Math.cos(q*Math.PI)+(lrng()-0.5)*disorder*0.2;
        const off = q*wide, shift = q*slant+(lrng()-0.5)*disorder*len*0.12;
        const l = len*profile, fan = q*disorder*0.22;
        const pts = [];
        for (let k = 0; k <= segments; k++) {
          const t = k/segments, along = (t-0.5)*l+shift;
          let cross = off+fan*along;
          if (kind === "Arcs") cross += bend*4*t*(1-t)*(1+q*0.3);
          if (kind === "Zigzags") cross += (k%2 ? 1 : -1)*l*0.12;
          pts.push([x+dx*along+nx*cross,y+dy*along+ny*cross]);
        }
        // Alternating direction reduces travel if the generated order is kept.
        if (j%2) pts.reverse(); add(pts,layer);
      }
      const trng = mulberry32(seed+Math.imul(i+1,65537));
      if (trng()<threads) {
        const pts = [], flight = len*(1.8+trng()*2), curl = (trng()-0.5)*flight;
        const steps = Math.max(2,Math.min(maxSegments,Math.ceil(flight/2)));
        const angular = p.layout === "Islands" || kind === "Zigzags";
        for (let k = 0; k <= steps; k++) {
          const t = k/steps, u = t*flight;
          const v = angular ? (Math.sin(t*31)*0.08+t*0.3)*curl : Math.sin(t*Math.PI/2)*curl;
          pts.push([x+dx*u+nx*v,y+dy*u+ny*v]);
        }
        add(pts,layer);
      }
    }
    return applyStyle({paths},ins[0]);
  },
};
