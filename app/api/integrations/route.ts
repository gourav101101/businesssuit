import { access, audit, bindings, failure, identity, sameOrigin } from '@/lib/server';
import { encrypt, graph, connection } from '@/lib/meta';
import { checkConnection, healthTable } from '@/lib/token-health';
export async function GET() { try {
    await identity();
    const e = bindings();
    return Response.json({ oauth: !!(e.META_APP_ID && e.META_APP_SECRET && e.META_API_VERSION && e.TOKEN_ENCRYPTION_KEY), meta: !!(e.META_API_VERSION && e.TOKEN_ENCRYPTION_KEY), ai: !!((e.GEMINI_API_KEY&&e.GEMINI_MODEL)||(e.AI_SERVICE_URL && e.AI_SERVICE_KEY)), version: e.META_API_VERSION || null });
}
catch (e) {
    return failure(e);
} }
export async function POST(req: Request) { try {
    sameOrigin(req);
    const b = await req.json() as any;
    const a = await access(b.id, ['owner']);
    if (b.action === 'disconnect') {
        await healthTable();
        await bindings().DB.prepare('DELETE FROM connection_health WHERE workspace_id=?').bind(b.id).run();
        await bindings().DB.prepare('DELETE FROM connections WHERE workspace_id=?').bind(b.id).run();
        await audit(b.id, a.u.email, 'Disconnected Page; existing Facebook schedules are unchanged');
        return Response.json({ ok: true, message: 'Disconnected. Existing schedules on Facebook remain active.' });
    }
    if (b.action === 'health') {
        const health=await checkConnection(b.id);
        return Response.json({ ok: health.status==='valid', message: health.message, health });
    }
    if (!/^\d+$/.test(b.pageId) || typeof b.token !== 'string' || b.token.length < 20)
        throw new Error('Enter a numeric Page ID and a valid Page access token');
    const p = await graph(`${b.pageId}?fields=id,name`, b.token);
    await bindings().DB.prepare('INSERT INTO connections (workspace_id,page_id,page_name,encrypted_token) VALUES (?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET page_id=excluded.page_id,page_name=excluded.page_name,encrypted_token=excluded.encrypted_token').bind(b.id, p.id, p.name, await encrypt(b.token)).run();
    await audit(b.id, a.u.email, `Connected Facebook Page ${p.name}`);
    await healthTable();
    await bindings().DB.prepare('DELETE FROM connection_health WHERE workspace_id=?').bind(b.id).run();
    return Response.json({ ok: true, message: `Connected ${p.name}` });
}
catch (e) {
    return failure(e);
} }
