/* ============================================================
 * 探索系统（v3.7）—— 补给箱 / 军需箱 / 互动点 / 小地图标记
 * 调研: 探索奖励放争夺位置制造风险收益; 标记引导驱动探索欲
 * ============================================================ */
class SupplyCrate {
  constructor(x, z, tier) {
    this.tier = tier || 'normal';   // normal | elite
    this.opened = false;
    this.x = x; this.z = z;
    const elite = this.tier === 'elite';
    const color = elite ? 0xb05cff : 0x3aa0ff;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.7, 0.7),
      new THREE.MeshStandardMaterial({
        map: (() => { const t = ART.panel(elite ? 0x4a3a6a : 0x2e4a5a).clone(); t.needsUpdate = true; return t; })(),
        roughness: 0.6, metalness: 0.35, emissive: color, emissiveIntensity: 0.06,
      })
    );
    box.position.y = 0.36;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.12, 0.74), ART.mat(0x1c1e22));
    lid.position.y = 0.76;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.3, 4.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 2.2;
    this.group.add(box, lid, beam);
    // 自发光+光柱引导（不用PointLight，控制全场景动态光数量）
    this.box = box; this.lid = lid; this.beam = beam;
    ENGINE.scene.add(this.group);
    colBox(x, z, 1.1, 0.8, 0.85);
  }

  // 靠近开启
  tryOpen(game) {
    if (this.opened) return false;
    const p = game.player.pos;
    if (dist2d(this.x, this.z, p.x, p.z) > 1.6) return false;
    this.opened = true;
    // 开箱动画
    this.lid.rotation.x = -1.9;
    this.lid.position.y = 0.95;
    this.lid.position.z = -0.35;
    this.beam.visible = false;
    if (typeof AUDIO !== 'undefined') AUDIO.crateOpen();
    // 掉落2-3件战利品（精英箱更豪华）
    const n = this.tier === 'elite' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const table = this.tier === 'elite'
        ? [{ id: 'cash', weight: 4, rarity: 2, value: randi(200, 400) },
           { id: 'medkit', weight: 3, rarity: 2 },
           { id: 'big', weight: 2, rarity: 3, value: randi(350, 600) }]
        : [{ id: 'cash', weight: 5, rarity: 1, value: randi(80, 180) },
           { id: 'ammo', weight: 4, rarity: 1 },
           { id: 'medkit', weight: 2, rarity: 1 },
           { id: 'frag', weight: 2, rarity: 1 }];
      const roll = weightedPick(table);
      const a = (i / n) * TAU;
      const lx = clamp(this.x + Math.cos(a) * 0.9, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
      const lz = clamp(this.z + Math.sin(a) * 0.9, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
      game.loots.push(new LootDrop(roll.id, lx, lz, roll.value || 0));
    }
    HUD.pickup(`📦 打开${this.tier === 'elite' ? '军需' : '补给'}箱`, this.tier === 'elite' ? 3 : 2);
    return true;
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}

/* ---------- 每局布置 ---------- */
function spawnSupplyCrates(game) {
  game.crates = [];
  const S = ENGINE.mapDef.size - 8;
  const bz = ENGINE.mapDef.buyZone;
  const p0 = ENGINE.mapDef.playerSpawn;
  const place = (tier) => {
    for (let guard = 0; guard < 50; guard++) {
      const x = rand(-S, S), z = rand(-S, S);
      if (dist2d(x, z, p0.x, p0.z) < 8) continue;         // 不在出生点旁
      if (dist2d(x, z, bz.x, bz.z) < bz.r + 2) continue;  // 不在补给区
      if (game.crates.some(c => dist2d(c.x, c.z, x, z) < 14)) continue; // 相距14m+驱动探索
      if (game.destructibles.some(d => !d.dead && dist2d(d.x, d.z, x, z) < 2)) continue;
      game.crates.push(new SupplyCrate(x, z, tier));
      return true;
    }
    return false;
  };
  for (let i = 0; i < 4; i++) place('normal');
  for (let i = 0; i < 1; i++) place('elite');
}
