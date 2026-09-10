import { randomUUID } from 'node:crypto';
export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
const requireThat = (condition, status, message) => { if (!condition) throw new AppError(status, message); };
export const categories = ['Electronics', 'Books & stationery', 'ID & essentials', 'Clothing', 'Cycles & sports', 'Hostel essentials', 'Other'];
export const locations = ['SJT', 'TT', 'Main Library', 'Foodys', 'Mens Hostel', 'Ladies Hostel', 'Sports Ground', 'Main Gate', 'Other'];
const text = (v, min, max, label) => { requireThat(typeof v === 'string' && v.trim().length >= min && v.trim().length <= max, 400, `${label} must be ${min}–${max} characters.`); return v.trim(); };
const own = (item, user) => requireThat(item.ownerId === user.id, 403, 'Only the owner can change this listing.');
const safeUser = u => ({ id: u.id, name: u.name, role: u.role, verified: !!u.verified });
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
export async function execute(s, { method, path, body = {}, user }) {
  requireThat(user, 401, 'Sign in to continue.');
  const now = () => new Date().toISOString();
  const notify = (userId, message) => s.notifications.push({ id: randomUUID(), userId, message, read: false, createdAt: now() });
  const listing = id => { const l = s.listings.find(x => x.id === id && !x.removed); requireThat(l, 404, 'This listing is no longer available.'); return l; };
  const conversation = id => { const c = s.conversations.find(x => x.id === id); requireThat(c && c.members.includes(user.id), 404, 'Conversation not found.'); return c; };
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
        if (!c) { c = { id: randomUUID(), listingId: l.id, members: [user.id, l.ownerId], createdAt: now() }; s.conversations.push(c); }
        const message = text(body.message, 1, 2000, 'Message');
        s.messages.push({ id: randomUUID(), conversationId: c.id, senderId: user.id, text: message, createdAt: now() }); notify(l.ownerId, `New message about “${l.title}”.`); return c;
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
  match = path.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (method === 'POST' && match) { const c = conversation(match[1]); const m = { id: randomUUID(), conversationId: c.id, senderId: user.id, text: text(body.text, 1, 2000, 'Message'), createdAt: now() }; s.messages.push(m); notify(c.members.find(x => x !== user.id), 'You have a new message.'); return m; }
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
