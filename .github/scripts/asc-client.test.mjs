// Run: node --test .github/scripts/asc-client.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry, shouldRetryStatus, retryDelayMs } from './asc-client.mjs';

const mkRes = (status, body = '', headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  text: async () => body,
  json: async () => JSON.parse(body),
});

function scripted(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetchImpl };
}

const quiet = (fn) => async (t) => {
  const orig = console.warn;
  console.warn = () => {};
  try { await fn(t); } finally { console.warn = orig; }
};

test('GET retries on 500 then succeeds', quiet(async () => {
  const { calls, fetchImpl } = scripted([mkRes(500, 'boom'), mkRes(500, 'boom'), mkRes(200, '{"ok":1}')]);
  const sleeps = [];
  const res = await fetchWithRetry('https://x/apps', {}, { fetchImpl, sleepImpl: async (ms) => sleeps.push(ms) });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 3);
  assert.equal(sleeps.length, 2);
  assert.ok(sleeps[0] >= 1000 && sleeps[0] < 1250, `first backoff ~1s, got ${sleeps[0]}`);
  assert.ok(sleeps[1] >= 2000 && sleeps[1] < 2500, `second backoff ~2s, got ${sleeps[1]}`);
}));

test('GET gives up after 5 attempts and returns the last response', quiet(async () => {
  const { calls, fetchImpl } = scripted(Array.from({ length: 5 }, () => mkRes(503)));
  const res = await fetchWithRetry('https://x/apps', {}, { fetchImpl, sleepImpl: async () => {} });
  assert.equal(res.status, 503);
  assert.equal(calls.length, 5);
}));

test('GET retries on network error', quiet(async () => {
  const { calls, fetchImpl } = scripted([new Error('ECONNRESET'), mkRes(200, '{}')]);
  const res = await fetchWithRetry('https://x/apps', {}, { fetchImpl, sleepImpl: async () => {} });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
}));

test('4xx is never retried', quiet(async () => {
  const { calls, fetchImpl } = scripted([mkRes(404), mkRes(200)]);
  const res = await fetchWithRetry('https://x/apps', {}, { fetchImpl, sleepImpl: async () => {} });
  assert.equal(res.status, 404);
  assert.equal(calls.length, 1);
}));

test('POST does not retry on 500 (write may have landed)', quiet(async () => {
  const { calls, fetchImpl } = scripted([mkRes(500), mkRes(200)]);
  const res = await fetchWithRetry('https://x/submit', { method: 'POST' }, { fetchImpl, sleepImpl: async () => {} });
  assert.equal(res.status, 500);
  assert.equal(calls.length, 1);
}));

test('POST does not retry on network error', quiet(async () => {
  const { fetchImpl } = scripted([new Error('ECONNRESET')]);
  await assert.rejects(
    fetchWithRetry('https://x/submit', { method: 'POST' }, { fetchImpl, sleepImpl: async () => {} }),
    /ECONNRESET/,
  );
}));

test('POST retries on 503 and 429', quiet(async () => {
  const { calls, fetchImpl } = scripted([mkRes(503), mkRes(429), mkRes(201, '{}')]);
  const res = await fetchWithRetry('https://x/submit', { method: 'POST' }, { fetchImpl, sleepImpl: async () => {} });
  assert.equal(res.status, 201);
  assert.equal(calls.length, 3);
}));

test('Retry-After header is honoured and capped', quiet(async () => {
  const { fetchImpl } = scripted([mkRes(429, '', { 'retry-after': '3' }), mkRes(200)]);
  const sleeps = [];
  await fetchWithRetry('https://x/apps', {}, { fetchImpl, sleepImpl: async (ms) => sleeps.push(ms) });
  assert.deepEqual(sleeps, [3000]);
  assert.equal(retryDelayMs(1, '600'), 60_000);
}));

test('header thunk is re-evaluated on every attempt', quiet(async () => {
  const { calls, fetchImpl } = scripted([mkRes(500), mkRes(200)]);
  let n = 0;
  await fetchWithRetry('https://x/apps', { headers: () => ({ Authorization: `t${++n}` }) }, { fetchImpl, sleepImpl: async () => {} });
  assert.equal(calls[0].init.headers.Authorization, 't1');
  assert.equal(calls[1].init.headers.Authorization, 't2');
}));

test('shouldRetryStatus policy table', () => {
  assert.equal(shouldRetryStatus('GET', 500), true);
  assert.equal(shouldRetryStatus('GET', 502), true);
  assert.equal(shouldRetryStatus('GET', 429), true);
  assert.equal(shouldRetryStatus('GET', 401), false);
  assert.equal(shouldRetryStatus('POST', 500), false);
  assert.equal(shouldRetryStatus('PATCH', 503), true);
  assert.equal(shouldRetryStatus('DELETE', 429), true);
  assert.equal(shouldRetryStatus(undefined, 500), true);
});
