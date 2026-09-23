/* ============================================================
 * 支援道具系统（v16.3 → v19.1 特效与数值全面升级）
 * 调研依据（docs/research/v16.1-mutation-support-items.md）：
 * - COD killstreak 共性结构：玩家指定 → 延迟 → 区域性效果（空袭/空投）
 * - Helldivers 2：投送前摇 + 真实友军伤害（高风险高收益）+ 降落伞空投
 * - TF2 哨戒塔：锥形索敌、弹药封顶、打完报废（一次性战术资产）
 * - 伴随无人机：跟随偏移悬停、自动索敌、持续时间限制
 * v19.1：空袭改为轰炸机临空投弹的完整动画（飞机模型/航弹下落/落点爆炸）；
 * 空投补给带降落伞缓降与落点标记；哨戒机枪弹尽冒烟报废后消散；
 * 全部支援效果数值提升（范围/持续/火力）。
 * 工程要点：全部挂 game.deployments 由游戏循环驱动（暂停安全），不用裸 setTimeout
 * ============================================================ */

const SUPPORTFX = {
  /* 背包点击使用：扣次数并生效，返回是否成功 */
  use(id, game) {
    const p = game.player;
    if (!p || !p.alive) return false;
    const inv = p.supports;
    if (!inv || !inv[id] || inv[id] <= 0) { AUDIO.emptyClick(); return false; }
    inv[id]--;
    switch (id) {
      case 'airstrike': game.deployments.push(new AirstrikeRun(game)); break;
      case 'supply': game.deployments.push(new SupportCrate(game)); break;
      case 'drone': game.deployments.push(new SupportDrone(game)); break;
      case 'sentry': game.deployments.push(new SentryGun(game)); break;
      case 'meddrone': game.deployments.push(new HealDrone(game)); break;
      case 'tesla': game.deployments.push(new TeslaPylon(game)); break;
      case 'mortar': game.deployments.push(new MortarTeam(game)); break;
      case 'mines': game.deployments.push(new MineField(game)); break;
      case 'napalm': game.deployments.push(new NapalmStrike(game)); break;
      case 'orbital': game.deployments.push(new OrbitalLaser(game)); break;
    }
    return true;
  },
};

/* ---------- 轰炸机模型（v19.1）：双发喷气式，机头朝本地 +z ---------- */
function buildBomber() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x46505a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x333b42 });
  // 机身
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 6.4, 8), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // 机鼻锥（+z 前方）
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8), dark);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.9;
  g.add(nose);
  // 座舱
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.3),
    new THREE.MeshLambertMaterial({ color: 0x8ab8d8, transparent: true, opacity: 0.85 }));
  cockpit.position.set(0, 0.42, 1.9);
  g.add(cockpit);
  // 主翼（微上反角）
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.12, 1.8), mat);
  wing.position.set(0, 0.1, 0.3);
  g.add(wing);
  // 双发吊舱 + 尾喷焰
  for (const sx of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.4, 8), dark);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(sx * 2.5, -0.14, 0.4);
    g.add(pod);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa040 }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(sx * 2.5, -0.14, 1.25);
    g.add(glow);
  }
  // 尾翼
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.95), mat);
  tail.position.set(0, 0.32, 2.9);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 1.0), mat);
  fin.position.set(0, 0.72, 3.0);
  g.add(tail, fin);
  return g;
}

/* ---------- 航弹模型 ---------- */
function buildBomb() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x3d4a3a }));
  g.add(body);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.02),
    new THREE.MeshLambertMaterial({ color: 0x2c332c }));
  fin.position.z = -0.26;
  g.add(fin);
  return g;
}

/* ---------- 战机轰炸（v19.1 动画化）----------
 * 2.2s 红色警示带闪烁 → 轰炸机从弹带前端临空，沿带投下 12 枚航弹
 * （航弹带尾烟抛物线下落、触地爆炸），含友军伤害 */
/* 支援强化乘区（v20.4 火力协调：伤害/范围/持续） */
function supportMult(game) {
  const p = game && game.player;
  return {
    dmg: (p && p.supDmg) || 1,
    rad: (p && p.supRad) || 1,
    dur: (p && p.supDur) || 1,
  };
}

