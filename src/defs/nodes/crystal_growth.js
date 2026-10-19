import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
 key:'crystal_growth',name:'Crystal Growth',cat:'gen',group:'nature',
 desc:'Grow seeded faceted crystal clusters in real 3D. Quartz has broad hexagonal shafts and pointed terminations; Needles narrows the shafts. Branching adds lateral daughter crystals. Competition shortens stems whose tips enter the exclusion radius of older stems, with shared roots allowed near the base. Count is the number of primary crystals. Manual Growth or Timeline reconstructs a repeatable growth prefix; keep Seed and structure fixed. Drawing uses a fixed mature frame so growth does not zoom. Mesh is centred and normalized independently per frame for the existing mesh contract: use Drawing for fixed-size growth, or animate the downstream renderer size if needed. Connect Mesh to Mesh Render for hidden lines, illumination and shadows, or 3D Spikes for surface bristles. Preview shows the wire structure, including back edges.',
 ins:[Pin('style','Style')],outs:[Pin('paths','Drawing'),Pin('mesh','Mesh')],
 params:[
  {key:'mode',label:'Crystal',type:'select',options:['Quartz','Needles'],def:'Quartz'},
  {key:'count',label:'Primary crystals',type:'slider',min:1,max:70,step:1,def:20},
  {key:'length',label:'Length',type:'slider',min:.2,max:2,step:.05,def:1},
  {key:'width',label:'Width',type:'slider',min:.02,max:.3,step:.01,def:.1},
  {key:'spread',label:'Cluster spread',type:'slider',min:.1,max:1,step:.05,def:.5},
  {key:'lean',label:'Lean °',type:'slider',min:0,max:75,step:1,def:30},
  {key:'branch',label:'Branching %',type:'slider',min:0,max:100,step:1,def:25},
  {key:'compete',label:'Competition',type:'check',def:true},
  {key:'motion',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual'},
  {key:'growth',label:'Growth %',type:'slider',min:0,max:100,step:1,def:100,showIf:p=>p.motion!=='Timeline'},
  {key:'yaw',label:'View angle °',type:'slider',min:-180,max:180,step:1,def:25},
  {key:'elevation',label:'View elevation °',type:'slider',min:5,max:90,step:1,def:28},
  {key:'size',label:'Preview size mm',type:'slider',min:20,max:350,step:1,def:165},
  {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
  {key:'seed',label:'Seed',type:'seed',def:37},
  {key:'layer',label:'Pen',type:'pen',def:0}
 ],
 overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
 compute(ins,p,c){
  const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),rng=mulberry32(Math.round(n('seed',37,-2e9,2e9))),stems=[],count=Math.round(n('count',20,1,70)),baseWidth=n('width',.1,.01,.4)*(p.mode==='Needles'?.3:1),spread=n('spread',.5,.05,2);
  for(let i=0;i<count;i++){
   const a=rng()*Math.PI*2,r=Math.sqrt(rng())*spread*.5,b=[Math.cos(a)*r,Math.sin(a)*r,-.4],az=rng()*Math.PI*2,lean=rng()*n('lean',30,0,85)*Math.PI/180,axis=[Math.cos(az)*Math.sin(lean),Math.sin(az)*Math.sin(lean),Math.cos(lean)],L=n('length',1,.1,3)*(.45+rng()*.75),w=baseWidth*(.6+rng()*.7),birth=rng()*.4;stems.push({b,axis,L,w,birth,spin:rng()*Math.PI});
   if(rng()<n('branch',25,0,100)/100){const z=.3+rng()*.35,aa=az+(rng()>.5?1:-1)*.8,le=Math.min(1.4,lean+.45);stems.push({b:b.map((v,k)=>v+axis[k]*L*z),axis:[Math.cos(aa)*Math.sin(le),Math.sin(aa)*Math.sin(le),Math.cos(le)],L:L*.55,w:w*.65,birth:Math.min(.75,birth+.25),spin:rng()*Math.PI});}
  }
  if(p.compete)for(let i=0;i<stems.length;i++){const s=stems[i];for(let t=.3;t<=1;t+=.04){const q=s.b.map((v,k)=>v+s.axis[k]*s.L*t);let hit=false;for(let j=0;j<i;j++){const a=stems[j],d=q.map((v,k)=>v-a.b[k]),u=Math.max(0,Math.min(a.L,d.reduce((v,x,k)=>v+x*a.axis[k],0))),dd=Math.hypot(...d.map((v,k)=>v-a.axis[k]*u));if(u>a.L*.2&&dd<(s.w+a.w)*.7){hit=true;break;}}if(hit){s.L*=Math.max(.25,t-.04);break;}}}
  const meshAt=t=>{const v=[];const tri=(a,b,c)=>v.push(...a,...b,...c);for(const s of stems){const g=Math.max(0,Math.min(1,(t-s.birth)/(1-s.birth)));if(g<=0)continue;const a=s.axis,ref=Math.abs(a[2])<.95?[0,0,1]:[0,1,0],u=[a[1]*ref[2]-a[2]*ref[1],a[2]*ref[0]-a[0]*ref[2],a[0]*ref[1]-a[1]*ref[0]],ul=Math.hypot(...u);for(let k=0;k<3;k++)u[k]/=ul;const vv=[a[1]*u[2]-a[2]*u[1],a[2]*u[0]-a[0]*u[2],a[0]*u[1]-a[1]*u[0]],ring=z=>Array.from({length:6},(_,i)=>s.b.map((b,k)=>b+a[k]*s.L*g*z+(u[k]*Math.cos(i*Math.PI/3+s.spin)+vv[k]*Math.sin(i*Math.PI/3+s.spin))*s.w*.5*Math.sqrt(g))),bot=ring(0),top=ring(.76),tip=s.b.map((b,k)=>b+a[k]*s.L*g);for(let i=0;i<6;i++){const j=(i+1)%6;tri(bot[i],bot[j],top[j]);tri(bot[i],top[j],top[i]);tri(top[i],top[j],tip);tri(s.b,bot[j],bot[i]);}}return v;};
  const mature=meshAt(1),t=p.motion==='Timeline'&&c.frameCount>1?Math.max(0,Math.min(1,c.frameIdx/(c.frameCount-1))):n('growth',100,0,100)/100,v=meshAt(t);if(!v.length)return [EMPTY,null];
  const bounds=arr=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<arr.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],arr[i+k]);hi[k]=Math.max(hi[k],arr[i+k]);}return {lo,hi,center:lo.map((x,k)=>(x+hi[k])/2),dim:Math.max(...lo.map((x,k)=>hi[k]-x))};},b=bounds(v),full=bounds(mature),nv=v.map((x,i)=>Math.round((x-b.center[i%3])/Math.max(1e-9,b.dim)*10000)/10000),mesh={kind:'mesh',tri:v.length/9,v:nv,dims:b.lo.map((x,k)=>Math.round((b.hi[k]-x)/Math.max(1e-9,b.dim)*10000)/10000)};
  const az=n('yaw',25,-3600,3600)*Math.PI/180,el=n('elevation',28,5,90)*Math.PI/180,project=q=>{const x=q[0]-full.center[0],y=q[1]-full.center[1],z=q[2]-full.center[2];return [-x*Math.sin(az)+y*Math.cos(az),(x*Math.cos(az)+y*Math.sin(az))*Math.sin(el)-z*Math.cos(el)];};
  let radius=0;for(let i=0;i<mature.length;i+=3)radius=Math.max(radius,Math.hypot(...project(mature.slice(i,i+3))));const m=n('margin',12,0,Math.min(c.W,c.H)/2),sc=Math.max(0,Math.min(n('size',165,10,1000)/Math.max(1e-9,full.dim),(c.W-2*m)/(2*radius),(c.H-2*m)/(2*radius))),edges=new Map(),pen=Math.round(n('layer',0,0,11));
  for(let i=0;i<v.length;i+=9)for(let j=0;j<3;j++){const a=v.slice(i+j*3,i+j*3+3),b=v.slice(i+(j+1)%3*3,i+(j+1)%3*3+3),key=[a.map(x=>x.toFixed(6)).join(','),b.map(x=>x.toFixed(6)).join(',')].sort().join('|');if(!edges.has(key))edges.set(key,{pts:[a,b].map(q=>{const z=project(q);return [c.W/2+z[0]*sc,c.H/2+z[1]*sc];}),closed:false,layer:pen});}
  const paths=[...edges.values()];let style=ins[0],out=applyStyle({paths},style);for(let k=0;k<10&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;k++){style={...style,dash:Math.max(.1,+style?.dash||4)*2,gap:Math.max(.1,+style?.gap||3)*2};out=applyStyle({paths},style);}return [out.paths.reduce((n,q)=>n+q.pts.length,0)<=118000?out:EMPTY,mesh];
 }
};
