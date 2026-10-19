import { Pin, EMPTY, resample, pathLength } from "../helpers.js";

export default {
 key:'marbling',name:'Marbling',cat:'mod',group:'deform',
 desc:'Move any drawing like ink on water. Drop pushes ink radially, Rake pulls one flowing current, Comb repeats that pull across parallel tines, and Swirl turns ink around a soft centre. Direction sets the rake/comb axis. Phase animates the force (one full cycle returns to its starting state). Centre uses canvas percentages; Radius is the falloff width, not a hard boundary. Strength 0 preserves the original drawing. Geometry is resampled uniformly before deformation; very dense sources coarsen sampling across all paths. No fit or crop is applied, so displaced ink can leave the sheet. Use Crop or Test crop afterwards. This first version uses repeatable parameter-driven gestures rather than recording mouse strokes. Maximum 20k paths / 120k source points.',
 ins:[Pin('paths','Drawing')],outs:[Pin('paths')],
 params:[
  {key:'mode',label:'Tool',type:'select',options:['Drop','Rake','Comb','Swirl'],def:'Comb'},
  {key:'cx',label:'Centre X %',type:'slider',min:0,max:100,step:1,def:50},
  {key:'cy',label:'Centre Y %',type:'slider',min:0,max:100,step:1,def:50},
  {key:'radius',label:'Radius mm',type:'slider',min:1,max:180,step:1,def:50},
  {key:'strength',label:'Strength %',type:'slider',min:-100,max:100,step:1,def:65},
  {key:'angle',label:'Direction °',type:'slider',min:-180,max:180,step:1,def:0,showIf:p=>p.mode==='Rake'||p.mode==='Comb'},
  {key:'travel',label:'Pull mm',type:'slider',min:0,max:100,step:1,def:35,showIf:p=>p.mode==='Rake'||p.mode==='Comb'},
  {key:'tines',label:'Comb tines',type:'slider',min:2,max:30,step:1,def:9,showIf:p=>p.mode==='Comb'},
  {key:'spacing',label:'Tine spacing mm',type:'slider',min:1,max:30,step:.5,def:10,showIf:p=>p.mode==='Comb'},
  {key:'phase',label:'Phase °',type:'slider',min:0,max:360,step:1,def:0},
  {key:'step',label:'Sample mm',type:'slider',min:.3,max:4,step:.1,def:1}
 ],
 overlay(p,c){const x=c.W*(+p.cx||0)/100,y=c.H*(+p.cy||0)/100,r=Math.max(1,+p.radius||50),a=(+p.angle||0)*Math.PI/180;return [{kind:'circle',cx:x,cy:y,r},{kind:'arrow',x1:x,y1:y,x2:x+Math.cos(a)*r,y2:y+Math.sin(a)*r}];},
 compute(ins,p,ctx){
  const src=ins[0]||EMPTY,paths=src.paths||[];if(paths.length>20000||paths.reduce((n,q)=>n+q.pts.length,0)>120000)return EMPTY;
  const n=(k,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+p[k])?+p[k]:d));
  const s=n('strength',65,-100,100)/100;if(s===0)return src;
  const x0=ctx.W*n('cx',50,-100,200)/100,y0=ctx.H*n('cy',50,-100,200)/100,r=n('radius',50,1,500),a=n('angle',0,-3600,3600)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
  const phase=n('phase',0,-1e6,1e6)*Math.PI/180,force=s*Math.cos(phase),count=p.mode==='Comb'?Math.round(n('tines',9,2,30)):1,gap=n('spacing',10,1,100),travel=n('travel',35,0,200);
  const total=paths.reduce((v,q)=>v+pathLength(q.pts,q.closed),0),step=Math.max(n('step',1,.3,20),total/Math.max(1,110000-paths.length*2));
  const warp=([x,y])=>{const dx=x-x0,dy=y-y0,d=Math.hypot(dx,dy),w=Math.exp(-d*d/(r*r));
   if(p.mode==='Swirl'){const t=force*2*Math.PI*w,c=Math.cos(t),sn=Math.sin(t);return [x0+dx*c-dy*sn,y0+dx*sn+dy*c];}
   if(p.mode==='Drop'){if(d<1e-9)return [x0,y0];const dd=Math.sqrt(Math.max(.001,d*d+force*r*r*w));return [x0+dx*dd/d,y0+dy*dd/d];}
   const u=dx*ca+dy*sa,v=-dx*sa+dy*ca,wr=p.mode==='Comb'?Math.max(.5,Math.min(r,gap*.24)):r;let pull=0;
   for(let i=0;i<count;i++){const q=v-(i-(count-1)/2)*gap;pull+=Math.exp(-q*q/(wr*wr));}
   pull*=travel*force*Math.exp(-u*u/(4*r*r));return [x+ca*pull,y+sa*pull];
  };
  return {paths:paths.map(q=>({...q,pts:resample(q.pts,q.closed,step).map(warp)}))};
 }
};
