// Inventory every built-in definition and its source branches. Evidence only:
// zero effect in one sample is never sufficient to hide a control.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseAst} from 'rolldown/parseAst';
export async function inventory() {
  const result=[];
  for(const file of (await fs.readdir('src/defs/nodes')).filter(f=>f.endsWith('.js')).sort()) {
    const source=await fs.readFile('src/defs/nodes/'+file,'utf8'),def=(await import(pathToFileURL(path.resolve('src/defs/nodes',file)))).default;
    const branches=[];
    function walk(n){if(!n||typeof n!=='object')return;
      const test=n.type==='IfStatement'||n.type==='ConditionalExpression'?n.test:n.type==='SwitchStatement'?n.discriminant:null;
      if(test){const text=source.slice(test.start,test.end);if(/\bp\.|\bmode\b|\bshape\b|\btype\b|\bstyle\b/.test(text))branches.push({line:source.slice(0,test.start).split('\n').length,test:text});}
      for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);
    }
    walk(parseAst(source));
    result.push({key:def.key,name:def.name,file,parameters:def.params.map(p=>({key:p.key,type:p.type,default:p.def,options:p.options,existingShowIf:typeof p.showIf==='function'?String(p.showIf):null})),branches});
  }
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const rows=await inventory(),out=process.argv[2]||'/tmp/muusia-parameter-visibility-audit.json';await fs.writeFile(out,JSON.stringify({nodes:rows.length,definitions:rows},null,2)+'\n');console.log(`Inventoried ${rows.length} node modules, ${rows.reduce((n,r)=>n+r.parameters.length,0)} parameters → ${out}`);
}
