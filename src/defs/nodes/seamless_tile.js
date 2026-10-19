import { Pin, EMPTY } from "../helpers.js";

export default {
 key:'seamless_tile',name:'Seamless Tile',cat:'mod',group:'transform',
 desc:'Wrap any line drawing across a periodic tile. A line leaving one side continues on the opposite side; clipped closed paths become open fragments, without artificial tile-edge strokes. Straight has one cell per export unit. Half drop uses a two-column unit; Mirror uses a 2×2 reflected unit, so the rectangular export repeats correctly. Fit motif sizes your source relative to one cell, Actual mm preserves its dimensions before Scale. Shift moves the motif through the periodic boundary. Single unit is true millimetres, centred on the canvas; 3×3 preview shrinks the full repeat only when needed to fit Margin. Export Single unit for the repeat master. Source pens remain intact. Work above 1M segment clips / 118k result points is rejected rather than exporting an incomplete tile.',
 ins:[Pin('paths','Motif')],outs:[Pin('paths')],
 params:[
  {key:'repeat',label:'Repeat',type:'select',options:['Straight','Half drop','Mirror'],def:'Straight'},
  {key:'width',label:'Cell width mm',type:'slider',min:5,max:200,step:1,def:70},
  {key:'height',label:'Cell height mm',type:'slider',min:5,max:200,step:1,def:50},
  {key:'fit',label:'Source size',type:'select',options:['Fit motif','Actual mm'],def:'Fit motif'},
  {key:'scale',label:'Scale %',type:'slider',min:1,max:300,step:1,def:90},
  {key:'shiftX',label:'Shift X mm',type:'slider',min:-100,max:100,step:1,def:25},
  {key:'shiftY',label:'Shift Y mm',type:'slider',min:-100,max:100,step:1,def:0},
  {key:'view',label:'Drawing',type:'select',options:['Single unit','3×3 preview'],def:'3×3 preview'},
  {key:'margin',label:'Preview margin mm',type:'slider',min:0,max:60,step:1,def:12,showIf:p=>p.view==='3×3 preview'}
 ],
 _layout(p,c){const w=Math.max(5,Math.min(500,Number.isFinite(+p.width)?+p.width:70)),h=Math.max(5,Math.min(500,Number.isFinite(+p.height)?+p.height:50)),uw=w*(p.repeat==='Straight'?1:2),uh=h*(p.repeat==='Mirror'?2:1),n=p.view==='Single unit'?1:3,m=Math.max(0,Math.min(Math.min(c.W,c.H)/2,+p.margin||0)),s=n===1?1:Math.max(0,Math.min(1,(c.W-2*m)/(uw*n),(c.H-2*m)/(uh*n)));return {w,h,uw,uh,n,s,x:(c.W-uw*n*s)/2,y:(c.H-uh*n*s)/2};},
 overlay(p,c){const f=this._layout(p,c),out=[];for(let j=0;j<f.n;j++)for(let i=0;i<f.n;i++)out.push({kind:'rect',x:f.x+i*f.uw*f.s,y:f.y+j*f.uh*f.s,w:f.uw*f.s,h:f.uh*f.s});return out;},
 compute(ins,p,c){
  const src=ins[0]||EMPTY;if(!src.paths.length||src.paths.length>12000||src.paths.reduce((n,q)=>n+q.pts.length,0)>120000)return EMPTY;
  const f=this._layout(p,c);if(!f.s)return EMPTY;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const q of src.paths)for(const [x,y]of q.pts){if(!Number.isFinite(x+y))return EMPTY;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const sc=(p.fit==='Actual mm'?1:Math.min(f.w/Math.max(.001,x1-x0),f.h/Math.max(.001,y1-y0)))*Math.max(.01,Math.min(5,(Number.isFinite(+p.scale)?+p.scale:90)/100)),cx=(x0+x1)/2,cy=(y0+y1)/2,sx=Number.isFinite(+p.shiftX)?+p.shiftX:0,sy=Number.isFinite(+p.shiftY)?+p.shiftY:0;
  const seeds=[];for(let j=0;j<(p.repeat==='Mirror'?2:1);j++)for(let i=0;i<(p.repeat==='Straight'?1:2);i++)for(const q of src.paths)seeds.push({...q,pts:q.pts.map(([x,y])=>[(x-cx)*sc*(p.repeat==='Mirror'&&i?-1:1)+(i+.5)*f.w+sx,(y-cy)*sc*(p.repeat==='Mirror'&&j?-1:1)+(j+.5)*f.h+sy+(p.repeat==='Half drop'&&i?f.h/2:0)])});
  const clip=(a,b)=>{let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const [u,v]of [[-dx,a[0]],[dx,f.uw-a[0]],[-dy,a[1]],[dy,f.uh-a[1]]]){if(Math.abs(u)<1e-12){if(v<0)return null;}else{const t=v/u;if(u<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return [[a[0]+lo*dx,a[1]+lo*dy],[a[0]+hi*dx,a[1]+hi*dy]];};
  const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7,unit=[];let work=0,points=0;
  for(const q of seeds){let ax=Infinity,ay=Infinity,bx=-Infinity,by=-Infinity;for(const [x,y]of q.pts){ax=Math.min(ax,x);ay=Math.min(ay,y);bx=Math.max(bx,x);by=Math.max(by,y);}
   const il=Math.ceil(-bx/f.uw),ir=Math.floor((f.uw-ax)/f.uw),jl=Math.ceil(-by/f.uh),jr=Math.floor((f.uh-ay)/f.uh);if((ir-il+1)*(jr-jl+1)*q.pts.length>1e6)return EMPTY;
   for(let j=jl;j<=jr;j++)for(let i=il;i<=ir;i++){
    const pts=q.pts.map(v=>[v[0]+i*f.uw,v[1]+j*f.uh]);if(pts.every(v=>v[0]>=0&&v[0]<=f.uw&&v[1]>=0&&v[1]<=f.uh)){unit.push({...q,pts});points+=pts.length;continue;}
    const fragments=[];let cur=[];for(let k=0;k<pts.length-(q.closed?0:1);k++){if(++work>1e6)return EMPTY;const s=clip(pts[k],pts[(k+1)%pts.length]);if(!s||same(s[0],s[1])){if(cur.length>1)fragments.push(cur);cur=[];continue;}if(cur.length&&same(cur.at(-1),s[0]))cur.push(s[1]);else{if(cur.length>1)fragments.push(cur);cur=s;}}
    if(cur.length>1)fragments.push(cur);if(q.closed&&fragments.length>1&&same(fragments.at(-1).at(-1),fragments[0][0])){fragments[0]=[...fragments.pop().slice(0,-1),...fragments[0]];}
    for(const pts of fragments){unit.push({pts,closed:false,layer:q.layer});points+=pts.length;}
   }if(points*f.n*f.n>118000)return EMPTY;
  }
  const paths=[];for(let j=0;j<f.n;j++)for(let i=0;i<f.n;i++)for(const q of unit)paths.push({...q,pts:q.pts.map(([x,y])=>[f.x+(x+i*f.uw)*f.s,f.y+(y+j*f.uh)*f.s])});return {paths};
 }
};
