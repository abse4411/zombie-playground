/* ============================================================
 * 投掷物 / 手雷爆炸 / 火焰区 / 酸液池
 * ============================================================ */
const PROJ_CFG = {
  bile:    { r: 0.14, c: 0x7a9a3a, e: 0x3a5a10, g: 10 },
  rock:    { r: 0.32, c: 0x5a5248, e: 0x000000, g: 13 },
  missile: { r: 0.12, c: 0x8a8f96, e: 0xff5010, g: 10 },
  attractor: { r: 0.1, c: 0x4a6a8a, e: 0x1a3a6a, g: 13 },
  frag:    { r: 0.11, c: 0x3d5a3d, e: 0x000000, g: 13 },
  impact:  { r: 0.11, c: 0x8a2a2a, e: 0xff4030, g: 13 },
  molotov: { r: 0.12, c: 0x8a4b1f, e: 0x552200, g: 13 },
  sticky:  { r: 0.12, c: 0x6a5a2a, e: 0x2a220a, g: 13 },
  emp:     { r: 0.13, c: 0x3a6a9a, e: 0x1a4a8a, g: 13 },
  gas:     { r: 0.13, c: 0x5a7a2a, e: 0x2a4a0a, g: 13 },
  incendiary: { r: 0.12, c: 0xa8482a, e: 0x58200a, g: 13 },
  cryo:    { r: 0.13, c: 0x7ac0e8, e: 0x2a6a9a, g: 13 },
  cluster: { r: 0.12, c: 0x4a5a3a, e: 0x1a2a0a, g: 13 },
  concussion: { r: 0.13, c: 0x3a4a5a, e: 0x14202a, g: 13 },
  acid:    { r: 0.15, c: 0x66cc33, e: 0x2a6600, g: 9 },
  gl:      { r: 0.13, c: 0x334422, e: 0x223311, g: 11 },  // 榴弹
};

