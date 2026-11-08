'use strict';
const express = require('express');
const client = require('prom-client');

function log(level, msg, extra = {}) {
  // Structured JSON logs: one line per event, so CloudWatch metric filters and Logs Insights can parse fields.
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));
}

function createApp(state = { ready: true }) {
  const app = express();
  app.disable('x-powered-by');

  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry });
  const duration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  const quiet = new Set(['/healthz', '/readyz', '/metrics']);
  app.use((req, res, next) => {
    const stop = duration.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.route.path : 'unmatched'; // bounded label cardinality
      stop({ method: req.method, route, status: res.statusCode });
      if (!quiet.has(route)) log('info', 'request', { method: req.method, path: req.path, status: res.statusCode });
    });
    next();
  });

  // Liveness: "is the process alive?" Used by the container health check. Never checks dependencies.
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  // Readiness: "should I receive traffic?" Used by the load balancer. Flips to 503 while draining.
  app.get('/readyz', (_req, res) =>
    state.ready ? res.json({ status: 'ready' }) : res.status(503).json({ status: 'draining' }));
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
  app.get('/', (_req, res) => res.json({ message: 'hello', version: process.env.APP_VERSION || 'dev' }));
  return app;
}

module.exports = { createApp, log };
