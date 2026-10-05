import { Pin, mulberry32, noise2, applyStyle, signedArea } from "../helpers.js";

export default {
  key: "coral",
  name: "Coral",
  cat: "gen",
  group: "nature",
  desc: "Organic coral medallions traced as continuous vector contours. Brain coral and Cells use a seeded reaction-diffusion field for winding ridges and small islands. Radial coral uses warped radial waves with a textured centre. Density sets the number of features, Growth changes their development, Ridge width expands or narrows them, and Edge texture loosens the circular rim. Contour bands draws nested pen lines, not a solid fill. One to six selectable pens can colour whole contours by radius or by contour without changing geometry. Diameter is in mm: Fit inside paper respects Margin, Exact diameter allows oversized work. A3 fits 277 mm with 10 mm margins. Seed reproduces the pattern. High Density and Growth take longer to recompute. Stylised coral, not a biological simulation.",
  ins: [Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    { key: "form", label: "Form", type: "select", options: ["Brain coral", "Radial coral", "Cells"], def: "Brain coral" },
    { key: "diameter", label: "Diameter mm", type: "slider", min: 20, max: 600, step: 1, def: 277 },
    { key: "sizing", label: "Sizing", type: "select", options: ["Fit inside paper", "Exact diameter"], def: "Fit inside paper" },
    { key: "density", label: "Density", type: "slider", min: 8, max: 32, step: 1, def: 24 },
    { key: "growth", label: "Growth", type: "slider", min: 0, max: 1, step: 0.05, def: 0.65 },
    { key: "width", label: "Ridge width", type: "slider", min: 0, max: 1, step: 0.01, def: 0.85 },
    { key: "edge", label: "Edge texture", type: "slider", min: 0, max: 1, step: 0.05, def: 0.25 },
    { key: "bands", label: "Contour bands", type: "slider", min: 1, max: 4, step: 1, def: 1 },
    { key: "colours", label: "Colours", type: "slider", min: 1, max: 6, step: 1, def: 1 },
    { key: "colouring", label: "Colour placement", type: "select", options: ["By contour", "By radius"], def: "By contour" },
    { key: "layer", label: "Main pen", type: "pen", def: 0 },
    { key: "pen2", label: "Pen 2", type: "pen", def: 6 },
    { key: "pen3", label: "Pen 3", type: "pen", def: 4 },
    { key: "pen4", label: "Pen 4", type: "pen", def: 1 },
    { key: "pen5", label: "Pen 5", type: "pen", def: 5 },
    { key: "pen6", label: "Pen 6", type: "pen", def: 10 },
    { key: "rotation", label: "Rotation °", type: "slider", min: -180, max: 180, step: 1, def: 0 },
    { key: "cx", label: "Centre X %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "cy", label: "Centre Y %", type: "slider", min: 0, max: 100, step: 1, def: 50 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 40, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 23 },
  ],
  _number(value, fallback, lo, hi) {
    return Math.max(lo, Math.min(hi, Number.isFinite(Number(value)) ? Number(value) : fallback));
  },
  _region(p, ctx) {
    const W = this._number(ctx.W, 297, 0, 100000), H = this._number(ctx.H, 210, 0, 100000);
    const margin = this._number(p.margin, 10, 0, Math.min(W, H) / 2);
    let R = this._number(p.diameter, 277, 1, 1200) / 2;
    let cx = W * this._number(p.cx, 50, 0, 100) / 100, cy = H * this._number(p.cy, 50, 0, 100) / 100;
    if (p.sizing !== "Exact diameter") {
      R = Math.min(R, Math.max(0, Math.min(W, H) / 2 - margin));
      cx = Math.max(margin + R, Math.min(W - margin - R, cx));
      cy = Math.max(margin + R, Math.min(H - margin - R, cy));
    }
    return { R, cx, cy, rotation: this._number(p.rotation, 0, -36000, 36000) * Math.PI / 180 };
  },
  overlay(p, ctx) {
    const { R, cx, cy } = this._region(p, ctx);
    return R > 0 ? [{ kind: "circle", cx, cy, r: R }, { kind: "point", x: cx, y: cy }] : [];
  },
  _field(p) {
    // Gray-Scott update: https://www.karlsims.com/rd.html. Own deterministic
    // initial condition, radial wave field and contour extraction.
    const N = Math.round(this._number(p.density, 24, 8, 32)) * 6 + 34, size = N * N;
    const seed = Math.round(this._number(p.seed, 23, -2147483648, 2147483647));
    const cacheKey=JSON.stringify([N,seed,p.form,this._number(p.growth,0.65,0,1),this._number(p.edge,0.25,0,1)]);
    // One bounded memo entry, keyed by every field dependency. Geometry remains
    // a deterministic function of inputs; pen/size edits avoid re-simulating.
    if(this._fieldMemo && this._fieldMemo.key===cacheKey)return this._fieldMemo.field;
    const rng = mulberry32(seed), cells = p.form === "Cells", radial = p.form === "Radial coral";
    let A = new Float32Array(size).fill(1), B = new Float32Array(size);
    let nextA = new Float32Array(size), nextB = new Float32Array(size);
    // Many irregularly placed colonies mature together, avoiding one big empty
    // ring while keeping seeded local variation instead of a visible square grid.
    for (let j = 0; j < Math.round(size / 65); j++) {
      const x = 3 + rng() * (N - 6), y = 3 + rng() * (N - 6), r = 0.9 + rng() * 1.4;
      for (let iy = Math.floor(y-r); iy <= Math.ceil(y+r); iy++) for (let ix = Math.floor(x-r); ix <= Math.ceil(x+r); ix++) {
        if(ix > 0 && iy > 0 && ix < N-1 && iy < N-1 && (ix-x)**2+(iy-y)**2 < r*r) { const k=iy*N+ix; A[k]=0; B[k]=0.8+rng()*0.2; }
      }
    }
    const f = cells ? 0.0367 : 0.035, kill = cells ? 0.0649 : 0.06;
    const steps = Math.round(350 + 900 * this._number(p.growth, 0.65, 0, 1));
    for(let t=0;t<(radial ? 0 : steps);t++) {
      for(let y=1;y<N-1;y++) for(let x=1;x<N-1;x++) {
        const k=y*N+x,a=A[k],b=B[k],ab=a*b*b;
        const la=-a+0.2*(A[k-1]+A[k+1])+0.2*(A[k-N]+A[k+N])+0.05*(A[k-N-1]+A[k+N+1])+0.05*(A[k-N+1]+A[k+N-1]);
        const lb=-b+0.2*(B[k-1]+B[k+1])+0.2*(B[k-N]+B[k+N])+0.05*(B[k-N-1]+B[k+N+1])+0.05*(B[k-N+1]+B[k+N-1]);
        nextA[k]=Math.max(0,Math.min(1,a+0.25*la-ab+f*(1-a)));
        nextB[k]=Math.max(0,Math.min(1,b+0.125*lb+ab-(kill+f)*b));
      }
      // Fixed reservoir boundary sits outside the output disc.
      for(let i=0;i<N;i++) { nextA[i]=nextA[(N-1)*N+i]=nextA[i*N]=nextA[i*N+N-1]=1; }
      [A,nextA]=[nextA,A]; [B,nextB]=[nextB,B];
    }
    const edge = this._number(p.edge,0.25,0,1);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++) {
      const dx=(2*x-(N-1))/(N-33),dy=(2*y-(N-1))/(N-33),r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
      if(radial) {
        const count=(N-34)/3;
        const growth=this._number(p.growth,0.65,0,1);
        const phase=a*count + (5+growth*12)*(noise2(dx*4+13,dy*4+29,seed)-0.5) + 2*Math.sin(r*12+a*3);
        const blend=Math.max(0,Math.min(1,(r-0.12)/0.25)),mix=blend*blend*(3-2*blend);
        B[y*N+x]=0.22+0.18*(mix*Math.cos(phase)+(1-mix)*(2*noise2(dx*12+5,dy*12+9,seed+17)-1));
      }
      const rim=0.98-edge*0.08*noise2(8+Math.cos(a)*8,11+Math.sin(a)*8,seed+71);
      const fade=Math.max(0,Math.min(1,(rim-r)/0.035));
      B[y*N+x]*=fade*fade*(3-2*fade);
    }
    const field={ N, span:N-33, values:B };
    this._fieldMemo={key:cacheKey,field};
    return field;
  },
  _contours(field, level) {
    const {N,values:v}=field, points=new Map(), links=new Map();
    const connect=(a,b)=>{ if(!links.has(a))links.set(a,[]); if(!links.has(b))links.set(b,[]); links.get(a).push(b); links.get(b).push(a); };
    for(let y=0;y<N-1;y++) for(let x=0;x<N-1;x++) {
      const k=y*N+x, vals=[v[k],v[k+1],v[k+N+1],v[k+N]];
      const hits=[];
      // Grid-edge ids stitch exactly. Rounded coordinate keys can join unrelated
      // nearby curves at high density or tiny paper sizes.
      const keys=[2*k,2*(k+1)+1,2*(k+N),2*k+1];
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
      for(let e=0;e<4;e++) {
        const j=(e+1)%4,a=vals[e],b=vals[j];
        if((a>level)===(b>level))continue;
        const key=keys[e],t=(level-a)/(b-a);
        if(!points.has(key))points.set(key,[corners[e][0]+t*(corners[j][0]-corners[e][0]),corners[e][1]+t*(corners[j][1]-corners[e][1])]);
        hits.push([e,key]);
      }
      if(hits.length===2)connect(hits[0][1],hits[1][1]);
      else if(hits.length===4) {
        // Bilinear asymptotic decider for saddle cells, not a fixed diagonal.
        const q=(vals[0]-level)*(vals[2]-level)-(vals[1]-level)*(vals[3]-level);
        if(q>=0){ connect(hits[0][1],hits[1][1]); connect(hits[2][1],hits[3][1]); }
        else { connect(hits[0][1],hits[3][1]); connect(hits[1][1],hits[2][1]); }
      }
    }
    const visited=new Set(), paths=[];
    for(const start of links.keys()) {
      if(visited.has(start))continue;
      const pts=[]; let cur=start,prev=-1;
      while(!visited.has(cur)) {
        visited.add(cur); pts.push(points.get(cur));
        const choices=links.get(cur),next=choices.find(k=>k!==prev);
        if(next===undefined)break;
        prev=cur;cur=next;
      }
      if(cur===start && pts.length>=5)paths.push(pts);
    }
    return paths;
  },
  compute(ins,p,ctx) {
    const {R,cx,cy,rotation}=this._region(p,ctx);
    if(R<0.5)return {paths:[]};
    const field=this._field(p), bands=Math.round(this._number(p.bands,1,1,4));
    const level=0.32-0.17*this._number(p.width,0.85,0,1);
    const colours=Math.round(this._number(p.colours,1,1,6));
    const pens=[['layer',0],['pen2',6],['pen3',4],['pen4',1],['pen5',5],['pen6',10]].map(([key,def])=>Math.round(this._number(p[key],def,0,11)));
    const paths=[],co=Math.cos(rotation),si=Math.sin(rotation);
    let budget=112000;
    for(let band=0;band<bands;band++) {
      const contours=this._contours(field,level+band*0.025);
      for(let i=0;i<contours.length;i++) {
        const raw=contours[i];
        // One corner-cutting pass rounds sampling-grid corners. Convex weights
        // keep every point inside the already bounded circular footprint.
        const smooth=[];
        for(let j=0;j<raw.length;j++) { const a=raw[j],b=raw[(j+1)%raw.length]; smooth.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],[a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]); }
        if(smooth.length>budget)continue;
        let radius=0;
        const pts=smooth.map(([x,y])=>{x=(2*x-(field.N-1))/field.span*R;y=(2*y-(field.N-1))/field.span*R;radius+=Math.hypot(x,y)/R;return [cx+x*co-y*si,cy+x*si+y*co];});
        // All loops are clockwise. They represent traced contours, with no
        // implicit solid-fill or exporter-specific winding interpretation.
        if(signedArea(pts)<0)pts.reverse();
        const colour=p.colouring==='By radius'?Math.min(colours-1,Math.floor(radius/pts.length*colours)):(i+band)%colours;
        paths.push({pts,closed:true,layer:pens[colour]});budget-=pts.length;
      }
    }
    return applyStyle({paths},ins[0]);
  },
};
