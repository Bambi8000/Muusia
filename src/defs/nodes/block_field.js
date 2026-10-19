import { Pin, hash2, noise2, applyStyle } from "../helpers.js";

export default {
 key:'block_field',name:'Block Field',cat:'gen',group:'geometric',
 desc:'A real 3D column terrain or scattered cube field. Heights come from coherent Noise or a loaded Image darkness map. Terraces quantizes heights; zero means smooth heights. Cell gap separates columns. Drawing shows visible faces with outlines or paper-spaced hatching and raster hidden-line removal. Mesh contains complete closed blocks, centred and normalized by the standard mesh contract, for Mesh Render, Mesh Slice and 3D Spikes. View angle/elevation change Drawing only; downstream mesh consumers use their own camera. Phase shifts noise in a deterministic loop. Dense hatch counts and line sampling coarsen across the whole field. Image requires a loaded file. Preview uses a fixed bounding envelope across noise motion; Mesh normalization can change as actual bounds change.',
 ins:[Pin('style','Style')],outs:[Pin('paths','Drawing'),Pin('mesh','Mesh')],fileImage:true,
 params:[
 {key:'mode',label:'Layout',type:'select',options:['Column terrain','Scattered cubes'],def:'Column terrain'},
 {key:'heightSource',label:'Heights',type:'select',options:['Noise','Image'],def:'Noise'},
 {key:'file',label:'Height image',type:'file',showIf:p=>p.heightSource==='Image'},
 {key:'cols',label:'Columns',type:'slider',min:2,max:30,step:1,def:14},
 {key:'rows',label:'Rows',type:'slider',min:2,max:30,step:1,def:12},
 {key:'height',label:'Height × cell',type:'slider',min:.2,max:12,step:.1,def:5},
 {key:'terraces',label:'Height steps (0 = smooth)',type:'slider',min:0,max:20,step:1,def:7},
 {key:'noiseSize',label:'Noise size cells',type:'slider',min:1,max:20,step:.5,def:6,showIf:p=>p.heightSource!=='Image'},
 {key:'phase',label:'Noise phase °',type:'slider',min:0,max:360,step:1,def:0,showIf:p=>p.heightSource!=='Image'},
 {key:'gap',label:'Cell gap %',type:'slider',min:0,max:80,step:1,def:8},
 {key:'occupancy',label:'Occupied cells %',type:'slider',min:5,max:100,step:1,def:70,showIf:p=>p.mode==='Scattered cubes'},
 {key:'drawing',label:'Drawing',type:'select',options:['Outlines','Face hatch'],def:'Outlines'},
 {key:'hatch',label:'Hatch gap mm',type:'slider',min:.5,max:4,step:.25,def:1.5,showIf:p=>p.drawing==='Face hatch'},
 {key:'hidden',label:'Hidden-line removal',type:'check',def:true},
 {key:'yaw',label:'View angle °',type:'slider',min:-180,max:180,step:1,def:35},
 {key:'elevation',label:'View elevation °',type:'slider',min:5,max:90,step:1,def:32},
 {key:'size',label:'Preview size mm',type:'slider',min:30,max:420,step:1,def:230},
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:15},
 {key:'seed',label:'Seed',type:'seed',def:19},
 {key:'layer',label:'Pen',type:'pen',def:0}
 ],
 overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
 _scene(p,node){
  const num=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),nx=Math.round(num('cols',14,2,32)),ny=Math.round(num('rows',12,2,32)),height=num('height',5,.1,20),gap=num('gap',8,0,90)/100,terraces=Math.round(num('terraces',7,0,40)),phase=num('phase',0,-1e5,1e5)*Math.PI/180,scale=num('noiseSize',6,.3,80),seed=Math.round(num('seed',19,-2e9,2e9)),img=node?.data?.img;
  if(p.heightSource==='Image'&&(!img||!Number.isFinite(img.w)||!Number.isFinite(img.h)||img.w<1||img.h<1||img.g?.length!==img.w*img.h))return null;
  const blocks=[];
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   if(p.mode==='Scattered cubes'&&hash2(x,y,seed)>num('occupancy',70,0,100)/100)continue;
   let value;if(p.heightSource==='Image'){const ix=Math.min(img.w-1,Math.floor((x+.5)/nx*img.w)),iy=Math.min(img.h-1,Math.floor((y+.5)/ny*img.h));value=Math.max(0,Math.min(1,+img.g[iy*img.w+ix]||0));}
   else value=Math.max(0,Math.min(1,noise2(x/scale+Math.cos(phase),y/scale+Math.sin(phase),seed)));
   if(terraces>0)value=Math.round(value*terraces)/terraces;
   const z=.15+value*height,cx=x-(nx-1)/2,cy=y-(ny-1)/2,h=.5*(1-gap),bottom=p.mode==='Scattered cubes'?z:0,top=p.mode==='Scattered cubes'?z+2*h:z;
   blocks.push({lo:[cx-h,cy-h,bottom],hi:[cx+h,cy+h,top]});
  }
  return {blocks,nx,ny,height};
 },
 compute(ins,p,c,node){
  const scene=this._scene(p,node);if(!scene||!scene.blocks.length)return [{paths:[]},null];
  const num=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),{blocks,nx,ny,height}=scene,faces=[],tri=[],edges=new Map(),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],pen=Math.round(num('layer',0,0,11));
  const faceIds=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  for(const b of blocks){const a=b.lo,z=b.hi,v=[[a[0],a[1],a[2]],[z[0],a[1],a[2]],[z[0],z[1],a[2]],[a[0],z[1],a[2]],[a[0],a[1],z[2]],[z[0],a[1],z[2]],[z[0],z[1],z[2]],[a[0],z[1],z[2]]];
   for(const q of v)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],q[k]);hi[k]=Math.max(hi[k],q[k]);}
   for(const ids of faceIds){const f=ids.map(i=>v[i]);faces.push(f);tri.push(...f[0],...f[1],...f[2],...f[0],...f[2],...f[3]);}
  }
  const maxDim=Math.max(...hi.map((x,k)=>x-lo[k])),centre=lo.map((x,k)=>(x+hi[k])/2),mesh={kind:'mesh',tri:tri.length/9,v:tri.map((x,i)=>Math.round((x-centre[i%3])/maxDim*1e4)/1e4),dims:hi.map((x,k)=>Math.round((x-lo[k])/maxDim*1e4)/1e4)};
  const az=num('yaw',35,-3600,3600)*Math.PI/180,el=num('elevation',32,0,90)*Math.PI/180,view=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)],project=q=>[-q[0]*Math.sin(az)+q[1]*Math.cos(az),(q[0]*Math.cos(az)+q[1]*Math.sin(az))*Math.sin(el)-(q[2]-(height+1)/2)*Math.cos(el),q[0]*view[0]+q[1]*view[1]+q[2]*view[2]];
  const env=[];for(const x of [-nx/2,nx/2])for(const y of [-ny/2,ny/2])for(const z of [0,height+1.2])env.push(project([x,y,z]));
  const eLo=[Math.min(...env.map(q=>q[0])),Math.min(...env.map(q=>q[1]))],eHi=[Math.max(...env.map(q=>q[0])),Math.max(...env.map(q=>q[1]))],m=num('margin',15,0,Math.min(c.W,c.H)/2),size=num('size',230,1,2000),sc=Math.max(0,Math.min(size/Math.max(nx,ny,height+1.2),(c.W-2*m)/(eHi[0]-eLo[0]),(c.H-2*m)/(eHi[1]-eLo[1])));if(sc<=0)return [{paths:[]},mesh];
  const screen=q=>{const a=project(q);return [c.W/2+(a[0]-(eLo[0]+eHi[0])/2)*sc,c.H/2+(a[1]-(eLo[1]+eHi[1])/2)*sc,a[2]*sc];},projected=faces.map(f=>f.map(screen)),pixel=Math.max(.3,Math.max(c.W,c.H)/1100),bw=Math.ceil(c.W/pixel)+1,bh=Math.ceil(c.H/pixel)+1,depth=new Float32Array(bw*bh).fill(-Infinity);
  const triangle=(a,b,d)=>{const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],d[0])/pixel)),maxX=Math.min(bw-1,Math.ceil(Math.max(a[0],b[0],d[0])/pixel)),minY=Math.max(0,Math.floor(Math.min(a[1],b[1],d[1])/pixel)),maxY=Math.min(bh-1,Math.ceil(Math.max(a[1],b[1],d[1])/pixel)),den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(den)<1e-10)return;for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const xx=x*pixel,yy=y*pixel,u=((b[1]-d[1])*(xx-d[0])+(d[0]-b[0])*(yy-d[1]))/den,v=((d[1]-a[1])*(xx-d[0])+(a[0]-d[0])*(yy-d[1]))/den,w=1-u-v;if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)depth[y*bw+x]=Math.max(depth[y*bw+x],a[2]*u+b[2]*v+d[2]*w);}};
  if(p.hidden)for(const f of projected){triangle(f[0],f[1],f[2]);triangle(f[0],f[2],f[3]);}
  const candidates=[];
  for(let i=0;i<faces.length;i++){
   const f=faces[i],a=f[0],b=f[1],d=f[2],u=b.map((x,k)=>x-a[k]),v=d.map((x,k)=>x-a[k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],front=normal.reduce((s,x,k)=>s+x*view[k],0)>1e-9;if(p.hidden&&!front)continue;
   for(let k=0;k<4;k++){const A=f[k],B=f[(k+1)%4],key=[A.join(','),B.join(',')].sort().join('|');if(!edges.has(key)){edges.set(key,true);candidates.push([screen(A),screen(B)]);}}
   if(p.drawing==='Face hatch'&&front){const count=Math.max(1,Math.min(40,Math.max(2,Math.floor(27000/faces.length)),Math.floor(Math.hypot(...u)*sc/num('hatch',1.5,.5,10))));for(let j=1;j<count;j++){const t=j/count,A=f[0].map((x,k)=>x+(f[1][k]-x)*t),B=f[3].map((x,k)=>x+(f[2][k]-x)*t);candidates.push([screen(A),screen(B)]);}}
  }
  const total=candidates.reduce((s,[a,b])=>s+Math.hypot(b[0]-a[0],b[1]-a[1]),0),step=Math.max(pixel*.7,total/Math.max(1000,106000-2*candidates.length)),paths=[];
  for(const [a,b]of candidates){const N=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));let run=[];const flush=()=>{if(run.length>1)paths.push({pts:run,closed:false,layer:pen});run=[];};for(let i=0;i<=N;i++){const t=i/N,q=a.map((x,k)=>x+(b[k]-x)*t),ix=Math.max(0,Math.min(bw-1,Math.round(q[0]/pixel))),iy=Math.max(0,Math.min(bh-1,Math.round(q[1]/pixel)));if(!p.hidden||q[2]>=depth[iy*bw+ix]-pixel*1.8)run.push(q.slice(0,2));else flush();}flush();}
  let style=ins[0],out=applyStyle({paths},style);for(let k=0;k<12&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;k++){style={...style,dash:Math.max(.1,+style?.dash||4)*2,gap:Math.max(.1,+style?.gap||3)*2};out=applyStyle({paths},style);}return [out,mesh];
 }
};
