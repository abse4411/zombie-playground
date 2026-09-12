/* ============================================================
 * 可破坏物系统（v3.6）—— 爆炸桶 / 木箱 / 可破坏掩体
 * 调研: 破坏物作为战斗调味料(引爆桶改变战局) + 掩体可被尸群磨掉
 * ============================================================ */
class Destructible {
  constructor(kind, x, z, ry) {
    this.kind = kind; this.dead = false; this.x = x; this.z = z;
    const cfg = DESTRUCTIBLES[kind];
    this.cfg = cfg;
    this.maxHp = cfg.hp; this.hp = cfg.hp;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = ry || 0;
    this.mesh = new THREE.Mesh(cfg.geo, cfg.mat());
    this.mesh.position.y = cfg.h / 2;
    this.group.add(this.mesh);
    if (ENGINE.quality.outlines && cfg.outline) ART.outline(this.mesh, 1.1);
    if (cfg.light) {
      // 警示灯：自发光（不用PointLight，控制动态光数量）
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.06, 0.18),
        new THREE.MeshBasicMaterial({ color: 0xff6633 })
      );
      lamp.position.y = cfg.h + 0.05;
      this.group.add(lamp);
    }
    ENGINE.scene.add(this.group);
    // 碰撞体（破坏后移除）
    this.colliderIdx = ENGINE.colliders.length;
    colBox(x, z, cfg.w, cfg.w, cfg.h);
  }

  hit(dmg, game, byExplosion) {
    if (this.dead) return;
    this.hp -= dmg;
    // 木制品受击晃动+木屑（v11.1）
    if (['door', 'woodwall', 'fence', 'crate', 'barrier'].includes(this.kind)) {
      PARTICLES.spawn('smoke', this.x + rand(-0.5, 0.5), this.cfg.h * 0.6, this.z + rand(-0.3, 0.3), 3,
        { speed: 1.6, vy: 1.8, life: 0.5, color: [0.55, 0.42, 0.26], color2: [0.32, 0.24, 0.14] });
      this.group.rotation.z = Math.sin(ENGINE.time * 40) * 0.03;
      clearTimeout(this._wobT);
      this._wobT = setTimeout(() => { this.group.rotation.z = 0; }, 90);
    }
    if (this.kind === 'barrel') {
      // 受击闪红
      this.mesh.material.color.setHex(0xff6644);
      clearTimeout(this._flashT);
      this._flashT = setTimeout(() => { if (!this.dead) this.mesh.material.color.setHex(0xb03828); }, 60);
    }
    if (this.hp <= 0) this.destroy(game, byExplosion);
  }

  destroy(game, byExplosion) {
    if (this.dead) return;
    this.dead = true;
    if (this.cfg.explode && typeof SAVE !== 'undefined' && SAVE.data) SAVE.data.totalBarrels = (SAVE.data.totalBarrels || 0) + 1;
    ENGINE.scene.remove(this.group);
    // 移除碰撞体
    ENGINE.colliders.splice(this.colliderIdx, 1);
    if (this.kind === 'barrel') {
      // 爆炸：AOE伤害+击退（引爆炸桶是核心战术）
      AUDIO.explode(dist2d(this.x, this.z, game.player.pos.x, game.player.pos.z));
      PARTICLES.explosion(this.x, 0.6, this.z);
      ENGINE.shake(0.4);
      const cfg = { damage: 130, radius: 5.5, selfMult: 0.5 };
      explodeGrenade(game, this.x, 0.6, this.z, cfg);
      // 链式引爆邻近桶
      for (const d of game.destructibles) {
        if (d.dead || d === this) continue;
        if (d.kind === 'barrel' && dist2d(d.x, d.z, this.x, this.z) < 5) {
          setTimeout(() => d.destroy(game, true), rand(90, 200));
        }
      }
    } else {
      // 木箱/掩体碎裂
      if (typeof AUDIO !== 'undefined') AUDIO.woodBreak();
      PARTICLES.spawn('smoke', this.x, this.cfg.h / 2, this.z, 10,
        { speed: 3.5, life: 0.8, color: [0.45, 0.34, 0.22], color2: [0.25, 0.18, 0.12] });
      // 木箱掉落奖励（30%）
      if (this.kind === 'crate' && Math.random() < 0.3) {
        game.loots.push(new LootDrop(Math.random() < 0.6 ? 'cash' : 'ammo', this.x, this.z, randi(60, 150)));
      }
    }
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.mesh.geometry.dispose();
  }
}

