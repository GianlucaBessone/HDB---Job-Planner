const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

async function startServer(port, dir) {
  const app = next({ dev: false, dir });
  const handle = app.getRequestHandler();

  await app.prepare();

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    server.listen(port, (err) => {
      if (err) return reject(err);
      console.log(`> Ready on http://localhost:${port}`);
      resolve();
    });
  });
}

module.exports = { startServer };
