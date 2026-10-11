import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import def from '../../src/defs/nodes/type_studio.js';
export function validateStudioCapture(){
 const dir=fileURLToPath(new URL('./',import.meta.url));
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const capture=JSON.parse(fs.readFileSync(dir+'capture.json','utf8'));
 const r=def.compute([],capture.params,capture.canvas,{});
 const svg=fs.readFileSync(dir+'reference.svg','utf8'),gcode=fs.readFileSync(dir+'reference.gcode','utf8');
 assert.ok(svg.endsWith('</svg>'));assert.ok(gcode.endsWith('; done'));
 const xy=pt=>pt.map(v=>Number(v.toFixed(2))).join(',');
 const actual=[...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]).sort();
 const expected=r.paths.map(q=>q.pts.map((p,i)=>(i?'L':'M')+xy(p)).join('')+(q.closed?'Z':'')).sort();
 assert.deepEqual(actual,expected,'browser SVG has all real node paths at export precision');
 assert.match(svg,/width="200mm" height="140mm"/);assert.match(svg,/id="pen-0-black"/);
 const segments=paths=>paths.flatMap(q=>{const pts=q.pts.map(xy);if(q.closed)pts.push(pts[0]);return pts.slice(1).map((b,i)=>[pts[i],b].sort().join('|')).filter(v=>{const [a,b]=v.split('|');return a!==b;});}).sort();
 let down=false,current=null;const gc=[];
 for(const line of gcode.split('\n')){
  if(line.startsWith('SET_SERVO'))down=/ANGLE=35/.test(line);
  const m=line.match(/^G([01]) X(-?[\d.]+) Y(-?[\d.]+)/);if(!m)continue;
  const next=[+m[2],+m[3]];if(m[1]==='0')assert.ok(!down,'rapid move while pen up');
  if(m[1]==='1'&&down&&current){const a=xy(current),b=xy(next);if(a!==b)gc.push([a,b].sort().join('|'));}current=next;
 }
 assert.ok(!down);assert.deepEqual(gc.sort(),segments(r.paths),'all G-code drawing segments, allowing optimized order');
 const sha=b=>createHash('sha256').update(b).digest('hex');
 for(const [path,hash] of Object.entries(capture.sources))assert.equal(sha(fs.readFileSync(root+path)),hash,path+' changed since capture');
 for(const [path,hash] of Object.entries(capture.files))assert.equal(sha(fs.readFileSync(dir+path)),hash,path+' capture checksum');
 assert.equal(capture.paths,r.paths.length);assert.equal(capture.points,r.paths.reduce((n,q)=>n+q.pts.length,0));
 console.log('Type Studio browser exports verified:',r.paths.length,'paths; complete SVG / G-code geometry and pen-up travel.');
}
