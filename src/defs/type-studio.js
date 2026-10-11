// Built-in composition adapter. Keep the drawing algorithms in their original
// nodes: Type Studio supplies a compact, stable set of typography controls.
import text from './nodes/hersheytext.js';
import lettering from './nodes/lettering.js';
import contours from './nodes/sdfcontours.js';
import roots from './nodes/myceliumfill.js';
import pattern from './nodes/patternfill.js';
import image from './nodes/image.js';
import coil from './nodes/zigzag_path.js';
import stitches from './nodes/stitchtype.js';
import ribbon from './nodes/ribbontype.js';
import poetry from './nodes/concrete.js';
import gravity from './nodes/gravity.js';
import ascii from './nodes/asciiart.js';
import { EMPTY, applyStyle } from './helpers.js';

export const TYPE_STUDIO_STYLES = [
  '01 / Contour type', '02 / Living strokes', '03 / Patterned face',
  '04 / Modular squares', '05 / Serpentine type', '07 / Modular marks',
  '08 / Hairline lettering', '10 / Words inside a word',
  '11 / Falling characters', '12 / Text made of text',
];
const defaults = d => Object.fromEntries(d.params.map(p => [p.key, p.def]));
const definitions = { text, lettering, contours, roots, pattern, image, coil, stitches, ribbon, poetry, gravity, ascii };
const base = Object.fromEntries(Object.entries(definitions).map(([k, d]) => [k, defaults(d)]));
const is = (p, n) => String(p.mode || TYPE_STUDIO_STYLES[0]).startsWith(n + ' /');
const modes = (...ids) => p => ids.some(n => is(p, n));
const control = (def, key, alias, ids, value, label) => {
  const source = def.params.find(p => p.key === key);
  return { ...source, key: alias, def: value ?? source.def, label: label || source.label, showIf: modes(...ids) };
};
export const typeStudioParams = [
  { key: 'mode', label: 'Type treatment', type: 'select', options: TYPE_STUDIO_STYLES, def: TYPE_STUDIO_STYLES[0] },
  { key: 'text', label: 'Text (| = new line; max 128)', type: 'text', def: 'TYPE' },
  { key: 'size', label: 'Letter height mm', type: 'slider', min: 8, max: 100, step: 1, def: 40, showIf: p => !is(p, '11') },
  { key: 'scale', label: 'Composition scale %', type: 'slider', min: 10, max: 100, step: 1, def: 100 },
  { key: 'tracking', label: 'Letter spacing ×', type: 'slider', min: 0.65, max: 2, step: .05, def: 1, showIf: p => !is(p, '11') },
  { key: 'align', label: 'Align', type: 'select', options: ['Left', 'Center', 'Right'], def: 'Center' },
  { key: 'margin', label: 'Margin mm', type: 'slider', min: 0, max: 60, step: 1, def: 12 },
  { key: 'seed', label: 'Seed', type: 'seed', def: 7, showIf: modes('02','03','04','05','07','08','11') },
  { key: 'layer', label: 'Pen', type: 'pen', def: 0, showIf: p => !is(p,'07') || p.stitchColours === 'One pen' },
  control(lettering,'weight','weight',['03','04','10','12'],32,'Face weight %'),
  control(contours,'count','contourCount',['01'],6),
  control(contours,'start','contourStart',['01'],1.5),
  control(contours,'step','contourStep',['01'],1.5),
  control(contours,'cell','contourCell',['01'],1),
  control(contours,'keep','contourKeep',['01'],false),
  control(roots,'strands','rootStrands',['02'],4),
  control(roots,'width','rootWidth',['02'],5),
  control(roots,'boost','rootBoost',['02'],.8),
  control(roots,'wav','rootWave',['02'],.6),
  control(roots,'taper','rootTaper',['02'],5),
  control(roots,'keep','rootKeep',['02'],true),
  control(pattern,'pattern','pattern',['03'],'Chevron'),
  control(pattern,'spacing','patternSpacing',['03'],1.3),
  control(pattern,'angle','patternAngle',['03'],45),
  control(pattern,'inset','patternInset',['03'],.4),
  control(pattern,'hand','patternWobble',['03'],.08),
  control(pattern,'outlines','patternOutline',['03'],true),
  control(image,'cell','squareCell',['04'],1.8),
  control(image,'squarefill','squareFill',['04'],'Outline'),
  control(image,'squarelayout','squareLayout',['04'],'Staggered'),
  control(image,'pitch','squarePitch',['04'],.3),
  control(image,'jitter','squareJitter',['04'],0),
  control(coil,'mode','coilMode',['05'],'Coil','Stroke shape'),
  control(coil,'amp','coilAmp',['05'],2),
  control(coil,'wl','coilWave',['05'],2.5),
  control(coil,'phase','coilPhase',['05'],0),
  control(coil,'varyamp','coilVary',['05'],.1,'Stroke variation'),
  control(coil,'fade','coilFade',['05'],3),
  control(stitches,'font','stitchFont',['07'],'Sampler 5x7'),
  control(stitches,'px','stitchPixels',['07'],2),
  control(stitches,'preset','stitchPreset',['07'],'Sampler'),
  { key:'stitchColours', label:'Stitch colours', type:'select', options:['One pen','Ring pens','Source pens'], def:'Ring pens', showIf:modes('07') },
  control(stitches,'motifCells','motifCells',['07'],'Letter'),
  control(stitches,'motifSize','motifSize',['07'],.85),
  control(stitches,'motifAngle','motifAngle',['07'],0),
  control(stitches,'motifTurn','motifTurn',['07'],0),
  control(stitches,'motifVary','motifVary',['07'],0),
  control(ribbon,'width','ribbonWidth',['08'],.28),
  control(ribbon,'gap','ribbonGap',['08'],.65),
  control(ribbon,'slant','ribbonSlant',['08'],8),
  control(ribbon,'facets','ribbonFacets',['08'],8),
  control(ribbon,'asym','ribbonAsym',['08'],'None'),
  control(ribbon,'asymAmt','ribbonAsymAmount',['08'],.4),
  { key:'smallText', label:'Small text (blank = main text)', type:'text', def:'', showIf:modes('10') },
  control(poetry,'size','smallSize',['10'],2.5,'Small letter height mm'),
  control(poetry,'track','smallTracking',['10'],.8,'Small letter spacing ×'),
  control(poetry,'lineh','smallLine',['10'],1.25,'Small line spacing ×'),
  { key:'fallUnit',label:'Stamp uses',type:'select',options:['Whole text','Characters'],def:'Characters',showIf:modes('11') },
  control(gravity,'cols','fallCols',['11'],18),
  control(gravity,'rows','fallRows',['11'],10),
  control(gravity,'stampSize','fallSize',['11'],.65),
  control(gravity,'release','fallRelease',['11'],.55),
  control(gravity,'progress','fallProgress',['11'],.5),
  control(gravity,'drift','fallDrift',['11'],8),
  control(gravity,'spin','fallSpin',['11'],40),
  control(gravity,'pile','fallPile',['11'],'Heap'),
  control(ascii,'cols','asciiCols',['12'],70),
  control(ascii,'aspect','asciiAspect',['12'],1.3),
  control(ascii,'rampCustom','asciiRamp',['12'],'.:TYPE','Characters from light to dark'),
  control(ascii,'gamma','asciiGamma',['12'],1),
  control(ascii,'thresh','asciiThreshold',['12'],.03),
  control(ascii,'charSize','asciiSize',['12'],85),
];
// Custom mark selectors remain the responsibility of Stitch Type. Studio offers
// its four curated presets, rather than displaying inactive Custom controls.
typeStudioParams.find(p=>p.key==='stitchPreset').options=['Sampler','Circuit','Knit','Dotted'];

