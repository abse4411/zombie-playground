/* ============================================================
 * 肉鸽割草系统（v10.6）—— 经验宝石 + 升级三选一
 * 调研依据：VS宝石磁吸循环（击杀→宝石→磁吸→连升=多巴胺）+ 决策高峰
 * ============================================================ */

/* ---------- 经验宝石（击杀掉落，磁吸拾取） ---------- */
const XPGEMS = {
  pool: [],
  _geo: null, _mats: null,

  _init() {
    if (this._geo) return;
    this._geo = new THREE.OctahedronGeometry(0.14);
    this._mats = [
      new THREE.MeshBasicMaterial({ color: 0x3aa0ff }),   // 蓝 Lv1
      new THREE.MeshBasicMaterial({ color: 0x52d273 }),   // 绿
      new THREE.MeshBasicMaterial({ color: 0xb05cff }),   // 紫
      new THREE.MeshBasicMaterial({ color: 0xffb044 }),   // 金（大额）
    ];
  },

  drop(x, y, z, xp) {
    this._init();
    let gem = this.pool.find(g => g.life <= 0);
    if (!gem) {
      if (this.pool.length >= 120) return;   // 上限防溢出（VS宝石合并机制简化）
      gem = { mesh: new THREE.Mesh(this._geo, this._mats[0]), life: 0, value: 0, phase: rand(0, TAU) };
      gem.mesh.visible = false;
      ENGINE.scene.add(gem.mesh);
      this.pool.push(gem);
    }
    const tier = xp >= 25 ? 3 : xp >= 10 ? 2 : xp >= 4 ? 1 : 0;
    gem.mesh.material = this._mats[tier];
    gem.mesh.scale.setScalar(tier >= 2 ? 1.5 : 1);
    gem.value = xp;
    gem.life = 25;
    gem.mesh.position.set(x + rand(-0.3, 0.3), Math.max(y, 0.25), z + rand(-0.3, 0.3));
    gem.mesh.visible = true;
  },

  update(dt, game) {
    const p = game.player;
    const magnet = (2.2 + (p.xpMagnet || 0)) * (p.synMagnet ? 2 : 1);   // 磁吸半径（星辰引力翻倍 v10.9）
    for (const g of this.pool) {
      if (g.life <= 0) continue;
      g.life -= dt;
      g.mesh.rotation.y += dt * 3;
      g.mesh.position.y = 0.25 + Math.sin(ENGINE.time * 2.5 + g.phase) * 0.07;
      const d = dist2d(g.mesh.position.x, g.mesh.position.z, p.pos.x, p.pos.z);
      if (d < magnet) {
        // 磁吸：加速飞向玩家
        const k = clamp(dt * (10 + (magnet - d) * 2), 0, 1);
        g.mesh.position.x += (p.pos.x - g.mesh.position.x) * k;
        g.mesh.position.z += (p.pos.z - g.mesh.position.z) * k;
        g.mesh.position.y += (p.pos.y + 1.0 - g.mesh.position.y) * k;
      }
      if (d < 0.7 || g.life <= 0) {
        if (g.life > 0) this.gain(game, g.value);
        g.life = 0;
        g.mesh.visible = false;
      }
    }
  },

  gain(game, xp) {
    const p = game.player;
    if (p.synMagnet) p.addMoney(1);   // 星辰引力：拾取宝石+1现金（v10.9）
    p.xp += xp;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(p.xpNext * 1.25 + 4);
      LEVELUP.queue(game);
    }
  },

  clear() {
    for (const g of this.pool) { g.life = 0; g.mesh.visible = false; }
  },
};

/* ---------- 局内强化池（v10.6 八种战斗强化，v10.9 加连携） ---------- */
const ROGUE_PERKS = [
  { id: 'r_atk',    name: '火力全开', icon: '💢', max: 5, desc: '所有武器伤害 +12%', apply: p => p.rogueAtk = (p.rogueAtk || 1) + 0.12 },
  { id: 'r_rof',    name: '极速扳机', icon: '⚡', max: 5, desc: '射速 +10%',        apply: p => p.rogueRof = (p.rogueRof || 1) + 0.10 },
  { id: 'r_spd',    name: '疾风步',   icon: '🏃', max: 4, desc: '移动速度 +8%',      apply: p => p.rogueSpd = (p.rogueSpd || 1) + 0.08 },
  { id: 'r_hp',     name: '铁壁',     icon: '❤', max: 5, desc: '最大生命 +20 并回满', apply: p => { p.maxHp += 20; p.hp = p.maxHp; } },
  { id: 'r_mag',    name: '磁力核心', icon: '🧲', max: 3, desc: '宝石磁吸范围 +2m',  apply: p => p.xpMagnet = (p.xpMagnet || 0) + 2 },
  { id: 'r_rel',    name: '快手',     icon: '🧤', max: 3, desc: '换弹速度 +15%',     apply: p => p.rogueRel = (p.rogueRel || 1) - 0.15 },
  { id: 'r_crit',   name: '弱点洞察', icon: '🎯', max: 4, desc: '暴击率 +8%（2倍伤害）', apply: p => p.critChance = (p.critChance || 0) + 0.08 },
  { id: 'r_cash',   name: '贪婪',     icon: '💰', max: 3, desc: '金钱获取 +20%',     apply: p => p.cashMult = (p.cashMult || 1) + 0.2 },
];

