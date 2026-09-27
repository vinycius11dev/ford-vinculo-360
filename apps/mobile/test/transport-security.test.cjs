const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  readFileSync(resolve(__dirname, '../src/session.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function harness(env) {
  const calls = [];
  const exports = {};
  runInNewContext(source, {
    exports,
    process: { env },
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { fullName: 'Teste', email: 'teste@example.test' },
      }));
    },
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === 'expo-secure-store') return {
        setItemAsync: async () => {},
        deleteItemAsync: async () => {},
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { api: exports, calls };
}

test('production mobile sessions refuse HTTP before sending credentials', async () => {
  const h = harness({
    EXPO_PUBLIC_REQUIRE_TLS: 'true',
    EXPO_PUBLIC_API_URL: 'http://api.example.test/api/v1',
  });

  await assert.rejects(h.api.signIn('teste@example.test', 'password'), /HTTPS/);
  assert.equal(h.calls.length, 0);
});

test('production mobile sessions require an explicit API endpoint', async () => {
  const h = harness({ EXPO_PUBLIC_REQUIRE_TLS: 'true' });

  await assert.rejects(h.api.signIn('teste@example.test', 'password'), /EXPO_PUBLIC_API_URL/);
  assert.equal(h.calls.length, 0);
});

test('production mobile sessions accept and use an HTTPS API endpoint', async () => {
  const h = harness({
    EXPO_PUBLIC_REQUIRE_TLS: 'true',
    EXPO_PUBLIC_API_URL: 'https://api.example.test/api/v1',
  });

  await h.api.signIn('teste@example.test', 'password');
  assert.deepEqual(h.calls, ['https://api.example.test/api/v1/auth/mobile/login']);
});
