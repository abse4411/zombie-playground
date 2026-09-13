/* ============================================================
 * 武器系统 —— 第一人称枪模 / 开火 / 弹道 / 近战 / 脚踢 / 投掷 / ADS
 * ============================================================ */
/* ---------- 武器多属性升级（v18.3 重设计） ----------
 * 设计原则：
 * 1. 纯训练/工程类强化（威力、快速换弹、备用弹药不占负重上限时）不再附带
 *    不符合现实逻辑的代价——代价改为更陡的价格曲线
 * 2. 代价只保留符合物理直觉的：扩容弹匣→换弹更慢、射速↑→后坐力↑、
 *    精加工枪管/重弹头→武器更重、长握柄→挥速稍慢
 * 3. 术语区分：弹匣容量=单个弹匣装弹数；备用弹药=弹匣之外携带的子弹总量
 */
const W_UPGRADES = {
  dmg:  { name: '威力强化',  max: 5, gain: '伤害 +6%/级', drawback: '', desc: '重装药弹头，单发威力更高。',
          price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.30 * (lv + 1)) },
  mag:  { name: '扩容弹匣',  max: 5, gain: '弹匣容量 +2 发/级（单弹匣装弹数）', drawback: '换弹时间 +6%/级（长弹匣换装更慢）', desc: '加长弹匣，每次多装 2 发，换起来也稍慢一点。',
          price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.16 * (lv + 1)) },
  rel:  { name: '快速换弹',  max: 4, gain: '换弹时间 -0.08 秒/级', drawback: '', desc: '训练有素的换弹动作，快而不掉弹。',
          price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.26 * (lv + 1)) },
  rof:  { name: '攻速',     max: 3, gain: '攻速 +7%/级', drawback: '', desc: '近战专用：挥击更快。枪械射速线已取消（v19.3）。',
          price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.22 * (lv + 1)) },
  acc:  { name: '精准枪管',  max: 3, gain: '散布 -10%/级', drawback: '武器更重：移速 -1.5%/级（精加工重枪管）', desc: '浮置式重枪管，精度更高、分量也更足。',
          price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.20 * (lv + 1)) },
  res:  { name: '备用弹药',  max: 3, gain: '备用弹药 +30 发/级（不改变弹匣容量）', drawback: '携行更重：移速 -1%/级（多背的弹鼓有分量）', desc: '多带弹鼓/弹链袋——备用子弹总量更多，单弹匣不变。',
          price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.16 * (lv + 1)) },
};

