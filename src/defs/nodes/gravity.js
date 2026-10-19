import { Pin, EMPTY, mulberry32, hash2, noise2, applyStyle } from "../helpers.js";

export default {
  /* Gravity - a regular grid of stamps lets go from the bottom up.

     Every grid element carries a release score: its row position plus a
     noise2 clump field plus a hashed softness term. Elements over the release
     line fall with a hashed fall fraction f (Progress skews it), and along
     the fall Drift (noise2), Spin (hashed direction) and Size mod ramp with f.
     Landed elements are dropped into a 1-D height field in seeded order and
     roll to the lower neighbour column like sand, which builds the heap;
     Pile spread pulls landing points toward the middle for a central mound.

     Stamps are the built-in shapes or the wired Stamp paths, normalised to a
     unit box and scaled to Stamp size x cell. Colours follow the element
     from the grid into the heap (Assign by diagonal / row / column / hash).
     All randomness is hash2 / noise2 with the seed; the layout is stable
     under every parameter that does not touch the fall. */
  key: "gravity",
  name: "Gravity",
  cat: "gen",
  group: "geometric",
  desc: "Rigid bodies treats each input path as an independent convex envelope, or repeats the whole input as one motif. It simulates translation, rotation, contact impulses, bounce and friction in a walled tray. Concave shapes use conservative convex envelopes (at most twelve supporting directions), and holes are not combined across paths; thin paths use an envelope width. Maximum 64 bodies / 118k source points. Motif copies shrink to fit their initial grid. Unwired mode provides 20 boxes. Timeline reconstructs a deterministic fixed-step prefix; the loop restarts rather than cycling seamlessly. Output clips to the tray; extreme initial overlaps or oversized bodies may remain unresolved. Falling grid keeps the original behaviour: a regular grid of stamps lets go from the bottom up: rows below the Release line detach, fall, and pile into a heap on the floor of the margin box while the top of the grid stays intact. Stamp is a Dot, Ring, Square, Diamond or Cross, or the wired Stamp paths normalised and repeated in every cell (Stamp size × cell). Release sets how much of the sheet has let go, Softness blurs the line, Clumps adds a noise field that frees clusters higher up. Progress is the share of released elements that have already landed; the rest hang mid-fall, most of them just below the line, and along the fall Drift moves it sideways with noise, Spin rotates it, Size mod shrinks or grows it; Spin / size apply to chooses whether those two ramp with the fall (Fallen only) or every element, intact ones included, carries its own hashed spin and size (All); Grid jitter shakes the intact elements near the line. Pile Heap stacks landed elements into a height field that rolls like sand (Pile spread pulls landings toward the middle, Packing sets stacking density), Floor lays them on the floor line, None drops them off the sheet. Palette 1 to 4 pens assigned by Diagonal (the i + j pattern of the classic print), Rows, Columns or Random; the colour travels with the element. Seed moves only the released elements and the jitter.",
  ins: [Pin("paths", "Stamp / bodies (optional)"), Pin("style", "Style")],
  outs: [Pin("paths")],
  params: [
    {key:'physicsMode',label:'Mode',type:'select',options:['Falling grid','Rigid bodies'],def:'Falling grid'},
    {key:'bodyPen',label:'Fallback pen',type:'pen',def:0,showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'bodySource',label:'Bodies',type:'select',options:['Input paths','Motif copies'],def:'Input paths',showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'bodyCount',label:'Motif copies',type:'slider',min:1,max:64,step:1,def:20,showIf:p=>p.physicsMode==='Rigid bodies'&&p.bodySource==='Motif copies'},
    {key:'bodySize',label:'Copy size mm',type:'slider',min:2,max:100,step:1,def:20,showIf:p=>p.physicsMode==='Rigid bodies'&&p.bodySource==='Motif copies'},
    {key:'bodyScale',label:'Input size %',type:'slider',min:5,max:200,step:1,def:100,showIf:p=>p.physicsMode==='Rigid bodies'&&p.bodySource!=='Motif copies'},
    {key:'collisionWidth',label:'Thin body width mm',type:'slider',min:.2,max:10,step:.2,def:1,showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'bodyMotion',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual',showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'time',label:'Time seconds',type:'slider',min:0,max:8,step:.1,def:5,showIf:p=>p.physicsMode==='Rigid bodies'&&p.bodyMotion!=='Timeline'},
    {key:'duration',label:'Duration seconds',type:'slider',min:.1,max:8,step:.1,def:5,showIf:p=>p.physicsMode==='Rigid bodies'&&p.bodyMotion==='Timeline'},
    {key:'bodyGravity',label:'Gravity mm/s²',type:'slider',min:0,max:1500,step:10,def:450,showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'bodySpin',label:'Initial spin °/s',type:'slider',min:0,max:360,step:5,def:40,showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'bounce',label:'Bounce %',type:'slider',min:0,max:90,step:1,def:15,showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'friction',label:'Friction %',type:'slider',min:0,max:100,step:1,def:50,showIf:p=>p.physicsMode==='Rigid bodies'},
    {key:'floor',label:'Floor %',type:'slider',min:30,max:100,step:1,def:100,showIf:p=>p.physicsMode==='Rigid bodies'},
    { key: "cols", label: "Cols", type: "slider", min: 2, max: 80, step: 1, def: 24, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "rows", label: "Rows", type: "slider", min: 2, max: 80, step: 1, def: 16, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "stamp", label: "Stamp", type: "select", options: ["Dot", "Ring", "Square", "Diamond", "Cross"], def: "Dot", showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "stampSize", label: "Stamp size", type: "slider", min: 0.1, max: 1, step: 0.01, def: 0.5, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "release", label: "Release", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "softness", label: "Softness", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "clumps", label: "Clumps", type: "slider", min: 0, max: 1, step: 0.01, def: 0.35, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "progress", label: "Progress (landed share)", type: "slider", min: 0, max: 1, step: 0.01, def: 0.55, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "drift", label: "Drift mm", type: "slider", min: 0, max: 60, step: 0.5, def: 8, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "spin", label: "Spin deg", type: "slider", min: 0, max: 720, step: 5, def: 0, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "sizeMod", label: "Size mod", type: "slider", min: -1, max: 1, step: 0.05, def: 0, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "modulate", label: "Spin / size apply to", type: "select", options: ["Fallen only", "All"], def: "Fallen only", showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "gridJitter", label: "Grid jitter", type: "slider", min: 0, max: 1, step: 0.05, def: 0.15, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "pile", label: "Pile", type: "select", options: ["Heap", "Floor", "None"], def: "Heap", showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "spread", label: "Pile spread", type: "slider", min: 0.05, max: 1, step: 0.05, def: 0.6, showIf: (p) => (!p.physicsMode||p.physicsMode==='Falling grid')&&(p.pile === "Heap") },
    { key: "packing", label: "Packing", type: "slider", min: 0.5, max: 1.5, step: 0.05, def: 0.9, showIf: (p) => (!p.physicsMode||p.physicsMode==='Falling grid')&&(p.pile === "Heap") },
    { key: "palette", label: "Palette", type: "slider", min: 1, max: 4, step: 1, def: 4, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "assign", label: "Assign", type: "select", options: ["Diagonal", "Rows", "Columns", "Random"], def: "Diagonal", showIf: (p) => (!p.physicsMode||p.physicsMode==='Falling grid')&&(p.palette > 1) },
    { key: "penA", label: "Pen A", type: "pen", def: 1, showIf:p=>!p.physicsMode||p.physicsMode==='Falling grid' },
    { key: "penB", label: "Pen B", type: "pen", def: 2, showIf: (p) => (!p.physicsMode||p.physicsMode==='Falling grid')&&(p.palette > 1) },
    { key: "penC", label: "Pen C", type: "pen", def: 11, showIf: (p) => (!p.physicsMode||p.physicsMode==='Falling grid')&&(p.palette > 2) },
    { key: "penD", label: "Pen D", type: "pen", def: 10, showIf: (p) => (!p.physicsMode||p.physicsMode==='Falling grid')&&(p.palette > 3) },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 7 },
  ],

  /* grid frame shared with the overlay */
  _frame(p, ctx) {
    const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
    const m = Math.max(0, Math.min(Number(p.margin) || 0, Math.min(W, H) / 2 - 1));
    const bw = Math.max(1, W - 2 * m), bh = Math.max(1, H - 2 * m);
    const cols = Math.max(1, Math.round(Number(p.cols) || 1)), rows = Math.max(1, Math.round(Number(p.rows) || 1));
    const cell = Math.min(bw / cols, bh / rows);
    const gx = m + (bw - cols * cell) / 2, gy = m;      /* grid hangs from the top of the box, centred */
    return { W, H, m, bw, bh, cols, rows, cell, gx, gy, floor: m + bh };
  },

  /* the element layout: returns elements [{i, j, x, y, r, ang, pen, state}] */
  _layout(p, ctx, ins) {
    const F = this._frame(p, ctx);
    const { m, bw, cols, rows, cell, gx, gy, floor } = F;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const seed = Math.round(Number(p.seed) || 0);
    const release = clamp(Number(p.release) || 0, 0, 1), soft = clamp(Number(p.softness) || 0, 0, 1), clumps = clamp(Number(p.clumps) || 0, 0, 1);
    const progress = clamp(Number(p.progress) || 0, 0, 1);
    const drift = Math.max(0, Number(p.drift) || 0), spin = Math.max(0, Number(p.spin) || 0), sizeMod = clamp(Number(p.sizeMod) || 0, -1, 1);
    const gj = clamp(Number(p.gridJitter) || 0, 0, 1);
    const spread = clamp(Number(p.spread) || 0.6, 0.02, 1), packing = clamp(Number(p.packing) || 0.9, 0.2, 3);
    const r0 = Math.max(0.05, cell * clamp(Number(p.stampSize) || 0.5, 0.02, 1) / 2);
    const nPal = clamp(Math.round(Number(p.palette) || 1), 1, 4);
    const pens = [p.penA, p.penB, p.penC, p.penD].slice(0, nPal).map((v) => clamp(Math.round(Number(v) || 0), 0, 11));
    const penOf = (i, j) => {
      if (nPal === 1) return pens[0];
      const k = p.assign === "Rows" ? j : p.assign === "Columns" ? i : p.assign === "Random" ? Math.floor(hash2(i, j, seed + 9) * nPal) : i + j;
      return pens[((k % nPal) + nPal) % nPal];
    };
    const edge = 1 - release;
    const els = [];
    const landed = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x0 = gx + (i + 0.5) * cell, y0 = gy + (j + 0.5) * cell;
      const yN = (j + 0.5) / rows;
      const score = yN + clumps * 0.6 * (noise2(i * 0.35 + 0.5, j * 0.35 + 0.5, seed + 1) - 0.5) + soft * 0.5 * (hash2(i, j, seed + 2) - 0.5);
      const rel = release > 0 && score > edge;
      const e = { i, j, x: x0, y: y0, r: r0, ang: 0, pen: penOf(i, j), state: "grid" };
      /* All: every element carries its own hashed spin and size, intact ones
         included; Fallen only: both ramp with the fall fraction */
      const all = p.modulate === "All";
      const spinDir = (hash2(i, j, seed + 7) - 0.5) * 2;
      const sizeAmt = hash2(i, j, seed + 11);
      if (all) { e.ang = (spin * Math.PI / 180) * spinDir; e.r = r0 * clamp(1 + sizeMod * sizeAmt, 0.05, 3); }
      if (!rel) {
        /* intact: small shake that grows toward the release line */
        if (gj > 0 && release > 0) {
          const w = clamp(1 - (edge - score) / 0.3, 0, 1);
          e.x += (hash2(i, j, seed + 5) - 0.5) * cell * 0.5 * gj * w;
          e.y += (hash2(i, j, seed + 6) - 0.5) * cell * 0.5 * gj * w;
        }
        els.push(e); continue;
      }
      /* Progress = share of released elements that have landed; the rest hang
         with a fall fraction skewed toward "just let go" */
      const h = hash2(i, j, seed + 3);
      const f = h < progress ? 1 : Math.pow((h - progress) / Math.max(1e-9, 1 - progress), 2.2);
      e.f = f;
      if (!all) { e.r = r0 * clamp(1 + sizeMod * f, 0.05, 3); e.ang = (spin * Math.PI / 180) * f * spinDir; }
      const dx = drift * f * (noise2(i * 0.21 + f * 2.7, j * 0.21, seed + 4) - 0.5) * 2;
      if (f >= 1) { e.state = "landed"; e.x = x0 + dx; landed.push(e); continue; }
      e.state = "falling";
      e.x = x0 + dx;
      e.y = y0 + f * (floor - e.r - y0);
      els.push(e);
    }
    /* ---- landing ---- */
    if (p.pile === "Floor") {
      for (const e of landed) { e.y = floor - e.r; e.x = clamp(e.x, m + e.r, m + bw - e.r); els.push(e); }
    } else if (p.pile === "Heap" && landed.length) {
      /* seeded landing order, then a 1-D sandpile */
      landed.sort((a, b) => hash2(a.i, a.j, seed + 8) - hash2(b.i, b.j, seed + 8));
      const colW = Math.max(0.5, 2 * r0 * 0.9);
      const nCol = Math.max(1, Math.round(bw / colW));
      const cw = bw / nCol;
      const hgt = new Float64Array(nCol);
      const xc = m + bw / 2;
      for (const e of landed) {
        let x = xc + (e.x - xc) * spread;
        let k = clamp(Math.floor((x - m) / cw), 0, nCol - 1);
        /* roll downhill while a neighbour column is at least one diameter lower */
        for (let step = 0; step < nCol; step++) {
          const dl = k > 0 ? hgt[k] - hgt[k - 1] : -Infinity, dr = k < nCol - 1 ? hgt[k] - hgt[k + 1] : -Infinity;
          const th = 2 * e.r * packing * 0.9;
          if (dl < th && dr < th) break;
          if (dl > dr || (dl === dr && hash2(e.i, e.j, seed + step + 20) < 0.5)) k--; else k++;
        }
        e.x = m + (k + 0.5) * cw + (hash2(e.i, e.j, seed + 10) - 0.5) * cw * 0.3;
        e.y = floor - hgt[k] - e.r;
        hgt[k] += 2 * e.r * packing;
        els.push(e);
      }
    }
    /* Pile None: landed elements fall off the sheet */
    return { F, els, r0, landedCount: landed.length };
  },

  _rigid(ins,p,c){
    const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),rng=mulberry32(Math.round(n('seed',7,-2e9,2e9))),m=n('margin',12,0,Math.min(c.W,c.H)/2),W=c.W-2*m,H=c.H-2*m,floor=m+H*n('floor',100,30,100)/100,src=ins[0]||EMPTY,all=src.paths||[];if(!(W>0&&H>0)||all.reduce((n,q)=>n+q.pts.length,0)>118000)return EMPTY;
    const motif=p.bodySource==='Motif copies',count=all.length&&!motif?all.length:motif?Math.round(n('bodyCount',20,1,64)):20;if(count>64)return EMPTY;const groups=all.length?(motif?Array.from({length:count},()=>all):all.map(q=>[q])):Array.from({length:count},()=>[{pts:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],closed:true,layer:Math.round(n('bodyPen',0,0,11))}]);
    if(groups.reduce((n,g)=>n+g.reduce((s,q)=>s+q.pts.length,0),0)>118000)return EMPTY;
    const cross=(a,b,d)=>(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]),hull=pts=>{const sorted=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),chain=xs=>{const q=[];for(const a of xs){while(q.length>1&&cross(q.at(-2),q.at(-1),a)<=0)q.pop();q.push(a);}return q;};return [...chain(sorted).slice(0,-1),...chain([...sorted].reverse()).slice(0,-1)];},bodies=[];
    const cols=Math.max(1,Math.ceil(Math.sqrt(count*W/Math.max(1,H*.45)))),rows=Math.ceil(count/cols);
    for(let i=0;i<groups.length;i++){const paths=groups[i],pts=paths.flatMap(q=>q.pts);if(!pts.length||pts.some(q=>!Number.isFinite(q[0]+q[1])))return EMPTY;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y]of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}const cx=(x0+x1)/2,cy=(y0+y1)/2,span=Math.max(.01,x1-x0,y1-y0),copies=motif||!all.length,size=Math.min((motif?n('bodySize',20,2,100):20*n('bodyScale',100,5,200)/100),W/cols*.7,H*.45/rows*.7),scale=copies?size/span:n('bodyScale',100,5,200)/100,local=paths.map(q=>({...q,pts:q.pts.map(([x,y])=>[(x-cx)*scale,(y-cy)*scale])}));let hp=hull(local.flatMap(q=>q.pts));const width=n('collisionWidth',1,.2,10);if(hp.length<3){const a=(x1-x0)*scale/2+width/2,b=(y1-y0)*scale/2+width/2;hp=[[-a,-b],[a,-b],[a,b],[-a,b]];}else if(hp.length>12){
        const original=hp,rr=Math.max(...hp.map(q=>Math.hypot(...q)))*2+1;hp=[[-rr,-rr],[rr,-rr],[rr,rr],[-rr,rr]];
        for(let side=0;side<12;side++){const a=side*Math.PI/6,nx=Math.cos(a),ny=Math.sin(a),limit=Math.max(...original.map(q=>q[0]*nx+q[1]*ny)),out=[];for(let z=0;z<hp.length;z++){const A=hp[z],B=hp[(z+1)%hp.length],da=A[0]*nx+A[1]*ny-limit,db=B[0]*nx+B[1]*ny-limit;if(da<=1e-9)out.push(A);if((da<0)!==(db<0)){const t=da/(da-db);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}}hp=out;}
      }
      let area=0;for(let k=0;k<hp.length;k++)area+=hp[k][0]*hp[(k+1)%hp.length][1]-hp[k][1]*hp[(k+1)%hp.length][0];area=Math.max(1,Math.abs(area)/2);const dx=Math.max(width,(x1-x0)*scale),dy=Math.max(width,(y1-y0)*scale),mass=area/100;
      bodies.push({x:copies?m+(i%cols+.5)*W/cols:cx,y:copies?m+(Math.floor(i/cols)+.5)*H*.45/rows:cy,a:copies?(rng()-.5)*.8:0,vx:(rng()-.5)*12,vy:0,omega:(rng()-.5)*2*n('bodySpin',40,0,360)*Math.PI/180,im:1/mass,ii:12/(mass*(dx*dx+dy*dy)),hp,paths:local});
    }
    const vertices=b=>{const co=Math.cos(b.a),si=Math.sin(b.a);return b.hp.map(q=>[b.x+q[0]*co-q[1]*si,b.y+q[0]*si+q[1]*co]);},bbox=q=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y]of q){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return [x0,y0,x1,y1];},sat=(a,b,A,B)=>{let depth=Infinity,normal=null;for(const ps of [A,B])for(let i=0;i<ps.length;i++){const d=[ps[(i+1)%ps.length][0]-ps[i][0],ps[(i+1)%ps.length][1]-ps[i][1]],L=Math.hypot(...d);if(L<1e-9)continue;const nx=-d[1]/L,ny=d[0]/L;let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const q of A){const v=q[0]*nx+q[1]*ny;amin=Math.min(amin,v);amax=Math.max(amax,v);}for(const q of B){const v=q[0]*nx+q[1]*ny;bmin=Math.min(bmin,v);bmax=Math.max(bmax,v);}const over=Math.min(amax,bmax)-Math.max(amin,bmin);if(over<=0)return null;if(over<depth){depth=over;const sign=(b.x-a.x)*nx+(b.y-a.y)*ny>=0?1:-1;normal=[nx*sign,ny*sign];}}return normal?{depth,normal}:null;};
    const support=(ps,n,max)=>{let extreme=max?-Infinity:Infinity;for(const q of ps){const d=q[0]*n[0]+q[1]*n[1];extreme=max?Math.max(extreme,d):Math.min(extreme,d);}const qs=ps.filter(q=>Math.abs(q[0]*n[0]+q[1]*n[1]-extreme)<1e-5);return qs.reduce((s,q)=>[s[0]+q[0]/qs.length,s[1]+q[1]/qs.length],[0,0]);},e=n('bounce',15,0,90)/100,fr=n('friction',50,0,100)/100;
    const impulse=(a,b,normal,contact)=>{const ra=[contact[0]-a.x,contact[1]-a.y],rb=b?[contact[0]-b.x,contact[1]-b.y]:[0,0],vx=(b?b.vx-b.omega*rb[1]:0)-(a.vx-a.omega*ra[1]),vy=(b?b.vy+b.omega*rb[0]:0)-(a.vy+a.omega*ra[0]),vn=vx*normal[0]+vy*normal[1];if(vn>=0)return;const cn=ra[0]*normal[1]-ra[1]*normal[0],dn=rb[0]*normal[1]-rb[1]*normal[0],den=a.im+(b?b.im:0)+cn*cn*a.ii+(b?dn*dn*b.ii:0),J=-(1+e)*vn/den;
      const apply=(nx,ny,j)=>{a.vx-=nx*j*a.im;a.vy-=ny*j*a.im;a.omega-=(ra[0]*ny-ra[1]*nx)*j*a.ii;if(b){b.vx+=nx*j*b.im;b.vy+=ny*j*b.im;b.omega+=(rb[0]*ny-rb[1]*nx)*j*b.ii;}};apply(normal[0],normal[1],J);const tangent=[-normal[1],normal[0]],ct=ra[0]*tangent[1]-ra[1]*tangent[0],dt=rb[0]*tangent[1]-rb[1]*tangent[0],jt=-(vx*tangent[0]+vy*tangent[1])/(a.im+(b?b.im:0)+ct*ct*a.ii+(b?dt*dt*b.ii:0));apply(tangent[0],tangent[1],Math.max(-fr*J,Math.min(fr*J,jt)));
    };
    const time=p.bodyMotion==='Timeline'&&c.frameCount>1?n('duration',5,.1,8)*Math.max(0,Math.min(1,c.frameIdx/(c.frameCount-1))):n('time',5,0,8),steps=Math.round(time*60),dt=1/60,g=n('bodyGravity',450,0,1500);
    for(let step=0;step<steps;step++){
      for(const b of bodies){b.vy+=g*dt;b.vx*=.998;b.vy*=.998;b.omega=Math.max(-12,Math.min(12,b.omega*.997));b.x+=b.vx*dt;b.y+=b.vy*dt;b.a+=b.omega*dt;}
      for(let iteration=0;iteration<5;iteration++){
        const polygons=bodies.map(vertices),boxes=polygons.map(bbox);
        for(let i=0;i<bodies.length;i++){const a=bodies[i],A=polygons[i],bb=boxes[i];for(const [depth,normal,max]of [[bb[3]-floor,[0,1],true],[m-bb[0],[-1,0],true],[bb[2]-(c.W-m),[1,0],true]])if(depth>0){const contact=support(A,normal,max);impulse(a,null,normal,contact);a.x-=normal[0]*depth*.9;a.y-=normal[1]*depth*.9;}
          for(let j=i+1;j<bodies.length;j++){const db=boxes[j];if(bb[0]>=db[2]||bb[2]<=db[0]||bb[1]>=db[3]||bb[3]<=db[1])continue;const b=bodies[j],B=polygons[j],hit=sat(a,b,A,B);if(!hit)continue;const n=hit.normal,pa=support(A,n,true),pb=support(B,n,false),contact=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];impulse(a,b,n,contact);const push=Math.max(0,hit.depth-.015)*.75/(a.im+b.im);a.x-=n[0]*push*a.im;a.y-=n[1]*push*a.im;b.x+=n[0]*push*b.im;b.y+=n[1]*push*b.im;}
        }
      }
    }
    for(const b of bodies){const q=bbox(vertices(b));if(q[2]-q[0]<=W)b.x+=q[0]<m?m-q[0]:q[2]>c.W-m?c.W-m-q[2]:0;if(q[3]>floor)b.y-=q[3]-floor+1e-8;}
    const clip=(A,B)=>{let lo=0,hi=1,dx=B[0]-A[0],dy=B[1]-A[1];for(const [a,b]of [[-dx,A[0]-m],[dx,c.W-m-A[0]],[-dy,A[1]-m],[dy,floor-A[1]]]){if(Math.abs(a)<1e-10){if(b<0)return null;}else{const t=b/a;if(a<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return [[A[0]+lo*dx,A[1]+lo*dy],[A[0]+hi*dx,A[1]+hi*dy]];},paths=[];
    for(const b of bodies){const co=Math.cos(b.a),si=Math.sin(b.a);for(const q of b.paths){const pts=q.pts.map(([x,y])=>[b.x+x*co-y*si,b.y+x*si+y*co]);if(pts.every(q=>q[0]>=m&&q[0]<=c.W-m&&q[1]>=m&&q[1]<=floor)){paths.push({...q,pts});continue;}let cur=[];for(let i=0;i<pts.length-(q.closed?0:1);i++){const s=clip(pts[i],pts[(i+1)%pts.length]);if(s){if(cur.length&&Math.hypot(cur.at(-1)[0]-s[0][0],cur.at(-1)[1]-s[0][1])<1e-6)cur.push(s[1]);else{if(cur.length>1)paths.push({pts:cur,closed:false,layer:q.layer});cur=s;}}else{if(cur.length>1)paths.push({pts:cur,closed:false,layer:q.layer});cur=[];}}if(cur.length>1)paths.push({pts:cur,closed:false,layer:q.layer});}}
    let style=ins[1],out=applyStyle({paths},style);for(let i=0;i<10&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;i++){style={...style,dash:Math.max(.1,+style?.dash||4)*2,gap:Math.max(.1,+style?.gap||3)*2};out=applyStyle({paths},style);}return out.paths.reduce((n,q)=>n+q.pts.length,0)<=118000?out:EMPTY;
  },

  compute(ins, p, ctx) {
    if(p.physicsMode==='Rigid bodies')return this._rigid(ins,p,ctx);
    const L = this._layout(p, ctx, ins);
    const { els, F } = L;
    if (!els.length) return EMPTY;
    const BUDGET = 112000;
    /* ---- stamp geometry in a unit frame (radius 1), as [pts, closed] ---- */
    const src = (ins && ins[0]) || EMPTY;
    const wired = (src.paths || []).filter((q) => q.pts && q.pts.length >= 2);
    let stamp;
    if (wired.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of wired) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const s = 2 / Math.max(1e-6, Math.max(x1 - x0, y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      stamp = wired.map((q) => [q.pts.map(([x, y]) => [(x - cx) * s, (y - cy) * s]), !!q.closed]);
    } else {
      const circle = (rad, n) => { const o = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; o.push([Math.cos(a) * rad, Math.sin(a) * rad]); } return o; };
      /* circle segments by plotted size; budget aware */
      const rMean = els.reduce((a, e) => a + e.r, 0) / els.length;
      let n = Math.max(8, Math.min(32, Math.round((2 * Math.PI * rMean) / 0.45)));
      while (els.length * n * (p.stamp === "Ring" ? 2 : 1) > BUDGET && n > 6) n--;
      if (p.stamp === "Dot") stamp = [[circle(1, n), true]];
      else if (p.stamp === "Ring") stamp = [[circle(1, n), true], [circle(0.55, Math.max(6, Math.round(n * 0.6))), true]];
      else if (p.stamp === "Square") stamp = [[[[-1, -1], [1, -1], [1, 1], [-1, 1]], true]];
      else if (p.stamp === "Diamond") stamp = [[[[0, -1], [1, 0], [0, 1], [-1, 0]], true]];
      else stamp = [[[[-1, 0], [1, 0]], false], [[[0, -1], [0, 1]], false]];
    }
    const paths = [];
    let total = 0;
    for (const e of els) {
      const c = Math.cos(e.ang), s = Math.sin(e.ang);
      for (const [pts, closed] of stamp) {
        if (total + pts.length > BUDGET) break;
        paths.push({ pts: pts.map(([u, v]) => [e.x + (u * c - v * s) * e.r, e.y + (u * s + v * c) * e.r]), closed, layer: e.pen });
        total += pts.length;
      }
    }
    return applyStyle({ paths }, ins[1]);
  },

  overlay(p, ctx) {
    try {
      if(p.physicsMode==='Rigid bodies'){const m=Math.max(0,+p.margin||0),floor=m+(ctx.H-2*m)*Math.max(.3,Math.min(1,(+p.floor||100)/100));return [{kind:'rect',x:m,y:m,w:ctx.W-2*m,h:floor-m}];}
      const F = this && typeof this._frame === "function" ? this._frame(p, ctx) : null;
      if (!F) return [];
      return [
        { kind: "rect", x: F.m, y: F.m, w: F.bw, h: F.bh },
        { kind: "rect", x: F.gx, y: F.gy, w: F.cols * F.cell, h: F.rows * F.cell },
        { kind: "poly", pts: [[F.m, F.floor], [F.m + F.bw, F.floor]] },
      ];
    } catch (e) { return []; }
  },
};
