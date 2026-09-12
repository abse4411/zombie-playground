/* ============================================================
 * 武器系统 —— 第一人称枪模 / 开火 / 弹道 / 近战 / 脚踢 / 投掷 / ADS
 * ============================================================ */
/* ---------- 武器多属性升级（v11.5 COD Gunsmith 式权衡） ----------
 * 每项独立等级+上限，升级有增益也有代价（tradeoff）
 * upgrades: { dmg: n, mag: n, rel: n, rof: n, acc: n, res: n, [special]: n }
 */
const W_UPGRADES = {
  dmg:  { name: '威力',     max: 5, gain: '伤害 +8%',            drawback: '弹匣容量 -5%',   price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.28 * (lv + 1)) },
  mag:  { name: '扩容弹匣', max: 3, gain: '弹匣容量 +20%',        drawback: '换弹时间 +6%',   price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.22 * (lv + 1)) },
  rel:  { name: '快速换弹', max: 4, gain: '换弹时间 -10%',        drawback: '备弹 -8%',       price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.24 * (lv + 1)) },
  rof:  { name: '射速',     max: 3, gain: '射速 +7%',             drawback: '后坐力 +6%',     price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.26 * (lv + 1)) },
  acc:  { name: '精准',     max: 3, gain: '散布 -12%',            drawback: '移速 -1.5%',     price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.22 * (lv + 1)) },
  res:  { name: '备弹扩容', max: 2, gain: '备弹 +25%',            drawback: '武器更重',       price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.2 * (lv + 1)) },
};

/* ---------- 武器特性专属升级线（v11.11）：按 def 特征自动附加，各有上限 ---------- */
const W_SPECIALS = {
  pel: { name: '弹丸密度', max: 2, gain: '弹丸 +1',        drawback: '备弹 -10%',    price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.3 * (lv + 1)) },
  psc: { name: '穿甲弹芯', max: 2, gain: '穿透 +1',        drawback: '移速 -1.5%',   price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.32 * (lv + 1)) },
  rng: { name: '加长握柄', max: 2, gain: '范围 +0.25m',    drawback: '攻速 -4%',     price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.26 * (lv + 1)) },
  knb: { name: '配重锤头', max: 2, gain: '击退 +18%',      drawback: '移速 -1%',     price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.24 * (lv + 1)) },
  blk: { name: '高爆装药', max: 2, gain: '爆炸半径 +12%',  drawback: '自伤 +10%',    price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.3 * (lv + 1)) },
  bur: { name: '稠化燃料', max: 2, gain: '灼烧 +25%/s',    drawback: '直伤 -4%',     price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.28 * (lv + 1)) },
  hop: { name: '超导线圈', max: 2, gain: '链跳 +1',        drawback: '链电威力 -3%', price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.34 * (lv + 1)) },
  frz: { name: '深寒制剂', max: 2, gain: '冻结 +1s',       drawback: '换弹 +5%',     price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.28 * (lv + 1)) },
};

// 按武器特征返回全部可用升级线（带id的配置对象数组）；近战剔除弹药概念线
function getUpgradeLines(def) {
  const mk = (id, ovr) => Object.assign({ id }, W_UPGRADES[id] || W_SPECIALS[id], ovr || {});
  if (def.melee) return [
    mk('dmg', { gain: '伤害 +8%', drawback: '攻速 -2%' }),
    mk('rof', { name: '攻速' }),
    mk('rng'), mk('knb'),
  ];
  const ids = ['dmg', 'mag', 'rel', 'rof', 'acc', 'res'];
  if ((def.pellets || 1) > 1) ids.push('pel');
  if (def.pierce || def.scope) ids.push('psc');
  if (def.launcher) ids.push('blk');
  if (def.flame) ids.push('bur');
  if (def.chain) ids.push('hop');
  if (def.frost) ids.push('frz');
  return ids.map(id => mk(id));
}
function upgradeDef(id) { return W_UPGRADES[id] || W_SPECIALS[id]; }

