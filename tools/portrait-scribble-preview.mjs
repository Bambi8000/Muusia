/* Local review sheet using the real built-in node and intake pipeline.
   node tools/portrait-scribble-preview.mjs [output-dir] [vite-origin]
   Serve output-dir with a local static server. No external services. */
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve(process.argv[2]||'/tmp/muusia-portrait-scribble');
const origin=process.argv[3]||'http://127.0.0.1:5186';
fs.mkdirSync(dir,{recursive:true});
fs.copyFileSync(new URL('../fixtures/portrait-photo.jpg',import.meta.url),path.join(dir,'portrait-photo.jpg'));
const html=String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portrait — One wandering line</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eeeae3;color:#252a29;font:15px/1.5 system-ui,sans-serif}header,main,footer{max-width:1600px;margin:auto;padding:30px 4vw}header{display:grid;grid-template-columns:1.25fr 1fr;gap:6vw;border-bottom:1px solid #a5a8a1}small,.stats{font:12px/1.6 monospace}h1{font:clamp(55px,7.8vw,120px)/.93 Georgia,serif;letter-spacing:-.045em;margin:24px 0}h2{font:27px/1.15 Georgia,serif;margin:0}.intro{align-self:end}p{margin:12px 0}a{color:inherit;text-underline-offset:4px}button,.upload{font:inherit;color:inherit;border:1px solid #878f88;background:transparent;padding:8px 14px;cursor:pointer;display:inline-block}.upload input{display:none}main{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}article svg{display:block;width:100%;height:auto;background:white}.label{min-height:110px}article button{font-size:12px;padding:6px 9px}figure{margin:0}.source{display:flex;gap:14px;align-items:center}.source img{width:75px;height:90px;object-fit:cover;object-position:top}.source p{font-size:12px}footer{border-top:1px solid #a5a8a1}#status{font:12px monospace}#error{color:#a12b24}@media(max-width:850px){header,main{grid-template-columns:1fr}h1{font-size:64px}.label{min-height:85px}}</style>
<header><div><small>MUUSIA / PORTRAIT STUDY</small><h1>One<br>wandering<br>line.</h1></div><div class="intro"><p>A portrait made from a single thread of ink. Loops settle into shadows and loosen across the light.</p><p>Three settings of the existing Portrait node’s new <b>Scribble</b> mode. A plain background and a close crop give the face more room.</p><p><label class="upload">Try your photo<input id="photo" type="file" accept="image/png,image/jpeg"></label> &nbsp; <a href="__ORIGIN__/" target="_blank">Open local Muusia ↗</a></p><div class="source"><img id="source" src="portrait-photo.jpg" alt="Source photo"><p>Source image · processed locally.<br>Download a patch below, then use Load in local Muusia.</p></div><p id="status">Drawing…</p><p id="error"></p></div></header><main id="studies"></main><footer><p>Local work in progress on top of v2.111. These vectors come from the actual Portrait node. SVGs here are review drawings; the app’s SVG / G-code exporters are checked separately. The plain output is one pen-down stroke. A dashed Style or a cutting modifier can split it. No physical plot has been run.</p></footer>
<script type="module">
import N from '__ORIGIN__/src/defs/nodes/portrait.js';
import {intakeImage} from '__ORIGIN__/src/analyze.js';
const presets=[
 {id:'fine',title:'01 / Fine thread',desc:'Small loops pick out the features; dark areas build slowly.',params:{scribbleSize:2.4,scribbleWander:.25,scribbleDensity:1.1,scribbleFeatures:.7,detail:.8,penW:.3,gamma:1.05}},
 {id:'loose',title:'02 / Loose gesture',desc:'Broader loops and longer connections let the line wander.',params:{scribbleSize:6.5,scribbleWander:.75,scribbleDensity:.8,scribbleFeatures:.75,penW:.3,gamma:1.1}},
 {id:'dense',title:'03 / Ink in the shadows',desc:'More passes over the darks, with a finer gesture around edges.',params:{scribbleSize:3.8,scribbleWander:.45,scribbleDensity:2,scribbleFeatures:.65,detail:.85,penW:.3,gamma:.95}},
];
const defs=Object.fromEntries(N.params.map(p=>[p.key,p.def])),canvas={W:297,H:420};
function save(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function draw(src,name){
 document.getElementById('error').textContent='';document.getElementById('status').textContent='Drawing…';
 const data=await intakeImage(src,name);document.getElementById('source').src=data.src;
 const main=document.getElementById('studies');main.replaceChildren();
 let total=0;
 for(const preset of presets){
 const params={...defs,mode:'Scribble',...preset.params,file:name};
 const node={id:9001,type:'portrait',x:30,y:20,params,data};
 const start=performance.now(),result=N.compute([],params,canvas,node);total+=performance.now()-start;
 const pts=result.paths[0]?.pts||[];
 let length=0;for(let i=1;i<pts.length;i++)length+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" viewBox="0 0 297 420"><polyline fill="none" stroke="#252a29" stroke-width="'+params.penW+'" stroke-linecap="round" stroke-linejoin="round" points="'+pts.map(p=>p.map(x=>x.toFixed(3)).join(',')).join(' ')+'"/></svg>';
 const article=document.createElement('article');article.id=preset.id;
 article.innerHTML='<div class="label"><h2>'+preset.title+'</h2><p>'+preset.desc+'</p></div>'+svg+'<p class="stats">'+result.paths.length+' continuous stroke · '+(length/1000).toFixed(1)+' m<br>'+pts.length.toLocaleString()+' points · A3 portrait</p>';
 const patch={app:'muusia',v:1,name:'Portrait - '+preset.id,canvas,root:{nodes:[node],edges:[]}};
 const pb=document.createElement('button');pb.textContent='Editable patch ↓';pb.onclick=()=>save('portrait-'+preset.id+'.muusia.json',JSON.stringify(patch),'application/json');article.append(pb,' ');
 const sb=document.createElement('button');sb.textContent='SVG drawing ↓';sb.onclick=()=>save('portrait-'+preset.id+'.svg',svg,'image/svg+xml');article.append(sb);main.append(article);
 }
 document.getElementById('status').textContent='Three drawings · '+Math.round(total)+' ms · no face analysis needed';
}
async function fromFile(file){const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});await draw(src,file.name||'portrait-photo.jpg');}
document.getElementById('photo').onchange=e=>fromFile(e.target.files[0]).catch(e=>document.getElementById('error').textContent=e.message);
try{const b=await(await fetch('portrait-photo.jpg')).blob();await fromFile(new File([b],'portrait-photo.jpg',{type:'image/jpeg'}));}catch(e){document.getElementById('error').textContent=e.message;}
</script></html>`;
fs.writeFileSync(path.join(dir,'index.html'),html.replaceAll('__ORIGIN__',origin));
console.log('Review sheet: '+dir+'/index.html');
