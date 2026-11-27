// Flatfish's Pond: reads the bot's data from Supabase (read-only) and draws it.
(() => {
  const CFG = window.CONFIG || {};
  const GAME = window.GAME;
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_PUBLISHABLE_KEY || new URLSearchParams(location.search).has("demo");
  const $ = (sel) => document.querySelector(sel);
  const view = $("#view");

  const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  const RARITY_VAR = { Junk: "--junk", Common: "--common", Uncommon: "--uncommon", Rare: "--rare", Epic: "--epic", Legendary: "--legendary" };
  const color = (r) => getComputedStyle(document.documentElement).getPropertyValue(RARITY_VAR[r]).trim() || "#ccc";

  // ---------- small helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (n) => Number(n || 0).toLocaleString("en-GB");
  const kg = (w) => (w >= 100 ? `${Math.round(w).toLocaleString("en-GB")}kg` : `${w.toFixed(w < 1 ? 2 : 1)}kg`);
  const minsLeft = (t) => Math.max(0, Math.ceil((t - Date.now()) / 60000));
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const cleanName = (s) => String(s || "").trim().replace(/[^\w-]/g, "").slice(0, 30);
  // Christmas: December mode. Add ?xmas=2026-12-05 to the address to preview any day.
  const XMAS_TEST = new URLSearchParams(location.search).get("xmas") || "";
  function today() {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(XMAS_TEST) ? new Date(`${XMAS_TEST}T12:00:00Z`) : new Date();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  const isDecember = () => today().m === 12;
  const adventDoor = () => (isDecember() && today().d <= 24 ? today().d : 0);
  // The calendar stays on profiles until 6 January
  const adventYear = () => (today().m === 12 ? today().y : today().m === 1 && today().d <= 6 ? today().y - 1 : 0);
  const profileLink = (name) => `#/p/${encodeURIComponent(String(name).toLowerCase())}`;
  const caughtAgo = (t) => {
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  $("#bot-name").textContent = CFG.BOT_NAME || "flatfish";
  $("#source-note").textContent = DEMO
    ? "You're looking at demo data. Add your Supabase details to config.js to show the real pond."
    : "Updated by the bot about once a minute.";

  // ---------- data: Supabase or demo ----------
  async function api(path, { count = false } = {}) {
    const res = await fetch(`${CFG.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${path}`, {
      method: count ? "HEAD" : "GET",
      headers: { apikey: CFG.SUPABASE_PUBLISHABLE_KEY, ...(count ? { Prefer: "count=exact", Range: "0-0" } : {}) },
    });
    if (!res.ok) throw new Error(`The pond's database answered ${res.status}.`);
    if (count) return Number((res.headers.get("content-range") || "/0").split("/")[1]) || 0;
    return res.json();
  }

  // Gets every row, 1000 at a time (Supabase's page size)
  async function apiAll(path) {
    const out = [];
    for (let offset = 0; offset < 50000; offset += 1000) {
      const rows = await api(`${path}&limit=1000&offset=${offset}`);
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  }

  // ---------- "this is me" (remembered in this browser only) ----------
  const ME_KEY = "pond-me";
  const getMe = () => {
    try {
      return localStorage.getItem(ME_KEY) || "";
    } catch {
      return "";
    }
  };
  const setMe = (name) => {
    try {
      name ? localStorage.setItem(ME_KEY, name) : localStorage.removeItem(ME_KEY);
    } catch {}
    updateMeLink();
  };
  function updateMeLink() {
    const a = $("#me-link");
    if (!a) return;
    const me = getMe();
    a.hidden = !me;
    if (me) a.href = profileLink(me);
  }
  updateMeLink();

  // December: pixel snow over the water
  if (isDecember()) {
    document.body.classList.add("xmas");
    const snow = document.createElement("div");
    snow.className = "snow";
    snow.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 36; i++) {
      const f = document.createElement("i");
      f.style.left = `${(i * 37) % 100}%`;
      f.style.animationDelay = `${-((i * 7.3) % 14)}s`;
      f.style.animationDuration = `${10 + (i % 5) * 2}s`;
      if (i % 3 === 0) f.className = "big";
      snow.appendChild(f);
    }
    document.querySelector(".surface").appendChild(snow);
  }

  const demo = makeDemo();
  const data = {
    top: () => (DEMO ? demo.top() : api("players?select=name,display,title,points,contest_wins&points=gt.0&order=points.desc&limit=20")),
    // Hall of Champions (an older Supabase setup may not have this table: show nothing then)
    history: () =>
      DEMO ? demo.history() : api("contest_history?select=*&order=id.desc&limit=10").catch(() => []),
    recent: () =>
      DEMO ? demo.recent() : api("catches?select=player,fish,rarity,weight,caught_at&rarity=in.(Epic,Legendary)&order=id.desc&limit=8"),
    player: async (name) =>
      DEMO ? demo.player(name) : (await api(`players?name=eq.${encodeURIComponent(name)}&select=*`))[0] || null,
    rank: (points) => (DEMO ? demo.rank(points) : api(`players?select=name&points=gt.${Number(points) || 0}`, { count: true }).then((n) => n + 1)),
    aquarium: (name) => (DEMO ? demo.aquarium(name) : api(`aquarium?player=eq.${encodeURIComponent(name)}&select=*`)),
    catches: (name) =>
      DEMO
        ? demo.catches(name)
        : api(`catches?player=eq.${encodeURIComponent(name)}&select=fish,rarity,weight,points,caught_at&order=id.desc&limit=8`),
    achievements: (name) => (DEMO ? demo.achievements(name) : api(`achievements?player=eq.${encodeURIComponent(name)}&select=key`)),
    // Advent doors a player opened (an older Supabase setup may not have this table: none then)
    advent: (name, year) =>
      DEMO
        ? demo.advent(name)
        : api(`advent?player=eq.${encodeURIComponent(name)}&year=eq.${year}&select=day,gift,opened_at&order=day.asc`).catch(() => []),
    // Trading post (an older Supabase setup may not have these tables: nothing then)
    items: (name) =>
      DEMO ? demo.items(name) : api(`limited_items?owner=eq.${encodeURIComponent(name)}&select=kind,serial,earned_by&order=kind.asc,serial.asc`).catch(() => []),
    itemCounts: () => (DEMO ? demo.itemCounts() : api("limited_items?select=kind").catch(() => [])),
    listings: () =>
      DEMO ? demo.listings() : api("listings?status=in.(open,reserved)&select=*&order=est_value.asc.nullslast,id.asc&limit=50").catch(() => []),
    sales: () => (DEMO ? demo.sales() : api("sales?select=*&order=id.desc&limit=15").catch(() => [])),
    launchCounts: () =>
      DEMO
        ? Promise.resolve({ founders: 14, dayOne: 86 })
        : Promise.all([
            api(`limited_items?select=id&kind=eq.${GAME.launch.kind}`, { count: true }).catch(() => 0),
            api("achievements?select=player&key=eq.day_one", { count: true }).catch(() => 0),
          ]).then(([founders, dayOne]) => ({ founders, dayOne })),
    adventOpened: (year, day) =>
      DEMO ? Promise.resolve(9) : api(`advent?select=player&year=eq.${year}&day=eq.${day}`, { count: true }).catch(() => null),
    search: (q) =>
      DEMO ? demo.search(q) : api(`players?select=name,display,title&display=ilike.*${encodeURIComponent(q)}*&order=points.desc&limit=8`),
    live: async () => (DEMO ? demo.live() : ((await api("live?id=eq.1&select=data"))[0] || {}).data || null),
    // Leaderboards by a player column (points, contest_wins, boss_kills)
    board: (col) =>
      DEMO
        ? demo.board(col)
        : api(`players?select=name,display,title,points,contest_wins,boss_kills&${col}=gt.0&order=${col}.desc&limit=20`),
    // Every player's best catch of every species (for records and the species leaderboard)
    aquariumAll: () => (DEMO ? demo.aquariumAll() : apiAll("aquarium?select=player,fish,rarity,caught,best_weight&order=player.asc,fish.asc")),
    names: (list) =>
      DEMO || !list.length
        ? Promise.resolve(DEMO ? demo.names(list) : [])
        : api(`players?select=name,display,title&name=in.(${list.map(encodeURIComponent).join(",")})`),
    stats: () =>
      DEMO
        ? demo.stats()
        : Promise.all([
            api("players?select=name&casts=gt.0", { count: true }),
            api("catches?select=id", { count: true }),
            api("catches?select=id&rarity=eq.Legendary", { count: true }),
          ]).then(([anglers, fish, legendary]) => ({ anglers, fish, legendary })),
  };

  // ---------- pixel fish ----------
  // Shapes face right. T = tail, X = body, E = eye. Lower rows get a lighter belly.
  const SHAPES = {
    fish: ["TT..XXXXX...", "TTTXXXXXXXX.", "TTXXXXXXXEXX", "TTXXXXXXXXXX", "TTTXXXXXXXX.", "TT..XXXXX..."],
    long: ["T..XXXXXXXXXXX..", "TTXXXXXXXXXXXEXX", "T..XXXXXXXXXXX.."],
    round: ["...XXXX..", "T.XXXXXX.", "TXXXXXEXX", "TXXXXXXXX", "T.XXXXXX.", "...XXXX.."],
    flat: ["...XXXXXX....", "TXXXXXXXXXXX.", "TTXXXXXXXXEXX", "TXXXXXXXXXXX.", "...XXXXXX...."],
  };
  function shapeFor(name) {
    if (/eel|herring|sardine|minnow|anchovy|oarfish|barracuda|sturgeon/i.test(name)) return "long";
    if (/puffer|jelly|kraken|koi|squid|sunfish|angler|bluegill/i.test(name)) return "round";
    if (/ray|flat|whale|shark|flounder/i.test(name)) return "flat";
    return "fish";
  }
  function shade(hex, amt) {
    const n = parseInt(hex.replace("#", ""), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt))));
    return `rgb(${c.join(",")})`;
  }
  function fishSVG(name, rarity) {
    const rows = SHAPES[shapeFor(name)];
    const base = color(rarity);
    const tilt = (hash(name) % 40) - 20; // each species gets a slightly different shade
    const body = shade(base, tilt / 2);
    const belly = shade(base, 45 + tilt / 3);
    const tail = shade(base, -45);
    let rects = "";
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        const fill = ch === "T" ? tail : ch === "E" ? "#0c2b37" : y >= rows.length / 2 ? belly : body;
        rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
      })
    );
    return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  const SIZE = { Common: 42, Uncommon: 54, Rare: 68, Epic: 88, Legendary: 108 };
  // Pixel art from sprites.js. `w` is the width in CSS pixels (height follows).
  const SCALE = { Junk: 2.6, Common: 3, Uncommon: 3.4, Rare: 3.8, Epic: 4.4, Legendary: 5 };
  function art(name, w, opts = {}) {
    if (!window.SPRITES || !SPRITES.has(name)) return "";
    const z = SPRITES.size(name);
    return SPRITES.svg(name, opts).replace("<svg ", `<svg style="width:${w}px;height:${Math.round((w * z.h) / z.w)}px" `);
  }
  // Fixed-size box for list icons, so rows line up whatever the sprite's shape
  const icon = (name, box = 56, opts) => {
    if (!window.SPRITES || !SPRITES.has(name)) return `<span class="ico" style="width:${box}px"></span>`;
    const z = SPRITES.size(name);
    const w = Math.min(box, Math.round((box * 0.62 * z.w) / z.h));
    return `<span class="ico" style="width:${box}px">${art(name, w, opts)}</span>`;
  };

  // ---------- live event strip ----------
  async function renderLive() {
    const el = $("#live");
    let live;
    try {
      live = await data.live();
    } catch {
      el.className = "live";
      el.textContent = "";
      return;
    }
    if (!live) return;
    const online = live.online && Date.now() - (live.at || 0) < 4 * 60 * 1000;
    const bot = esc(CFG.BOT_NAME || "flatfish");
    const status = `<p><span class="status-dot ${online ? "on" : ""}"></span>${bot} is ${online ? "online and fishing" : "offline right now"}.</p>`;
    const ev = live.event && live.event.endsAt > Date.now() ? live.event : null;
    if (!ev) {
      el.className = "live";
      const next = live.nextBossAt && live.nextBossAt > Date.now() ? ` The next boss is due in about ${Math.max(1, Math.round((live.nextBossAt - Date.now()) / 3600000))}h.` : "";
      const champ = live.champion ? ` Reigning contest champion: ${esc(live.champion.display)}.` : "";
      el.innerHTML = `${status}<p>No event right now.${next}${champ}</p>`;
      return;
    }
    if (ev.type === "golden") {
      el.className = "live golden";
      el.innerHTML = `<strong>Golden Hour</strong><p>Rare, Epic and Legendary fish are ${ev.multiplier || 2}x more likely for ${minsLeft(ev.endsAt)} more minutes.</p>${status}`;
    } else if (ev.type === "boss") {
      el.className = "live boss";
      const pct = Math.round((100 * ev.hp) / Math.max(1, ev.maxHp));
      const top = (ev.top || []).map((t) => `${esc(t.name)} ${num(t.dmg)}`).join(", ");
      el.innerHTML = `<strong>${esc(ev.name)} is attacking!</strong>
        <div class="hp" role="progressbar" aria-label="Boss health" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
        <p>${num(ev.hp)} of ${num(ev.maxHp)} HP left, ${minsLeft(ev.endsAt)} minutes to go.${top ? ` Most damage: ${top}.` : ""}</p>${status}`;
    } else if (ev.type === "contest") {
      el.className = "live contest";
      const top = (ev.top || []).map((t, i) => `${i + 1}. ${esc(t.name)} ${num(t.points)} (${esc(t.fish)})`).join(", ");
      el.innerHTML = `<strong>Fishing contest</strong><p>${minsLeft(ev.endsAt)} minutes left. ${top || "No entries yet."}</p>${status}`;
    }
  }

  // ---------- pages ----------
  // Each page has load() (fetch data) and draw(data). Auto-refresh re-runs load()
  // and only redraws if the data actually changed, so the fish don't jump around.
  const BOARDS = [
    { key: "points", label: "Points", col: "points", value: (p) => num(p.points) },
    { key: "species", label: "Species", value: (p) => `${num(p.species)}/${Object.values(GAME.fish).flat().length}` },
    { key: "trophies", label: "Trophies", col: "contest_wins", value: (p) => `🏆 ${num(p.contest_wins)}` },
    { key: "bosses", label: "Bosses beaten", col: "boss_kills", value: (p) => num(p.boss_kills) },
  ];
  let boardTab = "points";

  async function loadBoard(tab) {
    const b = BOARDS.find((x) => x.key === tab) || BOARDS[0];
    if (b.col) return data.board(b.col);
    // Species: count distinct species per player from everyone's aquariums
    const rows = await data.aquariumAll();
    const counts = new Map();
    for (const r of rows) counts.set(r.player, (counts.get(r.player) || 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const named = new Map((await data.names(top.map(([n]) => n))).map((p) => [p.name, p]));
    return top.map(([name, species]) => ({ name, display: (named.get(name) || {}).display || name, title: (named.get(name) || {}).title, species }));
  }

  function boardHTML(rows, tab, champ) {
    const b = BOARDS.find((x) => x.key === tab) || BOARDS[0];
    if (!rows.length) return `<p class="empty">${tab === "points" ? "Nobody has fished yet. Type -fish in FlatMMO to be the first." : "Nobody is on this board yet."}</p>`;
    return `<ol class="board">${rows
      .map(
        (p, i) => `<li><span class="pos">${i + 1}</span>
          <span>${champ && champ.name === p.name ? `<span class="crown" title="Reigning contest champion">👑</span>` : ""}<a href="${profileLink(p.name)}">${esc(p.display)}</a>${p.title ? `<span class="t">the ${esc(p.title)}</span>` : ""}${tab === "points" && p.contest_wins ? `<span class="trophy" title="Contest trophies">🏆${num(p.contest_wins)}</span>` : ""}</span>
          <span class="pts">${b.value(p)}</span></li>`
      )
      .join("")}</ol>`;
  }

  async function loadHome() {
    const door = adventDoor();
    const launchOn = GAME.launch && Date.now() < GAME.launch.until && !XMAS_TEST;
    const [board, recent, history, live, stats, doorCount, launch] = await Promise.all([
      loadBoard(boardTab),
      data.recent(),
      data.history(),
      data.live().catch(() => null),
      data.stats().catch(() => null),
      door ? data.adventOpened(today().y, door) : Promise.resolve(null),
      launchOn ? data.launchCounts() : Promise.resolve(null),
    ]);
    return { board, recent, history, champion: live && live.champion, stats, tab: boardTab, door, doorCount, launch };
  }

  function timeLeft(until) {
    const mins = Math.max(0, Math.floor((until - Date.now()) / 60000));
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    return d ? `${d} day${d === 1 ? "" : "s"} ${h}h` : h ? `${h}h ${mins % 60}m` : `${mins} minutes`;
  }

  function drawHome(d) {
    document.title = "Flatfish's Pond: FlatMMO fishing";
    const champ = d.champion;
    const bot = esc(CFG.BOT_NAME || "flatfish");

    const launch = d.launch
      ? `<section class="banner launch" aria-labelledby="launch-h">
          <div class="banner-art">${art(GAME.launch.name, 120)}</div>
          <div>
            <h2 id="launch-h">Launch weekend</h2>
            <p>The <b>${esc(GAME.launch.name)}</b> is in the shop for ${num(GAME.launch.price)} coins until 30 November, then never again. It gives a 10% chance of a second fish on every cast.</p>
            <p class="facts"><span><b>${num(d.launch.founders)}</b> sold</span><span><b>${num(d.launch.dayOne)}</b> anglers have earned the Day One title</span><span>Ends in <b>${timeLeft(GAME.launch.until)}</b></span></p>
            <p><code>/pm ${bot} shop</code></p>
          </div>
        </section>`
      : "";
    const advent = d.door
      ? `<section class="banner xmas-banner" aria-labelledby="advent-h">
          <div class="banner-art">${art("Present", 84)}</div>
          <div>
            <h2 id="advent-h">Advent calendar: door ${d.door}</h2>
            <p>A gift every day until Christmas Eve. Open ${GAME.advent.titleDoors} doors for the Candy Cane Rod.${d.doorCount ? ` ${num(d.doorCount)} ${d.doorCount === 1 ? "angler has" : "anglers have"} opened today's door.` : ""}</p>
            <p><code>/pm ${bot} advent</code></p>
          </div>
        </section>`
      : "";
    const start = `
      <section class="start" aria-labelledby="start-h">
        <h2 id="start-h">Start fishing</h2>
        <p>Flatfish lives in FlatMMO chat. Send it a message to cast your line:</p>
        <p class="big-cmd"><code>/pm ${bot} fish</code></p>
        <p class="quiet">Then try <code>shop</code>, <code>daily</code> and <code>help</code> the same way.</p>
      </section>`;
    const pondStats = d.stats
      ? `<p class="pond-stats">${num(d.stats.fish)} fish caught by ${num(d.stats.anglers)} ${d.stats.anglers === 1 ? "angler" : "anglers"} so far, ${num(d.stats.legendary)} of them Legendary.</p>`
      : "";
    const tabs = `<div class="tabs" role="tablist" aria-label="Leaderboards">${BOARDS.map(
      (b) => `<button role="tab" type="button" data-tab="${b.key}" aria-selected="${b.key === d.tab}">${b.label}</button>`
    ).join("")}</div>`;
    const reigning = champ
      ? `<p class="reigning">👑 Contest champion: <a href="${profileLink(champ.name)}">${esc(champ.display)}</a></p>`
      : "";
    const big = d.recent.length
      ? `<ul class="rows">${d.recent
          .slice(0, 6)
          .map(
            (c) => `<li>${icon(c.fish)}<div><b>${esc(c.fish)}</b> <span class="rar" style="color:var(${RARITY_VAR[c.rarity]})">${c.rarity}</span>
              <span class="sub">${kg(c.weight)}, caught by <a href="${profileLink(c.player)}">${esc(c.player)}</a>${c.caught_at ? ` ${caughtAgo(c.caught_at)}` : ""}</span></div></li>`
          )
          .join("")}</ul>`
      : `<p class="empty">No Epic or Legendary catches yet. Could be you.</p>`;
    const hall = d.history.length
      ? `<details class="more"><summary>Past contest winners</summary>
        <ul class="rows">${d.history
          .map(
            (h) => `<li>${icon(h.fish, 48)}<div><a href="${profileLink(h.winner)}"><b>${esc(h.display)}</b></a>
              <span class="sub">won with a ${kg(h.weight)} ${esc(h.fish)} against ${h.entrants - 1} ${h.entrants === 2 ? "rival" : "rivals"}, ${new Date(h.ended_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></div></li>`
          )
          .join("")}</ul></details>`
      : "";

    view.innerHTML = `${launch}${advent}${start}${pondStats}
      <h2>Top anglers</h2>${reigning}${tabs}<div id="board">${boardHTML(d.board, d.tab, champ)}</div>
      <h2>Latest big catches</h2>${big}${hall}`;
    view.querySelectorAll(".tabs button").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (btn.dataset.tab === boardTab) return;
        boardTab = btn.dataset.tab;
        view.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === btn)));
        const box = $("#board");
        box.innerHTML = `<p class="loading">Counting fish…</p>`;
        try {
          box.innerHTML = boardHTML(await loadBoard(boardTab), boardTab, champ);
        } catch (e) {
          box.innerHTML = `<p class="empty">Couldn't load this leaderboard. ${esc(e.message)}</p>`;
        }
      })
    );
  }


  // ---------- world records ----------
  async function loadRecords() {
    const rows = await data.aquariumAll();
    const best = new Map(); // fish -> { player, weight }
    const anglers = new Map(); // fish -> how many players caught it
    for (const r of rows) {
      anglers.set(r.fish, (anglers.get(r.fish) || 0) + 1);
      const b = best.get(r.fish);
      if (!b || r.best_weight > b.weight) best.set(r.fish, { player: r.player, weight: r.best_weight });
    }
    const holders = [...new Set([...best.values()].map((b) => b.player))];
    const named = Object.fromEntries((await data.names(holders)).map((p) => [p.name, p.display]));
    return {
      records: Object.fromEntries([...best].map(([fish, b]) => [fish, { ...b, display: named[b.player] || b.player, anglers: anglers.get(fish) }])),
    };
  }

  // Big and crisp: whole sprite pixels, at most 160 wide and 84 tall
  function dexW(f) {
    const z = SPRITES.size(f);
    const k = Math.max(2, Math.min(6, Math.floor(Math.min(160 / z.w, 84 / z.h))));
    return z.w * k;
  }
  function drawRecords(d) {
    document.title = "Fishdex: Flatfish's Pond";
    const total = Object.values(GAME.fish).flat().length;
    const found = Object.keys(d.records).length;
    const groups = GAME.rarities
      .map((r) => {
        const cards = GAME.fish[r]
          .map((f) => {
            const rec = d.records[f];
            return rec
              ? `<li class="card"><div class="card-art">${art(f, dexW(f))}</div>
                  <b>${esc(f)}</b>
                  <span class="sub">Record ${kg(rec.weight)} by <a href="${profileLink(rec.player)}">${esc(rec.display)}</a></span>
                  <span class="sub">Found by ${rec.anglers} ${rec.anglers === 1 ? "angler" : "anglers"}</span></li>`
              : `<li class="card unknown"><div class="card-art">${art(f, dexW(f), { silhouette: true })}</div>
                  <b>???</b><span class="sub">Nobody has caught one yet</span></li>`;
          })
          .join("");
        return `<h2 class="rar-h" style="--c:var(${RARITY_VAR[r]})">${r}</h2><ul class="cards">${cards}</ul>`;
      })
      .join("");
    view.innerHTML = `
      <h1>Fishdex</h1>
      <p class="lead">Every fish in the pond, with the heaviest catch and who holds the record. ${found} of ${total} found so far: dark ones are still waiting for someone to catch them.</p>
      ${groups}`;
  }


  // ---------- player profile ----------
  async function loadPlayer(name) {
    const p = await data.player(name);
    if (!p) return { missing: name };
    const year = adventYear();
    const [rank, tank, achRows, live, recentCatches, advent, owned] = await Promise.all([
      data.rank(p.points),
      data.aquarium(p.name),
      data.achievements(p.name),
      data.live().catch(() => null),
      data.catches(p.name).catch(() => []),
      year ? data.advent(p.name, year) : Promise.resolve(null),
      data.items(p.name),
    ]);
    return { p, rank, tank, achRows, champion: live && live.champion, recentCatches, advent, owned };
  }

  function drawPlayer(d) {
    if (d.missing) {
      view.innerHTML = `<h1>${esc(d.missing)}</h1><p class="empty">This angler hasn't fished yet. Names must match exactly as they appear in FlatMMO.</p><a class="back" href="#/">Back to the leaderboard</a>`;
      return;
    }
    const { p, rank, tank, achRows, recentCatches } = d;
    document.title = `${p.display}'s aquarium: Flatfish's Pond`;
    const isChamp = d.champion && d.champion.name === p.name;
    const caught = new Map(tank.map((t) => [t.fish, t]));
    const species = Object.values(GAME.fish).flat().length;
    const have = new Set(achRows.map((a) => a.key));
    const isMe = getMe() === p.name;
    const candy = have.has("festive_angler"); // earned through the advent calendar
    const owned = d.owned || [];
    const holdsCane = owned.some((it) => it.kind === "candy_cane_rod"); // the perk follows the item
    const holdsFounder = owned.some((it) => it.kind === "founders_rod");
    const baseRod = GAME.rods[p.rod] || "Twig Rod";
    const rod = `${holdsFounder ? "Founder's " : ""}${holdsCane ? "Candy Cane " : ""}${baseRod}`;
    const titles = [p.title ? `the ${esc(p.title)}` : "", isChamp ? "👑 contest champion" : ""].filter(Boolean).join(", ");

    const key = `
      <dl class="keystats">
        <div><dt>Points</dt><dd>${num(p.points)}</dd></div>
        <div><dt>Rank</dt><dd>#${num(rank)}</dd></div>
        <div><dt>Species</dt><dd>${caught.size}<small> of ${species}</small></dd></div>
        <div class="rod"><dt>Rod</dt><dd>${art(baseRod, 34)}<span>${esc(rod)}</span></dd></div>
      </dl>
      <p class="substats">${num(p.coins)} coins, ${num(p.casts)} casts, ${num(p.streak)}-day daily streak, ${num(p.boss_kills)} ${p.boss_kills === 1 ? "boss" : "bosses"} beaten, ${num(p.contest_wins)} contest ${p.contest_wins === 1 ? "win" : "wins"}.</p>`;

    const collection = GAME.rarities
      .map((r) => {
        const tiles = GAME.fish[r]
          .map((f) => {
            const c = caught.get(f);
            return c
              ? `<li title="${esc(f)}: best ${kg(c.best_weight)}, caught ${c.caught}×">${icon(f, 64)}<span>${esc(f)}</span></li>`
              : `<li class="unknown" title="Not found yet">${icon(f, 64, { silhouette: true })}<span>?</span></li>`;
          })
          .join("");
        return `<h3 class="rar-h small" style="--c:var(${RARITY_VAR[r]})">${r}</h3><ul class="tiles">${tiles}</ul>`;
      })
      .join("");

    const earned = GAME.achievements.filter((a) => have.has(a.key));
    const locked = GAME.achievements.filter((a) => !have.has(a.key));
    const achList = (list) => list.map((a) => `<li><b>${esc(a.title)}</b><span class="sub">${esc(a.desc)}</span></li>`).join("");

    view.innerHTML = `
      <a class="back" href="#/">Back to the leaderboard</a>
      <div class="name-row">
        <h1>${esc(p.display)}</h1>
        <button type="button" class="me-btn" id="me-btn" aria-pressed="${isMe}">${isMe ? "This is you" : "This is me"}</button>
      </div>
      ${titles ? `<p class="title-line">${titles}</p>` : ""}
      ${key}
      ${itemsHTML(owned, p.name)}
      ${d.advent ? calendarHTML(d.advent, candy) : ""}
      <h2>Aquarium</h2>
      <div class="tank" id="tank" role="img" aria-label="${esc(p.display)}'s aquarium with ${caught.size} species"></div>
      <p class="tank-hint">${matchMedia("(hover: hover)").matches ? "Hover over" : "Tap"} a fish to see its stats.</p>
      ${recentCatches.length ? `<h2>Recent catches</h2>
      <ul class="rows">${recentCatches
        .slice(0, 6)
        .map(
          (c) => `<li>${icon(c.fish)}<div><b>${esc(c.fish)}</b> <span class="rar" style="color:var(${RARITY_VAR[c.rarity] || "--common"})">${c.rarity}</span>
            <span class="sub">${kg(c.weight)}, +${num(c.points)} points, ${caughtAgo(c.caught_at)}</span></div></li>`
        )
        .join("")}</ul>` : ""}
      <h2>Collection <small>${caught.size} of ${species}</small></h2>
      ${collection}
      <h2>Achievements <small>${earned.length} of ${GAME.achievements.length}</small></h2>
      ${earned.length ? `<ul class="achs">${achList(earned)}</ul>` : `<p class="empty">None yet. The first one comes with your first fish.</p>`}
      ${locked.length ? `<details class="more"><summary>${locked.length} still to unlock</summary><ul class="achs locked">${achList(locked)}</ul></details>` : ""}`;
    fillTank($("#tank"), tank.filter((t) => t.rarity !== "Junk"), tank.filter((t) => t.rarity === "Junk"), p.chests);

    const btn = $("#me-btn");
    btn.addEventListener("click", () => {
      const nowMe = getMe() === p.name;
      setMe(nowMe ? "" : p.name);
      btn.textContent = nowMe ? "This is me" : "This is you";
      btn.setAttribute("aria-pressed", String(!nowMe));
    });
    btn.title = isMe ? "Click to forget" : "Remember me in this browser, for a quick My aquarium link";
  }


  // ---------- limited items + trading post ----------
  const itemName = (kind) => (GAME.items && GAME.items[kind] ? GAME.items[kind].name : kind.replace(/_/g, " "));
  const prettyItem = (id) => id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const priceOf = (json) => {
    try {
      return JSON.parse(json).map((x) => `${num(x.amount)} ${prettyItem(x.item)}`).join(" + ");
    } catch {
      return "?";
    }
  };
  function itemsHTML(owned, owner) {
    if (!owned.length) return "";
    return `
      <h2>Limited items</h2>
      <ul class="limited">${owned
        .map((it) => {
          const info = GAME.items && GAME.items[it.kind];
          return `<li>${art(itemName(it.kind), 56)}<div><b>${esc(itemName(it.kind))} <span class="serial">#${it.serial}</span></b>
            <small>${info ? esc(info.perk) : ""}${it.earned_by && it.earned_by !== owner ? `. First owned by <a href="${profileLink(it.earned_by)}">${esc(it.earned_by)}</a>` : ""}</small></div></li>`;
        })
        .join("")}</ul>`;
  }

  async function loadPost() {
    const [listings, sales, counts] = await Promise.all([data.listings(), data.sales(), data.itemCounts()]);
    const people = [...new Set([...listings.map((l) => l.seller), ...sales.flatMap((x) => [x.seller, x.buyer])])];
    const named = Object.fromEntries((await data.names(people)).map((p) => [p.name, p.display]));
    const supply = {};
    for (const c of counts) supply[c.kind] = (supply[c.kind] || 0) + 1;
    return { listings, sales, named, supply };
  }

  function drawPost(d) {
    document.title = "Trading post: Flatfish's Pond";
    const bot = esc(CFG.BOT_NAME || "flatfish");
    const who = (n) => `<a href="${profileLink(n)}">${esc(d.named[n] || n)}</a>`;
    const supply = Object.entries(d.supply)
      .map(([k, n]) => `<b>${num(n)}</b> ${esc(itemName(k))}${n === 1 ? "" : "s"}`)
      .join(", ");
    const forSale = d.listings.length
      ? `<ol class="post">${d.listings
          .map(
            (l) => `<li${l.status === "reserved" ? ' class="reserved"' : ""}>
              <span class="lid">#${l.id}</span>
              <span class="what">${art(itemName(l.kind), 40)}<span><b>${esc(itemName(l.kind))} <span class="serial">#${l.serial}</span></b> from ${who(l.seller)}</span></span>
              <span class="price">${esc(priceOf(l.price))}<small>est. value ${esc(l.est_text)}</small></span>
              <span class="how">${l.status === "reserved" ? "Being paid for" : `<code>/pm ${bot} buy ${l.id}</code>`}</span>
            </li>`
          )
          .join("")}</ol>`
      : `<p class="empty">Nothing for sale right now. Have a limited item? <code>/pm ${bot} sell [item] for [amount item (+ amount item)]</code></p>`;
    const sold = d.sales.length
      ? `<ol class="hall">${d.sales
          .map(
            (x) => `<li>${who(x.buyer)}
              <span>bought ${esc(itemName(x.kind))} #${x.serial} from ${who(x.seller)} for ${esc(priceOf(x.price))} (est. ${esc(x.est_text)})</span>
              <time datetime="${new Date(x.at).toISOString()}">${new Date(x.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time></li>`
          )
          .join("")}</ol>`
      : `<p class="empty">No sales yet.</p>`;
    view.innerHTML = `
      <h1>Trading post</h1>
      <p class="lead">Limited flatfish items, sold for real FlatMMO items. ${bot} holds the payment until the item changes hands, so nobody can run off with it.${supply ? ` In the pond so far: ${supply}.` : ""}</p>
      <dl class="howto">
        <div><dt><code>/pm ${bot} buy [item or listing #]</code></dt><dd>An item name reserves the cheapest one, a listing number that exact one. You then have 10 minutes to trade ${bot} the price. e.g. <code>buy candy cane rod</code>, <code>buy 4</code></dd></div>
        <div><dt><code>/pm ${bot} sell [item] for [amount item (+ amount item)]</code></dt><dd>Lists yours. Needs 200 casts. e.g. <code>sell candy cane rod for 40k coins + 20 raw shark</code></dd></div>
        <div><dt><code>/pm ${bot} collect</code></dt><dd>After a sale, send ${bot} a trade request to collect your payment.</dd></div>
      </dl>
      <h2>For sale</h2>${forSale}
      <h2>Recent sales</h2>${sold}
      <p class="hint-line">Estimated values come from recent FlatMMO market prices. Items with no recent trades are shown as they are.</p>`;
  }

  // ---------- advent calendar ----------
  function calendarHTML(rows, candy) {
    const opened = new Map(rows.map((r) => [r.day, r]));
    const door = adventDoor(); // 0 once the calendar is over
    const over = !door;
    const need = GAME.advent.titleDoors;
    const n = opened.size;
    const bot = esc(CFG.BOT_NAME || "flatfish");

    let goal;
    if (candy) goal = `Candy Cane Rod earned. Merry Christmas!`;
    else if (over) goal = n ? `${n} of 24 doors opened.` : "No doors opened this year.";
    else {
      const left = 24 - door + (opened.has(door) ? 0 : 1); // doors still openable, today included
      const short = Math.max(0, need - n);
      goal =
        short > left
          ? `${n} of 24 opened. Too few doors left for the Candy Cane Rod this year, but every door still has a gift.`
          : `${n} of 24 opened. ${short ? `${short} more, including Christmas Eve,` : "Open Christmas Eve's door"} for the Festive Angler title and the Candy Cane Rod.`;
    }

    const cells = Array.from({ length: 24 }, (_, i) => {
      const day = i + 1;
      const row = opened.get(day);
      const label = GAME.advent.doors[day] || "Gift";
      if (row) {
        const gift = row.gift || label;
        return `<li class="door open${day === 24 ? " finale" : ""}" title="Door ${day}: ${esc(gift)}"><b>${day}</b><span>${esc(label)}</span></li>`;
      }
      if (!over && day === door)
        return `<li class="door today"><b>${day}</b><span>Open today</span></li>`;
      if (over || day < door)
        return `<li class="door missed" title="Door ${day} was missed"><b>${day}</b><span>Missed</span></li>`;
      return `<li class="door shut${day === 24 ? " finale" : ""}"><b>${day}</b><span>${day === 24 ? "Christmas Eve" : ""}</span></li>`;
    }).join("");

    const found = rows.length
      ? `<details class="found"><summary>What's been inside (${rows.length})</summary><ol>${rows
          .map((r) => `<li><b>Door ${r.day}</b> ${esc(r.gift)}</li>`)
          .join("")}</ol></details>`
      : "";
    const todayNote =
      !over && !opened.has(door)
        ? `<p class="advent-cta">Door ${door} is waiting: <code>/pm ${bot} advent</code></p>`
        : "";
    return `
      <section class="advent" aria-labelledby="advent-h">
        <h2 id="advent-h">Advent calendar</h2>
        <p class="advent-goal">${esc(goal)}</p>
        <ol class="doors">${cells}</ol>
        ${todayNote}${found}
      </section>`;
  }

  function fillTank(el, fish, junkRows, chests) {
    // seaweed
    for (let i = 0; i < 6; i++) {
      const w = document.createElement("span");
      w.className = "weed";
      w.style.left = `${5 + i * 14 + (i % 2) * 3}%`; // stays clear of the chest on the right
      w.style.height = `${40 + ((i * 37) % 70)}px`;
      el.appendChild(w);
    }
    if (fish.length === 0) {
      el.insertAdjacentHTML("beforeend", `<div class="tank-empty">No fish yet. Catch some with -fish and they'll swim here.</div>`);
    }

    // ---- stat card shown on hover, tap or keyboard focus ----
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    el.appendChild(tip);
    let current = null;
    let shownAt = 0;
    function show(target, html) {
      shownAt = Date.now();
      if (current && current !== target) current.classList.remove("hover");
      current = target;
      target.classList.add("hover"); // pauses the fish so the card stays put
      tip.innerHTML = html;
      tip.hidden = false;
      const box = el.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let left = r.left - box.left + r.width / 2 - tw / 2;
      left = Math.max(8, Math.min(left, box.width - tw - 8));
      let top = r.top - box.top - th - 10; // above the fish...
      if (top < 8) top = r.bottom - box.top + 10; // ...or below if there's no room
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.min(top, box.height - th - 8)}px`;
    }
    function hide(target) {
      if (target && target !== current) return;
      if (current) current.classList.remove("hover");
      current = null;
      tip.hidden = true;
    }
    function hoverable(node, label, html) {
      node.tabIndex = 0;
      node.setAttribute("aria-label", label);
      node.addEventListener("mouseenter", () => show(node, html));
      node.addEventListener("mouseleave", () => hide(node));
      node.addEventListener("focus", () => show(node, html));
      node.addEventListener("blur", () => hide(node));
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        // Tap on phones: toggle. A tap also fires a "hover" just before the click,
        // so don't treat that click as "close" if the card only just opened.
        if (current === node && Date.now() - shownAt > 400) hide(node);
        else show(node, html);
      });
    }
    el.addEventListener("click", () => hide());

    // rarest first so they're never left out; at most 30 fish
    const sorted = [...fish].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)).slice(0, 30);
    sorted.forEach((f, i) => {
      const h = hash(f.fish);
      const d = document.createElement("div");
      d.className = `fish${h % 2 ? " left" : ""}${f.rarity === "Legendary" ? " legendary" : ""}`;
      const z = window.SPRITES && SPRITES.size(f.fish);
      d.style.width = z ? `${Math.round(z.w * (SCALE[f.rarity] || 3))}px` : `${SIZE[f.rarity] || 34}px`;
      d.style.top = `${8 + ((h >> 3) % 62)}%`;
      const dur = 14 + ((h >> 5) % 18) + (f.rarity === "Legendary" ? 8 : 0);
      d.style.animationDuration = `${dur}s`;
      d.style.animationDelay = `-${(h >> 7) % dur}s`;
      d.style.setProperty("--rest", `${5 + ((i * 29) % 80)}%`);
      d.innerHTML = window.SPRITES && SPRITES.has(f.fish) ? SPRITES.svg(f.fish) : fishSVG(f.fish, f.rarity);
      hoverable(
        d,
        `${f.fish}, ${f.rarity}, caught ${f.caught} times, best ${kg(f.best_weight)}`,
        `<b class="tip-name">${esc(f.fish)}</b>
         <span class="tip-rarity" style="color:var(${RARITY_VAR[f.rarity]})">${f.rarity}</span>
         <dl><div><dt>Caught</dt><dd>×${num(f.caught)}</dd></div>
         <div><dt>Heaviest</dt><dd>${kg(f.best_weight)}</dd></div>
         <div><dt>Best catch</dt><dd>+${num(f.best_points)} pts</dd></div></dl>`
      );
      el.appendChild(d);
    });

    const junk = junkRows.reduce((n, t) => n + t.caught, 0);
    if (junk > 0) {
      const pile = document.createElement("div");
      pile.className = "junkpile";
      pile.style.left = "18px";
      const topJunk = [...junkRows].sort((a, b) => b.caught - a.caught).slice(0, 3);
      pile.innerHTML = topJunk.map((t) => art(t.fish, Math.round(SPRITES.size(t.fish).w * 2.4))).join("");
      const list = [...junkRows].sort((a, b) => b.caught - a.caught).map((t) => `${esc(t.fish)} ×${num(t.caught)}`).join("<br>");
      hoverable(pile, `Junk pile: ${junk} pieces`, `<b class="tip-name">Junk pile</b><span class="tip-rarity" style="color:var(--junk)">${num(junk)} pieces</span><p class="tip-list">${list}</p>`);
      el.appendChild(pile);
    }
    if (chests > 0) {
      const chest = document.createElement("div");
      chest.className = "chest";
      chest.innerHTML = `${art(isDecember() ? "Present" : "Chest", 48)}<span>×${num(chests)}</span>`;
      hoverable(chest, `${chests} treasure chests opened`, `<b class="tip-name">Treasure chests</b><span class="tip-rarity" style="color:var(--legendary)">${num(chests)} opened</span><p class="tip-list">Each one held coins, Worms or Glow Lures.</p>`);
      el.appendChild(chest);
    }
  }

  // ---------- search ----------
  const form = $("#search");
  const input = $("#q");
  const suggest = $("#suggest");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = cleanName(input.value);
    if (q.length < 2) return (suggest.hidden = true);
    timer = setTimeout(async () => {
      try {
        const rows = await data.search(q);
        suggest.innerHTML = rows
          .map((r) => `<li role="option"><a href="${profileLink(r.name)}">${esc(r.display)}${r.title ? ` <small>the ${esc(r.title)}</small>` : ""}</a></li>`)
          .join("");
        suggest.hidden = rows.length === 0;
      } catch {
        suggest.hidden = true;
      }
    }, 250);
  });
  suggest.addEventListener("click", () => (suggest.hidden = true));
  document.addEventListener("click", (e) => {
    if (!form.contains(e.target)) suggest.hidden = true;
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = cleanName(input.value);
    suggest.hidden = true;
    if (q) location.hash = profileLink(q);
  });

  // ---------- router (+ auto-refresh every minute) ----------
  function currentPage() {
    const h = location.hash;
    const m = h.match(/^#\/p\/(.+)$/);
    if (m) {
      const name = cleanName(decodeURIComponent(m[1])).toLowerCase();
      return { key: `p:${name}`, load: () => loadPlayer(name), draw: drawPlayer };
    }
    if (h === "#/records") return { key: "records", load: loadRecords, draw: drawRecords };
    if (h === "#/post") return { key: "post", load: loadPost, draw: drawPost };
    return { key: "home", load: loadHome, draw: drawHome };
  }
  // Only things that change what's drawn (not "bot last checked in at...")
  const signature = (d) => JSON.stringify(d);
  let shown = { key: null, sig: null };

  async function route({ refresh = false } = {}) {
    const page = currentPage();
    // Highlight the current page in the header
    document.querySelectorAll(".nav a").forEach((a) => a.removeAttribute("aria-current"));
    const here = page.key === "records" ? '.nav a[href="#/records"]' : page.key === "post" ? '.nav a[href="#/post"]' : page.key === "home" ? '.nav a[href="#/"]:not(#me-link)' : page.key === `p:${getMe()}` ? "#me-link" : null;
    if (here && $(here)) $(here).setAttribute("aria-current", "page");
    if (!refresh) view.innerHTML = `<p class="loading">Casting a line…</p>`;
    try {
      const d = await page.load();
      if (page.key !== currentPage().key) return; // they navigated away meanwhile
      const sig = signature(d);
      if (refresh && shown.key === page.key && shown.sig === sig) return; // nothing new
      const y = window.scrollY;
      page.draw(d);
      shown = { key: page.key, sig };
      window.scrollTo(0, refresh ? y : 0);
    } catch (e) {
      if (refresh) return; // keep showing the last good page
      view.innerHTML = `<div class="error"><p><strong>Couldn't reach the pond's database.</strong> ${esc(e.message)}</p>
        <p>Try again in a minute. If it keeps happening, the Supabase project may be paused: the bot's owner can resume it from the Supabase dashboard.</p></div>`;
    }
  }
  window.addEventListener("hashchange", () => route());
  route();
  renderLive();
  setInterval(() => {
    if (document.hidden) return;
    renderLive();
    // Don't redraw while someone is reading a fish card or typing a search
    const busy = document.querySelector(".tip:not([hidden])") || document.activeElement === $("#q");
    if (!busy) route({ refresh: true });
  }, 60 * 1000);

  // ---------- demo data (used when Supabase isn't set up) ----------
  function makeDemo() {
    const names = ["dsdsksjkajk", "winton", "pietateip", "bobek", "zubaduthan", "jimbob", "snygget", "kfymnik"];
    const titles = [null, "Kraken Slayer", null, "Old Salt", "Rookie", null, "Champion", "Sharp Eye"];
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const players = names.map((n, i) => {
      const casts = Math.round(400 / (i + 1) + rnd() * 40);
      return { name: n, display: n, title: titles[i], points: Math.round(casts * (22 + rnd() * 10)), coins: Math.round(casts * 12), rod: Math.max(0, 4 - i), casts, streak: (i * 3) % 9, chests: Math.round(casts / 50), boss_kills: Math.max(0, 3 - i), contest_wins: [4, 2, 0, 1, 0, 0, 1, 0][i] };
    }).sort((a, b) => b.points - a.points);
    const tanks = {};
    for (const p of players) {
      tanks[p.name] = [];
      for (const r of GAME.rarities) {
        for (const f of GAME.fish[r]) {
          const chance = { Junk: 0.7, Common: 0.95, Uncommon: 0.85, Rare: 0.6, Epic: 0.35, Legendary: 0.15 }[r] * Math.min(1, p.casts / 200);
          if (rnd() < chance) tanks[p.name].push({ player: p.name, fish: f, rarity: r, caught: 1 + Math.round(rnd() * 12), best_weight: 0.3 + rnd() * (r === "Legendary" ? 600 : r === "Epic" ? 300 : 20), best_points: 10 });
        }
      }
    }
    const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));
    return {
      top: () => delay(players.map(({ name, display, title, points, contest_wins }) => ({ name, display, title, points, contest_wins }))),
      history: () => delay([
        { winner: "winton", display: "winton", fish: "Giant Squid", weight: 312.4, points: 214, entrants: 6, ended_at: Date.now() - 3 * 3600000 },
        { winner: "dsdsksjkajk", display: "dsdsksjkajk", fish: "Swordfish", weight: 98.1, points: 92, entrants: 4, ended_at: Date.now() - 27 * 3600000 },
        { winner: "snygget", display: "snygget", fish: "Golden Carp", weight: 7.7, points: 88, entrants: 2, ended_at: Date.now() - 52 * 3600000 },
      ]),
      recent: () => delay([
        { player: "winton", fish: "Baby Kraken", rarity: "Legendary", weight: 412.5, caught_at: Date.now() - 25 * 60000 },
        { player: "dsdsksjkajk", fish: "Great White Shark", rarity: "Epic", weight: 880, caught_at: Date.now() - 3 * 3600000 },
        { player: "bobek", fish: "Manta Ray", rarity: "Epic", weight: 1012, caught_at: Date.now() - 9 * 3600000 },
        { player: "pietateip", fish: "Moonlight Koi", rarity: "Legendary", weight: 12.3, caught_at: Date.now() - 2 * 86400000 },
      ]),
      player: (n) => delay(players.find((p) => p.name === n) || null),
      rank: (pts) => delay(players.filter((p) => p.points > pts).length + 1),
      aquarium: (n) => delay(tanks[n] || []),
      aquariumAll: () => delay(Object.values(tanks).flat()),
      board: (col) => delay([...players].filter((p) => p[col] > 0).sort((a, b) => b[col] - a[col])),
      names: (list) => players.filter((p) => list.includes(p.name)).map(({ name, display, title }) => ({ name, display, title })),
      catches: (n) =>
        delay(
          (tanks[n] || []).slice(0, 8).map((t, i) => ({ fish: t.fish, rarity: t.rarity, weight: t.best_weight, points: 10 + i * 7, caught_at: Date.now() - (i * i * 17 + 3) * 60000 }))
        ),
      achievements: (n) => delay(GAME.achievements.filter((a, i) => (hash(n + a.key) % 3) === 0 || i === 0).map((a) => ({ key: a.key }))),
      search: (q) => delay(players.filter((p) => p.name.includes(q.toLowerCase())).slice(0, 8)),
      items: (n) => delay(n === "winton" ? [{ kind: "candy_cane_rod", serial: 3, earned_by: "bobek" }] : n === "dsdsksjkajk" ? [{ kind: "candy_cane_rod", serial: 1, earned_by: "dsdsksjkajk" }] : []),
      itemCounts: () => delay(Array.from({ length: 23 }, () => ({ kind: "candy_cane_rod" }))),
      listings: () => delay([
        { id: 4, kind: "candy_cane_rod", serial: 12, seller: "zubaduthan", price: '[{"item":"coins","amount":42000}]', est_text: "42,000", status: "open" },
        { id: 3, kind: "candy_cane_rod", serial: 7, seller: "snygget", price: '[{"item":"coins","amount":40000},{"item":"raw_shark","amount":20}]', est_text: "40,000 + 20 Raw Shark", status: "reserved" },
        { id: 6, kind: "candy_cane_rod", serial: 2, seller: "pietateip", price: '[{"item":"coins","amount":150000}]', est_text: "150,000", status: "open" },
      ]),
      sales: () => delay([
        { at: Date.now() - 5 * 3600000, kind: "candy_cane_rod", serial: 3, seller: "bobek", buyer: "winton", price: '[{"item":"coins","amount":38000}]', est_text: "38,000" },
        { at: Date.now() - 30 * 3600000, kind: "candy_cane_rod", serial: 9, seller: "jimbob", buyer: "kfymnik", price: '[{"item":"gold_bar","amount":25}]', est_text: "37,500" },
      ]),
      advent: (n) => {
        const upTo = adventDoor() || 24;
        const rows = [];
        for (let day = 1; day <= upTo; day++)
          if (hash(n + day) % 4 !== 0 && day < upTo) rows.push({ day, gift: GAME.advent.doors[day], opened_at: Date.now() });
        return delay(rows);
      },
      stats: () => delay({ anglers: players.length, fish: players.reduce((n, p) => n + p.casts, 0), legendary: 23 }),
      live: () => delay({ online: true, at: Date.now(),
        champion: { name: "winton", display: "winton", fish: "Giant Squid", points: 214, trophies: 2 }, event: { type: "boss", name: "The Leviathan", hp: 3420, maxHp: 7500, endsAt: Date.now() + 17 * 60000, top: [{ name: "winton", dmg: 1840 }, { name: "dsdsksjkajk", dmg: 1310 }, { name: "bobek", dmg: 930 }] } }),
    };
  }
})();
