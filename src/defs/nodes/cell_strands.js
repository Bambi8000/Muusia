import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
 key:'cell_strands',name:'Cell Strands',cat:'gen',group:'geometric',
 desc:'Parallel strands travel through a shared distorted cell network. Hex strands routes edge bundles through convex hexagons; Ribbon cells uses square cells. Every shared edge uses the same stations, so adjacent bundles meet exactly when both routes reach it. Carry adds routes to otherwise unused cell edges; Density leaves some cells empty. Cell edges is an optional separate pen. Displacement is uniformly reduced until all cells remain convex and inside the margin. Phase moves the deformation in a repeatable loop. Paths may cross inside cells; this is a strand network, not an over/under weave.',
 ins:[Pin('style','Style')],outs:[Pin('paths','Drawing')],
 params:[
 {key:'mode',label:'Cells',type:'select',options:['Hex strands','Ribbon cells'],def:'Hex strands'},
 {key:'cell',label:'Cell size mm',type:'slider',min:8,max:60,step:1,def:25},
 {key:'strands',label:'Strands per bundle',type:'slider',min:1,max:18,step:1,def:7},
 {key:'deform',label:'Displacement %',type:'slider',min:0,max:100,step:1,def:45},
 {key:'fieldSize',label:'Field size mm',type:'slider',min:10,max:180,step:1,def:55,showIf:p=>p.deform>0},
 {key:'phase',label:'Field phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.deform>0},
 {key:'curve',label:'Curve %',type:'slider',min:0,max:100,step:1,def:65},
 {key:'density',label:'Occupied cells %',type:'slider',min:0,max:100,step:1,def:80},
 {key:'carry',label:'Extra routes %',type:'slider',min:0,max:100,step:1,def:35},
 {key:'edges',label:'Cell edges',type:'check',def:true},
 {key:'edgePen',label:'Edge pen',type:'pen',def:7,showIf:p=>p.edges},
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:15},
 {key:'seed',label:'Seed',type:'seed',def:31},
 {key:'layer',label:'Strand pen',type:'pen',def:0}
 ],
 overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
 _network(p,c){
  const num=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),m=num('margin',15,0,Math.min(c.W,c.H)/2),w=c.W-2*m,h=c.H-2*m;if(w<2||h<2)return null;
  const n=Math.round(num('strands',7,1,24)),size=Math.max(num('cell',25,4,200),Math.sqrt(w*h*n*70/85000)),base=[],index=new Map(),cells=[],key=q=>q.map(x=>Math.round(x*1e6)).join(','),vertex=q=>{const k=key(q);if(!index.has(k)){index.set(k,base.length);base.push(q);}return index.get(k);};
  if(p.mode==='Ribbon cells'){
   const cols=Math.max(1,Math.floor(w/size)),rows=Math.max(1,Math.floor(h/size)),dx=w/cols,dy=h/rows;
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)cells.push([[m+x*dx,m+y*dy],[m+(x+1)*dx,m+y*dy],[m+(x+1)*dx,m+(y+1)*dy],[m+x*dx,m+(y+1)*dy]].map(vertex));
  }else{
   const R=Math.min(size/Math.sqrt(3),w/Math.sqrt(3),h/2),dx=Math.sqrt(3)*R,dy=1.5*R,cols=Math.ceil(w/dx),rows=Math.ceil(h/dy);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const cx=m+dx/2+x*dx+(y%2)*dx/2,cy=m+R+y*dy,pts=Array.from({length:6},(_,k)=>[cx+R*Math.cos(Math.PI/6+k*Math.PI/3),cy+R*Math.sin(Math.PI/6+k*Math.PI/3)]);
    if(pts.every(q=>q[0]>=m-1e-7&&q[0]<=c.W-m+1e-7&&q[1]>=m-1e-7&&q[1]<=c.H-m+1e-7))cells.push(pts.map(vertex));
   }
  }
  if(!cells.length)return null;
  const phase=num('phase',0,-1e5,1e5)*Math.PI/180,sc=num('fieldSize',55,1,500),amp=size*num('deform',45,0,200)/100,seed=num('seed',31,-2e9,2e9),shift=base.map(q=>{const fade=Math.min(1,Math.max(0,Math.min(q[0]-m,c.W-m-q[0],q[1]-m,c.H-m-q[1]))/size);return [(2*noise2(q[0]/sc+Math.cos(phase),q[1]/sc+Math.sin(phase),seed)-1)*amp*fade,(2*noise2(q[0]/sc+11+Math.cos(phase),q[1]/sc+Math.sin(phase),seed+13)-1)*amp*fade];});
  const build=f=>base.map((q,i)=>q.map((x,k)=>x+shift[i][k]*f));let vertices=build(1),factor=1;
  const convex=v=>cells.every(ids=>ids.every((id,i)=>{const A=v[id],B=v[ids[(i+1)%ids.length]],C=v[ids[(i+2)%ids.length]];return (B[0]-A[0])*(C[1]-B[1])-(B[1]-A[1])*(C[0]-B[0])>1e-6&&A[0]>=m-1e-6&&A[0]<=c.W-m+1e-6&&A[1]>=m-1e-6&&A[1]<=c.H-m+1e-6;}));
  while(!convex(vertices)&&factor>1e-6){factor*=.8;vertices=build(factor);}
  return {vertices,cells,n,m,factor};
 },
 compute(ins,p,c){
  const net=this._network(p,c);if(!net)return {paths:[]};const {vertices:v,cells,n}=net,paths=[],edges=new Set(),seed=Math.round(+p.seed||0),layer=Math.max(0,Math.min(11,Math.round(+p.layer||0))),edgeLayer=Math.max(0,Math.min(11,Math.round(+p.edgePen||0))),density=Math.max(0,Math.min(1,+p.density/100||0)),carry=Math.max(0,Math.min(1,+p.carry/100||0)),curve=Math.max(0,Math.min(1,+p.curve/100||0));
  const station=(a,b,k)=>{if(a>b)[a,b]=[b,a];const t=(k+.5)/n;return [v[a][0]+(v[b][0]-v[a][0])*t,v[a][1]+(v[b][1]-v[a][1])*t];};
  for(let i=0;i<cells.length;i++){
   const ids=cells[i],N=ids.length,center=ids.reduce((a,id)=>[a[0]+v[id][0]/N,a[1]+v[id][1]/N],[0,0]);
   if(p.edges)for(let j=0;j<N;j++){const a=ids[j],b=ids[(j+1)%N],key=a<b?a+','+b:b+','+a;if(!edges.has(key)){edges.add(key);paths.push({pts:[v[a],v[b]],closed:false,layer:edgeLayer});}}
   if(hash2(i,7,seed)>density)continue;
   const order=Array.from({length:N},(_,j)=>j).sort((a,b)=>hash2(i,a+21,seed)-hash2(i,b+21,seed));
   const pairs=p.mode==='Ribbon cells'?[[order[0],order[1]],[order[2],order[3]]]:[[order[0],order[1]],[order[2],order[3]],[order[4],order[5]]];
   for(let j=0;j<pairs.length;j++){
    if(j>0&&hash2(i,j+44,seed)>carry)continue;const [ea,eb]=pairs[j];
    const aa=station(ids[ea],ids[(ea+1)%N],0),bb=station(ids[eb],ids[(eb+1)%N],0),bc=station(ids[eb],ids[(eb+1)%N],n-1),reverse=Math.hypot(aa[0]-bc[0],aa[1]-bc[1])<Math.hypot(aa[0]-bb[0],aa[1]-bb[1]);
    for(let k=0;k<n;k++){
     const a=station(ids[ea],ids[(ea+1)%N],k),b=station(ids[eb],ids[(eb+1)%N],reverse?n-1-k:k),c1=[a[0]+(center[0]-a[0])*curve,a[1]+(center[1]-a[1])*curve],c2=[b[0]+(center[0]-b[0])*curve,b[1]+(center[1]-b[1])*curve],pts=Array.from({length:13},(_,j)=>{const t=j/12,u=1-t;return [u*u*u*a[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*b[0],u*u*u*a[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*b[1]];});paths.push({pts,closed:false,layer});
    }
   }
  }
  let style=ins[0],out=applyStyle({paths},style);for(let k=0;k<12&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;k++){style={...style,dash:Math.max(.1,+style?.dash||4)*2,gap:Math.max(.1,+style?.gap||3)*2};out=applyStyle({paths},style);}return out;
 }
};
