import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { blankData, type Data } from './model';
export function bindings() { const e = env as unknown as {
    DB: D1Database;
    BUCKET: R2Bucket;
    [key: string]: unknown;
}; if (!e.DB || !e.BUCKET)
    throw new Error('Database or storage is not configured.'); return e; }
export async function identity() { const u = await getChatGPTUser(); if (!u)
    throw new Error('Authentication required'); return u; }
export async function access(id: string, roles: string[] = ['owner', 'editor', 'publisher', 'viewer']) { return accessAs(id, await identity(), roles); }
export async function accessAs(id: string, u: { userId: string; email: string }, roles: string[] = ['owner', 'editor', 'publisher', 'viewer']) { const { DB } = bindings(); const w = await DB.prepare('SELECT * FROM workspaces WHERE id=?').bind(id).first<{
    id: string;
    owner: string;
    data: string;
    revision: number;
    name: string;
}>(); if (!w)
    throw new Error('Workspace not found'); const m = w.owner === u.userId ? { role: 'owner' } : await DB.prepare('SELECT role FROM members WHERE workspace_id=? AND email=?').bind(id, u.email.toLowerCase()).first<{
    role: string;
}>(); if (!m || !roles.includes(m.role))
    throw new Error('This action is not permitted for your role'); return { u, w, role: m.role, data: JSON.parse(w.data) as Data }; }
export function sameOrigin(req: Request) { const origin = req.headers.get('origin'); if (origin && origin !== new URL(req.url).origin)
    throw new Error('Cross-origin request rejected'); }
export async function audit(id: string, actor: string, action: string) { await bindings().DB.prepare('INSERT INTO events (id,workspace_id,actor,action,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), id, actor, action, new Date().toISOString()).run(); }
export async function save(id: string, data: Data, revision: number) { const r = await bindings().DB.prepare('UPDATE workspaces SET data=?,name=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(data), data.brand.name, id, revision).run(); if (!r.meta.changes)
    throw new Error('This workspace changed in another session. Refresh and try again.'); }
export function failure(e: unknown) { const msg = e instanceof Error ? e.message : 'Unexpected error'; return Response.json({ error: msg }, { status: /Authentication/.test(msg) ? 401 : /permitted|Cross-origin/.test(msg) ? 403 : 400 }); }
export async function initial() { const u = await identity(); const { DB } = bindings(); let rows = await DB.prepare('SELECT DISTINCT w.id,w.name,w.owner,w.data,w.revision FROM workspaces w LEFT JOIN members m ON w.id=m.workspace_id WHERE w.owner=? OR m.email=?').bind(u.userId, u.email.toLowerCase()).all(); if (!rows.results.length) {
    const id = crypto.randomUUID();
    await DB.prepare('INSERT INTO workspaces (id,owner,name,data,revision) VALUES (?,?,?,?,0)').bind(id, u.userId, 'My newsroom', JSON.stringify(blankData('My newsroom', ''))).run();
    rows = await DB.prepare('SELECT * FROM workspaces WHERE owner=?').bind(u.userId).all();
} return rows.results; }
