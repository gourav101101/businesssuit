import { access, audit, bindings } from '@/lib/server';
import { decrypt, encrypt, graph } from '@/lib/meta';
export async function GET(req: Request) { const url = new URL(req.url); try {
    if (url.searchParams.has('error'))
        throw new Error('Facebook connection was declined or cancelled.');
    const state = JSON.parse(await decrypt(url.searchParams.get('state') || ''));
    const a = await access(state.workspace, ['owner']);
    if (state.user !== a.u.userId || state.expires < Date.now())
        throw new Error('Connection session expired; start again.');
    const e = bindings();
    const pending = await e.DB.prepare('DELETE FROM oauth_sessions WHERE id=? AND user_id=? AND payload=? AND expires_at>? RETURNING id').bind(state.nonce, a.u.userId, 'pending', Date.now()).first();
    if (!pending)
        throw new Error('This connection session was already used.');
    const code = url.searchParams.get('code');
    if (!code)
        throw new Error('Facebook did not return a connection code.');
    const exchange = async (params: Record<string, string>) => { const r = await fetch(`https://graph.facebook.com/${e.META_API_VERSION}/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: String(e.META_APP_ID), client_secret: String(e.META_APP_SECRET), ...params }), signal: AbortSignal.timeout(25000) }); const d = await r.json() as any; if (!r.ok || !d.access_token)
        throw new Error('Facebook token exchange failed. Check app settings and redirect URL.'); return d.access_token as string; };
    const token = await exchange({ redirect_uri: url.origin + '/api/facebook/callback', code });
    const long = await exchange({ grant_type: 'fb_exchange_token', fb_exchange_token: token });
    const pages = await graph('me/accounts?fields=id,name,access_token,tasks&limit=100', long);
    if (!pages.data?.length)
        throw new Error('No eligible Pages returned. Check Page access and requested permissions.');
    const id = crypto.randomUUID();
    await e.DB.prepare('INSERT INTO oauth_sessions (id,user_id,workspace_id,payload,expires_at) VALUES (?,?,?,?,?)').bind(id, a.u.userId, state.workspace, await encrypt(JSON.stringify(pages.data)), Date.now() + 10 * 60000).run();
    await audit(state.workspace, a.u.email, 'Facebook authorization completed; Page selection pending');
    return Response.redirect(url.origin + '/?connect=' + id, 302);
}
catch (err) {
    const message = err instanceof Error ? err.message : 'Facebook connection failed';
    return Response.redirect(url.origin + '/?connection_error=' + encodeURIComponent(message), 302);
} }
