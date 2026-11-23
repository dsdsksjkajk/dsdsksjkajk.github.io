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
    top: () => (DEMO ? demo.top() : api("players?select=name,display,title,points&points=gt.0&order=points.desc&limit=20")),
    recent: () =>
      DEMO ? demo.recent() : api("catches?select=player,fish,rarity,weight,caught_at&rarity=in.(Epic,Legendary)&order=id.desc&limit=8"),
    player: async (name) =>
      DEMO ? demo.player(name) : (await api(`players?name=eq.${encodeURIComponent(name)}&select=*`))[0] || null,
    rank: (points) => (DEMO ? demo.rank(points) : api(`players?select=name&points=gt.${Number(points) || 0}`, { count: true }).then((n) => n + 1)),
    aquarium: (name) => (DEMO ? demo.aquarium(name) : api(`aquarium?player=eq.${encodeURIComponent(name)}&select=*`)),
    achievements: (name) => (DEMO ? demo.achievements(name) : api(`achievements?player=eq.${encodeURIComponent(name)}&select=key`)),
    search: (q) =>
      DEMO ? demo.search(q) : api(`players?select=name,display,title&display=ilike.*${encodeURIComponent(q)}*&order=points.desc&limit=8`),
    live: async () => (DEMO ? demo.live() : ((await api("live?id=eq.1&select=data"))[0] || {}).data || null),
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
      el.innerHTML = `${status}<p>No event right now.${next}</p>`;
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
    const [top, recent] = await Promise.all([data.top(), data.recent()]);
    const board = top.length
      ? `<ol class="board">${top
          .map(
            (p, i) => `<li><span class="pos">${i + 1}</span>
              <span><a href="${profileLink(p.name)}">${esc(p.display)}</a>${p.title ? `<span class="t">the ${esc(p.title)}</span>` : ""}</span>
              <span class="pts">${num(p.points)}</span></li>`
          )
          .join("")}</ol>`
      : `<p class="empty">Nobody has fished yet. Type -fish in FlatMMO to be the first.</p>`;
    const big = recent.length
      ? `<ul class="achs">${recent
          .map(
            (c) => `<li style="border-left-color:${color(c.rarity)}"><b>${esc(c.fish)}</b>
              <small>${kg(c.weight)} ${c.rarity} caught by <a href="${profileLink(c.player)}">${esc(c.player)}</a></small></li>`
          )
          .join("")}</ul>`
      : `<p class="empty">No Epic or Legendary catches yet.</p>`;
    view.innerHTML = `<h2>Top anglers</h2>${board}<h2>Latest big catches</h2>${big}`;
  }

  async function renderPlayer(name) {
    view.innerHTML = `<p class="loading">Looking for ${esc(name)}…</p>`;
    const p = await data.player(name);
    if (!p) {
      view.innerHTML = `<h1>${esc(name)}</h1><p class="empty">This angler hasn't fished yet. Names must match exactly as they appear in FlatMMO.</p><a class="back" href="#/">Back to the leaderboard</a>`;
      return;
    }
    document.title = `${p.display}'s aquarium: Flatfish's Pond`;
    const [rank, tank, achRows] = await Promise.all([data.rank(p.points), data.aquarium(p.name), data.achievements(p.name)]);
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
      ${p.title ? `<p class="title-line">the ${esc(p.title)}</p>` : `<p class="title-line"></p>`}
      <dl class="stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      <h2>Aquarium</h2>
      <div class="tank" id="tank" role="img" aria-label="${esc(p.display)}'s aquarium with ${caught.size} species"></div>
      <p class="legend">${RARITY_ORDER.map((r) => `<span style="--c:var(${RARITY_VAR[r]})">${r}</span>`).join("")}</p>
      <h2>Species found</h2>
      <div class="species">${list}</div>
      <h2>Achievements <small style="font-size:1rem;color:var(--mist)">${have.size}/${GAME.achievements.length}</small></h2>
      <ul class="achs">${achs}</ul>`;
    fillTank($("#tank"), tank.filter((t) => t.rarity !== "Junk"), junk, p.chests);
  }

  function fillTank(el, fish, junk, chests) {
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
      d.title = `${f.fish} (${f.rarity}), best ${kg(f.best_weight)}`;
      d.innerHTML = fishSVG(f.fish, f.rarity);
      el.appendChild(d);
    });
    if (junk > 0) {
      const pile = document.createElement("div");
      pile.className = "junkpile";
      pile.style.left = "18px";
      pile.title = `${junk} pieces of junk`;
      pile.innerHTML = "<span></span>".repeat(Math.min(6, Math.ceil(junk / 5)));
      el.appendChild(pile);
    }
    if (chests > 0) {
      el.insertAdjacentHTML("beforeend", `<div class="chest" title="Treasure chests opened">×${num(chests)}<i></i></div>`);
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
      return { name: n, display: n, title: titles[i], points: Math.round(casts * (22 + rnd() * 10)), coins: Math.round(casts * 12), rod: Math.max(0, 4 - i), casts, streak: (i * 3) % 9, chests: Math.round(casts / 50), boss_kills: Math.max(0, 3 - i) };
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
      top: () => delay(players.map(({ name, display, title, points }) => ({ name, display, title, points }))),
      recent: () => delay([
        { player: "winton", fish: "Baby Kraken", rarity: "Legendary", weight: 412.5 },
        { player: "dsdsksjkajk", fish: "Great White Shark", rarity: "Epic", weight: 880 },
        { player: "bobek", fish: "Manta Ray", rarity: "Epic", weight: 1012 },
        { player: "pietateip", fish: "Moonlight Koi", rarity: "Legendary", weight: 12.3 },
      ]),
      player: (n) => delay(players.find((p) => p.name === n) || null),
      rank: (pts) => delay(players.filter((p) => p.points > pts).length + 1),
      aquarium: (n) => delay(tanks[n] || []),
      achievements: (n) => delay(GAME.achievements.filter((a, i) => (hash(n + a.key) % 3) === 0 || i === 0).map((a) => ({ key: a.key }))),
      search: (q) => delay(players.filter((p) => p.name.includes(q.toLowerCase())).slice(0, 8)),
      live: () => delay({ online: true, at: Date.now(), event: { type: "boss", name: "The Leviathan", hp: 3420, maxHp: 7500, endsAt: Date.now() + 17 * 60000, top: [{ name: "winton", dmg: 1840 }, { name: "dsdsksjkajk", dmg: 1310 }, { name: "bobek", dmg: 930 }] } }),
    };
  }
})();
