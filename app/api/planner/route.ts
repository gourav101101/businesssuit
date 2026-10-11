import { initial, bindings, failure } from '@/lib/server';
export async function GET(){try{
 const rows=await initial();
 const pages=await Promise.all(rows.map(async(w:any)=>{
  const data=JSON.parse(w.data);
  const connection=await bindings().DB.prepare('SELECT page_id,page_name FROM connections WHERE workspace_id=?').bind(w.id).first();
  return {id:w.id,name:w.name,connection,paused:data.paused,queued:data.queue?.ids.length||0,stopped:data.queue?.stopped||'',posts:data.posts.map((p:any)=>({id:p.id,title:p.title,date:p.date,time:p.time,status:p.status,location:p.location||'',error:p.error||''}))};
 }));
 return Response.json({pages,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
