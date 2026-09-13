/* ============================================================
 * 强化针剂（Perk）数据表
 * v20.7 重做：每级小步加点（约1个单位数字）、等级上限按总幅度放大、
 * 价格按指数曲线随等级加速上涨（等级越高越贵）。
 * tiers 逐级购买，val 为该级累计数值（消费端 tiers[level-1].val 不变）。
 * ============================================================ */

/* 生成 tiers：steps 级；价格 = base × growth^(lv-1)（四舍五入到10）；val = 每级增量 × 级数 */
function mkTiers(steps, basePrice, growth, step) {
  const arr = [];
  for (let lv = 1; lv <= steps; lv++) {
    arr.push({
      price: Math.round(basePrice * Math.pow(growth, lv - 1) / 10) * 10,
      val: +(step * lv).toFixed(2),
    });
  }
  return arr;
}

const PERKS = {
  hp: {
    id: 'hp', name: '铁躯针剂', icon: '❤',
    tiers: mkTiers(30, 800, 1.07, 3),            // 每级+3 → 30级共+90
    valName: v => `生命上限 +${v}`,
    desc: '军用肾上腺素合剂。每一剂+3生命上限，剂量越大价格越贵——积少成多，让你更难被撕碎。',
  },
  armor: {
    id: 'armor', name: '装甲板甲', icon: '🛡',
    tiers: mkTiers(30, 700, 1.07, 5),           // 每级+5 → 30级共+150
    valName: v => `护甲值 ${v}`,
    desc: '吸收65%承受伤害，直到碎裂。碎了可以花小钱修复。',
  },
  speed: {
    id: 'speed', name: '疾行针剂', icon: '⚡',
    tiers: mkTiers(30, 900, 1.065, 0.01),         // 每级+1% → 30级共+30%
    valName: v => `移速 +${Math.round(v * 100)}%`,
    desc: '加速你的血液循环。在丧尸潮里，跑得快就是活得久。',
  },
  ammo: {
    id: 'ammo', name: '弹药背心', icon: '🎒',
    tiers: mkTiers(20, 1200, 1.08, 0.05),         // 每级+5% → 20级共+100%
    valName: v => `备弹 +${Math.round(v * 100)}%`,
    desc: '扩容弹药携行量，所有武器备弹提升。',
  },
  reload: {
    id: 'reload', name: '快装手套', icon: '🧤',
    tiers: mkTiers(15, 1000, 1.09, 0.02),        // 每级+2% → 15级共-30%
    valName: v => `换弹速度 +${Math.round(v * 100)}%`,
    desc: '战术换弹训练，装填时间逐级缩短。',
  },
  ap: {
    id: 'ap', name: '穿甲弹药', icon: '🔥',
    tiers: mkTiers(20, 1800, 1.08, 0.01),        // 每级+1% → 20级共+20%
    valName: v => `武器伤害 +${Math.round(v * 100)}%`,
    desc: '特制穿甲弹头，所有枪械与近战伤害逐级提升。',
  },
  regen: {
    id: 'regen', name: '再生血清', icon: '💉',
    tiers: mkTiers(12, 1500, 1.1, 0.5),            // 每级+0.5/s → 12级共6/s
    valName: v => `脱战后回复 ${v}/秒`,
    desc: '实验性纳米修复液。脱战5秒后每秒回复生命。',
  },

  tough: {
    id: 'tough', name: '钢铁之躯', icon: '🛠',
    tiers: mkTiers(24, 1100, 1.07, 0.01),        // 每级+1% → 24级共24%
    valName: v => `受伤减少 ${Math.round(v * 100)}%`,
    desc: '军用护甲插层与增稠血清：所有受到的伤害按百分比降低。',
  },
  scavenger: {
    id: 'scavenger', name: '搜刮者', icon: '🧲',
    tiers: mkTiers(24, 900, 1.07, 0.025),         // 每级+2.5% → 24级共60%
    valName: v => `掉落率 +${Math.round(v * 100)}%`,
    desc: '战场搜刮直觉：感染体掉落战利品的概率逐级提升。',
  },
  bulletstorm: {
    id: 'bulletstorm', name: '弹雨瘾', icon: '🌀', unlockBy: 'killer1000',
    tiers: mkTiers(12, 2400, 1.1, 0.025),         // 每级+2.5% → 12级共30%
    valName: v => `连杀≥8时换弹速度 +${Math.round(v * 100)}%`,
    desc: '【成就专属】千人斩解锁——肾上腺素上瘾：杀红了眼（连杀≥8）时换弹快如本能。',
  },
  stamina: {
    id: 'stamina', name: '耐力针剂', icon: '🏃',
    tiers: mkTiers(30, 800, 1.07, 3),            // 每级+3 → 30级共+90
    valName: v => `体力上限 +${v}`,
    desc: '心肺强化合剂：每一剂+3体力上限，冲刺更持久、闪避更从容。',
  },
  adrenaline: {
    id: 'adrenaline', name: '肾上腺素', icon: '⚡',
    tiers: mkTiers(20, 1200, 1.08, 0.025),        // 每级+2.5% → 20级共50%
    valName: v => `体力回复速度 +${Math.round(v * 100)}%`,
    desc: '战斗focus激素疗法：站定喘息与移动中回复的体力速度逐级提升。',
  },
  laststand: {
    id: 'laststand', name: '背水一战', icon: '🔥', unlockBy: 'flawless3',
    tiers: mkTiers(12, 2600, 1.1, 0.025),         // 每级+2.5% → 12级共30%
    valName: v => `生命<25%时伤害+${Math.round(v * 100)}%、移速+15%`,
    desc: '【成就专属】无伤大师解锁——濒死时爆发的求生本能：伤害与移速大幅提升。',
  },
};
