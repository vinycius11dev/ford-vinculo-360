const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { runInNewContext } = require('node:vm');
const mobileRequire = createRequire(resolve(__dirname, '../apps/mobile/package.json'));
const ts = mobileRequire('typescript');
const source = ts.transpileModule(readFileSync(resolve(__dirname, '../apps/mobile/src/session.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(os, fetcher, stored) {
  const storage = new Map(stored ? [['ford360_session', JSON.stringify(stored)]] : []);
  const calls = [];
  const removed = [];
  const exports = {};
  runInNewContext(source, {
    exports, process: { env: {} }, AbortController, setTimeout, clearTimeout,
    location: { hostname: '127.0.0.1' },
    localStorage: { removeItem: (key) => removed.push(key) },
    fetch: async (url, options) => { calls.push({ url, options }); return fetcher(url, options); },
    require(name) {
      if (name === 'react-native') return { Platform: { OS: os } };
      if (name === 'expo-secure-store') return {
        getItemAsync: async (key) => storage.get(key),
        setItemAsync: async (key, value) => { storage.set(key, value); },
        deleteItemAsync: async (key) => { storage.delete(key); },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { api: exports, storage, calls, removed };
}
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const session = (suffix) => ({ accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}`, user: { fullName: 'Teste', email: 'teste@example.test' } });

test('native login stores only the refresh token and normalizes email', async () => {
  const h = harness('android', () => reply(session('one')));
  await h.api.signIn(' TESTE@EXAMPLE.TEST ', 'password');
  assert.deepEqual(JSON.parse(h.storage.get('ford360_session')), { refreshToken: 'refresh-one' });
  assert.equal(h.calls[0].url, 'http://10.0.2.2:3000/api/v1/auth/mobile/login');
  assert.equal(JSON.parse(h.calls[0].options.body).email, 'teste@example.test');
  assert.equal(h.calls[0].options.credentials, 'omit');
});

test('web login uses app cookies and removes legacy localStorage tokens', async () => {
  const h = harness('web', () => reply(session('one')));
  await h.api.signIn('teste@example.test', 'password');
  assert.ok(h.calls[0].url.endsWith('/auth/app/login'));
  assert.equal(h.calls[0].options.credentials, 'include');
  assert.deepEqual(h.removed, ['ford360_session']);
  assert.equal(h.storage.size, 0);
});

test('web restore rotates the owner cookie without exposing a refresh token', async () => {
  const h = harness('web', (url, options) => {
    assert.ok(url.endsWith('/auth/app/refresh'));
    assert.equal(options.credentials, 'include');
    assert.equal(options.body, undefined);
    return reply({ accessToken: 'access-two', user: session('two').user });
  });
  const restored = await h.api.restoreSession();
  assert.equal(restored.accessToken, 'access-two');
  assert.equal(restored.refreshToken, undefined);
  assert.deepEqual(h.removed, ['ford360_session']);
});

test('parallel expired requests share a single refresh and retry with the new token', async () => {
  let rotations = 0;
  const h = harness('android', async (url, options) => {
    if (url.endsWith('/login')) return reply(session('one'));
    if (url.endsWith('/refresh')) { rotations++; await new Promise((resolve) => setTimeout(resolve, 10)); return reply(session('two')); }
    return options.headers.Authorization === 'Bearer access-two' ? reply({ ok: true }) : reply({}, 401);
  });
  await h.api.signIn('teste@example.test', 'password');
  const results = await Promise.all(Array.from({ length: 8 }, () => h.api.request('/vehicles', 'access-one')));
  assert.ok(results.every((result) => result.ok));
  assert.equal(rotations, 1);
});

test('temporary network failure preserves native refresh credentials', async () => {
  const h = harness('ios', () => { throw new Error('offline'); }, { refreshToken: 'saved' });
  await assert.rejects(h.api.restoreSession(), /conectar/);
  assert.equal(JSON.parse(h.storage.get('ford360_session')).refreshToken, 'saved');
});

test('revoked refresh clears native storage and notifies subscribers', async () => {
  const h = harness('ios', () => reply({}, 401), { refreshToken: 'revoked' });
  const notices = [];
  h.api.subscribeSession((value) => notices.push(value));
  assert.equal(await h.api.restoreSession(), null);
  assert.equal(h.storage.size, 0);
  assert.deepEqual(notices, [null]);
});

test('logout during rotation revokes the newly issued refresh token', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness('android', async (url) => {
    if (url.endsWith('/refresh')) { await gate; return reply(session('two')); }
    return reply({ ok: true });
  }, { refreshToken: 'one' });
  const pending = h.api.restoreSession();
  const logout = h.api.signOut();
  release();
  await Promise.all([pending, logout]);
  const call = h.calls.find(({ url }) => url.endsWith('/logout'));
  assert.equal(JSON.parse(call.options.body).refreshToken, 'refresh-two');
  assert.equal(h.storage.size, 0);
});

test('request supports cancellation without requiring AbortSignal.timeout', async () => {
  const h = harness('android', async (_url, options) => {
    assert.equal(options.signal.aborted, true);
    throw new Error('aborted');
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.api.request('/health', undefined, { signal: controller.signal }), /conectar/);
});

test('a second unauthorized response expires the session and clears native storage', async () => {
  const h = harness('android', async (url) => {
    if (url.endsWith('/refresh')) return reply(session('two'));
    return reply({}, 401);
  }, { refreshToken: 'saved' });
  const notices = [];
  h.api.subscribeSession((value) => notices.push(value));
  await h.api.restoreSession();
  await assert.rejects(
    h.api.request('/vehicles', 'access-one'),
    (reason) => reason instanceof h.api.SessionExpiredError,
  );
  assert.equal(h.storage.size, 0);
  assert.equal(notices.at(-1), null);
});
