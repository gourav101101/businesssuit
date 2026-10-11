import { access, accessAs, audit, failure, sameOrigin, save } from '@/lib/server';
import { epoch } from '@/lib/model';
import { captionWarnings } from '@/lib/import';
import { connection } from '@/lib/meta';
import { runPublish as publish } from '../publish/route';

export async function POST(req: Request) { return runQueue(req); }
export async function runQueue(req: Request, actor?: { userId: string; email: string }) {
    try {
        sameOrigin(req);
        const b = await req.json() as { id: string; action: string; ids?: string[] };
        const a = actor ? await accessAs(b.id, actor, ['owner', 'publisher']) : await access(b.id, ['owner', 'publisher']);
        if (b.action === 'enqueue') {
            if (a.data.queue?.inFlight) throw new Error('A submission is in flight. Verify its delivery before starting another batch.');
            if (a.data.paused) throw new Error('Resume submissions before adding to the queue.');
            const ids = [...new Set(b.ids || [])];
            const destination = await connection(b.id);
            if (a.data.queue?.ids.length && a.data.queue.pageId !== destination.pageId) throw new Error('The connected Page changed. Clear the pending queue before submitting to another Page.');
            if (!ids.length) throw new Error('Select approved posts.');
            for (const id of ids) {
                const p = a.data.posts.find(p => p.id === id);
                if (!p || !['approved', 'planned'].includes(p.status) || p.version !== p.approvedVersion || !p.media || !p.caption.trim() || captionWarnings(p.caption).length)
                    throw new Error('Every queued post must have an image and a complete, approved caption.');
                const lead = epoch(p) - Date.now() / 1000;
                if (!Number.isFinite(lead) || lead < 1200 || lead > 29 * 86400) throw new Error('Queue times must be 20 minutes to 29 days ahead.');
            }
            a.data.queue = { ids: [...new Set([...(a.data.queue?.ids || []), ...ids])], pageId: destination.pageId, updatedAt: new Date().toISOString() };
            await save(b.id, a.data, a.w.revision);
            await audit(b.id, a.u.email, `Queued ${ids.length} Facebook schedules`);
            return Response.json({ ok: true, remaining: a.data.queue.ids.length });
        }
        if (b.action === 'clear') {
            if (a.data.queue?.inFlight) throw new Error('A submission is in flight; verify it before clearing the queue.');
            a.data.queue = { ids: [], updatedAt: new Date().toISOString() };
            await save(b.id, a.data, a.w.revision);
            return Response.json({ ok: true });
        }
        if (b.action === 'resume') {
            if (a.data.queue?.inFlight) {
                const p = a.data.posts.find(p => p.id === a.data.queue?.inFlight);
                if (!p || !['scheduled', 'published', 'cancelled'].includes(p.status)) throw new Error('Verify the interrupted delivery before resuming.');
            }
            if (a.data.queue) { delete a.data.queue.stopped; delete a.data.queue.inFlight; }
            await save(b.id, a.data, a.w.revision);
            return Response.json({ ok: true });
        }
        if (b.action !== 'tick') throw new Error('Unknown queue action');
        if (a.data.paused || a.data.queue?.stopped) return Response.json({ ok: true, paused: true });
        if (a.data.queue?.inFlight) return Response.json({ ok: true, inFlight: a.data.queue.inFlight });
        const postId = a.data.queue?.ids[0];
        if (postId) {
            const destination = await connection(b.id);
            if (a.data.queue?.pageId && a.data.queue.pageId !== destination.pageId) throw new Error('The queued destination differs from the connected Page. Clear the queue and review the destination.');
            // Claim before external work. Optimistic revision prevents concurrent runners
            // from submitting the same item. A crash requires reconciliation, not retry.
            a.data.queue!.ids.shift();
            a.data.queue!.inFlight = postId;
            a.data.queue!.updatedAt = new Date().toISOString();
            await save(b.id, a.data, a.w.revision);
            const r = await publish(new Request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify({ id: b.id, postId, action: 'schedule' }) }), actor);
            const result = await r.json() as any;
            const fresh = actor ? await accessAs(b.id, actor, ['owner', 'publisher']) : await access(b.id, ['owner', 'publisher']);
            const p = fresh.data.posts.find(p => p.id === postId);
            if (!r.ok || p?.status !== 'scheduled') {
                fresh.data.queue = { ids: fresh.data.queue?.ids || [], pageId: fresh.data.queue?.pageId, stopped: p?.error || result.error || 'Delivery is uncertain. Verify the affected post before resuming.', updatedAt: new Date().toISOString() };
            }
            if (fresh.data.queue) delete fresh.data.queue.inFlight;
            await save(b.id, fresh.data, fresh.w.revision);
            return Response.json({ ok: true, status: p?.status, remaining: fresh.data.queue?.ids.length || 0 });
        }
        // Only one due verification per tick, avoiding a burst of read requests.
        const due = a.data.posts.find(p => p.remoteId && ['scheduled', 'unknown'].includes(p.status) && epoch(p) < Date.now() / 1000 && (!p.updatedAt || Date.parse(p.updatedAt) < Date.now() - 300000));
        if (due) {
            due.updatedAt = new Date().toISOString();
            await save(b.id, a.data, a.w.revision);
            return publish(new Request(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify({ id: b.id, postId: due.id, action: 'reconcile' }) }), actor);
        }
        return Response.json({ ok: true, idle: true });
    } catch (e) { return failure(e); }
}