export function studioParameters(input={}) {
  const p={};
  for (const d of typeStudioParams) {
    const v=input[d.key] ?? d.def;
    if(d.options) p[d.key]=d.options.includes(v)?v:d.def;
    else if(d.type==='text') p[d.key]=String(v).replace(/\r?\n/g,'|').slice(0,128);
    else if(d.type==='check') p[d.key]=!!v;
    else {
      const n=Number.isFinite(Number(v))?Number(v):d.def;
      p[d.key]=Math.max(d.min??(d.type==='pen'?0:-1e9),Math.min(d.max??(d.type==='pen'?11:1e9),n));
      if(['seed','pen'].includes(d.type)||d.step===1)p[d.key]=Math.round(p[d.key]);
    }
  }
  return p;
}
export function studioFrame(p,ctx={}) {
  const W=Number(ctx.W),H=Number(ctx.H);
  if(!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0)return null;
  const margin=Math.min(p.margin,Math.min(W,H)*.45);
  return {W,H,margin,x:margin,y:margin,w:W-2*margin,h:H-2*margin};
}
function bounds(paths) {
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const q of paths)for(const [x,y] of q.pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  return {x0,y0,w:x1-x0,h:y1-y0};
}
// Shrink to fit. An oversized word is kept whole rather than cropped by a field
// effect or the engine. The user can choose its horizontal alignment afterwards.
export function fitStudioPaths(result,frame,scale=1,align='Center') {
  if(!result.paths.length)return EMPTY;
  const b=bounds(result.paths),s=Math.min(1,frame.w/Math.max(1e-9,b.w),frame.h/Math.max(1e-9,b.h))*scale;
  const x=frame.x+(frame.w-b.w*s)*(align==='Left'?0:align==='Right'?1:.5);
  const y=frame.y+(frame.h-b.h*s)/2;
  return {paths:result.paths.map(q=>({...q,pts:q.pts.map(([px,py])=>[x+(px-b.x0)*s,y+(py-b.y0)*s])}))};
}
function run(key,params,ins,ctx){const d=definitions[key];return d.compute(ins,{...base[key],...params},ctx,{});}
function frameInset(ctx,margin){const m=Math.min(margin,Math.min(ctx.W,ctx.H)*.45);return {x:m,y:m,w:ctx.W-2*m,h:ctx.H-2*m};}
function letterSource(p,ctx,padding=0){return fitStudioPaths(run('text',{text:p.text,size:p.size,track:p.tracking*100,layer:p.layer},[],ctx),frameInset(ctx,p.margin+padding));}
function faceSource(p,ctx,extra={}){return run('lettering',{text:p.text,size:p.size,tracking:p.tracking,weight:p.weight,fill:'Outline',depth:0,margin:p.margin,layer:p.layer,...extra},[],ctx);}

