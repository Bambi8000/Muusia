import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
  key: "topology",
  name: "Topology",
  cat: "gen",
  group: "structural",
  desc: "Explore connected surfaces, twists and links as a plotted wire drawing and a real triangle Mesh. Mobius strip is a one-sided band with one continuous boundary; Cylinder band has two boundaries. Torus and Trefoil tube are closed surfaces, while Hopf link is two interlocked closed rings. Klein bottle is a closed one-sided immersion that crosses itself in 3D. Drawing shows all grid lines; Boundary is a separate path output and is one loop only for the Mobius strip. Wire Mesh into Mesh Render for hidden-line or shaded views. Mobius and Cylinder are open sheets; Klein crosses itself, so those three are for viewing rather than solid slicing. Torus, Trefoil and Hopf are closed meshes.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths", "Drawing"), Pin("paths", "Boundary"), Pin("mesh", "Mesh")],
  params: [
    { key: "shape", label: "Surface", type: "select", options: ["Mobius strip", "Cylinder band", "Torus", "Klein bottle", "Trefoil tube", "Hopf link"], def: "Mobius strip" },
    { key: "halfTwists", label: "Half twists", type: "slider", min: 1, max: 5, step: 2, def: 1, showIf: p => p.shape === "Mobius strip" },
    { key: "hand", label: "Twist direction", type: "select", options: ["Right", "Left"], def: "Right", showIf: p => p.shape === "Mobius strip" },
    { key: "band", label: "Band width %", type: "slider", min: 15, max: 100, step: 1, def: 85, showIf: p => p.shape === "Mobius strip" || p.shape === "Cylinder band" },
    { key: "tube", label: "Tube radius %", type: "slider", min: 5, max: 35, step: 1, def: 18, showIf: p => ["Torus", "Trefoil tube", "Hopf link"].includes(p.shape) },
    { key: "segments", label: "Around segments", type: "slider", min: 24, max: 120, step: 2, def: 72 },
    { key: "cross", label: "Across segments", type: "slider", min: 6, max: 40, step: 2, def: 16 },
    { key: "wireEvery", label: "Draw every Nth line", type: "slider", min: 1, max: 8, step: 1, def: 2 },
    { key: "size", label: "Preview size mm", type: "slider", min: 20, max: 400, step: 1, def: 160 },
    { key: "cx", label: "Centre X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Centre Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "viewAz", label: "View angle°", type: "slider", min: -180, max: 180, step: 1, def: 28 },
    { key: "viewEl", label: "View elevation°", type: "slider", min: 5, max: 85, step: 1, def: 34 },
    { key: "layer", label: "Drawing pen", type: "pen", def: 0 },
    { key: "edgeLayer", label: "Boundary pen", type: "pen", def: 1 },
  ],
  _num(v, fallback, lo, hi) {
    const n = Number(v);
    return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : fallback));
  },
  _place(p, ctx) {
    const W = this._num(ctx?.W, 210, 0, 100000), H = this._num(ctx?.H, 297, 0, 100000);
    const m = this._num(p.margin, 10, 0, Math.min(W, H) / 2);
    const size = Math.max(0, Math.min(this._num(p.size, 160, 1, 2000), W - 2*m, H - 2*m));
    const cx = this._num(W * this._num(p.cx, 50, 0, 100) / 100, W/2, m+size/2, W-m-size/2);
    const cy = this._num(H * this._num(p.cy, 50, 0, 100) / 100, H/2, m+size/2, H-m-size/2);
    return { W, H, m, size, cx, cy };
  },
  overlay(p, ctx) {
    const { size, cx, cy } = this._place(p, ctx);
    return size > 0 ? [{ kind: "rect", x: cx-size/2, y: cy-size/2, w: size, h: size }, { kind: "point", x: cx, y: cy }] : [];
  },
  compute(ins, p, ctx) {
    const pos = this._place(p, ctx);
    if (pos.size < 1) return [EMPTY, EMPTY, null];
    const shape = p.shape || "Mobius strip";
    const U = Math.round(this._num(p.segments, 72, 24, 120));
    const V = Math.round(this._num(p.cross, 16, 6, 40));
    const every = Math.round(this._num(p.wireEvery, 2, 1, 8));
    const band = this._num(p.band, 55, 15, 100) / 100;
    const tube = this._num(p.tube, 18, 5, 35) / 100;
    const twists = (p.hand === "Left" ? -1 : 1) * (2 * Math.round((this._num(p.halfTwists, 1, 1, 5) - 1) / 2) + 1);
    const raw = [], faces = [], surfaces = [], boundary = [];
    const TAU = 2 * Math.PI;
    const add = (fn, closedAcross, flipSeam) => {
      const start = raw.length, columns = closedAcross ? V : V + 1;
      const at = (i, j) => start + i * columns + j;
      for (let i = 0; i < U; i++) for (let j = 0; j < columns; j++)
        raw.push(fn(TAU * i / U, closedAcross ? TAU * j / V : 2*j/V-1));
      for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
        const seam = i === U-1, ni = (i+1) % U, j1 = closedAcross ? (j+1) % V : j+1;
        const nj = seam && flipSeam ? (closedAcross ? (V-j)%V : V-j) : j;
        const nj1 = seam && flipSeam ? (closedAcross ? (V-j1)%V : V-j1) : j1;
        const a = at(i,j), b = at(ni,nj), c = at(ni,nj1), d = at(i,j1);
        faces.push([a,b,c], [a,c,d]);
      }
      const surface = { at, closedAcross, flipSeam };
      surfaces.push(surface);
      if (!closedAcross) {
        if (flipSeam) boundary.push(Array.from({length:2*U}, (_,i) => at(i%U, i<U ? 0 : V)));
        else for (const j of [0,V]) boundary.push(Array.from({length:U}, (_,i) => at(i,j)));
      }
    };
    if (shape === "Mobius strip" || shape === "Cylinder band") {
      const mobius = shape === "Mobius strip";
      add((u,w) => {
        const angle = mobius ? twists*u/2 : 0;
        const a = 1 + w*band*0.45*Math.cos(angle);
        return [a*Math.cos(u), a*Math.sin(u), w*band*0.45*Math.sin(angle)];
      }, false, mobius);
    } else if (shape === "Torus" || shape === "Hopf link") {
      add((u,v) => [(1+tube*Math.cos(v))*Math.cos(u), (1+tube*Math.cos(v))*Math.sin(u), tube*Math.sin(v)], true, false);
      if (shape === "Hopf link") add((u,v) => [1+(1+tube*Math.cos(v))*Math.cos(u), tube*Math.sin(v), (1+tube*Math.cos(v))*Math.sin(u)], true, false);
    } else if (shape === "Klein bottle") {
      add((u,v) => {
        const a = 1.6 + 0.55*(Math.cos(u/2)*Math.sin(v)-Math.sin(u/2)*Math.sin(2*v));
        return [a*Math.cos(u), a*Math.sin(u), 0.55*(Math.sin(u/2)*Math.sin(v)+Math.cos(u/2)*Math.sin(2*v))];
      }, true, true);
    } else if (shape === "Trefoil tube") {
      add((u,v) => {
        const x = Math.sin(u)+2*Math.sin(2*u), y = Math.cos(u)-2*Math.cos(2*u), z = -Math.sin(3*u);
        const dx = Math.cos(u)+4*Math.cos(2*u), dy = -Math.sin(u)+4*Math.sin(2*u), dz = -3*Math.cos(3*u);
        const dl = Math.hypot(dx,dy,dz), hl = Math.hypot(dx,dy);
        const nx = -dy/hl, ny = dx/hl;
        const bx = -dz*ny/dl, by = dz*nx/dl, bz = hl/dl;
        const r = tube * 2;
        return [x+r*(Math.cos(v)*nx+Math.sin(v)*bx), y+r*(Math.cos(v)*ny+Math.sin(v)*by), z+r*Math.sin(v)*bz];
      }, true, false);
    } else return [EMPTY, EMPTY, null];
    let lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
    for (const q of raw) for (let k=0;k<3;k++) { lo[k]=Math.min(lo[k],q[k]); hi[k]=Math.max(hi[k],q[k]); }
    const dim=Math.max(...hi.map((v,k)=>v-lo[k]));
    if (!(dim>0) || !Number.isFinite(dim)) return [EMPTY, EMPTY, null];
    const mid=hi.map((v,k)=>(v+lo[k])/2), norm=raw.map(q=>q.map((v,k)=>(v-mid[k])/dim));
    const rnd4=x=>Math.round(x*10000)/10000;
    const meshV=[];
    for (const f of faces) for (const id of f) for (const v of norm[id]) meshV.push(rnd4(v));
    const mesh={kind:"mesh",tri:faces.length,v:meshV,dims:hi.map((v,k)=>rnd4((v-lo[k])/dim))};
    const az=this._num(p.viewAz,28,-180,180)*Math.PI/180, el=this._num(p.viewEl,34,5,85)*Math.PI/180;
    const ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
    const radius=Math.max(...norm.map(q=>Math.hypot(...q)));
    const scale=pos.size/(2*radius);
    const project=id=>{
      const [x,y,z]=norm[id], X=x*ca-y*sa, Y=x*sa+y*ca;
      return [pos.cx+X*scale,pos.cy+(Y*se-z*ce)*scale];
    };
    const layer=Math.round(this._num(p.layer,0,0,11)), edgeLayer=Math.round(this._num(p.edgeLayer,1,0,11));
    const lines=[];
    for (const s of surfaces) {
      for (let i=0;i<U;i+=every) {
        const pts=Array.from({length:s.closedAcross?V:V+1},(_,j)=>project(s.at(i,j)));
        lines.push({pts,closed:s.closedAcross,layer});
      }
      for (let j=0;j<(s.closedAcross?V:V+1);j+=every) {
        if (!s.closedAcross && (j===0 || j===V)) continue;
        if (s.flipSeam && j>V/2) continue;
        const first=Array.from({length:U},(_,i)=>s.at(i,j));
        const paired=s.flipSeam && j!==V/2 && (!s.closedAcross || j!==0);
        const ids=paired ? first.concat(Array.from({length:U},(_,i)=>s.at(i,s.closedAcross?(V-j)%V:V-j))) : first;
        lines.push({pts:ids.map(project),closed:true,layer});
      }
    }
    const edges=boundary.map(ids=>({pts:ids.map(project),closed:true,layer:edgeLayer}));
    return [applyStyle({paths:lines.concat(edges)},ins[0]),applyStyle({paths:edges},ins[0]),mesh];
  },
};
