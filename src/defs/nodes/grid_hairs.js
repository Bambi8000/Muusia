import { Pin, EMPTY, mulberry32, noise2, applyStyle } from "../helpers.js";

export default {
  key: "grid_hairs",
  name: "Grid Hairs",
  cat: "gen",
  group: "organic",
  desc: "Small fields of pen strokes, one inside every grid cell. Cell width and Cell height set the grid in millimetres; full cells are centred inside Margin. Tufts shares a direction within each cell, Crosshatch crosses two directions, Scatter turns each stroke freely, and Flow lets neighbouring cells follow a common field. Lines per cell sets the maximum count; Density variation thins selected cells. Length is a percentage of the smaller cell dimension, shortened where necessary to stay inside the cell. Angle turns the strokes, Direction scatter loosens them, and Bend curves them. Cell gap leaves white space between groups. Draw grid adds the actual cell borders with a separate Grid pen; the dashed selected-node guides never export. Colours 1–6 assigns a pen to each cell without changing its geometry. Seed reproduces the drawing. Very fine grids are limited to 4096 cells, and dense settings reduce strokes or curve samples across the entire sheet to keep the base drawing under 110,000 points before Style.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "cellW", label: "Cell width mm", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
    { key: "cellH", label: "Cell height mm", type: "slider", min: 2, max: 60, step: 0.5, def: 10 },
    { key: "pattern", label: "Pattern", type: "select", options: ["Tufts", "Crosshatch", "Scatter", "Flow"], def: "Crosshatch" },
    { key: "count", label: "Lines per cell", type: "slider", min: 1, max: 40, step: 1, def: 9 },
    { key: "densityVar", label: "Density variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "length", label: "Length %", type: "slider", min: 10, max: 180, step: 5, def: 110 },
    { key: "lengthVar", label: "Length variation", type: "slider", min: 0, max: 1, step: 0.05, def: 0.45 },
    { key: "angle", label: "Angle °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "scatter", label: "Direction scatter °", type: "slider", min: 0, max: 90, step: 1, def: 22, showIf: p => p.pattern !== "Scatter" },
    { key: "flowScale", label: "Flow size (cells)", type: "slider", min: 1, max: 20, step: 0.5, def: 5, showIf: p => p.pattern === "Flow" },
    { key: "bend", label: "Bend", type: "slider", min: 0, max: 1, step: 0.05, def: 0 },
    { key: "gap", label: "Cell gap mm", type: "slider", min: 0, max: 10, step: 0.1, def: 0.4 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "drawGrid", label: "Draw grid", type: "check", def: false },
    { key: "gridPen", label: "Grid pen", type: "pen", def: 9, showIf: p => p.drawGrid },
    { key: "seed", label: "Seed", type: "seed", def: 28 },
    { key: "colours", label: "Colours", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "layer", label: "Pen 1", type: "pen", def: 0 },
    { key: "pen2", label: "Pen 2", type: "pen", def: 6, showIf: p => p.colours >= 2 },
    { key: "pen3", label: "Pen 3", type: "pen", def: 4, showIf: p => p.colours >= 3 },
    { key: "pen4", label: "Pen 4", type: "pen", def: 5, showIf: p => p.colours >= 4 },
    { key: "pen5", label: "Pen 5", type: "pen", def: 7, showIf: p => p.colours >= 5 },
    { key: "pen6", label: "Pen 6", type: "pen", def: 10, showIf: p => p.colours >= 6 },
  ],
  _num(v, d, lo, hi) { return Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : d)); },
  _grid(p, ctx) {
    const W = this._num(ctx.W, 297, 0, 10000), H = this._num(ctx.H, 210, 0, 10000);
    const m = this._num(p.margin, 12, 0, Math.min(W, H) / 2), aw = W - 2*m, ah = H - 2*m;
    if (aw < 0.01 || ah < 0.01) return null;
    let cw = Math.min(aw, this._num(p.cellW, 10, 0.5, 10000));
    let ch = Math.min(ah, this._num(p.cellH, 10, 0.5, 10000));
    // Preserve complete coverage at extreme wire values; never stop mid-row.
    const f = Math.max(1, Math.sqrt((aw/cw)*(ah/ch)/4096), aw/cw/256, ah/ch/256);
    cw = Math.min(aw, cw*f); ch = Math.min(ah, ch*f);
    const cols = Math.max(1, Math.floor(aw/cw + 1e-9)), rows = Math.max(1, Math.floor(ah/ch + 1e-9));
    const w = cols*cw, h = rows*ch, gap = this._num(p.gap, 0.4, 0, Math.min(cw,ch));
    return { cols, rows, cw, ch, x: (W-w)/2, y: (H-h)/2, w, h, gap };
  },
  overlay(p, ctx) {
    const g = this._grid(p, ctx); if (!g) return [];
    const guides = [{ kind: "rect", x: g.x, y: g.y, w: g.w, h: g.h }];
    // At tiny cell sizes a bounded selection of grid guides stays readable.
    const sx = Math.max(1, Math.ceil(g.cols/32)), sy = Math.max(1, Math.ceil(g.rows/32));
    for (let c = sx; c < g.cols; c += sx) guides.push({kind:"poly",pts:[[g.x+c*g.cw,g.y],[g.x+c*g.cw,g.y+g.h]]});
    for (let r = sy; r < g.rows; r += sy) guides.push({kind:"poly",pts:[[g.x,g.y+r*g.ch],[g.x+g.w,g.y+r*g.ch]]});
    return guides;
  },
  compute(ins, p, ctx) {
    const g = this._grid(p, ctx); if (!g) return EMPTY;
    const paths = [], cells = g.cols*g.rows, gridPoints = p.drawGrid ? 2*(g.cols+g.rows+2) : 0;
    const gap = g.gap/2, iw = g.cw-g.gap, ih = g.ch-g.gap;
    const seed = Math.round(this._num(p.seed,28,-2147483648,2147483647));
    const colours = Math.round(this._num(p.colours,1,1,6));
    const palette = [p.layer,p.pen2,p.pen3,p.pen4,p.pen5,p.pen6].map((v,i)=>Math.round(this._num(v,[0,6,4,5,7,10][i],0,11)));
    const bend = this._num(p.bend,0,0,1), variation = this._num(p.densityVar,0.35,0,1);
    const length = this._num(p.length,110,1,400)/100*Math.min(g.cw,g.ch), lenVar = this._num(p.lengthVar,0.45,0,1);
    const angle = this._num(p.angle,0,-36000,36000)*Math.PI/180, scatter = this._num(p.scatter,22,0,180)*Math.PI/180;
    const flowScale = this._num(p.flowScale,5,0.5,100);
    const count = Math.min(Math.round(this._num(p.count,9,1,100)), Math.floor((110000-gridPoints)/(cells*2)));
    const samples = Math.max(2, Math.min(bend ? Math.min(65,Math.ceil(length/0.75)+1) : 2, Math.floor((110000-gridPoints)/(cells*count))));
    if (iw > 0.01 && ih > 0.01) for (let r=0;r<g.rows;r++) for (let c=0;c<g.cols;c++) {
      // Independent streams per cell and per hair: adding density preserves
      // existing strokes; changing colours never consumes geometry randomness.
      const cellSeed = seed ^ Math.imul(c+1,73856093) ^ Math.imul(r+1,19349663);
      const rng = mulberry32(cellSeed), density = rng(), turn = rng()*Math.PI;
      const penPick = rng(), n = Math.max(1,Math.round(count*(1-variation*density)));
      const base = angle + (p.pattern === "Flow" ? (noise2(c/flowScale+0.37,r/flowScale+0.71,seed+91)-0.5)*Math.PI*3 : turn);
      const x0=g.x+c*g.cw+gap, y0=g.y+r*g.ch+gap, x1=x0+iw, y1=y0+ih;
      const layer=palette[Math.min(colours-1,Math.floor(penPick*colours))];
      for (let i=0;i<n;i++) {
        const hair=mulberry32(cellSeed ^ Math.imul(i+1,83492791));
        const x=x0+iw*(0.12+hair()*0.76), y=y0+ih*(0.12+hair()*0.76);
        const jitter=hair()*2-1, shortening=hair(), curve=hair()*2-1;
        let a=base+jitter*scatter;
        if (p.pattern === "Crosshatch") a+=(i%2)*Math.PI/2;
        if (p.pattern === "Scatter") a=angle+jitter*Math.PI;
        const len=length*(1-lenVar*shortening), dx=Math.cos(a), dy=Math.sin(a);
        // Clip the line through its interior centre against its own cell.
        let t0=-len/2, t1=len/2;
        for (const [q,d,lo,hi] of [[x,dx,x0,x1],[y,dy,y0,y1]]) if (Math.abs(d)>1e-12) {
          const u=(lo-q)/d,v=(hi-q)/d; t0=Math.max(t0,Math.min(u,v));t1=Math.min(t1,Math.max(u,v));
        }
        if (t1-t0<1e-6) continue;
        const ax=x+dx*t0, ay=y+dy*t0, bx=x+dx*t1, by=y+dy*t1;
        const off=bend*curve*(t1-t0)*0.6;
        const qx=Math.max(x0,Math.min(x1,(ax+bx)/2-dy*off)), qy=Math.max(y0,Math.min(y1,(ay+by)/2+dx*off));
        const pts=[];
        // A quadratic stays inside the convex hull of its in-cell controls.
        for (let k=0;k<samples;k++) {const t=k/(samples-1),u=1-t;pts.push([u*u*ax+2*u*t*qx+t*t*bx,u*u*ay+2*u*t*qy+t*t*by]);}
        paths.push({pts,closed:false,layer});
      }
    }
    if (p.drawGrid) {
      const layer=Math.round(this._num(p.gridPen,9,0,11));
      for(let c=0;c<=g.cols;c++) paths.push({pts:[[g.x+c*g.cw,g.y],[g.x+c*g.cw,g.y+g.h]],closed:false,layer});
      for(let r=0;r<=g.rows;r++) paths.push({pts:[[g.x,g.y+r*g.ch],[g.x+g.w,g.y+r*g.ch]],closed:false,layer});
    }
    return applyStyle({paths},ins[0]);
  },
};
