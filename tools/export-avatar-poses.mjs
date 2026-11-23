/* Physical-size pose studies from the same composition as the Avatar 3D node. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {buildAvatarMesh} from '../src/avatar-geometry.js';
import {AVATAR_POSE_NAMES,composeAvatarPose} from '../src/avatar-pose-control.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';
import {avatarPlotSvg} from '../src/avatar-plot-export.js';

const destination=resolve(process.argv[2]||'output/avatar-pose-studies');
const anatomy={preset:'Female',seed:43},styleSeed=137;
const restMesh=buildAvatarMesh(anatomy,{quality:'review'});
const context={W:210,H:297,size:260,margin:12,pen:0};
const view={yaw:30,pitch:0,roll:0,mode:'Full body',frame:'body'};
const options={...AVATAR_PLOT_DEFAULTS,styleSeed,brushWidth:2.5,penWidth:.35,pitch:.9};
const archive={},manifest=[],archiveDate=new Date('2000-01-01T00:00:00Z');
const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-');
await mkdir(destination,{recursive:true});

async function saveStudy({name,poseParameters,clock={},style,sequence}){
  const mesh=composeAvatarPose(restMesh,poseParameters,clock);
  const plotOptions={...options,style};
  const drawing=plotAvatar(mesh,view,plotOptions,context);
  const pose={start:poseParameters.posePreset,end:poseParameters.poseTarget,
    blend:mesh.metadata.poseBlend??0,easing:poseParameters.poseEasing,ground:poseParameters.poseGround};
  const metadata={pose,...(sequence?{sequence}:{}),camera:view,meshQuality:'review'};
  const title=sequence?'Female · Relaxed → Reach · '+String(sequence.frame+1).padStart(2,'0')+' · Brush':'Female · '+pose.start+' · '+style;
  const svg=avatarPlotSvg(drawing,context,{...plotOptions,title,preset:anatomy.preset,mode:view.mode,seed:anatomy.seed,metadata});
  await writeFile(resolve(destination,name),svg);
  archive[name]=[strToU8(svg),{mtime:archiveDate}];
  manifest.push({file:name,body:anatomy.preset,anatomySeed:anatomy.seed,styleSeed,pose,...(sequence?{sequence}:{}),
    style,paperMm:[context.W,context.H],strokeWidthMm:style==='Brush'?options.brushWidth:options.penWidth,
    camera:view,poseFrameBounds:mesh.poseFrameBounds,...drawing.stats});
  console.log(name+' · '+drawing.paths.length+' strokes · '+drawing.stats.pointCount+' points');
}

for(const preset of AVATAR_POSE_NAMES){
  const poseParameters={posePreset:preset,poseTarget:preset,poseMotion:'Manual',poseBlend:0,poseEasing:'Smooth',poseGround:true};
  for(const style of ['Brush','Contours'])await saveStudy({name:'avatar-female-'+slug(preset)+'-'+slug(style)+'.svg',poseParameters,style});
}

const frameCount=12;
const poseParameters={posePreset:'Relaxed',poseTarget:'Reach',poseMotion:'Timeline',poseCycle:'One-way',poseEasing:'Smooth',poseGround:true};
for(let frameIdx=0;frameIdx<frameCount;frameIdx++){
  await saveStudy({name:'avatar-female-relaxed-to-reach-'+String(frameIdx+1).padStart(2,'0')+'-brush.svg',
    poseParameters,clock:{frameIdx,frameCount},style:'Brush',sequence:{name:'relaxed-to-reach',frame:frameIdx,frameCount}});
}

const notes=`Avatar 3D pose studies

The 14 preset SVGs show Rest, Relaxed, Contrapposto, Reach, Hands on hips, Seated and Mid-step, each as a minimal Brush study and fine Contours study. The 12 numbered Brush SVGs form a one-way, Smooth Relaxed-to-Reach transition including both endpoints. Every animation frame uses the same camera, drawing scale and complete-transition framing envelope. Ground feet is enabled throughout; this shifts the full figure to the floor rather than planting individual feet.

All SVGs are vector centerlines in millimetres on A4 paper (210 × 297 mm). Print or import at actual size (100%). Brush appearance and geometric clearance use 2.5 mm; fine Contours use 0.35 mm stroke appearance and nominal 0.9 mm pitch. The physical tool supplies the actual ink width. The manifest records the effective pitch, path statistics, seeds and pose settings for each file.

The Female body uses anatomy seed 43, drawing seed 137 and Review mesh quality. The authored MakeHuman HM08 human mesh, shape targets, rig and skin weights are CC0 assets. Anatomy, posing, camera projection, visibility and drawing paths use the same Avatar 3D engines as the node. Joint interpolation is deterministic and can be sampled in any order. Poses are manually controlled; there is no collision avoidance or foot-plant solver.

These files are drawing studies, not machine jobs. No plotter connection or machine movement is involved. The SVG metadata and manifest preserve the settings used for each study.
`;
const manifestText=JSON.stringify(manifest,null,2)+'\n';
archive['README.txt']=[strToU8(notes),{mtime:archiveDate}];
archive['manifest.json']=[strToU8(manifestText),{mtime:archiveDate}];
await writeFile(resolve(destination,'README.txt'),notes);
await writeFile(resolve(destination,'manifest.json'),manifestText);
await writeFile(resolve(destination,'avatar-pose-studies.zip'),zipSync(archive,{level:6}));
console.log(resolve(destination,'avatar-pose-studies.zip'));