const LEVELUP = {
  isOpen: false, pending: 0, game: null, choices: [], els: {},

  init() {
    const $ = id => document.getElementById(id);
    this.els = {
      panel: $('levelup'), cards: $('lu-cards'), title: $('lu-title'),
    };
    document.getElementById('lu-close').addEventListener('click', () => this.pick(-1));
  },

  queue(game) {
    this.pending++;
    if (!this.isOpen) this.show(game);
  },

  show(game) {
    if (this.pending <= 0) return;
    this.pending--;
    this.game = game;
    this.isOpen = true;
    this.game.state = 'levelup';   // 暂停世界（VS式决策时刻）
    INPUT.releaseLock();
    // 抽3个不重复且未满级的强化
    const p = game.player;
    p.rogueLevels = p.rogueLevels || {};
    const pool = ROGUE_PERKS.filter(k => (p.rogueLevels[k.id] || 0) < k.max);
    this.choices = [];
    const bag = [...pool];
    while (this.choices.length < 3 && bag.length) {
      this.choices.push(bag.splice(randi(0, bag.length - 1), 1)[0]);
    }
    this.els.title.textContent = `⬆ 等级 ${p.level} — 选择一项强化`;
    this.els.cards.innerHTML = '';
    for (const k of this.choices) {
      const lv = p.rogueLevels[k.id] || 0;
      const card = document.createElement('div');
      card.className = 'lu-card';
      card.innerHTML = `
        <div class="lu-icon">${k.icon}</div>
        <h4>${k.name} <span class="lu-lv">${lv + 1}/${k.max}</span></h4>
        <p>${k.desc}</p>`;
      card.addEventListener('click', () => this.pick(k));
      this.els.cards.appendChild(card);
    }
    this.els.panel.classList.remove('hidden');
    AUDIO.purchase();
  },

  pick(k) {
    const g = this.game, p = g.player;
    if (k) {
      p.rogueLevels[k.id] = (p.rogueLevels[k.id] || 0) + 1;
      k.apply(p);
      HUD.toast(`${k.icon} ${k.name} Lv.${p.rogueLevels[k.id]}`);
      AUDIO.streak();
    }
    this.isOpen = false;
    this.els.panel.classList.add('hidden');
    // 连携检测（v10.9）
    SYNERGY.check(g);
    if (this.pending > 0) { this.show(g); return; }
    g.state = 'playing';
    g.requestLock();
    // 强化系数应用
    p.recomputeRogue();
  },
};

