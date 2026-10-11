import { audit, bindings, failure, identity, sameOrigin } from '@/lib/server';
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const user = await identity();
        const { action } = await req.json() as { action: string };
        if (action !== 'archiveDemo') throw new Error('Unknown maintenance action');
        const { DB } = bindings();
        await DB.prepare('CREATE TABLE IF NOT EXISTS workspace_archives (id TEXT PRIMARY KEY, owner TEXT, name TEXT, data TEXT, revision INTEGER, archived_at TEXT)').run();
        const rows = await DB.prepare('SELECT * FROM workspaces WHERE owner=?').bind(user.userId).all<any>();
        const names = [];
        for (const w of rows.results) {
            if (!/^QA (Editorial|Other City) \d+$/.test(w.name)) continue;
            const data = JSON.parse(w.data);
            if (data.posts.some((p: any) => p.remoteId || ['scheduled','published','submitting','unknown'].includes(p.status))) continue;
            if (await DB.prepare('SELECT workspace_id FROM connections WHERE workspace_id=?').bind(w.id).first()) continue;
            await DB.batch([
                DB.prepare('INSERT OR IGNORE INTO workspace_archives (id,owner,name,data,revision,archived_at) VALUES (?,?,?,?,?,?)').bind(w.id,w.owner,w.name,w.data,w.revision,new Date().toISOString()),
                DB.prepare('DELETE FROM workspaces WHERE id=? AND owner=? AND revision=?').bind(w.id,user.userId,w.revision),
            ]);
            await audit(w.id,user.email,'Archived QA workspace; data and assets retained for recovery');
            names.push(w.name);
        }
        return Response.json({ archived: names });
    } catch(e) { return failure(e); }
}
