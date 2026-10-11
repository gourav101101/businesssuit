import { access, bindings, failure, sameOrigin } from '@/lib/server';
export async function GET(req: Request) { try {
    const q = new URL(req.url).searchParams;
    const asset = await bindings().DB.prepare('SELECT * FROM assets WHERE id=?').bind(q.get('id')).first<{
        id: string;
        workspace_id: string;
        type: string;
        name: string;
    }>();
    if (!asset)
        throw new Error('Asset not found');
    await access(asset.workspace_id);
    const object = await bindings().BUCKET.get(asset.id);
    if (!object)
        return new Response('Not found', { status: 404 });
    return new Response(object.body, { headers: { 'Content-Type': asset.type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}
catch (e) {
    return failure(e);
} }
export async function POST(req: Request) { try {
    sameOrigin(req);
    const form = await req.formData();
    const id = String(form.get('workspace'));
    await access(id, ['owner', 'editor', 'publisher']);
    const f = form.get('file');
    if (!(f instanceof File))
        throw new Error('Choose a file');
    if (f.size > 15 * 1024 * 1024)
        throw new Error('Files must be under 15 MB');
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(f.type))
        throw new Error('Use PNG, JPEG, WebP or PDF');
    const key = crypto.randomUUID();
    const bytes = await f.arrayBuffer();
    await bindings().BUCKET.put(key, bytes, { httpMetadata: { contentType: f.type } });
    await bindings().DB.prepare('INSERT INTO assets (id,workspace_id,name,type,size,created_at) VALUES (?,?,?,?,?,?)').bind(key, id, f.name.slice(0, 200), f.type, f.size, new Date().toISOString()).run();
    await bindings().DB.prepare('CREATE TABLE IF NOT EXISTS asset_fingerprints (asset_id TEXT PRIMARY KEY, digest TEXT NOT NULL)').run();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
    await bindings().DB.prepare('INSERT OR REPLACE INTO asset_fingerprints (asset_id,digest) VALUES (?,?)').bind(key, digest).run();
    return Response.json({ id: key, name: f.name, url: '/api/assets?id=' + key });
}
catch (e) {
    return failure(e);
} }