class AirstrikeRun {
  constructor(game) {
    const p = game.player;
    this.t = 0; this.warnT = 2.2; this.dead = false;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    this.cx = p.pos.x + fx * 22; this.cz = p.pos.z + fz * 22;   // 弹带中心22m前方
    this.dirX = fx; this.dirZ = fz;
    this.speed = 26; this.alt = 26;
    // 警示带：红色半透明平面（52m × 10m）
    const g = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(52, 10),
      new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.07;
    g.add(plane);
    g.position.set(this.cx, 0, this.cz);
    g.rotation.y = Math.atan2(-fz, fx);
    this.group = g;
    this.warnMat = plane.material;
    ENGINE.scene.add(g);
    // 轰炸机：从弹带起点后方 46m 处进场
    this.px = this.cx - this.dirX * 46;
    this.pz = this.cz - this.dirZ * 46;
    this.plane = buildBomber();
    this.plane.position.set(this.px, this.alt, this.pz);
    ENGINE.scene.add(this.plane);
    this.planeSpawnT = 0;   // 进场计时（投弹节拍用）
    this.dropGap = 0.165; this.dropT = 0; this.dropped = 0; this.drops = 12;
    this.bombs = [];
    HUD.toast('✈ 轰炸机已进场——2.2秒后覆盖前方弹幕带，快离开红色区域！');
    AUDIO.waveHorn();
  }

