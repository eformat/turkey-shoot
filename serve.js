'use strict';
// TURKEY SHOOT - tiny zero-dependency static file server (built-in http module).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8137;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = '/';
    try {
      urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch (e) {
      urlPath = '/';
    }
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        try { res.destroy(); } catch (e) {}
      });
      stream.pipe(res);
    });
  } catch (e) {
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    } catch (e2) {}
  }
});

server.listen(PORT, () => {
  console.log('TURKEY SHOOT serving on http://localhost:' + PORT);
});

server.on('error', (err) => {
  console.error('Server error: ' + err.message);
  process.exit(1);
});
