'use strict';
/* =====================================================================
   World view (walkable map), HUD, account + cloud-save client, startup.
   ===================================================================== */
const WORKERS = [
  ['auto_chopper', '#8b5a2b', 2 * CELL, 5 * CELL + 14], ['auto_miner', '#8a8a92', 24 * CELL, 5 * CELL + 14],
  ['auto_fisher', '#3b8fd9', 2 * CELL, 12 * CELL + 14], ['auto_scavenger', '#b3322b', 20 * CELL, 12 * CELL + 14],
];
const WALK_SPEED = 150;
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

class WorldView {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.T = buildTerrain();
    this.px = 15 * CELL; this.py = 10 * CELL; this.keys = new Set(); this.frame = 0; this.last = performance.now();
    this.floats = []; this.flameCol = []; this.station = null; this.hudSig = null; this.scale = 1; this.staticCv = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('fullscreenchange', () => setTimeout(() => this.resize(), 50));
    document.addEventListener('keydown', e => this.keyDown(e));
    document.addEventListener('keyup', e => this.keys.delete(keyName(e)));
    window.addEventListener('blur', () => this.keys.clear());
    UI.pop = (text, color) => this.floats.push({ x: this.px, y: this.py - 40, text: String(text), color: color || '#ffd75e', t0: performance.now() });
    requestAnimationFrame(t => this.loop(t));
  }
  resize() {
    const rect = this.cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const cw = Math.max(320, Math.round(rect.width * dpr)), ch = Math.round(cw * WH / WW);
    if (this.staticCv && this.cv.width === cw) return;
    this.cv.width = cw; this.cv.height = ch; this.scale = cw / WW;
    this.staticCv = document.createElement('canvas'); this.staticCv.width = cw; this.staticCv.height = ch;
    const sctx = this.staticCv.getContext('2d'); sctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.dyn = { flames: [], waves: [], bubbles: [], farm: null, qmark: null, bmark: null, crystal: null };
    drawWorldStatic(new Pen(sctx), this.T, this.dyn);
    this.render();
  }
  keyDown(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = keyName(e);
    if (k === 'f11') { e.preventDefault(); toggleFullscreen(); return; }
    if (modalOpen()) { if (k === 'escape' && UI.panel) { e.preventDefault(); UI.panel.close(); } return; }
    if (MOVE_KEYS.includes(k) || k === ' ' || k === 'enter') e.preventDefault();
    this.keys.add(k);
    if (k === 'e' || k === ' ' || k === 'enter') this.interact();
    else if (k === 'i' || k === 'b') openBag();
    else if (k === 'c') openStats();
    else if (k === 'escape') openMenu();
  }
  blockedAt(x, y) {
    for (const [cx, cy] of [[x - 9, y - 6], [x + 9, y - 6], [x - 9, y + 8], [x + 9, y + 8]]) {
      const tx = Math.floor(cx / CELL), ty = Math.floor(cy / CELL);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || this.T.solid[ty][tx]) return true;
    }
    return false;
  }
  move(dt) {
    const k = this.keys;
    const dx = ((k.has('d') || k.has('arrowright')) ? 1 : 0) - ((k.has('a') || k.has('arrowleft')) ? 1 : 0);
    const dy = ((k.has('s') || k.has('arrowdown')) ? 1 : 0) - ((k.has('w') || k.has('arrowup')) ? 1 : 0);
    if (!dx && !dy) return;
    const norm = Math.hypot(dx, dy), step = WALK_SPEED * dt;
    const nx = this.px + dx / norm * step, ny = this.py + dy / norm * step;
    if (!this.blockedAt(nx, this.py)) this.px = nx;
    if (!this.blockedAt(this.px, ny)) this.py = ny;
  }
  nearestStation() {
    let best = null, bd = 1e9;
    for (const [sid, label] of D.STATIONS) {
      const [x0, y0, x1, y1] = this.T.rects[sid];
      if (this.px >= x0 - 36 && this.px <= x1 + 36 && this.py >= y0 - 36 && this.py <= y1 + 36) {
        const d = Math.hypot(this.px - (x0 + x1) / 2, this.py - (y0 + y1) / 2);
        if (d < bd) { best = [sid, label]; bd = d; }
      }
    }
    return best;
  }
  interact() { const st = this.nearestStation(); if (st) STATION_ACTIONS[st[0]](); }
  loop(t) {
    const dt = Math.min(0.08, (t - this.last) / 1000); this.last = t; this.frame++;
    if (modalOpen()) this.keys.clear();
    else { this.move(dt); this.render(); }
    this.updatePrompt();
    requestAnimationFrame(tt => this.loop(tt));
  }
  render() {
    const c = this.ctx, pen = new Pen(c), f = this.frame, ts = f * 0.033, d = this.dyn;
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.staticCv, 0, 0);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (f % 6 === 0 || !this.flameCol.length) this.flameCol = d.flames.map(() => choice(['#ff9f1c', '#ffbf3c', '#ff7a1c', '#ffe066']));
    d.flames.forEach((r, i) => pen.O(r[0], r[1], r[2], r[3], this.flameCol[i]));
    for (const [x, y] of d.waves) { const off = Math.sin(ts * 2.2 + x) * 5; pen.L(x + off, y, x + 22 + off, y, '#bfe3ff', 2); }
    for (const [x, y, ph, col] of d.bubbles) { const by = y - (((ts * 0.8) + ph) % 1) * 18; pen.O(x, by, x + 7, by + 7, col); }
    if (d.crystal) {
      const [x, y] = d.crystal, glow = (Math.sin(ts * 2.5) + 1) / 2, ready = totalLevels() >= ascendRequirement();
      const base = ready ? [200, 140, 255] : [155, 89, 255], k = glow * (ready ? 0.7 : 0.25);
      pen.P([x + 32, y + 4, x + 42, y + 28, x + 32, y + 44, x + 22, y + 28], `rgb(${base.map(v => Math.trunc(v + (255 - v) * k)).join(',')})`, '#e0b3ff');
    }
    const patch = P.farm_patch;
    if (patch.crop !== 'None' && d.farm) {
      const [x, y, w, h] = d.farm, ready = now() >= patch.ready_at, dragon = patch.crop === 'Dragon Scale';
      for (let j = 1; j < 5; j++) for (let i = 0; i < 6; i++) {
        const sx = x + 16 + i * 20, sy = y + j * h / 5 - 4;
        if (ready) { pen.O(sx - 6, sy - 12, sx + 6, sy, dragon ? '#e5484d' : '#ffd23f'); pen.L(sx, sy, sx, sy + 6, '#3a8a35', 2); }
        else pen.O(sx - 3, sy - 5, sx + 3, sy, '#5fd35f');
      }
    }
    for (const [key, color, bx, by] of WORKERS) {
      const n = Math.min(5, P.automation[key] || 0);
      for (let i = 0; i < n; i++) drawWorker(pen, bx + i * 28 + 10 + Math.sin(ts * 3 + i * 1.7) * 6, by, color);
    }
    const bob = Math.sin(ts * 6) * 3;
    if (d.qmark && P.quests.some(q => q.done)) pen.T(d.qmark[0], d.qmark[1] + bob, '!', '#ffd23f', 24);
    if (d.bmark && this.bossReady()) pen.T(d.bmark[0], d.bmark[1] + bob, '!', '#ff4d4d', 24);
    drawHero(pen, this.px, this.py, 1, heroGear());
    const tn = performance.now();
    this.floats = this.floats.filter(q => tn - q.t0 < 1100);
    for (const q of this.floats) { const k = (tn - q.t0) / 1100; c.globalAlpha = 1 - k * k; pen.T(q.x, q.y - k * 40, q.text, q.color, 14); c.globalAlpha = 1; }
  }
  bossReady() { const lvl = fightLevel(), t = now(); return Object.entries(D.BOSSES).some(([i, b]) => lvl >= b.req && (P.boss_cd[i] || 0) <= t); }
  updatePrompt() {
    const st = modalOpen() ? null : this.nearestStation(), key = st ? st[0] : null;
    if (key === this.station) return;
    this.station = key; const el = $('prompt');
    el.hidden = !st; if (st) el.textContent = `[E]  ${st[1]}`;
  }
}

