/* ============================================================
 * 武器系统 —— 第一人称枪模 / 开火 / 弹道 / 近战 / 脚踢 / 投掷 / ADS
 * ============================================================ */
class WeaponInstance {
  constructor(def) {
    this.def = def;
    this.mag = def.mag;
    this.reserve = def.reserve;
    this.lvl = 0;   // 强化等级 0-3（Borderlands 式品质：白/绿/蓝/紫）
  }
  get magSize() { return Math.round(this.def.mag * (1 + 0.2 * this.lvl)); }
  get dmgMult() { return 1 + 0.15 * this.lvl; }
}

let _muzzleTex = null;
function getMuzzleTex() {
  if (_muzzleTex) return _muzzleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.3, 'rgba(255,220,120,0.9)');
  g.addColorStop(0.7, 'rgba(255,140,40,0.4)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _muzzleTex = new THREE.CanvasTexture(c);
  return _muzzleTex;
}

class WeaponSystem {
  constructor(player) {
    this.p = player;
    this.cooldown = 0; this.reloadT = 0; this.switchT = 0;
    this.adsT = 0; this.recoilKick = 0; this.muzzleT = 0;
    this.swingT = -1; this.sawPhase = 0; this._emptyCd = 0;
    this.kickCd = 0;
    this.viewmodel = null; this.muzzleSprite = null; this.muzzleLight = null;
    this._buildViewmodel();

    // 枪口动态光（挂在相机上）
    this.muzzleLight = new THREE.PointLight(0xffc060, 0, 14);
    this.muzzleLight.position.set(0.1, -0.1, -0.9);
    ENGINE.camera.add(this.muzzleLight);
  }

  get w() { return this.p.weapons[this.p.current]; }