function pointBlocked(x, y, z) {
  for (const c of ENGINE.colliders) {
    if (x > c.minX && x < c.maxX && y > c.minY && y < c.maxY && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}

/* 玩家投掷物强化乘区（v20.4 狩猎强化：威力/范围/持续），敌方的弹不受影响 */
function throwMult(game) {
  const p = game && game.player;
  return {
    dmg: (p && p.throwDmg) || 1,
    rad: (p && p.throwRad) || 1,
    dur: (p && p.throwDur) || 1,
  };
}

class Projectile {
  constructor(kind, x, y, z, vx, vy, vz, opts = {}) {
    this.kind = kind;
    const c = PROJ_CFG[kind];
    this.r = c.r; this.g = c.g;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.fuse = opts.fuse !== undefined ? opts.fuse : 3;
    this.armT = opts.armT || 0;   // 冲击引信保险期（极爆手雷 v20.4，RGN式）
    this.opts = opts;
    this.dead = false; this.landed = false;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(c.r, 10, 8),
      new THREE.MeshLambertMaterial({ color: c.c, emissive: c.e })
    );
    this.mesh.position.set(x, y, z);
    ENGINE.scene.add(this.mesh);
  }

  get pos() { return this.mesh.position; }

  update(dt, game) {
    if (this.dead) return;   // v24.x 防御：已终结的投射物不再重复引爆
    const p = this.pos;
    this.fuse -= dt;
    if (this.armT > 0) this.armT -= dt;
    this.wallHit = false;   // 每帧重置：movement 段置位、同帧消费（防保险期旧命中残留）
    this.vy -= this.g * dt;

    // 分轴移动 + 撞墙反弹（手雷弹开继续引信倒计时；燃烧瓶 wallHit 即炸）
    let px = p.x; p.x += this.vx * dt;
    if (pointBlocked(p.x, p.y, p.z)) {
      p.x = px;
      const imp = Math.abs(this.vx);
      this.vx *= -0.4;
      if (imp < 0.8) this.vx = 0;   // v21.6：微速清零——台阶缝隙不再无限抖动
      this.wallHit = true;
      if (this.kind === 'frag' && !this.opts.R && imp > 1.2) { AUDIO.tone(2100, 0.05, 'square', 0.1); PARTICLES.impact(p.x, p.y, p.z); }   // 只有明显撞击才出声/火花
    }
    let pz = p.z; p.z += this.vz * dt;
    if (pointBlocked(p.x, p.y, p.z)) {
      p.z = pz;
      const imp2 = Math.abs(this.vz);
      this.vz *= -0.4;
      if (imp2 < 0.8) this.vz = 0;
      this.wallHit = true;
      if (this.kind === 'frag' && !this.opts.R && imp2 > 1.2) { AUDIO.tone(2100, 0.05, 'square', 0.1); PARTICLES.impact(p.x, p.y, p.z); }
    }
    p.y += this.vy * dt;

    if (p.y <= this.r) {
      p.y = this.r;
      if (Math.abs(this.vy) > 2.2) { this.vy *= -0.35; this.vx *= 0.65; this.vz *= 0.65; }
      else { this.vy = 0; this.vx *= 0.9; this.vz *= 0.9; this.landed = true; }
    }

    if (this.kind === 'molotov') PARTICLES.flames(p.x, p.y, p.z, 1);
    if (this.kind === 'acid' && Math.random() < 0.4) PARTICLES.acidSplash(p.x, p.y, p.z);
    // M79榴弹：碰到丧尸立即引爆（高速碰炸引信）
    // 敌方手雷（v15.3）：opts.R 提供独立伤害/半径（军阀小Boss），且不做碰炸（避免炸到周围尸群/自己）
    if (this.kind === 'gl' && !this.opts.R) {
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        const dx2 = zb.pos.x - p.x, dz2 = zb.pos.z - p.z;
        if (dx2 * dx2 + dz2 * dz2 < 0.42 && p.y < zb.pos.y + 1.9 * zb.group.scale.x) {
          this._finish(game);
          const M = throwMult(game);
          explodeGrenade(game, p.x, p.y, p.z, { damage: (this.opts.dmgBase || 120) * M.dmg, radius: (this.opts.radBase || 6) * M.rad * (this.opts.radiusMult || 1), selfMult: 0.4 * (1 + (this.opts.selfBonus || 0)) });
          return;
        }
      }
    }
    // 破片手雷碰丧尸：弹开（v20.5 修复——M67延时引信不应触身即爆，像撞到软障碍一样反弹，引信走完才炸）
    if (this.kind === 'frag') {
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        const dx = p.x - zb.pos.x, dz = p.z - zb.pos.z;
        const d2 = dx * dx + dz * dz, rr = 0.38 + this.r;
        if (d2 < rr * rr && d2 > 1e-6 && p.y < zb.pos.y + 1.9 * zb.group.scale.x) {
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
          p.x = zb.pos.x + nx * rr; p.z = zb.pos.z + nz * rr;   // 推出重叠
          const dot = this.vx * nx + this.vz * nz;
          if (dot < 0) { this.vx -= 1.55 * dot * nx; this.vz -= 1.55 * dot * nz; }   // 沿法线反弹（约0.78恢复系数）
          this.vx *= 0.75; this.vz *= 0.75;
          break;
        }
      }
    }
    // M79榴弹：碰炸（墙/地/碰到即炸）
    if (this.kind === 'gl' && (this.wallHit || p.y <= this.r + 0.01 || this.fuse <= 0)) {
      this._finish(game);
      const M = throwMult(game);
      explodeGrenade(game, p.x, p.y, p.z, { damage: (this.opts.dmgBase || 120) * M.dmg, radius: (this.opts.radBase || 6) * M.rad * (this.opts.radiusMult || 1), selfMult: 0.4 * (1 + (this.opts.selfBonus || 0)) });
      return;
    }
    // 极爆手雷（v20.4 RGN式冲击引信）：保险期(1.2s)内正常弹跳，解除后碰丧尸/墙/地立即爆炸，4s备份引信
    if (this.kind === 'impact' && this.armT <= 0) {
      let hitZ = null;
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        const dx2 = zb.pos.x - p.x, dz2 = zb.pos.z - p.z;
        if (dx2 * dx2 + dz2 * dz2 < 0.42 && p.y < zb.pos.y + 1.9 * zb.group.scale.x) { hitZ = true; break; }
      }
      if (hitZ || this.wallHit || p.y <= this.r + 0.01 || this.fuse <= 0) {
        const M = throwMult(game);
        this._finish(game);
        explodeGrenade(game, p.x, p.y, p.z, { damage: THROWABLES.impact.damage * M.dmg, radius: THROWABLES.impact.radius * M.rad, selfMult: THROWABLES.impact.selfMult });
        return;
      }
    }

    const pd = dist2d(p.x, p.z, game.player.pos.x, game.player.pos.z);

    if (this.kind === 'frag' && this.fuse <= 0) {
      this._finish(game);
      if (this.opts.R && this.opts.R.damage) explodeGrenade(game, p.x, p.y, p.z, this.opts.R);
      else {
        const M = throwMult(game);
        explodeGrenade(game, p.x, p.y, p.z, { damage: THROWABLES.frag.damage * M.dmg, radius: THROWABLES.frag.radius * M.rad, selfMult: THROWABLES.frag.selfMult });
      }
      return;
    }
    // 粘性炸药（v22.2）：触尸/触墙即粘住，短引信后重爆
    if (this.kind === 'sticky' && !this.stuck && (this.wallHit || this._touchZombie(game))) {
      this.stuck = true; this.stuckT = 1.8;
      this.vx = this.vy = this.vz = 0;
      AUDIO.tone(900, 0.06, 'square', 0.12);
    }
    if (this.kind === 'sticky' && this.stuck) {
      this.stuckT -= dt;
      if (this.stuckT <= 0) {
        const M = throwMult(game);
        this._finish(game);
        explodeGrenade(game, p.x, p.y, p.z, { damage: THROWABLES.sticky.damage * M.dmg, radius: THROWABLES.sticky.radius * M.rad, selfMult: THROWABLES.sticky.selfMult });
      }
      return;
    }
    // 粘性炸药：始终未粘住也按引信引爆（v22.2 兜底）
    if (this.kind === 'sticky' && this.fuse <= 0) {
      const M = throwMult(game);
      this._finish(game);
      explodeGrenade(game, p.x, p.y, p.z, { damage: THROWABLES.sticky.damage * M.dmg, radius: THROWABLES.sticky.radius * M.rad, selfMult: THROWABLES.sticky.selfMult });
      return;
    }
    // 电磁脉冲雷（v22.2）：落地/触墙即引爆脉冲——人类敌人瘫痪、感染体减速，无杀伤
    if (this.kind === 'emp' && (this.wallHit || this.landed || this.fuse <= 0)) {
      this._finish(game);
      AUDIO.shot(1200, 0.4, 0.6);
      PARTICLES.spawn('spark', p.x, 1.0, p.z, 40, { speed: 9, vy: 2.5, life: 0.6, color: [0.5, 0.8, 1], color2: [0.1, 0.3, 0.9] });
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        if (dist2d(p.x, p.z, zb.pos.x, zb.pos.z) > THROWABLES.emp.radius) continue;
        if (zb.type.human && zb.type.gun) { zb.aimT = -1; zb.stagger = Math.max(zb.stagger || 0, 2.5); }
        else zb.slowT = Math.max(zb.slowT || 0, 2);
      }
      return;
    }
    // 集束手雷（v24.2）：母弹起爆散落四枚子弹药
    if (this.kind === 'cluster' && this.fuse <= 0) {
      const M = throwMult(game);
      this._finish(game);
      explodeGrenade(game, p.x, p.y, p.z, { damage: THROWABLES.cluster.damage * M.dmg, radius: THROWABLES.cluster.radius * M.rad, selfMult: THROWABLES.cluster.selfMult });
      for (const [ox2, oz2] of [[1.4, 0.6], [-1.2, 1.1], [0.8, -1.4], [-1.5, -0.7]]) {
        const bomblet = new Projectile('frag', p.x + ox2, 0.5, p.z + oz2, rand(-1, 1), 2, rand(-1, 1), { fuse: 0.45 });
        bomblet.opts.R = { damage: Math.round(THROWABLES.cluster.damage * 0.6 * M.dmg), radius: 2.6 * M.rad, selfMult: 0.3 };
        game.projectiles.push(bomblet);
      }
      return;
    }
    // 震爆弹（v24.2）：纯冲击波掀飞
    if (this.kind === 'concussion' && (this.landed || this.wallHit || this.fuse <= 0)) {
      this._finish(game);
      AUDIO.explode(dist2d(p.x, p.z, game.player.pos.x, game.player.pos.z));
      PARTICLES.explosion(p.x, 0.8, p.z);
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        const d2 = dist2d(p.x, p.z, zb.pos.x, zb.pos.z);
        if (d2 > THROWABLES.concussion.radius) continue;
        const nx = (zb.pos.x - p.x) / (d2 || 1), nz = (zb.pos.z - p.z) / (d2 || 1);
        zb.takeDamage(8, false, { x: zb.pos.x, y: 1.1 * zb.group.scale.x, z: zb.pos.z }, game, { x: nx * 22, z: nz * 22 });
        zb.stagger = Math.max(zb.stagger || 0, 1.2);
      }
      return;
    }
    // 燃烧手雷（v23.2）：炸开成三簇火点
    if (this.kind === 'incendiary' && (this.landed || this.wallHit || this.fuse <= 0)) {
      const M = throwMult(game);
      this._finish(game);
      AUDIO.fireIgnite();
      for (const [ox2, oz2] of [[0, 0], [1.6, 0.8], [-1.4, -1.2]]) {
        spawnFireZone(game, p.x + ox2, p.z + oz2, { dps: THROWABLES.incendiary.dps * M.dmg, radius: THROWABLES.incendiary.radius * M.rad, duration: THROWABLES.incendiary.duration * M.dur });
      }
      return;
    }
    // 冰霜雷（v23.2）：7米冻结迟滞4秒
    if (this.kind === 'cryo' && (this.landed || this.wallHit || this.fuse <= 0)) {
      this._finish(game);
      AUDIO.shot(700, 0.3, 0.4);
      PARTICLES.spawn('spark', p.x, 0.6, p.z, 36, { speed: 8, vy: 2, life: 0.7, color: [0.6, 0.9, 1], color2: [0.2, 0.5, 0.9] });
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        if (dist2d(p.x, p.z, zb.pos.x, zb.pos.z) > THROWABLES.cryo.radius) continue;
        zb.slowT = Math.max(zb.slowT || 0, 4);
        zb.takeDamage(20, false, { x: zb.pos.x, y: 1.1 * zb.group.scale.x, z: zb.pos.z }, game, null);
      }
      return;
    }
    // 毒气雷（v22.2）：落地/触墙即释放毒云
    if (this.kind === 'gas' && (this.landed || this.wallHit || this.fuse <= 0)) {
      const M = throwMult(game);
      this._finish(game);
      spawnGasCloud(game, p.x, p.z, { dps: THROWABLES.gas.dps * M.dmg, radius: THROWABLES.gas.radius * M.rad, duration: THROWABLES.gas.duration * M.dur });
      AUDIO.fireIgnite();
      return;
    }
    // 燃烧瓶：碰到丧尸立即碎裂起火（v20.3——碰到东西就炸：墙/地/丧尸，不再穿身飞过）
    if (this.kind === 'molotov') {
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        const dx2 = zb.pos.x - p.x, dz2 = zb.pos.z - p.z;
        if (dx2 * dx2 + dz2 * dz2 < 0.42 && p.y < zb.pos.y + 1.9 * zb.group.scale.x) {
          const M = throwMult(game);
          this._finish(game);
          spawnFireZone(game, p.x, p.z, { dps: THROWABLES.molotov.dps * M.dmg, radius: THROWABLES.molotov.radius * M.rad, duration: THROWABLES.molotov.duration * M.dur });
          AUDIO.fireIgnite();
          return;
        }
      }
    }
    if (this.kind === 'molotov' && (this.landed || this.wallHit || this.fuse <= 0)) {
      const M = throwMult(game);
      this._finish(game);
      spawnFireZone(game, p.x, p.z, { dps: THROWABLES.molotov.dps * M.dmg, radius: THROWABLES.molotov.radius * M.rad, duration: THROWABLES.molotov.duration * M.dur });
      AUDIO.fireIgnite();
      return;
    }
    // 诱饵：落地→8秒声波吸引场
    if (this.kind === 'attractor') {
      if (this.landed) {
        this._finish(game);
        spawnAttractor(game, p.x, p.z, 8 * throwMult(game).dur);
        return;
      }
    }
    // 导弹：命中/落地→爆炸伤害（无酸洼）
    if (this.kind === 'missile') {
      const hitP = pd < 1.3 && p.y < 2.4;
      if (hitP || this.landed) {
        this._finish(game);
        explodeGrenade(game, p.x, p.y, p.z, { damage: (this.opts.R && this.opts.R.dmg) || 30, radius: 2.6, selfMult: 1 });
        PARTICLES.explosion(p.x, p.y, p.z);
        return;
      }
    }
    // 巨石：命中/落地→小范围爆炸伤害+击飞
    if (this.kind === 'rock') {
      const hitP = pd < 1.4 && p.y < 2.6;
      if (hitP || this.landed) {
        this._finish(game);
        explodeGrenade(game, p.x, p.y, p.z, { damage: this.opts.R.dmg, radius: 3, selfMult: 1 });
        if (game.player.alive && dist2d(p.x, p.z, game.player.pos.x, game.player.pos.z) < 3) {
          game.player.vel.y += 3.5;
        }
        return;
      }
    }
    // 胆汁弹：命中玩家→标记8秒；落地→胆汁洼（视觉 acid pool 绿色）
    if (this.kind === 'bile') {
      if (pd < 1.1 && p.y < 2.2 && game.player.alive) {
        game.player.bileT = this.opts.B.bileT;
        game.player.takeDamage(this.opts.B.dmg, game);
        this._finish(game);
        return;
      }
      if (this.landed) {
        this._finish(game);
        spawnAcidPool(game, p.x, p.z, { poolDps: 6, poolRadius: 2.2, poolTime: 4 });
        return;
      }
    }
    if (this.kind === 'acid') {
      // 命中玩家或落地
      if (pd < 0.9 && p.y < 2.2) {
        const R = this.opts.R;
        game.player.takeDamage(R.dmg * (game.mode ? 1 : 1), game);
        game.player.slowT = 2;
        this._finish(game);
        spawnAcidPool(game, p.x, p.z, R);
        return;
      }
      if (this.landed) {
        this._finish(game);
        spawnAcidPool(game, p.x, p.z, this.opts.R);
        return;
      }
    }
    if (this.fuse < -4) this._finish(game); // 保险
  }

  _finish(game) {
    this.dead = true;
    ENGINE.scene.remove(this.mesh);
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
  }
}

