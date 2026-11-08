'use strict';
const { createApp, log } = require('./app');

const state = { ready: true };
const port = Number(process.env.PORT || 8080);
const server = createApp(state).listen(port, '0.0.0.0', () => log('info', 'listening', { port }));

// ALB idle timeout is 60s; keep-alive must be longer or we race the LB and emit sporadic 502s.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown(signal) {
  log('info', 'shutdown_started', { signal });
  state.ready = false; // fail readiness first so the LB stops sending new requests
  const drain = Number(process.env.DRAIN_DELAY_MS || 5000);
  setTimeout(() => server.close(() => process.exit(0)), drain);
  setTimeout(() => process.exit(1), 25_000).unref(); // hard stop before ECS stopTimeout (30s) sends SIGKILL
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
