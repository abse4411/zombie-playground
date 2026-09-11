/* ============================================================
 * 全局平衡参数与难度配置
 * ============================================================ */
const GAMECONFIG = {
  // 玩家基础数值
  player: {
    maxHp: 100,
    walkSpeed: 4.6,      // m/s
    sprintSpeed: 7.2,
    jumpVel: 5.4,
    gravity: 14,
    radius: 0.42,        // 碰撞半径
    eyeHeight: 1.7,      // 视线高度
    armorAbsorb: 0.65,   // 护甲吸收伤害比例
  },

  // 经济系统
  economy: {
    startMoney: 800,     // 初始资金
    headshotBonus: 10,   // 爆头额外奖励
    waveBonusBase: 150,  // 波次清空基础奖励
    waveBonusPerWave: 50,
    healPrice: 400,      // 全体治疗
    ammoPrice: 500,      // 全弹药补给
    armorPrice: 300,     // 护甲修复
  },

  // 狩猎模式刷怪参数
  hunt: {
    baseBudget: 60,       // 首波刷怪点数
    budgetPerWave: 36,    // 每波递增
    baseCap: 6,           // 同屏上限（首波）
    capPerWave: 2,
    maxCap: 36,
    spawnIntervalStart: 2.4,
    spawnIntervalMin: 0.45,
    spawnIntervalPerWave: -0.13,
    intermission: 14,     // 波间休整时间（可购物）
    startCountdown: 6,    // 开局倒计时
    hpPerWave: 0.07,      // 每波血量成长
    speedPerWave: 0.02,   // 每波速度成长
    maxSpeedMult: 1.6,
  },

  // 战斗通用
  combat: {
    headshotMult: 2.0,
    attackWindup: 0.45,   // 丧尸出手前摇
    staggerTime: 0.35,    // 爆头硬直
  },

  /* ---------- 打击感（Dying Light 式近战肉感 + 顿帧） ---------- */
  feel: {
    hitstopHeadKill: 0.075,  // 爆头击杀顿帧时长(秒)
    hitstopKill: 0.045,      // 普通击杀顿帧
    hitstopHead: 0.02,       // 爆头命中顿帧
    slowmoWave: 0.65,        // 波次清空慢镜时长
    slowmoScale: 0.22,       // 慢镜时间流速
    kbShotgun: 3.2,          // 霰弹枪击退冲量
    kbMelee: 4.5,
    kbExplosion: 6.5,
  },

  /* ---------- 闪避冲刺 ---------- */
  dash: {
    speed: 14, time: 0.18, cooldown: 2.0, iframes: 0.3,
  },

  /* ---------- 战术脚踢（Dying Light 式群体控制） ---------- */
  kick: {
    damage: 6, range: 2.3, arc: 0.4, cooldown: 1.1,
    knockback: 9, stagger: 1.1,
  },

  /* ---------- 连杀系统 ---------- */
  streak: {
    window: 4.5,        // 连杀计时窗口(秒)
    bonusEvery: 5,      // 每5连杀发奖金
    bonusAmount: 120,
  },

  /* ---------- 导演系统（World War Z 式随机事件） ---------- */
  director: {
    minDelay: 42, maxDelay: 72,
    hordeBase: 8, hordePerWave: 1.5,   // 尸潮突袭数量
    airdropMoney: 320,
    eliteTypes: ['screamer', 'bloater', 'armored'],
  },

  /* ---------- 精英词缀（Diablo 式，第6波起随机出现） ---------- */
  elites: {
    chance: 0.16,          // 词缀出现概率（cost<10 的普通单位）
    rewardMult: 2.5,
    scaleMult: 1.15,
    list: [
      { id: 'frenzy',  name: '狂怒', color: 0xcc2222, hp: 1.2, speed: 1.4, dmg: 1.1 },
      { id: 'tough',   name: '坚甲', color: 0x888899, hp: 2.4, speed: 0.9, dmg: 1.0 },
      { id: 'mighty',  name: '巨力', color: 0xcc8822, hp: 1.5, speed: 1.0, dmg: 1.8, kb: 4 },
      { id: 'volatile',name: '易爆', color: 0x22aa44, hp: 1.0, speed: 1.1, dmg: 1.0, explode: { dmg: 70, radius: 4.5 } },
    ],
  },

  /* ---------- Boss 波（狩猎模式每5波） ---------- */
  boss: {
    everyWaves: 5,
    hpMult: 3.2,
    scale: 1.85,
    rewardMult: 4,
  },

  radar: { range: 55 },
  sensBase: 0.0021,       // 灵敏度基数 rad/px
  touchSensBase: 0.0042,  // 触屏灵敏度基数

  /* ---------- 画质档位（自适应降档保帧率） ---------- */
  quality: {
    high:   { name: '高', pixelRatio: 2,   outlines: true, capMult: 1.0,  particleMult: 1.0,  lod: 48 },
    medium: { name: '中', pixelRatio: 1.4, outlines: true, capMult: 0.75, particleMult: 0.65, lod: 34 },
    low:    { name: '低', pixelRatio: 1.0, outlines: false, capMult: 0.5, particleMult: 0.4,  lod: 24 },
  },
  autoQuality: { checkEvery: 2.5, lowFps: 44, highFps: 57, fpsEma: 0.9 },
};

// 难度等级（狩猎模式）
const DIFFICULTIES = {
  normal:    { name: '普通', hp: 1.0,  dmg: 1.0,  speed: 1.0,  reward: 1.0 },
  hard:      { name: '困难', hp: 1.35, dmg: 1.25, speed: 1.08, reward: 1.3 },
  nightmare: { name: '噩梦', hp: 1.8,  dmg: 1.55, speed: 1.16, reward: 1.65 },
};
