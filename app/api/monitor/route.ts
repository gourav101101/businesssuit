import { bindings, failure, initial } from '@/lib/server';
export async function GET() {
    try {
        const rows = await initial();
        const pages = rows.map((w: any) => {
            const data = JSON.parse(w.data);
            return { id: w.id, name: w.name, paused: data.paused, queue: data.queue, posts: data.posts.map((p: any) => ({ id: p.id, title: p.title, caption: p.caption, date: p.date, time: p.time, status: p.status, media: p.media, error: p.error })) };
        });
        const groups = new Map<string, any[]>();
        for (const w of pages) for (const p of w.posts) {
            const key = p.caption.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
            if (key.length < 30) continue;
            groups.set(key, [...(groups.get(key) || []), { workspace: w.name, title: p.title, id: p.id }]);
        }
        const duplicates = [...groups.values()].filter(g => g.length > 1);
        const { DB } = bindings();
        await DB.prepare('CREATE TABLE IF NOT EXISTS asset_fingerprints (asset_id TEXT PRIMARY KEY, digest TEXT NOT NULL)').run();
        const imageGroups = new Map<string, any[]>();
        let backfilled = 0;
        const fingerprints = new Map<string, string>();
        for (const w of pages) for (const p of w.posts) if (p.media) {
            let digest = fingerprints.get(p.media);
            if (!digest) {
                const known = await DB.prepare('SELECT digest FROM asset_fingerprints WHERE asset_id=?').bind(p.media).first<{ digest: string }>();
                digest = known?.digest;
                if (!digest && backfilled < 20) {
                    const asset = await DB.prepare('SELECT id FROM assets WHERE id=? AND workspace_id=?').bind(p.media, w.id).first();
                    const object = asset ? await bindings().BUCKET.get(p.media) : null;
                    if (object) {
                        digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await object.arrayBuffer()))).map(n => n.toString(16).padStart(2,'0')).join('');
                        await DB.prepare('INSERT OR REPLACE INTO asset_fingerprints (asset_id,digest) VALUES (?,?)').bind(p.media, digest).run();
                        backfilled++;
                    }
                }
                if (digest) fingerprints.set(p.media, digest);
            }
            if (digest) imageGroups.set(digest, [...(imageGroups.get(digest) || []), { workspace: w.name, title: p.title }]);
        }
        await DB.prepare('CREATE TABLE IF NOT EXISTS api_usage (page_id TEXT PRIMARY KEY, usage TEXT, error TEXT, checked_at TEXT)').run();
        const connections = await DB.prepare('SELECT workspace_id,page_id FROM connections').all<any>();
        const allowed = new Set(pages.map((p: any) => p.id));
        const usage = [];
        for (const c of connections.results) if (allowed.has(c.workspace_id)) {
            const row = await DB.prepare('SELECT * FROM api_usage WHERE page_id=?').bind(c.page_id).first();
            if (row) usage.push({ workspace: c.workspace_id, ...row });
        }
        return Response.json({ pages, duplicates, imageDuplicates: [...imageGroups.values()].filter(g => g.length > 1), usage });
    } catch (e) { return failure(e); }
}
