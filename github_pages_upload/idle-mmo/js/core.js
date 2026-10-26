'use strict';
/* =====================================================================
   Idle MMO - core game logic (no DOM). Ported 1:1 from the Python game.
   ===================================================================== */
const C = D.CONST;
let P = null;               // the player's save data
let timeOffset = 0;         // (server time - client time) in seconds
const now = () => Date.now() / 1000 + timeOffset;
const clone = o => JSON.parse(JSON.stringify(o));
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const choice = a => a[Math.floor(Math.random() * a.length)];
const stoch = x => { const n = Math.floor(x); return n + (Math.random() < x - n ? 1 : 0); };
const GOOD = '#7cfc9a', BAD = '#ff7b7b', INFO = '#9ad4ff', GOLD = '#ffd75e', MAGIC = '#e3a8ff', WHITE = '#f2f4f8';
const LOG = [];
function say(text, color) { LOG.push([now(), text, color || WHITE]); if (LOG.length > 40) LOG.shift(); }

/* ---------------- save data ---------------- */
const kindOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
function mergeDefaults(data, defs) {
  for (const k of Object.keys(defs)) {
    const dv = defs[k];
    if (!(k in data) || kindOf(data[k]) !== kindOf(dv)) data[k] = clone(dv);
    else if (kindOf(dv) === 'object') mergeDefaults(data[k], dv);
  }
  return data;
}
function migrateEquipment() {
  const nameToId = {};
  for (const [i, d] of Object.entries(D.EQUIPMENT)) nameToId[d.name] = i;
  const eq = P.equipment, defs = D.default_player.equipment;
  for (const slot of Object.keys(defs)) {
    let val = eq[slot] || '';
    val = nameToId[val] || val;
    const ok = slot === 'ammo'
      ? (val === '' || (D.ITEMS[val] && D.ITEMS[val].ammo !== undefined))
      : (val === '' || (D.EQUIPMENT[val] && D.EQUIPMENT[val].slot === slot));
    eq[slot] = ok ? val : defs[slot];
    if (eq[slot] && slot !== 'ammo' && qty(eq[slot]) < 1) P.inventory[eq[slot]] = 1;
  }
  while (P.loadouts.length < 6) P.loadouts.push(null);
  P.loadouts.length = 6;
}
function sanitizeEquipment() {
  for (const [slot, item] of Object.entries(P.equipment)) if (item && qty(item) < 1) P.equipment[slot] = '';
}
function loadPlayer(obj) {
  const isObj = obj && typeof obj === 'object' && !Array.isArray(obj);
  const legacy = isObj && Object.keys(obj).length > 0 && (obj.balance_v || 1) < 2;
  P = mergeDefaults(isObj ? obj : {}, clone(D.default_player));
  const need = ['event', 'text', 'target', 'progress', 'gold', 'skill', 'xp', 'done'];
  P.quests = P.quests.filter(q => q && typeof q === 'object' && need.every(k => k in q));
  migrateEquipment();
  if (legacy) {
    const base = D.default_player.automation_costs;
    for (const k of Object.keys(D.MACHINES)) {
      const owned = Math.min(P.automation[k] || 0, C.MAX_MACHINES);
      P.automation[k] = owned;
      P.automation_costs[k] = Math.trunc(base[k] * C.COST_GROWTH ** owned);
    }
    P.auto_acc = {}; for (const k of Object.keys(D.MACHINES)) P.auto_acc[k] = 0;
    P.balance_v = 2;
  }
  const patch = P.farm_patch;
  if (patch.grow_time_left !== undefined) {
    if (patch.crop !== 'None' && patch.grow_time_left) patch.ready_at = now() + patch.grow_time_left;
    delete patch.grow_time_left;
  }
  for (const k of ['last_tick_time', 'last_smelt_time', 'last_regen']) if (!P[k]) P[k] = now();
  sanitizeEquipment(); ensureQuests(); refreshMaxHp();
}

