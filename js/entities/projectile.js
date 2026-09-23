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
  rocket:  { r: 0.16, c: 0x66705a, e: 0x222018, g: 2.2 }, // 火箭弹（低重力直飞，v25.7）
};

/* 火箭弹模型（v25.7）：弹体+战斗部+尾翼+喷焰锥——沿 +Z 轴构建，飞行时 lookAt 速度方向 */
function buildRocketMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6a705c });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a3f34 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 8), bodyMat);
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.17, 8), darkMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.29;
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.058, 0.1, 8), darkMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.z = -0.26;
  g.add(body, nose, exhaust);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.11), darkMat);
    fin.position.set(Math.cos(a) * 0.062, Math.sin(a) * 0.062, -0.19);
    fin.rotation.z = a;
    g.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 6),
    new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = -0.41;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

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
    this.mesh = kind === 'rocket' ? buildRocketMesh() : new THREE.Mesh(
      new THREE.SphereGeometry(c.r, 10, 8),
      new THREE.MeshLambertMaterial({ color: c.c, emissive: c.e })
    );
    this.mesh.position.set(x, y, z);
    ENGINE.scene.add(this.mesh);
    // 粘性炸药：粘住后闪烁的红色信标（v25.7）
    if (kind === 'sticky') {
      this.beacon = new THREE.Mesh(new THREE.SphereGeometry(c.r * 0.5, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3524 }));
      this.beacon.position.y = c.r * 1.05;
      this.beacon.visible = false;
      this.mesh.add(this.beacon);
    }
  }

  get pos() { return this.mesh.position; }

  update(dt, game) {
    if (this.dead) return;   // v24.x 防御：已终结的投射物不再重复引爆
    const p = this.pos;
    // 粘性炸药已粘住（v25.7 重做）：冻结一切物理——粘墙钉在墙面不滑落，粘尸跟着丧尸走
    if (this.kind === 'sticky' && this.stuck) {
      this.stuckT -= dt;
      if (this.stuckZ) {
        if (this.stuckZ.dead || this.stuckZ.remove) {   // 目标死亡：脱粘坠落，剩余时间继续倒计
          this.stuckZ = null; this.stuck = false; this.vy = -0.5;
        } else {
          const s = this.stuckZ.group.scale.x;
          this.pos.set(this.stuckZ.pos.x + this.stickOff.x, this.stuckZ.pos.y + this.stickOff.y * s, this.stuckZ.pos.z + this.stickOff.z);
        }
      }
      if (this.stuck) {
        this.beepT = (this.beepT || 0) - dt;
        if (this.beepT <= 0) { this.beepT = 0.4; AUDIO.tone(1300, 0.05, 'square', 0.12); if (this.beacon) this.beacon.visible = !this.beacon.visible; }
      }
      if (this.stuckT <= 0) {
        const M = throwMult(game);
        const fx = p.x, fy = p.y, fz = p.z;
        this._finish(game);
        explodeGrenade(game, fx, fy, fz, { damage: THROWABLES.sticky.damage * M.dmg, radius: THROWABLES.sticky.radius * M.rad, selfMult: THROWABLES.sticky.selfMult });
        return;
      }
      if (this.stuck) return;   // 脱粘坠落时不 return，走正常物理
    }
    this.fuse -= dt;
    if (this.armT > 0) this.armT -= dt;
    this.wallHit = false;   // 每帧重置：movement 段置位、同帧消费（防保险期旧命中残留）
    this.vy -= this.g * dt;

    // 分轴移动 + 撞墙反弹（手雷弹开继续引信倒计时；燃烧瓶 wallHit 即炸）
    let px = p.x; p.x += this.vx * dt;
    if (pointBlocked(p.x, p.y, p.z)) {
      p.x = px;
      const imp = Math.abs(this.vx);
      this._hitN = { x: -(Math.sign(this.vx) || 1), y: 0, z: 0 };   // v25.7 记录墙面法线
      this.vx *= -0.4;
      if (imp < 0.8) this.vx = 0;   // v21.6：微速清零——台阶缝隙不再无限抖动
      this.wallHit = true;
      if (this.kind === 'frag' && !this.opts.R && imp > 1.2) { AUDIO.tone(2100, 0.05, 'square', 0.1); PARTICLES.impact(p.x, p.y, p.z); }   // 只有明显撞击才出声/火花
    }
    let pz = p.z; p.z += this.vz * dt;
    if (pointBlocked(p.x, p.y, p.z)) {
      p.z = pz;
      const imp2 = Math.abs(this.vz);
      this._hitN = { x: 0, y: 0, z: -(Math.sign(this.vz) || 1) };   // v25.7
      this.vz *= -0.4;
      if (imp2 < 0.8) this.vz = 0;
      this.wallHit = true;
      if (this.kind === 'frag' && !this.opts.R && imp2 > 1.2) { AUDIO.tone(2100, 0.05, 'square', 0.1); PARTICLES.impact(p.x, p.y, p.z); }
    }
    p.y += this.vy * dt;

    if (p.y <= this.r) {
      p.y = this.r;
      if (Math.abs(this.vy) > 2.2 && !(this.kind === 'sticky' && !this.stuck)) { this.vy *= -0.35; this.vx *= 0.65; this.vz *= 0.65; }   // 粘雷不弹跳：触地即粘（v25.7）
      else { this.vy = 0; this.vx *= 0.9; this.vz *= 0.9; this.landed = true; this._hitN = { x: 0, y: 1, z: 0 }; }
    }

    if (this.kind === 'molotov') PARTICLES.flames(p.x, p.y, p.z, 1);
    if (this.kind === 'acid' && Math.random() < 0.4) PARTICLES.acidSplash(p.x, p.y, p.z);
    // 火箭弹（v25.7）：弹头指向速度方向，尾焰+烟迹
    if (this.kind === 'rocket') {
      this.mesh.lookAt(p.x + this.vx, p.y + this.vy, p.z + this.vz);
      const vl = Math.hypot(this.vx, this.vy, this.vz) || 1;
      const tx = p.x - this.vx / vl * 0.34, ty = p.y - this.vy / vl * 0.34, tz = p.z - this.vz / vl * 0.34;
      PARTICLES.spawn('spark', tx, ty, tz, 2, { speed: 0.8, vy: 1.2, life: 0.3, color: [1, 0.62, 0.12], color2: [0.9, 0.2, 0.02] });
      if (Math.random() < 0.65) PARTICLES.spawn('smoke', tx, ty, tz, 1, { speed: 0.5, vy: 0.8, life: 1.2, color: [0.45, 0.44, 0.42], color2: [0.24, 0.24, 0.23] });
    }
    // 榴弹（v25.7）：飞行中拖淡淡硝烟
    if (this.kind === 'gl' && Math.random() < 0.3) PARTICLES.spawn('smoke', p.x, p.y, p.z, 1, { speed: 0.3, vy: 0.5, life: 0.5, color: [0.55, 0.55, 0.5], color2: [0.3, 0.3, 0.3] });
    // M79榴弹/火箭弹：碰到丧尸立即引爆（高速碰炸引信，v25.7 火箭弹共用）
    // 敌方手雷（v15.3）：opts.R 提供独立伤害/半径（军阀小Boss），且不做碰炸（避免炸到周围尸群/自己）
    if ((this.kind === 'gl' || this.kind === 'rocket') && !this.opts.R) {
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
    // M79榴弹/火箭弹：碰炸（墙/地/碰到即炸）
    if ((this.kind === 'gl' || this.kind === 'rocket') && (this.wallHit || p.y <= this.r + 0.01 || this.fuse <= 0)) {
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
    // 粘性炸药（v22.2→v25.7 重做）：触尸/触墙/落地即粘住——粘尸跟随目标，粘墙钉在墙面
    if (this.kind === 'sticky' && !this.stuck && (this.wallHit || this.landed || this._touchZombie(game))) {
      const zbHit = this._touchZombie(game);
      this.stuck = true; this.stuckT = THROWABLES.sticky.fuse;
      this.vx = this.vy = this.vz = 0;
      if (zbHit) {
        this.stuckZ = zbHit;
        const s = zbHit.group.scale.x;
        this.stickOff = { x: p.x - zbHit.pos.x, y: (p.y - zbHit.pos.y) / s, z: p.z - zbHit.pos.z };
      } else if (this._hitN) {
        // 朝墙面步进贴紧（回退位可能离面一帧步距），再沿法线外推半个半径——visible 钉在表面上
        for (let s2 = 0; s2 < 12; s2++) {
          const nx2 = p.x - this._hitN.x * 0.025, ny2 = p.y - this._hitN.y * 0.025, nz2 = p.z - this._hitN.z * 0.025;
          if (pointBlocked(nx2, ny2, nz2)) break;
          p.x = nx2; p.y = ny2; p.z = nz2;
        }
        p.x += this._hitN.x * this.r * 0.5; p.y += this._hitN.y * this.r * 0.5; p.z += this._hitN.z * this.r * 0.5;
      }
      if (this.beacon) this.beacon.visible = true;
      AUDIO.tone(900, 0.06, 'square', 0.12);
    }
    // 粘性炸药：始终未粘住也按引信引爆（v22.2 兜底）
    if (this.kind === 'sticky' && !this.stuck && this.fuse <= 0) {
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
    disposeObject3D(this.mesh);   // v25.7：火箭弹/粘雷信标等多部件统一释放
  }
}

/* 粘性炸药触尸检测（v22.2）：返回被触的丧尸本体（v25.7 粘附跟随需要引用），未触返回 null */
Projectile.prototype._touchZombie = function (game) {
  const p = this.pos;
  for (const zb of game.zombies) {
    if (zb.dead || zb.state === 'rise') continue;
    const dx = zb.pos.x - p.x, dz = zb.pos.z - p.z;
    if (dx * dx + dz * dz < 0.42 && p.y < zb.pos.y + 1.9 * zb.group.scale.x) return zb;
  }
  return null;
};

/* ---------- 声波诱饵场（v10.4 Days Gone → v25.7 重做） ----------
 * 视觉：地面脉冲环 + 竖直信标光柱；吸引逻辑移入丧尸AI（zombie.js 覆盖追击方向），
 * 此处只负责计时与视觉（旧版瞬移拉扯不自然且 update 从未被调用——光环永不消失的根因） */
const ATTRACTORS = { list: [],
  clear() {
    for (const a of this.list) this._disposeFx(a);
    this.list = [];
  },
  _disposeFx(a) {
    if (a.ring) { a.ring.geometry.dispose(); a.ring.material.dispose(); ENGINE.scene.remove(a.ring); }
    if (a.beam) { a.beam.geometry.dispose(); a.beam.material.dispose(); ENGINE.scene.remove(a.beam); }
  },
};
function spawnAttractor(game, x, z, duration) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.65, 24),
    new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.06, z);
  ENGINE.scene.add(ring);
  // 信标光柱（v25.7）：远处可见
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.14, 7, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.set(x, 3.5, z);
  ENGINE.scene.add(beam);
  ATTRACTORS.list.push({ x, z, t: duration, ring, beam });
  AUDIO.waveHorn();
  HUD.toast('📣 声波诱饵启动——感染体正在聚拢');
}
function updateAttractors(dt, game) {
  for (const a of ATTRACTORS.list) {
    a.t -= dt;
    if (a.t <= 0) { ATTRACTORS._disposeFx(a); a.dead = true; continue; }
    a.ring.scale.setScalar(1 + Math.sin(ENGINE.time * 6) * 0.15);
    a.ring.material.opacity = 0.5 + Math.sin(ENGINE.time * 6) * 0.25;
    a.beam.material.opacity = 0.14 + Math.sin(ENGINE.time * 6) * 0.1;
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
  const R = cfg.radius || 4;
  if (typeof FLASHES !== 'undefined') FLASHES.spawn(x, (y || 0) + 0.5, z, 0xffa040, R >= 6.5 ? 3.4 : 2.0, R * 3.2, R >= 6.5 ? 0.3 : 0.18);
  if (R >= 6.5) {   // 大口径爆炸（火箭弹/巨爆）：二次火球 + 翻滚浓烟（v25.7）
    PARTICLES.spawn('spark', x, (y || 0) + 0.5, z, 34, { speed: 7.5, vy: 3.5, life: 0.8, color: [1, 0.6, 0.14], color2: [0.85, 0.12, 0.02] });
    PARTICLES.spawn('smoke', x, (y || 0) + 1.4, z, 16, { speed: 2.6, vy: 2.6, life: 2.2, color: [0.22, 0.2, 0.18], color2: [0.1, 0.1, 0.1] });
  }
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
    // v25.7 关键修复：此前只有 fire 走 radius/dps/duration，gas 被当 acid 读 pool* 键——
    // 毒云 r/dps/ttl 全为 undefined（不伤人、不可见、永不消散）的根因
    const acidKeys = kind === 'acid';
    this.r = acidKeys ? cfg.poolRadius : cfg.radius;
    this.dps = acidKeys ? cfg.poolDps : cfg.dps;
    this.ttl = acidKeys ? cfg.poolTime : cfg.duration;
    this.dead = false; this.tick = 0;
    const color = kind === 'fire' ? 0xff6a1a : kind === 'gas' ? 0x86c93a : 0x55cc22;   // v25.7 毒气黄绿区分酸液
    this.mesh = new THREE.Mesh(
      new THREE.CircleGeometry(this.r, 26),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.05, z);
    ENGINE.scene.add(this.mesh);
    // 毒云立体雾团（v25.7）：数个半透明绿球起伏翻滚——"表现效果不明显"修复的主体
    this.puffs = null;
    if (kind === 'gas') {
      this.puffs = [];
      for (let i = 0; i < 5; i++) {
        const s = this.r * rand(0.4, 0.62);
        const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0x7ab824, transparent: true, opacity: 0.13, depthWrite: false }));
        puff.position.set(x + rand(-this.r, this.r) * 0.5, rand(0.5, 1.6), z + rand(-this.r, this.r) * 0.5);
        puff.userData.ph = rand(0, TAU);
        ENGINE.scene.add(puff);
        this.puffs.push(puff);
      }
    }
  }

  dispose() {
    this.dead = true;
    disposeObject3D(this.mesh); ENGINE.scene.remove(this.mesh);
    if (this.puffs) for (const pf of this.puffs) { disposeObject3D(pf); ENGINE.scene.remove(pf); }
  }

  update(dt, game) {
    this.ttl -= dt;
    if (this.ttl <= 0) { this.dispose(); return; }
    this.mesh.material.opacity = 0.22 + Math.sin(ENGINE.time * 9) * 0.08;
    if (this.puffs) {
      for (const pf of this.puffs) {
        pf.position.y += Math.sin(ENGINE.time * 1.7 + pf.userData.ph) * dt * 0.35;
        const k = 1 + Math.sin(ENGINE.time * 2.2 + pf.userData.ph) * 0.08;
        pf.scale.setScalar(k);
        pf.material.opacity = Math.min(0.22, this.ttl) * (0.55 + Math.sin(ENGINE.time * 2.8 + pf.userData.ph) * 0.3);
      }
    }
    this._fxT = (this._fxT || 0) - dt;
    if (this.kind === 'fire') {
      const a = Math.random() * TAU, rr = Math.random() * this.r;
      PARTICLES.flames(this.x + Math.cos(a) * rr, 0.2, this.z + Math.sin(a) * rr, 2);
    } else if (this.kind === 'gas') {
      if (this._fxT <= 0) {   // 毒雾粒子节流（12粒/0.12s，防刷爆共享粒子池）
        this._fxT = 0.12;
        const a = Math.random() * TAU, rr = Math.random() * this.r;
        PARTICLES.acidSplash(this.x + Math.cos(a) * rr, 0.4 + Math.random() * 0.8, this.z + Math.sin(a) * rr);
      }
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

/* v25.6 区域效果上限：毒液喷射器等高频生成防堆积——超限回收最旧的 */
function capZones(arr, max) {
  while (arr.length >= max) {
    const old = arr.shift();
    if (!old.dead) old.dispose();
  }
}
function spawnFireZone(game, x, z, cfg) { capZones(game.fireZones, 14); game.fireZones.push(new Zone(x, z, 'fire', cfg)); }
function spawnGasCloud(game, x, z, cfg) { capZones(game.gasClouds, 8); game.gasClouds.push(new Zone(x, z, 'gas', cfg)); }
function spawnAcidPool(game, x, z, R) { if (!R) return; capZones(game.acidPools, 12); game.acidPools.push(new Zone(x, z, 'acid', R)); }

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
