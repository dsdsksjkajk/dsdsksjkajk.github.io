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
  // Shapes are designed at 1x, then doubled with Scale2x (smooth curves instead of stairs),
  // then patterned, shaded (lit from above) and outlined at 2x for detail.
  const RES = 2;
  const EYE = "#0b1b22";
  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  // amt < 0 darkens, > 0 lightens
  function mixRGB([r, g, b], amt) {
    const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return [f(r), f(g), f(b)];
  }
  const css = ([r, g, b]) => `rgb(${r},${g},${b})`;
  const mix = (c, amt) => css(mixRGB(hex(c), amt));

  // Scale2x / EPX on a grid of letters
  function scale2x(g) {
    const H = g.length;
    const W = Math.max(...g.map((r) => r.length));
    const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? "." : g[y][x] || ".");
    const out = Array.from({ length: H * 2 }, () => Array(W * 2).fill("."));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        let p1 = P, p2 = P, p3 = P, p4 = P;
        if (C === A && C !== D && A !== B) p1 = A;
        if (A === B && A !== C && B !== D) p2 = B;
        if (D === C && D !== B && C !== A) p3 = C;
        if (B === D && B !== A && D !== C) p4 = D;
        // keep eyes and small details crisp
        if ("ewg".includes(P)) p1 = p2 = p3 = p4 = P;
        out[y * 2][x * 2] = p1;
        out[y * 2][x * 2 + 1] = p2;
        out[y * 2 + 1][x * 2] = p3;
        out[y * 2 + 1][x * 2 + 1] = p4;
      }
    return out;
  }

  // Patterns at 2x resolution: finer spots, stripes and scales
  function pattern(g, p, seed) {
    if (!p) return;
    const H = g.length;
    const mid = Math.floor(H / 2);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < g[y].length; x++) {
        const ch = g[y][x];
        if (ch !== "b" && ch !== "l") continue;
        let A = false;
        if (p === "bands") A = ch === "b" && x > 5 && x % 6 < 2;
        else if (p === "bars") A = ch === "b" && x % 7 < 2;
        else if (p === "spots") A = ((x * 7 + y * 13 + seed) % 11 === 0) || ((x * 5 + y * 3 + seed) % 17 === 0 && x % 2 === 0);
        else if (p === "scales") A = ch === "b" && y > 2 && ((x + (Math.floor(y / 2) % 2) * 2) % 4 === 0) && y % 2 === 0;
        else if (p === "line") A = ch === "b" && (y === mid - 1 || y === mid - 2) && x % 2 === 0;
        else if (p === "rainbow") A = ch === "b" && (y === mid || y === mid - 1);
        else if (p === "waves") A = ch === "b" && (x + Math.round(2 * Math.sin(y))) % 5 === 0;
        else if (p === "koi") A = ch === "b" && (Math.floor((x + 1) / 5) + Math.floor(y / 4)) % 3 === 1;
        else if (p === "zap") A = ch === "b" && (x % 9 === 3 || (x % 9 === 4 && y % 2 === 0));
        else if (p === "plates") A = ch === "b" && y <= 3 && x % 4 === 0;
        else if (p === "finlets") A = ch === "l" && x % 4 === 0 && y >= H - 7 && y <= H - 5;
        else if (p === "oar") A = ch === "b" && (x * 3 + y * 2) % 13 === 0;
        else if (p === "belly") A = ch === "b" && (y === mid || y === mid - 1) && x > 5 && x < 24;
        if (A) g[y][x] = "a";
      }
  }

  // Base shape letters + palette for a name
  function build(name) {
    if (FISH[name]) {
      const s = FISH[name];
      const [body, belly, fin, accent] = s.c;
      return {
        grid: T[s.t].map((r) => [...r]),
        pal: { b: body, l: belly, f: fin, a: accent || fin, e: EYE, w: "#ffffff" },
        p: s.p,
        oar: s.p === "oar",
        glow: s.glow,
        ghost: s.ghost,
      };
    }
    const s = SPECIAL[name] || ITEMS[name];
    if (!s) return null;
    return { grid: s.rows.map((r) => [...r]), pal: { e: EYE, w: "#ffffff", ...s.pal }, glow: s.glow, ghost: s.ghost };
  }

  const cache = new Map();
  // Colour grid at 2x, with shading and outline. null = transparent.
  function render(name, silhouette) {
    const key = name + (silhouette ? "|s" : "");
    if (cache.has(key)) return cache.get(key);
    const s = build(name);
    if (!s) return null;
    if (s.oar) s.grid[0] = s.grid[0].map((ch) => (ch === "b" ? "f" : ch)); // the Oarfish's red crest
    let g = scale2x(s.grid);
    let seed = 0;
    for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) % 97;
    pattern(g, s.p, seed);
    // eyes: a white shine in the top-left pixel of each eye
    for (let y = 0; y < g.length - 1; y++)
      for (let x = 0; x < g[y].length - 1; x++)
        if (g[y][x] === "e" && g[y][x + 1] === "e" && g[y + 1][x] === "e" && (y === 0 || g[y - 1][x] !== "e") && (x === 0 || g[y][x - 1] !== "e"))
          g[y][x] = "w";

    // pad by 1 for the outline
    const H = g.length + 2;
    const W = Math.max(...g.map((r) => r.length)) + 2;
    const L = (x, y) => (y >= 1 && y <= g.length && x >= 1 ? g[y - 1][x - 1] || "." : ".");
    const filled = (x, y) => L(x, y) !== ".";
    // column extents, for the top-to-bottom light
    const top = Array(W).fill(H), bot = Array(W).fill(-1);
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++)
        if (filled(x, y)) {
          top[x] = Math.min(top[x], y);
          bot[x] = Math.max(bot[x], y);
        }

    const px = Array.from({ length: H }, () => Array(W).fill(null));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ch = L(x, y);
        if (ch === ".") continue;
        if (silhouette) {
          px[y][x] = [24, 52, 63];
          continue;
        }
        const base = s.pal[ch] || s.pal.b || "#888888";
        let c = hex(base);
        if (ch === "e" || ch === "w" || ch === "g") {
          px[y][x] = c;
          continue;
        }
        // light from above: brighter at the top of the shape, darker at the bottom
        const span = Math.max(1, bot[x] - top[x]);
        const t = (y - top[x]) / span;
        c = mixRGB(c, 0.16 - t * 0.34);
        // a bright rim where the top edge meets the water
        if (!filled(x, y - 1)) c = mixRGB(c, 0.28);
        else if (!filled(x, y - 2)) c = mixRGB(c, 0.1);
        // fins get rays
        if (ch === "f" && y % 2 === 0) c = mixRGB(c, -0.12);
        // soft edge between body and belly
        if (ch === "l" && L(x, y - 1) === "b") c = mixRGB(c, -0.1);
        px[y][x] = c;
      }
    // selective outline: a darker version of the colour it touches, darkest underneath
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (px[y][x]) continue;
        const n = [[x, y - 1, -0.7], [x - 1, y, -0.62], [x + 1, y, -0.62], [x, y + 1, -0.5]];
        let best = null;
        for (const [nx, ny, amt] of n) {
          if (ny < 0 || ny >= H || nx < 0 || nx >= W || !filled(nx, ny)) continue;
          const src = silhouette ? [24, 52, 63] : hex(s.pal[L(nx, ny)] || s.pal.b || "#888888");
          const col = silhouette ? [10, 28, 36] : mixRGB(src, amt);
          if (!best || col[0] + col[1] + col[2] < best[0] + best[1] + best[2]) best = col;
        }
        if (best) px[y][x] = best;
      }
    const out = { px, W, H, glow: s.glow, ghost: s.ghost };
    cache.set(key, out);
    return out;
  }

  function toSVG(name, { silhouette = false, title = "" } = {}) {
    const r = render(name, silhouette);
    if (!r) return "";
    let rects = "";
    // merge runs of the same colour in a row: fewer elements, same picture
    r.px.forEach((row, y) => {
      for (let x = 0; x < r.W; ) {
        const c = row[x];
        if (!c) {
          x++;
          continue;
        }
        let n = 1;
        while (x + n < r.W && row[x + n] && row[x + n].join() === c.join()) n++;
        rects += `<rect x="${x}" y="${y}" width="${n + 0.02}" height="1.02" fill="${css(c)}"/>`;
        x += n;
      }
    });
    const cls = ["px", r.glow && !silhouette ? "glow" : "", r.ghost && !silhouette ? "ghost" : ""].filter(Boolean).join(" ");
    const label = title ? `role="img" aria-label="${title.replace(/"/g, "&quot;")}"` : 'aria-hidden="true"';
    return `<svg class="${cls}" viewBox="0 0 ${r.W} ${r.H}" width="${r.W}" height="${r.H}" shape-rendering="crispEdges" ${label}>${rects}</svg>`;
  }

  const names = [...Object.keys(FISH), ...Object.keys(SPECIAL), ...Object.keys(ITEMS)];
  // Size in sprite pixels (with the outline). res says how many sprite pixels make one
  // design pixel, so pages can keep the same on-screen sizes.
  function size(name) {
    const r = render(name, false);
    return r ? { w: r.W, h: r.H } : null;
  }
  window.SPRITES = { svg: toSVG, size, res: RES, has: (n) => !!build(n), names };
})();