  update(dt, game) {
    this.t += dt;
    // 阶段1：警示带闪烁
    if (this.t < this.warnT) {
      this.warnMat.opacity = 0.16 + 0.14 * (Math.sin(this.t * 14) > 0 ? 1 : 0);
      return;
    }
    this.warnMat.opacity = 0.3;
    // 阶段2：轰炸机飞行投弹
    this.planeSpawnT += dt;
    this.px += this.dirX * this.speed * dt;
    this.pz += this.dirZ * this.speed * dt;
    this.plane.position.set(this.px, this.alt, this.pz);
    const lookX = this.px + this.dirX * 10, lookZ = this.pz + this.dirZ * 10;
    this.plane.lookAt(lookX, this.alt, lookZ);
    // 投弹节拍：进场即开始，按 0.165s 间隔投满 12 枚（覆盖整条弹带）
    this.dropT -= dt;
    if (this.dropped < this.drops && this.planeSpawnT >= 0.15 && this.dropT <= 0) {
      this.dropT = this.dropGap;
      this.dropped++;
      const lat = rand(-3.4, 3.4);   // 横向散布（覆盖10m带宽）
      const bx = this.px - this.dirZ * lat;
      const bz = this.pz + this.dirX * lat;
      const mesh = buildBomb();
      mesh.position.set(bx, this.alt - 0.9, bz);
      ENGINE.scene.add(mesh);
      this.bombs.push({
        x: bx, y: this.alt - 0.9, z: bz,
        vx: this.dirX * this.speed * 0.55, vz: this.dirZ * this.speed * 0.55, vy: -2,
        mesh, trailT: 0,
      });
      AUDIO.shot(220, 0.05, 0.2, 20);
    }
    // 航弹下落与触地爆炸
    for (const b of this.bombs) {
      b.vy -= 26 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.x += dt * 2.4; b.mesh.rotation.z += dt * 1.7;
      b.trailT -= dt;
      if (b.trailT <= 0) {   // 尾烟
        b.trailT = 0.06;
        PARTICLES.spawn('spark', b.x, b.y, b.z, 1,
          { speed: 0.35, vy: 0.25, life: 0.35, color: [0.75, 0.75, 0.75], color2: [0.3, 0.3, 0.3] });
      }
      if (b.y <= 0.4) {
        b.dead = true;
        const SM = supportMult(game);
        explodeGrenade(game, b.x, 0.4, b.z, { damage: 180 * SM.dmg, radius: 6.2 * SM.rad, selfMult: 1 });
        PARTICLES.explosion(b.x, 1.2, b.z);
        ENGINE.shake(0.38);
        AUDIO.explode(dist2d(b.x, b.z, game.player.pos.x, game.player.pos.z));
      }
    }
    this.bombs = this.bombs.filter(b => !b.dead);
    // 阶段3：投弹完毕、航弹清空、飞机飞远 → 结束
    if (this.dropped >= this.drops && this.bombs.length === 0 && this.planeSpawnT > 4.6) {
      this.dead = true;
      this.warnMat.opacity = 0;
    }
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    ENGINE.scene.remove(this.plane);
    this.plane.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    for (const b of this.bombs) {
      ENGINE.scene.remove(b.mesh);
      b.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
  }
}

/* ---------- 空投补给（v19.1：降落伞缓降 + 落点标记 + 内容升级）----------
 * 全弹药 + 医疗×3 + 手雷×2/燃烧瓶×1 + $800；落点3米内砸落伤害 */
class SupportCrate {
  constructor(game) {
    const p = game.player;
    this.dead = false; this.landed = false; this.t = 0;
    this.x = p.pos.x + rand(-1.5, 1.5);
    this.z = p.pos.z + rand(-1.5, 1.5);
    const S = ENGINE.mapDef.size - 2;
    this.x = clamp(this.x, -S, S); this.z = clamp(this.z, -S, S);
    this.vy = -9;
    const g = new THREE.Group();
    // 箱体：橄榄木箱 + 红白识别条
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x5a6648 }));
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.22, 1.02),
      new THREE.MeshLambertMaterial({ color: 0xc84030 }));
    band.position.y = 0.2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.86),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }));
    top.position.y = 0.5;
    g.add(box, band, top);
    // 降落伞（v19.1）：伞衣 + 四根伞绳
    this.canopy = new THREE.Group();
    const cloth = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c0, side: THREE.DoubleSide }));
    this.canopy.add(cloth);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.7, 4),
        new THREE.MeshLambertMaterial({ color: 0xc9c2ac }));
      rope.position.set(sx * 0.5, 1.0, sz * 0.42);
      rope.rotation.z = sx * 0.28; rope.rotation.x = -sz * 0.24;
      this.canopy.add(rope);
    }
    this.canopy.position.y = 0.6;
    g.add(this.canopy);
    // 落点标记圈（红白虚线圆）
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 26),
      new THREE.MeshBasicMaterial({ color: 0xff4030, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    this.ring = ring;
    g.add(ring);
    g.position.set(this.x, 30, this.z);
    this.group = g;
    ENGINE.scene.add(g);
    HUD.toast('📦 空投补给已投放——降落伞缓降中，注意落点！');
    AUDIO.waveHorn();
  }

  update(dt, game) {
    const g = this.group;
    this.t += dt;
    if (!this.landed) {
      this.vy = Math.max(-11, this.vy - 6 * dt);
      g.position.y += this.vy * dt;
      g.rotation.y += dt * 0.8;
      g.rotation.z = Math.sin(this.t * 1.6) * 0.06;   // 伞摆
      this.ring.material.opacity = 0.35 + 0.25 * (Math.sin(this.t * 8) > 0 ? 1 : 0);
      if (g.position.y <= 0.48) {
        g.position.y = 0.48;
        this.landed = true;
        this.fadeT = 9;
        this.canopy.visible = false;   // 落地收伞
        this.ring.visible = false;
        PARTICLES.dust(this.x, 0.4, this.z, 16);
        PARTICLES.explosion(this.x, 0.6, this.z);
        ENGINE.shake(0.4);
        AUDIO.impact();
        // 落点砸落伤害（友伤风险）
        const p = game.player;
        const pd = dist2d(this.x, this.z, p.pos.x, p.pos.z);
        if (p.alive && pd < 3) {
          p.takeDamage(16, game, { x: this.x, z: this.z });
          const dl = pd || 1;
          p.vel.x += (p.pos.x - this.x) / dl * 6;
          p.vel.z += (p.pos.z - this.z) / dl * 6;
          p.vel.y += 2.5;
        }
        // 补给内容（v19.1 升级）：全弹药 + 医疗×3 + $800 + 投掷物礼包
        for (const s of ['primary', 'secondary']) {
          for (const inst of p.rack[s]) {
            inst.reserve = Math.floor(inst.def.reserve * p.reserveMult);
            inst.mag = inst.magSize;
          }
        }
        p.medkits = Math.min(GAMECONFIG.inventory.medkitMax, p.medkits + 3);
        p.throwables.frag.count = Math.min(THROWABLES.frag.max, p.throwables.frag.count + 2);
        p.throwables.molotov.count = Math.min(THROWABLES.molotov.max, p.throwables.molotov.count + 1);
        p.addMoney(800);
        HUD.banner('📦 空投补给到手', '全弹药补满 · 医疗包×3 · 手雷×2 · 燃烧瓶×1 · $800');
        AUDIO.purchase();
      }
    } else {
      this.fadeT -= dt;
      if (this.fadeT < 1) g.scale.setScalar(Math.max(0.01, this.fadeT));
      if (this.fadeT <= 0) this.dead = true;
    }
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}

/* ---------- 攻击无人机（v19.1：35s / 索敌22m / 火力升级）---------- */
class SupportDrone {
  constructor(game) {
    const p = game.player;
    this.life = 35 * supportMult(game).dur; this.fireT = 0.8; this.phase = rand(0, TAU); this.dead = false;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x3a4148 }));
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xff4030 }));
    eye.position.set(0, 0.02, 0.26);
    g.add(body, eye);
    // 四臂 + 旋翼盘（旋转动画）
    this.rotors = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05),
        new THREE.MeshLambertMaterial({ color: 0x2a2f34 }));
      arm.position.set(sx * 0.22, 0.04, sz * 0.28);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.015, 10),
        new THREE.MeshLambertMaterial({ color: 0x555c64, transparent: true, opacity: 0.75 }));
      rotor.position.set(sx * 0.26, 0.09, sz * 0.32);
      g.add(arm, rotor);
      this.rotors.push(rotor);
    }
    // 双联机枪
    for (const sx of [-1, 1]) {
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6),
        new THREE.MeshLambertMaterial({ color: 0x22262a }));
      gun.rotation.x = Math.PI / 2;
      gun.position.set(sx * 0.08, -0.05, 0.3);
      g.add(gun);
    }
    g.position.set(p.pos.x, p.pos.y + 3.2, p.pos.z + 1.5);
    this.group = g;
    ENGINE.scene.add(g);
    HUD.toast('🛸 攻击无人机已升空——伴飞35秒自动索敌');
  }

  update(dt, game) {
    const p = game.player;
    this.life -= dt;
    this.phase += dt;
    const g = this.group;
    // 伴飞悬停：玩家上方环绕漂移
    const tx = p.pos.x + Math.sin(this.phase * 0.8) * 1.7;
    const tz = p.pos.z + Math.cos(this.phase * 0.8) * 1.7;
    const ty = p.pos.y + 3.0 + Math.sin(this.phase * 1.7) * 0.16;
    const k = Math.min(1, 4.5 * dt);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
    for (const r of this.rotors) r.rotation.y += dt * 40;
    // 低电量闪烁
    this.group.visible = this.life > 0 || Math.sin(this.life * 20) > 0;

    // 索敌：22m内最近感染体（v19.1）
    this.fireT -= dt;
    let best = null, bd = 22;
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      const d = dist2d(z.pos.x, z.pos.z, g.position.x, g.position.z);
      if (d < bd) { bd = d; best = z; }
    }
    if (best && this.life > 0 && this.fireT <= 0) {
      this.fireT = 0.4;
      // 枪口 → 目标胸口 曳光
      const mz = { x: g.position.x, y: g.position.y - 0.06, z: g.position.z };
      const ty = best.pos.y + 1.1 * best.group.scale.x;
      const end = { x: best.pos.x, y: ty, z: best.pos.z };
      if (typeof TRACERS !== 'undefined') TRACERS.fire(mz, end);
      PARTICLES.spawn('spark', mz.x, mz.y, mz.z, 1,
        { speed: 1.2, vy: 0.5, life: 0.1, color: [1, 0.85, 0.4], color2: [0.9, 0.5, 0.1] });
      AUDIO.shot(300, 0.04, 0.25, bd);
      const isHead = Math.random() < 0.25;   // 25%概率打中头部
      best.takeDamage((isHead ? 48 : 28) * supportMult(game).dmg, isHead, { x: best.pos.x, y: ty, z: best.pos.z }, game, null);
    }
    // 撤离：升空飞走
    if (this.life <= 0) {
      g.position.y += 9 * dt;
      if (this.life < -1.6) {
        this.dead = true;
        HUD.toast('🛸 攻击无人机已返航');
      }
    }
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}

