import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
function load(path, dependencies={}) {
 const source=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('import.meta.env.DEV','false');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports','require',code)(exports,p=>{if(p in dependencies)return dependencies[p];throw Error(p);});return exports;
}
const passwords=load('lib/passwords.ts');
function harness(){
 const db=new DatabaseSync(':memory:');
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async run(){return db.prepare(sql).run(...args);},async first(){return db.prepare(sql).get(...args)||null;}};},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,BOOTSTRAP_TOKEN:'b'.repeat(64),AUTH_MODE:'password'};
 const store=load('lib/auth-store.ts',{'cloudflare:workers':{env},'./passwords':passwords});
 const route=load('app/api/auth/route.ts',{'@/lib/auth-store':store,'@/lib/passwords':passwords});
 const request=(body,headers={})=>route.POST(new Request('https://newsdesk.test/api/auth',{method:'POST',headers:{Origin:'https://newsdesk.test',...headers},body:JSON.stringify(body)}));
 return {request,store,db};
}
test('password hashing uses unique salts and rejects wrong passwords and unsafe redirects',async()=>{
 const a=await passwords.hashPassword('a long unique test password'),b=await passwords.hashPassword('a long unique test password');
 assert.notEqual(a,b);assert.ok(await passwords.verifyPassword('a long unique test password',a));assert.equal(await passwords.verifyPassword('another long password',a),false);
 for(const url of ['https://evil.test','//evil.test','/\\evil.test','/login'])assert.equal(passwords.safeReturn(url),'/overview');
 assert.equal(passwords.safeReturn('/calendar?workspace=abc'),'/calendar?workspace=abc');
});
test('owner setup requires a secret, runs once, creates secure sessions and supports password rotation/logout',async()=>{
 const h=harness(),payload={action:'setup',email:'Owner@Example.com',password:'a long unique test password'};
 assert.equal((await h.request(payload)).status,400);
 const created=await h.request({...payload,setupKey:'b'.repeat(64)});assert.equal(created.status,200);
 const cookie=created.headers.get('set-cookie').split(';')[0];assert.match(created.headers.get('set-cookie'),/HttpOnly; SameSite=Lax.*Secure/);
 const u=await h.store.sessionUser(new Headers({Cookie:cookie}));assert.equal(u.email,'owner@example.com');
 assert.equal((await h.request({...payload,setupKey:'b'.repeat(64)})).status,400);
 assert.equal((await h.request({action:'login',email:payload.email,password:'wrong long password'})).status,400);
 const changed=await h.request({action:'password',currentPassword:payload.password,password:'a different long password'},{Cookie:cookie});assert.equal(changed.status,200);
 assert.equal(await h.store.sessionUser(new Headers({Cookie:cookie})),null);
 const login=await h.request({action:'login',email:payload.email,password:'a different long password',returnTo:'//evil.test'});assert.equal(login.status,200);assert.equal((await login.json()).returnTo,'/overview');
 const next=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await h.request({action:'logout'},{Cookie:next})).status,200);assert.equal(await h.store.sessionUser(new Headers({Cookie:next})),null);
 h.db.close();
});
test('cross-origin requests, repeated guesses and expired sessions are rejected',async()=>{
 const h=harness();assert.equal((await h.request({action:'login'},{Origin:'https://evil.test'})).status,403);
 const created=await h.request({action:'setup',email:'owner@example.com',password:'a long unique test password',setupKey:'b'.repeat(64)});
 const cookie=created.headers.get('set-cookie').split(';')[0];h.db.exec('UPDATE auth_sessions SET expires_at=0');assert.equal(await h.store.sessionUser(new Headers({Cookie:cookie})),null);
 for(let i=0;i<10;i++)await h.request({action:'login',email:'owner@example.com',password:'a long wrong password'});
 assert.equal((await h.request({action:'login',email:'owner@example.com',password:'a long wrong password'})).status,429);h.db.close();
});
