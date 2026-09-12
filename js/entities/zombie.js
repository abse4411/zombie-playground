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

  const headBits = [head, jaw];   // 头部集群：爆头解体时一起崩飞
  const eyeC = (cfg.big || cfg.armorPlate) ? 0xff3838 : 0xffd23f;
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeC });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), eyeMat);
    eye.position.set(side * 0.08 * headS, head.position.y + 0.04, 0.17 * headS);
    g.add(eye);
    headBits.push(eye);
  }

  // 类型专属配件
  if (cfg.armorPlate) { // 头盔 + 面罩
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * headS, 0.14, 0.4 * headS), ART.mat(0x2a3230));
    helm.position.set(0, head.position.y + 0.18 * headS, 0); g.add(helm);
    headBits.push(helm);
  }
  if (cfg.typeId === 'jester' || cfg.zigzag) { // 小丑帽
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), ART.mat(side < 0 ? 0xc04868 : 0x48a0b8));
      horn.position.set(side * 0.12, head.position.y + 0.24, 0);
      horn.rotation.z = side * 0.5; g.add(horn);
      headBits.push(horn);
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

  return { group: g, skin, cloth, head, arms, legs, headBits, tilt: cfg.crawl ? 1.0 : 0 };
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
  return { group: g, skin, cloth: skin, head, arms: [], legs, headBits: [head, jaw], tilt: 0, quadruped: true };
}

