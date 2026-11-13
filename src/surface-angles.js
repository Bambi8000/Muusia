import { createStrip, stripCorners, stripTransform } from "./surface-composer.js";

const TAU = Math.PI * 2;
const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1]];
const norm = a => (a % TAU + TAU) % TAU;
export const formatEdgeAngle = angle => `${Number(angle.toFixed(1))}°`;

/** Angles are the actual open sectors between two physical edges, not the
 * signed difference of paper rotations. Covered intersections do not appear; visible seams may meet over a lower
 * paper. End labels are temporary and excluded. */
export function surfaceEdgeAngles(input) {
  const papers = input.map((p,i) => ({...createStrip(p),number:i+1,stackIndex:i})).filter(p=>p.visible);
  if (papers.length > 128) throw new Error("Edge angle marks support up to 128 visible papers.");
  const extent = Math.max(1,...papers.flatMap(p=>[p.physicalWidthMm,p.lengthMm]));
  const eps = extent * 1e-9, events = new Map(), edges = [], transforms = papers.map(stripTransform);
  for (const p of papers) {
    const corners = stripCorners(p);
    for (let i=0;i<4;i++) edges.push({a:corners[i],b:corners[(i+1)%4],paper:p,edge:['AB','BC','CD','DA'][i]});
  }
  function addEvent(point) {
    const x=Math.round(point[0]/eps),y=Math.round(point[1]/eps);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) {
      const existing=events.get(`${x+dx},${y+dy}`);
      if(existing && Math.hypot(existing[0]-point[0],existing[1]-point[1])<eps*2)return;
    }
    events.set(`${x},${y}`,point);
  }
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++) {
    const a=edges[i],b=edges[j];if(a.paper.id===b.paper.id)continue;
    const u=sub(a.b,a.a),v=sub(b.b,b.a),delta=sub(b.a,a.a),den=cross(u,v);
    if(Math.abs(den)<1e-12*Math.hypot(...u)*Math.hypot(...v))continue; // Parallel lines have no unique vertex.
    const t=cross(delta,v)/den,s=cross(delta,u)/den;
    if(t>=-1e-10&&t<=1+1e-10&&s>=-1e-10&&s<=1+1e-10) addEvent([a.a[0]+t*u[0],a.a[1]+t*u[1]]);
  }
  const result=[];
  for(const point of events.values()) {
    const raw=[];
    for(const edge of edges) {
      const u=sub(edge.b,edge.a),v=sub(point,edge.a),length=Math.hypot(...u),t=(u[0]*v[0]+u[1]*v[1])/(length*length);
      if(t < -1e-9 || t > 1+1e-9 || Math.abs(cross(u,v))/length>eps*3)continue;
      for(const end of [edge.a,edge.b]){
        const d=sub(end,point),reach=Math.hypot(...d);
        if(reach>eps*10)raw.push({angle:norm(Math.atan2(d[1],d[0])),reach,owners:[{paperId:edge.paper.id,number:edge.paper.number,edge:edge.edge,zIndex:edge.paper.zIndex,stackIndex:edge.paper.stackIndex}]});
      }
    }
    // Only edges visible in the actual layer stack form diagram junctions.
    const visibleRays = raw.filter(ray => {
      const distance = Math.min(ray.reach, extent) * 1e-5;
      const probe = [point[0]+Math.cos(ray.angle)*distance,point[1]+Math.sin(ray.angle)*distance];
      return !papers.some((p,k) => {
        if (p.zIndex < ray.owners[0].zIndex || (p.zIndex === ray.owners[0].zIndex && p.stackIndex <= ray.owners[0].stackIndex)) return false;
        const [x,y]=transforms[k].toLocal(probe);
        return x>eps&&x<p.physicalWidthMm-eps&&y>eps&&y<p.lengthMm-eps;
      });
    });
    visibleRays.sort((a,b)=>a.angle-b.angle);
    const rays=[];
    for(const ray of visibleRays){const last=rays.at(-1);if(last&&Math.abs(ray.angle-last.angle)<1e-8){last.owners.push(...ray.owners);last.reach=Math.min(last.reach,ray.reach);}else rays.push(ray);}
    if(rays.length<2)continue;
    for(let i=0;i<rays.length;i++) {
      const a=rays[i],b=rays[(i+1)%rays.length],sweep=norm(b.angle-a.angle);
      if(sweep<1e-5||sweep>TAU-1e-5||Math.abs(sweep-Math.PI)<1e-8)continue;
      const owners=a.owners.flatMap(one=>b.owners.filter(two=>two.paperId!==one.paperId).map(two=>[one,two]));
      if(!owners.length)continue;
      const distance=Math.min(a.reach,b.reach,...papers.flatMap(p=>[p.physicalWidthMm,p.lengthMm]))*1e-4;
      const mid=a.angle+sweep/2,probe=[point[0]+Math.cos(mid)*distance,point[1]+Math.sin(mid)*distance];
      const covered=papers.some((p,k)=>{if(!owners[0].some(o=>o.paperId===p.id))return false;const [x,y]=transforms[k].toLocal(probe);return x>eps&&x<p.physicalWidthMm-eps&&y>eps&&y<p.lengthMm-eps;});
      if(covered)continue;
      const [from,to]=owners[0];
      result.push({vertex:[...point],startRad:a.angle,sweepRad:sweep,angleDeg:sweep*180/Math.PI,from,to,reachMm:Math.min(a.reach,b.reach)});
    }
  }
  result.sort((a,b)=>a.vertex[1]-b.vertex[1]||a.vertex[0]-b.vertex[0]||a.startRad-b.startRad);
  return result.map((r,i)=>({...r,id:`J${i+1}`}));
}

/** All diagram geometry uses the same radius in page/preview units. */
export function edgeAngleArc(angle, centre, radius) {
  const count=Math.max(4,Math.ceil(angle.sweepRad/(Math.PI/24)));
  return Array.from({length:count+1},(_,i)=>{
    const a=angle.startRad+angle.sweepRad*i/count;
    return [centre[0]+radius*Math.cos(a),centre[1]+radius*Math.sin(a)];
  });
}
