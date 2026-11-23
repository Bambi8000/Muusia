/* Physical-size run loops and stand/walk/run transition studies. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {buildAvatarMesh} from '../src/avatar-geometry.js';
import {composeAvatarPose} from '../src/avatar-pose-control.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';
import {avatarPlotSvg} from '../src/avatar-plot-export.js';

const destination=resolve(process.argv[2]||'output/avatar-run-studies');
const context={W:210,H:297,size:260,margin:12,pen:0},frameCount=24;
const base={poseMode:'Stand / walk / run',gaitFrom:'Standing',gaitTo:'Running',gaitTransition:'Manual',gaitMotion:'Manual',gaitBlend:1,gaitSpeed:1,gaitStride:1,gaitArmSwing:1,gaitGround:true};
const options={...AVATAR_PLOT_DEFAULTS,styleSeed:137,brushWidth:2.5,penWidth:.35,pitch:.9};
const archive={},manifest=[],mtime=new Date('2000-01-01T00:00:00Z');
const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-');
await mkdir(destination,{recursive:true});
for(const preset of ['Male','Female']){
  const seed=preset==='Male'?17:43,rest=buildAvatarMesh({preset,seed},{quality:'review'});
  const studies=[
    ...Array.from({length:frameCount},(_,frame)=>({phase:frame/frameCount,blend:1,style:'Brush',mode:'Full body',sequence:{name:'run-cycle',frame,frameCount,loop:true}})),
    ...Array.from({length:17},(_,frame)=>({phase:(frame/8)%1,blend:frame/16,style:'Brush',mode:'Full body',sequence:{name:'stand-walk-run',frame,frameCount:17,loop:false}})),
    ...['Brush','Contours','Hatching','Contours + hatching'].map((style,i)=>({phase:i/4,blend:1,style,mode:'Full body'})),
    {phase:.125,blend:1,style:'Contours',mode:'Bust'},
    {phase:.375,blend:1,style:'Contours + hatching',mode:'Feet'},
  ];
  for(const study of studies){
    const parameters={...base,gaitPhase:study.phase,gaitBlend:study.blend},mesh=composeAvatarPose(rest,parameters);
    const view={yaw:30,pitch:0,roll:0,mode:study.mode,frame:study.mode==='Full body'?'body':'selection',rotationEnvelope:'yaw'};
    const settings={...options,style:study.style},drawing=plotAvatar(mesh,view,settings,context);
    const suffix=study.sequence?study.sequence.name+'-'+String(study.sequence.frame+1).padStart(2,'0'):'study-'+slug(study.mode)+'-'+slug(study.style);
    const name='avatar-'+slug(preset)+'-'+suffix+'.svg';
    const metadata={movement:parameters,...(study.sequence?{sequence:study.sequence}:{}),camera:view,meshQuality:'review'};
    const svg=avatarPlotSvg(drawing,context,{...settings,title:preset+' · '+(study.sequence?study.sequence.name+' · '+(study.sequence.frame+1):'Running · '+study.mode+' · '+study.style),preset,seed,mode:study.mode,metadata});
    archive[name]=[strToU8(svg),{mtime}];await writeFile(resolve(destination,name),svg);
    manifest.push({file:name,body:preset,anatomySeed:seed,drawingSeed:settings.styleSeed,...metadata,style:study.style,paperMm:[context.W,context.H],strokeWidthMm:study.style==='Brush'?settings.brushWidth:settings.penWidth,poseFrameBounds:mesh.poseFrameBounds,...drawing.stats});
    console.log(name+' · '+drawing.paths.length+' strokes');
  }
}
const notes=`Avatar 3D run and movement studies

Each body has a 24-frame Brush run loop (phases 0/24 through 23/24, without a repeated end frame), and a 17-frame one-way Standing-to-Walking-to-Running transition. The transition passes exactly through Walking at its middle and continues into Running at the end. It is not intended to wrap back to Standing; the separate run-cycle sequence loops. Both sequences share a complete movement envelope, keeping scale constant during changes of phase and gait.

Extra studies show all four plotting styles plus anatomical Bust and Feet cuts. All files use vector centerlines in millimetres on A4 paper (210 × 297 mm). Brush geometry and appearance use 2.5 mm; fine pen studies use 0.35 mm with nominal 0.9 mm spacing. Import at 100%. Your physical tool supplies the ink width.

Choose Posing Stand / walk / run in Avatar 3D. Start movement and End movement can be Standing, Walking or Running. Movement blend smoothly mixes their joint controls while the step phase stays continuous. Movement transition Timeline uses a one-way or ping-pong envelope. Cycle motion separately controls the repeating gait clock. Stride, arm swing and A joint offsets remain independent. Ground movement includes a smooth running flight lift; this is an art gait without a planted-foot or collision solver.

Male anatomy seed is 17, Female anatomy seed is 43, and drawing seed is 137. Review mesh quality is used throughout. The MakeHuman HM08 mesh, shape targets, rig and weights are CC0 assets. The manifest and SVG metadata retain the settings used by the same geometry and drawing engines as the node.
`;
for(const [name,value] of [['README.txt',notes],['manifest.json',JSON.stringify(manifest,null,2)+'\n']]){
  await writeFile(resolve(destination,name),value);archive[name]=[strToU8(value),{mtime}];
}
await writeFile(resolve(destination,'avatar-run-studies.zip'),zipSync(archive,{level:6}));
console.log(resolve(destination,'avatar-run-studies.zip'));
