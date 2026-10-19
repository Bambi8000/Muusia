import { Pin, EMPTY, mulberry32 } from "../helpers.js";

export default {
 key:'shape_packing',name:'Shape Packing',cat:'duo',
 desc:'Pack copies of your Motif inside a closed Region, leaving Clearance between them and the boundary. Unwired Region uses the margin rectangle. Region contours use even-odd parity, so holes remain empty. Motif paths keep their pens. Packing uses conservative convex envelopes (a rectangle for exceptionally complex hulls), so open or concave motifs may leave more space than their ink alone requires. Rotations and sizes are seeded; the requested Copies is an upper bound and fewer may fit. Entire envelopes must fit: no motifs are cut at the edge. Search is bounded and stops after a fixed number of attempts. Adjust Largest size, Size variation or Clearance for denser packing. Maximum motif source 12k points / 2k paths, region 12k points.',
 ins:[Pin('paths','Motif'),Pin('paths','Region')],outs:[Pin('paths')],
 params:[
  {key:'count',label:'Copies',type:'slider',min:1,max:160,step:1,def:35},
  {key:'size',label:'Largest size mm',type:'slider',min:2,max:100,step:1,def:25},
  {key:'vary',label:'Size variation %',type:'slider',min:0,max:85,step:1,def:50},
  {key:'rotate',label:'Rotation variation °',type:'slider',min:0,max:180,step:1,def:180},
  {key:'gap',label:'Clearance mm',type:'slider',min:0,max:15,step:.2,def:2},
  {key:'keep',label:'Draw region',type:'check',def:false},
  {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
  {key:'seed',label:'Seed',type:'seed',def:37}
 ],
 overlay(p,c,ins){const r=ins?.[1]?.paths?.filter(q=>q.closed)||[];return r.length?r.slice(0,100).map(q=>({kind:'poly',pts:[...q.pts,q.pts[0]]})):[{kind:'rect',x:p.margin,y:p.margin,w:c.W-2*p.margin,h:c.H-2*p.margin}];},
 compute(ins,p,c){
  const src=ins[0]||EMPTY;if(!src.paths.length||src.paths.length>2000||src.paths.reduce((n,q)=>n+q.pts.length,0)>12000)return EMPTY;
  const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),m=n('margin',12,0,Math.min(c.W,c.H)/2),rng=mulberry32(Math.round(n('seed',37,-2e9,2e9))),gap=n('gap',2,0,100),count=Math.round(n('count',35,1,160));if(c.W<=2*m||c.H<=2*m)return EMPTY;
  const reg=(ins[1]?.paths||[]).filter(q=>q.closed&&q.pts.length>=3);if(reg.reduce((v,q)=>v+q.pts.length,0)>12000)return EMPTY;const rings=reg.length?reg.map(q=>q.pts):[[[m,m],[c.W-m,m],[c.W-m,c.H-m],[m,c.H-m]]];
  const cross=(a,b,d)=>(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
  const poly=(pt,ps)=>{let v=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;};
  const inside=pt=>rings.reduce((v,r)=>v!==poly(pt,r),false);
  const dist=(a,b,x)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x[0]-a[0])*dx+(x[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x[0]-a[0]-t*dx,x[1]-a[1]-t*dy);};
  const hit=(a,b,d,e)=>{const aa=cross(a,b,d),bb=cross(a,b,e),dd=cross(d,e,a),ee=cross(d,e,b);return aa*bb<=0&&dd*ee<=0&&Math.max(Math.min(a[0],b[0]),Math.min(d[0],e[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(d[0],e[0]))+1e-9&&Math.max(Math.min(a[1],b[1]),Math.min(d[1],e[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(d[1],e[1]))+1e-9;};
  let pts=src.paths.flatMap(q=>q.pts);if(pts.some(q=>!q.every(Number.isFinite)))return EMPTY;const sorted=pts.map(q=>q.slice(0,2)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),chain=xs=>{const a=[];for(const x of xs){while(a.length>1&&cross(a.at(-2),a.at(-1),x)<=0)a.pop();a.push(x);}return a;};
  let hull=[...chain(sorted).slice(0,-1),...chain([...sorted].reverse()).slice(0,-1)];let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y]of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}const span=Math.max(x1-x0,y1-y0);if(span<1e-8)return EMPTY;
  if(hull.length<3||hull.length>256)hull=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const cx=(x0+x1)/2,cy=(y0+y1)/2;let rx0=Infinity,ry0=Infinity,rx1=-Infinity,ry1=-Infinity;for(const r of rings)for(const [x,y]of r){rx0=Math.min(rx0,x);rx1=Math.max(rx1,x);ry0=Math.min(ry0,y);ry1=Math.max(ry1,y);}rx0=Math.max(m,rx0);ry0=Math.max(m,ry0);rx1=Math.min(c.W-m,rx1);ry1=Math.min(c.H-m,ry1);
  const separated=(a,b)=>{for(const list of [a,b])for(let i=0;i<list.length;i++){const A=list[i],B=list[(i+1)%list.length],dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy);if(L<1e-9)continue;const nx=-dy/L,ny=dx/L;let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const q of a){const v=q[0]*nx+q[1]*ny;amin=Math.min(amin,v);amax=Math.max(amax,v);}for(const q of b){const v=q[0]*nx+q[1]*ny;bmin=Math.min(bmin,v);bmax=Math.max(bmax,v);}if(amin-bmax>gap||bmin-amax>gap)return true;}return false;};
  const placed=[],out=[];let budget=0,tests=0;
  search:for(let attempt=0;attempt<Math.min(16000,count*180)&&placed.length<count;attempt++){
   const scale=n('size',25,1,500)/span*(1-rng()*n('vary',50,0,95)/100),a=(rng()-.5)*2*n('rotate',180,0,360)*Math.PI/180,co=Math.cos(a),si=Math.sin(a),ox=rx0+rng()*(rx1-rx0),oy=ry0+rng()*(ry1-ry0),map=q=>[ox+((q[0]-cx)*co-(q[1]-cy)*si)*scale,oy+((q[0]-cx)*si+(q[1]-cy)*co)*scale],hh=hull.map(map);
   if(hh.some(q=>q[0]<m+gap||q[0]>c.W-m-gap||q[1]<m+gap||q[1]>c.H-m-gap||!inside(q)))continue;
   let bad=false;for(const ring of rings){for(let i=0;i<hh.length&&!bad;i++)for(let j=0;j<ring.length;j++){if(++tests>3000000)break search;const A=hh[i],B=hh[(i+1)%hh.length],D=ring[j],E=ring[(j+1)%ring.length];if(hit(A,B,D,E)||Math.min(dist(A,B,D),dist(A,B,E),dist(D,E,A),dist(D,E,B))<gap-1e-8){bad=true;break;}}if(ring.some(q=>poly(q,hh)))bad=true;if(bad)break;}
   if(bad||placed.some(q=>!separated(q,hh)))continue;
   if(budget+pts.length>118000)break;placed.push(hh);budget+=pts.length;for(const q of src.paths)out.push({...q,pts:q.pts.map(map)});
  }
  return {paths:p.keep?[...out,...reg]:out};
 }
};
