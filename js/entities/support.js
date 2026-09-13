/* ============================================================
 * 支援道具系统（v16.3/v16.4）—— 战机轰炸 / 空投补给 / 攻击无人机 / 哨戒机枪
 * 调研依据（docs/research/v16.1-mutation-support-items.md）：
 * - COD killstreak 共性结构：玩家指定 → 延迟 → 区域性效果（空袭/空投）
 * - Helldivers 2：投送前摇 + 真实友军伤害（高风险高收益）
 * - TF2 哨戒塔：锥形索敌、弹药封顶、打完报废（一次性战术资产）
 * - 伴随无人机：跟随偏移悬停、自动索敌、持续时间限制
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
    }
    return true;
  },
};

/* ---------- 战机轰炸（v16.3）：面向玩家的40m×8m弹幕带 ----------
 * 2.5s 红色警示带闪烁（可逃离）→ 8 枚沿线形投弹，含友军伤害 */
class AirstrikeRun {
  constructor(game) {
    const p = game.player;
    this.t = 0; this.bombsLeft = 8; this.bombT = 0; this.dead = false;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    this.cx = p.pos.x + fx * 22; this.cz = p.pos.z + fz * 22;   // 弹带中心22m前方
    this.dirX = fx; this.dirZ = fz;
    // 警示带：红色半透明平面（长度沿本地X）
    const g = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(40, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.07;
    g.add(plane);
    g.position.set(this.cx, 0, this.cz);
    // 长轴(本地X)对齐弹幕方向
    g.rotation.y = Math.atan2(-fz, fx);
    this.group = g;
    this.warnMat = plane.material;
    ENGINE.scene.add(g);
    HUD.toast('✈ 战机已出动——2.5秒后覆盖前方弹幕带，快离开红色区域！');
    AUDIO.waveHorn();
  }

  update(dt, game) {
    this.t += dt;
    if (this.t < 2.5) {
      this.warnMat.opacity = 0.16 + 0.14 * (Math.sin(this.t * 14) > 0 ? 1 : 0);   // 危险闪烁
      return;
    }
    this.warnMat.opacity = 0.34;
    this.bombT -= dt;
    if (this.bombsLeft > 0 && this.bombT <= 0) {
      this.bombT = 0.22;
      this.bombsLeft--;
      const i = this.bombsLeft;
      const s = -18 + (7 - i) * (36 / 7);           // 沿弹带 -18m → +18m
      const lat = (i % 2 ? 1 : -1) * rand(0.8, 3);  // 横向抖动
      const bx = this.cx + this.dirX * s - this.dirZ * lat;
      const bz = this.cz + this.dirZ * s + this.dirX * lat;
      explodeGrenade(game, bx, 0.4, bz, { damage: 150, radius: 5.5, selfMult: 1 });
      PARTICLES.explosion(bx, 1.2, bz);
      ENGINE.shake(0.35);
      AUDIO.explode(dist2d(bx, bz, game.player.pos.x, game.player.pos.z));
    }
    if (this.bombsLeft <= 0 && this.t > 2.5 + 8 * 0.22 + 0.7) {
      this.dead = true;
      this.warnMat.opacity = 0;
    }
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}

/* ---------- 空投补给（v16.3）：箱体从天而降 → 全弹药+医疗×2+$600 ----------
 * 落点3米内有砸落伤害（Helldivers 式友伤风险） */
class SupportCrate {
  constructor(game) {
    const p = game.player;
    this.dead = false; this.landed = false;
    this.x = p.pos.x + rand(-1.5, 1.5);
    this.z = p.pos.z + rand(-1.5, 1.5);
    const S = ENGINE.mapDef.size - 2;
    this.x = clamp(this.x, -S, S); this.z = clamp(this.z, -S, S);
    this.vy = -14;
    // 箱体：橄榄木箱 + 红白识别条
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x5a6648 }));
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.22, 1.02),
      new THREE.MeshLambertMaterial({ color: 0xc84030 }));
    band.position.y = 0.2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.86),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }));
    top.position.y = 0.5;
    g.add(box, band, top);
    g.position.set(this.x, 30, this.z);
    this.group = g;
    ENGINE.scene.add(g);
    HUD.toast('📦 空投补给已投放——注意头顶落点！');
    AUDIO.waveHorn();
  }

  update(dt, game) {
    const g = this.group;
    if (!this.landed) {
      this.vy = Math.max(-26, this.vy - 10 * dt);
      g.position.y += this.vy * dt;
      g.rotation.y += dt * 1.5;
      if (g.position.y <= 0.48) {
        g.position.y = 0.48;
        this.landed = true;
        this.fadeT = 9;
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
        // 补给内容：全弹药 + 医疗×2 + $600
        for (const s of ['primary', 'secondary']) {
          for (const inst of p.rack[s]) {
            inst.reserve = Math.floor(inst.def.reserve * p.reserveMult);
            inst.mag = inst.magSize;
          }
        }
        p.medkits = Math.min(GAMECONFIG.inventory.medkitMax, p.medkits + 2);
        p.addMoney(600);
        HUD.banner('📦 空投补给到手', '全弹药补满 · 医疗包×2 · $600');
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

/* ---------- 攻击无人机（v16.4）：伴飞25秒，索敌18m双联机枪点射 ---------- */
class SupportDrone {
  constructor(game) {
    const p = game.player;
    this.life = 25; this.fireT = 0.8; this.phase = rand(0, TAU); this.dead = false;
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
    HUD.toast('🛸 攻击无人机已升空——伴飞25秒自动索敌');
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

    // 索敌：18m内最近感染体
    this.fireT -= dt;
    let best = null, bd = 18;
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      const d = dist2d(z.pos.x, z.pos.z, g.position.x, g.position.z);
      if (d < bd) { bd = d; best = z; }
    }
    if (best && this.life > 0 && this.fireT <= 0) {
      this.fireT = 0.5;
      // 枪口 → 目标胸口 曳光
      const mz = { x: g.position.x, y: g.position.y - 0.06, z: g.position.z };
      const ty = best.pos.y + 1.1 * best.group.scale.x;
      const end = { x: best.pos.x, y: ty, z: best.pos.z };
      if (typeof TRACERS !== 'undefined') TRACERS.fire(mz, end);
      PARTICLES.spawn('spark', mz.x, mz.y, mz.z, 1,
        { speed: 1.2, vy: 0.5, life: 0.1, color: [1, 0.85, 0.4], color2: [0.9, 0.5, 0.1] });
      AUDIO.shot(300, 0.04, 0.25, bd);
      const isHead = Math.random() < 0.25;   // 25%概率打中头部
      best.takeDamage(isHead ? 40 : 22, isHead, { x: best.pos.x, y: ty, z: best.pos.z }, game, null);
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

/* ---------- 哨戒机枪（v16.4）：120°扇形索敌16m，150发弹链打完报废 ---------- */
class SentryGun {
  constructor(game) {
    const p = game.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    this.baseYaw = Math.atan2(fx, fz);
    this.yaw = this.baseYaw;
    this.ammo = 150; this.fireT = 0.6; this.life = 60; this.dead = false; this.downed = false;
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
    this.group = g;
    ENGINE.scene.add(g);
    HUD.toast('🔫 哨戒机枪已部署——150发弹链，扇形自动索敌');
    AUDIO.purchase();
  }

  update(dt, game) {
    if (this.downed) {
      this.life -= dt;
      this.led.material.color.setHex(0xff3020);
      if (this.life < 59) { this.dead = true; }
      return;
    }
    this.life -= dt;
    // 索敌：120°扇形（±60°）内最近目标
    let best = null, bd = 16;
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      const d = dist2d(z.pos.x, z.pos.z, this.x, this.z);
      if (d > bd || d < 0.5) continue;
      const ang = Math.atan2(z.pos.x - this.x, z.pos.z - this.z);
      const diff = Math.abs(((ang - this.baseYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < Math.PI / 3) { bd = d; best = z; }
    }
    // 枪头转向
    const want = best ? Math.atan2(best.pos.x - this.x, best.pos.z - this.z) : this.baseYaw;
    this.yaw = angleLerp(this.yaw, want, Math.min(1, 7 * dt));
    this.head.rotation.y = this.yaw - this.baseYaw;
    // 开火
    this.fireT -= dt;
    if (best && this.ammo > 0 && this.fireT <= 0) {
      this.fireT = 0.12;
      this.ammo--;
      const mz = { x: this.x, y: 1.15, z: this.z };
      const ty = best.pos.y + 1.0 * best.group.scale.x;
      const end = { x: best.pos.x, y: ty, z: best.pos.z };
      if (typeof TRACERS !== 'undefined') TRACERS.fire(mz, end);
      AUDIO.shot(190, 0.045, 0.3, bd);
      const isHead = Math.random() < 0.18;
      best.takeDamage(isHead ? 32 : 18, isHead, { x: best.pos.x, y: ty, z: best.pos.z }, game, null);
      if (this.ammo <= 0) {
        this.downed = true;
        HUD.toast('🔫 哨戒机枪弹链打空——已停机');
      }
    }
    if (this.life <= 0) this.dead = true;
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}
