'use strict';
/* =====================================================================
   UI: HTML panels (replacing the desktop windows) and the battle screen.
   ===================================================================== */
const MUTED = '#8b95a8';
const $ = id => document.getElementById(id);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'disabled') e.disabled = true;
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.append(kid.nodeType ? kid : String(kid));
  return e;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Keys are read by physical position (e.code), so they keep working with any
   keyboard layout or input method (IME), e.g. Chinese/Japanese/Korean. */
function keyName(e) {
  const c = e.code || ''; let m;
  if ((m = /^Key([A-Z])$/.exec(c))) return m[1].toLowerCase();
  if ((m = /^(?:Digit|Numpad)([0-9])$/.exec(c))) return m[1];
  const map = { Enter: 'enter', NumpadEnter: 'enter', Space: ' ', Escape: 'escape', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', F11: 'f11' };
  return map[c] || String(e.key || '').toLowerCase();
}
const UI = { panel: null, battle: null, area: null, bagTab: 'items', dirty: false, onAfterAction: null };
const modalOpen = () => !!UI.panel || !!UI.battle;
function afterAction() {
  sanitizeEquipment(); refreshMaxHp(); ensureQuests(); UI.dirty = true;
  if (UI.onAfterAction) UI.onAfterAction();
}
function specKey(spec) {
  return JSON.stringify([spec.header, spec.rows.map(r => [r.section, r.title, r.sub, r.bar, r.icon, r.fg, r.sprite && 1,
    (r.buttons || []).map(b => [b[0], !!b[2]])])]);
}

/* ---------------- generic panel ---------------- */
class Panel {
  constructor(key, title, builder, opts = {}) {
    this.key = key; this.builder = builder; this.live = !!opts.live; this.alive = true; this._key = null;
    this.head = h('div', { class: 'mhead' });
    this.body = h('div', { class: 'mbody' });
    this.status = h('div', { class: 'mstatus' });
    this.win = h('div', { class: 'modal' },
      h('div', { class: 'mtitle' }, h('span', {}, title), h('button', { class: 'x', onclick: () => this.close(), title: 'Close (Esc)' }, '✕')),
      this.head, this.body, this.status);
    this.root = h('div', { class: 'modal-back' }, this.win);
    $('modal-root').append(this.root);
    UI.panel = this;
  }
  init() { this.refresh(); return this; }
  close() {
    if (!this.alive) return;
    this.alive = false; this.root.remove();
    if (UI.panel === this) UI.panel = null;
    if (this.onclose) this.onclose();
  }
  run(cb) {
    const res = cb(); afterAction();
    if (res === 'close') { this.close(); return; }
    if (res && UI.pop) UI.pop(res);
    if (UI.panel) UI.panel.refresh();
  }
  refresh() {
    if (!this.alive) return;
    const spec = this.builder();
    if (LOG.length) { const l = LOG[LOG.length - 1]; this.status.textContent = l[1]; this.status.style.color = l[2]; }
    const key = specKey(spec);
    if (key === this._key) return;
    this._key = key;
    const scroll = this.body.scrollTop;
    this.head.textContent = spec.header || '';
    this.body.replaceChildren(...spec.rows.map(r => this.row(r)));
    this.body.scrollTop = scroll;
  }
  row(r) {
    if (r.section) return h('div', { class: 'sec' }, r.section);
    const left = h('div', { class: 'rl' }, h('div', { class: 'rt', style: r.fg ? { color: r.fg } : {} }, r.title),
      r.sub ? h('div', { class: 'rs' }, r.sub) : null,
      r.bar ? h('div', { class: 'bar' }, h('i', { style: { width: Math.max(0, Math.min(1, r.bar[0] / Math.max(1, r.bar[1]))) * 100 + '%', background: r.bar[2] } })) : null);
    const pic = r.sprite ? h('img', { class: 'ric', src: spriteURL(r.sprite), alt: '' }) : (r.icon ? h('img', { class: 'ric', src: iconURL(r.icon), alt: '' }) : null);
    const btns = h('div', { class: 'rb' }, (r.buttons || []).map(([label, cb, en]) =>
      h('button', { disabled: !en, onclick: () => this.run(cb) }, label)));
    return h('div', { class: 'row' }, pic, left, btns);
  }
}

/* ---------------- timed gathering ---------------- */
class GatherPanel extends Panel {
  constructor(skill) {
    super(skill, D.GATHERING[skill].title, () => this.spec());
    this.skill = skill; this.active = null; this.t0 = 0; this.dur = 1; this.txt = '';
    this.progLabel = h('div', { class: 'ptext' }, 'Pick something to gather');
    this.progFill = h('i', {});
    this.win.insertBefore(h('div', { class: 'prog' }, this.progLabel, h('div', { class: 'bar big' }, this.progFill)), this.body);
    this.timer = setInterval(() => this.tick(), 100);
  }
  close() { clearInterval(this.timer); super.close(); }
  toggle(i) {
    if (this.active === i) this.active = null;
    else { this.active = i; this.t0 = now(); this.dur = gatherTime(this.skill, D.GATHERING[this.skill].nodes[i]); }
    return null;
  }
  spec() {
    const cfg = D.GATHERING[this.skill], level = skillLevel(this.skill), xp = P.xp[this.skill], [lo, hi] = xpBounds(level);
    let sub = `XP ${xp - lo}/${hi - lo}`;
    if (cfg.tool) { const t = eqDef(cfg.tool); sub += `   |   ${t.name || 'No tool'}  (${Math.round(toolSpeed(cfg.tool) * 100)}% time)`; }
    if (buffActive('gatherer_until')) sub += "   |   Gatherer's Tonic: -30% time";
    const rows = [{ title: `${cfg.title}  -  Level ${level}`, sub, bar: [xp - lo, hi - lo, '#4ec9ff'] }];
    let last = null;
    cfg.nodes.forEach((node, i) => {
      if (node.section && node.section !== last) { rows.push({ section: node.section }); last = node.section; }
      const locked = level < node.level;
      const bonus = node.drops.map(([it, ch]) => `${Math.round(ch * 100)}% ${itemName(it)}`).join(', ');
      rows.push({
        icon: node.item, fg: locked ? MUTED : null,
        title: node.name + (locked ? `   (needs Lv ${node.level})` : ''),
        sub: `${node.qty}x ${itemName(node.item)}  |  ${gatherTime(this.skill, node).toFixed(1)}s  |  +${node.xp} XP` + (bonus ? `\nBonus: ${bonus}` : ''),
        buttons: [[this.active === i ? 'Stop' : 'Gather', () => this.toggle(i), !locked]],
      });
    });
    return { header: cfg.title, rows };
  }
  tick() {
    if (!this.alive) return;
    if (this.active === null) { this.setProg(0, 'Idle - pick something to gather'); return; }
    const node = D.GATHERING[this.skill].nodes[this.active], elapsed = now() - this.t0, frac = Math.min(1, elapsed / this.dur);
    this.setProg(frac, `${node.name}   ${Math.max(0, this.dur - elapsed).toFixed(1)}s left`);
    if (elapsed >= this.dur) {
      const res = actGatherOnce(this.skill, this.active); afterAction();
      if (res) { if (UI.pop) UI.pop(res); this.t0 = now(); this.dur = gatherTime(this.skill, node); } else this.active = null;
      this.refresh();
    }
  }
  setProg(frac, text) { if (text !== this.txt) { this.txt = text; this.progLabel.textContent = text; } this.progFill.style.width = frac * 100 + '%'; }
}

/* ---------------- panel builders ---------------- */
function bSmelt() {
  const level = skillLevel('smelting'), tier = P.furnace_tier;
  const rows = [{ title: `Smelting  -  Level ${level}`, sub: tier !== 'None' ? `Furnace: ${tier}  (also smelts automatically while you play)` : 'No furnace yet - craft one at the Anvil.' }];
  D.SMELT.forEach(([ore, bar, xp, req], i) => {
    const ok = tier !== 'None' && level >= req;
    rows.push({ icon: bar, fg: ok ? null : MUTED, title: `${itemName(bar)}   (2x ${itemName(ore)}, have ${qty(ore)})`, sub: `+${xp} XP   |   needs smelting Lv ${req}`,
      buttons: [['Smelt', () => actSmelt(i, 1), ok], ['x5', () => actSmelt(i, 5), ok]] });
  });
  return { header: 'Furnace', rows };
}
function gearStatText(id) {
  const d = D.EQUIPMENT[id], bits = [];
  if (d.slot === 'weapon') bits.push(`${cap(d.style)}  ATK ${d.atk}`);
  if (d.def !== undefined) bits.push(`DEF +${d.def}`);
  if ((d.slot === 'ring' || d.slot === 'amulet') && d.atk !== undefined) bits.push(`ATK +${d.atk}`);
  if (d.hp !== undefined) bits.push(`Max HP +${d.hp}`);
  if (d.speed !== undefined) bits.push(d.speed < 1 ? `Gathering ${Math.round((1 - d.speed) * 100)}% faster` : 'Standard speed');
  return bits.join('  |  ');
}
function bCraft() {
  const rows = [{ title: `Crafting  -  Level ${skillLevel('crafting')}`, sub: `Furnace tier: ${P.furnace_tier}` }];
  const sections = { furnace: 'Furnaces', gear: 'Gear', item: 'Jewelry', ammo: 'Arrows' };
  let last = null;
  D.CRAFT.forEach((r, i) => {
    if (sections[r.kind] !== last) { last = sections[r.kind]; rows.push({ section: last }); }
    const reason = recipeBlocked(r), can = !reason && canAfford(r.cost);
    let sub = costStr(r.cost);
    if (r.kind === 'gear') sub = gearStatText(r.id) + '\n' + sub;
    else if (r.kind === 'ammo') sub = `+${D.ITEMS[r.output].ammo} bow damage\n` + sub;
    rows.push({ icon: r.id || r.output, fg: reason ? MUTED : null, title: r.name + (reason ? `   [${reason}]` : ''), sub, buttons: [['Craft', () => actCraft(i), can]] });
  });
  rows.push({ section: 'Open containers' });
  rows.push({ icon: 'geode', title: `Smash Stone Geode  (have ${qty('geode')})`, buttons: [['Smash', () => actSpecial('G'), qty('geode') > 0]] });
  rows.push({ icon: 'birds_nest', title: `Open Bird's Nest  (have ${qty('birds_nest')})`, sub: 'May contain feathers for arrows!', buttons: [['Open', () => actSpecial('N'), qty('birds_nest') > 0]] });
  return { header: 'Anvil & Crafting', rows };
}
function bBrew() {
  const level = skillLevel('brewing');
  const rows = [{ title: `Brewing  -  Level ${level}`, sub: 'Drink potions from your backpack (I). Combat potions help in the Adventure Gate, wards counter elements.' }];
  D.BREW.forEach((r, i) => {
    const p = D.POTIONS[r.potion], ok = level >= r.level && canAfford(r.cost);
    rows.push({ icon: r.potion, fg: level >= r.level ? null : MUTED, title: `${p.name}   (Lv ${r.level}, owned ${P.potions[r.potion]})`,
      sub: p.desc + (p.duration ? ` for ${Math.floor(p.duration / 60)} min` : '') + '\n' + costStr(r.cost), buttons: [['Brew', () => actBrew(i), ok]] });
  });
  return { header: 'Alchemy Cauldron', rows };
}
function bCook() {
  const level = skillLevel('cooking'), burn = Math.max(0.05, 0.40 - level * 0.02);
  const rows = [{ title: `Cooking  -  Level ${level}`, sub: `Burn chance: ${Math.round(burn * 100)}%   (level up to cook safer)` }];
  D.COOK.forEach((r, i) => {
    const ok = level >= r.level && qty(r.raw) > 0;
    rows.push({ icon: r.cooked, fg: level >= r.level ? null : MUTED, title: `Cook ${itemName(r.raw)}   (have ${qty(r.raw)})`,
      sub: `-> ${itemName(r.cooked)}, heals ${D.ITEMS[r.cooked].heal}   |   Lv ${r.level}   +${r.xp} XP`,
      buttons: [['Cook', () => actCook(i, 1), ok], ['x5', () => actCook(i, 5), ok]] });
  });
  return { header: 'Kitchen', rows };
}
function bFarm() {
  const level = skillLevel('farming'), patch = P.farm_patch, rows = [];
  if (patch.crop !== 'None') {
    const left = Math.trunc(patch.ready_at - now());
    if (left > 0) {
      const total = D.CROPS.find(c => c.crop === patch.crop).time;
      rows.push({ title: `Growing ${patch.crop}...`, sub: `${fmtTime(left)} remaining`, bar: [total - left, total, '#7cfc9a'] });
    } else rows.push({ title: `${patch.crop} is fully grown!`, buttons: [['Harvest', actHarvest, true]] });
  } else D.CROPS.forEach((c, i) => {
    rows.push({ icon: c.seed, title: `Plant ${c.crop}   (Lv ${c.level})`, sub: `Seed: ${itemName(c.seed)} (have ${qty(c.seed)})   |   ${c.time}s`,
      buttons: [['Plant', () => actPlant(i), level >= c.level && qty(c.seed) > 0]] });
  });
  return { header: `Farming  -  Level ${level}`, rows };
}
function bShop() {
  const mult = goldMultiplier(), sellable = sellableItems();
  const rows = [{ title: `Sell everything   (${Object.keys(sellable).length} item types)`, buttons: [['Sell ALL', () => actSell(null), Object.keys(sellable).length > 0]] }];
  Object.entries(sellable).sort((a, b) => D.ITEMS[b[0]].value - D.ITEMS[a[0]].value).forEach(([i, q]) => {
    const unit = Math.trunc(D.ITEMS[i].value * mult);
    rows.push({ icon: i, title: `${itemName(i)}   x${q}`, sub: `${unit}g each   =   ${unit * q}g total`, buttons: [['Sell', () => actSell(i), true]] });
  });
  if (!Object.keys(sellable).length) rows.push({ title: 'You have nothing to sell.' });
  return { header: `Trading Post   -   multiplier x${mult.toFixed(2)}${buffActive('midas_until') ? '   (Midas Brew active!)' : ''}   |   Gold: ${fmt(P.gold)}`, rows };
}
function bQuests() {
  const rows = [{ title: 'Claim all finished quests', buttons: [['Claim all', claimAllQuests, P.quests.some(q => q.done)]] }];
  P.quests.forEach((q, i) => rows.push({
    title: q.text + (q.done ? '   [READY]' : ''), fg: q.done ? '#ffd75e' : null,
    sub: `${q.progress}/${q.target}   |   Reward: ${q.gold}g` + (q.xp ? ` + ${q.xp} ${q.skill} XP` : ''), bar: [q.progress, q.target, '#ffd75e'],
    buttons: [['Claim', () => claimQuest(i), q.done], [`Reroll ${C.QUEST_REROLL_COST}g`, () => rerollQuest(i), P.gold >= C.QUEST_REROLL_COST]],
  }));
  return { header: `Quest Board   |   Gold: ${fmt(P.gold)}`, rows };
}
function bFactory() {
  const away = Math.trunc(C.OFFLINE_EFFICIENCY * 100), haste = buffActive('haste_until') ? C.HASTE_FACTOR : 1;
  const rows = [{ section: `Machines (while you're away they work at ${away}%, up to ${Math.floor(offlineCap() / 3600)}h)` }];
  for (const [key, label] of Object.entries(D.MACHINES)) {
    const owned = P.automation[key], cost = P.automation_costs[key], [item, per] = D.AUTO_OUT[key];
    const cycle = C.BASE_TICK * D.AUTO_EVERY[key] * tickSpeedFactor() / haste;
    const perMin = effectiveUnits(owned) * autoMultiplier(key) * per * 60 / cycle, maxed = owned >= C.MAX_MACHINES;
    rows.push({ icon: item, title: `${label}   owned: ${owned}/${C.MAX_MACHINES}`,
      sub: `Each makes ${per}x ${itemName(item)} every ${Math.round(cycle)}s   |   Total now: ~${perMin.toFixed(1)}/min (output x${autoMultiplier(key).toFixed(2)}, ${effectiveUnits(owned).toFixed(1)} effective units - each extra machine adds a bit less)`,
      buttons: [[maxed ? 'MAX' : `Buy ${fmt(cost)}g`, () => actBuyMachine(key), !maxed && P.gold >= cost]] });
  }
  rows.push({ section: 'Efficiency (+10% output per level)' });
  for (const [key, label] of Object.entries(D.MACHINES)) {
    const lvl = P.auto_eff[key];
    if (lvl >= C.EFFICIENCY_MAX) { rows.push({ title: `${label} efficiency  Lv ${lvl}  (MAX)`, bar: [lvl, C.EFFICIENCY_MAX, '#e3a8ff'] }); continue; }
    const [g, bars] = efficiencyCost(key);
    rows.push({ title: `${label} efficiency  Lv ${lvl}`, sub: `${fmt(g)}g` + (Object.keys(bars).length ? ' + ' + costStr(bars) : ''), bar: [lvl, C.EFFICIENCY_MAX, '#4ec9ff'],
      buttons: [['Upgrade', () => actUpgradeEff(key), P.gold >= g && canAfford(bars)]] });
  }
  rows.push({ section: 'Global upgrades' });
  for (const [key, label, mx, note] of [['tick_speed', 'Overclock', C.TICK_SPEED_MAX, '-2% cycle time'], ['warehouse', 'Warehouse', C.WAREHOUSE_MAX, '+1h offline progress cap']]) {
    const lvl = P.auto_tools[key];
    if (lvl >= mx) { rows.push({ title: `${label}  Lv ${lvl}  (MAX)`, bar: [lvl, mx, '#e3a8ff'] }); continue; }
    const [g, bars] = toolUpgradeCost(key);
    rows.push({ title: `${label}  Lv ${lvl}   (${note})`, sub: `${fmt(g)}g` + (Object.keys(bars).length ? ' + ' + costStr(bars) : ''), bar: [lvl, mx, '#4ec9ff'],
      buttons: [['Upgrade', () => actUpgradeTool(key), P.gold >= g && canAfford(bars)]] });
  }
  return { header: `Factory   |   Gold: ${fmt(P.gold)}   |   Offline cap: ${Math.floor(offlineCap() / 3600)}h at ${away}% efficiency`, rows };
}
function confirmAscend() {
  if (!window.confirm(`Reset your progress for +${ascendApGain()} Ascension Points?`)) return null;
  const res = actAscend(); if (UI.onAscend) UI.onAscend(); return res;
}
function bAltar() {
  const pres = P.prestige, total = totalLevels(), req = ascendRequirement(), can = total >= req;
  const rows = [
    { title: `Total skill levels: ${total} / ${req}`, sub: 'Ascending resets skills, gold, items, gear and machines. You keep AP, AP upgrades, boss cooldowns and stats.', bar: [total, req, '#e3a8ff'] },
    { title: can ? `ASCEND NOW   (+${ascendApGain()} AP)` : 'Ascend (locked)', buttons: [['Ascend', confirmAscend, can]] },
    { section: 'Permanent upgrades' }];
  for (const [key, u] of Object.entries(D.AP_UPGRADES)) {
    const lvl = up(key);
    if (lvl >= u.max) { rows.push({ title: `${u.name}  Lv ${lvl}  (MAX)`, sub: u.desc, bar: [lvl, u.max, '#e3a8ff'] }); continue; }
    rows.push({ title: `${u.name}  Lv ${lvl}/${u.max}`, sub: u.desc, bar: [lvl, u.max, '#4ec9ff'], buttons: [[`Buy ${apCost(key)} AP`, () => actBuyAp(key), pres.ap >= apCost(key)]] });
  }
  return { header: `Ascension Altar   |   Ascensions: ${pres.count}   |   AP: ${pres.ap}   |   +${pres.count * 5}% XP & gold`, rows };
}
const dropLines = drops => drops.map(([item, chance, q]) => {
  const n = Array.isArray(q) ? (q[0] === q[1] ? q[0] : `${q[0]}-${q[1]}`) : q;
  return `${itemName(item)} ${Math.round(chance * 100)}% (x${n})`;
}).join(', ');
const stars = a => '★'.repeat(a.stars) + '☆'.repeat(5 - a.stars);
function bDungeon() {
  const prof = combatProfile();
  const info = { title: `Your build: ${cap(prof.style)}   ATK ${prof.attack}   DEF ${prof.defense}`,
    sub: 'Pick an area - a RANDOM monster from it will attack. Monsters have FIXED strength: an area is just as hard at level 1 as at level 50. Fights cost 15 hunger (none if you flee). Swap loadouts mid-fight with 5-0.' };
  if (UI.area === null) {
    const rows = [info];
    for (const aid of D.AREA_ORDER) {
      const a = D.AREAS[aid], elems = [...new Set(a.mobs.filter(m => m.element).map(m => m.element))].sort();
      rows.push({ sprite: a.mobs[a.mobs.length - 1].sprite, title: `${a.name}   ${stars(a)}`,
        sub: `${a.desc}\nMonsters: ${a.mobs.map(m => m.name).join(', ')}` + (elems.length ? `\nElement: ${elems.join(', ')}` : ''),
        buttons: [['Explore!', () => startBattle(makeAreaBattle(aid)), true], ['Drops', () => { UI.area = aid; return null; }, true]] });
    }
    return { header: 'Adventure Gate - choose an area', rows };
  }
  const area = D.AREAS[UI.area], aid = UI.area, wards = { fire: 'Fire Ward', ice: 'Frost Ward', spirit: 'Spirit Ward' };
  const rows = [
    { title: `${area.name}   ${stars(area)}`, sub: area.desc, buttons: [['< Areas', () => { UI.area = null; return null; }, true]] }, info,
    { title: `Explore the ${area.name}`, sub: `One of the ${area.mobs.length} monsters below will attack you at random.`, buttons: [['Explore!', () => startBattle(makeAreaBattle(aid)), true]] },
    { section: 'Monsters you may meet, and what they drop' }];
  const xpSkill = prof.style === 'ranged' ? 'archery' : 'combat';
  for (const m of area.mobs) rows.push({ sprite: m.sprite, title: m.name,
    sub: `HP ${m.hp}   ATK ${m.atk}` + (m.element ? `   Element: ${cap(m.element)} (try ${wards[m.element]})` : '') + `\nReward: ${m.gold[0]}-${m.gold[1]}g, ${m.xp} ${xpSkill} XP\nDrops: ${dropLines(m.drops)}` });
  return { header: `Adventure Gate - ${area.name}`, rows };
}
function bBoss() {
  const level = fightLevel(), t = now(), rows = [];
  for (const [bid, b] of Object.entries(D.BOSSES)) {
    const readyAt = P.boss_cd[bid] || 0; let status, can = false;
    if (level < b.req) status = `Locked - needs combat/archery Lv ${b.req}`;
    else if (readyAt > t) status = `Recovering: ${fmtTime(readyAt - t)}`;
    else { status = 'READY'; can = true; }
    rows.push({ sprite: b.sprite, fg: can ? '#7cfc9a' : MUTED, title: `${b.name}   (HP ${b.hp}, ATK ${b.atk})`,
      sub: `${status}\nReward: ${b.gold[0]}-${b.gold[1]}g, ${b.xp} XP\nDrops: ${dropLines(b.drops)}`,
      buttons: [['Fight!', () => startBoss(bid), can]] });
  }
  return { header: 'Boss Lair   -   bosses repeat a fixed attack pattern. Learn it!', rows };
}
function startBoss(bid) {
  if (P.hp < P.max_hp * 0.6 && !window.confirm("You're wounded. Bosses hit hard! Fight anyway?")) return null;
  return startBattle(makeBossBattle(bid));
}
function bBag() {
  const tabs = [['items', 'Items'], ['gear', 'Gear'], ['loadouts', 'Loadouts'], ['potions', 'Potions']];
  const rows = [
    { title: `HP ${P.hp}/${P.max_hp}   |   Hunger ${P.hunger}/100   |   Gold ${fmt(P.gold)}`, bar: [P.hp, P.max_hp, '#3ddc84'] },
    { title: 'View:', buttons: tabs.map(([t, label]) => [label, () => { UI.bagTab = t; return null; }, UI.bagTab !== t]) }];
  const tab = UI.bagTab;
  if (tab === 'items') {
    const foods = foodsOwned();
    const items = Object.entries(P.inventory).filter(([i, q]) => q > 0 && D.ITEMS[i] && !D.EQUIPMENT[i]).sort((a, b) => D.ITEMS[b[0]].value - D.ITEMS[a[0]].value);
    if (!items.length) rows.push({ title: 'Nothing here yet.' });
    for (const [i, q] of items) {
      const row = { icon: i, title: `${itemName(i)}   x${q}`, sub: `${D.ITEMS[i].value}g each` };
      if (foods.includes(i)) { row.sub = `Heals ${Math.trunc(D.ITEMS[i].heal * 0.8)} HP, +${D.ITEMS[i].heal} hunger`; row.buttons = [['Eat', () => actEat(i), true]]; }
      else if (D.ITEMS[i].ammo !== undefined) row.sub = `+${D.ITEMS[i].ammo} bow damage`;
      rows.push(row);
    }
  } else if (tab === 'gear') {
    rows.push({ section: 'Equipped' });
    for (const [slot, label] of D.SLOT_LABELS) {
      const item = P.equipment[slot] || '';
      const sub = slot === 'ammo' && item ? `+${D.ITEMS[item].ammo} bow damage   |   x${qty(item)}` : (item ? gearStatText(item) : '');
      rows.push({ icon: item || null, fg: item ? null : MUTED, title: `${label}: ${item ? itemName(item) : '(empty)'}`, sub, buttons: [['Unequip', () => actUnequip(slot), !!item]] });
    }
    rows.push({ section: 'Gear in your bag' });
    const owned = Object.keys(D.EQUIPMENT).filter(i => qty(i) > 0).sort((a, b) => D.EQUIPMENT[a].slot.localeCompare(D.EQUIPMENT[b].slot) || (D.EQUIPMENT[a].tier || 0) - (D.EQUIPMENT[b].tier || 0));
    let shown = false;
    for (const i of owned) {
      const d = D.EQUIPMENT[i]; if (P.equipment[d.slot] === i) continue;
      shown = true; rows.push({ icon: i, title: `${d.name}   [${d.slot}]`, sub: gearStatText(i), buttons: [['Equip', () => actEquip(i), true]] });
    }
    if (!shown) rows.push({ title: 'No spare gear. Craft some at the Anvil!' });
    const ammo = Object.keys(D.ITEMS).filter(i => D.ITEMS[i].ammo !== undefined && qty(i) > 0);
    if (ammo.length) rows.push({ section: 'Arrows' });
    for (const i of ammo) {
      const on = P.equipment.ammo === i;
      rows.push({ icon: i, title: `${itemName(i)}   x${qty(i)}` + (on ? '   [in use]' : ''), sub: `+${D.ITEMS[i].ammo} bow damage`, buttons: [['Use', () => actSetAmmo(i), !on]] });
    }
  } else if (tab === 'loadouts') {
    rows.push({ title: 'Save your current weapon, armor, jewelry and arrows to a slot.', sub: "During a fight, press 5-0 (or click) to swap loadouts for free - it doesn't cost your turn." });
    D.LOADOUT_KEYS.forEach((key, i) => {
      const lo = P.loadouts[i], active = loadoutMatches(lo);
      rows.push({ title: `Loadout [${key}]` + (active ? '   (equipped)' : ''), sub: loadoutSummary(lo), fg: active ? '#ffd75e' : null,
        buttons: [['Save current', () => actSaveLoadout(i), true], ['Equip', () => actEquipLoadout(i), !!lo && !active], ['Clear', () => actClearLoadout(i), !!lo]] });
    });
  } else {
    const active = Object.entries(D.POTIONS).filter(([, d]) => d.buff && buffActive(d.buff));
    if (active.length) rows.push({ section: 'Active effects' });
    for (const [pid, d] of active) rows.push({ icon: pid, title: d.name, sub: `${d.desc}   |   ${fmtTime(secondsLeft(d.buff))} left`, fg: '#ffd75e' });
    rows.push({ section: 'Potions' });
    const owned = Object.entries(P.potions).filter(([, q]) => q > 0);
    if (!owned.length) rows.push({ title: 'No potions. Brew some at the Cauldron.' });
    for (const [pid, q] of owned) { const d = D.POTIONS[pid]; rows.push({ icon: pid, title: `${d.name}  x${q}`, sub: d.desc, buttons: [[d.heal !== undefined ? 'Use' : 'Drink', () => actDrink(pid), true]] }); }
  }
  return { header: 'Backpack', rows };
}
function bStats() {
  const pres = P.prestige, prof = combatProfile();
  const rows = [{ title: `${cap(prof.style)} build   ATK ${prof.attack}   DEF ${prof.defense}   |   Max HP ${P.max_hp}`,
    sub: `Kills ${P.stats.kills}   |   Boss kills ${P.stats.boss_kills}   |   Lifetime sales ${fmt(P.stats.gold_earned)}g\nAscensions ${pres.count}   |   AP ${pres.ap}` }, { section: 'Skills' }];
  for (const [skill, xp] of Object.entries(P.xp)) {
    const lvl = getLevel(xp), [lo, hi] = xpBounds(lvl);
    rows.push({ title: `${cap(skill)}   Level ${lvl}`, sub: `${xp - lo}/${hi - lo} XP`, bar: [xp - lo, hi - lo, '#4ec9ff'] });
  }
  rows.push({ section: 'Machines' });
  for (const [key, label] of Object.entries(D.MACHINES)) rows.push({ title: `${label}   x${P.automation[key]}`, sub: `Efficiency Lv ${P.auto_eff[key]}` });
  return { header: 'Character', rows };
}
function openPanel(key, title, builder, opts) {
  if (UI.panel) { if (UI.panel.key === key) { UI.panel.refresh(); return UI.panel; } UI.panel.close(); }
  return new Panel(key, title, builder, opts).init();
}
function openGather(skill) {
  if (UI.panel) { if (UI.panel.key === skill) return UI.panel; UI.panel.close(); }
  const p = new GatherPanel(skill); p.init(); return p;
}
const STATION_ACTIONS = {
  forest: () => openGather('woodcutting'), quarry: () => openGather('mining'), pond: () => openGather('fishing'),
  furnace: () => openPanel('furnace', 'Furnace', bSmelt), anvil: () => openPanel('anvil', 'Anvil & Crafting', bCraft),
  cauldron: () => openPanel('cauldron', 'Alchemy Cauldron', bBrew), kitchen: () => openPanel('kitchen', 'Kitchen', bCook),
  farm: () => openPanel('farm', 'Farm', bFarm, { live: true }), shop: () => openPanel('shop', 'Trading Post', bShop),
  quests: () => openPanel('quests', 'Quest Board', bQuests), factory: () => openPanel('factory', 'Passive Tool Factory', bFactory),
  altar: () => openPanel('altar', 'Ascension Altar', bAltar),
  dungeon: () => { UI.area = null; openPanel('dungeon', 'Adventure Gate', bDungeon); },
  boss: () => openPanel('boss', 'Boss Lair', bBoss, { live: true }),
};

/* ---------------- battle screen ---------------- */
const BW = 720, BH = 400;
function startBattle(battle) {
  if (!battle) return null;
  if (UI.panel) UI.panel.close();
  UI.battle = new BattleUI(battle);
  return 'close';
}
class BattleUI {
  constructor(battle) {
    this.b = battle; this.busy = false; this.finished = false; this.alive = true; this.t = 0;
    this.php = P.hp; this.ehp = battle.enemy.hp; this.hx = 0; this.ex = 0; this.shield = 0; this.proj = null; this.pops = []; this.lines = null;
    this.cv = h('canvas', { width: BW, height: BH, class: 'bcanvas' });
    this.pen = new Pen(this.cv.getContext('2d'));
    this.bar1 = h('div', { class: 'bbar' }); this.bar2 = h('div', { class: 'bbar' }); this.bar3 = h('div', { class: 'bbar' });
    this.win = h('div', { class: 'modal battle' }, h('div', { class: 'mtitle' }, h('span', {}, 'Battle - ' + battle.enemy.name)), this.cv, this.bar1, this.bar2, this.bar3);
    this.root = h('div', { class: 'modal-back' }, this.win);
    $('modal-root').append(this.root);
    this.keyFn = e => this.onKey(e); document.addEventListener('keydown', this.keyFn, true);
    this.rebuildBars();
    this.frame = () => { if (!this.alive) return; this.draw(); this.raf = requestAnimationFrame(this.frame); };
    this.raf = requestAnimationFrame(this.frame);
  }
  close() {
    if (!this.alive) return;
    this.alive = false; cancelAnimationFrame(this.raf); document.removeEventListener('keydown', this.keyFn, true);
    this.root.remove(); UI.battle = null; afterAction();
  }
  /* --- drawing --- */
  draw() {
    this.t += 1;
    const p = this.pen, c = p.c, boss = !!this.b.bossId, e = this.b.enemy;
    const top = boss ? [30, 20, 50] : [110, 170, 230], bot = boss ? [80, 50, 90] : [190, 225, 245];
    for (let i = 0; i < 18; i++) {
      const f = i / 17, col = `rgb(${top.map((v, k) => Math.trunc(v + (bot[k] - v) * f)).join(',')})`;
      p.R(0, i * 15, BW, i * 15 + 16, col);
    }
    p.R(0, 270, BW, BH, boss ? '#2b2438' : '#4f8a3c');
    for (const ex of [170, 540]) p.O(ex - 70, 273, ex + 70, 299, boss ? '#1a1424' : '#1d2b18');
    const bob = Math.sin(this.t / 20) * 3;
    drawHero(p, 170 + this.hx, 235 + bob, 2.6, heroGear());
    drawEnemy(p, e.sprite, 540 + this.ex, 232 - bob, e.sprite.scale || 1.5);
    if (this.shield > this.t) { c.beginPath(); c.ellipse(170, 220, 60, 70, 0, 0, Math.PI * 2); c.strokeStyle = '#4fd1ff'; c.lineWidth = 4; c.stroke(); }
    if (this.proj) p.L(this.proj.x, this.proj.y, this.proj.x + 30, this.proj.y, '#e8e0c0', 3);
    this.hud(p);
    const tnow = performance.now();
    this.pops = this.pops.filter(q => tnow - q.t0 < 800);
    for (const q of this.pops) { const k = (tnow - q.t0) / 800; c.globalAlpha = 1 - k * k; p.T(q.x, q.y - k * 44, q.text, q.color, q.size); c.globalAlpha = 1; }
    if (this.finished && this.lines) this.overlay(p);
  }
  hud(p) {
    const mhp = P.max_hp, prof = combatProfile(), e = this.b.enemy;
    p.T(30, 14, 'YOU  -  ' + prof.style.toUpperCase(), '#7cfc9a', 13, 'left');
    p.R(30, 26, 290, 42, '#111111', '#000000'); p.R(30, 26, 30 + 260 * Math.max(0, this.php) / Math.max(1, mhp), 42, '#3ddc84');
    p.T(160, 34, `${Math.max(0, this.php)}/${mhp}`, '#ffffff', 11);
    for (let i = 0; i < 10; i++) p.R(30 + i * 26, 50, 30 + i * 26 + 22, 60, i < this.b.energy ? '#3fc1ff' : '#1b2a35', '#0b1a24');
    let info = `ATK ${prof.attack}   DEF ${prof.defense}`;
    if (prof.style === 'ranged') info += '   Arrows: ' + (prof.ammo ? `${qty(prof.ammo)} (${itemName(prof.ammo)})` : 'NONE');
    p.T(30, 74, info, '#cfe8ff', 11, 'left');
    p.T(430, 14, e.name + (e.element ? `   [${e.element.toUpperCase()}]` : ''), D.ELEMENT_COLORS[e.element] || '#ff7b7b', 13, 'left');
    p.R(430, 26, 690, 42, '#111111', '#000000'); p.R(430, 26, 430 + 260 * Math.max(0, this.ehp) / this.b.maxHp, 42, '#e5484d');
    p.T(560, 34, `${Math.max(0, this.ehp)}/${this.b.maxHp}`, '#ffffff', 11);
    if (!this.finished) {
      const [text, col] = D.INTENTS[this.b.intent];
      p.R(430, 48, 690, 70, '#000000', col); p.T(560, 59, 'Next: ' + text, col, 11);
    }
  }
  overlay(p) {
    const col = { win: '#ffd75e', lose: '#ff7b7b', flee: '#9ad4ff' }[this.b.result], title = { win: 'VICTORY!', lose: 'DEFEATED', flee: 'ESCAPED' }[this.b.result];
    p.c.globalAlpha = 0.75; p.R(120, 80, 600, 300, '#000000'); p.c.globalAlpha = 1; p.R(120, 80, 600, 300, '', col, 3);
    p.T(360, 115, title, col, 30);
    this.lines.slice(0, 6).forEach((l, n) => p.T(360, 160 + n * 22, l, '#ffffff', 13));
  }
  pop(x, y, text, color, size = 16) { this.pops.push({ x, y, text, color, size, t0: performance.now() }); }
  /* --- tweening --- */
  tween(key, to, ms) {
    return new Promise(res => {
      const from = this[key], t0 = performance.now();
      const step = () => { if (!this.alive) return res(); const k = Math.min(1, (performance.now() - t0) / ms); this[key] = from + (to - from) * k; k < 1 ? requestAnimationFrame(step) : res(); };
      step();
    });
  }
  async shake(key) { for (const d of [8, -8, 6, -6, 0]) { this[key] = d; await sleep(40); } }
  /* --- buttons --- */
  rebuildBars() {
    const ranged = combatProfile().style === 'ranged';
    this.bar1.replaceChildren(...[['a', ranged ? 'Shoot (A)' : 'Attack (A)', '#3d7de0'], ['p', ranged ? 'Power Shot (P)' : 'Power Strike (P)', '#d9822b'], ['g', 'Guard (G)', '#2e9e8f'], ['f', 'Flee (F)', '#7a7f8c']]
      .map(([k, label, bg]) => h('button', { style: { background: bg }, onclick: () => this.act(k) }, label)));
    this.heals = healSources().slice(0, 4);
    this.bar2.replaceChildren(...(this.heals.length ? this.heals.map((s, i) => h('button', { class: 'heal', onclick: () => this.act('e', s) }, `[${i + 1}] ${healLabel(s)}`))
      : [h('span', { class: 'muted' }, 'No food or healing potions')]));
    this.bar3.replaceChildren(...D.LOADOUT_KEYS.map((key, i) => {
      const lo = P.loadouts[i], active = loadoutMatches(lo);
      return h('button', { class: 'lo' + (active ? ' on' : ''), disabled: !lo, onclick: () => this.swap(i) }, `[${key}] ` + (lo ? loadoutSummary(lo).split(',')[0].slice(0, 16) : 'empty'));
    }));
    this.setButtons(!this.busy && !this.finished);
  }
  setButtons(en) {
    for (const bar of [this.bar1, this.bar2]) for (const b of bar.querySelectorAll('button')) b.disabled = !en;
    this.bar3.querySelectorAll('button').forEach((b, i) => { b.disabled = !en || !P.loadouts[i]; });
  }
  onKey(e) {
    if (!this.alive) return;
    const k = keyName(e);
    if (this.finished) { if (k === 'enter' || k === ' ' || k === 'escape') { e.preventDefault(); this.close(); } return; }
    e.preventDefault(); e.stopPropagation();
    if ('apgf'.includes(k) && k.length === 1) this.act(k);
    else if ('1234'.includes(k) && k.length === 1) { const s = this.heals[+k - 1]; if (s) this.act('e', s); }
    else if (D.LOADOUT_KEYS.includes(k)) this.swap(D.LOADOUT_KEYS.indexOf(k));
  }
  swap(i) {
    if (this.busy || this.finished || !this.alive) return;
    if (!applyLoadout(i)) return;
    this.rebuildBars(); this.pop(170, 130, `Loadout ${D.LOADOUT_KEYS[i]}`, '#ffd75e', 15);
  }
  /* --- turn flow --- */
  async act(action, food) {
    if (this.busy || this.finished || !this.alive) return;
    const ev = this.b.act(action, food);
    if (!ev) return;
    this.busy = true; this.setButtons(false);
    for (const e of ev) { if (!this.alive) return; await this['ev_' + e[0]](e); await sleep(120); }
    this.busy = false;
    if (this.b.result) return this.finish();
    this.rebuildBars();
  }
  async ev_pdmg([, dmg, crit, ehp, power, style]) {
    const hit = () => { this.ehp = ehp; this.pop(540, 150, `-${dmg}` + (crit ? '!' : ''), crit ? '#ff66ff' : '#ffe066', crit ? 24 : 18); this.shake('ex'); };
    if (style === 'ranged') {
      this.proj = { x: 205, y: 222 }; await this.tween2(this.proj, 'x', 515, 330); this.proj = null; hit();
    } else { const d = power ? 126 : 90; await this.tween('hx', d, 200); hit(); await this.tween('hx', 0, 200); }
  }
  tween2(obj, key, to, ms) {
    return new Promise(res => { const from = obj[key], t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); obj[key] = from + (to - from) * k; k < 1 ? requestAnimationFrame(step) : res(); }; step(); });
  }
  async ev_pguard() { this.shield = this.t + 40; this.pop(170, 140, 'Guard!', '#4fd1ff'); await sleep(350); }
  async ev_pheal([, healed, hp]) { this.php = hp; this.pop(170, 140, `+${healed}`, '#7cfc9a', 18); await sleep(300); }
  async ev_emend([, amount, ehp]) { this.ehp = ehp; this.pop(540, 150, `+${amount}`, '#7cfc9a', 18); await sleep(300); }
  async ev_edmg([, dmg, guarded, intent, php]) {
    await this.tween('ex', -100, 200); this.php = php;
    this.pop(170, 140, `-${dmg}`, guarded ? '#4fd1ff' : (D.ELEMENT_COLORS[this.b.enemy.element] || '#ff7b7b'), 18);
    this.shake('hx'); await this.tween('ex', 0, 200);
  }
  async ev_enrage() { this.pop(540, 120, 'ENRAGED!', '#ff3b3b', 26); await sleep(500); }
  async ev_flee_ok() { this.pop(170, 140, 'Escaped!', '#9ad4ff', 20); await sleep(400); }
  async ev_flee_fail() { this.pop(170, 140, "Can't escape!", '#ffb347', 18); await sleep(400); }
  finish() {
    this.finished = true; this.lines = battleRewards(this.b); afterAction();
    this.bar1.replaceChildren(h('button', { class: 'go', onclick: () => this.close() }, 'Continue'));
    this.bar2.replaceChildren(); this.bar3.replaceChildren();
  }
}
