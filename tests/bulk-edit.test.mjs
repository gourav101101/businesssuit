import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(file){const exports={};new Function('exports',ts.transpileModule(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);return exports;}
const {applyBulk,previewBulk,publicationCaption,validatePlace}=load('lib/bulk-edit.ts');
const {freshPost}=load('lib/model.ts');
const {parseManifest,csvCell}=load('lib/import.ts');
test('bulk preview and saved caption agree, approval resets, metadata history is retained',()=>{
 const p=freshPost({caption:'Dewas local news',status:'approved',approvedVersion:1,location:'Old location'});
 const options={location:'Dewas, Madhya Pradesh',placeId:'123456',category:'Civic',suffix:'#Dewas',find:'local',replace:'city'};
 const preview=previewBulk(p,options),result=applyBulk([p],[p.id],options);
 assert.equal(result.posts[0].caption,preview.caption);assert.equal(result.posts[0].status,'review');assert.equal(result.posts[0].approvedVersion,undefined);assert.equal(result.posts[0].history[0].location,'Old location');assert.equal(result.posts[0].placeId,'123456');
 assert.equal(publicationCaption(result.posts[0]),'📍 Dewas, Madhya Pradesh\n\nDewas city news\n\n#Dewas');assert.equal(p.status,'approved');
});
test('remote selection fails atomically; unknown and empty IDs are rejected',()=>{
 const a=freshPost({caption:'Original'}),b=freshPost({status:'scheduled',remoteId:'page_post'});
 assert.throws(()=>applyBulk([a,b],[a.id,b.id],{suffix:'footer'}),/remote/);assert.equal(a.caption,'Original');
 assert.throws(()=>applyBulk([a],['missing'],{}),/no longer/);assert.throws(()=>applyBulk([a],[],{}),/Select/);
});
test('repeated footer does not duplicate; clearing location leaves original caption',()=>{
 const p=freshPost({caption:'News'});const first=applyBulk([p],[p.id],{suffix:'#Dewas',location:'Dewas'}).posts[0];
 assert.equal(applyBulk([first],[p.id],{suffix:'#Dewas',location:'Dewas'}).changed,0);
 const clear=previewBulk(first,{location:'',placeId:''});assert.equal(publicationCaption(clear),'News\n\n#Dewas');
});
test('literal replacement, invalid Place IDs and oversized captions',()=>{
 assert.equal(previewBulk(freshPost({caption:'a.b and aXb'}),{find:'a.b',replace:'x'}).caption,'x and aXb');
 assert.throws(()=>validatePlace('https://facebook.com/place'),/digits/);assert.throws(()=>previewBulk(freshPost({caption:'x'.repeat(20000)}),{suffix:'y'}),/exceeds/);
});
test('CSV and TXT preserve location metadata without changing caption',()=>{
 const row=['caption','location','place_id'].join(',')+'\n'+['News','Dewas, MP','12345'].map(csvCell).join(',');
 const csv=parseManifest(row,'csv','2099-01-01')[0];assert.equal(csv.location,'Dewas, MP');assert.equal(csv.placeId,'12345');assert.equal(csv.caption,'News');
 const txt=parseManifest('Title: City news\nCaption: News\nLocation: Dewas\nPlace_ID: 12345','txt','2099-01-01')[0];assert.equal(txt.location,'Dewas');assert.equal(txt.placeId,'12345');assert.equal(txt.caption,'News');
});

test('publishing sends location and Place ID for scheduled feed and immediate photo requests',async()=>{
 for(const action of ['schedule','now']){
  const p=freshPost({caption:'Verified news',location:'Dewas',placeId:'12345',media:'image',status:'approved',approvedVersion:1});
  const calls=[];const server={sameOrigin(){},access:async()=>({data:{posts:[p]},w:{revision:1},u:{email:'qa'}}),bindings:()=>({DB:{prepare:()=>({bind:()=>({first:async()=>({id:'image',type:'image/png'})})})},BUCKET:{get:async()=>({arrayBuffer:async()=>new ArrayBuffer(1)})}}),save:async()=>{},audit:async()=>{},failure:e=>Response.json({error:e.message},{status:400})};
  const deps={'@/lib/server':server,'@/lib/meta':{connection:async()=>({pageId:'42',token:'test'}),graph:async(path,token,init)=>{calls.push({path,body:init.body});return path.endsWith('/photos')?{id:'photo'}:{id:'42_post'};},verifyDelivery:async()=>({id:'42_post',status:action==='now'?'published':'scheduled',permalink:''})},'@/lib/model':{epoch:()=>Date.now()/1000+7200},'@/lib/import':{captionWarnings:()=>[]},'@/lib/bulk-edit':{publicationCaption,validatePlace}};
  const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(new URL('../app/api/publish/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,name=>deps[name]);
  const response=await exports.POST(new Request('http://localhost/api/publish',{method:'POST',body:JSON.stringify({id:'workspace',postId:p.id,action})}));assert.equal(response.status,200);
  const request=calls.at(-1);assert.equal(request.body.get('place'),'12345');assert.equal(request.body.get('message'),'\u{1f4cd} Dewas\n\nVerified news');assert.equal(request.path,action==='now'?'42/photos':'42/feed');
 }
});
