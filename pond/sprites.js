// Pixel art for the pond: every fish, junk item, rod, bait and box.
// Each sprite is a grid of letters; a dark outline is added around it automatically.
//   .  empty         b  body        l  belly        f  fins/tail
//   a  accent        e  eye         w  white        k  dark detail
//   g  glow          x  extra
// Fish face right. Patterns (stripes, spots...) paint the accent colour over the body.
(function () {
  // ---------- body shapes ----------
  const T = {
    classic: [
      "......ff......",
      "f...bbbbbb....",
      "ff.bbbbbbbbb..",
      "ffbbbbbbbbbebb",
      "ffbbbbbbbbbbbb",
      "ff.llllllllll.",
      "f...llllllll..",
      "......ff......",
    ],
    slim: [
      "...bbbbbb...",
      "fbbbbbbbbeb.",
      "ffllllllllll",
      "f..llllll...",
    ],
    tall: [
      ".....ff.....",
      "....bbbbb...",
      "f..bbbbbbb..",
      "ffbbbbbbbebb",
      "ffbbbbbbbbbb",
      "f.llllllllll",
      "...llllllll.",
      "....lllll...",
      ".....ff.....",
    ],
    long: [
      "f.bbbbbbbbbbbbbb..",
      "ffbbbbbbbbbbbbbebb",
      "f.llllllllllllll..",
    ],
    pike: [
      ".........ff......",
      "f...bbbbbbbbbb...",
      "ffbbbbbbbbbbbbebb",
      "ffbbbbbbbbbbbbbbb",
      "f...lllllllllll..",
      ".......ff........",
    ],
    torpedo: [
      "f.......fff.......",
      "ff...bbbbbbbbb....",
      ".ffbbbbbbbbbbbbe..",
      "..fbbbbbbbbbbbbbbb",
      ".fflllllllllllll..",
      "ff...lllllllll....",
      "f.......ff........",
    ],
    shark: [
      "f.........ff........",
      "ff.......fff........",
      ".ff...bbbbbbbbbb....",
      "..fbbbbbbbbbbbbbbe..",
      "..fbbbbbbbbbbbbbbbbb",
      ".fflllllllllllllkkk.",
      "ff.....llllllll.....",
      "f.......ff.....ff...",
    ],
    flat: [
      "....bbbbbbbb....",
      "f.bbbbbbbbbbebe.",
      "ffbbbbbbbbbbbbbb",
      "f.bbbbbbbbbbbbb.",
      "....bbbbbbbb....",
    ],
    ray: [
      "......bb........",
      ".....bbbb.......",
      "....bbbbbbb.....",
      "..bbbbbbbbbbe...",
      "fffbbbbbbbbbbbb.",
      "..bbbbbbbbbbe...",
      "....bbbbbbb.....",
      ".....bbbb.......",
      "......bb........",
    ],
    round: [
      "....bbbbb...",
      "..bbbbbbbbb.",
      "f.bbbbbbbebb",
      "ffbbbbbbbbbb",
      "f.llllllllll",
      "..lllllllll.",
      "....lllll...",
    ],
    disc: [
      "...ffff....",
      "..bbbbbbb..",
      ".bbbbbbbbb.",
      "fbbbbbbbebb",
      "fbbbbbbbbbb",
      "fllllllllll",
      ".lllllllll.",
      "..lllllll..",
      "...ffff....",
    ],
  };

  // ---------- special shapes (drawn whole) ----------
  const SPECIAL = {
    "Pufferfish": {
      rows: [
        "....a.a.a....",
        "...bbbbbbb...",
        "a.bbbbbbbbb.a",
        ".bbbbbbbbwebb",
        "fbbbbbbbbbbbb",
        "fflllllllllll",
        ".llllllllllla",
        "a.lllllllll..",
        "...a.a.a.....",
      ],
      pal: { b: "#d9b44a", l: "#f3e2a2", f: "#b8902e", a: "#8a6a1e" },
    },
    "Lionfish": {
      rows: [
        "..a.a.a.a.....",
        "..aaaaaaa.....",
        "f...bbbbbb....",
        "ff.babababb...",
        "ffbabababbbebb",
        "ffbabababbbbbb",
        "ff.lalalallll.",
        "f..aaaaaaaa...",
        "..a.a.a.a.....",
      ],
      pal: { b: "#f0e6da", l: "#f8f1ea", f: "#c94f3d", a: "#c94f3d" },
    },
    "Catfish": {
      rows: [
        "......ff........",
        "f...bbbbbbb.....",
        "ff.bbbbbbbbbb...",
        "ffbbbbbbbbbbebb.",
        "ffbbbbbbbbbbbbbb",
        "ff.lllllllllllkk",
        "f...lllllllll.k.",
        "......ff.....k..",
      ],
      pal: { b: "#6b6a55", l: "#a9a68a", f: "#4d4c3c", k: "#2a2a20" },
    },
    "Swordfish": {
      rows: [
        "f.......fff..........",
        "ff...bbbbbbbbb.......",
        ".ffbbbbbbbbbbbbe.....",
        "..fbbbbbbbbbbbbbbkkkk",
        ".fflllllllllllll.....",
        "ff...lllllllll.......",
        "f.......ff...........",
      ],
      pal: { b: "#3b5f86", l: "#b9cbe0", f: "#2b4563", k: "#8ea3b8" },
    },
    "Hammerhead Shark": {
      rows: [
        "f.........ff.........",
        "ff.......fff.......b.",
        ".ff...bbbbbbbbbb...e.",
        "..fbbbbbbbbbbbbbbbbbb",
        "..fbbbbbbbbbbbbbbbbbb",
        ".fflllllllllllllll.e.",
        "ff.....llllllll....b.",
        "f.......ff.....ff....",
      ],
      pal: { b: "#7b8a94", l: "#d7dde0", f: "#5d6a72" },
    },
    "Giant Squid": {
      rows: [
        ".k.k.k...bbbbbbb...",
        "k.k.k.kbbbbbbbbbbb.",
        "kkkkkkkbbbbbbbbbbbb",
        "kkkkkkkbbbwebbbbbbb",
        "kkkkkkkbbbbbbbbbbb.",
        "k.k.k.kllllllllll..",
        ".k.k.k...llllll....",
      ],
      pal: { b: "#c0504d", l: "#e48a7c", k: "#9e3b3b" },
    },
    "Crystal Jellyfish": {
      rows: [
        "...bbbbbb...",
        ".bbbbbbbbbb.",
        "bbgbbbbbbgbb",
        "bbbbbbbbbbbb",
        "llllllllllll",
        ".a..a..a..a.",
        ".a.a..a.a..a",
        "..a.a..a..a.",
        ".a..a.a..a..",
        "..a..a..a...",
      ],
      pal: { b: "#9fd8ea", l: "#c9ecf5", a: "#7fc3d9", g: "#ffffff" },
      glow: true,
    },
    "Baby Kraken": {
      rows: [
        "....bbbbbb....",
        "..bbbbbbbbbb..",
        ".bbbbbbbbbbbb.",
        ".bbwebbbbwebb.",
        ".bbbbbbbbbbbb.",
        "..bbbbbbbbbb..",
        ".b.bb.bb.bb.b.",
        "b..b..bb..b..b",
        "b.b..b..b..b.b",
        ".b..b....b..b.",
      ],
      pal: { b: "#7d4fb0", l: "#a77fd6" },
    },
    "The Pixel Whale": {
      rows: [
        "....................w.",
        "...............w...w..",
        "ff..........bbbbbbb...",
        ".ff....bbbbbbbbbbbbbb.",
        "..fbbbbbbbbbbbbbbbbbbb",
        "..fbbbbbbbbbbbbbbbebbb",
        ".fflllllllllllllllllll",
        "ff....lllllllllllllll.",
        ".........lll.lll......",
      ],
      pal: { b: "#3f5f9e", l: "#a9bfe6", f: "#2c4579", w: "#cfe8ff" },
    },
    "Abyssal Anglerfish": {
      rows: [
        "........ggg...",
        "........gkk...",
        "...........k..",
        "....bbbbbbbk..",
        "..bbbbbbbbbbb.",
        "f.bbbbbbbbbebb",
        "ffbbbbbbbbbbbb",
        "ffbbbbbbbwkwkw",
        "f.bbbbbbbbbbbb",
        "..bbbbbbbbbbb.",
        "....bbbbbbb...",
      ],
      pal: { b: "#3a3550", f: "#2a263b", k: "#5a5270", w: "#e8e6d8", g: "#fff4a3" },
      glow: true,
    },
    "Ancient Coelacanth": {
      rows: [
        ".....f..ff.......",
        "f...bbbbbbbbb....",
        "ff.bababbabbbb...",
        "fffbbbbabbbbbbeb.",
        "ffbbabbbbbabbbbbb",
        "ff.llllllllllll..",
        "f...f.llllll.f...",
        ".....f......f....",
      ],
      pal: { b: "#355a73", l: "#5b809a", f: "#284558", a: "#b7cad6" },
    },
  };

  // ---------- species: shape, colours, pattern ----------
  // pal: body, belly, fin, accent
  const FISH = {
    // Common
    Minnow:        { t: "slim",    c: ["#8a9a7b", "#d6dcc6", "#6f7d61"] },
    Sardine:       { t: "slim",    c: ["#5b7f9c", "#dfe7ee", "#47657d"], p: "line", a: "#2f4b62" },
    Perch:         { t: "classic", c: ["#9bae4a", "#e9e1b0", "#e07b3c", "#3f4f22"], p: "bands" },
    Carp:          { t: "classic", c: ["#b98a3e", "#e6cf9a", "#93692a", "#8a6220"], p: "scales" },
    Trout:         { t: "classic", c: ["#7d8f6a", "#e5dbc7", "#5f6f50", "#2e3527"], p: "spots" },
    Herring:       { t: "slim",    c: ["#6f8fa8", "#e6edf2", "#55728a"] },
    Bluegill:      { t: "tall",    c: ["#4f7c8a", "#e0b25a", "#3b5f6a", "#2d4a54"], p: "bands" },
    Roach:         { t: "classic", c: ["#a6b2b8", "#eef0f0", "#d0473b"] },
    Mackerel:      { t: "slim",    c: ["#3f8a7a", "#e8eeec", "#2e6a5d", "#1c3e37"], p: "waves" },
    Anchovy:       { t: "slim",    c: ["#7f9aa6", "#e4ebee", "#647d88", "#c6d4da"], p: "line" },
    // Uncommon
    Salmon:        { t: "classic", c: ["#7f93a0", "#f2a88a", "#5f707c", "#2b3640"], p: "spots" },
    Pike:          { t: "pike",    c: ["#5e7a3e", "#dfe0b0", "#4a6030", "#c9d48a"], p: "spots" },
    "Sea Bass":    { t: "classic", c: ["#6d7f8f", "#dde3e8", "#55636f", "#3b4650"], p: "line" },
    "Rainbow Trout": { t: "classic", c: ["#7e9a73", "#efe3d3", "#5f7756", "#e0718a"], p: "rainbow" },
    "Red Snapper": { t: "classic", c: ["#d2523f", "#f2b6a8", "#a83a2c"] },
    Flounder:      { t: "flat",    c: ["#9c8461", "#9c8461", "#7d6a4d", "#5f4f38"], p: "spots" },
    Zander:        { t: "pike",    c: ["#8b9a86", "#e8ecdf", "#6c7a68", "#4b5547"], p: "bands" },
    // Rare
    "Electric Eel": { t: "long",   c: ["#4b5a3a", "#d8c46a", "#39452c", "#fff27a"], p: "zap", glow: true },
    "Golden Carp": { t: "classic", c: ["#e7b331", "#f7e08a", "#c48f18", "#b07e10"], p: "scales", glow: true },
    "Bluefin Tuna": { t: "torpedo", c: ["#253f6e", "#c9d3df", "#1b2f55", "#e6c34a"], p: "finlets" },
    Barracuda:     { t: "long",    c: ["#8a9aa4", "#e6eaec", "#6b7a83", "#3c474e"], p: "bars" },
    Sturgeon:      { t: "pike",    c: ["#6f6a5e", "#c9c2ae", "#55513f", "#d8d0b8"], p: "plates" },
    "Silver Arowana": { t: "pike", c: ["#c9d3da", "#eef2f4", "#9aa9b3", "#a7b6c0"], p: "scales", glow: true },
    // Epic
    "Great White Shark": { t: "shark", c: ["#6f7f8c", "#eef0f0", "#56636d", "#ffffff"] },
    "Manta Ray":   { t: "ray",     c: ["#2f3a4a", "#2f3a4a", "#232c38", "#e9edf2"], p: "belly" },
    "Giant Oarfish": { t: "long",  c: ["#cfd8de", "#eef2f4", "#d8473b", "#8fa1ad"], p: "oar" },
    "Ocean Sunfish": { t: "disc",  c: ["#8796a3", "#d4dbe1", "#6a7883"] },
    // Legendary
    "Moonlight Koi": { t: "classic", c: ["#f4f1e8", "#ffffff", "#d8d2c2", "#e0563f"], p: "koi", glow: true },
    "Ghost Carp":  { t: "classic", c: ["#bcd9e0", "#e4f2f5", "#9cc3cc", "#ffffff"], p: "scales", ghost: true, glow: true },
  };

  // ---------- junk, rods, bait, boxes ----------
  const ITEMS = {
    "Old Boot": {
      rows: [
        "...bbbbb....",
        "...bkkkb....",
        "...bbbbb....",
        "...bkkkb....",
        "...bbbbbbb..",
        "..bbbbbbbbbb",
        "..bbbbbbbbbb",
        "..kkkkkkkkkk",
      ],
      pal: { b: "#6b4a2f", k: "#3a281a" },
    },
    "Tin Can": {
      rows: ["..wwwwww..", "..bbbbbb..", "..baaaab..", "..baxxab..", "..baaaab..", "..bbbbbb..", "..wwwwww.."],
      pal: { b: "#8e9aa3", w: "#c9d1d6", a: "#c0504d", x: "#f0e6da" },
    },
    "Soggy Sock": {
      rows: ["...wwww.", "...bbbb.", "...baab.", "...bbbb.", "...bbbb.", ".bbbbbb.", "bbbbbbb.", "bbbbbk..", ".kkkk..."],
      pal: { b: "#c9c4b4", w: "#e8e3d4", a: "#b54a4a", k: "#8e897b" },
    },
    "Clump of Seaweed": {
      rows: ["..b...b..", "..bb.bb..", ".b.bbb.b.", ".bb.b.bb.", "..bbbbb..", ".b.bbb.b.", "bb..b..bb", ".bbbbbbb."],
      pal: { b: "#3f8a4a" },
    },
    "Broken Fishing Rod": {
      rows: ["..........kb", ".........kb.", "........kb..", ".......kb...", "......b.....", "....kb......", "...kb.......", "..kbx.......", ".kb.........", "kb.........."],
      pal: { b: "#8a6a3e", k: "#5e4526", x: "#9aa5ad" },
    },
    "Rusty Anchor": {
      rows: ["....bbb....", "....b.b....", "....bbb....", "..bbbbbbb..", ".....b.....", ".....b.....", "b....b....b", "bb...b...bb", ".bb..b..bb.", "..bbbbbbb.."],
      pal: { b: "#8a5a3a" },
    },
    "Torn Net": {
      rows: ["b.b.b.b.b", ".b.b.b.b.", "b.b...b.b", ".b.....b.", "b.b...b.b", ".b.b.b.b.", "b.b.b.b.b"],
      pal: { b: "#b9a77a" },
    },

    // Rods: diagonal, handle bottom-left, line from the tip
    "Twig Rod": {
      rows: [
        "..............w.",
        ".............bw.",
        "............b.w.",
        "...........b..w.",
        "..........bb..w.",
        ".........b....w.",
        "........b.....w.",
        ".......bb....ww.",
        "......b......wk.",
        ".....b..........",
        "....bb..........",
        "...b............",
        "..kk............",
        ".kk.............",
      ],
      pal: { b: "#8a6a3e", k: "#5e4526", w: "#d8e2e6" },
    },
    "Bamboo Rod": {
      rows: [
        "..............w.",
        ".............bw.",
        "............b.w.",
        "...........x..w.",
        "..........b...w.",
        ".........b....w.",
        "........x.....w.",
        ".......b.....ww.",
        "......b......wk.",
        ".....x..........",
        "....b...........",
        "...b............",
        "..kk............",
        ".kk.............",
      ],
      pal: { b: "#c9b36a", x: "#7d8a3e", k: "#6b5a2e", w: "#d8e2e6" },
    },
    "Steel Rod": {
      rows: [
        "..............w.",
        ".............bw.",
        "............b.w.",
        "...........b..w.",
        "..........b...w.",
        ".........b....w.",
        "........b.....w.",
        ".......b.....ww.",
        "......b......wk.",
        ".....b..........",
        "...xxx..........",
        "...xkx..........",
        "..kxxx..........",
        ".kk.............",
      ],
      pal: { b: "#9aa9b3", x: "#6b7a84", k: "#2f3a40", w: "#d8e2e6" },
    },
    "Golden Rod": {
      rows: [
        "..............w.",
        ".............bw.",
        "............b.w.",
        "...........b..w.",
        "..........b...w.",
        ".........b....w.",
        "........b.....w.",
        ".......b.....ww.",
        "......b......wk.",
        ".....b..........",
        "...xxx..........",
        "...xgx..........",
        "..kxxx..........",
        ".kk.............",
      ],
      pal: { b: "#f0c23a", x: "#c48f18", g: "#fff4a3", k: "#6b4a10", w: "#d8e2e6" },
      glow: true,
    },
    "Kraken Rod": {
      rows: [
        "..............w.",
        ".............bw.",
        "............b.w.",
        "...........b..w.",
        "..........b...w.",
        ".........b....w.",
        "........b.....w.",
        ".......b.....ww.",
        "......b......wk.",
        "..x..b..........",
        ".x.xxx..........",
        "...xgx.x........",
        "..kxxx.x........",
        ".kk..xx.........",
      ],
      pal: { b: "#9b6fd0", x: "#6a3fa0", g: "#d8b8ff", k: "#3a2060", w: "#d8e2e6" },
      glow: true,
    },
    "Founder's Rod": {
      rows: [
        "............g.w.",
        "...........ggbw.",
        "............b.w.",
        "...........b..w.",
        "..........y...w.",
        ".........b....w.",
        "........b.....w.",
        ".......y.....ww.",
        "......b......wk.",
        ".....b..........",
        "...yyy..........",
        "...ygy..........",
        "..kyyy..........",
        ".kk.............",
      ],
      pal: { b: "#5a3a22", y: "#f0c23a", g: "#fff4a3", k: "#2e1d10", w: "#d8e2e6" },
      glow: true,
    },
    "Candy Cane Rod": {
      rows: [
        "..............w.",
        ".............rw.",
        "............b.w.",
        "...........r..w.",
        "..........b...w.",
        ".........r....w.",
        "........b.....w.",
        ".......r.....ww.",
        "......b......wk.",
        ".....r..........",
        "...ggg..........",
        "...grg..........",
        "..kggg..........",
        ".kk.............",
      ],
      pal: { b: "#ffffff", r: "#d8343a", g: "#2f7a4f", k: "#7a1c20", w: "#d8e2e6" },
    },

    // Bait and boxes
    Worm: {
      rows: ["..........", "..bb......", ".b..b.....", ".b...b..bb", "......bb.b", "........b."],
      pal: { b: "#d98a8a" },
    },
    "Glow Lure": {
      rows: [".....w.....", ".....w.....", "....ggg....", "...gbbbg...", "..gbbebbg..", "...gbbbg...", "....bbb....", ".....k.....", "....k.k...."],
      pal: { b: "#f0c23a", g: "#fff4a3", e: "#0b1b22", w: "#d8e2e6", k: "#9aa5ad" },
      glow: true,
    },
    Chest: {
      rows: [".bbbbbbbbbb.", "bkkkkkkkkkkb", "bbbbbyybbbbb", "kkkkkyykkkkk", "bbbbbbbbbbbb", "bbbbbbbbbbbb", "kkkkkkkkkkkk"],
      pal: { b: "#8a5a2e", k: "#5e3a1a", y: "#f0c23a" },
    },
    Present: {
      rows: ["...g..g...", "....gg....", "rrrrggrrrr", "rrrrggrrrr", "gggggggggg", "rrrrggrrrr", "rrrrggrrrr", "rrrrggrrrr"],
      pal: { r: "#d8343a", g: "#f0c23a" },
    },
  };

  // ---------- drawing ----------
  const EYE = "#0b1b22";
  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function mix(c, amt) {
    // amt < 0 darkens, > 0 lightens
    const [r, g, b] = hex(c);
    const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  function paint(name, spec) {
    const out = spec.rows.map((r) => [...r]);
    const [body, belly, fin, accent] = spec.c;
    const pal = { b: body, l: belly, f: fin, a: accent || fin, e: EYE, w: "#ffffff" };
    const p = spec.p;
    const H = out.length;
    out.forEach((row, y) =>
      row.forEach((ch, x) => {
        if (ch !== "b" && ch !== "l") return;
        const mid = Math.floor(H / 2);
        let A = false;
        if (p === "stripes" || p === "bands") A = ch === "b" && x % 3 === 0 && x > 2;
        else if (p === "bars") A = ch === "b" && x % 4 === 1;
        else if (p === "spots") A = (x * 7 + y * 13 + name.length) % 6 === 0;
        else if (p === "scales") A = ch === "b" && (x + y) % 3 === 0 && y > 1;
        else if (p === "line") A = y === mid - 1 + (H % 2) && ch === "b";
        else if (p === "rainbow") A = y === mid && ch === "b";
        else if (p === "waves") A = ch === "b" && (x + (y % 2)) % 3 === 0;
        else if (p === "koi") A = ch === "b" && (Math.floor(x / 3) + Math.floor(y / 2)) % 3 === 1;
        else if (p === "zap") A = ch === "b" && x % 5 === 2;
        else if (p === "plates") A = ch === "b" && y === 1 && x % 2 === 0;
        else if (p === "finlets") A = ch === "l" && x % 2 === 0 && y === H - 3;
        else if (p === "oar") A = ch === "b" && (x * 3 + y) % 7 === 0;
        else if (p === "belly") A = ch === "b" && y === mid && x > 2 && x < 12;
        if (A) out[y][x] = "a";
      })
    );
    // the Oarfish's red crest runs along its back
    if (p === "oar") out[0] = out[0].map((ch) => (ch === "b" ? "f" : ch));
    return { grid: out, pal, glow: spec.glow, ghost: spec.ghost };
  }

  function build(name) {
    if (FISH[name]) {
      const s = FISH[name];
      return paint(name, { ...s, rows: T[s.t] });
    }
    const s = SPECIAL[name] || ITEMS[name];
    if (!s) return null;
    return { grid: s.rows.map((r) => [...r]), pal: { e: EYE, w: "#ffffff", ...s.pal }, glow: s.glow, ghost: s.ghost };
  }

  // Add a 1-pixel dark outline around every filled pixel
  function toSVG(name, { silhouette = false, title = "" } = {}) {
    const s = build(name);
    if (!s) return "";
    const g = s.grid;
    const H = g.length + 2;
    const W = Math.max(...g.map((r) => r.length)) + 2;
    const filled = (x, y) => y >= 1 && y <= g.length && x >= 1 && g[y - 1][x - 1] && g[y - 1][x - 1] !== ".";
    const firstColour = s.pal.b || Object.values(s.pal).find((v) => v.startsWith("#") && v !== EYE) || "#888888";
    const outline = silhouette ? "#0a1c24" : mix(firstColour, -0.62);
    let rects = "";
    // outline
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)))
          rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${outline}"/>`;
    // pixels
    g.forEach((row, y) =>
      row.forEach((ch, x) => {
        if (ch === ".") return;
        let fill = silhouette ? "#18343f" : s.pal[ch] || s.pal.b;
        // soft top highlight on bodies
        if (!silhouette && ch === "b" && y > 0 && (!g[y - 1][x] || g[y - 1][x] === ".")) fill = mix(s.pal.b, 0.18);
        rects += `<rect x="${x + 1}" y="${y + 1}" width="1.02" height="1.02" fill="${fill}"/>`;
      })
    );
    const cls = ["px", s.glow && !silhouette ? "glow" : "", s.ghost && !silhouette ? "ghost" : ""].filter(Boolean).join(" ");
    const label = title ? `role="img" aria-label="${title.replace(/"/g, "&quot;")}"` : 'aria-hidden="true"';
    return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" ${label}>${rects}</svg>`;
  }

  const names = [...Object.keys(FISH), ...Object.keys(SPECIAL), ...Object.keys(ITEMS)];
  // Size in sprite pixels (with the outline), for scaling
  function size(name) {
    const s = build(name);
    if (!s) return null;
    return { w: Math.max(...s.grid.map((r) => r.length)) + 2, h: s.grid.length + 2 };
  }
  window.SPRITES = { svg: toSVG, size, has: (n) => !!build(n), names };
})();
