import { bindings } from './server';
async function key() { const secret = bindings().TOKEN_ENCRYPTION_KEY; if (typeof secret !== 'string' || secret.length < 32)
    throw new Error('Configure TOKEN_ENCRYPTION_KEY (at least 32 characters) on the server.'); const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)); return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']); }
export async function encrypt(s: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(s)); return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) }); }
export async function decrypt(s: string) { const { iv, data } = JSON.parse(s); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, await key(), new Uint8Array(data))); }
export async function graph(path: string, token: string, init: RequestInit = {}) { const version = bindings().META_API_VERSION; if (typeof version !== 'string' || !/^v\d+\.\d+$/.test(version))
    throw new Error('Configure a supported META_API_VERSION on the server.'); const r = await fetch(`https://graph.facebook.com/${version}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers }, signal: AbortSignal.timeout(25000) }); const body = await r.json() as any;
    const pageId = path.split(/[/?_]/)[0];
    if (/^\d+$/.test(pageId)) {
        try {
            const { DB } = bindings();
            await DB.prepare('CREATE TABLE IF NOT EXISTS api_usage (page_id TEXT PRIMARY KEY, usage TEXT, error TEXT, checked_at TEXT)').run();
            const usage = Object.fromEntries(['x-app-usage', 'x-page-usage', 'x-business-use-case-usage', 'retry-after'].map(h => [h, r.headers.get(h)]).filter(([, v]) => v));
            await DB.prepare('INSERT INTO api_usage (page_id,usage,error,checked_at) VALUES (?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET usage=excluded.usage,error=excluded.error,checked_at=excluded.checked_at').bind(pageId, JSON.stringify(usage), body.error ? String(body.error.code) + ': ' + body.error.message : '', new Date().toISOString()).run();
        } catch { /* Monitoring cannot invalidate an accepted remote delivery. */ }
    }
    if (!r.ok || body.error)
    throw new Error(`Meta rejected the request (${body.error?.code || r.status}): ${body.error?.message || 'Request failed'}`); return body; }
export async function connection(id: string) { const c = await bindings().DB.prepare('SELECT * FROM connections WHERE workspace_id=?').bind(id).first<{
    page_id: string;
    encrypted_token: string;
}>(); if (!c)
    throw new Error('Connect a Facebook Page in Integrations first.'); return { pageId: c.page_id, token: await decrypt(c.encrypted_token) }; }

export async function verifyDelivery(pageId: string, remoteId: string, token: string) {
    if (!remoteId.includes('_')) {
        try {
            const post = await graph(`${pageId}_${remoteId}?fields=id,is_published,permalink_url,scheduled_publish_time`, token);
            if (post.is_published === true) return { status: 'published' as const, id: post.id, permalink: post.permalink_url || '', scheduledAt: post.scheduled_publish_time || null };
            if (post.scheduled_publish_time) return { status: 'scheduled' as const, id: post.id, permalink: post.permalink_url || '', scheduledAt: post.scheduled_publish_time || null };
        } catch { /* A photo ID need not identify a Page post; check the scheduled-post edge. */ }
    }
    if (remoteId.includes('_')) {
        const post = await graph(`${remoteId}?fields=id,is_published,permalink_url,scheduled_publish_time`, token);
        if (post.is_published === true) return { status: 'published' as const, id: post.id, permalink: post.permalink_url || '', scheduledAt: post.scheduled_publish_time || null };
        if (post.scheduled_publish_time) return { status: 'scheduled' as const, id: post.id, permalink: post.permalink_url || '', scheduledAt: post.scheduled_publish_time || null };
    }
    let path = `${pageId}/scheduled_posts?fields=id,scheduled_publish_time,attachments{target,subattachments{target}}&limit=100`;
    for (let page = 0; page < 10; page++) {
        const result = await graph(path, token);
        const found = result.data?.find((post: any) => post.id === remoteId || post.attachments?.data?.some((item: any) =>
            item.target?.id === remoteId || item.subattachments?.data?.some((sub: any) => sub.target?.id === remoteId)));
        if (found) return { status: 'scheduled' as const, id: found.id, permalink: '', scheduledAt: found.scheduled_publish_time || null };
        const cursor = result.paging?.cursors?.after;
        if (!result.paging?.next || !cursor) break;
        path = `${pageId}/scheduled_posts?fields=id,scheduled_publish_time,attachments{target,subattachments{target}}&limit=100&after=${encodeURIComponent(cursor)}`;
    }
    throw new Error('Facebook has not confirmed this item as a scheduled Page post. It may be an uploaded photo. Inspect Business Suite before retrying.');
}