/* ---------- 哨戒机枪（v19.1：150°扇形20m、240发、弹尽冒烟消散）---------- */
class SentryGun {
  constructor(game) {
    const p = game.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    this.baseYaw = Math.atan2(fx, fz);
    this.yaw = this.baseYaw;
    this.ammo = Math.round(240 * supportMult(game).dur); this.fireT = 0.6; this.life = 75; this.dead = false; this.downed = false; this.downT = 0;
    const S = ENGINE.mapDef.size - 2;
    this.x = clamp(p.pos.x + fx * 1.6, -S, S);
    this.z = clamp(p.pos.z + fz * 1.6, -S, S);
    const g = new THREE.Group();
    // 三脚架
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.8, 6),
        new THREE.MeshLambertMaterial({ color: 0x3a3f36 }));
      const a = (i / 3) * TAU;
      leg.position.set(Math.cos(a) * 0.16, 0.38, Math.sin(a) * 0.16);
      leg.rotation.z = Math.cos(a) * 0.35;
      leg.rotation.x = Math.sin(a) * 0.35;
      g.add(leg);
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x2c3130 }));
    post.position.y = 0.85;
    g.add(post);
    // 枪头（可旋转组）
    const head = new THREE.Group();
    head.position.y = 1.15;
    const hBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x39423c }));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x22262a }));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.38;
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x40ff60 }));
    led.position.set(0, 0.1, 0.1);
    head.add(hBody, barrel, led);
    this.head = head; this.led = led;
    g.add(head);
    g.position.set(this.x, 0, this.z);
    // 部署尘土
    PARTICLES.dust(this.x, 0.3, this.z, 10);
    this.group = g;
    ENGINE.scene.add(g);
    HUD.toast('🔫 哨戒机枪已部署——240发弹链，150°扇形自动索敌');
    AUDIO.purchase();
  }

  update(dt, game) {
    // 弹尽/到寿：冒烟 → 缩小消散 → 移除（v19.1 修复：弹尽后不再永驻场景）
    if (this.downed) {
      this.downT -= dt;
      this.led.material.color.setHex(0xff3020);
      if (Math.random() < dt * 9) {
        PARTICLES.spawn('spark', this.x, 1.25, this.z, 1,
          { speed: 0.5, vy: 1.3, life: 0.55, color: [0.42, 0.42, 0.42], color2: [0.14, 0.14, 0.14] });
      }
      this.group.scale.setScalar(Math.max(0.01, this.downT / 1.2));
      if (this.downT <= 0) {
        this.dead = true;
        HUD.toast('🔫 哨戒机枪已报废回收');
      }
      return;
    }
    this.life -= dt;
    // 索敌：150°扇形（±75°）内最近目标（v19.1 扩大）
    let best = null, bd = 20;
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      const d = dist2d(z.pos.x, z.pos.z, this.x, this.z);
      if (d > bd || d < 0.5) continue;
      const ang = Math.atan2(z.pos.x - this.x, z.pos.z - this.z);
      const diff = Math.abs(((ang - this.baseYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < Math.PI * 75 / 180) { bd = d; best = z; }
    }
    // 枪头转向
    const want = best ? Math.atan2(best.pos.x - this.x, best.pos.z - this.z) : this.baseYaw;
    this.yaw = angleLerp(this.yaw, want, Math.min(1, 7 * dt));
    this.head.rotation.y = this.yaw - this.baseYaw;
    // 开火
    this.fireT -= dt;
    if (best && this.ammo > 0 && this.fireT <= 0) {
      this.fireT = 0.11;
      this.ammo--;
      const mz = { x: this.x, y: 1.15, z: this.z };
      const ty = best.pos.y + 1.0 * best.group.scale.x;
      const end = { x: best.pos.x, y: ty, z: best.pos.z };
      if (typeof TRACERS !== 'undefined') TRACERS.fire(mz, end);
      AUDIO.shot(190, 0.045, 0.3, bd);
      const isHead = Math.random() < 0.22;
      best.takeDamage((isHead ? 40 : 22) * supportMult(game).dmg, isHead, { x: best.pos.x, y: ty, z: best.pos.z }, game, null);
      if (this.ammo <= 0) {
        this.downed = true;
        this.downT = 1.2;
        HUD.toast('🔫 哨戒机枪弹链打空——冒烟报废中');
      }
    }
    if (this.life <= 0) {
      this.downed = true;
      this.downT = 1.2;
    }
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}


/* ---------- 医疗无人机（v22.3）：伴飞24s，6m内 3HP/s 治疗 ---------- */
class HealDrone {
  constructor(game) {
    const p = game.player;
    this.life = 24 * supportMult(game).dur;
    this.phase = rand(0, TAU);
    this.dead = false;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.44), new THREE.MeshLambertMaterial({ color: 0xd8dde2 }));
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.07), new THREE.MeshLambertMaterial({ color: 0x3aa05a }));
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.22), cross1.material);
    cross1.position.y = cross2.position.y = 0.06;
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.06), new THREE.MeshLambertMaterial({ color: 0x22262a }));
    rotor.position.y = 0.09;
    this.rotor = rotor;
    g.add(body, cross1, cross2, rotor);
    ENGINE.scene.add(g);
    this.group = g;
    HUD.toast('🚁 医疗无人机上线——跟随治疗中');
  }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0 || game.player.dead) { this.dead = true; disposeObject3D(this.group); ENGINE.scene.remove(this.group); return; }
    const p = game.player;
    this.phase += dt;
    const tx = p.pos.x + Math.sin(this.phase * 0.8) * 1.6;
    const tz = p.pos.z + Math.cos(this.phase * 0.8) * 1.6;
    const ty = p.pos.y + 2.4 + Math.sin(this.phase * 2) * 0.12;
    this.group.position.x += (tx - this.group.position.x) * Math.min(1, dt * 3);
    this.group.position.z += (tz - this.group.position.z) * Math.min(1, dt * 3);
    this.group.position.y += (ty - this.group.position.y) * Math.min(1, dt * 3);
    this.rotor.rotation.y += dt * 30;
    // 治疗：6m内 3HP/s
    if (p.alive && p.hp < p.maxHp && dist2d(this.group.position.x, this.group.position.z, p.pos.x, p.pos.z) < 6) {
      p.hp = Math.min(p.maxHp, p.hp + 3 * dt);
      if (Math.random() < dt * 6) PARTICLES.spawn('spark', p.pos.x, p.pos.y + 1.2, p.pos.z, 1,
        { speed: 0.8, vy: 1.4, life: 0.5, color: [0.4, 1, 0.6], color2: [0.1, 0.5, 0.3] });
    }
  }
}