function falling(p,ctx) {
  const gp={...base.gravity,cols:p.fallCols,rows:p.fallRows,stampSize:p.fallSize,release:p.fallRelease,progress:p.fallProgress,drift:p.fallDrift,spin:p.fallSpin,pile:p.fallPile,palette:1,penA:p.layer,seed:p.seed,margin:p.margin};
  if(p.fallUnit==='Whole text') {
    const source=run('text',{text:p.text,size:12,layer:p.layer},[],ctx);
    return source.paths.length?gravity.compute([source],gp,ctx):EMPTY;
  }
  // The shared Gravity solver supplies stable cell identities, rotations and
  // the pile. Only the stamp differs: one complete glyph per cell, in text order.
  const glyphs=[...p.text.toUpperCase().replace(/\|/g,' ')].map(ch=>{
    const source=run('text',{text:ch,size:10,layer:p.layer},[],ctx);
    if(!source.paths.length)return null;
    const b=bounds(source.paths),s=2/Math.max(1e-9,b.w,b.h);
    return source.paths.map(q=>({...q,pts:q.pts.map(([x,y])=>[(x-b.x0-b.w/2)*s,(y-b.y0-b.h/2)*s])}));
  }).filter(Boolean);
  if(!glyphs.length)return EMPTY;
  const {els}=gravity._layout(gp,ctx,[]),paths=[];
  for(const e of els){const c=Math.cos(e.ang),s=Math.sin(e.ang);
    for(const q of glyphs[(e.j*gp.cols+e.i)%glyphs.length])paths.push({...q,layer:e.pen,pts:q.pts.map(([x,y])=>[e.x+(x*c-y*s)*e.r,e.y+(x*s+y*c)*e.r])});
  }
  return {paths};
}
export function studioRecipe(p,ctx,motif) {
  const seed=p.seed,layer=p.layer;
  switch(p.mode) {
    case TYPE_STUDIO_STYLES[0]: {
      const padding=p.contourStart+p.contourStep*(p.contourCount-1)+p.contourCell*2;
      const source=letterSource(p,ctx,padding);
      return run('contours',{start:p.contourStart,step:p.contourStep,count:p.contourCount,cell:p.contourCell,keep:p.contourKeep,layer},[source],ctx);
    }
    case TYPE_STUDIO_STYLES[1]: return run('roots',{strands:p.rootStrands,width:p.rootWidth,boost:p.rootBoost,wav:p.rootWave,taper:p.rootTaper,keep:p.rootKeep,seed,layer},[letterSource(p,ctx,p.rootWidth*2)],ctx);
    case TYPE_STUDIO_STYLES[2]: return run('pattern',{pattern:p.pattern,spacing:p.patternSpacing,angle:p.patternAngle,inset:p.patternInset,hand:p.patternWobble,vary:0,outlines:p.patternOutline,seed,layer},[faceSource(p,ctx)],ctx);
    case TYPE_STUDIO_STYLES[3]: return run('image',{source:'Drawing (wired)',drawingFill:true,drawingWidth:.2,mode:'Square weave',cell:p.squareCell,jitter:p.squareJitter,squarefill:p.squareFill,squarelayout:p.squareLayout,pitch:p.squarePitch,strength:1,margin:p.margin,seed,layer},[undefined,faceSource(p,ctx)],ctx);
    case TYPE_STUDIO_STYLES[4]: return run('coil',{mode:p.coilMode,amp:p.coilAmp,wl:p.coilWave,phase:p.coilPhase,varyamp:p.coilVary,varywl:p.coilVary,fade:p.coilFade,seed},[letterSource(p,ctx,p.coilAmp*2)],ctx);
    case TYPE_STUDIO_STYLES[5]: {
      const mono=p.stitchColours==='One pen';
      return run('stitches',{text:p.text,font:p.stitchFont,cell:p.size/((p.stitchFont==='Tiny 3x5'?5:7)*p.stitchPixels),px:p.stitchPixels,gap:Math.round(3*p.tracking),preset:p.stitchPreset,margin:p.margin,seed,motifCells:p.motifCells,motifSize:p.motifSize,motifAngle:p.motifAngle,motifTurn:p.motifTurn,motifVary:p.motifVary,motifPens:p.stitchColours==='Source pens'?'Source pens':'Region pens',...(mono?{penCore:layer,penEdge:layer,penHalo:layer,penAura:layer,penPins:layer}:{})},[undefined,motif],ctx);
    }
    case TYPE_STUDIO_STYLES[6]: {
      // Ribbon Type has a lowercase alphabet. Studio adds line layout around it,
      // without copying or inventing glyphs unsupported by that alphabet.
      const lines=p.text.split('|').slice(0,8),paths=[];
      for(let i=0;i<lines.length;i++){
        const r=run('ribbon',{text:lines[i],xh:p.size,width:p.ribbonWidth,gap:p.ribbonGap,slant:p.ribbonSlant,facets:p.ribbonFacets,asym:p.ribbonAsym,asymAmt:p.ribbonAsymAmount,spacing:.12*p.tracking,fit:true,margin:p.margin,layer,seed},[],ctx);
        if(!r.paths.length)continue;const b=bounds(r.paths);
        const advance=p.size*(base.ribbon.asc+base.ribbon.desc+1);
        for(const q of r.paths)paths.push({...q,pts:q.pts.map(([x,y])=>[x-b.x0,y-b.y0+i*advance])});
      }
      return {paths};
    }
    case TYPE_STUDIO_STYLES[7]: {
      const face=faceSource(p,ctx);if(!face.paths.length)return EMPTY;
      return run('poetry',{text:p.smallText.trim()?p.smallText:p.text,size:p.smallSize,track:p.smallTracking,lineh:p.smallLine,mode:'Fill region',motion:'Off',margin:p.margin,seed,layer},[face],ctx);
    }
    case TYPE_STUDIO_STYLES[8]: return falling(p,ctx);
    case TYPE_STUDIO_STYLES[9]: {
      const face=faceSource(p,ctx,{fill:'Hatch',hatch:.4});if(!face.paths.length)return EMPTY;
      return run('ascii',{cols:p.asciiCols,aspect:p.asciiAspect,ramp:'Custom',rampCustom:p.asciiRamp,gamma:p.asciiGamma,thresh:p.asciiThreshold,charSize:p.asciiSize,margin:p.margin,layer},[face],ctx);
    }
    default: return EMPTY;
  }
}
// Preserve all paths when possible, sharing excess detail across the whole word.
export function studioBudget(result,budget=112000) {
  let paths=result.paths.filter(q=>q.pts?.length>=(q.closed?3:2)&&q.pts.every(pt=>Number.isFinite(pt[0])&&Number.isFinite(pt[1])));
  let minimum=paths.reduce((sum,q)=>sum+(q.closed?3:2),0);
  if(minimum>budget){const count=Math.floor(budget/3),old=paths;paths=Array.from({length:count},(_,i)=>old[Math.floor(i*old.length/count)]);minimum=paths.reduce((sum,q)=>sum+(q.closed?3:2),0);}
  const total=paths.reduce((sum,q)=>sum+q.pts.length,0);
  if(total<=budget)return {paths};
  const share=(budget-minimum)/Math.max(1,total-minimum);
  return {paths:paths.map(q=>{const min=q.closed?3:2,n=min+Math.floor((q.pts.length-min)*share);return {...q,pts:Array.from({length:n},(_,j)=>q.pts[Math.floor(j*(q.closed?q.pts.length/n:(q.pts.length-1)/(n-1)))])};})};
}
export function computeTypeStudio(ins,p,ctx) {
  p=studioParameters(p);const frame=studioFrame(p,ctx);
  if(!frame||!p.text.replace(/[\s|]/g,''))return EMPTY;
  // Bound the working surface for field algorithms; a large physical page scales
  // the finished composition instead of allocating an enormous sampling grid.
  const k=Math.min(1,420/Math.max(frame.W,frame.H));
  const work={...ctx,W:frame.W*k,H:frame.H*k};
  const wp={...p,margin:frame.margin*k,size:p.size*k};
  const raw=studioBudget(studioRecipe(wp,work,ins?.[1]));
  const page={paths:raw.paths.map(q=>({...q,pts:q.pts.map(([x,y])=>[x/k,y/k])}))};
  const placed=fitStudioPaths(page,frame,p.scale/100,p.align);
  return studioBudget(applyStyle(placed,ins?.[0]));
}
