import { access, bindings, failure } from '@/lib/server';
import { encrypt } from '@/lib/meta';
export async function GET(req: Request) { try {
    const url = new URL(req.url);
    const id = url.searchParams.get('workspace') || '';
    const a = await access(id, ['owner']);
    const e = bindings();
    if (!e.META_APP_ID || !e.META_APP_SECRET || !e.META_API_VERSION || !e.TOKEN_ENCRYPTION_KEY)
        throw new Error('Facebook OAuth needs META_APP_ID, META_APP_SECRET, META_API_VERSION and TOKEN_ENCRYPTION_KEY.');
    const nonce = crypto.randomUUID();
    const expires = Date.now() + 10 * 60000;
    await e.DB.prepare('INSERT INTO oauth_sessions (id,user_id,workspace_id,payload,expires_at) VALUES (?,?,?,?,?)').bind(nonce, a.u.userId, id, 'pending', expires).run();
    const state = await encrypt(JSON.stringify({ nonce, user: a.u.userId, workspace: id, expires }));
    const auth = new URL(`https://www.facebook.com/${e.META_API_VERSION}/dialog/oauth`);
    auth.searchParams.set('client_id', String(e.META_APP_ID));
    auth.searchParams.set('redirect_uri', url.origin + '/api/facebook/callback');
    auth.searchParams.set('state', state);
    auth.searchParams.set('scope', 'pages_show_list,pages_read_engagement,pages_manage_posts');
    auth.searchParams.set('response_type', 'code');
    return Response.redirect(auth.toString(), 302);
}
catch (e) {
    return failure(e);
} }
