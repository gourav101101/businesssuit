'use client';
import {useEffect,useState} from 'react';
import {Modal} from './ui';
import {statusLabels,type Data} from '@/lib/model';
export default function ScheduleProgress({workspace,ids,onClose}:{workspace:string;ids:string[];onClose:()=>void}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false,timer:ReturnType<typeof setTimeout>;
  async function request(path:string,body?:unknown){const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);const result=await r.json() as any;if(!r.ok)throw Error(result.error||'Unable to check submission');return result;}
  async function run(){try{
   const result=await request('/api/workspace?id='+encodeURIComponent(workspace));if(cancelled)return;const current=result.data as Data;setData(current);setError('');
   const complete=ids.every(id=>current.posts.some(p=>p.id===id&&['scheduled','published'].includes(p.status)&&p.remoteId));
   if(complete||current.paused||current.queue?.stopped)return;
   const pending=ids.some(id=>current.queue?.ids.includes(id)||current.queue?.inFlight===id);
   if(!pending){setError('These posts are not all confirmed and are no longer in the pending queue. Check their status before submitting again.');return;}
   if(!current.queue?.inFlight)await request('/api/queue',{id:workspace,action:'tick'});
  }catch(e){if(!cancelled)setError((e as Error).message);return;}
  if(!cancelled)timer=setTimeout(()=>void run(),1500);
  }
  void run();return()=>{cancelled=true;clearTimeout(timer);};
 },[workspace,ids]);
 const posts=ids.map(id=>data?.posts.find(p=>p.id===id));
 const confirmed=posts.filter(p=>p?.remoteId&&['scheduled','published'].includes(p.status)).length;
 return <Modal title={confirmed===ids.length?'Facebook schedules confirmed':'Scheduling on Facebook'} onClose={onClose}><p role="status"><b>{confirmed} of {ids.length}</b> confirmed by Facebook.</p><progress aria-label="Facebook schedules confirmed" value={confirmed} max={ids.length} style={{width:'100%',margin:'16px 0'}}/>{!data&&!error&&<p>Loading saved queue...</p>}{error&&<p role="alert" className="auth-error">{error} The saved queue is retained. Refresh the workspace to inspect it; do not blindly resubmit.</p>}{data?.paused&&<p className="warning">Submissions are paused. Resume them in Calendar to continue.</p>}{data?.queue?.stopped&&<p role="alert" className="auth-error">Queue stopped: {data.queue.stopped}</p>}<div style={{maxHeight:320,overflowY:'auto'}}>{posts.map((p,i)=><div className="metric-row" key={ids[i]}><span>{p?.title||'Loading story...'}</span><span>{p?data?.queue?.inFlight===p.id?'Submitting to Facebook':data?.queue?.ids.includes(p.id)?'Queued — awaiting Facebook':statusLabels[p.status]:'Waiting'}</span></div>)}</div><p className="help-text">This window stays open until you close it. “Planned locally” is not a confirmed Facebook schedule. If you close this window early, the app server and background queue runner must remain running to finish pending work.</p><div className="modal-actions"><button className="btn primary" onClick={onClose}>{confirmed===ids.length?'Done':'Close progress'}</button></div></Modal>;
}