/* ---------------- HUD (HTML overlay) ---------------- */
let hudSig = null;
function updateHud(force) {
  if (!P) return;
  const notes = [], pres = P.prestige;
  if (pres.count || pres.ap) notes.push(`AP ${pres.ap}`);
  const buffs = Object.values(D.POTIONS).filter(d => d.buff && buffActive(d.buff)).length;
  if (buffs) notes.push(`${buffs} potion effect(s)`);
  const rq = P.quests.filter(q => q.done).length;
  if (rq) notes.push(`${rq} quest(s) ready!`);
  const lvl = fightLevel(), t = now();
  if (Object.entries(D.BOSSES).some(([i, b]) => lvl >= b.req && (P.boss_cd[i] || 0) <= t)) notes.push('boss ready');
  if (totalLevels() >= ascendRequirement()) notes.push('can ASCEND');
  const recent = LOG.filter(m => t - m[0] < 9).slice(-4);
  const sig = JSON.stringify([P.hp, P.max_hp, P.hunger, P.gold, notes, recent.map(m => [m[1], m[2]]), UI.saveState]);
  if (sig === hudSig && !force) return;
  hudSig = sig;
  $('hp-fill').style.width = Math.max(0, Math.min(100, P.hp / Math.max(1, P.max_hp) * 100)) + '%';
  $('hp-text').textContent = `HP ${Math.trunc(P.hp)}/${P.max_hp}`;
  $('hg-fill').style.width = Math.max(0, Math.min(100, P.hunger)) + '%';
  $('hg-text').textContent = `Hunger ${Math.trunc(P.hunger)}`;
  $('gold').textContent = `Gold ${fmt(P.gold)}`;
  $('notes').textContent = notes.join('   ');
  $('savestate').textContent = UI.saveState || '';
  $('log').replaceChildren(...recent.map(m => h('div', { style: { color: m[2] } }, m[1])));
}

