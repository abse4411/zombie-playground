/* ============================================================
 * 掉落物系统（v3.5 → v18.2 拾取重构）
 * - 加权掉落表 + 稀有度色阶 + 专属模型 + 光柱引导
 * - v18.2：武器/道具掉落支持 E 键拾取与自动拾取开关（默认开）；
 *   武器拾取改为"槽满自动替换手中武器（旧枪落地）"；消耗品计数满后
 *   溢出入背包（storage item 条目），背包也满则无法拾取（留在地上）
 * - 玩家丢弃物带拾取延迟（防自动拾取瞬间回吸）
 * ============================================================ */
/* 掉落表（v19.7 掉落经济重排）：
 * - 整体掉率下调（空掉落 12→22），且越贵重/越稀有的物品权重越低
 * - 实际掉率再乘难度系数：普通×0.7 / 困难×0.85 / 噩梦×1.0（越难掉得越多）
 * - 投掷物掉落数量 2 → 1 */
const LOOT_TABLE = [
  { id: 'cash',   weight: 26, rarity: 0 },   // 现金包（最常见）
  { id: 'ammo',   weight: 20, rarity: 0 },   // 弹药盒（当前武器备弹+35%）
  { id: 'medkit', weight: 9,  rarity: 1 },   // 医疗包
  { id: 'frag',   weight: 5,  rarity: 1 },   // 手雷×1
  { id: 'impact', weight: 2.2, rarity: 2 },  // 极爆手雷×1（稀有，v20.4）
  { id: 'sticky', weight: 2, rarity: 2 },    // 粘性炸药×1（v22.2）
  { id: 'gas', weight: 2, rarity: 1 },       // 毒气雷×1（v22.2）
  { id: 'molo',   weight: 4,  rarity: 1 },   // 燃烧瓶×1
  { id: 'armorplate', weight: 2,  rarity: 1 },   // 护甲板（贵）
  { id: 'ammop',  weight: 1.6, rarity: 1 },  // 主武器弹药袋（贵）
  { id: 'ammos',  weight: 1.6, rarity: 1 },  // 副武器弹药袋（贵）
  { id: 'adrenaline', weight: 1.2, rarity: 2 },   // 肾上腺素（稀有）
  { id: 'big',    weight: 2.5, rarity: 3 },  // 大奖：现金×5（史诗）
  { id: 'weapon', weight: 3,  rarity: 2 },   // 稀有武器掉落（稀有）
  { id: 'none',   weight: 40, rarity: -1 },  // 显式空掉落（v19.9 大幅下调：普通难度约65%不掉落）
];
/* 难度掉落系数（v19.9 大幅下调）：难度越高掉落越多 */
const LOOT_DIFF_MULT = { normal: 0.28, hard: 0.43, nightmare: 0.73 };
/* 武器掉落稀有度池（v9.5）：白60/绿25/蓝10/紫5 → 对应商城价格档 */
const WEAPON_DROP_TIERS = [
  { rarity: 0, priceRange: [0, 1600], chance: 0.60, lvl: 0 },
  { rarity: 1, priceRange: [1600, 3000], chance: 0.25, lvl: 1 },
  { rarity: 2, priceRange: [3000, 4500], chance: 0.10, lvl: 1 },
  { rarity: 3, priceRange: [4500, 99999], chance: 0.05, lvl: 2 },
];
function rollWeaponDrop() {
  const pool = Object.values(WEAPONS).filter(w => !w.melee && !w.unlockBy && w.price > 0);
  const r = Math.random();
  let acc = 0, tier = WEAPON_DROP_TIERS[0];
  for (const t of WEAPON_DROP_TIERS) { acc += t.chance; if (r <= acc) { tier = t; break; } }
  const inRange = pool.filter(w => w.price >= tier.priceRange[0] && w.price < tier.priceRange[1]);
  const def = (inRange.length ? inRange : pool)[randi(0, (inRange.length ? inRange : pool).length - 1)];
  const inst = new WeaponInstance(def);
  inst.lvl = tier.lvl;
  inst.mag = inst.magSize;
  inst.reserve = inst.def.reserve;
  return { inst, rarity: tier.rarity, def };
}
// 按价格反推稀有度（玩家丢弃/继承武器用）
function rarityForPrice(price) {
  if (price >= 4500) return 3;
  if (price >= 3000) return 2;
  if (price >= 1600) return 1;
  return 0;
}
const LOOT_RARITY_COLORS = [0xb8c0cc, 0x52d273, 0x3aa0ff, 0xb05cff];
const LOOT_RARITY_NAMES = ['普通', '优秀', '稀有', '史诗'];
/* 需要容量判定的道具类掉落（v18.2）：计数满→溢出背包→背包满则拒拾 */
const LOOT_ITEM_KINDS = ['medkit', 'armorplate', 'ammobag', 'adrenaline', 'armorkit', 'ammobox'];   // v22.2
/* 掉落物专属模型构建器 + 名称（v8.9）：不再是无差别方块 */
const LOOT_MODELS = {
  cash: () => {
    const g = new THREE.Group();
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.16), new THREE.MeshStandardMaterial({ color: 0x3fae5a, roughness: 0.6, emissive: 0x1a5a2a, emissiveIntensity: 0.4 }));
    const bill2 = bill.clone(); bill2.position.y = 0.035; bill2.rotation.y = 0.3;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.18), new THREE.MeshStandardMaterial({ color: 0xe8e4c8 }));
    g.add(bill, bill2, band);
    return g;
  },
  ammo: () => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.2), new THREE.MeshStandardMaterial({ color: 0x4a5238, roughness: 0.55 }));
    for (let i = 0; i < 4; i++) {
      const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xd8b048, metalness: 0.8, roughness: 0.3 }));
      bullet.position.set(-0.09 + i * 0.06, 0.12, 0);
      g.add(bullet);
    }
    g.add(box);
    return g;
  },
  medkit: () => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.18), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 }));
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.02), new THREE.MeshStandardMaterial({ color: 0xd83030, emissive: 0x901010, emissiveIntensity: 0.5 }));
    crossV.position.set(0, 0, 0.095);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0xd83030, emissive: 0x901010, emissiveIntensity: 0.5 }));
    crossH.position.set(0, 0, 0.095);
    g.add(box, crossV, crossH);
    return g;
  },
  frag: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3d5a3d, roughness: 0.5 }));
    body.scale.y = 1.25;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.8 }));
    neck.position.y = 0.14;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.8 }));
    ring.position.set(0.06, 0.17, 0);
    g.add(body, neck, ring);
    return g;
  },
  sticky: () => {
    const g = new THREE.Group();
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.14), new THREE.MeshStandardMaterial({ color: 0x6a5a2a, roughness: 0.9 }));
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.045, 0.15), new THREE.MeshStandardMaterial({ color: 0xc8b868 }));
    tape.position.y = 0.01;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff4030 }));
    led.position.set(0.07, 0.06, 0);
    g.add(bag, tape, led);
    return g;
  },
  emp: () => {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.4, metalness: 0.5 }));
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 12), new THREE.MeshStandardMaterial({ color: 0x8ab8e8, metalness: 0.7 }));
    coil.rotation.x = Math.PI / 2; coil.position.y = 0.06;
    g.add(shell, coil);
    return g;
  },
  gas: () => {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x5a7a2a, roughness: 0.6 }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.035, 10), new THREE.MeshStandardMaterial({ color: 0xd8d0a0 }));
    band.position.y = 0.04;
    const vent = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.07, 8), new THREE.MeshStandardMaterial({ color: 0x3a4a1a }));
    vent.position.y = 0.15;
    g.add(shell, band, vent);
    return g;
  },
  impact: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.45, emissive: 0x400a0a, emissiveIntensity: 0.5 }));
    body.scale.y = 1.25;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.04, 12), new THREE.MeshStandardMaterial({ color: 0xe8b83a }));
    stripe.position.y = 0.02;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.8 }));
    neck.position.y = 0.14;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5040 }));
    led.position.y = 0.18;
    g.add(body, stripe, neck, led);
    return g;
  },
  molo: () => {
    const g = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.24, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.4, transparent: true, opacity: 0.85, emissive: 0x502800, emissiveIntensity: 0.3 }));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
    neck.position.y = 0.16;
    const rag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: 0xd8c8a0 }));
    rag.position.set(0.03, 0.22, 0); rag.rotation.z = 0.5;
    g.add(bottle, neck, rag);
    return g;
  },
  attractor: () => {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.4, metalness: 0.4 }));
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0x9fb4c8, metalness: 0.8 }));
    antenna.position.y = 0.18;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66aaff }));
    led.position.set(0, 0.06, 0.085);
    g.add(shell, antenna, led);
    return g;
  },
  armorplate: () => {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.06), new THREE.MeshStandardMaterial({ color: 0x2e3638, roughness: 0.35, metalness: 0.55 }));
    plate.rotation.x = -0.35;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.07), new THREE.MeshStandardMaterial({ color: 0x4a3226 }));
    strap.position.y = 0.06;
    g.add(plate, strap);
    return g;
  },
  ammop: () => buildAmmoBagModel(0x5a6648, '🟢'),
  ammos: () => buildAmmoBagModel(0x3f5a7a, '🔵'),
  adrenaline: () => {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 10), new THREE.MeshStandardMaterial({ color: 0x8ad8ff, roughness: 0.2, transparent: true, opacity: 0.9, emissive: 0x1a4a66, emissiveIntensity: 0.6 }));
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xc8d0da, metalness: 0.85 }));
    needle.position.y = -0.19;
    const plunger = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 }));
    plunger.position.y = 0.17;
    g.add(tube, needle, plunger);
    return g;
  },
  big: () => {
    const g = new THREE.Group();
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.16), new THREE.MeshStandardMaterial({ color: 0xc8a030, roughness: 0.35, metalness: 0.5, emissive: 0x6a4a08, emissiveIntensity: 0.5 }));
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0xe8d090, metalness: 0.9 }));
    seal.rotation.z = Math.PI / 2;
    const sym = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xc0a040, emissiveIntensity: 0.8 }));
    sym.position.z = 0.09;
    g.add(bag, seal, sym);
    return g;
  },
};
const LOOT_LABELS = {
  cash: '💵 现金', ammo: '🔸 弹药盒', medkit: '🧪 医疗包',
  frag: '💣 手雷', impact: '💣 极爆手雷', sticky: '🧨 粘性炸药', emp: '📡 电磁脉冲雷', gas: '☠ 毒气雷', molo: '🔥 燃烧瓶', attractor: '🧲 声波诱饵',
  armorplate: '🛡 护甲板', ammop: '🟢 主武器弹药', ammos: '🔵 副武器弹药', adrenaline: '⚡ 肾上腺素',
  big: '⭐ 大奖奖金',
};

