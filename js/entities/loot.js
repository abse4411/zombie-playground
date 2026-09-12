/* ============================================================
 * 掉落物系统（v3.5）—— 加权掉落表 + 稀有度色阶
 * 调研依据: 加权表含显式空掉落; 色阶白绿蓝紫橙; 光柱引导+音效反馈
 * ============================================================ */
const LOOT_TABLE = [
  { id: 'cash',   weight: 32, rarity: 0 },   // 现金包
  { id: 'ammo',   weight: 24, rarity: 0 },   // 弹药盒（当前武器备弹+35%）
  { id: 'medkit', weight: 13, rarity: 1 },   // 医疗包（入背包，按H使用）
  { id: 'frag',   weight: 8,  rarity: 1 },   // 手雷×2
  { id: 'molo',   weight: 6,  rarity: 1 },   // 燃烧瓶×2
  { id: 'big',    weight: 4,  rarity: 3 },   // 大奖：现金×5
  { id: 'none',   weight: 13, rarity: -1 },  // 显式空掉落
];
const LOOT_RARITY_COLORS = [0xb8c0cc, 0x52d273, 0x3aa0ff, 0xb05cff];
const LOOT_RARITY_NAMES = ['普通', '优秀', '稀有', '史诗'];

class LootDrop {
  constructor(kind, x, z, value) {
    this.kind = kind; this.value = value || 0;
    this.life = 18; this.dead = false;
    this.phase = rand(0, TAU);
    const rarity = LOOT_TABLE.find(l => l.id === kind)?.rarity ?? 0;
    const color = LOOT_RARITY_COLORS[rarity];
    this.group = new THREE.Group();
    // 主体：发光小箱
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.26, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.4, emissive: color, emissiveIntensity: 0.25 })
    );
    box.position.y = 0.14;
    // 类型图标色条
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.08, 0.36),
      new THREE.MeshBasicMaterial({ color })
    );
    band.position.y = 0.14;
    // 光柱（稀有度引导）
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.14, 3.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 1.7;
    this.group.add(box, band, beam);
    this.group.position.set(x, 0, z);
    this.box = box; this.beam = beam; this.rarity = rarity;
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
    this.box.position.y = 0.14 + Math.sin(ENGINE.time * 2.4 + this.phase) * 0.06;
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
    ENGINE.scene.remove(this.group);
    if (!picked) return;
    const p = game.player;
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
    }
    AUDIO.purchase();
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

// 掷掉落表（击杀时调用；精英/Boss提高大奖权重）
function rollLoot(z) {
  let table = LOOT_TABLE;
  // 搜刮者 Perk：压缩空掉落权重
  const sc = game.player ? (game.player.perks.scavenger || 0) : 0;
  if (sc > 0) {
    const cut = PERKS.scavenger.tiers[sc - 1].val;
    table = table.map(l => ({ ...l, weight: l.id === 'none' ? l.weight * (1 - cut) : l.weight }));
  }
  if (z.affix || z.boss) {
    // 精英/Boss：提升大奖与医疗权重
    table = LOOT_TABLE.map(l => ({ ...l, weight: l.id === 'big' ? l.weight * 4 : l.id === 'none' ? l.weight * 0.4 : l.weight }));
  }
  const drop = weightedPick(table);
  if (drop.id === 'none') return null;
  const value = drop.id === 'cash' ? randi(45, 130) : drop.id === 'big' ? randi(500, 900) : 0;
  return { id: drop.id, rarity: drop.rarity, value };
}

// 在丧尸位置生成掉落物
function spawnLoot(game, z) {
  const roll = rollLoot(z);
  if (!roll) return;
  const a = rand(0, TAU), r = rand(0.4, 1.1);
  const x = clamp(z.pos.x + Math.cos(a) * r, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
  const zz = clamp(z.pos.z + Math.sin(a) * r, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
  game.loots.push(new LootDrop(roll.id, x, zz, roll.value));
}
