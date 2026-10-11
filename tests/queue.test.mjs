import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function harness({ outcome = 'scheduled', hold = false } = {}) {
    let revision = 0, calls = 0, release;
    let data = { posts: [{ id: 'p', status: 'planned', approvedVersion: 1, version: 1, media: 'image', caption: 'A complete factual caption', date: '2099-01-01', time: '07:30' }], paused: false, queue: { ids: ['p'], updatedAt: '' } };
    const server = {
        sameOrigin() {}, audit: async () => {},
        access: async () => ({ data: structuredClone(data), w: { revision }, u: { email: 'test@example.com' } }),
        save: async (_, next, expected) => { if (expected !== revision) throw Error('Revision conflict'); data = structuredClone(next); revision++; },
        failure: e => Response.json({ error: e.message }, { status: 400 }),
    };
    const publishing = { runPublish: async () => {
        calls++;
        if (hold) await new Promise(resolve => { release = resolve; });
        data.posts[0].status = outcome;
        revision++;
        return Response.json({ ok: true });
    } };
    const code = ts.transpileModule(fs.readFileSync(new URL('../app/api/queue/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    new Function('exports', 'require', code)(exports, path => {
        if (path === '@/lib/server') return server;
        if (path === '@/lib/model') return { epoch: () => Date.now() / 1000 + 7200 };
        if (path === '@/lib/import') return { captionWarnings: () => [] };
        if (path === '@/lib/meta') return { connection: async () => ({ pageId: 'page' }) };
        if (path === '../publish/route') return publishing;
        throw Error(path);
    });
    return { run: action => exports.POST(new Request('http://localhost/api/queue', { method: 'POST', body: JSON.stringify({ id: 'w', action }) })), get data() { return data; }, get calls() { return calls; }, release: () => release() };
}

test('concurrent ticks submit a queue item only once', async () => {
    const h = harness({ hold: true });
    const first = h.run('tick');
    while (!h.calls) await new Promise(resolve => setImmediate(resolve));
    const second = await h.run('tick');
    assert.equal((await second.json()).inFlight, 'p');
    assert.equal(h.calls, 1);
    h.release(); await first;
    assert.equal(h.data.posts[0].status, 'scheduled');
    assert.equal(h.data.queue.inFlight, undefined);
    assert.deepEqual(h.data.queue.ids, []);
});

test('uncertain delivery stops the queue without an automatic retry', async () => {
    const h = harness({ outcome: 'unknown' });
    await h.run('tick');
    assert.ok(h.data.queue.stopped);
    await h.run('tick');
    assert.equal(h.calls, 1);
});

test('clearing pending work does not cancel a remote schedule', async () => {
    const h = harness();
    await h.run('clear');
    assert.equal(h.calls, 0);
    assert.equal(h.data.posts[0].status, 'planned');
    assert.deepEqual(h.data.queue.ids, []);
});
