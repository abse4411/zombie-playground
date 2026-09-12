/* ============================================================
 * 丧尸实体 —— 程序化美漫模型 + 9 种行为 AI
 * ============================================================ */
let _shadowMat = null;
let _shadowGeo = null;   // 全体丧尸共享的接地阴影几何体
let ZOMBIE_SEQ = 0;
const ZOMBIE_POOL = {};  // 模型对象池：typeId(+dummy) -> [group,...]

/* ---------- 构件辅助（v4.6 有机人体建模） ---------- */
// 锥形肢体：上粗下细的圆柱（手臂/腿），两端球关节
function limbMesh(rTop, rBottom, len, mat) {
  const g = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, 8), mat);
  seg.position.y = -len / 2;
  const joint = new THREE.Mesh(new THREE.SphereGeometry(rTop, 8, 6), mat);
  g.add(seg, joint);
  return g;
}

// 圆润头部：球颅+锥下巴+眉骨
function headMesh(cfg, mat, bloodMat) {
  const g = new THREE.Group();
  const headS = cfg.headBig ? 1.4 : 1;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19 * headS, 12, 10), mat);
  skull.scale.set(1, 1.08, 1.05);
  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * headS, 0.13 * headS, 0.12 * headS, 8), bloodMat);
  jaw.position.set(0, -0.14 * headS, 0.045 * headS);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035 * headS, 0.07 * headS, 6), mat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.02 * headS, 0.19 * headS);
  g.add(skull, jaw, nose);
  g.userData.headS = headS;
  return g;
}

function buildZombieModel(cfg, outlines) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const skin = ART.toon(cfg.skin);
  const cloth = ART.toon(cfg.cloth);
  const pants = ART.toon(cfg.pants);
  const bloodMat = ART.mat(0x5a1010);
  const headS = cfg.headBig ? 1.4 : 1;

  // 躯干：锥形胸腔+腹部（上宽下窄，佝偻前倾）
  const torsoG = new THREE.Group();
  torsoG.position.y = 0.92;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.42, 10), cloth);
  chest.position.y = 0.28; chest.rotation.x = 0.12;
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.26, 10), cloth);
  belly.position.y = -0.02; belly.rotation.x = 0.2;
  torsoG.add(chest, belly);
  g.add(torsoG);

  if (cfg.armorPlate) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.4, 10), ART.mat(0x2e3638));
    plate.position.y = 1.24; g.add(plate);
    for (const side of [-1, 1]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.08), ART.mat(0x232a24));
      pouch.position.set(side * 0.17, 1.08, 0.2); g.add(pouch);
    }
  } else {
    // 破布条与血污
    for (let i = 0; i < 3; i++) {
      const patch = new THREE.Mesh(
        new THREE.BoxGeometry(rand(0.08, 0.15), rand(0.1, 0.22), 0.02),
        i % 2 ? bloodMat : pants
      );
      patch.position.set(rand(-0.18, 0.18), rand(0.85, 1.35), 0.17);
      patch.rotation.z = rand(-0.4, 0.4);
      g.add(patch);
    }
  }

  // 头（球形+下颚）
  const headG = headMesh(cfg, skin, bloodMat);
  headG.position.y = 1.58 + 0.2 * headS;
  g.add(headG);
  const head = headG.children[0];   // 受击闪色引用

  // 眼睛（发光）
  const eyeC = (cfg.big || cfg.armorPlate) ? 0xff3838 : 0xffd23f;
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeC });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028 * headS, 6, 5), eyeMat);
    eye.position.set(side * 0.07 * headS, headG.position.y + 0.03, 0.15 * headS);
    g.add(eye);
  }

  // 类型配件
  if (cfg.armorPlate) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22 * headS, 10, 8, 0, TAU, 0, 1.4), ART.mat(0x2a3230));
    helm.position.y = headG.position.y + 0.04 * headS; g.add(helm);
  }
  if (cfg.zigzag) {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 6), ART.mat(side < 0 ? 0xc04868 : 0x48a0b8));
      horn.position.set(side * 0.11, headG.position.y + 0.17, 0);
      horn.rotation.z = side * 0.5; g.add(horn);
    }
  }
  if (cfg.big) {
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), ART.mat(0x3a3028));
      pad.position.set(side * 0.34, 1.42, 0); pad.scale.set(1, 0.7, 1); g.add(pad);
    }
  }

  // 四肢：锥形+球关节（肩/髋 pivot）
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.29, 1.38, 0);
    const upper = limbMesh(0.065, 0.055, 0.3, skin); upper.position.y = 0;
    const foreG = new THREE.Group();
    foreG.position.y = -0.3;
    const fore = limbMesh(0.05, 0.045, 0.3, skin); 
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), bloodMat);
    hand.position.y = -0.32;
    foreG.add(fore, hand);
    shoulder.add(upper, foreG);
    g.add(shoulder); arms.push(shoulder);
    shoulder.userData.fore = foreG;
  }
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.78, 0);
    const thigh = limbMesh(0.085, 0.07, 0.4, pants);
    const shinG = new THREE.Group();
    shinG.position.y = -0.4;
    const shin = limbMesh(0.065, 0.055, 0.38, pants);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.22), ART.mat(0x1c1a18));
    foot.position.set(0, -0.4, 0.05);
    shinG.add(shin, foot);
    hip.add(thigh, shinG);
    hip.userData.shin = shinG;
    g.add(hip); legs.push(hip);
  }

  // 美漫描边（主要块面）
  if (outlines) {
    ART.outline(chest, 1.12); ART.outline(head, 1.16);
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
    // 贴合支撑面高度（台阶平滑爬升，可上站台追杀）
    const gh = groundHeightAt(this.pos.x, this.pos.z, 0.42 * cfg.scale, this.pos.y, 0.6);
    this.pos.y = Math.abs(gh - this.pos.y) > 0.01 ? lerp(this.pos.y, gh, Math.min(1, 12 * dt)) : gh;

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
    // 膝盖弯曲（摆动腿屈膝，支撑腿伸直）
    for (let i = 0; i < 2; i++) {
      const shin = m.legs[i].userData.shin;
      if (shin) shin.rotation.x = Math.max(0, (i === 0 ? sw : -sw)) * -0.9;
    }
    const base = cfg.crawl ? -0.5 : -1.15;
    const attackT = this.windup >= 0 ? 1 - this.windup / GAMECONFIG.combat.attackWindup : -1;
    if (m.arms.length) {
      m.arms[0].rotation.x = base + sw * 0.22;
      m.arms[1].rotation.x = base - sw * 0.22;
      // 手肘：前伸爪姿
      for (const a of m.arms) {
        if (a.userData.fore) a.userData.fore.rotation.x = -0.55 + Math.sin(ENGINE.time * 2 + this.walkPhase) * 0.1;
      }
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
