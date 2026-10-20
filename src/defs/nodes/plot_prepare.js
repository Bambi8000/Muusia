import _sort from './travelsort.js';
import _join from './joinends.js';
import _simplify from './simplify.js';
import _cull from './cull.js';
import { Pin, EMPTY, hash2, pathLength } from "../helpers.js";

export default {
 key:'plot_prepare',name:'Plot Prepare',cat:'mod',group:'penout',
 desc:'One preparation stage for culling short paths, simplifying, joining ends and sorting travel. The built-in node reuses Muusia Cull, Simplify, Join Ends and Travel Sort. Groups above 600 paths skip the quadratic join stage. Joins are always same-pen, never cross explicit groups; when Preserve direction is on joins and reversals are disabled. Scope chooses the whole pen set or separate explicit path.group groups. Simplify only open paths so a closed contour cannot collapse to two vertices. All operations default off except pen grouping / travel sorting; no duplicate-removal claim is made. Before / After lifts are path count minus one and Travel saved measures straight pen-up travel from page origin in mm, excluding machine start/end macros and physical pen changes. A negative saving is possible because shortening, grouping or sorting changes path endpoints. Outputs are analysis, not machine time estimates.',
 ins:[Pin('paths','Drawing')],outs:[Pin('paths','Prepared'),Pin('value','Before lifts'),Pin('value','After lifts'),Pin('value','Travel saved mm')],params:[
 {key:'scope',label:'Scope',type:'select',options:['Within pen','Within explicit group'],def:'Within pen'},
 {key:'short',label:'Cull below mm (0 = off)',type:'slider',min:0,max:10,step:.1,def:0},
 {key:'tol',label:'Simplify mm (0 = off)',type:'slider',min:0,max:1,step:.05,def:0},
 {key:'preserve',label:'Preserve direction',type:'check',def:true},
 {key:'join',label:'Join gap mm (0 = off)',type:'slider',min:0,max:5,step:.1,def:0,showIf:p=>!p.preserve},
 {key:'sort',label:'Sort travel',type:'check',def:true},
 {key:'rotate',label:'Rotate closed starts',type:'check',def:false,showIf:p=>p.sort&&!p.preserve}
 ],

 compute(ins,p,c){const paths=ins[0]?.paths||[],travel=ps=>{let d=0,a=[0,0];for(const q of ps){if(!q.pts?.length)continue;d+=Math.hypot(q.pts[0][0]-a[0],q.pts[0][1]-a[1]);a=q.closed?q.pts[0]:q.pts.at(-1);}return d;};const buckets=new Map();paths.forEach((q,i)=>{if(!q.pts?.length)return;const group=q.group===undefined?'ungrouped':typeof q.group+':'+String(q.group),k=q.layer+'|'+group;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(q);});let prepared=[];for(const group of buckets.values()){let out={paths:group};if(p.short>0)out=_cull.compute([out],{mode:'Shorter than',len:Math.max(0,Math.min(10,+p.short)),invert:false});if(p.tol>0)out={paths:out.paths.map(q=>q.closed?q:_simplify.compute([{paths:[q]}],{tol:Math.max(0,Math.min(1,+p.tol))}).paths[0])};if(!p.preserve&&p.join>0&&out.paths.length<=600)out=_join.compute([out],{gap:Math.max(0,Math.min(5,+p.join)),arc:0,angTol:180,samePen:true});const metadata=group[0].group;out.paths=out.paths.map(q=>metadata===undefined?q:{...q,group:metadata});if(p.sort&&p.scope==='Within explicit group')out=_sort.compute([out],{reverse:!p.preserve,rotate:!p.preserve&&p.rotate,bypen:true});prepared.push(...out.paths);}if(p.sort&&p.scope!=='Within explicit group')prepared=_sort.compute([{paths:prepared}],{reverse:!p.preserve,rotate:!p.preserve&&p.rotate,bypen:true}).paths;return [{paths:prepared},Math.max(0,paths.length-1),Math.max(0,prepared.length-1),travel(paths)-travel(prepared)];}
};
