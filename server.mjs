import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execute, initialState, AppError } from './src/domain.mjs';
const root = resolve('public'); const dataDir = resolve(process.env.DATA_DIR || '.data');
await mkdir(`${dataDir}/uploads`, { recursive: true });
let state; try { state = JSON.parse(await readFile(`${dataDir}/state.json`, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; state = initialState(true); }
const sessions = new Map(); let queue = Promise.resolve();
const persist = async () => { await writeFile(`${dataDir}/state.tmp`, JSON.stringify(state)); await rename(`${dataDir}/state.tmp`, `${dataDir}/state.json`); };
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
    if (path.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new AppError(403, 'Cross-origin request rejected.');
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 4500000) throw new AppError(413, 'Upload is too large.'); }
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { throw new AppError(400, 'Invalid JSON.'); }
      if (path === '/api/config') return send(200, { mode: 'demo', categories: [], message: 'Local demo — sample accounts, no email verification.' });
      if (path === '/api/demo-login' && req.method === 'POST') {
        const user = state.users.find(x => x.id === body.userId); if (!user) throw new AppError(400, 'Choose a demo account.');
        const token = randomUUID(); sessions.set(token, { userId: user.id, expires: Date.now()+86400000 }); res.setHeader('Set-Cookie', `vitfinds_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`); return send(200, { ok: true });
      }
      const token = req.headers.cookie?.match(/(?:^|; )vitfinds_session=([^;]+)/)?.[1]; const session = sessions.get(token);
      const user = session && session.expires > Date.now() ? state.users.find(x => x.id === session.userId) : null;
      if (path === '/api/logout') { sessions.delete(token); res.setHeader('Set-Cookie', 'vitfinds_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(200, { ok: true }); }
      if (!user) throw new AppError(401, 'Sign in to continue.');
      if (path === '/api/uploads' && req.method === 'POST') {
        const match = typeof body.data === 'string' && body.data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/); if (!match) throw new AppError(400, 'Upload a JPEG, PNG, or WebP image.');
        const image = Buffer.from(match[2], 'base64'); if (image.length > 3000000) throw new AppError(413, 'Use an image under 3 MB.');
        const name = `${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`; await writeFile(`${dataDir}/uploads/${name}`, image); return send(200, { url: `/uploads/${name}` });
      }
      const run = async () => { const next = structuredClone(state); const result = await execute(next, { method: req.method, path, body, user }); if (req.method !== 'GET') { const previous = state; state = next; try { await persist(); } catch (e) { state = previous; throw e; } } return result; };
      const task = queue.then(run); queue = task.catch(() => {}); return send(200, await task);
    }
    let file;
    if (/^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path)) file = `${dataDir}${path}`;
    else { file = resolve(root, `.${path === '/' ? '/index.html' : path}`); if (!file.startsWith(root + '/') && !file.startsWith(root + '\\')) throw new AppError(404, 'Not found.'); }
    const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(bytes);
  } catch (e) { send(e.status || (e.code === 'ENOENT' ? 404 : 500), { error: e.status ? e.message : e.code === 'ENOENT' ? 'Not found.' : 'Something went wrong. Please try again.' }); if (!e.status && e.code !== 'ENOENT') console.error(e); }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`VITFinds running at http://127.0.0.1:${process.env.PORT || 3000}`));
