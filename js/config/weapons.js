/* ============================================================
 * 武器数据表
 * slot: primary 主武器 / secondary 副武器 / melee 近战
 * damage 单发伤害 | rpm 射速(发/分) | spread 散布(rad)
 * falloff 伤害衰减 {start,end,min}
 * ============================================================ */
const WEAPONS = {
  /* ---------- 副武器 ---------- */
  p92: {
    id: 'p92', name: 'P92 手枪', slot: 'secondary', price: 0,
    damage: 22, rpm: 330, mag: 12, reserve: 72, reserveMax: 144,
    reloadTime: 1.4, spread: 0.020, adsSpread: 0.008, auto: false,
    pellets: 1, headMult: 2.0, range: 55, falloff: null,
    recoil: 0.011, color: 0x464c52, len: 0.42,
    sound: { freq: 950, dur: 0.09, boom: 0.5 },
    desc: '制式半自动手枪。永远可靠的伙伴，弹匣小但换弹快。',
  },
  deagle: {
    id: 'deagle', name: '沙漠之鹰', slot: 'secondary', price: 900,
    damage: 58, rpm: 190, mag: 7, reserve: 42, reserveMax: 84,
    reloadTime: 1.9, spread: 0.024, adsSpread: 0.010, auto: false,
    pellets: 1, headMult: 2.0, range: 70, falloff: null,
    recoil: 0.028, color: 0x8a8f96, len: 0.5,
    sound: { freq: 620, dur: 0.14, boom: 0.9 },
    desc: '大口径手炮，一枪一个脑袋。后坐力惊人。',
  },
  r8: {
    id: 'r8', name: 'R8 左轮', slot: 'secondary', price: 1500,
    damage: 80, rpm: 120, mag: 6, reserve: 30, reserveMax: 60,
    reloadTime: 2.8, spread: 0.014, adsSpread: 0.005, auto: false,
    pellets: 1, headMult: 2.2, range: 80, falloff: null,
    recoil: 0.032, color: 0x2e3238, len: 0.55,
    sound: { freq: 520, dur: 0.16, boom: 1.0 },
    desc: '重型左轮，爆头一枪秒杀普通感染者，温柔与浪漫并存。',
  },

  /* ---------- 主武器 ---------- */
  mp5: {
    id: 'mp5', name: 'MP5 冲锋枪', slot: 'primary', price: 1200,
    damage: 16, rpm: 780, mag: 30, reserve: 180, reserveMax: 360,
    reloadTime: 2.0, spread: 0.030, adsSpread: 0.015, auto: true,
    pellets: 1, headMult: 2.0, range: 45, falloff: { start: 18, end: 40, min: 0.55 },
    recoil: 0.008, color: 0x2b2f33, len: 0.62,
    sound: { freq: 1150, dur: 0.07, boom: 0.45 },
    desc: '高射速冲锋枪，清潮利器。伤害平平，胜在泼水般的火力。',
  },
  spas: {
    id: 'spas', name: 'SPAS-12 霰弹枪', slot: 'primary', price: 1900,
    damage: 13, pellets: 8, rpm: 75, mag: 8, reserve: 48, reserveMax: 96,
    reloadTime: 3.0, spread: 0.055, adsSpread: 0.040, auto: false,
    pellets: 8, headMult: 1.6, range: 24, falloff: { start: 6, end: 18, min: 0.25 },
    recoil: 0.042, color: 0x3a3126, len: 0.75,
    sound: { freq: 380, dur: 0.18, boom: 1.2 },
    desc: '8弹丸面杀伤。贴脸一枪撕碎一群，距离越远伤害衰减越狠。',
  },
  ak47: {
    id: 'ak47', name: 'AK-47 突击步枪', slot: 'primary', price: 2500,
    damage: 33, rpm: 580, mag: 30, reserve: 150, reserveMax: 300,
    reloadTime: 2.3, spread: 0.034, adsSpread: 0.017, auto: true,
    pellets: 1, headMult: 2.0, range: 60, falloff: { start: 25, end: 55, min: 0.7 },
    recoil: 0.017, color: 0x5c4630, len: 0.72,
    sound: { freq: 700, dur: 0.11, boom: 0.9 },
    desc: '经典7.62步枪，单发威力大，扫射压制一切靠近的活死人。',
  },
  m4a1: {
    id: 'm4a1', name: 'M4A1 突击步枪', slot: 'primary', price: 2900,
    damage: 27, rpm: 700, mag: 30, reserve: 180, reserveMax: 360,
    reloadTime: 2.1, spread: 0.024, adsSpread: 0.010, auto: true,
    pellets: 1, headMult: 2.0, range: 70, falloff: { start: 30, end: 60, min: 0.75 },
    recoil: 0.011, color: 0x36393d, len: 0.7,
    sound: { freq: 900, dur: 0.09, boom: 0.7 },
    desc: '精密的5.56步枪，射速与精度兼备，远程点射爆头首选。',
  },
  sawedoff: {
    id: 'sawedoff', name: '双管截短霰弹', slot: 'secondary', price: 1300,
    damage: 15, pellets: 10, rpm: 160, mag: 2, reserve: 40, reserveMax: 80,
    reloadTime: 2.4, spread: 0.075, adsSpread: 0.055, auto: false,
    pellets: 10, headMult: 1.6, range: 18, falloff: { start: 5, end: 14, min: 0.2 },
    recoil: 0.05, color: 0x5a4228, len: 0.48,
    sound: { freq: 340, dur: 0.2, boom: 1.3 },
    desc: '截短双管——贴脸一炮撕碎一切，两发之间有生命危险的装填间隙。赌徒的武器。',
  },
  m79: {
    id: 'm79', name: 'M79 榴弹枪', slot: 'primary', price: 4200,
    damage: 30, rpm: 45, mag: 1, reserve: 20, reserveMax: 40,
    reloadTime: 3.0, spread: 0.012, adsSpread: 0.008, auto: false,
    pellets: 1, headMult: 1.5, range: 120, falloff: null, launcher: true,
    recoil: 0.04, color: 0x2e4030, len: 0.8,
    sound: { freq: 300, dur: 0.18, boom: 1.1 },
    desc: '单发肩射榴弹枪——抛物线飞行的榴弹碰物即炸，120范围杀伤。攻城锤般的火力，装填慢，走位要精。',
  },
  awm: {
    id: 'awm', name: 'AWM 狙击步枪', slot: 'primary', price: 3600,
    damage: 170, rpm: 42, mag: 5, reserve: 25, reserveMax: 50,
    reloadTime: 3.2, spread: 0.006, adsSpread: 0.0004, auto: false,
    pellets: 1, headMult: 2.5, range: 250, falloff: null, scope: true,
    recoil: 0.05, color: 0x273421, len: 0.95,
    sound: { freq: 420, dur: 0.22, boom: 1.4 },
    desc: '一公里外送丧尸回老家的反器材步枪，开镜后弹道笔直。',
  },
  m249: {
    id: 'm249', name: 'M249 轻机枪', slot: 'primary', price: 5200,
    damage: 26, rpm: 850, mag: 100, reserve: 300, reserveMax: 600,
    reloadTime: 4.6, spread: 0.048, adsSpread: 0.030, auto: true,
    pellets: 1, headMult: 2.0, range: 60, falloff: { start: 25, end: 55, min: 0.7 },
    recoil: 0.015, color: 0x23262a, len: 0.85, slowMove: 0.82,
    sound: { freq: 780, dur: 0.08, boom: 0.85 },
    desc: '100发弹链的移动火力网。举着它跑不快，但丧尸潮也过不来。',
  },

  /* ---------- 近战 ---------- */
  knife: {
    id: 'knife', name: '战术军刀', slot: 'melee', price: 0,
    damage: 42, rpm: 140, range: 2.3, arc: 0.55, melee: true,
    color: 0xb9c2cc, len: 0.5,
    sound: { whoosh: 1 },
    desc: '近身保命的最后手段。轻、快、无声。',
  },
  axe: {
    id: 'axe', name: '消防斧', slot: 'melee', price: 800,
    damage: 100, rpm: 70, range: 2.6, arc: 0.5, melee: true, wideArc: true,
    color: 0x9c2b23, len: 0.7,
    sound: { whoosh: 1.6 },
    desc: '一斧头一个。命中宽广的扇面，专治贴脸包围。',
  },
  chainsaw: {
    id: 'chainsaw', name: '电锯', slot: 'melee', price: 3200,
    damage: 30, rpm: 600, range: 2.0, arc: 0.4, melee: true, continuous: true,
    color: 0xd8641e, len: 0.85,
    sound: { whoosh: 0.5 },
    desc: '按住左键，让它们体验什么叫现代工业。绞肉机般的持续伤害。',
  },
};

/* ---------- 投掷武器 ---------- */
const THROWABLES = {
  frag: {
    id: 'frag', name: '破片手雷', price: 160, pack: 3, max: 8,
    damage: 150, radius: 6.5, fuse: 2.2, speed: 15, gravity: 13,
    color: 0x3d5a3d, selfMult: 0.35,
    desc: '范围爆炸伤害，对密集尸群效果拔群。小心别炸到自己。',
  },
  molotov: {
    id: 'molotov', name: '燃烧瓶', price: 130, pack: 3, max: 6,
    radius: 4.2, dps: 34, duration: 7, fuse: 2.6, speed: 13, gravity: 13,
    color: 0x8a4b1f, selfMult: 0.4,
    desc: '落地燃起火墙，持续灼烧范围内的丧尸——封路神器。',
  },
};
