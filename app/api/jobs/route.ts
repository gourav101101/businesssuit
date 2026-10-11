import { bindings, failure } from '@/lib/server';
import { sameSecret } from '@/lib/passwords';
import { runQueue } from '../queue/route';
import { checkConnection } from '@/lib/token-health';
export async function POST(req:Request) {
    try {
        const e=bindings();
        const configured=String(e.CRON_SECRET||'');
        if(configured.length<32 || !await sameSecret(req.headers.get('authorization')||'',`Bearer ${configured}`))return Response.json({error:'Authentication required'},{status:401});
        const workspaces=await e.DB.prepare('SELECT id,owner FROM workspaces ORDER BY id').all<{id:string;owner:string}>();
        const results=[];
        for(const w of workspaces.results) {
            const connected=await e.DB.prepare('SELECT page_id FROM connections WHERE workspace_id=?').bind(w.id).first();
            if(!connected)continue;
            try {
                const health=await checkConnection(w.id, false);
                if(health.status==='invalid') {results.push({id:w.id,status:'reconnect_required'});continue;}
                const r=await runQueue(new Request(new URL('/api/queue',req.url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:w.id,action:'tick'})}),{userId:w.owner,email:'background-worker@newsdesk.internal'});
                results.push({id:w.id,status:r.status});
            }catch{results.push({id:w.id,status:'check_failed'});}
        }
        return Response.json({ok:true,results},{headers:{'Cache-Control':'no-store'}});
    }catch(e){return failure(e);}
}
