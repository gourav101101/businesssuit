import { bindings } from './server';
async function key() { const secret = bindings().TOKEN_ENCRYPTION_KEY; if (typeof secret !== 'string' || secret.length < 32)
    throw new Error('Configure TOKEN_ENCRYPTION_KEY (at least 32 characters) on the server.'); const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)); return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']); }
export async function encrypt(s: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(s)); return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) }); }
export async function decrypt(s: string) { const { iv, data } = JSON.parse(s); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, await key(), new Uint8Array(data))); }
export async function graph(path: string, token: string, init: RequestInit = {}) { const version = bindings().META_API_VERSION; if (typeof version !== 'string' || !/^v\d+\.\d+$/.test(version))
    throw new Error('Configure a supported META_API_VERSION on the server.'); const r = await fetch(`https://graph.facebook.com/${version}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers }, signal: AbortSignal.timeout(25000) }); const body = await r.json() as any; if (!r.ok || body.error)
    throw new Error(`Meta rejected the request (${body.error?.code || r.status}): ${body.error?.message || 'Request failed'}`); return body; }
export async function connection(id: string) { const c = await bindings().DB.prepare('SELECT * FROM connections WHERE workspace_id=?').bind(id).first<{
    page_id: string;
    encrypted_token: string;
}>(); if (!c)
    throw new Error('Connect a Facebook Page in Integrations first.'); return { pageId: c.page_id, token: await decrypt(c.encrypted_token) }; }
