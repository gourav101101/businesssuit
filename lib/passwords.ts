const encoder = new TextEncoder();
export async function digest(value: string) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function randomSecret() { return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join(''); }
export async function sameSecret(a: string, b: string) {
    const [x,y] = await Promise.all([digest(a),digest(b)]);
    let difference=0; for(let i=0;i<x.length;i++) difference |= x.charCodeAt(i)^y.charCodeAt(i);
    return difference===0;
}
export async function hashPassword(password: string, salt = randomSecret()) {
    if (password.length < 12 || password.length > 256) throw new Error('Use a password between 12 and 256 characters.');
    const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
    // Workers Web Crypto permits up to 100,000 PBKDF2 iterations.
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
    return `pbkdf2-sha256:100000:${salt}:${Array.from(new Uint8Array(bits)).map(n=>n.toString(16).padStart(2,'0')).join('')}`;
}
export async function verifyPassword(password: string, stored: string) {
    if (typeof password!=='string' || password.length<12 || password.length>256) return false;
    const [algorithm,iterations,salt] = stored.split(':');
    if (algorithm!=='pbkdf2-sha256' || iterations!=='100000' || !salt) return false;
    return sameSecret(await hashPassword(password,salt),stored);
}
export function safeReturn(value: string) {
    try { const u=new URL(value,'https://newsdesk.invalid'); return value.startsWith('/') && u.origin==='https://newsdesk.invalid' && !['/login','/setup'].includes(u.pathname) ? u.pathname+u.search : '/overview'; } catch { return '/overview'; }
}