const DESTRUCTIBLES = {
  door: {
    hp: 150, w: 2.0, h: 2.8, outline: true, door: true,
    geo: new THREE.BoxGeometry(2.0, 2.8, 0.22),
    mat: () => {
      const t = ART.panel(0x6a4a2e).clone(); t.needsUpdate = true; t.repeat.set(1, 1.4);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0.05 });
    },
  },
  woodwall: {
    hp: 200, w: 3.2, h: 2.4, outline: true,
    geo: new THREE.BoxGeometry(3.2, 2.4, 0.3),
    mat: () => {
      const t = ART.panel(0x5c4428).clone(); t.needsUpdate = true; t.repeat.set(1.6, 1.2);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 });
    },
  },
  fence: {
    hp: 80, w: 2.6, h: 1.4, outline: true,
    geo: new THREE.BoxGeometry(2.6, 1.4, 0.14),
    mat: () => new THREE.MeshStandardMaterial({ color: 0x74603e, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.92 }),
  },
  reactor: {
    hp: 260, w: 2.4, h: 3.6, outline: true,
    geo: new THREE.CylinderGeometry(1.1, 1.3, 3.6, 8),
    mat: () => new THREE.MeshStandardMaterial({ color: 0x3a4248, roughness: 0.5, metalness: 0.7, emissive: 0xb03828, emissiveIntensity: 0.55 }),
  },
  barrel: {
    hp: 1, w: 0.9, h: 1.15, outline: true, light: true,
    geo: new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12),
    mat: () => new THREE.MeshStandardMaterial({ color: 0xb03828, roughness: 0.55, metalness: 0.3 }),
  },
  crate: {
    hp: 40, w: 1.1, h: 1.1, outline: true,
    geo: new THREE.BoxGeometry(1.1, 1.1, 1.1),
    mat: () => {
      const t = ART.panel(0x7a5c38).clone(); t.needsUpdate = true; t.repeat.set(1, 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 });
    },
  },
  barrier: {
    hp: 220, w: 2.2, h: 1.15, outline: true,
    geo: new THREE.BoxGeometry(2.2, 1.15, 0.55),
    mat: () => {
      const t = ART.panel(0x6a6350).clone(); t.needsUpdate = true; t.repeat.set(2, 0.5);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 });
    },
  },
};

/* ---------- 武器命中路由：子弹/爆炸波及可破坏物 ---------- */
function hitDestructibles(game, ox, oy, oz, dx, dy, dz, maxT, dmg) {
  let best = maxT, target = null;
  for (const d of game.destructibles) {
    if (d.dead) continue;
    const c = { minX: d.x - d.cfg.w / 2, maxX: d.x + d.cfg.w / 2, minZ: d.z - d.cfg.w / 2, maxZ: d.z + d.cfg.w / 2, minY: 0, maxY: d.cfg.h };
    const t = rayOneAABB(ox, oy, oz, dx, dy, dz, c);
    if (t !== null && t < best) { best = t; target = d; }
  }
  if (target) {
    target.hit(dmg, game);
    PARTICLES.impact(ox + dx * best, oy + dy * best, oz + dz * best);
    return true;
  }
  return false;
}

/* ---------- 每局布置：随机散布爆炸桶/木箱/路障 ---------- */
function spawnDestructibles(game) {
  game.destructibles = [];
  const S = ENGINE.mapDef.size - 6;
  const bz = ENGINE.mapDef.buyZone;
  const p0 = ENGINE.mapDef.playerSpawn;
  const place = (kind, x, z, ry) => {
    // 避开出生点与补给区
    if (dist2d(x, z, p0.x, p0.z) < 5) return;
    if (dist2d(x, z, bz.x, bz.z) < bz.r + 1.5) return;
    game.destructibles.push(new Destructible(kind, x, z, ry));
  };
  const counts = { barrel: 8, crate: 7, barrier: 5 };
  for (const kind in counts) {
    let placed = 0, guard = 0;
    while (placed < counts[kind] && guard++ < 60) {
      const x = rand(-S, S), z = rand(-S, S);
      // 距其它可破坏物至少2.5m
      if (game.destructibles.some(d => dist2d(d.x, d.z, x, z) < 2.5)) continue;
      place(kind, x, z, rand(0, TAU));
      placed++;
    }
  }
}