/* 粘性炸药触尸检测（v22.2） */
Projectile.prototype._touchZombie = function (game) {
  const p = this.pos;
  for (const zb of game.zombies) {
    if (zb.dead || zb.state === 'rise') continue;
    const dx = zb.pos.x - p.x, dz = zb.pos.z - p.z;
    if (dx * dx + dz * dz < 0.42 && p.y < zb.pos.y + 1.9 * zb.group.scale.x) return true;
  }
  return false;
};

/* ---------- 声波诱饵场（v10.4 Days Gone） ---------- */
const ATTRACTORS = { list: [] };
function spawnAttractor(game, x, z, duration) {
  // 视觉：蓝色脉冲环
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.65, 24),
    new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.06, z);
  ENGINE.scene.add(ring);
  ATTRACTORS.list.push({ x, z, t: duration, ring });
  AUDIO.waveHorn();
  HUD.toast('📣 声波诱饵启动——感染体正在聚拢');
}
function updateAttractors(dt, game) {
  for (const a of ATTRACTORS.list) {
    a.t -= dt;
    a.ring.scale.setScalar(1 + Math.sin(ENGINE.time * 6) * 0.15);
    if (a.t <= 0) { a.ring.geometry.dispose(); a.ring.material.dispose(); ENGINE.scene.remove(a.ring); a.dead = true; continue; }
    // 吸引：24m内普通尸朝诱饵移动（覆盖追击目标）
    for (const z of game.zombies) {
      if (z.dead || z.boss || z.type.cost >= 3 || z.state === 'rise') continue;
      if (dist2d(z.pos.x, z.pos.z, a.x, a.z) < 24) {
        const dx = a.x - z.pos.x, dz = a.z - z.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d > 1.2) {
          z.pos.x += (dx / d) * z.speed * 1.3 * dt;
          z.pos.z += (dz / d) * z.speed * 1.3 * dt;
        }
      }
    }
  }
  ATTRACTORS.list = ATTRACTORS.list.filter(a => !a.dead);
}

