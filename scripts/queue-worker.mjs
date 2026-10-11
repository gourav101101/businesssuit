import fs from 'node:fs';
const file = new URL('../.dev.vars', import.meta.url);
const local = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const secret = process.env.CRON_SECRET || local.match(/^CRON_SECRET\s*=\s*["']?([a-f0-9]{64})["']?\s*$/m)?.[1];
const base = new URL(process.env.NEWSDESK_URL || 'http://127.0.0.1:5173');
if (!secret || secret.length < 32) throw Error('Configure CRON_SECRET in .dev.vars or the process environment.');
if (base.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(base.hostname)) throw Error('Remote queue workers require HTTPS.');
console.log('Newsdesk background runner active. Keep this process and the app server running.');
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
while (!stopping) {
    try {
        const response = await fetch(new URL('/api/jobs', base), { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(240000) });
        if (!response.ok) console.log(`Background check failed (${response.status}). Check the server and CRON_SECRET.`);
        else {
            const result = await response.json();
            if (result.results?.some(r => r.status === 'reconnect_required')) console.log('A Page needs Facebook reconnection. Open Integrations.');
        }
    } catch { console.log('Waiting for the Newsdesk server.'); }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, 10000));
}