/* ---------------- fullscreen ---------------- */
function toggleFullscreen() {
  const el = $('wrap');
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

/* ---------------- account / cloud save ---------------- */
const Net = {
  csrf: '', user: null, rev: 0, saving: false, locked: false,
  uid: null, token: null, refresh: null, expires: 0, serverDelta: null,
  cfg() {
    const c = (typeof window !== 'undefined' && window.IDLE_CONFIG) || {};
    if (!c.url || !c.anonKey || /YOUR-PROJECT|YOUR_ANON/.test(c.url + c.anonKey)) {
      const err = new Error('The game server is not set up yet. Fill in js/config.js (see SETUP.md).'); err.status = 0; throw err;
    }
    return c;
  },
  fakeEmail(name) { return 'u_' + name.toLowerCase() + '@dsdsksjkajk.github.io'; },
  store(session) {
    this.token = session.access_token; this.refresh = session.refresh_token;
    this.expires = Date.now() + (session.expires_in || 3600) * 1000;
    this.uid = session.user && session.user.id;
    try { localStorage.setItem('idlemmo_rt', this.refresh); } catch (e) { /* ignore */ }
  },
  clear() {
    this.token = this.refresh = this.uid = null; this.expires = 0;
    try { localStorage.removeItem('idlemmo_rt'); } catch (e) { /* ignore */ }
  },
  async http(path, opts) {
    const c = this.cfg(); opts = opts || {};
    const headers = Object.assign({ apikey: c.anonKey, 'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (opts.token || c.anonKey) }, opts.headers || {});
    let r, j = null;
    try { r = await fetch(c.url.replace(/\/$/, '') + path, { method: opts.method || 'GET', headers, keepalive: !!opts.keepalive, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }); }
    catch (e) { const err = new Error('Cannot reach the server. Check your connection.'); err.status = 0; throw err; }
    try { const t = await r.text(); j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
    try { const d = r.headers.get('date'); if (d) this.serverDelta = (Date.parse(d) - Date.now()) / 1000; } catch (e) { /* ignore */ }
    if (!r.ok) {
      const msg = (j && (j.msg || j.error_description || j.message || j.error)) || ('HTTP ' + r.status);
      const err = new Error(String(msg)); err.status = r.status; err.data = j; throw err;
    }
    return j;
  },
  async ensureToken() {
    if (!this.refresh) { const e = new Error('Not logged in.'); e.status = 401; throw e; }
    if (this.token && Date.now() < this.expires - 60000) return;
    try { this.store(await this.http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: this.refresh } })); }
    catch (e) { if (e.status === 400 || e.status === 401) { this.clear(); e.status = 401; } throw e; }
  },
  async loadRow() {
    const rows = await this.http('/rest/v1/saves?select=rev,data&user_id=eq.' + this.uid, { token: this.token });
    if (rows && rows[0]) return rows[0];
    try { await this.http('/rest/v1/saves', { method: 'POST', token: this.token, headers: { Prefer: 'return=minimal' }, body: { user_id: this.uid, data: {}, rev: 0 } }); }
    catch (e) { if (e.status !== 409) throw e; }
    return { rev: 0, data: {} };
  },
  async session(sess, name) {
    this.store(sess); this.user = name || (sess.user && sess.user.user_metadata && sess.user.user_metadata.username) || 'player';
    const row = await this.loadRow();
    return { user: this.user, save: row, server_time: Date.now() / 1000 + (this.serverDelta || 0) };
  },
  friendly(e) {
    const m = (e.message || '').toLowerCase();
    if (/already (registered|been registered)|already exists/.test(m)) return 'That username is already taken.';
    if (/invalid login|invalid credentials/.test(m)) return 'Wrong username or password.';
    if (/rate limit|too many/.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/signups? (not allowed|disabled)/.test(m)) return 'New accounts are currently disabled.';
    return e.message;
  },
  async call(action, body) {
    body = body || {};
    try {
      if (action === 'register' || action === 'login') {
        const email = this.fakeEmail(body.username);
        let sess;
        if (action === 'register') {
          sess = await this.http('/auth/v1/signup', { method: 'POST', body: { email, password: body.password, data: { username: body.username } } });
          if (!sess || !sess.access_token) {
            const e = new Error('Account created but the project still requires e-mail confirmation. Turn off "Confirm email" in Supabase (see SETUP.md).'); e.status = 0; throw e;
          }
        } else sess = await this.http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: body.password } });
        const r = await this.session(sess, body.username);
        return r;
      }
      if (action === 'me') {
        let rt = null; try { rt = localStorage.getItem('idlemmo_rt'); } catch (e) { /* ignore */ }
        if (!rt) return { user: null };
        this.refresh = rt;
        try { await this.ensureToken(); } catch (e) { if (e.status === 401) return { user: null }; throw e; }
        const u = await this.http('/auth/v1/user', { token: this.token });
        this.uid = u.id; this.user = (u.user_metadata && u.user_metadata.username) || 'player';
        const row = await this.loadRow();
        return { user: this.user, save: row, server_time: Date.now() / 1000 + (this.serverDelta || 0) };
      }
      if (action === 'save') {
        await this.ensureToken();
        const rows = await this.http('/rest/v1/saves?user_id=eq.' + this.uid + '&rev=eq.' + body.rev, {
          method: 'PATCH', token: this.token, keepalive: !!(arguments[2] && arguments[2].keepalive), headers: { Prefer: 'return=representation' },
          body: { data: body.data, rev: body.rev + 1, updated_at: new Date().toISOString() } });
        if (!rows || !rows.length) { const e = new Error('Save conflict'); e.status = 409; throw e; }
        return { rev: rows[0].rev };
      }
      if (action === 'change_password') {
        if (!body['new'] || body['new'].length < 8) throw new Error('New password must be at least 8 characters.');
        await this.http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: this.fakeEmail(this.user), password: body.old } });
        await this.ensureToken();
        await this.http('/auth/v1/user', { method: 'PUT', token: this.token, body: { password: body['new'] } });
        return { ok: true };
      }
      if (action === 'logout') {
        try { if (this.token) await this.http('/auth/v1/logout', { method: 'POST', token: this.token }); } catch (e) { /* ignore */ }
        this.clear(); return { ok: true };
      }
      throw new Error('Unknown action ' + action);
    } catch (e) {
      if (e.status !== 409 && e.status !== 401) e.message = this.friendly(e);
      throw e;
    }
  },
};
UI.saveState = '';
async function saveNow(opts) {
  if (Net.saving || Net.locked || !P) return;
  Net.saving = true; UI.dirty = false; UI.saveState = 'Saving...';
  try {
    const r = await Net.call('save', { data: P, rev: Net.rev }, opts && opts.keepalive ? { keepalive: true } : null);
    Net.rev = r.rev; UI.saveState = 'Saved';
  } catch (e) {
    UI.dirty = true;
    if (e.status === 409) { Net.locked = true; fatal('Your account was changed somewhere else', 'This game is open in another tab or on another device, and that copy saved newer progress. Reload to continue with the latest save.'); }
    else if (e.status === 401) { Net.locked = true; fatal('You were logged out', 'Your session expired. Reload the page and log in again. (Progress up to the last successful save is kept.)'); }
    else UI.saveState = 'Save failed - retrying';
  } finally { Net.saving = false; }
}
function fatal(title, text) {
  const box = $('fatal'); box.hidden = false;
  box.replaceChildren(h('div', { class: 'card' }, h('h2', {}, title), h('p', {}, text), h('button', { onclick: () => location.reload() }, 'Reload')));
}
function applyAuth(r) {
  Net.user = r.user; Net.rev = r.save ? r.save.rev : 0; Net.locked = false;
  timeOffset = (r.server_time || Date.now() / 1000) - Date.now() / 1000;
  loadPlayer(r.save && r.save.data && Object.keys(r.save.data).length ? r.save.data : null);
}
function exportSave() {
  const blob = new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `idle_mmo_${Net.user}.json` }); document.body.append(a); a.click(); a.remove();
  return null;
}
function importSave() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!obj || typeof obj !== 'object' || !obj.xp || !obj.inventory) throw new Error('not an Idle MMO save');
      if (!window.confirm('Replace your current progress on this account with this file?')) return;
      loadPlayer(obj); afterAction(); await saveNow(); say('Save imported!', GOOD);
      if (UI.panel) UI.panel.refresh();
    } catch (e) { window.alert('Could not import that file: ' + e.message); }
  });
  inp.click(); return null;
}
async function changePassword() {
  const oldp = window.prompt('Current password:'); if (oldp === null) return null;
  const newp = window.prompt('New password (at least 8 characters):'); if (newp === null) return null;
  try { await Net.call('change_password', { old: oldp, 'new': newp }); say('Password changed.', GOOD); }
  catch (e) { window.alert(e.message); }
  return null;
}
async function logout() {
  await saveNow();
  try { await Net.call('logout'); } catch (e) { /* ignore */ }
  location.reload(); return null;
}
function bMenu() {
  return { header: `Account: ${Net.user}`, rows: [
    { title: 'Your progress is stored on the server', sub: `Status: ${UI.saveState || 'ok'}. It also saves automatically every few seconds.` },
    { title: 'Save now', buttons: [['Save', () => { saveNow(); return null; }, true]] },
    { title: 'Fullscreen (F11)', buttons: [['Toggle', () => { toggleFullscreen(); return null; }, true]] },
    { section: 'Account' },
    { title: 'Export a backup file', buttons: [['Export', exportSave, true]] },
    { title: 'Import a save file', sub: 'Works with idle_mmo_save.json from the desktop version, or an exported backup.', buttons: [['Import', importSave, true]] },
    { title: 'Change password', buttons: [['Change', changePassword, true]] },
    { title: 'Log out', buttons: [['Log out', logout, true]] }] };
}
const openMenu = () => openPanel('menu', 'Menu', bMenu);
const openBag = () => openPanel('bag', 'Backpack', bBag);
const openStats = () => openPanel('stats', 'Character', bStats);

