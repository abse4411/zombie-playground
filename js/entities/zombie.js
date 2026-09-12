/* ============================================================
 * 丧尸实体 —— 程序化美漫模型 + 9 种行为 AI
 * ============================================================ */
let _shadowMat = null;
let _shadowGeo = null;   // 全体丧尸共享的接地阴影几何体
let ZOMBIE_SEQ = 0;
const ZOMBIE_POOL = {};  // 模型对象池：typeId(+dummy) -> [group,...]

function buildZombieModel(cfg, outlines) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const skin = ART.toon(cfg.skin);
  const cloth = ART.toon(cfg.cloth);
  const pants = ART.toon(cfg.pants);
  const bloodMat = ART.mat(0x5a1010);
  const headS = cfg.headBig ? 1.4 : 1;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.3), cloth);
  torso.position.y = 1.15; g.add(torso);

  // 破布条与血污
  for (let i = 0; i < 3; i++) {
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(rand(0.08, 0.16), rand(0.12, 0.26), 0.02),
      i % 2 ? bloodMat : pants
    );
    patch.position.set(rand(-0.2, 0.2), rand(0.9, 1.4), 0.155);
    patch.rotation.z = rand(-0.4, 0.4);
    g.add(patch);
  }

  if (cfg.armorPlate) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.4), ART.mat(0x2e3638));
    plate.position.y = 1.22; g.add(plate);
    // 战术背心挂载包
    for (const side of [-1, 1]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), ART.mat(0x232a24));
      pouch.position.set(side * 0.18, 1.12, 0.21); g.add(pouch);
    }
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34 * headS, 0.34 * headS, 0.34 * headS), skin);
  head.position.y = 1.68 * headS + (cfg.headBig ? 0.02 : 0);
  g.add(head);

  // 下颚（张口咬人感）
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22 * headS, 0.07 * headS, 0.1 * headS), bloodMat);
  jaw.position.set(0, head.position.y - 0.16 * headS, 0.14 * headS);
  g.add(jaw);

  const eyeC = (cfg.big || cfg.armorPlate) ? 0xff3838 : 0xffd23f;
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeC });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), eyeMat);
    eye.position.set(side * 0.08 * headS, head.position.y + 0.04, 0.17 * headS);
    g.add(eye);
  }

  // 类型专属配件
  if (cfg.armorPlate) { // 头盔 + 面罩
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * headS, 0.14, 0.4 * headS), ART.mat(0x2a3230));
    helm.position.set(0, head.position.y + 0.18 * headS, 0); g.add(helm);
  }
  if (cfg.typeId === 'jester' || cfg.zigzag) { // 小丑帽
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), ART.mat(side < 0 ? 0xc04868 : 0x48a0b8));
      horn.position.set(side * 0.12, head.position.y + 0.24, 0);
      horn.rotation.z = side * 0.5; g.add(horn);
    }
  }
  if (cfg.big) { // 暴君肩甲与巨臂
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.34), ART.mat(0x3a3028));
      pad.position.set(side * 0.42, 1.5, 0); g.add(pad);
    }
  }

  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.37, 1.44, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.15), skin);
    arm.position.y = -0.3;
    armPivot.add(arm); g.add(armPivot); arms.push(armPivot);
  }
  for (const side of [-1, 1]) {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.16, 0.78, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.78, 0.19), pants);
    leg.position.y = -0.39;
    legPivot.add(leg); g.add(legPivot); legs.push(legPivot);
  }

  // 美漫描边（躯干/头/四肢）
  if (outlines) {
    for (const m of [torso, head, jaw]) ART.outline(m, 1.14);
    for (const pv of [...arms, ...legs]) for (const c of pv.children) ART.outline(c, 1.16);
  }

  g.scale.setScalar(cfg.scale);
  if (cfg.crawl) g.rotation.x = 1.0;

  return { group: g, skin, cloth, head, arms, legs, tilt: cfg.crawl ? 1.0 : 0 };
}

