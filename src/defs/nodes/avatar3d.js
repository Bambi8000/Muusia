import {Pin,applyStyle} from '../helpers.js';
import {AVATAR_DEFAULTS,AVATAR_CONTROLS,buildAvatarMesh} from '../../avatar-geometry.js';
import {avatarLineDrawing,buildAvatarView} from '../../avatar-render.js';
import {AVATAR_PLOT_CONTROLS,normalizeAvatarPlotOptions,plotAvatar} from '../../avatar-plot.js';
import {AVATAR_POSE_NAMES,AVATAR_POSE_OFFSET_CONTROLS,composeAvatarPose} from '../../avatar-pose-control.js';
import {AVATAR_GAIT_NAMES} from '../../avatar-locomotion.js';

const AREAS=['Body','Head & neck','Torso','Chest','Arms & hands','Legs & feet'];
const cache=new Map();
const walking=p=>p.poseMode==='Walk cycle';
const moving=p=>p.poseMode==='Stand / walk / run';
const posing=p=>!walking(p)&&!moving(p);
const forcedCut=p=>p.motion&&p.motion!=='Off'&&(p.animation==='Rotating bust'||p.animation==='Feet slice');
const effectiveCut=p=>forcedCut(p)?(p.animation==='Rotating bust'?'Bust':'Feet'):(p.cutMode||'Full body');
const manualCut=p=>effectiveCut(p)!=='Full body'&&!(forcedCut(p)&&p.animation==='Feet slice');
const finite=(value,fallback,min,max)=>Math.max(min,Math.min(max,Number.isFinite(+value)?+value:fallback));
function anatomy(p){
  const body={...AVATAR_DEFAULTS,preset:p.preset==='Female'?'Female':'Male',seed:finite(p.seed,17,0,999999)|0};
  for(const c of AVATAR_CONTROLS)body[c.key]=finite(p[c.key],c.def,c.min,c.max);
  const quality=p.quality==='Review'?'review':'draft';
  const key=quality+JSON.stringify(body);
  if(!cache.has(key)){
    cache.set(key,buildAvatarMesh(body,{quality}));
    while(cache.size>6)cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}
function viewOptions(p,ctx){
  const frames=Math.max(1,Math.floor(+ctx.frameCount||1));
  const index=Math.max(0,Math.min(frames-1,Math.floor(+ctx.frameIdx||0)));
  const phase=p.motion==='Timeline'?index/frames:finite(p.phase,0,0,1);
  const fixed={Front:0,Side:90,Back:180,'Three-quarter':30};
  let yaw=p.view==='Manual'?finite(p.yaw,0,-36000,36000):(fixed[p.view]??0);
  let mode=['Bust','Feet','Band'].includes(p.cutMode)?p.cutMode:'Full body';
  let cut=p.cutPosition==='Manual'?finite(p.cutHeight,74,0,100)/100:undefined;
  if(p.animation==='Turntable'&&p.motion!=='Off')yaw+=phase*360;
  if(p.animation==='Rotating bust'&&p.motion!=='Off'){mode='Bust';yaw+=phase*360;}
  if(p.animation==='Feet slice'&&p.motion!=='Off'){mode='Feet';cut=.03+phase*.21;}
  return {yaw,pitch:finite(p.pitch,0,-85,85),roll:finite(p.roll,0,-180,180),mode,cut,band:finite(p.bandWidth,15,1,100)/100,frame:p.framing==='Selected region'?'selection':'body',rotationEnvelope:(+p.pitch||+p.roll)?'all':'yaw',wireframe:p.inspection==='Mesh edges'};
}

export default {
  key:'avatar3d',name:'Avatar 3D',cat:'gen',group:'creatures',
  desc:'Adult male and female anatomical studies based on the CC0 MakeHuman HM08 human mesh and authored shape targets. Body area reveals local proportion controls; other areas keep their saved values. Seed and Variation produce repeatable anatomy. Front, Side and Back use the same real mesh. Cut Full body, Bust, Feet or Band clips the surface in 3D before drawing. Anatomical cut position follows the body landmarks; Manual exposes height from soles (0%) to crown (100%). Full body framing keeps scale fixed while rotating or cutting; Selected region enlarges a cut using a fixed region frame. Timeline drives a turntable, rotating bust or feet slice through ANIMATE; Manual motion exposes Phase. Drawing style Brush makes a few long open strokes with gaps based on Brush width. Contours follows the surface with real curves; Hatching uses light direction and selective crossing lines. Contours + hatching combines them. Pen width defaults to 0.35 mm; Line spacing is at least twice the pen width. Drawing seed varies the line treatment without changing anatomy. Drawing size is the longest framed extent, fitted inside Margin; Selected region enlarges a bust or feet study. Separate pens exposes outline, contour and hatch layers. Brush and pen widths control physical clearance and SVG/preview line widths; the drawing paths remain tool centerlines. Inspection retains the original Silhouette and Mesh edges views. Start pose A and End pose B supply natural pose presets. Adjust pose selects independent joint offsets for either endpoint; Pose body part reveals left/right arms, legs, head and torso controls. Pose blend interpolates their joint rotations. Pose motion Timeline drives a one-way or ping-pong transition with fixed framing; camera motion and slicing remain independent. Ground feet shifts the complete pose to the floor. The Full body mesh output carries the complete posed body in its unchanged anatomy coordinate frame; camera, cuts and drawing style affect the drawing only. Connect it to Mesh Slice for true flat cross sections. Mesh quality Draft is faster, Review refines the surface. The source provides authored face, hand and foot anatomy; the authored rig bends the skin through independent body-part controls; fingers follow their hands. Posing Walk cycle produces a periodic in-place gait. Walk speed sets 1–6 complete cycles per timeline loop, so the loop boundary stays continuous; increase ANIMATE frame count for smoother high-speed playback. Stride length and Arm swing adjust the legs and arms independently. Walk motion Manual exposes Walk phase; Timeline uses ANIMATE. Pose body part retains the Start A joint offsets as walk adjustments. Ground walking feet applies floor grounding. The entire cycle shares one framing envelope, including anatomical bust and feet cuts. Stand / walk / run adds a running gait with stronger knee recovery, bent elbows, forward lean and a flight phase. Start movement and End movement blend smoothly through Standing, Walking and Running while sharing one cycle phase. Movement transition Manual exposes Movement blend; Timeline uses one-way or ping-pong transitions. Cycle motion and Cycle phase control the gait clock separately. Cycle speed uses whole cycles per timeline loop. Stride length, Arm swing and Start A joint offsets remain independent. Ground movement retains running flight above the floor. Framing stays fixed across both the full cycle and movement blend. Manual poses are not collision-constrained.',
  ins:[Pin('style','Style')],
  outs:[Pin('paths','Drawing'),Pin('paths','Silhouette'),Pin('mesh','Full body mesh')],
  params:[
    {key:'preset',label:'Body preset',type:'select',options:['Male','Female'],def:'Male'},
    {key:'area',label:'Body area',type:'select',options:AREAS,def:'Body'},
    ...AVATAR_CONTROLS.filter(c=>c.key!=='seed').map(c=>({key:c.key,label:c.label,type:'slider',min:c.min,max:c.max,step:c.step||1,def:c.def,showIf:p=>p.area===c.group})),
    {key:'seed',label:'Anatomy seed',type:'seed',def:17},
    {key:'quality',label:'Mesh quality',type:'select',options:['Draft','Review'],def:'Draft'},
    {key:'poseMode',label:'Posing',type:'select',options:['Pose transition','Walk cycle','Stand / walk / run'],def:'Pose transition'},
    {key:'walkMotion',label:'Walk motion',type:'select',options:['Manual','Timeline'],def:'Timeline',showIf:walking},
    {key:'walkPhase',label:'Walk phase',type:'slider',min:0,max:1,step:.01,def:0,showIf:p=>walking(p)&&p.walkMotion!=='Timeline'},
    {key:'walkSpeed',label:'Walk speed ×',type:'slider',min:1,max:6,step:1,def:1,showIf:walking},
    {key:'walkStride',label:'Stride length ×',type:'slider',min:0,max:1.5,step:.05,def:1,showIf:walking},
    {key:'walkArmSwing',label:'Arm swing ×',type:'slider',min:0,max:1.5,step:.05,def:1,showIf:walking},
    {key:'walkGround',label:'Ground walking feet',type:'check',def:true,showIf:walking},
    {key:'gaitFrom',label:'Start movement',type:'select',options:AVATAR_GAIT_NAMES,def:'Standing',showIf:moving},
    {key:'gaitTo',label:'End movement',type:'select',options:AVATAR_GAIT_NAMES,def:'Running',showIf:moving},
    {key:'gaitTransition',label:'Movement transition',type:'select',options:['Manual','Timeline'],def:'Manual',showIf:moving},
    {key:'gaitBlend',label:'Movement blend A → B',type:'slider',min:0,max:1,step:.01,def:1,showIf:p=>moving(p)&&p.gaitTransition!=='Timeline'},
    {key:'gaitCycle',label:'Transition playback',type:'select',options:['One-way','Ping-pong'],def:'Ping-pong',showIf:p=>moving(p)&&p.gaitTransition==='Timeline'},
    {key:'gaitMotion',label:'Cycle motion',type:'select',options:['Manual','Timeline'],def:'Timeline',showIf:moving},
    {key:'gaitPhase',label:'Cycle phase',type:'slider',min:0,max:1,step:.01,def:0,showIf:p=>moving(p)&&p.gaitMotion!=='Timeline'},
    {key:'gaitSpeed',label:'Cycle speed ×',type:'slider',min:1,max:6,step:1,def:1,showIf:moving},
    {key:'gaitStride',label:'Stride length ×',type:'slider',min:0,max:1.5,step:.05,def:1,showIf:moving},
    {key:'gaitArmSwing',label:'Arm swing ×',type:'slider',min:0,max:1.5,step:.05,def:1,showIf:moving},
    {key:'gaitGround',label:'Ground movement',type:'check',def:true,showIf:moving},
    {key:'posePreset',label:'Start pose A',type:'select',options:AVATAR_POSE_NAMES,def:'Rest',showIf:posing},
    {key:'poseTarget',label:'End pose B',type:'select',options:AVATAR_POSE_NAMES,def:'Rest',showIf:posing},
    {key:'poseMotion',label:'Pose motion',type:'select',options:['Manual','Timeline'],def:'Manual',showIf:posing},
    {key:'poseBlend',label:'Pose blend A → B',type:'slider',min:0,max:1,step:.01,def:0,showIf:p=>posing(p)&&p.poseMotion!=='Timeline'},
    {key:'poseCycle',label:'Pose playback',type:'select',options:['One-way','Ping-pong'],def:'Ping-pong',showIf:p=>posing(p)&&p.poseMotion==='Timeline'},
    {key:'poseEasing',label:'Pose easing',type:'select',options:['Smooth','Linear'],def:'Smooth',showIf:posing},
    {key:'poseGround',label:'Ground feet',type:'check',def:false,showIf:posing},
    {key:'poseEdit',label:'Adjust pose',type:'select',options:['Start A','End B'],def:'Start A',showIf:posing},
    {key:'poseArea',label:'Pose body part',type:'select',options:[...new Set(AVATAR_POSE_OFFSET_CONTROLS.map(c=>c.group))],def:'Torso'},
    ...['A','B'].flatMap(side=>AVATAR_POSE_OFFSET_CONTROLS.map(c=>({key:'pose'+side+'_'+c.key,label:c.label,type:'slider',min:c.min,max:c.max,step:c.step||1,def:0,showIf:p=>(posing(p)?p.poseEdit===(side==='A'?'Start A':'End B'):side==='A')&&p.poseArea===c.group}))),
    {key:'view',label:'View',type:'select',options:['Front','Side','Back','Three-quarter','Manual'],def:'Three-quarter'},
    {key:'yaw',label:'Turn °',type:'slider',min:-180,max:180,step:1,def:0,showIf:p=>p.view==='Manual'},
    {key:'pitch',label:'View elevation °',type:'slider',min:-85,max:85,step:1,def:0},
    {key:'roll',label:'View roll °',type:'slider',min:-180,max:180,step:1,def:0},
    {key:'cutMode',label:'Visible body',type:'select',options:['Full body','Bust','Feet','Band'],def:'Full body',showIf:p=>!forcedCut(p)},
    {key:'cutPosition',label:'Cut position',type:'select',options:['Anatomical','Manual'],def:'Anatomical',showIf:manualCut},
    {key:'cutHeight',label:'Cut height %',type:'slider',min:0,max:100,step:1,def:74,showIf:p=>manualCut(p)&&p.cutPosition==='Manual'},
    {key:'bandWidth',label:'Band thickness %',type:'slider',min:1,max:100,step:1,def:15,showIf:p=>effectiveCut(p)==='Band'},
    {key:'framing',label:'Framing',type:'select',options:['Full body','Selected region'],def:'Full body'},
    {key:'plotStyle',label:'Drawing style',type:'select',options:['Brush','Contours','Hatching','Contours + hatching','Inspection'],def:'Brush'},
    {key:'inspection',label:'Inspection',type:'select',options:['Silhouette','Mesh edges'],def:'Silhouette',showIf:p=>!p.plotStyle||p.plotStyle==='Inspection'},
    {key:'splitPens',label:'Separate pens',type:'check',def:false,showIf:p=>!!p.plotStyle&&p.plotStyle!=='Inspection'},
    ...AVATAR_PLOT_CONTROLS.filter(c=>c.key!=='style').map(({modes,...c})=>({...c,key:c.key==='pitch'?'linePitch':c.key,showIf:p=>{
      const style=p.plotStyle||'Inspection';if(style==='Inspection'||modes&&!modes.includes(style))return false;
      if(['outlinePen','detailPen','shadePen'].includes(c.key)){if(!p.splitPens)return false;if(c.key==='shadePen'&&!style.includes('hatching')&&style!=='Hatching')return false;if(c.key==='detailPen'&&style==='Hatching')return false;}
      if(c.key==='outline'&&style==='Brush')return false;return true;
    }})),
    {key:'motion',label:'Motion',type:'select',options:['Off','Manual','Timeline'],def:'Off'},
    {key:'animation',label:'Animation',type:'select',options:['Turntable','Rotating bust','Feet slice'],def:'Rotating bust',showIf:p=>p.motion!=='Off'},
    {key:'phase',label:'Phase',type:'slider',min:0,max:1,step:.01,def:0,showIf:p=>p.motion==='Manual'},
    {key:'size',label:'Drawing size mm',type:'slider',min:20,max:1000,step:1,def:240},
    {key:'margin',label:'Margin mm',type:'slider',min:0,max:60,step:1,def:10},
    {key:'layer',label:'Pen',type:'pen',def:0},
  ],
  compute(ins,p,ctx){
    const mesh=composeAvatarPose(anatomy(p),p,ctx),options=viewOptions(p,ctx);
    const context={W:ctx.W||210,H:ctx.H||297,size:finite(p.size,240,20,1000),margin:finite(p.margin,10,0,200),pen:Math.round(finite(p.layer,0,0,11)),layer:Math.round(finite(p.layer,0,0,11))};
    const styled=!!p.plotStyle&&p.plotStyle!=='Inspection';
    const view=styled?buildAvatarView(mesh,options):null;
    const extent=view?Math.max(view.referenceBounds.max[0]-view.referenceBounds.min[0],view.referenceBounds.max[1]-view.referenceBounds.min[1],1e-8):1;
    const silhouette=avatarLineDrawing(mesh,{...options,wireframe:false,...(view?{view}:{})},{...context,size:context.size/extent});
    let drawing;
    if(!p.plotStyle||p.plotStyle==='Inspection')drawing=options.wireframe?avatarLineDrawing(mesh,options,context):silhouette;
    else{
      const values=Object.fromEntries(AVATAR_PLOT_CONTROLS.filter(c=>c.key!=='style'&&p[c.key==='pitch'?'linePitch':c.key]!==undefined).map(c=>[c.key,p[c.key==='pitch'?'linePitch':c.key]]));
      if(!p.splitPens)for(const key of ['outlinePen','detailPen','shadePen'])values[key]=context.pen;
      const settings=normalizeAvatarPlotOptions({...values,style:p.plotStyle});
      const result=plotAvatar(mesh,options,settings,context),strokeWidth=settings.style==='Brush'?settings.brushWidth:settings.penWidth;
      drawing={...result,strokeWidth};
    }
    const applied=applyStyle(drawing,ins?.[0]);
    const output=styled?{...applied,paths:applied.paths.map(path=>({...path,strokeWidth:drawing.strokeWidth}))}:applied;
    return [output,applyStyle(silhouette,ins?.[0]),mesh];
  },
};