/* ---------------- startup ---------------- */
let world = null;
function startGame() {
  $('auth').hidden = true; $('wrap').hidden = false;
  if (!world) {
    world = new WorldView($('world'));
    UI.onAfterAction = () => updateHud();
    UI.onAscend = () => { updateHud(true); };
    setInterval(idleTick, 1000);
    setInterval(() => { if (UI.dirty) saveNow(); }, 15000);
    setInterval(() => { Net.ensureToken().catch(() => {}); }, 600000);
    setInterval(() => updateHud(), 250);
    document.addEventListener('visibilitychange', () => { if (document.hidden && UI.dirty) saveNow({ keepalive: true }); });
    window.addEventListener('pagehide', () => { if (UI.dirty) saveNow({ keepalive: true }); });
    for (const [id, fn] of [['btn-bag', openBag], ['btn-stats', openStats], ['btn-full', toggleFullscreen], ['btn-menu', openMenu]]) $(id).addEventListener('click', ev => { if (ev && ev.currentTarget && ev.currentTarget.blur) ev.currentTarget.blur(); fn(); });
  }
  world.resize();
  const report = processIdleTime(); refreshMaxHp(); ensureQuests();
  say('Welcome! Walk with WASD / arrow keys and press E at a building.', INFO);
  if (report.length) openPanel('away', 'While you were away', () => ({ header: '', rows: report.map(t => ({ title: t })) }));
  updateHud(true); UI.dirty = true;
}
function idleTick() {
  if (!P) return;
  const report = processIdleTime(); refreshMaxHp(); ensureQuests();
  for (const line of report) say(line, '#9be37e');
  if (report.length) UI.dirty = true;
  if (UI.panel && (report.length || UI.panel.live)) UI.panel.refresh();
}

