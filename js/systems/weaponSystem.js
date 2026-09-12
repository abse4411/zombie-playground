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
    this._swingDur = 0.3; this._heavySwing = false; this._prevRmb = false; this._fireKick = 0;
    this.viewmodel = null; this.muzzleSprite = null; this.muzzleLight = null;
    this._buildViewmodel();

    // 挥砍轨迹（近战弧光，挂在相机）
    this.trail = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.62, 24, 1, -0.4, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false })
    );
    this.trail.position.set(0.05, -0.02, -0.85);
    this.trail.renderOrder = 999;
    ENGINE.camera.add(this.trail);

    // 枪口动态光（挂在相机上）
    this.muzzleLight = new THREE.PointLight(0xffc060, 0, 14);
    this.muzzleLight.position.set(0.1, -0.1, -0.9);
    ENGINE.camera.add(this.muzzleLight);
  }

  get w() { return this.p.weapons[this.p.current]; }

  // 槽位全空兜底（旧版继承存档引用了已不存在/改名的武器时）：自动补一把P92
  _ensureFallbackWeapon() {
    const p = this.p;
    if (!p.weapons.secondary) {
      const inst = new WeaponInstance(WEAPONS.p92);
      p.weapons.secondary = inst;
      if (!p.rack.secondary.includes(inst)) p.rack.secondary.push(inst);
    }
    if (!p.weapons[p.current]) p.current = 'secondary';
  }

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
    if (!this.w) this._ensureFallbackWeapon();
    const def = this.w.def;
    const g = new THREE.Group();
    // 精致化枪模（v7.2）：部件化建模器 gunModels.js（商城预览共用）
    const gun = buildGunModel(def, { outlines: ENGINE.quality.outlines });
    // 第一人称持枪姿态：枪体右移下沉微内旋，枪口不挡准星
    if (def.melee) {
      gun.position.set(0.02, -0.04, 0.08);
      gun.rotation.z = 0.35;
    } else {
      gun.position.set(0.03, -0.05, 0.1);
      gun.rotation.y = -0.04;
    }
    g.add(gun);
    // 枪口火光
    const sm = new THREE.SpriteMaterial({ map: getMuzzleTex(), transparent: true, depthTest: false });
    this.muzzleSprite = new THREE.Sprite(sm);
    this.muzzleSprite.scale.setScalar(0.32);
    this.muzzleSprite.position.set(0, 0.02, gun.userData.muzzleZ || -def.len * 0.85);
    this.muzzleSprite.visible = false;
    g.add(this.muzzleSprite);

    // 第一人称手臂（v6.1）
    const sleeveColor = 0x3a4236;
    attachArmsToViewmodel(g, def, sleeveColor);

    this.viewmodel = g;
    ENGINE.camera.add(g);
    ENGINE.scene.add(ENGINE.camera);
  }

  /* ---------- 主更新 ---------- */
  update(dt, game) {
    const p = this.p;
    // 武器重量移速（v6.3）：近战1.02最快，机枪0.82最慢
    p.moveMult = (this.w && (this.w.def.weight || this.w.def.slowMove)) || 1;

    // 切换武器
    // 狙击开镜时滚轮保留给倍率切换（不切枪），否则滚轮切枪
    let scopeWheel = 0;
    if (this.w && this.w.def.scope && this.adsT > 0.7) scopeWheel = INPUT.consumeWheel();
    const wheel = INPUT.consumeWheel();
    if (wheel !== 0) this._cycle(wheel);
    if (INPUT.justPressed('Digit1')) this._cycleSlot('primary');
    if (INPUT.justPressed('Digit2')) this._cycleSlot('secondary');
    if (INPUT.justPressed('Digit3')) this._cycleSlot('melee');
    if (INPUT.justPressed('KeyQ')) this._lastInv();
    if (INPUT.justPressed('KeyG')) this._throw('frag', game);
    if (INPUT.justPressed('KeyT')) this._throw('molotov', game);
    if (INPUT.justPressed('KeyR')) this._startReload();
    if (INPUT.justPressed('KeyF')) this._kick(game);
    if (INPUT.justPressed('KeyH')) this.p.useMedkit();

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
    // 狙击两段开镜（v7.0）：开镜状态下滚动滚轮切换 1×/2× 倍率（滚轮在开镜时不切枪）
    if (this.zoom2T === undefined) { this.zoom2T = 0; this.zoom2 = false; }
    if (def.scope && this.adsT > 0.7) {
      if (scopeWheel > 0) this.zoom2 = true;
      else if (scopeWheel < 0) this.zoom2 = false;
      if (!this._scopeTip) { this._scopeTip = true; HUD.toast('🔍 开镜状态：滚动滚轮切换 2× 倍率'); }
    }
    if (this.adsT < 0.4) this.zoom2 = false;
    this.zoom2T = clamp(this.zoom2T + (this.zoom2 ? 1 : -1) * dt * 6, 0, 1);
    const scopeFov = lerp(26, 11, this.zoom2T);
    const targetFov = (def.scope ? lerp(75, scopeFov, this.adsT) : lerp(75, 62, this.adsT))
      + (this.p.fovPunch || 0) * 14;   // 终结镜头 FOV 冲击
    if (Math.abs(ENGINE.camera.fov - targetFov) > 0.05 || (this.p.fovPunch || 0) > 0.02) {
      ENGINE.camera.fov = targetFov;
      ENGINE.camera.updateProjectionMatrix();
    }

    // 榴弹发射器：左键发射碰炸榴弹
    if (def.launcher) {
      if (INPUT.consumeLmb() && this.cooldown <= 0 && this.switchT <= 0 && this.reloadT <= 0) {
        if (w.mag <= 0) {
          if (this._emptyCd <= 0) { AUDIO.emptyClick(); this._emptyCd = 0.3; if (SAVE.data.settings.autoReload !== false) this._startReload(); }
        } else {
          w.mag--;
          this.cooldown = 60 / def.rpm;
          AUDIO.shot(def.sound.freq, def.sound.dur, def.sound.boom);
          this.recoilKick = Math.min(1, this.recoilKick + 0.8);
          ENGINE.shake(0.15);
          const cam = ENGINE.camera;
          const origin = new THREE.Vector3();
          cam.getWorldPosition(origin);
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
          game._fragWindowT = 3;
          game.projectiles.push(new Projectile('gl',
            origin.x + dir.x * 0.5, origin.y - 0.08, origin.z + dir.z * 0.5,
            dir.x * 16, dir.y * 16 + 1.5, dir.z * 16, { fuse: 3 }));
        }
      }
    } else
    // 开火
    if (def.melee) {
      // 轻击 LMB；重击 RMB（近战时右键无ADS占用）——触屏用🎯键
      const heavyEdge = INPUT.rmb && !this._prevRmb;
      this._prevRmb = INPUT.rmb;
      const wantFire = def.continuous ? INPUT.lmb : INPUT.consumeLmb();
      if (this.swingT >= 0) { this.swingT += dt; if (this.swingT > this._swingDur) this.swingT = -1; }
      if (this.cooldown <= 0 && this.switchT <= 0) {
        if (heavyEdge) {
          // 重击：前摇短促、伤害x2.2、击退x2.2、硬直1.4s
          this.cooldown = 60 / (def.rpm * 0.5);
          this._swingDur = 0.55;
          this.swingT = 0;
          this._heavySwing = true;
          this._meleeHit(def, game, true);
          ENGINE.shake(0.1);
        } else if (wantFire) {
          this.cooldown = 60 / def.rpm;
          this._swingDur = 0.3;
          this.swingT = 0;
          this._heavySwing = false;
          this._meleeHit(def, game, false);
        }
      }
    } else {
      const wantFire = def.auto ? INPUT.lmb : INPUT.consumeLmb();
      if (wantFire && this.switchT <= 0 && this.reloadT <= 0 && this.cooldown <= 0) {
        if (w.mag <= 0) {
          if (this._emptyCd <= 0) { AUDIO.emptyClick(); this._emptyCd = 0.3; if (SAVE.data.settings.autoReload !== false) this._startReload(); }
        } else {
          this._fire(def, w, game);
        }
      }
    }

    this.muzzleT -= dt;
    if (this.muzzleSprite) this.muzzleSprite.visible = this.muzzleT > 0 && this.adsT < 0.6;
    // 近战弧光
    if (this.trail) {
      const show = def.melee && this.swingT >= 0;
      this.trail.material.opacity = show ? 0.55 * (1 - this.swingT / this._swingDur) : 0;
      if (show) {
        this.trail.rotation.z = lerp(1.2, -1.6, this.swingT / this._swingDur) * (this._heavySwing ? -1 : 1);
        this.trail.scale.setScalar(this._heavySwing ? 1.25 : 1);
      }
    }
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
    this._fireKick = Math.min(1.5, this._fireKick + 0.9);   // 准星扩散
    ENGINE.shake(def.recoil * 1.1);

    const cam = ENGINE.camera;
    const origin = new THREE.Vector3();
    cam.getWorldPosition(origin);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    // 弹壳抛出（右侧金色小粒子）
    PARTICLES.spawn('spark', origin.x + right.x * 0.3, origin.y - 0.1, origin.z + right.z * 0.3, 1,
      { speed: 1.6, vy: 1.5, life: 0.5, color: [1, 0.85, 0.3], color2: [0.9, 0.6, 0.1] });

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
      // 火焰喷射器：沿弹道喷火粒子（替代曳光）
      if (def.flame) {
        const mz = this.muzzleSprite ? this.muzzleSprite.getWorldPosition(new THREE.Vector3()) : origin;
        for (let fi = 1; fi <= 4; fi++) {
          const t2 = (def.range * 0.9 * fi / 4) * rand(0.8, 1.1);
          PARTICLES.flames(mz.x + dir.x * t2, mz.y + dir.y * t2, mz.z + dir.z * t2, 1);
        }
      } else if (typeof TRACERS !== 'undefined') {
        // 曳光：枪口 -> 命中/落点
        const mz = this.muzzleSprite ? this.muzzleSprite.getWorldPosition(new THREE.Vector3())
          : origin.clone().addScaledVector(dir, 0.5);
        const endT = res ? res.pt : origin.clone().addScaledVector(dir, def.range * 0.7);
        TRACERS.fire(mz, endT);
      }
      // 命中点燃（v7.9 火焰DoT：3秒×25/s 固定值，可刷新）
      if (res && def.flame) {
        const ign = (z2) => { z2.burnT = 3; z2.burnDps = 25; };
        ign(res.zombie);
        if (res.pierced) for (const pe of res.pierced) ign(pe.zombie);
      }
      if (res) {
        anyHit = true;
        const prev = hits.get(res.zombie);
        if (prev) {
          prev.dmg += res.dmg;
          prev.head = prev.head || res.head;
        } else {
          hits.set(res.zombie, { dmg: res.dmg, head: res.head, pt: res.pt, dir });
        }
        // 穿透目标（v7.5 M107）：伤害衰减的后续敌人
        if (res.pierced) {
          for (const pe of res.pierced) {
            const pv = hits.get(pe.zombie);
            if (pv) { pv.dmg += pe.dmg; pv.head = pv.head || pe.head; }
            else hits.set(pe.zombie, { dmg: pe.dmg, head: pe.head, pt: pe.pt, dir });
          }
        }
      }
    }
    if (anyHit) game.stats.hits++;

    const isNetClient = typeof NET !== 'undefined' && NET.role === 'client';

    // 专属武器机制（v8.4）
    const exMult = (this.p.explodeMult !== undefined) ? 1 : 1;
    for (const [z, h] of hits) {
      // 链式闪电（猎犬咆哮者）：跳跃至3m内下一只 ×0.6，最多3跳
      if (def.chain && !isNetClient) {
        let cur = z, dmg2 = h.dmg, jumped = new Set([z]);
        for (let hop = 0; hop < def.chain; hop++) {
          let best = null, bd = 3;
          for (const z2 of game.zombies) {
            if (z2.dead || z2 === cur || jumped.has(z2) || z2.state === 'rise') continue;
            const d2 = dist2d(z2.pos.x, z2.pos.z, cur.pos.x, cur.pos.z);
            if (d2 < bd) { bd = d2; best = z2; }
          }
          if (!best) break;
          dmg2 *= 0.6;
          PARTICLES.spawn('spark', best.pos.x, 1.2 * best.group.scale.x, best.pos.z, 4,
            { speed: 2, vy: 1, life: 0.3, color: [0.4, 0.8, 1], color2: [0.1, 0.3, 0.8] });
          best.takeDamage(dmg2, false, { x: best.pos.x, y: 1.2 * best.group.scale.x, z: best.pos.z }, game, null);
          jumped.add(best); cur = best;
        }
      }
      // 冰冻（冬霜之刺）：命中减速3秒
      if (def.frost && !isNetClient) {
        z.slowT = Math.max(z.slowT || 0, 3);
        PARTICLES.spawn('smoke', z.pos.x, 1.1 * z.group.scale.x, z.pos.z, 3,
          { speed: 0.5, vy: 0.4, life: 0.6, color: [0.7, 0.9, 1], color2: [0.3, 0.5, 0.8] });
      }
    }
    // 三连齐射（九头蛇）：额外发射2枚小火箭
    if (def.volley && !isNetClient) {
      for (let vi = 1; vi < def.volley; vi++) {
        const sp = (vi - 1) * 0.05 - 0.025;
        const dirV = fwd.clone();
        dirV.applyAxisAngle(up, sp);
        game.projectiles.push(new Projectile('gl',
          origin.x + dirV.x * 0.5, origin.y - 0.05, origin.z + dirV.z * 0.5,
          dirV.x * 14, dirV.y * 14 + 2.2, dirV.z * 14,
          { fuse: 4 }));
      }
    }


    // 一次性施加伤害与击退（联机客户端：只上报命中，伤害由房主结算）
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
    // 可破坏物遮挡判定（爆炸桶可被引爆）
    if (typeof hitDestructibles !== 'undefined' && game.destructibles && game.destructibles.length) {
      let nearest = null, nearestT = bestT;
      for (const d of game.destructibles) {
        if (d.dead) continue;
        const c = { minX: d.x - d.cfg.w / 2, maxX: d.x + d.cfg.w / 2, minZ: d.z - d.cfg.w / 2, maxZ: d.z + d.cfg.w / 2, minY: 0, maxY: d.cfg.h };
        const t = rayOneAABB(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, c);
        if (t !== null && t < nearestT) { nearestT = t; nearest = d; }
      }
      if (nearest) {
        nearest.hit(def.damage * this.w.dmgMult, game);
        PARTICLES.impact(origin.x + dir.x * nearestT, origin.y + dir.y * nearestT, origin.z + dir.z * nearestT);
        return null;
      }
    }
    let hitZ = null, isHead = false;

    // 收集全部丧尸命中（v7.5 穿透：按距离排序取前 pierce+1 个）
    const allHits = [];
    for (const z of game.zombies) {
      if (z.dead) continue;
      const s = z.group.scale.x, fy = z.pos.y;
      const hr = (z.type.headBig ? 0.32 : 0.23) * s;
      let t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
        z.pos.x, fy + 1.68 * s, z.pos.z, hr);
      if (t !== null && t < bestT) { allHits.push({ z, t, head: true }); continue; }
      t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
        z.pos.x, fy + 0.95 * s, z.pos.z, 0.42 * s);
      if (t !== null && t < bestT) allHits.push({ z, t, head: false });
    }
    allHits.sort((a, b) => a.t - b.t);

    const take = allHits.slice(0, (def.pierce || 0) + 1);
    if (take.length) {
      const first = take[0];
      hitZ = first.z; isHead = first.head; bestT = first.t;
      const calcDmg = (t2, head2) => {
        let d2 = def.damage * this.w.dmgMult * this.p.dmgMult * (head2 ? def.headMult : 1);
        // 背水一战（v8.4）：生命<25% 伤害加成
        if (this.p.laststandVal && this.p.hp <= this.p.maxHp * 0.25) d2 *= (1 + this.p.laststandVal);
        if (def.falloff) {
          const f = def.falloff;
          if (t2 > f.end) d2 *= f.min;
          else if (t2 > f.start) d2 *= lerp(1, f.min, (t2 - f.start) / (f.end - f.start));
        }
        return d2;
      };
      const hx = origin.x + dir.x * bestT, hy = origin.y + dir.y * bestT, hz = origin.z + dir.z * bestT;
      const res = { zombie: hitZ, dmg: calcDmg(bestT, isHead), head: isHead, pt: { x: hx, y: hy, z: hz } };
      // 穿透目标：伤害逐个 ×0.65 衰减
      if (def.pierce) {
        res.pierced = take.slice(1).map((h2, i) => ({
          zombie: h2.z,
          dmg: calcDmg(h2.t, h2.head) * Math.pow(0.65, i + 1),
          head: h2.head,
          pt: { x: origin.x + dir.x * h2.t, y: origin.y + dir.y * h2.t, z: origin.z + dir.z * h2.t },
        }));
      }
      return res;
    }
    if (bestT < maxT) {
      PARTICLES.impact(origin.x + dir.x * bestT, origin.y + dir.y * bestT, origin.z + dir.z * bestT);
    }
    return null;
  }

  /* ---------- 近战：轻击(LMB)/重击(RMB) ---------- */
  _meleeHit(def, game, heavy) {
    AUDIO.melee(def.damage > 60 || heavy);
    if (heavy) AUDIO.impact();
    const p = this.p;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const range = def.range + (heavy ? 0.4 : 0);
    const dmg = def.damage * this.w.dmgMult * p.dmgMult * (heavy ? 2.2 : 1);
    const kbPow = GAMECONFIG.feel.kbMelee * (heavy ? 2.2 : 1);
    let hitAny = false;
    game.stats.shots++;
    for (const z of game.zombies) {
      if (z.dead) continue;
      const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + 0.35 * z.group.scale.x) continue;
      if ((dx * fx + dz * fz) / (d || 1) < Math.cos(def.arc + (heavy ? 0.85 : 0.55))) continue;
      z.stagger = Math.max(z.stagger, heavy ? 1.4 : GAMECONFIG.combat.staggerTime);
      z.takeDamage(dmg, heavy, { x: z.pos.x, y: 1.25 * z.group.scale.x, z: z.pos.z }, game,
        { x: fx * kbPow, z: fz * kbPow });
      DMGNUM.spawn(z.pos.x, 1.5 * z.group.scale.x, z.pos.z, Math.round(dmg), heavy);
      hitAny = true;
    }
    if (hitAny) {
      game.stats.hits++;
      HUD.hitmarker(heavy);
      AUDIO.hitFlesh(0);
      game.hitstop(heavy ? 0.09 : GAMECONFIG.feel.hitstopKill);
      HUD.bloodSplat();
      ENGINE.shake(heavy ? 0.22 : 0.08);
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
  // 弹雨瘾（v8.4）：连杀≥8 换弹加速
  _reloadMult() {
    let m = this.p.reloadMult;
    if (this.p.bulletstormVal && this.p.killStreak >= 8) m *= (1 - this.p.bulletstormVal);
    return m;
  }

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

  /* ---------- 武器架装备（v4.5） ---------- */
  _equip(slot, inst) {
    if (!this.p.weapons[slot] && !inst) return;
    if (this.p.weapons[slot] && this.p.current === slot && !inst) return;
    this._rememberLast();
    if (inst) this.p.weapons[slot] = inst;
    else if (!this.p.weapons[slot]) return;
    this.p.current = slot;
    this.switchT = 0.38; this.reloadT = 0; this.adsT = 0;
    // 转管预热（v8.4 minigun）：切换时间加长
    if (this.w.def.spinup) this.switchT = this.w.def.spinup;
    this.swingT = -1; this._fireKick = 0;
    this._buildViewmodel();
    AUDIO.weaponSwitch();
  }

  // 记录当前武器为"上一把"（Q键用）
  _rememberLast() {
    const w = this.w;
    if (w) this.p.lastWeapon = { slot: this.p.current, defId: w.def.id };
  }

  // 槽位键：多件武器时循环装备该槽位的武器架
  _cycleSlot(slot) {
    const rack = this.p.rack[slot];
    if (!rack || !rack.length) { AUDIO.emptyClick(); return; }
    if (rack.length === 1) { this._equip(slot); return; }
    this._rememberLast();
    const cur = this.p.weapons[slot];
    let idx = cur ? rack.findIndex(r => r.def.id === cur.def.id) : -1;
    const next = rack[(idx + 1) % rack.length];
    if (next === cur) return;
    this.p.weapons[slot] = next;
    this.p.current = slot;
    this.switchT = 0.38; this.reloadT = 0; this.adsT = 0;
    this.swingT = -1; this._fireKick = 0;
    this._buildViewmodel();
    AUDIO.weaponSwitch();
    HUD.pickup(`🔸 ${next.def.name}${next.lvl ? ' Lv.' + next.lvl : ''}`, 1);
  }

  // Q键：切回上一把使用的武器
  _lastInv() {
    const lw = this.p.lastWeapon;
    if (!lw) { AUDIO.emptyClick(); return; }
    const inst = this.p.rack[lw.slot]?.find(r => r.def.id === lw.defId);
    if (!inst) { AUDIO.emptyClick(); return; }
    this._equip(lw.slot, inst);
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
    if (game._throwCount !== undefined) game._throwCount++;
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
    this._fireKick = Math.max(0, this._fireKick - dt * 5);
    if (this.kickAnimT > 0) this.kickAnimT -= dt;
    let rx = 0, rz = 0, ox = 0, oy = 0;
    if (this.switchT > 0) oy = -0.28 * (this.switchT / 0.38);
    if (this.reloadT > 0) {
      const k = 1 - this.reloadT / (def.reloadTime * this._reloadMult());
      rx = 0.95 * Math.sin(clamp(k, 0, 1) * Math.PI);          // 大幅翻枪
      oy -= 0.14 + 0.05 * Math.sin(k * Math.PI * 3);           // 下沉+抖动
      rz = 0.3 * Math.sin(k * Math.PI * 2);                    // 左右晃
    }
    if (this.swingT >= 0) {
      const k = this.swingT / this._swingDur;
      const hv = this._heavySwing;
      rz = (hv ? -2.2 : -1.5) * Math.sin(k * Math.PI);
      ox = (hv ? -0.22 : -0.13) * Math.sin(k * Math.PI);
      rx = (hv ? -0.9 : -0.5) * Math.sin(k * Math.PI);
      oy -= hv ? 0.05 * Math.sin(k * Math.PI) : 0;
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