/* ---------- 坦克巨石（v9.9 L4D Tank） ---------- */
function spawnRock(game, zombie, R) {
  const p = game.player;
  const ox = zombie.pos.x, oy = 1.9 * zombie.group.scale.x, oz = zombie.pos.z;
  const d = dist2d(ox, oz, p.pos.x, p.pos.z);
  const t = clamp(d / R.speed, 0.3, 2);
  const vx = (p.pos.x + p.vel.x * t * 0.4 - ox) / t, vz = (p.pos.z + p.vel.z * t * 0.4 - oz) / t;
  const vy = (1.2 - oy + 0.5 * 13 * t * t) / t;
  game.projectiles.push(new Projectile('rock', ox, oy, oz, vx, vy, vz, { fuse: 4, R }));
  AUDIO.impact();
}

/* ---------- 胆汁弹（v9.7 L4D Boomer） ---------- */
function spawnBile(game, zombie, B) {
  const p = game.player;
  const ox = zombie.pos.x, oy = 1.5 * zombie.group.scale.x, oz = zombie.pos.z;
  const d = dist2d(ox, oz, p.pos.x, p.pos.z);
  const t = clamp(d / B.speed, 0.25, 1.8);
  const vx = (p.pos.x - ox) / t, vz = (p.pos.z - oz) / t;
  const vy = (1.2 - oy + 0.5 * PROJ_CFG.acid.g * t * t) / t;
  game.projectiles.push(new Projectile('bile', ox, oy, oz, vx, vy, vz, { fuse: 4, B }));
  AUDIO.acidSpit(d);
}

