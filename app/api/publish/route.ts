import { access, accessAs, audit, bindings, failure, sameOrigin, save } from '@/lib/server';
import { connection, graph, verifyDelivery } from '@/lib/meta';
import { epoch } from '@/lib/model';
import { captionWarnings } from '@/lib/import';
import { publicationCaption, validatePlace } from '@/lib/bulk-edit';
export async function POST(req: Request) { return runPublish(req); }
export async function runPublish(req: Request, actor?: { userId: string; email: string }) {
    try {
        sameOrigin(req);
        const b = await req.json() as any;
        const a = actor ? await accessAs(b.id, actor, ['owner', 'publisher']) : await access(b.id, ['owner', 'publisher']);
        const c = await connection(b.id);
        const p = a.data.posts.find(p => p.id === b.postId);
        if (!p)
            throw new Error('Post not found');
        if (b.action === 'reconcile') {
            let scheduledAt: number | null = null;
            if (!p.remoteId)
                throw new Error('No remote ID available. Inspect the Page manually; do not blindly retry this delivery.');
            try {
                const remote = await verifyDelivery(c.pageId, p.remoteId, c.token);
                p.status = remote.status;
                p.remoteId = remote.id;
                p.permalink = remote.permalink;
                p.error = '';
                scheduledAt = remote.scheduledAt;
            } catch (error) {
                p.status = 'unknown';
                p.error = error instanceof Error ? error.message : 'Verification failed';
                await save(b.id, a.data, a.w.revision);
                throw error;
            }
            await save(b.id, a.data, a.w.revision);
            await audit(b.id, a.u.email, `Reconciled ${p.title}: ${p.status}`);
            return Response.json({ ok: true, pageId: c.pageId, remoteId: p.remoteId, status: p.status, scheduledAt, permalink: p.permalink });
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
        if (captionWarnings(p.caption).length)
            throw new Error('Replace the placeholder caption before submitting to Facebook.');
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
        validatePlace(p.placeId);
        p.status = 'submitting';
        p.error = '';
        await save(b.id, a.data, a.w.revision);
        try {
            const form = new FormData();
            form.set('source', new Blob([await media.arrayBuffer()], { type: asset.type }), 'post.' + asset.type.split('/')[1]);
            form.set('published', publishNow ? 'true' : 'false');
            if (publishNow) {
                form.set('message', publicationCaption(p));
                if(p.placeId)form.set('place',validatePlace(p.placeId));
            }
            let result = await graph(`${c.pageId}/photos`, c.token, { method: 'POST', body: form });
            if (!publishNow) {
                if (!result.id) throw new Error('Facebook did not return the uploaded image ID.');
                const feed = new URLSearchParams({
                    message: publicationCaption(p),
                    published: 'false',
                    scheduled_publish_time: String(epoch(p)),
                    unpublished_content_type: 'SCHEDULED',
                    attached_media: JSON.stringify([{ media_fbid: result.id }]),
                });
                if(p.placeId)feed.set('place',validatePlace(p.placeId));
                result = await graph(`${c.pageId}/feed`, c.token, { method: 'POST', body: feed });
            }
            p.remoteId = result.post_id || result.id;
            p.status = 'unknown';
            if (p.remoteId) {
                try {
                    const remote = await verifyDelivery(c.pageId, p.remoteId, c.token);
                    p.status = remote.status;
                    p.remoteId = remote.id;
                    p.permalink = remote.permalink;
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
