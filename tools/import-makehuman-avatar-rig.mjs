/* Rebuild Avatar 3D's CC0 skinning data. Data assets only; no upstream code.
 * node tools/import-makehuman-avatar-rig.mjs <asset-cache> [--download]
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cache=resolve(process.argv.slice(2).find(value=>!value.startsWith('--'))||'/private/tmp/muusia-human-rig');
const download=process.argv.includes('--download');
const commit='650c5c53bd6989a8ac264f31fa1d11d4a0c7bd8a';
const sources=[{"name":"rig.game_engine.json","url":"https://raw.githubusercontent.com/makehumancommunity/mpfb2/650c5c53bd6989a8ac264f31fa1d11d4a0c7bd8a/src/mpfb/data/rigs/standard/rig.game_engine.json","sha256":"b324ddb4b707721c19630bfadb87c3e3b38eed3b6e4590bb3cead43ea918f799","bytes":40936},{"name":"weights.game_engine.json","url":"https://raw.githubusercontent.com/makehumancommunity/mpfb2/650c5c53bd6989a8ac264f31fa1d11d4a0c7bd8a/src/mpfb/data/rigs/standard/weights.game_engine.json","sha256":"9f4a773e74ce5ba08415b4f30070338e9f75bae5971b5075b10cd6b9caa58473","bytes":3026778}];
for(const file of sources){
  const path=resolve(cache,file.name);let bytes;
  try{bytes=await readFile(path);}catch(error){if(!download)throw new Error('Missing '+path+'; use --download to fetch the pinned public CC0 asset.',{cause:error});}
  if(!bytes&&download){const response=await fetch(file.url);if(!response.ok)throw new Error('Download failed: '+response.status+' '+file.url);bytes=Buffer.from(await response.arrayBuffer());}
  if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Rig asset hash mismatch: '+file.name);
  if(download){await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);}
}
const rawRig=JSON.parse(await readFile(resolve(cache,'rig.game_engine.json'),'utf8'));
const rawWeights=JSON.parse(await readFile(resolve(cache,'weights.game_engine.json'),'utf8'));
if(rawWeights.license!=='CC0')throw new Error('Unexpected skin weight licence');
const count=13380,influences=4;
const remap=name=>/^(index|middle|pinky|ring|thumb)_/.test(name)?'hand_'+name.at(-1):name.startsWith('ball_')?'foot_'+name.at(-1):name;
const keep=new Set(Object.keys(rawRig).filter(name=>remap(name)===name));
const ordered=[];
function order(name){if(ordered.includes(name))return;const parent=rawRig[name].parent;if(parent&&keep.has(parent))order(parent);ordered.push(name);}
for(const name of [...keep].sort())order(name);
const endpoint=data=>({strategy:data.strategy,...(data.cube_name?{cube_name:data.cube_name}:{}),...(data.vertex_indices?{vertex_indices:data.vertex_indices}:{}),fallback:[data.default_position[0]*10,data.default_position[2]*10,-data.default_position[1]*10].map(value=>Math.round(value*1e7)/1e7)});
const bones=ordered.map(name=>({name,parent:ordered.indexOf(rawRig[name].parent),parentName:rawRig[name].parent||null,head:endpoint(rawRig[name].head),tail:endpoint(rawRig[name].tail),roll:rawRig[name].roll}));
if(bones.some((bone,index)=>bone.parent>=index))throw new Error('Bone hierarchy is not parent-first');
const index=new Map(ordered.map((name,id)=>[name,id]));
const perVertex=Array.from({length:count},()=>new Map());
for(const [bone,rows] of Object.entries(rawWeights.weights)){
  const id=index.get(remap(bone));if(id===undefined)continue;
  for(const [vertex,weight] of rows)if(vertex<count&&Number.isInteger(vertex)&&vertex>=0&&Number.isFinite(weight)&&weight>0)perVertex[vertex].set(id,(perVertex[vertex].get(id)||0)+weight);
}
const ids=new Uint8Array(count*influences),quantized=new Uint16Array(count*influences);
let maxDiscardedWeight=0,totalDiscardedWeight=0,maxInfluenceCount=0;
for(let vertex=0;vertex<count;vertex++){
  const all=[...perVertex[vertex]].sort((a,b)=>b[1]-a[1]||a[0]-b[0]),sum=all.reduce((n,row)=>n+row[1],0),selected=all.slice(0,influences),selectedSum=selected.reduce((n,row)=>n+row[1],0);
  if(!(selectedSum>0))throw new Error('Unweighted source body vertex '+vertex);
  const discarded=(sum-selectedSum)/sum;maxDiscardedWeight=Math.max(maxDiscardedWeight,discarded);totalDiscardedWeight+=discarded;maxInfluenceCount=Math.max(maxInfluenceCount,all.length);
  const values=selected.map(([bone,weight])=>({bone,value:weight/selectedSum*65535}));
  const integer=values.map(item=>Math.floor(item.value));let remaining=65535-integer.reduce((a,b)=>a+b,0);
  const byFraction=values.map((item,id)=>({id,fraction:item.value-integer[id]})).sort((a,b)=>b.fraction-a.fraction||a.id-b.id);
  for(let at=0;remaining>0;at++,remaining--)integer[byFraction[at%byFraction.length].id]++;
  for(let slot=0;slot<selected.length;slot++){ids[vertex*influences+slot]=values[slot].bone;quantized[vertex*influences+slot]=integer[slot];}
}
const bytes=Buffer.alloc(12+ids.length+quantized.length*2);bytes.write('MHRI',0,'ascii');bytes[4]=1;bytes[5]=bones.length;bytes[6]=influences;bytes.writeUInt32LE(count,8);
let offset=12;
for(let slot=0;slot<influences;slot++)for(let vertex=0;vertex<count;vertex++)bytes[offset++]=ids[vertex*influences+slot];
for(let slot=0;slot<influences;slot++)for(let vertex=0;vertex<count;vertex++){bytes.writeUInt16LE(quantized[vertex*influences+slot],offset);offset+=2;}
const compressed=gzipSync(bytes,{level:9});
const source={name:'MakeHuman HM08 game_engine skinning rig',project:'MakeHuman Community / MPFB',commit,license:'CC0-1.0',url:'https://github.com/makehumancommunity/mpfb2',licenseUrl:'https://github.com/makehumancommunity/mpfb2/blob/'+commit+'/LICENSE.md',files:sources,changes:['Retained 21 body bones; finger weights merged into hands and ball/toe weights into feet.','Retained the four strongest merged influences per source skin vertex; renormalized and quantized to sum 65535.','Endpoints resolve MakeHuman joint helpers/vertex means after morphs; stored fallbacks are converted from Blender units to original MakeHuman coordinates.'],coverage:count,maxSourceInfluences:maxInfluenceCount,maxDiscardedWeight,meanDiscardedWeight:totalDiscardedWeight/count,weightQuantization:65535};
const decoder=`
const bytes=gunzipSync(Uint8Array.from(atob(payload),value=>value.charCodeAt(0)));
const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
if(String.fromCharCode(...bytes.subarray(0,4))!=='MHRI'||bytes[4]!==1)throw new Error('Unsupported avatar rig data');
const vertexCount=view.getUint32(8,true),influences=bytes[6],boneCount=bytes[5];
if(vertexCount!==13380||influences!==4||boneCount!==bones.length||bytes.length!==12+vertexCount*influences*3)throw new Error('Invalid avatar rig counts');
const boneIndices=new Uint8Array(vertexCount*influences),weights=new Float32Array(vertexCount*influences);let offset=12;
for(let slot=0;slot<influences;slot++)for(let vertex=0;vertex<vertexCount;vertex++){const bone=bytes[offset++];if(bone>=boneCount)throw new Error('Invalid avatar bone index');boneIndices[vertex*influences+slot]=bone;}
for(let slot=0;slot<influences;slot++)for(let vertex=0;vertex<vertexCount;vertex++){weights[vertex*influences+slot]=view.getUint16(offset,true)/65535;offset+=2;}
export default {bones,vertexCount,influences,boneIndices,weights,source};
`;
const module='/* Generated MakeHuman CC0 graphical rig data. Rebuild: tools/import-makehuman-avatar-rig.mjs. See avatar-makehuman-rig.LICENSE.txt. */\nimport {gunzipSync} from "fflate";\nconst source='+JSON.stringify(source)+';\nconst bones='+JSON.stringify(bones)+';\nconst payload='+JSON.stringify(compressed.toString('base64'))+';\n'+decoder;
await mkdir(resolve(repo,'src/assets'),{recursive:true});await writeFile(resolve(repo,'src/assets/avatar-makehuman-rig.js'),module);
console.log(JSON.stringify({vertices:count,bones:bones.length,influences,maxDiscardedWeight,meanDiscardedWeight:totalDiscardedWeight/count,packedBytes:compressed.length,moduleBytes:Buffer.byteLength(module)}));
