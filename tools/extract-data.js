/* ============================================================
 * 数据外置工具（v12.1）：把 js/config 的内容数据表提取为 assets/data JSON
 * 运行：node tools/extract-data.js
 * 函数字段转换：
 *   perks.valName  v => `模板${v}`   →  valT: "模板{v}"
 *   achievements.goal  d => [min(d.stat, N), N]  →  goal: { stat, target }（Proxy 自动提取）
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'data');
fs.mkdirSync(path.join(OUT, 'maps'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'missions'), { recursive: true });

function evalFile(rel, names) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const sandbox = { console, window: {}, THREE: {} };
  vm.createContext(sandbox);
  // const/let 不会挂到沙箱全局 —— 在尾部构造返回对象
  const ret = vm.runInContext(code + `\n;({ ${names.join(', ')} });`, sandbox, { filename: rel });
  return ret;
}
function writeJSON(rel, obj) {
  const p = path.join(OUT, rel);
  fs.writeFileSync(p, JSON.stringify(obj));
  const kb = (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`  ✓ ${rel} (${kb} KB)`);
}
function assertJSONSafe(tag, obj) {
  JSON.stringify(obj, (k, v) => {
    if (typeof v === 'function') throw new Error(`${tag}.${k} 是函数，不能外置`);
    return v;
  });
}

/* ---------- 1. 武器 + 投掷物 ---------- */
{
  const s = evalFile('js/config/weapons.js', ['WEAPONS', 'THROWABLES']);
  assertJSONSafe('weapons', s.WEAPONS);
  assertJSONSafe('throwables', s.THROWABLES);
  writeJSON('weapons.json', { weapons: s.WEAPONS, throwables: s.THROWABLES });
}

/* ---------- 2. 感染体 ---------- */
{
  const s = evalFile('js/config/zombies.js', ['ZOMBIE_TYPES']);
  assertJSONSafe('zombieTypes', s.ZOMBIE_TYPES);
  writeJSON('zombies.json', { zombieTypes: s.ZOMBIE_TYPES });
}

/* ---------- 3. 角色 ---------- */
{
  const s = evalFile('js/config/characters.js', ['CHARACTERS']);
  assertJSONSafe('characters', s.CHARACTERS);
  writeJSON('characters.json', { characters: s.CHARACTERS });
}

/* ---------- 4. 强化针剂：valName 函数 → 模板字符串 ---------- */
{
  const s = evalFile('js/config/perks.js', ['PERKS']);
  const perks = {};
  for (const id in s.PERKS) {
    const k = { ...s.PERKS[id] };
    let t = k.valName.toString();
    t = t.replace(/\$\{Math\.round\(v \* 100\)\}/g, '{v%}');
    t = t.replace(/\$\{v\s*\/\s*100\}/g, '{v/100}');
    t = t.replace(/\$\{v\}/g, '{v}');
    const m = t.match(/`([^`]*)`/);
    if (!m) throw new Error('perk ' + id + ' valName 模板解析失败: ' + t);
    delete k.valName;
    k.valT = m[1];
    perks[id] = k;
  }
  assertJSONSafe('perks', perks);
  writeJSON('perks.json', { perks });
}

/* ---------- 5. 成就：goal 函数 → { stat, target }（Proxy 提取） ---------- */
{
  const s = evalFile('js/config/achievements.js', ['ACHIEVEMENTS']);
  const list = s.ACHIEVEMENTS.map(a => {
    const out = { id: a.id, cat: a.cat, tier: a.tier, name: a.name, desc: a.desc };
    for (const k in a) if (!(k in out) && k !== 'goal') out[k] = a[k];
    // Proxy 记录 goal 读取的属性名；返回值 [cur, target] 的 target 即目标值
    const rec = { stat: null, touched: false };
    const px = new Proxy({}, { get(t, k) { rec.touched = true; rec.stat = String(k); return 1e9; } });
    let target = null;
    try { const r = a.goal(px); if (Array.isArray(r)) target = r[1]; } catch (e) { /* 复合目标 */ }
    if (rec.touched && Number.isFinite(target)) out.goal = { stat: rec.stat, target };
    else out.goalComplex = true;   // 复合统计目标（如 Object.keys(...).length），求值器在代码里按 id 特判
    return out;
  });
  writeJSON('achievements.json', { achievements: list });
  const complex = list.filter(a => a.goalComplex).map(a => a.id);
  if (complex.length) console.log('  ⚠ 复合目标成就（需在代码 ACHV_SPECIAL_GOALS 特判）:', complex.join(', '));
}

/* ---------- 6. 剧情：任务元数据索引 + 每任务详情 ---------- */
{
  const s = evalFile('js/config/story.js', ['MISSIONS', 'CAMPAIGN_INTRO']);
  const META_KEYS = new Set(['act', 'id', 'name', 'map', 'duration', 'hpMult', 'rewardMult', 'brief', 'objective', 'spinoff', 'reqDone']);
  const index = [];
  for (const m of s.MISSIONS) {
    assertJSONSafe('mission ' + m.id, m);
    const meta = {}, detail = {};
    for (const k in m) (META_KEYS.has(k) ? meta : detail)[k] = m[k];
    fs.writeFileSync(path.join(OUT, 'missions', m.id + '.json'), JSON.stringify(detail));
    index.push(meta);
  }
  writeJSON('missions/index.json', { campaignIntro: s.CAMPAIGN_INTRO, missions: index });
  console.log(`  ✓ missions/m*.json ×${s.MISSIONS.length}`);
}

/* ---------- 7. 地图：元数据索引 + 每图完整数据 ---------- */
{
  const s = evalFile('js/config/maps.js', ['MAPS', 'STRUCTS']);
  const index = [];
  for (const id in s.MAPS) {
    const def = s.MAPS[id];
    assertJSONSafe('map ' + id, def);
    fs.writeFileSync(path.join(OUT, 'maps', id + '.json'), JSON.stringify(def));
    index.push({ id, name: def.name, subtitle: def.subtitle, desc: def.desc, mode: def.mode, size: def.size });
  }
  writeJSON('maps/index.json', { maps: index });
  console.log(`  ✓ maps/<id>.json ×${index.length}`);
}

console.log('\n数据外置完成 → assets/data/');
