import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
test('section refresh is manual, prevents overlapping requests and ignores late responses',async()=>{
 let cleanup,resolve,calls=0;const delivered=[];
 const exports={};const source=fs.readFileSync(new URL('../app/use-live-data.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/setInterval|addEventListener/);
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require','fetch',code)(exports,()=>({useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:fn=>{cleanup=fn();}}),async()=>{calls++;return await new Promise(r=>{resolve=r;});});
 const section=exports.useSectionData('/api/workspace?id=a',d=>delivered.push(d),false,false);assert.equal(calls,0);
 const first=section.refresh();assert.equal(calls,1);await section.refresh();assert.equal(calls,1);
 resolve({ok:true,json:async()=>({revision:2})});await first;assert.deepEqual(delivered,[{revision:2}]);
 const second=section.refresh();assert.equal(calls,2);cleanup();resolve({ok:true,json:async()=>({revision:3})});await second;assert.equal(delivered.length,1);
 const paused=exports.useSectionData('/api/workspace?id=a',()=>{},true);await paused.refresh();assert.equal(calls,2);
});