/* ---------- 四足模型（地狱犬） ---------- */
function buildQuadrupedModel(cfg, outlines) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const skin = ART.toon(cfg.skin);
  const bloodMat = ART.mat(0x5a1010);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.92), skin);
  body.position.y = 0.62; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.34), skin);
  head.position.set(0, 0.78, 0.52); g.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), bloodMat);
  jaw.position.set(0, 0.7, 0.62); g.add(jaw);
  const eyeC = 0xff7020;
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeC });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), eyeMat);
    eye.position.set(side * 0.09, 0.84, 0.66);
    g.add(eye);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 5), skin);
    ear.position.set(side * 0.1, 0.97, 0.45);
    g.add(ear);
  }
  // 背部火焰纹（发光斑块）
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.14), ART.mat(0x903010, 0xb04000));
    flame.position.set(rand(-0.08, 0.08), 0.82, 0.25 - i * 0.28);
    g.add(flame);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.34), skin);
  tail.position.set(0, 0.72, -0.58); tail.rotation.x = -0.5; g.add(tail);
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.14, 0.48, sz * 0.3);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.11), skin);
    leg.position.y = -0.24;
    pivot.add(leg); g.add(pivot); legs.push(pivot);
  }
  if (outlines) { ART.outline(body, 1.14); ART.outline(head, 1.14); }
  g.scale.setScalar(cfg.scale);
  return { group: g, skin, cloth: skin, head, arms: [], legs, tilt: 0, quadruped: true };
}

