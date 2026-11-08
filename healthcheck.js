'use strict';
// Distroless images have no shell/curl, so the health probe is a tiny node script.
const http = require('http');
const req = http.get({ host: '127.0.0.1', port: process.env.PORT || 8080, path: '/healthz', timeout: 2000 },
  (res) => process.exit(res.statusCode === 200 ? 0 : 1));
req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
