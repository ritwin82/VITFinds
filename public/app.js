/* VITFinds front-end
   Talks to the same API as before (/api/state, /api/listings, /api/claims, ...).
   Works with the local Node server (demo mode) and with the AWS deployment (Cognito). */

const config = window.VITFINDS_CONFIG || {};
const demo = !config.apiUrl;
const openedAsFile = location.protocol === 'file:';
const PREVIEW_NOTE = 'This is a preview with sample data. Start the server (npm start) to post, claim and chat.';
let preview = false; // true when showing sample data because the server isn't running
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));

/* ---------- Constants (must match src/domain.mjs) ---------- */
const categories = ['Electronics', 'Books & stationery', 'ID & essentials', 'Clothing', 'Cycles & sports', 'Hostel essentials', 'Other'];
const locations = ['SJT', 'TT', 'Main Library', 'Foodys', 'Mens Hostel', 'Ladies Hostel', 'Sports Ground', 'Main Gate', 'Other'];
const VIEWS = ['home', 'all', 'lost', 'found', 'sale', 'saved', 'mine', 'messages', 'activity', 'admin'];
const ALL_CATEGORIES = 'All categories';
const ANYWHERE = 'Anywhere on campus';
// Free Pexels photography is bundled locally; sources are in images/CREDITS.md.
const samplePhotos = Object.fromEntries(['headphones', 'books', 'backpack', 'cycle', 'keys', 'lamp'].map(name => [name, `images/${name}.jpg`]));
const categoryIcons = { 'Electronics': 'headphones', 'Books & stationery': 'book', 'ID & essentials': 'user', 'Clothing': 'tag', 'Cycles & sports': 'cycle', 'Hostel essentials': 'box', 'Other': 'box' };

/* ---------- Icons ---------- */
const paths = {
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15"/>',
  cycle: '<circle cx="5" cy="16" r="4"/><circle cx="19" cy="16" r="4"/><path d="m5 16 5-9 5 9H5M8 7h4M16 4h3l-4 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.3-9.4A5 5 0 0 1 12 6.8a5 5 0 0 1 9.3 3.8C19.5 15.4 12 20 12 20z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  lost: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M9.5 9a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.8.6-.8 1.1V12M11 14.5v.01"/>',
  found: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a7 7 0 0 1-5.6-2.8L3.6 15a1.6 1.6 0 0 1 2.5-2L7 14"/>',
  sale: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

/* ---------- App state ---------- */
let state = null;
let view = 'home';
let query = '', category = ALL_CATEGORIES, place = ANYWHERE, sort = 'newest';
let conversationId = null;
let showThread = false; // on phones: show the open chat instead of the inbox list
let heroIndex = 0;
let homeTab = 'found';
let authToken = sessionStorage.getItem('vitfinds-token') || '';
let toastTimer;
let liveUserId = null, liveSocket = null, liveAbort = null, liveRetry = null, liveGeneration = 0;
let syncPromise = null, syncToken = null, syncQueued = false;
const readPending = new Set();

/* ---------- Helpers ---------- */
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 4500);
}

async function api(path, body, method) {
  if (preview) {
    if (path === '/state') return previewState();
    throw new Error(PREVIEW_NOTE);
  }
  const response = await fetch((config.apiUrl || '') + '/api' + path, {
    method: method || (body ? 'POST' : 'GET'),
    credentials: demo ? 'same-origin' : 'omit',
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json();
  if (!response.ok) {
    const e = new Error(result.error || result.message || 'Request failed. Please try again.');
    e.status = response.status;
    throw e;
  }
  return result;
}

async function refresh() { state = await api('/state'); render(); syncLive(); }

/* ---------- Live updates ----------
   The server pushes a "sync" event when a message arrives or is read
   (Server-Sent Events from server.mjs locally, a WebSocket on AWS). */
function stopRealtime() {
  liveGeneration++;
  clearTimeout(liveRetry); liveRetry = null;
  liveAbort?.abort(); liveAbort = null;
  liveSocket?.close(); liveSocket = null;
  liveUserId = null;
}

function syncLive() {
  if (preview || !state) return;
  if (liveUserId && liveUserId !== state.user.id) stopRealtime();
  if (!liveUserId) startRealtime(state.user.id);
  void markConversationRead();
}

function updateBadges() {
  const badge = $('#unread-badge'); const n = unreadCount();
  if (badge) { badge.textContent = n; badge.hidden = !n; }
}

// Re-render without losing a half-typed message or the chat scroll position.
function renderFreshState() {
  const input = $('#message-form input[name="text"]');
  const draft = input?.value, focused = !!input && document.activeElement === input;
  const selection = focused ? [input.selectionStart, input.selectionEnd] : null;
  const oldList = $('.chat-messages'), position = oldList?.scrollTop;
  const atBottom = !oldList || oldList.scrollHeight - oldList.clientHeight - oldList.scrollTop < 64;
  render();
  const replacement = $('#message-form input[name="text"]');
  if (replacement && draft) { replacement.value = draft; }
  if (replacement && focused) { replacement.focus(); replacement.setSelectionRange(...selection); }
  const list = $('.chat-messages'); if (list) list.scrollTop = atBottom ? list.scrollHeight : position;
}

async function markConversationRead() {
  if (preview || view !== 'messages' || !state || !conversationId || readPending.has(conversationId) || document.hidden) return;
  if (!$('.chat-messages')?.getClientRects().length) return; // on phones the inbox list is showing, not the chat
  const c = state.conversations.find(x => x.id === conversationId);
  const latest = state.messages.filter(m => m.conversationId === conversationId && m.senderId !== state.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!c || !latest || c.readAt?.[state.user.id] >= latest.createdAt) return;
  const id = conversationId;
  readPending.add(id);
  try { await api(`/conversations/${id}/read`, {}); c.readAt = { ...c.readAt, [state.user.id]: latest.createdAt }; }
  catch (error) { console.error('Could not mark conversation read', error); }
  finally { readPending.delete(id); }
}

// Background refresh: only views that show live data are re-rendered, so browsing and forms aren't disturbed.
async function backgroundRefresh() {
  if (syncPromise && syncToken === authToken) { syncQueued = true; return syncPromise; }
  const token = authToken;
  const task = (async () => {
    const next = await api('/state');
    if (token !== authToken || !state || preview) return;
    state = next;
    if (['messages', 'activity', 'admin'].includes(view)) renderFreshState(); else updateBadges();
    syncLive();
  })();
  syncPromise = task; syncToken = token;
  try { return await task; }
  finally { if (syncPromise === task) { syncPromise = null; if (syncQueued) { syncQueued = false; liveRefresh(); } } }
}

function sessionExpired() {
  stopRealtime(); state = null; auth(); toast('Your session expired. Please sign in again.');
}

function liveRefresh() {
  void backgroundRefresh().catch(error => { if (error.status === 401) sessionExpired(); else console.warn('Could not refresh messages', error); });
}

function startRealtime(userId) {
  liveUserId = userId;
  const generation = ++liveGeneration;
  let delay = 1000;
  const reconnect = () => { if (generation === liveGeneration && authToken) { liveRetry = setTimeout(connect, delay); delay = Math.min(delay * 2, 30000); } };
  const connect = async () => {
    if (generation !== liveGeneration || !authToken) return;
    if (demo) {
      const controller = new AbortController(); liveAbort = controller;
      try {
        const response = await fetch('/api/events', { headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal });
        if (!response.ok || !response.body) throw new Error('Live connection unavailable');
        delay = 1000; liveRefresh();
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
        while (generation === liveGeneration) {
          const { value, done } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n'); buffer = parts.pop();
          for (const part of parts) if (part.includes('event: sync')) liveRefresh();
        }
      } catch (error) { if (error.name !== 'AbortError') console.warn('Live connection interrupted', error); }
      if (generation === liveGeneration) reconnect();
    } else {
      if (!config.wsUrl) return; // no WebSocket configured: the 15s background refresh still keeps chats up to date
      try {
        const { ticket } = await api('/realtime-ticket', {});
        if (generation !== liveGeneration) return;
        const socket = new WebSocket(`${config.wsUrl}?ticket=${encodeURIComponent(ticket)}`); liveSocket = socket;
        socket.onopen = () => { delay = 1000; liveRefresh(); };
        socket.onmessage = event => { try { if (JSON.parse(event.data).type === 'sync') liveRefresh(); } catch {} };
        socket.onclose = () => { if (liveSocket === socket) liveSocket = null; reconnect(); };
        socket.onerror = () => socket.close();
      } catch (error) { console.warn('Live connection interrupted', error); reconnect(); }
    }
  };
  void connect();
}

const imageUrl = path => (config.imageBaseUrl || '') + path;
const userName = id => state.users.find(x => x.id === id)?.name || 'Student';
const firstName = name => name.split(' ')[0];
const initials = name => name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
const currency = n => Number(n) === 0 ? 'Free' : '₹' + Number(n).toLocaleString('en-IN');
const ago = date => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(date)) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};
const niceDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const typeLabel = t => t === 'sale' ? 'For sale' : t === 'lost' ? 'Lost' : 'Found';
const placeVerb = t => t === 'sale' ? 'Pickup at' : t === 'lost' ? 'Last seen at' : 'Found at';
const unreadCount = () => state.notifications.filter(x => !x.read).length;
const openReports = () => state.reports.filter(r => r.status === 'open').length;
const today = () => new Date().toISOString().slice(0, 10);