/* ---------- 电弧塔（v22.3）：14m 自动电击，链跳2目标，50充能 ---------- */
class TeslaPylon {
  constructor(game) {
    const p = game.player;
    const SM = supportMult(game);
    this.charges = Math.round(50 * SM.dur);
    this.fireT = 0.6;
    this.dead = false;
    const S = ENGINE.mapDef.size - 2;
    this.x = clamp(p.pos.x + Math.sin(p.yaw) * -1.8, -S, S);
    this.z = clamp(p.pos.z + Math.cos(p.yaw) * -1.8, -S, S);
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.24, 8), new THREE.MeshLambertMaterial({ color: 0x33383e }));
    base.position.y = 0.12;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.5, 8), new THREE.MeshLambertMaterial({ color: 0x4a525a }));
    pole.position.y = 0.95;
    const coil = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8ad8ff, emissive: 0x2a7ab0, emissiveIntensity: 1.2 }));
    coil.position.y = 1.85;
    g.add(base, pole, coil);
    this.coil = coil;
    g.position.set(this.x, 0, this.z);
    ENGINE.scene.add(g);
    this.group = g;
    HUD.toast('⚡ 电弧塔部署完毕——自动放电中');
  }
  update(dt, game) {
    this.fireT -= dt;
    // 线圈呼吸光
    this.coil.material.emissiveIntensity = 0.9 + Math.sin(ENGINE.time * 6) * 0.4;
    if (this.charges <= 0) return;
    let best = null, bd = 14;
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      const d = dist2d(z.pos.x, z.pos.z, this.x, this.z);
      if (d < bd) { bd = d; best = z; }
    }
    if (best && this.fireT <= 0) {
      this.fireT = 0.8;
      this.charges--;
      const SM = supportMult(game);
      const ty = best.pos.y + 1.1 * best.group.scale.x;
      if (typeof TRACERS !== 'undefined') TRACERS.fire({ x: this.x, y: 1.85, z: this.z }, { x: best.pos.x, y: ty, z: best.pos.z });
      best.takeDamage(26 * SM.dmg, false, { x: best.pos.x, y: ty, z: best.pos.z }, game, null);
      best.stagger = Math.max(best.stagger || 0, 0.9);
      // 链跳：2m内最近另一目标
      let chain = null, cd = 2;
      for (const z2 of game.zombies) {
        if (z2.dead || z2 === best || z2.state === 'rise') continue;
        const d2 = dist2d(z2.pos.x, z2.pos.z, best.pos.x, best.pos.z);
        if (d2 < cd) { cd = d2; chain = z2; }
      }
      if (chain) {
        chain.takeDamage(26 * SM.dmg * 0.7, false, { x: chain.pos.x, y: chain.pos.y + 1.1 * chain.group.scale.x, z: chain.pos.z }, game, null);
        chain.stagger = Math.max(chain.stagger || 0, 0.7);
      }
      AUDIO.shot(900, 0.06, 0.3);
      if (this.charges <= 0) HUD.toast('⚡ 电弧塔充能耗尽——线圈烧毁');
    }
    if (this.charges <= 0) { this.dead = true; disposeObject3D(this.group); ENGINE.scene.remove(this.group); }
  }
}


