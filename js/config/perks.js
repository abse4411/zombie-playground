/* ============================================================
 * 强化针剂（Perk）数据表
 * tiers 逐级购买，val 为该级数值
 * ============================================================ */
const PERKS = {
  hp: {
    id: 'hp', name: '铁躯针剂', icon: '❤',
    tiers: [{ price: 800, val: 130 }, { price: 1600, val: 160 }, { price: 3000, val: 200 }],
    valName: v => `生命上限 ${v}`,
    desc: '军用肾上腺素合剂，大幅提升生命上限。每一级都让你更难被撕碎。',
  },
  armor: {
    id: 'armor', name: '装甲板甲', icon: '🛡',
    tiers: [{ price: 700, val: 50 }, { price: 1400, val: 100 }, { price: 2600, val: 150 }],
    valName: v => `护甲值 ${v}`,
    desc: '吸收65%承受伤害，直到碎裂。碎了可以花小钱修复。',
  },
  speed: {
    id: 'speed', name: '疾行针剂', icon: '⚡',
    tiers: [{ price: 900, val: 0.15 }, { price: 1800, val: 0.3 }],
    valName: v => `移速 +${Math.round(v * 100)}%`,
    desc: '加速你的血液循环。在丧尸潮里，跑得快就是活得久。',
  },
  ammo: {
    id: 'ammo', name: '弹药背心', icon: '🎒',
    tiers: [{ price: 1200, val: 1.0 }],
    valName: v => `备弹 +${Math.round(v * 100)}%`,
    desc: '扩容弹药携行量，所有武器备弹翻倍。',
  },
  reload: {
    id: 'reload', name: '快装手套', icon: '🧤',
    tiers: [{ price: 1000, val: 0.3 }],
    valName: v => `换弹速度 +${Math.round(v * 100)}%`,
    desc: '战术换弹训练，装填时间缩短30%。',
  },
  ap: {
    id: 'ap', name: '穿甲弹药', icon: '🔥',
    tiers: [{ price: 1800, val: 0.2 }],
    valName: v => `武器伤害 +${Math.round(v * 100)}%`,
    desc: '特制穿甲弹头，所有枪械与近战伤害提升20%。',
  },
  regen: {
    id: 'regen', name: '再生血清', icon: '💉',
    tiers: [{ price: 1500, val: 2 }],
    valName: v => `脱战后回复 ${v}/秒`,
    desc: '实验性纳米修复液。脱战5秒后每秒回复2点生命。',
  },

  tough: {
    id: 'tough', name: '钢铁之躯', icon: '🛠',
    tiers: [{ price: 1100, val: 0.10 }, { price: 2200, val: 0.18 }, { price: 3800, val: 0.25 }],
    valName: v => `受伤减少 ${Math.round(v * 100)}%`,
    desc: '军用护甲插层与增稠血清：所有受到的伤害按百分比降低。',
  },
  scavenger: {
    id: 'scavenger', name: '搜刮者', icon: '🧲',
    tiers: [{ price: 900, val: 0.3 }, { price: 1800, val: 0.6 }],
    valName: v => `掉落率 +${Math.round(v * 100)}%`,
    desc: '战场搜刮直觉：感染体掉落战利品的概率大幅提升。',
  },
};
