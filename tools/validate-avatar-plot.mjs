/* Anatomical plotting acceptance checks. Run: node tools/validate-avatar-plot.mjs */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildAvatarMesh,AVATAR_DEFAULTS} from '../src/avatar-geometry.js';
import {buildAvatarView} from '../src/avatar-render.js';
import {plotAvatar,AVATAR_PLOT_DEFAULTS,normalizeAvatarPlotOptions} from '../src/avatar-plot.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const styles=['Brush','Contours','Hatching','Contours + hatching'];
const context={W:210,H:297,size:260,margin:12,pen:2};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let checks=0;
const summaries=[];
function pathLength(path){
  let length=0;
  for(let i=1;i<path.pts.length;i++)length+=Math.hypot(path.pts[i][0]-path.pts[i-1][0],path.pts[i][1]-path.pts[i-1][1]);
  if(path.closed&&path.pts.length>2)length+=Math.hypot(path.pts[0][0]-path.pts.at(-1)[0],path.pts[0][1]-path.pts.at(-1)[1]);
  return length;
}
function inspect(drawing,label,ctx=context){
  assert.ok(Array.isArray(drawing.paths)&&drawing.paths.length,label+': visible drawing');
  const pointCount=drawing.paths.reduce((n,path)=>n+path.pts.length,0);
  assert.ok(pointCount<=110000,label+': bounded complete drawing');
  let length=0,joined=0;
  for(const path of drawing.paths){
    assert.ok(path.pts.length>=2,label+': complete stroke');
    assert.ok(Number.isInteger(path.layer)&&path.layer>=0&&path.layer<=11,label+': real pen layer');
    if(path.pts.length>2)joined++;
    for(let i=0;i<path.pts.length;i++){
      const p=path.pts[i];assert.ok(p.length===2&&p.every(Number.isFinite),label+': finite mm coordinates');
      assert.ok(p[0]>=ctx.margin-1e-6&&p[0]<=ctx.W-ctx.margin+1e-6&&p[1]>=ctx.margin-1e-6&&p[1]<=ctx.H-ctx.margin+1e-6,label+': within page margins');
      if(i)assert.ok(Math.hypot(p[0]-path.pts[i-1][0],p[1]-path.pts[i-1][1])>1e-9,label+': no repeated adjacent point');
    }
    const runLength=pathLength(path);assert.ok(runLength>1e-5,label+': drawable stroke');length+=runLength;
  }
  if(drawing.stats.style!=='Brush')assert.ok(joined,label+': fine strokes joined across triangle boundaries');
  assert.equal(drawing.stats.pathCount,drawing.paths.length,label+': truthful path count');
  assert.equal(drawing.stats.pointCount,pointCount,label+': truthful point count');
  assert.ok(Math.abs(drawing.stats.lengthMm-length)<.02,label+': truthful drawing length');
  checks++;
  return {paths:drawing.paths.length,points:pointCount,lengthMm:Math.round(length),joined};
}
function framing(view,ctx){
  const box=view.referenceBounds;
  const width=Math.max(1e-9,box.max[0]-box.min[0]),height=Math.max(1e-9,box.max[1]-box.min[1]);
  const scale=Math.min(ctx.size/Math.max(width,height),(ctx.W-ctx.margin*2)/width,(ctx.H-ctx.margin*2)/height);
  return {scale,ox:ctx.W/2-(box.min[0]+box.max[0])/2*scale,oy:ctx.H/2-(box.min[1]+box.max[1])/2*scale};
}
// Independent 2D triangle coverage checks the pen trajectories against the
// retained 3D surface without using the plotter's own visibility implementation.
function supportMask(mesh,viewOptions,ctx=context){
  const view=buildAvatarView(mesh,viewOptions),{scale,ox,oy}=framing(view,ctx);
  const width=420,height=Math.round(width*ctx.H/ctx.W),pixels=new Uint8Array(width*height),sx=width/ctx.W,sy=height/ctx.H;
  for(const triangle of view.triangles){
    const [a,b,c]=triangle.pts.map(p=>[(p[0]*scale+ox)*sx,(p[1]*scale+oy)*sy]);
    const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-12)continue;
    const x0=clamp(Math.floor(Math.min(a[0],b[0],c[0])),0,width-1),x1=clamp(Math.ceil(Math.max(a[0],b[0],c[0])),0,width-1);
    const y0=clamp(Math.floor(Math.min(a[1],b[1],c[1])),0,height-1),y1=clamp(Math.ceil(Math.max(a[1],b[1],c[1])),0,height-1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/det;
      const v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/det;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)pixels[y*width+x]=1;
    }
  }
  return {width,height,pixels,sx,sy};
}
function supported(drawing,mask,label,toleranceMm=.9){
  const radius=Math.ceil(toleranceMm*mask.sx),inside=p=>{
    const x=Math.round(p[0]*mask.sx),y=Math.round(p[1]*mask.sy);
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<mask.width&&yy<mask.height&&mask.pixels[yy*mask.width+xx])return true;
    }
    return false;
  };
  let total=0,outside=0;
  for(const path of drawing.paths)for(let i=1;i<path.pts.length;i++){
    const a=path.pts[i-1],b=path.pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.5));
    for(let step=0;step<=n;step++){const t=step/n;total++;if(!inside([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]))outside++;}
  }
  assert.ok(total>0,label+': sampled strokes');
  assert.equal(outside,0,label+': all centerlines follow the retained body ('+outside+'/'+total+' outside)');
  checks++;
}
function closedBox(x0,x1,y0,y1,z0,z1){
  const vertices=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  const faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]];
  return {kind:'mesh',tri:12,v:faces.flatMap(face=>face.flatMap(id=>vertices[id])),dims:[x1-x0,y1-y0,z1-z0]};
}
const occluder=closedBox(-.29,.29,-.2,-.12,-.5,.5),hidden=closedBox(-.21,.21,.03,.15,-.4,.4);
const occluded={kind:'mesh',tri:24,v:[...occluder.v,...hidden.v],dims:[.58,.35,1]};
const occlusionView={yaw:0,frameBox:{min:[-.35,-.55],max:[.35,.55]}};
for(const style of ['Contours','Hatching','Contours + hatching']){
  const front=plotAvatar(occluder,occlusionView,{...AVATAR_PLOT_DEFAULTS,style},context);
  const rear=plotAvatar(occluded,occlusionView,{...AVATAR_PLOT_DEFAULTS,style},context);
  assert.equal(hash(front.paths),hash(rear.paths),style+': fully hidden rear geometry adds no marks or contour phase shift');
  checks++;
}

