import { bindings } from './server';
import { connection, graph } from './meta';
export type TokenHealth={status:'valid'|'invalid'|'unknown';expiresAt:number|null;dataAccessExpiresAt:number|null;checkedAt:number;message:string};
export async function healthTable() {await bindings().DB.prepare('CREATE TABLE IF NOT EXISTS connection_health (workspace_id TEXT PRIMARY KEY, result TEXT NOT NULL)').run();}
export async function checkConnection(id:string, force=true):Promise<TokenHealth> {
    await healthTable(); const e=bindings();
    const stored=await e.DB.prepare('SELECT result FROM connection_health WHERE workspace_id=?').bind(id).first<{result:string}>();
    if(stored&&!force){const cached=JSON.parse(stored.result) as TokenHealth;const expired=[cached.expiresAt,cached.dataAccessExpiresAt].some(n=>n!==null&&n>0&&n*1000<=Date.now());if(!expired&&cached.checkedAt>Date.now()-6*3600000)return cached;}
    const c=await connection(id);
    let result:TokenHealth={status:'unknown',expiresAt:null,dataAccessExpiresAt:null,checkedAt:Date.now(),message:'Expiry details unavailable. Reconnect if Facebook rejects this connection.'};
    try {
        await graph(`${c.pageId}?fields=id,name`,c.token);
        result.status='valid';result.message='Page connection is working. Expiry has not been confirmed.';
        if(e.META_APP_ID&&e.META_APP_SECRET) {
            // Credentials are sent only to Meta; never returned to the browser or logged.
            const url=new URL(`https://graph.facebook.com/${e.META_API_VERSION}/debug_token`);
            url.searchParams.set('input_token',c.token);
            const response=await fetch(url,{headers:{Authorization:`Bearer ${e.META_APP_ID}|${e.META_APP_SECRET}`},signal:AbortSignal.timeout(25000)});
            const json=await response.json() as any;
            if(response.ok&&json.data) {
                const d=json.data;
                result.status=d.is_valid===true&&String(d.app_id)===String(e.META_APP_ID)?'valid':'invalid';
                result.expiresAt=typeof d.expires_at==='number'?d.expires_at:null;
                result.dataAccessExpiresAt=typeof d.data_access_expires_at==='number'?d.data_access_expires_at:null;
                const expiry=[result.expiresAt,result.dataAccessExpiresAt].filter((n):n is number=>typeof n==='number'&&n>0).sort((a,b)=>a-b)[0];
                if(expiry&&expiry*1000<Date.now())result.status='invalid';
                result.message=result.status==='invalid'?'Reconnect Facebook: access is expired, revoked or belongs to another app.':expiry&&expiry*1000<Date.now()+7*86400000?'Facebook access expires within seven days. Reconnect soon.':result.expiresAt===0?'Meta reports no fixed token expiry. Access can still be revoked.':'Facebook access is valid.';
            }
        }
    }catch(error){const msg=error instanceof Error?error.message:'';result.status=/\(190\)|\(102\)|expired|invalid.*token/i.test(msg)?'invalid':'unknown';result.message=result.status==='invalid'?'Reconnect Facebook: the stored token is no longer accepted.':'Could not verify Facebook right now. Check again before submitting.';}
    await e.DB.prepare('INSERT INTO connection_health (workspace_id,result) VALUES (?,?) ON CONFLICT(workspace_id) DO UPDATE SET result=excluded.result').bind(id,JSON.stringify(result)).run();
    return result;
}
