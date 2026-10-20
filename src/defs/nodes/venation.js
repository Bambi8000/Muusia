import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
 key:'venation',name:'Venation',cat:'gen',group:'organic',
 desc:'Grow a branching vein network towards seeded attractor points. Each attractor influences its nearest branch within Influence radius; branches advance by Branch step and consume attractors within Kill distance. Unlike Root Web noise walks or L-System grammar, targets organise the forks. Wire closed Region paths to grow inside a silhouette with even-odd holes; unwired gives an ellipse. Optional Roots uses path centres (up to 16), or a root near the bottom of the region. Growth and Timeline reconstruct a deterministic prefix; keep Seed, Attractors and structural controls fixed. Branches never cross the boundary: a full segment test rejects crossings, including holes. Colours maps branch order or age to 1–4 pens. Attractors output is a diagnostic dot field, not part of Drawing. Work is bounded at 2500 branches / 1800 attractors / 160 cycles; growth can stop when targets cannot be reached.',
 ins:[Pin('style','Style'),Pin('paths','Region'),Pin('paths','Roots')],outs:[Pin('paths','Drawing'),Pin('paths','Attractors')],
 params:[
 {key:'attractors',label:'Attractors',type:'slider',min:50,max:1800,step:50,def:650},
 {key:'influence',label:'Influence radius mm',type:'slider',min:5,max:100,step:1,def:45},
 {key:'kill',label:'Kill distance mm',type:'slider',min:1,max:15,step:.5,def:4},
 {key:'step',label:'Branch step mm',type:'slider',min:.5,max:8,step:.25,def:2.5},
 {key:'cycles',label:'Growth cycles',type:'slider',min:10,max:160,step:5,def:85},
 {key:'motion',label:'Time source',type:'select',options:['Manual','Timeline'],def:'Manual'},
 {key:'growth',label:'Growth %',type:'slider',min:0,max:100,step:1,def:100,showIf:p=>p.motion!=='Timeline'},
 {key:'colours',label:'Colours',type:'slider',min:1,max:4,step:1,def:1},
 {key:'colourBy',label:'Colour by',type:'select',options:['Branch order','Age'],def:'Branch order',showIf:p=>p.colours>1},
 {key:'layer',label:'Pen 1',type:'pen',def:0},
 ...[2,3,4].map(n=>({key:'pen'+n,label:'Pen '+n,type:'pen',def:n===2?1:n===3?2:6,showIf:p=>p.colours>=n})),
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:16},
 {key:'seed',label:'Seed',type:'seed',def:31}
 ],
 _region(p,c,ins){const m=Math.max(0,Math.min(Math.min(c.W,c.H)/2,+p.margin||0)),ps=(ins?.[1]?.paths||[]).filter(q=>q.closed&&q.pts?.length>=3);if(ps.reduce((n,q)=>n+q.pts.length,0)>4000||c.W<=2*m||c.H<=2*m)return null;
 const fallback=Array.from({length:96},(_,k)=>{const a=k/96*2*Math.PI;return [c.W/2+Math.min((c.W-2*m)/2,(c.H-2*m)*.36)*Math.cos(a),c.H/2+(c.H-2*m)/2*Math.sin(a)];}),polys=ps.length?ps.map(q=>q.pts):[fallback],edges=polys.flatMap(q=>q.map((a,i)=>[a,q[(i+1)%q.length]]));
 const inside=q=>{if(q[0]<m||q[0]>c.W-m||q[1]<m||q[1]>c.H-m)return false;let b=false;for(const [a,d]of edges)if((a[1]>q[1])!==(d[1]>q[1])&&q[0]<(d[0]-a[0])*(q[1]-a[1])/(d[1]-a[1])+a[0])b=!b;return b;};
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],segment=(a,b)=>{if(!inside(b))return false;const d=[b[0]-a[0],b[1]-a[1]];for(const [u,v]of edges){const e=[v[0]-u[0],v[1]-u[1]],den=cross(d,e);if(Math.abs(den)<1e-10)continue;const w=[u[0]-a[0],u[1]-a[1]],t=cross(w,e)/den,s=cross(w,d)/den;if(t>1e-8&&t<1-1e-8&&s>=0&&s<=1)return false;}return true;};
 const all=polys.flat(),xs=all.map(q=>q[0]),ys=all.map(q=>q[1]);return {polys,inside,segment,box:[Math.max(m,Math.min(...xs)),Math.max(m,Math.min(...ys)),Math.min(c.W-m,Math.max(...xs)),Math.min(c.H-m,Math.max(...ys))]};},
 overlay(p,c,ins){return this._region(p,c,ins)?.polys.slice(0,80).map(pts=>({kind:'poly',pts:[...pts,pts[0]]}))||[];},
 _grow(ins,p,c){
 const region=this._region(p,c,ins);if(!region)return null;const num=(v,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+v)?+v:d)),rng=mulberry32(num(p.seed,31,-2e9,2e9)),N=Math.round(num(p.attractors,650,1,1800)),influence=num(p.influence,45,2,500),step=num(p.step,2.5,.5,20),kill=num(p.kill,4,.5,50),maxCycles=Math.round(num(p.cycles,85,0,160)),growth=p.motion==='Timeline'&&c.frameCount>1?num(c.frameIdx/(c.frameCount-1),1,0,1):num(p.growth,100,0,100)/100,cycles=Math.round(maxCycles*growth),[x0,y0,x1,y1]=region.box,targets=[];
 for(let i=0;i<N*40&&targets.length<N;i++){const q=[x0+rng()*(x1-x0),y0+rng()*(y1-y0)];if(region.inside(q))targets.push(q);}
 let roots=(ins?.[2]?.paths||[]).slice(0,16).map(q=>q.pts?.length?q.pts.reduce((a,b)=>[a[0]+b[0]/q.pts.length,a[1]+b[1]/q.pts.length],[0,0]):null).filter(q=>q&&q.every(Number.isFinite)&&region.inside(q));
 if(!roots.length){const candidates=[];for(let i=0;i<25;i++)for(let j=0;j<25;j++){const q=[x0+(i+.5)/25*(x1-x0),y0+(j+.5)/25*(y1-y0)];if(region.inside(q))candidates.push(q);}candidates.sort((a,b)=>(b[1]-.15*Math.abs(b[0]-(x0+x1)/2))-(a[1]-.15*Math.abs(a[0]-(x0+x1)/2)));roots=candidates.slice(0,1);}
 const nodes=roots.map(q=>({q,parent:-1,children:[],age:0,order:0})),live=new Set(targets.map((_,i)=>i)),cell=influence,key=q=>Math.floor(q[0]/cell)+','+Math.floor(q[1]/cell);
 for(let cycle=0;cycle<cycles&&nodes.length<2500&&live.size;cycle++){
  const grid=new Map();nodes.forEach((n,i)=>{const k=key(n.q);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);});const sums=new Map();
  for(const i of live){const q=targets[i],gx=Math.floor(q[0]/cell),gy=Math.floor(q[1]/cell);let best=-1,dist=influence;
   for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const k of grid.get(x+','+y)||[]){const r=nodes[k].q,d=Math.hypot(q[0]-r[0],q[1]-r[1]);if(d<dist){best=k;dist=d;}}
   if(dist<kill){live.delete(i);continue;}if(best<0)continue;const q0=nodes[best].q,v=sums.get(best)||[0,0];v[0]+=(q[0]-q0[0])/dist;v[1]+=(q[1]-q0[1])/dist;sums.set(best,v);
  }
  let added=0;const proposed=[];
  for(const [i,v]of sums){const L=Math.hypot(...v);if(L<1e-8)continue;const n=nodes[i],q=[n.q[0]+v[0]/L*step,n.q[1]+v[1]/L*step];if(!region.segment(n.q,q))continue;const gx=Math.floor(q[0]/cell),gy=Math.floor(q[1]/cell);let crowded=false;
   for(let x=gx-1;x<=gx+1&&!crowded;x++)for(let y=gy-1;y<=gy+1&&!crowded;y++)for(const j of grid.get(x+','+y)||[])if(j!==i&&Math.hypot(q[0]-nodes[j].q[0],q[1]-nodes[j].q[1])<step*.65){crowded=true;break;}
   if(crowded||proposed.some(t=>Math.hypot(q[0]-t[0],q[1]-t[1])<step*.65))continue;
   if(nodes.length>=2500)break;const child=nodes.length;nodes.push({q,parent:i,children:[],age:cycle+1,order:n.order+(n.children.length?1:0)});n.children.push(child);proposed.push(q);added++;
  }if(!added)break;
 }return {nodes,targets,maxCycles};
 },
 compute(ins,p,c){const state=this._grow(ins,p,c);if(!state)return [{paths:[]},{paths:[]}];const {nodes,targets,maxCycles}=state,nc=Math.max(1,Math.min(4,Math.round(+p.colours||1))),pens=[p.layer??0,p.pen2??1,p.pen3??2,p.pen4??6].map(v=>Math.max(0,Math.min(11,Math.round(+v||0)))),pen=n=>pens[(p.colourBy==='Age'?Math.min(nc-1,Math.floor(n.age/(maxCycles||1)*nc)):n.order%nc)],paths=[];
 for(let i=0;i<nodes.length;i++){const n=nodes[i];for(const child of n.children){let k=child,pts=[n.q,nodes[k].q],layer=pen(nodes[k]);if(n.parent>=0&&n.children.length===1&&pen(n)===layer)continue;
  while(nodes[k].children.length===1){const next=nodes[k].children[0];if(pen(nodes[next])!==layer)break;k=next;pts.push(nodes[k].q);}paths.push({pts,closed:false,layer});}}
 const dots=targets.map(q=>({pts:Array.from({length:6},(_,i)=>[q[0]+.18*Math.cos(i*Math.PI/3),q[1]+.18*Math.sin(i*Math.PI/3)]),closed:true,layer:pens[0]}));return [applyStyle({paths},ins?.[0]),{paths:dots}];}
};
