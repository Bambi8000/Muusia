import { Pin, pathLength } from "../helpers.js";

export default {
 key:'fragment_layout',name:'Fragment Layout',cat:'mod',group:'transform',
 desc:'Rearrange existing fragments without losing their internal contours. Group by explicit path.group identifiers, closed-outline containment, or individual paths. Containment assigns a path only when all its vertices and edge samples lie in an outer outline; crossing fragments stay separate. Explicit groups are the reliable option for overlapping illustrations. Row shelves and Columns use physical gap; Radial places groups on separated concentric rings. Sort by bounding area, total path length, direction or original order. Keep size leaves geometry at original millimetres and reports overflow; Fit page uniformly shrinks the complete arrangement when needed. Blend 0 preserves original coordinates, Blend 100 completes the layout; intermediate positions may overlap. Pen layers, path direction and extra point components are preserved.',
 ins:[Pin('paths','Fragments')],outs:[Pin('paths','Drawing'),Pin('value','Groups'),Pin('value','Overflow')],params:[
 {key:'groupBy',label:'Group by',type:'select',options:['Closed containment','Explicit group','Each path'],def:'Closed containment'},
 {key:'layout',label:'Layout',type:'select',options:['Row shelves','Columns','Radial'],def:'Row shelves'},
 {key:'sort',label:'Sort by',type:'select',options:['Original','Area','Length','Direction'],def:'Area'},
 {key:'descending',label:'Descending',type:'check',def:true,showIf:p=>p.sort!=='Original'},
 {key:'gap',label:'Gap mm',type:'slider',min:0,max:30,step:.5,def:6},
 {key:'sizing',label:'Sizing',type:'select',options:['Keep size','Fit page'],def:'Fit page'},
 {key:'blend',label:'Blend %',type:'slider',min:0,max:100,step:1,def:100},
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12}
 ],
 overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
 _groups(src,p){
  const paths=src.filter(q=>q.pts?.length>=2),box=ps=>{let x=Infinity,y=Infinity,X=-Infinity,Y=-Infinity;for(const q of ps)for(const a of q.pts){x=Math.min(x,a[0]);y=Math.min(y,a[1]);X=Math.max(X,a[0]);Y=Math.max(Y,a[1]);}return {x,y,w:X-x,h:Y-y};},poly=(q,ps)=>{let on=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])on=!on;}return on;},groups=[],map=new Map();
  if(p.groupBy==='Explicit group'){paths.forEach((q,i)=>{const k=q.group===undefined?'path:'+i:typeof q.group+':'+String(q.group);if(!map.has(k)){const g=[];map.set(k,g);groups.push(g);}map.get(k).push(q);});}
  else if(p.groupBy==='Each path')groups.push(...paths.map(q=>[q]));
  else {const bs=paths.map(q=>box([q])),order=paths.map((_,i)=>i).sort((a,b)=>bs[b].w*bs[b].h-bs[a].w*bs[a].h);for(const i of order){const q=paths[i],b=bs[i];let group=null;for(const g of groups){const outer=g[0],bb=box([outer]);if(!outer.closed||b.x<bb.x-1e-7||b.y<bb.y-1e-7||b.x+b.w>bb.x+bb.w+1e-7||b.y+b.h>bb.y+bb.h+1e-7)continue;const samples=[];for(let k=0;k<q.pts.length;k++){const a=q.pts[k],d=q.pts[(k+1)%q.pts.length];samples.push(a);if(k<q.pts.length-1||q.closed)for(let j=1;j<8;j++)samples.push([a[0]+(d[0]-a[0])*j/8,a[1]+(d[1]-a[1])*j/8]);}if(samples.every(a=>poly(a,outer.pts))){group=g;break;}}if(group)group.push(q);else groups.push([q]);}}
  return groups.map((ps,id)=>{const b=box(ps),q=ps[0],a=q.pts[0],d=q.pts.at(-1);return {ps,id,...b,area:b.w*b.h,length:ps.reduce((s,q)=>s+pathLength(q.pts,q.closed),0),direction:Math.atan2(d[1]-a[1],d[0]-a[0])};});
 },
 compute(ins,p,c){const source=ins[0]?.paths||[];if(!source.length)return [{paths:[]},0,0];const groups=this._groups(source,p),m=Math.max(0,+p.margin||0),W=c.W-2*m,H=c.H-2*m,gap=Math.max(0,+p.gap||0),blend=Math.max(0,Math.min(1,(+p.blend||0)/100));if(blend===0)return [{paths:source.map(q=>({...q,pts:q.pts.map(a=>a.slice())}))},groups.length,+(source.some(q=>q.pts.some(a=>a[0]<m||a[0]>c.W-m||a[1]<m||a[1]>c.H-m)))];if(!(W>0&&H>0))return [{paths:[]},groups.length,1];const order=groups.slice(),sort=p.sort==='Area'?'area':p.sort==='Length'?'length':p.sort==='Direction'?'direction':null;if(sort)order.sort((a,b)=>(p.descending?-1:1)*(a[sort]-b[sort])||a.id-b.id);
  let x=0,y=0,row=0,maxX=0,maxY=0;
  if(p.layout==='Radial'){let radius=0,used=0,ringSize=0;for(const g of order){const r=Math.hypot(g.w,g.h)/2+gap/2;if(radius===0){g.tx=-g.w/2;g.ty=-g.h/2;radius=r;continue;}const R=radius+r;if(used+2*Math.asin(Math.min(1,r/Math.max(r,R)))>Math.PI*2){radius+=2*ringSize;used=0;ringSize=0;}const rr=radius+r,angle=2*Math.asin(Math.min(1,r/rr));used+=angle/2;g.tx=Math.cos(used)*rr-g.w/2;g.ty=Math.sin(used)*rr-g.h/2;used+=angle/2;ringSize=Math.max(ringSize,r);}}
  else for(const g of order){const a=p.layout==='Columns'?g.h:g.w,b=p.layout==='Columns'?g.w:g.h,limit=p.layout==='Columns'?H:W;if(x>0&&x+a>limit){x=0;y+=row+gap;row=0;}g.tx=p.layout==='Columns'?y:x;g.ty=p.layout==='Columns'?x:y;x+=a+gap;row=Math.max(row,b);}
  let loX=Infinity,loY=Infinity,hiX=-Infinity,hiY=-Infinity;for(const g of groups){loX=Math.min(loX,g.tx);loY=Math.min(loY,g.ty);hiX=Math.max(hiX,g.tx+g.w);hiY=Math.max(hiY,g.ty+g.h);}maxX=hiX-loX;maxY=hiY-loY;const fit=p.sizing==='Fit page'?Math.min(1,W/Math.max(.001,maxX),H/Math.max(.001,maxY)):1,ox=m+(W-maxX*fit)/2,oy=m+(H-maxY*fit)/2,paths=[];
  for(const g of groups)for(const q of g.ps)paths.push({...q,pts:q.pts.map(a=>{const b=a.slice();b[0]=a[0]*(1-blend)+(ox+(g.tx-loX+a[0]-g.x)*fit)*blend;b[1]=a[1]*(1-blend)+(oy+(g.ty-loY+a[1]-g.y)*fit)*blend;return b;})});const overflow=+(paths.some(q=>q.pts.some(a=>a[0]<m-1e-6||a[0]>c.W-m+1e-6||a[1]<m-1e-6||a[1]>c.H-m+1e-6)));return [{paths},groups.length,overflow];
 }
};
