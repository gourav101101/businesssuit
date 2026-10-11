import { access, audit, bindings, failure, identity, sameOrigin } from '@/lib/server';
import { decrypt, encrypt } from '@/lib/meta';
import { healthTable } from '@/lib/token-health';
async function session(id: string) { const u = await identity(); const s = await bindings().DB.prepare('SELECT * FROM oauth_sessions WHERE id=? AND user_id=? AND expires_at>?').bind(id, u.userId, Date.now()).first<{
    id: string;
    workspace_id: string;
    payload: string;
}>(); if (!s || s.payload === 'pending')
    throw new Error('Page selection expired. Connect again.'); await access(s.workspace_id, ['owner']); return { s, u, pages: JSON.parse(await decrypt(s.payload)) as {
        id: string;
        name: string;
        access_token: string;
        tasks: string[];
    }[] }; }
export async function GET(req: Request) { try {
    const { s, pages } = await session(new URL(req.url).searchParams.get('session') || '');
    return Response.json({ workspace: s.workspace_id, pages: pages.map(p => ({ id: p.id, name: p.name, tasks: p.tasks })) });
}
catch (e) {
    return failure(e);
} }
export async function POST(req: Request) { try {
    sameOrigin(req);
    const b = await req.json() as any;
    const { s, u, pages } = await session(b.session);
    const p = pages.find(p => p.id === b.pageId);
    if (!p)
        throw new Error('Select a Page from this connection session');
    await bindings().DB.prepare('INSERT INTO connections (workspace_id,page_id,page_name,encrypted_token) VALUES (?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET page_id=excluded.page_id,page_name=excluded.page_name,encrypted_token=excluded.encrypted_token').bind(s.workspace_id, p.id, p.name, await encrypt(p.access_token)).run();
    await bindings().DB.prepare('DELETE FROM oauth_sessions WHERE id=?').bind(s.id).run();
    await audit(s.workspace_id, u.email, 'Connected Facebook Page ' + p.name + ' through OAuth');
    await healthTable();
    await bindings().DB.prepare('DELETE FROM connection_health WHERE workspace_id=?').bind(s.workspace_id).run();
    return Response.json({ ok: true, workspace: s.workspace_id });
}
catch (e) {
    return failure(e);
} }
