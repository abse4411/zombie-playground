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
    headshotBonus: 15,   // 爆头额外奖励
    rewardGlobalMult: 1.6, // 全局赏金倍率（提高爆率）
    waveBonusBase: 150,  // 波次清空基础奖励
    waveBonusPerWave: 50,
    healPrice: 400,      // 全体治疗
    ammoPrice: 500,      // 全弹药补给
    armorPrice: 300,     // 护甲修复
    chapterBonusBase: 1500,      // 过关大量金钱奖励
    chapterBonusPerChapter: 500,
  },

  // 狩猎模式刷怪参数
  hunt: {
    baseBudget: 60,       // 首波刷怪点数
    budgetPerWave: 36,    // 每波递增
    baseCap: 8,           // 同屏上限（首波，v11.0提速）
    capPerWave: 3,
    maxCap: 42,
    spawnIntervalStart: 1.6,
    spawnIntervalMin: 0.3,
    spawnIntervalPerWave: -0.15,
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

  // 体力系统（v13.1）：走路不耗，站立快回/走路慢回，耗尽疲劳锁定
  stamina: {
    max: 100,
    sprintDrain: 14,        // 冲刺消耗/秒（满体力≈7s持续冲刺）
    dashCost: 25,           // 闪避冲刺瞬耗
    kickCost: 18,           // 战术踢瞬耗
    idleRegen: 38,          // 站立回复/秒（快，≈2.6s回满）
    walkRegen: 16,          // 走路回复/秒（慢，≈6s回满）
    exhaustedRecover: 0.3,  // 疲劳后需回到30%才能再次冲刺
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
    chance: 0.14,          // 变异基础概率（随章节/波次递增，见 spawnSystem）
    rewardMult: 2.5,
    scaleMult: 1.15,
    list: [
      { id: 'frenzy',    name: '狂怒', color: 0xcc2222, hp: 1.2, speed: 1.45, dmg: 1.1 },
      { id: 'tough',     name: '铁甲', color: 0x8899aa, hp: 2.6, speed: 0.85, dmg: 1.0, frontArmor: 0.3 },
      { id: 'longclaw',  name: '长爪', color: 0xdd66ff, hp: 1.2, speed: 1.05, dmg: 1.15, reach: 1.6 },
      { id: 'mighty',    name: '巨力', color: 0xcc8822, hp: 1.6, speed: 0.95, dmg: 1.9, kb: 5, scale: 1.25 },
      { id: 'volatile',  name: '易爆', color: 0x22aa44, hp: 1.0, speed: 1.1, dmg: 1.0, explode: { dmg: 70, radius: 4.5 } },
      { id: 'vampire',   name: '嗜血', color: 0xff2255, hp: 1.5, speed: 1.2, dmg: 1.3, heal: 0.08 },
    ],
  },

  /* ---------- Boss 波（狩猎模式每5波） ---------- */
  boss: {
    everyWaves: 5,
    hpMult: 3.2,
    scale: 1.85,
    rewardMult: 4,
  },

  /* ---------- 背包（v3.5） ---------- */
  inventory: {
    medkitMax: 5,       // 医疗包携带上限
    medkitHeal: 55,     // 单个回复量
  },

  /* ---------- 道具栏（v18.1）：5键字段道具，左键使用 ---------- */
  items: {
    medkit:     { name: '医疗包',   icon: '💉', max: 5, price: 0,   use: 'cast',
                  desc: '1.2秒包扎恢复大量生命，受击打断（H键快速使用）' },
    armorplate: { name: '护甲板',   icon: '🛡', max: 3, price: 700, use: 'armor',
                  desc: '立即将护甲修复至上限（需已装备装甲）' },
    ammobag:    { name: '弹药袋',   icon: '🎒', max: 2, price: 600, use: 'ammo',
                  desc: '立即补满全部武器（含背包内）的备弹' },
    adrenaline: { name: '肾上腺素', icon: '⚡', max: 3, price: 850, use: 'adrenaline', dur: 8,
                  desc: '8秒内移速+45%、换弹速度+35%、体力回复翻倍' },
  },

  /* ---------- 武器栏位扩容（v18.1）：角色基准槽数 + 商城升级档 ---------- */
  slotUpgrade: {
    cap: 3,
    price: { primary: [1800, 3200], secondary: [900, 1600], melee: [600, 1100] },
  },

  /* ---------- 赤手空拳（v18.2）：徒手攻击的体力消耗与重击前摇 ---------- */
  fist: {
    lightCost: 10,    // 轻击体力
    heavyCost: 18,    // 重击体力
    windup: 0.16,     // 重击前摇（秒）：蓄力后落锤，可切枪取消
  },

  /* ---------- Boss 战机制（v6.5） ---------- */
  bossMech: {
    phase2At: 0.5,          // 血量50%进入二阶段
    rageSpeed: 1.35,        // 二阶段移速
    rageRate: 0.7,          // 二阶段攻击间隔
    summonEvery: 9,         // 召唤杂兵间隔(秒)
    summonN: 2,
    slamEvery: 11,          // 跺地AOE间隔(秒)
    slamDmg: 35,
    slamRadius: 6,
  },

  /* ---------- 幕末Boss战（v6.9）：三幕末章各自专属Boss ---------- */
  bosses: {
    tyrant: {
      name: '暴君 Ω', type: 'brute', scale: 1.9,
      hp: 2600, speed: 2.6, dmg: 45, reward: 2600,
      attacks: { slamEvery: 8, slamDmg: 42, slamRadius: 6.5, chargeEvery: 9, summonEvery: 12, summonN: 3 },
    },
    colossus: {
      name: '灯塔巨像', type: 'brute', scale: 2.2,
      hp: 3200, speed: 1.9, dmg: 38, reward: 3200,
      attacks: { barrageEvery: 6, barrageN: 3, slamEvery: 10, slamDmg: 45, slamRadius: 7, quakeEvery: 14, summonEvery: 15, summonN: 4 },
    },
    executioner: {
      name: '方舟刽子手', type: 'brute', scale: 1.7,
      hp: 2400, speed: 3.1, dmg: 40, reward: 2400,
      attacks: { lungeEvery: 7, lungeSpeed: 12, summonEvery: 11, summonN: 3, frenzy: true },
    },
     xt300: {
      name: '钢铁哨兵 XT-300', type: 'brute', scale: 1.8,
      hp: 5000, speed: 1.7, dmg: 36, reward: 7000,
      mech: true,
      attacks: {
        gatlingEvery: 5, gatlingDmg: 7, gatlingN: 10,    // 机枪扫射：扇形10连
        missileEvery: 8, missileDmg: 30, missileN: 3,    // 导弹齐射：3枚追踪
        stompEvery: 9, stompDmg: 44, stompRadius: 6.5,   // 踩踏
        turretWeak: true,                                 // 炮塔弱点：破坏后无法扫射
      },
    },
    pumpWarden: {
      name: '母体泵守护者', type: 'brute', scale: 2.5,
      hp: 4800, speed: 2.0, dmg: 50, reward: 6000,
      weakFire: true,
      attacks: {
        slamEvery: 7, slamDmg: 50, slamRadius: 7,
        tentacleEvery: 6, tentacleDmg: 40,
        spikeEvery: 9, spikeDmg: 18, spikeN: 3,
        summonEvery: 14, summonN: 2, summonType: 'licker',
      },
    },
  },
  /* ---------- 小Boss（v15.3）：登场三件套（横幅+号角+慢镜）+ 50%阶段转换 + 弱点部位 + 保底掉落 ----------
   * 设计原则（调研 L4D/Destiny/Borderlands）：血量约普通精英 8~15 倍、专属技 1~2 个、
   * 半血狂暴（提速+免硬直防无限控制）、爆头弱点额外倍率、击杀必掉补给箱。
   */
  minibosses: {
    warlord: {
      name: '战场军阀 · 卡恩', type: 'warlord', scale: 1.32,
      tag: '清剿队最后的军官——火力即纪律',
      hp: 1600, speed: 2.6, dmg: 18, reward: 1200, frontArmor: 0.4, weakHead: 1.35,
      phase2: { banner: '卡恩撕掉了肩章——自由开火！', speedMult: 1.2, cdMult: 0.6 },
      fragEvery: 10, fragDmg: 30, fragRadius: 4.2,
      summonEvery: 13, summonType: 'raider', summonN: 2,
    },
    ironwall: {
      name: '铁壁 · 布洛玛', type: 'armored', scale: 1.55,
      tag: '重甲先锋——绕后击穿它的防护薄弱处',
      hp: 1500, speed: 2.1, dmg: 30, reward: 900, frontArmor: 0.7, weakHead: 1.5,
      phase2: { banner: '布洛玛丢弃了盾板——破釜沉舟！', speedMult: 1.55, cdMult: 0.65, dropArmor: true },
      chargeEvery: 8, slamEvery: 10, slamDmg: 34, slamRadius: 5.5,
    },
    banshee: {
      name: '嚎哭女妖 · 薇丝', type: 'screamer', scale: 1.4,
      tag: '声波猎手——她的尖啸会震碎你的骨头',
      hp: 750, speed: 3.3, dmg: 20, reward: 850, weakHead: 1.4,
      phase2: { banner: '薇丝的喉管撕裂了——尖啸风暴！', speedMult: 1.3, cdMult: 0.55 },
      sonicEvery: 8, sonicDmg: 16, sonicRadius: 8,
      summonEvery: 12, summonType: 'runner', summonN: 3,
    },
  },
  // 狩猎模式小Boss轮换阵容（第4波起每3波一个）
  minibossRoster: ['warlord', 'ironwall', 'banshee'],

  /* ---------- 变异情景（v16.1）：全局情景修正（Back 4 Blood Corruption 式） ----------
   * 风险=回报配对：每条强化都附带赏金补偿。狩猎模式第3波起每波随机抽取（60%），
   * 持续整波；遭遇战可通过任务数据 scenario 字段固定触发。
   */
  scenarios: [
    { id: 'ironhide', icon: '🛡', name: '铁皮进化', desc: '全体感染体生命 +40% —— 赏金 +25%', hp: 1.4, reward: 1.25 },
    { id: 'hunger', icon: '💨', name: '饥渴潮涌', desc: '全体感染体移速 +25% —— 赏金 +30%', speed: 1.25, reward: 1.3 },
    { id: 'bloodlust', icon: '🩸', name: '嗜血狂怒', desc: '全体感染体伤害 +25%、攻击欲望强化 —— 赏金 +30%', dmg: 1.25, aggro: 1.3, reward: 1.3 },
    { id: 'tide', icon: '🌊', name: '狂潮尸海', desc: '同屏上限 +50%、刷怪提速 —— 开波尸潮爆发', cap: 1.5, interval: 0.65, burst: true, reward: 1.35 },
    { id: 'womb', icon: '☣', name: '变异温床', desc: '变异感染体概率 +22% —— 赏金 +40%', mutate: 0.22, reward: 1.4 },
    { id: 'bounty', icon: '💰', name: '血色赏金', desc: '赏金翻倍 —— 但它们也硬得可怕', reward: 2.0, hp: 1.3 },
    { id: 'elite', icon: '💀', name: '猎王领地', desc: '小Boss 提前登岛、精英频出 —— 赏金 +35%', mutate: 0.1, miniAtWave: 4, reward: 1.35 },
  ],

  /* ---------- 尸潮爆发（v16.2）：一次性大规模合围 ---------- */
  hordeBurst: {
    warnTime: 3,          // 警报倒计时（秒）
    baseN: 12, perWave: 1.4, maxN: 34,   // 数量 = base + wave×perWave
    ringMin: 16, ringMax: 26,            // 玩家周围环形刷新带
    stagger: 0.12,                        // 逐个落地间隔
  },

  /* ---------- 支援道具（v16.3）：背包点击使用，商城售卖 ---------- */
  supports: {
    airstrike: {
      id: 'airstrike', icon: '✈', name: '战机轰炸', max: 2, pack: 1, price: 2600,
      desc: '标记前方40米×8米弹幕带，2.5秒后战机沿带投弹8枚——注意自己别站在弹着区里。',
      stats: [['单弹伤害', 150], ['弹幕带', '40m × 8m'], ['前摇', '2.5s']],
    },
    supply: {
      id: 'supply', icon: '📦', name: '空投补给', max: 3, pack: 1, price: 1800,
      desc: '呼叫补给箱空投至身边：全弹药补满 + 医疗包×2 + 现金。落地有小额砸落伤害。',
      stats: [['内容', '全弹药+医疗×2+$600'], ['落地', '半径3m击倒']],
    },
    drone: {
      id: 'drone', icon: '🛸', name: '攻击无人机', max: 2, pack: 1, price: 3200,
      desc: '武装无人机伴飞25秒：自动索敌18米内感染体，双联机枪点射（爆头按2倍计）。',
      stats: [['持续', '25s'], ['索敌', '18m'], ['火力', '22 dmg / 0.5s']],
    },
    sentry: {
      id: 'sentry', icon: '🔫', name: '哨戒机枪', max: 2, pack: 1, price: 2400,
      desc: '部署自动哨戒塔：120°扇形自动索敌16米，150发弹链打完自毁。占好位置比什么都强。',
      stats: [['弹药', '150发'], ['扇形', '120° / 16m'], ['火力', '18 dmg / 0.12s']],
    },
  },

  radar: { range: 55 },
  /* ---------- 感染体整体强化（v7.0）：攻击欲望/攻击距离/移速 ---------- */
  zombieAggro: {
    rateMult: 0.7,      // 攻击间隔 ×0.7（更频繁进攻）
    rangeBonus: 0.3,    // 攻击距离 +0.3m
    speedMult: 1.18,    // 移速 ×1.18（压迫感提升但可甩开）
  },
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
const DIFFICULTIES = {  normal:    { name: '普通', hp: 1.0,  dmg: 1.0,  speed: 1.0,  reward: 1.0, tag: '新兵适应性', color: '#8ac07a',
    desc: '标准威胁等级。感染体行动迟缓、伤害可控，赏金收益基准。适合熟悉武器手感、地图机制与支援道具的猎手。' },
  hard:      { name: '困难', hp: 1.35, dmg: 1.25, speed: 1.08, reward: 1.3, tag: '老兵常规作战', color: '#e8a13a',
    desc: '感染体更耐打、更具攻击性，移动明显加快。资源开始紧张，精准的枪法、合理走位与道具时机是活下去的关键。' },
  nightmare: { name: '噩梦', hp: 1.8,  dmg: 1.55, speed: 1.16, reward: 1.65, tag: '赤潮失控区', color: '#e63946',
    desc: '赤潮全面失控。感染体成群结队且异常凶残，弹药与医疗品极度稀缺——一次失误即是终结。唯有老练的猎手才能见到第 20 波。' },
};

/* ---------- 外观系统（v5.4） ---------- */
const SKINS = [
  { id: 'default',  name: '制式作战服', tint: 0xffffff, soldier: 0x3a4a3e },
  { id: 'arctic',   name: '极地雪-compatible', tint: 0xcfe4ff, soldier: 0x8aa4b8 },
  { id: 'midnight', name: '午夜行动', tint: 0x7d8ac0, soldier: 0x2a3048 },
  { id: 'hazard',   name: '橙色警戒', tint: 0xffb044, soldier: 0x9a6a28 },
];
const CAMOS = [
  { id: 'default', name: '制式黑',   tint: 0xffffff },
  { id: 'chrome',  name: '镀铬',     tint: 0x9fd8ff },
  { id: 'jungle',  name: '丛林',     tint: 0x9dc27a },
  { id: 'crimson', name: '绯红',     tint: 0xff9a7a },
];
