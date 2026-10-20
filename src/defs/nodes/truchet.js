import { Pin, mulberry32, hash2, applyStyle } from "../helpers.js";

export default {
  key: "truchet",
  name: "Truchet",
  cat: "gen",
  group: "geometric",
  desc: "Tiled quarter-circle patterns. Pattern mask (Tiles mode) changes tile orientation inside closed Mask paths, including holes, or a loaded darkness image fitted across the whole canvas. Inside orientation % blends random orientation with the mask; it does not clip tiles. Closed text outlines work, open centreline text does not define an interior. Custom tile adds a draggable corner gesture with fixed quarter-edge anchors: edit points in the corner diagram or with X/Y numbers, add/remove points and toggle Square corner. Linked mirrors one gesture across four corners, Alternate swaps axes on alternate corners, Paired shares opposite corners, Independent edits each separately. Rotations preserve the matching edge anchors. Inset copies shrink inside each tile and deliberately do not join across edges. Colours cycles corners/copies through up to four pens. Dense custom grids enlarge the effective tile size uniformly. The editor diagram is the control polygon; the paper preview is the smooth result.  Tiles mode draws arc or diagonal tiles; Tile fill leaves a seeded share of tiles empty; Separate clamps arc radii and forces an edge gap so strands never meet or cross. Concentric bands and Butterfly add outlined or arc-hatched bands; Band width controls the dark-to-gap ratio and Row offset sets Butterfly orientation rhythm. Loop mode grows a spanning tree and emits one single closed line that fills the canvas - a maze you can plot without lifting the pen.",
  ins: [Pin("style", "Style"),Pin("paths","Mask")],
  outs: [Pin("paths")],
  fileImage:true,
  params: [
    {key:"patternMask",label:"Pattern mask",type:"check",def:false,showIf:p=>p.mode==="Tiles"},
    {key:"maskImage",label:"Mask image",type:"file",def:"",showIf:p=>p.mode==="Tiles"&&p.patternMask},
    {key:"maskBias",label:"Inside orientation %",type:"slider",min:0,max:100,step:1,def:100,showIf:p=>p.mode==="Tiles"&&p.patternMask},
    { key: "mode", label: "Pattern", type: "select", options: ["Tiles", "Loop", "Concentric bands", "Butterfly", "Custom tile"], def: "Tiles" },
    {key:'cornerLink',label:'Corner linking',type:'select',options:['Linked','Alternate','Paired','Independent'],def:'Linked',showIf:p=>p.mode==='Custom tile'},
    {key:'editCorner',label:'Edit corner',type:'select',options:['TL','TR','BR','BL'],def:'TL',showIf:p=>p.mode==='Custom tile'&&p.cornerLink==='Independent'},
    ...['TL','TR','BR','BL'].map((name,i)=>({key:'knots'+name,label:name+' gesture',type:'tilepoints',def:[[.02,.28,1],[.14,.14,1],[.28,.02,1]],showIf:p=>p.mode==='Custom tile'&&(p.cornerLink==='Independent'?(p.editCorner||'TL')===name:i===0||(i===1&&p.cornerLink==='Paired'))})),
    {key:'smoothness',label:'Smoothness %',type:'slider',min:0,max:100,step:1,def:85,showIf:p=>p.mode==='Custom tile'},
    {key:'tileRotation',label:'Tile rotations',type:'select',options:['Fixed','Checkerboard','Seeded'],def:'Seeded',showIf:p=>p.mode==='Custom tile'},
    {key:'insetCopies',label:'Inset copies',type:'slider',min:0,max:4,step:1,def:0,showIf:p=>p.mode==='Custom tile'},
    {key:'copyGap',label:'Inset step mm',type:'slider',min:.2,max:3,step:.1,def:.6,showIf:p=>p.mode==='Custom tile'&&p.insetCopies>0},
    {key:'customColours',label:'Colours',type:'slider',min:1,max:4,step:1,def:1,showIf:p=>p.mode==='Custom tile'},
    ...[2,3,4].map(n=>({key:'customPen'+n,label:'Pen '+n,type:'pen',def:n===2?1:n===3?2:6,showIf:p=>p.mode==='Custom tile'&&p.customColours>=n})),
    {key:'bands',label:'Bands per tile',type:'slider',min:1,max:14,step:1,def:5,showIf:p=>['Concentric bands','Butterfly'].includes(p.mode)},
    {key:'bandRatio',label:'Band width %',type:'slider',min:5,max:95,step:1,def:45,showIf:p=>['Concentric bands','Butterfly'].includes(p.mode)},
    {key:'bandDrawing',label:'Band drawing',type:'select',options:['Outlines','Hatch'],def:'Outlines',showIf:p=>['Concentric bands','Butterfly'].includes(p.mode)},
    {key:'bandPitch',label:'Hatch gap mm',type:'slider',min:.2,max:3,step:.1,def:.7,showIf:p=>['Concentric bands','Butterfly'].includes(p.mode)&&p.bandDrawing==='Hatch'},
    {key:'rowOffset',label:'Row offset',type:'slider',min:0,max:6,step:1,def:1,showIf:p=>p.mode==='Butterfly'},
    { key: "ttype", label: "Tile type", type: "select", options: ["Arcs", "Diagonals"], def: "Arcs", showIf: p => p.mode !== "Custom tile" },
    { key: "fill", label: "Tile fill % (Tiles)", type: "slider", min: 10, max: 100, step: 1, def: 100, showIf: p => p.mode !== "Custom tile" },
    { key: "sep", label: "Lines", type: "select", options: ["Connected", "Separate (never meet)"], def: "Connected", showIf: p => p.mode !== "Custom tile" },
    { key: "tile", label: "Tile mm", type: "slider", min: 4, max: 60, step: 1, def: 15 },
    { key: "scale", label: "Scale %", type: "slider", min: 10, max: 400, step: 1, def: 100 },
    { key: "lines", label: "Lines per tile", type: "slider", min: 1, max: 6, step: 1, def: 1, showIf: p => p.mode !== "Custom tile" },
    { key: "spread", label: "Line spread %", type: "slider", min: 10, max: 100, step: 1, def: 100, showIf: p => p.mode !== "Custom tile" },
    { key: "gapmm", label: "Arc gap mm", type: "slider", min: 0, max: 8, step: 0.1, def: 0, showIf: p => p.mode !== "Custom tile" },
    { key: "round", label: "Corner radius % (loop)", type: "slider", min: 10, max: 100, step: 1, def: 100 },
    { key: "margin", label: "Margin mm", type: "slider", min: 0, max: 60, step: 1, def: 12 },
    { key: "seed", label: "Seed", type: "seed", def: 9, showIf: p => p.mode !== "Custom tile" || p.tileRotation === "Seeded" },
    { key: "layer", label: "Pen", type: "pen", def: 0 },
  ],
  overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
  _bands(ins,p,c){
    const num=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),m=num('margin',12,0,Math.min(c.W,c.H)/2),N=Math.round(num('bands',5,1,16)),ratio=num('bandRatio',45,5,95)/100,pitch=num('bandPitch',.7,.2,10),layer=Math.round(num('layer',0,0,11));if(c.W<=2*m||c.H<=2*m)return {paths:[]};
    let t=Math.max(2,num('tile',15,1,300)*num('scale',100,1,1000)/100);const worst=p.bandDrawing==='Hatch'?Math.max(N,t/pitch):N*2;t=Math.max(t,Math.sqrt((c.W-2*m)*(c.H-2*m)*worst*70/90000));
    if(p.bandDrawing==='Hatch')t=Math.max(t,Math.sqrt((c.W-2*m)*(c.H-2*m)*N*100/90000),(c.W-2*m)*(c.H-2*m)*ratio*100/(pitch*90000));
    t=Math.min(t,c.W-2*m,c.H-2*m);const cols=Math.max(1,Math.floor((c.W-2*m)/t)),rows=Math.max(1,Math.floor((c.H-2*m)/t));t=Math.min(t,c.W-2*m,c.H-2*m);const ox=(c.W-cols*t)/2,oy=(c.H-rows*t)/2,paths=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const rotation=p.mode==='Butterfly'?((x+y*Math.round(num('rowOffset',1,0,6)))%2)*Math.PI/2:Math.floor(hash2(x,y,p.seed)*4)*Math.PI/2,co=Math.cos(rotation),si=Math.sin(rotation),map=q=>[ox+(x+.5)*t+q[0]*co-q[1]*si,oy+(y+.5)*t+q[0]*si+q[1]*co];
      const families=p.mode==='Butterfly'?[[-t/2,0,-Math.PI/2,Math.PI,t/2],[t/2,0,Math.PI/2,Math.PI,t/2]]:[[-t/2,-t/2,0,Math.PI/2,t]];
      for(const [cx,cy,start,sweep,R]of families)for(let b=0;b<N;b++){
        const lo=(b+(1-ratio)/2)*R/N,hi=(b+(1+ratio)/2)*R/N,ns=Math.max(6,Math.min(24,Math.ceil(hi*sweep/1.4))),arc=rad=>Array.from({length:ns+1},(_,k)=>map([cx+rad*Math.cos(start+sweep*k/ns),cy+rad*Math.sin(start+sweep*k/ns)]));
        if(p.bandDrawing==='Hatch'){const n=Math.max(1,Math.ceil((hi-lo)/pitch));for(let k=0;k<n;k++)paths.push({pts:arc(lo+(k+.5)*(hi-lo)/n),closed:false,layer});}
        else paths.push({pts:[...arc(hi),...arc(lo).reverse()],closed:true,layer});
      }
    }
    let style=ins[0],out=applyStyle({paths},style);for(let k=0;k<12&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;k++){style={...style,dash:Math.max(.1,+style?.dash||4)*2,gap:Math.max(.1,+style?.gap||3)*2};out=applyStyle({paths},style);}return out;
  },
  _gesture(raw,smooth){
    const clean=Array.isArray(raw)?raw.filter(q=>Array.isArray(q)&&q.length>=2&&q.slice(0,2).every(Number.isFinite)).slice(0,6):[],knots=[[0,.25,0],...(clean.length?clean:[[.14,.14,1]]).map(q=>[Math.max(.01,Math.min(.99,q[0]))*.5,Math.max(.01,Math.min(.99,q[1]))*.5,q[2]===0?0:1]),[.25,0,0]],pts=[];
    for(let i=0;i<knots.length-1;i++){const a=knots[i],b=knots[i+1],prev=knots[i-1]||a,next=knots[i+2]||b,d=[b[0]-a[0],b[1]-a[1]],ta=d.map((v,k)=>(1-smooth)*v+smooth*(a[2]?(b[k]-prev[k])*.5:v)),tb=d.map((v,k)=>(1-smooth)*v+smooth*(b[2]?(next[k]-a[k])*.5:v));
      for(let j=0;j<10;j++){const t=j/10,t2=t*t,t3=t2*t;pts.push(a.slice(0,2).map((v,k)=>Math.max(.0001,Math.min(.4999,(2*t3-3*t2+1)*v+(t3-2*t2+t)*ta[k]+(-2*t3+3*t2)*b[k]+(t3-t2)*tb[k]))));}}
    pts[0]=[0,.25];pts.push([.25,0]);return pts;
  },
  _custom(ins,p,c){
    const num=(v,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+v)?+v:d)),m=num(p.margin,12,0,Math.min(c.W,c.H)/2),w=c.W-2*m,h=c.H-2*m;if(w<=0||h<=0)return {paths:[]};
    const copies=Math.round(num(p.insetCopies,0,0,4)),smooth=num(p.smoothness,85,0,100)/100,gestures=['TL','TR','BR','BL'].map(k=>this._gesture(p['knots'+k],smooth)),maxPoints=Math.max(...gestures.map(q=>q.length)),requested=num(p.tile,15,1.5,300)*num(p.scale,100,1,1000)/100,t=Math.max(requested,Math.sqrt(w*h*4*(copies+1)*maxPoints/95000)),cols=Math.max(1,Math.floor(w/t)),rows=Math.max(1,Math.floor(h/t)),size=Math.min(t,w/cols,h/rows),ox=(c.W-cols*size)/2,oy=(c.H-rows*size)/2,nc=Math.round(num(p.customColours,1,1,4)),pens=[p.layer??0,p.customPen2??1,p.customPen3??2,p.customPen4??6].map(v=>Math.round(num(v,0,0,11))),paths=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const rot=p.tileRotation==='Fixed'?0:p.tileRotation==='Checkerboard'?(x+y)%4:Math.floor(hash2(x,y,+p.seed||0)*4);
      for(let corner=0;corner<4;corner++){
        let source=p.cornerLink==='Independent'?corner:p.cornerLink==='Paired'?corner%2:0;
        const base=gestures[source],swap=p.cornerLink==='Alternate'&&corner%2,convert=q=>{let [a,b]=swap?[q[1],q[0]]:q;if(corner===1||corner===2)a=1-a;if(corner>=2)b=1-b;for(let k=0;k<rot;k++)[a,b]=[1-b,a];return [a,b];};
        for(let j=0;j<=copies;j++){const inset=num(p.copyGap,.6,.2,20)*j/size;if(inset>=.48)break;const factor=1-2*inset,pts=base.map(convert).map(q=>[ox+(x+.5+(q[0]-.5)*factor)*size,oy+(y+.5+(q[1]-.5)*factor)*size]);paths.push({pts,closed:false,layer:pens[(corner+j)%nc]});}
      }
    }return applyStyle({paths},ins?.[0]);
  },
  compute(ins, p, ctx, node) {
    if(['Concentric bands','Butterfly'].includes(p.mode))return this._bands(ins,p,ctx);
    if(p.mode==="Custom tile")return this._custom(ins,p,ctx);
    const { W, H } = ctx;
    const t = Math.max(1.5, p.tile * (p.scale / 100));
    const L = Math.round(p.layer);

    /* ---------- LOOP: yksi suljettu kieppi (virittävä puu -> kiertoreitti) ---------- */
    if (p.mode === "Loop") {
      const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
      const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
      const s = t / 2; /* alihilan askel */
      const ox = (W - cols * t) / 2 + t / 4;
      const oy = (H - rows * t) / 2 + t / 4;
      const rng = mulberry32(p.seed * 811 + 3);
      /* virittava puu solujen ylitse (satunnainen DFS) */
      const visited = new Set();
      const treeH = new Set(); /* "i,j" = reuna (i,j)-(i+1,j) */
      const treeV = new Set(); /* "i,j" = reuna (i,j)-(i,j+1) */
      const stack = [[Math.floor(rng() * cols), Math.floor(rng() * rows)]];
      visited.add(stack[0][0] + "," + stack[0][1]);
      while (stack.length) {
        const [ci, cj] = stack[stack.length - 1];
        const nbrs = [];
        if (ci > 0 && !visited.has((ci - 1) + "," + cj)) nbrs.push([ci - 1, cj, "H", ci - 1, cj]);
        if (ci < cols - 1 && !visited.has((ci + 1) + "," + cj)) nbrs.push([ci + 1, cj, "H", ci, cj]);
        if (cj > 0 && !visited.has(ci + "," + (cj - 1))) nbrs.push([ci, cj - 1, "V", ci, cj - 1]);
        if (cj < rows - 1 && !visited.has(ci + "," + (cj + 1))) nbrs.push([ci, cj + 1, "V", ci, cj]);
        if (!nbrs.length) { stack.pop(); continue; }
        const [ni, nj, kind, ei, ej] = nbrs[Math.floor(rng() * nbrs.length)];
        (kind === "H" ? treeH : treeV).add(ei + "," + ej);
        visited.add(ni + "," + nj);
        stack.push([ni, nj]);
      }
      /* alihilan reunat: joka solu pieni rengas, puun reunat leikkaa+liittaa renkaat yhdeksi */
      const edges = new Set();
      const ek = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
      const vk = (x, y) => x + "," + y;
      const addE = (x1, y1, x2, y2) => edges.add(ek(vk(x1, y1), vk(x2, y2)));
      const delE = (x1, y1, x2, y2) => edges.delete(ek(vk(x1, y1), vk(x2, y2)));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = [2 * i, 2 * j], b = [2 * i + 1, 2 * j], c = [2 * i, 2 * j + 1], d = [2 * i + 1, 2 * j + 1];
        addE(...a, ...b); addE(...b, ...d); addE(...d, ...c); addE(...c, ...a);
      }
      for (const key of treeH) {
        const [i, j] = key.split(",").map(Number);
        delE(2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1);
        delE(2 * i + 2, 2 * j, 2 * i + 2, 2 * j + 1);
        addE(2 * i + 1, 2 * j, 2 * i + 2, 2 * j);
        addE(2 * i + 1, 2 * j + 1, 2 * i + 2, 2 * j + 1);
      }
      for (const key of treeV) {
        const [i, j] = key.split(",").map(Number);
        delE(2 * i, 2 * j + 1, 2 * i + 1, 2 * j + 1);
        delE(2 * i, 2 * j + 2, 2 * i + 1, 2 * j + 2);
        addE(2 * i, 2 * j + 1, 2 * i, 2 * j + 2);
        addE(2 * i + 1, 2 * j + 1, 2 * i + 1, 2 * j + 2);
      }
      /* jokaisen pisteen aste on 2 -> seuraa sykli */
      const adj = {};
      for (const e of edges) {
        const [a, b] = e.split("|");
        (adj[a] = adj[a] || []).push(b);
        (adj[b] = adj[b] || []).push(a);
      }
      const startK = vk(0, 0);
      const loop = [];
      let cur = startK, prev = null;
      for (let guard = 0; guard < edges.size + 2; guard++) {
        loop.push(cur);
        const nb = adj[cur] || [];
        const nxt = nb[0] === prev ? nb[1] : nb[0];
        if (nxt === undefined) break;
        prev = cur; cur = nxt;
        if (cur === startK) break;
      }
      const V = loop.map((k) => {
        const [x, y] = k.split(",").map(Number);
        return [ox + x * s, oy + y * s];
      });
      /* pyorista kulmat neljanneskaarilla -> truchet-ilme */
      const r = (s / 2) * (p.round / 100);
      const pts = [];
      const N = V.length;
      for (let i = 0; i < N; i++) {
        const v = V[i], pr = V[(i - 1 + N) % N], nx = V[(i + 1) % N];
        const d1 = [v[0] - pr[0], v[1] - pr[1]];
        const d2 = [nx[0] - v[0], nx[1] - v[1]];
        const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
        const u1 = [d1[0] / l1, d1[1] / l1], u2 = [d2[0] / l2, d2[1] / l2];
        const cross = u1[0] * u2[1] - u1[1] * u2[0];
        if (Math.abs(cross) < 0.01) { pts.push([v[0], v[1]]); continue; } /* suora jatkuu */
        const P1 = [v[0] - u1[0] * r, v[1] - u1[1] * r];
        const C = [P1[0] + u2[0] * r, P1[1] + u2[1] * r];
        const a1 = Math.atan2(P1[1] - C[1], P1[0] - C[0]);
        const sweep = (cross > 0 ? 1 : -1) * (Math.PI / 2);
        for (let k = 0; k <= 6; k++) {
          const a = a1 + (k / 6) * sweep;
          pts.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]);
        }
      }
      return applyStyle({ paths: [{ pts, closed: true, layer: L }] }, ins[0]);
    }

    /* ---------- TILES: perinteinen truchet-laatoitus ---------- */
    const cols = Math.max(1, Math.floor((W - 2 * p.margin) / t));
    const rows = Math.max(1, Math.floor((H - 2 * p.margin) / t));
    const ox = (W - cols * t) / 2, oy = (H - rows * t) / 2;
    const paths = [];
    const nL = Math.round(p.lines);
    const spread = p.spread / 100;
    const sep = p.sep === "Separate (never meet)";
    const gmm = sep ? Math.max(1, p.gapmm) : p.gapmm;
    const fillP = Math.max(0.05, Math.min(1, p.fill / 100));
    const arc = (cx, cy, a0) => {
      const seen = new Set();
      for (let m = 0; m < nL; m++) {
        let rr = t / 2 + ((m + 0.5) / nL - 0.5) * t * spread;
        if (sep) rr = Math.min(rr, t * 0.7); /* opposite-corner families cannot cross */
        if (rr <= 0.3) continue;
        const rk = Math.round(rr * 20);
        if (seen.has(rk)) continue; /* clamp may collapse radii */
        seen.add(rk);
        const dA = Math.min(0.55, (gmm / 2) / rr);
        const a1 = a0 + dA, a2 = a0 + Math.PI / 2 - dA;
        if (a2 <= a1) continue;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const a = a1 + (i / 12) * (a2 - a1);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        paths.push({ pts, closed: false, layer: L });
      }
    };
    const diag = (x0, y0, kind) => {
      for (let m = 0; m < nL; m++) {
        const o = ((m + 0.5) / nL - 0.5) * t * spread;
        let A, B;
        if (kind === "\\") {
          A = o >= 0 ? [x0 + o, y0] : [x0, y0 - o];
          B = o >= 0 ? [x0 + t, y0 + t - o] : [x0 + t + o, y0 + t];
        } else {
          A = o >= 0 ? [x0 + t - o, y0] : [x0 + t, y0 - o];
          B = o >= 0 ? [x0, y0 + t - o] : [x0 - o, y0 + t];
        }
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy);
        const g2 = gmm / 2;
        if (len > gmm + 0.5) {
          A = [A[0] + (dx / len) * g2, A[1] + (dy / len) * g2];
          B = [B[0] - (dx / len) * g2, B[1] - (dy / len) * g2];
          paths.push({ pts: [A, B], closed: false, layer: L });
        }
      }
    };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (fillP < 0.999 && hash2(c * 7 + 3, r * 13 + 5, p.seed + 77) > fillP) continue;
      const x0 = ox + c * t, y0 = oy + r * t;
      let probability=.5;
      if(p.patternMask){let value=0;const x=x0+t/2,y=y0+t/2,ps=ins[1]?.paths||[],img=node?.data?.img;for(const q of ps){if(!q.closed)continue;let hit=false;for(let i=0,j=q.pts.length-1;i<q.pts.length;j=i++){const a=q.pts[i],b=q.pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}if(hit)value=1-value;}if(!ps.length&&img?.g?.length===img.w*img.h)value=img.g[Math.max(0,Math.min(img.h-1,Math.floor(y/ctx.H*img.h)))*img.w+Math.max(0,Math.min(img.w-1,Math.floor(x/ctx.W*img.w)))];const bias=Math.max(0,Math.min(1,(+p.maskBias||0)/100));probability=(1-bias)/2+value*bias;}
      const flip = p.patternMask?hash2(c,r,p.seed)<probability:hash2(c,r,p.seed)>.5;
      if (p.ttype === "Arcs") {
        if (flip) { arc(x0, y0, 0); arc(x0 + t, y0 + t, Math.PI); }
        else { arc(x0 + t, y0, Math.PI / 2); arc(x0, y0 + t, -Math.PI / 2); }
      } else {
        diag(x0, y0, flip ? "\\" : "/");
      }
    }
    return applyStyle({ paths }, ins[0]);
  },
};
