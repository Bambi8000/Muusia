import {surfaceDrawing} from '../plotter-utilities.js';
import { Pin, hash2, applyStyle } from "../helpers.js";

export default {
key:'recursive_structure',name:'Recursive Structure',cat:'gen',group:'structural',
 desc:'Recursive octant subdivision with seeded occupancy. Junction beams connects each occupied cell centre to its retained child centres with three axis-aligned beams; Nested boxes draws retained cell cages. Depth is bounded to 4 and occupancy to 75% to keep the complete structure affordable; the complete depth is lowered uniformly if the mesh would exceed 110k triangles. Retained children are a deterministic prefix as Depth increases. Drawing and Mesh share the same normalized object and camera; Mesh Render can supply other surface treatments. Beams are overlapping closed boxes, not a boolean-unioned watertight solid. Hidden-line removal is an approximate depth raster. Size fits the complete bounding sphere inside the margin.',
 ins:[Pin('style','Style')],outs:[Pin('paths','Drawing'),Pin('mesh','Mesh')],params:[
 {key:'structure',label:'Structure',type:'select',options:['Junction beams','Nested boxes'],def:'Junction beams'},
 {key:'depth',label:'Recursion depth',type:'slider',min:1,max:4,step:1,def:3},
 {key:'ratio',label:'Child scale %',type:'slider',min:20,max:48,step:1,def:43},
 {key:'occupancy',label:'Retained children %',type:'slider',min:15,max:75,step:1,def:52},
 {key:'beam',label:'Beam width %',type:'slider',min:2,max:20,step:1,def:7},
 {key:'seed',label:'Seed',type:'seed',def:23}, {key:'yaw',label:'View angle °',type:'slider',min:-180,max:180,step:1,def:25},
 {key:'elevation',label:'View elevation °',type:'slider',min:5,max:85,step:1,def:30},
 {key:'persp',label:'Perspective',type:'slider',min:0,max:.7,step:.05,def:0},
 {key:'hidden',label:'Hidden-line removal',type:'check',def:true},
 {key:'size',label:'Size mm',type:'slider',min:20,max:400,step:1,def:155},
 {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:12},
 {key:'layer',label:'Pen',type:'pen',def:0}],
 overlay(p,c){const m=Math.max(0,+p.margin||0);return [{kind:'rect',x:m,y:m,w:c.W-2*m,h:c.H-2*m}];},
 _box(a,b){const v=Array.from({length:8},(_,i)=>[i&1?b[0]:a[0],i&2?b[1]:a[1],i&4?b[2]:a[2]]);return [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]].map(f=>f.map(i=>v[i]));},
 compute(ins,p,c){const faces=[],depth=Math.max(1,Math.min(4,Math.round(+p.depth||3))),ratio=Math.max(.2,Math.min(.48,(+p.ratio||43)/100)),occupancy=Math.max(.15,Math.min(.75,(+p.occupancy||52)/100)),beam=Math.max(.02,Math.min(.2,(+p.beam||7)/100));
 const bar=(a,b,w)=>{const lo=a.map((v,k)=>Math.min(v,b[k])-w/2),hi=a.map((v,k)=>Math.max(v,b[k])+w/2);faces.push(...this._box(lo,hi));};
 const visit=(center,size,level,id)=>{if(faces.length>55000)return;if(p.structure==='Nested boxes'){const r=size/2,vs=Array.from({length:8},(_,i)=>center.map((v,k)=>v+((i>>k)&1?r:-r)));for(let i=0;i<8;i++)for(let k=0;k<3;k++)if(!(i&(1<<k)))bar(vs[i],vs[i|(1<<k)],size*beam*.35);}
 if(level>=depth)return;for(let i=0;i<8;i++){if(hash2(id,i,+p.seed||0)>occupancy)continue;const child=center.map((v,k)=>v+((i>>k)&1?1:-1)*size*(1-ratio)/2);if(p.structure!=='Nested boxes'){let a=center.slice();for(let k=0;k<3;k++){const b=a.slice();b[k]=child[k];bar(a,b,size*beam);a=b;}}visit(child,size*ratio,level+1,id*8+i+1);}};
 visit([0,0,0],1,0,1);if(faces.length>55000&&depth>1)return this.compute(ins,{...p,depth:depth-1},c);return surfaceDrawing(faces,p,c,ins[0]);}

};
