import { access, audit, bindings, failure, identity, initial, sameOrigin, save } from '@/lib/server';
import { blankData, freshPost, distribute, epoch } from '@/lib/model';
import { captionWarnings } from '@/lib/import';
import { healthTable } from '@/lib/token-health';
import { applyBulk, validatePlace, previewBulk } from '@/lib/bulk-edit';
export async function GET(req: Request) { try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id)
        return Response.json({ workspaces: (await initial()).map(r => ({ id: r.id, name: r.name })) });
    const a = await access(id);
    const { DB } = bindings();
    await healthTable();
    const storedHealth=await DB.prepare('SELECT result FROM connection_health WHERE workspace_id=?').bind(id).first<{result:string}>();
    const [members, events, assets, connection] = await Promise.all([DB.prepare('SELECT id,email,role FROM members WHERE workspace_id=?').bind(id).all(), DB.prepare('SELECT * FROM events WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all(), DB.prepare('SELECT id,name,type,size,created_at FROM assets WHERE workspace_id=? ORDER BY created_at DESC').bind(id).all(), DB.prepare('SELECT page_id,page_name FROM connections WHERE workspace_id=?').bind(id).first()]);
    return Response.json({ data: a.data, revision: a.w.revision, role: a.role, members: members.results, events: events.results, assets: assets.results, connection, health: storedHealth ? JSON.parse(storedHealth.result) : null });
}
catch (e) {
    return failure(e);
} }
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const b = await req.json() as any;
        if (b.action === 'createWorkspace') {
            const u = await identity();
            const id = crypto.randomUUID();
            const name = String(b.name || 'New workspace').slice(0, 100);
            await bindings().DB.prepare('INSERT INTO workspaces (id,owner,name,data,revision) VALUES (?,?,?,?,0)').bind(id, u.userId, name, JSON.stringify(blankData(name, String(b.city || 'City')))).run();
            return Response.json({ id });
        }
        const roles = b.action === 'brand' || b.action === 'member' || b.action === 'removeMember' ? ['owner'] : b.action === 'approve' || b.action === 'plan' || b.action === 'pause' ? ['owner', 'publisher'] : ['owner', 'editor', 'publisher'];
        const a = await access(b.id, roles);
        if (b.revision !== a.w.revision)
            throw new Error('Workspace changed. Refresh before saving.');
        const d = a.data;
        let message = '';
        if (d.posts.some(p => p.status === 'submitting'))
            throw new Error('A delivery is being submitted. Reconcile that delivery before further changes.');
        if (b.action === 'import' || b.action === 'edit') {
            const candidates = b.action === 'import' ? b.posts : [b.post];
            if (!Array.isArray(candidates))
                throw new Error('Invalid post payload');
            for (const p of candidates) {
                for (const field of ['media', 'sourceMedia']) {
                    if (p[field]) {
                        const asset = await bindings().DB.prepare('SELECT type FROM assets WHERE id=? AND workspace_id=?').bind(p[field], b.id).first<{
                            type: string;
                        }>();
                        if (!asset)
                            throw new Error('Selected asset is not in this workspace');
                        if (field === 'media' && !asset.type.startsWith('image/'))
                            throw new Error('Publication media must be an image');
                    }
                }
            }
        }
        if (b.action === 'import') {
            if (!Array.isArray(b.posts) || b.posts.length < 1 || b.posts.length > 100)
                throw new Error('Import 1–100 posts at a time.');
            for (const p of b.posts) {
                if (!String(p.caption || '').trim() && !String(p.title || '').trim())
                    throw new Error('Every post needs a title or caption.');
                d.posts.push(freshPost({ title: String(p.title || p.caption?.split('\n')[0] || 'Imported story').slice(0, 150), caption: String(p.caption || '').slice(0, 20000), location: String(p.location||'').replace(/[\r\n]/g,' ').slice(0,160), placeId: validatePlace(p.placeId), media: String(p.media || ''), sourceMedia: String(p.sourceMedia || ''), source: String(p.source || ''), sourceDate: String(p.sourceDate || ''), sourcePage: String(p.sourcePage || ''), date: String(p.date || ''), time: String(p.time || ''), category: String(p.category || 'City news'), template: ['editorial', 'minimal', 'bulletin'].includes(p.template) ? p.template : 'editorial', color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : d.brand.color }));
            }
            message = `Imported ${b.posts.length} draft posts`;
        }
        else if (b.action === 'edit') {
            if(b.post.placeId!==undefined)b.post.placeId=validatePlace(b.post.placeId);
            if(b.post.location!==undefined && (typeof b.post.location!=='string'||b.post.location.length>160||/[\r\n]/.test(b.post.location)))throw new Error('Location must be one line, up to 160 characters.');
            const p = d.posts.find(p => p.id === b.post.id);
            if (!p)
                throw new Error('Post not found');
            if (['scheduled', 'submitting', 'published', 'unknown'].includes(p.status))
                throw new Error('Reconcile or cancel the remote delivery before editing. Published posts can be corrected by creating a new draft.');
            p.history.unshift({ at: new Date().toISOString(), title: p.title, caption: p.caption, version: p.version });
            p.history = p.history.slice(0, 20);
            for (const k of ['title', 'caption', 'category', 'media', 'sourceMedia', 'source', 'sourceDate', 'sourcePage', 'date', 'time', 'template', 'color', 'location', 'placeId'] as const)
                if (typeof b.post[k] === 'string')
                    p[k] = b.post[k].slice(0, k === 'caption' ? 20000 : 1000);
            p.version++;
            p.status = 'review';
            p.approvedVersion = undefined;
            p.updatedAt = new Date().toISOString();
            message = `Edited ${p.title}; approval reset`;
        }
        else if (b.action === 'reorder') {
            const from = d.posts.findIndex(p => p.id === b.from), to = d.posts.findIndex(p => p.id === b.to);
            if (from < 0 || to < 0)
                throw new Error('Story not found');
            const [p] = d.posts.splice(from, 1);
            d.posts.splice(to, 0, p);
            message = 'Reordered library. Existing schedule times are unchanged.';
        }
        else if (b.action === 'bulkEdit') {
            const options=b.options || {suffix:String(b.text||'')};
            for(const value of Object.values(options))if(typeof value!=='string')throw new Error('Bulk values must be text.');
            const result=applyBulk(d.posts,b.ids,options);
            d.posts=result.posts;
            if(d.queue) d.queue.ids=d.queue.ids.filter(id=>!b.ids.includes(id));
            message = `Updated ${result.changed} posts; changed posts need approval again. Selected posts removed from pending queue.`;
        }
        else if (b.action === 'copy') {
            if (b.target === b.id)
                throw new Error('Choose another workspace');
            const target = await access(b.target, ['owner', 'editor', 'publisher']);
            const copiedAssets: Record<string, string> = {};
            for (const p of d.posts.filter(p => b.ids.includes(p.id))) {
                const copy = freshPost({ ...p, id: crypto.randomUUID(), status: 'draft', version: 1, approvedVersion: undefined, remoteId: undefined, permalink: undefined, error: undefined, history: [] });
                for (const field of ['media', 'sourceMedia'] as const) {
                    if (!p[field])
                        continue;
                    if (!copiedAssets[p[field]]) {
                        const asset = await bindings().DB.prepare('SELECT * FROM assets WHERE id=? AND workspace_id=?').bind(p[field], b.id).first<any>();
                        if (!asset)
                            throw new Error('Source image not found');
                        const object = await bindings().BUCKET.get(asset.id);
                        if (!object)
                            throw new Error('Source file unavailable');
                        const key = crypto.randomUUID();
                        await bindings().BUCKET.put(key, object.body, { httpMetadata: { contentType: asset.type } });
                        await bindings().DB.prepare('INSERT INTO assets (id,workspace_id,name,type,size,created_at) VALUES (?,?,?,?,?,?)').bind(key, b.target, asset.name, asset.type, asset.size, new Date().toISOString()).run();
                        copiedAssets[p[field]] = key;
                    }
                    copy[field] = copiedAssets[p[field]];
                }
                target.data.posts.push(copy);
            }
            await save(b.target, target.data, target.w.revision);
            await audit(b.target, a.u.email, 'Copied city stories as drafts');
            message = 'Copied stories to ' + target.data.brand.name + ' as drafts';
        }
        else if (b.action === 'delete') {
            const ids = new Set(b.ids);
            if (d.posts.some(p => ids.has(p.id) && ['scheduled', 'published', 'unknown', 'submitting'].includes(p.status)))
                throw new Error('Remote deliveries must be resolved before deletion.');
            d.posts = d.posts.filter(p => !ids.has(p.id));
            message = `Deleted ${ids.size} drafts`;
        }
        else if (b.action === 'review') {
            for (const p of d.posts)
                if (b.ids.includes(p.id) && ['draft', 'failed', 'cancelled'].includes(p.status))
                    p.status = 'review';
            message = 'Sent posts for review';
        }
        else if (b.action === 'approve') {
            for (const p of d.posts.filter(p => b.ids.includes(p.id))) {
                if (!['draft', 'review', 'approved'].includes(p.status))
                    throw new Error('Only drafts and review posts can be approved');
                if (!p.caption.trim())
                    throw new Error('Add a complete caption before approval: ' + p.title);
                if (!p.media)
                    throw new Error('Select an image before approval: ' + p.title);
                if (captionWarnings(p.caption).length)
                    throw new Error('Replace the placeholder caption with the complete story before approval: ' + p.title);
                p.status = 'approved';
                p.approvedVersion = p.version;
            }
            message = `Approved ${b.ids.length} posts`;
        }
        else if (b.action === 'plan') {
            const selected = d.posts.filter(p => b.ids.includes(p.id));
            if (!selected.length)
                throw new Error('Select approved posts');
            const slots = distribute(selected.length, b.start, b.end);
            selected.forEach((p, i) => { if (!['approved', 'planned'].includes(p.status) || p.version !== p.approvedVersion)
                throw new Error('Approve the current version of every selected post first.'); p.date = b.date; p.time = slots[i]; if (!Number.isFinite(epoch(p)) || epoch(p) <= Date.now() / 1000)
                throw new Error('Schedule must be in the future.'); p.status = 'planned'; });
            message = `Planned ${selected.length} posts locally`;
        }
        else if (b.action === 'unschedule') {
            for (const p of d.posts)
                if (b.ids.includes(p.id) && p.status === 'planned')
                    p.status = 'approved';
            message = 'Removed local schedules';
        }
        else if (b.action === 'pause') {
            d.paused = Boolean(b.paused);
            message = d.paused ? 'Local submissions paused. Existing Meta schedules are unchanged.' : 'Local submissions resumed';
        }
        else if (b.action === 'savePreset') {
            const name=String(b.name||'').trim();
            if(!name||name.length>60)throw new Error('Preset name must be 1–60 characters.');
            const options:Record<string,string>={};
            for(const key of ['location','placeId','category','prefix','suffix'])if(b.options?.[key]!==undefined){if(typeof b.options[key]!=='string'||b.options[key].length>2000)throw new Error('Preset fields must be text up to 2,000 characters.');options[key]=b.options[key];}
            if(!Object.keys(options).length)throw new Error('Add a location, category or caption text first.');
            previewBulk(freshPost(),options);
            const presets=d.presets||[];
            if(presets.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error('That preset name already exists. Use another name or remove the old preset.');
            if(presets.length>=20)throw new Error('This workspace supports up to 20 presets.');
            d.presets=[...presets,{id:crypto.randomUUID(),name,options}];
            message='Saved workspace preset. No posts changed.';
        }
        else if(b.action==='deletePreset') {
            d.presets=(d.presets||[]).filter(p=>p.id!==b.presetId);
            message='Removed preset. Posts are unchanged.';
        }
        else if (b.action === 'brand') {
            for (const k of ['name', 'city', 'color', 'initials', 'disclaimer', 'start', 'end', 'logo'] as const)
                if (typeof b.brand[k] === 'string')
                    d.brand[k] = b.brand[k].slice(0, 1500);
            message = 'Updated brand settings';
        }
        else if (b.action === 'member') {
            const email = String(b.email).trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['editor', 'publisher', 'viewer'].includes(b.role))
                throw new Error('Enter a valid email and role');
            if (email === a.u.email.toLowerCase())
                throw new Error('The owner already has full access');
            const existing = await bindings().DB.prepare('SELECT id FROM members WHERE workspace_id=? AND email=?').bind(b.id, email).first<{
                id: string;
            }>();
            if (existing)
                await bindings().DB.prepare('UPDATE members SET role=? WHERE id=?').bind(b.role, existing.id).run();
            else
                await bindings().DB.prepare('INSERT INTO members (id,workspace_id,email,role) VALUES (?,?,?,?)').bind(crypto.randomUUID(), b.id, email, b.role).run();
            message = `Granted ${b.role} role to ${email}. Site sharing must also allow their account.`;
        }
        else if (b.action === 'removeMember') {
            await bindings().DB.prepare('DELETE FROM members WHERE id=? AND workspace_id=?').bind(b.memberId, b.id).run();
            message = 'Removed workspace member';
        }
        else
            throw new Error('Unknown action');
        await save(b.id, d, a.w.revision);
        await audit(b.id, a.u.email, message);
        return Response.json({ ok: true, message });
    }
    catch (e) {
        return failure(e);
    }
}