// On a planar surface the perpendicular distances between the generated
// parallel centerlines provide an independent physical pen-clearance check.
for(const penWidth of [.35,.7]){
  const drawing=plotAvatar(occluder,occlusionView,{...AVATAR_PLOT_DEFAULTS,style:'Contours',pitch:.01,penWidth,outline:false,cutEdges:false},context);
  const runs=drawing.paths.filter(path=>pathLength(path)>20);
  assert.ok(runs.length>4,'planar spacing fixture has measurable parallel lines');
  const a=runs[0].pts[0],b=runs[0].pts.at(-1),len=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[-(b[1]-a[1])/len,(b[0]-a[0])/len];
  const intercepts=runs.map(path=>{
    const values=path.pts.map(p=>p[0]*normal[0]+p[1]*normal[1]);
    assert.ok(Math.max(...values)-Math.min(...values)<.05,'planar contours remain straight surface intersections');
    return values.reduce((sum,value)=>sum+value,0)/values.length;
  }).sort((a,b)=>a-b);
  const levels=intercepts.filter((value,i)=>!i||value-intercepts[i-1]>.05);
  assert.ok(levels.length>4,'several distinct contour levels');
  const gap=Math.min(...levels.slice(1).map((value,i)=>value-levels[i]));
  assert.ok(gap>=penWidth*2-.05,'actual planar centerline gap respects '+penWidth+' mm nib: '+gap);
  checks++;
}

const meshes={};
for(const preset of ['Male','Female'])meshes[preset]=buildAvatarMesh({...AVATAR_DEFAULTS,preset},{quality:'draft'});
const plot=(mesh,style,view={},options={},ctx=context)=>plotAvatar(mesh,view,{...AVATAR_PLOT_DEFAULTS,style,outlinePen:2,detailPen:2,shadePen:2,...options},ctx);
for(const preset of ['Male','Female']){
  const mesh=meshes[preset],before=hash(mesh.v),view={yaw:24,frame:'body'},mask=supportMask(mesh,view);
  const records={};
  for(const style of styles){
    const options={...AVATAR_PLOT_DEFAULTS,style,outlinePen:2,detailPen:2,shadePen:2},optionsBefore=hash(options);
    const drawing=plotAvatar(mesh,view,options,context);
    records[style]={drawing,...inspect(drawing,preset+' '+style)};
    assert.equal(hash(options),optionsBefore,style+': caller options unchanged');
    assert.equal(hash(mesh.v),before,style+': anatomy remains unchanged');
    assert.equal(hash(drawing),hash(plotAvatar(mesh,{...view},{...options},{...context})),style+': exact deterministic replay');
    supported(drawing,mask,preset+' '+style,style==='Brush'?Math.max(.9,AVATAR_PLOT_DEFAULTS.brushWidth*.75+.2):.9);
    assert.ok(drawing.paths.every(path=>path.layer===2),style+': requested pen assignment');
  }
  const brush=records.Brush;
  assert.ok(brush.paths<=24,preset+': brush drawing stays deliberately sparse');
  assert.ok(brush.points<records.Contours.points,preset+': fine contours carry more detail than brush');
  assert.ok(brush.drawing.paths.every(path=>pathLength(path)>=AVATAR_PLOT_DEFAULTS.brushWidth*.9),preset+': brush avoids tiny nib-sized fragments');
  assert.ok(records.Hatching.lengthMm>brush.lengthMm,preset+': shading adds drawn surface detail');
  summaries.push({preset,styles:Object.fromEntries(styles.map(style=>[style,{paths:records[style].paths,points:records[style].points,lengthMm:records[style].lengthMm}]))});
  checks++;
}

