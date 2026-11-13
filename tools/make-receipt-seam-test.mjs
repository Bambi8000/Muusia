import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ribbon from "../src/defs/nodes/ribbon.js";
import svgimport from "../src/defs/nodes/svgimport.js";
import { SFONT } from "../src/defs/helpers.js";
import { createStrip } from "../src/surface-composer.js";
import { createSurfaceSession, readSurfaceSession } from "../src/surface-session.js";
import { stripPrintRange } from "../src/surface-production.js";
import { EPSON_SURFACE } from "../src/surface-print.js";

const out = resolve(process.argv[2] || "output/receipt-seam-10m");
await mkdir(out, {recursive:true});
const W=80, H=10000, d=EPSON_SURFACE.dotsPerMm;
const defaults=n=>Object.fromEntries(n.params.map(p=>[p.key,p.def]));
const params={...defaults(ribbon),shape:"Long",longForm:"Pleated",width:32,wander:9,margin:12,lines:28,bendLength:900,swellLength:440,foldLength:650,tailLength:100,widthVar:.65,ripple:.3,seed:27};
const refs=[];
const line=(pts,role)=>refs.push({pts,closed:false,layer:0,role});
const text=(value,x,y,size=2,vertical=false)=>{
  let advance=0;
  for(const ch of value.toUpperCase()){
    const g=SFONT[ch]||SFONT[" "];
    for(const stroke of g.s)if(stroke.length>1)line(stroke.map(([u,v])=>vertical?[x+size*(1-v/10),y+advance+u*size/10]:[x+advance+u*size/10,y+v*size/10]),"label");
    advance+=(g.w+2)*size/10;
  }
};
// Full-length lines and waves expose any feed gap, repeated row or sideways
// shift. Their geometry does not restart at an encoding or rendering boundary.
for(const x of [9,11,69,71])line([[x,30],[x,H-20]],"continuous-reference");
for(const side of [0,1]){
  const pts=[];
  for(let y=30;y<=H-20;y+=.5)pts.push([(side?73:7)+.7*Math.sin(y/45*Math.PI*2),y]);
  line(pts,"continuous-wave");
}
for(let row=256;row<Math.ceil(H*d);row+=256){
  const y=row/d,major=row%1024===0;
  line([[7.7,y],[major?13:11.8,y]],major?"raster-1024":"transport-256");
  if(major&&y<H-18)text(`R${row}`,4.9,y+1.5,1.8,true);
}
for(let mm=100;mm<H;mm+=100){
  line([[mm%1000===0?66:70,mm],[74.5,mm]],"ruler");
  if(mm%1000===0)text(`${mm/1000}M`,72.3,mm+2,2,true);
}
const oldY=65535/d;
line([[12,oldY-12],[17,oldY],[12,oldY+12]],"former-limit");
line([[68,oldY-12],[63,oldY],[68,oldY+12]],"former-limit");
text("OLD",20,oldY+2,2.5);
text("65535",52,oldY+2,2.5);
text("MUUSIA 10M RIBBON",13,4,3);
text("TICKS 256  R 1024",13,11,2.4);
text("ONE JOB  ONE FINAL CUT",13,17,2.1);
text("END 10M",23,H-12,3);
const imported={...defaults(svgimport),fit:"Scale %",scale:100,margin:0,filename:"seam-reference.svg"};
const refNode={id:9002,type:"svgimport",x:350,y:20,params:imported,data:{svg:{bbox:{x:0,y:0,w:W,h:H},paths:refs.map(p=>({...p,colorIdx:0}))}}};
const referenceDrawing=svgimport.compute([],imported,{W,H},refNode);
const drawing={paths:[...ribbon.compute([],params,{W,H}).paths,...referenceDrawing.paths]};
const strip=createStrip({id:"ribbon-seam-10m",centerXmm:40,centerYmm:5000,lengthMm:H,physicalWidthMm:80,printableOffsetMm:4.6,printableWidthMm:70.8});
const initial=createSurfaceSession();
const session=readSurfaceSession({...initial,mode:"freeform",widthMm:W,heightMm:H,strips:[strip],selectedId:strip.id,nextId:2,source:{kind:"graph",nodeId:9003,graphPath:[],fit:"contain",image:null},production:{...initial.production,trimMarks:false,cut:true},assembly:{labelMode:"off"}});
const range=stripPrintRange(strip);
const graph={nodes:[{id:9001,type:"ribbon",x:30,y:20,params},refNode,{id:9003,type:"merge",x:700,y:20,params:{count:2,penPer:false}}],edges:[{id:"e9101",from:9001,fromPort:0,to:9003,toPort:0},{id:"e9102",from:9002,fromPort:0,to:9003,toPort:1}]};
const body=drawing.paths.map(p=>`<path d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}${p.closed?' Z':''}"/>`).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="10000mm" viewBox="0 0 80 10000"><title>10 m Ribbon and seam test</title><g fill="none" stroke="black" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const manifest={canvas:{W,H},measuredDotsPerMm:d,heightDots:Math.ceil(H*d-1e-9),paths:drawing.paths.length,points:drawing.paths.reduce((s,p)=>s+p.pts.length,0),encoderRows:256,usbTransportRows:32,markerRows:256,rendererRows:256,majorMarkersEveryRows:1024,formerLimitRow:65535,formerLimitMm:oldY,physicalPrintsRequested:1,cutOnlyAtEnd:true};
await writeFile(`${out}/scene.json`,JSON.stringify({session,range,drawing,manifest}));
await writeFile(`${out}/ribbon-seam-10m.svg`,svg);
await writeFile(`${out}/ribbon-seam-10m.muusia.json`,JSON.stringify({app:"muusia",v:1,name:"10m Ribbon seam test",canvas:{W,H},surface:session,root:graph},null,1));
await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(manifest);
