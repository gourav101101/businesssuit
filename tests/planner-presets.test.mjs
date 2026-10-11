import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
function load(path,deps={}){const e={};new Function('exports','require',ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,k=>deps[k]);return e;}
const model=load('lib/model.ts'),bulk=load('lib/bulk-edit.ts');
test('preset save and delete preserve posts and validate duplicate names',async()=>{
 let data={...model.blankData('Dewas','Dewas'),posts:[model.freshPost({caption:'Real caption',status:'scheduled',remoteId:'real'})]},revision=0;
 const original=JSON.stringify(data.posts);
 const server={sameOrigin(){},access:async()=>({data:structuredClone(data),w:{revision},u:{email:'owner'}}),save:async(id,next)=>{data=next;revision++;},audit:async()=>{},failure:e=>Response.json({error:e.message},{status:400})};
 const route=load('app/api/workspace/route.ts',{'@/lib/server':server,'@/lib/model':model,'@/lib/import':{},'@/lib/token-health':{},'@/lib/bulk-edit':bulk});
 const run=b=>route.POST(new Request('http://localhost/api/workspace',{method:'POST',body:JSON.stringify({id:'w',revision,...b})}));
 assert.equal((await run({action:'savePreset',name:'Evening',options:{location:'Dewas',suffix:'#Dewas',find:'never save'}})).status,200);
 assert.equal(data.presets[0].options.find,undefined);assert.equal(JSON.stringify(data.posts),original);
 assert.equal((await run({action:'savePreset',name:'evening',options:{suffix:'test'}})).status,400);
 assert.equal((await run({action:'savePreset',name:'Invalid',options:{placeId:'bad-id'}})).status,400);
 assert.equal((await run({action:'deletePreset',presetId:data.presets[0].id})).status,200);assert.equal(data.presets.length,0);assert.equal(JSON.stringify(data.posts),original);
});
test('planner includes only authorized workspaces and excludes captions/tokens',async()=>{
 const data=model.blankData('Allowed','City');data.posts=[model.freshPost({caption:'Private caption',title:'Headline'})];
 const deps={'@/lib/server':{initial:async()=>[{id:'allowed',name:'Allowed',data:JSON.stringify(data)}],bindings:()=>({DB:{prepare:()=>({bind:id=>{assert.equal(id,'allowed');return {first:async()=>({page_id:'123',page_name:'Destination'})};}})}}),failure:e=>Response.json({error:e.message},{status:401})}};
 const route=load('app/api/planner/route.ts',deps);const r=await route.GET();assert.equal(r.status,200);const body=await r.json();assert.equal(body.pages.length,1);assert.equal(body.pages[0].connection.page_name,'Destination');assert.equal(body.pages[0].posts[0].caption,undefined);
 deps['@/lib/server'].initial=async()=>{throw Error('Authentication required');};assert.equal((await route.GET()).status,401);
});