const female=meshes.Female,sourceHash=hash(female.v);
for(const view of [{yaw:90,frame:'body'},{yaw:180,frame:'body'},{yaw:35,mode:'Bust',frame:'selection'},
 {yaw:0,mode:'Feet',frame:'selection'},{yaw:32,mode:'Band',cut:.52,band:.2,frame:'body'}]){
  const mask=supportMask(female,view);
  for(const style of styles){
    const drawing=plot(female,style,view);
    inspect(drawing,style+' '+JSON.stringify(view));
    supported(drawing,mask,style+' retained region',style==='Brush'?Math.max(.9,AVATAR_PLOT_DEFAULTS.brushWidth*.75+.2):.9);
  }
}
assert.equal(hash(female.v),sourceHash,'all view, cut and drawing computations preserve anatomy');
const frontBrush=plot(female,'Brush',{yaw:0}),sideBrush=plot(female,'Brush',{yaw:90});
assert.notEqual(hash(frontBrush.paths),hash(sideBrush.paths),'rotation uses actual side anatomy');
// A symmetric figure can share its sparse front/back silhouette. Surface
// contours must still reveal the different front/back volumes.
assert.notEqual(hash(plot(female,'Contours',{yaw:0}).paths),hash(plot(female,'Contours',{yaw:180}).paths),'front/back surface anatomy differs');
const seedA=plot(female,'Brush',{yaw:24},{styleSeed:17}),seedB=plot(female,'Brush',{yaw:24},{styleSeed:981});
assert.notEqual(hash(seedA.paths),hash(seedB.paths),'drawing seed varies brush omissions independently');
for(const style of ['Contours','Hatching','Contours + hatching']){
  const fine=plot(female,style,{yaw:24},{pitch:.01,penWidth:.35});
  assert.ok(fine.stats.effectivePitch>=.7-1e-8,style+': 0.35 mm nib has physical pitch floor');
  const thick=plot(female,style,{yaw:24},{pitch:.01,penWidth:.7});
  assert.ok(thick.stats.effectivePitch>=1.4-1e-8,style+': pitch respects larger actual pen widths');
  inspect(fine,style+' dense request');inspect(thick,style+' wide pen');
  checks++;
}
const bad=normalizeAvatarPlotOptions({style:'unknown',pitch:NaN,penWidth:Infinity,brushWidth:-1e6,brushEconomy:9,styleSeed:NaN});
assert.ok(styles.includes(bad.style),'unknown plotting style has a usable default');
for(const [key,value] of Object.entries(AVATAR_PLOT_DEFAULTS))if(typeof value==='number')assert.ok(Number.isFinite(bad[key]),key+': invalid values normalized');
for(const style of styles){
  for(const view of [{mode:'Bust',cut:1},{mode:'Feet',cut:0},{mode:'Band',band:0}]){
    const empty=plot(female,style,view);
    assert.deepEqual(empty.paths,[],style+': an empty visible region produces no stray marks');
    assert.equal(empty.stats.pointCount,0);assert.equal(empty.stats.pathCount,0);assert.equal(empty.stats.lengthMm,0);
    checks++;
  }
  assert.deepEqual(plotAvatar(null,{}, {...AVATAR_PLOT_DEFAULTS,style},context).paths,[],style+': absent source safely empty');
}

const feet=plot(female,'Contours',{yaw:0,mode:'Feet',frame:'body'}),feetPoints=feet.paths.flatMap(path=>path.pts);
assert.ok(feetPoints.some(p=>p[0]<context.W/2-1)&&feetPoints.some(p=>p[0]>context.W/2+1),'feet-only plot retains both feet');

