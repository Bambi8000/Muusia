import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ascii from '../src/defs/nodes/receiptascii.js';
import merge from '../src/defs/nodes/merge.js';
import { asciiReceipt, asciiHeight, asciiPages, encodeAsciiReceipt, RECEIPT_FONTS, ASCII_PAGE_ROWS } from '../src/receipt-ascii.js';
import { sendReceipt } from '../src/thermal-print.js';
const patch=JSON.parse(readFileSync('fixtures/receipt-ascii-merge.muusia.json','utf8'));
const ctx=patch.canvas, values={};
for(const n of patch.root.nodes.filter(n=>n.type==='receiptascii')) values[n.id]=ascii.compute([],n.params,ctx);
const node=patch.root.nodes.find(n=>n.type==='merge');
const ins=Array.from({length:node.params.count},(_,port)=>values[patch.root.edges.find(e=>e.to===node.id&&e.toPort===port).from]);
const before=JSON.stringify(ins), output=merge.compute(ins,node.params);
assert.equal(JSON.stringify(ins),before);
assert.equal(output.paths.length,0);
assert.equal(output.receiptText.layers.length,2);
assert.deepEqual(output.receiptText.layers.map(l=>l.size),[1,2]);
const receipt=asciiReceipt(output.receiptText), bytes=Buffer.from(encodeAsciiReceipt(receipt));
assert.equal(receipt.height,Math.max(...ins.map(i=>asciiHeight(i.receiptText))),'overlap length is max, never sum');
assert.deepEqual(bytes,execFileSync('python3',['-c',"import json,sys;sys.path.insert(0,'print-server');import ascii_receipt;sys.stdout.buffer.write(ascii_receipt.escpos_text(json.load(sys.stdin)))"],{input:JSON.stringify(receipt)}));
const pages=asciiPages(receipt);assert(pages.length>1);assert.equal(pages[0][0],0);assert.equal(pages.at(-1)[1],receipt.height);
for(let i=0;i<pages.length;i++){
 const [a,b]=pages[i];assert(b>a&&b-a<=ASCII_PAGE_ROWS);if(i)assert.equal(a,pages[i-1][1]);
 for(const layer of receipt.layers) for(let r=0;r<layer.lines.length;r++) if(layer.lines[r].trim()){
  const top=r*layer.lineSpacing,bottom=top+RECEIPT_FONTS[layer.font].height*layer.size;
  assert(!(top<a&&bottom>a));assert(!(top<b&&bottom>b));
 }
}
// Decode the actual positioned text program. Every source row appears once at
// its original y, font and size, including rows crossing different grid periods.
const actual=[];let i=37,pageStart=0,pageHeight=0,area=null,font=null,size=0,x=null,baseline=null;
while(i<bytes.length){
 const a=bytes[i],b=bytes[i+1];
 if(a===27&&b===76){i+=2;pageHeight=0;}
 else if(a===27&&b===84)i+=3;
 else if(a===27&&b===77){font=bytes[i+2]?'B':'A';i+=3;}
 else if(a===29&&b===33){size=(bytes[i+2]&7)+1;i+=3;}
 else if(a===27&&b===87){const n=k=>bytes[i+k]+256*bytes[i+k+1];area={x:n(2),y:n(4),w:n(6),h:n(8)};assert.equal(pageHeight,0,'one stable print area per page');pageHeight=area.h;x=baseline=null;i+=10;}
 else if(a===27&&b===36){x=bytes[i+2]+256*bytes[i+3];i+=4;}
 else if(a===29&&b===36){baseline=bytes[i+2]+256*bytes[i+3];i+=4;}
 else if(a===12){pageStart+=pageHeight;i++;}
 else if(a===29&&b===86){i+=4;}
 else if(a===27&&b===64){i+=2;}
 else {let text='';while(i<bytes.length&&bytes[i]>=32&&bytes[i]<=126)text+=String.fromCharCode(bytes[i++]);assert(text);assert.notEqual(x,null,'explicit horizontal position');assert.notEqual(baseline,null,'explicit font-scaled baseline');const top=baseline-({A:21,B:16}[font]*size);assert(top>=0,'no top clipping');assert(top+RECEIPT_FONTS[font].height*size<=area.h,'no bottom clipping');assert(x+text.length*RECEIPT_FONTS[font].width*size<=area.w,'no wrapping');actual.push(JSON.stringify({font,size,x,y:pageStart+top,text}));x=baseline=null;}
}
const expected=receipt.layers.flatMap(l=>l.lines.flatMap((text,r)=>text.trim()?[JSON.stringify({font:l.font,size:l.size,x:l.left,y:r*l.lineSpacing,text})]:[]));
assert.deepEqual(actual.sort(),expected.sort());
assert.equal(pageStart,receipt.height);
const nested=merge.compute([output,ins[0]],{count:2,penPer:false});assert.equal(nested.receiptText.layers.length,3);
assert.strictEqual(merge.compute([ins[0],{paths:[]}],node.params).receiptText,ins[0].receiptText);
const path={pts:[[0,0],[1,1]],closed:false,layer:4};
assert.deepEqual(merge.compute([{paths:[path]},{}],node.params),{paths:[path]});
assert.equal(merge.compute([{paths:[]},{paths:[path]}],{count:2,penPer:true}).paths[0].layer,1);
assert.deepEqual(merge.compute([{paths:[],thermalText:[{text:'a'}]},{paths:[],thermalText:[{text:'b'}]}],node.params).thermalText,[{text:'a'},{text:'b'}]);
for(const invalid of [{layers:[]},{layers:Array(33).fill(receipt.layers[0])},{layers:[{layers:receipt.layers}]}])assert.throws(()=>asciiReceipt(invalid));
const originalFetch=globalThis.fetch;
try {
 for(const version of [undefined,1,2]){
  const requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>url.endsWith('/health')?{formats:['text'],asciiSizeVersion:1,asciiOverlayVersion:version}:options?.method==='POST'?{id:'test'}:{id:'test',status:'done'}};};
  if(version===2){await sendReceipt('http://localhost:8631',receipt);assert.deepEqual(JSON.parse(requests[1].options.body).layers,receipt.layers);}
  else{await assert.rejects(sendReceipt('http://localhost:8631',receipt),/Update.*unclipped overlapping ASCII/);assert.equal(requests.length,1,'clipping server must receive no job');}
 }
} finally {globalThis.fetch=originalFetch;}
writeFileSync('/tmp/muusia-ascii-merge.json',JSON.stringify({...receipt,cut:true}));
writeFileSync('/tmp/muusia-ascii-merge.escpos',bytes);
console.log(`ASCII Merge: user graph, nested merges, native parity and ${actual.length} original rows at exact positions across ${pages.length} pages pass.`);