class WeaponInstance {
  constructor(def) {
    this.def = def;
    this.mag = def.mag;
    this.reserve = def.reserve;
    this.lvl = 0;   // 总品质等级（各分项之和，Borderlands 色阶仍用）
    // 分项升级（v11.5）
    this.upgrades = {};
  }
  get magSize() {
    if (!this.def.mag) return 0;   // 近战无弹匣概念
    let m = this.def.mag * (1 + 0.2 * this.lvl);   // 旧总等级仍生效（兼容存档）
    if (this.upgrades.mag) m *= 1 + 0.2 * this.upgrades.mag;
    if (this.upgrades.dmg) m *= 1 - 0.05 * this.upgrades.dmg;
    return Math.max(1, Math.round(m));
  }
  get dmgMult() {
    let d = 1 + 0.15 * this.lvl;
    if (this.upgrades.dmg) d *= 1 + 0.08 * this.upgrades.dmg;
    return d;
  }
  get reloadTimeMult() {
    let r = 1;
    if (this.upgrades.rel) r *= 1 - 0.10 * this.upgrades.rel;
    if (this.upgrades.mag) r *= 1 + 0.06 * this.upgrades.mag;
    if (this.upgrades.frz) r *= 1 + 0.05 * this.upgrades.frz;   // 深寒制剂代价（v11.11）
    return r;
  }
  get rpmMult() {
    let r = 1;
    if (this.upgrades.rof) r *= 1 + 0.07 * this.upgrades.rof;
    if (this.def.melee) r *= 1 - 0.02 * (this.upgrades.dmg || 0) - 0.04 * (this.upgrades.rng || 0);   // 近战攻速代价（v11.11）
    return r;
  }
  get spreadMult() {
    let s = 1;
    if (this.upgrades.acc) s *= 1 - 0.12 * this.upgrades.acc;
    return s;
  }
  get reserveMaxMult() {
    let r = 1;
    if (this.upgrades.res) r *= 1 + 0.25 * this.upgrades.res;
    if (this.upgrades.rel) r *= 1 - 0.08 * this.upgrades.rel;
    if (this.upgrades.pel) r *= 1 - 0.10 * this.upgrades.pel;   // 霰弹弹丸密度代价（v11.11）
    return r;
  }
  // 移速代价乘区（v11.11：精准/穿芯/锤头/备弹的重量代价）
  get movePenalty() {
    const u = this.upgrades;
    return 1 - 0.015 * (u.acc || 0) - 0.015 * (u.psc || 0) - 0.01 * (u.knb || 0) - 0.008 * (u.res || 0);
  }
  // 灼烧 dps 乘区（稠化燃料）
  get burnMult() { return 1 + 0.25 * ((this.upgrades && this.upgrades.bur) || 0); }
  // 满级精通：全部可用升级线满级（v11.11）
  get mastery() {
    if (this._mastery) return true;
    return getUpgradeLines(this.def).every(L => ((this.upgrades && this.upgrades[L.id]) || 0) >= L.max);
  }
  // 品质色阶（总等级=分项和+旧lvl）
  get tierLevel() { return this.lvl + Object.values(this.upgrades || {}).reduce((a, b) => a + b, 0); }
}

