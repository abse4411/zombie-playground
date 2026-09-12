/* ============================================================
 * 掉落物系统（v3.5）—— 加权掉落表 + 稀有度色阶
 * 调研依据: 加权表含显式空掉落; 色阶白绿蓝紫橙; 光柱引导+音效反馈
 * ============================================================ */
const LOOT_TABLE = [
  { id: 'cash',   weight: 30, rarity: 0 },   // 现金包
  { id: 'ammo',   weight: 22, rarity: 0 },   // 弹药盒（当前武器备弹+35%）
  { id: 'medkit', weight: 12, rarity: 1 },   // 医疗包（入背包，按H使用）
  { id: 'frag',   weight: 8,  rarity: 1 },   // 手雷×2
  { id: 'molo',   weight: 6,  rarity: 1 },   // 燃烧瓶×2
  { id: 'big',    weight: 4,  rarity: 3 },   // 大奖：现金×5
  { id: 'weapon', weight: 6,  rarity: 2 },   // 稀有武器掉落（v9.5）
  { id: 'none',   weight: 12, rarity: -1 },  // 显式空掉落
];
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
const LOOT_RARITY_COLORS = [0xb8c0cc, 0x52d273, 0x3aa0ff, 0xb05cff];
const LOOT_RARITY_NAMES = ['普通', '优秀', '稀有', '史诗'];
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
const LOOT_LABELS = { cash: '💵 现金', ammo: '🔸 弹药盒', medkit: '🧪 医疗包', frag: '💣 手雷×2', molo: '🔥 燃烧瓶×2', big: '⭐ 大奖奖金' };

class LootDrop {
  constructor(kind, x, z, value) {
    this.kind = kind; this.value = value || 0;
    this.life = 18; this.dead = false;
    this.phase = rand(0, TAU);
    const rarity = LOOT_TABLE.find(l => l.id === kind)?.rarity ?? 0;
    const color = LOOT_RARITY_COLORS[rarity];
    this.group = new THREE.Group();
    // 专属模型（v8.9）：现金捆/弹药盒/医疗箱/手雷/燃烧瓶/大奖袋
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
    let label = LOOT_LABELS[kind] || (kind === 'ammo' ? '🔸 弹药盒' : '📦 物资');
    if (this.weaponInst) label = `${['◆', '◆◆', '◆◆◆', '◆◆◆◆'][this.rarity]} ${this.weaponInst.def.name}${this.weaponInst.lvl ? ' Lv.' + this.weaponInst.lvl : ''}`;
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
    // 自发光替代点光源（避免动态光照导致的材质重编译与填充率爆炸）
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this._collect(game, false); return; }
    // 远处隐藏光柱与箱体（GPU填充率优化，磁吸范围远小于此）
    const p0 = game.player.pos;
    const far = dist2d(this.group.position.x, this.group.position.z, p0.x, p0.z) > 32;
    if (this.group.visible === far) this.group.visible = !far;
    if (far) return;
    // 浮动旋转
    this.box.rotation.y += dt * 1.6;
    this.box.position.y = 0.3 + Math.sin(ENGINE.time * 2.4 + this.phase) * 0.07;
    this.beam.material.opacity = 0.22 + Math.sin(ENGINE.time * 3 + this.phase) * 0.08;
    if (this.life < 4) this.group.visible = Math.sin(ENGINE.time * 8) > -0.4; // 临消闪烁
    // 磁吸拾取
    const p = game.player.pos;
    const d = dist2d(this.group.position.x, this.group.position.z, p.x, p.z);
    if (d < 2.6) {
      const k = clamp(dt * 6, 0, 1);
      this.group.position.x = lerp(this.group.position.x, p.x, k);
      this.group.position.z = lerp(this.group.position.z, p.z, k);
    }
    if (d < 0.85) this._collect(game, true);
  }

  _collect(game, picked) {
    this.dead = true;
    disposeObject3D(this.group);
    ENGINE.scene.remove(this.group);
    if (!picked) return;
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
        if (p.medkits < GAMECONFIG.inventory.medkitMax) {
          p.medkits++;
          HUD.pickup('🧪 医疗包（按 H 使用）', this.rarity);
        } else { p.addMoney(80); HUD.pickup('💰 背包已满 → 现金 +$80', 0); }
        break;
      case 'frag':
        p.throwables.frag.count = Math.min(THROWABLES.frag.max, p.throwables.frag.count + 2);
        HUD.pickup('💣 手雷 ×2', this.rarity);
        break;
      case 'molo':
        p.throwables.molotov.count = Math.min(THROWABLES.molotov.max, p.throwables.molotov.count + 2);
        HUD.pickup('🔥 燃烧瓶 ×2', this.rarity);
        break;
      case 'big':
        p.addMoney(this.value);
        HUD.pickup(`⭐ 大奖现金 +$${this.value}！`, this.rarity);
        AUDIO.streak();
        break;
      case 'weapon': {
        const inst = this.weaponInst;
        const slot = inst.def.slot;
        if (p.rack[slot].length < p.EQUIP_MAX) {
          p.rack[slot].push(inst);
          p.weapons[slot] = inst;
          p.current = slot;
          if (game.weapons) game.weapons._buildViewmodel();
          HUD.pickup(`🔫 ${inst.def.name} 已装备！`, this.rarity);
          AUDIO.streak();
        } else if (p.storageAdd({ kind: 'weapon', inst })) {
          HUD.pickup(`🎒 ${inst.def.name} 已入背包（Tab 换装）`, this.rarity);
          AUDIO.streak();
        } else {
          const salvage = Math.round(inst.def.price * 0.35);
          p.addMoney(salvage);
          HUD.pickup(`⚠ 背包已满 → ${inst.def.name} 折现 +$${salvage}`, this.rarity);
        }
        break;
      }
    }
    AUDIO.purchase();
  }

  dispose() {
    disposeObject3D(this.group);
    ENGINE.scene.remove(this.group);
  }
}

// 掷掉落表（击杀时调用；精英/Boss提高大奖权重）
function rollLoot(z, game) {
  let table = LOOT_TABLE;
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
  const drop = new LootDrop(roll.id, x, zz, roll.value);
  if (roll.id === 'weapon') {
    const wd = rollWeaponDrop();
    drop.weaponInst = wd.inst;
    drop.rarity = wd.rarity;
  }
  game.loots.push(drop);
}