/* 弹药袋模型（v19.6）：主武器=橄榄绿 / 副武器=蓝灰 */
function buildAmmoBagModel(color) {
  const g = new THREE.Group();
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.18), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.06, 0.19), new THREE.MeshStandardMaterial({ color: 0xc84030 }));
  band.position.y = 0.02;
  for (let i = 0; i < 3; i++) {
    const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.13, 8), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.75, roughness: 0.3 }));
    bullet.position.set(-0.07 + i * 0.07, 0.16, 0);
    g.add(bullet);
  }
  g.add(pouch, band);
  return g;
}

class LootDrop {
  /* opts: { inst(武器实例), rarity, amount(拾取数量,默认2), delay(拾取延迟秒), toss(抛落动画) } */
  constructor(kind, x, z, value, opts = {}) {
    this.kind = kind; this.value = value || 0;
    this.amount = opts.amount || 1;
    this.weaponInst = opts.inst || null;
    this.pickupDelay = opts.delay || 0;
    this._tossT = opts.toss ? 0.4 : 0;
    this.life = 18; this.dead = false;
    this.phase = rand(0, TAU);
    const rarity = this.weaponInst ? (opts.rarity !== undefined ? opts.rarity : 1)
      : (opts.rarity !== undefined ? opts.rarity : (LOOT_TABLE.find(l => l.id === kind)?.rarity ?? 0));
    this.rarity = Math.max(0, Math.min(3, rarity | 0));   // 先赋值再建标牌（修复标签"undefined"前缀）
    const color = LOOT_RARITY_COLORS[this.rarity];
    this.group = new THREE.Group();
    // 专属模型（v8.9）：现金捆/弹药盒/医疗箱/手雷/燃烧瓶/枪械（v18.2 修复：武器模型在构造期传入即渲染）
    const modelHolder = new THREE.Group();
    const buildModel = LOOT_MODELS[kind];
    if (this.weaponInst) {
      const gun = buildGunModel(this.weaponInst.def, { outlines: false, tint: 0xffffff });
      const gb = new THREE.Box3().setFromObject(gun);
      const gs = 0.85 / (Math.max(gb.getSize(new THREE.Vector3()).x, 0.5) || 1);
      gun.scale.setScalar(gs);
      gun.position.y = -gb.getCenter(new THREE.Vector3()).y * gs;
      modelHolder.add(gun);
    } else if (buildModel) modelHolder.add(buildModel());
    else modelHolder.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2d33 })));
    modelHolder.position.y = 0.3;
    // 稀有度光圈底座
    const ringM = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.3, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    ringM.rotation.x = -Math.PI / 2;
    ringM.position.y = 0.02;
    // 文字标牌（v8.9）：canvas sprite 常显名称
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256; labelCanvas.height = 56;
    const lctx = labelCanvas.getContext('2d', { willReadFrequently: true });
    lctx.font = 'bold 30px "Microsoft YaHei", "PingFang SC", sans-serif';
    lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
    let label = this.name();
    const tw2 = Math.min(240, lctx.measureText(label).width + 28);
    lctx.fillStyle = 'rgba(6,8,12,0.72)';
    lctx.fillRect((256 - tw2) / 2, 6, tw2, 44);
    lctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
    lctx.lineWidth = 3;
    lctx.strokeRect((256 - tw2) / 2, 6, tw2, 44);
    lctx.fillStyle = '#fff';
    lctx.fillText(label, 128, 30, 226);
    const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.__ownedTex = true;
    if (THREE.sRGBEncoding) labelTex.encoding = THREE.sRGBEncoding;
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
    labelSprite.scale.set(1.15, 0.25, 1);
    labelSprite.position.y = 0.78;
    labelSprite.renderOrder = 990;
    // 光柱（稀有度引导）
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.14, 3.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 1.7;
    this.group.add(modelHolder, ringM, labelSprite, beam);
    this.group.position.set(x, 0, z);
    this.box = modelHolder; this.beam = beam; this.rarity = rarity; this.labelSprite = labelSprite;
    ENGINE.scene.add(this.group);
  }

  // 显示名（拾取列表 / 标牌共用）
  name() {
    if (this.weaponInst) return `${['◆', '◆◆', '◆◆◆', '◆◆◆◆'][this.rarity]} ${this.weaponInst.def.name}${this.weaponInst.lvl ? ' Lv.' + this.weaponInst.lvl : ''}`;
    const base = LOOT_LABELS[this.kind] || '📦 物资';
    if (['frag', 'molo', 'impact', 'sticky', 'emp', 'gas'].includes(this.kind)) return `${base}×${this.amount}`;
    return base;
  }

  // 是否适合自动拾取（v18.2 重设计）：只自动拾取"不会占用背包容量"的东西
  // - 武器：一律需按 E 亲手拾取（替换规则不变）
  // - 道具（医疗包/护甲板/弹药袋/肾上腺素）：计数未满→自动；已满（拾取将溢入背包）→需按 E
  // - 投掷物：计数已满时不自动吞掉（避免浪费），需按 E
  // - 现金/弹药盒/大奖：永远自动
  autoCollects(game) {
    if (this.weaponInst) return false;
    const p = game.player;
    if (LOOT_ITEM_KINDS.includes(this.kind)) {
      const cap = this.kind === 'medkit' ? GAMECONFIG.inventory.medkitMax : GAMECONFIG.items[this.kind].max;
      return p.itemCount(this.kind) < cap;
    }
    // v18.6 修复：掉落种类 'molo' 需映射到投掷物键 'molotov'，查表也用映射后的键
    // （旧代码 THROWABLES['molo'] 为 undefined → '.max' 抛错 → 整帧更新中断）
    const tb = { frag: 'frag', impact: 'impact', sticky: 'sticky', emp: 'emp', gas: 'gas', molo: 'molotov', attractor: 'attractor' }[this.kind];
    if (tb) {
      const tDef = THROWABLES[tb];
      const tCur = p.throwables[tb];
      if (!tDef || !tCur) return true;
      return tCur.count < tDef.max;
    }
    return true;
  }

  // 容量检查（v18.2）：返回 {ok, reason}——武器永不受阻（自动替换），道具满则溢出背包判定
  canCollect(game) {
    if (!this.weaponInst && LOOT_ITEM_KINDS.includes(this.kind)) {
      const p = game.player;
      const cap = this.kind === 'medkit' ? GAMECONFIG.inventory.medkitMax : GAMECONFIG.items[this.kind].max;
      const cur = this.kind === 'medkit' ? p.medkits : (p.items[this.kind] || 0);
      if (cur < cap) return { ok: true };
      if (p.storage.length < p.storageMax) return { ok: true };
      return { ok: false, reason: '背包已满' };
    }
    return { ok: true };
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.collect(game, false); return; }
    // 拾取延迟（玩家丢弃物防回吸）
    if (this.pickupDelay > 0) {
      this.pickupDelay -= dt;
      this.box.rotation.y += dt * 1.6;
      return;
    }
    // 远处隐藏光柱与箱体（GPU填充率优化，磁吸范围远小于此）
    const p0 = game.player.pos;
    const far = dist2d(this.group.position.x, this.group.position.z, p0.x, p0.z) > 32;
    if (this.group.visible === far) this.group.visible = !far;
    if (far) return;
    // 浮动旋转
    this.box.rotation.y += dt * 1.6;
    let baseY = 0.3 + Math.sin(ENGINE.time * 2.4 + this.phase) * 0.07;
    if (this._tossT > 0) {   // 抛落动画（v18.2）：从高处弹落
      this._tossT -= dt;
      baseY += Math.max(0, this._tossT / 0.4) * 1.1;
    }
    this.box.position.y = baseY;
    this.beam.material.opacity = 0.22 + Math.sin(ENGINE.time * 3 + this.phase) * 0.08;
    if (this.life < 4) this.group.visible = Math.sin(ENGINE.time * 8) > -0.4; // 临消闪烁
    // 拾取规则（v19.8）：
    // - 武器：原地躺着不移动，按 E 亲手拾取（触发替换规则）
    // - 可自动拾取物（现金/弹药/计数未满的道具与投掷物）：1.8m 内吸附
    //   （越近吸力越强的"真空吸"，不会远距离拖拽跟随），触身即收入
    // - 道具计数已满（将溢入背包）/投掷物已满：需按 E 收取
    // - 双满（计数满+背包满）：完全不可拾，列表红字提示
    const p = game.player.pos;
    const d = dist2d(this.group.position.x, this.group.position.z, p.x, p.z);
    // v21.9：高度门——二楼不再吸附/触碰一楼掉落物（掉落物贴近其所在地面）
    if (Math.abs(p.y - this.group.position.y) > 1.6) return;
    if (!this.canCollect(game).ok) return;
    if (this.autoCollects(game)) {
      if (d < 1.8) {
        // 吸附：吸力随距离拉近而增强，近距离瞬间吸入
        const k = clamp(dt * (3.5 + (1.8 - d) * 10), 0, 1);
        this.group.position.x = lerp(this.group.position.x, p.x, k);
        this.group.position.z = lerp(this.group.position.z, p.z, k);
      }
      if (d < 0.7) this.collect(game, true);
    }
  }

  /* 拾取入口（自动/E键共用）。picked=false 为过期回收。返回 'collected' | 'blocked' */
  collect(game, picked) {
    if (picked) {
      const cc = this.canCollect(game);
      if (!cc.ok) {
        // 背包已满：留在地上 + 节流提示（v18.2）
        if (ENGINE.time - (game._blockTipT || 0) > 2.5) {
          game._blockTipT = ENGINE.time;
          HUD.toast(`⚠ ${this.name()}：${cc.reason}——先丢弃一些物品（[G]）再拾取`);
          AUDIO.denied();
        }
        // 推出磁吸范围外一点，避免持续贴脸判定
        return 'blocked';
      }
    }
    this.dead = true;
    disposeObject3D(this.group);
    ENGINE.scene.remove(this.group);
    if (!picked) return 'collected';
    // 首次拾取引导：告诉玩家背包入口（战利品/武器架/消耗品都在背包里）
    if (!game._lootTipShown) {
      game._lootTipShown = true;
      HUD.toast(INPUT.touch ? '🎒 战利品已入背包，点右下角🎒查看' : '🎒 战利品已入背包，按 Tab 查看（医疗包按 H 使用）');
    }
    const p = game.player;
    if (typeof SAVE !== 'undefined' && SAVE.data) SAVE.data.totalLoots = (SAVE.data.totalLoots || 0) + 1;
    switch (this.kind) {
      case 'cash':
        p.addMoney(this.value);
        HUD.pickup(`💰 现金 +$${this.value}`, this.rarity);
        break;
      case 'ammo': {
        const w = game.weapons.w;
        if (w && !w.def.melee) {
          const add = Math.ceil(w.def.reserve * p.reserveMult * 0.35);
          w.reserve = Math.min(Math.floor(w.def.reserve * p.reserveMult * 1.2), w.reserve + add);
          HUD.pickup(`🔸 ${w.def.name} 备弹 +${add}`, this.rarity);
        } else { p.addMoney(60); HUD.pickup('💰 现金 +$60', 0); }
        break;
      }
      case 'medkit':
        this._collectItem(game, 'medkit', 1);
        break;
      case 'armorplate':
        this._collectItem(game, 'armorplate', 1);
        break;
      case 'ammop':
      case 'ammos':
        this._collectAmmoBag(game, this.kind === 'ammop' ? 'primary' : 'secondary');
        break;
      case 'adrenaline':
        this._collectItem(game, 'adrenaline', 1);
        break;
      case 'frag':
        p.throwables.frag.count = Math.min(THROWABLES.frag.max, p.throwables.frag.count + this.amount);
        HUD.pickup(`💣 手雷 ×${this.amount}`, this.rarity);
        break;
      case 'sticky':
        p.throwables.sticky.count = Math.min(THROWABLES.sticky.max, p.throwables.sticky.count + this.amount);
        HUD.pickup(`🧨 粘性炸药 ×${this.amount}`, this.rarity);
        break;
      case 'gas':
        p.throwables.gas.count = Math.min(THROWABLES.gas.max, p.throwables.gas.count + this.amount);
        HUD.pickup(`☠ 毒气雷 ×${this.amount}`, this.rarity);
        break;
      case 'impact':
        p.throwables.impact.count = Math.min(THROWABLES.impact.max, p.throwables.impact.count + this.amount);
        HUD.pickup(`💣 极爆手雷 ×${this.amount}`, this.rarity);
        break;
      case 'molo':
        p.throwables.molotov.count = Math.min(THROWABLES.molotov.max, p.throwables.molotov.count + this.amount);
        HUD.pickup(`🔥 燃烧瓶 ×${this.amount}`, this.rarity);
        break;
      case 'attractor':
        p.throwables.attractor.count = Math.min(THROWABLES.attractor.max, p.throwables.attractor.count + this.amount);
        HUD.pickup(`🧲 声波诱饵 ×${this.amount}`, this.rarity);
        break;
      case 'big':
        p.addMoney(this.value);
        HUD.pickup(`⭐ 大奖现金 +$${this.value}！`, this.rarity);
        AUDIO.streak();
        break;
      case 'weapon': {
        const inst = this.weaponInst;
        const slot = inst.def.slot;
        if (p.rack[slot].length < (p.slotMax ? p.slotMax[slot] : 2)) {
          p.rack[slot].push(inst);
          p.weapons[slot] = inst;
          p.current = slot;
          if (game.weapons) game.weapons._buildViewmodel();
          HUD.pickup(`🔫 ${inst.def.name} 已装备！`, this.rarity);
          AUDIO.streak();
        } else {
          // 槽满（v18.2 BR式替换）：顶替手中武器，旧枪落地成新拾取物
          const old = p.weapons[slot];
          const oldIdx = p.rack[slot].indexOf(old);
          p.rack[slot].push(inst);
          p.weapons[slot] = inst;
          p.current = slot;
          if (oldIdx >= 0) p.rack[slot].splice(oldIdx, 1);
          if (game.weapons) game.weapons._buildViewmodel();
          const pos = tossPos(game);
          const oldDrop = new LootDrop('weapon', pos.x, pos.z, 0, {
            inst: old, rarity: rarityForPrice(old.def.price), delay: 1.4, toss: true,
          });
          game.loots.push(oldDrop);
          HUD.pickup(`🔄 ${inst.def.name} 替换了 ${old.def.name}（旧枪已丢在地上）`, this.rarity);
          AUDIO.streak();
        }
        break;
      }
    }
    AUDIO.purchase();
    return 'collected';
  }

  // 弹药袋拾取即用（v19.6）：立即补满对应槽位全部武器的备弹与弹匣（含升级弹匣）
  _collectAmmoBag(game, slot) {
    const p = game.player;
    const names = { primary: '主武器', secondary: '副武器' };
    let any = false;
    for (const inst of p.rack[slot]) {
      if (!inst || inst.def.melee) continue;
      const full = Math.floor(inst.def.reserve * p.reserveMult * (inst.reserveMaxMult || 1) * 1.2);
      if (inst.reserve < full) { inst.reserve = full; any = true; }
      if (inst.mag < inst.magSize) { inst.mag = inst.magSize; any = true; }
    }
    if (any) HUD.pickup(`🎒 ${names[slot]}弹药袋已分装——${names[slot]}全部补满`, this.rarity);
    else { p.addMoney(40); HUD.pickup('💰 弹药已满 → 现金 +$40', 0); }
  }


  _collectItem(game, kind, n) {
    const p = game.player;
    const def = kind === 'medkit' ? { icon: '🧪', name: '医疗包' } : GAMECONFIG.items[kind];
    const cap = kind === 'medkit' ? GAMECONFIG.inventory.medkitMax : def.max;
    const cur = p.itemCount(kind);
    if (cur < cap) {
      if (kind === 'medkit') p.medkits = Math.min(cap, p.medkits + n);
      else p.items[kind] = Math.min(cap, p.items[kind] + n);
      HUD.pickup(`${def.icon} ${def.name} ×${n}（${p.itemCount(kind)}/${cap}）`, this.rarity);
    } else if (p.storageAdd({ kind: 'item', itemId: kind, count: n, name: def.name })) {
      HUD.pickup(`${def.icon} ${def.name} 已溢出入背包（Tab 查看）`, this.rarity);
    } else {
      p.addMoney(60);
      HUD.pickup('💰 背包已满 → 现金 +$60', 0);
    }
  }

  dispose() {
    disposeObject3D(this.group);
    ENGINE.scene.remove(this.group);
  }
}