function showAuth(msg) {
  $('auth').hidden = false; $('wrap').hidden = true;
  setAuthMsg(msg || '', !!msg);
}
function setAuthMsg(text, bad) { const m = $('auth-msg'); m.textContent = text; m.className = bad ? 'bad' : 'good'; }
let authMode = 'login';
function setMode(mode) {
  authMode = mode;
  $('tab-login').classList.toggle('on', mode === 'login'); $('tab-register').classList.toggle('on', mode === 'register');
  $('confirm-row').hidden = mode !== 'register';
  $('auth-submit').textContent = mode === 'login' ? 'Log in' : 'Create account & play';
  $('auth-hint').textContent = mode === 'login' ? 'New here? Choose "Create account" and pick your own username and password.'
    : 'Pick a username (3-20 letters, numbers or _) and a password of at least 8 characters.';
  setAuthMsg('', false);
}
async function submitAuth(ev) {
  ev.preventDefault();
  const username = $('f-user').value.trim(), password = $('f-pass').value;
  if (authMode === 'register') {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setAuthMsg('Username must be 3-20 letters, numbers or _.', true);
    if (password.length < 8) return setAuthMsg('Password must be at least 8 characters.', true);
    if (password !== $('f-pass2').value) return setAuthMsg('The two passwords do not match.', true);
  }
  $('auth-submit').disabled = true; setAuthMsg('Please wait...', false);
  try {
    const r = await Net.call(authMode, { username, password });
    $('f-pass').value = ''; $('f-pass2').value = '';
    applyAuth(r); startGame();
  } catch (e) { setAuthMsg(e.message, true); }
  finally { $('auth-submit').disabled = false; }
}
async function boot() {
  $('tab-login').addEventListener('click', () => setMode('login'));
  $('tab-register').addEventListener('click', () => setMode('register'));
  $('auth-form').addEventListener('submit', submitAuth);
  setMode('login');
  try {
    const r = await Net.call('me');
    if (r.user) { applyAuth(r); startGame(); } else showAuth();
  } catch (e) { showAuth(e.message); }
}
if (typeof window !== 'undefined' && document.getElementById('auth-form')) boot();
