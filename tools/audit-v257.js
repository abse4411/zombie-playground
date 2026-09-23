/* v25.7 全物品描述-机制一致性审计：
 * 配置 → 实现路径逐项对账（武器特殊机制/投掷物行为链/道具链/支援链），发现断链即报错 */
const fs = require('fs');
const vm = require('vm');
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('  ✗ ' + msg); } };

const read = p => fs.readFileSync(p, 'utf-8');
const WS = read('js/systems/weaponSystem.js'), PR = read('js/entities/projectile.js'),
  LO = read('js/entities/loot.js'), SP = read('js/entities/support.js'), PL = read('js/entities/player.js'),
  GUN = read('js/systems/gunModels.js'), ZB = read('js/entities/zombie.js'), GA = read('js/core/game.js');

// 沙箱载入纯数据配置
const sb = { console, window: {} };
vm.createContext(sb);
for (const f of ['js/config/weapons.js', 'js/config/gameConfig.js']) {
  vm.runInContext(read(f), sb, { filename: f });
}
const grab = name => vm.runInContext(name, sb, { filename: 'grab' });
const WEAPONS = grab('WEAPONS'), THROWABLES = grab('THROWABLES'), GAMECONFIG = grab('GAMECONFIG');

console.log('== A. 武器特殊机制：配置 flag ↔ weaponSystem 实现路径 ==');
const flagHandlers = {
  launcher: 'def.launcher', dual: 'def.dual', rocket: 'def.rocket', chain: 'def.chain',
  frost: 'def.frost', flame: 'def.flame', acid: 'def.acid', stun: 'def.stun',
  blastHeavy: 'def.blastHeavy', volley: 'def.volley', scope: 'def.scope', shock: 'def.shock',
  spinup: 'def.spinup', pierce: 'def.pierce', continuous: 'def.continuous', melee: 'def.melee',
};
for (const [flag, token] of Object.entries(flagHandlers)) ok(WS.includes(token), 'flag实现缺失: ' + token);
let nFlags = 0;
for (const id in WEAPONS) {
  const d = WEAPONS[id];
  ok(d.name && d.desc && d.len && d.color, '武器字段不全: ' + id);
  for (const flag of Object.keys(flagHandlers)) {
    if (d[flag]) { nFlags++; ok(WS.includes(flagHandlers[flag]), '武器' + id + '的' + flag + '无实现路径'); }
  }
  if (!d.melee) ok(d.damage && d.rpm && d.mag !== undefined && d.reserve !== undefined && d.reloadTime && d.sound && d.sound.freq !== undefined, '枪械字段不全: ' + id);
  else ok(d.range && d.arc, '近战字段不全: ' + id);
}
console.log('  武器数: ' + Object.keys(WEAPONS).length + '，机制标记数: ' + nFlags);
// 死代码反查：每个实现路径至少被一个武器使用
for (const flag of ['rocket', 'chain', 'frost', 'blastHeavy', 'volley', 'shock', 'stun', 'acid']) {
  const used = Object.values(WEAPONS).some(d => d[flag]);
  ok(used, '实现路径无武器使用(死代码): ' + flag);
}

console.log('== B. 投掷物：THROW_KINDS ↔ PROJ_CFG ↔ 行为分支 ↔ 掉落拾取 ↔ 图鉴模型 ==');
const THROW_KINDS = ['frag', 'impact', 'sticky', 'emp', 'gas', 'incendiary', 'cryo', 'cluster', 'concussion', 'molotov', 'attractor'];
ok(WS.includes("const THROW_KINDS = [" + THROW_KINDS.map(k => "'" + k + "'").join(', ') + "]"), 'THROW_KINDS 清单不一致');
for (const k of THROW_KINDS) {
  const t = THROWABLES[k];
  ok(t, 'THROWABLES 缺少: ' + k);
  ok(t && t.name && t.desc, '投掷物描述缺失: ' + k);
  ok(PR.includes('  ' + k + ':') || PR.includes(' ' + k + ':'), 'PROJ_CFG 缺少: ' + k);
  ok(PR.includes("'" + k + "'"), 'projectile.js 无行为分支: ' + k);
  const dropKind = k === 'molotov' ? 'molo' : k;
  ok(LO.includes("case '" + dropKind + "'"), 'loot.js 拾取 case 缺失: ' + dropKind);
  ok(LO.includes("'" + dropKind + "'"), 'loot.js 模型/标签引用缺失: ' + dropKind);
}
// 专用行为断言（用户报告点）
ok(/kind === 'sticky' && this\.stuck/.test(PR), 'sticky 粘住冻结分支缺失');
ok(PR.includes('this.stuckZ'), 'sticky 粘尸跟随缺失');
ok(PR.includes('updateAttractors'), '诱饵 updateAttractors 缺失');
ok(ZB.includes('ATTRACTORS'), 'zombie.js 诱饵吸引接线缺失');
ok(GA.includes('for (const g of this.gasClouds) g.update'), 'game.js 毒云 update 接线缺失');
ok(GA.includes('updateAttractors(dt, this)'), 'game.js 诱饵 update 接线缺失');
ok(GA.includes('ATTRACTORS.clear()'), 'game.js 诱饵清理缺失');
ok(PR.includes("'rocket'") && PR.includes('buildRocketMesh'), '火箭弹模型缺失');
ok(WS.includes("def.rocket ? 'rocket'"), '发射器火箭弹分流缺失');
ok(WS.includes('BEAMS.fire'), '光束弹道未接入');
ok(GA.includes('BEAMS.update') && GA.includes('FLASHES.update'), 'game.js 光束/闪光池未更新');

console.log('== C. 道具：GAMECONFIG.items ↔ ITEM_KINDS ↔ useItem ↔ 掉落 ==');
const ITEM_KINDS = ['medkit', 'armorplate', 'adrenaline', 'armorkit', 'ammobox', 'megamed', 'heavyplate', 'nanobot', 'combatstim'];
ok(WS.includes("const ITEM_KINDS = [" + ITEM_KINDS.map(k => "'" + k + "'").join(', ') + "]"), 'ITEM_KINDS 清单不一致');
for (const k of ITEM_KINDS) {
  const it = GAMECONFIG.items[k];
  ok(it, 'GAMECONFIG.items 缺少: ' + k);
  ok(it && it.name && it.desc && it.icon, '道具字段不全: ' + k);
  ok(PL.includes("if (kind === '" + k + "')"), 'useItem 分支缺失: ' + k);
  ok(LO.includes("'" + k + "'"), 'loot.js 道具引用缺失: ' + k);
  ok(WS.includes("'" + k + "'"), 'weaponSystem 道具手持模型缺失: ' + k);
}

console.log('== D. 支援：GAMECONFIG.supports ↔ support.js 实现 ==');
const supIds = Object.keys(GAMECONFIG.supports || {});
ok(supIds.length >= 10, '支援数量异常: ' + supIds.length);
for (const id of supIds) {
  const s = GAMECONFIG.supports[id];
  ok(s && s.name && s.desc, '支援字段不全: ' + id);
  ok(SP.includes("'" + id + "'"), 'support.js 无实现: ' + id);
}

console.log('== E. 枪模：每把武器在 gunModels.js 可构建 ==');
for (const id in WEAPONS) {
  ok(GUN.includes("'" + id + "'") || GUN.includes(id), 'gunModels 缺少: ' + id);
}

console.log(fail ? ('审计完成：' + fail + ' 处断链') : '审计完成：全部通过 ✓');
process.exit(fail ? 1 : 0);