class Zombie {
  constructor(typeId, x, z, mults, opts = {}) {
    const cfg = ZOMBIE_TYPES[typeId];
    this.uid = ++ZOMBIE_SEQ;
    this.type = cfg; this.typeId = typeId;
    this.dummy = !!opts.dummy;              // 教学假人：不动手、不反击
    this.net = !!opts.net;                  // 联机网络傀儡（客户端）
    this.boss = !!opts.boss;                // Boss：血条 + 超大
    this.bossCfg = (this.boss && opts.bossId && GAMECONFIG.bosses) ? GAMECONFIG.bosses[opts.bossId] : null;
    // 变异列表（v7.0）：支持叠加，最多4种（兼容旧单数 opts.affix）
    this.affixes = (opts.affixList && opts.affixList.length) ? opts.affixList.slice(0, 4) : (opts.affix ? [opts.affix] : []);
    this.affix = this.affixes[0] || null;
    const affix = this.affix;
    const AG = GAMECONFIG.zombieAggro || { rateMult: 1, rangeBonus: 0, speedMult: 1 };
    // 攻击欲望强化（v7.0）：攻击更频繁、距离更远；实例类型统一克隆以便实例化修改
    this.type = Object.assign({}, cfg);
    this.type.attackRange = cfg.attackRange + AG.rangeBonus;
    this.type.attackRate = cfg.attackRate * AG.rateMult;
    // 变异叠加乘算
    let affHp = 1, affSpd = 1, affDmg = 1, affScale = 1;
    for (const a of this.affixes) {
      affHp *= a.hp || 1; affSpd *= a.speed || 1; affDmg *= a.dmg || 1;
      if (a.scale) affScale *= a.scale;
    }
    this.affixKb = this.affixes.reduce((m, a) => Math.max(m, a.kb || 0), 0);
    this.affixHeal = Math.min(0.16, this.affixes.reduce((s2, a) => s2 + (a.heal || 0), 0));
    this.maxHp = Math.round(cfg.hp * mults.hp * affHp * (this.boss ? GAMECONFIG.boss.hpMult : 1));
    this.hp = this.maxHp;
    this.speed = cfg.speed * mults.speed * rand(0.9, 1.12) * affSpd * AG.speedMult;
    this.damage = cfg.damage * mults.dmg * affDmg;
    this.reward = Math.round(cfg.reward * mults.reward
      * (GAMECONFIG.economy.rewardGlobalMult || 1)
      * Math.pow(GAMECONFIG.elites.rewardMult, Math.min(3, this.affixes.length))
      * (this.boss ? GAMECONFIG.boss.rewardMult : 1));
    // 幕末专属Boss（v6.9）：独立数值（暴君Ω/灯塔巨像/方舟刽子手）
    if (this.bossCfg) {
      const B = this.bossCfg;
      this.maxHp = Math.round(B.hp * mults.hp);
      this.hp = this.maxHp;
      this.speed = B.speed * mults.speed;
      this.damage = B.dmg * mults.dmg;
      this.reward = Math.round(B.reward * (GAMECONFIG.economy.rewardGlobalMult || 1));
    }
    // 变异特性合并进实例类型（v6.9→v7.0 多变异）：易爆/长爪/铁甲
    const _ex = this.affixes.find(a => a.explode), _rc = this.affixes.find(a => a.reach), _fa = this.affixes.find(a => a.frontArmor);
    if (_ex) this.type.explode = _ex.explode;
    if (_rc) this.type.attackRange = this.type.attackRange * _rc.reach;
    if (_fa) this.type.frontArmor = _fa.frontArmor;

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
    // 追击AI（v4.2）：视线记忆 + 沿墙方向 + 卡住脱困
    this.steer = { side: Math.random() < 0.5 ? 1 : -1, wallT: 0, stuckT: 0, lastX: x, lastZ: z, hasLOS: false };

    if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });
    if (!_shadowGeo) _shadowGeo = new THREE.CircleGeometry(0.5, 14);

    // ---- 模型对象池：优先回收复用，避免反复构建/销毁 ----
    const poolKey = typeId + (this.dummy ? ':d' : '');
    const pooled = (ZOMBIE_POOL[poolKey] || []).pop();
    if (pooled) {
      this.model = pooled.userData.model;
      this.group = pooled;
      // 复位外观状态（含肢解断肢的恢复）
      this.group.visible = true;
      this.group.rotation.set(cfg.crawl ? 1.0 : 0, 0, 0);
      this.group.scale.setScalar(cfg.scale);
      this.model.skin.emissive.setHex(0x000000);
      this.model.cloth.emissive.setHex(0x000000);
      this._ga1 = this._ga2 = this._gl1 = this._gq1 = false;
      const wantOutline = ENGINE.quality.outlines && !this.dummy;
      this.group.traverse(o => { if (o.userData.isOutline) o.visible = wantOutline; else o.visible = true; });
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
      if (affScale > 1) this.group.scale.multiplyScalar(affScale);
      // 变异登场播报（限频防尸潮刷屏）
      if (!this.net && !this.dummy && ENGINE.time - (Zombie._lastMutAnn || -99) > 6) {
        Zombie._lastMutAnn = ENGINE.time;
        HUD.killfeed('⚠ 检测到变异感染体：「' + this.affixes.map(a => a.name).join('+') + '」', 'big');
        AUDIO.growl(12, 0.75);
      }
    }
    // 变异体脚下光环（v6.9 专属显示特效：颜色随变异类型）
    let ring = this.group.userData.mutRing;
    if (!ring) {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 22),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.group.add(ring);
      this.group.userData.mutRing = ring;
    }
    ring.visible = !!affix;
    if (affix) ring.material.color.setHex(affix.color);
    // 变异头顶词条（v7.0）：显示变异组合名称
    if (typeof MUTTAGS !== 'undefined') MUTTAGS.attach(this);
    if (this.boss) this.group.scale.multiplyScalar(this.bossCfg ? this.bossCfg.scale / cfg.scale : GAMECONFIG.boss.scale / cfg.scale);

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
    if (this.hpbar && typeof HPBARS !== 'undefined') HPBARS.remove(this);
      return;
    }

    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    let mvx = nx, mvz = nz;
    let spd = this.speed * (this.buffT > 0 ? 1.45 : 1);

    // ---- 追击AI（v4.2）：视线检测 → 无视线时沿墙绕行 → 卡住自动换向 ----
    {
      const st = this.steer;
      // 1) 视线：胸口射线(眼睛) + 膝盖射线(可通行性) —— 双射线防"看得见走不过去"
      const eyeY = this.pos.y + 0.9 * this.group.scale.x;
      const targetY = p.pos.y + 1.0;
      const losDx = nx, losDy = (targetY - eyeY) / dist, losDz = nz;
      const eyeT = rayAABBs(this.pos.x, eyeY, this.pos.z, losDx, losDy, losDz, dist);
      const kneeY = this.pos.y + 0.25;
      const kneeT = rayAABBs(this.pos.x, kneeY, this.pos.z, nx, (p.pos.y - this.pos.y) / dist, nz, dist);
      st.hasLOS = eyeT >= dist - 0.5 && kneeT >= dist - 0.5;
      if (st.hasLOS) { st.lastX = p.pos.x; st.lastZ = p.pos.z; st.wallT = 0; }

      // 2) 始终朝玩家方位追（尸潮气味感知），无通行视线时叠加沿墙滑行分量
      let tx = nx, tz = nz;
      if (!st.hasLOS) {
        st.wallT += dt;
        // 侧向滑行：方向稳定避免抖动
        tx += -nz * st.side * 0.9;
        tz += nx * st.side * 0.9;
        const tl2 = Math.hypot(tx, tz) || 1; tx /= tl2; tz /= tl2;
        // 3) 卡住检测：1.2秒位移不足 → 反转沿墙方向
        st.stuckT += dt;
        if (st.stuckT > 1.2) {
          const moved = Math.hypot(this.pos.x - st.lastX, this.pos.z - st.lastZ);
          if (moved < 0.35) st.side *= -1;
          st.stuckT = 0; st.lastX = this.pos.x; st.lastZ = this.pos.z;
        }
      } else {
        st.stuckT = 0;
        st.lastX = this.pos.x; st.lastZ = this.pos.z;
      }
      mvx = tx; mvz = tz;
    }

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
    if (this.buffT > 0) this.buffT -= dt;

    if (this.dummy) {
      // 教学假人：站桩挨打
      this.walkPhase += dt * 1.2;
      this._animate();
      return;
    }

    // 冲锋者：锁定直线狂冲（可被闪避）
    if (cfg.charge) {
      this.chargeCd = (this.chargeCd === undefined ? rand(1, 2.5) : this.chargeCd) - dt;
      if (this.chargeActive > 0) {
        this.chargeActive -= dt;
        spd = 9.5;
        mvx = this.chargeDx; mvz = this.chargeDz;
        if (dist < cfg.attackRange && this.attackCd <= 0) {
          if (p.alive) { p.takeDamage(this.damage * 1.5, game, this.pos); p.vel.x += this.chargeDx * 7; p.vel.z += this.chargeDz * 7; p.vel.y += 3; }
          this.chargeActive = 0;
          this.attackCd = cfg.attackRate;
        }
      } else if (this.chargeCd <= 0 && dist < 14 && dist > 3.5) {
        this.chargeDx = nx; this.chargeDz = nz;
        this.chargeActive = 1.1;
        this.chargeCd = rand(3.5, 5);
        AUDIO.growl(dist, 0.7);
      }
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

    // ---- Boss 机制（v6.9：幕末专属Boss攻击组 + 狩猎通用Boss） ----
    if (this.boss) {
      const M = GAMECONFIG.bossMech;
      const A = this.bossCfg ? this.bossCfg.attacks : M;
      const phase2 = this.hp < this.maxHp * M.phase2At;
      if (phase2 && !this.phase2Done) {
        this.phase2Done = true;
        this.speed *= M.rageSpeed;
        HUD.banner('⚠ ' + this.displayName + ' 狂暴', '它撕下了伪装');
        AUDIO.hordeHorn();
        ENGINE.shake(0.3);
      }
      // 召唤增援
      if (A.summonEvery) {
        this.summonT = (this.summonT === undefined ? A.summonEvery : this.summonT) - dt;
        if (this.summonT <= 0) {
          this.summonT = A.summonEvery * (phase2 ? 0.75 : 1);
          const n = (A.summonN || M.summonN) + (phase2 ? 1 : 0);
          for (let i = 0; i < n; i++) game.spawner.spawnOne('runner');
          HUD.killfeed('⚠ ' + this.displayName + ' 召唤了增援！', 'big');
        }
      }
      // 跺地 AOE
      if (A.slamEvery) {
        const sRad = A.slamRadius || M.slamRadius;
        this.slamT = (this.slamT === undefined ? A.slamEvery : this.slamT) - dt;
        if (this.slamT <= 0 && dist < sRad + 2.5) {
          this.slamT = A.slamEvery;
          ENGINE.shake(0.45);
          PARTICLES.dust(this.pos.x, 0.3, this.pos.z, 16);
          AUDIO.impact();
          if (p.alive && dist < sRad) p.takeDamage(A.slamDmg || M.slamDmg, game, this.pos);
          HUD.toast('💥 跺地冲击！快离开 Boss 脚下');
        }
      }
      // 冲锋（暴君Ω）：锁定直线狂冲+撞飞
      if (A.chargeEvery) {
        this.bChargeCd = (this.bChargeCd === undefined ? rand(2.5, 4) : this.bChargeCd) - dt;
        if (this.bCharge > 0) {
          this.bCharge -= dt;
          spd = 10; mvx = this.bChargeDx; mvz = this.bChargeDz;
          if (dist < cfg.attackRange + 0.8 && this.attackCd <= 0) {
            if (p.alive) { p.takeDamage(this.damage * 1.5, game, this.pos); p.vel.x += this.bChargeDx * 9; p.vel.z += this.bChargeDz * 9; p.vel.y += 4; }
            this.bCharge = 0; this.attackCd = cfg.attackRate;
          }
        } else if (this.bChargeCd <= 0 && dist < 16 && dist > 4) {
          this.bChargeDx = nx; this.bChargeDz = nz;
          this.bCharge = 1.0;
          this.bChargeCd = A.chargeEvery;
          AUDIO.growl(dist, 0.6);
          HUD.toast('⚠ 暴君冲锋——侧向闪避！');
        }
      }
      // 酸弹幕（灯塔巨像）：扇形三连吐
      if (A.barrageEvery) {
        this.barrT = (this.barrT === undefined ? rand(3, 5) : this.barrT) - dt;
        if (this.barrT <= 0 && dist > 3.5 && dist < 32) {
          this.barrT = A.barrageEvery * (phase2 ? 0.7 : 1);
          const n2 = A.barrageN || 3;
          const R = { speed: 11, dmg: 14, poolDps: 8, poolRadius: 1.9, poolTime: 3 };
          for (let i = 0; i < n2; i++) {
            const sp = (i - (n2 - 1) / 2) * 0.2;
            const dxc = nx * Math.cos(sp) - nz * Math.sin(sp);
            const dzc = nx * Math.sin(sp) + nz * Math.cos(sp);
            const oy = 1.55 * this.group.scale.x;
            const t2 = clamp(dist / R.speed, 0.25, 2.2);
            const vy2 = (1.2 - oy + 0.5 * 9 * t2 * t2) / t2;
            game.projectiles.push(new Projectile('acid', this.pos.x + dxc * 0.6, oy, this.pos.z + dzc * 0.6,
              dxc * R.speed, vy2, dzc * R.speed, { fuse: 4, R }));
          }
          AUDIO.acidSpit(dist);
          HUD.toast('⚠ 巨像酸液弹幕——横向走位躲避！');
        }
      }
      // 震地波（灯塔巨像）：周期性全场冲击波掀翻玩家
      if (A.quakeEvery) {
        this.quakeT = (this.quakeT === undefined ? A.quakeEvery : this.quakeT) - dt;
        if (this.quakeT <= 0 && dist < 16) {
          this.quakeT = A.quakeEvery;
          ENGINE.shake(0.6);
          AUDIO.impact();
          PARTICLES.dust(this.pos.x, 0.3, this.pos.z, 24);
          if (p.alive && this.pos.y - p.pos.y < 2) {
            p.vel.x += nx * 8.5; p.vel.z += nz * 8.5; p.vel.y += 3.5;
            p.takeDamage(12, game, this.pos);
            HUD.toast('🌀 震地冲击波——被掀翻了！');
          }
        }
      }
      // 猛扑（方舟刽子手）：短促高速扑杀
      if (A.lungeEvery) {
        this.bLungeCd = (this.bLungeCd === undefined ? rand(2, 3.5) : this.bLungeCd) - dt;
        if (this.bLunge > 0) {
          this.bLunge -= dt;
          spd = A.lungeSpeed; mvx = this.lungeDx; mvz = this.lungeDz;
          if (dist < cfg.attackRange + 0.6 && this.attackCd <= 0) {
            if (p.alive) { p.takeDamage(this.damage * 1.6, game, this.pos); p.vel.x += this.lungeDx * 6; p.vel.z += this.lungeDz * 6; }
            this.bLunge = 0; this.attackCd = cfg.attackRate;
          }
        } else if (this.bLungeCd <= 0 && dist < 13 && dist > 2.5) {
          this.lungeDx = nx; this.lungeDz = nz;
          this.bLunge = 0.5;
          this.bLungeCd = A.lungeEvery * (phase2 ? 0.7 : 1);
          AUDIO.growl(dist, 1.35);
        }
      }
    }

    // 尖啸者：周期性召唤
    if (cfg.scream) {
      this.screamT -= dt;
      if (this.screamT <= 0) {
        this.screamT = cfg.scream.cooldown * rand(0.9, 1.15);
        this._scream(game, dist);
      }
    }

    // 辐射变种：荧光光环粒子（二代特化视觉）
    if (cfg.aura && !lodSkip) {
      this.auraT = (this.auraT || 0) - dt;
      if (this.auraT <= 0) {
        this.auraT = 0.12;
        const a = Math.random() * TAU;
        PARTICLES.spawn('smoke', this.pos.x + Math.cos(a) * 0.4, rand(0.2, 1.2) * this.group.scale.x, this.pos.z + Math.sin(a) * 0.4, 1,
          { speed: 0.3, vy: 0.8, life: 0.7, color: [0.35, 0.9, 0.3], color2: [0.1, 0.5, 0.15] });
      }
    }
    // 变异体专属粒子（v6.9）：按变异类型颜色的雾气持续上升标识
    if (this.affix && !lodSkip) {
      this.mutPT = (this.mutPT || 0) - dt;
      if (this.mutPT <= 0) {
        this.mutPT = 0.15;
        const mc = this.affix.color;
        const a = Math.random() * TAU;
        PARTICLES.spawn('smoke', this.pos.x + Math.cos(a) * 0.44, rand(0.15, 1.5) * this.group.scale.x, this.pos.z + Math.sin(a) * 0.44, 1,
          { speed: 0.25, vy: 0.9, life: 0.65, color: [((mc >> 16) & 255) / 255, ((mc >> 8) & 255) / 255, (mc & 255) / 255], color2: [0.08, 0.08, 0.1] });
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

    // ---- 移动（含击退冲量衰减 + 立体地形踏步，v4.1） ----
    this.pos.x += mvx * spd * dt + this.kvx * dt;
    this.pos.z += mvz * spd * dt + this.kvz * dt;
    const kd = Math.exp(-7 * dt);
    this.kvx *= kd; this.kvz *= kd;
    resolveCircleAABBs(this.pos, 0.42 * cfg.scale, 1.8 * cfg.scale, this.pos.y, 0.6);
    const S = ENGINE.mapDef.size;
    this.pos.x = clamp(this.pos.x, -S + 1, S - 1);
    this.pos.z = clamp(this.pos.z, -S + 1, S - 1);
    if (spd > 0) this.walkPhase += spd * dt * 2.4;
    // 贴合支撑面高度：上台阶平滑爬升；高出支撑面则重力坠落（v6.9 高处摔伤）
    const gh = groundHeightAt(this.pos.x, this.pos.z, 0.42 * cfg.scale, this.pos.y, 0.6);
    if (this.pos.y > gh + 0.06) {
      // 腾空坠落
      this._vy = (this._vy || 0) - 22 * dt;
      this.pos.y += this._vy * dt;
      if (this.pos.y <= gh) {
        const fall = -this._vy;
        this.pos.y = gh; this._vy = 0;
        if (fall > 10) {
          // 高处坠落摔伤：随下落速度放大（上限50%最大生命）+ 着地硬直
          this.stagger = Math.max(this.stagger, 0.8);
          PARTICLES.dust(this.pos.x, 0.2, this.pos.z, 10);
          AUDIO.impact();
          this.takeDamage(this.maxHp * Math.min(0.5, (fall - 10) * 0.035), false, null, game);
        }
      }
    } else if (this.pos.y < gh - 0.01) {
      this._vy = 0;
      this.pos.y = Math.min(gh, this.pos.y + Math.max(1.5, (gh - this.pos.y) * 8) * dt * 4);
    } else {
      this._vy = 0;
      this.pos.y = gh;
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
        // 变异特效：巨力击退 / 嗜血吸血（v7.0 叠加版）
        if (this.affixKb > 0) { p.vel.x += nx * this.affixKb; p.vel.z += nz * this.affixKb; p.vel.y += 2.6; }
        if (this.affixHeal > 0) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.affixHeal);
        // 抓挠减速（游荡者/潜行者）：咬中附带短暂减速
        if (cfg.grabSlow) p.slowT = Math.max(p.slowT, cfg.grabSlow);
        // 连击（奔跑者/小丑/地狱犬/暴君）：概率立即补一记快速二连
        if (cfg.combo && Math.random() < cfg.combo && p.alive && dist < cfg.attackRange + 0.55) {
          this.windup = GAMECONFIG.combat.attackWindup * 0.55;
        }
      }
    } else if (cfg.damage > 0 && dist < cfg.attackRange && this.attackCd <= 0 && this.stagger <= 0) {
      this.windup = GAMECONFIG.combat.attackWindup;
      this.attackCd = cfg.attackRate * (this.boss && this.phase2Done ? GAMECONFIG.bossMech.rageRate : 1);
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
    if (this.boss) return this.bossCfg ? this.bossCfg.name : '暴君 Ω';
    return (this.affixes.length ? this.affixes.map(a => a.name).join('+') + '·' : '') + this.type.name;
  }

  _flash() {
    this.model.skin.emissive.setHex(0x7a1010);
    this.model.cloth.emissive.setHex(0x571010);
  }

  /* ---------- 肢解系统（v6.8） ---------- */
  // 单块肢体崩飞：隐藏原mesh → 生成带物理的尸块 + 血浆
  _gibPiece(mesh, power) {
    if (!mesh || mesh.visible === false) return;
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    const s = this.group.scale.x;
    const prm = mesh.geometry.parameters;
    if (!prm || prm.width === undefined) return;   // 锥形配件等非盒几何跳过
    mesh.visible = false;
    if (typeof GIBS !== 'undefined') {
      GIBS.spawn(wp.x, wp.y, wp.z, prm.width * s, prm.height * s, prm.depth * s, mesh.material,
        { dx: wp.x - this.pos.x, dz: wp.z - this.pos.z }, power || 1);
    }
    PARTICLES.blood(wp.x, wp.y, wp.z, 6);
  }

  // 血量阶段断肢：60% 断一臂 / 35% 断另一臂 / 18% 断一腿（四足 40% 断前腿）
  _updateDismember() {
    const m = this.model;
    if (m.quadruped) {
      if (!this._gq1 && this.hp < this.maxHp * 0.4) { this._gq1 = true; this._gibPiece(m.legs[0].children[0]); }
      return;
    }
    if (!this._ga1 && this.hp < this.maxHp * 0.6 && m.arms.length) { this._ga1 = true; this._gibPiece(m.arms[0].children[0]); }
    if (!this._ga2 && this.hp < this.maxHp * 0.35 && m.arms.length > 1) { this._ga2 = true; this._gibPiece(m.arms[1].children[0]); }
    if (!this._gl1 && this.hp < this.maxHp * 0.18 && m.legs.length) { this._gl1 = true; this._gibPiece(m.legs[1].children[0]); }
  }

  // 击杀解体：爆头→头颅集群崩飞；过量击杀→全身碎块；普通击杀→概率崩残肢
  _gibDeath(headshot, overkill) {
    const m = this.model;
    const s = this.group.scale.x;
    if (headshot || overkill) {
      for (const b of (m.headBits || [])) this._gibPiece(b, 1.6);
    }
    if (overkill) {
      for (const piv of [...m.arms, ...m.legs]) {
        if (piv.children[0]) this._gibPiece(piv.children[0], 1.3);
      }
      if (!m.quadruped) {
        GIBS.spawn(this.pos.x, 1.1 * s, this.pos.z, 0.3 * s, 0.3 * s, 0.32 * s, m.cloth, { dx: 0, dz: 0 }, 1.5);
        GIBS.spawn(this.pos.x, 0.8 * s, this.pos.z, 0.26 * s, 0.2 * s, 0.3 * s, m.skin, { dx: 0.4, dz: 0.2 }, 1.2);
      }
      PARTICLES.blood(this.pos.x, 1.1 * s, this.pos.z, 24, true);
    } else if (!headshot && m.quadruped) {
      for (const piv of m.legs) if (piv.children[0]) this._gibPiece(piv.children[0], 1.2);
    } else if (!headshot && Math.random() < 0.45) {
      const piv = choice([...m.arms, ...m.legs]);
      if (piv && piv.children[0]) this._gibPiece(piv.children[0]);
    }
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
    // 头顶血条（首次受伤时懒创建）
    if (typeof HPBARS !== 'undefined' && !this.dummy && this.hp < this.maxHp && !this.hpbar) HPBARS.create(this);
    // 血量阶段断肢（v6.8）
    this._updateDismember();
    if (kb) this.addKnockback(kb.x, kb.z);
    if (hitPoint) PARTICLES.blood(hitPoint.x, hitPoint.y, hitPoint.z, isHead ? 10 : 6, isHead);
    if (this.hp <= 0) this.die(game, isHead);
  }

  die(game, headshot) {
    this.dead = true; this.deadT = 0;
    const overkill = this.hp <= -this.maxHp * 0.25;
    if (this.dummy) {
      // 假人：短促倒地，快速移除，不计赏金
      AUDIO.zombieDie(0, this.growlPitch);
      PARTICLES.blood(this.pos.x, 1.1 * this.group.scale.x, this.pos.z, 10);
      this._gibDeath(headshot, overkill);
      this.deadT = 1.4;
      if (game.mode && game.mode.onDummyKilled) {
        game.mode.onDummyKilled(this, headshot, game.player ? game.player.current : 'secondary', game._fragWindowT > 0);
      }
      return;
    }
    const d = game.player ? dist2d(this.pos.x, this.pos.z, game.player.pos.x, game.player.pos.z) : 0;
    AUDIO.zombieDie(d, this.growlPitch);
    PARTICLES.blood(this.pos.x, 1.1 * this.group.scale.x, this.pos.z, 14);
    this._gibDeath(headshot, overkill);
    if (typeof spawnLoot !== 'undefined' && !this.dummy) spawnLoot(game, this);
    if (this.type.deathPool) spawnAcidPool(game, this.pos.x, this.pos.z, { poolDps: 12, poolRadius: 2.6, poolTime: 5 });
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
