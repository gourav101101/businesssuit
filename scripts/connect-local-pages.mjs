import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const base = 'http://127.0.0.1:5173';
const pages = [
  ['902764659576860', 'Indore Ki Baat', 'Indore'],
  ['122107097462003978', 'Ujjain AI', 'Ujjain'],
  ['122096380796017642', 'Bhopal Wale', 'Bhopal'],
  ['184643868611480', 'Dewas Se Hai', 'Dewas'],
];
if (process.argv.includes('--configure')) {
  const file = '.dev.vars';
  let content = existsSync(file) ? readFileSync(file, 'utf8') : '';
  function ensure(name, value) {
    const pattern = new RegExp('^' + name + '=.*$', 'm');
    const present = content.match(pattern)?.[0].slice(name.length + 1).trim();
    if (present) return;
    content = pattern.test(content) ? content.replace(pattern, name + '=' + value) : content + '\n' + name + '=' + value;
  }
  ensure('META_API_VERSION', 'v26.0');
  ensure('TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
  ensure('META_APP_ID', '1450719936968274');
  ensure('META_LOGIN_CONFIG_ID', '2177033769915724');
  writeFileSync(file, content.trim() + '\n', { mode: 0o600 });
  console.log('Local Graph API version and encryption key configured; restart the dev server.');
  process.exit();
}
async function local(path, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Cookie: '__sites_local_auth=1', Origin: base, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Local request failed: ' + response.status);
  return result;
}
let input = '';
const tokenFileIndex = process.argv.indexOf('--token-file');
if (tokenFileIndex !== -1) {
  const tokenFile = process.argv[tokenFileIndex + 1];
  if (!tokenFile) throw new Error('Provide the local token file path.');
  connect(readFileSync(tokenFile, 'utf8').trim()).then(() => process.exit(0)).catch(error => {
    console.error(error.message);
    process.exit(1);
  });
} else {
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Ready for User Token on hidden stdin.');
process.stdin.on('data', chunk => {
  input += chunk;
  if (input.includes('\r') || input.includes('\n')) {
    process.stdin.pause();
    connect(input.trim()).then(() => process.exit(0)).catch(error => {
      console.error(error.message);
      process.exit(1);
    });
  }
});
}
async function connect(token) {
  if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
    const response = await fetch('https://graph.facebook.com/' + (process.env.META_API_VERSION || 'v26.0') + '/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET, fb_exchange_token: token }),
      signal: AbortSignal.timeout(25000),
    });
    const exchanged = await response.json();
    if (!response.ok || !exchanged.access_token) {
      throw new Error('Long-lived token exchange failed: ' + (exchanged.error?.message || response.status));
    }
    token = exchanged.access_token;
    console.log(JSON.stringify({ longLivedUserTokenExchange: true, expiresInSeconds: exchanged.expires_in ?? null }));
  }
  const capabilities = await local('/api/integrations');
  if (!capabilities.meta) throw new Error('Server has not loaded the Graph API settings. Restart it first.');
  const { workspaces } = await local('/api/workspace');
  for (const [pageId, expectedName, city] of pages) {
    const response = await fetch('https://graph.facebook.com/v26.0/' + pageId + '?fields=id,name,access_token', {
      headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(25000),
    });
    const page = await response.json();
    if (!response.ok || page.error) throw new Error('Meta request failed for ' + expectedName + ': ' + (page.error?.message || response.status));
    if (!page.access_token || page.id !== pageId) throw new Error('No Page token returned for ' + expectedName);
    let workspace = workspaces.find(w => w.name === expectedName);
    if (!workspace) {
      workspace = await local('/api/workspace', { action: 'createWorkspace', name: expectedName, city });
      workspaces.push({ ...workspace, name: expectedName });
    }
    await local('/api/integrations', { id: workspace.id, pageId, token: page.access_token });
    page.access_token = undefined;
    const health = await local('/api/integrations', { id: workspace.id, action: 'health' });
    console.log(JSON.stringify({ page: page.name, pageId, connected: true, health: health.message }));
  }
  input = '';
}
