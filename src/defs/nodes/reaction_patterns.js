import { Pin, EMPTY, mulberry32, applyStyle } from "../helpers.js";

export default {
 key:'reaction_patterns',name:'Reaction Patterns',cat:'gen',group:'organic',
 desc:'Tonal Turing optionally varies local feed and kill rates using a darkness image, fitted across the simulation margin, or a closed even-odd Tone input. Mid-grey is neutral; Tone influence controls modulation. Seeds and Region keep their original roles. This guides the texture rather than tracing or reproducing every image detail. A seeded Gray–Scott reaction–diffusion surface, drawn as vector contours. Coral branches, Maze stripes and Spots emerge from local chemical exchange rather than a growing outline. Wired Seeds starts the reaction inside closed paths (even-odd holes) or along open strokes; unwired Seeds scatters small germs. Optional Region masks the sampled simulation, including holes; contour boundaries have grid-resolution error. Use Container afterwards for exact clipping. Pattern scale changes the solver grid, Detail sets its longest dimension (bounded to 128 / 12k cells), and Steps sets the mature simulation time. Manual Growth or Timeline deterministically reconstructs the same prefix on every frame; keep Seed, Steps and structural settings fixed. Growth 0 shows the initial germs, not an empty drawing. Level selects chemical concentration, Contours draws neighbouring levels, and pens cycle by level. Boundary wrap connects opposite page edges only. No playback cache or outside service is used.',
 fileImage:true,
 ins:[Pin('style','Style'),Pin('paths','Seeds'),Pin('paths','Region'),Pin('paths','Tone')],outs:[Pin('paths')],
 params:[
  {key:"tonal",label:"Tonal Turing",type:"check",def:false},
  {key:"toneImage",label:"Tone image",type:"file",def:"",showIf:p=>p.tonal},
  {key:"toneAmount",label:"Tone influence %",type:"slider",min:0,max:100,step:1,def:65,showIf:p=>p.tonal},
  {key:"toneInvert",label:"Invert tone",type:"check",def:false,showIf:p=>p.tonal},
  {key:'pattern',label:'Pattern',type:'select',options:['Coral','Maze','Spots','Custom'],def:'Coral'},
  {key:'feed',label:'Feed',type:'slider',min:.01,max:.08,step:.001,def:.04,showIf:p=>p.pattern==='Custom'},
  {key:'kill',label:'Kill',type:'slider',min:.04,max:.075,step:.001,def:.062,showIf:p=>p.pattern==='Custom'},
  {key:'detail',label:'Detail',type:'slider',min:32,max:128,step:4,def:80},
  {key:'scale',label:'Pattern scale',type:'slider',min:.5,max:3,step:.1,def:1},
  {key:'steps',label:'Mature steps',type:'slider',min:0,max:1600,step:25,def:650},
  {key:'motion',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual'},
  {key:'growth',label:'Growth %',type:'slider',min:0,max:100,step:1,def:100,showIf:p=>p.motion!=='Timeline'},
  {key:'germs',label:'Fallback germs',type:'slider',min:1,max:80,step:1,def:28},
  {key:'seedWidth',label:'Seed width mm',type:'slider',min:1,max:20,step:.5,def:12},
  {key:'level',label:'Contour level',type:'slider',min:.1,max:.7,step:.01,def:.25},
  {key:'contours',label:'Contours',type:'slider',min:1,max:5,step:1,def:2},
  {key:'wrap',label:'Boundary wrap',type:'check',def:false},
  {key:'pens',label:'Pens',type:'slider',min:1,max:6,step:1,def:1},
  {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
  {key:'seed',label:'Seed',type:'seed',def:37},
  {key:'layer',label:'First pen',type:'pen',def:0}
 ],
 overlay(p,c,ins){const ps=ins?.[2]?.paths?.filter(q=>q.closed)||[];return ps.length?ps.slice(0,100).map(q=>({kind:'poly',pts:[...q.pts,q.pts[0]]})):[{kind:'rect',x:p.margin,y:p.margin,w:c.W-2*p.margin,h:c.H-2*p.margin}];},
 compute(ins,p,c,node){
  const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d)),m=n('margin',12,0,Math.min(c.W,c.H)/2),W=c.W-2*m,H=c.H-2*m;if(!(W>0&&H>0))return EMPTY;
  const detail=Math.round(n('detail',80,32,128)/n('scale',1,.5,3));let nx=Math.max(16,Math.min(128,Math.round(detail*Math.min(1,W/H)))),ny=Math.max(16,Math.min(128,Math.round(detail*Math.min(1,H/W))));if(nx*ny>12000){const f=Math.sqrt(12000/(nx*ny));nx=Math.floor(nx*f);ny=Math.floor(ny*f);}const N=nx*ny;
  const seeds=ins[1]?.paths||[],region=(ins[2]?.paths||[]).filter(q=>q.closed);if([...seeds,...region].reduce((s,q)=>s+q.pts.length,0)>4000)return EMPTY;
  const poly=(x,y,pts)=>{let b=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],d=pts[j];if((a[1]>y)!==(d[1]>y)&&x<(d[0]-a[0])*(y-a[1])/(d[1]-a[1])+a[0])b=!b;}return b;},inside=(x,y,ps)=>ps.reduce((b,q)=>b!==poly(x,y,q.pts),false);
  let A=new Float64Array(N).fill(1),B=new Float64Array(N),a2=new Float64Array(N),b2=new Float64Array(N);const mask=new Uint8Array(N),rng=mulberry32(Math.round(n('seed',37,-2e9,2e9))),germs=Array.from({length:Math.round(n('germs',28,1,80))},()=>[.05+rng()*.9,.05+rng()*.9]),closed=seeds.filter(q=>q.closed),open=seeds.filter(q=>!q.closed),radius=n('seedWidth',12,1,50)/2;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i,x=m+i/(nx-1)*W,y=m+j/(ny-1)*H;mask[k]=!region.length||inside(x,y,region);if(!mask[k])continue;let hit=closed.length&&inside(x,y,closed);for(const q of open)for(let z=1;z<q.pts.length&&!hit;z++){const a=q.pts[z-1],b=q.pts[z],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));hit=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<radius;}if(!seeds.length)hit=germs.some(([gx,gy])=>Math.hypot(x-m-gx*W,y-m-gy*H)<Math.max(radius,1.1*Math.max(W/nx,H/ny)));if(hit){B[k]=.9;A[k]=.1;}}
  const parameters={Coral:[.0545,.062],Maze:[.029,.057],Spots:[.0367,.0649]},[feed,kill]=parameters[p.pattern]||[n('feed',.04,.005,.1),n('kill',.062,.03,.09)],t=p.motion==='Timeline'&&c.frameCount>1?Math.max(0,Math.min(1,c.frameIdx/(c.frameCount-1))):n('growth',100,0,100)/100,steps=Math.round(n('steps',650,0,1600)*t);
  const tone=new Float64Array(N).fill(.5),img=node?.data?.img,toneshapes=(ins[3]?.paths||[]).filter(q=>q.closed);if(toneshapes.reduce((s,q)=>s+q.pts.length,0)>4000)return EMPTY;
  if(p.tonal)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=m+i/(nx-1)*W,y=m+j/(ny-1)*H;let v=toneshapes.length?+inside(x,y,toneshapes):img?.g?.length===img.w*img.h?img.g[Math.min(img.h-1,Math.floor(j/ny*img.h))*img.w+Math.min(img.w-1,Math.floor(i/nx*img.w))]:.5;tone[j*nx+i]=p.toneInvert?1-v:v;}
  const localFeed=new Float64Array(N),localKill=new Float64Array(N);for(let k=0;k<N;k++){const a=p.tonal?(tone[k]-.5)*n('toneAmount',65,0,100)/100:0;localFeed[k]=Math.max(.005,Math.min(.1,feed+a*.035));localKill[k]=Math.max(.03,Math.min(.09,kill+a*.012));}
  const left=new Int32Array(N),right=new Int32Array(N),up=new Int32Array(N),down=new Int32Array(N);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;for(const [dst,ii,jj]of [[left,i-1,j],[right,i+1,j],[up,i,j-1],[down,i,j+1]]){const x=p.wrap?(ii+nx)%nx:Math.max(0,Math.min(nx-1,ii)),y=p.wrap?(jj+ny)%ny:Math.max(0,Math.min(ny-1,jj)),v=y*nx+x;dst[k]=mask[v]?v:k;}}
  for(let it=0;it<steps;it++){for(let k=0;k<N;k++){if(!mask[k]){a2[k]=1;b2[k]=0;continue;}const a=A[k],b=B[k],reaction=a*b*b,la=A[left[k]]+A[right[k]]+A[up[k]]+A[down[k]]-4*a,lb=B[left[k]]+B[right[k]]+B[up[k]]+B[down[k]]-4*b;a2[k]=Math.max(0,Math.min(1,a+.2*la-reaction+localFeed[k]*(1-a)));b2[k]=Math.max(0,Math.min(1,b+.1*lb+reaction-(localKill[k]+localFeed[k])*b));}[A,a2]=[a2,A];[B,b2]=[b2,B];}
  const paths=[],levels=Math.round(n('contours',2,1,5)),pens=Math.round(n('pens',1,1,6)),pen=Math.round(n('layer',0,0,11));
  for(let level=0;level<levels;level++){const iso=Math.min(.85,n('level',.25,.05,.75)+level*.065),segs=[];
   for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const k=j*nx+i,v=[B[k],B[k+1],B[k+nx+1],B[k+nx]],coord=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],hits=[];for(let e=0;e<4;e++){const f=(e+1)%4;if((v[e]>iso)!==(v[f]>iso)){const t=(iso-v[e])/(v[f]-v[e]);hits.push([m+(coord[e][0]+t*(coord[f][0]-coord[e][0]))/(nx-1)*W,m+(coord[e][1]+t*(coord[f][1]-coord[e][1]))/(ny-1)*H]);}}if(hits.length===2)segs.push(hits);else if(hits.length===4){const turn=(v[0]-iso)*(v[2]-iso)-(v[1]-iso)*(v[3]-iso);if(turn>0)segs.push([hits[0],hits[1]],[hits[2],hits[3]]);else segs.push([hits[0],hits[3]],[hits[1],hits[2]]);}}
   const key=q=>q.map(v=>Math.round(v*1e6)).join(','),adj=new Map(),used=new Uint8Array(segs.length);segs.forEach((s,i)=>s.forEach(q=>{const k=key(q);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}));
   const walk=(i,start)=>{const pts=[start],first=key(start);let tail=first;while(!used[i]){used[i]=1;const q=segs[i],next=key(q[0])===tail?q[1]:q[0];pts.push(next);tail=key(next);const z=(adj.get(tail)||[]).find(z=>!used[z]);if(z===undefined)break;i=z;}const closed=tail===first;if(closed)pts.pop();if(pts.length>=(closed?3:2))paths.push({pts,closed,layer:(pen+level%pens)%12});};
   for(const [k,ids]of adj)if(ids.length!==2)for(const i of ids)if(!used[i])walk(i,segs[i].find(q=>key(q)===k));for(let i=0;i<segs.length;i++)if(!used[i])walk(i,segs[i][0]);
  }
  let style=ins[0],out=applyStyle({paths},style);for(let i=0;i<12&&out.paths.reduce((n,q)=>n+q.pts.length,0)>118000;i++){style={...style,dash:Math.max(.1,+style?.dash||4)*1.8,gap:Math.max(.1,+style?.gap||3)*1.8};out=applyStyle({paths},style);}return out.paths.reduce((n,q)=>n+q.pts.length,0)<=118000?out:EMPTY;
 }
};
