import { Pin, EMPTY, applyStyle } from "../helpers.js";

export default {
 key:"gif_receipt",name:"GIF to Receipt",cat:"gen",group:"textimg",
 fileBinary:true,fileAnimation:true,fileLabel:"Choose animated GIF…",fileAccept:".gif,image/gif",
 desc:"Open an animated GIF and turn every frame into monochrome receipt linework. Loading a file sets ANIMATE Frames to its source frame count. Timeline with Every source frame exports each source frame once when those counts match; Original timing samples the GIF delays. Manual selects a still. Scale and Rotation place the image; Keep aspect ratio preserves its proportions, with independent Stretch X/Y available when unlocked. Position offsets and Margin crop the image to the paper. Conversion offers stable Bayer screens, Floyd–Steinberg, Atkinson or Threshold; Channel, Brightness, Contrast, Gamma, Black/White points, Threshold and Invert tune colour-to-black reproduction. Ordered screens stay fixed during motion; error diffusion can change neighbouring dots between frames. Detail sets requested columns; a fixed whole-page budget can lower it uniformly for every frame. Native receipt strokes use the same dot size as preview/SVG. Drawing → Outlines leaves white areas for colouring by hand; Ink amount lightens halftones. Press Play, then Receipt × N for separate registered frames or Receipt strip × N for one continuous paper strip. The strip has no cuts or extra feeds between frames; the Cut setting applies only at its end. Downloads do not print. Auto starts with a 24-frame colour demo before a file is chosen. GIF file explicitly requires a file. All decoded frames are kept, with uniform downsampling if needed. GIF parsing follows the GIF89a image-frame format; browser decoding happens only on import, and the frozen RGB frames travel in the saved project.",
 ins:[Pin("style","Style")],outs:[Pin("paths","Drawing")],
 params:[
  {key:"file",label:"GIF animation",type:"file",def:""},
  {key:"source",label:"Source",type:"select",options:["Auto","GIF file","Colour demo"],def:"Auto"},
  {key:"time",label:"Time source",type:"select",options:["Timeline","Manual"],def:"Timeline"},
  {key:"frame",label:"Source frame (0 = first)",type:"slider",min:0,max:239,step:1,def:0,showIf:p=>p.time==="Manual"},
  {key:"timing",label:"Timing",type:"select",options:["Every source frame","Original timing"],def:"Every source frame",showIf:p=>p.time!=="Manual"},
  {key:"phase",label:"Phase °",type:"slider",min:0,max:360,step:1,def:0,showIf:p=>p.time!=="Manual"},
  {key:"loops",label:"Cycles",type:"slider",min:0,max:8,step:1,def:1,showIf:p=>p.time!=="Manual"},
  {key:"fit",label:"Initial fit",type:"select",options:["Contain","Cover"],def:"Contain"},
  {key:"scale",label:"Scale %",type:"slider",min:5,max:300,step:1,def:100},
  {key:"aspect",label:"Keep aspect ratio",type:"check",def:true},
  {key:"scaleX",label:"Stretch X %",type:"slider",min:10,max:300,step:1,def:100,showIf:p=>!p.aspect},
  {key:"scaleY",label:"Stretch Y %",type:"slider",min:10,max:300,step:1,def:100,showIf:p=>!p.aspect},
  {key:"angle",label:"Rotation °",type:"slider",min:-180,max:180,step:1,def:0},
  {key:"x",label:"Offset X mm",type:"slider",min:-200,max:200,step:1,def:0},
  {key:"y",label:"Offset Y mm",type:"slider",min:-300,max:300,step:1,def:0},
  {key:"render",label:"Drawing",type:"select",options:["Halftone","Outlines","Outlines + light tone"],def:"Halftone"},
  {key:"ink",label:"Ink amount %",type:"slider",min:0,max:100,step:1,def:100,showIf:p=>p.render!=="Outlines"},
  {key:"edge",label:"Outline threshold %",type:"slider",min:1,max:100,step:1,def:18,showIf:p=>p.render!=="Halftone"},
  {key:"channel",label:"Colour channel",type:"select",options:["Luminance","Average","Red","Green","Blue","Darkest channel"],def:"Luminance"},
  {key:"mode",label:"Monochrome",type:"select",options:["Bayer 8×8","Bayer 4×4","Floyd–Steinberg","Atkinson","Threshold"],def:"Bayer 8×8",showIf:p=>p.render!=="Outlines"},
  {key:"brightness",label:"Brightness %",type:"slider",min:-100,max:100,step:1,def:0},
  {key:"contrast",label:"Contrast",type:"slider",min:.2,max:4,step:.05,def:1},
  {key:"gamma",label:"Gamma",type:"slider",min:.2,max:3,step:.05,def:1},
  {key:"black",label:"Black point %",type:"slider",min:0,max:90,step:1,def:0},
  {key:"white",label:"White point %",type:"slider",min:10,max:100,step:1,def:100},
  {key:"threshold",label:"Threshold %",type:"slider",min:0,max:100,step:1,def:50,showIf:p=>p.render!=="Outlines"},
  {key:"dither",label:"Dither strength %",type:"slider",min:0,max:100,step:1,def:100,showIf:p=>p.render!=="Outlines"&&p.mode!=="Threshold"},
  {key:"serpentine",label:"Alternating scan direction",type:"check",def:true,showIf:p=>p.render!=="Outlines"&&["Floyd–Steinberg","Atkinson"].includes(p.mode)},
  {key:"invert",label:"Invert image",type:"check",def:false},
  {key:"columns",label:"Detail (columns)",type:"slider",min:24,max:512,step:1,def:192},
  {key:"margin",label:"Margin mm",type:"slider",min:0,max:60,step:1,def:3},
  {key:"layer",label:"Pen",type:"pen",def:0}
 ],
 _n(v,d,lo,hi){return Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:d));},
 _bytes(data){
  const s=String(data),b64=s.startsWith("data:")?s.slice(s.indexOf(",")+1):s;
  if(b64.length>28000000)throw Error("GIF is too large (maximum 20 MB)");
  let bin;try{bin=atob(b64);}catch{throw Error("Invalid GIF file data");}
  if(bin.length>20000000)throw Error("GIF is too large (maximum 20 MB)");
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
 },
 _meta(b){
  let p=0;const need=n=>{if(p+n>b.length)throw Error("Truncated GIF");},byte=()=>{need(1);return b[p++];},word=()=>byte()|(byte()<<8),take=n=>{need(n);const a=b.slice(p,p+n);p+=n;return a;};
  const signature=String.fromCharCode(...take(6));if(!["GIF87a","GIF89a"].includes(signature))throw Error("Choose a GIF87a or GIF89a image");
  const w=word(),h=word(),flags=byte(),background=byte();byte();
  if(!w||!h||w>8192||h>8192||w*h>4000000)throw Error("GIF canvas is too large (maximum 4 million pixels)");
  const global=flags&128?take(3*(1<<((flags&7)+1))):null,frames=[];let gce={delay:100,dispose:0,transparent:-1},trailer=false,work=0;
  const blocks=()=>{while(true){const n=byte();if(!n)break;take(n);}};
  while(p<b.length){
   const tag=byte();if(tag===59){trailer=true;break;}
   if(tag===33){const label=byte();
    if(label===249){if(byte()!==4)throw Error("Invalid GIF frame control");const f=byte(),delay=word()*10,index=byte();if(byte()!==0||(f>>2&7)>3)throw Error("Invalid GIF disposal control");gce={delay:Math.max(10,delay||100),dispose:f>>2&7,transparent:f&1?index:-1};}
    else{blocks();if(label===1)gce={delay:100,dispose:0,transparent:-1};}
    continue;
   }
   if(tag!==44)throw Error("Invalid GIF block");
   const x=word(),y=word(),fw=word(),fh=word(),f=byte();if(!fw||!fh||fw*fh>4000000||(work+=fw*fh)>120000000)throw Error("GIF decoded pixel budget exceeded");
   const palette=f&128?take(3*(1<<((f&7)+1))):global;if(!palette)throw Error("GIF colour table missing");
   const start=p,code=byte();if(code<2||code>8)throw Error("Invalid GIF image code size");blocks();
   frames.push({x,y,w:fw,h:fh,interlace:!!(f&64),palette,data:b.slice(start,p),...gce});if(frames.length>240)throw Error("GIF has more than 240 frames");gce={delay:100,dispose:0,transparent:-1};
  }
  if(!trailer||!frames.length)throw Error("Incomplete GIF animation");
  const scale=Math.min(1,1024/Math.max(w,h),Math.sqrt(6000000/(w*h*frames.length))),dw=Math.max(1,Math.floor(w*scale)),dh=Math.max(1,Math.floor(h*scale));
  return {w,h,dw,dh,global,background,frames,duration:frames.reduce((n,f)=>n+f.delay,0)};
 },
 _canvas(w,h){const c=typeof OffscreenCanvas!=="undefined"?new OffscreenCanvas(w,h):Object.assign(document.createElement("canvas"),{width:w,height:h});const g=c.getContext("2d",{willReadFrequently:true});if(!g)throw Error("Canvas decoding is unavailable");g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";return {c,g};},
 _encodeRGB(rgba){let s="";const rgb=new Uint8Array(rgba.length/4*3);for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i];rgb[j++]=rgba[i+1];rgb[j++]=rgba[i+2];}for(let i=0;i<rgb.length;i+=8192)s+=String.fromCharCode(...rgb.subarray(i,i+8192));return btoa(s);},
 async _decodeNative(bytes,meta){
  const D=globalThis.ImageDecoder;if(!D||D.isTypeSupported&&!await D.isTypeSupported("image/gif"))return null;
  const decoder=new D({data:bytes,type:"image/gif",preferAnimation:true}),{c,g}=this._canvas(meta.dw,meta.dh),frames=[];
  try{await decoder.tracks.ready;if(decoder.tracks.selectedTrack?.frameCount!==meta.frames.length)throw Error("GIF frame count did not decode completely");
   for(let i=0;i<meta.frames.length;i++){
    const {image}=await decoder.decode({frameIndex:i,completeFramesOnly:true});
    try{g.fillStyle="white";g.fillRect(0,0,c.width,c.height);g.drawImage(image,0,0,c.width,c.height);frames.push({delay:meta.frames[i].delay,rgb:this._encodeRGB(g.getImageData(0,0,c.width,c.height).data)});}finally{image.close();}
   }return frames;
  }finally{decoder.close();}
 },
 _patchGif(f){
  const size=Math.round(Math.log2(f.palette.length/3))-1,lo=v=>v&255,hi=v=>v>>8&255;
  const head=new Uint8Array([71,73,70,56,57,97,lo(f.w),hi(f.w),lo(f.h),hi(f.h),128|112|size,0,0,...f.palette,33,249,4,f.transparent>=0?1:0,0,0,Math.max(0,f.transparent),0,44,0,0,0,0,lo(f.w),hi(f.w),lo(f.h),hi(f.h),f.interlace?64:0]),out=new Uint8Array(head.length+f.data.length+1);out.set(head);out.set(f.data,head.length);out[out.length-1]=59;return out;
 },
 async _decodePatches(bytes,meta){
  if(typeof createImageBitmap!=="function")throw Error("This browser cannot decode GIF animation");
  const {c,g}=this._canvas(meta.w,meta.h),small=this._canvas(meta.dw,meta.dh),frames=[];
  // Browser GIF canvases start transparent; disposal 2 clears to transparency,
  // including files whose logical-screen background palette entry is coloured.
  const clear=f=>g.clearRect(f.x,f.y,f.w,f.h);
  g.clearRect(0,0,c.width,c.height);let previous=null,saved=null;
  for(const f of meta.frames){
   if(previous?.dispose===2)clear(previous);else if(previous?.dispose===3&&saved)g.putImageData(saved,0,0);
   saved=f.dispose===3?g.getImageData(0,0,c.width,c.height):null;
   const bitmap=await createImageBitmap(new Blob([this._patchGif(f)],{type:"image/gif"}));try{g.drawImage(bitmap,f.x,f.y);}finally{bitmap.close();}
   small.g.fillStyle="white";small.g.fillRect(0,0,small.c.width,small.c.height);small.g.drawImage(c,0,0,small.c.width,small.c.height);
   frames.push({delay:f.delay,rgb:this._encodeRGB(small.g.getImageData(0,0,small.c.width,small.c.height).data)});previous=f;
  }return frames;
 },
 async onFile(data){
  const bytes=this._bytes(data),meta=this._meta(bytes);let frames;
  try{frames=await this._decodeNative(bytes,meta);}catch{frames=null;}
  if(!frames)frames=await this._decodePatches(bytes,meta);
  if(frames.length!==meta.frames.length)throw Error("GIF animation was not fully decoded");
  return {kind:"gif-receipt-v1",w:meta.dw,h:meta.dh,sourceW:meta.w,sourceH:meta.h,frames,frameCount:frames.length,duration:meta.duration,summary:meta.w+" × "+meta.h+" · "+frames.length+" frames · "+(meta.duration/1000).toFixed(2)+" s"};
 },
 _sequence(p,node){
  const data=node?.data?.svg;
  if(p.source!=="Colour demo"&&data?.kind==="gif-receipt-v1"){
   if(!Number.isInteger(data.w)||!Number.isInteger(data.h)||data.w<1||data.h<1||data.w>1024||data.h>1024||!Array.isArray(data.frames)||!data.frames.length||data.frames.length>240||data.w*data.h*data.frames.length>6000000||!Number.isFinite(data.sourceW)||!Number.isFinite(data.sourceH)||data.sourceW<=0||data.sourceH<=0)return null;
   if(!data.frames.every(f=>typeof f.rgb==="string"&&f.rgb.length===data.w*data.h*4&&Number.isFinite(f.delay)&&f.delay>=10&&f.delay<=655350))return null;
   return data;
  }
  if(p.source==="GIF file"||(p.source!=="Colour demo"&&p.file))return null;
  return {demo:true,w:128,h:96,sourceW:128,sourceH:96,frames:Array.from({length:24},()=>({delay:100})),duration:2400};
 },
 _index(p,ctx,S){
  const n=this._n,N=S.frames.length;if(p.time==="Manual")return Math.round(n(p.frame,0,0,N-1));
  const count=Math.max(1,Math.round(n(ctx?.frameCount,24,1,100000))),loops=Math.round(n(p.loops,1,0,32));let t=n(ctx?.frameIdx,0,-1e9,1e9)/count*loops+n(p.phase,0,-1e12,1e12)/360;t-=Math.floor(t);
  if(p.timing==="Original timing"){let time=t*S.frames.reduce((a,f)=>a+f.delay,0);for(let i=0;i<N;i++){time-=S.frames[i].delay;if(time< -1e-7)return i;}return N-1;}
  return Math.min(N-1,Math.floor(t*N+1e-9));
 },
 _rgb(S,index){
  if(S.demo){const rgb=new Uint8Array(S.w*S.h*3),a=index/24*Math.PI*2,cx=.5+.26*Math.cos(a),cy=.43+.18*Math.sin(a);
   for(let y=0;y<S.h;y++)for(let x=0;x<S.w;x++){
    const u=(x+.5)/S.w,v=(y+.5)/S.h,k=(y*S.w+x)*3;let c=[255,255,255];
    if(Math.hypot((u-cx)/.19,(v-cy)/.25)<1)c=[35,85,225];
    if(u>.18&&u<.42&&v>.18&&v<.65)c=[235,75,40];
    if(v>.8&&v<.92&&u>.08&&u<.92){const g=(u-.08)/.84;c=[255,Math.round(255*g),Math.round(255*g)];}
    rgb.set(c,k);
   }return rgb;
  }
  try{const s=atob(S.frames[index].rgb);if(s.length!==S.w*S.h*3)return null;return Uint8Array.from(s,c=>c.charCodeAt(0));}catch{return null;}
 },
 _layout(p,ctx,S){
  const n=this._n,W=Number(ctx?.W),H=Number(ctx?.H),m=n(p.margin,3,0,100000);if(!Number.isFinite(W)||!Number.isFinite(H)||W>100000||H>100000||W-2*m<2||H-2*m<2)return null;
  const fw=W-2*m,fh=H-2*m,base=(p.fit==="Cover"?Math.max:Math.min)(fw/S.sourceW,fh/S.sourceH),scale=n(p.scale,100,.1,10000)/100,sx=base*scale*(p.aspect!==false?1:n(p.scaleX,100,1,10000)/100),sy=base*scale*(p.aspect!==false?1:n(p.scaleY,100,1,10000)/100);
  const w=S.sourceW*sx,h=S.sourceH*sy,a=n(p.angle,0,-1e9,1e9)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=W/2+n(p.x,0,-100000,100000),cy=H/2+n(p.y,0,-100000,100000);
  let cols=Math.round(n(p.columns,192,1,512)),rows=Math.max(1,Math.round(cols*fh/fw));
  while(cols>1&&2*Math.ceil(cols/2)*rows>100000){cols--;rows=Math.max(1,Math.round(cols*fh/fw));}
  if(2*Math.ceil(cols/2)*rows>110000||fh/rows>10)return null;
  const map=(x,y)=>[cx+x*c-y*s,cy+x*s+y*c];return {W,H,m,fw,fh,w,h,c,s,cx,cy,cols,rows,dx:fw/cols,dy:fh/rows,quad:[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(q=>map(...q))};
 },
 _tones(p,S,rgb,F){
  const n=this._n,values=new Float32Array(F.cols*F.rows).fill(1),mask=new Uint8Array(values.length),black=n(p.black,0,0,98)/100,white=Math.max(black+1/255,n(p.white,100,1,100)/100),gamma=n(p.gamma,1,.1,5),contrast=n(p.contrast,1,.05,8),bright=n(p.brightness,0,-100,100)/100;
  const at=(x,y,k)=>rgb[(Math.max(0,Math.min(S.h-1,y))*S.w+Math.max(0,Math.min(S.w-1,x)))*3+k]/255;
  for(let y=0;y<F.rows;y++)for(let x=0;x<F.cols;x++){
   const X=F.m+(x+.5)*F.dx-F.cx,Y=F.m+(y+.5)*F.dy-F.cy,u=(X*F.c+Y*F.s)/F.w+.5,v=(-X*F.s+Y*F.c)/F.h+.5;if(u<0||u>=1||v<0||v>=1)continue;
   const px=u*S.w-.5,py=v*S.h-.5,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,c=[];
   for(let k=0;k<3;k++)c.push(at(ix,iy,k)*(1-fx)*(1-fy)+at(ix+1,iy,k)*fx*(1-fy)+at(ix,iy+1,k)*(1-fx)*fy+at(ix+1,iy+1,k)*fx*fy);
   let lum=p.channel==="Red"?c[0]:p.channel==="Green"?c[1]:p.channel==="Blue"?c[2]:p.channel==="Average"?(c[0]+c[1]+c[2])/3:p.channel==="Darkest channel"?Math.min(...c):.2126*c[0]+.7152*c[1]+.0722*c[2];
   lum=Math.max(0,Math.min(1,(lum-black)/(white-black)))**(1/gamma);lum=Math.max(0,Math.min(1,(lum-.5)*contrast+.5+bright));if(p.invert)lum=1-lum;
   const i=y*F.cols+x;mask[i]=1;values[i]=lum;
  }return {values,mask};
 },
 _monochrome(p,tones,F){
  const n=this._n,out=new Uint8Array(F.cols*F.rows),values=Float32Array.from(tones.values),amount=n(p.dither,100,0,100)/100,threshold=n(p.threshold,50,0,100)/100;
  let bayer=[[0,2],[3,1]];const size=p.mode==="Bayer 4×4"?4:8;
  while(bayer.length<size){const old=bayer,N=old.length;bayer=Array.from({length:N*2},(_,y)=>Array.from({length:N*2},(_,x)=>4*old[y%N][x%N]+[[0,2],[3,1]][Math.floor(y/N)][Math.floor(x/N)]));}
  const error=(x,y,e)=>{if(x>=0&&y>=0&&x<F.cols&&y<F.rows&&tones.mask[y*F.cols+x])values[y*F.cols+x]+=e;};
  const diffuse=p.mode==="Floyd–Steinberg"||p.mode==="Atkinson";
  for(let y=0;y<F.rows;y++){
   const sign=diffuse&&p.serpentine!==false&&y%2?-1:1;
   for(let k=0;k<F.cols;k++){
    const x=sign===1?k:F.cols-1-k,i=y*F.cols+x;if(!tones.mask[i])continue;const v=Math.max(0,Math.min(1,values[i]));
    const limit=p.mode?.startsWith("Bayer")?Math.max(0,Math.min(1,threshold+((bayer[y%size][x%size]+.5)/(size*size)-.5)*amount)):threshold;
    const value=v<limit?0:1;out[i]=1-value;
    if(diffuse){const e=(v-value)*amount;if(p.mode==="Atkinson"){for(const [dx,dy]of [[1,0],[2,0],[-1,1],[0,1],[1,1],[0,2]])error(x+dx*sign,y+dy,e/8);}else{error(x+sign,y,e*7/16);error(x-sign,y+1,e*3/16);error(x,y+1,e*5/16);error(x+sign,y+1,e/16);}}
   }
  }return out;
 },
 overlay(p,ctx,ins,node){const S=this._sequence(p,node);if(!S)return [];const F=this._layout(p,ctx,S);return F?[{kind:"poly",pts:[...F.quad,F.quad[0]]},{kind:"rect",x:F.m,y:F.m,w:F.fw,h:F.fh}]:[];},
 compute(ins,p,ctx,node){
  const S=this._sequence(p,node);if(!S)return EMPTY;const F=this._layout(p,ctx,S);if(!F)return EMPTY;const frame=this._index(p,ctx,S),rgb=this._rgb(S,frame);if(!rgb)return EMPTY;
  const tones=this._tones(p,S,rgb,F),ink=this._n(p.ink,100,0,100)/100;
  const light={mask:tones.mask,values:Float32Array.from(tones.values,v=>1-(1-v)*ink)};
  const bitmap=p.render==="Outlines"?new Uint8Array(F.cols*F.rows):this._monochrome(p,light,F),paths=[],pen=Math.round(this._n(p.layer,0,0,11));
  if(p.render==="Outlines"||p.render==="Outlines + light tone"){
   const at=(x,y)=>x<0||y<0||x>=F.cols||y>=F.rows?1:tones.values[y*F.cols+x],limit=this._n(p.edge,18,1,100)/100;
   for(let y=0;y<F.rows;y++)for(let x=0;x<F.cols;x++){
    const gx=-at(x-1,y-1)+at(x+1,y-1)-2*at(x-1,y)+2*at(x+1,y)-at(x-1,y+1)+at(x+1,y+1);
    const gy=-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1)+at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1);
    if(tones.mask[y*F.cols+x]&&Math.hypot(gx,gy)/4>=limit)bitmap[y*F.cols+x]=1;
   }
  }
  for(let y=0;y<F.rows;y++){
   let start=-1;for(let x=0;x<=F.cols;x++){
    const black=x<F.cols&&bitmap[y*F.cols+x];if(black&&start<0)start=x;
    if(!black&&start>=0){const yy=F.m+(y+.5)*F.dy,a=F.m+(start+.5)*F.dx,b=F.m+(x-.5)*F.dx,e=x-start===1?F.dx*.001:0;paths.push({pts:[[a-e,yy],[b+e,yy]],closed:false,layer:pen,strokeWidth:F.dy,receiptStrokeWidth:F.dy});start=-1;}
   }
  }
  const result=applyStyle({paths},ins?.[0]);if(result.paths.reduce((n,q)=>n+q.pts.length,0)>120000)return EMPTY;
  return {...result,sourceFrame:frame,sourceFrames:S.frames.length,effectiveColumns:F.cols,rows:F.rows};
 }
};