/* ---------- 迫击炮小队（v23.3）：20s，每4s轰击随机感染体 ---------- */
class MortarTeam {
  constructor(game) {
    this.life = 20 * supportMult(game).dur;
    this.fireT = 1.2;
    this.dead = false;
    HUD.toast('🎯 迫击炮小队上线——自动覆盖火力');
  }
  update(dt, game) {
    this.life -= dt;
    this.fireT -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.fireT > 0) return;
    const alive = game.zombies.filter(z => !z.dead && z.state !== 'rise');
    if (!alive.length) { this.fireT = 1; return; }
    this.fireT = 4;
    const target = alive[randi(0, alive.length - 1)];
    const SM = supportMult(game);
    // 落点预警圈 + 延迟0.9s引爆
    const tx = target.pos.x, tz = target.pos.z;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 20),
      new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(tx, 0.06, tz);
    ENGINE.scene.add(ring);
    setTimeout(() => {
      try {
        disposeObject3D(ring); ENGINE.scene.remove(ring);
        if (!window.GAME || window.GAME.state === 'menu') return;
        explodeGrenade(GAME, tx, 0.2, tz, { damage: 150 * SM.dmg, radius: 3.5 * SM.rad, selfMult: 0.35 });
        AUDIO.explode(dist2d(tx, tz, GAME.player.pos.x, GAME.player.pos.z));
      } catch (e) {}
    }, 900);
  }
}

