/* ============================================================
 * 感染体（丧尸）数据表
 * cost 刷怪点数 | minWave 最低出场波次 | weight 刷怪权重
 * ============================================================ */
const ZOMBIE_TYPES = {
  walker: {
    id: 'walker', name: '游荡者', role: '基础潮单位',
    hp: 100, speed: 1.7, damage: 11, reward: 25, cost: 1, minWave: 1, weight: 10,
    scale: 1.0, skin: 0x6f8a58, cloth: 0x46505c, pants: 0x33383f,
    attackRange: 1.7, attackRate: 1.15,
    desc: '赤潮病毒最普遍的产物。行动迟缓，但从不疲倦——它们会一直走，直到咬到你。',
  },
  runner: {
    id: 'runner', name: '奔跑者', role: '快速袭扰单位',
    hp: 65, speed: 4.5, damage: 9, reward: 32, cost: 1.3, minWave: 2, weight: 6,
    scale: 0.95, skin: 0x8a7a4e, cloth: 0x5c4a38, pants: 0x3a3028,
    attackRange: 1.6, attackRate: 0.95,
    desc: '心跳停止前还在狂奔的感染者。距离拉得越远，它咬到你的速度越快。',
  },
  stalker: {
    id: 'stalker', name: '潜行者', role: '突袭单位',
    hp: 150, speed: 3.0, damage: 16, reward: 48, cost: 2.2, minWave: 3, weight: 4,
    scale: 0.9, skin: 0x5a5f6a, cloth: 0x2c2f36, pants: 0x24272c, crawl: true, lunge: true,
    attackRange: 1.7, attackRate: 1.0, lungeRange: 8, lungeSpeed: 9.5,
    desc: '四肢着地匍匐前进，轮廓极低难以瞄准。进入8米后会猛扑——听脚步声，别回头。',
  },
  spitter: {
    id: 'spitter', name: '吐酸者', role: '远程压制的腐败池',
    hp: 170, speed: 1.5, damage: 14, reward: 55, cost: 2.4, minWave: 4, weight: 4,
    scale: 1.05, skin: 0x7da05a, cloth: 0x4a5a3a, pants: 0x384430,
    attackRange: 1.7, attackRate: 1.3,
    ranged: { dmg: 18, speed: 11, cooldown: 3.2, keepMin: 8, keepMax: 16, poolDps: 14, poolRadius: 2.0, poolTime: 3.5 },
    desc: '喉囊里酿满腐蚀性胃酸，会在远处朝你吐酸——落地的酸液洼会持续腐蚀一切。',
  },
  bloater: {
    id: 'bloater', name: '膨胀者', role: '移动炸弹',
    hp: 240, speed: 1.5, damage: 0, reward: 60, cost: 2.6, minWave: 5, weight: 3,
    scale: 1.15, skin: 0x9aa06a, cloth: 0x6a5a3a, pants: 0x4a4438,
    attackRange: 2.1, attackRate: 2.0, explode: { dmg: 75, radius: 5.2 },
    desc: '腹中充满高压腐败气体的活体炸弹。靠近你便自爆，被击杀同样会爆——远程解决它！',
  },
  screamer: {
    id: 'screamer', name: '尖啸者', role: '增援指挥官',
    hp: 130, speed: 1.9, damage: 10, reward: 78, cost: 3.0, minWave: 6, weight: 2.5,
    scale: 0.92, skin: 0xb0a090, cloth: 0x6a5a6a, pants: 0x4a3a4a, headBig: true,
    attackRange: 1.6, attackRate: 1.2,
    scream: { cooldown: 9, summon: [2, 4], buffRadius: 16, buffDuration: 6 },
    desc: '变异的喉部能发出撕裂空气的尖啸——召唤成群增援并狂化周围丧尸。听到尖啸，先杀它。',
  },
  armored: {
    id: 'armored', name: '装甲暴兵', role: '正面重甲单位',
    hp: 430, speed: 1.9, damage: 22, reward: 95, cost: 3.6, minWave: 7, weight: 3,
    scale: 1.05, skin: 0x4a5a48, cloth: 0x2e3a2c, pants: 0x222a20, armorPlate: true, frontArmor: 0.55,
    attackRange: 1.8, attackRate: 1.1,
    desc: '残存战术本能、套着防弹装具的前清剿队士兵。正面硬抗55%伤害——绕后，或用大口径讲道理。',
  },
  jester: {
    id: 'jester', name: '小丑', role: '游乐园特有 · 不规则机动',
    hp: 190, speed: 3.6, damage: 15, reward: 65, cost: 2.6, minWave: 5, weight: 3, parkOnly: true,
    scale: 0.98, skin: 0xd8d8e8, cloth: 0xa03050, pants: 0x40a0a0, headBig: true, zigzag: true,
    attackRange: 1.7, attackRate: 0.9,
    desc: '游乐园人偶服里长出的东西。之字形乱窜还间歇性狂奔，枪法不好的猎人最怕它。',
  },
  hound: {
    id: 'hound', name: '地狱犬', role: '犬群突击单位',
    hp: 55, speed: 5.6, damage: 8, reward: 30, cost: 1.5, minWave: 3, weight: 4,
    scale: 0.9, skin: 0x2a2320, cloth: 0x3a2a1a, pants: 0x2a2320, quadruped: true, lunge: true,
    attackRange: 1.5, attackRate: 0.85, lungeRange: 9, lungeSpeed: 10.5,
    desc: '赤潮侵染的军犬，成群结队地狩猎——比奔跑者更快，但非常脆弱。听到嚎叫立刻找好射击角度。',
  },
  phantom: {
    id: 'phantom', name: '幽影', role: '半隐形刺杀单位',
    hp: 120, speed: 2.7, damage: 18, reward: 62, cost: 3.0, minWave: 9, weight: 1.5,
    scale: 1.0, skin: 0x3a3f52, cloth: 0x2a2e3e, pants: 0x22242e, cloak: true,
    attackRange: 1.7, attackRate: 1.0,
    desc: '组织呈半透明状，远距离几乎不可见，接近时才显出轮廓——但猩红双眼始终可见。听着耳语声判断它的位置。',
  },
  brute: {
    id: 'brute', name: '暴君 · 坦克', role: '精英重型单位',
    hp: 1500, speed: 1.3, damage: 38, reward: 240, cost: 10, minWave: 8, weight: 1.2,
    scale: 1.6, skin: 0x8a4a42, cloth: 0x4a3430, pants: 0x382824, knockback: 7, immuneStagger: true, big: true,
    attackRange: 2.2, attackRate: 1.5,
    desc: '赤潮病毒的巅峰造物——两米半高的肌肉堡垒，一巴掌能把人拍飞。永远优先集火，永远别被它近身。',
  },
};

// 遭遇战剧情中出现的精英名称映射（击杀播报用）
const ELITE_NAMES = {
  'brute_m5': '守门人 · 暴君',
};
