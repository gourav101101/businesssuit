'use client';
import { useState } from 'react';
export default function AuthForm({ mode, returnTo = '/overview', localSetup = false }: { mode: 'login'|'setup'|'password'; returnTo?:string; localSetup?:boolean }) {
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
    return <form className="auth-form" onSubmit={async event=>{
        event.preventDefault();setBusy(true);setError('');setMessage('');
        const form=event.currentTarget, fields=Object.fromEntries(new FormData(form));
        try {
            if(mode!=='login' && fields.password!==fields.confirmPassword)throw Error('Passwords do not match.');
            const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,action:mode,returnTo})});
            const result:any=await r.json();if(!r.ok)throw Error(result.error);
            if(mode==='password'){form.reset();setMessage('Password changed. Other sessions were signed out.');}
            else window.location.assign(result.returnTo);
        }catch(e){setError((e as Error).message);}finally{setBusy(false);}
    }}>
        {mode==='setup' && <label className="field">Your name<input name="name" required maxLength={100} autoComplete="name"/></label>}
        {mode!=='password' && <label className="field">Email<input type="email" name="email" required maxLength={254} autoComplete="username"/></label>}
        {mode==='setup' && !localSetup && <label className="field">Setup key<input type="password" name="setupKey" required autoComplete="off"/><small>Use the BOOTSTRAP_TOKEN configured on your server.</small></label>}
        {mode==='password' && <label className="field">Current password<input type="password" name="currentPassword" required autoComplete="current-password"/></label>}
        <label className="field">{mode==='login'?'Password':'New password'}<input type="password" name="password" required minLength={12} maxLength={256} autoComplete={mode==='login'?'current-password':'new-password'}/>{mode!=='login' && <small>Use at least 12 characters. A unique passphrase works well.</small>}</label>
        {mode!=='login' && <label className="field">Confirm password<input type="password" name="confirmPassword" required minLength={12} maxLength={256} autoComplete="new-password"/></label>}
        {error && <p role="alert" className="auth-error">{error}</p>}{message && <p role="status">{message}</p>}
        <button className="btn primary" disabled={busy}>{busy?'Please wait...':mode==='setup'?'Create owner account':mode==='password'?'Change password':'Sign in'}</button>
    </form>;
}
