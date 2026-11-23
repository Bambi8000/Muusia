/* Repeatable physical-size walk frames from the Avatar 3D node's composition. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {buildAvatarMesh} from '../src/avatar-geometry.js';
import {composeAvatarPose} from '../src/avatar-pose-control.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';
import {avatarPlotSvg} from '../src/avatar-plot-export.js';

const destination=resolve(process.argv[2]||'output/avatar-walk-studies');
const frameCount=24,context={W:210,H:297,size:260,margin:12,pen:0};
const walk={poseMode:'Walk cycle',walkMotion:'Manual',walkSpeed:1,walkStride:1,walkArmSwing:1,walkGround:true};
const options={...AVATAR_PLOT_DEFAULTS,styleSeed:137,brushWidth:2.5,penWidth:.35,pitch:.9};
const archive={},manifest=[],mtime=new Date('2000-01-01T00:00:00Z');
const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-');
await mkdir(destination,{recursive:true});
for(const preset of ['Male','Female']){
  const seed=preset==='Male'?17:43,rest=buildAvatarMesh({preset,seed},{quality:'review'});
  const studies=[
    ...Array.from({length:frameCount},(_,frame)=>({phase:frame/frameCount,style:'Brush',mode:'Full body',frame})),
    ...['Brush','Contours','Hatching','Contours + hatching'].map((style,i)=>({phase:i/4,style,mode:'Full body'})),
    {phase:.125,style:'Contours',mode:'Bust'},
    {phase:.375,style:'Contours + hatching',mode:'Feet'},
  ];
  for(const study of studies){
    const parameters={...walk,walkPhase:study.phase},mesh=composeAvatarPose(rest,parameters);
    const view={yaw:30,pitch:0,roll:0,mode:study.mode,frame:study.mode==='Full body'?'body':'selection',rotationEnvelope:'yaw'};
    const settings={...options,style:study.style},drawing=plotAvatar(mesh,view,settings,context);
    const sequence=Number.isInteger(study.frame)?{frame:study.frame,frameCount,duplicateEndFrame:false}:undefined;
    const suffix=sequence?'frame-'+String(study.frame+1).padStart(2,'0'):'study-'+slug(study.mode)+'-'+slug(study.style);
    const name='avatar-'+slug(preset)+'-walk-'+suffix+'.svg';
    const metadata={walk:parameters,...(sequence?{sequence}:{}),camera:view,meshQuality:'review'};
    const svg=avatarPlotSvg(drawing,context,{...settings,title:preset+' · Walk · '+(sequence?String(study.frame+1)+' / '+frameCount:study.mode+' · '+study.style),preset,seed,mode:study.mode,metadata});
    archive[name]=[strToU8(svg),{mtime}];await writeFile(resolve(destination,name),svg);
    manifest.push({file:name,body:preset,anatomySeed:seed,drawingSeed:settings.styleSeed,...metadata,style:study.style,
      paperMm:[context.W,context.H],strokeWidthMm:study.style==='Brush'?settings.brushWidth:settings.penWidth,
      poseFrameBounds:mesh.poseFrameBounds,...drawing.stats});
    console.log(name+' · '+drawing.paths.length+' strokes');
  }
}
const notes=`Avatar 3D walk studies

Each body has a 24-frame Brush cycle, sampled at phases 0/24 through 23/24. Play the numbered frames in order and repeat from frame 24 to frame 1; there is no duplicate end frame. All frames share one complete-cycle camera envelope and physical scale. The extra studies show all four plotting styles and anatomical Bust and Feet cuts.

SVGs contain vector centerlines in millimetres on A4 paper (210 × 297 mm). Brush geometry and appearance use 2.5 mm; fine pen studies use 0.35 mm and nominal 0.9 mm line spacing. Import at 100%. The physical tool supplies the ink width.

Default stride and arm swing are 1×. Speed 1× samples one complete cycle per timeline loop; higher whole speed multiples remain seamless. In Muusia, set Posing to Walk cycle and Walk motion to Timeline. Use enough ANIMATE frames to retain at least 24 frames per cycle. Walking is in place, with authored skinning, knee flexion, ankle motion and floor grounding. Joint offsets can be adjusted independently. The gait is procedural and does not provide a planted-foot or collision solver.

The MakeHuman HM08 body, shape targets, rig and skin weights are CC0 assets. Male anatomy seed is 17, Female anatomy seed is 43, drawing seed is 137. The manifest and SVG metadata retain the settings used. All samples use the same composition and drawing engines as Avatar 3D.
`;
const manifestText=JSON.stringify(manifest,null,2)+'\n';
for(const [name,value] of [['README.txt',notes],['manifest.json',manifestText]]){
  await writeFile(resolve(destination,name),value);archive[name]=[strToU8(value),{mtime}];
}
await writeFile(resolve(destination,'avatar-walk-studies.zip'),zipSync(archive,{level:6}));
console.log(resolve(destination,'avatar-walk-studies.zip'));
