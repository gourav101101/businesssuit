import { access, failure } from '@/lib/server';
import { connection, graph } from '@/lib/meta';
export async function GET(req: Request) { try {
    const id = new URL(req.url).searchParams.get('workspace') || '';
    const a = await access(id);
    const c = await connection(id);
    const results = [];
    for (const p of a.data.posts.filter(p => p.status === 'published' && p.remoteId).slice(-20)) {
        try {
            const d = await graph(`${p.remoteId}?fields=reactions.limit(0).summary(true),comments.limit(0).summary(true),shares`, c.token);
            results.push({ id: p.id, title: p.title, reactions: d.reactions?.summary?.total_count ?? null, comments: d.comments?.summary?.total_count ?? null, shares: d.shares?.count ?? null, error: null });
        }
        catch (e) {
            results.push({ id: p.id, title: p.title, reactions: null, comments: null, shares: null, error: e instanceof Error ? e.message : 'Metrics unavailable' });
        }
    }
    return Response.json({ rows: results, checkedAt: new Date().toISOString(), note: 'Available engagement counts for up to 20 published posts. Missing metrics remain unavailable, not zero.' });
}
catch (e) {
    return failure(e);
} }
