import { Pin, EMPTY, PENS } from "../helpers.js";

export default {
  key: "line_shadows",
  name: "Line Shadows", cat: "mod", group: "fillstyle",
  desc: "Hatch closed shapes, then fan the line-filled copies around a shared bounding-box edge. A tall rectangle with Line angle 90°, Hinge Bottom, 3 Layers and Fan angle 60° makes three overlapping shadow planes. Foreshorten compresses the tilted planes; turn it off for a pure shear. Holes use even-odd filling across all closed contours, independent of pen or winding; open paths are ignored. Shift / layer slides copies along the hinge. Single pen makes dark overlaps; Cycle pens colours the planes. Fit to margin centres the whole stack and shrinks only if necessary, scaling spacing too; Keep coordinates does not fit or clip. Spacing used mm reports source hatch spacing before projection/fit; Fit scale reports the uniform final scale. Dense requests increase spacing for the whole drawing. Inputs above 24k contour points or requests whose outlines alone exceed 118k output points return empty, rather than dropping later shapes/layers. Start with Container (Draw region on) or filled Lettering. Wire Frame to Fan angle or Shift for movement.",
  ins: [Pin("paths", "Shapes (closed)")],
  outs: [Pin("paths", "Drawing"), Pin("value", "Spacing used mm"), Pin("value", "Fit scale %")],
  params: [
    {key:"spacing",label:"Line spacing mm",type:"slider",min:.25,max:10,step:.05,def:1.3},
    {key:"angle",label:"Line angle °",type:"slider",min:0,max:180,step:1,def:90},
    {key:"layers",label:"Layers",type:"slider",min:1,max:12,step:1,def:3},
    {key:"fan",label:"Fan angle °",type:"slider",min:-80,max:80,step:1,def:60,showIf:p=>Math.round(+p.layers||1)>1},
    {key:"hinge",label:"Hinge edge",type:"select",options:["Bottom","Top","Left","Right"],def:"Bottom"},
    {key:"shorten",label:"Foreshorten",type:"check",def:true,showIf:p=>Math.round(+p.layers||1)>1},
    {key:"shift",label:"Shift / layer mm",type:"slider",min:-30,max:30,step:.25,def:0,showIf:p=>Math.round(+p.layers||1)>1},
    {key:"outlines",label:"Draw outlines",type:"check",def:false},
    {key:"penMode",label:"Pen mode",type:"select",options:["Single pen","Cycle pens"],def:"Single pen"},
    {key:"pen",label:"First pen",type:"pen",def:0},
    {key:"pens",label:"Pens used",type:"slider",min:2,max:6,step:1,def:3,showIf:p=>p.penMode==="Cycle pens"&&Math.round(+p.layers||1)>1},
    {key:"placement",label:"Placement",type:"select",options:["Fit to margin","Keep coordinates"],def:"Fit to margin"},
    {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:15,showIf:p=>p.placement!=="Keep coordinates"}
  ],
  _frame(ins,p,ctx){
    const num=(k,d,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(+p[k])?+p[k]:d));
    if(!(ctx?.W>0&&ctx?.H>0&&Number.isFinite(ctx.W)&&Number.isFinite(ctx.H)))return null;
    const regions=[];let points=0,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const q of ins?.[0]?.paths||[]){
      if(!q.closed||!Array.isArray(q.pts)||q.pts.length<3||q.pts.some(v=>!Array.isArray(v)||!Number.isFinite(v[0])||!Number.isFinite(v[1])))continue;
      const pts=q.pts.map(v=>[v[0],v[1]]);if(pts.length>3&&pts[0][0]===pts.at(-1)[0]&&pts[0][1]===pts.at(-1)[1])pts.pop();
      let noncollinear=false;const a=pts[0];let b=pts.find(v=>Math.hypot(v[0]-a[0],v[1]-a[1])>1e-9);if(!b)continue;
      for(const v of pts)if(Math.abs((b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0]))>1e-9){noncollinear=true;break;}
      if(!noncollinear)continue;points+=pts.length;if(points>24000)return null;regions.push(pts);
      for(const [x,y] of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    }
    if(!regions.length||x1-x0<1e-8||y1-y0<1e-8)return null;
    const count=Math.round(num('layers',3,1,12)),fan=num('fan',60,-80,80)*Math.PI/180,shift=num('shift',0,-1000,1000),hinge=p.hinge||'Bottom';
    const o=hinge==='Top'?[x0,y0]:hinge==='Left'?[x0,y0]:hinge==='Right'?[x1,y0]:[x0,y1];
    const t=hinge==='Left'||hinge==='Right'?[0,1]:[1,0],n=hinge==='Left'?[1,0]:hinge==='Right'?[-1,0]:hinge==='Top'?[0,1]:[0,-1];
    const project=(q,i)=>{const dx=q[0]-o[0],dy=q[1]-o[1],u=dx*t[0]+dy*t[1],v=dx*n[0]+dy*n[1],a=count>1?fan*i/(count-1):0,tu=u+v*Math.sin(a)+i*shift,nv=v*(p.shorten===false?1:Math.cos(a));return [o[0]+t[0]*tu+n[0]*nv,o[1]+t[1]*tu+n[1]*nv];};
    let bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;
    for(let i=0;i<count;i++)for(const pts of regions)for(const q of pts){const [x,y]=project(q,i);bx0=Math.min(bx0,x);by0=Math.min(by0,y);bx1=Math.max(bx1,x);by1=Math.max(by1,y);}
    if(![bx0,by0,bx1,by1,bx1-bx0,by1-by0].every(Number.isFinite))return null;
    const margin=num('margin',15,0,Math.max(0,Math.min(ctx.W,ctx.H)/2-.1));let scale=1,tx=0,ty=0;
    if(p.placement!=='Keep coordinates'){scale=Math.min(1,(ctx.W-2*margin)/(bx1-bx0),(ctx.H-2*margin)/(by1-by0));tx=ctx.W/2-(bx0+(bx1-bx0)/2)*scale;ty=ctx.H/2-(by0+(by1-by0)/2)*scale;}
    const map=(q,i)=>{const v=project(q,i);return [v[0]*scale+tx,v[1]*scale+ty];};
    return {regions,points,count,margin,scale,map,o,t,hingeLength:t[0]?x1-x0:y1-y0,num};
  },
  overlay(p,ctx,ins){
    const f=this._frame(ins,p,ctx);if(!f)return [];
    const end=[f.o[0]+f.t[0]*f.hingeLength,f.o[1]+f.t[1]*f.hingeLength];
    const guides=[{kind:'poly',pts:[f.map(f.o,0),f.map(end,0)]}];
    if(p.placement!=='Keep coordinates')guides.unshift({kind:'rect',x:f.margin,y:f.margin,w:ctx.W-2*f.margin,h:ctx.H-2*f.margin});return guides;
  },
  compute(ins,p,ctx){
    const f=this._frame(ins,p,ctx),empty=()=>[EMPTY,0,100];if(!f)return empty();
    const reserve=p.outlines?f.points*f.count:0,budget=118000-reserve;if(budget<2*f.count)return empty();
    const angle=f.num('angle',90,-3600,3600)*Math.PI/180,d=[Math.cos(angle),Math.sin(angle)],n=[-d[1],d[0]],edges=[];
    let lo=Infinity,hi=-Infinity;
    for(const pts of f.regions)for(let i=0;i<pts.length;i++){
      const A=pts[i],B=pts[(i+1)%pts.length],a=[A[0]*d[0]+A[1]*d[1],A[0]*n[0]+A[1]*n[1]],b=[B[0]*d[0]+B[1]*d[1],B[0]*n[0]+B[1]*n[1]];
      lo=Math.min(lo,a[1]);hi=Math.max(hi,a[1]);if(Math.abs(b[1]-a[1])>1e-10)edges.push(a[1]<b[1]?[a,b]:[b,a]);
    }
    if(!(hi>lo))return empty();
    let spacing=Math.max(f.num('spacing',1.3,.05,10000),(hi-lo)/6000),scan;
    for(let attempt=0;attempt<24;attempt++){
      const rows=Math.max(1,Math.floor((hi-lo)/spacing)),first=lo+(hi-lo-(rows-1)*spacing)/2,events=[];let work=0;
      for(const [a,b]of edges){const start=Math.max(0,Math.ceil((a[1]-first)/spacing-1e-10)),end=Math.min(rows-1,Math.ceil((b[1]-first)/spacing-1e-10)-1);if(start>end)continue;work+=end-start+1;events.push({start,end,a,b});}
      if(work*f.count<=budget){scan={rows,first,events};break;}
      if(rows===1)return empty();spacing*=Math.max(1.15,work*f.count/budget*1.05);
    }
    if(!scan)return empty();
    const starts=Array.from({length:scan.rows},()=>[]);for(const e of scan.events)starts[e.start].push(e);
    let active=[];const base=[];
    for(let row=0;row<scan.rows;row++){
      active=active.filter(e=>e.end>=row);active.push(...starts[row]);const v=scan.first+row*spacing;
      const hits=active.map(({a,b})=>a[0]+(b[0]-a[0])*(v-a[1])/(b[1]-a[1])).sort((a,b)=>a-b);
      for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>1e-8){let A=[hits[i]*d[0]+v*n[0],hits[i]*d[1]+v*n[1]],B=[hits[i+1]*d[0]+v*n[0],hits[i+1]*d[1]+v*n[1]];if(row%2)[A,B]=[B,A];base.push([A,B]);}
    }
    const paths=[],firstPen=Math.round(f.num('pen',0,0,PENS.length-1)),pens=Math.round(f.num('pens',3,2,PENS.length));
    for(let i=0;i<f.count;i++){
      const layer=p.penMode==='Cycle pens'?(firstPen+i%pens)%PENS.length:firstPen;
      for(const pts of base)paths.push({pts:pts.map(q=>f.map(q,i)),closed:false,layer});
      if(p.outlines)for(const pts of f.regions)paths.push({pts:pts.map(q=>f.map(q,i)),closed:true,layer});
    }
    return [{paths},spacing,f.scale*100];
  }
};