/* ---------- 手雷爆炸 ---------- */
function explodeGrenade(game, x, y, z, cfg, selfMult) {
  selfMult = selfMult !== undefined ? selfMult : cfg.selfMult;
  // 爆破专家被动（v8.3）：爆炸伤害×1.5
  const exMult = (game.player && game.player.explodeMult) || 1;
  if (exMult !== 1) cfg = Object.assign({}, cfg, { damage: cfg.damage * exMult });
  PARTICLES.explosion(x, y, z);
  const pd = dist2d(x, z, game.player.pos.x, game.player.pos.z);
  AUDIO.explode(pd);
  ENGINE.shake(clamp(0.5 - pd * 0.02, 0.08, 0.5));
  for (const zb of game.zombies) {
    if (zb.dead) continue;
    const d = dist2d(x, z, zb.pos.x, zb.pos.z);
    // 爆炸垂直衰减（v14.1）：高差过大不波及（防爆楼层穿透）
    const dyZ = Math.abs((y || 0) - (zb.pos.y + 0.9));
    if (d < cfg.radius && dyZ < Math.min(2.2, cfg.radius * 0.5)) {   // v21.6：垂直门收紧，二楼免疫脚下爆炸
      const dmg = cfg.damage * (1 - (d / cfg.radius) * 0.55);
      // 爆风击退：从爆心向外推
      const nx = (zb.pos.x - x) / (d || 1), nz = (zb.pos.z - z) / (d || 1);
      const kb = GAMECONFIG.feel ? GAMECONFIG.feel.kbExplosion : 6;
      zb.takeDamage(dmg, false, { x: zb.pos.x, y: 1.1 * zb.group.scale.x, z: zb.pos.z }, game,
        { x: nx * kb, z: nz * kb });
    }
  }
  const pr = cfg.radius * 0.75;
  const dyP = Math.abs((y || 0) - (game.player.pos.y + 0.9));
  if (pd < pr && dyP < Math.min(2.2, cfg.radius * 0.5) && game.player.alive) {   // v21.6 收紧：二楼免疫脚下爆炸
    game.player.takeDamage(cfg.damage * selfMult * (1 - pd / pr), game);
  }
  // 波及尸巢（v10.3 燃烧/爆炸烧巢）
  if (typeof NESTS !== 'undefined') NESTS.hitAt(game, x, z, cfg.radius, cfg.damage);
  // 波及可破坏物（链式引爆在 Destructible.destroy 内处理）
  if (typeof Destructible !== 'undefined' && game.destructibles) {
    for (const d of game.destructibles) {
      if (d.dead) continue;
      const dd = dist2d(x, z, d.x, d.z);
      if (dd < cfg.radius) d.hit(cfg.damage * (1 - dd / cfg.radius), game, true);
    }
  }
}

