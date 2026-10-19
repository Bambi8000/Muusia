import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import * as H from '../src/defs/helpers.js';
const lab=process.argv.includes('--lab'),N=lab?Function(...Object.keys(H),'return '+fs.readFileSync('nodes-lab/line_drape.plotternode.js','utf8'))(...Object.values(H)):(await import('../src/defs/nodes/line_drape.js')).default;
console.log(lab?'[lab]':'[baked]');
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def])),base=defaults(N),ctx={W:297,H:210},hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');let checks=0;
const rect=(x,y,w,h,layer=0)=>({closed:true,layer,pts:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]}),ring={paths:[rect(80,45,130,120),rect(110,70,70,70)]},open={paths:[{pts:[[80,50],[145,155],[210,50]],closed:false,layer:0}]};
function run(src={},params={},context=ctx,style){const p={...base,...params},input=src.paths?src:{paths:[]},before=hash({input,p,context,style}),v=N.compute([input,style],p,context);assert.equal(hash({input,p,context,style}),before,'Pure compute');assert.ok(v.paths.reduce((n,q)=>n+q.pts.length,0)<=118000);for(const q of v.paths){assert.ok(q.pts.length>=(q.closed?3:2));assert.ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12);for(const [x,y] of q.pts)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=p.margin-1e-7&&x<=context.W-p.margin+1e-7&&y>=p.margin-1e-7&&y<=context.H-p.margin+1e-7);}checks++;return v;}
const a=run(ring);assert.ok(a.paths.length>80);assert.equal(hash(a),hash(run(ring)));
for(const key of ['angle','bend','strength','soft','shift','pitch','phase','stroke','fill']){const values={angle:37,bend:65,strength:25,soft:11,shift:18,pitch:3,phase:.6,stroke:15,fill:false};const input=key==='stroke'?open:ring;assert.notEqual(hash(run(input)),hash(run(input,{[key]:values[key]})),key+' visibly changes geometry');}
// Independent field oracle at zero strength: every sample lies on exact straight levels.
for(const angle of [0,37,90,-45,180]){const p={angle,strength:0},v=run(ring,p),s=Math.sin(angle*Math.PI/180),c=Math.cos(angle*Math.PI/180);for(const q of v.paths)for(const [x,y] of q.pts){const f=-(x-ctx.W/2)*s+(y-ctx.H/2)*c;assert.ok(Math.abs(f/base.pitch-Math.round(f/base.pitch))<1e-7);}}
// Independent inner-angle oracle away from the mask boundary.
const beta=-42*Math.PI/180,solid=run({paths:[rect(60,35,180,140)]},{soft:0});let innerChecks=0;
for(const q of solid.paths)for(const [x,y] of q.pts.slice(1).map((b,i)=>[(b[0]+q.pts[i][0])/2,(b[1]+q.pts[i][1])/2]))if(x>65&&x<235&&y>40&&y<170){const f=(y-ctx.H/2)*Math.cos(beta)-(x-ctx.W/2)*Math.sin(beta);assert.ok(Math.abs(f/base.pitch-Math.round(f/base.pitch))<1e-7);innerChecks++;}assert.ok(innerChecks>20);
assert.equal(hash(run({}, {angle:0})),hash(run(ring,{strength:0})));assert.equal(hash(run(ring,{bend:0,shift:0})),hash(run({}, {angle:0})));
for(const angle of [0,90,29])run(open,{angle,stroke:9,pens:6,layer:10});
for(const context of [{W:420,H:297},{W:594,H:420},{W:50,H:40}])run(ring,{},context);
for(const params of [{pitch:.5,cell:.4,bend:80,soft:0},{soft:25,shift:100,bend:-80},{fill:false,stroke:30,pitch:.5},{pens:6,layer:11},{strength:0,phase:1.8}])run(ring,params);
const styled=run(open,{},ctx,{kind:'style',mode:'Dashed',dash:2,gap:2,vary:0,phase:0,seed:9});assert.ok(styled.paths.length>0);
assert.deepEqual(N.compute([],base,{W:0,H:100}),H.EMPTY);assert.deepEqual(N.compute([], {...base,margin:60},{W:100,H:100}),H.EMPTY);
run({paths:[{pts:[[NaN,4],[Infinity,4]],closed:true,layer:0}]});
// Nested-hole parity: mask around a ring must differ from a filled rectangle.
assert.notEqual(hash(run(ring)),hash(run({paths:[ring.paths[0]]})));
console.log(`PASS: ${checks} complete bounded deterministic field cases; independent straight-line/angle oracle, holes, open paths, all controls, colours, styles and A3/A2 canvases.`);
// Actual Type Studio modes: filled contours, open hairlines and tiny text strokes.
const T=(await import('../src/defs/nodes/type_studio.js')).default,{TYPE_STUDIO_STYLES}=await import('../src/defs/type-studio.js');
for(const mode of [TYPE_STUDIO_STYLES[0],TYPE_STUDIO_STYLES[6],TYPE_STUDIO_STYLES.at(-1)]){
 const source=T.compute([],{...defaults(T),mode,text:'O',size:90},ctx),v=run(source,{stroke:2,soft:1.5});assert.notEqual(hash(v),hash(run({}, {stroke:2,soft:1.5})),mode+' drives the mask');
}
if(process.argv.includes('--browser-dir')){
 const dir=process.argv[process.argv.indexOf('--browser-dir')+1],patch=JSON.parse(fs.readFileSync(dir+'/text.muusia.json','utf8')),L=(await import('../src/defs/nodes/lettering.js')).default;
 const p=patch.root.nodes[1].params,source=L.compute([],patch.root.nodes[0].params,patch.canvas),out=run(source,p,patch.canvas),app=fs.readFileSync('src/App.jsx','utf8');
 const exporter=app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export')),toSVG=Function('PENS',exporter+';return toSVG;')(H.PENS);
 assert.equal(fs.readFileSync(dir+'/text.svg','utf8'),toSVG(out,patch.canvas),'Actual ordered SVG exact');
 const code=fs.readFileSync(dir+'/text.gcode','utf8'),moves=code.split('\n').filter(l=>/^G[01] X/.test(l)).map(l=>l.match(/^G[01] X([\d.-]+) Y([\d.-]+)/).slice(1).map(Number));
 assert.deepEqual(moves.pop(),[0,0]);const expected=[];
 for(const layer of [...new Set(out.paths.map(p=>p.layer))].sort((a,b)=>a-b))for(const path of out.paths.filter(p=>p.layer===layer))expected.push(...path.pts,...(path.closed?[path.pts[0]]:[]));
 assert.equal(moves.length,expected.length);for(let i=0;i<moves.length;i++)for(let k=0;k<2;k++)assert.ok(Math.abs(moves[i][k]-expected[i][k])<=.005001,'Actual G-code coordinate '+i);
 console.log(`Actual browser SVG and G-code match ${out.paths.length} paths / ${expected.length} points; route off, origin 0, Flip Y off, A profile; no hardware.`);
}
console.log(`Final: ${checks} geometry cases passed, including three Type Studio modes.`);
