import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as H from '../../src/defs/helpers.js';
import {withParameterVisibility} from '../../src/defs/parameter-visibility.js';
export const HERE=path.dirname(fileURLToPath(import.meta.url)), ROOT=path.resolve(HERE,'../..');
export const studies=[
 {id:'folded-grid-colour-drift-a3',title:'Three-pen colour drift',output:'Merge',help:'Multicolour Grid · Colour drift'},
 {id:'folded-grid-3-pen-a3',title:'Three pens through one Warp',output:'Warp',help:'Multicolour Grid · Three shared-warp pens'},
 {id:'folded-grid-4-pen-a3',title:'Four pens through one Warp',output:'Warp',help:'Multicolour Grid · Four shared-warp pens'}
];
export const pages=['multicolour-grid/index.html'];
export const defs={};
for(const k of ['mm_paper','array','setpen','warp','merge'])defs[k]=withParameterVisibility((await import('../../src/defs/nodes/'+k+'.js')).default);
export const patch=id=>JSON.parse(fs.readFileSync(path.join(HERE,'patches',id+'.muusia.json'),'utf8'));
const app=fs.readFileSync(path.join(ROOT,'src/App.jsx'),'utf8');
export const engineSource=app.slice(app.indexOf('function defIns(node)'),app.indexOf('/* ============================================================\n   G-CODE'));
export const exporterSource=app.slice(app.indexOf('function toSVG(ps, ctx)'),app.indexOf('/* --- DXF R12 export'));
export const gcodeSource=app.slice(app.indexOf('function toGcode('),app.indexOf('function toSVG('));
const solid=JSON.parse(app.match(/const SOLID_STYLE = (\{[^;]+\});/)[1].replace(/(\w+):/g,'"$1":'));
const evalLevel=Function('DEFS','EMPTY','SOLID_STYLE',engineSource+';return evalLevel;')(defs,H.EMPTY,solid);
export const evaluate=p=>evalLevel(p.root,p.canvas).out[p.root.outputId][0];
export const toSVG=Function('PENS',exporterSource+';return toSVG;')(H.PENS);
