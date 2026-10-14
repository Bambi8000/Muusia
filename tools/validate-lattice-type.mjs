import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as H from '../src/defs/helpers.js';
const baked=new URL('../src/defs/nodes/lattice_type.js',import.meta.url);
const N=fs.existsSync(baked)?(await import(baked.href)).default:new Function(...Object.keys(H),`return ${fs.readFileSync(new URL('../nodes-lab/lattice_type.plotternode.js',import.meta.url),'utf8')}`)(...Object.values(H));
const defaults=Object.fromEntries(N.params.map(p=>[p.key,p.def])),ctx={W:297,H:210};
let checks=0;
function verify(options={},canvas=ctx,style){
  const p={...defaults,...options},before=JSON.stringify(p),sourceStyle=JSON.stringify(style);
  const a=N.compute([style],p,canvas),b=N.compute([style],p,canvas);assert.deepEqual(a,b);assert.equal(JSON.stringify(p),before);assert.equal(JSON.stringify(style),sourceStyle);
  assert.ok(a.paths.reduce((n,q)=>n+q.pts.length,0)<=115000,'Point budget must preserve complete lettering');
  const margin=Math.min(Number.isFinite(Number(p.margin))?Math.max(0,Math.min(60,Number(p.margin))):12,Math.max(0,Math.min(canvas.W,canvas.H)/2-.01));
  for(const path of a.paths){assert.ok(path.pts.length>=(path.closed?3:2));assert.ok(Number.isInteger(path.layer)&&path.layer>=0&&path.layer<12);
    if(path.closed)assert.notDeepEqual(path.pts[0],path.pts.at(-1));
    for(const [x,y]of path.pts){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=margin-1e-6&&y>=margin-1e-6&&x<=canvas.W-margin+1e-6&&y<=canvas.H-margin+1e-6,`${x},${y} outside margin`);}
  }
  checks++;return a;
}
for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÄÖÅäöå.,:;!?-+/()\'')assert.ok(verify({text:ch}).paths.length,ch);
assert.deepEqual(N.compute([],{...defaults,text:''},ctx),H.EMPTY);
assert.deepEqual(N.compute([],{...defaults,text:'   |  '},ctx),H.EMPTY);
for(const bad of [{W:0,H:200},{W:NaN,H:200},{W:200,H:Infinity},{}])assert.deepEqual(N.compute([],defaults,bad),H.EMPTY);
assert.deepEqual(verify({text:'🌀'}),verify({text:'?'}));
assert.deepEqual(verify({text:'A\u0308'}),verify({text:'Ä'}));
assert.deepEqual(verify({text:'a\nb'}),verify({text:'a|b'}));
assert.notDeepEqual(verify({text:'MUUSIA'}),verify({text:'muusia'}),'Real lowercase skeletons, not case folding');
assert.notDeepEqual(verify({text:'OOOO',round:0}),verify({text:'OOOO',round:1}));
const bare=verify({text:'O',dots:'None',bars:0});assert.equal(bare.paths.length,1);assert.equal(bare.paths[0].closed,true);
assert.ok(verify({text:'O',dots:'None',bars:1}).paths.length>bare.paths.length);
assert.ok(verify({dots:'Hatched',hatch:.15}).paths.length>verify({dots:'Hatched',hatch:2}).paths.length);
assert.ok(verify({dots:'Hatched'}).paths.length>verify({dots:'Outline'}).paths.length);
const pens=verify({separate:true,layer:3,barPen:7,dotPen:11});assert.deepEqual([...new Set(pens.paths.map(p=>p.layer))].sort((a,b)=>a-b),[3,7,11]);
assert.ok(verify({separate:false,layer:5}).paths.every(p=>p.layer===5));
for(const text of ['M'.repeat(128),'W'.repeat(128),'#'.repeat(128),Array(16).fill('ÄÖÅgyjp').join('|')])for(const dots of ['None','Outline','Hatched'])verify({text,dots,margin:60,size:120,width:2,bars:1.25,radius:.4,hatch:.15,tracking:0,linegap:1},{W:420,H:594});
verify({size:NaN,width:Infinity,round:-99,bars:99,radius:NaN,hatch:0,tracking:-1,linegap:99,layer:NaN});
verify({text:'Äq|Ög',margin:60},{W:10,H:10});
const bounds=q=>q.paths.flatMap(p=>p.pts).reduce((b,[x,y])=>({x0:Math.min(b.x0,x),y0:Math.min(b.y0,y),x1:Math.max(b.x1,x),y1:Math.max(b.y1,y)}),{x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity});
const left=bounds(verify({text:'TYPE',align:'Left',vertical:'Top'})),right=bounds(verify({text:'TYPE',align:'Right',vertical:'Bottom'}));assert.ok(left.x0<right.x0&&left.y0<right.y0);
assert.deepEqual(bounds(verify({text:'TYPE',dots:'Hatched',hatch:.15})),bounds(verify({text:'TYPE',dots:'Hatched',hatch:2})),'Hatch density cannot alter layout');
for(const mode of ['Solid','Dashed','Dots','Dash-dot'])verify({text:'Lattice|GOTHIC'},ctx,{kind:'style',mode,dash:.1,gap:.1,vary:0,phase:0,seed:4});
for(const mode of ['Dashed','Dots','Dash-dot'])verify({text:'W'.repeat(128),size:120,bars:1.25,radius:.4,hatch:.15}, {W:841,H:594},{kind:'style',mode,dash:.1,gap:.1,vary:.5,phase:0,seed:4});
const overlay=N.overlay(defaults,ctx);assert.equal(overlay.length,2);assert.equal(overlay[0].x,12);assert.equal(overlay[0].w,273);
for(const p of [{text:''},{round:NaN},{size:Infinity}])assert.ok(Array.isArray(N.overlay({...defaults,...p},ctx)));
console.log(`PASS: ${checks} Lattice Type cases; complete case-sensitive alphabet, accents, loops, real hatch fills, layers, margin fit, uniform point budget, dense styles, deterministic immutable results.`);
