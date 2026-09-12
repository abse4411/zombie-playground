/* ============================================================
 * 刷怪系统 —— 狩猎波次预算 / 遭遇战波次队列
 * ============================================================ */
class SpawnSystem {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.pool = [];
    this.budget = 0;
    this.cap = 10;
    this.interval = 2;
    this.timer = 0;
    this.mults = { hp: 1, speed: 1, dmg: 1, reward: 1 };
    this.active = false;
  }

  reset() {
    this.queue = []; this.pool = []; this.budget = 0;
    this.active = false; this.timer = 0;
    this.mults = { hp: 1, speed: 1, dmg: 1, reward: 1 };
  }

  /* 狩猎模式：按波次配置预算与成长 */
  setHuntWave(wave, diff) {
    const H = GAMECONFIG.hunt;
    this.budget = H.baseBudget + H.budgetPerWave * (wave - 1);
    this.cap = Math.min(H.maxCap, H.baseCap + H.capPerWave * (wave - 1));
    this.interval = Math.max(H.spawnIntervalMin, H.spawnIntervalStart + H.spawnIntervalPerWave * (wave - 1));
    this.timer = 0.6;
    this.mults = {
      hp: diff.hp * (1 + H.hpPerWave * (wave - 1)),
      speed: Math.min(H.maxSpeedMult, diff.speed * (1 + H.speedPerWave * (wave - 1))),
      dmg: diff.dmg,
      reward: diff.reward,
    };
    this.pool = [];
    const mapId = ENGINE.mapDef.id;
    for (const id in ZOMBIE_TYPES) {
      const z = ZOMBIE_TYPES[id];
      if (z.minWave > wave) continue;
      if (z.parkOnly && mapId !== 'park') continue;
      this.pool.push({ id, weight: z.weight });
    }
    this.active = true;
  }

  /* 遭遇战：投放波次编队 */
  addComposition(comp) {
    const list = [];
    for (const id in comp) {
      for (let i = 0; i < comp[id]; i++) list.push(id);
    }
    // 洗牌
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.queue.push(...list);
    this.active = true;
  }

  setMults(m) { this.mults = m; }

  /* ---------- L4D 导演三态 + 尸潮事件（v9.8） ---------- */
  // 狩猎模式每帧调用：Build→Peak→Relax 强度曲线 + 随机尸潮事件
  directorTick(dt) {
    const g = this.game;
    if (!this.director) this.director = { state: 'build', t: 0, hordeT: rand(75, 130), hordeActive: 0 };
    const D = this.director;
    D.t += dt;
    const tension = clamp(g.aliveZombies() / 14, 0, 1);
    switch (D.state) {
      case 'build':   // 酝酿：常规节奏
        if (tension > 0.75 && D.t > 20) { D.state = 'peak'; D.t = 0; HUD.banner('⚡ 感染风暴', '撑住这波！'); }
        break;
      case 'peak':    // 顶峰：加速刷怪
        this.interval = Math.max(0.5, this.interval * (1 - dt * 0.05));
        if (tension < 0.35 || D.t > 45) { D.state = 'relax'; D.t = 0; HUD.toast('🫧 尸潮退去——抓紧补给'); }
        break;
      case 'relax':   // 释放：刷怪降速30%
        if (D.t > 18) { D.state = 'build'; D.t = 0; }
        break;
    }
    // 尸潮事件（L4D Horde）：周期触发40秒高强度潮
    D.hordeT -= dt;
    if (D.hordeT <= 0 && D.hordeActive <= 0 && g.state === 'playing') {
      D.hordeT = rand(90, 150);
      D.hordeActive = 40;
      HUD.banner('🚨 尸潮来袭！', '普通感染体蜂拥而至');
      AUDIO.hordeHorn();
      ENGINE.shake(0.25);
    }
    if (D.hordeActive > 0) {
      D.hordeActive -= dt;
      this.timer -= dt * 2.2;   // 刷速×2.2
      // 额外预算注入（小尸为主）
      if (this.budget < 30) this.budget += dt * 6;
      if (Math.random() < dt * 1.2) this.spawnOne(Math.random() < 0.8 ? 'walker' : 'runner');
    }
    // 兽群巡游（v10.4 Days Gone）：稀有事件——15只成群从一侧横穿地图
    D.migrateT = (D.migrateT === undefined ? rand(180, 300) : D.migrateT) - dt;
    if (D.migrateT <= 0) {
      D.migrateT = rand(240, 400);
      const S = ENGINE.mapDef.size;
      const side = randi(0, 3);
      const z0 = rand(-S * 0.5, S * 0.5);
      HUD.banner('🐃 兽群迁徙', '一大群感染体正在穿过——避开或诱杀');
      AUDIO.howl(0);
      for (let i = 0; i < 15; i++) {
        setTimeout(() => {
          if (!window.GAME || window.GAME.state !== 'playing') return;
          const g4 = window.GAME;
          const sx = side === 0 ? -S : side === 1 ? S : rand(-S * 0.6, S * 0.6);
          const sz = side === 2 ? -S : side === 3 ? S : z0 + rand(-4, 4);
          const z4 = new Zombie(Math.random() < 0.75 ? 'runner' : 'walker', sx, sz, g4.spawner.mults, {});
          z4.riseT = 0; z4.state = 'chase'; z4.pos.y = 0;
          g4.zombies.push(z4);
        }, i * 350);
      }
    }
    // relax 态刷怪间隔 ×1.4
    if (D.state === 'relax') this.interval = Math.min(6, this.interval * (1 + dt * 0.02));
  }

  remaining() {
    let r = this.queue.length;
    if (this.budget > 0) r += Math.ceil(this.budget / 1.6);
    return r;
  }

  exhausted() { return this.queue.length === 0 && this.budget <= 0; }

  update(dt) {
    if (!this.active) return;
    if (typeof NET !== 'undefined' && NET.role === 'client') return;   // 联机客户端不由本地刷怪
    this.timer -= dt;
    if (this.timer > 0) return;
    const cap = Math.max(3, Math.floor(this.cap * (this.game.capMult || 1)));
    if (this.game.aliveZombies() >= cap) { this.timer = 0.35; return; }

    let typeId = null;
    if (this.queue.length) {
      typeId = this.queue.pop();
    } else if (this.budget > 0) {
      const pick = weightedPick(this.pool);
      typeId = pick.id;
      this.budget -= ZOMBIE_TYPES[typeId].cost;
    }
    if (!typeId) { this.active = false; return; }

    this.spawnOne(typeId);
    this.timer = this.interval * rand(0.6, 1.4);
  }

  spawnOne(typeId, x, z, opts = {}) {
    if (typeof NET !== 'undefined' && NET.role === 'client') return null;  // 客户端怪物由房主同步
    let sx = x, sz = z;
    if (sx === undefined) {
      const pts = ENGINE.mapDef.spawns;
      const p = this.game.player.pos;
      const far = pts.filter(s => dist2d(s.x, s.z, p.x, p.z) > 15);
      const use = far.length ? choice(far) : choice(pts);
      sx = use.x + rand(-2.5, 2.5);
      sz = use.z + rand(-2.5, 2.5);
    }
    // 变异感染体判定（v6.9→v7.0）：概率随章节进度与波次递增（14%基础→45%上限），变异可叠加至4个
    const wv = this.game.mode.wave !== undefined ? this.game.mode.wave : (this.game.mode.wavePtr || 0);
    const chapter = this.game.mode.idx || 0;
    if (!opts.boss && !opts.dummy && ZOMBIE_TYPES[typeId].cost < 10 && wv >= 4) {
      const mutChance = Math.min(0.45, GAMECONFIG.elites.chance + wv * 0.012 + chapter * 0.03);
      if (Math.random() < mutChance) {
        const pool = GAMECONFIG.elites.list.slice();
        const extra = (Math.random() < 0.3 ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0) + (Math.random() < 0.05 ? 1 : 0);
        const n = Math.min(1 + extra, pool.length, 4);
        opts.affixList = [];
        for (let i = 0; i < n; i++) opts.affixList.push(pool.splice(randi(0, pool.length - 1), 1)[0]);
      }
    }
    const zb = new Zombie(typeId, sx, sz, this.mults, opts);
    // 血月强化
    const wm = this.game.weatherMult;
    if (wm) {
      zb.maxHp = Math.round(zb.maxHp * wm.hp); zb.hp = zb.maxHp;
      zb.speed *= wm.speed;
      zb.reward = Math.round(zb.reward * wm.reward);
    }
    this.game.zombies.push(zb);
    PARTICLES.dust(sx, 0.4, sz, 7);
    // 地狱犬登场嚎叫（COD Zombies 式预警）
    if (zb.type.quadruped && Math.random() < 0.45) {
      AUDIO.howl(dist2d(sx, sz, this.game.player.pos.x, this.game.player.pos.z));
    }
    return zb;
  }

  spawnExtra(typeId) { this.spawnOne(typeId); }
}