/* ---------- 宝箱轮盘（v10.7 VS式变率奖励） ---------- */
const CHESTS = {
  list: [],
  _geo: null,

  drop(x, z, tier) {   // tier: 1精英 2Boss
    this._init();
    const chest = {
      x, z, tier, life: 30, dead: false,
      group: new THREE.Group(),
    };
    const color = tier === 2 ? 0xffb044 : 0xb05cff;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x3a2e1e, roughness: 0.5, metalness: 0.5, emissive: color, emissiveIntensity: 0.45 })
    );
    box.position.y = 0.2;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.14, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x5a4628, metalness: 0.6, roughness: 0.4 })
    );
    lid.position.y = 0.42;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.18, 3.6, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 1.8;
    chest.group.add(box, lid, beam);
    chest.group.position.set(x, 0, z);
    chest.box = box; chest.lid = lid; chest.beam = beam;
    ENGINE.scene.add(chest.group);
    this.list.push(chest);
    HUD.killfeed(tier === 2 ? '🎁 Boss掉落了黄金宝箱！' : '🎁 精英掉落了宝箱！', 'big');
  },

  _init() {
    if (this._geo) return;
    this._geo = true;
  },

  update(dt, game) {
    const p = game.player;
    for (const c of this.list) {
      if (c.dead) continue;
      c.life -= dt;
      c.box.rotation.y += dt * 1.2;
      c.lid.position.y = 0.42 + Math.sin(ENGINE.time * 3) * 0.04;   // 开合暗示
      if (c.life < 5) c.group.visible = Math.sin(ENGINE.time * 8) > -0.3;
      if (c.life <= 0) { this.remove(c); continue; }
      const d = dist2d(c.x, c.z, p.pos.x, p.pos.z);
      if (d < 1.7) { this.open(game, c); }
    }
  },

  remove(c) {
    c.dead = true;
    ENGINE.scene.remove(c.group);
  },

  // 开箱：变率奖励（老虎机式逐条揭示）
  open(game, c) {
    this.remove(c);
    AUDIO.streak();
    const p = game.player;
    const n = c.tier === 2 ? randi(2, 3) : 1;
    const rewards = [];
    for (let i = 0; i < n; i++) {
      const roll = Math.random();
      if (roll < 0.4) {
        const cash = randi(300, 800) * c.tier;
        rewards.push({ icon: '💰', text: `现金 +$${cash}`, apply: () => p.addMoney(cash) });
      } else if (roll < 0.65) {
        rewards.push({ icon: '❤', text: '生命全满', apply: () => { p.hp = p.maxHp; } });
      } else if (roll < 0.85) {
        rewards.push({ icon: '💣', text: '投掷物补满', apply: () => { for (const k in p.throwables) p.throwables[k].count = THROWABLES[k].max; } });
      } else {
        rewards.push({ icon: '⬆', text: '立即升级！', apply: () => LEVELUP.queue(game) });
      }
    }
    // 逐条揭示（400ms间隔，老虎机节奏）
    REEL.show(rewards);
    for (let i = 0; i < rewards.length; i++) {
      setTimeout(() => { if (window.GAME) { rewards[i].apply(); AUDIO.streak(); } }, 500 + i * 450);
    }
  },

  clear() {
    for (const c of this.list) ENGINE.scene.remove(c.group);
    this.list = [];
  },
};

/* ---------- 开箱揭示轮盘（v10.7） ---------- */
const REEL = {
  show(rewards) {
    const panel = document.createElement('div');
    panel.id = 'chest-reel';
    panel.innerHTML = `<div class="cr-title">🎁 宝箱开启</div><div class="cr-items"></div>`;
    const holder = panel.querySelector('.cr-items');
    for (const r of rewards) {
      const d = document.createElement('div');
      d.className = 'cr-item';
      d.innerHTML = `<span>${r.icon}</span><b>${r.text}</b>`;
      d.style.opacity = '0';
      holder.appendChild(d);
      setTimeout(() => { d.style.opacity = '1'; d.style.transform = 'scale(1.15)'; }, 50);
    }
    document.body.appendChild(panel);
    setTimeout(() => { panel.style.opacity = '0'; setTimeout(() => panel.remove(), 500); }, 600 + rewards.length * 450);
  },
};

/* ---------- 元进度永久强化树（v10.8 永不从零开始） ---------- */
/* 局内结束按表现换算猎杀点数(SP)，主菜单"强化实验室"花SP买永久强化 */
const META_PERKS = [
  { id: 'm_hp',    name: '强化体魄', icon: '❤', max: 5, cost: lv => 120 + lv * 160, desc: lv => `最大生命 +${lv * 8}` },
  { id: 'm_atk',   name: '杀伤训练', icon: '💢', max: 5, cost: lv => 150 + lv * 200, desc: lv => `武器伤害 +${lv * 4}%` },
  { id: 'm_spd',   name: '战术靴',   icon: '🏃', max: 4, cost: lv => 140 + lv * 180, desc: lv => `移动速度 +${lv * 3}%` },
  { id: 'm_mag',   name: '宝石磁场', icon: '🧲', max: 4, cost: lv => 130 + lv * 150, desc: lv => `经验磁吸 +${lv * 0.8}m` },
  { id: 'm_rel',   name: '肌肉记忆', icon: '🧤', max: 4, cost: lv => 140 + lv * 170, desc: lv => `换弹速度 +${lv * 4}%` },
  { id: 'm_cash',  name: '赏金嗅觉', icon: '💰', max: 4, cost: lv => 160 + lv * 190, desc: lv => `金钱获取 +${lv * 6}%` },
  { id: 'm_armor', name: '插板背心', icon: '🛡', max: 3, cost: lv => 200 + lv * 260, desc: lv => `开局护甲 +${lv * 15}` },
  { id: 'm_crit',  name: '猎手直觉', icon: '🎯', max: 3, cost: lv => 220 + lv * 280, desc: lv => `暴击率 +${lv * 3}%` },
];