/* ---------- 地雷空投（v23.3）：环绕6枚感应雷 ---------- */
class MineField {
  constructor(game) {
    const p = game.player;
    this.mines = [];
    this.life = 30;
    this.dead = false;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const mx = clamp(p.pos.x + Math.cos(a) * 3.5, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
      const mz = clamp(p.pos.z + Math.sin(a) * 3.5, -ENGINE.mapDef.size + 1, ENGINE.mapDef.size - 1);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x3a4034 }));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff4030 }));
      led.position.y = 0.08;
      g.add(body, led);
      g.position.set(mx, 0.05, mz);
      ENGINE.scene.add(g);
      this.mines.push({ g, led, x: mx, z: mz, dead: false });
    }
    HUD.toast('💣 地雷空投完毕——6枚感应雷就位');
  }
  update(dt, game) {
    this.life -= dt;
    let anyAlive = false;
    for (const m of this.mines) {
      if (m.dead) continue;
      anyAlive = true;
      m.led.material.color.setHex(Math.sin(ENGINE.time * 8) > 0 ? 0xff4030 : 0x551512);
      for (const z of game.zombies) {
        if (z.dead || z.state === 'rise') continue;
        if (dist2d(z.pos.x, z.pos.z, m.x, m.z) < 1.3) {
          m.dead = true;
          m.g.visible = false;
          disposeObject3D(m.g); ENGINE.scene.remove(m.g);
          explodeGrenade(game, m.x, 0.2, m.z, { damage: 120 * supportMult(game).dmg, radius: 3 * supportMult(game).rad, selfMult: 0.4 });
          break;
        }
      }
    }
    if (this.life <= 0 || !anyAlive) {
      for (const m of this.mines) if (!m.dead) { m.g.visible = false; disposeObject3D(m.g); ENGINE.scene.remove(m.g); }
      this.dead = true;
    }
  }
}


