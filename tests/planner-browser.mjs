import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve('tests/artifacts/planner');await fs.mkdir(out,{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--remote-debugging-port=9242','--user-data-dir='+path.join(out,'profile-2'),'about:blank'],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let ws,n=0;const pending=new Map();
function cmd(method,params={}){return new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
try{
 let tabs;for(let i=0;i<80;i++){try{tabs=await(await fetch('http://127.0.0.1:9242/json')).json();break;}catch{await wait(250);}}
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
 await cmd('Page.enable');await cmd('Network.enable');await cmd('Network.setCookie',{name:'__sites_local_auth',value:'1',url:'http://127.0.0.1:5173'});


 await cmd('Page.navigate',{url:'http://127.0.0.1:5173/planner'});
 for(let i=0;i<100;i++){if(await ev('document.querySelectorAll(".planner-pages .panel").length>0'))break;await wait(200);}
 assert.equal(await ev('document.querySelectorAll(".planner-pages .panel").length'),4);
 for(const width of [390,1440]){await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await wait(200);assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);const image=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'planner-'+width+'.png'),Buffer.from(image.data,'base64'));console.log('Planner fits',width);}
 console.log('Four real workspaces shown; no posts changed.');
}finally{ws?.close();chrome.kill();}