  _disposeViewmodel() {
    if (!this.viewmodel) return;
    ENGINE.camera.remove(this.viewmodel);
    this.viewmodel.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.__cached) o.material.dispose();
    });
    this.viewmodel = null; this.muzzleSprite = null;
  }

  _buildViewmodel() {
    this._disposeViewmodel();
    const def = this.w.def;
    const g = new THREE.Group();
    const body = ART.toon(def.color);
    const dark = ART.mat(0x17181c);
    const metal = ART.mat(0x8f979e);
    const wood = ART.mat(0x6a4a2e);
    const outlines = ENGINE.quality.outlines;
    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      if (outlines) ART.outline(m, 1.18);
      return m;
    };

    if (def.melee) {
      if (def.id === 'knife') {
        part(new THREE.BoxGeometry(0.035, 0.09, 0.42), ART.mat(0xc8d2dc), 0, 0.02, -0.32);
        part(new THREE.BoxGeometry(0.02, 0.02, 0.4), ART.mat(0x9aa4ac), 0, 0.075, -0.32);
        part(new THREE.BoxGeometry(0.05, 0.07, 0.2), dark, 0, 0, -0.02);
      } else if (def.id === 'axe') {
        part(new THREE.BoxGeometry(0.05, 0.05, 0.72), wood, 0, 0.02, -0.3);
        part(new THREE.BoxGeometry(0.06, 0.2, 0.18), ART.mat(0xb02a20), 0, 0.06, -0.62);
        part(new THREE.BoxGeometry(0.02, 0.22, 0.05), metal, 0.03, 0.06, -0.6);
      } else {
        part(new THREE.BoxGeometry(0.16, 0.2, 0.45), body, 0, -0.02, -0.1);
        part(new THREE.BoxGeometry(0.05, 0.12, 0.55), ART.mat(0x9aa2ac), 0, 0.06, -0.5);
        part(new THREE.BoxGeometry(0.05, 0.03, 0.5), dark, 0, 0.13, -0.5);
        part(new THREE.BoxGeometry(0.06, 0.14, 0.1), dark, 0, -0.14, 0.08);
      }
      g.rotation.z = 0.35;
    } else {
      // 枪身
      part(new THREE.BoxGeometry(0.09, 0.13, def.len * 0.6), body, 0, 0, -def.len * 0.22);
      // 枪管
      part(new THREE.BoxGeometry(0.045, 0.045, def.len * 0.55), dark, 0, 0.02, -def.len * 0.55);
      // 准星
      part(new THREE.BoxGeometry(0.02, 0.035, 0.06), dark, 0, 0.09, -def.len * 0.3);
      // 弹匣
      part(new THREE.BoxGeometry(0.06, 0.16, 0.09), dark, 0, -0.13, -def.len * 0.28);
      // 握把
      const grip = part(new THREE.BoxGeometry(0.06, 0.15, 0.08), dark, 0, -0.12, 0.05);
      grip.rotation.x = 0.25;
      // 护木
      part(new THREE.BoxGeometry(0.07, 0.06, def.len * 0.3), body, 0, -0.06, -def.len * 0.52);
      // 枪托
      part(new THREE.BoxGeometry(0.07, 0.11, 0.16), body, 0, -0.03, 0.16);
      // 侧轨
      part(new THREE.BoxGeometry(0.015, 0.02, def.len * 0.5), metal, 0.048, 0.04, -def.len * 0.35);
      if (def.scope) {
        const scope = part(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), dark, 0, 0.1, -def.len * 0.3);
        scope.rotation.x = Math.PI / 2;
      }
      // 枪口火光
      const sm = new THREE.SpriteMaterial({ map: getMuzzleTex(), transparent: true, depthTest: false });
      this.muzzleSprite = new THREE.Sprite(sm);
      this.muzzleSprite.scale.setScalar(0.32);
      this.muzzleSprite.position.set(0, 0.02, -def.len * 0.85);
      this.muzzleSprite.visible = false;
      g.add(this.muzzleSprite);
    }

    this.viewmodel = g;
    ENGINE.camera.add(g);
    ENGINE.scene.add(ENGINE.camera);
  }

  /* ---------- 主更新 ---------- */
  update(dt, game) {
    const p = this.p;
    p.moveMult = (this.w && this.w.def.slowMove) || 1;

    // 切换武器
    const wheel = INPUT.consumeWheel();
    if (wheel !== 0) this._cycle(wheel);
    if (INPUT.justPressed('Digit1')) this._equip('primary');
    if (INPUT.justPressed('Digit2')) this._equip('secondary');
    if (INPUT.justPressed('Digit3')) this._equip('melee');
    if (INPUT.justPressed('KeyG')) this._throw('frag', game);
    if (INPUT.justPressed('KeyT')) this._throw('molotov', game);
    if (INPUT.justPressed('KeyR')) this._startReload();
    if (INPUT.justPressed('KeyF')) this._kick(game);

    this.cooldown -= dt; this.switchT -= dt; this._emptyCd -= dt; this.kickCd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this._finishReload();
    }

    // 枪口光衰减
    if (this.muzzleLight) this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 22);

    const w = this.w;
    if (!w) return;
    const def = w.def;

    // ADS
    const wantAds = INPUT.rmb && this.reloadT <= 0 && !def.melee;
    this.adsT = clamp(this.adsT + (wantAds ? 1 : -1) * dt * 9, 0, 1);
    p.ads = this.adsT > 0.5;
    const targetFov = (def.scope ? lerp(75, 26, this.adsT) : lerp(75, 62, this.adsT))
      + (this.p.fovPunch || 0) * 14;   // 终结镜头 FOV 冲击
    if (Math.abs(ENGINE.camera.fov - targetFov) > 0.05 || (this.p.fovPunch || 0) > 0.02) {
      ENGINE.camera.fov = targetFov;
      ENGINE.camera.updateProjectionMatrix();
    }

    // 开火
    if (def.melee) {
      const wantFire = def.continuous ? INPUT.lmb : INPUT.consumeLmb();
      if (this.swingT >= 0) { this.swingT += dt; if (this.swingT > 0.3) this.swingT = -1; }
      if (wantFire && this.cooldown <= 0 && this.switchT <= 0) {
        this.cooldown = 60 / def.rpm;
        if (!def.continuous) this.swingT = 0;
        this._meleeHit(def, game);
      }
    } else {
      const wantFire = def.auto ? INPUT.lmb : INPUT.consumeLmb();
      if (wantFire && this.switchT <= 0 && this.reloadT <= 0 && this.cooldown <= 0) {
        if (w.mag <= 0) {
          if (this._emptyCd <= 0) { AUDIO.emptyClick(); this._emptyCd = 0.3; this._startReload(); }
        } else {
          this._fire(def, w, game);
        }
      }
    }

    this.muzzleT -= dt;
    if (this.muzzleSprite) this.muzzleSprite.visible = this.muzzleT > 0 && this.adsT < 0.6;
    this._updateViewmodel(dt);
    HUD.setScope(!!def.scope && this.adsT > 0.75);
  }

  /* ---------- 开火与弹道（多弹丸聚合伤害 + 击退） ---------- */
  _fire(def, w, game) {
    w.mag--;
    this.cooldown = 60 / def.rpm;
    AUDIO.shot(def.sound.freq, def.sound.dur, def.sound.boom);
    this.recoilKick = Math.min(1, this.recoilKick + 0.55);
    const kick = def.recoil * rand(0.7, 1.3);
    this.p.pitch += kick;
    this.p.recoilAccum += kick * 0.85;   // 大部分后坐力会自动回正
    this.p.yaw += def.recoil * rand(-0.4, 0.4);
    this.muzzleT = 0.045;
    if (this.muzzleLight) this.muzzleLight.intensity = 2.6;
    ENGINE.shake(def.recoil * 1.1);

    const cam = ENGINE.camera;
    const origin = new THREE.Vector3();
    cam.getWorldPosition(origin);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

    const moving = this.p.moving || this.p.sprinting;
    const spread = lerp(def.spread, def.adsSpread, this.adsT)
      * (moving ? 1.45 : 1) * (this.p.onGround ? 1 : 1.8);

    game.stats.shots++;
    const hits = new Map();   // zombie -> {dmg, head, pt}
    let anyHit = false;

    for (let pi = 0; pi < def.pellets; pi++) {
      const dir = fwd.clone();
      if (spread > 0) {
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * spread;
        dir.addScaledVector(right, Math.cos(a) * r)
          .addScaledVector(up, Math.sin(a) * r).normalize();
      }
      const res = this._hitscan(game, origin, dir, def);
      if (res) {
        anyHit = true;
        const prev = hits.get(res.zombie);
        if (prev) {
          prev.dmg += res.dmg;
          prev.head = prev.head || res.head;
        } else {
          hits.set(res.zombie, { dmg: res.dmg, head: res.head, pt: res.pt, dir });
        }
      }
    }
    if (anyHit) game.stats.hits++;

    // 一次性施加伤害与击退（联机客户端：只上报命中，伤害由房主结算）
    const isNetClient = typeof NET !== 'undefined' && NET.role === 'client';
    const kbPow = def.pellets > 1 ? GAMECONFIG.feel.kbShotgun : 0;
    for (const [z, h] of hits) {
      if (isNetClient) {
        NET.reportHit(z, h.dmg, h.head, h.pt);
        DMGNUM.spawn(h.pt.x, h.pt.y, h.pt.z, Math.round(h.dmg), h.head);
        HUD.hitmarker(h.head);
        if (h.head) AUDIO.headshot(); else AUDIO.hitFlesh(h.pt ? dist2d(h.pt.x, h.pt.z, this.p.pos.x, this.p.pos.z) : 0);
        continue;
      }
      z.takeDamage(h.dmg, h.head, h.pt, game, kbPow ? { x: h.dir.x * kbPow, z: h.dir.z * kbPow } : null);
      DMGNUM.spawn(h.pt.x, h.pt.y, h.pt.z, Math.round(h.dmg), h.head);
      HUD.hitmarker(h.head);
      if (h.head) { AUDIO.headshot(); if (!z.dead) game.hitstop(GAMECONFIG.feel.hitstopHead); }
      else AUDIO.hitFlesh(h.pt ? dist2d(h.pt.x, h.pt.z, this.p.pos.x, this.p.pos.z) : 0);
    }
  }

  _hitscan(game, origin, dir, def) {
    const maxT = def.range;
    let bestT = rayAABBs(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxT);
    let hitZ = null, isHead = false;

    for (const z of game.zombies) {
      if (z.dead) continue;
      const s = z.group.scale.x, fy = z.pos.y;
      const hr = (z.type.headBig ? 0.32 : 0.23) * s;
      let t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
        z.pos.x, fy + 1.68 * s, z.pos.z, hr);
      if (t !== null && t < bestT) { bestT = t; hitZ = z; isHead = true; continue; }
      t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
        z.pos.x, fy + 0.95 * s, z.pos.z, 0.42 * s);
      if (t !== null && t < bestT) { bestT = t; hitZ = z; isHead = false; }
    }

    if (hitZ) {
      const hx = origin.x + dir.x * bestT, hy = origin.y + dir.y * bestT, hz = origin.z + dir.z * bestT;
      let dmg = def.damage * this.w.dmgMult * this.p.dmgMult * (isHead ? def.headMult : 1);
      if (def.falloff) {
        const f = def.falloff;
        if (bestT > f.end) dmg *= f.min;
        else if (bestT > f.start) dmg *= lerp(1, f.min, (bestT - f.start) / (f.end - f.start));
      }
      return { zombie: hitZ, dmg, head: isHead, pt: { x: hx, y: hy, z: hz } };
    }
    if (bestT < maxT) {
      PARTICLES.impact(origin.x + dir.x * bestT, origin.y + dir.y * bestT, origin.z + dir.z * bestT);
    }
    return null;
  }

  _meleeHit(def, game) {
    AUDIO.melee(def.damage > 60);
    const p = this.p;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let hitAny = false;
    game.stats.shots++;
    for (const z of game.zombies) {
      if (z.dead) continue;
      const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > def.range + 0.35 * z.group.scale.x) continue;
      if ((dx * fx + dz * fz) / (d || 1) < Math.cos(def.arc + 0.55)) continue;
      const dmg = def.damage * this.w.dmgMult * p.dmgMult;   // 近战也吃强化等级
      z.takeDamage(dmg, true, { x: z.pos.x, y: 1.25 * z.group.scale.x, z: z.pos.z }, game,
        { x: fx * GAMECONFIG.feel.kbMelee, z: fz * GAMECONFIG.feel.kbMelee });
      DMGNUM.spawn(z.pos.x, 1.5 * z.group.scale.x, z.pos.z, Math.round(dmg), false);
      hitAny = true;
    }
    if (hitAny) {
      game.stats.hits++;
      HUD.hitmarker(false);
      AUDIO.hitFlesh(0);
      game.hitstop(GAMECONFIG.feel.hitstopKill);
      HUD.bloodSplat();
    }
  }

  /* ---------- 战术脚踢（Dying Light 式群体控制） ---------- */
  _kick(game) {
    if (this.kickCd > 0) return;
    const K = GAMECONFIG.kick;
    this.kickCd = K.cooldown;
    AUDIO.kick();
    this.kickAnimT = 0.22;
    const p = this.p;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let hitAny = false;
    for (const z of game.zombies) {
      if (z.dead) continue;
      const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > K.range + 0.3 * z.group.scale.x) continue;
      if ((dx * fx + dz * fz) / (d || 1) < Math.cos(K.arc + 0.7)) continue;
      z.stagger = Math.max(z.stagger, K.stagger);
      z.takeDamage(K.damage * p.dmgMult, false, { x: z.pos.x, y: 1.0, z: z.pos.z }, game,
        { x: fx * K.knockback, z: fz * K.knockback });
      hitAny = true;
    }
    if (hitAny) {
      AUDIO.impact();
      ENGINE.shake(0.12);
      HUD.hitmarker(false);
    }
  }

  /* ---------- 换弹 / 切换 / 投掷 ---------- */
  _startReload() {
    const w = this.w;
    if (!w || w.def.melee) return;
    if (this.reloadT > 0 || w.mag >= w.magSize || w.reserve <= 0 || this.switchT > 0) return;
    this.reloadT = w.def.reloadTime * this.p.reloadMult;
    AUDIO.reloadStart();
  }

  _finishReload() {
    const w = this.w;
    if (!w) return;
    const take = Math.min(w.magSize - w.mag, w.reserve);
    w.mag += take; w.reserve -= take;
    AUDIO.reloadEnd();
  }

  _equip(slot) {
    if (this.p.weapons[slot] && this.p.current !== slot) {
      this.p.current = slot;
      this.switchT = 0.38; this.reloadT = 0; this.adsT = 0;
      this._buildViewmodel();
      AUDIO.weaponSwitch();
    }
  }

  _cycle(dir) {
    const order = ['primary', 'secondary', 'melee'];
    let i = order.indexOf(this.p.current);
    for (let k = 0; k < 3; k++) {
      i = (i + dir + 3) % 3;
      if (this.p.weapons[order[i]]) { this._equip(order[i]); break; }
    }
  }

  _throw(kind, game) {
    const t = this.p.throwables[kind];
    if (!t || t.count <= 0) { AUDIO.emptyClick(); return; }
    t.count--;
    AUDIO.throwPin();
    const cam = ENGINE.camera;
    const origin = new THREE.Vector3();
    cam.getWorldPosition(origin);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const cfg = THROWABLES[kind];
    game._fragWindowT = 3;   // 手雷击杀归因窗口（教学用）
    game.projectiles.push(new Projectile(kind,
      origin.x + dir.x * 0.5, origin.y - 0.08, origin.z + dir.z * 0.5,
      dir.x * cfg.speed, dir.y * cfg.speed + 2.6, dir.z * cfg.speed,
      { fuse: cfg.fuse }));
  }

  /* ---------- 第一人称动画 ---------- */
  _updateViewmodel(dt) {
    const vm = this.viewmodel;
    if (!vm) return;
    const def = this.w.def;
    const p = this.p;
    const base = def.melee ? { x: 0.32, y: -0.3, z: -0.55 } : { x: 0.28, y: -0.24, z: -0.5 };
    const adsPos = { x: 0, y: -0.155, z: -0.38 };

    const tx = lerp(base.x, adsPos.x, this.adsT);
    const ty = lerp(base.y, adsPos.y, this.adsT);
    const tz = lerp(base.z, adsPos.z, this.adsT);

    const bobX = (p.moving && p.onGround) ? Math.sin(p.bobPhase) * 0.014 * (1 - this.adsT) : 0;
    const bobY = (p.moving && p.onGround) ? Math.abs(Math.cos(p.bobPhase)) * 0.013 * (1 - this.adsT) : 0;

    this.recoilKick = Math.max(0, this.recoilKick - dt * 7);
    if (this.kickAnimT > 0) this.kickAnimT -= dt;
    let rx = 0, rz = 0, ox = 0, oy = 0;
    if (this.switchT > 0) oy = -0.28 * (this.switchT / 0.38);
    if (this.reloadT > 0) {
      const k = 1 - this.reloadT / (def.reloadTime * p.reloadMult);
      rx = 0.55 * Math.sin(clamp(k, 0, 1) * Math.PI);
      oy -= 0.07;
    }
    if (this.swingT >= 0) {
      const k = this.swingT / 0.3;
      rz = -1.5 * Math.sin(k * Math.PI);
      ox = -0.13 * Math.sin(k * Math.PI);
      rx = -0.5 * Math.sin(k * Math.PI);
    }
    if (def.continuous && INPUT.lmb) {
      this.sawPhase += dt * 55;
      ox = Math.sin(this.sawPhase) * 0.008;
      oy += Math.abs(Math.cos(this.sawPhase)) * 0.005;
    }
    // 冲刺摆臂 / 脚踢前蹬
    if (p.dashT > 0) { ox -= 0.06; rz += 0.2; }
    if (this.kickAnimT > 0) { ox -= 0.1 * Math.sin((0.22 - this.kickAnimT) / 0.22 * Math.PI); oy += 0.04; }

    vm.position.set(tx + bobX + ox, ty + bobY + oy, tz + this.recoilKick * 0.07);
    vm.rotation.set(-this.recoilKick * 0.2 + rx, 0, (def.melee ? 0.35 : 0) + rz);
    if (def.scope) vm.visible = this.adsT < 0.7;
  }
}