/* ---------------- helpers ---------------- */
const getLevel = xp => Math.floor(Math.sqrt(xp / 100)) + 1;
const xpBounds = lvl => [100 * (lvl - 1) ** 2, 100 * lvl ** 2];
const skillLevel = s => getLevel(P.xp[s]);
const fightLevel = () => Math.max(skillLevel('combat'), skillLevel('archery'));
const totalLevels = () => Object.values(P.xp).reduce((a, x) => a + getLevel(x), 0);
const up = k => P.prestige.upgrades[k] || 0;
const qty = id => P.inventory[id] || 0;
function itemName(id) {
  const d = D.ITEMS[id] || D.EQUIPMENT[id] || D.POTIONS[id];
  return d ? d.name : id.replace(/_/g, ' ');
}
const canAfford = cost => Object.entries(cost).every(([i, q]) => qty(i) >= q);
const spend = cost => { for (const [i, q] of Object.entries(cost)) P.inventory[i] -= q; };
const costStr = cost => Object.entries(cost).map(([i, q]) => `${q} ${itemName(i)} (have ${qty(i)})`).join(' + ');
const buffActive = b => now() < (P.active_buffs[b] || 0);
const secondsLeft = b => Math.max(0, Math.trunc((P.active_buffs[b] || 0) - now()));
function fmtTime(sec) {
  sec = Math.max(0, Math.trunc(sec));
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor(sec % 3600 / 60)}m`;
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}
const fmt = n => Math.trunc(n).toLocaleString('en-US');
const eqDef = slot => D.EQUIPMENT[P.equipment[slot] || ''] || {};
const gearTier = slot => eqDef(slot).tier || 0;
const toolSpeed = slot => slot ? (eqDef(slot).speed || 1.0) : 1.0;
function gatherTime(skill, node) {
  let t = node.time * toolSpeed(D.GATHERING[skill].tool);
  if (buffActive('gatherer_until')) t *= 0.7;
  return Math.max(0.5, t);
}
function dropChance(c) { return (c < 1.0 && buffActive('fortune_until')) ? Math.min(0.95, c * 1.5) : c; }
const xpMultiplier = () => (1 + 0.10 * up('xp_boost')) * (1 + 0.05 * P.prestige.count) * (buffActive('scholar_until') ? 1.25 : 1);
const goldMultiplier = () => (1 + 0.10 * up('gold_boost')) * (1 + 0.05 * P.prestige.count) * (buffActive('midas_until') ? 2 : 1);
const autoMultiplier = k => (1 + 0.10 * P.auto_eff[k]) * (1 + 0.05 * up('auto_boost'));
const effectiveUnits = n => n > 0 ? (1 - 0.85 ** n) / 0.15 : 0;
const tickSpeedFactor = () => 0.98 ** P.auto_tools.tick_speed;
const offlineCap = () => (C.BASE_OFFLINE_HOURS + P.auto_tools.warehouse + up('offline')) * 3600;
function getMaxHp() {
  let hp = 100 + 20 * up('vitality') + 2 * (fightLevel() - 1);
  hp += (eqDef('amulet').hp || 0) + (eqDef('ring').hp || 0);
  if (buffActive('vitality_until')) hp += 50;
  return hp;
}
function refreshMaxHp() { P.max_hp = getMaxHp(); P.hp = Math.max(0, Math.min(P.hp, P.max_hp)); }
function currentAmmo() {
  const cur = P.equipment.ammo || '';
  if (cur && qty(cur) > 0) return cur;
  let best = null;
  for (const [id, d] of Object.entries(D.ITEMS)) {
    if (d.ammo !== undefined && qty(id) > 0 && (best === null || d.ammo > D.ITEMS[best].ammo)) best = id;
  }
  P.equipment.ammo = best || '';
  return best;
}
function combatProfile() {
  const wd = eqDef('weapon');
  const w = wd && wd.style ? wd : D.FISTS;
  const style = w.style, skill = style === 'ranged' ? 'archery' : 'combat', level = skillLevel(skill);
  let attack = w.atk + Math.floor(level / 2) + (eqDef('ring').atk || 0), ammo = null, crit;
  if (style === 'ranged') {
    ammo = currentAmmo();
    attack += ammo ? D.ITEMS[ammo].ammo : 0;
    if (buffActive('focus_until')) attack = Math.trunc(attack * 1.3);
    crit = Math.min(0.40, 0.10 + 0.006 * level);
  } else {
    if (buffActive('strength_until')) attack = Math.trunc(attack * 1.3);
    crit = Math.min(0.30, 0.05 + 0.005 * level);
  }
  const defense = (eqDef('armor').def || 0) + (eqDef('amulet').def || 0) + Math.floor(level / 10) + (buffActive('ironhide_until') ? 6 : 0);
  return { style, skill, attack, defense, crit, ammo };
}
function addXp(skill, amount) {
  const gained = Math.max(1, Math.trunc(amount * xpMultiplier()));
  const old = getLevel(P.xp[skill]);
  P.xp[skill] += gained;
  const nw = getLevel(P.xp[skill]);
  if (nw > old) {
    say(`LEVEL UP! ${cap(skill)} is now level ${nw}!`, MAGIC);
    if (skill === 'combat' || skill === 'archery') refreshMaxHp();
  }
  track('xp:' + skill, gained);
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function addItem(id, amount, quest = true) {
  if (amount <= 0) return;
  P.inventory[id] = qty(id) + amount;
  if (quest) track('gain:' + id, amount);
}

/* ---------------- quests ---------------- */
function track(event, amount = 1) {
  for (const q of P.quests || []) {
    if (q.event === event && !q.done) {
      q.progress = Math.min(q.target, q.progress + amount);
      if (q.progress >= q.target) { q.done = true; say(`Quest complete: ${q.text} (claim it at the Quest Board)`, GOLD); }
    }
  }
}
function questAvailable(t) {
  if (t.need === 'furnace') return P.furnace_tier !== 'None';
  if (t.need === 'boss') return fightLevel() >= D.BOSSES.slime_king.req;
  return true;
}
function makeQuest(exclude) {
  const tier = 1 + Math.floor(totalLevels() / 25);
  const pool = D.QUEST_TEMPLATES.filter(t => !exclude.has(t.event) && questAvailable(t));
  const t = choice(pool);
  const scale = t.scale !== undefined ? t.scale : 0.6;
  const target = Math.max(1, Math.trunc(t.base * (1 + scale * (tier - 1))));
  const gold = Math.max(10, Math.trunc(target * t.unit));
  const xp = t.skill ? Math.trunc(gold * 0.5) : 0;
  return { event: t.event, text: t.desc.replace('{n}', target), target, progress: 0, gold, skill: t.skill, xp, done: false };
}
function ensureQuests() {
  while (P.quests.length < C.QUEST_SLOTS) P.quests.push(makeQuest(new Set(P.quests.map(q => q.event))));
}
function claimQuest(i) {
  const q = P.quests[i];
  if (!q || !q.done) { say("That quest isn't finished yet.", BAD); return null; }
  P.gold += q.gold;
  if (q.skill && q.xp) addXp(q.skill, q.xp);
  say(`Quest reward: +${q.gold}g` + (q.xp ? `, +${q.xp} ${q.skill} XP` : ''), GOLD);
  P.quests.splice(i, 1); ensureQuests();
  return `+${q.gold}g`;
}
function claimAllQuests() {
  let total = 0;
  for (let i = P.quests.length - 1; i >= 0; i--) if (P.quests[i].done) { total += P.quests[i].gold; claimQuest(i); }
  if (!total) { say('Nothing ready to claim.', BAD); return null; }
  return `+${total}g`;
}
function rerollQuest(i) {
  if (P.gold < C.QUEST_REROLL_COST) { say('Not enough gold to reroll.', BAD); return null; }
  P.gold -= C.QUEST_REROLL_COST;
  P.quests[i] = makeQuest(new Set(P.quests.filter((_, j) => j !== i).map(q => q.event)));
  say('Quest rerolled.', INFO);
  return 'Rerolled';
}

/* ---------------- idle / automation ---------------- */
function processRegen() {
  const t = now(), last = P.last_regen;
  if (last <= 0 || last > t) { P.last_regen = t; return; }
  const per = C.REGEN_SECONDS_PER_HP / (buffActive('regen_until') ? 4 : 1);
  const pts = Math.floor((t - last) / per);
  if (pts > 0) { P.last_regen = last + pts * per; P.hp = Math.min(P.max_hp, P.hp + pts); }
}
function processGatherTicks(report) {
  const t = now();
  const last = Math.max(P.last_tick_time, t - offlineCap());
  let rate = C.BASE_TICK * tickSpeedFactor();
  if (buffActive('haste_until')) rate /= C.HASTE_FACTOR;
  let ticks = Math.floor((t - last) / rate);
  if (ticks <= 0) { P.last_tick_time = last; return; }
  const away = (t - last) > C.AWAY_SECONDS;
  P.last_tick_time = last + ticks * rate;
  if (away) {
    ticks = Math.trunc(ticks * C.OFFLINE_EFFICIENCY);
    if (Object.values(P.automation).some(v => v > 0)) report.push(`You were away - machines worked at ${Math.trunc(C.OFFLINE_EFFICIENCY * 100)}% efficiency.`);
  }
  for (const [key, units] of Object.entries(P.automation)) {
    if (units <= 0) { P.auto_acc[key] = 0; continue; }
    P.auto_acc[key] += ticks;
    const every = D.AUTO_EVERY[key];
    const cycles = Math.floor(P.auto_acc[key] / every);
    P.auto_acc[key] -= cycles * every;
    if (cycles <= 0) continue;
    const mult = autoMultiplier(key);
    const jobs = stoch(effectiveUnits(units) * cycles);
    const [item, per] = D.AUTO_OUT[key];
    const n = stoch(jobs * per * mult);
    addItem(item, n, false);
    const binom = p => { let c = 0; for (let i = 0; i < jobs; i++) if (Math.random() < p) c++; return c; };
    if (key === 'auto_chopper') { addXp('woodcutting', 2 * jobs); report.push(`Auto-Choppers harvested ${n}x Oak Logs`); }
    else if (key === 'auto_miner') {
      addXp('mining', 2 * jobs);
      const cu = stoch(binom(0.25) * mult); addItem('copper_ore', cu, false);
      report.push(`Auto-Miners dug up ${n}x Raw Stone` + (cu ? ` and ${cu}x Copper Ore` : ''));
    } else if (key === 'auto_fisher') { addXp('fishing', 2 * jobs); report.push(`Auto-Fishers reeled in ${n}x Raw Shrimp`); }
    else {
      addXp('combat', 3 * jobs);
      const b = stoch(binom(0.30) * mult); addItem('bones', b, false);
      report.push(`Auto-Scavengers gathered ${n}x Slime Balls` + (b ? ` and ${b}x Bones` : ''));
    }
  }
}
function smeltOnce(auto = false) {
  const lvl = skillLevel('smelting');
  for (const [ore, bar, xp, req] of D.SMELT) {
    if (lvl >= req && qty(ore) >= 2) {
      P.inventory[ore] -= 2; addItem(bar, 1, !auto);
      addXp('smelting', auto ? Math.floor(xp / 2) : xp);
      return bar;
    }
  }
  return null;
}
function processFurnace(report) {
  const t = now(), tier = P.furnace_tier;
  if (tier === 'None') { P.last_smelt_time = t; return; }
  const last = Math.max(P.last_smelt_time, t - offlineCap());
  const speed = C.FURNACE_SPEED[tier] * tickSpeedFactor();
  let ticks = Math.floor((t - last) / speed);
  if (ticks <= 0) { P.last_smelt_time = last; return; }
  P.last_smelt_time = last + ticks * speed;
  if ((t - last) > C.AWAY_SECONDS) ticks = Math.trunc(ticks * C.OFFLINE_EFFICIENCY);
  const made = {};
  for (let i = 0; i < ticks; i++) { const b = smeltOnce(true); if (b === null) break; made[b] = (made[b] || 0) + 1; }
  for (const [b, n] of Object.entries(made)) report.push(`Furnace produced ${n}x ${itemName(b)}`);
}
function processFarm(report) {
  const p = P.farm_patch;
  if (p.crop !== 'None' && !p.notified && now() >= p.ready_at) { p.notified = true; report.push(`Your ${p.crop} is ready to harvest!`); }
}
function processIdleTime() {
  const report = [];
  processGatherTicks(report); processFurnace(report); processFarm(report); processRegen();
  return report;
}

/* ---------------- actions: return a short string, or null on failure ---------------- */
function actGatherOnce(skill, idx) {
  const node = D.GATHERING[skill].nodes[idx];
  if (skillLevel(skill) < node.level) { say(`You need ${skill} level ${node.level}.`, BAD); return null; }
  addItem(node.item, node.qty); addXp(skill, node.xp);
  for (const [item, chance, q] of node.drops) {
    if (Math.random() < dropChance(chance)) { addItem(item, q); say(`Bonus find: +${q} ${itemName(item)}!`, GOLD); }
  }
  return `+${node.qty} ${itemName(node.item)}`;
}
function actSmelt(idx, times = 1) {
  if (P.furnace_tier === 'None') { say('You need a furnace - craft one at the Anvil.', BAD); return null; }
  const [ore, bar, xp, req] = D.SMELT[idx];
  if (skillLevel('smelting') < req) { say(`You need smelting level ${req}.`, BAD); return null; }
  let done = 0;
  for (let i = 0; i < times; i++) {
    if (qty(ore) < 2) break;
    P.inventory[ore] -= 2; addItem(bar, 1); addXp('smelting', xp); done++;
  }
  if (!done) { say(`You need 2 ${itemName(ore)}.`, BAD); return null; }
  const text = `+${done} ${itemName(bar)}`; say(text, GOOD); return text;
}
function recipeBlocked(r) {
  if (r.kind === 'furnace' && P.furnace_tier !== r.requires) return 'Not available';
  if (r.kind === 'gear' && qty(r.id) > 0) return 'Owned';
  return '';
}
function maybeAutoequip(id) {
  const d = D.EQUIPMENT[id], slot = d.slot, cur = eqDef(slot);
  if (slot === 'weapon' && cur.style && cur.style !== d.style) return false;
  if (!cur.slot || d.tier > (cur.tier || 0)) { P.equipment[slot] = id; return true; }
  return false;
}
function actCraft(idx) {
  const r = D.CRAFT[idx], reason = recipeBlocked(r);
  if (reason) { say(`${r.name}: ${reason.toLowerCase()}.`, BAD); return null; }
  if (!canAfford(r.cost)) { say('Missing materials.', BAD); return null; }
  spend(r.cost); addXp('crafting', r.xp); track('crafts', 1);
  if (r.kind === 'furnace') P.furnace_tier = r.name;
  else if (r.kind === 'gear') {
    addItem(r.id, 1);
    const eqd = maybeAutoequip(r.id); refreshMaxHp();
    say(`Crafted ${r.name}!` + (eqd ? ' Equipped.' : ' Equip it from your backpack (I).'), GOOD);
    return `${r.name}!`;
  } else if (r.kind === 'ammo') { addItem(r.output, r.qty); currentAmmo(); }
  else addItem(r.output, 1);
  say(`Crafted ${r.name}!`, GOOD);
  return `${r.name}!`;
}
function actSpecial(kind) {
  const item = kind === 'G' ? 'geode' : 'birds_nest';
  if (qty(item) < 1) { say(`You don't have a ${itemName(item)}.`, BAD); return null; }
  P.inventory[item] -= 1;
  const loot = choice(kind === 'G' ? ['stone', 'copper_ore', 'iron_ore', 'ruby'] : ['fungus_spores', 'scale_seeds', 'logs', 'feather']);
  const n = loot === 'feather' ? 5 : 2;
  addItem(loot, n); say(`Opened it: +${n} ${itemName(loot)}`, GOLD);
  return `+${n} ${itemName(loot)}`;
}
function actBrew(idx) {
  const r = D.BREW[idx];
  if (skillLevel('brewing') < r.level) { say(`You need brewing level ${r.level}.`, BAD); return null; }
  if (!canAfford(r.cost)) { say('Lacking components.', BAD); return null; }
  spend(r.cost); P.potions[r.potion] += 1; addXp('brewing', r.xp);
  const name = D.POTIONS[r.potion].name;
  say(`Brewed 1x ${name}!`, MAGIC); return `+1 ${name}`;
}
function actDrink(pid) {
  const p = D.POTIONS[pid];
  if ((P.potions[pid] || 0) < 1) return null;
  if (p.heal !== undefined) {
    if (P.hp >= P.max_hp) { say("You're already at full health.", BAD); return null; }
    P.potions[pid] -= 1;
    const before = P.hp; P.hp = Math.min(P.max_hp, P.hp + p.heal);
    say(`${p.name}: recovered ${P.hp - before} HP.`, GOOD); return `+${P.hp - before} HP`;
  }
  P.potions[pid] -= 1;
  const start = Math.max(P.active_buffs[p.buff] || 0, now());
  P.active_buffs[p.buff] = start + p.duration;
  refreshMaxHp();
  say(`${p.name} active for ${fmtTime(secondsLeft(p.buff))}!`, MAGIC);
  return p.name;
}
function actCook(idx, times = 1) {
  const r = D.COOK[idx], level = skillLevel('cooking');
  if (level < r.level) { say(`You need cooking level ${r.level}.`, BAD); return null; }
  const burn = Math.max(0.05, 0.40 - level * 0.02);
  let cooked = 0, burnt = 0;
  for (let i = 0; i < times; i++) {
    if (qty(r.raw) < 1) break;
    P.inventory[r.raw] -= 1;
    if (Math.random() > burn) { addItem(r.cooked, 1); addXp('cooking', r.xp); cooked++; }
    else { addItem('burnt_fish', 1); burnt++; }
  }
  if (!cooked && !burnt) { say(`You have no ${itemName(r.raw)}.`, BAD); return null; }
  const text = `+${cooked} cooked` + (burnt ? `, ${burnt} burnt` : '');
  say(text, cooked ? GOOD : BAD); return text;
}
const foodsOwned = () => Object.entries(D.ITEMS).filter(([i, d]) => d.heal !== undefined && qty(i) > 0).map(([i]) => i);
function healSources() {
  const potions = Object.entries(D.POTIONS).filter(([p, d]) => d.heal !== undefined && (P.potions[p] || 0) > 0).map(([p]) => p);
  return foodsOwned().concat(potions);
}
function healLabel(src) {
  return D.POTIONS[src] ? `Drink ${itemName(src)} x${P.potions[src]}` : `Eat ${itemName(src)} x${qty(src)}`;
}
function useHeal(src) {
  if (D.POTIONS[src]) {
    if ((P.potions[src] || 0) < 1) return null;
    P.potions[src] -= 1;
    const before = P.hp; P.hp = Math.min(P.max_hp, P.hp + D.POTIONS[src].heal);
    return P.hp - before;
  }
  if (qty(src) < 1) return null;
  const heal = D.ITEMS[src].heal;
  P.inventory[src] -= 1;
  const before = P.hp;
  P.hp = Math.min(P.max_hp, P.hp + Math.trunc(heal * 0.8));
  P.hunger = Math.min(100, P.hunger + heal);
  return P.hp - before;
}
function actEat(food) {
  const h = useHeal(food);
  if (h === null) return null;
  say(`Yum! Recovered ${h} HP.`, GOOD); return `+${h} HP`;
}
function actPlant(idx) {
  const c = D.CROPS[idx];
  if (P.farm_patch.crop !== 'None') { say('The patch is already in use.', BAD); return null; }
  if (skillLevel('farming') < c.level) { say(`You need farming level ${c.level}.`, BAD); return null; }
  if (qty(c.seed) < 1) { say(`You have no ${itemName(c.seed)}.`, BAD); return null; }
  P.inventory[c.seed] -= 1;
  P.farm_patch = { crop: c.crop, ready_at: now() + c.time, notified: false };
  say(`Planted ${c.crop}.`, GOOD); return 'Planted';
}
function actHarvest() {
  const p = P.farm_patch;
  if (p.crop === 'None' || now() < p.ready_at) return null;
  const crop = D.CROPS.find(c => c.crop === p.crop);
  addItem(crop.item, crop.qty); addXp('farming', 150);
  P.farm_patch = { crop: 'None', ready_at: 0, notified: false };
  const text = `+${crop.qty} ${itemName(crop.item)}`; say(`Harvested ${text}`, GOOD); return text;
}
const sellableItems = () => Object.fromEntries(Object.entries(P.inventory).filter(([i, q]) => q > 0 && D.ITEMS[i]));
function actSell(id) {
  const mult = goldMultiplier(), sellable = sellableItems();
  const targets = id == null ? Object.keys(sellable) : (sellable[id] ? [id] : []);
  if (!targets.length) return null;
  let payout = 0;
  for (const i of targets) { payout += Math.trunc(sellable[i] * D.ITEMS[i].value * mult); P.inventory[i] = 0; }
  P.gold += payout; P.stats.gold_earned += payout;
  sanitizeEquipment(); track('sold_gold', payout);
  say(`Sold for ${payout}g`, GOLD); return `+${payout}g`;
}
/* equipment & loadouts */
function actEquip(id) {
  const d = D.EQUIPMENT[id];
  if (!d || qty(id) < 1) return null;
  P.equipment[d.slot] = id;
  if (d.style === 'ranged') currentAmmo();
  refreshMaxHp(); say(`Equipped ${d.name}.`, GOOD); return d.name;
}
function actUnequip(slot) {
  if (!P.equipment[slot]) return null;
  P.equipment[slot] = ''; refreshMaxHp(); say(`Unequipped ${slot}.`, INFO); return 'Unequipped';
}
function actSetAmmo(id) {
  if (qty(id) < 1) return null;
  P.equipment.ammo = id; say(`Using ${itemName(id)} as ammo.`, GOOD); return itemName(id);
}
function actSaveLoadout(i) {
  const lo = {}; for (const f of D.LOADOUT_FIELDS) lo[f] = P.equipment[f] || '';
  P.loadouts[i] = lo; say(`Saved current gear to loadout ${D.LOADOUT_KEYS[i]}.`, GOOD); return `Saved [${D.LOADOUT_KEYS[i]}]`;
}
function actClearLoadout(i) { P.loadouts[i] = null; say(`Cleared loadout ${D.LOADOUT_KEYS[i]}.`, INFO); return 'Cleared'; }
function applyLoadout(i) {
  const lo = P.loadouts[i];
  if (!lo) { say(`Loadout ${D.LOADOUT_KEYS[i]} is empty.`, BAD); return false; }
  for (const slot of D.LOADOUT_FIELDS) { const it = lo[slot] || ''; P.equipment[slot] = (it && qty(it) > 0) ? it : ''; }
  if (eqDef('weapon').style === 'ranged') currentAmmo();
  refreshMaxHp(); say(`Loadout ${D.LOADOUT_KEYS[i]} equipped.`, INFO); return true;
}
const actEquipLoadout = i => applyLoadout(i) ? `Loadout ${D.LOADOUT_KEYS[i]}` : null;
function loadoutSummary(lo) {
  if (!lo) return '(empty)';
  const parts = ['weapon', 'armor', 'ammo'].filter(f => lo[f]).map(f => itemName(lo[f]));
  return parts.length ? parts.join(', ') : '(nothing equipped)';
}
const loadoutMatches = lo => !!lo && ['weapon', 'armor', 'ring', 'amulet'].every(f => (lo[f] || '') === (P.equipment[f] || ''));
/* factory */
function efficiencyCost(key) {
  const lvl = P.auto_eff[key], bars = {};
  if (lvl >= 3) bars.iron_bar = 2 * (lvl - 2);
  if (lvl >= 6) bars.gold_bar = 2 * (lvl - 5);
  return [Math.trunc(400 * 1.9 ** lvl), bars];
}
function toolUpgradeCost(key) {
  const lvl = P.auto_tools[key];
  if (key === 'tick_speed') return [Math.trunc(1000 * 2 ** lvl), lvl ? { iron_bar: 2 * lvl } : {}];
  return [Math.trunc(800 * 2 ** lvl), { copper_bar: 10 * (lvl + 1) }];
}
function buyWith(gold, bars) {
  if (P.gold < gold || !canAfford(bars)) { say("You can't afford that.", BAD); return false; }
  P.gold -= gold; spend(bars); return true;
}
function actBuyMachine(key) {
  if (P.automation[key] >= C.MAX_MACHINES) { say(`You can't run more than ${C.MAX_MACHINES} of those.`, BAD); return null; }
  const cost = P.automation_costs[key];
  if (!buyWith(cost, {})) return null;
  P.automation[key] += 1; P.automation_costs[key] = Math.trunc(cost * C.COST_GROWTH);
  say(`Bought a ${D.MACHINES[key]}!`, GOOD); return 'Bought';
}
function actUpgradeEff(key) {
  if (P.auto_eff[key] >= C.EFFICIENCY_MAX) return null;
  const [g, bars] = efficiencyCost(key);
  if (!buyWith(g, bars)) return null;
  P.auto_eff[key] += 1; say(`${D.MACHINES[key]} efficiency is now Lv ${P.auto_eff[key]}!`, GOOD); return 'Upgraded';
}
function actUpgradeTool(key) {
  const mx = key === 'tick_speed' ? C.TICK_SPEED_MAX : C.WAREHOUSE_MAX;
  if (P.auto_tools[key] >= mx) return null;
  const [g, bars] = toolUpgradeCost(key);
  if (!buyWith(g, bars)) return null;
  P.auto_tools[key] += 1; say(`Upgraded to Lv ${P.auto_tools[key]}!`, GOOD); return 'Upgraded';
}
/* prestige */
const ascendRequirement = () => 60 + 15 * P.prestige.count;
const ascendApGain = () => Math.max(1, Math.floor(totalLevels() / 12));
const apCost = key => D.AP_UPGRADES[key].base + up(key);
function actBuyAp(key) {
  const pres = P.prestige;
  if (up(key) >= D.AP_UPGRADES[key].max || pres.ap < apCost(key)) { say("Can't buy that upgrade.", BAD); return null; }
  pres.ap -= apCost(key); pres.upgrades[key] = up(key) + 1; refreshMaxHp();
  say(`${D.AP_UPGRADES[key].name} is now level ${up(key)}!`, MAGIC); return 'Upgraded';
}
function actAscend() {
  if (totalLevels() < ascendRequirement()) { say('You are not strong enough to ascend yet.', BAD); return null; }
  const gain = ascendApGain(), startGold = 200 + 500 * up('head_start');
  const keep = { prestige: P.prestige, stats: P.stats, boss_cd: P.boss_cd };
  keep.prestige.count += 1; keep.prestige.ap += gain;
  const t = now();
  P = Object.assign(clone(D.default_player), keep);
  P.gold = startGold;
  for (const k of ['last_tick_time', 'last_smelt_time', 'last_regen']) P[k] = t;
  refreshMaxHp(); P.hp = P.max_hp; ensureQuests();
  say(`You ascended! +${gain} Ascension Points.`, MAGIC);
  return `+${gain} AP`;
}

