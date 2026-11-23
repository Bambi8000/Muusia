/** Deterministic, millimetre-based drawing treatments of the visible avatar skin.
 * Plane levels live in the unchanged body coordinate frame. Cutting only
 * reveals/removes lines; it never refits their phase or resamples anatomy.
 */
import {buildAvatarView,rasterizeAvatarView} from './avatar-render.js';

export const AVATAR_PLOT_DEFAULTS=Object.freeze({
  style:'Brush',brushWidth:2.5,brushEconomy:.82,penWidth:.35,pitch:.9,
  contourAngle:0,hatchAngle:45,lightAngle:-135,crosshatch:.35,
  outline:true,cutEdges:true,styleSeed:17,outlinePen:0,detailPen:0,shadePen:0,
});
const control=(key,label,min,max,step,def,modes)=>({key,label,type:'slider',min,max,step,def,modes});
export const AVATAR_PLOT_CONTROLS=Object.freeze([
  {key:'style',label:'Drawing style',type:'select',options:['Brush','Contours','Hatching','Contours + hatching'],def:'Brush'},
  control('brushWidth','Brush width mm',1,8,.1,2.5,['Brush']),
  control('brushEconomy','Line economy',0,1,.01,.82,['Brush']),
  control('penWidth','Pen width mm',.15,.8,.05,.35,['Contours','Hatching','Contours + hatching']),
  control('pitch','Line spacing mm',.35,5,.05,.9,['Contours','Hatching','Contours + hatching']),
  control('contourAngle','Contour tilt °',-80,80,1,0,['Contours','Contours + hatching']),
  control('hatchAngle','Hatch angle °',-90,90,1,45,['Hatching','Contours + hatching']),
  control('lightAngle','Light direction °',-180,180,1,-135,['Hatching','Contours + hatching']),
  control('crosshatch','Crosshatch',0,1,.05,.35,['Hatching','Contours + hatching']),
  {key:'outline',label:'Outline',type:'check',def:true},
  {key:'cutEdges',label:'Cut edges',type:'check',def:true},
  {key:'styleSeed',label:'Drawing seed',type:'seed',def:17},
  {key:'outlinePen',label:'Outline pen',type:'pen',def:0},
  {key:'detailPen',label:'Contour pen',type:'pen',def:0},
  {key:'shadePen',label:'Hatch pen',type:'pen',def:0},
]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(v,d)=>Number.isFinite(+v)?+v:d;
const mix=(a,b,t)=>a+(b-a)*t;
const lerp=(a,b,t)=>a.map((v,k)=>mix(v,b[k],t));
const length=pts=>{let n=0;for(let i=1;i<pts.length;i++)n+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return n;};
const unit=v=>{const d=Math.hypot(...v)||1;return v.map(n=>n/d);};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const hash=(seed,index=0)=>{let t=(Math.round(seed)+Math.imul(index+1,0x9e3779b9))|0;t=Math.imul(t^t>>>16,0x21f0aaad);t=Math.imul(t^t>>>15,0x735a2d97);return((t^t>>>15)>>>0)/4294967296;};
const FIELDS=new WeakMap();
export function normalizeAvatarPlotOptions(values={}){
  const p={...AVATAR_PLOT_DEFAULTS,...values};
  if(!AVATAR_PLOT_CONTROLS[0].options.includes(p.style))p.style='Brush';
  for(const c of AVATAR_PLOT_CONTROLS)if(c.type==='slider')p[c.key]=clamp(num(p[c.key],c.def),c.min,c.max);
  p.styleSeed=clamp(Math.round(num(p.styleSeed,17)),-1e9,1e9);
  for(const key of ['outlinePen','detailPen','shadePen'])p[key]=clamp(Math.round(num(p[key],0)),0,11);
  p.outline=p.outline!==false;p.cutEdges=p.cutEdges!==false;
  return p;
}
function camera(options){
  const a=num(options.yaw,0)*Math.PI/180,b=num(options.pitch,0)*Math.PI/180,c=num(options.roll,0)*Math.PI/180;
  const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cc=Math.cos(c),sc=Math.sin(c);
  const transform=p=>{const x=p[0]*ca-p[1]*sa,y=p[0]*sa+p[1]*ca,z=y*sb+p[2]*cb;return[x*cc+z*sc,x*sc-z*cc,-y*cb+p[2]*sb];};
  const axes=[[1,0,0],[0,1,0],[0,0,1]].map(transform);
  return {transform,inverse:p=>axes.map(a=>dot(a,p))};
}
function mapping(view,ctx){
  const W=Math.max(10,num(ctx.W,210)),H=Math.max(10,num(ctx.H,297)),margin=clamp(num(ctx.margin,10),0,Math.min(W,H)/2-.01);
  const box=view.referenceBounds,dx=Math.max(1e-8,box.max[0]-box.min[0]),dy=Math.max(1e-8,box.max[1]-box.min[1]);
  const scale=Math.min(Math.max(1,num(ctx.size,240))/Math.max(dx,dy),(W-2*margin)/dx,(H-2*margin)/dy);
  return {W,H,margin,scale,ox:W/2-(box.min[0]+box.max[0])/2*scale,oy:H/2-(box.min[1]+box.max[1])/2*scale};
}
function getField(mesh,options,ctx){
  const keys=['yaw','pitch','roll','mode','cut','band','frame','rotationEnvelope','frameBox'];
  const cacheKey=JSON.stringify([keys.map(k=>options[k]),ctx.W,ctx.H,ctx.size,ctx.margin]);
  let entries=FIELDS.get(mesh);if(!entries){entries=new Map();FIELDS.set(mesh,entries);}
  if(entries.has(cacheKey))return entries.get(cacheKey);
  const view=buildAvatarView(mesh,options),map=mapping(view,ctx),box=view.referenceBounds;
  const spanX=Math.max(.02,box.max[0]-box.min[0]),spanY=Math.max(.02,box.max[1]-box.min[1]);
  const factor=Math.min(map.scale/.17,1600/Math.max(spanX,spanY));
  const width=Math.max(120,Math.ceil(spanX*factor)+10),height=Math.max(120,Math.ceil(spanY*factor)+10);
  const raster=rasterizeAvatarView(view,width,height,{padding:.002,normals:true,faceIds:true});
  const skin=new Uint8Array(width*height);
  for(let i=0;i<skin.length;i++)if(Number.isFinite(raster.depth[i])&&raster.face[i]>=0&&!view.triangles[raster.face[i]].cap)skin[i]=1;
  const cam=camera(options),result={view,map,raster,skin,cam};
  if(entries.size>=2)entries.delete(entries.keys().next().value);entries.set(cacheKey,result);return result;
}
function simplify(points,tolerance){
  if(points.length<3)return points.slice();
  const sq=tolerance*tolerance,keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const stack=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],d=dx*dx+dy*dy;let best=sq,index=-1;
    for(let i=a+1;i<b;i++){const r=points[i],t=d?clamp(((r[0]-p[0])*dx+(r[1]-p[1])*dy)/d,0,1):0;const value=(r[0]-p[0]-t*dx)**2+(r[1]-p[1]-t*dy)**2;if(value>best){best=value;index=i;}}
    if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}
  }
  return points.filter((_,i)=>keep[i]);
}
function joinSegments(segments,tolerance=1e-5){
  const key=p=>Math.round(p[0]/tolerance)+','+Math.round(p[1]/tolerance),edges=[],adj=new Map(),dedup=new Set();
  for(const edge of segments){const a=key(edge[0]),b=key(edge[1]),id=a<b?a+':'+b:b+':'+a;if(a===b||dedup.has(id))continue;dedup.add(id);const n=edges.length;edges.push(edge);for(const k of[a,b]){if(!adj.has(k))adj.set(k,[]);adj.get(k).push(n);}}
  const used=new Uint8Array(edges.length),paths=[];
  const walk=(id,start)=>{const pts=[start];let tail=key(start);const origin=tail;
    while(!used[id]){used[id]=1;const edge=edges[id],q=key(edge[0])===tail?edge[1]:edge[0];pts.push(q);tail=key(q);if(tail===origin)break;const next=(adj.get(tail)||[]).find(n=>!used[n]);if(next===undefined)break;id=next;}
    const closed=tail===origin;if(closed)pts.pop();if(pts.length>1)paths.push({pts,closed});
  };
  for(const [k,ids]of adj)if(ids.length!==2)for(const id of ids)if(!used[id])walk(id,edges[id].find(p=>key(p)===k));
  for(let id=0;id<edges.length;id++)if(!used[id])walk(id,edges[id][0]);
  return paths;
}
function fieldPoint(field,x,y){
  const r=field.raster,ix=Math.round(x),iy=Math.round(y);if(ix<0||iy<0||ix>=r.width||iy>=r.height)return null;
  const i=iy*r.width+ix;if(!field.skin[i])return null;
  return {i,view:[(x+.5-r.ox)/r.scale,(y+.5-r.oy)/r.scale,r.depth[i]]};
}
function toMM(field,p){const r=field.raster,m=field.map;return [m.ox+(p[0]+.5-r.ox)/r.scale*m.scale,m.oy+(p[1]+.5-r.oy)/r.scale*m.scale];}
function visibleEdge(field,p){
  const r=field.raster,x=p[0]*r.scale+r.ox-.5,y=p[1]*r.scale+r.oy-.5,ix=Math.round(x),iy=Math.round(y);
  if(ix<0||iy<0||ix>=r.width||iy>=r.height)return false;
  // Outlines may fall on the coverage boundary. Find a nearby actual surface,
  // never treating the empty depth sentinel as visible geometry.
  let closest=Infinity;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const jx=ix+dx,jy=iy+dy;if(jx<0||jy<0||jx>=r.width||jy>=r.height)continue;const depth=r.depth[jy*r.width+jx];if(Number.isFinite(depth))closest=Math.min(closest,Math.abs(p[2]-depth));}
  return closest<Math.max(1.8/r.scale,.10/field.map.scale);
}
function meshOutlines(field,cutEdges){
  const segments=[],m=field.map;
  for(const edge of field.view.silhouette){if(edge.faces.every(id=>field.view.faceNormals[id][2]<-1e-8))continue;
    const [a,b]=edge.pts,count=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])*field.raster.scale));let start=null;
    for(let j=0;j<=count;j++){const p=lerp(a,b,j/count),on=visibleEdge(field,p);if(on&&!start)start=p;if((!on||j===count)&&start){const end=on?p:lerp(a,b,Math.max(0,j-1)/count);if(Math.hypot(end[0]-start[0],end[1]-start[1])>1e-10)segments.push([start,end]);start=null;}}
  }
  if(cutEdges)for(const path of field.view.sections)for(let i=0;i<path.pts.length-(path.closed?0:1);i++){const a=path.pts[i],b=path.pts[(i+1)%path.pts.length];if(visibleEdge(field,lerp(a,b,.5)))segments.push([a,b]);}
  return joinSegments(segments,2e-7).map(path=>({closed:path.closed,pts:path.pts.map(p=>[m.ox+p[0]*m.scale,m.oy+p[1]*m.scale,p[2]])}));
}
function outlines(field,cutEdges){
  if(field.outer&&!cutEdges)return field.outer;
  const r=field.raster,segments=[];
  const occupied=(x,y)=>x>=0&&y>=0&&x<r.width&&y<r.height&&Number.isFinite(r.depth[y*r.width+x]);
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
    if(!occupied(x,y))continue;
    const d=r.depth[y*r.width+x],p=(u,v)=>[u,v,d];
    if(!occupied(x,y-1))segments.push([p(x-.5,y-.5),p(x+.5,y-.5)]);
    if(!occupied(x+1,y))segments.push([p(x+.5,y-.5),p(x+.5,y+.5)]);
    if(!occupied(x,y+1))segments.push([p(x+.5,y+.5),p(x-.5,y+.5)]);
    if(!occupied(x-1,y))segments.push([p(x-.5,y+.5),p(x-.5,y-.5)]);
  }
  const paths=joinSegments(segments).map(path=>{
    let pts=path.pts;
    for(let iteration=0;iteration<2;iteration++){
      const smooth=[];
      for(let i=0;i<pts.length-(path.closed?0:1);i++){const a=pts[i],b=pts[(i+1)%pts.length];smooth.push(lerp(a,b,.25),lerp(a,b,.75));}
      if(!path.closed&&pts.length)smooth.push(pts.at(-1));pts=smooth;
    }
    return {closed:path.closed,pts:pts.map(p=>[...toMM(field,p),p[2]])};
  });
  field.outer=paths;
  if(!cutEdges||!field.view.sections.length)return paths;
  const extra=meshOutlines(field,true).filter(path=>{
    const p=path.pts[Math.floor(path.pts.length/2)];
    return field.view.sections.some(section=>section.pts.some(q=>Math.hypot(field.map.ox+q[0]*field.map.scale-p[0],field.map.oy+q[1]*field.map.scale-p[1])<.5));
  });
  return [...paths,...extra];
}
function planeNormal(angle,depth=.85){const a=angle*Math.PI/180;return unit([Math.sin(a)+.15,-depth,Math.cos(a)]);}
function isolines(field,objectNormal,pitch,phase=0,specificLevels){
  const r=field.raster,n=field.cam.transform(objectNormal),values=new Float32Array(r.depth.length),levels=new Map(),step=pitch/field.map.scale;
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const i=y*r.width+x;values[i]=field.skin[i]?n[0]*(x+.5-r.ox)/r.scale+n[1]*(y+.5-r.oy)/r.scale+n[2]*r.depth[i]:NaN;}
  const shift=phase*step,maxJump=Math.max(3/field.map.scale,8/r.scale);
  for(let y=0;y<r.height-1;y++)for(let x=0;x<r.width-1;x++){
    const ids=[y*r.width+x,y*r.width+x+1,(y+1)*r.width+x+1,(y+1)*r.width+x],f=ids.map(i=>values[i]);
    if(!f.every(Number.isFinite))continue;
    const ds=ids.map(i=>r.depth[i]);if(Math.max(...ds)-Math.min(...ds)>maxJump)continue;
    const min=Math.min(...f),max=Math.max(...f);if(max-min<1e-10)continue;
    const candidates=specificLevels||null,k0=candidates?0:Math.ceil((min-shift)/step),k1=candidates?candidates.length-1:Math.floor((max-shift)/step);if(!candidates&&k1-k0>10)continue;
    for(let k=k0;k<=k1;k++){
      const level=candidates?candidates[k]:k*step+shift;if(level<min||level>max)continue;
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],hits=[];
      for(let e=0;e<4;e++){const j=(e+1)%4;if((f[e]>=level)===(f[j]>=level))continue;const t=(level-f[e])/(f[j]-f[e]);hits.push([mix(corners[e][0],corners[j][0],t),mix(corners[e][1],corners[j][1],t)]);}
      if(hits.length<2)continue;let bucket=levels.get(k);if(!bucket){bucket=[];levels.set(k,bucket);}
      if(hits.length===2)bucket.push(hits);else if(hits.length===4){const same=(f[0]>=level)===((f[0]+f[1]+f[2]+f[3])/4>=level);for(const [a,b]of(same?[[0,1],[2,3]]:[[0,3],[1,2]]))bucket.push([hits[a],hits[b]]);}
    }
  }
  return [...levels.entries()].sort((a,b)=>a[0]-b[0]).flatMap(([level,segs])=>joinSegments(segs).map(path=>({...path,level})));
}
function shadeAt(field,p,light){const q=fieldPoint(field,p[0],p[1]);if(!q)return null;const i=q.i*3,n=field.raster.normal;return 1-clamp(n[i]*light[0]+n[i+1]*light[1]+n[i+2]*light[2],0,1);}
function thinCurves(field,paths,options){
  const out=[],cell=Math.max(.12,options.clearance),grid=new Map();
  const near=(p,id)=>{const x=Math.floor(p[0]/cell),y=Math.floor(p[1]/cell);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const q of grid.get((x+dx)+','+(y+dy))||[])if(q.id!==id&&(q.p[0]-p[0])**2+(q.p[1]-p[1])**2<cell*cell)return true;return false;};
  const commit=(points,id)=>{for(const p of points){const key=Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push({p,id});}};
  let id=0;
  for(const path of paths){id++;let run=[];
    const flush=()=>{if(run.length>1&&length(run)>=options.minimum){const pts=simplify(run,options.simplify);if(pts.length>1){out.push({pts,closed:false,layer:options.pen});commit(run,id);}}run=[];};
    for(const q of path.pts){const p=toMM(field,q);let okay=true;
      if(options.light){const shade=shadeAt(field,q,options.light);okay=shade!==null&&shade>=options.threshold;}
      if(okay&&options.allow)okay=options.allow(q);
      if(okay&&!near(p,id))run.push(p);else flush();
    }
    flush();
  }
  return out;
}
function trimPolyline(points,start,end){
  const total=length(points),out=[];let position=0;if(total<=start+end)return out;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],segment=Math.hypot(b[0]-a[0],b[1]-a[1]);const lo=Math.max(0,(start-position)/segment),hi=Math.min(1,(total-end-position)/segment);
    if(hi>=lo&&hi>=0&&lo<=1){const p=lerp(a,b,clamp(lo,0,1)),q=lerp(a,b,clamp(hi,0,1));if(!out.length)out.push(p);out.push(q);}position+=segment;
  }return out;
}
function brush(field,mesh,p){
  const minLength=Math.max(p.brushWidth*3.3,5),source=mesh.landmarks||{},cuts=[source.ankle,source.knee,source.hip,source.shoulder,source.chin].filter(Number.isFinite);
  const paths=p.outline?outlines(field,p.cutEdges):[],candidates=[];let fragmentId=0;
  const objectAt=point=>field.cam.inverse([(point[0]-field.map.ox)/field.map.scale,(point[1]-field.map.oy)/field.map.scale,point[2]]);
  const soften=points=>{
    const distal=q=>{const v=objectAt(q);return v[2]<(source.ankle??-.45)+.012||(Math.abs(v[0])>.235&&v[2]<(source.shoulder??.3)-.08);};
    const result=[];let run=[],last=null;
    const flush=()=>{if(run.length){const reduced=simplify(run,p.brushWidth*(last?1.65:.3));if(result.length&&reduced.length)reduced.shift();result.push(...reduced);}run=[];};
    for(let i=0;i<points.length;i++){const flag=distal(points[i]);if(last!==null&&flag!==last){flush();if(i)run.push(points[i-1]);}last=flag;run.push(points[i]);}flush();return result;
  };
  for(const path of paths){const pts=path.closed?[...path.pts,path.pts[0]]:path.pts;let run=[];
    const flush=()=>{if(run.length>1){const id=fragmentId++;const clipped=trimPolyline(run,p.brushWidth*(.35+.35*hash(p.styleSeed,id*2)),p.brushWidth*(.35+.35*hash(p.styleSeed,id*2+1)));if(length(clipped)>=minLength){const simplified=soften(clipped);const z=simplified.reduce((s,q)=>s+objectAt(q)[2],0)/simplified.length;const x=simplified.reduce((s,q)=>s+q[0],0)/simplified.length;const bodyX=simplified.reduce((s,q)=>s+Math.abs(objectAt(q)[0]),0)/simplified.length;candidates.push({pts:simplified,closed:false,layer:p.outlinePen,z,x,bodyX,len:length(simplified)});}}run=[];};
    for(let i=0;i<pts.length;i++){if(i&&run.length){const z0=objectAt(pts[i-1])[2],z1=objectAt(pts[i])[2];if(cuts.some(c=>(z0-c)*(z1-c)<0))flush();}run.push(pts[i]);}flush();
  }
  // One broad anatomical curve supplies chest volume without rendering fine
  // face, finger or toe loops. Its plane is anchored to the same body landmarks.
  if(p.brushEconomy<.97&&Number.isFinite(source.chest)){
    const n=planeNormal(0),level=(source.chest+.035)*n[2];
    const features=isolines(field,n,30,0,[level]);
    const local=thinCurves(field,features,{clearance:p.brushWidth*1.15,minimum:minLength,simplify:p.brushWidth*.32,pen:p.detailPen,allow:q=>{const a=fieldPoint(field,q[0],q[1]);if(!a)return false;const v=field.cam.inverse(a.view);return Math.abs(v[0])<.15&&v[2]>(source.waist??-.05)&&v[2]<(source.shoulder??.3);}});
    for(const path of local){const z=source.chest;candidates.push({...path,z,x:path.pts.reduce((s,q)=>s+q[0],0)/path.pts.length,len:length(path.pts),feature:true});}
  }
  const fractions=field.view.mesh.cutFractions||[0,1],retained=fractions[1]-fractions[0];
  const maxPaths=Math.min(retained<.18?8:retained<.45?10:18,Math.round(mix(30,11,p.brushEconomy)));
  const ordered=candidates.map((path,i)=>({...path,rank:path.len*(path.feature?1.3:1)*(1+(hash(p.styleSeed,i)-.5)*.045)})).sort((a,b)=>b.rank-a.rank);
  const picked=[],used=new Set(),groups=new Map();
  for(const path of ordered){const z=path.z,region=path.feature?'feature':z>(source.chin??.38)?'head':z>(source.shoulder??.3)?'neck':z>(source.hip??.02)?((path.bodyX??0)<.13?'torso':'arm'):z>(source.knee??-.22)?((path.bodyX??0)>.14?'arm':'thigh'):z>(source.ankle??-.46)?'calf':'feet',side=region==='head'||region==='feature'?'c':path.x<field.map.W/2?'l':'r',key=region+side;if(!groups.has(key))groups.set(key,path);}
  for(const path of groups.values())if(picked.length<maxPaths){picked.push(path);used.add(path);}
  for(const path of ordered)if(picked.length<maxPaths&&!used.has(path)){picked.push(path);used.add(path);}
  // Trim intersecting/nearby broad centre lines as a physical brush clearance.
  const grid=new Map(),gap=p.brushWidth*1.15,result=[];
  const blocked=(q,id)=>{const x=Math.floor(q[0]/gap),y=Math.floor(q[1]/gap);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const point of grid.get((x+dx)+','+(y+dy))||[])if(point.id!==id&&Math.hypot(point.q[0]-q[0],point.q[1]-q[1])<gap)return true;return false;};
  picked.forEach((path,id)=>{const sampled=[];for(let i=1;i<path.pts.length;i++){const a=path.pts[i-1],b=path.pts[i],count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Math.max(.4,p.brushWidth*.3)));for(let j=i===1?0:1;j<=count;j++)sampled.push(lerp(a,b,j/count));}
    let run=[];const flush=()=>{if(length(run)>=minLength){let pts=simplify(run,p.brushWidth*.27).map(q=>q.slice(0,2));for(let iteration=0;iteration<2;iteration++){const curved=[pts[0]];for(let k=1;k<pts.length;k++)curved.push(lerp(pts[k-1],pts[k],.25),lerp(pts[k-1],pts[k],.75));curved.push(pts.at(-1));pts=curved;}if(pts.length>1){result.push({pts,closed:false,layer:path.layer});for(const q of run){const key=Math.floor(q[0]/gap)+','+Math.floor(q[1]/gap);if(!grid.has(key))grid.set(key,[]);grid.get(key).push({q,id});}}}run=[];};
    for(const q of sampled){if(blocked(q,id))flush();else run.push(q);}flush();
  });
  return result;
}
function thinOutline(field,p){return outlines(field,p.cutEdges).filter(path=>length(path.pts)>.8).map(path=>({pts:simplify(path.closed?[...path.pts,path.pts[0]]:path.pts,.045).map(q=>q.slice(0,2)),closed:false,layer:p.outlinePen}));}
function fine(field,p,pitch){
  const paths=p.outline?thinOutline(field,p):[],combined=p.style==='Contours + hatching';
  const phase=hash(p.styleSeed),a=p.lightAngle*Math.PI/180,light=unit([Math.cos(a)*.75,Math.sin(a)*.75,1]);
  if(p.style==='Contours'||combined){const spacing=pitch*(combined?2.45:1);const lines=isolines(field,planeNormal(p.contourAngle),spacing,phase);paths.push(...thinCurves(field,lines,{clearance:p.penWidth*2+.12,minimum:Math.max(.85,p.penWidth*3),simplify:.055,pen:p.detailPen}));}
  if(p.style==='Hatching'||combined){
    const lines=isolines(field,planeNormal(p.hatchAngle,.7),pitch,phase);
    paths.push(...thinCurves(field,lines,{clearance:p.penWidth*2+.12,minimum:Math.max(1,p.penWidth*3.5),simplify:.055,pen:p.shadePen,light,threshold:.27}));
    if(p.crosshatch>0){const crossing=isolines(field,planeNormal(p.hatchAngle-90,.65),pitch*1.1,hash(p.styleSeed,3));paths.push(...thinCurves(field,crossing,{clearance:p.penWidth*2+.12,minimum:Math.max(1.2,p.penWidth*4),simplify:.055,pen:p.shadePen,light,threshold:mix(.9,.45,p.crosshatch)}));}
  }
  return paths;
}
function limitBudget(paths,budget=108000){
  const count=paths.reduce((n,p)=>n+p.pts.length,0);if(count<=budget)return paths;
  const extra=Math.max(0,budget-paths.length*2),weights=paths.map(p=>Math.max(0,p.pts.length-2)),sum=weights.reduce((a,b)=>a+b,0)||1;
  return paths.map((path,i)=>{const n=2+Math.floor(extra*weights[i]/sum);if(path.pts.length<=n)return path;return {...path,pts:Array.from({length:n},(_,j)=>path.pts[Math.round(j*(path.pts.length-1)/(n-1))])};});
}
export function plotAvatar(mesh,viewOptions={},plotOptions={},ctx={}){
  const p=normalizeAvatarPlotOptions(plotOptions),requestedPitch=p.pitch;
  for(const key of ['outlinePen','detailPen','shadePen'])if(plotOptions[key]===undefined)p[key]=clamp(Math.round(num(ctx.pen??ctx.layer,0)),0,11);
  let effectivePitch=Math.max(p.pitch,p.penWidth*2),paths=[],adjusted=false;
  if(!mesh?.v||mesh.v.length<9||mesh.v.length%9)return {paths:[],stats:{style:p.style,requestedPitch,effectivePitch,brushWidth:p.brushWidth,penWidth:p.penWidth,minimumClearanceMm:p.style==='Brush'?p.brushWidth*1.15:p.penWidth*2,pathCount:0,pointCount:0,lengthMm:0,drawingScaleMm:0,referenceBounds:null,budgetAdjusted:false,sampleStepMm:0}};
  const field=getField(mesh,viewOptions,ctx);
  const samplingFloor=field.map.scale/field.raster.scale*.8;
  if(p.style!=='Brush'&&effectivePitch<samplingFloor){effectivePitch=samplingFloor;adjusted=true;}
  if(p.style==='Brush')paths=brush(field,mesh,p);else{
    for(let attempt=0;attempt<3;attempt++){paths=fine(field,p,effectivePitch);const count=paths.reduce((n,q)=>n+q.pts.length,0);if(count<=108000)break;effectivePitch*=Math.max(1.15,Math.sqrt(count/100000));adjusted=true;}
  }
  paths=limitBudget(paths).filter(path=>path.pts.length>1&&path.pts.every(q=>q.every(Number.isFinite)));
  const pointCount=paths.reduce((n,q)=>n+q.pts.length,0),lengthMm=paths.reduce((n,q)=>n+length(q.pts),0);
  return {paths,stats:{style:p.style,requestedPitch,effectivePitch,brushWidth:p.brushWidth,penWidth:p.penWidth,minimumClearanceMm:p.style==='Brush'?p.brushWidth*1.15:p.penWidth*2,pathCount:paths.length,pointCount,lengthMm,drawingScaleMm:field.map.scale,referenceBounds:field.view.referenceBounds,budgetAdjusted:adjusted,sampleStepMm:field.map.scale/field.raster.scale}};
}
