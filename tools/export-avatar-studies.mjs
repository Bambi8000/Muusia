/* Physical-size starter sheets from the same engine as the Avatar 3D node. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {buildAvatarMesh} from '../src/avatar-geometry.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';
import {avatarPlotSvg} from '../src/avatar-plot-export.js';
const destination=resolve(process.argv[2]||'output/avatar-plot-studies');
const styles=['Brush','Contours','Hatching','Contours + hatching'];
const zip={},manifest=[];
await mkdir(destination,{recursive:true});
for(const preset of ['Male','Female']){
  const seed=preset==='Male'?17:43,mesh=buildAvatarMesh({preset,seed},{quality:'review'});
  const studies=[...styles.map(style=>({style,mode:'Full body'})),{style:'Brush',mode:'Bust'},{style:'Hatching',mode:'Bust'},{style:'Contours + hatching',mode:'Feet'}];
  for(const study of studies){
    const selected=study.mode!=='Full body',context={W:210,H:selected?(study.mode==='Bust'?170:150):297,size:selected?190:260,margin:12,pen:0};
    const options={...AVATAR_PLOT_DEFAULTS,style:study.style,styleSeed:137,brushWidth:2.5,penWidth:.35,pitch:.9};
    const view={yaw:30,pitch:0,roll:0,mode:study.mode,frame:selected?'selection':'body',rotationEnvelope:'yaw'};
    const drawing=plotAvatar(mesh,view,options,context);
    const name=('avatar-'+preset+'-'+study.mode+'-'+study.style).toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.svg';
    const svg=avatarPlotSvg(drawing,context,{...options,title:preset+' · '+study.mode+' · '+study.style,preset,mode:study.mode,seed});
    await writeFile(resolve(destination,name),svg);zip[name]=strToU8(svg);
    manifest.push({file:name,preset,anatomySeed:seed,styleSeed:options.styleSeed,style:study.style,visibleBody:study.mode,paperMm:[context.W,context.H],strokeWidthMm:study.style==='Brush'?2.5:.35,...drawing.stats});
    console.log(name+' · '+drawing.paths.length+' strokes');
  }
}
const notes='Avatar 3D plotting studies\n\nAll SVGs are vector centerlines in millimetres. Print or import at actual size (100%). Brush samples use 2.5 mm stroke appearance and geometry spacing; pen samples use 0.35 mm stroke appearance and nominal 0.9 mm line pitch. The physical brush/pen determines the actual ink width. Use a small physical crop to check ink spread and spacing on your paper.\n\nBoth bodies come from MakeHuman HM08 CC0 graphical assets. Morphs, cuts, visibility and drawing paths use Muusia\'s Avatar 3D engine. Each file records its seeds and treatment in SVG metadata.\n';
zip['README.txt']=strToU8(notes);zip['manifest.json']=strToU8(JSON.stringify(manifest,null,2));
await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(resolve(destination,'avatar-plot-studies.zip'),zipSync(zip,{level:6}));
console.log(resolve(destination,'avatar-plot-studies.zip'));