/* ---------- 武器特性专属升级线（v11.11 → v18.3 代价合理化）：按 def 特征自动附加 ---------- */
const W_SPECIALS = {
  pel: { name: '弹丸密度', max: 2, gain: '弹丸 +1',        drawback: '后坐力 +8%（一次喷更多弹丸）', desc: '单发装填更多弹丸，面伤害更高。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.3 * (lv + 1)) },
  psc: { name: '穿甲弹芯', max: 2, gain: '穿透 +1',        drawback: '武器更重：移速 -1.5%（重金属弹头）', desc: '重金属弹芯，可多穿透一名目标。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.32 * (lv + 1)) },
  rng: { name: '加长握柄', max: 2, gain: '范围 +0.25m',    drawback: '攻速 -4%（长柄挥动更慢）', desc: '加长打击半径，挥速略降。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.26 * (lv + 1)) },
  knb: { name: '配重锤头', max: 2, gain: '击退 +18%',      drawback: '武器更重：移速 -1%（锤头有分量）', desc: '加重锤头，撞飞效果更强。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.24 * (lv + 1)) },
  blk: { name: '高爆装药', max: 2, gain: '爆炸半径 +12%',  drawback: '自伤 +10%（离爆心太近照样疼）', desc: '更多装药——爆炸更猛，站太近也更疼。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.34 * (lv + 1)) },
  bur: { name: '稠化燃料', max: 2, gain: '灼烧 +25%/s',    drawback: '直伤 -4%（燃点优先）', desc: '燃料更黏，烧得更狠、直烧略降。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.28 * (lv + 1)) },
  hop: { name: '超导线圈', max: 2, gain: '链跳 +1',        drawback: '链电威力 -3%（分给更多目标）', desc: '电弧可多跳跃一名目标，单跳威力略降。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.34 * (lv + 1)) },
  frz: { name: '深寒制剂', max: 2, gain: '冻结 +1s',       drawback: '武器更重：移速 -1%（冷却剂罐）', desc: '冷冻介质更足，冻得更久、背罐更沉。',
        price: (base, lv) => Math.round((base > 0 ? base : 600) * 0.28 * (lv + 1)) },
};

// 按武器特征返回全部可用升级线（带id的配置对象数组）；近战剔除弹药概念线
// 每条线的 max = min(配置上限, 武器特点上限)（v18.7）
function getUpgradeLines(def) {
  const mk = (id, ovr) => {
    const line = Object.assign({ id }, W_UPGRADES[id] || W_SPECIALS[id], ovr || {});
    if (!(ovr && ovr.max)) line.max = lineMaxFor(def, id);
    return line;
  };
  if (def.melee) return [
    mk('dmg'),   // 近战威力同样无代价（v18.3）
    mk('rof', { name: '攻速', drawback: '', gain: '攻速 +7%' }),
    mk('rng'), mk('knb'),
  ];
  // v19.3：取消枪械"射速强化"线——射速是武器定位的核心标识，不做升级成长
  // （近战"攻速"线仍保留，见下方近战分支的 rof 覆盖）
  const ids = ['dmg', 'mag', 'rel', 'acc', 'res'];
  if ((def.pellets || 1) > 1) ids.push('pel');
  if (def.pierce || def.scope) ids.push('psc');
  if (def.launcher) ids.push('blk');
  if (def.flame) ids.push('bur');
  if (def.chain) ids.push('hop');
  if (def.frost) ids.push('frz');
  return ids.map(id => mk(id));
}
function upgradeDef(id) { return W_UPGRADES[id] || W_SPECIALS[id]; }

/* ---------- 按武器特点限制特性升级线上限（v18.7） ----------
 * 通用线（威力/弹匣容量/换弹速度）全武器统一，不受此限制；
 * 特性线随武器基础数值收缩，避免升级抹平武器定位差异：
 * - 射速：冲锋枪/转管级(≥900)只剩1级、步枪高射速档(≥700)最多2级
 * - 精准：本就极准的狙击(散布≤0.008)只剩1级
 * - 备用弹药：弹链级备弹(≥250)只剩1级
 * - 弹丸密度：霰弹弹丸已多(≥8)只剩1级
 * - 穿甲弹芯：已可穿透多目标(≥2)只剩1级 */
function lineMaxFor(def, id) {
  const base = upgradeDef(id).max;
  if (!def || def.melee) return base;
  switch (id) {
    case 'rof':
      if ((def.rpm || 0) >= 900) return Math.min(base, 1);
      if ((def.rpm || 0) >= 700) return Math.min(base, 2);
      return base;
    case 'acc':
      if ((def.spread || 1) <= 0.008) return Math.min(base, 1);
      if ((def.spread || 1) <= 0.015) return Math.min(base, 2);
      return base;
    case 'res':
      if ((def.reserve || 0) >= 250) return Math.min(base, 1);
      if ((def.reserve || 0) >= 180) return Math.min(base, 2);
      return base;
    case 'pel':
      if ((def.pellets || 1) >= 8) return Math.min(base, 1);
      return base;
    case 'psc':
      if ((def.pierce || 0) >= 2) return Math.min(base, 1);
      return base;
  }
  return base;
}

/* ---------- 武器属性面板数据（v18.3）：基础值 vs 升级后当前值 ----------
 * 返回 [{k, base, cur, better}] —— better: 1=提升(绿) / -1=下降(红) / 0=不变 */
function weaponStatRows(inst) {
  const def = inst.def;
  const rows = [];
  const add = (k, base, cur, fmt, betterIsLower) => {
    const better = betterIsLower ? (cur < base ? 1 : cur > base ? -1 : 0) : (cur > base ? 1 : cur < base ? -1 : 0);
    rows.push({ k, base: fmt(base), cur: fmt(cur), better });
  };
  if (def.melee) {
    add('伤害', def.damage, Math.round(def.damage * inst.dmgMult * 10) / 10, v => v, false);
    add('攻速', Math.round(def.rpm / 10 * 10) / 10, Math.round(def.rpm * inst.rpmMult / 10 * 10) / 10, v => v, true);
    add('攻击范围', def.range, Math.round((def.range + ((inst.upgrades && inst.upgrades.rng) || 0) * 0.25) * 10) / 10, v => v + 'm', false);
    const kb = 1 + 0.18 * ((inst.upgrades && inst.upgrades.knb) || 0);
    add('击退', 1, Math.round(kb * 100) / 100, v => '×' + v, false);
  } else {
    add('单发伤害', def.damage * (def.pellets || 1), Math.round(def.damage * inst.dmgMult * ((def.pellets || 1) + ((inst.upgrades && inst.upgrades.pel) || 0)) * 10) / 10, v => v, false);
    add('射速', def.rpm, Math.round(def.rpm * inst.rpmMult), v => v + '/分', false);
    add('弹匣容量', def.mag, inst.magSize, v => v + ' 发', false);
    add('备用弹药', def.reserve, Math.floor(def.reserve * (inst.reserveMaxMult || 1)), v => v + ' 发', false);
    add('换弹时间', def.reloadTime, Math.round(def.reloadTime * inst.reloadTimeMult * 100) / 100, v => v + 's', true);
    add('散布', 100, Math.round(inst.spreadMult * 100), v => v + '%', true);
    add('穿透', def.pierce || 0, (def.pierce || 0) + ((inst.upgrades && inst.upgrades.psc) || 0), v => v + ' 人', false);
    add('移动速度', Math.round((def.weight || 1) * 100) / 100, Math.round((def.weight || 1) * (inst.movePenalty || 1) * 100) / 100, v => '×' + v, false);
  }
  return rows;
}

/* ---------- 升级预览（v18.4）：指定升级线再升一级后的全部属性行 ----------
 * 返回 [{k, cur(当前), next(预览), better, changed}] —— 只有 changed 行才有数值变化 */
function weaponPreviewRows(inst, upId) {
  const tmp = Object.create(inst);   // 原型链继承 def/方法，仅覆写 upgrades
  tmp.upgrades = Object.assign({}, inst.upgrades, { [upId]: ((inst.upgrades && inst.upgrades[upId]) || 0) + 1 });
  const cur = weaponStatRows(inst);
  const nxt = weaponStatRows(tmp);
  return cur.map((r, i) => {
    const changed = r.cur !== nxt[i].cur;
    return { k: r.k, cur: r.cur, next: nxt[i].cur, better: changed ? nxt[i].better : 0, changed };
  });
}

/* 道具槽种类顺序（v18.1）：数字键5循环切换 */
const ITEM_KINDS = ['medkit', 'armorplate', 'adrenaline'];   // v19.6：弹药袋改为拾取即用，移出道具栏

/* 赤手空拳（v18.2）：全部武器丢光后的徒手状态——左键轻击/右键重击，消耗体力 */
const FIST_DEF = {
  id: 'fist', name: '赤手空拳', slot: 'melee', melee: true,
  damage: 10, rpm: 150, range: 1.5, arc: 0.55,
  weight: 1.05, len: 0.25, price: 0,
  mag: 0, reserve: 0, reloadTime: 0,
  sound: { freq: 320, dur: 0.05, boom: 0.15 },
  desc: '没有武器时的最后手段——轻击快而省力，重击击退更强但更耗体力。',
};

class WeaponInstance {
  constructor(def) {
    this.def = def;
    this.mag = def.mag;
    this.reserve = def.reserve;
    this.lvl = 0;   // 总品质等级（各分项之和，Borderlands 色阶仍用）
    // 分项升级（v11.5）
    this.upgrades = {};
  }
  // 有效等级（v18.7）：按武器特点上限钳制——旧存档超限等级不再生效
  _lv(id) { return Math.min((this.upgrades && this.upgrades[id]) || 0, lineMaxFor(this.def, id)); }
  get magSize() {
    if (!this.def.mag) return 0;   // 近战无弹匣概念
    let m = this.def.mag * (1 + 0.2 * this.lvl);   // 旧总等级仍生效（兼容存档）
    if (this._lv('mag')) m += 2 * this._lv('mag');   // v18.4：小步长，每级 +2 发
    return Math.max(1, Math.round(m));
  }
  get dmgMult() {
    let d = 1 + 0.15 * this.lvl;
    if (this._lv('dmg')) d *= 1 + 0.06 * this._lv('dmg');   // v18.4：每级 +6%
    return d;
  }
  get reloadTimeMult() {
    let r = 1;
    if (this._lv('rel')) r = Math.max(0.4, r - 0.08 * this._lv('rel'));   // v18.4：每级 -0.08 秒（按基准1s折算）
    if (this._lv('mag')) r *= 1 + 0.06 * this._lv('mag');   // 长弹匣换装更慢（v18.3 唯一保留的换弹代价）
    return r;
  }
  get rpmMult() {
    let r = 1;
    // v19.3：枪械射速线已取消，rof 加成仅近战"攻速"线保留
    if (this.def.melee && this._lv('rof')) r *= 1 + 0.07 * this._lv('rof');
    if (this.def.melee) r *= 1 - 0.04 * (this.upgrades.rng || 0);   // 长握柄挥速代价（v18.3：近战威力不再降攻速）
    return r;
  }
  get spreadMult() {
    let s = 1;
    if (this._lv('acc')) s *= 1 - 0.10 * this._lv('acc');   // v18.4：每级 -10%
    return s;
  }
  get reserveMaxMult() {
    // v18.4：每级 +30 发（等效乘区，保持调用方兼容）
    let r = 1;
    const lv = this._lv('res');
    if (lv && this.def.reserve) r += 30 * lv / this.def.reserve;
    return r;
  }
  // 后坐力乘区（v18.3：霰弹弹丸密度的现实代价；v19.3 枪械射速线移除后仅剩弹丸密度）
  get recoilMult() {
    return 1 + 0.08 * this._lv('pel');
  }
  // 移速代价乘区（v18.3：精准枪管/穿甲弹芯/配重锤头/备用弹药/深寒罐的重量代价）
  get movePenalty() {
    return 1 - 0.015 * this._lv('acc') - 0.015 * this._lv('psc') - 0.01 * this._lv('knb') - 0.01 * this._lv('res') - 0.01 * this._lv('frz');
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

  get w() {
    // 赤手空拳（v18.2）：徒手状态返回虚拟拳套实例，复用整条近战管线
    if (this.p.current === 'fist') return this._fistW || (this._fistW = new WeaponInstance(FIST_DEF));
    return this.p.weapons[this.p.current];
  }

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
    // 道具槽（v18.1）：手持道具模型
    if (this.p.current === 'item') { this._buildItemViewmodel(this._selItem()); return; }
    // 赤手空拳（v18.2）：徒手双拳模型
    if (this.p.current === 'fist') { this._buildFistViewmodel(); return; }
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
    if (INPUT.justPressed('Digit5')) this._cycleItem();
    if (INPUT.justPressed('KeyQ')) this._lastInv();
    if (INPUT.justPressed('KeyR')) this._startReload();
    if (INPUT.justPressed('KeyF')) this._kick(game);
    if (INPUT.justPressed('KeyH')) this.p.useMedkit();
    // G键丢弃（v18.2）：武器抛出 / 投掷物·道具各丢1个
    if (INPUT.justPressed('KeyG')) this._dropCurrent(game);
    // 投掷蓄力状态机（v11.7→v18.1）：仅投掷槽左键触发；按住蓄力松开投出
    if (this.chargeThrow) {
      if (INPUT.lmb) {
        this.chargePower = Math.min(1, (this.chargePower || 0) + dt * 1.4);
      } else {
        this._chargeLmbSeen = false;
        this._releaseCharge(game);
      }
    }

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
    // 道具槽（v18.1）：左键使用选中道具；RMB 收枪
    if (p.current === 'item') {
      const ik = this._selItem();
      if (ik && this.switchT <= 0 && INPUT.consumeLmb()) {
        this._useAnimT = 0.5;
        if (p.useItem(ik)) {
          // 用完最后一个：自动收枪
          if (this.p.itemCount(ik) <= 0) {
            const kinds = this._itemKinds();
            if (!kinds.length) this._holsterFromItem();
          }
        }
      }
      if (INPUT.rmb && !this._prevRmb) this._holsterFromItem();
      this._prevRmb = INPUT.rmb;
    }
    // 注意：_prevRmb 只在投掷/道具/近战分支内更新（v18.2 修复——
    // 若在此处统一刷新会提前消费 RMB 边沿，导致近战重击永远无法触发）
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
    if (!w && this.p.current !== 'throw' && this.p.current !== 'item') return;
    if (this.p.current === 'throw') {
      // 投掷槽主循环：无开火/ADS，仅保持视图模型动画与移速
      this.p.moveMult = 1.02;
      this._updateViewmodel(dt);
      HUD.setScope(false);
      return;
    }
    if (this.p.current === 'item') {
      // 道具槽主循环（v18.1）：无开火/ADS
      this.p.moveMult = 1.02;
      if (this._useAnimT > 0) this._useAnimT -= dt;
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
      /* 近战攻击设计（v18.2）：
       * 轻击 [左键]：转速=武器rpm，伤害×1，基础击退/硬直——持续输出的主力
       * 重击 [右键]：0.16s 前摇蓄力后落锤，伤害×2.2、击退×2.2、硬直1.4s、
       *              攻速×0.5、范围+0.4m——控制/破盾用，可被切枪取消
       * 赤手空拳：轻击耗体力10、重击18，体力不足无法挥拳 */
      const heavyEdge = INPUT.rmb && !this._prevRmb;
      this._prevRmb = INPUT.rmb;
      const wantFire = def.continuous ? INPUT.lmb : INPUT.consumeLmb();
      if (this.swingT >= 0) { this.swingT += dt; if (this.swingT > this._swingDur) this.swingT = -1; }
      // 重击前摇结算：蓄力完成→落锤
      if (this._heavyPending > 0) {
        this._heavyPending -= dt;
        if (this._heavyPending <= 0) {
          this._meleeHit(def, game, true);
          ENGINE.shake(0.16);
          this.cooldown = 60 / (def.rpm * 0.5);
        }
      }
      if (this._heavyPending <= 0 && this.cooldown <= 0 && this.switchT <= 0) {
        if (heavyEdge) {
          if (this._fistStamina(GAMECONFIG.fist.heavyCost)) {
            this._heavyPending = GAMECONFIG.fist.windup;   // 前摇：延迟落锤
            this._swingDur = 0.55;
            this.swingT = 0;
            this._heavySwing = true;
            if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'swing', 0.5);
          }
        } else if (wantFire) {
          if (this._fistStamina(GAMECONFIG.fist.lightCost)) {
            this.cooldown = 60 / (def.rpm * (this.p.rogueRof || 1) * (this.w.rpmMult || 1));   // 近战攻速受升级代价影响（v11.11）
            this._swingDur = 0.3;
            this.swingT = 0;
            this._heavySwing = false;
            if (typeof GAME !== 'undefined' && GAME.playerBody) bodyAct(GAME.playerBody, 'swing', 0.32);
            this._meleeHit(def, game, false);
          }
        }
      }
    } else {
      const wantFire = def.auto ? INPUT.lmb : INPUT.consumeLmb();
      // 开火门槛 = 冷却归零（v18.4 修复：旧条件 cooldown<=单发间隔 在递减一帧后恒成立，
      // 导致全自动武器按帧率开火——标称射速低 步枪实际射速远超面板值）
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
  // 单发间隔（v18.4 统一计算：飓风枪手移速加成在此生效）
  fireInterval(def, w) {
    const gale = (this.p.synGale && this.p.moving) ? 1.25 : 1;   // 飓风枪手（v10.9）
    return 60 / (def.rpm * (this.p.rogueRof || 1) * (w.rpmMult || 1) * gale);
  }
  _fire(def, w, game) {
    w.mag--;
    this.cooldown = this.fireInterval(def, w);
    AUDIO.shot(def.sound.freq, def.sound.dur, def.sound.boom);
    this.recoilKick = Math.min(1, this.recoilKick + 0.55);
    const kick = def.recoil * (w.recoilMult || 1) * rand(0.7, 1.3);   // 后坐力乘区（v18.3：射速/弹丸密度代价）
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
    const pellets = (def.pellets || 1) + Math.min(((w.upgrades && w.upgrades.pel) || 0), lineMaxFor(def, 'pel'));   // 弹丸密度升级（v11.11，v18.7 按武器上限钳制）
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

    const take = allHits.slice(0, (def.pierce || 0) + 1 + Math.min(((this.w.upgrades && this.w.upgrades.psc) || 0), lineMaxFor(def, 'psc')));   // 穿甲弹芯（v11.11，v18.7 钳制）
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
      if (Math.abs(z.pos.y - p.pos.y) > 2) continue;   // 高差过大（天台/楼下）不可近战（v14.1）
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
    // 肾上腺素（v18.1）：换弹速度 +35%
    const adr = this.p.adrenalineT > 0 ? 0.65 : 1;
    this.reloadT = w.def.reloadTime * this.p.reloadMult * (w.reloadTimeMult || 1) * adr;
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
  // 切枪/掏出时清除残留的左键点击边沿（v19.2）：
  // 全自动武器按住射击期间 lmbEdge 不被消费，带着残留边沿切到投掷/道具槽
  // 会在切换动画结束后立刻误触发蓄力投掷/道具使用——表现为"按4有时自动丢雷"
  _flushClickEdge() { INPUT.lmbEdge = false; }

  _equip(slot, inst) {
    this._flushClickEdge();
    if (!this.p.weapons[slot] && !inst) return;
    if (this.p.weapons[slot] && this.p.current === slot && !inst) return;
    this._rememberLast();
    if (inst) this.p.weapons[slot] = inst;
    else if (!this.p.weapons[slot]) return;
    this.p.current = slot;
    this.switchT = 0.38; this.reloadT = 0; this.adsT = 0;
    // 转管预热（v8.4 minigun）：切换时间加长
    if (this.w.def.spinup) this.switchT = this.w.def.spinup;
    this.swingT = -1; this._fireKick = 0; this._heavyPending = 0;
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
    this._flushClickEdge();
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
    if (this._anyItemOwned()) order.push('item');
    let i = Math.max(0, order.indexOf(this.p.current));
    for (let k = 0; k < order.length; k++) {
      i = (i + dir + order.length) % order.length;
      const s = order[i];
      if (s === 'throw') { if (this.p.current !== 'throw') { this._cycleThrow(); return; } }
      else if (s === 'item') { if (this.p.current !== 'item') { this._cycleItem(); return; } }
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
    this._flushClickEdge();
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
    else this._enterFist();   // 一把武器都不剩：徒手（v18.2）
  }

  /* ---------- 道具槽（v18.1）：医疗包/护甲板/弹药袋/肾上腺素 ---------- */
  _itemKinds() {
    return ITEM_KINDS.filter(k => this.p.itemCount(k) > 0);
  }

  _anyItemOwned() { return this._itemKinds().length > 0; }

  // 当前选中道具（选中数量耗尽时自动顺延）
  _selItem() {
    const kinds = this._itemKinds();
    if (!kinds.length) { return null; }
    if (!kinds.includes(this.p.itemSel)) this.p.itemSel = kinds[0];
    return this.p.itemSel;
  }

  // Digit5 / 循环：掏出或切换下一种持有中的道具
  _cycleItem() {
    const kinds = this._itemKinds();
    if (!kinds.length) { AUDIO.emptyClick(); HUD.toast('没有可用道具——可在商城补给'); return; }
    let idx = kinds.indexOf(this.p.itemSel);
    if (this.p.current === 'item') idx = (idx + 1) % kinds.length;   // 已掏出：切换种类
    else idx = Math.max(0, idx);
    this._equipItemKind(kinds[idx]);
  }

  _equipItemKind(kind) {
    this._flushClickEdge();
    this.p.itemSel = kind;
    this._rememberLast();
    this.p.current = 'item';
    this.switchT = 0.3; this.reloadT = 0; this.adsT = 0;
    this.swingT = -1; this._fireKick = 0;
    this.chargeThrow = null;
    this._buildItemViewmodel(kind);
    AUDIO.weaponSwitch();
    const it = GAMECONFIG.items[kind];
    HUD.pickup(`${it.icon} ${it.name} ×${this.p.itemCount(kind)} —— 左键使用`, 1);
  }

  _holsterFromItem() {
    const lw = this.p.lastWeapon;
    let inst = null;
    if (lw) inst = this.p.rack[lw.slot]?.find(r => r.def.id === lw.defId);
    if (inst) this._equip(lw.slot, inst);
    else if (this.p.weapons.secondary) this._equip('secondary');
    else if (this.p.weapons.primary) this._equip('primary');
    else if (this.p.weapons.melee) this._equip('melee');
    else this._enterFist();   // 一把武器都不剩：徒手（v18.2）
  }

  /* ---------- 赤手空拳（v18.2） ---------- */
  // 全部武器丢光后的徒手状态：复用近战管线，攻击消耗体力
  _enterFist() {
    this._flushClickEdge();
    this.p.current = 'fist';
    this.switchT = 0.3; this.reloadT = 0; this.adsT = 0;
    this.swingT = -1; this._fireKick = 0;
    this.chargeThrow = null;
    this._buildViewmodel();
    AUDIO.weaponSwitch();
    HUD.pickup('✊ 赤手空拳——左键轻击 / 右键重击（消耗体力）', 1);
  }

  // 徒手挥拳的体力门槛：不足时拒绝攻击并节流提示
  _fistStamina(cost) {
    if (this.p.current !== 'fist') return true;
    if (this.p.stamina < cost) {
      if (!this._fistTipT || this._fistTipT <= 0) {
        this._fistTipT = 1.2;
        HUD.toast('💨 体力不足，无法挥拳');
        AUDIO.emptyClick();
      }
      return false;
    }
    this.p.stamina -= cost;
    return true;
  }

  _buildFistViewmodel() {
    this._disposeViewmodel();
    const g = new THREE.Group();
    const skin = ART.mat(0xc09a74, { roughness: 0.7 });
    const sleeve = ART.mat(0x3a4236, {});
    for (const side of [-1, 1]) {
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.085, 0.11), skin);
      fist.position.set(side * 0.15, -0.15, -0.3);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.18), sleeve);
      arm.position.set(side * 0.16, -0.17, -0.21);
      arm.rotation.x = 0.15;
      g.add(fist, arm);
    }
    this.viewmodel = g;
    ENGINE.camera.add(g);
    ENGINE.scene.add(ENGINE.camera);
  }

  /* ---------- G键丢弃（v18.2） ---------- */
  _dropCurrent(game) {
    const p = this.p;
    // 徒手状态：没有可丢弃的东西
    if (p.current === 'fist') { AUDIO.emptyClick(); return; }
    // 投掷槽：丢出当前选中投掷物 ×1
    if (p.current === 'throw') {
      const kind = this._selKind();
      if (!kind) { AUDIO.emptyClick(); return; }
      p.throwables[kind].count--;
      const pos = tossPos(game);
      // v18.6：掉落物种类统一用掉落表键（molotov→molo），保证模型/标签/拾取链路一致
      const dropKind = kind === 'molotov' ? 'molo' : kind;
      spawnGroundDrop(game, dropKind, pos.x, pos.z, { amount: 1, delay: 1.2, toss: true });
      HUD.pickup(`🗑 已丢弃 ${THROWABLES[kind].name}`, 0);
      AUDIO.uiClick();
      // 丢空该种类：自动顺延到下一种或收枪
      if (p.throwables[kind].count <= 0) {
        if (!this._anyThrowOwned()) this._holsterFromThrow();
        else { const nk = this._selKind(); if (nk) this._buildThrowViewmodel(nk); }
      }
      return;
    }
    // 道具槽：丢出当前选中道具 ×1
    if (p.current === 'item') {
      const ik = this._selItem();
      if (!ik) { AUDIO.emptyClick(); return; }
      p.itemConsume(ik);
      const pos = tossPos(game);
      spawnGroundDrop(game, ik, pos.x, pos.z, { amount: 1, delay: 1.2, toss: true });
      HUD.pickup(`🗑 已丢弃 ${GAMECONFIG.items[ik].name}`, 0);
      AUDIO.uiClick();
      if (!this._anyItemOwned()) this._holsterFromItem();
      else { const nk = this._selItem(); if (nk && nk !== ik) this._buildItemViewmodel(nk); }
      return;
    }
    // 武器：丢出手中武器（抛出一段距离）——全部武器都可以丢，包括最后一把
    const w = this.w;
    if (!w) { AUDIO.emptyClick(); return; }
    const slot = p.current;
    const idx = p.rack[slot] ? p.rack[slot].indexOf(w) : -1;
    if (idx >= 0) p.rack[slot].splice(idx, 1);
    p.weapons[slot] = (p.rack[slot] && p.rack[slot][0]) || null;
    const pos = tossPos(game);
    spawnGroundDrop(game, 'weapon', pos.x, pos.z, { inst: w, rarity: rarityForPrice(w.def.price), delay: 1.2, toss: true });
    HUD.pickup(`🗑 已丢弃 ${w.def.name}`, 0);
    AUDIO.uiClick();
    // 切到下一把可用武器；全空 → 赤手空拳（v18.2）
    const nextSlot = ['primary', 'secondary', 'melee'].find(s => p.weapons[s]);
    if (nextSlot) this._equip(nextSlot);
    else this._enterFist();
  }

  // 手持道具模型（极简风格与投掷槽一致）
  _buildItemViewmodel(kind) {
    this._disposeViewmodel();
    const it = GAMECONFIG.items[kind] || GAMECONFIG.items.medkit;
    const g = new THREE.Group();
    const body = new THREE.Group();
    if (kind === 'medkit') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.12), ART.mat(0xd8dde2, { roughness: 0.5 }));
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.004), new THREE.MeshBasicMaterial({ color: 0xe63946 }));
      cross1.position.set(0, 0.02, 0.062);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.07, 0.004), new THREE.MeshBasicMaterial({ color: 0xe63946 }));
      cross2.position.set(0, 0.02, 0.062);
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), ART.mat(0x3a4046, {}));
      latch.position.set(0, -0.05, 0);
      body.add(box, cross1, cross2, latch);
    } else if (kind === 'armorplate') {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.03), ART.mat(0x2e3638, { roughness: 0.35, metalness: 0.55 }));
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.034), ART.mat(0x4a3226, {}));
      body.add(plate, strap);
    } else if (kind === 'ammobag') {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.1), ART.mat(0x4a4232, { roughness: 0.7 }));
      const bullet1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 6), ART.mat(0xc9a24a, { metalness: 0.7, roughness: 0.3 }));
      bullet1.position.set(-0.04, 0.08, 0);
      const bullet2 = bullet1.clone(); bullet2.position.x = 0;
      const bullet3 = bullet1.clone(); bullet3.position.x = 0.04;
      body.add(pouch, bullet1, bullet2, bullet3);
    } else {
      // 肾上腺素注射器
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8),
        new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0.85 }));
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), ART.mat(0xc8d0da, { metalness: 0.8, roughness: 0.2 }));
      needle.position.y = -0.1;
      const plunger = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.015), ART.mat(0xd8dde2, {}));
      plunger.position.y = 0.09;
      body.add(tube, needle, plunger);
    }
    // 手持姿态：交由 _updateViewmodel 统一摆放（投掷槽基准位），本体仅微调
    body.position.set(0.03, 0.01, 0.04);
    body.rotation.z = -0.12;
    g.add(body);
    // 第一人称手臂
    const sleeveColor = 0x3a4236;
    attachArmsToViewmodel(g, { melee: true, len: 0.3 }, sleeveColor);
    this.viewmodel = g;
    ENGINE.camera.add(g);
    ENGINE.scene.add(ENGINE.camera);
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
    const shatter = this.chargeThrow === 'molotov';   // 燃烧瓶碰墙即碎：预测线截断在墙面（v20.3）
    let n = 0, lx = x, ly = y, lz = z;
    for (let i = 0; i < 96 * 2 && n < 96; i++) {
      vy -= cfg.gravity * step;
      let nx = x + vx * step;
      if (pointBlocked(nx, y, z)) { if (shatter) break; vx *= -0.4; nx = x; }   // 与 Projectile 一致的撞墙反弹
      x = nx;
      let nz = z + vz * step;
      if (pointBlocked(x, y, nz)) { if (shatter) break; vz *= -0.4; nz = z; }
      z = nz;
      y += vy * step;
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
    const isThrow = !w && (this.p.current === 'throw' || this.p.current === 'item');
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
