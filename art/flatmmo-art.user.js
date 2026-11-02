// ==UserScript==
// @name         FlatMMO Art Panel
// @namespace    https://dsdsksjkajk.github.io/
// @version      1.1.2
// @description  Festive sprites and art from the dsdsksjkajk Art wall, plus an optional pumpkin jumpscare, for FlatMMO. Cosmetic only: it never touches gameplay.
// @author       dsdsksjkajk
// @homepageURL  https://dsdsksjkajk.github.io/art/
// @downloadURL  https://dsdsksjkajk.github.io/art/flatmmo-art.user.js
// @updateURL    https://dsdsksjkajk.github.io/art/flatmmo-art.user.js
// @match        *://flatmmo.com/play.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      irpmgvoficvjnkqkojxg.supabase.co
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;   // the game's own window
  if (W.__dsArtPanel) return;
  W.__dsArtPanel = true;

  /* ---------------- config ---------------- */
  const API = 'https://irpmgvoficvjnkqkojxg.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycG1ndm9maWN2am5rcWtvanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5OTMxNzEsImV4cCI6MjEwODU2OTE3MX0.wjUzhC-CUTO8K_9vLSGhxPEwD0t3uzYWkwcSEqBFz80';
  const WALL = 'https://dsdsksjkajk.github.io/art/';
  const PAGE = 24;
  // jumpscare gap, in seconds: [min, max]
  const FREQ = { rare: [900, 2400], sometimes: [240, 720], often: [45, 150] };
  const SYNC_EVERY = 5 * 60 * 1000;   // re-check the wall for newly approved art while playing

  /* ---------------- settings ---------------- */
  const DEFAULTS = {
    launcherPos: null,
    jump: false, jumpFreq: 'sometimes',
    sprites: true,
  };
  const hasGM = typeof GM_getValue === 'function';
  function loadSettings() {
    let raw = null;
    try { raw = hasGM ? GM_getValue('settings', null) : localStorage.getItem('dsArtPanel'); } catch (e) { /* ignore */ }
    let obj = {};
    try { obj = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch (e) { obj = {}; }
    return Object.assign({}, DEFAULTS, obj);
  }
  const S = loadSettings();
  function save() {
    const v = JSON.stringify(S);
    try { if (hasGM) GM_setValue('settings', v); else localStorage.setItem('dsArtPanel', v); } catch (e) { /* ignore */ }
  }

  /* ---------------- network (GM request avoids the game's page restrictions) ---------------- */
  function request(url, type) {
    const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'count=exact' };
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET', url, headers: type === 'blob' ? {} : headers, responseType: type === 'blob' ? 'blob' : 'text', timeout: 20000,
          onload: (r) => {
            if (r.status < 200 || r.status >= 300) return reject(new Error('HTTP ' + r.status));
            if (type === 'blob') return resolve(r.response);
            const m = /content-range:\s*\S+\/(\d+)/i.exec(r.responseHeaders || '');
            try { resolve({ data: JSON.parse(r.responseText), total: m ? +m[1] : null }); } catch (e) { reject(e); }
          },
          onerror: () => reject(new Error('Network error')),
          ontimeout: () => reject(new Error('Timed out')),
        });
      });
    }
    return fetch(url, { headers: type === 'blob' ? {} : headers }).then(async (r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (type === 'blob') return r.blob();
      const cr = r.headers.get('content-range');
      return { data: await r.json(), total: cr && cr.includes('/') ? +cr.split('/')[1] : null };
    });
  }
  function listArt(offset, limit) {
    return request(API + '/rest/v1/art_posts?select=*&approved=eq.true&order=created_at.desc,id.desc&limit=' + limit + '&offset=' + offset);
  }
  function imgUrl(path) {
    return API + '/storage/v1/object/public/art/' + path.split('/').map(encodeURIComponent).join('/');
  }
  // Load normally; if the game page blocks outside images, fetch it through the userscript instead.
  const blobCache = new Map();
  function setImg(img, path) {
    const url = imgUrl(path);
    img.onerror = () => {
      img.onerror = null;
      if (blobCache.has(url)) { img.src = blobCache.get(url); return; }
      request(url, 'blob').then((b) => {
        const u = URL.createObjectURL(b); blobCache.set(url, u); img.src = u;
      }).catch(() => { img.alt = 'Could not load image'; });
    };
    img.src = blobCache.get(url) || url;
  }
  function isPixel(p) { return p.width && p.height && p.width <= 256 && p.height <= 256; }
  function ago(iso) {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return 'just now';
    for (const [n, u] of [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']]) if (s >= n) return Math.floor(s / n) + u + ' ago';
    return '';
  }

  /* ---------------- festive sprites ----------------
     The game draws every sprite with canvas drawImage(). We wrap it: when the game draws a sprite
     the admin has assigned art to, we draw that art in the same box instead. Everything else is untouched. */
  function spriteKey(v) {
    v = String(v || '').trim(); if (!v) return '';
    try { if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = new URL(v).pathname; } catch (e) { /* ignore */ }
    v = v.split(/[?#]/)[0].replace(/^\/+/, '');
    try { v = decodeURIComponent(v); } catch (e) { /* ignore */ }
    return v.toLowerCase();
  }
  const seen = new Map();          // sprite key -> { url, w, h }  (for the Sprite finder)
  const built = new Map();         // post id -> loaded replacement
  let reps = new Map();            // sprite key -> replacement
  let lookup = new WeakMap();      // game image -> replacement | false   (cache, keeps drawing fast)
  let lastSig = '', syncing = false;
  const SP = { state: 'idle', count: 0, sprites: 0, error: '' };
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });

  function noteSeen(k, url, img) {
    if (seen.has(k) || seen.size >= 3000) return;
    seen.set(k, { url, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
  }
  function makeRep(frames, total) {
    return {
      frames, total,
      frame() {
        if (frames.length === 1) return frames[0].bmp;
        const t = performance.now() % total;
        for (let i = 0; i < frames.length; i++) if (t < frames[i].end) return frames[i].bmp;
        return frames[frames.length - 1].bmp;
      },
      close() { frames.forEach((f) => { try { f.bmp.close(); } catch (e) { /* ignore */ } }); },
    };
  }
  async function toBitmap(src) {
    try { return await createImageBitmap(src); }
    catch (e) { return createImageBitmap(new Blob([await src.arrayBuffer()])); }   // blob from another context
  }
  async function buildRep(post) {
    const blob = await request(imgUrl(post.path), 'blob');
    const Decoder = W.ImageDecoder || window.ImageDecoder;
    if (post.mime === 'image/gif' && typeof Decoder === 'function') {
      try {   // animated GIF: decode every frame so it animates in game
        const dec = new Decoder({ data: await blob.arrayBuffer(), type: 'image/gif' });
        await dec.tracks.ready; await dec.completed;
        const count = Math.min(dec.tracks.selectedTrack.frameCount, 300);
        const frames = []; let t = 0;
        for (let i = 0; i < count; i++) {
          const { image } = await dec.decode({ frameIndex: i });
          const bmp = await createImageBitmap(image);
          t += Math.max(20, (image.duration || 100000) / 1000);
          image.close(); frames.push({ bmp, end: t });
        }
        dec.close();
        if (frames.length) return makeRep(frames, t);
      } catch (e) { /* fall back to a still image */ }
    }
    return makeRep([{ bmp: await toBitmap(blob), end: 1 }], 1);
  }
  async function syncSprites() {
    if (syncing || !S.sprites) return;
    syncing = true; SP.state = 'loading'; notify();
    try {
      const { data } = await request(API + '/rest/v1/art_posts?select=id,path,mime,replaces&approved=eq.true&order=created_at.desc,id.desc&limit=500');
      const wanted = data.filter((p) => Array.isArray(p.replaces) && p.replaces.length);
      const sig = JSON.stringify(wanted.map((p) => [p.id, p.path, p.replaces]));
      if (sig !== lastSig) {
        const next = new Map();
        for (const p of wanted) {   // newest first, so the newest art wins if two claim the same sprite
          let r = built.get(p.id);
          if (!r || r.path !== p.path) {
            try { r = await buildRep(p); r.path = p.path; built.set(p.id, r); } catch (e) { continue; }
          }
          p.replaces.forEach((k) => { k = spriteKey(k); if (k && !next.has(k)) next.set(k, r); });
        }
        for (const [id, r] of built) if (!wanted.some((p) => p.id === id)) { r.close(); built.delete(id); }
        reps = next; lookup = new WeakMap(); lastSig = sig;
      }
      SP.state = 'ok'; SP.count = built.size; SP.sprites = reps.size; SP.error = '';
    } catch (e) {
      SP.state = 'error'; SP.error = e.message;
    } finally { syncing = false; notify(); }
  }
  setInterval(() => { if (!document.hidden) syncSprites(); }, SYNC_EVERY);
  syncSprites();

  (function hookCanvas() {
    const C2D = W.CanvasRenderingContext2D;
    if (!C2D || C2D.prototype.__dsArtHooked) return;
    const proto = C2D.prototype, orig = proto.drawImage;
    const Img = W.HTMLImageElement;
    proto.__dsArtHooked = true;
    proto.drawImage = function (src) {
      let r = lookup.get(src);
      if (r === undefined) {
        if (src instanceof Img) {
          const u = src.currentSrc || src.src;
          if (!u || !src.complete) return orig.apply(this, arguments);   // not loaded yet: decide later
          const k = /^(data|blob):/.test(u) ? '' : spriteKey(u);
          if (k) noteSeen(k, u, src);
          r = (k && reps.get(k)) || false;
        } else r = false;
        lookup.set(src, r);
      }
      if (!r || !S.sprites) return orig.apply(this, arguments);
      const f = r.frame();
      const n = arguments.length;
      let dx, dy, dw, dh;
      if (n >= 9) { dx = arguments[5]; dy = arguments[6]; dw = arguments[7]; dh = arguments[8]; }
      else if (n >= 5) { dx = arguments[1]; dy = arguments[2]; dw = arguments[3]; dh = arguments[4]; }
      else { dx = arguments[1]; dy = arguments[2]; dw = src.naturalWidth || src.width; dh = src.naturalHeight || src.height; }
      // fit inside the sprite's box, standing on its bottom edge (so characters stay on the ground)
      const sc = Math.min(Math.abs(dw) / f.width, Math.abs(dh) / f.height);
      const w = f.width * sc * Math.sign(dw || 1), h = f.height * sc * Math.sign(dh || 1);
      return orig.call(this, f, dx + (dw - w) / 2, dy + dh - h, w, h);
    };
  })();

  function startUI() {
  /* ---------------- DOM (inside a shadow root so the game's CSS can't clash) ---------------- */
  const host = document.createElement('div');
  host.id = 'ds-art-panel';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;';
  // Stop clicks/keys in our UI from reaching the game.
  ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'keydown', 'keyup', 'keypress', 'contextmenu', 'touchstart']
    .forEach((t) => host.addEventListener(t, (e) => e.stopPropagation()));
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
<style>
:host{--bg:#0E1013;--panel:#171A1F;--panel2:#1D2127;--line:#2A2E35;--text:#ECE9E4;--muted:#8B8F98;--accent:#E8A33D}
*{box-sizing:border-box}
[hidden]{display:none!important}
.ui{font:400 14px/1.5 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--text)}
button,select,input{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.launcher{position:fixed;left:16px;bottom:16px;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);
  background:var(--panel);font-size:21px;line-height:1;cursor:pointer;box-shadow:0 6px 20px #0008;touch-action:none;
  display:flex;align-items:center;justify-content:center;transition:border-color .15s,transform .15s}
.launcher:hover{border-color:var(--accent);transform:scale(1.06)}

.panel{position:fixed;width:330px;max-width:calc(100vw - 16px);max-height:min(560px,calc(100vh - 16px));display:flex;flex-direction:column;
  background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 50px #000a;overflow:hidden}
.head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.head h2{margin:0;flex:1;font:700 15px/1 'JetBrains Mono',ui-monospace,Menlo,monospace}
.icon{width:28px;height:28px;border-radius:8px;border:1px solid transparent;background:none;cursor:pointer;font-size:16px;line-height:1;color:var(--muted)}
.icon:hover{border-color:var(--line);color:var(--text)}
.body{overflow:auto;padding:6px 14px 14px}

.sec{padding:12px 0;border-bottom:1px solid var(--line)}
.sec:last-child{border-bottom:0}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.name{font-weight:600}
.sub{color:var(--muted);font-size:12.5px;margin-top:2px}
.opts{margin-top:10px;display:grid;grid-template-columns:auto 1fr;gap:8px 10px;align-items:center;font-size:13px;color:var(--muted)}
select,input[type=range]{width:100%}
select{background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:5px 7px}
input[type=range]{accent-color:var(--accent)}

.sw{position:relative;flex:none;width:40px;height:23px;border-radius:999px;border:1px solid var(--line);background:var(--bg);cursor:pointer;padding:0}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:var(--muted);transition:transform .15s,background .15s}
.sw[aria-checked=true]{background:rgba(232,163,61,.18);border-color:var(--accent)}
.sw[aria-checked=true]::after{transform:translateX(17px);background:var(--accent)}

.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:transparent;border-radius:999px;padding:6px 12px;
  font:500 12px/1 'JetBrains Mono',ui-monospace,monospace;cursor:pointer;text-decoration:none;color:var(--text)}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn.wide{width:100%;justify-content:center;padding:9px}
.links{display:flex;gap:8px;margin-top:10px}

.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
.tile{aspect-ratio:1;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel2);cursor:zoom-in;padding:0;position:relative}
.tile:hover{border-color:var(--accent)}
.tile img{width:100%;height:100%;object-fit:cover;display:block}
.gif{position:absolute;top:4px;left:4px;font:700 9px/1 monospace;background:#000b;color:var(--accent);padding:3px 4px;border-radius:3px}
.note{color:var(--muted);font-size:13px;text-align:center;padding:18px 0}
.search{width:100%;margin:8px 0 6px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 9px}
.srow{display:flex;align-items:center;gap:9px;padding:6px 0;border-bottom:1px solid var(--line)}
.srow img{flex:none;width:36px;height:36px;object-fit:contain;image-rendering:pixelated;background:var(--panel2);border-radius:6px}
.srow .sn{flex:1;min-width:0;font:500 11.5px/1.35 'JetBrains Mono',ui-monospace,monospace;overflow-wrap:anywhere}
.srow .sn small{display:block;color:var(--muted);font-family:Inter,system-ui,sans-serif}
.srow .sn small.on{color:var(--accent)}
.ok{color:#7CD992}.bad{color:#FF7B7B}


.box{position:fixed;inset:0;background:rgba(5,6,8,.85);display:flex;align-items:center;justify-content:center;padding:16px}
.box .card{max-width:min(900px,100%);max-height:100%;display:flex;flex-direction:column;background:#0A0B0D;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.box img{max-width:100%;max-height:70vh;object-fit:contain;display:block;margin:0 auto}
.box .info{padding:10px 14px;border-top:1px solid var(--line)}
.box h3{margin:0;font-size:15px}
.box p{margin:2px 0 0;color:var(--muted);font-size:12.5px}
.box .desc{color:var(--text);font-size:13.5px;margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:18vh;overflow:auto}
.box .x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:#000a;color:var(--text);cursor:pointer;font-size:18px}

/* ---- pumpkin ---- */
.scare{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;
  background:radial-gradient(circle at center,rgba(60,20,0,.55),rgba(0,0,0,.92) 70%);animation:fade 1.6s ease forwards}
.scare .p{font-size:min(70vw,70vh);line-height:1;animation:pop .14s cubic-bezier(.2,1.6,.4,1) both, shake .09s linear .14s 8;
  filter:drop-shadow(0 0 40px rgba(255,120,0,.6))}
.scare .boo{font:900 min(14vw,110px)/1 Impact,'Arial Black',sans-serif;color:#ff8a1f;letter-spacing:.04em;margin-top:-4vh;
  text-shadow:0 0 18px #000,0 4px 0 #5a2200;animation:pop .2s .08s cubic-bezier(.2,1.6,.4,1) both}
@keyframes pop{from{transform:scale(.15);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes shake{0%{translate:0 0}25%{translate:-14px 6px}50%{translate:12px -8px}75%{translate:-8px -4px}100%{translate:0 0}}
@keyframes fade{0%,80%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.scare .p,.scare .boo{animation:none}}
</style>

<div class="ui">
  <button class="launcher" id="launch" title="Art panel (drag to move)" aria-label="Open art panel">🎨</button>

  <div class="panel" id="panel" hidden role="dialog" aria-label="Art panel">
    <div class="head">
      <button class="icon" id="back" hidden aria-label="Back">←</button>
      <h2 id="ptitle">Art panel</h2>
      <button class="icon" id="close" aria-label="Close">✕</button>
    </div>

    <div class="body" id="home">
      <div class="sec">
        <button class="btn wide" id="browse">🖼️ Browse the art wall</button>
        <div class="links"><a class="btn" href="${WALL}" target="_blank" rel="noopener">Post your own art ↗</a></div>
      </div>

      <div class="sec">
        <div class="row">
          <div><div class="name">🎄 Festive sprites</div><div class="sub" id="sp-status">Swaps some game sprites for art from the wall.</div></div>
          <button class="sw" id="t-sprites" role="switch" aria-label="Festive sprites"></button>
        </div>
        <div class="links"><button class="btn" id="sp-sync">↻ Check now</button><button class="btn" id="finder">🔍 Sprite finder</button></div>
      </div>

      <div class="sec">
        <div class="row">
          <div><div class="name">🎃 Pumpkin jumpscare</div><div class="sub">A pumpkin jumps out at random while you play. You asked for this.</div></div>
          <button class="sw" id="t-jump" role="switch" aria-label="Pumpkin jumpscare"></button>
        </div>
        <div class="opts" id="o-jump">
          <span>How often</span>
          <select id="jumpFreq"><option value="rare">Rarely (15-40 min)</option><option value="sometimes">Sometimes (4-12 min)</option><option value="often">Often (1-2 min)</option></select>
        </div>
        <div class="links"><button class="btn" id="test">Test it now</button></div>
      </div>
    </div>

    <div class="body" id="finderv" hidden>
      <div class="sub">Every sprite the game has drawn since you loaded it. Walk around to find more. Copy a name and paste it into the art wall's admin box to replace that sprite.</div>
      <input class="search" id="fsearch" placeholder="Search, e.g. npc, house, tree" autocomplete="off">
      <div id="flist"></div>
      <div class="note" id="fnote" hidden></div>
    </div>

    <div class="body" id="gallery" hidden>
      <div class="grid" id="grid"></div>
      <div class="note" id="gnote">Loading…</div>
      <button class="btn wide" id="more" hidden>Load more</button>
    </div>
  </div>

  <div class="box" id="box" hidden>
    <button class="x" id="bx" aria-label="Close">✕</button>
    <div class="card"><img id="bimg" alt="">
      <div class="info"><h3 id="btitle"></h3><p id="bmeta"></p><div class="desc" id="bdesc" hidden></div></div>
    </div>
  </div>
</div>`;

  (document.body || document.documentElement).appendChild(host);
  const $ = (id) => root.getElementById(id);

  /* ---------------- dragging ---------------- */
  function place(el, x, y) {
    const r = el.getBoundingClientRect();
    x = Math.max(4, Math.min(x, window.innerWidth - r.width - 4));
    y = Math.max(4, Math.min(y, window.innerHeight - r.height - 4));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  }
  function draggable(el, handle, key, onTap) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (e.target !== handle && e.target.closest('button') && e.target !== handle)) return;
      const r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      let moved = false;
      handle.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        moved = true; place(el, r.left + ev.clientX - sx, r.top + ev.clientY - sy);
      };
      const up = (ev) => {
        handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        if (moved) { const b = el.getBoundingClientRect(); S[key] = { x: b.left, y: b.top }; save(); }
        else if (onTap && ev.type === 'pointerup') onTap();
      };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
    });
  }
  function restore(el, key) { if (S[key]) requestAnimationFrame(() => place(el, S[key].x, S[key].y)); }
  window.addEventListener('resize', () => {
    [['launch', 'launcherPos']].forEach(([id, k]) => { const el = $(id); if (S[k] && !el.hidden) place(el, S[k].x, S[k].y); });
  });

  /* ---------------- panel ---------------- */
  const panel = $('panel');
  function openPanel() {
    panel.hidden = false;
    const l = $('launch').getBoundingClientRect(), p = panel.getBoundingClientRect();
    const x = l.left + l.width / 2 < window.innerWidth / 2 ? l.left : l.right - p.width;
    const y = l.top > window.innerHeight / 2 ? l.top - p.height - 8 : l.bottom + 8;
    place(panel, x, y);
  }
  function closePanel() { panel.hidden = true; showHome(); }
  draggable($('launch'), $('launch'), 'launcherPos', () => (panel.hidden ? openPanel() : closePanel()));
  $('launch').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); panel.hidden ? openPanel() : closePanel(); } });
  restore($('launch'), 'launcherPos');
  $('close').onclick = closePanel;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('box').hidden) $('box').hidden = true; else if (!panel.hidden) closePanel();
  }, true);

  function showHome() { $('home').hidden = false; $('gallery').hidden = true; $('finderv').hidden = true; $('back').hidden = true; $('ptitle').textContent = 'Art panel'; clearInterval(finderTimer); }
  let finderTimer = null;
  $('back').onclick = showHome;

  // switches + options
  function bindSwitch(id, key, onChange) {
    const sw = $(id);
    const paint = () => sw.setAttribute('aria-checked', String(!!S[key]));
    paint();
    sw.onclick = () => { S[key] = !S[key]; save(); paint(); onChange(); };
  }
  function bindSelect(id, key, cast, onChange) {
    const el = $(id); el.value = String(cast === Boolean ? (S[key] ? 1 : 0) : S[key]);
    el.onchange = () => { S[key] = cast === Boolean ? el.value === '1' : cast(el.value); save(); onChange && onChange(); };
  }
  const paintOpts = () => { $('o-jump').style.opacity = S.jump ? 1 : .45; };

  /* ---------------- gallery ---------------- */
  let gOffset = 0, gLoaded = false;
  const posts = new Map();
  function tile(p) {
    posts.set(p.id, p);
    const b = document.createElement('button');
    b.className = 'tile'; b.title = (p.title || 'Untitled') + ' by ' + p.username;
    const img = document.createElement('img'); img.loading = 'lazy'; img.alt = p.title || 'Untitled';
    if (isPixel(p)) img.style.imageRendering = 'pixelated';
    setImg(img, p.path); b.appendChild(img);
    if (p.mime === 'image/gif') { const g = document.createElement('span'); g.className = 'gif'; g.textContent = 'GIF'; b.appendChild(g); }
    b.onclick = () => openBox(p);
    return b;
  }
  async function loadGallery() {
    $('more').disabled = true;
    try {
      const { data } = await listArt(gOffset, PAGE);
      data.forEach((p) => $('grid').appendChild(tile(p)));
      gOffset += data.length;
      $('gnote').hidden = gOffset > 0;
      $('gnote').textContent = 'No approved art yet. Post yours on the art wall!';
      $('more').hidden = data.length < PAGE;
    } catch (e) {
      $('gnote').hidden = false; $('gnote').textContent = "Couldn't load the art wall (" + e.message + ').';
    } finally { $('more').disabled = false; }
  }
  $('browse').onclick = () => {
    $('home').hidden = true; $('gallery').hidden = false; $('back').hidden = false; $('ptitle').textContent = 'Art wall';
    if (!gLoaded) { gLoaded = true; loadGallery(); }
  };
  $('more').onclick = loadGallery;

  function openBox(p) {
    const img = $('bimg'); img.removeAttribute('src'); img.alt = p.title || 'Untitled';
    img.style.imageRendering = isPixel(p) ? 'pixelated' : 'auto';
    setImg(img, p.path);
    $('btitle').textContent = p.title || 'Untitled';
    $('bmeta').textContent = 'by ' + p.username + ' · ' + ago(p.created_at);
    $('bdesc').textContent = p.description || ''; $('bdesc').hidden = !p.description;
    $('box').hidden = false;
  }
  $('bx').onclick = () => { $('box').hidden = true; };
  $('box').addEventListener('click', (e) => { if (e.target === $('box')) $('box').hidden = true; });

  /* ---------------- pumpkin jumpscare ---------------- */
  let scareTimer = null;
  function scare() {
    const el = document.createElement('div');
    el.className = 'scare ui';
    el.innerHTML = '<div class="p">🎃</div><div class="boo">BOO!</div>';
    const done = () => el.remove();
    el.addEventListener('click', done);
    el.addEventListener('animationend', (e) => { if (e.animationName === 'fade') done(); });
    root.appendChild(el);
    setTimeout(done, 2500);
  }
  function scheduleScare() {
    clearTimeout(scareTimer);
    if (!S.jump) return;
    const [a, b] = FREQ[S.jumpFreq] || FREQ.sometimes;
    scareTimer = setTimeout(() => {
      if (S.jump && !document.hidden) scare(); // never fire while the tab is in the background
      scheduleScare();
    }, (a + Math.random() * (b - a)) * 1000);
  }
  $('test').onclick = () => { closePanel(); setTimeout(scare, 150); };

  /* ---------------- festive sprites UI ---------------- */
  function paintSprites() {
    const st = $('sp-status');
    st.className = 'sub';
    if (!S.sprites) st.textContent = 'Off. The game looks normal.';
    else if (SP.state === 'loading') st.textContent = 'Checking the art wall…';
    else if (SP.state === 'error') { st.textContent = "Couldn't reach the art wall (" + SP.error + ').'; st.className = 'sub bad'; }
    else if (SP.state === 'ok' && SP.sprites) { st.textContent = SP.sprites + ' sprite' + (SP.sprites === 1 ? '' : 's') + ' swapped for festive art.'; st.className = 'sub ok'; }
    else if (SP.state === 'ok') st.textContent = 'No festive sprites have been assigned yet.';
    else st.textContent = 'Swaps some game sprites for art from the wall.';
  }
  listeners.add(paintSprites);
  $('sp-sync').onclick = () => syncSprites();

  function copyText(t) {
    try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(t, 'text'); return Promise.resolve(); } } catch (e) { /* ignore */ }
    return navigator.clipboard.writeText(t);
  }
  function renderFinder() {
    const q = $('fsearch').value.trim().toLowerCase();
    const keys = [...seen.keys()].filter((k) => !q || k.includes(q)).sort();
    const list = $('flist'); list.textContent = '';
    keys.slice(0, 300).forEach((k) => {
      const info = seen.get(k);
      const row = document.createElement('div'); row.className = 'srow';
      const im = document.createElement('img'); im.src = info.url; im.alt = '';
      const sn = document.createElement('div'); sn.className = 'sn'; sn.textContent = k;
      const sm = document.createElement('small');
      sm.textContent = info.w + '×' + info.h + (reps.has(k) ? ' · replaced' : '');
      if (reps.has(k)) sm.className = 'on';
      sn.appendChild(sm);
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Copy';
      b.onclick = () => copyText(k).then(() => { b.textContent = 'Copied!'; setTimeout(() => { b.textContent = 'Copy'; }, 1200); }, () => { b.textContent = 'Failed'; });
      row.append(im, sn, b); list.appendChild(row);
    });
    $('fnote').hidden = keys.length > 0 && keys.length <= 300;
    $('fnote').textContent = !seen.size ? 'Nothing yet. Play for a moment, then check again.' : !keys.length ? 'No match.' : 'Showing 300 of ' + keys.length + '. Search to narrow it down.';
  }
  $('finder').onclick = () => {
    $('home').hidden = true; $('finderv').hidden = false; $('back').hidden = false; $('ptitle').textContent = 'Sprite finder';
    renderFinder(); clearInterval(finderTimer);
    finderTimer = setInterval(() => { if (!panel.hidden && !$('finderv').hidden && document.activeElement !== host) renderFinder(); }, 3000);
  };
  $('fsearch').addEventListener('input', renderFinder);

  /* ---------------- wire up ---------------- */
  bindSwitch('t-sprites', 'sprites', () => { lookup = new WeakMap(); if (S.sprites) syncSprites(); paintSprites(); });
  bindSwitch('t-jump', 'jump', () => { paintOpts(); scheduleScare(); });
  bindSelect('jumpFreq', 'jumpFreq', String, scheduleScare);
  paintOpts();
  paintSprites();
  scheduleScare();
  }  // end startUI

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startUI, { once: true });
  else startUI();
})();
