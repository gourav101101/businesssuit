import { authEnv, authTables, cookieToken, formatCookie, hasAccounts, isLocalSetup, limitLogin, sessionCookie, sessionUser } from '@/lib/auth-store';
import { digest, hashPassword, safeReturn, sameSecret, verifyPassword } from '@/lib/passwords';
export async function GET() { return Response.json({ setupRequired: !await hasAccounts() },{headers:{'Cache-Control':'no-store'}}); }
export async function POST(req:Request) {
    try {
        if (req.headers.get('origin')!==new URL(req.url).origin) throw new Error('Cross-origin request rejected');
        const e=authEnv(); await authTables();
        if (!import.meta.env.DEV && new URL(req.url).protocol!=='https:') throw new Error('HTTPS is required for login.');
        const raw=await req.text(); if(raw.length>4096) throw new Error('Request too large');
        const b=JSON.parse(raw) as any;
        const reply=(data:any,cookie?:string)=>Response.json(data,{headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
        if (b.action==='logout') {
            await e.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(cookieToken(req.headers))).run();
            return reply({ok:true},formatCookie('',req,0));
        }
        const email=String(b.email||'').trim().toLowerCase();
        await limitLogin('ip:'+(req.headers.get('cf-connecting-ip')||'local'));
        await limitLogin('account:'+email);
        if (b.action==='setup') {
            if (await hasAccounts()) throw new Error('Setup is already complete. Sign in.');
            const local=isLocalSetup(req.headers);
            if (!local && (String(e.BOOTSTRAP_TOKEN||'').length<32 || !await sameSecret(String(b.setupKey||''),String(e.BOOTSTRAP_TOKEN)))) throw new Error('A valid setup key is required.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) throw new Error('Enter a valid email address.');
            const id=crypto.randomUUID(), name=String(b.name||'Owner').trim().slice(0,100);
            const hash=await hashPassword(String(b.password||''));
            const statements=[e.DB.prepare('INSERT INTO auth_bootstrap (id) VALUES (1)'),e.DB.prepare('INSERT INTO auth_users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)').bind(id,email,name,hash,new Date().toISOString())];
            // Migrate the existing owner's local data only during authenticated local setup.
            if(local) statements.push(e.DB.prepare('UPDATE workspaces SET owner=? WHERE owner=?').bind(id,'local_seedy'));
            await e.DB.batch(statements);
            return reply({ok:true,returnTo:'/overview'},await sessionCookie(id,req));
        }
        if (b.action==='password') {
            const user=await sessionUser(req.headers); if(!user) throw new Error('Authentication required');
            const row=await e.DB.prepare('SELECT password_hash FROM auth_users WHERE id=?').bind(user.userId).first<{password_hash:string}>();
            if(!row || !await verifyPassword(String(b.currentPassword||''),row.password_hash))throw new Error('Current password is incorrect.');
            const hash=await hashPassword(String(b.password||''));
            await e.DB.batch([e.DB.prepare('UPDATE auth_users SET password_hash=? WHERE id=?').bind(hash,user.userId),e.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(user.userId)]);
            return reply({ok:true},await sessionCookie(user.userId,req));
        }
        if (b.action!=='login') throw new Error('Unknown account action');
        const user=await e.DB.prepare('SELECT * FROM auth_users WHERE email=?').bind(email).first<{id:string;password_hash:string}>();
        const dummy=`pbkdf2-sha256:100000:${'0'.repeat(64)}:${'0'.repeat(64)}`;
        if (!await verifyPassword(String(b.password||''),user?.password_hash||dummy) || !user) throw new Error('Email or password is incorrect.');
        await e.DB.prepare('DELETE FROM auth_attempts WHERE key=?').bind(await digest('account:'+email)).run();
        await e.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(Date.now()).run();
        return reply({ok:true,returnTo:safeReturn(String(b.returnTo||'/overview'))},await sessionCookie(user.id,req));
    } catch(e) { const error=e instanceof Error?e.message:'Account request failed'; return Response.json({error},{status:/Authentication/.test(error)?401:/Cross-origin/.test(error)?403:/Too many/.test(error)?429:400,headers:{'Cache-Control':'no-store'}}); }
}
