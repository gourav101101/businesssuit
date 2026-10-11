import { access, failure } from '@/lib/server';
import { connection, graph } from '@/lib/meta';
export async function GET(req: Request) {
    try {
        const id = new URL(req.url).searchParams.get('workspace') || '';
        const a = await access(id, ['owner']);
        const c = await connection(id);
        const posts = [];
        for (const p of a.data.posts.filter(p => p.remoteId)) {
            const remote = await graph(`${p.remoteId}?fields=id,is_published,is_hidden,scheduled_publish_time,created_time,from,application&metadata=1`, c.token);
            posts.push({ title: p.title, remote: { ...remote, metadata: remote.metadata?.fields?.map((f: any) => f.name) } });
        }
        return Response.json({ pageId: c.pageId, posts });
    } catch (e) { return failure(e); }
}
