import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import{fixtures,evaluate}from './fixtures.mjs';
export async function validateTypographyCapture() {
const root=fileURLToPath(new URL('../../', import.meta.url)),dir=fileURLToPath(new URL('./', import.meta.url));
const projects=await fixtures(),patch=projects['custom-motif'];Object.assign(patch.root.nodes.find(n=>n.type==='stitchtype').params,{text:'I',px:1});
const r=evaluate(patch),svg=fs.readFileSync(dir+'motif-export.svg','utf8'),gcode=fs.readFileSync(dir+'motif-I-export.gcode','utf8');
assert.ok(svg.endsWith('</svg>'));assert.ok(gcode.endsWith('; done'));
const ds=[...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
const round=v=>Number(v.toFixed(2)),xy=pt=>pt.map(round).join(',');
const expected=r.paths.map(q=>q.pts.map((pt,i)=>(i?'L':'M')+xy(pt)).join('')+(q.closed?'Z':''));
assert.equal(ds.length, expected.length); assert.ok(JSON.stringify(ds.sort()) === JSON.stringify(expected.sort()), 'all SVG geometry matches at 0.01 mm, regardless of optimized path order');
assert.match(svg,/width="200mm" height="140mm"/);assert.match(svg,/id="pen-6-teal"/);
const segments=paths=>paths.flatMap(q=>{const pts=q.pts.map(pt=>pt.map(round));if(q.closed)pts.push(pts[0]);return pts.slice(1).map((b,i)=>[xy(pts[i]),xy(b)].sort().join('|')).filter(v=>{const [a,b]=v.split('|');return a!==b;});}).sort();
let down=false,current=null;const gc=[];for(const line of gcode.split('\n')){
 if(line.startsWith('SET_SERVO'))down=/ANGLE=35/.test(line);
 const m=line.match(/^G([01]) X(-?[\d.]+) Y(-?[\d.]+)/);if(!m)continue;
 const next=[+m[2],+m[3]];if(m[1]==='0')assert.ok(!down,'rapid with pen up');if(m[1]==='1'&&down&&current){const a=xy(current),b=xy(next);if(a!==b)gc.push([a,b].sort().join('|'));}current=next;
}assert.ok(!down);assert.deepEqual(gc.sort(),segments(r.paths),'G-code drawing segments match with route optimization');
const sha=b=>createHash('sha256').update(b).digest('hex');
const capture=JSON.parse(fs.readFileSync(dir+'capture.json','utf8'));
assert.equal(capture.sourceSha256,sha(fs.readFileSync(root+'src/defs/nodes/stitchtype.js')),'Motif capture source changed; recapture actual UI and exports');
assert.equal(capture.screenshot.sha256,sha(fs.readFileSync(dir+capture.screenshot.file)));
assert.equal(capture.exports.svgSha256,sha(svg));
assert.equal(capture.exports.gcodeSha256,sha(gcode));
assert.equal(capture.exports.paths,r.paths.length);
assert.equal(capture.exports.points,r.paths.reduce((n,q)=>n+q.pts.length,0));
console.log('Actual Stitch Type browser SVG and G-code verified:',r.paths.length,'paths; route optimization allowed.');
}