const META = {
  // 局末结算：击杀/波次/评级→SP
  award(game) {
    const p = game.player;
    const sp = Math.round(p.kills * 1.2 + (game.mode.wave || 0) * 8 + (game.mode.rating === 'S' ? 60 : game.mode.rating === 'A' ? 35 : 15));
    if (!SAVE.data.meta) SAVE.data.meta = { sp: 0, levels: {} };
    SAVE.data.meta.sp += sp;
    SAVE.commit();
    if (sp > 5) HUD.toast(`🧬 猎杀点数 +${sp}（强化实验室可用）`);
    return sp;
  },

  lv(id) { return (SAVE.data.meta && SAVE.data.meta.levels[id]) || 0; },

  buy(id) {
    if (!SAVE.data.meta) SAVE.data.meta = { sp: 0, levels: {} };
    const k = META_PERKS.find(x => x.id === id);
    const lv = this.lv(id);
    if (lv >= k.max) return false;
    const cost = k.cost(lv);
    if (SAVE.data.meta.sp < cost) return false;
    SAVE.data.meta.sp -= cost;
    SAVE.data.meta.levels[id] = lv + 1;
    SAVE.commit();
    AUDIO.purchase();
    return true;
  },

  // 开局应用全部永久强化
  apply(p) {
    if (!SAVE.data.meta) return;
    const L = id => this.lv(id);
    if (L('m_hp')) { p.maxHp += L('m_hp') * 8; p.hp = p.maxHp; }
    if (L('m_atk')) p.metaAtk = 1 + L('m_atk') * 0.04;
    if (L('m_spd')) p.metaSpd = 1 + L('m_spd') * 0.03;
    if (L('m_mag')) p.xpMagnet = (p.xpMagnet || 0) + L('m_mag') * 0.8;
    if (L('m_rel')) p.metaRel = 1 - L('m_rel') * 0.04;
    if (L('m_cash')) p.cashMult = (p.cashMult || 1) + L('m_cash') * 0.06;
    if (L('m_armor')) { p.maxArmor = Math.max(p.maxArmor, L('m_armor') * 15); p.armor = L('m_armor') * 15; }
    if (L('m_crit')) p.critChance = (p.critChance || 0) + L('m_crit') * 0.03;
  },
};

/* ---------- 连携 Build（v10.9 VS式evolution）：强化组合触发进化 ---------- */
const ROGUE_SYNERGIES = [
  { id: 's_inferno', name: '炼狱风暴', icon: '🔥', need: ['r_atk2', 'r_crit2'],
    desc: '火力全开Lv2+弱点洞察Lv2 → 暴击附带小范围爆炸',
    apply: p => p.synInferno = true },
  { id: 's_gale', name: '飓风枪手', icon: '🌪', need: ['r_rof2', 'r_spd2'],
    desc: '极速扳机Lv2+疾风步Lv2 → 移动时射速额外+25%',
    apply: p => p.synGale = true },
  { id: 's_vampire', name: '血猎本能', icon: '🩸', need: ['r_hp2', 'r_cash2'],
    desc: '铁壁Lv2+贪婪Lv2 → 击杀回复1点生命',
    apply: p => p.synVampire = true },
  { id: 's_magnet', name: '星辰引力', icon: '🌟', need: ['r_mag2', 'r_rel1'],
    desc: '磁力核心Lv2+快手Lv1 → 宝石磁吸翻倍且拾取宝石+1现金',
    apply: p => p.synMagnet = true },
];

const SYNERGY = {
  // 每次选完强化后检查
  check(game) {
    const p = game.player;
    p.rogueLevels = p.rogueLevels || {};
    const lv = id => p.rogueLevels[id.replace(/\d$/, '')] || 0;
    for (const sy of ROGUE_SYNERGIES) {
      if (p['syn_' + sy.id]) continue;
      const ok = sy.need.every(n => {
        const m = n.match(/^([a-z_]+)([0-9])$/);
        return (p.rogueLevels[m[1]] || 0) >= +m[2];
      });
      if (ok) {
        sy.apply(p);
        p['syn_' + sy.id] = true;
        HUD.banner(sy.icon + ' 连携觉醒：' + sy.name, sy.desc);
        AUDIO.hordeHorn();
        return sy;
      }
    }
    return null;
  },
};