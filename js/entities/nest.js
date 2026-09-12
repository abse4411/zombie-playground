/* ============================================================
 * 尸巢系统（v10.3 往日不再移植）
 * 地面卵袋堆：定期孵化丧尸；燃烧瓶/爆炸可烧毁→区域净化（附近刷怪率降50%）
 * ============================================================ */
const NESTS = {
  list: [],

  // 每局生成：沿地图边缘布置 3~4 个巢
  spawnFor(game) {
    this.clear(game);
    const S = ENGINE.mapDef.size - 8;
    const bz = ENGINE.mapDef.buyZone;
    const n = randi(3, 4);
    let guard = 0;
    while (this.list.length < n && guard++ < 40) {
      const x = rand(-S, S), z = rand(-S, S);
      if (dist2d(x, z, bz.x, bz.z) < bz.r + 8) continue;
      if (this.list.some(nn => dist2d(nn.x, nn.z, x, z) < 20)) continue;
      this.add(game, x, z);
    }
  },

  add(game, x, z) {
    const nest = {
      x, z, hp: 120, dead: false,
      hatchT: rand(4, 8), hatched: 0, maxHatch: 3,
      group: new THREE.Group(),
    };
    // 造型：土丘 + 卵袋×3（有机鼓包）
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 8, 0, TAU, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3a3428, roughness: 0.95 })
    );
    mound.scale.y = 0.55;
    nest.group.add(mound);
    for (let i = 0; i < 3; i++) {
      const egg = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.24, 0.34), 8, 7),
        new THREE.MeshStandardMaterial({ color: 0x8a9a6a, roughness: 0.5, emissive: 0x2a3a10, emissiveIntensity: 0.4 })
      );
      const a = rand(0, TAU), r = rand(0.3, 0.9);
      egg.position.set(Math.cos(a) * r, rand(0.1, 0.3), Math.sin(a) * r);
      egg.scale.y = 1.35;
      nest.group.add(egg);
    }
    // 血渍环
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 16),
      new THREE.MeshBasicMaterial({ color: 0x3a1010, transparent: true, opacity: 0.4, depthWrite: false })
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.y = 0.02;
    nest.group.add(stain);
    nest.group.position.set(x, 0, z);
    nest.group.traverse(o => { if (o.isMesh) o.userData.isNest = nest; });
    ENGINE.scene.add(nest.group);
    this.list.push(nest);
    return nest;
  },

  update(dt, game) {
    for (const nest of this.list) {
      if (nest.dead) continue;
      // 定期孵化（上限3只，距离玩家<45m才孵化省性能）
      const p = game.player.pos;
      if (dist2d(nest.x, nest.z, p.x, p.z) > 45) continue;
      nest.hatchT -= dt;
      if (nest.hatchT <= 0 && nest.hatched < nest.maxHatch && game.zombies.length < 40) {
        nest.hatchT = rand(14, 22);
        nest.hatched++;
        const a = rand(0, TAU);
        const z = new Zombie(Math.random() < 0.7 ? 'walker' : 'runner', nest.x + Math.cos(a) * 1.5, nest.z + Math.sin(a) * 1.5,
          { hp: 0.85, speed: 1, dmg: 1 }, {});
        z.riseT = 0.2; z.state = 'chase'; z.pos.y = 0;
        game.zombies.push(z);
        PARTICLES.dust(nest.x, 0.3, nest.z, 6);
        HUD.killfeed('🥚 尸巢孵化了感染体！', 'small');
      }
    }
  },

  // 火焰/爆炸伤害（燃烧瓶火焰区与爆炸统一调用）
  hitAt(game, x, z, radius, dmg) {
    for (const nest of this.list) {
      if (nest.dead) continue;
      if (dist2d(nest.x, nest.z, x, z) < radius + 1.6) {
        nest.hp -= dmg;
        PARTICLES.dust(nest.x, 0.5, nest.z, 5);
        if (nest.hp <= 0) this.destroy(game, nest);
      }
    }
  },

  destroy(game, nest) {
    nest.dead = true;
    PARTICLES.explosion(nest.x, 0.6, nest.z);
    AUDIO.explode(dist2d(nest.x, nest.z, game.player.pos.x, game.player.pos.z));
    const bonus = 300;
    game.player.addMoney(bonus);
    HUD.banner('🔥 尸巢已焚毁！', `区域净化 · 赏金 +$${bonus}`);
    if (typeof SAVE !== 'undefined' && SAVE.data) {
      SAVE.data.nestsBurned = (SAVE.data.nestsBurned || 0) + 1;
      SAVE.data.neroTech = (SAVE.data.neroTech || 0) + 1;
      HUD.toast(`🔬 NERO科技碎片 +1（${SAVE.data.neroTech}/6）`);
      if (SAVE.data.neroTech >= 6 && typeof ACHV !== 'undefined') ACHV.unlock('nero6');
    }
    // 区域净化：清走巢附近游荡丧尸的30%概率（软性效果——通过 spawner 查询）
    setTimeout(() => ENGINE.scene.remove(nest.group), 1200);
    nest.group.traverse(o => { if (o.isMesh) o.visible = false; });
    nest.group.children[0] && (nest.group.children[0].visible = true);   // 留土丘残骸
  },

  // 某点附近是否有存活尸巢（刷怪率折减用）
  nearAlive(x, z) {
    return this.list.some(n => !n.dead && dist2d(n.x, n.z, x, z) < 24);
  },

  clear(game) {
    for (const n of this.list) ENGINE.scene.remove(n.group);
    this.list = [];
  },
};
