import { Pin, EMPTY, mulberry32, noise2, applyStyle, resample, pathLength } from "../helpers.js";

export default {
  key: "drape",
  name: "Drape",
  cat: "gen",
  group: "structural",
  desc: "Draped preserves the original mesh cloth laid over hidden objects. Hanging and Flag use a separate deterministic pinned mass-spring sheet: choose attachment, gravity, elasticity, damping, wind and a pull point. Cloth artwork maps the new fourth input onto the sheet; source coordinates use the whole canvas as UV. Grid, Threads and Weave are optional. Timeline reconstructs a periodic wind pose on every frame; manual Phase can be wired. This solver does not collide with the Objects/Mesh inputs or solve cloth self-collision. Hidden lines uses a two-sided depth buffer. Framing is fixed over wind phase; output clips to Margin. In Draped mode: Seeded spheres, boxes, cones or a mix sit on a table; a grid sheet is dropped over them and relaxed with Tension until it rests on the tops and sags smoothly in between, with optional Wrinkles in the folds. Wire your own objects instead: closed paths on the Objects input become flat-topped blocks with a soft edge, open paths become round ridges, and a triangle mesh on the Mesh input (Blob Mesh, or anything Mesh Slice would take) is rasterised from above into the height field — a wired input replaces the seeded objects. The result is turned in 3D with Yaw, Elevation and Perspective and drawn with true hidden-line removal, so the far side of every bump disappears behind it; Lock size scales by the sheet's rotation-invariant bounding circle so Yaw turns the drape without changing its size, and Sheet Round makes the cloth a disc whose outline does not change with Yaw at all (Square and Fit are rectangles). Styles: Wire (the grid), Weave (warp and weft break alternately at every crossing, like a woven net), Contour (height contours of the draped surface projected in 3D) and Hatch (grid lines that thicken away from Light angle, plus the silhouette). Density sets the mesh count in both directions; Size and Height scale the objects, Count how many. Shrink-only fit keeps the drawing inside the margins.",
  ins: [Pin("style", "Style"), Pin("paths", "Objects"), Pin("mesh", "Mesh"), Pin("paths", "Cloth artwork")],
  outs: [Pin("paths", "Lines")],
  params: [
    {key:'physicsMode',label:'Surface',type:'select',options:['Draped','Hanging','Flag'],def:'Draped'},
    {key:'clothDensity',label:'Cloth detail',type:'slider',min:8,max:45,step:1,def:28,showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'clothContent',label:'Cloth drawing',type:'select',options:['Grid','Threads','Artwork','Artwork + grid'],def:'Grid',showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'pin',label:'Attachment',type:'select',options:['Auto','Top edge','Top corners','Left edge'],def:'Auto',showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'weave',label:'Weave crossings',type:'check',def:false,showIf:p=>(p.physicsMode==='Hanging'||p.physicsMode==='Flag')&&p.clothContent!=='Artwork'&&p.clothContent!=='Threads'},
    {key:'clothGravity',label:'Gravity %',type:'slider',min:0,max:100,step:1,def:70,showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'elasticity',label:'Elasticity %',type:'slider',min:0,max:80,step:1,def:20,showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'damping',label:'Damping %',type:'slider',min:0,max:80,step:1,def:12,showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'wind',label:'Wind %',type:'slider',min:0,max:100,step:1,def:35,showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'motion',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual',showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'phase',label:'Wind phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'pull',label:'Pull point',type:'check',def:false,showIf:p=>p.physicsMode==='Hanging'||p.physicsMode==='Flag'},
    {key:'pullX',label:'Pull X %',type:'slider',min:0,max:100,step:1,def:65,showIf:p=>(p.physicsMode==='Hanging'||p.physicsMode==='Flag')&&p.pull},
    {key:'pullY',label:'Pull Y %',type:'slider',min:0,max:100,step:1,def:65,showIf:p=>(p.physicsMode==='Hanging'||p.physicsMode==='Flag')&&p.pull},
    {key:'pullDepth',label:'Pull depth mm',type:'slider',min:-100,max:100,step:1,def:35,showIf:p=>(p.physicsMode==='Hanging'||p.physicsMode==='Flag')&&p.pull},
    {key:'pullRadius',label:'Pull radius %',type:'slider',min:5,max:100,step:1,def:25,showIf:p=>(p.physicsMode==='Hanging'||p.physicsMode==='Flag')&&p.pull},
    { key: "style", label: "Style", type: "select", options: ["Wire", "Weave", "Contour", "Hatch"], def: "Wire", showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "sheet", label: "Sheet", type: "select", options: ["Fit", "Square", "Round"], def: "Fit", showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "shapes", label: "Objects", type: "select", options: ["Mixed", "Spheres", "Boxes", "Cones"], def: "Mixed", showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "count", label: "Count", type: "slider", min: 1, max: 12, step: 1, def: 4, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "size", label: "Object size %", type: "slider", min: 5, max: 60, step: 1, def: 28, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "height", label: "Height %", type: "slider", min: 5, max: 100, step: 1, def: 45, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "tension", label: "Tension", type: "slider", min: 0, max: 60, step: 1, def: 18, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "wrinkles", label: "Wrinkles %", type: "slider", min: 0, max: 100, step: 1, def: 15, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "density", label: "Density", type: "slider", min: 8, max: 90, step: 1, def: 36, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "yaw", label: "Yaw °", type: "slider", min: -180, max: 180, step: 1, def: 25 },
    { key: "pitch", label: "Elevation °", type: "slider", min: 8, max: 90, step: 1, def: 50 },
    { key: "persp", label: "Perspective", type: "slider", min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: "hidden", label: "Hidden lines", type: "check", def: true },
    { key: "lock", label: "Lock size", type: "check", def: true, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "light", label: "Light angle", type: "slider", min: 0, max: 360, step: 1, def: 315, showIf: (p) => (!p.physicsMode||p.physicsMode==='Draped')&&p.style === "Hatch" },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 10 },
    { key: "seed", label: "Seed", type: "seed", def: 4, showIf:p=>!p.physicsMode||p.physicsMode==='Draped' },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],

  _cloth(ins,p,c){
    const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),W=c.W,H=c.H,m=n('margin',10,0,Math.min(W,H)/2);if(W<=2*m||H<=2*m)return EMPTY;
    const nx=Math.round(n('clothDensity',28,8,45)),asp=Math.max(.4,Math.min(1.5,H/W)),ny=Math.max(8,Math.round(nx*asp)),at=(i,j)=>j*(nx+1)+i,N=(nx+1)*(ny+1),pos=Array.from({length:N},(_,k)=>[k%(nx+1)/nx-.5,0,asp/2-Math.floor(k/(nx+1))/ny*asp]),rest=pos.map(q=>q.slice()),prev=pos.map(q=>q.slice()),pinned=new Uint8Array(N),links=[];
    const pin=p.pin==='Auto'?(p.physicsMode==='Flag'?'Left edge':'Top edge'):p.pin||'Top edge';for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)pinned[at(i,j)]=pin==='Left edge'?i===0:pin==='Top corners'?j===0&&(i===0||i===nx):j===0;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)for(const [di,dj,f]of [[1,0,1],[0,1,1],[1,1,.65],[-1,1,.65],[2,0,.15],[0,2,.15]])if(i+di>=0&&i+di<=nx&&j+dj<=ny){const a=at(i,j),b=at(i+di,j+dj);links.push([a,b,Math.hypot(...rest[a].map((v,k)=>v-rest[b][k])),f]);}
    const phase=n('phase',0,-1e6,1e6)*Math.PI/180+(p.motion==='Timeline'&&c.frameCount>1?c.frameIdx/c.frameCount*Math.PI*2:0),wind=n('wind',30,0,100)/100,gravity=n('clothGravity',70,0,100)/100,drag=1-n('damping',12,0,80)/100,stiff=1-n('elasticity',20,0,80)*.0075,px=n('pullX',65,0,100)/100,py=n('pullY',65,0,100)/100,pk=at(Math.round(px*nx),Math.round(py*ny)),pull=n('pullDepth',35,-100,100)/Math.max(40,Math.min(W,H)),pullRadius=n('pullRadius',25,5,100)/100;
    for(let step=0;step<90;step++){
      for(let k=0;k<N;k++){if(pinned[k]){pos[k]=rest[k].slice();continue;}const q=pos[k],old=q.slice(),u=k%(nx+1)/nx,v=Math.floor(k/(nx+1))/ny,wave=Math.sin(phase+step*.06+u*5+v*3);for(let a=0;a<3;a++)q[a]+=(q[a]-prev[k][a])*drag;prev[k]=old;q[2]-=.00035*gravity;q[1]+=.0007*wind*(.35+wave);q[0]+=.00012*wind*Math.sin(phase+v*8+step*.04);if(p.pull)q[1]+=.0005*pull*Math.exp(-((u-px)**2+(v-py)**2)/(pullRadius*pullRadius));}
      for(let iter=0;iter<5;iter++){for(const [a,b,L,f]of links){const A=pos[a],B=pos[b],dx=B[0]-A[0],dy=B[1]-A[1],dz=B[2]-A[2],length=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-9,den=(pinned[a]?0:1)+(pinned[b]?0:1);if(!den)continue;const correction=(length-L)/length*stiff*f/den;if(!pinned[a]){A[0]+=dx*correction;A[1]+=dy*correction;A[2]+=dz*correction;}if(!pinned[b]){B[0]-=dx*correction;B[1]-=dy*correction;B[2]-=dz*correction;}}if(p.pull&&!pinned[pk])pos[pk]=[rest[pk][0],pull,rest[pk][2]];}
    }
    const az=n('yaw',25,-3600,3600)*Math.PI/180,el=n('pitch',50,1,90)*Math.PI/180,eye=[Math.sin(az)*Math.cos(el),-Math.cos(az)*Math.cos(el),Math.sin(el)],right=[Math.cos(az),Math.sin(az),0],up=[-Math.sin(az)*Math.sin(el),Math.cos(az)*Math.sin(el),Math.cos(el)],dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),persp=n('persp',.35,0,1),view=q=>{const depth=dot(q,eye),f=1/Math.max(.35,1-persp*.55*depth);return [dot(q,right)*f,-dot(q,up)*f,depth];};
    const extent=.12+wind*.2+(p.pull?Math.abs(pull):0),corners=[];for(const x of [-.6,.6])for(const y of [-extent,extent])for(const z of [-asp*.6-.12,asp*.6])corners.push(view([x,y,z]));const bx=Math.max(...corners.map(q=>Math.abs(q[0]))),by=Math.max(...corners.map(q=>Math.abs(q[1]))),scale=Math.min((W-2*m)/(2*bx),(H-2*m)/(2*by)),project=q=>{const s=view(q);return [W/2+s[0]*scale,H/2+s[1]*scale,s[2]];},screen=pos.map(project);
    const resolution=180,gw=resolution,gh=Math.max(50,Math.round(resolution*H/W)),buffer=new Float32Array(gw*gh).fill(-Infinity),raster=(A,B,D)=>{const a=[(A[0]-m)/(W-2*m)*gw,(A[1]-m)/(H-2*m)*gh,A[2]],b=[(B[0]-m)/(W-2*m)*gw,(B[1]-m)/(H-2*m)*gh,B[2]],d=[(D[0]-m)/(W-2*m)*gw,(D[1]-m)/(H-2*m)*gh,D[2]],det=(b[0]-a[0])*(d[1]-a[1])-(d[0]-a[0])*(b[1]-a[1]);if(Math.abs(det)<1e-12)return;for(let j=Math.max(0,Math.floor(Math.min(a[1],b[1],d[1])));j<=Math.min(gh-1,Math.ceil(Math.max(a[1],b[1],d[1])));j++)for(let i=Math.max(0,Math.floor(Math.min(a[0],b[0],d[0])));i<=Math.min(gw-1,Math.ceil(Math.max(a[0],b[0],d[0])));i++){const x=i+.5,y=j+.5,u=((b[0]-x)*(d[1]-y)-(d[0]-x)*(b[1]-y))/det,v=((d[0]-x)*(a[1]-y)-(a[0]-x)*(d[1]-y))/det,w=1-u-v;if(u>=0&&v>=0&&w>=0)buffer[j*gw+i]=Math.max(buffer[j*gw+i],u*a[2]+v*b[2]+w*d[2]);}};
    if(p.hidden)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=screen[at(i,j)],b=screen[at(i+1,j)],d=screen[at(i+1,j+1)],e=screen[at(i,j+1)];raster(a,b,d);raster(a,d,e);}
    const surface=(u,v)=>{u=Math.max(0,Math.min(1,u))*nx;v=Math.max(0,Math.min(1,v))*ny;const i=Math.min(nx-1,Math.floor(u)),j=Math.min(ny-1,Math.floor(v)),s=u-i,t=v-j,A=pos[at(i,j)],B=pos[at(i+1,j)],D=pos[at(i+1,j+1)],E=pos[at(i,j+1)];return project(A.map((x,k)=>x*(1-s)*(1-t)+B[k]*s*(1-t)+D[k]*s*t+E[k]*(1-s)*t));};
    const visible=q=>{if(!p.hidden)return true;const i=Math.max(0,Math.min(gw-1,Math.floor((q[0]-m)/(W-2*m)*gw))),j=Math.max(0,Math.min(gh-1,Math.floor((q[1]-m)/(H-2*m)*gh)));return q[2]>=buffer[j*gw+i]-.02-2/Math.min(nx,ny);},clip=(A,B)=>{let lo=0,hi=1;const dx=B[0]-A[0],dy=B[1]-A[1];for(const [a,b]of [[-dx,A[0]-m],[dx,W-m-A[0]],[-dy,A[1]-m],[dy,H-m-A[1]]]){if(Math.abs(a)<1e-10){if(b<0)return null;}else{const t=b/a;if(a<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return [[A[0]+lo*dx,A[1]+lo*dy],[A[0]+hi*dx,A[1]+hi*dy]];};
    const paths=[],pen=Math.round(n('layer',0,0,11)),emit=(uv,closed,layer)=>{const ps=uv.map(q=>surface(q[0],q[1]));if(ps.every(q=>visible(q)&&q[0]>=m&&q[0]<=W-m&&q[1]>=m&&q[1]<=H-m)){if(ps.length>=(closed?3:2))paths.push({pts:ps.map(q=>q.slice(0,2)),closed,layer});return;}let cur=[];for(let i=0;i<ps.length-(closed?0:1);i++){const a=ps[i],b=ps[(i+1)%ps.length],s=visible(a)&&visible(b)?clip(a,b):null;if(s){if(cur.length&&Math.hypot(cur.at(-1)[0]-s[0][0],cur.at(-1)[1]-s[0][1])<1e-6)cur.push(s[1]);else{if(cur.length>1)paths.push({pts:cur,closed:false,layer});cur=s;}}else{if(cur.length>1)paths.push({pts:cur,closed:false,layer});cur=[];}}if(cur.length>1)paths.push({pts:cur,closed:false,layer});};
    const content=p.clothContent||'Grid';if(content==='Grid'||content==='Threads'||content==='Artwork + grid'){
      for(let i=0;i<=nx;i++){if(p.weave&&content!=='Threads')for(let j=0;j<ny;j++){const a=j+(i+j)%2*.14,b=j+1-(1-(i+j)%2)*.14;emit(Array.from({length:5},(_,k)=>[i/nx,(a+(b-a)*k/4)/ny]),false,pen);}else emit(Array.from({length:ny*3+1},(_,j)=>[i/nx,j/(ny*3)]),false,pen);}
      if(content!=='Threads')for(let j=0;j<=ny;j++){if(p.weave)for(let i=0;i<nx;i++){const a=i+(1-(i+j)%2)*.14,b=i+1-(i+j)%2*.14;emit(Array.from({length:5},(_,k)=>[(a+(b-a)*k/4)/nx,j/ny]),false,pen);}else emit(Array.from({length:nx*3+1},(_,i)=>[i/(nx*3),j/ny]),false,pen);}
    }
    if(content==='Artwork'||content==='Artwork + grid'){const src=ins[3]||EMPTY,total=src.paths.reduce((v,q)=>v+q.pts.length,0);if(total>120000||src.paths.length>12000)return EMPTY;const L=src.paths.reduce((v,q)=>v+pathLength(q.pts,q.closed),0),step=Math.max(.6,L/Math.max(1,90000-src.paths.length*2));for(const q of src.paths)emit(resample(q.pts,q.closed,step).map(([x,y])=>[x/W,y/H]),q.closed,q.layer);}
    let style=ins[0],out=applyStyle({paths},style);for(let i=0;i<10&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;i++){style={...style,dash:Math.max(.1,+style?.dash||4)*1.8,gap:Math.max(.1,+style?.gap||3)*1.8};out=applyStyle({paths},style);}return out.paths.reduce((n,q)=>n+q.pts.length,0)<=118000?out:EMPTY;
  },

  compute(ins, p, ctx, node) {
    if(p.physicsMode==='Hanging'||p.physicsMode==='Flag')return this._cloth(ins,p,ctx);
    const W = ctx.W, H = ctx.H;
    const seed = Math.round(Number(p.seed) || 0);
    const pen = Math.max(0, Math.min(11, Math.round(Number(p.layer) || 0)));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const style = p.style;
    const margin = Math.max(0, Number(p.margin) || 0);
    const N = clamp(Math.round(Number(p.density) || 36), 6, 120);
    const count = clamp(Math.round(Number(p.count) || 1), 1, 30);
    const sizeF = clamp(Number(p.size) || 28, 1, 100) / 100;
    const heightF = clamp(Number(p.height) || 45, 1, 200) / 100;
    const tension = clamp(Math.round(Number(p.tension) || 0), 0, 200);
    const wrinkles = clamp(Number(p.wrinkles) || 0, 0, 100) / 100;
    const yaw = (Number(p.yaw) || 0) * Math.PI / 180;
    const elev = clamp(Number(p.pitch) || 50, 1, 90) * Math.PI / 180;
    const persp = clamp(Number(p.persp) || 0, 0, 1);
    const hidden = !!p.hidden;
    const BUDGET = 112000;
    const rng = mulberry32(seed * 7919 + 21);

    /* ------------------------------------------------------ cloth extent */
    /* the cloth is a square-ish sheet in model units: 1 unit = one cloth width */
    const sheet = p.sheet || "Fit";
    const asp = sheet === "Fit" ? clamp((H - 2 * margin) / Math.max(1, W - 2 * margin), 0.4, 2.5) : 1;
    const CW = 1, CH = asp;
    /* a round sheet: vertices outside the disc are simply not there */
    const inSheet = (x, y) => sheet !== "Round" || Math.hypot(x - CW / 2, y - CH / 2) <= 0.5 + 1e-9;
    const nx = N, ny = Math.max(6, Math.round(N * asp));

    /* --------------------------------------------------------- objects */
    const kinds = p.shapes === "Mixed" ? ["sphere", "box", "cone"] : [p.shapes === "Spheres" ? "sphere" : p.shapes === "Boxes" ? "box" : "cone"];
    const objs = [];
    for (let i = 0; i < count; i++) {
      const r = sizeF * 0.5 * (0.6 + rng() * 0.8);
      let best = null, bd = -1;
      for (let a = 0; a < 20; a++) {
        const cx = r + rng() * Math.max(0, CW - 2 * r), cy = r + rng() * Math.max(0, CH - 2 * r);
        if (sheet === "Round" && Math.hypot(cx - CW / 2, cy - CH / 2) + r * 0.7 > 0.5) continue;
        let d = 1e9; for (const o of objs) d = Math.min(d, Math.hypot(o.cx - cx, o.cy - cy) - (o.r + r) * 0.8);
        if (d > bd) { bd = d; best = [cx, cy]; }
        if (d > 0) break;
      }
      if (!best) continue;
      objs.push({ kind: kinds[Math.floor(rng() * kinds.length)], cx: best[0], cy: best[1], r, h: heightF * 0.45 * (0.6 + rng() * 0.7) * Math.min(1, r / (sizeF * 0.5)), rot: rng() * Math.PI });
    }
    /* wired objects: paths (closed -> blocks, open -> ridges) and a triangle mesh */
    const toCloth = ([x, y]) => [(x - margin) / Math.max(1e-6, W - 2 * margin) * CW, (y - margin) / Math.max(1e-6, H - 2 * margin) * CH];
    const wiredPaths = ins[1] && ins[1].paths && ins[1].paths.length ? ins[1].paths.filter((q) => q.pts && q.pts.length >= 2).map((q) => ({ pts: q.pts.map(toCloth), closed: !!q.closed && q.pts.length >= 3 })) : [];
    const mesh = ins[2] && ins[2].kind === "mesh" && ins[2].v && ins[2].tri > 0 ? ins[2] : null;
    const wired = wiredPaths.length > 0 || !!mesh;
    const blockH = heightF * 0.45 * 0.8, ridgeR = sizeF * 0.5 * 0.5, softE = 0.035;
    const segDist = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-12; const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1); return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y); };
    const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0]) c = !c; } return c; };
    const pathTop = (x, y) => {
      let z = 0;
      for (const q of wiredPaths) {
        let d = 1e9;
        for (let i = 0; i < q.pts.length - (q.closed ? 0 : 1); i++) d = Math.min(d, segDist(x, y, q.pts[i], q.pts[(i + 1) % q.pts.length]));
        if (q.closed) { if (inPoly(x, y, q.pts)) z = Math.max(z, blockH * Math.min(1, d / softE)); else if (d < softE) z = Math.max(z, 0); }
        else if (d < ridgeR) z = Math.max(z, Math.sqrt(ridgeR * ridgeR - d * d) * (blockH / ridgeR) * 0.8);
      }
      return z;
    };
    /* mesh: footprint = Object size, centred; heights keep the mesh's proportions, scaled by Height (45 % = true) */
    let meshTop = null;
    if (mesh) {
      const v = mesh.v, tri = Math.floor(v.length / 9);
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, minz = 1e9;
      for (let i = 0; i < tri * 9; i += 3) { minx = Math.min(minx, v[i]); maxx = Math.max(maxx, v[i]); miny = Math.min(miny, v[i + 1]); maxy = Math.max(maxy, v[i + 1]); minz = Math.min(minz, v[i + 2]); }
      const foot = Math.max(1e-6, Math.max(maxx - minx, maxy - miny));
      const sc = (sizeF * 2.2) / foot;
      const cxm = (minx + maxx) / 2, cym = (miny + maxy) / 2;
      const grid = new Float32Array((nx + 1) * (ny + 1));
      const M = (mx, my) => [CW / 2 + (mx - cxm) * sc, CH / 2 + (my - cym) * sc];
      for (let t = 0; t < tri; t++) {
        const A = M(v[t * 9], v[t * 9 + 1]), B = M(v[t * 9 + 3], v[t * 9 + 4]), C = M(v[t * 9 + 6], v[t * 9 + 7]);
        const za = (v[t * 9 + 2] - minz) * sc * (heightF / 0.45), zb = (v[t * 9 + 5] - minz) * sc * (heightF / 0.45), zc = (v[t * 9 + 8] - minz) * sc * (heightF / 0.45);
        const det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
        if (Math.abs(det) < 1e-12) continue;
        const i0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]) / CW * nx)), i1 = Math.min(nx, Math.ceil(Math.max(A[0], B[0], C[0]) / CW * nx));
        const j0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]) / CH * ny)), j1 = Math.min(ny, Math.ceil(Math.max(A[1], B[1], C[1]) / CH * ny));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const px = i / nx * CW, py = j / ny * CH;
          const l1 = ((B[0] - px) * (C[1] - py) - (C[0] - px) * (B[1] - py)) / det, l2 = ((C[0] - px) * (A[1] - py) - (A[0] - px) * (C[1] - py)) / det, l3 = 1 - l1 - l2;
          if (l1 < -0.01 || l2 < -0.01 || l3 < -0.01) continue;
          const z = l1 * za + l2 * zb + l3 * zc, k = j * (nx + 1) + i;
          if (z > grid[k]) grid[k] = z;
        }
      }
      meshTop = (i, j) => grid[j * (nx + 1) + i];
    }
    const objTop = (x, y) => {
      if (wired) return pathTop(x, y);
      let z = 0;
      for (const o of objs) {
        const dx = x - o.cx, dy = y - o.cy;
        if (o.kind === "sphere") { const d2 = dx * dx + dy * dy; if (d2 < o.r * o.r) { const rz = o.h / o.r; z = Math.max(z, Math.sqrt(o.r * o.r - d2) * rz); } }
        else if (o.kind === "cone") { const d = Math.hypot(dx, dy); if (d < o.r) z = Math.max(z, o.h * (1 - d / o.r)); }
        else { const c = Math.cos(o.rot), s = Math.sin(o.rot); const u = Math.abs(dx * c + dy * s), v = Math.abs(-dx * s + dy * c); const a = o.r * 0.85, b = o.r * 0.6; if (u < a && v < b) { const e = Math.min(a - u, b - v) / (o.r * 0.12); z = Math.max(z, o.h * Math.min(1, e)); } }
      }
      return z;
    };

    /* ---------------------------------------------------- drape the cloth */
    const idx = (i, j) => j * (nx + 1) + i;
    const on = new Uint8Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) on[idx(i, j)] = inSheet(i / nx * CW, j / ny * CH) ? 1 : 0;
    const floor = new Float32Array((nx + 1) * (ny + 1));
    let h = new Float32Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { let z = objTop(i / nx * CW, j / ny * CH); if (meshTop) z = Math.max(z, meshTop(i, j)); floor[idx(i, j)] = z; h[idx(i, j)] = z; }
    /* relaxation: each pass the sheet averages with its neighbours but can never sink below an object */
    for (let it = 0; it < tension; it++) {
      const nh = new Float32Array(h.length);
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const a = h[idx(Math.max(0, i - 1), j)], b = h[idx(Math.min(nx, i + 1), j)], c = h[idx(i, Math.max(0, j - 1))], d = h[idx(i, Math.min(ny, j + 1))];
        const avg = (a + b + c + d) / 4;
        /* sag: a little gravity so the sheet does not float flat between objects */
        nh[idx(i, j)] = Math.max(floor[idx(i, j)], avg - 0.002);
      }
      h = nh;
    }
    /* wrinkles: folds where the sheet is off the table, none where it lies flat */
    if (wrinkles > 0) {
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const k = idx(i, j);
        const lift = clamp(h[k] / 0.08, 0, 1);
        const n1 = noise2(i / nx * 9 + 3, j / ny * 9 * asp, seed) - 0.5, n2 = noise2(i / nx * 23 + 11, j / ny * 23 * asp, seed + 5) - 0.5;
        h[k] = Math.max(floor[k], h[k] + lift * wrinkles * (n1 * 0.05 + n2 * 0.015));
      }
    }

    /* ---------------------------------------------------------- project */
    const cy0 = CW / 2, cz0 = CH / 2;
    const cyaw = Math.cos(yaw), syaw = Math.sin(yaw), ce = Math.cos(elev), se = Math.sin(elev);
    const P = new Array(h.length), S = new Array(h.length), Nz = new Float32Array(h.length), NL = new Float32Array(h.length);
    const lightA = (Number(p.light) || 0) * Math.PI / 180;
    const lightDir = [Math.sin(lightA) * 0.7, -Math.cos(lightA) * 0.7, 0.72];
    const ll = Math.hypot(...lightDir); lightDir[0] /= ll; lightDir[1] /= ll; lightDir[2] /= ll;
    const view = (x, y, z) => {
      /* yaw about the vertical, then tilt by elevation; depth grows toward the viewer */
      const rx = (x - cy0) * cyaw - (y - cz0) * syaw, ry = (x - cy0) * syaw + (y - cz0) * cyaw;
      return [rx, -(ry * se + z * ce), -ry * ce + z * se];
    };
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const k = idx(i, j);
      P[k] = view(i / nx * CW, j / ny * CH, h[k]);
    }
    const scale0 = 100;      /* provisional mm per unit; the final fit rescales */
    for (let k = 0; k < P.length; k++) { const f = 1 / Math.max(0.35, 1 - persp * 0.55 * P[k][2]); S[k] = [P[k][0] * f * scale0, P[k][1] * f * scale0]; }
    /* normals in view space from neighbours */
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const k = idx(i, j);
      const a = P[idx(Math.min(nx, i + 1), j)], b = P[idx(Math.max(0, i - 1), j)], c = P[idx(i, Math.min(ny, j + 1))], d = P[idx(i, Math.max(0, j - 1))];
      const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
      let n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const l = Math.hypot(...n) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      /* the cloth's up side: its normal has positive world-z; in view space that is the side facing the elevated camera */
      const upWorld = view(0, 0, 1); const base = view(0, 0, 0); const up = [upWorld[0] - base[0], upWorld[1] - base[1], upWorld[2] - base[2]];
      if (n[0] * up[0] + n[1] * up[1] + n[2] * up[2] < 0) n = [-n[0], -n[1], -n[2]];
      Nz[k] = n[2];
      NL[k] = clamp(n[0] * lightDir[0] + n[1] * lightDir[1] + n[2] * lightDir[2], 0, 1);
    }

    /* ---------------------------------------------------- occlusion */
    const occ = new Uint8Array(h.length);
    if (hidden) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const q of S) { if (q[0] < x0) x0 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[0] > x1) x1 = q[0]; if (q[1] > y1) y1 = q[1]; }
      const RES = 220, cell = Math.max(1e-6, Math.max(x1 - x0, y1 - y0) / RES);
      const cols = Math.ceil((x1 - x0) / cell) + 1, rows = Math.ceil((y1 - y0) / cell) + 1;
      const buf = new Float32Array(cols * rows).fill(-1e9);
      const tri = (a, b, c, za, zb, zc) => {
        const cx0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / cell)), cx1 = Math.min(cols - 1, Math.floor((Math.max(a[0], b[0], c[0]) - x0) / cell));
        const cy0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - y0) / cell)), cy1 = Math.min(rows - 1, Math.floor((Math.max(a[1], b[1], c[1]) - y0) / cell));
        const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
        if (Math.abs(det) < 1e-12) return;
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
          const px = x0 + (cx + 0.5) * cell, py = y0 + (cy + 0.5) * cell;
          const l1 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / det, l2 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / det, l3 = 1 - l1 - l2;
          if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
          const z = l1 * za + l2 * zb + l3 * zc, i = cy * cols + cx;
          if (z > buf[i]) buf[i] = z;
        }
      };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k00 = idx(i, j), k10 = idx(i + 1, j), k11 = idx(i + 1, j + 1), k01 = idx(i, j + 1);
        if (!(on[k00] && on[k10] && on[k11] && on[k01])) continue;
        tri(S[k00], S[k10], S[k11], P[k00][2], P[k10][2], P[k11][2]);
        tri(S[k00], S[k11], S[k01], P[k00][2], P[k11][2], P[k01][2]);
      }
      for (let k = 0; k < S.length; k++) {
        const cx = Math.min(cols - 1, Math.max(0, Math.floor((S[k][0] - x0) / cell))), cy = Math.min(rows - 1, Math.max(0, Math.floor((S[k][1] - y0) / cell)));
        const eps = 0.012 + 0.08 * (1 - Math.min(1, Math.abs(Nz[k])));
        occ[k] = P[k][2] < buf[cy * cols + cx] - eps ? 1 : 0;
      }
    }
    const vis = (k) => on[k] && (!hidden || (Nz[k] > 0.02 && !occ[k]));

    /* ------------------------------------------------------ renderers */
    const out = [];
    const runs = (ks) => { let cur = []; for (const k of ks) { if (vis(k)) cur.push(S[k]); else { if (cur.length >= 2) out.push(cur); cur = []; } } if (cur.length >= 2) out.push(cur); };
    const chain = (segs) => {
      const key = (q) => Math.round(q[0] * 50) + "," + Math.round(q[1] * 50);
      const ends = new Map(); const used = new Array(segs.length).fill(false);
      segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
      const res = [];
      for (let i = 0; i < segs.length; i++) {
        if (used[i]) continue; used[i] = true;
        const line = [segs[i][0], segs[i][1]];
        for (const dir of [1, -1]) for (let g = 0; g < 8000; g++) { const tip = dir === 1 ? line[line.length - 1] : line[0]; const c = (ends.get(key(tip)) || []).find((j) => !used[j]); if (c === undefined) break; used[c] = true; const s = segs[c]; const nxt = key(s[0]) === key(tip) ? s[1] : s[0]; if (dir === 1) line.push(nxt); else line.unshift(nxt); }
        res.push(line);
      }
      return res;
    };
    const isolines = (field, level, cull) => {
      const segs = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const ks = [idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)];
        if (!ks.every((k) => on[k])) continue;
        if (cull && !ks.some(vis)) continue;
        const f = ks.map((k) => field[k] - level);
        if ((f[0] < 0) === (f[1] < 0) && (f[1] < 0) === (f[2] < 0) && (f[2] < 0) === (f[3] < 0)) continue;
        const pts = [];
        for (let e = 0; e < 4; e++) { const a = ks[e], b = ks[(e + 1) % 4], fa = f[e], fb = f[(e + 1) % 4]; if ((fa < 0) !== (fb < 0)) { const t = fa / (fa - fb); pts.push([S[a][0] + (S[b][0] - S[a][0]) * t, S[a][1] + (S[b][1] - S[a][1]) * t]); } }
        if (pts.length === 2) segs.push(pts); else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); }
      }
      return segs;
    };

    /* the sheet's outer edge: the grid border, or for a round sheet a projected circle at table height plus the local sheet lift */
    const rim = () => {
      if (sheet !== "Round") {
        const edge = []; for (let i = 0; i <= nx; i++) edge.push(idx(i, 0)); for (let j = 1; j <= ny; j++) edge.push(idx(nx, j)); for (let i = nx - 1; i >= 0; i--) edge.push(idx(i, ny)); for (let j = ny - 1; j >= 0; j--) edge.push(idx(0, j)); edge.push(idx(0, 0));
        runs(edge);
        return;
      }
      const n = Math.max(48, N * 4), pts = [];
      for (let a = 0; a <= n; a++) {
        const t = a / n * Math.PI * 2, x = CW / 2 + Math.cos(t) * 0.5, y = CH / 2 + Math.sin(t) * 0.5;
        const gi = clamp(Math.round(x / CW * nx), 0, nx), gj = clamp(Math.round(y / CH * ny), 0, ny);
        const v = view(x, y, h[idx(gi, gj)]); const f = 1 / Math.max(0.35, 1 - persp * 0.55 * v[2]);
        pts.push([v[0] * f * scale0, v[1] * f * scale0]);
      }
      out.push(pts);
    };
    if (style === "Wire" || style === "Hatch") {
      for (let i = 0; i <= nx; i++) { const ks = []; for (let j = 0; j <= ny; j++) ks.push(idx(i, j)); if (style === "Wire") runs(ks); else { let cur = []; for (const k of ks) { if (vis(k) && NL[k] < 0.62) cur.push(S[k]); else { if (cur.length >= 2) out.push(cur); cur = []; } } if (cur.length >= 2) out.push(cur); } }
      for (let j = 0; j <= ny; j++) { const ks = []; for (let i = 0; i <= nx; i++) ks.push(idx(i, j)); if (style === "Wire") runs(ks); else { let cur = []; for (const k of ks) { if (vis(k) && NL[k] < 0.85) cur.push(S[k]); else { if (cur.length >= 2) out.push(cur); cur = []; } } if (cur.length >= 2) out.push(cur); } }
      if (style === "Hatch") chain(isolines(Nz, 0.0, false)).forEach((c) => out.push(c));
      if (style === "Hatch" || sheet === "Round") rim();
    } else if (style === "Weave") {
      /* warp over weft: every line breaks on alternate crossings so the two families interlace */
      const gapF = 0.16;
      for (let i = 0; i <= nx; i++) {
        let cur = [];
        for (let j = 0; j <= ny; j++) {
          const k = idx(i, j);
          if (!vis(k)) { if (cur.length >= 2) out.push(cur); cur = []; continue; }
          const under = (i + j) % 2 === 1;
          const a = S[idx(i, Math.max(0, j - 1))], b = S[idx(i, Math.min(ny, j + 1))];
          if (under) { cur.push([S[k][0] + (a[0] - S[k][0]) * gapF, S[k][1] + (a[1] - S[k][1]) * gapF]); if (cur.length >= 2) out.push(cur); cur = [[S[k][0] + (b[0] - S[k][0]) * gapF, S[k][1] + (b[1] - S[k][1]) * gapF]]; }
          else cur.push(S[k]);
        }
        if (cur.length >= 2) out.push(cur);
      }
      for (let j = 0; j <= ny; j++) {
        let cur = [];
        for (let i = 0; i <= nx; i++) {
          const k = idx(i, j);
          if (!vis(k)) { if (cur.length >= 2) out.push(cur); cur = []; continue; }
          const under = (i + j) % 2 === 0;
          const a = S[idx(Math.max(0, i - 1), j)], b = S[idx(Math.min(nx, i + 1), j)];
          if (under) { cur.push([S[k][0] + (a[0] - S[k][0]) * gapF, S[k][1] + (a[1] - S[k][1]) * gapF]); if (cur.length >= 2) out.push(cur); cur = [[S[k][0] + (b[0] - S[k][0]) * gapF, S[k][1] + (b[1] - S[k][1]) * gapF]]; }
          else cur.push(S[k]);
        }
        if (cur.length >= 2) out.push(cur);
      }
      if (sheet === "Round") rim();
    } else {
      /* Contour: height levels of the draped surface, drawn in 3D */
      let hmax = 0; for (const v of h) if (v > hmax) hmax = v;
      const levels = Math.max(4, Math.round(N * 0.5));
      const step = Math.max(1e-4, hmax / levels);
      for (let lv = step * 0.5; lv < hmax; lv += step) chain(isolines(h, lv, hidden)).forEach((c) => out.push(c));
      rim();
      /* table-level grid lightly: every 4th line where the sheet is flat, so the objects read against something */
      for (let i = 0; i <= nx; i += 4) { let cur = []; for (let j = 0; j <= ny; j++) { const k = idx(i, j); if (vis(k) && h[k] < step * 0.5) cur.push(S[k]); else { if (cur.length >= 2) out.push(cur); cur = []; } } if (cur.length >= 2) out.push(cur); }
    }

    /* ------------------------------------------------- fit to the margins */
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of out) for (const [x, y] of q) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    if (!out.length || !Number.isFinite(x0)) return EMPTY;
    let k, cxm, cym;
    if (p.lock) {
      /* rotation-invariant: the sheet's bounding circle (corners plus the tallest point) at the worst perspective */
      let hmax = 0; for (const v of h) if (v > hmax) hmax = v;
      const R = sheet === "Round" ? 0.5 : Math.hypot(CW / 2, CH / 2);
      const fmax = 1 / Math.max(0.35, 1 - persp * 0.55 * (R * ce + hmax * se));
      const extX = 2 * R * fmax * scale0;
      const extY = (2 * R * se + hmax * ce) * fmax * scale0;
      k = Math.min((W - 2 * margin) / extX, (H - 2 * margin) / extY);
      /* keep the sheet's centre fixed on the page so turning does not drift */
      const c = view(CW / 2, CH / 2, 0); const f = 1 / Math.max(0.35, 1 - persp * 0.55 * c[2]);
      cxm = c[0] * f * scale0; cym = c[1] * f * scale0;
      /* still never leave the margins */
      const half = Math.max(Math.abs(x0 - cxm), Math.abs(x1 - cxm)), halfY = Math.max(Math.abs(y0 - cym), Math.abs(y1 - cym));
      k = Math.min(k, (W / 2 - margin) / Math.max(1e-6, half), (H / 2 - margin) / Math.max(1e-6, halfY));
    } else {
      const bw = Math.max(1e-6, x1 - x0), bh = Math.max(1e-6, y1 - y0);
      k = Math.min((W - 2 * margin) / bw, (H - 2 * margin) / bh);
      cxm = (x0 + x1) / 2; cym = (y0 + y1) / 2;
    }
    const paths = [];
    let total = 0;
    for (const q of out) {
      if (total > BUDGET) break;
      const pts = q.map(([x, y]) => [W / 2 + (x - cxm) * k, H / 2 + (y - cym) * k]);
      paths.push({ pts, closed: false, layer: pen });
      total += pts.length;
    }
    return applyStyle({ paths }, ins[0]);
  },

  overlay(p, ctx, ins) {
    try {
      const W = (ctx && ctx.W) || 0, H = (ctx && ctx.H) || 0;
      const m = Math.max(0, Number(p.margin) || 0);
      const g = [{ kind: "rect", x: m, y: m, w: Math.max(0, W - 2 * m), h: Math.max(0, H - 2 * m) }];
      if(p.physicsMode==='Hanging'||p.physicsMode==='Flag')return g;
      const src = ins && ins[1] && ins[1].paths ? ins[1].paths : [];
      src.slice(0, 40).forEach((q) => { if (q.pts && q.pts.length >= 2) g.push({ kind: "poly", pts: q.pts }); });
      return g;
    } catch (e) { return []; }
  },
};
