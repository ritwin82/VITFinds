import { randomUUID } from 'node:crypto';
export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
const requireThat = (condition, status, message) => { if (!condition) throw new AppError(status, message); };
export const categories = ['Electronics', 'Books & stationery', 'ID & essentials', 'Clothing', 'Cycles & sports', 'Hostel essentials', 'Other'];
export const locations = ['SJT', 'TT', 'Main Library', 'Foodys', 'Mens Hostel', 'Ladies Hostel', 'Sports Ground', 'Main Gate', 'Other'];
const text = (v, min, max, label) => { requireThat(typeof v === 'string' && v.trim().length >= min && v.trim().length <= max, 400, `${label} must be ${min}–${max} characters.`); return v.trim(); };
const own = (item, user) => requireThat(item.ownerId === user.id, 403, 'Only the owner can change this listing.');
const safeUser = u => ({ id: u.id, name: u.name, role: u.role, verified: !!u.verified });
const compareValue = (a, b) => a === b ? 0 : a < b ? -1 : 1;
const compareKeys = (a, b, directions) => {
  for (let i = 0; i < directions.length; i++) { const difference = compareValue(a[i], b[i]); if (difference) return difference * directions[i]; }
  return 0;
};
function pageRows(rows, query, scope, key, directions, newestFirst = false) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  requireThat(Number.isInteger(limit) && limit >= 1 && limit <= 50, 400, 'Limit must be between 1 and 50.');
  let after;
  if (query.cursor !== undefined) {
    try {
      requireThat(typeof query.cursor === 'string' && query.cursor.length <= 2048, 400, 'Invalid cursor.');
      const parsed = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
      requireThat(parsed.scope === scope && Array.isArray(parsed.key) && parsed.key.length === directions.length, 400, 'Cursor does not match this request.');
      after = parsed.key;
    } catch { throw new AppError(400, 'Invalid cursor.'); }
  }
  const ordered = [...rows].sort((a, b) => compareKeys(key(a), key(b), directions));
  const start = after ? ordered.findIndex(row => compareKeys(key(row), after, directions) > 0) : 0;
  const slice = ordered.slice(start < 0 ? ordered.length : start, (start < 0 ? ordered.length : start) + limit);
  const last = slice.at(-1);
  return {
    items: newestFirst ? slice.reverse() : slice,
    nextCursor: last && (start < 0 ? ordered.length : start) + limit < ordered.length ? Buffer.from(JSON.stringify({ scope, key: key(last) })).toString('base64url') : null,
    total: ordered.length
  };
}
export function initialState(demo = false) {
  const s = { users: [], listings: [], conversations: [], messages: [], claims: [], reports: [], saved: [], notifications: [] };
  if (!demo) return s;
  s.users = [{ id: 'demo-me', name: 'Alex Student', email: 'alex@vitstudent.ac.in', role: 'student', verified: false }, { id: 'demo-priya', name: 'Priya S.', email: 'priya@vitstudent.ac.in', role: 'student', verified: false }, { id: 'demo-arjun', name: 'Arjun R.', email: 'arjun@vitstudent.ac.in', role: 'student', verified: false }, { id: 'demo-admin', name: 'Campus moderator', email: 'admin@vitstudent.ac.in', role: 'admin', verified: false }];
  const entries = [
    ['found', 'A little music, missing its person', 'Black wireless headphones found on the second floor of the library. Tell me the brand and a distinguishing detail to claim them.', 'Electronics', 'Main Library', 0, 'headphones', 'demo-priya'],
    ['sale', 'Your next semester, sorted', 'Engineering Mathematics textbook. Clean pages, a few useful pencil notes. Available for pickup near SJT.', 'Books & stationery', 'SJT', 350, 'books', 'demo-arjun'],
    ['lost', 'Have you seen my blue backpack?', 'Lost my navy backpack after the afternoon class at TT. It has a notebook inside. Please get in touch if you find it.', 'ID & essentials', 'TT', 0, 'backpack', 'demo-me'],
    ['sale', 'A better way to get to class', 'Single-speed campus bicycle in good condition. Recently serviced brakes. Price is negotiable.', 'Cycles & sports', 'Mens Hostel', 2800, 'cycle', 'demo-priya'],
    ['found', 'Keys looking for their way home', 'A set of keys was found near Foodys. Describe the keychain so I can verify ownership.', 'ID & essentials', 'Foodys', 0, 'keys', 'demo-arjun'],
    ['sale', 'Make room for a little light', 'Compact study lamp with three brightness settings. Works perfectly. Moving out this semester.', 'Hostel essentials', 'Ladies Hostel', 450, 'lamp', 'demo-me']
  ];
  s.listings = entries.map((e, i) => ({ id: `sample-${i+1}`, type: e[0], title: e[1], description: e[2], category: e[3], location: e[4], price: e[5], art: e[6], ownerId: e[7], status: 'active', condition: 'Good', negotiable: true, images: [], date: new Date().toISOString().slice(0,10), createdAt: new Date(Date.now() - i*3600000).toISOString(), demo: true }));
  return s;
}
export async function execute(s, { method, path, body = {}, query = {}, user }) {
  requireThat(user, 401, 'Sign in to continue.');
  const now = () => new Date().toISOString();
  const notify = (userId, message) => s.notifications.push({ id: randomUUID(), userId, message, read: false, createdAt: now() });
  const listing = id => { const l = s.listings.find(x => x.id === id && !x.removed); requireThat(l, 404, 'This listing is no longer available.'); return l; };
  const conversation = id => { const c = s.conversations.find(x => x.id === id); requireThat(c && c.members.includes(user.id), 404, 'Conversation not found.'); return c; };
  const addMessage = (c, value) => {
    const last = s.messages.filter(m => m.conversationId === c.id).reduce((time, m) => m.createdAt > time ? m.createdAt : time, c.lastMessageAt || '');
    const createdAt = new Date(Math.max(Date.now(), (Date.parse(last) || 0) + 1)).toISOString();
    c.lastMessageAt = createdAt;
    const m = { id: randomUUID(), conversationId: c.id, senderId: user.id, text: value, createdAt };
    s.messages.push(m); return m;
  };
  if (method === 'GET' && path === '/api/me') return { ...safeUser(user), email: user.email };
  if (method === 'GET' && path === '/api/listings') {
    const { type, category, location, status } = query;
    if (type !== undefined) requireThat(['lost', 'found', 'sale'].includes(type), 400, 'Invalid listing type.');
    if (category !== undefined) requireThat(categories.includes(category), 400, 'Invalid category.');
    if (location !== undefined) requireThat(locations.includes(location), 400, 'Invalid location.');
    if (status !== undefined) requireThat(['active', 'reserved', 'sold', 'returned'].includes(status), 400, 'Invalid listing status.');
    const sort = query.sort || 'newest';
    requireThat(['newest', 'oldest', 'price-asc', 'price-desc'].includes(sort), 400, 'Invalid sort order.');
    const q = query.q === undefined ? '' : text(query.q, 0, 100, 'Search').toLowerCase();
    const rows = s.listings.filter(l => !l.removed && (!type || l.type === type) && (!category || l.category === category) && (!location || l.location === location) && (!status || l.status === status) && (!q || `${l.title} ${l.description}`.toLowerCase().includes(q)));
    const priced = sort.startsWith('price-');
    return pageRows(rows, query, JSON.stringify({ type, category, location, status, q, sort }), l => priced ? [Number(l.price || 0), l.createdAt, l.id] : [l.createdAt, l.id], sort === 'price-asc' ? [1, -1, -1] : sort === 'price-desc' ? [-1, -1, -1] : sort === 'oldest' ? [1, 1] : [-1, -1]);
  }
  let readMatch = path.match(/^\/api\/listings\/([^/]+)$/);
  if (method === 'GET' && readMatch) return listing(readMatch[1]);
  if (method === 'GET' && path === '/api/me/saved-listings') {
    const ids = new Set(s.saved.filter(x => x.userId === user.id).map(x => x.listingId));
    return pageRows(s.listings.filter(l => ids.has(l.id) && !l.removed), query, `saved:${user.id}`, l => [l.createdAt, l.id], [-1, -1]);
  }
  if (method === 'GET' && path === '/api/conversations') return pageRows(s.conversations.filter(c => c.members.includes(user.id)), query, `conversations:${user.id}`, c => [c.lastMessageAt || c.createdAt, c.id], [-1, -1]);
  readMatch = path.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (method === 'GET' && readMatch) {
    const c = conversation(readMatch[1]);
    return pageRows(s.messages.filter(m => m.conversationId === c.id), query, `messages:${user.id}:${c.id}`, m => [m.createdAt, m.id], [-1, -1], true);
  }
  if (method === 'GET' && path === '/api/notifications') return pageRows(s.notifications.filter(n => n.userId === user.id), query, `notifications:${user.id}`, n => [n.createdAt, n.id], [-1, -1]);
  if (method === 'GET' && path === '/api/state') return {
    user: safeUser(user), users: s.users.map(safeUser), listings: s.listings.filter(x => !x.removed),
    saved: s.saved.filter(x => x.userId === user.id).map(x => x.listingId),
    conversations: s.conversations.filter(x => x.members.includes(user.id)),
    messages: s.messages.filter(x => s.conversations.some(c => c.id === x.conversationId && c.members.includes(user.id))),
    claims: s.claims.filter(x => x.userId === user.id || s.listings.find(l => l.id === x.listingId)?.ownerId === user.id),
    notifications: s.notifications.filter(x => x.userId === user.id),
    reports: user.role === 'admin' ? s.reports : []
  };
  if (method === 'POST' && path === '/api/listings') {
    const existing = body.id ? listing(body.id) : null;
    if (existing) { own(existing, user); requireThat(body.type === existing.type, 400, 'The listing type cannot be changed.'); }
    requireThat(['lost', 'found', 'sale'].includes(body.type), 400, 'Choose a listing type.');
    requireThat(categories.includes(body.category) && locations.includes(body.location), 400, 'Choose a category and campus location.');
    const date = text(body.date, 10, 10, 'Date'); requireThat(/^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && date <= now().slice(0,10), 400, 'Choose a valid date, today or earlier.');
    const price = body.type === 'sale' ? Number(body.price) : 0;
    requireThat(Number.isFinite(price) && price >= 0 && price <= 1000000, 400, 'Enter a valid price between ₹0 and ₹10,00,000.');
    requireThat(Array.isArray(body.images) && body.images.length <= 3 && body.images.every(x => typeof x === 'string' && /^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/.test(x)), 400, 'Use up to three uploaded photos.');
    const item = { ...(existing || {}), id: existing?.id || randomUUID(), ownerId: user.id, type: body.type, title: text(body.title, 5, 100, 'Title'), description: text(body.description, 15, 2000, 'Description'), category: body.category, location: body.location, date, price, condition: ['New', 'Like new', 'Good', 'Fair'].includes(body.condition) ? body.condition : 'Good', negotiable: !!body.negotiable, images: existing && !body.images.length ? existing.images : body.images, status: existing?.status || 'active', createdAt: existing?.createdAt || now() };
    if (existing) Object.assign(existing, item); else s.listings.push(item); return item;
  }
  let match = path.match(/^\/api\/listings\/([^/]+)\/(status|save|contact|claim|report|archive)$/);
  if (method === 'POST' && match) {
    const l = listing(match[1]);
    switch (match[2]) {
      case 'archive': { own(l, user); l.removed = true; s.claims.filter(c=>c.listingId===l.id && c.status==='pending').forEach(c=>{c.status='rejected';notify(c.userId, 'The finder closed the listing associated with your claim.');}); return { ok: true }; }
      case 'status': {
        own(l, user); const allowed = l.type === 'sale' ? ['active', 'reserved', 'sold'] : ['active', 'returned'];
        requireThat(allowed.includes(body.status), 400, 'Invalid status for this listing.'); l.status = body.status; return l;
      }
      case 'save': {
        const existing = s.saved.find(x => x.userId === user.id && x.listingId === l.id);
        if (existing) s.saved = s.saved.filter(x => x.id !== existing.id); else s.saved.push({ id: `${user.id}:${l.id}`, userId: user.id, listingId: l.id });
        return { saved: !existing };
      }
      case 'contact': {
        requireThat(l.ownerId !== user.id && l.status === 'active', 400, 'You can contact owners of active listings.');
        let c = s.conversations.find(x => x.listingId === l.id && x.members.includes(user.id));
        if (!c) { c = { id: `${l.id}:${user.id}`, listingId: l.id, members: [user.id, l.ownerId], createdAt: now() }; s.conversations.push(c); }
        const message = text(body.message, 1, 2000, 'Message');
        addMessage(c, message); notify(l.ownerId, `New message about “${l.title}”.`); return c;
      }
      case 'claim': {
        requireThat(l.type === 'found' && l.status === 'active' && l.ownerId !== user.id, 400, 'This item cannot be claimed.');
        requireThat(!s.claims.some(x => x.listingId === l.id && x.userId === user.id && x.status === 'pending'), 409, 'Your claim is already pending.');
        const c = { id: randomUUID(), listingId: l.id, userId: user.id, proof: text(body.proof, 15, 1000, 'Ownership details'), status: 'pending', createdAt: now() }; s.claims.push(c); notify(l.ownerId, `Someone has claimed “${l.title}”. Review their ownership details.`); return c;
      }
      case 'report': {
        requireThat(l.ownerId !== user.id, 400, 'You cannot report your own listing.');
        requireThat(!s.reports.some(x => x.userId === user.id && x.listingId === l.id && x.status === 'open'), 409, 'You have already reported this listing.');
        const r = { id: randomUUID(), listingId: l.id, userId: user.id, reason: text(body.reason, 10, 1000, 'Report details'), status: 'open', createdAt: now() }; s.reports.push(r); return r;
      }
    }
  }
  match = path.match(/^\/api\/conversations\/([^/]+)\/read$/);
  if (method === 'POST' && match) {
    const c = conversation(match[1]);
    const latest = s.messages.filter(m => m.conversationId === c.id && m.senderId !== user.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (latest && (!c.readAt?.[user.id] || c.readAt[user.id] < latest.createdAt)) {
      c.readAt = { ...c.readAt, [user.id]: latest.createdAt };
    }
    return { readAt: c.readAt?.[user.id] || null };
  }
  match = path.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (method === 'POST' && match) { const c = conversation(match[1]); const m = addMessage(c, text(body.text, 1, 2000, 'Message')); notify(c.members.find(x => x !== user.id), 'You have a new message.'); return m; }
  match = path.match(/^\/api\/claims\/([^/]+)$/);
  if (method === 'POST' && match) {
    const c = s.claims.find(x => x.id === match[1]); requireThat(c, 404, 'Claim not found.'); const l = listing(c.listingId); own(l, user);
    requireThat(c.status === 'pending' && ['accepted', 'rejected'].includes(body.status), 400, 'This claim cannot be updated.');
    requireThat(l.status === 'active', 409, 'This item has already been returned.'); c.status = body.status;
    if (body.status === 'accepted') { l.status = 'returned'; s.claims.filter(x => x.listingId === l.id && x.status === 'pending').forEach(x => { x.status = 'rejected'; notify(x.userId, `“${l.title}” was returned to another claimant.`); }); }
    notify(c.userId, `Your claim for “${l.title}” was ${c.status}.`); return c;
  }
  if (method === 'POST' && path === '/api/notifications/read') { s.notifications.filter(x => x.userId === user.id).forEach(x => x.read = true); return { ok: true }; }
  match = path.match(/^\/api\/reports\/([^/]+)$/);
  if (method === 'POST' && match) { requireThat(user.role === 'admin', 403, 'Moderator access required.'); const r = s.reports.find(x => x.id === match[1]); requireThat(r && r.status === 'open', 404, 'Open report not found.'); requireThat(['dismiss', 'remove'].includes(body.action), 400, 'Choose a moderation action.'); r.status = body.action === 'remove' ? 'removed' : 'dismissed'; if (body.action === 'remove') { const l = listing(r.listingId); l.removed = true; notify(l.ownerId, 'A moderator removed your reported listing.'); } return r; }
  throw new AppError(404, 'Endpoint not found.');
}