// Exercise the actual registered node, including old saved inspection patches.
const {default:avatar}=await import('../src/defs/nodes/avatar3d.js');
const defaults=Object.fromEntries(avatar.params.map(parameter=>[parameter.key,parameter.def]));
assert.ok(avatar.params.find(parameter=>parameter.key==='plotStyle'),'plot style is a persisted node control');
const nodeContext={W:210,H:297,frameCount:40,frameIdx:0};
function nodeRun(patch={},clock={},style){
  const parameters={...defaults,...patch},before=hash(parameters);
  const output=avatar.compute([style],parameters,{...nodeContext,...clock});
  assert.equal(hash(parameters),before,'plot node keeps saved parameters unchanged');
  assert.equal(output.length,3,'drawing, silhouette and mesh port indices remain stable');
  assert.equal(output[2].kind,'mesh');
  assert.ok(output[0].paths.length&&output[1].paths.length,'styled drawing and pure silhouette are available');
  return output;
}
const originalNode=nodeRun(),nodeMeshHash=hash(originalNode[2].v),nodeSilhouetteHash=hash(originalNode[1]);
for(const plotStyle of styles){
  const output=nodeRun({plotStyle});
  assert.equal(hash(output[2].v),nodeMeshHash,plotStyle+': full source mesh preserved by node');
  assert.equal(hash(output[1]),nodeSilhouetteHash,plotStyle+': independent silhouette output');
  for(const cutMode of ['Bust','Feet'])assert.equal(hash(nodeRun({plotStyle,cutMode})[2].v),nodeMeshHash,plotStyle+': cut affects drawing only');
  checks++;
}
for(const plotStyle of ['Brush','Contours']){
  const ordinary=nodeRun({plotStyle,inspection:'Silhouette'}),irrelevant=nodeRun({plotStyle,inspection:'Mesh edges'});
  assert.equal(hash(ordinary),hash(irrelevant),plotStyle+': hidden inspection setting cannot override actual plotting style');
  const width=plotStyle==='Brush'?AVATAR_PLOT_DEFAULTS.brushWidth:AVATAR_PLOT_DEFAULTS.penWidth;
  for(const mode of ['Solid','Dashed']){
    const output=nodeRun({plotStyle},{},{kind:'style',mode,dash:3,gap:2,vary:0,phase:0,seed:7});
    assert.ok(output[0].paths.every(path=>path.strokeWidth===width),plotStyle+' '+mode+': actual tool width survives style input');
    assert.equal(hash(output[2].v),nodeMeshHash,'stroke style input does not change anatomy');
    checks++;
  }
}

const feetNode=nodeRun({plotStyle:'Contours',cutMode:'Feet',framing:'Selected region',splitPens:true,outlinePen:9,detailPen:3});
const bbox=paths=>{
  const values=paths.flatMap(path=>path.pts);
  return [Math.min(...values.map(p=>p[0])),Math.min(...values.map(p=>p[1])),Math.max(...values.map(p=>p[0])),Math.max(...values.map(p=>p[1]))];
};
const styledOutline=bbox(feetNode[0].paths.filter(path=>path.layer===9)),independentOutline=bbox(feetNode[1].paths);
assert.ok(styledOutline.every((value,i)=>Math.abs(value-independentOutline[i])<1),'selected-region silhouette and styled drawing use the same physical frame');
checks++;

assert.equal(new Set(avatar.params.map(parameter=>parameter.key)).size,avatar.params.length,'drawing pitch never duplicates the original camera pitch control');
const denseNode=nodeRun({plotStyle:'Contours',linePitch:.01,penWidth:.35}),sparseNode=nodeRun({plotStyle:'Contours',linePitch:1.8,penWidth:.35});
assert.ok(denseNode[0].stats.effectivePitch>=.7,'actual node enforces0.35mmphysicalpitchfloor');
assert.notEqual(hash(denseNode[0].paths),hash(sparseNode[0].paths),'line spacing actually changes the plotted surface');
assert.equal(hash(denseNode[1]),hash(sparseNode[1]),'line spacing does not change camera elevation or silhouette');
assert.equal(hash(denseNode[2].v),hash(sparseNode[2].v),'line spacing never changes body anatomy');
checks++;

for(const inspection of ['Silhouette','Mesh edges']){
  const old={...defaults,inspection};delete old.plotStyle;
  assert.equal(hash(avatar.compute([undefined],old,nodeContext)),hash(nodeRun({plotStyle:'Inspection',inspection})),'older saved '+inspection+' patches preserve inspection rendering');
  checks++;
}
for(const animation of ['Turntable','Rotating bust','Feet slice']){
  const timeline=nodeRun({plotStyle:'Contours',motion:'Timeline',animation},{frameIdx:10});
  const manual=nodeRun({plotStyle:'Contours',motion:'Manual',animation,phase:.25});
  assert.equal(hash(timeline),hash(manual),'plotting preserves exact animation scrubbing: '+animation);
  assert.equal(hash(timeline[2].v),nodeMeshHash,'animated style never changes anatomy');
  checks++;
}

console.log(JSON.stringify({checks,meshes:summaries},null,2));
console.log('PASS: Avatar plotting determinism, physical pen spacing, brush economy, joined paths, retained-surface support and unchanged anatomy.');
