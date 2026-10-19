import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
 key:'path_bend',name:'Path Bend',cat:'mod',group:'deform',
 desc:'Bend an entire drawing along one open or closed spine. Drawing X maps to distance along the spine, while Y becomes distance across it; Vertical swaps those roles. Fit to spine stretches the source length to the complete curve; Actual length keeps millimetres. Width scales the transverse direction. Start shifts along the curve, Reverse flips travel, and closed spines can wrap. Spine # chooses a single input path: separate paths are never bridged. Outside an open spine, the drawing continues along the endpoint tangent. Vertex tangents interpolate continuously across the spine. A centreline guide shows the selected spine. This is a geometric bend, so sharp spine corners can fold wide artwork. Source pens and closed paths survive. No crop or refit is applied. Sources above 20k paths / 120k points are rejected; dense sampling coarsens uniformly.',
 ins:[Pin('paths','Drawing'),Pin('paths','Spine')],outs:[Pin('paths')],
 params:[
  {key:'mode',label:'Length',type:'select',options:['Fit to spine','Actual length'],def:'Fit to spine'},
  {key:'axis',label:'Source axis',type:'select',options:['Horizontal','Vertical'],def:'Horizontal'},
  {key:'index',label:'Spine #',type:'slider',min:1,max:30,step:1,def:1},
  {key:'width',label:'Width %',type:'slider',min:1,max:200,step:1,def:100},
  {key:'offset',label:'Normal offset mm',type:'slider',min:-100,max:100,step:1,def:0},
  {key:'start',label:'Start %',type:'slider',min:-100,max:100,step:1,def:0},
  {key:'reverse',label:'Reverse',type:'check',def:false},
  {key:'wrap',label:'Wrap closed spine',type:'check',def:true},
  {key:'step',label:'Sample mm',type:'slider',min:.3,max:4,step:.1,def:1}
 ],
 overlay(p,c,ins){const ps=ins?.[1]?.paths||[],q=ps[Math.max(0,Math.min(ps.length-1,Math.round(+p.index||1)-1))];return q?.pts?.length>1?[{kind:'poly',pts:q.closed?[...q.pts,q.pts[0]]:q.pts}]:[];},
 compute(ins,p){
  const src=ins[0]||EMPTY,sp=ins[1]?.paths||[];if(!src.paths.length||!sp.length||src.paths.length>20000||src.paths.reduce((n,q)=>n+q.pts.length,0)>120000)return EMPTY;
  const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),q=sp[Math.min(sp.length-1,Math.round(n('index',1,1,1e5))-1)];if(!q||q.pts.length<2)return EMPTY;
  const base=[];for(const v of q.pts){if(!Number.isFinite(v[0]+v[1]))return EMPTY;if(!base.length||Math.hypot(v[0]-base.at(-1)[0],v[1]-base.at(-1)[1])>1e-9)base.push(v);}if(q.closed&&base.length>1&&Math.hypot(base[0][0]-base.at(-1)[0],base[0][1]-base.at(-1)[1])<1e-9)base.pop();if(base.length<2)return EMPTY;const line=q.closed?[...base,base[0]]:base,cum=[0];for(let i=1;i<line.length;i++)cum.push(cum[i-1]+Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]));const L=cum.at(-1);if(!(L>1e-8))return EMPTY;
  const axis=p.axis==='Vertical'?1:0;let lo=Infinity,hi=-Infinity,v0=Infinity,v1=-Infinity;for(const path of src.paths)for(const pt of path.pts){lo=Math.min(lo,pt[axis]);hi=Math.max(hi,pt[axis]);v0=Math.min(v0,pt[1-axis]);v1=Math.max(v1,pt[1-axis]);}
  const scale=p.mode==='Actual length'?1:L/Math.max(.001,hi-lo),width=n('width',100,1,500)/100,off=n('offset',0,-1000,1000),start=n('start',0,-1000,1000)/100*L;
  const directions=line.slice(1).map((q,i)=>{const L=Math.hypot(q[0]-line[i][0],q[1]-line[i][1]);return [(q[0]-line[i][0])/L,(q[1]-line[i][1])/L];}),tangents=line.map((point,i)=>{const a=i===0?(q.closed?directions.at(-1):directions[0]):directions[i-1],b=i===line.length-1?(q.closed?directions[0]:directions.at(-1)):directions[i],x=a[0]+b[0],y=a[1]+b[1],L=Math.hypot(x,y);return L>1e-8?[x/L,y/L]:b;});
  const at=(d,v)=>{if(q.closed&&p.wrap)d=((d%L)+L)%L;let i=0,j=cum.length-1;while(i+1<j){const m=(i+j)>>1;if(cum[m]<=d)i=m;else j=m;}i=Math.min(line.length-2,i);const a=line[i],b=line[i+1],len=Math.max(1e-10,cum[i+1]-cum[i]),t=(d-cum[i])/len,s=Math.max(0,Math.min(1,t)),ta=tangents[i],tb=tangents[i+1],xx=ta[0]*(1-s)+tb[0]*s,yy=ta[1]*(1-s)+tb[1]*s,norm=Math.hypot(xx,yy)||1,dx=xx/norm,dy=yy/norm;return [a[0]+(b[0]-a[0])*t-dy*v,a[1]+(b[1]-a[1])*t+dx*v];};
  const total=src.paths.reduce((v,q)=>v+pathLength(q.pts,q.closed),0),step=Math.max(n('step',1,.3,20),total/Math.max(1,110000-src.paths.length*2));
  return {paths:src.paths.map(path=>({...path,pts:resample(path.pts,path.closed,step).map(pt=>{let d=(pt[axis]-lo)*scale;if(p.reverse)d=L-d;return at(d+start,(pt[1-axis]-(v0+v1)/2)*width+off);})}))};
 }
};
