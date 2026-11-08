'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

function start(state) {
  return new Promise((resolve) => {
    const server = createApp(state).listen(0, () => resolve(server));
  });
}

test('liveness is always 200', async () => {
  const s = await start({ ready: false });
  const r = await fetch(`http://127.0.0.1:${s.address().port}/healthz`);
  assert.strictEqual(r.status, 200);
  s.close();
});

test('readiness follows state (draining => 503)', async () => {
  const state = { ready: true };
  const s = await start(state);
  const base = `http://127.0.0.1:${s.address().port}`;
  assert.strictEqual((await fetch(`${base}/readyz`)).status, 200);
  state.ready = false;
  assert.strictEqual((await fetch(`${base}/readyz`)).status, 503);
  s.close();
});

test('metrics endpoint exposes prometheus format', async () => {
  const s = await start({ ready: true });
  const body = await (await fetch(`http://127.0.0.1:${s.address().port}/metrics`)).text();
  assert.match(body, /http_request_duration_seconds/);
  s.close();
});