function explodeBloater(game, z) {
  const cfg = { damage: z.type.explode.dmg, radius: z.type.explode.radius, selfMult: 0.3 };
  explodeGrenade(game, z.pos.x, 0.8, z.pos.z, cfg);
  spawnAcidPool(game, z.pos.x, z.pos.z, { poolDps: 10, poolRadius: 2.4, poolTime: 3 });
}

/* ---------- 火焰区 / 酸液池 ---------- */
class Zone {
  constructor(x, z, kind, cfg) {
    this.x = x; this.z = z; this.kind = kind;
    this.r = kind === 'fire' ? cfg.radius : cfg.poolRadius;
    this.dps = kind === 'fire' ? cfg.dps : cfg.poolDps;
    this.ttl = kind === 'fire' ? cfg.duration : cfg.poolTime;
    this.dead = false; this.tick = 0;
    const color = kind === 'fire' ? 0xff6a1a : 0x55cc22;
    this.mesh = new THREE.Mesh(
      new THREE.CircleGeometry(this.r, 26),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.05, z);
    ENGINE.scene.add(this.mesh);
  }

  update(dt, game) {
    this.ttl -= dt;
    if (this.ttl <= 0) { this.dead = true; ENGINE.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); return; }
    this.mesh.material.opacity = 0.22 + Math.sin(ENGINE.time * 9) * 0.08;
    if (this.kind === 'fire') {
      const a = Math.random() * TAU, rr = Math.random() * this.r;
      PARTICLES.flames(this.x + Math.cos(a) * rr, 0.2, this.z + Math.sin(a) * rr, 2);
    } else if (this.kind === 'gas') {
      const a = Math.random() * TAU, rr = Math.random() * this.r;
      PARTICLES.acidSplash(this.x + Math.cos(a) * rr, 0.4 + Math.random() * 0.8, this.z + Math.sin(a) * rr);
    } else if (Math.random() < 0.3) {
      PARTICLES.acidSplash(this.x + rand(-this.r, this.r) * 0.7, 0.2, this.z + rand(-this.r, this.r) * 0.7);
    }
    // 伤害判定（每 0.25s 一跳）
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      const step = this.dps * 0.25;
      const selfMult = this.kind === 'fire' ? 0.35 : 0.5;
      const hGate = this.kind === 'gas' ? 2.2 : 1.6;   // v21.6 高度门；毒云略高（v22.2）
      for (const zb of game.zombies) {
        if (zb.dead || zb.state === 'rise') continue;
        if (dist2d(this.x, this.z, zb.pos.x, zb.pos.z) < this.r && Math.abs(zb.pos.y) < hGate) {
          if (this.kind === 'gas') zb.slowT = Math.max(zb.slowT || 0, 1.2);
          zb.takeDamage(step, false, null, game);
        }
      }
      if (game.player.alive && dist2d(this.x, this.z, game.player.pos.x, game.player.pos.z) < this.r
        && Math.abs(game.player.pos.y) < hGate) {
        game.player.takeDamage(step * selfMult, game);
      }
    }
  }
}

