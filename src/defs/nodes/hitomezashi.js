import { Pin, mulberry32, applyStyle } from "../helpers.js";

export default {
 key:'hitomezashi',name:'Hitomezashi',cat:'gen',group:'geometric',
 desc:'Alternating horizontal and vertical stitches form Hitomezashi patterns. Each row and column has a binary phase: Seeded picks repeatable phases, Alternating makes a regular rhythm, and Binary strings repeats your 0/1 sequences. Pitch sets the physical grid spacing; Angle rotates the grid before exact clipping to Margin and an optional closed Region, including even-odd holes. Colours 1 uses Pen 1; 2 separates horizontal and vertical; 3 or 4 alternates pens along each axis. Stitch ratio below 100 leaves a gap at each stitch end. Large pages and tiny pitches automatically raise the effective grid pitch to keep the whole page within a bounded stitch count. Seed never changes during animation unless you wire it.',
 ins:[Pin('style','Style'),Pin('paths','Region')],outs:[Pin('paths','Drawing')],
 params:[
 {key:'phase',label:'Phase rule',type:'select',options:['Seeded','Alternating','Binary strings'],def:'Seeded'},
 {key:'rows',label:'Row bits',type:'text',def:'001011',showIf:p=>p.phase==='Binary strings'},
 {key:'cols',label:'Column bits',type:'text',def:'101100',showIf:p=>p.phase==='Binary strings'},
 {key:'pitch',label:'Pitch mm',type:'slider',min:1,max:20,step:.25,def:4},
 {key:'ratio',label:'Stitch ratio %',type:'slider',min:10,max:100,step:1,def:100},
 {key:'angle',label:'Angle °',type:'slider',min:-180,max:180,step:1,def:0},
 {key:'colours',label:'Colours',type:'slider',min:1,max:4,step:1,def:2},
 {key:'layer',label:'Pen 1',type:'pen',def:0},
 ...[2,3,4].map(n=>({key:'pen'+n,label:'Pen '+n,type:'pen',def:n===2?1:n===3?2:6,showIf:p=>p.colours>=n})),
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
 {key:'seed',label:'Seed',type:'seed',def:27,showIf:p=>p.phase==='Seeded'}
 ],
 overlay(p,c,ins){const ps=ins?.[1]?.paths?.filter(q=>q.closed)||[];return ps.length?ps.slice(0,80).map(q=>({kind:'poly',pts:[...q.pts,q.pts[0]]})):[{kind:'rect',x:p.margin,y:p.margin,w:c.W-2*p.margin,h:c.H-2*p.margin}];},
 _segments(p,c,ins){
 const n=(v,d,l,h)=>Math.max(l,Math.min(h,Number.isFinite(+v)?+v:d)),m=n(p.margin,12,0,Math.min(c.W,c.H)/2);if(c.W<=m*2||c.H<=m*2)return [];
 const polys=(ins?.[1]?.paths||[]).filter(q=>q.closed&&q.pts?.length>=3);if(polys.reduce((a,q)=>a+q.pts.length,0)>4000)return [];
 const boundary=polys.flatMap(q=>q.pts.map((a,i)=>[a,q.pts[(i+1)%q.pts.length]])),inside=q=>{if(q[0]<m-1e-8||q[0]>c.W-m+1e-8||q[1]<m-1e-8||q[1]>c.H-m+1e-8)return false;if(!boundary.length)return true;let b=false;for(const [a,d]of boundary)if((a[1]>q[1])!==(d[1]>q[1])&&q[0]<(d[0]-a[0])*(q[1]-a[1])/(d[1]-a[1])+a[0])b=!b;return b;};
 const rect=[[m,m],[c.W-m,m],[c.W-m,c.H-m],[m,c.H-m]],edges=[...boundary,...rect.map((q,i)=>[q,rect[(i+1)%4]])],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 const clip=(a,b)=>{const d=[b[0]-a[0],b[1]-a[1]],ts=[0,1];for(const [u,v]of edges){const e=[v[0]-u[0],v[1]-u[1]],den=cross(d,e);if(Math.abs(den)<1e-10)continue;const w=[u[0]-a[0],u[1]-a[1]],t=cross(w,e)/den,s=cross(w,d)/den;if(t>0&&t<1&&s>=0&&s<=1)ts.push(t);}ts.sort((a,b)=>a-b);const out=[];for(let i=1;i<ts.length;i++)if(ts[i]-ts[i-1]>1e-8){const t=(ts[i]+ts[i-1])/2;if(inside([a[0]+d[0]*t,a[1]+d[1]*t]))out.push([ts[i-1],ts[i]].map(t=>[a[0]+d[0]*t,a[1]+d[1]*t]));}return out;};
 const pitch=Math.max(n(p.pitch,4,.5,100),Math.hypot(c.W,c.H)/120),R=Math.ceil(Math.hypot(c.W,c.H)/(2*pitch))+2,ang=n(p.angle,0,-1e6,1e6)*Math.PI/180,co=Math.cos(ang),si=Math.sin(ang),map=(x,y)=>[c.W/2+x*co-y*si,c.H/2+x*si+y*co],rng=mulberry32(n(p.seed,27,-2e9,2e9)),bits=[String(p.rows??'001011').replace(/[^01]/g,'')||'0',String(p.cols??'101100').replace(/[^01]/g,'')||'0'],phases=bits.map((s,axis)=>Array.from({length:2*R+1},(_,i)=>p.phase==='Binary strings'?+s[i%s.length]:p.phase==='Alternating'?(i+axis)%2:Math.floor(rng()*2))),nc=Math.round(n(p.colours,2,1,4)),pens=[p.layer??0,p.pen2??1,p.pen3??2,p.pen4??6].map(v=>Math.round(n(v,0,0,11))),ratio=n(p.ratio,100,10,100)/100,out=[];
 for(let axis=0;axis<2;axis++)for(let row=-R;row<=R;row++)for(let k=-R;k<R;k++){
  if(((k+R)%2)!==phases[axis][row+R])continue;const pad=(1-ratio)/2*pitch,a=axis?map(row*pitch,k*pitch+pad):map(k*pitch+pad,row*pitch),b=axis?map(row*pitch,(k+1)*pitch-pad):map((k+1)*pitch-pad,row*pitch),ci=nc===1?0:nc===2?axis:((axis+2*Math.floor((k+R)/2))%nc);
  for(const pts of clip(a,b))out.push({pts,closed:false,layer:pens[ci]});
 }return out;
 },
 compute(ins,p,c){return applyStyle({paths:this._segments(p,c,ins)},ins?.[0]);}
};