/* ---------- 凝固汽油空袭（v24.3）：沿玩家前方48m弹幕带生成8片火区 ---------- */
class NapalmStrike {
  constructor(game) {
    this.dead = false;
    const p = game.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    HUD.banner('🔥 凝固汽油空袭', '弹幕带已标记——3秒后覆盖');
    AUDIO.hordeHorn();
    setTimeout(() => {
      try {
        if (!window.GAME || window.GAME.state === 'menu') return;
        const SM = supportMult(GAME);
        for (let i = 0; i < 8; i++) {
          const d = 6 + i * 6 + rand(-1.5, 1.5);
          const ox = rand(-4, 4);
          spawnFireZone(GAME, p.pos.x + fx * d + fz * ox, p.pos.z + fz * d - fx * ox,
            { dps: 30 * SM.dmg, radius: 2.8 * SM.rad, duration: 8 * SM.dur });
        }
        AUDIO.fireIgnite();
        HUD.toast('🔥 凝固汽油覆盖完毕——整条街都在燃烧');
      } catch (e) {}
    }, 3000);
    // 立即结束部署记录（火区由系统管理）
    setTimeout(() => { this.dead = true; }, 3100);
  }
  update(dt, game) {}
}

/* ---------- 轨道激光（v24.3）：8s 扇面扫掠光束 ---------- */
class OrbitalLaser {
  constructor(game) {
    const p = game.player;
    this.life = 8;
    this.cx = p.pos.x; this.cz = p.pos.z;
    this.ang = Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw)) - 1.05;
    this.dead = false;
    this.beam = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.12, 60),
      new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.75, depthWrite: false })
    );
    this.beam.position.set(this.cx, 14, this.cz);
    ENGINE.scene.add(this.beam);
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(4, 24),
      new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(this.cx, 0.08, this.cz);
    ENGINE.scene.add(this.glow);
    HUD.banner('🛰 轨道激光充能完毕', '天基武器扫掠扇面——撤离光束路径');
    AUDIO.hordeHorn();
  }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      disposeObject3D(this.beam); ENGINE.scene.remove(this.beam);
      disposeObject3D(this.glow); ENGINE.scene.remove(this.glow);
      return;
    }
    this.ang += dt * 0.26;   // 扫掠速度
    const dirx = Math.sin(this.ang), dirz = Math.cos(this.ang);
    this.beam.rotation.y = this.ang;
    this.beam.position.x = this.cx + dirx * 30;
    this.beam.position.z = this.cz + dirz * 30;
    this.glow.position.x = this.cx; this.glow.position.z = this.cz;
    this.glow.material.opacity = 0.2 + Math.sin(ENGINE.time * 10) * 0.1;
    // 光束伤害：点到线距离 < 0.9+体宽 的丧尸每帧 40dps×dt
    const SM = supportMult(game);
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      const rx = z.pos.x - this.cx, rz = z.pos.z - this.cz;
      const proj = rx * dirx + rz * dirz;
      if (proj < 0 || proj > 60) continue;
      const px = this.cx + dirx * proj, pz = this.cz + dirz * proj;
      const dl = dist2d(z.pos.x, z.pos.z, px, pz);
      if (dl < 1.1 * z.group.scale.x) {
        z.takeDamage(40 * SM.dmg * dt, false, { x: z.pos.x, y: 1.1 * z.group.scale.x, z: z.pos.z }, game, null);
        if (Math.random() < dt * 10) PARTICLES.spawn('spark', z.pos.x, 1.1 * z.group.scale.x, z.pos.z, 2,
          { speed: 3, vy: 2, life: 0.4, color: [1, 0.6, 0.3], color2: [1, 0.2, 0.1] });
      }
    }
  }
}
