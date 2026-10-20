import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
 key:'tessellation',name:'Tessellation',cat:'gen',group:'geometric',
 desc:'Shared-edge tilings, not overlapping stamps. Rhombus projects the stepped surface of a monotone cube pile; seeded legal cube flips change the lozenge pattern without gaps. Floret uses six pentagons around each flower centre: each pentagon has one 60° and four 120° corners. Cell edge is requested millimetres; the complete Rhombus hexagon shrinks uniformly if needed to fit Margin. Floret fills the page at the requested scale, with a minimum scale for dense jobs. Edges draws each shared edge once; Inset bands draws nested contours inside each tile. Both combines the two. Colours assigns pens by tile orientation. A wired Region clips the linework exactly, preserving even-odd holes; clipped contours can become open paths. No region means the paper margin.',
 ins:[Pin('style','Style'),Pin('paths','Region')],outs:[Pin('paths','Drawing')],
 params:[
 {key:'family',label:'Family',type:'select',options:['Rhombus','Floret'],def:'Rhombus'},
 {key:'cell',label:'Cell edge mm',type:'slider',min:3,max:30,step:.5,def:9},
 {key:'cells',label:'Cells per side',type:'slider',min:2,max:18,step:1,def:7,showIf:p=>p.family==='Rhombus'},
 {key:'flips',label:'Flip attempts',type:'slider',min:0,max:12000,step:100,def:3500,showIf:p=>p.family==='Rhombus'},
 {key:'drawing',label:'Drawing',type:'select',options:['Edges','Inset bands','Both'],def:'Inset bands'},
 {key:'bands',label:'Inset bands',type:'slider',min:1,max:8,step:1,def:3,showIf:p=>p.drawing!=='Edges'},
 {key:'inset',label:'Inset step mm',type:'slider',min:.2,max:4,step:.1,def:.7,showIf:p=>p.drawing!=='Edges'},
 {key:'angle',label:'Angle °',type:'slider',min:-180,max:180,step:1,def:0},
 {key:'colours',label:'Colours',type:'slider',min:1,max:4,step:1,def:3},
 {key:'layer',label:'Pen 1',type:'pen',def:0},
 ...[2,3,4].map(n=>({key:'pen'+n,label:'Pen '+n,type:'pen',def:n===2?1:n===3?2:6,showIf:p=>p.colours>=n})),
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
 {key:'seed',label:'Seed',type:'seed',def:42,showIf:p=>p.family==='Rhombus'}
 ],
 overlay(p,c,ins){const ps=ins?.[1]?.paths?.filter(q=>q.closed)||[];return ps.length?ps.slice(0,80).map(q=>({kind:'poly',pts:[...q.pts,q.pts[0]]})):[{kind:'rect',x:p.margin,y:p.margin,w:c.W-2*p.margin,h:c.H-2*p.margin}];},
 _tiles(p,c){
 const num=(v,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+v)?+v:d)),m=num(p.margin,12,0,Math.min(c.W,c.H)/2),W=c.W-2*m,H=c.H-2*m;if(W<=0||H<=0)return [];
 const n=Math.round(num(p.cells,7,2,20)),tiles=[],a=num(p.angle,0,-1e6,1e6)*Math.PI/180,co=Math.cos(a),si=Math.sin(a),rotate=q=>[q[0]*co-q[1]*si,q[0]*si+q[1]*co],project=(i,j,z)=>[(i-j)*Math.sqrt(3)/2,(i+j)/2-z];
 let size=num(p.cell,9,2,100);
 if(p.family!=='Floret'){
  const h=Array.from({length:n},()=>new Int16Array(n)),rng=mulberry32(num(p.seed,42,-2e9,2e9)),attempts=Math.round(num(p.flips,3500,0,50000));
  for(let k=0;k<attempts;k++){const i=Math.floor(rng()*n),j=Math.floor(rng()*n),up=rng()<.58;
   if(up){const cap=Math.min(i?h[i-1][j]:n,j?h[i][j-1]:n);if(h[i][j]<cap)h[i][j]++;}
   else{const floor=Math.max(i<n-1?h[i+1][j]:0,j<n-1?h[i][j+1]:0);if(h[i][j]>floor)h[i][j]--;}
  }
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
   const z=h[i][j];tiles.push({orientation:0,pts:[[i,j,z],[i+1,j,z],[i+1,j+1,z],[i,j+1,z]].map(q=>project(...q))});
   for(let k=z;k<(i?h[i-1][j]:n);k++)tiles.push({orientation:1,pts:[[i,j,k],[i,j+1,k],[i,j+1,k+1],[i,j,k+1]].map(q=>project(...q))});
   for(let k=z;k<(j?h[i][j-1]:n);k++)tiles.push({orientation:2,pts:[[i,j,k],[i+1,j,k],[i+1,j,k+1],[i,j,k+1]].map(q=>project(...q))});
  }
  for(let j=0;j<n;j++)for(let k=0;k<h[n-1][j];k++)tiles.push({orientation:1,pts:[[n,j,k],[n,j+1,k],[n,j+1,k+1],[n,j,k+1]].map(q=>project(...q))});
  for(let i=0;i<n;i++)for(let k=0;k<h[i][n-1];k++)tiles.push({orientation:2,pts:[[i,n,k],[i+1,n,k],[i+1,n,k+1],[i,n,k+1]].map(q=>project(...q))});
  const all=tiles.flatMap(t=>t.pts.map(rotate)),xs=all.map(q=>q[0]),ys=all.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);size=Math.min(size,W/(x1-x0),H/(y1-y0));
  return tiles.map(t=>({...t,pts:t.pts.map(rotate).map(q=>[c.W/2+(q[0]-(x0+x1)/2)*size,c.H/2+(q[1]-(y0+y1)/2)*size])}));
 }
 size=Math.max(size,Math.sqrt(W*H/1600));const R=Math.hypot(W,H)/2/size+6,N=Math.ceil(R/3)+2,base=[[0,0],[2,0],[2.5,Math.sqrt(3)/2],[2,Math.sqrt(3)],[1,Math.sqrt(3)]];
 for(let i=-N;i<=N;i++)for(let j=-N;j<=N;j++){
  const cx=4.5*i+1.5*j,cy=Math.sqrt(3)/2*i+2.5*Math.sqrt(3)*j;if(Math.hypot(cx,cy)>R)continue;
  for(let k=0;k<6;k++){const t=k*Math.PI/3,C=Math.cos(t),S=Math.sin(t),pts=base.map(q=>rotate([cx+q[0]*C-q[1]*S,cy+q[0]*S+q[1]*C])).map(q=>[c.W/2+q[0]*size,c.H/2+q[1]*size]);
   if(pts.every(q=>q[0]<m)||pts.every(q=>q[0]>c.W-m)||pts.every(q=>q[1]<m)||pts.every(q=>q[1]>c.H-m))continue;tiles.push({pts,orientation:k});}
 }return tiles;
 },
 _inset(pts,d){
 let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[1]-b[0]*a[1];}const sign=area>=0?1:-1,lines=pts.map((a,i)=>{const b=pts[(i+1)%pts.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);return {a:[a[0]-sign*dy/L*d,a[1]+sign*dx/L*d],d:[dx,dy]};}),out=[];
 for(let i=0;i<lines.length;i++){const u=lines[(i+lines.length-1)%lines.length],v=lines[i],den=u.d[0]*v.d[1]-u.d[1]*v.d[0];if(Math.abs(den)<1e-9)return null;const dx=v.a[0]-u.a[0],dy=v.a[1]-u.a[1],t=(dx*v.d[1]-dy*v.d[0])/den;out.push([u.a[0]+t*u.d[0],u.a[1]+t*u.d[1]]);}
 for(const q of out)for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if(sign*((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]))<-1e-7)return null;}
 let a2=0;for(let i=0;i<out.length;i++){const a=out[i],b=out[(i+1)%out.length];a2+=a[0]*b[1]-b[0]*a[1];}return Math.abs(a2)>.005&&a2*area>0?out:null;
 },
 _clip(paths,p,c,ins){
 const m=Math.max(0,Math.min(Math.min(c.W,c.H)/2,+p.margin||0)),polys=(ins?.[1]?.paths||[]).filter(q=>q.closed&&q.pts?.length>=3);if(polys.reduce((a,q)=>a+q.pts.length,0)>4000)return [];
 const boundary=polys.flatMap(q=>q.pts.map((a,i)=>[a,q.pts[(i+1)%q.pts.length]])),rect=[[m,m],[c.W-m,m],[c.W-m,c.H-m],[m,c.H-m]],edges=[...boundary,...rect.map((q,i)=>[q,rect[(i+1)%4]])],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],inside=q=>{if(q[0]<m-1e-8||q[0]>c.W-m+1e-8||q[1]<m-1e-8||q[1]>c.H-m+1e-8)return false;if(!boundary.length)return true;let b=false;for(const [a,d]of boundary)if((a[1]>q[1])!==(d[1]>q[1])&&q[0]<(d[0]-a[0])*(q[1]-a[1])/(d[1]-a[1])+a[0])b=!b;return b;},out=[];
 for(const q of paths){let run=[],pieces=[],cut=false;const flush=()=>{if(run.length>1)pieces.push({pts:run,closed:false,layer:q.layer});run=[];};
  for(let k=0;k<q.pts.length-(q.closed?0:1);k++){const a=q.pts[k],b=q.pts[(k+1)%q.pts.length],d=[b[0]-a[0],b[1]-a[1]],ts=[0,1];for(const [u,v]of edges){const e=[v[0]-u[0],v[1]-u[1]],den=cross(d,e);if(Math.abs(den)<1e-10)continue;const w=[u[0]-a[0],u[1]-a[1]],t=cross(w,e)/den,s=cross(w,d)/den;if(t>1e-9&&t<1-1e-9&&s>=0&&s<=1)ts.push(t);}ts.sort((a,b)=>a-b);
   for(let j=1;j<ts.length;j++){const t0=ts[j-1],t1=ts[j];if(t1-t0<1e-9)continue;const at=t=>[a[0]+d[0]*t,a[1]+d[1]*t];if(!inside(at((t0+t1)/2))){cut=true;flush();continue;}const x=at(t0),y=at(t1);if(run.length&&Math.hypot(run.at(-1)[0]-x[0],run.at(-1)[1]-x[1])>1e-6)flush();if(!run.length)run.push(x);run.push(y);}
  }flush();if(!cut)out.push(q);else out.push(...pieces);
 }return out;
 },
 compute(ins,p,c){
 const tiles=this._tiles(p,c),paths=[],nc=Math.max(1,Math.min(4,Math.round(+p.colours||1))),pens=[p.layer??0,p.pen2??1,p.pen3??2,p.pen4??6].map(v=>Math.max(0,Math.min(11,Math.round(+v||0)))),seen=new Set(),bands=Math.max(1,Math.min(8,Math.round(+p.bands||3))),step=Math.max(.2,Math.min(20,+p.inset||.7)),key=q=>q.map(v=>Math.round(v*1e6)).join(',');
 for(const t of tiles){const layer=pens[t.orientation%nc];
  if(p.drawing!=='Inset bands')for(let i=0;i<t.pts.length;i++){const a=t.pts[i],b=t.pts[(i+1)%t.pts.length],ka=key(a),kb=key(b),k=ka<kb?ka+'|'+kb:kb+'|'+ka;if(!seen.has(k)){seen.add(k);paths.push({pts:[a,b],closed:false,layer});}}
  if(p.drawing!=='Edges')for(let j=1;j<=bands;j++){const pts=this._inset(t.pts,j*step);if(!pts)break;paths.push({pts,closed:true,layer});}
 }return applyStyle({paths:this._clip(paths,p,c,ins)},ins?.[0]);
 }
};
