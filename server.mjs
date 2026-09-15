import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomUUID, randomBytes, createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { execute, initialState, AppError } from './src/domain.mjs';
const root = resolve('public'); const dataDir = resolve(process.env.DATA_DIR || '.data');
await mkdir(`${dataDir}/uploads`, { recursive: true });
let state; try { state = JSON.parse(await readFile(`${dataDir}/state.json`, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; state = initialState(true); }
let jwtSecret;
if (process.env.JWT_SECRET) jwtSecret = Buffer.from(process.env.JWT_SECRET);
else try { jwtSecret = Buffer.from(await readFile(`${dataDir}/jwt-secret`, 'utf8'), 'base64'); } catch (e) { if (e.code !== 'ENOENT') throw e; jwtSecret = randomBytes(32); await writeFile(`${dataDir}/jwt-secret`, jwtSecret.toString('base64'), { mode: 0o600 }); }
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
const scrypt = promisify(scryptCallback); const revokedTokens = new Map(); const loginAttempts = new Map(); let queue = Promise.resolve();
const persist = async () => { await writeFile(`${dataDir}/state.tmp`, JSON.stringify(state)); await rename(`${dataDir}/state.tmp`, `${dataDir}/state.json`); };
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const signToken = user => { const now = Math.floor(Date.now()/1000), payload = { sub: user.id, role: user.role, iat: now, exp: now + 86400, jti: randomUUID() }; const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`; const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url'); return `${unsigned}.${signature}`; };
const verifyToken = header => {
  try {
    const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]; if (!token) return null;
    const [head, body, signature, extra] = token.split('.'); if (!head || !body || !signature || extra) return null;
    const expected = createHmac('sha256', jwtSecret).update(`${head}.${body}`).digest(); const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const metadata = JSON.parse(Buffer.from(head, 'base64url')); const payload = JSON.parse(Buffer.from(body, 'base64url'));
    if (metadata.alg !== 'HS256' || metadata.typ !== 'JWT' || !payload.sub || !payload.jti || payload.exp <= Math.floor(Date.now()/1000) || revokedTokens.has(payload.jti)) return null;
    return payload;
  } catch { return null; }
};
const validEmail = email => { const allowed = (process.env.UNIVERSITY_DOMAINS || 'vitstudent.ac.in').split(',').map(x=>x.trim().toLowerCase()); return /^[^\s@]+@[^\s@]+$/.test(email) && allowed.includes(email.split('@')[1]); };
const validPassword = password => typeof password === 'string' && password.length >= 10 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
const hashPassword = async password => { const salt = randomBytes(16); const hash = await scrypt(password, salt, 64); return { passwordSalt: salt.toString('base64'), passwordHash: hash.toString('base64') }; };
const checkPassword = async (password, user) => { if (!user?.passwordHash || !user.passwordSalt) return false; const expected = Buffer.from(user.passwordHash, 'base64'); const actual = await scrypt(password, Buffer.from(user.passwordSalt, 'base64'), expected.length); return actual.length === expected.length && timingSafeEqual(actual, expected); };
http.createServer(async (req, res) => {
  const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
    if (path.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new AppError(403, 'Cross-origin request rejected.');
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 4500000) throw new AppError(413, 'Upload is too large.'); }
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { throw new AppError(400, 'Invalid JSON.'); }
      if (path === '/api/config') return send(200, { mode: 'local', message: 'Local authentication with signed JWT access tokens.' });
      if (path === '/api/auth/signup' && req.method === 'POST') {
        const name = typeof body.name === 'string' ? body.name.trim() : '', email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (name.length < 2 || name.length > 60) throw new AppError(400, 'Name must be 2–60 characters.');
        if (!validEmail(email)) throw new AppError(400, 'Use an approved university email address.');
        if (!validPassword(body.password)) throw new AppError(400, 'Password needs 10+ characters with uppercase, lowercase, number, and symbol.');
        const task = queue.then(async()=>{ if (state.users.some(x=>x.email?.toLowerCase()===email)) throw new AppError(409, 'An account with this email already exists.'); const next=structuredClone(state); const user={ id:randomUUID(), name, email, role:'student', verified:false, ...(await hashPassword(body.password)) }; next.users.push(user); const previous=state;state=next;try{await persist();}catch(e){state=previous;throw e;}return { token:signToken(user) }; }); queue=task.catch(()=>{}); return send(201, await task);
      }
      if (path === '/api/auth/login' && req.method === 'POST') {
        const key=req.socket.remoteAddress || 'local', now=Date.now(), attempt=loginAttempts.get(key); if(attempt?.reset>now && attempt.count>=10) throw new AppError(429,'Too many login attempts. Try again later.');
        const email=typeof body.email==='string'?body.email.trim().toLowerCase():''; const user=state.users.find(x=>x.email?.toLowerCase()===email);
        if (!await checkPassword(body.password, user)) { const current=attempt?.reset>now?attempt:{count:0,reset:now+15*60*1000};current.count++;loginAttempts.set(key,current);throw new AppError(401,'Incorrect email or password.'); }
        loginAttempts.delete(key); return send(200,{token:signToken(user)});
      }
      if (path === '/api/demo-login' && req.method === 'POST') {
        const user = state.users.find(x => x.id === body.userId && x.id.startsWith('demo-')); if (!user) throw new AppError(400, 'Choose a demo account.'); return send(200, { token: signToken(user) });
      }
      const claims = verifyToken(req.headers.authorization); const user = claims ? state.users.find(x => x.id === claims.sub && x.role === claims.role) : null;
      if (path === '/api/logout') { if (claims) revokedTokens.set(claims.jti, claims.exp); for(const [id,exp] of revokedTokens)if(exp<=Math.floor(Date.now()/1000))revokedTokens.delete(id); return send(200, { ok: true }); }
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