class Zombie {
  constructor(typeId, x, z, mults, opts = {}) {
    const cfg = ZOMBIE_TYPES[typeId];
    this.uid = ++ZOMBIE_SEQ;
    this.type = cfg; this.typeId = typeId;
    this.dummy = !!opts.dummy;              // 教学假人：不动手、不反击
    this.net = !!opts.net;                  // 联机网络傀儡（客户端）
    this.boss = !!opts.boss;                // Boss：血条 + 超大
    this.affix = opts.affix || null;        // 精英词缀
    const affix = this.affix;
    this.maxHp = Math.round(cfg.hp * mults.hp * (affix ? affix.hp : 1) * (this.boss ? GAMECONFIG.boss.hpMult : 1));
    this.hp = this.maxHp;
    this.speed = cfg.speed * mults.speed * rand(0.9, 1.12) * (affix ? affix.speed : 1);
    this.damage = cfg.damage * mults.dmg * (affix ? affix.dmg : 1);
    this.reward = Math.round(cfg.reward * mults.reward
      * (GAMECONFIG.economy.rewardGlobalMult || 1)
      * (affix ? GAMECONFIG.elites.rewardMult : 1)
      * (this.boss ? GAMECONFIG.boss.rewardMult : 1));
    if (affix && affix.explode) this.type = Object.assign({}, cfg, { explode: affix.explode, attackRange: cfg.attackRange });

    this.state = 'rise'; this.riseT = 0.9;
    this.dead = false; this.deadT = 0; this.remove = false;
    this.stagger = 0; this.attackCd = rand(0.3, 0.9); this.windup = -1;
    this.walkPhase = rand(0, TAU);
    this.screamT = cfg.scream ? rand(3.5, 6.5) : 0;
    this.spitT = cfg.ranged ? rand(1.5, 3.2) : 0;
    this.lungeT = rand(1, 2.5); this.lungeActive = 0;
    this.zigPhase = rand(0, TAU); this.dashT = rand(2, 4);
    this.buffT = 0; this.flashT = 0;
    this.kvx = 0; this.kvz = 0;             // 击退冲量
    this.growlPitch = rand(0.85, 1.25);

    if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });
    if (!_shadowGeo) _shadowGeo = new THREE.CircleGeometry(0.5, 14);

    // ---- 模型对象池：优先回收复用，避免反复构建/销毁 ----
    const poolKey = typeId + (this.dummy ? ':d' : '');
    const pooled = (ZOMBIE_POOL[poolKey] || []).pop();
    if (pooled) {
      this.model = pooled.userData.model;
      this.group = pooled;
      // 复位外观状态
      this.group.visible = true;
      this.group.rotation.set(cfg.crawl ? 1.0 : 0, 0, 0);
      this.group.scale.setScalar(cfg.scale);
      this.model.skin.emissive.setHex(0x000000);
      this.model.cloth.emissive.setHex(0x000000);
      const wantOutline = ENGINE.quality.outlines && !this.dummy;
      this.group.traverse(o => { if (o.userData.isOutline) o.visible = wantOutline; });
    } else {
      const model = cfg.quadruped ? buildQuadrupedModel(cfg, ENGINE.quality.outlines && !this.dummy) : buildZombieModel(cfg, ENGINE.quality.outlines && !this.dummy);
      this.model = model;
      this.group = model.group;
      this.group.userData.model = model;   // 供对象池复用
    }
    this.group.position.set(x, -2.05 * cfg.scale, z);
    this.pos = this.group.position;
    ENGINE.scene.add(this.group);

    // 精英词缀辉光 / Boss 巨型化
    this.auraColor = 0x000000;
    if (affix) {
      this.auraColor = affix.color;
      this.model.skin.emissive.setHex(affix.color);
      this.group.scale.multiplyScalar(GAMECONFIG.elites.scaleMult);
    }
    if (this.boss) this.group.scale.multiplyScalar(GAMECONFIG.boss.scale / cfg.scale);

    // 幽影：半透明材质（接近时显形）
    this.cloakMats = null;
    if (cfg.cloak) {
      this.cloakMats = [this.model.skin];
      if (this.model.cloth !== this.model.skin) this.cloakMats.push(this.model.cloth);
      for (const m of this.cloakMats) { m.transparent = true; m.opacity = 0.28; }
    }

    this.shadow = new THREE.Mesh(_shadowGeo, _shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(x, 0.03, z);
    ENGINE.scene.add(this.shadow);
  }

  addKnockback(ix, iz) {
    this.kvx += ix; this.kvz += iz;
  }

  update(dt, game) {
    const cfg = this.type;
    const p = game.player;

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.model.skin.emissive.setHex(this.auraColor); this.model.cloth.emissive.setHex(this.auraColor); }
    }
    this.shadow.position.set(this.pos.x, 0.03, this.pos.z);
    this.shadow.scale.setScalar(this.group.scale.x);

    // ---- 破土而出 ----
    if (this.state === 'rise') {
      this.riseT -= dt;
      const k = clamp(1 - this.riseT / 0.9, 0, 1);
      this.pos.y = -2.05 * cfg.scale * (1 - k * k);
      if (this.riseT <= 0) { this.state = 'chase'; this.pos.y = 0; }
      return;
    }

    // ---- 死亡演出 ----
    if (this.dead) {
      this.deadT += dt;
      this.group.rotation.x = this.model.tilt - Math.min(1, this.deadT / 0.45) * 1.35;
      if (this.deadT > 1.0) this.pos.y -= dt * 0.7;
      if (this.deadT > 2.1) { this.remove = true; this.shadow.visible = false; }
      return;
    }

    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;

    // ---- 网络傀儡（联机客户端）：仅插值到房主快照，不跑AI ----
    if (this.net) {
      if (this.netTarget) {
        const mx = this.netTarget.x - this.pos.x, mz = this.netTarget.z - this.pos.z;
        const md = Math.hypot(mx, mz);
        if (md > 0.01) {
          const step = Math.min(md, md * 9 * dt);
          this.pos.x += mx / md * step;
          this.pos.z += mz / md * step;
          this.walkPhase += step * 2.4;
        }
        this.group.rotation.y = angleLerp(this.group.rotation.y, this.netTarget.yaw || 0, Math.min(1, 10 * dt));
      }
      this._animate();
      return;
    }

    // 远距离LOD：仅朝向与位移，跳过骨骼动画细节
    const lodSkip = dist > ENGINE.quality.lod;

    // 朝向玩家
    const targetYaw = Math.atan2(nx, nz);
    this.group.rotation.y = angleLerp(this.group.rotation.y, targetYaw, Math.min(1, 7 * dt));

    // ---- 行为决策 ----
    let mvx = nx, mvz = nz;
    let spd = this.speed * (this.buffT > 0 ? 1.45 : 1);
    if (this.buffT > 0) this.buffT -= dt;

    if (this.dummy) {
      // 教学假人：站桩挨打
      this.walkPhase += dt * 1.2;
      this._animate();
      return;
    }

    // 吐酸者：保持距离、环绕、吐酸
    if (cfg.ranged) {
      const R = cfg.ranged;
      if (dist < R.keepMin) { mvx = -nx; mvz = -nz; }
      else if (dist < R.keepMax) {
        mvx = -nz * 0.8 + nx * 0.15; mvz = nx * 0.8 + nz * 0.15;
      }
      this.spitT -= dt;
      if (this.spitT <= 0 && dist < 24 && dist > 2.5) {
        this.spitT = R.cooldown * rand(0.85, 1.2);
        spawnAcid(game, this, R);
      }
    }

    // 小丑：之字形 + 间歇狂奔
    if (cfg.zigzag) {
      this.zigPhase += dt * 3.4;
      const side = Math.sin(this.zigPhase) * 0.95;
      mvx = nx + (-nz) * side; mvz = nz + nx * side;
      const l = Math.hypot(mvx, mvz) || 1; mvx /= l; mvz /= l;
      this.dashT -= dt;
      if (this.dashT <= 0) { this.dashT = rand(3, 5.5); this.lungeActive = 0.7; }
      if (this.lungeActive > 0) { this.lungeActive -= dt; spd *= 1.85; }
    }

    // 潜行者：匍匐 + 猛扑
    if (cfg.lunge) {
      this.lungeT -= dt;
      if (this.lungeT <= 0 && dist < cfg.lungeRange && this.lungeActive <= 0) {
        this.lungeActive = 0.45; this.lungeT = rand(2.6, 3.8);
      }
      if (this.lungeActive > 0) { this.lungeActive -= dt; spd = cfg.lungeSpeed * (this.buffT > 0 ? 1.3 : 1); }
    }

    // 尖啸者：周期性召唤
    if (cfg.scream) {
      this.screamT -= dt;
      if (this.screamT <= 0) {
        this.screamT = cfg.scream.cooldown * rand(0.9, 1.15);
        this._scream(game, dist);
      }
    }

    // 幽影：耳语声预警 + 距离显形
    if (cfg.cloak && this.cloakMats) {
      const target = dist < 10 ? lerp(0.85, 0.28, clamp((dist - 2) / 8, 0, 1)) : 0.28;
      for (const m of this.cloakMats) if (m.opacity !== target) m.opacity = target;
      this.whisperT = (this.whisperT || 3) - dt;
      if (this.whisperT <= 0) { this.whisperT = rand(3.5, 6.5); AUDIO.whisper(dist); }
    }

    // 硬直
    if (this.stagger > 0) { this.stagger -= dt; mvx = 0; mvz = 0; spd = 0; }

    // ---- 移动（含击退冲量衰减） ----
    this.pos.x += mvx * spd * dt + this.kvx * dt;
    this.pos.z += mvz * spd * dt + this.kvz * dt;
    const kd = Math.exp(-7 * dt);
    this.kvx *= kd; this.kvz *= kd;
    if (spd > 0 || Math.abs(this.kvx) > 0.01 || Math.abs(this.kvz) > 0.01) {
      resolveCircleAABBs(this.pos, 0.42 * cfg.scale, 1.8 * cfg.scale, 0);
      const S = ENGINE.mapDef.size;
      this.pos.x = clamp(this.pos.x, -S + 1, S - 1);
      this.pos.z = clamp(this.pos.z, -S + 1, S - 1);
      this.walkPhase += spd * dt * 2.4;
    }

    // ---- 攻击 ----
    this.attackCd -= dt;
    if (this.windup >= 0) {
      this.windup -= dt;
      if (this.windup < 0 && p.alive && dist < cfg.attackRange + 0.55) {
        p.takeDamage(this.damage, game, this.pos);
        if (cfg.knockback) {
          p.vel.x += nx * cfg.knockback; p.vel.z += nz * cfg.knockback; p.vel.y += 3.2;
        }
      }
    } else if (cfg.damage > 0 && dist < cfg.attackRange && this.attackCd <= 0 && this.stagger <= 0) {
      this.windup = GAMECONFIG.combat.attackWindup;
      this.attackCd = cfg.attackRate;
    }

    // 膨胀者近身自爆
    if (cfg.explode && p.alive && dist < cfg.attackRange - 0.2) {
      this.takeDamage(999999, false, null, game);
      return;
    }

    if (!lodSkip) this._animate();
  }

  _animate() {
    const m = this.model, cfg = this.type;
    const sw = Math.sin(this.walkPhase);
    // 四足（地狱犬）：对角步态
    if (m.quadruped) {
      m.legs[0].rotation.x = sw * 0.7;
      m.legs[3].rotation.x = sw * 0.7;
      m.legs[1].rotation.x = -sw * 0.7;
      m.legs[2].rotation.x = -sw * 0.7;
      m.head.rotation.x = Math.sin(ENGINE.time * 2.2 + this.walkPhase) * 0.06;
      const atQ = this.windup >= 0 ? 1 - this.windup / GAMECONFIG.combat.attackWindup : -1;
      if (atQ >= 0) m.head.position.z = 0.52 + atQ * 0.2;
      else m.head.position.z = 0.52;
      return;
    }
    m.legs[0].rotation.x = sw * 0.55;
    m.legs[1].rotation.x = -sw * 0.55;
    const base = cfg.crawl ? -0.5 : -1.15;
    const attackT = this.windup >= 0 ? 1 - this.windup / GAMECONFIG.combat.attackWindup : -1;
    if (m.arms.length) {
      m.arms[0].rotation.x = base + sw * 0.22;
      m.arms[1].rotation.x = base - sw * 0.22;
      if (attackT >= 0) {
        m.arms[0].rotation.x = base - 0.4 + attackT * 0.9;
        m.arms[1].rotation.x = base - 0.4 + attackT * 0.9;
      }
    }
    m.head.rotation.z = Math.sin(ENGINE.time * 1.7 + this.walkPhase) * 0.09;
  }

  get displayName() {
    if (this.boss) return '暴君 Ω';
    return (this.affix ? this.affix.name + '·' : '') + this.type.name;
  }

  _flash() {
    this.model.skin.emissive.setHex(0x7a1010);
    this.model.cloth.emissive.setHex(0x571010);
  }

  _scream(game, dist) {
    AUDIO.scream(dist);
    const S = this.type.scream;
    PARTICLES.spawn('smoke', this.pos.x, 1.9 * this.group.scale.x, this.pos.z, 14,
      { speed: 3, vy: 2.5, life: 0.7, color: [0.8, 0.75, 0.85], color2: [0.5, 0.4, 0.55] });
    const n = randi(S.summon[0], S.summon[1]);
    for (let i = 0; i < n; i++) game.spawner.spawnExtra(choice(['walker', 'runner']));
    for (const z of game.zombies) {
      if (z.dead || z.state === 'rise') continue;
      if (dist2d(z.pos.x, z.pos.z, this.pos.x, this.pos.z) < S.buffRadius) z.buffT = S.buffDuration;
    }
    HUD.killfeed('⚠ 尖啸者召唤了增援！', 'big');
  }

  takeDamage(amount, isHead, hitPoint, game, kb) {
    if (this.dead) return;
    const cfg = this.type;
    // 装甲暴兵：正面减伤
    if (cfg.frontArmor && !isHead && game) {
      const p = game.player;
      const tx = p.pos.x - this.pos.x, tz = p.pos.z - this.pos.z;
      const tl = Math.hypot(tx, tz) || 1;
      const fx = Math.sin(this.group.rotation.y), fz = Math.cos(this.group.rotation.y);
      if ((fx * tx + fz * tz) / tl > 0.35) amount *= (1 - cfg.frontArmor);
    }
    if (isHead && !cfg.immuneStagger) this.stagger = Math.max(this.stagger, GAMECONFIG.combat.staggerTime);
    this.hp -= amount;
    this.flashT = 0.07;
    this._flash();
    if (kb) this.addKnockback(kb.x, kb.z);
    if (hitPoint) PARTICLES.blood(hitPoint.x, hitPoint.y, hitPoint.z, isHead ? 10 : 6, isHead);
    if (this.hp <= 0) this.die(game, isHead);
  }

  die(game, headshot) {
    this.dead = true; this.deadT = 0;
    if (this.dummy) {
      // 假人：短促倒地，快速移除，不计赏金
      AUDIO.zombieDie(0, this.growlPitch);
      PARTICLES.blood(this.pos.x, 1.1 * this.group.scale.x, this.pos.z, 10);
      this.deadT = 1.4;
      if (game.mode && game.mode.onDummyKilled) {
        game.mode.onDummyKilled(this, headshot, game.player ? game.player.current : 'secondary', game._fragWindowT > 0);
      }
      return;
    }
    const d = game.player ? dist2d(this.pos.x, this.pos.z, game.player.pos.x, game.player.pos.z) : 0;
    AUDIO.zombieDie(d, this.growlPitch);
    PARTICLES.blood(this.pos.x, 1.1 * this.group.scale.x, this.pos.z, 14);
    if (this.type.explode) explodeBloater(game, this);
    game.onZombieKilled(this, headshot);
  }

  dispose() {
    ENGINE.scene.remove(this.group);
    ENGINE.scene.remove(this.shadow);
    // 回收到对象池（上限10个/类，超出才真正销毁GPU资源）
    const poolKey = this.typeId + (this.dummy ? ':d' : '');
    const pool = ZOMBIE_POOL[poolKey] || (ZOMBIE_POOL[poolKey] = []);
    if (pool.length < 10) {
      this.group.rotation.set(this.type.crawl ? 1.0 : 0, 0, 0);
      this.group.scale.setScalar(this.type.scale);
      this.model.skin.emissive.setHex(0x000000);
      this.model.cloth.emissive.setHex(0x000000);
      this.group.visible = true;
      pool.push(this.group);
    } else {
      this.group.traverse(o => {
        if (o.geometry && o.geometry !== _shadowGeo) o.geometry.dispose();
      });
    }
    // 阴影几何体为共享资源，仅移除网格
  }
}
