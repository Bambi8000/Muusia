import {build} from 'vite';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=process.argv[2]||resolve(repo,'output/avatar-review.html');
const options={configFile:false,root:repo,logLevel:'error',build:{write:false,minify:true,target:'es2022'}};
const bundle=async(entry,plugins=[])=>{
  const result=await build({...options,plugins,build:{...options.build,lib:{entry,name:'AvatarReview',formats:['iife']}}});
  const chunks=(Array.isArray(result)?result:[result]).flatMap(v=>v.output).filter(v=>v.type==='chunk');
  if(chunks.length!==1)throw new Error('Expected one self-contained review script');
  return chunks[0].code;
};
const plotReview=process.argv.includes('--plot');
const runReview=process.argv.includes('--run');
const walkReview=process.argv.includes('--walk');
const poseReview=runReview||walkReview||process.argv.includes('--poses');
const review=poseReview?'avatar-pose-review':plotReview?'avatar-plot-review':'avatar-review';
let code=await bundle(resolve(repo,'tools/'+review+'-ui.js'));
// Keep authored anatomy and its controls together in the inline preview. This
// wraps our own bundled script and data; it performs no network requests.
if(Buffer.byteLength(code)>700000){
  const packed=gzipSync(Buffer.from(code),{level:9}).toString('base64');
  const temporary=await mkdtemp(join(tmpdir(),'muusia-avatar-review-'));
  const entry=join(temporary,'bootstrap.js');
  const source=`import {gunzipSync,strFromU8} from ${JSON.stringify(resolve(repo,'node_modules/fflate/esm/browser.js'))};\nconst packed=${JSON.stringify(packed)};\nconst bytes=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));\n(0,eval)(strFromU8(gunzipSync(bytes)));`;
  try{await writeFile(entry,source);code=await bundle(entry);}finally{await rm(temporary,{recursive:true,force:true});}
}
let template=await readFile(resolve(repo,'tools/'+review+'-template.html'),'utf8');
if(runReview||walkReview)template=template.replace('<div id="avatar-pose-review">','<div id="avatar-pose-review" data-initial-motion="'+(runReview?'run':'walk')+'">');
const fragment=template.replace('<!-- AVATAR_REVIEW_SCRIPT -->',()=>'<script>\n'+code.replace(/<\/script/gi,'<\\/script')+'\n</script>');
if(Buffer.byteLength(fragment)>1_000_000)throw new Error('Review exceeds inline size limit: '+Buffer.byteLength(fragment));
await mkdir(dirname(destination),{recursive:true});await writeFile(destination,fragment);console.log(destination+' ('+Buffer.byteLength(fragment)+' bytes)');