function matchesFor(l) {
  if (l.type !== 'lost') return [];
  return state.listings
    .filter(x => x.type === 'found' && x.status === 'active' && x.category === l.category && x.ownerId !== l.ownerId)
    .sort((a, b) => Number(b.location === l.location) - Number(a.location === l.location))
    .slice(0, 3);
}

function photo(item, cls = '') {
  if (item.images?.length) return `<img class="photo ${cls}" src="${esc(imageUrl(item.images[0]))}" alt="${esc(item.title)}" loading="lazy">`;
  if (item.demo && samplePhotos[item.art]) return `<span class="photo-frame ${cls}"><img class="photo" src="${samplePhotos[item.art]}" alt="Example photo for ${esc(item.title)}" loading="lazy" width="900" height="675"><span class="sample-photo-label">Example photo</span></span>`;
  return `<div class="photo photo-empty ${cls}">${icon('camera')}<span>No photo uploaded</span></div>`;
}

function go(next) {
  const hash = '#/' + next;
  if (location.hash === hash) { render(); window.scrollTo({ top: 0 }); }
  else location.hash = hash;
}
function viewFromHash() {
  const v = location.hash.replace(/^#\/?/, '') || 'home';
  if (!VIEWS.includes(v)) return 'home';
  if (v === 'admin' && state?.user.role !== 'admin') return 'home';
  return v;
}
function resetFilters() { query = ''; category = ALL_CATEGORIES; place = ANYWHERE; sort = 'newest'; }

/* ---------- Layout ---------- */
function header() {
  const unread = unreadCount();
  const link = (v, label) => `<a href="#/${v}" data-nav class="nav-link ${view === v ? 'active' : ''}">${label}</a>`;
  return `${preview ? `<div class="preview-bar">${icon('sparkle')}<span><b>Preview mode.</b> You’re seeing sample data because the VITFinds server isn’t running. Start it with <code>npm start</code> and open <a href="http://127.0.0.1:3000">127.0.0.1:3000</a> to use everything.</span></div>` : ''}<header class="topbar">
    <div class="topbar-inner">
      <a class="logo" href="#/home" data-nav aria-label="VITFinds home"><span class="logo-mark" aria-hidden="true">V</span><span>VIT<em>Finds</em><b>.</b></span></a>
      <nav class="main-nav" aria-label="Main">
        ${link('all', 'Browse')}${link('lost', 'Lost')}${link('found', 'Found')}${link('sale', 'Marketplace')}
        <a href="#/home" data-nav data-scroll="how" class="nav-link">How it works</a>
        <div class="mobile-only nav-sep"></div>
        <div class="mobile-only">${link('saved', 'Saved items')}${link('mine', 'My listings')}${link('messages', 'Messages')}${link('activity', 'Activity')}${state.user.role === 'admin' ? link('admin', 'Moderation') : ''}</div>
      </nav>
      <div class="top-actions">
        <a href="#/messages" data-nav class="icon-btn desktop-only ${view === 'messages' ? 'active' : ''}" aria-label="Messages" title="Messages">${icon('chat')}</a>
        <a href="#/activity" data-nav class="icon-btn ${view === 'activity' ? 'active' : ''}" aria-label="Activity, ${unread} unread" title="Activity">${icon('bell')}<span class="dot-badge" id="unread-badge" ${unread ? '' : 'hidden'}>${unread}</span></a>
        <button class="btn btn-primary btn-sm post-btn" data-action="post">${icon('plus')}<span>Post item</span></button>
        <div class="user-wrap">
          <button class="avatar-btn" data-action="user-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${esc(initials(state.user.name))}</button>
          <div class="user-menu" id="user-menu" role="menu" hidden>
            <div class="user-menu-head"><strong>${esc(state.user.name)}</strong><small>${demo ? (state.user.id.startsWith('demo-') ? 'Demo account' : 'Local account') : 'Email verified'} · VIT Vellore</small></div>
            <a role="menuitem" href="#/saved" data-nav>${icon('heart')} Saved items <span class="count">${state.saved.length}</span></a>
            <a role="menuitem" href="#/mine" data-nav>${icon('box')} My listings</a>
            <a role="menuitem" href="#/messages" data-nav>${icon('chat')} Messages <span class="count">${state.conversations.length}</span></a>
            <a role="menuitem" href="#/activity" data-nav>${icon('bell')} Activity ${unread ? `<span class="count hot">${unread}</span>` : ''}</a>
            ${state.user.role === 'admin' ? `<a role="menuitem" href="#/admin" data-nav>${icon('shield')} Moderation <span class="count">${openReports()}</span></a>` : ''}
            <hr>
            ${demo ? `<button role="menuitem" data-action="account">${icon('user')} Switch account</button>` : ''}
            <button role="menuitem" data-action="logout">${icon('logout')} Sign out</button>
          </div>
        </div>
        <button class="icon-btn menu-btn" data-action="menu" aria-label="Open menu" aria-expanded="false">${icon('menu')}</button>
      </div>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <a class="logo" href="#/home" data-nav><span class="logo-mark" aria-hidden="true">V</span><span>VIT<em>Finds</em><b>.</b></span></a>
        <p>The campus lost & found and student marketplace for VIT Vellore. Made by students, for students.</p>
      </div>
      <div class="footer-cols">
        <div><h4>Explore</h4><a href="#/lost" data-nav>Lost items</a><a href="#/found" data-nav>Found items</a><a href="#/sale" data-nav>Marketplace</a></div>
        <div><h4>You</h4><a href="#/saved" data-nav>Saved</a><a href="#/mine" data-nav>My listings</a><a href="#/messages" data-nav>Messages</a></div>
        <div><h4>Help</h4><a href="#/home" data-nav data-scroll="how">How it works</a><a href="#/home" data-nav data-scroll="faq">FAQs</a></div>
      </div>
    </div>
    <div class="footer-base"><span>© ${new Date().getFullYear()} VITFinds</span><span>Meet in public campus spots. Never share ID numbers in a listing.</span></div>
  </footer>`;
}

function render() {
  if (!state) return;
  const pages = { home, messages, activity, admin };
  const content = (pages[view] || browse)();
  $('#app').innerHTML = `${header()}<main class="page page-${view}" id="main">${content}</main>${footer()}`;
  const chat = $('.chat-messages');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

/* ---------- Cards ---------- */
function card(item) {
  const saved = state.saved.includes(item.id);
  const footerPart = item.type === 'sale'
    ? `<span class="price">${currency(item.price)}<small>${item.negotiable ? 'Open to offers' : esc(item.condition)}</small></span>`
    : `<span class="by"><span class="mini-avatar">${esc(initials(userName(item.ownerId)))}</span>${esc(firstName(userName(item.ownerId)))}</span>`;
  return `<article class="card card-${esc(item.type)} ${item.status !== 'active' ? 'is-closed' : ''}">
    <div class="card-media">
      <button class="media-btn" data-action="detail" data-id="${esc(item.id)}" aria-label="View ${esc(item.title)}">${photo(item)}</button>
      <span class="badge badge-${esc(item.type)}">${typeLabel(item.type)}</span>
      <button class="save-btn ${saved ? 'saved' : ''}" data-action="save" data-id="${esc(item.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save'} ${esc(item.title)}">${icon('heart')}</button>
      ${item.status !== 'active' ? `<span class="ribbon">${esc(item.status)}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="tags"><span class="tag">${esc(item.category)}</span><span class="tag tag-plain">${icon('pin')}${esc(item.location)}</span></div>
      <h3><button data-action="detail" data-id="${esc(item.id)}">${esc(item.title)}</button></h3>
      <p class="card-when">${typeLabel(item.type)} · ${ago(item.createdAt)}</p>
      <div class="card-foot">${footerPart}<button class="round-btn" data-action="detail" data-id="${esc(item.id)}" aria-label="Open ${esc(item.title)}">${icon('arrow')}</button></div>
    </div>
  </article>`;
}

function emptyState(title, text, withPost = true) {
  return `<div class="empty"><div class="empty-art">${icon('search')}</div><h3>${title}</h3><p>${text}</p>${withPost ? `<button class="btn btn-primary" data-action="post">${icon('plus')} Post an item</button>` : ''}</div>`;
}

/* ---------- Home ---------- */
function home() {
  const active = state.listings.filter(l => l.status === 'active');
  const stats = [
    [active.filter(l => l.type === 'found').length, 'found items waiting for owners'],
    [state.listings.filter(l => l.status === 'returned').length, 'items returned home'],
    [active.filter(l => l.type === 'lost').length, 'students looking for something'],
    [active.filter(l => l.type === 'sale').length, 'things for sale on campus']
  ];
  const myMatches = state.listings
    .filter(l => l.type === 'lost' && l.ownerId === state.user.id && l.status === 'active')
    .map(l => ({ l, found: matchesFor(l) }))
    .filter(x => x.found.length);
  const tabItems = state.listings
    .filter(l => homeTab === 'all' || l.type === homeTab)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  return `
  <section class="hero">
    <div class="hero-copy">
      <span class="pill"><span class="pulse"></span>${stats[0][0]} found ${stats[0][0] === 1 ? 'item is' : 'items are'} waiting at VIT Vellore</span>
      <h1>Lost something on campus? <em>Let’s</em> get it <em>back.</em></h1>
      <p class="lede">VITFinds connects the student who lost it with the student who found it. Search what’s been handed in, claim it privately, and sort the handover in chat.</p>
      <form class="hero-search" id="hero-search" role="search">
        <label class="hs-field">${icon('search')}<input name="q" type="search" placeholder="Try “black headphones” or “ID card”" aria-label="What are you looking for?"></label>
        <select name="type" aria-label="Listing type"><option value="all">Everything</option><option value="found">Found items</option><option value="lost">Lost reports</option><option value="sale">For sale</option></select>
        <button class="btn btn-primary">Search</button>
      </form>
      <div class="quick">
        <span>Popular:</span>
        ${['ID & essentials', 'Electronics', 'Books & stationery', 'Cycles & sports'].map(c => `<button class="chip" data-action="quick-category" data-id="${esc(c)}">${icon(categoryIcons[c])} ${esc(c)}</button>`).join('')}
      </div>
    </div>
    <div class="hero-visual">${heroStack()}</div>
  </section>

  <section class="stats" aria-label="Campus numbers">
    ${stats.map(([n, t]) => `<div class="stat"><strong>${n}</strong><span>${t}</span></div>`).join('')}
  </section>

  ${myMatches.length ? `<section class="section matches-band">
    <div class="section-head"><div><p class="eyebrow">${icon('sparkle')} Just for you</p><h2>Possible <em>matches</em> for your lost items</h2></div></div>
    <div class="match-list">${myMatches.map(({ l, found }) => `<div class="match-card">
      <p class="match-for">You lost: <strong>${esc(l.title)}</strong></p>
      ${found.map(f => `<button class="match-row" data-action="detail" data-id="${esc(f.id)}"><span class="match-thumb">${photo(f)}</span><span><strong>${esc(f.title)}</strong><small>${icon('pin')} ${esc(f.location)} · ${ago(f.createdAt)}</small></span>${icon('right')}</button>`).join('')}
    </div>`).join('')}</div>
    <p class="fine">Matched by category, with nearby places first. The finder still checks ownership before handing anything over.</p>
  </section>` : ''}

  <section class="section intents">
    <button class="intent intent-lost" data-action="post" data-id="lost"><span class="intent-icon">${icon('lost')}</span><strong>I lost something</strong><span>Put the word out across campus in under a minute.</span><span class="intent-go">${icon('arrow')}</span></button>
    <button class="intent intent-found" data-action="post" data-id="found"><span class="intent-icon">${icon('found')}</span><strong>I found something</strong><span>Post it, keep one detail secret, and make someone’s day.</span><span class="intent-go">${icon('arrow')}</span></button>
    <button class="intent intent-sale" data-action="post" data-id="sale"><span class="intent-icon">${icon('sale')}</span><strong>I’m selling</strong><span>Books, cycles, lamps. Give them a second semester.</span><span class="intent-go">${icon('arrow')}</span></button>
  </section>

  <section class="section how" id="how">
    <div class="section-head center"><p class="eyebrow">How it works</p><h2>Three steps from <em>“where is it?”</em> to <em>“got it!”</em></h2></div>
    <div class="steps">
      <article class="step">
        <span class="step-no">01</span>
        <h3>Post it in a minute</h3>
        <p>Add a title, photo, category, and the campus spot. Finders keep one identifying detail to themselves.</p>
        <div class="mock mock-form">
          <div class="mock-row"><span class="mock-label">Item</span><span class="mock-input">Blue water bottle</span></div>
          <div class="mock-row two"><span class="mock-input">${icon('tag')} Hostel essentials</span><span class="mock-input">${icon('pin')} SJT</span></div>
          <span class="mock-btn">Publish listing</span>
        </div>
      </article>
      <article class="step">
        <span class="step-no">02</span>
        <h3>Search, filter, match</h3>
        <p>Filter by category and location. When you report something lost, we point you to found items that look like it.</p>
        <div class="mock mock-filters">
          <span class="mock-chip on">Found</span><span class="mock-chip">Electronics</span><span class="mock-chip">Main Library</span>
          <div class="mock-result"><span class="mock-dot"></span><span><b>Possible match</b><small>Black headphones · Main Library</small></span></div>
        </div>
        <button class="btn btn-ghost btn-sm" data-action="goto" data-id="found">Start searching ${icon('arrow')}</button>
      </article>
      <article class="step">
        <span class="step-no">03</span>
        <h3>Claim privately, meet safely</h3>
        <p>Describe a detail only the owner would know. The finder reviews it, you chat in-app, and meet at a public spot.</p>
        <div class="mock mock-chat">
          <span class="bubble in">It has a sticker of a cat on the left cup</span>
          <span class="bubble out">That’s it! Foodys at 5?</span>
          <span class="mock-status">${icon('check')} Claim accepted · Returned</span>
        </div>
      </article>
    </div>
  </section>

  <section class="section fresh">
    <div class="section-head">
      <div><p class="eyebrow">Fresh on campus</p><h2>Recently <em>posted</em></h2></div>
      <div class="tabs" role="tablist">
        ${[['found', 'Found'], ['lost', 'Lost'], ['sale', 'For sale'], ['all', 'All']].map(([k, t]) => `<button role="tab" aria-selected="${homeTab === k}" class="tab ${homeTab === k ? 'on' : ''}" data-action="home-tab" data-id="${k}">${t}</button>`).join('')}
      </div>
    </div>
    <div class="grid">${tabItems.length ? tabItems.map(card).join('') : emptyState('Nothing here yet', 'Be the first to post in this section.')}</div>
    <div class="center-row"><a class="btn btn-outline" href="#/${homeTab}" data-nav>See everything ${icon('arrow')}</a></div>
  </section>

  <section class="section faq" id="faq">
    <div class="faq-intro"><p class="eyebrow">FAQs</p><h2>Good <em>questions.</em></h2><p>Everything you need to know before you post, claim, or buy.</p></div>
    <div class="faq-list">${faqs().map(([q, a], i) => `<details ${i === 0 ? 'open' : ''}><summary>${q}<span class="plus" aria-hidden="true"></span></summary><p>${a}</p></details>`).join('')}</div>
  </section>

  <section class="cta-band">
    <h2>Lost it? <em>Find</em> it.<br>Found it? <em>Return</em> it.</h2>
    <div class="cta-actions"><a class="btn btn-light" href="#/found" data-nav>${icon('search')} Start searching</a><button class="btn btn-outline-light" data-action="post">${icon('plus')} Post an item</button></div>
  </section>`;
}

function heroItems() {
  return state.listings
    .filter(l => l.status === 'active')
    .sort((a, b) => (a.type === 'found' ? -1 : 0) - (b.type === 'found' ? -1 : 0) || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
}

function heroStack() {
  const items = heroItems();
  if (!items.length) {
    return `<div class="stack"><div class="stack-card pos-0 placeholder"><div class="photo art art-found">${icon('search')}</div><div class="stack-body"><span class="badge badge-found">Found</span><h3>The first find shows up here</h3><p>Post something you found and it will appear on this board.</p></div></div></div>`;
  }
  heroIndex = ((heroIndex % items.length) + items.length) % items.length;
  const ordered = items.map((_, i) => items[(heroIndex + i) % items.length]).slice(0, 3);
  return `<div class="stack" aria-roledescription="carousel" aria-label="Latest on campus">
    ${ordered.map((item, i) => `<article class="stack-card pos-${i}" ${i ? 'aria-hidden="true"' : ''}>
      <button class="stack-media" data-action="detail" data-id="${esc(item.id)}" ${i ? 'tabindex="-1"' : ''} aria-label="View ${esc(item.title)}">${photo(item)}</button>
      <div class="stack-body">
        <div class="tags"><span class="badge badge-${esc(item.type)}">${typeLabel(item.type)}</span><span class="tag">${esc(item.category)}</span></div>
        <h3>${esc(item.title)}</h3>
        <p>${icon('pin')} ${placeVerb(item.type)} ${esc(item.location)} · ${ago(item.createdAt)}</p>
      </div>
    </article>`).reverse().join('')}
    <div class="stack-nav">
      <button class="round-btn" data-action="hero-prev" aria-label="Previous item">${icon('left')}</button>
      <span class="dots">${items.map((_, i) => `<span class="${i === heroIndex ? 'on' : ''}"></span>`).join('')}</span>
      <button class="round-btn" data-action="hero-next" aria-label="Next item">${icon('right')}</button>
    </div>
  </div>`;
}

function faqs() {
  return [
    ['Who can use VITFinds?', 'You can create an account with a Gmail address. Verify your email before posting, claiming items, or messaging. VITFinds is designed for the campus community.'],
    ['How do I claim something someone found?', 'Open the listing and choose <b>This is mine</b>. Describe a private detail, a mark, or what’s inside. Only the finder sees your claim, and they confirm once it has been handed back.'],
    ['I found something. What should I post?', 'A clear title, a photo, where and when you found it. Keep one identifying detail (a sticker, a wallpaper, the contents) out of the post so you can check claims.'],
    ['Is my phone number shared?', 'No. Conversations stay inside VITFinds. Agree on a public spot like Foodys, the library, or the main gate to hand things over.'],
    ['Can I sell things too?', 'Yes. Marketplace listings have a price, condition, and an “open to offers” option. You can mark an item reserved or sold when it’s gone.'],
    ['How do “possible matches” work?', 'When you report something lost, VITFinds shows found items in the same category, with nearby places first. It’s a helpful nudge, not image recognition.'],
    ['What if a listing looks wrong?', 'Use <b>Report this listing</b>. Campus moderators review reports and remove anything that breaks the rules.']
  ];
}

/* ---------- Browse ---------- */
function filtered() {
  const q = query.trim().toLowerCase();
  return state.listings
    .filter(l =>
      (['all', 'saved', 'mine'].includes(view) || l.type === view) &&
      (view !== 'saved' || state.saved.includes(l.id)) &&
      (view !== 'mine' || l.ownerId === state.user.id) &&
      (category === ALL_CATEGORIES || l.category === category) &&
      (place === ANYWHERE || l.location === place) &&
      `${l.title} ${l.description} ${l.category} ${l.location}`.toLowerCase().includes(q))
    .sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : new Date(b.createdAt) - new Date(a.createdAt));
}

function results() {
  const rows = filtered();
  if (rows.length) return rows.map(card).join('');
  if (view === 'saved') return emptyState('No saved items yet', 'Tap the heart on any listing to keep an eye on it.', false);
  if (view === 'mine') return emptyState('You haven’t posted yet', 'Lost something, found something, or have something to sell?');
  return emptyState('No items match', 'Try a different search or filter, or be the first to post.');
}

function browse() {
  const heads = {
    all: ['Browse campus', 'Everything <em>around</em> campus', 'Lost reports, found items, and student sales in one place.'],
    lost: ['Lost items', 'Help bring it <em>back.</em>', 'Students are looking for these. Seen one? Send them a message.'],
    found: ['Found items', 'Someone’s <em>looking</em> for these.', 'Recognise something? Claim it with a detail only you would know.'],
    sale: ['Marketplace', 'Good things, <em>second</em> semester.', 'Buy and sell with students on campus. No delivery fees, no strangers.'],
    saved: ['Saved items', 'Worth coming <em>back</em> to.', 'The listings you’re keeping an eye on.'],
    mine: ['My listings', 'Your corner of <em>campus.</em>', 'Edit posts, update their status, and review claims.']
  };
  const [eyebrow, title, sub] = heads[view];
  const typeTabs = ['all', 'lost', 'found', 'sale'].includes(view)
    ? `<div class="tabs" role="tablist">${[['all', 'All'], ['lost', 'Lost'], ['found', 'Found'], ['sale', 'For sale']].map(([k, t]) => `<a role="tab" aria-selected="${view === k}" class="tab ${view === k ? 'on' : ''}" href="#/${k}" data-keep>${t}</a>`).join('')}</div>`
    : '';
  const count = filtered().length;
  return `<section class="page-head">
      <div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="lede">${sub}</p></div>
      <button class="btn btn-primary" data-action="post" data-id="${['lost', 'found', 'sale'].includes(view) ? view : ''}">${icon('plus')} Post an item</button>
    </section>
    <section class="toolbar">
      ${typeTabs}
      <div class="filters">
        <label class="search">${icon('search')}<input id="search" type="search" placeholder="Search a book, bottle, backpack…" aria-label="Search listings" value="${esc(query)}"></label>
        <select id="category" aria-label="Category">${[ALL_CATEGORIES, ...categories].map(x => `<option ${category === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <select id="location" aria-label="Location">${[ANYWHERE, ...locations].map(x => `<option ${place === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <select id="sort" aria-label="Sort"><option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest first</option><option value="price-low" ${sort === 'price-low' ? 'selected' : ''}>Price: low to high</option><option value="price-high" ${sort === 'price-high' ? 'selected' : ''}>Price: high to low</option></select>
      </div>
    </section>
    <div class="result-line"><span><strong id="result-count">${count}</strong> ${count === 1 ? 'item' : 'items'}</span><button class="link-btn" data-action="reset-filters">Reset filters</button></div>
    <div class="grid" id="listing-grid">${results()}</div>`;
}

function updateResults() {
  $('#listing-grid').innerHTML = results();
  const n = filtered().length;
  $('.result-line span').innerHTML = `<strong id="result-count">${n}</strong> ${n === 1 ? 'item' : 'items'}`;
}

/* ---------- Messages / Activity / Admin ---------- */
function messages() {
  if (!state.conversations.some(c => c.id === conversationId)) conversationId = state.conversations[0]?.id || null;
  const c = state.conversations.find(x => x.id === conversationId);
  const l = c && state.listings.find(x => x.id === c.listingId);
  const other = conv => userName(conv.members.find(id => id !== state.user.id));
  const thread = conv => state.messages.filter(m => m.conversationId === conv.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastMsg = conv => thread(conv).at(-1);
  const unread = conv => state.messages.filter(m => m.conversationId === conv.id && m.senderId !== state.user.id && m.createdAt > (conv.readAt?.[state.user.id] || '')).length;
  const threads = [...state.conversations].sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt));
  const seen = m => c.readAt?.[c.members.find(id => id !== state.user.id)] >= m.createdAt;
  return `<section class="page-head"><div><p class="eyebrow">Messages</p><h1>Campus <em>conversations.</em></h1><p class="lede">Your number stays private. Sort out the details here.</p></div></section>
  <div class="inbox ${c && showThread ? 'has-open' : ''}">
    <aside class="threads">
      <h2>Inbox <span>${state.conversations.length}</span></h2>
      ${threads.map(x => `<button class="thread ${x.id === conversationId ? 'on' : ''}" data-action="conversation" data-id="${esc(x.id)}">
        <span class="avatar">${esc(initials(other(x)))}</span>
        <span class="thread-copy"><strong>${esc(other(x))}</strong><small>${esc(state.listings.find(li => li.id === x.listingId)?.title || 'Unavailable listing')}</small><em>${esc(lastMsg(x)?.text || '')}</em></span>
        ${unread(x) && x.id !== conversationId ? `<span class="unread-count" aria-label="${unread(x)} unread">${unread(x)}</span>` : ''}
      </button>`).join('') || '<p class="muted pad">Start a conversation from any listing.</p>'}
    </aside>
    <section class="chat">
      ${c ? `<div class="chat-head">
          <button class="icon-btn back-btn" data-action="conversation" data-id="" aria-label="Back to inbox">${icon('left')}</button>
          <span class="avatar">${esc(initials(other(c)))}</span>
          <div><strong>${esc(other(c))}</strong><small>${l ? `<button class="link-btn" data-action="detail" data-id="${esc(l.id)}">${esc(l.title)}</button>` : 'Unavailable listing'}</small></div>
        </div>
        <div class="chat-messages">
          <p class="chat-tip">${icon('shield')} Meet in a public campus spot. Never share passwords or ID numbers.</p>
          ${thread(c).map(m => `<div class="msg ${m.senderId === state.user.id ? 'out' : 'in'}"><p>${esc(m.text)}</p><small>${new Date(m.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${m.senderId === state.user.id ? ` · ${seen(m) ? 'Read' : 'Sent'}` : ''}</small></div>`).join('')}
        </div>
        <form id="message-form" class="chat-compose"><input name="text" required maxlength="2000" autocomplete="off" aria-label="Message" placeholder="Write a message…"><button class="btn btn-primary">Send</button></form>`
      : `<div class="empty"><div class="empty-art">${icon('chat')}</div><h3>A conversation starts here</h3><p>Contact a student from a listing to return, find, or buy an item.</p><a class="btn btn-outline" href="#/all" data-nav>Browse listings</a></div>`}
    </section>
  </div>`;
}

function activity() {
  const list = state.notifications.slice().reverse();
  return `<section class="page-head"><div><p class="eyebrow">Activity</p><h1>Stay in the <em>loop.</em></h1><p class="lede">Messages, claims, and updates about your listings.</p></div>${unreadCount() ? `<button class="btn btn-outline" data-action="read">${icon('check')} Mark all read</button>` : ''}</section>
  <div class="feed-list">${list.map(n => `<article class="note ${n.read ? '' : 'unread'}"><span class="note-icon">${icon(n.read ? 'check' : 'bell')}</span><div><p>${esc(n.message)}</p><small>${ago(n.createdAt)}</small></div></article>`).join('') || emptyState('You’re all caught up', 'Updates about your listings and claims will show up here.', false)}</div>`;
}

function admin() {
  const open = state.reports.filter(r => r.status === 'open');
  return `<section class="page-head"><div><p class="eyebrow">Moderation</p><h1>Keep campus <em>helpful.</em></h1><p class="lede">Review reports from students and remove listings that break the rules.</p></div></section>
  <div class="feed-list">${open.map(r => {
    const l = state.listings.find(x => x.id === r.listingId);
    return `<article class="report">
      <div><h3>${l ? `<button class="link-btn" data-action="detail" data-id="${esc(l.id)}">${esc(l.title)}</button>` : 'Unavailable listing'}</h3><p>${esc(r.reason)}</p><small>Reported by ${esc(userName(r.userId))} · ${ago(r.createdAt)}</small></div>
      <div class="btn-row"><button class="btn btn-outline btn-sm" data-action="moderate" data-id="${esc(r.id)}" data-value="dismiss">Dismiss</button><button class="btn btn-danger btn-sm" data-action="moderate" data-id="${esc(r.id)}" data-value="remove">Remove listing</button></div>
    </article>`;
  }).join('') || emptyState('No open reports', 'New reports from students will appear here.', false)}</div>`;
}

/* ---------- Dialogs ---------- */
function showModal(html, cls = '') {
  const d = $('#modal');
  d.className = cls;
  d.innerHTML = `<button class="close-modal" data-action="close" aria-label="Close dialog">${icon('close')}</button>${html}`;
  const heading = d.querySelector('h2');
  if (heading) { heading.id = 'dialog-title'; d.setAttribute('aria-labelledby', 'dialog-title'); }
  if (!d.open) d.showModal();
}

function detail(id) {
  const l = state.listings.find(x => x.id === id);
  if (!l) return toast('This listing is no longer available.');
  const isOwner = l.ownerId === state.user.id;
  const claims = state.claims.filter(c => c.listingId === l.id);
  const matches = matchesFor(l);
  const owner = state.users.find(u => u.id === l.ownerId);
  const myPendingClaim = claims.some(c => c.userId === state.user.id && c.status === 'pending');

  let actions = '';
  if (isOwner) {
    actions = `<form id="status-form" data-id="${esc(l.id)}" class="status-form">
        <label>Listing status<select name="status">${(l.type === 'sale' ? ['active', 'reserved', 'sold'] : ['active', 'returned']).map(x => `<option value="${x}" ${l.status === x ? 'selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></label>
        <button class="btn btn-primary">Update</button>
      </form>
      <div class="btn-row"><button class="btn btn-outline btn-sm" data-action="edit-listing" data-id="${esc(l.id)}">Edit listing</button><button class="link-btn danger-text" data-action="archive-listing" data-id="${esc(l.id)}">Remove my listing</button></div>`;
  } else if (l.status === 'active') {
    actions = `<div class="btn-row">
        <button class="btn btn-primary grow" data-action="contact" data-id="${esc(l.id)}">${icon('chat')} ${l.type === 'sale' ? 'Message seller / make offer' : l.type === 'lost' ? 'I’ve seen this' : 'Message finder'}</button>
        ${l.type === 'found' ? `<button class="btn btn-accent" data-action="claim" data-id="${esc(l.id)}" ${myPendingClaim ? 'disabled' : ''}>${icon('check')} ${myPendingClaim ? 'Claim pending' : 'This is mine'}</button>` : ''}
      </div>`;
  } else {
    actions = `<p class="info-box">${icon('lock')} This listing is ${esc(l.status)} and no longer open for new requests.</p>`;
  }

  showModal(`<div class="detail">
    <div class="detail-media">
      <div class="detail-main">${photo(l)}<span class="badge badge-${esc(l.type)}">${typeLabel(l.type)}</span></div>
      ${l.images?.length > 1 ? `<div class="thumbs">${l.images.map((src, i) => `<button class="${i === 0 ? 'on' : ''}" data-action="thumb" data-value="${esc(imageUrl(src))}" aria-label="Show photo ${i + 1}"><img src="${esc(imageUrl(src))}" alt=""></button>`).join('')}</div>` : ''}
    </div>
    <div class="detail-body">
      <p class="eyebrow">${esc(l.category)} · <span class="status status-${esc(l.status)}">${esc(l.status)}</span></p>
      <h2>${esc(l.title)}</h2>
      ${l.type === 'sale' ? `<p class="detail-price">${currency(l.price)} <small>${esc(l.condition)}${l.negotiable ? ' · Open to offers' : ''}</small></p>` : ''}
      <div class="meta-row"><span>${icon('pin')} ${placeVerb(l.type)} ${esc(l.location)}</span><span>${icon('calendar')} ${niceDate(l.date)}</span><span>${icon('clock')} Posted ${ago(l.createdAt)}</span></div>
      <p class="description">${esc(l.description)}</p>
      <div class="owner"><span class="avatar">${esc(initials(userName(l.ownerId)))}</span><div><strong>${esc(userName(l.ownerId))}${isOwner ? ' (you)' : ''}</strong><small>${l.demo ? 'Sample student' : owner?.verified ? `${icon('shield')} Email verified` : 'Student'}</small></div></div>
      ${actions}
      ${claims.length ? `<h3 class="sub">Ownership claims</h3>${claims.map(c => `<div class="claim"><div class="claim-top"><strong>${esc(userName(c.userId))}</strong><span class="status status-${esc(c.status)}">${esc(c.status)}</span></div><p>${esc(c.proof)}</p>${isOwner && c.status === 'pending' && l.status === 'active' ? `<div class="btn-row"><button class="btn btn-primary btn-sm" data-action="claim-review" data-id="${esc(c.id)}" data-value="accepted">${icon('check')} Confirm returned</button><button class="btn btn-outline btn-sm" data-action="claim-review" data-id="${esc(c.id)}" data-value="rejected">Decline</button></div>` : ''}</div>`).join('')}` : ''}
      ${matches.length ? `<h3 class="sub">${icon('sparkle')} Possible matches</h3><p class="fine">Same category, nearby places first. Ownership still needs to be checked.</p>${matches.map(x => `<button class="match-row" data-action="detail" data-id="${esc(x.id)}"><span class="match-thumb">${photo(x)}</span><span><strong>${esc(x.title)}</strong><small>${icon('pin')} ${esc(x.location)}</small></span>${icon('right')}</button>`).join('')}` : ''}
      ${!isOwner ? `<button class="link-btn report-link" data-action="report" data-id="${esc(l.id)}">${icon('flag')} Report this listing</button>` : ''}
    </div>
  </div>`, 'wide');
}

function post(type, listing) {
  const editing = !!listing;
  const chosen = listing?.type || (['lost', 'found', 'sale'].includes(type) ? type : (['lost', 'found', 'sale'].includes(view) ? view : 'lost'));
  const v = key => esc(listing?.[key] ?? '');
  const options = [['lost', 'lost', 'I lost something', 'Ask campus for help'], ['found', 'found', 'I found something', 'Help it get home'], ['sale', 'sale', 'I’m selling', 'Pass it on']];
  showModal(`<div class="dialog-pad">
    <p class="eyebrow">${editing ? 'Edit listing' : 'New listing'}</p>
    <h2>${editing ? 'Update your <em>post</em>' : 'What brings you <em>here?</em>'}</h2>
    <form id="post-form" novalidate>
      ${editing ? `<input type="hidden" name="id" value="${v('id')}"><input type="hidden" name="type" value="${v('type')}">` : ''}
      <div class="type-pick">${options.map(([val, ic, t, s]) => `<label class="type-opt type-${val}"><input type="radio" name="type" value="${val}" ${chosen === val ? 'checked' : ''} ${editing ? 'disabled' : ''}><span>${icon(ic)}<b>${t}</b><small>${s}</small></span></label>`).join('')}</div>
      <label>Title<input name="title" required minlength="5" maxlength="100" value="${v('title')}" placeholder="e.g. Black headphones near the library"></label>
      <div class="cols">
        <label>Category<select name="category">${categories.map(x => `<option ${listing?.category === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label>Campus location<select name="location">${locations.map(x => `<option ${listing?.location === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      </div>
      <label>Description<textarea name="description" required minlength="15" maxlength="2000" rows="4" placeholder="Colour, brand, what’s inside. If you found it, keep one identifying detail private.">${v('description')}</textarea></label>
      <div class="cols">
        <label>Date<input name="date" type="date" required max="${today()}" value="${v('date') || today()}"></label>
        <label class="file-drop">${icon('camera')}<span><b>Add photos</b><small>Up to 3 · JPEG, PNG, WebP · 3 MB each</small></span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
      </div>
      <div class="previews" id="photo-preview"></div>
      <div id="sale-fields" class="cols three">
        <label>Price (₹)<input name="price" type="number" min="0" max="1000000" step="1" value="${listing?.price ?? 0}"></label>
        <label>Condition<select name="condition">${['Good', 'New', 'Like new', 'Fair'].map(x => `<option ${listing?.condition === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="check"><input name="negotiable" type="checkbox" ${listing ? (listing.negotiable ? 'checked' : '') : 'checked'}> Open to offers</label>
      </div>
      <p class="form-error" role="alert"></p>
      <button class="btn btn-primary full">${editing ? 'Save changes' : 'Publish listing'} ${icon('arrow')}</button>
      <p class="fine center">${editing ? 'New photos replace the current ones. Leave photos empty to keep them.' : 'Only post items allowed on campus. Never include ID numbers or phone numbers.'}</p>
    </form>
  </div>`);
  updateSaleFields();
}

function updateSaleFields() {
  const el = $('#sale-fields');
  const picked = $('#post-form [name="type"]:checked') || $('#post-form input[type="hidden"][name="type"]');
  if (el && picked) el.hidden = picked.value !== 'sale';
}

function inputDialog(kind, id) {
  const l = state.listings.find(x => x.id === id);
  const data = {
    contact: ['Start a <em>conversation</em>', 'message', 'Introduce yourself, ask a question, or make an offer.', 'Send message', 1, 'Hi! Is this still available?'],
    claim: ['Is this <em>yours?</em>', 'proof', 'Describe something only the owner would know: a mark, a sticker, the contents. Only the finder sees this.', 'Submit claim', 15, 'e.g. There is a small crack on the left side and my initials inside the cover.'],
    report: ['Report this <em>listing</em>', 'reason', 'Tell the moderators what’s wrong with this listing.', 'Send report', 10, 'e.g. This looks like spam or a prohibited item.']
  }[kind];
  showModal(`<div class="dialog-pad">
    <p class="eyebrow">${esc(l?.title || 'VITFinds')}</p>
    <h2>${data[0]}</h2>
    <form id="action-form" data-kind="${kind}" data-id="${esc(id)}">
      <label>${data[2]}<textarea name="${data[1]}" rows="5" minlength="${data[4]}" maxlength="1000" required placeholder="${esc(data[5])}"></textarea></label>
      ${kind === 'claim' ? `<p class="fine">${icon('lock')} Your claim is private between you and the finder.</p>` : ''}
      <p class="form-error" role="alert"></p>
      <button class="btn btn-primary full">${data[3]} ${icon('arrow')}</button>
    </form>
  </div>`);
}

function account() {
  const people = [['demo-me', 'Alex Student', 'Lost a backpack, selling a lamp'], ['demo-priya', 'Priya S.', 'Found headphones, selling a bicycle'], ['demo-arjun', 'Arjun R.', 'Found keys, selling a textbook'], ['demo-admin', 'Campus moderator', 'Reviews reported listings']];
  showModal(`<div class="dialog-pad">
    <p class="eyebrow">Your account</p>
    <h2>${esc(state.user.name)}</h2>
    ${demo ? `<p class="muted">These are local sample accounts. Switch between students to try messages, claims, and moderation.</p>
      <div class="accounts">${people.map(([id, name, desc]) => `<button class="${state.user.id === id ? 'on' : ''}" data-action="demo-account" data-id="${id}"><span class="avatar">${initials(name)}</span><span><strong>${name}</strong><small>${desc}</small></span>${state.user.id === id ? icon('check') : icon('right')}</button>`).join('')}</div>`
      : '<p class="muted">Your Gmail address has been verified.</p>'}
    <button class="btn btn-outline full" data-action="logout">${icon('logout')} Sign out</button>
  </div>`);
}

/* ---------- Auth ---------- */
function auth(mode = 'login', email = $('#auth-form [name="email"]')?.value || '') {
  const titles = { login: 'Welcome <em>back.</em>', signup: 'Join your <em>campus.</em>', verify: 'Check your <em>inbox.</em>', forgot: 'Let’s get you <em>back in.</em>', reset: 'Choose a new <em>password.</em>' };
  const button = { login: 'Sign in', signup: 'Create account', verify: 'Verify email', forgot: 'Send reset code', reset: 'Reset password' }[mode];
  $('#app').innerHTML = `<div class="auth">
    <aside class="auth-side">
      <a class="logo light" href="#/home"><span class="logo-mark" aria-hidden="true">V</span><span>VIT<em>Finds</em><b>.</b></span></a>
      <div>
        <h1>Find what you’ve <em>lost.</em><br>Return what you’ve <em>found.</em></h1>
        <ul class="auth-points">
          <li>${icon('search')} Search everything handed in around campus</li>
          <li>${icon('lock')} Claim privately with a detail only you know</li>
          <li>${icon('chat')} Chat in-app, no phone numbers shared</li>
          <li>${icon('tag')} Buy and sell with students nearby</li>
        </ul>
      </div>
      <div class="auth-float" aria-hidden="true"><span class="badge badge-found">Found</span><b>${icon('headphones')} Black headphones</b><small>Main Library · 2h ago</small></div>
    </aside>
    <section class="auth-main">
      <div class="auth-card">
        <p class="eyebrow">For VIT students</p>
        <h2>${titles[mode]}</h2>
        <p class="muted">${mode === 'verify' ? 'Enter the code sent to your Gmail inbox. Check Spam/Junk too. If it hasn’t arrived, request a new code below.' : 'Use your Gmail address to find, return, and pass things on.'}</p>
        <form id="auth-form" data-mode="${mode}">
          ${mode === 'signup' ? '<label>Full name<input name="name" required minlength="2" maxlength="60" autocomplete="name"></label>' : ''}
          <label>Gmail address<input name="email" type="email" required autocomplete="username" placeholder="you@gmail.com" value="${esc(email)}"></label>
          ${['login', 'signup', 'reset'].includes(mode) ? `<label>Password<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">${mode !== 'login' ? '<small>10+ characters with uppercase, lowercase, a number, and a symbol.</small>' : ''}</label>` : ''}
          ${['verify', 'reset'].includes(mode) ? '<label>Verification code<input name="code" required inputmode="numeric" autocomplete="one-time-code"></label>' : ''}
          <p class="form-error" role="alert"></p>
          <button class="btn btn-primary full">${button} ${icon('arrow')}</button>
        </form>
        <div class="auth-links">
          <button class="link-btn" data-action="auth" data-id="${mode === 'login' ? 'signup' : 'login'}">${mode === 'login' ? 'New here? Create an account' : 'Back to sign in'}</button>
          ${!demo && mode === 'login' ? '<button class="link-btn" data-action="auth" data-id="forgot">Forgot password?</button><button class="link-btn" data-action="auth" data-id="verify">Verify email</button>' : ''}
          ${!demo && mode === 'verify' ? '<button class="link-btn" data-action="resend-code">Resend verification code</button>' : ''}
        </div>
        ${demo && ['login', 'signup'].includes(mode) ? `<div class="or"><span>or</span></div><button class="btn btn-outline full" data-action="demo-account" data-id="demo-me">Explore with a demo account</button>` : ''}
      </div>
    </section>
  </div>`;
}

async function cognito(action, body) {
  const res = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}` },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.message || 'Unable to sign in.');
    error.code = (data.__type || '').split('#').pop();
    throw error;
  }
  return data;
}

function setToken(token) { authToken = token; sessionStorage.setItem('vitfinds-token', token); }
function closeMenus() {
  const menu = $('#user-menu');
  if (menu) { menu.hidden = true; $('[data-action="user-menu"]')?.setAttribute('aria-expanded', 'false'); }
  const bar = $('.topbar');
  if (bar) { bar.classList.remove('nav-open'); $('.menu-btn')?.setAttribute('aria-expanded', 'false'); }
}

/* ---------- Events ---------- */
window.addEventListener('hashchange', () => {
  if (!state || (location.hash && !location.hash.startsWith('#/'))) return; // ignore in-page anchors like #main
  view = viewFromHash();
  render();
  void markConversationRead();
  const target = sessionStorage.getItem('vitfinds-scroll');
  sessionStorage.removeItem('vitfinds-scroll');
  if (target && document.getElementById(target)) document.getElementById(target).scrollIntoView({ behavior: 'smooth' });
  else window.scrollTo({ top: 0 });
});

document.addEventListener('click', async e => {
  // Plain navigation links: reset filters and close menus, let the browser change the hash.
  const navLink = e.target.closest('a[data-nav]');
  if (navLink) {
    resetFilters();
    closeMenus();
    const scrollTo = navLink.dataset.scroll;
    if (scrollTo) {
      if (view === 'home' && document.getElementById(scrollTo)) { e.preventDefault(); document.getElementById(scrollTo).scrollIntoView({ behavior: 'smooth' }); }
      else sessionStorage.setItem('vitfinds-scroll', scrollTo);
    }
    return;
  }
  if (!e.target.closest('.user-wrap')) { const m = $('#user-menu'); if (m && !m.hidden) closeMenus(); }

  const b = e.target.closest('[data-action]');
  if (!b) return;
  e.preventDefault();
  const { action, id, value } = b.dataset;
  try {
    switch (action) {
      case 'menu': {
        const bar = $('.topbar'); const open = !bar.classList.contains('nav-open');
        bar.classList.toggle('nav-open', open); b.setAttribute('aria-expanded', open);
        break;
      }
      case 'user-menu': {
        const m = $('#user-menu'); m.hidden = !m.hidden; b.setAttribute('aria-expanded', !m.hidden);
        break;
      }
      case 'goto': resetFilters(); go(id); break;
      case 'quick-category': resetFilters(); category = id; go('all'); break;
      case 'home-tab': homeTab = id; render(); document.querySelector('.fresh')?.scrollIntoView({ block: 'nearest' }); break;
      case 'hero-prev': heroIndex--; $('.hero-visual').innerHTML = heroStack(); break;
      case 'hero-next': heroIndex++; $('.hero-visual').innerHTML = heroStack(); break;
      case 'reset-filters': resetFilters(); render(); break;
      case 'post': closeMenus(); post(id); break;
      case 'detail': detail(id); break;
      case 'thumb': {
        const main = $('.detail-main .photo');
        if (main && main.tagName === 'IMG') main.src = value;
        document.querySelectorAll('.thumbs button').forEach(x => x.classList.toggle('on', x === b));
        break;
      }
      case 'close': $('#modal').close(); break;
      case 'save': {
        const result = await api(`/listings/${id}/save`, {});
        await refresh();
        toast(result.saved ? 'Saved. Find it under Saved items.' : 'Removed from saved items.');
        break;
      }
      case 'account': closeMenus(); account(); break;
      case 'demo-account': {
        const result = await api('/demo-login', { userId: id });
        setToken(result.token);
        if ($('#modal').open) $('#modal').close();
        view = 'home'; history.replaceState(null, '', '#/home');
        await refresh();
        toast(`Signed in as ${state.user.name}.`);
        break;
      }
      case 'contact': case 'claim': case 'report': inputDialog(action, id); break;
      case 'conversation': if (id) conversationId = id; showThread = !!id; render(); void markConversationRead(); break;
      case 'claim-review': {
        if (value === 'accepted' && !confirm('Confirm you checked ownership and handed this item back?')) return;
        await api(`/claims/${id}`, { status: value });
        $('#modal').close(); await refresh();
        toast(value === 'accepted' ? 'Marked as returned. Nice work!' : 'Claim declined.');
        break;
      }
      case 'read': await api('/notifications/read', {}); await refresh(); break;
      case 'moderate': {
        if (value === 'remove' && !confirm('Remove this reported listing from VITFinds?')) return;
        await api(`/reports/${id}`, { action: value });
        await refresh(); toast('Report resolved.');
        break;
      }
      case 'edit-listing': {
        const l = state.listings.find(x => x.id === id);
        if (!l) throw new Error('Listing unavailable.');
        post(l.type, l);
        break;
      }
      case 'archive-listing': {
        if (!confirm('Remove this listing from VITFinds? Existing conversations stay available.')) return;
        await api(`/listings/${id}/archive`, {});
        $('#modal').close(); await refresh();
        toast('Listing removed.');
        break;
      }
      case 'logout': {
        closeMenus();
        if (preview) { if ($('#modal').open) $('#modal').close(); serverHelp(); break; }
        stopRealtime();
        if (demo) await api('/logout', {});
        authToken = ''; sessionStorage.removeItem('vitfinds-token'); state = null;
        if ($('#modal').open) $('#modal').close();
        auth();
        break;
      }
      case 'auth': auth(id); break;
      case 'resend-code': {
        const email = $('#auth-form [name="email"]');
        if (!email?.reportValidity()) break;
        const error = $('#auth-form .form-error');
        if (error) error.textContent = '';
        b.disabled = true;
        try {
          await cognito('ResendConfirmationCode', { ClientId: config.userPoolClientId, Username: email.value.toLowerCase().trim() });
          toast('A new code was requested. Check your Gmail Inbox and Spam/Junk folders.');
          b.textContent = 'Code requested — retry in 30 seconds';
          setTimeout(() => { b.disabled = false; b.textContent = 'Resend verification code'; }, 30000);
        } catch (err) {
          b.disabled = false;
          if (error) error.textContent = err.message;
        }
        break;
      }
      case 'preview': preview = true; state = previewState(); view = viewFromHash(); render(); toast(PREVIEW_NOTE); break;
    }
  } catch (err) { toast(err.message); }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

document.addEventListener('input', e => {
  if (e.target.id === 'search') { query = e.target.value; updateResults(); }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (['category', 'location', 'sort'].includes(t.id)) {
    if (t.id === 'category') category = t.value;
    if (t.id === 'location') place = t.value;
    if (t.id === 'sort') sort = t.value;
    updateResults();
  }
  if (t.name === 'type') updateSaleFields();
  if (t.name === 'photos') {
    const files = [...t.files].slice(0, 3);
    $('#photo-preview').innerHTML = files.map(f => `<img src="${URL.createObjectURL(f)}" alt="Selected photo ${esc(f.name)}">`).join('') + (t.files.length > 3 ? '<small>Only the first 3 photos will be used.</small>' : '');
  }
});

const readDataUrl = file => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('Could not read photo.'));
  r.readAsDataURL(file);
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const formId = form.getAttribute('id'); // not form.id: the edit form has an input named "id"
  const submit = form.querySelector('button:not([type="button"])');
  if (submit) submit.disabled = true;
  const fields = new FormData(form);
  const data = Object.fromEntries(fields);
  const error = form.querySelector('.form-error');
  if (error) error.textContent = '';
  try {
    if (formId === 'hero-search') {
      resetFilters(); query = data.q || ''; go(data.type || 'all');
    } else if (formId === 'post-form') {
      if (!form.reportValidity()) return;
      const files = fields.getAll('photos').filter(f => f.size);
      if (files.length > 3 || files.some(f => f.size > 3000000)) throw new Error('Choose up to 3 photos, each under 3 MB.');
      data.images = [];
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose JPEG, PNG, or WebP photos.');
        data.images.push((await api('/uploads', { data: await readDataUrl(file) })).url);
      }
      delete data.photos;
      data.negotiable = fields.has('negotiable');
      await api('/listings', data);
      $('#modal').close();
      resetFilters(); go('mine');
      await refresh();
      toast(data.id ? 'Listing updated.' : 'Your listing is live.');
    } else if (formId === 'status-form') {
      await api(`/listings/${form.dataset.id}/status`, data);
      $('#modal').close(); await refresh();
      toast('Status updated.');
    } else if (formId === 'action-form') {
      const kind = form.dataset.kind;
      const result = await api(`/listings/${form.dataset.id}/${kind}`, data);
      $('#modal').close();
      if (kind === 'contact') { conversationId = result.id; showThread = true; go('messages'); }
      await refresh();
      toast(kind === 'claim' ? 'Claim sent privately to the finder.' : kind === 'report' ? 'Report sent to moderators.' : 'Message sent.');
    } else if (formId === 'message-form') {
      const sentText = form.elements.text.value;
      form.elements.text.value = '';
      try { await api(`/conversations/${conversationId}/messages`, data); }
      catch (err) { const current = $('#message-form input[name="text"]'); if (current && !current.value) current.value = sentText; throw err; }
      await refresh();
      $('#message-form input')?.focus();
    } else if (formId === 'auth-form') {
      const mode = form.dataset.mode;
      if (demo) {
        const result = await api(`/auth/${mode}`, { name: data.name, email: data.email, password: data.password });
        setToken(result.token);
        view = viewFromHash();
        await refresh();
        toast(mode === 'signup' ? 'Account created. Welcome to VITFinds!' : 'Welcome back.');
      } else {
        const base = { ClientId: config.userPoolClientId, Username: data.email.toLowerCase().trim() };
        if (mode === 'signup') {
          await cognito('SignUp', { ...base, Password: data.password, UserAttributes: [{ Name: 'name', Value: data.name }, { Name: 'email', Value: base.Username }] });
          auth('verify', base.Username); toast('Check your Gmail inbox for the verification code.');
        } else if (mode === 'verify') {
          await cognito('ConfirmSignUp', { ...base, ConfirmationCode: data.code });
          auth(); toast('Email verified. You can sign in now.');
        } else if (mode === 'forgot') {
          await cognito('ForgotPassword', base); auth('reset');
        } else if (mode === 'reset') {
          await cognito('ConfirmForgotPassword', { ...base, ConfirmationCode: data.code, Password: data.password });
          auth(); toast('Password reset. Sign in with your new password.');
        } else {
          const result = await cognito('InitiateAuth', { ClientId: base.ClientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: base.Username, PASSWORD: data.password } });
          if (!result.AuthenticationResult) throw new Error('Additional account verification is required. Contact your administrator.');
          setToken(result.AuthenticationResult.IdToken);
          view = viewFromHash();
          await refresh();
        }
      }
    }
  } catch (err) {
    if (formId === 'auth-form' && err.code === 'UserNotConfirmedException') {
      auth('verify', data.email);
      $('#auth-form .form-error').textContent = 'Your email isn’t verified yet. Enter your code or select “Resend verification code”.';
      return;
    }
    if (error) error.textContent = err.message; else toast(err.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});

$('#modal').addEventListener('click', e => {
  if (e.target !== $('#modal')) return;
  const r = e.target.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
});

/* ---------- Boot ---------- */
async function boot() {
  if (openedAsFile) return serverHelp();
  if (!demo && !authToken) return auth();
  try {
    state = await api('/state');
    view = viewFromHash();
    render();
    syncLive();
  } catch (e) {
    if (e.status === 401) auth();
    // TypeError: server unreachable. SyntaxError: something answered with HTML, not the API (e.g. VS Code Live Server).
    else if (e instanceof TypeError || e instanceof SyntaxError || e.status === 404 || e.status === 405) serverHelp();
    else {
      $('#app').innerHTML = '<div class="boot"><span class="logo-mark" aria-hidden="true">V</span><h1>Couldn’t open your campus</h1><p id="boot-error"></p><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>';
      $('#boot-error').textContent = e.message;
    }
  }
}
boot();

/* ---------- Server not running: instructions + sample-data preview ---------- */
function serverHelp() {
  state = null; preview = false;
  if (!demo) {
    $('#app').innerHTML = `<div class="boot"><span class="logo-mark" aria-hidden="true">V</span><h1>We couldn’t connect to VITFinds.</h1><p>Please check your connection and try again.</p><button class="btn btn-primary" onclick="location.reload()">Try again</button><button class="link-btn" data-action="auth" data-id="login">Back to sign in</button></div>`;
    return;
  }
  $('#app').innerHTML = `<div class="setup">
    <div class="setup-card">
      <a class="logo"><span class="logo-mark" aria-hidden="true">V</span><span>VIT<em>Finds</em><b>.</b></span></a>
      <p class="eyebrow">One quick step</p>
      <h1>Start the VITFinds <em>server</em> first.</h1>
      <p class="lede">${openedAsFile ? 'You opened <code>index.html</code> straight from the folder.' : 'This page can’t reach the VITFinds API.'} Accounts, listings, photos and chat all come from <code>server.mjs</code>, so the site has to be opened through it.</p>
      <ol class="setup-steps">
        <li><span>1</span><div><b>Open a terminal in your VITFinds folder</b><small>The folder that has <code>server.mjs</code> and <code>package.json</code>. In VS Code: Terminal → New Terminal.</small></div></li>
        <li><span>2</span><div><b>Run the server</b><code class="cmd">npm start</code><small>Needs Node.js 22 or newer. <code>node server.mjs</code> does the same thing.</small></div></li>
        <li><span>3</span><div><b>Open the site</b><a class="cmd link" href="http://127.0.0.1:3000">http://127.0.0.1:3000</a><small>Keep the terminal open while you use it. Don’t use Live Server or double-click the file.</small></div></li>
      </ol>
      <div class="btn-row">
        <a class="btn btn-primary" href="http://127.0.0.1:3000">I’ve started it, open the site ${icon('arrow')}</a>
        <button class="btn btn-outline" data-action="preview">Preview the design with sample data</button>
      </div>
    </div>
  </div>`;
}

function previewState() {
  const users = [['demo-me', 'Alex Student'], ['demo-priya', 'Priya S.'], ['demo-arjun', 'Arjun R.']].map(([id, name]) => ({ id, name, role: 'student', verified: true }));
  const rows = [
    ['found', 'A little music, missing its person', 'Black wireless headphones found on the second floor of the library. Tell me the brand and a distinguishing detail to claim them.', 'Electronics', 'Main Library', 0, 'headphones', 'demo-priya'],
    ['sale', 'Your next semester, sorted', 'Engineering Mathematics textbook. Clean pages, a few useful pencil notes. Available for pickup near SJT.', 'Books & stationery', 'SJT', 350, 'books', 'demo-arjun'],
    ['lost', 'Have you seen my blue backpack?', 'Lost my navy backpack after the afternoon class at TT. It has a notebook inside. Please get in touch if you find it.', 'ID & essentials', 'TT', 0, 'backpack', 'demo-me'],
    ['sale', 'A better way to get to class', 'Single-speed campus bicycle in good condition. Recently serviced brakes. Price is negotiable.', 'Cycles & sports', 'Mens Hostel', 2800, 'cycle', 'demo-priya'],
    ['found', 'Keys looking for their way home', 'A set of keys was found near Foodys. Describe the keychain so I can verify ownership.', 'ID & essentials', 'Foodys', 0, 'keys', 'demo-arjun'],
    ['sale', 'Make room for a little light', 'Compact study lamp with three brightness settings. Works perfectly. Moving out this semester.', 'Hostel essentials', 'Ladies Hostel', 450, 'lamp', 'demo-me']
  ];
  const listings = rows.map((r, i) => ({ id: `sample-${i + 1}`, type: r[0], title: r[1], description: r[2], category: r[3], location: r[4], price: r[5], art: r[6], ownerId: r[7], status: 'active', condition: 'Good', negotiable: true, images: [], date: today(), createdAt: new Date(Date.now() - i * 3600000).toISOString(), demo: true }));
  return { user: users[0], users, listings, saved: [], conversations: [], messages: [], claims: [], notifications: [{ id: 'n1', message: 'Welcome to the VITFinds preview!', read: false, createdAt: new Date().toISOString() }], reports: [] };
}

/* Optional WebMCP tools (feature-detected) */
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  for (const tool of [
    {
      name: 'search_campus_listings',
      description: 'Search visible campus listings by keyword and optional type.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, type: { type: 'string', enum: ['all', 'lost', 'found', 'sale'] } }, required: ['query'], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!state) throw new Error('Sign in first.');
        if (typeof input?.query !== 'string' || !['all', 'lost', 'found', 'sale'].includes(input.type || 'all')) throw new Error('Invalid search.');
        resetFilters(); view = input.type || 'all'; query = input.query;
        history.replaceState(null, '', '#/' + view); render();
        return filtered().map(({ id, title, type, price, status }) => ({ id, title, type, price, status }));
      }
    },
    {
      name: 'toggle_saved_listing',
      description: 'Save an unsaved listing, or remove an already saved listing, for the current student.',
      inputSchema: { type: 'object', properties: { listingId: { type: 'string' } }, required: ['listingId'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!state || typeof input?.listingId !== 'string' || !state.listings.some(l => l.id === input.listingId)) throw new Error('Choose an available listing.');
        const result = await api(`/listings/${encodeURIComponent(input.listingId)}/save`, {});
        await refresh();
        return result;
      }
    }
  ]) try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {}
}

/* Background refresh every 15s as a fallback to live updates (claims, notifications, reports) */
setInterval(() => {
  if (!state || preview || document.hidden) return;
  liveRefresh();
}, 15000);

document.addEventListener('visibilitychange', () => { if (!document.hidden && state && !preview) liveRefresh(); });
