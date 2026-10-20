import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {zlibSync} from 'fflate';import * as H from '../../src/defs/helpers.js';import {withParameterVisibility} from '../../src/defs/parameter-visibility.js';import {lessons} from './content.mjs';
export const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../..'),defs={};
for(const k of ['sdfcontours','image','glyphtone','weave_draft','lettering','hersheytext','svgimport'])defs[k]=withParameterVisibility((await import('../../src/defs/nodes/'+k+'.js')).default);
export const defaults=k=>Object.fromEntries(defs[k].params.map(q=>[q.key,structuredClone(q.def)]));
const app=fs.readFileSync(path.join(ROOT,'src/App.jsx'),'utf8');export const engineSource=app.slice(app.indexOf('function defIns(node)'),app.indexOf('/* ============================================================\n   G-CODE')),exporterSource=app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export'));
export const gcodeSource=app.slice(app.indexOf('function toGcode('),app.indexOf('function toSVG('));
const solid=JSON.parse(app.match(/const SOLID_STYLE = (\{[^;]+\});/)[1].replace(/(\w+):/g,'"$1":')),evalLevel=Function('DEFS','EMPTY','SOLID_STYLE',engineSource+';return evalLevel;')(defs,H.EMPTY,solid);
export const evaluate=p=>evalLevel(p.root,p.canvas).out[p.root.outputId][0],toSVG=Function('PENS',exporterSource+';return toSVG;')(H.PENS);
export function image(){const w=96,h=64,g=[],rgb=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 let d=0;const dx=(x-58)/24,dy=(y-27)/24,r=dx*dx+dy*dy;
 if(r<1)d=Math.min(1,.15+.75*Math.sqrt(1-r)+.15*dx);
 if(x<27&&y>9&&y<50)d=.12+.72*(.5+.5*Math.sin(y*.2+x*.11))*Math.sin((x+1)/28*Math.PI);
 if(y>=56)d=x/(w-1);const value=Math.round((1-d)*255);rgb.push(value,value,value);g.push(1-(.299*value+.587*value+.114*value)/255);
 }return {w,h,g,rgb};}
export function sourcePNG(){const im=image(),crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0);}return(c^0xffffffff)>>>0;},chunk=(s,b)=>{const t=Buffer.from(s),out=Buffer.alloc(12+b.length);out.writeUInt32BE(b.length);t.copy(out,4);b.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([t,b])),8+b.length);return out;},ih=Buffer.alloc(13);ih.writeUInt32BE(im.w);ih.writeUInt32BE(im.h,4);ih[8]=8;ih[9]=2;const pixels=Buffer.alloc(im.h*(1+im.w*3));for(let y=0;y<im.h;y++)Buffer.from(im.rgb.slice(y*im.w*3,(y+1)*im.w*3)).copy(pixels,y*(1+im.w*3)+1);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',Buffer.from(zlibSync(pixels))),chunk('IEND',Buffer.alloc(0))]);}
export const motif={paths:[{pts:[[0,16],[8,0],[16,16]],closed:true,colorIdx:0},{pts:[[5,9],[8,5],[11,9],[8,13]],closed:true,colorIdx:1}],bbox:{x:0,y:0,w:16,h:16},mm:1,colors:['#23242A','#2A56A8']};
export const motifSVG='<svg xmlns="http://www.w3.org/2000/svg" width="16mm" height="16mm" viewBox="0 0 16 16"><path d="M0 16L8 0L16 16Z" fill="none" stroke="#23242A"/><path d="M5 9L8 5L11 9L8 13Z" fill="none" stroke="#2A56A8"/></svg>';
export function patch(id){const nodes=[],edges=[];const add=(type,p={},data)=>{const n={id:9001+nodes.length,type,x:40+nodes.length*440,y:40,params:{...defaults(type),...p},...(data?{data}:{}),...(nodes.length===0&&['fluid-union','fluid-strokes','custom-motif','motif-occupancy','dither-drawing'].includes(id)?{collapsed:true}:{})};nodes.push(n);return n;},wire=(a,b,toPort=0)=>edges.push({id:'design-'+edges.length,from:a.id,fromPort:0,to:b.id,toPort});let output;
 if(id==='fluid-union'||id==='fluid-strokes'){
  const a=id==='fluid-strokes'?add('hersheytext',{text:'SOFT|LINES',size:35}):add('lettering',{text:'SOFT|FORMS',font:'Bold',size:45,weight:24,tracking:.6,depth:0,fill:'Outline'});
  output=add('sdfcontours',{mode:'Soft union',blend:5,softOffset:0,count:1,keep:false,minlen:1,softCell:.5,interpretation:id==='fluid-strokes'?'Stroked paths':'Closed fills',softStroke:3});wire(a,output);
 }else if(id==='vector-dither')output=add('image',{source:'Image (file)',mode:'Vector dither',cell:2.4,strength:1,cutoff:0,ditherScreen:'Bayer 8×8',ditherSize:.7,file:'tone-study.png'},{img:image()});
 else if(id==='dither-drawing'){const a=add('lettering',{text:'DITHER',size:65,weight:30,depth:0});output=add('image',{source:'Drawing (wired)',mode:'Vector dither',drawingFill:true,cell:1.8,strength:.7,cutoff:0,ditherScreen:'Dispersed 16×16',ditherSize:.6});wire(a,output,1);}
 else if(id==='custom-motif'||id==='motif-occupancy'){
  const a=add('svgimport',{filename:'triangle-motif.svg',fit:'Scale %',scale:100},{svg:motif});output=add('glyphtone',{motifMode:'Wired motif',source:'Image',file:'tone-study.png',cell:5.8,jitter:0,cutoff:.04,motifTone:id==='custom-motif'?'Size':'Occupancy',motifOrientation:'Tone gradient',motifPens:'Keep motif pens'},{img:image()});wire(a,output,1);
 }else if(id==='weave-draft'||id==='weave-two-pen')output=add('weave_draft',{warp:48,weft:32,pitch:4.5,colours:id==='weave-draft'?4:2,pen1:0,pen2:1,pen3:2,pen4:6,warpColours:id==='weave-draft'?'1:8,2:4,3:8,4:4':'1:8,2:4',weftColours:id==='weave-draft'?'4:8,3:4,2:8,1:4':'2:8,1:4'});
 else throw Error('Unknown design study '+id);
 return JSON.parse(JSON.stringify({app:'muusia',v:1,name:id,canvas:{W:297,H:210},root:{nodes,edges,outputId:output.id}}));}
export {lessons};
if(process.argv.includes('--write')){fs.writeFileSync(HERE+'/assets/tone-study.png',sourcePNG());fs.writeFileSync(HERE+'/assets/triangle-motif.svg',motifSVG);for(const l of lessons)for(const id of [l.id,l.variation]){const p=patch(id);fs.writeFileSync(HERE+'/patches/'+id+'.muusia.json',JSON.stringify(p,null,2)+'\n');const r=evaluate(p);console.log(id,r.paths.length,r.paths.reduce((s,q)=>s+q.pts.length,0));}}
