//@ts-check

// routes.js

const http = require('http');
const queueManager = require("./../internal/queueManager");

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(JSON.parse(body || '{}')));
  });
}

async function handleRequest(req, res) {
  if (req.method === 'POST' && req.url === '/enqueue') {
    const { queue, jobs } = await parseBody(req);
    if (!queue || !jobs) {
      res.writeHead(400);
      return res.end('Missing queue or job');
    }
    
    jobs.forEach(job => {
      queueManager.enqueueJob(queue, job);
    });

    res.writeHead(200);
    return res.end('Enqueued');
  }

  if (req.method === 'POST' && req.url === '/config') {
    const { queue, index, fanout } = await parseBody(req);
    if (!queue) {
      res.writeHead(400);
      return res.end('Missing queue');
    }
    queueManager.configureQueue(queue, { index, fanout });
    res.writeHead(200);
    return res.end('Configured');
  }

  res.writeHead(404);
  res.end('Not found');
}

function createHttpServer(port = 3000) {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
  return server;
}

module.exports = createHttpServer;
