import GifReceipt from "./gif_receipt.js";
import { Pin, EMPTY, hash2, applyStyle } from "../helpers.js";

export default {
 ...GifReceipt,
 key:"gif_gcode",name:"GIF to G-code",cat:"gen",group:"textimg",
 desc:"Turn every GIF frame into genuine pen-plotter paths. Choose Contours, Hatching, Contours + hatching, Crosshatching or Stipple. Contours join tonal boundaries into closed polylines, including holes; Simplify and Min path length reduce tiny machine moves. Line spacing is physical millimetres, with stable tonal levels and a fixed page-anchored screen across the animation. Crosshatching adds a second direction in shadows. Stipple draws real little closed circles, with fixed seeded density or tone-sized rings. These are actual XY strokes, without raster stroke-width tricks. Load a GIF to set ANIMATE Frames, then Play or select a Manual source frame. Every source frame visits each frame once with matching counts, Phase 0 and Cycles 1; Original timing samples the GIF delays. Scale, Rotation, offsets, Contain/Cover and Keep aspect ratio place the image; unlock for independent stretch. Channel, levels, brightness, contrast, gamma and inversion tune colour conversion. Dense requests coarsen the complete grid uniformly using a frame-independent bound. All frames are retained and saved with the project. Select the Drawing output and use GENERATE G-CODE for a still or ANIMATE G-code × N for a ZIP with one complete program per frame; SVG/DXF also work. Machine settings control the actual pen lift, speed and origin. Exporting does not run the machine. Auto starts with a 24-frame colour demo. GIF limits match GIF to Receipt: 20 MB / 240 frames / 4 million source canvas pixels, uniformly downsampled to at most 6 million frozen RGB pixels in total.",
 ins:[Pin("style","Style")],outs:[Pin("paths","Drawing"),Pin("paths","Contours"),Pin("paths","Shading")],
 params:[
  {key:"file",label:"GIF animation",type:"file",def:""},
  {key:"source",label:"Source",type:"select",options:["Auto","GIF file","Colour demo"],def:"Auto"},
  {key:"time",label:"Time source",type:"select",options:["Timeline","Manual"],def:"Timeline"},
  {key:"frame",label:"Source frame (0 = first)",type:"slider",min:0,max:239,step:1,def:0,showIf:p=>p.time==="Manual"},
  {key:"timing",label:"Timing",type:"select",options:["Every source frame","Original timing"],def:"Every source frame",showIf:p=>p.time!=="Manual"},
  {key:"phase",label:"Phase °",type:"slider",min:0,max:360,step:1,def:0,showIf:p=>p.time!=="Manual"},
  {key:"loops",label:"Cycles",type:"slider",min:0,max:8,step:1,def:1,showIf:p=>p.time!=="Manual"},
  {key:"drawing",label:"Drawing",type:"select",options:["Contours + hatching","Contours","Hatching","Crosshatching","Stipple"],def:"Contours + hatching"},
  {key:"contour",label:"Contour threshold %",type:"slider",min:1,max:99,step:1,def:50,showIf:p=>["Contours","Contours + hatching"].includes(p.drawing)},
  {key:"simplify",label:"Simplify mm",type:"slider",min:0,max:2,step:.05,def:.2,showIf:p=>["Contours","Contours + hatching"].includes(p.drawing)},
  {key:"outlinePen",label:"Contour pen",type:"pen",def:0,showIf:p=>["Contours","Contours + hatching"].includes(p.drawing)},
  {key:"pitch",label:"Line / dot spacing mm",type:"slider",min:.4,max:12,step:.1,def:1.5,showIf:p=>p.drawing!=="Contours"},
  {key:"hatchAngle",label:"Hatch angle °",type:"slider",min:-180,max:180,step:1,def:-35,showIf:p=>!["Contours","Stipple"].includes(p.drawing)},
  {key:"levels",label:"Tone levels",type:"slider",min:1,max:8,step:1,def:4,showIf:p=>!["Contours","Stipple"].includes(p.drawing)},
  {key:"shadow",label:"Crosshatch shadow %",type:"slider",min:0,max:99,step:1,def:60,showIf:p=>p.drawing==="Crosshatching"},
  {key:"serpentine",label:"Alternate line direction",type:"check",def:true,showIf:p=>!["Contours","Stipple"].includes(p.drawing)},
  {key:"cutoff",label:"White cutoff %",type:"slider",min:0,max:95,step:1,def:12,showIf:p=>p.drawing!=="Contours"},
  {key:"dotTone",label:"Stipple tone",type:"select",options:["Density","Size"],def:"Density",showIf:p=>p.drawing==="Stipple"},
  {key:"dotDiameter",label:"Dot diameter mm",type:"slider",min:.2,max:3,step:.1,def:.6,showIf:p=>p.drawing==="Stipple"},
  {key:"seed",label:"Seed",type:"seed",def:73,showIf:p=>p.drawing==="Stipple"&&p.dotTone!=="Size"},
  {key:"minLength",label:"Min path length mm",type:"slider",min:0,max:10,step:.1,def:.6},
  {key:"columns",label:"Sampling (columns)",type:"slider",min:32,max:384,step:1,def:256},
  {key:"fit",label:"Initial fit",type:"select",options:["Contain","Cover"],def:"Contain"},
  {key:"scale",label:"Scale %",type:"slider",min:5,max:300,step:1,def:100},
  {key:"aspect",label:"Keep aspect ratio",type:"check",def:true},
  {key:"scaleX",label:"Stretch X %",type:"slider",min:10,max:300,step:1,def:100,showIf:p=>!p.aspect},
  {key:"scaleY",label:"Stretch Y %",type:"slider",min:10,max:300,step:1,def:100,showIf:p=>!p.aspect},
  {key:"angle",label:"Rotation °",type:"slider",min:-180,max:180,step:1,def:0},
  {key:"x",label:"Offset X mm",type:"slider",min:-200,max:200,step:1,def:0},
  {key:"y",label:"Offset Y mm",type:"slider",min:-300,max:300,step:1,def:0},
  {key:"channel",label:"Colour channel",type:"select",options:["Luminance","Average","Red","Green","Blue","Darkest channel"],def:"Luminance"},
  {key:"brightness",label:"Brightness %",type:"slider",min:-100,max:100,step:1,def:0},
  {key:"contrast",label:"Contrast",type:"slider",min:.2,max:4,step:.05,def:1},
  {key:"gamma",label:"Gamma",type:"slider",min:.2,max:3,step:.05,def:1},
  {key:"black",label:"Black point %",type:"slider",min:0,max:90,step:1,def:0},
  {key:"white",label:"White point %",type:"slider",min:10,max:100,step:1,def:100},
  {key:"invert",label:"Invert image",type:"check",def:false},
  {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:12},
  {key:"layer",label:"Shading pen",type:"pen",def:0,showIf:p=>p.drawing!=="Contours"}
 ],
 _plotLayout(p,ctx,S){
  const F=this._layout(p,ctx,S);if(!F)return null;
  const hasContour=p.drawing==="Contours"||p.drawing==="Contours + hatching",onlyContour=p.drawing==="Contours",budget=onlyContour?105000:44000;
  if(hasContour){while(F.cols>1&&2*(F.cols+1)*(F.rows+1)>budget){F.cols--;F.rows=Math.max(1,Math.round(F.cols*F.fh/F.fw));}if(2*(F.cols+1)*(F.rows+1)>budget)return null;F.dx=F.fw/F.cols;F.dy=F.fh/F.rows;}
  const diagonal=Math.hypot(F.fw,F.fh),families=p.drawing==="Crosshatching"?2:1,shadeBudget=hasContour?65000:108000;
  let pitch=this._n(p.pitch,1.5,.05,1000),step;
  if(p.drawing==="Stipple"){
   while(12*Math.floor(F.fw/pitch)*Math.floor(F.fh/pitch)>shadeBudget)pitch*=1.025;
  }else{
   for(let i=0;i<1000;i++){step=Math.max(.15,pitch*.3);if(families*(Math.ceil(diagonal/pitch)+2)*(Math.ceil(diagonal/step)+3)<=shadeBudget)break;pitch*=1.025;}
  }
  return {...F,pitch,step,diagonal};
 },
 _sample(tones,F,x,y){
  const u=(x-F.m)/F.dx-.5,v=(y-F.m)/F.dy-.5,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
  const at=(a,b)=>a<0||b<0||a>=F.cols||b>=F.rows?1:tones.values[b*F.cols+a];
  return at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy;
 },
 _length(pts,closed=false){let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);if(closed&&pts.length>1)L+=Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1]);return L;},
 _simplify(pts,tolerance,closed){
  if(tolerance<=0||pts.length<4)return pts;
  const rdp=points=>{
   const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]],tol2=tolerance*tolerance;
   while(stack.length){const [a,b]=stack.pop(),A=points[a],B=points[b],dx=B[0]-A[0],dy=B[1]-A[1],l=dx*dx+dy*dy;let best=tol2,index=-1;
    for(let i=a+1;i<b;i++){const P=points[i],t=l?Math.max(0,Math.min(1,((P[0]-A[0])*dx+(P[1]-A[1])*dy)/l)):0,d=(P[0]-A[0]-t*dx)**2+(P[1]-A[1]-t*dy)**2;if(d>best){best=d;index=i;}}
    if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}
   }return points.filter((_,i)=>keep[i]);
  };
  if(!closed)return rdp(pts);
  let far=1,dist=-1;for(let i=1;i<pts.length;i++){const d=(pts[i][0]-pts[0][0])**2+(pts[i][1]-pts[0][1])**2;if(d>dist){dist=d;far=i;}}
  const a=rdp(pts.slice(0,far+1)),b=rdp([...pts.slice(far),pts[0]]);return [...a.slice(0,-1),...b.slice(0,-1)];
 },
 _contours(p,tones,F){
  const threshold=this._n(p.contour,50,1,99)/100,vertices=new Map(),segments=[],adj=new Map(),C=F.cols,R=F.rows;
  const at=(x,y)=>x<0||y<0||x>=C||y>=R?1:tones.values[y*C+x],pos=(x,y)=>[x<0?F.m:x>=C?F.m+F.fw:F.m+(x+.5)*F.dx,y<0?F.m:y>=R?F.m+F.fh:F.m+(y+.5)*F.dy];
  const point=(x,y,edge,v)=>{
   const pairs=[[[x,y],[x+1,y]],[[x+1,y],[x+1,y+1]],[[x,y+1],[x+1,y+1]],[[x,y],[x,y+1]]],indices=[[0,1],[1,2],[3,2],[0,3]],ids=['h:'+x+':'+y,'v:'+(x+1)+':'+y,'h:'+x+':'+(y+1),'v:'+x+':'+y],id=ids[edge];
   if(!vertices.has(id)){const [a,b]=pairs[edge],[ia,ib]=indices[edge],A=pos(...a),B=pos(...b),t=Math.max(0,Math.min(1,(threshold-v[ia])/(v[ib]-v[ia])));vertices.set(id,[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}return id;
  };
  const link=(a,b)=>{const i=segments.length;segments.push([a,b]);for(const id of [a,b]){if(!adj.has(id))adj.set(id,[]);adj.get(id).push(i);}};
  for(let y=-1;y<R;y++)for(let x=-1;x<C;x++){
   const v=[at(x,y),at(x+1,y),at(x+1,y+1),at(x,y+1)],code=v.reduce((n,t,i)=>n|(t<threshold?1<<i:0),0);let pairs=[];
   if([1,14].includes(code))pairs=[[3,0]];else if([2,13].includes(code))pairs=[[0,1]];else if([3,12].includes(code))pairs=[[3,1]];else if([4,11].includes(code))pairs=[[1,2]];else if([6,9].includes(code))pairs=[[0,2]];else if([7,8].includes(code))pairs=[[3,2]];
   else if(code===5||code===10){const center=v.reduce((a,b)=>a+b,0)/4<threshold;pairs=(code===5?center:!center)?[[0,1],[2,3]]:[[3,0],[1,2]];}
   for(const [a,b]of pairs)link(point(x,y,a,v),point(x,y,b,v));
  }
  const used=new Uint8Array(segments.length),paths=[],tolerance=this._n(p.simplify,.2,0,10),minimum=this._n(p.minLength,.6,0,1000),layer=Math.round(this._n(p.outlinePen,0,0,11));
  for(let i=0;i<segments.length;i++)if(!used[i]){
   const start=segments[i][0];let id=start,edge=i,closed=false;const pts=[vertices.get(id)];
   while(edge!==undefined&&!used[edge]){used[edge]=1;const [a,b]=segments[edge];id=id===a?b:a;if(id===start){closed=true;break;}const P=vertices.get(id);if(Math.hypot(P[0]-pts.at(-1)[0],P[1]-pts.at(-1)[1])>1e-9)pts.push(P);edge=adj.get(id)?.find(j=>!used[j]);}
   if(closed&&pts.length>1&&Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<1e-9)pts.pop();
   const simple=this._simplify(pts,tolerance,closed);if(simple.length>=(closed?3:2)&&this._length(simple,closed)>=minimum)paths.push({pts:simple,closed,layer});
  }return paths;
 },
 _hatches(p,tones,F){
  const paths=[],families=p.drawing==="Crosshatching"?2:1,levels=Math.round(this._n(p.levels,4,1,8)),cutoff=this._n(p.cutoff,12,0,95)/100,shadow=Math.max(cutoff,this._n(p.shadow,60,0,99)/100),minimum=this._n(p.minLength,.6,0,1000),layer=Math.round(this._n(p.layer,0,0,11));
  const rows=Math.ceil(F.diagonal/F.pitch)+1,cx=F.W/2,cy=F.H/2;
  for(let family=0;family<families;family++){
   const angle=(this._n(p.hatchAngle,-35,-1e9,1e9)+family*90)*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
   for(let i=0;i<rows;i++){
    const offset=(i-(rows-1)/2)*F.pitch,ox=cx+nx*offset,oy=cy+ny*offset,base=family?shadow:cutoff,limit=base+(1-base)*(i%levels)/levels;
    let lo=-F.diagonal/2,hi=F.diagonal/2;
    for(const [o,d,min,max]of [[ox,dx,F.m,F.m+F.fw],[oy,dy,F.m,F.m+F.fh]]){if(Math.abs(d)<1e-12){if(o<min||o>max){lo=1;hi=0;break;}}else{const a=(min-o)/d,b=(max-o)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}}
    if(hi<=lo)continue;const samples=Math.max(1,Math.ceil((hi-lo)/F.step)),map=t=>[Math.max(F.m,Math.min(F.m+F.fw,ox+dx*t)),Math.max(F.m,Math.min(F.m+F.fh,oy+dy*t))],value=t=>1-this._sample(tones,F,...map(t))-limit;
    let previous=lo,prev=value(lo),start=prev>0?lo:null;
    const push=end=>{if(start!==null&&end-start>=Math.max(.002,minimum)){const pts=[map(start),map(end)];if(p.serpentine!==false&&i%2)pts.reverse();paths.push({pts,closed:false,layer});}start=null;};
    for(let j=1;j<=samples;j++){const t=lo+(hi-lo)*j/samples,v=value(t);if((prev>0)!==(v>0)){const edge=previous+(t-previous)*prev/(prev-v);if(v>0)start=edge;else push(edge);}previous=t;prev=v;}
    if(start!==null)push(hi);
   }
  }return paths;
 },
 _stipple(p,tones,F){
  const paths=[],cols=Math.floor(F.fw/F.pitch),rows=Math.floor(F.fh/F.pitch),x0=F.W/2-cols*F.pitch/2,y0=F.H/2-rows*F.pitch/2,cutoff=this._n(p.cutoff,12,0,95)/100,radius=Math.min(F.pitch*.45,this._n(p.dotDiameter,.6,.05,20)/2),seed=Math.round(this._n(p.seed,73,-2147483648,2147483647)),minimum=this._n(p.minLength,.6,0,1000),layer=Math.round(this._n(p.layer,0,0,11));
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const cx=x0+(x+.5)*F.pitch,cy=y0+(y+.5)*F.pitch,density=Math.max(0,Math.min(1,(1-this._sample(tones,F,cx,cy)-cutoff)/(1-cutoff)));if(!density)continue;
   let r=radius;if(p.dotTone==="Size")r*=Math.sqrt(density);else if(density<=hash2(x,y,seed))continue;
   if(r<.01)continue;
   const pts=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});if(this._length(pts,true)>=minimum)paths.push({pts,closed:true,layer});
  }return paths;
 },
 compute(ins,p,ctx,node){
  const empty=()=>[EMPTY,EMPTY,EMPTY],S=this._sequence(p,node);if(!S)return empty();const F=this._plotLayout(p,ctx,S);if(!F)return empty();const sourceFrame=this._index(p,ctx,S),rgb=this._rgb(S,sourceFrame);if(!rgb)return empty();
  const tones=this._tones(p,S,rgb,F),contours=["Contours","Contours + hatching"].includes(p.drawing)?this._contours(p,tones,F):[],shading=p.drawing==="Stipple"?this._stipple(p,tones,F):p.drawing==="Contours"?[]:this._hatches(p,tones,F),paths=[...contours,...shading];
  if(paths.reduce((n,q)=>n+q.pts.length,0)>120000)return empty();
  const styled=applyStyle({paths},ins?.[0]),outline=applyStyle({paths:contours},ins?.[0]),tone=applyStyle({paths:shading},ins?.[0]);if(styled.paths.reduce((n,q)=>n+q.pts.length,0)>120000)return empty();
  return [{...styled,sourceFrame,sourceFrames:S.frames.length,effectiveSpacing:F.pitch,effectiveColumns:F.cols,rows:F.rows},outline,tone];
 }

};
