import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureActivityStore, readActivity } from './scripts/activity-store.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicFiles = new Set(['/index.html', '/styles.css', '/app.js', '/layout-engine.js']);
const fontFiles = new Set(['/assets/fonts/NeueHaasGroteskDisplay-Medium.ttf', '/assets/fonts/NeueHaasGroteskDisplay-Regular.ttf', '/assets/fonts/NeueHaasGroteskDisplay-Bold.ttf', '/assets/fonts/Akkurat-Regular.otf', '/assets/fonts/Akkurat-Bold.otf', '/assets/fonts/TWKLausanne-400.otf', '/assets/fonts/TWKLausanne-600.otf']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.otf': 'font/otf', '.ttf': 'font/ttf' };

function send(client, event, data) {
  if (!client.destroyed) client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function startServers({ projectRoot = root, workingPort = 4173, referencePort = 4174 } = {}) {
  await ensureActivityStore(projectRoot);
  const clients = { working: new Set(), reference: new Set() };
  const startedAt = new Date().toISOString();
  const timers = new Map();
  const watchers = [];
  const servers = [];

  function schedule(key, action, delay = 100) {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      Promise.resolve().then(action).catch(error => console.error(`${key}: ${error.message}`));
    }, delay));
  }
  function broadcast(mode, event, data) {
    for (const client of clients[mode]) send(client, event, data);
  }
  async function version(mode) {
    if (mode === 'working') return { mode, snapshotId: null, updatedAt: startedAt };
    const manifest = JSON.parse(await readFile(path.join(projectRoot, 'data/reference.json'), 'utf8'));
    return { mode, snapshotId: manifest.snapshotId, updatedAt: manifest.updatedAt };
  }

  for (const [mode, port] of [['working', workingPort], ['reference', referencePort]]) {
    const sourceRoot = mode === 'working' ? projectRoot : path.join(projectRoot, 'snapshots/reference');
    const server = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url, 'http://localhost');
        if (!['GET', 'HEAD'].includes(request.method)) {
          response.writeHead(405, { Allow: 'GET, HEAD' });
          response.end('Method not allowed');
          return;
        }
        if (url.pathname === '/events' && request.method === 'GET') {
          response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          clients[mode].add(response);
          response.on('close', () => clients[mode].delete(response));
          send(response, 'activity', await readActivity(projectRoot));
          return;
        }
        if (url.pathname === '/version.json') {
          const data = JSON.stringify(await version(mode));
          response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(request.method === 'HEAD' ? undefined : data);
          return;
        }
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const exampleImage = /^\/example\/[a-zA-Z0-9_-]+\.jpg$/.test(pathname);
        if (!publicFiles.has(pathname) && !fontFiles.has(pathname) && !exampleImage) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        const contents = await readFile(path.join(fontFiles.has(pathname) || exampleImage ? projectRoot : sourceRoot, pathname));
        response.writeHead(200, { 'Content-Type': exampleImage ? 'image/jpeg' : types[path.extname(pathname)], 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : contents);
      } catch (error) {
        console.error(`${mode}: ${error.message}`);
        if (!response.headersSent) response.writeHead(error.code === 'ENOENT' ? 404 : 500);
        response.end(error.code === 'ENOENT' ? 'Run npm run begin-prompt to create the reference snapshot.' : 'Unable to load the page.');
      }
    });
    servers.push(server);
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });
    } catch (error) {
      for (const running of servers) running.close();
      throw error;
    }
  }

  watchers.push(watch(path.join(projectRoot, 'data'), (_, filename) => {
    if (!filename || filename === 'activity.json') {
      schedule('activity', async () => {
        const update = await readActivity(projectRoot);
        broadcast('working', 'activity', update);
        broadcast('reference', 'activity', update);
      });
    }
    if (!filename || filename === 'reference.json') {
      schedule('reference reload', async () => broadcast('reference', 'reload', await version('reference')), 150);
    }
  }));
  watchers.push(watch(projectRoot, (_, filename) => {
    if (!publicFiles.has(`/${filename}`)) return;
    schedule('working reload', () => broadcast('working', 'reload', {}), 150);
  }));
  const heartbeat = setInterval(() => {
    for (const group of Object.values(clients)) for (const client of group) client.write(': heartbeat\n\n');
  }, 15000);
  heartbeat.unref();

  return {
    servers,
    async close() {
      for (const watcher of watchers) watcher.close();
      for (const timer of timers.values()) clearTimeout(timer);
      clearInterval(heartbeat);
      for (const group of Object.values(clients)) for (const client of group) client.end();
      await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const service = await startServers();
  console.log('Working: http://127.0.0.1:4173/');
  console.log('Reference: http://127.0.0.1:4174/');
  const close = async () => { await service.close(); process.exit(0); };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