let _muzzleTex = null;
// 热路径零分配（v12.1）：开火时的相机坐标/朝向复用模块级临时向量
const _tvOrigin = new THREE.Vector3(), _tvFwd = new THREE.Vector3(),
  _tvRight = new THREE.Vector3(), _tvUp = new THREE.Vector3();
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
    this.chargeThrow = null; this.chargePower = 0; this.healAnimT = 0;
    this._throwSel = 'frag'; this._chargeFromSlot = false;
    this.trajLine = null; this.trajRing = null;
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

  // 整个武器系统生命周期结束时调用（退局）：释放逐局挂件（v12.1 防累积）
  // 近战弧光/枪口灯/弹道预览挂在常驻相机与场景上 —— 不释放会逐局累积
  disposeFx() {
    if (this.trail) {
      ENGINE.camera.remove(this.trail);
      this.trail.geometry.dispose(); this.trail.material.dispose();
      this.trail = null;
    }
    if (this.muzzleLight) { ENGINE.camera.remove(this.muzzleLight); this.muzzleLight = null; }
    if (this.trajLine) {
      ENGINE.scene.remove(this.trajLine);
      this.trajLine.geometry.dispose(); this.trajLine.material.dispose();
      this.trajLine = null;
    }
    if (this.trajRing) {
      ENGINE.scene.remove(this.trajRing);
      this.trajRing.geometry.dispose(); this.trajRing.material.dispose();
      this.trajRing = null;
    }
    this.chargeThrow = null; this._chargeFromSlot = false; this._hideTraj();
  }

  _buildViewmodel() {
    this._disposeViewmodel();
    // 投掷槽（v11.9）：手持投掷物模型
    if (this.p.current === 'throw') { this._buildThrowViewmodel(this._selKind()); return; }
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
    // 武器重量移速（v6.3）：近战1.02最快，机枪0.82最慢；升级移速代价乘区（v11.11）
    p.moveMult = ((this.w && (this.w.def.weight || this.w.def.slowMove)) || 1) * ((this.w && this.w.movePenalty) || 1);

    // 切换武器
    // 狙击开镜时滚轮保留给倍率切换（不切枪），否则滚轮切枪
    let scopeWheel = 0;
    if (this.w && this.w.def.scope && this.adsT > 0.7) scopeWheel = INPUT.consumeWheel();
    const wheel = INPUT.consumeWheel();
    if (wheel !== 0) this._cycle(wheel);
    if (INPUT.justPressed('Digit1')) this._cycleSlot('primary');
    if (INPUT.justPressed('Digit2')) this._cycleSlot('secondary');
    if (INPUT.justPressed('Digit3')) this._cycleSlot('melee');
    if (INPUT.justPressed('Digit4')) this._cycleThrow();
    if (INPUT.justPressed('KeyQ')) this._lastInv();
    // 投掷蓄力（v11.7）：按下键进入蓄力预备，左键释放按力度抛出
    if (INPUT.justPressed('KeyG') && !this.chargeThrow) this._beginCharge('frag');
    if (INPUT.justPressed('KeyV') && !this.chargeThrow) this._beginCharge('attractor');
    if (INPUT.justPressed('KeyT') && !this.chargeThrow) this._beginCharge('molotov');
    if (this.chargeThrow) {
      if (!this._chargeLmbSeen) {
        // 阶段1：等待玩家按下左键（防按G瞬间误投）
        if (INPUT.lmb || INPUT.lmbEdge) this._chargeLmbSeen = true;
        else if (INPUT.justPressed('KeyG') || INPUT.justPressed('KeyT') || INPUT.justPressed('KeyV')) { /* 保持蓄力 */ }
        else {
          // 松开投掷键取消
          this.chargeThrow = null; this._chargeLmbSeen = false;
        }
      } else if (INPUT.lmb) {
        // 阶段2：按住左键蓄力
        this.chargePower = Math.min(1, (this.chargePower || 0) + dt * 1.4);
      } else {
        // 阶段3：松开左键→投出
        this._chargeLmbSeen = false;
        this._releaseCharge(game);
      }
    }
    if (INPUT.justPressed('KeyR')) this._startReload();
    if (INPUT.justPressed('KeyF')) this._kick(game);
    if (INPUT.justPressed('KeyH')) this.p.useMedkit();

    // 投掷槽（v11.9）：掏出投掷物后——按下左键进入蓄力预备，松开左键按视角投出；RMB收枪取消
    if (p.current === 'throw') {
      const kind = this._selKind();
      if (kind && !this.chargeThrow && this.switchT <= 0 && INPUT.consumeLmb()) this._beginCharge(kind, true);
      if (INPUT.rmb && !this._prevRmb) {
        if (this.chargeThrow) { this.chargeThrow = null; this._chargeFromSlot = false; this._hideTraj(); }
        this._holsterFromThrow();
      }
      this._prevRmb = INPUT.rmb;
    }
    // 弹道预览弧（v11.9）：投掷槽蓄力时实时重算抛物线+落点环
    if (this.chargeThrow && this._chargeFromSlot) this._updateTraj();
    else this._hideTraj();

    this.cooldown -= dt; this.switchT -= dt; this._emptyCd -= dt; this.kickCd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this._finishReload();
    }

    // 枪口光衰减
    if (this.muzzleLight) this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 22);

    const w = this.w;
    if (!w && this.p.current !== 'throw') return;
    if (this.p.current === 'throw') {
      // 投掷槽主循环：无开火/ADS，仅保持视图模型动画与移速
      this.p.moveMult = 1.02;
      this._updateViewmodel(dt);
      HUD.setScope(false);
      return;
    }
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
          this.cooldown = 60 / (def.rpm * (this.p.rogueRof || 1) * (w.rpmMult || 1));
          AUDIO.shot(def.sound.freq, def.sound.dur, def.sound.boom);
          this.recoilKick = Math.min(1, this.recoilKick + 0.8);
          ENGINE.shake(0.15);
          const cam = ENGINE.camera;
          const origin = new THREE.Vector3();
          cam.getWorldPosition(origin);
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
          game._fragWindowT = 3;
          // 高爆装药（v11.11）：半径+12%/级，自伤+10%/级
          const blkLv = (w.upgrades && w.upgrades.blk) || 0;
          game.projectiles.push(new Projectile('gl',
            origin.x + dir.x * 0.5, origin.y - 0.08, origin.z + dir.z * 0.5,
            dir.x * 16, dir.y * 16 + 1.5, dir.z * 16,
            { fuse: 3, radiusMult: 1 + 0.12 * blkLv, selfBonus: 0.1 * blkLv }));
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
          if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'swing', 0.5);
          this._meleeHit(def, game, true);
          ENGINE.shake(0.1);
        } else if (wantFire) {
          this.cooldown = 60 / (def.rpm * (this.p.rogueRof || 1) * (this.w.rpmMult || 1));   // 近战攻速受升级代价影响（v11.11）
          this._swingDur = 0.3;
          this.swingT = 0;
          this._heavySwing = false;
          if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'swing', 0.32);
          this._meleeHit(def, game, false);
        }
      }
    } else {
      const wantFire = def.auto ? INPUT.lmb : INPUT.consumeLmb();
      const galeBoost = this.p.synGale && this.p.moving ? 1.25 : 1;   // 飓风枪手（v10.9）
      if (wantFire && this.switchT <= 0 && this.reloadT <= 0 && this.cooldown <= 60 / (def.rpm * (this.p.rogueRof || 1) * (w.rpmMult || 1) * galeBoost)) {
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
    this.cooldown = 60 / (def.rpm * (this.p.rogueRof || 1) * (w.rpmMult || 1));
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
    const origin = _tvOrigin;
    cam.getWorldPosition(origin);
    const fwd = _tvFwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = _tvRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = _tvUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
    // 弹壳抛出（右侧金色小粒子）
    PARTICLES.spawn('spark', origin.x + right.x * 0.3, origin.y - 0.1, origin.z + right.z * 0.3, 1,
      { speed: 1.6, vy: 1.5, life: 0.5, color: [1, 0.85, 0.3], color2: [0.9, 0.6, 0.1] });

    const moving = this.p.moving || this.p.sprinting;
    const pellets = (def.pellets || 1) + ((w.upgrades && w.upgrades.pel) || 0);   // 弹丸密度升级（v11.11）
    const spread = lerp(def.spread, def.adsSpread, this.adsT) * (w.spreadMult || 1)
      * (moving ? 1.45 : 1) * (this.p.onGround ? 1 : 1.8);

    game.stats.shots++;
    const hits = new Map();   // zombie -> {dmg, head, pt}
    let anyHit = false;

    for (let pi = 0; pi < pellets; pi++) {
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
      // 命中点燃（v7.9 火焰DoT：3秒×25/s 固定值，可刷新；稠化燃料+25%/级 v11.11）
      if (res && def.flame) {
        const dps2 = 25 * (this.w.burnMult || 1);
        const ign = (z2) => { z2.burnT = 3; z2.burnDps = dps2; };
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
      // 链式闪电（猎犬咆哮者）：跳跃至3m内下一只 ×0.6；超导线圈+1跳/级（v11.11）
      if (def.chain && !isNetClient) {
        const hops = def.chain + ((w.upgrades && w.upgrades.hop) || 0);
        let cur = z, dmg2 = h.dmg * (1 - 0.03 * ((w.upgrades && w.upgrades.hop) || 0)), jumped = new Set([z]);
        for (let hop = 0; hop < hops; hop++) {
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
      // 冰冻（冬霜之刺）：命中减速；深寒制剂+1s/级（v11.11）
      if (def.frost && !isNetClient) {
        z.slowT = Math.max(z.slowT || 0, 3 + ((w.upgrades && w.upgrades.frz) || 0));
        PARTICLES.spawn('smoke', z.pos.x, 1.1 * z.group.scale.x, z.pos.z, 3,
          { speed: 0.5, vy: 0.4, life: 0.6, color: [0.7, 0.9, 1], color2: [0.3, 0.5, 0.8] });
      }
    }
    // 三连齐射（九头蛇）：额外发射2枚小火箭（高爆装药同步生效 v11.11）
    if (def.volley && !isNetClient) {
      const blkLv = (w.upgrades && w.upgrades.blk) || 0;
      for (let vi = 1; vi < def.volley; vi++) {
        const sp = (vi - 1) * 0.05 - 0.025;
        const dirV = fwd.clone();
        dirV.applyAxisAngle(up, sp);
        game.projectiles.push(new Projectile('gl',
          origin.x + dirV.x * 0.5, origin.y - 0.05, origin.z + dirV.z * 0.5,
          dirV.x * 14, dirV.y * 14 + 2.2, dirV.z * 14,
          { fuse: 4, radiusMult: 1 + 0.12 * blkLv, selfBonus: 0.1 * blkLv }));
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

    const take = allHits.slice(0, (def.pierce || 0) + 1 + ((this.w.upgrades && this.w.upgrades.psc) || 0));   // 穿甲弹芯（v11.11）
    if (take.length) {
      const first = take[0];
      hitZ = first.z; isHead = first.head; bestT = first.t;
      const calcDmg = (t2, head2) => {
        let d2 = def.damage * this.w.dmgMult * this.p.dmgMult * (this.p.rogueAtk || 1) * (this.p.metaAtk || 1) * (head2 ? def.headMult : 1);
        // 暴击（v10.6）
        let crit = false;
        if (this.p.critChance > 0 && Math.random() < this.p.critChance) { d2 *= 2; crit = true; }
        // 炼狱风暴（v10.9）：暴击附带小爆炸
        if (crit && this.p.synInferno) {
          const hx = origin.x + dir.x * t2, hz = origin.z + dir.z * t2;
          for (const zb2 of game.zombies) {
            if (zb2.dead || zb2 === game.zombies[0] && false) continue;
            if (dist2d(zb2.pos.x, zb2.pos.z, hx, hz) < 2.2) zb2.takeDamage(d2 * 0.4, false, { x: zb2.pos.x, y: 1.2, z: zb2.pos.z }, game, null);
          }
          PARTICLES.explosion(hx, 1.2, hz);
        }
        // 背水一战（v8.4）：生命<25% 伤害加成
        if (this.p.laststandVal && this.p.hp <= this.p.maxHp * 0.25) d2 *= (1 + this.p.laststandVal);
        // 稠化燃料代价：直伤 -4%/级（v11.11）
        if (def.flame && this.w.upgrades.bur) d2 *= 1 - 0.04 * this.w.upgrades.bur;
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
  // 电击麻痹（v10.5 电击棍）
  _applyShock(z, game) {
    if (!z || z.dead || z.boss) return;
    z.stagger = Math.max(z.stagger, 1.5);
    z.slowT = Math.max(z.slowT || 0, 1.5);
    if (Math.random() < 0.15) { z.burnT = 2; z.burnDps = 15; }   // 15%点燃
    PARTICLES.spawn('spark', z.pos.x, 1.1 * z.group.scale.x, z.pos.z, 6,
      { speed: 2.4, vy: 1.2, life: 0.3, color: [0.55, 0.85, 1], color2: [0.1, 0.3, 0.8] });
    AUDIO.shot(420, 0.08, 0.3);
  }

  _meleeHit(def, game, heavy) {
    AUDIO.melee(def.damage > 60 || heavy);
    if (heavy) AUDIO.impact();
    const p = this.p;
    const wi = this.w;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    // 加长握柄（v11.11）：范围 +0.25m/级；配重锤头：击退 +18%/级
    const range = def.range + ((wi.upgrades && wi.upgrades.rng) || 0) * 0.25 + (heavy ? 0.4 : 0);
    const dmg = def.damage * this.w.dmgMult * p.dmgMult * (heavy ? 2.2 : 1);
    const kbPow = GAMECONFIG.feel.kbMelee * (heavy ? 2.2 : 1) * (1 + 0.18 * ((wi.upgrades && wi.upgrades.knb) || 0));
    let hitAny = false;
    game.stats.shots++;
    for (const z of game.zombies) {
      if (z.dead) continue;
      const dx = z.pos.x - p.pos.x, dz = z.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + 0.35 * z.group.scale.x) continue;
      if ((dx * fx + dz * fz) / (d || 1) < Math.cos(def.arc + (heavy ? 0.85 : 0.55))) continue;
      z.stagger = Math.max(z.stagger, heavy ? 1.4 : GAMECONFIG.combat.staggerTime);
      if (def.shock) this._applyShock(z, game);
      z.takeDamage(dmg, heavy, { x: z.pos.x, y: 1.25 * z.group.scale.x, z: z.pos.z }, game,
        { x: fx * kbPow, z: fz * kbPow });
      DMGNUM.spawn(z.pos.x, 1.5 * z.group.scale.x, z.pos.z, Math.round(dmg), heavy);
      hitAny = true;
    }
    // 近战破坏场景物（v11.1）：范围内可破坏物受近战伤害（独立于丧尸命中）
    if (game.destructibles) {
      for (const d of game.destructibles) {
        if (d.dead) continue;
        const dd = dist2d(d.x, d.z, p.pos.x, p.pos.z);
        const ddx = d.x - p.pos.x, ddz = d.z - p.pos.z;
        const dl = Math.hypot(ddx, ddz) || 1;
        if (dd < range + 0.6 && (ddx * fx + ddz * fz) / dl > Math.cos(def.arc + 0.5)) d.hit(dmg, game, true);
      }
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
    // 战术踢消耗体力（v13.1）
    if (this.p.stamina < GAMECONFIG.stamina.kickCost) {
      AUDIO.emptyClick();
      if (this.p._stamTipT <= 0) { HUD.toast('💨 体力不足，无法踢击'); this.p._stamTipT = 1.5; }
      return;
    }
    this.p.stamina -= GAMECONFIG.stamina.kickCost;
    this.kickCd = K.cooldown;
    AUDIO.kick();
    this.kickAnimT = 0.22;
    if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'kick', 0.34);
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
    let m = this.p.reloadMult * (this.p.rogueRel || 1) * (this.p.metaRel || 1);
    if (this.p.bulletstormVal && this.p.killStreak >= 8) m *= (1 - this.p.bulletstormVal);
    return m;
  }

  _startReload() {
    const w = this.w;
    if (!w || w.def.melee) return;
    if (this.reloadT > 0 || w.mag >= w.magSize || w.reserve <= 0 || this.switchT > 0) return;
    this.reloadT = w.def.reloadTime * this.p.reloadMult * (w.reloadTimeMult || 1);
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
    if (this._anyThrowOwned()) order.push('throw');
    let i = Math.max(0, order.indexOf(this.p.current));
    for (let k = 0; k < order.length; k++) {
      i = (i + dir + order.length) % order.length;
      const s = order[i];
      if (s === 'throw') { if (this.p.current !== 'throw') { this._cycleThrow(); return; } }
      else if (this.p.weapons[s]) { this._equip(s); return; }
    }
  }

  // 投掷蓄力（v11.7 / v11.9）：fromSlot=投掷槽左键直接蓄力（免去 G 键两段式）
  _beginCharge(kind, fromSlot) {
    const t = this.p.throwables[kind];
    if (!t || t.count <= 0) { AUDIO.emptyClick(); return; }
    this.chargeThrow = kind;
    this.chargePower = 0;
    this._chargeFromSlot = !!fromSlot;
    this._chargeLmbSeen = !!fromSlot;
    if (!fromSlot) HUD.toast('按住左键蓄力，松开投掷');
    if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'throw', 0.9);
  }

  _releaseCharge(game) {
    const kind = this.chargeThrow;
    const fromSlot = this._chargeFromSlot;
    this.chargeThrow = null;
    this._chargeFromSlot = false;
    this._hideTraj();
    const power = clamp(this.chargePower || 0.4, 0.25, 1);
    this._throw(kind, game, power);
    // 投掷槽：丢空自动收枪回上一把武器
    if (fromSlot && this.p.current === 'throw') {
      const t = this.p.throwables[kind];
      if (!t || t.count <= 0) this._holsterFromThrow();
    }
  }

  /* ---------- 投掷武器槽（v11.9） ---------- */
  _anyThrowOwned() {
    const t = this.p.throwables;
    return !!(t && (t.frag.count > 0 || t.molotov.count > 0 || t.attractor.count > 0));
  }

  // 当前选中的投掷物（选中数量耗尽时自动顺延到下一种）
  _selKind() {
    const t = this.p.throwables;
    if (t[this._throwSel] && t[this._throwSel].count > 0) return this._throwSel;
    for (const k of ['frag', 'molotov', 'attractor']) if (t[k].count > 0) { this._throwSel = k; return k; }
    return null;
  }

  // Digit4 / 循环：掏出或切换下一种持有中的投掷物
  _cycleThrow() {
    if (!this._anyThrowOwned()) { AUDIO.emptyClick(); HUD.toast('没有投掷物——可在商城补给'); return; }
    const kinds = ['frag', 'molotov', 'attractor'].filter(k => this.p.throwables[k].count > 0);
    let idx = kinds.indexOf(this._throwSel);
    if (this.p.current === 'throw') idx = (idx + 1) % kinds.length;   // 已掏出：切换种类
    else idx = Math.max(0, idx);
    this._equipThrowKind(kinds[idx]);
  }

  _equipThrowKind(kind) {
    this._throwSel = kind;
    this._rememberLast();
    this.p.current = 'throw';
    this.switchT = 0.3; this.reloadT = 0; this.adsT = 0;
    this.swingT = -1; this._fireKick = 0;
    this._buildThrowViewmodel(kind);
    AUDIO.weaponSwitch();
    const t = this.p.throwables[kind];
    HUD.pickup(`💣 ${THROWABLES[kind].name} ×${t.count} —— 按住左键蓄力投掷`, 1);
  }

  _holsterFromThrow() {
    const lw = this.p.lastWeapon;
    let inst = null;
    if (lw) inst = this.p.rack[lw.slot]?.find(r => r.def.id === lw.defId);
    if (inst) this._equip(lw.slot, inst);
    else if (this.p.weapons.secondary) this._equip('secondary');
    else if (this.p.weapons.primary) this._equip('primary');
    else if (this.p.weapons.melee) this._equip('melee');
  }

  // 手持投掷物模型（极简：手雷球体/燃烧瓶/诱饵棒）
  _buildThrowViewmodel(kind) {
    this._disposeViewmodel();
    const cfg = THROWABLES[kind] || THROWABLES.frag;
    const g = new THREE.Group();
    const body = new THREE.Group();
    if (kind === 'molotov') {
      // 瓶身（深棕玻璃）+ 橙色燃油 + 瓶颈 + 布条
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.17, 10),
        ART.mat(0x4a3220, { roughness: 0.25, metalness: 0.1 }));
      const fuel = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.054, 0.12, 10),
        new THREE.MeshBasicMaterial({ color: 0xd86a1a }));
      fuel.position.y = -0.015;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.034, 0.07, 8), glass.material);
      neck.position.y = 0.115;
      const rag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), ART.mat(0xc9bfa8, {}));
      rag.position.set(0, 0.16, 0); rag.rotation.z = 0.4;
      body.add(glass, fuel, neck, rag);
    } else if (kind === 'attractor') {
      // 声波诱饵：蓝灰圆柱 + 天线 + 指示灯
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 10),
        ART.mat(0x4a6a8a, { metalness: 0.5, roughness: 0.4 }));
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4),
        ART.mat(0x222831, { metalness: 0.6 }));
      ant.position.y = 0.115;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x63c5ff }));
      led.position.set(0.03, 0.05, 0);
      body.add(shell, ant, led);
    } else {
      // 破片手雷：橄榄球体 + 保险握片 + 拉环
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10),
        ART.mat(cfg.color, { roughness: 0.5, metalness: 0.35 }));
      ball.scale.y = 1.15;
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.012),
        ART.mat(0x8a8f96, { metalness: 0.7, roughness: 0.3 }));
      lever.position.set(0.045, 0.055, 0);
      const pin = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12),
        ART.mat(0xb0b6bd, { metalness: 0.8, roughness: 0.25 }));
      pin.position.set(0.06, 0.09, 0); pin.rotation.y = Math.PI / 2;
      body.add(ball, lever, pin);
    }
    // 手持姿态：右下前，微微内旋
    body.position.set(0.02, -0.03, 0.02);
    body.rotation.z = -0.15;
    g.add(body);
    // 右臂（单手持握，同近战）
    const sleeveColor = 0x3a4236;
    attachArmsToViewmodel(g, { melee: true, len: 0.3 }, sleeveColor);
    this.viewmodel = g;
    ENGINE.camera.add(g);
  }

  /* ---------- 弹道预览（v11.9）：抛物线点串 + 落点环 ---------- */
  _initTraj() {
    if (this.trajLine) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 3), 3));
    geo.setDrawRange(0, 0);
    this.trajLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.95 }));
    this.trajLine.frustumCulled = false; this.trajLine.renderOrder = 500;
    this.trajRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.58, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.trajRing.rotation.x = -Math.PI / 2; this.trajRing.renderOrder = 500;
    this.trajLine.visible = this.trajRing.visible = false;
    ENGINE.scene.add(this.trajLine); ENGINE.scene.add(this.trajRing);
  }

  // 每帧重算：半隐式欧拉模拟（与 Projectile 完全一致的步进），力度=当前蓄力
  _updateTraj() {
    this._initTraj();
    const cfg = THROWABLES[this.chargeThrow];
    if (!cfg) { this._hideTraj(); return; }
    const cam = ENGINE.camera;
    const origin = new THREE.Vector3(); cam.getWorldPosition(origin);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const power = clamp(this.chargePower || 0, 0.25, 1);
    const spd = cfg.speed * (0.45 + 0.65 * power);
    let vx = dir.x * spd, vy = dir.y * spd + 2.6 * (0.5 + power * 0.5), vz = dir.z * spd;
    let x = origin.x + dir.x * 0.5, y = origin.y - 0.08, z = origin.z + dir.z * 0.5;
    const step = 1 / 60, arr = this.trajLine.geometry.attributes.position.array;
    let n = 0, lx = x, ly = y, lz = z;
    for (let i = 0; i < 96 * 2 && n < 96; i++) {
      vy -= cfg.gravity * step;
      x += vx * step; y += vy * step; z += vz * step;
      if (y < 0.06) break;
      if (i % 2 === 0) { arr[n * 3] = x; arr[n * 3 + 1] = y; arr[n * 3 + 2] = z; n++; }
      lx = x; ly = y; lz = z;
    }
    this.trajLine.geometry.setDrawRange(0, n);
    this.trajLine.geometry.attributes.position.needsUpdate = true;
    this.trajRing.position.set(lx, 0.07, lz);
    const pulse = 1 + 0.12 * Math.sin(ENGINE.time * 6);
    this.trajRing.scale.setScalar(pulse);
    this.trajLine.visible = this.trajRing.visible = true;
  }

  _hideTraj() {
    if (this.trajLine) { this.trajLine.visible = false; this.trajRing.visible = false; }
  }

  _throw(kind, game, power) {
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
    game._fragWindowT = 3;
    if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'throw', 0.5);
    this.throwAnimT = 0.5;
    // 蓄力：初速 45%~110% 按力度；视角 pitch 决定抛射角（dir已含）
    const spd = cfg.speed * (0.45 + 0.65 * (power !== undefined ? power : 0.75));
    game.projectiles.push(new Projectile(kind,
      origin.x + dir.x * 0.5, origin.y - 0.08, origin.z + dir.z * 0.5,
      dir.x * spd, dir.y * spd + 2.6 * (0.5 + (power || 0.75) * 0.5), dir.z * spd,
      { fuse: cfg.fuse }));
  }

  /* ---------- 第一人称动画 ---------- */
  _updateViewmodel(dt) {
    const vm = this.viewmodel;
    if (!vm) return;
    const w = this.w;
    const isThrow = !w && this.p.current === 'throw';
    if (!w && !isThrow) return;
    const def = isThrow ? { melee: false, scope: false, len: 0.3 } : w.def;
    const p = this.p;
    // 投掷槽：手持位置略高于枪械（保证手雷/瓶在画面内）
    const base = isThrow ? { x: 0.26, y: -0.17, z: -0.44 }
      : (def.melee ? { x: 0.32, y: -0.3, z: -0.55 } : { x: 0.28, y: -0.24, z: -0.5 });
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
      const k = this._swingDur > 0 ? 1 - this.reloadT / (def.reloadTime * this._reloadMult() * ((w && w.reloadTimeMult) || 1)) : 0;
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
    if (this.kickAnimT > 0) { ox -= 0.16 * Math.sin((0.22 - this.kickAnimT) / 0.22 * Math.PI); oy -= 0.07 * Math.sin((0.22 - this.kickAnimT) / 0.22 * Math.PI); rx += 0.35 * Math.sin((0.22 - this.kickAnimT) / 0.22 * Math.PI); }
    // 医疗包扎动画（v11.8）：武器下沉+左倾+规律按压抖动
    if (this.healAnimT > 0) {
      this.healAnimT -= dt;
      const press = Math.abs(Math.sin(ENGINE.time * 7));
      oy -= 0.12 + press * 0.03; rx += 0.25 + press * 0.12; rz += 0.25;
      ox -= 0.06;
    }
    // 投掷蓄力（v11.7）：武器下沉+后仰，屏显力度
    if (this.chargeThrow) {
      const cp = this.chargePower || 0;
      oy -= 0.1 + cp * 0.1; rx += 0.3 + cp * 0.4; rz -= 0.2 + cp * 0.2;
      HUD.toast(`💥 蓄力 ${Math.round(cp * 100)}% —— 松开左键投掷`);
    }
    // 投掷臂摆（v8.7）：抬臂过肩→前甩
    if (this.throwAnimT > 0) {
      this.throwAnimT -= dt;
      const tk = 1 - this.throwAnimT / 0.5;
      const sw = Math.sin(clamp(tk, 0, 1) * Math.PI);
      oy += 0.1 * sw; rx -= 0.5 * sw; rz -= 0.35 * sw;
      ox -= 0.12 * Math.sin(clamp((tk - 0.5) / 0.5, 0, 1) * Math.PI);   // 后半段前甩
    }

    vm.position.set(tx + bobX + ox, ty + bobY + oy, tz + this.recoilKick * 0.07);
    vm.rotation.set(-this.recoilKick * 0.2 + rx, 0, (def.melee ? 0.35 : 0) + rz);
    if (def.scope) vm.visible = this.adsT < 0.7;
  }
}
