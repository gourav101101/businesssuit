import { access, audit, bindings, failure, sameOrigin, save } from '@/lib/server';
import { connection, graph } from '@/lib/meta';
import { epoch } from '@/lib/model';
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const b = await req.json() as any;
        const a = await access(b.id, ['owner', 'publisher']);
        const c = await connection(b.id);
        const p = a.data.posts.find(p => p.id === b.postId);
        if (!p)
            throw new Error('Post not found');
        if (b.action === 'reconcile') {
            if (!p.remoteId)
                throw new Error('No remote ID available. Inspect the Page manually; do not blindly retry this delivery.');
            const remote = await graph(`${p.remoteId}?fields=id,is_published,permalink_url`, c.token);
            p.status = remote.is_published ? 'published' : 'scheduled';
            p.permalink = remote.permalink_url || '';
            p.error = '';
            await save(b.id, a.data, a.w.revision);
            await audit(b.id, a.u.email, `Reconciled ${p.title}: ${p.status}`);
            return Response.json({ ok: true });
        }
        if (b.action === 'cancel') {
            if (p.status !== 'scheduled' || !p.remoteId)
                throw new Error('Only confirmed scheduled posts can be cancelled here.');
            await graph(p.remoteId, c.token, { method: 'DELETE' });
            p.status = 'cancelled';
            p.remoteId = undefined;
            await save(b.id, a.data, a.w.revision);
            await audit(b.id, a.u.email, `Cancelled remote schedule: ${p.title}`);
            return Response.json({ ok: true });
        }
        if (a.data.paused)
            throw new Error('Submissions are paused');
        if (!['planned', 'approved'].includes(p.status) || p.approvedVersion !== p.version)
            throw new Error('Approve the current post version before submission');
        if (!p.media || !p.caption)
            throw new Error('Image and caption are required');
        const publishNow = b.action === 'now';
        if (!publishNow) {
            const lead = epoch(p) - Date.now() / 1000;
            if (!Number.isFinite(lead) || lead < 1200 || lead > 29 * 86400)
                throw new Error('This application accepts native schedules 20 minutes to 29 days ahead. Change the time or explicitly choose Publish now.');
        }
        const asset = await bindings().DB.prepare('SELECT id,type FROM assets WHERE id=? AND workspace_id=?').bind(p.media, b.id).first<{
            id: string;
            type: string;
        }>();
        if (!asset || !asset.type.startsWith('image/'))
            throw new Error('Choose an image asset from this workspace');
        const media = await bindings().BUCKET.get(asset.id);
        if (!media)
            throw new Error('Image file unavailable');
        p.status = 'submitting';
        p.error = '';
        await save(b.id, a.data, a.w.revision);
        try {
            const form = new FormData();
            form.set('source', new Blob([await media.arrayBuffer()], { type: asset.type }), 'post.' + asset.type.split('/')[1]);
            form.set('message', p.caption);
            form.set('published', publishNow ? 'true' : 'false');
            if (!publishNow)
                form.set('scheduled_publish_time', String(epoch(p)));
            const result = await graph(`${c.pageId}/photos`, c.token, { method: 'POST', body: form });
            p.remoteId = result.post_id || result.id;
            p.status = publishNow ? 'unknown' : 'scheduled';
            if (p.remoteId) {
                try {
                    const remote = await graph(`${p.remoteId}?fields=id,is_published,permalink_url`, c.token);
                    p.status = remote.is_published ? 'published' : publishNow ? 'unknown' : 'scheduled';
                    p.permalink = remote.permalink_url || '';
                }
                catch {
                    p.error = 'Submission accepted; publication verification is pending.';
                }
            }
            else {
                p.status = 'unknown';
                p.error = 'No usable remote ID returned; inspect Facebook before retrying.';
            }
        }
        catch (err) {
            p.status = 'unknown';
            p.error = err instanceof Error ? err.message : 'Outcome uncertain; reconcile before retrying.';
        }
        await save(b.id, a.data, a.w.revision + 1);
        await audit(b.id, a.u.email, `Facebook submission ${p.status}: ${p.title}`);
        return Response.json({ ok: true, message: p.error || 'Facebook accepted the submission' });
    }
    catch (e) {
        return failure(e);
    }
}
