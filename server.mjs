import { createServer } from 'node:http';
import { readFile, realpath, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('public');
const dataDir = resolve('.data');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };

await mkdir(dataDir, { recursive: true }).catch(() => {});

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    // Приём заявок с публичной страницы
    if (req.method === 'POST' && url.pathname === '/api/lead') {
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 50_000) { req.destroy(); } });
      req.on('end', async () => {
        try {
          const body = JSON.parse(raw || '{}');
          const lead = {
            ts: new Date().toISOString(),
            name: String(body.name || '').slice(0, 200),
            phone: String(body.phone || '').slice(0, 200),
            date: String(body.date || '').slice(0, 200),
            comment: String(body.comment || '').slice(0, 2000)
          };
          if (!lead.name || !lead.phone) {
            res.writeHead(400, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'name и phone обязательны' }));
          }
          const file = resolve(dataDir, 'leads.json');
          let list = [];
          try { list = JSON.parse(await readFile(file, 'utf8')); } catch {}
          list.push(lead);
          await writeFile(file, JSON.stringify(list, null, 2));
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'bad json' }));
        }
      });
      return;
    }

    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }

    const path = await realpath(resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!path.startsWith(root + sep)) throw new Error('outside');
    if ((await stat(path)).size > 5_000_000) { res.writeHead(413); return res.end(); }
    const content = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Страница не найдена');
  }
}).listen(3000, '127.0.0.1');