function spawnFireZone(game, x, z, cfg) { game.fireZones.push(new Zone(x, z, 'fire', cfg)); }
function spawnGasCloud(game, x, z, cfg) { game.gasClouds.push(new Zone(x, z, 'gas', cfg)); }
function spawnAcidPool(game, x, z, R) { if (R) game.acidPools.push(new Zone(x, z, 'acid', R)); }

/* ---------- 吐酸者弹道 ---------- */
function spawnAcid(game, zombie, R) {
  const p = game.player;
  const ox = zombie.pos.x, oy = 1.5 * zombie.group.scale.x, oz = zombie.pos.z;
  const d = dist2d(ox, oz, p.pos.x, p.pos.z);
  const t = clamp(d / R.speed, 0.25, 2.2);
  // 预判 + 抛物线解算
  const tx = p.pos.x + p.vel.x * t * 0.5;
  const tz = p.pos.z + p.vel.z * t * 0.5;
  const vx = (tx - ox) / t, vz = (tz - oz) / t;
  const vy = (1.2 - oy + 0.5 * PROJ_CFG.acid.g * t * t) / t;
  const proj = new Projectile('acid', ox, oy, oz, vx, vy, vz, { fuse: 4, R });
  game.projectiles.push(proj);
  AUDIO.acidSpit(d);
}
