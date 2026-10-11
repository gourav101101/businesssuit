'use client';
import {useEffect,useRef,useState} from 'react';
// Fetch on entry or explicit refresh only; no polling or focus-triggered reloads.
export function useSectionData<T>(url:string,onData:(data:T)=>void,paused=false,initial=true,refreshKey=0){
 const callback=useRef(onData);callback.current=onData;
 const blocked=useRef(paused);blocked.current=paused;
 const trigger=useRef<()=>Promise<void>>(async()=>{});
 const [updated,setUpdated]=useState(''),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
 useEffect(()=>{
  let stopped=false,running=false;let controller:AbortController|undefined;
  setUpdated('');setError('');setRefreshing(false);
  async function refresh(){
   if(!url||stopped||running||blocked.current)return;
   running=true;setRefreshing(true);controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),15000);
   try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error(r.status===401?'Session expired. Sign in again.':'Could not refresh. Please try again.');const data=await r.json() as T;if(stopped)return;callback.current(data);setUpdated(new Date().toLocaleTimeString('en-IN'));setError('');}
   catch(e){if(!stopped)setError((e as Error).name==='AbortError'?'Refresh timed out. Please try again.':(e as Error).message);}
   finally{clearTimeout(timeout);running=false;if(!stopped)setRefreshing(false);}
  }
  trigger.current=refresh;
  if(initial)void refresh();
  return()=>{stopped=true;controller?.abort();};
 },[url,initial,refreshKey]);
 return {updated,error,refreshing,refresh:()=>trigger.current()};
}