/* ---------------- battle engine (no UI) ---------------- */
class Battle {
  constructor(enemy, o = {}) {
    this.enemy = clone(enemy); this.maxHp = enemy.hp; this.baseAtk = enemy.atk;
    this.fleeChance = o.fleeChance ?? 0.75; this.hungerCost = o.hungerCost ?? 15;
    this.goldLoss = o.goldLoss ?? 0.15; this.bossId = o.bossId || null; this.mob = o.mob || null;
    this.energy = 3; this.turn = 0; this.enraged = false; this.newEnrage = false;
    this.result = null; this.hits = { combat: 0, archery: 0 };
    this.pickIntent();
  }
  pickIntent() {
    const e = this.enemy;
    this.intent = e.cycle ? e.pattern[this.turn % e.pattern.length] : choice(e.pattern);
    this.newEnrage = false;
    if (e.enrage && !this.enraged && e.hp <= this.maxHp * 0.3) {
      this.enraged = this.newEnrage = true; e.atk = Math.trunc(this.baseAtk * 1.3);
    }
  }
  act(action, food) {
    const ev = []; let guard = false; const e = this.enemy;
    if (action === 'a' || action === 'p') {
      const prof = combatProfile(), power = action === 'p';
      if (power && this.energy < 4) { say('Not enough energy for a power move.', BAD); return null; }
      if (prof.style === 'ranged') {
        const need = power ? 2 : 1, ammo = prof.ammo;
        if (!ammo || qty(ammo) < need) { say('Not enough arrows! Swap loadout (5-0) or flee.', BAD); return null; }
        P.inventory[ammo] -= need;
        if (qty(ammo) <= 0) sanitizeEquipment();
      }
      const mult = power ? 2.2 : 1.0;
      let dmg = prof.attack + rint(-2, 3);
      const crit = Math.random() < prof.crit;
      dmg = Math.max(1, Math.trunc(dmg * mult * (crit ? 1.75 : 1.0)));
      this.energy = power ? this.energy - 4 : Math.min(10, this.energy + 2);
      e.hp -= dmg; this.hits[prof.skill] += 1;
      ev.push(['pdmg', dmg, crit, Math.max(0, e.hp), power, prof.style]);
    } else if (action === 'g') {
      guard = true; this.energy = Math.min(10, this.energy + 3); ev.push(['pguard']);
    } else if (action === 'e') {
      const healed = food ? useHeal(food) : null;
      if (healed === null) return null;
      ev.push(['pheal', healed, P.hp]);
    } else if (action === 'f') {
      if (Math.random() < this.fleeChance) { this.result = 'flee'; return [['flee_ok']]; }
      ev.push(['flee_fail']);
    } else return null;

    if (e.hp <= 0) { this.result = 'win'; return ev; }
    const intent = this.intent;
    if (intent === 'mend') {
      const heal = Math.trunc(this.maxHp * 0.12); e.hp = Math.min(this.maxHp, e.hp + heal); ev.push(['emend', heal, e.hp]);
    } else {
      const defense = combatProfile().defense;
      let raw;
      if (intent === 'attack') raw = e.atk + rint(-1, 2);
      else if (intent === 'heavy') raw = Math.trunc(e.atk * 1.9) + rint(-1, 2);
      else raw = Math.trunc(e.atk * 1.2) + rint(-1, 2);
      if (intent !== 'pierce') raw = Math.max(1, raw - defense);
      const ward = D.ELEMENT_WARD[e.element];
      if (ward && buffActive(ward)) raw = Math.max(1, Math.trunc(raw * 0.6));
      if (guard) raw = Math.max(1, Math.trunc(raw * 0.35));
      P.hp -= raw;
      ev.push(['edmg', raw, guard, intent, Math.max(0, P.hp)]);
    }
    if (P.hp <= 0) { this.result = 'lose'; return ev; }
    this.turn += 1; this.pickIntent();
    if (this.newEnrage) ev.push(['enrage']);
    return ev;
  }
}
function rollDrops(drops, lines) {
  for (const [item, chance, q] of drops) {
    if (Math.random() < dropChance(chance)) {
      const n = Array.isArray(q) ? rint(q[0], q[1]) : q;
      addItem(item, n);
      lines.push(`Drop: +${n} ${itemName(item)}` + (chance < 0.2 ? '  (RARE!)' : ''));
    }
  }
}
function battleRewards(b) {
  if (b.result === 'flee') return ['You escaped back to safety.'];
  P.hunger = Math.max(0, P.hunger - b.hungerCost);
  if (b.result === 'lose') {
    const lost = Math.trunc(P.gold * b.goldLoss);
    P.gold -= lost; P.hp = Math.max(1, Math.min(20, P.max_hp));
    say(`You fainted and lost ${lost}g.`, BAD);
    return [`You woke up safe, but dropped ${lost}g.`];
  }
  const lines = []; P.stats.kills += 1;
  let gold, xp;
  if (b.bossId) {
    const boss = D.BOSSES[b.bossId];
    P.boss_cd[b.bossId] = now() + boss.cooldown;
    gold = rint(boss.gold[0], boss.gold[1]); xp = boss.xp;
    P.stats.boss_kills += 1; track('boss_kills', 1);
    rollDrops(boss.drops, lines);
  } else {
    gold = rint(b.mob.gold[0], b.mob.gold[1]); xp = b.mob.xp;
    rollDrops(b.mob.drops, lines);
  }
  P.gold += gold;
  let used = Object.entries(b.hits).filter(([, n]) => n > 0);
  if (!used.length) used = [['combat', 1]];
  const total = used.reduce((a, [, n]) => a + n, 0);
  for (const [skill, n] of used) addXp(skill, Math.max(1, Math.trunc(xp * n / total)));
  track('kills', 1);
  lines.unshift(`+${gold}g   +${xp} ${used.map(u => u[0]).join(' + ')} XP`);
  say(`Victory over the ${b.enemy.name}!`, GOOD);
  return lines;
}
function makeMobBattle(areaId, mobId) {
  const mob = D.AREAS[areaId].mobs.find(m => m.id === mobId);
  if (P.hunger < 15) { say('Too weak to battle! Eat something first.', BAD); return null; }
  if (P.hp < 10) { say("You're too injured. Eat or wait to regenerate HP.", BAD); return null; }
  const enemy = {}; for (const k of ['name', 'hp', 'atk', 'pattern', 'element', 'sprite']) enemy[k] = mob[k];
  return new Battle(enemy, { mob });
}
function makeAreaBattle(areaId) {
  const mob = choice(D.AREAS[areaId].mobs);
  const b = makeMobBattle(areaId, mob.id);
  if (b) say(`A wild ${mob.name} appears!`, INFO);
  return b;
}
function makeBossBattle(bid) {
  const b = D.BOSSES[bid];
  if (fightLevel() < b.req) { say(`You need combat or archery level ${b.req}.`, BAD); return null; }
  if ((P.boss_cd[bid] || 0) > now()) { say("That boss hasn't recovered yet.", BAD); return null; }
  if (P.hunger < 25) { say('You need at least 25 hunger to face a boss.', BAD); return null; }
  const enemy = { name: b.name, hp: b.hp, atk: b.atk, pattern: b.pattern, cycle: true, enrage: b.enrage, element: null, sprite: b.sprite };
  return new Battle(enemy, { fleeChance: 0.4, hungerCost: 25, goldLoss: 0.10, bossId: bid });
}
