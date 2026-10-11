import { env } from 'cloudflare:workers';
import { digest, randomSecret } from './passwords';
export function authEnv() { return env as unknown as { DB: D1Database; [key: string]: unknown }; }
export async function authTables() {
    const { DB } = authEnv();
    await DB.batch([
        DB.prepare('CREATE TABLE IF NOT EXISTS auth_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)'),
        DB.prepare('CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)'),
        DB.prepare('CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL)'),
        DB.prepare('CREATE TABLE IF NOT EXISTS auth_bootstrap (id INTEGER PRIMARY KEY CHECK(id=1))'),
    ]);
}
export async function hasAccounts() { await authTables(); return !!await authEnv().DB.prepare('SELECT id FROM auth_users LIMIT 1').first(); }
export function cookieToken(headers: Headers) {
    const match = (headers.get('cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-newsdesk_session=') || s.startsWith('newsdesk_session='));
    return match?.slice(match.indexOf('=')+1) || '';
}
export async function sessionUser(headers: Headers) {
    const token = cookieToken(headers); if (!/^[a-f0-9]{64}$/.test(token)) return null;
    await authTables();
    const u = await authEnv().DB.prepare('SELECT u.id,u.email,u.name FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<{id:string;email:string;name:string}>();
    return u ? {userId:u.id,email:u.email,displayName:u.name,fullName:u.name} : null;
}
export function isLocalSetup(headers: Headers) {
    return import.meta.env.DEV && (!authEnv().AUTH_MODE || authEnv().AUTH_MODE==='local') && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(headers.get('host')||'') && (headers.get('oai-authenticated-user-local-setup')==='1'||headers.get('oai-authenticated-user-id')==='local_seedy');
}
export async function sessionCookie(userId:string, req:Request) {
    const token=randomSecret(); const lifetime=7*86400;
    await authEnv().DB.prepare('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),userId,Date.now()+lifetime*1000).run();
    return formatCookie(token,req,lifetime);
}
export function formatCookie(token:string,req:Request,age:number) {
    const secure=new URL(req.url).protocol==='https:';
    return `${secure?'__Host-newsdesk_session':'newsdesk_session'}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
}
export async function limitLogin(key:string) {
    const {DB}=authEnv(), now=Date.now();
    const hashed=await digest(key);
    await DB.prepare('INSERT INTO auth_attempts (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END').bind(hashed,now+15*60000,now,now).run();
    const row=await DB.prepare('SELECT attempts FROM auth_attempts WHERE key=?').bind(hashed).first<{attempts:number}>();
    if ((row?.attempts||0)>10) throw new Error('Too many attempts. Wait 15 minutes and try again.');
}
