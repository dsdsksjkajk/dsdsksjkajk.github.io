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
    search: (q) =>
      DEMO ? demo.search(q) : api(`players?select=name,display,title&display=ilike.*${encodeURIComponent(q)}*&order=points.desc&limit=8`),
    live: async () => (DEMO ? demo.live() : ((await api("live?id=eq.1&select=data"))[0] || {}).data || null),
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
    if (/eel|herring|sardine|minnow/i.test(name)) return "long";
    if (/puffer|jelly|kraken|koi|squid/i.test(name)) return "round";
    if (/ray|flat|whale|shark/i.test(name)) return "flat";
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
  async function renderHome() {
    document.title = "Flatfish's Pond: FlatMMO fishing";
    view.innerHTML = `<p class="loading">Casting a line…</p>`;
    const [top, recent, history, live, stats] = await Promise.all([
      data.top(),
      data.recent(),
      data.history(),
      data.live().catch(() => null),
      data.stats().catch(() => null),
    ]);
    const champ = live && live.champion;
    const board = top.length
      ? `<ol class="board">${top
          .map(
            (p, i) => `<li><span class="pos">${i + 1}</span>
              <span>${champ && champ.name === p.name ? `<span class="crown" title="Reigning contest champion">👑</span>` : ""}<a href="${profileLink(p.name)}">${esc(p.display)}</a>${p.title ? `<span class="t">the ${esc(p.title)}</span>` : ""}${p.contest_wins ? `<span class="trophy" title="Contest trophies">🏆${num(p.contest_wins)}</span>` : ""}</span>
              <span class="pts">${num(p.points)}</span></li>`
          )
          .join("")}</ol>`
      : `<p class="empty">Nobody has fished yet. Type -fish in FlatMMO to be the first.</p>`;
    const big = recent.length
      ? `<ul class="achs">${recent
          .map(
            (c) => `<li style="border-left-color:${color(c.rarity)}"><b>${esc(c.fish)}</b>
              <small>${kg(c.weight)} ${c.rarity} caught by <a href="${profileLink(c.player)}">${esc(c.player)}</a>${c.caught_at ? `, ${caughtAgo(c.caught_at)}` : ""}</small></li>`
          )
          .join("")}</ul>`
      : `<p class="empty">No Epic or Legendary catches yet.</p>`;
    const hall = history.length
      ? `<h2>Hall of Champions</h2>
        ${champ ? `<p class="reigning">👑 <a href="${profileLink(champ.name)}">${esc(champ.display)}</a> holds the crown, won with a ${num(champ.points)}pt ${esc(champ.fish)}.</p>` : ""}
        <ol class="hall">${history
          .map(
            (h) => `<li><a href="${profileLink(h.winner)}">${esc(h.display)}</a>
              <span>${esc(h.fish)}, ${kg(h.weight)} (${num(h.points)}pts) against ${h.entrants - 1} ${h.entrants === 2 ? "rival" : "rivals"}</span>
              <time datetime="${new Date(h.ended_at).toISOString()}">${new Date(h.ended_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time></li>`
          )
          .join("")}</ol>`
      : "";
    const bot = esc(CFG.BOT_NAME || "flatfish");
    const pondStats = stats
      ? `<p class="pond-stats"><b>${num(stats.fish)}</b> fish caught by <b>${num(stats.anglers)}</b> ${stats.anglers === 1 ? "angler" : "anglers"}, <b>${num(stats.legendary)}</b> of them Legendary.</p>`
      : "";
    const newHere = `
      <section class="new-here" aria-labelledby="new-here">
        <h2 id="new-here">New here?</h2>
        <p>Everything happens in FlatMMO chat. Send ${bot} a private message, or type next to it:</p>
        <dl class="howto">
          <div><dt><code>/pm ${bot} -fish</code></dt><dd>Cast a line, once a minute. Every catch swims into your aquarium here.</dd></div>
          <div><dt><code>/pm ${bot} -daily</code></dt><dd>Free points and coins every day. Keep a streak going for a bigger bonus.</dd></div>
          <div><dt><code>/pm ${bot} -shop</code></dt><dd>Better rods and bait mean fewer old boots and more rare fish.</dd></div>
          <div><dt><code>/pm ${bot} -help</code></dt><dd>Every command, plus boss fights, contests and titles.</dd></div>
        </dl>
      </section>`;
    view.innerHTML = `${pondStats}${newHere}<h2>Top anglers</h2>${board}${hall}<h2>Latest big catches</h2>${big}`;
  }

  async function renderPlayer(name) {
    view.innerHTML = `<p class="loading">Looking for ${esc(name)}…</p>`;
    const p = await data.player(name);
    if (!p) {
      view.innerHTML = `<h1>${esc(name)}</h1><p class="empty">This angler hasn't fished yet. Names must match exactly as they appear in FlatMMO.</p><a class="back" href="#/">Back to the leaderboard</a>`;
      return;
    }
    document.title = `${p.display}'s aquarium: Flatfish's Pond`;
    const [rank, tank, achRows, live, recentCatches] = await Promise.all([
      data.rank(p.points),
      data.aquarium(p.name),
      data.achievements(p.name),
      data.live().catch(() => null),
      data.catches(p.name).catch(() => []),
    ]);
    const isChamp = live && live.champion && live.champion.name === p.name;
    const caught = new Map(tank.map((t) => [t.fish, t]));
    const junk = tank.filter((t) => t.rarity === "Junk").reduce((n, t) => n + t.caught, 0);
    const species = Object.values(GAME.fish).flat().length;
    const have = new Set(achRows.map((a) => a.key));

    const stats = [
      ["Points", num(p.points)],
      ["Rank", `#${num(rank)}`],
      ["Coins", num(p.coins)],
      ["Rod", GAME.rods[p.rod] || "Twig Rod"],
      ["Casts", num(p.casts)],
      ["Species", `${caught.size}/${species}`],
      ["Bosses beaten", num(p.boss_kills)],
      ["Contest trophies", num(p.contest_wins)],
      ["Daily streak", num(p.streak)],
    ];

    const list = GAME.rarities
      .map((r) => {
        const rows = GAME.fish[r]
          .map((f) => {
            const c = caught.get(f);
            return c
              ? `<div class="sp"><span class="n">${esc(f)}</span><span class="w">${kg(c.best_weight)} (×${c.caught})</span></div>`
              : `<div class="sp missing"><span class="n">???</span><span class="w">not found yet</span></div>`;
          })
          .join("");
        return `<h3 style="--c:var(${RARITY_VAR[r]})">${r}</h3>${rows}`;
      })
      .join("");

    const achs = GAME.achievements
      .map((a) =>
        have.has(a.key)
          ? `<li><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></li>`
          : `<li class="locked"><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></li>`
      )
      .join("");

    view.innerHTML = `
      <a class="back" href="#/">Back to the leaderboard</a>
      <h1>${esc(p.display)}</h1>
      <p class="title-line">${p.title ? `the ${esc(p.title)}` : ""}${isChamp ? `${p.title ? ", " : ""}👑 Reigning contest champion` : ""}</p>
      <dl class="stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      <h2>Aquarium</h2>
      <div class="tank" id="tank" role="img" aria-label="${esc(p.display)}'s aquarium with ${caught.size} species"></div>
      <p class="legend">${RARITY_ORDER.map((r) => `<span style="--c:var(${RARITY_VAR[r]})">${r}</span>`).join("")}<em class="tank-hint">${matchMedia("(hover: hover)").matches ? "Hover" : "Tap"} a fish to see its stats</em></p>
      ${recentCatches.length ? `<h2>Recent catches</h2>
      <ol class="recent">${recentCatches
        .map(
          (c) => `<li style="--c:var(${RARITY_VAR[c.rarity] || "--common"})"><span class="rf">${esc(c.fish)}</span>
            <span class="rw">${kg(c.weight)}, ${c.rarity}</span><span class="rp">+${num(c.points)}</span>
            <time datetime="${new Date(c.caught_at).toISOString()}">${caughtAgo(c.caught_at)}</time></li>`
        )
        .join("")}</ol>` : ""}
      <h2>Species found</h2>
      <div class="species">${list}</div>
      <h2>Achievements <small style="font-size:1rem;color:var(--mist)">${have.size}/${GAME.achievements.length}</small></h2>
      <ul class="achs">${achs}</ul>`;
    fillTank($("#tank"), tank.filter((t) => t.rarity !== "Junk"), tank.filter((t) => t.rarity === "Junk"), p.chests);
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
      d.style.width = `${SIZE[f.rarity] || 34}px`;
      d.style.top = `${8 + ((h >> 3) % 62)}%`;
      const dur = 14 + ((h >> 5) % 18) + (f.rarity === "Legendary" ? 8 : 0);
      d.style.animationDuration = `${dur}s`;
      d.style.animationDelay = `-${(h >> 7) % dur}s`;
      d.style.setProperty("--rest", `${5 + ((i * 29) % 80)}%`);
      d.innerHTML = fishSVG(f.fish, f.rarity);
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
      pile.innerHTML = "<span></span>".repeat(Math.min(6, Math.ceil(junk / 5)));
      const list = [...junkRows].sort((a, b) => b.caught - a.caught).map((t) => `${esc(t.fish)} ×${num(t.caught)}`).join("<br>");
      hoverable(pile, `Junk pile: ${junk} pieces`, `<b class="tip-name">Junk pile</b><span class="tip-rarity" style="color:var(--junk)">${num(junk)} pieces</span><p class="tip-list">${list}</p>`);
      el.appendChild(pile);
    }
    if (chests > 0) {
      const chest = document.createElement("div");
      chest.className = "chest";
      chest.innerHTML = `×${num(chests)}<i></i>`;
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

  // ---------- router ----------
  async function route() {
    const m = location.hash.match(/^#\/p\/(.+)$/);
    try {
      if (m) await renderPlayer(cleanName(decodeURIComponent(m[1])).toLowerCase());
      else await renderHome();
    } catch (e) {
      view.innerHTML = `<div class="error"><p><strong>Couldn't reach the pond's database.</strong> ${esc(e.message)}</p>
        <p>Try again in a minute. If it keeps happening, the Supabase project may be paused: the bot's owner can resume it from the Supabase dashboard.</p></div>`;
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
  renderLive();
  setInterval(renderLive, 60 * 1000);

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
      catches: (n) =>
        delay(
          (tanks[n] || []).slice(0, 8).map((t, i) => ({ fish: t.fish, rarity: t.rarity, weight: t.best_weight, points: 10 + i * 7, caught_at: Date.now() - (i * i * 17 + 3) * 60000 }))
        ),
      achievements: (n) => delay(GAME.achievements.filter((a, i) => (hash(n + a.key) % 3) === 0 || i === 0).map((a) => ({ key: a.key }))),
      search: (q) => delay(players.filter((p) => p.name.includes(q.toLowerCase())).slice(0, 8)),
      stats: () => delay({ anglers: players.length, fish: players.reduce((n, p) => n + p.casts, 0), legendary: 23 }),
      live: () => delay({ online: true, at: Date.now(),
        champion: { name: "winton", display: "winton", fish: "Giant Squid", points: 214, trophies: 2 }, event: { type: "boss", name: "The Leviathan", hp: 3420, maxHp: 7500, endsAt: Date.now() + 17 * 60000, top: [{ name: "winton", dmg: 1840 }, { name: "dsdsksjkajk", dmg: 1310 }, { name: "bobek", dmg: 930 }] } }),
    };
  }
})();
