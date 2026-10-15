import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parseAst} from 'rolldown/parseAst';
import Frame from '../src/defs/nodes/frame.js';
import Spikes from '../src/defs/nodes/spikes3d.js';
import {Pin,EMPTY} from '../src/defs/helpers.js';
import {describeNode,inspectPatch} from '../src/muusia-guide.js';
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def]));
const base=defaults(Frame),clock=(i,p={},n=48)=>Frame.compute([],{...base,...p},{frameIdx:i,frameCount:n});
let checks=0;
for(const n of [1,2,12,24,48,97])for(let i=0;i<n;i++) {
  const actual=clock(i,{},n),t=n>1?i/(n-1):0,tl=i/n;
  assert.deepEqual(actual.slice(0,5),[t,i,.5-.5*Math.cos(tl*Math.PI*2),tl<.5?tl*2:2-tl*2,tl*360]);
  assert.equal(actual.length,7);assert.ok(actual.slice(5).every(v=>v===0||v===1));checks++;
}
assert.deepEqual(Array.from({length:12},(_,i)=>clock(i)[5]),[0,0,0,1,0,0,0,1,0,0,0,1]);
assert.deepEqual(Array.from({length:12},(_,i)=>clock(i)[6]),[0,0,0,1,1,1,1,0,0,0,0,1]);
for(const rate of Frame.params.find(p=>p.key==='bangRate').options.filter(p=>p.startsWith('1/'))) {
  const period=+rate.slice(2);let parity=0;
  for(let i=0;i<96;i++){const q=clock(i,{bangRate:rate},96),hit=(i+1)%period===0?1:0;parity^=hit;assert.equal(q[5],hit);assert.equal(q[6],parity);checks++;}
}
for(const every of [0,1,3.6,7,128,Infinity,NaN,-9])for(let i=0;i<32;i++){assert.ok(clock(i,{bangRate:'Custom',bangEvery:every},32).every(Number.isFinite));checks++;}
for(const chance of [0,1,25,75,100]) {
  let parity=0;const sequential=[];
  for(let i=0;i<96;i++){const q=clock(i,{bangRate:'Random',bangChance:chance},96);parity^=q[5];assert.equal(q[6],parity);sequential.push(q.slice(5));checks++;}
  for(const i of [95,0,48,3,71,0,95])assert.deepEqual(clock(i,{bangRate:'Random',bangChance:chance},96).slice(5),sequential[i],'Scrubbing cannot change a trigger');
  assert.deepEqual(clock(30,{bangRate:'Random',bangChance:chance},96).slice(5),clock(30,{bangRate:'Random',bangChance:chance},200).slice(5),'Growing frame count preserves the prefix');
  if(chance===0)assert.ok(sequential.every(q=>q[0]===0&&q[1]===0));if(chance===100)assert.ok(sequential.every((q,i)=>q[0]===1&&q[1]===(i+1)%2));
}
assert.notDeepEqual(Array.from({length:96},(_,i)=>clock(i,{bangRate:'Random',bangSeed:4})[5]),Array.from({length:96},(_,i)=>clock(i,{bangRate:'Random',bangSeed:5})[5]));
assert.deepEqual(Frame.compute([],{}, {frameIdx:3,frameCount:12}),clock(3,{},12),'Old Frame nodes with empty saved params');
const source=await fs.readFile('src/App.jsx','utf8'),ast=parseAst(source,{lang:'jsx'});
const needed=['bindingType','groupOutType','defIns','defOuts','numericParams','defaultFor','evalLevel'];
const functions=needed.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(n,name);return source.slice(n.start,n.end);}).join('\n');
const defs={frame:Frame,spikes3d:Spikes,constant:{name:'Test number',ins:[],outs:[Pin('value')],params:[],compute(_ins,_p,_ctx,node){return node.data.value;}}};
// Execute the actual app evaluator; test no copied approximation of its wire handling.
const bind=Function('DEFS','EMPTY','SOLID_STYLE','Pin',functions+'\nreturn {evalLevel,defIns,numericParams};')(defs,EMPTY,{kind:'style',mode:'Solid'},Pin);
defs.group={name:'Group',params:[],ins:node=>node.data.bindings.map(b=>Pin(typeof b.port==='string'?'value':'paths')),outs:[Pin('paths')]};
const frame={id:1,type:'frame',params:base},spike={id:2,type:'spikes3d',params:{...defaults(Spikes),count:80}},edge=port=>({from:1,fromPort:port,to:2,toPort:'p:occlusion'});
const graph={nodes:[frame,spike],edges:[edge(5)],outputId:2},before=JSON.stringify(graph);
assert.ok(bind.numericParams(spike).some(p=>p.key==='occlusion'));
const geometries=[];
for(let i=0;i<12;i++) {
  const ctx={W:210,H:297,frameCount:12,frameIdx:i},r=bind.evalLevel(graph,ctx);
  assert.equal(r.pvals[2].occlusion,(i+1)%4===0);assert.deepEqual(r.out[2][0],Spikes.compute([],{...spike.params,occlusion:(i+1)%4===0},ctx));geometries.push(r.out[2][0]);checks++;
}
assert.notDeepEqual(geometries[0],geometries[3]);
graph.edges=[edge(6)];for(let i=0;i<12;i++)assert.equal(bind.evalLevel(graph,{W:210,H:297,frameCount:12,frameIdx:i}).pvals[2].occlusion,!!clock(i,{},12)[6]);
graph.edges=[edge(5)];assert.equal(JSON.stringify(graph),before,'Never replace the stored manual checkbox');
const constant={id:3,type:'constant',params:{},data:{value:0}};
const cg={nodes:[constant,spike],edges:[{from:3,to:2,toPort:'p:occlusion'}]};
for(const [value,expected] of [[-1,false],[0,false],[.49,false],[.5,true],[1,true],[12,true],[NaN,true],[Infinity,true],[undefined,true]]){constant.data.value=value;assert.equal(bind.evalLevel(cg,{W:210,H:297}).pvals[2].occlusion,expected);checks++;}
cg.edges=[];assert.equal(bind.evalLevel(cg,{W:210,H:297}).pvals[2].occlusion,true,'Disconnect restores the stored manual state');
const group={id:4,type:'group',params:{},data:{nodes:[spike],edges:[],bindings:[{nodeId:2,port:'p:occlusion'}],outputId:2}};
for(const value of [0,1]){constant.data.value=value;const g={nodes:[constant,group],edges:[{from:3,to:4,toPort:0}]};assert.deepEqual(bind.evalLevel(g,{W:210,H:297}).out[4][0],Spikes.compute([],{...spike.params,occlusion:!!value},{W:210,H:297}));checks++;}
const r=bind.evalLevel(graph,{W:210,H:297,frameIdx:3,frameCount:12});
assert.deepEqual(inspectPatch(graph,defs,r.out),[]);
const control=describeNode(spike,graph,defs,{},r.out,r.pvals).parameters.find(p=>p.key==='occlusion');assert.equal(control.boolean,true);assert.equal(control.wired,true);assert.equal(control.value,true);assert.equal(control.validWire,true);
assert.equal(describeNode(spike,group.data,defs,{}, {},{2:{occlusion:false}}).parameters.find(p=>p.key==='occlusion').source,'Parent group input');
// Inventory every built-in checkbox, including the hidden inline Route node.
// Observe parameter dispatch independently of costly node geometry computation.
const shipped = {};
for (const file of (await fs.readdir('src/defs/nodes')).filter(f => f.endsWith('.js'))) {
  const d = (await import(`../src/defs/nodes/${file}`)).default; shipped[d.key] = d;
}
const inline = ast.body.find(n => n.type === 'VariableDeclaration' && n.declarations.some(d => d.id.name === 'DEFS')).declarations.find(d => d.id.name === 'DEFS').init;
const route = inline.properties.find(p => p.key?.name === 'reititys').value;
shipped.reititys = Function('Pin', `return (${source.slice(route.start, route.end)});`)(Pin);
let checkboxCount = 0, checkboxNodes = 0, multiCount = 0;
for (const [type, d] of Object.entries(shipped)) {
  defs[type] = type === 'frame' ? Frame : {...d, ins:[], outs:[Pin('value')], frameFan:false, compute:(_ins, p) => p};
  const target = {id:2,type,params:defaults(d)}, ports = bind.numericParams(target).filter(p => p.type === 'check');
  if (ports.length) checkboxNodes++;
  assert.equal(new Set(bind.numericParams(target).map(p => p.key)).size, bind.numericParams(target).length, `${type}: unique parameter ports`);
  for (const p of ports) {
    checkboxCount++; if (p.multiKey) multiCount++;
    const saved = JSON.stringify(target), g = {nodes:[frame,target],edges:[{from:1,fromPort:5,to:2,toPort:'p:'+p.key}]};
    for (const frameIdx of [0,3]) {
      const result = bind.evalLevel(g,{frameIdx,frameCount:16}), values = result.pvals[2], expected = frameIdx === 3;
      assert.equal(p.multiKey ? values[p.multiKey].includes(p.multiOption) : values[p.key],expected,`${type}.${p.key}: Bang`);
      if (p.multiKey) for (const option of d.params.find(v=>v.key===p.multiKey).options.filter(o=>o!==p.multiOption)) assert.equal(values[p.multiKey].includes(option),target.params[p.multiKey].includes(option),'Other choices survive');
      const info = describeNode(target,g,defs,{},result.out,result.pvals).parameters.find(v=>v.key===p.key);
      assert.equal(info.value,expected);assert.equal(info.wired,true);assert.equal(info.validWire,true);
      assert.ok(!inspectPatch(g,defs,result.out).some(i=>i.title==='Wire port is missing'),`${type}.${p.key}: Guide recognizes port`);
      const grouped = {nodes:[target],edges:[],bindings:[{nodeId:2,port:'p:'+p.key}],outputId:2};
      const bound = bind.evalLevel(grouped,{},[+expected]).pvals[2];
      assert.equal(p.multiKey ? bound[p.multiKey].includes(p.multiOption) : bound[p.key],expected,`${type}.${p.key}: group input`);
      checks++;
    }
    assert.equal(JSON.stringify(target),saved,'Wires preserve manual selections');
    g.edges=[];assert.deepEqual(bind.evalLevel(g,{}).pvals[2],target.params,'Disconnect restores all saved settings');
  }
}
// Check the actual multi-choice consumer, not only its parameter dispatch.
const TestCard=shipped.testcard;defs.testcard=TestCard;defs.spikes3d=Spikes;
const card={id:2,type:'testcard',params:{...defaults(TestCard),tests:[]}};
const cards={nodes:[frame,card],edges:[{from:1,fromPort:5,to:2,toPort:'p:tests[0]'}]};
for(const frameIdx of [0,3]) {
  const ctx={W:297,H:210,frameCount:16,frameIdx},r=bind.evalLevel(cards,ctx),tests=frameIdx===3?[TestCard.params[0].options[0]]:[];
  assert.deepEqual(r.out[2][0],TestCard.compute([],{...card.params,tests},ctx));
  assert.equal(r.out[2][0].paths.length>0,frameIdx===3);checks++;
}
assert.deepEqual(card.params.tests,[]);
// A saved project lacking this optional field uses the declared list default.
delete card.params.tests;
const legacy=bind.evalLevel(cards,{W:297,H:210,frameCount:16,frameIdx:0});
assert.deepEqual(legacy.pvals[2].tests,TestCard.params[0].def.filter(o=>o!==TestCard.params[0].options[0]));
assert.ok(checkboxCount>300 && multiCount===12);
console.log(`PASS: ${checks} Frame/engine cases; ${checkboxCount} checkbox inputs across ${checkboxNodes} built-in nodes (${multiCount} list choices); full inventory Bang/group/Guide/fallback checks, actual Test Card and Spikes geometry, original clock ports and deterministic random/toggle.`);