// 玩家脚前抛掷落点（v18.2）：面朝方向 3.2m，限制在地图内
function tossPos(game) {
  const p = game.player;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const S = ENGINE.mapDef ? ENGINE.mapDef.size : 60;
  return {
    x: clamp(p.pos.x + fx * 3.2, -S + 1, S - 1),
    z: clamp(p.pos.z + fz * 3.2, -S + 1, S - 1),
  };
}

// 生成地面掉落物（v18.2 统一入口）：玩家丢弃/背包丢弃/成就奖励共用
function spawnGroundDrop(game, kind, x, z, opts = {}) {
  const drop = new LootDrop(kind, x, z, opts.value || 0, opts);
  game.loots.push(drop);
  return drop;
}

// 掷掉落表（击杀时调用；精英/Boss提高大奖权重；难度越高掉落越多 v19.7）
function rollLoot(z, game) {
  let table = LOOT_TABLE;
  // 难度系数：普通×0.7 / 困难×0.85 / 噩梦×1.0（乘所有非空掉落权重，空掉落不变）
  const diffKey = (game && game.mode && game.mode.diffKey) || (game && game._missionDiff) || 'normal';
  const diffMult = LOOT_DIFF_MULT[diffKey] !== undefined ? LOOT_DIFF_MULT[diffKey] : 0.7;
  table = table.map(l => ({ ...l, weight: l.id === 'none' ? l.weight : l.weight * diffMult }));
  // 搜刮者 Perk：压缩空掉落权重
  const sc = game && game.player ? (game.player.perks.scavenger || 0) : 0;
  if (sc > 0) {
    const cut = PERKS.scavenger.tiers[sc - 1].val;
    table = table.map(l => ({ ...l, weight: l.id === 'none' ? l.weight * (1 - cut) : l.weight }));
  }
  if (z.affix || z.boss) {
    // 精英/Boss：提升大奖/武器/医疗权重
    table = LOOT_TABLE.map(l => ({ ...l, weight: l.id === 'big' ? l.weight * 4 : l.id === 'weapon' ? l.weight * 2.5 : l.id === 'none' ? l.weight * 0.4 : l.weight }));
  }
  const drop = weightedPick(table);
  if (drop.id === 'none') return null;
  const value = drop.id === 'cash' ? randi(45, 130) : drop.id === 'big' ? randi(500, 900) : 0;
  return { id: drop.id, rarity: drop.rarity, value };
}

// 在丧尸位置生成掉落物
function spawnLoot(game, z) {
  const roll = rollLoot(z, game);
  if (!roll) return;
  const a = rand(0, TAU), r = rand(0.4, 1.1);
  const x = clamp(z.pos.x + Math.cos(a) * r, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
  const zz = clamp(z.pos.z + Math.sin(a) * r, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
  if (roll.id === 'weapon') {
    const wd = rollWeaponDrop();
    game.loots.push(new LootDrop('weapon', x, zz, roll.value, { inst: wd.inst, rarity: wd.rarity }));
    return;
  }
  game.loots.push(new LootDrop(roll.id, x, zz, roll.value));
}
